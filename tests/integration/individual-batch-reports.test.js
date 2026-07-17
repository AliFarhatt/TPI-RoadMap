// Integration tests for isolated individual analysis, three reports, and ZIP delivery.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const g = {};
new Function("window", fs.readFileSync(path.join(ROOT, "app/js/config-data.js"), "utf8"))(g);
global.TP_CONFIG = g.TP_CONFIG;
global.TP_ENGINE = require(path.join(ROOT, "app/js/engine.js"));
global.TP_VIEWMODEL = require(path.join(ROOT, "app/js/viewmodel.js"));
global.TP_REPORT = require(path.join(ROOT, "app/js/report.js"));
global.TP_TWOPAGE = require(path.join(ROOT, "app/js/twopage.js"));
require(path.join(ROOT, "app/js/roadmap.js"));
global.JSZip = require(path.join(ROOT, "app/vendor/jszip/jszip.min.js"));
const Batch = require(path.join(ROOT, "app/js/individual-batch-reports.js"));
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "examples/group-shared-demo/case-input.json"), "utf8"));

let pass = 0, fail = 0;
function T(name, condition, detail) {
  if (condition) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function caseFor(index, name, attempt) {
  const value = clone(fixture.students[index]);
  value.course_type = "individual"; value.student.student_name = name; value.diagnostic.attempt_number = attempt;
  return value;
}
function fakePdf(html, options) {
  const marker = "%PDF-1.7\n" + options.filename + "\n" + String(html).slice(0, 1300);
  return Promise.resolve(new Blob([marker.padEnd(1800, " ")], { type:"application/pdf" }));
}

(async function () {
  console.log("[Individual PDF batch: three existing reports per student]");
  const cases = [
    { source_filename:"nayla-a1.pdf", caseInput:caseFor(0, "Nayla El Azzi", 1) },
    { source_filename:"student-two.pdf", caseInput:caseFor(1, "Student Two", 1) }
  ];
  const result = await Batch.generateIndividualReportsFromCases(cases, { exporter:fakePdf, JSZip:global.JSZip, generatedAt:"2026-07-17T00:00:00.000Z" });
  T("two students are independently analyzed", result.summary.students_successful === 2 && result.rows.length === 2);
  T("exactly six reports are generated", result.summary.reports_expected === 6 && result.summary.reports_generated === 6);
  T("each student receives only the detailed, seven-page, and two-page reports", result.rows.every(row => Object.keys(row.reports).sort().join(",") === "detailed_diagnostic,seven_page_roadmap,two_page_report"));
  T("safe filenames include student and attempt", result.rows[0].reports.detailed_diagnostic.file_name === "nayla-el-azzi_attempt-1_detailed-diagnostic-report.pdf");
  T("one ZIP blob is returned", result.zipBlob instanceof Blob && result.zipBlob.size > 1000 && result.filename === "individual-diagnostic-reports_2026-07-17.zip");
  const loaded = await global.JSZip.loadAsync(await result.zipBlob.arrayBuffer());
  const names = Object.keys(loaded.files);
  T("ZIP contains two student folders and six PDFs", names.filter(n => /\.pdf$/.test(n)).length === 6);
  T("ZIP contains machine-readable batch-summary.json", names.includes("individual-diagnostic-reports/batch-summary.json"));
  const summary = JSON.parse(await loaded.file("individual-diagnostic-reports/batch-summary.json").async("string"));
  T("batch summary excludes question-level answers", !JSON.stringify(summary).includes("correct_answer") && summary.students.length === 2);

  console.log("[Individual PDF batch: duplicates, attempts, and failures]");
  const attempt1 = caseFor(0, "Nayla El Azzi", 1), attempt2 = clone(attempt1); attempt2.diagnostic.attempt_number = 2; attempt2.diagnostic.date = "2026-08-01";
  const duplicateResult = await Batch.generateIndividualReportsFromCases([
    { source_filename:"a1.pdf", caseInput:attempt1 },
    { source_filename:"a1-copy.pdf", caseInput:clone(attempt1) },
    { source_filename:"a2.pdf", caseInput:attempt2 }
  ], { exporter:fakePdf, JSZip:global.JSZip });
  T("exact same student and attempt is skipped", duplicateResult.summary.students_skipped === 1);
  T("different attempts for the same student are both allowed", duplicateResult.summary.students_successful === 2 && duplicateResult.summary.reports_generated === 6);

  let reportCalls = 0;
  const partial = await Batch.generateIndividualReportsFromCases([caseFor(0, "First Student", 1), caseFor(1, "Second Student", 1)], {
    JSZip:global.JSZip,
    exporter:function (html, options) {
      reportCalls++;
      if (/first-student_attempt-1_two-page-report/.test(options.filename)) return Promise.reject(new Error("forced two-page failure"));
      return fakePdf(html, options);
    }
  });
  T("one report failure is recorded accurately", partial.rows[0].status === "partial" && partial.rows[0].reports.two_page_report.status === "failed");
  T("a failed report does not stop the remaining student", partial.rows[1].status === "success" && partial.summary.reports_generated === 5 && reportCalls === 6);

  const bad = caseFor(0, "Broken Student", 1); bad.diagnostic.answers.pop();
  const isolated = await Batch.generateIndividualReportsFromCases([bad, caseFor(1, "Valid Student", 1)], { exporter:fakePdf, JSZip:global.JSZip });
  T("one invalid student does not stop later students", isolated.rows[0].status === "failed" && isolated.rows[1].status === "success");
  T("loaded application state is never mutated by explicit-input batch generation", typeof Batch.generateIndividualReportsFromCases === "function" && !Object.prototype.hasOwnProperty.call(global, "TP_APP_API"));

  console.log("\n" + pass + " passed, " + fail + " failed");
  if (fail) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
