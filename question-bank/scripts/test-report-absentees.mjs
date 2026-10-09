import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const {groups,render}=require('../../report-absentees.js');
const roster=[
  {id:'local-a',full_name:'طالب محلي أول',class_name:'أ',national_id_last3:'111',is_active:true},
  {id:'local-b',full_name:'طالب محلي ثان',class_name:'أ',national_id_last3:'222',is_active:true},
  {id:'local-c',full_name:'طالب محلي ثالث',class_name:'ب',national_id_last3:'333',is_active:true},
  {id:'local-archived',full_name:'طالب مؤرشف محلي',class_name:'أ',national_id_last3:'444',is_active:false}
];
const tests=[{id:'local-math',title:'قياس الرياضيات المحلي',subjects:['math'],class_name:'كل الفصول'},
  {id:'local-reading',title:'قياس القراءة المحلي',subjects:['reading'],class_name:'أ'}];
const attempt=(student_id,test_id='local-math',extra={})=>({id:`${student_id}-${test_id}`,student_id,test_id,
  status:'submitted',submitted_at:'2026-09-13T10:00:00Z',score:0,total:10,subjects:['math'],class_name:'أ',...extra});

test('zero scores and repeated submitted attempts count as one tested student',()=>{
  const attempts=[attempt('local-a'),attempt('local-a'),attempt('local-b','local-math',{status:'in_progress'}),
    attempt('local-c','local-math',{status:'expired'}),attempt('local-archived')];
  const [g]=groups({roster:[...roster,roster[0]],attempts,tests,selectedIds:['local-math','local-math']});
  assert.equal(g.total,3);assert.equal(g.tested,1);assert.equal(g.warning,'');
  assert.deepEqual(g.missing.map(s=>s.name),[roster[1].full_name,roster[2].full_name]);
});

test('absence is calculated separately for each test across all classes by default',()=>{
  const gs=groups({roster,tests,selectedIds:['local-math','local-reading'],
    attempts:[attempt('local-a'),attempt('local-b','local-reading',{subjects:['reading']})]});
  assert.equal(gs[0].total,3);assert.equal(gs[1].total,3);
  assert.deepEqual(gs[0].missing.map(s=>s.name),[roster[1].full_name,roster[2].full_name]);
  assert.deepEqual(gs[1].missing.map(s=>s.name),[roster[0].full_name,roster[2].full_name]);
  assert.equal(gs[1].subjectLabel,'القراءة');
});

test('class filters use roster membership and accept the linked student key',()=>{
  const [g]=groups({roster,tests,selectedIds:['local-math'],className:'الثالث / ب',
    attempts:[attempt('', 'local-math',{student_key:'local-c',class_name:'غير محدد'}),
      attempt('unknown-outside-class','local-math',{class_name:'أ'})]});
  assert.equal(g.total,1);assert.equal(g.tested,1);assert.equal(g.warning,'');
  assert.deepEqual(g.missing,[]);
  assert.match(render([g]),/أدّى جميع الطلاب/);
});

test('unlinked results never identify by name alone and never suppress confirmed missing students',()=>{
  const [g]=groups({roster,tests,selectedIds:['local-math'],
    attempts:[attempt('', 'local-math',{student_name:roster[0].full_name,student_no:''})]});
  assert.match(g.warning,/غير المرتبط/);
  assert.equal(g.tested,0);
  assert.equal(g.unresolved,1);
  assert.deepEqual(g.missing.map(s=>s.name),[roster[0].full_name,roster[1].full_name,roster[2].full_name]);
  const html=render([g]);
  assert.match(html,/class="na-table"/);
  assert.match(html,/طالب محلي أول/);
  assert.doesNotMatch(html,/أدّى جميع الطلاب/);
});

