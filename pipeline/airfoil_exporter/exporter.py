from __future__ import annotations

import json
import tempfile
from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .admission import (
    AdmittedSample,
    active_and_fixed_parameters,
    admit_row,
    count_reason,
    deduplicate_samples,
)
from .constants import (
    DEFAULT_TARGET_SHARD_BYTES,
    MAX_PUBLIC_FILE_BYTES,
    PARAMETER_BOUNDS,
    PARAMETER_ORDER,
)
from .models import (
    DatasetDescriptorV1,
    ParameterBound,
    RunRegistryV1,
    SnapshotManifestV1,
    SnapshotTotals,
    SourceDescriptor,
    WingColumnsV1,
    WingDatasetV1,
    WingRecord,
)
from .registry import compatibility_group_id, public_compatibility_group
from .serialization import (
    atomic_write,
    canonical_json_bytes,
    manifest_canonical_sha256,
    sha256_hex,
    verify_public_file_bytes,
)
from .source import HistorySource


@dataclass(frozen=True)
class ExportResult:
    manifest_path: Path
    manifest: SnapshotManifestV1


def _dataset(
    *,
    group: object,
    records: Sequence[WingRecord],
    active_parameters: tuple[str, ...],
    fixed_parameters: dict[str, float],
    admitted_count: int,
    unique_count: int,
    shard_index: int,
    shard_count: int,
) -> WingDatasetV1:
    return WingDatasetV1(
        compatibility_group=group,
        parameter_order=PARAMETER_ORDER,
        active_parameters=active_parameters,
        fixed_parameters=fixed_parameters,
        group_admitted_sample_count=admitted_count,
        group_unique_geometry_count=unique_count,
        shard_index=shard_index,
        shard_count=shard_count,
        columns=WingColumnsV1.from_records(list(records)),
    )


def _chunk_records(
    *,
    group: object,
    records: list[WingRecord],
    active_parameters: tuple[str, ...],
    fixed_parameters: dict[str, float],
    admitted_count: int,
    target_bytes: int,
) -> list[list[WingRecord]]:
    if not records:
        return [[]]
    chunks: list[list[WingRecord]] = []
    current: list[WingRecord] = []
    for record in records:
        candidate = [*current, record]
        probe = _dataset(
            group=group,
            records=candidate,
            active_parameters=active_parameters,
            fixed_parameters=fixed_parameters,
            admitted_count=admitted_count,
            unique_count=len(records),
            shard_index=0,
            shard_count=1,
        )
        if current and len(canonical_json_bytes(probe)) > target_bytes:
            chunks.append(current)
            current = [record]
        else:
            current = candidate
    chunks.append(current)
    return chunks


