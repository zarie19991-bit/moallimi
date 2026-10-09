"""Exporter contract tests, not attempt-publication acceptance tests.

All tables/functions below are synthetic fixtures for catalog traversal.
They are not replacements for original Supabase objects.
"""
import hashlib
import json
from pathlib import Path
from runtime import LocalPostgres
from schema import ROOT


def run():
    query = (ROOT / "qa/omr/export/manual-review-metadata-readonly.sql").read_text()
    checks = []
    def check(condition, name):
        assert condition, name
        checks.append(name)
    with LocalPostgres() as pg:
        pg.sql("postgres", "CREATE DATABASE omr_original")
        db = "omr_original"
        pg.sql(db, """
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, encrypted_password text);
CREATE TABLE public.moallimi_classes(id uuid PRIMARY KEY, owner_id uuid REFERENCES auth.users(id));
CREATE TABLE public.nafes_analysis_exclusion_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY);
CREATE TYPE public.qa_export_state AS ENUM ('pending','reviewed');
CREATE DOMAIN public.qa_export_percent AS numeric CHECK(VALUE BETWEEN 0 AND 100);
CREATE TABLE public.nafes_scan_sheets(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 owner_id uuid REFERENCES auth.users(id),
 class_id uuid REFERENCES public.moallimi_classes(id),
 state public.qa_export_state DEFAULT 'pending',
 percent public.qa_export_percent,
 secret_default text DEFAULT 'sb_secret_SYNTHETIC_DO_NOT_EXPORT',
 image_data text
);
CREATE TABLE public.qa_export_dependency(id integer PRIMARY KEY);
CREATE FUNCTION public.qa_export_leaf() RETURNS integer LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Must never invoke this business function'; END $$;
CREATE FUNCTION public.nafes_normalize_arabic(text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN PERFORM public.qa_export_leaf(); PERFORM id FROM public.qa_export_dependency; RETURN $1; END $$;
CREATE FUNCTION public.lugati_require_source_for_auto_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RETURN new; END $$;
CREATE FUNCTION public.lugati_exam_adaptive_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RETURN new; END $$;
CREATE FUNCTION public.lugati_simulation_adaptive_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RETURN new; END $$;
CREATE FUNCTION public.nafes_standard_question_quality_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RETURN new; END $$;
CREATE FUNCTION public.qa_export_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM public.nafes_normalize_arabic('synthetic'); RETURN new; END $$;
CREATE TRIGGER qa_catalog_trigger BEFORE INSERT ON public.moallimi_classes
 FOR EACH ROW EXECUTE FUNCTION public.qa_export_trigger();
CREATE FUNCTION public.qa_export_sensitive() RETURNS text LANGUAGE sql AS $$
SELECT 'sb_secret_SYNTHETIC_DO_NOT_EXPORT'
$$;
CREATE FUNCTION public.nafes_scan_export_root() RETURNS text LANGUAGE plpgsql AS $$
BEGIN RETURN public.qa_export_sensitive(); END $$;
REVOKE ALL ON FUNCTION public.nafes_normalize_arabic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nafes_normalize_arabic(text) TO service_role;
ALTER TABLE public.nafes_scan_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY qa_access ON public.nafes_scan_sheets FOR SELECT TO authenticated USING(false);
GRANT SELECT ON public.nafes_scan_sheets TO service_role;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT USAGE ON SEQUENCE public.nafes_scan_sheets_id_seq TO service_role;
INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111','REAL_ROWS_MUST_NOT_APPEAR');
INSERT INTO public.nafes_scan_sheets(owner_id,image_data)
 VALUES('11111111-1111-4111-8111-111111111111','REAL_ROWS_MUST_NOT_APPEAR');
""")
        original_nine = [
            "lugati_sync_sections_attempt", "lugati_sync_student_worksheets",
            "lugati_upsert_adaptive_assignment", "nafes_enforce_teacher_subject_scope",
            "nafes_log_student_analysis_exclusion", "nafes_log_student_demo_exclusion",
            "nafes_preserve_published_test", "nafes_set_updated_at",
            "nafes_sync_student_name_normalized",
        ]
        for name in original_nine:
            pg.sql(db, f"CREATE FUNCTION public.{name}() RETURNS integer LANGUAGE sql AS $$SELECT 1$$;"
                       f"REVOKE ALL ON FUNCTION public.{name}() FROM PUBLIC;"
                       f"GRANT EXECUTE ON FUNCTION public.{name}() TO service_role;")
        for name in ["nafes_scan_sessions", "nafes_scan_answer_edits",
                     "nafes_scan_identity_edits", "nafes_scan_alerts", "nafes_paper_reviews"]:
            pg.sql(db, f"CREATE TABLE public.{name}(id integer PRIMARY KEY);"
                       f"GRANT SELECT ON public.{name} TO service_role;")
        pg.sql(db, """
ALTER TABLE public.qa_export_dependency ADD CONSTRAINT secret_literal_check
 CHECK(id::text <> 'sb_secret_SYNTHETIC_DO_NOT_EXPORT');
CREATE POLICY withheld_policy ON public.nafes_scan_sheets FOR SELECT TO anon
 USING(image_data <> 'sb_secret_SYNTHETIC_DO_NOT_EXPORT');
""")
        # Original exporter was absent from the seeded row's execution path.
        response = pg.sql(db, "BEGIN READ ONLY;\n" + query + "\nROLLBACK;").stdout
        result = json.loads(next(line for line in response.splitlines() if line.startswith("{")))
        check(result["metadata_only"], "single_select_runs_in_read_only_transaction")
        check("REAL_ROWS_MUST_NOT_APPEAR" not in json.dumps(result), "no_user_row_values_exported")
        check("sb_secret_SYNTHETIC_DO_NOT_EXPORT" not in json.dumps(result), "secret_marker_values_withheld")
        tables = {(t["schema"], t["name"]): t for t in result["tables"]}
        functions = {(f["schema"], f["name"]): f for f in result["scan_functions"]}
        for key in [("auth","users"),("public","moallimi_classes"),("public","nafes_analysis_exclusion_audit")]:
            check(key in tables, "explicit_relation_" + ".".join(key))
        check(("public","qa_export_dependency") in tables, "procedural_relation_dependency_exported")
        check(("public","qa_export_leaf") in functions, "recursive_procedural_function_dependency_exported")
        check(("public","qa_export_trigger") in functions, "parent_relation_trigger_function_and_acl_exported")
        for name in ["nafes_normalize_arabic","lugati_require_source_for_auto_assignment",
                     "lugati_exam_adaptive_trigger","lugati_simulation_adaptive_trigger",
                     "nafes_standard_question_quality_guard"]:
            check(("public",name) in functions, "explicit_function_" + name)
        f = functions[("public","nafes_normalize_arabic")]
        check(any(a["grantee"]=="service_role" and a["privilege"]=="EXECUTE"
                  for a in f["effective_acl"]), "function_service_execute_acl")
        check(not any(a["grantee"]=="PUBLIC" for a in f["effective_acl"]), "function_public_revocation_preserved")
        leaf = functions[("public","qa_export_leaf")]
        check(any(a["grantee"]=="PUBLIC" for a in leaf["effective_acl"]), "null_acl_default_expanded")
        check(functions[("public","qa_export_sensitive")]["definition"] is None,
              "sensitive_function_definition_withheld")
        check(len(result["withheld_objects"])>0, "withheld_objects_reported")
        sheet = tables[("public","nafes_scan_sheets")]
        check(sheet["rls"] and len(sheet["policies"])==1, "rls_and_safe_policies_exported")
        check(sheet["policies_withheld_for_review"]==1, "sensitive_policy_flagged_without_value")
        check(any(c["definition_withheld_for_review"] for c in
                  tables[("public","qa_export_dependency")]["constraints"]),
              "sensitive_constraint_flagged_without_value")
        check(any(c["definition"].startswith("FOREIGN KEY") for c in sheet["constraints"]), "fk_definitions_exported")
        check(any(c["identity"]=="a" for c in sheet["columns"]), "identity_column_exported")
        check(any(c["default_withheld_for_review"] for c in sheet["columns"]), "sensitive_default_flag")
        check(any(a["grantee"]=="service_role" and a["privilege"]=="SELECT"
                  for a in sheet["effective_acl"]), "table_acl_exported")
        check(any(s["name"]=="auth" and any(a["grantee"]=="service_role" and a["privilege"]=="USAGE"
                  for a in s["effective_acl"]) for s in result["schemas"]), "schema_acl_exported")
        check(any(s["name"]=="nafes_scan_sheets_id_seq" and s["owned_by"] and
                  any(a["grantee"]=="service_role" and a["privilege"]=="USAGE" for a in s["effective_acl"])
                  for s in result["owned_sequences"]), "sequence_definition_ownership_and_acl_exported")
        check(not result["sequence_current_values_included"], "sequence_live_counter_not_exported")
        check(any(t["name"]=="qa_export_state" for t in result["column_enums"]), "enum_dependency_exported")
        check(any(t["name"]=="qa_export_percent" for t in result["domain_types"]), "domain_dependency_exported")
        check("public.nafes_assessment_attempts" in result["missing_requested_tables"], "missing_relations_reported")
        check("nafes_teacher_attempt_page" in result["missing_requested_functions"], "missing_functions_reported")
        for name in original_nine:
            check(any(a["grantee"]=="service_role" and a["privilege"]=="EXECUTE"
                      for a in functions[("public",name)]["effective_acl"]),
                  "original_nine_function_acl_" + name)
        for name in ["nafes_scan_sheets", "nafes_scan_sessions", "nafes_scan_answer_edits",
                     "nafes_scan_identity_edits", "nafes_scan_alerts", "nafes_paper_reviews"]:
            check(any(a["grantee"]=="service_role" for a in tables[("public",name)]["effective_acl"]),
                  "scan_core_acl_" + name)
        check(pg.sql(db,"SELECT count(*) FROM public.nafes_scan_sheets;").stdout.strip()=="1",
              "synthetic_rows_unchanged")
    out = ROOT / "qa/omr/results/source-closure/export-v2-check.json"
    out.write_text(json.dumps({
        "passed":len(checks),"failed":0,"checks":checks,
        "query_sha256":hashlib.sha256(query.encode()).hexdigest(),
        "synthetic_only":True,"production_connected":False,
        "attempt_publication_tested":False,"administrative_rollback_tested":False,
        "fixture_definitions_are_not_production_replacements":True,
    },indent=2))
    print(f"{len(checks)} exporter contract checks passed; no production connection.")


if __name__=="__main__":
    run()
