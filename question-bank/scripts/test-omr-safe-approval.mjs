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
test('the final approval button follows completed, stored review decisions, not old optical risk flags',()=>{
 const client=fs.readFileSync(new URL('../../review-scan-journal.js',import.meta.url),'utf8');
 assert.match(client,/\!session\?\.completed_at\|\|\!sheets.some\(s=>s.disposition==='verified'\)/);
 assert.match(client,/\!\['verified','requires_rescan','duplicate'\]\.includes/);
 assert.doesNotMatch(client,/sheets\.some\(s=>\!s\.blocked_duplicate\&\&s\.disposition!=='requires_rescan'\&\&\(safety\.unresolvedSheet\(s\)\|\|failedRead\(effective\(s\)\)\)\)/);
});
