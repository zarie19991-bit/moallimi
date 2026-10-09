"""Private catalog input; public evidence contains names/results, never definitions.

Run with OMR_PRIVATE_CATALOG pointing to the decrypted JSON in /tmp.
No connection settings are inherited; only LocalPostgres's private socket is used.
"""
import hashlib
import json
import os
import re
from pathlib import Path

from runtime import LocalPostgres
from schema import ROOT, SCAN_SOURCE, ident, literal


def table_ddl(t):
    columns = []
    for c in t["columns"]:
        assert not c.get("identity") and not c.get("generated")
        column = ident(c["name"]) + " " + c["type"]
        if c["not_null"]:
            column += " NOT NULL"
        if c.get("default") is not None:
            column += " DEFAULT " + c["default"]
        columns.append(column)
    statements = [f'CREATE TABLE public.{ident(t["name"])} ({",".join(columns)});']
    for c in t["constraints"]:
        statements.append(
            f'ALTER TABLE public.{ident(t["name"])} ADD CONSTRAINT '
            f'{ident(c["name"])} {c["definition"]};')
    constraints = {c["name"] for c in t["constraints"]}
    for index in t["indexes"]:
        match = re.search(r"INDEX (\w+) ON", index)
        assert match
        if match[1] not in constraints:
            statements.append(index + ";")
    if t["rls"]:
        statements.append(f'ALTER TABLE public.{ident(t["name"])} ENABLE ROW LEVEL SECURITY;')
    if t["force_rls"]:
        statements.append(f'ALTER TABLE public.{ident(t["name"])} FORCE ROW LEVEL SECURITY;')
    statements.append(f'REVOKE ALL ON public.{ident(t["name"])} FROM PUBLIC,anon,authenticated,service_role;')
    # No guessed grants: translate the catalog's supplied ACL literally.
    privileges = {"a": "INSERT", "r": "SELECT", "w": "UPDATE", "d": "DELETE",
                  "D": "TRUNCATE", "x": "REFERENCES", "t": "TRIGGER", "m": "MAINTAIN"}
    for entry in t["acl"].strip("{}").split(","):
        role, rights = entry.split("=", 1)
        rights = rights.split("/", 1)[0]
        assert "*" not in rights and role in {"postgres", "service_role", "authenticated", "anon"}
        statements.append(f'GRANT {",".join(privileges[r] for r in rights)} '
                          f'ON public.{ident(t["name"])} TO {ident(role)};')
    for p in t["policies"]:
        q = (f'CREATE POLICY {ident(p["name"])} ON public.{ident(t["name"])} '
             f'FOR {p["cmd"]} TO {",".join(ident(r) for r in p["roles"])}')
        if p["using"] is not None:
            q += f' USING ({p["using"]})'
        if p["check"] is not None:
            q += f' WITH CHECK ({p["check"]})'
        statements.append(q + ";")
    return "\n".join(statements)


