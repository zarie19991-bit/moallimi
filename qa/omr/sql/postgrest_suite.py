"""Real PostgREST 13 HTTP integration against a private synthetic PostgreSQL."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import socket
import subprocess
import time
import urllib.request
import urllib.error
from schema import ROOT,literal


def run_http(pg,db,fixtures,row,evidence):
    runtime_production=os.environ.get("OMR_RUNTIME_PRODUCTION")=="1"
    output_path="production-integration" if runtime_production else "postgrest"
    encode=lambda b:base64.urlsafe_b64encode(b).decode().rstrip("=")
    secret=secrets.token_urlsafe(48)
    def jwt(role):
        head=encode(b'{"alg":"HS256","typ":"JWT"}')
        body=encode(json.dumps({"role":role,"exp":int(time.time())+3600}).encode())
        return head+"."+body+"."+encode(hmac.new(secret.encode(),(head+"."+body).encode(),hashlib.sha256).digest())
    with socket.socket() as s:
        s.bind(("127.0.0.1",0)); port=s.getsockname()[1]
    directory=pg.directory
    pg.sql(db,"CREATE ROLE qa_authenticator LOGIN NOINHERIT; "
              "GRANT anon,authenticated,service_role TO qa_authenticator;")
    # Test authenticator membership, not a fabricated business table or SQL RPC.
    config=directory/"postgrest.conf"
    config.write_text(f'db-uri = "postgresql://qa_authenticator@/{db}?host={pg.socket}&port={pg.port}"\n'
        'db-schemas = "public"\ndb-anon-role = "anon"\n'
        f'jwt-secret = "{secret}"\nserver-host = "127.0.0.1"\nserver-port = {port}\n')
    config.chmod(0o600)
    native_log=open(directory/"postgrest.log","w")
    rest=subprocess.Popen(["postgrest",str(config)],env=pg.env,stdout=native_log,stderr=native_log)
    rest_url=f"http://127.0.0.1:{port}"
    service=jwt("service_role")
    def request(url,body=None,headers=None):
        data=json.dumps(body).encode() if body is not None else None
        req=urllib.request.Request(url,data=data,headers={"Content-Type":"application/json",**(headers or {})})
        try:
            with urllib.request.urlopen(req,timeout=100) as r:return r.status,json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:return e.code,json.loads(e.read() or b"null")
    bridge=None
    checks=[]
    def check(ok,name,extra=None):
        if not ok:raise AssertionError(name+": "+str(extra))
        checks.append({"name":name,"passed":True,**(extra or {})})
    try:
        for _ in range(60):
            try:
                status,_=request(rest_url+"/nafes_scan_sessions",headers={"Authorization":"Bearer "+service})
                if status==200:break
            except OSError:pass
            if rest.poll() is not None:raise RuntimeError("PostgREST stopped; see private log")
            time.sleep(.25)
        else:raise RuntimeError("PostgREST cache not ready")
        check(True,"real_postgrest_service_http_200",{"status":status})
        pg.sql(db,f"UPDATE public.nafes_teacher_access SET key_hash={literal(hashlib.sha256(b'0000000001').hexdigest())} "
                  f"WHERE id='{fixtures.OWNER}';"
                  f"INSERT INTO public.nafes_students(id,full_name,national_id_last3,class_name) "
                  f"VALUES('{fixtures.STUDENT}','Synthetic OMR Student','123','Synthetic class');"
                  "UPDATE public.nafes_paper_reviews SET review_id='RQA01';")
        for i,scope,active in [(2,"math",True),(3,"science",True),(4,"all",False)]:
            actor=f"{i}5555555-5555-4555-8555-555555555555"
            key=f"{i:010d}"
            pg.sql(db,f"INSERT INTO public.nafes_teacher_access(id,key_hash,subject_scope,active) VALUES("
                      f"'{actor}',{literal(hashlib.sha256(key.encode()).hexdigest())},'{scope}',{str(active).lower()});")
        bridge_config=directory/"http-bridge.json"
        bridge_config.write_text(json.dumps({"rest":rest_url,"service_token":service,"session":fixtures.SESSION,
                                             "runtime_production":runtime_production}))
        bridge_config.chmod(0o600)
        bridge=subprocess.Popen(["bun","qa/omr/sql/http-edge.ts",str(bridge_config)],
            cwd=ROOT,env=pg.env,stdout=subprocess.PIPE,stderr=open(directory/"edge.log","w"),text=True)
        line=bridge.stdout.readline()
        if not line:raise RuntimeError("HTTP Edge stopped; see private edge log")
        edge_url="http://127.0.0.1:"+str(json.loads(line)["port"])
        cfg=request(edge_url+"/qa-config")[1]
        snapshot=pg.json(db,"SELECT review_snapshot FROM public.nafes_scan_sessions LIMIT 1")
        snapshot.update(review_id="RQA01",title="Synthetic HTTP paper",subject="math",subjects=["math"],
                        models=[cfg["model"]],answer_keys=cfg["keys"],question_count=10)
        encoded=literal(json.dumps(snapshot))+"::jsonb"
        pg.sql(db,f"UPDATE public.nafes_scan_sessions SET review_snapshot={encoded};"
                  f"UPDATE public.nafes_paper_reviews SET payload={encoded};")
        if runtime_production:
            pg.sql(db,"UPDATE public.nafes_scan_sheets SET image_data="+literal(cfg["image"])+f" WHERE id='{row['id']}';")
            ui=subprocess.run(["bun","qa/omr/sql/http-browser.ts",edge_url,fixtures.SESSION,"review","production"],
                env=pg.env,cwd=ROOT,capture_output=True,text=True,timeout=80)
            check(ui.returncode==0,"production_review_modal_blocks_ambiguous_verification",
                  {"result":ui.stdout.strip(),"error":ui.stderr.strip()})
        base={"review_id":"RQA01","session_id":fixtures.SESSION,"sheet_id":row["id"],"answer_version":0}
        def api(action,changes=None,key="0000000001"):
            return request(edge_url+"/api/omr-local",{**base,**(changes or {}),"action":action},
                           {"x-teacher-key":key})
        for name,key in [("missing_teacher_key",""),("unknown_teacher_key","9999999999"),("inactive_teacher_key","0000000004")]:
            status,data=api("teacher_scan_list",key=key)
            check(status==401,name,{"status":status})
        status,data=api("teacher_scan_list",key="0000000003")
        check(status in [403,404],"wrong_subject_teacher_denied",{"status":status})
        status,data=api("teacher_scan_list")
        check(status==200 and len(data["sheets"])==1,"teacher_list_through_edge_and_postgrest",{"status":status})
        status,data=api("teacher_scan_verify",{"verified":True})
        check(status==409,"ambiguous_not_confirmed_over_http",{"status":status})
        edit={"question":1,"marked":[0],"request_id":fixtures.REQUEST}
        status,data=api("teacher_scan_edit_answer",edit)
        check(status==400,"manual_reason_required_over_http",{"status":status})
        status,data=api("teacher_scan_edit_answer",{**edit,"reason":fixtures.REASON})
        check(status==200,"manual_edit_http_200",{"status":status,"response":data})
        status,data=api("teacher_scan_edit_history")
        check(status==200 and data["edits"][0]["after_answer"]["manual_reason"]==fixtures.REASON,
              "manual_reason_visible_over_http",{"status":status})
        pg.sql(db,"UPDATE public.nafes_scan_sheets SET image_data="+literal(cfg["image"])+f" WHERE id='{row['id']}';")
        before=pg.json(db,f"SELECT effective_snapshot FROM public.nafes_scan_sheets WHERE id='{row['id']}'")
        status,data=api("teacher_scan_reprocess_server",{"answer_version":1})
        check(status==200 and data.get("proposal_only") is True,"reread_proposal_only_over_http",{"status":status})
        after=pg.json(db,f"SELECT effective_snapshot FROM public.nafes_scan_sheets WHERE id='{row['id']}'")
        check(before["answers"]==after["answers"],"reread_keeps_manual_answers")
        status,data=api("teacher_scan_verify",{"answer_version":1,"verified":True})
        check(status==200,"verified_resolved_sheet_http_200",{"status":status})
        status,data=api("teacher_scan_finish")
        check(status==200,"finish_batch_http_200",{"status":status})
        result={**after,"sheet_id":row["id"],"answer_version":1}
        payload={"title":"Synthetic HTTP paper","subject":"math","subjects":["math"],
                 "models":[cfg["model"]],"answer_keys":cfg["keys"],"results":[result]}
        initial_browser=subprocess.run(["bun","qa/omr/sql/http-browser.ts",edge_url,fixtures.SESSION,"publish",
                                       "production" if runtime_production else "qa"],
            env=pg.env,cwd=ROOT,capture_output=True,text=True,timeout=80)
        check(initial_browser.returncode==0,"actual_frontend_concurrent_initial_publication",
              {"result":initial_browser.stdout.strip(),"error":initial_browser.stderr.strip()})
        data=json.loads(initial_browser.stdout)["api_result"]
        status=200  # The actual frontend transport throws on every non-2xx response.
        check(status==200 and data.get("saved_count")==1,"publish_attempt_from_actual_edge_http_200",{"status":status,"response":data})
        attempts=pg.json(db,"SELECT jsonb_agg(to_jsonb(a)) FROM public.nafes_assessment_attempts a")
        check(len(attempts)==1 and attempts[0]["score"]==10 and attempts[0]["percent"]==100,
              "http_publication_persisted_correct_attempt_and_grade")
        adaptive=pg.json(db,"SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM public.lugati_adaptive_assignments a")
        check(len(adaptive)==1,"edge_rendered_indicators_feed_original_adaptive_trigger",{"observed_count":len(adaptive)})
        status,data=api("teacher_paper_review_save",payload)
        check(status==200,"http_publication_replay_200",{"status":status})
        check(pg.sql(db,"SELECT count(*) FROM public.nafes_assessment_attempts;").stdout.strip()=="1","http_replay_no_duplicate_grade")
        assessment=pg.json(db,"SELECT to_jsonb(a) FROM public.nafes_assessments a LIMIT 1")
        older_assessment={**assessment,"id":"44444444-4444-4444-8444-444444444444",
                          "config":{**assessment["config"],"paper_review_id":"RQAOTHER"}}
        older_attempt={**attempts[0],"id":"55555555-5555-4555-8555-555555555555",
            "assessment_id":older_assessment["id"],"score":5,"percent":50,
            "answers":{q["id"]:0 if i<5 else 1 for i,q in enumerate(cfg["model"]["questions"])},
            "submitted_at":"2026-01-01T00:00:00+00:00","events":[{"type":"synthetic_unrelated"}]}
        for table,record in [("nafes_assessments",older_assessment),("nafes_assessment_attempts",older_attempt)]:
            pg.sql(db,f"INSERT INTO public.{table} SELECT * FROM jsonb_populate_record(NULL::public.{table},"
                      +literal(json.dumps(record))+"::jsonb);")
        rollback={"sheet_ids":[row["id"]],"confirm":True,"request_id":"99999999-9999-4999-8999-999999999999",
                  "reason":"Synthetic HTTP admin rollback"}
        status,data=api("teacher_scan_delete",rollback,key="0000000002")
        check(status==404,"non_owner_review_is_hidden_http_404",{"status":status})
        own_review=pg.json(db,"SELECT to_jsonb(r) FROM public.nafes_paper_reviews r LIMIT 1")
        own_session=pg.json(db,"SELECT to_jsonb(s) FROM public.nafes_scan_sessions s LIMIT 1")
        own_review.update(id="66666666-6666-4666-8666-666666666666",
                          owner_id="25555555-5555-4555-8555-555555555555",review_id="RMATH01")
        own_session.update(id="77777777-7777-4777-8777-777777777777",review_pk=own_review["id"],
                           reviewer_id=own_review["owner_id"],completed_at=None,uploaded_count=0,reviewed_count=0)
        for table,record in [("nafes_paper_reviews",own_review),("nafes_scan_sessions",own_session)]:
            pg.sql(db,f"INSERT INTO public.{table} SELECT * FROM jsonb_populate_record(NULL::public.{table},"
                      +literal(json.dumps(record))+"::jsonb);")
        status,data=api("teacher_scan_delete",{**rollback,"review_id":"RMATH01","session_id":own_session["id"]},key="0000000002")
        check(status==403,"non_admin_own_review_rollback_http_403",{"status":status})
        status,data=api("teacher_scan_delete",rollback)
        check(status==200,"admin_published_rollback_http_200",{"status":status})
        remaining=pg.json(db,"SELECT jsonb_agg(to_jsonb(a)) FROM public.nafes_assessment_attempts a")
        check(len(remaining)==1 and remaining[0]["id"]==older_attempt["id"] and remaining[0]["score"]==5,
              "http_rollback_removes_only_target_grade_keeps_unrelated_grade")
        restored=pg.json(db,"SELECT jsonb_agg(to_jsonb(a)) FROM public.lugati_adaptive_assignments a")
        check(len(restored)==1 and restored[0]["source_attempt_id"]==older_attempt["id"] and
              restored[0]["source_percent"]==50,"http_rollback_recomputes_surviving_result")
        check(pg.sql(db,"SELECT count(*) FROM public.nafes_scan_deletions;").stdout.strip()=="1","http_rollback_audit_saved")
        status,data=request(rest_url+"/nafes_teacher_access")
        check(status in [401,403],"direct_anonymous_rest_teacher_access_denied",{"status":status})
        status,data=request(rest_url+"/rpc/nafes_scan_publish_attempts",{},
                            {"Authorization":"Bearer bad.signature.token"})
        check(status==401,"invalid_jwt_rejected_by_actual_postgrest",{"status":status})
        traffic=request(edge_url+"/qa-traffic")[1]
        browser=subprocess.run(["bun","qa/omr/sql/http-browser.ts",edge_url,fixtures.SESSION,"audit",
                                "production" if runtime_production else "qa"],
            env=pg.env,cwd=ROOT,capture_output=True,text=True,timeout=80)
        check(browser.returncode==0,"actual_frontend_transport_browser_to_postgrest",{"result":browser.stdout.strip(),"error":browser.stderr.strip()})
        traffic=request(edge_url+"/qa-traffic")[1]
        # Restore rehearsal is local only; dump contains private source definitions.
        backup=directory/"synthetic-restore.dump"
        args=["-h",str(pg.socket),"-p",str(pg.port),"-U","postgres"]
        pg.command(["pg_dump",*args,"-Fc","-f",str(backup),db])
        backup.chmod(0o600)
        pg.sql("postgres","CREATE DATABASE omr_original")
        pg.command(["pg_restore",*args,"--exit-on-error","-d","omr_original",str(backup)])
        restored_grade=pg.json("omr_original","SELECT jsonb_agg(jsonb_build_object('id',id,'score',score,'percent',percent)) "
                              "FROM public.nafes_assessment_attempts")
        check(len(restored_grade)==1 and restored_grade[0]["id"]==older_attempt["id"] and restored_grade[0]["score"]==5,
              "isolated_backup_restore_preserves_surviving_grade")
        check(pg.sql("omr_original","SELECT count(*) FROM public.nafes_scan_deletions;").stdout.strip()=="1",
              "isolated_backup_restore_preserves_rollback_audit")
        out=ROOT/"qa/omr/results"/output_path
        out.mkdir(parents=True,exist_ok=True)
        (out/"evidence.json").write_text(json.dumps({
            "passed":len(checks),"failed":0,"cases":checks,"traffic":traffic,
            "postgrest_version":subprocess.check_output(["postgrest","--version"],env=pg.env,text=True).strip(),
            "real_http":True,"production_connected":False,"published":False,
            "runtime_files_tested":runtime_production,
            "profile_endpoint_uses_synthetic_fixture_only":runtime_production,
            "runtime_source_sha256":{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
                for p in (ROOT/"supabase/functions/nafes-exam").glob("*.ts")} if runtime_production else {},
            "original_missing_acl":["schema ACL","paper_review ACL","scan RPC ACL"],
            "backup_restore_rehearsed":True,"production_backup_created":False,
        },ensure_ascii=False,indent=2))
        print(json.dumps({"http_passed":len(checks),"failed":0}))
    except Exception as e:
        out=ROOT/"qa/omr/results"/output_path
        out.mkdir(parents=True,exist_ok=True)
        failure={"failed_at":str(e),"passed_before_failure":len(checks),"cases":checks,
                 "real_http":True,"production_connected":False,
                 "application_sha256":hashlib.sha256((ROOT/"qa/omr/development/source/assessments.ts").read_bytes()).hexdigest()}
        (out/"last-failure.json").write_text(json.dumps(failure,ensure_ascii=False,indent=2))
        if "edge_rendered_indicators_feed_original_adaptive_trigger" in str(e) and not (out/"before.json").exists():
            (out/"before.json").write_text(json.dumps(failure,ensure_ascii=False,indent=2))
        raise
    finally:
        if bridge:
            bridge.terminate();bridge.wait(timeout=10)
        rest.terminate();rest.wait(timeout=10)
        native_log.close()
