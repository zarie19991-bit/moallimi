(()=>{
'use strict';
const $=id=>document.getElementById(id);
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function settings(){try{return JSON.parse(localStorage.getItem('nafes_school_report_settings_v1')||'{}')}catch(_){return{}}}
function header(title,subtitle=''){
 const s=settings();
 return `<header class="analysis-print-head"><div><b>الإدارة العامة للتعليم بمنطقة نجران</b><span>${esc(s.schoolName||'مدرسة ابن سينا المتوسطة')}</span></div><div class="analysis-print-title"><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><div class="analysis-print-sign"><span>المعلم: ${esc(s.teacherName||'—')}</span><span>المدير: ${esc(s.principalName||'—')}</span></div></header>`;
}
function cleanClone(id){const el=$(id);if(!el)return'';const clone=el.cloneNode(true);clone.querySelectorAll('button,input,select,.no-print,#subjectTestPicker').forEach(x=>x.remove());return clone.outerHTML;}
function printHtml(html){const root=$('printRoot');if(!root)return;root.innerHTML=html;root.setAttribute('aria-hidden','false');requestAnimationFrame(()=>window.print());}
function printOverview(){
 const summary=$('overviewSummary'),students=$('overviewStudents');
 if(!summary?.textContent?.trim()&&!students?.textContent?.trim()){alert('لا توجد بيانات تحليل جاهزة للطباعة.');return}
 const cls=$('overviewClass')?.value||'كل الفصول';
 const html=`<article class="analysis-print-sheet">${header('تحليل نتائج جميع المواد',`الفصل: ${cls}`)}<section>${cleanClone('overviewSummary')}</section><section>${cleanClone('overviewStudents')}</section></article>`;
 printHtml(html);
}
function printSubject(){
 const subject=$('subjectSelect')?.value||'reading',label=names[subject]||subject,cls=$('subjectClass')?.value||'كل الفصول';
 const summary=$('subjectSummary'),students=$('subjectStudents'),inds=$('subjectIndicators'),qs=$('subjectQuestions');
 const has=[summary,students,inds,qs].some(x=>x?.textContent?.trim());
 if(!has){alert('لا توجد بيانات تحليل لهذه المادة جاهزة للطباعة.');return}
 const selected=[...document.querySelectorAll('#subjectTestPicker input[data-analysis-test]:checked')].length;
 const subtitle=`المادة: ${label} — الفصل: ${cls}${selected?` — عدد الاختبارات الداخلة: ${selected}`:''}`;
 const html=`<article class="analysis-print-sheet">${header(`تحليل مادة ${label}`,subtitle)}<section>${cleanClone('subjectSummary')}</section><section>${cleanClone('subjectStudents')}</section><section>${cleanClone('subjectIndicators')}</section><section>${cleanClone('subjectQuestions')}</section></article>`;
 printHtml(html);
}
function init(){
 $('printOverviewAnalysisBtn')?.addEventListener('click',printOverview);
 $('printSubjectAnalysisBtn')?.addEventListener('click',printSubject);
 window.addEventListener('afterprint',()=>{const root=$('printRoot');if(root){root.innerHTML='';root.setAttribute('aria-hidden','true')}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();