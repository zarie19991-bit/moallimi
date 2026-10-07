-- Batch OMR: durable metadata for up to 200 source pages / 400 detected sheets.
alter table public.nafes_scan_sessions
  add column if not exists expected_page_count integer,
  add column if not exists source_file_count integer,
  add column if not exists batch_manifest jsonb not null default '[]'::jsonb;

alter table public.nafes_scan_sessions
  drop constraint if exists nafes_scan_sessions_expected_count_check,
  add constraint nafes_scan_sessions_expected_count_check
    check (expected_count between 1 and 400),
  add constraint nafes_scan_sessions_expected_page_count_check
    check (expected_page_count is null or expected_page_count between 1 and 200),
  add constraint nafes_scan_sessions_source_file_count_check
    check (source_file_count is null or source_file_count between 1 and 200),
  add constraint nafes_scan_sessions_batch_manifest_check
    check (jsonb_typeof(batch_manifest) = 'array');

alter table public.nafes_scan_sheets
  drop constraint if exists nafes_scan_sheets_ordinal_check,
  add constraint nafes_scan_sheets_ordinal_check
    check (ordinal between 1 and 400);

-- Verification uses the effective (possibly manually reviewed) answers, while
-- low-quality optical input is never silently accepted. Legacy scans that do
-- not have quality_score remain governed by the previous identity/marker rules.
create or replace function public.nafes_scan_verify(
  p_session uuid,
  p_sheet uuid,
  p_reviewer uuid,
  p_ack boolean
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  s public.nafes_scan_sessions;
  r public.nafes_scan_sheets;
  d text;
  effective jsonb;
begin
  select * into s from public.nafes_scan_sessions where id=p_session for update;
  if not found then raise exception 'جلسة غير موجودة'; end if;

  select * into r from public.nafes_scan_sheets where id=p_sheet and session_id=s.id for update;
  if not found then raise exception 'ورقة غير موجودة'; end if;
  if r.reviewed_at is not null then return to_jsonb(r)-'image_data'; end if;
  if s.completed_at is not null then raise exception 'الجلسة مغلقة'; end if;

  if (select count(*) from public.nafes_scan_sheets where session_id=s.id)<>s.expected_count then
    raise exception 'انتظر اكتمال رفع جميع الأوراق';
  end if;

  if exists(
    select 1 from public.nafes_scan_sheets
    where session_id=s.id and ordinal<r.ordinal and reviewed_at is null
  ) then
    raise exception 'راجع الورقة السابقة أولًا';
  end if;

  if exists(select 1 from public.nafes_scan_alerts where sheet_id=r.id) and not p_ack then
    raise exception 'يجب تأكيد الاطلاع على تنبيه التكرار';
  end if;

  effective:=coalesce(r.effective_snapshot,r.snapshot);

  d:=case
    when r.blocked_duplicate then 'duplicate'
    when coalesce((r.snapshot->>'identity_valid')::boolean,false)=false
      or coalesce((r.snapshot->>'markers_ok')::boolean,false)=false
      or exists(
        select 1 from jsonb_array_elements(effective->'answers') a
        where a->>'state'='uncertain'
      )
      or (
        effective ? 'quality_score'
        and nullif(effective->>'quality_score','') is not null
        and (effective->>'quality_score')::numeric < 50
      )
    then 'requires_rescan'
    else 'verified'
  end;

  update public.nafes_scan_sheets
  set reviewed_at=now(),reviewed_by=p_reviewer,disposition=d
  where id=r.id
  returning * into r;

  update public.nafes_scan_alerts
  set acknowledged_at=coalesce(acknowledged_at,now()),
      acknowledged_by=coalesce(acknowledged_by,p_reviewer)
  where sheet_id=r.id;

  return to_jsonb(r)-'image_data';
end
$$;

revoke all on function public.nafes_scan_verify(uuid,uuid,uuid,boolean)
from public,anon,authenticated;
grant execute on function public.nafes_scan_verify(uuid,uuid,uuid,boolean)
to service_role;
