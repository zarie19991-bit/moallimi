(()=>{
'use strict';
const T=window.NafesTeacher,A=window.NafesAnalytics,$=id=>document.getElementById(id);
const subjects={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
let cache=null,cacheAt=0,loading=null;
function submitted(a){return A?.isSubmitted?A.isSubmitted(a):!!(a?.submitted_at||a?.completed_at||a?.finished_at||String(a?.status||'').toLowerCase()==='submitted');}
function ident(a){return A?.studentIdentity?.(a)||String(a?.student_id||a?.student_name||a?.full_name||a?.id||'');}
function when(a){return Date.parse(a?.submitted_at||a?.completed_at||a?.finished_at||a?.started_at||a?.updated_at||0)||0;}
function testId(a){return String(a?.test_id||a?.assessment_id||a?.exam_id||'').trim();}
function measure(a,subject){if(A?.measure){const m=A.measure(a,{subject});if(m?.total)return m;}const qs=(Array.isArray(a?.questions)?a.questions:[]).filter(q=>String(q.subject||q.subject_key||'').toLowerCase()===subject);const correct=qs.filter(q=>q.correct===true).length;return{correct,total:qs.length,percent:qs.length?correct/qs.length*100:null};}
async function data(){if(cache&&Date.now()-cacheAt<30000)return cache;if(loading)return loading;loading=(async()=>{let cursor=0,rows=[];do{const d=await T.api('teacher_data',{cursor,limit:100});rows.push(...(d.attempts||[]));cursor=d.next_cursor}while(cursor!==null);cache=rows.map(x=>A?.normalizeAttempt?A.normalizeAttempt(x):x);cacheAt=Date.now();loading=null;return cache})().catch(e=>{loading=null;throw e});return loading;}
function ctx(sheet){
 let subject='',tid='',cls='';
 const title=sheet.querySelector('h1')?.textContent||'';
 for(const [k,v] of Object.entries(subjects))if(title.includes(v)){subject=k;break}
 if(sheet.closest('#overviewOfficialPreview')){tid=$(subject==='reading'?'analysisReadingTest':subject==='math'?'analysisMathTest':'analysisScienceTest')?.value||'';cls=$('overviewClass')?.value||'';}
 else if(sheet.closest('#subjectOfficialPreview')){subject=$('subjectSelect')?.value||subject;tid=$('analysisSubjectTest')?.value||'';cls=$('subjectClass')?.value||'';}
 else if(sheet.closest('#subjectOfficialReport')){subject=$('reportSubjectSelect')?.value||subject;tid=$('reportSubjectTest')?.value||'';cls=$('reportSubjectClass')?.value||'';}
 return{subject,tid,cls};
}
function fmt(v){return `${new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(v)}٪`;}
async function patchSheet(sheet){
 if(!sheet||sheet.dataset.achievementBusy==='1')return;const {subject,tid,cls}=ctx(sheet);if(!subject||!tid)return;sheet.dataset.achievementBusy='1';
 try{const rows=await data(),latest=new Map();for(const a of rows){if(!submitted(a)||testId(a)!==String(tid))continue;if(cls&&String(a.class_name||'').trim()!==String(cls).trim())continue;const m=measure(a,subject);if(!m?.total)continue;const k=ident(a);if(!k)continue;const old=latest.get(k);if(!old||when(a)>when(old.a))latest.set(k,{a,m});}
 const recs=[...latest.values()];if(!recs.length)return;const earned=recs.reduce((s,x)=>s+Number(x.m.correct||0),0),possible=recs.reduce((s,x)=>s+Number(x.m.total||0),0),achievement=possible?earned/possible*100:0;
 const row=[...sheet.querySelectorAll('.sar-stat-list>div')].find(d=>/نسبة\s*(النجاح|التحصيل)/.test(d.textContent||''));if(row){const label=row.querySelector('span'),value=row.querySelector('b');if(label)label.textContent='نسبة التحصيل';if(value)value.textContent=fmt(achievement);row.title=`محسوبة من النتائج الفعلية: ${earned} ÷ ${possible} × 100`;}
 sheet.dataset.achievementSource='real-submitted-results';
 }catch(e){console.error('تعذر حساب نسبة التحصيل الفعلية:',e)}finally{sheet.dataset.achievementBusy='0'}
}
function patchAll(root=document){root.querySelectorAll?.('.subject-analysis-sheet').forEach(s=>patchSheet(s));}
function init(){patchAll();const mo=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1){if(n.matches?.('.subject-analysis-sheet'))patchSheet(n);patchAll(n)}});mo.observe(document.body,{childList:true,subtree:true});document.addEventListener('click',e=>{if(e.target.closest?.('#buildOverviewOfficialBtn,#buildSubjectOfficialBtn,#buildSubjectReportBtn'))setTimeout(()=>patchAll(),150)});addEventListener('nafes:auth-changed',()=>{cache=null;cacheAt=0;setTimeout(()=>patchAll(),250)});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
