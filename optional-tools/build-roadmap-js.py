#!/usr/bin/env python3
import re, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.join(HERE, "..")
_src = open(os.path.join(PKG, "original-reference", "TestPrep SAT Roadmap v2.dc.html")).read()
_i = _src.index('<main class="doc">'); _j = _src.index('</main>') + 7
h = _src[_i:_j]
assert '`' not in h and '${' not in h, "template literal escaping needed"

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, "expected %d of %r, found %d" % (count, old[:70], n)
    return s.replace(old, new)

# 1. fonts: offline-safe stack
h = h.replace("font-family:'Inter';", "font-family:'Inter',Arial,Helvetica,sans-serif;")
h = h.replace('font-family="Inter, sans-serif"', 'font-family="Inter, Arial, sans-serif"')

# 2. assets
h = h.replace('src="assets/', 'src="${A}assets/')

# 3. cover
h = rep(h, '>Summer 2026</div>', '>${e(vm.season)}</div>')
h = rep(h, 'font-weight:600;">Karl Naddaf</span> &middot; Practice Test 1 &middot; June 22, 2026.',
         'font-weight:600;">${e(vm.student_name)}</span> &middot; ${e(vm.diagnostic_label)} &middot; ${e(vm.diagnostic_date)}.')

# 4. brand stat band cells -> generated
i = h.index('<!-- brand stat band -->')
start = h.index('grid-template-columns:repeat(4,1fr);">', i) + len('grid-template-columns:repeat(4,1fr);">')
end = h.index('\n    </div>\n  </section>', start)
h = h[:start] + '\n${GEN.brandCells(vm)}' + h[end:]

# 5. masthead
h = rep(h, 'PREPARED FOR KARL NADDAF &middot; PRACTICE TEST 1 &middot; JUN 22 2026',
         'PREPARED FOR ${e(vm.student_name_upper)} &middot; ${e(vm.diagnostic_label_upper)} &middot; ${e(vm.diagnostic_date_upper)}')
h = rep(h, 'color:#fff; letter-spacing:-0.02em;">840</span>', 'color:#fff; letter-spacing:-0.02em;">${e(vm.baseline_display)}</span>')
h = rep(h, 'color:#7ea0e8; letter-spacing:-0.02em;">1300</span>', 'color:#7ea0e8; letter-spacing:-0.02em;">${e(vm.target_display)}</span>')
h = rep(h, '>+460</span>', '>${e(vm.gap_display)}</span>')
h = rep(h, 'width:52.5%; background:linear-gradient(90deg,#1b3a78,#2f5bc4);', 'width:${vm.baseline_pct}%; background:linear-gradient(90deg,#1b3a78,#2f5bc4);')
h = rep(h, 'left:52.5%; top:0; bottom:0; width:28.75%;', 'left:${vm.baseline_pct}%; top:0; bottom:0; width:${vm.gap_pct}%;')
h = rep(h, 'line-height:1.05;">~36 hrs</div>', 'line-height:1.05;">${e(vm.instruction_hours_label)}</div>')
h = rep(h, 'color:#7ea0e8; line-height:1.05;">Yes</div>', 'color:#7ea0e8; line-height:1.05;">${e(vm.accommodation)}</div>')
h = rep(h, 'line-height:1.05;">1 hr</div>', 'line-height:1.05;">${e(vm.max_session_length)}</div>')
h = rep(h, 'line-height:1.25;">Short focused blocks</div>', 'line-height:1.25;">${e(vm.session_format)}</div>')

# 6. diagnosis lead
lead = 'A diagnostic isn&rsquo;t a grade. Instead, it is a map of where your points are. At 840 you&rsquo;re near 37% accuracy across both sections, and the recoverable points aren&rsquo;t scattered: they sit in a few clear places.'
h = rep(h, lead, '${e(vm.diagnosis_lead)}')

