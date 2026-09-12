(()=>{
'use strict';
const $=id=>document.getElementById(id);
const panels={overview:'overviewView',subject:'subjectView',subjectReport:'subjectReportView',report:'reportView'};
let activeView='overview';
let enforcing=false;

function show(view){
  if(!panels[view])view='overview';
  activeView=view;
  enforcing=true;
  Object.entries(panels).forEach(([key,id])=>{const el=$(id);if(el)el.hidden=key!==view;});
  document.querySelectorAll('.main-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  document.body.dataset.analysisView=view;
  enforcing=false;
  if(view==='subject')setTimeout(()=>$('subjectSelect')?.dispatchEvent(new Event('change',{bubbles:true})),0);
  if(view==='subjectReport')setTimeout(()=>$('reportSubjectSelect')?.dispatchEvent(new Event('change',{bubbles:true})),0);
}

function loadParticipation(){
  if(document.querySelector('script[data-analysis-participation]'))return;
  const script=document.createElement('script');
  script.src='analysis-participation.js?v=20260912-1';
  script.dataset.analysisParticipation='true';
  document.head.appendChild(script);
}

function install(){
  document.querySelectorAll('.main-tab').forEach(b=>{
    // Replace the legacy three-tab onclick handler so there is one router only.
    b.onclick=e=>{e.preventDefault();show(b.dataset.view);};
  });
  show(document.querySelector('.main-tab.active')?.dataset.view||'overview');
  loadParticipation();

  // Legacy data loaders may try to restore the old three-tab state after an async refresh.
  // Keep the user's selected section authoritative.
  const nav=document.querySelector('.main-tabs');
  if(nav){
    const observer=new MutationObserver(()=>{
      if(enforcing)return;
      const current=document.querySelector('.main-tab.active')?.dataset.view;
      if(current!==activeView)setTimeout(()=>show(activeView),0);
    });
    observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  }
  $('refreshBtn')?.addEventListener('click',()=>setTimeout(()=>show(activeView),500));
  addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)setTimeout(()=>show(activeView),500)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();