// TestPrep planning engine unit tests. Run: node tests/unit/engine.test.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const g = {}; new Function("window", fs.readFileSync(path.join(ROOT, "app/js/config-data.js"), "utf8"))(g);
const CFG = g.TP_CONFIG;
const E = require(path.join(ROOT, "app/js/engine.js"));

let pass = 0, fail = 0; const failures = [];
function T(name, cond, detail) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; failures.push(name + (detail ? " :: " + detail : "")); console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}
function approx(a, b) { return Math.abs(a - b) < 1e-9; }

// ---------- final-total rounding upward to next quarter hour ----------
console.log("[rounding: final total upward to next 0.25]");
const finalCases = [[0.01,0.25],[0.12,0.25],[0.24,0.25],[0.25,0.25],[0.26,0.5],[0.37,0.5],[0.5,0.5],[0.51,0.75],[1.0,1.0],[1.01,1.25],[2.24,2.25],[2.25,2.25],[2.26,2.5]];
finalCases.forEach(([i,o]) => T(`roundFinalUp(${i}) = ${o}`, approx(E.roundFinalUp(i),o), "got "+E.roundFinalUp(i)));
T("homework still rounds nearest quarter", E.roundQuarterNearest(0.37) === 0.25 && E.roundQuarterNearest(0.38) === 0.5);

// ---------- base hours ----------
console.log("[calibrated lesson-specific base-hour rubric]");
T("rubric reproduces every approved lesson base hour", CFG.lesson_catalog.lessons.every(l => E.baseHoursFromRubric(CFG.calculation_rules, l.rubric, l.reference_base_hours).hours === l.reference_base_hours));
T("English approved base total = 5.16", approx(CFG.lesson_catalog.lessons.filter(l=>l.section==="english").reduce((s,l)=>s+l.reference_base_hours,0),5.16));
T("Math approved base total = 8.92", approx(CFG.lesson_catalog.lessons.filter(l=>l.section==="math").reduce((s,l)=>s+l.reference_base_hours,0),8.92));
T("equal B/D/S profiles may retain different calibrated hours", (()=>{const x=CFG.lesson_catalog.lessons.filter(l=>l.rubric.breadth===2&&l.rubric.concept_difficulty===2&&l.rubric.sat_strategy_load===2).map(l=>l.reference_base_hours);return new Set(x).size>1;})());
T("28 lessons: 9 English + 19 Math", CFG.lesson_catalog.lessons.length===28 && CFG.lesson_catalog.lessons.filter(l=>l.section==="english").length===9);

// ---------- official SAT unit grouping ----------
console.log("[unit grouping]");
T("8 official units configured", Array.isArray(CFG.lesson_catalog.units) && CFG.lesson_catalog.units.length === 8);
T("every lesson belongs to exactly one configured unit", (()=>{const ids=CFG.lesson_catalog.units.flatMap(u=>u.lesson_ids); return ids.length===28 && new Set(ids).size===28 && CFG.lesson_catalog.lessons.every(l=>ids.includes(l.lesson_id)&&l.unit_id&&l.unit_name);})());

// ---------- performance multipliers ----------
console.log("[performance multipliers]");
[[95, 0.5], [90, 0.5], [80, 0.75], [75, 0.75], [65, 1.0], [60, 1.0], [50, 1.5], [40, 1.5], [30, 2.0], [0, 2.0]]
  .forEach(([a, m]) => T(`acc ${a}% -> x${m}`, E.performanceMultiplier(CFG.calculation_rules, a) === m));

// ---------- coverage ----------
console.log("[coverage classification]");
const q = (sub) => ({ subskill_id: sub });
T("0 questions -> not_assessed", E.classifyCoverage([]) === "not_assessed");
T("1 question -> limited", E.classifyCoverage([q("a")]) === "limited");
T("3 same-subskill -> limited (repetition downgrade)", E.classifyCoverage([q("a"), q("a"), q("a")]) === "limited");
T("2 different subskills -> moderate", E.classifyCoverage([q("a"), q("b")]) === "moderate");
T("4 varied -> strong", E.classifyCoverage([q("a"), q("b"), q("a"), q("b")]) === "strong");
T("5 same-subskill -> moderate not strong", E.classifyCoverage([q("a"), q("a"), q("a"), q("a"), q("a")]) === "moderate");

