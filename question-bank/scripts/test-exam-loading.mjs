import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../../e-player-demo-fix.js',import.meta.url),'utf8');
const block=s.slice(s.indexOf('let infoLoading=false;'),s.indexOf("$('retryLoad').onclick"));
function harness(api){const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{textContent:'',hidden:true,disabled:false,value:'',removeAttribute(){}});return els.get(id)};
 const c={api,active:false,info:undefined,$:el,code:'ABCDEFGH',demoAccessCode:'',names:{math:'الرياضيات'},ar:String,params:{},classSection:()=>'',restoreIdentity:()=>false,readResumeMarker:()=>null,resumeAttempt:async()=>false,document:{querySelector:()=>null}};
 vm.createContext(c);vm.runInContext(block,c);return{c,el};}
const info={title:'اختبار',sections:[{subject:'math',question_count:20,duration_minutes:45}]};
test('failed initial load exposes retry and does not enable entry',async()=>{const {c,el}=harness(async()=>{throw Error('timeout')});await c.loadExamInfo();assert.equal(el('retryLoad').hidden,false);assert.equal(el('startBtn').disabled,true);assert.equal(el('title').textContent,'تعذر فتح الاختبار');});
test('retry loads metadata without replacing typed student details',async()=>{let calls=0;const {c,el}=harness(async()=>{if(!calls++)throw Error('timeout');return info});el('studentName').value='طالب اختبار';await c.loadExamInfo();await c.loadExamInfo();assert.equal(el('startBtn').disabled,false);assert.equal(el('retryLoad').hidden,true);assert.equal(el('title').textContent,'اختبار');assert.equal(el('studentName').value,'طالب اختبار');});
test('repeated retry taps share one pending metadata load',async()=>{let resolve,calls=0;const {c}=harness(()=>{calls++;return new Promise(r=>resolve=r)});const p=c.loadExamInfo();await c.loadExamInfo();assert.equal(calls,1);resolve(info);await p;});
test('metadata query excludes question snapshots, while normal assessment lookup remains complete',async()=>{
 const source=fs.readFileSync(new URL('../../supabase/functions/nafes-exam/assessments.ts',import.meta.url),'utf8');
 const raw=source.slice(source.indexOf('async function assessment('),source.indexOf('function studentInfo(')).replace('db:any,code:unknown','db,code');let cols;
 const db={from:()=>({select(c){cols=c;return this},eq(){return this},async maybeSingle(){return{data:{id:'test'}}}})};
 const ctx={must:r=>r.data,fail:m=>{throw Error(m)}};vm.createContext(ctx);vm.runInContext(raw,ctx);
 await ctx.assessment(db,'ABCDEFGH',true);assert.equal(cols,'id,short_code,title,kind,config,legacy_target');
 await ctx.assessment(db,'ABCDEFGH');assert.equal(cols,'*');
 assert.match(source,/body.action==='assessment_info'\)\{const t=await assessment\(db,body.code,true\)/);
});
