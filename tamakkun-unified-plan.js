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
 for(const st of [sessionStorage,localStorage]){const exact=parse(st.getItem('lugati_exact_session_v2'));if(exact?.token){sessionCache={token:exact.token,role:exact.role||'',profile:exact.profile||exact.student||{}};return sessionCache}}
 for(const st of [sessionStorage,localStorage]){const token=st.getItem('lugati_session_v1');if(token){const profile=parse(st.getItem('lugati_profile_v1'))||{},storedRole=st.getItem('lugati_role_v1')||'';sessionCache={token,role:storedRole||((document.getElementById('plans')||document.querySelector('[data-teacher-only]'))?'teacher':'student'),profile};return sessionCache}}
 return null;
}
async function post(action,extra={}){
 const s=readSession();if(!s?.token)throw new Error('تسجيل الدخول مطلوب.');
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({action,...extra}),cache:'no-store'});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||'تعذر تحميل الخطة.');return d;
}
function overlay(){
 let o=document.getElementById('tamakkunUnifiedPlanOverlay');if(o)return o;
 o=document.createElement('section');o.id='tamakkunUnifiedPlanOverlay';o.className='tup-overlay';o.dir='rtl';
 o.innerHTML='<div class="tup-dialog" role="dialog" aria-modal="true" aria-labelledby="tupTitle"><header class="tup-dialog-head tup-no-print"><h2 id="tupTitle">خطة مؤشرات اختبار معلّمي</h2><div class="tup-actions"><button class="tup-secondary" type="button" data-tup-print>طباعة / حفظ PDF</button><button class="tup-secondary" type="button" data-tup-close>إغلاق</button></div></header><div class="tup-content" id="tupContent"><div class="tup-state">جارٍ تحميل الخطة…</div></div></div>';
 document.body.appendChild(o);o.querySelector('[data-tup-close]').onclick=()=>o.remove();o.addEventListener('click',e=>{if(e.target===o)o.remove()});o.querySelector('[data-tup-print]').onclick=()=>window.print();return o;
}
function tierClass(t){return t==='remedial'?'remedial':t==='reinforcement'?'reinforcement':'enrichment'}
function rowHtml(r){
 return '<tr><td><div class="tup-indicator">'+esc(r.indicator_text)+'</div></td>'+
 '<td><div class="tup-evidence">'+esc(ar(r.question_evidence))+' سؤالًا في الاختبار</div></td>'+
 '<td><span class="tup-diagnostic">'+esc(pct(r.diagnostic_percent))+'</span></td>'+
 '<td><span class="tup-tier '+tierClass(r.tier)+'">'+esc(r.tier_label)+'</span></td>'+
 '<td><div class="tup-action">'+esc(r.action)+'</div><span class="tup-success">معيار الانتقال: '+esc(r.success_criterion)+'</span></td></tr>';
}
function subjectBlock(key,label,rows){
 const list=rows.filter(r=>r.subject_key===key);if(!list.length)return'';
 return '<section class="tup-subject"><div class="tup-subject-title"><h2>'+(key==='math'?'➗ ':'🔬 ')+esc(label)+'</h2><span>'+ar(list.length)+' مؤشرًا من الاختبار نفسه</span></div>'+
 '<div class="tup-table-wrap"><table class="tup-table"><thead><tr><th>المؤشر</th><th>أسئلة الاختبار</th><th>النتيجة</th><th>المسار</th><th>الإجراء المخصص</th></tr></thead><tbody>'+list.map(rowHtml).join('')+'</tbody></table></div></section>';
}
function questionsBlock(groups){
 if(!Array.isArray(groups)||!groups.length)return'';
 return '<section class="tup-practice"><div class="tup-subject-title"><h2>📝 أسئلة الخطة</h2><span>من مؤشرات الاختبار المحدد فقط</span></div>'+
 groups.map((g,gi)=>'<article class="tup-practice-group"><header><b>'+esc(g.indicator_text)+'</b><span class="tup-tier '+tierClass(g.tier)+'">'+esc(g.tier_label)+'</span></header>'+
 ((g.questions||[]).length?'<ol>'+g.questions.map(q=>'<li><div class="tup-qtext">'+esc(q.question_text)+'</div>'+((q.options||[]).length?'<div class="tup-qopts">'+q.options.map((o,i)=>'<span>'+(i+1)+'. '+esc(o)+'</span>').join('')+'</div>':'')+'</li>').join('')+'</ol>':'<div class="tup-warning">'+esc(g.warning||'لا توجد أسئلة صالحة لهذا المؤشر حاليًا.')+'</div>')+
 '</article>').join('')+'</section>';
}
function sourceInfo(d){
 const src=d.selected_source||(Array.isArray(d.sources)&&d.sources.length===1?d.sources[0]:null);
 return src?'<div class="tup-source-note"><b>مصدر الخطة:</b> '+esc(src.title||'اختبار مؤشرات')+' · '+esc(src.subject_label||'')+' · '+esc(date(src.submitted_at))+' · '+esc(ar(src.indicator_count))+' مؤشر</div>':'';
}
function sheet(d){
 const s=d.summary||{},student=d.student||{},rows=d.rows||[],method=d.method||{};
 if(!rows.length)return '<div class="tup-empty"><b>لا يوجد اختبار مؤشرات متعدد مناسب لهذا الطالب.</b><br>الخطة تُنشأ فقط من مؤشرات اختبار معلّمي المحدد.</div>';
 return '<article class="tup-sheet"><header class="tup-sheet-head"><div><div class="tup-kicker">مِنَصَّةُ تَمَكُّن · مرتبطة باختبار معلّمي</div><h1>الخطة العلاجية والتعزيزية والإثرائية</h1><p>الخطة محصورة في مؤشرات الاختبار المحدد. لا تدخل مؤشرات من اختبار سابق ولا من مادة أخرى.</p></div><div class="tup-student-meta"><b>'+esc(student.full_name||'الطالب')+'</b><span>الفصل: '+esc(student.class_name||'—')+'</span><span>التاريخ: '+esc(new Date().toLocaleDateString('ar-SA'))+'</span></div></header>'+
 sourceInfo(d)+
 '<section class="tup-summary"><div class="tup-stat"><span>مؤشرات الاختبار</span><b>'+ar(s.indicators)+'</b></div><div class="tup-stat remedial"><span>علاجي</span><b>'+ar(s.remedial)+'</b></div><div class="tup-stat reinforcement"><span>تعزيز</span><b>'+ar(s.reinforcement)+'</b></div><div class="tup-stat enrichment"><span>إثرائي</span><b>'+ar(s.enrichment)+'</b></div></section>'+
 '<div class="tup-method"><b>قاعدة النطاق:</b> '+esc(method.description||'الخطة مرتبطة بمؤشرات اختبار معلّمي المحدد فقط.')+'</div>'+
 subjectBlock('math','الرياضيات',rows)+subjectBlock('science','العلوم',rows)+questionsBlock(d.question_groups||[])+
 '<footer class="tup-footer"><span>لا يضاف أي مؤشر خارج الاختبار المحدد.</span><span>العلوم والرياضيات تبقيان منفصلتين حسب اختبار كل مادة.</span></footer></article>';
}
async function loadStudent(){
 const o=overlay(),c=o.querySelector('#tupContent');c.innerHTML='<div class="tup-state">جارٍ بناء الخطة من اختبار معلّمي…</div>';
 try{c.innerHTML=sheet(await post('student_unified_plan'))}catch(e){c.innerHTML='<div class="tup-empty">'+esc(e.message)+'</div>'}
}
async function loadTeacherStudent(id,host,sourceKey){
 if(!id){host.innerHTML='<div class="tup-state">اختر الطالب.</div>';return}
 if(!sourceKey){host.innerHTML='<div class="tup-state">اختر اختبار المؤشرات الذي تريد بناء الخطة منه.</div>';return}
 host.innerHTML='<div class="tup-state">جارٍ اختيار أسئلة الخطة من مؤشرات الاختبار فقط…</div>';
 try{host.innerHTML=sheet(await post('teacher_unified_plan',{student_id:id,source_key:sourceKey,questions_per_indicator:3}))}catch(e){host.innerHTML='<div class="tup-empty">'+esc(e.message)+'</div>'}
}
async function loadSources(studentId,sourceSelect,host){
 sourceSelect.innerHTML='<option value="">جارٍ تحميل اختبارات الطالب…</option>';sourceSelect.disabled=true;
 try{
   const d=await post('teacher_unified_sources',{student_id:studentId}),sources=d.sources||[];
   sourceSelect.innerHTML='<option value="">اختر اختبار المؤشرات</option>'+sources.map(x=>'<option value="'+esc(x.source_key)+'">'+esc(x.subject_label||'')+' · '+esc(x.title||'اختبار مؤشرات')+' · '+esc(date(x.submitted_at))+' · '+esc(ar(x.indicator_count))+' مؤشر</option>').join('');
   sourceSelect.disabled=false;
   if(sources[0]){sourceSelect.value=sources[0].source_key;await loadTeacherStudent(studentId,host,sourceSelect.value)}
   else host.innerHTML='<div class="tup-empty">لا يوجد لهذا الطالب اختبار مؤشرات متعدد في العلوم أو الرياضيات.</div>';
 }catch(e){sourceSelect.innerHTML='<option value="">تعذر تحميل الاختبارات</option>';host.innerHTML='<div class="tup-empty">'+esc(e.message)+'</div>'}
}
async function openTeacher(){
 const o=overlay(),c=o.querySelector('#tupContent');c.innerHTML='<div class="tup-state">جارٍ تحميل قائمة الطلاب…</div>';
 try{
   const d=await post('teacher_overview'),students=(d.students||[]).slice().sort((a,b)=>String(a.class_name||'').localeCompare(String(b.class_name||''),'ar')||String(a.full_name||'').localeCompare(String(b.full_name||''),'ar'));
   c.innerHTML='<div class="tup-picker tup-no-print"><label>الطالب<select id="tupStudent" class="tup-select"><option value="">اختر الطالب</option>'+students.map(x=>'<option value="'+esc(x.id)+'">الفصل '+esc(x.class_name||'—')+' · '+esc(x.full_name||'طالب')+'</option>').join('')+'</select></label><label>اختبار معلّمي<select id="tupSource" class="tup-select" disabled><option value="">اختر الطالب أولًا</option></select></label><button id="tupLoadStudent" class="tup-primary" type="button">بناء الخطة</button></div><div id="tupSheetHost"><div class="tup-state">اختر الطالب ثم اختبار المؤشرات.</div></div>';
   const student=c.querySelector('#tupStudent'),source=c.querySelector('#tupSource'),host=c.querySelector('#tupSheetHost');
   student.onchange=()=>{if(student.value)loadSources(student.value,source,host);else{source.innerHTML='<option value="">اختر الطالب أولًا</option>';source.disabled=true;host.innerHTML='<div class="tup-state">اختر الطالب ثم اختبار المؤشرات.</div>'}};
   source.onchange=()=>{if(source.value)loadTeacherStudent(student.value,host,source.value)};
   c.querySelector('#tupLoadStudent').onclick=()=>loadTeacherStudent(student.value,host,source.value);
 }catch(e){c.innerHTML='<div class="tup-empty">'+esc(e.message)+'</div>'}
}
function open(){const s=readSession();if(!s)return;const teacher=s.role==='teacher'||!!document.getElementById('plans');teacher?openTeacher():loadStudent()}
function inject(){
 const s=readSession();if(!s)return;
 document.querySelectorAll('[data-tamakkun-unified-plan]').forEach(b=>{if(b.dataset.tupBound!=='1'){b.dataset.tupBound='1';b.addEventListener('click',open)}});
 const teacher=s.role==='teacher'||!!document.getElementById('plans');
 if(!teacher&&!document.getElementById('tamakkunUnifiedStudentLauncher')&&document.getElementById('app')){const b=document.createElement('button');b.id='tamakkunUnifiedStudentLauncher';b.type='button';b.className='tup-student-launcher';b.innerHTML='📘 <span>خطتي من اختباري</span>';b.addEventListener('click',open);document.body.appendChild(b)}
}
function init(){inject();observer=new MutationObserver(inject);observer.observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();