// Unit tests for group identity, compatibility, and attempt-aware replacement.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const B = require(path.join(ROOT, "app/js/batch-utils.js"));
const G = require(path.join(ROOT, "app/js/group-pdf-import.js"));
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "examples/group-shared-demo/case-input.json"), "utf8"));

let pass = 0, fail = 0;
function T(name, condition, detail) {
  if (condition) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function student(index, name, attempt, date) {
  const value = clone(fixture.students[index]);
  value.course_type = "individual";
  value.student.student_name = name;
  value.diagnostic.attempt_number = attempt;
  value.diagnostic.date = date || "2026-07-15";
  return value;
}

console.log("[Group PDF batch: normalized identity]");
T("capitalization, spaces, hyphens, punctuation, and accents normalize consistently",
  B.normalizeStudentIdentity("  Náyla  El-Azzi! ") === B.normalizeStudentIdentity("nayla el azzi"));
T("Arabic letters remain usable in identity keys", B.normalizeStudentIdentity("  ليلى - خوري ") === "ليلى خوري");
T("empty names remain empty and reject safely", !B.normalizeStudentIdentity(" -- "));

console.log("[Group PDF batch: strict diagnostic compatibility]");
const a1 = student(0, "Nayla El Azzi", 1);
T("a valid 98-question Diagnostic Exam 2026 student is accepted", B.validateStrictImportedCase(a1).ok);
const wrongTemplate = clone(a1); wrongTemplate.diagnostic.template_id = "Other_Test";
T("a different template is rejected", !B.validateStrictImportedCase(wrongTemplate).ok);
const wrongDistribution = clone(a1); wrongDistribution.diagnostic.answers.pop();
T("a different question distribution is rejected", !B.validateStrictImportedCase(wrongDistribution).ok);
const anonymous = clone(a1); anonymous.student.student_name = "";
T("an anonymous record is rejected", !B.validateStrictImportedCase(anonymous).ok);

console.log("[Group PDF batch: duplicate and attempt resolution]");
let decision = B.decideGroupImport(clone(a1), [a1]);
T("same student and same equivalent attempt is skipped", decision.action === "skip_duplicate" && decision.status === "Duplicate skipped");
const nameVariant = clone(a1); nameVariant.student.student_name = "nayla  el-azzi";
decision = B.decideGroupImport(nameVariant, [a1]);
T("normalized name variants do not create another member", decision.action === "skip_duplicate");
const a2 = clone(a1); a2.diagnostic.attempt_number = 2; a2.diagnostic.date = "2026-08-01";
a1.student.teacher_overrides = [{ lesson_id:"MATH_LINEAR_EQUATIONS", hours:2 }];
decision = B.decideGroupImport(a2, [a1]);
T("newer attempt atomically replaces the older attempt", decision.action === "replace" && decision.index === 0 && decision.student.diagnostic.attempt_number === 2);
T("teacher-entered overrides survive diagnostic replacement", decision.student.student.teacher_overrides.length === 1);
decision = B.decideGroupImport(a1, [a2]);
T("older attempt is skipped when a newer attempt exists", decision.action === "skip_older");
const conflict = clone(a2); conflict.diagnostic.answers[0].correct = !conflict.diagnostic.answers[0].correct;
decision = B.decideGroupImport(conflict, [a2]);
T("same-attempt conflicting content is not overwritten", decision.action === "reject_conflict");

console.log("[Group PDF batch: missing-attempt date fallback]");
const noAttemptOld = clone(a1); delete noAttemptOld.diagnostic.attempt_number; noAttemptOld.diagnostic.date = "2026-06-01";
const noAttemptNew = clone(a1); delete noAttemptNew.diagnostic.attempt_number; noAttemptNew.diagnostic.date = "2026-07-01";
T("a clearly newer diagnostic date replaces when attempts are unavailable", B.resolveAttemptConflict(noAttemptOld, noAttemptNew).action === "replace");
delete noAttemptNew.diagnostic.date;
T("undeterminable recency requires manual review", B.resolveAttemptConflict(noAttemptOld, noAttemptNew).action === "reject_conflict");

console.log("[Group PDF batch: per-file isolation and atomicity]");
const baseGroup = { schema_version:"2.0", course_type:"group", group_name:"Batch Demo", group_id:"batch-demo", students:[clone(a1)] };
const before = JSON.stringify(baseGroup);
const rejected = B.applyImportedCase(baseGroup, wrongTemplate);
T("rejected replacement leaves the original group byte-equivalent", JSON.stringify(baseGroup) === before && rejected.group.students[0].diagnostic.attempt_number === 1);
const addedStudent = student(1, "Student C", 1);
const batch = G.processCasesAgainstGroup(baseGroup, [
  { filename:"student-c.pdf", caseInput:addedStudent },
  { filename:"nayla-attempt-2.pdf", caseInput:a2 },
  { filename:"nayla-attempt-2-copy.pdf", caseInput:clone(a2) },
  { filename:"wrong-template.pdf", caseInput:wrongTemplate }
]);
T("successful files survive later failures", batch.group.students.length === 2 && batch.group.students.some(s => s.student.student_name === "Student C"));
T("replacement contributes only the newer active attempt", batch.group.students.filter(s => B.normalizeStudentIdentity(s.student.student_name) === "nayla el azzi").length === 1 && batch.group.students[0].diagnostic.attempt_number === 2);
T("batch counts added, replaced, duplicate, and incompatible outcomes", batch.counts.students_added === 1 && batch.counts.students_replaced === 1 && batch.counts.duplicates_skipped === 1 && batch.counts.incompatible_diagnostics === 1);
T("roster changes mark analysis stale without running analysis", batch.analysis_stale === true && batch.group.results == null);

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
