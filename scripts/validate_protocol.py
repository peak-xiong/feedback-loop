#!/usr/bin/env python3
"""
Validate protocol schemas in packages/protocol/schemas.
Checks JSON parseability and minimal required schema fields.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_TOP_KEYS = {"$schema", "title", "type"}


def validate_schema(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        return [f"{path}: invalid JSON ({e})"]

    missing = REQUIRED_TOP_KEYS - set(data.keys())
    if missing:
        errors.append(f"{path}: missing keys {sorted(missing)}")

    if data.get("type") != "object":
        errors.append(f"{path}: root type must be 'object'")

    if "properties" not in data or not isinstance(data.get("properties"), dict):
        errors.append(f"{path}: missing or invalid 'properties'")

    return errors


def main() -> int:
    root = Path(__file__).parent.parent.resolve()
    schema_dir = root / "packages" / "protocol" / "schemas"
    if not schema_dir.exists():
        print(f"[ERROR] schema directory not found: {schema_dir}")
        return 1

    files = sorted(schema_dir.glob("*.json"))
    if not files:
        print(f"[ERROR] no schema files found in: {schema_dir}")
        return 1

    all_errors: list[str] = []
    for f in files:
        all_errors.extend(validate_schema(f))

    if all_errors:
        print("[FAIL] protocol validation failed:")
        for err in all_errors:
            print(f"  - {err}")
        return 1

    print(f"[OK] validated {len(files)} schema file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
