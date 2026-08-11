# Condition Groups and Efficiency Navigation Design

Date: 2026-08-11
Status: Approved interaction design; implementation pending written-spec review

## Purpose

The public Airfoil Explorer currently isolates each reviewed W&B run even when the runs used the same physical and numerical conditions. This change will merge scientifically compatible runs, make every selected iteration traceable to its source run and step, and add clear navigation and comparison tools for the best measured wing and the NACA 2412 reference.

The public snapshot remains limited to BP3333 parameters, `Cl`, `Cd`, reviewed condition metadata, and minimal run/step provenance.

## Confirmed source facts

The five reviewed runs are:

- `fo7gm0ds`
- `opffdpy8`
- `5etm3jjj`
- `nl9fb08e`
- `k202yi52`

Their W&B configuration reports the same preset (`sac_naca2412_aoa7`), baseline wing (`naca2412`), angle of attack (7 degrees), and coefficient-averaging window (30--60 TU).

The read-only thesis source defines the matching CFD baseline as:

- Reynolds number: 3,000
- chord resolution: 150 lattice units
- grid: 900 x 210
- maximum inlet velocity: 0.08 lattice units per time step
- collision model: MRT
- immersed-boundary scheme: IB1

The authoritative NACA 2412 BP3333 vector, in public action order, is:

| Parameter | Value |
|---|---:|
| `r_le` | -0.016146018916033678 |
| `x_c` | 0.42463735413258963 |
| `y_c` | 0.02038049164704984 |
| `k_c` | -0.21172827316723572 |
| `y_t` | 0.06012113069431794 |
| `x_t` | 0.2989015826574153 |
| `beta_te` | 0.1373828669255089 |
| `k_t` | -0.514126765787434 |
| `gamma_le` | 0.0725896568547561 |
| `alpha_te` | 0.4022178081503657 |

## Approaches considered

### Audited registry fingerprint (selected)

Store the complete reviewed condition fingerprint in the run registry. Merge only reviewed runs whose fingerprints match exactly. Unknown fields continue to isolate a run.

This approach is deterministic, reviewable, safe for a public exporter, and does not depend on undocumented W&B configuration shapes.

### Dynamic W&B configuration grouping

Read conditions from each W&B run during every export. This is more automatic, but the current runs do not contain every required grid and flow field. It also expands the public exporter's metadata access and makes grouping vulnerable to schema drift.

### Run-ID merge override

Maintain a simple list of run IDs to combine. This is fastest but does not prove physical compatibility and could silently mix incompatible future runs.

## Compatibility model

Each reviewed run receives a `PhysicalConditionSpec` containing:

- baseline identifier
- Reynolds number
- chord resolution
- grid dimensions
- angle of attack
- coefficient-averaging start and end in TU
- maximum inlet velocity
- collision-model identifier
- immersed-boundary-scheme identifier

The compatibility group ID is a canonical hash of these fields. Numeric values use a canonical JSON representation. Every field is required for merging. A run with an unknown condition is isolated by run ID and visibly labelled as unaudited.

The five reviewed runs above will therefore produce one compatibility group. Every admitted history iteration remains a selectable record; grouping does not deduplicate or erase valid iterations. Unique-geometry and admitted-sample counts remain separate.

The compatibility strip in the application will show:

`Re 3,000 · Grid 900×210 · AoA 7° · Averaging 30–60 TU`

Expanded details may also show chord resolution and the reviewed numerical-method identifiers.

## Exporter and public contracts

The Python contracts and TypeScript schemas will add the reviewed condition fields. The exporter will use only the registry's audited condition fingerprint for grouping. It will not copy arbitrary W&B configuration, local paths, system information, or other metadata into the snapshot.

Admission continues to require a finished and reviewed run, a known absolute-action schema, valid BP3333 bounds, finite `Cl` and `Cd`, positive lift, valid geometry status, and acceptable curvature. Penalty scores do not enter the public dataset.

Every public record preserves:

- run ID
- W&B global step
- safe recorded timestamp when available
- all ten reconstructed BP3333 parameters
- `Cl`, `Cd`, and curvature admission value

The manifest reports merged group counts, admitted samples, unique geometries, source runs, and rejection reasons.

## Efficiency definition

The most efficient wing is selected only within the currently selected compatibility group.

Eligible records must satisfy:

- `Cl > 0`
- `Cd > 0`
- finite `Cl / Cd`

Efficiency is `Cl / Cd`. The record with the maximum value wins. Ties use a stable deterministic order: newest recorded timestamp, then greatest global step, then lexicographically greatest run ID, then stable record index. Thus repeated refreshes and drags cannot flicker between equal candidates.

