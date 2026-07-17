# Adding a diagnostic test

1. Copy `config/diagnostic-templates/kaplan-practice-test-2.json` to a new file with a new stable snake_case `test_id` (e.g. `kaplan_practice_test_3`). A mapping is never reused across ids: the Kaplan PT2 mapping applies only to `kaplan_practice_test_2`.
2. Fill sections/modules/question counts and one entry per question: `section, module, question_number, lesson_id` (must exist in `lesson-catalog.json`), `subskill_id`, and — only when genuinely known — `question_style`, `difficulty`, `expected_time_seconds`, `correct_answer`. Unknown values stay `null`; never invent metadata.
3. Validate against `schemas/diagnostic-template.schema.json`.
4. Register it for the offline app: add the file to `config/master-config.json` and rebuild the JS mirror with `python3 optional-tools/build-config-js.py` (or add the object to `diagnostic_templates` in `app/js/config-data.js` by hand).
5. The template appears automatically in the app's template dropdown; question tables, coverage, and validation adapt to its counts and mapping. Lessons with no questions are treated as "not assessed" with full base hours — exactly as the rules require.

Editing mappings or lesson configuration: change the JSON in `config/`, rebuild the mirror, and re-run `node tests/unit/engine.test.js` — the suite asserts the rubric still reproduces the reference base hours and that all 28 lesson IDs stay intact.
