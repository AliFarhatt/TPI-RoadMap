# Handoff: TestPrep — SAT Customized Roadmap (7-page A4 PDF document)

## Overview
A premium, print-ready **A4 portrait document** that turns a single student's SAT diagnostic into a personalized study roadmap for TestPrep (a House of Prep brand). It is a 7-page editorial PDF (cover → diagnosis → climb → plan → engine → tracking → ecosystem/close), designed to be presented to students and parents. The current build is fully data-filled for the reference student **Karl Naddaf (840 → 1300)**.

This document is generated once per student. The intent is that the **layout/design stays identical for every student** and only the student's data changes (see *Data Model* below — this mirrors the `TestPrep Study Plan - MASTER TEMPLATE.json` in the project root).

## About the Design Files
The files in this bundle are **design references created in HTML** — a high-fidelity prototype showing the intended look, layout, and content of the PDF. They are **not** production code to ship directly.

The HTML was authored in a lightweight in-house component runtime (`support.js`, `<x-dc>` tags). **Do not port that runtime.** Your task is to **recreate this document in the target environment** using its own established patterns. For a PDF/document generator this most likely means one of:
- A **React + print-CSS** page (e.g. Next.js route rendered to PDF via Puppeteer/Playwright, or `@react-pdf/renderer`),
- A **server-side HTML → PDF** template (Handlebars/Nunjucks/Twig + WeasyPrint/Prince/wkhtmltopdf),
- Or your existing reporting/templating stack.

If no environment exists yet, **plain semantic HTML + a single CSS file + a headless-Chrome PDF step** is the most faithful and lowest-risk choice, because the design is built entirely on standard CSS (flex, grid, `@page`, SVG) with no framework dependency.

## Fidelity
**High-fidelity (hifi).** Every color, font size, weight, spacing value, border radius, and piece of copy in the prototype is final and intentional. Recreate it pixel-faithfully. Exact values are catalogued in *Design Tokens* and per-component below. The source file `TestPrep SAT Roadmap v2.dc.html` is the single source of truth — when in doubt, read the inline styles there.

---

