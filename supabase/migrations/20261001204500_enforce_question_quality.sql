
-- Enforce NAFES question quality without deleting historical attempts.
-- Safe normalization: removes tatweel, fixes difficulty/level mismatches,
-- quarantines structurally weak or templated items, and records a reusable QA gate.

create or replace function public.nafes_content_fingerprint(p_context text, p_question text)
returns text
language sql
immutable
as $$
  select md5(
    regexp_replace(
      lower(replace(coalesce(p_context,'') || chr(31) || coalesce(p_question,''), 'ـ', '')),
      '\s+', ' ', 'g'
    )
  );
$$;

create or replace function public.nafes_question_quality_checks(
  p_subject text,
  p_context text,
  p_question text,
  p_options jsonb,
  p_correct_index integer,
  p_explanation text,
  p_difficulty text,
  p_cognitive_level text,
  p_image jsonb default null
)
returns jsonb
language sql
immutable
as $$
select jsonb_build_object(
  'question_present', nullif(btrim(coalesce(p_question,'')), '') is not null,
  'four_options',
    jsonb_typeof(p_options) = 'array' and jsonb_array_length(p_options) = 4,
  'unique_options',
    case
      when jsonb_typeof(p_options) = 'array' and jsonb_array_length(p_options) = 4 then
        (select count(*) = 4
             and count(distinct btrim(value)) = 4
             and bool_and(btrim(value) <> '')
         from jsonb_array_elements_text(p_options))
      else false
    end,
  'valid_correct_index', p_correct_index between 0 and 3,
  'has_explanation', nullif(btrim(coalesce(p_explanation,'')), '') is not null,
  'valid_cognitive_level', p_cognitive_level in ('knowledge','application','reasoning'),
  'difficulty_matches_level',
    case
      when p_cognitive_level = 'knowledge' then p_difficulty = 'easy'
      when p_cognitive_level = 'application' then p_difficulty = 'medium'
      when p_cognitive_level = 'reasoning' then p_difficulty in ('hard','very_hard')
      else false
    end,
  'no_tatweel',
    position('ـ' in coalesce(p_context,'') || coalesce(p_question,'') ||
      coalesce(p_explanation,'') || coalesce(p_options::text,'')) = 0,
  'not_generic_template',
    coalesce(p_question,'') !~ '(أي إجابة يمكن اعتمادها|طُرحت المهمة|عند استرجاع المفهوم الأساسي|المهمة المسجلة في ملخص القواعد|أي قاعدة أو حقيقة أساسية تساعد مباشرة|في نشاط لتطبيق مهارة|اقترح طالب الإجابة|أي عبارة علمية صحيحة في موضوع)',
  'no_placeholder_distractors',
    case
      when jsonb_typeof(p_options) = 'array' then
        not exists (
          select 1
          from jsonb_array_elements_text(p_options) as x(value)
          where btrim(value) ~ '^(المعنى المضاد لها|تفصيل لا علاقة له|اسم مكان ورد في النص|معنى حرفي لا يناسب السياق|تكرار عنوان النص|نستخدم قاعدة لا ترتبط بمعطيات|نعتمد شكل الخيار دون فحص العلاقة|لا نحتاج إلى مفهوم أو قاعدة قبل الإجابة|الإجابة صحيحة؛ ولا حاجة إلى التحقق|لا يمكن الحكم على الحل مع أن معطيات السؤال مكتملة|لا يمكن الحكم على الإجابة مع اكتمال معطيات السؤال)$'
        )
      else false
    end,
  'reading_context',
    p_subject <> 'reading' or nullif(btrim(coalesce(p_context,'')), '') is not null,
  'image_consistency',
    case
      when coalesce(p_question,'') ~ '(أي رسم(?! سهمي)|الرسم الآتي|الشكل الآتي|المخطط الآتي|الصورة الآتية|أي نقطة في الشكل)'
      then coalesce(nullif(btrim(p_image->>'url'),''),'') <> ''
       and coalesce(nullif(btrim(p_image->>'alt'),''),'') <> ''
      else true
    end
);
$$;

create or replace function public.nafes_question_quality_hard_pass(p_checks jsonb)
returns boolean
language sql
immutable
as $$
select
  coalesce((p_checks->>'question_present')::boolean,false)
  and coalesce((p_checks->>'four_options')::boolean,false)
  and coalesce((p_checks->>'unique_options')::boolean,false)
  and coalesce((p_checks->>'valid_correct_index')::boolean,false)
  and coalesce((p_checks->>'has_explanation')::boolean,false)
  and coalesce((p_checks->>'valid_cognitive_level')::boolean,false)
  and coalesce((p_checks->>'difficulty_matches_level')::boolean,false)
  and coalesce((p_checks->>'no_tatweel')::boolean,false)
  and coalesce((p_checks->>'not_generic_template')::boolean,false)
  and coalesce((p_checks->>'no_placeholder_distractors')::boolean,false)
  and coalesce((p_checks->>'reading_context')::boolean,false)
  and coalesce((p_checks->>'image_consistency')::boolean,false);
