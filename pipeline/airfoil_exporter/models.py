from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .constants import (
    PARAMETER_BOUNDS,
    PARAMETER_ORDER,
    SCHEMA_DATASET,
    SCHEMA_MANIFEST,
    SCHEMA_REGISTRY,
)

SnapshotKind = Literal["synthetic-fixture", "reviewed-wandb"]


def _to_camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part.capitalize() for part in tail)


class ContractModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        populate_by_name=True,
        ser_json_inf_nan="constants",
    )


def _finite(value: float, field_name: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed):
        raise ValueError(f"{field_name} must be finite")
    return parsed


class ParameterBound(ContractModel):
    minimum: float
    maximum: float

    @model_validator(mode="after")
    def validate_range(self) -> ParameterBound:
        self.minimum = _finite(self.minimum, "minimum")
        self.maximum = _finite(self.maximum, "maximum")
        if self.minimum >= self.maximum:
            raise ValueError("minimum must be less than maximum")
        return self


class CompatibilitySpec(ContractModel):
    baseline: str | None
    reynolds_number: float | None
    chord_lattice_units: int | None
    grid_nx: int | None
    grid_ny: int | None
    angle_of_attack_deg: float | None
    averaging_start_tu: float | None
    averaging_end_tu: float | None
    maximum_inlet_velocity: float | None
    collision_model: str | None
    immersed_boundary_scheme: str | None

    @field_validator("baseline", "collision_model", "immersed_boundary_scheme")
    @classmethod
    def normalize_identifier(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = "-".join(value.strip().lower().split())
        if not normalized:
            raise ValueError("compatibility identifiers cannot be blank")
        return normalized

    @field_validator(
        "reynolds_number",
        "angle_of_attack_deg",
        "averaging_start_tu",
        "averaging_end_tu",
        "maximum_inlet_velocity",
    )
    @classmethod
    def finite_float(cls, value: float | None) -> float | None:
        return None if value is None else _finite(value, "compatibility value")

    @field_validator("chord_lattice_units", "grid_nx", "grid_ny")
    @classmethod
    def positive_dimension(cls, value: int | None) -> int | None:
        if value is not None and value <= 0:
            raise ValueError("compatibility dimensions must be positive")
        return value

    @model_validator(mode="after")
    def validate_physical_conditions(self) -> CompatibilitySpec:
        if self.reynolds_number is not None and self.reynolds_number <= 0.0:
            raise ValueError("reynolds_number must be positive")
        if (
            self.maximum_inlet_velocity is not None
            and self.maximum_inlet_velocity <= 0.0
        ):
            raise ValueError("maximum_inlet_velocity must be positive")
        if (
            self.averaging_start_tu is not None
            and self.averaging_end_tu is not None
            and self.averaging_start_tu >= self.averaging_end_tu
        ):
            raise ValueError("averaging_start_tu must precede averaging_end_tu")
        return self

    @property
    def has_unknowns(self) -> bool:
        return any(
            value is None
            for value in (
                self.baseline,
                self.reynolds_number,
                self.chord_lattice_units,
                self.grid_nx,
                self.grid_ny,
                self.angle_of_attack_deg,
                self.averaging_start_tu,
                self.averaging_end_tu,
                self.maximum_inlet_velocity,
                self.collision_model,
                self.immersed_boundary_scheme,
            )
        )


class PublicCompatibilityGroup(CompatibilitySpec):
    id: str
    label: str
    description: str
    isolated: bool


class ProvenanceV1(ContractModel):
    run_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    global_step: int = Field(ge=0)
    recorded_at: datetime | None


class WingRecord(ContractModel):
    """Validated row-oriented record used before columnar serialization."""

    stable_record_index: int = Field(ge=0)
    parameters: tuple[float, ...]
    cl: float
    cd: float
    provenance: ProvenanceV1
    replicate_count: int = Field(ge=1)
    replicate_provenance: tuple[ProvenanceV1, ...]

    @field_validator("parameters")
    @classmethod
    def validate_parameters(cls, values: tuple[float, ...]) -> tuple[float, ...]:
        if len(values) != len(PARAMETER_ORDER):
            raise ValueError(f"parameters must contain {len(PARAMETER_ORDER)} values")
        parsed = tuple(_finite(value, "parameter") for value in values)
        for name, value in zip(PARAMETER_ORDER, parsed, strict=True):
            lower, upper = PARAMETER_BOUNDS[name]
            if value < lower or value > upper:
                raise ValueError(f"parameter {name} is outside its authoritative bound")
        return parsed

    @field_validator("cl", "cd")
    @classmethod
    def validate_aero(cls, value: float) -> float:
        return _finite(value, "aerodynamic metric")

    @model_validator(mode="after")
    def validate_record(self) -> WingRecord:
        if self.cl <= 0.0:
            raise ValueError("cl must be positive for the public lifting-wing dataset")
        if len(self.replicate_provenance) != self.replicate_count:
            raise ValueError("replicate_provenance must contain every admitted replicate")
        if self.provenance not in self.replicate_provenance:
            raise ValueError("representative provenance must be one admitted replicate")
        return self


class WingColumnsV1(ContractModel):
    stable_record_index: list[int]
    parameters: list[list[float]]
    cl: list[float]
    cd: list[float]
    run_id: list[str]
    global_step: list[int]
    recorded_at: list[datetime | None]
    replicate_count: list[int]
    replicate_provenance: list[list[ProvenanceV1]]

    @model_validator(mode="after")
    def validate_columns(self) -> WingColumnsV1:
        columns = self.model_dump(mode="python")
        lengths = {name: len(values) for name, values in columns.items()}
        if len(set(lengths.values())) != 1:
            raise ValueError(f"column lengths differ: {lengths}")
        for index in range(len(self.stable_record_index)):
            WingRecord(
                stable_record_index=self.stable_record_index[index],
                parameters=tuple(self.parameters[index]),
                cl=self.cl[index],
                cd=self.cd[index],
                provenance=ProvenanceV1(
                    run_id=self.run_id[index],
                    global_step=self.global_step[index],
                    recorded_at=self.recorded_at[index],
                ),
                replicate_count=self.replicate_count[index],
                replicate_provenance=tuple(self.replicate_provenance[index]),
            )
        return self

    @classmethod
    def from_records(cls, records: list[WingRecord]) -> WingColumnsV1:
        return cls(
            stable_record_index=[record.stable_record_index for record in records],
            parameters=[list(record.parameters) for record in records],
            cl=[record.cl for record in records],
            cd=[record.cd for record in records],
            run_id=[record.provenance.run_id for record in records],
            global_step=[record.provenance.global_step for record in records],
            recorded_at=[record.provenance.recorded_at for record in records],
            replicate_count=[record.replicate_count for record in records],
            replicate_provenance=[list(record.replicate_provenance) for record in records],
        )


class WingDatasetV1(ContractModel):
    schema_version: Literal[SCHEMA_DATASET] = SCHEMA_DATASET
    compatibility_group: PublicCompatibilityGroup
    parameter_order: tuple[str, ...]
    active_parameters: tuple[str, ...]
    fixed_parameters: dict[str, float]
    group_admitted_sample_count: int = Field(ge=0)
    group_unique_geometry_count: int = Field(ge=0)
    shard_index: int = Field(ge=0)
    shard_count: int = Field(ge=1)
    columns: WingColumnsV1

    @model_validator(mode="after")
    def validate_dataset(self) -> WingDatasetV1:
        if self.parameter_order != PARAMETER_ORDER:
            raise ValueError("parameter_order does not match the authoritative BP3333 order")
        if self.shard_index >= self.shard_count:
            raise ValueError("shard_index must be lower than shard_count")
        if self.group_admitted_sample_count < len(self.columns.stable_record_index):
            raise ValueError("group admitted count cannot be lower than this shard's records")
        if self.group_admitted_sample_count < self.group_unique_geometry_count:
            raise ValueError("admitted samples cannot be fewer than unique geometries")
        ordered_active = tuple(name for name in PARAMETER_ORDER if name in self.active_parameters)
        if ordered_active != self.active_parameters:
            raise ValueError("active_parameters must follow authoritative order")
        if set(self.active_parameters) | set(self.fixed_parameters) != set(PARAMETER_ORDER):
            raise ValueError("active and fixed parameters must partition the parameter order")
        if set(self.active_parameters) & set(self.fixed_parameters):
            raise ValueError("active and fixed parameters must not overlap")
        for name, value in self.fixed_parameters.items():
            parsed = _finite(value, "fixed parameter")
            lower, upper = PARAMETER_BOUNDS[name]
            if parsed < lower or parsed > upper:
                raise ValueError(f"fixed parameter {name} is outside its bound")
            position = PARAMETER_ORDER.index(name)
            if any(parameters[position] != parsed for parameters in self.columns.parameters):
                raise ValueError(f"fixed parameter {name} disagrees with record vectors")
        return self


class DatasetDescriptorV1(ContractModel):
    compatibility_group_id: str
    label: str
    description: str
    path: str = Field(pattern=r"^datasets/[a-z0-9._-]+\.json$")
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    byte_size: int = Field(gt=0, lt=10 * 1024 * 1024)
    shard_index: int = Field(ge=0)
    shard_count: int = Field(ge=1)
    record_count: int = Field(ge=0)
    group_admitted_sample_count: int = Field(ge=0)
    group_unique_geometry_count: int = Field(ge=0)
    active_parameters: tuple[str, ...]
    fixed_parameters: dict[str, float]


class SnapshotTotals(ContractModel):
    admitted_sample_count: int = Field(ge=0)
    unique_geometry_count: int = Field(ge=0)
    rejected_item_count: int = Field(ge=0)


class SnapshotManifestV1(ContractModel):
    schema_version: Literal[SCHEMA_MANIFEST] = SCHEMA_MANIFEST
    snapshot_kind: SnapshotKind
    generated_at: datetime
    canonical_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    source_run_count: int = Field(ge=0)
    parameter_order: tuple[str, ...]
    parameter_bounds: dict[str, ParameterBound]
    datasets: list[DatasetDescriptorV1]
    totals: SnapshotTotals
    rejection_counts: dict[str, int]

    @model_validator(mode="after")
    def validate_manifest(self) -> SnapshotManifestV1:
        if self.parameter_order != PARAMETER_ORDER:
            raise ValueError("parameter_order does not match the authoritative BP3333 order")
        if set(self.parameter_bounds) != set(PARAMETER_ORDER):
            raise ValueError("parameter_bounds must cover exactly the BP3333 parameters")
        for name, (expected_minimum, expected_maximum) in PARAMETER_BOUNDS.items():
            actual = self.parameter_bounds[name]
            if actual.minimum != expected_minimum or actual.maximum != expected_maximum:
                raise ValueError(f"parameter_bounds for {name} are not authoritative")
        if any(count < 0 for count in self.rejection_counts.values()):
            raise ValueError("rejection counts cannot be negative")
        if self.totals.rejected_item_count != sum(self.rejection_counts.values()):
            raise ValueError("rejected_item_count must equal rejection_counts total")
        paths = [dataset.path for dataset in self.datasets]
        if len(paths) != len(set(paths)):
            raise ValueError("dataset paths must be unique")
        return self


class RegistryRunV1(ContractModel):
    run_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    publication_status: Literal["reviewed", "candidate", "excluded"]
    action_schema: Literal["absolute-bp3333-v1"] | None
    compatibility: CompatibilitySpec
    exclusion_reason: str | None = None

    @model_validator(mode="after")
    def validate_registry_run(self) -> RegistryRunV1:
        if self.publication_status == "reviewed" and self.action_schema is None:
            raise ValueError("reviewed runs require a known action schema")
        if self.publication_status != "reviewed" and not self.exclusion_reason:
            raise ValueError("non-reviewed runs require a stable exclusion reason")
        return self


class RunRegistryV1(ContractModel):
    schema_version: Literal[SCHEMA_REGISTRY] = SCHEMA_REGISTRY
    entity: str
    project: str
    runs: list[RegistryRunV1]

    @model_validator(mode="after")
    def validate_registry(self) -> RunRegistryV1:
        ids = [run.run_id for run in self.runs]
        if len(ids) != len(set(ids)):
            raise ValueError("registry run IDs must be unique")
        return self

    @property
    def reviewed_runs(self) -> tuple[RegistryRunV1, ...]:
        return tuple(run for run in self.runs if run.publication_status == "reviewed")

    @property
    def candidate_runs(self) -> tuple[RegistryRunV1, ...]:
        return tuple(run for run in self.runs if run.publication_status == "candidate")


def public_model_dict(model: ContractModel, **kwargs: Any) -> dict[str, Any]:
    return model.model_dump(by_alias=True, mode="json", **kwargs)
