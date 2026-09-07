import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const release=JSON.parse(fs.readFileSync('question-bank/reviewed-release.json','utf8'));
const context={window:{}};vm.createContext(context);
const counts={reading:16,math:95,science:159};
const jobs=[];const published=[];
for(const [subject,count] of Object.entries(counts)){
  vm.runInContext(fs.readFileSync(`nafes-${subject}.js`,'utf8'),context);
  const framework=context.window[`NAFES_${subject.toUpperCase()}`];
  const expected=framework.outcomes.flatMap(o=>o.indicators.map((text,index)=>({outcome:o.code,index:index+1,text})));
  assert.equal(expected.length,count);
  const manifest=release.subjects[subject];
  if(!manifest)continue;
  assert.equal(manifest.review_version,'question-review-v4');
  assert.equal(manifest.subject,subject);assert.equal(manifest.indicator_count,count);assert.equal(manifest.question_count,count*30);
  assert.equal(manifest.indicators.length,count);
  manifest.indicators.forEach((i,n)=>{
    const e=expected[n];assert.equal(i.outcome_code,e.outcome);assert.equal(i.indicator_index,e.index);assert.equal(i.indicator_text,e.text);assert.equal(i.indicator_no,n+1);
    assert.deepEqual(i.models.map(m=>m.model_no),[1,2]);
    for(const m of i.models){
      assert.equal(m.question_count,15);assert.match(m.content_sha256,/^[a-f0-9]{64}$/);assert.equal(m.questions.length,15);
      m.questions.forEach((q,z)=>{assert.equal(q.question_no,z+1);assert.match(q.sha256,/^[a-f0-9]{64}$/);assert.equal(typeof q.has_image,'boolean');});
      jobs.push({action:'preview',subject,outcome:e.outcome,indicator:e.index,indicator_text:e.text,model:m.model_no});
    }
  });published.push(subject);
}
assert.ok(published.length,'Release must identify its published reviewed subjects');
assert.match(fs.readFileSync('exam.js','utf8'),/MODEL_COUNT=2/);
if(process.argv.includes('--live')){
  let next=0;const errors=[];
  async function work(){while(next<jobs.length){const job=jobs[next++];let failure;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetch('https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(job),signal:AbortSignal.timeout(25000)});
        const result=await response.json();
        assert.ok(response.ok&&result.ready,JSON.stringify(result));
        assert.equal(result.engine,'reviewed_question_bank');assert.equal(result.bank?.review_version,'question-review-v4');
        assert.equal(result.bank?.approved_count,15);assert.equal(result.indicator_bank?.approved_count,30);assert.equal(result.indicator_bank?.distinct_questions,30);
        failure=null;break;
      }catch(error){failure=error.message;}
    }
    if(failure)errors.push({subject:job.subject,outcome:job.outcome,indicator:job.indicator,model:job.model,error:failure});
  }}
  await Promise.all(Array.from({length:6},work));
  if(errors.length){console.error(JSON.stringify(errors));process.exit(1);}
}
console.log(JSON.stringify({frameworkIndicators:270,publishedReviewedSubjects:published,reviewedTestsChecked:jobs.length,live:process.argv.includes('--live')}));
