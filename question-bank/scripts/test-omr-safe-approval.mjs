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
