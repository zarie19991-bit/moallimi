/* Single analysis data layer: attempt normalization and roster enrichment only. */
(()=>{
'use strict';
const core=window.NafesAnalytics;
const T=window.NafesTeacher;
if(!core||!T?.api||T.__analysisDataService)return;
T.__analysisDataService=true;

if(typeof core.normalizeAttempt==='function'&&!core.__analysisDataNormalization){
  const A={...core};
  const original=core.normalizeAttempt.bind(core);
  const memo=new WeakMap();
  const clean=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ');
  function canonicalClass(v){
    const raw=clean(v).replace(/[إآا]/g,'أ');
    if(['أ','ب','ج','د'].includes(raw))return raw;
    const token=raw.match(/(?:^|[\s/\\\-()])([أبجد])(?:$|[\s/\\\-()])/);
    if(token)return token[1];
    const tail=raw.match(/(?:فصل|شعبة)?\s*([أبجد])$/);
    return tail?tail[1]:raw;
  }
  A.normalizeAttempt=function(raw){
    if(raw&&typeof raw==='object'&&memo.has(raw))return memo.get(raw);
    const out=original(raw||{});
    const current=clean(out?.test_id),rawTest=clean(raw?.test_id);
    const fallback=(rawTest&&!rawTest.startsWith('unknown-test:'))?rawTest:(clean(raw?.assessment_id)||clean(raw?.exam_id));
    if((!current||current.startsWith('unknown-test:'))&&fallback)out.test_id=fallback;
    const cls=canonicalClass(raw?.class_name??raw?.class??raw?.section??out?.class_name);
    if(cls)out.class_name=cls;
    if(raw&&typeof raw==='object')memo.set(raw,out);
    return out;
  };
  A.__analysisDataNormalization=true;
  window.NafesAnalytics=Object.freeze(A);
}

const baseApi=T.api.bind(T);
const LITE_STUDENTS_ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-students-lite';
const ROSTER_TIMEOUT_MS=10000;
let rosterCache=null,rosterPromise=null,retryAfter=0;

function resetRoster(){rosterCache=null;rosterPromise=null;retryAfter=0;}
async function rosterMap(force=false){
  if(force)resetRoster();
  if(rosterCache)return rosterCache;
  if(rosterPromise)return rosterPromise;
  if(Date.now()<retryAfter)throw new Error('تعذر تحميل كشف الطلاب مؤقتًا. أعد المحاولة بعد قليل.');
  const teacherKey=T.getKey?.();
  if(!teacherKey||teacherKey==='__qa__')return new Map();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ROSTER_TIMEOUT_MS);
  rosterPromise=(async()=>{
    try{
      const response=await fetch(LITE_STUDENTS_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','x-teacher-key':teacherKey},body:JSON.stringify({include_archived:false,analysis_only:true}),cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data?.error||!Array.isArray(data?.students))throw new Error(data?.error||'تعذر تحميل كشف الطلاب.');
      const map=new Map();
      for(const student of data.students){if(student?.id)map.set(String(student.id),student);}
      rosterCache=map;retryAfter=0;return map;
    }catch(error){retryAfter=Date.now()+10000;throw error;}
    finally{clearTimeout(timer);rosterPromise=null;}
  })();
  return rosterPromise;
}
T.getAnalysisRoster=async()=>({ok:true,students:[...(await rosterMap()).values()]});

T.api=async function(action,payload={}){
  if(action==='teacher_students_list'&&payload?.include_archived!==true){
    try{return{ok:true,students:[...(await rosterMap()).values()]};}
    catch(error){console.error('analysis roster load failed',error);return baseApi(action,payload);}
  }
  const data=await baseApi(action,payload);
  if(action!=='teacher_data'||!Array.isArray(data?.attempts))return data;
  const cleanAttempts=data.attempts.filter(a=>a?.is_demo!==true);
  const next=data?.next_cursor,current=Number(payload?.cursor||0);
  if(next!==null&&next!==undefined&&(!Number.isSafeInteger(next)||next<=current))throw new Error('لم تصل صفحات النتائج بترتيب صحيح. اضغط «تحديث البيانات» وأعد المحاولة.');
  try{
    const students=await rosterMap();
    if(!students.size)return {...data,attempts:cleanAttempts};
    return {...data,attempts:cleanAttempts.map(a=>{
      const student=students.get(String(a?.student_id||''));
      if(!student)return a;
      return {...a,student_name:a.student_name||student.full_name||a.full_name,class_name:a.class_name||student.class_name||''};
    })};
  }catch(error){console.error('analysis roster enrichment failed',error);return {...data,attempts:cleanAttempts};}
};

// All analysis panels share one complete load, including explicit refresh clicks.
let dataEpoch=0;
T.loadAnalysis=async function(force=false){
 const key='__NAFES_ANALYSIS_DATA_CACHE__',cached=window[key];
 if(cached?.promise)return cached.promise;
 if(!force&&cached?.data&&Date.now()-cached.at<30000)return cached.data;
 const epoch=dataEpoch;
 const promise=(async()=>{
  let cursor=0,all=[],tests=[],indicators=[],pages=0;const seen=new Set();
  // Fetch the small roster alongside the first result page instead of after it.
  const roster=rosterMap().catch(()=>null);
  do{
   if(seen.has(cursor)||pages++>=500)throw new Error('تعذر متابعة صفحات النتائج بالترتيب الصحيح.');seen.add(cursor);
   let d;
   for(let retry=0;retry<2;retry++){
    try{d=await T.api('teacher_data',{cursor,limit:100});break;}
    catch(e){if(retry||[400,401,403,404].includes(e.status))throw e;await new Promise(r=>setTimeout(r,500));}
   }
   if(epoch!==dataEpoch)throw new Error('تغير حساب المعلم؛ أعد فتح التحليل.');
   all.push(...(d.attempts||[]));if(cursor===0){tests=d.tests||[];indicators=d.indicators||[];}
   cursor=d.next_cursor;
   if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('nafes:analysis-progress',{detail:{count:all.length,complete:cursor===null}}));
  }while(cursor!==null);
  await roster;
  const unique=new Map();for(const a of all)unique.set(`${a.source}:${a.id}`,a);
  return {attempts:[...unique.values()].map(a=>window.NafesAnalytics.normalizeAttempt(a)),tests,indicators};
 })();
 const entry={promise,at:Date.now()};window[key]=entry;
 try{const data=await promise;if(epoch===dataEpoch&&window[key]===entry)window[key]={data,at:Date.now()};return data;}
 catch(e){if(window[key]===entry)delete window[key];throw e;}
};

function clearAllCaches(){dataEpoch++;resetRoster();T.clearReadCache?.();delete window.__NAFES_ANALYSIS_DATA_CACHE__;}
function refreshCaches(){if(window.__NAFES_ANALYSIS_DATA_CACHE__?.promise)return;resetRoster();T.clearReadCache?.();delete window.__NAFES_ANALYSIS_DATA_CACHE__;}
addEventListener('nafes:auth-changed',clearAllCaches);
document.addEventListener('click',e=>{if(e.target?.closest?.('#refreshBtn,#retryBtn,#resetTrialDataBtn'))refreshCaches();},true);
})();
