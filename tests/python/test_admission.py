from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest
from airfoil_exporter.admission import (
    AdmittedSample,
    active_and_fixed_parameters,
    admit_row,
    deduplicate_samples,
    nearest_record,
    normalized_distance,
    records_from_samples,
)
from airfoil_exporter.constants import BASELINE_PARAMETERS, PARAMETER_ORDER
from airfoil_exporter.geometry import float32, float32_vector
from airfoil_exporter.models import ProvenanceV1
from airfoil_exporter.registry import load_registry

ROOT = Path(__file__).resolve().parents[2]


def _reviewed_run():
    return load_registry(ROOT / "config/wandb-runs.yaml").reviewed_runs[0]


def _row() -> dict[str, object]:
    return {
        "_step": 3,
        "_timestamp": "2026-01-01T00:00:00Z",
        "action/x_c": 0.4,
        "aero/step_avg_Cl": 0.5,
        "aero/step_avg_Cd": 0.02,
        "geometry/step_curvature_ratio": 0.4,
        "status/invalid_geometry": 0,
    }


@pytest.mark.parametrize(
    ("mutations", "expected"),
    [
        ({"action/x_c": "nan", "aero/step_avg_Cl": None}, "NONFINITE_ACTION"),
        ({"action/x_c": 0.9, "aero/step_avg_Cl": None}, "ACTION_OUT_OF_BOUNDS"),
        ({"aero/step_avg_Cl": None}, "MISSING_AERO"),
        ({"aero/step_avg_Cl": "nan"}, "NONFINITE_AERO"),
        ({"aero/step_avg_Cl": 0.0}, "NONPOSITIVE_LIFT"),
        ({"aero/step_avg_Cl": -0.2}, "NONPOSITIVE_LIFT"),
        ({"status/invalid_geometry": 1}, "INVALID_GEOMETRY"),
        ({"status/invalid_geometry": None}, "MISSING_VALIDITY"),
        ({"geometry/step_curvature_ratio": None}, "MISSING_CURVATURE"),
        ({"geometry/step_curvature_ratio": "inf"}, "CURVATURE_LIMIT"),
        ({"geometry/step_curvature_ratio": 1.0}, "CURVATURE_LIMIT"),
    ],
)
def test_admission_reasons_and_precedence(mutations: dict[str, object], expected: str) -> None:
    row = _row()
    row.update(mutations)
    decision = admit_row(row, run=_reviewed_run(), run_state="finished")
    assert decision.reason == expected
    assert decision.sample is None


def test_run_and_schema_reasons_precede_row_validation() -> None:
    run = _reviewed_run()
    assert admit_row({}, run=run, run_state="running").reason == "RUN_NOT_FINISHED"
    candidate = load_registry(ROOT / "config/wandb-runs.yaml").candidate_runs[0]
    assert admit_row({}, run=candidate, run_state="finished").reason == "RUN_NOT_APPROVED"
    unknown_schema = run.model_copy(update={"action_schema": None})
    assert admit_row({}, run=unknown_schema, run_state="finished").reason == "UNKNOWN_ACTION_SCHEMA"


def test_each_row_reconstructs_independently_from_pinned_baseline() -> None:
    run = _reviewed_run()
    first = admit_row(_row(), run=run, run_state="finished").sample
    second_row = _row()
    second_row.pop("action/x_c")
    second = admit_row(second_row, run=run, run_state="finished").sample
    assert first is not None and second is not None
    x_c_index = PARAMETER_ORDER.index("x_c")
    assert first.parameters[x_c_index] == float32(0.4)
    assert second.parameters[x_c_index] == float32(BASELINE_PARAMETERS["x_c"])


def _sample(
    *, parameters: tuple[float, ...], timestamp: str, step: int, run_id: str, cl: float
) -> AdmittedSample:
    return AdmittedSample(
        parameters=float32_vector(parameters),
        cl=cl,
        cd=0.02,
        curvature_ratio=0.4,
        provenance=ProvenanceV1(
            run_id=run_id,
            global_step=step,
            recorded_at=datetime.fromisoformat(timestamp).replace(tzinfo=UTC),
        ),
    )


def test_float32_dedup_preserves_count_and_selects_newest_representative() -> None:
    baseline = tuple(BASELINE_PARAMETERS[name] for name in PARAMETER_ORDER)
    close = list(baseline)
    close[1] += 1.0e-10
    samples = [
        _sample(parameters=baseline, timestamp="2026-01-01", step=10, run_id="aaa", cl=0.5),
        _sample(parameters=tuple(close), timestamp="2026-01-02", step=1, run_id="bbb", cl=0.6),
        _sample(parameters=tuple(close), timestamp="2026-01-02", step=1, run_id="ccc", cl=0.7),
    ]
    records = deduplicate_samples(samples)
    assert len(records) == 1
    assert records[0].replicate_count == 3
    assert len(records[0].replicate_provenance) == 3
    assert records[0].provenance.run_id == "ccc"
    assert records[0].cl == 0.7


def test_iteration_records_preserve_each_valid_history_row() -> None:
    baseline = tuple(BASELINE_PARAMETERS[name] for name in PARAMETER_ORDER)
    samples = [
        _sample(parameters=baseline, timestamp="2026-01-01", step=10, run_id="aaa", cl=0.5),
        _sample(parameters=baseline, timestamp="2026-01-02", step=12, run_id="aaa", cl=0.7),
    ]
    records = records_from_samples(samples)
    assert [record.stable_record_index for record in records] == [0, 1]
    assert [record.provenance.global_step for record in records] == [10, 12]
    assert [record.cl for record in records] == [0.5, 0.7]
    assert all(record.replicate_count == 1 for record in records)


def test_active_parameters_and_nearest_use_authoritative_bounds_and_stable_ties() -> None:
    baseline = tuple(BASELINE_PARAMETERS[name] for name in PARAMETER_ORDER)
    altered = list(baseline)
    altered[PARAMETER_ORDER.index("x_c")] = 0.5
    records = deduplicate_samples(
        [
            _sample(parameters=baseline, timestamp="2026-01-01", step=1, run_id="aaa", cl=0.5),
            _sample(
                parameters=tuple(altered),
                timestamp="2026-01-01",
                step=2,
                run_id="aaa",
                cl=0.6,
            ),
        ]
    )
    active, fixed = active_and_fixed_parameters(records)
    assert active == ("x_c",)
    assert set(fixed) == set(PARAMETER_ORDER) - {"x_c"}
    query = {"x_c": 0.45}
    expected = abs(0.45 - records[0].parameters[1]) / (0.75 - 0.25)
    assert normalized_distance(query, records[0].parameters, active) == pytest.approx(expected)
    tied_query = {"x_c": (records[0].parameters[1] + records[1].parameters[1]) / 2.0}
    assert nearest_record(tied_query, records, active).stable_record_index == 0
