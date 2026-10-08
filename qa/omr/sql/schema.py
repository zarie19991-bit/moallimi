"""Reconstruct the supplied catalog definitions, without guessing missing objects."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCAN_SOURCE = ROOT / "attached_assets/0_moallimi_omr_schema_metadata_reviewed_(1)_1791465393560.json"
TEACHER_SOURCE = ROOT / "attached_assets/nafes_teacher_access_schema_metadata_1791468833151.json"
CORE_NAMES = {
    "nafes_scan_sheets", "nafes_scan_sessions", "nafes_scan_answer_edits",
    "nafes_scan_identity_edits", "nafes_scan_alerts", "nafes_paper_reviews",
}
FUNCTIONS = {
    "nafes_scan_register", "nafes_scan_assign_identity", "nafes_scan_edit_answer",
    "nafes_scan_verify", "nafes_scan_verify_current", "nafes_scan_finish",
}


def ident(value):
    if not re.fullmatch(r"[a-z_][a-z0-9_]*", value):
        raise ValueError("Unexpected SQL identifier")
    return '"' + value + '"'


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def metadata():
    original = json.loads(SCAN_SOURCE.read_text())
    teacher = json.loads(TEACHER_SOURCE.read_text())
    assert teacher["database_relation"] == "public.nafes_teacher_access"
    assert teacher["kind"] == "table"
    assert teacher["contains_teacher_records"] is False
    assert teacher["contains_actual_key_hash_values"] is False
    assert teacher["user_triggers"] == []
    return original, teacher


def original_ddl():
    original, teacher = metadata()
    tables = [t for t in original["tables"] if t["name"] in CORE_NAMES]
    assert {t["name"] for t in tables} == CORE_NAMES
    actor = {
        "name": "nafes_teacher_access", "schema": "public",
        "columns": [{**c, "not_null": not c["nullable"]} for c in teacher["columns"]],
        "constraints": teacher["constraints"], "indexes": teacher["indexes"],
        "rls": teacher["row_level_security"]["enabled"],
        "force_rls": teacher["row_level_security"]["forced"],
    }
    tables.append(actor)
    definitions = []
    names = {t["name"] for t in tables}
    for t in tables:
        assert t["schema"] == "public"
        assert not t.get("triggers"), "New original trigger bodies must be reviewed, not skipped."
        columns = []
        for c in t["columns"]:
            assert not c.get("identity") and not c.get("generated")
            assert not c.get("default_withheld_for_review")
            entry = ident(c["name"]) + " " + c["type"]
            if c["not_null"]:
                entry += " NOT NULL"
            if c.get("default") is not None:
                entry += " DEFAULT " + c["default"]
            columns.append(entry)
        definitions.append(f'CREATE TABLE public.{ident(t["name"])} ({",".join(columns)});')
    foreign_keys = []
    for t in tables:
        for c in t["constraints"]:
            target = c.get("referenced_relation")
            if target:
                assert target.replace('"', "").split(".")[-1] in names, target
            statement = f'ALTER TABLE public.{ident(t["name"])} ADD CONSTRAINT {ident(c["name"])} {c["definition"]};'
            if c["definition"].startswith("FOREIGN KEY"):
                foreign_keys.append(statement)
            else:
                definitions.append(statement)
        constraint_names = {c["name"] for c in t["constraints"]}
        for index in t["indexes"]:
            match = re.search(r"INDEX (\w+) ON", index)
            assert match
            # PK/UNIQUE constraints have already created their exact backing indexes.
            if match[1] not in constraint_names:
                definitions.append(index + ";")
        if t["rls"]:
            definitions.append(f'ALTER TABLE public.{ident(t["name"])} ENABLE ROW LEVEL SECURITY;')
        if t["force_rls"]:
            definitions.append(f'ALTER TABLE public.{ident(t["name"])} FORCE ROW LEVEL SECURITY;')
        assert not t.get("policies"), "Unexpected scan policy: do not approximate it."
    definitions.extend(foreign_keys)
    for p in teacher["row_level_security"]["policies"]:
        definitions.append(
            f'CREATE POLICY {ident(p["name"])} ON public.nafes_teacher_access '
            f'FOR {p["command"]} TO {",".join(ident(r) for r in p["roles"])} '
            f'USING ({p["using"]}) WITH CHECK ({p["with_check"]});')
    assert teacher["owner"] == "postgres"
    assert teacher["acl"] == "{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}"
    definitions.extend([
        "REVOKE ALL ON public.nafes_teacher_access FROM PUBLIC,anon,authenticated;",
        "GRANT ALL ON public.nafes_teacher_access TO service_role;",
    ])
    bodies = {f["name"]: f for f in original["scan_functions"] if f["name"] in FUNCTIONS}
    assert set(bodies) == FUNCTIONS
    for f in bodies.values():
        assert not f["definition_withheld_for_review"]
        assert not re.search(r"https?://|dblink|net\.|pg_(?:read|write)_file|COPY.*PROGRAM",
                             f["definition"], re.I | re.S)
        definitions.append(f["definition"] + ";")
    return "\n".join(definitions), bodies
