import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const source=name=>process.env.NAFES_ANALYSIS_BASELINE==='1'
  ? execFileSync('git',['show',`HEAD:${name}`],{encoding:'utf8'})
  : fs.readFileSync(new URL(`../../${name}`,import.meta.url),'utf8');
function context(extra={}){
  const events=new Map(),clicks=[];
  const ctx=vm.createContext({
    console:{error(){},warn(){}},AbortController,setTimeout,clearTimeout,
    addEventListener(name,fn){const list=events.get(name)||[];list.push(fn);events.set(name,list);},
    document:{addEventListener(name,fn){if(name==='click')clicks.push(fn);}},
    ...extra
  });
  ctx.window=ctx;
  return {ctx,events,clicks,run:name=>vm.runInContext(source(name),ctx)};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('opening analysis and restoring a class label settle without a DOM mutation loop',()=>{
  const options=new Map(),pending=[],observers=[];
  let active=false;
  for(const id of ['overviewClass','subjectClass','reportSubjectClass']){
    let text='كل الفصول';
    options.set(id,{get textContent(){return text;},set textContent(value){
      text=value;
      // DOM textContent replaces the text node even if its value is unchanged.
      if(active)pending.push({addedNodes:[{nodeType:3}]});
    }});
  }
  const doc={readyState:'complete',
    getElementById(id){const option=options.get(id);return option?{querySelector:()=>option}:null;},
    querySelectorAll(){return [];},body:{},addEventListener(){}
  };
  const h=context({document:doc,NafesTeacher:{getKey:()=>''},
    queueMicrotask:fn=>pending.push(fn),
    MutationObserver:class{constructor(fn){observers.push(fn);}observe(){active=true;}}
  });
  h.run('analysis-participation.js');
  options.get('overviewClass').textContent='كل الفصول';
  let turns=0;
  while(pending.length){
    assert(++turns<12,'the page never returns control to the browser');
    const batch=pending.splice(0);
    for(const fn of observers)fn(batch.filter(x=>typeof x!=='function'));
    for(const task of batch)if(typeof task==='function')task();
  }
  for(const option of options.values())assert.equal(option.textContent,'الثالث متوسط (أ - ب - ج - د)');
});

test('normalization extends the frozen core and shares repeated normalization',()=>{
  const h=context();h.run('analysis-core.js');
  const core=h.ctx.NafesAnalytics;
  assert(Object.isFrozen(core));
  h.run('data-normalization-fix.js');
  const facade=h.ctx.NafesAnalytics;
  assert.notEqual(facade,core);assert(Object.isFrozen(core));
  const raw={id:'local-attempt',assessment_id:'local-test',class_name:'ثالث / ج',score:2,total:3,questions:[]};
  const normalized=facade.normalizeAttempt(raw);
  assert.equal(normalized.test_id,'local-test');assert.equal(normalized.class_name,'ج');
  assert.equal(normalized.score,2);assert.equal(normalized.total,3);
  assert.equal(facade.normalizeAttempt(raw),normalized);
  assert.equal(raw.class_name,'ثالث / ج');assert.equal(core.__nafesNormalizationFix,undefined);
});

test('analysis modules share result pages; retry invalidates both read caches',async()=>{
  let calls=0,clears=0;
  const h=context({NafesTeacher:{api:async()=>{calls++;return {attempts:[],next_cursor:null};},clearReadCache(){clears++;}}});
  h.run('analysis-core.js');h.run('data-normalization-fix.js');
  const T=h.ctx.NafesTeacher;
  const pages=await Promise.all(Array.from({length:5},()=>T.api('teacher_data',{cursor:0,limit:100})));
  assert.equal(calls,1);assert(pages.every(p=>p===pages[0]));
  for(const click of h.clicks)click({target:{closest:()=>true}});
  await T.api('teacher_data',{cursor:0,limit:100});
  assert.equal(calls,2);assert.equal(clears,1);
});

test('missing or non-advancing pagination fails instead of looping over cached pages',async()=>{
  let result={attempts:[]};
  const h=context({NafesTeacher:{api:async()=>result}});
  h.run('analysis-core.js');h.run('data-normalization-fix.js');
  const T=h.ctx.NafesTeacher;
  for(const next of [undefined,0,-1,'100']){
    result={attempts:[],next_cursor:next};
    await assert.rejects(T.api('teacher_data',{cursor:0,limit:100}),/لم تصل بيانات التحليل كاملة/);
  }
  result={attempts:[],next_cursor:100};
  assert.equal((await T.api('teacher_data',{cursor:0,limit:100})).next_cursor,100);
  result={attempts:[],next_cursor:null};
  assert.equal((await T.api('teacher_data',{cursor:100,limit:100})).next_cursor,null);
});

test('a stalled roster request aborts and preserves primary saved results',async()=>{
  const timers=new Map();let timerId=0,fetches=0,signal;
  const original={attempts:[{id:'local',source:'assessment',score:7,total:10}],next_cursor:null};
  const h=context({NafesTeacher:{getKey:()=>'local-test-only',api:async()=>original},
    setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},
    fetch:(_url,options)=>{fetches++;signal=options.signal;return new Promise((_,reject)=>{
      signal?.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})));
    });}
  });
  h.run('analysis-achievement-fix.js');
  const T=h.ctx.NafesTeacher;
  const first=T.api('teacher_data',{cursor:0});
  const concurrent=T.api('teacher_data',{cursor:0});
  await settle();assert.equal(fetches,1);assert.equal(timers.size,1);
  [...timers.values()][0]();
  assert.equal(await first,original);assert.equal(await concurrent,original);assert(signal.aborted);
  const next=await T.api('teacher_data',{cursor:100});
  assert.equal(next.attempts[0].score,7);assert.equal(next.attempts[0].total,10);
  assert.equal(fetches,1);assert.equal(timers.size,0);
  await assert.rejects(T.getAnalysisRoster(),/aborted/);
});

test('the light roster enriches identity without changing grades and refresh reads it again',async()=>{
  let fetches=0;
  const raw={id:'local',student_id:'local-student',source:'assessment',score:8,total:10,percent:80};
  const h=context({NafesTeacher:{getKey:()=>'local-test-only',api:async()=>({attempts:[raw],next_cursor:null})},
    fetch:async()=>{fetches++;return {ok:true,json:async()=>({students:[{id:'local-student',full_name:'طالب اختبار محلي',class_name:'ج'}]})};}
  });
  h.run('analysis-achievement-fix.js');
  const T=h.ctx.NafesTeacher;
  const page=await T.api('teacher_data');
  assert.equal(page.attempts[0].score,8);assert.equal(page.attempts[0].class_name,'ج');
  assert.equal(raw.score,8);assert.equal(raw.class_name,undefined);
  assert.equal((await T.getAnalysisRoster()).students.length,1);
  for(const click of h.clicks)click({target:{closest:()=>true}});
  assert.equal((await T.api('teacher_data')).attempts[0].percent,80);
  assert.equal(fetches,2);
});
