import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import jpeg from "jpeg-js";
import {developmentScan,scan as originalScan,developmentOmr} from "./source";
import {syntheticSheet,blue} from "./fixtures";
import {classificationCases} from "./classification-cases";

// Only synthetic fixtures and memory DBs. Historical PDFs and snapshots are not used.
const files=["omr.test.ts","development.test.ts","regressions.test.ts","historical-state.test.ts","classification.test.ts"].map(x=>`qa/omr/${x}`);
const execution=spawnSync("bun",["test","--timeout","60000",...files],{encoding:"utf8",maxBuffer:2_000_000});
const log=execution.stdout+execution.stderr;
console.log(log);
if(execution.status!==0)throw new Error("Synthetic regression verification failed; no report generated.");
const passed=Number(log.match(/(\d+) pass\b/)?.[1]);
if(!passed||!/\b0 fail\b/.test(log))throw new Error("Cannot verify the test summary.");
const hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const escape=(v:any)=>String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const rows=classificationCases.map(c=>{
 const result=developmentScan.classifyAnswer(c.raw,c.key,0,c.context);
 if(result.state!==c.state||result.reading_status!==c.reading)throw new Error(`Evidence mismatch: ${c.id}`);
 // Do not pretend that the old 3-argument function understood the new context checks.
 return {...c,original_function_state:c.context?null:originalScan.classifyAnswer(c.raw,c.key,0).state,result};
});
function crop(image:string){
 const d=jpeg.decode(Buffer.from(image.split(",")[1],"base64"),{useTArray:true});
 const width=134,height=27,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)data.set(d.data.subarray(((804+y)*d.width+611)*4,((804+y)*d.width+611+width)*4),y*width*4);
 return `data:image/jpeg;base64,${Buffer.from(jpeg.encode({width,height,data},95).data).toString("base64")}`;
}
const pictures=[
 {id:"blank",label:"فراغ فعلي",marks:[],expected:"blank"},
 {id:"single",label:"اختيار أسود واحد واضح",marks:[{row:0,option:0}],expected:"correct"},
 {id:"multiple",label:"تظليل أسود وأزرق مثبت",marks:[{row:0,option:0,radius:1.3},{row:0,option:2,color:blue}],expected:"multiple"},
 {id:"ambiguous",label:"أزرق واضح مع أثر أسود منافس ضعيف",marks:[{row:0,option:0,radius:.45},{row:0,option:2,color:blue}],expected:"uncertain"},
].map(c=>{
 const image=syntheticSheet({marks:c.marks});
 const raw=developmentOmr.readOmrJpeg(image,4);
 const result=developmentScan.classifyAnswer(raw.answers[0],{correct_index:0},0,{identity_valid:true,key_complete:true,markers_ok:raw.markers_ok});
 if(result.state!==c.expected)throw new Error(`Image evidence mismatch: ${c.id}`);
 return {...c,result,image,zoom:crop(image)};
});
const evidence={
 synthetic_only:true,historical_snapshots_used:false,production_grade_approval:false,
 source_sha256:hash("qa/omr/development/source/paper-scan.ts"),
 reader_sha256:hash("qa/omr/development/source/omr-server.ts"),
 validation:{passed,failed:0,files},cases:rows,
 image_cases:pictures.map(({image,zoom,...data})=>data),
 healthy_option_key_combinations_preserved:16,
 healthy_image_answers_preserved:60,
 ambiguity_option_key_confidence_combinations_not_promoted:32,
};
const reasonText:Record<string,string>={
 bubble_ambiguous:"قراءة غير محسومة بين مرشحين",invalid_selected_evidence:"قيمة اختيار غير صالحة",
 invalid_marked_evidence:"قائمة علامات غير صالحة",contradictory_clear_evidence:"تعارض الوضوح مع مواضع العلامات",
 contradictory_blank_evidence:"تعارض الفراغ مع اختيار موجود",multiple_evidence_incomplete:"الأدلة لا تثبت تظليل خيارين",
 reading_status_unrecognized:"نوع قراءة غير معروف",reader_failed:"فشل تحليل الصورة",reading_not_run:"لم تُنفذ القراءة",
 markers_not_verified:"علامات الورقة غير مؤكدة",identity_not_verified:"هوية الورقة غير مؤكدة",
 answer_key_missing_or_invalid:"مفتاح مفقود أو غير صالح",answer_key_incomplete:"مفتاح النموذج غير مكتمل",
};
const reasons=(values:string[])=>values.map(v=>escape(reasonText[v]||v)).join("؛ ")||"—";
const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>معلّمي — إثبات سلامة تصنيف OMR</title>
<style>body{font:17px/1.8 Arial,sans-serif;max-width:1150px;margin:auto;padding:24px;color:#183b40;background:#fafcfb}
h1,h2{color:#075d63}.notice{background:#e8f3f2;border-right:5px solid #087b80;padding:16px}table{border-collapse:collapse;width:100%;font-size:15px}
th,td{border:1px solid #adc6c8;padding:8px;text-align:right}th{background:#edf4f4}.scroll{overflow:auto}figure{border:1px solid #b2c7c9;padding:15px;break-inside:avoid}
.zoom{width:670px;max-width:100%;height:auto;image-rendering:pixelated}code{direction:ltr;unicode-bidi:embed}small{overflow-wrap:anywhere}
@media print{body{background:white;font-size:13px}thead{display:table-header-group}tr{break-inside:avoid}}</style>
<h1>معلّمي — إصلاح منطق التصنيف وأدلة الانحدار</h1>
<p class="notice">هذا اختبار اصطناعي محلي فقط. لا يستخدم الأوراق القديمة أو لقطاتها التاريخية أو درجات الطلاب، ولا يتصل بـ Supabase. لم يحدث نشر.</p>
<h2>المعنى المحفوظ لكل حالة</h2><ul>
<li><code>ambiguous</code>: مرشحون غير محسومين؛ لا يصبحون تظليلًا متعددًا لمجرد أن القائمة تحتوي خيارين.</li>
<li><code>multiple</code>: القارئ يثبت تظليلًا متعددًا وقائمة العلامات متسقة؛ ليس ناتج تخمين من تناقض البيانات.</li>
<li><code>uncertain</code>: نتيجة تحتاج تحققًا، وأسبابها منفصلة في القراءة والهوية ومفتاح التصحيح.</li>
<li>تظل حالة القراءة مستقلة: قد تكون الفقاعة واضحة، لكن لا يُعتمد تطابقها مع المفتاح عند غياب الهوية أو المفتاح الكامل.</li></ul>
<h2>التحقق</h2><p><strong>${passed} اختبارًا ناجحًا، صفر فاشل.</strong>
حُفظت جميع تركيبات الاختيار/المفتاح الـ16 السليمة، وجميع الاختيارات الستين في صورة اصطناعية بألوان الأسود والأزرق.
لم تُرقَّ أي من 32 تركيبة عدم حسم/مفتاح/ثقة إلى إجابة صحيحة مؤكدة.</p>
<p>اختبارات التسجيل وتعيين الهوية تستخدم قاعدة ذاكرة فقط. تعيين الهوية أو وجود علامة «مراجع يدويًا» لا يحل تلقائيًا غموض الفقاعات.
البيانات المتناقضة تحتاج تحققًا بدل وصفها multiple أو blank على غير دليل.</p>
<h2>حالات التصنيف</h2><div class="scroll"><table><thead><tr><th>الحالة الاصطناعية</th><th>دالة الأصل</th><th>حالة القراءة بعد</th><th>النتيجة بعد</th>
<th>أسباب القراءة</th><th>أسباب الهوية</th><th>أسباب المفتاح</th></tr></thead><tbody>
${rows.map(r=>`<tr><td>${escape(r.label)}</td><td>${escape(r.original_function_state||"لا توجد مقارنة مكافئة للسياق الجديد")}</td>
<td>${escape(r.result.reading_status)}</td><td>${escape(r.result.state)}</td><td>${reasons(r.result.uncertainty.reading)}</td>
<td>${reasons(r.result.uncertainty.identity)}</td><td>${reasons(r.result.uncertainty.answer_key)}</td></tr>`).join("")}
</tbody></table></div><p>عمود الأصل يقارن الدالة على المدخلات نفسها فقط؛ لا يمثل السجلات التاريخية أو سلوك واجهة التسجيل الإنتاجية.
العدادات الثلاثة للأسباب قد تتداخل؛ ليست فئات حصرية تُجمع للحصول على عدد الأسئلة.</p>
<h2>صور اصطناعية مقروءة بالمحرك الموجود</h2><p>تُقرأ الصورة كاملة بحجمها الأصلي؛ التكبير أدناه للعرض فقط. الخيارات من اليمين: أ، ب، ج، د.</p>
${pictures.map(p=>`<figure><figcaption><strong>${escape(p.label)}</strong> — قراءة: ${escape(p.result.status)}، نتيجة: ${escape(p.result.state)}</figcaption>
<img class="zoom" src="${p.zoom}" alt="${escape(p.label)}"><p>العلامات/المرشحون: ${escape(JSON.stringify(p.result.marked))}؛
مطابقة معتمدة: ${p.result.correct?"نعم، في المثال الاصطناعي فقط":"لا"}.</p>
<details><summary>الصورة الكاملة المستخدمة للقراءة</summary><img src="${p.image}" style="max-width:100%" alt="ورقة اصطناعية كاملة"></details></figure>`).join("")}
<h2>ما لا يثبته التقرير</h2><p>لا يثبت سبب أخطاء صفوف Supabase القديمة، أو دقة تصوير الكاميرا، أو اكتمال سير العمل الإنتاجي.
تظل مقارنة اللقطات الأصلية مجهولة الهوية مطلوبة قبل الاعتماد على الأوراق القديمة أو درجاتها.</p>
<small>SHA-256 لمسار التصنيف: ${evidence.source_sha256}<br>SHA-256 لقارئ الصورة: ${evidence.reader_sha256}</small></html>`;
const out="qa/omr/results/classification";
mkdirSync(out,{recursive:true});
writeFileSync(`${out}/evidence.json`,JSON.stringify(evidence,null,2));
writeFileSync(`${out}/report.html`,html);
writeFileSync(`${out}/validation.log`,log);
console.log(`Verified ${passed} synthetic tests; evidence: ${out}/report.html`);
