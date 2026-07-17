# Fully automated Elmy diagnostic PDF import

## Supported report

The first registered parser supports this exact contract:

- Provider: Elmy Assessment Report
- Assessment: `Diagnostic Exam 2026`
- Template ID: `Diagnostic_Exam_2026`
- Questions: 98 total
- Structure: English Module 1 (27), English Module B (27), Math Module 1 (22), Math Module B (22)

Unrelated assessments, incomplete exports, password-protected files, image-only files, and incompatible layout changes are rejected before application state is replaced.

## Use

1. Extract the package and open `app/index.html`.
2. Click **Import Elmy diagnostic PDF…**.
3. Choose the text-based Elmy export.
4. Review the compact validation panel and any expandable warnings.
5. Click **Run analysis**. Use **Export input JSON** whenever a reusable generated case is needed.

If another populated case is open, the app asks for confirmation before replacing it. A fatal import error leaves the current case unchanged.

## Local privacy model

The selected file is read with the browser `File` API and processed by the locally bundled PDF.js runtime. There is no network request, upload, account, analytics call, LLM, external OCR, or remote storage. The normal application remains a static `file://` app. PDF.js evaluation is disabled and import size is capped at 25 MB.

## Extraction strategy

The parser uses text tokens and their page/x/y geometry rather than one flattened text string.

1. Page 1 supplies labeled student, attempt, assessment, class/season, date, displayed scaled scores, and report-wide answered/correct totals.
2. The parser detects the `Answers Summary` and `Question Corrections` boundaries rather than assuming fixed page numbers.
3. Question-number/status anchors and header-derived column regions reconstruct the four-column summary. Independently segmented column lines prevent a long or wrapped answer from absorbing the next row.
4. The complete 98-row summary is the primary answer source. Correction blocks are consulted only when their alignment is complete and unambiguous; partial alignment is never guessed.
5. Page-one section-breakdown rows are warning-only because the representative Elmy source conflicts with the official 54/44 structure. The complete summary and awarded points take precedence.

Presentation-only `$...$` wrappers are removed from a whole Math response, while JSON serialization preserves LaTeX backslashes, radicals, fractions, functions, inequalities, degree symbols, and signs. Omitted em dashes become `null`.

## Numbering and correctness

Global-to-local conversion is fixed:

| Global range | Output section/module | Local range |
|---:|---|---:|
| 1–27 | English / Module 1 | 1–27 |
| 28–54 | English / Module B | 1–27 |
| 55–76 | Math / Module 1 | 1–22 |
| 77–98 | Math / Module B | 1–22 |

Correctness comes only from awarded points: `1 / 1` becomes `correct: true`; `0 / 1` becomes `correct: false`. This preserves credited equivalent answers such as `5.0` versus `5`. Answer-string equality never overrides awarded credit.

## Difficulty mapping

`config/diagnostic-difficulty-maps/diagnostic-exam-2026.json` is the source of truth. The importer neither infers nor adjusts difficulty from performance. It requires exactly 98 lowercase values and validates these checksums:

| Module | Easy | Medium | Hard | Total |
|---|---:|---:|---:|---:|
| English Module 1 | 8 | 10 | 9 | 27 |
| English Module B | 4 | 9 | 14 | 27 |
| Math Module 1 | 7 | 8 | 7 | 22 |
| Math Module B | 3 | 8 | 11 | 22 |
| **Complete diagnostic** | **22** | **35** | **41** | **98** |

After editing configuration, rebuild the offline mirror with `python optional-tools/build-config-js.py`.

## Validation contract

Before loading the case, the importer requires:

- supported Elmy identity, assessment title, student, attempt, and displayed scores;
- 98 unique global rows with every number 1–98 exactly once;
- awarded points and a correct answer for every row;
- exact 54 English / 44 Math and 27/27/22/22 module distribution;
- calculated answered/correct counts matching the report-wide totals;
- complete lowercase difficulty map with the 22/35/41 checksum;
- a schema-compatible individual object accepted by the normal planning engine.

Displayed section scores are preserved. If they do not sum to the displayed total, validation records a warning instead of changing source data. Page-one section-row inconsistencies are also warnings. Missing, duplicate, ambiguous, or unreconciled question data is fatal.

The generated `source_validation` object retains parser version, record counts, conversion/difficulty status, calculated-versus-reported totals, score-sum status, duplicate/missing status, and warnings. Unsupported personal, goal, availability, timing, confidence, method, teacher, and error fields remain null or empty.

## Failures and worker fallback

User-facing messages cover invalid file types, missing local runtime files, password protection, corruption, missing text layers, wrong assessments, incomplete summaries, missing points/answers, missing difficulty configuration, and failed case validation. Stack details remain in the developer console.

`app/index.html` loads the local PDF.js worker and main runtime. The importer also sets a local worker URL; PDF.js can use its locally bundled fake-worker fallback when a browser blocks a dedicated worker under `file://`. The supported path has been verified in Chromium. Image-only reports are rejected; OCR is not present as a hidden fallback.

## Adding a future deterministic parser

Keep provider-specific logic outside `app.js`. Add a parser with `id`, `template_id`, `canHandle(extractedPages)`, and `parse(extractedPages, config)` to the registry in `app/js/elmy-importer.js`; add an authoritative template/difficulty configuration and rebuild `config-data.js`; then add parser-unit, genuine/sanitized integration, schema, offline browser, and regression tests. A new parser must fail closed when its identity or structure is ambiguous.

## Dependency

The package bundles `pdfjs-dist` PDF.js **4.10.38**, browser and worker builds only. PDF.js is licensed under the Apache License 2.0; the complete license is stored at `app/vendor/pdfjs/LICENSE`. No PDF.js package manager or runtime installation is required by ordinary users.
