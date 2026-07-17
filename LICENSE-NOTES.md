# License notes

- All TestPrep / House of Prep brand assets (logos, cover photo, QR code, brand statistics, sister-brand copy) are the property of House of Prep and are included only for use in TestPrep documents. They are reused verbatim from the original bundle per its asset manifest.
- **Fonts:** no font files are distributed. The documents use the offline-safe stack `Inter, Arial, Helvetica, sans-serif`. If Inter is installed on the machine it is used; otherwise Arial/Helvetica render. There is no Google Fonts or any other network dependency.
- The original design bundle is preserved unmodified in `original-reference/` (operating-system junk files removed).
- Application code (engine, renderers, UI, tests, tools) was written for this package. The PDF importer bundles only the browser and worker builds of **PDF.js 4.10.38** under `app/vendor/pdfjs/`. PDF.js is copyright Mozilla Foundation and contributors and is licensed under the **Apache License 2.0**; the complete upstream notice is included at `app/vendor/pdfjs/LICENSE`.
- The optional PDF helper uses Playwright/Chromium only if the user installs them; neither ships in this package.
- "Kaplan Practice Test 2" is referenced as the diagnostic's name; no Kaplan test content, questions, or answer keys are included. The template stores only a question-number-to-lesson mapping; correct answers must be supplied by the operator.
