(()=>{
'use strict';
function cleanSchoolLogoSlot(root=document){
  if(!root||!root.querySelectorAll)return;
  root.querySelectorAll('.wr-school').forEach(slot=>{
    [...slot.childNodes].forEach(node=>{
      if(node.nodeType===1 && node.classList?.contains('wr-logo-card')) return;
      node.remove();
    });
    const card=slot.querySelector('.wr-logo-card');
    if(!card)return;
    card.removeAttribute('title');
    card.querySelectorAll('.wr-school-name,.school-name,figcaption,small,strong,p,[data-school-caption]').forEach(el=>el.remove());
  });
}
function cleanAll(){
  cleanSchoolLogoSlot(document.getElementById('reportPreview'));
  cleanSchoolLogoSlot(document.getElementById('printRoot'));
}
function init(){
  const preview=document.getElementById('reportPreview');
  const printRoot=document.getElementById('printRoot');
  if(preview)new MutationObserver(()=>queueMicrotask(()=>cleanSchoolLogoSlot(preview))).observe(preview,{childList:true,subtree:true,characterData:true});
  if(printRoot)new MutationObserver(()=>queueMicrotask(()=>cleanSchoolLogoSlot(printRoot))).observe(printRoot,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',e=>{
    if(e.target?.id==='buildReportBtn'||e.target?.id==='printReportBtn')setTimeout(cleanAll,0);
  },true);
  addEventListener('beforeprint',cleanAll);
  cleanAll();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
