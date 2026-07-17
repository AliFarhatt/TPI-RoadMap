/* Shared-group diagnostic aggregation and roadmap engine v2.4.1.
 * Builds one pooled instructional profile, runs the established lesson logic
 * once, and applies the configured group-time multiplier before existing
 * group caps, redistribution, and section rounding.
 */
(function (root) {
  "use strict";

  var E = root.TP_ENGINE;
  if (!E && typeof require !== "undefined") E = require("./engine.js");

  function r2(x) { return Math.round(Number(x || 0) * 100) / 100; }
  function finite(v) { return typeof v === "number" && Number.isFinite(v); }
  function pct(x) { return x == null ? null : Math.round(x * 1000) / 10; }
  function nameOf(student, index) {
    var value = student && student.student && student.student.student_name;
    return value && String(value).trim() ? String(value).trim() : "Student " + (index + 1);
  }
  function normDifficulty(v) {
    var d = String(v == null ? "" : v).trim().toLowerCase();
    return d === "easy" || d === "medium" || d === "hard" ? d : null;
  }
  function moduleKey(q) { return q.section + "|" + q.module; }
  function questionKey(q) { return q.section + "|" + q.module + "|" + q.question_number; }
  function applyGroupMultiplier(rawHours, multiplier) { return r2(Number(rawHours || 0) * Number(multiplier || 0)); }

  function ensurePlanningConfig(config) {
    var rules = config.calculation_rules;
    if (!rules.shared_group_planning) rules.shared_group_planning = {};
    var p = rules.shared_group_planning;
    if (p.minimum_valid_students == null) p.minimum_valid_students = 2;
    if (p.instructional_time_multiplier == null) p.instructional_time_multiplier = 2.0;
    if (!p.group_similarity) p.group_similarity = {};
    var s = p.group_similarity;
    if (s.scaled_score_sd_moderate == null) s.scaled_score_sd_moderate = 40;
    if (s.scaled_score_sd_high == null) s.scaled_score_sd_high = 75;
    if (s.accuracy_sd_moderate == null) s.accuracy_sd_moderate = 0.08;
    if (s.accuracy_sd_high == null) s.accuracy_sd_high = 0.15;
    if (p.lesson_variation_minimum_students == null) p.lesson_variation_minimum_students = 2;
    if (p.strength_minimum_administered == null) p.strength_minimum_administered = 4;
    if (p.outlier_minimum_group_size == null) p.outlier_minimum_group_size = 5;
    if (p.outlier_absolute_z_score == null) p.outlier_absolute_z_score = 2.0;
    return p;
  }

  function populationStats(values) {
    var a = (values || []).filter(finite);
    if (!a.length) return { mean:null, min:null, max:null, range:null, sd:null, n:0 };
    var mean = a.reduce(function (s, x) { return s + x; }, 0) / a.length;
    var variance = a.reduce(function (s, x) { return s + Math.pow(x - mean, 2); }, 0) / a.length;
    return {
      mean:r2(mean), min:Math.min.apply(null, a), max:Math.max.apply(null, a),
      range:r2(Math.max.apply(null, a) - Math.min.apply(null, a)),
      sd:a.length >= 2 ? r2(Math.sqrt(variance)) : null, n:a.length
    };
  }

  function statsForQuestions(records) {
    var total = records.length;
    var correct = records.filter(function (q) { return q.correct === true; }).length;
    var answered = records.filter(function (q) {
      return q.student_answer !== null && q.student_answer !== undefined && q.student_answer !== "";
    }).length;
    return {
      correct:correct, administered:total, answered:answered,
      accuracy:total ? correct / total : null,
      completion:total ? answered / total : null
    };
  }

  function pooledStats(questionLists, predicate) {
    var total = 0, correct = 0, answered = 0, represented = 0;
    (questionLists || []).forEach(function (list) {
      var records = (list || []).filter(predicate || function () { return true; });
      if (!records.length) return;
      represented++;
      var s = statsForQuestions(records);
      total += s.administered; correct += s.correct; answered += s.answered;
    });
    return {
      correct:correct, administered:total, answered:answered,
      accuracy:total ? correct / total : null,
      completion:total ? answered / total : null,
      students_represented:represented
    };
  }

  function perStudentAccuracy(questionLists, predicate) {
    return (questionLists || []).map(function (list) {
      var s = statsForQuestions((list || []).filter(predicate || function () { return true; }));
      return s.administered ? s.accuracy : null;
    }).filter(finite);
  }

  function conciseReasons(errors) {
    return (errors || []).map(function (x) { return x.message || x.code || String(x); }).join("; ");
  }

  function validateCandidate(student, index, config) {
    var displayName = nameOf(student, index);
    var v = E.validateIndividualInput(student || {}, config);
    if (!v.template || v.errors.length) return { ok:false, name:displayName, reason:conciseReasons(v.errors) || "Unsupported diagnostic template." };
    var answers = student.diagnostic && student.diagnostic.answers || [];
    if (!answers.length) return { ok:false, name:displayName, reason:"No diagnostic answers were recorded." };

    var mappedLessons = {};
    config.lesson_catalog.lessons.forEach(function (l) { mappedLessons[l.lesson_id] = true; });
    var templateQuestion = {};
    v.template.questions.forEach(function (q) { templateQuestion[questionKey(q)] = q; });
    var missingMapping = answers.some(function (a) {
      var q = templateQuestion[questionKey(a)];
      return !q || !q.lesson_id || !mappedLessons[q.lesson_id];
    });
    if (missingMapping) return { ok:false, name:displayName, reason:"One or more diagnostic questions are missing a supported lesson mapping." };

    var result = E.analyzeIndividual(student, config);
    if (!result.ok) return { ok:false, name:displayName, reason:conciseReasons(result.errors) || "The diagnostic could not be analyzed reliably." };
    var required = ["english|module_1", "english|module_b", "math|module_1", "math|module_b"];
    var present = {};
    result.question_analysis.forEach(function (q) { if (q.correct !== null) present[moduleKey(q)] = true; });
    var missing = required.filter(function (key) { return !present[key]; });
    if (missing.length) {
      return { ok:false, name:displayName, reason:"Required diagnostic section/module data is missing: " + missing.map(function (key) {
        return key.replace("english", "Reading and Writing").replace("math", "Math").replace("module_1", "Module 1").replace("module_b", "Module B");
      }).join(", ") + "." };
    }
    return { ok:true, name:displayName, student:student, result:result, template_id:student.diagnostic.template_id };
  }

  function validateGroup(groupInput, config) {
    var students = groupInput && groupInput.students || [];
    var candidates = students.map(function (s, i) { return validateCandidate(s, i, config); });
    var prelim = candidates.filter(function (c) { return c.ok; });
    var counts = {};
    prelim.forEach(function (c) { counts[c.template_id] = (counts[c.template_id] || 0) + 1; });
    var templateId = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0] || null;
    var valid = [], excluded = [];
    candidates.forEach(function (c, i) {
      if (!c.ok) excluded.push({ index:i, student_name:c.name, reason:c.reason });
      else if (c.template_id !== templateId) excluded.push({ index:i, student_name:c.name, reason:"Diagnostic template does not match the template used by the rest of the group." });
      else valid.push(c);
    });
    var minimum = (config.calculation_rules.shared_group_planning || {}).minimum_valid_students || 2;
    var errors = [];
    if (!valid.length) errors.push({ code:"NO_VALID_GROUP_STUDENTS", message:"No valid students remain. Load diagnostic data that can be analyzed reliably before creating group outputs." });
    else if (valid.length < minimum) errors.push({ code:"INSUFFICIENT_VALID_GROUP_STUDENTS", message:"At least two valid students are required for the group workflow; only " + valid.length + " eligible student remains." });
    return { ok:errors.length === 0, valid:valid, excluded:excluded, template_id:templateId, errors:errors };
  }

  function buildPooled(valid, config) {
    var lists = valid.map(function (v) { return v.result.question_analysis; });
    var pooled = {
      overall:pooledStats(lists), sections:{}, modules:{}, difficulties:{}, lessons:{}, subskills:{}, domains:{}
    };
    ["english", "math"].forEach(function (section) {
      pooled.sections[section] = pooledStats(lists, function (q) { return q.section === section; });
    });
    [["english","module_1"],["english","module_b"],["math","module_1"],["math","module_b"]].forEach(function (d) {
      pooled.modules[d[0] + "|" + d[1]] = pooledStats(lists, function (q) { return q.section === d[0] && q.module === d[1]; });
    });
    ["easy", "medium", "hard"].forEach(function (difficulty) {
      pooled.difficulties[difficulty] = pooledStats(lists, function (q) { return normDifficulty(q.difficulty) === difficulty; });
    });
    config.lesson_catalog.lessons.forEach(function (lesson) {
      pooled.lessons[lesson.lesson_id] = pooledStats(lists, function (q) { return q.lesson_id === lesson.lesson_id; });
    });
    var subskills = {};
    lists.forEach(function (list) { list.forEach(function (q) { if (q.subskill_id) subskills[q.subskill_id] = true; }); });
    Object.keys(subskills).forEach(function (id) {
      pooled.subskills[id] = pooledStats(lists, function (q) { return q.subskill_id === id; });
    });
    (config.lesson_catalog.units || []).forEach(function (unit) {
      var ids = {};
      (unit.lesson_ids || []).forEach(function (id) { ids[id] = true; });
      pooled.domains[unit.unit_id] = pooledStats(lists, function (q) { return !!ids[q.lesson_id]; });
      pooled.domains[unit.unit_id].label = unit.unit_name;
    });
    return { pooled:pooled, question_lists:lists };
  }

  function buildScoreStats(valid) {
    function values(key) {
      return valid.map(function (v) { return v.student.scores && v.student.scores[key]; }).filter(finite);
    }
    return {
      total:populationStats(values("total_scaled")),
      reading_writing:populationStats(values("reading_writing_scaled")),
      math:populationStats(values("math_scaled"))
    };
  }

  function buildVariation(valid, questionLists, config) {
    var variation = {
      overall_accuracy:populationStats(perStudentAccuracy(questionLists)),
      sections:{}, modules:{}, difficulties:{}, lessons:{}
    };
    ["english", "math"].forEach(function (section) {
      variation.sections[section] = populationStats(perStudentAccuracy(questionLists, function (q) { return q.section === section; }));
    });
    [["english","module_1"],["english","module_b"],["math","module_1"],["math","module_b"]].forEach(function (d) {
      variation.modules[d[0] + "|" + d[1]] = populationStats(perStudentAccuracy(questionLists, function (q) { return q.section === d[0] && q.module === d[1]; }));
    });
    ["easy", "medium", "hard"].forEach(function (difficulty) {
      variation.difficulties[difficulty] = populationStats(perStudentAccuracy(questionLists, function (q) { return normDifficulty(q.difficulty) === difficulty; }));
    });
    config.lesson_catalog.lessons.forEach(function (lesson) {
      variation.lessons[lesson.lesson_id] = populationStats(perStudentAccuracy(questionLists, function (q) { return q.lesson_id === lesson.lesson_id; }));
    });
    return variation;
  }

  function classifySimilarity(scoreStats, variation, rules) {
    var cfg = rules.shared_group_planning.group_similarity;
    var major = [
      { key:"total_score", label:"Total scaled score", sd:scoreStats.total.sd, type:"score" },
      { key:"reading_writing_score", label:"Reading and Writing scaled score", sd:scoreStats.reading_writing.sd, type:"score" },
      { key:"math_score", label:"Math scaled score", sd:scoreStats.math.sd, type:"score" },
      { key:"overall_accuracy", label:"Overall diagnostic accuracy", sd:variation.overall_accuracy.sd, type:"accuracy" },
      { key:"reading_writing_accuracy", label:"Reading and Writing accuracy", sd:variation.sections.english.sd, type:"accuracy" },
      { key:"math_accuracy", label:"Math accuracy", sd:variation.sections.math.sd, type:"accuracy" }
    ];
    var flags = major.filter(function (m) {
      var threshold = m.type === "score" ? cfg.scaled_score_sd_high : cfg.accuracy_sd_high;
      return m.sd != null && m.sd >= threshold;
    });
    var moderate = major.filter(function (m) {
      var threshold = m.type === "score" ? cfg.scaled_score_sd_moderate : cfg.accuracy_sd_moderate;
      return m.sd != null && m.sd >= threshold;
    });
    var level = flags.length ? "high" : moderate.length ? "moderate" : "consistent";
    return {
      level:level,
      label:level === "high" ? "High variation" : level === "moderate" ? "Moderate variation" : "Consistent",
      flags:flags,
      moderate_flags:moderate,
      thresholds:cfg
    };
  }

  function aggregateFoundationalGaps(valid) {
    var byLesson = {};
    valid.forEach(function (v) {
      ((v.student.student || {}).known_foundational_gaps || []).forEach(function (gap) {
        if (!gap.lesson_id) return;
        var item = byLesson[gap.lesson_id] = byLesson[gap.lesson_id] || { lesson_id:gap.lesson_id, severity:"moderate", students:[] };
        if (gap.severity === "major") item.severity = "major";
        item.students.push(v.name);
      });
    });
    return Object.keys(byLesson).map(function (id) {
      var item = byLesson[id];
      return { lesson_id:id, severity:item.severity, evidence:"Reported in intake evidence for " + item.students.length + " valid student(s)." };
    });
  }

  function aggregateQuestionRecords(valid) {
    var byKey = {};
    valid.forEach(function (v) {
      v.result.question_analysis.forEach(function (q) {
        var key = questionKey(q);
        var rec = byKey[key];
        if (!rec) rec = byKey[key] = {
          section:q.section, module:q.module, question_number:q.question_number,
          lesson_id:q.lesson_id, subskill_id:q.subskill_id,
          question_style:q.question_style, difficulty:normDifficulty(q.difficulty),
          weight:q.weight, module_weight:q.module_weight, difficulty_weight:q.difficulty_weight,
          administered_count:0, correct_count:0, guessed:false, slow:false, rushed:false,
          time_seconds:null, student_answer:null, correct_answer:q.correct_answer
        };
        rec.administered_count++;
        if (q.correct === true) rec.correct_count++;
      });
    });
    return Object.keys(byKey).map(function (key) {
      var q = byKey[key];
      q.correct = q.correct_count === q.administered_count;
      q.error_type = q.correct ? null : "pooled_incorrect";
      return q;
    });
  }

  function orderSharedLessons(lessons, config) {
    var priorityWeight = { CRITICAL:4, HIGH:3, MEDIUM:2, ESSENTIAL_REVIEW:1 };
    var units = (config.lesson_catalog.units || []).map(function (unit) {
      var ls = lessons.filter(function (l) { return l.unit_id === unit.unit_id; }).sort(function (a, b) {
        return (a.lesson_order_within_unit || 0) - (b.lesson_order_within_unit || 0);
      });
      var hours = ls.reduce(function (s, l) { return s + l.group_hours; }, 0);
      var urgency = hours ? ls.reduce(function (s, l) { return s + (priorityWeight[l.priority] || 1) * l.group_hours; }, 0) / hours : 0;
      return { unit_id:unit.unit_id, unit_name:unit.unit_name, unit_order:unit.unit_order, hours:r2(hours), urgency:urgency, lessons:ls };
    }).filter(function (u) { return u.lessons.length; });
    units.sort(function (a, b) { return b.urgency - a.urgency || b.hours - a.hours || a.unit_order - b.unit_order; });
    var sequence = [];
    units.forEach(function (u) { u.lessons.forEach(function (l) { sequence.push(l); }); });
    return { units:units, sequence:sequence };
  }

  function buildSharedRoadmap(groupInput, valid, pooled, variation, config, warnings) {
    var rules = config.calculation_rules;
    var planning = rules.shared_group_planning;
    var multiplier = planning.instructional_time_multiplier;
    var aggregateQuestions = aggregateQuestionRecords(valid);
    var byLesson = {};
    aggregateQuestions.forEach(function (q) { (byLesson[q.lesson_id] = byLesson[q.lesson_id] || []).push(q); });
    var targets = valid.map(function (v) { return v.student.goal && v.student.goal.target_sat_score; }).filter(finite);
    var synthetic = {
      student:{
        student_name:(groupInput.group_name || "Group") + " pooled profile",
        known_foundational_gaps:aggregateFoundationalGaps(valid),
        teacher_overrides:[], teacher_flagged_weak_subskills:[]
      },
      goal:{ target_sat_score:targets.length ? Math.round(targets.reduce(function (s, x) { return s + x; }, 0) / targets.length) : null }
    };
    var lessonWarnings = [];
    var lessons = config.lesson_catalog.lessons.map(function (catalogLesson) {
      var lesson = E.analyzeLesson(catalogLesson, byLesson[catalogLesson.lesson_id] || [], synthetic, rules, lessonWarnings);
      var studentLessons = valid.map(function (v) { return v.result.lesson_analysis.filter(function (x) { return x.lesson_id === lesson.lesson_id; })[0]; });
      var lessonVar = variation.lessons[lesson.lesson_id];
      var highVariation = lessonVar && lessonVar.n >= planning.lesson_variation_minimum_students && lessonVar.sd != null && lessonVar.sd >= planning.group_similarity.accuracy_sd_high;
      lesson.individual_equivalent_raw_hours = lesson.final_hours;
      lesson.group_multiplier = multiplier;
      lesson.raw_group_hours = applyGroupMultiplier(lesson.final_hours, multiplier);
      lesson.group_hours = lesson.raw_group_hours;
      lesson.minimum_group_hours = r2(lesson.minimum_applied * multiplier);
      lesson.max_hours = lesson.raw_group_hours;
      lesson.avg_weighted_accuracy = lesson.weighted_accuracy;
      lesson.unassessed_students = studentLessons.filter(function (x) { return x.coverage_level === "not_assessed"; }).length;
      lesson.limited_students = studentLessons.filter(function (x) { return x.coverage_level === "limited"; }).length;
      lesson.pct_requiring_remediation = r2(100 * studentLessons.filter(function (x) { return x.priority === "CRITICAL" || x.priority === "HIGH"; }).length / valid.length);
      lesson.diversity_adjustment = 0;
      lesson.accuracy_sd = lessonVar ? lessonVar.sd : null;
      lesson.accuracy_sd_n = lessonVar ? lessonVar.n : 0;
      lesson.needs_differentiation = !!highVariation;
      lesson.differentiation_note = highVariation ? "Mixed readiness: teach the core lesson to the full group, then use tiered practice or extension questions for students at different levels." : null;
      lesson.explanation += " Shared-group raw time: " + lesson.individual_equivalent_raw_hours + " h × " + multiplier + " = " + lesson.raw_group_hours + " h before group caps and final category rounding.";
      return lesson;
    });
    Array.prototype.push.apply(warnings, lessonWarnings);

    var row = rules.group_size_table.filter(function (r) { return r.group_size === valid.length; })[0] || rules.group_size_table[rules.group_size_table.length - 1];
    var individualOrientation = rules.orientation_hours.individual_default;
    var individualReview = rules.final_review_hours.individual_default;
    var rawOrientation = r2(individualOrientation * multiplier);
    var rawReview = r2(individualReview * multiplier);
    var allocation = E.applyGroupCourseConstraints(lessons, rawOrientation, rawReview, row, rules);
    var ordered = orderSharedLessons(lessons, config);
    var sessionsPerWeek = groupInput.shared_schedule && Number(groupInput.shared_schedule.sessions_per_week) || 2;
    var recommendedWeeks = E.weeksForHours(rules, allocation.final_total);
    var estimatedSessions = lessons.reduce(function (s, l) { return s + (l.sessions || []).length; }, 0) + Math.ceil(allocation.strategy_hours / 1.5);
    return {
      model:"one_shared_course",
      lesson_analysis:lessons,
      lesson_sequence:ordered.sequence,
      units:ordered.units,
      strategy:{
        individual_equivalent_orientation_hours:individualOrientation,
        individual_equivalent_final_review_hours:individualReview,
        raw_group_orientation_hours:rawOrientation,
        raw_group_final_review_hours:rawReview,
        orientation_hours:allocation.orientation_hours,
        final_review_hours:allocation.final_review_hours,
        additional_strategy_hours:allocation.additional_strategy_hours,
        unrounded_hours:allocation.unrounded_strategy_hours,
        scheduled_hours:allocation.strategy_hours
      },
      totals:{
        raw_english_group_hours:r2(lessons.filter(function (l) { return l.section === "english"; }).reduce(function (s, l) { return s + l.pre_constraint_group_hours; }, 0)),
        raw_math_group_hours:r2(lessons.filter(function (l) { return l.section === "math"; }).reduce(function (s, l) { return s + l.pre_constraint_group_hours; }, 0)),
        unrounded_english_group_hours:allocation.unrounded_english_group_hours,
        unrounded_math_group_hours:allocation.unrounded_math_group_hours,
        english_group_hours:allocation.english_group_hours,
        math_group_hours:allocation.math_group_hours,
        unrounded_strategy_hours:allocation.unrounded_strategy_hours,
        strategy_hours:allocation.strategy_hours,
        raw_lesson_hours:allocation.raw_lesson_hours,
        lesson_hours:allocation.final_lesson_hours,
        raw_orientation_hours:rawOrientation,
        raw_final_review_hours:rawReview,
        orientation_hours:allocation.orientation_hours,
        final_review_hours:allocation.final_review_hours,
        additional_strategy_hours:allocation.additional_strategy_hours,
        raw_component_total:allocation.raw_component_total,
        final_component_total:allocation.final_component_total,
        final_rounding_adjustment:allocation.final_rounding_adjustment,
        constrained_total:allocation.final_total,
        final_planned_total:allocation.final_total,
        minimum_allowed:row.final_minimum,
        maximum_allowed:row.maximum,
        constraint_status:allocation.status,
        constraint_notes:allocation.notes,
        constraint_allocation:allocation.allocation,
        homework_transfer_hours:allocation.homework_transfer_hours,
        supplemental_support_hours:allocation.supplemental_support_hours
      },
      schedule:{ sessions_per_week:sessionsPerWeek, recommended_weeks:recommendedWeeks, approximate_sessions:estimatedSessions },
      group_multiplier:multiplier,
      calculation_note:"Pooled diagnostic counts are analyzed once. Raw lesson and strategy time is multiplied by " + multiplier + "; the result then passes through the existing group cap, redistribution, section balancing, and whole-hour category rounding stages."
    };
  }

  function buildStrengthsAndPriorities(pooled, lessons, config) {
    var minEvidence = config.calculation_rules.shared_group_planning.strength_minimum_administered;
    var strengths = lessons.filter(function (l) {
      var p = pooled.lessons[l.lesson_id];
      return p && p.administered >= minEvidence && p.students_represented >= 2 && p.accuracy != null;
    }).sort(function (a, b) {
      var pa = pooled.lessons[a.lesson_id], pb = pooled.lessons[b.lesson_id];
      return pb.accuracy - pa.accuracy || pb.administered - pa.administered || pb.students_represented - pa.students_represented;
    }).slice(0, 3).map(function (l) { return Object.assign({ lesson_id:l.lesson_id, lesson_name:l.lesson_name }, pooled.lessons[l.lesson_id]); });
    var rank = { CRITICAL:0, HIGH:1, MEDIUM:2, ESSENTIAL_REVIEW:3 };
    var priorities = lessons.slice().sort(function (a, b) {
      var pa = pooled.lessons[a.lesson_id], pb = pooled.lessons[b.lesson_id];
      return rank[a.priority] - rank[b.priority] || (pa.accuracy == null ? 1 : pa.accuracy) - (pb.accuracy == null ? 1 : pb.accuracy) || b.group_hours - a.group_hours;
    }).slice(0, 3).map(function (l) {
      return Object.assign({ lesson_id:l.lesson_id, lesson_name:l.lesson_name, priority:l.priority, group_hours:l.group_hours }, pooled.lessons[l.lesson_id]);
    });
    return { strengths:strengths, priorities:priorities };
  }

  function studentSnapshots(valid) {
    return valid.map(function (v) {
      var sc = v.student.scores || {};
      var overall = statsForQuestions(v.result.question_analysis);
      return {
        student_name:v.name,
        total_score:finite(sc.total_scaled) ? sc.total_scaled : null,
        reading_writing_score:finite(sc.reading_writing_scaled) ? sc.reading_writing_scaled : null,
        math_score:finite(sc.math_scaled) ? sc.math_scaled : null,
        overall_accuracy:overall.accuracy,
        administered:overall.administered,
        correct:overall.correct
      };
    });
  }

  function detectOutliers(valid, scoreStats, config) {
    var planning = config.calculation_rules.shared_group_planning;
    if (valid.length < planning.outlier_minimum_group_size) return [];
    var defs = [
      ["total_scaled", "Total score", scoreStats.total],
      ["reading_writing_scaled", "Reading and Writing", scoreStats.reading_writing],
      ["math_scaled", "Math", scoreStats.math]
    ];
    var out = [];
    defs.forEach(function (d) {
      if (d[2].sd == null || d[2].sd === 0) return;
      valid.forEach(function (v) {
        var value = v.student.scores && v.student.scores[d[0]];
        if (!finite(value)) return;
        var z = (value - d[2].mean) / d[2].sd;
        if (Math.abs(z) >= planning.outlier_absolute_z_score) out.push({
          student_name:v.name, measure:d[1], value:value, z:r2(z), direction:z < 0 ? "support" : "extension",
          note:z < 0 ? "May need additional support in this area." : "Performing above the current group level and may benefit from extension work."
        });
      });
    });
    return out;
  }

  function analyzeSharedGroup(groupInput, config) {
    ensurePlanningConfig(config);
    var validation = validateGroup(groupInput || {}, config);
    var warnings = validation.excluded.map(function (x) { return { code:"EXCLUDED_STUDENT", student_name:x.student_name, reason:x.reason, message:x.student_name + " was excluded: " + x.reason }; });
    if (!validation.ok) return {
      ok:false, errors:validation.errors, warnings:warnings, info:[],
      group:{ group_name:groupInput && groupInput.group_name || "Group", valid_student_count:validation.valid.length, excluded_student_count:validation.excluded.length },
      valid_students:validation.valid.map(function (v) { return v.student; }), excluded_students:validation.excluded
    };
    var aggregate = buildPooled(validation.valid, config);
    var scores = buildScoreStats(validation.valid);
    var variation = buildVariation(validation.valid, aggregate.question_lists, config);
    var similarity = classifySimilarity(scores, variation, config.calculation_rules);
    var roadmap = buildSharedRoadmap(groupInput, validation.valid, aggregate.pooled, variation, config, warnings);
    var highlights = buildStrengthsAndPriorities(aggregate.pooled, roadmap.lesson_analysis, config);
    Object.keys(scores).forEach(function (key) {
      if (scores[key].n < validation.valid.length) warnings.push({ code:"MISSING_SCALED_SCORES", message:(validation.valid.length - scores[key].n) + " valid student(s) have no provided " + key.replace("reading_writing", "Reading and Writing").replace("total", "total").replace("math", "Math") + " scaled score; that score summary uses n=" + scores[key].n + "." });
    });
    if (similarity.level === "high") warnings.push({ code:"HIGH_GROUP_VARIATION", message:"Performance variation is high in " + similarity.flags.map(function (f) { return f.label; }).join(", ") + ". The shared roadmap remains appropriate, with tiered practice where needed." });
    var lessonFlags = roadmap.lesson_analysis.filter(function (l) { return l.needs_differentiation; }).sort(function (a, b) { return b.accuracy_sd - a.accuracy_sd; });

    var passed = [], failed = [];
    function check(condition, text) { (condition ? passed : failed).push(text); }
    var multiplier = config.calculation_rules.shared_group_planning.instructional_time_multiplier;
    check(validation.valid.length >= 2, "At least two valid students are included");
    check(roadmap.lesson_analysis.length === config.lesson_catalog.lessons.length, "One shared lesson record exists for every catalog lesson");
    check(roadmap.lesson_analysis.every(function (l) { return Math.abs(l.raw_group_hours - l.individual_equivalent_raw_hours * multiplier) < 0.011; }), "Every raw shared lesson need receives the configured group multiplier before rounding");
    check(Math.abs(roadmap.strategy.raw_group_orientation_hours - roadmap.strategy.individual_equivalent_orientation_hours * multiplier) < 0.011 && Math.abs(roadmap.strategy.raw_group_final_review_hours - roadmap.strategy.individual_equivalent_final_review_hours * multiplier) < 0.011, "Strategy time receives the configured group multiplier before constraints");
    check(Math.abs(roadmap.totals.final_planned_total - (roadmap.totals.english_group_hours + roadmap.totals.math_group_hours + roadmap.totals.strategy_hours)) < 0.011, "Final group total reconciles to rounded Reading and Writing, Math, and strategy totals");
    check(new Set(roadmap.lesson_sequence.map(function (l) { return l.lesson_id; })).size === roadmap.lesson_analysis.length, "The shared roadmap contains no per-student lesson duplication");

    var dates = validation.valid.map(function (v) { return v.student.diagnostic && v.student.diagnostic.date; }).filter(function (x) { return !!x; });
    var result = {
      ok:failed.length === 0,
      schema_version:"2.4.1-shared-group",
      errors:failed.map(function (x) { return { code:"SHARED_GROUP_VALIDATION_FAILED", message:x }; }),
      warnings:warnings, info:[],
      group:{
        group_name:groupInput.group_name || "Group", group_id:groupInput.group_id || null,
        valid_student_count:validation.valid.length, excluded_student_count:validation.excluded.length,
        original_student_count:(groupInput.students || []).length, template_id:validation.template_id,
        assessment_title:config.diagnostic_templates[validation.template_id].test_name,
        season:groupInput.season || validation.valid[0].student.season || "SAT Program",
        diagnostic_date_range:dates.length ? (dates.every(function (d) { return d === dates[0]; }) ? dates[0] : dates.sort()[0] + " – " + dates.sort()[dates.length - 1]) : null
      },
      valid_students:validation.valid.map(function (v) { return v.student; }),
      excluded_students:validation.excluded,
      student_snapshots:studentSnapshots(validation.valid),
      pooled:aggregate.pooled,
      score_statistics:scores,
      variation:variation,
      similarity:similarity,
      variation_flags:lessonFlags,
      strengths:highlights.strengths,
      priority_areas:highlights.priorities,
      outliers:detectOutliers(validation.valid, scores, config),
      roadmap:roadmap,
      lesson_analysis:roadmap.lesson_analysis,
      totals:roadmap.totals,
      schedule:roadmap.schedule,
      validation_checks:{ passed:passed, failed:failed },
      final_interpretation:"This is one shared course derived from pooled diagnostic evidence. Correct and administered totals are pooled; scaled scores use arithmetic summaries over provided values. The 2.0 instructional-time multiplier applies once to shared lesson and strategy needs, never once per student. Lesson-level variation adds differentiation notes without splitting the core lesson."
    };
    return result;
  }

  var API = {
    analyzeSharedGroup:analyzeSharedGroup,
    validateGroup:validateGroup,
    populationStats:populationStats,
    pooledStats:pooledStats,
    statsForQuestions:statsForQuestions,
    classifySimilarity:classifySimilarity,
    normDifficulty:normDifficulty,
    orderSharedLessons:orderSharedLessons
    ,applyGroupMultiplier:applyGroupMultiplier
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TP_GROUP_SHARED = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
