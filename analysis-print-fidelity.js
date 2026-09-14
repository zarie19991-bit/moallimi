(()=>{
'use strict';
const DUPLICATE_LABEL='عدد الطلاب ذوي الدرجات المقاسة';
let readabilityLink=null;
let previousMedia='';
let printModeActive=false;

function removeDuplicateMeasuredCount(root=document){
  root.querySelectorAll('.official-analysis-sheet .sar-stat-list>div').forEach(row=>{
    const label=row.querySelector('span')?.textContent?.trim()||'';
    if(label===DUPLICATE_LABEL)row.remove();
  });
}

function findReadabilityLink(){
  return [...document.querySelectorAll('link[rel="stylesheet"]')].find(link=>String(link.href||'').includes('report-readability.css'))||null;
}

function enterAnalysisPrintMode(){
  removeDuplicateMeasuredCount(document);
  readabilityLink=findReadabilityLink();
  if(readabilityLink&&!printModeActive){
    previousMedia=readabilityLink.getAttribute('media')||'';
    readabilityLink.setAttribute('media','screen');
    printModeActive=true;
  }
}

function leaveAnalysisPrintMode(){
  if(readabilityLink&&printModeActive){
    if(previousMedia)readabilityLink.setAttribute('media',previousMedia);
    else readabilityLink.removeAttribute('media');
  }
  readabilityLink=null;
  previousMedia='';
  printModeActive=false;
}

function bindPrintButton(id){
  document.getElementById(id)?.addEventListener('click',enterAnalysisPrintMode,true);
}

function init(){
  bindPrintButton('printOverviewAnalysisBtn');
  bindPrintButton('printSubjectAnalysisBtn');
  removeDuplicateMeasuredCount(document);
  new MutationObserver(()=>removeDuplicateMeasuredCount(document)).observe(document.body,{childList:true,subtree:true});
  addEventListener('beforeprint',()=>removeDuplicateMeasuredCount(document));
  addEventListener('afterprint',leaveAnalysisPrintMode);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
