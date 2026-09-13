(()=>{
'use strict';
const core=window.NafesAnalytics;
if(!core||typeof core.normalizeAttempt!=='function'||core.__nafesNormalizationFix)return;
// The pure analytics API is frozen. Extend a new facade, preserving the core.
const A={...core};
const original=A.normalizeAttempt.bind(A);
const normalizedMemo=new WeakMap();
const clean=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ');
function canonicalClass(v){
  const raw=clean(v).replace(/[إآا]/g,'أ');
  if(['أ','ب','ج','د'].includes(raw))return raw;
  const token=raw.match(/(?:^|[\s/\\\-()])([أبجد])(?:$|[\s/\\\-()])/);
  if(token)return token[1];
  const tail=raw.match(/([أبجد])$/);
  return tail?tail[1]:raw;
}
A.normalizeAttempt=function(raw){
  if(raw&&typeof raw==='object'&&normalizedMemo.has(raw))return normalizedMemo.get(raw);
  const out=original(raw||{});
  const current=clean(out?.test_id);
  const rawTest=clean(raw?.test_id);
  const fallback=(rawTest&&!rawTest.startsWith('unknown-test:'))?rawTest:(clean(raw?.assessment_id)||clean(raw?.exam_id));
  if((!current||current.startsWith('unknown-test:'))&&fallback)out.test_id=fallback;
  const cls=canonicalClass(raw?.class_name??raw?.class??raw?.section??out?.class_name);
  if(cls)out.class_name=cls;
  if(raw&&typeof raw==='object')normalizedMemo.set(raw,out);
  return out;
};
A.__nafesNormalizationFix=true;
window.NafesAnalytics=Object.freeze(A);

/* Share result reads between analysis modules and use the cached light roster. */
const T=window.NafesTeacher;
if(T?.api&&!T.__analysisSharedReadCache){
  const baseApi=T.api.bind(T);
  const LITE_STUDENTS_ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-students-lite';
  const readActions=new Set(['teacher_data','teacher_students_list']);
  const shared=new Map();
  const key=(action,body)=>`${action}|${JSON.stringify(body||{})}`;
  const clear=()=>shared.clear();
  async function liteStudents(body={}){
    if(body?.include_archived!==true&&typeof T.getAnalysisRoster==='function')return await T.getAnalysisRoster();
    const teacherKey=T.getKey?.();
    if(!teacherKey||teacherKey==='__qa__')return baseApi('teacher_students_list',body);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
    const response=await fetch(LITE_STUDENTS_ENDPOINT,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-teacher-key':teacherKey},
      body:JSON.stringify({include_archived:body?.include_archived===true}),
      cache:'no-store',signal:controller.signal
    });
    const data=await response.json();
    if(!response.ok||data?.error||!Array.isArray(data?.students))throw new Error(data?.error||'تعذر تحميل قائمة الطلاب.');
    return data;
    }finally{clearTimeout(timer);}
  }
  T.api=async function(action,body={}){
    if(!readActions.has(action)){
      const data=await baseApi(action,body);
      clear();
      return data;
    }
    const k=key(action,body);
    if(shared.has(k))return shared.get(k);
    const request=action==='teacher_students_list'
      ? Promise.resolve(liteStudents(body))
      : Promise.resolve(baseApi(action,body));
    const pending=request.then(data=>{
      if(action==='teacher_data'){
        const next=data?.next_cursor;
        if(!Array.isArray(data?.attempts)||next===undefined||
          (next!==null&&(!Number.isSafeInteger(next)||next<=Number(body.cursor||0)))){
          throw new Error('لم تصل بيانات التحليل كاملة. اضغط إعادة المحاولة.');
        }
      }
      return data;
    });
    shared.set(k,pending);
    try{return await pending;}
    catch(error){if(shared.get(k)===pending)shared.delete(k);throw error;}
  };
  T.clearAnalysisSharedReadCache=clear;
  T.__analysisSharedReadCache=true;
  addEventListener('nafes:auth-changed',clear);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#refreshBtn,#retryBtn,#resetTrialDataBtn')){
      clear();
      T.clearReadCache?.();
    }
  },true);
}
})();
