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
 VALUES(ses,review_pk,owner_id,'{"question_count":1}'::jsonb,1,now());
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
 -- Unauthorized wrong teacher must never write any grade.
 BEGIN
  PERFORM public.nafes_scan_publish_attempts(ses,outsider,assessment,attempts);
  RAISE EXCEPTION 'FAIL: unauthorized publication accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.nafes_assessment_attempts)<>0 THEN RAISE EXCEPTION 'FAIL: unauthorized attempt written'; END IF;
 RAISE NOTICE 'PASS: unauthorized teacher blocked';
 -- Correct teacher publishes a single graded attempt.
 result:=public.nafes_scan_publish_attempts(ses,owner_id,assessment,attempts);
 aid:=(result->>'assessment_id')::uuid;
 IF (SELECT count(*) FROM public.nafes_assessment_attempts WHERE assessment_id=aid AND student_id=stu1 AND score=1)<>1
 THEN RAISE EXCEPTION 'FAIL: atomic publish'; END IF;
 RAISE NOTICE 'PASS: publish stores official-grade shape';
 -- Repeated request must be idempotent.
 result:=public.nafes_scan_publish_attempts(ses,owner_id,assessment,attempts);
 IF (SELECT count(*) FROM public.nafes_assessment_attempts WHERE assessment_id=aid)<>1
 OR result->'results'->0->'replayed' IS DISTINCT FROM 'true'::jsonb
 THEN RAISE EXCEPTION 'FAIL: idempotent replay'; END IF;
 RAISE NOTICE 'PASS: replay does not duplicate results';
 -- Tampering must reject without altering stored score.
 BEGIN
  PERFORM public.nafes_scan_publish_attempts(ses,owner_id,assessment,
   jsonb_set(attempts,'{0,payload,score}','0'::jsonb));
  RAISE EXCEPTION 'FAIL: tampered score accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF;
 END;
 IF (SELECT score FROM public.nafes_assessment_attempts WHERE assessment_id=aid AND student_id=stu1)<>1
 THEN RAISE EXCEPTION 'FAIL: tamper overwrote grade'; END IF;
 RAISE NOTICE 'PASS: tampered score rejected; grade preserved';
 -- Online attempt is unrelated to the sheet rollback and must survive.
 INSERT INTO public.nafes_assessments(owner_id,kind,title,config,rendered_sections)
 VALUES(owner_id,'multi_indicator','unrelated online attempt','{}','[]') RETURNING id INTO aid;
 INSERT INTO public.nafes_assessment_attempts(
 assessment_id,student_id,student_name,student_no,student_key,class_name,attempt_no,config,
 rendered_sections,answers,events,session_id,access_hash,lease_until,expires_at,score,total,percent)
 VALUES(aid,stu2,'Synthetic Student 2','456',stu2::text,'A',1,'{}','[]','{}','[]',
 'qa-online','hash',now()+interval '1 day',now()+interval '1 day',2,2,100);
 result:=public.nafes_scan_delete_corrections(ses,ARRAY[sheet],owner_id,'Synthetic wrong scan rollback',batch);
 IF result->>'deleted_count'<>'1' OR result->>'session_deleted'<>'true'
 THEN RAISE EXCEPTION 'FAIL: rollback result'; END IF;
 IF (SELECT count(*) FROM public.nafes_assessment_attempts)<>1
 OR (SELECT count(*) FROM public.nafes_assessment_attempts WHERE student_id=stu2 AND score=2)<>1
 THEN RAISE EXCEPTION 'FAIL: rollback destroyed unrelated student result'; END IF;
 IF (SELECT count(*) FROM public.nafes_scan_deletions WHERE batch_id=batch AND had_published_attempt)<>1
 THEN RAISE EXCEPTION 'FAIL: rollback audit missing'; END IF;
 RAISE NOTICE 'PASS: audited rollback removes only targeted paper result, preserves online grade';
 result:=public.nafes_scan_delete_corrections(ses,ARRAY[sheet],owner_id,'Synthetic wrong scan rollback',batch);
 IF result->>'replayed'<>'true' THEN RAISE EXCEPTION 'FAIL: rollback retry'; END IF;
 RAISE NOTICE 'PASS: rollback retry idempotent';
 -- Fresh session to validate explicit reason audit and manually resolvable uncertainty.
 INSERT INTO public.nafes_scan_sessions(id,review_pk,reviewer_id,review_snapshot,expected_count)
 VALUES(ses2,review_pk,owner_id,'{"question_count":1}',1);
 INSERT INTO public.nafes_scan_sheets(id,session_id,review_pk,ordinal,student_id,sheet_no,snapshot)
 VALUES(sheet2,ses2,review_pk,1,stu2,101,
 jsonb_build_object('identity_valid',true,'markers_ok',true,'total',1,'score',0,
 'answers',jsonb_build_array(jsonb_build_object('correct_index',0,'status','ambiguous','reading_status','ambiguous',
 'selected',NULL,'marked',jsonb_build_array(),'state','uncertain','correct',false,'review_pending',true))));
 BEGIN
  PERFORM public.nafes_scan_edit_answer(ses2,sheet2,owner_id,1,ARRAY[0],0,gen_random_uuid(),' ');
  RAISE EXCEPTION 'FAIL: blank edit reason accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
 PERFORM public.nafes_scan_edit_answer(ses2,sheet2,owner_id,1,ARRAY[0],0,gen_random_uuid(),'Checked bubble manually from scan');
 IF (SELECT count(*) FROM public.nafes_scan_answer_edits WHERE sheet_id=sheet2 AND after_answer->>'manual_reason'='Checked bubble manually from scan')<>1
 THEN RAISE EXCEPTION 'FAIL: manual audit'; END IF;
 RAISE NOTICE 'PASS: explicit manual edit reason recorded';
END $t$;
SELECT 'ISOLATED_SQL_ACCEPTANCE_PASS' AS result;
