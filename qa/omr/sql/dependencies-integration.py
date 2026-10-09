"""Exercise the supplied private dependencies, without fabricating missing sources.

The database slice is explicitly not a complete Supabase installation.
No decrypted definitions are written under the repository.
"""
import importlib.util
import json
import os
import re
from pathlib import Path

from runtime import LocalPostgres
from schema import ROOT, SCAN_SOURCE, original_ddl, literal
from repairs import build_repairs


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run():
    catalog_path = Path(os.environ["OMR_PRIVATE_CATALOG"]).resolve()
    dependency_path = Path(os.environ["OMR_PRIVATE_DEPENDENCIES"]).resolve()
    assert all(str(p).startswith("/tmp/") for p in [catalog_path, dependency_path])
    catalog = json.loads(catalog_path.read_text())
    deps = json.loads(dependency_path.read_text())
    original = json.loads(SCAN_SOURCE.read_text())
    renderer = load_module("original_catalog_renderer", "catalog-integration.py")
    fixtures = load_module("original_scan_fixture", "run-tests.py")
    tables = {t["name"]: t for t in catalog["tables"]}
    tables.update({t["name"]: t for t in deps["dependent_relations"]})
    functions = {f["name"]: f["definition"] for f in catalog["functions"]}
    functions.update({f["name"]: f["definition"] for f in deps["dependent_functions"]})
    for table in original["tables"]:
        for trigger in table.get("triggers") or []:
            body = trigger.get("function_definition")
            if body:
                functions.setdefault(re.search(r"FUNCTION public\.(\w+)", body)[1], body)
    qualified = set()
    for body in functions.values():
        qualified.update(re.findall(r"\b(public|auth|private)\.(\w+)\s*\(", body))
    for table in tables.values():
        for trigger in table.get("triggers") or []:
            text = trigger if isinstance(trigger, str) else trigger["definition"]
            qualified.update(re.findall(r"EXECUTE FUNCTION (?:(\w+)\.)?(\w+)", text))
        for column in table["columns"]:
            qualified.update(re.findall(r"\b(public|auth|private)\.(\w+)\s*\(", column.get("default") or ""))
        expressions = "\n".join(c["definition"] for c in table["constraints"]) + "\n" + "\n".join(table["indexes"])
        qualified.update(("public", name) for name in re.findall(r"\b((?:nafes|lugati)_\w+)\s*\(", expressions))
    missing = sorted({(schema or "public") + "." + name for schema, name in qualified
                      if name not in functions and name not in tables})
    evidence = {
        "synthetic_only": True, "production_connected": False, "ready_to_publish": False,
        "original_dependency_functions_loaded": sorted(f["name"] for f in deps["dependent_functions"]),
        "next_missing_function_definitions": missing,
        "source_metadata_limitations": [
            "auth.users confirmed_at has a column-referencing expression labelled default, without generated metadata",
            "nafes_analysis_exclusion_audit.id lacks default and identity metadata; audit insertion must be checked",
            "schema/sequence ACL and original scan RPC ACL are absent",
            "omr_table_acl contains scan_deletions but not paper_reviews",
        ],
        "publication_positive_tested": False,
        "rollback_of_published_attempt_positive_tested": False,
        "postgrest_transport_tested": False, "cases": [], "probes": {},
    }
    with LocalPostgres() as pg:
        pg.sql("postgres", "CREATE DATABASE omr_repaired")
        db = "omr_repaired"
        ddl, bodies = original_ddl()
        pg.sql(db, ddl)
        pg.sql(db, build_repairs(bodies))
        c = fixtures.Cases(pg, db, repaired=True)
        row = c.reset("ambiguous")
        # Complete public slices only; no fabricated auth.uid or classes trigger.
        installed = set()
        for name in ["nafes_students", "nafes_assessments", "nafes_scan_deletions",
                     "nafes_analysis_exclusion_audit", "lugati_adaptive_assignments",
                     "nafes_assessment_attempts", "nafes_simulation_attempts", "nafes_question_bank"]:
            t = tables[name]
            normalized = {**t, "policies": [
                {"name": p["name"], "roles": p["roles"],
                 "cmd": p.get("cmd", p.get("command")),
                 "using": p["using"], "check": p.get("check", p.get("with_check"))}
                for p in t["policies"]]}
            imported = pg.sql(db, "BEGIN;\n" + renderer.table_ddl(normalized) + "\nCOMMIT;", allow_error=True)
            if imported.returncode:
                evidence["probes"]["import_public."+name] = {
                    "completed":False,"error_first_line":imported.stderr.splitlines()[0]}
                assert name == "nafes_question_bank", "Unexpected closed-slice import failure"
            else:
                installed.add(name)
        for body in functions.values():
            assert not re.search(r"dblink|net\.|COPY.*PROGRAM|pg_(read|write)_file", body, re.I | re.S)
            pg.sql(db, body)
        for name in ["nafes_students", "nafes_assessments", "lugati_adaptive_assignments",
                     "nafes_assessment_attempts", "nafes_simulation_attempts", "nafes_question_bank"]:
            if name not in installed:
                continue  # Whole import rolled back; no partial table or disabled trigger.
            for trigger in tables[name]["triggers"]:
                pg.sql(db, trigger + ";")
        # Override development table grants with the actual received originals.
        priv = {"a":"INSERT","r":"SELECT","w":"UPDATE","d":"DELETE","D":"TRUNCATE",
                "x":"REFERENCES","t":"TRIGGER","m":"MAINTAIN"}
        for acl in deps["omr_table_acl"]:
            pg.sql(db, f"REVOKE ALL ON public.{acl['table']} FROM service_role;")
            rights = re.search(r"service_role=([^/]+)", acl["acl"])[1]
            pg.sql(db, f"GRANT {','.join(priv[c] for c in rights)} ON public.{acl['table']} TO service_role;")
        for acl in deps["earlier_function_acl"] + deps["dependent_functions"]:
            # Preserve the exact exported overload; dependency function argument
            # identities are read from the installed original definition.
            identity = acl.get("identity_args")
            if identity is None:
                identity = pg.sql(db, "SELECT pg_get_function_identity_arguments(oid) FROM pg_proc "
                    f"WHERE pronamespace='public'::regnamespace AND proname={literal(acl['name'])};").stdout.strip()
            signature = "public." + acl["name"] + "(" + identity + ")"
            rights = acl.get("acl")
            if rights is None:
                # NULL ACL means PostgreSQL's original default PUBLIC EXECUTE.
                pg.sql(db, f"GRANT EXECUTE ON FUNCTION {signature} TO PUBLIC;")
            else:
                pg.sql(db, f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC,anon,authenticated,service_role;")
                for entry in rights.strip("{}").split(","):
                    role, grant = entry.split("=", 1)
                    if role == "postgres":
                        continue
                    assert role in {"", "service_role", "anon", "authenticated"}
                    if "X" in grant.split("/")[0]:
                        pg.sql(db, f"GRANT EXECUTE ON FUNCTION {signature} TO {role or 'PUBLIC'};")
        def check(condition, name):
            assert condition, name
            evidence["cases"].append({"name": name, "passed": True})
        def service_json(text):
            result = pg.sql(db, "SET ROLE service_role;" + text)
            return json.loads(next(line for line in result.stdout.splitlines()
                                   if line.startswith(("{", "["))))
        c.sql = lambda text, allow_error=False: pg.sql(
            db, "SET ROLE service_role;" + text, allow_error=allow_error)
        c.json = service_json
        evidence["scan_rpc_role"] = "service_role"
        evidence["paper_review_acl_original_not_supplied"] = True
        student = fixtures.STUDENT
        result = pg.sql(db, "SET ROLE service_role; INSERT INTO public.nafes_students"
            f"(id,full_name,national_id_last3,class_name) VALUES('{student}','Synthetic Student','123','Synthetic class'); RESET ROLE;")
        check(result.returncode == 0, "original_student_insert_with_normalization_and_all_student_triggers")
        record = pg.json(db, f"SELECT to_jsonb(s) FROM public.nafes_students s WHERE id='{student}'")
        check(record["name_normalized"] == "synthetic student", "normalization_original_function_executed")
        check(record["is_demo"] is False, "synthetic_student_is_regular_roster_for_attempt_test")
        rejected = c.verify(error=True)
        check(rejected.returncode != 0, "ambiguous_sheet_not_verified_without_resolution")
        edited = c.edit()
        check(edited["answer_version"] == 1, "manual_resolution_version_incremented")
        audit = pg.json(db, "SELECT jsonb_agg(to_jsonb(e)) FROM public.nafes_scan_answer_edits e")
        check(len(audit) == 1 and audit[0]["after_answer"]["manual_reason"] == fixtures.REASON,
              "manual_reason_persisted_in_original_audit_table")
        c.verify(version=1)
        pg.json(db, f"SELECT public.nafes_scan_finish('{fixtures.SESSION}')")
        check(pg.json(db, f"SELECT to_jsonb(s) FROM public.nafes_scan_sessions s WHERE id='{fixtures.SESSION}'")["completed_at"] is not None,
              "resolved_sheet_batch_accepted")
        sections = [{"subject":"math","questions":[
            {"id":f"q{i}","subject":"math","outcome":"qa","indicator":1,"correctIndex":0}
            for i in range(1,5)]}]
        assessment_data = {"title":"Synthetic OMR integration",
            "config":{"sections":[{"subject":"math"}],"paper_review_id":"test-review"},
            "rendered_sections":sections,"review_payload":c.json(
                f"SELECT payload FROM public.nafes_paper_reviews WHERE id='{fixtures.REVIEW}'")}
        data = {"student_id":student,"score":4,"total":4,"percent":100,
            "config":{"paper_model":"A"},"rendered_sections":sections,
            "answers":{f"q{i}":0 for i in range(1,5)},
            "events":[{"type":"paper_scan","scan_sheet_id":row["id"],"scan_session_id":fixtures.SESSION}],
            "cursor":4,"section_index":0,"section_started_at":"2026-10-09T00:00:00Z",
            "session_id":"synthetic","access_hash":"synthetic-test-only",
            "lease_until":"2026-10-09T01:00:00Z","started_at":"2026-10-09T00:00:00Z",
            "expires_at":"2026-10-09T01:00:00Z","submitted_at":"2026-10-09T00:10:00Z",
            "section_scores":[]}
        attempts = [{"sheet_id":row["id"],"answer_version":1,"payload":data}]
        sql = ("SET ROLE service_role; SELECT public.nafes_scan_publish_attempts("
               f"'{fixtures.SESSION}','{fixtures.OWNER}',{fixtures.j(assessment_data)},{fixtures.j(attempts)});")
        publication = pg.sql(db, sql, allow_error=True)
        if publication.returncode:
            message = publication.stderr
            match = re.search(r'(?:relation|function) "([^"]+)" does not exist', message)
            evidence["probes"]["publish_original_triggers"] = {
                "completed":False,"missing_runtime_dependency":match[1] if match else None,
                "error_first_line":message.splitlines()[0]}
        else:
            evidence["publication_positive_tested"] = True
        check(pg.sql(db,"SELECT count(*) FROM public.nafes_assessment_attempts;").stdout.strip()=="0",
              "failed_publication_does_not_leave_partial_attempts")
        check(pg.sql(db,"SELECT count(*) FROM public.nafes_assessments;").stdout.strip()=="0",
              "failed_publication_rolls_back_new_assessment")
        check(len(pg.json(db,"SELECT jsonb_agg(to_jsonb(e)) FROM public.nafes_scan_answer_edits e"))==1,
              "publication_failure_preserves_manual_audit")
        # Verify both secondary metadata blockers with native DDL, not speculation.
        pg.sql(db,"CREATE SCHEMA auth")
        for name in ["users","moallimi_classes"]:
            t = tables[name]
            schema = t.get("schema","public")
            columns = []
            for col in t["columns"]:
                text = '"' + col["name"] + '" ' + col["type"]
                if col["not_null"]: text += " NOT NULL"
                if col.get("default") is not None: text += " DEFAULT " + col["default"]
                columns.append(text)
            probe = pg.sql(db,f"CREATE TABLE {schema}.{name} ({','.join(columns)});",allow_error=True)
            evidence["probes"]["import_"+schema+"."+name] = {
                "completed":probe.returncode==0,
                "error_first_line":probe.stderr.splitlines()[0] if probe.returncode else None}
        # Original audit insert now runs: discover whether identity metadata was lost.
        audit_probe = pg.sql(db, f"UPDATE public.nafes_students SET exclude_from_analysis=true "
                            f"WHERE id='{student}';",allow_error=True)
        evidence["probes"]["student_exclusion_audit"] = {
            "completed":audit_probe.returncode==0,
            "error_first_line":audit_probe.stderr.splitlines()[0] if audit_probe.returncode else None}
        batch = "99999999-9999-4999-8999-999999999999"
        pg.sql(db,f"INSERT INTO public.nafes_teacher_access(id,key_hash,subject_scope)"
                  " VALUES('88888888-8888-4888-8888-888888888888',repeat('8',64),'reading');")
        args = f"'{fixtures.SESSION}',ARRAY['{row['id']}']::uuid[],"
        unauthorized = pg.sql(db, "SET ROLE service_role; SELECT public.nafes_scan_delete_corrections("
            + args + f"'88888888-8888-4888-8888-888888888888','Synthetic QA rollback','{batch}');", allow_error=True)
        check(unauthorized.returncode != 0 and "Reviewer not authorized" in unauthorized.stderr,
              "scoped_teacher_denied_administrative_rollback")
        check(pg.sql(db,"SELECT count(*) FROM public.nafes_scan_deletions;").stdout.strip()=="0",
              "unauthorized_rollback_leaves_no_audit_or_deletion")
        rollback_sql = ("SET ROLE service_role; SELECT public.nafes_scan_delete_corrections("
                        + args + f"'{fixtures.OWNER}','Synthetic QA rollback','{batch}');")
        rollback = pg.sql(db,rollback_sql,allow_error=True)
        evidence["probes"]["rollback_unpublished_sheet"] = {
            "completed":rollback.returncode==0,
            "error_first_line":rollback.stderr.splitlines()[0] if rollback.returncode else None}
        if rollback.returncode == 0:
            check(pg.sql(db,"SELECT count(*) FROM public.nafes_scan_deletions;").stdout.strip()=="1",
                  "unpublished_sheet_rollback_audit_preserved")
            check(pg.sql(db,"SELECT count(*) FROM public.nafes_scan_sheets;").stdout.strip()=="0",
                  "unpublished_sheet_rollback_removed_target_sheet")
            replay = pg.sql(db,rollback_sql,allow_error=True)
            check(replay.returncode==0 and '"replayed": true' in replay.stdout,
                  "unpublished_sheet_rollback_request_replay_detected")
            check(pg.sql(db,"SELECT count(*) FROM public.nafes_scan_deletions;").stdout.strip()=="1",
                  "unpublished_sheet_rollback_replay_does_not_duplicate_audit")
        else:
            check(pg.sql(db,"SELECT count(*) FROM public.nafes_scan_deletions;").stdout.strip()=="0",
                  "failed_unpublished_rollback_atomic_no_audit_insert")
            check(pg.sql(db,"SELECT count(*) FROM public.nafes_scan_sheets;").stdout.strip()=="1",
                  "failed_unpublished_rollback_atomic_sheet_preserved")
        evidence["native_version"] = pg.version
    evidence["passed"] = len(evidence["cases"])
    evidence["failed_assertions"] = 0
    out = ROOT / "qa/omr/results/dependencies-integration"
    out.mkdir(parents=True,exist_ok=True)
    (out/"evidence.json").write_text(json.dumps(evidence,ensure_ascii=False,indent=2))
    print(json.dumps(evidence,ensure_ascii=False,indent=2))


if __name__ == "__main__":
    run()
