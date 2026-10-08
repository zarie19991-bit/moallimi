"""Actual SQL regression cases; before/after on the supplied schema, synthetic rows only."""
import concurrent.futures
import copy
import hashlib
import json
import sys
import time
import subprocess
import selectors
from pathlib import Path
from schema import ROOT, SCAN_SOURCE, TEACHER_SOURCE, CORE_NAMES, original_ddl, literal
from runtime import LocalPostgres

OWNER = "33333333-3333-4333-8333-333333333333"
STUDENT = "22222222-2222-4222-8222-222222222222"
REVIEW = "00000000-0000-4000-8000-000000001000"
SESSION = "11111111-1111-4111-8111-111111111111"
SECOND = "11111111-1111-4111-8111-111111111112"
REQUEST = "00000000-0000-4000-8000-000000000009"
REASON = "synthetic image visually checked"
OUT = ROOT / "qa/omr/results/sql"
OUT.mkdir(parents=True, exist_ok=True)
ROWS = []
CONCURRENCY = []


def j(value):
    return literal(json.dumps(value, ensure_ascii=False)) + "::jsonb"


def answers(mode="clear", count=4):
    a = [dict(question=i+1, status="clear", reading_status="clear", state="correct",
              selected=0, marked=[0], correct_index=0, correct=True) for i in range(count)]
    if mode == "ambiguous":
        a[0].update(status="ambiguous", reading_status="ambiguous", state="uncertain",
                    selected=None, marked=[0, 1], correct=False,
                    uncertainty={"reading": ["bubble_ambiguous"], "identity": [], "answer_key": []})
    elif mode == "uncertain":
        a[0].update(state="uncertain", correct=False, review_pending=True)
    elif mode == "legacy_ambiguous":
        a[0].update(status="ambiguous", reading_status="ambiguous", selected=0, marked=[0, 1])
    return a


