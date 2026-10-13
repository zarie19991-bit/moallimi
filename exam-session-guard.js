(()=>{
'use strict';
if(window.__NAFES_EXAM_SESSION_GUARD__)return;
window.__NAFES_EXAM_SESSION_GUARD__=true;

const EDGE_MARK='/functions/v1/nafes-exam';
const params=new URLSearchParams(location.search);
const code=String(params.get('t')||'').trim();
let unloading=false;
let explicitSubmitUntil=0;

// Keep only a random browser-session id across a tab/browser restart. No student
// name, national-id digits, answers, or access token are persisted here. This
// lets the backend recognise the same browser session immediately after the
// student re-opens the same test, while the student still re-authenticates.
if(code){
  try{
    const persistentKey=`nafes_browser_session_${code}`;
    const sessionKey=`nafes_session_${code}`;
    const maxAge=6*60*60*1000;
    let record=null;
    try{record=JSON.parse(localStorage.getItem(persistentKey)||'null');}catch(_){record=null;}
    if(!record?.id||!record.saved_at||Date.now()-Number(record.saved_at)>maxAge){
      record={id:crypto.randomUUID(),saved_at:Date.now()};
      localStorage.setItem(persistentKey,JSON.stringify(record));
    }
    sessionStorage.setItem(sessionKey,String(record.id));
  }catch(_){}
}

const nativeConfirm=window.confirm.bind(window);
window.confirm=function(message){
  const result=nativeConfirm(message);
  if(result&&/هل تريد تسليم/.test(String(message||''))){
    explicitSubmitUntil=Date.now()+5000;
  }
  return result;
};

addEventListener('beforeunload',()=>{unloading=true;},{capture:true});
addEventListener('pagehide',()=>{unloading=true;},{capture:true});
addEventListener('pageshow',()=>{unloading=false;explicitSubmitUntil=0;});

const previousFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const method=String(init?.method||'GET').toUpperCase();
  if(!url.includes(EDGE_MARK)||method!=='POST'||typeof init?.body!=='string'){
    return previousFetch(input,init);
  }

  let payload;
  try{payload=JSON.parse(init.body);}catch(_){return previousFetch(input,init);}

  // A finish requires confirmation for this exact attempt (or the player's
  // recorded timer expiry). The durable intent survives a slow save and an
  // offline retry; a five-second native-confirm window alone cannot do that.
  // Lifecycle events without an existing intent still only save answers.
  if(payload?.action==='assessment_finish'){
    let intent=null;
    try{intent=JSON.parse(localStorage.getItem(`nafes_draft_v2_${code}`)||'null');}catch(_){}
    const confirmedAttempt=!!payload.attempt_id&&intent?.attempt_id===payload.attempt_id&&intent.finish_requested===true;
    const explicit=!unloading&&(confirmedAttempt||Date.now()<=explicitSubmitUntil);
    explicitSubmitUntil=0;
    if(!explicit){
      payload={...payload,action:'assessment_save'};
      init={...init,body:JSON.stringify(payload)};
    }
  }

  return previousFetch(input,init);
};
})();
