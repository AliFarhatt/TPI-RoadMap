// Renderer and packaged-UI integration tests for shared-group outputs.
const fs=require("fs"),path=require("path");
const ROOT=path.join(__dirname,"..","..");
const g={};new Function("window",fs.readFileSync(path.join(ROOT,"app/js/config-data.js"),"utf8"))(g);
global.TP_ENGINE=require(path.join(ROOT,"app/js/engine.js"));
const GS=require(path.join(ROOT,"app/js/group-shared.js"));
const R=require(path.join(ROOT,"app/js/groupreport.js"));
const M=require(path.join(ROOT,"app/js/grouproadmap.js"));
const input=JSON.parse(fs.readFileSync(path.join(ROOT,"examples/group-demo/case-input.json"),"utf8"));
const result=GS.analyzeSharedGroup(input,g.TP_CONFIG);
const report=R.renderThreePageGroupReport(result),roadmap=M.renderSharedGroupRoadmap(result);
let pass=0,fail=0;function T(n,c){if(c){pass++;console.log("  ok  "+n)}else{fail++;console.log("  FAIL "+n)}}
T("report renders exactly three explicit pages",(report.match(/<section class="group-report-page/g)||[]).length===3);
T("page 1 contains overview and similarity",/SAT Group Diagnostic Summary/.test(report)&&/Similarity summary/.test(report));
T("page 2 contains module, difficulty, strengths, priorities",/Module performance/.test(report)&&/Difficulty performance/.test(report)&&/Group strengths/.test(report)&&/Group priority areas/.test(report));
T("page 3 contains one shared roadmap",/Shared Group Roadmap/.test(report)&&/Shared lesson sequence/.test(report));
T("student scores are summarized",/Summarized student snapshot/.test(report)&&/Rami Khoury/.test(report));
T("high variation is flagged",/High variation/.test(report));
T("charts use offline CSS bars",/class="track"/.test(report)&&!/(cdn|https?:\/\/)/i.test(report));
T("all 28 shared lessons appear on report page 3",result.lesson_analysis.every(l=>report.includes(l.lesson_name)));
T("roadmap renders four controlled pages",(roadmap.match(/<section class="page/g)||[]).length===4);
T("roadmap lesson tables contain each lesson once",result.lesson_analysis.every(l=>(roadmap.split("<tr><td><b>"+l.lesson_name+"</b>").length-1)===1));
T("renderers emit no undefined/null/NaN/Infinity text",!/(>undefined<|>null<|NaN|Infinity)/.test(report+roadmap));
T("safe filenames are lowercase hyphenated",R.slug("October 2026 Trio")==="october-2026-trio"&&M.slug("October 2026 Trio")==="october-2026-trio");
T("exact button labels exist in packaging source",/Create group roadmap/.test(fs.readFileSync(path.join(ROOT,"optional-tools/build-shared-group-package.py"),"utf8"))&&/Create three page group report/.test(fs.readFileSync(path.join(ROOT,"optional-tools/build-shared-group-package.py"),"utf8")));
console.log(`\n==== ${pass} passed, ${fail} failed ====`);if(fail)process.exit(1);
