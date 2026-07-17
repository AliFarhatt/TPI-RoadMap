# Test report — v2.4.1 with Elmy PDF importer

Final verification date: 2026-07-17. The genuine student source PDF was supplied only at test time and is not redistributed in the package.

## Importer acceptance suites

| Suite | Passed | Failed |
|---|---:|---:|
| `tests/unit/elmy-importer.test.js` | 35 | 0 |
| `tests/integration/elmy-pdf-import.test.mjs` with the genuine 46-page report | 18 | 0 |
| `tests/integration/elmy-schema-validation.py` | 1 | 0 |
| `tests/integration/elmy-browser-import.test.js` through `file://` | 23 | 0 |
| **Importer total** | **77** | **0** |

The genuine-PDF integration reproduced:

- student `Nayla El Azzi`, attempt 1, season `Summer 2026`, date `2026-07-15`;
- displayed scores 660 Reading and Writing, 610 Math, 1270 Total;
- 98 records, 79 answered, 71 correct, 19 omitted;
- 54 English / 44 Math and 27/27/22/22 module distribution;
- 22 easy / 35 medium / 41 hard, all lowercase;
- credited equivalent `5.0` versus `5` with `correct: true`;
- uncorrupted multi-line LaTeX Math content;
- successful engine analysis of all 98 questions;
- successful detailed-report, seven-page-roadmap HTML, and two-page-report generation;
- JSON serialization/re-import with the same analyzable case.

Formal Draft-07 validation passed for `examples/individual-demo/nayla-elmy-imported-case.json` against `schemas/individual-input.schema.json`.

## Browser and offline verification

Chromium 138 opened `app/index.html` directly by `file://`. The test selected the genuine PDF through the actual hidden file input and verified:

- exact import-button label and locally loaded PDF.js/importer files;
- zero HTTP/HTTPS requests during startup and import;
- the PDF.js local fake-worker fallback under `file://`;
- populated student/score/date data and the compact 98/98, 79/79, 71/71 review;
- unsupported availability/accommodation remaining blank and null on export;
- no page-level JavaScript errors;
- immediate analysis plus all three report actions;
- exported input JSON retaining 98 records and `source_validation`;
- exported JSON loading back into the app and producing the same analysis surface.

The UI and results layout were also inspected from a full-page Chromium screenshot. Microsoft Edge and Firefox binaries were unavailable in the test environment, so no claim is made for a separate engine run. The ordinary app has no browser-specific importer code; PDF.js's local fallback is documented in `docs/elmy-pdf-import.md`.

## Existing regression suites

The package had known test discrepancies before the importer work. A fresh run of the untouched uploaded package established the baseline; the same suites were run after implementation.

| Existing suite | Before | After | Importer regression |
|---|---:|---:|---|
| Calculation engine | 113 passed / 8 failed | 113 / 8 | unchanged |
| Two-page unit suite | 73 / 0 | 73 / 0 | none |
| Full pipeline | 58 / 0 | 58 / 0 | none |
| Full schema suite | 4 / 3 | 5 / 3 | generated Elmy case added and passed; three original failures unchanged |
| Rendering/offline UI in Chromium 138 | 58 / 6 | 58 / 6 | unchanged |

The eight pre-existing engine failures concern the uploaded package's whole-hour section scheduling versus tests/documentation that expect final-only quarter-hour rounding and exact cap allocation. The three pre-existing schema failures are the uppercase template ID rejected by a lowercase-only schema pattern and two generated-result `final_rounding_adjustment` values above the schema's 0.25 maximum. The six Chromium rendering failures are five existing seven-section roadmaps printing as eight PDF pages in this browser build and one existing detailed-report table-width overflow check.

Those unrelated calculation, generated-result, and renderer contracts were deliberately not changed to make importer tests green. The importer never changes planning math, roadmap/report renderers, or the existing result schemas. Its browser path, engine acceptance, report generation, and JSON/schema contract all pass independently.

## Development-only dependencies

Ordinary users need no development dependencies. Verification used Node.js for unit/integration tests, Python `jsonschema` for formal Draft-07 validation, and Playwright with Chromium for browser checks. These development packages and the genuine PDF are not included in the application ZIP.
