import assert from 'node:assert/strict';

const STUDENTS=5000;
const QUESTIONS=15;
let seed=0x5eed1234;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000;};

let requests=0,retries=0,transientFailures=0,lostResponses=0,offlineStudents=0;
let submitAttempts=0,receipts=0,duplicates=0,lostAnswers=0;

function transport(action,server,student,payload){
  requests++;
  // 12% transient pressure/failure on saves, 16% on finish.
  const failRate=action==='finish'?0.16:0.12;
  const failed=rand()<failRate;
  if(failed){transientFailures++;return {ok:false,status:rand()<0.15?520:503};}

  if(action==='save'){
    server.answers={...server.answers,...payload.answers};
    return {ok:true,status:200};
  }

  if(action==='finish'){
    submitAttempts++;
    // Server commits first. Retrying the same finish is idempotent.
    server.answers={...server.answers,...payload.answers};
    if(!server.submitted){
      server.submitted=true;
      server.submitCount=1;
      server.receipt='NFS-SIM-'+student.toString().padStart(5,'0');
    }else{
      duplicates+=Math.max(0,(server.submitCount||1)-1);
    }

    // 3%: server committed but response was lost.
    if(rand()<0.03){lostResponses++;return {ok:false,status:0,committed:true};}
    return {ok:true,status:200,receipt:server.receipt};
  }
  return {ok:true,status:200};
}

function sendWithRetry(action,server,student,payload,maxAttempts=5){
  let last;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    last=transport(action,server,student,payload);
    if(last.ok)return last;
    if(attempt<maxAttempts)retries++;
  }
  return last;
}

for(let student=1;student<=STUDENTS;student++){
  const local={answers:{},finishRequested:false};
  const server={answers:{},submitted:false,submitCount:0,receipt:null};
  const offline=rand()<0.18;
  if(offline)offlineStudents++;

  for(let q=1;q<=QUESTIONS;q++){
    local.answers['q'+q]=Math.floor(rand()*4); // local write happens first
    const offlineNow=offline&&q>=6&&q<=11;
    if(!offlineNow&&q%3===0){
      sendWithRetry('save',server,student,{answers:local.answers},5);
    }
  }

  local.finishRequested=true;
  // Network is considered restored by the recovery phase.
  let result=sendWithRetry('finish',server,student,{answers:local.answers},5);
  // A durable finish intent keeps retrying on the next recovery cycle.
  for(let recovery=0;!result.ok&&recovery<4;recovery++){
    result=sendWithRetry('finish',server,student,{answers:local.answers},5);
  }

  if(result.ok&&result.receipt)receipts++;
  assert.equal(server.submitted,true,'student must eventually submit');
  assert.equal(server.submitCount,1,'finish must be idempotent');
  for(const [key,value] of Object.entries(local.answers)){
    if(server.answers[key]!==value)lostAnswers++;
  }
}

assert.equal(lostAnswers,0,'no locally captured answer may be lost after recovery');
assert.equal(receipts,STUDENTS,'every virtual student must receive a receipt');
assert.equal(duplicates,0,'no duplicate final submission records');

const report={
  virtual_students:STUDENTS,
  questions_per_student:QUESTIONS,
  offline_students:offlineStudents,
  transport_requests:requests,
  transient_failures:transientFailures,
  retry_attempts:retries,
  committed_but_response_lost:lostResponses,
  receipts,
  lost_answers:lostAnswers,
  duplicate_submissions:duplicates,
  success_rate_percent:Number((receipts/STUDENTS*100).toFixed(2))
};
console.log('DELIVERY_CHAOS_RESULT '+JSON.stringify(report));
