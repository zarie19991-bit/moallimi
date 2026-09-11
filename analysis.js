(()=>{
'use strict';
const A=window.NafesAnalytics;
const T=window.NafesTeacher;
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=v=>v===null||v===undefined||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v));
const pct=v=>v===null||v===undefined||Number.isNaN(Number(v))?'غير مقاس':`${ar(v)}٪`;
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const icons={reading:'📖',math:'📐',science:'🔬'};
const subjectKeys=['reading','math','science'];
const SETTINGS_KEY='nafes_school_report_settings_v1';
let attempts=[],tests=[],catalog=[],students=[];
let currentView='overview';
let loading=false;
let reportHtml='';
let settings={schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:''};

function mean(a){const v=a.filter(x=>x!==null&&Number.isFinite(x));return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function median(a){const v=a.filter(x=>x!==null&&Number.isFinite(x)).slice().sort((x,y)=>x-y);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
function level(p){if(p===null||p===undefined)return{key:'unmeasured',label:'غير مقاس'};if(p>=80)return{key:'mastered',label:'متقن'};if(p>=65)return{key:'near',label:'قريب من الإتقان'};if(p>=50)return{key:'support',label:'بحاجة إلى دعم'};return{key:'nonmastered',label:'غير متقن'}}
function badge(p){const l=level(p);return `<span class="badge ${l.key}">${l.label}</span>`}
function identity(a){return a.studentIdentity||A.studentIdentity?.(a)||`attempt:${a.id}`}
function scorable(q){return A.isScorable?A.isScorable(q):(typeof q.correct==='boolean'&&Number(q.correct_index??q.correctIndex)>=0)}
function indKey(q){return A.indicatorKey?A.indicatorKey(q):(q.indicator_key||null)}
function isSubmitted(a){return A.isSubmitted?A.isSubmitted(a):!!a.submitted_at}
function measure(a,subject){return A.measure?A.measure(a,{subject}):(()=>{const q=(a.questions||[]).filter(x=>x.subject===subject&&scorable(x));const c=q.filter(x=>x.correct).length;return{correct:c,total:q.length,percent:q.length?c/q.length*100:null}})()}
function compareTime(a,b){return A.compareTime?A.compareTime(a,b):new Date(a.submitted_at||0)-new Date(b.submitted_at||0)}
function classMatches(a,className){return !className||String(a.class_name||'').trim()===className}
function submitted(){return attempts.filter(isSubmitted)}

function latestPerStudentSubject(subject,className=''){
  const map=new Map();
  for(const a of submitted()){
    if(!classMatches(a,className))continue;
    const m=measure(a,subject);if(!m.total)continue;
    const k=identity(a);
    const prev=map.get(k);
    if(!prev||compareTime(a,prev.a)>0)map.set(k,{a,m});
  }
  return [...map.values()];
}
function latestPerStudentTest(testId){
  const map=new Map();
  for(const a of submitted().filter(x=>x.test_id===testId)){
    const k=identity(a),prev=map.get(k);
    if(!prev||compareTime(a,prev)>0)map.set(k,a);
  }
  return [...map.values()];
}
function summaryFromPercents(values){
  const v=values.filter(x=>x!==null&&Number.isFinite(x));
  const avg=mean(v),med=median(v),high=v.length?Math.max(...v):null,low=v.length?Math.min(...v):null;
  const mastered=v.filter(x=>x>=80).length;
  return{count:v.length,avg,median:med,high,low,mastery:v.length?mastered/v.length*100:null,mastered};
}
function metricsHtml(s){return `<div class="metrics">
  <div class="metric"><span>عدد الطلاب المقاسين</span><b>${ar(s.count)}</b></div>
  <div class="metric"><span>المتوسط</span><b>${pct(s.avg)}</b></div>
  <div class="metric"><span>الوسيط</span><b>${pct(s.median)}</b></div>
  <div class="metric"><span>أعلى نتيجة</span><b>${pct(s.high)}</b></div>
  <div class="metric"><span>أقل نتيجة</span><b>${pct(s.low)}</b></div>
  <div class="metric"><span>نسبة الإتقان</span><b>${pct(s.mastery)}</b></div>
</div>`}
function table(headers,rows,klass=''){
  return `<div class="table-wrap"><table class="data-table ${klass}"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="muted">لا توجد بيانات حقيقية في هذا النطاق.</td></tr>`}</tbody></table></div>`
}
function normalizeStudentName(a){return a.student_name||a.full_name||'اسم غير مسجل'}

function renderOverview(){
  const className=$('overviewClass').value;
  const subjectRecords={};
  for(const s of subjectKeys)subjectRecords[s]=latestPerStudentSubject(s,className);
  const cards=subjectKeys.map(s=>{
    const vals=subjectRecords[s].map(x=>x.m.percent);const sum=summaryFromPercents(vals);
    return `<div class="subject-card"><h3>${icons[s]} ${names[s]}</h3><div class="big">${pct(sum.avg)}</div><div class="sub">${ar(sum.count)} طالبًا مقاسًا · الإتقان ${pct(sum.mastery)}</div></div>`
  }).join('');
  const studentMap=new Map();
  for(const s of subjectKeys){for(const rec of subjectRecords[s]){const k=identity(rec.a);if(!studentMap.has(k))studentMap.set(k,{name:normalizeStudentName(rec.a),className:rec.a.class_name||'—',values:{}});studentMap.get(k).values[s]=rec.m.percent}}
  const rows=[...studentMap.values()].map(st=>{const vals=subjectKeys.map(s=>st.values[s]).filter(v=>v!==undefined&&v!==null);const overall=mean(vals);return{...st,overall}}).sort((a,b)=>(a.overall??999)-(b.overall??999));
  const overallSummary=summaryFromPercents(rows.map(r=>r.overall));
  $('overviewSummary').innerHTML=`${metricsHtml(overallSummary)}<div class="subject-cards">${cards}</div>`;
  $('overviewStudents').innerHTML=`<section class="section-card"><div class="section-head"><div><h2>مستوى الطلاب في المواد الثلاث</h2><p class="muted">تعتمد كل مادة على أحدث نتيجة حقيقية متاحة للطالب فيها. لا تُنشأ درجة للمادة غير المقاسة.</p></div></div>${table(['اسم الطالب','الفصل','القراءة','الرياضيات','العلوم','المتوسط','المستوى'],rows.map(r=>[
    `<b>${E(r.name)}</b>`,E(r.className),pct(r.values.reading??null),pct(r.values.math??null),pct(r.values.science??null),pct(r.overall),badge(r.overall)
  ]))}</section>`;
}

function aggregateIndicators(records,subject){
  const groups=new Map();
  for(const {a} of records){for(const q of a.questions||[]){if(q.subject!==subject||!scorable(q))continue;const k=indKey(q);if(!k)continue;if(!groups.has(k))groups.set(k,{key:k,text:q.indicator_text||k,correct:0,total:0,students:new Set()});const g=groups.get(k);g.total++;if(q.correct)g.correct++;g.students.add(identity(a));}}
  return [...groups.values()].map(g=>({...g,percent:g.total?g.correct/g.total*100:null})).sort((a,b)=>(a.percent??999)-(b.percent??999));
}
function qFingerprint(q){return q.question_fingerprint||JSON.stringify([q.subject||'',indKey(q)||'',String(q.question||'').trim()])}
function aggregateQuestions(records,subject){
  const groups=new Map();
  for(const {a} of records){for(const q of a.questions||[]){if(q.subject!==subject||!scorable(q))continue;const k=qFingerprint(q);if(!groups.has(k))groups.set(k,{question:q.question||'نص السؤال غير متاح',indicator:q.indicator_text||indKey(q)||'—',wrong:0,total:0});const g=groups.get(k);g.total++;if(!q.correct)g.wrong++;}}
  return [...groups.values()].map(g=>({...g,failure:g.total?g.wrong/g.total*100:null})).sort((a,b)=>(b.failure??-1)-(a.failure??-1));
}
function renderSubject(){
  const subject=$('subjectSelect').value,className=$('subjectClass').value;
  const records=latestPerStudentSubject(subject,className);
  const vals=records.map(x=>x.m.percent);const sum=summaryFromPercents(vals);
  $('subjectSummary').innerHTML=metricsHtml(sum);
  const stuRows=records.slice().sort((a,b)=>(a.m.percent??999)-(b.m.percent??999)).map(({a,m})=>[
    `<b>${E(normalizeStudentName(a))}</b>`,E(a.class_name||'—'),`${ar(m.correct)} / ${ar(m.total)}`,pct(m.percent),badge(m.percent)
  ]);
  $('subjectStudents').innerHTML=`<div class="section-head"><div><h2>الطلاب — ${names[subject]}</h2><p class="muted">أحدث قياس حقيقي لكل طالب في المادة.</p></div></div>${table(['الطالب','الفصل','الصحيح','النسبة','المستوى'],stuRows)}`;
  const inds=aggregateIndicators(records,subject);
  $('subjectIndicators').innerHTML=`<div class="section-head"><div><h2>المؤشرات</h2><p class="muted">الأضعف أولًا.</p></div></div><div class="rank-list">${inds.length?inds.slice(0,25).map(g=>`<div class="rank-row"><div><small>${E(g.text)}</small><div class="bar"><i style="width:${Math.max(0,Math.min(100,g.percent||0))}%"></i></div></div><b>${pct(g.percent)}</b></div>`).join(''):'<p class="muted">لا توجد مؤشرات مقاسة.</p>'}</div>`;
  const qs=aggregateQuestions(records,subject);
  $('subjectQuestions').innerHTML=`<div class="section-head"><div><h2>تحليل الأسئلة</h2><p class="muted">الأسئلة الأعلى في نسبة الخطأ، من الإجابات الحقيقية فقط.</p></div></div>${table(['السؤال','المؤشر','عدد المقاسين','الإجابات الخاطئة','نسبة الخطأ'],qs.slice(0,40).map(q=>[E(q.question),E(q.indicator),ar(q.total),ar(q.wrong),pct(q.failure)]))}`;
}

function loadSettings(){try{settings={...settings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(_){}}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}
function openSettings(){
  $('schoolNameInput').value=settings.schoolName||'';$('teacherNameInput').value=settings.teacherName||'';$('principalNameInput').value=settings.principalName||'';
  $('settingsModal').classList.remove('hidden');
}
function closeSettings(){$('settingsModal').classList.add('hidden')}
function readLogo(file,cb){
  if(!file)return;
  if(file.size>1500000){alert('حجم الشعار كبير. اختر صورة أقل من 1.5 MB.');return}
  const r=new FileReader();r.onload=()=>cb(String(r.result||''));r.readAsDataURL(file);
}
function reportSubjectMetrics(atts,subject){const vals=atts.map(a=>measure(a,subject)).filter(m=>m.total).map(m=>m.percent);return summaryFromPercents(vals)}
function subjectWeakestForStudent(a){const arr=subjectKeys.map(s=>({s,m:measure(a,s)})).filter(x=>x.m.total);if(!arr.length)return'غير مقاس';arr.sort((x,y)=>x.m.percent-y.m.percent);return `${names[arr[0].s]} (${pct(arr[0].m.percent)})`}
function reportHighlights(subjectMetrics,lowStudents){
  const measured=subjectKeys.map(s=>({s,...subjectMetrics[s]})).filter(x=>x.count>0&&x.avg!==null).sort((a,b)=>b.avg-a.avg);
  const positives=[],follow=[];
  if(measured.length){positives.push(`أعلى متوسط تحصيل ظهر في ${names[measured[0].s]} بنسبة ${pct(measured[0].avg)}.`);const mastered=measured.filter(x=>x.mastery!==null&&x.mastery>=50);if(mastered.length)positives.push(`توجد نسبة إتقان ملحوظة في ${mastered.map(x=>names[x.s]).join(' و ')}.`);const weakest=measured[measured.length-1];follow.push(`أقل متوسط تحصيل ظهر في ${names[weakest.s]} بنسبة ${pct(weakest.avg)} ويحتاج متابعة.`)}
  if(lowStudents.length)follow.push(`يوجد ${ar(lowStudents.length)} طالبًا نتيجتهم أقل من 50٪ في الاختبار المختار.`);else positives.push('لا يوجد طلاب أقل من 50٪ في الاختبار المختار.');
  return{positives,follow};
}
function logoHtml(src,label){return src?`<img src="${src}" alt="${E(label)}">`:`<span class="logo-placeholder">${E(label)} غير مرفوع</span>`}
function buildReport(){
  const testId=$('reportTest').value;if(!testId){$('reportPreview').innerHTML='<div class="report-preview-empty">لا يوجد اختبار محدد.</div>';return}
  const test=tests.find(t=>String(t.id)===String(testId));
  const atts=latestPerStudentTest(testId);
  if(!atts.length){$('reportPreview').innerHTML='<div class="report-preview-empty">لا توجد نتائج حقيقية مسلّمة لهذا الاختبار.</div>';return}
  const week=$('reportWeek').value.trim()||'غير محدد';
  const sm={};subjectKeys.forEach(s=>sm[s]=reportSubjectMetrics(atts,s));
  const overallRows=atts.map(a=>({a,p:A.savedPercent?A.savedPercent(a):((Number(a.total)>0)?Number(a.score)/Number(a.total)*100:null)}));
  const lowStudents=overallRows.filter(x=>x.p!==null&&x.p<50).sort((a,b)=>a.p-b.p);
  const high=reportHighlights(sm,lowStudents);
  const today=new Date().toLocaleDateString('ar-SA');
  const subjects=test?.subjects?.length?test.subjects:subjectKeys.filter(s=>sm[s].count>0);
  const sheet1=`<article class="report-sheet">
    <header class="report-head">
      <div class="report-admin"><b>المملكة العربية السعودية</b><br>وزارة التعليم<br>الإدارة العامة للتعليم بمنطقة نجران<br><b>${E(settings.schoolName||'')}</b></div>
      <div class="report-ministry">${logoHtml(settings.ministryLogo,'شعار وزارة التعليم')}</div>
      <div class="report-school-logo">${logoHtml(settings.schoolLogo,'شعار المدرسة')}</div>
    </header>
    <div class="report-title"><h2>التقرير المدرسي لتحليل نتائج نافس</h2><p>${E(test?.title||'اختبار نافس')}</p></div>
    <div class="report-meta">
      <div><span>الأسبوع / الفترة</span><b>${E(week)}</b></div><div><span>تاريخ التقرير</span><b>${E(today)}</b></div>
      <div><span>اسم المعلم</span><b>${E(settings.teacherName||'—')}</b></div><div><span>مدير المدرسة</span><b>${E(settings.principalName||'—')}</b></div>
    </div>
    <div class="report-subject-grid">${subjectKeys.map(s=>`<div class="report-subject"><strong>${icons[s]} ${names[s]}</strong><b>${pct(sm[s].avg)}</b><div class="muted">${sm[s].count?`${ar(sm[s].count)} طالبًا مقاسًا · الإتقان ${pct(sm[s].mastery)}`:'غير مقاس في هذا الاختبار'}</div></div>`).join('')}</div>
    <div class="report-block"><h3>أبرز الإيجابيات</h3><ul class="bullet-clean">${high.positives.map(x=>`<li>${E(x)}</li>`).join('')||'<li>لا توجد بيانات كافية.</li>'}</ul></div>
    <div class="report-block"><h3>نقاط تحتاج متابعة</h3><ul class="bullet-clean">${high.follow.map(x=>`<li>${E(x)}</li>`).join('')||'<li>لا توجد نقاط متابعة آلية من النتائج الحالية.</li>'}</ul></div>
    <div class="report-block"><h3>ملخص الاختبار</h3>${table(['المادة','عدد الطلاب المقاسين','المتوسط','الوسيط','أعلى نتيجة','أقل نتيجة','نسبة الإتقان'],subjectKeys.map(s=>[names[s],ar(sm[s].count),pct(sm[s].avg),pct(sm[s].median),pct(sm[s].high),pct(sm[s].low),pct(sm[s].mastery)]))}</div>
  </article>`;
  const sheet2=`<article class="report-sheet">
    <header class="report-head">
      <div class="report-admin"><b>${E(settings.schoolName||'')}</b><br>${E(test?.title||'')}</div>
      <div class="report-ministry">${logoHtml(settings.ministryLogo,'شعار وزارة التعليم')}</div>
      <div class="report-school-logo">${logoHtml(settings.schoolLogo,'شعار المدرسة')}</div>
    </header>
    <div class="report-title"><h2>حصر الطلاب ذوي الدرجات المتدنية</h2><p>الطلاب الأقل من 50٪ في الاختبار المختار</p></div>
    ${table(['م','اسم الطالب','الفصل','الدرجة','النسبة','أضعف مادة مقاسة'],lowStudents.map((x,i)=>[ar(i+1),`<b>${E(normalizeStudentName(x.a))}</b>`,E(x.a.class_name||'—'),`${ar(x.a.score)} / ${ar(x.a.total)}`,pct(x.p),E(subjectWeakestForStudent(x.a))]),'low-table')}
    ${!lowStudents.length?'<p class="muted" style="text-align:center;margin-top:18px">لا يوجد طلاب أقل من 50٪ في هذا الاختبار.</p>':''}
  </article>`;
  reportHtml=sheet1+sheet2;$('reportPreview').innerHTML=reportHtml;$('printReportBtn').disabled=false;
}
function fillReportTests(){
  const ids=new Set(submitted().map(a=>String(a.test_id)));
  const actual=tests.filter(t=>ids.has(String(t.id)));
  $('reportTest').innerHTML=actual.length?`<option value="">اختر الاختبار</option>${actual.map(t=>`<option value="${E(t.id)}">${E(t.title||t.id)}</option>`).join('')}`:'<option value="">لا توجد اختبارات بنتائج مسلّمة</option>';
}
function render(){
  $('dashboard').hidden=false;
  document.querySelectorAll('.main-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
  $('overviewView').hidden=currentView!=='overview';$('subjectView').hidden=currentView!=='subject';$('reportView').hidden=currentView!=='report';
  if(currentView==='overview')renderOverview();else if(currentView==='subject')renderSubject();else fillReportTests();
}

async function load(){
  if(loading)return;if(!T?.getKey?.()){$('authPanel').hidden=false;return}
  loading=true;$('authPanel').hidden=true;$('loadError').hidden=true;$('loadState').textContent='جارٍ تحميل النتائج الحقيقية…';
  try{
    let cursor=0,all=[],testList=[],ind=[];
    do{const d=await T.api('teacher_data',{cursor,limit:100});all.push(...(d.attempts||[]));if(cursor===0){testList=d.tests||[];ind=d.indicators||[]}cursor=d.next_cursor}while(cursor!==null);
    try{const s=await T.api('teacher_students_list',{include_archived:false});students=s.students||[]}catch(_){students=[]}
    attempts=all.map(x=>A.normalizeAttempt?A.normalizeAttempt(x):x);tests=testList;catalog=ind;
    $('refreshBtn').hidden=false;$('settingsBtn').hidden=false;$('signoutBtn').hidden=false;render();
  }catch(err){$('loadError').hidden=false;$('loadErrorText').textContent=err.message||String(err);if(err.status===401)$('authPanel').hidden=false}
  finally{loading=false;$('loadState').textContent=''}
}

loadSettings();
$('authForm').onsubmit=e=>{e.preventDefault();T.setKey($('teacherKey').value);$('teacherKey').value='';load()};
$('retryBtn').onclick=load;$('refreshBtn').onclick=load;
$('signoutBtn').onclick=()=>{T.clearKey();attempts=[];tests=[];catalog=[];students=[];$('dashboard').hidden=true;$('authPanel').hidden=false;$('refreshBtn').hidden=true;$('settingsBtn').hidden=true;$('signoutBtn').hidden=true};
$('settingsBtn').onclick=openSettings;$('closeSettingsBtn').onclick=closeSettings;
$('settingsModal').onclick=e=>{if(e.target===$('settingsModal'))closeSettings()};
$('saveSettingsBtn').onclick=()=>{settings.schoolName=$('schoolNameInput').value.trim();settings.teacherName=$('teacherNameInput').value.trim();settings.principalName=$('principalNameInput').value.trim();saveSettings();closeSettings();if(reportHtml)buildReport()};
$('ministryLogoInput').onchange=e=>readLogo(e.target.files?.[0],src=>{settings.ministryLogo=src;saveSettings()});
$('schoolLogoInput').onchange=e=>readLogo(e.target.files?.[0],src=>{settings.schoolLogo=src;saveSettings()});
document.querySelectorAll('.main-tab').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render()});
$('overviewClass').onchange=renderOverview;$('subjectSelect').onchange=renderSubject;$('subjectClass').onchange=renderSubject;
$('buildReportBtn').onclick=buildReport;
$('printReportBtn').onclick=()=>{if(!reportHtml)return;$('printRoot').innerHTML=reportHtml;$('printRoot').setAttribute('aria-hidden','false');window.print()};
addEventListener('nafes:auth-required',()=>{$('authPanel').hidden=false});
addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)load()});
load();
})();