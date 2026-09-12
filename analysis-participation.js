(()=>{
'use strict';
const T=window.NafesTeacher;
let roster=[],ready=false,loading=false;
const nf=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1});
const ar=v=>nf.format(Number(v)||0);
function latinDigits(v){return String(v??'').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));}
function firstNumber(v){const m=latinDigits(v).replace(/,/g,'').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null;}
function selectedClass(sheet){
 const text=String(sheet.querySelector('.sar-meta > div:first-child b')?.textContent||'').trim();
 const m=text.match(/[\/·]\s*(?:فصل\s*)?\(?([أبجد])\)?(?:\s|$)/);
 return m?m[1]:'';
}
function activeRoster(){return roster.filter(s=>s&&s.is_active!==false);}
function rosterCount(cls=''){
 const active=activeRoster();
 return cls?active.filter(s=>String(s.class_name||'').trim()===String(cls).trim()).length:active.length;
}
function baseStudentStat(sheet){
 return [...sheet.querySelectorAll('.sar-stat-list > div')].find(row=>{
   const label=String(row.querySelector('span')?.textContent||'').trim();
   return ['عدد الطلاب','الطلاب المختبرون','إجمالي الطلاب'].includes(label)&&!row.dataset.participationKind;
 })||sheet.querySelector('.sar-stat-list > div[data-participation-kind="total"]');
}
function ensureStatRow(list,kind,label,after){
 let row=list.querySelector(`:scope > div[data-participation-kind="${kind}"]`);
 if(!row){
   row=document.createElement('div');
   row.dataset.participationKind=kind;
   row.innerHTML='<span></span><b></b>';
   after.insertAdjacentElement('afterend',row);
 }
 row.querySelector('span').textContent=label;
 return row;
}
function applySheet(sheet){
 if(!ready||!sheet)return;
 const list=sheet.querySelector('.sar-stat-list');
 const totalRow=baseStudentStat(sheet);
 const value=totalRow?.querySelector('b');
 if(!list||!totalRow||!value)return;
 let tested=Number(totalRow.dataset.testedCount);
 if(!Number.isFinite(tested))tested=firstNumber(value.textContent);
 if(tested===null||!Number.isFinite(tested))return;
 const total=rosterCount(selectedClass(sheet));
 if(!total||tested>total){console.warn('analysis participation count mismatch',{tested,total});return;}
 const absent=Math.max(0,total-tested),rate=total?tested/total*100:0;
 totalRow.dataset.participationKind='total';
 totalRow.dataset.testedCount=String(tested);
 totalRow.querySelector('span').textContent='إجمالي الطلاب';
 value.textContent=ar(total);
 const testedRow=ensureStatRow(list,'tested','اختبر',totalRow);
 testedRow.querySelector('b').innerHTML=`${ar(tested)} <small>(${ar(rate)}٪)</small>`;
 testedRow.setAttribute('aria-label',`اختبر ${tested} من أصل ${total}`);
 const absentRow=ensureStatRow(list,'absent','لم يختبر',testedRow);
 absentRow.querySelector('b').textContent=ar(absent);
 absentRow.setAttribute('aria-label',`لم يختبر ${absent} من أصل ${total}`);
 sheet.dataset.participation='true';
}
function ensureWeeklyItem(list,kind,label,after){
 let item=list.querySelector(`:scope > li[data-participation-kind="${kind}"]`);
 if(!item){
   item=document.createElement('li');
   item.dataset.participationKind=kind;
   after.insertAdjacentElement('afterend',item);
 }
 item.dataset.participationLabel=label;
 return item;
}
function applyWeekly(report){
 if(!ready||!report)return;
 const base=[...report.querySelectorAll('li')].find(li=>{
   const text=String(li.textContent||'').trim();
   return li.dataset.participationKind==='total'||/عدد الطلاب الذين أدوا الاختبار|^اختبر\s/.test(text);
 });
 if(!base)return;
 const list=base.parentElement;
 let tested=Number(base.dataset.testedCount);
 if(!Number.isFinite(tested))tested=firstNumber(base.textContent);
 const total=rosterCount('');
 if(!list||tested===null||!Number.isFinite(tested)||!total||tested>total)return;
 const absent=Math.max(0,total-tested),rate=tested/total*100;
 base.dataset.participationKind='total';
 base.dataset.testedCount=String(tested);
 base.textContent=`إجمالي الطلاب: ${ar(total)} طالبًا.`;
 const testedItem=ensureWeeklyItem(list,'tested','اختبر',base);
 testedItem.textContent=`اختبر: ${ar(tested)} طالبًا (${ar(rate)}٪).`;
 const absentItem=ensureWeeklyItem(list,'absent','لم يختبر',testedItem);
 absentItem.textContent=`لم يختبر: ${ar(absent)} طالبًا.`;
 report.dataset.participation='true';
}
function applyAll(){
 document.querySelectorAll('.subject-analysis-sheet').forEach(applySheet);
 document.querySelectorAll('.weekly-report.report-sheet').forEach(applyWeekly);
}
async function loadRoster(force=false){
 if(loading||(!force&&ready))return;
 if(!T?.getKey?.())return;
 loading=true;
 try{
   const data=await T.api('teacher_students_list',{include_archived:false});
   roster=Array.isArray(data?.students)?data.students:[];
   ready=true;
   applyAll();
 }catch(error){
   console.error('analysis participation roster',error);
 }finally{loading=false;}
}
let queued=false;
function queueApply(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;applyAll();});}
const observer=new MutationObserver(mutations=>{
 if(!ready)return;
 const relevant=mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(
   n.matches?.('.subject-analysis-sheet,.weekly-report.report-sheet')||n.querySelector?.('.subject-analysis-sheet,.weekly-report.report-sheet')
 )));
 if(relevant)queueApply();
});
function init(){
 observer.observe(document.body,{childList:true,subtree:true});
 addEventListener('beforeprint',applyAll);
 addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated){ready=false;loadRoster(true);}else{roster=[];ready=false;}});
 loadRoster();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