// ---------- helper to build synthetic individual cases ----------
const tpl = CFG.diagnostic_templates.Diagnostic_Exam_2026;
function mkCase(answerFn, extra) {
  const answers = [];
  tpl.questions.forEach(qq => { const a = answerFn(qq); if (a) answers.push(Object.assign({ section: qq.section, module: qq.module, question_number: qq.question_number }, a)); });
  return Object.assign({
    schema_version: "2.0",
    student: { student_name: "Test Student", known_foundational_gaps: [], teacher_overrides: [] },
    scores: { score_source: "provided" }, goal: {},
    availability: { preferred_sessions_per_week: 2 },
    diagnostic: { template_id: "Diagnostic_Exam_2026", date: "July 6, 2026", answers }
  }, extra || {});
}
function lesson(res, id) { return res.lesson_analysis.find(l => l.lesson_id === id); }

// ---------- weighting & weighted accuracy ----------
console.log("[module-only weighting and weighted accuracy]");
// Systems of Linear Equations: M1 Q11,Q17 + MB Q18. Two M1 correct, MB wrong -> 2.00/3.20 = 62.5%
let res = E.analyzeIndividual(mkCase(qq => {
  if (qq.lesson_id !== "MATH_SYSTEMS_LINEAR") return { student_answer: "A", correct_answer: "A" };
  if (qq.module === "module_1") return { student_answer: "A", correct_answer: "A" };
  return { student_answer: "B", correct_answer: "A" };
}), CFG);
let L = lesson(res, "MATH_SYSTEMS_LINEAR");
T("spec example: weighted accuracy 62.5%", L.weighted_accuracy === 62.5, "got " + L.weighted_accuracy);
T("module weights 1.00 / 1.20 recorded", res.question_analysis.every(x => x.module === "module_b" ? x.module_weight === 1.2 : x.module_weight === 1.0));
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "A", correct_answer: "A", difficulty: qq.module === "module_b" ? "hard" : "easy" })), CFG);
T("difficulty metadata does not change module weight", res.question_analysis.every(x => x.weight === (x.module === "module_b" ? 1.2 : 1.0)));

// ---------- unassessed / limited / coverage floors ----------
console.log("[coverage floors & unassessed lessons]");
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "A", correct_answer: "A" })), CFG);
const prob = lesson(res, "MATH_PROBABILITY");
T("Probability not assessed by Kaplan PT2", prob.coverage_level === "not_assessed");
T("unassessed: accuracy is unknown (null)", prob.weighted_accuracy === null && prob.raw_accuracy === null);
T("unassessed: final multiplier 1.00, full base hours", prob.final_multiplier === 1.0 && prob.core_hours >= prob.base_hours);
T("unassessed: mini-assessment recommended", prob.mini_assessment_recommended === true);
const ctc = lesson(res, "ENG_CROSS_TEXT_CONNECTIONS"); // one question in MB
T("1-question lesson: limited coverage", ctc.coverage_level === "limited");
T("100% on limited coverage: floor keeps multiplier at 1.00", ctc.weighted_accuracy === 100 && ctc.final_multiplier === 1.0);
const wic = lesson(res, "ENG_WORDS_IN_CONTEXT"); // 9 questions one subskill -> moderate
T("many same-subskill questions cap at moderate (floor 0.75)", wic.coverage_level === "moderate" && wic.final_multiplier === 0.75);
const sec = lesson(res, "ENG_STANDARD_ENGLISH_CONVENTIONS");
T("broad lesson shares the absolute 0.25 h minimum", sec.minimum_applied === 0.25 && sec.final_hours >= 0.25);
// A neutral foundational state must not cancel an evidence-supported reduction.
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "A", correct_answer: "A" })), CFG);
L = lesson(res, "ENG_STANDARD_ENGLISH_CONVENTIONS");
T("no foundational concern allows performance/coverage reduction below calibrated base", L.foundational_level === "none" && L.core_hours < L.base_hours, JSON.stringify({base:L.base_hours,core:L.core_hours,finalMult:L.final_multiplier}));

