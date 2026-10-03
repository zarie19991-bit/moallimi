-- Teacher management dashboard/report snapshots for Tamakkun.
-- Read-only aggregation. The Edge Function validates the caller and invokes these as service_role.

create or replace function public.lugati_teacher_management_snapshot(
  p_requester uuid,
  p_scope text default 'all'
) returns jsonb
language sql
security definer
set search_path = public
as $$
with allowed as (
  select id,label,subject_scope
  from public.nafes_teacher_access
  where active=true
    and (coalesce(p_scope,'all')='all' or id=p_requester)
),
task_base as (
  select
    t.id,t.teacher_access_id,a.label as teacher_label,a.subject_scope,
    t.student_id,s.full_name as student_name,s.class_name,
    t.subject_key,t.tier,t.status,t.title,t.indicator_text,
    t.score,t.total,t.percent,t.assigned_at,t.started_at,t.completed_at,t.updated_at,
    coalesce(t.completed_at,t.started_at,t.assigned_at,t.updated_at) as event_at
  from public.lugati_teacher_tasks t
  join allowed a on a.id=t.teacher_access_id
  left join public.nafes_students s on s.id=t.student_id
  where t.revoked_at is null
),
teacher_stats as (
  select
    a.id,a.label,a.subject_scope,
    count(t.id)::int as task_total,
    count(t.id) filter (where t.status='completed')::int as completed,
    count(t.id) filter (where t.status='in_progress')::int as in_progress,
    count(t.id) filter (where t.status='assigned')::int as assigned,
    count(distinct t.student_id)::int as students_assigned,
    count(distinct t.student_id) filter (where t.status='completed')::int as students_completed,
    round((100.0*count(t.id) filter (where t.status='completed')/nullif(count(t.id),0))::numeric,1) as completion_rate,
    max(coalesce(t.completed_at,t.started_at,t.assigned_at,t.updated_at)) as last_activity
  from allowed a
  left join public.lugati_teacher_tasks t on t.teacher_access_id=a.id and t.revoked_at is null
  group by a.id,a.label,a.subject_scope
),
totals as (
  select
    count(*)::int as task_total,
    count(*) filter (where status='completed')::int as completed,
    count(*) filter (where status='in_progress')::int as in_progress,
    count(*) filter (where status='assigned')::int as assigned,
    count(distinct student_id)::int as students,
    round((100.0*count(*) filter (where status='completed')/nullif(count(*),0))::numeric,1) as completion_rate
  from task_base
),
recent as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_at desc),'[]'::jsonb) as rows
  from (
    select id as task_id,teacher_access_id,teacher_label,subject_scope,student_id,student_name,class_name,
           subject_key,tier,status,title,indicator_text,score,total,percent,assigned_at,started_at,completed_at,event_at
    from task_base
    order by event_at desc nulls last
    limit 100
  ) x
)
select jsonb_build_object(
  'teachers',coalesce((select jsonb_agg(to_jsonb(ts) order by ts.subject_scope,ts.label) from teacher_stats ts),'[]'::jsonb),
  'totals',coalesce((select to_jsonb(t) from totals t),'{}'::jsonb),
  'recent_activity',(select rows from recent),
  'access_mode',case when coalesce(p_scope,'all')='all' then 'all' else 'self' end,
  'generated_at',now()
);
$$;

create or replace function public.lugati_teacher_management_report(
  p_requester uuid,
  p_scope text default 'all',
  p_teacher_ids uuid[] default null,
  p_status text default null,
  p_subject text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_student_id uuid default null,
  p_limit integer default 500
) returns jsonb
language sql
security definer
set search_path = public
as $$
with allowed as (
  select id,label,subject_scope
  from public.nafes_teacher_access
  where active=true
    and (coalesce(p_scope,'all')='all' or id=p_requester)
),
task_base as (
  select
    t.id as task_id,t.teacher_access_id,a.label as teacher_label,a.subject_scope,
    t.student_id,s.full_name as student_name,s.class_name,
    t.subject_key,t.tier,t.status,t.title,t.indicator_text,
    t.score,t.total,t.percent,t.assigned_at,t.started_at,t.completed_at,t.updated_at,
    coalesce(t.completed_at,t.started_at,t.assigned_at,t.updated_at) as event_at
  from public.lugati_teacher_tasks t
  join allowed a on a.id=t.teacher_access_id
  left join public.nafes_students s on s.id=t.student_id
  where t.revoked_at is null
    and (p_teacher_ids is null or cardinality(p_teacher_ids)=0 or t.teacher_access_id=any(p_teacher_ids))
    and (nullif(p_status,'') is null or p_status='all' or t.status=p_status)
    and (nullif(p_subject,'') is null or p_subject='all' or t.subject_key=p_subject)
    and (p_from is null or coalesce(t.completed_at,t.started_at,t.assigned_at,t.updated_at)>=p_from)
    and (p_to is null or coalesce(t.completed_at,t.started_at,t.assigned_at,t.updated_at)<(p_to + interval '1 day'))
    and (p_student_id is null or t.student_id=p_student_id)
),
summary as (
  select
    count(*)::int as task_total,
    count(*) filter (where status='completed')::int as completed,
    count(*) filter (where status='in_progress')::int as in_progress,
    count(*) filter (where status='assigned')::int as assigned,
    count(distinct student_id)::int as students,
    round((100.0*count(*) filter (where status='completed')/nullif(count(*),0))::numeric,1) as completion_rate
  from task_base
),
rows as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.event_at desc),'[]'::jsonb) as data
  from (
    select * from task_base
    order by event_at desc nulls last
    limit greatest(1,least(coalesce(p_limit,500),1000))
  ) x
)
select jsonb_build_object(
  'summary',coalesce((select to_jsonb(s) from summary s),'{}'::jsonb),
  'rows',(select data from rows),
  'generated_at',now()
);
$$;

revoke all on function public.lugati_teacher_management_snapshot(uuid,text) from public, anon, authenticated;
revoke all on function public.lugati_teacher_management_report(uuid,text,uuid[],text,text,timestamptz,timestamptz,uuid,integer) from public, anon, authenticated;
grant execute on function public.lugati_teacher_management_snapshot(uuid,text) to service_role;
grant execute on function public.lugati_teacher_management_report(uuid,text,uuid[],text,text,timestamptz,timestamptz,uuid,integer) to service_role;