def export_snapshot(
    *,
    registry: RunRegistryV1,
    source: HistorySource,
    output_dir: Path,
    generated_at: datetime,
    target_shard_bytes: int = DEFAULT_TARGET_SHARD_BYTES,
) -> ExportResult:
    if target_shard_bytes <= 0 or target_shard_bytes >= MAX_PUBLIC_FILE_BYTES:
        raise ValueError("target_shard_bytes must be positive and smaller than 10 MiB")
    samples_by_group: dict[str, list[AdmittedSample]] = defaultdict(list)
    admitted_by_group: Counter[str] = Counter()
    rejection_counts: Counter[str] = Counter()
    contributing_runs: set[str] = set()
    run_by_group = {}

    for registry_run in registry.reviewed_runs:
        source_run = source.read_run(registry_run.run_id)
        if source_run.state.strip().lower() != "finished" and not source_run.rows:
            rejection_counts["RUN_NOT_FINISHED"] += 1
            continue
        if not source_run.rows:
            raise ValueError(
                f"reviewed finished run {registry_run.run_id} returned no narrow history rows"
            )
        group_id = compatibility_group_id(registry_run)
        run_by_group.setdefault(group_id, registry_run)
        run_admitted = False
        for row in source_run.rows:
            decision = admit_row(row, run=registry_run, run_state=source_run.state)
            if decision.sample is None:
                count_reason(rejection_counts, decision.reason)
                continue
            samples_by_group[group_id].append(decision.sample)
            admitted_by_group[group_id] += 1
            run_admitted = True
        if run_admitted:
            contributing_runs.add(registry_run.run_id)
        else:
            raise ValueError(
                f"reviewed run {registry_run.run_id} produced no scientifically admitted rows"
            )

    if not contributing_runs:
        raise ValueError("no reviewed run contributed an admitted sample")

    dataset_payloads: list[tuple[DatasetDescriptorV1, bytes]] = []
    total_unique = 0
    for group_id in sorted(samples_by_group):
        samples = samples_by_group[group_id]
        records = deduplicate_samples(samples)
        total_unique += len(records)
        active, fixed = active_and_fixed_parameters(records)
        public_group = public_compatibility_group(run_by_group[group_id])
        chunks = _chunk_records(
            group=public_group,
            records=records,
            active_parameters=active,
            fixed_parameters=fixed,
            admitted_count=admitted_by_group[group_id],
            target_bytes=target_shard_bytes,
        )
        for shard_index, chunk in enumerate(chunks):
            dataset = _dataset(
                group=public_group,
                records=chunk,
                active_parameters=active,
                fixed_parameters=fixed,
                admitted_count=admitted_by_group[group_id],
                unique_count=len(records),
                shard_index=shard_index,
                shard_count=len(chunks),
            )
            data = canonical_json_bytes(dataset)
            verify_public_file_bytes(data, label=f"dataset {group_id} shard {shard_index}")
            digest = sha256_hex(data)
            relative_path = f"datasets/{group_id}.{shard_index:03d}.{digest[:16]}.json"
            descriptor = DatasetDescriptorV1(
                compatibility_group_id=group_id,
                label=public_group.label,
                description=public_group.description,
                path=relative_path,
                sha256=digest,
                byte_size=len(data),
                shard_index=shard_index,
                shard_count=len(chunks),
                record_count=len(chunk),
                group_admitted_sample_count=admitted_by_group[group_id],
                group_unique_geometry_count=len(records),
                active_parameters=active,
                fixed_parameters=fixed,
            )
            dataset_payloads.append((descriptor, data))

    bounds = {
        name: ParameterBound(minimum=minimum, maximum=maximum)
        for name, (minimum, maximum) in PARAMETER_BOUNDS.items()
    }
    manifest = SnapshotManifestV1(
        generated_at=generated_at,
        canonical_sha256="0" * 64,
        source=SourceDescriptor(entity=registry.entity, project=registry.project),
        source_run_count=len(contributing_runs),
        parameter_order=PARAMETER_ORDER,
        parameter_bounds=bounds,
        datasets=[descriptor for descriptor, _ in dataset_payloads],
        totals=SnapshotTotals(
            admitted_sample_count=sum(admitted_by_group.values()),
            unique_geometry_count=total_unique,
            rejected_item_count=sum(rejection_counts.values()),
        ),
        rejection_counts=dict(sorted(rejection_counts.items())),
    )
    manifest = manifest.model_copy(
        update={"canonical_sha256": manifest_canonical_sha256(manifest)}
    )
    manifest_data = canonical_json_bytes(manifest)
    verify_public_file_bytes(manifest_data, label="manifest")

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=".airfoil-snapshot-stage-", dir=output_dir.parent
    ) as staging_name:
        staging_dir = Path(staging_name)
        for descriptor, data in dataset_payloads:
            atomic_write(staging_dir / descriptor.path, data)
        atomic_write(staging_dir / "manifest.json", manifest_data)
        validate_snapshot(staging_dir / "manifest.json")
        for descriptor, data in dataset_payloads:
            atomic_write(output_dir / descriptor.path, data)
        # Publication boundary: the verified manifest is always written last.
        atomic_write(output_dir / "manifest.json", manifest_data)
    return ExportResult(manifest_path=output_dir / "manifest.json", manifest=manifest)


