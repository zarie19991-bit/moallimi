import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reviewedScanPayload} from '../../supabase/functions/nafes-exam/paper-scan.ts';

const id1='11111111-1111-4111-8111-111111111111', id2='22222222-2222-4222-8222-222222222222', id3='33333333-3333-4333-8333-333333333333';
const review={id:id1,review_id:'RMUS0IRW5',owner_id:id3,subject:'science',subjects:['science']};
const session={id:id2,review_pk:id1,reviewer_id:id3,expected_count:2,
 completed_at:'2026-10-14T12:00:00Z',review_snapshot:{question_count:1,review_id:'RMUS0IRW5',models:[{model:'أ',questions:[{id:'q1'}]}]}};
const correct={question:1,state:'correct',status:'clear',selected:0,marked:[0],correct_index:0,correct:true,uncertainty:{reading:[],identity:[],answer_key:[]}};
const approved={id:id3,session_id:id2,ordinal:1,student_id:id3,answer_version:1,
 disposition:'verified',blocked_duplicate:false,reviewed_at:'2026-10-14T11:00:00Z',
 snapshot:{identity_valid:true,markers_ok:true,student_name:'طالب اختباري',model:'أ',total:1,answers:[correct]}};
const rescan={...approved,id:'44444444-4444-4444-8444-444444444444',ordinal:2,
 disposition:'requires_rescan',student_id:null,snapshot:{identity_valid:false,markers_ok:false,score:0,total:1,answers:[{state:'uncertain'}]},effective_snapshot:{
 identity_valid:false,markers_ok:false,score:0,total:1,answers:[{state:'uncertain'}],
 omr_rescan_decision:{reason:'تلف منطقة التظليل في المسح الأصلي',grade_published:false}}};
function mock(items){
 const itemsByTable={
  nafes_paper_reviews:[review],
  nafes_scan_sessions:[session],
  nafes_scan_sheets:items
 };
 return {from(table){
  const conditions=[];
  const q={
   select(){return this;},
   eq(k,v){conditions.push([k,v]);return this;},
   order(){return Promise.resolve({data:(itemsByTable[table]||[]).filter(row=>conditions.every(([k,v])=>row[k]===v)),error:null});},
   maybeSingle(){const filtered=(itemsByTable[table]||[]).filter(row=>conditions.every(([k,v])=>row[k]===v));return Promise.resolve({data:filtered[0]||null,error:null});}
  };return q;
 }};
}
const request={review_id:review.review_id,session_id:id2};
const owner={id:id3,subject_scope:'all'};
test('approval includes only explicitly verified paper; deferred rescans never produce a zero-grade attempt',async()=>{
 const result=await reviewedScanPayload(mock([approved,rescan]),request,owner);
 assert.equal(result.results.length,1);
 assert.equal(result.results[0].sheet_id,id3);
 assert.equal(result.results[0].answers[0].state,'correct');
 assert.equal(result.results.some(r=>r.sheet_id===rescan.id),false);
});
test('approval refuses to publish a batch containing only excluded or unreadable sheets',async()=>{
 await assert.rejects(()=>reviewedScanPayload(mock([rescan]),request,owner),/لا توجد أوراق/);
});
test('rescan needs explicit reviewer reason, preserves original image and cannot be called with anon key',()=>{
 const migration=fs.readFileSync(new URL('../../supabase/migrations/20261014_omr_review_rescan_exceptions.sql',import.meta.url),'utf8');
 const backend=fs.readFileSync(new URL('../../supabase/functions/nafes-exam/paper-scan.ts',import.meta.url),'utf8');
 const ui=fs.readFileSync(new URL('../../review-scan-journal.js',import.meta.url),'utf8');
 assert.match(migration,/char_length\(reason\) NOT BETWEEN 10 AND 600/);
 assert.match(migration,/reviewer_id IS DISTINCT FROM p_reviewer/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.nafes_scan_mark_rescan/);
 assert.match(migration,/disposition='requires_rescan'/);
 assert.match(migration,/grade_published',false/);
 assert.match(backend,/b\.action==='teacher_scan_mark_rescan'/);
 assert.match(backend,/\.eq\('disposition','verified'\)/);
 assert.match(ui,/renderApprovalChecklist/);
 assert.match(ui,/markForRescan/);
 assert.match(ui,/s\.disposition!=='requires_rescan'/);
});
