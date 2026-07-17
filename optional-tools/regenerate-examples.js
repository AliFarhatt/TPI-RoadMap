// Generates deterministic example case inputs for the demo cases.
const fs = require("fs");
const path = require("path");
const ROOT = require("path").join(__dirname, "..");
const config = requireConfig();

function requireConfig() {
  const g = {};
  const src = fs.readFileSync(path.join(ROOT, "app/js/config-data.js"), "utf8");
  new Function("window", src)(g);
  return g.TP_CONFIG;
}

const tpl = config.diagnostic_templates.Diagnostic_Exam_2026;
const KEYS = ["A", "B", "C", "D"];

// deterministic PRNG
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// profile: map lesson_id -> probability of a correct answer; default given
function buildAnswers(seed, defaultP, lessonP, opts) {
  opts = opts || {};
  const r = rng(seed);
  return tpl.questions.map(q => {
    const key = KEYS[Math.floor(r() * 4)];
    const p = lessonP[q.lesson_id] != null ? lessonP[q.lesson_id] : defaultP;
    const correct = r() < p;
    let student = correct ? key : KEYS[(KEYS.indexOf(key) + 1 + Math.floor(r() * 3)) % 4];
    const a = {
      section: q.section, module: q.module, question_number: q.question_number,
      student_answer: student, correct_answer: key
    };
    if (opts.timing) {
      const base = q.section === "english" ? 62 : 82;
      let t = Math.round(base * (0.7 + r() * 0.9));
      if (opts.slowLessons && opts.slowLessons.includes(q.lesson_id) && correct) t = Math.round(base * (1.8 + r() * 0.6));
      a.time_seconds = t;
    }
    if (opts.guessLessons && opts.guessLessons.includes(q.lesson_id) && r() < 0.7) a.guessed = true;
    return a;
  });
}

// ---------- individual demo: Maya Haddad ----------
const mayaAnswers = buildAnswers(42, 0.62, {
  ENG_STANDARD_ENGLISH_CONVENTIONS: 0.85,
  ENG_TRANSITIONS: 1.0,
  ENG_WORDS_IN_CONTEXT: 0.75,
  ENG_INFERENCES: 0.2,
  ENG_COMMAND_OF_EVIDENCE: 0.35,
  MATH_LINEAR_FUNCTIONS: 0.8,
  MATH_EQUIV_EXPRESSIONS: 0.3,
  MATH_NONLINEAR_EQ_SYSTEMS: 0.15,
  MATH_NONLINEAR_FUNCTIONS: 0.3,
  MATH_LINEAR_INEQUALITIES: 0.6,
  MATH_RIGHT_TRIANGLES_TRIG: 0.5,
  MATH_ONE_VAR_DATA: 0.9
}, { timing: true, slowLessons: ["MATH_EQUIV_EXPRESSIONS"], guessLessons: ["MATH_NONLINEAR_EQ_SYSTEMS"] });

const maya = {
  schema_version: "2.0",
  course_type: "individual",
  season: "Summer 2026",
  student: {
    student_name: "Maya Haddad",
    student_id: "TP-2026-0114",
    grade_level: 11,
    known_foundational_gaps: [
      { lesson_id: "MATH_NONLINEAR_EQ_SYSTEMS", severity: "major", evidence: "Cannot factor quadratics without prompting; memorizes the formula without understanding (teacher intake interview)." }
    ],
    teacher_overrides: [],
    teacher_flagged_weak_subskills: []
  },
  scores: { score_source: "provided", reading_writing_scaled: 480, math_scaled: 440, total_scaled: 920 },
  goal: { target_sat_score: 1250, intended_test_date: "2026-10-03" },
  availability: {
    weeks_available: 10, preferred_sessions_per_week: 2,
    max_session_length: "2 hrs", session_format: "Focused blocks", accommodation: "No"
  },
  diagnostic: { template_id: "Diagnostic_Exam_2026", date: "July 6, 2026", answers: mayaAnswers }
};

