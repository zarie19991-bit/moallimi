(()=>{
const NAFES_SUBJECTS=['arabic','math','science'];
const META={
 arabic:{title:'القراءة — لغتي الخالدة',icon:'ق',soft:'#e4f1ee',color:'#0f514c'},
 math:{title:'الرياضيات',icon:'∑',soft:'#f6eddf',color:'#986a25'},
 science:{title:'العلوم',icon:'ع',soft:'#edf1e6',color:'#667b33'}
};
const LEGACY_BLOCKED=new Set(['math','science']);
let nafesSubject='arabic';
let frameworkRows=[];
let frameworkLoaded=false;
let frameworkLoading=null;

const isNafesAssessment=a=>String(a?.title||'').includes('نافس')||String(a?.term||'')==='نافس';
const profileFor=subject=>state.profiles.find(p=>p.subject_key===subject&&p.grade_level==='الثالث المتوسط');
const nafesTestsFor=subject=>{const p=profileFor(subject);return p?state.assessments.filter(a=>a.subject_profile_id===p.id&&isNafesAssessment(a)):[]};
const nafesResultsFor=subject=>{if(LEGACY_BLOCKED.has(subject))return[];const p=profileFor(subject);return p?state.results.filter(r=>r.subject_profile_id===p.id&&String(r.assessment_label||'').includes('نافس')):[]};
const rowsFor=subject=>frameworkRows.filter(r=>r.subject_key===subject).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));
const countIndicators=subject=>rowsFor(subject).reduce((n,r)=>n+(Array.isArray(r.indicators)?r.indicators.length:0),0);
const countOutcomes=subject=>rowsFor(subject).length;
const safeId=s=>String(s||'').replace(/[^a-zA-Z0-9_-]/g,'-');

async function loadNafesFramework(force=false){
 if(frameworkLoaded&&!force)return frameworkRows;
 if(frameworkLoading)return frameworkLoading;
 const path='/rest/v1/nafes_framework_2026?select=subject_key,domain_name,subdomain_name,outcome_code,outcome_title,indicators,sort_order,source_name,source_context&grade_level=eq.'+encodeURIComponent('الثالث المتوسط')+'&is_active=eq.true&order=subject_key.asc,sort_order.asc';
 frameworkLoading=req(path).then(r=>{
  if(!r.ok)throw new Error(r.msg||'تعذر تحميل نواتج التعلم الرسمية');
  frameworkRows=Array.isArray(r.data)?r.data:[];
  frameworkLoaded=true;frameworkLoading=null;return frameworkRows;
 }).catch(e=>{frameworkLoading=null;throw e});
 return frameworkLoading;
}

function domainGroups(subject){
 const groups=[];
 for(const row of rowsFor(subject)){
  let g=groups.find(x=>x.name===row.domain_name);
  if(!g){g={name:row.domain_name,rows:[]};groups.push(g)}
  g.rows.push(row);
 }
 return groups;
}
function indicatorTotal(rows){return rows.reduce((n,r)=>n+(Array.isArray(r.indicators)?r.indicators.length:0),0)}
function outcomeCard(row,index){
 const inds=Array.isArray(row.indicators)?row.indicators:[],id='official-'+safeId(row.outcome_code);
 return `<section class="nafes-goal nafes-official-outcome">
  <div class="nafes-goal-head"><div class="nafes-goal-no">${index+1}</div><div><div class="nafes-outcome-meta"><span>${esc(row.outcome_code)}</span><span>${esc(row.subdomain_name||row.domain_name)}</span><span>${inds.length} مؤشر</span></div><strong>${esc(row.outcome_title)}</strong></div></div>
  <button class="nafes-indicator-toggle" type="button" onclick="toggleOfficialNafesIndicators('${id}',this)">عرض المؤشرات</button>
  <div id="${id}" class="nafes-indicators nafes-indicators-collapsed"><div class="nafes-indicators-title">المؤشرات التفصيلية</div>${inds.map((x,j)=>`<div class="nafes-indicator"><b>${j+1}</b><span>${esc(x)}</span></div>`).join('')}</div>
 </section>`;
}
window.toggleOfficialNafesIndicators=function(id,btn){const p=document.getElementById(id);if(!p)return;const open=p.classList.toggle('open');if(btn)btn.textContent=open?'إخفاء المؤشرات':'عرض المؤشرات'};