// excellent vs low performance
console.log("[performance extremes]");
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "B", correct_answer: "A" })), CFG);
const secLow = lesson(res, "ENG_STANDARD_ENGLISH_CONVENTIONS");
T("0% accuracy -> multiplier 2.0", secLow.performance_multiplier === 2.0 && secLow.final_multiplier === 2.0);
T("CRITICAL priority at <40%", secLow.priority === "CRITICAL");
T("low performer final component total is at or below 35 h", res.totals.final_component_total <= 35 && res.totals.raw_total >= res.totals.final_component_total);
T("constraint note appears only when maximum-budget reduction is needed", res.totals.raw_total > 35 ? res.totals.constraint_notes.length === 1 : res.totals.constraint_notes.length === 0);
T("individual cap is distributed across lesson components", approx(res.totals.final_component_total, res.lesson_analysis.reduce((s,l)=>s+l.final_hours,0)+res.totals.strategy_hours));
T("no transfer is claimed when the low-performer plan is already under 35", res.totals.raw_total > 35 || res.totals.homework_transfer_hours === 0);

// Stress the hard cap with an override on every lesson. The plan itself, not only
// a headline total, must still be reduced to 35 h.
const extremeOverrides = CFG.lesson_catalog.lessons.map(l => ({ lesson_id: l.lesson_id, additional_hours: 10, reason: "stress-test override" }));
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "B", correct_answer: "A" }), {
  student: { student_name: "Hard Cap Stress", known_foundational_gaps: [], teacher_overrides: extremeOverrides }
}), CFG);
T("extreme overrides still produce a hard-capped 35 h plan", res.ok && res.totals.final_planned_total === 35 && res.totals.final_component_total === 35 && res.totals.hard_cap_enforced === true, JSON.stringify(res.errors));
T("extreme-cap final components sum exactly to 35 h", approx(res.lesson_analysis.reduce((s,l)=>s+l.final_hours,0)+res.totals.strategy_hours,35));
T("extreme-cap plan preserves every lesson floor", res.lesson_analysis.every(l => l.final_hours >= l.minimum_applied));
T("extreme removed lesson time is transferred to homework", res.totals.homework_transfer_hours > 0 && res.totals.constraint_allocation.some(a => a.action === "transferred_extra_practice_to_homework" || a.action === "compressed_guided_practice_to_homework"));

// ---------- foundational override ----------
console.log("[foundational override]");
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "A", correct_answer: "A" }), {
  student: { student_name: "T", known_foundational_gaps: [{ lesson_id: "MATH_LINEAR_FUNCTIONS", severity: "major", evidence: "cannot isolate variables" }], teacher_overrides: [] }
}), CFG);
L = lesson(res, "MATH_LINEAR_FUNCTIONS");
T("major gap: core = base x 1.5 beats perf x0.75", approx(L.core_hours, L.base_hours * 1.5), "core " + L.core_hours);
T("foundational override has real mathematical effect", L.core_hours > L.initial_hours);
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "A", correct_answer: "A" }), {
  student: { student_name: "T", known_foundational_gaps: [{ lesson_id: "MATH_LINEAR_FUNCTIONS", severity: "moderate" }], teacher_overrides: [] }
}), CFG);
T("moderate gap uses 1.25", approx(lesson(res, "MATH_LINEAR_FUNCTIONS").foundational_multiplier, 1.25));

