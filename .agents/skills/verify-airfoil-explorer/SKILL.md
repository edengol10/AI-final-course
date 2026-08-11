---
name: verify-airfoil-explorer
description: Verify the Airfoil Explorer interaction, row consistency, accessibility, visual quality, refresh behavior, and public-release boundary. Use before shipping dashboard or data-pipeline changes.
---

# Verify Airfoil Explorer

1. Validate manifest/data checksums and schema contracts before rendering.
2. Confirm a drag updates the wing preview and nearest saved row; release must snap all sliders to that row’s exact parameters.
3. Confirm wing, `Cl`, `Cd`, and provenance always come from one record and are never interpolated.
4. Test mouse, touch, keyboard focus, reduced motion, responsive layout, loading, empty, stale, malformed, refresh, and offline states.
5. Scan build output for credentials, tokens, local paths, raw artifacts, W&B namespace, and undeclared data. Confirm HTML and JSON are served only through the intended Pages build.
