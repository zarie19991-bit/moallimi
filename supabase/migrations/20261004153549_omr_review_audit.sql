-- Private review journal. All access goes through the existing authenticated teacher API.
create table public.nafes_scan_sessions (
 id uuid primary key, review_pk uuid not null references public.nafes_paper_reviews(id),
 reviewer_id uuid not null references public.nafes_teacher_access(id), file_hash text not null,
 review_snapshot jsonb not null,
 expected_count integer not null check(expected_count between 1 and 300),
 created_at timestamptz not null default now(), completed_at timestamptz,
 unique(id,review_pk)
);
create index nafes_scan_sessions_review_idx on public.nafes_scan_sessions(review_pk,created_at desc);
create table public.nafes_scan_sheets (
 id uuid primary key default gen_random_uuid(), session_id uuid not null,
 review_pk uuid not null, ordinal integer not null check(ordinal between 1 and 300),
 student_id uuid, sheet_no integer, image_hash text not null, image_data text not null,
 snapshot jsonb not null, duplicate_of uuid references public.nafes_scan_sheets(id),
 blocked_duplicate boolean not null default false, duplicate_legacy_at timestamptz,
 uploaded_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewed_by uuid references public.nafes_teacher_access(id),
 disposition text check(disposition in ('verified','duplicate','requires_rescan')),
 foreign key(session_id,review_pk) references public.nafes_scan_sessions(id,review_pk),
 unique(session_id,ordinal)
);
create index nafes_scan_sheets_identity_idx on public.nafes_scan_sheets(review_pk,student_id,uploaded_at);
create index nafes_scan_sheets_image_idx on public.nafes_scan_sheets(review_pk,image_hash);
create table public.nafes_scan_alerts (
 id uuid primary key default gen_random_uuid(), sheet_id uuid not null unique references public.nafes_scan_sheets(id),
 original_sheet_id uuid references public.nafes_scan_sheets(id), original_uploaded_at timestamptz,
 review_pk uuid not null references public.nafes_paper_reviews(id),
 kind text not null check(kind in ('same_student','same_image')),
 created_at timestamptz not null default now(), acknowledged_at timestamptz,
 acknowledged_by uuid references public.nafes_teacher_access(id)
);
create index nafes_scan_alerts_review_idx on public.nafes_scan_alerts(review_pk,created_at desc);
alter table public.nafes_scan_sessions enable row level security;
alter table public.nafes_scan_sheets enable row level security;
alter table public.nafes_scan_alerts enable row level security;
revoke all on public.nafes_scan_sessions,public.nafes_scan_sheets,public.nafes_scan_alerts from public,anon,authenticated,service_role;
grant select,insert,update on public.nafes_scan_sessions,public.nafes_scan_sheets,public.nafes_scan_alerts to service_role;

create function public.nafes_scan_register(p_session uuid,p_sheet jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
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
end $$;

create function public.nafes_scan_verify(p_session uuid,p_sheet uuid,p_reviewer uuid,p_ack boolean)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.nafes_scan_sessions; r public.nafes_scan_sheets; d text;
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
 d:=case when r.blocked_duplicate then 'duplicate'
 when coalesce((r.snapshot->>'identity_valid')::boolean,false)=false
   or coalesce((r.snapshot->>'markers_ok')::boolean,false)=false
   or exists(select 1 from jsonb_array_elements(r.snapshot->'answers') a where a->>'state'='uncertain')
 then 'requires_rescan' else 'verified' end;
 update public.nafes_scan_sheets set reviewed_at=now(),reviewed_by=p_reviewer,disposition=d where id=r.id returning * into r;
 update public.nafes_scan_alerts set acknowledged_at=coalesce(acknowledged_at,now()),acknowledged_by=coalesce(acknowledged_by,p_reviewer) where sheet_id=r.id;
 return to_jsonb(r)-'image_data';
end $$;
create function public.nafes_scan_finish(p_session uuid)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.nafes_scan_sessions;
begin
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة غير موجودة'; end if;
 if (select count(*) from public.nafes_scan_sheets where session_id=s.id)<>s.expected_count
 or exists(select 1 from public.nafes_scan_sheets where session_id=s.id and reviewed_at is null) then raise exception 'يجب مراجعة جميع الأوراق أولًا'; end if;
 update public.nafes_scan_sessions set completed_at=coalesce(completed_at,now()) where id=s.id returning * into s;
 return to_jsonb(s);
end $$;
revoke all on function public.nafes_scan_register(uuid,jsonb),public.nafes_scan_verify(uuid,uuid,uuid,boolean),public.nafes_scan_finish(uuid) from public,anon,authenticated;
grant execute on function public.nafes_scan_register(uuid,jsonb),public.nafes_scan_verify(uuid,uuid,uuid,boolean),public.nafes_scan_finish(uuid) to service_role;