// ---------- group demo: 3 students ----------
const rami = {
  schema_version: "2.0", course_type: "group_member", season: "Summer 2026",
  student: { student_name: "Rami Khoury", student_id: "TP-2026-0121", grade_level: 11, known_foundational_gaps: [] },
  scores: { score_source: "provided", reading_writing_scaled: 560, math_scaled: 580, total_scaled: 1140 },
  goal: { target_sat_score: 1420, intended_test_date: "2026-10-03" },
  availability: { weeks_available: 10, preferred_sessions_per_week: 2, max_session_length: "2 hrs", session_format: "Focused blocks", accommodation: "No" },
  diagnostic: {
    template_id: "Diagnostic_Exam_2026", date: "July 6, 2026",
    answers: buildAnswers(7, 0.82, {
      ENG_INFERENCES: 0.6, MATH_NONLINEAR_EQ_SYSTEMS: 0.65,
      MATH_RIGHT_TRIANGLES_TRIG: 0.55, ENG_RHETORICAL_SYNTHESIS: 0.7
    }, { timing: true })
  }
};
const lina = {
  schema_version: "2.0", course_type: "group_member", season: "Summer 2026",
  student: {
    student_name: "Lina Sarkis", student_id: "TP-2026-0122", grade_level: 11,
    known_foundational_gaps: [{ lesson_id: "MATH_LINEAR_FUNCTIONS", severity: "moderate", evidence: "Confuses slope and intercept roles; relies on plugging in answer choices (intake worksheet)." }]
  },
  scores: { score_source: "provided", reading_writing_scaled: 450, math_scaled: 410, total_scaled: 860 },
  goal: { target_sat_score: 1150, intended_test_date: "2026-10-03" },
  availability: { weeks_available: 10, preferred_sessions_per_week: 2, max_session_length: "1.5 hrs", session_format: "Short focused blocks", accommodation: "Yes" },
  diagnostic: {
    template_id: "Diagnostic_Exam_2026", date: "July 6, 2026",
    answers: buildAnswers(19, 0.45, {
      ENG_STANDARD_ENGLISH_CONVENTIONS: 0.65, ENG_WORDS_IN_CONTEXT: 0.55,
      MATH_LINEAR_FUNCTIONS: 0.3, MATH_EQUIV_EXPRESSIONS: 0.25,
      MATH_NONLINEAR_EQ_SYSTEMS: 0.2, ENG_COMMAND_OF_EVIDENCE: 0.3
    }, { timing: true, guessLessons: ["MATH_NONLINEAR_EQ_SYSTEMS", "MATH_EQUIV_EXPRESSIONS"] })
  }
};
const omar = {
  schema_version: "2.0", course_type: "group_member", season: "Summer 2026",
  student: { student_name: "Omar Fares", student_id: "TP-2026-0123", grade_level: 12, known_foundational_gaps: [] },
  scores: { score_source: "provided", reading_writing_scaled: 510, math_scaled: 500, total_scaled: 1010 },
  goal: { target_sat_score: 1300, intended_test_date: "2026-10-03" },
  availability: { weeks_available: 10, preferred_sessions_per_week: 2, max_session_length: "2 hrs", session_format: "Focused blocks", accommodation: "No" },
  diagnostic: {
    template_id: "Diagnostic_Exam_2026", date: "July 6, 2026",
    answers: buildAnswers(23, 0.63, {
      ENG_INFERENCES: 0.35, ENG_CENTRAL_IDEAS_DETAILS: 0.5,
      MATH_LINEAR_INEQUALITIES: 0.35, MATH_AREA_VOLUME: 0.4, MATH_ONE_VAR_DATA: 0.85
    }, { timing: true, slowLessons: ["ENG_COMMAND_OF_EVIDENCE"] })
  }
};

const group = {
  schema_version: "2.0",
  course_type: "group",
  group_name: "October 2026 Trio",
  group_id: "TP-GRP-2026-07",
  group_test_date: "2026-10-03",
  shared_schedule: { sessions_per_week: 2, session_days: ["Tue", "Thu"] },
  instructor_notes: "Program marketed as small-group personalized prep.",
  students: [rami, lina, omar]
};

fs.writeFileSync(path.join(ROOT, "examples/individual-demo/case-input.json"), JSON.stringify(maya, null, 2));
fs.writeFileSync(path.join(ROOT, "examples/group-demo/case-input.json"), JSON.stringify(group, null, 2));

// example CSV (Maya's answers)
const cols = ["student_id", "student_name", "section", "module", "question_number", "student_answer", "correct_answer", "difficulty", "time_seconds", "confidence", "guessed", "method", "teacher_note"];
const rows = [cols.join(",")];
mayaAnswers.forEach(a => {
  rows.push([maya.student.student_id, maya.student.student_name, a.section, a.module, a.question_number,
    a.student_answer, a.correct_answer, "", a.time_seconds != null ? a.time_seconds : "", "", a.guessed ? "true" : "", "", ""].join(","));
});
fs.writeFileSync(path.join(ROOT, "examples/individual-demo/answers.csv"), rows.join("\n") + "\n");
console.log("examples written:", mayaAnswers.length, "answers");
