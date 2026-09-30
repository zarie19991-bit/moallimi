(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE='nafes_manual_print_date_v2';

function installPrintReadabilityGuard(){
  if($('nafesPrintReadabilityGuard'))return;
  const style=document.createElement('style');
  style.id='nafesPrintReadabilityGuard';
  style.textContent=`@media print{
    #printRoot .weekly-report.report-sheet,
    #printRoot .nafes-absence-sheet,
    #printRoot .official-analysis-sheet,
    #printRoot .subject-analysis-sheet{
      height:auto!important;min-height:0!important;max-height:none!important;
      overflow:visible!important;font-size:12pt!important;line-height:1.5!important;
    }
    #printRoot .weekly-report.report-sheet table th,
    #printRoot .weekly-report.report-sheet table td,
    #printRoot .nafes-absence-sheet table th,
    #printRoot .nafes-absence-sheet table td,
    #printRoot .official-analysis-sheet table th,
    #printRoot .official-analysis-sheet table td,
    #printRoot .subject-analysis-sheet table th,
    #printRoot .subject-analysis-sheet table td{
      font-size:12pt!important;line-height:1.5!important;
      border:.4mm solid #52666d!important;padding:2mm!important;
      color:#182b32!important;background:#fff!important;
    }
    #printRoot .weekly-report.report-sheet table th,
    #printRoot .nafes-absence-sheet table th,
    #printRoot .official-analysis-sheet table th,
    #printRoot .subject-analysis-sheet table th{
      background:#e4ecee!important;font-weight:800!important;
    }
    #printRoot .wr-follow-sheet .wr-student-name,
    #printRoot .wr-follow-sheet .wr-student-class,
    #printRoot .wr-follow-sheet .wr-student-ind,
    #printRoot .wr-follow-sheet .wr-student-ind *,
    #printRoot .wr-more-note,
    #printRoot .wr-remedial,
    #printRoot .wr-remedial table,
    #printRoot .wr-remedial th,
    #printRoot .wr-remedial td{
      font-size:11.5pt!important;line-height:1.45!important;
    }
    #printRoot .wr-remedial th,
    #printRoot .wr-remedial td,
    #printRoot .wr-follow-sheet .wr-student-ind{
      border-color:#52666d!important;
    }
    #printRoot tr{break-inside:avoid!important;page-break-inside:avoid!important;}
  }`;
  document.head.appendChild(style);
}

function storedValue(){
  try{return localStorage.getItem(STORAGE)||'';}catch(_){return'';}
}
function value(){
  const input=$('manualPrintDate');
  return String(input?input.value:storedValue()).trim();
}
function setValue(v){
  const text=String(v??'').trim();
  try{localStorage.setItem(STORAGE,text);}catch(_){}
  const input=$('manualPrintDate');
  if(input&&input.value!==text)input.value=text;
  apply(document);
}
function apply(root){
  if(!root)return;
  const d=value();
  const selector='.weekly-report.report-sheet,.official-analysis-sheet,.subject-analysis-sheet,.nafes-absence-sheet';
  root.querySelectorAll(selector).forEach(sheet=>{
    sheet.querySelectorAll('.manual-print-date-line').forEach(x=>x.remove());

    const meta=document.querySelector ? sheet.querySelector('.wr-report-meta') : null;
    const metaBox=sheet.querySelector('.wr-report-meta>div[data-manual-print-date],.wr-report-meta>div:nth-child(2)');
    const metaDate=metaBox?.querySelector('b');
    if(metaDate){
      const metaLabel=metaBox.querySelector('span');
      if(metaLabel&&metaLabel.textContent!=='التاريخ')metaLabel.textContent='التاريخ';
      metaBox.classList.toggle('manual-print-date-hidden',!d);
      meta?.classList.toggle('manual-print-date-empty',!d);
      metaDate.textContent=d;
      return;
    }

    if(!d)return;

    const line=document.createElement('div');
    line.className='manual-print-date-line';
    line.setAttribute('data-print-date','manual');
    line.innerHTML=`<span>تاريخ الطباعة</span><b>${E(d)}</b>`;

    const title=sheet.querySelector(':scope > h1,:scope > .wr-title-pill,:scope > h2');
    if(title){title.insertAdjacentElement('afterend',line);return;}
    const head=sheet.querySelector(':scope > .sar-head,:scope > .report-head,:scope > .wr-topbar');
    if(head)head.insertAdjacentElement('afterend',line);
    else sheet.prepend(line);
  });
}
function installManualControl(){
  if($('manualPrintDate'))return;
  const dashboard=$('dashboard');
  if(!dashboard)return;
  const tabs=dashboard.querySelector('.main-tabs');
  const box=document.createElement('section');
  box.className='card manual-date-control no-print';
  box.innerHTML=`
    <div class="manual-date-copy">
      <b>تاريخ الطباعة</b>
      <span>يدوي فقط — لن تضع المنصة تاريخ اليوم تلقائيًا.</span>
    </div>
    <label>
      <span>اكتب التاريخ كما تريد</span>
      <input id="manualPrintDate" type="text" inputmode="text" autocomplete="off" placeholder="مثال: ١٩ / ٠٤ / ١٤٤٨هـ">
    </label>
    <button id="clearManualPrintDate" type="button">مسح التاريخ</button>`;
  if(tabs)tabs.insertAdjacentElement('afterend',box);else dashboard.prepend(box);
  const input=$('manualPrintDate');
  input.value=storedValue();
  input.addEventListener('input',()=>{
    try{localStorage.setItem(STORAGE,input.value.trim());}catch(_){}
    apply(document);
  });
  $('clearManualPrintDate').addEventListener('click',()=>setValue(''));
}

function init(){
  installPrintReadabilityGuard();
  installManualControl();
  apply(document);
  window.addEventListener('beforeprint',()=>apply(document));
}

window.NafesManualPrintDate={value,setValue,apply};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();