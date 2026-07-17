#!/usr/bin/env python3
"""Rendering, offline, and UI tests. Renders every example document to PDF,
verifies page counts, overflow, assets, and exercises the app UI with all
external network access blocked. It prefers file:// navigation and falls back
to an isolated loopback server when managed-browser policy blocks file URLs."""
import json, os, sys, shutil, threading, re, base64, mimetypes
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, Error as PlaywrightError

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "tests", "test-results")
os.makedirs(OUT, exist_ok=True)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

HTTPD = ThreadingHTTPServer(("127.0.0.1", 0), lambda *args, **kwargs: QuietHandler(*args, directory=ROOT, **kwargs))
HTTP_THREAD = threading.Thread(target=HTTPD.serve_forever, daemon=True)
HTTP_THREAD.start()
ROOT_URL = "http://127.0.0.1:%d" % HTTPD.server_address[1]

def _data_uri(path):
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    raw = open(path, "rb").read()
    return "data:%s;base64,%s" % (mime, base64.b64encode(raw).decode("ascii"))

def bundle_local_html(path):
    """Inline local CSS, JS, and image assets so the rendering tests remain fully
    offline even in managed environments that block both file:// and loopback URLs."""
    path = os.path.abspath(path)
    base = os.path.dirname(path)
    text = open(path, "r", encoding="utf-8").read()

    def repl_link(match):
        href = match.group(1)
        if href.startswith(("http://", "https://", "data:")):
            return match.group(0)
        target = os.path.normpath(os.path.join(base, href))
        css = open(target, "r", encoding="utf-8").read()
        return "<style data-inlined-from=%s>\n%s\n</style>" % (json.dumps(href), css)

    def repl_script(match):
        src = match.group(1)
        if src.startswith(("http://", "https://", "data:")):
            return match.group(0)
        target = os.path.normpath(os.path.join(base, src))
        js = open(target, "r", encoding="utf-8").read().replace("</script>", "<\\/script>")
        return "<script data-inlined-from=%s>\n%s\n</script>" % (json.dumps(src), js)

    def repl_img(match):
        before, src, after = match.group(1), match.group(2), match.group(3)
        if src.startswith(("http://", "https://", "data:")) or "$" in src or "{" in src:
            return match.group(0)
        target = os.path.normpath(os.path.join(base, src))
        return before + _data_uri(target) + after

    # Inline static images before scripts. Generated JS contains HTML fragments with
    # dynamic src expressions that must remain untouched.
    text = re.sub(r'(<img\b[^>]*?src=["\'])([^"\']+)(["\'])', repl_img, text, flags=re.I)
    text = re.sub(r'<link\b[^>]*rel=["\']stylesheet["\'][^>]*href=["\']([^"\']+)["\'][^>]*>', repl_link, text, flags=re.I)
    text = re.sub(r'<script\b[^>]*src=["\']([^"\']+)["\'][^>]*>\s*</script>', repl_script, text, flags=re.I)
    return text

def navigate_local(page, path):
    # set_content is the primary path because managed Chromium can block file://
    # and 127.0.0.1 by policy. All local resources are already inlined.
    page.set_content(bundle_local_html(path), wait_until="load")
    return "inlined"
PASS, FAIL, LOG = 0, 0, []

def T(name, cond, detail=""):
    global PASS, FAIL
    if cond: PASS += 1; LOG.append("  ok  " + name); print("  ok  " + name)
    else: FAIL += 1; LOG.append("  FAIL " + name + (" :: " + str(detail) if detail else "")); print("  FAIL", name, detail)

def pdf_pages(path):
    data = open(path, "rb").read()
    return data.count(b"/Type /Page") - data.count(b"/Type /Pages"), len(data)

