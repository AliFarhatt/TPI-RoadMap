# Changelog

## v2.4.1 — two-page report and fully automated Elmy PDF import

- Added the integrated **Import Elmy diagnostic PDF…** workflow for the 98-question Elmy `Diagnostic Exam 2026` Assessment Report. Parsing, validation, and case loading run locally in the browser without an upload, API, OCR, or internet connection.
- Bundled PDF.js 4.10.38 browser and worker builds locally under `app/vendor/pdfjs/` with the Apache-2.0 license.
- Added the dedicated `app/js/elmy-importer.js` parser module and parser registry, geometry-based answer-table reconstruction, page-one metadata extraction, correction-page fallback safeguards, points-based correctness, omitted-answer normalization, exact global-to-local conversion, and fail-closed ambiguity handling.
- Added the authoritative `config/diagnostic-difficulty-maps/diagnostic-exam-2026.json` source and embedded-config build support. All 98 records receive lowercase difficulty and the importer enforces the 22 easy / 35 medium / 41 hard checksum.
- Extended the individual input schema for attempt/title/reported summary, explicit answer correctness, and source-validation provenance without weakening unrelated validation.
- Added safe progress/status feedback, current-case replacement confirmation, and a compact validation review. Generated cases work with the existing analysis, JSON export/import, detailed report, seven-page roadmap, and two-page report.
- Added dedicated unit and genuine-PDF integration tests plus a generated representative import-ready case JSON. The private source PDF is not redistributed.

- Added a **Create two page report** button to the individual results panel; it opens a print-ready summary of exactly two A4 pages via the existing print-to-PDF workflow.
- New renderer module `app/js/twopage.js` (`TP_TWOPAGE`): report-data preparation, descriptive category calculations (sections, modules, easy/medium/hard difficulty with case-insensitive normalization), strength/priority ranking with a two-question minimum sample rule, adaptive interpretation text, filename generation, and input validation.
- Group cases show the button disabled with an explanation; missing or invalid cases produce a clear error message instead of failing silently.
- Added a section × difficulty accuracy heat map to page 2 of the two-page report (five ordered shading steps, exact counts printed in every cell, omitted cleanly when no difficulty labels exist).
- Added `tests/unit/twopage.test.js` (73 checks) and extended `tests/integration/pipeline.test.js` with two-page rendering, fallback, and UI-wiring checks. No existing calculation behavior was changed.
- Added the sample case `examples/individual-demo/nayla-two-page-sample-input.json` (98 answers with lowercase and legacy-capitalized difficulty labels) and generated example outputs.

## v2.4 — unit sequencing and upward final rounding

- Grouped all 28 existing lessons into eight official SAT units for the roadmap order of attack; no lessons were added or removed.
- Ranked units by aggregate need and kept every unit intact in one FIRST, THEN, or FINALLY wave.
- Changed final individual and group live-hour totals from nearest-quarter rounding to upward rounding at the end.
- Kept homework-range endpoints on ordinary nearest-quarter rounding.
- Updated the engine, view model, roadmap renderer, schemas, examples, tests, and documentation.

## v2.3 — calibrated rubric and 14–35 hour policy

- Replaced the incompatible universal rubric-sum conversion with a lesson-specific calibrated rubric. Every lesson's approved `base_hours` exactly matches the supplied table, including values such as 0.16, 0.32, 0.52, 0.64, 0.96, and 1.28.
- Updated calibrated base totals to English 5.16 h, Math 8.92 h, combined lessons 14.08 h.
- Disabled difficulty weighting; only Module 1 (1.00) and Module B (1.20) affect weighted accuracy.
- Removed lesson-level rounding; only the final individual or group total is scheduled on a quarter-hour boundary.
- Set the universal lesson minimum to 0.25 h for broad and non-broad lessons.
- Set the individual program range to 14–35 live hours.
- Set orientation default/minimum to 0.75 h and final review default/minimum to 1.50/1.00 h.
- Scaled additive adjustments to 0.25-hour units.
- Restricted high-target additions to distinct advanced-level evidence.
- Added complete four-stage maximum-budget allocation, including Stage 2 strategy/review reduction.
- Aligned group orientation, review, limits, and final rounding with individual policy.
- Replaced fixed homework ranges with proportional priority-based ranges.

## v2.2 — previous hard-budget implementation

- Enforced the former 38-hour component cap and added explicit allocation records.
- Preserved here for migration history only; later versions supersede its hour scale and limits.

## v2.0 — combined master architecture

- Introduced the offline application, structured planning engine, case inputs, calculated results, roadmap view model, group mode, schemas, examples, and test suite.
