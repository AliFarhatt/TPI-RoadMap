/* TestPrep detailed instructor / administrator report renderer v2.4
 * Clean academic layout, separate from the seven-page roadmap.
 * Contains NO calculation logic: it only presents engine output. */
(function (root) {
  "use strict";
  function e(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function nn(v, dash) { return v == null ? (dash || "\u2014") : v; }
  function pctS(v) { return v == null ? "\u2014" : v + "%"; }
  function covLabel(c) { return String(c || "").replace(/_/g, " "); }
  function prLabel(p) { return String(p || "").replace(/_/g, " "); }

  var CSS = [
    "*{box-sizing:border-box}",
    "html{-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    "body{margin:0;background:#f4f5f8;color:#14181f;font-family:'Inter',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55}",
    ".doc{max-width:980px;margin:0 auto;background:#fff;padding:34px 38px 60px}",
    "h1{font-size:26px;font-weight:600;margin:0 0 4px;color:#0c1730}",
    "h2{font-size:16px;font-weight:600;margin:30px 0 10px;color:#0c1730;border-top:2.5px solid #1740a9;padding-top:10px}",
    "h3{font-size:13px;font-weight:600;margin:16px 0 6px;color:#14181f}",
    "p{margin:0 0 8px;max-width:80ch}",
    ".kicker{font-size:9px;letter-spacing:0.2em;color:#c7560a;font-weight:600;margin-bottom:6px}",
    ".meta{color:#5a6373;font-size:11.5px;margin-bottom:2px}",
    "table{border-collapse:collapse;width:100%;font-size:10.5px;margin:10px 0}",
    ".wide{table-layout:fixed;font-size:7.4px;line-height:1.25}",
    ".wide th{font-size:6.8px;padding:3px 2px;letter-spacing:0}",
    ".wide td{padding:3px 2px;overflow-wrap:anywhere;word-break:break-word}",
    "th{background:#0c1730;color:#fff;text-align:left;padding:6px 7px;font-weight:600;font-size:9.5px;letter-spacing:0.04em}",
    "td{border-bottom:1px solid #e4e7ee;padding:5px 7px;vertical-align:top}",
    "tr:nth-child(even) td{background:#fbfcfe}",
    ".pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:9.5px;font-weight:600}",
    ".pr-CRITICAL{background:#fbe0d4;color:#9a2708}",
    ".pr-HIGH{background:#fbe6d4;color:#9a4708}",
    ".pr-MEDIUM{background:#dfe7f6;color:#1740a9}",
    ".pr-ESSENTIAL_REVIEW{background:#e2f2e9;color:#1f8a5b}",
    ".card{border:1px solid #e4e7ee;border-radius:12px;padding:13px 16px;margin:10px 0;break-inside:avoid}",
    ".warn{border-left:3px solid #ff963e;background:#fff7ef;padding:8px 12px;border-radius:0 8px 8px 0;margin:6px 0;font-size:11px}",
    ".err{border-left:3px solid #c0392b;background:#fdf0ee;padding:8px 12px;border-radius:0 8px 8px 0;margin:6px 0;font-size:11px}",
    ".ok{border-left:3px solid #1f8a5b;background:#f0f9f4;padding:8px 12px;border-radius:0 8px 8px 0;margin:6px 0;font-size:11px}",
    ".statgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}",
    ".stat{border:1px solid #e4e7ee;border-radius:10px;padding:10px 12px}",
    ".stat .v{font-size:20px;font-weight:600;color:#1740a9}",
    ".stat .l{font-size:9px;letter-spacing:0.1em;color:#8a93a3;margin-top:3px}",
    ".calc{background:#fbfcfe;border:1px solid #e4e7ee;border-radius:10px;padding:10px 14px;font-size:11px;margin:8px 0;break-inside:avoid}",
    ".footer{margin-top:36px;border-top:1px solid #e4e7ee;padding-top:10px;color:#8a93a3;font-size:10px}",
    "@page{size:A4;margin:12mm 10mm}",
    "@media print{body{background:#fff}.doc{max-width:none;padding:0} h2{break-after:avoid} tr{break-inside:avoid} .card,.calc{break-inside:avoid}}"
  ].join("\n");

  function shell(title, body) {
    return "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
      "<title>" + e(title) + "</title><style>" + CSS + "</style></head><body><div class=\"doc\">" + body +
      "<div class=\"footer\">TESTPREP \u00b7 HOUSE OF PREP \u00b7 Planning estimates derived from diagnostic evidence; instructor-adjustable, never a guaranteed score.</div>" +
      "</div></body></html>";
  }

  function msgList(list, cls) {
    if (!list || !list.length) return "";
    return list.map(function (m) { return "<div class=\"" + cls + "\">" + e(m.message || m) + "</div>"; }).join("");
  }

  // ---------------- individual report ----------------
  function renderIndividualReport(results, input) {
    var st = results.student || {};
    var t = results.totals;
    var eng = results.section_summaries.english, math = results.section_summaries.math;
    var b = [];

    b.push("<div class=\"kicker\">TESTPREP \u00b7 DIAGNOSTIC &amp; COURSE-PLANNING REPORT</div>");
    b.push("<h1>" + e(st.student_name) + "</h1>");
    b.push("<div class=\"meta\">" + e(results.diagnostic.template_name) + (results.diagnostic.date ? " \u00b7 " + e(results.diagnostic.date) : "") +
      (st.student_id ? " \u00b7 ID " + e(st.student_id) : "") + (st.grade_level ? " \u00b7 Grade " + e(st.grade_level) : "") + "</div>");

    // 1-2 overview + score summary
    b.push("<h2>1 \u00b7 Student overview &amp; diagnostic score summary</h2>");
    var sc = results.scores || {};
    b.push("<div class=\"statgrid\">" +
      stat(nn(sc.total_scaled), "TOTAL SCALED (SUPPLIED)") +
      stat(nn(results.goal && results.goal.target_sat_score), "TARGET SCORE") +
      stat(eng.questions_correct + "/" + eng.questions_assessed, "R&amp;W RAW (" + pctS(eng.raw_accuracy) + ")") +
      stat(math.questions_correct + "/" + math.questions_assessed, "MATH RAW (" + pctS(math.raw_accuracy) + ")") + "</div>");
    if (sc.reading_writing_scaled != null || sc.math_scaled != null) {
      b.push("<p class=\"meta\">Scaled scores were supplied manually (score_source: " + e(sc.score_source || "provided") + "). Scaled scores are never estimated from raw accuracy.</p>");
    }
    b.push(msgList(results.errors, "err") + msgList(results.warnings, "warn") + msgList(results.info, "ok"));

    // 3-4 section summaries
    b.push("<h2>2 \u00b7 Section performance</h2>");
    [["Reading &amp; Writing", eng], ["Math", math]].forEach(function (pair) {
      var s = pair[1];
      b.push("<div class=\"card\"><h3 style=\"margin-top:0\">" + pair[0] + "</h3>" +
        "<p>" + s.questions_correct + " of " + s.questions_assessed + " assessed questions correct (raw " + pctS(s.raw_accuracy) +
        ", weighted " + pctS(s.weighted_accuracy) + "). Planned live instruction: <strong>" + s.live_hours + " h</strong>.</p></div>");
    });

    // 5 question-level findings
    b.push("<h2>3 \u00b7 Question-level findings</h2>");
    b.push("<p class=\"meta\">Module B carries weight 1.20 vs 1.00 for Module 1. Difficulty labels remain descriptive metadata and do not change question weight in v2.4. Error types are claimed only when the evidence supports them.</p>");
    b.push("<table><tr><th>Sec</th><th>Module</th><th>#</th><th>Lesson</th><th>Subskill</th><th>Ans / Key</th><th>Result</th><th>Wt</th><th>Time</th><th>Error type</th><th>Interpretation</th></tr>");
    results.question_analysis.forEach(function (q) {
      b.push("<tr><td>" + (q.section === "english" ? "E" : "M") + "</td><td>" + (q.module === "module_b" ? "B" : "1") + "</td><td>" + q.question_number + "</td>" +
        "<td>" + e(shortLesson(q.lesson_id)) + "</td><td>" + e(q.subskill_id || "") + "</td>" +
        "<td>" + e(nn(q.student_answer, "blank")) + " / " + e(nn(q.correct_answer, "?")) + "</td>" +
        "<td>" + (q.correct === null ? "\u2014" : q.correct ? "\u2713" : "\u2717") + "</td>" +
        "<td>" + q.weight + "</td><td>" + (q.time_seconds != null ? q.time_seconds + "s" : "\u2014") + "</td>" +
        "<td>" + e(q.error_type ? q.error_type.replace(/_/g, " ") : "") + "</td><td>" + e(q.interpretation) + "</td></tr>");
    });
    b.push("</table>");

    // 6 lesson-hour table
    b.push("<h2>4 \u00b7 Lesson-hour table (all 28 lessons)</h2>");
    b.push("<table><tr><th>Lesson</th><th>Q</th><th>Raw</th><th>Wtd acc</th><th>Coverage</th><th>B/D/S</th><th>Base</th><th>Perf x</th><th>Floor</th><th>Final x</th><th>Found.</th><th>+Sub</th><th>+Time</th><th>+1400</th><th>+Ovr</th><th>Calculated</th><th>Final live hours</th><th>Sessions</th><th>Priority</th></tr>");
    results.lesson_analysis.forEach(function (l) {
      b.push("<tr><td><strong>" + e(l.lesson_name) + "</strong>" + (l.is_broad_lesson ? " <span style=\"color:#8a93a3\">(broad)</span>" : "") + "</td>" +
        "<td>" + l.questions_correct + "/" + l.questions_assessed + "</td><td>" + pctS(l.raw_accuracy) + "</td><td>" + pctS(l.weighted_accuracy) + "</td>" +
        "<td>" + covLabel(l.coverage_level) + "</td><td>" + l.breadth_score + "/" + l.difficulty_score + "/" + l.strategy_score + " = " + l.base_hour_score + "</td>" +
        "<td>" + l.base_hours + "</td><td>" + nn(l.performance_multiplier) + "</td><td>" + l.coverage_floor + "</td><td>" + l.final_multiplier + "</td>" +
        "<td>" + (l.foundational_level === "none" ? "\u2014" : l.foundational_level + " (" + l.foundational_multiplier + ")") + "</td>" +
        "<td>" + (l.subskill_adjustment || "\u2014") + "</td><td>" + (l.timing_adjustment || "\u2014") + "</td><td>" + (l.high_target_adjustment || "\u2014") + "</td><td>" + (l.teacher_override_adjustment || "\u2014") + "</td>" +
        "<td>" + l.unrounded_hours + "</td><td><strong>" + l.final_hours + "</strong></td>" +
        "<td>" + l.sessions.join(" + ") + "</td><td><span class=\"pill pr-" + l.priority + "\">" + prLabel(l.priority) + "</span></td></tr>");
      b.push("<tr><td colspan=\"19\" style=\"color:#5a6373;background:#fff\">" + e(l.explanation) +
        (l.weak_subskill_clusters.length ? " Weak subskill cluster(s): " + e(l.weak_subskill_clusters.join(", ")) + "." : "") +
        (l.mini_assessment_recommended ? " Mini-assessment (5\u201310 min) recommended at lesson start." : "") + "</td></tr>");
    });
    b.push("</table>");

    // 7-8 example calculations
    b.push("<h2>5 \u00b7 Example calculations (audit trail)</h2>");
    var exE = pickExample(results.lesson_analysis, "english");
    var exM = pickExample(results.lesson_analysis, "math");
    [exE, exM].forEach(function (l) { if (l) b.push(calcCard(l)); });

    // 9 course total
    b.push('<h2>6 \u00b7 Course total</h2>');
    b.push('<div class="statgrid">' +
      stat(t.english_live_hours + ' h', 'FINAL READING &amp; WRITING') + stat(t.math_live_hours + ' h', 'FINAL MATH') +
      stat(t.strategy_hours + ' h', 'FINAL STRATEGY') +
      stat('<strong>' + (t.final_planned_total == null ? t.constrained_total : t.final_planned_total) + ' h</strong>', 'FINAL LIVE PLAN') + '</div>');
    b.push('<p>Unrounded live components: <strong>' + t.final_component_total + ' h</strong> = R&amp;W ' + t.english_live_hours + ' h + Math ' + t.math_live_hours + ' h + strategy ' + t.strategy_hours + ' h. ' +
      'Final scheduled plan after one course-level quarter-hour rounding: <strong>' + (t.final_planned_total == null ? t.constrained_total : t.final_planned_total) + ' h</strong>' + (t.final_rounding_adjustment ? ' (rounding adjustment ' + (t.final_rounding_adjustment > 0 ? '+' : '') + t.final_rounding_adjustment + ' h)' : '') + '. The unrounded components are budgeted inside the 14\u201335 h program range. ' + (t.hours_added ? 'Added ' + t.hours_added + ' h to explicit components to meet the 14 h program minimum. ' : '') + (t.hours_removed ? t.hours_removed + ' h of repetition/remediation was moved to targeted homework so the actual component sum remains at or below 35 h. ' : '') + '</p>');
    t.constraint_notes.forEach(function (n) { b.push('<div class="warn">' + e(n) + '</div>'); });
    if (t.constraint_allocation && t.constraint_allocation.length) {
      b.push('<h3>Live-hour budget audit</h3><p class="meta">This audit shows how the initial calculated need was converted into the final live components. The component sum is retained to two decimals; only the final scheduled total is rounded upward to the next quarter hour.</p><table><tr><th>Component</th><th>Initial need</th><th>Live-budget transfer</th><th>Final live time</th><th>Action</th></tr>');
      t.constraint_allocation.forEach(function (a) { b.push('<tr><td>' + e(a.label) + '</td><td>' + a.before_hours + ' h</td><td>' + (a.adjustment_hours > 0 ? '+' : '') + a.adjustment_hours + ' h</td><td><strong>' + a.after_hours + ' h</strong></td><td>' + e((a.action || '').replace(/_/g, ' ')) + '</td></tr>'); });
      b.push('</table>');
    }
    b.push('<h3>Strategy hours, itemized</h3><p>' + t.strategy_components.filter(function (c) { return c.hours > 0; }).map(function (c) { return e(c.name) + ' ' + c.hours + ' h'; }).join(' \u00b7 ') + ' = <strong>' + t.strategy_hours + ' h</strong>. Every strategy adjustment is part of the displayed final total.</p>');

    // 10 homework
    b.push("<h2>7 \u00b7 Homework recommendation (separate from live teaching)</h2>");
    b.push("<table><tr><th>Lesson</th><th>Priority</th><th>Suggested homework</th></tr>");
    results.homework.forEach(function (h) {
      b.push("<tr><td>" + e(h.lesson_name) + "</td><td>" + prLabel(h.priority) + "</td><td>" + h.hours_min + "\u2013" + h.hours_max + " h</td></tr>");
    });
    b.push('</table><p>Estimated homework total: <strong>' + t.homework_total + ' h</strong> (R&amp;W ' + t.homework_english + ' h, Math ' + t.homework_math + ' h). This includes ' + t.homework_transfer_hours + ' h explicitly transferred from live instruction when the maximum course limit was applied. Homework may include skill drills, timed sets, error corrections, mixed review, vocabulary and grammar drills, Desmos practice, practice modules, and full practice tests. Full-length practice-test completion time is not counted as live teaching.</p>');

    // 11-12 duration & schedule
    b.push("<h2>8 \u00b7 Course duration &amp; session schedule</h2>");
    b.push("<p>Recommended duration: <strong>" + e(results.schedule.recommended_weeks) + " weeks</strong> at ~" + results.schedule.sessions_per_week + " sessions/week (normal session length 1\u20132 h; no lesson exceeds 2.5 h in one session; longer lessons are split as shown in the table). Adjust for the test date, availability, school workload, and homework recovery time.</p>");

    // 13-16 strengths / priorities / untested
    b.push("<h2>9 \u00b7 Strengths, priorities, and evidence limits</h2>");
    b.push("<h3>Strengths</h3><p>" + (results.strengths.length ? results.strengths.map(function (s) { return e(s.lesson_name) + " (" + s.weighted_accuracy + "%, " + covLabel(s.coverage_level) + " coverage)"; }).join("; ") : "The diagnostic provides limited evidence of established strengths; the mini-assessments will refine this.") + "</p>");
    b.push("<h3>Priority areas</h3><p>" + results.priority_areas.map(function (p) { return e(p.lesson_name) + " (" + prLabel(p.priority) + (p.weighted_accuracy != null ? ", " + p.weighted_accuracy + "%" : "") + ")"; }).join("; ") + "</p>");
    b.push("<h3>Not assessed by this diagnostic</h3><p>" + (results.untested_lessons.length ? results.untested_lessons.map(shortLesson).join(", ") + ". Performance is unknown: full base hours are retained and a short mini-assessment opens each of these lessons." : "None.") + "</p>");
    b.push("<h3>Limited coverage (under-tested)</h3><p>" + (results.undertested_lessons.length ? results.undertested_lessons.map(shortLesson).join(", ") + ". The diagnostic provides limited evidence for these lessons, so no time reduction is applied." : "None.") + "</p>");
    var ep = Object.keys(results.error_patterns);
    b.push("<h3>Error patterns</h3><p>" + (ep.length ? ep.map(function (k) { return e(k.replace(/_/g, " ")) + " \u00d7" + results.error_patterns[k]; }).join(" \u00b7 ") : "No recurring error pattern recorded.") + "</p>");

    // 17-18 validation
    b.push("<h2>10 \u00b7 Validation results</h2>");
    results.validation_checks.passed.forEach(function (c) { b.push("<div class=\"ok\">\u2713 " + e(c) + "</div>"); });
    results.validation_checks.failed.forEach(function (c) { b.push("<div class=\"err\">\u2717 " + e(c) + "</div>"); });

    // 19 interpretation
    b.push("<h2>11 \u00b7 Final interpretation</h2><p>" + e(results.final_interpretation) + "</p>");
    return shell("Instructor report \u2013 " + (st.student_name || "Student"), b.join("\n"));
  }

  function stat(v, l) { return "<div class=\"stat\"><div class=\"v\">" + v + "</div><div class=\"l\">" + l + "</div></div>"; }
  function shortLesson(id) { return String(id).replace(/^ENG_|^MATH_/, "").split("_").map(function (w) { return w.charAt(0) + w.slice(1).toLowerCase(); }).join(" "); }
  function pickExample(lessons, sec) {
    var ls = lessons.filter(function (l) { return l.section === sec; });
    var assessed = ls.filter(function (l) { return l.coverage_level !== "not_assessed"; });
    return (assessed.sort(function (a, b) { return b.questions_assessed - a.questions_assessed; })[0]) || ls[0];
  }
  function calcCard(l) {
    return "<div class=\"calc\"><strong>" + e(l.lesson_name) + "</strong> (" + l.section + ")<br>" +
      "Calibrated base hours: " + l.base_hours + " (rubric profile: breadth " + l.breadth_score + ", difficulty " + l.difficulty_score + ", strategy " + l.strategy_score + "; profile score " + l.base_hour_score + ")<br>" +
      "Weighted accuracy: " + pctS(l.weighted_accuracy) + " \u2192 performance multiplier " + nn(l.performance_multiplier) + "<br>" +
      "Coverage: " + covLabel(l.coverage_level) + " \u2192 floor " + l.coverage_floor + " \u2192 final multiplier max(" + nn(l.performance_multiplier, "\u2013") + ", " + l.coverage_floor + ") = " + l.final_multiplier + "<br>" +
      (l.foundational_level === "none"
        ? "Core hours: " + l.base_hours + " \u00d7 " + l.final_multiplier + " = " + l.core_hours + " (no foundational override)<br>"
        : "Core hours: max(" + l.base_hours + " \u00d7 " + l.final_multiplier + ", " + l.base_hours + " \u00d7 " + l.foundational_multiplier + ") = " + l.core_hours + "<br>") +
      "Adjustments: subskill +" + l.subskill_adjustment + ", timing +" + l.timing_adjustment + ", high-target +" + l.high_target_adjustment + ", override +" + l.teacher_override_adjustment + "<br>" +
      "Unrounded calculation: " + l.unrounded_hours + " \u2192 minimum " + l.minimum_applied + " \u2192 retained without lesson rounding: <strong>" + l.pre_constraint_hours + " h</strong>" +
      (l.constraint_adjustment ? "<br>Live-budget allocation: " + l.pre_constraint_hours + " h " + (l.constraint_adjustment > 0 ? "+ " : "\u2212 ") + Math.abs(l.constraint_adjustment) + " h = <strong>" + l.final_hours + " h final</strong>" : "") + "</div>";
  }

  // ---------------- group report ----------------
  function renderGroupReport(results) {
    var b = [];
    var g = results.group, t = results.totals, c = results.compatibility;
    b.push("<div class=\"kicker\">TESTPREP \u00b7 GROUP DIAGNOSTIC &amp; COURSE-PLANNING REPORT</div>");
    b.push("<h1>" + e(g.group_name) + "</h1>");
    b.push("<div class=\"meta\">" + g.size + " students \u00b7 size bucket " + e(g.size_bucket) + " \u00b7 size adjustment " + Math.round(t.size_adjustment * 100) + "%</div>");
    b.push(msgList(results.errors, "err") + msgList(results.warnings, "warn"));

    b.push("<h2>1 \u00b7 Group overview</h2>");
    b.push("<div class=\"statgrid\">" +
      stat(t.english_group_hours + " h", "FINAL READING &amp; WRITING") +
      stat(t.math_group_hours + " h", "FINAL MATH") +
      stat((t.orientation_hours + t.final_review_hours + (t.additional_strategy_hours || 0)) + ' h', 'FINAL STRATEGY') +
      stat('<strong>' + (t.final_planned_total == null ? t.constrained_total : t.final_planned_total) + ' h</strong>', 'FINAL CORE LIVE PLAN') + "</div>");
    t.constraint_notes.forEach(function (n) { b.push("<div class=\"warn\">" + e(n) + "</div>"); });
    if (results.delivery.large_group) results.delivery.notes.forEach(function (n) { b.push("<div class=\"warn\">" + e(n) + "</div>"); });

    b.push("<h2>2 \u00b7 Individual student summaries</h2>");
    b.push("<table><tr><th>Student</th><th>R&amp;W raw</th><th>Math raw</th><th>Individual total</th><th>Top priorities</th></tr>");
    results.individual_results.forEach(function (r) {
      b.push("<tr><td><strong>" + e(r.student.student_name) + "</strong></td>" +
        "<td>" + r.section_summaries.english.questions_correct + "/" + r.section_summaries.english.questions_assessed + "</td>" +
        "<td>" + r.section_summaries.math.questions_correct + "/" + r.section_summaries.math.questions_assessed + "</td>" +
        "<td>" + (r.totals.final_planned_total == null ? r.totals.constrained_total : r.totals.final_planned_total) + " h</td>" +
        "<td>" + r.priority_areas.slice(0, 3).map(function (p) { return e(p.lesson_name); }).join("; ") + "</td></tr>");
    });
    b.push("</table><p class=\"meta\">Every student received a complete individual calculation first; each also receives a separate detailed report and seven-page roadmap.</p>");

    b.push("<h2>3 \u00b7 Compatibility analysis</h2>");
    b.push("<p>Individual totals range " + c.lowest_individual_total + "\u2013" + c.highest_individual_total + " h (average " + c.average_individual_total + " h; spread " + c.spread_percent + "%). Highly different lessons: " + c.highly_different_lessons + " of 28.</p>");
    if (c.split_recommended) {
      b.push("<div class=\"warn\"><strong>Subgroup / support recommended:</strong> " + c.split_reasons.map(e).join("; ") + ".</div>");
      if (c.subgroup_recommendation) {
        b.push("<div class=\"card\"><h3 style=\"margin-top:0\">Suggested subgroup composition</h3>" +
          "<p>Group A (foundational support): " + e(c.subgroup_recommendation.group_a_foundational.join(", ") || "\u2014") + "<br>" +
          "Group B (standard instruction): " + e(c.subgroup_recommendation.group_b_standard.join(", ") || "\u2014") + "<br>" +
          "Group C (advanced / 1400+ practice): " + e(c.subgroup_recommendation.group_c_advanced.join(", ") || "\u2014") + "</p>" +
          "<p class=\"meta\">" + e(c.subgroup_recommendation.note) + "</p></div>");
      }
    } else {
      b.push("<div class=\"ok\">No split trigger fired: the group can be served together with lesson-level differentiation where flagged below.</div>");
    }

    b.push("<h2>4 \u00b7 Lesson-by-lesson group table</h2>");
    b.push("<table class=\"wide\"><tr><th>Lesson</th><th>Per-student h</th><th>Min</th><th>Max</th><th>Avg</th><th>Med</th><th>SD</th><th>Acc lo/avg/hi</th><th>Shared weak</th><th>% remed.</th><th>Diversity</th><th>+Div</th><th>Formula raw</th><th>Initial calculated need</th><th>Final core group h</th><th>Support outside core</th><th>Sessions</th><th>Delivery</th></tr>");
    results.lesson_analysis.forEach(function (l) {
      b.push("<tr><td><strong>" + e(l.lesson_name) + "</strong></td>" +
        "<td>" + l.student_hours.join(" / ") + "</td><td>" + l.min_hours + "</td><td>" + l.max_hours + "</td><td>" + l.avg_hours + "</td><td>" + l.median_hours + "</td><td>" + nn(l.hours_stddev) + "</td>" +
        "<td>" + pctS(l.lowest_weighted_accuracy) + " / " + pctS(l.avg_weighted_accuracy) + " / " + pctS(l.highest_weighted_accuracy) + "</td>" +
        "<td>" + (l.shared_weak_subskills.join(", ") || "\u2014") + "</td><td>" + l.pct_requiring_remediation + "%</td>" +
        "<td>" + covLabel(l.diversity_classification) + "</td><td>" + Math.round(l.diversity_adjustment * 100) + "%</td>" +
        '<td>' + l.raw_group_hours + '</td><td>' + l.pre_constraint_group_hours + '</td><td><strong>' + l.group_hours + '</strong></td><td>' + (l.supplemental_support_hours || 0) + '</td><td>' + l.sessions.join(' + ') + '</td>' +
        "<td>" + (l.subgroup_recommended ? "subgroups" : l.needs_differentiation ? "differentiate" : "whole group") + "</td></tr>");
      b.push("<tr><td colspan=\"18\" style=\"color:#5a6373;background:#fff\">" + e(l.explanation) + "</td></tr>");
    });
    b.push("</table>");

    b.push('<h2>5 \u00b7 Group calculation example</h2>');
    var ex = results.lesson_analysis.slice().sort(function (a, b2) { return b2.max_hours - a.max_hours; })[0];
    b.push('<div class="calc"><strong>' + e(ex.lesson_name) + '</strong><br>' +
      'Highest justified individual need: ' + ex.max_hours + ' h<br>' +
      'Group-size adjustment: ' + Math.round(ex.size_adjustment * 100) + '% \u00b7 Lesson diversity: ' + covLabel(ex.diversity_classification) + ' (+' + Math.round(ex.diversity_adjustment * 100) + '%)<br>' +
      ex.max_hours + ' \u00d7 (1 + ' + ex.size_adjustment + ' + ' + ex.diversity_adjustment + ') = ' + ex.raw_group_hours + ' h \u2192 retained without lesson rounding: <strong>' + ex.pre_constraint_group_hours + ' h</strong><br>' +
      (ex.constraint_adjustment ? 'Live-budget allocation: ' + ex.pre_constraint_group_hours + ' h ' + (ex.constraint_adjustment > 0 ? '+ ' : '\u2212 ') + Math.abs(ex.constraint_adjustment) + ' h = <strong>' + ex.group_hours + ' h final core</strong>' + (ex.supplemental_support_hours ? '; ' + ex.supplemental_support_hours + ' h assigned outside the core as subgroup/individual support' : '') + '<br>' : '') +
      'Budget rule: the common core never falls below the validated whole-group lesson minimum. Any higher student-specific need moved out of the core is recorded as subgroup/individual support.</div>');

    b.push("<h2>6 \u00b7 Delivery plan</h2>");
    var whole = results.lesson_analysis.filter(function (l) { return l.whole_group_suitable; });
    var diff = results.lesson_analysis.filter(function (l) { return l.needs_differentiation && !l.subgroup_recommended; });
    var sub = results.lesson_analysis.filter(function (l) { return l.subgroup_recommended; });
    b.push("<h3>Whole-group lessons (" + whole.length + ")</h3><p>" + (whole.map(function (l) { return e(l.lesson_name); }).join("; ") || "\u2014") + "</p>");
    b.push("<h3>Lessons needing differentiated practice (" + diff.length + ")</h3><p>" + (diff.map(function (l) { return e(l.lesson_name); }).join("; ") || "\u2014") + "</p>");
    b.push("<h3>Lessons needing subgroup work (" + sub.length + ")</h3><p>" + (sub.map(function (l) { return e(l.lesson_name); }).join("; ") || "\u2014") + "</p>");
    b.push("<p>Mixed-level lessons combine whole-group core instruction, differentiated guided practice, ability-based question sets, short subgroup activities, targeted homework, and individual support where necessary.</p>");

    b.push("<h2>7 \u00b7 Group total &amp; validation</h2>");
    b.push('<p>Final scheduled core plan: <strong>' + (t.final_planned_total == null ? t.constrained_total : t.final_planned_total) + ' h</strong>. The unrounded core component total is <strong>' + t.final_component_total + ' h</strong> = English ' + t.english_group_hours + ' h + Math ' + t.math_group_hours + ' h + orientation ' + t.orientation_hours + ' h + final review ' + t.final_review_hours + ' h' + (t.additional_strategy_hours ? ' + additional strategy ' + t.additional_strategy_hours + ' h' : '') + '. Only the final group total is rounded upward to the next 0.25 hour. The actual core components remain inside the configured ' + t.minimum_allowed + '–' + t.maximum_allowed + ' h range. ' +
      (t.hours_added ? '+' + t.hours_added + ' h was assigned to explicit core components. ' : '') + (t.homework_transfer_hours ? t.homework_transfer_hours + ' h of group repetition was transferred to differentiated practice. ' : '') + (t.supplemental_support_hours ? t.supplemental_support_hours + ' h of student-specific need is scheduled separately as subgroup/individual support and is not counted in the core total. ' : '') + '</p>');
    if (t.constraint_allocation && t.constraint_allocation.length) {
      b.push('<h3>Group live-hour budget audit</h3><table><tr><th>Component</th><th>Initial need</th><th>Core-budget transfer</th><th>Final core time</th><th>Action</th></tr>');
      t.constraint_allocation.forEach(function (a) { b.push('<tr><td>' + e(a.label) + '</td><td>' + a.before_hours + ' h</td><td>' + (a.adjustment_hours > 0 ? '+' : '') + a.adjustment_hours + ' h</td><td><strong>' + a.after_hours + ' h</strong></td><td>' + e((a.action || '').replace(/_/g, ' ')) + '</td></tr>'); });
      b.push('</table>');
    }
    results.validation_checks.passed.forEach(function (cc) { b.push("<div class=\"ok\">\u2713 " + e(cc) + "</div>"); });
    results.validation_checks.failed.forEach(function (cc) { b.push("<div class=\"err\">\u2717 " + e(cc) + "</div>"); });

    b.push("<h2>8 \u00b7 Homework &amp; practice plan</h2>");
    b.push("<p>Each student keeps their individual homework plan (see their individual report). Group-level: shared drills for shared weak subskills, differentiated sets where diversity is flagged, an error log reviewed at each session, and full practice tests scheduled outside live hours.</p>");

    b.push("<h2>9 \u00b7 Final interpretation</h2><p>" + e(results.final_interpretation) + "</p>");
    return shell("Group report \u2013 " + g.group_name, b.join("\n"));
  }

  var api = { renderIndividualReport: renderIndividualReport, renderGroupReport: renderGroupReport };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TP_REPORT = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
