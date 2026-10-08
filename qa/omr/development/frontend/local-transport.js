(()=>{
 'use strict';
 const ready=fetch('/api/omr-local',{credentials:'same-origin'}).then(async r=>{
  if(!r.ok)throw Error('تعذر بدء جلسة الاختبار المحلية');return r.json();
 });
 let key='SYNTHETIC_QA_CONTEXT_NOT_A_PRODUCTION_CREDENTIAL';
 window.MoallimiLocal={ready};
 window.NafesTeacher={
  getKey:()=>key,setKey:()=>{key='SYNTHETIC_QA_CONTEXT_NOT_A_PRODUCTION_CREDENTIAL';},clearKey:()=>{key='';},
  api:async(action,body={})=>{
   if(!action.startsWith('teacher_scan_'))throw Error('محاولات الطلاب والتقارير التاريخية غير متاحة محليًا: تعريفات SQL الأصلية الناقصة مطلوبة؛ لم تُخترع بيانات محاولات.');
   const r=await fetch('/api/omr-local',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,action})});
   const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'فشل الطلب المحلي');return d;
  },
 };
})();
