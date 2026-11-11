-- 006_microlearning_blocks.sql
-- طبقة محتوى التعلم المصغر لمنصة لغتي الخالدة

create table if not exists public.lesson_micro_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  point_key text not null,
  block_order integer not null,
  block_type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  depth_note text,
  remediation jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, point_key, block_order)
);

alter table public.lesson_micro_blocks enable row level security;

-- الوصول المباشر من المتصفح محجوب. الخدمة الخلفية lugati-course تستخدم service_role.
revoke all on table public.lesson_micro_blocks from anon, authenticated;
grant select, insert, update, delete on table public.lesson_micro_blocks to service_role;

create index if not exists idx_lesson_micro_blocks_lesson_point
  on public.lesson_micro_blocks (lesson_id, point_key, block_order)
  where active = true;
