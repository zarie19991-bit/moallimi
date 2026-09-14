(()=>{
'use strict';
const $=id=>document.getElementById(id);
const panels={overview:'overviewView',subject:'subjectView',subjectReport:'subjectReportView',report:'reportView'};
let activeView='overview';
let enforcing=false;
const ALL_GRADE_LABEL='الثالث متوسط (أ - ب - ج - د)';
const DUPLICATE_MEASURED_LABEL='عدد الطلاب ذوي الدرجات المقاسة';
let readabilityLink=null,previousReadabilityMedia='',analysisPrintMode=false;

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

function replaceAllClassesLabels(){
  ['overviewClass','subjectClass','reportSubjectClass'].forEach(id=>{
    const select=$(id); if(!select)return;
    const all=[...select.options].find(o=>o.value==='');
    if(all)all.textContent=ALL_GRADE_LABEL;
  });
}

function semesterText(value){return value==='second'?'الفصل الدراسي الثاني':'الفصل الدراسي الأول';}
function semesterForSheet(sheet){
  if(sheet.closest('#subjectOfficialPreview')||sheet.closest('#subjectView'))return $('subjectSemester')?.value||'first';
  return $('overviewSemester')?.value||'first';
}
function applySemesterToSheets(root=document){
  root.querySelectorAll?.('.official-analysis-sheet').forEach(sheet=>{
    const term=sheet.querySelector('.sar-meta > div:nth-child(2) b');
    if(term)term.textContent=semesterText(semesterForSheet(sheet));
    const grade=sheet.querySelector('.sar-meta > div:nth-child(1) b');
    if(grade&&/كل الفصول/.test(grade.textContent||''))grade.textContent='الثالث متوسط';
  });
}
function removeDuplicateMeasuredCount(root=document){
  root.querySelectorAll?.('.official-analysis-sheet .sar-stat-list>div').forEach(row=>{
    if((row.querySelector('span')?.textContent||'').trim()===DUPLICATE_MEASURED_LABEL)row.remove();
  });
}
function ensureAnalysisPrintSignatureCss(){
  if(document.getElementById('analysisPrintSignaturesCss'))return;
  const link=document.createElement('link');
  link.id='analysisPrintSignaturesCss';
  link.rel='stylesheet';
  link.href='analysis-print-signatures-first-page.css?v=20260914-4';
  document.head.appendChild(link);
}
function ensureAnalysisPrintScaleTune(){
  if(document.getElementById('analysisPrintScaleTune'))return;
  const style=document.createElement('style');
  style.id='analysisPrintScaleTune';
  style.textContent='@media print{#printRoot .official-analysis-sheet,.print-root .official-analysis-sheet{zoom:.80!important}}';
  document.head.appendChild(style);
}
function findReadabilityLink(){
  return [...document.querySelectorAll('link[rel="stylesheet"]')].find(link=>String(link.href||'').includes('report-readability.css'))||null;
}
function enterAnalysisPrintMode(){
  removeDuplicateMeasuredCount(document);
  ensureAnalysisPrintSignatureCss();
  ensureAnalysisPrintScaleTune();
  readabilityLink=findReadabilityLink();
  if(readabilityLink&&!analysisPrintMode){
    previousReadabilityMedia=readabilityLink.getAttribute('media')||'';
    readabilityLink.setAttribute('media','screen');
    analysisPrintMode=true;
  }
}
function leaveAnalysisPrintMode(){
  if(readabilityLink&&analysisPrintMode){
    if(previousReadabilityMedia)readabilityLink.setAttribute('media',previousReadabilityMedia);
    else readabilityLink.removeAttribute('media');
  }
  readabilityLink=null;
  previousReadabilityMedia='';
  analysisPrintMode=false;
}
function bindAnalysisPrintFidelity(){
  ['printOverviewAnalysisBtn','printSubjectAnalysisBtn'].forEach(id=>$(id)?.addEventListener('click',enterAnalysisPrintMode,true));
}
function addSemesterSelect(toolbar,id){
  if(!toolbar||$(id))return;
  const label=document.createElement('label');
  label.className='analysis-semester-control';
  label.innerHTML=`<span>الفصل الدراسي</span><select id="${id}"><option value="first">الفصل الدراسي الأول</option><option value="second">الفصل الدراسي الثاني</option></select>`;
  const firstButton=toolbar.querySelector('button');
  toolbar.insertBefore(label,firstButton||null);
  label.querySelector('select').addEventListener('change',()=>{
    applySemesterToSheets(document);
    const preview=id==='overviewSemester'?$('overviewOfficialPreview'):$('subjectOfficialPreview');
    if(preview)applySemesterToSheets(preview);
  });
}
function installSemesterControls(){
  addSemesterSelect(document.querySelector('#overviewView .toolbar'),'overviewSemester');
  addSemesterSelect(document.querySelector('#subjectView .toolbar'),'subjectSemester');
  replaceAllClassesLabels();
  applySemesterToSheets(document);
  removeDuplicateMeasuredCount(document);
}

function install(){
  ensureAnalysisPrintSignatureCss();
  ensureAnalysisPrintScaleTune();
  document.querySelectorAll('.main-tab').forEach(b=>{
    b.onclick=e=>{e.preventDefault();show(b.dataset.view);};
  });
  show(document.querySelector('.main-tab.active')?.dataset.view||'overview');
  installSemesterControls();
  bindAnalysisPrintFidelity();

  const nav=document.querySelector('.main-tabs');
  if(nav){
    const observer=new MutationObserver(()=>{
      if(enforcing)return;
      const current=document.querySelector('.main-tab.active')?.dataset.view;
      if(current!==activeView)setTimeout(()=>show(activeView),0);
    });
    observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  }

  const sheetObserver=new MutationObserver(mutations=>{
    let changed=false;
    for(const m of mutations){
      for(const n of m.addedNodes){
        if(n.nodeType===1&&(n.matches?.('.official-analysis-sheet')||n.querySelector?.('.official-analysis-sheet'))){changed=true;break;}
      }
      if(changed)break;
    }
    if(changed)queueMicrotask(()=>{applySemesterToSheets(document);removeDuplicateMeasuredCount(document);});
  });
  sheetObserver.observe(document.body,{childList:true,subtree:true});
  addEventListener('beforeprint',()=>{applySemesterToSheets(document);removeDuplicateMeasuredCount(document);});
  addEventListener('afterprint',leaveAnalysisPrintMode);

  $('refreshBtn')?.addEventListener('click',()=>setTimeout(()=>{show(activeView);installSemesterControls();bindAnalysisPrintFidelity();},500));
  addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)setTimeout(()=>{show(activeView);installSemesterControls();bindAnalysisPrintFidelity();},500)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
