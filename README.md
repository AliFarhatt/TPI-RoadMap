# TestPrep SAT Roadmap Master v2.4.1

A complete **offline** SAT diagnostic-analysis and course-planning application for TestPrep. It can import the supported 98-question Elmy `Diagnostic Exam 2026` PDF directly, analyzes an individual student or a group of 2–20 students, calculates live-teaching hours lesson by lesson, plans proportional homework and sessions, and produces:

1. A detailed instructor / administrator report.
2. A premium seven-page A4 student and parent roadmap.
3. A concise **two-page teacher and parent diagnostic summary** (individual cases).
4. For group cases, one pooled shared roadmap and one concise three-page group report.

## v2.4 sequencing and final rounding

The roadmap order of attack is organized by eight SAT units. Each of the original 28 lessons appears exactly once inside its official unit; unit labels do not add lessons. Units are ranked by aggregate need and divided into FIRST, THEN, and FINALLY waves. Individual lesson allocations retain two-decimal precision. After all components and course-budget rules are applied, the final individual or group live-hour total is always rounded upward to the next 0.25 hour; exact quarter-hour totals remain unchanged.


## Open the application

Extract the ZIP and double-click:

```text
app/index.html
```

The core application needs no Node.js, npm, server, internet connection, or proprietary runtime. All required configuration and examples are embedded for offline use.

## Main workflow

1. Start a new individual or group case, or open an example.
2. Enter identity, supplied scaled scores, target, availability, and diagnostic answers.
3. Import an Elmy diagnostic PDF, JSON, or CSV when preferred.
4. Run the analysis. Errors block calculation; warnings remain visible for instructor review.
5. Open the detailed report, the seven-page roadmap, or the two-page summary (**Create two page report**), then use browser **Print → Save as PDF** with A4 paper and background graphics enabled.
6. Export the case input, calculated results, roadmap view model, or lesson-hours CSV.

For several individual Elmy PDFs, select all files together from **Import Elmy diagnostic PDF…**. Each valid student is analyzed independently and receives exactly three PDFs—detailed diagnostic report, seven-page roadmap, and two-page report—inside one downloadable ZIP. The loaded case is preserved.

Scaled SAT scores are supplied by the user. The system does not estimate scaled scores from raw accuracy and validates that R&W + Math = Total when all three are provided.

## Fully automated Elmy PDF import

Click **Import Elmy diagnostic PDF…** and choose a text-based Elmy Assessment Report for `Diagnostic Exam 2026`. The app reads the PDF entirely on the device, extracts page-one metadata and the complete 98-row answer summary, converts global question numbers to the required module-local positions, applies the embedded lowercase difficulty map, validates the result, and loads the generated individual case. Existing populated work is never replaced without confirmation.

The review panel shows student, attempt, date, scores, extracted/reported totals, conversion status, difficulty checksum, case validation, and any source warnings. After a successful import, use the existing **Run analysis** and **Export input JSON** actions normally.

In group mode, **Import diagnostic PDF to group…** accepts one or many PDFs. Valid students are added to the roster immediately. A clearly newer attempt replaces the older diagnostic while preserving teacher-entered goals, availability, and overrides; exact duplicates and older attempts are skipped. Every file receives its own visible status, and accepted roster changes mark any previous group calculation stale until **Run analysis** is used again.

No PDF, student data, or analytics are uploaded. PDF.js is bundled locally; the importer works from `app/index.html` under `file://` and requires no server, account, API, OCR, or internet connection. Image-only, password-protected, incomplete, unrelated, and structurally ambiguous reports are rejected without replacing the current case. See `docs/elmy-pdf-import.md` for the format and validation contract.

## Two-page teacher and parent report

After running an individual analysis, the results panel shows a **Create two page report** button. It generates a concise, print-ready diagnostic summary of **exactly two A4 pages**, intended for teachers and parents:

- Page 1: score cards (Total, Reading and Writing, Math — "Not provided" when a score is missing), attempt summary (correct, answered, total, overall accuracy, completion rate), section- and module-performance bar charts, and a short automatically generated interpretation.
- Page 2: easy/medium/hard difficulty performance, a section × difficulty **accuracy heat map** (darker cells = higher accuracy; every cell also prints the exact result so it stays readable in grayscale), the three strongest areas, the three highest-priority areas, and three recommended next steps.

