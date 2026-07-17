/* Shared helpers for local multi-PDF group import and individual report batches. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TP_BATCH_UTILS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var EXPECTED = { total:98, english:{ module_1:27, module_b:27 }, math:{ module_1:22, module_b:22 } };

  function deep(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function safeText(value, fallback) { var s = value == null ? "" : String(value).trim(); return s || (fallback || ""); }
  function normalizeStudentIdentity(name) {
    var value = safeText(name).toLowerCase();
    if (typeof value.normalize === "function") value = value.normalize("NFKD");
    return value.replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function sanitizeSlug(value, fallback) {
    var normalized = normalizeStudentIdentity(value).replace(/\s+/g, "-");
    return normalized || fallback || "student";
  }
  function validAttempt(value) {
    var n = typeof value === "number" ? value : Number(String(value == null ? "" : value).trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  function validDate(value) {
    var s = safeText(value), ms = s ? Date.parse(s) : NaN;
    return Number.isFinite(ms) ? ms : null;
  }
  function answerShape(caseInput) {
    var answers = caseInput && caseInput.diagnostic && Array.isArray(caseInput.diagnostic.answers) ? caseInput.diagnostic.answers : [];
    var counts = { english:{ module_1:0, module_b:0 }, math:{ module_1:0, module_b:0 } }, seen = {}, duplicates = 0, invalid = 0;
    answers.forEach(function (record) {
      var section = record && record.section, module = record && record.module, number = record && record.question_number;
      var key = section + "|" + module + "|" + number;
      if (seen[key]) duplicates++; else seen[key] = true;
      if (!counts[section] || counts[section][module] == null || !Number.isInteger(Number(number)) || Number(number) < 1) invalid++;
      else counts[section][module]++;
    });
    return { total:answers.length, counts:counts, duplicates:duplicates, invalid:invalid };
  }
  function shapeKey(caseInput) {
    var shape = answerShape(caseInput), d = caseInput && caseInput.diagnostic || {};
    return [safeText(d.template_id), shape.total, shape.counts.english.module_1, shape.counts.english.module_b, shape.counts.math.module_1, shape.counts.math.module_b].join("|");
  }
  function expectedShape(shape) {
    return shape.total === EXPECTED.total && !shape.duplicates && !shape.invalid &&
      shape.counts.english.module_1 === EXPECTED.english.module_1 && shape.counts.english.module_b === EXPECTED.english.module_b &&
      shape.counts.math.module_1 === EXPECTED.math.module_1 && shape.counts.math.module_b === EXPECTED.math.module_b;
  }
  function compactAnswer(record) {
    return [safeText(record.section), safeText(record.module), Number(record.question_number) || 0,
      record.student_answer == null ? null : String(record.student_answer), record.correct_answer == null ? null : String(record.correct_answer),
      record.correct === true, safeText(record.difficulty).toLowerCase()];
  }
  function contentSignature(caseInput) {
    var diagnostic = caseInput && caseInput.diagnostic || {}, scores = caseInput && caseInput.scores || {};
    var answers = Array.isArray(diagnostic.answers) ? diagnostic.answers.slice().sort(function (a, b) {
      var ak = safeText(a.section) + "|" + safeText(a.module) + "|" + String(a.question_number).padStart(3, "0");
      var bk = safeText(b.section) + "|" + safeText(b.module) + "|" + String(b.question_number).padStart(3, "0");
      return ak.localeCompare(bk);
    }).map(compactAnswer) : [];
    return JSON.stringify({
      identity:normalizeStudentIdentity(caseInput && caseInput.student && caseInput.student.student_name),
      template:safeText(diagnostic.template_id), date:safeText(diagnostic.date), attempt:validAttempt(diagnostic.attempt_number),
      scores:[scores.total_scaled == null ? null : Number(scores.total_scaled), scores.reading_writing_scaled == null ? null : Number(scores.reading_writing_scaled), scores.math_scaled == null ? null : Number(scores.math_scaled)],
      answers:answers
    });
  }
  function casesEquivalent(a, b) { return contentSignature(a) === contentSignature(b); }

  function mergeTeacherData(existing, imported) {
    var next = deep(imported), oldStudent = existing && existing.student || {}, student = next.student || (next.student = {});
    ["student_id", "grade_level", "school_curriculum", "previous_sat_results"].forEach(function (key) {
      if ((student[key] == null || student[key] === "") && oldStudent[key] != null && oldStudent[key] !== "") student[key] = deep(oldStudent[key]);
    });
    ["known_foundational_gaps", "teacher_overrides", "teacher_flagged_weak_subskills"].forEach(function (key) {
      if (Array.isArray(oldStudent[key]) && oldStudent[key].length) student[key] = deep(oldStudent[key]);
    });
    if (existing && existing.goal) next.goal = deep(existing.goal);
    if (existing && existing.availability) next.availability = deep(existing.availability);
    return next;
  }

  function resolveAttemptConflict(existing, imported) {
    var oldDiagnostic = existing && existing.diagnostic || {}, newDiagnostic = imported && imported.diagnostic || {};
    var oldAttempt = validAttempt(oldDiagnostic.attempt_number), newAttempt = validAttempt(newDiagnostic.attempt_number);
    if (oldAttempt != null && newAttempt != null) {
      if (newAttempt > oldAttempt) return { action:"replace", status:"Replaced older attempt", reason:"Imported Attempt " + newAttempt + " is newer than Attempt " + oldAttempt + "." };
      if (newAttempt < oldAttempt) return { action:"skip_older", status:"Older attempt skipped", reason:"Skipped because a newer attempt is already in the group." };
      if (casesEquivalent(existing, imported)) return { action:"skip_duplicate", status:"Duplicate skipped", reason:"The same student and attempt are already in the group." };
      return { action:"reject_conflict", status:"Validation failed", reason:"The same attempt number contains different diagnostic data. Manual review is required." };
    }
    var oldDate = validDate(oldDiagnostic.date), newDate = validDate(newDiagnostic.date);
    if (oldDate != null && newDate != null) {
      if (newDate > oldDate) return { action:"replace", status:"Replaced older attempt", reason:"Attempt numbers were unavailable; the imported diagnostic date is newer." };
      if (newDate < oldDate) return { action:"skip_older", status:"Older attempt skipped", reason:"Attempt numbers were unavailable; a newer diagnostic date is already in the group." };
      if (casesEquivalent(existing, imported)) return { action:"skip_duplicate", status:"Duplicate skipped", reason:"The same dated diagnostic is already in the group." };
    }
    return { action:"reject_conflict", status:"Validation failed", reason:"Student identity matches an existing record, but attempt recency cannot be determined safely. Manual review is required." };
  }

  function validateStrictImportedCase(caseInput) {
    var reasons = [], identity = normalizeStudentIdentity(caseInput && caseInput.student && caseInput.student.student_name);
    var d = caseInput && caseInput.diagnostic || {}, shape = answerShape(caseInput);
    if (!caseInput || (caseInput.course_type !== "individual" && caseInput.course_type !== "group_member")) reasons.push("The imported data is not a supported student case.");
    if (!identity) reasons.push("A reliable student name could not be extracted.");
    if (d.template_id !== "Diagnostic_Exam_2026") reasons.push("Only the Diagnostic Exam 2026 template is supported for this importer.");
    if (!expectedShape(shape)) reasons.push("The diagnostic must contain 98 unique questions distributed 27/27/22/22 across the four modules.");
    return { ok:reasons.length === 0, reasons:reasons, identity:identity, shape:shape };
  }

  function validateGroupCompatibility(imported, existingStudents, options) {
    options = options || {};
    if (imported && imported.diagnostic && imported.diagnostic.template_id && imported.diagnostic.template_id !== "Diagnostic_Exam_2026") {
      return { ok:false, status:"Incompatible diagnostic", reason:"This student was not added because the diagnostic template does not match the current group." };
    }
    var strict = validateStrictImportedCase(imported);
    if (!strict.ok) return { ok:false, status:"Validation failed", reason:strict.reasons.join(" ") };
    var validExisting = (existingStudents || []).filter(function (student) {
      if (!normalizeStudentIdentity(student && student.student && student.student.student_name)) return false;
      if (typeof options.isValidStudent === "function" && !options.isValidStudent(student)) return false;
      return validateStrictImportedCase(student).ok;
    });
    if (!validExisting.length) return { ok:true, reference:null };
    var reference = validExisting[0], importedKey = shapeKey(imported), referenceKey = shapeKey(reference);
    if (importedKey !== referenceKey) return { ok:false, status:"Incompatible diagnostic", reason:"This student was not added because the diagnostic template or question distribution does not match the current group." };
    var importedDifficulty = imported.source_validation && imported.source_validation.difficulty_source;
    var referenceDifficulty = reference.source_validation && reference.source_validation.difficulty_source;
    if (importedDifficulty && referenceDifficulty && importedDifficulty !== referenceDifficulty) return { ok:false, status:"Incompatible diagnostic", reason:"The diagnostic difficulty-map basis does not match the current group." };
    return { ok:true, reference:reference };
  }

  function decideGroupImport(imported, existingStudents, options) {
    options = options || {};
    var compatibility = validateGroupCompatibility(imported, existingStudents, options);
    if (!compatibility.ok) return { action:"reject", status:compatibility.status, reason:compatibility.reason, index:-1 };
    var identity = normalizeStudentIdentity(imported && imported.student && imported.student.student_name);
    var matches = [];
    (existingStudents || []).forEach(function (student, index) {
      if (normalizeStudentIdentity(student && student.student && student.student.student_name) === identity) matches.push({ student:student, index:index });
    });
    if (matches.length > 1) return { action:"reject", status:"Validation failed", reason:"More than one existing group record has this normalized student name. Resolve the roster duplicates manually.", index:-1 };
    if (!matches.length) return { action:"add", status:"Added", reason:"Student added to the current group.", index:-1, student:deep(imported) };
    var conflict = resolveAttemptConflict(matches[0].student, imported);
    if (conflict.action === "replace") conflict.student = mergeTeacherData(matches[0].student, imported);
    conflict.index = matches[0].index;
    return conflict;
  }

  function applyImportedCase(groupInput, imported, options) {
    var next = deep(groupInput || { schema_version:"2.0", course_type:"group", group_name:"", group_id:null, students:[] });
    if (!Array.isArray(next.students)) next.students = [];
    var decision = decideGroupImport(imported, next.students, options);
    if (decision.action === "add") next.students.push(deep(imported));
    else if (decision.action === "replace") next.students[decision.index] = deep(decision.student);
    return { group:next, decision:decision, stale:decision.action === "add" || decision.action === "replace" };
  }

  function caseSummary(caseInput) {
    var d = caseInput && caseInput.diagnostic || {}, s = caseInput && caseInput.scores || {}, answers = Array.isArray(d.answers) ? d.answers : [];
    return {
      student_name:safeText(caseInput && caseInput.student && caseInput.student.student_name, "Name unavailable"),
      attempt_number:validAttempt(d.attempt_number), diagnostic_date:safeText(d.date) || null,
      total_score:s.total_scaled == null ? null : Number(s.total_scaled),
      answered_questions:answers.filter(function (a) { return a.student_answer != null && String(a.student_answer).trim() !== ""; }).length,
      correct_questions:answers.filter(function (a) { return a.correct === true; }).length
    };
  }

  function groupBatchCounts(results) {
    var counts = { files_selected:(results || []).length, students_added:0, students_replaced:0, duplicates_skipped:0, older_attempts_skipped:0, invalid_files:0, incompatible_diagnostics:0 };
    (results || []).forEach(function (row) {
      if (row.status === "Added") counts.students_added++;
      else if (row.status === "Replaced older attempt") counts.students_replaced++;
      else if (row.status === "Duplicate skipped") counts.duplicates_skipped++;
      else if (row.status === "Older attempt skipped") counts.older_attempts_skipped++;
      else if (row.status === "Incompatible diagnostic") counts.incompatible_diagnostics++;
      else counts.invalid_files++;
    });
    return counts;
  }

  return {
    EXPECTED:EXPECTED, deep:deep, safeText:safeText, normalizeStudentIdentity:normalizeStudentIdentity, sanitizeSlug:sanitizeSlug,
    validAttempt:validAttempt, validDate:validDate, answerShape:answerShape, shapeKey:shapeKey, expectedShape:expectedShape,
    contentSignature:contentSignature, casesEquivalent:casesEquivalent, mergeTeacherData:mergeTeacherData,
    resolveAttemptConflict:resolveAttemptConflict, validateStrictImportedCase:validateStrictImportedCase,
    validateGroupCompatibility:validateGroupCompatibility, decideGroupImport:decideGroupImport, applyImportedCase:applyImportedCase,
    caseSummary:caseSummary, groupBatchCounts:groupBatchCounts
  };
});
