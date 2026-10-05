-- Rollback-only integration test: no student rows or existing reviews are changed.
begin;
do $$
declare owner uuid; review uuid; sid uuid:=gen_random_uuid(); sid2 uuid:=gen_random_uuid(); student uuid:=gen_random_uuid(); first jsonb; second jsonb; result jsonb;
begin
 select id into owner from public.nafes_teacher_access where active=true limit 1;
 insert into public.nafes_paper_reviews(owner_id,review_id,title,subject,subjects) values(owner,'RQA_'||replace(gen_random_uuid()::text,'-',''),'QA rollback','reading',array['reading']) returning id into review;
 insert into public.nafes_scan_sessions(id,review_pk,reviewer_id,file_hash,expected_count,review_snapshot) values(sid,review,owner,repeat('a',64),2,'{}');
 first:=public.nafes_scan_register(sid,jsonb_build_object('ordinal',1,'student_id',student,'sheet_no',1,'image_hash','hash1','image_data','qa','snapshot',jsonb_build_object('identity_valid',true,'markers_ok',true,'answers','[{"state":"blank"},{"state":"multiple"}]'::jsonb)));
 if (first->>'blocked_duplicate')::boolean then raise exception 'first incorrectly duplicate'; end if;
 result:=public.nafes_scan_register(sid,jsonb_build_object('ordinal',1,'image_hash','hash1'));
 if result->>'id'<>first->>'id' then raise exception 'retry created another upload'; end if;
 begin perform public.nafes_scan_finish(sid);raise exception 'TEST_FAIL unfinished session closed'; exception when others then if sqlerrm like 'TEST_FAIL%' then raise;end if;end;
 second:=public.nafes_scan_register(sid,jsonb_build_object('ordinal',2,'student_id',student,'sheet_no',1,'image_hash','hash2','image_data','qa','snapshot',jsonb_build_object('identity_valid',true,'markers_ok',true,'answers','[]'::jsonb)));
 if not (second->>'blocked_duplicate')::boolean then raise exception 'duplicate not detected'; end if;
 begin perform public.nafes_scan_verify(sid,(second->>'id')::uuid,owner,true);raise exception 'TEST_FAIL skipped first'; exception when others then if sqlerrm like 'TEST_FAIL%' then raise;end if;end;
 result:=public.nafes_scan_verify(sid,(first->>'id')::uuid,owner,false);
 if result->>'disposition'<>'verified' then raise exception 'blank and multiple cannot be verified'; end if;
 if result->'snapshot'<>first->'snapshot' then raise exception 'answers mutated'; end if;
 begin perform public.nafes_scan_verify(sid,(second->>'id')::uuid,owner,false);raise exception 'TEST_FAIL ignored duplicate'; exception when others then if sqlerrm like 'TEST_FAIL%' then raise;end if;end;
 result:=public.nafes_scan_verify(sid,(second->>'id')::uuid,owner,true);
 if result->>'disposition'<>'duplicate' then raise exception 'duplicate scored';end if;
 result:=public.nafes_scan_finish(sid);
 if result->>'completed_at' is null then raise exception 'completion missing';end if;
 if (select count(*) from public.nafes_scan_alerts where review_pk=review)<>1 then raise exception 'alert was removed'; end if;
 insert into public.nafes_scan_sessions(id,review_pk,reviewer_id,file_hash,expected_count,review_snapshot) values(sid2,review,owner,repeat('b',64),1,'{}');
 result:=public.nafes_scan_register(sid2,jsonb_build_object('ordinal',1,'student_id',student,'image_hash','hash3','image_data','qa','snapshot','{}'::jsonb));
 if not (result->>'blocked_duplicate')::boolean then raise exception 'cross-session duplicate missed'; end if;
 if has_table_privilege('anon','public.nafes_scan_sheets','SELECT') or has_table_privilege('authenticated','public.nafes_scan_sheets','SELECT') then raise exception 'client access exposed';end if;
 if has_function_privilege('anon','public.nafes_scan_register(uuid,jsonb)','EXECUTE') then raise exception 'anonymous RPC exposed';end if;
end $$;
select 'PASS: duplicate, retry, ordering, acknowledgement, immutable answers, completion, cross-session, permissions' as result;
rollback;
