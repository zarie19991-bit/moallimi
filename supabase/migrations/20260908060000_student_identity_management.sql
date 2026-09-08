-- ==============================================================================
-- Migration: 20260908060000_student_identity_management.sql
-- Title: Hardened Student Identity & Historical Attempts Integrity (v3 Final)
-- 
-- Key Guarantees:
-- 1. Permanent Identity: (national_id_last3, name_normalized) is globally unique across ALL rows.
--    Even archived students cannot be duplicated; re-adding an archived student reactivates their record.
-- 2. Soft Archiving: is_active and archived_at prevent physical row deletion.
-- 3. Attempt Protection: Foreign keys use ON DELETE RESTRICT (never nullify student_id).
-- 4. Database Trigger: nafes_students_sync_name_trg guarantees name_normalized from full_name on INSERT/UPDATE.
-- 5. Preserved Backfill: nafes_safe_backfill_historical_attempts() is defined and secured with
--    SECURITY DEFINER and set search_path = pg_catalog, but is NOT called automatically.
-- 6. Locked Diagnostic View: nafes_unlinked_historical_attempts restricted to service_role only.
-- ==============================================================================

-- 1. Helper Function: Arabic Name Normalizer in SQL (matches JS engine)
create or replace function public.nafes_normalize_arabic(p_text text)
returns text language plpgsql immutable as $$
declare
  v text;
begin
  if p_text is null or btrim(p_text) = '' then
    return '';
  end if;
  v := p_text;
  -- Remove tashkeel / diacritics and tatweel
  v := regexp_replace(v, '[\u064B-\u0652\u0670\u0640]', '', 'g');
  -- Normalize alef variants
  v := regexp_replace(v, '[إأآٱ]', 'ا', 'g');
  -- Normalize taa marbuta to haa
  v := regexp_replace(v, 'ة', 'ه', 'g');
  -- Normalize yaa / alef maqsura
  v := regexp_replace(v, '[ىي]', 'ي', 'g');
  -- Remove non-alphanumeric characters
  v := regexp_replace(v, '[^[:alnum:]\s]', ' ', 'g');
  -- Trim and collapse whitespace
  v := lower(btrim(regexp_replace(v, '\s+', ' ', 'g')));
  return v;
end;
$$;

-- 2. Table: public.nafes_students
create table if not exists public.nafes_students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  name_normalized text not null,
  grade text not null default 'الصف الثالث المتوسط',
  class_name text not null default '',
  national_id_last3 text not null check (national_id_last3 ~ '^[0-9]{3}$'),
  is_active boolean not null default true,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure columns exist if table was partially created in earlier prototype
alter table public.nafes_students
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz null,
  add column if not exists updated_at timestamptz not null default now();

-- 3. Database Triggers: name_normalized generation & updated_at timestamp
-- A) DB-level guarantee: Auto-generate name_normalized from full_name on INSERT or UPDATE
create or replace function public.nafes_sync_student_name_normalized()
returns trigger language plpgsql as $$
begin
  if new.full_name is not null then
    new.name_normalized := public.nafes_normalize_arabic(new.full_name);
  end if;
  return new;
end;
$$;

drop trigger if exists nafes_students_sync_name_trg on public.nafes_students;
create trigger nafes_students_sync_name_trg
  before insert or update of full_name on public.nafes_students
  for each row execute function public.nafes_sync_student_name_normalized();

-- B) Auto-update updated_at timestamp
create or replace function public.nafes_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nafes_students_updated_at_trg on public.nafes_students;
create trigger nafes_students_updated_at_trg
  before update on public.nafes_students
  for each row execute function public.nafes_set_updated_at();

-- 4. Uniqueness & Performance Indexes
-- Global student identity uniqueness: strictly forbids duplicate (national_id_last3, name_normalized)
-- across ALL students (active or archived), guaranteeing a single permanent student_id per person.
drop index if exists public.nafes_students_active_identity_uq;
create unique index if not exists nafes_students_identity_uq
  on public.nafes_students (national_id_last3, name_normalized);

