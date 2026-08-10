from __future__ import annotations

import json
from pathlib import Path

from airfoil_exporter import cli
from airfoil_exporter.registry import load_registry
from airfoil_exporter.source import FixtureHistorySource

ROOT = Path(__file__).resolve().parents[2]


def test_cli_passes_explicit_snapshot_kind_for_fixture_and_live(
    tmp_path: Path, monkeypatch
) -> None:
    registry_path = ROOT / "config/wandb-runs.yaml"
    fixture_path = ROOT / "tests/fixtures/wandb_history_v1.json"
    fixture_output = tmp_path / "fixture"
    assert (
        cli.main(
            [
                "fixture",
                "--registry",
                str(registry_path),
                "--fixture",
                str(fixture_path),
                "--output",
                str(fixture_output),
                "--generated-at",
                "2026-08-10T00:00:00Z",
            ]
        )
        == 0
    )
    fixture_manifest = json.loads((fixture_output / "manifest.json").read_bytes())
    assert fixture_manifest["snapshotKind"] == "synthetic-fixture"
    assert fixture_manifest["modalDataIncluded"] is True

    public_fixture_output = tmp_path / "public-fixture"
    assert (
        cli.main(
            [
                "fixture",
                "--registry",
                str(registry_path),
                "--fixture",
                str(fixture_path),
                "--output",
                str(public_fixture_output),
                "--generated-at",
                "2026-08-10T00:00:00Z",
                "--exclude-modal-data",
            ]
        )
        == 0
    )
    public_fixture_manifest = json.loads(
        (public_fixture_output / "manifest.json").read_bytes()
    )
    assert public_fixture_manifest["modalDataIncluded"] is False

    registry = load_registry(registry_path)
    source = FixtureHistorySource(fixture_path)
    include_modal_data_calls: list[bool] = []

    def fake_live_source(_path: Path, *, include_modal_data: bool = True):
        include_modal_data_calls.append(include_modal_data)
        return registry, source

    monkeypatch.setattr(cli, "_live_source", fake_live_source)
    live_output = tmp_path / "live"
    assert (
        cli.main(
            [
                "live",
                "--registry",
                str(registry_path),
                "--output",
                str(live_output),
                "--generated-at",
                "2026-08-10T00:00:00Z",
                "--exclude-modal-data",
            ]
        )
        == 0
    )
    live_manifest = json.loads((live_output / "manifest.json").read_bytes())
    assert live_manifest["snapshotKind"] == "reviewed-wandb"
    assert live_manifest["modalDataIncluded"] is False
    assert include_modal_data_calls == [False]
