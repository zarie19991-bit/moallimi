(()=>{
'use strict';
const T=window.NafesTeacher;
if(!T?.api||T.__savedGradeAnalysisWrapped)return;
T.__savedGradeAnalysisWrapped=true;
const baseApi=T.api.bind(T);
const ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-analysis-grades';
let cache=null,cacheAt=0,loading=null;

async function savedGrades(){
 const key=T.getKey?.();
 if(!key)return new Map();
 if(cache&&Date.now()-cacheAt<30000)return cache;
 if(loading)return loading;
 loading=(async()=>{
  const res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json','x-teacher-key':key},body:'{}'});
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(body?.error||'تعذر تحميل الدرجات المحفوظة.');
  const map=new Map();
  for(const row of body.grades||[])map.set(`${row.source}:${row.id}`,row);
  cache=map;cacheAt=Date.now();loading=null;return map;
 })().catch(err=>{loading=null;throw err});
 return loading;
}

T.api=async function(action,payload){
 const result=await baseApi(action,payload);
 if(action!=='teacher_data'||!Array.isArray(result?.attempts))return result;
 try{
  const grades=await savedGrades();
  return {...result,attempts:result.attempts.map(a=>{
   const g=grades.get(`${a.source}:${a.id}`);
   if(!g)return a;
   return {...a,
    score:g.score??a.score,
    total:g.total??a.total,
    percent:g.percent??a.percent,
    section_scores:Array.isArray(g.section_scores)?g.section_scores:(a.section_scores||[])
   };
  })};
 }catch(err){
  console.error('saved grade analysis enrichment failed',err);
  return result;
 }
};

addEventListener('nafes:auth-changed',()=>{cache=null;cacheAt=0;loading=null;});
})();
