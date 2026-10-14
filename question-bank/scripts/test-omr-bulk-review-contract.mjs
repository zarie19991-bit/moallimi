import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const sql=read('supabase/migrations/20261014_omr_bulk_verify_clean.sql');
const backend=read('supabase/functions/nafes-exam/paper-scan.ts');
const ui=read('review-scan-journal.js');
const html=read('review-scan.html');

test('batch review is opt-in, preview first, audit linked to teacher and service_role only',()=>{
 assert.match(sql,/p_apply boolean DEFAULT false/);
 assert.match(sql,/IF NOT p_apply THEN RETURN response/);
 assert.match(sql,/session_row\.reviewer_id IS DISTINCT FROM p_reviewer/);
 assert.match(sql,/nafes_scan_bulk_review_audit/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.nafes_scan_bulk_verify_clean/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.nafes_scan_bulk_verify_clean.*TO service_role/);
 assert.match(sql,/public\.nafes_scan_verify_current/);
 assert.match(backend,/b\.action==='teacher_scan_bulk_verify_clean'/);
 assert.match(backend,/session\.reviewer_id!==owner\.id/);
});

test('only low-risk, high-quality, unambiguous images are eligible for bulk review',()=>{
 for(const check of [
  /'risk' IS DISTINCT FROM 'low'/,
  /'quality_score'/,
  /<95/,
  /r\.blocked_duplicate/,
  /r\.duplicate_of IS NOT NULL/,
  /r\.student_id IS NULL/,
  /'identity_valid'/,
  /'markers_ok'/,
  /'omr_reader_error'/,
  /'multiple'/,
  /'uncertainty'/,
  /'correct_index'/,
  /'score' IS DISTINCT FROM/,
  /'reviewed_manually'/
 ])assert.match(sql,check);
});

test('teacher interface previews counts, requires confirmation and preserves approval as separate step',()=>{
 assert.match(ui,/function bulkVerifyClean\(/);
 assert.match(ui,/apply:false/);
 assert.match(ui,/apply:true/);
 assert.match(ui,/if\(!confirm\(/);
 assert.match(ui,/function openNextException\(/);
 assert.match(html,/id="bulkCleanReviewBtn"/);
 assert.match(html,/id="doubleAnswerReviewBtn"/);
 assert.match(html,/id="unclearAnswerReviewBtn"/);
 assert.match(html,/id="approveBtn"/);
});
