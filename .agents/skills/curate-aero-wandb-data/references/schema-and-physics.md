# Airfoil data schema and physics contract

## Approved initial sources

- W&B entity: `edenunu-technion-israel-institute-of-technology`
- Project: `wing parameter test`
- Reviewed initial run IDs: `fo7gm0ds`, `opffdpy8`, `5etm3jjj`, `nl9fb08e`, `k202yi52`
- Candidate modern runs require a fresh audit before allowlisting: `sjhhvgd6`, `elstxotw`, `1n93x16f`, `syqss1sr`, `ud0cqk5m`, `y44fmpfc`

The historical audit found roughly 2,317 successful CFD samples and roughly 2,301 unique float32 geometries in the initial set. Live W&B is authoritative; never assert these values in code or use them as acceptance thresholds.

## Allowed history fields

Request only:

- `_step` and the minimum timestamp needed for deterministic provenance;
- `action/r_le`, `action/x_c`, `action/y_c`, `action/k_c`, `action/y_t`, `action/x_t`, `action/beta_te`, `action/k_t`, `action/gamma_le`, `action/alpha_te`;
- `aero/step_avg_Cl`, `aero/step_avg_Cd`;
- `geometry/step_curvature_ratio`;
- `status/invalid_geometry`;
- `spod/mode1_peak_freq_1`, `spod/mode1_peak_freq_2`.

Never export `avg_Cl`, `avg_Cd`, episode aggregates, full configs/summaries, machine telemetry, server paths, hostnames, media, checkpoints, raw artifacts, or credentials.

## BP3333 order, bounds, and NACA2412 baseline

| Parameter | Minimum | Maximum | Baseline |
|---|---:|---:|---:|
| `r_le` | -0.08 | -0.0005 | -0.016146018916033678 |
| `x_c` | 0.25 | 0.75 | 0.42463735413258963 |
| `y_c` | 0.003 | 0.09 | 0.02038049164704984 |
| `k_c` | -2.2 | -0.01 | -0.21172827316723572 |
| `y_t` | 0.03 | 0.18 | 0.06012113069431794 |
| `x_t` | 0.08 | 0.50 | 0.2989015826574153 |
| `beta_te` | 0.005 | 0.50 | 0.1373828669255089 |
| `k_t` | -1.2 | -0.1 | -0.514126765787434 |
| `gamma_le` | 0.01 | 0.50 | 0.0725896568547561 |
| `alpha_te` | 0.005 | 0.90 | 0.4022178081503657 |

Use this exact vector order. The initial reviewed data varies only `x_c`, `x_t`, `y_t`, and `r_le`; determine active parameters from each exported group instead of hard-coding that subset.

## Row admission and reason codes

Admit a row only if all applicable rules pass:

1. source run is finished and allowlisted (`RUN_NOT_FINISHED`, `RUN_NOT_APPROVED`);
2. absolute-action schema is known (`UNKNOWN_ACTION_SCHEMA`);
3. every present action is finite and within its bound (`NONFINITE_ACTION`, `ACTION_OUT_OF_BOUNDS`);
4. per-wing `Cl` and `Cd` are finite (`MISSING_AERO`, `NONFINITE_AERO`);
5. `invalid_geometry` numerically equals zero (`INVALID_GEOMETRY`, `MISSING_VALIDITY`);
6. curvature ratio is finite and below one (`MISSING_CURVATURE`, `CURVATURE_LIMIT`);
7. when frequencies are required, both peaks are finite and positive (`MISSING_FREQUENCY`, `NONPOSITIVE_FREQUENCY`).

Do not silently discard a row. Count one primary stable rejection reason using the order above; diagnostic secondary reasons may also be recorded outside public snapshots.

## Compatibility and provenance

Compatibility identity includes baseline wing, angle of attack, CFD averaging window, SPOD settings, and solver revision when available. Use normalized explicit values; any unknown value must create an isolated group label. Minimal public provenance is run ID, global step, and a sanitized recorded time. Do not expose run names containing private context, URLs with tokens, filesystem paths, usernames, hostnames, or arbitrary metadata.

## Deduplication and nearest distance

Convert the full parameter vector to float32 in authoritative order. Its exact bytes identify a geometry. Keep the number of admitted samples separately; select the representative sample by newest sanitized timestamp, greatest step, then lexicographically greatest run ID. Distance is Euclidean after `(value - min) / (max - min)` over only variable parameters in the selected group. Break equal distances by the lowest stable record index.
