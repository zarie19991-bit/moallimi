-- Fetch dashboard pages in one service-only round trip and finalize elapsed attempts.
create or replace function public.nafes_teacher_catalog_counts() returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('key',k,'available',n)),'[]'::jsonb) from (
 select subject_key||':'||outcome_code||':i'||indicator_index as k,count(*) as n
 from public.nafes_question_bank
 where grade_key='middle_3' and review_status='approved' and is_active and alignment_verified
 and alignment_evidence->>'validator'='question-review-v4' and model_no between 1 and 2
 group by subject_key,outcome_code,indicator_index
 ) counts;
$$;
create or replace function public.nafes_teacher_attempt_page(p_cursor integer default 0,p_limit integer default 100) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 with per_section as (
 select a.id,s.ordinality as n,s.item->>'subject' as subject,count(*)::int as total,
 count(*) filter(where (a.answers->(q.item->>'id'))=(q.item->'correctIndex'))::int as score
 from public.nafes_assessment_attempts a
 cross join lateral jsonb_array_elements(a.rendered_sections) with ordinality s(item,ordinality)
 cross join lateral jsonb_array_elements(s.item->'questions') q(item)
 where a.submitted_at is null and a.expires_at<=now()
 group by a.id,s.ordinality,s.item->>'subject'
 ), totals as (
 select id,sum(score)::int as score,sum(total)::int as total,
 jsonb_agg(jsonb_build_object('subject',subject,'score',score,'total',total,'percent',round(score*100.0/nullif(total,0),2)) order by n) as sections
 from per_section group by id
 )
 update public.nafes_assessment_attempts a set score=t.score,total=t.total,percent=round(t.score*100.0/nullif(t.total,0),2),section_scores=t.sections,submitted_at=a.expires_at,version=a.version+1
 from totals t where a.id=t.id and a.submitted_at is null;
 with rows as (
 select 0 as source_order,'exam' as source,id,to_jsonb(a) as row from public.nafes_exam_attempts a
 union all select 1,'simulation',id,to_jsonb(a) from public.nafes_simulation_attempts a
 union all select 2,'assessment',id,to_jsonb(a) from public.nafes_assessment_attempts a
 ), page as (select * from rows order by source_order,id offset greatest(p_cursor,0) limit least(greatest(p_limit,1),100))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('source',source,'row',row) order by source_order,id) from page),'[]'::jsonb),
 'total',(select count(*) from rows)) into result;
 return result;
end $$;
revoke all on function public.nafes_teacher_catalog_counts(),public.nafes_teacher_attempt_page(integer,integer) from public,anon,authenticated;
grant execute on function public.nafes_teacher_catalog_counts(),public.nafes_teacher_attempt_page(integer,integer) to service_role;
