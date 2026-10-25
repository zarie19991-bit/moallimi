(()=>{
"use strict";
const URL_API="https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/tamakkun-student-monitor";
const M={host:null,token:null,data:null,rows:[],loading:false,q:"",subject:"all",indicator:"all",cls:"all",tier:"all",state:"all",presence:"all",page:1,attendanceDate:"",attendanceClass:"all",attendanceStatus:"all",generation:0,attendanceCache:null};
const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=n=>Number(n??0).toLocaleString("ar-SA",{maximumFractionDigits:1});
const D=x=>x?new Date(x).toLocaleString("ar-SA",{timeZone:"Asia/Riyadh",dateStyle:"short",timeStyle:"short"}):"—";
const P=x=>x&&x.total>0?Math.round(1000*x.score/x.total)/10:null;
const subj=s=>({reading:"القراءة",math:"الرياضيات",science:"العلوم"})[s]||s;
const tier=t=>({remedial:"علاجي",reinforcement:"تعزيز",enrichment:"إثرائي",unmeasured:"لم يُقَس"})[t]||t;
const plan=s=>({missing:"لا توجد خطة",assigned:"مسندة ولم يبدأ",in_progress:"بدأ ولم يسلّم",completed:"سلّم الحل"})[s]||s;
const key=(id,k)=>String(id)+"|"+k;
function addCss(){if(document.getElementById("tmo-css"))return;const c=document.createElement("style");c.id="tmo-css";c.textContent='.tmo{font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;color:#16402c;font-size:12px}.tmo *{box-sizing:border-box}.tmo-hero{background:linear-gradient(110deg,#063929,#08725a);color:#fff;padding:25px;border-radius:20px}.tmo-hero h1{font-size:25px;font-weight:900;margin:4px 0}.tmo-hero p{color:#cbe7d5;font-size:13px}.tmo-box{background:white;border:1px solid #d5e7da;border-radius:16px;margin-top:15px;padding:17px}.tmo-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:15px 0}.tmo-stat{background:#fff;border:1px solid #d2e3d8;padding:14px;border-radius:14px}.tmo-stat small{color:#63816e;font-weight:700}.tmo-stat b{display:block;font-size:23px;color:#086042}.tmo-button{background:#09674f;color:#fff;border:none;border-radius:10px;padding:9px 13px;font-size:12px;font-weight:bold;cursor:pointer}.tmo-button.secondary{background:#e6f4e8;color:#08634c}.tmo-button:disabled{opacity:.45}.tmo-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px}.tmo-filters label{font-size:11px;font-weight:800;display:block;margin-bottom:5px}.tmo-filters input,.tmo-filters select{width:100%;border:1px solid #ccdcd0;background:#fbfefa;border-radius:9px;padding:10px;font-size:12px}.tmo-wrap{overflow:auto;max-height:60vh;border:1px solid #d6e5db;border-radius:10px}.tmo-table{border-collapse:separate;border-spacing:0;min-width:1440px;width:100%;font-size:11px}.tmo-table th{background:#e7f4e9;position:sticky;top:0;z-index:1;text-align:right;padding:11px;white-space:nowrap}.tmo-table td{padding:10px;border-top:1px solid #e4ece6;vertical-align:top}.tmo-table tr:nth-child(even){background:#fafcfb}.tmo-pill{display:inline-block;padding:4px 7px;border-radius:8px;font-weight:bold;background:#eef4ef;white-space:nowrap}.tmo-pill.green{background:#dff4e7;color:#095b37}.tmo-pill.yellow{background:#fff2d5;color:#925c17}.tmo-pill.red{background:#ffe8e9;color:#a33144}.tmo-sub{display:block;color:#647e6a;font-size:10px}.tmo-note{background:#f3f9f4;border:1px solid #d7e8da;border-radius:12px;padding:12px;margin:12px 0}.tmo-nav{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:12px}@media print{@page{size:A4 landscape;margin:8mm}.tmo-filters,.tmo-actions,.tmo-nav{display:none!important}.tmo-hero{background:#fff;color:#16402c}.tmo-wrap{overflow:visible;max-height:none}.tmo-table{min-width:0;font-size:8pt}.tmo-table th{position:static}}';document.head.appendChild(c)}
async function request(action,payload={}){const r=await fetch(URL_API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+M.token},body:JSON.stringify({action,...payload})});let x;try{x=await r.json()}catch{throw Error("تعذر قراءة نتيجة خدمة المتابعة.")}if(!r.ok||x.ok!==true)throw Error(x.error||"فشل تحميل المتابعة.");return x}
function compile(d){
 const roster=new Map(d.students.map(s=>[String(s.id),s])),sessions=new Map(),plans=new Map(),evidence=new Map();
 for(const s of d.sessions||[]){const id=String(s.student_id);let p=sessions.get(id)||{login:null,seen:null,expires:null};if(!p.login||s.created_at>p.login)p.login=s.created_at;if(!p.seen||s.last_seen_at>p.seen){p.seen=s.last_seen_at;p.expires=s.expires_at}sessions.set(id,p)}
 for(const t of d.tasks||[]){const k=key(t.student_id,[t.subject_key,t.outcome_code,t.indicator_index].join("|"));if(!plans.has(k))plans.set(k,[]);plans.get(k).push(t)}
 for(const e of d.evidence||[]){const k=key(e.student_id,[e.subject_key,e.outcome_code,e.indicator_index].join("|"));if(!evidence.has(k))evidence.set(k,[]);evidence.get(k).push(e)}
 for(const l of evidence.values())l.sort((a,b)=>a.submitted_at.localeCompare(b.submitted_at));
 for(const l of plans.values())l.sort((a,b)=>(a.assigned_at||"").localeCompare(b.assigned_at||""));
 let all=[];
 for(const student of roster.values()){
  const session=sessions.get(String(student.id))||{login:null,seen:null,expires:null},now=Date.now();
  const online=!!session.seen&&now-Date.parse(session.seen)<=5*60000&&Date.parse(session.expires)>now;
  for(const ind of d.indicators){
   const k=key(student.id,ind.key),scores=evidence.get(k)||[],tasks=plans.get(k)||[],latest=scores[scores.length-1]||null,last=tasks[tasks.length-1]||null;
   const completed=tasks.filter(t=>t.solved).sort((a,b)=>(b.completed_at||"").localeCompare(a.completed_at||""))[0]||null;
   let before=null,after=null,change=null,impact="لا يوجد تدخل مكتمل";
   if(completed){
    before=scores.find(e=>String(e.attempt_id)===String(completed.source_attempt_id))||null;
    after=scores.filter(e=>e.submitted_at>completed.completed_at&&String(e.attempt_id)!==String(completed.source_attempt_id)).slice(-1)[0]||null;
    if(!before)impact="القياس القبلي غير موثق";
    else if(!after)impact="بانتظار اختبار بعدي";
    else if(after.total<5)impact="قياس بعدي محدود";
    else if(before.total<5)impact=P(after)>=80?"إتقان بعدي موثق، والقبلي محدود":"نتيجة بعدية موثقة، والمقارنة القبلية محدودة";
    else {change=Math.round((P(after)-P(before))*10)/10;impact=P(after)>=80?"إتقان بعدي موثق":change>0?"تحسّن ولم يتقن":change<0?"تراجع الأداء":"دون تغيير"}
   }
   const p=P(latest),level=p==null?"unmeasured":p<50?"remedial":p<80?"reinforcement":"enrichment";
   const status=last?.solved?"completed":last?.started_at?"in_progress":last?"assigned":"missing";
   all.push({student,session,online,ind,scores,tasks,latest,last,before,after,change,impact,level,status,p,solved:tasks.filter(t=>t.solved).length});
  }
 }
 M.rows=all;
}
const pill=(s,c)=>'<span class="tmo-pill '+(c||"")+'">'+E(s)+'</span>';
function filtered(){const q=M.q.trim().toLowerCase();return M.rows.filter(r=>
 (M.subject==="all"||r.ind.subject_key===M.subject)&&(M.indicator==="all"||r.ind.key===M.indicator)&&
 (M.cls==="all"||r.student.class_name===M.cls)&&(M.tier==="all"||r.level===M.tier)&&
 (M.state==="all"||r.status===M.state||M.state==="waiting"&&r.impact==="بانتظار اختبار بعدي"||M.state==="mastered"&&r.impact.startsWith("إتقان بعدي موثق"))&&
 (M.presence==="all"||M.presence==="online"&&r.online||M.presence==="never"&&!r.session.login||M.presence==="visited"&&!!r.session.login)&&
 (!q||String(r.student.full_name).toLowerCase().includes(q)||String(r.student.class_name).includes(q)||String(r.ind.indicator_text).toLowerCase().includes(q)))}
