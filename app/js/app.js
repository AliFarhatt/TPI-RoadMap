/* TestPrep planner UI controller. All logic lives in engine/viewmodel/renderers;
 * this file only wires the form to them and manages print windows. */
(function () {
  "use strict";
  var CFG = window.TP_CONFIG, E = window.TP_ENGINE, VM = window.TP_VIEWMODEL,
      RP = window.TP_REPORT, T2 = window.TP_TWOPAGE, EX = window.TP_EXAMPLES,
      EI = window.TP_ELMY_IMPORTER;

  var state = {
    mode: null,               // "individual" | "group"
    group: { group_name: "", group_id: "", students: [] },
    students: [],             // array of case-input objects (1 for individual)
    activeStudent: 0,
    results: null,            // last engine output (individual or group)
    answerMaps: []            // per-student: key -> answer record
  };

  function $(id) { return document.getElementById(id); }
  function show(id, on) { $(id).classList.toggle("hidden", !on); }
  function esc(s) { return s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function blankStudent() {
    return {
      schema_version: "2.0", course_type: "individual", season: "",
      student: { student_name: "", student_id: "", grade_level: null, known_foundational_gaps: [], teacher_overrides: [], teacher_flagged_weak_subskills: [] },
      scores: { score_source: "provided", reading_writing_scaled: null, math_scaled: null, total_scaled: null },
      goal: { target_sat_score: null, intended_test_date: null },
      availability: { weeks_available: null, preferred_sessions_per_week: 2, max_session_length: "", session_format: "", accommodation: "No" },
      diagnostic: { template_id: "Diagnostic_Exam_2026", date: "", answers: [] }
    };
  }

  // ---------- start actions ----------
  $("btn-new-individual").onclick = function () {
    state.mode = "individual"; state.students = [blankStudent()]; state.activeStudent = 0;
    clearImportReview(); rebuildAnswerMaps(); refreshAll();
  };
  $("btn-new-group").onclick = function () {
    state.mode = "group"; state.group = { group_name: "", group_id: "", students: [] };
    state.students = [blankStudent(), blankStudent()]; state.activeStudent = 0;
    clearImportReview(); rebuildAnswerMaps(); refreshAll();
  };
  $("btn-example-individual").onclick = function () {
    state.mode = "individual"; state.students = [deep(EX.individual)]; state.activeStudent = 0;
    clearImportReview(); rebuildAnswerMaps(); refreshAll(); note("ok", "Loaded the embedded individual example (Maya Haddad). Press Run analysis.");
  };
  $("btn-example-group").onclick = function () {
    var g = deep(EX.group);
    state.mode = "group"; state.group = { group_name: g.group_name, group_id: g.group_id };
    state.students = g.students; state.activeStudent = 0;
    clearImportReview(); rebuildAnswerMaps(); refreshAll(); note("ok", "Loaded the embedded group example (3 students). Press Run analysis.");
  };
  $("btn-load-json").onclick = function () { $("file-json").click(); };
  $("file-json").onchange = function (ev) {
    readFile(ev.target.files[0], function (text) {
      try {
        var obj = JSON.parse(text);
        if (obj.students && Array.isArray(obj.students)) {
          state.mode = "group"; state.group = { group_name: obj.group_name || "", group_id: obj.group_id || "" };
          state.students = obj.students;
        } else {
          state.mode = "individual"; state.students = [obj];
        }
        clearImportReview(); state.activeStudent = 0; rebuildAnswerMaps(); refreshAll();
        note("ok", "JSON loaded: " + (state.mode === "group" ? state.students.length + "-student group." : "individual case."));
      } catch (e2) { note("err", "Could not parse JSON: " + e2.message); }
    });
    ev.target.value = "";
  };
  $("btn-load-csv").onclick = function () { $("file-csv").click(); };
  $("file-csv").onchange = function (ev) {
    readFile(ev.target.files[0], function (text) {
      var tplId = (state.students[0] && state.students[0].diagnostic.template_id) || "Diagnostic_Exam_2026";
      var res = E.importAnswersCsv(text, tplId, CFG);
      res.errors.forEach(function (er) { note("err", "CSV: " + er.message); });
      var ids = Object.keys(res.students);
      if (!ids.length) { note("err", "CSV import produced no answer records."); return; }
      if (!state.mode) { state.mode = ids.length > 1 ? "group" : "individual"; state.students = []; }
      ids.forEach(function (id) {
        var rec = res.students[id];
        var st = state.students.filter(function (s) { return s.student.student_id === id || s.student.student_name === rec.student_name; })[0];
        if (!st) { st = blankStudent(); st.student.student_id = rec.student_id; st.student.student_name = rec.student_name; state.students.push(st); }
        st.diagnostic.answers = rec.answers;
      });
      if (state.mode === "individual" && state.students.length > 1) state.mode = "group";
      clearImportReview(); state.activeStudent = 0; rebuildAnswerMaps(); refreshAll();
      note(res.errors.length ? "warn" : "ok", "CSV imported: " + ids.length + " student(s), " + ids.reduce(function (n, id) { return n + res.students[id].answers.length; }, 0) + " answer records." + (res.errors.length ? " Some lines were rejected; see errors above." : ""));
    });
    ev.target.value = "";
  };

  // ---------- Elmy diagnostic PDF import ----------
  $("btn-load-elmy-pdf").onclick = function () { $("file-elmy-pdf").click(); };
  $("file-elmy-pdf").onchange = async function (ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    $("import-start-messages").innerHTML = "";
    clearImportReview();
    if (!/\.pdf$/i.test(file.name || "") && file.type !== "application/pdf") {
      startNote("err", "Select an Elmy diagnostic PDF file.");
      return;
    }
    if (!EI || !window.pdfjsLib) {
      startNote("err", "The local PDF importer files are missing. Re-extract the complete package and try again.");
      return;
    }

    var button = $("btn-load-elmy-pdf"), originalLabel = button.textContent;
    button.disabled = true; button.textContent = "Importing Elmy PDF…";
    $("elmy-import-progress").textContent = "Opening " + file.name + " locally…";
    try {
      var buffer = await file.arrayBuffer();
      var parsed = await EI.importPdf(buffer, CFG, {
        workerSrc: "vendor/pdfjs/pdf.worker.min.js",
        onProgress: function (p) {
          $("elmy-import-progress").textContent = "Reading diagnostic page " + p.page + " of " + p.totalPages + " locally…";
        }
      });
      var engineCheck = E.analyzeIndividual(parsed.caseInput, CFG);
      if (!engineCheck.ok) {
        throw new EI.ImportError("ENGINE_REJECTED_CASE", "The PDF was extracted, but the generated case was rejected by the planning engine: " + engineCheck.errors.map(function (x) { return x.message; }).join(" "));
      }
      if (hasPopulatedCase() && !window.confirm("Replace the currently loaded case with the imported Elmy diagnostic for " + parsed.caseInput.student.student_name + "?")) {
        startNote("warn", "Import cancelled. The currently loaded case was not changed.");
        return;
      }
      state.mode = "individual";
      state.students = [parsed.caseInput];
      state.activeStudent = 0;
      state.results = null;
      rebuildAnswerMaps();
      refreshAll();
      $("messages").innerHTML = "";
      note("ok", EI.formatImportValidationSummary(parsed));
      parsed.validation.warnings.forEach(function (warning) { note("warn", warning); });
      renderImportReview(parsed);
    } catch (err) {
      if (window.console && console.error) console.error("Elmy PDF import failed", err);
      startNote("err", EI && EI.userMessageForError ? EI.userMessageForError(err) : "The Elmy diagnostic could not be imported.");
    } finally {
      button.disabled = false; button.textContent = originalLabel;
      $("elmy-import-progress").textContent = "";
    }
  };

  // ---------- group roster ----------
  $("btn-add-student").onclick = function () {
    if (state.students.length >= 20) { note("err", "Groups support at most 20 students."); return; }
    state.students.push(blankStudent()); state.activeStudent = state.students.length - 1;
    rebuildAnswerMaps(); refreshAll();
  };
  function renderRoster() {
    var r = $("roster"); r.innerHTML = "";
    state.students.forEach(function (s, i) {
      var d = document.createElement("div");
      d.className = "roster-item" + (i === state.activeStudent ? " active" : "");
      d.innerHTML = "<span class=\"rname\">" + esc(s.student.student_name || "(unnamed student " + (i + 1) + ")") + "</span>" +
        "<span class=\"rmeta\">" + (s.diagnostic.answers || []).length + " answers</span><span class=\"spacer\"></span>";
      var sel = document.createElement("button"); sel.className = "btn small"; sel.textContent = "Edit";
      sel.onclick = function () { saveStudentForm(); state.activeStudent = i; refreshAll(); };
      var del = document.createElement("button"); del.className = "btn small danger"; del.textContent = "Remove";
      del.onclick = function () {
        if (state.students.length <= 2) { note("err", "A group needs at least 2 students; switch to an individual case instead."); return; }
        state.students.splice(i, 1); state.answerMaps.splice(i, 1);
        if (state.activeStudent >= state.students.length) state.activeStudent = state.students.length - 1;
        refreshAll();
      };
      d.appendChild(sel); d.appendChild(del); r.appendChild(d);
    });
    $("g-name").value = state.group.group_name || "";
    $("g-id").value = state.group.group_id || "";
  }
  $("g-name").onchange = function () { state.group.group_name = this.value; };
  $("g-id").onchange = function () { state.group.group_id = this.value; };

  // ---------- student form ----------
  function tplOptions() {
    var sel = $("f-template"); sel.innerHTML = "";
    Object.keys(CFG.diagnostic_templates).forEach(function (id) {
      var o = document.createElement("option"); o.value = id; o.textContent = CFG.diagnostic_templates[id].test_name;
      sel.appendChild(o);
    });
  }
  function loadStudentForm() {
    var s = state.students[state.activeStudent]; if (!s) return;
    $("student-panel-title").textContent = state.mode === "group" ? "Student " + (state.activeStudent + 1) + " of " + state.students.length : "Identity, scores, goal, availability";
    $("f-name").value = s.student.student_name || "";
    $("f-id").value = s.student.student_id || "";
    $("f-grade").value = s.student.grade_level || "";
    $("f-rw").value = s.scores.reading_writing_scaled != null ? s.scores.reading_writing_scaled : "";
    $("f-math").value = s.scores.math_scaled != null ? s.scores.math_scaled : "";
    $("f-total").value = s.scores.total_scaled != null ? s.scores.total_scaled : "";
    $("f-target").value = s.goal.target_sat_score != null ? s.goal.target_sat_score : "";
    $("f-testdate").value = s.goal.intended_test_date || "";
    $("f-weeks").value = s.availability.weeks_available || "";
    $("f-spw").value = s.availability.preferred_sessions_per_week == null ? "" : s.availability.preferred_sessions_per_week;
    $("f-maxsess").value = s.availability.max_session_length || "";
    $("f-format").value = s.availability.session_format || "";
    $("f-accom").value = s.availability.accommodation || "";
    $("f-template").value = s.diagnostic.template_id || "Diagnostic_Exam_2026";
    $("f-diagdate").value = s.diagnostic.date || "";
    renderGaps(s);
  }
  function saveStudentForm() {
    var s = state.students[state.activeStudent]; if (!s) return;
    s.student.student_name = $("f-name").value.trim();
    s.student.student_id = $("f-id").value.trim();
    s.student.grade_level = num($("f-grade").value);
    s.scores.reading_writing_scaled = num($("f-rw").value);
    s.scores.math_scaled = num($("f-math").value);
    s.scores.total_scaled = num($("f-total").value);
    s.goal.target_sat_score = num($("f-target").value);
    s.goal.intended_test_date = $("f-testdate").value || null;
    s.availability.weeks_available = num($("f-weeks").value);
    s.availability.preferred_sessions_per_week = num($("f-spw").value);
    s.availability.max_session_length = $("f-maxsess").value.trim();
    s.availability.session_format = $("f-format").value.trim();
    s.availability.accommodation = $("f-accom").value || null;
    s.diagnostic.template_id = $("f-template").value;
    s.diagnostic.date = $("f-diagdate").value.trim();
  }
  ["f-name", "f-id", "f-grade", "f-rw", "f-math", "f-total", "f-target", "f-testdate", "f-weeks", "f-spw", "f-maxsess", "f-format", "f-accom", "f-template", "f-diagdate"].forEach(function (id) {
    $(id).addEventListener("change", function () { saveStudentForm(); if (id === "f-template") { rebuildAnswerMaps(); renderAnswers(); } if (state.mode === "group") renderRoster(); });
  });
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function renderGaps(s) {
    var box = $("gaps"); box.innerHTML = "";
    (s.student.known_foundational_gaps || []).forEach(function (g2, i) {
      var row = document.createElement("div"); row.className = "gap-row";
      row.innerHTML = "<label>Lesson<select data-k=\"lesson\">" + CFG.lesson_catalog.lessons.map(function (l) {
        return "<option value=\"" + l.lesson_id + "\"" + (l.lesson_id === g2.lesson_id ? " selected" : "") + ">" + esc(l.lesson_name) + "</option>";
      }).join("") + "</select></label>" +
        "<label>Severity<select data-k=\"sev\"><option" + (g2.severity === "moderate" ? " selected" : "") + ">moderate</option><option" + (g2.severity === "major" ? " selected" : "") + ">major</option></select></label>" +
        "<label>Evidence (required)<input data-k=\"ev\" value=\"" + esc(g2.evidence || "") + "\"></label>";
      var del = document.createElement("button"); del.className = "btn small danger"; del.textContent = "Remove";
      del.onclick = function () { s.student.known_foundational_gaps.splice(i, 1); renderGaps(s); };
      row.appendChild(del);
      row.querySelector("[data-k=lesson]").onchange = function () { g2.lesson_id = this.value; };
      row.querySelector("[data-k=sev]").onchange = function () { g2.severity = this.value; };
      row.querySelector("[data-k=ev]").onchange = function () { g2.evidence = this.value; };
      box.appendChild(row);
    });
  }
  $("btn-add-gap").onclick = function () {
    var s = state.students[state.activeStudent];
    s.student.known_foundational_gaps.push({ lesson_id: CFG.lesson_catalog.lessons[0].lesson_id, severity: "moderate", evidence: "" });
    renderGaps(s);
  };

  // ---------- answers ----------
  function rebuildAnswerMaps() {
    state.answerMaps = state.students.map(function (s) {
      var m = {};
      (s.diagnostic.answers || []).forEach(function (a) { m[a.section + "|" + a.module + "|" + a.question_number] = a; });
      return m;
    });
  }
  function lessonName(id) {
    var l = CFG.lesson_catalog.lessons.filter(function (x) { return x.lesson_id === id; })[0];
    return l ? l.lesson_name : id;
  }
  function renderAnswers() {
    var s = state.students[state.activeStudent]; if (!s) return;
    var tpl = CFG.diagnostic_templates[s.diagnostic.template_id];
    var sec = $("a-section").value, mod = $("a-module").value;
    var tb = $("answers-table").querySelector("tbody"); tb.innerHTML = "";
    if (!tpl) return;
    var map = state.answerMaps[state.activeStudent];
    tpl.questions.filter(function (q) { return q.section === sec && q.module === mod; }).forEach(function (q) {
      var key = q.section + "|" + q.module + "|" + q.question_number;
      var a = map[key];
      var tr = document.createElement("tr");
      tr.innerHTML = "<td class=\"qnum\">" + q.question_number + "</td><td class=\"lname\">" + esc(lessonName(q.lesson_id)) + "</td>" +
        "<td><input data-k=\"student_answer\" maxlength=\"1000\" value=\"" + esc(a && a.student_answer || "") + "\"></td>" +
        "<td><input data-k=\"correct_answer\" maxlength=\"1000\" value=\"" + esc(a && a.correct_answer || "") + "\"></td>" +
        "<td><select data-k=\"difficulty\"><option value=\"\"></option><option" + sel(a, "difficulty", "easy") + ">easy</option><option" + sel(a, "difficulty", "medium") + ">medium</option><option" + sel(a, "difficulty", "hard") + ">hard</option></select></td>" +
        "<td><input data-k=\"time_seconds\" type=\"number\" min=\"0\" value=\"" + (a && a.time_seconds != null ? a.time_seconds : "") + "\"></td>" +
        "<td style=\"text-align:center\"><input data-k=\"guessed\" type=\"checkbox\"" + (a && a.guessed ? " checked" : "") + "></td>" +
        "<td><input data-k=\"method\" value=\"" + esc(a && a.method || "") + "\"></td>" +
        "<td><input data-k=\"teacher_note\" value=\"" + esc(a && a.teacher_note || "") + "\"></td>";
      tr.querySelectorAll("[data-k]").forEach(function (el) {
        el.addEventListener("change", function () { updateAnswer(s, map, q, tr); });
      });
      tb.appendChild(tr);
    });
    updateProgress(s, tpl);
  }
  function sel(a, k, v) { return a && a[k] === v ? " selected" : ""; }
  function updateAnswer(s, map, q, tr) {
    var key = q.section + "|" + q.module + "|" + q.question_number;
    var get = function (k) { return tr.querySelector("[data-k=" + k + "]"); };
    var sa = get("student_answer").value.trim(), ca = get("correct_answer").value.trim();
    var diff = get("difficulty").value, t = get("time_seconds").value;
    var gu = get("guessed").checked, me = get("method").value.trim(), tn = get("teacher_note").value.trim();
    var empty = !sa && !ca && !diff && !t && !gu && !me && !tn;
    if (empty) {
      if (map[key]) { s.diagnostic.answers = s.diagnostic.answers.filter(function (a) { return a !== map[key]; }); delete map[key]; }
    } else {
      var a = map[key];
      if (!a) { a = { section: q.section, module: q.module, question_number: q.question_number }; map[key] = a; s.diagnostic.answers.push(a); }
      a.student_answer = sa || null; a.correct_answer = ca || null;
      a.difficulty = diff || undefined; a.time_seconds = t ? parseFloat(t) : undefined;
      a.guessed = gu || undefined; a.method = me || undefined; a.teacher_note = tn || undefined;
      Object.keys(a).forEach(function (k) { if (a[k] === undefined) delete a[k]; });
    }
    updateProgress(s, CFG.diagnostic_templates[s.diagnostic.template_id]);
    if (state.mode === "group") renderRoster();
  }
  function updateProgress(s, tpl) {
    $("a-progress").textContent = (s.diagnostic.answers || []).length + " of " + tpl.total_questions + " questions recorded";
  }
  $("a-section").onchange = renderAnswers;
  $("a-module").onchange = renderAnswers;

  // ---------- calculate ----------
  $("btn-run").onclick = function () {
    saveStudentForm();
    $("messages").innerHTML = "";
    var res;
    if (state.mode === "group") {
      var gi = { schema_version: "2.0", course_type: "group", group_name: state.group.group_name || "Group", group_id: state.group.group_id || null, students: state.students };
      res = E.analyzeGroup(gi, CFG);
    } else {
      res = E.analyzeIndividual(state.students[0], CFG);
    }
    state.results = res;
    res.errors.forEach(function (m) { note("err", m.message); });
    res.warnings.forEach(function (m) { note("warn", m.message); });
    (res.info || []).forEach(function (m) { note("ok", m.message); });
    if (!res.ok) { note("err", "Calculation blocked by the errors above. Warnings alone do not block."); show("panel-results", false); return; }
    note("ok", "Analysis complete. All validation checks passed: " + res.validation_checks.passed.length + ".");
    renderResults(res);
  };
  $("btn-export-input").onclick = function () {
    saveStudentForm();
    var obj = state.mode === "group"
      ? { schema_version: "2.0", course_type: "group", group_name: state.group.group_name, group_id: state.group.group_id, students: state.students }
      : state.students[0];
    download((state.mode === "group" ? "group" : "individual") + "-case-input.json", JSON.stringify(obj, null, 2));
  };

  // ---------- results ----------
  function renderResults(res) {
    show("panel-results", true);
    var sum = $("results-summary"), act = $("results-actions"), det = $("results-detail");
    act.innerHTML = ""; det.innerHTML = "";
    function actBtn(label, fn, primary) {
      var b = document.createElement("button"); b.className = "btn" + (primary ? " primary" : ""); b.textContent = label; b.onclick = fn; act.appendChild(b);
    }
    if (state.mode === "group") {
      $("results-title").textContent = "Group results: " + res.group.group_name;
      var t = res.totals;
      var finalGroupTotal = t.final_planned_total == null ? t.constrained_total : t.final_planned_total;
      var groupStrategy = t.orientation_hours + t.final_review_hours + (t.additional_strategy_hours || 0);
      var limitLabel = t.minimum_allowed + " / " + t.maximum_allowed + " h";
      sum.innerHTML = statgrid([
        [t.english_group_hours + " h", "READING & WRITING"],
        [t.math_group_hours + " h", "MATH"],
        [groupStrategy + " h", "STRATEGY"],
        [finalGroupTotal + " h", "FINAL CORE LIVE PLAN"]]) +
        "<p class=\"hint\">Configured live-course range: " + limitLabel + ". Unrounded component total: " + t.final_component_total + " h = " + t.english_group_hours + " R&amp;W + " + t.math_group_hours + " Math + " + groupStrategy + " strategy. Final scheduled total after upward quarter-hour rounding: " + finalGroupTotal + " h. " + (t.homework_transfer_hours ? t.homework_transfer_hours + " h of repetition was moved to differentiated homework/workshops. " : "") + (t.supplemental_support_hours ? t.supplemental_support_hours + " h of student-specific need is listed separately as subgroup/individual support and is not counted in the core group total. " : "") + "Recommended: " + esc(res.schedule.recommended_weeks) + " weeks at " + res.schedule.sessions_per_week + " sessions/week.</p>" +
        (res.compatibility.split_recommended ? "<div class=\"msg warn\"><strong>Subgroups / individual support recommended:</strong> " + res.compatibility.split_reasons.map(esc).join("; ") + "</div>" : "<div class=\"msg ok\">No group-split trigger fired.</div>") +
        t.constraint_notes.map(function (n) { return "<div class=\"msg warn\">" + esc(n) + "</div>"; }).join("");
      actBtn("Open group report (print for PDF)", function () { openDoc(RP.renderGroupReport(res)); }, true);
      (function () { // the two-page parent report is individual-only: keep the button visible but disabled with an explanation
        var b = document.createElement("button");
        b.className = "btn"; b.type = "button"; b.textContent = "Create two page report";
        b.disabled = true; b.setAttribute("aria-disabled", "true");
        b.title = "The two-page parent report requires an individual student case. Load or create an individual case for one student to generate it.";
        act.appendChild(b);
      })();
      res.individual_results.forEach(function (r, i) {
        actBtn("Report: " + r.student.student_name, function () { openDoc(RP.renderIndividualReport(r, state.students[i])); });
        actBtn("Roadmap: " + r.student.student_name, function () { openRoadmap(state.students[i], r); });
      });
      actBtn("Print all individual roadmaps", function () {
        res.individual_results.forEach(function (r, i) { openRoadmap(state.students[i], r); });
      });
      actBtn("Export calculated JSON", function () { download("group-results.json", JSON.stringify(res, null, 2)); });
      det.innerHTML = groupLessonTable(res);
    } else {
      var r = res;
      $("results-title").textContent = "Results: " + r.student.student_name;
      var t2 = r.totals;
      var finalIndividualTotal = t2.final_planned_total == null ? t2.constrained_total : t2.final_planned_total;
      sum.innerHTML = statgrid([
        [t2.english_live_hours + " h", "READING & WRITING"],
        [t2.math_live_hours + " h", "MATH"],
        [t2.strategy_hours + " h", "STRATEGY"],
        [finalIndividualTotal + " h", "FINAL LIVE PLAN"]]) +
        "<p class=\"hint\">Unrounded component total: " + t2.final_component_total + " h = " + t2.english_live_hours + " R&amp;W + " + t2.math_live_hours + " Math + " + t2.strategy_hours + " strategy. Final scheduled total after upward quarter-hour rounding: " + finalIndividualTotal + " h. The actual components are budgeted inside 14–35 h. " + (t2.homework_transfer_hours ? t2.homework_transfer_hours + " h of repetition/remediation was moved to targeted homework during maximum-budget allocation. " : "") + "Homework (separate): " + t2.homework_total + " h. Recommended: " + esc(r.schedule.recommended_weeks) + " weeks at " + r.schedule.sessions_per_week + " sessions/week.</p>" +
        t2.constraint_notes.map(function (n) { return "<div class=\"msg warn\">" + esc(n) + "</div>"; }).join("");
      actBtn("Open detailed report (print for PDF)", function () { openDoc(RP.renderIndividualReport(r, state.students[0])); }, true);
      actBtn("Open seven-page roadmap (print for PDF)", function () { openRoadmap(state.students[0], r); }, true);
      actBtn("Create two page report", function () { createTwoPageReport(state.students[0], r); }, true);
      actBtn("Export calculated JSON", function () { download("individual-results.json", JSON.stringify(r, null, 2)); });
      actBtn("Export roadmap view-model JSON", function () {
        var vm = VM.buildRoadmapViewModel(state.students[0], r, CFG, { asset_base: "" });
        download("roadmap-view-model.json", JSON.stringify(vm, null, 2));
      });
      actBtn("Export lesson hours CSV", function () { download("lesson-hours.csv", lessonCsv(r)); });
      det.innerHTML = lessonTable(r);
    }
  }
  function statgrid(items) {
    return "<div class=\"statgrid\">" + items.map(function (it) {
      return "<div class=\"stat\"><div class=\"v\">" + it[0] + "</div><div class=\"l\">" + it[1] + "</div></div>";
    }).join("") + "</div>";
  }
  function lessonTable(r) {
    var h = "<div class=\"tablewrap\"><table><thead><tr><th>Lesson</th><th>Q</th><th>Wtd acc</th><th>Coverage</th><th>Base</th><th>Final ×</th><th>Initial calculated need</th><th>Moved to/from live budget</th><th>Final live hours</th><th>Sessions</th><th>Priority</th></tr></thead><tbody>";
    r.lesson_analysis.forEach(function (l) {
      var before = l.pre_constraint_hours == null ? l.final_hours : l.pre_constraint_hours;
      var adjustment = l.constraint_adjustment || 0;
      h += "<tr><td>" + esc(l.lesson_name) + (l.is_broad_lesson ? " <span style=\"color:#8a93a3\">(broad)</span>" : "") + "</td>" +
        "<td>" + l.questions_correct + "/" + l.questions_assessed + "</td><td>" + (l.weighted_accuracy == null ? "—" : l.weighted_accuracy + "%") + "</td>" +
        "<td>" + l.coverage_level.replace(/_/g, " ") + "</td><td>" + l.base_hours + "</td><td>" + l.final_multiplier + "</td>" +
        "<td>" + before + "</td><td>" + (adjustment > 0 ? "+" : "") + adjustment + "</td>" +
        "<td><strong>" + l.final_hours + "</strong></td><td>" + l.sessions.join(" + ") + "</td>" +
        "<td><span class=\"pill pr-" + l.priority + "\">" + l.priority.replace(/_/g, " ") + "</span></td></tr>";
    });
    return h + "</tbody></table></div>";
  }
  function groupLessonTable(res) {
    var h = "<div class=\"tablewrap\"><table><thead><tr><th>Lesson</th><th>Per-student h</th><th>Max need</th><th>Diversity</th><th>Initial calculated need</th><th>Core-budget transfer</th><th>Final core group h</th><th>Support outside core</th><th>Delivery</th></tr></thead><tbody>";
    res.lesson_analysis.forEach(function (l) {
      var before = l.pre_constraint_group_hours == null ? l.group_hours : l.pre_constraint_group_hours;
      var adjustment = l.constraint_adjustment || 0;
      h += "<tr><td>" + esc(l.lesson_name) + "</td><td>" + l.student_hours.join(" / ") + "</td><td>" + l.max_hours + "</td>" +
        "<td>" + l.diversity_classification.replace(/_/g, " ") + " (+" + Math.round(l.diversity_adjustment * 100) + "%)</td>" +
        "<td>" + before + "</td><td>" + (adjustment > 0 ? "+" : "") + adjustment + "</td>" +
        "<td><strong>" + l.group_hours + "</strong></td><td>" + (l.supplemental_support_hours || 0) + "</td>" +
        "<td>" + (l.subgroup_recommended ? "subgroups" : l.needs_differentiation ? "differentiate" : "whole group") + "</td></tr>";
    });
    return h + "</tbody></table></div>";
  }
  function lessonCsv(r) {
    var rows = [["lesson_id", "lesson_name", "section", "weighted_accuracy", "coverage", "base_hours", "final_multiplier", "pre_constraint_hours", "constraint_adjustment", "final_hours", "homework_transfer_hours", "priority"].join(",")];
    r.lesson_analysis.forEach(function (l) {
      rows.push([l.lesson_id, "\"" + l.lesson_name.replace(/"/g, "\"\"") + "\"", l.section, l.weighted_accuracy == null ? "" : l.weighted_accuracy, l.coverage_level, l.base_hours, l.final_multiplier, l.pre_constraint_hours == null ? l.final_hours : l.pre_constraint_hours, l.constraint_adjustment || 0, l.final_hours, l.live_hours_transferred_to_homework || 0, l.priority].join(","));
    });
    return rows.join("\n") + "\n";
  }
  function createTwoPageReport(input, results) {
    var check = T2.validateTwoPageCase(input, results);
    if (!check.ok) { note("err", check.message || "Load a valid individual student case before creating the two-page report."); return; }
    try {
      openDoc(T2.renderTwoPageDiagnosticReport(results, input));
    } catch (ex) {
      note("err", "Could not create the two-page report: " + ex.message);
    }
  }
  function openRoadmap(input, results) {
    var vm = VM.buildRoadmapViewModel(input, results, CFG, { asset_base: "" });
    openDoc(window.TP_RENDER_ROADMAP(vm));
  }
  function openDoc(html) {
    var w = window.open("", "_blank");
    if (!w) { note("err", "The browser blocked the popup. Allow popups for this page to open reports and roadmaps."); return; }
    // anchor relative asset URLs (assets/...) to the app folder
    html = html.replace("<head>", "<head><base href=\"" + document.baseURI + "\">");
    w.document.open(); w.document.write(html); w.document.close();
  }
  function download(name, text) {
    var blob = new Blob([text], { type: "application/octet-stream" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function readFile(f, cb) {
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { cb(r.result); };
    r.onerror = function () { note("err", "Could not read the file."); };
    r.readAsText(f);
  }
  function startNote(cls, msg) {
    var d = document.createElement("div"); d.className = "msg " + cls; d.textContent = msg;
    $("import-start-messages").appendChild(d);
  }
  function note(cls, msg) {
    var d = document.createElement("div"); d.className = "msg " + cls; d.textContent = msg;
    $("messages").appendChild(d);
    show("panel-calc", true);
  }
  function deep(o) { return JSON.parse(JSON.stringify(o)); }

  function hasPopulatedCase() {
    if (!state.mode || !state.students.length) return false;
    return state.students.some(function (s) {
      var scores = s.scores || {}, student = s.student || {}, diagnostic = s.diagnostic || {};
      return !!(student.student_name || student.student_id || (diagnostic.answers || []).length ||
        scores.reading_writing_scaled != null || scores.math_scaled != null || scores.total_scaled != null);
    });
  }

  function clearImportReview() {
    var box = $("elmy-import-review");
    if (!box) return;
    box.innerHTML = ""; box.classList.add("hidden");
  }

  function renderImportReview(parsed) {
    var box = $("elmy-import-review"), s = parsed.validation.summary;
    box.innerHTML = ""; box.classList.remove("hidden");
    var title = document.createElement("h3"); title.textContent = "Elmy import validation"; box.appendChild(title);
    var grid = document.createElement("div"); grid.className = "import-review-grid"; box.appendChild(grid);
    function item(label, value) {
      var d = document.createElement("div"); d.className = "import-review-item";
      var k = document.createElement("span"); k.className = "k"; k.textContent = label;
      var v = document.createElement("span"); v.className = "v"; v.textContent = value == null || value === "" ? "Not provided" : String(value);
      d.appendChild(k); d.appendChild(v); grid.appendChild(d);
    }
    item("Student", s.student_name);
    item("Attempt", s.attempt_number);
    item("Diagnostic date", s.diagnostic_date);
    item("Total score", s.total_score);
    item("Reading & Writing", s.reading_writing_score);
    item("Math", s.math_score);
    item("Answer records", s.answer_records + "/98");
    item("Answered", s.answered_questions + "/" + parsed.caseInput.diagnostic.reported_summary.answered_questions);
    item("Correct", s.correct_answers + "/" + parsed.caseInput.diagnostic.reported_summary.correct_answers);
    item("Global conversion", "Passed");
    item("Difficulty map", "22 easy · 35 medium · 41 hard");
    item("Case validation", "Passed");
    if (parsed.validation.warnings.length) {
      var details = document.createElement("details"), summary = document.createElement("summary"), list = document.createElement("ul");
      summary.textContent = parsed.validation.warnings.length + " source warning" + (parsed.validation.warnings.length === 1 ? "" : "s");
      parsed.validation.warnings.forEach(function (warning) { var li = document.createElement("li"); li.textContent = warning; list.appendChild(li); });
      details.appendChild(summary); details.appendChild(list); box.appendChild(details);
    }
  }

  function refreshAll() {
    show("panel-group", state.mode === "group");
    show("panel-student", !!state.mode);
    show("panel-answers", !!state.mode);
    show("panel-calc", !!state.mode);
    show("panel-results", false);
    if (state.mode === "group") renderRoster();
    if (state.mode) { loadStudentForm(); renderAnswers(); }
  }

  tplOptions();
})();
