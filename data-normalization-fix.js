(()=>{
'use strict';
const A=window.NafesAnalytics;
if(!A||typeof A.normalizeAttempt!=='function'||A.__nafesNormalizationFix)return;
const original=A.normalizeAttempt.bind(A);
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
  const out=original(raw||{});
  const current=clean(out?.test_id);
  const rawTest=clean(raw?.test_id);
  const fallback=(rawTest&&!rawTest.startsWith('unknown-test:'))?rawTest:(clean(raw?.assessment_id)||clean(raw?.exam_id));
  if((!current||current.startsWith('unknown-test:'))&&fallback)out.test_id=fallback;
  const cls=canonicalClass(raw?.class_name??raw?.class??raw?.section??out?.class_name);
  if(cls)out.class_name=cls;
  return out;
};
A.__nafesNormalizationFix=true;
})();