# 7. gauge cards -> generated
i = h.index('<!-- section gauges -->')
start = h.index('gap:14px;">', i) + len('gap:14px;">')
end = h.index('</div>\n\n    <!-- strengths / blockers -->', start)
h = h[:start] + '\n${GEN.gaugeCards(vm)}\n    ' + h[end:]

# 8. strengths / blockers list items
s_ul = '''<li><strong>Rule-based grammar:</strong> transitions (67%) and punctuation (56%)</li>
          <li><strong>Math mechanics:</strong> algebra and geometry basics are intact</li>
          <li><strong>Engagement:</strong> you used 97.6% of the time, so effort isn&rsquo;t the issue</li>'''
b_ul = '''<li><strong>Reasoning:</strong> inference (0/6) and command of evidence form the biggest R&amp;W pool</li>
          <li><strong>Advanced Math:</strong> exponentials, factoring, and nonlinear form the deepest gap</li>
          <li><strong>Seven blank grid-ins:</strong> skipped with time to spare</li>'''
h = rep(h, s_ul, '${GEN.bulletItems(vm.strengths)}')
h = rep(h, b_ul, '${GEN.bulletItems(vm.blockers)}')

# 9. pattern statement
pat = 'You apply rules well, but <span style="color:#ff963e;">reasoning is the gap</span>. The more a question rewards interpretation, the more it costs you. That&rsquo;s exactly what stands between 840 and 1300, and it&rsquo;s teachable.'
h = rep(h, pat, '${vm.pattern_statement_html}')

# 10. climb
climb = 'The gap doesn&rsquo;t cost a flat amount of effort. From a low baseline, the earliest points are the cheapest you&rsquo;ll ever earn, so instruction is calibrated to where it converts fastest. The estimate from your results: <span style="font-weight:600; color:#1740a9;">~36 focused hours</span> to 1300.'
h = rep(h, climb, 'The gap doesn&rsquo;t cost a flat amount of effort. Instruction is calibrated to where it converts fastest for you. The planning estimate from your results: <span style="font-weight:600; color:#1740a9;">${vm.hours_int} focused hours</span> toward ${e(vm.target_display)}.')
h = rep(h, '840 &rarr; 1300 OVER ~36 HRS', '${e(vm.baseline_display)} &rarr; ${e(vm.target_display)} OVER ${vm.hours_int} HRS')

# 11. curve labels
h = rep(h, '<text x="60" y="256" font-size="16" fill="#6a7384">840</text>', '<text x="60" y="256" font-size="16" fill="#6a7384">${e(vm.curve_labels[0])}</text>')
h = rep(h, '<text x="230" y="192" font-size="16" fill="#1740a9">980</text>', '<text x="230" y="192" font-size="14" fill="#1740a9">${e(vm.curve_labels[1])}</text>')
h = rep(h, '<text x="392" y="134" font-size="16" fill="#1740a9">~1100</text>', '<text x="392" y="134" font-size="14" fill="#1740a9">${e(vm.curve_labels[2])}</text>')
h = rep(h, '<text x="545" y="86" font-size="16" fill="#1740a9">~1200</text>', '<text x="545" y="86" font-size="14" fill="#1740a9">${e(vm.curve_labels[3])}</text>')
h = rep(h, '<text x="690" y="36" font-size="19" fill="#c7560a">1300</text>', '<text x="690" y="36" font-size="19" fill="#c7560a">${e(vm.curve_labels[4])}</text>')

cap = 'The curve is steepest at the start: the first hours fix the largest, most basic gaps, so early instruction returns the most points. The climb flattens near the top, which is exactly why 1300 is an efficient, well-chosen target.'
h = rep(h, cap, '${e(vm.curve_caption)}')
h = rep(h, '>~36 hrs, guided</div>', '>${vm.hours_int} hrs, guided</div>')

# 12. page 4
h = rep(h, 'Where your 36 hours go', 'Where your ${vm.hours_int} hours go')
h = rep(h, '>~36 HRS TOTAL</span>', '>${vm.hours_int} HRS TOTAL</span>')