// ---------- weak subskill clusters ----------
console.log("[weak subskill clusters]");
res = E.analyzeIndividual(mkCase(qq => {
  if (qq.lesson_id === "ENG_COMMAND_OF_EVIDENCE") return { student_answer: "B", correct_answer: "A" }; // 7 wrong, 1 subskill
  return { student_answer: "A", correct_answer: "A" };
}), CFG);
L = lesson(res, "ENG_COMMAND_OF_EVIDENCE");
T("one weak cluster -> +0.25 h", L.weak_subskill_clusters.length === 1 && L.subskill_adjustment === 0.25);
// multiple clusters via teacher flags
res = E.analyzeIndividual(mkCase(qq => {
  if (qq.lesson_id === "ENG_STANDARD_ENGLISH_CONVENTIONS") return { student_answer: "B", correct_answer: "A" };
  return { student_answer: "A", correct_answer: "A" };
}, {
  student: {
    student_name: "T", known_foundational_gaps: [], teacher_overrides: [],
    teacher_flagged_weak_subskills: [
      { lesson_id: "ENG_STANDARD_ENGLISH_CONVENTIONS", subskill_id: "punctuation" },
      { lesson_id: "ENG_STANDARD_ENGLISH_CONVENTIONS", subskill_id: "verb_agreement" }]
  }
}), CFG);
L = lesson(res, "ENG_STANDARD_ENGLISH_CONVENTIONS");
T("3+ clusters -> +0.75 h", L.weak_subskill_clusters.length >= 3 && L.subskill_adjustment === 0.75, JSON.stringify(L.weak_subskill_clusters));
T("isolated single wrong answer does not create a cluster",
  (() => { const r = E.analyzeIndividual(mkCase(qq => {
    if (qq.lesson_id === "MATH_CIRCLES") return { student_answer: "B", correct_answer: "A" };
    return { student_answer: "A", correct_answer: "A" };
  }), CFG); return lesson(r, "MATH_CIRCLES").weak_subskill_clusters.length === 0; })());

// ---------- timing ----------
console.log("[timing adjustments]");
res = E.analyzeIndividual(mkCase(qq => {
  if (qq.lesson_id === "MATH_EQUIV_EXPRESSIONS") return { student_answer: "A", correct_answer: "A", time_seconds: 400 };
  return { student_answer: "A", correct_answer: "A", time_seconds: 70 };
}), CFG);
L = lesson(res, "MATH_EQUIV_EXPRESSIONS");
T("severe pacing (all slow) -> +0.5 h", L.timing_adjustment === 0.5, L.timing_reason);
res = E.analyzeIndividual(mkCase(qq => {
  if (qq.lesson_id === "MATH_EQUIV_EXPRESSIONS" && qq.module === "module_1") return { student_answer: "A", correct_answer: "A", time_seconds: 400 };
  if (qq.lesson_id === "MATH_EQUIV_EXPRESSIONS") return { student_answer: "A", correct_answer: "A", time_seconds: 70 };
  return { student_answer: "A", correct_answer: "A" };
}), CFG);
T("2 correct-but-slow -> +0.25 h", lesson(res, "MATH_EQUIV_EXPRESSIONS").timing_adjustment === 0.25);

// ---------- high target ----------
console.log("[high-target adjustment]");
res = E.analyzeIndividual(mkCase(qq => {
  if (qq.lesson_id === "MATH_NONLINEAR_FUNCTIONS" && qq.module === "module_b" && qq.question_number === 6) return { student_answer: "B", correct_answer: "A", difficulty: "hard" };
  return { student_answer: "A", correct_answer: "A" };
}, { goal: { target_sat_score: 1450 } }), CFG);
L = lesson(res, "MATH_NONLINEAR_FUNCTIONS");
T("1400+ target with hard-question evidence -> +0.25 h with reason", L.high_target_adjustment === 0.25 && !!L.high_target_reason);
T("1400+ not automatic on strong 100% lessons", lesson(res, "MATH_ONE_VAR_DATA").high_target_adjustment === 0 || lesson(res, "MATH_ONE_VAR_DATA").coverage_level !== "strong");
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "A", correct_answer: "A" }), { goal: { target_sat_score: 1200 } }), CFG);
T("below 1400: no high-target adjustment anywhere", res.lesson_analysis.every(l => l.high_target_adjustment === 0));

