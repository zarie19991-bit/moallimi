(()=>{
'use strict';
const T=window.NafesTeacher,A=window.NafesAnalytics,$=id=>document.getElementById(id);
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const keys=['reading','math','science'];
const SETTINGS_KEY='nafes_school_report_settings_v1';
let attempts=[],tests=[],loaded=false,loading=false;

function E(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ar(v){return v===null||v===undefined||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v));}
function pct(v){return v===null||v===undefined||Number.isNaN(Number(v))?'—':`${ar(v)}٪`;}
function settings(){try{return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:'',...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(_){return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:''}}}
function submitted(a){return A?.isSubmitted?A.isSubmitted(a):!!(a?.submitted_at||a?.completed_at||a?.finished_at||String(a?.status||'').toLowerCase()==='submitted');}
function ident(a){return A?.studentIdentity?.(a)||String(a?.student_id||a?.student_name||a?.full_name||a?.id||'');}
function when(a){return Date.parse(a?.submitted_at||a?.completed_at||a?.finished_at||a?.started_at||a?.updated_at||0)||0;}
function testId(a){return String(a?.test_id||a?.assessment_id||a?.exam_id||'').trim();}
function classMatches(a,c){return !c||String(a?.class_name||'').trim()===String(c).trim();}
function qList(a){return Array.isArray(a?.questions)?a.questions:[];}
function normSubject(v){const s=String(v||'').trim().toLowerCase();if(['reading','arabic','language','القراءة','العربية','اللغة العربية'].includes(s))return'reading';if(['math','mathematics','الرياضيات'].includes(s))return'math';if(['science','العلوم'].includes(s))return'science';return'';}
function scorable(q){return A?.isScorable?A.isScorable(q):(typeof q?.correct==='boolean'||Number(q?.correct_index??q?.correctIndex)>=0);}
function measure(a,subject){
 if(A?.measure){const m=A.measure(a,{subject});if(m?.total)return m;}
 const qs=qList(a).filter(q=>normSubject(q.subject||q.subject_key)===subject&&scorable(q));
 const correct=qs.filter(q=>q.correct===true).length;
 return{correct,total:qs.length,percent:qs.length?correct/qs.length*100:null};
}
function mean(v){const a=v.filter(x=>Number.isFinite(Number(x))).map(Number);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
function mode(v){const m=new Map();v.forEach(x=>m.set(x,(m.get(x)||0)+1));let best=null,n=-1;for(const [k,c] of m)if(c>n){best=k;n=c}return best;}
function titleOf(id){const t=tests.find(x=>String(x.id||x.test_id||'')===String(id));const a=attempts.find(x=>testId(x)===String(id));return String(t?.title||a?.test_title||a?.assessment_title||a?.title||'اختبار نافس');}
function testMeta(id){return tests.find(x=>String(x.id||x.test_id||'')===String(id))||{};}
function latestRecords(id,subject,className=''){
 const map=new Map();
 for(const a of attempts){
  if(!submitted(a)||testId(a)!==String(id)||!classMatches(a,className))continue;
  const m=measure(a,subject);if(!m.total)continue;
  const k=ident(a);if(!k)continue;
  const old=map.get(k);if(!old||when(a)>when(old.a))map.set(k,{a,m});
 }
 return [...map.values()];
}
function testsFor(subject){
 const g=new Map();
 for(const a of attempts){
  if(!submitted(a))continue;const id=testId(a);if(!id)continue;
  const m=measure(a,subject);if(!m.total)continue;
  const old=g.get(id)||{id,title:titleOf(id),time:0,count:0};old.time=Math.max(old.time,when(a));old.count++;g.set(id,old);
 }
 return [...g.values()].sort((a,b)=>b.time-a.time);
}
const levels=[
 {key:'excellent',label:'ممتاز',range:'٩٠ - ١٠٠'},
 {key:'verygood',label:'جيد جدًا',range:'٨٠ - أقل من ٩٠'},
 {key:'good',label:'جيد',range:'٧٠ - أقل من ٨٠'},
 {key:'pass',label:'مقبول',range:'٥٠ - أقل من ٧٠'},
 {key:'fail',label:'راسب',range:'أقل من ٥٠'}
];
function level(p){if(p>=90)return'excellent';if(p>=80)return'verygood';if(p>=70)return'good';if(p>=50)return'pass';return'fail';}
function logo(src){return src?`<img src="${src}" alt="شعار وزارة التعليم">`:`<div class="sar-logo-fallback">وزارة التعليم</div>`;}
function ring(l,count,n){const p=n?count/n*100:0;return `<div class="sar-ring-item"><div class="sar-ring ${l.key}" style="--p:${Math.max(0,Math.min(100,p))}%"><div><b>${E(l.label)}</b><strong>${pct(p)}</strong></div></div></div>`;}
function bar(l,count,max){const h=max?Math.max(count?6:0,count/max*100):0;return `<div class="sar-bar-item"><div class="sar-bar-track"><i class="${l.key}" style="--h:${h}%">${count?`<b>${ar(count)}</b>`:''}</i></div><span>${E(l.label)}</span></div>`;}
function sheet(subject,testIdValue,className=''){
 const recs=latestRecords(testIdValue,subject,className);
 if(!recs.length)return'';
 const vals=recs.map(x=>Number(x.m.percent)),scores=recs.map(x=>Number(x.m.correct)),totals=recs.map(x=>Number(x.m.total));
 const n=recs.length,degree=mode(totals)??Math.max(...totals),highest=Math.max(...scores),lowest=Math.min(...scores),sum=scores.reduce((a,b)=>a+b,0),avg=mean(scores),success=vals.filter(v=>v>=50).length/n*100;
 const counts=Object.fromEntries(levels.map(l=>[l.key,vals.filter(p=>level(p)===l.key).length]));
 const maxCount=Math.max(1,...Object.values(counts));
 const s=settings(),t=testMeta(testIdValue),term=t.term||t.academic_term||t.semester||'—',cls=className||t.class_name||'كل الفصول';
 const achievementRows=levels.map(l=>`<tr><td><span class="sar-level-tag ${l.key}">${l.label}</span></td><td>${l.range}</td><td>${ar(counts[l.key])}</td></tr>`).join('');
 return `<article class="subject-analysis-sheet official-analysis-sheet">
  <header class="sar-head">
   <div class="sar-admin"><b>الإدارة العامة للتعليم بمنطقة نجران</b><span>${E(s.schoolName||'مدرسة /')}</span></div>
   <div class="sar-ministry">${logo(s.ministryLogo)}</div>
   <div class="sar-form-no">١</div>
  </header>
  <h1>تحليل نتائج اختبار مادة [${E(names[subject])}]</h1>
  <div class="sar-meta">
   <div><span>المرحلة الدراسية / الصف:</span><b>الثالث المتوسط${cls&&cls!=='كل الفصول'?` / ${E(cls)}`:''}</b></div>
   <div><span>السنة / الفصل الدراسي:</span><b>${E(term)}</b></div>
   <div><span>درجة القياس (الاختبار):</span><b>${ar(degree)}</b></div>
  </div>
  <div class="sar-analysis-grid">
   <section class="sar-stats"><h2>الإحصائيات الأساسية</h2><div class="sar-stat-list">
    <div><span>عدد الطلاب</span><b>${ar(n)}</b></div>
    <div><span>أعلى درجة</span><b>${ar(highest)}</b></div>
    <div><span>أقل درجة</span><b>${ar(lowest)}</b></div>
    <div><span>متوسط الدرجات</span><b>${ar(avg)}</b></div>
    <div><span>نسبة النجاح</span><b>${pct(success)}</b></div>
    <div><span>مجموع الدرجات</span><b>${ar(sum)}</b></div>
   </div></section>
   <section class="sar-achievement"><h2>الإحصائيات التحصيلية</h2><table><thead><tr><th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th></tr></thead><tbody>${achievementRows}</tbody></table></section>
  </div>
  <section class="sar-chart-card"><h2>رسم بياني (نسب الطلاب لكل تقدير)</h2><div class="sar-rings">${levels.map(l=>ring(l,counts[l.key],n)).join('')}</div></section>
  <section class="sar-chart-card"><h2>رسم بياني (عدد الطلاب لكل تقدير)</h2><div class="sar-bars">${levels.map(l=>bar(l,counts[l.key],maxCount)).join('')}</div></section>
  <footer class="sar-signatures"><div><b>معلم/ة المادة:</b><span>${E(s.teacherName||'')}</span></div><div><b>مدير/ة المدرسة:</b><span>${E(s.principalName||'')}</span></div></footer>
 </article>`;
}
function injectStyle(){
 if($('officialAnalysisStyle'))return;
 const st=document.createElement('style');st.id='officialAnalysisStyle';st.textContent=`
 .official-analysis-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap;width:100%}.official-analysis-controls label{min-width:190px}.official-analysis-preview{display:grid;gap:20px;margin:14px 0 22px}.official-analysis-preview:empty{display:none}.official-analysis-note{margin:8px 0 0;color:#687a83;font-size:12px}.official-analysis-sheet{max-width:1100px;margin:0 auto}.analysis-diagnostic-title{margin:26px 0 12px;padding:14px 18px;border:1px solid #dce7e3;background:#f7faf9;border-radius:14px}.analysis-diagnostic-title h3{margin:0 0 4px}.analysis-diagnostic-title p{margin:0;color:#687a83;font-size:12px}
 @media print{.official-analysis-sheet{max-width:none!important}.official-analysis-sheet:last-child{page-break-after:auto}.official-analysis-preview{display:block}.official-analysis-sheet{page-break-after:always}}
 `;document.head.appendChild(st);
}
function addLabel(toolbar,id,label){if($(id))return $(id);const wrap=document.createElement('label');wrap.innerHTML=`<span>${label}</span><select id="${id}"><option value="">جارٍ تحميل الاختبارات…</option></select>`;const print=toolbar.querySelector('button[id^="print"]');toolbar.insertBefore(wrap,print||null);return $(id);}
function addBuildButton(toolbar,id,text){if($(id))return;const b=document.createElement('button');b.id=id;b.type='button';b.className='btn ghost';b.textContent=text;const print=toolbar.querySelector('button[id^="print"]');toolbar.insertBefore(b,print||null);}
function addPreview(viewId,previewId){if($(previewId))return;const view=$(viewId),control=view?.querySelector('.section-control-card');if(!view||!control)return;const p=document.createElement('div');p.id=previewId;p.className='official-analysis-preview';control.insertAdjacentElement('afterend',p);const diag=document.createElement('div');diag.className='analysis-diagnostic-title';diag.innerHTML='<h3>التحليل التشخيصي الإضافي</h3><p>يعرض الطلاب والمؤشرات والأسئلة، ولا يدخل في ورقة التحليل الرسمية عند الطباعة.</p>';p.insertAdjacentElement('afterend',diag);}
function installControls(){
 injectStyle();
 const ov=$('overviewView')?.querySelector('.section-control-card .toolbar');
 if(ov){addLabel(ov,'analysisReadingTest','اختبار القراءة');addLabel(ov,'analysisMathTest','اختبار الرياضيات');addLabel(ov,'analysisScienceTest','اختبار العلوم');addBuildButton(ov,'buildOverviewOfficialBtn','إنشاء التحليل الرسمي');addPreview('overviewView','overviewOfficialPreview');}
 const sv=$('subjectView')?.querySelector('.section-control-card .toolbar');
 if(sv){addLabel(sv,'analysisSubjectTest','الاختبار');addBuildButton(sv,'buildSubjectOfficialBtn','إنشاء التحليل الرسمي');addPreview('subjectView','subjectOfficialPreview');}
}
function fillSelect(id,subject){
 const el=$(id);if(!el)return;const rows=testsFor(subject),old=el.value;
 el.innerHTML=rows.length?rows.map((r,i)=>`<option value="${E(r.id)}">${E(r.title)} (${ar(r.count)} نتيجة)</option>`).join(''):`<option value="">لا توجد نتائج مسلّمة</option>`;
 if(rows.some(r=>r.id===old))el.value=old;
}
function populate(){fillSelect('analysisReadingTest','reading');fillSelect('analysisMathTest','math');fillSelect('analysisScienceTest','science');fillSelect('analysisSubjectTest',$('subjectSelect')?.value||'reading');}
function buildOverview(){
 const cls=$('overviewClass')?.value||'';const map={reading:$('analysisReadingTest')?.value,math:$('analysisMathTest')?.value,science:$('analysisScienceTest')?.value};
 const html=keys.map(k=>map[k]?sheet(k,map[k],cls):'').filter(Boolean).join('');
 const host=$('overviewOfficialPreview');if(host)host.innerHTML=html||'<div class="report-preview-empty">لا توجد نتائج مسلّمة كافية لإنشاء التحليل الرسمي للمواد.</div>';
 return html;
}
function buildSubject(){
 const subject=$('subjectSelect')?.value||'reading',tid=$('analysisSubjectTest')?.value||'',cls=$('subjectClass')?.value||'';
 const html=tid?sheet(subject,tid,cls):'';const host=$('subjectOfficialPreview');if(host)host.innerHTML=html||'<div class="report-preview-empty">اختر اختبارًا لديه نتائج مسلّمة لهذه المادة.</div>';return html;
}
function printHtml(html){if(!html)return;const root=$('printRoot');root.innerHTML=html;root.setAttribute('aria-hidden','false');requestAnimationFrame(()=>window.print());}
async function load(){
 if(loading||!T?.getKey?.())return;loading=true;
 try{let cursor=0,raw=[],ts=[];do{const d=await T.api('teacher_data',{cursor,limit:100});raw.push(...(d.attempts||[]));if(cursor===0)ts=d.tests||[];cursor=d.next_cursor}while(cursor!==null);attempts=raw.map(x=>A?.normalizeAttempt?A.normalizeAttempt(x):x);tests=ts;loaded=true;populate();}
 catch(e){console.error('official analysis load',e)}finally{loading=false;}
}
function init(){
 installControls();
 $('subjectSelect')?.addEventListener('change',()=>{if(loaded)fillSelect('analysisSubjectTest',$('subjectSelect').value);const h=$('subjectOfficialPreview');if(h)h.innerHTML='';});
 $('overviewClass')?.addEventListener('change',()=>{const h=$('overviewOfficialPreview');if(h)h.innerHTML='';});
 $('subjectClass')?.addEventListener('change',()=>{const h=$('subjectOfficialPreview');if(h)h.innerHTML='';});
 $('analysisReadingTest')?.addEventListener('change',()=>{const h=$('overviewOfficialPreview');if(h)h.innerHTML='';});
 $('analysisMathTest')?.addEventListener('change',()=>{const h=$('overviewOfficialPreview');if(h)h.innerHTML='';});
 $('analysisScienceTest')?.addEventListener('change',()=>{const h=$('overviewOfficialPreview');if(h)h.innerHTML='';});
 $('analysisSubjectTest')?.addEventListener('change',()=>{const h=$('subjectOfficialPreview');if(h)h.innerHTML='';});
 $('buildOverviewOfficialBtn')?.addEventListener('click',buildOverview);
 $('buildSubjectOfficialBtn')?.addEventListener('click',buildSubject);
 $('printOverviewAnalysisBtn')?.addEventListener('click',()=>printHtml(buildOverview()));
 $('printSubjectAnalysisBtn')?.addEventListener('click',()=>printHtml(buildSubject()));
 $('refreshBtn')?.addEventListener('click',()=>setTimeout(load,120));
 addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated){loaded=false;load();}});
 addEventListener('afterprint',()=>{const root=$('printRoot');if(root){root.innerHTML='';root.setAttribute('aria-hidden','true');}});
 load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();