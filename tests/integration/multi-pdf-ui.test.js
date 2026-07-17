// Static/offline UI wiring regression checks for both multi-PDF workflows.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const html = fs.readFileSync(path.join(ROOT, "app/index.html"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "app/js/app-controller.js"), "utf8");
const group = fs.readFileSync(path.join(ROOT, "app/js/group-pdf-import.js"), "utf8");
const batch = fs.readFileSync(path.join(ROOT, "app/js/individual-batch-reports.js"), "utf8");
const exporter = fs.readFileSync(path.join(ROOT, "app/js/offline-pdf-export.js"), "utf8");

let pass = 0, fail = 0;
function T(name, condition) {
  if (condition) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name); }
}

console.log("[Multi-PDF UI and offline export wiring]");
T("exact group import label exists", html.includes("Import diagnostic PDF to group&hellip;"));
T("group PDF input accepts multiple files", /id="file-group-elmy-pdf"[^>]*multiple/.test(html));
T("individual PDF input accepts multiple files", /id="file-elmy-pdf"[^>]*multiple/.test(html));
T("group and individual summaries are live regions", /id="group-import-summary"[^>]*aria-live="polite"/.test(html) && /id="individual-batch-summary"[^>]*aria-live="polite"/.test(html));
T("all report and ZIP libraries are local", html.includes("vendor/jszip/jszip.min.js") &&
  ["vendor/html2canvas/html2canvas.min.js", "vendor/jspdf/jspdf.umd.min.js"].every(x => exporter.includes(x)) &&
  ["jszip/jszip.min.js", "html2canvas/html2canvas.min.js", "jspdf/jspdf.umd.min.js"].every(x => fs.existsSync(path.join(ROOT, "app/vendor", x))));
T("enhanced controller is the active application entry point", html.includes('src="js/app-controller.js"'));
T("app exposes explicit group roster API", app.includes("window.TP_APP_API") && app.includes("commitImportedGroupStudent") && app.includes("removeGroupStudentAt"));
T("group mutations invalidate old analysis", app.includes("tp:group-analysis-stale") && group.includes("Run group analysis to update"));
T("group importer processes files independently", group.includes("for (var index = 0; index < files.length; index++)") && group.includes("catch (error)"));
T("individual batch defines exactly three report kinds", ["detailed_diagnostic", "seven_page_roadmap", "two_page_report"].every(x => batch.includes(x)) && batch.includes("report_total:3"));
T("PDF blobs are copied out of temporary iframe realm", exporter.includes("stableBytes") && exporter.includes("new root.Blob"));
T("ZIP uses STORE for already-compressed PDFs", batch.includes('compression:"STORE"'));

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
