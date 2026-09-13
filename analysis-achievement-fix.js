(()=>{
'use strict';
const T=window.NafesTeacher;
if(!T?.api||T.__savedGradeAnalysisWrapped)return;
T.__savedGradeAnalysisWrapped=true;
const baseApi=T.api.bind(T);
const CLEAR_ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-results-admin';
let rosterCache=null,rosterLoading=null;

async function roster(){
 if(rosterCache)return rosterCache;
 if(rosterLoading)return rosterLoading;
 rosterLoading=(async()=>{
  const result=await baseApi('teacher_students_list',{include_archived:false});
  const map=new Map();
  for(const student of result?.students||[]){
   if(student?.id)map.set(String(student.id),student);
  }
  rosterCache=map;
  rosterLoading=null;
  return map;
 })().catch(error=>{rosterLoading=null;throw error});
 return rosterLoading;
}

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

 /* Load the small student roster in parallel with the result page. */
 const rosterPromise=roster();
 const result=await baseApi(action,payload);
 if(!Array.isArray(result?.attempts))return result;
 try{
  const students=await rosterPromise;
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

addEventListener('nafes:auth-changed',()=>{rosterCache=null;rosterLoading=null;});
})();
