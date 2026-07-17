// Integration test + example-output generator.
// Runs the full pipeline on the shipped demo cases and writes every output
// into /examples. Run: node tests/integration/pipeline.test.js
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const g = {}; new Function("window", fs.readFileSync(path.join(ROOT, "app/js/config-data.js"), "utf8"))(g);
const CFG = g.TP_CONFIG;
const E = require(path.join(ROOT, "app/js/engine.js"));
const VM = require(path.join(ROOT, "app/js/viewmodel.js"));
global.window = g;
const RM = require(path.join(ROOT, "app/js/roadmap.js"));
const RP = require(path.join(ROOT, "app/js/report.js"));

let pass = 0, fail = 0;
function T(name, cond, detail) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}
function w(rel, content) { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); }
function checkHtml(html, name) {
  T(name + ": has doctype + closes html", html.startsWith("<!DOCTYPE html>") && html.includes("</html>"));
  T(name + ": no unresolved template tokens", !html.includes("${") && !html.includes("undefined</"), (html.match(/.{30}undefined<\/.{10}/) || [""])[0]);
  T(name + ": no leftover Karl content", !/Karl/.test(html));
}

// ---------- individual demo ----------
console.log("[individual demo pipeline]");
const maya = JSON.parse(fs.readFileSync(path.join(ROOT, "examples/individual-demo/case-input.json")));
const r = E.analyzeIndividual(maya, CFG);
T("individual demo calculates without errors", r.ok, JSON.stringify(r.errors));
T("all 28 lessons present, none at 0 h", r.lesson_analysis.length === 28 && r.lesson_analysis.every(l => l.final_hours >= 0.25));
T("final component total within 14-35 h", r.totals.final_component_total >= 14 && r.totals.final_component_total <= 35);
T("declared major foundational gap governs Nonlinear Eq & Systems",
  r.lesson_analysis.find(l => l.lesson_id === "MATH_NONLINEAR_EQ_SYSTEMS").foundational_multiplier === 1.5);
w("examples/individual-demo/calculated-results.json", JSON.stringify(r, null, 2));

const vm = VM.buildRoadmapViewModel(maya, r, CFG, { asset_base: "../../app/" });
T("view model derives gap from supplied scores", vm.gap === 330);
T("curve checkpoints avoid invented score predictions", vm.curve_labels.slice(1, 4).every(l => /CHECK/.test(l)));
T("order of attack contains all 8 units exactly once", (()=>{const us=vm.order_of_attack.flatMap(p=>p.units||[]); return us.length===8 && new Set(us.map(u=>u.unit_id)).size===8;})());
T("order of attack contains all 28 existing lessons exactly once", (()=>{const ls=vm.order_of_attack.flatMap(p=>(p.units||[]).flatMap(u=>u.lessons||[])); return ls.length===28 && new Set(ls.map(l=>l.lesson_id)).size===28;})());
T("order of attack adds no synthetic lesson chips", vm.order_of_attack.every(p=>(p.chips||[]).every(c=>CFG.lesson_catalog.units.some(u=>u.unit_name===c))));
w("examples/individual-demo/roadmap-view-model.json", JSON.stringify(vm, null, 2));

const roadHtml = RM.render(vm);
checkHtml(roadHtml, "individual roadmap");
T("roadmap has exactly 7 page sections", (roadHtml.match(/class="[^"]*pagebreak/g) || []).length === 6); // cover + 6 breaks
w("examples/individual-demo/roadmap.html", roadHtml);

const repHtml = RP.renderIndividualReport(r, maya);
checkHtml(repHtml, "individual report");
T("report contains audit example calculations", repHtml.includes("audit trail") && repHtml.includes("without lesson rounding"));
const appSource = fs.readFileSync(path.join(ROOT, "app/js/app.js"), "utf8");
const reportSource = fs.readFileSync(path.join(ROOT, "app/js/report.js"), "utf8");
T("main application does not label the result as clamped", !/clamped|pre-constraint total/i.test(appSource));
T("generated report does not present an above-35 total as a headline", !/PRE-CONSTRAINT TOTAL|CLAMPED TOTAL/i.test(repHtml + reportSource));
w("examples/individual-demo/instructor-report.html", repHtml);

