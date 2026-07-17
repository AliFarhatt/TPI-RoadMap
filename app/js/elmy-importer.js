/* Offline Elmy Assessment Report importer.
 *
 * The supported format is the text-based Elmy "Diagnostic Exam 2026" export.
 * PDF.js supplies text items; all report interpretation, validation, numbering,
 * and case construction remain deterministic local code in this file.
 */
(function (root, factory) {
  "use strict";
  var api = factory(root || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.TP_ELMY_IMPORTER = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function (root) {
  "use strict";

  var PARSER_VERSION = "1.0.0";
  var TEMPLATE_ID = "Diagnostic_Exam_2026";
  var EXPECTED_QUESTIONS = 98;
  var DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

  function ImportError(code, message, details) {
    this.name = "ElmyImportError";
    this.code = code;
    this.message = message;
    this.details = details || null;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ImportError);
  }
  ImportError.prototype = Object.create(Error.prototype);
  ImportError.prototype.constructor = ImportError;

  function fail(code, message, details) {
    throw new ImportError(code, message, details);
  }

  function r1(n) { return Math.round(n * 10) / 10; }
  function stripPrivateUse(s) { return String(s == null ? "" : s).replace(/[\uE000-\uF8FF]/g, ""); }
  function tidyText(s) {
    return stripPrivateUse(s).replace(/\u00a0/g, " ").replace(/[ \t\f\v]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  }
  function compact(s) {
    return stripPrivateUse(s).normalize ? stripPrivateUse(s).normalize("NFKC").replace(/\s+/g, "") : stripPrivateUse(s).replace(/\s+/g, "");
  }
  function compactLower(s) { return compact(s).toLowerCase(); }
  function countChar(s, ch) { return (String(s).match(new RegExp("\\" + ch, "g")) || []).length; }

  function normalizeItem(item) {
    var t = item.transform || [1, 0, 0, 1, 0, 0];
    return {
      str: String(item.str == null ? "" : item.str),
      x: Number(t[4]) || 0,
      y: Number(t[5]) || 0,
      width: Number(item.width) || 0,
      height: Number(item.height) || Math.abs(Number(t[3])) || 0,
      fontName: item.fontName || null
    };
  }

  function groupLines(items, tolerance, pageNumber, pageWidth) {
    var tol = tolerance == null ? 3.0 : tolerance;
    var sorted = (items || []).slice().sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var lines = [];
    sorted.forEach(function (item) {
      if (!item.str && !item.width) return;
      var line = null;
      for (var i = lines.length - 1; i >= 0 && i >= lines.length - 5; i--) {
        if (Math.abs(lines[i].y - item.y) <= tol) { line = lines[i]; break; }
      }
      if (!line) {
        line = { y: item.y, items: [], pageNumber: pageNumber || null, pageWidth: pageWidth || null };
        lines.push(line);
      }
      line.items.push(item);
    });
    lines.forEach(function (line) {
      line.items.sort(function (a, b) { return a.x - b.x; });
      line.text = tidyText(line.items.map(function (item) { return item.str; }).join(""));
      line.compact = compact(line.text);
    });
    return lines.sort(function (a, b) { return b.y - a.y; });
  }

  function joinCellItems(items) {
    var lines = groupLines(items || [], 2.8);
    var out = "";
    lines.forEach(function (line) {
      var part = tidyText(line.items.map(function (item) { return item.str; }).join(""));
      if (!part) return;
      if (!out) { out = part; return; }
      // A line break inside a $...$ expression is layout only, not a space.
      var mathOpen = countChar(out, "$") % 2 === 1;
      var noSpace = mathOpen || /[\\{[(=+\-^/]$/.test(out) || /^[})\],.;:+\-^/]/.test(part);
      out += noSpace ? part : " " + part;
    });
    return tidyText(out);
  }

  function normalizeAnswer(value) {
    if (value == null) return null;
    var s = tidyText(value);
    if (!s || /^[\u2013\u2014\u2212-]+$/.test(s)) return null;
    if (s.length >= 2 && s.charAt(0) === "$" && s.charAt(s.length - 1) === "$" && countChar(s, "$") === 2) {
      s = s.slice(1, -1).trim();
    }
    return s || null;
  }

  function pageCompact(page) {
    return compactLower((page.items || []).map(function (item) { return item.str; }).join(""));
  }

  async function loadPdfDocument(arrayBuffer, pdfjs, options) {
    options = options || {};
    pdfjs = pdfjs || root.pdfjsLib;
    if (!pdfjs || typeof pdfjs.getDocument !== "function") {
      fail("PDF_RUNTIME_MISSING", "The local PDF parser could not be started. Re-extract the complete package and try again.");
    }
    if (!arrayBuffer || !arrayBuffer.byteLength) fail("EMPTY_FILE", "The selected PDF file is empty.");
    if (arrayBuffer.byteLength > (options.maxBytes || DEFAULT_MAX_BYTES)) {
      fail("FILE_TOO_LARGE", "The selected PDF is larger than the supported 25 MB import limit.");
    }

    if (pdfjs.GlobalWorkerOptions && (options.workerSrc || typeof document !== "undefined")) {
      var workerSrc = options.workerSrc || "vendor/pdfjs/pdf.worker.min.js";
      try {
        if (typeof document !== "undefined" && document.baseURI) workerSrc = new URL(workerSrc, document.baseURI).href;
      } catch (ignored) {}
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    }

    try {
      var bytes = new Uint8Array(arrayBuffer.slice ? arrayBuffer.slice(0) : arrayBuffer);
      return await pdfjs.getDocument({
        data: bytes,
        isEvalSupported: false,
        useSystemFonts: true,
        stopAtErrors: false
      }).promise;
    } catch (err) {
      var msg = String(err && err.message || err || "");
      if (/password/i.test(msg)) fail("PASSWORD_PROTECTED", "Password-protected PDFs are not supported by the automatic importer.", msg);
      if (/invalid|corrupt|format|header|xref/i.test(msg)) fail("CORRUPTED_PDF", "The selected file is not a readable PDF or is corrupted.", msg);
      fail("PDF_OPEN_FAILED", "The PDF could not be opened by the local parser.", msg);
    }
  }

  async function extractPdfPages(pdfDocument, onProgress) {
    var pages = [];
    var total = pdfDocument && pdfDocument.numPages || 0;
    if (!total) fail("NO_PAGES", "The selected PDF does not contain any pages.");
    for (var pageNumber = 1; pageNumber <= total; pageNumber++) {
      var page = await pdfDocument.getPage(pageNumber);
      var viewport = page.getViewport({ scale: 1 });
      var content = await page.getTextContent({ disableNormalization: false, includeMarkedContent: false });
      var items = (content.items || []).filter(function (item) { return item && typeof item.str === "string"; }).map(normalizeItem);
      pages.push({
        pageNumber: pageNumber,
        width: viewport.width,
        height: viewport.height,
        items: items,
        lines: groupLines(items, 3.0, pageNumber, viewport.width)
      });
      if (onProgress) onProgress({ page: pageNumber, totalPages: total, percent: Math.round(pageNumber / total * 100) });
    }
    var visible = pages.reduce(function (sum, page) {
      return sum + page.items.filter(function (item) { return tidyText(item.str); }).length;
    }, 0);
    if (visible < 100) {
      fail("NO_TEXT_LAYER", "This PDF does not contain a usable text layer. The automatic Elmy importer supports text-based Elmy exports and does not use OCR.");
    }
    return pages;
  }

  function findLine(lines, needle) {
    var n = compactLower(needle);
    return (lines || []).filter(function (line) { return compactLower(line.text).indexOf(n) !== -1; })[0] || null;
  }

  function valueAfterLeftLabel(page, label) {
    var threshold = page.width * 0.30;
    var target = compactLower(label);
    for (var i = 0; i < page.lines.length; i++) {
      var line = page.lines[i];
      var left = compactLower(line.items.filter(function (item) { return item.x < threshold; }).map(function (item) { return item.str; }).join(""));
      if (left.indexOf(target) === -1) continue;
      var value = tidyText(line.items.filter(function (item) { return item.x >= threshold; }).map(function (item) { return item.str; }).join(""));
      if (value) return value;
    }
    return null;
  }

  function numericItems(line, min, max) {
    return (line && line.items || []).filter(function (item) {
      var s = tidyText(item.str);
      if (!/^\d{1,4}$/.test(s)) return false;
      var n = parseInt(s, 10);
      return n >= min && n <= max;
    }).map(function (item) { return { value: parseInt(tidyText(item.str), 10), x: item.x }; })
      .sort(function (a, b) { return a.x - b.x; });
  }

  function nearestNumericLineBelow(lines, heading, maxDistance, min, max, minValues) {
    if (!heading) return null;
    var candidates = lines.filter(function (line) {
      return line.y < heading.y && heading.y - line.y <= maxDistance;
    }).sort(function (a, b) { return b.y - a.y; });
    for (var i = 0; i < candidates.length; i++) {
      var nums = numericItems(candidates[i], min, max);
      if (nums.length >= (minValues || 1)) return { line: candidates[i], numbers: nums };
    }
    return null;
  }

  function parseIsoDate(text) {
    var s = compact(text);
    var match = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{1,2}),(\d{4})/i);
    if (!match) return null;
    var months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    var month = months[match[1].toLowerCase()];
    return match[3] + "-" + String(month).padStart(2, "0") + "-" + String(parseInt(match[2], 10)).padStart(2, "0");
  }

  function parseSeason(className) {
    var s = tidyText(className || "");
    var match = s.match(/\b(Spring|Summer|Fall|Autumn|Winter)\s+(20\d{2})\b/i);
    if (!match) match = compact(s).match(/(Spring|Summer|Fall|Autumn|Winter)(20\d{2})/i);
    if (!match) return null;
    var season = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    if (season === "Autumn") season = "Fall";
    return season + " " + match[2];
  }

  function parseBreakdownLine(page, name) {
    var line = page.lines.filter(function (candidate) {
      return compactLower(candidate.text).indexOf(name.toLowerCase()) !== -1 && candidate.y < page.height * 0.30;
    })[0];
    if (!line) return null;
    var nums = line.items.filter(function (item) { return /^\d+$/.test(tidyText(item.str)); })
      .map(function (item) { return { x: item.x, value: parseInt(tidyText(item.str), 10) }; })
      .filter(function (item) { return item.x > page.width * 0.45; })
      .sort(function (a, b) { return a.x - b.x; });
    if (nums.length < 3) return null;
    return { answered: nums[0].value, correct: nums[1].value, total: nums[2].value };
  }

  function parseElmyMetadata(page) {
    if (!page) fail("MISSING_METADATA_PAGE", "The PDF does not contain the expected Elmy assessment metadata page.");
    var docText = pageCompact(page);
    if (docText.indexOf("poweredbyelmy") === -1 || docText.indexOf("assessmentreport") === -1) {
      fail("NOT_ELMY_REPORT", "This PDF is not a supported Elmy Assessment Report.");
    }

    var attemptLine = findLine(page.lines, "Attempt #") || findLine(page.lines, "Attempt#");
    var attemptText = attemptLine ? tidyText(attemptLine.items.map(function (item) { return item.str; }).join("")) : "";
    var attemptMatch = compact(attemptText).match(/Attempt#(\d+)for(.+)/i);
    var attemptNumber = attemptMatch ? parseInt(attemptMatch[1], 10) : null;

    var className = valueAfterLeftLabel(page, "Class");
    var assessmentTitle = valueAfterLeftLabel(page, "Assessment") || (attemptMatch ? attemptMatch[2].replace(/(\d)([A-Z])/g, "$1 $2") : null);
    var studentName = valueAfterLeftLabel(page, "Student");
    var dateText = valueAfterLeftLabel(page, "Date");

    var totalHeading = findLine(page.lines, "Total Score");
    var totalFound = nearestNumericLineBelow(page.lines, totalHeading, 55, 400, 1600, 1);
    var summaryHeading = findLine(page.lines, "Answered Questions");
    var summaryFound = nearestNumericLineBelow(page.lines, summaryHeading, 65, 0, 100, 2);
    var moduleHeading = findLine(page.lines, "Module Scores");
    var moduleFound = nearestNumericLineBelow(page.lines, moduleHeading, 105, 200, 800, 2);

    var metadata = {
      studentName: studentName,
      attemptNumber: attemptNumber,
      assessmentTitle: assessmentTitle,
      className: className,
      season: parseSeason(className),
      date: parseIsoDate(dateText),
      totalScaled: totalFound ? totalFound.numbers[0].value : null,
      answeredQuestions: summaryFound ? summaryFound.numbers[0].value : null,
      correctAnswers: summaryFound ? summaryFound.numbers[1].value : null,
      readingWritingScaled: moduleFound ? moduleFound.numbers[0].value : null,
      mathScaled: moduleFound ? moduleFound.numbers[1].value : null,
      pageBreakdown: {
        english: parseBreakdownLine(page, "english"),
        math: parseBreakdownLine(page, "math")
      }
    };

    if (!metadata.studentName) fail("MISSING_STUDENT", "The student name could not be extracted from the Elmy report.");
    if (!metadata.attemptNumber) fail("MISSING_ATTEMPT", "The diagnostic attempt number could not be extracted from the Elmy report.");
    if (compactLower(metadata.assessmentTitle).indexOf("diagnosticexam2026") === -1) {
      fail("WRONG_ASSESSMENT", "This Elmy PDF is not the supported Diagnostic Exam 2026 assessment.");
    }
    if (metadata.totalScaled == null || metadata.readingWritingScaled == null || metadata.mathScaled == null) {
      fail("MISSING_SCORES", "The diagnostic scaled scores could not be extracted from page 1.");
    }
    if (metadata.answeredQuestions == null || metadata.correctAnswers == null) {
      fail("MISSING_REPORTED_TOTALS", "The reported answered and correct totals could not be extracted from page 1.");
    }
    return metadata;
  }

  function boundaryLine(page, needle) { return findLine(page.lines, needle); }
  function isPrivateUseText(s) { return /[\uE000-\uF8FF]/.test(String(s || "")); }

  function summaryAnchors(page, lowerBoundaryY) {
    var minX = page.width * 0.075, maxX = page.width * 0.18;
    return page.items.filter(function (item) {
      var s = tidyText(item.str);
      if (!/^\d{1,3}$/.test(s) || item.x < minX || item.x > maxX) return false;
      if (lowerBoundaryY != null && item.y <= lowerBoundaryY + 4) return false;
      return page.items.some(function (marker) {
        return marker.x < item.x && marker.x >= page.width * 0.045 && Math.abs(marker.y - item.y) <= 6 &&
          (isPrivateUseText(marker.str) || /^[✓✔✕✖×]$/.test(tidyText(marker.str)));
      });
    }).map(function (item) {
      return { globalNumber: parseInt(tidyText(item.str), 10), x: item.x, y: item.y };
    }).filter(function (anchor) { return anchor.globalNumber >= 1 && anchor.globalNumber <= EXPECTED_QUESTIONS; })
      .sort(function (a, b) { return b.y - a.y; });
  }

  function buildColumnSegments(page, minRatio, maxRatio, lowerBoundaryY) {
    var items = page.items.filter(function (item) {
      return item.x >= page.width * minRatio && item.x < page.width * maxRatio &&
        (lowerBoundaryY == null || item.y > lowerBoundaryY + 4);
    });
    var lines = groupLines(items, 2.8).filter(function (line) { return tidyText(line.text); });
    var segments = [], current = null, previousY = null;
    lines.forEach(function (line) {
      // Wrapped lines use roughly 10-12 pt leading; the inter-row gap is about
      // 20 pt. Splitting on 16 pt reconstructs each answer cell independently.
      if (!current || previousY - line.y > 16) {
        current = { items: [], maxY: line.y, minY: line.y };
        segments.push(current);
      }
      current.items = current.items.concat(line.items);
      current.maxY = Math.max(current.maxY, line.y);
      current.minY = Math.min(current.minY, line.y);
      previousY = line.y;
    });
    return segments;
  }

  function closestSegment(segments, y) {
    var best = null, bestDistance = Infinity;
    (segments || []).forEach(function (segment) {
      var distance = y > segment.maxY ? y - segment.maxY : (y < segment.minY ? segment.minY - y : 0);
      if (distance < bestDistance) { best = segment; bestDistance = distance; }
    });
    return bestDistance <= 18 ? best : null;
  }

  function parseSummaryRow(page, anchor, columns) {
    var studentSegment = closestSegment(columns.student, anchor.y);
    var correctSegment = closestSegment(columns.correct, anchor.y);
    var pointSegment = closestSegment(columns.points, anchor.y);
    var studentItems = studentSegment ? studentSegment.items : [];
    var correctItems = correctSegment ? correctSegment.items : [];
    var pointItems = pointSegment ? pointSegment.items : [];
    var pointsText = compact(pointItems.map(function (item) { return item.str; }).join(""));
    var points = pointsText.match(/([01])\/1/);
    return {
      globalNumber: anchor.globalNumber,
      studentAnswer: normalizeAnswer(joinCellItems(studentItems)),
      correctAnswer: normalizeAnswer(joinCellItems(correctItems)),
      earnedPoint: points ? parseInt(points[1], 10) : null,
      pageNumber: page.pageNumber,
      studentWasTruncated: /…|\.\.\./.test(joinCellItems(studentItems)),
      correctWasTruncated: /…|\.\.\./.test(joinCellItems(correctItems)),
      answerSource: "summary",
      correctAnswerSource: "summary",
      correctnessSource: "points",
      warnings: []
    };
  }

  function collectCorrectionBlocks(pages) {
    var started = false, current = [], blocks = [];
    (pages || []).forEach(function (page) {
      var lines = page.lines || [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!started) {
          if (compactLower(line.text).indexOf("questioncorrections") !== -1) started = true;
          continue;
        }
        if (!line.text) continue;
        current.push(line);
        if (/[01]\/1points?$/i.test(compact(line.text))) {
          blocks.push(current);
          current = [];
        }
      }
    });
    return blocks;
  }

  function optionLetterNearMarker(block, markerIndex) {
    for (var i = markerIndex; i >= 0 && i >= markerIndex - 3; i--) {
      var line = block[i];
      var candidates = (line.items || []).filter(function (item) {
        return /^[ABCD]$/.test(tidyText(item.str)) && item.x >= (line.pageWidth || 595) * 0.075 && item.x <= (line.pageWidth || 595) * 0.18;
      });
      if (candidates.length) return tidyText(candidates[0].str);
    }
    return null;
  }

  function correctionOptionMap(pages) {
    var blocks = collectCorrectionBlocks(pages);
    var map = {};
    // Never align correction blocks by position unless all 98 were recovered.
    // A partial block sequence would shift later module-local numbers and could
    // incorrectly turn an omitted answer into a selected option.
    if (blocks.length !== EXPECTED_QUESTIONS) return { blockCount: blocks.length, options: map };
    blocks.slice(0, EXPECTED_QUESTIONS).forEach(function (block, index) {
      var result = { student: null, correct: null };
      block.forEach(function (line, lineIndex) {
        var c = compactLower(line.text);
        if (c.indexOf("youransweriscorrect") !== -1) {
          var same = optionLetterNearMarker(block, lineIndex);
          result.student = same; result.correct = same;
        } else if (c.indexOf("youranswer") !== -1) {
          result.student = optionLetterNearMarker(block, lineIndex);
        } else if (c.indexOf("correctanswer") !== -1) {
          result.correct = optionLetterNearMarker(block, lineIndex);
        }
      });
      if (result.student && result.correct) map[index + 1] = result;
    });
    return { blockCount: blocks.length, options: map };
  }

  function parseAnswerSummaryPages(pages) {
    var inSummary = false, foundBoundary = false, rows = [];
    (pages || []).forEach(function (page) {
      var pc = pageCompact(page);
      if (pc.indexOf("answerssummary") !== -1) inSummary = true;
      if (!inSummary || foundBoundary) return;
      var correction = boundaryLine(page, "Question Corrections");
      var lowerY = correction ? correction.y : null;
      var anchors = summaryAnchors(page, lowerY);
      var columns = {
        student: buildColumnSegments(page, 0.18, 0.46, lowerY),
        correct: buildColumnSegments(page, 0.46, 0.72, lowerY),
        points: buildColumnSegments(page, 0.72, 1.0, lowerY)
      };
      anchors.forEach(function (anchor, i) {
        rows.push(parseSummaryRow(page, anchor, columns));
      });
      if (correction) foundBoundary = true;
    });

    if (!inSummary) fail("MISSING_SUMMARY", "The expected Elmy Answers Summary section was not found.");
    var unique = {};
    rows.forEach(function (row) {
      if (unique[row.globalNumber]) fail("DUPLICATE_GLOBAL_QUESTION", "The answer summary contains duplicate question " + row.globalNumber + ".");
      unique[row.globalNumber] = row;
    });
    var missing = [];
    for (var q = 1; q <= EXPECTED_QUESTIONS; q++) if (!unique[q]) missing.push(q);
    if (rows.length !== EXPECTED_QUESTIONS || missing.length) {
      fail("INCOMPLETE_SUMMARY", "The expected complete 98-question Elmy answer summary was not found.", { found: rows.length, missing: missing });
    }

    rows.sort(function (a, b) { return a.globalNumber - b.globalNumber; });
    rows.forEach(function (row) {
      if (row.earnedPoint !== 0 && row.earnedPoint !== 1) fail("MISSING_POINTS", "Awarded points could not be determined for question " + row.globalNumber + ".");
      if (row.correctAnswer == null) fail("MISSING_CORRECT_ANSWER", "The correct answer could not be extracted for question " + row.globalNumber + ".");
    });

    var correctionData = correctionOptionMap(pages);
    rows.forEach(function (row) {
      var option = correctionData.options[row.globalNumber];
      if (option) {
        row.studentAnswer = option.student;
        row.correctAnswer = option.correct;
        row.answerRepresentation = "option_letters";
        row.answerSource = "corrections";
        row.correctAnswerSource = "corrections";
      } else {
        row.answerRepresentation = "summary_text";
        // A correct truncated multiple-choice selection is exactly the full correct option text.
        if (row.studentWasTruncated && row.earnedPoint === 1) row.studentAnswer = row.correctAnswer;
      }
    });
    return { rows: rows, correctionBlockCount: correctionData.blockCount };
  }

  function globalToLocalQuestion(globalNumber) {
    if (globalNumber >= 1 && globalNumber <= 27) return { section: "english", module: "module_1", question_number: globalNumber };
    if (globalNumber >= 28 && globalNumber <= 54) return { section: "english", module: "module_b", question_number: globalNumber - 27 };
    if (globalNumber >= 55 && globalNumber <= 76) return { section: "math", module: "module_1", question_number: globalNumber - 54 };
    if (globalNumber >= 77 && globalNumber <= 98) return { section: "math", module: "module_b", question_number: globalNumber - 76 };
    fail("INVALID_GLOBAL_NUMBER", "Invalid global question number: " + globalNumber);
  }

  function difficultyFor(map, loc) {
    return map && map.sections && map.sections[loc.section] && map.sections[loc.section][loc.module] &&
      map.sections[loc.section][loc.module][String(loc.question_number)] || null;
  }

  function difficultyCounts(records) {
    return records.reduce(function (counts, record) {
      counts[record.difficulty] = (counts[record.difficulty] || 0) + 1;
      return counts;
    }, { easy: 0, medium: 0, hard: 0 });
  }

  function applyDiagnosticDifficultyMap(summaryRows, config) {
    var map = config && config.diagnostic_difficulty_maps && config.diagnostic_difficulty_maps[TEMPLATE_ID];
    if (!map) fail("MISSING_DIFFICULTY_MAP", "The embedded Diagnostic Exam 2026 difficulty map is missing.");
    var records = summaryRows.map(function (row) {
      var loc = globalToLocalQuestion(row.globalNumber);
      var difficulty = difficultyFor(map, loc);
      if (!/^(easy|medium|hard)$/.test(difficulty || "")) {
        fail("INVALID_DIFFICULTY_MAP", "The difficulty map is missing or invalid for global question " + row.globalNumber + ".");
      }
      return {
        section: loc.section,
        module: loc.module,
        question_number: loc.question_number,
        student_answer: row.studentAnswer,
        correct_answer: row.correctAnswer,
        correct: row.earnedPoint === 1,
        difficulty: difficulty,
        time_seconds: null,
        confidence: null,
        guessed: null,
        method: null,
        teacher_note: null,
        error_type: null
      };
    });
    var counts = difficultyCounts(records);
    if (counts.easy !== 22 || counts.medium !== 35 || counts.hard !== 41) {
      fail("DIFFICULTY_CHECKSUM_FAILED", "The embedded difficulty mapping checksum is invalid.", counts);
    }
    return records;
  }

  function buildIndividualCase(metadata, records, parserWarnings) {
    var answered = records.filter(function (record) { return record.student_answer !== null; }).length;
    var correct = records.filter(function (record) { return record.correct === true; }).length;
    var scoreSum = metadata.readingWritingScaled + metadata.mathScaled === metadata.totalScaled;
    return {
      schema_version: "2.0",
      course_type: "individual",
      season: metadata.season,
      student: {
        student_name: metadata.studentName,
        student_id: null,
        grade_level: null,
        known_foundational_gaps: [],
        teacher_overrides: [],
        teacher_flagged_weak_subskills: [],
        school_curriculum: null,
        previous_sat_results: null
      },
      scores: {
        score_source: "provided",
        reading_writing_scaled: metadata.readingWritingScaled,
        math_scaled: metadata.mathScaled,
        total_scaled: metadata.totalScaled
      },
      goal: { target_sat_score: null, intended_test_date: null },
      availability: {
        weeks_available: null,
        preferred_sessions_per_week: null,
        max_session_length: null,
        session_format: null,
        accommodation: null,
        max_available_teaching_hours: null
      },
      diagnostic: {
        template_id: TEMPLATE_ID,
        date: metadata.date,
        attempt_number: metadata.attemptNumber,
        assessment_title: metadata.assessmentTitle,
        reported_summary: {
          answered_questions: metadata.answeredQuestions,
          correct_answers: metadata.correctAnswers,
          total_questions: EXPECTED_QUESTIONS
        },
        answers: records
      },
      source_validation: {
        source_type: "elmy_assessment_report_pdf",
        parser_version: PARSER_VERSION,
        global_numbering_converted: true,
        correct_boolean_included: true,
        expected_answer_records: EXPECTED_QUESTIONS,
        actual_answer_records: records.length,
        calculated_answered_questions: answered,
        reported_answered_questions: metadata.answeredQuestions,
        calculated_correct_answers: correct,
        reported_correct_answers: metadata.correctAnswers,
        scores_sum_correctly: scoreSum,
        question_distribution_valid: true,
        duplicate_questions_found: false,
        missing_questions_found: false,
        difficulty_source: "embedded_diagnostic_exam_2026_mapping",
        difficulty_mapping_valid: true,
        warnings: (parserWarnings || []).slice()
      }
    };
  }

  function validateImportedElmyCase(caseInput, config) {
    var errors = [], warnings = [];
    var answers = caseInput && caseInput.diagnostic && caseInput.diagnostic.answers || [];
    var reported = caseInput && caseInput.diagnostic && caseInput.diagnostic.reported_summary || {};
    var seen = {}, distribution = { english: { module_1: 0, module_b: 0 }, math: { module_1: 0, module_b: 0 } };
    if (!caseInput || !caseInput.student || !caseInput.student.student_name) errors.push("Student name is missing.");
    if (!config || !config.diagnostic_templates || !config.diagnostic_templates[TEMPLATE_ID]) errors.push("Diagnostic template configuration is missing.");
    if (answers.length !== EXPECTED_QUESTIONS) errors.push("Expected 98 answer records; found " + answers.length + ".");
    answers.forEach(function (record) {
      var key = record.section + "|" + record.module + "|" + record.question_number;
      if (seen[key]) errors.push("Duplicate question record: " + key + ".");
      seen[key] = true;
      if (!distribution[record.section] || distribution[record.section][record.module] == null) errors.push("Invalid question location: " + key + ".");
      else distribution[record.section][record.module]++;
      if (typeof record.correct !== "boolean") errors.push("Question " + key + " is missing its awarded-points correctness Boolean.");
      if (record.correct_answer == null) errors.push("Question " + key + " is missing its correct answer.");
      if (!/^(easy|medium|hard)$/.test(record.difficulty || "")) errors.push("Question " + key + " has an invalid difficulty.");
    });
    if (distribution.english.module_1 !== 27 || distribution.english.module_b !== 27 ||
        distribution.math.module_1 !== 22 || distribution.math.module_b !== 22) errors.push("The 27/27/22/22 module distribution is invalid.");

    var answered = answers.filter(function (record) { return record.student_answer !== null; }).length;
    var correct = answers.filter(function (record) { return record.correct === true; }).length;
    if (reported.answered_questions != null && answered !== reported.answered_questions) errors.push("Calculated answered total " + answered + " does not match reported total " + reported.answered_questions + ".");
    if (reported.correct_answers != null && correct !== reported.correct_answers) errors.push("Calculated correct total " + correct + " does not match reported total " + reported.correct_answers + ".");
    var counts = difficultyCounts(answers);
    if (counts.easy !== 22 || counts.medium !== 35 || counts.hard !== 41) errors.push("Difficulty counts do not equal 22 easy, 35 medium, and 41 hard.");

    var scores = caseInput && caseInput.scores || {};
    if (scores.reading_writing_scaled + scores.math_scaled !== scores.total_scaled) warnings.push("The displayed section scores do not sum to the displayed total score.");
    (caseInput && caseInput.source_validation && caseInput.source_validation.warnings || []).forEach(function (warning) { warnings.push(warning); });
    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      summary: {
        student_name: caseInput && caseInput.student && caseInput.student.student_name || null,
        attempt_number: caseInput && caseInput.diagnostic && caseInput.diagnostic.attempt_number || null,
        diagnostic_date: caseInput && caseInput.diagnostic && caseInput.diagnostic.date || null,
        total_score: scores.total_scaled == null ? null : scores.total_scaled,
        reading_writing_score: scores.reading_writing_scaled == null ? null : scores.reading_writing_scaled,
        math_score: scores.math_scaled == null ? null : scores.math_scaled,
        answer_records: answers.length,
        answered_questions: answered,
        correct_answers: correct,
        difficulty_counts: counts,
        distribution: distribution
      }
    };
  }

  function canHandleDiagnosticExam2026(pages) {
    if (!pages || !pages.length) return false;
    var first = pageCompact(pages[0]);
    return first.indexOf("poweredbyelmy") !== -1 && first.indexOf("assessmentreport") !== -1 &&
      first.indexOf("diagnosticexam2026") !== -1;
  }

  function parseDiagnosticExam2026(pages, config) {
    var metadata = parseElmyMetadata(pages[0]);
    var parsedSummary = parseAnswerSummaryPages(pages);
    var records = applyDiagnosticDifficultyMap(parsedSummary.rows, config);
    var warnings = [];
    var breakdown = metadata.pageBreakdown || {};
    if (breakdown.english && breakdown.math && breakdown.english.total + breakdown.math.total !== EXPECTED_QUESTIONS) {
      warnings.push("Page-one score-breakdown rows report " + breakdown.english.total + " English and " + breakdown.math.total + " Math records; the complete 98-question answer summary was used instead.");
    }
    if (parsedSummary.correctionBlockCount !== EXPECTED_QUESTIONS) {
      warnings.push("Detailed correction blocks were not all recoverable; complete answer-summary text was retained where option letters could not be confirmed.");
    }
    var truncatedWrong = parsedSummary.rows.filter(function (row) { return row.studentWasTruncated && row.earnedPoint === 0 && row.answerRepresentation !== "option_letters"; }).length;
    if (truncatedWrong) warnings.push(truncatedWrong + " answered-but-incorrect response(s) retained the visible summary text because an option letter could not be confirmed.");
    var caseInput = buildIndividualCase(metadata, records, warnings);
    var validation = validateImportedElmyCase(caseInput, config);
    if (!validation.ok) fail("IMPORT_VALIDATION_FAILED", "The PDF was read, but the generated case failed validation: " + validation.errors.join(" "), validation);
    return { caseInput: caseInput, metadata: metadata, validation: validation, summaryRows: parsedSummary.rows };
  }

  // The UI calls this registry entry point, not the format parser directly.
  // Additional deterministic report formats can be registered without changing app.js.
  var PARSERS = [{
    id: "elmy-diagnostic-exam-2026",
    template_id: TEMPLATE_ID,
    canHandle: canHandleDiagnosticExam2026,
    parse: parseDiagnosticExam2026
  }];

  function parseExtractedDocument(pages, config) {
    if (!pages || !pages.length) fail("NO_PAGES", "No extracted PDF pages were supplied.");
    var parser = PARSERS.filter(function (candidate) { return candidate.canHandle(pages); })[0];
    if (!parser) {
      var first = pageCompact(pages[0]);
      if (first.indexOf("poweredbyelmy") === -1 || first.indexOf("assessmentreport") === -1) {
        fail("NOT_ELMY_REPORT", "This PDF is not a supported Elmy Assessment Report.");
      }
      fail("WRONG_ASSESSMENT", "This Elmy PDF is not the supported Diagnostic Exam 2026 assessment.");
    }
    return parser.parse(pages, config);
  }

  async function importPdf(arrayBuffer, config, options) {
    options = options || {};
    var pdf = await loadPdfDocument(arrayBuffer, options.pdfjs || root.pdfjsLib, options);
    try {
      var pages = await extractPdfPages(pdf, options.onProgress);
      return parseExtractedDocument(pages, config);
    } finally {
      try { if (pdf && typeof pdf.destroy === "function") await pdf.destroy(); } catch (ignored) {}
    }
  }

  function formatImportValidationSummary(result) {
    var s = result && result.validation && result.validation.summary;
    if (!s) return "Elmy diagnostic import validation completed.";
    return "Elmy diagnostic imported successfully: " + s.answer_records + " questions, " + s.answered_questions + " answered, " + s.correct_answers + " correct. The individual case is ready for analysis.";
  }

  function userMessageForError(error) {
    if (error && error.name === "ElmyImportError") return error.message;
    return "The Elmy diagnostic could not be imported. The PDF format may be unsupported or incomplete.";
  }

  return {
    PARSER_VERSION: PARSER_VERSION,
    TEMPLATE_ID: TEMPLATE_ID,
    parsers: PARSERS.slice(),
    ImportError: ImportError,
    loadPdfDocument: loadPdfDocument,
    extractPdfPages: extractPdfPages,
    parseElmyMetadata: parseElmyMetadata,
    parseAnswerSummaryPages: parseAnswerSummaryPages,
    globalToLocalQuestion: globalToLocalQuestion,
    normalizeAnswer: normalizeAnswer,
    applyDiagnosticDifficultyMap: applyDiagnosticDifficultyMap,
    buildIndividualCase: buildIndividualCase,
    validateImportedElmyCase: validateImportedElmyCase,
    parseExtractedDocument: parseExtractedDocument,
    importPdf: importPdf,
    formatImportValidationSummary: formatImportValidationSummary,
    userMessageForError: userMessageForError,
    _test: {
      normalizeItem: normalizeItem,
      groupLines: groupLines,
      joinCellItems: joinCellItems,
      collectCorrectionBlocks: collectCorrectionBlocks,
      correctionOptionMap: correctionOptionMap,
      difficultyCounts: difficultyCounts,
      parseIsoDate: parseIsoDate,
      parseSeason: parseSeason
    }
  };
});