function select(id,current,vals){return '<select id="'+id+'">'+vals.map(x=>'<option value="'+E(x[0])+'" '+(current===x[0]?'selected':'')+'>'+E(x[1])+'</option>').join("")+'</select>'}
function line(r){
 let a=r.latest;
 const completed=r.last?.solved?r.last:null;
 const posttest=completed?(M.data?.posttests||[]).find(p=>String(p.source_task_id)===String(completed.id)):null;
 const action=completed?(posttest?'<span class="tmo-sub">القياس البعدي: '+E(posttest.status==="completed"?"مكتمل":posttest.status==="in_progress"?"بدأ ولم يسلّم":"ينتظر الطالب")+'</span>':'<button class="tmo-button secondary" data-tmo-assign="'+E(completed.id)+'" style="padding:5px 8px;margin-top:5px">إسناد قياس بعدي</button>'):'';
 const quality=!a?"لم يقس":a.total<5?"قياس محدود":r.p>=80?"نتيجة مرتفعة":"يحتاج دعمًا";
 return '<tr><td><b>'+E(r.student.full_name)+'</b><span class="tmo-sub">'+E(r.student.class_name)+'</span></td>'+
 '<td>'+pill(r.online?"نشط الآن":r.session.login?"سبق دخوله":"لم يدخل",r.online?"green":r.session.login?"":"red")+'<span class="tmo-sub">آخر دخول '+D(r.session.login)+'</span><span class="tmo-sub">آخر نشاط '+D(r.session.seen)+'</span></td>'+
 '<td>'+E(subj(r.ind.subject_key))+'<span class="tmo-sub">'+E(r.ind.indicator_text)+'</span></td>'+
 '<td>'+(a?N(a.score)+' / '+N(a.total)+' <b>'+N(r.p)+'%</b><span class="tmo-sub">'+D(a.submitted_at)+'</span><span class="tmo-sub">معرفة '+N(a.knowledge_score)+'/'+N(a.knowledge_total)+' · تطبيق '+N(a.application_score)+'/'+N(a.application_total)+' · استدلال '+N(a.reasoning_score)+'/'+N(a.reasoning_total)+'</span>':'—')+'<div>'+pill(quality,a&&a.total>=5?"green":"yellow")+'</div></td>'+
 '<td>'+pill(tier(r.level),r.level==="remedial"?"red":r.level==="enrichment"?"green":"yellow")+'</td>'+
 '<td>'+pill(plan(r.status),r.status==="completed"?"green":r.status==="missing"?"red":"yellow")+'<span class="tmo-sub">إسناد '+N(r.tasks.length)+' | فتح '+N(r.tasks.filter(t=>t.started_at).length)+' | تسليم '+N(r.solved)+'</span><span class="tmo-sub">'+D(r.last?.assigned_at)+'</span>'+action+'</td>'+
 '<td>'+(r.before?N(r.before.score)+'/'+N(r.before.total)+' ('+N(P(r.before))+'%)':'—')+'</td>'+
 '<td>'+(r.after?N(r.after.score)+'/'+N(r.after.total)+' ('+N(P(r.after))+'%)':'—')+'</td>'+
 '<td>'+(r.change==null?"—":(r.change>0?"+":"")+N(r.change)+" نقطة")+'<div>'+pill(r.impact,r.impact.startsWith("إتقان بعدي موثق")?"green":r.impact==="بانتظار اختبار بعدي"?"yellow":"")+'</div></td></tr>';
}

