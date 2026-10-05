begin;
do $$
declare owner uuid; review uuid; sid uuid:=gen_random_uuid(); sheet jsonb; edited jsonb; q jsonb;
 req uuid:=gen_random_uuid(); version_no integer:=0; choice integer;
begin
 select id into owner from public.nafes_teacher_access where active=true limit 1;
 insert into public.nafes_paper_reviews(owner_id,review_id,title,subject,subjects) values(owner,'RQA_'||replace(gen_random_uuid()::text,'-',''),'QA rollback','reading',array['reading']) returning id into review;
 insert into public.nafes_scan_sessions(id,review_pk,reviewer_id,file_hash,expected_count,review_snapshot) values(sid,review,owner,repeat('a',64),1,'{}');
 sheet:=public.nafes_scan_register(sid,jsonb_build_object('ordinal',1,'student_id',gen_random_uuid(),'sheet_no',1,'image_hash','edit-test','image_data','qa','snapshot',
 jsonb_build_object('identity_valid',true,'markers_ok',true,'answers','[{"question":1,"state":"blank","status":"blank","selected":null,"marked":[],"correct_index":0,"correct":false,"confidence":0.9}]'::jsonb)));
 edited:=public.nafes_scan_edit_answer(sid,(sheet->>'id')::uuid,owner,1,array[0],0,req);
 if edited->'effective_snapshot'->>'score'<>'1' or edited->'snapshot'<>sheet->'snapshot' then raise exception 'edit scoring or original preservation failed';end if;
 if public.nafes_scan_edit_answer(sid,(sheet->>'id')::uuid,owner,1,array[0],0,req)->>'answer_version'<>'1' then raise exception 'retry not idempotent';end if;
 begin perform public.nafes_scan_edit_answer(sid,(sheet->>'id')::uuid,owner,1,array[1],0,gen_random_uuid());raise exception 'TEST_FAIL stale edit accepted';exception when others then if sqlerrm like 'TEST_FAIL%' then raise;end if;end;
 begin perform public.nafes_scan_verify_current(sid,(sheet->>'id')::uuid,owner,false,0);raise exception 'TEST_FAIL stale verification accepted';exception when others then if sqlerrm like 'TEST_FAIL%' then raise;end if;end;
 perform public.nafes_scan_verify_current(sid,(sheet->>'id')::uuid,owner,false,1);
 edited:=public.nafes_scan_edit_answer(sid,(sheet->>'id')::uuid,owner,1,array[1],1,gen_random_uuid());
 q:=edited->'effective_snapshot'->'answers'->0;
 if q->>'state'<>'incorrect' or edited->>'reviewed_at' is not null then raise exception 'any-answer edit or verification reset failed';end if;
 edited:=public.nafes_scan_edit_answer(sid,(sheet->>'id')::uuid,owner,1,array[0,1],2,gen_random_uuid());
 if edited->'effective_snapshot'->'answers'->0->>'state'<>'multiple' or edited->'effective_snapshot'->>'score'<>'0' then raise exception 'multiple scored';end if;
 edited:=public.nafes_scan_edit_answer(sid,(sheet->>'id')::uuid,owner,1,'{}'::integer[],3,gen_random_uuid());
 if edited->'effective_snapshot'->'answers'->0->>'state'<>'blank' then raise exception 'blank edit failed';end if;
 if (select count(*) from public.nafes_scan_answer_edits where sheet_id=(sheet->>'id')::uuid)<>4 then raise exception 'audit count incorrect';end if;
 if exists(select 1 from public.nafes_scan_answer_edits where sheet_id=(sheet->>'id')::uuid and reviewer_id<>owner) then raise exception 'reviewer audit missing';end if;
 perform public.nafes_scan_verify_current(sid,(sheet->>'id')::uuid,owner,false,4);perform public.nafes_scan_finish(sid);
 begin perform public.nafes_scan_edit_answer(sid,(sheet->>'id')::uuid,owner,1,array[0],4,gen_random_uuid());raise exception 'TEST_FAIL closed session edited';exception when others then if sqlerrm like 'TEST_FAIL%' then raise;end if;end;
 if has_table_privilege('authenticated','public.nafes_scan_answer_edits','INSERT') or has_table_privilege('service_role','public.nafes_scan_answer_edits','DELETE') then raise exception 'unsafe audit privileges';end if;
end $$;
select 'PASS: all-answer edits, scoring, original preservation, audit, idempotency, stale version rejection, review reset, completion lock, permissions' as result;
rollback;
