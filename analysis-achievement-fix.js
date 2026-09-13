(()=>{
'use strict';
const T=window.NafesTeacher;
if(!T?.api||T.__savedGradeAnalysisWrapped)return;
T.__savedGradeAnalysisWrapped=true;
const baseApi=T.api.bind(T);
const LITE_STUDENTS_ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-students-lite';
const CLEAR_ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-results-admin';
const ROSTER_TIMEOUT_MS=10000;
let rosterCache=null,rosterLoading=null,rosterVersion=0,rosterError=null,retryAfter=0;
function clearRoster(){rosterCache=null;rosterLoading=null;rosterError=null;retryAfter=0;rosterVersion++;}

async function roster(){
 if(rosterCache)return rosterCache;
 if(rosterLoading)return rosterLoading;
 if(rosterError&&Date.now()<retryAfter)throw rosterError;
 const version=rosterVersion;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),ROSTER_TIMEOUT_MS);
 rosterLoading=(async()=>{
  try{
  const key=T.getKey?.();
  if(!key||key==='__qa__')return new Map();
  const res=await fetch(LITE_STUDENTS_ENDPOINT,{
   method:'POST',
   headers:{'content-type':'application/json','x-teacher-key':key},
   body:JSON.stringify({include_archived:false}),
   cache:'no-store',signal:controller.signal
  });
  const body=await res.json();
  if(!res.ok||body?.error||!Array.isArray(body?.students))throw new Error(body?.error||'تعذر تحميل قائمة الطلاب.');
  const map=new Map();
  for(const student of body?.students||[]){
   if(student?.id)map.set(String(student.id),student);
  }
  if(version===rosterVersion){rosterCache=map;rosterError=null;retryAfter=0;}
  return map;
  }catch(error){
   if(version===rosterVersion){rosterError=error;retryAfter=Date.now()+10000;}
   throw error;
  }finally{
   clearTimeout(timer);
   if(version===rosterVersion)rosterLoading=null;
  }
 })();
 return rosterLoading;
}
T.getAnalysisRoster=async()=>({ok:true,students:[...(await roster()).values()]});

async function clearResults(payload){
 const key=T.getKey?.();
 if(!key)throw new Error('أدخل مفتاح المعلم أولًا.');
 const res=await fetch(CLEAR_ENDPOINT,{
  method:'POST',
  headers:{'content-type':'application/json','x-teacher-key':key},
  body:JSON.stringify({action:'teacher_tests_bulk_clear',...(payload||{})}),
  cache:'no-store'
 });
 const body=await res.json().catch(()=>({}));
 if(!res.ok||body?.error)throw new Error(body?.error||'تعذر مسح النتائج.');
 return body;
}

T.api=async function(action,payload={}){
 if(action==='teacher_tests_bulk_clear')return await clearResults(payload);
 if(action!=='teacher_data')return await baseApi(action,payload);

 /* Load the small roster in parallel with the result page, without rescanning result tables. */
 // Handle failure immediately, even if the result request is still pending.
 const rosterPromise=roster().then(students=>({students}),error=>({error}));
 const result=await baseApi(action,payload);
 if(!Array.isArray(result?.attempts))return result;
 try{
  const rosterResult=await rosterPromise;
  if(rosterResult.error)throw rosterResult.error;
  const students=rosterResult.students;
  if(!students.size)return result;
  return {...result,attempts:result.attempts.map(a=>{
   const student=students.get(String(a?.student_id||''));
   if(!student)return a;
   return {...a,
    student_name:a.student_name||student.full_name||a.full_name,
    class_name:a.class_name||student.class_name||''
   };
  })};
 }catch(err){
  console.error('analysis roster enrichment failed',err);
  return result;
 }
};

addEventListener('nafes:auth-changed',clearRoster);
document.addEventListener('click',e=>{
 if(e.target?.closest?.('#refreshBtn,#retryBtn'))clearRoster();
},true);
})();
