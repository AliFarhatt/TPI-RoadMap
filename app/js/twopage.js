/* TestPrep two-page teacher & parent diagnostic summary v2.4
 * Renders a concise, print-ready A4 report of EXACTLY two pages from an
 * individual engine result. Contains no course-planning content (no hours,
 * schedules, or roadmap material) — it is a diagnostic summary only.
 * Like report.js it presents engine output; the only calculations performed
 * here are simple descriptive aggregations (counts and accuracies) over the
 * engine's question_analysis records. */
(function (root) {
  "use strict";

  // ---------------- small utilities ----------------
  function e(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function normDifficulty(v) {
    var d = String(v == null ? "" : v).trim().toLowerCase();
    return (d === "easy" || d === "medium" || d === "hard") ? d : null;
  }
  function pct(v) { return v == null ? null : Math.round(v * 100); }
  function pctLabel(v) { return v == null ? "\u2014" : Math.round(v * 100) + "%"; }
  function safeText(v, fallback) {
    if (v == null) return fallback;
    var s = String(v).trim();
    if (!s || s === "undefined" || s === "null" || s === "NaN") return fallback;
    return s;
  }

  // ---------------- validation ----------------
  function validateTwoPageCase(input, results) {
    if (!input || !results) {
      return { ok: false, message: "Load a valid individual student case before creating the two-page report." };
    }
    if (results.group || results.individual_results || (input && input.course_type === "group")) {
      return { ok: false, message: "The two-page parent report requires an individual student case. Open a student's individual case (or their individual report from the group results) instead." };
    }
    var qa = results.question_analysis;
    if (!qa || !qa.length) {
      return { ok: false, message: "Load a valid individual student case with recorded diagnostic answers before creating the two-page report." };
    }
    return { ok: true, message: "" };
  }

  // ---------------- descriptive aggregations ----------------
  function categoryStats(records) {
    var total = records.length;
    var correct = records.filter(function (q) { return q.correct === true; }).length;
    var answered = records.filter(function (q) { return q.student_answer !== null && q.student_answer !== undefined && q.student_answer !== ""; }).length;
    return {
      total: total, correct: correct, answered: answered,
      accuracy: total > 0 ? correct / total : null,
      completion: total > 0 ? answered / total : null
    };
  }

  function createSectionPerformanceData(answers) {
    return [
      { key: "english", label: "Reading and Writing", stats: categoryStats(answers.filter(function (q) { return q.section === "english"; })) },
      { key: "math", label: "Math", stats: categoryStats(answers.filter(function (q) { return q.section === "math"; })) }
    ];
  }

  function createModulePerformanceData(answers) {
    var defs = [
      ["english", "module_1", "Reading and Writing \u00b7 Module 1"],
      ["english", "module_b", "Reading and Writing \u00b7 Module B"],
      ["math", "module_1", "Math \u00b7 Module 1"],
      ["math", "module_b", "Math \u00b7 Module B"]
    ];
    return defs.map(function (d) {
      return { section: d[0], module: d[1], label: d[2], stats: categoryStats(answers.filter(function (q) { return q.section === d[0] && q.module === d[1]; })) };
    });
  }

  /* Section × difficulty accuracy matrix for the page-2 heat map.
   * Rows: Reading and Writing, Math. Columns: easy, medium, hard.
   * Every cell keeps its exact counts so the heat map never relies on color alone. */
  function createSectionDifficultyMatrix(answers) {
    var sections = [["english", "Reading and Writing"], ["math", "Math"]];
    var levels = ["easy", "medium", "hard"];
    var labelled = answers.filter(function (q) { return normDifficulty(q.difficulty) !== null; });
    return {
      available: labelled.length > 0,
      columns: levels.map(function (d) { return d.charAt(0).toUpperCase() + d.slice(1); }),
      rows: sections.map(function (s) {
        return {
          section: s[0], label: s[1],
          cells: levels.map(function (d) {
            return { difficulty: d, stats: categoryStats(labelled.filter(function (q) {
              return q.section === s[0] && normDifficulty(q.difficulty) === d;
            })) };
          })
        };
      })
    };
  }

  function createDifficultyPerformanceData(answers) {
    var groups = { easy: [], medium: [], hard: [] };
    var withDifficulty = 0;
    answers.forEach(function (q) {
      var d = normDifficulty(q.difficulty);
      if (d) { groups[d].push(q); withDifficulty++; }
    });
    return {
      available: withDifficulty > 0,
      labelled_records: withDifficulty,
      total_records: answers.length,
      levels: ["easy", "medium", "hard"].map(function (d) {
        return { key: d, label: d.charAt(0).toUpperCase() + d.slice(1), stats: categoryStats(groups[d]) };
      })
    };
  }

  // ---------------- strengths & priorities (lesson level) ----------------
  var MIN_MAPPED_QUESTIONS = 2;

  function assessedLessons(lessonAnalysis) {
    return (lessonAnalysis || []).filter(function (l) {
      return l && l.questions_assessed >= MIN_MAPPED_QUESTIONS && l.raw_accuracy != null;
    });
  }

  function rankDiagnosticStrengths(lessonAnalysis, count) {
    var ls = assessedLessons(lessonAnalysis).slice().sort(function (a, b) {
      return (b.raw_accuracy - a.raw_accuracy) ||
        (b.questions_assessed - a.questions_assessed) ||
        String(a.lesson_name).localeCompare(String(b.lesson_name));
    });
    return ls.slice(0, count == null ? 3 : count);
  }

  function rankDiagnosticPriorities(lessonAnalysis, count) {
    var prOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, ESSENTIAL_REVIEW: 3 };
    var ls = assessedLessons(lessonAnalysis).slice().sort(function (a, b) {
      var missedA = a.questions_assessed - a.questions_correct;
      var missedB = b.questions_assessed - b.questions_correct;
      return (a.raw_accuracy - b.raw_accuracy) ||
        (missedB - missedA) ||
        (b.questions_assessed - a.questions_assessed) ||
        ((prOrder[a.priority] != null ? prOrder[a.priority] : 9) - (prOrder[b.priority] != null ? prOrder[b.priority] : 9)) ||
        String(a.lesson_name).localeCompare(String(b.lesson_name));
    });
    return ls.slice(0, count == null ? 3 : count);
  }

  function strengthComment(l) {
    var acc = l.raw_accuracy;
    if (acc >= 90) return "Performance in this area was consistently accurate across the mapped diagnostic questions.";
    if (acc >= 75) return "The student answered most mapped questions in this area correctly, which appears to be a relative strength.";
    return "This area was comparatively stronger than others on this diagnostic, though there is still room to consolidate it.";
  }
  function priorityComment(l) {
    var missed = l.questions_assessed - l.questions_correct;
    var base;
    if (l.raw_accuracy <= 34) base = "Most mapped questions in this area were missed, so it should be an early instructional focus.";
    else if (l.raw_accuracy <= 59) base = "Roughly half of the mapped questions in this area were missed; targeted review and guided practice are recommended.";
    else base = "Several questions in this area were missed; a focused review should help close the remaining gap.";
    return base + " Revisit the underlying concepts, then rebuild confidence with a short mixed practice set (" + missed + " missed of " + l.questions_assessed + " assessed).";
  }

  // ---------------- interpretation ----------------
  function generateDiagnosticSummary(d) {
    var out = [];
    var engAcc = pct(d.sections[0].stats.accuracy), mathAcc = pct(d.sections[1].stats.accuracy);
    if (engAcc != null && mathAcc != null) {
      var diff = engAcc - mathAcc;
      if (Math.abs(diff) < 5) out.push("Performance was relatively balanced across Reading and Writing and Math.");
      else out.push("The student performed more strongly in " + (diff > 0 ? "Reading and Writing" : "Math") + " than in " + (diff > 0 ? "Math" : "Reading and Writing") + " on this diagnostic.");
    } else if (engAcc != null || mathAcc != null) {
      out.push("Only one section provides enough recorded answers for a section-level comparison on this diagnostic.");
    }

    var da = d.difficulty;
    if (da.available) {
      var easy = da.levels[0].stats, hard = da.levels[2].stats;
      if (easy.accuracy != null && hard.accuracy != null) {
        var gap = pct(easy.accuracy) - pct(hard.accuracy);
        if (gap >= 15) out.push("Performance decreased as question difficulty increased, which is a common and addressable pattern.");
        else if (gap <= 5) out.push("The student maintained relatively consistent performance across difficulty levels.");
        else out.push("Accuracy declined moderately on harder questions.");
      }
    }

    var comp = d.overall.completion;
    if (comp != null) {
      var cp = pct(comp);
      if (cp >= 95) out.push("The student completed nearly the full diagnostic.");
      else if (cp >= 80) out.push("Several questions were left unanswered and should be reviewed to determine whether the cause was timing, uncertainty, or unfinished work.");
      else out.push("A significant number of questions were unanswered, so these results should be interpreted alongside completion and pacing.");
    }
    return out.slice(0, 3).join(" ");
  }

  function generateDiagnosticRecommendations(d) {
    var recs = [];
    if (d.priorities.length) {
      var p0 = d.priorities[0];
      recs.push("Begin targeted review with the highest-priority area, " + p0.lesson_name + ", before moving on to mixed practice.");
    } else {
      recs.push("Use a short follow-up assessment to gather more evidence before setting instructional priorities.");
    }
    var da = d.difficulty;
    if (da.available && da.levels[2].stats.total > 0 && da.levels[2].stats.accuracy != null && da.levels[0].stats.accuracy != null && pct(da.levels[0].stats.accuracy) - pct(da.levels[2].stats.accuracy) >= 15) {
      recs.push("Add gradual practice on harder questions while maintaining accuracy on foundational and medium-level questions.");
    } else if (d.strengths.length) {
      recs.push("Maintain the strongest areas, such as " + d.strengths[0].lesson_name + ", with light periodic review rather than new instruction.");
    } else {
      recs.push("Balance review time across sections so stronger areas are maintained while weaker areas are rebuilt.");
    }
    if (d.overall.completion != null && pct(d.overall.completion) < 95) {
      recs.push("Revisit the unanswered questions together to identify whether the issue was time management, uncertainty, or missing content knowledge.");
    } else {
      recs.push("Review the missed questions together and ask the student to explain each corrected answer in their own words.");
    }
    return recs.slice(0, 3);
  }

  // ---------------- report data ----------------
  function attemptNumberFrom(input) {
    var d = (input && input.diagnostic) || {};
    var cand = d.attempt_number != null ? d.attempt_number : (d.attempt != null ? d.attempt : (input && input.attempt_number));
    if (cand == null) return null;
    var n = parseInt(cand, 10);
    return isNaN(n) ? safeText(cand, null) : n;
  }

  function buildTwoPageReportFilename(studentName, attemptNumber) {
    var slug = String(studentName == null ? "" : studentName).trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "student";
    var attempt = attemptNumber == null ? "" : String(attemptNumber).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug + (attempt ? "_attempt-" + attempt : "") + "_two-page-diagnostic-report";
  }

  function buildTwoPageDiagnosticData(input, results) {
    var qa = results.question_analysis || [];
    var st = results.student || {};
    var sc = results.scores || {};
    var d = {
      student_name: safeText(st.student_name, "Student"),
      assessment_title: safeText(results.diagnostic && results.diagnostic.template_name, "SAT Diagnostic"),
      diagnostic_date: safeText(results.diagnostic && results.diagnostic.date, "Date not provided"),
      attempt_number: attemptNumberFrom(input),
      scores: {
        total: sc.total_scaled != null ? sc.total_scaled : null,
        english: sc.reading_writing_scaled != null ? sc.reading_writing_scaled : null,
        math: sc.math_scaled != null ? sc.math_scaled : null
      },
      overall: categoryStats(qa),
      sections: createSectionPerformanceData(qa),
      modules: createModulePerformanceData(qa),
      difficulty: createDifficultyPerformanceData(qa),
      matrix: createSectionDifficultyMatrix(qa),
      strengths: rankDiagnosticStrengths(results.lesson_analysis, 3),
      priorities: rankDiagnosticPriorities(results.lesson_analysis, 3)
    };
    d.attempt_label = d.attempt_number == null ? "Attempt not provided" : "Attempt " + d.attempt_number;
    d.filename = buildTwoPageReportFilename(d.student_name, d.attempt_number);
    d.summary = generateDiagnosticSummary(d);
    d.recommendations = generateDiagnosticRecommendations(d);
    return d;
  }

  // ---------------- rendering ----------------
  var CSS = [
    "*{box-sizing:border-box;margin:0;padding:0}",
    "html{-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    "body{background:#e9ebf1;color:#14181f;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.45}",
    ".toolbar{max-width:190mm;margin:10px auto 0;display:flex;justify-content:flex-end}",
    ".toolbar button{border:1px solid #1740a9;background:#1740a9;color:#fff;font:600 12.5px 'Inter',Arial,sans-serif;padding:9px 16px;border-radius:9px;cursor:pointer}",
    ".toolbar button:hover{background:#2f5bc4}",
    ".toolbar button:focus-visible{outline:2px solid #0c1730;outline-offset:2px}",
    /* fixed page containers: exactly two, sized to the printable A4 area */
    ".pg{width:190mm;height:272mm;overflow:hidden;background:#fff;margin:10px auto;padding:9mm 8mm;display:block;position:relative}",
    "@media screen{.pg{box-shadow:0 2px 14px rgba(12,23,48,0.12);border-radius:6px}}",
    ".pg.page-1{page-break-after:always;break-after:page}",
    ".pg.page-2{page-break-after:auto;break-after:auto}",
    "@page{size:A4 portrait;margin:12mm 10mm}",
    "@media print{body{background:#fff}.toolbar{display:none}.pg{margin:0;padding:0 0 0 0;box-shadow:none;border-radius:0;width:auto;height:272mm}}",
    /* header */
    ".band{border-top:3px solid #ff963e;border-bottom:1px solid #e4e7ee;padding:6px 0 10px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:flex-end;gap:12px}",
    ".kicker{font-size:7.5pt;letter-spacing:0.2em;color:#c7560a;font-weight:600;margin-bottom:4px}",
    "h1{font-size:16pt;font-weight:600;color:#0c1730;line-height:1.15}",
    ".sub{font-size:8.5pt;color:#5a6373;margin-top:2px}",
    ".idblock{text-align:right;font-size:8.5pt;color:#5a6373;white-space:nowrap}",
    ".idblock .name{font-size:11pt;font-weight:600;color:#0c1730}",
    "h2{font-size:10.5pt;font-weight:600;color:#0c1730;border-top:2px solid #1740a9;padding-top:5px;margin:10px 0 6px}",
    "h2 .n{color:#8a93a3;font-weight:600;margin-right:6px}",
    /* score cards */
    ".cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
    ".card{border:1px solid #e4e7ee;border-radius:8px;padding:8px 10px;background:#fbfcfe}",
    ".card .v{font-size:17pt;font-weight:600;color:#1740a9;line-height:1.1}",
    ".card .v.na{font-size:10pt;color:#8a93a3;padding:5px 0}",
    ".card .l{font-size:7pt;letter-spacing:0.12em;color:#8a93a3;margin-top:3px;font-weight:600}",
    ".cards4{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}",
    ".mini{border:1px solid #e4e7ee;border-radius:8px;padding:6px 9px}",
    ".mini .v{font-size:11.5pt;font-weight:600;color:#0c1730}",
    ".mini .l{font-size:6.8pt;letter-spacing:0.1em;color:#8a93a3;margin-top:2px;font-weight:600}",
    /* bars */
    ".bars{display:flex;flex-direction:column;gap:6px;margin:4px 0 2px}",
    ".bar{display:grid;grid-template-columns:58mm 1fr 30mm;align-items:center;gap:8px;font-size:8.5pt}",
    ".bar .lab{color:#14181f;font-weight:600}",
    ".bar .val{text-align:right;color:#5a6373;font-variant-numeric:tabular-nums}",
    ".track{height:9px;background:#eef0f4;border-radius:999px;overflow:hidden;border:1px solid #e4e7ee}",
    ".fill{display:block;height:100%;background:#1740a9;border-radius:999px}",    ".fill.alt{background:#ff963e}",
    ".fill.mid{background:#2f5bc4}",
    ".note{font-size:8pt;color:#5a6373}",
    /* section x difficulty heat map */
    ".heat{width:100%;border-collapse:separate;border-spacing:3px;margin:4px 0 2px;table-layout:fixed}",
    ".heat th{font-size:7.5pt;font-weight:600;color:#5a6373;letter-spacing:0.06em;text-align:center;padding:2px}",
    ".heat th.rowh{text-align:left;width:44mm;color:#14181f;font-size:8.5pt;letter-spacing:0}",
    ".heat td{border-radius:6px;text-align:center;padding:6px 4px;border:1px solid #e4e7ee}",
    ".heat td .hp{font-size:11pt;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums}",
    ".heat td .hc{font-size:7pt;margin-top:1px;font-variant-numeric:tabular-nums}",
    ".heat td.h-none{background:#fbfcfe;color:#8a93a3}",
    ".summary{border-left:3px solid #1740a9;background:#f5f7fc;border-radius:0 8px 8px 0;padding:7px 10px;font-size:9pt;margin-top:8px}",
    /* strengths/priorities */
    ".area{border:1px solid #e4e7ee;border-radius:8px;padding:7px 10px;margin:5px 0;break-inside:avoid}",
    ".area .head{display:flex;justify-content:space-between;gap:10px;font-size:9pt;font-weight:600;color:#0c1730}",
    ".area .head .num{color:#1740a9;font-variant-numeric:tabular-nums;white-space:nowrap}",
    ".area p{font-size:8.5pt;color:#5a6373;margin-top:2px}",
    ".area.strength{border-left:3px solid #1f8a5b}",
    ".area.priority{border-left:3px solid #c7560a}",
    "ul.recs{margin:2px 0 0 14px;font-size:9pt}",
    "ul.recs li{margin:3px 0}",
    ".unavail{border:1px dashed #e4e7ee;border-radius:8px;padding:10px;color:#8a93a3;font-size:9pt}",
    ".footer{position:absolute;left:8mm;right:8mm;bottom:6mm;border-top:1px solid #e4e7ee;padding-top:4px;display:flex;justify-content:space-between;font-size:7.5pt;color:#8a93a3}",
    "@media print{.footer{left:0;right:0}}"
  ].join("\n");

  function bar(label, stats, fillClass) {
    var p = stats.accuracy == null ? 0 : Math.max(0, Math.min(100, pct(stats.accuracy)));
    var val = stats.total > 0 ? stats.correct + "/" + stats.total + " \u2014 " + pctLabel(stats.accuracy) : "No questions recorded";
    return "<div class=\"bar\"><span class=\"lab\">" + e(label) + "</span>" +
      "<span class=\"track\"><span class=\"fill " + (fillClass || "") + "\" style=\"width:" + p + "%\"></span></span>" +
      "<span class=\"val\">" + e(val) + "</span></div>";
  }

  /* Accuracy shading: 5 ordered steps from light to dark so the pattern also
   * survives grayscale printing; exact counts stay printed in every cell. */
  function heatCell(stats) {
    if (stats.total === 0) return "<td class=\"h-none\"><span class=\"hp\">\u2014</span><div class=\"hc\">no questions</div></td>";
    var p = pct(stats.accuracy);
    var steps = [
      [40, "#f2f5fb", "#0c1730"],   // < 40%: lightest
      [55, "#d9e2f4", "#0c1730"],
      [70, "#a9bde8", "#0c1730"],
      [85, "#5d7fd0", "#ffffff"],
      [101, "#1740a9", "#ffffff"]   // >= 85%: darkest
    ];
    var bg = steps[steps.length - 1][1], fg = steps[steps.length - 1][2];
    for (var i = 0; i < steps.length; i++) { if (p < steps[i][0]) { bg = steps[i][1]; fg = steps[i][2]; break; } }
    return "<td style=\"background:" + bg + ";color:" + fg + "\"><span class=\"hp\">" + p + "%</span>" +
      "<div class=\"hc\">" + stats.correct + "/" + stats.total + " correct</div></td>";
  }

  function renderHeatMap(matrix) {
    var h = ["<table class=\"heat\" aria-label=\"Accuracy by section and question difficulty\">"];
    h.push("<tr><th class=\"rowh\"></th>" + matrix.columns.map(function (c) { return "<th>" + e(c.toUpperCase()) + "</th>"; }).join("") + "</tr>");
    matrix.rows.forEach(function (row) {
      h.push("<tr><th class=\"rowh\">" + e(row.label) + "</th>" + row.cells.map(function (c) { return heatCell(c.stats); }).join("") + "</tr>");
    });
    h.push("</table>");
    h.push("<p class=\"note\">Darker cells indicate higher accuracy; each cell also shows the exact result, so the map remains readable in grayscale.</p>");
    return h.join("");
  }

  function footer(d, page) {
    return "<div class=\"footer\"><span>" + e(d.student_name) + " \u00b7 " + e(d.attempt_label) + " \u00b7 Page " + page + " of 2</span>" +
      "<span>Generated by TestPrep SAT Roadmap Master</span></div>";
  }

  function header(d) {
    return "<div class=\"band\"><div>" +
      "<div class=\"kicker\">TESTPREP \u00b7 HOUSE OF PREP</div>" +
      "<h1>SAT Diagnostic Summary</h1>" +
      "<div class=\"sub\">Two-Page Teacher and Parent Report \u00b7 " + e(d.assessment_title) + " \u00b7 " + e(d.diagnostic_date) + "</div>" +
      "</div><div class=\"idblock\"><div class=\"name\">" + e(d.student_name) + "</div><div>" + e(d.attempt_label) + "</div></div></div>";
  }

  function scoreCard(v, label) {
    return "<div class=\"card\">" + (v == null ? "<div class=\"v na\">Not provided</div>" : "<div class=\"v\">" + e(v) + "</div>") +
      "<div class=\"l\">" + label + "</div></div>";
  }

  function renderPageOne(d) {
    var b = [];
    b.push(header(d));

    b.push("<h2><span class=\"n\">1</span>Score summary</h2>");
    b.push("<div class=\"cards\">" +
      scoreCard(d.scores.total, "TOTAL SAT SCORE") +
      scoreCard(d.scores.english, "READING AND WRITING") +
      scoreCard(d.scores.math, "MATH") + "</div>");
    b.push("<p class=\"note\" style=\"margin-top:4px\">Scaled scores are supplied with the diagnostic and are never estimated from raw accuracy.</p>");

    var o = d.overall;
    b.push("<h2><span class=\"n\">2</span>Attempt summary</h2>");
    b.push("<div class=\"cards4\">" +
      "<div class=\"mini\"><div class=\"v\">" + o.correct + "</div><div class=\"l\">CORRECT ANSWERS</div></div>" +
      "<div class=\"mini\"><div class=\"v\">" + o.answered + "</div><div class=\"l\">ANSWERED QUESTIONS</div></div>" +
      "<div class=\"mini\"><div class=\"v\">" + o.total + "</div><div class=\"l\">TOTAL QUESTIONS</div></div>" +
      "<div class=\"mini\"><div class=\"v\">" + pctLabel(o.accuracy) + "</div><div class=\"l\">OVERALL ACCURACY</div></div>" +
      "<div class=\"mini\"><div class=\"v\">" + pctLabel(o.completion) + "</div><div class=\"l\">COMPLETION RATE</div></div>" +
      "</div>");
    b.push("<p class=\"note\" style=\"margin-top:4px\">Overall accuracy counts correct answers out of all " + o.total + " administered diagnostic questions; completion counts how many of them were answered.</p>");

    b.push("<h2><span class=\"n\">3</span>Section performance</h2>");
    b.push("<div class=\"bars\">" + d.sections.map(function (s) { return bar(s.label, s.stats, ""); }).join("") + "</div>");

    b.push("<h2><span class=\"n\">4</span>Module performance</h2>");
    b.push("<div class=\"bars\">" + d.modules.map(function (m, i) { return bar(m.label, m.stats, i < 2 ? "mid" : "alt"); }).join("") + "</div>");
    b.push("<p class=\"note\" style=\"margin-top:4px\">Each SAT section has two modules; question counts restart in each module.</p>");

    b.push("<h2><span class=\"n\">5</span>What this diagnostic suggests</h2>");
    b.push("<div class=\"summary\">" + e(d.summary) + "</div>");

    b.push(footer(d, 1));
    return "<section class=\"pg two-page-report-page page-1\">" + b.join("\n") + "</section>";
  }

  function renderPageTwo(d) {
    var b = [];
    b.push(header(d));

    b.push("<h2><span class=\"n\">6</span>Performance by question difficulty</h2>");
    if (d.difficulty.available) {
      b.push("<div class=\"bars\">" + d.difficulty.levels.map(function (lv, i) {
        var cls = i === 0 ? "" : i === 1 ? "mid" : "alt";
        var label = lv.label + " (" + lv.stats.total + " question" + (lv.stats.total === 1 ? "" : "s") + ")";
        return bar(label, lv.stats, cls);
      }).join("") + "</div>");
      if (d.difficulty.labelled_records < d.difficulty.total_records) {
        b.push("<p class=\"note\" style=\"margin-top:4px\">Difficulty labels were available for " + d.difficulty.labelled_records + " of " + d.difficulty.total_records + " recorded questions; this chart uses only the labelled questions.</p>");
      }
    } else {
      b.push("<div class=\"unavail\">Difficulty-level performance is unavailable for this diagnostic.</div>");
    }

    if (d.matrix.available) {
      b.push("<h2><span class=\"n\">7</span>Accuracy heat map \u00b7 section \u00d7 difficulty</h2>");
      b.push(renderHeatMap(d.matrix));
    }
    b.push("<h2><span class=\"n\">" + (d.matrix.available ? 8 : 7) + "</span>Strongest areas</h2>");
    if (d.strengths.length) {
      d.strengths.forEach(function (l) {
        b.push("<div class=\"area strength\"><div class=\"head\"><span>" + e(l.lesson_name) + "</span>" +
          "<span class=\"num\">" + l.questions_correct + " of " + l.questions_assessed + " correct \u2014 " + l.raw_accuracy + "%</span></div>" +
          "<p>" + e(strengthComment(l)) + "</p></div>");
      });
    } else {
      b.push("<div class=\"unavail\">Insufficient mapped questions to identify reliable strengths on this diagnostic.</div>");
    }

    b.push("<h2><span class=\"n\">" + (d.matrix.available ? 9 : 8) + "</span>Priority areas</h2>");
    if (d.priorities.length) {
      d.priorities.forEach(function (l) {
        b.push("<div class=\"area priority\"><div class=\"head\"><span>" + e(l.lesson_name) + "</span>" +
          "<span class=\"num\">" + l.questions_correct + " of " + l.questions_assessed + " correct \u2014 " + l.raw_accuracy + "%</span></div>" +
          "<p>" + e(priorityComment(l)) + "</p></div>");
      });
    } else {
      b.push("<div class=\"unavail\">Insufficient mapped questions to identify reliable priorities on this diagnostic.</div>");
    }

    b.push("<h2><span class=\"n\">" + (d.matrix.available ? 10 : 9) + "</span>Recommended next steps</h2>");
    b.push("<ul class=\"recs\">" + d.recommendations.map(function (r) { return "<li>" + e(r) + "</li>"; }).join("") + "</ul>");

    b.push(footer(d, 2));
    return "<section class=\"pg two-page-report-page page-2\">" + b.join("\n") + "</section>";
  }

  function renderTwoPageDiagnosticReport(results, input) {
    var d = buildTwoPageDiagnosticData(input, results);
    return "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
      "<title>" + e(d.filename) + "</title><style>" + CSS + "</style></head><body>" +
      "<div class=\"toolbar\"><button type=\"button\" onclick=\"window.print()\" aria-label=\"Print or save this two-page report as a PDF\">Print / Save as PDF</button></div>" +
      renderPageOne(d) + "\n" + renderPageTwo(d) +
      "</body></html>";
  }

  var api = {
    validateTwoPageCase: validateTwoPageCase,
    buildTwoPageDiagnosticData: buildTwoPageDiagnosticData,
    renderTwoPageDiagnosticReport: renderTwoPageDiagnosticReport,
    createSectionPerformanceData: createSectionPerformanceData,
    createModulePerformanceData: createModulePerformanceData,
    createDifficultyPerformanceData: createDifficultyPerformanceData,
    createSectionDifficultyMatrix: createSectionDifficultyMatrix,
    rankDiagnosticStrengths: rankDiagnosticStrengths,
    rankDiagnosticPriorities: rankDiagnosticPriorities,
    generateDiagnosticSummary: generateDiagnosticSummary,
    generateDiagnosticRecommendations: generateDiagnosticRecommendations,
    buildTwoPageReportFilename: buildTwoPageReportFilename,
    normalizeDifficulty: normDifficulty
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TP_TWOPAGE = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