## Page Size & Print Setup
- **Page:** A4 portrait (210 × 297 mm).
- **`@page` margin:** `10mm 8mm 14mm`.
- **Running header (every page):** top-left `TESTPREP · HOUSE OF PREP`; top-right `{page} / {total}`. Inter 7pt, weight 600, letter-spacing 0.1em, color `#aab2c0`.
- **Per-page footer pill (pages that aren't full-bleed dark):** a fixed navy (`#0c1730`) rounded pill, `border-radius:9px`, positioned `left:8mm; right:8mm; bottom:5mm; height:9mm`, centered contents: TestPrep white logo + 1px divider + `HOUSE OF PREP` (Inter 8px/600, letter-spacing 0.2em, `#8794ad`). It is intentionally **suppressed/overlapped on the final dark Ecosystem page** (that page sets `z-index:1` and a tall min-height so the closing card covers the footer slot).
- **Color printing:** `print-color-adjust: exact` is required (dark navy panels must print with background).
- **Pagination control:** content blocks use "keep together" (`break-inside: avoid`); section headings use `break-after: avoid`; paragraphs use `orphans:3; widows:3`. Each new page starts on an element with a hard `break-before: page`.
- **Content column:** centered, `max-width: 760px`. Light-page body content has `padding: 0 30px`. Full-bleed **dark** sections instead use `margin: 6px 16px 0` and their own internal padding (≈30–32px).

---

## Pages / Views

> Page numbering below is the **printed page order**. (Note: the source HTML has two comments both labeled "PAGE 6" — the actual order is Cover, Masthead+Diagnosis, Climb, Plan, Engine, Tracking, Ecosystem = 7 pages.)

### Page 1 — Cover
- **Purpose:** Confident, personalized title page suitable for a parent/principal.
- **Layout:** Single column flex, `padding: 30px 30px 26px`, `gap: 22px`, full page height.
- **Components (top → bottom):**
  1. **Hero image** — `assets/cover-hero.png`, `border-radius:18px`, `overflow:hidden`, `box-shadow:0 14px 40px rgba(12,23,48,0.16)`, `aspect-ratio:1052/1045`, `object-fit:cover; object-position:center top`.
  2. **Eyebrow** — `Summer 2026`, Inter 21px/400, color `#1740a9`.
  3. **H1 title** — `The SAT Customized Roadmap`, Inter 44px/600, line-height 1.04, letter-spacing −0.01em, color `#0c1730`.
  4. **Subtitle** — Inter 13.5px/400, `#5a6373`, max-width 54ch: "A diagnostic-built academic strategy, prepared for **Karl Naddaf** · Practice Test 1 · June 22, 2026." (student name bold `#14181f`).
  5. **Brand stat band** — navy `#0c1730`, `border-radius:16px`, 4-col grid, columns divided by `1px rgba(255,255,255,0.1)`. Each cell: big numeral Inter 32px/600 in orange `#ff963e` (with superscript `+`), label below Inter 9px letter-spacing 0.12em `#cdd6e8`. Values: **20K+ Students · 40+ Partners · 12+ Years · 5+ Countries**.

### Page 2 — Masthead + Section 01 (The Diagnosis)
- **Purpose:** Establish the student's starting point and what the diagnostic reveals.
- **Masthead** (dark band): navy `#0c1730`, `border-radius:18px`, `margin:6px 16px 0`, `padding:26px 32px 24px`, relative. Decorations: a radial blue glow `radial-gradient(125% 100% at 100% 0%, rgba(23,64,169,0.55), transparent 60%)`; a **4px split top bar** — orange on the left 44%, blue `#1740a9` on the right, with the band's top corners rounded.
  - Kicker `PERSONALIZED SAT ROADMAP`, Inter 9px, letter-spacing 0.2em, `#ff963e`.
  - Prepared-for line, Inter 9px, letter-spacing 0.16em, `#8fa2cb`: `PREPARED FOR KARL NADDAF · PRACTICE TEST 1 · JUN 22 2026`.
  - **Hero score:** `840` (white) `→` (orange 26px) `1300` (`#7ea0e8`), each numeral Inter 54px/600, line-height 0.9, letter-spacing −0.02em; trailing `on the 1600 scale` 12px `#8794ad`.
  - **Gap pill + bar:** orange pill `#ff963e` (`border-radius:999px`, text `#3a1e08`): `+460` (17px/700) + `POINTS TO GAIN` (8.5px/600, ls 0.14em). Below it a progress track `height:14px`, `border-radius:7px`, bg `rgba(255,255,255,0.07)`, 1px border: a navy→blue fill `linear-gradient(90deg,#1b3a78,#2f5bc4)` to 52.5% (= 840/1600), then an orange diagonal hatch `repeating-linear-gradient(45deg,#ff963e,#ff963e 6px,#e87f2a 6px,#e87f2a 12px)` from 52.5% to 81.25% (= 1300/1600).
  - **Stat row:** 4-col grid, top divider `1px rgba(255,255,255,0.12)`, each chip after the first has `border-left:1px rgba(255,255,255,0.1); padding-left:14px`. Label Inter 8.5px ls 0.12em `#8fa2cb`; value Inter 22px/600. Values: **FOCUSED INSTRUCTION** ~36 hrs (white) · **LEARNING ACCOMMODATION** Yes (`#7ea0e8`) · **MAX SESSION LENGTH** 1 hr (white) · **SESSION FORMAT** Short focused blocks (white, 14px).
- **Section 01 (light):** the reusable **Section Head** pattern (see Components) with ghost `01`, kicker `THE DIAGNOSIS`, h2 `What your diagnostic actually says`.
  - Lead paragraph 13.5px `#2a2f38`, max-width 66ch.
  - **Two gauge cards** (2-col grid): each bordered `#e4e7ee`, `border-radius:12px`, `padding:13px 18px` — section name (13px/600), big `%` numeral Inter 28px/600 `#1740a9`, thin progress bar (`height:8px`, track `#eef0f4`, `border-radius:4px`, fill `#1740a9` to the accuracy %), caption Inter 9.5px `#8a93a3`. Data: **Reading & Writing 36% — 440/800 · 24 of 66 correct**; **Math 38% — 400/800 · 20 of 53 correct**.
  - **Strengths / Blockers split panel** — single bordered rounded box, 2 columns, middle divider. Left header `▲ WHAT'S WORKING` (`#1f8a5b`), right header `▼ WHAT'S HOLDING YOU BACK` (`#c7560a`); each a bulleted list (12.5px `#3a414c`, gap 7px) of **bold label + colon + detail**. Content listed in *Data Model*.
  - **Insight panel** ("the pattern") — navy rounded card `border-radius:14px`, 4px orange left edge, kicker `THE PATTERN, IN ONE LINE` (`#ff963e`), statement Inter 18px/500 white, with "reasoning is the gap" in orange.

### Page 3 — Section 02 (The Climb)
- **Purpose:** Explain *why* ~36 hours closes the gap.
- **Section Head:** ghost `02`, kicker `THE CLIMB`, h2 `How instruction closes the gap`. Lead paragraph 14px (with `~36 focused hours` bolded blue).
- **Score Elevation curve** — `<figure>` surface `#fbfcfe`, border `#e4e7ee`, `border-radius:14px`, `padding:22px 24px 16px`.
  - Caption row: `YOUR SCORE ELEVATION` (left) / `840 → 1300 OVER ~36 HRS` (right), Inter 9.5px `#8a93a3`.
  - **Inline SVG** (`viewBox 0 0 720 320`): 4 horizontal gridlines `#edf0f5`; an area fill under the curve using `linearGradient #elev` (blue `#1740a9` 0.18 → 0); the curve itself a smooth cubic `path` stroked `#1740a9` width 2.5; a baseline axis `#c4cad4`. **5 milestone dots** (white fill, colored stroke; the final one orange `#ff963e` r=8). Score labels (Inter 600): 840 `#6a7384`, 980 / ~1100 / ~1200 `#1740a9`, 1300 `#c7560a` (19px). Stage labels along the axis: `START EARLY CORE PRECISION TARGET` (9.5px `#8a93a3`). **All SVG `font-family` must be Inter.**
  - Caption paragraph under a 1px top divider explaining the steep-start / flattening-top logic.
- **Two tracks** (2-col): bordered rounded cards, each with a 3px colored **left** border — Track 1 `#1740a9` (`TRACK 1 · INSTRUCTION`, "~36 hrs, guided"); Track 2 `#ff963e` (`TRACK 2 · YOUR EFFORT`, "Student commitment").
- **Footnote** — 11.5px `#5a6373`, 2px left border `#e4e7ee`: evidence-based-projection caveat.

### Page 4 — Section 03 (The Plan of Attack)
- **Purpose:** Show where the 36 hours are spent and in what order.
- **Section Head:** ghost `03`, kicker `THE PLAN OF ATTACK`, h2 `Where your 36 hours go`. Lead paragraph 14px.
- **Weighted lanes** — label row (`WEIGHTED BY SECTION` / `~36 HRS TOTAL`), then 3 stacked horizontal bars, `border-radius:10px`, `height:46px`, gap 8px, **width = proportion of hours**:
  - Math — `width:100%`, bg navy `#0c1730`, big `18`, label `Math`, right note `50% · deepest gaps` (`#9fb0d6`).
  - Reading & Writing — `width:83.3%`, bg `#2f5bc4`, big `15`, right note `42%` (`#d2ddf4`).
  - Strategy — `width:34%`, bg orange `#ff963e`, text `#3a1e08`, big `3`.
  - Each big number Inter 26px/600 in a fixed 78px-wide slot; label 13px/600.
- **The order of attack** — h3 (Inter 17px/600), then 3 rows in a `54px 130px 1fr` grid separated by `1px #e4e7ee` top borders (last row also bottom border):
  - Row marker = big step numeral (34px/600): `01` orange `#c7560a`, `02` blue `#1740a9`, `03` grey `#9aa3b2`.
  - Middle col: phase kicker (`FIRST`/`THEN`/`FINALLY`), hours numeral (28px/600) + `hrs`, one-line summary (`#5a6373`).
  - Right col: wrap of **skill chips** — `border-radius:8px`, `padding:6px 12px`, 12px. Chip palettes: FIRST = orange tint `bg #fbe6d4 / text #9a4708`; THEN = blue tint `bg #dfe7f6 / text #1740a9`; FINALLY = grey `bg #eef0f4 / text #4a5566`. Chip text in *Data Model*.
- **Footnote** — recommendation-not-fixed-calendar caveat.

### Page 5 — The TestPrep Performance Engine (dark)
- **Purpose:** Brand methodology — a 7-step loop. **This page's content is fixed for every student** (only the closing note references the student).
- **Layout:** full dark navy section like the masthead (rounded, split top bar, radial glow), `padding:32px 32px 30px`, `min-height:262mm`.
- **Header:** kicker `HOW IT WORKS` (`#ff963e`, ls 0.22em); h2 Inter 38px/700 white with `Performance Engine` in `#7ea0e8`; sub `A seven-step process, the same loop that produced this roadmap.` (`#8fa2cb`).
- **7-step grid** (2 columns, gap 14px):
  - Steps 01–06 = **dark feature cards** (`bg rgba(255,255,255,0.035)`, `border 1px rgba(255,255,255,0.1)`, `border-radius:14px`, `padding:20px 20px 18px`). Top row of each: a 40px **icon tile** (`border-radius:11px`, faint white fill/border) holding a 19px orange stroked **Lucide-style line icon**, and a large **ghost numeral** (34px/700, `#46557a`). Then title 15px/600 white, description 12px `#8fa2cb`.
  - Step 07 = **full-width highlighted card** (`grid-column:1/-1`): orange gradient `linear-gradient(120deg, rgba(255,150,62,0.16), rgba(255,150,62,0.05))`, border `rgba(255,150,62,0.4)`; 44px orange icon tile + title + description (`#d8b89a`) + big `07` in orange.
  - Step titles/desc/icons are fixed — see *Data Model → engine_steps*.
- **Closing note:** 12.5px `#aab6cf`, 2px left border `rgba(255,150,62,0.6)`, ties the loop to "Karl's diagnostic (01–02) … until 1300 is reached."

### Page 6 — Section 04 (Tracking & Accountability)
- **Purpose:** How and when progress is measured; the platform; the commitment.
- **Section Head:** ghost `04`, kicker `TRACKING & ACCOUNTABILITY`, h2 `When you'll see your progress`. Lead paragraph 14px.
- **Three monitoring loops** (3-col grid). Each column = a **loop badge header** + a card:
  - **Badge header:** a 26px solid **rounded-8 letter tile** + colored uppercase label. A = `#1740a9` tile / `SKILLS LOOP`; B = `#2f5bc4` tile / `PROGRESS LOOP`; C = `#ff963e` tile (text `#3a1e08`) / `MILESTONES` (label `#c7560a`).
  - **Card:** bordered, `border-radius:12px`, with a **3px colored top border** matching the badge. Contents: cadence (17px/600), sub-title (12px/600, colored), one-line detail (11.5px `#5a6373`). Data in *Data Model*.
  - (Note: an earlier version had a grey connector line behind the badges — it was intentionally removed. Do not add one.)
- **Elmy platform strip** — navy rounded card `border-radius:14px`, split 3px top bar (orange 34% / blue), Elmy logo (`assets/logo-elmy-white.svg`, 34px) + "Elmy" wordmark + vertical divider + sentence: "**The platform that powers all three loops.** Your practice, assignments, and error log live on Elmy, so every check above stays visible…".
- **A shared commitment** — block under a 2.5px `#14181f` top border: h3 (19px/600), paragraph, then **3 signature lines** (`1px #c4cad4` bottom border, 26px tall) labeled *Student signature*, *Date*, *Target test window*.

### Page 7 — Ecosystem / Closing (dark)
- **Purpose:** Confident close. Establish that **TestPrep delivers the whole service**, then market the sister brands, then a follow CTA.
- **Layout:** full dark navy section, rounded, split top bar, radial glow from top-center, `padding:30px 30px 28px`, `min-height:270mm`, `z-index:1` (so it covers the per-page footer pill on this page).
- **Delivery statement (centered):** kicker `DELIVERED BY TESTPREP`; centered TestPrep white logo (40px); h2 30px/600 white `One team, accountable for your result`; paragraph (`#aab6cf`) making clear every part is delivered by TestPrep.
- **Big statement line:** Inter 20px/500 white, max 54ch, with "That is the TestPrep difference." in orange.
- **Marketing strip ("Discover the Family"):** top divider; centered kicker `DISCOVER THE FAMILY` + h3 21px `The same thinking, everywhere you grow` + intro paragraph. Then **3 sister-brand cards** (dark feature cards, `opacity:0.92`): **weguide.** (`logo-sibling-white.svg`) "Helps students discover who they are before choosing who they'll become."; **prep me.** (`logo-prepme-white.png`) "Guided study and structured prep for every student."; **Elmy** (`logo-elmy-white.svg` + wordmark) "A practice, assignment & progress platform for students." These are framed as **marketing only**, NOT co-deliverers of this service.
- **Instagram QR CTA:** dark feature card `border-radius:16px`: a 96px **white** rounded tile holding `assets/qr-instagram.png`, beside kicker `SCAN TO FOLLOW`, h3 `See the community behind the roadmap`, paragraph ending "Follow **@testprep.lb** on Instagram."
- **Footer row:** top divider, TestPrep logo (22px) on the left, `Prepared for Karl Naddaf · 22 June 2026 · © House of Prep` on the right.

---

## Interactions & Behavior
This is a **static print document** — there are no click handlers, navigation, hover, loading, or error states. "Behavior" is entirely **print/pagination correctness**:
- Each of the 7 pages must land on its own physical A4 page (hard page breaks).
- Dark panels must render their backgrounds in print (color-adjust exact).
- No block may be split awkwardly across a page boundary (keep-together on cards/figures/rows).
- No widows/orphans; no isolated headings at a page bottom.
- The QR code, hero image, and all logos must remain crisp (use the provided raster assets at ≥2× their display size; SVG logos are vector).
- Responsiveness is **not** required — the target is a fixed A4 canvas.

## State Management
None. The only "state" is the **input data** for one student, applied at render/generation time. There is no runtime interactivity.

## Data Model (what changes per student)
The design is frozen; only this data varies. Mirror of `TestPrep Study Plan - MASTER TEMPLATE.json`:
- **Identity:** student_name, season_year ("Summer 2026"), diagnostic_label ("Practice Test 1"), diagnostic_date ("June 22, 2026"), instagram_handle.
- **Scores:** baseline (840), target (1300), gap (460), overall_accuracy ("near 37%"). The masthead bar math = baseline/1600 and target/1600 as percentages.
- **Session meta (masthead chips):** instruction_hours ("~36 hrs"), accommodation ("Yes"), max_session_length ("1 hr"), session_format ("Short focused blocks").
- **Brand stats (cover):** 20K+ Students, 40+ Partners, 12+ Years, 5+ Countries.
- **section_scores:** Reading & Writing {440, 36%, 24/66}; Math {400, 38%, 20/53}.
- **strengths:** Rule-based grammar — "transitions (67%) and punctuation (56%)"; Math mechanics — "algebra and geometry basics are intact"; Engagement — "you used 97.6% of the time, so effort isn't the issue".
- **blockers:** Reasoning — "inference (0/6) and command of evidence form the biggest R&W pool"; Advanced Math — "exponentials, factoring, and nonlinear form the deepest gap"; Seven blank grid-ins — "skipped with time to spare".
- **pattern_statement:** the one-line insight.
- **milestones (curve):** 980 (EARLY), ~1100 (CORE), ~1200 (PRECISION); plus baseline 840 (START) and target 1300 (TARGET).
- **hour_allocation:** Math 18 (50%, "deepest gaps"), Reading & Writing 15 (42%), Strategy 3. Bar widths are proportional to the largest (Math=100%).
- **order_of_attack:** FIRST 16 hrs [Advanced Math rebuild, Inference & command of evidence, Grid-in technique]; THEN 12 hrs [Words in context, Problem-solving & data, Grammar consolidation, Text structure & purpose]; FINALLY 8 hrs [Algebra precision, Geometry & trigonometry, Strategy & timing, Full-test reviews].
- **tracking_loops:** A Skills Loop "Every 2 weeks / Short skills check / Are the taught skills sticking?"; B Progress Loop "Every ~4 weeks / Full practice section / Cumulative gain and timing, with a progress note."; C Milestones "At each step / 980 → 1100 → 1200 → 1300 / Re-measure, confirm the curve, re-prioritize.".
- **engine_steps (FIXED for all students):** 01 Diagnostic Assessment, 02 Performance Gap Analysis, 03 Personalized Learning Plan, 04 Targeted Instruction, 05 Micro-Assessments, 06 Adaptive Optimization, 07 Full-Length Simulation & Iteration (+ their one-line descriptions and icons, in the source SVG).

---

## Design Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| navy_ink | `#0c1730` | dark bands, panels, footer pill, lane (Math) |
| primary_blue | `#1740a9` | section accents, data fills, numerals |
| mid_blue | `#2f5bc4` | secondary lane/loop, gradient end |
| accent_blue_text | `#7ea0e8` | target score, highlighted words on dark |
| accent_orange | `#ff963e` | gap/target, step 07, kickers, single highlights |
| orange_deep | `#e87f2a` | hatch stripe pair |
| orange_text_on_light | `#c7560a` | orange text/labels on light bg |
| orange_text_darker | `#9a4708` | FIRST chip text |
| positive_green | `#1f8a5b` | "what's working" label |
| text_primary | `#14181f` | headings/body strong |
| text_body | `#2a2f38` | lead paragraphs |
| text_secondary | `#3a414c` | list/body |
| text_muted | `#5a6373` | captions, summaries |
| text_faint | `#8a93a3` | small captions, axis labels |
| ghost_number | `#46557a` | engine card ghost numerals |
| section_ghost | `#d6deec` | section-head ghost numerals |
| border | `#e4e7ee` | card borders, dividers |
| hairline | `#eef0f4` | gauge tracks, thin dividers, FINALLY chip bg |
| surface_tint | `#fbfcfe` | figure background |
| page_backdrop | `#f4f5f8` | screen body bg (white in print) |
| chip_first_bg / text | `#fbe6d4` / `#9a4708` | FIRST skill chips |
| chip_then_bg / text | `#dfe7f6` / `#1740a9` | THEN skill chips |
| chip_finally_bg / text | `#eef0f4` / `#4a5566` | FINALLY skill chips |
| dark text tints | `#eef1f7` `#cdd6e8` `#aab6cf` `#9fb0d6` `#8fa2cb` `#8794ad` `#6e7a93` | text on navy, light→faint |

### Typography
- **Family:** **Inter** (Google Fonts), weights 400/500/600/700/800. Used everywhere — **including SVG chart text**. No other typeface.
- **Scale:** hero numeral 54px/700 (ls −0.02em); cover H1 44px/600; dark-page H2 30–38px/600–700; section H2 25px/600; section ghost numeral 42px/600; engine card ghost 34px/700; card titles 15–19px/600; body 12.5–14px/400 (lh 1.5–1.6); captions/footnotes 11.5–12px; small mono-style labels 8.5–9.5px/500–600 with letter-spacing 0.12–0.22em (these are Inter, not a monospaced font).

### Border radius
band/full-page `18px` · feature card `16px` · figure/dark card `14px` · standard card `12px` · icon tile `10–11px` · lane bar `10px` · gauge track `4px` · chip/letter-badge `8px` · pill `999px`. **No square corners anywhere.**

### Spacing & layout
content max-width `760px`; light body padding `0 30px`; dark sections `margin:6px 16px 0` + ~30–32px internal padding; common card padding `13–20px`; grid/flex gaps `8–18px`. Split top accent bar = 4px, divided ~44/56 (orange/blue).

### Decorations
- Split top bar (orange→blue) on every dark section, top corners rounded to the band.
- Radial blue glow overlay on dark sections: `radial-gradient(... rgba(23,64,169,0.4–0.55), transparent ~55–60%)`.
- Masthead progress bar fill: `linear-gradient(90deg,#1b3a78,#2f5bc4)`; orange hatch: `repeating-linear-gradient(45deg,#ff963e,#ff963e 6px,#e87f2a 6px,#e87f2a 12px)`.

## Assets
All in `./assets/` (copied into this bundle):
- `cover-hero.png` — 1052×1045 PNG, page-1 cover photo. Shared across students unless a student-specific approved image is supplied.
- `logo-testprep-white.png` — TestPrep wordmark, white. Footer pill, closing page, ecosystem.
- `logo-elmy-white.svg` — Elmy mark (vector). Tracking strip + family card.
- `logo-prepme-white.png` — "prep me." wordmark, white. Family card.
- `logo-sibling-white.svg` — "weguide." wordmark, white (vector). Family card.
- `qr-instagram.png` — 665×665 PNG, Instagram QR for **@testprep.lb**. Closing CTA. Replace only if the account changes.

In your codebase, place these in your static/asset pipeline and reference by your own paths. Logos are brand assets — if your app already has an official TestPrep/House of Prep brand system, prefer those canonical files.

## Files in this bundle
- `TestPrep SAT Roadmap v2.dc.html` — **the source design (read this for any exact value).** Authored in an in-house runtime; treat the markup inside `<x-dc>…</x-dc>` and its inline styles as the spec. Ignore `support.js`, the `<x-dc>`/`<helmet>` wrappers, and the trailing `data-dc-script` tag when porting.
- `TestPrep Study Plan - MASTER TEMPLATE.json` — the per-student data contract (frozen design + editable `student_inputs`). Use this to model your template's inputs.
- `assets/` — the images/logos above.

## Editorial rules (carry into any regeneration)
- The student's diagnostic report is the only source of truth; never invent scores, names, dates, services, or partnerships.
- **No em-dashes** or dash-as-pause; use full sentences, colons for label lists, structured transitions. Hyphens only inside genuine compounds (rule-based, grid-ins, high-impact).
- Never frame the target as guaranteed; frame it as earned/credible.
- Tie every number (hour weighting, milestones, priorities) back to a real diagnostic pattern so the plan reads as derived, not arbitrary.
- TestPrep is the sole deliverer of the service; sister brands appear for **marketing** only.
