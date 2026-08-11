# Skilled output

Use W&B's server-side `scan_history` with only `_step`, sanitized timestamp, the ten BP3333 `action/*` values, `aero/step_avg_Cl`, `aero/step_avg_Cd`, `geometry/step_curvature_ratio`, and `status/invalid_geometry`. Do not download artifacts, media, models, full configuration, summaries, system telemetry, or arbitrary metadata.

Admit only rows from finished reviewed runs with a known action schema, finite in-bound actions, finite per-wing `Cl` and `Cd`, valid geometry, and curvature below one. Keep ordered rejection counts. Partition records by baseline, angle of attack, CFD averaging window, and solver revision; isolate unknown settings. Deduplicate float32 vectors and choose the newest representative deterministically while retaining replicate provenance.

The browser uses fixed authoritative BP3333 bounds for nearest-neighbor search and stable record-index tie breaking. Geometry, coefficients, and provenance always come from one admitted record; nothing is interpolated or predicted.