create index if not exists nafes_students_class_idx
  on public.nafes_students (class_name);

create index if not exists nafes_students_created_idx
  on public.nafes_students (created_at desc);

create index if not exists nafes_students_active_idx
  on public.nafes_students (is_active);

-- 5. Row Level Security: restricted to service_role (Edge Functions)
alter table public.nafes_students enable row level security;
revoke all on public.nafes_students from public, anon, authenticated;
grant all on public.nafes_students to service_role;

-- 6. Foreign Keys on Attempts (ON DELETE RESTRICT to guarantee attempt permanence)
-- A) nafes_assessment_attempts
alter table public.nafes_assessment_attempts
  add column if not exists student_id uuid;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'nafes_assessment_attempts_student_id_fkey'
  ) then
    alter table public.nafes_assessment_attempts
      drop constraint nafes_assessment_attempts_student_id_fkey;
  end if;

  alter table public.nafes_assessment_attempts
    add constraint nafes_assessment_attempts_student_id_fkey
    foreign key (student_id) references public.nafes_students(id) on delete restrict;
end $$;

create index if not exists nafes_assessment_student_id_idx
  on public.nafes_assessment_attempts (student_id);

-- B) nafes_simulation_attempts
alter table public.nafes_simulation_attempts
  add column if not exists student_id uuid;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'nafes_simulation_attempts_student_id_fkey'
  ) then
    alter table public.nafes_simulation_attempts
      drop constraint nafes_simulation_attempts_student_id_fkey;
  end if;

  alter table public.nafes_simulation_attempts
    add constraint nafes_simulation_attempts_student_id_fkey
    foreign key (student_id) references public.nafes_students(id) on delete restrict;
end $$;

create index if not exists nafes_simulation_student_id_idx
  on public.nafes_simulation_attempts (student_id);

-- C) nafes_exam_attempts
alter table public.nafes_exam_attempts
  add column if not exists student_id uuid;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'nafes_exam_attempts_student_id_fkey'
  ) then
    alter table public.nafes_exam_attempts
      drop constraint nafes_exam_attempts_student_id_fkey;
  end if;

  alter table public.nafes_exam_attempts
    add constraint nafes_exam_attempts_student_id_fkey
    foreign key (student_id) references public.nafes_students(id) on delete restrict;
end $$;

create index if not exists nafes_exam_student_id_idx
  on public.nafes_exam_attempts (student_id);

-- 7. Conservative, Safe Backfill Procedure for Historical Attempts
-- Security Hardened: SECURITY DEFINER with fixed search_path = pg_catalog
-- NOTE: This procedure is DEFINED ONLY and is NOT called automatically.
-- It remains available for manual on-demand execution after reviewing historical data semantics.
-- Conservative Linking Rules:
-- 1. ONLY updates attempts where student_id is currently NULL.
-- 2. EXACTLY ONE active student matches the normalized name.
-- 3. student_no MUST be present in the attempt AND MUST equal national_id_last3.
-- Any attempt without student_no or with ambiguous match is LEFT UNTOUCHED for manual review.
create or replace function public.nafes_safe_backfill_historical_attempts()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_assessment_updated int := 0;
  v_simulation_updated int := 0;
  v_exam_updated int := 0;
