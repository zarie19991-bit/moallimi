(()=>{
"use strict";
/* This is a teacher-only UI; the Edge Function validates each write again. */
const API="https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/tamakkun-student-monitor";
const S={host:null,token:null,task:null,student:null,posttest:null,reviews:[],baseline:null,indicator:"",onSaved:null,onClose:null,busy:false,error:"",key:0};
const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const T=v=>String(v??"").trim();
const Z=n=>Number(n||0).toLocaleString("ar-SA",{maximumFractionDigits:1});
const day=x=>{if(!x)return"";const d=new Date(x);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(d):""};
const pretty=x=>x?new Date(x+"T12:00:00Z").toLocaleDateString("ar-SA-u-ca-gregory",{timeZone:"Asia/Riyadh",dateStyle:"medium"}):"—";
const status=t=>({mastered:"أتقن – باعتماد المعلم",needs_retraining:"استمرار العلاج",execution:"توثيق التنفيذ",decision:"قرار المعلم"})[t]||t||"—";
function css(){
 if(document.getElementById("ttr-css"))return;
 const node=document.createElement("style");node.id="ttr-css";
 node.textContent=".ttr{font:13px Tahoma,Arial,sans-serif;direction:rtl;color:#163d30;border:2px solid #a8d9b6;padding:18px;background:white;border-radius:18px;margin:15px 0}.ttr *{box-sizing:border-box}.ttr h2{font-size:20px;margin:0 0 9px}.ttr h3{font-size:15px;margin:0 0 8px}.ttr p{line-height:1.8}.ttr-head{display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap}.ttr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}.ttr-panel{background:#f8fcf9;border:1px solid #d2e6d7;border-radius:12px;padding:14px;margin:13px 0}.ttr label{display:block;font-size:12px;font-weight:800;color:#456d53;margin:8px 0}.ttr select,.ttr input,.ttr textarea{width:100%;border:1px solid #baccbd;border-radius:9px;padding:10px;font:inherit;color:#173f2c;background:white;margin-top:5px}.ttr textarea{min-height:90px}.ttr-btn{border:1px solid #a8cfb3;border-radius:9px;background:#08704f;color:white;font:inherit;font-weight:800;padding:10px 14px;cursor:pointer}.ttr-btn.alt{background:white;color:#116444}.ttr-btn:disabled{opacity:.48;cursor:not-allowed}.ttr-info{border:1px solid #d2e6d7;border-radius:10px;padding:12px;background:#eff8f1;margin:9px 0;font-size:12px;line-height:1.8}.ttr-error{background:#fff0f0;color:#9a2e36;padding:10px;border-radius:9px}.ttr-history{max-height:280px;overflow:auto}.ttr-event{padding:9px 0;border-bottom:1px solid #e0eade;font-size:12px;line-height:1.7}.ttr-sm{color:#62766c;font-size:11px}.ttr-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}@media(max-width:700px){.ttr{padding:11px}.ttr h2{font-size:18px}}";
 document.head.appendChild(node);
}
function latest(type){return [...S.reviews].filter(r=>r.event_type===type).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null}
function verifiedOnline(){
 const t=S.task;return t?.status==="completed"&&!!t.completed_at&&Number(t.total)>0&&!!t.solved;
}
function posttestComplete(){
 const p=S.posttest,t=S.task;
 return p&&String(p.source_task_id)===String(t?.id)&&String(p.student_id)===String(t?.student_id)&&
 p.status==="completed"&&!!p.submitted_at&&Number(p.total)>=5&&Number(p.score)>=0&&
 Number(p.score)<=Number(p.total);
}
function pct(){return posttestComplete()?Math.round(1000*Number(S.posttest.score)/Number(S.posttest.total))/10:null}
function dateValid(x){return /^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+"T12:00:00Z").toISOString().slice(0,10)===x}
function render(){
 if(!S.host||!S.task)return;css();
 const execution=latest("execution"),decision=latest("decision"),p=pct(),allowDecision=!!execution||verifiedOnline();
 const today=day(new Date().toISOString()),wasExecuted=execution||verifiedOnline();
 const entries=[...S.reviews].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,12);
 let h='<section class="ttr"><div class="ttr-head"><div><small class="ttr-sm">ملف علاج المعلم • توثيق التنفيذ والقياس البعدي</small><h2>'+E(S.student?.full_name||"الطالب")+' • '+E(S.indicator||"المؤشر")+'</h2><div class="ttr-sm">رقم التكليف: '+E(S.task.id)+' • '+E(S.task.title||"")+'</div></div><button class="ttr-btn alt" id="ttr-close">إغلاق</button></div>'+
 '<div class="ttr-info"><b>ما الذي يثبته هذا السجل؟</b> ملاحظة المعلم عمّا نُفذ في الفصل أو خارجه، ثم قرار مستقل بعد اختبار بعدي حقيقي مرتبط بالتكليف. لا يعدّ دخول المنصة إثبات حضور مدرسي، ولا تتحول درجة الاختبار إلى قرار إتقان آلي.</div>'+
 '<div class="ttr-grid"><div class="ttr-panel"><h3>١. توثيق تنفيذ العلاج</h3><label>تاريخ التنفيذ <input type="date" id="ttr-date" value="'+E(today)+'" max="'+E(today)+'"></label>'+
 '<label>طريقة التنفيذ<select id="ttr-mode"><option value="in_class">داخل الفصل</option><option value="home">تدريب منزلي</option><option value="online">عبر المنصة</option><option value="other">طريقة أخرى</option></select></label>'+
 '<label>نوع الشاهد<select id="ttr-evidence"><option value="teacher_observation">ملاحظة المعلم المباشرة</option><option value="student_work">ورقة عمل الطالب</option><option value="online_submission">حل إلكتروني محفوظ</option><option value="other">شاهد آخر</option></select></label>'+
 '<label>وصف ما نُفذ والملاحظة التربوية<textarea id="ttr-exec-note" maxlength="1200" placeholder="مثال: نفذ الطالب ثلاثة تدريبات واستخدم استراتيجية المقارنة..."></textarea></label>'+
 '<button class="ttr-btn" id="ttr-save-exec"'+(S.busy?" disabled":"")+'>حفظ تنفيذ العلاج</button>'+
 (execution?'<p class="ttr-sm">آخر توثيق تنفيذ: '+E(pretty(execution.execution_date))+' • '+E(execution.notes)+'</p>':'<p class="ttr-sm">لم يُسجل توثيق تنفيذ حضوري حتى الآن.</p>')+'</div>'+
 '<div class="ttr-panel"><h3>٢. مراجعة القياس البعدي واعتماد المعلم</h3>'+
 '<div class="ttr-info">التنفيذ: '+E(wasExecuted?"موثّق بالتكليف أو المعلم":"غير موثّق")+'<p>القياس البعدي المرتبط: '+(posttestComplete()?E(Z(S.posttest.score)+' من '+Z(S.posttest.total)+' ('+Z(p)+'٪)'):'لم يُسلّم قياس بعدي صالح من خمسة أسئلة على الأقل')+'</p>'+
 '<p>القبلي: '+(S.baseline != null && S.baseline !== '' && Number.isFinite(Number(S.baseline))?E(Z(S.baseline)+'٪'):'غير متاح')+' • تغير النسبة: '+(p!==null&&S.baseline != null && S.baseline !== '' && Number.isFinite(Number(S.baseline))?E(Z(Math.round((p-Number(S.baseline))*10)/10)+' نقطة مئوية'):'لا يمكن حسابه')+'</p></div>'+
 '<label>قرار المعلم<select id="ttr-decision"><option value="needs_retraining">يحتاج استمرار العلاج</option><option value="mastered"'+(p!==null&&p<80?' disabled':'')+'>أتقن المهارة (٨٠٪ فأكثر)</option></select></label>'+
 '<label>سبب القرار وخطة المتابعة<textarea id="ttr-decision-note" maxlength="1200" placeholder="مثال: أظهر القياس البعدي انتقالًا من ٤٠٪ إلى ٨٠٪..."></textarea></label>'+
 '<button class="ttr-btn" id="ttr-save-decision"'+(S.busy||!allowDecision||!posttestComplete()?" disabled":"")+'>حفظ قرار المعلم</button>'+
 (decision?'<div class="ttr-info">آخر قرار محفوظ: <b>'+E(status(decision.decision))+'</b> • '+E(decision.notes)+'</div>':'<p class="ttr-sm">لا يوجد قرار إتقان معتمد بعد.</p>')+'</div></div>'+
 '<div class="ttr-row"><button id="ttr-print" class="ttr-btn alt">طباعة تقرير تنفيذ العلاج A4</button><span class="ttr-sm">السجل قابل للتصحيح بإضافة حدث جديد؛ تبقى التوثيقات السابقة محفوظة للمراجعة.</span></div>'+
 (S.error?'<div class="ttr-error">'+E(S.error)+'</div>':'')+
 '<div class="ttr-panel"><h3>تاريخ مراجعات المعلم</h3><div class="ttr-history">'+(entries.length?entries.map(r=>'<div class="ttr-event"><b>'+E(r.event_type==="execution"?"توثيق التنفيذ":status(r.decision))+'</b> • '+E(r.event_type==="execution"?pretty(r.execution_date):new Date(r.created_at).toLocaleDateString("ar-SA"))+'<p>'+E(r.notes)+'</p></div>').join(''):'لا توجد مراجعات محفوظة بعد.')+'</div></div></section>';
 S.host.innerHTML=h;
 const at=id=>S.host?.querySelector("#"+id);
 at("ttr-close").onclick=()=>{const cb=S.onClose;unmount();if(cb)cb()};
 at("ttr-save-exec").onclick=()=>submitExecution();
 at("ttr-save-decision").onclick=()=>submitDecision();
 at("ttr-print").onclick=print;
}
async function send(action,body){
 if(S.busy||!S.token||!S.task)return;
 const v=S.key,token=S.token;
 S.busy=true;S.error="";render();
 try{
  const response=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({action,task_id:S.task.id,...body}),cache:"no-store"});
  const json=await response.json().catch(()=>({}));
  if(!response.ok||json.ok!==true||!json.review?.id)throw Error(json.error||"تعذر حفظ مراجعة المعلم.");
  if(v!==S.key||token!==S.token)return;
  S.reviews.unshift(json.review);
  S.error="";S.busy=false;render();
  if(typeof S.onSaved==="function")S.onSaved();
 }catch(e){if(v===S.key){S.error=e.message||"تعذر الحفظ";S.busy=false;render()}}
}
function submitExecution(){
 const at=id=>S.host?.querySelector("#"+id);
 const date=T(at("ttr-date")?.value),mode=T(at("ttr-mode")?.value),evidence=T(at("ttr-evidence")?.value),notes=T(at("ttr-exec-note")?.value);
 if(!dateValid(date)||date>day(new Date().toISOString())||date<day(S.task.assigned_at)){S.error="تاريخ التنفيذ غير صالح أو يسبق تاريخ إسناد التكليف.";render();return}
 if(!["in_class","home","online","other"].includes(mode)||!["teacher_observation","student_work","online_submission","other"].includes(evidence)||notes.length<3){S.error="حدد طريقة التنفيذ والشاهد، واكتب ملاحظة من ثلاثة أحرف على الأقل.";render();return}
 send("teacher_review_execution",{execution_date:date,execution_mode:mode,evidence_type:evidence,notes});
}
function submitDecision(){
 const at=id=>S.host?.querySelector("#"+id);
 const decision=T(at("ttr-decision")?.value),notes=T(at("ttr-decision-note")?.value);
 if(!posttestComplete()||!(latest("execution")||verifiedOnline())){S.error="يجب توثيق التنفيذ وإكمال القياس البعدي المرتبط بالتكليف قبل اعتماد القرار.";render();return}
 if(!["needs_retraining","mastered"].includes(decision)||notes.length<3||(decision==="mastered"&&pct()<80)){S.error="القرار أو الملاحظة غير صالحين، والإتقان يتطلب ٨٠٪ فأكثر.";render();return}
 send("teacher_review_decision",{decision,notes});
}
function print(){
 if(!S.host||!S.task)return;
 const w=window.open("","_blank","width=920,height=820");if(!w){alert("اسمح بفتح نافذة طباعة التقرير.");return}
 try{w.opener=null}catch(_){}
 const execution=latest("execution"),decision=latest("decision"),p=pct();
 const info=[["الطالب",S.student?.full_name],["الفصل",S.student?.class_name],["المؤشر",S.indicator],["التكليف",S.task.title],
  ["تاريخ التنفيذ",execution?pretty(execution.execution_date):"لم يوثّق حضوريًا"],["ملاحظات المعلم",execution?.notes||"لا توجد"],
  ["النسبة القبلية",S.baseline != null && S.baseline !== '' && Number.isFinite(Number(S.baseline))?Z(S.baseline)+"٪":"غير متاحة"],["النسبة البعدية",p!==null?Z(p)+"٪":"لم يُقَس"],
  ["قرار المعلم",decision?status(decision.decision):"لم يعتمد"],["مبرر القرار",decision?.notes||"لا يوجد"]];
 const rows=info.map(([k,v])=>"<tr><th>"+E(k)+"</th><td>"+E(v)+"</td></tr>").join("");
 w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير تنفيذ العلاج</title><style>@page{size:A4;margin:14mm}body{font:12pt Tahoma,Arial;line-height:1.9;color:#173d30}h1{text-align:center;font-size:19pt}table{width:100%;border-collapse:collapse}th,td{border:1px solid #b3cabc;text-align:right;padding:8px;overflow-wrap:anywhere}th{width:27%;background:#eef5f0}.note{font-size:10pt;margin:18px 0}@media print{button{display:none}}</style></head><body><b>المملكة العربية السعودية – وزارة التعليم – إدارة التعليم بنجران – مدرسة ابن سينا المتوسطة</b><h1>تقرير تنفيذ العلاج وقياس أثره</h1><table>'+rows+'</table><p class="note">التوثيق يعتمد على سجلات المعلم والاختبار البعدي المرتبط بالتكليف. لا يثبت حضور الطالب المدرسي، ولا يُعلن الإتقان دون قرار المعلم المحفوظ.</p><button onclick="print()">طباعة</button></body></html>');
 w.document.close();w.focus();
}
function unmount(){S.key++;S.host=null;S.token=null;S.task=null;S.student=null;S.posttest=null;S.reviews=[];S.busy=false;S.error="";S.onSaved=null;S.onClose=null}
window.TamakkunTeacherReview={
 mount({role,token,task,student,posttest,reviews,baseline,indicator,onSaved,onClose}={}){
  if(role!=="teacher"||!token||!task?.id)return;
  const host=document.getElementById("tamakkunTeacherReviewMount");if(!host)return;
  const identity=String(token)+"|"+String(task.id);
  if(S._identity!==identity){S.key++;S._identity=identity;S.error="";S.busy=false}
  S.host=host;S.token=token;S.task=task;S.student=student;S.posttest=posttest;S.reviews=Array.isArray(reviews)?reviews:[];S.baseline=baseline;S.indicator=indicator;S.onSaved=onSaved;S.onClose=onClose;
  render();
 },
 unmount
};
})();