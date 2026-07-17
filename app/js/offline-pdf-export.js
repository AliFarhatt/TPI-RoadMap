/* Local HTML-to-PDF export for batch mode. Uses the bundled MIT html2pdf.js build. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TP_OFFLINE_PDF_EXPORT = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  function waitForImages(doc) {
    return Promise.all(Array.prototype.map.call(doc.images || [], function (image) {
      if (image.complete) return typeof image.decode === "function" ? image.decode().catch(function () {}) : Promise.resolve();
      return new Promise(function (resolve) {
        image.addEventListener("load", resolve, { once:true });
        image.addEventListener("error", resolve, { once:true });
      });
    }));
  }

  function waitForReady(doc) {
    var fonts = doc.fonts && doc.fonts.ready ? doc.fonts.ready.catch(function () {}) : Promise.resolve();
    return Promise.all([fonts, waitForImages(doc)]).then(function () {
      return new Promise(function (resolve) { (root.requestAnimationFrame || root.setTimeout)(function () { (root.requestAnimationFrame || root.setTimeout)(resolve); }); });
    });
  }

  async function validatePdfBlob(blob) {
    if (!blob || blob.size < 1000) throw new Error("The generated PDF is empty or incomplete.");
    var bytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    if (String.fromCharCode.apply(null, bytes) !== "%PDF-") throw new Error("The generated output is not a valid PDF file.");
    return { ok:true, size:blob.size };
  }

  function addBatchAssets(html, baseUri, options) {
    var scripts = options && (options.page_selector || options.vertical_slice_selector || options.semantic_text_selector)
      ? '<script src="vendor/html2canvas/html2canvas.min.js"><\/script><script src="vendor/jspdf/jspdf.umd.min.js"><\/script>'
      : '<script src="vendor/html2pdf/html2pdf.bundle.min.js"><\/script>';
    var additions = '<base href="' + String(baseUri).replace(/&/g,"&amp;").replace(/"/g,"&quot;") + '">' +
      '<style id="batch-pdf-css">html,body{background:#fff!important}.toolbar{display:none!important}</style>' + scripts;
    return /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, "<head$1>" + additions) : "<!doctype html><html><head>" + additions + "</head><body>" + html + "</body></html>";
  }

  async function renderPageElements(win, doc, selector, options) {
    var elements = Array.prototype.slice.call(doc.querySelectorAll(selector));
    if (!elements.length) throw new Error("The report page containers could not be found.");
    if (options.expected_pages && elements.length !== options.expected_pages) throw new Error("Expected " + options.expected_pages + " report pages; found " + elements.length + ".");
    var Canvas = win.html2canvas, Pdf = win.jspdf && win.jspdf.jsPDF;
    if (typeof Canvas !== "function" || typeof Pdf !== "function") throw new Error("The bundled page renderer is unavailable.");
    var pdf = new Pdf({ unit:"mm", format:"a4", orientation:"portrait", compress:true });
    for (var index = 0; index < elements.length; index++) {
      if (index) pdf.addPage("a4", "portrait");
      var element = elements[index], canvas = await Canvas(element, {
        scale:options.scale || 1.25, useCORS:false, allowTaint:true, logging:false, backgroundColor:"#ffffff", imageTimeout:15000,
        windowWidth:Math.max(800, element.scrollWidth), windowHeight:Math.max(1120, element.scrollHeight)
      });
      var ratio = canvas.width / canvas.height, width = 210, height = width / ratio;
      if (height > 297) { height = 297; width = height * ratio; }
      var x = (210 - width) / 2, y = (297 - height) / 2;
      pdf.addImage(canvas.toDataURL("image/jpeg", options.quality || 0.94), "JPEG", x, y, width, height, undefined, "FAST");
      canvas.width = 1; canvas.height = 1;
      await new Promise(function (resolve) { root.setTimeout(resolve, 0); });
    }
    return pdf.output("blob");
  }

  function semanticSliceEnds(element, pageHeight) {
    var base = element.getBoundingClientRect(), total = Math.ceil(element.scrollHeight), ends = [], selector =
      "h1,h2,h3,p,.card,.calc,.warn,.err,.ok,.statgrid,table tr,.footer";
    Array.prototype.forEach.call(element.querySelectorAll(selector), function (node) {
      var rect = node.getBoundingClientRect(), bottom = Math.round(rect.bottom - base.top);
      if (bottom > 0 && bottom < total) ends.push(bottom);
    });
    ends.sort(function (a, b) { return a - b; });
    var slices = [], start = 0;
    while (start < total) {
      var target = Math.min(total, start + pageHeight), minimum = start + pageHeight * 0.58, end = target;
      if (target < total) {
        for (var i = 0; i < ends.length; i++) {
          if (ends[i] > target) break;
          if (ends[i] >= minimum) end = ends[i];
        }
      }
      if (end <= start + 40) end = target;
      slices.push({ y:start, height:Math.max(1, end - start) });
      start = end;
    }
    return slices;
  }

  async function renderVerticalSlices(win, doc, selector, options) {
    var element = doc.querySelector(selector);
    if (!element) throw new Error("The detailed report container could not be found.");
    var Canvas = win.html2canvas, Pdf = win.jspdf && win.jspdf.jsPDF;
    if (typeof Canvas !== "function" || typeof Pdf !== "function") throw new Error("The bundled page renderer is unavailable.");
    var widthPx = Math.max(720, Math.ceil(element.scrollWidth));
    var pageHeight = Math.floor(widthPx * 297 / 210);
    var slices = semanticSliceEnds(element, pageHeight);
    var pdf = new Pdf({ unit:"mm", format:"a4", orientation:"portrait", compress:true });
    for (var index = 0; index < slices.length; index++) {
      if (index) pdf.addPage("a4", "portrait");
      var slice = slices[index];
      var canvas = await Canvas(element, {
        scale:options.scale || 0.8, useCORS:false, allowTaint:true, logging:false, backgroundColor:"#ffffff", imageTimeout:15000,
        x:0, y:slice.y, width:widthPx, height:slice.height,
        windowWidth:Math.max(800, widthPx), windowHeight:Math.max(1120, slice.height)
      });
      var ratio = canvas.width / canvas.height, width = 210, height = width / ratio;
      if (height > 297) { height = 297; width = height * ratio; }
      pdf.addImage(canvas.toDataURL("image/jpeg", options.quality || 0.92), "JPEG", 0, 0, width, height, undefined, "FAST");
      canvas.width = 1; canvas.height = 1;
      await new Promise(function (resolve) { root.setTimeout(resolve, 0); });
    }
    return pdf.output("blob");
  }

  function pdfSafeText(value) {
    return String(value == null ? "" : value)
      .replace(/\u00a0/g, " ").replace(/[\u2010-\u2015]/g, "-").replace(/\u2192/g, "->")
      .replace(/\u2713/g, "PASS").replace(/\u2717/g, "FAIL").replace(/\u00d7/g, "x")
      .replace(/[\t\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
  }

  function renderSemanticTextPdf(win, doc, selector) {
    var container = doc.querySelector(selector), Pdf = win.jspdf && win.jspdf.jsPDF;
    if (!container) throw new Error("The detailed report container could not be found.");
    if (typeof Pdf !== "function") throw new Error("The bundled document renderer is unavailable.");
    var pdf = new Pdf({ unit:"mm", format:"a4", orientation:"portrait", compress:true });
    var left = 12, right = 12, top = 13, bottom = 14, width = 210 - left - right, y = top;
    function ensure(height) { if (y + height > 297 - bottom) { pdf.addPage("a4", "portrait"); y = top; } }
    function write(text, size, style, color, indent, gap) {
      text = pdfSafeText(text); if (!text) return;
      indent = indent || 0; size = size || 8; gap = gap == null ? 1.4 : gap;
      pdf.setFont("helvetica", style || "normal"); pdf.setFontSize(size);
      pdf.setTextColor.apply(pdf, color || [25, 31, 43]);
      var lines = pdf.splitTextToSize(text, width - indent), lineHeight = size * 0.39;
      for (var i = 0; i < lines.length; i++) { ensure(lineHeight + gap); pdf.text(lines[i], left + indent, y); y += lineHeight; }
      y += gap;
    }
    function divider() { ensure(2); pdf.setDrawColor(222, 226, 234); pdf.line(left, y, 210 - right, y); y += 2; }
    function renderTable(table) {
      var rows = Array.prototype.slice.call(table.querySelectorAll("tr"));
      if (!rows.length) return;
      var headers = Array.prototype.map.call(rows[0].children, function (cell) { return pdfSafeText(cell.textContent); });
      write(headers.join(" | "), 6.4, "bold", [255,255,255], 1.5, 1.2);
      var headerY = y;
      pdf.setFillColor(12, 23, 48); pdf.rect(left, Math.max(top, headerY - 5.2), width, 5.7, "F");
      /* Redraw the header above its background. */
      y = Math.max(top, headerY - 4.1); write(headers.join(" | "), 6.4, "bold", [255,255,255], 1.5, 1.6);
      for (var rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        var cells = Array.prototype.map.call(rows[rowIndex].children, function (cell, cellIndex) {
          var label = headers[cellIndex] || ("Field " + (cellIndex + 1));
          return label + ": " + pdfSafeText(cell.textContent);
        });
        write(cells.join(" | "), 6.5, "normal", [31,38,52], 1.5, 0.7);
        divider();
      }
      y += 1.5;
    }
    Array.prototype.forEach.call(container.children, function (node) {
      var tag = node.tagName && node.tagName.toLowerCase(), cls = node.classList || { contains:function () { return false; } };
      if (tag === "h1") { write(node.textContent, 18, "bold", [12,23,48], 0, 3); return; }
      if (tag === "h2") { ensure(12); pdf.setDrawColor(23,64,169); pdf.setLineWidth(0.7); pdf.line(left, y, 210-right, y); y += 4; write(node.textContent, 11, "bold", [12,23,48], 0, 2); return; }
      if (tag === "h3") { write(node.textContent, 9, "bold", [20,24,31], 0, 1.5); return; }
      if (tag === "table") { renderTable(node); return; }
      if (cls.contains("statgrid")) {
        var stats = Array.prototype.map.call(node.querySelectorAll(".stat"), function (stat) {
          var value = stat.querySelector(".v"), label = stat.querySelector(".l");
          return pdfSafeText(label && label.textContent) + ": " + pdfSafeText(value && value.textContent);
        });
        write(stats.join("   |   "), 8, "bold", [23,64,169], 0, 3); return;
      }
      if (cls.contains("kicker")) { write(node.textContent, 7, "bold", [199,86,10], 0, 1.5); return; }
      if (cls.contains("meta")) { write(node.textContent, 7.3, "normal", [90,99,115], 0, 1.5); return; }
      if (cls.contains("warn") || cls.contains("err") || cls.contains("ok")) {
        write(node.textContent, 7.8, "bold", cls.contains("err") ? [150,45,35] : cls.contains("warn") ? [160,83,15] : [31,110,76], 2, 2); return;
      }
      write(node.textContent, 7.8, cls.contains("card") || cls.contains("calc") ? "normal" : "normal", [31,38,52], cls.contains("card") || cls.contains("calc") ? 2 : 0, 2);
    });
    var pages = pdf.getNumberOfPages();
    for (var pageNumber = 1; pageNumber <= pages; pageNumber++) {
      pdf.setPage(pageNumber); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(120,128,141);
      pdf.text("TESTPREP - Detailed diagnostic report", left, 291); pdf.text(pageNumber + " / " + pages, 210 - right, 291, { align:"right" });
    }
    return pdf.output("blob");
  }

  async function renderHtmlToPdfBlob(html, options) {
    options = options || {};
    if (!root.document || !root.document.body) throw new Error("PDF export requires a browser document.");
    var iframe = root.document.createElement("iframe");
    iframe.setAttribute("title", "Temporary local PDF renderer");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;left:-20000px;top:0;width:210mm;height:297mm;border:0;visibility:visible;pointer-events:none;";
    root.document.body.appendChild(iframe);
    try {
      var loaded = new Promise(function (resolve, reject) {
        var timer = root.setTimeout(function () { reject(new Error("The local PDF renderer did not become ready.")); }, options.timeout_ms || 45000);
        iframe.onload = function () { root.clearTimeout(timer); resolve(); };
      });
      iframe.srcdoc = addBatchAssets(String(html || ""), root.document.baseURI, options);
      await loaded;
      var win = iframe.contentWindow, doc = iframe.contentDocument;
      if (!win || !doc) throw new Error("The local PDF render frame is unavailable.");
      await waitForReady(doc);
      if (!options.page_selector && !options.vertical_slice_selector && !options.semantic_text_selector && typeof win.html2pdf !== "function") throw new Error("The bundled local PDF exporter could not be loaded.");
      var toolbar = doc.querySelector(".toolbar");
      if (toolbar) toolbar.remove();
      var opt = {
        margin:0,
        image:{ type:"jpeg", quality:0.97 },
        html2canvas:{ scale:options.scale || 1.15, useCORS:false, allowTaint:true, logging:false, backgroundColor:"#ffffff", imageTimeout:15000 },
        jsPDF:{ unit:"mm", format:"a4", orientation:"portrait", compress:true },
        pagebreak:{ mode:["css", "legacy"] }
      };
      var blob = options.page_selector
        ? await renderPageElements(win, doc, options.page_selector, options)
        : options.vertical_slice_selector
          ? await renderVerticalSlices(win, doc, options.vertical_slice_selector, options)
          : options.semantic_text_selector
            ? renderSemanticTextPdf(win, doc, options.semantic_text_selector, options)
          : await win.html2pdf().set(opt).from(doc.body).toPdf().outputPdf("blob");
      await validatePdfBlob(blob);
      /* The renderer creates the Blob in the temporary iframe's JavaScript realm.
         Copy its bytes into the application realm before removing the iframe so
         later validation and ZIP packaging remain reliable in every browser. */
      var stableBytes = await blob.arrayBuffer();
      return new root.Blob([stableBytes], { type:"application/pdf" });
    } finally {
      try { iframe.src = "about:blank"; } catch (ignored) {}
      iframe.remove();
    }
  }

  return { renderHtmlToPdfBlob:renderHtmlToPdfBlob, renderPageElements:renderPageElements, renderVerticalSlices:renderVerticalSlices, renderSemanticTextPdf:renderSemanticTextPdf, validatePdfBlob:validatePdfBlob, waitForImages:waitForImages };
});
