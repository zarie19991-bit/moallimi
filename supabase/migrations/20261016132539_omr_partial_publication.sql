-- Validate only publishable papers, without closing the session or changing pending evidence.
CREATE OR REPLACE FUNCTION public.nafes_scan_validate_publishable(p_session uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public','pg_temp'
AS $function$
declare s public.nafes_scan_sessions; r public.nafes_scan_sheets; effective jsonb;
 a jsonb; m jsonb; n integer; chosen integer; key_index integer; distinct_marks integer;
begin
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة غير موجودة'; end if;
 if not exists(select 1 from public.nafes_scan_sheets where session_id=s.id and disposition='verified' and not blocked_duplicate) then
 raise exception 'راجع ورقة سليمة واحدة على الأقل قبل اعتماد الدرجات'; end if;
 for r in select * from public.nafes_scan_sheets where session_id=s.id and disposition='verified' and not blocked_duplicate order by ordinal for update loop
 if r.reviewed_at is null or r.reviewed_by is null then raise exception 'قرار مراجعة الورقة غير محفوظ'; end if;
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
 end loop;
end $function$;
REVOKE ALL ON FUNCTION public.nafes_scan_validate_publishable(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nafes_scan_validate_publishable(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.nafes_scan_publish_attempts(p_session uuid, p_owner uuid, p_assessment jsonb, p_attempts jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.nafes_scan_sessions; review public.nafes_paper_reviews;
 piece jsonb; r public.nafes_scan_sheets; assessment record; existing record; saved record;
 data jsonb; items jsonb:='[]'::jsonb; student record;
begin
 if to_regclass('public.nafes_assessments') is null or to_regclass('public.nafes_students') is null
 or to_regclass('public.nafes_assessment_attempts') is null then
   raise exception 'Original attempt SQL dependency definitions unavailable; no publication made';
 end if;
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'Scan session required'; end if;
 select * into review from public.nafes_paper_reviews where id=s.review_pk for update;
 perform public.nafes_scan_actor_context(p_session,p_owner,false);
 perform public.nafes_scan_validate_publishable(s.id);
 if jsonb_typeof(p_attempts) is distinct from 'array'
 or jsonb_array_length(p_attempts)<>(select count(*) from public.nafes_scan_sheets where session_id=s.id and disposition='verified' and not blocked_duplicate)
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
end $function$

REVOKE ALL ON FUNCTION public.nafes_scan_publish_attempts(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nafes_scan_publish_attempts(uuid,uuid,jsonb,jsonb) TO service_role;
