"""Save an explicitly non-deployable development snapshot and self-contained report."""
from pathlib import Path
import hashlib,html,json,zipfile

root=Path(__file__).resolve().parents[2]
release=root/"qa/omr/releases/2026-10-08-development"
release.mkdir(parents=True,exist_ok=True)
paths=[]
for folder in ["qa/omr/development/source","qa/omr/development/frontend"]:
    paths+=list((root/folder).glob("*"))
paths += [root/p for p in [
 "qa/omr/development/manual-review-repairs.sql","qa/omr/FINAL-DEVELOPMENT-REPORT.md",
 "qa/omr/results/integrated/batch-140.json","qa/omr/results/integrated/ui-evidence.json",
 "qa/omr/results/sql/sql-evidence.json"]]
manifest=dict(ready_to_publish=False,production_modified=False,source_basis="Uploaded nafes-exam deployed v128; not older GitHub source",
    missing_original_definitions=["nafes_scan_deletions","nafes_assessments","nafes_students","lugati_sync_sections_attempt","lugati_sync_student_worksheets"],
    excluded_from_production=["local-transport.js","integrated-server.ts","sql/preview.py","synthetic context and database"],
    regression_tests_passed=138,regression_tests_failed=0,
    files={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()})
(release/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
with zipfile.ZipFile(release/"development-source-and-evidence.zip","w",zipfile.ZIP_DEFLATED) as archive:
    for p in paths:
        if p.is_file(): archive.write(p,p.relative_to(root))
    archive.write(release/"manifest.json","manifest.json")
text=(root/"qa/omr/FINAL-DEVELOPMENT-REPORT.md").read_text()
report=f"""<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير معلّمي النهائي المحلي</title>
<style>body{{font-family:Tahoma,Arial,sans-serif;margin:24px auto;padding:24px;max-width:1100px;color:#173f3d;background:#f5f8f8}}
header,section{{background:white;padding:24px;border:1px solid #d6e3e1;border-radius:12px;margin-bottom:20px}}
h1{{font-size:28px}}.verdict{{color:#9b221d;font-size:24px;font-weight:bold}}
pre{{white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;line-height:1.9;font-size:15px}}
@media print{{body{{background:white;margin:0;padding:0}}header,section{{border:0}}pre{{font-size:12px}}}}</style>
<header>المملكة العربية السعودية · وزارة التعليم<br>الإدارة العامة للتعليم بمنطقة نجران · مدرسة ابن سينا المتوسطة
<h1>معلّمي — نتيجة الدمج والاختبارات المحلية</h1><p class="verdict">غير جاهز للنشر</p>
<p>138 اختبارًا ناجحًا · 140 ورقة اصطناعية · 8400 إجابة متطابقة · صفر تغيير إنتاجي</p>
<p>مسارا نشر المحاولات والتراجع الإيجابي محجوبان حتى اكتمال التعريفات الأصلية. لا يعني نجاح الحفظ اعتماد درجات حقيقية.</p></header>
<section><pre>{html.escape(text)}</pre></section></html>"""
(root/"qa/omr/results/integrated/report.html").write_text(report)
print("Development snapshot saved with SHA-256 manifest; ready_to_publish=false")
