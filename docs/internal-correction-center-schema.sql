-- Schema deployed to project udznpifopbnrcgxtpzza
create table if not exists public.maintenance_agent_corrections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  mode text not null check (mode in ('arabic','instruction','javascript','css','sql','html')),
  source_label text not null default '',
  original_text text not null,
  corrected_text text not null,
  issues jsonb not null default '[]'::jsonb,
  auto_fix_count integer not null default 0 check (auto_fix_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  status text not null default 'analyzed' check (status in ('analyzed','applied','dismissed')),
  contains_personal_data boolean not null default false check (contains_personal_data = false),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists maintenance_agent_corrections_owner_idx
  on public.maintenance_agent_corrections(owner_id, created_at desc);
alter table public.maintenance_agent_corrections enable row level security;
revoke all on table public.maintenance_agent_corrections from anon, authenticated;
grant select, insert, update, delete on table public.maintenance_agent_corrections to service_role;
