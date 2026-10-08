-- DEVELOPMENT ONLY. Original metadata plus measured SQL fixes; NOT DEPLOYED.
-- Apply once to an isolated copy of the original schema, never automatically to production.

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
