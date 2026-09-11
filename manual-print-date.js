(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

function installField(){
  if($('manualPrintDate')) return;
  const label=document.createElement('label');
  label.className='manual-date-control';
  label.innerHTML='<span>التاريخ</span><input id="manualPrintDate" type="date" lang="ar-SA" dir="rtl" autocomplete="off" title="اختر التاريخ من التقويم">';

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
function displayValue(){
  const raw=value();
  if(!raw)return'';
  const parts=raw.split('-').map(Number);
  if(parts.length!==3||parts.some(n=>!Number.isFinite(n)))return raw;
  const [y,m,d]=parts;
  const dt=new Date(y,m-1,d);
  try{
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab',{day:'2-digit',month:'2-digit',year:'numeric'}).format(dt);
  }catch(_){return `${d}/${m}/${y}`;}
}

function applyDate(root){
  const d=displayValue();
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
  if(!value()){
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    alert('اختر التاريخ من التقويم قبل الطباعة.');
    $('manualPrintDate')?.focus();
    return;
  }
  requestAnimationFrame(()=>applyDate($('printRoot')));
}

function init(){
  installField();
  const input=$('manualPrintDate');
  input?.addEventListener('input',syncPreview);
  input?.addEventListener('change',syncPreview);
  input?.addEventListener('click',()=>{try{input.showPicker?.()}catch(_){}});
  document.addEventListener('click',validatePrint,true);
  window.addEventListener('beforeprint',()=>{
    applyDate($('printRoot'));
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
