"""Local, fail-closed changes to the six supplied routines; never execute in production."""


def replace_once(text, before, after):
    assert text.count(before) == 1, f"Original SQL anchor changed: {before[:100]}"
    return text.replace(before, after, 1)


VALIDATION_DECLARATIONS = """
 a jsonb; m jsonb; n integer; chosen integer; key_index integer; distinct_marks integer;
"""
VALIDATE = """
 effective:=coalesce(r.effective_snapshot,r.snapshot);
 if r.student_id is null or effective->'identity_valid' is distinct from 'true'::jsonb then
   raise exception 'هوية الورقة غير مؤكدة';
 end if;
 if effective->'markers_ok' is distinct from 'true'::jsonb then
   raise exception 'مربعات الورقة تحتاج تحققًا';
 end if;
 if jsonb_typeof(effective->'answers') is distinct from 'array'
 or coalesce(s.review_snapshot->>'question_count','') !~ '^[0-9]+$' then
   raise exception 'إجابات الورقة غير مكتملة';
 end if;
 if (s.review_snapshot->>'question_count')::integer not between 1 and 60
 or jsonb_array_length(effective->'answers')<>(s.review_snapshot->>'question_count')::integer then
   raise exception 'إجابات الورقة غير مكتملة';
 end if;
 if effective ? 'quality_score' and nullif(effective->>'quality_score','') is not null
 and (effective->>'quality_score')::numeric < 35 then
   raise exception 'جودة الورقة تحتاج تحققًا';
 end if;
 for a in select value from jsonb_array_elements(effective->'answers') loop
   if jsonb_typeof(a) is distinct from 'object'
   or coalesce(a->>'state','') not in ('correct','incorrect','blank','multiple')
   or coalesce(a->>'status','') not in ('clear','blank','multiple')
   or coalesce(a->>'reading_status',a->>'status','') not in ('clear','blank','multiple')
   or coalesce(a->>'reading_status',a->>'status','') is distinct from a->>'status'
   or coalesce(a->>'review_pending','false')<>'false'
   or coalesce(a->>'requires_verification','false')<>'false' then
     raise exception 'توجد إجابات غير محسومة أو تحتاج مراجعة';
   end if;
   if a ? 'uncertainty' then
     if jsonb_typeof(a->'uncertainty') is distinct from 'object' then
       raise exception 'أسباب عدم الحسم غير صالحة';
     end if;
     if exists(select 1 from jsonb_each(a->'uncertainty') x where x.value<>'[]'::jsonb) then
       raise exception 'توجد أسباب عدم حسم تحتاج مراجعة';
     end if;
   end if;
   if jsonb_typeof(a->'marked') is distinct from 'array' then
     raise exception 'أدلة التظليل غير صالحة';
   end if;
   n:=jsonb_array_length(a->'marked');
   for m in select value from jsonb_array_elements(a->'marked') loop
     if jsonb_typeof(m)<>'number' or m::text !~ '^[0-3]$' then
       raise exception 'اختيار خارج نطاق الفقاعات';
     end if;
   end loop;
   select count(distinct value) into distinct_marks from jsonb_array_elements(a->'marked');
   if distinct_marks<>n then raise exception 'اختيارات مكررة وليست تظليلًا متعددًا مثبتًا'; end if;
   if jsonb_typeof(a->'correct_index') is distinct from 'number'
   or coalesce(a->>'correct_index','') !~ '^[0-3]$' then
     raise exception 'مفتاح التصحيح غير مكتمل';
   end if;
   key_index:=(a->>'correct_index')::integer;
   if a->>'status'='clear' then
     if n<>1 or jsonb_typeof(a->'selected') is distinct from 'number'
     or coalesce(a->>'selected','') !~ '^[0-3]$' then
       raise exception 'الإجابة الواحدة غير مثبتة';
     end if;
     chosen:=(a->>'selected')::integer;
     if a->'marked'->0 <> a->'selected'
     or a->>'state' not in ('correct','incorrect')
     or (a->>'state'='correct') is distinct from (chosen=key_index)
     or a->'correct' is distinct from to_jsonb(chosen=key_index) then
       raise exception 'أدلة الإجابة أو تصنيفها متناقضة';
     end if;
   elsif a->>'status'='blank' then
     if n<>0 or a->'selected' is distinct from 'null'::jsonb
     or a->>'state'<>'blank' or a->'correct' is distinct from 'false'::jsonb then
       raise exception 'الفراغ غير مثبت';
     end if;
   else
     if n<2 or a->'selected' is distinct from 'null'::jsonb
     or a->>'state'<>'multiple' or a->'correct' is distinct from 'false'::jsonb then
       raise exception 'التظليل المتعدد غير مثبت';
     end if;
   end if;
 end loop;
 if effective->'total' is distinct from to_jsonb(jsonb_array_length(effective->'answers'))
 or effective->'score' is distinct from
   (select to_jsonb(count(*)::integer) from jsonb_array_elements(effective->'answers') x where x->>'state'='correct') then
   raise exception 'إجمالي الدرجة لا يتفق مع الإجابات المحسومة';
 end if;
"""


