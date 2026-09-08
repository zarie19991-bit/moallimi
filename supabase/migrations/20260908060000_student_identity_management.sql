-- Student Identity & Management for NAFES assessments.
-- Additive schema: preserves all existing question banks, tests, and historical attempts.

create table if not exists public.nafes_students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  name_normalized text not null,
  grade text not null default 'الصف الثالث المتوسط',
  class_name text not null default '',
  national_id_last3 text not null check (national_id_last3 ~ '^[0-9]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fast lookup indexes for student authentication and teacher filters
create index if not exists nafes_students_lookup_idx on public.nafes_students (national_id_last3, name_normalized);
create index if not exists nafes_students_class_idx on public.nafes_students (class_name);
create index if not exists nafes_students_created_idx on public.nafes_students (created_at desc);

-- Row level security: access is strictly via the service role (Edge Function)
alter table public.nafes_students enable row level security;
revoke all on public.nafes_students from public, anon, authenticated;
grant all on public.nafes_students to service_role;

-- Add permanent student_id reference to all three attempt tables (with on delete set null to protect historical attempts)
alter table public.nafes_assessment_attempts
  add column if not exists student_id uuid references public.nafes_students(id) on delete set null;

alter table public.nafes_simulation_attempts
  add column if not exists student_id uuid references public.nafes_students(id) on delete set null;

alter table public.nafes_exam_attempts
  add column if not exists student_id uuid references public.nafes_students(id) on delete set null;

create index if not exists nafes_assessment_student_id_idx on public.nafes_assessment_attempts (student_id);
create index if not exists nafes_simulation_student_id_idx on public.nafes_simulation_attempts (student_id);
create index if not exists nafes_exam_student_id_idx on public.nafes_exam_attempts (student_id);