const baseRenderSection=renderSection;
renderSection=function(n){if(n==='nafes')return renderNafes();return baseRenderSection(n)};

renderSubjects=function(){
 const area=$('subjectsArea');if(state.subjectDetail){renderSubjectDetail();return}
 const cards=Object.entries(SUBJECTS).map(([k,s])=>{const ps=state.profiles.filter(p=>p.subject_key===k),tests=state.assessments.filter(a=>ps.some(p=>p.id===a.subject_profile_id)&&!isNafesAssessment(a)),tasks=state.assignments.filter(a=>(a.subject_key||'arabic')===k);return `<button class="subject-card" style="--subject-soft:${s.soft};--subject-color:${s.color}" onclick="openSubject('${k}')"><span class="subject-icon">${s.icon}</span><h3>${s.name}</h3><p>${k==='english'?'تدريب تأسيسي وتدرج حتى الإتقان، مع اختبارات مرتبطة بدروس المرحلة.':'اختبارات وتدريب مرتبط بالدروس والمهارات المنهجية، وتظهر النتائج مباشرة في ملف الطالب.'}</p><div class="mini"><span>${tests.length} اختبار</span><span>${tasks.length} واجب/مشروع</span><span>${k==='english'?'مسار تأسيسي':'مسار منهجي'}</span></div></button>`}).join('');
 area.innerHTML=`<div class="subject-grid">${cards}</div><div class="soft-card" style="margin-top:14px"><b>ملاحظة:</b> تم فصل نافس عن المواد. اختبارات نافس ونواتج التعلم ومؤشراته موجودة في قسم نافس المستقل.</div>`
};

renderSubjectDetail=function(){
 const area=$('subjectsArea'),s=SUBJECTS[state.subject],p=currentProfile(),tests=state.assessments.filter(a=>a.subject_profile_id===p?.id&&!isNafesAssessment(a)),tasks=state.assignments.filter(a=>(a.subject_key||'arabic')===state.subject&&state.classes.find(c=>c.id===a.class_id)?.grade===state.grade),res=p?state.results.filter(r=>r.subject_profile_id===p.id&&!String(r.assessment_label||'').includes('نافس')):[],students=[...new Set(res.map(r=>r.student_id).filter(Boolean))],avg=res.length?res.reduce((n,r)=>n+(+r.percent||0),0)/res.length:null;
 area.innerHTML=`<div class="subject-back"><button class="btn" onclick="closeSubject()">→ رجوع للمواد</button></div>${gradeTabs('subjectGrade')}<div class="page-head"><div><h2>${s.name} — ${state.grade}</h2><p>${state.subject==='english'?'تدريب تدريجي من التأسيس إلى الإتقان ثم اختبارات الدروس.':'اختبارات مرتبطة بالدروس والمهارات المنهجية، وكل نتيجة ترتبط بالطالب مباشرة.'}</p></div><div class="actions"><button class="btn" onclick="openAssessmentModal()">+ اختبار جديد</button></div></div><div class="metrics"><div class="metric"><span>اختبارات المادة</span><b>${tests.length}</b><small>بدون نافس</small></div><div class="metric"><span>الطلاب المقاسون</span><b>${students.length}</b><small>ظهرت لهم نتائج</small></div><div class="metric"><span>متوسط المادة</span><b>${pct(avg)}</b><small>من القياسات المسجلة</small></div><div class="metric"><span>الواجبات والمشاريع</span><b>${tasks.length}</b><small>مرتبطة بالمادة</small></div></div><div class="card"><h3 style="margin-top:0">مسار الطالب</h3><div class="level-path">${['البداية|تأسيس','أتدرب|توجيه','أتقدم|مستقل','أطبق|سياق جديد','أتقن|قياس إتقان','أتحدى نفسي|إثراء'].map(x=>{const[a,b]=x.split('|');return `<div class="level-step"><b>${a}</b><small>${b}</small></div>`}).join('')}</div></div><div class="card" style="margin-top:12px"><div class="page-head" style="margin-bottom:10px"><div><h2 style="font-size:18px">اختبارات المادة</h2><p>هذه المساحة للاختبارات المنهجية والتأسيسية. اختبارات نافس موجودة في قسم نافس المستقل.</p></div></div><div class="test-list">${tests.map(t=>`<div class="test-row"><div><h4>${esc(t.title)}</h4><p>${assessmentType(t.assessment_type)} · ${t.level_target==='adaptive'?'يتكيف مع مستوى الطالب':t.level_target} · ${t.status==='open'?'مفتوح':'غير مفتوح'}</p></div><div class="actions">${t.access_code?`<span class="test-code">${esc(t.access_code)}</span>`:''}${t.status==='open'?`<button class="btn" onclick="shareTest('${t.id}')">كود / QR</button>`:`<button class="btn primary" onclick="openTest('${t.id}')">فتح للطلاب</button>`}</div></div>`).join('')||'<div class="empty"><b>لا توجد اختبارات منهجية لهذه المادة والمرحلة بعد.</b>أنشئ اختبارًا مرتبطًا بدروس المرحلة.</div>'}</div></div>`
};

