// Two-page teacher & parent diagnostic report tests. Run: node tests/unit/twopage.test.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const g = {}; new Function("window", fs.readFileSync(path.join(ROOT, "app/js/config-data.js"), "utf8"))(g);
const CFG = g.TP_CONFIG;
const E = require(path.join(ROOT, "app/js/engine.js"));
const T2 = require(path.join(ROOT, "app/js/twopage.js"));

let pass = 0, fail = 0; const failures = [];
function T(name, cond, detail) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}

// ---------- fixture: the 98-question Nayla sample (lowercase + legacy-capitalized difficulties) ----------
const nayla = JSON.parse(fs.readFileSync(path.join(ROOT, "examples/individual-demo/nayla-two-page-sample-input.json")));
const r = E.analyzeIndividual(nayla, CFG);
T("Nayla sample calculates without errors", r.ok, JSON.stringify(r.errors));
const qa = r.question_analysis;

console.log("[difficulty normalization]");
T("lowercase values normalize unchanged", T2.normalizeDifficulty("easy") === "easy" && T2.normalizeDifficulty("medium") === "medium" && T2.normalizeDifficulty("hard") === "hard");
T("legacy capitalization normalizes", T2.normalizeDifficulty("Easy") === "easy" && T2.normalizeDifficulty(" HARD ") === "hard" && T2.normalizeDifficulty("Medium") === "medium");
T("unknown/missing values normalize to null", T2.normalizeDifficulty("") === null && T2.normalizeDifficulty(null) === null && T2.normalizeDifficulty("tricky") === null);

console.log("[category calculations]");
const secs = T2.createSectionPerformanceData(qa);
function manual(recs) {
  const total = recs.length, correct = recs.filter(q => q.correct === true).length,
    answered = recs.filter(q => q.student_answer !== null && q.student_answer !== undefined && q.student_answer !== "").length;
  return { total, correct, answered };
}
const mEng = manual(qa.filter(q => q.section === "english")), mMath = manual(qa.filter(q => q.section === "math"));
T("English counts match manual recount", secs[0].stats.total === mEng.total && secs[0].stats.correct === mEng.correct && secs[0].stats.answered === mEng.answered);
T("Math counts match manual recount", secs[1].stats.total === mMath.total && secs[1].stats.correct === mMath.correct && secs[1].stats.answered === mMath.answered);
T("English accuracy = correct/total", Math.abs(secs[0].stats.accuracy - mEng.correct / mEng.total) < 1e-12);
T("Math accuracy = correct/total", Math.abs(secs[1].stats.accuracy - mMath.correct / mMath.total) < 1e-12);
T("Section totals cover all administered questions", secs[0].stats.total + secs[1].stats.total === qa.length && qa.length === 98);

const mods = T2.createModulePerformanceData(qa);
T("four modules produced in fixed order", mods.length === 4 && mods[0].module === "module_1" && mods[1].module === "module_b" && mods[2].section === "math");
T("module counts sum to section counts", mods[0].stats.total + mods[1].stats.total === secs[0].stats.total && mods[2].stats.total + mods[3].stats.total === secs[1].stats.total);
mods.forEach(m => {
  const mm = manual(qa.filter(q => q.section === m.section && q.module === m.module));
  T("module " + m.label + " correct/total match", m.stats.correct === mm.correct && m.stats.total === mm.total);
});

console.log("[difficulty performance]");
const da = T2.createDifficultyPerformanceData(qa);
T("difficulty data available for the sample", da.available === true);
T("all labelled records counted (legacy capitalization merged, none dropped)", da.labelled_records === 98 && da.levels.reduce((s, l) => s + l.stats.total, 0) === 98);
["easy", "medium", "hard"].forEach((d, i) => {
  const recs = qa.filter(q => String(q.difficulty || "").trim().toLowerCase() === d);
  const mm = manual(recs);
  T(d + " counts match case-insensitive recount", da.levels[i].stats.total === mm.total && da.levels[i].stats.correct === mm.correct);
});
T("title-case and lowercase are NOT separate categories", da.levels.length === 3);

const daNone = T2.createDifficultyPerformanceData(qa.map(q => Object.assign({}, q, { difficulty: null })));
T("no difficulty data -> available=false, no NaN accuracies", daNone.available === false && daNone.levels.every(l => l.stats.accuracy === null && l.stats.total === 0));

