-- Preserve optical observations; separately audit reviewer overrides.
alter table public.nafes_scan_sheets add column effective_snapshot jsonb;
alter table public.nafes_scan_sheets add column answer_version integer not null default 0;
create table public.nafes_scan_answer_edits (
 id uuid primary key, sheet_id uuid not null references public.nafes_scan_sheets(id),
 reviewer_id uuid not null references public.nafes_teacher_access(id),
 question integer not null check(question between 1 and 60),
 before_answer jsonb not null, after_answer jsonb not null,
 answer_version integer not null, created_at timestamptz not null default now(),
 unique(sheet_id,answer_version)
);
create index nafes_scan_answer_edits_sheet_idx on public.nafes_scan_answer_edits(sheet_id,created_at);
alter table public.nafes_scan_answer_edits enable row level security;
revoke all on public.nafes_scan_answer_edits from public,anon,authenticated,service_role;
grant select,insert on public.nafes_scan_answer_edits to service_role;

create function public.nafes_scan_edit_answer(p_session uuid,p_sheet uuid,p_reviewer uuid,p_question integer,p_marked integer[],p_version integer,p_request uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
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
end $$;
revoke all on function public.nafes_scan_edit_answer(uuid,uuid,uuid,integer,integer[],integer,uuid) from public,anon,authenticated;
grant execute on function public.nafes_scan_edit_answer(uuid,uuid,uuid,integer,integer[],integer,uuid) to service_role;

-- Verification checks the revised answer states, while the original snapshot stays immutable.
create or replace function public.nafes_scan_verify(p_session uuid,p_sheet uuid,p_reviewer uuid,p_ack boolean)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
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
 then 'requires_rescan' else 'verified' end;
 update public.nafes_scan_sheets set reviewed_at=now(),reviewed_by=p_reviewer,disposition=d where id=r.id returning * into r;
 update public.nafes_scan_alerts set acknowledged_at=coalesce(acknowledged_at,now()),acknowledged_by=coalesce(acknowledged_by,p_reviewer) where sheet_id=r.id;
 return to_jsonb(r)-'image_data';
end $$;

create function public.nafes_scan_verify_current(p_session uuid,p_sheet uuid,p_reviewer uuid,p_ack boolean,p_version integer)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v integer;
begin
 perform 1 from public.nafes_scan_sessions where id=p_session for update;
 select answer_version into v from public.nafes_scan_sheets where id=p_sheet and session_id=p_session for update;
 if not found then raise exception 'ورقة غير موجودة';end if;
 if p_version is distinct from v then raise exception 'تغيرت الإجابات لدى مراجع آخر؛ أعد فتح الورقة للتحقق من أحدث نسخة';end if;
 return public.nafes_scan_verify(p_session,p_sheet,p_reviewer,p_ack);
end $$;
revoke all on function public.nafes_scan_verify_current(uuid,uuid,uuid,boolean,integer) from public,anon,authenticated;
grant execute on function public.nafes_scan_verify_current(uuid,uuid,uuid,boolean,integer) to service_role;
