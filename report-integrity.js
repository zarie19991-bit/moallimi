/* Independent, fail-closed verification of the saved grades used by official reports.
 * Never derives a grade from a student's name or guesses an absent roster. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.NafesReportIntegrity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const num=v=>v===null||v===undefined||v===''||typeof v==='boolean'?null:(Number.isFinite(Number(v))?Number(v):null);
 const eq=(a,b)=>Math.abs(a-b)<0.011;
 const clean=v=>String(v??'').trim();
 const submitted=a=>!!a?.submitted_at||['submitted','completed','finished'].includes(String(a?.status||''))&&!['expired','in_progress'].includes(a?.status);
 function verify(attempts,{testIds=null,requireIdentity=true}={}){
  const ids=testIds===null?null:new Set([...testIds].map(String));
  const problems=[],verified=new Set(),checked=[];
  for(const a of attempts||[]){
   if(ids&&!ids.has(String(a.test_id||a.assessment_id||'')))continue;
   if(!submitted(a)||a.is_demo===true)continue;
   const key=String(a.source||'assessment')+':'+clean(a.id);
   if(verified.has(key)){problems.push({key,reason:'محاولة مكررة ضمن صفحات التقرير'});continue;}
   verified.add(key);
   if(a.source&&a.source!=='assessment'){problems.push({key,reason:'محاولة تاريخية تحتاج تدقيقًا منفصلًا قبل التقرير الرسمي'});continue;}
   if(requireIdentity&&!clean(a.student_id)&&!clean(a.student_key)){problems.push({key,reason:'لم يتم توثيق ربط المحاولة بهوية الطالب'});continue;}
   const questions=a.questions,score=num(a.score),total=num(a.total),percent=num(a.percent);
   if(!Array.isArray(questions)||!questions.length){problems.push({key,reason:'لا يوجد سجل أسئلة موثق'});continue;}
   const invalid=questions.some(q=>q.scorable===false||typeof q.correct!=='boolean'||!clean(q.id));
   const unique=new Set(questions.map(q=>clean(q.id)));
   if(invalid||unique.size!==questions.length||a.snapshot_warning){problems.push({key,reason:'بيانات الإجابات أو مفاتيح الأسئلة غير مكتملة'});continue;}
   const expectedScore=questions.filter(q=>q.correct).length,expectedTotal=questions.length;
   if(score===null||total!==expectedTotal||score!==expectedScore||percent===null||!eq(percent,Math.round(10000*expectedScore/expectedTotal)/100)){
    problems.push({key,reason:'اختلاف الدرجة أو النسبة عن الإجابات المحفوظة'});continue;
   }
   const sections=a.section_scores;
   if(!Array.isArray(sections)||!sections.length){problems.push({key,reason:'تفصيل درجات المواد غير محفوظ'});continue;}
   const actual=new Map();
   for(const q of questions){
    const subject=clean(q.subject);const row=actual.get(subject)||{score:0,total:0};
    row.total++;if(q.correct)row.score++;actual.set(subject,row);
   }
   const counted=new Set();let badSection=false;
   for(const sec of sections){
    const name=clean(sec.subject||sec.subject_key),expected=actual.get(name);
    if(!name||counted.has(name)||!expected||num(sec.score??sec.correct)!==expected.score||num(sec.total)!==expected.total
      ||num(sec.percent)===null||!eq(num(sec.percent),Math.round(10000*expected.score/expected.total)/100)){badSection=true;break;}
    counted.add(name);
   }
   if(badSection||counted.size!==actual.size){problems.push({key,reason:'تفصيل المواد لا يطابق مجموع الإجابات'});continue;}
   checked.push(key);
  }
  return{ok:problems.length===0,verified:checked.length,problems};
 }
 function requireValid(attempts,options={}){
  const result=verify(attempts,options);
  if(!result.ok){
   const first=result.problems[0];
   throw new Error('أُوقف إنشاء التقرير لحماية صحة البيانات: '+first.reason+' ('+result.problems.length+' حالة). راجع المحاولات ثم حدّث النتائج.');
  }
  return result;
 }
 function requireRoster(roster){
  if(!Array.isArray(roster)||!roster.length)throw new Error('لا يمكن اعتماد أعداد المختبرين والغائبين دون كشف طلاب مكتمل ومحمّل من قاعدة البيانات.');
  const ids=new Set();
  for(const s of roster){
   if(s.is_active===false)continue;
   const id=clean(s.id||s.student_id);
   if(!id||ids.has(id)||!clean(s.full_name||s.student_name)||!clean(s.class_name))
    throw new Error('كشف الطلاب يحتوي على هوية ناقصة أو طالب مكرر؛ لا يمكن اعتماد المشاركة.');
   ids.add(id);
  }
  return ids.size;
 }
 return Object.freeze({verify,requireValid,requireRoster});
});