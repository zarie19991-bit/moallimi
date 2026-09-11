(()=>{
'use strict';
const A=window.NafesAnalytics;
const T=window.NafesTeacher;
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=v=>v===null||v===undefined||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v));
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const SETTINGS_KEY='nafes_school_report_settings_v1';
let attempts=[],tests=[],catalog=[],students=[],loading=false,currentPaperHtml='';
let settings={schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:''};

function loadSettings(){try{settings={...settings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(_){}}
function isSubmitted(a){return A.isSubmitted?A.isSubmitted(a):!!a.submitted_at}
function compareTime(a,b){return A.compareTime?A.compareTime(a,b):new Date(a.submitted_at||0)-new Date(b.submitted_at||0)}
function scorable(q){return A.isScorable?A.isScorable(q):(typeof q.correct==='boolean'&&Number(q.correct_index??q.correctIndex)>=0)}
function indKey(q){return A.indicatorKey?A.indicatorKey(q):(q.indicator_key||null)}
function studentIdOf(s){return String(s.student_id||s.id||s.uuid||'').trim()}
function studentNameOf(s){return String(s.full_name||s.student_name||s.name||'').trim()}
function classOf(s){return String(s.class_name||s.class||s.section||'').trim()}
function attemptName(a){return String(a.student_name||'').trim()}
function sameStudent(a,s){const id=studentIdOf(s);if(id&&String(a.student_id||'').trim())return String(a.student_id).trim()===id;return attemptName(a)===studentNameOf(s)&&String(a.class_name||'').trim()===classOf(s)}
function qForIndicator(a,subject,key){return (a.questions||[]).filter(q=>q.subject===subject&&indKey(q)===key&&scorable(q))}
function latestAttemptForStudent(s,subject,key){const list=attempts.filter(a=>isSubmitted(a)&&sameStudent(a,s)&&qForIndicator(a,subject,key).length).sort(compareTime);return list[list.length-1]||null}
function testTitle(id){return tests.find(t=>String(t.id)===String(id))?.title||id||'اختبار نافس'}
function logoHtml(src,label){return src?`<img src="${src}" alt="${E(label)}">`:`<span class="logo-placeholder">${E(label)} غير مرفوع</span>`}
function answerText(q){
  if(q.answer_text!==undefined&&q.answer_text!==null)return String(q.answer_text);
  if(q.selected_text!==undefined&&q.selected_text!==null)return String(q.selected_text);
  const ans=q.answer??q.selected_index??q.selectedIndex;
  if(ans===null||ans===undefined||ans==='')return 'لم يجب';
  const i=Number(ans);if(Number.isInteger(i)&&Array.isArray(q.options)&&q.options[i]!==undefined)return String(q.options[i]);
  return String(ans);
}
function correctText(q){
  if(q.correct_answer!==undefined&&q.correct_answer!==null)return String(q.correct_answer);
  const i=Number(q.correct_index??q.correctIndex);
  if(Number.isInteger(i)&&Array.isArray(q.options)&&q.options[i]!==undefined)return String(q.options[i]);
  return 'غير متاح';
}
function indicatorRows(subject){
  const rows=catalog.filter(i=>(i.subject||i.subject_key)===subject).map(i=>({key:i.key||i.indicator_key,text:i.text||i.indicator_text||i.key||i.indicator_key})).filter(x=>x.key);
  const seen=new Set();return rows.filter(x=>!seen.has(x.key)&&seen.add(x.key));
}
function populateIndicators(){
  const subject=$('paperSubject').value;const rows=indicatorRows(subject);
  $('indicatorSelect').innerHTML=rows.length?`<option value="">اختر المؤشر</option>${rows.map(x=>`<option value="${E(x.key)}">${E(x.text)}</option>`).join('')}`:'<option value="">لا توجد مؤشرات لهذه المادة</option>';
  $('studentsList').innerHTML='<p class="muted">اختر مؤشرًا لعرض الطلاب.</p>';$('paperPanel').hidden=true;
}
function realRosterForClass(cls){
  const roster=students.filter(s=>classOf(s)===cls);
  if(roster.length)return roster.slice().sort((a,b)=>studentNameOf(a).localeCompare(studentNameOf(b),'ar'));
  const map=new Map();
  for(const a of attempts.filter(x=>String(x.class_name||'').trim()===cls&&attemptName(x))){const k=String(a.student_id||attemptName(a));if(!map.has(k))map.set(k,{student_id:a.student_id||'',full_name:attemptName(a),class_name:cls})}
  return [...map.values()].sort((a,b)=>studentNameOf(a).localeCompare(studentNameOf(b),'ar'));
}
function renderStudents(){
  const cls=$('classSelect').value,subject=$('paperSubject').value,key=$('indicatorSelect').value;
  $('studentsTitle').textContent=`طلاب الفصل ${cls} — ${names[subject]}`;
  if(!key){$('studentsList').innerHTML='<p class="muted">اختر المؤشر أولًا.</p>';$('paperPanel').hidden=true;return}
  const roster=realRosterForClass(cls);
  if(!roster.length){$('studentsList').innerHTML='<p class="muted">لا توجد أسماء طلاب حقيقية مسجلة في هذا الفصل.</p>';return}
  const rows=roster.map(s=>{const a=latestAttemptForStudent(s,subject,key);return[
    `<b>${E(studentNameOf(s))}</b>`,E(cls),a?'<span class="badge mastered">مختبر</span>':'<span class="badge unmeasured">لم يختبر</span>',a?E(testTitle(a.test_id)):'—',a?`<button class="btn primary btn-paper" data-student-id="${E(studentIdOf(s))}" data-student-name="${E(studentNameOf(s))}">عرض ورقة الإجابة</button>`:'—'
  ]});
  $('studentsList').innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>اسم الطالب</th><th>الفصل</th><th>الحالة</th><th>الاختبار</th><th>ورقة الإجابة</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  document.querySelectorAll('.btn-paper').forEach(btn=>btn.onclick=()=>openPaper(btn.dataset.studentId,btn.dataset.studentName));
}
function findRosterStudent(id,name){const cls=$('classSelect').value;return realRosterForClass(cls).find(s=>(id&&studentIdOf(s)===id)||(!id&&studentNameOf(s)===name))}
function openPaper(id,name){
  const s=findRosterStudent(id,name);if(!s)return;
  const subject=$('paperSubject').value,key=$('indicatorSelect').value;const a=latestAttemptForStudent(s,subject,key);if(!a){$('paperPanel').hidden=false;$('paperPanel').innerHTML='<p class="muted">لا توجد محاولة حقيقية مسلّمة لهذا الطالب في المؤشر المحدد.</p>';return}
  const qs=qForIndicator(a,subject,key);const correct=qs.filter(q=>q.correct).length;const ind=indicatorRows(subject).find(x=>x.key===key);
  const submitted=a.submitted_at?new Date(a.submitted_at).toLocaleString('ar-SA'):'—';
  const questions=qs.map((q,i)=>`<div class="paper-question">
    <div class="paper-q-head"><b>السؤال ${ar(i+1)}</b><span class="badge ${q.correct?'mastered':'nonmastered'}">${q.correct?'صحيحة':'خاطئة'}</span></div>
    ${q.context_text||q.context?`<div class="paper-context">${E(q.context_text||q.context)}</div>`:''}
    <p class="paper-stem">${E(q.question||q.question_text||'نص السؤال غير متاح')}</p>
    ${Array.isArray(q.options)?`<ol class="paper-options">${q.options.map((o,idx)=>`<li class="${Number(q.answer??q.selected_index)===idx?'student-choice':''} ${Number(q.correct_index??q.correctIndex)===idx?'correct-choice':''}">${E(o)}</li>`).join('')}</ol>`:''}
    <div class="paper-answer-line"><span>إجابة الطالب: <b>${E(answerText(q))}</b></span><span>الإجابة الصحيحة: <b>${E(correctText(q))}</b></span></div>
  </div>`).join('');
  currentPaperHtml=`<article class="report-sheet answer-paper">
    <header class="report-head">
      <div class="report-admin"><b>المملكة العربية السعودية</b><br>وزارة التعليم<br>الإدارة العامة للتعليم بمنطقة نجران<br><b>${E(settings.schoolName||'')}</b></div>
      <div class="report-ministry">${logoHtml(settings.ministryLogo,'شعار وزارة التعليم')}</div>
      <div class="report-school-logo">${logoHtml(settings.schoolLogo,'شعار المدرسة')}</div>
    </header>
    <div class="report-title"><h2>ورقة إجابة الطالب</h2><p>${E(testTitle(a.test_id))}</p></div>
    <div class="report-meta"><div><span>اسم الطالب</span><b>${E(studentNameOf(s))}</b></div><div><span>الفصل</span><b>${E(classOf(s))}</b></div><div><span>المادة</span><b>${E(names[subject])}</b></div><div><span>تاريخ التسليم</span><b>${E(submitted)}</b></div></div>
    <div class="report-block"><h3>المؤشر</h3><p>${E(ind?.text||key)}</p></div>
    <div class="paper-score-row"><b>النتيجة في المؤشر: ${ar(correct)} / ${ar(qs.length)}</b></div>
    <div class="paper-questions">${questions}</div>
    <footer class="paper-footer"><span>المعلم: ${E(settings.teacherName||'—')}</span><span>مدير المدرسة: ${E(settings.principalName||'—')}</span></footer>
  </article>`;
  $('paperPanel').hidden=false;$('paperPanel').innerHTML=`<div class="section-head"><div><h2>ورقة إجابة ${E(studentNameOf(s))}</h2><p class="muted">ورقة حقيقية من المحاولة المسلّمة. لا يوجد فيها تحليل للطالب.</p></div><button id="printPaperBtn" class="btn primary">طباعة / حفظ PDF</button></div>${currentPaperHtml}`;
  $('printPaperBtn').onclick=()=>{$('printRoot').innerHTML=currentPaperHtml;$('printRoot').setAttribute('aria-hidden','false');window.print()};
  $('paperPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
async function load(){
  if(loading)return;if(!T?.getKey?.()){$('authPanel').hidden=false;return}
  loading=true;$('authPanel').hidden=true;$('loadError').hidden=true;$('loadState').textContent='جارٍ تحميل الطلاب والمحاولات الحقيقية…';
  try{
    let cursor=0,all=[],testList=[],ind=[];
    do{const d=await T.api('teacher_data',{cursor,limit:100});all.push(...(d.attempts||[]));if(cursor===0){testList=d.tests||[];ind=d.indicators||[]}cursor=d.next_cursor}while(cursor!==null);
    const s=await T.api('teacher_students_list',{include_archived:false});students=s.students||[];
    attempts=all.map(x=>A.normalizeAttempt?A.normalizeAttempt(x):x);tests=testList;catalog=ind;
    $('refreshBtn').hidden=false;$('signoutBtn').hidden=false;$('papersDashboard').hidden=false;populateIndicators();
  }catch(err){$('loadError').hidden=false;$('loadErrorText').textContent=err.message||String(err);if(err.status===401)$('authPanel').hidden=false}
  finally{loading=false;$('loadState').textContent=''}
}
loadSettings();
$('authForm').onsubmit=e=>{e.preventDefault();T.setKey($('teacherKey').value);$('teacherKey').value='';load()};
$('retryBtn').onclick=load;$('refreshBtn').onclick=load;
$('signoutBtn').onclick=()=>{T.clearKey();attempts=[];tests=[];catalog=[];students=[];$('papersDashboard').hidden=true;$('authPanel').hidden=false;$('refreshBtn').hidden=true;$('signoutBtn').hidden=true};
$('classSelect').onchange=renderStudents;$('paperSubject').onchange=populateIndicators;$('indicatorSelect').onchange=renderStudents;
addEventListener('nafes:auth-required',()=>{$('authPanel').hidden=false});addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)load()});
load();
})();