# Calculation guide — v2.4

Every reported hour can be reproduced from `config/lesson-catalog.json`, `config/calculation-rules.json`, and the student's case input.

## 1. Per-question analysis

1. Module weight: Module 1 = `1.00`; Module B = `1.20`.
2. Difficulty is metadata only in v2.4 and does not change weight.
3. The explicit Boolean `correct` field takes priority over answer-string comparison.
4. Blank answers are incorrect but are not automatically classified as conceptual weakness.
5. Question weight = module weight.
6. Error labels remain conservative: omitted, guessed, rushed, correct-but-slow, teacher-classified, or undetermined.

## 2. Accuracy

For each lesson:

```text
raw accuracy = correct questions / assessed questions

weighted accuracy = sum(correct question weights)
                  / sum(all assessed question weights)
```

Weighted accuracy drives the performance multiplier. Raw accuracy is shown for readability.

## 3. Diagnostic coverage

- No questions: not assessed, floor `1.00`, performance unknown, mini-assessment recommended.
- One question: limited, floor `1.00`.
- Two or three questions: moderate when multiple subskills are represented; otherwise limited.
- Four or more questions: strong when multiple subskills are represented; otherwise moderate.

Question count alone cannot prove broad coverage.

## 4. Calibrated base-hour rubric

Each lesson stores:

```text
breadth score
difficulty score
SAT strategy score
calibrated base hours
```

The three 1–3 scores form an explanatory rubric profile. The executable base hour is the lesson-specific `calibrated_base_hours` value. There is no universal sum-to-hours conversion in v2.4 because the approved table contains lessons with identical score totals but different approved base times.

Approved totals:

```text
English calibrated base = 5.16 h
Math calibrated base    = 8.92 h
Combined lessons        = 14.08 h
```

The engine validates that every catalog lesson's executable base hour equals its calibrated rubric value.

## 5. Performance and coverage multiplier

Performance multiplier:

| Weighted accuracy | Multiplier |
|---:|---:|
| 90–100% | 0.50 |
| 75–89.99% | 0.75 |
| 60–74.99% | 1.00 |
| 40–59.99% | 1.50 |
| Below 40% | 2.00 |

```text
final multiplier = max(performance multiplier, coverage floor)
```

An unassessed lesson uses final multiplier `1.00` and retains full calibrated base time before other evidence-based changes.

## 6. Foundational override

```text
when foundational level is none:
core hours = calibrated base × final multiplier

when foundational level is moderate or major:
core hours = max(
  calibrated base × final multiplier,
  calibrated base × foundational multiplier
)
```

Concern multipliers:

- moderate: `1.25`
- major: `1.50`

The neutral state does not impose a `base × 1.00` floor, because that would prevent strong performance from reducing lesson depth. A declared gap or strong explicit guessing evidence is required. Incorrect answers alone do not create a foundational override.

## 7. Additive adjustments

Weak subskill clusters:

- one cluster: `+0.25 h`
- two clusters: `+0.50 h`
- three or more: `+0.75 h`

A cluster normally requires at least two questions in one subskill with accuracy below 60%, or an explicit teacher flag.

Timing:

- repeated correct-but-slow: `+0.25 h`
- repeated rushing: `+0.25 h`
- severe pacing: `+0.50 h`

Timing requires reliable per-question time data.

High target:

- target at least 1400
- `+0.25 h`
- requires distinct advanced evidence, such as an incorrect hard question, slow hard-question work, recurring advanced careless errors, or a teacher-documented advanced form that remains unverified

Limited or missing coverage by itself does not trigger this addition.

Teacher override:

- quarter-hour increments
- written reason required

Possible duplicated evidence produces an audit warning.

## 8. Lesson calculation

```text
unrounded lesson hours = core hours
                       + subskill adjustment
                       + timing adjustment
                       + high-target adjustment
                       + teacher override

pre-budget lesson hours = max(0.25, unrounded lesson hours)
```

All lessons, including broad lessons, use the same `0.25 h` absolute floor.

**No lesson-level rounding is applied.** A result such as `0.64 h` or `1.21 h` is retained.

## 9. Priority

