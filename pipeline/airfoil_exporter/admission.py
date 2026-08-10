from __future__ import annotations

import math
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from .constants import (
    ACTION_KEYS,
    AERO_CD_KEY,
    AERO_CL_KEY,
    BASELINE_PARAMETERS,
    CURVATURE_KEY,
    FREQUENCY_1_KEY,
    FREQUENCY_2_KEY,
    INVALID_GEOMETRY_KEY,
    PARAMETER_BOUNDS,
    PARAMETER_ORDER,
    TIMESTAMP_KEY,
)
from .geometry import float32_vector, float32_vector_bytes
from .models import ProvenanceV1, RegistryRunV1, WingRecord


@dataclass(frozen=True)
class AdmittedSample:
    parameters: tuple[float, ...]
    cl: float
    cd: float
    curvature_ratio: float
    spod_mode1_peak_freq_1: float | None
    spod_mode1_peak_freq_2: float | None
    provenance: ProvenanceV1


@dataclass(frozen=True)
class AdmissionDecision:
    sample: AdmittedSample | None
    reason: str | None

    @property
    def admitted(self) -> bool:
        return self.sample is not None


def _number(row: Mapping[str, Any], key: str) -> float | None:
    value = row.get(key)
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError, OverflowError):
        return math.nan


def sanitize_timestamp(value: Any) -> datetime | None:
    if value is None:
        return None
    parsed: datetime
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        number = float(value)
        if not math.isfinite(number):
            return None
        try:
            parsed = datetime.fromtimestamp(number, tz=UTC)
        except (OSError, OverflowError, ValueError):
            return None
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            try:
                number = float(text)
            except ValueError:
                return None
            return sanitize_timestamp(number)
    else:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _global_step(row: Mapping[str, Any]) -> int:
    value = row.get("_step", 0)
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError):
        return 0
    return max(0, parsed)


def admit_row(
    row: Mapping[str, Any],
    *,
    run: RegistryRunV1,
    run_state: str,
) -> AdmissionDecision:
    """Apply exactly one primary rejection reason in contract precedence."""

    if run_state.strip().lower() != "finished":
        return AdmissionDecision(None, "RUN_NOT_FINISHED")
    if run.publication_status != "reviewed":
        return AdmissionDecision(None, "RUN_NOT_APPROVED")
    if run.action_schema != "absolute-bp3333-v1":
        return AdmissionDecision(None, "UNKNOWN_ACTION_SCHEMA")

    reconstructed = dict(BASELINE_PARAMETERS)
    for parameter in PARAMETER_ORDER:
        key = ACTION_KEYS[parameter]
        if key not in row or row.get(key) is None:
            continue
        value = _number(row, key)
        if value is None or not math.isfinite(value):
            return AdmissionDecision(None, "NONFINITE_ACTION")
        lower, upper = PARAMETER_BOUNDS[parameter]
        if value < lower or value > upper:
            return AdmissionDecision(None, "ACTION_OUT_OF_BOUNDS")
        reconstructed[parameter] = value

    if row.get(AERO_CL_KEY) is None or row.get(AERO_CD_KEY) is None:
        return AdmissionDecision(None, "MISSING_AERO")
    cl = _number(row, AERO_CL_KEY)
    cd = _number(row, AERO_CD_KEY)
    if cl is None or cd is None or not math.isfinite(cl) or not math.isfinite(cd):
        return AdmissionDecision(None, "NONFINITE_AERO")

    if row.get(INVALID_GEOMETRY_KEY) is None:
        return AdmissionDecision(None, "MISSING_VALIDITY")
    invalid_geometry = _number(row, INVALID_GEOMETRY_KEY)
    if invalid_geometry is None or not math.isfinite(invalid_geometry) or invalid_geometry != 0.0:
        return AdmissionDecision(None, "INVALID_GEOMETRY")

    if row.get(CURVATURE_KEY) is None:
        return AdmissionDecision(None, "MISSING_CURVATURE")
    curvature = _number(row, CURVATURE_KEY)
    if curvature is None or not math.isfinite(curvature) or curvature >= 1.0:
        return AdmissionDecision(None, "CURVATURE_LIMIT")

    frequency_1: float | None = None
    frequency_2: float | None = None
    if run.frequencies_required:
        if row.get(FREQUENCY_1_KEY) is None or row.get(FREQUENCY_2_KEY) is None:
            return AdmissionDecision(None, "MISSING_FREQUENCY")
        frequency_1 = _number(row, FREQUENCY_1_KEY)
        frequency_2 = _number(row, FREQUENCY_2_KEY)
        if (
            frequency_1 is None
            or frequency_2 is None
            or not math.isfinite(frequency_1)
            or not math.isfinite(frequency_2)
            or frequency_1 <= 0.0
            or frequency_2 <= 0.0
        ):
            return AdmissionDecision(None, "NONPOSITIVE_FREQUENCY")
    elif row.get(FREQUENCY_1_KEY) is not None and row.get(FREQUENCY_2_KEY) is not None:
        possible_1 = _number(row, FREQUENCY_1_KEY)
        possible_2 = _number(row, FREQUENCY_2_KEY)
        if (
            possible_1 is not None
            and possible_2 is not None
            and math.isfinite(possible_1)
            and math.isfinite(possible_2)
            and possible_1 > 0.0
            and possible_2 > 0.0
        ):
            frequency_1 = possible_1
            frequency_2 = possible_2

    vector = float32_vector(tuple(reconstructed[name] for name in PARAMETER_ORDER))
    provenance = ProvenanceV1(
        run_id=run.run_id,
        global_step=_global_step(row),
        recorded_at=sanitize_timestamp(row.get(TIMESTAMP_KEY)),
    )
    return AdmissionDecision(
        AdmittedSample(
            parameters=vector,
            cl=cl,
            cd=cd,
            curvature_ratio=curvature,
            spod_mode1_peak_freq_1=frequency_1,
            spod_mode1_peak_freq_2=frequency_2,
            provenance=provenance,
        ),
        None,
    )


