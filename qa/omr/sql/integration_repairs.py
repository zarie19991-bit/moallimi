"""Stage repairs against actual source. Missing downstream schema is NEVER synthesized."""
from schema import metadata
from repairs import replace_once


def build_integration():
    original, _ = metadata()
    delete = next(f["definition"] for f in original["scan_functions"] if f["name"] == "nafes_scan_delete_corrections")
    delete = replace_once(delete, "begin\n  if p_sheet_ids", """
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
  if p_sheet_ids""")
    delete = replace_once(delete, "  select count(*) into target_count", """
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
  select count(*) into target_count""")
    delete = replace_once(delete, "'uploaded_at',x.uploaded_at", """
      'uploaded_at',x.uploaded_at,
      'deleted_sheet',to_jsonb(x)-'image_data',
      'answer_edits',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.nafes_scan_answer_edits e where e.sheet_id=x.id),
      'identity_edits',(select coalesce(jsonb_agg(to_jsonb(e)),'[]'::jsonb) from public.nafes_scan_identity_edits e where e.sheet_id=x.id),
      'attempts',(select coalesce(jsonb_agg(to_jsonb(a)-array['access_hash','session_id','lease_until']),'[]'::jsonb) from public.nafes_assessment_attempts a
        where exists(select 1 from jsonb_array_elements(coalesce(a.events,'[]'::jsonb)) e where e->>'scan_sheet_id'=x.id::text))""")
    delete = replace_once(delete, "  delete from public.nafes_assessment_attempts a", """
  perform set_config('moallimi.rollback_batch',p_batch::text,true);
  delete from public.nafes_assessment_attempts a""")
    # Do not renumber physical pages after rollback. Upload count remains the number of survivors;
    # the existing register protocol can refill a missing ordinal explicitly.
    helper = """
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
"""
    return helper + "\n" + delete + ";\n" + """
REVOKE ALL ON FUNCTION public.nafes_scan_delete_corrections(uuid,uuid[],uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nafes_scan_delete_corrections(uuid,uuid[],uuid,text,uuid) TO service_role;
"""
