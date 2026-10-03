(()=>{'use strict';
const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-adaptive-plan';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const ar=n=>Number(n||0).toLocaleString('ar-SA',{maximumFractionDigits:1});
const pct=n=>n==null?'—':ar(n)+'٪';
const date=v=>{if(!v)return'—';try{return new Date(v).toLocaleDateString('ar-SA',{year:'numeric',month:'2-digit',day:'2-digit'})}catch{return'—'}};
let sessionCache=null,observer=null;
function parse(v){try{return JSON.parse(v||'null')}catch{return null}}
function readSession(){
 if(sessionCache?.token)return sessionCache;
 for(const st of [sessionStorage,localStorage]){
   const exact=parse(st.getItem('lugati_exact_session_v2'));
   if(exact?.token){sessionCache={token:exact.token,role:exact.role||'',profile:exact.profile||exact.student||{}};return sessionCache}
 }
 for(const st of [sessionStorage,localStorage]){
   const token=st.getItem('lugati_session_v1');
   if(token){const profile=parse(st.getItem('lugati_profile_v1'))||{};const storedRole=st.getItem('lugati_role_v1')||'';sessionCache={token,role:storedRole||((document.getElementById('plans')||document.querySelector('[data-teacher-only]'))?'teacher':'student'),profile};return sessionCache}
 }
 return null;
}
async function post(action,extra={}){
 const s=readSession();if(!s?.token)throw new Error('تسجيل الدخول مطلوب.');
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({action,...extra}),cache:'no-store'});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||'تعذر تحميل الخطة الموحدة.');return d;
}
function overlay(){
 let o=document.getElementById('tamakkunUnifiedPlanOverlay');if(o)return o;
 o=document.createElement('section');o.id='tamakkunUnifiedPlanOverlay';o.className='tup-overlay';o.dir='rtl';o.innerHTML='<div class="tup-dialog" role="dialog" aria-modal="true" aria-labelledby="tupTitle"><header class="tup-dialog-head tup-no-print"><h2 id="tupTitle">الخطة الموحدة للرياضيات والعلوم</h2><div class="tup-actions"><button class="tup-secondary" type="button" data-tup-print>طباعة / حفظ PDF</button><button class="tup-secondary" type="button" data-tup-close>إغلاق</button></div></header><div class="tup-content" id="tupContent"><div class="tup-state">جارٍ تحميل الخطة…</div></div></div>';
 document.body.appendChild(o);
 o.querySelector('[data-tup-close]').onclick=()=>o.remove();
 o.addEventListener('click',e=>{if(e.target===o)o.remove()});
 o.querySelector('[data-tup-print]').onclick=()=>window.print();
 return o;
}
function tierClass(t){return t==='remedial'?'remedial':t==='reinforcement'?'reinforcement':'enrichment'}
function trend(v){
 if(v==null)return'<span class="tup-trend flat">قياس واحد</span>';
 if(Number(v)>1)return'<span class="tup-trend up">▲ +'+esc(ar(v))+' نقطة</span>';
 if(Number(v)<-1)return'<span class="tup-trend down">▼ '+esc(ar(v))+' نقطة</span>';
 return'<span class="tup-trend flat">≈ مستقر</span>';
}
function rowHtml(r){
 return '<tr><td><div class="tup-indicator">'+esc(r.indicator_text)+'</div><div class="tup-latest">آخر قياس: '+esc(date(r.last_measured_at))+'</div></td>'+
 '<td><div class="tup-evidence">'+esc(ar(r.measurements))+' قياس · '+esc(ar(r.question_evidence))+' سؤال</div>'+trend(r.trend_points)+'</td>'+
 '<td><span class="tup-diagnostic">'+esc(pct(r.diagnostic_percent))+'</span><span class="tup-latest">الأحدث '+esc(pct(r.latest_percent))+'</span></td>'+
 '<td><span class="tup-tier '+tierClass(r.tier)+'">'+esc(r.tier_label)+'</span></td>'+
 '<td><div class="tup-action">'+esc(r.action)+'</div><span class="tup-success">معيار الانتقال: '+esc(r.success_criterion)+'</span></td></tr>';
}
function subjectBlock(key,label,rows){
 const list=rows.filter(r=>r.subject_key===key);if(!list.length)return'';
 return '<section class="tup-subject"><div class="tup-subject-title"><h2>'+(key==='math'?'➗ ':'🔬 ')+esc(label)+'</h2><span>'+ar(list.length)+' مؤشرًا في الوثيقة</span></div>'+
 '<div class="tup-table-wrap"><table class="tup-table"><thead><tr><th>المؤشر</th><th>الأدلة والاتجاه</th><th>التشخيص</th><th>المسار</th><th>الإجراء المخصص</th></tr></thead><tbody>'+list.map(rowHtml).join('')+'</tbody></table></div></section>';
}
function sheet(d){
 const s=d.summary||{},student=d.student||{},rows=d.rows||[],method=d.method||{};
 if(!rows.length)return '<div class="tup-empty"><b>لا توجد بيانات رياضيات أو علوم متاحة ضمن صلاحية هذا الحساب.</b><br>تظهر الخطة بعد وجود قياس فعلي لمؤشر واحد على الأقل.</div>';
 return '<article class="tup-sheet"><header class="tup-sheet-head"><div><div class="tup-kicker">مِنَصَّةُ تَمَكُّن · خطة تعلم موحدة</div><h1>الخطة العلاجية والتعزيزية والإثرائية</h1><p>وثيقة واحدة تجمع قياسات الطالب المتعددة في الرياضيات والعلوم، وتحوّل كل مؤشر إلى الإجراء الأنسب بدل طباعة خطة مستقلة لكل اختبار.</p></div><div class="tup-student-meta"><b>'+esc(student.full_name||'الطالب')+'</b><span>الفصل: '+esc(student.class_name||'—')+'</span><span>آخر تحديث: '+esc(new Date().toLocaleDateString('ar-SA'))+'</span></div></header>'+
 '<section class="tup-summary"><div class="tup-stat"><span>المؤشرات المقاسة</span><b>'+ar(s.indicators)+'</b></div><div class="tup-stat remedial"><span>علاجي</span><b>'+ar(s.remedial)+'</b></div><div class="tup-stat reinforcement"><span>تعزيز</span><b>'+ar(s.reinforcement)+'</b></div><div class="tup-stat enrichment"><span>إثرائي</span><b>'+ar(s.enrichment)+'</b></div></section>'+
 '<div class="tup-method"><b>أساس القرار:</b> '+esc(method.description||'تشخيص تراكمي للقياسات المتاحة.')+' <b>الحدود:</b> علاجي أقل من 70٪ · تعزيز من 70٪ إلى أقل من 90٪ · إثرائي 90٪ فأعلى.</div>'+
 subjectBlock('math','الرياضيات',rows)+subjectBlock('science','العلوم',rows)+
 '<footer class="tup-footer"><span>تتغير الخطة تلقائيًا عند وصول قياس جديد.</span><span>لا تُعد نتيجة مسابقة المؤشرات بديلًا عن قياس الإتقان الرسمي.</span></footer></article>';
}
async function loadStudent(){
 const o=overlay(),c=o.querySelector('#tupContent');c.innerHTML='<div class="tup-state">جارٍ جمع نتائج الاختبارات وبناء الخطة…</div>';
 try{c.innerHTML=sheet(await post('student_unified_plan'))}catch(e){c.innerHTML='<div class="tup-empty">'+esc(e.message)+'</div>'}
}
async function loadTeacherStudent(id,host){
 if(!id){host.innerHTML='<div class="tup-state">اختر الطالب لعرض خطته الموحدة.</div>';return}
 host.innerHTML='<div class="tup-state">جارٍ دمج قياسات الطالب…</div>';
 try{host.innerHTML=sheet(await post('teacher_unified_plan',{student_id:id}))}catch(e){host.innerHTML='<div class="tup-empty">'+esc(e.message)+'</div>'}
}
async function openTeacher(){
 const o=overlay(),c=o.querySelector('#tupContent');c.innerHTML='<div class="tup-state">جارٍ تحميل قائمة الطلاب…</div>';
 try{
   const d=await post('teacher_overview'),students=(d.students||[]).slice().sort((a,b)=>String(a.class_name||'').localeCompare(String(b.class_name||''),'ar')||String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'));
   c.innerHTML='<div class="tup-picker tup-no-print"><label>الطالب<select id="tupStudent" class="tup-select"><option value="">اختر الطالب</option>'+students.map(x=>'<option value="'+esc(x.id)+'">الفصل '+esc(x.class_name||'—')+' · '+esc(x.full_name||'طالب')+'</option>').join('')+'</select></label><button id="tupLoadStudent" class="tup-primary" type="button">بناء الخطة الموحدة</button></div><div id="tupSheetHost"><div class="tup-state">اختر طالبًا لدمج جميع قياساته في الرياضيات والعلوم.</div></div>';
   const select=c.querySelector('#tupStudent'),host=c.querySelector('#tupSheetHost');
   c.querySelector('#tupLoadStudent').onclick=()=>loadTeacherStudent(select.value,host);
   select.onchange=()=>{if(select.value)loadTeacherStudent(select.value,host)};
 }catch(e){c.innerHTML='<div class="tup-empty">'+esc(e.message)+'</div>'}
}
function open(){const s=readSession();if(!s)return;const teacher=s.role==='teacher'||!!document.getElementById('plans');teacher?openTeacher():loadStudent()}
function inject(){
 const s=readSession();if(!s)return;
 document.querySelectorAll('[data-tamakkun-unified-plan]').forEach(b=>{if(b.dataset.tupBound!=='1'){b.dataset.tupBound='1';b.addEventListener('click',open)}});
 const teacher=s.role==='teacher'||!!document.getElementById('plans');
 if(!teacher&&!document.getElementById('tamakkunUnifiedStudentLauncher')&&document.getElementById('app')){
   const b=document.createElement('button');b.id='tamakkunUnifiedStudentLauncher';b.type='button';b.className='tup-student-launcher';b.innerHTML='📘 <span>خطتي الموحدة</span>';b.addEventListener('click',open);document.body.appendChild(b);
 }
}
function init(){inject();observer=new MutationObserver(inject);observer.observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();