test('legacy result links only with unique name plus class plus last3',()=>{
  const [g]=groups({roster,tests,selectedIds:['local-math'],attempts:[attempt('', 'local-math',{
    student_name:'طالب محلي ثالث',student_no:'333',class_name:'ب'
  })]});
  assert.equal(g.tested,1);
  assert.equal(g.unresolved,0);
  assert.deepEqual(g.missing.map(s=>s.name),[roster[0].full_name,roster[1].full_name]);
});

test('empty roster scope is distinct from everyone having tested',()=>{
  const [g]=groups({roster,tests,selectedIds:['local-math'],className:'د'});
  assert.equal(g.total,0);assert.match(g.warning,/لا توجد أسماء/);
  assert.doesNotMatch(render([g]),/أدّى جميع الطلاب/);
  assert.throws(()=>groups({roster:null}),/كشف الطلاب/);
});

test('long lists keep every full name, paginate, and escape imported text',()=>{
  const list=Array.from({length:37},(_,i)=>({id:`private-local-id-${i}`,full_name:`اسم محلي طويل ${i} <طالب>`,class_name:'أ'}));
  const html=render(groups({roster:list,tests,selectedIds:['local-math']}),{style:'weekly',settings:{schoolName:'مدرسة <محلية>'}});
  assert.equal((html.match(/<article /g)||[]).length,3);
  assert.equal((html.match(/nafes-absence-sheet weekly-report/g)||[]).length,3);
  assert.equal((html.match(/<tbody>/g)||[]).length,3);
  for(let i=0;i<37;i++)assert.equal(html.split(`اسم محلي طويل ${i} &lt;طالب&gt;`).length-1,1);
  assert.match(html,/مدرسة &lt;محلية&gt;/);assert.doesNotMatch(html,/<طالب>|private-local-id-/);
});

const source=name=>fs.readFileSync(new URL(`../../${name}`,import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
function harness({attempts=[attempt('local-a')],rosterRead=async()=>({students:roster})}={}){
  const elements=new Map();
  const el=id=>{
    if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',disabled:false,dataset:{},handlers:{},
      addEventListener(name,fn){this.handlers[name]=fn;},setAttribute(){},
      closest(){return {style:{setProperty(){}}};}});
    return elements.get(id);
  };
  const ctx=vm.createContext({console,Intl,Date,localStorage:{getItem:()=>'{}',setItem(){}},addEventListener(){},alert(){},
    setTimeout(fn){fn();return 1;},clearTimeout(){},
    document:{readyState:'complete',getElementById:el,querySelector:()=>el('controls'),
      querySelectorAll:()=>[{dataset:{testId:'local-math'}},{dataset:{testId:'local-reading'}}]},
    NafesTeacher:{getKey:()=>'local-only',api:async action=>{
      if(action==='teacher_students_list')return rosterRead();
      return {attempts,tests,next_cursor:null};
    }},print(){el('printed').innerHTML=el('printRoot').innerHTML;}
  });
  ctx.window=ctx;
  const run=name=>vm.runInContext(source(name),ctx);
  run('analysis-core.js');run('report-absentees.js');
  el('reportSubjectSelect').value='math';
  return {ctx,el,run};
}

test('roster failures leave a printable explanation without invented names or counts',async()=>{
  const h=harness({rosterRead:async()=>{throw new Error('local simulated offline');}});
  const html=await h.ctx.NafesReportAbsentees.create({tests,selectedIds:['local-math']});
  assert.match(html,/تعذر تحميل كشف الطلاب/);
  assert.doesNotMatch(html,/class="na-counts"|class="na-table"|أدّى جميع الطلاب/);
});

