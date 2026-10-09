create or replace function public.lugati_comp_indicator_catalog(p_arena_key text)
returns table(
  subject_key text,
  outcome_code text,
  indicator_index integer,
  indicator_text text,
  knowledge_count bigint,
  application_count bigint,
  reasoning_count bigint
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    q.subject_key,
    q.outcome_code,
    q.indicator_index,
    max(q.indicator_text) as indicator_text,
    count(*) filter(where q.cognitive_level='knowledge') as knowledge_count,
    count(*) filter(where q.cognitive_level='application') as application_count,
    count(*) filter(where q.cognitive_level='reasoning') as reasoning_count
  from public.nafes_question_bank q
  where q.is_active=true
    and q.review_status='approved'
    and q.alignment_verified=true
    and (
      (p_arena_key='reading_1' and q.subject_key='reading' and q.outcome_code='1-1-1-2-9') or
      (p_arena_key='reading_2' and q.subject_key='reading' and q.outcome_code='2-1-1-2-9') or
      (p_arena_key='reading_3' and q.subject_key='reading' and q.outcome_code='3-1-1-2-9') or
      (p_arena_key='math' and q.subject_key='math') or
      (p_arena_key='science' and q.subject_key='science')
    )
  group by q.subject_key,q.outcome_code,q.indicator_index
  order by q.outcome_code,q.indicator_index
$function$;