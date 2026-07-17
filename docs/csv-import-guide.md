# CSV answer import

Header row required. Required columns: `section, module, question_number, student_answer`. Full column set:

```
student_id,student_name,section,module,question_number,student_answer,correct_answer,difficulty,time_seconds,confidence,guessed,method,teacher_note
```

Rules:
- `section` ∈ english|math; `module` ∈ module_1|module_b; `question_number` must exist in the selected diagnostic template.
- `difficulty` ∈ easy|medium|hard or blank; `guessed` accepts 1/true/yes.
- One row per student per question; duplicates are rejected with the line number.
- Multiple `student_id` values in one file create/extend a group; a single id feeds the current individual case. Rows are matched to existing students by student_id or student_name.
- All errors (unknown template, invalid module, out-of-template question, duplicate rows, missing question numbers, missing required columns, unsupported difficulty) are listed per line; valid rows still import.
- The template ships no answer key, so `correct_answer` should normally be filled here.

Example file: `examples/individual-demo/answers.csv` (Maya Haddad's 98 answers).
