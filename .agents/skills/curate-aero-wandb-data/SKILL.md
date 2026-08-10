---
name: curate-aero-wandb-data
description: Curate scientifically valid, privacy-safe W&B histories into versioned Airfoil Explorer snapshots. Use when adding or auditing source runs, changing exporter fields or admission rules, reconstructing BP3333 geometry, grouping compatible CFD/SPOD samples, deduplicating wings, or validating a dashboard data refresh.
---

# Curate Aero W&B Data

Use this workflow whenever data can enter the public dashboard. It turns an explicit run allowlist into reproducible snapshots without exposing credentials, local paths, training artifacts, or incompatible physics.

## Required reference

Read [schema-and-physics.md](references/schema-and-physics.md) before editing exporter code or evaluating a run. Treat its keys, parameter order, bounds, baseline, and admission rules as one contract; do not copy only part of it.

## Workflow

1. **Freeze the source boundary.** Work only from the reviewed registry. A run being new, finished, or visually plausible is not approval. Record exclusions with a stable reason code.
2. **Fetch the narrow history.** Use the server-side W&B Public API and `scan_history` with only the approved per-wing keys. Do not download artifacts, media, models, system metrics, run config dumps, or full metadata.
3. **Establish schema.** Confirm absolute-action semantics and the ten BP3333 fields. Reject or isolate legacy, delta-action, NSGA2, crashed, and unknown-schema runs.
4. **Admit rows.** Require a finished approved run, finite per-wing `Cl` and `Cd`, bounded actions, `invalid_geometry == 0`, curvature ratio below one, and positive finite frequency peaks when the selected dataset declares frequency coverage.
5. **Reconstruct vectors.** Begin with the pinned NACA2412 BP3333 baseline, overwrite fields present as absolute actions, and store the full vector in the authoritative parameter order. Never infer an absent value from a previous row.
6. **Group compatibility.** Partition by baseline, angle of attack, CFD averaging window, SPOD configuration, and solver revision when known. Put unknown settings in an isolated group rather than mixing them.
7. **Deduplicate deterministically.** Preserve every valid sample count and provenance. Index unique float32 parameter-vector bytes; for replicates select the newest valid record by timestamp, then global step, then run ID. Emit `replicateCount`.
8. **Publish compactly.** Validate models with Pydantic, serialize columnar data, split hashed files below 10 MiB, calculate SHA-256 over canonical bytes, and write the manifest last. A failed export must not replace the previous verified deployment.
9. **Prove privacy and reproducibility.** Scan built files for known secret formats, tokens, home paths, hostnames, GPU telemetry, artifact names, and undeclared fields. Re-run the fixture export and require byte-identical output except for an explicitly controlled generation timestamp.

## Scientific invariants

- Aerodynamic values always come from `aero/step_avg_Cl` and `aero/step_avg_Cd`; episode averages are not per-wing observations.
- The two displayed frequencies are the first and second ranked peaks of SPOD mode 1, never “mode 1” and “mode 2.”
- A UI metric tuple must always point to one admitted provenance record. Never interpolate or predict `Cl`, `Cd`, or frequencies.
- Nearest-neighbor distance uses normalized authoritative bounds and only parameters that vary within the selected compatibility group.
- Dynamic successful-sample and unique-geometry counts come from exported records. Reference counts are audit clues, not constants.

## Completion gate

Do not approve a snapshot unless exporter unit tests, schema validation, deterministic replay, rejection accounting, compatibility grouping, deduplication, size limits, checksum verification, and a secret/path scan all pass. Attach the exact commands and results to the AI evidence log.
