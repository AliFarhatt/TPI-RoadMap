# Shared group roadmap and three-page group report

The group workflow creates **one shared course**, not one roadmap per student. Open a group case, enter or import each student's diagnostic, then use **Create group roadmap** or **Create three page group report**.

## Eligibility and exclusions

Each student must use a supported diagnostic template, have unique mapped question records, and include scoreable data for Reading and Writing Module 1, Reading and Writing Module B, Math Module 1, and Math Module B. Material failures exclude that student. Generation continues with the remaining students, but a warning identifies every excluded student and reason. At least two eligible students are required.

Missing scaled scores do not invalidate otherwise reliable diagnostic answers. They reduce only the sample size of the corresponding score statistic.

## Aggregation and similarity

Correctness-based metrics use pooled counts:

```text
pooled accuracy = sum(correct) / sum(administered)
```

They are never calculated as an unweighted mean of student percentages. Scaled scores use arithmetic mean, minimum, maximum, range, population standard deviation, and sample size over the valid provided scores.

Similarity uses one comparable percentage per student for accuracy measures. Central thresholds are:

- Moderate: score SD ≥ 40 points or accuracy SD ≥ 0.08.
- High: score SD ≥ 75 points or accuracy SD ≥ 0.15.

A high lesson-level SD adds a mixed-readiness flag and tiered-practice note. It does not by itself classify the entire group as high variation or split the lesson.

## Shared course calculation

The pooled question profile runs through the established lesson logic once: mappings, coverage, module weights, lesson rubric, performance multipliers, weak clusters, foundational evidence, priorities, dependencies, configured unit ordering, caps, redistribution, and final category rounding.

Each raw individual-equivalent lesson and strategy requirement then receives the fixed `2.0` group instructional-time multiplier. The multiplier does not depend on group size. Existing group caps and whole-hour Reading and Writing, Math, and strategy rounding remain active. The final plan is never a sum, average, or concatenation of individual roadmaps.

## Outputs

The shared group roadmap presents the group profile, similarity, pooled strengths and priorities, one ordered 28-lesson sequence, group hours, strategy time, duration, warnings, and mixed-readiness notes.

The group report is exactly three A4 pages:

1. Group overview, score summaries, pooled completion/accuracy, similarity, section bars, student snapshot, and exclusions.
2. Module and difficulty bars, strengths, priorities, important variation flags, and any non-stigmatizing outlier notes.
3. Shared course summary, complete lesson sequence and hours, teaching approach, and material warnings.

## Known limitations

- Scaled scores are never estimated from raw accuracy.
- The supported diagnostic must provide reliable question-to-lesson mappings.
- Timing and guessing adjustments are not invented for pooled question records; only evidence that can be represented reliably at group level is used.
- Teacher overrides are not added across students. Group-level instructional judgment should be applied after reviewing the generated shared plan.
- Browser PDF output depends on printing with A4 paper, background graphics, and default 100% scale.
