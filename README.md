# Airfoil Explorer — DRL × LBM Design Space

A secure, read-only React dashboard for exploring verified BP3333 airfoil geometries and their measured LBM/SPOD results. It renders the wing from its ten parameters, previews the exact nearest database record while a slider moves, and snaps every active control to that measured record on commit. Aerodynamic and frequency results are never interpolated.

> **Current repository data is a deterministic synthetic QA fixture.** The live W&B export was attempted and failed closed, so no fixture was silently presented as a live thesis snapshot. The hourly production workflow replaces it only after authenticated W&B export, scientific validation, checksum validation, a production build, and a privacy scan all pass.

## What is implemented

- React, TypeScript, Vite, Radix sliders, Framer Motion, a Web Worker nearest-neighbor search, and custom equal-axis SVG BP3333 rendering.
- Signed `Cl`/`Cd` bars plus the first two ranked peaks of **SPOD mode 1**, correctly labelled in `TU⁻¹`.
- Dynamic unique-geometry/sample/source-run counts, provenance, dataset compatibility selector, stale/offline/malformed/missing-frequency states, and an atomic cache-busted Refresh action.
- Python W&B exporter using a reviewed run registry, narrow `scan_history` fields, ordered rejection accounting, physical grouping, float32 deduplication, replicate provenance, Pydantic contracts, canonical SHA-256, and sub-10-MiB hashed shards.
- Zod validation in the browser, a strict deploy-output privacy scanner, fixture-only pull-request CI, and hourly/manual/main Cloudflare Pages Direct Upload.
- Default-deny Cloudflare Access handoff for reviewer email OTP; there is deliberately no client-side password gate.
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
  --generated-at 2026-08-10T00:00:00Z
```

Live export uses existing server-side authentication and never prints the key:

```bash
.venv/bin/python -B scripts/export_snapshot.py live \
  --registry config/wandb-runs.yaml \
  --output public/data
```

Only the five reviewed run IDs in [the registry](config/wandb-runs.yaml) are publishable. Candidate runs stay excluded until a fresh schema and physics audit is reviewed.

## Deploy securely

The production workflow needs GitHub Actions secrets `WANDB_API_KEY`, `CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID`, plus the non-secret Pages/source variables described in [the Cloudflare Access handoff](docs/deployment/cloudflare-access.md). Protect both the production hostname and preview wildcard with default-deny Access and an explicit reviewer email allowlist using short-lived one-time PINs.

Security headers protect framing, MIME sniffing, referrers, browser capabilities, and indexing. They complement Cloudflare Access; they do not replace it. If export, validation, build, scan, or upload fails, the previous Pages deployment stays live.

## Documentation

- [Architecture and trust boundary](docs/architecture.md)
- [Local development and read-only thesis boundary](docs/local-development.md)
- [Cloudflare deployment and OTP acceptance](docs/deployment/cloudflare-access.md)
- [Current validation record](docs/qa/local-validation-2026-08-10.md)
- [AI evidence log](docs/ai-evidence/work-log.md)
- [Skill comparison](experiments/skill-comparison/evaluation.md)

The thesis checkout was used only as a read-only scientific reference and remained clean at `4936dea753e11e54f25532820a7ac576f7f84401` on `drl-setting`.
