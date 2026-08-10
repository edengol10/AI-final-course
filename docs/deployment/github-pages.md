# Public GitHub Pages deployment

## Publication boundary

GitHub Pages is a public static host. For this project it has no email allowlist,
OTP gate, or application-level privacy control. Anyone who knows or discovers the
URL can request both the HTML and its JSON assets. A private repository does not,
by itself, make the published site private.

The approved public scientific result profile contains only BP3333
geometry/parameters and per-wing `Cl`/`Cd`. All SPOD/modal values are stripped by
the exporter and are not rendered. Minimal technical provenance, replicate count,
curvature/admission metadata, and compatibility descriptors remain for auditability.

The expected project URL is <https://edengol10.github.io/AI-final-course/>. It is
an expected address, not evidence of a live deployment.

## One-time repository setup

1. Open **Repository Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Protect `main` against direct pushes and require fixture CI before merge.
4. In **Settings > Environments > github-pages**, restrict deployments to the
   default branch. Add a required reviewer if the repository plan supports it.
5. Leave repository variable `PUBLIC_RESEARCH_DATA_APPROVED` absent or `false`
   unless the research owner separately approves the restricted live profile for
   public release.

GitHub documents the setup under [Using custom workflows with GitHub
Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and explains Pages visibility under [Changing the visibility of your GitHub Pages
site](https://docs.github.com/en/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site).

## Default fixture deployment

`.github/workflows/deploy-production.yml` runs on pushes to `main` and manual
dispatch. It requires no repository secret and cannot read W&B. The build job:

1. replays only the committed narrow QA fixture with `--exclude-modal-data`;
2. requires `snapshotKind: synthetic-fixture` plus `modalDataIncluded: false` and
   validates the complete snapshot;
3. builds with `VITE_BASE_PATH=/AI-final-course/`;
4. self-tests the scanner and scans the exact `dist/` artifact;
5. uploads `dist/` with `actions/upload-pages-artifact`.

A dependent job deploys that artifact with `actions/deploy-pages`. If export,
validation, build, scan, or artifact upload fails, the deployment job is skipped.
This ordering is designed to preserve the preceding Pages release, but the claim
remains unverified until the failure drill below is executed.

## Optional restricted live-data publication

`.github/workflows/publish-approved-live-data.yml` runs hourly or manually, but
its build job is skipped unless repository variable
`PUBLIC_RESEARCH_DATA_APPROVED` is exactly `true`. A manual run must also target
`main`. After approval, add read-only `WANDB_API_KEY` under **Settings > Secrets
and variables > Actions > Secrets**.

Enabling this workflow is a publication decision: its sanitized JSON will be
available to everyone on the internet. The workflow uses the reviewed registry,
passes `--exclude-modal-data`, requires `snapshotKind: reviewed-wandb` plus
`modalDataIncluded: false`, validates and scans the artifact, and only then uploads it. The API key is supplied only to
the exporter and value-aware scanner; it is never a browser variable.

To disable live publication, set `PUBLIC_RESEARCH_DATA_APPROVED=false` or remove
the variable. Removing `WANDB_API_KEY` as well is recommended when the workflow is
not needed. Do not enable the gate merely to test W&B connectivity.

## Permissions and serialization

Both workflows deny token permissions by default and share the non-cancelling
`airfoil-github-pages-production` concurrency group. Build jobs receive
`contents: read` plus `pages: read` for Pages metadata configuration; deployment
jobs receive only `pages: write` and `id-token: write`, target the `github-pages`
environment, and use the official Pages artifact/deployment actions.

## Deployment acceptance

Do not mark GitHub Pages passed until a workflow has run and all applicable items
are recorded in a dated copy of `docs/qa/acceptance-template.md`:

- [ ] Repository Pages source is **GitHub Actions**.
- [ ] The default workflow deploys from `main` with no secret references.
- [ ] The deployed manifest declares `snapshotKind: synthetic-fixture` and
      `modalDataIncluded: false`.
- [ ] The expected URL, `/AI-final-course/data/manifest.json`, and one
      manifest-listed shard return successfully.
- [ ] The UI visibly labels the synthetic fixture and renders no SPOD/modal values.
- [ ] The public artifact contains geometry/parameters and `Cl`/`Cd`, no modal
      values, no W&B entity/project names, and no credential or local path.
- [ ] Desktop and mobile browser checks pass at the project subpath.
- [ ] The `github-pages` environment and `main` branch protections are enabled.

A successful public `200` is expected; there is no unauthenticated-denial or OTP
test. `robots.txt` is advisory and must not be recorded as access control.

## Last-good-deployment failure drill

Run the drill only with the synthetic fixture:

1. Record the current Pages deployment ID and confirm the fixture URL and one data
   shard load.
2. On a temporary branch/workflow copy, force validation or scanning to fail and
   confirm the deploy job is skipped and the recorded deployment remains served.
3. Force an artifact-upload failure without changing the deployed data and confirm
   the recorded deployment remains served.
4. Remove the deliberate failure and record only deployment IDs and outcomes.

Do not expose workflow tokens, W&B keys, live JSON bodies, or unpublished research
in logs or screenshots. Repository-only review marks this drill `blocked` until it
has actually run.
