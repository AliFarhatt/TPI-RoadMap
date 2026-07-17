// Browser/file:// end-to-end Elmy import test. Requires a Playwright-compatible
// Chromium executable and a private genuine PDF supplied at run time:
// ELMY_PDF_FIXTURE=/path/report.pdf CHROMIUM_EXECUTABLE=/path/chromium \
//   NODE_PATH=/path/to/playwright-core/node_modules node tests/integration/elmy-browser-import.test.js
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const fixture = process.env.ELMY_PDF_FIXTURE;
const executable = process.env.CHROMIUM_EXECUTABLE;
if (!fixture || !executable) {
  console.log("SKIP: set ELMY_PDF_FIXTURE and CHROMIUM_EXECUTABLE to run the file:// browser import test.");
  process.exit(0);
}
const { chromium } = require("playwright-core");
const ROOT = path.join(__dirname, "..", "..");

let pass = 0, fail = 0;
function T(name, condition, detail) {
  if (condition) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? " :: " + detail : "")); }
}

(async function () {
  const browser = await chromium.launch({
    executablePath: executable,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files", "--disable-web-security"]
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [], externalRequests = [];
  page.on("pageerror", error => pageErrors.push(String(error)));
  page.on("request", request => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });

  console.log("[file:// application and genuine PDF]");
  await page.goto(pathToFileURL(path.join(ROOT, "app/index.html")).href, { waitUntil: "load" });
  T("app opens directly through file://", page.url().startsWith("file://"));
  T("import button label is exact", await page.locator("#btn-load-elmy-pdf").innerText() === "Import Elmy diagnostic PDF…");
  T("local PDF.js and importer are loaded", await page.evaluate(() => !!window.pdfjsLib && !!window.TP_ELMY_IMPORTER));
  T("no external requests are made on startup", externalRequests.length === 0, externalRequests.join(", "));

  await page.setInputFiles("#file-elmy-pdf", fixture);
  await page.waitForFunction(() => !document.getElementById("elmy-import-review").classList.contains("hidden"), null, { timeout: 60000 });
  const review = await page.locator("#elmy-import-review").innerText();
  T("student is loaded into the planner", await page.inputValue("#f-name") === "Nayla El Azzi");
  T("scores are loaded", await page.inputValue("#f-rw") === "660" && await page.inputValue("#f-math") === "610" && await page.inputValue("#f-total") === "1270");
  T("unsupported availability remains blank", await page.inputValue("#f-spw") === "" && await page.inputValue("#f-accom") === "");
  T("review reports 98/98, 79/79, and 71/71", /98\/98/.test(review) && /79\/79/.test(review) && /71\/71/.test(review), review);
  T("review reports conversion and difficulty checks", /GLOBAL CONVERSION\s+Passed/.test(review) && /22 easy · 35 medium · 41 hard/.test(review));
  T("success message uses actual totals", await page.locator("#messages").innerText().then(text => /98 questions, 79 answered, 71 correct/.test(text)));
  T("PDF import makes no network request", externalRequests.length === 0, externalRequests.join(", "));
  T("no browser JavaScript errors during import", pageErrors.length === 0, pageErrors.join(" | "));

  console.log("[analysis, export/re-import, and reports]");
  await page.click("#btn-run");
  await page.waitForFunction(() => !document.getElementById("panel-results").classList.contains("hidden"));
  T("imported case runs through the planning engine", /Results: Nayla El Azzi/.test(await page.locator("#results-title").innerText()));

  async function checkPopup(buttonName, predicate, label) {
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: buttonName, exact: true }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    await popup.waitForTimeout(150);
    const html = await popup.content();
    T(label, predicate(html), html.slice(0, 180));
    await popup.close();
  }
  await checkPopup("Open detailed report (print for PDF)", html => /Nayla El Azzi/.test(html) && /audit trail/i.test(html), "detailed report opens after import");
  await checkPopup("Open seven-page roadmap (print for PDF)", html => /Nayla El Azzi/.test(html) && (html.match(/class=\"[^\"]*pagebreak/g) || []).length === 6, "seven-page roadmap opens after import");
  await checkPopup("Create two page report", html => /Nayla El Azzi/.test(html) && (html.match(/class=\"pg two-page-report-page/g) || []).length === 2, "two-page report opens after import");

  const downloadPromise = page.waitForEvent("download");
  await page.click("#btn-export-input");
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  const exported = JSON.parse(fs.readFileSync(downloadedPath, "utf8"));
  T("exported input contains all 98 answers", exported.diagnostic.answers.length === 98);
  T("export preserves reported totals and source validation", exported.diagnostic.reported_summary.answered_questions === 79 && exported.source_validation.actual_answer_records === 98);
  T("export does not invent availability or accommodation", exported.availability.preferred_sessions_per_week === null && exported.availability.accommodation === null);

  await page.setInputFiles("#file-json", downloadedPath);
  await page.waitForFunction(() => document.getElementById("f-name").value === "Nayla El Azzi");
  T("exported JSON re-imports into the same student", await page.inputValue("#f-name") === "Nayla El Azzi");
  T("JSON re-import retains all answer records", /98 of 98 questions recorded/.test(await page.locator("#a-progress").innerText()));
  await page.click("#btn-run");
  await page.waitForFunction(() => !document.getElementById("panel-results").classList.contains("hidden"));
  T("re-imported JSON produces the same analysis surface", /Results: Nayla El Azzi/.test(await page.locator("#results-title").innerText()));
  T("no browser JavaScript errors after reports and round-trip", pageErrors.length === 0, pageErrors.join(" | "));

  if (process.env.ELMY_BROWSER_SCREENSHOT) {
    await page.screenshot({ path: process.env.ELMY_BROWSER_SCREENSHOT, fullPage: true });
  }
  await browser.close();
  console.log("\n==== " + pass + " passed, " + fail + " failed ====");
  if (fail) process.exit(1);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
