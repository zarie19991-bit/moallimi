(()=>{
'use strict';
if(window.__NAFES_STUDENT_SESSION_RECOVERY__)return;
window.__NAFES_STUDENT_SESSION_RECOVERY__=true;

const params=new URLSearchParams(location.search);
const testCode=params.get('t')||'';
const legacy=[params.get('s')||'',params.get('o')||'',params.get('i')||'',params.get('m')||''].join('|');
const scope=testCode?`assessment:${testCode}`:`legacy:${legacy}`;
const key=`nafes_active_student_${scope}`;
const nativeFetch=window.fetch.bind(window);
let autoTried=false;

function read(){
  try{
    const data=JSON.parse(sessionStorage.getItem(key)||'null');
    if(!data||!data.name||!data.no)return null;
    if(Date.now()-Number(data.saved_at||0)>6*60*60*1000){sessionStorage.removeItem(key);return null;}
    return data;
  }catch(_){return null;}
}
function write(data){
  try{sessionStorage.setItem(key,JSON.stringify({...data,saved_at:Date.now()}));}catch(_){}
}
function clear(){try{sessionStorage.removeItem(key);}catch(_){} }
function parseBody(init){try{return typeof init?.body==='string'?JSON.parse(init.body):null;}catch(_){return null;}}
function identity(body){
  return {
    name:String(body?.student_name||'').trim(),
    no:String(body?.student_no||body?.national_id_last3||'').trim(),
    className:String(body?.class_name||body?.className||'').trim(),
    attempt_id:String(body?.attempt_id||'').trim()
  };
}
function isStart(action){return action==='assessment_start'||action==='start';}
function isFinish(action,data){
  if(action==='assessment_finish'||action==='finish')return true;
  if(action==='assessment_advance'&&data?.submitted)return true;
  return false;
}

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const body=url.includes('/functions/v1/nafes-exam')?parseBody(init):null;
  const action=String(body?.action||'');
  const response=await nativeFetch(input,init);
  if(!action||!url.includes('/functions/v1/nafes-exam'))return response;
  response.clone().json().then(data=>{
    if(!response.ok||data?.error)return;
    if(isStart(action)){
      if(data?.submitted||data?.expired){clear();return;}
      const id=identity(body);
      if(id.name&&id.no)write({...id,attempt_id:String(data?.attempt_id||id.attempt_id||'')});
      return;
    }
    if(isFinish(action,data)){clear();return;}
    if((action==='assessment_save'||action==='save')&&read()){
      const old=read();
      const id=identity(body);
      write({...old,...(id.name?id:{}),attempt_id:String(body?.attempt_id||old?.attempt_id||'')});
    }
  }).catch(()=>{});
  return response;
};

function setValue(id,value){const el=document.getElementById(id);if(el&&value!==undefined&&value!==null&&String(value)!=='')el.value=String(value);}
function visibleForm(){
  const modern=document.getElementById('identity');
  if(modern&&!modern.hidden)return modern;
  const legacyForm=document.getElementById('startForm');
  if(legacyForm&&!legacyForm.classList.contains('hidden'))return legacyForm;
  return null;
}
function tryRecover(){
  if(autoTried)return true;
  const data=read();if(!data)return true;
  const form=visibleForm();if(!form)return false;
  autoTried=true;
  setValue('studentName',data.name);setValue('studentNo',data.no);setValue('className',data.className);
  const msg=document.getElementById('message')||document.getElementById('readiness');
  if(msg)msg.textContent='جارٍ استعادة محاولتك السابقة تلقائيًا…';
  setTimeout(()=>{
    try{form.requestSubmit();}
    catch(_){const btn=form.querySelector('button[type="submit"]');btn?.click();}
  },80);
  return true;
}
function beginRecoveryWatch(){
  const data=read();if(!data)return;
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(tryRecover()||tries>=60)clearInterval(timer);
  },200);
  tryRecover();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',beginRecoveryWatch,{once:true});else beginRecoveryWatch();
addEventListener('pageshow',()=>{if(!autoTried)beginRecoveryWatch();});
})();
