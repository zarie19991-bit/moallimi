(()=>{
'use strict';
if(window.__NAFES_EDGE_RETRY_V2__)return;
window.__NAFES_EDGE_RETRY_V2__=true;
const nativeFetch=window.fetch.bind(window);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const RETRYABLE=new Set([408,425,429,500,502,503,504,520,522,524]);
const CRITICAL=new Set(['assessment_save','assessment_advance','assessment_finish','save','finish']);
const TELEMETRY=new Set(['assessment_delivery_event']);
const emit=(phase,detail={})=>{
  try{window.dispatchEvent(new CustomEvent('nafes:edge-retry',{detail:{phase,...detail}}));}catch(_){}
};
function parseAction(init){
  try{return typeof init?.body==='string'?String(JSON.parse(init.body)?.action||''):'';}catch(_){return'';}
}
function retryAfterMs(response,attempt){
  const raw=response?.headers?.get?.('Retry-After');
  if(raw){
    const seconds=Number(raw);
    if(Number.isFinite(seconds)&&seconds>=0)return Math.min(10000,seconds*1000);
    const date=Date.parse(raw);
    if(Number.isFinite(date))return Math.max(0,Math.min(10000,date-Date.now()));
  }
  const base=[350,800,1600,3000,5000][Math.min(attempt,4)]||5000;
  return base+Math.floor(Math.random()*260);
}
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const isNafesEdge=url.includes('/functions/v1/nafes-exam')&&String(init?.method||'GET').toUpperCase()==='POST';
  if(!isNafesEdge)return nativeFetch(input,init);

  const action=parseAction(init);
  const telemetry=TELEMETRY.has(action);
  const maxAttempts=telemetry?1:(CRITICAL.has(action)?5:3);
  const started=performance.now();
  let response,lastError;

  for(let attempt=0;attempt<maxAttempts;attempt++){
    try{
      response=await nativeFetch(input,init);
      if(!RETRYABLE.has(response.status)){
        if(attempt>0&&!telemetry)emit('recovered',{
          action,attempt:attempt+1,status:response.status,
          latency_ms:Math.round(performance.now()-started)
        });
        return response;
      }
      lastError=null;
      if(attempt<maxAttempts-1){
        const delay=retryAfterMs(response,attempt);
        if(!telemetry)emit('retry',{
          action,attempt:attempt+1,next_attempt:attempt+2,status:response.status,delay_ms:delay
        });
        await wait(delay);
        continue;
      }
    }catch(error){
      lastError=error;
      if(init?.signal?.aborted||attempt===maxAttempts-1)break;
      const delay=retryAfterMs(null,attempt);
      if(!telemetry)emit('retry',{
        action,attempt:attempt+1,next_attempt:attempt+2,status:0,delay_ms:delay
      });
      await wait(delay);
    }
  }

  if(!telemetry)emit('failed',{
    action,status:response?.status||0,
    latency_ms:Math.round(performance.now()-started),
    attempts:maxAttempts
  });
  if(lastError)throw lastError;
  return response;
};
})();