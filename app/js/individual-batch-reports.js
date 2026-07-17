/* Multi-PDF individual analysis and three-report ZIP generation. */
(function (root, factory) {
  var api = factory(root || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TP_INDIVIDUAL_BATCH = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function (root) {
  "use strict";
  var B = root.TP_BATCH_UTILS || (typeof require === "function" ? require("./batch-utils.js") : null);

  function reportBaseName(caseInput) {
    var name = B.sanitizeSlug(caseInput && caseInput.student && caseInput.student.student_name, "student");
    var attempt = B.validAttempt(caseInput && caseInput.diagnostic && caseInput.diagnostic.attempt_number);
    return name + (attempt ? "_attempt-" + attempt : "_date-" + B.sanitizeSlug(caseInput && caseInput.diagnostic && caseInput.diagnostic.date, "unknown"));
  }
  function duplicateKey(caseInput) {
    var identity = B.normalizeStudentIdentity(caseInput && caseInput.student && caseInput.student.student_name);
    var diagnostic = caseInput && caseInput.diagnostic || {}, attempt = B.validAttempt(diagnostic.attempt_number);
    return identity + "|" + (attempt ? "attempt:" + attempt : "date:" + (B.safeText(diagnostic.date) || "unknown"));
  }
  function uniqueFolder(base, used) {
    var candidate = base, suffix = 2;
    while (used[candidate]) candidate = base + "_" + suffix++;
    used[candidate] = true;
    return candidate;
  }
  function reportNames(base) {
    return {
      detailed_diagnostic:base + "_detailed-diagnostic-report.pdf",
      seven_page_roadmap:base + "_seven-page-roadmap.pdf",
      two_page_report:base + "_two-page-report.pdf"
    };
  }
  function safeError(error) { return error && error.message ? String(error.message) : "Unknown error"; }

  async function generateAllIndividualReportBlobs(caseInput, analysisOutput, options) {
    options = options || {};
    var exporter = options.exporter || (root.TP_OFFLINE_PDF_EXPORT && root.TP_OFFLINE_PDF_EXPORT.renderHtmlToPdfBlob);
    if (typeof exporter !== "function") throw new Error("The bundled local PDF exporter is unavailable.");
    var base = reportBaseName(caseInput), names = reportNames(base), reports = {}, definitions = [
      { key:"detailed_diagnostic", label:"Detailed diagnostic report", html:function () { return root.TP_REPORT.renderIndividualReport(analysisOutput, caseInput); }, pdf_options:{ scale:0.75 } },
      { key:"seven_page_roadmap", label:"Seven-page student roadmap", html:function () {
        var vm = root.TP_VIEWMODEL.buildRoadmapViewModel(caseInput, analysisOutput, root.TP_CONFIG, { asset_base:"" });
        return root.TP_RENDER_ROADMAP(vm);
      }, pdf_options:{ page_selector:".cover-page, .pagebreak", expected_pages:7, scale:0.7 } },
      { key:"two_page_report", label:"Two-page teacher and parent report", html:function () {
        var check = root.TP_TWOPAGE.validateTwoPageCase(caseInput, analysisOutput);
        if (!check.ok) throw new Error(check.message || "The two-page report case is invalid.");
        return root.TP_TWOPAGE.renderTwoPageDiagnosticReport(analysisOutput, caseInput);
      }, pdf_options:{ page_selector:".two-page-report-page", expected_pages:2, scale:0.8 } }
    ];
    for (var i = 0; i < definitions.length; i++) {
      var def = definitions[i];
      if (options.onProgress) options.onProgress({ phase:"report", report_index:i + 1, report_total:3, report_key:def.key, message:"Generating " + def.label + "…" });
      try {
        var html = def.html();
        var pdfOptions = Object.assign({ filename:names[def.key], scale:options.scale }, def.pdf_options || {});
        var blob = await exporter(html, pdfOptions);
        if (root.TP_OFFLINE_PDF_EXPORT && root.TP_OFFLINE_PDF_EXPORT.validatePdfBlob) await root.TP_OFFLINE_PDF_EXPORT.validatePdfBlob(blob);
        reports[def.key] = { status:"success", file_name:names[def.key], blob:blob, error:null };
      } catch (error) {
        reports[def.key] = { status:"failed", file_name:names[def.key], blob:null, error:safeError(error) };
      }
      await new Promise(function (resolve) { root.setTimeout(resolve, 200); });
    }
    return reports;
  }

  function publicStudentRow(row) {
    var reports = {};
    ["detailed_diagnostic","seven_page_roadmap","two_page_report"].forEach(function (key) {
      var report = row.reports && row.reports[key];
      reports[key] = report ? { status:report.status, file_name:report.status === "success" ? report.file_name : null, error:report.error || null } : { status:"not_generated", file_name:null, error:null };
    });
    return {
      student_name:row.student_name || null, attempt_number:row.attempt_number == null ? null : row.attempt_number,
      source_filename:row.source_filename, status:row.status, folder:row.folder || null, reports:reports, warnings:(row.warnings || []).slice(), error:row.error || null
    };
  }

  function buildSummary(rows, selectedCount, generatedAt) {
    var reportsGenerated = 0, reportsExpected = 0;
    rows.forEach(function (row) {
      if (row.reports) {
        reportsExpected += 3;
        Object.keys(row.reports).forEach(function (key) { if (row.reports[key].status === "success") reportsGenerated++; });
      }
    });
    return {
      batch_type:"individual_elmy_pdf_reports", generated_at:generatedAt || new Date().toISOString(), files_selected:selectedCount,
      students_successful:rows.filter(function (r) { return r.status === "success"; }).length,
      students_failed:rows.filter(function (r) { return r.status === "failed" || r.status === "partial" || r.status === "conflicting_duplicate"; }).length,
      students_skipped:rows.filter(function (r) { return r.status === "duplicate_skipped"; }).length,
      reports_expected:reportsExpected, reports_generated:reportsGenerated,
      students:rows.map(publicStudentRow)
    };
  }

  async function buildIndividualBatchZip(rows, summary, options) {
    options = options || {};
    var Zip = options.JSZip || root.JSZip;
    if (!Zip) throw new Error("The bundled offline ZIP utility is unavailable.");
    var zip = new Zip(), rootFolder = zip.folder("individual-diagnostic-reports");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row.folder || !row.reports) continue;
      var folder = rootFolder.folder(row.folder), keys = Object.keys(row.reports);
      for (var k = 0; k < keys.length; k++) {
        var report = row.reports[keys[k]];
        if (report.status === "success" && report.blob) {
          var bytes = typeof report.blob.arrayBuffer === "function" ? await report.blob.arrayBuffer() : report.blob;
          folder.file(report.file_name, bytes);
        }
      }
    }
    rootFolder.file("batch-summary.json", JSON.stringify(summary, null, 2));
    /* PDFs are already compressed; STORE is much faster and avoids wasting memory
       recompressing image streams in large classroom batches. */
    return zip.generateAsync({ type:"blob", compression:"STORE", streamFiles:true }, options.onZipProgress);
  }

  function caseValidation(caseInput) {
    var strict = B.validateStrictImportedCase(caseInput);
    if (!strict.ok) throw new Error(strict.reasons.join(" "));
    if (!root.TP_ENGINE || !root.TP_CONFIG) throw new Error("The individual planning engine is unavailable.");
    var analysis = root.TP_ENGINE.analyzeIndividual(caseInput, root.TP_CONFIG);
    if (!analysis.ok) throw new Error(analysis.errors.map(function (x) { return x.message; }).join(" "));
    return analysis;
  }

  async function runBatch(items, options) {
    options = options || {};
    var rows = [], seen = {}, usedFolders = {}, selectedCount = items.length;
    for (var i = 0; i < items.length; i++) {
      var item = items[i], source = item && (item.source_filename || item.name) || ("diagnostic-" + (i + 1) + ".pdf"), caseInput = null;
      if (options.onProgress) options.onProgress({ student_index:i + 1, student_total:selectedCount, phase:"parse", message:"Student " + (i + 1) + " of " + selectedCount + " · Parsing diagnostic…" });
      try {
        caseInput = options.parseItem ? await options.parseItem(item, i, selectedCount) : B.deep(item.caseInput || item);
        var analysis = caseValidation(caseInput), key = duplicateKey(caseInput), signature = B.contentSignature(caseInput), previous = seen[key];
        if (previous) {
          if (previous.signature === signature) {
            rows.push({ source_filename:source, student_name:B.caseSummary(caseInput).student_name, attempt_number:B.validAttempt(caseInput.diagnostic && caseInput.diagnostic.attempt_number), status:"duplicate_skipped", warnings:["Exact duplicate skipped; reports were not generated twice."], reports:null });
            continue;
          }
          rows.push({ source_filename:source, student_name:B.caseSummary(caseInput).student_name, attempt_number:B.validAttempt(caseInput.diagnostic && caseInput.diagnostic.attempt_number), status:"conflicting_duplicate", warnings:[], error:"The same student and attempt contain different diagnostic data. Manual review is required.", reports:null });
          continue;
        }
        seen[key] = { signature:signature };
        var base = reportBaseName(caseInput), folder = uniqueFolder(base, usedFolders);
        if (options.onProgress) options.onProgress({ student_index:i + 1, student_total:selectedCount, phase:"analysis", message:"Student " + (i + 1) + " of " + selectedCount + " · Analysis complete; generating three reports…" });
        var reports = await generateAllIndividualReportBlobs(caseInput, analysis, {
          exporter:options.exporter, scale:options.scale,
          onProgress:function (p) { if (options.onProgress) options.onProgress(Object.assign({ student_index:i + 1, student_total:selectedCount }, p)); }
        });
        var generated = Object.keys(reports).filter(function (reportKey) { return reports[reportKey].status === "success"; }).length;
        var summary = B.caseSummary(caseInput);
        rows.push({ source_filename:source, student_name:summary.student_name, attempt_number:summary.attempt_number, status:generated === 3 ? "success" : (generated ? "partial" : "failed"), folder:folder, reports:reports, warnings:[] });
      } catch (error) {
        var info = caseInput ? B.caseSummary(caseInput) : { student_name:null, attempt_number:null };
        rows.push({ source_filename:source, student_name:info.student_name, attempt_number:info.attempt_number, status:"failed", error:safeError(error), warnings:[], reports:null });
      }
      await new Promise(function (resolve) { root.setTimeout ? root.setTimeout(resolve, 0) : resolve(); });
    }
    var summary = buildSummary(rows, selectedCount, options.generatedAt);
    var zipBlob = null;
    if (summary.reports_generated > 0 || options.includeSummaryOnlyZip) {
      if (options.onProgress) options.onProgress({ phase:"zip", message:"Packaging completed reports into one ZIP…" });
      zipBlob = await buildIndividualBatchZip(rows, summary, { JSZip:options.JSZip, onZipProgress:options.onZipProgress });
    }
    return { rows:rows, summary:summary, zipBlob:zipBlob, filename:"individual-diagnostic-reports_" + summary.generated_at.slice(0,10) + ".zip" };
  }

  function generateIndividualReportsFromCases(cases, options) {
    return runBatch((cases || []).map(function (item, index) { return item && item.caseInput ? item : { caseInput:item, source_filename:"diagnostic-" + (index + 1) + ".pdf" }; }), options || {});
  }

  function generateIndividualReportsFromPdfs(files, options) {
    options = options || {};
    var importer = root.TP_ELMY_IMPORTER, config = root.TP_CONFIG;
    if (!importer || !root.pdfjsLib) return Promise.reject(new Error("The local diagnostic PDF importer is unavailable."));
    var next = Object.assign({}, options, {
      parseItem:async function (file, index, total) {
        if (!/\.pdf$/i.test(file.name || "") && file.type !== "application/pdf") throw new Error("Select PDF files only.");
        return (await importer.importPdf(await file.arrayBuffer(), config, {
          workerSrc:"vendor/pdfjs/pdf.worker.min.js",
          onProgress:function (p) { if (options.onProgress) options.onProgress({ student_index:index + 1, student_total:total, phase:"parse", message:"Student " + (index + 1) + " of " + total + " · Reading page " + p.page + " of " + p.totalPages + " locally…" }); }
        })).caseInput;
      }
    });
    return runBatch(files || [], next);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click();
    root.setTimeout(function () { URL.revokeObjectURL(url); anchor.remove(); }, 1000);
  }

  function renderBatchSummary(container, result) {
    if (!container || typeof document === "undefined") return;
    var summary = result.summary; container.innerHTML = ""; container.classList.remove("hidden");
    var heading = document.createElement("h3"); heading.textContent = summary.files_selected + " diagnostic PDFs processed"; container.appendChild(heading);
    var counts = document.createElement("div"); counts.className = "batch-counts"; container.appendChild(counts);
    [[summary.files_selected,"Files selected"],[summary.students_successful,"Students complete"],[summary.students_failed,"Failed or partial"],[summary.students_skipped,"Duplicates skipped"],[summary.reports_generated,"Reports generated"]].forEach(function (value) {
      var box = document.createElement("div"); box.className = "batch-count";
      var strong = document.createElement("strong"); strong.textContent = value[0];
      var label = document.createElement("span"); label.textContent = value[1]; box.appendChild(strong); box.appendChild(label); counts.appendChild(box);
    });
    var list = document.createElement("div"); list.className = "batch-results"; container.appendChild(list);
    result.rows.forEach(function (row) {
      var item = document.createElement("div"); item.className = "batch-result " + (row.status === "success" ? "status-ok" : row.status === "duplicate_skipped" ? "status-warn" : "status-err");
      var file = document.createElement("div"); file.className = "file"; file.textContent = row.source_filename;
      var student = document.createElement("div"); student.className = "student"; student.textContent = (row.student_name || "Student name unavailable") + (row.attempt_number ? " · Attempt " + row.attempt_number : "");
      var status = document.createElement("div"); status.className = "status";
      var strong = document.createElement("strong"); strong.textContent = row.status.replace(/_/g, " ");
      var detail = document.createElement("span");
      if (row.reports) detail.textContent = Object.keys(row.reports).map(function (key) { return key.replace(/_/g," ") + ": " + row.reports[key].status; }).join(" · ");
      else detail.textContent = row.error || (row.warnings || []).join(" ");
      status.appendChild(strong); status.appendChild(detail); item.appendChild(file); item.appendChild(student); item.appendChild(status); list.appendChild(item);
    });
  }

  function bindBrowserUi() {
    if (typeof document === "undefined") return;
    var input = document.getElementById("file-elmy-pdf"), button = document.getElementById("btn-load-elmy-pdf"), progress = document.getElementById("elmy-import-progress"), summaryBox = document.getElementById("individual-batch-summary");
    var app = root.TP_APP_API;
    if (!input || !button) return;
    input.multiple = true;
    var originalSingleHandler = input.onchange;
    input.onchange = async function (event) {
      var files = Array.prototype.slice.call(event.target.files || []);
      if (files.length <= 1) return originalSingleHandler && originalSingleHandler.call(input, event);
      event.target.value = "";
      if (app && app.getMode() === "group") { app.startNote("err", "Use ‘Import diagnostic PDF to group…’ to add students to the current group."); return; }
      button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Generating batch reports…";
      progress.textContent = files.length + " diagnostic PDFs selected. Each valid student will be analyzed and receive three reports.";
      try {
        var result = await generateIndividualReportsFromPdfs(files, {
          onProgress:function (p) { progress.textContent = p.message || "Processing diagnostic PDFs locally…"; }
        });
        renderBatchSummary(summaryBox, result);
        if (result.zipBlob) {
          downloadBlob(result.zipBlob, result.filename);
          if (app) app.startNote("ok", result.summary.reports_generated + " individual reports were packaged in " + result.filename + ". The previously loaded case was preserved.");
        } else if (app) app.startNote("err", "No individual reports were generated. Review the batch summary.");
      } catch (error) {
        if (app) app.startNote("err", "The individual batch could not be completed: " + safeError(error));
      } finally {
        button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = "Import Elmy diagnostic PDF…"; progress.textContent = "";
      }
    };
  }

  var api = {
    reportBaseName:reportBaseName, duplicateKey:duplicateKey, uniqueFolder:uniqueFolder, reportNames:reportNames,
    generateAllIndividualReportBlobs:generateAllIndividualReportBlobs, buildSummary:buildSummary,
    buildIndividualBatchZip:buildIndividualBatchZip, generateIndividualReportsFromCases:generateIndividualReportsFromCases,
    generateIndividualReportsFromPdfs:generateIndividualReportsFromPdfs, renderBatchSummary:renderBatchSummary, bindBrowserUi:bindBrowserUi
  };
  if (typeof document !== "undefined") bindBrowserUi();
  return api;
});
