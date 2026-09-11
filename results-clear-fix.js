(()=>{
'use strict';
const T=window.NafesTeacher;
if(!T?.api||T.__resultsClearFixWrapped)return;
T.__resultsClearFixWrapped=true;
const baseApi=T.api.bind(T);
const baseFetch=window.fetch.bind(window);
const ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-results-admin';
const OLD_ADMIN='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-admin';

async function callResultsAdmin(action,payload){
  const key=T.getKey?.();
  if(!key)throw new Error('مفتاح دخول المعلم غير موجود.');
  const res=await baseFetch(ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-teacher-key':key},
    body:JSON.stringify({action,...(payload||{})}),
    cache:'no-store'
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok||body?.error)throw new Error(body?.error||'تعذر تنفيذ عملية حذف النتائج.');
  return body;
}

T.api=async function(action,payload){
  if(action==='teacher_tests_bulk_clear')return callResultsAdmin(action,payload);
  return baseApi(action,payload);
};

// Compatibility bridge for the legacy individual-delete code in reset-results.js.
// The old nafes-admin function no longer exists; route only that exact endpoint
// to the unified, authenticated results administration function.
window.fetch=function(input,init){
  const url=typeof input==='string'?input:String(input?.url||'');
  if(url===OLD_ADMIN)return baseFetch(ENDPOINT,init);
  return baseFetch(input,init);
};
})();
