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
function rosterCount(cls=''){
 const active=roster.filter(s=>s&&s.is_active!==false);
 return cls?active.filter(s=>String(s.class_name||'').trim()===String(cls).trim()).length:active.length;
}
function studentStat(sheet){
 return [...sheet.querySelectorAll('.sar-stat-list > div')].find(row=>{
   const label=String(row.querySelector('span')?.textContent||'').trim();
   return label==='عدد الطلاب'||label==='الطلاب المختبرون';
 });
}
function applySheet(sheet){
 if(!ready||!sheet)return;
 const row=studentStat(sheet),value=row?.querySelector('b');
 if(!row||!value)return;
 const tested=firstNumber(value.textContent);
 if(tested===null)return;
 const total=rosterCount(selectedClass(sheet));
 if(!total||tested>total)return;
 const rate=total?tested/total*100:0;
 row.querySelector('span').textContent='الطلاب المختبرون';
 value.innerHTML=`${ar(tested)} من ${ar(total)} <small>(${ar(rate)}٪)</small>`;
 row.dataset.participation='true';
 row.setAttribute('aria-label',`الطلاب المختبرون ${tested} من أصل ${total}`);
}
function applyAll(){document.querySelectorAll('.subject-analysis-sheet').forEach(applySheet);}
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
 if(mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.subject-analysis-sheet')||n.querySelector?.('.subject-analysis-sheet')))))queueApply();
});
function init(){
 observer.observe(document.body,{childList:true,subtree:true});
 addEventListener('beforeprint',applyAll);
 addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated){ready=false;loadRoster(true);}else{roster=[];ready=false;}});
 loadRoster();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
