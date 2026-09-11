import https from 'node:https';
import crypto from 'node:crypto';
const endpoint = new URL('https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-results-admin');
const teacherKey = crypto.createHash('sha256').update('qa-delete-teacher-2026-09-11').digest('hex');
const assessmentId='6954ccf7-3688-4ade-a0e2-c56cc7d99cd7';
const attemptId='496d4dc8-fc57-4e35-9ca7-db30edf1692a';
const studentId='86326cbe-e44c-4ba9-a24a-8156ecafaba5';
function post(body){return new Promise(resolve=>{const data=JSON.stringify(body);const req=https.request({hostname:endpoint.hostname,path:endpoint.pathname,method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(data),'x-teacher-key':teacherKey}},res=>{let raw='';res.setEncoding('utf8');res.on('data',c=>raw+=c);res.on('end',()=>{let parsed={};try{parsed=JSON.parse(raw)}catch{parsed={raw}};resolve({status:res.statusCode,body:parsed});});});req.on('error',e=>resolve({status:0,body:{error:e.message}}));req.write(data);req.end();});}
const individual=await post({action:'teacher_attempt_delete',source:'assessment',attempt_id:attemptId,student_id:studentId,test_id:assessmentId,confirm_word:'حذف النتيجة'});
console.log('INDIVIDUAL',JSON.stringify(individual));if(individual.status!==200||individual.body?.deleted!==1)process.exit(2);
const selected=await post({action:'teacher_tests_bulk_clear',test_ids:[assessmentId],clear_all:false,confirm_word:'مسح النتائج'});
console.log('SELECTED_CLEAR',JSON.stringify(selected));if(selected.status!==200||Number(selected.body?.total_cleared)!==2)process.exit(3);
console.log('DELETE_QA_PASS');
