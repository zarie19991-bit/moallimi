create or replace function public.nafes_teacher_attempt_page(p_cursor integer default 0, p_limit integer default 100)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare result jsonb;
begin
 if greatest(p_cursor,0)=0 then
 with per_section as (
  select a.id,s.ordinality as n,s.item->>'subject' as subject,count(*)::int as total,
  count(*) filter(where (a.answers->(q.item->>'id'))=(q.item->'correctIndex'))::int as score
  from public.nafes_assessment_attempts a
  cross join lateral jsonb_array_elements(a.rendered_sections) with ordinality s(item,ordinality)
  cross join lateral jsonb_array_elements(s.item->'questions') q(item)
  where public.nafes_analysis_student_allowed(a.student_id,a.student_key,a.is_demo)
    and a.submitted_at is null and a.expires_at<=now()
  group by a.id,s.ordinality,s.item->>'subject'
 ), totals as (
  select id,sum(score)::int as score,sum(total)::int as total,
  jsonb_agg(jsonb_build_object('subject',subject,'score',score,'total',total,'percent',round(score*100.0/nullif(total,0),2)) order by n) as sections
  from per_section group by id
 )
 update public.nafes_assessment_attempts a
 set score=t.score,total=t.total,percent=round(t.score*100.0/nullif(t.total,0),2),section_scores=t.sections,submitted_at=a.expires_at,version=a.version+1
 from totals t where a.id=t.id and a.submitted_at is null;
 end if;

 -- Keep the full snapshots out of the materialized count/order relation.
 with excluded as materialized (
   select id,id::text as student_key from public.nafes_students
   where coalesce(is_demo,false) or coalesce(exclude_from_analysis,false)
 ), ids as materialized (
 select 0 as source_order,'exam' as source,a.id from public.nafes_exam_attempts a where coalesce(a.is_demo,false)=false and not exists(select 1 from excluded s where s.id=a.student_id or s.student_key=a.student_key)
 union all
 select 1 as source_order,'simulation' as source,a.id from public.nafes_simulation_attempts a where coalesce(a.is_demo,false)=false and not exists(select 1 from excluded s where s.id=a.student_id or s.student_key=a.student_key)
 union all
 select 2 as source_order,'assessment' as source,a.id from public.nafes_assessment_attempts a where coalesce(a.is_demo,false)=false and not exists(select 1 from excluded s where s.id=a.student_id or s.student_key=a.student_key)
 ), page as materialized (
 select * from ids order by source_order,id offset greatest(p_cursor,0) limit least(greatest(p_limit,1),100)
 ), payload as (
select p.source_order,p.source,p.id,to_jsonb(a) as row from page p join public.nafes_exam_attempts a on a.id=p.id where p.source='exam'
 union all
select p.source_order,p.source,p.id,to_jsonb(a) as row from page p join public.nafes_simulation_attempts a on a.id=p.id where p.source='simulation'
 union all
select p.source_order,p.source,p.id,to_jsonb(a) as row from page p join public.nafes_assessment_attempts a on a.id=p.id where p.source='assessment'
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('source',source,'row',row) order by source_order,id) from payload),'[]'::jsonb),'total',(select count(*) from ids)) into result;
 return result;
end
$function$;
