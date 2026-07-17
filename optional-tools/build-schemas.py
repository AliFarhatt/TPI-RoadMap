#!/usr/bin/env python3
"""Validate the authoritative v2.4 JSON Schemas without regenerating legacy values.

The schemas in ../schemas are maintained as source files. This helper deliberately
does not synthesize them, which prevents an old generator from restoring the former
former course-limit policies or lesson-level rounding rules.
"""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "schemas"
failed = []
for path in sorted(SCHEMAS.glob("*.json")):
    try:
        json.loads(path.read_text(encoding="utf-8"))
        print(f"OK  {path.relative_to(ROOT)}")
    except Exception as exc:
        failed.append((path, exc))
        print(f"FAIL {path.relative_to(ROOT)}: {exc}")
if failed:
    sys.exit(1)
print(f"Validated {len(list(SCHEMAS.glob('*.json')))} schema files.")
