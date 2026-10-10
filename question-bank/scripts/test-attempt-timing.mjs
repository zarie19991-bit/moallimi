import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cleanTimingEvents,recordTiming} from '../../supabase/functions/nafes-exam/timing.ts';
import {handleAssessments} from '../../supabase/functions/nafes-exam/assessments.ts';
const root=new URL('../../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const id='10000000-0000-4000-8000-000000000001',now=new Date().toISOString();
const attempt={id,assessment_id:id,started_at:now,expires_at:new Date(Date.now()+60000).toISOString(),config:{},rendered_sections:[{subject:'math',questions:[{id:'q',question:'Q',options:['a','b'],correctIndex:0}]}]};
test('timing takes identity and subject from authenticated attempt and clamps input',()=>{
 const events=cleanTimingEvents({timing_events:[{id,type:'pulse',section:0,at:now,visible_ms:900000,subject:'reading',attempt_id:'other'},{id,type:'pulse',section:2},{id:'bad',type:'pulse',section:0}]},attempt,'assessment');
 assert.equal(events.length,1);assert.equal(events[0].attempt_id,id);assert.equal(events[0].subject,'math');assert.equal(events[0].visible_ms,45000);assert(!('answers' in events[0]));
});
test('retries insert the same event once, without updating attempt grades',async()=>{let writes=0;await recordTiming({from(table){assert.equal(table,'nafes_attempt_activity');return{async upsert(rows,opts){writes++;assert.equal(opts.ignoreDuplicates,true);assert.equal(opts.onConflict,'id');return{error:null}}}}},attempt,{timing_events:[{id,type:'pulse',section:0,at:now,visible_ms:30000}]},'assessment');assert.equal(writes,1);});
function teacherDb(scope){return{from(table){const chain={select(){return this},eq(){return this},in(){return this},order(){return this},async maybeSingle(){return{data:{id:'owner',subject_scope:scope}}},async range(){return{data:[{attempt_id:id,subject:'math',event_type:'pulse'},{attempt_id:id,subject:'reading',event_type:'pulse'}]}},then(resolve){resolve({data:[attempt]})}};return chain;}}}
test('timing report requires teacher auth and filters events to subject permission',async()=>{
 await assert.rejects(()=>handleAssessments(teacherDb('math'),new Request('https://test'),{action:'teacher_timing',source:'assessment',attempt_ids:[id]}));
 const req=new Request('https://test',{headers:{'x-teacher-key':'1234567890'}});
 const d=await handleAssessments(teacherDb('math'),req,{action:'teacher_timing',source:'assessment',attempt_ids:[id]});assert.equal(d.events.length,1);assert.equal(d.events[0].subject,'math');
 const other=await handleAssessments(teacherDb('reading'),req,{action:'teacher_timing',source:'assessment',attempt_ids:[id]});assert.equal(other.events.length,0);
});
function report(){const els=new Map(),document={getElementById(id){if(!els.has(id))els.set(id,{});return els.get(id)},querySelector(){return {addEventListener(){}}}};const window={NafesTeacher:{}};vm.runInNewContext(read('attempt-timing-report.js'),{window,document,addEventListener(){},Date,Map,Set,console});return window.NafesTimingSummary;}
test('report does not invent old activity and merges overlapping browser intervals',()=>{
 const summarize=report(),a={started_at:'2026-10-10T00:00:00Z',submitted_at:'2026-10-10T00:01:00Z',expires_at:'2026-10-10T00:10:00Z'};
 assert.equal(summarize(a,[]).observed,null);assert.equal(summarize(a,[]).elapsed,60000);
 const events=[{event_type:'pulse',subject:'math',occurred_at:'2026-10-10T00:00:30Z',visible_ms:30000},{event_type:'pulse',subject:'math',occurred_at:'2026-10-10T00:00:45Z',visible_ms:30000}];const r=summarize(a,events);assert.equal(r.observed,45000);assert.equal(r.by.math,45000);assert.match(r.signals,/لا توجد أدلة/);
});
test('browser clock sampling excludes hidden and suspended time without duplicate entry per render',async()=>{
 let clock=0,online=false;const handlers={},store=new Map(),window={},document={hidden:false,addEventListener(n,f){handlers[n]=f}},intervals=[];
 const context={window,document,performance:{now:()=>clock},navigator:{get onLine(){return online}},crypto:{randomUUID:()=>crypto.randomUUID()},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},addEventListener(n,f){handlers[n]=f},setInterval(f){intervals.push(f);return 1},clearInterval(){},setTimeout(){},Date,JSON,Blob,Set};
 vm.runInNewContext(read('exam-activity.js'),context);const tracker=window.NafesActivity.create({url:'x',isActive:()=>true,payload:()=>({})});tracker.update(id);tracker.update(id);clock=10000;document.hidden=true;handlers.visibilitychange();clock=30000;intervals[0]();clock=40000;document.hidden=false;handlers.visibilitychange();clock=100000;intervals[0]();tracker.stop();const q=JSON.parse(store.get('nafes_activity_v1_'+id));assert.equal(q.filter(e=>e.type==='entry').length,1);assert.equal(q.reduce((s,e)=>s+e.visible_ms,0),10000);
});
test('production bundle includes both tracker and report before use',()=>{for(const file of ['exam-activity.js','attempt-timing-report.js'])assert(read('production-files.txt').split('\n').includes(file));assert(read('e.html').indexOf('exam-activity.js')<read('e.html').indexOf('e-player-demo-fix.js'));assert(read('exam.html').indexOf('exam-activity.js')<read('exam.html').indexOf('src="exam.js'));});
