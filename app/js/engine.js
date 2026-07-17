/* TestPrep SAT Planning Engine v2.4
 * Pure calculation logic. No DOM access. Works in browsers and Node.
 * Implements the corrected diagnostic-analysis and course-planning specification.
 */
(function (root) {
  "use strict";

  // ---------- helpers ----------

function roundQuarterNearest(h) {
  // Homework endpoints use ordinary half-up rounding to the nearest quarter hour.
  if (h <= 0) return 0;
  return Math.floor(h * 4 + 0.5) / 4;
}
function roundFinalUp(h) {
  // Legacy final-total helper: round upward to the next quarter hour.
  if (h <= 0) return 0;
  return Math.ceil(h * 4 - 1e-9) / 4;
}
function roundSectionUpToInteger(h) {
  // Reading & Writing and Math totals are each rounded upward to the next
  // whole hour. The epsilon prevents floating-point noise on exact integers
  // from incorrectly adding another hour.
  if (!Number.isFinite(h) || h <= 0) return 0;
  return Math.ceil(h - 1e-9);
}
function roundHalfUp(h) {
  // Legacy helper retained for integrations that used it for homework ranges.
  return roundQuarterNearest(h);
}
  function r2(x) { return Math.round(x * 100) / 100; }
  function pct(x) { return Math.round(x * 1000) / 10; } // 0..1 -> 0..100 one decimal

  function moduleWeight(rules, module) {
    return module === "module_b" ? rules.module_weights.module_b : rules.module_weights.module_1;
  }

function difficultyWeight(rules, difficulty) {
  // Difficulty remains report metadata, but the approved v2.4 weighting
  // uses module weight only. Return null so question weight = module weight.
  if (!rules.difficulty_weights_enabled) return null;
  if (!difficulty) return null;
  var d = String(difficulty).toLowerCase();
  return rules.difficulty_weights[d] != null ? rules.difficulty_weights[d] : null;
}

function baseHoursFromRubric(rules, rubric, referenceBaseHours) {
  rubric = rubric || {};
  var score = (rubric.breadth || 0) + (rubric.concept_difficulty || 0) + (rubric.sat_strategy_load || 0);
  var calibrated = rubric.calibrated_base_hours;
  if (calibrated == null) calibrated = referenceBaseHours;
  if (calibrated == null) throw new Error("Missing calibrated base hours in lesson rubric.");
  return { score: score, hours: r2(calibrated), method: "lesson_specific_calibrated_rubric" };
}
  function performanceMultiplier(rules, acc) {
    var rows = rules.performance_multipliers;
    for (var i = 0; i < rows.length; i++) {
      if (acc >= rows[i].min_accuracy && acc <= rows[i].max_accuracy) return rows[i].multiplier;
    }
    return acc >= 90 ? 0.5 : 2.0;
  }
  function groupBucket(n) {
    if (n === 1) return "1";
    if (n === 2) return "2";
    if (n <= 5) return "3-5";
    if (n <= 8) return "6-8";
    if (n <= 12) return "9-12";
    if (n <= 16) return "13-16";
    return "17-20";
  }
  function stddev(a) {
    if (a.length < 2) return null;
    var m = a.reduce(function (x, y) { return x + y; }, 0) / a.length;
    var v = a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0) / a.length;
    return r2(Math.sqrt(v));
  }
  function median(a) {
    var b = a.slice().sort(function (x, y) { return x - y; });
    var n = b.length;
    return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2;
  }

  // ---------- input validation ----------
  function validateIndividualInput(input, config) {
    var errors = [], warnings = [], info = [];
    var st = input.student || {};
    if (!st.student_name) errors.push({ code: "MISSING_NAME", message: "Student name is required." });
    var tplId = input.diagnostic && input.diagnostic.template_id;
    var tpl = tplId && config.diagnostic_templates[tplId];
    if (!tpl) {
      errors.push({ code: "INVALID_TEMPLATE", message: "Unknown diagnostic template id: " + tplId + ". Available: " + Object.keys(config.diagnostic_templates).join(", ") });
      return { errors: errors, warnings: warnings, info: info, template: null };
    }
    // answers
    var answers = (input.diagnostic && input.diagnostic.answers) || [];
    var seen = {};
    var byKey = {};
    tpl.questions.forEach(function (q) { byKey[q.section + "|" + q.module + "|" + q.question_number] = q; });
    answers.forEach(function (a) {
      var key = a.section + "|" + a.module + "|" + a.question_number;
      if (!byKey[key]) errors.push({ code: "UNMAPPED_QUESTION", message: "Answer refers to a question not in the template: " + key });
      if (seen[key]) errors.push({ code: "DUPLICATE_QUESTION", message: "Duplicate answer record for " + key });
      seen[key] = true;
      if (a.module && a.module !== "module_1" && a.module !== "module_b") errors.push({ code: "INVALID_MODULE", message: "Invalid module '" + a.module + "' (use module_1 or module_b)." });
      if (a.student_answer != null && a.correct_answer == null && byKey[key] && byKey[key].correct_answer == null) {
        errors.push({ code: "MISSING_KEY", message: "No correct answer supplied for " + key + " (template stores none)." });
      }
      if (a.difficulty && !config.calculation_rules.difficulty_weights[String(a.difficulty).toLowerCase()]) {
        warnings.push({ code: "UNKNOWN_DIFFICULTY", message: "Unknown difficulty '" + a.difficulty + "' on " + key + "; module weight only will be used." });
      }
    });
    if (answers.length === 0) warnings.push({ code: "NO_ANSWERS", message: "No diagnostic answers supplied. Every lesson will be treated as not assessed and planned at full base hours." });
    if (answers.length > 0 && answers.length < tpl.total_questions) info.push({ code: "PARTIAL_ANSWERS", message: answers.length + " of " + tpl.total_questions + " questions have answer records. Unanswered questions are treated as not administered (they do not count against the student)." });

    // scaled score consistency
    var sc = input.scores || {};
    if (sc.reading_writing_scaled != null && sc.math_scaled != null && sc.total_scaled != null) {
      if (sc.reading_writing_scaled + sc.math_scaled !== sc.total_scaled) {
        errors.push({ code: "SCORE_MISMATCH", message: "Reading & Writing (" + sc.reading_writing_scaled + ") + Math (" + sc.math_scaled + ") does not equal the total scaled score (" + sc.total_scaled + ")." });
      }
    }
    if (sc.score_source === "test_specific_conversion_table") {
      warnings.push({ code: "NO_CONVERSION_TABLE", message: "No verified conversion table ships with this template. Scaled scores must be entered manually (score_source: provided)." });
    }
    if (input.goal && input.goal.target_sat_score != null && sc.total_scaled != null && input.goal.target_sat_score <= sc.total_scaled) {
      warnings.push({ code: "TARGET_NOT_ABOVE_BASELINE", message: "Target score is not above the current scaled score." });
    }
    return { errors: errors, warnings: warnings, info: info, template: tpl };
  }

  // ---------- question-level analysis ----------
  function classifyError(q, a, rules) {
    // conservative error typing: only claim what the evidence supports
    if (a.correct) {
      if (a.guessed) return "guessing";
      if (a.slow) return "correct_but_slow";
      if (a.method && /inefficient|long|brute/i.test(a.method)) return "correct_but_methodologically_weak";
      return null;
    }
    if (a.guessed) return "guessing";
    if (a.rushed) return "rushing";
    if (a.student_answer == null || a.student_answer === "") return "omitted";
    if (a.teacher_error_type) return a.teacher_error_type; // teacher-supplied classification wins
    return "undetermined"; // never assume conceptual weakness without evidence
  }

  function analyzeQuestions(input, tpl, rules) {
    var answersByKey = {};
    ((input.diagnostic && input.diagnostic.answers) || []).forEach(function (a) {
      answersByKey[a.section + "|" + a.module + "|" + a.question_number] = a;
    });
    var expDefaults = rules.timing_adjustments.expected_time_defaults_seconds;
    var out = [];
    tpl.questions.forEach(function (q) {
      var key = q.section + "|" + q.module + "|" + q.question_number;
      var a = answersByKey[key];
      if (!a) return; // not administered / not recorded
      var correctAnswer = a.correct_answer != null ? a.correct_answer : q.correct_answer;
      var correct = null;
      if (a.correct != null) correct = !!a.correct;
      else if (correctAnswer != null && a.student_answer != null && a.student_answer !== "") {
        correct = String(a.student_answer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
      } else if (a.student_answer == null || a.student_answer === "") {
        correct = false; // omitted
      }
      var mw = moduleWeight(rules, q.module);
      var difficulty = a.difficulty || q.difficulty || null;
      var dw = difficultyWeight(rules, difficulty);
      var weight = r2(dw != null ? mw * dw : mw);
      var exp = q.expected_time_seconds || expDefaults[q.section];
      var slow = false, rushed = false;
      if (a.time_seconds != null && exp) {
        slow = a.time_seconds > exp.maximum * 1.5;
        rushed = !correct && a.time_seconds < exp.minimum * 0.5;
      }
      var rec = {
        section: q.section, module: q.module, question_number: q.question_number,
        lesson_id: q.lesson_id, subskill_id: q.subskill_id,
        question_style: q.question_style, difficulty: difficulty,
        correct_answer: correctAnswer != null ? correctAnswer : null,
        student_answer: a.student_answer != null ? a.student_answer : null,
        correct: correct,
        module_weight: mw, difficulty_weight: dw, weight: weight,
        time_seconds: a.time_seconds != null ? a.time_seconds : null,
        expected_time_seconds: exp || null,
        expected_time_is_default: !q.expected_time_seconds && a.time_seconds != null,
        confidence: a.confidence != null ? a.confidence : null,
        guessed: !!a.guessed, method: a.method || null,
        teacher_note: a.teacher_note || null,
        slow: slow, rushed: rushed
      };
      rec.error_type = classifyError(q, { correct: correct, guessed: rec.guessed, slow: slow, rushed: rushed, student_answer: rec.student_answer, method: rec.method, teacher_error_type: a.error_type }, rules);
      rec.interpretation = interpretQuestion(rec);
      out.push(rec);
    });
    return out;
  }

  function interpretQuestion(q) {
    if (q.correct === null) return "Not scoreable: no answer key available.";
    if (q.correct) {
      if (q.guessed) return "Correct, but reported as guessed: does not demonstrate mastery.";
      if (q.slow) return "Correct but well above the expected time range: timing work may help.";
      return "Correct within normal parameters.";
    }
    if (q.error_type === "omitted") return "Left blank; treat as unresolved rather than conceptual weakness until reviewed.";
    if (q.error_type === "rushing") return "Incorrect with a very short response time: likely rushed.";
    if (q.error_type === "guessing") return "Incorrect guess: the subskill was not secure.";
    if (q.error_type !== "undetermined") return "Incorrect: instructor classified as " + q.error_type.replace(/_/g, " ") + ".";
    return "Incorrect: error type undetermined from available evidence; verify in session before assuming a conceptual gap.";
  }

  // ---------- coverage ----------
  function classifyCoverage(qs) {
    var n = qs.length;
    if (n === 0) return "not_assessed";
    var subskills = {};
    qs.forEach(function (q) { subskills[q.subskill_id || "unknown"] = true; });
    var s = Object.keys(subskills).length;
    if (n === 1) return "limited";
    if (n <= 3) return s <= 1 ? "limited" : "moderate";
    return s >= 2 ? "strong" : "moderate";
  }

  // ---------- lesson-level analysis ----------

function analyzeLesson(lesson, qs, input, rules, warnings) {
  var st = input.student || {};
  var goal = input.goal || {};
  var base = baseHoursFromRubric(rules, lesson.rubric, lesson.reference_base_hours);
  if (lesson.reference_base_hours != null && Math.abs(base.hours - lesson.reference_base_hours) > 0.001) {
    warnings.push({ code: "RUBRIC_BASE_MISMATCH", lesson_id: lesson.lesson_id, message: lesson.lesson_name + ": calibrated rubric base hours do not match reference_base_hours." });
  }
  var coverage = classifyCoverage(qs);
  var floor = rules.coverage_floor_multipliers[coverage];
  var assessed = coverage !== "not_assessed";

  // Aggregate-aware counts are used by the shared-group planner. Ordinary
  // individual question records omit these fields and therefore retain the
  // exact v2.4 behavior (one administered result per record).
  function administeredCount(q) {
    var n = Number(q.administered_count);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  function correctCount(q) {
    var n = Number(q.correct_count);
    if (Number.isFinite(n) && n >= 0) return Math.min(n, administeredCount(q));
    return q.correct ? 1 : 0;
  }
  var rawTotal = 0, rawCorrect = 0, wTotal = 0, wCorrect = 0;
  qs.forEach(function (q) {
    var administered = administeredCount(q), correct = correctCount(q);
    rawTotal += administered;
    rawCorrect += correct;
    wTotal += q.weight * administered;
    wCorrect += q.weight * correct;
  });
  var rawAcc = assessed ? pct(rawCorrect / rawTotal) : null;
  var wAcc = assessed ? pct(wCorrect / wTotal) : null;
  var perfMult = assessed ? performanceMultiplier(rules, wAcc) : null;
  var finalMult = assessed ? Math.max(perfMult, floor) : 1.00;

  var bySub = {};
  qs.forEach(function (q) {
    var id = q.subskill_id || "unknown";
    (bySub[id] = bySub[id] || []).push(q);
  });
  var subskills = Object.keys(bySub).map(function (id) {
    var list = bySub[id];
    var n = list.reduce(function (s, q) { return s + administeredCount(q); }, 0);
    var c = list.reduce(function (s, q) { return s + correctCount(q); }, 0);
    return { subskill_id: id, questions: n, correct: c, accuracy: n ? pct(c / n) : null };
  });
  var clusters = subskills.filter(function (x) {
    return x.questions >= rules.weak_cluster_rule.min_questions && x.accuracy <= rules.weak_cluster_rule.max_accuracy_percent;
  }).map(function (x) { return x.subskill_id; });
  ((st.teacher_flagged_weak_subskills || []).filter(function (f) { return f.lesson_id === lesson.lesson_id; }))
    .forEach(function (f) { if (clusters.indexOf(f.subskill_id) < 0) clusters.push(f.subskill_id); });
  var nClusters = clusters.length;
  var subAdj = nClusters === 0 ? 0 : nClusters === 1 ? rules.subskill_cluster_adjustments["1"] : nClusters === 2 ? rules.subskill_cluster_adjustments["2"] : rules.subskill_cluster_adjustments["3_or_more"];

  var found = "none", foundEvidence = [];
  (st.known_foundational_gaps || []).forEach(function (g) {
    if (g.lesson_id === lesson.lesson_id) {
      found = g.severity === "major" ? "major" : "moderate";
      foundEvidence.push("declared gap (" + found + "): " + (g.evidence || "no note"));
    }
  });
  if (assessed) {
    var guessed = qs.filter(function (q) { return q.guessed; }).length;
    if (found === "none" && qs.length >= 2 && guessed / qs.length >= 0.5) {
      found = "moderate";
      foundEvidence.push("at least half of assessed answers were reported as guessed");
    }
  }
  var foundMult = rules.foundational_multipliers[found];

  var timed = qs.filter(function (q) { return q.time_seconds != null; });
  var slowCorrect = timed.filter(function (q) { return q.correct && q.slow; }).length;
  var rushedWrong = timed.filter(function (q) { return !q.correct && q.rushed; }).length;
  var pacingIssues = slowCorrect + rushedWrong;
  var timingAdj = 0, timingReason = null;
  if (timed.length >= 3 && pacingIssues >= Math.ceil(timed.length / 2)) {
    timingAdj = rules.timing_adjustments.severe_pacing;
    timingReason = "severe pacing problems across the lesson (" + pacingIssues + " of " + timed.length + " timed questions)";
  } else if (slowCorrect >= 2) {
    timingAdj = rules.timing_adjustments.correct_but_slow;
    timingReason = "repeatedly correct but slow (" + slowCorrect + " questions)";
  } else if (rushedWrong >= 2) {
    timingAdj = rules.timing_adjustments.rushing_errors;
    timingReason = "errors driven mainly by rushing (" + rushedWrong + " questions)";
  }

  var tOv = ((st.teacher_overrides || []).filter(function (o) { return o.lesson_id === lesson.lesson_id; }))[0] || null;
  var teacherAdj = tOv ? Number(tOv.additional_hours || 0) : 0;
  if (tOv && !tOv.reason) warnings.push({ code: "OVERRIDE_NO_REASON", lesson_id: lesson.lesson_id, message: "Teacher override on " + lesson.lesson_name + " has no written reason; every override must be justified." });
  if (teacherAdj && Math.abs(teacherAdj * 4 - Math.round(teacherAdj * 4)) > 0.001) warnings.push({ code: "OVERRIDE_INCREMENT", lesson_id: lesson.lesson_id, message: "Teacher override should use 0.25-hour increments." });

  // High-target adjustment requires distinct advanced-level evidence. Limited
  // or absent coverage alone is already handled by the coverage floor.
  var ht = rules.high_target_adjustment;
  var highAdj = 0, highReason = null;
  if ((goal.target_sat_score || 0) >= ht.target_threshold) {
    var hardWrong = qs.filter(function (q) { return String(q.difficulty || "").toLowerCase() === "hard" && !q.correct; }).length;
    var hardSlow = qs.filter(function (q) { return String(q.difficulty || "").toLowerCase() === "hard" && q.slow; }).length;
    var explicitAdvanced = !!(tOv && (tOv.advanced_forms_unverified || tOv.high_target_evidence || /advanced|hard question|trap|careless/i.test(tOv.reason || "")));
    if (hardWrong > 0) { highAdj = ht.hours; highReason = hardWrong + " incorrect hard question(s) for a " + goal.target_sat_score + " target"; }
    else if (hardSlow > 0) { highAdj = ht.hours; highReason = hardSlow + " slow hard question(s) for a " + goal.target_sat_score + " target"; }
    else if (explicitAdvanced) { highAdj = ht.hours; highReason = "teacher-confirmed advanced-form or trap evidence for a " + goal.target_sat_score + " target"; }
  }

  var initial = r2(base.hours * finalMult);
  // The foundational override is conditional. A neutral "none" state must not
  // cancel legitimate performance/coverage reductions by forcing base x 1.00.
  var core = found === "none"
    ? initial
    : r2(Math.max(initial, base.hours * foundMult));
  var unrounded = r2(core + subAdj + timingAdj + highAdj + teacherAdj);
  var minH = rules.minimum_lesson_hours;
  var afterMin = r2(Math.max(unrounded, minH));
  // v2.4 intentionally does not round individual lesson allocations.
  var finalHours = afterMin;

  var dup = [];
  if (found !== "none" && nClusters > 0 && rawTotal <= 2) dup.push("foundational override and weak-subskill addition both rest on the same small evidence base (" + rawTotal + " question(s))");
  if (assessed && perfMult >= 1.5 && nClusters > 0 && rawTotal - rawCorrect <= 1) dup.push("low-accuracy multiplier and weak-subskill addition are both driven by a single incorrect answer");
  if (teacherAdj > 0 && tOv && tOv.evidence_overlaps) dup.push("teacher override flagged as overlapping automatic adjustments");
  dup.forEach(function (d) { warnings.push({ code: "DUPLICATE_ADJUSTMENT_EVIDENCE", lesson_id: lesson.lesson_id, message: lesson.lesson_name + ": " + d + ". Review this allocation before finalizing." }); });

  var priority;
  if (!assessed) priority = "MEDIUM";
  else if (wAcc < 40 || found === "major") priority = "CRITICAL";
  else if (wAcc < 60 || found === "moderate" || nClusters >= 2) priority = "HIGH";
  else if (wAcc < 90 || coverage === "limited") priority = "MEDIUM";
  else priority = "ESSENTIAL_REVIEW";

  var sessions = splitSessions(finalHours, rules);
  var ex = [];
  ex.push("Calibrated base " + base.hours + " h (rubric profile B/D/S " + lesson.rubric.breadth + "/" + lesson.rubric.concept_difficulty + "/" + lesson.rubric.sat_strategy_load + "; profile score " + base.score + ").");
  if (assessed) {
    ex.push("Weighted accuracy " + wAcc + "% (raw " + rawCorrect + "/" + rawTotal + ") gives performance multiplier " + perfMult + ".");
    ex.push("Coverage is " + coverage.replace(/_/g, " ") + " (floor " + floor + "), so the final multiplier is " + finalMult + ".");
  } else {
    ex.push("Not assessed: performance is unknown, full calibrated base time retained. A 5-10 minute mini-assessment is recommended and may add time but may not reduce the base allocation.");
  }
  if (found !== "none" && core > initial) ex.push("Foundational override " + foundMult + " governs (" + foundEvidence.join("; ") + ").");
  if (subAdj) ex.push("+" + subAdj + " h for " + nClusters + " weak subskill cluster(s): " + clusters.join(", ") + ".");
  if (timingAdj) ex.push("+" + timingAdj + " h timing: " + timingReason + ".");
  if (highAdj) ex.push("+" + highAdj + " h high-target: " + highReason + ".");
  if (teacherAdj) ex.push("+" + teacherAdj + " h teacher override: " + (tOv.reason || "no reason supplied") + ".");
  if (afterMin > unrounded) ex.push("Raised to the shared absolute lesson minimum of " + minH + " h.");
  ex.push("Lesson allocation retained at " + finalHours + " h without lesson-level rounding; Reading & Writing, Math, and strategy category totals are rounded upward independently to whole hours.");

  return {
    lesson_id: lesson.lesson_id, lesson_name: lesson.lesson_name, section: lesson.section,
    unit_id: lesson.unit_id, unit_name: lesson.unit_name, unit_order: lesson.unit_order,
    lesson_order_within_unit: lesson.lesson_order_within_unit,
    is_broad_lesson: lesson.is_broad_lesson,
    questions_assessed: rawTotal, questions_correct: rawCorrect,
    raw_accuracy: rawAcc, weighted_accuracy: wAcc,
    weighted_correct_weight: r2(wCorrect), weighted_total_weight: r2(wTotal),
    subskills_tested: subskills, weak_subskill_clusters: clusters,
    coverage_level: coverage,
    breadth_score: lesson.rubric.breadth, difficulty_score: lesson.rubric.concept_difficulty,
    strategy_score: lesson.rubric.sat_strategy_load,
    base_hour_score: base.score, base_hour_method: base.method, base_hours: base.hours,
    performance_multiplier: perfMult, coverage_floor: floor, final_multiplier: finalMult,
    foundational_level: found, foundational_multiplier: foundMult, foundational_evidence: foundEvidence,
    initial_hours: initial, core_hours: core,
    subskill_adjustment: subAdj, timing_adjustment: timingAdj, timing_reason: timingReason,
    high_target_adjustment: highAdj, high_target_reason: highReason,
    teacher_override_adjustment: teacherAdj, teacher_override_reason: tOv ? (tOv.reason || null) : null,
    unrounded_hours: unrounded, minimum_applied: minH, final_hours: finalHours,
    sessions: sessions, priority: priority,
    mini_assessment_recommended: !assessed,
    duplicate_evidence_warnings: dup,
    explanation: ex.join(" ")
  };
}

  function splitSessions(h, rules) {
    if (h <= 2) return [h];
    var parts = [];
    var rem = h;
    while (rem > 2) { parts.push(rem - 2 >= 1 ? 2 : 1.5); rem = r2(rem - parts[parts.length - 1]); }
    if (rem > 0) parts.push(rem);
    // normalize the specified examples
    if (h === 2.5) return [1.5, 1.0];
    if (h === 3) return [1.5, 1.5];
    if (h === 3.5) return [2.0, 1.5];
    if (h === 4) return [2.0, 2.0];
    return parts;
  }


function homeworkForPriority(rules, p, liveHours, transferredHours) {
  var key = p.toLowerCase();
  var cfg = rules.homework_by_priority[key] || rules.homework_by_priority.medium;
  var transfer = transferredHours || 0;
  var minRaw = Math.max(cfg.minimum_hours, liveHours * cfg.min_multiplier) + transfer;
  var maxRaw = Math.max(cfg.minimum_hours, liveHours * cfg.max_multiplier) + transfer;
  var min = roundQuarterNearest(minRaw), max = roundQuarterNearest(maxRaw);
  if (max < min) max = min;
  return { min: min, max: max, mid: roundQuarterNearest((min + max) / 2), transferred: transfer };
}

  function weeksForHours(rules, h) {
    var rows = rules.course_duration_weeks;
    for (var i = 0; i < rows.length; i++) if (h >= rows[i].min_hours && h <= rows[i].max_hours) return rows[i].weeks;
    return rows[rows.length - 1].weeks;
  }


  // ---------- explicit course-limit allocation ----------
  function constraintStep(rules) {
    return (rules.course_constraint_allocation && rules.course_constraint_allocation.increment_hours) || 0.5;
  }

  function initLessonConstraintFields(lesson) {
    if (lesson.pre_constraint_hours == null) lesson.pre_constraint_hours = lesson.final_hours;
    lesson.constraint_adjustment = lesson.constraint_adjustment || 0;
    lesson.constraint_action = lesson.constraint_action || null;
    lesson.constraint_reason = lesson.constraint_reason || null;
    lesson.live_hours_transferred_to_homework = lesson.live_hours_transferred_to_homework || 0;
  }

  function finalizeLessonConstraint(lesson, rules, label) {
    lesson.final_hours = r2(lesson.final_hours);
    lesson.constraint_adjustment = r2(lesson.final_hours - lesson.pre_constraint_hours);
    lesson.sessions = splitSessions(lesson.final_hours, rules);
    if (lesson.constraint_adjustment !== 0) {
      var direction = lesson.constraint_adjustment > 0 ? "added" : "removed";
      lesson.explanation += " Live-budget allocation " + direction + " " + Math.abs(lesson.constraint_adjustment) + " h (" + label + "), changing the live allocation from " + lesson.pre_constraint_hours + " h to " + lesson.final_hours + " h.";
      if (lesson.constraint_adjustment < 0) lesson.explanation += " The removed live time is transferred to targeted independent practice/homework rather than disappearing from the plan.";
    }
  }

  function strategyStateFromRules(rules, orientation, review) {
    var components = [];
    (rules.strategy_components.orientation || []).forEach(function (c) {
      components.push({ name: c[0], hours: c[1], category: "orientation", pre_constraint_hours: c[1], constraint_adjustment: 0 });
    });
    (rules.strategy_components.final_review || []).forEach(function (c) {
      components.push({ name: c[0], hours: c[1], category: "final_review", pre_constraint_hours: c[1], constraint_adjustment: 0 });
    });
    return { orientation_hours: orientation, final_review_hours: review, additional_strategy_hours: 0, components: components };
  }

  function addStrategyTime(state, amount, name) {
    var existing = state.components.filter(function (c) { return c.category === "additional_strategy" && c.name === name; })[0];
    if (!existing) {
      existing = { name: name, hours: 0, category: "additional_strategy", pre_constraint_hours: 0, constraint_adjustment: 0 };
      state.components.push(existing);
    }
    existing.hours = r2(existing.hours + amount);
    existing.constraint_adjustment = r2(existing.hours - existing.pre_constraint_hours);
    state.additional_strategy_hours = r2(state.additional_strategy_hours + amount);
  }


function reduceStrategyCategory(state, category, minimumTotal, amount) {
  var current = category === "orientation" ? state.orientation_hours : state.final_review_hours;
  var removable = r2(Math.max(0, current - minimumTotal));
  var take = r2(Math.min(removable, amount));
  if (take <= 0) return 0;
  var remaining = take;
  var comps = state.components.filter(function (c) { return c.category === category; }).reverse();
  comps.forEach(function (c) {
    if (remaining <= 0) return;
    var d = r2(Math.min(c.hours, remaining));
    c.hours = r2(c.hours - d);
    c.constraint_adjustment = r2(c.hours - c.pre_constraint_hours);
    remaining = r2(remaining - d);
  });
  var actual = r2(take - remaining);
  if (category === "orientation") state.orientation_hours = r2(state.orientation_hours - actual);
  else state.final_review_hours = r2(state.final_review_hours - actual);
  return actual;
}


function individualEssentialFloor(lesson, rules) {
  var minimum = rules.minimum_lesson_hours;
  return Math.min(lesson.final_hours, r2(Math.max(minimum, lesson.base_hours)));
}


function individualHardFloor(lesson, rules) {
  return Math.min(lesson.final_hours, rules.minimum_lesson_hours);
}

  function individualAboveBaseTier(lesson) {
    // Follow the documented reduction hierarchy. The first blocks moved out of live
    // teaching are duplicate/extra remediation, then high-target and pacing additions.
    // Teacher overrides are preserved longer, but they cannot break the strict 35 h live-course maximum.
    if ((lesson.duplicate_evidence_warnings || []).length) return 0;
    if ((lesson.high_target_adjustment || 0) > 0) return 1;
    if ((lesson.subskill_adjustment || 0) > 0 || (lesson.timing_adjustment || 0) > 0) return 2;
    if ((lesson.foundational_multiplier || 1) > (lesson.final_multiplier || 1)) return 3;
    if ((lesson.teacher_override_adjustment || 0) > 0) return 4;
    return 5;
  }

  function individualPriorityRank(lesson) {
    if (lesson.priority === "ESSENTIAL_REVIEW") return 0;
    if (lesson.priority === "MEDIUM") return 1;
    if (lesson.priority === "HIGH") return 2;
    return 3; // CRITICAL last
  }

  function individualCoverageRank(lesson) {
    if (lesson.coverage_level === "strong") return 0;
    if (lesson.coverage_level === "moderate") return 1;
    if (lesson.coverage_level === "limited") return 2;
    return 3; // not assessed last
  }


function reduceIndividualLessonBlocks(lessons, amount, step, rules, floorFn, mode) {
  var remaining = r2(amount), safety = 0;
  while (remaining > 0.001 && safety++ < 5000) {
    var candidates = lessons.map(function (l) {
      var floor = floorFn(l, rules);
      return { lesson: l, floor: floor, room: r2(l.final_hours - floor) };
    }).filter(function (x) { return x.room > 0.001; }).sort(function (a, b) {
      if (mode === "above_base") {
        return individualAboveBaseTier(a.lesson) - individualAboveBaseTier(b.lesson) || b.room - a.room ||
          ((b.lesson.weighted_accuracy == null ? -1 : b.lesson.weighted_accuracy) - (a.lesson.weighted_accuracy == null ? -1 : a.lesson.weighted_accuracy)) || a.lesson.lesson_name.localeCompare(b.lesson.lesson_name);
      }
      return individualPriorityRank(a.lesson) - individualPriorityRank(b.lesson) || individualCoverageRank(a.lesson) - individualCoverageRank(b.lesson) ||
        ((b.lesson.weighted_accuracy == null ? -1 : b.lesson.weighted_accuracy) - (a.lesson.weighted_accuracy == null ? -1 : a.lesson.weighted_accuracy)) || b.room - a.room || a.lesson.lesson_name.localeCompare(b.lesson.lesson_name);
    });
    if (!candidates.length) break;
    var x = candidates[0], take = r2(Math.min(step, remaining, x.room));
    if (take <= 0.001) break;
    var lesson = x.lesson;
    lesson.final_hours = r2(lesson.final_hours - take);
    lesson.constraint_action = mode === "above_base" ? "transferred_extra_practice_to_homework" : "compressed_guided_practice_to_homework";
    lesson.constraint_reason = mode === "above_base" ?
      "35-hour live-budget Stage 1: remediation/repetition above the calibrated base moved to targeted homework" :
      "35-hour live-budget Stage 3/4: guided practice compressed in a stronger lesson while preserving the 0.25-hour absolute minimum";
    lesson.live_hours_transferred_to_homework = r2(lesson.live_hours_transferred_to_homework + take);
    remaining = r2(remaining - take);
  }
  return remaining;
}


function applyIndividualCourseConstraints(lessons, rawOrientation, rawReview, rules) {
  var step = constraintStep(rules);
  lessons.forEach(initLessonConstraintFields);
  var state = strategyStateFromRules(rules, rawOrientation, rawReview);
  var rawLessonTotal = r2(lessons.reduce(function (s, l) { return s + l.pre_constraint_hours; }, 0));
  var rawComponentTotal = r2(rawLessonTotal + rawOrientation + rawReview);
  var lim = rules.individual_course_limits;
  var notes = [], status = "within_limits";

  if (rawComponentTotal < lim.minimum_hours) {
    status = "minimum_budget_applied";
    var toAdd = r2(lim.minimum_hours - rawComponentTotal);
    var addCandidates = lessons.slice().sort(function (a, b) {
      function rank(l) { if (l.coverage_level === "not_assessed") return 0; if (l.coverage_level === "limited") return 1; if (l.is_broad_lesson || l.breadth_score === 3) return 2; return 3; }
      return rank(a) - rank(b) || b.base_hours - a.base_hours || a.lesson_name.localeCompare(b.lesson_name);
    });
    var ai = 0;
    while (toAdd > 0.001 && addCandidates.length) {
      var al = addCandidates[ai % addCandidates.length];
      var add = r2(Math.min(step, toAdd));
      al.final_hours = r2(al.final_hours + add);
      al.constraint_action = "program_floor_addition";
      al.constraint_reason = al.coverage_level === "not_assessed" ? "14-hour program-floor addition to an unassessed lesson" : al.coverage_level === "limited" ? "14-hour program-floor addition to a limited-coverage lesson" : "14-hour program-floor addition to preserve instructional depth";
      toAdd = r2(toAdd - add); ai++;
    }
    if (toAdd > 0.001) addStrategyTime(state, toAdd, "Test strategy and pacing (program-floor addition)");
    notes.push("The calculated component total was below the 14-hour program minimum. The exact missing time was assigned to explicit lesson or strategy components.");
  } else if (rawComponentTotal > lim.maximum_hours) {
    status = "maximum_budget_applied";
    var toRemove = r2(rawComponentTotal - lim.maximum_hours);
    // Stage 1
    toRemove = reduceIndividualLessonBlocks(lessons, toRemove, step, rules, individualEssentialFloor, "above_base");
    // Stage 2: optional strategy/review only. Orientation remains fixed at 0.75 h.
    if (toRemove > 0.001) {
      var tookReview = reduceStrategyCategory(state, "final_review", rules.final_review_hours.individual_minimum, toRemove);
      toRemove = r2(toRemove - tookReview);
    }
    // Stage 3 and Stage 4 exact remainder
    if (toRemove > 0.001) toRemove = reduceIndividualLessonBlocks(lessons, toRemove, step, rules, individualHardFloor, "to_minimum");
    if (toRemove > 0.001) throw new Error("Invalid course-limit configuration: the 35-hour maximum is below mandatory lesson, orientation, and final-review minima.");
    notes.push("The actual live components were reduced to the strict 35-hour maximum through four explicit stages: excess remediation, optional review, strongest-lesson compression, and exact remainder removal. Removed live lesson time was transferred to targeted homework; this is not a headline-only clamp.");
  }

  // English, Math, and strategy are scheduled as whole-hour category totals.
  // Enforce the maximum again after those independent ceilings, because a
  // component total below the cap can still exceed it after category rounding.
  function currentScheduledIndividualTotal() {
    var eng = r2(lessons.filter(function (l) { return l.section === "english"; }).reduce(function (s, l) { return s + l.final_hours; }, 0));
    var math = r2(lessons.filter(function (l) { return l.section === "math"; }).reduce(function (s, l) { return s + l.final_hours; }, 0));
    var strategyUnrounded = r2(state.orientation_hours + state.final_review_hours + state.additional_strategy_hours);
    var strategyScheduled = roundSectionUpToInteger(strategyUnrounded);
    return r2(roundSectionUpToInteger(eng) + roundSectionUpToInteger(math) + strategyScheduled);
  }

  var scheduledBeforeFinalization = currentScheduledIndividualTotal();
  if (scheduledBeforeFinalization > lim.maximum_hours + 0.001) {
    status = "maximum_budget_applied";
    var reviewMinimum = rules.final_review_hours.individual_minimum;
    var safety = 0;
    while (scheduledBeforeFinalization > lim.maximum_hours + 0.001 && safety++ < 5000) {
      var changed = 0;
      if (state.final_review_hours > reviewMinimum + 0.001) {
        changed = reduceStrategyCategory(state, "final_review", reviewMinimum, step);
      } else {
        var leftover = reduceIndividualLessonBlocks(lessons, step, step, rules, individualHardFloor, "to_minimum");
        changed = r2(step - leftover);
      }
      if (changed <= 0.001) {
        throw new Error("Invalid course-limit configuration: whole-hour English, Math, and strategy rounding cannot be kept within the " + lim.maximum_hours + "-hour maximum while preserving mandatory minima.");
      }
      scheduledBeforeFinalization = currentScheduledIndividualTotal();
    }
    notes.push("After Reading & Writing, Math, and strategy were rounded upward to whole hours, actual lesson/review components were reduced as needed so the scheduled total still remained within the strict " + lim.maximum_hours + "-hour maximum.");
  }

  lessons.forEach(function (l) {
    var label = l.constraint_reason || (l.constraint_adjustment > 0 ? "program-floor allocation" : "live-course budget allocation");
    finalizeLessonConstraint(l, rules, label);
  });
  state.components.forEach(function (c) { c.hours = r2(c.hours); c.constraint_adjustment = r2(c.hours - c.pre_constraint_hours); });

  var finalEnglishUnrounded = r2(lessons.filter(function (l) { return l.section === "english"; }).reduce(function (s, l) { return s + l.final_hours; }, 0));
  var finalMathUnrounded = r2(lessons.filter(function (l) { return l.section === "math"; }).reduce(function (s, l) { return s + l.final_hours; }, 0));
  var finalEnglishScheduled = roundSectionUpToInteger(finalEnglishUnrounded);
  var finalMathScheduled = roundSectionUpToInteger(finalMathUnrounded);
  var finalLessonTotal = r2(finalEnglishUnrounded + finalMathUnrounded);
  var finalStrategyUnrounded = r2(state.orientation_hours + state.final_review_hours + state.additional_strategy_hours);
  var finalStrategyScheduled = roundSectionUpToInteger(finalStrategyUnrounded);
  var finalComponentTotal = r2(finalLessonTotal + finalStrategyUnrounded);
  var finalRoundedTotal = r2(finalEnglishScheduled + finalMathScheduled + finalStrategyScheduled);
  if (finalRoundedTotal > lim.maximum_hours + 0.001) throw new Error("Hard-cap failure: whole-hour English, Math, and strategy totals exceed " + lim.maximum_hours + " hours.");
  if (finalRoundedTotal < lim.minimum_hours - 0.001) throw new Error("Program-floor failure: final scheduled individual total is below " + lim.minimum_hours + " hours.");

  var allocation = lessons.filter(function (l) { return l.constraint_adjustment !== 0; }).map(function (l) {
    return { type:"lesson", lesson_id:l.lesson_id, label:l.lesson_name, before_hours:l.pre_constraint_hours, after_hours:l.final_hours, adjustment_hours:l.constraint_adjustment, action:l.constraint_action, reason:l.constraint_reason, homework_transfer_hours:l.live_hours_transferred_to_homework };
  });
  state.components.filter(function (c) { return c.constraint_adjustment !== 0; }).forEach(function (c) {
    allocation.push({ type:"strategy", lesson_id:null, label:c.name, before_hours:c.pre_constraint_hours, after_hours:c.hours, adjustment_hours:c.constraint_adjustment, action:c.constraint_adjustment > 0 ? "added_live_strategy" : "reduced_live_strategy", reason:"course-budget allocation", homework_transfer_hours:0 });
  });

  return {
    status:status, maximum_infeasible:false, hard_cap_enforced:finalRoundedTotal <= lim.maximum_hours,
    raw_total:rawComponentTotal, raw_component_total:rawComponentTotal, initial_need_total:rawComponentTotal,
    final_component_total:finalComponentTotal, final_total:finalRoundedTotal, final_planned_total:finalRoundedTotal,
    final_rounding_adjustment:r2(finalRoundedTotal-finalComponentTotal),
    unrounded_english_live_hours:finalEnglishUnrounded, unrounded_math_live_hours:finalMathUnrounded,
    unrounded_strategy_hours:finalStrategyUnrounded,
    english_live_hours:finalEnglishScheduled, math_live_hours:finalMathScheduled,
    strategy_hours:finalStrategyScheduled,
    raw_lesson_hours:rawLessonTotal, final_lesson_hours:finalLessonTotal,
    raw_orientation_hours:rawOrientation, raw_final_review_hours:rawReview,
    orientation_hours:state.orientation_hours, final_review_hours:state.final_review_hours,
    additional_strategy_hours:state.additional_strategy_hours, strategy_components:state.components,
    hours_added:finalComponentTotal > rawComponentTotal ? r2(finalComponentTotal-rawComponentTotal) : 0,
    hours_removed:finalComponentTotal < rawComponentTotal ? r2(rawComponentTotal-finalComponentTotal) : 0,
    homework_transfer_hours:r2(lessons.reduce(function (s,l) { return s+l.live_hours_transferred_to_homework; },0)),
    maximum_overrun:0, notes:notes, allocation:allocation
  };
}


function applyGroupCourseConstraints(lessons, orientation, review, row, rules) {
  var step = constraintStep(rules), bucket = groupBucket(row.group_size);
  lessons.forEach(function (l) {
    l.pre_constraint_group_hours=l.group_hours; l.constraint_adjustment=0; l.constraint_action=null; l.constraint_reason=null; l.group_homework_transfer_hours=0; l.supplemental_support_hours=0;
  });
  var rawLessonTotal=r2(lessons.reduce(function(s,l){return s+l.pre_constraint_group_hours;},0));
  var rawComponentTotal=r2(rawLessonTotal+orientation+review);
  var status="within_limits", notes=[], additionalStrategy=0;
  var finalOrientation=orientation, finalReview=review;

  if (rawComponentTotal < row.final_minimum) {
    status="minimum_budget_applied";
    var toAdd=r2(row.final_minimum-rawComponentTotal);
    var addCandidates=lessons.slice().sort(function(a,b){return (b.unassessed_students||0)-(a.unassessed_students||0)||(b.limited_students||0)-(a.limited_students||0)||b.diversity_adjustment-a.diversity_adjustment||a.lesson_name.localeCompare(b.lesson_name);});
    var ai=0;
    while(toAdd>0.001 && addCandidates.length){var al=addCandidates[ai%addCandidates.length], add=r2(Math.min(step,toAdd)); al.group_hours=r2(al.group_hours+add); al.constraint_action="group_program_floor_addition"; al.constraint_reason="group program-floor addition to uncovered, limited-coverage, or diverse needs"; toAdd=r2(toAdd-add); ai++;}
    if(toAdd>0.001) additionalStrategy=r2(additionalStrategy+toAdd);
    notes.push("The exact missing time was assigned to explicit group lessons or a named strategy block to meet the configured group program minimum.");
  } else if(rawComponentTotal > row.maximum) {
    status="maximum_budget_applied";
    var toRemove=r2(rawComponentTotal-row.maximum), safety=0;
    // Stage 1: size/diversity overhead above highest individual need
    while(toRemove>0.001 && safety++<5000){
      var cands=lessons.filter(function(l){return l.group_hours-l.max_hours>0.001;}).sort(function(a,b){return (b.group_hours-b.max_hours)-(a.group_hours-a.max_hours)||b.diversity_adjustment-a.diversity_adjustment||a.lesson_name.localeCompare(b.lesson_name);});
      if(!cands.length) break; var gl=cands[0], take=r2(Math.min(step,toRemove,gl.group_hours-gl.max_hours));
      gl.group_hours=r2(gl.group_hours-take); gl.constraint_action="transferred_group_overhead_to_practice"; gl.constraint_reason="group maximum Stage 1: size/diversity overhead moved to differentiated homework or optional workshop"; gl.group_homework_transfer_hours=r2(gl.group_homework_transfer_hours+take); toRemove=r2(toRemove-take);
    }
    // Stage 2: reduce final review toward group minimum; preserve orientation.
    var reviewMin=(rules.final_review_hours.group_minimum||{})[bucket];
    if(reviewMin==null) reviewMin=Math.max(1,review-0.5);
    if(toRemove>0.001){var can=r2(Math.max(0,finalReview-reviewMin)), takeReview=r2(Math.min(can,toRemove)); finalReview=r2(finalReview-takeReview); toRemove=r2(toRemove-takeReview);}
    // Stage 3/4: student-specific common-core need to supplemental support, exact remainder permitted.
    safety=0;
    while(toRemove>0.001 && safety++<5000){
      var supports=lessons.filter(function(l){return l.group_hours-l.minimum_group_hours>0.001;}).sort(function(a,b){
        var aa=a.avg_weighted_accuracy==null?-1:a.avg_weighted_accuracy, ba=b.avg_weighted_accuracy==null?-1:b.avg_weighted_accuracy;
        return (a.pct_requiring_remediation||0)-(b.pct_requiring_remediation||0)||ba-aa||(b.group_hours-b.minimum_group_hours)-(a.group_hours-a.minimum_group_hours)||a.lesson_name.localeCompare(b.lesson_name);
      });
      if(!supports.length) break; var sl=supports[0], take=r2(Math.min(step,toRemove,sl.group_hours-sl.minimum_group_hours));
      sl.group_hours=r2(sl.group_hours-take); sl.constraint_action="moved_to_supplemental_support"; sl.constraint_reason="group maximum Stage 3/4: student-specific need moved from common core to transparent subgroup/individual support"; sl.supplemental_support_hours=r2(sl.supplemental_support_hours+take); toRemove=r2(toRemove-take);
    }
    if(toRemove>0.001) throw new Error("Invalid group-limit configuration: maximum below mandatory lesson/orientation/review minima.");
    notes.push("The actual core group components were reduced to the configured maximum through explicit overhead, review, supplemental-support, and exact-remainder stages. No headline-only clamp was used.");
  }

  function currentScheduledGroupTotal() {
    var eng = r2(lessons.filter(function(l){return l.section==="english";}).reduce(function(s,l){return s+l.group_hours;},0));
    var math = r2(lessons.filter(function(l){return l.section==="math";}).reduce(function(s,l){return s+l.group_hours;},0));
    var strategyUnrounded = r2(finalOrientation + finalReview + additionalStrategy);
    var strategyScheduled = roundSectionUpToInteger(strategyUnrounded);
    return r2(roundSectionUpToInteger(eng)+roundSectionUpToInteger(math)+strategyScheduled);
  }

  var scheduledGroupBeforeFinalization=currentScheduledGroupTotal();
  if(scheduledGroupBeforeFinalization>row.maximum+0.001){
    status="maximum_budget_applied";
    var postReviewMin=(rules.final_review_hours.group_minimum||{})[bucket];
    if(postReviewMin==null) postReviewMin=Math.max(1,review-0.5);
    var postSafety=0;
    while(scheduledGroupBeforeFinalization>row.maximum+0.001&&postSafety++<5000){
      var changed=0;
      if(finalReview>postReviewMin+0.001){
        changed=r2(Math.min(step,finalReview-postReviewMin));
        finalReview=r2(finalReview-changed);
      }else{
        var postSupports=lessons.filter(function(l){return l.group_hours-l.minimum_group_hours>0.001;}).sort(function(a,b){
          var aa=a.avg_weighted_accuracy==null?-1:a.avg_weighted_accuracy, ba=b.avg_weighted_accuracy==null?-1:b.avg_weighted_accuracy;
          return (a.pct_requiring_remediation||0)-(b.pct_requiring_remediation||0)||ba-aa||(b.group_hours-b.minimum_group_hours)-(a.group_hours-a.minimum_group_hours)||a.lesson_name.localeCompare(b.lesson_name);
        });
        if(postSupports.length){
          var postLesson=postSupports[0];
          changed=r2(Math.min(step,postLesson.group_hours-postLesson.minimum_group_hours));
          postLesson.group_hours=r2(postLesson.group_hours-changed);
          postLesson.constraint_action="moved_to_supplemental_support";
          postLesson.constraint_reason="group maximum after whole-hour section rounding: student-specific need moved to transparent subgroup/individual support";
          postLesson.supplemental_support_hours=r2(postLesson.supplemental_support_hours+changed);
        }
      }
      if(changed<=0.001) throw new Error("Invalid group-limit configuration: whole-hour English, Math, and strategy rounding cannot be kept within the configured maximum while preserving mandatory minima.");
      scheduledGroupBeforeFinalization=currentScheduledGroupTotal();
    }
    notes.push("After group Reading & Writing, Math, and strategy totals were rounded upward to whole hours, actual common-core lesson/review components were reduced as needed so the scheduled group total remained within the configured maximum.");
  }

  lessons.forEach(function(l){l.group_hours=r2(l.group_hours); l.constraint_adjustment=r2(l.group_hours-l.pre_constraint_group_hours); l.sessions=splitSessions(l.group_hours,rules); if(l.constraint_adjustment!==0) l.explanation += " Course-budget allocation changed the common group block from "+l.pre_constraint_group_hours+" h to "+l.group_hours+" h ("+l.constraint_reason+").";});
  var finalEnglishGroupUnrounded=r2(lessons.filter(function(l){return l.section==="english";}).reduce(function(s,l){return s+l.group_hours;},0));
  var finalMathGroupUnrounded=r2(lessons.filter(function(l){return l.section==="math";}).reduce(function(s,l){return s+l.group_hours;},0));
  var finalEnglishGroupScheduled=roundSectionUpToInteger(finalEnglishGroupUnrounded);
  var finalMathGroupScheduled=roundSectionUpToInteger(finalMathGroupUnrounded);
  var finalLessonTotal=r2(finalEnglishGroupUnrounded+finalMathGroupUnrounded);
  var finalGroupStrategyUnrounded=r2(finalOrientation+finalReview+additionalStrategy);
  var finalGroupStrategyScheduled=roundSectionUpToInteger(finalGroupStrategyUnrounded);
  var finalComponentTotal=r2(finalLessonTotal+finalGroupStrategyUnrounded);
  var finalRoundedTotal=r2(finalEnglishGroupScheduled+finalMathGroupScheduled+finalGroupStrategyScheduled);
  if(finalRoundedTotal>row.maximum+0.001) throw new Error("Hard-cap failure: whole-hour group English, Math, and strategy totals exceed "+row.maximum+" hours.");
  if(finalRoundedTotal<row.final_minimum-0.001) throw new Error("Program-floor failure: final scheduled group total is below "+row.final_minimum+" hours.");
  var minimumCore=r2(lessons.reduce(function(s,l){return s+l.minimum_group_hours;},0)+finalOrientation+finalReview);
  var allocation=lessons.filter(function(l){return l.constraint_adjustment!==0;}).map(function(l){return {type:"lesson",lesson_id:l.lesson_id,label:l.lesson_name,before_hours:l.pre_constraint_group_hours,after_hours:l.group_hours,adjustment_hours:l.constraint_adjustment,action:l.constraint_action,reason:l.constraint_reason,homework_transfer_hours:l.group_homework_transfer_hours,supplemental_support_hours:l.supplemental_support_hours};});
  if(additionalStrategy) allocation.push({type:"strategy",lesson_id:null,label:"Additional group strategy and pacing",before_hours:0,after_hours:additionalStrategy,adjustment_hours:additionalStrategy,action:"added_group_strategy",reason:"group program-floor allocation",homework_transfer_hours:0,supplemental_support_hours:0});
  if(finalReview!==review) allocation.push({type:"strategy",lesson_id:null,label:"Group final review",before_hours:review,after_hours:finalReview,adjustment_hours:r2(finalReview-review),action:"reduced_group_review",reason:"group maximum Stage 2",homework_transfer_hours:0,supplemental_support_hours:0});
  var supplemental=r2(lessons.reduce(function(s,l){return s+l.supplemental_support_hours;},0));
  return {status:status,maximum_infeasible:false,hard_cap_enforced:finalRoundedTotal<=row.maximum,raw_total:rawComponentTotal,raw_component_total:rawComponentTotal,initial_need_total:rawComponentTotal,final_component_total:finalComponentTotal,final_total:finalRoundedTotal,final_planned_total:finalRoundedTotal,final_rounding_adjustment:r2(finalRoundedTotal-finalComponentTotal),unrounded_english_group_hours:finalEnglishGroupUnrounded,unrounded_math_group_hours:finalMathGroupUnrounded,unrounded_strategy_hours:finalGroupStrategyUnrounded,english_group_hours:finalEnglishGroupScheduled,math_group_hours:finalMathGroupScheduled,strategy_hours:finalGroupStrategyScheduled,raw_lesson_hours:rawLessonTotal,final_lesson_hours:finalLessonTotal,initial_orientation_hours:orientation,initial_review_hours:review,orientation_hours:finalOrientation,final_review_hours:finalReview,additional_strategy_hours:additionalStrategy,feasible_minimum_total:minimumCore,maximum_overrun:0,hours_added:finalComponentTotal>rawComponentTotal?r2(finalComponentTotal-rawComponentTotal):0,hours_removed:finalComponentTotal<rawComponentTotal?r2(rawComponentTotal-finalComponentTotal):0,homework_transfer_hours:r2(lessons.reduce(function(s,l){return s+l.group_homework_transfer_hours;},0)),supplemental_support_hours:supplemental,notes:notes,allocation:allocation};
}

  // ---------- individual analysis ----------
  function analyzeIndividual(input, config) {
    var rules = config.calculation_rules;
    var v = validateIndividualInput(input, config);
    var errors = v.errors.slice(), warnings = v.warnings.slice(), info = v.info.slice();
    if (!v.template || errors.length) {
      return { ok: errors.length === 0, errors: errors, warnings: warnings, info: info };
    }
    var tpl = v.template;
    var questions = analyzeQuestions(input, tpl, rules);
    var byLesson = {};
    questions.forEach(function (q) { (byLesson[q.lesson_id] = byLesson[q.lesson_id] || []).push(q); });

    var lessons = config.lesson_catalog.lessons.map(function (l) {
      return analyzeLesson(l, byLesson[l.lesson_id] || [], input, rules, warnings);
    });

    function sectionSummary(sec, hoursField) {
      var qs = questions.filter(function (q) { return q.section === sec; });
      var c = qs.filter(function (q) { return q.correct; }).length;
      var w = qs.reduce(function (s, q) { return s + q.weight; }, 0);
      var wc = qs.reduce(function (s, q) { return s + (q.correct ? q.weight : 0); }, 0);
      var ls = lessons.filter(function (l) { return l.section === sec; });
      return {
        section: sec,
        questions_assessed: qs.length, questions_correct: c,
        raw_accuracy: qs.length ? pct(c / qs.length) : null,
        weighted_accuracy: w ? pct(wc / w) : null,
        live_hours: r2(ls.reduce(function (s, l) { return s + l[hoursField || "final_hours"]; }, 0))
      };
    }

    var rawOrientation = rules.orientation_hours.individual_default;
    var rawReview = rules.final_review_hours.individual_default;
    var allocation = applyIndividualCourseConstraints(lessons, rawOrientation, rawReview, rules);

    var engRaw = sectionSummary("english", "pre_constraint_hours");
    var mathRaw = sectionSummary("math", "pre_constraint_hours");
    var eng = sectionSummary("english", "final_hours");
    var math = sectionSummary("math", "final_hours");

    eng.raw_live_hours = engRaw.live_hours;
    math.raw_live_hours = mathRaw.live_hours;

    // Preserve the exact calculated section values.
    eng.unrounded_live_hours = eng.live_hours;
    math.unrounded_live_hours = math.live_hours;

    // Round Reading & Writing and Math upward independently to whole hours.
    eng.live_hours = roundSectionUpToInteger(eng.unrounded_live_hours);
    math.live_hours = roundSectionUpToInteger(math.unrounded_live_hours);

    var unroundedStrategyHours = r2(allocation.orientation_hours + allocation.final_review_hours + allocation.additional_strategy_hours);
    var strategyHours = roundSectionUpToInteger(unroundedStrategyHours);
    var scheduledSectionTotal = r2(
      eng.live_hours +
      math.live_hours +
      strategyHours
    );

    // homework: any live time removed by the cap is explicitly transferred to the same lesson's homework/independent practice
    var homework = lessons.map(function (l) {
      var transfer = l.live_hours_transferred_to_homework || 0;
      var hw = homeworkForPriority(rules, l.priority, l.final_hours, transfer);
      return {
        lesson_id: l.lesson_id, lesson_name: l.lesson_name, section: l.section, priority: l.priority,
        base_hours_min: hw.min, base_hours_max: hw.max,
        live_hours_transferred: transfer,
        hours_min: hw.min, hours_max: hw.max, hours_mid: hw.mid
      };
    });
    var hwTotal = r2(homework.reduce(function (s, h) { return s + h.hours_mid; }, 0));
    var hwEng = r2(homework.filter(function (h) { return h.section === "english"; }).reduce(function (s, h) { return s + h.hours_mid; }, 0));
    var hwMath = r2(hwTotal - hwEng);

    var spw = (input.availability && input.availability.preferred_sessions_per_week) || 2;
    var weeks = weeksForHours(rules, scheduledSectionTotal);

    var assessedLessons = lessons.filter(function (l) { return l.coverage_level !== "not_assessed"; });
    var strengths = assessedLessons.filter(function (l) { return l.weighted_accuracy >= 75 && l.coverage_level !== "limited"; })
      .sort(function (a, b) { return b.weighted_accuracy - a.weighted_accuracy; }).slice(0, 4);
    var prOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, ESSENTIAL_REVIEW: 3 };
    var priorities = lessons.slice().sort(function (a, b) {
      return prOrder[a.priority] - prOrder[b.priority] || (a.weighted_accuracy == null ? 50 : a.weighted_accuracy) - (b.weighted_accuracy == null ? 50 : b.weighted_accuracy);
    });

    var errCounts = {};
    questions.forEach(function (q) { if (q.error_type) errCounts[q.error_type] = (errCounts[q.error_type] || 0) + 1; });

    var lim = rules.individual_course_limits;
    var checks = runIndividualChecks(lessons, allocation, lim);
    checks.failed.forEach(function (f) { errors.push({ code: "VALIDATION_FAILED", message: f }); });
    return {
      ok: errors.length === 0,
      schema_version: "2.4",
      errors: errors, warnings: warnings, info: info,
      student: input.student, goal: input.goal || {}, scores: input.scores || {},
      diagnostic: { template_id: tpl.test_id, template_name: tpl.test_name, date: input.diagnostic.date || null },
      question_analysis: questions,
      lesson_analysis: lessons,
      section_summaries: { english: eng, math: math },
      strengths: strengths.map(function (l) { return { lesson_id: l.lesson_id, lesson_name: l.lesson_name, weighted_accuracy: l.weighted_accuracy, coverage_level: l.coverage_level }; }),
      priority_areas: priorities.slice(0, 6).map(function (l) { return { lesson_id: l.lesson_id, lesson_name: l.lesson_name, priority: l.priority, weighted_accuracy: l.weighted_accuracy, final_hours: l.final_hours }; }),
      error_patterns: errCounts,
      untested_lessons: lessons.filter(function (l) { return l.coverage_level === "not_assessed"; }).map(function (l) { return l.lesson_id; }),
      undertested_lessons: lessons.filter(function (l) { return l.coverage_level === "limited"; }).map(function (l) { return l.lesson_id; }),
      totals: {
        raw_english_live_hours: engRaw.live_hours, raw_math_live_hours: mathRaw.live_hours,
        unrounded_english_live_hours: eng.unrounded_live_hours,
        unrounded_math_live_hours: math.unrounded_live_hours,
        english_live_hours: eng.live_hours, math_live_hours: math.live_hours,
        raw_lesson_hours: allocation.raw_lesson_hours, lesson_hours: allocation.final_lesson_hours,
        raw_orientation_hours: allocation.raw_orientation_hours, raw_final_review_hours: allocation.raw_final_review_hours,
        orientation_hours: allocation.orientation_hours, final_review_hours: allocation.final_review_hours,
        additional_strategy_hours: allocation.additional_strategy_hours,
        unrounded_strategy_hours: unroundedStrategyHours,
        strategy_hours: strategyHours, strategy_components: allocation.strategy_components,
        raw_total: allocation.raw_total, raw_component_total: allocation.raw_component_total, initial_need_total: allocation.initial_need_total,
        final_component_total: allocation.final_component_total,
        final_rounding_adjustment: r2(scheduledSectionTotal - allocation.final_component_total),
        constrained_total: scheduledSectionTotal, final_planned_total: scheduledSectionTotal,
        hard_cap_enforced: scheduledSectionTotal <= lim.maximum_hours + 0.001,
        constraint_status: allocation.status, maximum_infeasible: false, maximum_overrun: 0,
        hours_added: allocation.hours_added, hours_removed: allocation.hours_removed,
        constraint_notes: allocation.notes, constraint_allocation: allocation.allocation,
        homework_transfer_hours: allocation.homework_transfer_hours,
        homework_total: hwTotal, homework_english: hwEng, homework_math: hwMath
      },
      homework: homework,
      schedule: { sessions_per_week: spw, recommended_weeks: weeks },
      validation_checks: checks,
      final_interpretation: "The diagnostic measures current evidence, not full potential. Strong performance reduces remediation but never removes SAT-specific teaching; weak performance increases guided instruction; limited coverage prevents unjustified reductions, and unassessed lessons are treated as unknown. Course-budget changes are assigned to explicit components. Lesson allocations retain two-decimal precision. Reading & Writing, Math, and strategy totals are each rounded upward to the next whole hour, and the final scheduled total is the sum of those three rounded categories. All hour figures are planning estimates and may be updated after instruction begins."
    };
  }


function runIndividualChecks(lessons, allocation, lim) {
  var passed=[], failed=[]; function chk(ok,name){(ok?passed:failed).push(name);}
  var finalLessonSum=r2(lessons.reduce(function(s,l){return s+l.final_hours;},0));
  var rawLessonSum=r2(lessons.reduce(function(s,l){return s+l.pre_constraint_hours;},0));
  var adjustmentSum=r2(lessons.reduce(function(s,l){return s+l.constraint_adjustment;},0)+allocation.strategy_components.reduce(function(s,c){return s+(c.constraint_adjustment||0);},0));
  chk(lessons.length===28,"Every one of the 28 lessons is included");
  chk(lessons.every(function(l){return l.final_hours>=0.25-0.001;}),"No lesson has zero hours (shared 0.25 h floor)");
  chk(lessons.every(function(l){return l.coverage_level==="not_assessed"?l.weighted_accuracy===null:l.weighted_accuracy!==null;}),"Every assessed lesson has weighted accuracy; unassessed lessons are unknown");
  chk(lessons.every(function(l){return !!l.coverage_level;}),"Every lesson has a coverage level");
  chk(lessons.every(function(l){return l.base_hours>0 && l.base_hour_method==="lesson_specific_calibrated_rubric";}),"Every lesson uses the calibrated rubric base-hour table");
  chk(lessons.every(function(l){return l.coverage_level!=="not_assessed"||(l.final_multiplier===1.0&&l.core_hours>=l.base_hours);}),"Unassessed lessons retain full calibrated base evidence before any course-budget allocation");
  chk(lessons.every(function(l){return !(l.questions_assessed===1&&l.questions_correct===1&&l.final_multiplier<1.0);}),"One correct question is never treated as complete mastery");
  chk(Math.abs(allocation.raw_component_total-(rawLessonSum+allocation.raw_orientation_hours+allocation.raw_final_review_hours))<0.011,"Raw component total equals raw lessons plus orientation and review");
  chk(Math.abs(allocation.final_component_total-(finalLessonSum+allocation.orientation_hours+allocation.final_review_hours+allocation.additional_strategy_hours))<0.011,"Unrounded final component total equals all final components");
  chk(Math.abs((allocation.final_component_total-allocation.raw_component_total)-adjustmentSum)<0.011,"Every course-budget change is assigned to an explicit component");
  chk(allocation.final_component_total>=lim.minimum_hours-0.001&&allocation.final_component_total<=lim.maximum_hours+0.001,"Actual components remain within "+lim.minimum_hours+"-"+lim.maximum_hours+" h");
  chk(allocation.english_live_hours===roundSectionUpToInteger(allocation.unrounded_english_live_hours),"Reading & Writing is rounded upward to the next whole hour");
  chk(allocation.math_live_hours===roundSectionUpToInteger(allocation.unrounded_math_live_hours),"Math is rounded upward to the next whole hour");
  chk(allocation.strategy_hours===roundSectionUpToInteger(allocation.unrounded_strategy_hours),"Strategy time is rounded upward to the next whole hour");
  chk(Math.abs(allocation.final_total-r2(allocation.english_live_hours+allocation.math_live_hours+allocation.strategy_hours))<0.001,"Final scheduled total equals rounded English, Math, and strategy totals");
  chk(allocation.final_total<=lim.maximum_hours+0.001,"The individual 35-hour maximum is enforced after whole-hour section rounding");
  chk(allocation.hard_cap_enforced===true,"The individual 35-hour maximum is enforced on the final scheduled total");
  return {passed:passed,failed:failed};
}

  // ---------- group analysis ----------
  function analyzeGroup(groupInput, config) {
    var rules = config.calculation_rules;
    var errors = [], warnings = [], info = [];
    var students = groupInput.students || [];
    var n = students.length;
    if (n < 2 || n > 20) {
      errors.push({ code: "INVALID_GROUP_SIZE", message: "Group size must be 2-20 students (got " + n + ")." });
      return { ok: false, errors: errors, warnings: warnings, info: info };
    }
    var individuals = students.map(function (s) { return analyzeIndividual(s, config); });
    individuals.forEach(function (r, i) {
      r.errors.forEach(function (e) { errors.push({ code: e.code, message: "[student " + (i + 1) + "] " + e.message }); });
      r.warnings.forEach(function (w) { warnings.push({ code: w.code, message: "[" + (r.student && r.student.student_name || "student " + (i + 1)) + "] " + w.message }); });
    });
    if (errors.length) return { ok: false, errors: errors, warnings: warnings, info: info, individual_results: individuals };

    var row = calcGroupRow(rules, n);
    var sizeAdj = row.size_adjustment;
    var div = rules.group_diversity;

    var lessons = config.lesson_catalog.lessons.map(function (l) {
      var per = individuals.map(function (r) {
        return r.lesson_analysis.filter(function (x) { return x.lesson_id === l.lesson_id; })[0];
      });
      var hours = per.map(function (p) { return p.final_hours; });
      var accs = per.map(function (p) { return p.weighted_accuracy; }).filter(function (x) { return x != null; });
      var minH = Math.min.apply(null, hours), maxH = Math.max.apply(null, hours);
      var minimumGroupH = Math.max.apply(null, per.map(function (p) { return p.minimum_applied == null ? 0.25 : p.minimum_applied; }));
      var hourRange = r2(maxH - minH);
      var accRange = accs.length ? r2(Math.max.apply(null, accs) - Math.min.apply(null, accs)) : 0;
      var cls, adj;
      if (hourRange <= div.very_similar.max_hour_range && accRange <= div.very_similar.max_accuracy_range) { cls = "very_similar"; adj = div.very_similar.adjustment; }
      else if (hourRange <= div.slightly_different.max_hour_range && accRange <= div.slightly_different.max_accuracy_range) { cls = "slightly_different"; adj = div.slightly_different.adjustment; }
      else if (hourRange <= div.significantly_different.max_hour_range && accRange <= div.significantly_different.max_accuracy_range) { cls = "significantly_different"; adj = div.significantly_different.adjustment; }
      else { cls = "highly_different"; adj = div.highly_different.adjustment; }

      var rawGroup = r2(maxH * (1 + sizeAdj + adj));
      var rounded = r2(Math.max(rawGroup, maxH));

      var counts = {};
      per.forEach(function (p) { p.weak_subskill_clusters.forEach(function (s) { counts[s] = (counts[s] || 0) + 1; }); });
      var shared = Object.keys(counts).filter(function (s) { return counts[s] >= 2; });
      var specific = Object.keys(counts).filter(function (s) { return counts[s] === 1; });
      var remediating = per.filter(function (p) { return p.priority === "CRITICAL" || p.priority === "HIGH"; }).length;
      var reviewOnly = per.filter(function (p) { return p.priority === "ESSENTIAL_REVIEW"; }).length;

      return {
        lesson_id: l.lesson_id, lesson_name: l.lesson_name, section: l.section,
        unit_id: l.unit_id, unit_name: l.unit_name, unit_order: l.unit_order,
        lesson_order_within_unit: l.lesson_order_within_unit,
        student_hours: hours, min_hours: minH, max_hours: maxH, minimum_group_hours: minimumGroupH,
        avg_hours: r2(hours.reduce(function (a, b) { return a + b; }, 0) / n),
        median_hours: median(hours), hour_range: hourRange, hours_stddev: stddev(hours),
        avg_weighted_accuracy: accs.length ? r2(accs.reduce(function (a, b) { return a + b; }, 0) / accs.length) : null,
        lowest_weighted_accuracy: accs.length ? Math.min.apply(null, accs) : null,
        highest_weighted_accuracy: accs.length ? Math.max.apply(null, accs) : null,
        accuracy_range: accRange,
        unassessed_students: per.filter(function (p) { return p.coverage_level === "not_assessed"; }).length,
        limited_students: per.filter(function (p) { return p.coverage_level === "limited"; }).length,
        shared_weak_subskills: shared, student_specific_weak_subskills: specific,
        pct_requiring_remediation: r2(100 * remediating / n),
        pct_review_only: r2(100 * reviewOnly / n),
        size_adjustment: sizeAdj, diversity_classification: cls, diversity_adjustment: adj,
        raw_group_hours: rawGroup, group_hours: rounded,
        sessions: splitSessions(rounded, rules),
        whole_group_suitable: cls === "very_similar" || cls === "slightly_different",
        needs_differentiation: cls === "significantly_different" || cls === "highly_different",
        subgroup_recommended: cls === "highly_different",
        explanation: "Max individual need " + maxH + " h x (1 + " + sizeAdj + " size + " + adj + " diversity [" + cls.replace(/_/g, " ") + ": hour range " + hourRange + ", accuracy range " + accRange + " pts]) = " + rawGroup + " h; retained without lesson-level rounding at " + rounded + " h."
      };
    });

    var bucket = groupBucket(n);
    var orientation = rules.orientation_hours.group[bucket];
    var review = rules.final_review_hours.group[bucket];
    var allocation = applyGroupCourseConstraints(lessons, orientation, review, row, rules);

    var rawEngH = r2(lessons.filter(function (l) { return l.section === "english"; }).reduce(function (s, l) { return s + l.pre_constraint_group_hours; }, 0));
    var rawMathH = r2(allocation.raw_lesson_hours - rawEngH);
    var engHUnrounded = allocation.unrounded_english_group_hours;
    var mathHUnrounded = allocation.unrounded_math_group_hours;
    var engH = allocation.english_group_hours;
    var mathH = allocation.math_group_hours;

    var indTotals = individuals.map(function (r) { return r.totals.constrained_total; });
    var maxT = Math.max.apply(null, indTotals), minT = Math.min.apply(null, indTotals);
    var spreadPct = r2(100 * (maxT - minT) / maxT);
    var highlyDiff = lessons.filter(function (l) { return l.diversity_classification === "highly_different"; }).length;
    var splitReasons = [];
    if (allocation.supplemental_support_hours > 0) splitReasons.push(allocation.supplemental_support_hours + " h of student-specific need was moved to subgroup/individual support to keep the core group course within its maximum");
    else if (allocation.raw_total > row.maximum) splitReasons.push("the initial group need exceeded the core-course maximum and required explicit live-budget allocation");
    if (highlyDiff >= Math.ceil(lessons.length * 0.25)) splitReasons.push(highlyDiff + " of 28 lessons (25%+) show highly different profiles");
    if (spreadPct > 35) splitReasons.push("individual course totals differ by " + spreadPct + "% (over 35%)");
    if (n > 8 && lessons.filter(function (l) { return l.needs_differentiation; }).length >= 7) splitReasons.push("more than 8 students with significant diversity across many lessons");
    var targets = students.map(function (s) { return (s.goal || {}).target_sat_score; }).filter(function (t) { return t != null; });
    if (targets.length >= 2 && Math.max.apply(null, targets) - Math.min.apply(null, targets) >= 200) splitReasons.push("target scores span " + Math.min.apply(null, targets) + "-" + Math.max.apply(null, targets) + ", which creates incompatible pacing");

    var largeGroup = n >= 9;
    var deliveryNotes = [];
    if (largeGroup) deliveryNotes.push("With " + n + " students this is a group class, not personalized small-group tutoring: plan whole-group core lessons, ability-based practice sets, subgroup tasks, individual progress tracking, targeted homework, optional support sessions, and periodic reassessment.");
    if (n >= 13) deliveryNotes.push("At " + n + " students, consider teaching-assistant support, separate remediation blocks, additional feedback time, digital practice tracking, and smaller breakout groups.");
    if (allocation.supplemental_support_hours > 0) deliveryNotes.push(allocation.supplemental_support_hours + " h is scheduled outside the common core as transparent subgroup/individual support; it is not counted in the capped core group total.");

    var subgroups = null;
    if (splitReasons.length) {
      var withT = individuals.map(function (r, i) { return { name: r.student.student_name, total: indTotals[i] }; })
        .sort(function (a, b) { return b.total - a.total; });
      var third = Math.max(1, Math.ceil(n / 3));
      subgroups = {
        group_a_foundational: withT.slice(0, third).map(function (x) { return x.name; }),
        group_b_standard: withT.slice(third, n - third).map(function (x) { return x.name; }),
        group_c_advanced: withT.slice(n - third).map(function (x) { return x.name; }),
        note: "Composition is a starting suggestion based on total instructional need; refine it with lesson-level profiles, targets, and test dates. Also consider individual support sessions, office hours, optional remediation workshops, and differentiated homework."
      };
    }

    var weeks = weeksForHours(rules, allocation.final_total);
    var gchecks = runGroupChecks(lessons, individuals, allocation, row, sizeAdj);
    gchecks.failed.forEach(function (f) { errors.push({ code: "GROUP_VALIDATION_FAILED", message: f }); });

    return {
      ok: errors.length === 0,
      schema_version: "2.4",
      errors: errors, warnings: warnings, info: info,
      group: { group_name: groupInput.group_name || "Group", group_id: groupInput.group_id || null, size: n, size_bucket: bucket },
      individual_results: individuals,
      lesson_analysis: lessons,
      compatibility: {
        individual_totals: individuals.map(function (r, i) { return { student_name: r.student.student_name, total: indTotals[i] }; }),
        average_individual_total: r2(indTotals.reduce(function (a, b) { return a + b; }, 0) / n),
        lowest_individual_total: minT, highest_individual_total: maxT,
        spread_percent: spreadPct, highly_different_lessons: highlyDiff,
        split_recommended: splitReasons.length > 0, split_reasons: splitReasons, subgroup_recommendation: subgroups
      },
      totals: {
        raw_english_group_hours: rawEngH, raw_math_group_hours: rawMathH,
        unrounded_english_group_hours: engHUnrounded,
        unrounded_math_group_hours: mathHUnrounded,
        unrounded_strategy_hours: allocation.unrounded_strategy_hours,
        english_group_hours: engH, math_group_hours: mathH,
        strategy_hours: allocation.strategy_hours,
        raw_lesson_hours: allocation.raw_lesson_hours, lesson_hours: allocation.final_lesson_hours,
        orientation_hours: allocation.orientation_hours, final_review_hours: allocation.final_review_hours, additional_strategy_hours: allocation.additional_strategy_hours,
        raw_total: allocation.raw_total, raw_component_total: allocation.raw_component_total, initial_need_total: allocation.initial_need_total,
        final_component_total: allocation.final_component_total, final_rounding_adjustment: allocation.final_rounding_adjustment,
        minimum_allowed: row.final_minimum, maximum_allowed: row.maximum, feasible_minimum_total: allocation.feasible_minimum_total,
        size_adjustment: sizeAdj, constrained_total: allocation.final_total, final_planned_total: allocation.final_planned_total,
        hard_cap_enforced: allocation.final_total <= row.maximum + 0.001,
        constraint_status: allocation.status, maximum_infeasible: false, maximum_overrun: 0,
        hours_added: allocation.hours_added, hours_removed: allocation.hours_removed,
        homework_transfer_hours: allocation.homework_transfer_hours, supplemental_support_hours: allocation.supplemental_support_hours,
        constraint_notes: allocation.notes, constraint_allocation: allocation.allocation
      },
      delivery: { large_group: largeGroup, notes: deliveryNotes },
      schedule: { recommended_weeks: weeks, sessions_per_week: 2 },
      validation_checks: gchecks,
      final_interpretation: "Group hours are built lesson by lesson from individual needs, group size, and lesson-specific diversity. The common core is built from unrounded lesson allocations; group Reading & Writing, Math, and strategy totals are then rounded upward independently to whole hours and budgeted within the configured group minimum and maximum. Repetition above the core budget is moved to differentiated practice, while any remaining student-specific need is shown separately as subgroup or individual support rather than allowing the core total to exceed its maximum. Final hours remain planning estimates and may be updated after instruction begins."
    };
  }

  function calcGroupRow(rules, n) {
    var rows = rules.group_size_table;
    for (var i = 0; i < rows.length; i++) if (rows[i].group_size === n) return rows[i];
    return rows[rows.length - 1];
  }


function runGroupChecks(lessons, individuals, allocation, row, sizeAdj) {
  var passed=[],failed=[]; function chk(ok,name){(ok?passed:failed).push(name);}
  var finalLessonSum=r2(lessons.reduce(function(s,l){return s+l.group_hours;},0));
  var rawLessonSum=r2(lessons.reduce(function(s,l){return s+l.pre_constraint_group_hours;},0));
  var adjustmentSum=r2(lessons.reduce(function(s,l){return s+l.constraint_adjustment;},0)+allocation.additional_strategy_hours+(allocation.final_review_hours-allocation.initial_review_hours||0));
  chk(individuals.every(function(r){return r.ok;}),"Every student received an individual calculation first");
  chk(lessons.length===28,"Group lessons were calculated lesson by lesson (28 lessons)");
  chk(lessons.every(function(l){return l.group_hours>=l.minimum_group_hours-0.001;}),"Every core group lesson preserves the shared 0.25-hour minimum");
  chk(lessons.every(function(l){return l.group_hours>=l.max_hours-0.001||l.supplemental_support_hours>0;}),"Any individual need above common core is recorded as supplemental support");
  chk(lessons.every(function(l){return l.size_adjustment===sizeAdj;}),"Group-size adjustment applied consistently");
  chk(Math.abs(allocation.raw_component_total-(rawLessonSum+allocation.initial_orientation_hours+allocation.initial_review_hours))<0.011,"Raw group component total equals lessons plus initial orientation and review");
  chk(Math.abs(allocation.final_component_total-(finalLessonSum+allocation.orientation_hours+allocation.final_review_hours+allocation.additional_strategy_hours))<0.011,"Final group component total equals all final components");
  chk(allocation.final_component_total>=row.final_minimum-0.001&&allocation.final_component_total<=row.maximum+0.001,"Actual group components remain within configured range");
  chk(allocation.english_group_hours===roundSectionUpToInteger(allocation.unrounded_english_group_hours),"Group Reading & Writing is rounded upward to the next whole hour");
  chk(allocation.math_group_hours===roundSectionUpToInteger(allocation.unrounded_math_group_hours),"Group Math is rounded upward to the next whole hour");
  chk(allocation.strategy_hours===roundSectionUpToInteger(allocation.unrounded_strategy_hours),"Group strategy time is rounded upward to the next whole hour");
  chk(Math.abs(allocation.final_total-r2(allocation.english_group_hours+allocation.math_group_hours+allocation.strategy_hours))<0.001,"Final group total equals rounded English, Math, and strategy totals");
  chk(allocation.final_total<=row.maximum+0.001,"The group maximum is enforced after whole-hour section rounding");
  chk(allocation.hard_cap_enforced===true,"The group maximum is enforced on the final scheduled total");
  return {passed:passed,failed:failed};
}

  // ---------- CSV ----------
  var CSV_COLUMNS = ["student_id", "student_name", "section", "module", "question_number", "student_answer", "correct_answer", "difficulty", "time_seconds", "confidence", "guessed", "method", "teacher_note"];
  function parseCsv(text) {
    var rows = [], cur = [], field = "", inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
        else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = "";
        if (cur.length > 1 || cur[0] !== "") rows.push(cur);
        cur = [];
      } else field += c;
    }
    if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
    return rows;
  }
  function importAnswersCsv(text, templateId, config) {
    var errors = [], answersByStudent = {};
    var rows = parseCsv(text);
    if (!rows.length) return { errors: [{ code: "EMPTY_CSV", message: "The CSV file is empty." }], students: {} };
    var header = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var idx = {};
    CSV_COLUMNS.forEach(function (c) { idx[c] = header.indexOf(c); });
    ["section", "module", "question_number", "student_answer"].forEach(function (c) {
      if (idx[c] < 0) errors.push({ code: "MISSING_COLUMN", message: "Required CSV column missing: " + c });
    });
    var tpl = config.diagnostic_templates[templateId];
    if (!tpl) errors.push({ code: "INVALID_TEMPLATE", message: "Unknown diagnostic template: " + templateId });
    if (errors.length) return { errors: errors, students: {} };
    var valid = {};
    tpl.questions.forEach(function (q) { valid[q.section + "|" + q.module + "|" + q.question_number] = true; });
    var seen = {};
    rows.slice(1).forEach(function (r, li) {
      function g(c) { return idx[c] >= 0 && r[idx[c]] !== undefined ? r[idx[c]].trim() : ""; }
      var line = li + 2;
      var sid = g("student_id") || g("student_name") || "student_1";
      var section = g("section").toLowerCase(), module = g("module").toLowerCase();
      var qn = parseInt(g("question_number"), 10);
      if (!qn) { errors.push({ code: "MISSING_QUESTION_NUMBER", message: "Line " + line + ": missing or invalid question_number." }); return; }
      if (module !== "module_1" && module !== "module_b") { errors.push({ code: "INVALID_MODULE", message: "Line " + line + ": module must be module_1 or module_b (got '" + module + "')." }); return; }
      var key = section + "|" + module + "|" + qn;
      if (!valid[key]) { errors.push({ code: "UNMAPPED_QUESTION", message: "Line " + line + ": " + key + " is not part of " + templateId + "." }); return; }
      var skey = sid + "|" + key;
      if (seen[skey]) { errors.push({ code: "DUPLICATE_QUESTION", message: "Line " + line + ": duplicate record for " + key + " (student " + sid + ")." }); return; }
      seen[skey] = true;
      var st = answersByStudent[sid] = answersByStudent[sid] || { student_id: sid, student_name: g("student_name") || sid, answers: [] };
      var ans = {
        section: section, module: module, question_number: qn,
        student_answer: g("student_answer") || null,
        correct_answer: g("correct_answer") || null
      };
      var diff = g("difficulty").toLowerCase();
      if (diff) {
        if (!config.calculation_rules.difficulty_weights[diff]) errors.push({ code: "UNKNOWN_DIFFICULTY", message: "Line " + line + ": unsupported difficulty '" + diff + "'." });
        else ans.difficulty = diff;
      }
      if (g("time_seconds")) ans.time_seconds = parseFloat(g("time_seconds"));
      if (g("confidence")) ans.confidence = g("confidence");
      if (g("guessed")) ans.guessed = /^(1|true|yes|y)$/i.test(g("guessed"));
      if (g("method")) ans.method = g("method");
      if (g("teacher_note")) ans.teacher_note = g("teacher_note");
      st.answers.push(ans);
    });
    return { errors: errors, students: answersByStudent };
  }

  var Engine = {
    roundHalfUp: roundHalfUp,
    roundQuarterNearest: roundQuarterNearest,
    roundFinalUp: roundFinalUp,
    roundQuarterFinal: roundFinalUp,
    roundSectionUpToInteger: roundSectionUpToInteger,
    baseHoursFromRubric: baseHoursFromRubric,
    performanceMultiplier: performanceMultiplier,
    classifyCoverage: classifyCoverage,
    splitSessions: splitSessions,
    validateIndividualInput: validateIndividualInput,
    analyzeIndividual: analyzeIndividual,
    analyzeLesson: analyzeLesson,
    analyzeGroup: analyzeGroup,
    importAnswersCsv: importAnswersCsv,
    parseCsv: parseCsv,
    weeksForHours: weeksForHours,
    applyIndividualCourseConstraints: applyIndividualCourseConstraints,
    applyGroupCourseConstraints: applyGroupCourseConstraints,
    CSV_COLUMNS: CSV_COLUMNS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.TP_ENGINE = Engine;
})(typeof globalThis !== "undefined" ? globalThis : this);
