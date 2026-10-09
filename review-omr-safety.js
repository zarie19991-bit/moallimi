/* Shared browser safety contract; never infer a choice from the answer key. */
(()=>{
 'use strict';
 const option=n=>Number.isInteger(n)&&n>=0&&n<4;
 const provenMultiple=a=>a?.status==='multiple'&&a.selected===null&&Array.isArray(a.marked)&&
   a.marked.length>=2&&a.marked.every(option)&&new Set(a.marked).size===a.marked.length;
 const unresolved=a=>!a||a.state==='uncertain'||a.status==='ambiguous'||a.review_pending===true||
   !['correct','incorrect','blank','multiple'].includes(a.state)||
   (a.state==='multiple'&&!provenMultiple(a))||
   Object.values(a.uncertainty||{}).some(xs=>Array.isArray(xs)&&xs.length>0);
 function unresolvedSheet(sheet){
   const s=sheet?.effective_snapshot||sheet?.snapshot||{};
   return s.identity_valid!==true||!sheet?.student_id||!Array.isArray(s.answers)||
     !s.answers.length||s.answers.some(unresolved);
 }
 function classify(raw,key,context={}){
   const validKey=option(key),marked=Array.isArray(raw.marked)?raw.marked.filter(option):[];
   const uncertainty={reading:[],identity:[],key:[]};
   let state='uncertain',selected=null;
   if(raw.status==='ambiguous')uncertainty.reading.push('bubble_ambiguous');
   else if(raw.status==='clear'&&option(raw.selected)&&marked.length===1&&marked[0]===raw.selected){
     selected=raw.selected;state=validKey?(selected===key?'correct':'incorrect'):'uncertain';
   }else if(raw.status==='blank'&&raw.selected===null&&marked.length===0)state='blank';
   else if(raw.status==='multiple'&&marked.length>1&&new Set(marked).size===marked.length)state='multiple';
   else uncertainty.reading.push('contradictory_reading_evidence');
   if(context.identity_valid===false)uncertainty.identity.push('identity_not_verified');
   if(context.markers_ok===false)uncertainty.reading.push('markers_not_verified');
   if(!validKey)uncertainty.key.push('answer_key_missing_or_invalid');
   if(Object.values(uncertainty).some(xs=>xs.length))state='uncertain';
   if(uncertainty.reading.length)selected=null;
   return {state,selected,correct:state==='correct',uncertainty};
 }
 const texts={
   bubble_ambiguous:'قراءة الفقاعات غير محسومة بين اختيارات محتملة، وليست تظليلًا متعددًا مثبتًا.',
   confirmed_multiple_requires_review:'تظليل متعدد مثبت؛ يجب مراجعته من الصورة.',
   markers_not_verified:'علامات المحاذاة أو مواضع الفقاعات تحتاج تحققًا.',
   identity_not_verified:'هوية الورقة غير مؤكدة؛ لا تغيّر الاختيارات لإصلاح الهوية.',
   answer_key_missing_or_invalid:'مفتاح التصحيح مفقود أو غير صالح؛ لا يمكن تأكيد صحة الإجابة.',
   answer_key_incomplete:'مفتاح التصحيح غير مكتمل.',
   contradictory_reading_evidence:'أدلة قراءة الفقاعات متناقضة.',
   prior_uncertainty_requires_explicit_review:'هذه الإجابة تحتاج مراجعة صريحة من الصورة.'
 };
 function reasons(a){
   const u=a?.uncertainty||{};
   const groups=[['reading','قراءة الفقاعات'],['identity','هوية الورقة'],['key','مفتاح التصحيح']];
   const result=[];
   for(const [group,label] of groups)for(const code of u[group]||[])
     result.push(label+': '+(texts[code]||'تحتاج تحققًا ('+code+')'));
   if(a?.status==='ambiguous'&&!result.length)result.push(texts.bubble_ambiguous);
   if(a?.state==='multiple')result.push(texts.confirmed_multiple_requires_review);
   return [...new Set(result)];
 }
 globalThis.NafesOmrSafety=Object.freeze({provenMultiple,unresolved,unresolvedSheet,classify,reasons});
})();