// ---------- teacher override & duplicate warnings ----------
console.log("[teacher override & double counting]");
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "A", correct_answer: "A" }), {
  student: { student_name: "T", known_foundational_gaps: [], teacher_overrides: [{ lesson_id: "MATH_CIRCLES", additional_hours: 0.5, reason: "hesitant on arc measures in intake interview" }] }
}), CFG);
T("teacher override adds hours with reason", lesson(res, "MATH_CIRCLES").teacher_override_adjustment === 0.5);
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "A", correct_answer: "A" }), {
  student: { student_name: "T", known_foundational_gaps: [], teacher_overrides: [{ lesson_id: "MATH_CIRCLES", additional_hours: 0.5 }] }
}), CFG);
T("override without reason produces a warning", res.warnings.some(w => w.code === "OVERRIDE_NO_REASON"));
res = E.analyzeIndividual(mkCase(qq => {
  if (qq.lesson_id === "ENG_CROSS_TEXT_CONNECTIONS") return { student_answer: "B", correct_answer: "A", guessed: true };
  return { student_answer: "A", correct_answer: "A" };
}, {
  student: { student_name: "T", teacher_overrides: [], known_foundational_gaps: [{ lesson_id: "ENG_CROSS_TEXT_CONNECTIONS", severity: "moderate", evidence: "x" }], teacher_flagged_weak_subskills: [{ lesson_id: "ENG_CROSS_TEXT_CONNECTIONS", subskill_id: "cross_text_comparison" }] }
}), CFG);
T("duplicate-evidence warning fires (small evidence base, stacked adjustments)",
  res.warnings.some(w => w.code === "DUPLICATE_ADJUSTMENT_EVIDENCE" && w.lesson_id === "ENG_CROSS_TEXT_CONNECTIONS"));

// ---------- individual totals & minimum ----------
console.log("[individual course limits]");
// perfect student with strong evidence -> program floor and final-quarter rounding
res = E.analyzeIndividual(mkCase(qq => ({ student_answer: "A", correct_answer: "A" })), CFG);
T("orientation 0.75 + review 1.5 itemized", res.totals.orientation_hours === 0.75 && res.totals.final_review_hours === 1.5);
T("strategy components sum to strategy hours", approx(res.totals.strategy_components.reduce((s, c) => s + c.hours, 0), res.totals.strategy_hours));
T("raw = raw lessons + orientation + review", approx(res.totals.raw_total, res.totals.raw_lesson_hours + res.totals.raw_orientation_hours + res.totals.raw_final_review_hours));
T("unrounded component total = lessons + strategy", approx(res.totals.final_component_total, res.totals.lesson_hours + res.totals.strategy_hours));
T("only final total rounded upward to 0.25", approx(res.totals.constrained_total, E.roundFinalUp(res.totals.final_component_total)));
T("course-limit delta is allocated to explicit components", approx(res.totals.final_component_total-res.totals.raw_component_total, res.totals.constraint_allocation.reduce((sum,a)=>sum+a.adjustment_hours,0)));
T("actual components within 14-35", res.totals.final_component_total >= 14 && res.totals.final_component_total <= 35);
T("perfect student still gets every lesson >= 0.25 h", res.lesson_analysis.every(l=>l.final_hours>=0.25));
T("all validation checks pass", res.validation_checks.failed.length === 0);

// ---------- scaled score validation ----------
console.log("[input validation]");
let bad = mkCase(qq => ({ student_answer: "A", correct_answer: "A" }), { scores: { score_source: "provided", reading_writing_scaled: 500, math_scaled: 500, total_scaled: 1100 } });
res = E.analyzeIndividual(bad, CFG);
T("R&W + Math != Total -> error", res.errors.some(e => e.code === "SCORE_MISMATCH") && !res.ok);
res = E.analyzeIndividual(mkCase(() => null, { diagnostic: { template_id: "nope", answers: [] } }), CFG);
T("invalid template id -> error", res.errors.some(e => e.code === "INVALID_TEMPLATE"));
let dup = mkCase(qq => ({ student_answer: "A", correct_answer: "A" }));
dup.diagnostic.answers.push(Object.assign({}, dup.diagnostic.answers[0]));
res = E.analyzeIndividual(dup, CFG);
T("duplicate question -> error", res.errors.some(e => e.code === "DUPLICATE_QUESTION"));
res = E.analyzeIndividual(mkCase(qq => (qq.section === "english" && qq.question_number === 1 && qq.module === "module_1" ? { student_answer: "A" } : { student_answer: "A", correct_answer: "A" })), CFG);
T("answer without any key -> error", res.errors.some(e => e.code === "MISSING_KEY"));
res = E.analyzeIndividual(mkCase(() => null), CFG);
T("no answers -> warning, all 28 lessons full base hours", res.ok && res.warnings.some(w => w.code === "NO_ANSWERS") && res.lesson_analysis.every(l => l.coverage_level === "not_assessed"));

