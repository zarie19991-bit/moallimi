(()=>{
'use strict';
const T=window.NafesTeacher,A=window.NafesAnalytics,$=id=>document.getElementById(id);
const N={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const SUBJECTS=['reading','math','science'];
const DATA_CACHE='__NAFES_ANALYSIS_DATA_CACHE__',SETTINGS_KEY='nafes_school_report_settings_v1';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const ar=v=>num(v)===null?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v));
const pct=v=>num(v)===null?'—':`${ar(v)}٪`;
const submitted=a=>A?.isSubmitted?A.isSubmitted(a):!!(a?.submitted_at||['submitted','completed','finished'].includes(String(a?.status||'').toLowerCase()));
const ident=a=>A?.studentIdentity?.(a)||String(a?.student_id||a?.student_key||a?.student_no||a?.id||'');
const when=a=>Date.parse(a?.submitted_at||a?.completed_at||a?.finished_at||a?.started_at||0)||0;
const testId=a=>String(a?.test_id||a?.assessment_id||a?.exam_id||'').trim();
const LEVELS=[
 {key:'excellent',label:'ممتاز',range:'٩٠ – ١٠٠'},
 {key:'verygood',label:'جيد جدًا',range:'٨٠ – أقل من ٩٠'},
 {key:'good',label:'جيد',range:'٧٠ – أقل من ٨٠'},
 {key:'pass',label:'مقبول',range:'٥٠ – أقل من ٧٠'},
 {key:'fail',label:'راسب',range:'أقل من ٥٠'}
];
function settings(){try{return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:''}}}
function classKey(v){const raw=String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').replace(/[إآا]/g,'أ');if(['أ','ب','ج','د'].includes(raw))return raw;const m=raw.match(/(?:^|[\s/\\\-()])([أبجد])(?:$|[\s/\\\-()])/);if(m)return m[1];const tail=raw.match(/(?:فصل|شعبة)?\s*([أبجد])$/);return tail?tail[1]:raw;}
function classMatches(a,c){return !c||classKey(a?.class_name)===classKey(c);}
function normSubject(v){const s=String(v||'').trim().toLowerCase();if(['reading','arabic','language','القراءة','العربية','اللغة العربية'].includes(s))return'reading';if(['math','mathematics','الرياضيات'].includes(s))return'math';if(['science','العلوم'].includes(s))return'science';return'';}
function savedMeasure(a,subject){const sections=Array.isArray(a?.section_scores)?a.section_scores:[],sec=sections.find(x=>normSubject(x?.subject||x?.subject_key)===subject);if(sec){const score=num(sec.score??sec.correct),total=num(sec.total),percent=num(sec.percent);if(score!==null&&total!==null&&total>0)return{score,total,percent:percent!==null?percent:score/total*100}}const subjects=(Array.isArray(a?.subjects)?a.subjects:[]).map(normSubject).filter(Boolean),score=num(a?.score),total=num(a?.total),percent=num(a?.percent);if(subjects.length===1&&subjects[0]===subject&&score!==null&&total!==null&&total>0)return{score,total,percent:percent!==null?percent:score/total*100};return null}
function level(p){return p>=90?'excellent':p>=80?'verygood':p>=70?'good':p>=50?'pass':'fail'}
function latestRecords(attempts,id,subject,cls=''){const m=new Map();for(const a of attempts){if(!submitted(a)||testId(a)!==String(id)||!classMatches(a,cls))continue;const x=savedMeasure(a,subject),k=ident(a);if(!x||!k)continue;const old=m.get(k);if(!old||when(a)>when(old.a))m.set(k,{a,m:x})}return[...m.values()]}
async function loadData(){const cached=window[DATA_CACHE];if(cached?.data)return cached.data;if(cached?.promise)return cached.promise;let cursor=0,attempts=[],tests=[],page=0;do{const d=await T.api('teacher_data',{cursor,limit:100});attempts.push(...(d.attempts||[]));if(page===0)tests=d.tests||[];cursor=d.next_cursor;page++;if(page>500)throw new Error('تعذر تحميل النتائج كاملة.')}while(cursor!==null);const data={attempts:attempts.map(x=>A?.normalizeAttempt?A.normalizeAttempt(x):x),tests};window[DATA_CACHE]={data,at:Date.now()};return data}
async function loadRoster(){try{const r=await T.api('teacher_students_list',{include_archived:false});return Array.isArray(r?.students)?r.students:[]}catch{return[]}}
function participation(roster,attempts,tests,id,subject,cls){try{return window.NafesReportAbsentees?.groups?.({roster,attempts,tests,selectedIds:[id],className:cls,subject})?.[0]||null}catch{return null}}
function ministryLogo(src){return src?`<img src="${src}" alt="شعار وزارة التعليم">`:'<div class="app-logo-fallback">وزارة التعليم</div>'}
function paper({attempts,tests,roster},subject,id,cls=''){
 const recs=latestRecords(attempts,id,subject,cls);if(!recs.length)return'';
 const scores=recs.map(x=>x.m.score),totals=recs.map(x=>x.m.total),vals=recs.map(x=>x.m.percent),n=recs.length;
 const sum=scores.reduce((a,b)=>a+b,0),possible=totals.reduce((a,b)=>a+b,0),achievement=possible?sum/possible*100:null;
 const highest=Math.max(...scores),lowest=Math.min(...scores),avg=sum/n,degree=Math.max(...totals);
 const counts=Object.fromEntries(LEVELS.map(l=>[l.key,vals.filter(p=>level(p)===l.key).length]));
 const t=tests.find(x=>String(x.id||x.test_id||'')===String(id))||{},term=t.term||t.academic_term||t.semester||'—';
 const part=participation(roster,attempts,tests,id,subject,cls),total=part?.total??n,tested=part?.tested??n,absent=part?.missing?.length??Math.max(0,total-tested);
 const s=settings();
 const distRows=LEVELS.map(l=>{const c=counts[l.key]||0,p=n?c/n*100:0;return `<tr><td>${l.label}</td><td>${l.range}</td><td>${ar(c)}</td><td>${pct(p)}</td></tr>`}).join('');
 const bars=LEVELS.map(l=>{const c=counts[l.key]||0,p=n?c/n*100:0;return `<div class="app-bar-row"><span>${l.label}</span><div class="app-bar"><i style="--w:${Math.max(0,Math.min(100,p))}%"></i></div><b>${pct(p)}</b></div>`}).join('');
 const unresolved=part?.unresolved?`<div class="app-note">تنبيه: توجد ${ar(part.unresolved)} نتيجة مسلّمة لم تُربط بطالب من الكشف بصورة مؤكدة.</div>`:'';
 return `<article class="analysis-print-paper" dir="rtl">
  <header class="app-head"><div class="app-admin"><b>المملكة العربية السعودية</b><span>وزارة التعليم</span><span>الإدارة العامة للتعليم بمنطقة نجران</span><span>${E(s.schoolName||'مدرسة ابن سينا المتوسطة')}</span></div><div class="app-logo">${ministryLogo(s.ministryLogo)}</div><div class="app-form"><b>نموذج تحليل نتائج</b><span>اختبارات نافس</span></div></header>
  <h1>تحليل نتائج اختبار مادة ${E(N[subject])}</h1>
  <section class="app-meta"><div><span>الصف</span><b>الثالث متوسط</b></div><div><span>الفصل الدراسي</span><b>${E(term)}</b></div><div><span>درجة الاختبار</span><b>${ar(degree)}</b></div></section>
  <section class="app-stats"><h2>ملخص النتائج</h2><table><tbody>
   <tr><th>إجمالي عدد الطلاب</th><td>${ar(total)}</td><th>عدد الطلاب المختبرين</th><td>${ar(tested)}</td></tr>
   <tr><th>عدد الطلاب غير المختبرين</th><td>${ar(absent)}</td><th>أعلى درجة</th><td>${ar(highest)}</td></tr>
   <tr><th>أقل درجة</th><td>${ar(lowest)}</td><th>متوسط الدرجات</th><td>${ar(avg)}</td></tr>
   <tr><th>نسبة التحصيل</th><td>${pct(achievement)}</td><th>مجموع الدرجات</th><td>${ar(sum)}</td></tr>
  </tbody></table>${unresolved}</section>
  <section class="app-distribution"><h2>التوزيع التحصيلي</h2><table><thead><tr><th>التقدير</th><th>النطاق</th><th>عدد الطلاب</th><th>النسبة</th></tr></thead><tbody>${distRows}</tbody></table></section>
  <section class="app-chart"><h2>نسب الطلاب حسب التقدير</h2>${bars}</section>
  <footer class="app-sign"><div><b>معلم المادة</b><span>${E(s.teacherName||'________________')}</span><em>التوقيع: ________________</em></div><div><b>مدير المدرسة</b><span>${E(s.principalName||'________________')}</span><em>التوقيع: ________________</em></div></footer>
 </article>`;
}
async function printPapers(items){try{const [data,roster]=await Promise.all([loadData(),loadRoster()]),html=items.map(x=>paper({...data,roster},x.subject,x.id,x.cls)).filter(Boolean).join('');if(!html)return alert('لا توجد نتائج محفوظة للاختيار الحالي.');const root=$('printRoot');root.innerHTML=html;root.setAttribute('aria-hidden','false');requestAnimationFrame(()=>window.print())}catch(e){alert(e?.message||'تعذر تجهيز التحليل للطباعة.')}}
function stop(e){e.preventDefault();e.stopImmediatePropagation()}
function bind(){
 $('printOverviewAnalysisBtn')?.addEventListener('click',e=>{stop(e);const cls=$('overviewClass')?.value||'',ids={reading:$('analysisReadingTest')?.value||'',math:$('analysisMathTest')?.value||'',science:$('analysisScienceTest')?.value||''};printPapers(SUBJECTS.filter(s=>ids[s]).map(subject=>({subject,id:ids[subject],cls})))},true);
 $('printSubjectAnalysisBtn')?.addEventListener('click',e=>{stop(e);const subject=$('subjectSelect')?.value||'reading',id=$('analysisSubjectTest')?.value||'',cls=$('subjectClass')?.value||'';if(!id)return alert('اختر الاختبار أولًا.');printPapers([{subject,id,cls}])},true);
 const cleanup=host=>{if(!host)return;const run=()=>host.querySelectorAll('.sar-stat-list>div').forEach(row=>{if(row.querySelector('span')?.textContent?.includes('عدد الطلاب ذوي الدرجات المقاسة'))row.remove()});new MutationObserver(run).observe(host,{childList:true,subtree:true});run()};
 cleanup($('overviewOfficialPreview'));cleanup($('subjectOfficialPreview'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();