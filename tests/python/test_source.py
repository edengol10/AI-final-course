from __future__ import annotations

import sys
from types import SimpleNamespace

from airfoil_exporter.constants import ALLOWED_HISTORY_KEYS
from airfoil_exporter.source import WandbHistorySource


class _FakeRun:
    state = "finished"

    def __init__(self) -> None:
        self.calls: list[str] = []

    def history(self, *, keys: list[str], samples: int, pandas: bool):
        assert len(keys) == 1
        assert samples >= 10_000
        assert pandas is False
        key = keys[0]
        self.calls.append(key)
        values = {
            "_timestamp": [
                {"_step": 4, "_timestamp": "2026-01-01T00:00:04Z"},
                {"_step": 7, "_timestamp": "2026-01-01T00:00:07Z"},
            ],
            "action/x_c": [{"_step": 4, "action/x_c": 0.4}],
            "aero/step_avg_Cl": [
                {"_step": 4, "aero/step_avg_Cl": 0.5},
                {"_step": 7, "aero/step_avg_Cl": 0.6},
            ],
            "aero/step_avg_Cd": [
                {"_step": 4, "aero/step_avg_Cd": 0.02},
                {"_step": 7, "aero/step_avg_Cd": 0.03},
            ],
            "geometry/step_curvature_ratio": [
                {"_step": 4, "geometry/step_curvature_ratio": 0.4},
                {"_step": 7, "geometry/step_curvature_ratio": 0.5},
            ],
            "status/invalid_geometry": [
                {"_step": 4, "status/invalid_geometry": 0},
                {"_step": 7, "status/invalid_geometry": 0},
            ],
        }
        return values.get(key, [])


def test_wandb_source_joins_declared_fields_by_step(monkeypatch) -> None:
    run = _FakeRun()
    fake_wandb = SimpleNamespace(Api=lambda **_kwargs: SimpleNamespace(run=lambda _path: run))
    monkeypatch.setitem(sys.modules, "wandb", fake_wandb)

    source = WandbHistorySource(entity="entity", project="project")
    result = source.read_run("run-id")

    assert result.state == "finished"
    assert [row["_step"] for row in result.rows] == [4, 7]
    assert result.rows[0]["action/x_c"] == 0.4
    assert "action/x_c" not in result.rows[1]
    assert result.rows[1]["aero/step_avg_Cl"] == 0.6
    assert set(run.calls) == set(ALLOWED_HISTORY_KEYS) - {"_step"}
