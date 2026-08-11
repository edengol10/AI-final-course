from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from airfoil_exporter.constants import ALLOWED_HISTORY_KEYS, PARAMETER_ORDER
from airfoil_exporter.models import ProvenanceV1, WingRecord
from airfoil_exporter.registry import compatibility_group_id, load_registry
from airfoil_exporter.source import FixtureHistorySource, WandbHistorySource
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[2]


def test_registry_has_exact_reviewed_allowlist_and_candidate_set() -> None:
    registry = load_registry(ROOT / "config/wandb-runs.yaml")
    assert registry.entity == "edenunu-technion-israel-institute-of-technology"
    assert registry.project == "wing parameter test"
    assert {run.run_id for run in registry.reviewed_runs} == {
        "fo7gm0ds",
        "opffdpy8",
        "5etm3jjj",
        "nl9fb08e",
        "k202yi52",
    }
    assert {run.run_id for run in registry.candidate_runs} == {
        "sjhhvgd6",
        "elstxotw",
        "1n93x16f",
        "syqss1sr",
        "ud0cqk5m",
        "y44fmpfc",
    }
    assert all(run.exclusion_reason == "PENDING_FRESH_AUDIT" for run in registry.candidate_runs)


def test_unknown_compatibility_isolates_each_run() -> None:
    registry = load_registry(ROOT / "config/wandb-runs.yaml")
    ids = [compatibility_group_id(run) for run in registry.reviewed_runs]
    assert len(ids) == len(set(ids))
    known_a = registry.reviewed_runs[0].model_copy(
        update={
            "compatibility": registry.reviewed_runs[0].compatibility.model_copy(
                update={"solver_revision": "abc123"}
            )
        }
    )
    known_b = registry.reviewed_runs[1].model_copy(update={"compatibility": known_a.compatibility})
    assert compatibility_group_id(known_a) == compatibility_group_id(known_b)


def test_fixture_contains_only_narrow_scan_history_keys() -> None:
    source = FixtureHistorySource(ROOT / "tests/fixtures/wandb_history_v1.json")
    run = source.read_run("fo7gm0ds")
    assert all(set(row) <= set(ALLOWED_HISTORY_KEYS) for row in run.rows)


def test_fixture_rejects_undeclared_history_fields(tmp_path: Path) -> None:
    fixture = tmp_path / "bad.json"
    fixture.write_text(
        '{"schemaVersion":"wandb-history-fixture-v1","runs":['
        '{"runId":"abc","state":"finished","rows":[{"private/config":1}]}]}',
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="undeclared"):
        FixtureHistorySource(fixture)


def test_wandb_query_uses_only_declared_history_keys(monkeypatch) -> None:
    query_keys: list[list[str]] = []

    class FakeRun:
        state = "finished"

        def scan_history(self, *, keys: list[str], page_size: int):
            assert page_size == 1000
            query_keys.append(keys)
            return (
                {"_step": 1},
            )

    class FakeApi:
        def __init__(self, *, timeout: int) -> None:
            assert timeout == 30

        def run(self, path: str) -> FakeRun:
            assert path == "entity/project/run-id"
            return FakeRun()

    monkeypatch.setitem(sys.modules, "wandb", SimpleNamespace(Api=FakeApi))

    default_source = WandbHistorySource(entity="entity", project="project")
    default_run = default_source.read_run("run-id")
    assert query_keys[0] == list(ALLOWED_HISTORY_KEYS)
    assert default_run.rows[0] == {"_step": 1}


def test_public_wing_record_forbids_coordinates_and_extra_metadata() -> None:
    provenance = ProvenanceV1(run_id="abc", global_step=1, recorded_at=None)
    data = {
        "stableRecordIndex": 0,
        "parameters": [0.0] * len(PARAMETER_ORDER),
        "coordinatesX": [0.0] * 253,
        "cl": 0.5,
        "cd": 0.02,
        "curvatureRatio": 0.4,
        "provenance": provenance.model_dump(by_alias=True),
        "replicateCount": 1,
        "replicateProvenance": [provenance.model_dump(by_alias=True)],
    }
    with pytest.raises(ValidationError, match="coordinatesX"):
        WingRecord.model_validate(data)
