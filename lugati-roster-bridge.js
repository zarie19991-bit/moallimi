(()=>{
'use strict';
const originalFetch=window.fetch.bind(window);
const READ_MARK='/functions/v1/lugati-moallimi-read';
const STARTER={subject_key:'reading',outcome_code:'1-1-1-2-9',indicator_index:1,indicator_text:'علاج تمهيدي للطالب الذي لم يؤد اختبار نافس بعد'};
function parseBody(init){try{return typeof init?.body==='string'?JSON.parse(init.body):null}catch{return null}}
function headersOf(init){return init?.headers||{'Content-Type':'application/json'}}
async function action(url,headers,payload){return originalFetch(url,{method:'POST',headers,body:JSON.stringify(payload)})}
function responseLike(source,data){const headers=new Headers(source.headers);headers.set('content-type','application/json; charset=utf-8');return new Response(JSON.stringify(data),{status:source.status,statusText:source.statusText,headers})}
function resultStudentIds(rows){return new Set((rows||[]).map(r=>String(r?.student_id||'')).filter(Boolean))}
function pseudoGrade(s){return{source:'roster',id:`roster:${s.id}`,test_id:null,student_id:s.id,student_name:s.full_name,class_name:s.class_name,grade:s.grade,subject_key:'untested',score:null,total:null,percent:null,submitted_at:null,indicator_index:null,outcome_code:null,no_attempt:true}}
function pseudoIndicator(s){return{key:`untested:${s.id}`,student_id:s.id,student_name:s.full_name,class_name:s.class_name,source:'not_tested',attempt_id:null,submitted_at:null,subject_key:STARTER.subject_key,outcome_code:STARTER.outcome_code,indicator_index:STARTER.indicator_index,indicator_text:STARTER.indicator_text,correct:0,total:0,percent:0,no_attempt:true}}
window.fetch=async function(input,init={}){
 const url=typeof input==='string'?input:String(input?.url||'');
 const body=parseBody(init);
 const res=await originalFetch(input,init);
 if(!url.includes(READ_MARK)||!body||!res.ok||!['grades','summary'].includes(body.action))return res;
 const data=await res.clone().json().catch(()=>null);if(!data)return res;
 try{
   const headers=headersOf(init);
   if(body.action==='grades'){
     const rr=await action(url,headers,{action:'students'});if(!rr.ok)return res;
     const roster=(await rr.json()).students||[];
     const ids=resultStudentIds(data.rows);
     const missing=roster.filter(s=>!ids.has(String(s.id)));
     data.rows=[...(data.rows||[]),...missing.map(pseudoGrade)];
     data.roster_total=roster.length;data.untested_count=missing.length;
     return responseLike(res,data);
   }
   const [rr,gr]=await Promise.all([action(url,headers,{action:'students'}),action(url,headers,{action:'grades',limit:1000})]);
   if(!rr.ok||!gr.ok)return res;
   const roster=(await rr.json()).students||[];
   const gradeRows=(await gr.json()).rows||[];
   const ids=resultStudentIds(gradeRows);
   const missing=roster.filter(s=>!ids.has(String(s.id)));
   data.indicators=data.indicators||{};
   data.indicators.latest_student_indicators=Array.isArray(data.indicators.latest_student_indicators)?data.indicators.latest_student_indicators:[];
   const existing=new Set(data.indicators.latest_student_indicators.map(x=>String(x?.student_id||'')));
   for(const s of missing)if(!existing.has(String(s.id)))data.indicators.latest_student_indicators.push(pseudoIndicator(s));
   data.untested_students=missing.map(s=>({id:s.id,full_name:s.full_name,class_name:s.class_name,grade:s.grade,remedial_starter:true}));
   if(data.totals){data.totals.students=roster.length;data.totals.students_with_results=ids.size;data.totals.students_without_results=missing.length;}
   return responseLike(res,data);
 }catch(err){console.warn('lugati roster bridge',err);return res}
};
})();