window.setNafesSubject=function(k){nafesSubject=NAFES_SUBJECTS.includes(k)?k:'arabic';renderNafes()};
function renderNafes(){
 const area=$('nafesArea');if(!area)return;
 if(!frameworkLoaded){
  area.innerHTML='<div class="card"><div class="empty"><b>جارٍ تحميل نواتج التعلم والمؤشرات الرسمية للصف الثالث المتوسط...</b></div></div>';
  loadNafesFramework().then(()=>{if(state.section==='nafes')renderNafes()}).catch(e=>{area.innerHTML=`<div class="card"><div class="empty"><b>تعذر تحميل إطار نافس.</b>${esc(e.message||'حاول مرة أخرى.')}</div></div>`});return;
 }
 const meta=META[nafesSubject],rows=rowsFor(nafesSubject),groups=domainGroups(nafesSubject),allTests=nafesTestsFor(nafesSubject),tests=LEGACY_BLOCKED.has(nafesSubject)?[]:allTests,results=nafesResultsFor(nafesSubject),students=[...new Set(results.map(r=>r.student_id).filter(Boolean))],avg=results.length?results.reduce((n,r)=>n+(+r.percent||0),0)/results.length:null;
 const subjectCards=NAFES_SUBJECTS.map(k=>{const m=META[k];return `<button class="nafes-subject ${nafesSubject===k?'active':''}" style="--nafes-soft:${m.soft};--nafes-color:${m.color}" onclick="setNafesSubject('${k}')"><span class="icon">${m.icon}</span><h4>${m.title}</h4><p>نواتج التعلم الرسمية للصف الثالث المتوسط ومؤشراتها التفصيلية.</p><span class="count">${countOutcomes(k)} ناتج · ${countIndicators(k)} مؤشر</span></button>`}).join('');
 let oi=0;
 const official=groups.map(g=>`<section class="nafes-domain-group"><div class="nafes-domain-head"><div><small>المجال</small><h3>${esc(g.name)}</h3></div><div><b>${g.rows.length}</b><span>نواتج</span><b>${indicatorTotal(g.rows)}</b><span>مؤشرات</span></div></div><div class="nafes-goals">${g.rows.map(r=>outcomeCard(r,oi++)).join('')}</div></section>`).join('');
 const recent=tests.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,10);
 area.innerHTML=`<section class="nafes-hero"><span class="kicker">الاختبارات الوطنية نافس · الثالث المتوسط</span><h3>نواتج التعلم والمؤشرات الرسمية 2026</h3><p>أصبحت القراءة والرياضيات والعلوم مبنية على إطار الصف التاسع التفصيلي بدل المعايير المختصرة السابقة. كل سؤال جديد يجب أن يرتبط بناتج تعلم ومؤشر محدد.</p><div class="nafes-flow"><span>المجال</span><span>ناتج التعلم</span><span>المؤشر</span><span>السؤال</span><span>النتيجة</span><span>العلاج</span></div></section>
 <div class="nafes-subjects">${subjectCards}</div>
 <div class="metrics"><div class="metric"><span>نواتج التعلم</span><b>${rows.length}</b><small>${meta.title}</small></div><div class="metric"><span>المؤشرات التفصيلية</span><b>${countIndicators(nafesSubject)}</b><small>إطار 2026</small></div><div class="metric"><span>اختبارات متاحة حاليًا</span><b>${tests.length}</b><small>${LEGACY_BLOCKED.has(nafesSubject)?'البنك السابق موقوف لإعادة البناء':'مرتبطة بالقراءة'}</small></div><div class="metric"><span>طلاب تم قياسهم</span><b>${students.length}</b><small>${LEGACY_BLOCKED.has(nafesSubject)?'لا تُحتسب النتائج القديمة':'نتائج نافس المسجلة'}</small></div></div>
 <div class="nafes-source-note"><b>مصدر المهارات:</b> هيئة تقويم التعليم والتدريب — وثيقة نواتج التعلم للاختبارات الوطنية 2026. <span>الملف المرفوع «ركاز التعليمية» هو بوابة تعليم نجران للوصول إلى أدلة المرحلة المتوسطة في القراءة والرياضيات والعلوم، أما النص التفصيلي للمؤشرات فمحفوظ من الوثيقة الرسمية للهيئة.</span></div>
 <div class="nafes-headline"><div><h3>${meta.title}</h3><p>${rows.length} ناتج تعلم رسمي، وتحت كل ناتج تظهر المؤشرات التي يجب أن يقيسها التدريب والاختبار.</p></div><div class="actions">${nafesSubject==='arabic'&&typeof buildArabicReadyTest==='function'?'<button class="btn primary" onclick="buildArabicReadyTest();setTimeout(()=>{switchSection(\'nafes\');setNafesSubject(\'arabic\')},500)">إنشاء اختبار من بنك القراءة</button>':''}</div></div>
 <div class="nafes-official-framework">${official||'<div class="empty">لا توجد نواتج تعلم محفوظة لهذه المادة.</div>'}</div>
 <section class="nafes-tests nafes-legacy-tests"><div class="nafes-headline"><div><h3>الاختبارات المتاحة — ${meta.title}</h3><p>${LEGACY_BLOCKED.has(nafesSubject)?'الاختبارات السابقة موقوفة حتى إعادة بناء بنك الأسئلة على هذه المؤشرات الرسمية.':'تظهر آخر عشرة اختبارات فقط لتبقى الصفحة سريعة.'}</p></div></div><div class="test-list">${recent.map(t=>`<div class="test-row"><div><h4>${esc(t.title)}</h4><p>${assessmentType(t.assessment_type)} · ${t.status==='open'?'مفتوح للطلاب':'غير مفتوح'} · ${t.level_target==='adaptive'?'يتكيف مع مستوى الطالب':t.level_target}</p></div><div class="actions">${t.access_code?`<span class="test-code">${esc(t.access_code)}</span>`:''}${t.status==='open'?`<button class="btn" onclick="shareTest('${t.id}')">كود / QR</button>`:`<button class="btn primary" onclick="openTest('${t.id}');setTimeout(()=>{switchSection('nafes');setNafesSubject('${nafesSubject}')},400)">فتح للطلاب</button>`}</div></div>`).join('')||'<div class="empty"><b>لا توجد اختبارات معتمدة متاحة لهذه المادة حاليًا.</b></div>'}</div>${tests.length>10?`<div class="nafes-note">يوجد ${tests.length} اختبارًا محفوظًا؛ عُرضت آخر 10 فقط لتقليل الحمل على الصفحة.</div>`:''}</section>`;
}
window.renderNafes=renderNafes;
})();