def _representative_key(sample: AdmittedSample) -> tuple[datetime, int, str]:
    timestamp = sample.provenance.recorded_at or datetime.min.replace(tzinfo=UTC)
    return timestamp, sample.provenance.global_step, sample.provenance.run_id


def deduplicate_samples(samples: Sequence[AdmittedSample]) -> list[WingRecord]:
    grouped: dict[bytes, list[AdmittedSample]] = defaultdict(list)
    for sample in samples:
        grouped[float32_vector_bytes(sample.parameters)].append(sample)
    representatives: list[tuple[tuple[float, ...], AdmittedSample, tuple[ProvenanceV1, ...]]] = []
    for replicates in grouped.values():
        representative = max(replicates, key=_representative_key)
        provenance = tuple(
            sample.provenance for sample in sorted(replicates, key=_representative_key)
        )
        representatives.append((representative.parameters, representative, provenance))
    representatives.sort(key=lambda item: item[0])
    records: list[WingRecord] = []
    for index, (_, sample, provenance) in enumerate(representatives):
        records.append(
            WingRecord(
                stable_record_index=index,
                parameters=sample.parameters,
                cl=sample.cl,
                cd=sample.cd,
                curvature_ratio=sample.curvature_ratio,
                spod_mode1_peak_freq_1=sample.spod_mode1_peak_freq_1,
                spod_mode1_peak_freq_2=sample.spod_mode1_peak_freq_2,
                provenance=sample.provenance,
                replicate_count=len(provenance),
                replicate_provenance=provenance,
            )
        )
    return records


def active_and_fixed_parameters(
    records: Sequence[WingRecord],
) -> tuple[tuple[str, ...], dict[str, float]]:
    active: list[str] = []
    fixed: dict[str, float] = {}
    for position, name in enumerate(PARAMETER_ORDER):
        values = {record.parameters[position] for record in records}
        if len(values) > 1:
            active.append(name)
        elif values:
            fixed[name] = next(iter(values))
        else:
            fixed[name] = float32_vector((BASELINE_PARAMETERS[name],))[0]
    return tuple(active), fixed


def normalized_distance(
    query: Mapping[str, float],
    parameters: Sequence[float],
    active_parameters: Sequence[str],
) -> float:
    parameter_positions = {name: index for index, name in enumerate(PARAMETER_ORDER)}
    distance_squared = 0.0
    for name in active_parameters:
        lower, upper = PARAMETER_BOUNDS[name]
        query_value = float(query[name])
        candidate_value = float(parameters[parameter_positions[name]])
        distance_squared += ((query_value - candidate_value) / (upper - lower)) ** 2
    return math.sqrt(distance_squared)


def nearest_record(
    query: Mapping[str, float],
    records: Sequence[WingRecord],
    active_parameters: Sequence[str],
) -> WingRecord:
    if not records:
        raise ValueError("cannot select a nearest record from an empty dataset")
    return min(
        records,
        key=lambda record: (
            normalized_distance(query, record.parameters, active_parameters),
            record.stable_record_index,
        ),
    )


def count_reason(counter: Counter[str], reason: str | None) -> None:
    if reason is not None:
        counter[reason] += 1
