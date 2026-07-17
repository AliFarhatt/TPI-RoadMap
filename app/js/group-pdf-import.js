/* Local one-or-many Elmy PDF import into the current group roster. */
(function (root, factory) {
  var api = factory(root || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TP_GROUP_PDF_IMPORT = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function (root) {
  "use strict";
  var B = root.TP_BATCH_UTILS || (typeof require === "function" ? require("./batch-utils.js") : null);

  function statusClass(status) {
    if (status === "Added" || status === "Replaced older attempt") return "status-ok";
    if (status === "Duplicate skipped" || status === "Older attempt skipped") return "status-warn";
    return "status-err";
  }
  function rowFromCase(filename, caseInput, status, reason) {
    var summary = B.caseSummary(caseInput || {});
    return {
      filename:B.safeText(filename, "Unnamed PDF"), student_name:summary.student_name, attempt_number:summary.attempt_number,
      total_score:summary.total_score, answered_questions:summary.answered_questions, correct_questions:summary.correct_questions,
      status:status, reason:B.safeText(reason)
    };
  }
  function classifyImportError(error) {
    var code = error && error.code || "", message = error && error.message || "The PDF could not be imported.";
    if (code === "WRONG_ASSESSMENT") return { status:"Incompatible diagnostic", reason:message };
    if (code === "IMPORT_VALIDATION_FAILED" || code === "ENGINE_REJECTED_CASE") return { status:"Validation failed", reason:message };
    if (code === "NOT_ELMY_REPORT" || code === "NO_PAGES" || code === "MISSING_TEXT_LAYER") return { status:"Invalid PDF", reason:message };
    return { status:code ? "Parsing failed" : "Invalid PDF", reason:message };
  }

  function processCasesAgainstGroup(groupInput, importedCases, options) {
    var group = B.deep(groupInput), rows = [];
    (importedCases || []).forEach(function (item, index) {
      var caseInput = item && item.caseInput || item, filename = item && item.filename || ("student-" + (index + 1) + ".pdf");
      var applied = B.applyImportedCase(group, caseInput, options);
      group = applied.group;
      rows.push(rowFromCase(filename, caseInput, applied.decision.status, applied.decision.reason));
    });
    return { group:group, results:rows, counts:B.groupBatchCounts(rows), analysis_stale:rows.some(function (r) { return r.status === "Added" || r.status === "Replaced older attempt"; }) };
  }

  function renderSummary(container, rows) {
    if (!container || typeof document === "undefined") return;
    var counts = B.groupBatchCounts(rows);
    container.innerHTML = ""; container.classList.remove("hidden");
    var heading = document.createElement("h3"); heading.textContent = counts.files_selected + " diagnostic PDF" + (counts.files_selected === 1 ? "" : "s") + " processed"; container.appendChild(heading);
    var countBox = document.createElement("div"); countBox.className = "batch-counts"; container.appendChild(countBox);
    [[counts.files_selected,"Files selected"],[counts.students_added,"Students added"],[counts.students_replaced,"Students replaced"],[counts.duplicates_skipped,"Duplicates skipped"],[counts.older_attempts_skipped,"Older attempts skipped"],[counts.invalid_files,"Invalid files"],[counts.incompatible_diagnostics,"Incompatible diagnostics"]].forEach(function (item) {
      var cell = document.createElement("div"); cell.className = "batch-count";
      var strong = document.createElement("strong"); strong.textContent = item[0];
      var label = document.createElement("span"); label.textContent = item[1];
      cell.appendChild(strong); cell.appendChild(label); countBox.appendChild(cell);
    });
    var list = document.createElement("div"); list.className = "batch-results"; container.appendChild(list);
    rows.forEach(function (row) {
      var item = document.createElement("div"); item.className = "batch-result " + statusClass(row.status);
      var file = document.createElement("div"); file.className = "file"; file.textContent = row.filename;
      var student = document.createElement("div"); student.className = "student";
      student.textContent = row.student_name + (row.attempt_number ? " · Attempt " + row.attempt_number : " · Attempt unavailable") + (row.total_score == null ? "" : " · " + row.total_score) + " · " + row.answered_questions + " answered · " + row.correct_questions + " correct";
      var status = document.createElement("div"); status.className = "status";
      var label = document.createElement("strong"); label.textContent = row.status;
      var reason = document.createElement("span"); reason.textContent = row.reason || "";
      status.appendChild(label); status.appendChild(reason); item.appendChild(file); item.appendChild(student); item.appendChild(status); list.appendChild(item);
    });
  }

  function bindBrowserUi() {
    if (typeof document === "undefined" || !B) return;
    var button = document.getElementById("btn-import-pdf-to-group"), input = document.getElementById("file-group-elmy-pdf");
    var progress = document.getElementById("group-import-progress"), summaryBox = document.getElementById("group-import-summary");
    var app = root.TP_APP_API, importer = root.TP_ELMY_IMPORTER, engine = root.TP_ENGINE, config = root.TP_CONFIG;
    if (!button || !input || !app) return;
    button.onclick = function () {
      if (app.getMode() !== "group") { app.startNote("err", "Load or create a group case before importing diagnostic PDFs."); return; }
      input.click();
    };
    input.onchange = async function (event) {
      var files = Array.prototype.slice.call(event.target.files || []); event.target.value = "";
      if (!files.length) return;
      if (app.getMode() !== "group") { app.startNote("err", "Load or create a group case before importing diagnostic PDFs."); return; }
      if (!importer || !root.pdfjsLib) { app.startNote("err", "The local diagnostic PDF importer is unavailable. Re-extract the complete package."); return; }
      button.disabled = true; button.setAttribute("aria-busy", "true");
      var rows = [];
      for (var index = 0; index < files.length; index++) {
        var file = files[index], caseInput = null;
        progress.textContent = "File " + (index + 1) + " of " + files.length + " · Parsing " + file.name + " locally…";
        await new Promise(function (resolve) { root.setTimeout(resolve, 0); });
        try {
          if (!/\.pdf$/i.test(file.name || "") && file.type !== "application/pdf") throw new importer.ImportError("NOT_PDF", "Select PDF files only.");
          var parsed = await importer.importPdf(await file.arrayBuffer(), config, {
            workerSrc:"vendor/pdfjs/pdf.worker.min.js",
            onProgress:function (p) { progress.textContent = "File " + (index + 1) + " of " + files.length + " · Reading page " + p.page + " of " + p.totalPages + " locally…"; }
          });
          caseInput = parsed.caseInput;
          var individual = engine.analyzeIndividual(caseInput, config);
          if (!individual.ok) throw new importer.ImportError("ENGINE_REJECTED_CASE", individual.errors.map(function (x) { return x.message; }).join(" "));
          var current = app.getGroupInput();
          var decision = B.decideGroupImport(caseInput, current.students, {
            isValidStudent:function (student) { var checked = engine.analyzeIndividual(student, config); return !!checked.ok; }
          });
          if (decision.action === "add") app.commitImportedGroupStudent(caseInput, -1);
          else if (decision.action === "replace") app.commitImportedGroupStudent(decision.student, decision.index);
          rows.push(rowFromCase(file.name, caseInput, decision.status, decision.reason));
          renderSummary(summaryBox, rows);
        } catch (error) {
          var classified = classifyImportError(error);
          rows.push(rowFromCase(file.name, caseInput, classified.status, classified.reason));
          renderSummary(summaryBox, rows);
          if (root.console && console.error) console.error("Group diagnostic PDF import failed", file.name, error);
        }
      }
      button.disabled = false; button.removeAttribute("aria-busy"); progress.textContent = "";
      var counts = B.groupBatchCounts(rows), changed = counts.students_added + counts.students_replaced;
      if (changed) app.note("warn", changed + " student" + (changed === 1 ? " was" : "s were") + " added or replaced. Run group analysis to update the shared roadmap and report.");
      else app.note("warn", "No group students were changed. Review the import summary.");
    };
  }

  var api = { rowFromCase:rowFromCase, classifyImportError:classifyImportError, processCasesAgainstGroup:processCasesAgainstGroup, renderSummary:renderSummary, bindBrowserUi:bindBrowserUi };
  if (typeof document !== "undefined") bindBrowserUi();
  return api;
});
