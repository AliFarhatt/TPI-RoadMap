/* Builds the roadmap_view_model from calculated results + supplied inputs.
 * Contains NO calculation logic (all figures come from the engine output). */
(function (root) {
  "use strict";
  function esc(s) { return s == null ? "" : String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function up(s) { return s == null ? "" : String(s).toUpperCase(); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function roundUpHour(x) {
    var n = Number(x);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.ceil(n - 1e-9);
  }

  function buildRoadmapViewModel(input, results, config, opts) {
    opts = opts || {};
    var brand = config.brand_config;
    var st = input.student || {};
    var goal = input.goal || {};
    var sc = input.scores || {};
    var t = results.totals;
    var eng = results.section_summaries.english;
    var math = results.section_summaries.math;

    var baseline = sc.total_scaled != null ? sc.total_scaled : null;
    var target = goal.target_sat_score != null ? goal.target_sat_score : null;
    var gap = baseline != null && target != null ? target - baseline : null;
    var finalPlannedTotal = t.final_planned_total == null ? t.constrained_total : t.final_planned_total;
    var hoursInt = finalPlannedTotal;

    // masthead progress-bar geometry (only when real scaled scores exist)
    var basePct = baseline != null ? r1(100 * baseline / 1600) : 0;
    var gapPct = baseline != null && target != null ? r1(100 * (target - baseline) / 1600) : 0;

    // gauges: scaled scores are supplied, accuracy is calculated
    function gauge(name, sum, scaled, max) {
      var cap = [];
      if (scaled != null) cap.push(scaled + " / " + max);
      if (sum.questions_assessed) cap.push(sum.questions_correct + " of " + sum.questions_assessed + " correct");
      return { name: name, accuracy: sum.raw_accuracy != null ? sum.raw_accuracy : 0, caption: cap.join(" \u00b7 ") || "Not assessed" };
    }

    // strengths / blockers from generated results
    var strengths = results.strengths.slice(0, 3).map(function (s) {
      return { label: s.lesson_name, detail: s.weighted_accuracy + "% weighted accuracy on the assessed material (" + s.coverage_level.replace(/_/g, " ") + " coverage)" };
    });
    while (strengths.length < 1) strengths.push({ label: "Effort", detail: "the diagnostic gives us a clear starting map" });
    var blockers = results.priority_areas.filter(function (p) { return p.priority === "CRITICAL" || p.priority === "HIGH"; })
      .slice(0, 3).map(function (p) {
        return { label: p.lesson_name, detail: (p.weighted_accuracy != null ? p.weighted_accuracy + "% weighted accuracy; " : "") + p.final_hours + " h of guided instruction planned" };
      });
    if (!blockers.length) blockers = results.priority_areas.slice(0, 3).map(function (p) {
      return { label: p.lesson_name, detail: p.final_hours + " h planned (" + p.priority.toLowerCase().replace(/_/g, " ") + ")" };
    });

    // pattern statement generated from dominant evidence
    var pattern = buildPattern(results, baseline, target);

    // hour lanes (Math / R&W / Strategy) from calculated section totals
    var lanes = [
      { name: "Math", hours: t.math_live_hours, note: null },
      { name: "Reading & Writing", hours: t.english_live_hours, note: null },
      { name: "Strategy", hours: t.strategy_hours, note: null }
    ].sort(function (a, b) { return b.hours - a.hours; });
    var laneTotal = t.math_live_hours + t.english_live_hours + t.strategy_hours;
    lanes.forEach(function (l, i) {
      var p = Math.round(100 * l.hours / laneTotal);
      l.note = i === 0 ? p + "% \u00b7 deepest need" : p + "%";
    });

    // Order of attack is sequenced by SAT unit, not by isolated lesson.
    // The eight official units are organizational labels only: every existing
    // lesson appears exactly once and no synthetic lesson is introduced.
    // Exact hours remain available for sorting and auditing, while
    // display_hours is rounded upward to a whole hour for approximate labels.
    var la = results.lesson_analysis;
    var priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, ESSENTIAL_REVIEW: 1 };
    var unitDefs = (config.lesson_catalog.units || []).slice().sort(function (a, b) { return a.unit_order - b.unit_order; });
    var units = unitDefs.map(function (u) {
      var ls = la.filter(function (l) { return l.unit_id === u.unit_id; })
        .sort(function (a, b) { return (a.lesson_order_within_unit || 0) - (b.lesson_order_within_unit || 0); });
      var hours = ls.reduce(function (sum, l) { return sum + l.final_hours; }, 0);
      var weightedUrgency = hours > 0 ? ls.reduce(function (sum, l) {
        return sum + (priorityWeight[l.priority] || 1) * l.final_hours;
      }, 0) / hours : 0;
      var maxUrgency = ls.reduce(function (m, l) { return Math.max(m, priorityWeight[l.priority] || 1); }, 0);
      return {
        unit_id: u.unit_id,
        unit_name: u.unit_name,
        section: u.section,
        unit_order: u.unit_order,
        hours: r1(hours),
        display_hours: roundUpHour(hours),
        urgency_score: weightedUrgency,
        maximum_priority_score: maxUrgency,
        lessons: ls.map(function (l) { return { lesson_id: l.lesson_id, lesson_name: l.lesson_name, hours: l.final_hours, priority: l.priority }; })
      };
    }).filter(function (u) { return u.lessons.length > 0; });

    units.sort(function (a, b) {
      return b.urgency_score - a.urgency_score ||
        b.maximum_priority_score - a.maximum_priority_score ||
        b.hours - a.hours || a.unit_order - b.unit_order;
    });

    // Eight units are divided into three ordered waves (3 / 3 / 2). This
    // keeps each unit intact while preserving a clear FIRST / THEN / FINALLY
    // sequence personalized by aggregate unit need.
    var firstCount = Math.ceil(units.length / 3);
    var remainingAfterFirst = units.length - firstCount;
    var thenCount = Math.ceil(remainingAfterFirst / 2);
    var phaseUnits = [
      units.slice(0, firstCount),
      units.slice(firstCount, firstCount + thenCount),
      units.slice(firstCount + thenCount)
    ];
    var phaseSummaries = [
      "Highest-need units, taught as complete skill families.",
      "Next-priority units, building on the first wave.",
      "Strongest units, precision, timing and rehearsal."
    ];
    var attack = phaseUnits.map(function (us, idx) {
      var unitHours = us.reduce(function (sum, u) { return sum + u.hours; }, 0);
      var hours = unitHours + (idx === 2 ? t.strategy_hours : 0);
      return {
        hours: r1(hours),
        display_hours: roundUpHour(hours),
        summary: phaseSummaries[idx],
        units: us,
        chips: us.map(function (u) { return u.unit_name; })
      };
    }).filter(function (p) { return p.units.length > 0; });

    // score checkpoints: planning phases, never invented score predictions
    var curveLabels = [
      baseline != null ? String(baseline) : "START",
      "CHECK 1", "CHECK 2", "CHECK 3",
      target != null ? String(target) : "TARGET"];
    var loops = [
      { cadence: "Every 2 weeks", title: "Short skills check", detail: "Are the taught skills sticking?" },
      { cadence: "Every ~4 weeks", title: "Full practice section", detail: "Cumulative gain and timing, with a progress note." },
      { cadence: "At each checkpoint", title: "Reassess & re-prioritize", detail: "Checkpoints are planning points, not guaranteed scores: re-measure, confirm the plan, adjust." }];

    var accuracyOverall = (function () {
      var q = eng.questions_assessed + math.questions_assessed;
      var c = eng.questions_correct + math.questions_correct;
      return q ? Math.round(1000 * c / q) / 10 : null;
    })();

    var diagLead = "A diagnostic isn\u2019t a grade. Instead, it is a map of where your points are." +
      (baseline != null && accuracyOverall != null ? " At " + baseline + " you\u2019re near " + Math.round(accuracyOverall) + "% accuracy across both sections, and the recoverable points aren\u2019t scattered: they sit in a few clear places." :
        (accuracyOverall != null ? " You\u2019re near " + Math.round(accuracyOverall) + "% accuracy across the assessed questions, and the recoverable points sit in a few clear places." : " The plan below allocates every hour to where the diagnostic shows it converts."));

    var curveCaption = "The curve is steepest at the start: the first hours fix the largest, most basic gaps, so early instruction returns the most points. Each dot is a reassessment checkpoint, a planning point your instructor confirms or adjusts, never a promised score" +
      (target != null ? ", on the way to the " + target + " target." : ".");

    var vm = {
      schema_version: "2.0",
      asset_base: opts.asset_base != null ? opts.asset_base : "",
      brand: brand,
      student_name: st.student_name || "Student",
      student_name_upper: up(st.student_name || "Student"),
      student_first_name: (st.student_name || "The student").split(" ")[0],
      season: input.season || seasonFromDate(input.diagnostic && input.diagnostic.date),
      diagnostic_label: results.diagnostic.template_name,
      diagnostic_label_upper: up(results.diagnostic.template_name),
      diagnostic_date: input.diagnostic && input.diagnostic.date || "",
      diagnostic_date_upper: up(input.diagnostic && input.diagnostic.date || ""),
      baseline: baseline, target: target, gap: gap,
      baseline_display: baseline != null ? String(baseline) : "\u2014",
      target_display: target != null ? String(target) : "\u2014",
      gap_display: gap != null ? "+" + gap : "TBD",
      baseline_pct: basePct, gap_pct: gapPct,
      overall_accuracy: accuracyOverall,
      instruction_hours_label: "~" + hoursInt + " hrs",
      hours_int: hoursInt,
      accommodation: (input.availability && input.availability.accommodation) || "No",
      max_session_length: (input.availability && input.availability.max_session_length) || "2 hrs",
      session_format: (input.availability && input.availability.session_format) || "Focused blocks",
      section_scores: [
        gauge("Reading & Writing", eng, sc.reading_writing_scaled, 800),
        gauge("Math", math, sc.math_scaled, 800)],
      strengths: strengths, blockers: blockers,
      pattern_statement_html: pattern,
      diagnosis_lead: diagLead,
      curve_labels: curveLabels,
      curve_caption: curveCaption,
      hour_allocation: lanes,
      order_of_attack: attack,
      tracking_loops: loops,
      homework_summary: { total_hours: t.homework_total, english: t.homework_english, math: t.homework_math },
      course_weeks: results.schedule.recommended_weeks,
      sessions_per_week: results.schedule.sessions_per_week,
      disclaimer: "All hour figures and checkpoints are planning estimates derived from this diagnostic. They are instructor-adjustable, depend on attendance, homework, and performance, and are never a guaranteed score."
    };
    return vm;
  }

  function buildPattern(results, baseline, target) {
    var ec = results.error_patterns || {};
    var la = results.lesson_analysis;
    var weakSections = { english: 0, math: 0 };
    la.forEach(function (l) { if (l.priority === "CRITICAL" || l.priority === "HIGH") weakSections[l.section]++; });
    var focus, focusWord;
    if ((ec.rushing || 0) + (ec.guessing || 0) >= 4) {
      focus = "Accuracy under time pressure is the gap"; focusWord = "time pressure";
    } else if (weakSections.math > weakSections.english + 2) {
      focus = "Math depth is the gap"; focusWord = "Math depth";
    } else if (weakSections.english > weakSections.math + 2) {
      focus = "Reading precision is the gap"; focusWord = "Reading precision";
    } else {
      focus = "Consistency across skills is the gap"; focusWord = "consistency";
    }
    var tail = baseline != null && target != null ? " That\u2019s exactly what stands between " + baseline + " and " + target + ", and it\u2019s teachable." : " The plan targets it directly, and it\u2019s teachable.";
    return esc(focus).replace(esc(focusWord), '<span style="color:#ff963e;">' + esc(focusWord) + "</span>") +
      ". Where the diagnostic gives strong evidence the plan trims review; where evidence is thin it protects full instruction." + esc(tail);
  }

  function seasonFromDate(d) {
    if (!d) return "SAT Program";
    var m = String(d).match(/(20\d\d)/);
    var mo = new Date(d);
    var season = isNaN(mo) ? "" : ["Winter", "Winter", "Spring", "Spring", "Spring", "Summer", "Summer", "Summer", "Fall", "Fall", "Fall", "Winter"][mo.getMonth()];
    return (season ? season + " " : "") + (m ? m[1] : "");
  }

  var api = { buildRoadmapViewModel: buildRoadmapViewModel };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TP_VIEWMODEL = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
