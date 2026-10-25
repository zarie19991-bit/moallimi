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

const fields={report:'manualPrintDate',exam:'manualExamDate',prior:'manualPriorDate'};
function read(key){try{return localStorage.getItem(STORAGE+':'+key)||''}catch{return''}}
function dateValue(key){return String($(fields[key])?.value??read(key)).trim()}
function value(){return dateValue('report')}
function setValue(v){const input=$('manualPrintDate');if(input)input.value=String(v??'');save();apply(document)}
function save(){for(const key of Object.keys(fields)){try{localStorage.setItem(STORAGE+':'+key,dateValue(key))}catch{}}}
function apply(root){
 if(!root)return;
 root.querySelectorAll('[data-manual-exam-date],[data-manual-prior-date]').forEach(el=>{el.textContent=dateValue(el.hasAttribute('data-manual-prior-date')?'prior':'exam')||'—'});
 root.querySelectorAll('[data-manual-report-value]').forEach(el=>{el.textContent=value()||'—'});
 const selector='.weekly-report.report-sheet,.official-analysis-sheet,.subject-analysis-sheet,.nafes-absence-sheet,#reportSheet,.iad-root,.report-sheet';
 root.querySelectorAll(selector).forEach(sheet=>{
  if(sheet.parentElement?.closest(selector))return;
  sheet.querySelectorAll('.manual-print-date-line').forEach(x=>x.remove());
  const box=sheet.querySelector('.wr-report-meta>div[data-manual-print-date]');
  if(box){box.hidden=!value();const b=box.querySelector('b');if(b)b.textContent=value();}
  const entries=[['exam','تاريخ الاختبار'],['report','تاريخ التقرير']].filter(([key])=>dateValue(key)&&!(key==='report'&&(box||sheet.querySelector('[data-manual-report-value]')))&&!(key==='exam'&&sheet.querySelector('[data-manual-exam-date]')));
  if(!entries.length)return;
  const line=document.createElement('div');line.className='manual-print-date-line';
  line.innerHTML=entries.map(([key,label])=>'<span>'+label+'</span><b>'+E(dateValue(key))+'</b>').join('');
  const head=sheet.querySelector(':scope > .report-head,:scope > .sar-head,:scope > .wr-topbar,:scope > h1,:scope > h2');
  if(head)head.insertAdjacentElement('afterend',line);else sheet.prepend(line);
 });
}
function installManualControl(){
 if($('manualPrintDate'))return;
 const host=$('dashboard')||document.querySelector('main');if(!host)return;
 const box=document.createElement('section');box.className='card manual-date-control no-print';
 box.innerHTML='<div class="manual-date-copy"><b>تواريخ التقرير — بإدخالك</b><span>اكتب هجريًا أو ميلاديًا، أو اترك الحقول فارغة. تُحفظ القيم على هذا المتصفح؛ راجعها عند تغيير الاختبار.</span></div>'+Object.entries(fields).map(([key,id])=>'<label><span>'+({report:'تاريخ التقرير',exam:'تاريخ الاختبار',prior:'تاريخ الاختبار السابق (لقياس الأثر)'})[key]+'</span><input id="'+id+'" type="text" maxlength="80" autocomplete="off" placeholder="مثال: ١٩ / ٠٤ / ١٤٤٨هـ"></label>').join('')+'<button id="clearManualPrintDate" type="button">مسح التواريخ</button>';
 host.prepend(box);
 for(const [key,id] of Object.entries(fields)){$(id).value=read(key);$(id).addEventListener('input',()=>{save();apply(document)})}
 $('clearManualPrintDate').onclick=()=>{Object.values(fields).forEach(id=>$(id).value='');save();apply(document)};
}
function init(){
 installPrintReadabilityGuard();installManualControl();apply(document);
 // Observe only generated reports; disconnect while changing date labels to avoid feedback loops.
 const targets=['reportPreview','officialAnalysisPreview','subjectReportPreview','indicatorReportPreview','reportSheet','printRoot','analysisContent','absenceReportPreview'].map($).filter(Boolean);
 const observer=new MutationObserver(()=>{observer.disconnect();apply(document);watch()});
 function watch(){targets.forEach(el=>observer.observe(el,{childList:true,subtree:true}))}watch();
 addEventListener('beforeprint',()=>{observer.disconnect();apply(document);watch()});
}
window.NafesManualPrintDate={value,setValue,apply,examValue:()=>dateValue('exam'),priorValue:()=>dateValue('prior')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
