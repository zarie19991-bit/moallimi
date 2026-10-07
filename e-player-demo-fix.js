(() => {
'use strict';
const EDGE='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam', $=id=>document.getElementById(id), params=new URLSearchParams(location.search), code=params.get('t')||'', demoAccessCode=params.get('demo_code')||'';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=x=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(x),names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const sessionKey='nafes_session_'+code;let session;try{session=sessionStorage.getItem(sessionKey)||crypto.randomUUID();sessionStorage.setItem(sessionKey,session);}catch(_){session=crypto.randomUUID();}
let info,state,access='',answers={},cursor=0,timer,saving=Promise.resolve(),saveDelay,active=false,lockRelease,locked=false,starting=false,lastEvent=0,telemetryFlushing=false,finalRetrying=false,pendingStart=null,lastIdentity={name:'',class:''};
const identityKey='nafes_student_identity_session', demoIdentityKey='nafes_demo_student_identity_v1', legacyIdentityKey='nafes_student_identity', resumeKey='nafes_attempt_'+code, resumeMarkerKey='nafes_attempt_marker_'+code, draftKey='nafes_draft_v2_'+code, deliveryQueueKey='nafes_delivery_queue_v1_'+code, RESUME_MARKER_MAX_AGE=12*60*60*1000;
try{localStorage.removeItem(legacyIdentityKey);}catch(_){}
async function api(action,body={}){const ctrl=new AbortController(),timeoutMs=action==='assessment_finish'||action==='assessment_advance'?60000:action==='assessment_save'?45000:30000,timeout=setTimeout(()=>ctrl.abort(),timeoutMs);try{const r=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,code,session_id:session,...body}),signal:ctrl.signal});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||'تعذر إتمام الطلب.');return d;}catch(e){throw new Error(e.name==='AbortError'?'تأخر الاتصال. إجاباتك محفوظة على الجهاز وسيعاد إرسالها تلقائيًا عند استقرار الاتصال.':e.message);}finally{clearTimeout(timeout);}}
function authBody(){return {attempt_id:state?.attempt_id,access_token:access,answers:{...answers},cursor};}
async function claim(){const settings=info?.settings||{};if(settings.lock_session!==true||locked)return true;if(navigator.locks){let resolve;const p=new Promise(r=>resolve=r);navigator.locks.request('nafes:'+code+':'+session,{ifAvailable:true},async lock=>{if(!lock){resolve(false);return;}locked=true;resolve(true);await new Promise(r=>lockRelease=r);});if(!await p)throw new Error('هذا الاختبار مفتوح في تبويب آخر على الجهاز. أكمله هناك.');}return true;}
function readDraft(){
 try{
  const d=JSON.parse(localStorage.getItem(draftKey)||'null');
  if(!d?.attempt_id)return null;
  const stale=Date.now()-Number(d.saved_at||0)>RESUME_MARKER_MAX_AGE;
  const expired=d.expires_at&&Date.now()>new Date(d.expires_at).getTime()+5*60*1000;
  if(stale||expired){localStorage.removeItem(draftKey);return null;}
  return d;
 }catch(_){return null;}
}
function writeDraft(extra={}){
 try{
  if(!state?.attempt_id)return;
  const old=readDraft()||{};
  const record={
    ...old,
    attempt_id:state.attempt_id,
    answers:{...answers},
    cursor,
    current_section:state.current_section||0,
    expires_at:state.expires_at||old.expires_at||'',
    server_version:state.version||old.server_version||0,
    saved_at:Date.now(),
    ...extra
  };
  localStorage.setItem(draftKey,JSON.stringify(record));
  window.NafesDurableStore?.put(draftKey,record).catch(()=>{});
 }catch(_){}
}
function clearDraft(){try{localStorage.removeItem(draftKey);}catch(_){}window.NafesDurableStore?.remove(draftKey).catch(()=>{});}
async function readDurableDraft(){
 const local=readDraft();
 if(local)return local;
 try{
  const d=await window.NafesDurableStore?.get(draftKey);
  if(!d?.attempt_id)return null;
  const stale=Date.now()-Number(d.saved_at||0)>RESUME_MARKER_MAX_AGE;
  const expired=d.expires_at&&Date.now()>new Date(d.expires_at).getTime()+5*60*1000;
  if(stale||expired){window.NafesDurableStore?.remove(draftKey).catch(()=>{});return null;}
  try{localStorage.setItem(draftKey,JSON.stringify(d));}catch(_){}
  return d;
 }catch(_){return null;}
}
async function restoreDraft(){
 const d=await readDurableDraft();
 if(!d||!state?.attempt_id||d.attempt_id!==state.attempt_id)return null;
 const localAnswers=d.answers&&typeof d.answers==='object'?d.answers:{};
 const before=JSON.stringify(answers);
 answers={...answers,...localAnswers};
 if(Number(d.current_section)===Number(state.current_section)&&Number.isInteger(Number(d.cursor)))cursor=Math.max(0,Number(d.cursor));
 if(JSON.stringify(answers)!==before)queueDeliveryEvent('draft_restored',{action_name:'indexeddb_restore'});
 return d;
}
function readDeliveryQueue(){try{const q=JSON.parse(localStorage.getItem(deliveryQueueKey)||'[]');return Array.isArray(q)?q.slice(-100):[];}catch(_){return[];}}
function writeDeliveryQueue(q){try{localStorage.setItem(deliveryQueueKey,JSON.stringify(q.slice(-100)));}catch(_){}}
function queueDeliveryEvent(event_type,detail={}){
 if(!state?.attempt_id||!access)return;
 const q=readDeliveryQueue();
 q.push({
   client_event_id:crypto.randomUUID(),
   attempt_id:state.attempt_id,
   event_type,
   occurred_at:new Date().toISOString(),
   network_online:navigator.onLine,
   action_name:String(detail.action_name||detail.action||'').slice(0,40)||null,
   retry_count:Number.isFinite(Number(detail.retry_count??detail.attempt))?Number(detail.retry_count??detail.attempt):null,
   status_code:Number.isFinite(Number(detail.status_code??detail.status))?Number(detail.status_code??detail.status):null,
   latency_ms:Number.isFinite(Number(detail.latency_ms))?Number(detail.latency_ms):null
 });
 writeDeliveryQueue(q);
 flushDeliveryEvents();
}
async function flushDeliveryEvents(){
 if(telemetryFlushing||!access||!state?.attempt_id||!navigator.onLine)return;
 telemetryFlushing=true;
 try{
  let q=readDeliveryQueue(),guard=0;
  while(q.length&&guard<20&&access&&state?.attempt_id){
   guard++;
   const ev=q[0];
   if(ev.attempt_id!==state.attempt_id){q.shift();writeDeliveryQueue(q);continue;}
   try{
    const r=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      action:'assessment_delivery_event',code,session_id:session,attempt_id:state.attempt_id,access_token:access,...ev
    })});
    if(!r.ok)break;
    q.shift();writeDeliveryQueue(q);
   }catch(_){break;}
  }
 }finally{telemetryFlushing=false;}
}
function markFinishIntent(){
 writeDraft({finish_requested:true,finish_requested_at:Date.now()});
 queueDeliveryEvent('submit_intent',{action_name:'assessment_finish'});
}
async function retryPendingFinish(){
 const d=readDraft();
 if(finalRetrying||!active||!navigator.onLine||!d?.finish_requested||d.attempt_id!==state?.attempt_id)return;
 finalRetrying=true;
 try{
  $('saveState').textContent='جارٍ إعادة إرسال التسليم تلقائيًا…';
  await save('assessment_finish');
 }catch(_){
  $('saveState').textContent='التسليم محفوظ على الجهاز وسيعاد تلقائيًا عند عودة الاتصال';
 }finally{finalRetrying=false;}
}