console.log("[strengths & priorities]");
const strengths = T2.rankDiagnosticStrengths(r.lesson_analysis, 3);
const priorities = T2.rankDiagnosticPriorities(r.lesson_analysis, 3);
T("three strengths returned", strengths.length === 3);
T("three priorities returned", priorities.length === 3);
T("all ranked areas meet the 2-question minimum sample rule", strengths.concat(priorities).every(l => l.questions_assessed >= 2));
T("strengths sorted by accuracy desc", strengths.every((l, i) => i === 0 || strengths[i - 1].raw_accuracy >= l.raw_accuracy));
T("priorities sorted by accuracy asc", priorities.every((l, i) => i === 0 || priorities[i - 1].raw_accuracy <= l.raw_accuracy));
T("strengths and priorities do not overlap", !strengths.some(s => priorities.some(p => p.lesson_id === s.lesson_id)));
// tie stability: equal accuracy prefers more questions; rerun twice for determinism
const s2 = T2.rankDiagnosticStrengths(r.lesson_analysis, 3);
T("ranking is stable across calls", JSON.stringify(strengths.map(l => l.lesson_id)) === JSON.stringify(s2.map(l => l.lesson_id)));
const tieFixture = [
  { lesson_id: "A", lesson_name: "A", questions_assessed: 2, questions_correct: 2, raw_accuracy: 100, priority: "MEDIUM" },
  { lesson_id: "B", lesson_name: "B", questions_assessed: 5, questions_correct: 5, raw_accuracy: 100, priority: "MEDIUM" },
  { lesson_id: "C", lesson_name: "C", questions_assessed: 1, questions_correct: 1, raw_accuracy: 100, priority: "MEDIUM" }
];
T("equal accuracy prefers more questions; single-question lesson excluded", (() => {
  const s = T2.rankDiagnosticStrengths(tieFixture, 3);
  return s.length === 2 && s[0].lesson_id === "B" && s[1].lesson_id === "A";
})());

console.log("[section x difficulty heat map]");
const mx = T2.createSectionDifficultyMatrix(qa);
T("matrix available with 2 rows x 3 columns", mx.available && mx.rows.length === 2 && mx.columns.join(",") === "Easy,Medium,Hard" && mx.rows.every(r => r.cells.length === 3));
T("matrix cell totals sum to all labelled records", mx.rows.reduce((s, r) => s + r.cells.reduce((t, c) => t + c.stats.total, 0), 0) === 98);
mx.rows.forEach(row => row.cells.forEach(c => {
  const mm = manual(qa.filter(q => q.section === row.section && String(q.difficulty || "").trim().toLowerCase() === c.difficulty));
  T("matrix " + row.section + "/" + c.difficulty + " matches case-insensitive recount", c.stats.total === mm.total && c.stats.correct === mm.correct);
}));
T("matrix column totals equal difficulty-chart totals", ["easy", "medium", "hard"].every((d, i) => mx.rows.reduce((s, r) => s + r.cells[i].stats.total, 0) === da.levels[i].stats.total));
const mxNone = T2.createSectionDifficultyMatrix(qa.map(q => Object.assign({}, q, { difficulty: null })));
T("matrix unavailable without difficulty labels, empty cells NaN-free", mxNone.available === false && mxNone.rows.every(r => r.cells.every(c => c.stats.total === 0 && c.stats.accuracy === null)));

console.log("[report data & filename]");
const data = T2.buildTwoPageDiagnosticData(nayla, r);
T("student name carried through", data.student_name === "Nayla El Azzi");
T("attempt number read from diagnostic.attempt_number", data.attempt_number === 1 && data.attempt_label === "Attempt 1");
T("scores carried through unmodified", data.scores.total === 1270 && data.scores.english === 660 && data.scores.math === 610);
T("filename uses lowercase hyphens + attempt", data.filename === "nayla-el-azzi_attempt-1_two-page-diagnostic-report");
T("filename helper handles missing attempt", T2.buildTwoPageReportFilename("Maya Haddad", null) === "maya-haddad_two-page-diagnostic-report");
T("filename helper handles missing name", T2.buildTwoPageReportFilename("", 2) === "student_attempt-2_two-page-diagnostic-report");
T("summary text generated (2-3 sentences, cautious)", data.summary.length > 40 && !/undefined|NaN|null/.test(data.summary));
T("exactly three recommendations", data.recommendations.length === 3);
T("recommendations avoid course hours/schedules", data.recommendations.every(t => !/\bhour|schedule|session|tuition|homework quantity/i.test(t)));

