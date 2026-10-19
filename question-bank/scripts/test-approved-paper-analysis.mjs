import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisTestCatalog} from '../../supabase/functions/nafes-exam/analysis-test-catalog.ts';
function database(tests,attempts){
 return {from(table){let rows=table==='nafes_assessments'?tests:attempts;const q={
  select(){return q},eq(k,v){rows=rows.filter(r=>(k==='config->>paper_review'?String(r.config?.paper_review):r[k])===v);return q},
  neq(k,v){rows=rows.filter(r=>r[k]!==v);return q},in(k,ids){rows=rows.filter(r=>ids.includes(r[k]));return q},
  not(k,op,v){rows=rows.filter(r=>r[k]!==v);return q},order(){return q},
  range(a,b){return Promise.resolve({data:rows.slice(a,b+1)})},then(resolve){return Promise.resolve({data:rows}).then(resolve)}
 };return q}};
}
test('approved paper appears alongside published exams; unapproved drafts stay absent',async()=>{
 const tests=[{id:'online',status:'published'},{id:'approved',status:'draft',config:{paper_review:true}},
 {id:'pending',status:'draft',config:{paper_review:true}},{id:'demo',status:'draft',config:{paper_review:true}},
 {id:'ordinary',status:'draft'},{id:'simulation',status:'published',kind:'simulation'}];
 const rows=await analysisTestCatalog(database(tests,[
 {id:1,assessment_id:'approved',is_demo:false,submitted_at:'2026-10-19'},
 {id:2,assessment_id:'pending',is_demo:false,submitted_at:null},
 {id:3,assessment_id:'demo',is_demo:true,submitted_at:'2026-10-19'}]));
 assert.deepEqual(rows.map(r=>r.id),['online','approved']);
 assert.equal(rows[1].status,'draft');
});
test('later result pages include another approved paper without duplicating tests',async()=>{
 const tests=['a','b'].map(id=>({id,status:'draft',config:{paper_review:true}}));
 const attempts=Array.from({length:1001},(_,i)=>({id:i,assessment_id:i===1000?'b':'a',is_demo:false,submitted_at:'2026-10-19'}));
 assert.deepEqual((await analysisTestCatalog(database(tests,attempts))).map(r=>r.id),['a','b']);
});
test('database failure is surfaced instead of silently hiding approved tests',async()=>{
 const q={select(){return q},eq(){return q},neq(){return q},then(resolve){return Promise.resolve({error:{message:'unavailable'}}).then(resolve)}};
 await assert.rejects(analysisTestCatalog({from:()=>q}),/unavailable/);
});
