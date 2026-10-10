import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeConfig,permuteQuestion,randomFrom,gradeQuestions,publicQuestions,buildForms,cleanAnswers,questionKey,selectUnique} from '../../supabase/functions/nafes-exam/assessment-engine.ts';
import {planReadingPassageAllocation,sequenceLearningQuestions,rebalanceQuestionOptions,matchesBankSnapshot,handleAssessments} from '../../supabase/functions/nafes-exam/assessments.ts';
import analytics from '../../analysis-core.js';
const q={id:'q1',subject:'math',indicator_key:'math:x:i1',indicator_text:'مهارة',question:'مسألة',context:'سياق',options:['نعم','لا','أحيانًا','لا يمكن'],correctIndex:0};
test('shuffling retains exactly the correct answer and never produces -1',()=>{for(let n=0;n<80;n++){const mixed=permuteQuestion(q,randomFrom(String(n)));assert.equal(mixed.options[mixed.correctIndex],'نعم');assert.equal(gradeQuestions([mixed],{q1:mixed.correctIndex}).score,1);}});
test('missing, null, string, boolean and out-of-range answers are never scored as option 0',()=>{for(const value of [undefined,null,'0',false,-1,4]){assert.equal(gradeQuestions([q],{q1:value}).score,0);assert.deepEqual(cleanAnswers([q],{q1:value}),{});}assert.deepEqual(cleanAnswers([q],{q1:0,other:0}),{q1:0});});
test('student questions cannot expose answer keys or teacher evidence',()=>{const safe=publicQuestions([{...q,explanation:'سر',alignment_evidence:{answer:0},indicator_text:'مهارة'}]);assert.deepEqual(Object.keys(safe[0]).sort(),['context','id','image','options','question'].sort());});
const config={kind:'multi_indicator',title:'اختبار',sections:[{subject:'reading',question_count:10,duration_minutes:20,indicators:[{key:'reading:1-1-1-2-9:i1'},{key:'reading:1-1-1-2-9:i4'}]}],settings:{}};
test('custom total allocation measures only selected indicators with fair remainder',()=>{const c=normalizeConfig(config);assert.deepEqual(c.sections[0].indicators.map(i=>[i.indicator,i.count]),[[1,5],[4,5]]);assert.throws(()=>normalizeConfig({...config,sections:[{...config.sections[0],question_count:1}]}));});
test('automated non-simulation tests enforce total range 10 to 60',()=>{
  const withCount=n=>({...config,sections:[{...config.sections[0],question_count:n}]});
  assert.equal(normalizeConfig(withCount(10)).sections[0].question_count,10);
  assert.equal(normalizeConfig(withCount(60)).sections[0].question_count,60);
  assert.throws(()=>normalizeConfig(withCount(9)));
  assert.throws(()=>normalizeConfig(withCount(61)));
});
test('paper review builder is hard-capped to exactly 60 questions',()=>{
  const sixty={...config,paper_review_builder:true,sections:[{...config.sections[0],question_count:60}]};
  assert.equal(normalizeConfig(sixty).sections.reduce((n,s)=>n+s.question_count,0),60);
  assert.throws(()=>normalizeConfig({...sixty,sections:[{...sixty.sections[0],question_count:59}]}));
  assert.throws(()=>normalizeConfig({...sixty,sections:[{...sixty.sections[0],question_count:61}]}));
});
test('paper reading structure requires five-question passage blocks',()=>{
  const readingSection={
    subject:'reading',question_count:20,duration_minutes:20,
    indicators:[
      {key:'reading:1-1-1-2-9:i1',count:5},
      {key:'reading:1-1-1-2-9:i2',count:5},
      {key:'reading:1-1-1-2-9:i3',count:5},
      {key:'reading:1-1-1-2-9:i4',count:5}
    ]
  };
  const mathSection={subject:'math',question_count:20,duration_minutes:20,calculator:true,indicators:[{key:'math:1-1-1-4-9:i1',count:20}]};
  const scienceSection={subject:'science',question_count:20,duration_minutes:20,indicators:[{key:'science:1-1-1-5-9:i1',count:20}]};
  const paper={...config,paper_review_builder:true,review_passage_mode:true,count_mode:'per_indicator',sections:[readingSection,mathSection,scienceSection]};
  assert.equal(normalizeConfig(paper).sections.find(s=>s.subject==='reading').question_count,20);
  assert.throws(()=>normalizeConfig({...paper,sections:[{...readingSection,indicators:readingSection.indicators.map(i=>({...i,count:4})),question_count:20},mathSection,scienceSection]}));
});
test('adaptive reading passage allocation uses actual question capacity without inventing texts',()=>{
  assert.deepEqual(planReadingPassageAllocation([15,15],10),[5,5]);
  assert.deepEqual(planReadingPassageAllocation([3,3,3,3],10),[3,3,2,2]);
  assert.deepEqual(planReadingPassageAllocation([15],10),[10]);
  assert.deepEqual(planReadingPassageAllocation([3,3],10),[]);
  assert.deepEqual(planReadingPassageAllocation([5,5,5],15),[5,5,5]);
});
test('pedagogical question sequence keeps indicators and progresses knowledge to application to reasoning',()=>{
  const mk=(id,indicator,level,difficulty='medium',context='')=>({id,subject:'math',indicator_key:indicator,cognitive_level:level,difficulty,context,question:id,options:['أ','ب','ج','د'],correctIndex:0});
  const raw=[
    mk('a-r','math:x:i1','reasoning','hard'),
    mk('b-a','math:x:i2','application','medium'),
    mk('a-k','math:x:i1','knowledge','easy'),
    mk('b-r','math:x:i2','reasoning','hard'),
    mk('a-a','math:x:i1','application','medium'),
    mk('b-k','math:x:i2','knowledge','easy')
  ];
  const ordered=sequenceLearningQuestions(raw,'math',[{key:'math:x:i1'},{key:'math:x:i2'}]);
  assert.deepEqual(ordered.map(x=>x.id),['a-k','a-a','a-r','b-k','b-a','b-r']);
  const cfg=normalizeConfig({...config,settings:{shuffle_questions:true}});
  assert.equal(cfg.settings.question_sequence,'pedagogical_v1');
  assert.equal(cfg.settings.shuffle_questions,false);
});
test('reading sequence preserves passage blocks and progresses cognitively inside each passage',()=>{
  const q=(id,ctx,level)=>({id,subject:'reading',indicator_key:'reading:x:i1',cognitive_level:level,difficulty:'medium',context:ctx,question:id,options:['أ','ب','ج','د'],correctIndex:0});
  const ordered=sequenceLearningQuestions([q('p1-r','نص 1','reasoning'),q('p2-a','نص 2','application'),q('p1-k','نص 1','knowledge'),q('p2-k','نص 2','knowledge')],'reading',[{key:'reading:x:i1'}]);
  assert.deepEqual(ordered.map(x=>x.id),['p1-k','p1-r','p2-k','p2-a']);
});
test('per indicator counts and publication settings validate ranges and windows',()=>{const c=normalizeConfig({...config,count_mode:'per_indicator',sections:[{...config.sections[0],indicators:config.sections[0].indicators.map(i=>({...i,count:6}))}]});assert.equal(c.sections[0].question_count,12);assert.throws(()=>normalizeConfig({...config,settings:{opens_at:'2026-12-04',closes_at:'2026-12-03'}}));assert.throws(()=>normalizeConfig({...config,settings:{attempts:11}}));});
test('question independence includes passage, data choices and image; option permutations are duplicates',()=>{assert.equal(questionKey(q),questionKey({...q,options:q.options.slice().reverse()}));assert.notEqual(questionKey(q),questionKey({...q,options:['1','2','3','4']}));assert.throws(()=>selectUnique([q,{...q,id:'q2',options:q.options.slice().reverse()}],2,'seed'));});
test('60 distinct simulations each contain 30 unique tasks with balanced exposure',()=>{const pool=Array.from({length:480},(_,i)=>({...q,id:'q'+i,question:'سؤال '+i,indicator_key:'math:x:i'+i%16,cognitive_level:['knowledge','application','reasoning'][i%3]}));const forms=buildForms(pool,'math');assert.equal(forms.length,60);assert.equal(new Set(forms.map(f=>f.signature)).size,60);const count=new Map();for(const f of forms){assert.equal(f.questions.length,30);assert.equal(new Set(f.questions.map(questionKey)).size,30);for(const q of f.questions)count.set(q.id,(count.get(q.id)||0)+1);}assert.ok(Math.max(...count.values())-Math.min(...count.values())<=1);});
const attempt=(id,percent,indicator='math:x:i1',warning='')=>analytics.normalizeAttempt({id,source:'assessment',test_id:'test'+id,student_key:'p',student_name:'اختبار آلي محلي',submitted_at:`2026-01-${id.padStart(2,'0')}T10:00:00Z`,subjects:['math'],status:'submitted',score:percent,total:100,percent,snapshot_warning:warning,questions:Array.from({length:100},(_,i)=>({id:'x'+i,question:'سؤال '+i,question_fingerprint:'fp'+i,subject:'math',indicator_key:indicator,indicator_text:'مهارة',correct_index:0,answer:i<percent?0:1,correct:i<percent,scorable:true}))});
test('analytics preserves all attempts, compares common skills and clears support after recovery',()=>{const xs=[attempt('1',40),attempt('2',50),attempt('3',90)];const r=analytics.studentRows(xs)[0];assert.equal(r.history.length,3);assert.equal(r.trend.delta,40);assert.equal(r.resolved.length,1);assert.equal(r.repeated.length,0);assert.equal(analytics.studentRows(xs.slice(0,2))[0].repeated.length,1);assert.equal(analytics.comparison(xs[0],attempt('4',90,'math:y:i2')),null);});
test('unmeasured and historically invalid records cannot create fake zero mastery',()=>{const bad=attempt('1',0,'math:x:i1','مفتاح غير صالح');assert.equal(analytics.measure(bad).percent,null);assert.equal(analytics.savedPercent(bad),0);assert.equal(analytics.levelFor(null).key,'unmeasured');assert.equal(analytics.indicatorSummary([bad],[{key:'math:y:i2',subject:'math',text:'لم يقس'}])[0].percent,null);});
test('test filter compares prior tests with the same skills without losing selected test count',()=>{const xs=[attempt('1',40),attempt('2',70)];const r=analytics.studentRows(xs,{test:'test2'})[0];assert.equal(r.history.length,1);assert.equal(r.trend.delta,30);});
test('question analysis separates equal stems with different data fingerprints',()=>{const a=attempt('1',60),b=attempt('2',80);a.questions=[{...a.questions[0],question:'أي قائمة؟',question_fingerprint:'abc'}];b.questions=[{...b.questions[0],question:'أي قائمة؟',question_fingerprint:'def'}];assert.equal(analytics.questionSummary([a,b]).length,2);});


