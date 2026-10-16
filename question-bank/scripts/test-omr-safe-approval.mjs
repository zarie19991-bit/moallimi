import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifiedSheetsForPublication} from '../../supabase/functions/nafes-exam/omr-publish-filter.ts';

test('OMR approved results only contain verified, nonduplicate sheets',()=>{
 const verified={id:'approved',disposition:'verified',blocked_duplicate:false};
 const rescan={id:'rescan',disposition:'requires_rescan',blocked_duplicate:false};
 const pending={id:'pending',disposition:null,blocked_duplicate:false};
 const duplicate={id:'dup',disposition:'duplicate',blocked_duplicate:true};
 assert.deepEqual(verifiedSheetsForPublication([rescan,verified,pending,duplicate]).map(s=>s.id),['approved']);
 assert.deepEqual(verifiedSheetsForPublication([rescan,pending,duplicate]),[]);
});
test('server and UI handle explicit rescan decisions without inventing grades',()=>{
 const backend=fs.readFileSync(new URL('../../supabase/functions/nafes-exam/paper-scan.ts',import.meta.url),'utf8');
 const client=fs.readFileSync(new URL('../../review-scan-journal.js',import.meta.url),'utf8');
 const migration=fs.readFileSync(new URL('../../supabase/migrations/20261014_omr_review_rescan_exceptions.sql',import.meta.url),'utf8');
 assert.match(backend,/verifiedSheetsForPublication/);
 assert.match(backend,/teacher_scan_mark_rescan/);
 assert.match(client,/renderApprovalChecklist/);
 assert.match(client,/markForRescan/);
 assert.match(migration,/grade_published/);
 assert.match(migration,/requires_rescan/);
});


test('manual answer modifications automatically record an audit reason without forcing teachers to type',()=>{
 const client=fs.readFileSync(new URL('../../review-scan-journal.js',import.meta.url),'utf8');
 const page=fs.readFileSync(new URL('../../review-scan.html',import.meta.url),'utf8');
 assert.match(client,/function decisionReason\(/);
 assert.match(client,/const reason=decisionReason\(question,a.marked,marked,extra\)/);
 assert.doesNotMatch(client,/سبب التعديل اليدوي إلزامي/);
 assert.match(client,/const automatic=failedRead\(read\)/);
 assert.match(client,/أرقام الأوراق التي تنتظر قرارك/);
 assert.match(page,/ملاحظة إضافية اختيارية/);
 assert.match(page,/id="finishReviewAllBtn"/);
});
test('ready grades can be approved while pending papers remain open',()=>{
 const client=fs.readFileSync(new URL('../../review-scan-journal.js',import.meta.url),'utf8');
 const expression=client.match(/\$\('approveBtn'\)\.disabled=([^;]+);/)[1];
 const disabled=new Function('busy','session','sheets','return '+expression);
 const good={disposition:'verified',blocked_duplicate:false};
 const pending={disposition:null,reviewed_at:null};
 assert.equal(disabled(false,{},[good,pending]),false);
 assert.equal(disabled(false,{},[pending]),true);
 assert.equal(disabled(false,{},[{...good,blocked_duplicate:true}]),true);
 assert.equal(disabled(true,{},[good]),true);
 assert.equal(disabled(false,null,[good]),true);
 const server=fs.readFileSync(new URL('../../supabase/functions/nafes-exam/paper-scan.ts',import.meta.url),'utf8');
 assert.doesNotMatch(server.slice(server.indexOf('export async function reviewedScanPayload')),/if\(!session.completed_at\)/);
});


test('confirmation of an uncertain answer can preserve its original shaded option',()=>{
 const client=fs.readFileSync(new URL('../../review-scan-journal.js',import.meta.url),'utf8');
 assert.match(client,/const sameMarks=JSON\.stringify\(marked\)===JSON\.stringify\(a\.marked\|\|\[\]\)/);
 assert.match(client,/const needsDecision=a\.state==='uncertain'/);
 assert.match(client,/if\(sameMarks&&!needsDecision\)/);
 assert.match(client,/if\(sameMarks&&needsDecision&&!confirm/);
 assert.match(client,/تأكيد التظليل المعلّق/);
});
