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
- [ ] In the public profile, wing path, all slider values, `Cl`, `Cd`, and provenance resolve to the same record at every state.
- [ ] The public manifest declares `modalDataIncluded: false`, every modal value is absent or null, and no frequency or modal card is rendered.
- [ ] If a modal-enabled private snapshot is tested, both mode-1 peaks and curvature resolve to the same record; missing frequencies display unavailable rather than zero or a fabricated value.

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
- [ ] Loading, empty, stale, malformed, and offline states are visually reviewed; missing-frequency is reviewed only for a modal-enabled private snapshot.

## Delivery, access, and failure safety

- [ ] PR CI uses fixtures and no secrets.
- [ ] Default Pages deployment is fixture-only and secret-free; optional live publication has hourly/manual triggers and is gated by explicit public-release approval plus `WANDB_API_KEY`.
- [ ] Build jobs have only `contents: read` and `pages: read`; deploy jobs have only `pages: write` and `id-token: write`; both deployment workflows serialize and validate/scan before upload.
- [ ] Repository Pages source is GitHub Actions, the `github-pages` environment is restricted to `main`, and the expected project-subpath URL plus a hashed dataset return successfully.
- [ ] Public HTML and JSON are expected to return without authentication; no OTP, allowlist, client password, `robots.txt`, or private-repository claim is presented as access control.
- [ ] The HTML meta CSP/referrer/robots policy and `robots.txt` are present; limitations of GitHub Pages response-header control are recorded truthfully.
- [ ] A forced export, validation, or upload failure leaves the preceding verified deployment live.
- [ ] Reviewer credentials and secret values are absent from logs, screenshots, traces, videos, report, and repository.
