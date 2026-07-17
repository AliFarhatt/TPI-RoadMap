# Elmy importer file manifest

## Added

- `app/js/elmy-importer.js`
- `app/vendor/pdfjs/pdf.min.js`
- `app/vendor/pdfjs/pdf.worker.min.js`
- `app/vendor/pdfjs/LICENSE`
- `config/diagnostic-difficulty-maps/diagnostic-exam-2026.json`
- `docs/elmy-pdf-import.md`
- `docs/elmy-import-file-manifest.md`
- `examples/individual-demo/nayla-elmy-imported-case.json`
- `tests/unit/elmy-importer.test.js`
- `tests/integration/elmy-pdf-import.test.mjs`
- `tests/integration/elmy-browser-import.test.js`
- `tests/integration/elmy-schema-validation.py`
- `tests/test-results/elmy-importer-test-log.txt`
- `tests/test-results/regression-baseline-summary.txt`

## Modified

- `app/index.html`
- `app/css/app.css`
- `app/js/app.js`
- `config/master-config.json`
- `app/js/config-data.js` (regenerated from configuration)
- `optional-tools/build-config-js.py`
- `schemas/individual-input.schema.json`
- `README.md`
- `CHANGELOG.md`
- `LICENSE-NOTES.md`
- `docs/architecture.md`
- `docs/field-mapping.md`
- `docs/known-limitations.md`
- `docs/test-report.md`
- `tests/schema-validation.py`
- `tests/rendering/render.test.py`
- `tests/test-results/rendering-and-ui-test-log.txt`

The rendering verification refreshed the generated PDFs already stored under `tests/test-results/`: `individual-roadmap.pdf`, `individual-report.pdf`, `group-report.pdf`, `legacy-karl-roadmap.pdf`, and the three `student-*-roadmap.pdf` files. No production report or roadmap renderer was changed.

The genuine source PDF is deliberately absent. It was supplied only through test environment variables. The generated schema-compatible JSON case is included as the reusable representative deliverable.
