# Local development

## Frontend fixture mode

```bash
npm install
npm run dev
```

The local app reads committed synthetic fixture snapshots. Fixture values exercise the same schema and interactions as production but are not presented as live thesis results.

Run checks with:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Exporter

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -m pytest
.venv/bin/ruff check pipeline tests/python
```

The live exporter requires `WANDB_API_KEY` in the process environment. It queries only registry-approved run IDs and selected history keys. Do not place keys in CLI arguments, files, fixtures, screenshots, logs, or browser code.

## Repository boundary check

Before and after work involving scientific references, record these read-only checks against the thesis checkout:

```bash
git -C /Users/edengolan/aero_shape_optimization status --short --untracked-files=all
git -C /Users/edengolan/aero_shape_optimization branch --show-current
git -C /Users/edengolan/aero_shape_optimization rev-parse HEAD
```

Expected branch/commit for this implementation is `drl-setting` at `4936dea753e11e54f25532820a7ac576f7f84401`, with no status entries. Never run dependency installation, code generation, tests that write caches, or Git mutations in that checkout.
