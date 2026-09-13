(()=>{
'use strict';
const test=document.getElementById('paperTest');
const indicators=document.getElementById('indicatorSelect');
if(!test||!indicators)return;
function preferFirstIndicator(){
  if(!test.value)return;
  const options=[...indicators.options];
  const first=options.find(o=>o.value&&o.value!=='__all__');
  if(!first)return;
  if(indicators.value==='__all__'||!indicators.value){
    indicators.value=first.value;
    indicators.dispatchEvent(new Event('change',{bubbles:true}));
  }
}
test.addEventListener('change',()=>setTimeout(preferFirstIndicator,0));
})();
