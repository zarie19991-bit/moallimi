(()=>{
'use strict';
const A=window.NafesAnalytics;
if(!A||typeof A.normalizeAttempt!=='function'||A.__nafesNormalizationFix)return;
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

/* Share result reads between the analysis modules on this page. */
const T=window.NafesTeacher;
if(T?.api&&!T.__analysisSharedReadCache){
  const baseApi=T.api.bind(T);
  const readActions=new Set(['teacher_data','teacher_students_list']);
  const shared=new Map();
  const key=(action,body)=>`${action}|${JSON.stringify(body||{})}`;
  const clear=()=>shared.clear();
  T.api=async function(action,body={}){
    if(!readActions.has(action)){
      const data=await baseApi(action,body);
      clear();
      return data;
    }
    const k=key(action,body);
    if(shared.has(k))return shared.get(k);
    const pending=Promise.resolve(baseApi(action,body));
    shared.set(k,pending);
    try{return await pending;}
    catch(error){if(shared.get(k)===pending)shared.delete(k);throw error;}
  };
  T.clearAnalysisSharedReadCache=clear;
  T.__analysisSharedReadCache=true;
  addEventListener('nafes:auth-changed',clear);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#refreshBtn,#retryBtn,#resetTrialDataBtn'))clear();
  },true);
}
})();
