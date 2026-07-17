#!/usr/bin/env python3
"""Formal Draft-07 validation of the generated Elmy import-ready case."""
from pathlib import Path
import json
import sys

try:
    from jsonschema import Draft7Validator
except ImportError:
    print("SKIP: install the development-only 'jsonschema' Python package to run this check.")
    sys.exit(0)

ROOT = Path(__file__).resolve().parents[2]
data_path = ROOT / "examples" / "individual-demo" / "nayla-elmy-imported-case.json"
schema_path = ROOT / "schemas" / "individual-input.schema.json"
data = json.loads(data_path.read_text(encoding="utf-8"))
schema = json.loads(schema_path.read_text(encoding="utf-8"))
errors = sorted(Draft7Validator(schema).iter_errors(data), key=lambda error: list(error.path))
if errors:
    print(f"FAIL {data_path.relative_to(ROOT)} against {schema_path.relative_to(ROOT)}")
    for error in errors[:20]:
        print(f"  {list(error.path)}: {error.message}")
    print("\n==== 0 passed, 1 failed ====")
    sys.exit(1)
print(f"OK   {data_path.relative_to(ROOT)} against {schema_path.relative_to(ROOT)}")
print("\n==== 1 passed, 0 failed ====")
