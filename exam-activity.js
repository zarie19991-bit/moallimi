/* Observations from the student's browser, not proof of intent or attention. */
(()=>{'use strict';
window.NafesActivity={create(options){
 let id='',section=0,last=performance.now(),visible=!document.hidden,running=false,queue=[],sending=false,seqTimer;
 const key=()=>`nafes_activity_v1_${id}`;
 const persist=()=>{try{sessionStorage.setItem(key(),JSON.stringify(queue.slice(-1000)))}catch(_){}};
 function sample(type='pulse',status=null){
  if(!id||!running)return;
  const now=performance.now(),delta=Math.max(0,now-last);last=now;
  // A suspended browser is not counted as observed activity.
  const ms=visible&&options.isActive()&&delta<=45000?Math.round(delta):0;
  queue.push({id:crypto.randomUUID(),type,section,at:new Date(options.now?options.now():Date.now()).toISOString(),visible_ms:ms,status});persist();flush();
 }
 async function flush(beacon=false){
  if(!id||sending||!queue.length||!navigator.onLine)return;
  const payload=options.payload();if(!payload)return;
  if(beacon){try{navigator.sendBeacon(options.url,new Blob([JSON.stringify({...payload,timing_events:queue.slice(0,10)})],{type:'application/json'}))}catch(_){}return;}
  sending=true;
  try{for(let n=0;n<10&&queue.length;n++){const batch=queue.slice(0,10),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);let r;try{r=await fetch(options.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,timing_events:batch}),signal:controller.signal,keepalive:true});}finally{clearTimeout(timeout)}if(!r.ok)break;const sent=new Set(batch.map(x=>x.id));queue=queue.filter(x=>!sent.has(x.id));persist();}}catch(_){}finally{sending=false;if(queue.length)setTimeout(()=>flush(),30000);}
 }
 function update(attemptId,nextSection=0){
  if(!attemptId)return;
  if(id!==attemptId){id=attemptId;section=nextSection;try{queue=JSON.parse(sessionStorage.getItem(key())||'[]')}catch(_){queue=[]}if(!Array.isArray(queue))queue=[];running=true;last=performance.now();sample('entry');clearInterval(seqTimer);seqTimer=setInterval(()=>sample(),30000);}
  else if(section!==nextSection){sample('section');section=nextSection;last=performance.now();}
 }
 document.addEventListener('visibilitychange',()=>{sample(document.hidden?'hidden':'visible');visible=!document.hidden;last=performance.now();});
 addEventListener('offline',()=>sample('offline'));addEventListener('online',()=>{sample('online');flush()});
 addEventListener('pagehide',()=>{sample('page_leave');flush(true)});
 addEventListener('nafes:edge-retry',e=>{const d=e.detail||{};if(['retry','failed'].includes(d.phase)&&!['assessment_timing','timing','assessment_delivery_event'].includes(d.action))sample(d.status>=500?'server_error':'request_failed',d.status||null)});
 addEventListener('error',()=>sample('client_error'));addEventListener('unhandledrejection',()=>sample('client_error'));
 return {update,event:sample,stop(){sample('result');running=false;clearInterval(seqTimer);flush()},failure(status){sample(status>=500?'server_error':'request_failed',status||null)}};
}};
})();
