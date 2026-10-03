(()=>{
'use strict';

const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1';
const AUTH=`${API}/lugati-auth`;
const PLAN=`${API}/lugati-adaptive-plan`;
const KEY='lugati_exact_session_v2';

const S={token:null,profile:null,tab:'journeys',teacherTasks:[],taskLoading:false,activeTask:null,taskAnswers:{}};
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
         <div class="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-black">جاهز للتعلم</div>
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
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;renderNav();renderView()});
}
function wireShell(){
 document.getElementById('logout').onclick=async()=>{try{await post({action:'logout'})}catch{}sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);location.replace('./lugati-complete.html')};
}
function home(){
 return `<div class="space-y-4 pb-24 lg:pb-8">
   <section class="rounded-[2rem] bg-gradient-to-l from-emerald-900 via-teal-800 to-emerald-700 text-white p-5 sm:p-6 shadow-lg">
     <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
       <div>
         <div class="text-[10px] font-black text-emerald-100">مسارك اليوم</div>
         <h1 class="text-2xl sm:text-3xl font-black mt-1">مرحبًا ${esc((S.profile?.full_name||'').split(' ')[0]||'بك')} 👋</h1>
         <p class="text-xs sm:text-sm text-emerald-100 mt-2 leading-6">${esc(window.TamakkunEncouragement?.welcome?.(S.profile?.full_name)||'ابدأ بما عليك الآن، ثم انتقل إلى بقية أقسام تَمَكُّن.')}</p>
       </div>
       <button data-open-journey="1" class="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black shrink-0">خريطة مهاراتي</button>
     </div>
   </section>

   <section>
     <div class="flex items-center justify-between gap-3 mb-2">
       <div><div class="text-[10px] font-black text-emerald-700">ابدأ من هنا</div><h2 class="font-black text-slate-900">مهمتك التالية</h2></div>
     </div>
     <div id="studentPrimaryMission">
       <div class="bg-white border rounded-3xl p-7 text-center">
         <div class="text-3xl">⏳</div>
         <div class="font-black mt-3">جارٍ تجهيز مهارتك الحالية…</div>
         <div class="text-xs text-slate-400 mt-1">ستظهر المهمة التي تحتاجها الآن فقط.</div>
       </div>
     </div>
   </section>

   <details class="bg-white border border-emerald-100 rounded-3xl p-4 sm:p-5">
     <summary class="cursor-pointer flex items-center justify-between gap-3 font-black text-sm text-slate-800">
       <span>كيف أتعلم في تَمَكُّن؟</span><span class="text-emerald-700 text-xs">عرض الخطوات ▾</span>
     </summary>
     <p class="text-xs text-slate-500 mt-3 leading-6">أفهم المطلوب أولًا، ثم أتعرف صياغة السؤال وأبحث عن الدليل، وبعدها أحل وحدي وأثبت الإتقان.</p>
     <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
       <div class="text-center"><div class="w-8 h-8 mx-auto rounded-xl bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">١</div><div class="text-[9px] font-bold text-slate-600 mt-1">أفهم المطلوب</div></div>
       <div class="text-center"><div class="w-8 h-8 mx-auto rounded-xl bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">٢</div><div class="text-[9px] font-bold text-slate-600 mt-1">أتعرف الصياغة</div></div>
       <div class="text-center"><div class="w-8 h-8 mx-auto rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-black">٣</div><div class="text-[9px] font-bold text-slate-600 mt-1">أبحث عن الدليل</div></div>
       <div class="text-center"><div class="w-8 h-8 mx-auto rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">٤</div><div class="text-[9px] font-bold text-slate-600 mt-1">أحل وحدي</div></div>
       <div class="text-center"><div class="w-8 h-8 mx-auto rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-[10px] font-black">٥</div><div class="text-[9px] font-bold text-slate-600 mt-1">أثبت الإتقان</div></div>
     </div>
   </details>

   <section class="grid sm:grid-cols-2 gap-3">
     <button data-tab="tasks" class="bg-white border rounded-3xl p-5 text-right hover:bg-emerald-50 hover:border-emerald-100 transition">
       <div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">${icon('list-checks','w-5 h-5')}</div>
       <div class="font-black mt-3">مهامي</div><div id="studentTasksSummary" class="text-[11px] text-slate-400 mt-1">جارٍ حساب مهامك…</div>
     </button>
     <button data-tab="progress" class="bg-white border rounded-3xl p-5 text-right hover:bg-emerald-50 hover:border-emerald-100 transition">
       <div class="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center">${icon('chart-no-axes-column-increasing','w-5 h-5')}</div>
       <div class="font-black mt-3">تقدمي</div><div id="studentProgressSummary" class="text-[11px] text-slate-400 mt-1">جارٍ حساب تقدمك…</div>
     </button>
   </section>
 </div>`;
}
function journeys(){
 return `<div class="space-y-5 pb-24">
   <section class="rounded-[2rem] bg-gradient-to-l from-sky-950 via-sky-800 to-cyan-700 text-white p-5 sm:p-7 shadow-lg">
     <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
       <div><div class="text-[10px] font-black text-sky-200">القسم الأول • الرحلات</div><h1 class="text-2xl sm:text-3xl font-black mt-1">رحلات المهارات</h1><p class="text-xs sm:text-sm text-sky-100 mt-2 leading-6">هنا فقط رحلات المؤشرات وخريطة الإتقان. لا تظهر فيه أوراق العلاج أو التعزيز أو المسابقات.</p></div>
       <button data-open-journey="1" class="px-4 py-3 rounded-2xl bg-white text-sky-900 text-xs font-black shrink-0 shadow-sm">فتح خريطة المهارات ←</button>
     </div>
   </section>
   <section>
     <div class="mb-3"><div class="text-[10px] font-black text-sky-700">المهارة الحالية</div><h2 class="font-black text-slate-900">رحلتي التالية</h2></div>
     <div id="studentPrimaryMission"><div class="bg-white border border-sky-100 rounded-3xl p-8 text-center"><div class="text-3xl">🧭</div><div class="font-black mt-3">جارٍ تجهيز رحلتك…</div><div class="text-xs text-slate-400 mt-1">ستظهر هنا المهارة المرسلة من المعلم فقط.</div></div></div>
   </section>
   <section class="bg-white border border-sky-100 rounded-3xl p-5 sm:p-6">
     <div class="flex items-center justify-between gap-3 mb-4"><div><div class="text-[10px] font-black text-sky-700">الرحلات حسب المادة</div><h2 class="font-black text-slate-900">المهارات المرسلة</h2></div><span class="text-2xl">🗺️</span></div>
     <div id="readingJourneyTaskMount"><div class="rounded-2xl bg-sky-50 p-7 text-center text-sm text-sky-700">جارٍ تحميل الرحلات…</div></div>
   </section>
   <section>
     <div class="mb-3"><div class="text-[10px] font-black text-sky-700">تقدم الرحلات</div><h2 class="font-black text-slate-900">ماذا أنجزت؟</h2></div>
     <div id="studentProgressOverview"><div class="bg-white border rounded-3xl p-7 text-center text-sm text-slate-400">جارٍ تجهيز تقدم الرحلات…</div></div>
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
 try{const d=await planPost('my_teacher_tasks');S.teacherTasks=d.tasks||[]}catch(e){S.teacherTasks=[]}finally{S.taskLoading=false;renderTeacherTasks()}
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
 try{const d=await planPost('start_teacher_task',{task_id:id});S.activeTask={...d.task,questions:d.questions||[]};S.taskAnswers={};renderTeacherTaskModal()}catch(e){alert(e.message)}
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
  const pct=Number(d.percent||0),src=t.source_percent==null?null:Number(t.source_percent),improved=src!=null&&pct>src;
  const type=improved?'improvement':pct>=90?'mastery':pct>=70?'remedial_complete':'near_mastery';
  const ctx=improved?{from:Math.round(src),to:Math.round(pct)}:{};
  const encouragement=window.TamakkunEncouragement?.card?.(type,ctx)||'';
  const modal=document.getElementById('teacherTaskModal');
  if(modal)modal.innerHTML='<div class="max-w-lg mx-auto mt-20 bg-white rounded-[2rem] p-8 text-center"><div class="text-5xl">'+(pct>=70?'✅':'📘')+'</div><h2 class="text-2xl font-black mt-4">تم تسليم المسار</h2><div class="text-3xl font-black text-rose-700 mt-4">'+Number(d.score).toLocaleString('ar-SA')+' / '+Number(d.total).toLocaleString('ar-SA')+'</div><p class="text-sm text-slate-500 mt-2">النسبة '+pct.toLocaleString('ar-SA')+'%</p><div class="mt-5 text-right">'+encouragement+'</div><button id="doneTeacherTask" class="mt-6 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black">العودة إلى القسم</button></div>';
  document.getElementById('doneTeacherTask').onclick=async()=>{closeTeacherTask();await loadTeacherTasks()}
 }catch(e){alert(e.message);renderTeacherTaskModal()}
}

function progress(){
 return `<div class="space-y-5 pb-24">
   <section class="rounded-[2rem] bg-gradient-to-l from-emerald-900 via-teal-800 to-emerald-700 text-white p-5 sm:p-6">
     <div class="text-[10px] font-black text-emerald-200">تقدم واضح من المهارات التي تدربت عليها</div>
     <h1 class="text-2xl font-black mt-1">تقدمي</h1>
     <p class="text-xs text-emerald-100 mt-2">نعرض ما أرسله المعلم وما أنجزته فعلًا، دون أرقام كبيرة لا تعبّر عن مسارك الحالي.</p>
   </section>
   <section id="studentProgressOverview">
     <div class="bg-white border rounded-3xl p-7 text-center text-sm text-slate-400">جارٍ تجهيز ملخص تقدمك…</div>
   </section>
   <section id="readingJourneyProgressMount">
     <div class="bg-white border rounded-3xl p-8 text-center text-sm text-slate-400">جارٍ تحميل تقدمك…</div>
   </section>
 </div>`;
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
 if(S.tab==='remedial'||S.tab==='growth')loadTeacherTasks();
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;renderView()});
 document.querySelectorAll('[data-open-journey]').forEach(b=>b.onclick=()=>{if(window.LugatiJourney?.openCurrent)window.LugatiJourney.openCurrent();else if(window.LugatiJourney?.openMap)window.LugatiJourney.openMap('reading');else alert('تعذر فتح رحلة المؤشر الآن. حدّث الصفحة وحاول مرة أخرى.');});
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
 }catch(e){
   const msg=String(e?.message||'');
   if(/جلسة|تسجيل الدخول/.test(msg)){sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);location.replace('./lugati-complete.html?student=1&session=expired');return}
   document.getElementById('app').innerHTML=`<div class="min-h-screen flex items-center justify-center p-5"><div class="bg-white border rounded-3xl p-7 text-center max-w-md"><div class="text-rose-600 font-black">تعذر تحميل مساحة الطالب</div><div class="text-xs text-slate-500 mt-2">${esc(msg)}</div><button onclick="location.reload()" class="mt-5 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-black">إعادة المحاولة</button></div></div>`;
 }
}
init();
})();