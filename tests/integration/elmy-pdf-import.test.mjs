// Genuine-PDF end-to-end import test. The private diagnostic PDF is intentionally
// not shipped in the package. Supply it at run time:
// ELMY_PDF_FIXTURE=/path/report.pdf PDFJS_DIST_MODULE=/path/pdf.mjs \
//   node tests/integration/elmy-pdf-import.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixture = process.env.ELMY_PDF_FIXTURE;
if (!fixture) {
  console.log("SKIP: set ELMY_PDF_FIXTURE to run the genuine Elmy PDF integration test.");
  process.exit(0);
}
if (!fs.existsSync(fixture)) throw new Error("ELMY_PDF_FIXTURE does not exist: " + fixture);

const moduleLocation = process.env.PDFJS_DIST_MODULE || "pdfjs-dist/legacy/build/pdf.mjs";
const pdfjs = await import(path.isAbsolute(moduleLocation) ? pathToFileURL(moduleLocation).href : moduleLocation);
const browserGlobal = {};
new Function("window", fs.readFileSync(path.join(ROOT, "app/js/config-data.js"), "utf8"))(browserGlobal);
const CFG = browserGlobal.TP_CONFIG;
const I = require(path.join(ROOT, "app/js/elmy-importer.js"));
const E = require(path.join(ROOT, "app/js/engine.js"));
const VM = require(path.join(ROOT, "app/js/viewmodel.js"));
global.window = browserGlobal;
const RM = require(path.join(ROOT, "app/js/roadmap.js"));
const RP = require(path.join(ROOT, "app/js/report.js"));
const T2 = require(path.join(ROOT, "app/js/twopage.js"));

let pass = 0, fail = 0;
function T(name, condition, detail = "") {
  if (condition) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}
function countBy(values, key) {
  return values.reduce((out, value) => { const k = value[key]; out[k] = (out[k] || 0) + 1; return out; }, {});
}

console.log("[genuine Elmy PDF import]");
const raw = fs.readFileSync(fixture);
const exactBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const progress = [];
const imported = await I.importPdf(exactBuffer, CFG, { pdfjs, onProgress: p => progress.push(p) });
const input = imported.caseInput;

T("all PDF pages are processed", progress.length === 46 && progress.at(-1)?.percent === 100, JSON.stringify(progress.at(-1)));
T("student and attempt metadata are extracted", input.student.student_name === "Nayla El Azzi" && input.diagnostic.attempt_number === 1);
T("assessment and date metadata are extracted", input.diagnostic.assessment_title === "Diagnostic Exam 2026" && input.diagnostic.date === "2026-07-15");
T("scaled scores are extracted", input.scores.reading_writing_scaled === 660 && input.scores.math_scaled === 610 && input.scores.total_scaled === 1270);
T("98 answer records validate", imported.validation.ok && input.diagnostic.answers.length === 98, imported.validation.errors.join(" "));
T("reported totals are independently reproduced", imported.validation.summary.answered_questions === 79 && imported.validation.summary.correct_answers === 71);
T("module distribution is exact", JSON.stringify(imported.validation.summary.distribution) === JSON.stringify({ english: { module_1: 27, module_b: 27 }, math: { module_1: 22, module_b: 22 } }));
T("difficulty checksum is exact", JSON.stringify(countBy(input.diagnostic.answers, "difficulty")) === JSON.stringify({ easy: 22, medium: 35, hard: 41 }));
T("omitted answers remain null", input.diagnostic.answers.filter(a => a.student_answer === null).length === 19);
T("awarded points become explicit correctness", input.diagnostic.answers.filter(a => a.correct === true).length === 71);
T("credited equivalent Math text is preserved", input.diagnostic.answers[56].student_answer === "5.0" && input.diagnostic.answers[56].correct_answer === "5" && input.diagnostic.answers[56].correct === true);
T("multi-line Math expression is not corrupted", input.diagnostic.answers[74].correct_answer === "a=\\left[\\frac{1}{2}\\left(\\frac{b^2}{c}-1\\right)\\right]^2", input.diagnostic.answers[74].correct_answer);

console.log("[downstream analysis and reports]");
const result = E.analyzeIndividual(input, CFG);
T("engine accepts imported case", result.ok, JSON.stringify(result.errors));
T("engine analyzes all 98 questions", result.question_analysis.length === 98, result.question_analysis.length);
const viewModel = VM.buildRoadmapViewModel(input, result, CFG, { asset_base: "../../app/" });
const roadmap = RM.render(viewModel);
const detailed = RP.renderIndividualReport(result, input);
const twoPage = T2.renderTwoPageDiagnosticReport(result, input);
T("roadmap renders", roadmap.startsWith("<!DOCTYPE html>") && roadmap.includes("</html>") && !roadmap.includes("undefined</"));
T("detailed report renders", detailed.startsWith("<!DOCTYPE html>") && detailed.includes("</html>") && !detailed.includes("undefined</"));
T("two-page report renders exactly two report pages", (twoPage.match(/class=\"pg two-page-report-page/g) || []).length === 2);

const roundTrip = JSON.parse(JSON.stringify(input));
T("generated JSON round-trip remains analyzable", E.analyzeIndividual(roundTrip, CFG).ok);
if (process.env.ELMY_WRITE_EXAMPLE === "1") {
  const output = path.join(ROOT, "examples/individual-demo/nayla-elmy-imported-case.json");
  fs.writeFileSync(output, JSON.stringify(input, null, 2) + "\n");
  console.log("  wrote " + path.relative(ROOT, output));
}

console.log("\n==== " + pass + " passed, " + fail + " failed ====");
if (fail) process.exit(1);
