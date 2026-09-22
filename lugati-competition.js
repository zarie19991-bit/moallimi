(()=>{
'use strict';
const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-competition';
const ARENA_ORDER=['reading_1','reading_2','reading_3','math','science'];
const teacherScope=()=>['reading','math','science'].includes(S.profile?.subject_scope)?S.profile.subject_scope:'all';
const visibleArenaOrder=()=>S.role!=='teacher'||teacherScope()==='all'?ARENA_ORDER:ARENA_ORDER.filter(k=>(k.startsWith('reading_')?'reading':k)===teacherScope());
const scopeName=()=>teacherScope()==='reading'?'القراءة':teacherScope()==='math'?'الرياضيات':teacherScope()==='science'?'العلوم':'جميع المواد';
const FALLBACK={
 reading_1:{label:'القراءة 1',icon:'📘'},reading_2:{label:'القراءة 2',icon:'📗'},reading_3:{label:'القراءة 3',icon:'📙'},
 math:{label:'الرياضيات',icon:'➗'},science:{label:'العلوم',icon:'🔬'}
};
const S={token:null,role:null,profile:null,data:null,arena:'reading_1',catalog:null,selected:new Map(),busy:false,screen:'home',studentTab:'rounds',round:null,attempt:null,result:null,teacherResult:null,preview:null,message:'',timer:null,streak:0,stageIntroSeen:null,powerupBusy:false};
S.draft={title:'',open:'',close:''};
S.feedback=null;
const questionCount=()=>Number((S.screen==='student-result'?S.result?.round?.question_count:S.screen==='teacher-results'?S.teacherResult?.round?.question_count:S.round?.question_count)||15);
function captureDraft(){for(const [key,id] of [['title','compTitle'],['open','compOpen'],['close','compClose']]){const el=document.getElementById(id);if(el)S.draft[key]=el.value}}
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n=v=>Number(v||0);
const ar=v=>n(v).toLocaleString('ar-SA');
const fmtMs=ms=>{ms=Math.max(0,n(ms));const m=Math.floor(ms/60000),s=Math.floor((ms%60000)/1000),t=Math.floor((ms%1000)/100);return m.toLocaleString('ar-SA')+':'+String(s).padStart(2,'0')+'.'+t};
const fmtDate=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return'—'}};
const localInput=v=>{const d=v?new Date(v):new Date();const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,16)};
function style(){if(document.getElementById('lugatiCompetitionStyle'))return;const x=document.createElement('style');x.id='lugatiCompetitionStyle';x.textContent=`
#lugatiCompetitionMount{--arena-navy:#0b1220;--arena-panel:#111b2e;--arena-orange:#f97316;--arena-gold:#f59e0b;--arena-green:#10b981;--arena-sky:#0ea5e9;--arena-rose:#f43f5e;--arena-violet:#7c3aed}
.comp-stage{background:radial-gradient(circle at 10% 10%,rgba(14,165,233,.12),transparent 28%),radial-gradient(circle at 90% 15%,rgba(249,115,22,.14),transparent 30%),linear-gradient(180deg,#0b1220 0%,#101827 100%);border:1px solid rgba(148,163,184,.12);border-radius:32px;padding:18px;box-shadow:0 28px 80px rgba(15,23,42,.20)}
.comp-hero{position:relative;overflow:hidden;background:linear-gradient(135deg,#111b2e 0%,#172554 55%,#0f172a 100%);border:1px solid rgba(255,255,255,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 24px 65px rgba(2,6,23,.28)}
.comp-hero:before{content:"";position:absolute;width:280px;height:280px;border-radius:50%;background:rgba(249,115,22,.10);filter:blur(18px);left:-90px;top:-130px}
.comp-stat{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(8px)}
.comp-arena-card{position:relative;overflow:hidden;background:#fff;border:1px solid #e2e8f0;box-shadow:0 12px 34px rgba(15,23,42,.07);transition:.22s ease}
.comp-arena-card:hover{transform:translateY(-3px);box-shadow:0 20px 45px rgba(15,23,42,.12)}
.comp-arena-card:before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:var(--accent,#4f46e5)}
.comp-arena-card.open{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent,#4f46e5) 12%,transparent),0 18px 44px rgba(15,23,42,.10)}
.comp-arena-card .arena-icon{background:color-mix(in srgb,var(--accent,#4f46e5) 12%,white);color:var(--accent,#4f46e5)}
.comp-cta{background:linear-gradient(135deg,#fb923c,#f97316);color:#fff;box-shadow:0 12px 28px rgba(249,115,22,.28);transition:.2s ease}
.comp-cta:hover{transform:translateY(-1px);box-shadow:0 16px 34px rgba(249,115,22,.36)}
.comp-secondary{background:#fff;border:1px solid #dbe3ef;color:#334155}
.comp-question-shell{background:radial-gradient(circle at 15% 0%,rgba(14,165,233,.10),transparent 26%),linear-gradient(180deg,#0b1220,#111827);border-radius:30px;padding:16px}
.comp-question-card{background:#f8fafc;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 70px rgba(2,6,23,.32)}
.comp-option{position:relative;background:#fff;border:1.5px solid #dbe3ef;box-shadow:0 5px 16px rgba(15,23,42,.04);transition:.16s ease}
.comp-option:hover:not(:disabled){border-color:#0ea5e9;background:#f0f9ff;transform:translateY(-1px);box-shadow:0 10px 22px rgba(14,165,233,.10)}
.comp-option:active:not(:disabled){transform:scale(.992)}
.comp-option.tried{opacity:.34;pointer-events:none;filter:grayscale(.25)}
.comp-letter{background:#0f172a;color:#fff;border:0;box-shadow:0 4px 10px rgba(15,23,42,.16)}
.comp-heart{font-size:22px;filter:drop-shadow(0 2px 3px rgba(244,63,94,.24))}
.comp-heart.off{filter:grayscale(1);opacity:.18}
.comp-progress{background:linear-gradient(90deg,#0ea5e9,#10b981)}
.comp-timer{font-variant-numeric:tabular-nums;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:8px 12px}
.comp-feedback-good{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46}
.comp-feedback-bad{background:#fff1f2;border:1px solid #fecdd3;color:#9f1239}
.comp-podium{background:linear-gradient(135deg,#111827,#172554 60%,#0f172a);border:1px solid rgba(255,255,255,.09);box-shadow:0 24px 70px rgba(2,6,23,.28)}
.comp-gold{color:#fbbf24}
.comp-pop{animation:compPop .22s ease-out}
.comp-shake{animation:compShake .28s ease}
.comp-glow{box-shadow:0 0 0 4px rgba(14,165,233,.06),0 22px 60px rgba(15,23,42,.10)}
@keyframes compPop{from{transform:scale(.97);opacity:.5}to{transform:scale(1);opacity:1}}
@keyframes compShake{0%,100%{transform:translateX(0)}25%{transform:translateX(7px)}75%{transform:translateX(-7px)}}
.comp-option:focus-visible{outline:3px solid #0ea5e9;outline-offset:3px}.comp-option:disabled{cursor:default}.comp-question-card{font-size:1rem} .comp-question-card h2{line-height:1.9} @media(prefers-reduced-motion:reduce){#lugatiCompetitionMount *{animation:none!important;transition:none!important}}
@media(max-width:640px){.comp-stage{padding:10px;border-radius:24px}.comp-question-shell{padding:10px;border-radius:24px}}
`;document.head.appendChild(x)}
async function post(body){const h={'Content-Type':'application/json'};if(S.token)h.Authorization='Bearer '+S.token;const r=await fetch(API,{method:'POST',headers:h,body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok||d.error){const e=new Error(d.error||'تعذر الاتصال بالمسابقة.');e.data=d;throw e}return d}
function mountEl(){return document.getElementById('lugatiCompetitionMount')}
function arenaMeta(k){return S.data?.arenas?.[k]||FALLBACK[k]||{label:k,icon:'🏆'}}
function statusText(s){return s==='open'?'مفتوحة الآن':s==='scheduled'?'مجدولة':s==='closed'?'مغلقة':'لا توجد جولة'}
function statusClass(s){return s==='open'?'bg-emerald-100 text-emerald-800':s==='scheduled'?'bg-sky-100 text-sky-800':s==='closed'?'bg-slate-100 text-slate-600':'bg-slate-100 text-slate-500'}
function arenaTheme(k){k=String(k||'');if(k==='math')return{accent:'#0369a1',soft:'#f0f9ff',label:'الرياضيات',mood:'دقة • حل • استدلال'};if(k==='science')return{accent:'#0f766e',soft:'#f0fdfa',label:'العلوم',mood:'اكتشاف • تحليل • استدلال'};return{accent:'#047857',soft:'#ecfdf5',label:'القراءة',mood:'فهم • استنتاج • تركيز'}}
function roundArena(){return S.round?.arena_key||S.attempt?.round?.arena_key||'reading_1'}
async function load(){S.busy=true;renderLoading();try{S.data=await post({action:S.role==='teacher'?'teacher_dashboard':'student_home'});S.screen='home';S.message='';if(S.role==='teacher'){const keys=visibleArenaOrder();if(!keys.includes(S.arena))S.arena=keys[0]||'reading_1';await loadCatalog()}render()}catch(e){renderError(e.message)}finally{S.busy=false}}
async function loadCatalog(){const d=await post({action:'indicator_catalog',arena_key:S.arena});S.catalog=d.indicators||[]}
function renderLoading(){const el=mountEl();if(el)el.innerHTML='<div class="bg-white border border-slate-200 rounded-3xl p-12 text-center text-sm text-slate-500">جارٍ تجهيز المسابقة…</div>'}
function renderError(m){const el=mountEl();if(el)el.innerHTML='<div class="bg-rose-50 border border-rose-200 text-rose-800 rounded-3xl p-6 text-sm font-bold">'+esc(m)+'</div>'}
function render(){clearInterval(S.timer);S.timer=null;const el=mountEl();if(!el)return;if(S.role==='teacher')renderTeacher(el);else renderStudent(el);try{window.lucide?.createIcons()}catch{}}
function topHero(role){const season=S.data?.season;return '<section class="comp-hero text-white rounded-[2rem] p-6 sm:p-8">'+
 '<div class="relative flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between"><div><span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-sm font-black text-amber-300">🏆 بطولة المؤشرات • '+esc(season?.title||'الموسم الحالي')+'</span>'+
 '<h1 class="text-3xl sm:text-4xl font-black mt-4 tracking-tight">'+(role==='teacher'?'مركز إدارة البطولة':'جاهز للمنافسة؟')+'</h1><p class="text-sm sm:text-sm text-slate-300 mt-2 max-w-2xl leading-7">'+(role==='teacher'?(teacherScope()==='all'?'اختر المؤشرات القادمة للاختبار، أطلق الجولة، ثم تابع الدقة والترتيب من لوحة واحدة.':'إدارة بطولة '+scopeName()+' فقط حسب صلاحية حسابك.'):'الدقة أولًا، ثم الأخطاء الأقل، ثم الزمن. كل جولة تقرّبك من صدارة الموسم.')+'</p></div>'+
 '<div class="grid grid-cols-3 gap-2 min-w-[280px]"><div class="comp-stat rounded-2xl p-3 text-center"><b class="text-xl block text-amber-300">🏆</b><span class="text-sm text-slate-300">إنجاز</span></div><div class="comp-stat rounded-2xl p-3 text-center"><b class="text-xl block text-emerald-300">✓</b><span class="text-sm text-slate-300">دقة</span></div><div class="comp-stat rounded-2xl p-3 text-center"><b class="text-xl block text-emerald-200">⚡</b><span class="text-sm text-slate-300">حماس</span></div></div>'+
 (role==='teacher'&&teacherScope()==='all'?'<button id="resetSeasonBtn" class="lg:absolute lg:left-6 lg:bottom-6 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 text-sm font-black">↻ موسم جديد</button>':'')+
 '</div></section>'}
function arenaTabs(){const keys=visibleArenaOrder();return '<div class="grid grid-cols-2 sm:grid-cols-'+Math.min(5,Math.max(1,keys.length))+' gap-2">'+keys.map(k=>{const m=arenaMeta(k);return '<button data-comp-arena="'+k+'" class="rounded-2xl border p-3 text-center transition '+(S.arena===k?'bg-slate-950 text-white border-slate-950 shadow-lg':'bg-white text-slate-700 border-slate-200 hover:border-emerald-300')+'"><div class="text-xl">'+m.icon+'</div><b class="text-sm block mt-1">'+esc(m.label)+'</b></button>'}).join('')+'</div>'}
function teacherRounds(){return S.data?.rounds_by_arena?.[S.arena]||[]}
function renderTeacher(el){
 if(S.screen==='teacher-results'){renderTeacherResults(el);return}
 if(S.screen==='preview'){renderPreview(el);return}
 const rounds=teacherRounds(),current=rounds.find(r=>r.effective_status==='open'||r.effective_status==='scheduled')||null,history=rounds.filter(r=>r.effective_status==='closed').slice(0,6);
 el.innerHTML='<div class="space-y-5 pb-12">'+topHero('teacher')+arenaTabs()+
 '<section class="grid lg:grid-cols-[1.1fr_.9fr] gap-5">'+
 '<div class="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">'+(current?teacherCurrent(current):teacherCreate())+'</div>'+
 '<div class="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">'+teacherRules()+'</div></section>'+
 teacherHistory(history)+'</div>';
 wireArenaTabs();document.getElementById('resetSeasonBtn')?.addEventListener('click',resetSeason);
 document.querySelectorAll('[data-history-result]').forEach(b=>b.addEventListener('click',()=>openTeacherResults(b.dataset.historyResult)));
 document.querySelectorAll('[data-history-preview]').forEach(b=>b.addEventListener('click',()=>openPreview(b.dataset.historyPreview)));
 if(current){document.getElementById('closeRoundBtn')?.addEventListener('click',()=>closeRound(current.id));document.getElementById('roundResultsBtn')?.addEventListener('click',()=>openTeacherResults(current.id));document.getElementById('previewRoundBtn')?.addEventListener('click',()=>openPreview(current.id))}
 else wireCreate();
}
function teacherCurrent(r){return '<div class="flex items-start justify-between gap-3"><div><span class="text-sm font-black px-2.5 py-1 rounded-full '+statusClass(r.effective_status)+'">'+statusText(r.effective_status)+'</span><h2 class="text-xl font-black mt-3 text-slate-900">'+esc(r.title)+'</h2><p class="text-sm text-slate-500 mt-1">'+(r.effective_status==='scheduled'?'تبدأ '+fmtDate(r.open_at):'بدأت '+fmtDate(r.open_at))+(r.close_at?' • تغلق '+fmtDate(r.close_at):' • الإغلاق يدوي')+'</p></div><div class="text-center bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3"><b class="text-xl text-emerald-800">'+ar(r.stats?.finished)+'</b><span class="block text-sm text-emerald-700">أنهوا الجولة</span></div></div>'+
 '<div class="grid grid-cols-3 gap-2 mt-5">'+['knowledge','application','reasoning'].map((x,i)=>'<div class="rounded-2xl bg-slate-50 border p-3 text-center"><b class="text-lg">'+ar(Number(r.question_count||15)/3)+'</b><span class="block text-sm text-slate-500">'+['معرفة','تطبيق','استدلال'][i]+'</span></div>').join('')+'</div>'+
 '<div class="mt-5"><div class="text-sm font-black text-slate-700 mb-2">المؤشرات المختارة</div><div class="space-y-2">'+(r.selected_indicators||[]).map((x,i)=>'<div class="p-3 rounded-2xl bg-slate-50 border text-sm"><b class="text-emerald-700">مؤشر '+(i+1)+'</b> <span class="text-slate-700">'+esc(x.indicator_text)+'</span></div>').join('')+'</div></div>'+
 '<div class="grid sm:grid-cols-3 gap-2 mt-5"><button id="roundResultsBtn" class="px-4 py-3 bg-emerald-700 text-white rounded-2xl text-sm font-black">النتائج المباشرة</button><button id="previewRoundBtn" class="px-4 py-3 bg-slate-100 text-slate-800 rounded-2xl text-sm font-black">معاينة الأسئلة</button><button id="closeRoundBtn" class="px-4 py-3 bg-rose-600 text-white rounded-2xl text-sm font-black">إغلاق الجولة الآن</button></div>'+
 '<p class="text-sm text-slate-400 mt-3">بعد الإغلاق تُثبت النتائج ويستطيع الطلاب رؤيتها. لإنشاء مؤشرات جديدة افتح جولة جديدة بعد إغلاق الحالية.</p>'}
function teacherCreate(){
 const cat=S.catalog||[],sel=S.selected,count=sel.size,boss=count?Math.min(3,Math.max(1,count)):0,total=count?count*3+boss:0;
 const selected=[...sel.values()];
 return '<div><span class="text-sm font-black text-emerald-700">إنشاء لعبة مؤشرات</span><h2 class="text-xl font-black text-slate-900 mt-1">'+esc(arenaMeta(S.arena).label)+'</h2>'+
 '<p class="text-sm text-slate-500 mt-1">اختر حتى 12 مؤشرًا. تَمَكُّن ترتبها تلقائيًا إلى مرحلة لكل مؤشر ثم مواجهة نهائية، مع شرح مختصر قبل أسئلة كل مرحلة.</p>'+
 '<div class="grid sm:grid-cols-2 gap-3 mt-5"><label class="text-sm font-bold text-slate-600">اسم اللعبة<input id="compTitle" value="'+esc(S.draft.title)+'" class="mt-2 w-full border rounded-2xl p-3 text-sm" placeholder="مثال: تحدي الإتقان الأول"></label><label class="text-sm font-bold text-slate-600">وقت الفتح<input id="compOpen" type="datetime-local" value="'+esc(S.draft.open)+'" class="mt-2 w-full border rounded-2xl p-3 text-sm"></label><label class="text-sm font-bold text-slate-600 sm:col-span-2">وقت الإغلاق <span class="text-slate-400 font-normal">(اختياري)</span><input id="compClose" type="datetime-local" value="'+esc(S.draft.close)+'" class="mt-2 w-full border rounded-2xl p-3 text-sm"></label></div>'+
 '<div class="mt-4 grid grid-cols-3 gap-2"><div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-3 text-center"><b class="text-lg text-emerald-800">'+ar(count)+'</b><span class="block text-[10px] text-emerald-700">مؤشرات</span></div><div class="rounded-2xl bg-sky-50 border border-sky-100 p-3 text-center"><b class="text-lg text-sky-800">'+ar(count+(boss?1:0))+'</b><span class="block text-[10px] text-sky-700">مراحل</span></div><div class="rounded-2xl bg-amber-50 border border-amber-100 p-3 text-center"><b class="text-lg text-amber-800">'+ar(total)+'</b><span class="block text-[10px] text-amber-700">سؤالًا تقريبًا</span></div></div>'+
 (selected.length?'<div class="mt-3 flex gap-2 overflow-x-auto pb-1">'+selected.map((x,i)=>'<span class="shrink-0 text-[10px] font-black px-3 py-2 rounded-full bg-slate-900 text-white">'+ar(i+1)+' • مؤشر '+ar(x.indicator_index)+'</span>').join('')+'</div>':'')+
 '<div class="flex items-center justify-between mt-5 mb-2"><b class="text-sm text-slate-700">المؤشرات المتاحة</b><span id="selectedCount" class="text-sm font-black '+(count>=1&&count<=12?'text-emerald-700':'text-amber-700')+'">'+count+' / 12 مختارة</span></div>'+
 '<div class="max-h-[420px] overflow-y-auto space-y-2 pr-1">'+cat.map(x=>{const key=x.outcome_code+'|'+x.indicator_index,on=sel.has(key);return '<button data-indicator-key="'+esc(key)+'" class="w-full text-right p-3 rounded-2xl border transition '+(on?'border-emerald-500 bg-emerald-50':'border-slate-200 bg-white hover:border-emerald-300')+'"><div class="flex gap-3 items-start"><span class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 '+(on?'bg-emerald-700 text-white':'bg-slate-100 text-slate-500')+'">'+(on?'✓':x.indicator_index)+'</span><div><b class="text-sm text-slate-800 leading-5">'+esc(x.indicator_text)+'</b><div class="text-[10px] text-slate-400 mt-1">معرفة '+ar(x.knowledge_count)+' • تطبيق '+ar(x.application_count)+' • استدلال '+ar(x.reasoning_count)+'</div></div></div></button>'}).join('')+'</div>'+
 '<button id="createCompRound" '+(count<1||count>12?'disabled':'')+' class="comp-cta mt-5 w-full py-3.5 text-white font-black text-sm disabled:opacity-40">إنشاء اللعبة وإرسالها للطلاب 🎮</button></div>';
}
function teacherRules(){return '<h2 class="font-black text-slate-900">كيف تعمل اللعبة؟</h2><div class="mt-4 space-y-3 text-sm">'+[
['🧭','مرحلة لكل مؤشر','يقرأ الطالب شرحًا قصيرًا، ثم يجيب عن معرفة وتطبيق واستدلال قبل الانتقال.'],
['🔥','سلسلة الإجابات','3 إجابات متتالية ترفع المضاعف إلى ×2، و6 متتالية إلى ×3.'],
['🃏','3 بطاقات مساعدة','استبعاد خيار، تلميح من قاعدة الحل، ومضاعفة نقاط السؤال التالي.'],
['🏁','مواجهة نهائية','بعد المؤشرات تأتي أسئلة مختلطة من المهارات نفسها.'],
['🏆','الترتيب بالدقة أولًا','عدد الصحيح ثم الأخطاء ثم الزمن؛ لا تكافئ اللعبة السرعة على حساب الفهم.'],
['💾','استئناف محفوظ','إذا حدّث الطالب الصفحة يعود إلى السؤال والمرحلة نفسها.']
].map(x=>'<div class="flex gap-3 p-3 rounded-2xl bg-slate-50 border"><span class="text-xl">'+x[0]+'</span><div><b class="text-slate-800">'+x[1]+'</b><p class="text-slate-500 mt-1 leading-5">'+x[2]+'</p></div></div>').join('')+'</div>'}
function teacherHistory(rows){return '<section class="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6"><div class="flex items-center justify-between"><div><h2 class="font-black text-slate-900">الجولات السابقة في '+esc(arenaMeta(S.arena).label)+'</h2><p class="text-sm text-slate-400 mt-1">النتائج محفوظة ولا تتغير بعد الإغلاق.</p></div></div><div class="mt-4 space-y-2">'+(rows.length?rows.map(r=>'<div class="p-4 rounded-2xl bg-slate-50 border flex flex-col sm:flex-row sm:items-center gap-3"><div class="flex-1"><b class="text-sm text-slate-800">'+esc(r.title)+'</b><p class="text-sm text-slate-400 mt-1">'+fmtDate(r.closed_at||r.close_at)+' • شارك '+ar(r.stats?.started)+' طالب</p></div><div class="flex gap-2"><button data-history-result="'+r.id+'" class="px-3 py-2 rounded-xl bg-emerald-700 text-white text-sm font-black">النتائج</button><button data-history-preview="'+r.id+'" class="px-3 py-2 rounded-xl bg-white border text-slate-700 text-sm font-black">الأسئلة</button></div></div>').join(''):'<div class="text-center py-8 text-sm text-slate-400">لا توجد جولات مغلقة في هذا القسم بعد.</div>')+'</div></section>'}
function wireArenaTabs(){document.querySelectorAll('[data-comp-arena]').forEach(b=>b.addEventListener('click',async()=>{S.arena=b.dataset.compArena;S.selected.clear();renderLoading();try{if(S.role==='teacher')await loadCatalog();render()}catch(e){renderError(e.message)}}))}
function wireCreate(){
 ['compTitle','compOpen','compClose'].forEach(id=>document.getElementById(id)?.addEventListener('input',captureDraft));
 document.querySelectorAll('[data-indicator-key]').forEach(b=>b.addEventListener('click',()=>{
   captureDraft();const key=b.dataset.indicatorKey;
   if(S.selected.has(key))S.selected.delete(key);
   else if(S.selected.size<12){const x=(S.catalog||[]).find(z=>z.outcome_code+'|'+z.indicator_index===key);if(x)S.selected.set(key,x)}
   else alert('الحد الأعلى للعبة الواحدة 12 مؤشرًا حتى تبقى التجربة مناسبة للطالب.');
   render();
 }));
 document.getElementById('createCompRound')?.addEventListener('click',createRound);
 document.querySelectorAll('[data-history-result]').forEach(b=>b.addEventListener('click',()=>openTeacherResults(b.dataset.historyResult)));
 document.querySelectorAll('[data-history-preview]').forEach(b=>b.addEventListener('click',()=>openPreview(b.dataset.historyPreview)));
}
async function createRound(){
 if(S.busy||S.selected.size<1)return;captureDraft();S.busy=true;
 const btn=document.getElementById('createCompRound');if(btn){btn.disabled=true;btn.textContent='جارٍ بناء المراحل والأسئلة…'}
 try{
  const open=document.getElementById('compOpen')?.value,close=document.getElementById('compClose')?.value,title=document.getElementById('compTitle')?.value||'';
  await post({action:'create_round',game_mode:'v2',arena_key:S.arena,title,open_at:open?new Date(open).toISOString():null,close_at:close?new Date(close).toISOString():null,
   indicators:[...S.selected.values()].map(x=>({outcome_code:x.outcome_code,indicator_index:x.indicator_index}))});
  S.selected.clear();S.draft={title:'',open:'',close:''};await load();
 }catch(e){alert(e.message);S.busy=false;render()}
}
async function closeRound(id){if(!confirm('إغلاق الجولة الآن؟ ستُثبت النتائج وسيتمكن الطلاب من رؤيتها، ولا يمكنهم تعديل إجاباتهم.'))return;try{await post({action:'close_round',round_id:id});await load()}catch(e){alert(e.message)}}
async function resetSeason(){if(!confirm('سيبدأ موسم جديد من صفر لجميع الطلاب. ستبقى نتائج الموسم السابق محفوظة في الأرشيف. هل تريد المتابعة؟'))return;try{await post({action:'reset_season'});S.selected.clear();await load()}catch(e){alert(e.message)}}
async function openTeacherResults(id){renderLoading();try{S.teacherResult=await post({action:'round_results',round_id:id});S.screen='teacher-results';render()}catch(e){renderError(e.message)}}
function teacherReport(d){
 const rows=d.indicator_report||[];
 return '<section class="bg-white border rounded-3xl p-5 sm:p-6"><h2 class="text-xl font-black">أداء الطلاب حسب المؤشر</h2><p class="text-sm text-slate-500 mt-2">يشمل المحاولات المنتهية. تُحسب الأسئلة غير المجابة ضمن العدد الكلي. أقل من '+ar(d.support_threshold||70)+'٪ يحتاج إلى دعم، وليس حكمًا نهائيًا على الإتقان.</p>'+rows.map(g=>'<details class="border rounded-2xl p-4 mt-4" open><summary class="font-bold cursor-pointer">'+esc(g.indicator_text)+' — '+ar(g.needs_support?.length)+' يحتاجون للدعم</summary><div class="overflow-x-auto mt-3"><table class="w-full text-sm"><thead><tr><th class="p-2 text-right">الطالب</th><th>الفصل</th><th>الصحيح</th><th>غير مجاب</th><th>الأداء</th></tr></thead><tbody>'+g.students.map(x=>'<tr class="border-t"><td class="p-2">'+esc(x.full_name)+'</td><td>'+esc(x.class_name)+'</td><td>'+ar(x.correct)+' / '+ar(x.total)+'</td><td>'+ar(x.unanswered)+'</td><td class="'+(x.percent<(d.support_threshold||70)?'text-rose-700':'text-emerald-700')+'">'+ar(x.percent)+'٪ — '+(x.percent<(d.support_threshold||70)?'يحتاج دعمًا':'أداء جيد')+'</td></tr>').join('')+'</tbody></table></div></details>').join('')+(!rows.length?'<p class="mt-4">لا يوجد تحليل متاح بعد.</p>':'')+'</section>';
}
function questionImage(q){
 const im=q?.image;if(!im||!/^https:\/\/zarie19991-bit\.github\.io\/moallimi\/question-bank\/assets\/[a-f0-9]{64}\.png$/.test(String(im.url||'')))return '';
 return '<figure class="my-4"><a href="'+esc(im.url)+'" target="_blank" rel="noopener"><img data-comp-image src="'+esc(im.url)+'" alt="'+esc(im.alt||'الشكل المرتبط بالسؤال')+'" class="max-w-full h-auto mx-auto rounded-xl"></a><figcaption class="text-sm text-slate-600 mt-2">اضغط على الشكل لتكبيره.</figcaption></figure>';
}

function renderTeacherResults(el){const d=S.teacherResult||{},students=d.students||[],classes=d.classes||[];el.innerHTML='<div class="space-y-5 pb-12">'+topHero('teacher')+'<button id="backCompHome" class="text-sm font-black text-emerald-700">← العودة للمسابقة</button>'+
 '<section class="bg-white border rounded-3xl p-5 sm:p-6"><div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><span class="text-sm font-black text-emerald-700">نتائج الجولة</span><h2 class="text-xl font-black mt-1">'+esc(d.round?.title||'')+'</h2></div><div class="text-sm text-slate-500">الترتيب: الصحيحة ← الأخطاء ← الزمن</div></div>'+
 '<div class="overflow-x-auto mt-5"><table class="w-full text-sm"><thead><tr class="text-slate-400 border-b"><th class="p-3 text-right">المركز</th><th class="p-3 text-right">الطالب</th><th class="p-3">الفصل</th><th class="p-3">الصحيحة</th><th class="p-3">الأخطاء</th><th class="p-3">الزمن</th><th class="p-3">النقاط</th></tr></thead><tbody>'+students.map(x=>'<tr class="border-b last:border-0"><td class="p-3 font-black">'+rankIcon(x.rank_no)+'</td><td class="p-3 font-bold">'+esc(x.full_name)+'</td><td class="p-3 text-center">'+esc(x.class_name)+'</td><td class="p-3 text-center font-black text-emerald-700">'+ar(x.correct_questions)+'/'+ar(questionCount())+'</td><td class="p-3 text-center text-rose-600">'+ar(x.wrong_attempts)+'</td><td class="p-3 text-center">'+fmtMs(x.duration_ms)+'</td><td class="p-3 text-center font-black text-amber-700">'+ar(x.points)+'</td></tr>').join('')+'</tbody></table></div></section>'+
 '<section class="bg-white border rounded-3xl p-5 sm:p-6"><h2 class="font-black">كأس الفصول</h2><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">'+classes.map(x=>'<div class="rounded-2xl bg-slate-50 border p-4"><div class="text-sm text-slate-400">المركز '+ar(x.rank_no)+'</div><b class="text-lg block mt-1">الفصل '+esc(x.class_name)+'</b><div class="text-sm mt-2 text-emerald-700 font-black">متوسط الصحيح '+Number(x.avg_correct||0).toFixed(2)+'/'+ar(questionCount())+'</div><div class="text-sm text-slate-400 mt-1">'+ar(x.participants)+' مشارك</div></div>').join('')+'</div></section>'+teacherReport(d)+'</div>';document.getElementById('backCompHome').onclick=()=>{S.screen='home';render()}}
function rankIcon(r){r=n(r);return r===1?'🥇 1':r===2?'🥈 2':r===3?'🥉 3':ar(r)}
async function openPreview(id){renderLoading();try{S.preview=await post({action:'round_detail',round_id:id});S.screen='preview';render()}catch(e){renderError(e.message)}}
function renderPreview(el){const d=S.preview||{};el.innerHTML='<div class="space-y-5 pb-12"><button id="backCompHome" class="text-sm font-black text-emerald-700">← العودة للمسابقة</button><section class="bg-white border rounded-3xl p-5 sm:p-6"><span class="text-sm font-black text-emerald-700">نسخة الجولة المثبتة</span><h2 class="text-xl font-black mt-1">'+esc(d.round?.title||'')+'</h2><p class="text-sm text-slate-500 mt-1">هذه الأسئلة لا تتغير بعد إرسال الجولة.</p><div class="space-y-3 mt-5">'+(d.questions||[]).map(q=>'<div class="p-4 rounded-2xl border bg-slate-50"><div class="flex gap-2 text-sm mb-2"><span class="px-2 py-1 bg-white border rounded-full">سؤال '+q.position+'</span><span class="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full">'+(q.cognitive_level==='knowledge'?'معرفة':q.cognitive_level==='application'?'تطبيق':'استدلال')+'</span></div>'+questionImage(q)+(q.context_text?'<div class="p-4 mb-3 bg-white border rounded-2xl whitespace-pre-wrap leading-8">'+esc(q.context_text)+'</div>':'')+'<b class="text-sm leading-6">'+esc(q.question_text)+'</b><div class="grid sm:grid-cols-2 gap-2 mt-3">'+(q.options||[]).map((o,i)=>'<div class="p-2.5 rounded-xl border text-sm '+(i===q.correct_index?'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold':'bg-white')+'">'+['أ','ب','ج','د'][i]+') '+esc(o)+'</div>').join('')+'</div></div>').join('')+'</div></section></div>';document.getElementById('backCompHome').onclick=()=>{S.screen='home';render()}}
function studentHistory(){return '<section class="bg-white rounded-3xl p-5"><h2 class="text-lg font-black">جولاتي السابقة</h2><div class="space-y-3 mt-4">'+(S.data?.history||[]).map(r=>'<div class="p-4 border rounded-2xl flex justify-between gap-3"><div><b>'+esc(r.title)+'</b><p class="text-sm text-slate-500">'+fmtDate(r.closed_at||r.close_at)+'</p></div><button data-result-round="'+esc(r.id)+'" class="comp-secondary px-4 py-2 rounded-xl">عرض النتيجة</button></div>').join('')+(!(S.data?.history||[]).length?'<p>لا توجد جولات سابقة شاركت فيها.</p>':'')+'</div></section>'}
function renderStudent(el){
 if(S.screen==='attempt'){renderAttempt(el);return}
 if(S.screen==='student-result'){renderStudentResult(el);return}
 const acc=S.data?.account||{},rounds=S.data?.current_rounds||{},tab=S.studentTab||'rounds';
 const tabs=[['rounds','الجولات','⚡'],['leaderboard','الترتيب','🏆'],['indicators','رصيد المؤشرات','🎯'],['history','جولاتي السابقة','📁']];
 const body=tab==='history'?studentHistory():tab==='leaderboard'?seasonBoard():tab==='indicators'?indicatorAccount():
 '<section class="bg-white/95 rounded-[2rem] p-5 sm:p-6 border border-white/20"><div class="flex items-center justify-between gap-3 mb-4"><div><span class="text-sm uppercase tracking-[.18em] text-orange-600 font-black">اختر ساحتك</span><h2 class="text-xl font-black text-slate-900 mt-1">الألعاب المتاحة</h2><p class="text-sm text-slate-500 mt-1">اختر اللعبة؛ كل مؤشر سيظهر لك كمرحلة مرتبة قبل المواجهة النهائية.</p></div><div class="hidden sm:block text-4xl">🎮</div></div><div class="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">'+ARENA_ORDER.map(k=>studentArenaCard(k,rounds[k])).join('')+'</div></section>';
 el.innerHTML='<div class="comp-stage"><div class="space-y-4">'+topHero('student')+
 '<section class="grid grid-cols-2 lg:grid-cols-4 gap-3"><div class="comp-stat bg-slate-900 text-white rounded-3xl p-4"><span class="text-sm text-slate-400">رصيد الموسم</span><b class="text-2xl comp-gold block mt-1">'+ar(acc.total_points)+' ⭐</b></div><div class="comp-stat bg-slate-900 text-white rounded-3xl p-4"><span class="text-sm text-slate-400">إجابات صحيحة</span><b class="text-2xl text-emerald-300 block mt-1">'+ar(acc.total_correct)+'</b></div><div class="comp-stat bg-slate-900 text-white rounded-3xl p-4"><span class="text-sm text-slate-400">الجولات</span><b class="text-2xl text-sky-300 block mt-1">'+ar(acc.rounds_played)+'</b></div><div class="comp-stat bg-slate-900 text-white rounded-3xl p-4"><span class="text-sm text-slate-400">ترتيب الموسم</span><b class="text-2xl text-violet-300 block mt-1">'+(acc.rank_no?rankIcon(acc.rank_no):'—')+'</b></div></section>'+
 '<nav class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900/90 border border-white/10 p-2 rounded-2xl">'+tabs.map(x=>'<button data-student-comp-tab="'+x[0]+'" class="py-3 px-2 rounded-xl text-sm font-black transition '+(tab===x[0]?'bg-white text-slate-950 shadow-lg':'text-slate-300 hover:bg-white/10')+'"><span class="ml-1">'+x[2]+'</span>'+x[1]+'</button>').join('')+'</nav>'+
 body+'</div></div>';
 document.querySelectorAll('[data-student-comp-tab]').forEach(b=>b.onclick=()=>{S.studentTab=b.dataset.studentCompTab;render()});
 document.querySelectorAll('[data-start-round]').forEach(b=>b.onclick=()=>showIntro(b.dataset.startRound));
 document.querySelectorAll('[data-continue-round]').forEach(b=>b.onclick=()=>beginRound(b.dataset.continueRound));
 document.querySelectorAll('[data-result-round]').forEach(b=>b.onclick=()=>openStudentResult(b.dataset.resultRound));
}
function studentArenaCard(k,r){const m=arenaMeta(k),th=arenaTheme(k),style='--accent:'+th.accent+';';if(!r)return '<div style="'+style+'" class="comp-arena-card rounded-3xl p-5 min-h-[215px]"><div class="arena-icon w-12 h-12 rounded-2xl flex items-center justify-center text-2xl">'+m.icon+'</div><b class="block mt-3 text-slate-900">'+esc(m.label)+'</b><p class="text-sm text-slate-400 mt-1">'+th.mood+'</p><div class="mt-5 p-3 rounded-2xl bg-slate-50 text-sm text-slate-400">لا توجد لعبة مرسلة الآن.</div></div>';
 const a=r.attempt,st=r.effective_status;let action='';
 if(st==='open'&&!a)action='<button data-start-round="'+r.id+'" class="comp-cta mt-4 w-full py-3 rounded-2xl text-sm font-black">ابدأ التحدي ⚡</button>';
 else if(st==='open'&&a?.status==='in_progress')action='<button data-continue-round="'+r.id+'" class="mt-4 w-full py-3 bg-amber-400 text-slate-950 rounded-2xl text-sm font-black shadow-lg shadow-amber-400/20">أكمل من السؤال '+ar(a.current_position)+'</button>';
 else if(st==='open'&&a&&a.status!=='in_progress')action='<div class="mt-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-2xl text-sm font-black text-center">✓ أنهيت اللعبة — بانتظار الإغلاق</div>';
 else if(st==='closed'&&a)action='<button data-result-round="'+r.id+'" class="mt-4 w-full py-3 bg-slate-900 text-white rounded-2xl text-sm font-black">عرض النتيجة والترتيب 🏆</button>';
 else if(st==='closed')action='<div class="mt-4 p-3 bg-slate-100 text-slate-500 rounded-2xl text-sm text-center">انتهت اللعبة ولم تشارك</div>';
 else action='<div class="mt-4 p-3 bg-sky-50 text-sky-800 rounded-2xl text-sm text-center">تبدأ '+fmtDate(r.open_at)+'</div>';
 return '<div style="'+style+'" class="comp-arena-card '+(st==='open'?'open ':'')+'rounded-3xl p-5 min-h-[245px] flex flex-col"><div class="flex items-start justify-between"><div class="arena-icon w-12 h-12 rounded-2xl flex items-center justify-center text-2xl">'+m.icon+'</div><span class="text-sm px-2.5 py-1 rounded-full font-black '+statusClass(st)+'">'+statusText(st)+'</span></div><div class="mt-3"><b class="block text-slate-900">'+esc(m.label)+'</b><span class="text-sm font-black" style="color:'+th.accent+'">'+th.mood+'</span></div><div class="flex flex-wrap gap-1.5 mt-3"><span class="tk-badge tk-badge-success">'+ar(r.game_config?.indicator_count||r.selected_indicators?.length||0)+' مؤشرات</span><span class="tk-badge tk-badge-info">'+ar(r.game_config?.stage_count||0)+' مراحل</span></div><h3 class="text-sm font-black text-slate-700 mt-3 leading-5">'+esc(r.title)+'</h3><p class="text-sm text-slate-400 mt-1">'+(r.close_at?'تغلق '+fmtDate(r.close_at):'الإغلاق يحدده المعلم')+'</p><div class="mt-auto">'+action+'</div></div>'}
function seasonBoard(){const rows=S.data?.top_students||[];return '<section class="bg-white/95 border border-white/20 rounded-[2rem] p-5 sm:p-6"><div class="flex items-center justify-between"><div><span class="text-sm font-black text-amber-600">🏆 سباق الموسم</span><h2 class="font-black text-slate-900 mt-1">لوحة الصدارة</h2><p class="text-sm text-slate-400 mt-1">النقاط التراكمية من الجولات المغلقة فقط.</p></div><div class="text-3xl">👑</div></div><div class="mt-4 space-y-2">'+(rows.length?rows.map((x,i)=>'<div class="flex items-center gap-3 p-3 rounded-2xl '+(i<3?'bg-amber-50/60 border-amber-100':'bg-slate-50 border-slate-100')+' border"><span class="w-10 text-center font-black text-lg">'+rankIcon(x.rank_no)+'</span><div class="flex-1"><b class="text-sm text-slate-900">'+esc(x.full_name)+'</b><span class="block text-sm text-slate-400">فصل '+esc(x.class_name)+' • '+ar(x.rounds_played)+' جولة</span></div><b class="text-sm text-amber-600">'+ar(x.total_points)+' ⭐</b></div>').join(''):'<div class="text-center py-7 text-sm text-slate-400">تظهر لوحة الموسم بعد إغلاق أول جولة.</div>')+'</div></section>'}
function indicatorAccount(){const rows=S.data?.indicator_points||[];return '<section class="bg-white/95 border border-white/20 rounded-[2rem] p-5 sm:p-6"><div><span class="text-sm font-black text-sky-600">🎯 تقدمك الحقيقي</span><h2 class="font-black text-slate-900 mt-1">رصيد المؤشرات</h2><p class="text-sm text-slate-400 mt-1">النقاط تعكس أداءك في البطولة، ولا تُستخدم بدل اختبار إتقان المؤشر.</p></div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">'+(rows.length?rows.slice(0,18).map(x=>'<div class="rounded-2xl bg-slate-50 border border-slate-100 p-4"><b class="text-sm leading-5 block text-slate-800">'+esc(x.indicator_text)+'</b><div class="flex justify-between mt-3 text-sm"><span class="text-emerald-700 font-black">✓ '+ar(x.correct_questions)+' صحيحة</span><span class="text-amber-700 font-black">'+ar(x.points)+' نقطة</span></div></div>').join(''):'<div class="sm:col-span-2 lg:col-span-3 text-center py-7 text-sm text-slate-400">لم تُحتسب نقاط مؤشرات بعد.</div>')+'</div></section>'}
function stageMapHtml(d){
 const total=Number(d?.stage?.total||d?.round?.game_config?.stage_count||S.round?.game_config?.stage_count||1),cur=Number(d?.stage?.no||1);
 const inds=S.round?.selected_indicators||[];
 return '<div class="comp-stage-map">'+Array.from({length:total},(_,i)=>{
   const no=i+1,boss=no>inds.length,label=boss?'🏁':String(no);
   return '<span class="comp-stage-dot '+(no<cur?'done':no===cur?'active':'')+'" title="'+esc(boss?'المواجهة النهائية':(inds[i]?.indicator_text||('المرحلة '+no)))+'">'+(no<cur?'✓':label)+'</span>';
 }).join('')+'</div>';
}
function showIntro(id){
 S.message='';S.feedback=null;S.stageIntroSeen=null;S.round=Object.values(S.data?.current_rounds||{}).find(r=>r?.id===id)||{id};S.screen='intro';
 const el=mountEl();if(!el)return;const cfg=S.round?.game_config||{},inds=S.round?.selected_indicators||[];
 el.innerHTML='<div class="comp-stage"><div class="max-w-3xl mx-auto comp-podium text-white rounded-[2rem] p-6 sm:p-9"><div class="text-center"><div class="inline-flex w-20 h-20 items-center justify-center rounded-[1.7rem] bg-white/10 border border-white/10 text-5xl">🎮</div><span class="block text-sm text-emerald-200 font-black mt-5">لعبة إتقان المؤشرات</span><h2 class="text-3xl font-black mt-2">'+esc(S.round?.title||'تحدي تَمَكُّن')+'</h2><p class="text-sm text-slate-300 mt-3 leading-7">كل مؤشر مرحلة مستقلة: تعرف مفتاحه، ثم تحل 3 أسئلة، وبعدها تدخل المواجهة النهائية.</p></div>'+
 '<div class="grid grid-cols-3 gap-2 mt-6"><div class="comp-stat rounded-2xl p-3 text-center"><b class="text-xl block text-emerald-300">'+ar(cfg.indicator_count||inds.length)+'</b><span class="text-[10px] text-slate-300">مؤشرات</span></div><div class="comp-stat rounded-2xl p-3 text-center"><b class="text-xl block text-sky-300">'+ar(cfg.stage_count||inds.length+1)+'</b><span class="text-[10px] text-slate-300">مراحل</span></div><div class="comp-stat rounded-2xl p-3 text-center"><b class="text-xl block text-amber-300">'+ar(S.round?.question_count||0)+'</b><span class="text-[10px] text-slate-300">أسئلة</span></div></div>'+
 '<div class="mt-5 max-h-52 overflow-y-auto space-y-2">'+inds.map((x,i)=>'<div class="flex gap-3 items-center rounded-2xl bg-white/8 border border-white/10 p-3"><span class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-black">'+ar(i+1)+'</span><div class="text-right"><b class="text-sm">'+esc(x.indicator_text)+'</b><span class="block text-[10px] text-slate-400 mt-1">شرح مختصر ← معرفة ← تطبيق ← استدلال</span></div></div>').join('')+'</div>'+
 '<div class="grid grid-cols-2 gap-2 mt-6"><button id="cancelIntro" class="py-3 rounded-2xl bg-white/10 border border-white/10 text-slate-200 text-sm font-black">ليس الآن</button><button id="goRound" class="comp-cta py-3 text-sm font-black">ابدأ اللعبة ←</button></div></div></div>';
 document.getElementById('cancelIntro').onclick=()=>{S.screen='home';render()};
 document.getElementById('goRound').onclick=()=>beginRound(id);
}
async function beginRound(id){
 S.feedback=null;S.message='';S.streak=0;S.stageIntroSeen=null;renderLoading();
 try{
  const d=await post({action:'start_attempt',round_id:id});
  if(d.already_finished){S.screen='home';await load();return}
  S.round=d.round;S.attempt=d;S.streak=Number(d.attempt?.streak||0);S.screen='attempt';render();
 }catch(e){alert(e.message);S.screen='home';await load()}
}
function shouldShowStageIntro(d){
 const st=d?.stage;if(!st)return false;
 const key=String(S.round?.id||'')+':'+st.no;
 if(S.stageIntroSeen===key)return false;
 return st.type==='boss'||Number(st.question_no||1)===1;
}
function renderStageIntro(el,d){
 const st=d.stage||{},g=d.guide||{},boss=st.type==='boss',key=String(S.round?.id||'')+':'+st.no;
 const cues=(g.recognition_cues||[]).slice(0,3),steps=(g.solution_steps||[]).slice(0,4);
 el.innerHTML='<div class="comp-question-shell max-w-4xl mx-auto"><section class="text-white p-5 sm:p-6">'+stageMapHtml(d)+'<div class="mt-4"><span class="text-sm text-emerald-200 font-black">'+(boss?'المواجهة النهائية':'المرحلة '+ar(st.no)+' من '+ar(st.total))+'</span><h1 class="text-2xl sm:text-3xl font-black mt-2">'+esc(boss?'اختبر قدرتك على التنقل بين المؤشرات':(g.student_title||st.title||'المؤشر الحالي'))+'</h1><p class="text-sm text-slate-300 mt-2 leading-7">'+(boss?'لن يظهر شرح جديد الآن؛ طبّق ما تعلمته في المراحل السابقة.':'قبل اللعب، اعرف مفتاح هذه المهارة وكيف تميّز سؤالها.')+'</p></div></section>'+
 '<section class="comp-question-card p-5 sm:p-7 mt-2">'+
 (boss?'<div class="text-center py-6"><div class="text-6xl">🏁</div><h2 class="text-2xl font-black mt-3">المواجهة النهائية</h2><p class="text-sm text-slate-500 mt-2">أسئلة مختلطة من المؤشرات التي مررت بها. الدقة أهم من السرعة.</p></div>':
 '<div><span class="tk-eyebrow">مفتاح المرحلة</span><h2 class="text-xl font-black text-slate-900 mt-1">'+esc(g.student_title||st.title||'المؤشر الحالي')+'</h2><div class="mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm leading-7 text-emerald-900"><b>🔑 قاعدة الحل:</b> '+esc(g.golden_rule||'حدّد المطلوب ثم استخدم المعطيات قبل اختيار الإجابة.')+'</div>'+
 '<div class="grid sm:grid-cols-2 gap-3 mt-3"><div class="rounded-2xl bg-sky-50 border border-sky-100 p-4"><b class="text-sm text-sky-900">كيف أعرف السؤال؟</b><ul class="mt-2 pr-5 text-xs leading-6 text-slate-600">'+(cues.length?cues.map(x=>'<li>'+esc(x)+'</li>').join(''):'<li>اقرأ صياغة السؤال وحدد المطلوب بدقة.</li>')+'</ul></div><div class="rounded-2xl bg-slate-50 border p-4"><b class="text-sm text-slate-900">خطوات الحل</b><ol class="mt-2 pr-5 text-xs leading-6 text-slate-600">'+(steps.length?steps.map(x=>'<li>'+esc(x)+'</li>').join(''):'<li>حدّد المطلوب ثم طبّق القاعدة.</li>')+'</ol></div></div>'+
 (g.common_trap?'<div class="mt-3 rounded-2xl bg-amber-50 border border-amber-100 p-3 text-xs leading-6 text-amber-900"><b>⚠️ انتبه:</b> '+esc(g.common_trap)+'</div>':'')+'</div>')+
 '<button id="startStageQuestions" class="comp-cta w-full mt-5 py-3 font-black">'+(boss?'ابدأ المواجهة 🏁':'ابدأ أسئلة هذه المرحلة ←')+'</button></section></div>';
 document.getElementById('startStageQuestions').onclick=()=>{S.stageIntroSeen=key;renderAttempt(el)};
}
function powerupButton(type,icon,title,remaining,disabled=false,active=false){
 return '<button data-powerup="'+type+'" '+(disabled?'disabled':'')+' class="comp-powerup '+(active?'active ':'')+(disabled?'disabled ':'')+'"><span>'+icon+'</span><b>'+title+'</b><small>'+ar(remaining)+' متبقية</small></button>';
}
async function usePowerup(type){
 if(S.powerupBusy||S.feedback)return;S.powerupBusy=true;
 try{
  const d=await post({action:'use_powerup',round_id:S.round.id,type});
  const a=S.attempt.attempt||{};a.powerups=d.powerups||a.powerups||{};a.active_powerup=d.active_powerup||a.active_powerup||null;
  const log=S.attempt.question.powerup_log||{};
  if(type==='eliminate')log.eliminate=d.result||[];
  if(type==='hint')log.hint=d.result||'';
  if(type==='double')log.double=true;
  S.attempt.question.powerup_log=log;render();
 }catch(e){alert(e.message)}
 finally{S.powerupBusy=false}
}
function renderAttempt(el){
 const d=S.attempt,q=d?.question;if(d?.finished||!q){renderFinishWait(el);return}
 if(shouldShowStageIntro(d)){renderStageIntro(el,d);return}
 const th=arenaTheme(roundArena()),progress=Math.max(0,Math.min(100,(q.position-1)/questionCount()*100)),a=d.attempt||{},st=d.stage||{},log=q.powerup_log||{},pu=a.powerups||{};
 const hidden=new Set(Array.isArray(log.eliminate)?log.eliminate.map(Number):[]);
 const streak=Number(a.streak||0),mult=streak>=6?3:streak>=3?2:1;
 el.innerHTML='<div class="comp-question-shell max-w-5xl mx-auto"><section class="text-white p-5 sm:p-6">'+
 '<div class="flex items-start justify-between gap-3"><div>'+stageMapHtml(d)+'<span class="text-sm text-emerald-200 font-black block mt-3">'+(st.type==='boss'?'🏁 المواجهة النهائية':'المرحلة '+ar(st.no)+' / '+ar(st.total))+'</span><h1 class="text-xl sm:text-2xl font-black mt-1">'+esc(S.round?.title||'تحدي تَمَكُّن')+'</h1><div class="flex flex-wrap gap-2 mt-2"><span class="text-xs px-2 py-1 rounded-full bg-white/10">السؤال '+ar(q.position)+' / '+ar(questionCount())+'</span><span class="text-xs px-2 py-1 rounded-full bg-white/10">🔥 سلسلة '+ar(streak)+' • ×'+ar(mult)+'</span><span class="text-xs px-2 py-1 rounded-full bg-white/10">⭐ '+ar(a.points||0)+' نقطة</span></div></div><div class="comp-timer text-left"><div id="compTimer" class="font-mono text-lg font-black text-amber-300">'+fmtMs(d.elapsed_ms)+'</div><span class="text-[10px] text-slate-400">الزمن</span></div></div>'+
 '<div class="h-2 bg-white/10 rounded-full mt-4 overflow-hidden"><div class="comp-progress h-full rounded-full" style="width:'+progress+'%"></div></div></section>'+
 '<section id="questionCard" class="comp-question-card p-5 sm:p-7 mt-2"><div class="flex flex-wrap items-center justify-between gap-3"><div class="flex items-center gap-2"><span class="tk-badge tk-badge-info">'+levelName(q.cognitive_level)+'</span><span class="text-xs text-slate-400">المؤشر '+ar(q.indicator_index)+'</span></div><span class="text-xs text-slate-400 font-bold">'+(st.type==='boss'?'سؤال مختلط':'السؤال '+ar(st.question_no)+' من 3')+'</span></div>'+
 '<div class="comp-powerups mt-4">'+
 powerupButton('eliminate','✂️','استبعاد خيار',pu.eliminate||0,Number(pu.eliminate||0)<1||!!log.eliminate,false)+
 powerupButton('hint','💡','تلميح',pu.hint||0,Number(pu.hint||0)<1||!!log.hint,false)+
 powerupButton('double','×2','مضاعفة النقاط',pu.double||0,Number(pu.double||0)<1||!!log.double,a.active_powerup==='double')+
 '</div>'+
 (log.hint?'<div class="mt-3 rounded-2xl bg-sky-50 border border-sky-100 p-3 text-xs leading-6 text-sky-900"><b>💡 التلميح:</b> '+esc(log.hint)+'</div>':'')+
 questionImage(q)+(q.context_text?'<div class="mt-5 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 text-sm leading-8 text-slate-800 shadow-sm">'+esc(q.context_text)+'</div>':'')+
 '<h2 class="text-lg sm:text-xl font-black leading-8 text-slate-950 mt-6">'+esc(q.question_text)+'</h2><div class="grid sm:grid-cols-2 gap-3 mt-5">'+(q.options||[]).map((o,i)=>hidden.has(i)?'<div class="comp-option eliminated p-4 text-right text-sm font-bold"><span class="comp-letter inline-flex w-8 h-8 items-center justify-center ml-2">×</span>تم استبعاد هذا الخيار</div>':'<button data-comp-answer="'+i+'" class="comp-option p-4 text-right text-sm font-bold"><span class="comp-letter inline-flex w-8 h-8 items-center justify-center ml-2">'+['أ','ب','ج','د'][i]+'</span>'+esc(o)+'</button>').join('')+'</div>'+
 (S.message?'<div id="compFeedback" role="status" aria-live="polite" class="mt-5 p-4 rounded-2xl text-sm font-black '+(S.message.startsWith('✓')?'comp-feedback-good':'comp-feedback-bad')+'">'+esc(S.message)+'</div>':'')+
 (S.feedback?'<button id="compNext" class="comp-cta mt-4 px-6 py-3">'+(S.feedback.finished?'إنهاء اللعبة':'التالي ←')+'</button>':'')+'</section></div>';
 document.querySelectorAll('[data-comp-answer]').forEach(b=>{b.disabled=!!S.feedback;b.onclick=()=>answer(Number(b.dataset.compAnswer))});
 document.querySelectorAll('[data-powerup]').forEach(b=>b.onclick=()=>usePowerup(b.dataset.powerup));
 document.getElementById('compNext')?.addEventListener('click',nextQuestion);startElapsedTimer(d.attempt?.started_at);
 document.querySelectorAll('[data-comp-image]').forEach(img=>{img.onerror=()=>{document.querySelectorAll('[data-comp-answer]').forEach(b=>b.disabled=true);S.busy=true;const card=document.getElementById('questionCard');if(card)card.insertAdjacentHTML('beforeend','<p role="alert" class="mt-4 text-rose-700">تعذر تحميل الشكل؛ لا تجب بالتخمين. أعد تحميل الصفحة لاستئناف السؤال.</p>')}})
}
function levelName(v){return v==='knowledge'?'معرفة وفهم':v==='application'?'تطبيق':'استدلال'}
function startElapsedTimer(start){clearInterval(S.timer);const e=()=>{const x=document.getElementById('compTimer');if(x)x.textContent=fmtMs(Date.now()-new Date(start).getTime())};e();S.timer=setInterval(e,100)}
async function answer(i){
 if(S.busy||S.feedback)return;S.busy=true;document.querySelectorAll('[data-comp-answer]').forEach(x=>x.disabled=true);
 const questionId=S.attempt?.question?.id,roundId=S.round.id;
 try{
  const d=await post({action:'answer',round_id:roundId,question_id:questionId,option_index:i});
  const a=S.attempt.attempt||{};a.streak=Number(d.streak||0);a.max_streak=Number(d.max_streak||a.max_streak||0);a.points=Number(d.points||a.points||0);a.active_powerup=null;S.streak=a.streak;
  const msg=window.TamakkunEncouragement?.pick?.(d.correct?'correct':'incorrect',{streak:a.streak,use_context:true})||d.message;
  const bonus=d.correct&&Number(d.points_gained||0)>0?' • +'+ar(d.points_gained)+' نقطة'+(Number(d.multiplier||1)>1?' ×'+ar(d.multiplier):''):'';
  S.message=(d.correct?'✓ ':'✕ ')+msg+bonus;S.feedback={finished:d.finished,selected:i,questionId};S.busy=false;render();
 }catch(e){
  S.busy=false;if(e.data?.round_closed){alert(e.message);await load()}
  else{S.message='لم يصل تأكيد الحفظ. أعد إرسال الإجابة أو استأنف اللعبة؛ لن تُحسب مرتين.';render()}
 }
}

async function nextQuestion(){
 if(S.busy)return;S.busy=true;
 try{
  if(S.feedback?.finished){S.attempt={finished:true,attempt:S.attempt?.attempt||{}};S.feedback=null;S.message='';S.busy=false;render();return}
  S.attempt=await post({action:'current_attempt',round_id:S.round.id});S.streak=Number(S.attempt?.attempt?.streak||0);
  S.feedback=null;S.message='';S.busy=false;render();
 }catch(e){S.busy=false;alert(e.message)}
}
function renderFinishWait(el){
 const encouragement=window.TamakkunEncouragement?.card?.('competition_finish')||'',a=S.attempt?.attempt||{};
 el.innerHTML='<div class="comp-stage"><div class="max-w-xl mx-auto comp-podium text-white p-8 text-center"><div class="inline-flex w-20 h-20 items-center justify-center rounded-[1.7rem] bg-white/10 border border-white/10 text-5xl">🏁</div><span class="block text-sm text-emerald-300 font-black mt-5">اكتملت اللعبة</span><h2 class="text-3xl font-black mt-2">أنهيت جميع المراحل</h2><p class="text-sm text-slate-300 leading-7 mt-3">حُفظت إجاباتك ونقاطك. تظهر المراكز النهائية بعد إغلاق المعلم للعبة.</p><div class="grid grid-cols-2 gap-3 mt-5"><div class="comp-stat rounded-2xl p-4"><b class="text-2xl block text-amber-300">'+ar(a.points||0)+'</b><span class="text-xs text-slate-300">نقاط اللعبة</span></div><div class="comp-stat rounded-2xl p-4"><b class="text-2xl block text-emerald-300">'+ar(a.max_streak||0)+'</b><span class="text-xs text-slate-300">أطول سلسلة 🔥</span></div></div><div class="mt-5 text-right">'+encouragement+'</div><button id="backAfterFinish" class="comp-cta mt-7 px-7 py-3 text-sm font-black">العودة إلى ساحة البطولة</button></div></div>';
 document.getElementById('backAfterFinish').onclick=()=>load();
}

async function openStudentResult(id){renderLoading();try{S.result=await post({action:'round_results',round_id:id});S.screen='student-result';render()}catch(e){alert(e.message);await load()}}
function renderStudentResult(el){
 const d=S.result||{},me=d.me||{},ana=d.indicator_analysis||[],rank=n(me.rank_no),icon=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'🏆';
 const badges=[];if(Number(me.max_streak||0)>=5)badges.push('🔥 سلسلة قوية');if(ana.some(x=>n(x.questions)&&n(x.correct)===n(x.questions)))badges.push('🎯 إتقان كامل لمؤشر');if(Number(me.wrong_attempts||0)===0)badges.push('💎 جولة بلا أخطاء');
 el.innerHTML='<div class="comp-stage"><div class="space-y-5"><button id="backStudentComp" class="text-sm font-black text-emerald-700">← العودة إلى ساحة البطولة</button><section class="comp-podium text-white p-7 sm:p-9 text-center"><div class="text-6xl">'+icon+'</div><span class="block text-sm text-emerald-300 font-black mt-4">نتيجة اللعبة</span><h1 class="text-3xl font-black mt-2">'+esc(d.round?.title||'نتيجة اللعبة')+'</h1><div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-7"><div class="comp-stat rounded-2xl p-4"><b class="text-2xl block text-emerald-300">'+ar(me.correct_questions)+'/'+ar(questionCount())+'</b><span class="text-xs text-slate-300">صحيحة</span></div><div class="comp-stat rounded-2xl p-4"><b class="text-2xl block text-rose-300">'+ar(me.wrong_attempts)+'</b><span class="text-xs text-slate-300">أخطاء</span></div><div class="comp-stat rounded-2xl p-4"><b class="text-2xl block text-amber-300">'+ar(me.points)+'</b><span class="text-xs text-slate-300">نقاط</span></div><div class="comp-stat rounded-2xl p-4"><b class="text-2xl block text-emerald-300">'+ar(me.max_streak||0)+'</b><span class="text-xs text-slate-300">أطول سلسلة 🔥</span></div><div class="comp-stat rounded-2xl p-4 col-span-2 sm:col-span-1"><b class="text-xl block text-sky-300">'+rankIcon(me.rank_no)+'</b><span class="text-xs text-slate-300">المركز</span></div></div>'+
 (badges.length?'<div class="flex flex-wrap justify-center gap-2 mt-5">'+badges.map(x=>'<span class="px-3 py-2 rounded-full bg-white/10 border border-white/10 text-xs font-black">'+x+'</span>').join('')+'</div>':'')+'</section>'+
 '<section class="bg-white rounded-[2rem] p-5 sm:p-6 border"><div><span class="text-sm font-black text-emerald-700">🎯 تحليل المؤشرات</span><h2 class="font-black text-slate-900 mt-1">أين كنت قويًا؟ وأين تحتاج تدريبًا؟</h2></div><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">'+ana.map(x=>{const pc=n(x.questions)?Math.round(n(x.correct)/n(x.questions)*100):0;return '<div class="p-4 rounded-2xl bg-slate-50 border border-slate-100"><div class="flex items-start justify-between gap-2"><b class="text-sm leading-5 block text-slate-800">'+esc(x.indicator_text)+'</b><span class="tk-badge '+(pc>=80?'tk-badge-success':pc>=60?'tk-badge-warning':'tk-badge-danger')+'">'+ar(pc)+'٪</span></div><div class="tk-progress mt-4"><span style="width:'+pc+'%"></span></div><div class="flex justify-between text-xs mt-3"><span class="font-black text-emerald-700">'+ar(x.correct)+' / '+ar(x.questions)+' صحيحة</span><span class="text-rose-600">'+ar(x.wrong_attempts)+' خطأ</span></div></div>'}).join('')+'</div></section>'+
 '<section class="grid lg:grid-cols-2 gap-5"><div class="bg-white rounded-[2rem] p-5 sm:p-6 border"><div class="flex items-center justify-between"><h2 class="font-black text-slate-900">الأوائل في اللعبة</h2><span class="text-2xl">🏆</span></div><div class="space-y-2 mt-4">'+(d.top_students||[]).map(x=>'<div class="flex items-center gap-3 p-3 rounded-2xl '+(String(x.student_id)===String(me.student_id)?'bg-emerald-50 border-emerald-200':'bg-slate-50 border-slate-100')+' border"><span class="w-10 text-center">'+rankIcon(x.rank_no)+'</span><div class="flex-1"><b class="text-sm">'+esc(x.full_name)+'</b><span class="block text-xs text-slate-400">فصل '+esc(x.class_name)+'</span></div><b class="text-sm text-emerald-700">'+ar(x.correct_questions)+'/'+ar(questionCount())+'</b></div>').join('')+'</div></div><div class="bg-white rounded-[2rem] p-5 sm:p-6 border"><div class="flex items-center justify-between"><h2 class="font-black text-slate-900">كأس الفصول</h2><span class="text-2xl">👑</span></div><div class="space-y-2 mt-4">'+(d.class_leaderboard||[]).map(x=>'<div class="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3"><span>'+rankIcon(x.rank_no)+'</span><b class="flex-1 text-sm">الفصل '+esc(x.class_name)+'</b><span class="text-xs text-slate-500">متوسط '+Number(x.avg_correct||0).toFixed(2)+'/'+ar(questionCount())+'</span></div>').join('')+'</div></div></section></div></div>';
 document.getElementById('backStudentComp').onclick=()=>load();
}
async function mount(opts){style();clearInterval(S.timer);S.feedback=null;S.message='';S.busy=false;S.token=opts?.token||null;S.role=opts?.role||'student';S.profile=opts?.profile||null;S.screen='home';await load()}
window.LugatiCompetition={mount};
})();
