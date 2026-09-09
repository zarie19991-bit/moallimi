-- ==============================================================================
-- Migration: 20260909070000_atomic_management_operations.sql
-- Title: Hardened Atomic Transactional Management Operations (Security V3 Final)
-- Applied manually to production on 2026-09-09; do not run db push blindly because migration history is not synchronized.
-- Status: Applied to production directly via SQL on 2026-09-09.
-- 
-- Key Guarantees:
-- 1. Full Transactional Atomicity: All batch test clears execute in a single PL/pgSQL transaction.
-- 2. Strict Ownership Verification: UUID assessments require p_owner_id match before clear/delete.
-- 3. Strict Confirmation Word: Mandatory verification of p_confirm_word before ANY DELETE executes.
--    - Single test clear: 'مسح النتائج'
--    - Bulk tests clear: 'مسح النتائج' or 'حذف' (when clear_all = false)
--    - Platform-wide wipe: 'حذف جميع النتائج' (when clear_all = true)
--    - Hard delete student / Delete published test: 'حذف'
-- 4. Strict Legacy ID Validation: Invalid/corrupted formats abort and ROLLBACK the entire transaction.
--    - exam:<subject>:<outcome>:i<number>:m<number> strictly verified via regex & digits check.
--    - simulation:<key> strictly verified via regex.
-- 5. Multi-Tenancy Architecture & Legacy Tables Documentation:
--    - nafes_assessments & nafes_assessment_attempts are isolated strictly per teacher (owner_id).
--    - In clear_all, only the current teacher's published assessment attempts are cleared.
--    - WARNING: Legacy practice tables (nafes_exam_attempts and nafes_simulation_attempts) were
--      designed for anonymous shared practice links and do NOT have an owner_id column.
--      In clear_all, legacy attempts are cleared globally.
-- 6. Zero-Trust Security: SECURITY DEFINER, explicit safe search_path, service_role execution only.
-- 7. Preservation Guarantee: Never touches question bank or indicators. Test records & QR remain on clear.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Hard Delete Student & All Attempts (Transactional Single Operation)
-- ------------------------------------------------------------------------------
create or replace function public.nafes_teacher_hard_delete_student(
  p_student_id uuid,
  p_confirm_word text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assessment_deleted int := 0;
  v_simulation_deleted int := 0;
  v_exam_deleted int := 0;
  v_student_deleted int := 0;
  v_exists boolean;
begin
  -- 1) Verify confirmation word
  if p_confirm_word is null or trim(p_confirm_word) <> 'حذف' then
    raise exception 'يجب كتابة كلمة «حذف» لتأكيد الحذف النهائي للطالب' using errcode = 'P0001';
  end if;

  -- 2) Check student exists
  select exists(select 1 from public.nafes_students where id = p_student_id) into v_exists;
  if not v_exists then
    raise exception 'الطالب غير موجود' using errcode = 'P0002';
  end if;

  -- 3) Delete attempts from assessment attempts
  with del as (
    delete from public.nafes_assessment_attempts 
    where student_id = p_student_id or student_key = p_student_id::text
    returning id
  ) select count(*) into v_assessment_deleted from del;

  -- 4) Delete attempts from simulation attempts
  with del as (
    delete from public.nafes_simulation_attempts 
    where student_id = p_student_id or student_key = p_student_id::text
    returning id
  ) select count(*) into v_simulation_deleted from del;

  -- 5) Delete attempts from exam attempts
  with del as (
    delete from public.nafes_exam_attempts 
    where student_id = p_student_id or student_key = p_student_id::text
    returning id
  ) select count(*) into v_exam_deleted from del;

  -- 6) Delete student record
  with del as (
    delete from public.nafes_students 
    where id = p_student_id
    returning id
  ) select count(*) into v_student_deleted from del;

  return jsonb_build_object(
    'ok', true,
    'student_id', p_student_id,
    'assessment_attempts_deleted', v_assessment_deleted,
    'simulation_attempts_deleted', v_simulation_deleted,
    'exam_attempts_deleted', v_exam_deleted,
    'total_attempts_deleted', v_assessment_deleted + v_simulation_deleted + v_exam_deleted,
    'student_deleted', (v_student_deleted > 0)
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Clear Single Test Results (Wipes attempts only, preserves test & link & QR)
-- ------------------------------------------------------------------------------
create or replace function public.nafes_teacher_clear_test_results(
  p_test_id text,
  p_confirm_word text default '',
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assessment_deleted int := 0;
  v_simulation_deleted int := 0;
  v_exam_deleted int := 0;
  v_test_uuid uuid;
  v_assessment_exists boolean;
  v_assessment_owned boolean;
  v_parts text[];
  v_subj text;
  v_outcome text;
  v_ind int;
  v_model int;
begin
  -- 1) Verify confirmation word
  if p_confirm_word is null or trim(p_confirm_word) <> 'مسح النتائج' then
    raise exception 'يجب كتابة كلمة «مسح النتائج» لتأكيد مسح نتائج هذا الاختبار' using errcode = 'P0001';
  end if;

  if p_test_id is null or trim(p_test_id) = '' then
    raise exception 'معرّف الاختبار مطلوب' using errcode = 'P0001';
  end if;

  -- Case A: Published Assessment UUID
  if p_test_id ~ '^[a-f0-9-]{36}$' then
    v_test_uuid := p_test_id::uuid;

    -- Require owner_id for published assessments
    if p_owner_id is null then
      raise exception 'معرّف مالك الاختبار مطلوب للتحقق من الصلاحية' using errcode = 'P0001';
    end if;

    -- Verify existence first
    select exists(
      select 1 from public.nafes_assessments where id = v_test_uuid
    ) into v_assessment_exists;

    if not v_assessment_exists then
      raise exception 'الاختبار غير موجود: %', p_test_id using errcode = 'P0002';
    end if;

    -- Verify ownership
    select exists(
      select 1 from public.nafes_assessments where id = v_test_uuid and owner_id = p_owner_id
    ) into v_assessment_owned;

    if not v_assessment_owned then
      raise exception 'غير مصرح لك بمسح نتائج هذا الاختبار لأنه ليس مملوكًا لحسابك: %', p_test_id using errcode = 'P0003';
    end if;

    with del as (
      delete from public.nafes_assessment_attempts
      where assessment_id = v_test_uuid
      returning id
    ) select count(*) into v_assessment_deleted from del;

    return jsonb_build_object(
      'ok', true,
      'test_id', p_test_id,
      'cleared_tests', 1,
      'assessment_attempts_deleted', v_assessment_deleted,
      'simulation_attempts_deleted', 0,
      'exam_attempts_deleted', 0,
      'total_cleared', v_assessment_deleted
    );

  -- Case B: Legacy indicator test: exam:<subject>:<outcome>:i<number>:m<number>
  elsif p_test_id like 'exam:%' then
    -- Verify full valid regex structure
    if not (p_test_id ~ '^exam:(reading|math|science):[a-zA-Z0-9_]+:i[0-9]+:m[0-9]+$') then
      raise exception 'معرّف اختبار المؤشر تالف أو غير صالح البنية: %', p_test_id using errcode = 'P0001';
    end if;

    v_parts := string_to_array(p_test_id, ':');
    if array_length(v_parts, 1) <> 5 then
      raise exception 'معرّف اختبار المؤشر لا يحتوي على الأجزاء الخمسة المطلوبة: %', p_test_id using errcode = 'P0001';
    end if;

    v_subj := v_parts[2];
    v_outcome := v_parts[3];

    -- Verify indicator and model digits before cast
    if not (substring(v_parts[4] from 2) ~ '^[0-9]+$') or not (substring(v_parts[5] from 2) ~ '^[0-9]+$') then
      raise exception 'أرقام المؤشر أو النموذج غير صالحة في معرّف الاختبار: %', p_test_id using errcode = 'P0001';
    end if;

    v_ind := cast(substring(v_parts[4] from 2) as integer);
    v_model := cast(substring(v_parts[5] from 2) as integer);

    with del as (
      delete from public.nafes_exam_attempts
      where subject_key = v_subj
        and outcome_code = v_outcome
        and indicator_index = v_ind
        and model_no = v_model
      returning id
    ) select count(*) into v_exam_deleted from del;

    return jsonb_build_object(
      'ok', true,
      'test_id', p_test_id,
      'cleared_tests', 1,
      'assessment_attempts_deleted', 0,
      'simulation_attempts_deleted', 0,
      'exam_attempts_deleted', v_exam_deleted,
      'total_cleared', v_exam_deleted
    );

  -- Case C: Simulation key: simulation:<key>
  elsif p_test_id like 'simulation:%' then
    if not (p_test_id ~ '^simulation:[a-z0-9_]+$') then
      raise exception 'معرّف اختبار المحاكاة تالف أو غير صالح: %', p_test_id using errcode = 'P0001';
    end if;

    with del as (
      delete from public.nafes_simulation_attempts
      where simulation_key = substring(p_test_id from 12)
      returning id
    ) select count(*) into v_simulation_deleted from del;

    return jsonb_build_object(
      'ok', true,
      'test_id', p_test_id,
      'cleared_tests', 1,
      'assessment_attempts_deleted', 0,
      'simulation_attempts_deleted', v_simulation_deleted,
      'exam_attempts_deleted', 0,
      'total_cleared', v_simulation_deleted
    );

  else
    raise exception 'معرّف الاختبار تالف أو غير صالح: %', p_test_id using errcode = 'P0001';
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Bulk Clear Test Results (Atomic Transaction for Entire Batch)
-- ------------------------------------------------------------------------------
create or replace function public.nafes_teacher_bulk_clear_test_results(
  p_test_ids text[] default null,
  p_clear_all boolean default false,
  p_confirm_word text default '',
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_test_id text;
  v_parts text[];
  v_subj text;
  v_outcome text;
  v_ind int;
  v_model int;
  v_test_uuid uuid;
  v_assessment_exists boolean;
  v_assessment_owned boolean;
  v_assessment_deleted int := 0;
  v_simulation_deleted int := 0;
  v_exam_deleted int := 0;
  v_cur_deleted int := 0;
  v_cleared_tests_count int := 0;
begin
  -- ----------------------------------------------------------------------------
  -- Case 1: Clear ALL results (Platform or Current Teacher)
  -- ----------------------------------------------------------------------------
  if p_clear_all = true then
    -- Verify confirmation word
    if p_confirm_word is null or trim(p_confirm_word) <> 'حذف جميع النتائج' then
      raise exception 'يرجى تأكيد الحذف بكتابة «حذف جميع النتائج»' using errcode = 'P0001';
    end if;

    -- Require owner_id to protect multi-tenant assessment attempts
    if p_owner_id is null then
      raise exception 'معرّف مالك الحساب مطلوب لمسح جميع النتائج' using errcode = 'P0001';
    end if;

    -- A) For published assessments: strictly isolate to tests owned by this teacher
    with del as (
      delete from public.nafes_assessment_attempts
      where assessment_id in (
        select id from public.nafes_assessments where owner_id = p_owner_id
      )
      returning id
    ) select count(*) into v_assessment_deleted from del;

    select count(*) into v_cleared_tests_count 
    from public.nafes_assessments 
    where owner_id = p_owner_id and status = 'published';

    -- B) For legacy simulation and exam attempts:
    -- ARCHITECTURE & SECURITY GUARANTEE: Legacy attempts tables (nafes_simulation_attempts,
    -- nafes_exam_attempts) are shared public practice bank attempts that do NOT possess an owner_id column.
    -- To protect multi-tenant integrity and prevent accidental platform-wide data loss,
    -- regular teacher 'clear_all' NEVER wipes legacy attempts globally.
    -- Legacy attempts can only be cleared by explicitly selecting specific tests (test_ids).
    v_simulation_deleted := 0;
    v_exam_deleted := 0;

    return jsonb_build_object(
      'ok', true,
      'cleared_all', true,
      'cleared_tests', v_cleared_tests_count,
      'assessment_attempts_deleted', v_assessment_deleted,
      'simulation_attempts_deleted', 0,
      'exam_attempts_deleted', 0,
      'total_cleared', v_assessment_deleted
    );
  end if;

  -- ----------------------------------------------------------------------------
  -- Case 2: Clear selected test IDs (Atomic Multi-Test Batch)
  -- ----------------------------------------------------------------------------
  -- 1) Verify confirmation word BEFORE starting any deletions
  if p_confirm_word is null or trim(p_confirm_word) not in ('مسح النتائج', 'حذف') then
    raise exception 'يجب كتابة «مسح النتائج» أو «حذف» لتأكيد مسح نتائج الاختبارات المحددة' using errcode = 'P0001';
  end if;

  if p_test_ids is null or array_length(p_test_ids, 1) is null or array_length(p_test_ids, 1) = 0 then
    raise exception 'لم يتم تحديد أي اختبارات للمسح' using errcode = 'P0001';
  end if;

  if p_owner_id is null then
    raise exception 'معرّف مالك الحساب مطلوب للتحقق من ملكية الاختبارات' using errcode = 'P0001';
  end if;

  -- 2) Process each test ID atomically inside the single transaction
  foreach v_test_id in array p_test_ids loop
    v_test_id := trim(v_test_id);
    v_cur_deleted := 0;

    -- 2.A: Published assessment UUID
    if v_test_id ~ '^[a-f0-9-]{36}$' then
      v_test_uuid := v_test_id::uuid;

      -- Strict existence check
      select exists(
        select 1 from public.nafes_assessments where id = v_test_uuid
      ) into v_assessment_exists;

      if not v_assessment_exists then
        raise exception 'الاختبار غير موجود في المجموعة: %', v_test_id using errcode = 'P0002';
      end if;

      -- Strict ownership check
      select exists(
        select 1 from public.nafes_assessments where id = v_test_uuid and owner_id = p_owner_id
      ) into v_assessment_owned;

      if not v_assessment_owned then
        raise exception 'غير مصرح لك بمسح نتائج هذا الاختبار لأنه ليس مملوكًا لحسابك: %', v_test_id using errcode = 'P0003';
      end if;

      with del as (
        delete from public.nafes_assessment_attempts
        where assessment_id = v_test_uuid
        returning id
      ) select count(*) into v_cur_deleted from del;

      v_assessment_deleted := v_assessment_deleted + v_cur_deleted;
      v_cleared_tests_count := v_cleared_tests_count + 1;

    -- 2.B: Legacy indicator test
    elsif v_test_id like 'exam:%' then
      -- Strict regex format: exam:<subject>:<outcome>:i<digits>:m<digits>
      if not (v_test_id ~ '^exam:(reading|math|science):[a-zA-Z0-9_]+:i[0-9]+:m[0-9]+$') then
        raise exception 'معرّف اختبار المؤشر تالف أو غير صالح البنية: %', v_test_id using errcode = 'P0001';
      end if;

      v_parts := string_to_array(v_test_id, ':');
      if array_length(v_parts, 1) <> 5 then
        raise exception 'معرّف اختبار المؤشر لا يحتوي على الأجزاء الخمسة المطلوبة: %', v_test_id using errcode = 'P0001';
      end if;

      v_subj := v_parts[2];
      v_outcome := v_parts[3];

      -- Strict check that i part and m part contain valid digits before cast
      if not (substring(v_parts[4] from 2) ~ '^[0-9]+$') or not (substring(v_parts[5] from 2) ~ '^[0-9]+$') then
        raise exception 'أرقام المؤشر أو النموذج غير صالحة في معرّف الاختبار: %', v_test_id using errcode = 'P0001';
      end if;

      v_ind := cast(substring(v_parts[4] from 2) as integer);
      v_model := cast(substring(v_parts[5] from 2) as integer);

      with del as (
        delete from public.nafes_exam_attempts
        where subject_key = v_subj
          and outcome_code = v_outcome
          and indicator_index = v_ind
          and model_no = v_model
        returning id
      ) select count(*) into v_cur_deleted from del;

      v_exam_deleted := v_exam_deleted + v_cur_deleted;
      v_cleared_tests_count := v_cleared_tests_count + 1;

    -- 2.C: Simulation key: simulation:<key>
    elsif v_test_id like 'simulation:%' then
      if not (v_test_id ~ '^simulation:[a-z0-9_]+$') then
        raise exception 'معرّف اختبار المحاكاة تالف أو غير صالح: %', v_test_id using errcode = 'P0001';
      end if;

      with del as (
        delete from public.nafes_simulation_attempts
        where simulation_key = substring(v_test_id from 12)
        returning id
      ) select count(*) into v_cur_deleted from del;

      v_simulation_deleted := v_simulation_deleted + v_cur_deleted;
      v_cleared_tests_count := v_cleared_tests_count + 1;

    -- 2.D: Corrupted, malformed, or unrecognized ID:
    -- RAISE EXCEPTION aborts the entire PL/pgSQL function and triggers complete transaction rollback!
    else
      raise exception 'معرّف اختبار غير معروف أو تالف في المجموعة: %', v_test_id using errcode = 'P0001';
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'cleared_all', false,
    'cleared_tests', v_cleared_tests_count,
    'assessment_attempts_deleted', v_assessment_deleted,
    'simulation_attempts_deleted', v_simulation_deleted,
    'exam_attempts_deleted', v_exam_deleted,
    'total_cleared', v_assessment_deleted + v_simulation_deleted + v_exam_deleted
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. Delete Published Assessment Permanently (Ownership Required, Refuses Legacy)
-- ------------------------------------------------------------------------------
create or replace function public.nafes_teacher_delete_published_test(
  p_test_id uuid,
  p_confirm_word text default '',
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempts_deleted int := 0;
  v_test_deleted int := 0;
  v_assessment_exists boolean;
  v_assessment_owned boolean;
begin
  -- 1) Verify confirmation word
  if p_confirm_word is null or trim(p_confirm_word) <> 'حذف' then
    raise exception 'يجب كتابة كلمة «حذف» لتأكيد حذف الاختبار نهائيًا' using errcode = 'P0001';
  end if;

  -- 2) Require owner_id
  if p_owner_id is null then
    raise exception 'معرّف مالك الحساب مطلوب للتحقق من الصلاحية' using errcode = 'P0001';
  end if;

  -- 3) Check existence
  select exists(
    select 1 from public.nafes_assessments where id = p_test_id
  ) into v_assessment_exists;

  if not v_assessment_exists then
    raise exception 'الاختبار غير موجود' using errcode = 'P0002';
  end if;

  -- 4) Check ownership
  select exists(
    select 1 from public.nafes_assessments where id = p_test_id and owner_id = p_owner_id
  ) into v_assessment_owned;

  if not v_assessment_owned then
    raise exception 'غير مصرح لك بحذف هذا الاختبار لأنه ليس مملوكًا لحسابك' using errcode = 'P0003';
  end if;

  -- 5) Delete attempts first
  with del as (
    delete from public.nafes_assessment_attempts
    where assessment_id = p_test_id
    returning id
  ) select count(*) into v_attempts_deleted from del;

  -- 6) Delete assessment definition from nafes_assessments
  with del as (
    delete from public.nafes_assessments
    where id = p_test_id and owner_id = p_owner_id
    returning id
  ) select count(*) into v_test_deleted from del;

  if v_test_deleted = 0 then
    raise exception 'تعذر حذف سجل الاختبار' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ok', true,
    'test_id', p_test_id,
    'attempts_deleted', v_attempts_deleted,
    'test_deleted', true
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Revoke Public & Authenticated Access, Grant Strictly to service_role
-- ------------------------------------------------------------------------------
revoke all on function public.nafes_teacher_hard_delete_student(uuid, text) from public, anon, authenticated;
grant execute on function public.nafes_teacher_hard_delete_student(uuid, text) to service_role;

revoke all on function public.nafes_teacher_clear_test_results(text, text, uuid) from public, anon, authenticated;
grant execute on function public.nafes_teacher_clear_test_results(text, text, uuid) to service_role;

revoke all on function public.nafes_teacher_bulk_clear_test_results(text[], boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.nafes_teacher_bulk_clear_test_results(text[], boolean, text, uuid) to service_role;

revoke all on function public.nafes_teacher_delete_published_test(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.nafes_teacher_delete_published_test(uuid, text, uuid) to service_role;
