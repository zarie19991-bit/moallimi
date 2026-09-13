(()=>{
'use strict';
if(window.__NAFES_ADVANCED_TEACHER__)return;
window.__NAFES_ADVANCED_TEACHER__=true;

const RIYADH_OFFSET_MINUTES=180;
function riyadhIso(value){
  const v=String(value||'').trim();
  if(!v)return null;
  const m=v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if(!m)throw new Error('صيغة التاريخ أو الوقت غير صحيحة.');
  const [,ys,mos,ds,hs,mis,ss='0']=m;
  const y=Number(ys),mo=Number(mos),d=Number(ds),h=Number(hs),mi=Number(mis),s=Number(ss);
  const utc=Date.UTC(y,mo-1,d,h,mi,s)-RIYADH_OFFSET_MINUTES*60000;
  const date=new Date(utc);
  if(!Number.isFinite(date.getTime())||date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d)throw new Error('التاريخ المحدد غير صحيح.');
  return date.toISOString();
}
function validateSchedule(opens,closes){
  if(opens&&closes&&new Date(closes).getTime()<=new Date(opens).getTime())throw new Error('وقت الإغلاق يجب أن يكون بعد وقت الفتح.');
  if(closes&&new Date(closes).getTime()<=Date.now())throw new Error('وقت الإغلاق يجب أن يكون في المستقبل.');
}
function annotate(){
  for(const id of ['opensAt','closesAt']){
    const input=document.getElementById(id),label=input?.closest('label');
    if(!label||label.querySelector('[data-riyadh-note]'))continue;
    const note=document.createElement('small');note.dataset.riyadhNote='1';note.textContent='بتوقيت السعودية (الرياض)';note.style.cssText='display:block;margin-top:4px;color:#687a83;font-size:11px';label.appendChild(note);
  }
}
function wrapTeacherApi(){
  const nt=window.NafesTeacher;
  if(!nt?.api||nt.__advancedScheduleWrapped)return !!nt?.__advancedScheduleWrapped;
  const original=nt.api.bind(nt);
  nt.api=async function(action,body={}){
    if(action==='teacher_preview'&&body?.config?.settings){
      const opens=riyadhIso(document.getElementById('opensAt')?.value||'');
      const closes=riyadhIso(document.getElementById('closesAt')?.value||'');
      validateSchedule(opens,closes);
      body={...body,config:{...body.config,settings:{...body.config.settings,opens_at:opens,closes_at:closes}}};
    }
    return original(action,body);
  };
  nt.__advancedScheduleWrapped=true;
  return true;
}

const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  try{
    const url=typeof input==='string'?input:(input?.url||'');
    if(url.includes('/functions/v1/nafes-test-admin')&&String(init?.method||'GET').toUpperCase()==='POST'&&typeof init?.body==='string'){
      const body=JSON.parse(init.body);
      if(body?.action==='update_schedule'){
        const opens=riyadhIso(document.getElementById('manageOpens')?.value||'');
        const closes=riyadhIso(document.getElementById('manageCloses')?.value||'');
        validateSchedule(opens,closes);
        init={...init,body:JSON.stringify({...body,opens_at:opens,closes_at:closes})};
      }
    }
  }catch(error){
    if(error instanceof SyntaxError)return nativeFetch(input,init);
    throw error;
  }
  return nativeFetch(input,init);
};

function init(){annotate();if(!wrapTeacherApi())setTimeout(init,50);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
