import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { omr, developmentOmr, auditedSource } from "./source";
import { syntheticSheet, blue, type FixtureOptions } from "./fixtures";

type Expected={question:number;status:string;selected:number|null;marked?:number[]};
type Case={id:string;image:string;expected:Expected[];kind:"synthetic"|"user-labelled"};
const single=(color:[number,number,number]=[25,25,25],radius=1.8)=>
  Array.from({length:60},(_,row)=>({row,option:row%4,color,radius}));
const expected=()=>Array.from({length:60},(_,i)=>({question:i+1,status:"clear",selected:i%4}));
const cases:Case[]=[];
function add(id:string,options:FixtureOptions,answers:Expected[]=expected()){
  cases.push({id,image:syntheticSheet(options),expected:answers,kind:"synthetic"});
}
add("upright-black",{marks:single()});
add("upright-blue",{marks:single(blue)});
const mixed=expected();
mixed[0]={question:1,status:"multiple",selected:null,marked:[0,2]};
add("mixed-blue-black",{marks:[...single(),{row:0,option:2,color:blue}]},mixed);
for(const rotation of [90,180,270] as const)add(`rotation-${rotation}`,{rotation,marks:single()});
add("moved-marker-area",{originY:350,marks:single()});
add("offset-bubbles-small-marks",{bubbleDx:1.1,bubbleDy:.9,marks:single([25,25,25],1)});
add("offset-bubbles-tiny-marks",{bubbleDx:1.1,bubbleDy:.9,marks:single([25,25,25],.45)});
add("tilted-six-degrees",{tilt:6,marks:single()});
add("blank-sheet",{},expected().map(e=>({...e,status:"blank",selected:null})));

