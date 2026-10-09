"""Positive publish/rollback acceptance using original native triggers."""
import concurrent.futures
import json


def verify_cycle(pg, db, c, row, fixtures, assessment_data, attempts, sql, publication, evidence, check):
    if publication.returncode:
        raise RuntimeError("Original publish failed:\n" + publication.stderr)
    evidence["publication_positive_tested"] = True
    evidence["probes"]["publish_original_triggers"] = {"completed":True}
    def scalar(query):
        return pg.sql(db,query).stdout.strip()
    def rows(table):
        return pg.json(db,f"SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.{table} t")
    # Exercise original generated-column metadata and authenticated RLS,
    # without teacher credentials or a simulated replacement auth.uid.
    other = "77777777-7777-4777-8777-777777777777"
    pg.sql(db,f"INSERT INTO auth.users(id,email_confirmed_at) VALUES"
        f"('{fixtures.OWNER}','2026-10-09T00:00:00Z'),('{other}',NULL);")
    confirmed = scalar(f"SELECT confirmed_at::text FROM auth.users WHERE id='{fixtures.OWNER}';")
    check(confirmed.startswith("2026-10-09 00:00:00"),"original_generated_auth_column_evaluated")
    claims = (f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{fixtures.OWNER}',false);")
    own = "66666666-6666-4666-8666-666666666666"
    pg.sql(db,claims+f"INSERT INTO public.moallimi_classes(id,name) VALUES('{own}','Synthetic own class');")
    check(scalar(f"SELECT owner_id FROM public.moallimi_classes WHERE id='{own}';")==fixtures.OWNER,
          "original_auth_uid_default_assigns_authenticated_class_owner")
    pg.sql(db,f"INSERT INTO public.moallimi_classes(owner_id,name) VALUES('{other}','Synthetic other class');")
    visible = pg.sql(db,claims+"SELECT count(*) FROM public.moallimi_classes;").stdout.splitlines()[-1]
    check(visible=="1","original_class_rls_hides_other_owner_rows")
    denied_class = pg.sql(db,claims+
        f"INSERT INTO public.moallimi_classes(owner_id,name) VALUES('{other}','Forbidden class');",allow_error=True)
    check(denied_class.returncode!=0 and "row-level security" in denied_class.stderr,
          "original_class_rls_rejects_cross_owner_insert")
    pg.sql(db,claims+f"UPDATE public.moallimi_classes SET name='Synthetic revised class' WHERE id='{own}';")
    touched = scalar(f"SELECT updated_at>created_at FROM public.moallimi_classes WHERE id='{own}';")
    check(touched=="t","original_private_updated_at_trigger_executes")
    anon_class = pg.sql(db,"SET ROLE anon; SELECT * FROM public.moallimi_classes;",allow_error=True)
    check(anon_class.returncode!=0 and "permission denied" in anon_class.stderr,
          "original_class_acl_blocks_anonymous_read")
    saved = rows("nafes_assessment_attempts")
    check(len(saved)==1,"one_accepted_sheet_produces_exactly_one_attempt")
    attempt = saved[0]
    check(attempt["student_id"]==fixtures.STUDENT,"published_attempt_linked_to_correct_student")
    check(attempt["score"]==4 and attempt["total"]==4 and attempt["percent"]==100,
          "published_grade_matches_resolved_sheet")
    check(attempt["answers"]==attempts[0]["payload"]["answers"],"published_answers_match_reviewed_payload")
    check(attempt["config"]["paper_model"]=="A","published_model_matches_sheet_model")
    assessment = rows("nafes_assessments")[0]
    check(assessment["owner_id"]==fixtures.OWNER,"published_assessment_owner_preserved")
    adaptive = rows("lugati_adaptive_assignments")
    check(len(adaptive)==1 and adaptive[0]["tier"]=="enrichment" and adaptive[0]["source_percent"]==100,
          "original_triggers_compute_adaptive_result")
    check(adaptive[0]["source_attempt_id"]==attempt["id"],"adaptive_result_references_created_attempt")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        replays = list(pool.map(lambda _:pg.sql(db,sql,allow_error=True), range(2)))
    check(all(r.returncode==0 for r in replays),"concurrent_publication_replays_succeed")
    check(len(rows("nafes_assessment_attempts"))==1,"concurrent_replays_do_not_duplicate_attempt_or_grade")
    check(rows("nafes_assessment_attempts")[0]==attempt,"publication_replay_preserves_attempt_snapshot")
    denied = pg.sql(db,"SET ROLE anon;"+sql.split(";",1)[1],allow_error=True)
    check(denied.returncode!=0 and "permission denied" in denied.stderr,"anonymous_publish_execute_denied")
    altered = pg.sql(db,f"SET ROLE service_role; UPDATE public.nafes_assessment_attempts "
                       f"SET score=0 WHERE id='{attempt['id']}';",allow_error=True)
    check(altered.returncode!=0,"original_submitted_snapshot_trigger_rejects_grade_mutation")
    # Identity sequence now follows the original supplied catalog, not guessed DDL.
    pg.sql(db,f"SET ROLE service_role; UPDATE public.nafes_students "
              f"SET exclude_from_analysis=true WHERE id='{fixtures.STUDENT}';")
    exclusion = rows("nafes_analysis_exclusion_audit")
    check(len(exclusion)==1 and exclusion[0]["id"] is not None,"original_identity_sequence_records_exclusion_audit")
    pg.sql(db,f"SET ROLE service_role; UPDATE public.nafes_students "
              f"SET exclude_from_analysis=false WHERE id='{fixtures.STUDENT}';")
    check(len(rows("nafes_analysis_exclusion_audit"))==2,"original_exclusion_audit_trigger_records_both_changes")
    check(rows("nafes_assessment_attempts")[0]["score"]==4,"exclusion_changes_do_not_modify_student_grade")
    # Older independent result must survive rollback and become the derived source.
    older_assessment = {**assessment,"id":"44444444-4444-4444-8444-444444444444",
                        "config":{**assessment["config"],"paper_review_id":"unrelated-synthetic-review"}}
    older_attempt = {**attempt,"id":"55555555-5555-4555-8555-555555555555",
        "assessment_id":older_assessment["id"],"score":2,"total":4,"percent":50,
        "answers":{"q1":0,"q2":0,"q3":1,"q4":1},"events":[{"type":"synthetic_online"}],
        "submitted_at":"2026-10-08T00:10:00+00:00"}
    for table, data in [("nafes_assessments",older_assessment),("nafes_assessment_attempts",older_attempt)]:
        pg.sql(db,f"INSERT INTO public.{table} SELECT * FROM "
                  f"jsonb_populate_record(NULL::public.{table},{fixtures.j(data)});")
    check(len(rows("nafes_assessment_attempts"))==2,"unrelated_older_attempt_created_with_original_triggers")
    check(rows("lugati_adaptive_assignments")[0]["source_attempt_id"]==attempt["id"],
          "older_result_does_not_overwrite_latest_adaptive_source")
    pg.sql(db,"INSERT INTO public.nafes_teacher_access(id,key_hash,subject_scope)"
        " VALUES('88888888-8888-4888-8888-888888888888',repeat('8',64),'reading');")
    batch = "99999999-9999-4999-8999-999999999999"
    args = f"'{fixtures.SESSION}',ARRAY['{row['id']}']::uuid[],"
    restricted = ("SET ROLE service_role; SELECT public.nafes_scan_delete_corrections(" + args
                  + f"'88888888-8888-4888-8888-888888888888','Synthetic published rollback','{batch}');")
    denied = pg.sql(db,restricted,allow_error=True)
    check(denied.returncode!=0 and "Reviewer not authorized" in denied.stderr,
          "restricted_teacher_cannot_rollback_published_attempt")
    check(len(rows("nafes_scan_deletions"))==0 and len(rows("nafes_assessment_attempts"))==2,
          "unauthorized_published_rollback_changes_nothing")
    rollback_sql = ("SET ROLE service_role; SELECT public.nafes_scan_delete_corrections(" + args
                    + f"'{fixtures.OWNER}','Synthetic published rollback','{batch}');")
    failed = pg.sql(db,"BEGIN;"+rollback_sql+"SELECT 1/0;COMMIT;",allow_error=True)
    if "division by zero" not in failed.stderr:
        raise RuntimeError("Rollback failed before forced transaction abort:\n"+failed.stderr)
    check(len(rows("nafes_assessment_attempts"))==2 and len(rows("nafes_scan_sheets"))==1,
          "aborted_rollback_transaction_preserves_attempts_and_sheet")
    check(len(rows("nafes_scan_deletions"))==0 and len(rows("nafes_scan_answer_edits"))==1,
          "aborted_rollback_transaction_preserves_manual_audit_without_partial_ledger")
    check(rows("lugati_adaptive_assignments")[0]["source_attempt_id"]==attempt["id"],
          "aborted_rollback_transaction_restores_derived_result")
    done = pg.sql(db,rollback_sql,allow_error=True)
    if done.returncode:
        raise RuntimeError("Authorized published rollback failed:\n"+done.stderr)
    evidence["rollback_of_published_attempt_positive_tested"] = True
    evidence["probes"]["rollback_published_attempt"] = {"completed":True}
    remaining = rows("nafes_assessment_attempts")
    check(len(remaining)==1 and remaining[0]["id"]==older_attempt["id"],
          "authorized_rollback_deletes_only_target_published_attempt")
    check(remaining[0]["score"]==2 and remaining[0]["percent"]==50,"rollback_preserves_unrelated_attempt_grade")
    adaptive = rows("lugati_adaptive_assignments")
    check(len(adaptive)==1 and adaptive[0]["source_attempt_id"]==older_attempt["id"] and
          adaptive[0]["source_percent"]==50 and adaptive[0]["tier"]=="remedial",
          "original_delete_trigger_recomputes_adaptive_result_from_surviving_attempt")
    ledger = rows("nafes_scan_deletions")
    check(len(ledger)==1,"published_rollback_creates_one_audit_record")
    serialized = json.dumps(ledger[0])
    check(fixtures.REASON in serialized and attempt["id"] in serialized,
          "rollback_audit_retains_manual_reason_and_deleted_attempt_snapshot")
    check("synthetic-test-only" not in serialized,"rollback_audit_does_not_copy_attempt_access_hash")
    check(len(rows("nafes_scan_sheets"))==0,"published_rollback_removes_target_scan_sheet")
    replay = pg.sql(db,rollback_sql,allow_error=True)
    check(replay.returncode==0 and '"replayed": true' in replay.stdout,
          "published_rollback_request_replay_detected")
    check(len(rows("nafes_scan_deletions"))==1 and rows("nafes_assessment_attempts")==remaining,
          "published_rollback_replay_does_not_duplicate_audit_or_erase_other_results")
    evidence["positive_native_cycle_completed"] = True
