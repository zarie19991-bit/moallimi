(()=>{
'use strict';

const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1';
const AUTH=`${API}/lugati-auth`;
const PLAN=`${API}/lugati-adaptive-plan`;
const KEY='lugati_exact_session_v2';
const UX_STARTED_AT=performance.now();

const S={token:null,profile:null,tab:'journeys',teacherTasks:[],taskLoading:false,activeTask:null,taskAnswers:{},pulseReady:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const icon=(n,c='w-4 h-4')=>`<i data-lucide="${n}" class="${c}"></i>`;

function icons(){try{window.lucide?.createIcons()}catch{}}
function session(){try{return JSON.parse(sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||'null')}catch{return null}}
async function post(body){
 const r=await fetch(AUTH,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${S.token}`},body:JSON.stringify(body),cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw new Error(d.error||`تعذر الاتصال (${r.status})`);
 return d;
}
async function planPost(action,extra={}){
 const r=await fetch(PLAN,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${S.token}`},body:JSON.stringify({action,...extra}),cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw new Error(d.error||`تعذر الاتصال (${r.status})`);
 return d;
}
function trackUx(event_name,area=''){
 if(!S.token)return;
 planPost('ux_event',{event_name,area,variant:'ux_v3',elapsed_ms:Math.round(performance.now()-UX_STARTED_AT)}).catch(()=>{});
}
function goStudentTab(id){
 if(!['journeys','remedial','growth','competition'].includes(String(id)))return;
 const changed=S.tab!==id;S.tab=id;
 if(changed)trackUx('student_section_open',id);
 renderView();
}
function nav(){return[
 ['journeys','الرحلات','map','sky'],
 ['remedial','العلاج','heart-pulse','rose'],
 ['growth','تعزيز وإثراء','sparkles','amber'],
 ['competition','المسابقات','trophy','violet']
]}
function navTone(id,active){
 const tones={
  journeys:active?'bg-sky-50 text-sky-800 ring-1 ring-sky-100':'text-slate-500 hover:bg-sky-50/60 hover:text-sky-800',
  remedial:active?'bg-rose-50 text-rose-800 ring-1 ring-rose-100':'text-slate-500 hover:bg-rose-50/60 hover:text-rose-800',
  growth:active?'bg-amber-50 text-amber-900 ring-1 ring-amber-100':'text-slate-500 hover:bg-amber-50/60 hover:text-amber-900',
  competition:active?'bg-violet-50 text-violet-800 ring-1 ring-violet-100':'text-slate-500 hover:bg-violet-50/60 hover:text-violet-800'
 };
 return tones[id]||'text-slate-500';
}

function shell(){
 const a=document.getElementById('app');
 a.innerHTML=`<div dir="rtl" class="min-h-screen bg-[#f5f7fb] text-slate-800">
 <div class="min-h-screen lg:grid lg:grid-cols-[235px_1fr]">
   <aside class="hidden lg:flex flex-col bg-white border-l border-slate-200 sticky top-0 h-screen">
     <div class="p-6 border-b">
       <div class="flex items-center gap-3">
         <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-xl">ل</div>
         <div><div class="font-black">مِنَصَّةُ تَمَكُّن</div><div class="text-[11px] text-slate-400">مساحة الطالب</div></div>
       </div>
     </div>
     <nav id="snav" class="p-3 flex-1 space-y-1"></nav>
     <div class="p-4 border-t">
       <div class="rounded-2xl bg-slate-50 border p-3">
         <div class="text-xs font-black text-slate-900">${esc(S.profile?.full_name||'الطالب')}</div>
         <div class="text-[10px] text-slate-500 mt-1">الفصل ${esc(S.profile?.class_name||'—')}</div>
       </div>
       <button id="logout" class="mt-3 w-full py-2 text-xs font-bold text-slate-500">تسجيل الخروج</button>
     </div>
   </aside>
   <main class="min-w-0">
     <header class="bg-white border-b border-slate-200 sticky top-0 z-30">
       <div class="h-16 px-4 sm:px-6 flex items-center justify-between">
         <div><div class="text-[10px] text-slate-400 font-bold">منصة الطالب</div><div class="text-sm font-black">${esc(S.profile?.full_name||'الطالب')}</div></div>
         <div id="studentHeaderStatus" class="px-3 py-1.5 rounded-full bg-sky-50 border border-sky-100 text-sky-800 text-[11px] font-black">جارٍ تجهيز مسارك…</div>
       </div>
     </header>
     <section id="sview" class="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto"></section>
   </main>
 </div>
 <nav id="mnav" class="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t z-40 grid grid-cols-4 p-1"></nav>
 </div>`;
 renderNav();renderView();wireShell();icons();
}
function renderNav(){
 const d=document.getElementById('snav'),m=document.getElementById('mnav'),items=nav();
 if(d)d.innerHTML=items.map(([id,l,ic])=>`<button data-tab="${id}" aria-current="${S.tab===id?'page':'false'}" class="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-right transition ${navTone(id,S.tab===id)}">${icon(ic)}<span class="text-xs">${l}</span></button>`).join('');
 if(m)m.innerHTML=items.map(([id,l,ic])=>`<button data-tab="${id}" aria-current="${S.tab===id?'page':'false'}" class="flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl transition ${navTone(id,S.tab===id)}">${icon(ic,'w-5 h-5')}<span class="text-[8px] sm:text-[9px] font-black leading-tight text-center">${l}</span></button>`).join('');
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>goStudentTab(b.dataset.tab));
}
function wireShell(){
 document.getElementById('logout').onclick=async()=>{try{await post({action:'logout'})}catch{}sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);location.replace('./lugati-complete.html')};
}
function studentTaskStats(){
 const rows=Array.isArray(S.teacherTasks)?S.teacherTasks:[];
 const completed=rows.filter(t=>t.status==='completed');
 const active=rows.filter(t=>t.status!=='completed');
 const inProgress=rows.filter(t=>t.status==='in_progress');
 const assigned=rows.filter(t=>t.status==='assigned');
 const byTier={
  remedial:rows.filter(t=>t.tier==='remedial'),
  reinforcement:rows.filter(t=>t.tier==='reinforcement'),
  enrichment:rows.filter(t=>t.tier==='enrichment')
 };
 const completedBySubject={reading:0,math:0,science:0};
 for(const t of completed)if(completedBySubject[t.subject_key]!=null)completedBySubject[t.subject_key]++;
 const allBySubject={reading:0,math:0,science:0};
 for(const t of rows)if(allBySubject[t.subject_key]!=null)allBySubject[t.subject_key]++;
 const scores=completed.map(t=>Number(t.percent)).filter(Number.isFinite);
 const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null;
 return{rows,completed,active,inProgress,assigned,byTier,completedBySubject,allBySubject,avg};
}
function localDateKey(v){
 if(!v)return'';
 const d=new Date(v);if(Number.isNaN(d.getTime()))return'';
 const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
 return y+'-'+m+'-'+day;
}
function completionStreak(rows){
 const days=[...new Set((rows||[]).filter(t=>t.status==='completed').map(t=>localDateKey(t.completed_at)).filter(Boolean))].sort().reverse();
 if(!days.length)return 0;
 const dayMs=86400000,now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const latest=new Date(days[0]+'T00:00:00');
 const gap=Math.round((today-latest)/dayMs);if(gap>1)return 0;
 let streak=1,prev=latest;
 for(let i=1;i<days.length;i++){
  const d=new Date(days[i]+'T00:00:00');
  if(Math.round((prev-d)/dayMs)===1){streak++;prev=d}else break;
 }
 return streak;
}
function studentBadges(stats){
 const completed=stats.completed||[],tiers=new Set(completed.map(t=>t.tier)),badges=[];
 if(completed.length>=1)badges.push({icon:'🌱',title:'بداية قوية',desc:'أنجزت أول مهمة فعلية'});
 if(completed.length>=3)badges.push({icon:'🔥',title:'مثابر',desc:'أنجزت 3 مهام أو أكثر'});
 if(completed.some(t=>Number(t.percent)>=90))badges.push({icon:'🎯',title:'متقن',desc:'حققت 90٪ أو أكثر'});
 if(tiers.size>=2)badges.push({icon:'🧭',title:'متنوع',desc:'أنجزت أكثر من نوع تدريب'});
 return badges.slice(-3);
}
function recommendedStudentAction(stats){
 const row=stats.inProgress[0]||stats.assigned.find(t=>t.tier==='remedial')||stats.assigned.find(t=>t.tier==='reinforcement')||stats.assigned.find(t=>t.tier==='enrichment')||null;
 if(!row)return{tab:'journeys',title:'ابدأ رحلة مهارة',text:'لا توجد مهمة مباشرة معلقة الآن؛ انتقل إلى رحلة المؤشر التالية.',cta:'فتح الرحلة',icon:'🧭'};
 const tab=row.tier==='remedial'?'remedial':'growth';
 const kind=row.tier==='remedial'?'علاج':row.tier==='reinforcement'?'تعزيز':'إثراء';
 return{tab,title:(row.status==='in_progress'?'أكمل ':'ابدأ ')+kind,text:row.title||row.indicator_text||'مهمة أرسلها المعلم لك.',cta:row.status==='in_progress'?'متابعة الآن':'ابدأ الآن',icon:row.tier==='remedial'?'🩺':row.tier==='reinforcement'?'💪':'✨'};
}
function renderStudentPulse(){
 const stats=studentTaskStats(),streak=completionStreak(stats.rows),badges=studentBadges(stats),next=recommendedStudentAction(stats);
 const header=document.getElementById('studentHeaderStatus');
 if(header){
  if(stats.inProgress.length)header.textContent='لديك '+Number(stats.inProgress.length).toLocaleString('ar-SA')+' مهمة قيد التنفيذ';
  else if(stats.active.length)header.textContent='لديك '+Number(stats.active.length).toLocaleString('ar-SA')+' مهمة جاهزة';
  else header.textContent='مسارك اليوم جاهز';
 }
 const pulse=document.getElementById('studentTodayPulse');
 if(pulse)pulse.innerHTML=
  '<div class="txv3-stat"><span>أنجزت</span><b>'+Number(stats.completed.length).toLocaleString('ar-SA')+'</b><small>مهمة فعلية</small></div>'+
  '<div class="txv3-stat"><span>بانتظارك</span><b>'+Number(stats.active.length).toLocaleString('ar-SA')+'</b><small>مهمة نشطة</small></div>'+
  '<div class="txv3-stat"><span>متوسطك</span><b>'+(stats.avg==null?'—':Number(stats.avg).toLocaleString('ar-SA')+'٪')+'</b><small>في المهام المكتملة</small></div>'+
  '<div class="txv3-stat"><span>الاستمرارية</span><b>'+Number(streak).toLocaleString('ar-SA')+'</b><small>يومًا متتاليًا</small></div>';
 const nextBox=document.getElementById('studentNextAction');
 if(nextBox)nextBox.innerHTML='<div class="txv3-next-icon">'+next.icon+'</div><div class="txv3-next-copy"><span>الخطوة التالية</span><h2>'+esc(next.title)+'</h2><p>'+esc(next.text)+'</p></div><button type="button" data-next-tab="'+next.tab+'">'+esc(next.cta)+' ←</button>';
 const badgeBox=document.getElementById('studentBadges');
 if(badgeBox)badgeBox.innerHTML=badges.length?badges.map(x=>'<div class="txv3-badge"><span>'+x.icon+'</span><div><b>'+esc(x.title)+'</b><small>'+esc(x.desc)+'</small></div></div>').join(''):'<div class="txv3-badge empty"><span>🏁</span><div><b>أول شارة بانتظارك</b><small>أنجز مهمة واحدة لتظهر شارتك الأولى.</small></div></div>';
 const subjectBox=document.getElementById('studentSubjectPulse');
 if(subjectBox){
  const defs=[['reading','القراءة','📖'],['math','الرياضيات','➗'],['science','العلوم','🔬']];
  subjectBox.innerHTML=defs.map(([k,l,ic])=>{
    const total=stats.allBySubject[k]||0,done=stats.completedBySubject[k]||0,rate=total?Math.round(done*100/total):0;
    return '<article class="txv3-subject-card"><div class="txv3-subject-head"><span>'+ic+'</span><div><b>'+l+'</b><small>'+Number(done).toLocaleString('ar-SA')+' من '+Number(total).toLocaleString('ar-SA')+' مهام</small></div></div><div class="txv3-subject-progress"><i style="width:'+rate+'%"></i></div><strong>'+rate.toLocaleString('ar-SA')+'٪</strong></article>';
  }).join('');
 }
 document.querySelectorAll('[data-next-tab]').forEach(b=>b.onclick=()=>goStudentTab(b.dataset.nextTab));
 S.pulseReady=true;
}
function showStudentOnboarding(){
 const key='tamakkun_student_onboarding_v3';
 try{if(localStorage.getItem(key)==='1')return}catch{}
 if(document.getElementById('studentOnboarding'))return;
 const steps=[
  {icon:'🧭',title:'ابدأ من الخطوة التالية',text:'تعرض لك تمكّن أولًا ما يحتاج انتباهك الآن بدل أن تبحث بين الأقسام.'},
  {icon:'🗂️',title:'أربعة أقسام بلا تداخل',text:'الرحلات، العلاج، التعزيز والإثراء، والمسابقات؛ كل نشاط له مكان واحد واضح.'},
  {icon:'🏅',title:'تحفيز مبني على إنجاز حقيقي',text:'الشارات والاستمرارية تعتمد على المهام التي أنجزتها فعلًا، وليست نقاطًا عشوائية.'}
 ];
 let i=0;
 const o=document.createElement('section');o.id='studentOnboarding';o.className='txv3-onboard';o.dir='rtl';
 const paint=()=>{const x=steps[i];o.innerHTML='<div class="txv3-onboard-card" role="dialog" aria-modal="true" aria-labelledby="txv3OnboardTitle"><div class="txv3-onboard-top"><span>تعرف على تمكّن في أقل من دقيقة</span><button type="button" data-ob-skip aria-label="تخطي الإرشاد">تخطي</button></div><div class="txv3-onboard-icon">'+x.icon+'</div><h2 id="txv3OnboardTitle">'+x.title+'</h2><p>'+x.text+'</p><div class="txv3-onboard-dots">'+steps.map((_,n)=>'<i class="'+(n===i?'active':'')+'"></i>').join('')+'</div><button type="button" class="txv3-onboard-next" data-ob-next>'+(i===steps.length-1?'ابدأ مساري':'التالي')+'</button></div>';o.querySelector('[data-ob-skip]').onclick=finish;o.querySelector('[data-ob-next]').onclick=()=>{if(i<steps.length-1){i++;paint()}else finish()}};
 const finish=()=>{try{localStorage.setItem(key,'1')}catch{}trackUx('student_onboarding_complete','onboarding');o.remove()};
 document.body.appendChild(o);paint();
}
function journeys(){
 const first=esc((S.profile?.full_name||'').split(' ')[0]||'بك');
 return `<div class="txv3-page pb-24 lg:pb-8">
   <section class="txv3-hero">
     <div class="txv3-hero-copy"><span class="txv3-eyebrow">مسارك اليوم</span><h1>مرحبًا ${first} 👋</h1><p>لا تحتاج أن تبحث: راقب تقدمك، نفّذ الخطوة التالية، ثم انتقل لبقية الأقسام عند الحاجة.</p></div>
     <button type="button" data-open-journey="1" class="txv3-map-btn">خريطة مهاراتي</button>
   </section>

   <section id="studentTodayPulse" class="txv3-stats" aria-label="ملخص تقدم الطالب">
     <div class="txv3-stat skeleton"></div><div class="txv3-stat skeleton"></div><div class="txv3-stat skeleton"></div><div class="txv3-stat skeleton"></div>
   </section>

   <section id="studentNextAction" class="txv3-next">
     <div class="txv3-next-icon">⏳</div><div class="txv3-next-copy"><span>الخطوة التالية</span><h2>جارٍ تحديد أولويتك…</h2><p>يتم استخدام مهامك الفعلية لاختيار أقرب خطوة مناسبة.</p></div>
   </section>

   <section class="txv3-grid-two">
     <article class="txv3-panel">
       <div class="txv3-panel-head"><div><span class="txv3-eyebrow">رحلة المهارة</span><h2>رحلتي التالية</h2></div><span class="txv3-panel-icon">🧭</span></div>
       <div id="studentPrimaryMission"><div class="txv3-empty">جارٍ تجهيز المهارة المرسلة من المعلم…</div></div>
     </article>
     <article class="txv3-panel">
       <div class="txv3-panel-head"><div><span class="txv3-eyebrow">إنجازاتي</span><h2>شاراتي</h2></div><span class="txv3-panel-icon">🏅</span></div>
       <div id="studentBadges" class="txv3-badges"><div class="txv3-empty">جارٍ قراءة إنجازاتك…</div></div>
     </article>
   </section>

   <section class="txv3-panel">
     <div class="txv3-panel-head"><div><span class="txv3-eyebrow">حسب المادة</span><h2>تقدم المهام</h2></div><span class="txv3-panel-icon">📚</span></div>
     <div id="studentSubjectPulse" class="txv3-subject-grid"><div class="txv3-empty">جارٍ تجهيز ملخص المواد…</div></div>
   </section>

   <section class="txv3-panel">
     <div class="txv3-panel-head"><div><span class="txv3-eyebrow">الرحلات حسب المادة</span><h2>المهارات المرسلة</h2></div><span class="txv3-panel-icon">🗺️</span></div>
     <div id="readingJourneyTaskMount"><div class="txv3-empty">جارٍ تحميل الرحلات…</div></div>
   </section>

   <section class="txv3-panel">
     <div class="txv3-panel-head"><div><span class="txv3-eyebrow">تقدم الرحلات</span><h2>ماذا أنجزت؟</h2></div><span class="txv3-panel-icon">📈</span></div>
     <div id="studentProgressOverview"><div class="txv3-empty">جارٍ تجهيز تقدم الرحلات…</div></div>
   </section>
 </div>`;
}

function remedial(){
 return `<div class="space-y-5 pb-24">
   <section class="rounded-[2rem] bg-gradient-to-l from-rose-950 via-rose-800 to-red-700 text-white p-5 sm:p-7 shadow-lg">
     <div class="text-[10px] font-black text-rose-200">القسم الثاني • العلاج</div><h1 class="text-2xl sm:text-3xl font-black mt-1">العلاج</h1>
     <p class="text-xs sm:text-sm text-rose-100 mt-2 leading-6">هذا القسم مخصص فقط للمهارات التي تحتاج معالجة ودعمًا إضافيًا بناءً على نتيجتك.</p>
   </section>
   <section class="bg-rose-50/50 border border-rose-100 rounded-3xl p-4 sm:p-5">
     <div class="flex items-start gap-3"><div class="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">🩺</div><div><h2 class="font-black text-rose-950">مهامي العلاجية</h2><p class="text-xs text-rose-700 mt-1 leading-6">لن يظهر هنا أي تدريب تعزيز أو إثراء؛ فقط الأنشطة العلاجية المرسلة لك.</p></div></div>
   </section>
   <div id="teacherRemedialTaskMount"><div class="bg-white border border-rose-100 rounded-3xl p-8 text-center text-sm text-slate-400">جارٍ تحميل مهام العلاج…</div></div>
 </div>`;
}
function growth(){
 return `<div class="space-y-5 pb-24">
   <section class="rounded-[2rem] bg-gradient-to-l from-amber-900 via-orange-700 to-violet-800 text-white p-5 sm:p-7 shadow-lg">
     <div class="text-[10px] font-black text-amber-100">القسم الثالث • تعزيز وإثراء</div><h1 class="text-2xl sm:text-3xl font-black mt-1">التعزيز والإثراء</h1>
     <p class="text-xs sm:text-sm text-amber-50 mt-2 leading-6">التعزيز يثبت ما تعلمته، والإثراء ينقلك إلى تطبيقات وتفكير أعلى. لا توجد مهام علاجية في هذا القسم.</p>
   </section>
   <div id="teacherGrowthTaskMount"><div class="bg-white border border-amber-100 rounded-3xl p-8 text-center text-sm text-slate-400">جارٍ تحميل مهام التعزيز والإثراء…</div></div>
 </div>`;
}

function taskSubject(s){return s==='reading'?'القراءة':s==='math'?'الرياضيات':s==='science'?'العلوم':'—'}
function taskStatus(s){return s==='completed'?'مكتمل ✓':s==='in_progress'?'قيد الحل':'جديد'}
function taskTierMeta(tier){
 if(tier==='enrichment')return{label:'إثرائي',icon:'✨',border:'border-emerald-200',soft:'bg-emerald-50',iconBox:'bg-emerald-100 text-emerald-700',button:'bg-emerald-700',head:'from-emerald-900 to-teal-800',headText:'text-emerald-200',selected:'bg-emerald-50 border-emerald-400 text-emerald-800'};
 if(tier==='reinforcement')return{label:'تعزيز',icon:'💪',border:'border-amber-200',soft:'bg-amber-50',iconBox:'bg-amber-100 text-amber-700',button:'bg-amber-600',head:'from-amber-800 to-emerald-900',headText:'text-amber-100',selected:'bg-amber-50 border-amber-400 text-amber-800'};
 return{label:'علاجي',icon:'🩺',border:'border-rose-200',soft:'bg-rose-50',iconBox:'bg-rose-100 text-rose-700',button:'bg-rose-700',head:'from-rose-900 to-emerald-950',headText:'text-rose-200',selected:'bg-rose-50 border-rose-400 text-rose-800'};
}
async function loadTeacherTasks(){
 if(S.taskLoading)return;S.taskLoading=true;
 try{const d=await planPost('my_teacher_tasks');S.teacherTasks=d.tasks||[]}catch(e){S.teacherTasks=[]}finally{S.taskLoading=false;renderTeacherTasks();renderStudentPulse()}
}
function teacherTaskCard(t,priority=false){
 const m=taskTierMeta(t.tier);
 return '<article class="bg-white border '+m.border+' rounded-3xl '+(priority?'p-5 sm:p-6 shadow-sm':'p-4')+'"><div class="flex flex-col sm:flex-row sm:items-center gap-4">'+
   '<div class="w-11 h-11 rounded-2xl '+m.iconBox+' flex items-center justify-center text-xl shrink-0">'+m.icon+'</div>'+
   '<div class="flex-1 min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="text-[10px] font-black px-2 py-1 rounded-full '+m.soft+'">'+m.label+'</span><span class="text-[10px] text-slate-400 font-bold">'+taskSubject(t.subject_key)+' • المهارة '+Number(t.indicator_index||0).toLocaleString('ar-SA')+'</span></div>'+
   '<h3 class="'+(priority?'text-base':'text-sm')+' font-black text-slate-900 mt-2">'+esc(t.title||('مسار '+m.label))+'</h3>'+
   '<details class="mt-1"><summary class="cursor-pointer text-[11px] font-bold text-slate-500">عرض نص المهارة الرسمي</summary><p class="text-xs text-slate-500 leading-6 mt-2">'+esc(t.indicator_text||'')+'</p></details>'+
   '<div class="flex flex-wrap gap-2 mt-2"><span class="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black">'+taskStatus(t.status)+'</span>'+
   (t.source_percent!=null?'<span class="px-2 py-1 rounded-full bg-slate-50 text-slate-600 text-[10px] font-black">نتيجة المؤشر '+Number(t.source_percent).toLocaleString('ar-SA')+'%</span>':'')+
   (t.status==='completed'?'<span class="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black">نتيجة التدريب '+Number(t.percent||0).toLocaleString('ar-SA')+'%</span>':'')+'</div></div>'+
   (t.status==='completed'?'<div class="text-emerald-700 font-black text-xs">تم الإنجاز ✓</div>':'<button data-open-teacher-task="'+t.id+'" class="px-4 py-3 rounded-2xl '+m.button+' text-white text-xs font-black shrink-0">'+(t.status==='in_progress'?'أكمل المهمة':'ابدأ المهمة')+'</button>')+
 '</div></article>';
}
function taskBucketHtml(rows,emptyIcon,emptyTitle,emptyText){
 const active=rows.filter(t=>t.status!=='completed').sort((a,b)=>(a.status==='in_progress'?0:1)-(b.status==='in_progress'?0:1));
 const done=rows.filter(t=>t.status==='completed');
 if(!rows.length)return '<div class="bg-white border rounded-3xl p-8 text-center"><div class="text-3xl">'+emptyIcon+'</div><div class="font-black mt-2">'+emptyTitle+'</div><div class="text-xs text-slate-400 mt-1">'+emptyText+'</div></div>';
 let html='';
 if(active.length){
   html+='<div class="space-y-3">'+active.map((t,i)=>teacherTaskCard(t,i===0)).join('')+'</div>';
 }else html+='<div class="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center"><div class="text-3xl">✅</div><div class="font-black text-emerald-800 mt-2">أنجزت المهام النشطة</div></div>';
 if(done.length)html+='<details class="mt-3 bg-white border rounded-3xl p-4"><summary class="cursor-pointer font-black text-sm text-slate-600">الأعمال المكتملة ('+Number(done.length).toLocaleString('ar-SA')+') ▾</summary><div class="space-y-3 mt-3">'+done.map(t=>teacherTaskCard(t,false)).join('')+'</div></details>';
 return html;
}
function bindTeacherTaskButtons(root){if(!root)return;root.querySelectorAll('[data-open-teacher-task]').forEach(b=>b.onclick=()=>openTeacherTask(b.dataset.openTeacherTask))}
function renderTeacherTasks(){
 const rows=(S.teacherTasks||[]).slice();
 const remedialBox=document.getElementById('teacherRemedialTaskMount');
 if(remedialBox){
   const remedialRows=rows.filter(t=>t.tier==='remedial');
   remedialBox.innerHTML=taskBucketHtml(remedialRows,'🩺','لا توجد مهام علاجية الآن','إذا احتاج أحد مؤشراتك معالجة فستظهر مهمته هنا فقط.');
   bindTeacherTaskButtons(remedialBox);
 }
 const growthBox=document.getElementById('teacherGrowthTaskMount');
 if(growthBox){
   const reinforcement=rows.filter(t=>t.tier==='reinforcement');
   const enrichment=rows.filter(t=>t.tier==='enrichment');
   growthBox.innerHTML=
    '<section class="rounded-3xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5"><div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl">💪</div><div><h2 class="font-black text-amber-950">التعزيز</h2><p class="text-xs text-amber-700 mt-1">لتثبيت المهارة وزيادة الدقة والاستقلالية.</p></div></div>'+taskBucketHtml(reinforcement,'💪','لا توجد مهام تعزيز الآن','تظهر هنا مهام التعزيز فقط عندما تُرسل لك.')+'</section>'+
    '<section class="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5 mt-4"><div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl">✨</div><div><h2 class="font-black text-emerald-950">الإثراء</h2><p class="text-xs text-emerald-700 mt-1">لتطبيق المهارة في مواقف جديدة وأسئلة أعلى تفكيرًا.</p></div></div>'+taskBucketHtml(enrichment,'✨','لا توجد مهام إثراء الآن','تظهر هنا مهام الإثراء فقط عندما تحقق مستوى الإتقان المطلوب.')+'</section>';
   bindTeacherTaskButtons(growthBox);
 }
}
async function openTeacherTask(id){
 try{const d=await planPost('start_teacher_task',{task_id:id});S.activeTask={...d.task,questions:d.questions||[]};S.taskAnswers={};trackUx('student_task_start',String(d.task?.tier||'task'));renderTeacherTaskModal()}catch(e){alert(e.message)}
}
function closeTeacherTask(){document.getElementById('teacherTaskModal')?.remove();S.activeTask=null;S.taskAnswers={}}
function renderTeacherTaskModal(){
 let modal=document.getElementById('teacherTaskModal');if(!modal){modal=document.createElement('div');modal.id='teacherTaskModal';modal.className='fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto';document.body.appendChild(modal)}
 const t=S.activeTask,qs=t?.questions||[];if(!t)return;const m=taskTierMeta(t.tier);
 modal.innerHTML='<div class="max-w-4xl mx-auto bg-[#f7f9fc] rounded-[2rem] overflow-hidden shadow-2xl" dir="rtl"><header class="bg-gradient-to-l '+m.head+' text-white p-6"><div class="flex items-start justify-between gap-3"><div><div class="text-[10px] '+m.headText+' font-black">مسار '+m.label+' مرسل من المعلم • '+taskSubject(t.subject_key)+'</div><h1 class="text-xl font-black mt-2">'+esc(t.title||('مسار '+m.label))+'</h1><details class="mt-2"><summary class="cursor-pointer text-xs text-white/80 font-bold">عرض نص المهارة الرسمي</summary><p class="text-xs text-white/80 mt-2 leading-6">'+esc(t.indicator_text||'')+'</p></details></div><button id="closeTeacherTask" class="w-10 h-10 rounded-xl bg-white/10 text-xl">×</button></div></header><div class="p-4 sm:p-6"><div class="space-y-4">'+qs.map((q,qi)=>'<div class="bg-white border rounded-3xl p-5"><div class="flex items-center justify-between"><span class="text-[10px] font-black text-emerald-700">السؤال '+(qi+1)+' من '+qs.length+'</span><span class="text-[10px] text-slate-400">'+(q.cognitive_level==='knowledge'?'معرفة':q.cognitive_level==='application'?'تطبيق':'استدلال')+'</span></div>'+(q.context_text?'<div class="mt-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-sm leading-8">'+esc(q.context_text)+'</div>':'')+'<h3 class="text-sm font-black leading-7 mt-3">'+esc(q.question_text)+'</h3><div class="grid sm:grid-cols-2 gap-2 mt-3">'+(q.options||[]).map((o,i)=>'<button data-task-q="'+q.id+'" data-task-opt="'+i+'" class="p-3 rounded-2xl border text-right text-xs font-bold '+(Number(S.taskAnswers[q.id])===i?m.selected:'bg-slate-50 border-slate-200')+'"><span class="inline-flex w-7 h-7 rounded-xl bg-white border items-center justify-center ml-2">'+['أ','ب','ج','د'][i]+'</span>'+esc(o)+'</button>').join('')+'</div></div>').join('')+'</div><button id="submitTeacherTask" '+(Object.keys(S.taskAnswers).length<qs.length?'disabled':'')+' class="mt-5 w-full py-3.5 rounded-2xl '+m.button+' text-white font-black text-sm disabled:opacity-40">تسليم المسار '+m.label+'</button></div></div>';
 document.getElementById('closeTeacherTask').onclick=closeTeacherTask;
 modal.querySelectorAll('[data-task-q]').forEach(b=>b.onclick=()=>{S.taskAnswers[b.dataset.taskQ]=Number(b.dataset.taskOpt);renderTeacherTaskModal()});
 const submit=document.getElementById('submitTeacherTask');if(submit)submit.onclick=submitTeacherTask;
}
async function submitTeacherTask(){
 const t=S.activeTask;if(!t)return;const btn=document.getElementById('submitTeacherTask');if(btn){btn.disabled=true;btn.textContent='جارٍ التصحيح…'}
 try{
  const d=await planPost('submit_teacher_task',{task_id:t.id,answers:S.taskAnswers});
  trackUx('student_task_complete',String(t.tier||'task'));
  const pct=Number(d.percent||0),src=t.source_percent==null?null:Number(t.source_percent),improved=src!=null&&pct>src;
  const type=improved?'improvement':pct>=90?'mastery':pct>=70?'remedial_complete':'near_mastery';
  const ctx=improved?{from:Math.round(src),to:Math.round(pct)}:{};
  const encouragement=window.TamakkunEncouragement?.card?.(type,ctx)||'';
  const modal=document.getElementById('teacherTaskModal');
  if(modal)modal.innerHTML='<div class="max-w-lg mx-auto mt-20 bg-white rounded-[2rem] p-8 text-center"><div class="text-5xl">'+(pct>=70?'✅':'📘')+'</div><h2 class="text-2xl font-black mt-4">تم تسليم المسار</h2><div class="text-3xl font-black text-rose-700 mt-4">'+Number(d.score).toLocaleString('ar-SA')+' / '+Number(d.total).toLocaleString('ar-SA')+'</div><p class="text-sm text-slate-500 mt-2">النسبة '+pct.toLocaleString('ar-SA')+'%</p><div class="mt-5 text-right">'+encouragement+'</div><button id="doneTeacherTask" class="mt-6 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black">العودة إلى القسم</button></div>';
  document.getElementById('doneTeacherTask').onclick=async()=>{closeTeacherTask();await loadTeacherTasks()}
 }catch(e){alert(e.message);renderTeacherTaskModal()}
}

function competition(){
 return '<div class="space-y-5 pb-24"><section class="rounded-[2rem] bg-gradient-to-l from-violet-950 via-indigo-900 to-purple-700 text-white p-5 sm:p-7 shadow-lg"><div class="text-[10px] font-black text-violet-200">القسم الرابع • المسابقات</div><h1 class="text-2xl sm:text-3xl font-black mt-1">المسابقات</h1><p class="text-xs sm:text-sm text-violet-100 mt-2 leading-6">الجولات التنافسية والنتائج والترتيب فقط. لا تظهر هنا الرحلات أو مهام العلاج والتعزيز.</p></section><div id="lugatiCompetitionMount"><div class="bg-white border border-violet-100 rounded-3xl p-10 text-center text-sm text-slate-400">جارٍ تحميل المسابقات…</div></div></div>';
}
function renderView(){
 const v=document.getElementById('sview');if(!v)return;
 const views={journeys,remedial,growth,competition};
 const view=views[S.tab]||journeys;
 v.innerHTML=view();
 renderNav();
 if(S.tab==='competition'&&window.LugatiCompetition?.mount)window.LugatiCompetition.mount({token:S.token,role:'student',profile:S.profile});
 if(S.tab==='journeys')renderStudentPulse();
 if(S.tab==='remedial'||S.tab==='growth')loadTeacherTasks();
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>goStudentTab(b.dataset.tab));
 document.querySelectorAll('[data-open-journey]').forEach(b=>b.onclick=()=>{trackUx('student_journey_open','journeys');if(window.LugatiJourney?.openCurrent)window.LugatiJourney.openCurrent();else if(window.LugatiJourney?.openMap)window.LugatiJourney.openMap('reading');else alert('تعذر فتح رحلة المؤشر الآن. حدّث الصفحة وحاول مرة أخرى.');});
 icons();
 window.dispatchEvent(new CustomEvent('lugati:student-view-rendered',{detail:{tab:S.tab}}));
}
async function init(){
 const s=session();
 if(!s||s.role!=='student'){location.replace('./lugati-complete.html');return}
 S.token=s.token;S.profile=s.profile||{};
 try{
   const v=await post({action:'verify'});
   if(v.role!=='student')throw new Error('هذه الصفحة للطلاب فقط.');
   S.profile=v.profile||S.profile;
   shell();
   trackUx('student_workspace_view','journeys');
   trackUx('student_section_open','journeys');
   loadTeacherTasks();
   setTimeout(showStudentOnboarding,260);
 }catch(e){
   const msg=String(e?.message||'');
   if(/جلسة|تسجيل الدخول/.test(msg)){sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);location.replace('./lugati-complete.html?student=1&session=expired');return}
   document.getElementById('app').innerHTML=`<div class="min-h-screen flex items-center justify-center p-5"><div class="bg-white border rounded-3xl p-7 text-center max-w-md"><div class="text-rose-600 font-black">تعذر تحميل مساحة الطالب</div><div class="text-xs text-slate-500 mt-2">${esc(msg)}</div><button onclick="location.reload()" class="mt-5 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-black">إعادة المحاولة</button></div></div>`;
 }
}
init();
})();