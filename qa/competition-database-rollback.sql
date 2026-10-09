-- Run after the installation SQL in the SAME transaction, ending with ROLLBACK.
do $$
declare sid uuid; season uuid; rid uuid; qid uuid; aid uuid; result jsonb; a record; i integer;
begin
 select id into sid from public.nafes_students where is_active limit 1;
 if sid is null then raise exception 'No existing student available for rollback-only FK fixture'; end if;
 insert into public.lugati_competition_seasons(season_no,title,is_current)
 values((select coalesce(max(season_no),0)+100000 from public.lugati_competition_seasons),'ROLLBACK ONLY reliability test',false) returning id into season;
 insert into public.lugati_competition_rounds(season_id,arena_key,subject_key,title,selected_indicators,status,question_count,open_at)
 values(season,'math','math','ROLLBACK ONLY','[]','open',3,now()-interval '1 minute') returning id into rid;
 for i in 1..3 loop
 insert into public.lugati_competition_round_questions(round_id,position,subject_key,outcome_code,indicator_index,indicator_text,cognitive_level,question_text,options,correct_index)
 values(rid,i,'math','TEST',1,'ROLLBACK ONLY','knowledge','ROLLBACK ONLY question','["A","B","C","D"]',0);
 end loop;
 result:=public.lugati_comp_start_safe(rid,sid);aid:=(result->>'id')::uuid;
 assert (select count(*) from public.lugati_competition_attempt_answers where attempt_id=aid)=3,'start creates all answers';
 result:=public.lugati_comp_start_safe(rid,sid);
 assert (result->>'id')::uuid=aid,'repeat start preserves attempt';
 assert (select count(*) from public.lugati_competition_attempt_answers where attempt_id=aid)=3,'repeat start does not duplicate';
 select round_question_id into qid from public.lugati_competition_attempt_answers where attempt_id=aid and position=1;
 update public.lugati_competition_attempt_answers set option_order='[2,0,3,1]' where attempt_id=aid and position=1;
 result:=public.lugati_comp_answer_safe(rid,sid,qid,1);
 assert (result->>'correct')::boolean,'shuffled correct answer';
 result:=public.lugati_comp_answer_safe(rid,sid,qid,3);
 assert (result->>'already_saved')::boolean,'replay acknowledged';
 select * into a from public.lugati_competition_attempts where id=aid;
 assert a.correct_questions=1 and a.current_position=2 and a.points=10,'replay does not alter score or next question';
 result:=public.lugati_comp_answer_safe(rid,sid,gen_random_uuid(),0);
 assert result ? 'error','foreign question rejected';
 for i in 2..3 loop
 select round_question_id into qid from public.lugati_competition_attempt_answers where attempt_id=aid and position=i;
 update public.lugati_competition_attempt_answers set option_order='[0,1,2,3]' where attempt_id=aid and position=i;
 result:=public.lugati_comp_answer_safe(rid,sid,qid,case when i=2 then 1 else 0 end);
 end loop;
 select * into a from public.lugati_competition_attempts where id=aid;
 assert a.status='submitted' and a.correct_questions=2 and a.wrong_attempts=1 and a.points=20 and a.current_position=4,'dynamic count finalizes atomically';
 result:=public.lugati_comp_answer_safe(rid,sid,qid,0);
 assert (result->>'already_saved')::boolean and (result->>'finished')::boolean,'last question retry safe';
end $$;
rollback;
