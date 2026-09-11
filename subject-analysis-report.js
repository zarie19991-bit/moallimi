(()=>{
'use strict';
const T=window.NafesTeacher,A=window.NafesAnalytics,$=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v)||0);
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const SETTINGS_KEY='nafes_school_report_settings_v1';
let attempts=[],tests=[],loaded=false,loading=false,reportHtml='';

function settings(){try{return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:'',...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(_){return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:''}}}
function submitted(a){return A?.isSubmitted?A.isSubmitted(a):!!(a.submitted_at||a.submitted)}
function measure(a,subject){if(A?.measure)return A.measure(a,{subject});const qs=(a.questions||[]).filter(q=>q.subject===subject);const total=qs.length,correct=qs.filter(q=>q.correct===true).length;return{total,correct,percent:total?correct/total*100:null}}
function ident(a){return A?.studentIdentity?.(a)||a.student_id||a.student_name||a.full_name||a.id}
function when(a){return new Date(a.submitted_at||a.updated_at||a.created_at||0).getTime()||0}
function studentName(a){return a.student_name||a.full_name||'اسم غير مسجل'}
function pct(v){return `${ar(v)}٪`}
function logo(src,label){return src?`<img src="${src}" alt="${E(label)}">`:`<div class="sar-logo-fallback">${E(label)}</div>`}
function level(p){if(p>=90)return'excellent';if(p>=80)return'verygood';if(p>=70)return'good';if(p>=50)return'pass';return'fail'}
const levels=[
 {key:'excellent',label:'ممتاز',range:'٩٠ – ١٠٠'},
 {key:'verygood',label:'جيد جدًا',range:'٨٠ – أقل من ٩٠'},
 {key:'good',label:'جيد',range:'٧٠ – أقل من ٨٠'},
 {key:'pass',label:'مقبول',range:'٥٠ – أقل من ٧٠'},
 {key:'fail',label:'راسب',range:'أقل من ٥٠'}
];
function latestRecords(testId,subject,className=''){
 const map=new Map();
 for(const a of attempts){if(!submitted(a)||String(a.test_id)!==String(testId))continue;if(className&&String(a.class_name||'').trim()!==className)continue;const m=measure(a,subject);if(!m.total)continue;const k=String(ident(a));const old=map.get(k);if(!old||when(a)>when(old.a))map.set(k,{a,m});}
 return [...map.values()];
}
function testSubjects(testId){const set=new Set();for(const a of attempts){if(!submitted(a)||String(a.test_id)!==String(testId))continue;for(const s of ['reading','math','science'])if(measure(a,s).total)set.add(s);}return set}
function testsFor(subject){return tests.filter(t=>testSubjects(t.id).has(subject));}
function fillTests(){if(!$('subjectTest'))return;const subject=$('subjectSelect').value;const list=testsFor(subject);const old=$('subjectTest').value;$('subjectTest').innerHTML=list.length?`<option value="">اختر اختبار ${names[subject]}</option>${list.map(t=>`<option value="${E(t.id)}">${E(t.title||t.id)}</option>`).join('')}`:`<option value="">لا توجد نتائج مسلّمة لمادة ${names[subject]}</option>`;if(list.some(t=>String(t.id)===old))$('subjectTest').value=old;$('subjectReportState').textContent=list.length?`يوجد ${ar(list.length)} اختبارًا يحتوي نتائج حقيقية لمادة ${names[subject]}.`:`لا توجد اختبارات بنتائج مسلّمة لهذه المادة.`;$('printSubjectReportBtn').disabled=true;reportHtml='';}
function ring(label,count,total,key){const p=total?count/total*100:0;return `<div class="sar-ring-item"><div class="sar-ring ${key}" style="--p:${Math.max(0,Math.min(100,p))}"><div><b>${E(label)}</b><strong>${pct(p)}</strong></div></div></div>`}
function bar(label,count,max,key){const h=max?Math.max(4,count/max*100):4;return `<div class="sar-bar-item"><div class="sar-bar-track"><i class="${key}" style="--h:${h}%"><b>${ar(count)}</b></i></div><span>${E(label)}</span></div>`}
function build(){
 const subject=$('subjectSelect').value,testId=$('subjectTest').value,className=$('subjectClass').value;
 if(!testId){$('subjectOfficialReport').innerHTML='<div class="report-preview-empty">اختر الاختبار أولًا.</div>';$('printSubjectReportBtn').disabled=true;return}
 const test=tests.find(t=>String(t.id)===String(testId))||{};const recs=latestRecords(testId,subject,className);
 if(!recs.length){$('subjectOfficialReport').innerHTML='<div class="report-preview-empty">لا توجد نتائج مسلّمة في هذا الاختبار ضمن الفصل المختار.</div>';$('printSubjectReportBtn').disabled=true;return}
 const vals=recs.map(x=>x.m.percent),scores=recs.map(x=>x.m.correct),totals=recs.map(x=>x.m.total);const n=recs.length,maxTotal=Math.max(...totals);
 const highest=Math.max(...scores),lowest=Math.min(...scores),sum=scores.reduce((a,b)=>a+b,0),avg=sum/n,avgPct=vals.reduce((a,b)=>a+b,0)/n,success=vals.filter(x=>x>=50).length/n*100;
 const counts=Object.fromEntries(levels.map(l=>[l.key,vals.filter(p=>level(p)===l.key).length]));const maxCount=Math.max(1,...Object.values(counts));const s=settings();
 const term=test.term||test.academic_term||'غير محدد';const reportClass=className||test.class_name||'كل الفصول';
 const rows=levels.map(l=>`<tr><td><span class="sar-level-tag ${l.key}">${l.label}</span></td><td>${l.range}</td><td>${ar(counts[l.key])}</td></tr>`).join('');
 reportHtml=`<article class="subject-analysis-sheet">
   <header class="sar-head">
    <div class="sar-admin"><b>الإدارة العامة للتعليم بمنطقة نجران</b><span>${E(s.schoolName||'')}</span></div>
    <div class="sar-ministry">${logo(s.ministryLogo,'وزارة التعليم')}</div>
    <div class="sar-form-no">تحليل مستقل</div>
   </header>
   <h1>تحليل نتائج اختبار مادة [${E(names[subject])}]</h1>
   <div class="sar-meta">
    <div><span>المرحلة الدراسية / الصف:</span><b>الثالث المتوسط · ${E(reportClass)}</b></div>
    <div><span>السنة / الفصل الدراسي:</span><b>${E(term)}</b></div>
    <div><span>درجة القياس (الاختبار):</span><b>${ar(maxTotal)}</b></div>
   </div>
   <div class="sar-analysis-grid">
    <section class="sar-stats"><h2>الإحصائيات الأساسية</h2>
     <div class="sar-stat-list">
      <div><span>عدد الطلاب</span><b>${ar(n)}</b></div><div><span>أعلى درجة</span><b>${ar(highest)}</b></div><div><span>أقل درجة</span><b>${ar(lowest)}</b></div>
      <div><span>متوسط الدرجات</span><b>${ar(avg)} <small>(${pct(avgPct)})</small></b></div><div><span>نسبة النجاح</span><b>${pct(success)}</b></div><div><span>مجموع الدرجات</span><b>${ar(sum)}</b></div>
     </div>
    </section>
    <section class="sar-achievement"><h2>الإحصائيات التحصيلية</h2><table><thead><tr><th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th></tr></thead><tbody>${rows}</tbody></table></section>
   </div>
   <section class="sar-chart-card"><h2>رسم بياني (نسب الطلاب لكل تقدير)</h2><div class="sar-rings">${levels.map(l=>ring(l.label,counts[l.key],n,l.key)).join('')}</div></section>
   <section class="sar-chart-card"><h2>رسم بياني (عدد الطلاب لكل تقدير)</h2><div class="sar-bars">${levels.map(l=>bar(l.label,counts[l.key],maxCount,l.key)).join('')}</div></section>
   <section class="sar-student-table"><h2>تفاصيل نتائج الطلاب في ${E(names[subject])}</h2><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th></tr></thead><tbody>${recs.sort((a,b)=>b.m.percent-a.m.percent).map((x,i)=>`<tr><td>${ar(i+1)}</td><td>${E(studentName(x.a))}</td><td>${E(x.a.class_name||'—')}</td><td>${ar(x.m.correct)} / ${ar(x.m.total)}</td><td>${pct(x.m.percent)}</td><td>${levels.find(l=>l.key===level(x.m.percent)).label}</td></tr>`).join('')}</tbody></table></section>
   <footer class="sar-signatures"><div><b>معلم/ة المادة:</b><span>${E(s.teacherName||'________________')}</span></div><div><b>مدير/ة المدرسة:</b><span>${E(s.principalName||'________________')}</span></div></footer>
  </article>`;
 $('subjectOfficialReport').innerHTML=reportHtml;$('printSubjectReportBtn').disabled=false;$('subjectReportState').textContent=`تم تحليل ${ar(n)} طالبًا من أحدث محاولة مسلّمة لكل طالب في اختبار «${test.title||''}».`;
}
async function load(){if(loading||!T?.getKey?.())return;loading=true;try{let cursor=0,all=[],ts=[];do{const d=await T.api('teacher_data',{cursor,limit:100});all.push(...(d.attempts||[]));if(cursor===0)ts=d.tests||[];cursor=d.next_cursor}while(cursor!==null);attempts=all.map(x=>A?.normalizeAttempt?A.normalizeAttempt(x):x);tests=ts;loaded=true;fillTests();}catch(e){$('subjectReportState').textContent='تعذر تحميل بيانات التحليل المنفصل: '+(e.message||e)}finally{loading=false}}
function init(){if(!$('subjectTest'))return;$('subjectSelect').addEventListener('change',()=>{if(loaded)fillTests();else load()});$('subjectClass').addEventListener('change',()=>{if(reportHtml)build()});$('buildSubjectReportBtn').addEventListener('click',build);$('printSubjectReportBtn').addEventListener('click',()=>{if(!reportHtml)return;const root=$('printRoot');root.innerHTML=reportHtml;root.setAttribute('aria-hidden','false');window.print()});load();}
addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated){loaded=false;load()}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();