class Cases:
    def __init__(self, pg, db, repaired=False):
        self.pg, self.db, self.repaired = pg, db, repaired

    def sql(self, text, allow_error=False):
        return self.pg.sql(self.db, text, allow_error=allow_error)

    def json(self, text):
        return self.pg.json(self.db, text)

    def rpc(self, name, params, error=False):
        text = f"SELECT public.{name}({','.join(params)});"
        return self.sql(text, allow_error=error) if error else self.json(text)

    def reset(self, mode="clear", count=4, expected=1, identity=True):
        self.sql("TRUNCATE " + ",".join("public."+t for t in sorted(CORE_NAMES | {"nafes_teacher_access"})) + ";")
        payload = {"question_count": count, "assignments": [{
            "sheet_no": 1, "student_id": STUDENT, "student_name": "طالب اصطناعي", "model": "A"}],
            "answer_keys": [{"model": "A", "answers": [{"correct_index": 0} for _ in range(count)]}]}
        self.sql(f"INSERT INTO public.nafes_teacher_access(id,key_hash,label) VALUES "
                 f"({literal(OWNER)},repeat('0',64),'synthetic reviewer');"
                 f"INSERT INTO public.nafes_paper_reviews(id,owner_id,review_id,subject,subjects,payload) "
                 f"VALUES({literal(REVIEW)},{literal(OWNER)},'test-review','math',ARRAY['math'],{j(payload)});"
                 f"INSERT INTO public.nafes_scan_sessions(id,review_pk,reviewer_id,file_hash,review_snapshot,expected_count) "
                 f"VALUES({literal(SESSION)},{literal(REVIEW)},{literal(OWNER)},'synthetic-file',{j(payload)},{expected});")
        snap = dict(identity_valid=identity, markers_ok=True, model="A", student_name="طالب اصطناعي",
                    total=count, answers=answers(mode, count))
        snap["score"]=sum(a["state"]=="correct" for a in snap["answers"])
        body = dict(ordinal=1, student_id=STUDENT, sheet_no=1, image_hash="synthetic-image-1",
                    image_data="data:image/jpeg;base64,AA==", snapshot=snap)
        self.body = body
        self.row = self.rpc("nafes_scan_register", [literal(SESSION), j(body)])
        return self.row

    def stored(self):
        return self.json(f"SELECT to_jsonb(x)-'image_data' FROM public.nafes_scan_sheets x WHERE id={literal(self.row['id'])};")

    def verify(self, version=0, legacy=False, error=False):
        p = [literal(SESSION), literal(self.row["id"]), literal(OWNER), "true"]
        if not legacy:
            p.append(str(version))
        return self.rpc("nafes_scan_verify" if legacy else "nafes_scan_verify_current", p, error)

    def edit(self, marked="[0]", reason=REASON, request=REQUEST, version=0, legacy=False, error=False):
        p = [literal(SESSION), literal(self.row["id"]), literal(OWNER), "1",
             "ARRAY"+marked+"::integer[]", str(version), literal(request)]
        if self.repaired and not legacy:
            p.append("NULL" if reason is None else literal(reason))
        return self.rpc("nafes_scan_edit_answer", p, error)

    def identity(self, effective=None, student=STUDENT, session=SESSION, sheet=None, version=0, error=False):
        effective = effective or self.stored()["snapshot"]
        effective = {**effective, "identity_valid": True, "identity_manual_reason": REASON}
        p = [literal(session), literal(sheet or self.row["id"]), literal(OWNER), literal(student),
             "1", literal("طالب اصطناعي"), literal("A"), j(effective), str(version)]
        return self.rpc("nafes_scan_assign_identity", p, error)

    def rejected(self, result):
        assert result.returncode != 0, "SQL unexpectedly committed an operation that must be rejected"

    def parallel(self, name, statements, lock=None):
        """Prove both independent backend requests overlap behind an actual SQL lock."""
        command = ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-h", str(self.pg.socket),
                   "-p", str(self.pg.port), "-U", "postgres", "-d", self.db]
        gate = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True, env=self.pg.env, bufsize=1)
        lock = lock or f"SELECT id FROM public.nafes_scan_sessions WHERE id={literal(SESSION)} FOR UPDATE;"
        gate.stdin.write("BEGIN;\n"+lock+"\n\\echo QA_LOCK_READY\n")
        gate.stdin.flush()
        # A blocking line read is safe here: setup commands are bounded by an isolated DB
        # with no other workers yet; the gate is always released below.
        while gate.stdout.readline().strip() != "QA_LOCK_READY":
            assert gate.poll() is None, "Failed to obtain synthetic test lock"
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=len(statements)) as pool:
                pending = [pool.submit(self.sql, "SET application_name="+literal("qa_"+name+str(i))
                                       +";"+statement, True) for i, statement in enumerate(statements)]
                try:
                    deadline = time.monotonic()+8
                    waiting = 0
                    while time.monotonic() < deadline:
                        waiting = int(self.sql("SELECT count(*) FROM pg_catalog.pg_stat_activity "
                            f"WHERE datname={literal(self.db)} AND application_name LIKE {literal('qa_'+name+'%')} "
                            "AND wait_event_type='Lock'").stdout.strip())
                        if waiting == len(statements):
                            break
                        time.sleep(.02)
                    assert waiting == len(statements), "Requests did not demonstrably overlap"
                    CONCURRENCY.append({"database":self.db,"case":name,
                                        "independent_backends_waiting":waiting})
                finally:
                    gate.stdin.write("COMMIT;\n")
                    gate.stdin.flush()
                    gate.stdin.close()
                    gate.wait(timeout=10)
                return [future.result() for future in pending]
        finally:
            if gate.poll() is None:
                gate.kill()
                gate.wait()

    def run(self, group, name, fn):
        try:
            detail = fn()
            ROWS.append(dict(database=self.db, group=group, test=name, passed=True, detail=detail or "expected outcome"))
        except Exception as e:
            ROWS.append(dict(database=self.db, group=group, test=name, passed=False, detail=str(e)))
        print(f"{self.db}: {name}: {'PASS' if ROWS[-1]['passed'] else 'FAIL'}", flush=True)

    def suite(self):
        def missing_reason():
            self.reset("ambiguous")
            self.rejected(self.edit(legacy=True, error=True))
            assert self.stored()["snapshot"]["answers"][0]["state"] == "uncertain"
            assert self.stored()["effective_snapshot"] is None
        self.run(1, "save_without_reason_does_not_confirm_ambiguous", missing_reason)

        def blank_reason():
            self.reset("uncertain")
            self.rejected(self.edit(reason="  ", error=True))
            assert self.stored()["effective_snapshot"] is None
        self.run(1, "empty_reason_is_rejected_atomically", blank_reason)

        def manual_reason():
            self.reset("ambiguous")
            row = self.edit()
            assert row["effective_snapshot"]["answers"][0]["state"] == "correct"
            log = self.json(f"SELECT to_jsonb(e) FROM public.nafes_scan_answer_edits e WHERE id={literal(REQUEST)}")
            assert log["after_answer"].get("manual_reason") == REASON, "new human reason was not persisted"
            assert log["before_answer"]["status"] == "ambiguous"
            assert log["reviewer_id"] == OWNER and log["answer_version"] == row["answer_version"] == 1
            self.verify(version=1)
        self.run(1, "manual_choice_reason_audit_and_verify_are_consistent", manual_reason)

        def rollback():
            self.reset()
            result = self.sql("BEGIN;" + f"SELECT public.nafes_scan_edit_answer({literal(SESSION)},"
                              f"{literal(self.row['id'])},{literal(OWNER)},1,ARRAY[1],0,{literal(REQUEST)}"
                              + (","+literal(REASON) if self.repaired else "") + ");SELECT 1/0;COMMIT;", True)
            self.rejected(result)
            assert self.stored()["answer_version"] == 0
            assert self.sql("SELECT count(*) FROM public.nafes_scan_answer_edits").stdout.strip() == "0"
        self.run(1, "transaction_failure_rolls_back_answer_and_audit", rollback)

        def effective_key():
            self.reset()
            e = self.row["snapshot"]
            e["answers"][0]["correct_index"] = 1
            self.sql(f"UPDATE public.nafes_scan_sheets SET effective_snapshot={j(e)} WHERE id={literal(self.row['id'])}")
            row = self.edit(marked="[1]")
            assert row["effective_snapshot"]["answers"][0]["state"] == "correct", "grading used stale original key"
        self.run(1, "manual_edit_uses_current_model_key", effective_key)

        def invalid_marks():
            self.reset()
            self.rejected(self.edit(marked="[4]", error=True))
            self.rejected(self.edit(marked="[NULL]", error=True))
            assert self.stored()["answer_version"] == 0
        self.run(1, "invalid_marks_leave_no_write", invalid_marks)

        def repeated_mark():
            self.reset("ambiguous")
            self.rejected(self.edit(marked="[0,0]", error=True))
            assert self.stored()["effective_snapshot"] is None
        self.run(1,"duplicate_candidates_cannot_be_normalized_into_one_confirmed_choice",repeated_mark)

        def replay_reason():
            self.reset()
            self.edit()
            self.edit()
            assert self.sql("SELECT count(*) FROM public.nafes_scan_answer_edits").stdout.strip() == "1"
            assert self.stored()["answer_version"] == 1
            self.rejected(self.edit(reason="a different synthetic reason", error=True))
        self.run(1, "request_replay_is_idempotent_and_conflicting_reason_rejected", replay_reason)

        for mode in ("ambiguous", "uncertain", "legacy_ambiguous"):
            def unresolved(mode=mode):
                self.reset(mode)
                before = self.stored()
                self.rejected(self.verify(error=True))
                assert self.stored() == before
                self.rejected(self.verify(legacy=True, error=True))
            self.run(2, "verify_rejects_"+mode, unresolved)

        def stale():
            self.reset()
            self.rejected(self.verify(version=1, error=True))
            assert self.stored()["reviewed_at"] is None
        self.run(2, "verify_rejects_stale_version", stale)

        def healthy():
            self.reset(count=60)
            old = self.stored()
            self.verify()
            now = self.stored()
            assert now["disposition"] == "verified" and now["snapshot"] == old["snapshot"]
            assert now["answer_version"] == old["answer_version"] == 0
            assert self.verify()["reviewed_at"] == now["reviewed_at"]
        self.run(2, "sixty_correct_choices_unchanged_and_repeat_verify_no_second_write", healthy)

        def contradiction():
            self.reset()
            e = self.row["snapshot"]
            e["answers"][0].update(status="multiple", reading_status="multiple", state="multiple",
                                   selected=None, marked=[0, 0], correct=False)
            self.sql(f"UPDATE public.nafes_scan_sheets SET effective_snapshot={j(e)} WHERE id={literal(self.row['id'])}")
            self.rejected(self.verify(error=True))
        self.run(2, "multiple_requires_two_distinct_valid_marks", contradiction)

        def key_missing():
            self.reset()
            e = self.row["snapshot"]
            e["answers"][0]["correct_index"] = None
            self.sql(f"UPDATE public.nafes_scan_sheets SET effective_snapshot={j(e)} WHERE id={literal(self.row['id'])}")
            self.rejected(self.verify(error=True))
        self.run(2, "missing_key_cannot_be_verified", key_missing)

        def contradictory_reading():
            self.reset()
            effective=copy.deepcopy(self.row["snapshot"])
            effective["answers"][0]["reading_status"]="multiple"
            self.sql(f"UPDATE public.nafes_scan_sheets SET effective_snapshot={j(effective)}")
            self.rejected(self.verify(error=True))
            assert self.stored()["reviewed_at"] is None
        self.run(2,"contradictory_reading_status_cannot_be_verified",contradictory_reading)

        def inconsistent_score():
            self.reset()
            effective=copy.deepcopy(self.row["snapshot"])
            effective["score"]=99
            self.sql(f"UPDATE public.nafes_scan_sheets SET effective_snapshot={j(effective)}")
            self.rejected(self.verify(error=True))
            assert self.stored()["reviewed_at"] is None
        self.run(2,"inconsistent_snapshot_score_cannot_be_approved",inconsistent_score)

        def pending_flag():
            self.reset()
            e = self.row["snapshot"]
            e["answers"][0]["uncertainty"] = {"reading": [], "identity": ["identity_not_verified"], "answer_key": []}
            self.sql(f"UPDATE public.nafes_scan_sheets SET effective_snapshot={j(e)} WHERE id={literal(self.row['id'])}")
            self.rejected(self.verify(error=True))
        self.run(2, "separated_uncertainty_reasons_block_approval", pending_flag)

        def finish_pending():
            self.reset("uncertain")
            self.sql(f"UPDATE public.nafes_scan_sheets SET reviewed_at=now(),reviewed_by={literal(OWNER)},"
                     f"disposition='requires_rescan' WHERE id={literal(self.row['id'])}")
            self.rejected(self.rpc("nafes_scan_finish", [literal(SESSION)], True))
            assert self.sql("SELECT completed_at IS NULL FROM public.nafes_scan_sessions").stdout.strip() == "t"
        self.run(3, "finish_rejects_reviewed_but_unresolved_sheet", finish_pending)

        def identity_preserves():
            self.reset("uncertain", identity=False)
            before = self.stored()["snapshot"]["answers"]
            effective = self.row["snapshot"]
            effective["answers"][0].update(state="correct", correct=True, review_pending=False)
            row = self.identity(effective)
            a = row["effective_snapshot"]["answers"]
            assert [(x["selected"], x["marked"]) for x in a] == [(x["selected"], x["marked"]) for x in before]
            assert a[0]["state"] == "uncertain" and a[0]["review_pending"] is True
            log = self.json("SELECT to_jsonb(e) FROM public.nafes_scan_identity_edits e LIMIT 1")
            assert log.get("reason") == REASON and log.get("answer_version") == 1
        self.run(3, "identity_preserves_choices_pending_state_and_reason_audit", identity_preserves)

        def identity_tamper():
            self.reset()
            e = self.row["snapshot"]
            e["answers"][0].update(selected=1, marked=[1])
            self.rejected(self.identity(e, error=True))
            assert self.stored()["answer_version"] == 0
            assert self.sql("SELECT count(*) FROM public.nafes_scan_identity_edits").stdout.strip() == "0"
        self.run(3, "identity_cannot_replace_bubble_choices", identity_tamper)

        def identity_resolved():
            self.reset(identity=False)
            self.identity()
            assert self.verify(version=1)["disposition"] == "verified", "verify still used obsolete raw identity flag"
        self.run(3, "verified_manual_identity_uses_effective_context", identity_resolved)

        def human_read():
            self.reset("ambiguous")
            self.edit(marked="[1]")
            old = self.stored()
            e = copy.deepcopy(old["effective_snapshot"])
            e["answers"] = answers()
            self.rejected(self.sql(f"UPDATE public.nafes_scan_sheets SET effective_snapshot={j(e)},"
                                    f"answer_version=answer_version+1,reviewed_at=null,reviewed_by=null,disposition=null "
                                    f"WHERE id={literal(self.row['id'])}", True))
            assert self.stored() == old
        self.run(3, "unaudited_reprocess_cannot_erase_manual_review", human_read)

        def proposal():
            self.reset("ambiguous")
            self.edit(marked="[1]")
            old = self.stored()
            e = old["effective_snapshot"]
            e["omr_reprocess_proposal"] = {"answers": answers(), "applied": False}
            self.sql(f"UPDATE public.nafes_scan_sheets SET effective_snapshot={j(e)} WHERE id={literal(self.row['id'])}")
            new = self.stored()
            assert new["effective_snapshot"]["answers"] == old["effective_snapshot"]["answers"]
            assert new["answer_version"] == old["answer_version"]
            assert self.sql("SELECT count(*) FROM public.nafes_scan_answer_edits").stdout.strip() == "1"
        self.run(3, "reprocess_proposal_preserves_manual_answers_and_history", proposal)

        def closed_write():
            self.reset()
            self.verify()
            self.rpc("nafes_scan_finish", [literal(SESSION)])
            self.rejected(self.sql("UPDATE public.nafes_scan_sheets SET "
                                    f"effective_snapshot={j({'answers':answers('ambiguous')})},answer_version=1 "
                                    f"WHERE id={literal(self.row['id'])}", True))
            assert self.stored()["disposition"] == "verified"
        self.run(3, "completed_session_rejects_late_reprocess_write", closed_write)

        def reopen():
            self.reset()
            self.verify()
            self.rpc("nafes_scan_finish",[literal(SESSION)])
            self.rejected(self.sql("UPDATE public.nafes_scan_sessions SET completed_at=null",True))
            assert self.sql("SELECT completed_at IS NOT NULL FROM public.nafes_scan_sessions").stdout.strip()=="t"
        self.run(3,"finalize_upload_cannot_reopen_an_approved_batch",reopen)

        def replay_register():
            self.reset()
            first = self.row
            assert self.rpc("nafes_scan_register", [literal(SESSION), j(self.body)])["id"] == first["id"]
            assert self.sql("SELECT count(*) FROM public.nafes_scan_sheets").stdout.strip() == "1"
            self.rejected(self.rpc("nafes_scan_register", [literal(SESSION), j({**self.body,"image_hash":"different"})], True))
        self.run(4, "register_replay_and_conflicting_image", replay_register)

        def parallel_register():
            self.reset()
            self.sql("DELETE FROM public.nafes_scan_sheets")
            command = f"SELECT public.nafes_scan_register({literal(SESSION)},{j(self.body)});"
            result = self.parallel("register", [command, command])
            assert all(r.returncode == 0 for r in result)
            decoded = [json.loads(r.stdout.strip().splitlines()[-1]) for r in result]
            assert decoded[0]["id"] == decoded[1]["id"]
            assert self.sql("SELECT count(*) FROM public.nafes_scan_sheets").stdout.strip() == "1"
        self.run(4, "two_concurrent_registrations_persist_one_sheet", parallel_register)

        def duplicate():
            self.reset(expected=2)
            row = self.rpc("nafes_scan_register", [literal(SESSION), j({**self.body, "ordinal":2})])
            assert row["blocked_duplicate"] and row["duplicate_of"] == self.row["id"]
            assert self.sql("SELECT count(*) FROM public.nafes_scan_alerts").stdout.strip() == "1"
            self.verify()
            self.row = row
            self.verify()
            finished = self.rpc("nafes_scan_finish", [literal(SESSION)])
            assert finished["completed_at"]
            assert self.sql("SELECT count(*) FROM public.nafes_scan_sheets WHERE disposition='verified'").stdout.strip() == "1"
        self.run(4, "duplicate_image_and_student_are_flagged_not_graded_twice", duplicate)

        def duplicate_only():
            self.reset()
            payload=self.json("SELECT review_snapshot FROM public.nafes_scan_sessions LIMIT 1")
            self.sql(f"INSERT INTO public.nafes_scan_sessions(id,review_pk,reviewer_id,file_hash,review_snapshot,expected_count) "
                     f"VALUES({literal(SECOND)},{literal(REVIEW)},{literal(OWNER)},'synthetic-duplicate-batch',{j(payload)},1)")
            duplicate_row=self.rpc("nafes_scan_register",[literal(SECOND),j(self.body)])
            assert duplicate_row["blocked_duplicate"]
            reviewed=self.rpc("nafes_scan_verify_current",[literal(SECOND),literal(duplicate_row["id"]),literal(OWNER),"true","0"])
            assert reviewed["disposition"]=="duplicate"
            assert self.rpc("nafes_scan_finish",[literal(SECOND)])["completed_at"]
            assert self.sql(f"SELECT count(*) FROM public.nafes_scan_sheets WHERE session_id={literal(SECOND)} AND disposition='verified'").stdout.strip()=="0"
        self.run(4,"duplicate_only_batch_closes_without_any_second_grade",duplicate_only)

        def parallel_verify():
            self.reset()
            text = f"SELECT public.nafes_scan_verify_current({literal(SESSION)},{literal(self.row['id'])},{literal(OWNER)},true,0);"
            results = self.parallel("verify", [text, text])
            assert all(r.returncode == 0 for r in results)
            decoded = [json.loads(r.stdout.strip().splitlines()[-1]) for r in results]
            assert decoded[0]["reviewed_at"] == decoded[1]["reviewed_at"]
            assert self.stored()["answer_version"] == 0
        self.run(4, "two_concurrent_verifications_have_one_review_timestamp", parallel_verify)

        def parallel_edit():
            self.reset()
            p = [literal(SESSION), literal(self.row["id"]), literal(OWNER), "1", "ARRAY[0]", "0"]
            def statement(i):
                req = f"00000000-0000-4000-8000-{i+30:012d}"
                args = p+[literal(req)]+([literal(REASON)] if self.repaired else [])
                return f"SELECT public.nafes_scan_edit_answer({','.join(args)});"
            r = self.parallel("edit", [statement(0), statement(1)])
            assert sorted(x.returncode == 0 for x in r) == [False, True]
            assert self.stored()["answer_version"] == 1
            assert self.sql("SELECT count(*) FROM public.nafes_scan_answer_edits").stdout.strip() == "1"
        self.run(4, "competing_manual_edits_commit_only_one_version_and_audit", parallel_edit)

        def parallel_finish():
            self.reset()
            self.verify()
            statement = f"SELECT public.nafes_scan_finish({literal(SESSION)});"
            results = self.parallel("finish", [statement, statement])
            assert all(r.returncode == 0 for r in results)
            r = [json.loads(x.stdout.strip().splitlines()[-1]) for x in results]
            assert r[0]["completed_at"] == r[1]["completed_at"]
            self.rejected(self.edit(version=0, error=True))
        self.run(4, "concurrent_finish_is_idempotent_and_closes_editing", parallel_finish)

        def identity_race():
            self.reset()
            payload = self.json("SELECT review_snapshot FROM public.nafes_scan_sessions LIMIT 1")
            self.sql(f"INSERT INTO public.nafes_scan_sessions(id,review_pk,reviewer_id,file_hash,review_snapshot,expected_count) "
                     f"VALUES({literal(SECOND)},{literal(REVIEW)},{literal(OWNER)},'synthetic-second',{j(payload)},1)")
            body = {**self.body, "student_id":"22222222-2222-4222-8222-222222222223",
                    "image_hash":"synthetic-second-image"}
            second = self.rpc("nafes_scan_register",[literal(SECOND),j(body)])
            target = "22222222-2222-4222-8222-222222222224"
            effective = {**self.row["snapshot"],"identity_manual_reason":REASON}
            def command(s, r):
                return f"SELECT public.nafes_scan_assign_identity({literal(s)},{literal(r)},{literal(OWNER)}," \
                       f"{literal(target)},1,'طالب اصطناعي','A',{j(effective)},0);"
            result = self.parallel("identity_race",
                [command(SESSION,self.row["id"]),command(SECOND,second["id"])],
                "LOCK TABLE public.nafes_scan_identity_edits IN ACCESS EXCLUSIVE MODE;")
            assert sorted(x.returncode==0 for x in result)==[False,True], "Both sessions assigned the same student"
            assert self.sql(f"SELECT count(*) FROM public.nafes_scan_sheets WHERE student_id={literal(target)}").stdout.strip()=="1"
        self.run(4,"cross_session_identity_assignment_cannot_race_duplicate_check",identity_race)

        def edge_bridge():
            self.reset("ambiguous")
            self.edit(marked="[1]")
            value = {
                "socket":str(self.pg.socket),"port":self.pg.port,"database":self.db,
                "sheet_id":self.row["id"],"session_id":SESSION,"owner_id":OWNER,
                "source":"repaired" if self.repaired else "original",
            }
            result = subprocess.run(["bun", "qa/omr/sql/edge-bridge.ts"],cwd=ROOT,
                input=json.dumps(value),text=True,capture_output=True,env=self.pg.env,timeout=60)
            assert result.returncode==0,result.stderr
            bridge = json.loads(result.stdout.strip().splitlines()[-1])
            CONCURRENCY.append({"database":self.db,"case":"edge_reprocess_bridge","details":bridge})
            assert bridge["answers_preserved"],"actual Edge reread replaced persisted manual answers"
            assert bridge["version_preserved"],"actual Edge reread changed manual answer version"
            assert bridge["audit_rows"]==1
            assert bridge["proposal_only"] and bridge["sql_operations"]>0
        self.run(3,"actual_edge_reprocess_preserves_manual_review_in_postgres",edge_bridge)


