// Shared-group aggregation, similarity, exclusions, and roadmap tests.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const g = {}; new Function("window", fs.readFileSync(path.join(ROOT, "app/js/config-data.js"), "utf8"))(g);
const CFG = g.TP_CONFIG;
global.TP_ENGINE = require(path.join(ROOT, "app/js/engine.js"));
const E = global.TP_ENGINE;
const GS = require(path.join(ROOT, "app/js/group-shared.js"));

let pass = 0, fail = 0;
function T(name, condition, detail) {
  if (condition) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function approx(a, b, eps=1e-9) { return Math.abs(a-b) <= eps; }

console.log("[pooled aggregation]");
const a = Array.from({length:10}, (_,i)=>({correct:i<8,student_answer:"A"}));
const b = Array.from({length:2}, (_,i)=>({correct:i<1,student_answer:"A"}));
const pooled = GS.pooledStats([a,b]);
T("8/10 and 1/2 pool to 9/12", pooled.correct===9 && pooled.administered===12);
T("pooled accuracy is 75%, not mean 65%", pooled.accuracy===0.75 && pooled.accuracy!==0.65);
const unevenSection = GS.pooledStats([a,b], q=>q.section!="math");
T("pooled helper handles unequal denominators", unevenSection.administered===12 && unevenSection.correct===9);
const missingCategory = GS.pooledStats([a,[]]);
T("students with no category records are absent from that denominator", missingCategory.students_represented===1 && missingCategory.administered===10);

console.log("[population standard deviation]");
T("identical values produce SD 0", GS.populationStats([4,4,4]).sd===0);
T("population formula divides by N", GS.populationStats([1,3]).sd===1);
T("fewer than two comparable values has no SD", GS.populationStats([4]).sd===null);
const simRules = clone(CFG.calculation_rules); delete simRules.shared_group_planning;
GS.analyzeSharedGroup; // defaults are installed when a group is analyzed below

const input = JSON.parse(fs.readFileSync(path.join(ROOT,"examples/group-demo/case-input.json"),"utf8"));
const individualBefore = E.analyzeIndividual(clone(input.students[0]), CFG);
const result = GS.analyzeSharedGroup(clone(input), CFG);
T("shared group calculates", result.ok, JSON.stringify(result.errors));
T("one shared roadmap has 28 unique lessons", result.lesson_analysis.length===28 && new Set(result.roadmap.lesson_sequence.map(x=>x.lesson_id)).size===28);
T("pooled overall equals summed student counts", result.pooled.overall.correct===177 && result.pooled.overall.administered===294);
T("pooled section totals reconcile", result.pooled.sections.english.administered + result.pooled.sections.math.administered === result.pooled.overall.administered);
T("all four module totals reconcile", Object.values(result.pooled.modules).reduce((s,x)=>s+x.administered,0)===result.pooled.overall.administered);
T("difficulty labels are normalized descriptively", ["easy","medium","hard"].every(k=>result.pooled.difficulties[k]));
T("lesson pooled counts reconcile to overall", Object.values(result.pooled.lessons).reduce((s,x)=>s+x.administered,0)===result.pooled.overall.administered);

console.log("[similarity and score statistics]");
T("score means use provided arithmetic values", result.score_statistics.total.mean===1003.33);
T("population score SD is used", result.score_statistics.total.sd===114.41);
T("major high threshold classifies high variation", result.similarity.level==="high");
const missingScoreInput=clone(input); delete missingScoreInput.students[0].scores.total_scaled;
const missingScore=GS.analyzeSharedGroup(missingScoreInput,CFG);
T("missing total score does not exclude a diagnostically valid student", missingScore.ok && missingScore.group.valid_student_count===3);
T("missing score is excluded only from the corresponding statistic", missingScore.score_statistics.total.n===2 && missingScore.score_statistics.math.n===3);
T("lesson variation does not itself set major similarity", (()=>{
  const scoreStats={total:GS.populationStats([1000,1000]),reading_writing:GS.populationStats([500,500]),math:GS.populationStats([500,500])};
  const variation={overall_accuracy:GS.populationStats([.7,.7]),sections:{english:GS.populationStats([.7,.7]),math:GS.populationStats([.7,.7])}};
  return GS.classifySimilarity(scoreStats,variation,CFG.calculation_rules).level==="consistent";
})());

console.log("[fixed 2.0 multiplier and roadmap constraints]");
T("documented raw example: 1.4 h becomes 2.8 h before rounding", GS.applyGroupMultiplier(1.4,2.0)===2.8);
T("every shared raw lesson is exactly 2× individual-equivalent raw need", result.lesson_analysis.every(l=>approx(l.raw_group_hours,l.individual_equivalent_raw_hours*2,0.011)));
T("strategy raw time receives 2× treatment", result.roadmap.strategy.raw_group_orientation_hours===1.5 && result.roadmap.strategy.raw_group_final_review_hours===3);
T("existing whole-hour category rounding remains active", Number.isInteger(result.totals.english_group_hours) && Number.isInteger(result.totals.math_group_hours) && Number.isInteger(result.totals.strategy_hours));
T("final total reconciles", result.totals.final_planned_total===result.totals.english_group_hours+result.totals.math_group_hours+result.totals.strategy_hours);
T("group maximum remains enforced", result.totals.final_planned_total<=result.totals.maximum_allowed);
T("sequence keeps configured order within each unit", result.roadmap.units.every(u=>u.lessons.every((l,i,a)=>i===0 || a[i-1].lesson_order_within_unit<=l.lesson_order_within_unit)));
T("no individual lesson lists are added together", !result.individual_results && result.roadmap.model==="one_shared_course");

console.log("[eligibility and exclusions]");
const oneInvalid=clone(input); oneInvalid.students.push(clone(input.students[0])); oneInvalid.students[3].student.student_name="Invalid Student"; oneInvalid.students[3].diagnostic.answers=[];
const excluded=GS.analyzeSharedGroup(oneInvalid,CFG);
T("invalid student is excluded while valid group continues", excluded.ok && excluded.group.valid_student_count===3 && excluded.group.excluded_student_count===1);
T("exclusion warning names student and reason", excluded.warnings.some(w=>w.code==="EXCLUDED_STUDENT" && /Invalid Student/.test(w.message) && /No diagnostic answers/.test(w.message)));
T("excluded student affects no pooled denominator", excluded.pooled.overall.administered===result.pooled.overall.administered);
T("excluded student affects no score statistic", excluded.score_statistics.total.n===result.score_statistics.total.n);
const onlyOne=clone(input); onlyOne.students[1].diagnostic.answers=[]; onlyOne.students[2].diagnostic.answers=[];
const blocked=GS.analyzeSharedGroup(onlyOne,CFG);
T("only one valid student blocks group generation", !blocked.ok && blocked.errors.some(e=>e.code==="INSUFFICIENT_VALID_GROUP_STUDENTS"));
const none=clone(onlyOne); none.students[0].diagnostic.answers=[];
T("no valid students blocks group generation", GS.analyzeSharedGroup(none,CFG).errors.some(e=>e.code==="NO_VALID_GROUP_STUDENTS"));

console.log("[individual regression]");
const individualAfter=E.analyzeIndividual(clone(input.students[0]),CFG);
T("individual total is unchanged by shared-group analysis", individualBefore.totals.final_planned_total===individualAfter.totals.final_planned_total);
T("all individual lesson hours remain unchanged", individualBefore.lesson_analysis.every((l,i)=>l.final_hours===individualAfter.lesson_analysis[i].final_hours));

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if(fail)process.exit(1);
