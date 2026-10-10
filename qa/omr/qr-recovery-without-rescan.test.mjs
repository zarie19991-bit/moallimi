import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
const scan=readFileSync('review-scan.js','utf8');
const journal=readFileSync('review-scan-journal.js','utf8');
const page=readFileSync('review-scan.html','utf8');
const server=readFileSync('supabase/functions/nafes-exam/paper-scan.ts','utf8');

test('QR fallback covers prior header position and other image corners',()=>{
 const start=scan.indexOf('function qrFallbackSpecs(){');
 const end=scan.indexOf('function qrDecode(c){',start);
 assert(start>0&&end>start);
 const {qrFallbackSpecs}=runInNewContext(scan.slice(start,end)+'\n({qrFallbackSpecs})');
 const specs=qrFallbackSpecs();
 assert(specs.length>=6&&specs.length<=12,'a bounded search avoids excessive retry on 200-page batches');
 const parts=(x,y)=>specs.some(v=>v[0]<=x&&v[0]+v[2]>=x&&v[1]<=y&&v[1]+v[3]>=y);
 assert(parts(.05,.04),'upper left');
 assert(parts(.92,.04),'upper right');
 assert(parts(.05,.94),'lower left');
 assert(parts(.93,.94),'lower right');
 for(const spec of specs){
  assert.equal(spec.length,5);
  assert(spec.every(Number.isFinite));
  assert(spec[0]>=0&&spec[1]>=0&&spec[2]>0&&spec[3]>0);
  assert(spec[0]+spec[2]<=1.001&&spec[1]+spec[3]<=1.001);
 }
});
test('only a valid printed-sheet QR can become a student candidate; image scan has no order-based identity',()=>{
 const start=scan.indexOf('function parseQr(raw){'),end=scan.indexOf('function normalizeOrientation(c){',start);
 assert(start>0&&end>start);
 const qrPart=scan.slice(start,end);
 const {parseQr}=runInNewContext(qrPart+'\n({parseQr})');
 assert.equal(parseQr('https://example.com'),null);
 assert.equal(parseQr('MR3|review|abc|ب'),null);
 const good=parseQr('MR3|review|52|ب');
 assert(good);
 assert.equal(good.sheetNo,52);
 assert.equal(good.model,'ب');
 assert(scan.includes('const assignment=q&&q.reviewId===draft.review_id?assignmentBySheet(q.sheetNo):null'));
 assert(scan.includes('const qrValid=!!assignment&&q.model===assignment.model'));
 assert(scan.includes('return q&&parseQr(q.data)?q:null'));
 assert(server.includes('const valid=!!assignment&&uuid(assignment.student_id)&&raw.qr_valid===true&&raw.model===assignment.model'));
});
test('misread or absent QR does not cause destructive rescan or fake score',()=>{
 assert(server.includes('qr_missing_or_unreadable'));
 assert(server.includes('هوية غير مرتبطة — تحقق من QR أو اربط الطالب يدويًا'));
 assert(journal.includes('هوية غير مرتبطة — راجع QR'));
 assert(journal.includes('data-assign-identity'));
 assert(journal.includes('ربط الطالب بعد مطابقة الورقة'));
 assert(journal.includes("const index=Number(assign.dataset.assignIdentity)"));
 assert(journal.includes('manualAssignment'));
 assert(journal.includes('تعذرت مطابقة QR في الصورة المحفوظة'));
 assert(page.includes('review-scan.js?v=20261010-qr-identity-recovery3'));
 assert(page.includes('review-scan-journal.js?v=20261010-qr-identity-recovery3'));
 assert(scan.includes("typeof BarcodeDetector==='function'"));
 assert(scan.includes("toDataURL('image/jpeg',.83)"));
});
