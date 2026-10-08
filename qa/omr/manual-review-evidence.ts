import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {scan as original,developmentScan as repaired} from "./source";
import {manualReviewFixture,requestFor,inspectBoundary} from "./manual-review-fixture";
import {syntheticSheet} from "./fixtures";

const names=["omr","development","regressions","historical-state","classification","manual-review-boundary","manual-reprocess","sql-review"];
const files=names.map(n=>`qa/omr/${n}.test.ts`);
const run=spawnSync("bun",["test","--timeout","180000",...files],{encoding:"utf8",timeout:240000,maxBuffer:4_000_000});
const log=run.stdout+run.stderr;console.log(log);
if(run.status!==0||!/\b0 fail\b/.test(log))throw new Error("Verification failed; no successful report generated.");
const rows:any[]=[];
for(const mode of ["ambiguous","uncertain"]){
 const before=await inspectBoundary(original,manualReviewFixture(mode),"teacher_scan_verify");
 const after=await inspectBoundary(repaired,manualReviewFixture(mode),"teacher_scan_verify");
 rows.push({test:`verified / ${mode}`,before:before.rpc_reached?"يمرّر الطلب إلى SQL؛ النتيجة الداخلية غير مختبرة":"محجوب",
   after:after.rpc_reached?"يمرّر الطلب":"محجوب قبل SQL",scope:"حماية Edge مثبتة؛ تنفيذ SQL غير مختبر"});
}
for(const [label,engine] of [["original",original],["repair",repaired]] as const){
 const m=manualReviewFixture("uncertain");await inspectBoundary(engine,m,"teacher_scan_assign_identity");
 const a=m.calls[0].args.p_effective.answers[0];
 rows.push({test:"identity / uncertain",source:label,state:a.state,selected:a.selected,marked:a.marked,correct:a.correct,
   review_pending:a.review_pending===true,scope:"اللقطة المرسلة فقط؛ التخزين غير مختبر"});
 const edit=manualReviewFixture("ambiguous");await inspectBoundary(engine,edit,"teacher_scan_edit_answer");
 rows.push({test:"edit / reason",source:label,reason_forwarded:Object.keys(edit.calls[0].args).some(k=>/reason/i.test(k)),
    scope:"فحص عقد Edge فقط؛ أدلة SQL الحقيقية في القسم المنفصل"});
 const batch=await inspectBoundary(engine,manualReviewFixture("uncertain"),"teacher_scan_finish");
 rows.push({test:"finish / uncertain",source:label,rpc_reached:batch.rpc_reached,scope:"SQL غير منفذ"});
 const rr=manualReviewFixture();rr.row.image_data=syntheticSheet({marks:[{row:0,option:2}]});
 rr.row.snapshot.answers[0].reviewed_manually=true;rr.row.snapshot.answers[0].manual_reason="synthetic review";
 const result=await engine.handlePaperScan(rr.db,requestFor(rr,"teacher_scan_reprocess_server"),rr.owner);
 rows.push({test:"reprocess / human review",source:label,selected:rr.row.effective_snapshot.answers[0].selected,
   manual_reason:rr.row.effective_snapshot.answers[0].manual_reason??null,reviewed_at:rr.row.reviewed_at,
   proposal_only:result.proposal_only===true,scope:"تحديث كائنات JavaScript فقط؛ المحفزات SQL غير مختبرة"});
}
const sqlEvidence=JSON.parse(readFileSync("qa/omr/results/sql/sql-evidence.json","utf8"));
const originalSql=sqlEvidence.cases.filter((r:any)=>r.database==="omr_original");
const repairedSql=sqlEvidence.cases.filter((r:any)=>r.database==="omr_repaired");
const groups=["الحفظ وسجل التعديل وسببه","منع اعتماد غير المحسوم وفحص الإصدار","إنهاء الدفعة والهوية وإعادة المعالجة","التكرار والاعتماد المتزامن"];
const stats=(cases:any[])=>({passed:cases.filter(r=>r.passed).length,failed:cases.filter(r=>!r.passed).length,total:cases.length});
const groupStats=groups.map((name,i)=>({name,before:stats(originalSql.filter((r:any)=>r.group===i+1)),after:stats(repairedSql.filter((r:any)=>r.group===i+1))}));
if(repairedSql.length===0||repairedSql.some((r:any)=>!r.passed))throw Error("No complete passing SQL evidence.");
const evidence={
 synthetic_only:true,real_student_data_used:false,historical_snapshots_used:false,
  production_connected:false,sql_executed:true,sql_database_created:true,sql_server_stopped_after_tests:true,
 local_sql_database_permission:true,
 source_sha256:createHash("sha256").update(readFileSync("qa/omr/development/source/paper-scan.ts")).digest("hex"),
 validation:{passed:Number(log.match(/(\d+) pass\b/)?.[1]),failed:0,todo:Number(log.match(/(\d+) todo\b/)?.[1]||0),files},
  sql_repair_sha256:createHash("sha256").update(readFileSync("qa/omr/development/manual-review-repairs.sql")).digest("hex"),
  rows,sql:sqlEvidence,sql_summary:{before:stats(originalSql),after:stats(repairedSql),groups:groupStats},
 blockers:[
    "This is a development-only repair; Supabase/PostgREST transport and production scan-table grants are not validated.",
    "Teacher UI must collect and send the required reason before any coordinated rollout of the new eight-argument edit contract.",
    "Assessment-attempt/adaptive-trigger integration is outside these four scan tests; parent/helper definitions are still incomplete for that path.",
    "Administrative correction deletion/rollback must be checked against the new session-close guard before any deployment.",
    "Real historical paper readings and grades have not been approved by these synthetic SQL tests.",
 ],
  missing_tables_for_four_sql_groups:[],
  rpc_names_sql_tested:[
   "nafes_scan_register","nafes_scan_assign_identity","nafes_scan_edit_answer",
    "nafes_scan_verify_current","nafes_scan_verify","nafes_scan_finish",
 ],
};
const escape=(s:any)=>String(s??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>معلّمي — اختبارات الحفظ والمراجعة</title>
<style>body{font:17px/1.8 Tahoma,Arial,sans-serif;margin:32px auto;padding:0 24px;max-width:1100px;color:#17212f}h1,h2{line-height:1.4}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #a5afbb;padding:10px;vertical-align:top}th{background:#edf2f7}.notice{padding:16px;border:2px solid #b76b00;background:#fff7e6}pre{direction:ltr;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;background:#f1f4f8;padding:16px}@media print{body{margin:0;font-size:12pt}thead{display:table-header-group}tr{break-inside:avoid}pre{font-size:9pt}}</style>
<h1>معلّمي — حفظ أوراق التظليل والمراجعة اليدوية</h1>
<p><strong>${evidence.validation.passed} اختبارًا ناجحًا، 0 فشل، ${evidence.validation.todo} اختبارات SQL معلّقة.</strong> جميع البيانات اصطناعية.</p>
<div class="notice">أُغلقت مجموعات SQL الأربع باختبارات PostgreSQL 17.6 حقيقية، على اتصال Unix محلي فقط ببيانات اصطناعية.
النسخة الأصلية: ${stats(originalSql).passed} نجاح و${stats(originalSql).failed} إخفاق؛ الإصلاح: ${stats(repairedSql).passed} نجاح و0 إخفاق.
احتُفظ بقيود المخطط الأصلية، ولم تُستخدم جداول بديلة. اختبارات JavaScript المنفصلة لا تُحسب دليل SQL.
لم يحدث اتصال بالإنتاج أو نشر. هذه ليست موافقة على درجات الطلاب أو إعلان جاهزية النشر.</div>
<h2>نتائج مجموعات SQL الأربع</h2><table><tr><th>المجموعة</th><th>قبل الإصلاح: نجاح / إخفاق</th><th>بعد الإصلاح</th></tr>
${groupStats.map(g=>`<tr><td>${g.name}</td><td>${g.before.passed} / ${g.before.failed}</td><td>${g.after.passed} / ${g.after.total} ناجح</td></tr>`).join("")}</table>
<h2>قبل الإصلاح وبعده</h2><table><thead><tr><th>الحالة</th><th>المصدر الأصلي المرفوع</th><th>الإصلاح المحلي</th></tr></thead><tbody>
<tr><td>التحقق من ورقة ambiguous أو uncertain</td><td>يسجل reviewed_at مع requires_rescan للحالة uncertain؛ وقد يصنف حالة legacy ذات status=ambiguous وstate=correct بأنها verified</td><td>يرفض الحالات غير المحسومة في Edge وSQL، بلا تغيير الإجابات أو علامات المراجعة</td></tr>
<tr><td>تغيير الهوية لإجابة uncertain ذات قراءة clear</td><td>يعيد تصنيفها correct عند تطابق المفتاح</td><td>يحتفظ بالاختيار والتظليل، ويُبقي state=uncertain وcorrect=false حتى مراجعة صريحة</td></tr>
<tr><td>إعادة قراءة تتعارض مع تعديل بشري</td><td>يستبدل الإجابات ويمحو علامات المراجعة</td><td>يحفظ الإجابات والسبب والعلامات؛ القراءة الجديدة اقتراح غير مطبق</td></tr>
<tr><td>إنهاء دفعة غير محسومة / حذف ورقة معلقة من النتائج ضمنيًا</td><td>SQL يسمح بالإكمال إذا كانت reviewed_at موجودة حتى مع requires_rescan؛ تجهيز النتائج قد يتجاهل غير verified</td><td>يرفض الإنهاء والتجهيز ما دامت ورقة غير محجوبة من التكرار تحتاج حسمًا أو تحققًا</td></tr>
<tr><td>سبب التعديل</td><td>توقيع التعديل الأصلي ذو 7 معاملات لا يستقبل السبب؛ الحفظ يؤكد اختيارًا دون سبب</td><td>توسعة محلية صريحة إلى 8 معاملات بإضافة p_reason؛ رفض التوقيع القديم، وتسجيل السبب في after_answer.manual_reason مع قبل/بعد والإصدار</td></tr>
<tr><td>مفتاح النموذج</td><td>يستخدم snapshot الأصلي حتى بعد تغير النموذج الفعال</td><td>يستخدم correct_index الحالي في اللقطة الفعالة</td></tr>
<tr><td>التزامن عبر جلستين عند تعيين الهوية</td><td>يمكن للجلستين تعيين الطالب نفسه قبل ظهور تحديث الأخرى</td><td>قفل سجل المراجعة المشتركة؛ قبول طلب واحد ورفض الآخر</td></tr>
<tr><td>الإغلاق وإعادة المعالجة</td><td>يمكن تحديث إجابات مراجعة أو إعادة فتح الجلسة بعد الإنهاء</td><td>محفزان محليان جديدان لحماية المراجعة والإغلاق؛ رفض التعديل المتأخر، والسماح باقتراح قراءة لا يغير الإجابات</td></tr>
</tbody></table>
<h2>حدود النتيجة والعوائق المتبقية</h2><ul><li>هذه اختبارات منطق SQL بصلاحية خلفية مرتفعة؛ لا تثبت إعدادات صلاحيات الإنتاج أو النقل عبر PostgREST.</li>
<li>يجب إضافة إدخال سبب التعديل للمعلم وتنسيق تحديث Edge وSQL معًا قبل أي نشر؛ لا يوجد رجوع صامت للتوقيع القديم.</li>
<li>مسار المحاولات ومحفزاته يحتاج تعريفات nafes_assessments وnafes_students والمساعدين lugati_sync_sections_attempt وlugati_sync_student_worksheets وتبعياتهم الفعلية. لم تُعطل محفزاته ولم يُختبر بنية بديلة.</li>
<li>حذف التصحيحات/التراجع الإداري خارج المجموعات الست المستهدفة؛ حارس إغلاق الجلسة يمنع إعادة فتح غير مدققة، ويلزم التحقق من توافق ذلك المسار قبل النشر.</li>
<li>لم تُعتمد الأوراق القديمة أو درجاتها؛ اختبار عدم تغير 60 اختيارًا يستخدم إجابات اصطناعية، وليس قياس دقة الصور القديمة.</li></ul>
<h2>النسخة المحفوظة</h2><p>مصدر Edge التطويري: qa/omr/development/source/paper-scan.ts.
إصلاحات SQL: qa/omr/development/manual-review-repairs.sql. الأعمدة الثلاثة المضافة لسجل الهوية: reason وbefore_identity وanswer_version؛ السجلات القديمة لا تُملأ بأسباب مختلقة.
المصدر الأصلي المرفوع وملفات Supabase المستوردة لم يُعدّلا.</p>
<h2>الأدلة التفصيلية والبصمة</h2><pre>${escape(JSON.stringify(evidence,null,2))}</pre>
<h2>سجل التحقق</h2><pre>${escape(log)}</pre></html>`;
const dir="qa/omr/results/manual-review";mkdirSync(dir,{recursive:true});
writeFileSync(`${dir}/evidence.json`,JSON.stringify(evidence,null,2));
writeFileSync(`${dir}/validation.log`,log);writeFileSync(`${dir}/report.html`,html);
writeFileSync("qa/omr/results/sql/report.html",html);
writeFileSync("qa/omr/results/sql/validation.log",log);
console.log(JSON.stringify({report:`${dir}/report.html`,validation:evidence.validation}));
