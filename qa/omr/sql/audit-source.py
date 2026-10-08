"""Audit actual uploaded SQL metadata. Never connect to a database or invent tables."""
import hashlib
import json
import re
import sys
from pathlib import Path
from html import escape

source = Path(sys.argv[1])
metadata = json.loads(source.read_text())
if isinstance(metadata, list):
    metadata = metadata[0]
if "manual_review_source_metadata" in metadata:
    metadata = metadata["manual_review_source_metadata"]
    if isinstance(metadata, str):
        metadata = json.loads(metadata)
encoded = json.dumps(metadata)
if re.search(r"sb_secret_|eyJ[A-Za-z0-9_-]{10,}\.|postgres(?:ql)?://[^\s\"]+:[^\s\"]+@", encoded):
    raise SystemExit("Credential-like content detected; audit stopped without displaying values.")
tables = {t["name"]: t for t in metadata["tables"]}
functions = {f["name"]: f for f in metadata["scan_functions"]}
core = {"nafes_scan_sheets", "nafes_scan_sessions", "nafes_scan_answer_edits",
        "nafes_scan_identity_edits", "nafes_scan_alerts", "nafes_paper_reviews"}
missing = {}
for name, table in tables.items():
    for c in table.get("constraints") or []:
        target = c.get("referenced_relation")
        if target and target.replace('"', "").split(".")[-1] not in tables:
            missing.setdefault(target, []).append({"table": name, "constraint": c["name"],
                                                  "core_rpc_blocker": name in core})
defined = set(functions)
for t in tables.values():
    for trigger in t.get("triggers") or []:
        text = trigger.get("function_definition") or ""
        defined.update(re.findall(r"FUNCTION\s+public\.([a-z_]+)\s*\(", text, re.I))
trigger_callees = set()
for t in tables.values():
    for trigger in t.get("triggers") or []:
        trigger_callees.update(re.findall(r"perform\s+public\.([a-z_]+)\s*\(",
                                         trigger.get("function_definition") or "", re.I))
missing_helpers = sorted(trigger_callees - defined)
facts = [
    {"finding": "Manual edit has no incoming reason parameter",
     "evidence": functions["nafes_scan_edit_answer"]["identity_arguments"],
     "runtime_tested": False},
    {"finding": "Answer audit has no dedicated reason column; new reason is not written by the function",
     "evidence": [c["name"] for c in tables["nafes_scan_answer_edits"]["columns"]],
     "runtime_tested": False},
    {"finding": "Edit grading key is read from original snapshot, not the reassigned effective snapshot",
     "evidence": "(r.snapshot->'answers'->(p_question-1)->>'correct_index')::integer",
     "runtime_tested": False},
    {"finding": "Verify checks state=uncertain but not status=ambiguous or separated uncertainty reasons",
     "evidence": "exists(select 1 from jsonb_array_elements(effective->'answers') a where a->>'state'='uncertain')",
     "runtime_tested": False},
    {"finding": "Finish checks reviewed_at, not unresolved answer state or requires_rescan disposition",
     "evidence": "exists(select 1 from public.nafes_scan_sheets where session_id=s.id and reviewed_at is null)",
     "runtime_tested": False},
    {"finding": "Identity assigns the supplied effective_snapshot without enforcing unchanged bubble choices in SQL",
     "evidence": "effective_snapshot=p_effective",
     "runtime_tested": False},
]
# Only report statements actually found in this attachment; never fabricate findings.
edit = functions["nafes_scan_edit_answer"]
verify = functions["nafes_scan_verify"]["definition"]
finish = functions["nafes_scan_finish"]["definition"]
identity = functions["nafes_scan_assign_identity"]["definition"]
checks = [
    not re.search(r"\b\w*reason\w*\b", edit["identity_arguments"], re.I),
    not any("reason" in c["name"] for c in tables["nafes_scan_answer_edits"]["columns"])
        and not re.search(r"\b\w*reason\w*\b", edit["identity_arguments"], re.I),
    facts[2]["evidence"] in edit["definition"],
    facts[3]["evidence"] in verify and "'ambiguous'" not in verify and "'uncertainty'" not in verify,
    facts[4]["evidence"] in finish and "'uncertain'" not in finish and "'requires_rescan'" not in finish,
    facts[5]["evidence"] in identity and "'answers'" not in identity,
]
facts = [f for f, matches in zip(facts, checks) if matches]
out = {
    "source_file": str(source), "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "reported_postgres_version": metadata.get("postgres_version"),
    "table_count": len(tables), "function_count": len(metadata["scan_functions"]),
    "missing_fk_relations": missing, "missing_attempt_trigger_helpers": missing_helpers,
    "sql_tests_executed": 0, "sql_tests_passed": 0, "sql_tests_blocked": 4,
    "production_connected": False, "schema_stub_created": False,
    "core_blocker": "Original nafes_teacher_access DDL is required by scan/reviewer foreign keys.",
    "ancillary_note": "Attempt-only parent tables/helpers are additional dependencies for the whole seven-table import, not standalone scan RPC business logic.",
    "source_findings": facts,
}
folder = Path("qa/omr/results/sql")
folder.mkdir(parents=True, exist_ok=True)
(folder / "source-audit.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
body = f"""<!doctype html><html dir="rtl" lang="ar"><meta charset="utf-8">
<title>معلّمي — تدقيق مصدر SQL</title>
<style>body{{font:17px/1.8 Tahoma,Arial;max-width:1050px;margin:30px auto;padding:20px;color:#162b3b}}
pre{{direction:ltr;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;background:#f1f4f7;padding:18px}}
.notice{{padding:18px;background:#fff3da;border:2px solid #a96b00}}h1,h2{{line-height:1.4}}</style>
<h1>معلّمي — تدقيق تعريفات SQL الأصلية</h1>
<div class="notice">هذا تقرير اكتمال المصدر، لا تقرير نجاح اختبارات SQL.
0 اختبار SQL منفذ؛ الأربع معلّقة بسبب جدول المراجعين المرجعي المفقود.
لم تُحذف مفاتيح أجنبية، ولم تُنشأ جداول بديلة، ولم يحدث اتصال بالإنتاج.</div>
<p>المرفق يحتوي على {len(tables)} جداول و{len(functions)} وظائف. المانع المباشر لاختبارات المسح:
تعريف nafes_teacher_access وقيوده وتبعياته. توجد تبعيات إضافية لجدول المحاولات ومحفزاته
إذا أُعيد استيراد كامل الجداول السبعة.</p>
<h2>ملاحظات المصدر المؤكدة — لم تُقاس نتائجها أثناء التشغيل بعد</h2>
<ol>{"".join("<li>"+escape(x["finding"])+"</li>" for x in facts)}</ol>
<h2>استخراج النواقص</h2><p>تم تحديث qa/omr/export/manual-review-metadata-readonly.sql
ليتبع مفاتيح FK إلى الجداول المرجعية ويجمع المساعدين اللذين ظهرا في محفزات المحاولات.
الاستخراج بيانات تعريف فقط؛ لا صفوف طلاب أو درجات. التبعيات الإجرائية الإضافية
تُراجع بعد وصول المصدر ولا تُستبدل بتخمين.</p>
<h2>التفاصيل وبصمة المصدر</h2><pre>{escape(json.dumps(out,ensure_ascii=False,indent=2))}</pre></html>"""
(folder / "source-audit.html").write_text(body)
print(json.dumps({k: out[k] for k in ("table_count", "function_count", "missing_fk_relations",
                                     "missing_attempt_trigger_helpers", "sql_tests_blocked")},
                 ensure_ascii=False, indent=2))
