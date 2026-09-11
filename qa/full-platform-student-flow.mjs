import https from 'node:https';
const ENDPOINT=new URL('https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam');
const code='QAFULL22';
function post(body){return new Promise(resolve=>{const data=JSON.stringify(body);const req=https.request({hostname:ENDPOINT.hostname,path:ENDPOINT.pathname,method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(data)}},res=>{let raw='';res.setEncoding('utf8');res.on('data',c=>raw+=c);res.on('end',()=>{let parsed={};try{parsed=JSON.parse(raw)}catch{parsed={raw}};resolve({status:res.statusCode,body:parsed});});});req.on('error',e=>resolve({status:0,body:{error:e.message}}));req.write(data);req.end();});}
function ok(r,label){if(r.status!==200||r.body?.error)throw new Error(`${label}: ${r.status} ${JSON.stringify(r.body)}`);return r.body;}
const checks=[];
const info=ok(await post({action:'assessment_info',code}),'info');if(info.sections?.[0]?.question_count!==15)throw new Error('wrong info count');checks.push('assessment_info');
const bad=await post({action:'assessment_start',code,session_id:'qa-wrong-'+Date.now(),student_name:'اسم غير مطابق',student_no:'987',class_name:'QATEST'});if(bad.status===200&&!bad.body?.error)throw new Error('wrong identity accepted');checks.push('wrong_identity_rejected');
const session='qa-full-'+Date.now();
const start=ok(await post({action:'assessment_start',code,session_id:session,student_name:'طالب اختبار شامل مؤقت',student_no:'987',class_name:'QATEST'}),'start');
const qs=(start.sections||[]).flatMap(s=>s.questions||[]);if(qs.length!==15)throw new Error('wrong question count');for(const q of qs)if('correctIndex' in q||'correct_index' in q||'explanation' in q)throw new Error('answer leaked');checks.push('start_no_answer_leak');
const answers=Object.fromEntries(qs.map(q=>[q.id,0]));const common={code,session_id:session,attempt_id:start.attempt_id,access_token:start.access_token,answers,cursor:0};
const saved=ok(await post({action:'assessment_save',...common}),'save');if(Object.keys(saved.answers||{}).length!==15)throw new Error('save count mismatch');checks.push('save_all');
const done=ok(await post({action:'assessment_finish',...common}),'finish');if(!done.submitted||Number(done.total)!==15||!Number.isFinite(Number(done.score))||!Number.isFinite(Number(done.percent)))throw new Error('invalid grade');checks.push('submit_grade');
console.log('FULL_STUDENT_QA_PASS',JSON.stringify({checks,attempt_id:start.attempt_id,score:done.score,total:done.total,percent:done.percent,bad_identity_status:bad.status}));
