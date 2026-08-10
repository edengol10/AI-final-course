# Airfoil Explorer architecture

## Trust boundary

The thesis repository is a read-only scientific reference. It is never imported by production, mutated by this project, or deployed. The only production ingestion path is a server-side exporter running in GitHub Actions with a narrow W&B API key. Browsers receive validated, stripped snapshots and never receive a W&B or Cloudflare credential.

```text
approved W&B runs
      │ narrow scan_history fields
      ▼
Python exporter ── admission + physics grouping + float32 dedupe
      │ Pydantic, canonical JSON, SHA-256, <10 MiB chunks
      ▼
temporary build snapshot ── secret/path scan ── Vite build
      │ successful workflow only
      ▼
Cloudflare Pages + Access (default deny, reviewer email OTP)
      │ protected HTML and protected JSON
      ▼
React client ── Zod validation ── Web Worker nearest-wing lookup
```

If export, validation, build, scanning, or upload fails, the workflow stops before a new deployment is created. Cloudflare keeps serving the previous verified deployment.

## Scientific data model

Each compatibility group has one baseline, angle of attack, CFD averaging window, SPOD configuration, and solver revision identity. Unknown settings are isolated. The exporter reconstructs a complete ten-parameter BP3333 vector from the pinned NACA2412 baseline and absolute `action/*` values. It admits only finite, bounded, valid geometries with finite per-wing aerodynamic values and the declared frequency coverage.

Snapshots preserve two counts:

- **successful CFD samples** counts every admitted observation;
- **verified wing geometries** counts unique float32 BP3333 vectors.

Replicates retain a count and deterministic representative provenance. UI values always come from one representative `WingRecord`; no coefficient or frequency is interpolated.

## Client state transition

Dragging sets a requested parameter vector. An animation-frame-throttled worker finds the exact nearest stored vector using Euclidean distance after normalization by authoritative bounds and only active parameters. The UI previews that record’s wing and complete metric tuple while ghost markers retain the requested positions. Commit/release moves every slider to the stored record exactly.

Refresh fetches only cache-busted `manifest.json`. A new checksum triggers download and validation of every referenced chunk into a temporary in-memory dataset. State swaps atomically only after all checks pass; the current requested vector is then reselected against the new group. Unchanged, malformed, stale, and offline results have distinct user-visible states.

## Deployment controls

GitHub Actions uses fixture-only checks on pull requests. The production workflow runs hourly, on `main`, and manually. It needs only `contents: read` plus the three repository secrets named in `.env.example`. Cloudflare Access must cover the production hostname and preview wildcard with default deny and an explicit email allowlist. Security response headers and crawler exclusion are part of the static build, but Access is the confidentiality boundary.