$$;

alter table public.nafes_question_bank
  add column if not exists quality_status text not null default 'pending',
  add column if not exists quality_checks jsonb not null default '{}'::jsonb,
  add column if not exists quality_reviewed_at timestamptz;

alter table public.nafes_simulation_question_bank
  add column if not exists quality_status text not null default 'pending',
  add column if not exists quality_checks jsonb not null default '{}'::jsonb,
  add column if not exists quality_reviewed_at timestamptz;

alter table public.nafes_training_question_bank
  add column if not exists quality_status text not null default 'pending',
  add column if not exists quality_checks jsonb not null default '{}'::jsonb,
  add column if not exists quality_reviewed_at timestamptz;

alter table public.nafes_indicator_curated_bank
  add column if not exists quality_status text not null default 'pending',
  add column if not exists quality_checks jsonb not null default '{}'::jsonb,
  add column if not exists quality_reviewed_at timestamptz;

-- Remove tatweel without changing wording or historical IDs.
update public.nafes_question_bank
set context_text = case when context_text is null then null else replace(context_text,'ـ','') end,
    question_text = replace(question_text,'ـ',''),
    explanation = case when explanation is null then null else replace(explanation,'ـ','') end,
    options = (
      select jsonb_agg(to_jsonb(replace(value,'ـ','')) order by ord)
      from jsonb_array_elements_text(options) with ordinality as o(value,ord)
    ),
    difficulty = case cognitive_level
      when 'knowledge' then 'easy'
      when 'application' then 'medium'
      when 'reasoning' then case when difficulty='very_hard' then 'very_hard' else 'hard' end
      else difficulty end;

update public.nafes_simulation_question_bank
set context_text = case when context_text is null then null else replace(context_text,'ـ','') end,
    question_text = replace(question_text,'ـ',''),
    explanation = replace(explanation,'ـ',''),
    options = (
      select jsonb_agg(to_jsonb(replace(value,'ـ','')) order by ord)
      from jsonb_array_elements_text(options) with ordinality as o(value,ord)
    ),
    difficulty = case cognitive_level
      when 'knowledge' then 'easy'
      when 'application' then 'medium'
      when 'reasoning' then 'hard'
      else difficulty end;

update public.nafes_training_question_bank
set context_text = case when context_text is null then null else replace(context_text,'ـ','') end,
    question_text = replace(question_text,'ـ',''),
    explanation = case when explanation is null then null else replace(explanation,'ـ','') end,
    options = (
      select jsonb_agg(to_jsonb(replace(value,'ـ','')) order by ord)
      from jsonb_array_elements_text(options) with ordinality as o(value,ord)
    ),
    difficulty = case cognitive_level
      when 'knowledge' then 'easy'
      when 'application' then 'medium'
      when 'reasoning' then case when difficulty='very_hard' then 'very_hard' else 'hard' end
      else difficulty end;

update public.nafes_indicator_curated_bank
set context_text = case when context_text is null then null else replace(context_text,'ـ','') end,
    question_text = replace(question_text,'ـ',''),
    explanation = case when explanation is null then null else replace(explanation,'ـ','') end,
    options = (
      select jsonb_agg(to_jsonb(replace(value,'ـ','')) order by ord)
      from jsonb_array_elements_text(options) with ordinality as o(value,ord)
    ),
    difficulty = case cognitive_level
      when 'knowledge' then 'easy'
      when 'application' then 'medium'
      when 'reasoning' then case when difficulty='very_hard' then 'very_hard' else 'hard' end
      else difficulty end;

-- Quarantine weak rows in banks where runtime already respects review_status + is_active.
update public.nafes_question_bank q
set review_status='draft', is_active=false
where review_status='approved'
  and not public.nafes_question_quality_hard_pass(
    public.nafes_question_quality_checks(
      q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
      q.explanation,q.difficulty,q.cognitive_level,q.alignment_evidence->'image'
    )
  );

update public.nafes_simulation_question_bank q
set review_status='draft', is_active=false
where review_status='approved'
  and not public.nafes_question_quality_hard_pass(
    public.nafes_question_quality_checks(
      q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
      q.explanation,q.difficulty,q.cognitive_level,null
    )
  );

