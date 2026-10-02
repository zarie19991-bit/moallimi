-- Quarantine defective active indicator-test drafts while preserving history and attempts.
-- Published tests are archived only when the visible question stem itself contains
-- internal authoring language. No rows or attempts are deleted.

with questions as (
  select
    a.id as assessment_id,
    a.status,
    sec->>'subject' as subject,
    q,
    coalesce(q->>'indicator_key',
      concat(sec->>'subject',':',q->>'outcome',':i',q->>'indicator')) as indicator_key
  from public.nafes_assessments a
  cross join lateral jsonb_array_elements(coalesce(a.rendered_sections,'[]'::jsonb)) sec
  cross join lateral jsonb_array_elements(coalesce(sec->'questions','[]'::jsonb)) q
  where a.kind='multi_indicator'
    and a.status in ('draft','published')
),
visible_prompt_leak as (
  select distinct assessment_id
  from questions
  where coalesce(q->>'question','') ~
    '(موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|وردت في سجل الأمثلة المهمة|المهمة المسجلة في (ملخص القواعد|مخطط المراجعة)|وردت في مخطط المراجعة المهمة|ظهرت المهمة|أي خيار يطبق المفهوم تطبيقًا صحيحًا|لتمييز المعرفة المرتبطة|ضمن مقارنة النتيجة ببديل قريب|باستخدام مقارنة النتيجة ببديل قريب|باستخدام كشف الافتراض الذي أدى إلى الخطأ|بعد كشف الافتراض الذي أدى إلى الخطأ|عند كشف الافتراض الذي أدى إلى الخطأ|أي تصحيح يجمع النتيجة السليمة ودليلها|أي تحليل يكشف الخطأ ويبرر البديل|أي تفسير يطابق النتيجة الصحيحة|في (مخطط لعلاقة بين متغيرين|مقارنة حالتين فيزيائيتين|مقارنة كائنين أو خليتين|تقويم إجراء صحي أو بيئي|تحليل تغير في نظام حيوي|اختيار إجراء مختبري|مقارنة عينتين ماديتين|تقويم تصميم تقني|تقويم قرار بيئي|خريطة ميدانية|سجل رصد طويل المدى|مقارنة موقعين) بهدف)'
),
level_gap as (
  select assessment_id
  from questions
  group by assessment_id,indicator_key
  having count(*)>=3
     and not (
       bool_or(q->>'cognitive_level'='knowledge')
       and bool_or(q->>'cognitive_level'='application')
       and bool_or(q->>'cognitive_level'='reasoning')
     )
),
reading_bad as (
  select distinct assessment_id
  from (
    select assessment_id,
           coalesce(nullif(q->>'context',''),'__MISSING__') as context_key,
           count(*) as n
    from questions
    where subject='reading'
    group by assessment_id,coalesce(nullif(q->>'context',''),'__MISSING__')
  ) x
  where context_key='__MISSING__' or n<>5
),
answer_bad as (
  select distinct assessment_id
  from (
    select assessment_id,subject,count(*) as n,
      count(*) filter(where (q->>'correctIndex')::int=0) as a,
      count(*) filter(where (q->>'correctIndex')::int=1) as b,
      count(*) filter(where (q->>'correctIndex')::int=2) as c,
      count(*) filter(where (q->>'correctIndex')::int=3) as d
    from questions
    where q ? 'correctIndex'
    group by assessment_id,subject
  ) x
  where n>=8
    and (
      least(a,b,c,d)=0
      or greatest(a,b,c,d)-least(a,b,c,d) > greatest(3,ceil(n*0.25)::int)
    )
),
draft_bad as (
  select id
  from public.nafes_assessments
  where kind='multi_indicator' and status='draft'
    and id in (
      select assessment_id from visible_prompt_leak
      union select assessment_id from level_gap
      union select assessment_id from reading_bad
      union select assessment_id from answer_bad
    )
),
published_visible_bad as (
  select a.id
  from public.nafes_assessments a
  join visible_prompt_leak v on v.assessment_id=a.id
  where a.kind='multi_indicator' and a.status='published'
),
targets as (
  select id,'draft_quality_quarantine'::text as reason from draft_bad
  union all
  select id,'published_visible_prompt_quarantine'::text from published_visible_bad
)
update public.nafes_assessments a
set status='archived',
    config=coalesce(a.config,'{}'::jsonb) ||
      jsonb_build_object(
        'maintenance_quarantine',
        jsonb_build_object(
          'reason',t.reason,
          'at','2026-10-02T00:00:00Z',
          'preserve_attempts',true,
          'repair_version','indicator-quality-gate-v1'
        )
      )
from targets t
where a.id=t.id;
