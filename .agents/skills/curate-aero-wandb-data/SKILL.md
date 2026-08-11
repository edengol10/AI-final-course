---
name: curate-aero-wandb-data
description: Curate scientifically valid, publication-safe W&B histories into compact Airfoil Explorer snapshots. Use when approving runs, changing declared exporter fields, reconstructing BP3333 geometry, grouping compatible CFD samples, retaining valid iterations, or validating a dashboard refresh.
---

# Curate Airfoil W&B Data

1. Read the registry and use only reviewed, finished runs with the known absolute BP3333 action schema.
2. Query only `_step`, sanitized timestamp, declared `action/*` fields, per-wing `aero/step_avg_Cl`, `aero/step_avg_Cd`, geometry validity, and curvature ratio. Never fetch artifacts, media, models, system telemetry, summaries, or arbitrary metadata.
3. Reconstruct each full vector from the pinned NACA2412 baseline. Reject non-finite/out-of-bound actions, invalid geometry, curvature at or above one, missing/non-finite aerodynamic values, and non-positive `Cl`.
4. Group by baseline, angle of attack, CFD averaging window, and solver revision. Isolate unknown settings.
5. Retain every admitted history row as an interactive iteration with its own minimal provenance. Deduplicate exact float32 vectors only to calculate the separate unique-geometry count; never hide valid iterations.
6. Validate Pydantic contracts, write canonical hashed JSON shards below 10 MiB, validate the entire staging tree, and atomically replace a previous snapshot only after success.

The published contract contains parameters, `Cl`, `Cd`, validity information, compatibility labels, replicate counts, and minimal provenance only. Keep credentials, local paths, W&B namespace, artifacts, and undeclared diagnostics out of all public files.
