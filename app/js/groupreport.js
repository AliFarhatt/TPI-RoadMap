/* Exact three-page shared-group diagnostic and roadmap report renderer. */
(function (root) {
  "use strict";
  function e(v) { return v == null ? "" : String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function safe(v, fallback) { return v == null || v === "" || v !== v ? fallback : String(v); }
  function percent(v) { return v == null ? "—" : Math.round(v * 1000) / 10 + "%"; }
  function pp(v) { return v == null ? "—" : Math.round(v * 1000) / 10 + " pp"; }
  function score(v) { return v == null ? "Not provided" : String(Math.round(v)); }
  function slug(v) { return String(v || "group").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "group"; }
  function priorityLabel(v) { return String(v || "").replace(/_/g," "); }
  function sectionLabel(v) { return v === "english" ? "R&W" : "Math"; }
  function compactDate(v) { return safe(v, "Date not provided"); }

  function bar(label, data, accent) {
    var width = data && data.accuracy != null ? Math.max(0, Math.min(100, data.accuracy * 100)) : 0;
    var counts = data && data.administered ? data.correct + "/" + data.administered : "Not assessed";
    return '<div class="barrow"><div class="barlabel"><b>' + e(label) + '</b><span>' + e(counts) + ' · ' + e(data && data.accuracy != null ? percent(data.accuracy) : "—") + '</span></div><div class="track"><i style="width:' + width + '%;background:' + accent + '"></i></div></div>';
  }
  function scoreCard(label, s) {
    return '<div class="scorecard"><div class="eyebrow">' + e(label) + '</div><div class="scorevalue">' + e(score(s.mean)) + '</div><div class="scorerange">Range: ' + (s.n ? e(Math.round(s.min) + "–" + Math.round(s.max)) : "Not provided") + '</div><div class="samplesize">n=' + s.n + '</div></div>';
  }
  function lessonLine(item, kind) {
    var acc = item.accuracy == null ? "Not assessed" : percent(item.accuracy);
    var interpretation = kind === "strength" ? "Use as an anchor for transfer and timed rehearsal." : (item.priority === "CRITICAL" ? "Rebuild the core concept with guided examples." : "Teach explicitly, then check transfer with mixed practice.");
    return '<div class="area"><div><span class="area-title">' + e(item.lesson_name) + '</span><span class="mini-pill">' + e(kind === "strength" ? "STRENGTH" : priorityLabel(item.priority)) + '</span></div><div class="area-metric">' + e(item.correct + "/" + item.administered + " · " + acc + " · " + item.students_represented + " students") + '</div><p>' + e(interpretation) + '</p></div>';
  }
  function warningsBlock(result, limit) {
    var notes = [];
    (result.excluded_students || []).forEach(function (x) { notes.push(x.student_name + " excluded — " + x.reason); });
    if (result.similarity.level === "high") notes.push("High group variation: " + result.similarity.flags.map(function (x) { return x.label; }).join(", ") + ". Use tiered practice while keeping the shared core lesson.");
    (result.warnings || []).filter(function (w) { return w.code === "MISSING_SCALED_SCORES"; }).forEach(function (w) { notes.push(w.message); });
    if (!notes.length) notes.push("No material group-data limitation was identified.");
    return '<div class="warning-list">' + notes.slice(0, limit || 5).map(function (n) { return '<div class="warning">' + e(n) + '</div>'; }).join("") + '</div>';
  }

  var CSS = [
    '*{box-sizing:border-box}',
    'html{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#dfe4ec}',
    'body{margin:0;color:#101725;font-family:Arial,Helvetica,sans-serif;font-size:9.2px;line-height:1.28;background:#dfe4ec}',
    '.group-report-page{position:relative;width:210mm;height:297mm;margin:8mm auto;background:#fff;padding:11mm 12mm 10mm;overflow:hidden;page-break-after:always;break-after:page}',
    '.group-report-page:last-child{page-break-after:auto;break-after:auto}',
    '.mast{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.2px solid #0c1730;padding-bottom:4mm;margin-bottom:4mm}',
    '.brand{font-size:8px;font-weight:700;letter-spacing:.18em;color:#1740a9}',
    '.kicker{font-size:7px;font-weight:700;letter-spacing:.18em;color:#c7560a;margin-bottom:1.5mm}',
    'h1{font-size:22px;line-height:1;margin:0 0 1.5mm;color:#0c1730;letter-spacing:-.03em}',
    '.subtitle{font-size:9px;color:#5d6677}',
    '.meta{text-align:right;color:#5d6677;font-size:8px;line-height:1.45;max-width:60mm}',
    'h2{font-size:12px;margin:4mm 0 2mm;color:#0c1730;border-left:3px solid #ff963e;padding-left:2.5mm}',
    'h3{font-size:9px;margin:0 0 1mm;color:#0c1730}',
    'p{margin:1mm 0;color:#4e596b}',
    '.scores{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}',
    '.scorecard{border:1px solid #dce2ec;border-radius:3mm;padding:3mm;background:linear-gradient(135deg,#fff,#f5f8fd);position:relative}',
    '.eyebrow{font-size:6.5px;letter-spacing:.12em;font-weight:700;color:#6a7485}',
    '.scorevalue{font-size:22px;font-weight:700;color:#1740a9;line-height:1.05;margin:1mm 0}',
    '.scorerange{font-size:7.5px;color:#303a4b}.samplesize{position:absolute;right:2.5mm;top:2.5mm;color:#7d8798;font-size:6.5px}',
    '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.grid32{display:grid;grid-template-columns:1.18fr .82fr;gap:4mm}',
    '.card{border:1px solid #dce2ec;border-radius:3mm;padding:3mm;break-inside:avoid;background:#fff}',
    '.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:1.5mm}',
    '.metric{background:#f3f6fb;border-radius:2mm;padding:2mm;text-align:center}.metric b{display:block;font-size:13px;color:#0c1730}.metric span{font-size:6.2px;letter-spacing:.08em;color:#687385}',
    '.status{display:flex;align-items:center;gap:3mm;padding:3mm;border-radius:2.5mm;background:#eef3fc;border-left:4px solid #1740a9;margin-bottom:2mm}.status.high{background:#fff3e9;border-color:#e16d22}.status b{font-size:13px}.status span{color:#5c6676}',
    '.sdgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5mm}.sd{border:1px solid #e2e6ed;border-radius:2mm;padding:2mm}.sd b{display:block;font-size:10px}.sd span{font-size:6.5px;color:#6a7484}',
    '.barrow{margin:2mm 0}.barlabel{display:flex;justify-content:space-between;gap:3mm;font-size:7.5px}.barlabel span{color:#626d7e}.track{height:3.2mm;background:#e7ebf1;border-radius:99px;overflow:hidden;margin-top:.8mm}.track i{display:block;height:100%;border-radius:99px}',
    'table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#0c1730;color:#fff;font-size:6.2px;letter-spacing:.05em;text-align:left;padding:1.35mm}td{font-size:6.8px;padding:1.15mm 1.35mm;border-bottom:1px solid #e5e9ef;vertical-align:top}tr:nth-child(even) td{background:#f8fafc}',
    '.student-table th:nth-child(1){width:31%}.student-table th:not(:first-child){width:17.25%}',
    '.excluded{margin-top:2mm;padding:2mm;border-radius:2mm;background:#fff5ed;color:#8e3d0b;font-size:7px}',
    '.area{border-bottom:1px solid #e4e8ef;padding:2mm 0}.area:last-child{border:0}.area-title{font-weight:700;font-size:8px;margin-right:2mm}.mini-pill{font-size:5.8px;font-weight:700;background:#e7edf9;color:#1740a9;border-radius:99px;padding:.6mm 1.5mm}.area-metric{font-size:6.7px;color:#6a7484;margin-top:.6mm}.area p{font-size:7px;margin:.6mm 0}',
    '.variation{padding:2.2mm;border-radius:2mm;background:#fff7ef;border-left:3px solid #ff963e;margin:1.6mm 0}.variation b{display:block}.variation span{color:#5f6876}',
    '.course-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:1.5mm}.course-summary .metric b{font-size:11px}',
    '.roadmap-table th:nth-child(1){width:25%}.roadmap-table th:nth-child(2){width:8%}.roadmap-table th:nth-child(3){width:10%}.roadmap-table th:nth-child(4){width:8%}.roadmap-table th:nth-child(5){width:8%}.roadmap-table th:nth-child(6){width:41%}',
    '.roadmap-table td{font-size:5.85px;padding:.72mm 1mm;line-height:1.12}.roadmap-table .diff{color:#a7460d;font-weight:700}',
    '.explain{font-size:7.2px;background:#eef3fc;border-radius:2mm;padding:2.2mm;margin-top:2mm;color:#3e4a5d}',
    '.recommendations{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}.rec{border-top:2px solid #1740a9;padding:2mm;background:#f7f9fc;font-size:7px}',
    '.warning-list{display:grid;gap:1mm}.warning{font-size:6.7px;background:#fff5ed;border-left:2px solid #e16d22;padding:1.5mm 2mm}',
    '.footer{position:absolute;bottom:4.5mm;left:12mm;right:12mm;display:flex;justify-content:space-between;border-top:1px solid #dfe4ec;padding-top:1.5mm;font-size:6px;color:#7a8494;letter-spacing:.04em}',
    '@page{size:A4;margin:0}',
    '@media print{html,body{background:#fff}.group-report-page{margin:0;box-shadow:none}}'
  ].join("");

  function renderThreePageGroupReport(result) {
    if (!result || !result.ok || !result.roadmap) throw new Error("Load a valid group case with at least two eligible students before creating a group report.");
    var g = result.group, scores = result.score_statistics, pooled = result.pooled;
    var roster = result.student_snapshots.slice(0, 10);
    var rosterRows = roster.map(function (s) {
      return '<tr><td><b>' + e(s.student_name) + '</b></td><td>' + e(score(s.total_score)) + '</td><td>' + e(score(s.reading_writing_score)) + '</td><td>' + e(score(s.math_score)) + '</td><td>' + e(percent(s.overall_accuracy)) + '</td></tr>';
    }).join("");
    if (result.student_snapshots.length > roster.length) rosterRows += '<tr><td colspan="5">' + e(result.student_snapshots.length - roster.length) + ' additional valid students included in all calculations.</td></tr>';
    var excluded = result.excluded_students.length ? '<div class="excluded"><b>Excluded:</b> ' + result.excluded_students.map(function (x) { return e(x.student_name + " — " + x.reason); }).join(" · ") + '</div>' : '';
    var sim = result.similarity;
    var sd = result.variation;
    var topVariations = result.variation_flags.slice(0, 4);
    var sequenceRows = result.roadmap.lesson_sequence.map(function (l) {
      var p = pooled.lessons[l.lesson_id];
      var rationale = (p.administered ? p.correct + "/" + p.administered + " pooled (" + percent(p.accuracy) + "). " : "Not assessed. ") + (l.priority === "CRITICAL" ? "Foundational rebuild and guided practice." : l.priority === "HIGH" ? "Explicit instruction and checked practice." : l.priority === "MEDIUM" ? "Targeted instruction and transfer practice." : "Concise review and SAT application.");
      if (l.needs_differentiation) rationale += " Mixed readiness: tier the practice.";
      return '<tr><td><b>' + e(l.lesson_name) + '</b></td><td>' + e(sectionLabel(l.section)) + '</td><td>' + e(priorityLabel(l.priority)) + '</td><td>' + e(p.accuracy == null ? "—" : percent(p.accuracy)) + '</td><td><b>' + e(l.group_hours) + '</b></td><td class="' + (l.needs_differentiation ? "diff" : "") + '">' + e(rationale) + '</td></tr>';
    }).join("");
    var missingScoreWarnings = (result.warnings || []).filter(function (w) { return w.code === "MISSING_SCALED_SCORES"; });
    var title = slug(g.group_name) + "_three-page-group-report";

    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + e(title) + '</title><style>' + CSS + '</style></head><body>' +
      '<section class="group-report-page page-1"><div class="mast"><div><div class="kicker">TESTPREP · GROUP DIAGNOSTIC</div><h1>SAT Group Diagnostic Summary</h1><div class="subtitle">Three-Page Group Performance and Roadmap Report</div></div><div class="meta"><b>' + e(g.group_name) + '</b><br>' + e(g.assessment_title) + '<br>' + e(g.season) + ' · ' + e(compactDate(g.diagnostic_date_range)) + '<br>' + e(g.valid_student_count) + ' valid · ' + e(g.excluded_student_count) + ' excluded</div></div>' +
      '<div class="scores">' + scoreCard("AVERAGE TOTAL SCORE", scores.total) + scoreCard("AVERAGE READING & WRITING", scores.reading_writing) + scoreCard("AVERAGE MATH", scores.math) + '</div>' +
      '<h2>Group completion and pooled accuracy</h2><div class="metrics"><div class="metric"><b>' + pooled.overall.correct + '</b><span>CORRECT</span></div><div class="metric"><b>' + pooled.overall.administered + '</b><span>ADMINISTERED</span></div><div class="metric"><b>' + pooled.overall.answered + '</b><span>ANSWERED</span></div><div class="metric"><b>' + percent(pooled.overall.accuracy) + '</b><span>POOLED ACCURACY</span></div><div class="metric"><b>' + percent(pooled.overall.completion) + '</b><span>COMPLETION</span></div></div>' +
      '<h2>Similarity summary</h2><div class="status ' + e(sim.level) + '"><b>Performance similarity: ' + e(sim.label) + '</b><span>' + (sim.level === "high" ? "At least one major measure reaches the high-variation threshold; the shared roadmap remains appropriate with tiered practice." : sim.level === "moderate" ? "Most core instruction can remain common, with targeted differentiation in flagged areas." : "The available major measures remain below the moderate-variation thresholds.") + '</span></div>' +
      '<div class="sdgrid"><div class="sd"><b>' + e(score(scores.total.sd)) + '</b><span>TOTAL-SCORE SD · n=' + scores.total.n + '</span></div><div class="sd"><b>' + e(score(scores.reading_writing.sd)) + '</b><span>R&W SD · n=' + scores.reading_writing.n + '</span></div><div class="sd"><b>' + e(score(scores.math.sd)) + '</b><span>MATH SD · n=' + scores.math.n + '</span></div><div class="sd"><b>' + e(pp(sd.overall_accuracy.sd)) + '</b><span>OVERALL-ACCURACY SD · n=' + sd.overall_accuracy.n + '</span></div></div>' +
      '<div class="grid32"><div><h2>Section comparison</h2>' + bar("Reading and Writing", pooled.sections.english, "#1740a9") + bar("Math", pooled.sections.math, "#ff963e") + '</div><div><h2>Variation note</h2><div class="warning">' + e(sim.level === "high" ? "The group has high variation in " + sim.flags.map(function (x) { return x.label; }).join(", ") + ". Use tiered practice after common instruction." : "No major high-variation threshold is reached. Continue to monitor lesson-level readiness.") + '</div></div></div>' +
      '<h2>Summarized student snapshot</h2><table class="student-table"><thead><tr><th>Student</th><th>Total</th><th>R&W</th><th>Math</th><th>Accuracy</th></tr></thead><tbody>' + rosterRows + '</tbody></table>' + excluded +
      '<div class="footer"><span>TESTPREP · POOLED GROUP PROFILE</span><span>PAGE 1 OF 3</span></div></section>' +

      '<section class="group-report-page page-2"><div class="mast"><div><div class="kicker">DIAGNOSTIC PERFORMANCE</div><h1>Where the group is ready—and where to teach</h1></div><div class="meta">Pooled counts drive instruction.<br>Student percentages drive variation.</div></div>' +
      '<div class="grid2"><div class="card"><h2>Module performance</h2>' + bar("R&W · Module 1", pooled.modules["english|module_1"], "#1740a9") + bar("R&W · Module B", pooled.modules["english|module_b"], "#4b6fc8") + bar("Math · Module 1", pooled.modules["math|module_1"], "#ff963e") + bar("Math · Module B", pooled.modules["math|module_b"], "#d86d25") + '</div><div class="card"><h2>Difficulty performance</h2>' + bar("Easy", pooled.difficulties.easy, "#2b8a64") + bar("Medium", pooled.difficulties.medium, "#cf8a18") + bar("Hard", pooled.difficulties.hard, "#bd4c32") + '<p>Difficulty is descriptive and normalized to canonical lowercase values; it does not need to be enabled as a calculation weight.</p></div></div>' +
      '<div class="grid2"><div class="card"><h2>Group strengths</h2>' + (result.strengths.length ? result.strengths.map(function (x) { return lessonLine(x, "strength"); }).join("") : '<p>Not enough shared evidence to identify a reliable strength.</p>') + '</div><div class="card"><h2>Group priority areas</h2>' + result.priority_areas.map(function (x) { return lessonLine(x, "priority"); }).join("") + '</div></div>' +
      '<h2>Variation by area</h2><div class="grid2"><div>' + (topVariations.length ? topVariations.slice(0,2).map(function (l) { return '<div class="variation"><b>Mixed readiness in ' + e(l.lesson_name) + '</b><span>Student accuracy SD: ' + e(pp(l.accuracy_sd)) + ' (n=' + l.accuracy_sd_n + '). Teach the common core, then use tiered practice.</span></div>'; }).join("") : '<div class="variation"><b>No lesson reaches the high-variation threshold.</b><span>Continue checking readiness during instruction.</span></div>') + '</div><div>' + topVariations.slice(2,4).map(function (l) { return '<div class="variation"><b>Mixed readiness in ' + e(l.lesson_name) + '</b><span>Student accuracy SD: ' + e(pp(l.accuracy_sd)) + ' (n=' + l.accuracy_sd_n + '). Use mixed-difficulty homework or optional follow-up.</span></div>'; }).join("") + (result.outliers.length ? result.outliers.slice(0,2).map(function (o) { return '<div class="variation"><b>' + e(o.student_name + " · " + o.measure) + '</b><span>' + e(o.note) + '</span></div>'; }).join("") : '') + '</div></div>' +
      '<div class="explain"><b>Interpretation.</b> The pooled profile is the instructional signal: all correct results are divided by all administered questions. Variation uses one percentage per student, so students are not mistaken for independent question observations.</div>' +
      '<div class="footer"><span>TESTPREP · DIAGNOSTIC PERFORMANCE</span><span>PAGE 2 OF 3</span></div></section>' +

      '<section class="group-report-page page-3"><div class="mast"><div><div class="kicker">ONE SHARED COURSE</div><h1>Shared Group Roadmap</h1></div><div class="meta">' + e(g.group_name) + '<br>' + e(result.roadmap.group_multiplier) + '× group instructional-time multiplier</div></div>' +
      '<div class="course-summary"><div class="metric"><b>' + result.roadmap.lesson_sequence.length + '</b><span>SHARED LESSONS</span></div><div class="metric"><b>' + result.totals.english_group_hours + ' h</b><span>R&W</span></div><div class="metric"><b>' + result.totals.math_group_hours + ' h</b><span>MATH</span></div><div class="metric"><b>' + result.totals.strategy_hours + ' h</b><span>STRATEGY</span></div><div class="metric"><b>' + result.totals.final_planned_total + ' h</b><span>TOTAL</span></div><div class="metric"><b>' + e(result.schedule.recommended_weeks) + '</b><span>WEEKS · ~' + result.schedule.approximate_sessions + ' BLOCKS</span></div></div>' +
      '<h2>Shared lesson sequence</h2><table class="roadmap-table"><thead><tr><th>Lesson</th><th>Section</th><th>Priority</th><th>Pooled</th><th>Group h</th><th>Rationale / differentiation</th></tr></thead><tbody>' + sequenceRows + '</tbody></table>' +
      '<div class="explain">The group roadmap is calculated from pooled diagnostic performance. Teaching hours reflect one shared course and use the group instructional-time multiplier; they are not the sum of individual student plans.</div>' +
      '<h2>Recommended teaching approach</h2><div class="recommendations"><div class="rec"><b>Teach one shared core.</b><br>Model the central concept and SAT application for the full group.</div><div class="rec"><b>Tier the practice.</b><br>Use support, standard, and extension questions where readiness is mixed.</div><div class="rec"><b>Reassess priorities.</b><br>Check the highest-priority skills after instruction and rebalance if needed.</div></div>' +
      '<h2>Warnings and limitations</h2>' + warningsBlock(result, 4) +
      '<div class="footer"><span>TESTPREP · SHARED GROUP ROADMAP</span><span>PAGE 3 OF 3</span></div></section>' +
      '</body></html>';
  }

  var API = { renderThreePageGroupReport:renderThreePageGroupReport, slug:slug };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TP_GROUP_REPORT = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
