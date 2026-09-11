// trigger qa workflow
import https from 'node:https';

const endpoint = new URL('https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam');
const code = 'RANDTS22';
const students = [1,2,3,4,5].map(n=>({
  student_name:`qa random student ${String(n).padStart(3,'0')}`,
  student_no:String(n).padStart(3,'0'),
  class_name:'QATEST',
  session_id:`qa-rand-${Date.now()}-${n}`
}));

function post(payload){
  return new Promise(resolve=>{
    const data=JSON.stringify(payload);
    const req=https.request({hostname:endpoint.hostname,path:endpoint.pathname,method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(data)}},res=>{
      let raw='';res.setEncoding('utf8');res.on('data',c=>raw+=c);res.on('end',()=>{let body={};try{body=JSON.parse(raw)}catch{body={raw}};resolve({status:res.statusCode,body});});
    });
    req.on('error',e=>resolve({status:0,body:{error:e.message}}));req.write(data);req.end();
  });
}

const results=await Promise.all(students.map(s=>post({action:'assessment_start',code,...s})));
const sigs=[];
for(let i=0;i<results.length;i++){
  const r=results[i];
  if(r.status!==200||r.body?.error){console.log('START_FAIL',i+1,r.status,JSON.stringify(r.body));continue;}
  const sections=r.body.sections||r.body.assessment?.sections||[];
  const questions=sections.flatMap(s=>s.questions||[]);
  const qsig=questions.map(q=>q.id).join('|');
  const osig=questions.map(q=>`${q.id}:${(q.options||[]).join('~')}`).join('||');
  sigs.push({n:i+1,qsig,osig,count:questions.length,attempt_id:r.body.attempt_id});
  console.log('STUDENT',i+1,'COUNT',questions.length,'Q_SIG',qsig,'O_SIG',osig);
}
const uniqueQ=new Set(sigs.map(x=>x.qsig)).size;
const uniqueO=new Set(sigs.map(x=>x.osig)).size;
console.log('SUMMARY',JSON.stringify({started:sigs.length,unique_question_orders:uniqueQ,unique_option_orders:uniqueO,total:sigs.length}));
if(sigs.length!==5||uniqueQ<2||uniqueO<2)process.exitCode=1;
