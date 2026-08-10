from __future__ import annotations

from datetime import datetime
from typing import Any

from .constants import ACTION_KEYS, AERO_CD_KEY, AERO_CL_KEY, CURVATURE_KEY, INVALID_GEOMETRY_KEY
from .models import RunRegistryV1
from .source import HistorySource


def audit_candidates(
    *, registry: RunRegistryV1, source: HistorySource, generated_at: datetime
) -> dict[str, Any]:
    reports: list[dict[str, Any]] = []
    for candidate in registry.candidate_runs:
        try:
            source_run = source.read_run(candidate.run_id)
        except (KeyError, RuntimeError) as exc:
            reports.append(
                {
                    "runId": candidate.run_id,
                    "auditStatus": "unavailable",
                    "exclusionReason": candidate.exclusion_reason,
                    "detail": type(exc).__name__,
                    "autoAdded": False,
                }
            )
            continue
        observed = sorted({key for row in source_run.rows for key in row})
        action_keys = [key for key in ACTION_KEYS.values() if key in observed]
        reports.append(
            {
                "runId": candidate.run_id,
                "state": source_run.state,
                "historyRowCount": len(source_run.rows),
                "observedHistoryKeys": observed,
                "observedActionKeys": action_keys,
                "hasPerWingAero": AERO_CL_KEY in observed and AERO_CD_KEY in observed,
                "hasGeometryValidity": (
                    CURVATURE_KEY in observed and INVALID_GEOMETRY_KEY in observed
                ),
                "auditStatus": "requires-manual-review",
                "exclusionReason": candidate.exclusion_reason,
                "autoAdded": False,
            }
        )
    return {
        "schemaVersion": "candidate-run-audit-v1",
        "generatedAt": generated_at.isoformat().replace("+00:00", "Z"),
        "source": {"entity": registry.entity, "project": registry.project},
        "candidates": reports,
    }