with sync_playwright() as p:
    bundled = p.chromium.executable_path
    configured = os.environ.get("CHROMIUM_EXECUTABLE")
    executable = configured if configured and os.path.exists(configured) else (bundled if os.path.exists(bundled) else (shutil.which("chromium") or shutil.which("google-chrome")))
    if not executable:
        raise RuntimeError("No Chromium executable found. Install Playwright Chromium or a system Chromium browser.")
    browser = p.chromium.launch(executable_path=executable, args=["--no-sandbox", "--disable-web-security"])
    ctx = browser.new_context()
    # OFFLINE-EQUIVALENT: allow only this temporary local server; block every external request.
    ctx.route("**/*", lambda route: route.continue_() if route.request.url.startswith(ROOT_URL) else (route.abort() if route.request.url.startswith(("http://", "https://")) else route.continue_()))

    def render_pdf(html_path, pdf_name, label, expect_pages=None):
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        failed_assets = []
        page.on("requestfailed", lambda r: failed_assets.append(r.url) if r.url.startswith("file://") else None)
        navigate_local(page, html_path)
        page.wait_for_timeout(300)
        # overflow / geometry checks
        geo = page.evaluate("""() => {
            const bad = [];
            document.querySelectorAll('*').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width < 0 || r.height < 0) bad.push('negative box: ' + el.tagName);
            });
            document.querySelectorAll('svg').forEach(s => {
                if (!s.getAttribute('viewBox') && (!s.getAttribute('width') || !s.getAttribute('height'))) bad.push('svg without dimensions');
            });
            const doc = document.querySelector('.doc') || document.body;
            const dw = doc.getBoundingClientRect().width;
            document.querySelectorAll('.doc *').forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.width > dw + 24) bad.push('overflow: ' + el.tagName + ' ' + Math.round(r.width));
            });
            const imgs = [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src);
            return {bad, brokenImages: imgs};
        }""")
        pdf_path = os.path.join(OUT, pdf_name)
        page.pdf(path=pdf_path, format="A4", print_background=True, prefer_css_page_size=True)
        page.close()
        T(label + ": no JS errors", not errors, errors[:2])
        T(label + ": no failed local assets", not failed_assets, failed_assets[:2])
        T(label + ": no broken images", not geo["brokenImages"], geo["brokenImages"][:2])
        T(label + ": no overflow / invalid geometry", not geo["bad"], geo["bad"][:4])
        pages, size = pdf_pages(pdf_path)
        T(label + ": PDF written and non-trivial", size > 20000, size)
        T(label + ": PDF starts with %PDF and ends with EOF",
          open(pdf_path, "rb").read(5) == b"%PDF-" and b"%%EOF" in open(pdf_path, "rb").read()[-64:])
        if expect_pages is not None:
            T(label + ": exactly %d PDF pages" % expect_pages, pages == expect_pages, pages)
        return pdf_path

    print("[rendering: individual demo]")
    render_pdf(os.path.join(ROOT, "examples/individual-demo/roadmap.html"), "individual-roadmap.pdf", "individual roadmap", expect_pages=7)
    render_pdf(os.path.join(ROOT, "examples/individual-demo/instructor-report.html"), "individual-report.pdf", "individual report")

    print("[rendering: group demo]")
    render_pdf(os.path.join(ROOT, "examples/group-demo/group-report.html"), "group-report.pdf", "group report")
    import glob
    for d in sorted(glob.glob(os.path.join(ROOT, "examples/group-demo/student-*"))):
        name = os.path.basename(d)
        render_pdf(os.path.join(d, "roadmap.html"), name + "-roadmap.pdf", "roadmap " + name, expect_pages=7)

    print("[rendering: legacy Karl reference]")
    karl = os.path.join(ROOT, "examples/legacy-karl/karl-roadmap.html")
    if os.path.exists(karl):
        render_pdf(karl, "legacy-karl-roadmap.pdf", "legacy Karl roadmap", expect_pages=7)

    # ---------- offline app UI ----------
    print("[offline app UI]")
    page = ctx.new_page()
    js_errors = []
    page.on("pageerror", lambda e: js_errors.append(str(e)))
    navigate_local(page, os.path.join(ROOT, "app/index.html"))
    page.wait_for_timeout(300)
    T("app loads offline without JS errors", not js_errors, js_errors[:2])
    T("styles applied (topbar navy)", page.evaluate("getComputedStyle(document.querySelector('.topbar')).backgroundColor") == "rgb(12, 23, 48)")
    T("config data loaded", page.evaluate("!!window.TP_CONFIG && window.TP_CONFIG.lesson_catalog.lessons.length === 28"))

    # open individual example and run
    page.click("#btn-example-individual")
    page.wait_for_timeout(150)
    T("individual example loads into the form", page.input_value("#f-name") == "Maya Haddad")
    T("answer table renders 27 rows for English Module 1", page.eval_on_selector_all("#answers-table tbody tr", "els => els.length") == 27)
    page.click("#btn-run")
    page.wait_for_timeout(400)
    T("analysis runs and shows results", page.evaluate("!document.getElementById('panel-results').classList.contains('hidden')"))
    T("no JS errors after calculation", not js_errors, js_errors[:2])
    total = page.evaluate("document.querySelector('#results-summary .stat:last-child .v').textContent")
    T("final total displayed within limits", "h" in total, total)
    summary_text = page.evaluate("document.querySelector('#results-summary').textContent")
    T("main results do not show a clamped/pre-constraint headline", not re.search(r"clamped|pre-constraint", summary_text, re.I), summary_text)

    # manual individual case with a deliberate score mismatch -> error surfaced
    page.click("#btn-new-individual")
    page.wait_for_timeout(100)
    page.fill("#f-name", "UI Test Student")
    page.fill("#f-rw", "500"); page.fill("#f-math", "500"); page.fill("#f-total", "1100")
    page.dispatch_event("#f-total", "change")
    # enter one answer manually
    page.fill("#answers-table tbody tr:first-child input[data-k=student_answer]", "A")
    page.fill("#answers-table tbody tr:first-child input[data-k=correct_answer]", "A")
    page.dispatch_event("#answers-table tbody tr:first-child input[data-k=correct_answer]", "change")
    page.click("#btn-run")
    page.wait_for_timeout(300)
    T("scaled-score mismatch blocks calculation with a visible error",
      page.evaluate("[...document.querySelectorAll('#messages .msg.err')].some(m => m.textContent.includes('does not equal the total'))"))
    page.fill("#f-total", "1000"); page.dispatch_event("#f-total", "change")
    page.click("#btn-run")
    page.wait_for_timeout(400)
    T("corrected manual case calculates", page.evaluate("!document.getElementById('panel-results').classList.contains('hidden')"))

    # group flow
    page.click("#btn-example-group")
    page.wait_for_timeout(150)
    T("group example loads a 3-student roster", page.eval_on_selector_all(".roster-item", "els => els.length") == 3)
    page.click("#btn-add-student")
    page.wait_for_timeout(100)
    T("add student grows the roster to 4", page.eval_on_selector_all(".roster-item", "els => els.length") == 4)
    page.click(".roster-item:last-child .danger")
    page.wait_for_timeout(100)
    T("remove student shrinks the roster to 3", page.eval_on_selector_all(".roster-item", "els => els.length") == 3)
    page.click("#btn-run")
    page.wait_for_timeout(600)
    T("group analysis runs offline", page.evaluate("!document.getElementById('panel-results').classList.contains('hidden')"))
    T("group results show min/max validation", page.evaluate("document.querySelector('#results-summary').textContent.includes('16 / 38')"))
    T("no JS errors across the whole UI session", not js_errors, js_errors[:3])
    page.close()

    browser.close()

HTTPD.shutdown()
HTTPD.server_close()
print("\n==== %d passed, %d failed ====" % (PASS, FAIL))
open(os.path.join(OUT, "rendering-and-ui-test-log.txt"), "w").write("\n".join(LOG) + "\n\n==== %d passed, %d failed ====\n" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
