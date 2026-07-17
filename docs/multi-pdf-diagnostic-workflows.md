# Multi-PDF diagnostic workflows

## Group roster import

1. Create or load a group case.
2. Select **Import diagnostic PDF to group…**.
3. Choose one or several supported Elmy `Diagnostic Exam 2026` PDFs.
4. Review the per-file summary, then select **Run analysis** before generating the shared roadmap or three-page report.

Each PDF is parsed, converted, and validated locally. Accepted students appear in the roster immediately. The summary shows filename, student, attempt, total score when supplied, answered/correct counts, status, and reason.

Student identity matching is case-insensitive, whitespace-insensitive, punctuation/hyphen-insensitive, and accent-normalized; Arabic letters are retained. For a matching student:

- exact equivalent attempt: skip as a duplicate;
- higher attempt: replace atomically and preserve teacher-entered goals, availability, foundational gaps, and overrides;
- lower attempt: skip;
- missing attempt numbers: compare reliable diagnostic dates;
- conflicting same attempt or unclear recency: require manual review and keep the existing record unchanged.

Only valid 98-question `Diagnostic Exam 2026` cases with the required `27/27/22/22` module distribution join the group. One failed PDF never rolls back successful earlier files. Roster additions, replacements, edits, or removals invalidate prior group results; the user must rerun analysis explicitly.

## Individual report batch

In individual mode, select several PDFs from **Import Elmy diagnostic PDF…**. The app processes each file independently and downloads one ZIP. Every successful student folder contains exactly:

1. `*_detailed-diagnostic-report.pdf`
2. `*_seven-page-roadmap.pdf`
3. `*_two-page-report.pdf`

The archive also includes `batch-summary.json`, which records file/student/report success, skip, partial, conflict, and failure statuses without including question-level answers. Safe filenames use normalized student name plus attempt number, or diagnostic date when the attempt is unavailable.

Exact duplicate student/attempt inputs are generated once. Different attempts are allowed in separate folders. Conflicting data for the same student and attempt is flagged rather than overwritten. A failed student or failed report does not stop remaining work. The case already loaded in the application is not replaced or mixed into the batch.

## Privacy and offline behavior

PDF parsing, analysis, report rendering, and ZIP creation happen in the browser. PDF.js, JSZip, html2canvas, jsPDF, and html2pdf.js are bundled locally. No diagnostic content is uploaded, and no CDN, account, API key, OCR service, or internet connection is required.

## Limitations

- The importer supports the verified text-layer Elmy `Diagnostic Exam 2026` report contract only.
- Scanned/image-only and password-protected PDFs are rejected; OCR is not included.
- Work is sequential by design, so large batches take longer but use less memory.
- Closing or reloading the tab cancels an unfinished batch.
