# Unskilled response

## Prompt

> Build the W&B-to-dashboard data refresh and nearest-wing interaction while preserving scientific validity and protecting unpublished data.

## Proposed implementation

I would build a small Python export command that is the only component allowed to contact W&B. It would accept an explicit entity, project, and checked-in run-ID allowlist, request only the history columns needed by the dashboard, validate every returned row, and write a static snapshot under `public/data/`. The browser would never receive a W&B API key or call W&B directly. Candidate run IDs would be audited into a local report but would not become publishable merely because they exist in the project.

The exporter would use versioned Pydantic models for a manifest and per-wing records. A record would include the wing parameters, aerodynamic outputs needed by the plots, a stable wing identifier, source run ID, source step, and enough non-secret provenance to reproduce the transformation. Validation would reject rows with missing or non-finite numbers, impossible geometry, mismatched array lengths, or absent aerodynamic results. The command would count each rejection reason and fail if an allowlisted run yields no valid data. Duplicate rows would be reduced deterministically after conversion to `float32`, while retaining a replicate count.

Geometry would be reconstructed from a fixed NACA 2412 baseline plus the exported deformation/parameter values, rather than exporting arbitrary binary artifacts. I would add a golden fixture for the known BP3333 parameter set and compare reconstructed coordinates with a trusted implementation. Runs would be partitioned into compatibility groups using their experiment configuration (baseline profile, angle of attack, discretization, objective, solver/data schema, and active parameter set), so physically incompatible results are never compared in one nearest-neighbor search.

For nearest-wing behavior, the dashboard would first restrict candidates to the selected compatibility group. It would compute distance only across the group's active parameters, normalize each dimension by its observed range (with zero-range dimensions contributing zero), and break equal distances by stable wing ID. The UI would display the selected sample's actual parameter values and provenance instead of pretending that a continuous slider request was simulated exactly.

Each export would be deterministic: sorted inputs and records, canonical JSON serialization, content hashes for every data file, a manifest hash computed without a self-referential field, and atomic replacement only after full validation. Published provenance would be sanitized to an allowlist such as entity, project, run ID, step, and generated timestamp; run names, notes, usernames beyond the approved entity, filesystem paths, URLs containing tokens, environment/config dumps, and artifact metadata would be excluded. Files would remain below 10 MiB, with deterministic shards if necessary.

I would include an offline fixture mode and Python tests covering schema validation, invalid-row accounting, compatibility grouping, normalization/tie-breaking, float32 deduplication, canonical hashing, provenance redaction, size limits, deterministic repeated exports, and the BP3333 golden geometry. A live refresh would run only when existing W&B authentication succeeds without printing credentials; otherwise the fixture-backed snapshot would remain the reproducible development and CI path, and the command would report that live export was skipped.
