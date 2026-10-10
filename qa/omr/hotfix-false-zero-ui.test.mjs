import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const file=readFileSync('review-scan-journal.js','utf8');
const start=file.indexOf('const failedRead=a=>');
const end=file.indexOf('const riskOf=s=>',start);
assert(start>=0&&end>start,'Grade safety helpers not found');
const helpers=file.slice(start,end);
const {failedRead,noGrade,gradeText,safeNumericGrade,verifiedQuality,pendingAnswerCount,scoreMismatch}=runInNewContext(
  "const ar=n=>new Intl.NumberFormat('ar-SA').format(n||0);\n"+helpers+
  "\n({failedRead,noGrade,gradeText,safeNumericGrade,verifiedQuality,pendingAnswerCount,scoreMismatch});"
);
const base={markers_ok:true,omr_reader_error:null,score:0,total:60,omr_verification:{quality_score:97}};
const unreadable={...base,markers_ok:false};
assert.equal(gradeText(unreadable),'فشل القراءة — بلا درجة');
assert.equal(safeNumericGrade(unreadable),'');
assert.equal(verifiedQuality(unreadable),'غير مقاسة');
assert.equal(gradeText({...base,omr_reader_error:'reader_failed'}),'فشل القراءة — بلا درجة');
assert.equal(gradeText({...base,grade_status:'unreadable'}),'فشل القراءة — بلا درجة');
assert.equal(gradeText({...base,grade_status:'needs_review'}),'بانتظار المراجعة — بلا درجة');
assert.equal(safeNumericGrade({...base,score:null}),'');
assert.equal(noGrade({...base,score:null}),true);
assert.equal(failedRead(base),false);
assert.equal(safeNumericGrade(base),0,'real zero must remain zero');
assert(gradeText(base).includes('٠'),'valid optical read must preserve real zero');

const unresolved60={...base,answers:Array.from({length:60},(_,i)=>({
 question:i+1,state:'uncertain',status:'clear',selected:i%4,correct_index:i%4,
 review_pending:true,requires_verification:true,correct:false
}))};
assert.equal(pendingAnswerCount(unresolved60),60);
assert.equal(noGrade(unresolved60),true);
assert.equal(safeNumericGrade(unresolved60),'');
assert(!gradeText(unresolved60).includes('/'),'Pending marked answers must not be printed as 0/60');
assert(gradeText(unresolved60).includes('بانتظار مراجعة'));
const inconsistent={...base,total:2,answers:[
 {state:'correct',status:'clear',correct:true,selected:0,correct_index:0},
 {state:'correct',status:'clear',correct:true,selected:1,correct_index:1}
]};
assert.equal(scoreMismatch(inconsistent),true);
assert.equal(safeNumericGrade(inconsistent),'');
assert(gradeText(inconsistent).includes('لا تطابق'));
const genuineZero={...base,total:2,answers:[
 {state:'blank',status:'blank',correct:false,selected:null},
 {state:'incorrect',status:'clear',correct:false,selected:1,correct_index:0}
]};
assert.equal(pendingAnswerCount(genuineZero),0);
assert.equal(scoreMismatch(genuineZero),false);
assert.equal(safeNumericGrade(genuineZero),0,'Genuine resolved zero must be kept');
assert(gradeText(genuineZero).includes(' / '));
assert(file.includes('الاختيار الملوّن يدل على ما قرأه الماسح'), 'Clarify visual choice versus correctness');
assert(file.includes("safety.unresolvedSheet(s)||failedRead(effective(s))"),'verify button must block failed reads');
assert(file.includes("||failedRead(effective(sheets[active]))"),'verify action must block failed reads');
assert(file.includes("safety.unresolvedSheet(s)||failedRead(effective(s))"),'approve button must block failed reads');
console.log('PASS: failed markers are never score zero or quality 100');
console.log('PASS: genuine resolved zero preserved; pending marks and mismatched totals do not print false zero');
console.log('PASS: verify and approval gated on marker/reader safety');
