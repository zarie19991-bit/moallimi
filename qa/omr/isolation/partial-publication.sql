-- Fully synthetic acceptance tests. DO NOT point these tests at a real database.
DO $t$
DECLARE
 owner_id uuid:='11111111-1111-4111-8111-111111111111';
 outsider uuid:='22222222-2222-4222-8222-222222222222';
 stu1 uuid:='33333333-3333-4333-8333-333333333333';
 stu2 uuid:='44444444-4444-4444-8444-444444444444';
 review_pk uuid:='55555555-5555-4555-8555-555555555555';
 ses uuid:='66666666-6666-4666-8666-666666666666';
 sheet uuid:='77777777-7777-4777-8777-777777777777';
 ses2 uuid:='88888888-8888-4888-8888-888888888888';
 sheet2 uuid:='99999999-9999-4999-8999-999999999999';
 batch uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 snapshot jsonb;
 assessment jsonb;
 attempts jsonb;
 result jsonb;
 aid uuid;
 found_count integer;
BEGIN
 IF has_function_privilege('anon','public.nafes_scan_publish_attempts(uuid,uuid,jsonb,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.nafes_scan_publish_attempts(uuid,uuid,jsonb,jsonb)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.nafes_scan_publish_attempts(uuid,uuid,jsonb,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: publish function ACL'; END IF;
 IF has_function_privilege('anon','public.nafes_scan_edit_answer(uuid,uuid,uuid,integer,integer[],integer,uuid,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.nafes_scan_edit_answer(uuid,uuid,uuid,integer,integer[],integer,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'FAIL: edit function ACL'; END IF;
 RAISE NOTICE 'PASS: service_role-only ACL for publishing and editing';
 INSERT INTO public.nafes_teacher_access(id,subject_scope) VALUES(owner_id,'all'),(outsider,'reading');
 INSERT INTO public.nafes_students(id,full_name,name_normalized,national_id_last3)
 VALUES(stu1,'Synthetic Student 1','Synthetic Student 1','123'),(stu2,'Synthetic Student 2','Synthetic Student 2','456');
 INSERT INTO public.nafes_paper_reviews(id,owner_id,review_id,subject,subjects)
 VALUES(review_pk,owner_id,'TEST-PAPER','reading',ARRAY['reading']);
 snapshot:=jsonb_build_object(
  'identity_valid',true,'markers_ok',true,'total',1,'score',1,
  'answers',jsonb_build_array(jsonb_build_object('correct_index',0,'status','clear','reading_status','clear',
  'selected',0,'marked',jsonb_build_array(0),'state','correct','correct',true,
  'review_pending',false,'requires_verification',false,
  'uncertainty',jsonb_build_object('reading',jsonb_build_array(),'identity',jsonb_build_array(),'answer_key',jsonb_build_array()))));
 INSERT INTO public.nafes_scan_sessions(id,review_pk,reviewer_id,review_snapshot,expected_count,completed_at)
 VALUES(ses,review_pk,owner_id,'{"question_count":1}'::jsonb,3,null);
 INSERT INTO public.nafes_scan_sheets(id,session_id,review_pk,ordinal,student_id,sheet_no,snapshot,reviewed_at,reviewed_by,disposition)
 VALUES(sheet,ses,review_pk,1,stu1,100,snapshot,now(),owner_id,'verified');
 assessment:=jsonb_build_object('title','Synthetic OMR test','config',jsonb_build_object('paper_review_id','TEST-PAPER'),
  'rendered_sections',jsonb_build_array(jsonb_build_object('indicator','TEST','items',jsonb_build_array())),
  'review_payload',jsonb_build_object('test_scenario',true));
 attempts:=jsonb_build_array(jsonb_build_object('sheet_id',sheet,'answer_version',0,
  'payload',jsonb_build_object('student_id',stu1,'score',1,'total',1,'percent',100,
   'config',jsonb_build_object('paper_model','A'),'rendered_sections',assessment->'rendered_sections',
   'answers',jsonb_build_object('1',0),
   'events',jsonb_build_array(jsonb_build_object('type','paper_scan','scan_session_id',ses,'scan_sheet_id',sheet)),
   'cursor',1,'section_index',0,'section_started_at',now(),'session_id','qa-session','access_hash','synthetic-hash',
   'lease_until',now()+interval '1 hour','started_at',now(),'expires_at',now()+interval '1 day',
   'submitted_at',now(),'section_scores',jsonb_build_object('reading',jsonb_build_object('score',1,'total',1)))));

 INSERT INTO public.nafes_scan_sheets(id,session_id,review_pk,ordinal,student_id,sheet_no,snapshot,disposition)
 VALUES(sheet2,ses,review_pk,2,stu2,101,'{"identity_valid":false,"markers_ok":false}', 'pending');
 BEGIN
  PERFORM public.nafes_scan_publish_attempts(ses,outsider,assessment,attempts);
  RAISE EXCEPTION 'FAIL: unauthorized publication';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
 result:=public.nafes_scan_publish_attempts(ses,owner_id,assessment,attempts);
 aid:=(result->>'assessment_id')::uuid;
 IF (SELECT count(*) FROM public.nafes_assessment_attempts)<>1 THEN RAISE EXCEPTION 'FAIL: partial publication count'; END IF;
 IF (SELECT completed_at FROM public.nafes_scan_sessions WHERE id=ses) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: pending session closed'; END IF;
 IF (SELECT reviewed_at FROM public.nafes_scan_sheets WHERE id=sheet2) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: pending paper changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.nafes_assessment_attempts WHERE student_id=stu2) THEN RAISE EXCEPTION 'FAIL: pending paper became a grade'; END IF;
 PERFORM public.nafes_scan_publish_attempts(ses,owner_id,assessment,attempts);
 IF (SELECT count(*) FROM public.nafes_assessment_attempts)<>1 THEN RAISE EXCEPTION 'FAIL: replay duplicated grade'; END IF;
 BEGIN
  PERFORM public.nafes_scan_publish_attempts(ses,owner_id,assessment,jsonb_set(attempts,'{0,payload,score}','0'));
  RAISE EXCEPTION 'FAIL: tampered score';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
 -- Later the second paper is resolved. First published grade remains immutable.
 UPDATE public.nafes_scan_sheets SET effective_snapshot=(SELECT x.snapshot FROM public.nafes_scan_sheets x WHERE x.id=sheet),
 disposition=null WHERE id=sheet2;
 PERFORM public.nafes_scan_verify(ses,sheet2,owner_id,true);
 attempts:=attempts||jsonb_build_array(jsonb_set(jsonb_set(jsonb_set(jsonb_set(attempts->0,
 '{sheet_id}',to_jsonb(sheet2)),'{payload,student_id}',to_jsonb(stu2)),
 '{payload,events,0,scan_sheet_id}',to_jsonb(sheet2)),'{payload,session_id}','"qa-session-2"'));
 PERFORM public.nafes_scan_publish_attempts(ses,owner_id,assessment,jsonb_build_array(attempts->1));
 IF (SELECT count(*) FROM public.nafes_assessment_attempts)<>2 THEN RAISE EXCEPTION 'FAIL: later paper not added'; END IF;
 IF has_function_privilege('anon','public.nafes_scan_validate_publishable(uuid)','EXECUTE') THEN RAISE EXCEPTION 'FAIL: validation ACL'; END IF;
 RAISE NOTICE 'PASS partial publication, unresolved exclusion, incomplete upload, authorization, immutable replay, tamper rejection and later completion';
END $t$;
