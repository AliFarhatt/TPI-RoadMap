# Multi-PDF automation — change and verification record

Date: 2026-07-17

## Change log

- Added the exact group-mode **Import diagnostic PDF to group…** action with one-or-many PDF selection, sequential local parsing, immediate roster add/replace behavior, duplicate and older-attempt skipping, compatibility validation, per-file status summaries, and explicit stale-analysis handling.
- Added normalized student identity matching, deterministic attempt/date conflict rules, atomic replacement with teacher-entered goals/availability/overrides preserved, and safe removal of imported students.
- Extended the individual Elmy PDF action to accept several PDFs and generate exactly three existing outputs for each valid student: detailed diagnostic report, seven-page roadmap, and two-page teacher/parent report.
- Added offline PDF generation and one ZIP download with isolated per-student/per-report failures, safe folders and filenames, duplicate/conflict handling, progress, and `batch-summary.json`.
- Bundled JSZip, html2canvas, jsPDF, and html2pdf.js locally with their licenses. No CDN or external service is used.
- Preserved the pooled shared-group roadmap engine, exact three-page group report, existing individual calculations, and interactive single-PDF import flow.

## Modified and added files

- `README.md`
- `app/index.html`
- `app/js/app-controller.js` (active controller; extends the prior controller without changing calculation code)
- `app/js/group-ui.js`
- `app/js/batch-utils.js`
- `app/js/group-pdf-import.js`
- `app/js/individual-batch-reports.js`
- `app/js/offline-pdf-export.js`
- `app/css/batch-workflows.css`
- `app/vendor/html2canvas/*`
- `app/vendor/html2pdf/*`
- `app/vendor/jspdf/*`
- `app/vendor/jszip/*`
- `docs/multi-pdf-diagnostic-workflows.md`
- `docs/multi-pdf-verification-results.md`
- `examples/multi-pdf-demo/*`
- `tests/unit/batch-utils.test.js`
- `tests/integration/individual-batch-reports.test.js`
- `tests/integration/multi-pdf-ui.test.js`
- `tests/integration/pipeline.test.js`
- `tests/test-results/multi-pdf-automation-test-log.txt`

## Automated test results

| Area | Result |
|---|---:|
| Group/import aggregation, identity, attempts, exclusions, atomicity | 20/20 passed |
| Individual three-report batch and ZIP isolation | 14/14 passed |
| Multi-PDF UI/offline wiring | 12/12 passed |
| Pooled group aggregation, population SD, similarity, 2.0 multiplier, exclusions, individual invariance | 36/36 passed |
| Group roadmap and exact three-page report rendering | 13/13 passed |
| Existing two-page individual report | 73/73 passed |
| Existing full individual/group rendering pipeline | 58/58 passed |
| Elmy parser unit suite | 35/35 passed |
| Real attached Elmy PDF import and downstream rendering | 18/18 passed |
| Real `file://` individual browser import/export/report workflow | 23/23 passed |
| Real `file://` group add/duplicate/stale/remove workflow | 6/6 passed |
| **New feature + applicable regression total** | **308/308 passed** |

The legacy `tests/unit/engine.test.js` result remains 113 passed / 8 failed in maximum-budget bookkeeping assertions. The same eight failures are documented in the supplied v2.4.1 package and predate these features. Calculation code was intentionally not changed because the requested regression constraint requires existing individual outputs to remain unchanged. The optional Python schema runner could not execute in this environment because its development-only `jsonschema` dependency is not installed; the importer schema runner reports the same dependency as a skip.

## PDF and archive verification

- Sample shared group roadmap: 4 pages; opens successfully.
- Sample group report: exactly 3 pages; no blank fourth page.
- Sample individual batch ZIP: archive integrity OK; 9 PDFs for 3 students plus the batch summary.
- Each sample seven-page roadmap: exactly 7 pages.
- Each sample two-page report: exactly 2 pages.
- Sample detailed reports: 12–13 pages, determined by the existing detailed-report content.
- All generated PDFs are unencrypted and readable by `pypdf`; the sample ZIP passes its CRC/integrity check.

## Individual-calculation invariance

The shared-group suite compares individual output before and after shared-group analysis and confirms that the total and every individual lesson hour are unchanged. Multi-PDF modules call the established individual engine and renderers; they do not modify calculation rules or double individual hours.

## Genuine limitations

- Automatic PDF parsing supports the verified text-layer Elmy `Diagnostic Exam 2026` 98-question report contract only. Scanned/image-only, password-protected, unsupported, incomplete, and structurally ambiguous PDFs fail closed; OCR is not included.
- Batch work is sequential to control memory. Closing/reloading the tab cancels unfinished work.
- Detailed diagnostic report length varies with the existing report evidence. The roadmap and concise diagnostic report retain their fixed seven-page and two-page structures.
- A matching student whose attempt recency cannot be determined safely is left unchanged and flagged for manual review.