console.log("[validation]");
T("missing case rejected with the required message", (() => { const v = T2.validateTwoPageCase(null, null); return !v.ok && /Load a valid individual student case/.test(v.message); })());
T("group results rejected with an explanation", (() => { const v = T2.validateTwoPageCase({ course_type: "group" }, { individual_results: [] }); return !v.ok && /individual student case/.test(v.message); })());
T("case without answers rejected", (() => { const v = T2.validateTwoPageCase(nayla, { question_analysis: [] }); return !v.ok; })());
T("valid individual case accepted", T2.validateTwoPageCase(nayla, r).ok === true);

console.log("[rendered HTML]");
const html = T2.renderTwoPageDiagnosticReport(r, nayla);
T("valid document shell", html.startsWith("<!DOCTYPE html>") && html.includes("</html>"));
T("exactly two page containers", (html.match(/class="pg two-page-report-page/g) || []).length === 2 && html.includes("page-1") && html.includes("page-2"));
T("page 1 breaks, page 2 does not add a trailing break", html.includes("page-break-after:always") && html.includes(".pg.page-2{page-break-after:auto"));
T("title equals the download filename", html.includes("<title>nayla-el-azzi_attempt-1_two-page-diagnostic-report</title>"));
T("score cards present", html.includes("TOTAL SAT SCORE") && html.includes("1270") && html.includes("660") && html.includes("610"));
T("section, module and difficulty charts present", html.includes("Section performance") && html.includes("Module performance") && html.includes("Performance by question difficulty") && html.includes("Reading and Writing \u00b7 Module 1"));
T("heat map rendered with grayscale-safe cell text", html.includes("Accuracy heat map") && html.includes('class="heat"') && (html.match(/correct<\/div><\/td>/g) || []).length === 6);
T("strengths, priorities and next steps present", html.includes("Strongest areas") && html.includes("Priority areas") && html.includes("Recommended next steps"));
T("footer identifies student, attempt and page count", html.includes("Nayla El Azzi \u00b7 Attempt 1 \u00b7 Page 2 of 2"));
T("no leaked placeholder values", !/>\s*(undefined|null|NaN|Infinity)\s*</.test(html));
T("no course-roadmap content (hours/schedule) in the report", !/live hours|sessions\/week|homework/i.test(html));

console.log("[missing-data handling]");
const sparse = JSON.parse(JSON.stringify(nayla));
delete sparse.diagnostic.attempt_number;
sparse.diagnostic.date = "";
sparse.scores = { score_source: "provided" };
sparse.diagnostic.answers.forEach(a => { delete a.difficulty; });
const r2 = E.analyzeIndividual(sparse, CFG);
T("sparse case still calculates", r2.ok, JSON.stringify(r2.errors));
r2.student = Object.assign({}, r2.student, { student_name: "" }); // simulate a missing name in the result payload
const html2 = T2.renderTwoPageDiagnosticReport(r2, sparse);
T("missing scores -> 'Not provided'", (html2.match(/Not provided/g) || []).length >= 3);
T("missing attempt -> 'Attempt not provided'", html2.includes("Attempt not provided"));
T("missing date -> 'Date not provided'", html2.includes("Date not provided"));
T("missing name -> 'Student' fallback", html2.includes('<div class="name">Student</div>'));
T("no difficulty -> unavailable message instead of empty chart", html2.includes("Difficulty-level performance is unavailable for this diagnostic."));
T("no difficulty -> heat map omitted entirely", !html2.includes("Accuracy heat map"));
T("sparse render leaks no placeholders", !/>\s*(undefined|null|NaN|Infinity)\s*</.test(html2));
T("sparse render still has exactly two pages", (html2.match(/class="pg two-page-report-page/g) || []).length === 2);

console.log("\n==== " + pass + " passed, " + fail + " failed ====");
if (fail) { console.log(failures.join("\n")); process.exit(1); }