// ---------- session splitting ----------
console.log("[session splitting]");
T("2.5 -> 1.5+1", JSON.stringify(E.splitSessions(2.5, CFG.calculation_rules)) === "[1.5,1]");
T("3 -> 1.5+1.5", JSON.stringify(E.splitSessions(3, CFG.calculation_rules)) === "[1.5,1.5]");
T("3.5 -> 2+1.5", JSON.stringify(E.splitSessions(3.5, CFG.calculation_rules)) === "[2,1.5]");
T("4 -> 2+2", JSON.stringify(E.splitSessions(4, CFG.calculation_rules)) === "[2,2]");
T("2 stays single", JSON.stringify(E.splitSessions(2, CFG.calculation_rules)) === "[2]");

// ---------- group tests ----------
console.log("[groups]");
function mkGroup(nStudents, profiles) {
  return {
    schema_version: "2.0", group_name: "G", students: Array.from({ length: nStudents }, (_, i) => {
      const p = profiles ? profiles[i % profiles.length] : 0.7;
      return mkCase(qq => ({ student_answer: (hash(qq, i) < p) ? "A" : "B", correct_answer: "A" }), { student: { student_name: "S" + (i + 1), known_foundational_gaps: [], teacher_overrides: [] } });
    })
  };
}
function hash(qq, i) { let s = i * 31 + qq.question_number * 7 + (qq.section === "math" ? 13 : 0) + (qq.module === "module_b" ? 3 : 0); s = (s * 2654435761) % 4294967296; return s / 4294967296; }

let gr = E.analyzeGroup(mkGroup(2, [0.85, 0.8]), CFG);
T("2-student group calculates", gr.ok);
T("2-student size adjustment 5%", gr.totals.size_adjustment === 0.05);
T("2-student program minimum 15", gr.totals.minimum_allowed === 15);
T("group lesson >= max individual need (safeguard)", gr.lesson_analysis.every(l => l.group_hours >= l.max_hours));
T("raw group total = pre-constraint lessons + orientation + review", approx(gr.totals.raw_total, gr.lesson_analysis.reduce((s, l) => s + l.pre_constraint_group_hours, 0) + gr.totals.orientation_hours + gr.totals.final_review_hours));
T("unrounded group component total = final components", approx(gr.totals.final_component_total, gr.lesson_analysis.reduce((s,l)=>s+l.group_hours,0)+gr.totals.orientation_hours+gr.totals.final_review_hours+gr.totals.additional_strategy_hours));
T("similar students -> some lessons with 0% diversity adj", gr.lesson_analysis.some(l => l.diversity_adjustment === 0));

gr = E.analyzeGroup(mkGroup(8, [0.9, 0.75, 0.6, 0.85]), CFG);
T("8-student group: size adj 18%, orientation 1.5, review 2.25", gr.totals.size_adjustment === 0.18 && gr.totals.orientation_hours === 1.5 && gr.totals.final_review_hours === 2.25);
T("8-student program minimum 17", gr.totals.minimum_allowed === 17);

