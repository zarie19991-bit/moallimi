-- ISOLATED / SYNTHETIC test schema. Never deploy this fixture to Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.nafes_teacher_access(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key_hash text NOT NULL DEFAULT 'synthetic',
 label text NOT NULL DEFAULT 'test', active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),subject_scope text NOT NULL DEFAULT 'all'
);
CREATE TABLE public.nafes_students(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text NOT NULL,
 name_normalized text NOT NULL DEFAULT 'synthetic',grade text NOT NULL DEFAULT 'middle_3',
 class_name text NOT NULL DEFAULT 'A',national_id_last3 text NOT NULL DEFAULT '123',
 is_active boolean NOT NULL DEFAULT true,is_demo boolean NOT NULL DEFAULT false
);
CREATE TABLE public.nafes_paper_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.nafes_teacher_access(id),
 review_id text NOT NULL,title text NOT NULL DEFAULT 'synthetic',
 subject text NOT NULL, class_name text NOT NULL DEFAULT '',
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),subjects text[] NOT NULL DEFAULT '{}'::text[],
 UNIQUE(owner_id,review_id)
);
CREATE TABLE public.nafes_scan_sessions(
 id uuid PRIMARY KEY,review_pk uuid NOT NULL REFERENCES public.nafes_paper_reviews(id),
 reviewer_id uuid NOT NULL REFERENCES public.nafes_teacher_access(id),
 file_hash text NOT NULL DEFAULT 'hash',review_snapshot jsonb NOT NULL,
 expected_count integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,expected_page_count integer,source_file_count integer,
 batch_manifest jsonb NOT NULL DEFAULT '[]'::jsonb, CHECK(expected_count>0)
);
CREATE TABLE public.nafes_scan_sheets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES public.nafes_scan_sessions(id),
 review_pk uuid NOT NULL REFERENCES public.nafes_paper_reviews(id),
 ordinal integer NOT NULL,student_id uuid REFERENCES public.nafes_students(id),
 sheet_no integer,image_hash text NOT NULL DEFAULT 'hash',
 image_data text NOT NULL DEFAULT 'synthetic',snapshot jsonb NOT NULL,
 duplicate_of uuid,blocked_duplicate boolean NOT NULL DEFAULT false,
 duplicate_legacy_at timestamptz,uploaded_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,reviewed_by uuid,
 disposition text,effective_snapshot jsonb,answer_version integer NOT NULL DEFAULT 0,
 UNIQUE(session_id,ordinal)
);
CREATE TABLE public.nafes_scan_answer_edits(
 id uuid PRIMARY KEY,sheet_id uuid NOT NULL REFERENCES public.nafes_scan_sheets(id),
 reviewer_id uuid NOT NULL REFERENCES public.nafes_teacher_access(id),
 question integer NOT NULL,before_answer jsonb NOT NULL,after_answer jsonb NOT NULL,
 answer_version integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nafes_scan_identity_edits(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sheet_id uuid NOT NULL REFERENCES public.nafes_scan_sheets(id),
 session_id uuid NOT NULL REFERENCES public.nafes_scan_sessions(id),
 review_pk uuid NOT NULL REFERENCES public.nafes_paper_reviews(id),
 reviewer_id uuid NOT NULL REFERENCES public.nafes_teacher_access(id),
 student_id uuid NOT NULL REFERENCES public.nafes_students(id),
 sheet_no integer NOT NULL,student_name text NOT NULL,model text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.nafes_scan_alerts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sheet_id uuid NOT NULL REFERENCES public.nafes_scan_sheets(id),
 original_sheet_id uuid,original_uploaded_at timestamptz,review_pk uuid NOT NULL,
 kind text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 acknowledged_at timestamptz,acknowledged_by uuid
);
CREATE TABLE public.nafes_scan_deletions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),batch_id uuid NOT NULL,
 review_pk uuid NOT NULL,session_id uuid NOT NULL,sheet_id uuid NOT NULL,
 student_id uuid,sheet_no integer,student_name text,model text,
 reviewer_id uuid NOT NULL,reason text NOT NULL,deleted_at timestamptz NOT NULL DEFAULT now(),
 had_published_attempt boolean NOT NULL DEFAULT false,
 snapshot_summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.nafes_assessments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid,
 short_code text,status text NOT NULL DEFAULT 'draft',kind text NOT NULL,
 title text NOT NULL,config jsonb NOT NULL,rendered_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
 legacy_target jsonb,created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz
);
CREATE TABLE public.nafes_assessment_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assessment_id uuid NOT NULL REFERENCES public.nafes_assessments(id),
 student_name text NOT NULL,student_no text NOT NULL,student_key text NOT NULL,
 class_name text NOT NULL DEFAULT '',attempt_no integer NOT NULL,
 config jsonb NOT NULL,rendered_sections jsonb NOT NULL,
 answers jsonb NOT NULL DEFAULT '{}'::jsonb,events jsonb NOT NULL DEFAULT '[]'::jsonb,
 cursor integer NOT NULL DEFAULT 0,section_index integer NOT NULL DEFAULT 0,
 section_started_at timestamptz NOT NULL DEFAULT now(),version integer NOT NULL DEFAULT 1,
 session_id text NOT NULL,access_hash text NOT NULL,lease_until timestamptz NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 submitted_at timestamptz,score integer,total integer,percent numeric,
 section_scores jsonb,student_id uuid REFERENCES public.nafes_students(id),
 is_demo boolean NOT NULL DEFAULT false, UNIQUE(assessment_id,student_key,attempt_no)
);
ALTER TABLE public.nafes_scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nafes_scan_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nafes_scan_answer_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nafes_scan_identity_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nafes_scan_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nafes_scan_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nafes_paper_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nafes_assessment_attempts ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
-- Production uses snapshot triggers; fixtures conservatively forbid edits to saved answers.
CREATE OR REPLACE FUNCTION public.nafes_preserve_attempt_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $body$
BEGIN
 IF NEW.answers IS DISTINCT FROM OLD.answers OR NEW.score IS DISTINCT FROM OLD.score
 OR NEW.student_id IS DISTINCT FROM OLD.student_id THEN
   RAISE EXCEPTION 'Published attempt snapshot immutable';
 END IF;
 RETURN NEW;
END $body$;
CREATE TRIGGER nafes_snapshot_guard BEFORE UPDATE ON public.nafes_assessment_attempts
FOR EACH ROW EXECUTE FUNCTION public.nafes_preserve_attempt_snapshot();
