# Live W&B probe — explicit blocker

Date: 2026-08-10 (Asia/Jerusalem)

The live path was attempted only after the W&B client detected existing stored authentication. No credential value or credential file was read by the exporter, requested from the user, or written to repository output.

## Outcomes

- Candidate audit of `sjhhvgd6`, `elstxotw`, `1n93x16f`, `syqss1sr`, `ud0cqk5m`, and `y44fmpfc` failed safely with the client-level error class `CommError`. No live audit file was published and no candidate was added to the reviewed registry.
- The reviewed-run export probe did not return publishable narrow-history rows. A zero-record result was produced only in a temporary directory and was not copied into `public/data`.
- The exporter now explicitly rejects a finished reviewed run with zero narrow-history rows or zero scientifically admitted rows. This prevents an apparently valid empty snapshot from replacing the fixture-backed deployment.
- `public/data` remains the deterministic fixture export: 8 admitted samples, 7 float32-unique geometries, 5 contributing reviewed runs, and 6 rejection events with stable reason accounting.

## Reproducible offline path

```bash
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -B scripts/export_snapshot.py fixture \
  --registry config/wandb-runs.yaml \
  --fixture tests/fixtures/wandb_history_v1.json \
  --output public/data \
  --generated-at 2026-08-10T00:00:00Z

PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -B scripts/export_snapshot.py validate \
  --manifest public/data/manifest.json
```

The candidate fixture audit is recorded in `candidate-audit-fixture.json`; every candidate remains `PENDING_FRESH_AUDIT` with `autoAdded: false`.
