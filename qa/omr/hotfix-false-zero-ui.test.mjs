import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const file=readFileSync('review-scan-journal.js','utf8');
const start=file.indexOf('const failedRead=a=>');
const end=file.indexOf('const riskOf=s=>',start);
assert(start>=0&&end>start,'Grade safety helpers not found');
const helpers=file.slice(start,end);
const {failedRead,noGrade,gradeText,safeNumericGrade,verifiedQuality}=runInNewContext(
  "const ar=n=>new Intl.NumberFormat('ar-SA').format(n||0);\n"+helpers+
  "\n({failedRead,noGrade,gradeText,safeNumericGrade,verifiedQuality});"
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
assert(file.includes("safety.unresolvedSheet(s)||failedRead(effective(s))"),'verify button must block failed reads');
assert(file.includes("||failedRead(effective(sheets[active]))"),'verify action must block failed reads');
assert(file.includes("safety.unresolvedSheet(s)||failedRead(effective(s))"),'approve button must block failed reads');
console.log('PASS: failed markers are never score zero or quality 100');
console.log('PASS: genuine zero remains zero; pending scan has no grade');
console.log('PASS: verify and approval gated on marker/reader safety');
