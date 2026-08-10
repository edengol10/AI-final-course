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
    aoa = (
        "unknown AoA"
        if spec.angle_of_attack_deg is None
        else f"AoA {spec.angle_of_attack_deg:g}°"
    )
    window = spec.cfd_averaging_window or "unknown CFD window"
    label = f"NACA 2412 · {aoa} · {window.upper()}"
    if isolated:
        label = f"{label} · isolated {run.run_id}"
    known_or_unknown = lambda value: value if value is not None else "unknown"  # noqa: E731
    description = (
        f"baseline={spec.baseline}; aoa={known_or_unknown(spec.angle_of_attack_deg)}; "
        f"cfd={known_or_unknown(spec.cfd_averaging_window)}; "
        f"spod={known_or_unknown(spec.spod_settings)}; "
        f"solver={known_or_unknown(spec.solver_revision)}"
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
        spec.angle_of_attack_deg,
        spec.cfd_averaging_window,
        spec.spod_settings,
        spec.solver_revision,
    )