update public.nafes_training_question_bank q
set review_status='draft', is_active=false
where review_status='approved'
  and not public.nafes_question_quality_hard_pass(
    public.nafes_question_quality_checks(
      q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
      q.explanation,q.difficulty,q.cognitive_level,null
    )
  );

-- Keep one approved copy per exact normalized item inside each bank.
with ranked as (
  select id,
         row_number() over (
           partition by subject_key,outcome_code,indicator_index,
             public.nafes_content_fingerprint(context_text,question_text)
           order by created_at nulls last,id
         ) as rn
  from public.nafes_question_bank
  where review_status='approved' and is_active
)
update public.nafes_question_bank q
set review_status='draft', is_active=false
from ranked r
where q.id=r.id and r.rn>1;

with ranked as (
  select id,
         row_number() over (
           partition by subject_key,outcome_code,indicator_index,
             public.nafes_content_fingerprint(context_text,question_text)
           order by created_at nulls last,id
         ) as rn
  from public.nafes_simulation_question_bank
  where review_status='approved' and is_active
)
update public.nafes_simulation_question_bank q
set review_status='draft', is_active=false
from ranked r
where q.id=r.id and r.rn>1;

-- Backfill reusable quality evidence.
update public.nafes_question_bank q
set quality_checks = public.nafes_question_quality_checks(
      q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
      q.explanation,q.difficulty,q.cognitive_level,q.alignment_evidence->'image'
    ),
    quality_status = case
      when public.nafes_question_quality_hard_pass(public.nafes_question_quality_checks(
        q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
        q.explanation,q.difficulty,q.cognitive_level,q.alignment_evidence->'image'
      )) and q.review_status='approved' and q.is_active then 'approved'
      when public.nafes_question_quality_hard_pass(public.nafes_question_quality_checks(
        q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
        q.explanation,q.difficulty,q.cognitive_level,q.alignment_evidence->'image'
      )) then 'ready'
      else 'needs_review'
    end,
    quality_reviewed_at=now();

update public.nafes_indicator_curated_bank q
set quality_checks = public.nafes_question_quality_checks(
      q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
      q.explanation,q.difficulty,q.cognitive_level,q.image
    ),
    quality_status = case
      when public.nafes_question_quality_hard_pass(public.nafes_question_quality_checks(
        q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
        q.explanation,q.difficulty,q.cognitive_level,q.image
      )) then 'approved'
      else 'needs_review'
    end,
    quality_reviewed_at=now();

update public.nafes_training_question_bank q
set quality_checks = public.nafes_question_quality_checks(
      q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
      q.explanation,q.difficulty,q.cognitive_level,null
    ),
    quality_status = case
      when public.nafes_question_quality_hard_pass(public.nafes_question_quality_checks(
        q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
        q.explanation,q.difficulty,q.cognitive_level,null
      )) and q.review_status='approved' and q.is_active then 'approved'
      when public.nafes_question_quality_hard_pass(public.nafes_question_quality_checks(
        q.subject_key,q.context_text,q.question_text,q.options,q.correct_index,
        q.explanation,q.difficulty,q.cognitive_level,null
      )) then 'ready'
      else 'needs_review'
    end,
    quality_reviewed_at=now();

