(()=>{
'use strict';
const $=id=>document.getElementById(id),form=$('builder'),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),ar=x=>new Intl.NumberFormat('ar-SA').format(x),names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
let catalog=null,draft=null,configAtPreview=null,busy=false,initialized=false;
const toggleMap={showResult:'show_result',showAnswers:'show_answers',showIndicatorResult:'show_indicator_result',showCorrectCount:'show_correct_count',shuffleQuestions:'shuffle_questions',shuffleOptions:'shuffle_options',allowCopy:'allow_copy',disableRightClick:'disable_right_click',disablePrint:'disable_print',disableShortcuts:'disable_shortcuts',allowBack:'allow_back',onePerPage:'one_per_page',lockSession:'lock_session',logVisibility:'log_visibility',watermark:'watermark'};
const rows=()=>[...document.querySelectorAll('.section-row[data-subject]')],kind=()=>document.querySelector('[name=testType]:checked')?.value||'custom';
const isSimCustom=()=>kind()==='simulation_custom',isFull=()=>kind()==='full';

function ensureFullControls(){
 if($('fullModeControls'))return;
 const box=document.createElement('div');box.id='fullModeControls';box.className='hidden';
 box.innerHTML='<label class="field"><span>نموذج المحاكاة</span><select id="fullModel"><option value="1">النموذج الأول</option><option value="2">النموذج الثاني</option><option value="3">النموذج الثالث</option></select></label><div id="fullBankNotice" class="identity-notice" style="background:#f4fbf8;border:1px solid #cce8dd;border-radius:12px;padding:12px 16px;margin:12px 0;color:#184e3d;font-size:13px;line-height:1.7;"></div>';
 $('customMode')?.after(box);
}
function saveDraft(){try{localStorage.setItem('nafes_builder_draft',JSON.stringify(Object.fromEntries(['className','schoolName','teacherName','principalName','term'].map(k=>[k,$(k)?.value||'']))));}catch(_){}}
function restore(){try{for(const[k,v]of Object.entries(JSON.parse(localStorage.getItem('nafes_builder_draft')||'{}')))if($(k)&&typeof v==='string')$(k).value=v;}catch(_){}}
function sourceIndicators(){return isSimCustom()?(catalog?.simulation_indicators||[]):(catalog?.indicators||[]);}
function simulationSummary(){return catalog?.simulation_summary||{reading:0,math:0,science:0,total:0};}
function updateFullBankNotice(){const el=$('fullBankNotice');if(!el)return;const s=simulationSummary();const ready=(s.reading||0)>=20&&(s.math||0)>=25&&(s.science||0)>=20;el.innerHTML=`<b>${ready?'✓ بنك المحاكاة جاهز':'⚠️ رصيد بنك المحاكاة غير مكتمل'}</b><br>القراءة: ${ar(s.reading||0)} · الرياضيات: ${ar(s.math||0)} · العلوم: ${ar(s.science||0)} سؤالًا معتمدًا.`;el.style.background=ready?'#f4fbf8':'#fff4e5';el.style.borderColor=ready?'#cce8dd':'#f1d29a';}
function applyTypeDefaults(previous){
 ensureFullControls();const t=kind();
 $('regularCustomControls')?.classList.toggle('hidden',t!=='custom');
 $('simulationCustomNotice')?.classList.toggle('hidden',t!=='simulation_custom');
 $('fullModeControls')?.classList.toggle('hidden',t!=='full');
 if(t==='full'){
   const defaults={reading:[20,45],math:[25,45],science:[20,30]};rows().forEach(r=>{r.querySelector('.enabled').checked=true;r.querySelector('.count').value=defaults[r.dataset.subject][0];r.querySelector('.minutes').value=defaults[r.dataset.subject][1];});
   if(!$('testTitle').value.trim()||['اختبار نافس','اختبار مؤشرات نافس مخصص'].includes($('testTitle').value.trim()))$('testTitle').value='اختبار محاكاة نافس الشاملة';
   $('breakMinutes').value=$('breakMinutes').value||'2';updateFullBankNotice();
 }else if(t==='simulation_custom'){
   $('countMode').value='per_indicator';
   if(previous==='full')rows().forEach((r,i)=>r.querySelector('.enabled').checked=i===0);
   if(!$('testTitle').value.trim()||$('testTitle').value.includes('محاكاة نافس الشاملة'))$('testTitle').value='اختبار محاكي بالمؤشرات';
 }else{
   if(previous==='full')rows().forEach((r,i)=>r.querySelector('.enabled').checked=i===0);
   if(!$('testTitle').value.trim()||$('testTitle').value.includes('محاكاة نافس'))$('testTitle').value='اختبار نافس';
 }
 selectPanels();
}
function panelIndicatorMarkup(i,n,old){
 const sim=isSimCustom(),available=Number(i.available||0),ready=sim?available>=10:available>0;
 const count=sim?10:Number(old?.count||5);
 return `<label class="indicator-option${!ready?' unavailable':''}"><input type="checkbox" class="indicator-check" value="${esc(i.key)}" ${old?.checked?'checked':''} ${!ready?'disabled':''}><span>${ar(n+1)}) ${esc(i.text)}<small>${sim?`بنك المحاكاة: ${ar(available)}/١٠ ${ready?'— جاهز':'— غير جاهز'}`:`المتاح: ${ar(available)} سؤالًا`}</small></span><input class="indicator-count" type="number" min="1" max="30" value="${count}" aria-label="عدد أسئلة المؤشر ${ar(n+1)}"></label>`;
}
function selectPanels(){
 if(!catalog)return;
 const selected=new Map([...document.querySelectorAll('.indicator-option')].map(x=>[x.querySelector('.indicator-check').value,{checked:x.querySelector('.indicator-check').checked,count:x.querySelector('.indicator-count')?.value||5}]));
 if(isFull()){
   const s=simulationSummary();$('selectionPanels').innerHTML=`<section class="selection-panel"><h3>المحاكاة الشاملة</h3><p class="selection-summary">تستخدم بنك المحاكاة المستقل فقط: القراءة ٢٠ سؤالًا، الرياضيات ٢٥ سؤالًا، العلوم ٢٠ سؤالًا. الرصيد الحالي: قراءة ${ar(s.reading||0)} · رياضيات ${ar(s.math||0)} · علوم ${ar(s.science||0)}.</p></section>`;toggleCounts();return;
 }
 const inds=sourceIndicators();
 $('selectionPanels').innerHTML=rows().filter(r=>r.querySelector('.enabled').checked).map(row=>{const subject=row.dataset.subject;const items=inds.filter(i=>i.subject===subject);return `<section class="selection-panel" data-select-subject="${subject}"><h3>${names[subject]}</h3><p class="selection-summary">${isSimCustom()?'اختر حتى ٦ مؤشرات؛ لكل مؤشر ١٠ أسئلة من بنك المحاكاة المستقل.':'اختر المؤشرات التي تريد قياسها.'}</p><input class="indicator-search" type="search" placeholder="بحث في مؤشرات ${names[subject]}" aria-label="بحث في المؤشرات"><div class="indicator-options">${items.map((i,n)=>panelIndicatorMarkup(i,n,selected.get(i.key))).join('')}</div></section>`;}).join('');
 toggleCounts();
}
function updateSimCounts(){if(!isSimCustom())return;rows().forEach(r=>{const panel=document.querySelector(`[data-select-subject="${r.dataset.subject}"]`),n=panel?.querySelectorAll('.indicator-check:checked').length||0;r.querySelector('.count').value=n*10;});}
function toggleCounts(){
 const t=kind();
 document.querySelectorAll('.indicator-count').forEach(x=>{x.hidden=t!=='custom'||$('countMode').value!=='per_indicator';if(isSimCustom()){x.value=10;x.hidden=true;}});
 rows().forEach(r=>{const c=r.querySelector('.count');c.min='1';c.max='60';c.disabled=t==='full'||t==='simulation_custom'||(t==='custom'&&$('countMode').value==='per_indicator');});
 updateSimCounts();
}
function settings(){const s=Object.fromEntries(Object.entries(toggleMap).map(([id,key])=>[key,$(id).checked]));s.attempts=Number($('attempts').value);s.opens_at=$('opensAt').value?new Date($('opensAt').value).toISOString():null;s.closes_at=$('closesAt').value?new Date($('closesAt').value).toISOString():null;s.break_minutes=Number($('breakMinutes').value);if(s.closes_at&&new Date(s.closes_at)<=new Date())throw new Error('حدد وقت نهاية مستقبليًا.');return s;}
function config(){
 const type=kind(),set=settings(),sections=[];
 if(type==='full'){
   const s=simulationSummary();if((s.reading||0)<20||(s.math||0)<25||(s.science||0)<20)throw new Error(`بنك المحاكاة غير مكتمل للمحاكاة الشاملة: القراءة ${s.reading||0}/20، الرياضيات ${s.math||0}/25، العلوم ${s.science||0}/20.`);
   for(const r of rows()){const subject=r.dataset.subject;sections.push({subject,question_count:Number(r.querySelector('.count').value),duration_minutes:Number(r.querySelector('.minutes').value),calculator:subject==='math'&&!!r.querySelector('.calculator input')?.checked,model_no:Number($('fullModel')?.value||1),indicators:[]});}
   return {kind:'simulation',simulation_mode:'standard',bank_source:'simulation_bank',grade_key:'middle_3',title:$('testTitle').value.trim(),class_name:$('className').value.trim(),term:$('term').value,academic_term:$('term').value,school_name:$('schoolName').value.trim(),teacher_name:$('teacherName').value.trim(),principal_name:$('principalName').value.trim(),identity_mode:'manual',roster:[],sections,count_mode:'total',settings:set};
 }
 for(const r of rows().filter(r=>r.querySelector('.enabled').checked)){
   const subject=r.dataset.subject,panel=document.querySelector(`[data-select-subject="${subject}"]`),checks=[...(panel?.querySelectorAll('.indicator-check:checked')||[])];
   if(!checks.length)throw new Error(`اختر مؤشرًا واحدًا على الأقل في مادة ${names[subject]}.`);
   if(type==='simulation_custom'&&checks.length>6)throw new Error(`الحد الأعلى في المحاكاة هو ٦ مؤشرات لكل مادة (${names[subject]}).`);
   const indicators=checks.map(x=>({key:x.value,count:type==='simulation_custom'?10:Number(x.closest('label').querySelector('.indicator-count')?.value||0)}));
   const qCount=type==='simulation_custom'?indicators.length*10:Number(r.querySelector('.count').value);
   if(type==='simulation_custom')for(const x of indicators){const item=(catalog.simulation_indicators||[]).find(i=>i.key===x.key);if(Number(item?.available||0)<10)throw new Error(`المؤشر «${item?.text||x.key}» لا يملك ١٠ أسئلة جاهزة في بنك المحاكاة.`);}
   sections.push({subject,question_count:qCount,duration_minutes:Number(r.querySelector('.minutes').value),calculator:subject==='math'&&!!r.querySelector('.calculator input')?.checked,model_no:1,indicators,fixed_model:type==='custom'&&$('fixedModel').value?Number($('fixedModel').value):undefined});
 }
 if(!sections.length)throw new Error('فعّل مادة واحدة على الأقل.');
 if(type==='custom'&&$('fixedModel').value){const all=sections.flatMap(s=>s.indicators);if(all.length!==1||sections[0].question_count!==15)throw new Error('النموذج الثابت يتطلب مؤشرًا واحدًا وعدد ١٥ سؤالًا.');}
 return {kind:type==='simulation_custom'?'simulation':'multi_indicator',simulation_mode:type==='simulation_custom'?'custom':undefined,bank_source:type==='simulation_custom'?'simulation_bank':'indicator_bank',grade_key:'middle_3',title:$('testTitle').value.trim(),class_name:$('className').value.trim(),term:$('term').value,academic_term:$('term').value,school_name:$('schoolName').value.trim(),teacher_name:$('teacherName').value.trim(),principal_name:$('principalName').value.trim(),identity_mode:'manual',roster:[],sections,count_mode:type==='simulation_custom'?'per_indicator':$('countMode').value,settings:set};
}
function showPreview(d){draft=d;configAtPreview=d.config;$('previewPanel').classList.remove('hidden');$('previewMeta').textContent=`${d.config.title} · ${ar(d.sections.reduce((n,s)=>n+s.questions.length,0))} سؤالًا`;$('previewQuestions').innerHTML=d.sections.map(s=>`<details open><summary>${names[s.subject]} · ${ar(s.questions.length)} سؤالًا</summary>${s.questions.map((q,n)=>`<article>${q.context?`<div class="context">${esc(q.context)}</div>`:''}${window.NafesMedia?.render?window.NafesMedia.render(q):''}<p class="stem">${ar(n+1)}) ${esc(q.question)}</p><ol type="A">${q.options.map(o=>`<li>${esc(o)}</li>`).join('')}</ol><p class="key">الإجابة: ${['أ','ب','ج','د'][q.correctIndex]}) ${esc(q.options[q.correctIndex])}<br>${esc(q.explanation)}</p><p>${esc(q.indicator_text||'')}</p><button class="replace-question" data-replace="${esc(q.id)}" type="button">تبديل هذا السؤال</button></article>`).join('')}</details>`).join('');$('publish').disabled=false;}
async function makePreview(regenerate=false){if(busy)return;busy=true;$('formError').textContent='';$('previewError').textContent='';document.querySelector('.create-button').disabled=true;try{const c=regenerate&&configAtPreview?configAtPreview:config();const d=await NafesTeacher.api('teacher_preview',{config:c,regenerate});showPreview(d);$('previewPanel').scrollIntoView({behavior:'smooth'});}catch(e){$('formError').textContent=e.message;$('previewError').textContent=e.message;}finally{busy=false;document.querySelector('.create-button').disabled=false;}}
form.onsubmit=e=>{e.preventDefault();makePreview();};$('regenerate').onclick=()=>makePreview(true);
$('previewQuestions').onclick=async e=>{const b=e.target.closest('[data-replace]');if(!b||busy)return;busy=true;b.disabled=true;try{showPreview(await NafesTeacher.api('teacher_replace',{draft_id:draft.draft_id,question_id:b.dataset.replace}));$('previewError').textContent='تم تبديل السؤال من البنك نفسه مع الحفاظ على المؤشر.';}catch(e){$('previewError').textContent=e.message;}finally{busy=false;b.disabled=false;}};
$('publish').onclick=async()=>{if(!draft||busy)return;busy=true;$('publish').disabled=true;$('previewError').textContent='';try{const d=await NafesTeacher.api('teacher_publish',{draft_id:draft.draft_id});$('createdLink').value=d.url;$('openLink').href=d.url;$('analysisLink').href='analysis.html?test='+encodeURIComponent(d.id);$('createdSummary').textContent=d.title;$('created').classList.remove('hidden');draft=null;await NafesQR.render($('qr'),d.url);$('created').scrollIntoView({behavior:'smooth'});await loadPublished();}catch(e){$('previewError').textContent=e.message;if(draft)$('publish').disabled=false;}finally{busy=false;}};
$('copyLink').onclick=async()=>{try{await navigator.clipboard.writeText($('createdLink').value);$('copyLink').textContent='تم النسخ';}catch(_){$('createdLink').select();document.execCommand('copy');$('copyLink').textContent='تم تحديد الرابط للنسخ';}};
for(const [id,method]of [['downloadQr','download'],['printQr','print']])$(id).onclick=()=>{try{NafesQR[method]($('qr'),method==='print'?$('createdSummary').textContent:'nafes-qr.png');}catch(e){$('previewError').textContent=e.message;}};
let previousType='custom';document.querySelectorAll('[name=testType]').forEach(x=>x.onchange=()=>{if(!x.checked)return;const p=previousType;previousType=x.value;applyTypeDefaults(p);});
rows().forEach(r=>r.querySelector('.enabled').onchange=selectPanels);$('countMode').onchange=toggleCounts;
$('selectionPanels').oninput=e=>{
 if(e.target.matches('.indicator-search')){const q=e.target.value.trim();e.target.closest('.selection-panel').querySelectorAll('.indicator-option').forEach(x=>x.hidden=!x.textContent.includes(q));return;}
 if(e.target.matches('.indicator-check')&&isSimCustom()&&e.target.checked){const p=e.target.closest('.selection-panel'),checked=p.querySelectorAll('.indicator-check:checked');if(checked.length>6){e.target.checked=false;$('formError').textContent='الحد الأعلى ٦ مؤشرات في المادة الواحدة؛ ١٠ أسئلة لكل مؤشر = ٦٠ سؤالًا.';}}
 const p=e.target.closest('.selection-panel');if(p?.querySelector('.selection-summary'))p.querySelector('.selection-summary').textContent=isSimCustom()?`تم اختيار ${ar(p.querySelectorAll('.indicator-check:checked').length)} من ٦ مؤشرات كحد أقصى · ١٠ أسئلة لكل مؤشر`:`تم اختيار ${ar(p.querySelectorAll('.indicator-check:checked').length)} مؤشرًا`;
 updateSimCounts();
};
$('allowBack').onchange=()=>{if(!$('allowBack').checked)$('onePerPage').checked=true;};form.addEventListener('input',saveDraft);
async function loadPublished(){if(!catalog)return;try{const fresh=await NafesTeacher.api('teacher_catalog');catalog.tests=fresh.tests||catalog.tests;const tests=catalog.tests||[];$('publishedList').innerHTML=tests.length?tests.map(t=>`<article class="published-test"><b>${esc(t.title)}</b><small>${esc(t.class_name||'')} · ${esc(t.short_code||'')} · ${t.kind==='simulation'?'محاكي':'مخصص'}</small><div><a href="analysis.html?test=${encodeURIComponent(t.id)}">تحليل النتائج</a> <button type="button" data-share-code="${esc(t.short_code||'')}">الرابط وQR</button></div></article>`).join(''):'<p>لم تنشر اختبارًا بعد.</p>';}catch(e){$('publishedList').innerHTML=`<p>${esc(e.message)}</p>`;}}
async function load(){if(!NafesTeacher.getKey()){NafesTeacher.requireKey();$('catalogState').textContent='ادخل بمفتاح المعلم لتكوين الاختبارات وإدارة النتائج.';return;}$('catalogState').textContent='جارٍ تحميل المؤشرات وبنوك الأسئلة…';try{catalog=await NafesTeacher.api('teacher_catalog');ensureFullControls();const p=new URLSearchParams(location.search);if(!initialized){if(p.get('mode')==='simulation'||p.get('mode')==='custom-simulation')document.querySelector('[name=testType][value=simulation_custom]').checked=true;if(p.get('mode')==='full')document.querySelector('[name=testType][value=full]').checked=true;if(p.has('s')&&p.has('o')&&p.has('i'))document.querySelector('[name=testType][value=custom]').checked=true;previousType=kind();applyTypeDefaults();if(p.has('s')){rows().forEach(r=>r.querySelector('.enabled').checked=r.dataset.subject===p.get('s'));selectPanels();const key=`${p.get('s')}:${p.get('o')}:i${Number(p.get('i'))}`;const input=[...document.querySelectorAll('.indicator-check')].find(x=>x.value===key);if(input){input.checked=true;if(p.get('m')){$('fixedModel').value=p.get('m');input.closest('label').querySelector('.indicator-count').value=15;const row=rows().find(r=>r.dataset.subject===p.get('s'));row.querySelector('.count').value=15;}}const entry=(catalog.indicators||[]).find(i=>i.key===key);if(entry)$('testTitle').value=`اختبار ${names[entry.subject]} — المؤشر ${p.get('i')}`;}initialized=true;}else selectPanels();const s=simulationSummary();$('catalogState').textContent=`البنك الأساسي: ${ar((catalog.indicators||[]).length)} مؤشرًا · بنك المحاكاة: قراءة ${ar(s.reading||0)}، رياضيات ${ar(s.math||0)}، علوم ${ar(s.science||0)} سؤالًا`;await loadPublished();}catch(e){$('catalogState').textContent=e.message;}}
$('publishedList').onclick=async e=>{const b=e.target.closest('[data-share-code]');if(!b)return;const url='https://zarie19991-bit.github.io/moallimi/e.html?t='+b.dataset.shareCode;try{$('createdLink').value=url;$('openLink').href=url;$('createdSummary').textContent=b.closest('article').querySelector('b').textContent;$('created').classList.remove('hidden');await NafesQR.render($('qr'),url);$('created').scrollIntoView({behavior:'smooth'});}catch(e){$('formError').textContent=e.message;}};
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load();});
restore();ensureFullControls();load();
})();