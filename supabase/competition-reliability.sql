-- Apply once before deploying the matching competition Edge Function.
-- Additive safety changes: existing rounds, attempts and scores are preserved.
begin;
alter table public.nafes_question_bank add column if not exists image jsonb;
alter table public.lugati_competition_round_questions add column if not exists image jsonb;
alter table public.lugati_competition_rounds drop constraint lugati_competition_rounds_question_count_check;
alter table public.lugati_competition_rounds add constraint lugati_competition_rounds_question_count_check check (question_count between 3 and 15 and question_count % 3 = 0);

create or replace function public.lugati_comp_start_safe(p_round_id uuid, p_student_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 r public.lugati_competition_rounds%rowtype;
 a public.lugati_competition_attempts%rowtype;
begin
 select * into r from public.lugati_competition_rounds where id=p_round_id for share;
 if not found or r.status<>'open' or r.open_at>now() or r.close_at<=now() then
   return jsonb_build_object('error','هذه الجولة ليست مفتوحة الآن.','round_closed',true);
 end if;
 if (select count(*) from public.lugati_competition_round_questions where round_id=r.id)<>r.question_count then
   raise exception 'Incomplete round';
 end if;
 insert into public.lugati_competition_attempts(round_id,student_id,status,started_at,last_activity_at)
 values(r.id,p_student_id,'in_progress',now(),now())
 on conflict(round_id,student_id) do update set round_id=excluded.round_id
 returning * into a;
 if a.status='in_progress' then
   insert into public.lugati_competition_attempt_answers(attempt_id,round_question_id,position,option_order,selected_history)
   select a.id,q.id,q.position,
     (select jsonb_agg(v order by random()) from generate_series(0,3) v), '[]'::jsonb
   from public.lugati_competition_round_questions q where q.round_id=r.id
   on conflict(attempt_id,position) do nothing;
 end if;
 return to_jsonb(a);
end $$;

create or replace function public.lugati_comp_answer_safe(p_round_id uuid,p_student_id uuid,p_question_id uuid,p_option_index integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 r public.lugati_competition_rounds%rowtype;
 a public.lugati_competition_attempts%rowtype;
 ans public.lugati_competition_attempt_answers%rowtype;
 q public.lugati_competition_round_questions%rowtype;
 correct boolean;
 finished boolean;
 stamp timestamptz:=clock_timestamp();
begin
 if p_question_id is null or p_option_index is null or p_option_index not between 0 and 3 then
   return jsonb_build_object('error','حدّث الصفحة ثم اختر إجابة واحدة.');
 end if;
 select * into r from public.lugati_competition_rounds where id=p_round_id for share;
 if not found then return jsonb_build_object('error','الجولة غير موجودة.'); end if;
 select * into a from public.lugati_competition_attempts where round_id=p_round_id and student_id=p_student_id for update;
 if not found then return jsonb_build_object('error','ابدأ الجولة أولًا.'); end if;
 select * into ans from public.lugati_competition_attempt_answers where attempt_id=a.id and round_question_id=p_question_id for update;
 if not found then return jsonb_build_object('error','السؤال لا ينتمي إلى محاولتك.'); end if;
 -- Retry after a lost response returns the original acknowledgement, even after closure.
 if ans.completed then
   return jsonb_build_object('ok',true,'already_saved',true,'correct',ans.is_correct,'question_completed',true,'finished',a.status<>'in_progress','message','سبق حفظ إجابتك لهذا السؤال.');
 end if;
 stamp:=clock_timestamp();
 if r.status<>'open' or r.open_at>stamp or r.close_at<=stamp then
   return jsonb_build_object('error','أغلقت الجولة. إجاباتك السابقة محفوظة.','round_closed',true);
 end if;
 if a.status<>'in_progress' or ans.position<>a.current_position then
   return jsonb_build_object('error','تغير السؤال الحالي. استأنف الجولة من الصفحة الرئيسية.');
 end if;
 select * into q from public.lugati_competition_round_questions where id=ans.round_question_id and round_id=r.id;
 if not found then raise exception 'Question missing'; end if;
 correct:=(ans.option_order->>p_option_index)::integer=q.correct_index;
 update public.lugati_competition_attempt_answers set selected_history=jsonb_build_array(p_option_index),
   wrong_attempts=case when correct then 0 else 1 end,is_correct=correct,completed=true,
   correct_on_attempt=case when correct then 1 else null end,completed_at=stamp,
   elapsed_ms=greatest(0,(extract(epoch from(stamp-coalesce(ans.first_seen_at,stamp)))*1000)::bigint),updated_at=stamp
 where id=ans.id;
 finished:=a.current_position>=r.question_count;
 update public.lugati_competition_attempts set
   correct_questions=correct_questions+case when correct then 1 else 0 end,
   wrong_attempts=wrong_attempts+case when correct then 0 else 1 end,
   points=points+case when correct then r.points_per_correct else 0 end,
   current_position=current_position+1,
   status=case when finished then 'submitted' else 'in_progress' end,
   submitted_at=case when finished then stamp else submitted_at end,
   duration_ms=case when finished then greatest(0,(extract(epoch from(stamp-started_at))*1000)::bigint) else duration_ms end,
   last_activity_at=stamp,updated_at=stamp where id=a.id;
 return jsonb_build_object('ok',true,'correct',correct,'question_completed',true,'finished',finished,
   'message',case when correct then 'إجابة صحيحة.' else 'إجابة غير صحيحة.' end);
end $$;
revoke all on function public.lugati_comp_start_safe(uuid,uuid) from public,anon,authenticated;
revoke all on function public.lugati_comp_answer_safe(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.lugati_comp_start_safe(uuid,uuid) to service_role;
grant execute on function public.lugati_comp_answer_safe(uuid,uuid,uuid,integer) to service_role;
commit;