def main():
    ddl, bodies = original_ddl()
    (OUT / "original-schema.sql").write_text(ddl)
    with LocalPostgres() as pg:
        pg.sql("postgres", "CREATE DATABASE omr_original;")
        pg.sql("postgres", "CREATE DATABASE omr_repaired;")
        for db in ("omr_original", "omr_repaired"):
            pg.sql(db, ddl)
        Cases(pg, "omr_original").suite()
        if "--baseline-only" not in sys.argv:
            from repairs import build_repairs
            repairs = build_repairs(bodies)
            (ROOT / "qa/omr/development/manual-review-repairs.sql").write_text(repairs)
            pg.sql("omr_repaired", repairs)
            Cases(pg, "omr_repaired", True).suite()
        evidence = {
            "postgres_version": pg.version, "connection": "temporary local Unix socket; listen_addresses=''",
            "synthetic_only": True, "production_connected": False,
            "source_checksums": {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                 for p in (SCAN_SOURCE, TEACHER_SOURCE)},
            "original_constraints_preserved": True,
            "scope": "7 original tables (6 scan/review plus teacher), 6 scan routines; backend-privileged SQL logic.",
            "not_covered": ["Supabase/PostgREST transport and production grants for scan tables",
                            "assessment_attempts/adaptive triggers and actual grade publishing",
                            "real historical paper images or original historical grade snapshots"],
            "temporary_directory": str(pg.directory), "cases": ROWS,
            "concurrency_proofs": CONCURRENCY,
        }
        (OUT / "sql-evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
        for db in ("omr_original", "omr_repaired"):
            cases = [r for r in ROWS if r["database"] == db]
            print(db, sum(r["passed"] for r in cases), "passed;", sum(not r["passed"] for r in cases), "failed", flush=True)
        failed = [r for r in ROWS if r["database"] == "omr_repaired" and not r["passed"]]
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
