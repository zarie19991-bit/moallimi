(()=>{
'use strict';
if(window.__NAFES_ADVANCED_STUDENT__)return;
window.__NAFES_ADVANCED_STUDENT__=true;

const EDGE_PART='/functions/v1/nafes-exam';
const code=new URLSearchParams(location.search).get('t')||'';
const nativeFetch=window.fetch.bind(window);
let lastInfo=null,lastAttempt=null,lastReview=null,lastAuth=null,availabilityTimer=null;

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=iso=>new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',dateStyle:'full',timeStyle:'short'}).format(new Date(iso));
function parseBody(init){try{return typeof init?.body==='string'?JSON.parse(init.body):null;}catch{return null;}}
function availability(info){
  const s=info?.settings||{},now=Date.now();
  const opens=s.opens_at?new Date(s.opens_at).getTime():null;
  const closes=s.closes_at?new Date(s.closes_at).getTime():null;
  if(opens&&Number.isFinite(opens)&&now<opens)return{state:'pending',opens,closes};
  if(closes&&Number.isFinite(closes)&&now>=closes)return{state:'closed',opens,closes};
  return{state:'open',opens,closes};
}
function ensureAvailabilityBox(){
  const intro=document.getElementById('intro');if(!intro)return null;
  let box=document.getElementById('availabilityState');
  if(!box){box=document.createElement('div');box.id='availabilityState';box.style.cssText='margin:14px 0;padding:14px 16px;border-radius:14px;font-weight:800;line-height:1.8;border:1px solid #cfe1dd;background:#f5faf8;color:#17324d';const sections=document.getElementById('sections');sections?.after(box);}return box;
}
function applyAvailability(){
  if(!lastInfo)return;
  const a=availability(lastInfo),form=document.getElementById('identity'),btn=document.getElementById('startBtn'),msg=document.getElementById('message'),box=ensureAvailabilityBox();
  if(!form||!btn||!msg||!box)return;
  if(a.state==='pending'){
    form.hidden=true;btn.disabled=true;form.dataset.scheduleBlocked='1';
    const text=`لم يبدأ الاختبار بعد. يفتح يوم ${fmt(lastInfo.settings.opens_at)}${a.closes?` ويغلق يوم ${fmt(lastInfo.settings.closes_at)}`:''}.`;
    box.textContent=text;box.style.background='#fff8e8';box.style.borderColor='#efd69c';box.style.color='#77520b';msg.textContent=text;
  }else if(a.state==='closed'){
    form.hidden=true;btn.disabled=true;form.dataset.scheduleBlocked='1';
    const text=`هذا الاختبار مغلق منذ ${fmt(lastInfo.settings.closes_at)}.`;
    box.textContent=text;box.style.background='#fff1f1';box.style.borderColor='#e8b7b7';box.style.color='#8b2525';msg.textContent=text;
  }else{
    if(form.dataset.scheduleBlocked==='1'){delete form.dataset.scheduleBlocked;form.hidden=false;btn.disabled=false;if(msg.textContent.includes('لم يبدأ الاختبار')||msg.textContent.includes('هذا الاختبار مغلق'))msg.textContent='';}
    const end=lastInfo.settings?.closes_at?` · يغلق ${fmt(lastInfo.settings.closes_at)}`:'';
    box.textContent=`الاختبار متاح الآن${end}`;box.style.background='#eef8f4';box.style.borderColor='#c6e2d7';box.style.color='#155d4f';
  }
}
function captureResponse(action,data,requestBody){
  if(!data||typeof data!=='object')return;
  if(action==='assessment_info'&&!data.error){lastInfo=data;queueMicrotask(applyAvailability);setTimeout(applyAvailability,0);}
  if(action&&action.startsWith('assessment_')){
    if(requestBody?.attempt_id||requestBody?.access_token)lastAuth={...requestBody};
    if(data.sections)lastAttempt={...(lastAttempt||{}),...data};
    if(Array.isArray(data.review)){lastReview=data.review;lastAttempt={...(lastAttempt||{}),...data};setTimeout(renderCorrectAnswers,0);}
  }
}
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input?.url||'');
  const requestBody=url.includes(EDGE_PART)?parseBody(init):null;
  const action=requestBody?.action||null;
  const response=await nativeFetch(input,init);
  if(action&&url.includes(EDGE_PART)){
    response.clone().json().then(data=>captureResponse(action,data,requestBody)).catch(()=>{});
  }
  return response;
};
function questionMap(){
  const map=new Map();
  for(const s of lastAttempt?.sections||[])for(const q of s.questions||[])map.set(String(q.id),q);
  return map;
}
function renderCorrectAnswers(){
  if(!lastReview?.length)return;
  const result=document.getElementById('result');if(!result||result.hidden)return;
  if(document.getElementById('advancedCorrectAnswers'))return;
  const map=questionMap();
  const wrap=document.createElement('section');wrap.id='advancedCorrectAnswers';wrap.dir='rtl';wrap.style.cssText='margin-top:22px;border-top:1px solid #dce8e4;padding-top:18px';
  wrap.innerHTML=`<h2 style="font-size:18px;margin:0 0 12px;color:#0f514c">مراجعة الإجابات الصحيحة</h2><div style="display:grid;gap:12px">${lastReview.map((r,i)=>{const q=map.get(String(r.id));const correct=q?.options?.[r.correct_index];const chosen=lastAttempt?.answers?.[r.id];const chosenText=Number.isInteger(chosen)?q?.options?.[chosen]:null;return `<article style="border:1px solid #dce8e4;border-radius:14px;padding:14px;background:#fbfdfc"><b style="display:block;margin-bottom:8px">${i+1}) ${esc(q?.question||r.indicator_text||'السؤال')}</b>${chosenText!==null&&chosenText!==undefined?`<p style="margin:4px 0">إجابتك: ${esc(chosenText)}</p>`:''}<p style="margin:4px 0;color:#116149"><strong>الإجابة الصحيحة:</strong> ${esc(correct??'')}</p>${r.explanation?`<p style="margin:6px 0 0;color:#50646b;line-height:1.8">${esc(r.explanation)}</p>`:''}</article>`;}).join('')}</div>`;
  result.appendChild(wrap);
}
function watchDom(){
  const form=document.getElementById('identity');if(form)new MutationObserver(()=>applyAvailability()).observe(form,{attributes:true,attributeFilter:['hidden']});
  const result=document.getElementById('result');if(result)new MutationObserver(()=>renderCorrectAnswers()).observe(result,{childList:true,subtree:false,attributes:true,attributeFilter:['hidden']});
  if(availabilityTimer)clearInterval(availabilityTimer);availabilityTimer=setInterval(applyAvailability,15000);
}
function init(){watchDom();setTimeout(applyAvailability,0);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
