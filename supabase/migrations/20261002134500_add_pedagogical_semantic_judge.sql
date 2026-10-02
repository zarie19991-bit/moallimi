-- Pedagogical semantic judge for indicator questions.
-- Stores only educational content and review metadata; no student roster, attempts, secrets, or PII.

create table if not exists public.maintenance_agent_semantic_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  scope text not null check (scope in ('active_tests','indicator_bank')),
  subject text check (subject is null or subject in ('reading','math','science')),
  status text not null default 'queued' check (status in ('queued','running','completed','partial','provider_required','failed')),
  provider text not null default 'rules',
  model text,
  review_version text not null default 'pedagogical-semantic-v1',
  total_candidates integer not null default 0 check (total_candidates >= 0),
  reviewed_count integer not null default 0 check (reviewed_count >= 0),
  pass_count integer not null default 0 check (pass_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  reject_count integer not null default 0 check (reject_count >= 0),
  current_offset integer not null default 0 check (current_offset >= 0),
  summary text not null default '',
  error text,
  contains_personal_data boolean not null default false check (contains_personal_data = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.maintenance_agent_semantic_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.maintenance_agent_semantic_jobs(id) on delete cascade,
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  source_type text not null check (source_type in ('active_test','indicator_bank')),
  source_id text not null,
  assessment_id uuid references public.nafes_assessments(id) on delete cascade,
  subject text not null check (subject in ('reading','math','science')),
  indicator_key text not null default '',
  indicator_text text not null default '',
  registered_level text,
  detected_level text,
  question_text text not null default '',
  options jsonb not null default '[]'::jsonb,
  correct_index integer,
  judgment text not null check (judgment in ('pass','review','reject')),
  confidence numeric(4,3) not null default 0.5 check (confidence >= 0 and confidence <= 1),
  dimensions jsonb not null default '{}'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  suggested_question text,
  provider text not null default 'rules',
  model text,
  review_version text not null default 'pedagogical-semantic-v1',
  contains_personal_data boolean not null default false check (contains_personal_data = false),
  created_at timestamptz not null default now()
);

create index if not exists maintenance_agent_semantic_jobs_owner_idx
  on public.maintenance_agent_semantic_jobs(owner_id, created_at desc);

create index if not exists maintenance_agent_semantic_reviews_job_idx
  on public.maintenance_agent_semantic_reviews(job_id, judgment, subject, indicator_key);

create index if not exists maintenance_agent_semantic_reviews_source_idx
  on public.maintenance_agent_semantic_reviews(source_type, source_id, created_at desc);

alter table public.maintenance_agent_semantic_jobs enable row level security;
alter table public.maintenance_agent_semantic_reviews enable row level security;

revoke all on table public.maintenance_agent_semantic_jobs from anon, authenticated;
revoke all on table public.maintenance_agent_semantic_reviews from anon, authenticated;

grant select, insert, update, delete on table public.maintenance_agent_semantic_jobs to service_role;
grant select, insert, update, delete on table public.maintenance_agent_semantic_reviews to service_role;