# 13. lanes -> generated
i = h.index('<!-- WEIGHTED LANES -->')
start = h.index('<div style="display:flex; flex-direction:column; gap:8px;">', i) + len('<div style="display:flex; flex-direction:column; gap:8px;">')
end = h.index('</div>\n    </div>\n\n    <!-- ORDER OF ATTACK', start)
h = h[:start] + '\n${GEN.lanes(vm)}\n      ' + h[end:]

# 14. order of attack rows -> generated
start = h.index('<div style="margin-top:14px; display:flex; flex-direction:column;">') + len('<div style="margin-top:14px; display:flex; flex-direction:column;">')
end = h.index('</div>\n    <p style="margin-top:14px;', start)
h = h[:start] + '\n${GEN.attackRows(vm)}\n    ' + h[end:]

# 15. engine closing note
note = 'Karl&rsquo;s diagnostic (01&ndash;02) set the plan (03), and the schedule ahead runs instruction, measurement, and optimization (04&ndash;07) until 1300 is reached.'
h = rep(h, note, '${e(vm.student_first_name)}&rsquo;s diagnostic (01&ndash;02) set the plan (03), and the schedule ahead runs instruction, measurement, and optimization (04&ndash;07) until ${e(vm.target_display)} is reached.')

# 16. tracking loop cards (three inner cards)
h = rep(h, '''<div style="font-family:'Inter',Arial,Helvetica,sans-serif; font-size:17px; font-weight:600; margin-bottom:4px;">Every 2 weeks</div>
            <div style="font-size:12px; font-weight:600; color:#1740a9; margin-bottom:6px;">Short skills check</div>
            <p style="font-size:11.5px; line-height:1.5; color:#5a6373;">Are the taught skills sticking?</p>''',
 '''<div style="font-family:'Inter',Arial,Helvetica,sans-serif; font-size:17px; font-weight:600; margin-bottom:4px;">${e(vm.tracking_loops[0].cadence)}</div>
            <div style="font-size:12px; font-weight:600; color:#1740a9; margin-bottom:6px;">${e(vm.tracking_loops[0].title)}</div>
            <p style="font-size:11.5px; line-height:1.5; color:#5a6373;">${e(vm.tracking_loops[0].detail)}</p>''')
h = rep(h, '''<div style="font-family:'Inter',Arial,Helvetica,sans-serif; font-size:17px; font-weight:600; margin-bottom:4px;">Every ~4 weeks</div>
            <div style="font-size:12px; font-weight:600; color:#2f5bc4; margin-bottom:6px;">Full practice section</div>
            <p style="font-size:11.5px; line-height:1.5; color:#5a6373;">Cumulative gain and timing, with a progress note.</p>''',
 '''<div style="font-family:'Inter',Arial,Helvetica,sans-serif; font-size:17px; font-weight:600; margin-bottom:4px;">${e(vm.tracking_loops[1].cadence)}</div>
            <div style="font-size:12px; font-weight:600; color:#2f5bc4; margin-bottom:6px;">${e(vm.tracking_loops[1].title)}</div>
            <p style="font-size:11.5px; line-height:1.5; color:#5a6373;">${e(vm.tracking_loops[1].detail)}</p>''')
h = rep(h, '''<div style="font-family:'Inter',Arial,Helvetica,sans-serif; font-size:17px; font-weight:600; margin-bottom:4px;">At each step</div>
            <div style="font-size:12px; font-weight:600; color:#c7560a; margin-bottom:6px;">980 &rarr; 1100 &rarr; 1200 &rarr; 1300</div>
            <p style="font-size:11.5px; line-height:1.5; color:#5a6373;">Re-measure, confirm the curve, re-prioritize.</p>''',
 '''<div style="font-family:'Inter',Arial,Helvetica,sans-serif; font-size:17px; font-weight:600; margin-bottom:4px;">${e(vm.tracking_loops[2].cadence)}</div>
            <div style="font-size:12px; font-weight:600; color:#c7560a; margin-bottom:6px;">${e(vm.tracking_loops[2].title)}</div>
            <p style="font-size:11.5px; line-height:1.5; color:#5a6373;">${e(vm.tracking_loops[2].detail)}</p>''')

