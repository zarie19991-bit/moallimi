-- 003_course_question_bank.sql
create table if not exists public.course_question_bank (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  point_key text not null,
  question_key text not null unique,
  variant_group text not null,
  cognitive_level text not null check (cognitive_level in ('knowledge','application','reasoning','performance')),
  difficulty text not null default 'متوسط',
  question_type text not null default 'multiple_choice',
  context_text text,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb not null,
  feedback_correct text not null default '',
  feedback_wrong text not null default '',
  remediation_hint text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_course_questions_lesson_point
  on public.course_question_bank(lesson_id, point_key, active);
create index if not exists idx_course_questions_variant
  on public.course_question_bank(lesson_id, point_key, variant_group);
alter table public.course_question_bank enable row level security;
comment on table public.course_question_bank is 'Server-only mastery question bank. correct_answer must never be returned to student clients.';
