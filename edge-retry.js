(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const isNafesEdge=url.includes('/functions/v1/nafes-exam')&&String(init?.method||'GET').toUpperCase()==='POST';
  if(!isNafesEdge)return nativeFetch(input,init);
  let response;
  for(let attempt=0;attempt<3;attempt++){
    response=await nativeFetch(input,init);
    if(![502,503,504].includes(response.status))return response;
    if(attempt<2)await wait((attempt===0?350:850)+Math.floor(Math.random()*220));
  }
  return response;
};
})();
