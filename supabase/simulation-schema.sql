-- Attempts for multi-section NAFES simulations. Access is only through the Edge Function.
create table if not exists public.nafes_simulation_attempts (
  id uuid primary key default gen_random_uuid(),
  simulation_key text not null check (char_length(simulation_key) between 8 and 64),
  student_name text not null check (char_length(btrim(student_name)) between 2 and 120),
  student_no text not null check (char_length(btrim(student_no)) between 1 and 160),
  student_key text not null,
  config jsonb not null,
  rendered_sections jsonb not null,
  answers jsonb not null default '{}'::jsonb,
  current_section smallint not null default 0,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score integer,
  total integer,
  percent numeric,
  section_scores jsonb,
  created_at timestamptz not null default now()
);

alter table public.nafes_simulation_attempts enable row level security;
revoke all on table public.nafes_simulation_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.nafes_simulation_attempts to service_role;

create index if not exists nafes_simulation_student_idx
  on public.nafes_simulation_attempts (simulation_key, student_key, started_at desc);

create index if not exists nafes_simulation_open_idx
  on public.nafes_simulation_attempts (expires_at)
  where submitted_at is null;

-- Service-role-only loader used by the reviewed-bank publishing workflow.
create or replace function public.replace_nafes_outcome_bank(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subject text;
  v_outcome text;
  v_docs integer;
  v_questions integer;
  v_affected integer;
begin
  if jsonb_typeof(payload) <> 'array' or jsonb_array_length(payload) = 0 then
    raise exception 'payload must be a non-empty array';
  end if;
  v_subject := payload->0->>'subject_key';
  v_outcome := payload->0->>'outcome_code';
  if v_subject not in ('math','science') or coalesce(v_outcome,'') = '' then
    raise exception 'unsupported bank target';
  end if;
  if exists (
    select 1 from jsonb_array_elements(payload) d(doc)
    where d.doc->>'subject_key' <> v_subject
       or d.doc->>'outcome_code' <> v_outcome
       or d.doc->>'grade_key' <> 'middle_3'
       or jsonb_array_length(d.doc->'questions') <> 15
       or (d.doc->>'model_no')::integer not between 1 and 4
  ) then
    raise exception 'inconsistent bank documents';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(payload) d(doc)
    cross join lateral jsonb_array_elements(d.doc->'questions') q(item)
    where coalesce((q.item->>'alignment_verified')::boolean,false) is not true
       or q.item->>'alignment_profile' <> q.item->>'measurement_focus'||':'||(d.doc->>'text_profile')
       or q.item->'alignment_evidence'->>'validator' <> 'semantic-contract-v2'
       or coalesce(q.item->'alignment_evidence'->>'source_task','') = ''
       or coalesce(q.item->'alignment_evidence'->>'source_answer','') = ''
  ) then
    raise exception 'semantic alignment contract failed';
  end if;

  select count(*),coalesce(sum(jsonb_array_length(doc->'questions')),0)
  into v_docs,v_questions
  from jsonb_array_elements(payload) d(doc);
  if v_questions <> v_docs * 15 then raise exception 'incomplete question payload'; end if;

  update public.nafes_question_bank
  set context_text='[staging-'||id::text||']',question_text='[staging-'||id::text||']'
  where grade_key='middle_3' and subject_key=v_subject and outcome_code=v_outcome
    and review_status='approved' and is_active and model_no is not null;

  with docs as (
    select value doc from jsonb_array_elements(payload)
  ), prepared as (
    select d.doc,q.* from docs d cross join lateral jsonb_to_recordset(d.doc->'questions') as q(
      question_no integer,context_text text,question_text text,options jsonb,correct_index integer,
      explanation text,difficulty text,cognitive_level text,measurement_focus text,
      alignment_profile text,alignment_verified boolean,alignment_evidence jsonb
    )
  )
  insert into public.nafes_question_bank(
    grade_key,subject_key,outcome_code,indicator_index,indicator_text,context_text,question_text,
    options,correct_index,explanation,difficulty,cognitive_level,review_status,source_note,
    model_no,question_no,is_active,reviewed_at,reviewer_note,measurement_focus,
    alignment_profile,alignment_verified,alignment_evidence
  )
  select
    p.doc->>'grade_key',p.doc->>'subject_key',p.doc->>'outcome_code',(p.doc->>'indicator_index')::integer,
    p.doc->>'indicator_text',p.context_text,p.question_text,p.options,p.correct_index,p.explanation,
    p.difficulty,p.cognitive_level,'approved','بنك محكّم مع منع التكرار بين النماذج',
    (p.doc->>'model_no')::smallint,p.question_no::smallint,true,now(),
    'اجتاز مطابقة المؤشر، والإجابة الواحدة، وسلامة اللغة، وتوزيع المستويات، ومنع تكرار الجذوع بين النماذج الأربعة.',
    p.measurement_focus,p.alignment_profile,p.alignment_verified,p.alignment_evidence
  from prepared p
  on conflict (grade_key,subject_key,outcome_code,indicator_index,model_no,question_no)
    where review_status='approved' and is_active and model_no is not null
  do update set
    indicator_text=excluded.indicator_text,context_text=excluded.context_text,question_text=excluded.question_text,
    options=excluded.options,correct_index=excluded.correct_index,explanation=excluded.explanation,
    difficulty=excluded.difficulty,cognitive_level=excluded.cognitive_level,source_note=excluded.source_note,
    reviewed_at=excluded.reviewed_at,reviewer_note=excluded.reviewer_note,
    measurement_focus=excluded.measurement_focus,alignment_profile=excluded.alignment_profile,
    alignment_verified=excluded.alignment_verified,alignment_evidence=excluded.alignment_evidence,
    updated_at=now();
  get diagnostics v_affected = row_count;
  return jsonb_build_object('subject',v_subject,'outcome',v_outcome,'documents',v_docs,'questions',v_questions,'affected',v_affected);
end;
$$;

revoke all on function public.replace_nafes_outcome_bank(jsonb) from public, anon, authenticated;
grant execute on function public.replace_nafes_outcome_bank(jsonb) to service_role;
