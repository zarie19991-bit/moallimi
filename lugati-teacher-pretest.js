(()=>{
'use strict';
const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-pretest-worksheets';
const GAME_API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-competition';
const EXACT='lugati_exact_session_v2',LEGACY='lugati_session_v1',LEGACY_ROLE='lugati_role_v1',LEGACY_PROFILE='lugati_profile_v1';
const SUBJECTS={
 reading:{name:'القراءة',icon:'📖',count:16},
 math:{name:'الرياضيات',icon:'➗',count:95},
 science:{name:'العلوم',icon:'🔬',count:159}
};
const S={token:'',scope:'all',subject:'reading',templates:[],cache:{reading:null,math:null,science:null},selected:new Set(),bundleTitle:'',activityType:'journey',demoOnly:true,search:'',sendingBundle:false,loading:false,error:''};
const allowedSubjectEntries=()=>Object.entries(SUBJECTS).filter(([k])=>S.scope==='all'||k===S.scope);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function ses(){for(const st of[sessionStorage,localStorage]){try{const x=JSON.parse(st.getItem(EXACT)||'null');if(x?.token&&x?.role==='teacher')return x}catch{}}for(const st of[sessionStorage,localStorage]){try{const token=st.getItem(LEGACY),role=st.getItem(LEGACY_ROLE);if(token&&role!=='student')return{token,role:'teacher',profile:JSON.parse(st.getItem(LEGACY_PROFILE)||'{}')}}catch{}}return null}
function syncSession(){const s=ses();if(!s?.token||s.role!=='teacher'){S.token='';return null}S.token=s.token;const nextScope=['reading','math','science'].includes(s?.profile?.subject_scope)?s.profile.subject_scope:'all';const changed=S.scope!==nextScope;S.scope=nextScope;if(S.scope!=='all')S.subject=S.scope;else if(changed&&!SUBJECTS[S.subject])S.subject='reading';return s}
async function post(action,extra={}){const s=syncSession();if(!s)throw new Error('تسجيل الدخول مطلوب.');const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${S.token}`},body:JSON.stringify({action,...extra}),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||`تعذر الاتصال (${r.status})`);return d}
async function postGame(action,extra={}){const s=syncSession();if(!s)throw new Error('تسجيل الدخول مطلوب.');const r=await fetch(GAME_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${S.token}`},body:JSON.stringify({action,...extra}),cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||`تعذر الاتصال (${r.status})`);return d}
function fmtDate(v){if(!v)return'';try{return new Date(v).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'})}catch{return''}}
function styles(){if(document.getElementById('pretestTeacherStyles'))return;const s=document.createElement('style');s.id='pretestTeacherStyles';s.textContent=`
#pretestWorksheetBtn{width:100%;border:0;background:transparent;cursor:pointer}
.pretest-reading-tab{border:1px solid #0ea5e9!important;background:#e0f2fe!important;color:#075985!important;border-radius:999px!important;padding:10px 18px!important;font-weight:800!important;cursor:pointer!important}
.pretest-modal{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.62);backdrop-filter:blur(5px);overflow:auto;padding:18px;direction:rtl}
.pretest-card{max-width:1180px;margin:20px auto;background:#f8fafc;border-radius:28px;overflow:hidden;box-shadow:0 30px 80px rgba(15,23,42,.28)}
.pretest-head{background:linear-gradient(135deg,#075985,#0f766e);color:white;padding:24px}.pretest-head-row{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.pretest-head h1{margin:7px 0 4px;font-size:25px}.pretest-head p{margin:0;color:#dbeafe;font-size:12px;line-height:1.8}.pretest-close{border:0;background:rgba(255,255,255,.14);color:white;width:40px;height:40px;border-radius:12px;font-size:24px;cursor:pointer}
.pretest-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px 20px;background:white;border-bottom:1px solid #e2e8f0}.pretest-tab{border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:11px;font-weight:900;color:#64748b;cursor:pointer}.pretest-tab.active{background:#0f766e;color:white;border-color:#0f766e}.pretest-tab small{display:block;font-size:9px;opacity:.8;margin-top:2px}
.pretest-body{padding:20px}.pretest-note{background:#e0f2fe;border:1px solid #bae6fd;color:#0c4a6e;border-radius:16px;padding:14px;font-size:12px;line-height:1.8;margin-bottom:16px}.pretest-summary{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:14px}.pretest-summary h2{font-size:17px;margin:0}.pretest-summary span{font-size:11px;color:#64748b}
.pretest-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pretest-item{background:white;border:1px solid #e2e8f0;border-radius:20px;padding:17px}.pretest-meta{font-size:10px;color:#64748b;font-weight:800}.pretest-item h3{font-size:14px;line-height:1.8;margin:6px 0;color:#0f172a}.pretest-tags{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.pretest-tag{font-size:9px;font-weight:800;border-radius:999px;padding:5px 9px;background:#f1f5f9;color:#475569}.pretest-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:6px;margin:10px 0}.pretest-stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:7px;text-align:center}.pretest-stat b{display:block;font-size:13px}.pretest-stat span{display:block;font-size:8px;color:#64748b;margin-top:2px}.pretest-send{width:100%;border:0;border-radius:12px;padding:12px;background:#0369a1;color:white;font-weight:900;cursor:pointer}.pretest-send:disabled{opacity:.6}
.bundle-builder{position:sticky;top:8px;z-index:6;background:#0f172a;color:#fff;border-radius:20px;padding:15px;margin-bottom:16px;box-shadow:0 16px 38px rgba(15,23,42,.2)}.bundle-builder-top{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.bundle-builder h3{font-size:15px;margin:0}.bundle-builder p{font-size:10px;color:#cbd5e1;margin:4px 0 0}.bundle-count{background:#10b981;color:#fff;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:900}.bundle-controls{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:8px;margin-top:12px}.bundle-controls input{min-width:0;border:1px solid #334155;background:#fff;color:#0f172a;border-radius:12px;padding:10px 12px;font-size:12px}.bundle-send{border:0;background:#10b981;color:#fff;border-radius:12px;padding:10px 16px;font-weight:900;cursor:pointer}.bundle-send:disabled{opacity:.45;cursor:not-allowed}.bundle-clear{border:1px solid #475569;background:transparent;color:#e2e8f0;border-radius:12px;padding:10px 13px;font-weight:800;cursor:pointer}.bundle-preview{display:flex;gap:6px;overflow:auto;padding:10px 0 2px;scrollbar-width:thin}.bundle-chip{flex:0 0 auto;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:6px 9px;font-size:9px}.pretest-item.selected{border:2px solid #10b981;background:#f0fdf4}.pretest-select{width:100%;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:11px;padding:10px;font-weight:900;cursor:pointer;margin-bottom:8px}.pretest-item.selected .pretest-select{background:#047857;color:#fff;border-color:#047857}.pretest-actions{display:grid;grid-template-columns:1fr;gap:7px}
.activity-builder{background:linear-gradient(135deg,#064e3b,#0f766e);color:#fff;border-radius:22px;padding:16px;margin-bottom:16px;box-shadow:0 16px 38px rgba(15,23,42,.16)}
.activity-builder-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.activity-builder h3{margin:0;font-size:16px}.activity-builder p{margin:4px 0 0;font-size:10px;color:#d1fae5;line-height:1.8}
.activity-type-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.activity-type{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#e2e8f0;border-radius:13px;padding:11px;font-weight:900;cursor:pointer}.activity-type.active{background:#fff;color:#065f46;border-color:#fff}
.activity-search{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:12px}.activity-search input{width:100%;border:0;border-radius:12px;padding:11px 12px;font-size:12px;color:#0f172a}.activity-search button{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;border-radius:12px;padding:10px 12px;font-weight:900;cursor:pointer}
.activity-mode{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10)}.activity-mode label{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:900;cursor:pointer}.activity-mode input{width:18px;height:18px}
.activity-action{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;gap:8px;margin-top:12px}.activity-action input{min-width:0;border:0;border-radius:12px;padding:11px 12px;font-size:12px;color:#0f172a}.activity-action .primary{border:0;background:#10b981;color:#fff;border-radius:12px;padding:11px 16px;font-weight:900;cursor:pointer}.activity-action .secondary{border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;border-radius:12px;padding:11px 13px;font-weight:900;cursor:pointer}.activity-action button:disabled{opacity:.45;cursor:not-allowed}
.activity-preview{display:flex;gap:6px;overflow:auto;padding:10px 0 0;scrollbar-width:thin}.activity-chip{flex:0 0 auto;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:6px 9px;font-size:9px}.activity-safe{font-size:9px;background:#fef3c7;color:#92400e;border-radius:999px;padding:5px 8px;font-weight:900}
@media(max-width:760px){.activity-action,.activity-search{grid-template-columns:1fr}.activity-type-row{grid-template-columns:1fr 1fr}.activity-mode{align-items:flex-start;flex-direction:column}}
@media(max-width:760px){.bundle-controls{grid-template-columns:1fr}.bundle-builder{top:4px}.bundle-send,.bundle-clear{width:100%}}
@media(max-width:760px){.pretest-grid{grid-template-columns:1fr}.pretest-modal{padding:6px}.pretest-card{margin:6px auto;border-radius:19px}.pretest-tabs{padding:10px}.pretest-tab{font-size:11px}}
`;document.head.appendChild(s)}
function injectReadingTab(){const texts=[...document.querySelectorAll('button,a,[role="tab"]')];const anchor=texts.find(x=>['الوحدات التعليمية','الدروس'].includes((x.textContent||'').trim()));if(!anchor)return;const row=anchor.parentElement;if(!row||row.querySelector('.pretest-reading-tab'))return;const b=document.createElement('button');b.type='button';b.className='pretest-reading-tab';b.textContent='رحلة قبل الاختبار';b.onclick=open;row.appendChild(b)}
function ensureButton(){const s=syncSession();if(!s)return;styles();injectReadingTab();const nav=document.querySelector('aside nav');if(!nav||document.getElementById('pretestWorksheetBtn'))return;const b=document.createElement('button');b.id='pretestWorksheetBtn';b.type='button';b.className='w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-right text-slate-600 hover:bg-sky-50 hover:text-sky-800 transition-all';const scopeMeta=S.scope==='all'?'القراءة • الرياضيات • العلوم':SUBJECTS[S.scope].name;b.innerHTML='<div class="flex items-center gap-3"><span class="w-5 h-5 text-sky-600">🧭</span><div class="flex flex-col"><span class="font-bold">رحلة قبل الاختبار</span><span class="text-[11px] text-slate-400">'+scopeMeta+'</span></div></div><span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">'+(S.scope==='all'?'3':'1')+'</span>';b.onclick=open;nav.appendChild(b)}
async function load(force=false){if(S.loading)return;if(!force&&S.cache[S.subject]){S.templates=S.cache[S.subject];render();return}S.loading=true;S.error='';render();try{const d=await post('list_templates',{subject_key:S.subject});S.templates=d.templates||[];S.cache[S.subject]=S.templates}catch(e){S.error=e.message}finally{S.loading=false;render()}}
function tabsHtml(){return `<div class="pretest-tabs" style="grid-template-columns:repeat(${allowedSubjectEntries().length},1fr)">${allowedSubjectEntries().map(([k,v])=>`<button class="pretest-tab ${S.subject===k?'active':''}" data-pretest-subject="${k}">${v.icon} ${v.name}<small>${v.count} مؤشرًا</small></button>`).join('')}</div>`}
function open(){const s=syncSession();if(!s){alert('تسجيل الدخول مطلوب.');return}styles();if(document.getElementById('pretestModal'))return;const w=document.createElement('div');w.id='pretestModal';w.className='pretest-modal';w.innerHTML=`<div class="pretest-card"><header class="pretest-head"><div class="pretest-head-row"><div><small>منشئ الأنشطة</small><h1>المؤشرات والأنشطة</h1><p>ابحث عن المؤشرات وحددها مرة واحدة، ثم أنشئ رحلة إتقان أو لعبة. ابدأ بالطالب التجريبي، وبعد المراجعة يمكنك التحويل إلى إرسال فعلي.</p></div><button id="closePretestModal" class="pretest-close">×</button></div></header><div id="pretestTabs"></div><div id="pretestBody" class="pretest-body"></div></div>`;document.body.appendChild(w);document.getElementById('closePretestModal').onclick=()=>w.remove();w.addEventListener('click',e=>{if(e.target===w)w.remove()});renderTabs();load()}
function renderTabs(){const x=document.getElementById('pretestTabs');if(!x)return;x.innerHTML=tabsHtml();x.querySelectorAll('[data-pretest-subject]').forEach(b=>b.onclick=()=>{S.subject=b.dataset.pretestSubject;S.templates=S.cache[S.subject]||[];S.selected.clear();S.bundleTitle='';S.search='';renderTabs();load()})}

function selectedTemplates(){
 return S.templates.filter(t=>S.selected.has(String(t.id))).sort((a,b)=>Number(a.global_indicator||a.indicator_index)-Number(b.global_indicator||b.indicator_index));
}
function visibleTemplates(){
 const q=(S.search||'').trim().toLowerCase();if(!q)return S.templates;
 return S.templates.filter(t=>{
  const g=String(t.global_indicator||t.indicator_index||''),text=[g,t.outcome_code,t.indicator_text,t.student_title].filter(Boolean).join(' ').toLowerCase();
  return text.includes(q);
 });
}
function toggleTemplate(id){
 const k=String(id);
 if(S.selected.has(k))S.selected.delete(k);
 else{
   const max=S.activityType==='game'?12:50;
   if(S.selected.size>=max){alert('الحد الأعلى في '+(S.activityType==='game'?'اللعبة 12 مؤشرًا.':'رحلة الإتقان 50 مؤشرًا.'));return}
   S.selected.add(k);
 }
 render();
}
function readingArenaFor(rows){
 const groups=[...new Set(rows.map(t=>String(t.outcome_code||'').split('-')[0]))];
 if(groups.length!==1)return null;
 return groups[0]==='1'?'reading_1':groups[0]==='2'?'reading_2':groups[0]==='3'?'reading_3':null;
}
async function sendSelectedActivity(){
 const selected=selectedTemplates(),meta=SUBJECTS[S.subject],count=selected.length;
 if(!count){alert('اختر مؤشرًا واحدًا على الأقل.');return}
 if(S.activityType==='journey'&&count<2){alert('للرحلة المدمجة اختر مؤشرين على الأقل، أو استخدم زر الإرسال الفردي للمؤشر.');return}
 if(S.activityType==='game'&&count>12){alert('اللعبة الواحدة تدعم حتى 12 مؤشرًا.');return}
 const title=(S.bundleTitle||((S.activityType==='game'?'لعبة تَمَكُّن ':'رحلة إتقان ')+meta.name+' — '+count+' مؤشرات')).trim();
 const preview=selected.slice(0,8).map(t=>'المؤشر '+(t.global_indicator||t.indicator_index)).join('، ')+(count>8?'، +'+(count-8):'');
 const target=S.demoOnly?'الطالب التجريبي فقط':'جميع الطلاب الحقيقيين';
 if(!confirm((S.demoOnly?'🧪 وضع اختبار آمن\n\n':'⚠️ إرسال فعلي\n\n')+title+'\n'+preview+'\n\nالوجهة: '+target))return;
 S.sendingBundle=true;render();
 try{
   let d;
   if(S.activityType==='journey'){
     d=await post('send_bundle',{template_ids:selected.map(t=>t.id),bundle_title:title,demo_only:S.demoOnly});
     alert(S.demoOnly?'تم إنشاء الرحلة للطالب التجريبي فقط ✓':'تم إرسال الرحلة إلى '+d.students+' طالبًا ✓');
   }else{
     const arena=S.subject==='reading'?readingArenaFor(selected):S.subject;
     if(!arena)throw new Error('في لعبة القراءة اختر مؤشرات من مجموعة قراءة واحدة فقط؛ أما رحلة الإتقان فيمكنها جمع مؤشرات القراءة المختارة.');
     d=await postGame('create_round',{game_mode:'v2',arena_key:arena,title,demo_only:S.demoOnly,
       indicators:selected.map(t=>({outcome_code:t.outcome_code,indicator_index:t.indicator_index}))});
     alert(S.demoOnly?'تم إنشاء اللعبة التجريبية ولن تظهر للطلاب الحقيقيين ✓':'تم إنشاء اللعبة وإتاحتها للطلاب ✓');
   }
   S.selected.clear();S.bundleTitle='';S.cache[S.subject]=null;await load(true);
 }catch(e){alert(e.message)}
 finally{S.sendingBundle=false;render()}
}
function activityBuilderHtml(){
 const rows=selectedTemplates(),visible=visibleTemplates(),meta=SUBJECTS[S.subject],count=rows.length,max=S.activityType==='game'?12:50;
 const defaultTitle=(S.activityType==='game'?'لعبة تَمَكُّن ':'رحلة إتقان ')+meta.name+' — '+count+' مؤشرات';
 return `<section class="activity-builder">
   <div class="activity-builder-top"><div><h3>🧩 إنشاء نشاط من المؤشرات</h3><p>اختر المؤشرات مرة واحدة، ثم حدد هل تريدها رحلة إتقان أو لعبة. وضع الاختبار يمنع وصول النشاط إلى الطلاب الحقيقيين.</p></div><span class="activity-safe">${S.demoOnly?'🧪 تجريبي فقط':'⚠️ إرسال حقيقي'}</span></div>
   <div class="activity-type-row"><button class="activity-type ${S.activityType==='journey'?'active':''}" data-activity-type="journey">🧭 رحلة إتقان</button><button class="activity-type ${S.activityType==='game'?'active':''}" data-activity-type="game">🎮 لعبة</button></div>
   <div class="activity-search"><input id="activitySearch" placeholder="ابحث برقم المؤشر أو اسمه…" value="${esc(S.search)}"><button id="selectVisibleBtn" type="button">تحديد نتائج البحث (${visible.length})</button></div>
   <div class="activity-mode"><label><input id="demoOnlyToggle" type="checkbox" ${S.demoOnly?'checked':''}> اختبار على الطالب التجريبي فقط</label><span style="font-size:9px;color:#d1fae5">عند إلغائه يصبح الإرسال فعليًا للطلاب.</span></div>
   <div class="activity-action"><input id="bundleTitleInput" maxlength="140" placeholder="${esc(defaultTitle)}" value="${esc(S.bundleTitle)}"><button id="sendActivityBtn" class="primary" ${!count||S.sendingBundle||(S.activityType==='journey'&&count<2)?'disabled':''}>${S.sendingBundle?'جارٍ الإنشاء…':S.demoOnly?'إنشاء تجربة آمنة':'إرسال النشاط'}</button><button id="clearBundleBtn" class="secondary" ${!count?'disabled':''}>مسح</button></div>
   <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:9px;font-size:9px;color:#d1fae5"><span>${count} محدد من حد أقصى ${max}</span><span>${visible.length} ظاهر في البحث</span></div>
   ${count?`<div class="activity-preview">${rows.slice(0,14).map((t,i)=>`<span class="activity-chip">${i+1}. مؤشر ${t.global_indicator||t.indicator_index}</span>`).join('')}${count>14?`<span class="activity-chip">+${count-14} أخرى</span>`:''}</div>`:''}
 </section>`;
}
function wireActivityBuilder(box){
 box.querySelectorAll('[data-activity-type]').forEach(b=>b.onclick=()=>{S.activityType=b.dataset.activityType;const max=S.activityType==='game'?12:50;if(S.selected.size>max){const keep=selectedTemplates().slice(0,max);S.selected=new Set(keep.map(x=>String(x.id)));}render()});
 const input=box.querySelector('#bundleTitleInput');if(input)input.oninput=()=>{S.bundleTitle=input.value};
 const search=box.querySelector('#activitySearch');if(search)search.oninput=()=>{S.search=search.value;render()};
 box.querySelector('#demoOnlyToggle')?.addEventListener('change',e=>{S.demoOnly=e.target.checked;render()});
 box.querySelector('#sendActivityBtn')?.addEventListener('click',sendSelectedActivity);
 box.querySelector('#clearBundleBtn')?.addEventListener('click',()=>{S.selected.clear();S.bundleTitle='';render()});
 box.querySelector('#selectVisibleBtn')?.addEventListener('click',()=>{
   const rows=visibleTemplates(),max=S.activityType==='game'?12:50;
   for(const t of rows){if(S.selected.size>=max)break;S.selected.add(String(t.id))}
   render();
 });
 box.querySelectorAll('[data-select-template]').forEach(b=>b.onclick=()=>toggleTemplate(b.dataset.selectTemplate));
}
function render(){
 const box=document.getElementById('pretestBody');if(!box)return;const meta=SUBJECTS[S.subject];
 if(S.loading&&!S.templates.length){box.innerHTML=`<div style="padding:70px;text-align:center;color:#64748b">جارٍ تحميل مؤشرات ${meta.name}…</div>`;return}
 if(S.error&&!S.templates.length){box.innerHTML=`<div class="pretest-note" style="background:#fff1f2;border-color:#fecdd3;color:#9f1239">${esc(S.error)}<br><button id="retryPretest" class="pretest-send" style="margin-top:10px">إعادة المحاولة</button></div>`;document.getElementById('retryPretest').onclick=()=>load(true);return}
 box.innerHTML=`
 <div class="pretest-note"><b>منشئ الأنشطة الموحد:</b> ابحث عن المؤشرات وحددها مرة واحدة، ثم اختر <b>رحلة إتقان</b> أو <b>لعبة</b>. اترك «الطالب التجريبي فقط» مفعّلًا أثناء المراجعة حتى لا يصل أي نشاط للطلاب الحقيقيين.</div>
 ${activityBuilderHtml()}
 <div class="pretest-summary"><div><h2>${meta.icon} ${meta.name}</h2><span>${S.templates.length} مؤشرًا مجتازًا لبوابة الجودة</span></div><span>حدد أي عدد من المؤشرات ثم أرسلها في رحلة واحدة</span></div>
 <div class="pretest-grid">${visibleTemplates().map(t=>{const st=t.last_dispatch?.stats||{},g=t.global_indicator||t.indicator_index,selected=S.selected.has(String(t.id));return`<article class="pretest-item ${selected?'selected':''}">
   <div class="pretest-meta">${meta.name} • المؤشر ${g} • ${esc(t.outcome_code)}</div>
   <h3>${esc(t.student_title||t.indicator_text)}</h3>
   ${t.student_title?`<div class="pretest-meta" style="line-height:1.7">${esc(t.indicator_text)}</div>`:''}
   <div class="pretest-tags"><span class="pretest-tag">شرح المؤشر</span><span class="pretest-tag">كيف يأتي السؤال؟</span><span class="pretest-tag">خطوات الحل</span><span class="pretest-tag">معرفة</span><span class="pretest-tag">تطبيق</span><span class="pretest-tag">استدلال</span></div>
   ${t.last_dispatch?`<div class="pretest-meta">آخر إرسال: ${fmtDate(t.last_dispatch.sent_at)}</div><div class="pretest-stats"><div class="pretest-stat"><b>${Number(st.sent||0).toLocaleString('ar-SA')}</b><span>جديد</span></div><div class="pretest-stat"><b>${Number(st.in_progress||0).toLocaleString('ar-SA')}</b><span>قيد التدريب</span></div><div class="pretest-stat"><b>${Number(st.exit||0).toLocaleString('ar-SA')}</b><span>اختبار خروج</span></div><div class="pretest-stat"><b>${Number(st.support||0).toLocaleString('ar-SA')}</b><span>علاج</span></div><div class="pretest-stat"><b>${Number(st.ready||0).toLocaleString('ar-SA')}</b><span>متقن</span></div></div>`:''}
   <div class="pretest-actions"><button data-select-template="${t.id}" class="pretest-select">${selected?'✓ ضمن الاختيار':'＋ أضف إلى الاختيار'}</button><button data-send-pretest="${t.id}" class="pretest-send">إرسال هذا المؤشر منفردًا</button></div>
 </article>`}).join('')}</div>`;
 wireActivityBuilder(box);
 box.querySelectorAll('[data-send-pretest]').forEach(b=>b.onclick=async()=>{
   const t=S.templates.find(x=>x.id===b.dataset.sendPretest);if(!t)return;
   if(!confirm(`${S.demoOnly?'🧪 اختبار على الطالب التجريبي فقط':'⚠️ إرسال فعلي لجميع الطلاب'}\n\nرحلة ${meta.name} — المؤشر ${t.global_indicator}\n${t.indicator_text}`))return;
   const old=b.textContent;b.disabled=true;b.textContent='جارٍ الإرسال…';
   try{const d=await post('send_all',{template_id:t.id,demo_only:S.demoOnly});b.textContent=S.demoOnly?'تم للطالب التجريبي ✓':`تم الإرسال إلى ${d.students} طالبًا ✓`;S.cache[S.subject]=null;await load(true)}
   catch(e){b.disabled=false;b.textContent=old;alert(e.message)}
 });
}

window.LugatiPretest={open};
function boot(){styles();ensureButton();injectReadingTab();const obs=new MutationObserver(()=>{ensureButton();injectReadingTab()});obs.observe(document.documentElement,{childList:true,subtree:true});let tries=0;const m=setInterval(()=>{ensureButton();injectReadingTab();if(++tries>=120)clearInterval(m)},1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();