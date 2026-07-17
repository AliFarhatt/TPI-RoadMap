// Deterministic unit checks for the fully local Elmy diagnostic PDF importer.
// Run: node tests/unit/elmy-importer.test.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const g = {};
new Function("window", fs.readFileSync(path.join(ROOT, "app/js/config-data.js"), "utf8"))(g);
const CFG = g.TP_CONFIG;
const I = require(path.join(ROOT, "app/js/elmy-importer.js"));

let pass = 0, fail = 0;
function T(name, condition, detail) {
  if (condition) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}
function eq(name, actual, expected) {
  T(name, JSON.stringify(actual) === JSON.stringify(expected), "expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
}

console.log("[Elmy importer: public contract]");
eq("template identifier is stable", I.TEMPLATE_ID, "Diagnostic_Exam_2026");
T("importer exposes the browser and Node entry points", typeof I.importPdf === "function" && typeof I.parseExtractedDocument === "function");
T("generated browser config embeds the difficulty map", !!CFG.diagnostic_difficulty_maps[I.TEMPLATE_ID]);
T("one isolated parser is registered for future extension", I.parsers.length === 1 && I.parsers[0].template_id === I.TEMPLATE_ID);

console.log("[Elmy importer: synthetic metadata geometry]");
function item(str, x, y) { return { str, x, y, width: Math.max(8, str.length * 5), height: 10 }; }
function metadataPage(title) {
  const items = [
    item("Powered by Elmy", 40, 820), item("Assessment Report", 40, 800),
    item("Attempt #1 for Diagnostic Exam 2026", 40, 770),
    item("Class", 40, 735), item("SAT Diagnostic Test - Summer 2026", 210, 735),
    item("Assessment", 40, 710), item(title || "Diagnostic Exam 2026", 210, 710),
    item("Student", 40, 685), item("Importer Test Student", 210, 685),
    item("Date", 40, 660), item("Jul 15, 2026 9:51 PM", 210, 660),
    item("Total Score", 40, 570), item("1270", 240, 540),
    item("Answered Questions", 40, 500), item("Correct Answers", 230, 500),
    item("79", 60, 465), item("71", 250, 465), item("98", 400, 465),
    item("Module Scores", 40, 410), item("660", 100, 370), item("610", 310, 370),
    item("English", 40, 180), item("52", 310, 180), item("41", 390, 180), item("52", 470, 180),
    item("Math", 40, 150), item("41", 310, 150), item("30", 390, 150), item("41", 470, 150)
  ];
  return { pageNumber: 1, width: 595, height: 842, items, lines: I._test.groupLines(items, 3, 1, 595) };
}
const parsedMetadata = I.parseElmyMetadata(metadataPage());
eq("student, attempt, title, season, and date parse from labels", {
  student: parsedMetadata.studentName,
  attempt: parsedMetadata.attemptNumber,
  title: parsedMetadata.assessmentTitle,
  season: parsedMetadata.season,
  date: parsedMetadata.date
}, { student: "Importer Test Student", attempt: 1, title: "Diagnostic Exam 2026", season: "Summer 2026", date: "2026-07-15" });
eq("displayed scores and report totals parse independently", {
  rw: parsedMetadata.readingWritingScaled,
  math: parsedMetadata.mathScaled,
  total: parsedMetadata.totalScaled,
  answered: parsedMetadata.answeredQuestions,
  correct: parsedMetadata.correctAnswers
}, { rw: 660, math: 610, total: 1270, answered: 79, correct: 71 });
eq("inconsistent page-one section rows remain available for warning comparison", parsedMetadata.pageBreakdown, {
  english: { answered: 52, correct: 41, total: 52 }, math: { answered: 41, correct: 30, total: 41 }
});
let wrongAssessment = null;
try { I.parseExtractedDocument([metadataPage("Different Assessment")], CFG); } catch (error) { wrongAssessment = error; }
T("wrong assessment fails before any case is built", wrongAssessment && wrongAssessment.code === "WRONG_ASSESSMENT");

console.log("[Elmy importer: answer normalization]");
eq("em dash is an omitted answer", I.normalizeAnswer("—"), null);
eq("en dash is an omitted answer", I.normalizeAnswer("–"), null);
eq("empty text is an omitted answer", I.normalizeAnswer("  "), null);
eq("outer math delimiters are removed", I.normalizeAnswer("$f(s)=14s^2$"), "f(s)=14s^2");
eq("inner LaTeX remains intact", I.normalizeAnswer("$a=\\left[\\frac{1}{2}(b+1)\\right]^2$"), "a=\\left[\\frac{1}{2}(b+1)\\right]^2");
eq("credited decimal answer remains text", I.normalizeAnswer("5.0"), "5.0");
eq("multi-line Math cell joins without corrupting LaTeX", I._test.joinCellItems([
  item("$a=\\left[\\frac{1}{2}", 200, 40), item("\\left(\\frac{b^2}{c}-1\\right)\\right]^2$", 200, 29)
]), "$a=\\left[\\frac{1}{2}\\left(\\frac{b^2}{c}-1\\right)\\right]^2$");

console.log("[Elmy importer: global numbering]");
eq("global 1 starts English Module 1", I.globalToLocalQuestion(1), { section: "english", module: "module_1", question_number: 1 });
eq("global 27 ends English Module 1", I.globalToLocalQuestion(27), { section: "english", module: "module_1", question_number: 27 });
eq("global 28 starts English Module B", I.globalToLocalQuestion(28), { section: "english", module: "module_b", question_number: 1 });
eq("global 54 ends English Module B", I.globalToLocalQuestion(54), { section: "english", module: "module_b", question_number: 27 });
eq("global 55 starts Math Module 1", I.globalToLocalQuestion(55), { section: "math", module: "module_1", question_number: 1 });
eq("global 76 ends Math Module 1", I.globalToLocalQuestion(76), { section: "math", module: "module_1", question_number: 22 });
eq("global 77 starts Math Module B", I.globalToLocalQuestion(77), { section: "math", module: "module_b", question_number: 1 });
eq("global 98 ends Math Module B", I.globalToLocalQuestion(98), { section: "math", module: "module_b", question_number: 22 });

console.log("[Elmy importer: difficulty and case validation]");
const rows = Array.from({ length: 98 }, (_, i) => ({
  globalNumber: i + 1,
  studentAnswer: i < 79 ? "A" : null,
  correctAnswer: "A",
  earnedPoint: i < 71 ? 1 : 0
}));
const records = I.applyDiagnosticDifficultyMap(rows, CFG);
eq("difficulty checksum is exactly 22/35/41", I._test.difficultyCounts(records), { easy: 22, medium: 35, hard: 41 });
eq("answer distribution is exactly 27/27/22/22", {
  e1: records.filter(r => r.section === "english" && r.module === "module_1").length,
  eb: records.filter(r => r.section === "english" && r.module === "module_b").length,
  m1: records.filter(r => r.section === "math" && r.module === "module_1").length,
  mb: records.filter(r => r.section === "math" && r.module === "module_b").length
}, { e1: 27, eb: 27, m1: 22, mb: 22 });

const metadata = {
  studentName: "Importer Test Student",
  season: "Summer 2026",
  date: "2026-07-15",
  attemptNumber: 1,
  assessmentTitle: "Diagnostic Exam 2026",
  answeredQuestions: 79,
  correctAnswers: 71,
  readingWritingScaled: 660,
  mathScaled: 610,
  totalScaled: 1270
};
const generated = I.buildIndividualCase(metadata, records, []);
const validation = I.validateImportedElmyCase(generated, CFG);
T("generated 98-question case validates", validation.ok, validation.errors.join(" "));
eq("validation reproduces reported totals", {
  records: validation.summary.answer_records,
  answered: validation.summary.answered_questions,
  correct: validation.summary.correct_answers
}, { records: 98, answered: 79, correct: 71 });
T("correct Boolean is independent from answer text", generated.diagnostic.answers[71].student_answer === "A" && generated.diagnostic.answers[71].correct === false);

const duplicate = JSON.parse(JSON.stringify(generated));
duplicate.diagnostic.answers[1] = JSON.parse(JSON.stringify(duplicate.diagnostic.answers[0]));
const rejected = I.validateImportedElmyCase(duplicate, CFG);
T("duplicate location is rejected", !rejected.ok && rejected.errors.some(e => /Duplicate question/.test(e)));

const missing = JSON.parse(JSON.stringify(generated));
missing.diagnostic.answers.pop();
T("missing question is rejected", !I.validateImportedElmyCase(missing, CFG).ok);
const badDifficulty = JSON.parse(JSON.stringify(generated));
badDifficulty.diagnostic.answers[0].difficulty = "Easy";
T("non-lowercase difficulty is rejected", !I.validateImportedElmyCase(badDifficulty, CFG).ok);
const scoreMismatch = JSON.parse(JSON.stringify(generated));
scoreMismatch.scores.total_scaled = 1280;
T("score-sum mismatch is a warning, not a source-data rewrite", I.validateImportedElmyCase(scoreMismatch, CFG).warnings.some(w => /do not sum/.test(w)) && scoreMismatch.scores.total_scaled === 1280);

console.log("[Elmy importer: safe PDF failures]");
(async function () {
  let imageOnly = null;
  try {
    await I.extractPdfPages({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 595, height: 842 }),
        getTextContent: async () => ({ items: [] })
      })
    });
  } catch (error) { imageOnly = error; }
  T("image-only PDF is rejected without OCR", imageOnly && imageOnly.code === "NO_TEXT_LAYER");

  let password = null;
  try {
    await I.loadPdfDocument(new Uint8Array([37, 80, 68, 70]).buffer, {
      getDocument: () => ({ promise: Promise.reject(new Error("Password required")) })
    });
  } catch (error) { password = error; }
  T("password-protected PDF gets a safe error", password && password.code === "PASSWORD_PROTECTED");

  let oversized = null;
  try {
    await I.loadPdfDocument(new ArrayBuffer(26 * 1024 * 1024), { getDocument: () => { throw new Error("should not run"); } });
  } catch (error) { oversized = error; }
  T("PDF size limit is enforced before parsing", oversized && oversized.code === "FILE_TOO_LARGE");

  console.log("\n==== " + pass + " passed, " + fail + " failed ====");
  if (fail) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
