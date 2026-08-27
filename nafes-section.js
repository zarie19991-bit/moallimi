(()=>{
const NAFES_SUBJECTS=['arabic','math','science'];
const META={
 arabic:{title:'القراءة — لغتي الخالدة',icon:'ق',soft:'#e4f1ee',color:'#0f514c'},
 math:{title:'الرياضيات',icon:'∑',soft:'#f6eddf',color:'#986a25'},
 science:{title:'العلوم',icon:'ع',soft:'#edf1e6',color:'#667b33'}
};
let nafesSubject='arabic';
let nafesView='overview';
let frameworkRows=[];
let frameworkLoaded=false;
let frameworkLoading=null;
let qualityLoaded=false;
let quality={approved:0,unreviewed:0,liveTraining:0};

const isNafesAssessment=a=>String(a?.title||'').includes('نافس')||String(a?.term||'')==='نافس';
const profileFor=subject=>state.profiles.find(p=>p.subject_key===subject&&p.grade_level==='الثالث المتوسط');
const rowsFor=subject=>frameworkRows.filter(r=>r.subject_key===subject).sort((a,b)=>(+a.sort_order||0)-(+b.sort_order||0));
const countIndicators=subject=>rowsFor(subject).reduce((n,r)=>n+(Array.isArray(r.indicators)?r.indicators.length:0),0);
const safeId=s=>String(s||'').replace(/[^a-zA-Z0-9_-]/g,'-');

async function loadNafesFramework(force=false){
 if(frameworkLoaded&&!force)return frameworkRows;
 if(frameworkLoading)return frameworkLoading;
 const path='/rest/v1/nafes_framework_2026?select=subject_key,domain_name,subdomain_name,outcome_code,outcome_title,indicators,sort_order,source_name,source_context&grade_level=eq.'+encodeURIComponent('الثالث المتوسط')+'&is_active=eq.true&order=subject_key.asc,sort_order.asc';
 frameworkLoading=req(path).then(r=>{if(!r.ok)throw new Error(r.msg||'تعذر تحميل إطار نافس');frameworkRows=Array.isArray(r.data)?r.data:[];frameworkLoaded=true;frameworkLoading=null;return frameworkRows}).catch(e=>{frameworkLoading=null;throw e});
 return frameworkLoading;
}
async function loadQuality(){
 if(qualityLoaded)return quality;
 try{
  const [a,u,t]=await Promise.all([
   req('/rest/v1/question_bank?select=id&grade_level=eq.'+encodeURIComponent('الثالث المتوسط')+'&review_status=eq.approved&limit=1000'),
   req('/rest/v1/question_bank?select=id&grade_level=eq.'+encodeURIComponent('الثالث المتوسط')+'&review_status=eq.unreviewed&limit=1000'),
   req('/rest/v1/nafes_training_sets?select=id&grade_level=eq.'+encodeURIComponent('الثالث المتوسط')+'&status=eq.live&is_active=eq.true&limit=100')
  ]);
  quality={approved:a.ok?(a.data||[]).length:0,unreviewed:u.ok?(u.data||[]).length:0,liveTraining:t.ok?(t.data||[]).length:0};
 }catch(_){quality={approved:0,unreviewed:0,liveTraining:0}}
 qualityLoaded=true;return quality;
}
function domainGroups(subject){
 const out=[];for(const row of rowsFor(subject)){let g=out.find(x=>x.name===row.domain_name);if(!g){g={name:row.domain_name,rows:[]};out.push(g)}g.rows.push(row)}return out;
}
function subjectCards(){return NAFES_SUBJECTS.map(k=>{const m=META[k],rows=rowsFor(k);return `<button class="nafes-subject ${nafesSubject===k?'active':''}" style="--nafes-soft:${m.soft};--nafes-color:${m.color}" onclick="setNafesSubject('${k}')"><span class="icon">${m.icon}</span><h4>${m.title}</h4><p>الإطار الرسمي للصف الثالث المتوسط.</p><span class="count">${rows.length} ناتج · ${countIndicators(k)} مؤشر</span></button>`}).join('')}
function localNav(){const items=[['overview','نظرة عامة'],['framework','المهارات والمؤشرات'],['training','التدريب'],['tests','الاختبارات'],['results','النتائج والعلاج']];return `<nav class="nafes-local-nav">${items.map(([k,t])=>`<button class="${nafesView===k?'active':''}" onclick="setNafesView('${k}')">${t}</button>`).join('')}</nav>`}
function outcomeCard(row,index){
 const inds=Array.isArray(row.indicators)?row.indicators:[],id='official-'+safeId(row.outcome_code);
 return `<section class="nafes-goal nafes-official-outcome"><div class="nafes-goal-head"><div class="nafes-goal-no">${index+1}</div><div><div class="nafes-outcome-meta"><span>${esc(row.outcome_code)}</span><span>${esc(row.subdomain_name||row.domain_name)}</span><span>${inds.length} مؤشر</span></div><strong>${esc(row.outcome_title)}</strong></div></div><button class="nafes-indicator-toggle" type="button" onclick="toggleOfficialNafesIndicators('${id}',this)">عرض المؤشرات</button><div id="${id}" class="nafes-indicators nafes-indicators-collapsed"><div class="nafes-indicators-title">المؤشرات التفصيلية</div>${inds.map((x,j)=>`<div class="nafes-indicator"><b>${j+1}</b><span>${esc(x)}</span></div>`).join('')}</div></section>`;
}
function overviewView(){
 const rows=rowsFor(nafesSubject),meta=META[nafesSubject],tests=state.assessments.filter(a=>a.subject_profile_id===profileFor(nafesSubject)?.id&&isNafesAssessment(a)),open=tests.filter(a=>a.status==='open').length;
 return `<section class="nafes-section-panel"><div class="nafes-section-title"><div><span>01</span><h3>صورة القسم الحالية</h3><p>نبدأ من المصدر الرسمي ثم لا نفتح أي تدريب أو اختبار قبل مراجعة السؤال وربطه بالمؤشر الصحيح.</p></div></div><div class="nafes-status-grid"><article class="ready"><b>الإطار الرسمي</b><strong>${rows.length} ناتج · ${countIndicators(nafesSubject)} مؤشر</strong><small>جاهز للعرض والربط</small></article><article class="review"><b>الأسئلة المعتمدة</b><strong>${quality.approved}</strong><small>لا يظهر للطلاب إلا السؤال المراجع</small></article><article class="review"><b>التدريب المباشر</b><strong>${quality.liveTraining}</strong><small>${quality.liveTraining?'متاح من بنوك معتمدة':'موقوف حتى اكتمال المراجعة'}</small></article><article class="review"><b>اختبارات مفتوحة</b><strong>${open}</strong><small>${open?'اختبارات نافس نشطة':'لا يوجد اختبار قديم مفتوح'}</small></article></div><div class="nafes-workflow"><div><b>1</b><span>ناتج التعلم</span></div><i>←</i><div><b>2</b><span>المؤشر</span></div><i>←</i><div><b>3</b><span>سؤال مراجع</span></div><i>←</i><div><b>4</b><span>تدريب متدرج</span></div><i>←</i><div><b>5</b><span>اختبار قياس</span></div><i>←</i><div><b>6</b><span>علاج وتحسن</span></div></div><div class="nafes-source-note"><b>${meta.title}</b><span>المصدر: وثيقة نواتج التعلم للاختبارات الوطنية 2026. التدريب القديم غير المراجع لا يدخل في هذا المسار.</span></div></section>`;
}
function frameworkView(){
 const groups=domainGroups(nafesSubject);let oi=0;
 return `<section class="nafes-section-panel"><div class="nafes-section-title"><div><span>02</span><h3>المهارات والمؤشرات الرسمية</h3><p>التنظيم: المجال ← ناتج التعلم ← المجال الفرعي ← المؤشرات التفصيلية.</p></div></div>${groups.map(g=>`<section class="nafes-domain-group"><div class="nafes-domain-head"><div><small>المجال</small><h3>${esc(g.name)}</h3></div><div><b>${g.rows.length}</b><span>نواتج</span><b>${g.rows.reduce((n,r)=>n+(r.indicators?.length||0),0)}</b><span>مؤشرات</span></div></div><div class="nafes-goals">${g.rows.map(r=>outcomeCard(r,oi++)).join('')}</div></section>`).join('')||'<div class="empty">لا توجد نواتج محفوظة.</div>'}</section>`;
}
function trainingView(){
 return `<section class="nafes-section-panel"><div class="nafes-section-title"><div><span>03</span><h3>التدريب على المؤشرات</h3><p>هذا القسم لا يعرض تدريبًا تجميليًا. لا يفتح التدريب إلا بعد اعتماد أسئلته على المؤشر نفسه.</p></div></div><div class="nafes-training-path"><article><b>البداية</b><span>شرح مبسط للمؤشر وما المطلوب من الطالب</span></article><article><b>أتدرب</b><span>مثال محلول + تلميح + سؤال موجه</span></article><article><b>أتقدم</b><span>أسئلة مستقلة متدرجة الصعوبة</span></article><article><b>أطبق</b><span>موقف جديد أو نص/بيانات جديدة</span></article><article><b>أتقن</b><span>قياس إتقان لا يحتسب أخطاء التدريب</span></article></div>${quality.liveTraining?'<div class="nafes-safe-note good"><b>يوجد تدريب معتمد متاح.</b><span>يعرض فقط البنوك التي اجتازت المراجعة.</span></div>':'<div class="nafes-safe-note"><b>التدريب غير مفتوح حاليًا.</b><span>السبب: لم يعتمد بنك أسئلة كافٍ بعد. هذا أفضل من إظهار تدريب لا يقيس المؤشر فعلًا.</span></div>'}</section>`;
}
function testsView(){
 const p=profileFor(nafesSubject),tests=p?state.assessments.filter(a=>a.subject_profile_id===p.id&&isNafesAssessment(a)):[],open=tests.filter(a=>a.status==='open');
 return `<section class="nafes-section-panel"><div class="nafes-section-title"><div><span>04</span><h3>اختبارات نافس</h3><p>الاختبار الصحيح يبنى من أسئلة معتمدة، ويعطي كل طالب نموذجًا مختلفًا من نفس الكود مع ضبط الوقت والإغلاق.</p></div></div>${open.length?`<div class="test-list">${open.map(t=>`<div class="test-row"><div><h4>${esc(t.title)}</h4><p>مفتوح للطلاب · ${t.duration_minutes||25} دقيقة</p></div><div class="actions"><span class="test-code">${esc(t.access_code||'')}</span><button class="btn" onclick="shareTest('${t.id}')">كود / QR</button></div></div>`).join('')}</div>`:'<div class="nafes-safe-note"><b>لا توجد اختبارات نافس مفتوحة الآن.</b><span>الاختبارات القديمة أغلقت حتى لا تستخدم نتائج غير موثوقة.</span></div>'}<div class="nafes-test-policy"><b>شروط فتح أي اختبار جديد</b><span>كل سؤال معتمد</span><span>مرتبط بمؤشر رسمي</span><span>إجابة ومشتتات مراجعة</span><span>بنك متنوع وكافٍ</span><span>وقت وإغلاق محددان</span></div></section>`;
}
function resultsView(){
 const p=profileFor(nafesSubject),rows=p?state.results.filter(r=>r.subject_profile_id===p.id&&String(r.assessment_label||'').includes('نافس')):[];
 return `<section class="nafes-section-panel"><div class="nafes-section-title"><div><span>05</span><h3>النتائج والعلاج</h3><p>لا نعتمد نتيجة قديمة لمجرد أنها موجودة. التحليل يبدأ فقط من اختبار نافس معتمد.</p></div></div><div class="nafes-result-flow"><article><b>نتيجة الطالب</b><span>درجة الاختبار المعتمد</span></article><article><b>تحليل المؤشرات</b><span>متقن / يحتاج دعمًا</span></article><article><b>خطة علاجية</b><span>تدريب على المؤشرات المتدنية فقط</span></article><article><b>قياس بعدي</b><span>مقارنة قبل/بعد وإظهار مقدار التحسن</span></article></div><div class="nafes-safe-note ${rows.length?'':'muted'}"><b>${rows.length?'توجد سجلات نتائج في قاعدة البيانات.':'لا توجد نتائج معتمدة حاليًا.'}</b><span>${rows.length?'لن تعرض كتحسن معتمد إلا إذا كان مصدرها اختبارًا مجازًا وفق السياسة الجديدة.':'سيظهر التحليل هنا تلقائيًا بعد أول قياس معتمد.'}</span></div><button class="btn no-print" onclick="switchSection('achievement');setTimeout(()=>{state.achievementOfficialPage='nafes-results';renderAchievement()},120)">فتح نافس داخل التحصيل الدراسي</button></section>`;
}

const baseRenderSection=renderSection;
renderSection=function(n){if(n==='nafes')return renderNafes();return baseRenderSection(n)};
window.setNafesSubject=function(k){nafesSubject=NAFES_SUBJECTS.includes(k)?k:'arabic';nafesView='overview';renderNafes()};
window.setNafesView=function(k){nafesView=['overview','framework','training','tests','results'].includes(k)?k:'overview';renderNafes()};
window.toggleOfficialNafesIndicators=function(id,btn){const p=document.getElementById(id);if(!p)return;const open=p.classList.toggle('open');if(btn)btn.textContent=open?'إخفاء المؤشرات':'عرض المؤشرات'};

renderSubjects=function(){
 const area=$('subjectsArea');if(state.subjectDetail){renderSubjectDetail();return}
 const cards=Object.entries(SUBJECTS).map(([k,s])=>{const ps=state.profiles.filter(p=>p.subject_key===k),tests=state.assessments.filter(a=>ps.some(p=>p.id===a.subject_profile_id)&&!isNafesAssessment(a)),tasks=state.assignments.filter(a=>(a.subject_key||'arabic')===k);return `<button class="subject-card" style="--subject-soft:${s.soft};--subject-color:${s.color}" onclick="openSubject('${k}')"><span class="subject-icon">${s.icon}</span><h3>${s.name}</h3><p>${k==='english'?'تأسيس وتدريب واختبارات مرتبطة بالمنهج.':'دروس وتدريب واختبارات منهجية مرتبطة بالطالب.'}</p><div class="mini"><span>${tests.length} اختبار</span><span>${tasks.length} واجب/مشروع</span><span>بدون نافس</span></div></button>`}).join('');
 area.innerHTML=`<div class="subject-grid">${cards}</div><div class="soft-card" style="margin-top:14px"><b>تنظيم المنصة:</b> المواد للدروس والمنهج، ونافس في قسم مستقل حتى لا تختلط الاختبارات والنتائج.</div>`;
};

function renderNafes(){
 const area=$('nafesArea');if(!area)return;
 if(!frameworkLoaded){area.innerHTML='<div class="card"><div class="empty"><b>جارٍ تحميل إطار نافس الرسمي...</b></div></div>';Promise.all([loadNafesFramework(),loadQuality()]).then(()=>{if(state.section==='nafes')renderNafes()}).catch(e=>{area.innerHTML=`<div class="card"><div class="empty"><b>تعذر تحميل نافس.</b>${esc(e.message||'')}</div></div>`});return}
 if(!qualityLoaded){loadQuality().then(()=>{if(state.section==='nafes')renderNafes()})}
 const meta=META[nafesSubject];
 const body=nafesView==='framework'?frameworkView():nafesView==='training'?trainingView():nafesView==='tests'?testsView():nafesView==='results'?resultsView():overviewView();
 area.innerHTML=`<section class="nafes-hero"><span class="kicker">نافس · الصف الثالث المتوسط</span><h3>قياس منظم يبدأ من المؤشر الرسمي</h3><p>القراءة والرياضيات والعلوم مرتبة في مسار واحد: مصدر رسمي → مؤشر → تدريب معتمد → اختبار → تحليل → علاج.</p></section><div class="nafes-subjects">${subjectCards()}</div>${localNav()}<div class="nafes-current-head"><div><span>المادة الحالية</span><h3>${meta.title}</h3></div><small>${rowsFor(nafesSubject).length} ناتج تعلم · ${countIndicators(nafesSubject)} مؤشر</small></div>${body}`;
}
window.renderNafes=renderNafes;
})();