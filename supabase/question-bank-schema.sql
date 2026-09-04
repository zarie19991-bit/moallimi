-- Idempotent schema upgrade for the reviewed NAFES question bank.
alter table public.nafes_question_bank
  add column if not exists grade_key text not null default 'middle_3',
  add column if not exists model_no smallint,
  add column if not exists question_no smallint,
  add column if not exists is_active boolean not null default true,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewer_note text,
  add column if not exists measurement_focus text,
  add column if not exists alignment_profile text,
  add column if not exists alignment_verified boolean not null default false,
  add column if not exists alignment_evidence jsonb;

alter table public.nafes_question_bank
  drop constraint if exists nafes_question_bank_difficulty_check;

alter table public.nafes_question_bank
  add constraint nafes_question_bank_difficulty_check
  check (difficulty = any (array[
    'easy'::text,
    'medium'::text,
    'hard'::text,
    'very_hard'::text
  ]));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nafes_question_bank'::regclass
      and conname = 'nafes_question_bank_grade_key_check'
  ) then
    alter table public.nafes_question_bank
      add constraint nafes_question_bank_grade_key_check
      check (grade_key = any (array[
        'middle_1'::text,
        'middle_2'::text,
        'middle_3'::text
      ]));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.nafes_question_bank'::regclass
      and conname = 'nafes_question_bank_assignment_check'
  ) then
    alter table public.nafes_question_bank
      add constraint nafes_question_bank_assignment_check
      check (
        (model_no is null and question_no is null)
        or
        (model_no between 1 and 4 and question_no between 1 and 15)
      );
  end if;
end $$;

alter table public.nafes_exam_settings
  alter column show_answers set default 'immediately';

create unique index if not exists nafes_bank_approved_position_uidx
  on public.nafes_question_bank
    (grade_key, subject_key, outcome_code, indicator_index, model_no, question_no)
  where review_status = 'approved' and is_active and model_no is not null;

create unique index if not exists nafes_bank_approved_content_uidx
  on public.nafes_question_bank
    (
      grade_key,
      subject_key,
      outcome_code,
      indicator_index,
      md5(coalesce(context_text, '') || chr(31) || question_text)
    )
  where review_status = 'approved' and is_active;

create index if not exists nafes_bank_runtime_lookup_idx
  on public.nafes_question_bank
    (grade_key, subject_key, outcome_code, indicator_index, model_no, question_no)
  where review_status = 'approved' and is_active;

comment on column public.nafes_question_bank.model_no is
  'رقم النموذج المعتمد من 1 إلى 4؛ يظل فارغًا أثناء إعداد السؤال.';
comment on column public.nafes_question_bank.question_no is
  'موضع السؤال المعتمد داخل النموذج من 1 إلى 15.';
comment on column public.nafes_question_bank.review_status is
  'لا يصل السؤال للطالب إلا إذا كان approved ومعينًا لنموذج وموضع.';
comment on column public.nafes_question_bank.reviewer_note is
  'ملاحظات التحكيم اللغوي والقياسي قبل الاعتماد.';
comment on column public.nafes_question_bank.measurement_focus is
  'مفتاح قياس حتمي يربط السؤال بالمادة وناتج التعلم ورقم المؤشر.';
comment on column public.nafes_question_bank.alignment_profile is
  'عقد دلالي فريد يجمع مفتاح المؤشر مع ملف المهمة التي يقيسها السؤال.';
comment on column public.nafes_question_bank.alignment_verified is
  'لا تكون صحيحة إلا بعد اجتياز السؤال تدقيق المطابقة الدلالية الآلي.';
comment on column public.nafes_question_bank.alignment_evidence is
  'دليل المطابقة: المهمة الأصلية والإجابة والتفسير ونسخة المدقق.';

do $$
begin
  if to_regprocedure('public.nafes_bank_stats(text,text,integer)') is not null then
    alter function public.nafes_bank_stats(text, text, integer) security invoker;
    revoke all on function public.nafes_bank_stats(text, text, integer)
      from public, anon, authenticated;
    grant execute on function public.nafes_bank_stats(text, text, integer)
      to service_role;
  end if;
end $$;
