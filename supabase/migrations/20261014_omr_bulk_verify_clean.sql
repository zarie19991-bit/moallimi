-- Review low-risk, fully validated OMR sheets in one explicit teacher action.
-- PREVIEW (p_apply=false) is read-only. Applying records teacher verification,
-- never publishes results and never changes answers or student grades.
CREATE TABLE IF NOT EXISTS public.nafes_scan_bulk_review_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES public.nafes_scan_sessions(id),
 reviewer_id uuid NOT NULL,
 verified_sheet_ids uuid[] NOT NULL,
 verified_count integer NOT NULL CHECK (verified_count=cardinality(verified_sheet_ids)),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.nafes_scan_bulk_review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.nafes_scan_bulk_review_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT, INSERT ON TABLE public.nafes_scan_bulk_review_audit TO service_role;

CREATE OR REPLACE FUNCTION public.nafes_scan_bulk_verify_clean(
 p_session uuid, p_reviewer uuid, p_apply boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $batch$
DECLARE
 session_row public.nafes_scan_sessions;
 r public.nafes_scan_sheets;
 snap jsonb;
 response jsonb;
 eligible_ids uuid[]:='{}'::uuid[];
 actually_verified uuid[]:='{}'::uuid[];
 eligible_count integer:=0;
 skipped_count integer:=0;
 total_count integer:=0;
 exceptional_count integer:=0;
 expected integer;
BEGIN
 SELECT * INTO session_row FROM public.nafes_scan_sessions WHERE id=p_session FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'جلسة مراجعة غير موجودة'; END IF;
 IF session_row.reviewer_id IS DISTINCT FROM p_reviewer THEN
   RAISE EXCEPTION 'مراجعة الدفعة متاحة للمعلم المكلّف بها فقط';
 END IF;
 IF session_row.completed_at IS NOT NULL THEN
   RAISE EXCEPTION 'الجلسة منتهية؛ لا يمكن تعديل مراجعة الأوراق';
 END IF;
 SELECT count(*) INTO total_count FROM public.nafes_scan_sheets WHERE session_id=p_session;
 IF total_count<>session_row.expected_count THEN
   RAISE EXCEPTION 'لم يكتمل رفع الأوراق؛ المتوقع % والمحفوظ %',session_row.expected_count,total_count;
 END IF;
 expected:=nullif(session_row.review_snapshot->>'question_count','')::integer;
 IF expected IS NULL OR expected NOT BETWEEN 1 AND 60 THEN
   RAISE EXCEPTION 'عدد أسئلة الجلسة غير صالح للمراجعة الجماعية';
 END IF;
 FOR r IN SELECT * FROM public.nafes_scan_sheets WHERE session_id=p_session ORDER BY ordinal LOOP
   IF r.reviewed_at IS NOT NULL THEN CONTINUE; END IF;
   snap:=coalesce(r.effective_snapshot,r.snapshot);
   IF r.blocked_duplicate OR r.duplicate_of IS NOT NULL OR r.duplicate_legacy_at IS NOT NULL
      OR r.student_id IS NULL
      OR snap->'identity_valid' IS DISTINCT FROM 'true'::jsonb
      OR snap->'markers_ok' IS DISTINCT FROM 'true'::jsonb
      OR nullif(snap->>'omr_reader_error','') IS NOT NULL
      OR snap->'omr_verification'->>'risk' IS DISTINCT FROM 'low'
      OR (coalesce(nullif(snap->'omr_verification'->>'quality_score',''),'0'))::numeric <95
      OR jsonb_typeof(snap->'answers') IS DISTINCT FROM 'array'
      OR CASE WHEN jsonb_typeof(snap->'answers')='array' THEN jsonb_array_length(snap->'answers') ELSE -1 END <> expected
      OR snap->>'grade_status' IN ('unreadable','needs_review')
      OR EXISTS(SELECT 1 FROM public.nafes_scan_alerts WHERE sheet_id=r.id)
   THEN
     exceptional_count:=exceptional_count+1;
     CONTINUE;
   END IF;
   -- Validate ALL answer marks, keys, uncertainty, and score against the
   -- stored unaltered optical evidence. Uncertainty and multiple marks
   -- must be manually adjudicated and are NEVER bulk-approved.
   IF EXISTS(
     SELECT 1 FROM jsonb_array_elements(snap->'answers') a
     WHERE jsonb_typeof(a) IS DISTINCT FROM 'object'
        OR a->>'state' NOT IN ('correct','incorrect','blank')
        OR a->>'status' NOT IN ('clear','blank')
        OR a->>'reading_status' IS DISTINCT FROM a->>'status'
        OR coalesce(a->>'review_pending','false')<>'false'
        OR coalesce(a->>'requires_verification','false')<>'false'
        OR coalesce(a->>'reviewed_manually','false')='true'
        OR (a?'uncertainty' AND (
            jsonb_typeof(a->'uncertainty') IS DISTINCT FROM 'object'
            OR EXISTS(SELECT 1 FROM jsonb_each(a->'uncertainty') u WHERE u.value<>'[]'::jsonb)
           ))
        OR a->>'correct_index' !~ '^[0-3]$'
        OR jsonb_typeof(a->'marked') IS DISTINCT FROM 'array'
        OR (
          CASE WHEN jsonb_typeof(a->'marked')='array' THEN jsonb_array_length(a->'marked') ELSE -1 END
          <> CASE WHEN a->>'status'='blank' THEN 0 ELSE 1 END
        )
        OR (a->>'status'='blank' AND (
           a->>'state'<>'blank' OR a->'selected' IS DISTINCT FROM 'null'::jsonb
           OR a->'correct' IS DISTINCT FROM 'false'::jsonb
        ))
        OR (a->>'status'='clear' AND (
            jsonb_typeof(a->'selected') IS DISTINCT FROM 'number'
            OR a->>'selected' !~ '^[0-3]$'
            OR a->'selected' IS DISTINCT FROM a->'marked'->0
            OR (a->>'state'='correct') IS DISTINCT FROM (a->>'selected'=a->>'correct_index')
            OR a->'correct' IS DISTINCT FROM to_jsonb(a->>'selected'=a->>'correct_index')
        ))
   ) OR snap->'total' IS DISTINCT FROM to_jsonb(expected)
     OR snap->'score' IS DISTINCT FROM (
      SELECT to_jsonb(count(*)::integer)
      FROM jsonb_array_elements(snap->'answers') a WHERE a->>'state'='correct'
     )
   THEN
     exceptional_count:=exceptional_count+1;
     CONTINUE;
   END IF;
   eligible_count:=eligible_count+1;
   eligible_ids:=array_append(eligible_ids,r.id);
 END LOOP;
 response:=jsonb_build_object('ok',true,'preview',NOT p_apply,
   'total',total_count,'eligible',eligible_count,'exceptions',exceptional_count,
   'eligible_sheet_ids',to_jsonb(eligible_ids),'verified_now',0);
 IF NOT p_apply THEN RETURN response; END IF;
 -- The existing atomic per-sheet validator and teacher audit remain the
 -- final authority. Unexpected errors roll back the entire batch.
 DECLARE
   sheet_to_verify uuid;
 BEGIN
 FOREACH sheet_to_verify IN ARRAY eligible_ids LOOP
   PERFORM public.nafes_scan_verify_current(
      p_session,sheet_to_verify,p_reviewer,false,
      (SELECT answer_version FROM public.nafes_scan_sheets WHERE id=sheet_to_verify)
   );
   actually_verified:=array_append(actually_verified,sheet_to_verify);
 END LOOP;
 END;
 IF cardinality(actually_verified)>0 THEN
  INSERT INTO public.nafes_scan_bulk_review_audit(session_id,reviewer_id,verified_sheet_ids,verified_count)
  VALUES(p_session,p_reviewer,actually_verified,cardinality(actually_verified));
 END IF;
 RETURN response||jsonb_build_object('preview',false,'verified_now',cardinality(actually_verified));
END;
$batch$;

REVOKE ALL ON FUNCTION public.nafes_scan_bulk_verify_clean(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nafes_scan_bulk_verify_clean(uuid,uuid,boolean) TO service_role;