# 17. commitment / delivery / footer
h = rep(h, 'Together, that&rsquo;s how 840 becomes 1300.', 'Together, that&rsquo;s how ${e(vm.baseline_display)} becomes ${e(vm.target_display)}.')
h = rep(h, 'one accountability for getting you from 840 to 1300.', 'one accountability for getting you from ${e(vm.baseline_display)} to ${e(vm.target_display)}.')
h = rep(h, 'Prepared for Karl Naddaf &middot; 22 June 2026 &middot; &copy; House of Prep',
         'Prepared for ${e(vm.student_name)} &middot; ${e(vm.diagnostic_date)} &middot; &copy; House of Prep')

# instagram handle from brand config
h = rep(h, 'font-weight:600;">@testprep.lb</span>', 'font-weight:600;">${e(vm.brand.instagram_handle)}</span>', 1)
h = h.replace('alt="Scan to follow @testprep.lb on Instagram"', 'alt="Scan to follow ${e(vm.brand.instagram_handle)} on Instagram"')

# sanity: no Karl left
for bad in ['Karl','KARL','840','1300','+460','52.5%','~36','36 hrs','June 22','JUN 22','22 June','980','~1100','~1200','Practice Test 1']:
    assert bad not in h, "leftover literal: " + bad

head_css = """*{ box-sizing:border-box; }
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ margin:0; background:#f4f5f8; color:#14181f;
    font-family:'Inter',Arial,Helvetica,sans-serif; font-size:14px; line-height:1.6;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
  h1,h2,h3{ text-wrap:balance; margin:0; }
  p{ margin:0; text-wrap:pretty; }
  .doc{ box-sizing:border-box; max-width:760px; margin:0 auto; background:#fff; }
  .doc-body{ padding:0 30px; }
  table{ border-collapse:collapse; width:100%; }
  @page{ size:A4; margin:10mm 8mm 14mm;
    @top-left{ content:"TESTPREP \\\\00B7 HOUSE OF PREP"; font:600 7pt 'Inter',Arial,sans-serif; letter-spacing:0.1em; color:#aab2c0; }
    @top-right{ content:counter(page) " / " counter(pages); font:600 7pt 'Inter',Arial,sans-serif; letter-spacing:0.1em; color:#aab2c0; }
  }
  .page-footer{ display:none; }
  @media print{
    html,body{ margin:0; padding:0; background:#fff; }
    .doc{ max-width:none !important; margin:0 !important; }
    .keep{ break-inside:avoid; }
    h2,h3,.sec-head{ break-after:avoid; }
    tr{ break-inside:avoid; }
    p,li{ orphans:3; widows:3; }
    .pagebreak{ break-before:page; padding-top:4px !important; }
    .page-footer{ display:flex; position:fixed; left:8mm; right:8mm; bottom:5mm; height:9mm; z-index:0;
      align-items:center; justify-content:center; gap:12px; background:#0c1730; border-radius:9px; }
    .page-footer img{ width:auto; display:block; }
  }"""

