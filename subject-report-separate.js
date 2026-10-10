(()=>{
'use strict';
const T=window.NafesTeacher,A=window.NafesAnalytics,$=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const ar=v=>num(v)===null?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v));
const pct=v=>num(v)===null?'—':`${ar(v)}٪`;
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const SETTINGS_KEY='nafes_school_report_settings_v1',DATA_CACHE='__NAFES_ANALYSIS_DATA_CACHE__';
let attempts=[],tests=[],students=[],loaded=false,loading=false,reportHtml='',buildVersion=0;
function invalidate(){buildVersion++;reportHtml='';$('printSubjectReportBtn').disabled=true}
function settings(){try{return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:'',...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(_){return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:''}}}
function submitted(a){return A?.isSubmitted?A.isSubmitted(a):!!(a?.submitted_at||a?.submitted)}
function ident(a){return A?.studentIdentity?.(a)||a?.student_id||a?.student_key||a?.id}
function when(a){return Date.parse(a?.submitted_at||a?.updated_at||a?.created_at||0)||0}
function studentName(a){return a?.student_name||a?.full_name||'اسم غير مسجل'}
function normSubject(v){const s=String(v||'').trim().toLowerCase();if(['reading','arabic','language','القراءة','العربية','اللغة العربية'].includes(s))return'reading';if(['math','mathematics','الرياضيات'].includes(s))return'math';if(['science','العلوم'].includes(s))return'science';return''}
function savedMeasure(a,subject){const sections=Array.isArray(a?.section_scores)?a.section_scores:[],sec=sections.find(x=>normSubject(x?.subject||x?.subject_key)===subject);if(sec){const score=num(sec.score??sec.correct),total=num(sec.total),percent=num(sec.percent);if(score!==null&&total!==null&&total>0)return{score,total,percent:percent!==null?percent:score/total*100,source:'section_scores'}}const subjects=(Array.isArray(a?.subjects)?a.subjects:[]).map(normSubject).filter(Boolean),score=num(a?.score),total=num(a?.total),percent=num(a?.percent);if(subjects.length===1&&subjects[0]===subject&&score!==null&&total!==null&&total>0)return{score,total,percent:percent!==null?percent:score/total*100,source:'saved_grade'};return null}
function level(p){if(p>=90)return'excellent';if(p>=80)return'verygood';if(p>=70)return'good';if(p>=50)return'pass';return'fail'}
const levels=[{key:'excellent',label:'ممتاز',range:'٩٠ – ١٠٠'},{key:'verygood',label:'جيد جدًا',range:'٨٠ – أقل من ٩٠'},{key:'good',label:'جيد',range:'٧٠ – أقل من ٨٠'},{key:'pass',label:'مقبول',range:'٥٠ – أقل من ٧٠'},{key:'fail',label:'راسب',range:'أقل من ٥٠'}];
function logo(src,label){return src?`<img src="${src}" alt="${E(label)}">`:`<div class="sar-logo-fallback">${E(label)}</div>`}
function latestRecords(testId,subject,className=''){const map=new Map();for(const a of attempts){if(!submitted(a)||String(a.test_id)!==String(testId))continue;if(className&&String(a.class_name||'').trim()!==className)continue;const m=savedMeasure(a,subject);if(!m)continue;const k=String(ident(a)||'');if(!k)continue;const old=map.get(k);if(!old||when(a)>when(old.a))map.set(k,{a,m})}return[...map.values()]}
function testsFor(subject){const map=new Map();for(const a of attempts){if(!submitted(a))continue;const m=savedMeasure(a,subject);if(!m)continue;const id=String(a.test_id||'');if(!id)continue;const old=map.get(id)||{id,count:0,time:0,title:tests.find(t=>String(t.id)===id)?.title||a.title||'اختبار نافس'};old.count++;old.time=Math.max(old.time,when(a));map.set(id,old)}return[...map.values()].sort((a,b)=>b.time-a.time)}
function fillTests(){if(!$('reportSubjectTest'))return;const subject=$('reportSubjectSelect').value,list=testsFor(subject),old=$('reportSubjectTest').value;$('reportSubjectTest').innerHTML=list.length?`<option value="">اختر اختبار ${names[subject]}</option>${list.map(t=>`<option value="${E(t.id)}">${E(t.title)} — ${ar(t.count)} نتيجة محفوظة</option>`).join('')}`:`<option value="">لا توجد درجات محفوظة لمادة ${names[subject]}</option>`;if(list.some(t=>String(t.id)===old))$('reportSubjectTest').value=old;$('subjectReportState').textContent=list.length?`يوجد ${ar(list.length)} اختبارًا بدرجات محفوظة لمادة ${names[subject]}.`:`لا توجد اختبارات بدرجات محفوظة لهذه المادة.`;invalidate()}
function ring(label,count,total,key){const p=total?count/total*100:0;return `<div class="sar-ring-item"><div class="sar-ring ${key}" style="--p:${Math.max(0,Math.min(100,p))}%"><div><b>${E(label)}</b><strong>${pct(p)}</strong></div></div></div>`}
function bar(label,count,max,key){const h=max?Math.max(4,count/max*100):4;return `<div class="sar-bar-item"><div class="sar-bar-track"><i class="${key}" style="--h:${h}%"><b>${ar(count)}</b></i></div><span>${E(label)}</span></div>`}
function participationGroup(testId,className,subject){try{return window.NafesReportAbsentees.groups({roster:students,attempts,tests,selectedIds:[testId],className,subject})[0]||null}catch(_){return null}}
async function build(){const version=++buildVersion;reportHtml='';$('printSubjectReportBtn').disabled=true;const subject=$('reportSubjectSelect').value,testId=$('reportSubjectTest').value,className=$('reportSubjectClass').value;if(!testId){$('subjectOfficialReport').innerHTML='<div class="report-preview-empty">اختر الاختبار أولًا.</div>';return}const test=tests.find(t=>String(t.id)===String(testId))||{},recs=latestRecords(testId,subject,className),s=settings(),part=participationGroup(testId,className,subject);$('subjectReportState').textContent='جارٍ إنشاء التقرير وكشف غير المختبرين…';const absenceHtml=part?window.NafesReportAbsentees.render([part],{settings:s,style:'subject'}):'';if(version!==buildVersion)return;if(!recs.length){reportHtml=absenceHtml;$('subjectOfficialReport').innerHTML='<div class="report-preview-empty">لا توجد درجات محفوظة فعلية في هذا الاختبار ضمن الفصل المختار.</div>'+reportHtml;$('printSubjectReportBtn').disabled=!reportHtml;$('subjectReportState').textContent='تم إنشاء كشف المشاركة للفصل المختار.';return}
const scores=recs.map(x=>x.m.score),totals=recs.map(x=>x.m.total),vals=recs.map(x=>x.m.percent),n=recs.length,sum=scores.reduce((a,b)=>a+b,0),possible=totals.reduce((a,s)=>a+s,0),achievement=possible?sum/possible*100:null,highest=Math.max(...scores),lowest=Math.min(...scores),avg=sum/n,maxTotal=Math.max(...totals),counts=Object.fromEntries(levels.map(l=>[l.key,vals.filter(p=>level(p)===l.key).length])),maxCount=Math.max(1,...Object.values(counts)),term=test.term||test.academic_term||'غير محدد',rows=levels.map(l=>`<tr><td><span class="sar-level-tag ${l.key}">${l.label}</span></td><td>${l.range}</td><td>${ar(counts[l.key])}</td></tr>`).join(''),rosterTotal=part?.total??'—',testedTotal=part?.tested??n,missingTotal=part?.missing?.length??Math.max(0,(Number(rosterTotal)||n)-testedTotal),warning=part?.warning||'';
reportHtml=`<article class="subject-analysis-sheet official-analysis-sheet" data-grade-source="saved" data-class-name="${E(className)}"><header class="sar-head"><div class="sar-admin"><b>المملكة العربية السعودية</b><span>وزارة التعليم</span><span>الإدارة العامة للتعليم بمنطقة نجران</span><span>${E(s.schoolName||'مدرسة ابن سينا المتوسطة')}</span></div><div class="sar-ministry">${logo(s.ministryLogo,'وزارة التعليم')}</div><div class="sar-form-no">تقرير مادة</div></header><h1>تقرير نتائج اختبار مادة [${E(names[subject])}]</h1><div class="sar-meta"><div><span>المرحلة الدراسية / الصف:</span><b>الثالث متوسط</b></div><div><span>السنة / الفصل الدراسي:</span><b>${E(term)}</b></div><div><span>درجة القياس (الاختبار):</span><b>${ar(maxTotal)}</b></div></div><div class="sar-analysis-grid"><section class="sar-stats"><h2>الإحصائيات الأساسية</h2><div class="sar-stat-list"><div><span>إجمالي عدد الطلاب</span><b>${ar(rosterTotal)}</b></div><div><span>عدد الطلاب المختبرين</span><b>${ar(testedTotal)}</b></div><div><span>عدد الطلاب غير المختبرين</span><b>${ar(missingTotal)}</b></div><div><span>أعلى درجة</span><b>${ar(highest)}</b></div><div><span>أقل درجة</span><b>${ar(lowest)}</b></div><div><span>متوسط الدرجات</span><b>${ar(avg)}</b></div><div><span>نسبة التحصيل</span><b>${pct(achievement)}</b></div><div><span>مجموع الدرجات</span><b>${ar(sum)}</b></div></div>${warning?`<p class="na-empty">${E(warning)}</p>`:''}</section><section class="sar-achievement"><h2>الإحصائيات التحصيلية</h2><table><thead><tr><th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th></tr></thead><tbody>${rows}</tbody></table></section></div><section class="sar-chart-card"><h2>رسم بياني (نسب الطلاب لكل تقدير)</h2><div class="sar-rings">${levels.map(l=>ring(l.label,counts[l.key],n,l.key)).join('')}</div></section><section class="sar-chart-card"><h2>رسم بياني (عدد الطلاب لكل تقدير)</h2><div class="sar-bars">${levels.map(l=>bar(l.label,counts[l.key],maxCount,l.key)).join('')}</div></section><footer class="sar-signatures"><div><b>معلم/ة المادة:</b><span>${E(s.teacherName||'________________')}</span></div><div><b>مدير/ة المدرسة:</b><span>${E(s.principalName||'________________')}</span></div></footer><section class="sar-student-table"><h2>تفاصيل الدرجات المحفوظة للطلاب في ${E(names[subject])}</h2><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th></tr></thead><tbody>${recs.sort((a,b)=>b.m.percent-a.m.percent).map((x,i)=>`<tr><td>${ar(i+1)}</td><td>${E(studentName(x.a))}</td><td>${E(x.a.class_name||'—')}</td><td>${ar(x.m.score)} / ${ar(x.m.total)}</td><td>${pct(x.m.percent)}</td><td>${levels.find(l=>l.key===level(x.m.percent)).label}</td></tr>`).join('')}</tbody></table></section></article>`;reportHtml+=absenceHtml;$('subjectOfficialReport').innerHTML=reportHtml;$('printSubjectReportBtn').disabled=false;$('subjectReportState').textContent=`تم إنشاء تقرير ${names[subject]}: إجمالي ${ar(rosterTotal)}، مختبرون ${ar(testedTotal)}، غير مختبرين ${ar(missingTotal)}.`}
let standaloneHtml='';
function indicatorQuestions(a,subject){
 return (Array.isArray(a?.questions)?a.questions:[]).filter(q=>normSubject(q?.subject||q?.subject_key)===subject&&String(q?.indicator_key||'').trim()&&typeof q?.correct==='boolean'&&q?.scorable!==false);
}
function indicatorTestsFor(subject){
 const groups=new Map();
 for(const a of attempts){
  if(!submitted(a))continue;
  const id=String(a.test_id||'').trim();
  if(!id||id.startsWith('unknown-test:'))continue;
  const questions=indicatorQuestions(a,subject),grade=savedMeasure(a,subject);
  if(!questions.length&&!grade)continue;
  const existing=groups.get(id)||{id,title:tests.find(t=>String(t.id)===id)?.title||a.title||'اختبار نافس',count:0,indicatorCount:0,time:0};
  existing.count++;existing.indicatorCount+=questions.length;existing.time=Math.max(existing.time,when(a));groups.set(id,existing);
 }
 return [...groups.values()].sort((a,b)=>b.time-a.time);
}
function indicatorRecords(testId,subject,className=''){
 const records=new Map();
 for(const a of attempts){
  if(!submitted(a)||String(a.test_id)!==String(testId))continue;
  if(className&&String(a.class_name||'').trim()!==className)continue;
  const qs=indicatorQuestions(a,subject),saved=savedMeasure(a,subject);
  if(!qs.length&&!saved)continue;
  const measure=saved||(qs.length?{score:qs.filter(q=>q.correct).length,total:qs.length,percent:100*qs.filter(q=>q.correct).length/qs.length,source:'question_snapshot'}:null);
  if(!measure)continue;
  const key=String(ident(a)||'').trim();if(!key)continue;
  const old=records.get(key);
  if(!old||when(a)>when(old.a))records.set(key,{a,m:measure});
 }
 return [...records.values()];
}
function fillIndicatorTests(){
 const el=$('indicatorReportTest');if(!el)return;
 const subject=$('indicatorReportSubject').value,list=indicatorTestsFor(subject),old=el.value;
 el.innerHTML=list.length?'<option value="">اختر اختبار المؤشرات</option>'+list.map(t=>'<option value="'+E(t.id)+'">'+E(t.title)+' — '+ar(t.count)+' طالب/محاولة</option>').join(''):'<option value="">لا توجد محاولات قابلة للقياس للمادة المختارة</option>';
 if(list.some(t=>String(t.id)===old))el.value=old;
 standaloneHtml='';$('printIndicatorReportBtn').disabled=true;
 $('indicatorReportState').textContent=list.length?'متاح '+ar(list.length)+' اختبارًا بنتائج محفوظة؛ اختر اختبارًا ثم اضغط إنشاء تحليل المؤشرات.':'لا توجد نتائج مكتملة لهذه المادة أو لم تُرجع خدمة البيانات روابط الأسئلة والمؤشرات.';
}
async function buildIndicatorReport(){
 const subject=$('indicatorReportSubject')?.value,testId=$('indicatorReportTest')?.value,className=$('indicatorReportClass')?.value||'';
 if(!testId){$('indicatorReportState').textContent='اختر الاختبار أولًا.';return}
 if(!loaded)await load(false);
 if(!loaded){$('indicatorReportState').textContent='تعذر تحميل بيانات نتائج الاختبار؛ يرجى إعادة المحاولة بعد تسجيل الدخول.';return}
 const test=tests.find(t=>String(t.id)===String(testId))||{},
 recs=indicatorRecords(testId,subject,className),part=participationGroup(testId,className,subject);
 if(!recs.length){standaloneHtml='';$('indicatorReportPreview').innerHTML='<div class="report-preview-empty">لم تتوفر نتائج مكتملة لهذه المادة والفصل؛ لا يمكن تكوين تحليل دون بيانات حقيقية.</div>';$('printIndicatorReportBtn').disabled=true;return}
 try{
  const body=window.NafesIndicatorDetailedReport?.render({test,subject,testId,className,recs,attempts,students,part});
  if(!body)throw Error('ملف التحليل التفصيلي غير محمل.');
  standaloneHtml='<article class="subject-analysis-sheet official-analysis-sheet" data-indicator-report="true">'+body+'</article>';
  $('indicatorReportPreview').innerHTML=standaloneHtml;
  $('printIndicatorReportBtn').disabled=false;
  const measured=recs.filter(r=>indicatorQuestions(r.a,subject).length).length;
  $('indicatorReportState').textContent='اكتمل إنشاء التقرير: '+ar(recs.length)+' نتيجة، منها '+ar(measured)+' بسجل أسئلة مؤشرات قابل للتحليل.'+(measured===0?' لا توجد بيانات مؤكدة للسؤال والمؤشر؛ لا يمكن استنتاج فجوات.':'');
 }catch(e){standaloneHtml='';$('printIndicatorReportBtn').disabled=true;$('indicatorReportState').textContent='تعذر إنشاء التقرير: '+(e?.message||String(e));$('indicatorReportPreview').innerHTML='<div class="report-preview-empty">تعذر تحليل النتائج؛ لم تتغير البيانات المحفوظة.</div>';}
}
async function loadData(force=false){if(T.loadAnalysis)return T.loadAnalysis(force);const cached=window[DATA_CACHE];if(!force&&cached?.data&&Date.now()-cached.at<30000)return cached.data;if(!force&&cached?.promise)return cached.promise;const promise=(async()=>{let cursor=0,all=[],ts=[],page=0;const seen=new Set();do{const key=String(cursor);if(seen.has(key))throw new Error('تكرر مؤشر صفحات النتائج؛ تم إيقاف التحميل.');seen.add(key);const d=await T.api('teacher_data',{cursor,limit:100});all.push(...(d.attempts||[]));if(page===0)ts=d.tests||[];cursor=d.next_cursor;page++;if(page>500)throw new Error('عدد صفحات النتائج أكبر من الحد الآمن.');await new Promise(r=>setTimeout(r,0))}while(cursor!==null);return{attempts:all.map(x=>A?.normalizeAttempt?A.normalizeAttempt(x):x),tests:ts}})();window[DATA_CACHE]={promise,at:Date.now()};try{const data=await promise;window[DATA_CACHE]={data,at:Date.now()};return data}catch(e){delete window[DATA_CACHE];throw e}}
async function load(force=false){if(loading||!T?.getKey?.())return;loading=true;try{const [data,roster]=await Promise.all([loadData(force),T.api('teacher_students_list',{include_archived:false})]);attempts=data.attempts;tests=data.tests;students=roster?.students||[];loaded=true;fillTests();fillIndicatorTests()}catch(e){$('subjectReportState').textContent='تعذر تحميل بيانات تقرير المادة: '+(e.message||e);if($('indicatorReportState'))$('indicatorReportState').textContent='تعذر تحميل بيانات اختبار المؤشرات: '+(e.message||e)}finally{loading=false}}
window.NafesSubjectReport={open:async({subject,testId,className=''})=>{
 const deadline=Date.now()+20000;
 while(loading&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
 await load(false);
 if(!loaded)throw new Error('تعذر تحميل التقرير؛ اضغط تحديث وأعد المحاولة.');
 document.querySelector('[data-view="subjectReport"]')?.click();
 // Allow the section router's deferred change event before selecting this test.
 await new Promise(resolve=>setTimeout(resolve,50));
 $('reportSubjectSelect').value=subject;fillTests();
 $('reportSubjectTest').value=testId;$('reportSubjectClass').value=className;
 if($('reportSubjectTest').value!==testId)throw new Error('لم تصل درجات المادة المحفوظة بعد؛ حدّث الصفحة وأعد المحاولة.');
 await build();
}};
function init(){if(!$('reportSubjectTest'))return;$('indicatorReportSubject')?.addEventListener('change',fillIndicatorTests);$('indicatorReportTest')?.addEventListener('change',()=>{$('printIndicatorReportBtn').disabled=true;});$('indicatorReportClass')?.addEventListener('change',()=>{$('printIndicatorReportBtn').disabled=true;});$('buildIndicatorReportBtn').onclick=buildIndicatorReport;$('printIndicatorReportBtn').onclick=()=>{if(!standaloneHtml)return;const root=$('printRoot');root.innerHTML=standaloneHtml;root.setAttribute('aria-hidden','false');window.print()};$('reportSubjectSelect').addEventListener('change',()=>{if(loaded)fillTests();else load(false)});$('reportSubjectTest').addEventListener('change',invalidate);$('reportSubjectClass').addEventListener('change',()=>{if($('reportSubjectTest').value)build();else invalidate()});$('buildSubjectReportBtn').onclick=build;$('printSubjectReportBtn').onclick=()=>{if(!reportHtml)return;const root=$('printRoot');root.innerHTML=reportHtml;root.setAttribute('aria-hidden','false');window.print()};load(false)}
addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated){loaded=false;load(false)}});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();