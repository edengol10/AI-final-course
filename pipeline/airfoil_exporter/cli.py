from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from .audit import audit_candidates
from .exporter import export_snapshot, validate_snapshot
from .registry import load_registry
from .serialization import atomic_write, canonical_json_bytes
from .source import FixtureHistorySource, WandbHistorySource


def _timestamp(value: str | None) -> datetime:
    if value is None:
        return datetime.now(tz=UTC).replace(microsecond=0)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC).replace(microsecond=0)


def _live_source(registry_path: Path) -> tuple[object, object]:
    registry = load_registry(registry_path)
    entity = os.environ.get("WANDB_ENTITY", registry.entity)
    project = os.environ.get("WANDB_PROJECT", registry.project)
    if entity != registry.entity or project != registry.project:
        raise ValueError("WANDB_ENTITY/WANDB_PROJECT must exactly match the reviewed registry")
    return registry, WandbHistorySource(entity=entity, project=project)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export validated Airfoil Explorer snapshots")
    subparsers = parser.add_subparsers(dest="command", required=True)

    fixture = subparsers.add_parser("fixture", help="export from a checked-in narrow fixture")
    fixture.add_argument("--registry", type=Path, required=True)
    fixture.add_argument("--fixture", type=Path, required=True)
    fixture.add_argument("--output", type=Path, required=True)
    fixture.add_argument("--generated-at", required=True)
    fixture.add_argument("--target-shard-bytes", type=int, default=9 * 1024 * 1024)

    live = subparsers.add_parser("live", help="export reviewed runs using existing W&B auth")
    live.add_argument("--registry", type=Path, required=True)
    live.add_argument("--output", type=Path, required=True)
    live.add_argument("--generated-at")
    live.add_argument("--target-shard-bytes", type=int, default=9 * 1024 * 1024)

    validate = subparsers.add_parser("validate", help="validate a static snapshot offline")
    validate.add_argument("--manifest", type=Path, required=True)

    audit = subparsers.add_parser("audit", help="audit candidates without allowlisting them")
    audit.add_argument("--registry", type=Path, required=True)
    audit.add_argument("--fixture", type=Path)
    audit.add_argument("--output", type=Path, required=True)
    audit.add_argument("--generated-at")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    try:
        if args.command == "validate":
            manifest = validate_snapshot(args.manifest)
            print(
                f"validated {args.manifest}: "
                f"{manifest.totals.unique_geometry_count} unique geometries"
            )
            return 0
        if args.command == "fixture":
            registry = load_registry(args.registry)
            source = FixtureHistorySource(args.fixture)
            generated_at = _timestamp(args.generated_at)
        elif args.command == "live":
            registry, source = _live_source(args.registry)
            generated_at = _timestamp(args.generated_at)
        elif args.command == "audit":
            registry = load_registry(args.registry)
            source = (
                FixtureHistorySource(args.fixture)
                if args.fixture is not None
                else _live_source(args.registry)[1]
            )
            report = audit_candidates(
                registry=registry, source=source, generated_at=_timestamp(args.generated_at)
            )
            atomic_write(args.output, canonical_json_bytes(report))
            print(f"wrote candidate audit for {len(report['candidates'])} non-approved runs")
            return 0
        else:  # pragma: no cover - argparse enforces commands
            raise AssertionError(args.command)
        result = export_snapshot(
            registry=registry,
            source=source,
            output_dir=args.output,
            generated_at=generated_at,
            target_shard_bytes=args.target_shard_bytes,
        )
        totals = result.manifest.totals
        print(
            f"wrote {result.manifest_path}: {totals.admitted_sample_count} admitted samples, "
            f"{totals.unique_geometry_count} unique geometries"
        )
        return 0
    except Exception as exc:  # noqa: BLE001 - CLI fails closed without leaking service errors
        print(
            f"{args.command} failed safely ({type(exc).__name__}); "
            "no verified manifest was replaced",
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
