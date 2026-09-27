(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

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

function printDate(){
  const now=new Date();
  try{
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-arab',{
      day:'2-digit',month:'2-digit',year:'numeric'
    }).format(now);
  }catch(_){
    return `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
  }
}

function applyDate(root){
  if(!root)return;
  const d=printDate();
  const selector='.weekly-report.report-sheet,.official-analysis-sheet,.subject-analysis-sheet,.nafes-absence-sheet';
  root.querySelectorAll(selector).forEach(sheet=>{
    sheet.querySelectorAll('.manual-print-date-line').forEach(x=>x.remove());

    const metaBox=sheet.querySelector('.wr-report-meta>div:nth-child(2)');
    const metaDate=metaBox?.querySelector('b');
    if(metaDate){
      const metaLabel=metaBox.querySelector('span');
      if(metaLabel)metaLabel.textContent='تاريخ الطباعة';
      metaDate.textContent=d;
      return;
    }

    const line=document.createElement('div');
    line.className='manual-print-date-line';
    line.setAttribute('data-print-date','auto');
    line.innerHTML=`<span>تاريخ الطباعة</span><b>${E(d)}</b>`;

    const title=sheet.querySelector(':scope > h1,:scope > .wr-title-pill,:scope > h2');
    if(title){
      title.insertAdjacentElement('afterend',line);
      return;
    }
    const head=sheet.querySelector(':scope > .sar-head,:scope > .report-head,:scope > .wr-topbar');
    if(head)head.insertAdjacentElement('afterend',line);
    else sheet.prepend(line);
  });
}

function removeLegacyManualControl(){
  const input=$('manualPrintDate');
  input?.closest('.manual-date-control')?.remove();
}

function init(){
  installPrintReadabilityGuard();
  removeLegacyManualControl();
  window.addEventListener('beforeprint',()=>applyDate($('printRoot')));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
