(()=>{
'use strict';
const test=document.getElementById('paperTest');
const indicators=document.getElementById('indicatorSelect');
if(!test||!indicators)return;
function preferFullPaper(){
  if(!test.value)return;
  const all=[...indicators.options].find(o=>o.value==='__all__');
  if(!all)return;
  if(indicators.value!=='__all__'){
    indicators.value='__all__';
    indicators.dispatchEvent(new Event('change',{bubbles:true}));
  }
}
test.addEventListener('change',()=>setTimeout(preferFullPaper,0));
})();
