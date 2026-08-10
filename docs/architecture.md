# Airfoil Explorer architecture

## Trust boundary

The thesis repository is a read-only scientific reference. It is never imported by production, mutated by this project, or deployed. The committed browser snapshot declares `snapshotKind: synthetic-fixture`; the client uses that field for a persistent fixture banner and fixture-specific labels. The default GitHub Pages workflow publishes only this synthetic snapshot and requires no secret.

GitHub Pages is a **public** delivery target, not a confidentiality boundary. It provides no project email allowlist or application authentication, so unpublished research must remain outside every Pages artifact. Both fixture and optional live builds pass `--exclude-modal-data` and require `modalDataIncluded: false`: public scientific outputs are limited to geometry/parameters and `Cl`/`Cd`; every SPOD/modal value is stripped and not rendered. Minimal technical provenance, replicate count, curvature/admission metadata, and compatibility descriptors remain. The optional W&B ingestion path is disabled unless the research owner sets `PUBLIC_RESEARCH_DATA_APPROVED=true`; enabling it approves only this restricted profile for public release.

```text
committed synthetic fixture ── strip modal data + validate hashes ── Vite build
      │ default main/manual workflow; no secrets
      ├──────────────────────────────┐
      │                              ▼
approved W&B runs             exact dist/ privacy scan
      │ explicit public-release      │
      │ gate + narrow export         ▼
      └──────────────────────> GitHub Pages artifact ── public internet
                                                   │
                                                   ▼
                         React ── manifest/shard SHA-256 + Zod ── worker lookup
```

For an approved export, transient work trees stay outside Vite's `public/` directory. The exporter validates the manifest and every hashed shard, then replaces the complete snapshot directory; obsolete or partial shards are not left deployable. Both Pages workflows upload only after validation, build, and scanning succeed, and deployment runs are serialized. Preservation of the preceding Pages release still requires a forced-failure drill before it can be marked verified.

## Scientific data model

Each compatibility group has one baseline, angle of attack, CFD averaging window, SPOD configuration, and solver revision identity. Unknown settings are isolated. The exporter reconstructs a complete ten-parameter BP3333 vector from the pinned NACA2412 baseline and absolute `action/*` values. It admits only finite, bounded, valid geometries with finite per-wing aerodynamic values and the declared frequency coverage.

Snapshots preserve two counts:

- **successful CFD samples** counts every admitted observation;
- **verified wing geometries** counts unique float32 BP3333 vectors.

Replicates retain a count and deterministic representative provenance. Published rows intentionally retain minimal run-ID/step provenance for traceability, while the W&B entity/project namespace is stripped. UI values always come from one representative `WingRecord`; no coefficient or frequency is interpolated.

## Client state transition

Dragging sets a requested parameter vector. An animation-frame-throttled worker finds the exact nearest stored vector using Euclidean distance after normalization by authoritative bounds and only active parameters. The UI previews that record’s wing and complete metric tuple while ghost markers retain the requested positions. Commit/release moves every slider to the stored record exactly.

Refresh fetches only cache-busted `manifest.json`. The client schema-validates it and recomputes its canonical SHA-256. A new checksum triggers download of every referenced shard; the browser verifies each byte size, SHA-256, schema, descriptor, and group invariant in temporary memory. State swaps atomically only after all checks pass, and the current requested vector is then reselected against the new group. Unchanged, malformed, stale, and offline results have distinct user-visible states.

## Deployment controls

GitHub Actions uses fixture-only checks on pull requests. Protect `main` against direct pushes, require those checks before merge, and restrict the `github-pages` environment to the default branch. The default deployment runs on `main` and manually, deterministically replays the committed fixture with modal exclusion, rejects any manifest that is not `synthetic-fixture`, and references no secret. The exceptional live workflow runs hourly or manually only behind `PUBLIC_RESEARCH_DATA_APPROVED=true` plus `WANDB_API_KEY`; it uses the same modal-exclusion profile and states that the result is public.

The workflows deny token capabilities by default. Build jobs receive `contents: read` plus `pages: read` for Pages metadata configuration; deploy jobs receive only `pages: write` and `id-token: write`. Both use `actions/upload-pages-artifact` followed by `actions/deploy-pages` and share one non-cancelling concurrency group. Repository administrators must select **Settings > Pages > Source: GitHub Actions**. The expected URL is <https://edengol10.github.io/AI-final-course/>, but no live deployment is claimed until that URL and its data paths are checked.
