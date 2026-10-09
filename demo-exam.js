(()=>{
'use strict';
const EDGE='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search), code=params.get('t')||'', demoCode=params.get('demo_code')||'';
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const ar=x=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const session=crypto.randomUUID();
let state=null,access='',answers={},cursor=0,currentSection=0,timer=null,saving=false;

async function api(action,body={}){
 const r=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,code,session_id:session,...body}),cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw new Error(d.error||'تعذر تنفيذ الطلب.');
 return d;
}
function auth(){return{attempt_id:state?.attempt_id,access_token:access,answers:{...answers},cursor};}
function questionHtml(q,i){return `<article class="question question-card" data-question="${esc(q.id)}">${q.context?`<div class="context">${esc(q.context)}</div>`:''}${window.NafesMedia?.render?.(q)||''}<p class="stem">${ar(i+1)}) ${esc(q.question)}</p><div class="options choices">${(q.options||[]).map((o,n)=>`<label class="option choice ${answers[q.id]===n?'selected':''}"><input type="radio" name="q-${esc(q.id)}" value="${n}" ${answers[q.id]===n?'checked':''}><span class="letter">${['أ','ب','ج','د'][n]}</span><span class="text">${esc(o)}</span></label>`).join('')}</div></article>`;}
function remaining(){const s=state.sections[currentSection];return Math.min(new Date(state.expires_at).getTime(),new Date(state.section_started_at).getTime()+s.duration_minutes*60000)-Date.now();}
function tick(){
 if(!state||state.submitted)return;
 const wait=new Date(state.section_started_at).getTime()-Date.now();
 if(wait>0){$('player').hidden=true;$('breakPanel').hidden=false;$('breakText').textContent=`يبدأ القسم التالي بعد ${ar(Math.ceil(wait/1000))} ثانية.`;return;}
 if(!$('breakPanel').hidden){$('breakPanel').hidden=true;$('player').hidden=false;render();}
 const left=remaining(),m=Math.max(0,Math.floor(left/60000)),s=Math.max(0,Math.floor(left/1000)%60);
 $('timer').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
 if(left<=0){clearInterval(timer);advance().catch(showError);}
}
function watermark(){
 if(!state||state.submitted)return;
 const tm=new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
 const tx=`طالب تجريبي · ${tm}`;
 $('watermark').replaceChildren(...Array.from({length:18},()=>{const e=document.createElement('span');e.textContent=tx;return e;}));
}
function render(){
 if(!state||state.submitted)return;
 currentSection=state.current_section||0;
 const s=state.sections[currentSection];
 cursor=Math.min(cursor,Math.max(0,s.questions.length-1));
 $('intro').hidden=true;$('player').hidden=false;$('result').hidden=true;
 $('sectionTitle').textContent=`القسم ${ar(currentSection+1)} من ${ar(state.sections.length)} · ${names[s.subject]||s.subject}`;
 $('questionTitle').textContent=`السؤال ${ar(cursor+1)} من ${ar(s.questions.length)}`;
 $('questions').innerHTML=questionHtml(s.questions[cursor],cursor);
 $('progress').innerHTML=s.questions.map((q,i)=>`<button type="button" data-go="${i}" class="${answers[q.id]!==undefined?'answered ':''}${i===cursor?'current':''}">${ar(i+1)}</button>`).join('');
 $('prev').disabled=cursor===0;
 $('next').hidden=cursor>=s.questions.length-1;
 $('finish').textContent=currentSection===state.sections.length-1?'تسليم الاختبار':'تسليم القسم';
 $('questions').querySelectorAll('input[type=radio]').forEach(inp=>inp.onchange=()=>{answers[inp.closest('[data-question]').dataset.question]=Number(inp.value);render();save().catch(()=>{});});
 $('progress').querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{cursor=Number(b.dataset.go);render();});
 $('prev').onclick=()=>{if(cursor>0){cursor--;render();}};
 $('next').onclick=()=>{if(cursor<s.questions.length-1){cursor++;render();}};
 $('review').onclick=()=>{const u=s.questions.findIndex(q=>answers[q.id]===undefined);if(u>=0){cursor=u;render();}else alert('أجبت عن جميع أسئلة القسم.');};
 $('finish').onclick=()=>advance().catch(showError);
 watermark();
}
async function save(action='assessment_save'){
 if(saving||!state||state.submitted)return;
 saving=true;$('saveState').textContent='جارٍ الحفظ…';
 try{
  const d=await api(action,auth());state={...state,...d};answers=d.answers||answers;cursor=d.cursor??cursor;
  if(d.submitted)showResult(d); else if(action==='assessment_advance')render();
  $('saveState').textContent='تم الحفظ';
 }finally{saving=false;}
}
async function advance(){
 const s=state.sections[currentSection],left=s.questions.filter(q=>answers[q.id]===undefined).length;
 if(!confirm(`${left?`بقي ${ar(left)} سؤالًا دون إجابة. `:''}هل تريد ${currentSection===state.sections.length-1?'تسليم الاختبار':'تسليم القسم والانتقال للتالي'}؟`))return;
 await save(currentSection===state.sections.length-1?'assessment_finish':'assessment_advance');
}
function showResult(d){
 clearInterval(timer);state={...state,...d,submitted:true};$('intro').hidden=true;$('player').hidden=true;$('breakPanel').hidden=true;$('result').hidden=false;
 $('result').innerHTML=`<div class="completion-container"><div class="completion-badge">✓</div><h1>تم إنهاء المحاولة التجريبية</h1><p>هذه المحاولة لا تدخل في التحليل أو التقارير أو عدد المختبرين.</p>${d.percent!==undefined?`<div class="result-score"><b>${ar(d.percent)}٪</b></div>`:''}</div>`;
}
function showError(e){$('playerError').textContent=e?.message||String(e||'تعذر تنفيذ العملية.');}
async function init(){
 if(!code||!/^\d{6}$/.test(demoCode)){location.replace('student-demo.html');return;}
 try{
  const info=await api('assessment_info');
  if(info.legacy_url){const u=new URL(info.legacy_url,location.href);u.searchParams.set('demo_code',demoCode);location.replace(u.href);return;}
  $('code').textContent=code;$('title').textContent=info.title;$('details').textContent=[info.school_name,info.class_name,info.teacher_name].filter(Boolean).join(' · ');
  $('sections').innerHTML=(info.sections||[]).map(s=>`<p>${names[s.subject]||s.subject}: ${ar(s.question_count)} سؤالًا · ${ar(s.duration_minutes)} دقيقة</p>`).join('');
  $('identity').hidden=true;$('identity').style.display='none';
  $('message').textContent='جارٍ فتح الاختبار بالحساب التجريبي…';
  state=await api('assessment_start',{demo_code:demoCode});
  access=state.access_token||'';answers=state.answers||{};cursor=state.cursor||0;
  $('message').textContent='';
  if(state.submitted)showResult(state);else{render();timer=setInterval(tick,1000);setInterval(watermark,10000);}
 }catch(e){$('title').textContent='تعذر فتح الاختبار التجريبي';$('message').textContent=e.message||'تعذر فتح الاختبار.';}
}
addEventListener('pagehide',()=>{if(state&&!state.submitted&&access){try{navigator.sendBeacon(EDGE,new Blob([JSON.stringify({action:'assessment_event',code,session_id:session,...auth(),event:{type:'page_leave'}})],{type:'application/json'}));}catch(_){}}});
init();
})();