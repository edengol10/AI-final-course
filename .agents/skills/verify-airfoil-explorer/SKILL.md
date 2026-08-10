---
name: verify-airfoil-explorer
description: Verify the Airfoil Explorer’s scientific row consistency, drag-preview-snap behavior, BP3333 rendering, accessibility, responsive visual quality, refresh semantics, privacy controls, and Cloudflare Access deployment. Use before merging, publishing a snapshot, submitting the course report, or diagnosing dashboard regressions.
---

# Verify Airfoil Explorer

Run this acceptance workflow after material data, interaction, layout, security, or deployment changes. Use fixture mode first; production checks are additive and must never expose or log reviewer credentials.

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
8. **Production security:** from an unauthenticated session confirm both HTML and JSON are denied by Cloudflare Access; from an allowlisted session confirm OTP entry and short-lived access. Verify CSP, anti-framing, MIME sniffing prevention, strict referrer policy, noindex headers, and `robots.txt`.
9. **Failure safety:** force exporter/validation/deploy failures in a non-production test and confirm the last verified deployment remains available.

## Non-negotiable assertions

- One visible state equals one `WingRecord`: wing, all sliders, `Cl`, `Cd`, both peaks, and provenance agree.
- Slider release snaps to database values exactly; ghost markers may show the user’s requested position but never masquerade as measured data.
- Signed `Cl`/`Cd` bars share a truthful zero baseline and use actual coefficients.
- Labels read “1st frequency peak — SPOD mode 1” and “2nd frequency peak — SPOD mode 1” with `TU⁻¹`.
- Counts, last-sync time, stale/error status, and frequency availability come from the validated snapshot.
- A client-side password dialog is not access control. Static assets and JSON require the same server-side Access policy as HTML.

## Evidence output

Store test summaries, screenshots, relevant trace/video paths, and manual production results under `docs/qa/`. Add a concise entry to `docs/ai-evidence/work-log.md`. Never mark missing Cloudflare credentials or reviewer emails as passed; mark those items blocked with the exact handoff required.
