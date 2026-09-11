(()=>{
'use strict';
const $=id=>document.getElementById(id);
function show(view){
 const sr=$('subjectReportView');
 if(sr)sr.hidden=view!=='subjectReport';
 if(view==='subjectReport'){
   $('overviewView')?.setAttribute('hidden','');
   $('subjectView')?.setAttribute('hidden','');
   $('reportView')?.setAttribute('hidden','');
 }
 document.querySelectorAll('.main-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
}
function init(){
 document.querySelectorAll('.main-tab').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
 show(document.querySelector('.main-tab.active')?.dataset.view||'overview');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();