test('answer slots balance complete sections for every size 1 to 60 without changing content',()=>{
 for(let n=1;n<=60;n++)for(let seed=0;seed<8;seed++){
  const original=Array.from({length:n},(_,i)=>({...q,id:'q'+i,correctIndex:i%4,context:'passage'+Math.floor(i/5),cognitive_level:['knowledge','application','reasoning'][i%3]}));
  const before=JSON.stringify(original),out=rebalanceQuestionOptions(original,String(seed));
  const counts=[0,0,0,0];
  out.forEach((item,i)=>{counts[item.correctIndex]++;assert(matchesBankSnapshot(original[i],item));assert.equal(item.id,original[i].id);assert.equal(item.context,original[i].context);assert.equal(item.cognitive_level,original[i].cognitive_level);});
  assert(Math.max(...counts)-Math.min(...counts)<=1);
  assert.equal(JSON.stringify(original),before);
 }
});
test('bank snapshot accepts permutations but rejects content or answer tampering',()=>{
 const out=rebalanceQuestionOptions(Array.from({length:20},(_,i)=>({...q,id:'q'+i})),'test');
 for(const item of out){
  const bank={...q,id:item.id};assert(matchesBankSnapshot(bank,item));
  assert(!matchesBankSnapshot(bank,{...item,correctIndex:(item.correctIndex+1)%4}));
  assert(!matchesBankSnapshot(bank,{...item,options:item.options.map((x,i)=>i===0?'changed':x)}));
  assert(!matchesBankSnapshot(bank,{...item,options:[item.options[0],item.options[0],item.options[2],item.options[3]]}));
  for(const field of ['question','context','explanation','indicator_key','cognitive_level','id'])assert(!matchesBankSnapshot(bank,{...item,[field]:'changed'}));
 }
 assert(!matchesBankSnapshot(undefined,q));
 assert.throws(()=>rebalanceQuestionOptions([{...q,correctIndex:-1}],'bad'));
});
test('combining one-question indicators is balanced as a complete section',()=>{
 const singles=Array.from({length:20},(_,i)=>({...q,id:'i'+i,indicator_key:'math:indicator'+i,correctIndex:0}));
 const out=rebalanceQuestionOptions(singles,'mixed');
 assert.deepEqual([0,1,2,3].map(ci=>out.filter(x=>x.correctIndex===ci).length),[5,5,5,5]);
 assert.deepEqual(out.map(x=>x.indicator_key),singles.map(x=>x.indicator_key));
 const replacement=out.map((x,i)=>i===7?{...q,id:'replacement'}:x);
 const rebalanced=rebalanceQuestionOptions(replacement,'replacement');
 assert.deepEqual([0,1,2,3].map(ci=>rebalanced.filter(x=>x.correctIndex===ci).length),[5,5,5,5]);
});