function saveLocal(){try{if(state?.attempt_id&&access){sessionStorage.setItem(resumeKey,JSON.stringify({attempt_id:state.attempt_id,access_token:access}));localStorage.setItem(resumeMarkerKey,JSON.stringify({attempt_id:state.attempt_id,expires_at:state?.expires_at||'',saved_at:Date.now()}));writeDraft();}}catch(_){} }
function clearResume(){try{sessionStorage.removeItem(resumeKey);localStorage.removeItem(resumeMarkerKey);}catch(_){} }
function readResume(){try{const x=JSON.parse(sessionStorage.getItem(resumeKey)||'null');return x?.attempt_id&&x?.access_token?x:null;}catch(_){return null;}}
function readResumeMarker(){try{const x=JSON.parse(localStorage.getItem(resumeMarkerKey)||'null');if(!x?.attempt_id)return null;const expired=x.expires_at&&Date.now()>new Date(x.expires_at).getTime(),stale=x.saved_at&&Date.now()-Number(x.saved_at)>RESUME_MARKER_MAX_AGE;if(expired||stale){localStorage.removeItem(resumeMarkerKey);return null}return x;}catch(_){return null;}}
function clearIdentity(){try{sessionStorage.removeItem(identityKey);}catch(_){} }
function readDemoIdentity(){try{const d=JSON.parse(sessionStorage.getItem(demoIdentityKey)||'null');return d?.demo===true?d:null;}catch(_){return null;}}
async function resolveDemoIdentity(){
 if(!/^\d{6}$/.test(demoAccessCode))return readDemoIdentity();
 const d=await api('assessment_demo_catalog',{demo_code:demoAccessCode});
 const student=d?.student||{};
 const demo={demo:true,name:student.full_name||'طالب تجريبي',no:String(student.national_id_last3||'000'),class:student.class_name||'أ'};
 try{sessionStorage.setItem(demoIdentityKey,JSON.stringify(demo));}catch(_){}
 return demo;
}
function restoreIdentity(){try{
 const demo=readDemoIdentity();
 const id=demo||JSON.parse(sessionStorage.getItem(identityKey)||'{}');
 $('studentName').value=id.name||'';
 if(id.no)$('studentNo').value=String(id.no).replace(/\D/g,'').slice(0,3);
 if(demo?.class)$('className').value=demo.class;
 else if(!info?.class_name&&id.class)$('className').value=id.class;
 if(demo){
  $('studentName').readOnly=true;$('studentNo').readOnly=true;$('className').readOnly=true;
  if(!document.getElementById('demoStudentNotice')){
   const box=document.createElement('div');box.id='demoStudentNotice';box.setAttribute('role','status');
   box.style.cssText='margin:14px 0;padding:12px 14px;border-radius:12px;background:#fff8df;border:1px solid #ecd487;color:#70510a;font-weight:800;line-height:1.8';
   box.textContent='وضع الطالب التجريبي: جارٍ فتح الاختبار تلقائيًا. هذه المحاولة لا تدخل في التحليل أو التقارير أو عدد المختبرين.';
   $('identity')?.prepend(box);
  }
 }
 return !!demo;
}catch(_){return false;} }
async function resumeAttempt(){const saved=readResume();if(!saved)return false;try{await claim();access=saved.access_token;state={attempt_id:saved.attempt_id};const d=await api('assessment_resume',{attempt_id:saved.attempt_id,access_token:saved.access_token});state={...state,...d};access=d.access_token||access;answers=d.answers||{};cursor=d.cursor||0;const recoveredDraft=await restoreDraft();saveLocal();if(state.submitted){showResult(state);}else{render();clearInterval(timer);timer=setInterval(tick,1000);if(recoveredDraft?.finish_requested)queueMicrotask(retryPendingFinish);}$('message').textContent='';return true;}catch(e){clearResume();lockRelease?.();locked=false;$('message').textContent='تعذر استعادة المحاولة السابقة تلقائيًا. تحقق من بياناتك ثم ادخل الاختبار مرة واحدة.';return false;}}
async function startDemoDirect(){
 if(!/^\d{6}$/.test(demoAccessCode))return false;
 clearResume();
 $('identity').hidden=true;
 $('message').textContent='جارٍ فتح الاختبار بالحساب التجريبي…';
 try{
  await claim();
  state=await api('assessment_start',{demo_code:demoAccessCode});
  access=state.access_token||'';
  answers=state.answers||{};
  cursor=state.cursor||0;
  clearDraft();
  saveLocal();
  if(state.submitted)showResult(state);
  else{render();clearInterval(timer);timer=setInterval(tick,1000);}
  $('message').textContent='';
  return true;
 }catch(e){
  lockRelease?.();locked=false;
  $('message').textContent=e.message||'تعذر فتح الاختبار بالحساب التجريبي.';
  throw e;
 }
}
function save(action='assessment_save',extra={}){
 writeDraft();
 const payload={...authBody(),...extra};
 saving=saving.catch(()=>{}).then(async()=>{
  if(!active&&action!=='assessment_resume')return state;
  $('saveState').textContent=action==='assessment_finish'?'جارٍ تأكيد التسليم مع الخادم…':'جارٍ الحفظ…';
  const d=await api(action,payload);
  state={...state,...d};
  if(d.submitted){
   answers=d.answers||answers;
   showResult(d);
  }else{
   if(d.current_section!==undefined&&(d.current_section!==currentSection||d.cursor!==cursor&&action==='assessment_advance')){
    answers=d.answers||answers;cursor=d.cursor||0;render();
   }
   writeDraft({server_version:d.version||state.version||0});
  }
  $('saveState').textContent='تم الحفظ';
  $('playerError').textContent='';
  flushDeliveryEvents();
  return d;
 }).catch(e=>{
  writeDraft();
  $('saveState').textContent=navigator.onLine?'لم يكتمل الحفظ — ستتم إعادة المحاولة تلقائيًا':'محفوظ على الجهاز — بانتظار الاتصال';
  $('playerError').textContent=e.message;
  throw e;
 });
 return saving;
}
let currentSection=0;
function remaining(){const s=state.sections[state.current_section];return Math.min(new Date(state.expires_at).getTime(),new Date(state.section_started_at).getTime()+s.duration_minutes*60000)-Date.now();}
function tick(){if(!active)return;const wait=new Date(state.section_started_at).getTime()-Date.now();if(wait>0){$('player').hidden=true;$('breakPanel').hidden=false;$('breakText').textContent=`يبدأ القسم التالي بعد ${ar(Math.ceil(wait/1000))} ثانية.`;return;}if(!$('breakPanel').hidden){$('breakPanel').hidden=true;$('player').hidden=false;render();}const left=remaining();$('timer').textContent=`${String(Math.max(0,Math.floor(left/60000))).padStart(2,'0')}:${String(Math.max(0,Math.floor(left/1000)%60)).padStart(2,'0')}`;if(left<=0){clearInterval(timer);const finalSection=Number(state.current_section||0)===state.sections.length-1;if(finalSection)writeDraft({finish_requested:true,finish_requested_at:Date.now(),auto_expiry:true});const action=finalSection?'assessment_finish':'assessment_advance';save(action).then(()=>{if(active){cursor=state.cursor||0;render();timer=setInterval(tick,1000);}}).catch(()=>{timer=setInterval(tick,1000);if(finalSection)setTimeout(retryPendingFinish,4000);});}}
function watermark(){if(!active)return;const time=new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});const text=`${state.student_name} · ${time}`;$('watermark').replaceChildren(...Array.from({length:18},()=>{const el=document.createElement('span');el.textContent=text;return el;}));}
function questionHtml(q,i){return `<article class="question question-card" data-question="${esc(q.id)}">${q.context?`<div class="context">${esc(q.context)}</div>`:''}${window.NafesMedia?.render(q)||''}<p class="stem">${ar(i+1)}) ${esc(q.question)}</p><div class="options choices">${q.options.map((o,n)=>`<label class="option choice ${answers[q.id]===n?'selected':''}"><input type="radio" name="q-${esc(q.id)}" value="${n}" ${answers[q.id]===n?'checked':''}><span class="letter">${['أ','ب','ج','د'][n]}</span><span class="text">${esc(o)}</span></label>`).join('')}</div></article>`;}
function render(){if(state.submitted)return showResult(state);active=true;currentSection=state.current_section||0;const s=state.sections[currentSection],settings=state.settings;cursor=Math.min(cursor,s.questions.length-1);$('intro').hidden=true;$('player').hidden=false;$('result').hidden=true;$('sectionTitle').textContent=`القسم ${ar(currentSection+1)} من ${ar(state.sections.length)} · ${names[s.subject]}`;$('questionTitle').textContent=`السؤال ${ar(cursor+1)} من ${ar(s.questions.length)}`;
 const single=settings.one_per_page||!settings.allow_back;$('questions').innerHTML=single?questionHtml(s.questions[cursor],cursor):s.questions.map(questionHtml).join('');
 $('progress').innerHTML=s.questions.map((q,i)=>`<button type="button" data-go="${i}" class="${answers[q.id]!==undefined?'answered ':''}${i===cursor?'current':''}" ${!settings.allow_back&&i!==cursor?'disabled':''}>${ar(i+1)}</button>`).join('');
 $('prev').hidden=!settings.allow_back||!single;$('prev').disabled=cursor===0;$('next').hidden=!single||cursor===s.questions.length-1;$('review').hidden=!settings.allow_back;$('finish').textContent=currentSection===state.sections.length-1?'تسليم الاختبار':'تسليم القسم';$('calcButton').hidden=!s.calculator;
 document.body.classList.add('exam-active');document.body.classList.toggle('no-copy',!settings.allow_copy);document.body.classList.toggle('watermarked',settings.watermark);document.body.classList.toggle('print-blocked',settings.disable_print);watermark();tick();}
