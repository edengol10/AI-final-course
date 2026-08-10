---
name: verify-airfoil-explorer
description: Verify the Airfoil Explorer’s scientific row consistency, drag-preview-snap behavior, BP3333 rendering, accessibility, responsive visual quality, refresh semantics, public Cl/Cd release boundary, and GitHub Pages deployment. Use before merging, publishing a snapshot, submitting the course report, or diagnosing dashboard regressions.
---

# Verify Airfoil Explorer

Run this acceptance workflow after material data, interaction, layout, security, or deployment changes. Use fixture mode first; production checks are additive and must never expose or log credentials or unpublished fields.

## Required reference

Read [acceptance-checklist.md](references/acceptance-checklist.md) before testing. Record every applicable item as pass, fail, blocked, or not applicable with evidence; an untested production control is not a pass.

## Verification sequence

1. **Static contracts:** type-check, lint, validate manifest/data with Zod, verify hashes and chunk sizes, and scan the built output for secrets and private paths.
2. **Scientific geometry:** compare TypeScript BP3333 output with committed golden fixtures, require 253 finite chord-normalized points, equal-axis plotting, and a clearly distinct NACA2412 reference overlay.
3. **Nearest-wing logic:** unit-test normalized bounds, inactive parameters, stable ties, duplicates, empty groups, and dataset replacement. Confirm all preview metrics and provenance come from the same row.
4. **Interaction contract:** during pointer, touch, and keyboard changes, update the nearest candidate live. On commit, animate every active slider to the candidate’s exact vector. Confirm no aerodynamic interpolation occurs.
5. **Refresh contract:** verify cache-busted manifest requests, unchanged/newer/malformed/offline outcomes, atomic dataset replacement, and nearest-wing reselection. The browser must never contact W&B.
6. **Inclusive UX:** run automated accessibility checks plus keyboard-only review, visible focus, meaningful names, touch targets, contrast, reduced motion, dark mode, and screen-reader status announcements.
7. **Visual QA:** use the in-app browser at desktop and narrow mobile sizes. Inspect rather than infer. Capture the final dashboard and repair clipping, misleading scales, overlap, layout shift, or unreadable labels.
8. **Public release boundary:** confirm GitHub Pages serves HTML and JSON publicly, the manifest declares `modalDataIncluded=false`, every modal value is absent or null, modal cards are not rendered, W&B credentials/entity/project and local paths are absent, and the UI labels synthetic fixtures truthfully. Verify the HTML meta CSP/referrer/robots policy and `robots.txt`, while recording that Pages supplies no project authentication or custom repository-defined response headers.
9. **Failure safety:** force exporter/validation/deploy failures in a non-production test and confirm the last verified deployment remains available.

## Non-negotiable assertions

- One visible public state equals one `WingRecord`: wing, all sliders, `Cl`, `Cd`, and provenance agree. For a separately validated modal-enabled private snapshot, both peaks must agree with that same row too.
- Slider release snaps to database values exactly; ghost markers may show the user’s requested position but never masquerade as measured data.
- Signed `Cl`/`Cd` bars share a truthful zero baseline and use actual coefficients.
- A modal-enabled private snapshot uses labels “1st frequency peak — SPOD mode 1” and “2nd frequency peak — SPOD mode 1” with `TU⁻¹`; the public Cl/Cd profile renders neither card.
- Counts, last-sync time, stale/error status, and applicable data availability come from the validated snapshot.
- GitHub Pages is public. A client-side password dialog, `robots.txt`, or a private source repository is not access control; do not publish a field that requires confidentiality.

## Evidence output

Store test summaries, screenshots, relevant trace/video paths, and manual production results under `docs/qa/`. Add a concise entry to `docs/ai-evidence/work-log.md`. Never mark Pages settings, a deployment, public URL checks, browser execution, or a last-good-deployment drill as passed without direct evidence; mark them blocked with the exact handoff required.
