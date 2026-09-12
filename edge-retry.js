(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const emit=(phase,detail={})=>{
  try{window.dispatchEvent(new CustomEvent('nafes:edge-retry',{detail:{phase,...detail}}));}catch(_){ }
};
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const isNafesEdge=url.includes('/functions/v1/nafes-exam')&&String(init?.method||'GET').toUpperCase()==='POST';
  if(!isNafesEdge)return nativeFetch(input,init);
  let response,lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      response=await nativeFetch(input,init);
      if(![502,503,504].includes(response.status)){
        if(attempt>0)emit('recovered',{attempt:attempt+1,status:response.status});
        return response;
      }
      lastError=null;
      if(attempt<2){
        emit('retry',{attempt:attempt+1,next_attempt:attempt+2,status:response.status});
        await wait((attempt===0?350:850)+Math.floor(Math.random()*220));
      }
    }catch(error){
      lastError=error;
      if(init?.signal?.aborted||attempt===2)break;
      emit('retry',{attempt:attempt+1,next_attempt:attempt+2,status:0});
      await wait((attempt===0?350:850)+Math.floor(Math.random()*220));
    }
  }
  emit('failed',{status:response?.status||0});
  if(lastError)throw lastError;
  return response;
};
})();