Notes:

- It uses the **currently loaded individual case** and the engine's existing diagnostic calculations only; nothing is estimated or invented.
- Difficulty values are read case-insensitively: lowercase `easy` / `medium` / `hard` are the canonical values and legacy capitalization such as `Easy` is normalized. If no valid difficulty labels exist, the difficulty chart is replaced by a clear note and the heat map is omitted.
- The report is a diagnostic summary: it contains **no course hours, schedules, or roadmap content** and never replaces the seven-page roadmap.
- Group cases: the button is shown disabled with an explanation, because the two-page parent report requires an individual student case.
- The suggested print filename follows `student-name_attempt-number_two-page-diagnostic-report` (the popup's title), e.g. `nayla-el-azzi_attempt-1_two-page-diagnostic-report.pdf`. The optional `diagnostic.attempt_number` field supplies the attempt.

## v2.4 calculation policy

### Question weighting

Only adaptive-module weighting affects accuracy:

- Module 1: `1.00`
- Module B: `1.20`

Difficulty labels may be stored as metadata, but they do not change the question weight in v2.4. The explicit `correct: true/false` value takes priority over answer-string comparison, preserving credited equivalent Math answers.

### Coverage

Every lesson is classified as not assessed, limited, moderate, or strong using both question count and subskill variety. Coverage floors are `1.00`, `1.00`, `0.75`, and `0.50`. One correct question never proves full lesson mastery.

### Calibrated lesson rubric

Every lesson has a rubric profile:

- breadth: 1–3
- concept difficulty: 1–3
- SAT strategy load: 1–3
- calibrated base hours

The **lesson-specific calibrated base hours in `config/lesson-catalog.json` are authoritative**. This intentionally replaces the old universal “sum the three scores and convert the sum” rule, because lessons with the same profile total may require different teaching time. The catalog exactly preserves the approved table:

- English base total: `5.16 h`
- Math base total: `8.92 h`
- Combined lesson base total: `14.08 h`

The rubric profile explains why a lesson is broad, difficult, or strategy-heavy; the lesson's calibrated value controls the calculation.

### Performance and foundational rules

Weighted accuracy gives the performance multiplier:

- 90–100%: `0.50`
- 75–89.99%: `0.75`
- 60–74.99%: `1.00`
- 40–59.99%: `1.50`
- Below 40%: `2.00`

`final multiplier = max(performance multiplier, coverage floor)`.

Foundational evidence can override an insufficient core allocation. The override is conditional:

```text
no foundational concern:
core hours = calibrated base × final multiplier

moderate or major concern:
core hours = max(
  calibrated base × final multiplier,
  calibrated base × foundational multiplier
)
```

Foundational multipliers are `1.25` and `1.50` when evidence exists. The neutral state does not cancel legitimate performance reductions.

### Scaled additive adjustments

- Weak subskill clusters: `+0.25 / +0.50 / +0.75 h`
- Correct-but-slow: `+0.25 h`
- Repeated rushing: `+0.25 h`
- Severe pacing: `+0.50 h`
- High target: `+0.25 h`, only with distinct advanced-level evidence
- Teacher overrides: quarter-hour increments with a written reason

Limited or missing diagnostic coverage alone does not trigger the high-target addition because coverage is already handled by the coverage floor.

### Minimums and rounding

- Every lesson, broad or otherwise, has the same absolute minimum: `0.25 h`.
- Individual lesson values are **not rounded**. Values such as `0.64`, `0.52`, and `1.28` remain intact.
- Only the final course total is rounded **upward** to the next `0.25 h`:

```text
final scheduled total = ceil(unrounded component total × 4 − ε) / 4
```

Reports show both the unrounded component total and the final scheduled total, so the final quarter-hour rounding difference is transparent.

### Individual program range

- Program minimum: `14 h`
- Strict live-course maximum: `35 h`
- Orientation: default and minimum `0.75 h`
- Final review: default `1.50 h`, minimum `1.00 h`

When the unrounded component total is below 14 hours, the exact missing time is added to named lessons or strategy components. When it exceeds 35 hours, actual components are reduced through four explicit stages:

1. Remove remediation/repetition above calibrated base and transfer it to targeted homework.
2. Remove optional strategy blocks and reduce final review toward its minimum; orientation remains 0.75 h.
3. Compress the strongest, best-covered lessons toward the universal 0.25 h floor.
4. Remove any exact remainder required to keep the actual component sum at or below 35 h.

The system never fixes only the displayed headline total.

### Homework

Homework is proportional to final live lesson time and remains separate from live teaching:

- Essential Review: `0.50×–1.00×`, minimum `0.25 h`
- Medium: `1.00×–1.50×`, minimum `0.50 h`
- High: `1.50×–2.00×`, minimum `0.75 h`
- Critical: `2.00×–2.50×`, minimum `1.00 h`

Homework is rounded upward to the next quarter hour. Time transferred from live teaching during maximum-budget allocation is added to the relevant independent-practice requirement.

### Group policy

The group engine validates each student, excludes invalid records with named reasons, and requires at least two eligible students. It pools correct and administered question counts across the valid roster and runs the established instructional decision logic once on that synthetic group profile. It never adds or averages individual roadmaps.

Each shared lesson and applicable strategy component receives the fixed `2.0` group instructional-time multiplier before the established caps, balancing, redistribution, ordering, and final rounding stages. Population standard deviation is used only for similarity and differentiation guidance; it does not replace pooled accuracy or automatically add lesson hours. See `docs/shared-group-roadmap.md`.

## Configuration and source of truth

- `config/lesson-catalog.json`: authoritative lesson rubric profiles and calibrated base hours
- `config/calculation-rules.json`: weights, multipliers, additions, program limits, homework, sessions, and group rules
- `config/diagnostic-difficulty-maps/diagnostic-exam-2026.json`: authoritative 98-question lowercase difficulty map for the Elmy importer
- `app/js/engine.js`: executable calculations
- `docs/calculation-guide.md`: complete human-readable formula guide
- `docs/course-hour-rules-v2.4.md`: consolidated policy text

Browsers cannot reliably fetch local JSON from `file://`, so `app/js/config-data.js` is a generated mirror. After editing configuration, run:

```text
python optional-tools/build-config-js.py
```

## Import formats

- Elmy PDF: text-based Elmy Assessment Report for `Diagnostic Exam 2026` (`98` questions); see `docs/elmy-pdf-import.md`
- Individual JSON: `schemas/individual-input.schema.json`
- Group JSON: `schemas/group-input.schema.json`
- CSV: see `docs/csv-import-guide.md` and `examples/individual-demo/answers.csv`

## PDF output

Browser printing remains available for interactive documents. Multi-PDF individual batches use bundled local PDF/ZIP libraries to create the three reports per student and one ZIP automatically; no server or CDN is used. The optional helper at `optional-tools/automated-pdf/make-pdfs.py` can also batch-render examples when Playwright and Chromium are installed.

## Package map

```text
app/                offline application
app/vendor/pdfjs/   locally bundled PDF.js runtime and license
config/             authoritative lesson, rule, brand, and diagnostic configuration
schemas/            JSON Schemas
examples/           individual, group, and legacy visual examples
reports/            report-template notes
optional-tools/     rebuild and optional PDF helpers
tests/              unit, integration, schema, rendering, offline, and UI tests
docs/               architecture, calculations, migration, imports, and limitations
original-reference/ preserved original master-template source
```

## Known limitations

See `docs/known-limitations.md`. In particular, the shipped diagnostic template does not include a verified raw-to-scaled score conversion table, and timing adjustments require reliable per-question timing rather than only a whole-exam percentage.


## One shared group roadmap and three-page report

For a loaded group case, use **Create group roadmap** or **Create three page group report**. The system validates every student, identifies exclusions, requires at least two eligible students, pools correct/administered totals, summarizes provided scores with population SD, and creates one shared 28-lesson course. Raw lesson and strategy requirements use the fixed 2.0 group instructional-time multiplier before existing group caps and final category rounding; hours are never added once per student. Lesson-level variation produces tiered-practice notes. See `docs/shared-group-roadmap.md` for the calculation and report contract.

---

## GitHub Pages deployment

This package includes a ready-to-use GitHub Actions workflow at:

```text
.github/workflows/deploy-pages.yml
```

It publishes only the browser application inside `app/`. See `GITHUB_DEPLOYMENT.md` for setup and privacy guidance.
