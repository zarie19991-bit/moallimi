(()=>{
'use strict';
const $=id=>document.getElementById(id);
function settings(){try{return JSON.parse(localStorage.getItem('nafes_school_report_settings_v1')||'{}')}catch{return{}}}
function transform(root){
  const sheet=root?.querySelector?.('.official-analysis-sheet');if(!sheet)return;
  if(!sheet.classList.contains('reference-analysis'))sheet.classList.add('reference-analysis');

  const title=sheet.querySelector(':scope>h1');
  if(title){
    const nextTitle=title.textContent.replace('تقرير نتائج','تحليل نتائج');
    if(title.textContent!==nextTitle)title.textContent=nextTitle;
  }

  const form=sheet.querySelector('.sar-form-no');
  if(form&&form.textContent!=='تحليل نتائج')form.textContent='تحليل نتائج';

  if(!sheet.querySelector('.sar-teacher-band')){
    const s=settings(),band=document.createElement('div');band.className='sar-teacher-band';
    band.innerHTML='<span>معلم المادة:</span><b></b>';
    band.querySelector('b').textContent=s.teacherName||'________________';
    title?.insertAdjacentElement('afterend',band);
  }

  const studentTable=sheet.querySelector('.sar-student-table');
  if(studentTable)studentTable.remove();

  [...root.children].forEach(el=>{if(el!==sheet)el.remove()});
}
function init(){
  const host=$('subjectOfficialReport'),printBtn=$('printSubjectReportBtn');if(!host)return;
  // Subject report HTML is already final; no post-build observer is needed.
  if(printBtn)printBtn.onclick=()=>{transform(host);const sheet=host.querySelector('.official-analysis-sheet');if(!sheet)return;const root=$('printRoot');root.innerHTML=sheet.outerHTML;root.setAttribute('aria-hidden','false');transform(root);requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();