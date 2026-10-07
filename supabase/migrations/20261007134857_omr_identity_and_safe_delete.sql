-- Audit-safe deletion of OMR corrections and manual identity tracking.
create table if not exists public.nafes_scan_deletions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  review_pk uuid not null,
  session_id uuid not null,
  sheet_id uuid not null,
  student_id uuid,
  sheet_no integer,
  student_name text,
  model text,
  reviewer_id uuid not null references public.nafes_teacher_access(id),
  reason text not null,
  deleted_at timestamptz not null default now(),
  had_published_attempt boolean not null default false,
  snapshot_summary jsonb not null default '{}'::jsonb
);
create index if not exists nafes_scan_deletions_review_idx on public.nafes_scan_deletions(review_pk,deleted_at desc);
create index if not exists nafes_scan_deletions_session_idx on public.nafes_scan_deletions(session_id,deleted_at desc);
alter table public.nafes_scan_deletions enable row level security;
revoke all on public.nafes_scan_deletions from public,anon,authenticated,service_role;
grant select,insert on public.nafes_scan_deletions to service_role;

create table if not exists public.nafes_scan_identity_edits (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.nafes_scan_sheets(id) on delete cascade,
  session_id uuid not null,
  review_pk uuid not null,
  reviewer_id uuid not null references public.nafes_teacher_access(id),
  student_id uuid not null,
  sheet_no integer not null,
  student_name text not null,
  model text not null,
  created_at timestamptz not null default now()
);
create index if not exists nafes_scan_identity_edits_sheet_idx on public.nafes_scan_identity_edits(sheet_id,created_at desc);
alter table public.nafes_scan_identity_edits enable row level security;
revoke all on public.nafes_scan_identity_edits from public,anon,authenticated,service_role;
grant select,insert on public.nafes_scan_identity_edits to service_role;

create or replace function public.nafes_scan_delete_corrections(
 p_session uuid,p_sheet_ids uuid[],p_reviewer uuid,p_reason text,p_batch uuid
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.nafes_scan_sessions; target_count integer; total_count integer; session_deleted boolean:=false;
begin
 if p_sheet_ids is null or cardinality(p_sheet_ids)=0 then raise exception 'لم تحدد أي تصحيحات للحذف'; end if;
 if cardinality(p_sheet_ids)>200 then raise exception 'عدد التصحيحات المحددة أكبر من الحد المسموح'; end if;
 if p_reason is null or length(trim(p_reason))<3 then raise exception 'سبب الحذف مطلوب'; end if;
 select * into s from public.nafes_scan_sessions where id=p_session for update;
 if not found then raise exception 'جلسة المراجعة غير موجودة'; end if;
 select count(*) into target_count from public.nafes_scan_sheets where session_id=p_session and id=any(p_sheet_ids);
 if target_count<>cardinality(p_sheet_ids) then raise exception 'بعض التصحيحات المحددة غير موجودة في هذه الجلسة'; end if;
 select count(*) into total_count from public.nafes_scan_sheets where session_id=p_session;

 insert into public.nafes_scan_deletions(batch_id,review_pk,session_id,sheet_id,student_id,sheet_no,student_name,model,reviewer_id,reason,had_published_attempt,snapshot_summary)
 select p_batch,x.review_pk,x.session_id,x.id,x.student_id,x.sheet_no,
        coalesce(x.effective_snapshot->>'student_name',x.snapshot->>'student_name'),
        coalesce(x.effective_snapshot->>'model',x.snapshot->>'model'),
        p_reviewer,trim(p_reason),
        exists(select 1 from public.nafes_assessment_attempts a,lateral jsonb_array_elements(coalesce(a.events,'[]'::jsonb)) e where e->>'scan_sheet_id'=x.id::text),
        jsonb_build_object('ordinal',x.ordinal,'score',coalesce(x.effective_snapshot->'score',x.snapshot->'score'),'total',coalesce(x.effective_snapshot->'total',x.snapshot->'total'),'disposition',x.disposition,'answer_version',x.answer_version,'uploaded_at',x.uploaded_at)
 from public.nafes_scan_sheets x where x.session_id=p_session and x.id=any(p_sheet_ids);

 delete from public.nafes_assessment_attempts a
 where exists(select 1 from jsonb_array_elements(coalesce(a.events,'[]'::jsonb)) e where e->>'scan_sheet_id'=any(select unnest(p_sheet_ids)::text));
 update public.nafes_scan_sheets set duplicate_of=null where duplicate_of=any(p_sheet_ids);
 delete from public.nafes_scan_alerts where sheet_id=any(p_sheet_ids) or original_sheet_id=any(p_sheet_ids);
 delete from public.nafes_scan_answer_edits where sheet_id=any(p_sheet_ids);
 delete from public.nafes_scan_identity_edits where sheet_id=any(p_sheet_ids);
 delete from public.nafes_scan_sheets where session_id=p_session and id=any(p_sheet_ids);

 if target_count=total_count then
   delete from public.nafes_scan_sessions where id=p_session; session_deleted:=true;
 else
   update public.nafes_scan_sessions set expected_count=greatest(1,expected_count-target_count),completed_at=null where id=p_session;
 end if;
 return jsonb_build_object('deleted_count',target_count,'session_deleted',session_deleted,'batch_id',p_batch);
end $$;
revoke all on function public.nafes_scan_delete_corrections(uuid,uuid[],uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.nafes_scan_delete_corrections(uuid,uuid[],uuid,text,uuid) to service_role;
