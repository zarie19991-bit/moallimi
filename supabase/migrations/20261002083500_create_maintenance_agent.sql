-- Safe maintenance agent v1.
-- The browser never reads these tables directly. Access is through the maintenance-agent Edge Function only.

create table if not exists public.maintenance_agent_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  run_type text not null default 'full' check (run_type in ('full','questions','printing','database')),
  status text not null default 'completed' check (status in ('completed','failed')),
  severity text not null default 'ok' check (severity in ('ok','info','warning','critical')),
  summary text not null,
  findings jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  contains_personal_data boolean not null default false check (contains_personal_data = false),
  created_at timestamptz not null default now()
);

create index if not exists maintenance_agent_runs_owner_created_idx
  on public.maintenance_agent_runs(owner_id, created_at desc);

alter table public.maintenance_agent_runs enable row level security;
revoke all on table public.maintenance_agent_runs from anon, authenticated;
grant select, insert, update on table public.maintenance_agent_runs to service_role;

create table if not exists public.maintenance_agent_proposals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.maintenance_agent_runs(id) on delete cascade,
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  area text not null check (area in ('question_quality','printing','database_security','runtime')),
  title text not null,
  risk_level text not null check (risk_level in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','applied')),
  proposal jsonb not null default '{}'::jsonb,
  contains_personal_data boolean not null default false check (contains_personal_data = false),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists maintenance_agent_proposals_owner_created_idx
  on public.maintenance_agent_proposals(owner_id, created_at desc);

alter table public.maintenance_agent_proposals enable row level security;
revoke all on table public.maintenance_agent_proposals from anon, authenticated;
grant select, insert, update on table public.maintenance_agent_proposals to service_role;

create or replace function public.maintenance_agent_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
with
rls as (
  select
    count(*) filter (where not c.relrowsecurity)::int as disabled_count,
    coalesce(jsonb_agg(c.relname order by c.relname) filter (where not c.relrowsecurity),'[]'::jsonb) as disabled_tables
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
),
question_bank as (
  select
    count(*) filter (where is_active and review_status='approved')::int as approved_active,
    count(*) filter (where quality_status not in ('approved','ready'))::int as needs_quality_review,
    count(*) filter (
      where (coalesce(context_text,'')||' '||coalesce(question_text,'')) ~
      '(تطبيق علمي جديد|موقف تقويمي جديد|مراجعة جماعية للحل|أي اختيار يحقق المطلوب دون إهمال المعطيات|المهمة المسجلة في مخطط المراجعة|في تقويم تصميم تقني بهدف توقع نتيجة تغير عامل محدد)'
    )::int as prompt_leaks
  from public.nafes_question_bank
),
curated as (
  select
    count(*)::int as total,
    count(*) filter (where quality_status='approved')::int as approved,
    count(*) filter (
      where (coalesce(context_text,'')||' '||coalesce(question_text,'')) ~
      '(تطبيق علمي جديد|موقف تقويمي جديد|مراجعة جماعية للحل|أي اختيار يحقق المطلوب دون إهمال المعطيات|المهمة المسجلة في مخطط المراجعة|في تقويم تصميم تقني بهدف توقع نتيجة تغير عامل محدد)'
    )::int as prompt_leaks
  from public.nafes_indicator_curated_bank
),
dup_q as (
  select count(*)::int as groups_count
  from (
    select subject_key, indicator_index, public.nafes_content_fingerprint(context_text,question_text) fp
    from public.nafes_question_bank
    where is_active and review_status='approved'
    group by subject_key, indicator_index, public.nafes_content_fingerprint(context_text,question_text)
    having count(*) > 1
  ) d
),
dup_c as (
  select count(*)::int as groups_count
  from (
    select subject_key, indicator_key, public.nafes_content_fingerprint(context_text,question_text) fp
    from public.nafes_indicator_curated_bank
    where quality_status='approved'
    group by subject_key, indicator_key, public.nafes_content_fingerprint(context_text,question_text)
    having count(*) > 1
  ) d
),
paper as (
  select
    (select count(*)::int from public.nafes_paper_reviews) as reviews_count,
    (select count(*)::int from public.nafes_assessment_attempts
      where is_demo=false and coalesce(config->>'paper_review','false')='true') as approved_attempts
)
select jsonb_build_object(
  'generated_at', now(),
  'privacy', jsonb_build_object(
    'contains_student_names', false,
    'contains_student_ids', false,
    'contains_teacher_keys', false
  ),
  'database_security', jsonb_build_object(
    'rls_disabled_public_count', rls.disabled_count,
    'rls_disabled_public_tables', rls.disabled_tables
  ),
  'question_quality', jsonb_build_object(
    'question_bank_approved_active', question_bank.approved_active,
    'question_bank_needs_quality_review', question_bank.needs_quality_review,
    'curated_total', curated.total,
    'curated_approved', curated.approved,
    'prompt_leak_rows', question_bank.prompt_leaks + curated.prompt_leaks,
    'duplicate_groups_question_bank', dup_q.groups_count,
    'duplicate_groups_curated_bank', dup_c.groups_count
  ),
  'paper_review', jsonb_build_object(
    'saved_reviews', paper.reviews_count,
    'approved_attempts', paper.approved_attempts
  )
)
from rls, question_bank, curated, dup_q, dup_c, paper;
$$;

revoke all on function public.maintenance_agent_snapshot() from public, anon, authenticated;
grant execute on function public.maintenance_agent_snapshot() to service_role;
