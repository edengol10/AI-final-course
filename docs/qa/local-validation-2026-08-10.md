# Local validation record — 2026-08-10

## Passed

- Python exporter: 44 tests passed.
- TypeScript/unit/component: 16 tests passed.
- ESLint, Ruff, strict TypeScript, and Vite production build passed.
- BP3333 browser port: 253 finite points and golden parity within `1e-5` (observed maximum approximately `1.2e-7`).
- Fixture export and offline Pydantic/Zod contract validation passed.
- Manifest/dataset canonical JSON, SHA-256, record counts, and file sizes validated.
- Restricted public fixture declares `modalDataIncluded: false`; modal/SPOD values are absent from every exported record and hidden by the UI.
- Fixture snapshot: 8 admitted samples, 7 unique float32 geometries, 5 contributing reviewed runs, and 6 explicit rejections.
- Deploy scanner self-test and scan of the current `dist/` passed.
- Both project skills passed the official structural validator.
- Nine Playwright cases are discovered and TypeScript-checked.
- GitHub Actions YAML parses and uses fixture-only PR checks, a no-secret restricted-fixture Pages workflow, and a separately gated restricted live-data workflow. Both deployment paths serialize on one concurrency group.

## Execution-blocked, not passed

- The nine Playwright browser cases could not execute because the workspace sandbox denied the required loopback server and the approval service had reached its usage limit. No browser pass is claimed.
- The in-app Browser skill could not initialize because its runtime rejected the call for missing sandbox-policy metadata. No manual desktop/mobile visual pass is claimed.
- Live W&B candidate audit returned a communication error, and reviewed narrow-history export produced no publishable rows. The fixture remained untouched and candidates were not added.
- GitHub Pages has not been enabled or deployed, so the expected URL, project subpath, public artifact, and last-good-deployment behavior are unverified.
- GitHub Pages is public and provides no project email allowlist. The obsolete `_headers` artifact was removed because Pages cannot apply repository-defined response headers; only the HTML meta CSP/referrer/robots controls are relevant there, and `robots.txt`/noindex remain advisory.
- The final report needs the exact two participant names and a verified public Pages URL before it can be submission-ready.

## Required completion handoff

1. Supply the exact participant names.
2. In **Settings > Pages**, select **GitHub Actions**; protect `main` and restrict the `github-pages` environment to the default branch.
3. Run `npm run test:e2e` in an environment allowed to bind `127.0.0.1:4173`.
4. Run the default fixture workflow and verify the expected URL, manifest, hashed shard, fixture banner, project subpath, and absence of SPOD/modal values.
5. Keep `PUBLIC_RESEARCH_DATA_APPROVED=false` unless activating the separately approved restricted live profile; live W&B remains unproven and requires `WANDB_API_KEY`.
6. Replace the report's blocked-deployment statement and source QR only after the public URL is verified; attach final browser screenshots/video.