def validate_snapshot(manifest_path: Path) -> SnapshotManifestV1:
    manifest_bytes = manifest_path.read_bytes()
    verify_public_file_bytes(manifest_bytes, label="manifest")
    raw_manifest = json.loads(manifest_bytes)
    manifest = SnapshotManifestV1.model_validate(raw_manifest)
    if canonical_json_bytes(manifest) != manifest_bytes:
        raise ValueError("manifest is not canonical JSON")
    if manifest.canonical_sha256 != manifest_canonical_sha256(manifest):
        raise ValueError("manifest canonical SHA-256 mismatch")

    total_records = 0
    group_admitted: dict[str, int] = {}
    group_unique: dict[str, int] = {}
    group_indices: dict[str, list[int]] = defaultdict(list)
    group_parameters: dict[str, list[list[float]]] = defaultdict(list)
    group_replicates: Counter[str] = Counter()
    group_active: dict[str, tuple[str, ...]] = {}
    group_fixed: dict[str, dict[str, float]] = {}
    contributing_run_ids: set[str] = set()
    for descriptor in manifest.datasets:
        dataset_path = manifest_path.parent / descriptor.path
        data = dataset_path.read_bytes()
        verify_public_file_bytes(data, label=descriptor.path)
        if len(data) != descriptor.byte_size:
            raise ValueError(f"byte size mismatch for {descriptor.path}")
        if sha256_hex(data) != descriptor.sha256:
            raise ValueError(f"SHA-256 mismatch for {descriptor.path}")
        dataset = WingDatasetV1.model_validate(json.loads(data))
        if canonical_json_bytes(dataset) != data:
            raise ValueError(f"dataset is not canonical JSON: {descriptor.path}")
        if dataset.compatibility_group.id != descriptor.compatibility_group_id:
            raise ValueError(f"compatibility group mismatch for {descriptor.path}")
        if len(dataset.columns.stable_record_index) != descriptor.record_count:
            raise ValueError(f"record count mismatch for {descriptor.path}")
        if dataset.active_parameters != descriptor.active_parameters:
            raise ValueError(f"active parameter mismatch for {descriptor.path}")
        if dataset.fixed_parameters != descriptor.fixed_parameters:
            raise ValueError(f"fixed parameter mismatch for {descriptor.path}")
        if (
            dataset.shard_index != descriptor.shard_index
            or dataset.shard_count != descriptor.shard_count
        ):
            raise ValueError(f"shard metadata mismatch for {descriptor.path}")
        total_records += descriptor.record_count
        group_indices[descriptor.compatibility_group_id].extend(
            dataset.columns.stable_record_index
        )
        group_parameters[descriptor.compatibility_group_id].extend(dataset.columns.parameters)
        group_replicates[descriptor.compatibility_group_id] += sum(
            dataset.columns.replicate_count
        )
        for provenance_items in dataset.columns.replicate_provenance:
            contributing_run_ids.update(item.run_id for item in provenance_items)
        previous_active = group_active.setdefault(
            descriptor.compatibility_group_id, descriptor.active_parameters
        )
        previous_fixed = group_fixed.setdefault(
            descriptor.compatibility_group_id, descriptor.fixed_parameters
        )
        if (
            previous_active != descriptor.active_parameters
            or previous_fixed != descriptor.fixed_parameters
        ):
            raise ValueError("group parameter metadata differs across shards")
        previous = group_admitted.setdefault(
            descriptor.compatibility_group_id, descriptor.group_admitted_sample_count
        )
        if previous != descriptor.group_admitted_sample_count:
            raise ValueError("group admitted counts differ across shards")
        previous_unique = group_unique.setdefault(
            descriptor.compatibility_group_id, descriptor.group_unique_geometry_count
        )
        if previous_unique != descriptor.group_unique_geometry_count:
            raise ValueError("group unique counts differ across shards")
    if total_records != manifest.totals.unique_geometry_count:
        raise ValueError("manifest unique geometry count does not equal dataset records")
    if sum(group_admitted.values()) != manifest.totals.admitted_sample_count:
        raise ValueError("manifest admitted sample count does not equal group totals")
    for group_id, expected_count in group_unique.items():
        if sorted(group_indices[group_id]) != list(range(expected_count)):
            raise ValueError(f"stable record indices are not contiguous for {group_id}")
        if group_replicates[group_id] != group_admitted[group_id]:
            raise ValueError(f"replicate counts do not equal admitted samples for {group_id}")
        parameters = group_parameters[group_id]
        expected_active: list[str] = []
        expected_fixed: dict[str, float] = {}
        for position, name in enumerate(PARAMETER_ORDER):
            values = {vector[position] for vector in parameters}
            if len(values) > 1:
                expected_active.append(name)
            else:
                expected_fixed[name] = next(iter(values))
        if (
            tuple(expected_active) != group_active[group_id]
            or expected_fixed != group_fixed[group_id]
        ):
            raise ValueError(f"derived parameter metadata mismatch for {group_id}")
    if len(contributing_run_ids) != manifest.source_run_count:
        raise ValueError("sourceRunCount does not equal sanitized contributing provenance")
    return manifest
