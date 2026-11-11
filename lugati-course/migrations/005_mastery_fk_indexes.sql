-- 005_mastery_fk_indexes.sql
-- Cover foreign keys used by mastery/API queries.
create index if not exists idx_learning_events_lesson_id on public.learning_events(lesson_id);
create index if not exists idx_rubric_scores_lesson_id on public.performance_rubric_scores(lesson_id);
create index if not exists idx_rubric_scores_teacher_id on public.performance_rubric_scores(teacher_id);
create index if not exists idx_remediation_lesson_id on public.remediation_events(lesson_id);
create index if not exists idx_attempts_lesson_id on public.student_attempts(lesson_id);
create index if not exists idx_point_mastery_lesson_id on public.student_point_mastery(lesson_id);
create index if not exists idx_unit_mastery_unit_code on public.student_unit_mastery(unit_code);
create index if not exists idx_interventions_assigned_by on public.student_interventions(assigned_by);