gr = E.analyzeGroup(mkGroup(15, [0.95, 0.4, 0.7, 0.85, 0.3]), CFG);
T("15-student group: size adj 30%, min 19, max 46.5", gr.totals.size_adjustment === 0.30 && gr.totals.minimum_allowed === 19 && gr.totals.maximum_allowed === 46.5);
T("15 students flagged as group class, not personalized tutoring", gr.delivery.large_group && gr.delivery.notes.length >= 1);
T("diverse large group triggers split recommendation", gr.compatibility.split_recommended, JSON.stringify(gr.compatibility.split_reasons));
T("subgroup composition suggested", !!gr.compatibility.subgroup_recommendation);
T("group core maximum is hard-enforced", gr.totals.maximum_infeasible === false && gr.totals.final_component_total <= 46.5 && gr.totals.hard_cap_enforced === true);
T("group final component total equals actual core components", approx(gr.totals.final_component_total, gr.totals.lesson_hours+gr.totals.orientation_hours+gr.totals.final_review_hours+gr.totals.additional_strategy_hours));
T("every diversity classification value is legal", gr.lesson_analysis.every(l => ["very_similar", "slightly_different", "significantly_different", "highly_different"].includes(l.diversity_classification)));
// all four diversity categories exercised across the suites
const seen = new Set();
[E.analyzeGroup(mkGroup(2, [0.85, 0.84]), CFG), E.analyzeGroup(mkGroup(3, [0.95, 0.75, 0.5]), CFG), gr].forEach(r => r.lesson_analysis.forEach(l => seen.add(l.diversity_classification)));
T("all four diversity categories observed", seen.size === 4, [...seen].join(","));
T("group size 1 rejected", !E.analyzeGroup(mkGroup(1), CFG).ok);
T("group size 21 rejected", !E.analyzeGroup({ students: Array(21).fill(mkCase(() => null)) }, CFG).ok);
T("group validation checks pass", gr.validation_checks.failed.length === 0);

// group-size table integrity
const gt = CFG.calculation_rules.group_size_table;
T("group table covers sizes 1-20", gt.length === 20 && gt[0].group_size === 1 && gt[19].group_size === 20);
T("group table uses configured program minimums", gt[0].final_minimum===14 && gt[1].final_minimum===15 && gt[19].final_minimum===20);
T("group maximums rescaled to individual 35-hour policy", gt[0].maximum===35 && gt[1].maximum===37 && gt[19].maximum===48.5);

// ---------- CSV ----------
console.log("[CSV import]");
const csvOk = "student_id,student_name,section,module,question_number,student_answer,correct_answer\nS1,Sam,english,module_1,1,A,A\nS1,Sam,math,module_b,22,B,A\n";
let ci = E.importAnswersCsv(csvOk, "Diagnostic_Exam_2026", CFG);
T("valid CSV imports 2 answers", ci.errors.length === 0 && ci.students.S1.answers.length === 2);
ci = E.importAnswersCsv("student_id,section,module,question_number,student_answer\nS1,english,module_3,1,A\n", "Diagnostic_Exam_2026", CFG);
T("invalid module rejected", ci.errors.some(e => e.code === "INVALID_MODULE"));
ci = E.importAnswersCsv(csvOk + "S1,Sam,english,module_1,1,B,A\n", "Diagnostic_Exam_2026", CFG);
T("duplicate CSV row rejected", ci.errors.some(e => e.code === "DUPLICATE_QUESTION"));
ci = E.importAnswersCsv("student_id,section,module,question_number,student_answer\nS1,english,module_1,99,A\n", "Diagnostic_Exam_2026", CFG);
T("out-of-template question rejected", ci.errors.some(e => e.code === "UNMAPPED_QUESTION"));
ci = E.importAnswersCsv(csvOk, "nope", CFG);
T("unknown template rejected", ci.errors.some(e => e.code === "INVALID_TEMPLATE"));
ci = E.importAnswersCsv("section,module\n", "Diagnostic_Exam_2026", CFG);
T("missing required columns rejected", ci.errors.some(e => e.code === "MISSING_COLUMN"));

// ---------- summary ----------
console.log("\n==== " + pass + " passed, " + fail + " failed ====");
if (fail) { console.log(failures.join("\n")); process.exit(1); }
