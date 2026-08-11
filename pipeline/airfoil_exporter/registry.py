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


def public_compatibility_group(run: RegistryRunV1) -> PublicCompatibilityGroup:
    spec = run.compatibility
    isolated = spec.has_unknowns
    known_or_unknown = lambda value: value if value is not None else "unknown"  # noqa: E731
    label = (
        f"{known_or_unknown(spec.baseline)} · "
        f"Re {known_or_unknown(spec.reynolds_number)} · "
        f"Grid {known_or_unknown(spec.grid_nx)}×{known_or_unknown(spec.grid_ny)} · "
        f"AoA {known_or_unknown(spec.angle_of_attack_deg)}° · "
        f"Averaging {known_or_unknown(spec.averaging_start_tu)}–"
        f"{known_or_unknown(spec.averaging_end_tu)} TU"
    )
    if isolated:
        label = f"{label} · isolated {run.run_id}"
    description = (
        f"baseline={known_or_unknown(spec.baseline)}; "
        f"reynoldsNumber={known_or_unknown(spec.reynolds_number)}; "
        f"chordLatticeUnits={known_or_unknown(spec.chord_lattice_units)}; "
        f"gridNx={known_or_unknown(spec.grid_nx)}; "
        f"gridNy={known_or_unknown(spec.grid_ny)}; "
        f"angleOfAttackDeg={known_or_unknown(spec.angle_of_attack_deg)}; "
        f"averagingStartTu={known_or_unknown(spec.averaging_start_tu)}; "
        f"averagingEndTu={known_or_unknown(spec.averaging_end_tu)}; "
        f"maximumInletVelocity={known_or_unknown(spec.maximum_inlet_velocity)}; "
        f"collisionModel={known_or_unknown(spec.collision_model)}; "
        f"immersedBoundaryScheme={known_or_unknown(spec.immersed_boundary_scheme)}"
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
