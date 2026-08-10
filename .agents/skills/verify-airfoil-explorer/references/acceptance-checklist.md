# Airfoil Explorer acceptance checklist

## Fixture and build checks

- [ ] Python exporter models validate good fixtures and reject every documented reason.
- [ ] Repeated fixture export is deterministic; manifest checksums match canonical dataset bytes.
- [ ] No dataset chunk is 10 MiB or larger.
- [ ] TypeScript compiles strictly; lint, unit, component, and production builds pass.
- [ ] Manifest and all dataset chunks pass browser-side Zod validation before state replacement.
- [ ] Built files contain no token-like values, credentials, private home paths, hostnames, raw W&B metadata, model/media filenames, or GPU telemetry.

## Science and row consistency

- [ ] BP3333 TypeScript output matches golden Python fixtures to `1e-5` and contains 253 finite points.
- [ ] Geometry axes are equal; airfoil and reference overlay are not distorted by responsive layout.
- [ ] Only active parameters appear as editable sliders; fixed parameters remain visible in provenance/details.
- [ ] Nearest distance is normalized by authoritative bounds and uses stable deterministic ties.
- [ ] Wing path, all slider values, `Cl`, `Cd`, two mode-1 peaks, curvature, and provenance resolve to the same record at every state.
- [ ] Missing frequencies display an explicit unavailable state and never zero or fabricated values.

## Interaction and refresh

- [ ] Pointer, touch, and keyboard movement updates the nearest candidate during drag.
- [ ] Ghost markers distinguish requested values from the selected measured wing.
- [ ] Release/commit snaps every active slider to the exact selected vector.
- [ ] No metric is interpolated between records.
- [ ] Refresh cache-busts only `manifest.json`; it never sends a request to W&B.
- [ ] Unchanged, newer, malformed, exporter-failure/stale, and offline cases have clear screen-reader-announced status.
- [ ] New data is validated fully and swapped atomically, then the nearest wing is reselected.

## Accessibility and responsive visual QA

- [ ] Landmarks and heading order are meaningful; every control has an accessible name and current value.
- [ ] Entire interaction works keyboard-only with visible focus and no trap.
- [ ] Touch targets, contrast, status announcements, and error recovery are adequate.
- [ ] Reduced motion disables nonessential springs; automatic dark mode remains legible.
- [ ] At desktop and mobile widths there is no clipping, overlap, misleading bar scale, layout shift, or unreadable provenance.
- [ ] Loading, empty, stale, missing-frequency, malformed, and offline states are visually reviewed.

## Delivery, access, and failure safety

- [ ] PR CI uses fixtures and no secrets.
- [ ] Production workflow has `contents: read`, concurrency protection, hourly/manual triggers, validation before deploy, and direct Pages upload.
- [ ] Production and preview hostnames have default-deny Cloudflare Access with explicit email allowlist and short-lived OTP.
- [ ] An unauthenticated session is denied for both `/` and a hashed dataset JSON; an allowlisted session succeeds for both.
- [ ] CSP, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, strict referrer policy, `X-Robots-Tag: noindex`, and `robots.txt` are present.
- [ ] A forced export, validation, or upload failure leaves the preceding verified deployment live.
- [ ] Reviewer credentials and secret values are absent from logs, screenshots, traces, videos, report, and repository.
