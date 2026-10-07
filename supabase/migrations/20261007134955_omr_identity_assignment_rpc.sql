create or replace function public.nafes_scan_assign_identity(
  p_session uuid,p_sheet uuid,p_reviewer uuid,p_student uuid,p_sheet_no integer,
  p_student_name text,p_model text,p_effective jsonb,p_version integer
) returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare s public.nafes_scan_sessions; r public.nafes_scan_sheets;
begin
  select * into s from public.nafes_scan_sessions where id=p_session for update;
  if not found then raise exception 'جلسة المراجعة غير موجودة'; end if;
  if s.completed_at is not null then raise exception 'الجلسة منتهية؛ لا يمكن تغيير هوية الورقة بعد إنهاء المراجعة'; end if;

  select * into r from public.nafes_scan_sheets where id=p_sheet and session_id=p_session for update;
  if not found then raise exception 'ورقة غير موجودة'; end if;
  if r.answer_version is distinct from p_version then raise exception 'تغيرت الورقة لدى مراجع آخر؛ أعد فتحها قبل تعيين الطالب'; end if;
  if p_student_name is null or length(trim(p_student_name))<2 then raise exception 'اسم الطالب غير صالح'; end if;
  if p_model is null or length(trim(p_model))<1 then raise exception 'النموذج غير صالح'; end if;

  if exists(
    select 1 from public.nafes_scan_sheets x
    where x.review_pk=s.review_pk and x.id<>r.id and x.student_id=p_student
      and not x.blocked_duplicate and coalesce(x.disposition,'pending')<>'requires_rescan'
  ) then raise exception 'هذا الطالب مرتبط بورقة أخرى في الاختبار؛ راجع تنبيه التكرار أولًا'; end if;

  update public.nafes_scan_sheets
  set student_id=p_student,sheet_no=p_sheet_no,effective_snapshot=p_effective,
      answer_version=answer_version+1,reviewed_at=null,reviewed_by=null,disposition=null
  where id=r.id returning * into r;

  insert into public.nafes_scan_identity_edits(sheet_id,session_id,review_pk,reviewer_id,student_id,sheet_no,student_name,model)
  values(r.id,r.session_id,r.review_pk,p_reviewer,p_student,p_sheet_no,trim(p_student_name),trim(p_model));

  return to_jsonb(r)-'image_data';
end $$;

revoke all on function public.nafes_scan_assign_identity(uuid,uuid,uuid,uuid,integer,text,text,jsonb,integer)
from public,anon,authenticated;
grant execute on function public.nafes_scan_assign_identity(uuid,uuid,uuid,uuid,integer,text,text,jsonb,integer)
to service_role;

create index if not exists nafes_scan_deletions_reviewer_idx on public.nafes_scan_deletions(reviewer_id);
create index if not exists nafes_scan_identity_edits_reviewer_idx on public.nafes_scan_identity_edits(reviewer_id);
