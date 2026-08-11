from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import yaml

from .models import (
    CompatibilitySpec,
    PublicCompatibilityGroup,
    RegistryRunV1,
    RunRegistryV1,
    public_model_dict,
)


def load_registry(path: Path) -> RunRegistryV1:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("registry root must be a mapping")
    return RunRegistryV1.model_validate(raw)


def compatibility_group_id(run: RegistryRunV1) -> str:
    payload: dict[str, Any] = public_model_dict(run.compatibility)
    if run.compatibility.has_unknowns:
        payload["isolatedRunId"] = run.run_id
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return f"cg-{hashlib.sha256(canonical).hexdigest()[:16]}"


def _format_condition_value(value: object, *, group_thousands: bool = False) -> str:
    if value is None:
        return "unknown"
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        return format(value, ",g" if group_thousands else "g")
    return str(value)


def public_compatibility_group(run: RegistryRunV1) -> PublicCompatibilityGroup:
    spec = run.compatibility
    isolated = spec.has_unknowns
    label = (
        f"{_format_condition_value(spec.baseline)} · "
        f"Re {_format_condition_value(spec.reynolds_number, group_thousands=True)} · "
        f"Grid {_format_condition_value(spec.grid_nx)}×{_format_condition_value(spec.grid_ny)} · "
        f"AoA {_format_condition_value(spec.angle_of_attack_deg)}° · "
        f"Averaging {_format_condition_value(spec.averaging_start_tu)}–"
        f"{_format_condition_value(spec.averaging_end_tu)} TU"
    )
    if isolated:
        label = f"{label} · isolated {run.run_id}"
    description = (
        f"baseline={_format_condition_value(spec.baseline)}; "
        f"reynoldsNumber={_format_condition_value(spec.reynolds_number)}; "
        f"chordLatticeUnits={_format_condition_value(spec.chord_lattice_units)}; "
        f"gridNx={_format_condition_value(spec.grid_nx)}; "
        f"gridNy={_format_condition_value(spec.grid_ny)}; "
        f"angleOfAttackDeg={_format_condition_value(spec.angle_of_attack_deg)}; "
        f"averagingStartTu={_format_condition_value(spec.averaging_start_tu)}; "
        f"averagingEndTu={_format_condition_value(spec.averaging_end_tu)}; "
        f"maximumInletVelocity={_format_condition_value(spec.maximum_inlet_velocity)}; "
        f"collisionModel={_format_condition_value(spec.collision_model)}; "
        f"immersedBoundaryScheme={_format_condition_value(spec.immersed_boundary_scheme)}"
    )
    return PublicCompatibilityGroup(
        id=compatibility_group_id(run),
        label=label,
        description=description,
        isolated=isolated,
        **public_model_dict(spec),
    )


def compatibility_signature(spec: CompatibilitySpec) -> tuple[object, ...]:
    return (
        spec.baseline,
        spec.reynolds_number,
        spec.chord_lattice_units,
        spec.grid_nx,
        spec.grid_ny,
        spec.angle_of_attack_deg,
        spec.averaging_start_tu,
        spec.averaging_end_tu,
        spec.maximum_inlet_velocity,
        spec.collision_model,
        spec.immersed_boundary_scheme,
    )