All green markers refer to this one winning record. They do not independently mark the highest `Cl`, lowest `Cd`, or a synthetic combination.

## Interface behavior

### Wing and condition display

The wing plot continues to render the selected BP3333 geometry and will show the exact NACA 2412 outline as a clearly labelled reference overlay. The physical-condition strip appears near the dataset selector.

A prominent label near the selected-wing heading will read:

`Run <run-id> · Step <global-step>`

The full provenance panel remains available below it.

### Metrics

The response card will contain three rows in order:

1. `Cl`
2. `Cd`
3. `Cl/Cd`

`Cl/Cd` is computed only from the selected measured row when `Cd > 0`; otherwise it is shown as unavailable. No metric is interpolated or predicted.

Metric scales are derived once from the complete selected group so that bars and reference markers do not move their coordinate systems during navigation. Each row contains a green dot at the corresponding value of the group's most efficient record. Accessible text identifies it as the best-wing reference value.

### Parameter sliders

Each active BP3333 slider keeps the existing requested and measured indicators and adds a green dot at the most efficient wing's exact parameter value. The marker does not intercept pointer input and has an accessible legend.

Dragging continues to preview one real database row at a time. On release, all sliders snap to that row, and the wing, all three metrics, and provenance update together.

### Navigation buttons

`Go to best wing` selects the winning measured record and moves every active slider to its exact values.

`Go to NACA 2412` uses the authoritative ten-parameter vector. If an exact float32-matching measured record exists in the selected group, the newest deterministic match is selected and its metrics and provenance are displayed. If no exact measured row exists, the application shows the exact reference geometry and parameters while clearly marking measured metrics and run/step provenance as unavailable. It never borrows metrics from a nearby wing.

## State and refresh behavior

The best-wing calculation and group scales are recomputed atomically after a newer manifest is loaded. The selected wing is then reselected using the existing nearest-record rule unless the user is in the explicit reference-only state.

Malformed, empty, stale, and unavailable snapshots keep their existing failure states. A group with no eligible positive-drag efficiency record shows no green markers and disables `Go to best wing` with an explanation.

## Accessibility and responsive behavior

- Buttons and markers receive meaningful accessible names.
- The selected run and step are announced when navigation changes the record.
- Green is reinforced with shape and text, not used as the only signal.
- Keyboard changes maintain the same preview/snap/provenance consistency as pointer changes.
- Reduced-motion mode avoids animated travel while preserving immediate state changes.
- Mobile layout keeps the condition strip, metric rows, buttons, and provenance free from clipping and overlap.

## Test strategy

Implementation follows test-driven development.

Python tests will cover:

- exact merging of the five audited fingerprints
- isolation when any required condition differs or is unknown
- deterministic group IDs and public condition labels
- preservation of every admitted iteration and its run/step provenance
- positive-lift admission and rejection accounting
- absence of undeclared metadata in serialized snapshots

TypeScript unit and component tests will cover:

- `Cl/Cd` computation and unavailable cases
- group-local best-wing selection, positive-drag eligibility, and tie-breaking
- green marker positions on all metric rows and active sliders
- exact best-wing navigation
- exact NACA 2412 navigation and no-nearest-metric fallback
- prominent run/step changes remaining consistent with the selected metric row
- refresh recomputation and empty-eligible-set handling

Playwright and visual checks will cover:

- drag preview and release snap
- best and reference buttons
- desktop and mobile layouts
- keyboard operation, focus visibility, accessible names, and reduced motion
- the deployed GitHub Pages site using the current public snapshot

## Deployment

After all exporter, unit, component, end-to-end, accessibility, build, and secret-scan checks pass, the branch will be committed and pushed. The change will be integrated to `main`, the hourly/manual GitHub Pages workflow will export the current reviewed data, and the resulting public deployment will be checked on desktop and mobile.

If export or validation fails, deployment stops and the previous verified site remains available.

## Acceptance criteria

- The five reviewed, physically identical runs appear as one group.
- The condition strip shows Reynolds 3,000, grid 900×210, AoA 7°, and averaging 30–60 TU.
- All admitted positive-lift iterations remain reachable.
- Every measured selection visibly shows its exact run ID and global step.
- `Cl/Cd` appears below `Cl` and `Cd` and always belongs to the same row.
- One group-local best wing controls every green marker.
- Both navigation buttons produce exact, deterministic states.
- The reference button never assigns nearby-wing metrics to the NACA geometry.
- No new private diagnostics, credentials, paths, or raw W&B metadata enter built assets.
- The thesis repository HEAD and cleanliness are unchanged.
- The live GitHub Pages deployment passes desktop and mobile smoke checks.
