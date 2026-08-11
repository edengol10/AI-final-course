#!/usr/bin/env python3
"""Reject deploy artifacts that contain secrets or private research metadata.

The scanner deliberately reports only a rule name and location. It never prints
the matching text, which prevents a CI finding from turning into a secret leak.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import tempfile
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

MEBIBYTE = 1024 * 1024
DEFAULT_MAX_JSON_BYTES = 10 * MEBIBYTE


@dataclass(frozen=True)
class Rule:
    name: str
    pattern: re.Pattern[bytes]
    self_test_value: bytes


@dataclass(frozen=True, order=True)
class Finding:
    path: str
    line: int
    rule: str


RULES = (
    Rule(
        "private key material",
        re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        b"-----BEGIN PRIVATE KEY-----",
    ),
    Rule(
        "credential-bearing URL",
        re.compile(rb"(?i)https?://[^\s/'\"<>:@]+:[^\s/'\"<>@]+@"),
        b"https://build-user:build-password@example.invalid/",
    ),
    Rule(
        "authorization bearer token",
        re.compile(rb"(?i)\bauthorization\s*[:=]\s*['\"]?bearer\s+[a-z0-9._~+/-]{16,}"),
        b"Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345",
    ),
    Rule(
        "known token format",
        re.compile(
            rb"\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,})\b"
        ),
        b"ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    ),
    Rule(
        "assigned deployment secret",
        re.compile(
            rb"(?i)\b(?:WANDB_API_KEY|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)\b"
            rb"\s*[:=]\s*['\"]?[A-Za-z0-9._~+/-]{8,}"
        ),
        b"WANDB_API_KEY=abcdefghijklmnopqrstuvwxyz012345",
    ),
    Rule(
        "private POSIX home path",
        re.compile(rb"/(?:Users|home)/[^/\s'\"<>]+/"),
        b"/Users/researcher/private-data/run.json",
    ),
    Rule(
        "private Windows home path",
        re.compile(rb"(?i)\b[A-Z]:\\Users\\[^\\\s'\"<>]+\\"),
        br"C:\Users\researcher\private-data\run.json",
    ),
    Rule(
        "local or private hostname",
        re.compile(
            rb"(?i)(?:(?:https?:)?//|['\"])(?:localhost|127\.0\.0\.1|0\.0\.0\.0|"
            rb"[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:local|internal|lan))(?::\d+)?\b"
        ),
        b"https://research-workstation.internal",
    ),
    Rule(
        "raw W&B artifact metadata",
        re.compile(
            rb"(?i)(?:api\.wandb\.ai|wandb[-_](?:metadata|summary|history)|"
            rb"wandb/(?:latest-run|run-[^\s/'\"<>]+)|(?:^|[\s'\"])\_wandb(?:[\s'\"]|$))"
        ),
        b"wandb-summary.json",
    ),
    Rule(
        "model or research media filename",
        re.compile(
            rb"(?i)\b[^\s/'\"<>\\]+\."
            rb"(?:pt|pth|ckpt|onnx|h5|hdf5|npz|npy|mp4|avi|mov|vtk|vtu|cas)\b"
        ),
        b"policy-checkpoint.ckpt",
    ),
    Rule(
        "GPU telemetry",
        re.compile(
            rb"(?i)\b(?:nvidia-smi|CUDA_VISIBLE_DEVICES|system\.gpu(?:\.|\b)|"
            rb"gpu[._](?:temperature|memory|utilization|power)(?:\b|\.))"
        ),
        b"system.gpu.0.memoryAllocatedBytes",
    ),
    Rule(
        "email address",
        re.compile(rb"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"),
        b"reviewer@example.invalid",
    ),
)

PUBLIC_DATA_RULES = (
    Rule(
        "curvature diagnostic",
        re.compile(rb"(?:[A-Za-z_]*curvature[A-Za-z_]*|curvatureRatio)\b", re.IGNORECASE),
        b"CURVATURE_LIMIT",
    ),
)


def _line_number(content: bytes, offset: int) -> int:
    return content.count(b"\n", 0, offset) + 1


def _relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _scan_patterns(
    relative_path: str, content: bytes, rules: tuple[Rule, ...] = RULES
) -> Iterable[Finding]:
    for rule in rules:
        match = rule.pattern.search(content)
        if match:
            yield Finding(relative_path, _line_number(content, match.start()), rule.name)


def scan_directory(
    root: Path,
    *,
    forbidden_values: dict[str, str] | None = None,
    max_json_bytes: int = DEFAULT_MAX_JSON_BYTES,
) -> list[Finding]:
    """Return all privacy/security findings without exposing matching values."""

    findings: list[Finding] = []
    resolved_root = root.resolve(strict=True)
    if not resolved_root.is_dir():
        raise NotADirectoryError(root)

    for path in sorted(resolved_root.rglob("*")):
        relative_path = _relative(path, resolved_root)
        if path.is_symlink():
            findings.append(Finding(relative_path, 0, "symbolic link in deployment output"))
            continue
        if not path.is_file():
            continue

        if (
            path.suffix.lower() == ".json"
            and "data" in path.relative_to(resolved_root).parts
            and path.stat().st_size >= max_json_bytes
        ):
            findings.append(
                Finding(relative_path, 0, f"dataset JSON is {max_json_bytes} bytes or larger")
            )

        relative_bytes = relative_path.encode("utf-8", errors="surrogateescape")
        findings.extend(_scan_patterns(relative_path, relative_bytes))

        content = path.read_bytes()
        findings.extend(_scan_patterns(relative_path, content))
        if path.suffix.lower() == ".json" and "data" in path.relative_to(resolved_root).parts:
            findings.extend(_scan_patterns(relative_path, content, PUBLIC_DATA_RULES))

        for variable_name, value in (forbidden_values or {}).items():
            if value and len(value) >= 8 and value.encode() in content:
                findings.append(
                    Finding(relative_path, 0, f"value from environment variable {variable_name}")
                )

    return sorted(set(findings))


def _self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="airfoil-build-scan-") as temporary:
        root = Path(temporary)
        data = root / "data"
        data.mkdir()
        clean = root / "index.html"
        clean.write_text(
            "<!doctype html><title>Airfoil Explorer</title><script src='/assets/app.js'></script>",
            encoding="utf-8",
        )
        (data / "manifest.json").write_text('{"schemaVersion":1}', encoding="utf-8")
        assert not scan_directory(root), "clean fixture unexpectedly failed"

        probe = root / "probe.txt"
        for rule in RULES:
            probe.write_bytes(rule.self_test_value)
            found_rules = {finding.rule for finding in scan_directory(root)}
            assert rule.name in found_rules, f"rule did not fire: {rule.name}"
        probe.unlink()

        public_probe = data / "probe.json"
        for rule in PUBLIC_DATA_RULES:
            public_probe.write_bytes(rule.self_test_value)
            found_rules = {finding.rule for finding in scan_directory(root)}
            assert rule.name in found_rules, f"rule did not fire: {rule.name}"
        public_probe.unlink()

        secret_value = "self-test-secret-value-0123456789"
        clean.write_text(f"window.payload={secret_value!r}", encoding="utf-8")
        findings = scan_directory(root, forbidden_values={"SELF_TEST_SECRET": secret_value})
        assert any("SELF_TEST_SECRET" in finding.rule for finding in findings)

        clean.write_text("clean again", encoding="utf-8")
        oversized = data / "oversized.json"
        oversized.write_bytes(b"{}")
        findings = scan_directory(root, max_json_bytes=2)
        assert any("dataset JSON" in finding.rule for finding in findings)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", type=Path, help="built output directory to scan")
    parser.add_argument(
        "--secret-env",
        action="append",
        default=[],
        metavar="NAME",
        help="also reject the exact non-empty value of environment variable NAME",
    )
    parser.add_argument(
        "--max-json-bytes",
        type=int,
        default=DEFAULT_MAX_JSON_BYTES,
        help="reject data JSON at or above this size (default: 10 MiB)",
    )
    parser.add_argument("--self-test", action="store_true", help="run isolated scanner checks")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.self_test:
        _self_test()
        print("Build scanner self-test passed.")
        if args.root is None:
            return 0
    if args.root is None:
        _parser().error("root is required unless --self-test is used")
    if args.max_json_bytes <= 0:
        _parser().error("--max-json-bytes must be positive")

    forbidden_values = {name: os.environ.get(name, "") for name in args.secret_env}
    try:
        findings = scan_directory(
            args.root,
            forbidden_values=forbidden_values,
            max_json_bytes=args.max_json_bytes,
        )
    except (FileNotFoundError, NotADirectoryError) as error:
        print(f"Build scan could not start: {error}", file=sys.stderr)
        return 2

    if findings:
        for finding in findings:
            location = f"{finding.path}:{finding.line}" if finding.line else finding.path
            print(f"ERROR {location}: {finding.rule}", file=sys.stderr)
        print(f"Build scan failed with {len(findings)} finding(s).", file=sys.stderr)
        return 1

    print(f"Build scan passed: {args.root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
