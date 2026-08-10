from __future__ import annotations

import hashlib
import json
import struct
from pathlib import Path

import pytest
from airfoil_exporter.constants import PARAMETER_ORDER
from airfoil_exporter.geometry import build_bp3333_coordinates

ROOT = Path(__file__).resolve().parents[2]


def test_bp3333_port_matches_read_only_float32_golden_coordinates() -> None:
    fixture = json.loads(
        (ROOT / "tests/fixtures/bp3333_golden_coordinates_v1.json").read_text(encoding="utf-8")
    )
    metadata = fixture["metadata"]
    assert metadata["sourceHead"] == "4936dea753e11e54f25532820a7ac576f7f84401"
    assert metadata["sourceImplementation"] == "geometry/bp3333.py"
    assert metadata["parameterOrder"] == list(PARAMETER_ORDER)
    assert metadata["numPoints"] == 129
    assert metadata["coordinateCount"] == 253
    assert metadata["outputDtype"] == "float32"
    for case in fixture["cases"]:
        expected_x = case["x"]
        expected_y = case["y"]
        packed = struct.pack(
            f"<{len(expected_x) + len(expected_y)}f", *expected_x, *expected_y
        )
        assert hashlib.sha256(packed).hexdigest() == case["coordinateSha256"]
        actual_x, actual_y = build_bp3333_coordinates(case["parameters"], num_points=129)
        assert len(actual_x) == len(actual_y) == 253
        assert actual_x == pytest.approx(expected_x, abs=1.0e-6, rel=0.0)
        assert actual_y == pytest.approx(expected_y, abs=1.0e-6, rel=0.0)
