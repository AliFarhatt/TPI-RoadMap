# Migration guide: legacy master JSON → v2 architecture

The legacy `TestPrep Study Plan - MASTER TEMPLATE.json` mixed design configuration, brand data, hand-written analysis, and student inputs in one `student_inputs` block. In v2 no conflicting old field remains active; every legacy field maps to exactly one new home:

| Old field | New source |
|---|---|
| `student_name` / `_upper` / `_slug` | `case_inputs.student.student_name` (derivatives generated in the view model) |
| `season_year` | `case_inputs.season` (or derived from the diagnostic date) |
| `diagnostic_label` | diagnostic template name (`config/diagnostic-templates/...`) |
| `diagnostic_date` | `case_inputs.diagnostic.date` |
| `instagram_handle` | frozen `config/brand-config.json` |
| `baseline` | supplied scaled score `case_inputs.scores.total_scaled` |
| `target` | `case_inputs.goal.target_sat_score` |
| `gap` | **calculated** (target − baseline) |
| `overall_accuracy` | **calculated** from answers |
| `instruction_hours` / `_int` | **calculated** final component total after explicit lesson/strategy allocation; always equals its displayed parts |
| `accommodation`, `max_session_length`, `session_format` | `case_inputs.availability.*` |
| `brand_stats` | frozen brand configuration |
| `section_scores` | supplied scaled scores + **calculated** accuracy/counts |
| `strengths` | **generated** from lesson results |
| `blockers` | **generated** priorities |
| `pattern_statement` | **generated** interpretation |
| `milestones` | replaced by reassessment checkpoints (no invented scores) |
| `hour_allocation` | **calculated** section totals + itemized strategy hours |
| `order_of_attack` | **generated** course phases from lesson priorities |
| `tracking_loops` | fixed template content (checkpoint loop reworded to avoid score promises) |
| `engine_steps` | fixed design content (frozen in the roadmap template) |

To migrate a legacy record: create a v2 individual case with the identity/scores/goal/availability fields above, attach the diagnostic answers, and run the engine. Everything the old file hand-wrote is now generated. Karl's legacy record is preserved read-only in `examples/legacy-karl/`.
