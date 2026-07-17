# Field mapping: inputs vs calculated vs frozen

## Inputs (operator-supplied; schemas enforce this)
student_name, student_id, grade_level, known_foundational_gaps (lesson, severity, evidence), teacher_overrides (lesson, hours, reason), teacher_flagged_weak_subskills, score_source, reading_writing_scaled, math_scaled, total_scaled, target_sat_score, intended_test_date, weeks_available, preferred_sessions_per_week, max_session_length, session_format, accommodation, template_id, diagnostic date, answers (student_answer, correct_answer, difficulty, time_seconds, confidence, guessed, method, teacher_note, error_type), group_name/group_id/shared_schedule/instructor_notes.

## Elmy PDF-derived input fields

For the supported `Diagnostic Exam 2026` report, the local importer supplies only source facts: student name, attempt number, assessment title, class-derived season, diagnostic date, the three displayed scaled scores, reported answered/correct totals, and 98 answer records. Awarded `1 / 1` or `0 / 1` points becomes the explicit `correct` Boolean; it is not recomputed from answer-string equality. An em dash or blank response becomes `student_answer: null`.

Global questions 1–27, 28–54, 55–76, and 77–98 map respectively to English Module 1, English Module B, Math Module 1, and Math Module B with local numbering restarted in every module. Difficulty comes only from `config/diagnostic-difficulty-maps/diagnostic-exam-2026.json` and is always lowercase. Unsupported personal, goal, availability, timing, confidence, method, teacher, and error-type fields remain null or empty.

`source_validation` records parser identity/version, calculated versus reported totals, numbering and difficulty checks, missing/duplicate status, score-sum status, and source warnings. It is provenance, not a calculated lesson result.

## Prohibited as inputs (always generated; input schema rejects them)
score gap, overall accuracy, weighted accuracy, instruction hours, English/Math/strategy hours, strengths, weaknesses, blockers, pattern statement, lesson priorities, hour allocation, homework hours, number of weeks, course phases, group diversity, subgroup recommendations.

## Calculated (engine output)
Everything in `individual-results` / `group-results`: per-question weights/correctness/error types/interpretations; per-lesson accuracy, coverage, base hours, multipliers, adjustments, hours, sessions, priority, explanations; section summaries; totals with raw/final component sums, signed constraint allocation, homework transfer, and maximum-feasibility status; homework; schedule; strengths/priorities/error patterns; group lesson stats, diversity, group hours, compatibility, split recommendations; validation checks.

## Frozen (brand + design + rules)
brand-config.json (stats, logos, QR, Instagram, sister brands, editorial rules), the roadmap page design and fixed Performance Engine / tracking / ecosystem content, lesson-catalog.json, calculation-rules.json, and diagnostic difficulty maps.