def run():
    path = Path(os.environ["OMR_PRIVATE_CATALOG"]).resolve()
    assert str(path).startswith("/tmp/"), "Decrypted catalogs must remain outside the repository."
    catalog = json.loads(path.read_text())
    assert isinstance(catalog["tables"], list) and isinstance(catalog["functions"], list)
    tables = {t["name"]: t for t in catalog["tables"]}
    functions = {f["name"]: f["definition"] for f in catalog["functions"]}
    original = json.loads(SCAN_SOURCE.read_text())
    # These bodies were supplied in the earlier original metadata; no migration substitutes.
    for t in original["tables"]:
        for trigger in t.get("triggers") or []:
            if trigger.get("function_definition"):
                body = trigger["function_definition"]
                name = re.search(r"FUNCTION public\.(\w+)", body)[1]
                functions.setdefault(name, body)
    trigger_callees = set()
    fk_missing = set()
    for t in tables.values():
        trigger_callees.update(re.findall(
            r"EXECUTE FUNCTION (?:public\.)?(\w+)", "\n".join(t["triggers"])))
        for c in t["constraints"]:
            for relation in re.findall(r"REFERENCES\s+([\w.]+)", c["definition"]):
                if relation.replace("public.", "") not in tables:
                    fk_missing.add(relation)
    # Explicit schema-qualified procedural dependencies, plus trigger callees.
    bodies = "\n".join(functions.values())
    referenced = set(re.findall(r"(?:from|join|into|update)\s+public\.(\w+)", bodies, re.I))
    callees = set(re.findall(r"(?:perform|:=)\s+public\.(\w+)\s*\(", bodies, re.I))
    callees.update(re.findall(r":=\s*public\.(\w+)\s*\(", bodies))
    missing_functions = sorted((trigger_callees | callees) - functions.keys())
    missing_tables = sorted((referenced - tables.keys()) | fk_missing)
    evidence = {
        "catalog_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "catalog_tables": sorted(tables), "catalog_functions": sorted(
            f["name"] for f in catalog["functions"]),
        "missing_original_relations": missing_tables,
        "missing_original_functions": missing_functions,
        "function_acl_not_in_bundle": True,
        "synthetic_only": True, "production_connected": False,
        "publication_positive_tested": False, "rollback_positive_tested": False,
        "supabase_transport_tested": False, "ready_to_publish": False, "cases": [],
    }
    for body in functions.values():
        assert not re.search(r"https?://|dblink|net\.|pg_(?:read|write)_file|COPY.*PROGRAM",
                             body, re.I | re.S), "Unsafe local function definition."
    with LocalPostgres() as pg:
        pg.sql("postgres", "CREATE DATABASE omr_original")
        db = "omr_original"
        # This closed slice has every original FK, trigger, policy and grant.
        for name in ["nafes_teacher_access", "nafes_assessments", "nafes_scan_deletions"]:
            pg.sql(db, table_ddl(tables[name]))
        for name in ["nafes_preserve_published_test", "nafes_enforce_teacher_subject_scope"]:
            pg.sql(db, functions[name])
        for trigger in tables["nafes_assessments"]["triggers"]:
            pg.sql(db, trigger + ";")
        owner = "11111111-1111-4111-8111-111111111111"
        assessment = "22222222-2222-4222-8222-222222222222"
        pg.sql(db, f"INSERT INTO public.nafes_teacher_access(id,key_hash,subject_scope) "
                   f"VALUES('{owner}',repeat('1',64),'reading');")
        def case(name, sql, expected_error=None, expected_result=None):
            result = pg.sql(db, "BEGIN; SET LOCAL ROLE service_role;" + sql + "; ROLLBACK;",
                            allow_error=True)
            passed = (result.returncode == 0 if not expected_error else
                      result.returncode != 0 and expected_error in result.stderr)
            if expected_result is not None:
                passed = passed and expected_result in result.stdout.strip().splitlines()
            evidence["cases"].append({"name": name, "passed": passed,
                                      "expected_error": expected_error})
        base = (f"INSERT INTO public.nafes_assessments(id,owner_id,kind,title,config) "
                f"VALUES('{assessment}','{owner}','indicator','Synthetic QA',")
        case("scoped_teacher_original_trigger_allows_reading",
             base + """'{"sections":[{"subject":"reading"}]}'::jsonb)""")
        case("scoped_teacher_original_trigger_rejects_math",
             base + """'{"sections":[{"subject":"math"}]}'::jsonb)""",
             "teacher_subject_scope_violation")
        case("inactive_teacher_original_trigger_rejects",
             f"UPDATE public.nafes_teacher_access SET active=false WHERE id='{owner}';"
             + base + """'{"sections":[{"subject":"reading"}]}'::jsonb)""",
             "teacher_scope_missing")
        case("original_assessment_owner_fk_enforced",
             "INSERT INTO public.nafes_scan_deletions(batch_id,review_pk,session_id,sheet_id,reviewer_id,reason)"
             " VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),"
             "gen_random_uuid(),'Synthetic reason')", "foreign key constraint")
        case("published_assessment_content_immutable",
             base + """'{"sections":[{"subject":"reading"}]}'::jsonb);"""
             + f"UPDATE public.nafes_assessments SET status='published' WHERE id='{assessment}';"
             + f"UPDATE public.nafes_assessments SET title='Changed' WHERE id='{assessment}'",
             "Published tests are immutable")
        case("published_assessment_can_be_archived",
             base + """'{"sections":[{"subject":"reading"}]}'::jsonb);"""
             + f"UPDATE public.nafes_assessments SET status='published' WHERE id='{assessment}';"
             + f"UPDATE public.nafes_assessments SET status='archived' WHERE id='{assessment}'")
        insert_audit = ("INSERT INTO public.nafes_scan_deletions"
                        "(batch_id,review_pk,session_id,sheet_id,reviewer_id,reason)"
                        " VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),"
                        f"'{owner}','Synthetic rollback reason')")
        case("service_role_can_insert_original_deletion_audit", insert_audit)
        case("service_role_cannot_update_original_deletion_audit",
             insert_audit + "; UPDATE public.nafes_scan_deletions SET reason='Changed'",
             "permission denied")
        case("service_role_cannot_delete_original_deletion_audit",
             insert_audit + "; DELETE FROM public.nafes_scan_deletions", "permission denied")
        case("anon_original_table_access_denied",
             "SET LOCAL ROLE anon; SELECT * FROM public.nafes_assessments", "permission denied")
        case("authenticated_original_table_access_denied",
             "SET LOCAL ROLE authenticated; SELECT * FROM public.nafes_assessments", "permission denied")
        case("native_original_rls_enabled",
             "SELECT count(*) FROM pg_class WHERE relname IN "
             "('nafes_teacher_access','nafes_assessments','nafes_scan_deletions') AND relrowsecurity",
             expected_result="3")
        # Install the exact supplied student trigger first. Its actual execution
        # identifies the missing callee, without stubbing it or disabling it.
        pg.sql(db, table_ddl(tables["nafes_students"]))
        for name in ["nafes_sync_student_name_normalized", "nafes_set_updated_at",
                     "nafes_log_student_analysis_exclusion", "nafes_log_student_demo_exclusion"]:
            pg.sql(db, functions[name])
        for trigger in tables["nafes_students"]["triggers"]:
            pg.sql(db, trigger + ";")
        result = pg.sql(db, "BEGIN; SET LOCAL ROLE service_role; "
                           "INSERT INTO public.nafes_students(full_name,name_normalized,national_id_last3)"
                           " VALUES('Synthetic QA','synthetic qa','123'); ROLLBACK;", allow_error=True)
        evidence["original_student_insert_probe"] = {
            "completed": False,
            "sqlstate_class": "undefined_function" if "does not exist" in result.stderr else "other",
            "missing_callee_confirmed": "nafes_normalize_arabic(text)" in result.stderr,
        }
        assert result.returncode != 0 and "nafes_normalize_arabic(text)" in result.stderr
        evidence["native_version"] = pg.version
        evidence["listen_addresses"] = ""
    evidence["passed"] = sum(c["passed"] for c in evidence["cases"])
    evidence["failed"] = sum(not c["passed"] for c in evidence["cases"])
    output = ROOT / "qa/omr/results/catalog-integration"
    output.mkdir(parents=True, exist_ok=True)
    (output / "evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
    print(json.dumps({k: evidence[k] for k in [
        "passed", "failed", "missing_original_relations", "missing_original_functions",
        "original_student_insert_probe", "ready_to_publish"]}, ensure_ascii=False, indent=2))
    if evidence["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    run()