// Future real samples need independently labelled shaded answers, not exam grades.
// The manifest and images are local files only; URLs and credentials are not accepted.
const manifestArg=process.argv.indexOf("--manifest");
if(manifestArg>=0){
  const file=resolve(process.argv[manifestArg+1]||"");
  const entries=JSON.parse(readFileSync(file,"utf8"));
  if(!Array.isArray(entries)||!entries.length)throw new Error("Sample manifest must contain labelled sheets.");
  for(const row of entries){
    if(!row.id||typeof row.image!=="string"||/^https?:/i.test(row.image)||!Array.isArray(row.expected))throw new Error("Invalid local sample.");
    const answers:Expected[]=row.expected;
    if(!answers.length||answers.length>60)throw new Error("Expected 1 to 60 independently labelled answers.");
    for(let i=0;i<answers.length;i++){
      const e=answers[i];
      if(e.question!==i+1||!["clear","blank","multiple","ambiguous"].includes(e.status))throw new Error("Invalid expected numbering or status.");
      if(e.status==="clear"&&(!Number.isInteger(e.selected)||e.selected!<0||e.selected!>3))throw new Error("Expected options are zero-based integers 0..3.");
      if(e.status==="multiple"&&(!Array.isArray(e.marked)||e.marked.length<2||new Set(e.marked).size!==e.marked.length||e.marked.some(n=>!Number.isInteger(n)||n<0||n>3)))throw new Error("Invalid multiple-answer label.");
      if(e.status==="blank"&&e.selected!==null)throw new Error("Blank labels must have selected:null.");
    }
    const bytes=readFileSync(resolve(dirname(file),row.image));
    if(bytes[0]!==255||bytes[1]!==216)throw new Error("OMR input must be JPEG; preserve original scans separately.");
    cases.push({id:String(row.id),image:`data:image/jpeg;base64,${bytes.toString("base64")}`,expected:answers,kind:"user-labelled"});
  }
}
function matches(e:Expected,a:any){
  if(!a||a.status!==e.status)return false;
  if(e.status==="multiple")return JSON.stringify([...(a.marked||[])].sort())===JSON.stringify([...(e.marked||[])].sort());
  return (a.selected??null)===e.selected;
}
function run(reader:any,c:Case){
  const start=performance.now();
  try{
    const r=reader.readOmrJpeg(c.image,c.expected.length);
    const matched=c.expected.filter((e,i)=>matches(e,r.answers[i])).length;
    return{matched,different:c.expected.length-matched,unread:0,
      answers:r.answers.map((a:any)=>({question:a.question,status:a.status,selected:a.selected,marked:a.marked})),
      error:null,ms:Math.round(performance.now()-start)};
  }catch(error:any){
    return{matched:0,different:0,unread:c.expected.length,answers:[],error:String(error?.message||error),ms:Math.round(performance.now()-start)};
  }
}
const rows=cases.map(c=>({id:c.id,kind:c.kind,total:c.expected.length,expected:c.expected,before:run(omr,c),after:run(developmentOmr,c)}));
function totals(kind:string,phase:"before"|"after"){
  return rows.filter(r=>r.kind===kind).reduce((sum,r)=>({
    sheets:sum.sheets+1,total:sum.total+r.total,matched:sum.matched+r[phase].matched,
    different:sum.different+r[phase].different,unread:sum.unread+r[phase].unread,
  }),{sheets:0,total:0,matched:0,different:0,unread:0});
}
const report={
  title:"مقارنة محرك OMR الأصلي ونسخة التطوير المعزولة",
  generated_at:new Date().toISOString(),source:auditedSource.manifest,
  development_sha256:createHash("sha256").update(readFileSync(resolve(import.meta.dir,"development/source/omr-server.ts"))).digest("hex"),
  metric:"Exact match of expected status and selected option(s). Rejected sheets are unread, not silently counted as incorrect grades.",
  synthetic:{before:totals("synthetic","before"),after:totals("synthetic","after")},
  real_samples:{before:totals("user-labelled","before"),after:totals("user-labelled","after")},
  real_samples_supplied:totals("user-labelled","after").sheets>0,
  rows,
};
const out=resolve(import.meta.dir,"results");
mkdirSync(out,{recursive:true});
writeFileSync(join(out,"comparison.json"),JSON.stringify(report,null,2));
const esc=(s:any)=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const cells=(r:any)=>`<td>${r.matched}</td><td>${r.different}</td><td>${r.unread}</td>`;
const option=(a:any)=>!a?"لم تُقرأ":`${a.status} / ${a.status==="multiple"?(a.marked||[]).join("+"):a.selected??"—"}`;
const details=cases.map((c,i)=>{
  const r=rows[i];
  return `<details><summary>${esc(c.id)} — ${c.kind==="synthetic"?"مصطنعة":"عينة معلّمة من المستخدم"}</summary>
  <img alt="صورة الاختبار الأصلية لهذه المقارنة" src="${c.image}">
  <p>قبل: ${esc(r.before.error||"تمت القراءة")} · بعد: ${esc(r.after.error||"تمت القراءة")}</p>
  <table><thead><tr><th>سؤال</th><th>المتوقع</th><th>قبل</th><th>بعد</th></tr></thead><tbody>
  ${r.expected.map((e,j)=>`<tr><td>${e.question}</td><td>${esc(option(e))}</td><td>${esc(option(r.before.answers[j]))}</td><td>${esc(option(r.after.answers[j]))}</td></tr>`).join("")}
  </tbody></table></details>`;
}).join("");
const html=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<title>تقرير مقارنة OMR</title><style>
body{font-family:Tahoma,Arial,sans-serif;line-height:1.8;margin:32px auto;max-width:1100px;padding:0 20px;color:#172f35}
h1{font-size:26px}h2{font-size:20px}.notice{background:#fff3d5;border:1px solid #b88322;padding:16px}
table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #8a9da2;padding:8px;text-align:center}th{background:#edf4f3}
details{border:1px solid #bdcccf;padding:12px;margin:12px 0}summary{cursor:pointer;font-weight:bold}img{display:block;width:320px;max-width:100%;height:auto;margin:16px auto}
code{direction:ltr;display:inline-block}small{word-break:break-all}
@media print{body{margin:0;font-size:12pt}thead{display:table-header-group}tr{break-inside:avoid}.notice{background:white}}
</style><h1>معلّمي — مقارنة OMR قبل الإصلاح وبعده</h1>
<div class="notice"><strong>${report.real_samples.after.sheets?"توجد عينات معلّمة في هذه المقارنة؛ راجع نطاقها أدناه.":"هذه المقارنة تخص الصور المصطنعة فقط. تقارير الأوراق الفعلية منفصلة عنها."}</strong>
<br>لا توجد عمليات على Supabase أو درجات الطلاب، ولا نشر. هذا التقرير لا يثبت دقة المنصة الإنتاجية.</div>
<p>المصدر الأصلي: نسخة التصدير المرفوعة؛ رقم النشر الذي ذكره المستخدم 128، دون تحقق عبر API.
ملف الأصل لم يتغير. نسخة التطوير منفصلة.</p>
<h2>ملخص الصور المصطنعة: ${report.synthetic.after.total} إجابة / ${report.synthetic.after.sheets} أوراق</h2>
<table><thead><tr><th>النسخة</th><th>متطابقة</th><th>مختلفة بعد القراءة</th><th>تعذر قراءتها</th></tr></thead>
<tbody><tr><td>قبل</td>${cells(report.synthetic.before)}</tr><tr><td>بعد</td>${cells(report.synthetic.after)}</tr></tbody></table>
<p>التطابق يعني تطابق حالة الإجابة والخيار أو الخيارات المظللة؛ وليس مقارنة الدرجة بمفتاح تصحيح الاختبار.
الورقة المرفوضة تحتسب «تعذر قراءتها» ولا تتحول تلقائيًا إلى إجابات خاطئة.</p>
<h2>عينات أضيفت عبر ملف المقارنة الاختياري: ${report.real_samples.after.sheets} أوراق</h2>
<table><thead><tr><th>النسخة</th><th>متطابقة</th><th>مختلفة بعد القراءة</th><th>تعذر قراءتها</th></tr></thead>
<tbody><tr><td>قبل</td>${cells(report.real_samples.before)}</tr><tr><td>بعد</td>${cells(report.real_samples.after)}</tr></tbody></table>
<h2>المقارنة حسب الصورة</h2><table><thead><tr><th>الصورة</th><th>العدد</th><th>تطابق قبل</th><th>اختلاف قبل</th><th>غير مقروء قبل</th><th>تطابق بعد</th><th>اختلاف بعد</th><th>غير مقروء بعد</th></tr></thead>
<tbody>${rows.map(r=>`<tr><td>${esc(r.id)}</td><td>${r.total}</td>${cells(r.before)}${cells(r.after)}</tr>`).join("")}</tbody></table>
<h2>الأدلة: الصورة الأصلية والإجابات المتوقعة والقراءتان</h2>${details}
<h2>حدود الاستنتاج</h2><p>الصور مصطنعة من هندسة القالب الحالي ولا تمثل كل نماذج الأوراق القديمة.
يلزم صور مسح فعلية مجهولة الهوية، وإجابات مظللة معلّمة بشكل مستقل، لتحديد الدقة الحقيقية والحالات غير المدعومة.
لا تُنشر النسخة الحالية تلقائيًا.</p>
<small>SHA-256 للأرشيف: ${esc(report.source.sha256)}<br>SHA-256 لمحرك التطوير: ${esc(report.development_sha256)}</small></html>`;
writeFileSync(join(out,"comparison.html"),html);
console.log(JSON.stringify({synthetic:report.synthetic,real_samples:report.real_samples},null,2));
console.log(`Evidence: ${join(out,"comparison.html")}`);
if(rows.some(r=>r.after.different||r.after.unread))process.exitCode=1;
