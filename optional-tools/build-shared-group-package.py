#!/usr/bin/env python3
"""Build a complete distributable package with the shared-group UI enabled."""
from __future__ import annotations
import argparse, json, shutil, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def enable_group_ui(index_path: Path) -> None:
    text = index_path.read_text(encoding="utf-8")
    old_hint = "Select a student below to edit their details and answers. Each student receives a complete individual calculation before any group figure is produced."
    new_hint = "Select a student below to edit details and answers. Group outputs validate each student, pool correct and administered totals across eligible students, and create one shared course."
    text = text.replace(old_hint, new_hint)
    marker = '      <button class="btn" id="btn-export-input">Export input JSON</button>'
    buttons = marker + '\n      <button class="btn primary" id="btn-group-roadmap" disabled aria-disabled="true">Create group roadmap</button>\n      <button class="btn primary" id="btn-three-page-group-report" disabled aria-disabled="true">Create three page group report</button>'
    if "btn-group-roadmap" not in text:
        text = text.replace(marker, buttons)
    if 'js/group-shared.js' not in text:
        text = text.replace('<script src="js/engine.js"></script>', '<script src="js/engine.js"></script>\n<script src="js/group-shared.js"></script>')
    if 'js/grouproadmap.js' not in text:
        text = text.replace('<script src="js/twopage.js"></script>', '<script src="js/twopage.js"></script>\n<script src="js/grouproadmap.js"></script>\n<script src="js/groupreport.js"></script>')
    if 'js/group-ui.js' not in text:
        text = text.replace('<script src="js/app.js"></script>', '<script src="js/app.js"></script>\n<script src="js/group-ui.js"></script>')
    index_path.write_text(text, encoding="utf-8")


def build_config_js(package_root: Path) -> None:
    cfg = package_root / "config"
    master = json.loads((cfg / "master-config.json").read_text(encoding="utf-8"))
    files = master["files"]
    def load(rel: str):
        return json.loads((cfg / rel).read_text(encoding="utf-8"))
    data = {
        "lesson_catalog": load(files["lesson_catalog"]),
        "calculation_rules": load(files["calculation_rules"]),
        "brand_config": load(files["brand_config"]),
        "diagnostic_difficulty_maps": {},
        "diagnostic_templates": {},
    }
    for rel in files.get("diagnostic_difficulty_maps", []):
        item = load(rel); data["diagnostic_difficulty_maps"][item["template_id"]] = item
    for rel in files["diagnostic_templates"]:
        item = load(rel); data["diagnostic_templates"][item["test_id"]] = item
    output = "// GENERATED from /config/*.json. Do not edit manually.\nwindow.TP_CONFIG = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"
    (package_root / "app/js/config-data.js").write_text(output, encoding="utf-8")


def update_readme(package_root: Path) -> None:
    readme = package_root / "README.md"
    text = readme.read_text(encoding="utf-8")
    section = """

## One shared group roadmap and three-page report

For a loaded group case, use **Create group roadmap** or **Create three page group report**. The system validates every student, identifies exclusions, requires at least two eligible students, pools correct/administered totals, summarizes provided scores with population SD, and creates one shared 28-lesson course. Raw lesson and strategy requirements use the fixed 2.0 group instructional-time multiplier before existing group caps and final category rounding; hours are never added once per student. Lesson-level variation produces tiered-practice notes. See `docs/shared-group-roadmap.md` for the calculation and report contract.
"""
    if "## One shared group roadmap and three-page report" not in text:
        text += section
    readme.write_text(text, encoding="utf-8")


def build_verification_fixture(package_root: Path) -> Path:
    source = package_root / "examples/group-demo/case-input.json"
    group = json.loads(source.read_text(encoding="utf-8"))
    difficulty = json.loads((package_root / "config/diagnostic-difficulty-maps/diagnostic-exam-2026.json").read_text(encoding="utf-8"))["sections"]
    group["group_name"] = "October 2026 Shared Course"
    group["group_id"] = "TP-GRP-SHARED-2026-10"
    for student in group["students"]:
        for answer in student["diagnostic"]["answers"]:
            answer["difficulty"] = difficulty[answer["section"]][answer["module"]][str(answer["question_number"])]
    invalid = json.loads(json.dumps(group["students"][0]))
    invalid["student"]["student_name"] = "Noor Verification"
    invalid["student"]["student_id"] = "TP-EXCLUDED-DEMO"
    invalid["diagnostic"]["answers"] = [a for a in invalid["diagnostic"]["answers"] if not (a["section"] == "math" and a["module"] == "module_b")]
    group["students"].append(invalid)
    target = package_root / "examples/group-shared-demo/case-input.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(group, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return target


def build(output_zip: Path, keep_directory: Path | None = None) -> Path:
    temp = Path(tempfile.mkdtemp(prefix="testprep-shared-group-"))
    package = temp / "TestPrep_SAT_Roadmap_Master_v2.4.1"
    shutil.copytree(ROOT, package, ignore=shutil.ignore_patterns("output", "*.zip", "__pycache__", ".DS_Store"))
    enable_group_ui(package / "app/index.html")
    build_config_js(package)
    update_readme(package)
    build_verification_fixture(package)
    output_zip.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(package.rglob("*")):
            if path.is_file(): archive.write(path, Path(package.name) / path.relative_to(package))
    if keep_directory:
        if keep_directory.exists(): shutil.rmtree(keep_directory)
        shutil.copytree(package, keep_directory)
    shutil.rmtree(temp)
    return output_zip


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "output/TestPrep_SAT_Roadmap_Master_v2.4.1_Shared_Group.zip")
    parser.add_argument("--keep-directory", type=Path)
    args = parser.parse_args()
    print(build(args.output.resolve(), args.keep_directory.resolve() if args.keep_directory else None))