// ---------- two-page teacher & parent report ----------
console.log("[two-page diagnostic report]");
const T2 = require(path.join(ROOT, "app/js/twopage.js"));
const nayla = JSON.parse(fs.readFileSync(path.join(ROOT, "examples/individual-demo/nayla-two-page-sample-input.json")));
const rn = E.analyzeIndividual(nayla, CFG);
T("Nayla sample (98 answers with lowercase difficulties) calculates", rn.ok, JSON.stringify(rn.errors));
T("two-page validation accepts the individual case", T2.validateTwoPageCase(nayla, rn).ok);
T("two-page validation rejects group results", !T2.validateTwoPageCase({ course_type: "group" }, gPlaceholder()).ok);
function gPlaceholder() { return { individual_results: [] }; }
const twoHtml = T2.renderTwoPageDiagnosticReport(rn, nayla);
checkHtml(twoHtml, "two-page report");
T("two-page report has exactly two page sections", (twoHtml.match(/class="pg two-page-report-page/g) || []).length === 2);
T("page 1 carries score summary + section + module charts", twoHtml.includes("Score summary") && twoHtml.includes("Section performance") && twoHtml.includes("Module performance"));
T("page 2 carries difficulty + strengths + priorities + next steps", twoHtml.includes("Performance by question difficulty") && twoHtml.includes("Strongest areas") && twoHtml.includes("Priority areas") && twoHtml.includes("Recommended next steps"));
T("two-page report excludes course-hour/schedule content", !/live hours|sessions\/week|course duration|homework/i.test(twoHtml) && !twoHtml.includes("seven-page"));
w("examples/individual-demo/nayla-two-page-report.html", twoHtml);
// the two-page report on the Maya demo (no difficulty labels) must fall back gracefully
const twoMaya = T2.renderTwoPageDiagnosticReport(r, maya);
checkHtml(twoMaya, "two-page report (no difficulty data)");
T("difficulty fallback shown when the case has no difficulty labels", twoMaya.includes("Difficulty-level performance is unavailable for this diagnostic."));
w("examples/individual-demo/maya-two-page-report.html", twoMaya);

// ---------- UI wiring ----------
console.log("[two-page report UI wiring]");
const appJs = fs.readFileSync(path.join(ROOT, "app/js/app-controller.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
T("index.html loads twopage.js after report.js", indexHtml.indexOf("js/twopage.js") > indexHtml.indexOf("js/report.js") && indexHtml.indexOf("js/twopage.js") < indexHtml.indexOf("js/app-controller.js"));
T("button label is exactly 'Create two page report'", appJs.includes('"Create two page report"'));
T("button connected to createTwoPageReport handler", appJs.includes('actBtn("Create two page report", function () { createTwoPageReport(state.students[0], r); }'));
T("handler validates before rendering", /createTwoPageReport\(input, results\) \{\s*var check = T2\.validateTwoPageCase/.test(appJs));
T("group mode keeps a disabled explanatory button", appJs.includes("The two-page parent report requires an individual student case"));
T("existing report buttons unchanged", appJs.includes('"Open detailed report (print for PDF)"') && appJs.includes('"Open seven-page roadmap (print for PDF)"') && appJs.includes('"Open group report (print for PDF)"'));

// ---------- group demo ----------
console.log("[group demo pipeline]");
const grpIn = JSON.parse(fs.readFileSync(path.join(ROOT, "examples/group-demo/case-input.json")));
const gr = E.analyzeGroup(grpIn, CFG);
T("group demo calculates without errors", gr.ok, JSON.stringify(gr.errors));
T("3 individual calculations produced first", gr.individual_results.length === 3 && gr.individual_results.every(x => x.ok));
T("group lessons preserve core minimum and externalize any excess individual need", gr.lesson_analysis.every(l => l.group_hours >= l.minimum_group_hours && (l.group_hours >= l.max_hours || l.supplemental_support_hours > 0)));
T("3-student min/max = 16/38", gr.totals.minimum_allowed === 16 && gr.totals.maximum_allowed === 38);
w("examples/group-demo/group-results.json", JSON.stringify(gr, null, 2));

const grpRep = RP.renderGroupReport(gr);
checkHtml(grpRep, "group report");
T("group report shows the corrected minimum", grpRep.includes("16"));
w("examples/group-demo/group-report.html", grpRep);

gr.individual_results.forEach((ir, i) => {
  const slug = ir.student.student_name.replace(/\s+/g, "_");
  w("examples/group-demo/student-" + (i + 1) + "-" + slug + "/calculated-results.json", JSON.stringify(ir, null, 2));
  const ivm = VM.buildRoadmapViewModel(grpIn.students[i], ir, CFG, { asset_base: "../../../app/" });
  const rh = RM.render(ivm);
  checkHtml(rh, "group roadmap " + slug);
  w("examples/group-demo/student-" + (i + 1) + "-" + slug + "/roadmap.html", rh);
  w("examples/group-demo/student-" + (i + 1) + "-" + slug + "/instructor-report.html", RP.renderIndividualReport(ir, grpIn.students[i]));
});
T("Rami (target 1420) gets no high-target addition without distinct advanced evidence", gr.individual_results[0].lesson_analysis.every(l => l.high_target_adjustment === 0));
T("Lina and Omar (targets < 1400) receive none",
  gr.individual_results.slice(1).every(ir => ir.lesson_analysis.every(l => l.high_target_adjustment === 0)));

console.log("\n==== " + pass + " passed, " + fail + " failed ====");
if (fail) process.exit(1);
