(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

function installField(){
  if($('manualPrintDate')) return;
  const label=document.createElement('label');
  label.className='manual-date-control';
  label.innerHTML='<span>التاريخ</span><input id="manualPrintDate" type="text" autocomplete="off" placeholder="اكتب التاريخ بنفسك">';

  const reportControls=document.querySelector('#reportView .report-controls');
  if(reportControls){
    const build=$('buildReportBtn');
    reportControls.insertBefore(label,build||null);
    return;
  }

  const papersToolbar=document.querySelector('#papersDashboard .toolbar');
  if(papersToolbar){
    papersToolbar.appendChild(label);
  }
}

function value(){return String($('manualPrintDate')?.value||'').trim();}

function applyDate(root){
  const d=value();
  if(!root||!d)return;
  root.querySelectorAll('.manual-print-date-line').forEach(x=>x.remove());
  root.querySelectorAll('.report-sheet').forEach(sheet=>{
    const line=document.createElement('div');
    line.className='manual-print-date-line';
    line.innerHTML=`<span>التاريخ</span><b>${E(d)}</b>`;
    const title=sheet.querySelector('.report-title,.wr-title-pill,.wr-subtitle');
    if(title){title.insertAdjacentElement('afterend',line)}
    else{
      const head=sheet.querySelector('.report-head,.wr-topbar');
      if(head)head.insertAdjacentElement('afterend',line); else sheet.prepend(line);
    }
  });
}

function syncPreview(){
  applyDate($('reportPreview'));
  applyDate($('paperPanel'));
}

function validatePrint(e){
  const btn=e.target.closest?.('#printReportBtn,#printPaperBtn');
  if(!btn)return;
  if(value())return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  alert('اكتب التاريخ بنفسك قبل الطباعة.');
  $('manualPrintDate')?.focus();
}

function observePrintRoot(){
  const root=$('printRoot');
  if(!root)return;
  const mo=new MutationObserver(()=>applyDate(root));
  mo.observe(root,{childList:true,subtree:true});
}

function init(){
  installField();
  $('manualPrintDate')?.addEventListener('input',syncPreview);
  document.addEventListener('click',validatePrint,true);
  window.addEventListener('beforeprint',()=>{
    const root=$('printRoot');
    if(root)applyDate(root);
  });
  observePrintRoot();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
