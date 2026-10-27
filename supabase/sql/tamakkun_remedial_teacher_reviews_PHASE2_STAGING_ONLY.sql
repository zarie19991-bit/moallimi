-- تمكّن • المرحلة الثانية • مسودة ترحيل لا تُطبّق على الإنتاج دون اختبار
-- Appendix-only audit record: one row per teacher-verified delivery or mastery decision.
-- Authorization is by the existing Edge Function only, never by client writes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.tamakkun_remedial_teacher_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_id uuid NOT NULL REFERENCES public.lugati_teacher_tasks(id) ON DELETE RESTRICT,
 teacher_access_id uuid NOT NULL REFERENCES public.nafes_teacher_access(id) ON DELETE RESTRICT,
 student_id uuid NOT NULL REFERENCES public.nafes_students(id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK (event_type IN ('execution','decision')),
 execution_date date,
 execution_mode text CHECK (execution_mode IN ('in_class','home','online','other')),
 evidence_type text CHECK (evidence_type IN ('teacher_observation','student_work','online_submission','other')),
 decision text CHECK (decision IN ('mastered','needs_retraining')),
 posttest_id uuid REFERENCES public.tamakkun_indicator_posttests(id) ON DELETE RESTRICT,
 notes text NOT NULL CHECK (char_length(btrim(notes)) BETWEEN 3 AND 1200),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT review_event_payload CHECK (
   (event_type='execution' AND execution_date IS NOT NULL AND execution_mode IS NOT NULL
    AND evidence_type IS NOT NULL AND decision IS NULL AND posttest_id IS NULL)
   OR
   (event_type='decision' AND execution_date IS NULL AND execution_mode IS NULL
    AND evidence_type IS NULL AND decision IS NOT NULL AND posttest_id IS NOT NULL)
 )
);
CREATE INDEX IF NOT EXISTS idx_tamakkun_reviews_teacher_task
 ON public.tamakkun_remedial_teacher_reviews (teacher_access_id,task_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tamakkun_reviews_student
 ON public.tamakkun_remedial_teacher_reviews (student_id,created_at DESC);
ALTER TABLE public.tamakkun_remedial_teacher_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tamakkun_remedial_teacher_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON TABLE public.tamakkun_remedial_teacher_reviews TO service_role;
COMMIT;
-- No RLS policies for anon/authenticated. Review content is available only via the
-- teacher-validated server API, and the table preserves corrections as newer events.
-- Do not insert fictional school attendance or synthetic teacher approvals.
