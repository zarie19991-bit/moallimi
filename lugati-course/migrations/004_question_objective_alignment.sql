-- 004_question_objective_alignment.sql
alter table public.course_question_bank
  add column if not exists objective_key text;
create index if not exists idx_course_questions_objective
  on public.course_question_bank(lesson_id, objective_key, active);
