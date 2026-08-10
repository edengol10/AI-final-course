# Airfoil Explorer acceptance record — YYYY-MM-DD

Copy this file for each release candidate. Use only `pass`, `fail`, `blocked`, or
`not applicable`. A blank result is untested, not a pass. Evidence must not
contain secrets, reviewer emails, private hostnames/paths, Access cookies, OTPs,
or live snapshot bodies.

## Context

| Field | Value |
| --- | --- |
| Commit | `<git SHA>` |
| Fixture snapshot/checksum | `<fixture identifier and checksum>` |
| Node / Python | `<versions>` |
| Browser / viewport | `<browser and dimensions>` |
| Production target | `<redacted target category or deployment ID>` |
| Tester | `<role, not personal email>` |

## Fixture and build checks

| Check | Result | Evidence |
| --- | --- | --- |
| Exporter accepts good fixtures and rejects documented bad reasons |  |  |
| Repeated fixture export is deterministic; manifest checksums match |  |  |
| Every dataset chunk is smaller than 10 MiB |  |  |
| TypeScript, lint, unit/component tests, and production build pass |  |  |
| Browser Zod validation precedes atomic replacement |  |  |
| Built output privacy/secret scan passes |  |  |

## Science and row consistency

| Check | Result | Evidence |
| --- | --- | --- |
| BP3333 golden comparison is within `1e-5` and yields 253 finite points |  |  |
| Plot axes are equal and the reference overlay remains distinct |  |  |
| Active/fixed parameter treatment is accurate |  |  |
| Normalized nearest distance and deterministic ties pass |  |  |
| Wing, sliders, metrics, peaks, curvature, and provenance use one row |  |  |
| Missing frequencies are explicitly unavailable |  |  |

## Interaction and refresh

| Check | Result | Evidence |
| --- | --- | --- |
| Pointer, touch, and keyboard changes update live preview |  |  |
| Ghost/requested markers differ from measured selection |  |  |
| Commit snaps all active controls to the exact selected vector |  |  |
| No metric interpolation is present |  |  |
| Refresh cache-busts only `manifest.json`; browser never contacts W&B |  |  |
| Unchanged/newer/malformed/stale/offline states are announced |  |  |
| Valid new data swaps atomically and nearest row is reselected |  |  |

## Accessibility and visual QA

| Check | Result | Evidence |
| --- | --- | --- |
| Landmarks, headings, names, values, and automated accessibility pass |  |  |
| Keyboard-only use, focus visibility, and trap checks pass |  |  |
| Touch targets, contrast, announcements, and recovery pass |  |  |
| Reduced motion and automatic dark mode pass |  |  |
| Desktop and mobile show no clipping, overlap, distortion, or shift |  |  |
| Loading, empty, stale, missing, malformed, and offline states reviewed |  |  |

## Delivery, Access, and failure safety

| Check | Result | Evidence |
| --- | --- | --- |
| Pull-request CI is fixture-only and has no secrets |  |  |
| Production workflow permissions/triggers/concurrency/order are correct |  |  |
| Production and wildcard preview Access apps are default-deny |  |  |
| Unauthenticated production and preview HTML/JSON are denied |  |  |
| Allowlisted OTP succeeds for production and preview HTML/JSON |  |  |
| CSP, anti-frame, nosniff, referrer, noindex, and robots controls pass |  |  |
| Forced pre-upload/upload failure leaves last verified deployment live |  |  |
| Logs, screenshots, traces, report, and repository contain no credentials |  |  |

## Blockers and handoff

| Blocked item | Exact deployment-time input/action required | Owner |
| --- | --- | --- |
|  |  |  |
