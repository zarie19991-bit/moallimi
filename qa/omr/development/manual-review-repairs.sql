-- DEVELOPMENT ONLY. Original metadata plus measured SQL fixes; NOT DEPLOYED.
-- Apply once to an isolated copy of the original schema, never automatically to production.

-- NEW shared authorization repair, derived from the v128 teacher/scope rules.
CREATE OR REPLACE FUNCTION public.nafes_scan_actor_context(p_session uuid,p_actor uuid,p_admin boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public,pg_temp AS $actor$
declare s public.nafes_scan_sessions; r public.nafes_paper_reviews;
 t public.nafes_teacher_access; subjects text[];
begin
 select * into t from public.nafes_teacher_access where id=p_actor and active;
 if not found or t.subject_scope not in ('all','reading','math','science') then raise exception 'Active authorized teacher required'; end if;
 select * into s from public.nafes_scan_sessions where id=p_session;
 if not found then raise exception 'Scan session not found'; end if;
 select * into r from public.nafes_paper_reviews where id=s.review_pk;
 subjects:=case when cardinality(r.subjects)>0 then r.subjects else array[r.subject] end;
 if subjects is null or cardinality(subjects)=0 or exists(select 1 from unnest(subjects) x where x is null or x not in ('reading','math','science')) then
   raise exception 'Review subject scope invalid';
 end if;
 if p_admin then
   if t.subject_scope<>'all' then raise exception 'Main account required for audited administrative rollback'; end if;
 else
   if s.reviewer_id<>p_actor or (t.subject_scope<>'all' and
     (r.owner_id<>p_actor or exists(select 1 from unnest(subjects) x where x<>t.subject_scope))) then
     raise exception 'Correction outside reviewer or subject authority';
   end if;
 end if;
 return jsonb_build_object('actor_id',t.id,'review_owner_id',r.owner_id,'review_pk',r.id,'session_id',s.id,'admin',p_admin);
end $actor$;
REVOKE ALL ON FUNCTION public.nafes_scan_actor_context(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nafes_scan_actor_context(uuid,uuid,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.nafes_local_rollback_proof(p_review uuid,p_session uuid,p_duplicate uuid,p_delta integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public,pg_temp AS $proof$
declare result boolean; batch text:=current_setting('moallimi.rollback_batch',true);
begin
 if batch is null or batch='' or to_regclass('public.nafes_scan_deletions') is null then return false; end if;
 EXECUTE 'SELECT count(*)>0 AND ($4=0 OR count(*)=$4)
 FROM public.nafes_scan_deletions d JOIN public.nafes_paper_reviews r ON r.id=d.review_pk
 JOIN public.nafes_teacher_access t ON t.id=d.reviewer_id
 WHERE d.batch_id::text=$1 AND d.review_pk=$2 AND t.active AND t.subject_scope=''all''
 AND (d.xmin::text)::bigint=mod((pg_current_xact_id()::text)::bigint,4294967296)
 AND ($3 IS NULL OR d.session_id=$3) AND ($5 IS NULL OR d.sheet_id=$5)'
 INTO result USING batch,p_review,p_session,p_delta,p_duplicate;
 return coalesce(result,false);
end $proof$;
REVOKE ALL ON FUNCTION public.nafes_local_rollback_proof(uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nafes_local_rollback_proof(uuid,uuid,uuid,integer) TO service_role;

-- NEW repair RPC, not an assertion that it already exists in production.
CREATE OR REPLACE FUNCTION public.nafes_scan_publish_attempts(p_session uuid,p_owner uuid,p_assessment jsonb,p_attempts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public,pg_temp AS $publish$
declare s public.nafes_scan_sessions; review public.nafes_paper_reviews;
 piece jsonb; r public.nafes_scan_sheets; assessment record; existing record; saved record;
 data jsonb; items jsonb:='[]'::jsonb; student record;
begin
 if to_regclass('public.nafes_assessments') is null or to_regclass('public.nafes_students') is null
 or to_regclass('public.nafes_assessment_attempts') is null then
   raise exception 'Original attempt SQL dependency definitions unavailable; no publication made';
 end if;
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found or s.completed_at is null then raise exception 'Reviewed session required'; end if;
 select * into review from public.nafes_paper_reviews where id=s.review_pk for update;
 perform public.nafes_scan_actor_context(p_session,p_owner,false);
 perform public.nafes_scan_finish(s.id);
 if jsonb_typeof(p_attempts) is distinct from 'array'
 or jsonb_array_length(p_attempts)<>(select count(*) from public.nafes_scan_sheets where session_id=s.id and not blocked_duplicate)
 or (select count(distinct value->>'sheet_id') from jsonb_array_elements(p_attempts))<>jsonb_array_length(p_attempts) then
   raise exception 'Incomplete or duplicated publication set';
 end if;
 -- Validate the entire set before any writes; the whole RPC is one transaction.
 for piece in select value from jsonb_array_elements(p_attempts) loop
   select * into r from public.nafes_scan_sheets where id=(piece->>'sheet_id')::uuid and session_id=s.id and not blocked_duplicate;
   if not found or r.disposition<>'verified' or r.student_id<>(piece->'payload'->>'student_id')::uuid
   or r.answer_version<>(piece->>'answer_version')::integer
   or (piece->'payload'->'score') is distinct from (coalesce(r.effective_snapshot,r.snapshot)->'score')
   or (piece->'payload'->'total') is distinct from (coalesce(r.effective_snapshot,r.snapshot)->'total') then
     raise exception 'Published attempt must match the current reviewed sheet';
   end if;
   select * into student from public.nafes_students where id=r.student_id and not is_demo;
   if not found then raise exception 'Student UUID is not in original roster'; end if;
 end loop;
 if (select count(*) from public.nafes_assessments where owner_id=review.owner_id and config->>'paper_review_id'=review.review_id)>1 then
   raise exception 'Multiple existing paper assessments; administrative reconciliation required';
 end if;
 select * into assessment from public.nafes_assessments where owner_id=review.owner_id and config->>'paper_review_id'=review.review_id for update;
 if not found then
   insert into public.nafes_assessments(owner_id,status,kind,title,config,rendered_sections)
   values(review.owner_id,'draft','multi_indicator',p_assessment->>'title',p_assessment->'config',p_assessment->'rendered_sections')
   returning * into assessment;
 elsif assessment.rendered_sections is distinct from p_assessment->'rendered_sections' then
   raise exception 'Existing assessment question snapshot differs; do not overwrite it';
 end if;
 for piece in select value from jsonb_array_elements(p_attempts) loop
   data:=piece->'payload';
   select * into existing from public.nafes_assessment_attempts where assessment_id=assessment.id
     and student_id=(data->>'student_id')::uuid order by attempt_no desc limit 1 for update;
   if found then
     if exists(select 1 from jsonb_array_elements(coalesce(existing.events,'[]'::jsonb)) e
       where e->>'scan_sheet_id'=piece->>'sheet_id' and e->>'scan_session_id'=s.id::text)
       and existing.score=(data->>'score')::numeric and existing.total=(data->>'total')::numeric
       and existing.answers is not distinct from data->'answers'
       and existing.rendered_sections is not distinct from data->'rendered_sections' then
       items:=items||jsonb_build_array(jsonb_build_object('id',existing.id,'student_id',existing.student_id,'replayed',true,
         'student_name',existing.student_name,'model',existing.config->>'paper_model',
         'score',existing.score,'total',existing.total,'percent',existing.percent)); continue;
     end if;
     raise exception 'Existing attempt is preserved; authorized audited rollback required first';
   end if;
   select * into student from public.nafes_students where id=(data->>'student_id')::uuid;
   insert into public.nafes_assessment_attempts(assessment_id,student_id,student_name,student_no,student_key,class_name,
     attempt_no,config,rendered_sections,answers,events,cursor,section_index,section_started_at,session_id,access_hash,
     lease_until,started_at,expires_at,submitted_at,score,total,percent,section_scores,is_demo)
   values(assessment.id,student.id,student.full_name,student.national_id_last3,student.id::text,student.class_name,
     1,data->'config',data->'rendered_sections',data->'answers',data->'events',(data->>'cursor')::integer,
     (data->>'section_index')::integer,(data->>'section_started_at')::timestamptz,data->>'session_id',data->>'access_hash',
     (data->>'lease_until')::timestamptz,(data->>'started_at')::timestamptz,(data->>'expires_at')::timestamptz,
     (data->>'submitted_at')::timestamptz,(data->>'score')::numeric,(data->>'total')::numeric,
     (data->>'percent')::numeric,data->'section_scores',false) returning * into saved;
   items:=items||jsonb_build_array(jsonb_build_object('id',saved.id,'student_id',saved.student_id,
     'student_name',saved.student_name,'model',data->'config'->>'paper_model','score',saved.score,'total',saved.total,'percent',saved.percent));
 end loop;
 if jsonb_typeof(p_assessment->'review_payload') is distinct from 'object' then
   raise exception 'Reviewed paper metadata required';
 end if;
 update public.nafes_paper_reviews set payload=p_assessment->'review_payload',updated_at=now()
 where id=review.id;
 return jsonb_build_object('assessment_id',assessment.id,'results',items);
end $publish$;
REVOKE ALL ON FUNCTION public.nafes_scan_publish_attempts(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nafes_scan_publish_attempts(uuid,uuid,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.nafes_scan_delete_corrections(p_session uuid, p_sheet_ids uuid[], p_reviewer uuid, p_reason text, p_batch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.nafes_scan_sessions;
  target_count integer;
  total_count integer;
  session_deleted boolean := false;

begin
  if to_regclass('public.nafes_scan_deletions') is null
  or to_regclass('public.nafes_assessment_attempts') is null
  or to_regclass('public.nafes_assessments') is null
  or to_regclass('public.nafes_students') is null then
    raise exception 'Original rollback SQL definitions unavailable; no changes made';
  end if;
  if not exists(select 1 from public.nafes_teacher_access where id=p_reviewer and active and subject_scope='all') then
    raise exception 'Reviewer not authorized';
  end if;
  if exists(select 1 from public.nafes_scan_deletions where batch_id=p_batch) then
    if (select array_agg(sheet_id order by sheet_id) from public.nafes_scan_deletions
        where batch_id=p_batch and session_id=p_session and reviewer_id=p_reviewer and reason=btrim(p_reason))
       is distinct from array(select unnest(p_sheet_ids) order by 1) then
      raise exception 'Rollback request ID conflict';
    end if;
    return jsonb_build_object('deleted_count',cardinality(p_sheet_ids),'replayed',true,
      'session_deleted',not exists(select 1 from public.nafes_scan_sessions where id=p_session),'batch_id',p_batch);
  end if;
  if p_batch is null then raise exception 'Rollback request ID required'; end if;
  if p_sheet_ids is null or cardinality(p_sheet_ids)=0 then
    raise exception 'لم تحدد أي تصحيحات للحذف';
  end if;
  if cardinality(p_sheet_ids)>200 then
    raise exception 'عدد التصحيحات المحددة أكبر من الحد المسموح';
  end if;
  if p_reason is null or length(trim(p_reason))<3 then
    raise exception 'سبب الحذف مطلوب';
  end if;

  select * into s
  from public.nafes_scan_sessions
  where id=p_session
  for update;
  if not found then raise exception 'جلسة المراجعة غير موجودة'; end if;


  perform 1 from public.nafes_paper_reviews where id=s.review_pk for update;
  perform public.nafes_scan_actor_context(p_session,p_reviewer,true);
  perform 1 from public.nafes_scan_sheets where session_id=p_session and id=any(p_sheet_ids) order by id for update;
  -- Refuse unrelated ownership, student linkage, online history or mixed corrections.
  if exists(select 1 from public.nafes_assessment_attempts a
    where exists(select 1 from jsonb_array_elements(coalesce(a.events,'[]'::jsonb)) e where e->>'scan_sheet_id'=any(select unnest(p_sheet_ids)::text))
      and (not exists(select 1 from public.nafes_assessments x where x.id=a.assessment_id and x.owner_id=(select owner_id from public.nafes_paper_reviews where id=s.review_pk)
              and x.config->>'paper_review_id'=(select review_id from public.nafes_paper_reviews where id=s.review_pk))
        or not exists(select 1 from public.nafes_scan_sheets x where x.id=any(p_sheet_ids) and x.student_id=a.student_id)
        or exists(select 1 from jsonb_array_elements(coalesce(a.events,'[]'::jsonb)) e
        where e->>'type' is distinct from 'paper_scan' or e->>'scan_session_id' is distinct from p_session::text
           or not coalesce(e->>'scan_sheet_id'=any(select unnest(p_sheet_ids)::text),false)))) then
    raise exception 'Attempt contains other corrections; rollback refused without losing their results';
  end if;
  select count(*) into target_count
  from public.nafes_scan_sheets
  where session_id=p_session and id=any(p_sheet_ids);
  if target_count<>cardinality(p_sheet_ids) then
    raise exception 'بعض التصحيحات المحددة غير موجودة في هذه الجلسة';
  end if;

  select count(*) into total_count
  from public.nafes_scan_sheets
  where session_id=p_session;

  insert into public.nafes_scan_deletions(
    batch_id,review_pk,session_id,sheet_id,student_id,sheet_no,student_name,model,
    reviewer_id,reason,had_published_attempt,snapshot_summary
  )
  select
    p_batch,x.review_pk,x.session_id,x.id,x.student_id,x.sheet_no,
    coalesce(x.effective_snapshot->>'student_name',x.snapshot->>'student_name'),
    coalesce(x.effective_snapshot->>'model',x.snapshot->>'model'),
    p_reviewer,trim(p_reason),
    exists(
      select 1
      from public.nafes_assessment_attempts a,
      lateral jsonb_array_elements(coalesce(a.events,'[]'::jsonb)) e
      where e->>'scan_sheet_id'=x.id::text
    ),
    jsonb_build_object(
      'ordinal',x.ordinal,
      'score',coalesce(x.effective_snapshot->'score',x.snapshot->'score'),
      'total',coalesce(x.effective_snapshot->'total',x.snapshot->'total'),
      'disposition',x.disposition,
      'answer_version',x.answer_version,
      
      'uploaded_at',x.uploaded_at,
      'deleted_sheet',to_jsonb(x)-'image_data',
      'answer_edits',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.nafes_scan_answer_edits e where e.sheet_id=x.id),
      'identity_edits',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.nafes_scan_identity_edits e where e.sheet_id=x.id),
      'attempts',(select coalesce(jsonb_agg(to_jsonb(a)-array['access_hash','session_id','lease_until']),'[]'::jsonb) from public.nafes_assessment_attempts a
        where exists(select 1 from jsonb_array_elements(coalesce(a.events,'[]'::jsonb)) e where e->>'scan_sheet_id'=x.id::text))
    )
  from public.nafes_scan_sheets x
  where x.session_id=p_session and x.id=any(p_sheet_ids);


  perform set_config('moallimi.rollback_batch',p_batch::text,true);
  delete from public.nafes_assessment_attempts a
  where exists (
    select 1
    from jsonb_array_elements(coalesce(a.events,'[]'::jsonb)) e
    where e->>'scan_sheet_id'=any(select unnest(p_sheet_ids)::text)
  );

  update public.nafes_scan_sheets
  set duplicate_of=null
  where duplicate_of=any(p_sheet_ids);

  delete from public.nafes_scan_alerts
  where sheet_id=any(p_sheet_ids) or original_sheet_id=any(p_sheet_ids);

  delete from public.nafes_scan_answer_edits
  where sheet_id=any(p_sheet_ids);

  delete from public.nafes_scan_identity_edits
  where sheet_id=any(p_sheet_ids);

  delete from public.nafes_scan_sheets
  where session_id=p_session and id=any(p_sheet_ids);

  if target_count=total_count then
    delete from public.nafes_scan_sessions where id=p_session;
    session_deleted:=true;
  else
    update public.nafes_scan_sessions
    set expected_count=greatest(1, expected_count-target_count),
        completed_at=null
    where id=p_session;
  end if;

  return jsonb_build_object(
    'deleted_count',target_count,
    'session_deleted',session_deleted,
    'batch_id',p_batch
  );
end $function$
;

REVOKE ALL ON FUNCTION public.nafes_scan_delete_corrections(uuid,uuid[],uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nafes_scan_delete_corrections(uuid,uuid[],uuid,text,uuid) TO service_role;

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
CREATE OR REPLACE FUNCTION public.nafes_scan_edit_answer(p_session uuid, p_sheet uuid, p_reviewer uuid, p_question integer, p_marked integer[], p_version integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 raise exception 'سبب التعديل اليدوي مطلوب؛ استخدم التوقيع المحلي المحدّث';
end $function$
;
CREATE OR REPLACE FUNCTION public.nafes_scan_edit_answer(p_session uuid, p_sheet uuid, p_reviewer uuid, p_question integer, p_marked integer[], p_version integer, p_request uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.nafes_scan_sessions; r public.nafes_scan_sheets; prior public.nafes_scan_answer_edits;
 current_snapshot jsonb; before_q jsonb; after_q jsonb; marked integer[]; state text; answer_status text; correct_idx integer;

begin
 if p_reason is null or length(trim(p_reason)) not between 3 and 1000 then
   raise exception 'سبب التعديل اليدوي مطلوب';
 end if;
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة غير موجودة'; end if;
 select * into r from public.nafes_scan_sheets where id=p_sheet and session_id=s.id for update;
 if not found then raise exception 'ورقة غير موجودة'; end if;
 if p_marked is null or cardinality(p_marked)>4 or array_position(p_marked,null) is not null
 or exists(select 1 from unnest(p_marked) m where m<0 or m>3) then raise exception 'اختيارات غير صالحة';end if;
 select coalesce(array_agg(distinct m order by m),'{}'::integer[]) into marked from unnest(p_marked) m;
 
 if cardinality(marked)<>cardinality(p_marked) then raise exception 'اختيارات مكررة غير صالحة'; end if;
 select * into prior from public.nafes_scan_answer_edits where id=p_request;
 if found then
   if prior.sheet_id<>r.id or prior.reviewer_id<>p_reviewer or prior.question<>p_question or prior.after_answer->'marked'<>to_jsonb(marked) or prior.after_answer->>'manual_reason' is distinct from trim(p_reason) then raise exception 'تعارض طلب التعديل';end if;
   return to_jsonb(r)-'image_data';
 end if;
 if s.completed_at is not null then raise exception 'انتهت المراجعة؛ لا يمكن تعديل إجابات الجلسة المعتمدة';end if;
 if p_version is distinct from r.answer_version then raise exception 'تغيرت الورقة لدى مراجع آخر؛ أعد فتحها قبل التعديل';end if;
 if (select count(*) from public.nafes_scan_sheets where session_id=s.id)<>s.expected_count then raise exception 'انتظر اكتمال رفع جميع الأوراق';end if;
 if exists(select 1 from public.nafes_scan_sheets where session_id=s.id and ordinal<r.ordinal and reviewed_at is null) then raise exception 'راجع الورقة السابقة أولًا';end if;
 current_snapshot:=coalesce(r.effective_snapshot,r.snapshot);
 if p_question is null or p_question<1 or p_question>jsonb_array_length(current_snapshot->'answers') then raise exception 'رقم سؤال غير صالح';end if;
 before_q:=current_snapshot->'answers'->(p_question-1);
 correct_idx:=(before_q->>'correct_index')::integer;
 
 if correct_idx not between 0 and 3 then correct_idx:=null; end if;
 answer_status:=case when cardinality(marked)=0 then 'blank' when cardinality(marked)>1 then 'multiple' else 'clear' end;
 state:=case when cardinality(marked)=0 then 'blank' when cardinality(marked)>1 then 'multiple'
 when correct_idx is null then 'uncertain' when marked[1]=correct_idx then 'correct' else 'incorrect' end;
 
 if current_snapshot->'identity_valid' is distinct from 'true'::jsonb
 or current_snapshot->'markers_ok' is distinct from 'true'::jsonb then state:='uncertain'; end if;
 after_q:=before_q||jsonb_build_object('selected',case when cardinality(marked)=1 then marked[1] else null end,
 'marked',to_jsonb(marked),'status',answer_status,'state',state,'correct',state='correct','reviewed_manually',true,
 'manual_reason',trim(p_reason),'reading_status',answer_status,
 'reader_selected',coalesce(before_q->'reader_selected',before_q->'selected'),
 'review_pending',state='uncertain','requires_verification',state='uncertain',
 'uncertainty',jsonb_build_object(
   'reading',case when current_snapshot->'markers_ok'='true'::jsonb then '[]'::jsonb else '["markers_not_verified"]'::jsonb end,
   'identity',case when current_snapshot->'identity_valid'='true'::jsonb then '[]'::jsonb else '["identity_not_verified"]'::jsonb end,
   'answer_key',case when correct_idx is not null then '[]'::jsonb else '["answer_key_missing_or_invalid"]'::jsonb end));
 current_snapshot:=jsonb_set(current_snapshot,array['answers',(p_question-1)::text],after_q);
 current_snapshot:=current_snapshot||jsonb_build_object('score',(select count(*) from jsonb_array_elements(current_snapshot->'answers') a where a->>'state'='correct'),
 'counts',(select jsonb_build_object('blank',count(*) filter(where a->>'state'='blank'),'multiple',count(*) filter(where a->>'state'='multiple'),
 'correct',count(*) filter(where a->>'state'='correct'),'incorrect',count(*) filter(where a->>'state'='incorrect'),'uncertain',count(*) filter(where a->>'state'='uncertain')) from jsonb_array_elements(current_snapshot->'answers') a));
 insert into public.nafes_scan_answer_edits(id,sheet_id,reviewer_id,question,before_answer,after_answer,answer_version)
 values(p_request,r.id,p_reviewer,p_question,before_q,after_q,r.answer_version+1);
 update public.nafes_scan_sheets set effective_snapshot=current_snapshot,answer_version=answer_version+1,
 reviewed_at=null,reviewed_by=null,disposition=null where id=r.id returning * into r;
 return to_jsonb(r)-'image_data';
end $function$

;
CREATE OR REPLACE FUNCTION public.nafes_scan_assign_identity(p_session uuid, p_sheet uuid, p_reviewer uuid, p_student uuid, p_sheet_no integer, p_student_name text, p_model text, p_effective jsonb, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.nafes_scan_sessions;

  r public.nafes_scan_sheets;
  old_snapshot jsonb; old_q jsonb; new_q jsonb; new_answers jsonb:='[]'::jsonb;
  identity_reason text; i integer;
begin
  select * into s from public.nafes_scan_sessions where id=p_session for update;
  if not found then raise exception 'جلسة المراجعة غير موجودة'; end if;
  if s.completed_at is not null then raise exception 'الجلسة منتهية؛ لا يمكن تغيير هوية الورقة بعد إنهاء المراجعة'; end if;


  perform 1 from public.nafes_paper_reviews where id=s.review_pk for update;
  select * into r from public.nafes_scan_sheets
  where id=p_sheet and session_id=p_session
  for update;
  if not found then raise exception 'ورقة غير موجودة'; end if;
  if r.answer_version is distinct from p_version then
    raise exception 'تغيرت الورقة لدى مراجع آخر؛ أعد فتحها قبل تعيين الطالب';
  end if;
  if p_student_name is null or length(trim(p_student_name))<2 then
    raise exception 'اسم الطالب غير صالح';
  end if;
  if p_model is null or length(trim(p_model))<1 then
    raise exception 'النموذج غير صالح';
  end if;


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

  if exists(
    select 1 from public.nafes_scan_sheets x
    where x.review_pk=s.review_pk
      and x.id<>r.id
      and x.student_id=p_student
      and not x.blocked_duplicate
      and coalesce(x.disposition,'pending')<>'requires_rescan'
  ) then
    raise exception 'هذا الطالب مرتبط بورقة أخرى في الاختبار؛ راجع تنبيه التكرار أولًا';
  end if;

  insert into public.nafes_scan_identity_edits(
    sheet_id,session_id,review_pk,reviewer_id,student_id,sheet_no,student_name,model,reason,before_identity,answer_version
  ) values(
    r.id,r.session_id,r.review_pk,p_reviewer,p_student,p_sheet_no,trim(p_student_name),trim(p_model),trim(identity_reason),
    jsonb_build_object('student_id',r.student_id,'sheet_no',r.sheet_no,
      'student_name',old_snapshot->'student_name','model',old_snapshot->'model'),r.answer_version+1
  );

  update public.nafes_scan_sheets
  set student_id=p_student,
      sheet_no=p_sheet_no,
      effective_snapshot=p_effective,
      answer_version=answer_version+1,
      reviewed_at=null,
      reviewed_by=null,
      disposition=null
  where id=r.id
  returning * into r;



  return to_jsonb(r)-'image_data';
end $function$

;
CREATE OR REPLACE FUNCTION public.nafes_scan_verify(p_session uuid, p_sheet uuid, p_reviewer uuid, p_ack boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.nafes_scan_sessions; r public.nafes_scan_sheets; d text; effective jsonb;
 a jsonb; m jsonb; n integer; chosen integer; key_index integer; distinct_marks integer;

begin
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة غير موجودة'; end if;
 select * into r from public.nafes_scan_sheets where id=p_sheet and session_id=s.id for update;
 if not found then raise exception 'ورقة غير موجودة'; end if;
 if not r.blocked_duplicate then

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

 end if;
 if r.reviewed_at is not null then return to_jsonb(r)-'image_data'; end if;
 if s.completed_at is not null then raise exception 'الجلسة مغلقة'; end if;
 if (select count(*) from public.nafes_scan_sheets where session_id=s.id)<>s.expected_count then raise exception 'انتظر اكتمال رفع جميع الأوراق'; end if;
 if exists(select 1 from public.nafes_scan_sheets where session_id=s.id and ordinal<r.ordinal and reviewed_at is null) then raise exception 'راجع الورقة السابقة أولًا'; end if;
 if exists(select 1 from public.nafes_scan_alerts where sheet_id=r.id) and not p_ack then raise exception 'يجب تأكيد الاطلاع على تنبيه التكرار'; end if;
 effective:=coalesce(r.effective_snapshot,r.snapshot);
 d:=case when r.blocked_duplicate then 'duplicate' else 'verified' end;
 update public.nafes_scan_sheets set reviewed_at=now(),reviewed_by=p_reviewer,disposition=d where id=r.id returning * into r;
 update public.nafes_scan_alerts set acknowledged_at=coalesce(acknowledged_at,now()),acknowledged_by=coalesce(acknowledged_by,p_reviewer) where sheet_id=r.id;
 return to_jsonb(r)-'image_data';
end $function$

;
CREATE OR REPLACE FUNCTION public.nafes_scan_finish(p_session uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.nafes_scan_sessions; r public.nafes_scan_sheets; effective jsonb;
 a jsonb; m jsonb; n integer; chosen integer; key_index integer; distinct_marks integer;

begin
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة غير موجودة'; end if;
 if (select count(*) from public.nafes_scan_sheets where session_id=s.id)<>s.expected_count
 or exists(select 1 from public.nafes_scan_sheets where session_id=s.id and reviewed_at is null) then raise exception 'يجب مراجعة جميع الأوراق أولًا'; end if;

 -- Session lock plus the guarded update path serialize completion against late writes.
 for r in select * from public.nafes_scan_sheets where session_id=s.id order by ordinal loop
   if r.blocked_duplicate then
     if r.disposition is distinct from 'duplicate' then raise exception 'راجع تنبيه التكرار'; end if;
   else
     if r.disposition is distinct from 'verified' then raise exception 'لم تُحسم مراجعة جميع الأوراق'; end if;

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

   end if;
 end loop;
 update public.nafes_scan_sessions set completed_at=coalesce(completed_at,now()) where id=s.id returning * into s;
 return to_jsonb(s);
end $function$
;

-- Teacher keys are checked by Edge. Never expose definer RPCs to an unauthenticated caller
-- that can simply supply a reviewer UUID; discover actual overload signatures, not guessed ones.
-- Explicit DEVELOPMENT repair ACL, not a claim that these are the exported production ACLs.
-- Original invoker routines require these operations; no public grants or disabled RLS.
GRANT SELECT,INSERT,UPDATE ON public.nafes_paper_reviews,public.nafes_scan_sessions,public.nafes_scan_sheets TO service_role;
GRANT SELECT,INSERT ON public.nafes_scan_answer_edits,public.nafes_scan_identity_edits,public.nafes_scan_alerts TO service_role;
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