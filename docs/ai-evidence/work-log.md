# AI implementation evidence log

This log records the human request, AI-assisted action, resulting repository change, human correction, validation evidence, and estimated time saved. It intentionally excludes credentials, private W&B metadata, and local machine paths.

## Entry 001 — implementation boundary and bootstrap

- **Date:** 2026-08-10
- **Prompt:** Implement the approved “Secure Airfoil Explorer and Course Report” plan while keeping the thesis repository strictly read-only.
- **Skill used:** `skill-creator` (selected; project skills are scaffolded in the next entry), `github:yeet` (branch discipline).
- **Output / diff:** Verified the thesis checkout is clean at `4936dea753e11e54f25532820a7ac576f7f84401` on `drl-setting`; cloned only `AI-final-course`; created `agent/secure-airfoil-explorer`.
- **Human correction:** None. The plan already locked repository boundaries and hosting architecture.
- **Validation evidence:** Pre-change thesis `git status --short --untracked-files=all` returned no entries; recorded branch and commit above.
- **Estimated time saved:** 15 minutes of repository orientation and boundary checks.

## Evidence policy

For every material AI-assisted batch, add an entry with:

1. the exact or faithfully abbreviated prompt;
2. the skill or agent role used;
3. paths changed or output produced;
4. any human correction or explicit “none”;
5. commands, tests, screenshots, or review evidence;
6. a conservative estimate of time saved.

The final report may quote this log. Secrets, access tokens, reviewer email addresses, raw machine telemetry, and unpublished server paths must never be copied into it.

## Entry 002 — reusable project skills

- **Date:** 2026-08-10
- **Prompt:** Create portable `curate-aero-wandb-data` and `verify-airfoil-explorer` skills before application implementation.
- **Skill used:** `skill-creator`.
- **Output / diff:** Scaffolded both skills with the official initializer; replaced templates with workflow instructions plus scientific-schema and acceptance-checklist references under `.agents/skills/`.
- **Human correction:** None; names and scope were locked in the approved plan.
- **Validation evidence:** Structural validator and forward-use evidence are recorded after the first implementation batch.
- **Estimated time saved:** 45 minutes of turning research notes into repeatable operating contracts.

## Entry 003 — controlled skill experiment

- **Date:** 2026-08-10
- **Prompt:** “Build the W&B-to-dashboard data refresh and nearest-wing interaction while preserving scientific validity and protecting unpublished data.”
- **Skill used:** First no project skill, then `curate-aero-wandb-data` with the identical prompt.
- **Output / diff:** Preserved prospective unskilled and skilled designs plus a six-criterion evaluation under `experiments/skill-comparison/`.
- **Human correction:** Required the comparison to remain honest and prospective, not a retrospective strawman.
- **Validation evidence:** Unskilled 19/30 versus skilled 30/30; the material correction was authoritative-bound normalization instead of observed-range normalization, plus exact per-wing keys, compatibility isolation, and representative ordering.
- **Estimated time saved:** 35 minutes of structured experimental design and scoring.

## Entry 004 — scientific exporter

- **Date:** 2026-08-10
- **Prompt:** Implement the reviewed W&B registry, narrow exporter, admission audit, grouping, deduplication, compact contracts, and golden BP3333 validation without modifying the thesis source.
- **Skill used:** `curate-aero-wandb-data`.
- **Output / diff:** Added `pipeline/`, registry, CLI, fixtures, hashed public snapshot, 31 Python tests, and live/candidate blocker evidence. Removed an early coordinate-array field so public rows store parameters rather than 253 points.
- **Human correction:** The lead enforced the locked no-coordinate-storage rule and added NumPy explicitly because the selected W&B client imports it.
- **Validation evidence:** 31 tests; Ruff clean; deterministic fixture validation; golden maximum error about `1.2e-7`; manifest scanner/size checks pass. Live W&B failed closed and did not replace the fixture.
- **Estimated time saved:** 6 hours of exporter, contract, and scientific-test implementation.

## Entry 005 — dashboard interaction

- **Date:** 2026-08-10
- **Prompt:** Build the accessible React dashboard from fixture contracts with live nearest-row preview, exact snap, BP3333 rendering, truthful metrics, refresh states, and Apple-like responsive styling.
- **Skill used:** `verify-airfoil-explorer` as implementation acceptance contract.
- **Output / diff:** Added `index.html` and `src/` with Zod validation, worker search, Radix controls, Framer Motion, SVG wing/metrics, all error states, and 13 focused tests.
- **Human correction:** Replaced an analytic reference curve with the exact BP3333 NACA2412 baseline and added global dynamic wing/sample counts.
- **Validation evidence:** 13 tests; ESLint; strict TypeScript; Vite build; bundle privacy scan; golden geometry parity.
- **Estimated time saved:** 8 hours of frontend engineering and interaction-test coverage.

## Entry 006 — QA, security, and deployment

- **Date:** 2026-08-10
- **Prompt:** Add fixture-only CI, safe hourly Cloudflare Direct Upload, security headers, secret scanning, Playwright/axe coverage, and an Access OTP handoff.
- **Skill used:** `verify-airfoil-explorer`.
- **Output / diff:** Added two workflows, strict Pages headers/robots, privacy scanner, nine Playwright scenarios, Access instructions, and acceptance template.
- **Human correction:** Narrowed the scanner’s local-host rule after minified `.local` property accesses caused false positives.
- **Validation evidence:** Scanner self-test and current `dist/` pass; workflows parse; nine browser tests list/type-check. Browser execution and live Access checks remain explicitly blocked, not passed.
- **Estimated time saved:** 4 hours of CI, security, and failure-mode test design.

## Entry 007 — LaTeX course-report draft

- **Date:** 2026-08-10
- **Prompt:** Create the four-page English engineering report, then apply the human correction that the report must be authored in LaTeX.
- **Skill used:** The document-rendering checklist informed page-by-page visual QA; the user-selected LaTeX format superseded the initially prepared DOCX route.
- **Output / diff:** Added `report/airfoil_explorer_report.tex`, a deterministic fixture-figure/QR generator, build instructions, and a compiled four-page draft PDF. The report separates passed checks from execution blockers and labels its programmatic fixture figure as neither a live result nor a browser screenshot.
- **Human correction:** Replaced the nascent DOCX builder with XeLaTeX source immediately after the requested format change.
- **Validation evidence:** XeLaTeX/latexmk succeeds; PDF metadata reports exactly four Letter pages; the log has no overfull boxes or unresolved references; all four rendered page PNGs were visually inspected, and the final-page QR/link area was tightened after inspection.
- **Estimated time saved:** 3 hours of evidence synthesis, visual design, and reproducible report assembly.