const loginDay=x=>{if(!x)return "";const t=new Date(x);return Number.isFinite(t.getTime())?new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(t):""};
const todayRiyadh=()=>loginDay(new Date().toISOString());
function attendanceRows(data,applyStatus=true){
 const date=M.attendanceDate||todayRiyadh();
 if(!M.attendanceCache||M.attendanceCache.data!==data||M.attendanceCache.date!==date){
  const map=new Map();
  for(const row of data.sessions||[]){
   const id=String(row.student_id||"");
   if(!id)continue;
   let entry=map.get(id);
   if(!entry){entry={first:null,active:null};map.set(id,entry)}
   if(loginDay(row.created_at)===date&&(!entry.first||String(row.created_at)>String(entry.first.created_at)))entry.first=row;
   if(loginDay(row.last_seen_at)===date&&(!entry.active||String(row.last_seen_at)>String(entry.active.last_seen_at)))entry.active=row;
  }
  M.attendanceCache={data,date,map};
 }
 const map=M.attendanceCache.map;
 return (data.students||[]).filter(st=>M.attendanceClass==="all"||st.class_name===M.attendanceClass).map(st=>{
  const found=map.get(String(st.id))||{first:null,active:null},first=found.first,active=found.active;
  return{student:st,first,active,status:first?"entered":active?"previous":"none"};
 }).filter(x=>!applyStatus||M.attendanceStatus==="all"||x.status===M.attendanceStatus)
 .sort((a,b)=>String(a.student.class_name||"").localeCompare(String(b.student.class_name||""),"ar")||String(a.student.full_name||"").localeCompare(String(b.student.full_name||""),"ar"));
}
function attendanceWidget(data){
 const rows=attendanceRows(data),allClassRows=attendanceRows(data,false),days=(data.sessions||[]).map(x=>loginDay(x.created_at)).filter(Boolean).sort();
 const date=M.attendanceDate||todayRiyadh();
 const baseDate=Date.parse(todayRiyadh()+"T12:00:00Z");
 const recentDates=Array.from({length:30},(_,i)=>{const value=loginDay(new Date(baseDate-i*86400000).toISOString());return[value,new Date(value+"T12:00:00Z").toLocaleDateString("ar-SA",{dateStyle:"medium",timeZone:"Asia/Riyadh"})]});
 if(!recentDates.some(x=>x[0]===date))recentDates.unshift([date,date]);
 const classes=[...new Set((data.students||[]).map(x=>x.class_name).filter(Boolean))].sort();
 const count=status=>allClassRows.filter(x=>x.status===status).length;
 return '<section class="tmo-box" id="tmo-day-register">'+
 '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><strong style="font-size:18px">سجل دخول الطلاب حسب التاريخ</strong><span class="tmo-sub">توقيت السعودية • دخول إلكتروني وليس حضورًا مدرسيًا</span></div><div class="tmo-actions"><button id="tmo-day-csv" class="tmo-button secondary">تصدير CSV</button> <button id="tmo-day-print" class="tmo-button secondary">طباعة الكشف</button></div></div>'+
 '<div class="tmo-filters" style="margin:14px 0"><div><label>التاريخ من القائمة</label>'+select("tmo-day-preset",date,recentDates)+'</div><div><label>تاريخ آخر</label><input type="date" id="tmo-day-date" value="'+E(date)+'"></div>'+
 '<div><label>الفصل</label>'+select("tmo-day-class",M.attendanceClass,[["all","جميع الفصول"],...classes.map(c=>[c,c])])+'</div>'+
 '<div><label>الحالة</label>'+select("tmo-day-status",M.attendanceStatus,[["all","جميع الطلاب"],["entered","دخول مسجل – أخضر"],["previous","نشاط بجلسة سابقة – أصفر"],["none","لا دخول مسجل – أحمر"]])+'</div></div>'+
 '<div class="tmo-grid">'+[["دخلوا في هذا التاريخ",count("entered")],["نشاط بجلسة سابقة",count("previous")],["لا دخول مسجل",count("none")],["إجمالي المعروض",rows.length]].map(p=>'<div class="tmo-stat"><small>'+E(p[0])+'</small><b>'+N(p[1])+'</b></div>').join("")+'</div>'+
 (days.length&&date<days[0]?'<div class="tmo-note">التاريخ المختار أقدم من أقدم جلسة محفوظة؛ هذا الكشف غير كافٍ لإثبات عدم دخول الطلاب.</div>':'')+
 '<div class="tmo-note">الأخضر: أنشأ جلسة دخول في هذا التاريخ. الأصفر: نشاط مسجل بجلسة بدأت سابقًا. الأحمر: لم يظهر دخول أو نشاط في السجلات المتاحة فقط. قد تكون جلسات قديمة حُذفت أو انتهى الاحتفاظ بها. لا تخلط بين الدخول وإكمال التدريب.</div>'+
 '<div class="tmo-wrap" style="max-height:390px"><table class="tmo-table" style="min-width:550px"><thead><tr><th>الطالب</th><th>الفصل</th><th>الحالة</th><th>وقت الدخول</th><th>آخر نشاط</th></tr></thead><tbody>'+
 (rows.length?rows.map(x=>'<tr><td>'+E(x.student.full_name)+'</td><td>'+E(x.student.class_name||"—")+'</td><td>'+pill(x.status==="entered"?"● دخل":x.status==="previous"?"● جلسة سابقة":"● لا دخول مسجل",x.status==="entered"?"green":x.status==="previous"?"yellow":"red")+'</td><td>'+D(x.first?.created_at)+'</td><td>'+D(x.active?.last_seen_at)+'</td></tr>').join(""):'<tr><td colspan="5">لا يوجد طلاب مطابقون للتصفية.</td></tr>')+
 '</tbody></table></div></section>';
}
function exportAttendance(){
 const rows=attendanceRows(M.data);
 const grid=[["الطالب","الفصل","الحالة","وقت الدخول","آخر نشاط"],...rows.map(x=>[x.student.full_name,x.student.class_name,x.status==="entered"?"دخل":x.status==="previous"?"نشط بجلسة سابقة":"لا دخول مسجل",D(x.first?.created_at),D(x.active?.last_seen_at)])];
 const cell=v=>{let str=String(v??"");if(/^[\s]*[=+@-]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"';};
 const csv="\ufeff"+grid.map(row=>row.map(cell).join(",")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="tamakkun-attendance-"+(M.attendanceDate||todayRiyadh())+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function printAttendance(){
 const rows=attendanceRows(M.data),date=M.attendanceDate||todayRiyadh();
 const w=window.open("","_blank","width=900,height=810");if(!w){alert("اسمح بفتح نافذة الطباعة");return}
 try{w.opener=null}catch(_){}
 const trs=rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+E(r.student.full_name)+'</td><td>'+E(r.student.class_name||"—")+'</td><td>'+E(r.status==="entered"?"دخل":r.status==="previous"?"نشط بجلسة سابقة":"لا دخول مسجل")+'</td><td>'+D(r.first?.created_at)+'</td></tr>').join("");
 w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف الدخول</title><style>@page{size:A4;margin:13mm}body{font:12px Tahoma,Arial;color:#183d2e;line-height:1.7}table{width:100%;border-collapse:collapse}th,td{border:1px solid #a2b6a8;padding:7px;text-align:right}th{background:#edf5ef}@media print{button{display:none}}</style></head><body><strong>المملكة العربية السعودية – وزارة التعليم – إدارة التعليم بنجران – مدرسة ابن سينا المتوسطة</strong><h2>سجل دخول الطلاب • تمكّن</h2><p>التاريخ: '+E(date)+' | الفصل: '+E(M.attendanceClass==="all"?"كل الفصول":M.attendanceClass)+'</p><p>الحالة وفق سجلات المنصة المتاحة فقط؛ وليست إثباتًا للحضور المدرسي، وقد تكون سجلات أقدم غير متاحة.</p><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>الحالة</th><th>الدخول</th></tr></thead><tbody>'+trs+'</tbody></table><button onclick="print()">طباعة</button></body></html>');
 w.document.close();w.focus();
}

function render(){
 if(!M.host)return;addCss();
 const d=M.data;
 if(!d){M.host.innerHTML='<section class="tmo tmo-hero"><h1>متابعة دخول الطلاب وإتقان المؤشرات</h1><p>جارٍ قراءة البيانات الموثقة…</p></section>';return}
 const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/100));M.page=Math.min(M.page,pages);
 const pageRows=rows.slice((M.page-1)*100,M.page*100);
 const visited=new Set(d.sessions.map(s=>String(s.student_id))).size,active=new Set(M.rows.filter(r=>r.online).map(r=>r.student.id)).size;
 const stats=[["طلاب مستهدفون",d.students.length],["دخلوا المنصة سابقًا",visited],["نشطون الآن",active],["مؤشرات قِيست",rows.filter(r=>r.latest).length],["إتقان بعد تدخل",rows.filter(r=>r.impact.startsWith("إتقان بعدي موثق")).length],["بانتظار بعدي",rows.filter(r=>r.impact==="بانتظار اختبار بعدي").length]];
 const indicators=[["all","كل المؤشرات"],...d.indicators.filter(x=>M.subject==="all"||x.subject_key===M.subject).map(x=>[x.key,subj(x.subject_key)+" • "+x.indicator_text])];
 const classes=[["all","جميع الفصول"],...Array.from(new Set(d.students.map(s=>s.class_name).filter(Boolean))).sort().map(x=>[x,x])];
 M.host.innerHTML='<div class="tmo"><section class="tmo-hero"><div style="display:flex;align-items:start;justify-content:space-between;gap:15px;flex-wrap:wrap"><div><small>منصة تمكّن • بيانات فعلية</small><h1>متابعة دخول الطلاب وإتقان كل مؤشر</h1><p>الدخول ← إسناد الخطة ← بدء الحل ← التسليم ← قياس قبلي وبعدي مستقل</p></div><div class="tmo-actions" style="display:flex;gap:8px"><button id="tmo-refresh" class="tmo-button secondary">تحديث</button><button id="tmo-export" class="tmo-button secondary">تصدير CSV</button><button id="tmo-print" class="tmo-button secondary">طباعة</button></div></div></section>'+
 '<div class="tmo-grid">'+stats.map(x=>'<div class="tmo-stat"><small>'+E(x[0])+'</small><b>'+N(x[1])+'</b></div>').join("")+'</div>'+
 '<section class="tmo-box tmo-filters"><div><label>اسم الطالب أو المؤشر</label><input id="tmo-search" value="'+E(M.q)+'" placeholder="ابحث هنا" /></div>'+
 '<div><label>المادة</label>'+select("tmo-subject",M.subject,[["all","كل المواد"],["reading","القراءة"],["math","الرياضيات"],["science","العلوم"]])+'</div>'+
 '<div><label>المؤشر</label>'+select("tmo-ind",M.indicator,indicators)+'</div>'+
 '<div><label>الفصل</label>'+select("tmo-class",M.cls,classes)+'</div>'+
 '<div><label>المستوى</label>'+select("tmo-tier",M.tier,[["all","كل المستويات"],["remedial","علاجي"],["reinforcement","تعزيز"],["enrichment","إثراء"],["unmeasured","لم يقس"]])+'</div>'+
 '<div><label>حالة الخطة</label>'+select("tmo-status",M.state,[["all","كل الحالات"],["missing","بلا خطة"],["assigned","لم يبدأ"],["in_progress","بدأ ولم يسلّم"],["completed","سلّم الحل"],["waiting","بانتظار قياس بعدي"],["mastered","إتقان بعدي"]])+'</div>'+
 '<div><label>دخول الطالب</label>'+select("tmo-login",M.presence,[["all","جميع الطلاب"],["online","نشط الآن"],["visited","دخل من قبل"],["never","لم يدخل"]])+'</div></section>'+
 attendanceWidget(d)+
 '<div class="tmo-note">الإتقان البعدي لا يُثبت إلا بنتيجة اختبار جديد للمؤشر نفسه بعد تسليم الخطة، وبعدد ٥ أسئلة على الأقل في القياسين. تُعرض القياسات الأقل «محدودة». آخر دخول للمنصة لا يعني حضور الطالب للمدرسة.</div>'+
 '<section class="tmo-box"><div style="display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap"><b>سجل المتابعة الحقيقي</b><span>'+N(pageRows.length)+' من '+N(rows.length)+' سجل • آخر قراءة '+D(d.generated_at)+'</span></div>'+
 '<div class="tmo-wrap"><table class="tmo-table"><thead><tr><th>الطالب والفصل</th><th>آخر دخول ونشاط</th><th>المؤشر</th><th>القياس الحقيقي</th><th>المستوى</th><th>الخطط وحلّها</th><th>القبلي</th><th>البعدي</th><th>التحسن والإتقان</th></tr></thead><tbody>'+
 (pageRows.length?pageRows.map(line).join(""):'<tr><td colspan="9">لا توجد بيانات مطابقة لهذه التصفية.</td></tr>')+'</tbody></table></div>'+
 '<div class="tmo-nav"><button id="tmo-prev" class="tmo-button secondary" '+(M.page===1?"disabled":"")+'>السابق</button><span>صفحة '+N(M.page)+' / '+N(pages)+'</span><button id="tmo-next" class="tmo-button secondary" '+(M.page===pages?"disabled":"")+'>التالي</button></div></section></div>';
 bind(pages);
 for(const b of M.host.querySelectorAll('[data-tmo-assign]'))b.onclick=()=>assignPosttest(b);
}
function change(name,value){M[name]=value;M.page=1;render()}
function csv(){
 const headers=["اسم الطالب","الفصل","آخر دخول","آخر نشاط","المادة","المؤشر","صحيح","إجمالي","النسبة","المستوى","إسنادات","محلول","حالة الخطة","قبلي","بعدي","تحسن","قياس الأثر"];
 const rows=filtered().map(r=>[r.student.full_name,r.student.class_name,D(r.session.login),D(r.session.seen),subj(r.ind.subject_key),r.ind.indicator_text,r.latest?.score,r.latest?.total,r.p,tier(r.level),r.tasks.length,r.solved,plan(r.status),P(r.before),P(r.after),r.change,r.impact]);
 const content="\ufeff"+[headers,...rows].map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
 const object=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=object;link.download="tamakkun-progress.csv";link.click();setTimeout(()=>URL.revokeObjectURL(object),1200);
}
async function assignPosttest(btn){
 if(!btn||btn.disabled)return;
 if(!confirm("سيُسند للطالب اختبار بعدي مستقل من خمسة أسئلة جديدة للمؤشر نفسه. هل تعتمد الإسناد؟"))return;
 const task_id=btn.dataset.tmoAssign,old=btn.textContent;
 btn.disabled=true;btn.textContent="جارٍ الإسناد…";
 try{
  const result=await request("assign_posttest",{task_id});
  alert(result.message||"تم إسناد القياس البعدي.");
  await load(true);
 }catch(e){alert(e.message);btn.disabled=false;btn.textContent=old}
}
function bind(pages){
 for(const [id,property] of [["tmo-search","q"],["tmo-subject","subject"],["tmo-ind","indicator"],["tmo-class","cls"],["tmo-tier","tier"],["tmo-status","state"],["tmo-login","presence"]]){
  const el=M.host.querySelector("#"+id);if(el)el.onchange=()=>{if(property==="subject")M.indicator="all";change(property,el.value)};
 }
 for(const [id,prop] of [["tmo-day-date","attendanceDate"],["tmo-day-preset","attendanceDate"],["tmo-day-class","attendanceClass"],["tmo-day-status","attendanceStatus"]]){
  const el=M.host.querySelector("#"+id);if(el)el.onchange=()=>{M[prop]=el.value;render()};
 }
 M.host.querySelector("#tmo-day-csv").onclick=exportAttendance;
 M.host.querySelector("#tmo-day-print").onclick=printAttendance;
 M.host.querySelector("#tmo-refresh").onclick=()=>load(true);
 M.host.querySelector("#tmo-export").onclick=csv;
 M.host.querySelector("#tmo-print").onclick=()=>window.print();
 M.host.querySelector("#tmo-prev").onclick=()=>{M.page=Math.max(1,M.page-1);render()};
 M.host.querySelector("#tmo-next").onclick=()=>{M.page=Math.min(pages,M.page+1);render()};
}
async function load(force=false){
 if(M.loading||!M.token)return;const version=M.generation;M.loading=true;
 if(!M.data)render();
 try{const data=await request("snapshot");if(version!==M.generation)return;M.data=data;M.page=1;compile(data);render()}
 catch(e){if(version===M.generation&&M.host){M.host.innerHTML='<div class="tmo"><div class="tmo-hero"><h1>تعذر تحميل المتابعة</h1><p>'+E(e.message)+'</p><button id="tmo-retry" class="tmo-button secondary">إعادة المحاولة</button></div></div>';M.host.querySelector("#tmo-retry").onclick=()=>load(true)}}
 finally{if(version===M.generation)M.loading=false}
}
window.TamakkunStudentMonitor={mount({token,role}={}){if(role!=="teacher")return;const el=document.getElementById("tamakkunStudentMonitorMount");if(!el)return;if(M.token!==token){M.data=null;M.rows=[];M.loading=false;M.attendanceCache=null}M.generation++;M.host=el;M.token=token;if(M.data)render();else load()},unmount(){M.generation++;M.host=null;M.token=null;M.data=null;M.rows=[];M.loading=false;M.attendanceCache=null},refresh(){return load(true)}};
})();