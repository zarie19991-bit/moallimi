(() => {
'use strict';
const EDGE='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam', $=id=>document.getElementById(id), code=new URLSearchParams(location.search).get('t')||'';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=x=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(x),names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const sessionKey='nafes_session_'+code;let session;try{session=sessionStorage.getItem(sessionKey)||crypto.randomUUID();sessionStorage.setItem(sessionKey,session);}catch(_){session=crypto.randomUUID();}
let info,state,access='',answers={},cursor=0,timer,saving=Promise.resolve(),saveDelay,active=false,lockRelease,locked=false,starting=false,lastEvent=0;
const identityKey='nafes_student_identity_session', demoIdentityKey='nafes_demo_student_identity_v1', legacyIdentityKey='nafes_student_identity', resumeKey='nafes_attempt_'+code, resumeMarkerKey='nafes_attempt_marker_'+code, RESUME_MARKER_MAX_AGE=12*60*60*1000;
try{localStorage.removeItem(legacyIdentityKey);}catch(_){}
async function api(action,body={}){const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),30000);try{const r=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,code,session_id:session,...body}),signal:ctrl.signal});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||'تعذر إتمام الطلب.');return d;}catch(e){throw new Error(e.name==='AbortError'?'تأخر الاتصال. آخر إجاباتك المحفوظة باقية؛ أعد المحاولة.':e.message);}finally{clearTimeout(timeout);}}
function authBody(){return {attempt_id:state?.attempt_id,access_token:access,answers:{...answers},cursor};}
async function claim(){const settings=info?.settings||{};if(settings.lock_session!==true||locked)return true;if(navigator.locks){let resolve;const p=new Promise(r=>resolve=r);navigator.locks.request('nafes:'+code+':'+session,{ifAvailable:true},async lock=>{if(!lock){resolve(false);return;}locked=true;resolve(true);await new Promise(r=>lockRelease=r);});if(!await p)throw new Error('هذا الاختبار مفتوح في تبويب آخر على الجهاز. أكمله هناك.');}return true;}
function saveLocal(){try{if(state?.attempt_id&&access){sessionStorage.setItem(resumeKey,JSON.stringify({attempt_id:state.attempt_id,access_token:access}));localStorage.setItem(resumeMarkerKey,JSON.stringify({attempt_id:state.attempt_id,expires_at:state?.expires_at||'',saved_at:Date.now()}));}}catch(_){} }
function clearResume(){try{sessionStorage.removeItem(resumeKey);localStorage.removeItem(resumeMarkerKey);}catch(_){} }
function readResume(){try{const x=JSON.parse(sessionStorage.getItem(resumeKey)||'null');return x?.attempt_id&&x?.access_token?x:null;}catch(_){return null;}}
function readResumeMarker(){try{const x=JSON.parse(localStorage.getItem(resumeMarkerKey)||'null');if(!x?.attempt_id)return null;const expired=x.expires_at&&Date.now()>new Date(x.expires_at).getTime(),stale=x.saved_at&&Date.now()-Number(x.saved_at)>RESUME_MARKER_MAX_AGE;if(expired||stale){localStorage.removeItem(resumeMarkerKey);return null}return x;}catch(_){return null;}}
function clearIdentity(){try{sessionStorage.removeItem(identityKey);}catch(_){} }
function readDemoIdentity(){try{const d=JSON.parse(sessionStorage.getItem(demoIdentityKey)||'null');return d?.demo===true?d:null;}catch(_){return null;}}
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
async function resumeAttempt(){const saved=readResume();if(!saved)return false;try{await claim();access=saved.access_token;state={attempt_id:saved.attempt_id};const d=await api('assessment_resume',{attempt_id:saved.attempt_id,access_token:saved.access_token});state={...state,...d};access=d.access_token||access;answers=d.answers||{};cursor=d.cursor||0;saveLocal();if(state.submitted){showResult(state);}else{render();clearInterval(timer);timer=setInterval(tick,1000);}$('message').textContent='';return true;}catch(e){clearResume();lockRelease?.();locked=false;$('message').textContent='تعذر استعادة المحاولة السابقة تلقائيًا. تحقق من بياناتك ثم ادخل الاختبار مرة واحدة.';return false;}}
function save(action='assessment_save',extra={}){const payload={...authBody(),...extra};saving=saving.catch(()=>{}).then(async()=>{if(!active&&action!=='assessment_resume')return state;$('saveState').textContent='جارٍ الحفظ…';const d=await api(action,payload);state={...state,...d};if(d.submitted){answers=d.answers||answers;showResult(d);}else {if(d.current_section!==undefined&&(d.current_section!==currentSection||d.cursor!==cursor&&action==='assessment_advance')){answers=d.answers||answers;cursor=d.cursor||0;render();}}$('saveState').textContent='تم الحفظ';$('playerError').textContent='';return d;}).catch(e=>{$('saveState').textContent='لم يكتمل الحفظ';$('playerError').textContent=e.message;throw e;});return saving;}
let currentSection=0;
function remaining(){const s=state.sections[state.current_section];return Math.min(new Date(state.expires_at).getTime(),new Date(state.section_started_at).getTime()+s.duration_minutes*60000)-Date.now();}
function tick(){if(!active)return;const wait=new Date(state.section_started_at).getTime()-Date.now();if(wait>0){$('player').hidden=true;$('breakPanel').hidden=false;$('breakText').textContent=`يبدأ القسم التالي بعد ${ar(Math.ceil(wait/1000))} ثانية.`;return;}if(!$('breakPanel').hidden){$('breakPanel').hidden=true;$('player').hidden=false;render();}const left=remaining();$('timer').textContent=`${String(Math.max(0,Math.floor(left/60000))).padStart(2,'0')}:${String(Math.max(0,Math.floor(left/1000)%60)).padStart(2,'0')}`;if(left<=0){clearInterval(timer);save('assessment_advance').then(()=>{if(active){cursor=state.cursor||0;render();timer=setInterval(tick,1000);}}).catch(()=>{timer=setInterval(tick,1000);});}}
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
function showResult(d){
 active=false;clearInterval(timer);clearResume();clearIdentity();document.body.classList.remove('exam-active','no-copy','watermarked','print-blocked');
 lockRelease?.();locked=false;$('intro').hidden=true;$('player').hidden=true;$('breakPanel').hidden=true;$('result').hidden=false;
 const percent=d.result_hidden?'':`<div class="result-score-box"><div class="score">${ar(d.percent)}٪</div><p class="score-sub">الدرجة الكلية: ${ar(d.score)} من ${ar(d.total)}</p></div>`;
 const secList=Array.isArray(d.section_scores)?d.section_scores:(d.sections?.map(s=>({subject:s.subject,score:s.score,total:s.total,percent:s.percent}))||[]);
 const secBreakdown=(secList.length>1)?`<div class="sections-breakdown-box" style="margin:16px 0;background:#f8fbf9;border:1px solid #d8ece4;border-radius:12px;padding:14px;"><h3 style="margin:0 0 10px;font-size:14px;color:#0f514c;">تفصيل نتائج المواد الدراسية</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">${secList.map(s=>`<div style="background:#fff;border:1px solid #e1ede8;border-radius:10px;padding:10px;text-align:center;"><b style="color:#17324d;display:block;margin-bottom:4px;font-size:13px;">${esc(names[s.subject]||s.subject)}</b><div style="font-size:16px;font-weight:900;color:#0f514c;">${ar(s.percent!=null?s.percent:(s.total?(s.score/s.total)*100:0))}٪</div><small style="color:#687a83;font-size:11px;">الدرجة: ${ar(s.score)} من ${ar(s.total)}</small></div>`).join('')}</div></div>`:'';
 const trainingLink=code?`<a class="custom-training-link" href="training.html?t=${encodeURIComponent(code)}"><span>🎯</span><span><b>تدريبك المخصص</b><small>تدريب مستقل مبني على مؤشرات نتيجتك</small></span></a>`:'';
 $('result').innerHTML=`<div class="completion-container"><div class="completion-badge">✓</div><h1>${d.completed_before?'سبق تسليم هذا الاختبار':'تم تسليم الاختبار بنجاح'}</h1><div class="completion-student-info"><b>${esc(d.student_name||state?.student_name||'')}</b><span>${esc(info?.title||state?.title||'اختبار نافس')}</span></div>${percent}${secBreakdown}<p class="completion-msg">${d.completed_before?'تم التحقق من بياناتك وعرض محاولتك المكتملة؛ لن تبدأ محاولة جديدة تلقائيًا.':(d.result_hidden?'حُفظت إجاباتك بنجاح في سجلات المعلم.':'تم حفظ نتيجة أدائك في الاختبار بنجاح.')}</p>${trainingLink}${d.correct_count!==undefined?`<div class="correct-summary">الإجابات الصحيحة: ${ar(d.correct_count)} من أصل ${ar(d.total||d.sections?.flatMap(s=>s.questions)?.length||15)}</div>`:''}${d.indicators?.length?`<div class="indicators-summary"><h3>المؤشرات المقاسة</h3><table><thead><tr><th>المؤشر</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>${d.indicators.map(i=>`<tr><td>${esc(i.text)}</td><td>${ar(i.percent)}٪</td><td>${level(i.percent)}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`;
 $('saveState').textContent='تم تسليم المحاولة وحفظها';
}
$('identity').onsubmit=async e=>{
 e.preventDefault();if(starting)return;
 const name=$('studentName').value.trim();
 const no=normalizeDigits($('studentNo').value.trim()).replace(/\D/g,'').slice(0,3);
 const cls=($('className')?.value||'').trim();
 if(!name||name.length<3){$('message').textContent='يرجى إدخال اسم الطالب كاملًا.';return;}
 if(no.length!==3){$('message').textContent='يرجى إدخال آخر ٣ أرقام من الهوية الوطنية بدقة (٣ أرقام).';return;}
 if(!cls){$('message').textContent='يرجى إدخال الفصل كما هو في كشف المدرسة.';return;}
 starting=true;const btn=$('startBtn')||e.submitter;btn.disabled=true;$('message').textContent='';
 try{
  await claim();
  state=await api('assessment_start',{student_name:name,student_no:no,national_id_last3:no,class_name:cls});
  access=state.access_token||'';answers=state.answers||{};cursor=state.cursor||0;
  try{sessionStorage.setItem(identityKey,JSON.stringify({name,class:cls}));}catch(_){}
  saveLocal();
  if(state.submitted)showResult(state);
  else{render();clearInterval(timer);timer=setInterval(tick,1000);}
 }catch(e){$('message').textContent=e.message;lockRelease?.();locked=false;}
 finally{btn.disabled=false;starting=false;}
};
$('studentNo')?.addEventListener('input',e=>{e.target.value=normalizeDigits(e.target.value).replace(/\D/g,'').slice(0,3);});
$('questions').onchange=e=>{if(!e.target.matches('input[type=radio]'))return;const id=e.target.closest('[data-question]').dataset.question;answers[id]=Number(e.target.value);e.target.closest('.choices').querySelectorAll('.choice').forEach(x=>x.classList.toggle('selected',x.querySelector('input').checked));clearTimeout(saveDelay);saveDelay=setTimeout(()=>save().catch(()=>{}),350);$('progress').querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('answered',answers[state.sections[currentSection].questions[Number(b.dataset.go)].id]!==undefined));};
async function navigate(n){if(!active)return;clearTimeout(saveDelay);const prior=cursor;cursor=n;try{await save();render();$('questions').scrollIntoView({behavior:'smooth',block:'start'});}catch(_){cursor=prior;}}
$('next').onclick=()=>navigate(cursor+1);$('prev').onclick=()=>navigate(cursor-1);$('progress').onclick=e=>{const b=e.target.closest('[data-go]');if(b&&state.settings.allow_back)navigate(Number(b.dataset.go));};
$('review').onclick=()=>{const s=state.sections[currentSection];const unanswered=s.questions.map((q,i)=>answers[q.id]===undefined?i:null).filter(i=>i!==null);if(unanswered.length){if(confirm(`لم تجب عن ${ar(unanswered.length)} سؤالًا. الانتقال إلى أول سؤال دون إجابة؟`))navigate(unanswered[0]);}else alert('أجبت عن جميع أسئلة القسم. يمكنك تسليمه.');};
$('finish').onclick=async()=>{const remaining=state.sections[currentSection].questions.filter(q=>answers[q.id]===undefined).length;if(!confirm(`${remaining?`بقي ${ar(remaining)} سؤالًا دون إجابة. `:''}هل تريد تسليم ${currentSection===state.sections.length-1?'الاختبار':'هذا القسم والانتقال للتالي'}؟`))return;$('finish').disabled=true;try{await save(currentSection===state.sections.length-1?'assessment_finish':'assessment_advance');cursor=state.cursor||0;if(active)render();}catch(_){}finally{$('finish').disabled=false;}};
function event(type){if(!active||!state.settings.log_visibility||Date.now()-lastEvent<500)return;lastEvent=Date.now();save('assessment_event',{event:{type}}).catch(()=>{});}
for(const type of ['copy','cut','dragstart','selectstart'])document.addEventListener(type,e=>{if(active&&!state.settings.allow_copy&&e.target.closest('#questions')){e.preventDefault();event('copy_blocked');}});
document.addEventListener('contextmenu',e=>{if(active&&state.settings.disable_right_click){e.preventDefault();event('copy_blocked');}});
document.addEventListener('keydown',e=>{if(!active)return;const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&((state.settings.disable_shortcuts&&['c','x','s','a'].includes(key))||(state.settings.disable_print&&key==='p'))){e.preventDefault();event(key==='p'?'print_blocked':'copy_blocked');}});
document.addEventListener('visibilitychange',()=>event(document.hidden?'hidden':'visible'));addEventListener('beforeprint',()=>{if(active&&state.settings.disable_print)event('print_blocked');});
addEventListener('pagehide',()=>{if(active){navigator.sendBeacon(EDGE,new Blob([JSON.stringify({action:'assessment_event',code,session_id:session,...authBody(),event:{type:'page_leave'}})],{type:'application/json'}));}lockRelease?.();});
setInterval(()=>{if(active)save().catch(()=>{});},15000);setInterval(watermark,10000);
$('calcButton').onclick=()=>$('calculator').showModal();$('calcClose').onclick=()=>$('calculator').close();$('calcGo').onclick=()=>{const a=Number($('calcA').value),b=Number($('calcB').value),op=$('calcOp').value;const v=op==='+'?a+b:op==='−'?a-b:op==='×'?a*b:b===0?NaN:a/b;$('calcResult').textContent=Number.isFinite(v)?ar(v):'لا يمكن القسمة على صفر';};
(async()=>{try{info=await api('assessment_info');if(info.legacy_url){location.replace(info.legacy_url);return;}$('code').textContent=code;$('title').textContent=info.title;$('details').textContent=[info.school_name,info.class_name,info.teacher_name].filter(Boolean).join(' · ');$('sections').innerHTML=info.sections.map(s=>`<p>${names[s.subject]}: ${ar(s.question_count)} سؤالًا · ${ar(s.duration_minutes)} دقيقة</p>`).join('');const configuredSection=classSection(info.class_name);$('className').value=configuredSection||'';$('className').readOnly=!!configuredSection;const demoMode=restoreIdentity();if(demoMode)clearResume();const resumeMarker=demoMode?null:readResumeMarker();if(!demoMode&&info.identity_mode==='email'){const label=document.querySelector('label[for="studentNo"]');if(label)label.textContent='البريد المدرسي *';$('studentNo').type='email';$('studentNo').removeAttribute('maxlength');$('studentNo').removeAttribute('pattern');}if(await resumeAttempt())return;if(resumeMarker?.attempt_id&&!demoMode)$('message').textContent='توجد محاولة سابقة سارية على هذا الجهاز. أدخل بياناتك نفسها للتحقق واستئنافها.';$('identity').hidden=false;if(demoMode){$('message').textContent='جارٍ فتح الاختبار بالحساب التجريبي…';queueMicrotask(()=>$('identity').requestSubmit());}}catch(e){$('title').textContent='تعذر فتح الاختبار';$('message').textContent=e.message;}})();
})();