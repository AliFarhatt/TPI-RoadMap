#!/usr/bin/env python3
"""Validate shipped examples and configuration against the package schemas."""
from pathlib import Path
import json
import sys
import warnings

warnings.filterwarnings("ignore", message="jsonschema.RefResolver is deprecated")
from jsonschema import Draft7Validator, RefResolver  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "schemas"
PAIRS = [
    ("config/calculation-rules.json", "schemas/planning-rules.schema.json"),
    ("config/diagnostic-templates/kaplan-practice-test-2.json", "schemas/diagnostic-template.schema.json"),
    ("examples/individual-demo/case-input.json", "schemas/individual-input.schema.json"),
    ("examples/individual-demo/nayla-elmy-imported-case.json", "schemas/individual-input.schema.json"),
    ("examples/individual-demo/calculated-results.json", "schemas/individual-results.schema.json"),
    ("examples/individual-demo/roadmap-view-model.json", "schemas/roadmap-view-model.schema.json"),
    ("examples/group-demo/case-input.json", "schemas/group-input.schema.json"),
    ("examples/group-demo/group-results.json", "schemas/group-results.schema.json"),
]

store = {}
for path in SCHEMA_DIR.glob("*.json"):
    schema = json.loads(path.read_text(encoding="utf-8"))
    store[path.name] = schema
    store[path.as_uri()] = schema
    if schema.get("$id"):
        store[schema["$id"]] = schema

passed = failed = 0
for data_rel, schema_rel in PAIRS:
    data_path, schema_path = ROOT / data_rel, ROOT / schema_rel
    data = json.loads(data_path.read_text(encoding="utf-8"))
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    resolver = RefResolver(base_uri=SCHEMA_DIR.as_uri() + "/", referrer=schema, store=store)
    errors = sorted(Draft7Validator(schema, resolver=resolver).iter_errors(data), key=lambda e: list(e.path))
    if errors:
        failed += 1
        print(f"FAIL {data_rel} against {schema_rel}")
        for error in errors[:20]:
            print(f"  {list(error.path)}: {error.message}")
    else:
        passed += 1
        print(f"OK   {data_rel} against {schema_rel}")

print(f"\n==== {passed} passed, {failed} failed ====")
sys.exit(1 if failed else 0)
