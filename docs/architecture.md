# Architecture

GitHub Pages serves a public static React application. The browser fetches a checksum-validated manifest and hashed data chunks, reconstructs BP3333 geometry locally, and searches the selected compatibility group in a Web Worker. A drag previews the nearest saved row; release snaps the controls to that exact vector. No aerodynamic quantity is interpolated.

The export boundary is intentionally narrow: the static artifact contains BP3333 parameters, per-wing `Cl`/`Cd`, validity information, compatibility labels, minimal provenance, replicate counts, and checksums. Credentials, local paths, raw artifacts, media, models, and undeclared research outputs never reach the build.

Fixture deployments are deterministic. The optional reviewed W&B path scans only the approved narrow history fields, validates each row, groups compatible cases, retains every accepted iteration as an interactive row, counts exact float32 geometries separately, validates the complete staging tree, and atomically replaces the snapshot only after validation succeeds.