- Critical: below 40% or a major foundational gap.
- High: 40–59.99%, moderate foundational gap, or at least two weak clusters.
- Medium: 60–89.99%, not assessed, or limited coverage.
- Essential Review: at least 90% with moderate or strong coverage.

No lesson is skipped or assigned zero hours.

## 10. Individual strategy time

Orientation:

```text
SAT format            0.25 h
diagnostic review     0.25 h
study-plan discussion 0.25 h
default/minimum        0.75 h
```

Final review default:

```text
final strategy review 0.25 h
pacing review         0.25 h
mixed timed practice  0.50 h
error-log review      0.50 h
default total         1.50 h
minimum total         1.00 h
```

## 11. Individual program allocation

```text
unrounded component total = sum(all live lesson hours)
                          + orientation
                          + final review
                          + any additional live strategy blocks
```

Program range: `14–35 h`.

### Below 14 h

Add the exact shortage to named components in this order:

1. not-assessed lessons
2. limited-coverage lessons
3. high-breadth lessons that received very little time
4. mixed timed practice
5. error-log review
6. test strategy and pacing

### Above 35 h

Reduce actual components through four stages:

1. Move remediation/repetition above calibrated base to targeted homework.
2. Remove optional strategy and reduce final review toward `1.00 h`; preserve orientation at `0.75 h`.
3. Compress the strongest, best-covered lessons toward `0.25 h`.
4. Remove the exact remaining amount from the next eligible component.

The actual unrounded component sum must be at most 35 h. A headline-only clamp is prohibited.

## 11. Unit-based order of attack

The roadmap does not sequence isolated lessons as unrelated chips. The 28 existing lessons are grouped into eight official SAT units:

- Craft and Structure
- Expression of Ideas
- Information and Ideas
- Standard English Conventions
- Algebra
- Advanced Math
- Problem-Solving and Data Analysis
- Geometry and Trigonometry

Each lesson appears exactly once. Unit labels are organizational and do not create additional lessons. The engine calculates aggregate unit urgency from the priorities and live hours of the lessons inside the unit, ranks the eight units, and assigns them intact to FIRST, THEN, and FINALLY waves.

## 12. Final rounding

Only after all component allocation is finished:

```text
final scheduled total = ceil(unrounded component total × 4 − ε) / 4
```

This always rounds the final total upward to the next quarter hour; totals already on a quarter hour remain unchanged. The small ε prevents floating-point noise from raising an exact quarter-hour value. Reports preserve both values:

- unrounded component total
- final scheduled total
- final rounding adjustment

Section totals are sums of unrounded lesson allocations, so their displayed sum can differ from the scheduled total only by the documented final rounding adjustment.

## 13. Homework

Homework is based on the final live time of each lesson:

| Priority | Multiplier range | Minimum |
|---|---:|---:|
| Essential Review | 0.50×–1.00× | 0.25 h |
| Medium | 1.00×–1.50× | 0.50 h |
| High | 1.50×–2.00× | 0.75 h |
| Critical | 2.00×–2.50× | 1.00 h |

Homework endpoints are rounded upward to the next 0.25 h. Any live time transferred during maximum-budget allocation is included in the targeted independent-practice requirement.

## 14. Sessions and duration

Normal session length is 1–2 hours. A single lesson is not scheduled for more than 2.5 hours in one session. Longer lessons are split.

Individual duration guidance:

- 14–18 h: 4–6 weeks
- 18.25–24 h: 6–8 weeks
- 24.25–30 h: 8–10 weeks
- 30.25–35 h: 10–14 weeks

## 15. Group calculation

Every student is fully calculated first.

```text
unrounded group lesson need = max individual lesson need
                            × (1 + size adjustment + diversity adjustment)
```

No group lesson rounding is applied. Only the final group scheduled total is rounded upward to the next quarter hour.

A one-student group uses the individual orientation/review and 14–35 h range. Larger groups use the configured ranges in `calculation-rules.json`.

Maximum allocation stages operate on actual group components. Size/diversity overhead is reduced first; student-specific need that cannot remain in the common core is recorded as supplemental subgroup or individual support rather than hidden.
