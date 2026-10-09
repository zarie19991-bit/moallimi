import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=name=>fs.readFileSync(new URL(`../../${name}`,import.meta.url),'utf8');
function context(extra={}){
  const events=new Map(),clicks=[];
  const ctx=vm.createContext({
    console:{error(){},warn(){}},AbortController,setTimeout,clearTimeout,Date,
    addEventListener(name,fn){const list=events.get(name)||[];list.push(fn);events.set(name,list);},
    document:{addEventListener(name,fn){if(name==='click')clicks.push(fn);}},
    ...extra
  });
  ctx.window=ctx;
  return {ctx,events,clicks,run:name=>vm.runInContext(source(name),ctx)};
}
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};

test('unified data service extends the frozen core and normalizes test and class safely',()=>{
  const h=context({NafesTeacher:{api:async()=>({})}});
  h.run('analysis-core.js');
  const core=h.ctx.NafesAnalytics;
  assert(Object.isFrozen(core));
  h.run('analysis-data-service.js');
  const facade=h.ctx.NafesAnalytics;
  assert.notEqual(facade,core);
  assert(Object.isFrozen(facade));
  const raw={id:'local-attempt',assessment_id:'local-test',class_name:'ثالث / ج',score:2,total:3,questions:[]};
  const normalized=facade.normalizeAttempt(raw);
  assert.equal(normalized.test_id,'local-test');
  assert.equal(normalized.class_name,'ج');
  assert.equal(normalized.score,2);
  assert.equal(normalized.total,3);
  assert.equal(facade.normalizeAttempt(raw),normalized);
  assert.equal(raw.class_name,'ثالث / ج');
});

test('light roster enriches identity without changing saved grades and refresh invalidates roster cache',async()=>{
  let fetches=0,clears=0,baseCalls=0;
  const raw={id:'local',student_id:'local-student',source:'assessment',score:8,total:10,percent:80};
  const h=context({
    NafesTeacher:{
      getKey:()=>'local-test-only',
      clearReadCache(){clears++;},
      api:async()=>{baseCalls++;return {attempts:[raw],next_cursor:null};}
    },
    fetch:async()=>{fetches++;return {ok:true,json:async()=>({students:[{id:'local-student',full_name:'طالب اختبار محلي',class_name:'ج'}]})};}
  });
  h.run('analysis-core.js');h.run('analysis-data-service.js');
  const T=h.ctx.NafesTeacher;
  const first=await T.api('teacher_data',{cursor:0,limit:100});
  assert.equal(first.attempts[0].score,8);
  assert.equal(first.attempts[0].percent,80);
  assert.equal(first.attempts[0].student_name,'طالب اختبار محلي');
  assert.equal(first.attempts[0].class_name,'ج');
  assert.equal(raw.class_name,undefined);
  await T.api('teacher_data',{cursor:0,limit:100});
  assert.equal(fetches,1,'roster should be cached between result pages/reads');
  assert.equal(baseCalls,2,'this layer does not replace teacher-access result caching');
  for(const click of h.clicks)click({target:{closest:()=>true}});
  await T.api('teacher_data',{cursor:0,limit:100});
  assert.equal(fetches,2,'refresh must fetch a fresh roster');
  assert.equal(clears,1,'refresh must also clear teacher-access read cache');
});

test('non-advancing or malformed result cursors are rejected',async()=>{
  let result={attempts:[],next_cursor:null};
  const h=context({NafesTeacher:{getKey:()=>'',api:async()=>result}});
  h.run('analysis-core.js');h.run('analysis-data-service.js');
  const T=h.ctx.NafesTeacher;
  for(const next of [0,-1,'100']){
    result={attempts:[],next_cursor:next};
    await assert.rejects(T.api('teacher_data',{cursor:0,limit:100}),/صفحات النتائج بترتيب صحيح/);
  }
  result={attempts:[],next_cursor:100};
  assert.equal((await T.api('teacher_data',{cursor:0,limit:100})).next_cursor,100);
  result={attempts:[],next_cursor:null};
  assert.equal((await T.api('teacher_data',{cursor:100,limit:100})).next_cursor,null);
});

test('a stalled roster request aborts while primary saved results remain available',async()=>{
  const timers=new Map();let timerId=0,fetches=0,signal;
  const original={attempts:[{id:'local',source:'assessment',score:7,total:10}],next_cursor:null};
  const h=context({
    NafesTeacher:{getKey:()=>'local-test-only',api:async()=>original},
    setTimeout(fn){timers.set(++timerId,fn);return timerId;},
    clearTimeout(id){timers.delete(id);},
    fetch:(_url,options)=>{fetches++;signal=options.signal;return new Promise((_,reject)=>{
      signal?.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})));
    });}
  });
  h.run('analysis-core.js');h.run('analysis-data-service.js');
  const T=h.ctx.NafesTeacher;
  const pending=T.api('teacher_data',{cursor:0});
  await settle();
  assert.equal(fetches,1);
  assert.equal(timers.size,1);
  [...timers.values()][0]();
  const page=await pending;
  assert.equal(page.attempts[0].score,7);
  assert.equal(page.attempts[0].total,10);
  assert(signal.aborted);
  await assert.rejects(T.getAnalysisRoster(),/تعذر تحميل كشف الطلاب مؤقتًا|aborted/);
});

test('teacher_students_list uses the same light roster cache',async()=>{
  let fetches=0;
  const h=context({
    NafesTeacher:{getKey:()=>'local-test-only',api:async()=>({students:[]})},
    fetch:async()=>{fetches++;return {ok:true,json:async()=>({students:[{id:'s1',full_name:'طالب',class_name:'أ'}]})};}
  });
  h.run('analysis-core.js');h.run('analysis-data-service.js');
  const first=await h.ctx.NafesTeacher.api('teacher_students_list',{include_archived:false});
  const second=await h.ctx.NafesTeacher.api('teacher_students_list',{include_archived:false});
  assert.equal(first.students.length,1);
  assert.equal(second.students.length,1);
  assert.equal(fetches,1);
});
