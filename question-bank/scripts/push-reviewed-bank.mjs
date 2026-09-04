import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const endpoint=process.env.NAFES_REBUILD_ENDPOINT;
const token=process.env.NAFES_ADMIN_TOKEN;
if(!endpoint||!token)throw new Error('missing rebuild endpoint or token');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const grouped=new Map();
for(const subject of ['math','science']){
 const dir=path.join(root,'question-bank',subject);
 for(const name of fs.readdirSync(dir).filter(name=>name.endsWith('.json')&&name!=='manifest.json').sort()){
  const doc=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
  const key=`${doc.subject_key}|${doc.outcome_code}`;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(doc);
 }
}
const jobs=[...grouped.entries()].map(([key,payload])=>{
 const [subject,outcome_code]=key.split('|');
 payload.sort((a,b)=>a.indicator_index-b.indicator_index||a.model_no-b.model_no);
 return {subject,outcome_code,payload};
});

async function push(job){
 let last;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-nafes-admin':token},body:JSON.stringify({payload:job.payload})});
   const body=await response.json();
   if(!response.ok)throw new Error(`${response.status} ${body.error||JSON.stringify(body)}`);
   if(body.questions!==body.documents*15)throw new Error(`incomplete result ${JSON.stringify(body)}`);
   return body;
  }catch(error){last=error;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*600));}
 }
 throw new Error(`${job.subject}/${job.outcome_code}: ${last?.message||last}`);
}

let next=0,done=0;
async function worker(){while(next<jobs.length){const job=jobs[next++],result=await push(job);done++;console.log(`${done}/${jobs.length} ${result.subject}/${result.outcome}: ${result.questions}`)}}
await Promise.all(Array.from({length:3},()=>worker()));
console.log(JSON.stringify({published_outcomes:done,subjects:2}));