test('the subject report includes and prints names even when the selected class has no graded attempts',async()=>{
  const h=harness();h.run('subject-report-separate.js');await settle();
  h.el('reportSubjectTest').value='local-math';h.el('reportSubjectClass').value='ب';
  await h.el('buildSubjectReportBtn').onclick();
  assert.match(h.el('subjectOfficialReport').innerHTML,/طالب محلي ثالث/);
  assert.doesNotMatch(h.el('subjectOfficialReport').innerHTML,/طالب محلي أول|طالب محلي ثان/);
  assert.equal(h.el('printSubjectReportBtn').disabled,false);
  h.el('printSubjectReportBtn').onclick();
  assert.match(h.el('printed').innerHTML,/الطلاب الذين لم يختبروا/);
  assert.match(h.el('printed').innerHTML,/طالب محلي ثالث/);
});

test('switching class after roster load replaces the previous class report',async()=>{
  const h=harness();h.run('subject-report-separate.js');await settle();
  h.el('reportSubjectTest').value='local-math';
  h.el('reportSubjectClass').value='أ';
  await h.el('buildSubjectReportBtn').onclick();
  assert.match(h.el('subjectOfficialReport').innerHTML,/طالب محلي ثان/);
  assert.doesNotMatch(h.el('subjectOfficialReport').innerHTML,/طالب محلي ثالث/);
  h.el('reportSubjectClass').value='ب';
  h.el('reportSubjectClass').handlers.change();
  await settle();
  assert.match(h.el('subjectOfficialReport').innerHTML,/طالب محلي ثالث/);
  assert.doesNotMatch(h.el('subjectOfficialReport').innerHTML,/طالب محلي ثان/);
});

test('the full report prints absentees from all four classes despite class A test metadata',async()=>{
  const schoolRoster=[...roster,
    {id:'local-j',full_name:'طالب محلي من ج',class_name:'ج',national_id_last3:'555',is_active:true},
    {id:'local-d',full_name:'طالب محلي من د',class_name:'د',national_id_last3:'666',is_active:true}];
  const h=harness({rosterRead:async()=>({students:schoolRoster}),
    attempts:[attempt('local-a'),attempt('local-a','local-reading',{subjects:['reading']})]});
  h.run('report-test-options.js');await settle();
  await h.el('buildReportBtn').onclick();
  const html=h.el('reportPreview').innerHTML;
  assert.equal((html.match(/nafes-absence-sheet weekly-report/g)||[]).length,2);
  assert.match(html,/قياس الرياضيات المحلي/);assert.match(html,/قياس القراءة المحلي/);
  const appendices=[...html.matchAll(/<article class="report-sheet nafes-absence-sheet weekly-report"[\s\S]*?<\/article>/g)].map(m=>m[0]);
  assert.equal(appendices.length,2);
  for(const appendix of appendices){
    assert.match(appendix,/الفصل: جميع الفصول/);
    for(const s of schoolRoster.filter(s=>s.is_active&&s.id!=='local-a'))assert(appendix.includes(s.full_name),`Missing ${s.class_name} from report`);
    assert.doesNotMatch(appendix,/طالب محلي أول|طالب مؤرشف محلي/);
  }
  assert.equal(h.el('printReportBtn').disabled,false);
  h.el('printReportBtn').onclick();assert.equal(h.el('printed').innerHTML,html);
});

test('the all-classes subject report uses the selected scope in its title and absence list',async()=>{
  const h=harness({attempts:[attempt('local-a','local-reading',{subjects:['reading']})]});
  h.run('subject-report-separate.js');await settle();
  h.el('reportSubjectSelect').value='reading';h.el('reportSubjectTest').value='local-reading';
  h.el('reportSubjectClass').value='';
  await h.el('buildSubjectReportBtn').onclick();
  const html=h.el('subjectOfficialReport').innerHTML;
  assert.match(html,/الثالث متوسط/);
  assert.doesNotMatch(html,/الثالث متوسط\s*[·/]\s*[أبجد]|الثالث المتوسط · كل الفصول/);
  assert.match(html,/طالب محلي ثالث/);assert.match(html,/الفصل: جميع الفصول/);
  h.el('printSubjectReportBtn').onclick();assert.equal(h.el('printed').innerHTML,html);
});
