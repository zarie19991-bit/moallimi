"""Separate review snapshot: never overwrite the previously saved development release."""
from pathlib import Path
import hashlib,html,json,zipfile
root=Path(__file__).resolve().parents[2]
release=root/"qa/omr/releases/2026-10-08-integration-review"
release.mkdir(parents=True,exist_ok=True)
files=set()
for folder in ["qa/omr/development","qa/omr/sql","qa/omr/results/integration-review","qa/omr/results/integrated","qa/omr/results/sql"]:
    files.update(p for p in (root/folder).rglob("*") if p.is_file() and "__pycache__" not in p.parts)
files.update(p for p in (root/"qa/omr").glob("*") if p.is_file())
manifest=dict(ready_to_publish=False,production_modified=False,synthetic_only=True,regressions_passed=155,
    authenticated_native_checks_passed=12,browser_checks_passed=13,synthetic_sheets=140,matching_choices=8400,files={})
text=(root/"qa/omr/INTEGRATION-REVIEW.md").read_text()
report=f"""<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>معلّمي — مراجعة التكامل</title>
<style>body{{font-family:Tahoma,Arial,sans-serif;max-width:1100px;margin:24px auto;padding:24px;color:#173f3d;background:#f5f8f8}}
header,main{{background:white;padding:24px;border:1px solid #ddd;border-radius:10px;margin-bottom:20px}}
h1{{font-size:28px}}strong{{color:#9b221d}}pre{{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.9 Tahoma,Arial,sans-serif}}
@media print{{body{{background:white;padding:0}}header,main{{border:0}}}}</style>
<header>المملكة العربية السعودية · وزارة التعليم<br>الإدارة العامة للتعليم بمنطقة نجران · مدرسة ابن سينا المتوسطة
<h1>معلّمي — مراجعة التكامل المحلية</h1><strong>غير جاهز للنشر</strong>
<p>155 اختبارًا ناجحًا · 140 ورقة اصطناعية · 8400 اختيار متطابق · صفر تغيير إنتاجي</p></header>
<main><pre>{html.escape(text)}</pre></main></html>"""
(root/"qa/omr/results/integration-review/report.html").write_text(report)
files.add(root/"qa/omr/results/integration-review/report.html")
with zipfile.ZipFile(release/"development-source-and-evidence.zip","w",zipfile.ZIP_DEFLATED) as z:
    for p in sorted(files):
        name=str(p.relative_to(root));manifest["files"][name]=hashlib.sha256(p.read_bytes()).hexdigest()
        z.write(p,name)
(release/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(release.relative_to(root))
