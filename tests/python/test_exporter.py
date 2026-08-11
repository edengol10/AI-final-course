from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

import pytest
from airfoil_exporter.audit import audit_candidates
from airfoil_exporter.constants import MAX_PUBLIC_FILE_BYTES
from airfoil_exporter.exporter import (
    _replace_validated_directory,
    export_snapshot,
    validate_snapshot,
)
from airfoil_exporter.registry import load_registry
from airfoil_exporter.serialization import canonical_json_bytes, scan_public_bytes, verify_public_file_bytes
from airfoil_exporter.source import FixtureHistorySource, SourceRun

ROOT = Path(__file__).resolve().parents[2]
GENERATED_AT = datetime(2026, 8, 10, tzinfo=UTC)


def _export(
    output: Path,
    *,
    target_shard_bytes: int = 9 * 1024 * 1024,
):
    return export_snapshot(
        registry=load_registry(ROOT / "config/wandb-runs.yaml"),
        source=FixtureHistorySource(ROOT / "tests/fixtures/wandb_history_v1.json"),
        output_dir=output,
        generated_at=GENERATED_AT,
        snapshot_kind="synthetic-fixture",
        target_shard_bytes=target_shard_bytes,
    )


def _tree_bytes(root: Path) -> dict[str, bytes]:
    return {
        str(path.relative_to(root)): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def test_fixture_export_is_deterministic_valid_and_accounted(tmp_path: Path) -> None:
    first = _export(tmp_path / "one")
    _export(tmp_path / "two")
    assert _tree_bytes(tmp_path / "one") == _tree_bytes(tmp_path / "two")
    manifest = validate_snapshot(first.manifest_path)
    public_manifest = json.loads(first.manifest_path.read_bytes())
    assert manifest.snapshot_kind == "synthetic-fixture"
    assert public_manifest["snapshotKind"] == "synthetic-fixture"
    assert "source" not in public_manifest
    manifest_bytes = first.manifest_path.read_bytes()
    assert b"edenunu-technion-israel-institute-of-technology" not in manifest_bytes
    assert b"wing parameter test" not in manifest_bytes
    assert manifest.source_run_count == 5
    assert manifest.totals.admitted_sample_count == 8
    assert manifest.totals.unique_geometry_count == 7
    assert manifest.totals.rejected_item_count == 6
    assert manifest.rejection_counts == {
        "ACTION_OUT_OF_BOUNDS": 1,
        "CURVATURE_LIMIT": 1,
        "INVALID_GEOMETRY": 1,
        "MISSING_AERO": 1,
        "MISSING_VALIDITY": 1,
        "NONFINITE_ACTION": 1,
    }
    for path, data in _tree_bytes(tmp_path / "one").items():
        assert len(data) < MAX_PUBLIC_FILE_BYTES, path
        assert b"coordinatesX" not in data
        assert b"coordinatesY" not in data


def test_committed_public_snapshot_contains_only_declared_columns() -> None:
    root = ROOT / "public/data"
    manifest = validate_snapshot(root / "manifest.json")
    for descriptor in manifest.datasets:
        dataset = json.loads((root / descriptor.path).read_bytes())
        assert set(dataset["columns"]) == {
            "stableRecordIndex", "parameters", "cl", "cd", "curvatureRatio",
            "runId", "globalStep", "recordedAt", "replicateCount", "replicateProvenance",
        }


def test_export_preserves_replicate_provenance_and_newest_metrics(tmp_path: Path) -> None:
    result = _export(tmp_path / "snapshot")
    manifest = result.manifest
    descriptor = next(item for item in manifest.datasets if "fo7gm0ds" in item.label)
    dataset = json.loads((tmp_path / "snapshot" / descriptor.path).read_bytes())
    replicate_index = dataset["columns"]["replicateCount"].index(2)
    assert dataset["columns"]["globalStep"][replicate_index] == 12
    assert dataset["columns"]["cl"][replicate_index] == 0.55
    assert len(dataset["columns"]["replicateProvenance"][replicate_index]) == 2


def test_small_target_produces_deterministic_shards(tmp_path: Path) -> None:
    result = _export(tmp_path / "snapshot", target_shard_bytes=1500)
    split_groups = {
        descriptor.compatibility_group_id
        for descriptor in result.manifest.datasets
        if descriptor.shard_count > 1
    }
    assert split_groups
    validate_snapshot(result.manifest_path)


def test_finished_reviewed_run_with_empty_history_fails_closed(tmp_path: Path) -> None:
    class EmptySource:
        def read_run(self, run_id: str) -> SourceRun:
            return SourceRun(run_id=run_id, state="finished", rows=())

    output = tmp_path / "snapshot"
    output.mkdir()
    (output / "manifest.json").write_bytes(b"previous verified manifest")
    (output / "previous-shard.json").write_bytes(b"previous verified shard")
    previous = _tree_bytes(output)
    with pytest.raises(ValueError, match="returned no narrow history rows"):
        export_snapshot(
            registry=load_registry(ROOT / "config/wandb-runs.yaml"),
            source=EmptySource(),
            output_dir=output,
            generated_at=GENERATED_AT,
            snapshot_kind="reviewed-wandb",
        )
    assert _tree_bytes(output) == previous


def test_unknown_snapshot_kind_fails_before_creating_output(tmp_path: Path) -> None:
    output = tmp_path / "snapshot"
    with pytest.raises(ValueError, match="snapshot_kind"):
        export_snapshot(
            registry=load_registry(ROOT / "config/wandb-runs.yaml"),
            source=FixtureHistorySource(ROOT / "tests/fixtures/wandb_history_v1.json"),
            output_dir=output,
            generated_at=GENERATED_AT,
            snapshot_kind="private-source",
        )
    assert not output.exists()


def test_clean_directory_swap_removes_unreferenced_stale_files(tmp_path: Path) -> None:
    output = tmp_path / "snapshot"
    (output / "datasets").mkdir(parents=True)
    (output / "datasets/stale-fixture-shard.json").write_bytes(b"stale")
    (output / "unreferenced.txt").write_bytes(b"stale")
    result = _export(output)
    expected_files = {
        "manifest.json",
        *(descriptor.path for descriptor in result.manifest.datasets),
    }
    assert set(_tree_bytes(output)) == expected_files
    assert not any("stale" in path for path in _tree_bytes(output))


def test_directory_swap_failure_restores_previous_verified_tree(tmp_path: Path) -> None:
    output = tmp_path / "snapshot"
    staging = tmp_path / ".stage"
    output.mkdir()
    staging.mkdir()
    (output / "manifest.json").write_bytes(b"previous")
    (staging / "manifest.json").write_bytes(b"replacement")

    def fail_new_tree_replace(source: Path, destination: Path) -> None:
        if source == staging and destination == output:
            raise OSError("simulated directory swap failure")
        os.replace(source, destination)

    with pytest.raises(OSError, match="simulated directory swap failure"):
        _replace_validated_directory(staging, output, replace=fail_new_tree_replace)
    assert (output / "manifest.json").read_bytes() == b"previous"
    assert (staging / "manifest.json").read_bytes() == b"replacement"
    assert not (tmp_path / "previous-output").exists()


@pytest.mark.parametrize("interruption", [KeyboardInterrupt, SystemExit])
def test_directory_swap_restores_on_base_exception(
    tmp_path: Path, interruption: type[BaseException]
) -> None:
    output = tmp_path / "snapshot"
    staging = tmp_path / ".stage"
    output.mkdir()
    staging.mkdir()
    (output / "manifest.json").write_bytes(b"previous")
    (staging / "manifest.json").write_bytes(b"replacement")

    def interrupt_new_tree_replace(source: Path, destination: Path) -> None:
        if source == staging and destination == output:
            raise interruption()
        os.replace(source, destination)

    with pytest.raises(interruption):
        _replace_validated_directory(
            staging, output, replace=interrupt_new_tree_replace
        )
    assert (output / "manifest.json").read_bytes() == b"previous"
    assert (staging / "manifest.json").read_bytes() == b"replacement"
    assert not (tmp_path / "previous-output").exists()


def test_backup_cleanup_failure_is_not_reported_as_success(tmp_path: Path) -> None:
    output = tmp_path / "snapshot"
    staging = tmp_path / ".stage"
    output.mkdir()
    staging.mkdir()
    (output / "manifest.json").write_bytes(b"previous")
    (staging / "manifest.json").write_bytes(b"replacement")

    def fail_cleanup(_path: Path) -> None:
        raise OSError("simulated strict cleanup failure")

    with pytest.raises(OSError, match="strict cleanup failure"):
        _replace_validated_directory(staging, output, remove_tree=fail_cleanup)
    assert (output / "manifest.json").read_bytes() == b"replacement"
    assert (tmp_path / "previous-output/manifest.json").read_bytes() == b"previous"


def test_public_export_leaves_no_transient_tree_inside_public(tmp_path: Path) -> None:
    public = tmp_path / "repository/public"
    output = public / "data"
    _export(output)
    assert sorted(path.name for path in public.iterdir()) == ["data"]
    assert not list(public.glob(".*airfoil-publication-*"))


def test_validation_detects_dataset_tampering(tmp_path: Path) -> None:
    result = _export(tmp_path / "snapshot")
    dataset_path = tmp_path / "snapshot" / result.manifest.datasets[0].path
    dataset_path.write_bytes(dataset_path.read_bytes() + b" ")
    with pytest.raises(ValueError, match="byte size mismatch"):
        validate_snapshot(result.manifest_path)


@pytest.mark.parametrize(
    "payload",
    [
        b'{"apiKey":"not-publishable"}',
        b'{"path":"/Users/researcher/private"}',
        b'{"artifactName":"model.ckpt"}',
        b'{"url":"https://example.test/data?token=private"}',
    ],
)
def test_secret_and_path_scan_rejects_forbidden_output(payload: bytes) -> None:
    with pytest.raises(ValueError, match="forbidden"):
        scan_public_bytes(payload, label="test")


def test_public_file_limit_is_strictly_below_ten_mib() -> None:
    with pytest.raises(ValueError, match="smaller than 10 MiB"):
        verify_public_file_bytes(b"x" * MAX_PUBLIC_FILE_BYTES, label="oversized")


def test_fixture_candidate_audit_never_auto_adds() -> None:
    report = audit_candidates(
        registry=load_registry(ROOT / "config/wandb-runs.yaml"),
        source=FixtureHistorySource(ROOT / "tests/fixtures/wandb_history_v1.json"),
        generated_at=GENERATED_AT,
    )
    assert len(report["candidates"]) == 6
    assert all(candidate["autoAdded"] is False for candidate in report["candidates"])
    assert all(
        candidate["exclusionReason"] == "PENDING_FRESH_AUDIT"
        for candidate in report["candidates"]
    )