test('publishing repairs an existing unbalanced draft atomically and rejects tampered answers',async()=>{
 const bank=Array.from({length:20},(_,i)=>({id:'q'+i,subject_key:'math',outcome_code:'outcome',indicator_index:i+1,indicator_key:'math:outcome:i'+(i+1),indicator_text:'مهارة '+i,model_no:1,question_no:i+1,context_text:null,question_text:'سؤال مستقل رقم '+i,options:['صحيح','بديل أول','بديل ثان','بديل ثالث'],correct_index:0,explanation:'تفسير',cognitive_level:'knowledge',difficulty:'medium',quality_version:'math-curated-v4',image:null}));
 const questions=bank.map(x=>({id:x.id,subject:'math',outcome:x.outcome_code,indicator:x.indicator_index,indicator_key:x.indicator_key,indicator_text:x.indicator_text,model_no:x.model_no,question_no:x.question_no,context:null,question:x.question_text,options:[...x.options],correctIndex:0,explanation:x.explanation,cognitive_level:x.cognitive_level,difficulty:x.difficulty,image:null}));
 const id='00000000-0000-4000-8000-000000000001';
 const run=async(tamper)=>{
  const draft={id,status:'draft',kind:'multi_indicator',title:'اختبار',config:{},rendered_sections:[{subject:'math',questions:structuredClone(questions)}]};
  if(tamper)draft.rendered_sections[0].questions[0].correctIndex=1;
  const writes=[];
  const db={from(table){let payload=null,byCode=false;const query={select(){return this;},eq(k){if(k==='short_code')byCode=true;return this;},in(){return this;},order(){return this;},range(){return Promise.resolve({data:bank,error:null});},update(p){payload=p;return this;},maybeSingle(){return Promise.resolve({data:table==='nafes_teacher_access'?{id:'owner',subject_scope:'all'}:byCode?null:draft,error:null});},single(){writes.push(payload);return Promise.resolve({data:{...draft,...payload},error:null});}};return query;}};
  const req=new Request('https://test.invalid',{headers:{'x-teacher-key':'1234567890'}});
  if(tamper){await assert.rejects(()=>handleAssessments(db,req,{action:'teacher_publish',draft_id:id}),/تغير البنك/);assert.equal(writes.length,0);return;}
  const result=await handleAssessments(db,req,{action:'teacher_publish',draft_id:id});
  assert.equal(result.auto_rebalanced,true);assert.equal(writes.length,1);assert.equal(writes[0].status,'published');
  const saved=writes[0].rendered_sections[0].questions;
  assert.deepEqual([0,1,2,3].map(ci=>saved.filter(x=>x.correctIndex===ci).length),[5,5,5,5]);
  saved.forEach((item,i)=>assert(matchesBankSnapshot(questions[i],item)));
 };
 await run(false);await run(true);
});

// Regression coverage for multi-subject transitions and recovery.
import "./test-joint-recovery.mjs";

import './test-attempt-timing.mjs';
