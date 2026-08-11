from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from .constants import MAX_PUBLIC_FILE_BYTES
from .models import ContractModel, SnapshotManifestV1, public_model_dict

_FORBIDDEN_PATTERNS: tuple[tuple[str, re.Pattern[bytes]], ...] = (
    ("home path", re.compile(rb"(?:/Users/|/home/|[A-Za-z]:\\Users\\)", re.IGNORECASE)),
    (
        "secret-like field",
        re.compile(
            rb'"(?:api[_-]?key|access[_-]?token|password|credential|hostname|host|gpu|artifact[^\"]*)"\s*:',
            re.IGNORECASE,
        ),
    ),
    (
        "secret-like token",
        re.compile(rb"(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16})"),
    ),
    ("curvature diagnostic", re.compile(rb"(?:[A-Za-z_]*curvature[A-Za-z_]*|curvatureRatio)\b", re.IGNORECASE)),
    ("tokenized URL", re.compile(rb"https?://[^\s\"]+[?&](?:token|key|signature)=", re.IGNORECASE)),
)


def canonical_json_bytes(value: Any) -> bytes:
    if isinstance(value, ContractModel):
        value = public_model_dict(value)
    return json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def manifest_canonical_sha256(manifest: SnapshotManifestV1) -> str:
    payload = public_model_dict(manifest)
    payload.pop("canonicalSha256", None)
    return sha256_hex(canonical_json_bytes(payload))


def scan_public_bytes(data: bytes, *, label: str) -> None:
    for reason, pattern in _FORBIDDEN_PATTERNS:
        if pattern.search(data):
            raise ValueError(f"{label} contains forbidden {reason}")


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{path.name}.", dir=path.parent, delete=False
        ) as handle:
            temporary = Path(handle.name)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def verify_public_file_bytes(data: bytes, *, label: str) -> None:
    if not data:
        raise ValueError(f"{label} is empty")
    if len(data) >= MAX_PUBLIC_FILE_BYTES:
        raise ValueError(f"{label} must be smaller than 10 MiB")
    scan_public_bytes(data, label=label)