def build_repairs(bodies):
    edit_original = bodies["nafes_scan_edit_answer"]["definition"]
    edit = replace_once(edit_original, "p_request uuid)", "p_request uuid, p_reason text)")
    edit = replace_once(edit, "begin\n select * into s", """
begin
 if p_reason is null or length(trim(p_reason)) not between 3 and 1000 then
   raise exception 'سبب التعديل اليدوي مطلوب';
 end if;
 select * into s""")
    edit = replace_once(edit, "prior.after_answer->'marked'<>to_jsonb(marked)",
                        "prior.after_answer->'marked'<>to_jsonb(marked) "
                        "or prior.after_answer->>'manual_reason' is distinct from trim(p_reason)")
    edit = replace_once(edit,
                        "(r.snapshot->'answers'->(p_question-1)->>'correct_index')::integer",
                        "(before_q->>'correct_index')::integer")
    edit = replace_once(edit, "answer_status:=case", """
 if correct_idx not between 0 and 3 then correct_idx:=null; end if;
 answer_status:=case""")
    edit = replace_once(edit, "select * into prior from public.nafes_scan_answer_edits", """
 if cardinality(marked)<>cardinality(p_marked) then raise exception 'اختيارات مكررة غير صالحة'; end if;
 select * into prior from public.nafes_scan_answer_edits""")
    edit = replace_once(edit, "after_q:=before_q||jsonb_build_object", """
 if current_snapshot->'identity_valid' is distinct from 'true'::jsonb
 or current_snapshot->'markers_ok' is distinct from 'true'::jsonb then state:='uncertain'; end if;
 after_q:=before_q||jsonb_build_object""")
    edit = replace_once(edit, "'correct',state='correct','reviewed_manually',true)",
                        """'correct',state='correct','reviewed_manually',true,
 'manual_reason',trim(p_reason),'reading_status',answer_status,
 'reader_selected',coalesce(before_q->'reader_selected',before_q->'selected'),
 'review_pending',state='uncertain','requires_verification',state='uncertain',
 'uncertainty',jsonb_build_object(
   'reading',case when current_snapshot->'markers_ok'='true'::jsonb then '[]'::jsonb else '["markers_not_verified"]'::jsonb end,
   'identity',case when current_snapshot->'identity_valid'='true'::jsonb then '[]'::jsonb else '["identity_not_verified"]'::jsonb end,
   'answer_key',case when correct_idx is not null then '[]'::jsonb else '["answer_key_missing_or_invalid"]'::jsonb end))""")
    # Keep the old seven-argument endpoint, but do not allow it to bypass reason enforcement.
    legacy_edit = edit_original[:edit_original.index("AS $function$")] + """AS $function$
begin
 raise exception 'سبب التعديل اليدوي مطلوب؛ استخدم التوقيع المحلي المحدّث';
end $function$"""

    identity = bodies["nafes_scan_assign_identity"]["definition"]
    identity = replace_once(identity, "  r public.nafes_scan_sheets;\nbegin", """
  r public.nafes_scan_sheets;
  old_snapshot jsonb; old_q jsonb; new_q jsonb; new_answers jsonb:='[]'::jsonb;
  identity_reason text; i integer;
begin""")
    identity = replace_once(identity, "  select * into r from public.nafes_scan_sheets", """
  perform 1 from public.nafes_paper_reviews where id=s.review_pk for update;
  select * into r from public.nafes_scan_sheets""")
    identity_guard = """
  identity_reason:=p_effective->>'identity_manual_reason';
  if jsonb_typeof(p_effective->'identity_manual_reason') is distinct from 'string'
  or length(trim(identity_reason)) not between 3 and 1000 then
    raise exception 'سبب تعديل الهوية مطلوب';
  end if;
  old_snapshot:=coalesce(r.effective_snapshot,r.snapshot);
  if jsonb_typeof(p_effective->'answers') is distinct from 'array'
  or jsonb_array_length(p_effective->'answers')<>jsonb_array_length(old_snapshot->'answers') then
    raise exception 'تغيير الهوية لا يسمح بتغيير إجابات الورقة';
  end if;
  for i in 0..jsonb_array_length(old_snapshot->'answers')-1 loop
    old_q:=old_snapshot->'answers'->i;
    new_q:=p_effective->'answers'->i;
    if new_q->'marked' is distinct from old_q->'marked'
    or new_q->'question' is distinct from old_q->'question'
    or new_q->'status' is distinct from old_q->'status'
    or (old_q->>'status'<>'ambiguous' and new_q->'selected' is distinct from old_q->'selected')
    or (old_q->>'status'='ambiguous' and new_q->'selected' is distinct from 'null'::jsonb) then
      raise exception 'تغيير الهوية لا يسمح بتغيير اختيارات الفقاعات';
    end if;
    if old_q->'reviewed_manually'='true'::jsonb
    and (new_q->'reviewed_manually' is distinct from old_q->'reviewed_manually'
      or new_q->'manual_reason' is distinct from old_q->'manual_reason'
      or new_q->'manual_review' is distinct from old_q->'manual_review') then
      raise exception 'تغيير الهوية لا يمحو المراجعة اليدوية';
    end if;
    if old_q->>'state'='uncertain' or old_q->>'status'='ambiguous'
    or old_q->'review_pending'='true'::jsonb then
      new_q:=new_q||jsonb_build_object('state','uncertain','correct',false,
        'review_pending',true,'requires_verification',true);
      new_q:=new_q||jsonb_build_object('uncertainty',
        coalesce(new_q->'uncertainty','{}'::jsonb)||jsonb_build_object(
          'reading',coalesce(new_q->'uncertainty'->'reading','[]'::jsonb)
           ||'["prior_uncertainty_requires_explicit_review"]'::jsonb));
    end if;
    new_answers:=new_answers||jsonb_build_array(new_q);
  end loop;
  p_effective:=p_effective||jsonb_build_object('answers',new_answers,
    'score',(select count(*) from jsonb_array_elements(new_answers) a where a->>'state'='correct'),
    'counts',(select jsonb_build_object('correct',count(*) filter(where a->>'state'='correct'),
      'incorrect',count(*) filter(where a->>'state'='incorrect'),'blank',count(*) filter(where a->>'state'='blank'),
      'multiple',count(*) filter(where a->>'state'='multiple'),'uncertain',count(*) filter(where a->>'state'='uncertain'))
      from jsonb_array_elements(new_answers) a));
"""
    identity = replace_once(identity, "  if exists(\n    select 1", identity_guard + "\n  if exists(\n    select 1")
    start = identity.index("  insert into public.nafes_scan_identity_edits(")
    end = identity.index("\n\n  return", start)
    audit = identity[start:end]
    identity = identity[:start] + identity[end:]
    audit = replace_once(audit, "student_name,model\n", "student_name,model,reason,before_identity,answer_version\n")
    audit = replace_once(audit, "trim(p_student_name),trim(p_model)\n",
                         """trim(p_student_name),trim(p_model),trim(identity_reason),
    jsonb_build_object('student_id',r.student_id,'sheet_no',r.sheet_no,
      'student_name',old_snapshot->'student_name','model',old_snapshot->'model'),r.answer_version+1
""")
    identity = replace_once(identity, "  update public.nafes_scan_sheets", audit + "\n\n  update public.nafes_scan_sheets")

    verify = bodies["nafes_scan_verify"]["definition"]
    verify = replace_once(verify, "d text; effective jsonb;", "d text; effective jsonb;" + VALIDATION_DECLARATIONS)
    verify = replace_once(verify, " if r.reviewed_at is not null then",
                          " if not r.blocked_duplicate then\n" + VALIDATE + "\n end if;\n if r.reviewed_at is not null then")
    # The original raw identity/marker checks caused a corrected identity to require rescan forever.
    a = verify.index(" d:=case when r.blocked_duplicate")
    b = verify.index("\n update public.nafes_scan_sheets", a)
    verify = verify[:a] + " d:=case when r.blocked_duplicate then 'duplicate' else 'verified' end;" + verify[b:]

    finish = bodies["nafes_scan_finish"]["definition"]
    finish = replace_once(finish, "declare s public.nafes_scan_sessions;",
                          "declare s public.nafes_scan_sessions; r public.nafes_scan_sheets; effective jsonb;" + VALIDATION_DECLARATIONS)
    finish = replace_once(finish, " update public.nafes_scan_sessions", """
 -- Session lock plus the guarded update path serialize completion against late writes.
 for r in select * from public.nafes_scan_sheets where session_id=s.id order by ordinal loop
   if r.blocked_duplicate then
     if r.disposition is distinct from 'duplicate' then raise exception 'راجع تنبيه التكرار'; end if;
   else
     if r.disposition is distinct from 'verified' then raise exception 'لم تُحسم مراجعة جميع الأوراق'; end if;
""" + VALIDATE + """
   end if;
 end loop;
 update public.nafes_scan_sessions""")

    guard = """
-- Additive columns; historical identity logs are not fabricated or backfilled.
ALTER TABLE public.nafes_scan_identity_edits ADD COLUMN reason text;
ALTER TABLE public.nafes_scan_identity_edits ADD COLUMN before_identity jsonb;
ALTER TABLE public.nafes_scan_identity_edits ADD COLUMN answer_version integer;
ALTER TABLE public.nafes_scan_identity_edits ADD CONSTRAINT nafes_scan_identity_reason_check
 CHECK (reason IS NULL OR length(trim(reason)) BETWEEN 3 AND 1000);

-- This is a new local integrity guard, not an assertion that production already has it.
CREATE FUNCTION public.nafes_scan_review_write_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path TO public,pg_temp AS $guard$
declare
 done timestamptz; old_effective jsonb; new_effective jsonb; has_manual boolean; audited boolean;
begin
 -- NOWAIT avoids reverse row/session lock deadlocks for direct reprocessing updates.
 select completed_at into done from public.nafes_scan_sessions where id=old.session_id for update nowait;
 if new.session_id is distinct from old.session_id or new.review_pk is distinct from old.review_pk then
   raise exception 'لا يمكن نقل الورقة إلى جلسة أخرى';
 end if;
 old_effective:=coalesce(old.effective_snapshot,old.snapshot);
 new_effective:=coalesce(new.effective_snapshot,new.snapshot);
 if done is not null then
   if old.blocked_duplicate and new.blocked_duplicate and new.duplicate_of is null
   and (to_jsonb(new)-'duplicate_of')=(to_jsonb(old)-'duplicate_of')
   and public.nafes_local_rollback_proof(old.review_pk,null,old.duplicate_of,0) then return new; end if;
   if (to_jsonb(new)-'effective_snapshot') is distinct from (to_jsonb(old)-'effective_snapshot')
   or (new_effective-'omr_reprocess_proposal') is distinct from (old_effective-'omr_reprocess_proposal') then
     raise exception 'الجلسة معتمدة؛ لا تُغيّر إجاباتها أو هوية أوراقها';
   end if;
 end if;
 select exists(select 1 from jsonb_array_elements(old_effective->'answers') a
   where a->'reviewed_manually'='true'::jsonb) into has_manual;
 select exists(select 1 from public.nafes_scan_answer_edits e
   where e.sheet_id=old.id and e.answer_version=new.answer_version and new.answer_version=old.answer_version+1
     and e.after_answer=new_effective->'answers'->(e.question-1))
 or exists(select 1 from public.nafes_scan_identity_edits e
   where e.sheet_id=old.id and e.answer_version=new.answer_version and new.answer_version=old.answer_version+1)
 into audited;
 if (has_manual or old.reviewed_at is not null) and not audited then
   if new_effective->'answers' is distinct from old_effective->'answers'
   or new.answer_version is distinct from old.answer_version
   or (old.reviewed_at is not null and (
     new.reviewed_at is distinct from old.reviewed_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.disposition is distinct from old.disposition)) then
     raise exception 'لا تمحُ المراجعة اليدوية دون تعديل مسجل';
   end if;
 end if;
 return new;
end $guard$;
CREATE TRIGGER nafes_scan_review_write_guard BEFORE UPDATE ON public.nafes_scan_sheets
 FOR EACH ROW EXECUTE FUNCTION public.nafes_scan_review_write_guard();

CREATE FUNCTION public.nafes_scan_session_close_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path TO public,pg_temp AS $guard$
begin
 if old.completed_at is not null and to_jsonb(new) is distinct from to_jsonb(old) then
   if new.completed_at is null and new.expected_count<old.expected_count
   and (to_jsonb(new)-array['completed_at','expected_count'])=(to_jsonb(old)-array['completed_at','expected_count'])
   and public.nafes_local_rollback_proof(old.review_pk,old.id,null,old.expected_count-new.expected_count) then return new; end if;
   raise exception 'الجلسة معتمدة؛ لا تعِد فتحها أو تغيير بياناتها دون مسار تدقيق معتمد';
 end if;
 return new;
end $guard$;
CREATE TRIGGER nafes_scan_session_close_guard BEFORE UPDATE ON public.nafes_scan_sessions
 FOR EACH ROW EXECUTE FUNCTION public.nafes_scan_session_close_guard();
"""
    # unchanged register/version wrapper retain the original serialization and optimistic check.
    from integration_repairs import build_integration
    return ("-- DEVELOPMENT ONLY. Original metadata plus measured SQL fixes; NOT DEPLOYED.\n"
            "-- Apply once to an isolated copy of the original schema, never automatically to production.\n"
            + build_integration() + guard + "\n;\n".join([legacy_edit, edit, identity, verify, finish]) + ";\n" + """
-- Teacher keys are checked by Edge. Never expose definer RPCs to an unauthenticated caller
-- that can simply supply a reviewer UUID; discover actual overload signatures, not guessed ones.
DO $acl$
declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array[
 'nafes_scan_register','nafes_scan_assign_identity','nafes_scan_edit_answer','nafes_scan_verify',
 'nafes_scan_verify_current','nafes_scan_finish','nafes_scan_delete_corrections','nafes_scan_publish_attempts'])
 loop
  execute 'REVOKE ALL ON FUNCTION '||f.signature||' FROM PUBLIC,anon,authenticated';
  execute 'GRANT EXECUTE ON FUNCTION '||f.signature||' TO service_role';
 end loop;
end $acl$;
""")
