/* UI adapter for the pooled shared-group workflow.
 * Loaded after app.js so the existing individual workflow remains untouched.
 */
(function (root) {
  "use strict";
  var E = root.TP_ENGINE, GS = root.TP_GROUP_SHARED, ROAD = root.TP_GROUP_ROADMAP, REPORT = root.TP_GROUP_REPORT, CFG = root.TP_CONFIG;
  if (!E || !GS || !ROAD || !REPORT || !CFG || typeof document === "undefined") return;

  var legacyAnalyzeGroup = E.analyzeGroup;
  var lastInput = null, lastResult = null, resultStale = true;
  E.analyzeLegacyGroup = legacyAnalyzeGroup;

  function esc(v) { return v == null ? "" : String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function pct(v) { return v == null ? "—" : Math.round(v * 1000) / 10 + "%"; }
  function statGrid(items) { return '<div class="statgrid">' + items.map(function (x) { return '<div class="stat"><div class="v">' + esc(x[0]) + '</div><div class="l">' + esc(x[1]) + '</div></div>'; }).join("") + '</div>'; }
  function addMessage(type, text) {
    var box = document.getElementById("messages");
    if (!box) return;
    var div = document.createElement("div"); div.className = "msg " + type; div.textContent = text; box.appendChild(div);
  }

  function compatible(result) {
    if (!result || !result.ok) return result;
    result.individual_results = [];
    result.compatibility = { split_recommended:false, split_reasons:[], individual_totals:[], average_individual_total:null, lowest_individual_total:null, highest_individual_total:null, spread_percent:null, highly_different_lessons:0, subgroup_recommendation:null };
    result.group.size = result.group.valid_student_count;
    result.lesson_analysis.forEach(function (l) {
      l.student_hours = [];
      l.max_hours = l.individual_equivalent_raw_hours;
      l.diversity_classification = l.needs_differentiation ? "mixed_readiness" : "pooled_shared_profile";
      l.diversity_adjustment = 0;
      l.subgroup_recommended = false;
    });
    result.totals.raw_total = result.totals.raw_component_total;
    result.totals.final_total = result.totals.final_planned_total;
    result.totals.homework_transfer_hours = result.totals.homework_transfer_hours || 0;
    result.totals.supplemental_support_hours = result.totals.supplemental_support_hours || 0;
    return result;
  }

  E.analyzeGroup = function (input, config) {
    lastInput = input;
    lastResult = compatible(GS.analyzeSharedGroup(input, config));
    resultStale = !lastResult.ok;
    if (lastResult.ok) setTimeout(renderSharedResults, 0);
    return lastResult;
  };

  function groupActive() {
    var panel = document.getElementById("panel-group");
    return !!panel && !panel.classList.contains("hidden");
  }
  function refreshButtons() {
    var active = groupActive();
    ["btn-group-roadmap", "btn-three-page-group-report"].forEach(function (id) {
      var button = document.getElementById(id); if (!button) return;
      button.disabled = !active;
      button.setAttribute("aria-disabled", active ? "false" : "true");
      button.title = active ? "Create one shared output from the loaded group case." : "Available only for a loaded group case.";
    });
  }
  function ensureResult() {
    if (!groupActive()) { addMessage("err", "Load a valid group case with at least two eligible students before creating a group roadmap."); return null; }
    if (resultStale || !lastResult || !lastResult.ok) { addMessage("err", "Run group analysis before creating the shared roadmap or three-page group report."); return null; }
    if (lastResult.excluded_students.length) {
      var text = "The following students will be excluded from every group calculation:\n\n" + lastResult.excluded_students.map(function (x) { return "• " + x.student_name + ": " + x.reason; }).join("\n") + "\n\nContinue with " + lastResult.group.valid_student_count + " valid students?";
      if (!root.confirm(text)) { addMessage("warn", "Group document generation was cancelled."); return null; }
    }
    return lastResult;
  }
  function openDocument(html) {
    var win = root.open("", "_blank");
    if (!win) { addMessage("err", "The browser blocked the popup. Allow popups to open group documents."); return; }
    html = html.replace("<head>", '<head><base href="' + document.baseURI + '">');
    win.document.open(); win.document.write(html); win.document.close();
  }
  function download(name, text) {
    var blob = new Blob([text], { type:"application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 0);
  }

  function lessonTable(result) {
    var html = '<div class="tablewrap"><table><thead><tr><th>Shared sequence</th><th>Pooled correct</th><th>Pooled accuracy</th><th>Individual-equivalent raw h</th><th>2× raw group h</th><th>Final group h</th><th>Priority</th><th>Delivery</th></tr></thead><tbody>';
    result.roadmap.lesson_sequence.forEach(function (l, i) {
      var p = result.pooled.lessons[l.lesson_id];
      html += '<tr><td><strong>' + (i + 1) + '. ' + esc(l.lesson_name) + '</strong></td><td>' + p.correct + '/' + p.administered + '</td><td>' + pct(p.accuracy) + '</td><td>' + l.individual_equivalent_raw_hours + '</td><td>' + l.raw_group_hours + '</td><td><strong>' + l.group_hours + '</strong></td><td><span class="pill pr-' + esc(l.priority) + '">' + esc(l.priority.replace(/_/g," ")) + '</span></td><td>' + (l.needs_differentiation ? "Tiered practice" : "Shared core") + '</td></tr>';
    });
    return html + '</tbody></table></div>';
  }
  function renderSharedResults() {
    var result = lastResult;
    if (!result || !result.ok || !groupActive()) return;
    var title = document.getElementById("results-title"), summary = document.getElementById("results-summary"), actions = document.getElementById("results-actions"), detail = document.getElementById("results-detail");
    if (!summary || !actions || !detail) return;
    title.textContent = "Shared group results: " + result.group.group_name;
    var t = result.totals;
    summary.innerHTML = statGrid([[t.english_group_hours + " h","READING & WRITING"],[t.math_group_hours + " h","MATH"],[t.strategy_hours + " h","STRATEGY"],[t.final_planned_total + " h","ONE SHARED GROUP PLAN"]]) +
      '<p class="hint">' + result.group.valid_student_count + ' valid student(s) included; ' + result.group.excluded_student_count + ' excluded. Pooled accuracy: ' + pct(result.pooled.overall.accuracy) + '. Raw shared component need after the fixed 2.0 multiplier: ' + t.raw_component_total + ' h. Final total after existing caps, redistribution, and whole-hour category rounding: ' + t.final_planned_total + ' h.</p>' +
      '<div class="msg ' + (result.similarity.level === "high" ? "warn" : "ok") + '"><strong>Performance similarity: ' + esc(result.similarity.label) + '.</strong> ' + (result.similarity.level === "high" ? 'Use tiered practice in ' + esc(result.similarity.flags.map(function (f) { return f.label; }).join(", ")) + '; the core course remains shared.' : 'The available major measures support one shared course.') + '</div>';
    actions.innerHTML = "";
    var exportButton = document.createElement("button"); exportButton.className = "btn"; exportButton.textContent = "Export shared group analysis JSON";
    exportButton.onclick = function () { download(REPORT.slug(result.group.group_name) + "_shared-group-analysis.json", JSON.stringify(result, null, 2)); };
    actions.appendChild(exportButton);
    detail.innerHTML = lessonTable(result);
  }

  var roadButton = document.getElementById("btn-group-roadmap");
  if (roadButton) roadButton.onclick = function () {
    this.disabled = true; this.setAttribute("aria-busy","true"); addMessage("ok", "Creating the shared group roadmap…");
    try { var result = ensureResult(); if (result) { openDocument(ROAD.renderSharedGroupRoadmap(result)); addMessage("ok", "Shared group roadmap created. Use Print → Save as PDF."); } }
    catch (err) { addMessage("err", "Could not create the group roadmap: " + err.message); }
    this.removeAttribute("aria-busy"); refreshButtons();
  };
  var reportButton = document.getElementById("btn-three-page-group-report");
  if (reportButton) reportButton.onclick = function () {
    this.disabled = true; this.setAttribute("aria-busy","true"); addMessage("ok", "Creating the exact three-page group report…");
    try { var result = ensureResult(); if (result) { openDocument(REPORT.renderThreePageGroupReport(result)); addMessage("ok", "Three-page group report created. Use Print → Save as PDF."); } }
    catch (err) { addMessage("err", "Could not create the three-page group report: " + err.message); }
    this.removeAttribute("aria-busy"); refreshButtons();
  };

  var observer = new MutationObserver(function () { refreshButtons(); });
  observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:["class"] });
  root.addEventListener("tp:group-analysis-stale", function () { lastInput = null; lastResult = null; resultStale = true; });
  refreshButtons();
})(typeof globalThis !== "undefined" ? globalThis : window);
