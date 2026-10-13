import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const integrity=require('../../report-integrity.js');
globalThis.NafesReportIntegrity=integrity;
const core=require('../../analysis-core.js');
const absentees=require('../../report-absentees.js');

const base=()=>({
 id:'attempt1',source:'assessment',test_id:'test1',student_id:'student1',
 submitted_at:'2026-10-13T12:00:00Z',status:'submitted',
 student_name:'طالب تجريبي',class_name:'أ',
 subjects:['reading'],current_section:0,
 questions:[{id:'q1',subject:'reading',correct:true,scorable:true},{id:'q2',subject:'reading',correct:false,scorable:true}],
 score:1,total:2,percent:50,section_scores:[{subject:'reading',score:1,total:2,percent:50}]
});
test('verified answers, grade, percent and subject totals accept consistent attempt',()=>{
 const result=integrity.requireValid([base()],{testIds:['test1']});
 assert.equal(result.verified,1);
});
test('wrong grade, wrong total, percent and missing section are blocked instead of printed',()=>{
 const original=base();
 for(const replacement of [{score:0},{total:60},{percent:0},{section_scores:[{subject:'reading',score:0,total:2,percent:0}]},{questions:[original.questions[0],original.questions[0]]},{student_id:null,student_key:null}]){
  assert.throws(()=>integrity.requireValid([{...original,...replacement}],{testIds:['test1']}),/أُوقف إنشاء التقرير/);
 }
});
test('only selected assessments are verified and duplicate attempts are blocked',()=>{
 assert.equal(integrity.requireValid([{...base(),score:0}],{testIds:['another']}).verified,0);
 assert.throws(()=>integrity.requireValid([base(),base()]),/محاولة مكررة/);
});
test('missing and duplicate roster identities prohibit participation reporting',()=>{
 assert.throws(()=>integrity.requireRoster([]),/كشف طلاب/);
 assert.throws(()=>integrity.requireRoster([{id:'x',full_name:'طالب',class_name:'أ'},{id:'x',full_name:'طالب',class_name:'أ'}]),/مكرر/);
 assert.equal(integrity.requireRoster([{id:'x',full_name:'طالب',class_name:'أ'}]),1);
});
test('unfinished joint assessment does not count unreached subjects as zero',()=>{
 const student={id:'student1',full_name:'طالب تجريبي',class_name:'أ',is_active:true};
 const attempt={...base(),subjects:['science','math','reading'],current_section:1,
  questions:[{id:'s',subject:'science',correct:true,scorable:true},{id:'m',subject:'math',correct:false,scorable:true},{id:'r',subject:'reading',correct:false,scorable:true}],
  section_scores:[{subject:'science',score:1,total:1,percent:100},{subject:'math',score:0,total:1,percent:0},{subject:'reading',score:0,total:1,percent:0}]};
 assert.equal(core.reachedSubject(attempt,'science'),true);
 assert.equal(core.reachedSubject(attempt,'math'),true);
 assert.equal(core.reachedSubject(attempt,'reading'),false);
 assert.equal(core.measure(attempt,{subject:'reading'}).total,0);
 assert.equal(core.measure(attempt,{subject:'math'}).total,1);
 const args={roster:[student],attempts:[attempt],tests:[{id:'test1',subjects:attempt.subjects}],selectedIds:['test1']};
 assert.equal(absentees.groups({...args,subject:'science'})[0].tested,1);
 assert.equal(absentees.groups({...args,subject:'math'})[0].tested,1);
 assert.equal(absentees.groups({...args,subject:'reading'})[0].tested,0);
 assert.equal(absentees.groups({...args,subject:'reading'})[0].missing.length,1);
});
