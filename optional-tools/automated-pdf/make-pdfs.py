#!/usr/bin/env python3
"""Optional automated PDF helper.
Renders any of the generated HTML documents (roadmaps, instructor reports,
group reports) to A4 PDF without opening a browser window.

REQUIREMENTS (optional; the main application never needs this):
  pip install playwright && playwright install chromium

USAGE:
  python3 make-pdfs.py <input.html> [more.html ...] [-o output_dir]

The helper fails gracefully: if Playwright or Chromium is missing it prints
instructions and exits with a clear message instead of crashing. Every PDF is
verified after generation (header, EOF marker, page objects present).
"""
import os, sys, shutil

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-o")]
    out = "."
    if "-o" in sys.argv:
        out = sys.argv[sys.argv.index("-o") + 1]
        args = [a for a in args if a != out]
    if not args:
        print(__doc__); return 2
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright is not installed. This helper is OPTIONAL: you can always\n"
              "print any document from your browser (File > Print > Save as PDF).\n"
              "To enable it:  pip install playwright && playwright install chromium")
        return 1
    os.makedirs(out, exist_ok=True)
    try:
        with sync_playwright() as p:
            try:
                bundled = p.chromium.executable_path
                executable = bundled if os.path.exists(bundled) else (shutil.which("chromium") or shutil.which("google-chrome"))
                if not executable:
                    raise RuntimeError("no Playwright or system Chromium executable found")
                browser = p.chromium.launch(executable_path=executable, args=["--no-sandbox"])
            except Exception as e:
                print("Chromium is not available (%s).\nRun: playwright install chromium, or install a system Chromium browser.\n"
                      "Browser printing remains fully available as the primary method." % e)
                return 1
            page = browser.new_page()
            code = 0
            for src in args:
                src = os.path.abspath(src)
                if not os.path.exists(src):
                    print("missing:", src); code = 1; continue
                dst = os.path.join(out, os.path.splitext(os.path.basename(src))[0] + ".pdf")
                page.goto("file://" + src)
                page.wait_for_timeout(300)
                page.pdf(path=dst, format="A4", print_background=True, prefer_css_page_size=True)
                data = open(dst, "rb").read()
                ok = data[:5] == b"%PDF-" and b"%%EOF" in data[-64:] and b"/Type /Page" in data
                print(("verified: " if ok else "FAILED VERIFICATION: ") + dst)
                if not ok: code = 1
            browser.close()
            return code
    except Exception as e:
        print("PDF helper failed gracefully:", e)
        return 1

if __name__ == "__main__":
    sys.exit(main())
