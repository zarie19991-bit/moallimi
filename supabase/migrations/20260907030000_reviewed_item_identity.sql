-- Reviewed task identity includes candidate data and diagrams.
-- An option-order change alone must continue to collide.
-- Existing legacy records retain the original stem/context uniqueness rule.
create or replace function public.nafes_reviewed_content_key(
  p_context text, p_question text, p_options jsonb, p_image_url text
) returns text language sql immutable parallel safe
set search_path = pg_catalog
as $function$
  select md5(jsonb_build_array(
    regexp_replace(trim(normalize(coalesce(p_context,''),NFC)),'\s+',' ','g'),
    regexp_replace(trim(normalize(coalesce(p_question,''),NFC)),'\s+',' ','g'),
    coalesce(p_image_url,''),
    (select coalesce(jsonb_agg(v order by v collate "C"),'[]'::jsonb)
       from (select regexp_replace(trim(normalize(value,NFC)),'\s+',' ','g') v
             from jsonb_array_elements_text(coalesce(p_options,'[]'::jsonb))) normalized)
  )::text)
$function$;

do $validation$
declare
 a text:=public.nafes_reviewed_content_key('c','q','["1","2","3","4"]','image1');
 reordered text:=public.nafes_reviewed_content_key('c','q','["4","2","1","3"]','image1');
 other_candidates text:=public.nafes_reviewed_content_key('c','q','["5","6","7","8"]','image1');
 other_diagram text:=public.nafes_reviewed_content_key('c','q','["1","2","3","4"]','image2');
begin
 if a<>reordered or a=other_candidates or a=other_diagram then
   raise exception 'Invalid reviewed identity';
 end if;
end $validation$;

-- Supabase applies this migration atomically; preserve a uniqueness index throughout commit.
create unique index nafes_bank_approved_content_v4_uidx on public.nafes_question_bank
(grade_key,subject_key,outcome_code,indicator_index,
 (case when alignment_evidence->>'validator'='question-review-v4'
   then public.nafes_reviewed_content_key(context_text,question_text,options,alignment_evidence->'image'->>'url')
   else md5(coalesce(context_text,'')||chr(31)||question_text) end))
where review_status='approved' and is_active;
drop index public.nafes_bank_approved_content_uidx;
alter index public.nafes_bank_approved_content_v4_uidx rename to nafes_bank_approved_content_uidx;