js = '''/* TestPrep seven-page roadmap renderer v2.4
 * GENERATED from the original prototype (original-reference/TestPrep SAT Roadmap v2.dc.html)
 * by optional-tools/build-roadmap-js.py. The visual design is frozen; only view-model
 * values are interpolated. Do not duplicate calculation logic here.
 */
(function (root) {
  "use strict";
  function e(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function attackDisplayHours(item) {
    var value = item && item.display_hours != null ? item.display_hours : item && item.hours;
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.ceil(n - 1e-9);
  }
  var GEN = {
    brandCells: function (vm) {
      return vm.brand.brand_stats.map(function (s, i) {
        var bl = i === 0 ? "" : " border-left:1px solid rgba(255,255,255,0.1);";
        return '<div style="padding:20px 14px; text-align:center;' + bl + '">' +
          '<div style="font-family:\\'Inter\\',Arial,Helvetica,sans-serif; font-size:32px; font-weight:600; color:#ff963e; line-height:1;">' + e(s.value) + '<span style="font-size:16px; vertical-align:super;">' + e(s.suffix) + '</span></div>' +
          '<div style="font-family:\\'Inter\\',Arial,Helvetica,sans-serif; font-size:9px; letter-spacing:0.12em; color:#cdd6e8; margin-top:6px;">' + e(s.label) + '</div></div>';
      }).join("\\n");
    },
    gaugeCards: function (vm) {
      return vm.section_scores.map(function (g) {
        var accInt = Math.round(g.accuracy);
        return '<div style="border:1px solid #e4e7ee; border-radius:12px; padding:13px 18px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:9px;">' +
          '<span style="font-weight:600; font-size:13px;">' + e(g.name) + '</span>' +
          '<span><span style="font-family:\\'Inter\\',Arial,Helvetica,sans-serif; font-size:28px; font-weight:600; color:#1740a9; line-height:0.9;">' + accInt + '</span><span style="font-size:12px; color:#8a93a3;">%</span></span></div>' +
          '<div style="height:8px; background:#eef0f4; border-radius:4px; position:relative; overflow:hidden;"><div style="position:absolute; inset:0 ' + (100 - accInt) + '% 0 0; background:#1740a9; border-radius:4px;"></div></div>' +
          '<div style="font-family:\\'Inter\\',Arial,Helvetica,sans-serif; font-size:9.5px; color:#8a93a3; margin-top:8px;">' + e(g.caption) + '</div></div>';
      }).join("\\n");
    },
    bulletItems: function (items) {
      return items.map(function (it) {
        return '<li><strong>' + e(it.label) + ':</strong> ' + e(it.detail) + '</li>';
      }).join("\\n          ");
    },
    lanes: function (vm) {
      var maxH = Math.max.apply(null, vm.hour_allocation.map(function (l) { return l.hours; }));
      var styles = [
        { bg: "#0c1730", fg: "#fff", note: "#9fb0d6" },
        { bg: "#2f5bc4", fg: "#fff", note: "#d2ddf4" },
        { bg: "#ff963e", fg: "#3a1e08", note: "#7a4a16" }];
      return vm.hour_allocation.map(function (l, i) {
        var s = styles[Math.min(i, 2)];
        var w = maxH ? Math.max(28, Math.round(1000 * l.hours / maxH) / 10) : 100;
        var note = l.note ? '<span style="margin-left:auto; padding-right:18px; font-family:\\'Inter\\',Arial,Helvetica,sans-serif; font-size:10px; color:' + s.note + ';">' + e(l.note) + '</span>' : "";
        return '<div style="display:flex; align-items:center; height:46px; background:' + s.bg + '; color:' + s.fg + '; width:' + w + '%; border-radius:10px;">' +
          '<span style="font-family:\\'Inter\\',Arial,Helvetica,sans-serif; font-size:26px; font-weight:600; padding-left:18px; width:78px;">' + e(l.hours) + '</span>' +
          '<span style="font-size:13px; font-weight:600;">' + e(l.name) + '</span>' + note + '</div>';
      }).join("\\n");
    },
    attackRows: function (vm) {
      var pal = [
        { num: "#c7560a", kick: "#c7560a", chipBg: "#fff4ea", chipFg: "#9a4708", border: "#f2c9aa", kicker: "FIRST" },
        { num: "#1740a9", kick: "#1740a9", chipBg: "#f0f4fc", chipFg: "#1740a9", border: "#c9d5ef", kicker: "THEN" },
        { num: "#9aa3b2", kick: "#5a6373", chipBg: "#f6f7f9", chipFg: "#4a5566", border: "#dfe3e9", kicker: "FINALLY" }];
      return vm.order_of_attack.map(function (ph, i) {
        var p = pal[Math.min(i, 2)];
        var last = i === vm.order_of_attack.length - 1 ? " border-bottom:1px solid #e4e7ee;" : "";
        var content;
        if (ph.units && ph.units.length) {
          content = ph.units.map(function (u) {
            var lessonNames = u.lessons.map(function (l) { return e(l.lesson_name); }).join(" &middot; ");
            return '<div style="min-width:0; background:' + p.chipBg + '; border:1px solid ' + p.border + '; border-radius:9px; padding:7px 9px;">' +
              '<div style="display:flex; justify-content:space-between; gap:8px; align-items:baseline;">' +
              '<span style="font-size:11.5px; line-height:1.2; font-weight:700; color:' + p.chipFg + ';">' + e(u.unit_name) + '</span>' +
              '<span style="font-size:9px; white-space:nowrap; color:' + p.chipFg + '; opacity:.78;">&asymp; ' + e(attackDisplayHours(u)) + ' h</span></div>' +
              '<div style="font-size:8.5px; line-height:1.28; color:#5a6373; margin-top:4px;">' + lessonNames + '</div></div>';
          }).join("\\n          ");
          content = '<div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; padding-top:2px;">' + content + '</div>';
        } else {
          var chips = (ph.chips || []).map(function (c) {
            return '<span style="font-size:12px; background:' + p.chipBg + '; color:' + p.chipFg + '; padding:6px 12px; border-radius:8px;">' + e(c) + '</span>';
          }).join("\\n          ");
          content = '<div style="display:flex; flex-wrap:wrap; gap:8px; padding-top:4px;">' + chips + '</div>';
        }
        return '<div class="keep" style="display:grid; grid-template-columns:46px 118px 1fr; gap:13px; align-items:start; padding:13px 0; border-top:1px solid #e4e7ee;' + last + '">' +
          '<div style="font-family:\\'Inter\\',Arial,Helvetica,sans-serif; font-size:31px; font-weight:600; color:' + p.num + '; line-height:0.8;">0' + (i + 1) + '</div>' +
          '<div><div style="font-family:\\'Inter\\',Arial,Helvetica,sans-serif; font-size:9px; letter-spacing:0.12em; color:' + p.kick + '; margin-bottom:5px;">' + p.kicker + '</div>' +
          '<div style="display:flex; align-items:baseline; gap:5px;"><span style="font-family:\\'Inter\\',Arial,Helvetica,sans-serif; font-size:25px; font-weight:600; color:#14181f; line-height:1;">&asymp; ' + e(attackDisplayHours(ph)) + '</span><span style="font-size:10px; color:#8a93a3;">hrs</span></div>' +
          '<div style="font-size:10.3px; line-height:1.35; color:#5a6373; margin-top:5px;">' + e(ph.summary) + '</div></div>' + content + '</div>';
      }).join("\\n");
    }
  };

  root.TP_RENDER_ROADMAP = function (vm) {
    var A = vm.asset_base || "";
    var body = MAIN_TEMPLATE(vm, A, GEN);
    return '<!DOCTYPE html>\\n<html>\\n<head>\\n<meta charset="utf-8">\\n<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '\\n<title>TestPrep SAT Roadmap - ' + e(vm.student_name) + '</title>\\n<style>\\n' + HEAD_CSS + '\\n</style>\\n</head>\\n<body>\\n' + body + '\\n</body>\\n</html>';
  };

  var HEAD_CSS = HEAD_CSS_SRC;

  function MAIN_TEMPLATE(vm, A, GEN) {
    return MAIN_SRC;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { render: root.TP_RENDER_ROADMAP };
})(typeof globalThis !== "undefined" ? globalThis : this);
'''

js = js.replace("HEAD_CSS_SRC", "`" + head_css + "`")
js = js.replace("MAIN_SRC", "`" + h + "`")
open('../app/js/roadmap.js','w').write(js)
print("roadmap.js written", len(js))
