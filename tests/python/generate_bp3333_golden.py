"""Regenerate the BP3333 coordinate oracle from the read-only thesis implementation."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

PARAMETER_ORDER = (
    "r_le",
    "x_c",
    "y_c",
    "k_c",
    "y_t",
    "x_t",
    "beta_te",
    "k_t",
    "gamma_le",
    "alpha_te",
)
BASELINE = {
    "r_le": -0.016146018916033678,
    "x_c": 0.42463735413258963,
    "y_c": 0.02038049164704984,
    "k_c": -0.21172827316723572,
    "y_t": 0.06012113069431794,
    "x_t": 0.2989015826574153,
    "beta_te": 0.1373828669255089,
    "k_t": -0.514126765787434,
    "gamma_le": 0.0725896568547561,
    "alpha_te": 0.4022178081503657,
}


def _source_head(source: Path) -> str:
    environment = dict(os.environ)
    environment["GIT_OPTIONAL_LOCKS"] = "0"
    result = subprocess.run(
        ["git", "-C", str(source), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
        env=environment,
    )
    return result.stdout.strip()


def _coordinates(
    bp3333_module: object, parameters: dict[str, float]
) -> tuple[list[float], list[float]]:
    wing = bp3333_module.BP3333Wing(  # type: ignore[attr-defined]
        r_le=parameters["r_le"],
        x_t=parameters["x_t"],
        y_t=parameters["y_t"],
        x_c=parameters["x_c"],
        y_c=parameters["y_c"],
        k_t=parameters["k_t"],
        k_c=parameters["k_c"],
        beta_te=parameters["beta_te"],
        gamma_le=parameters["gamma_le"],
        alpha_te=parameters["alpha_te"],
        num_points=129,
        device="cpu",
    )
    bp3333_module.build_wing(wing)  # type: ignore[attr-defined]
    return [float(value) for value in wing.x], [float(value) for value in wing.y]


def _case(bp3333_module: object, name: str, parameters: dict[str, float]) -> dict[str, object]:
    x, y = _coordinates(bp3333_module, parameters)
    packed = struct.pack(f"<{len(x) + len(y)}f", *x, *y)
    return {
        "name": name,
        "parameters": [parameters[key] for key in PARAMETER_ORDER],
        "x": x,
        "y": y,
        "coordinateSha256": hashlib.sha256(packed).hexdigest(),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    sys.path.insert(0, str(args.source))
    from geometry import bp3333

    probe = dict(BASELINE)
    probe.update({"r_le": -0.04, "x_c": 0.6, "y_t": 0.1, "x_t": 0.38})
    payload = {
        "schemaVersion": "bp3333-golden-coordinates-v1",
        "metadata": {
            "sourceHead": _source_head(args.source),
            "sourceImplementation": "geometry/bp3333.py",
            "parameterOrder": list(PARAMETER_ORDER),
            "numPoints": 129,
            "coordinateCount": 253,
            "outputDtype": "float32",
            "angleOfAttackDeg": 0,
            "coordinateOrder": "trailing-edge/lower/leading-edge/upper/trailing-edge",
            "generationCommand": (
                "PYTHONDONTWRITEBYTECODE=1 <source-venv-python> -B "
                "tests/python/generate_bp3333_golden.py --source <read-only-source> "
                "--output tests/fixtures/bp3333_golden_coordinates_v1.json"
            ),
        },
        "cases": [
            _case(bp3333, "naca2412-baseline-129", dict(BASELINE)),
            _case(bp3333, "naca2412-four-parameter-probe-129", probe),
        ],
    }
    data = json.dumps(payload, allow_nan=False, separators=(",", ":"), sort_keys=True).encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=".bp3333-golden.", dir=args.output.parent, delete=False
        ) as handle:
            temporary = Path(handle.name)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, args.output)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