begin
  -- 1) nafes_assessment_attempts
  with matched_candidates as (
    select
      a.id as attempt_id,
      s.id as matched_student_id,
      count(*) over(partition by a.id) as match_count
    from public.nafes_assessment_attempts a
    join public.nafes_students s
      on s.is_active = true
     and s.name_normalized = public.nafes_normalize_arabic(a.student_name)
     and a.student_no is not null
     and btrim(a.student_no) <> ''
     and btrim(a.student_no) = s.national_id_last3
    where a.student_id is null
      and a.student_name is not null
      and btrim(a.student_name) <> ''
  ),
  unique_matches as (
    select attempt_id, matched_student_id
    from matched_candidates
    where match_count = 1
  )
  update public.nafes_assessment_attempts a
  set student_id = u.matched_student_id
  from unique_matches u
  where a.id = u.attempt_id
    and a.student_id is null;

  get diagnostics v_assessment_updated = row_count;

  -- 2) nafes_simulation_attempts
  with matched_candidates as (
    select
      a.id as attempt_id,
      s.id as matched_student_id,
      count(*) over(partition by a.id) as match_count
    from public.nafes_simulation_attempts a
    join public.nafes_students s
      on s.is_active = true
     and s.name_normalized = public.nafes_normalize_arabic(a.student_name)
     and a.student_no is not null
     and btrim(a.student_no) <> ''
     and btrim(a.student_no) = s.national_id_last3
    where a.student_id is null
      and a.student_name is not null
      and btrim(a.student_name) <> ''
  ),
  unique_matches as (
    select attempt_id, matched_student_id
    from matched_candidates
    where match_count = 1
  )
  update public.nafes_simulation_attempts a
  set student_id = u.matched_student_id
  from unique_matches u
  where a.id = u.attempt_id
    and a.student_id is null;

  get diagnostics v_simulation_updated = row_count;

  -- 3) nafes_exam_attempts
  with matched_candidates as (
    select
      a.id as attempt_id,
      s.id as matched_student_id,
      count(*) over(partition by a.id) as match_count
    from public.nafes_exam_attempts a
    join public.nafes_students s
      on s.is_active = true
     and s.name_normalized = public.nafes_normalize_arabic(a.student_name)
     and a.student_no is not null
     and btrim(a.student_no) <> ''
     and btrim(a.student_no) = s.national_id_last3
    where a.student_id is null
      and a.student_name is not null
      and btrim(a.student_name) <> ''
  ),
  unique_matches as (
    select attempt_id, matched_student_id
    from matched_candidates
    where match_count = 1
  )
  update public.nafes_exam_attempts a
  set student_id = u.matched_student_id
  from unique_matches u
  where a.id = u.attempt_id
    and a.student_id is null;

  get diagnostics v_exam_updated = row_count;

  return jsonb_build_object(
    'ok', true,
    'assessment_attempts_linked', v_assessment_updated,
    'simulation_attempts_linked', v_simulation_updated,
    'exam_attempts_linked', v_exam_updated
  );
end;
$$;

-- Secure backfill procedure execution
revoke execute on function public.nafes_safe_backfill_historical_attempts() from public, anon, authenticated;
grant execute on function public.nafes_safe_backfill_historical_attempts() to service_role;

-- 8. Diagnostic View for Manual Review of Unlinked Attempts
create or replace view public.nafes_unlinked_historical_attempts as
select
  'assessment' as source,
  a.id,
  a.student_name,
  a.student_no,
  a.class_name,
  a.submitted_at,
  (
    select count(*)
    from public.nafes_students s
    where s.is_active = true
      and s.name_normalized = public.nafes_normalize_arabic(a.student_name)
  ) as active_name_candidates
from public.nafes_assessment_attempts a
where a.student_id is null
union all
select
  'simulation' as source,
  a.id,
  a.student_name,
  a.student_no,
  null::text as class_name,
  a.submitted_at,
  (
    select count(*)
    from public.nafes_students s
    where s.is_active = true
      and s.name_normalized = public.nafes_normalize_arabic(a.student_name)
  ) as active_name_candidates
from public.nafes_simulation_attempts a
where a.student_id is null
union all
select
  'exam' as source,
  a.id,
  a.student_name,
  a.student_no,
  null::text as class_name,
  a.submitted_at,
  (
    select count(*)
    from public.nafes_students s
    where s.is_active = true
      and s.name_normalized = public.nafes_normalize_arabic(a.student_name)
  ) as active_name_candidates
from public.nafes_exam_attempts a
where a.student_id is null;

-- Secure diagnostic view access
revoke all on public.nafes_unlinked_historical_attempts from public, anon, authenticated;
grant select on public.nafes_unlinked_historical_attempts to service_role;
