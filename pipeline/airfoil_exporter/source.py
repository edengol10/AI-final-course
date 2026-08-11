from __future__ import annotations

import json
import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from .constants import ALLOWED_HISTORY_KEYS, WAND_B_HISTORY_SAMPLES


@dataclass(frozen=True)
class SourceRun:
    run_id: str
    state: str
    rows: tuple[dict[str, Any], ...]


class HistorySource(Protocol):
    def read_run(self, run_id: str) -> SourceRun: ...


def _narrow_row(
    row: Mapping[str, Any], *, keys: tuple[str, ...] = ALLOWED_HISTORY_KEYS
) -> dict[str, Any]:
    return {key: row[key] for key in keys if key in row}


class FixtureHistorySource:
    def __init__(self, path: Path) -> None:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict) or raw.get("schemaVersion") != "wandb-history-fixture-v1":
            raise ValueError("fixture must use schemaVersion wandb-history-fixture-v1")
        runs = raw.get("runs")
        if not isinstance(runs, list):
            raise ValueError("fixture runs must be a list")
        parsed: dict[str, SourceRun] = {}
        allowed_fixture_keys = {"runId", "state", "rows"}
        for item in runs:
            if not isinstance(item, dict) or set(item) - allowed_fixture_keys:
                raise ValueError("fixture run contains undeclared fields")
            run_id = item.get("runId")
            state = item.get("state")
            rows = item.get("rows")
            if (
                not isinstance(run_id, str)
                or not isinstance(state, str)
                or not isinstance(rows, list)
            ):
                raise ValueError("fixture runId/state/rows have invalid types")
            if run_id in parsed:
                raise ValueError(f"duplicate fixture run: {run_id}")
            narrowed: list[dict[str, Any]] = []
            for row in rows:
                if not isinstance(row, dict):
                    raise ValueError(f"fixture row for {run_id} must be a mapping")
                undeclared = set(row) - set(ALLOWED_HISTORY_KEYS)
                if undeclared:
                    raise ValueError(
                        f"fixture row contains undeclared fields: {sorted(undeclared)}"
                    )
                narrowed.append(_narrow_row(row))
            parsed[run_id] = SourceRun(run_id=run_id, state=state, rows=tuple(narrowed))
        self._runs = parsed

    def read_run(self, run_id: str) -> SourceRun:
        try:
            return self._runs[run_id]
        except KeyError as exc:
            raise KeyError(f"run {run_id} is absent from the fixture") from exc


class WandbHistorySource:
    """Narrow W&B Public API adapter; deliberately exposes no config or summary."""

    def __init__(
        self,
        *,
        entity: str,
        project: str,
        timeout_seconds: int = 30,
    ) -> None:
        os.environ.setdefault("WANDB_SILENT", "true")
        os.environ.setdefault("WANDB_CONSOLE", "off")
        try:
            import wandb
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise RuntimeError("wandb is not installed; use fixture mode") from exc
        self._api = wandb.Api(timeout=timeout_seconds)
        self._entity = entity
        self._project = project
        self._history_keys = ALLOWED_HISTORY_KEYS

    def read_run(self, run_id: str) -> SourceRun:
        run = self._api.run(f"{self._entity}/{self._project}/{run_id}")
        state = str(run.state)
        if state.strip().lower() != "finished":
            return SourceRun(run_id=run_id, state=state, rows=())

        # W&B's combined history query is an intersection: if a run records
        # only the parameters changed in a sweep, requesting all ten action
        # fields hides otherwise valid iterations. Query every declared field
        # independently, then join only on the API-supplied global step.
        by_step: dict[int, dict[str, Any]] = {}
        for key in self._history_keys:
            if key == "_step":
                continue
            history = run.history(
                keys=[key],
                samples=WAND_B_HISTORY_SAMPLES,
                pandas=False,
            )
            for item in history:
                if not isinstance(item, Mapping):
                    continue
                raw_step = item.get("_step")
                try:
                    step = int(raw_step)
                except (TypeError, ValueError, OverflowError):
                    continue
                if step < 0 or key not in item:
                    continue
                row = by_step.setdefault(step, {"_step": step})
                row[key] = item[key]
        return SourceRun(
            run_id=run_id,
            state=state,
            rows=tuple(
                _narrow_row(by_step[step], keys=self._history_keys)
                for step in sorted(by_step)
            ),
        )
