(()=>{
'use strict';

const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1';
const AUTH=`${API}/lugati-auth`;
const KEY='lugati_exact_session_v2';

const S={token:null,profile:null,tab:'home'};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const icon=(n,c='w-4 h-4')=>`<i data-lucide="${n}" class="${c}"></i>`;

function icons(){try{window.lucide?.createIcons()}catch{}}
function session(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
async function post(body){
 const r=await fetch(AUTH,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${S.token}`},body:JSON.stringify(body),cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw new Error(d.error||`تعذر الاتصال (${r.status})`);
 return d;
}
function nav(){return[
 ['home','الرئيسية','home'],
 ['tasks','مهامي','list-checks'],
 ['competition','المسابقة','trophy'],
 ['progress','تقدمي','chart-no-axes-column-increasing']
]}
function shell(){
 const a=document.getElementById('app');
 a.innerHTML=`<div dir="rtl" class="min-h-screen bg-[#f5f7fb] text-slate-800">
 <div class="min-h-screen lg:grid lg:grid-cols-[235px_1fr]">
   <aside class="hidden lg:flex flex-col bg-white border-l border-slate-200 sticky top-0 h-screen">
     <div class="p-6 border-b">
       <div class="flex items-center gap-3">
         <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-black text-xl">ل</div>
         <div><div class="font-black">منصة لغتي</div><div class="text-[11px] text-slate-400">مساحة الطالب</div></div>
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
 if(d)d.innerHTML=items.map(([id,l,ic])=>`<button data-tab="${id}" class="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-right ${S.tab===id?'bg-emerald-50 text-emerald-800 font-black':'text-slate-500 font-bold hover:bg-slate-50'}">${icon(ic)}<span class="text-xs">${l}</span></button>`).join('');
 if(m)m.innerHTML=items.map(([id,l,ic])=>`<button data-tab="${id}" class="flex flex-col items-center gap-1 py-1.5 ${S.tab===id?'text-emerald-700':'text-slate-400'}">${icon(ic,'w-5 h-5')}<span class="text-[9px] font-bold">${l}</span></button>`).join('');
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;renderNav();renderView()});
}
function wireShell(){
 document.getElementById('logout').onclick=async()=>{try{await post({action:'logout'})}catch{}localStorage.removeItem(KEY);location.replace('./lugati-complete.html')};
}
function home(){
 return `<div class="space-y-5 pb-24 lg:pb-8">
   <section class="rounded-[2rem] bg-gradient-to-l from-emerald-800 via-teal-800 to-sky-900 text-white p-6 sm:p-8 shadow-xl">
     <div class="text-[10px] font-black text-emerald-100">مسارك واضح وبسيط</div>
     <h1 class="text-2xl sm:text-3xl font-black mt-2">مرحبًا ${esc((S.profile?.full_name||'').split(' ')[0]||'بك')} 👋</h1>
     <p class="text-sm text-emerald-100 mt-2 leading-7">ابدأ من المهمة الحالية، ثم راقب تقدمك. لا تحتاج للتنقل بين أقسام كثيرة.</p>
   </section>
   <section id="studentPrimaryMission">
     <div class="mb-3"><h2 class="font-black">مهمتك الآن</h2><p class="text-[11px] text-slate-400 mt-1">المهمة التي تحتاج منك العمل عليها الآن</p></div>
     <div class="bg-white border rounded-3xl p-8 text-center">
       <div class="text-4xl">✅</div>
       <div class="font-black mt-3">لا توجد مهمة مرسلة لك الآن</div>
       <div class="text-xs text-slate-400 mt-1">عندما يرسل المعلم مؤشرًا جديدًا سيظهر هنا مباشرة.</div>
     </div>
   </section>
   <section class="grid sm:grid-cols-2 gap-3">
     <button data-tab="tasks" class="bg-white border rounded-3xl p-5 text-right hover:bg-emerald-50 hover:border-emerald-100 transition">
       <div class="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">${icon('list-checks','w-5 h-5')}</div>
       <div class="font-black mt-3">مهامي</div><div class="text-[11px] text-slate-400 mt-1">كل ما أرسله المعلم لك في مكان واحد</div>
     </button>
     <button data-tab="progress" class="bg-white border rounded-3xl p-5 text-right hover:bg-sky-50 hover:border-sky-100 transition">
       <div class="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">${icon('chart-no-axes-column-increasing','w-5 h-5')}</div>
       <div class="font-black mt-3">تقدمي</div><div class="text-[11px] text-slate-400 mt-1">أرى المؤشرات التي أصبحت جاهزًا لها</div>
     </button>
   </section>
 </div>`;
}
function tasks(){
 return `<div class="space-y-5 pb-24">
   <section class="rounded-[2rem] bg-gradient-to-l from-slate-900 via-emerald-900 to-teal-800 text-white p-6">
     <div class="text-[10px] font-black text-emerald-200">مكان واحد فقط للمهام</div>
     <h1 class="text-2xl font-black mt-2">مهامي</h1>
     <p class="text-xs text-emerald-100 mt-2">ما يرسله المعلم لك سيظهر هنا، مرتبًا وواضحًا.</p>
   </section>
   <section id="readingJourneyTaskMount">
     <div class="bg-white border rounded-3xl p-8 text-center text-sm text-slate-400">جارٍ تحميل مهامك…</div>
   </section>
 </div>`;
}
function progress(){
 return `<div class="space-y-5 pb-24">
   <section class="rounded-[2rem] bg-gradient-to-l from-indigo-950 to-cyan-950 text-white p-6">
     <div class="text-[10px] font-black text-cyan-200">بدون جداول معقدة</div>
     <h1 class="text-2xl font-black mt-2">تقدمي</h1>
     <p class="text-xs text-cyan-100 mt-2">أرى ما أنجزته وما بقي أمامي بصورة مختصرة.</p>
   </section>
   <section id="readingJourneyProgressMount">
     <div class="bg-white border rounded-3xl p-8 text-center text-sm text-slate-400">جارٍ تحميل تقدمك…</div>
   </section>
 </div>`;
}
function competition(){
 return '<div id="lugatiCompetitionMount"><div class="bg-white border rounded-3xl p-10 text-center text-sm text-slate-400">جارٍ تحميل مسابقة المؤشرات…</div></div>';
}
function renderView(){
 const v=document.getElementById('sview');if(!v)return;
 v.innerHTML=S.tab==='home'?home():S.tab==='tasks'?tasks():S.tab==='competition'?competition():progress();
 renderNav();
 if(S.tab==='competition'&&window.LugatiCompetition?.mount)window.LugatiCompetition.mount({token:S.token,role:'student',profile:S.profile});
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;renderView()});
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
   if(/جلسة|تسجيل الدخول/.test(msg)){localStorage.removeItem(KEY);location.replace('./lugati-complete.html?student=1&session=expired');return}
   document.getElementById('app').innerHTML=`<div class="min-h-screen flex items-center justify-center p-5"><div class="bg-white border rounded-3xl p-7 text-center max-w-md"><div class="text-rose-600 font-black">تعذر تحميل مساحة الطالب</div><div class="text-xs text-slate-500 mt-2">${esc(msg)}</div><button onclick="location.reload()" class="mt-5 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-black">إعادة المحاولة</button></div></div>`;
 }
}
init();
})();