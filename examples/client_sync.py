#!/usr/bin/env python
"""Minimal client sync example for weekly manifest checks."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen


def fetch_json(url: str) -> dict:
    req = Request(url, method="GET")
    with urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def download_file(url: str, output_path: Path) -> None:
    req = Request(url, method="GET")
    with urlopen(req, timeout=60) as response:
        output_path.write_bytes(response.read())


def load_state(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def pick_export_url(manifest: dict, export_format: str) -> str:
    for artifact in manifest.get("exports", []):
        if artifact.get("export_format") == export_format:
            return artifact["url"]
    raise RuntimeError(f"No export url found for format={export_format}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest-url",
        default="https://wordlistmanager-production.up.railway.app/api/v1/manifest",
    )
    parser.add_argument("--format", choices=["csv", "json"], default="json")
    parser.add_argument("--output-dir", default="./downloads")
    parser.add_argument("--state-file", default="./downloads/wordlist_state.json")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    state_file = Path(args.state_file)
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = fetch_json(args.manifest_url)
    version = manifest.get("version_number")
    checksum = manifest.get("checksum_sha256")
    if not version or not checksum:
        print("No published dataset found yet.")
        return 1

    state = load_state(state_file)
    if state.get("checksum_sha256") == checksum:
        print(f"Up to date (version v{version}).")
        return 0

    export_url = pick_export_url(manifest, args.format)
    output_path = output_dir / f"wordlist_v{version}.{args.format}"
    download_file(export_url, output_path)

    state.update(
        {
            "version_number": version,
            "checksum_sha256": checksum,
            "format": args.format,
            "file_path": str(output_path),
        }
    )
    save_state(state_file, state)
    print(f"Downloaded version v{version} -> {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
