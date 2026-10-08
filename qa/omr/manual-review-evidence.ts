import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {scan as original,developmentScan as repaired} from "./source";
import {manualReviewFixture,requestFor,inspectBoundary} from "./manual-review-fixture";
import {syntheticSheet} from "./fixtures";

const names=["omr","development","regressions","historical-state","classification","manual-review-boundary","manual-reprocess"];
const files=names.map(n=>`qa/omr/${n}.test.ts`);
const run=spawnSync("bun",["test","--timeout","60000",...files],{encoding:"utf8",maxBuffer:2_000_000});
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
   scope:"سبب الطلب لا يمرَّر؛ تسجيل SQL والقيود غير مختبرة"});
 const batch=await inspectBoundary(engine,manualReviewFixture("uncertain"),"teacher_scan_finish");
 rows.push({test:"finish / uncertain",source:label,rpc_reached:batch.rpc_reached,scope:"SQL غير منفذ"});
 const rr=manualReviewFixture();rr.row.image_data=syntheticSheet({marks:[{row:0,option:2}]});
 rr.row.snapshot.answers[0].reviewed_manually=true;rr.row.snapshot.answers[0].manual_reason="synthetic review";
 const result=await engine.handlePaperScan(rr.db,requestFor(rr,"teacher_scan_reprocess_server"),rr.owner);
 rows.push({test:"reprocess / human review",source:label,selected:rr.row.effective_snapshot.answers[0].selected,
   manual_reason:rr.row.effective_snapshot.answers[0].manual_reason??null,reviewed_at:rr.row.reviewed_at,
   proposal_only:result.proposal_only===true,scope:"تحديث كائنات JavaScript فقط؛ المحفزات SQL غير مختبرة"});
}
const evidence={
 synthetic_only:true,real_student_data_used:false,historical_snapshots_used:false,
 production_connected:false,sql_executed:false,sql_database_created:false,
 local_sql_database_permission:true,
 source_sha256:createHash("sha256").update(readFileSync("qa/omr/development/source/paper-scan.ts")).digest("hex"),
 validation:{passed:Number(log.match(/(\d+) pass\b/)?.[1]),failed:0,todo:Number(log.match(/(\d+) todo\b/)?.[1]||0),files},
 rows,
 blockers:[
   "Original table DDL, constraints, indexes, RLS policies, triggers and trigger functions are absent.",
   "Original SQL RPC bodies/signatures, audit persistence and transaction semantics are absent.",
   "Duplicate and concurrent operations cannot be proved by an RPC boundary recorder.",
   "The current Edge edit and identity calls do not forward an entered reason. No SQL argument was invented.",
 ],
 missing_tables:["nafes_scan_sheets","nafes_scan_sessions","nafes_scan_answer_edits","nafes_scan_identity_edits","nafes_scan_alerts"],
 rpc_names_referenced_by_existing_edge_not_verified_in_database:[
   "nafes_scan_register","nafes_scan_assign_identity","nafes_scan_edit_answer",
   "nafes_scan_verify_current","nafes_scan_finish","nafes_scan_delete_corrections",
 ],
};
const escape=(s:any)=>String(s??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>معلّمي — اختبارات الحفظ والمراجعة</title>
<style>body{font:17px/1.8 Tahoma,Arial,sans-serif;margin:32px auto;padding:0 24px;max-width:1100px;color:#17212f}h1,h2{line-height:1.4}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #a5afbb;padding:10px;vertical-align:top}th{background:#edf2f7}.notice{padding:16px;border:2px solid #b76b00;background:#fff7e6}pre{direction:ltr;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;background:#f1f4f8;padding:16px}@media print{body{margin:0;font-size:12pt}thead{display:table-header-group}tr{break-inside:avoid}pre{font-size:9pt}}</style>
<h1>معلّمي — حفظ أوراق التظليل والمراجعة اليدوية</h1>
<p><strong>${evidence.validation.passed} اختبارًا ناجحًا، 0 فشل، ${evidence.validation.todo} اختبارات SQL معلّقة.</strong> جميع البيانات اصطناعية.</p>
<div class="notice">هذه اختبارات كود Edge وحدود الاستدعاء فقط. لم تُنشأ قاعدة SQL ولم تُنفذ وظائفها. موافقة القاعدة المحلية متاحة، لكن مخطط الإنتاج لم يُخترع. لا تعني الاختبارات الناجحة نجاح الحفظ أو سجل التعديلات أو منع التكرار داخل SQL. المهمة كاملةً لم تُعتبر ناجحة بعد، ولم يبدأ تحسين واجهة المعلم.</div>
<h2>قبل الإصلاح وبعده</h2><table><thead><tr><th>الحالة</th><th>المصدر الأصلي المرفوع</th><th>الإصلاح المحلي</th></tr></thead><tbody>
<tr><td>التحقق من ورقة ambiguous أو uncertain</td><td>يمرر الطلب إلى SQL دون حماية Edge؛ لا إثبات لاعتماد فعلي</td><td>يحجب الطلب قبل استدعاء SQL</td></tr>
<tr><td>تغيير الهوية لإجابة uncertain ذات قراءة clear</td><td>يعيد تصنيفها correct عند تطابق المفتاح</td><td>يحتفظ بالاختيار والتظليل، ويُبقي state=uncertain وcorrect=false حتى مراجعة صريحة</td></tr>
<tr><td>إعادة قراءة تتعارض مع تعديل بشري</td><td>يستبدل الإجابات ويمحو علامات المراجعة</td><td>يحفظ الإجابات والسبب والعلامات؛ القراءة الجديدة اقتراح غير مطبق</td></tr>
<tr><td>إنهاء دفعة غير محسومة / حذف ورقة معلقة من النتائج ضمنيًا</td><td>الإنهاء يُحال إلى SQL؛ تجهيز النتائج قد يتجاهل غير verified</td><td>يرفض الإنهاء والتجهيز ما دامت ورقة غير محجوبة من التكرار تحتاج حسمًا أو تحققًا</td></tr>
<tr><td>تسجيل سبب التعديل / منع الحفظ المكرر والمعاملات المتزامنة</td><td colspan="2">غير مثبت. مصدر SQL مفقود؛ سبب الطلب لا يُمرر حاليًا. لا يُضاف p_reason أو قيد جديد دون تعريف الأصل.</td></tr>
</tbody></table>
<h2>المصدر الناقص</h2><p>تعريفات الجداول الخمسة المذكورة، القيود والفهارس وسياسات الوصول والمحفزات ووظائفها، وتواقيع وأجسام RPC الفعلية. الأسماء التالية مراجع من كود Edge وليست تأكيدًا لوجود وظائف بهذا التوقيع في الإنتاج:</p><pre>${escape(evidence.rpc_names_referenced_by_existing_edge_not_verified_in_database.join("\n"))}</pre>
<p>ملف استخراج بيانات تعريف المخطط بالقراءة فقط: <code dir="ltr">qa/omr/export/manual-review-metadata-readonly.sql</code>. لم يُنفذ. لا يقرأ صفوف الطلاب أو الدرجات. يجب مراجعة المصدر الناتج وإزالة أي أسرار مضمّنة قبل مشاركته.</p>
<h2>الأدلة التفصيلية والبصمة</h2><pre>${escape(JSON.stringify(evidence,null,2))}</pre>
<h2>سجل التحقق</h2><pre>${escape(log)}</pre></html>`;
const dir="qa/omr/results/manual-review";mkdirSync(dir,{recursive:true});
writeFileSync(`${dir}/evidence.json`,JSON.stringify(evidence,null,2));
writeFileSync(`${dir}/validation.log`,log);writeFileSync(`${dir}/report.html`,html);
console.log(JSON.stringify({report:`${dir}/report.html`,validation:evidence.validation}));
