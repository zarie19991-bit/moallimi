import https from 'node:https';
const ENDPOINT=new URL('https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam');
const code='QALOAD22';
const students=Array.from({length:140},(_,i)=>{const n=String(i+1).padStart(3,'0');return{student_name:`طالب ضغط ١٤٠ ${n}`,student_no:n,class_name:'QALOAD',session_id:`qa140-${Date.now()}-${n}`}});
function post(body){const started=performance.now();return new Promise(resolve=>{const data=JSON.stringify(body);const req=https.request({hostname:ENDPOINT.hostname,path:ENDPOINT.pathname,method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(data)}},res=>{let raw='';res.setEncoding('utf8');res.on('data',c=>raw+=c);res.on('end',()=>{let parsed={};try{parsed=JSON.parse(raw)}catch{parsed={raw}};resolve({status:res.statusCode,body:parsed,ms:performance.now()-started});});});req.on('error',e=>resolve({status:0,body:{error:e.message},ms:performance.now()-started}));req.write(data);req.end();});}
function percentile(xs,p){const a=[...xs].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]||0}
const starts=await Promise.all(students.map(s=>post({action:'assessment_start',code,...s})));
const good=starts.map((r,i)=>({r,s:students[i]})).filter(x=>x.r.status===200&&!x.r.body?.error&&x.r.body?.attempt_id&&x.r.body?.access_token);
const startErrors=starts.filter(r=>r.status!==200||r.body?.error).map(r=>({status:r.status,error:r.body?.error||''}));
console.log('START_SUMMARY',JSON.stringify({requested:140,success:good.length,failed:140-good.length,p50_ms:Math.round(percentile(starts.map(x=>x.ms),.5)),p95_ms:Math.round(percentile(starts.map(x=>x.ms),.95)),max_ms:Math.round(Math.max(...starts.map(x=>x.ms))),errors:startErrors}));
const saves=await Promise.all(good.map(({r,s})=>{const qs=(r.body.sections||[]).flatMap(sec=>sec.questions||[]);const answers=Object.fromEntries(qs.map(q=>[q.id,0]));return post({action:'assessment_save',code,session_id:s.session_id,attempt_id:r.body.attempt_id,access_token:r.body.access_token,answers,cursor:0}).then(x=>({...x,_answers:answers,_start:r,_student:s}))}));
const saveGood=saves.filter(x=>x.status===200&&!x.body?.error);
console.log('SAVE_SUMMARY',JSON.stringify({requested:good.length,success:saveGood.length,failed:good.length-saveGood.length,p50_ms:Math.round(percentile(saves.map(x=>x.ms),.5)),p95_ms:Math.round(percentile(saves.map(x=>x.ms),.95)),max_ms:Math.round(Math.max(0,...saves.map(x=>x.ms)))}));
const submits=await Promise.all(saveGood.map(x=>post({action:'assessment_finish',code,session_id:x._student.session_id,attempt_id:x._start.r.body.attempt_id,access_token:x._start.r.body.access_token,answers:x._answers,cursor:0})));
const submitGood=submits.filter(x=>x.status===200&&!x.body?.error&&x.body?.submitted===true);
console.log('SUBMIT_SUMMARY',JSON.stringify({requested:saveGood.length,success:submitGood.length,failed:saveGood.length-submitGood.length,p50_ms:Math.round(percentile(submits.map(x=>x.ms),.5)),p95_ms:Math.round(percentile(submits.map(x=>x.ms),.95)),max_ms:Math.round(Math.max(0,...submits.map(x=>x.ms)))}));
if(good.length!==140||saveGood.length!==140||submitGood.length!==140)process.exitCode=1;
