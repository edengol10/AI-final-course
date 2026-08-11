# Airfoil Explorer — DRL × LBM Design Space

Public interactive explorer for stored BP3333 wing geometries and their per-wing `Cl` and `Cd` measurements.

The deployed dashboard uses a deterministic synthetic fixture until a research owner approves a reviewed W&B export. It renders geometry from parameters, previews the nearest stored row while a slider moves, and snaps every control to that exact row on release. It never predicts coefficients.

## Public dashboard

<https://edengol10.github.io/AI-final-course/>

## Data boundary

The public contract contains only the BP3333 parameter vector, `Cl`, `Cd`, geometry-validity information, minimal run/step provenance, replicate count, compatibility labels, and checksums. The exporter requests only its declared narrow history keys. Credentials, local paths, raw artifacts, models, media, and undeclared analysis data are never part of the static artifact.

## Local checks

```bash
npm ci
npm run check
.venv/bin/python -B scripts/export_snapshot.py fixture \
  --registry config/wandb-runs.yaml \
  --fixture tests/fixtures/wandb_history_v1.json \
  --output public/data \
  --generated-at 2026-08-10T00:00:00Z
.venv/bin/python -B scripts/export_snapshot.py validate --manifest public/data/manifest.json
```

## Deployment

GitHub Actions builds and deploys the fixture on pushes to `main`. The optional live W&B workflow runs hourly or manually only when `PUBLIC_RESEARCH_DATA_APPROVED=true` and `WANDB_API_KEY` are configured as repository settings. Both workflows validate the snapshot, scan the built artifact, and deploy through GitHub Pages.
