create table if not exists public.nafes_paper_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.nafes_teacher_access(id) on delete cascade,
  review_id text not null,
  title text not null default 'مراجعة ورقية',
  subject text not null check (subject in ('reading','math','science')),
  class_name text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, review_id)
);

create index if not exists nafes_paper_reviews_owner_updated_idx
  on public.nafes_paper_reviews(owner_id, updated_at desc);

alter table public.nafes_paper_reviews enable row level security;