update public.nafes_simulation_question_bank s
set quality_checks =
      public.nafes_question_quality_checks(
        s.subject_key,s.context_text,s.question_text,s.options,s.correct_index,
        s.explanation,s.difficulty,s.cognitive_level,null
      )
      || jsonb_build_object(
        'bank_separation',
        not exists (
          select 1 from public.nafes_question_bank q
          where q.review_status='approved' and q.is_active
            and q.subject_key=s.subject_key
            and public.nafes_content_fingerprint(q.context_text,q.question_text)
                = public.nafes_content_fingerprint(s.context_text,s.question_text)
        )
        and not exists (
          select 1 from public.nafes_indicator_curated_bank c
          where c.subject_key=s.subject_key
            and c.quality_status='approved'
            and public.nafes_content_fingerprint(c.context_text,c.question_text)
                = public.nafes_content_fingerprint(s.context_text,s.question_text)
        )
      ),
    quality_status = case
      when not public.nafes_question_quality_hard_pass(public.nafes_question_quality_checks(
        s.subject_key,s.context_text,s.question_text,s.options,s.correct_index,
        s.explanation,s.difficulty,s.cognitive_level,null
      )) then 'needs_review'
      when s.review_status='approved' and s.is_active and (
        not exists (
          select 1 from public.nafes_question_bank q
          where q.review_status='approved' and q.is_active
            and q.subject_key=s.subject_key
            and public.nafes_content_fingerprint(q.context_text,q.question_text)
                = public.nafes_content_fingerprint(s.context_text,s.question_text)
        )
        and not exists (
          select 1 from public.nafes_indicator_curated_bank c
          where c.subject_key=s.subject_key
            and c.quality_status='approved'
            and public.nafes_content_fingerprint(c.context_text,c.question_text)
                = public.nafes_content_fingerprint(s.context_text,s.question_text)
        )
      ) then 'approved'
      when s.review_status='approved' and s.is_active then 'needs_replacement'
      else 'ready'
    end,
    quality_reviewed_at=now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.nafes_question_bank'::regclass
      and conname='nafes_question_bank_quality_status_check'
  ) then
    alter table public.nafes_question_bank
      add constraint nafes_question_bank_quality_status_check
      check (quality_status in ('pending','ready','approved','needs_review','needs_replacement'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.nafes_simulation_question_bank'::regclass
      and conname='nafes_simulation_question_bank_quality_status_check'
  ) then
    alter table public.nafes_simulation_question_bank
      add constraint nafes_simulation_question_bank_quality_status_check
      check (quality_status in ('pending','ready','approved','needs_review','needs_replacement'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.nafes_training_question_bank'::regclass
      and conname='nafes_training_question_bank_quality_status_check'
  ) then
    alter table public.nafes_training_question_bank
      add constraint nafes_training_question_bank_quality_status_check
      check (quality_status in ('pending','ready','approved','needs_review','needs_replacement'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.nafes_indicator_curated_bank'::regclass
      and conname='nafes_indicator_curated_bank_quality_status_check'
  ) then
    alter table public.nafes_indicator_curated_bank
      add constraint nafes_indicator_curated_bank_quality_status_check
      check (quality_status in ('pending','ready','approved','needs_review','needs_replacement'));
  end if;
end $$;

create unique index if not exists nafes_bank_normalized_approved_uidx
on public.nafes_question_bank (
  subject_key,outcome_code,indicator_index,
  public.nafes_content_fingerprint(context_text,question_text)
)
where review_status='approved' and is_active;

create unique index if not exists nafes_sim_bank_normalized_approved_uidx
on public.nafes_simulation_question_bank (
  subject_key,outcome_code,indicator_index,
  public.nafes_content_fingerprint(context_text,question_text)
)
where review_status='approved' and is_active;

create unique index if not exists nafes_curated_normalized_approved_uidx
on public.nafes_indicator_curated_bank (
  subject_key,outcome_code,indicator_index,
  public.nafes_content_fingerprint(context_text,question_text)
)
where quality_status='approved';

create unique index if not exists nafes_training_normalized_approved_uidx
on public.nafes_training_question_bank (
  subject_key,indicator_key,
  public.nafes_content_fingerprint(context_text,question_text)
)
where review_status='approved' and is_active;

create or replace function public.nafes_standard_question_quality_guard()
returns trigger
language plpgsql
as $$
declare
  v_image jsonb;
  v_checks jsonb;
  v_hard boolean;
  v_sep boolean := true;
  v_enforce_sep boolean := false;
begin
  new.context_text := case when new.context_text is null then null else replace(new.context_text,'ـ','') end;
  new.question_text := replace(new.question_text,'ـ','');
  new.explanation := case when new.explanation is null then null else replace(new.explanation,'ـ','') end;
  if jsonb_typeof(new.options)='array' then
    select jsonb_agg(to_jsonb(replace(value,'ـ','')) order by ord)
    into new.options
    from jsonb_array_elements_text(new.options) with ordinality as o(value,ord);
  end if;

  if new.cognitive_level='knowledge' then new.difficulty:='easy';
  elsif new.cognitive_level='application' then new.difficulty:='medium';
  elsif new.cognitive_level='reasoning' and new.difficulty not in ('hard','very_hard') then new.difficulty:='hard';
  end if;

  v_image := to_jsonb(new)->'alignment_evidence'->'image';
  v_checks := public.nafes_question_quality_checks(
    new.subject_key,new.context_text,new.question_text,new.options,new.correct_index,
    new.explanation,new.difficulty,new.cognitive_level,v_image
  );
  v_hard := public.nafes_question_quality_hard_pass(v_checks);

  if tg_table_name in ('nafes_simulation_question_bank','nafes_training_question_bank') then
    v_sep :=
      not exists (
        select 1 from public.nafes_question_bank q
        where q.review_status='approved' and q.is_active
          and q.subject_key=new.subject_key
          and public.nafes_content_fingerprint(q.context_text,q.question_text)
              = public.nafes_content_fingerprint(new.context_text,new.question_text)
      )
      and not exists (
        select 1 from public.nafes_indicator_curated_bank c
        where c.subject_key=new.subject_key and c.quality_status='approved'
          and public.nafes_content_fingerprint(c.context_text,c.question_text)
              = public.nafes_content_fingerprint(new.context_text,new.question_text)
      );
    v_checks := v_checks || jsonb_build_object('bank_separation',v_sep);

    if tg_op='INSERT' then
      v_enforce_sep := true;
    else
      v_enforce_sep :=
        (to_jsonb(old)->>'question_text') is distinct from new.question_text
        or (to_jsonb(old)->>'context_text') is distinct from new.context_text
        or ((to_jsonb(old)->>'review_status') is distinct from new.review_status and new.review_status='approved');
    end if;

    if tg_table_name='nafes_training_question_bank' and not v_sep then
      v_hard := false;
    elsif tg_table_name='nafes_simulation_question_bank' and v_enforce_sep and not v_sep then
      v_hard := false;
    end if;
  end if;

  new.quality_checks := v_checks;
  new.quality_reviewed_at := now();

  if not v_hard then
    if new.review_status='approved' then new.review_status:='draft'; end if;
    new.is_active:=false;
    new.quality_status:='needs_review';
  elsif tg_table_name='nafes_simulation_question_bank' and not v_sep then
    new.quality_status:='needs_replacement';
  elsif new.review_status='approved' and new.is_active then
    new.quality_status:='approved';
  else
    new.quality_status:='ready';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_nafes_question_quality_guard on public.nafes_question_bank;
create trigger trg_nafes_question_quality_guard
before insert or update on public.nafes_question_bank
for each row execute function public.nafes_standard_question_quality_guard();

drop trigger if exists trg_nafes_simulation_question_quality_guard on public.nafes_simulation_question_bank;
create trigger trg_nafes_simulation_question_quality_guard
before insert or update on public.nafes_simulation_question_bank
for each row execute function public.nafes_standard_question_quality_guard();

drop trigger if exists trg_nafes_training_question_quality_guard on public.nafes_training_question_bank;
create trigger trg_nafes_training_question_quality_guard
before insert or update on public.nafes_training_question_bank
for each row execute function public.nafes_standard_question_quality_guard();

create or replace function public.nafes_curated_question_quality_guard()
returns trigger
language plpgsql
as $$
declare
  v_checks jsonb;
  v_hard boolean;
begin
  new.context_text := case when new.context_text is null then null else replace(new.context_text,'ـ','') end;
  new.question_text := replace(new.question_text,'ـ','');
  new.explanation := case when new.explanation is null then null else replace(new.explanation,'ـ','') end;
  if jsonb_typeof(new.options)='array' then
    select jsonb_agg(to_jsonb(replace(value,'ـ','')) order by ord)
    into new.options
    from jsonb_array_elements_text(new.options) with ordinality as o(value,ord);
  end if;

  if new.cognitive_level='knowledge' then new.difficulty:='easy';
  elsif new.cognitive_level='application' then new.difficulty:='medium';
  elsif new.cognitive_level='reasoning' and new.difficulty not in ('hard','very_hard') then new.difficulty:='hard';
  end if;

  v_checks := public.nafes_question_quality_checks(
    new.subject_key,new.context_text,new.question_text,new.options,new.correct_index,
    new.explanation,new.difficulty,new.cognitive_level,new.image
  );
  v_hard := public.nafes_question_quality_hard_pass(v_checks);
  new.quality_checks := v_checks;
  new.quality_reviewed_at := now();
  new.quality_status := case when v_hard then 'approved' else 'needs_review' end;

  if not v_hard and new.quality_version in ('science-curated-v4','math-curated-v4') then
    raise exception 'Curated NAFES item failed the quality gate and cannot enter the active curated bank';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_nafes_curated_question_quality_guard on public.nafes_indicator_curated_bank;
create trigger trg_nafes_curated_question_quality_guard
before insert or update on public.nafes_indicator_curated_bank
for each row execute function public.nafes_curated_question_quality_guard();

-- The audit functions are for service-side/teacher diagnostics only.
revoke all on function public.nafes_content_fingerprint(text,text) from public, anon, authenticated;
revoke all on function public.nafes_question_quality_checks(text,text,text,jsonb,integer,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.nafes_question_quality_hard_pass(jsonb) from public, anon, authenticated;
grant execute on function public.nafes_content_fingerprint(text,text) to service_role;
grant execute on function public.nafes_question_quality_checks(text,text,text,jsonb,integer,text,text,text,jsonb) to service_role;
grant execute on function public.nafes_question_quality_hard_pass(jsonb) to service_role;