const normalizeDigits=str=>String(str??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
function classSection(v){const raw=String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').replace(/[إآا]/g,'أ');if(['أ','ب','ج','د'].includes(raw))return raw;const m=raw.match(/(?:^|[\s/\\\-()])([أبجد])(?:$|[\s/\\\-()])/);if(m)return m[1];const tail=raw.match(/(?:فصل|شعبة)?\s*([أبجد])$/);return tail?tail[1]:'';}
function level(p){return p>=80?'متقن':p>=70?'قريب من الإتقان':p>=50?'يحتاج دعمًا':'غير متقن';}
const PRE_MESSAGES={
 first:[
  'هذه المحاولة ليست حكمًا عليك؛ هي نقطة بداية لمعرفة ما أتقنته وما الذي سنطوره معًا.',
  'ركز على سؤال واحد في كل مرة. هدفنا أن نرى قدرتك الحقيقية ونبني عليها.',
  'لا تبحث عن الدرجة الكاملة الآن؛ ابحث عن أفضل إجابة تستطيع الوصول إليها بنفسك.'
 ],
 remedial:[
  'المحاولة السابقة أوضحت لنا أين نبدأ. ركز اليوم على {{focus}} وخذ كل سؤال بهدوء.',
  'خطوتك التالية واضحة: {{focus}}. أجب بما تعرفه حتى يكون التدريب مناسبًا لك.'
 ],
 reinforcement:[
  'لديك تقدم في {{strength}}. ركز اليوم أكثر على {{focus}} وفكر في الدليل قبل الاختيار.',
  'أنت قريب من إتقان مهارات أكثر. حافظ على قوتك في {{strength}} وثبت {{focus}}.'
 ],
 enrichment:[
  'لديك أداء قوي في {{strength}}. تحديك اليوم أن تعمق استدلالك في {{focus}}.',
  'استفد من قوتك في {{strength}}، ولا تكتف بالإجابة الصحيحة؛ ابحث عن الدليل الأدق.'
 ]
};
const INTEGRITY_MESSAGES=[
 'إجابتي الصادقة تساعد المنصة على اختيار التدريب المناسب لي.',
 'الهدف معرفة مستواي الحقيقي، وليس الحصول على درجة بأي طريقة.',
 'أفكر وأجيب بنفسي؛ لأن التعلم الحقيقي يبقى معي.',
 'الخطأ الصادق يفيدني أكثر من إجابة صحيحة لم أصل إليها بنفسي.'
];
const MOOD_TIPS={
 steady:'رائع، ابدأ بهدوء وحافظ على تركيزك من سؤال إلى آخر.',
 slight:'خذ شهيقًا هادئًا وزفيرًا ببطء، ثم اقرأ السؤال كاملًا قبل الخيارات.',
 tense:'لا تستعجل. تنفس بهدوء وابدأ بالسؤال الأول فقط؛ ثم انتقل للذي يليه.'
};
function stableHash(value){let h=2166136261;for(const ch of String(value||'')){h=Math.imul(h^ch.charCodeAt(0),16777619);}return (h>>>0).toString(36);}
function pickBySeed(items,seed){if(!items?.length)return'';let n=0;for(const ch of String(seed||''))n=(n*31+ch.charCodeAt(0))>>>0;return items[n%items.length];}
function supportBand(percent){const p=Number(percent);return Number.isFinite(p)?(p>=90?'enrichment':p>=70?'reinforcement':'remedial'):'first';}
function profileKey(name,cls){return 'nafes_growth_profile_v1_'+stableHash(String(name||'').trim().toLowerCase()+'|'+String(cls||'').trim());}
function readGrowthProfile(name,cls){try{const p=JSON.parse(localStorage.getItem(profileKey(name,cls))||'null');if(!p)return null;if(Date.now()-Number(p.saved_at||0)>180*24*60*60*1000){localStorage.removeItem(profileKey(name,cls));return null;}return p;}catch(_){return null;}}
function indicatorLabel(i){return String(i?.text||i?.indicator_text||i?.name||'المهارة المستهدفة').trim();}
function saveGrowthProfile(d){
 if(d?.result_hidden||!Array.isArray(d?.indicators)||!d.indicators.length)return;
 const student=String(d.student_name||state?.student_name||lastIdentity.name||'').trim();
 const cls=String(lastIdentity.class||state?.class_name||info?.class_name||'').trim();
 if(!student)return;
 const ranked=d.indicators.map(i=>({...i,_p:Number(i.percent)})).filter(i=>Number.isFinite(i._p)).sort((a,b)=>b._p-a._p);
 if(!ranked.length)return;
 const percent=Number(d.percent);
 const profile={strength:indicatorLabel(ranked[0]),focus:indicatorLabel(ranked[ranked.length-1]),support:supportBand(percent),saved_at:Date.now()};
 try{localStorage.setItem(profileKey(student,cls),JSON.stringify(profile));}catch(_){}
}
function fillTokens(text,profile){return String(text||'').replaceAll('{{strength}}',profile?.strength||'المهارات التي أتقنتها').replaceAll('{{focus}}',profile?.focus||'المهارة المستهدفة');}
function preMessageFor(payload){
 const profile=readGrowthProfile(payload.name,payload.cls);
 const band=profile?.support||'first';
 const pool=PRE_MESSAGES[band]||PRE_MESSAGES.first;
 return fillTokens(pickBySeed(pool,payload.name+'|'+code+'|'+new Date().toISOString().slice(0,10)),profile);
}
function ensurePreExamGate(){
 let gate=document.getElementById('preExamGate');
 if(gate)return gate;
 gate=document.createElement('div');gate.id='preExamGate';gate.className='pre-exam-gate';gate.hidden=true;gate.setAttribute('role','dialog');gate.setAttribute('aria-modal','true');gate.setAttribute('aria-labelledby','preExamTitle');
 gate.innerHTML='<div class="pre-exam-card"><span class="pre-exam-kicker">🌱 الاستعداد للاختبار</span><h2 id="preExamTitle" tabindex="-1"></h2><p id="preExamMessage" class="pre-exam-message"></p><p id="preExamTip" class="pre-exam-tip"></p><span class="readiness-label">كيف تشعر الآن؟</span><div class="readiness-choices" role="group" aria-label="الاستعداد"><button type="button" class="readiness-choice is-selected" data-mood="steady">😌 مستعد</button><button type="button" class="readiness-choice" data-mood="slight">🙂 متوتر قليلًا</button><button type="button" class="readiness-choice" data-mood="tense">😟 أحتاج هدوءًا</button></div><label class="integrity-box"><input id="integrityCheck" type="checkbox"><span><b>تعهدي بالنزاهة</b><span id="integrityText"></span></span></label><div class="pre-exam-actions"><button type="button" class="pre-exam-start" id="confirmExamStart" disabled>ابدأ الاختبار الآن</button><button type="button" class="pre-exam-edit" id="editIdentity">تعديل بياناتي</button></div></div>';
 document.body.appendChild(gate);
 gate.querySelectorAll('.readiness-choice').forEach(btn=>btn.addEventListener('click',()=>{gate.querySelectorAll('.readiness-choice').forEach(x=>x.classList.remove('is-selected'));btn.classList.add('is-selected');gate.dataset.mood=btn.dataset.mood;$('preExamTip').textContent=MOOD_TIPS[btn.dataset.mood]||MOOD_TIPS.steady;}));
 $('integrityCheck').addEventListener('change',e=>{$('confirmExamStart').disabled=!e.target.checked;});
 $('editIdentity').addEventListener('click',()=>{gate.hidden=true;pendingStart=null;$('startBtn')?.focus();});
 $('confirmExamStart').addEventListener('click',()=>{if(!pendingStart||!$('integrityCheck').checked)return;const payload=pendingStart;const mood=gate.dataset.mood||'steady';pendingStart=null;gate.hidden=true;beginAssessment(payload,mood);});
 return gate;
}
function openPreExamGate(payload){
 const gate=ensurePreExamGate();pendingStart=payload;gate.dataset.mood='steady';
 gate.querySelectorAll('.readiness-choice').forEach(x=>x.classList.toggle('is-selected',x.dataset.mood==='steady'));
 $('integrityCheck').checked=false;$('confirmExamStart').disabled=true;
 const firstName=String(payload.name||'').trim().split(/\s+/)[0]||'طالبنا';
 $('preExamTitle').textContent='جاهز يا '+firstName+'؟';
 $('preExamMessage').textContent=preMessageFor(payload);
 $('preExamTip').textContent=MOOD_TIPS.steady;
 $('integrityText').textContent=pickBySeed(INTEGRITY_MESSAGES,payload.name+'|'+code+'|integrity');
 gate.hidden=false;setTimeout(()=>$('preExamTitle')?.focus?.(),0);
}
async function beginAssessment(payload,mood){
 if(starting)return;starting=true;lastIdentity={name:payload.name,class:payload.cls};
 const btn=$('startBtn');if(btn)btn.disabled=true;$('message').textContent='';
 try{
  try{sessionStorage.setItem('nafes_readiness_'+code,JSON.stringify({mood,recorded_at:Date.now()}));}catch(_){}
  await claim();
  state=await api('assessment_start',{student_name:payload.name,student_no:payload.no,national_id_last3:payload.no,class_name:payload.cls});
  access=state.access_token||'';answers=state.answers||{};cursor=state.cursor||0;
  const recoveredDraft=await restoreDraft();
  try{sessionStorage.setItem(identityKey,JSON.stringify({name:payload.name,class:payload.cls}));}catch(_){}
  saveLocal();
  if(state.submitted)showResult(state);
  else{render();clearInterval(timer);timer=setInterval(tick,1000);if(recoveredDraft?.finish_requested)queueMicrotask(retryPendingFinish);}
 }catch(e){$('message').textContent=e.message;lockRelease?.();locked=false;$('identity').hidden=false;}
 finally{if(btn)btn.disabled=false;starting=false;}
}
function buildGrowthFeedback(d){
 const student=String(d.student_name||state?.student_name||lastIdentity.name||'').trim();
 const firstName=student.split(/\s+/)[0]||'طالبنا';
 if(d?.result_hidden||!Array.isArray(d?.indicators)||!d.indicators.length){
  return '<div class="growth-feedback-card"><div class="growth-label">التعلم أولًا</div><h2>أحسنت يا '+esc(firstName)+' على إكمال المحاولة.</h2><p>إجاباتك الصادقة تساعد معلمك والمنصة على تحديد الخطوة التعليمية المناسبة لك. الهدف هو التحسن من محاولة إلى أخرى، وليس رقمًا واحدًا.</p></div>';
 }
 const ranked=d.indicators.map(i=>({...i,_p:Number(i.percent)})).filter(i=>Number.isFinite(i._p)).sort((a,b)=>b._p-a._p);
 if(!ranked.length)return '';
 const strength=indicatorLabel(ranked[0]),focus=indicatorLabel(ranked[ranked.length-1]),band=supportBand(d.percent);
 let title='',body='';
 if(band==='remedial'){title='عرفنا الآن نقطة البداية يا '+firstName+'.';body='سنركز على <strong>'+esc(focus)+'</strong>. الخطأ الصادق هنا مفيد؛ لأنه يحدد التدريب الذي تحتاجه فعلًا.';}
 else if(band==='reinforcement'){title='تقدم جيد يا '+firstName+'.';body=strength===focus?'أنت قريب من الإتقان. الخطوة التالية هي تثبيت المهارة بالتدريب القصير ثم المحاولة مرة أخرى.':'من نقاط قوتك <strong>'+esc(strength)+'</strong>، والخطوة التالية هي تثبيت <strong>'+esc(focus)+'</strong>.';}
 else{title='أداء متقدم يا '+firstName+'.';body=strength===focus?'أتقنت المهارة بدرجة جيدة؛ تحديك التالي هو أسئلة أعمق تتطلب تفسيرًا واستدلالًا.':'من نقاط قوتك <strong>'+esc(strength)+'</strong>، وتحديك التالي تعميق <strong>'+esc(focus)+'</strong> بأسئلة أعلى مستوى.';}
 return '<div class="growth-feedback-card growth-'+band+'"><div class="growth-label">خطوتك التعليمية التالية</div><h2>'+esc(title)+'</h2><p>'+body+'</p></div>';
}
function showResult(d){
 const growthFeedback=buildGrowthFeedback(d);saveGrowthProfile(d);
 active=false;clearInterval(timer);clearResume();clearIdentity();clearDraft();document.body.classList.remove('exam-active','no-copy','watermarked','print-blocked');
 lockRelease?.();locked=false;$('intro').hidden=true;$('player').hidden=true;$('breakPanel').hidden=true;$('result').hidden=false;
 const percent=d.result_hidden?'':`<div class="result-score-box"><div class="score">${ar(d.percent)}٪</div><p class="score-sub">الدرجة الكلية: ${ar(d.score)} من ${ar(d.total)}</p></div>`;
 const secList=Array.isArray(d.section_scores)?d.section_scores:(d.sections?.map(s=>({subject:s.subject,score:s.score,total:s.total,percent:s.percent}))||[]);
 const secBreakdown=(secList.length>1)?`<div class="sections-breakdown-box" style="margin:16px 0;background:#f8fbf9;border:1px solid #d8ece4;border-radius:12px;padding:14px;"><h3 style="margin:0 0 10px;font-size:14px;color:#0f514c;">تفصيل نتائج المواد الدراسية</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">${secList.map(s=>`<div style="background:#fff;border:1px solid #e1ede8;border-radius:10px;padding:10px;text-align:center;"><b style="color:#17324d;display:block;margin-bottom:4px;font-size:13px;">${esc(names[s.subject]||s.subject)}</b><div style="font-size:16px;font-weight:900;color:#0f514c;">${ar(s.percent!=null?s.percent:(s.total?(s.score/s.total)*100:0))}٪</div><small style="color:#687a83;font-size:11px;">الدرجة: ${ar(s.score)} من ${ar(s.total)}</small></div>`).join('')}</div></div>`:'';
 const receipt=d.submission_receipt?.receipt_no?`<div style="margin:12px 0;padding:10px 12px;border-radius:10px;background:#eef8f4;border:1px solid #c6e2d7;color:#155d4f;font-weight:900">إيصال التسليم: ${esc(d.submission_receipt.receipt_no)} · ${esc(new Date(d.submission_receipt.submitted_at).toLocaleString('ar-SA'))}</div>`:'';
 const trainingLink=code?`<a class="custom-training-link" href="training.html?t=${encodeURIComponent(code)}"><span>🎯</span><span><b>تدريبك المخصص</b><small>تدريب مستقل مبني على مؤشرات نتيجتك</small></span></a>`:'';
 $('result').innerHTML=`<div class="completion-container"><div class="completion-badge">✓</div><h1>${d.completed_before?'سبق تسليم هذا الاختبار':'تم تسليم الاختبار بنجاح'}</h1><div class="completion-student-info"><b>${esc(d.student_name||state?.student_name||'')}</b><span>${esc(info?.title||state?.title||'اختبار نافس')}</span></div>${growthFeedback}${percent}${secBreakdown}${receipt}<p class="completion-msg">${d.completed_before?'تم التحقق من بياناتك وعرض محاولتك المكتملة؛ لن تبدأ محاولة جديدة تلقائيًا.':(d.result_hidden?'حُفظت إجاباتك بنجاح في سجلات المعلم.':'تم حفظ نتيجة أدائك في الاختبار بنجاح.')}</p>${trainingLink}${d.correct_count!==undefined?`<div class="correct-summary">الإجابات الصحيحة: ${ar(d.correct_count)} من أصل ${ar(d.total||d.sections?.flatMap(s=>s.questions)?.length||15)}</div>`:''}${d.indicators?.length?`<div class="indicators-summary"><h3>المؤشرات المقاسة</h3><table><thead><tr><th>المؤشر</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>${d.indicators.map(i=>`<tr><td>${esc(i.text)}</td><td>${ar(i.percent)}٪</td><td>${level(i.percent)}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`;
 $('saveState').textContent='تم تسليم المحاولة وحفظها';
}
$('identity').onsubmit=e=>{
 e.preventDefault();if(starting)return;
 const name=$('studentName').value.trim();
 const no=normalizeDigits($('studentNo').value.trim()).replace(/\D/g,'').slice(0,3);
 const cls=($('className')?.value||'').trim();
 if(!name||name.length<3){$('message').textContent='يرجى إدخال اسم الطالب كاملًا.';return;}
 if(no.length!==3){$('message').textContent='يرجى إدخال آخر ٣ أرقام من الهوية الوطنية بدقة (٣ أرقام).';return;}
 if(!cls){$('message').textContent='يرجى إدخال الفصل كما هو في كشف المدرسة.';return;}
 $('message').textContent='';
 openPreExamGate({name,no,cls});
};
$('studentNo')?.addEventListener('input',e=>{e.target.value=normalizeDigits(e.target.value).replace(/\D/g,'').slice(0,3);});
$('questions').onchange=e=>{if(!e.target.matches('input[type=radio]'))return;const id=e.target.closest('[data-question]').dataset.question;answers[id]=Number(e.target.value);writeDraft();e.target.closest('.choices').querySelectorAll('.choice').forEach(x=>x.classList.toggle('selected',x.querySelector('input').checked));clearTimeout(saveDelay);saveDelay=setTimeout(()=>save().catch(()=>{}),350);$('progress').querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('answered',answers[state.sections[currentSection].questions[Number(b.dataset.go)].id]!==undefined));};
async function navigate(n){if(!active)return;clearTimeout(saveDelay);const prior=cursor;cursor=n;try{await save();render();$('questions').scrollIntoView({behavior:'smooth',block:'start'});}catch(_){cursor=prior;}}
$('next').onclick=()=>navigate(cursor+1);$('prev').onclick=()=>navigate(cursor-1);$('progress').onclick=e=>{const b=e.target.closest('[data-go]');if(b&&state.settings.allow_back)navigate(Number(b.dataset.go));};
$('review').onclick=()=>{const s=state.sections[currentSection];const unanswered=s.questions.map((q,i)=>answers[q.id]===undefined?i:null).filter(i=>i!==null);if(unanswered.length){if(confirm(`لم تجب عن ${ar(unanswered.length)} سؤالًا. الانتقال إلى أول سؤال دون إجابة؟`))navigate(unanswered[0]);}else alert('أجبت عن جميع أسئلة القسم. يمكنك تسليمه.');};
$('finish').onclick=async()=>{const remaining=state.sections[currentSection].questions.filter(q=>answers[q.id]===undefined).length;if(!confirm(`${remaining?`بقي ${ar(remaining)} سؤالًا دون إجابة. `:''}هل تريد تسليم ${currentSection===state.sections.length-1?'الاختبار':'هذا القسم والانتقال للتالي'}؟`))return;const finalSection=currentSection===state.sections.length-1;if(finalSection)markFinishIntent();$('finish').disabled=true;try{await save(finalSection?'assessment_finish':'assessment_advance');cursor=state.cursor||0;if(active)render();}catch(_){if(finalSection)setTimeout(retryPendingFinish,4000);}finally{$('finish').disabled=false;}};
function event(type){if(!active||!state.settings.log_visibility||Date.now()-lastEvent<500)return;lastEvent=Date.now();save('assessment_event',{event:{type}}).catch(()=>{});}
for(const type of ['copy','cut','dragstart','selectstart'])document.addEventListener(type,e=>{if(active&&!state.settings.allow_copy&&e.target.closest('#questions')){e.preventDefault();event('copy_blocked');}});
document.addEventListener('contextmenu',e=>{if(active&&state.settings.disable_right_click){e.preventDefault();event('copy_blocked');}});
document.addEventListener('keydown',e=>{if(!active)return;const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&((state.settings.disable_shortcuts&&['c','x','s','a'].includes(key))||(state.settings.disable_print&&key==='p'))){e.preventDefault();event(key==='p'?'print_blocked':'copy_blocked');}});
document.addEventListener('visibilitychange',()=>event(document.hidden?'hidden':'visible'));addEventListener('beforeprint',()=>{if(active&&state.settings.disable_print)event('print_blocked');});
addEventListener('pagehide',()=>{if(active){writeDraft();navigator.sendBeacon(EDGE,new Blob([JSON.stringify({action:'assessment_event',code,session_id:session,...authBody(),event:{type:'page_leave'}})],{type:'application/json'}));}lockRelease?.();});
addEventListener('offline',()=>{if(active){writeDraft();queueDeliveryEvent('offline',{action_name:'network'});$('saveState').textContent='محفوظ على الجهاز — الاتصال منقطع';}});
addEventListener('online',()=>{if(active){queueDeliveryEvent('online',{action_name:'network'});$('saveState').textContent='عاد الاتصال — جارٍ المزامنة…';flushDeliveryEvents();save().catch(()=>{});retryPendingFinish();}});
addEventListener('nafes:edge-retry',event=>{if(!active)return;const d=event.detail||{};if(d.phase==='retry')queueDeliveryEvent('retry',d);else if(d.phase==='recovered')queueDeliveryEvent('recovered',d);else if(d.phase==='failed')queueDeliveryEvent('request_failed',d);});
setInterval(()=>{if(active)save().catch(()=>{});},15000);setInterval(()=>{if(active&&readDraft()?.finish_requested)retryPendingFinish();},10000);setInterval(watermark,10000);
$('calcButton').onclick=()=>$('calculator').showModal();$('calcClose').onclick=()=>$('calculator').close();$('calcGo').onclick=()=>{const a=Number($('calcA').value),b=Number($('calcB').value),op=$('calcOp').value;const v=op==='+'?a+b:op==='−'?a-b:op==='×'?a*b:b===0?NaN:a/b;$('calcResult').textContent=Number.isFinite(v)?ar(v):'لا يمكن القسمة على صفر';};
(async()=>{try{
 info=await api('assessment_info');
 if(info.legacy_url){const u=new URL(info.legacy_url,location.href);if(/^\d{6}$/.test(demoAccessCode))u.searchParams.set('demo_code',demoAccessCode);location.replace(u.href);return;}
 $('code').textContent=code;
 $('title').textContent=info.title;
 $('details').textContent=[info.school_name,info.class_name,info.teacher_name].filter(Boolean).join(' · ');
 $('sections').innerHTML=info.sections.map(s=>`<p>${names[s.subject]}: ${ar(s.question_count)} سؤالًا · ${ar(s.duration_minutes)} دقيقة</p>`).join('');
 if(/^\d{6}$/.test(demoAccessCode)){await startDemoDirect();return;}
 const configuredSection=classSection(info.class_name);
 $('className').value=configuredSection||'';
 $('className').readOnly=!!configuredSection;
 const demoMode=restoreIdentity();
 if(demoMode)clearResume();
 const resumeMarker=demoMode?null:readResumeMarker();
 if(!demoMode&&info.identity_mode==='email'){
  const label=document.querySelector('label[for="studentNo"]');
  if(label)label.textContent='البريد المدرسي *';
  $('studentNo').type='email';
  $('studentNo').removeAttribute('maxlength');
  $('studentNo').removeAttribute('pattern');
 }
 if(await resumeAttempt())return;
 if(resumeMarker?.attempt_id&&!demoMode)$('message').textContent='توجد محاولة سابقة سارية على هذا الجهاز. أدخل بياناتك نفسها للتحقق واستئنافها.';
 $('identity').hidden=false;
 if(demoMode){$('message').textContent='جارٍ فتح الاختبار بالحساب التجريبي…';queueMicrotask(()=>$('identity').requestSubmit());}
}catch(e){$('title').textContent='تعذر فتح الاختبار';$('message').textContent=e.message;}})();
})();