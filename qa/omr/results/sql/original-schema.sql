CREATE TABLE public."nafes_scan_sheets" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),"session_id" uuid NOT NULL,"review_pk" uuid NOT NULL,"ordinal" integer NOT NULL,"student_id" uuid,"sheet_no" integer,"image_hash" text NOT NULL,"image_data" text NOT NULL,"snapshot" jsonb NOT NULL,"duplicate_of" uuid,"blocked_duplicate" boolean NOT NULL DEFAULT false,"duplicate_legacy_at" timestamp with time zone,"uploaded_at" timestamp with time zone NOT NULL DEFAULT now(),"reviewed_at" timestamp with time zone,"reviewed_by" uuid,"disposition" text,"effective_snapshot" jsonb,"answer_version" integer NOT NULL DEFAULT 0);
CREATE TABLE public."nafes_scan_sessions" ("id" uuid NOT NULL,"review_pk" uuid NOT NULL,"reviewer_id" uuid NOT NULL,"file_hash" text NOT NULL,"review_snapshot" jsonb NOT NULL,"expected_count" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"completed_at" timestamp with time zone,"expected_page_count" integer,"source_file_count" integer,"batch_manifest" jsonb NOT NULL DEFAULT '[]'::jsonb);
CREATE TABLE public."nafes_scan_answer_edits" ("id" uuid NOT NULL,"sheet_id" uuid NOT NULL,"reviewer_id" uuid NOT NULL,"question" integer NOT NULL,"before_answer" jsonb NOT NULL,"after_answer" jsonb NOT NULL,"answer_version" integer NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."nafes_scan_identity_edits" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),"sheet_id" uuid NOT NULL,"session_id" uuid NOT NULL,"review_pk" uuid NOT NULL,"reviewer_id" uuid NOT NULL,"student_id" uuid NOT NULL,"sheet_no" integer NOT NULL,"student_name" text NOT NULL,"model" text NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now());
CREATE TABLE public."nafes_scan_alerts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),"sheet_id" uuid NOT NULL,"original_sheet_id" uuid,"original_uploaded_at" timestamp with time zone,"review_pk" uuid NOT NULL,"kind" text NOT NULL,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"acknowledged_at" timestamp with time zone,"acknowledged_by" uuid);
CREATE TABLE public."nafes_paper_reviews" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),"owner_id" uuid NOT NULL,"review_id" text NOT NULL,"title" text NOT NULL DEFAULT 'مراجعة ورقية'::text,"subject" text NOT NULL,"class_name" text NOT NULL DEFAULT ''::text,"payload" jsonb NOT NULL DEFAULT '{}'::jsonb,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"updated_at" timestamp with time zone NOT NULL DEFAULT now(),"subjects" text[] NOT NULL DEFAULT '{}'::text[]);
CREATE TABLE public."nafes_teacher_access" ("id" uuid NOT NULL DEFAULT gen_random_uuid(),"key_hash" text NOT NULL,"label" text NOT NULL DEFAULT 'معلم المنصة'::text,"active" boolean NOT NULL DEFAULT true,"created_at" timestamp with time zone NOT NULL DEFAULT now(),"subject_scope" text NOT NULL DEFAULT 'all'::text);
ALTER TABLE public."nafes_scan_sheets" ADD CONSTRAINT "nafes_scan_sheets_disposition_check" CHECK (disposition = ANY (ARRAY['verified'::text, 'duplicate'::text, 'requires_rescan'::text]));
ALTER TABLE public."nafes_scan_sheets" ADD CONSTRAINT "nafes_scan_sheets_ordinal_check" CHECK (ordinal >= 1 AND ordinal <= 400);
ALTER TABLE public."nafes_scan_sheets" ADD CONSTRAINT "nafes_scan_sheets_pkey" PRIMARY KEY (id);
ALTER TABLE public."nafes_scan_sheets" ADD CONSTRAINT "nafes_scan_sheets_session_id_ordinal_key" UNIQUE (session_id, ordinal);
CREATE INDEX nafes_scan_sheets_identity_idx ON public.nafes_scan_sheets USING btree (review_pk, student_id, uploaded_at);
CREATE INDEX nafes_scan_sheets_image_idx ON public.nafes_scan_sheets USING btree (review_pk, image_hash);
ALTER TABLE public."nafes_scan_sheets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nafes_scan_sessions" ADD CONSTRAINT "nafes_scan_sessions_batch_manifest_check" CHECK (jsonb_typeof(batch_manifest) = 'array'::text);
ALTER TABLE public."nafes_scan_sessions" ADD CONSTRAINT "nafes_scan_sessions_expected_count_check" CHECK (expected_count >= 1 AND expected_count <= 400);
ALTER TABLE public."nafes_scan_sessions" ADD CONSTRAINT "nafes_scan_sessions_expected_page_count_check" CHECK (expected_page_count IS NULL OR expected_page_count >= 1 AND expected_page_count <= 200);
ALTER TABLE public."nafes_scan_sessions" ADD CONSTRAINT "nafes_scan_sessions_id_review_pk_key" UNIQUE (id, review_pk);
ALTER TABLE public."nafes_scan_sessions" ADD CONSTRAINT "nafes_scan_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."nafes_scan_sessions" ADD CONSTRAINT "nafes_scan_sessions_source_file_count_check" CHECK (source_file_count IS NULL OR source_file_count >= 1 AND source_file_count <= 200);
CREATE INDEX nafes_scan_sessions_review_idx ON public.nafes_scan_sessions USING btree (review_pk, created_at DESC);
ALTER TABLE public."nafes_scan_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nafes_scan_answer_edits" ADD CONSTRAINT "nafes_scan_answer_edits_pkey" PRIMARY KEY (id);
ALTER TABLE public."nafes_scan_answer_edits" ADD CONSTRAINT "nafes_scan_answer_edits_question_check" CHECK (question >= 1 AND question <= 60);
ALTER TABLE public."nafes_scan_answer_edits" ADD CONSTRAINT "nafes_scan_answer_edits_sheet_id_answer_version_key" UNIQUE (sheet_id, answer_version);
CREATE INDEX nafes_scan_answer_edits_sheet_idx ON public.nafes_scan_answer_edits USING btree (sheet_id, created_at);
ALTER TABLE public."nafes_scan_answer_edits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nafes_scan_identity_edits" ADD CONSTRAINT "nafes_scan_identity_edits_pkey" PRIMARY KEY (id);
CREATE INDEX nafes_scan_identity_edits_sheet_idx ON public.nafes_scan_identity_edits USING btree (sheet_id, created_at DESC);
CREATE INDEX nafes_scan_identity_edits_reviewer_idx ON public.nafes_scan_identity_edits USING btree (reviewer_id);
ALTER TABLE public."nafes_scan_identity_edits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nafes_scan_alerts" ADD CONSTRAINT "nafes_scan_alerts_kind_check" CHECK (kind = ANY (ARRAY['same_student'::text, 'same_image'::text]));
ALTER TABLE public."nafes_scan_alerts" ADD CONSTRAINT "nafes_scan_alerts_pkey" PRIMARY KEY (id);
ALTER TABLE public."nafes_scan_alerts" ADD CONSTRAINT "nafes_scan_alerts_sheet_id_key" UNIQUE (sheet_id);
CREATE INDEX nafes_scan_alerts_review_idx ON public.nafes_scan_alerts USING btree (review_pk, created_at DESC);
ALTER TABLE public."nafes_scan_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nafes_paper_reviews" ADD CONSTRAINT "nafes_paper_reviews_owner_id_review_id_key" UNIQUE (owner_id, review_id);
ALTER TABLE public."nafes_paper_reviews" ADD CONSTRAINT "nafes_paper_reviews_pkey" PRIMARY KEY (id);
ALTER TABLE public."nafes_paper_reviews" ADD CONSTRAINT "nafes_paper_reviews_subject_check" CHECK (subject = ANY (ARRAY['reading'::text, 'math'::text, 'science'::text]));
ALTER TABLE public."nafes_paper_reviews" ADD CONSTRAINT "nafes_paper_reviews_subjects_check" CHECK (cardinality(subjects) >= 1 AND cardinality(subjects) <= 3 AND subjects <@ ARRAY['reading'::text, 'math'::text, 'science'::text]);
CREATE INDEX nafes_paper_reviews_owner_updated_idx ON public.nafes_paper_reviews USING btree (owner_id, updated_at DESC);
ALTER TABLE public."nafes_paper_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nafes_teacher_access" ADD CONSTRAINT "nafes_teacher_access_pkey" PRIMARY KEY (id);
ALTER TABLE public."nafes_teacher_access" ADD CONSTRAINT "nafes_teacher_access_key_hash_key" UNIQUE (key_hash);
ALTER TABLE public."nafes_teacher_access" ADD CONSTRAINT "nafes_teacher_access_key_hash_check" CHECK (key_hash ~ '^[a-f0-9]{64}$'::text);
ALTER TABLE public."nafes_teacher_access" ADD CONSTRAINT "nafes_teacher_access_subject_scope_check" CHECK (subject_scope = ANY (ARRAY['all'::text, 'reading'::text, 'math'::text, 'science'::text]));
ALTER TABLE public."nafes_teacher_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."nafes_scan_sheets" ADD CONSTRAINT "nafes_scan_sheets_duplicate_of_fkey" FOREIGN KEY (duplicate_of) REFERENCES nafes_scan_sheets(id);
ALTER TABLE public."nafes_scan_sheets" ADD CONSTRAINT "nafes_scan_sheets_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES nafes_teacher_access(id);
ALTER TABLE public."nafes_scan_sheets" ADD CONSTRAINT "nafes_scan_sheets_session_id_review_pk_fkey" FOREIGN KEY (session_id, review_pk) REFERENCES nafes_scan_sessions(id, review_pk);
ALTER TABLE public."nafes_scan_sessions" ADD CONSTRAINT "nafes_scan_sessions_review_pk_fkey" FOREIGN KEY (review_pk) REFERENCES nafes_paper_reviews(id);
ALTER TABLE public."nafes_scan_sessions" ADD CONSTRAINT "nafes_scan_sessions_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES nafes_teacher_access(id);
ALTER TABLE public."nafes_scan_answer_edits" ADD CONSTRAINT "nafes_scan_answer_edits_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES nafes_teacher_access(id);
ALTER TABLE public."nafes_scan_answer_edits" ADD CONSTRAINT "nafes_scan_answer_edits_sheet_id_fkey" FOREIGN KEY (sheet_id) REFERENCES nafes_scan_sheets(id);
ALTER TABLE public."nafes_scan_identity_edits" ADD CONSTRAINT "nafes_scan_identity_edits_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES nafes_teacher_access(id);
ALTER TABLE public."nafes_scan_identity_edits" ADD CONSTRAINT "nafes_scan_identity_edits_sheet_id_fkey" FOREIGN KEY (sheet_id) REFERENCES nafes_scan_sheets(id) ON DELETE CASCADE;
ALTER TABLE public."nafes_scan_alerts" ADD CONSTRAINT "nafes_scan_alerts_acknowledged_by_fkey" FOREIGN KEY (acknowledged_by) REFERENCES nafes_teacher_access(id);
ALTER TABLE public."nafes_scan_alerts" ADD CONSTRAINT "nafes_scan_alerts_original_sheet_id_fkey" FOREIGN KEY (original_sheet_id) REFERENCES nafes_scan_sheets(id);
ALTER TABLE public."nafes_scan_alerts" ADD CONSTRAINT "nafes_scan_alerts_review_pk_fkey" FOREIGN KEY (review_pk) REFERENCES nafes_paper_reviews(id);
ALTER TABLE public."nafes_scan_alerts" ADD CONSTRAINT "nafes_scan_alerts_sheet_id_fkey" FOREIGN KEY (sheet_id) REFERENCES nafes_scan_sheets(id);
ALTER TABLE public."nafes_paper_reviews" ADD CONSTRAINT "nafes_paper_reviews_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES nafes_teacher_access(id) ON DELETE CASCADE;
CREATE POLICY "deny_direct_access" ON public.nafes_teacher_access FOR ALL TO "anon","authenticated" USING (false) WITH CHECK (false);
REVOKE ALL ON public.nafes_teacher_access FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.nafes_teacher_access TO service_role;
CREATE OR REPLACE FUNCTION public.nafes_scan_assign_identity(p_session uuid, p_sheet uuid, p_reviewer uuid, p_student uuid, p_sheet_no integer, p_student_name text, p_model text, p_effective jsonb, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.nafes_scan_sessions;
  r public.nafes_scan_sheets;
begin
  select * into s from public.nafes_scan_sessions where id=p_session for update;
  if not found then raise exception 'جلسة المراجعة غير موجودة'; end if;
  if s.completed_at is not null then raise exception 'الجلسة منتهية؛ لا يمكن تغيير هوية الورقة بعد إنهاء المراجعة'; end if;

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

  insert into public.nafes_scan_identity_edits(
    sheet_id,session_id,review_pk,reviewer_id,student_id,sheet_no,student_name,model
  ) values(
    r.id,r.session_id,r.review_pk,p_reviewer,p_student,p_sheet_no,trim(p_student_name),trim(p_model)
  );

  return to_jsonb(r)-'image_data';
end $function$
;
CREATE OR REPLACE FUNCTION public.nafes_scan_edit_answer(p_session uuid, p_sheet uuid, p_reviewer uuid, p_question integer, p_marked integer[], p_version integer, p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.nafes_scan_sessions; r public.nafes_scan_sheets; prior public.nafes_scan_answer_edits;
 current_snapshot jsonb; before_q jsonb; after_q jsonb; marked integer[]; state text; answer_status text; correct_idx integer;
begin
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة غير موجودة'; end if;
 select * into r from public.nafes_scan_sheets where id=p_sheet and session_id=s.id for update;
 if not found then raise exception 'ورقة غير موجودة'; end if;
 if p_marked is null or cardinality(p_marked)>4 or array_position(p_marked,null) is not null
 or exists(select 1 from unnest(p_marked) m where m<0 or m>3) then raise exception 'اختيارات غير صالحة';end if;
 select coalesce(array_agg(distinct m order by m),'{}'::integer[]) into marked from unnest(p_marked) m;
 select * into prior from public.nafes_scan_answer_edits where id=p_request;
 if found then
   if prior.sheet_id<>r.id or prior.reviewer_id<>p_reviewer or prior.question<>p_question or prior.after_answer->'marked'<>to_jsonb(marked) then raise exception 'تعارض طلب التعديل';end if;
   return to_jsonb(r)-'image_data';
 end if;
 if s.completed_at is not null then raise exception 'انتهت المراجعة؛ لا يمكن تعديل إجابات الجلسة المعتمدة';end if;
 if p_version is distinct from r.answer_version then raise exception 'تغيرت الورقة لدى مراجع آخر؛ أعد فتحها قبل التعديل';end if;
 if (select count(*) from public.nafes_scan_sheets where session_id=s.id)<>s.expected_count then raise exception 'انتظر اكتمال رفع جميع الأوراق';end if;
 if exists(select 1 from public.nafes_scan_sheets where session_id=s.id and ordinal<r.ordinal and reviewed_at is null) then raise exception 'راجع الورقة السابقة أولًا';end if;
 current_snapshot:=coalesce(r.effective_snapshot,r.snapshot);
 if p_question is null or p_question<1 or p_question>jsonb_array_length(current_snapshot->'answers') then raise exception 'رقم سؤال غير صالح';end if;
 before_q:=current_snapshot->'answers'->(p_question-1);
 correct_idx:=(r.snapshot->'answers'->(p_question-1)->>'correct_index')::integer;
 answer_status:=case when cardinality(marked)=0 then 'blank' when cardinality(marked)>1 then 'multiple' else 'clear' end;
 state:=case when cardinality(marked)=0 then 'blank' when cardinality(marked)>1 then 'multiple'
 when correct_idx is null then 'uncertain' when marked[1]=correct_idx then 'correct' else 'incorrect' end;
 after_q:=before_q||jsonb_build_object('selected',case when cardinality(marked)=1 then marked[1] else null end,
 'marked',to_jsonb(marked),'status',answer_status,'state',state,'correct',state='correct','reviewed_manually',true);
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
CREATE OR REPLACE FUNCTION public.nafes_scan_finish(p_session uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.nafes_scan_sessions;
begin
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة غير موجودة'; end if;
 if (select count(*) from public.nafes_scan_sheets where session_id=s.id)<>s.expected_count
 or exists(select 1 from public.nafes_scan_sheets where session_id=s.id and reviewed_at is null) then raise exception 'يجب مراجعة جميع الأوراق أولًا'; end if;
 update public.nafes_scan_sessions set completed_at=coalesce(completed_at,now()) where id=s.id returning * into s;
 return to_jsonb(s);
end $function$
;
CREATE OR REPLACE FUNCTION public.nafes_scan_register(p_session uuid, p_sheet jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.nafes_scan_sessions; r public.nafes_scan_sheets; prior public.nafes_scan_sheets; blocked boolean:=false; legacy_at timestamptz;
begin
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة غير موجودة'; end if;
 -- Serialize duplicate checks across sessions, not just within one file.
 perform 1 from public.nafes_paper_reviews where id=s.review_pk for update;
 select * into r from public.nafes_scan_sheets where session_id=s.id and ordinal=(p_sheet->>'ordinal')::integer;
 if found then
   if r.image_hash<>p_sheet->>'image_hash' then raise exception 'تعارض إعادة إرسال الورقة'; end if;
   return to_jsonb(r)-'image_data';
 end if;
 if s.completed_at is not null then raise exception 'الجلسة مغلقة'; end if;
 if (p_sheet->>'ordinal')::integer>s.expected_count then raise exception 'عدد الأوراق غير مطابق'; end if;
 select * into prior from public.nafes_scan_sheets
 where review_pk=s.review_pk and ((student_id is not null and student_id=nullif(p_sheet->>'student_id','')::uuid) or image_hash=p_sheet->>'image_hash')
 order by uploaded_at,id limit 1;
 if prior.id is not null then
   blocked:=exists(select 1 from public.nafes_scan_sheets x where x.review_pk=s.review_pk
      and ((x.student_id is not null and x.student_id=nullif(p_sheet->>'student_id','')::uuid) or x.image_hash=p_sheet->>'image_hash')
      and not x.blocked_duplicate and coalesce(x.disposition,'pending')<>'requires_rescan');
 end if;
 legacy_at:=nullif(p_sheet->>'legacy_at','')::timestamptz;
 if legacy_at is not null then blocked:=true; end if;
 insert into public.nafes_scan_sheets(session_id,review_pk,ordinal,student_id,sheet_no,image_hash,image_data,snapshot,duplicate_of,blocked_duplicate,duplicate_legacy_at)
 values(s.id,s.review_pk,(p_sheet->>'ordinal')::integer,nullif(p_sheet->>'student_id','')::uuid,(p_sheet->>'sheet_no')::integer,
 p_sheet->>'image_hash',p_sheet->>'image_data',p_sheet->'snapshot',prior.id,blocked,legacy_at) returning * into r;
 if prior.id is not null or legacy_at is not null then
 insert into public.nafes_scan_alerts(sheet_id,original_sheet_id,original_uploaded_at,review_pk,kind)
 values(r.id,prior.id,coalesce(prior.uploaded_at,legacy_at),s.review_pk,case when prior.image_hash=r.image_hash then 'same_image' else 'same_student' end);
 end if;
 return to_jsonb(r)-'image_data';
end $function$
;
CREATE OR REPLACE FUNCTION public.nafes_scan_verify(p_session uuid, p_sheet uuid, p_reviewer uuid, p_ack boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.nafes_scan_sessions; r public.nafes_scan_sheets; d text; effective jsonb;
begin
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة غير موجودة'; end if;
 select * into r from public.nafes_scan_sheets where id=p_sheet and session_id=s.id for update;
 if not found then raise exception 'ورقة غير موجودة'; end if;
 if r.reviewed_at is not null then return to_jsonb(r)-'image_data'; end if;
 if s.completed_at is not null then raise exception 'الجلسة مغلقة'; end if;
 if (select count(*) from public.nafes_scan_sheets where session_id=s.id)<>s.expected_count then raise exception 'انتظر اكتمال رفع جميع الأوراق'; end if;
 if exists(select 1 from public.nafes_scan_sheets where session_id=s.id and ordinal<r.ordinal and reviewed_at is null) then raise exception 'راجع الورقة السابقة أولًا'; end if;
 if exists(select 1 from public.nafes_scan_alerts where sheet_id=r.id) and not p_ack then raise exception 'يجب تأكيد الاطلاع على تنبيه التكرار'; end if;
 effective:=coalesce(r.effective_snapshot,r.snapshot);
 d:=case when r.blocked_duplicate then 'duplicate'
 when coalesce((r.snapshot->>'identity_valid')::boolean,false)=false
   or coalesce((r.snapshot->>'markers_ok')::boolean,false)=false
   or exists(select 1 from jsonb_array_elements(effective->'answers') a where a->>'state'='uncertain')
   or (effective ? 'quality_score' and nullif(effective->>'quality_score','') is not null and (effective->>'quality_score')::numeric < 35)
 then 'requires_rescan' else 'verified' end;
 update public.nafes_scan_sheets set reviewed_at=now(),reviewed_by=p_reviewer,disposition=d where id=r.id returning * into r;
 update public.nafes_scan_alerts set acknowledged_at=coalesce(acknowledged_at,now()),acknowledged_by=coalesce(acknowledged_by,p_reviewer) where sheet_id=r.id;
 return to_jsonb(r)-'image_data';
end $function$
;
CREATE OR REPLACE FUNCTION public.nafes_scan_verify_current(p_session uuid, p_sheet uuid, p_reviewer uuid, p_ack boolean, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v integer;
begin
 perform 1 from public.nafes_scan_sessions where id=p_session for update;
 select answer_version into v from public.nafes_scan_sheets where id=p_sheet and session_id=p_session for update;
 if not found then raise exception 'ورقة غير موجودة';end if;
 if p_version is distinct from v then raise exception 'تغيرت الإجابات لدى مراجع آخر؛ أعد فتح الورقة للتحقق من أحدث نسخة';end if;
 return public.nafes_scan_verify(p_session,p_sheet,p_reviewer,p_ack);
end $function$
;