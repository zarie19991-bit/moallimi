
-- The user-facing NAFES area stays unified. Quality is judged inside each
-- indicator; overlap between "indicator" and former simulation sources is
-- not a rejection criterion. Training remains separated from assessment items.

update public.nafes_simulation_question_bank s
set quality_checks = coalesce(s.quality_checks,'{}'::jsonb) - 'bank_separation',
    quality_status = case
      when public.nafes_question_quality_hard_pass(
        public.nafes_question_quality_checks(
          s.subject_key,s.context_text,s.question_text,s.options,s.correct_index,
          s.explanation,s.difficulty,s.cognitive_level,null
        )
      ) and s.review_status='approved' and s.is_active then 'approved'
      when public.nafes_question_quality_hard_pass(
        public.nafes_question_quality_checks(
          s.subject_key,s.context_text,s.question_text,s.options,s.correct_index,
          s.explanation,s.difficulty,s.cognitive_level,null
        )
      ) then 'ready'
      else 'needs_review'
    end,
    quality_reviewed_at=now();

create or replace function public.nafes_standard_question_quality_guard()
returns trigger
language plpgsql
as $$
declare
  v_image jsonb;
  v_checks jsonb;
  v_hard boolean;
  v_sep boolean := true;
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

  -- Only the personalized training bank must be different from assessment items.
  if tg_table_name='nafes_training_question_bank' then
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
    v_checks := v_checks || jsonb_build_object('assessment_separation',v_sep);
    if not v_sep then v_hard := false; end if;
  end if;

  new.quality_checks := v_checks;
  new.quality_reviewed_at := now();

  if not v_hard then
    if new.review_status='approved' then new.review_status:='draft'; end if;
    new.is_active:=false;
    new.quality_status:='needs_review';
  elsif new.review_status='approved' and new.is_active then
    new.quality_status:='approved';
  else
    new.quality_status:='ready';
  end if;

  return new;
end;
$$;


-- Re-run the status normalization after replacing the trigger, so historical
-- "needs_replacement" labels from the previous cross-bank rule are removed.
update public.nafes_simulation_question_bank s
set quality_checks = coalesce(s.quality_checks,'{}'::jsonb) - 'bank_separation',
    quality_status = case
      when public.nafes_question_quality_hard_pass(
        public.nafes_question_quality_checks(
          s.subject_key,s.context_text,s.question_text,s.options,s.correct_index,
          s.explanation,s.difficulty,s.cognitive_level,null
        )
      ) and s.review_status='approved' and s.is_active then 'approved'
      when public.nafes_question_quality_hard_pass(
        public.nafes_question_quality_checks(
          s.subject_key,s.context_text,s.question_text,s.options,s.correct_index,
          s.explanation,s.difficulty,s.cognitive_level,null
        )
      ) then 'ready'
      else 'needs_review'
    end,
    quality_reviewed_at=now();
