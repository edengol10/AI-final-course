# Airfoil Explorer — DRL × LBM Design Space

A read-only React dashboard for exploring validated BP3333 airfoil geometries and stored LBM coefficients. It renders the wing from its ten parameters, previews the exact nearest database record while a slider moves, and snaps every active control to that stored record on commit. Aerodynamic results are never interpolated.

> **The default GitHub Pages site is public and fixture-only.** Its deterministic build replays the committed QA fixture with `--exclude-modal-data`: public scientific outputs are limited to geometry/parameters and `Cl`/`Cd`, while all SPOD/modal values are stripped and not rendered. The manifest declares `snapshotKind: synthetic-fixture` and `modalDataIncluded: false`, and the app displays fixture-specific labels. GitHub Pages does not provide this project with an email allowlist or a private-data boundary.

## What is implemented

- React, TypeScript, Vite, Radix sliders, Framer Motion, a Web Worker nearest-neighbor search, and custom equal-axis SVG BP3333 rendering.
- Signed `Cl`/`Cd` bars; the approved public profile strips all SPOD/modal values and does not render modal cards.
- Dynamic unique-geometry/sample/source-run counts, provenance, dataset compatibility selector, stale/offline/malformed/missing-frequency states, and an atomic cache-busted Refresh action.
- Python W&B exporter using a reviewed run registry, narrow `scan_history` fields, ordered rejection accounting, physical grouping, float32 deduplication, replicate provenance, Pydantic contracts, canonical SHA-256, and sub-10-MiB hashed shards. It builds and validates a transient work tree outside `public/` before replacing the complete snapshot, so obsolete or partial shards are not deployable.
- Browser-side Zod validation plus recomputed canonical-manifest and per-shard SHA-256 checks, a strict deploy-output privacy scanner, fixture-only pull-request CI, and serialized GitHub Pages artifact deployment.
- A no-secret `main`/manual workflow that rebuilds only the committed fixture with the restricted public profile, plus a separate hourly/manual live-data workflow disabled unless that same restricted release is explicitly approved.
- Two reusable project skills and a preserved before/after skill experiment under `.agents/skills/` and `experiments/skill-comparison/`.

## Run locally

```bash
npm install
npm run dev
```

The committed fixture is intentionally small: 8 admitted synthetic samples, 7 unique geometries, and 6 exercised rejection cases. It exists for deterministic CI and interaction testing, not as a scientific result.

## Verify

```bash
npm run check
.venv/bin/python -m pytest
.venv/bin/python -m ruff check pipeline scripts tests/python
.venv/bin/python -B scripts/scan_build.py --self-test
.venv/bin/python -B scripts/scan_build.py dist
npx playwright test --list
```

The full browser suite is `npm run test:e2e`. It covers pointer/keyboard preview and snap, row consistency, refresh outcomes, missing frequencies, fail-closed states, mobile overflow, and axe accessibility.

## Export data

Fixture replay:

```bash
.venv/bin/python -B scripts/export_snapshot.py fixture \
  --registry config/wandb-runs.yaml \
  --fixture tests/fixtures/wandb_history_v1.json \
  --output public/data \
  --generated-at 2026-08-10T00:00:00Z \
  --exclude-modal-data
```

Live export uses existing server-side authentication and never prints the key:

```bash
.venv/bin/python -B scripts/export_snapshot.py live \
  --registry config/wandb-runs.yaml \
  --output public/data \
  --exclude-modal-data
```

Only the five reviewed run IDs in [the registry](config/wandb-runs.yaml) are eligible for review. Candidate runs stay excluded until a fresh schema and physics audit is reviewed. A live snapshot may be published only after the research owner separately approves the restricted public profile. Public scientific outputs are geometry/parameters and `Cl`/`Cd`; all SPOD/modal values are stripped and not rendered. Minimal technical provenance, replicate count, curvature/admission metadata, and compatibility descriptors remain for traceability, while W&B entity/project names are stripped.

Every export is assembled in a transient work tree outside Vite's `public/` directory. The exporter writes hashed shards and the canonical manifest, validates the complete staged tree, and then replaces the prior snapshot directory as one controlled swap. The browser independently recomputes the manifest checksum, byte size and checksum of every referenced shard, and all schemas before replacing in-memory state.

## Deploy the public synthetic fixture

In **Repository Settings > Pages > Build and deployment**, set **Source** to **GitHub Actions**. Pushes to `main` and ordinary manual runs use [the default Pages workflow](.github/workflows/deploy-production.yml), which replays the committed fixture with `--exclude-modal-data`, requires `snapshotKind: synthetic-fixture` and `modalDataIncluded: false`, builds with the `/AI-final-course/` base path, scans the exact artifact, and deploys without repository secrets. The expected project URL is <https://edengol10.github.io/AI-final-course/>, but it is not claimed live until a workflow run and browser check succeed.

GitHub Pages is a public static host. It cannot satisfy an email-allowlist requirement for this project, and `robots.txt` is advisory rather than access control. Never publish private or unpublished research there. Protect `main` against direct pushes, require fixture CI before merge, and restrict the `github-pages` environment to the default branch.

The separate [public live-data workflow](.github/workflows/publish-approved-live-data.yml) runs hourly or manually only when repository variable `PUBLIC_RESEARCH_DATA_APPROVED` is exactly `true` and secret `WANDB_API_KEY` exists. It also requires `--exclude-modal-data`; approval therefore covers only geometry/parameters, `Cl`/`Cd`, and the retained minimal technical metadata—not modal/SPOD values. Enabling it makes that restricted snapshot accessible to anyone on the internet. Leave the variable false unless the research owner has approved that publication.

## Documentation

- [Architecture and trust boundary](docs/architecture.md)
- [Local development and read-only thesis boundary](docs/local-development.md)
- [GitHub Pages deployment and public-data gate](docs/deployment/github-pages.md)
- [Current validation record](docs/qa/local-validation-2026-08-10.md)
- [AI evidence log](docs/ai-evidence/work-log.md)
- [Skill comparison](experiments/skill-comparison/evaluation.md)

The thesis checkout was used only as a read-only scientific reference and remained clean at `4936dea753e11e54f25532820a7ac576f7f84401` on `drl-setting`.
