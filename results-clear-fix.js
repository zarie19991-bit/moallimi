(()=>{
'use strict';
const T=window.NafesTeacher;
if(!T?.api||T.__resultsClearFixWrapped)return;
T.__resultsClearFixWrapped=true;
const baseApi=T.api.bind(T);
const ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-results-admin';

T.api=async function(action,payload){
  if(action!=='teacher_tests_bulk_clear')return baseApi(action,payload);
  const key=T.getKey?.();
  if(!key)throw new Error('مفتاح دخول المعلم غير موجود.');
  const res=await fetch(ENDPOINT,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-teacher-key':key},
    body:JSON.stringify({action,...(payload||{})}),
    cache:'no-store'
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok||body?.error)throw new Error(body?.error||'تعذر مسح النتائج.');
  return body;
};
})();
