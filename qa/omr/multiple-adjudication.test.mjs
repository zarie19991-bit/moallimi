import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {confirmedMultiple,canCreditOriginalCorrect} from '../../supabase/functions/nafes-exam/omr-multiple-review.ts';

const good=(key=0,marks=[0,1])=>({status:'multiple',state:'multiple',selected:null,
 marked:marks,correct_index:key,uncertainty:{reading:[],identity:[],answer_key:[]},
 requires_verification:true});
const original=(key=0,marks=[0,1])=>({status:'multiple',marked:marks,correct_index:key});

test('teacher can credit ONLY correct option included in originally multiple-marked choices',()=>{
 assert.equal(confirmedMultiple(good()),true);
 assert.equal(canCreditOriginalCorrect(original(),good()),true);
 assert.equal(canCreditOriginalCorrect(original(2),good(2)),false);
 assert.equal(canCreditOriginalCorrect(original(0,[0,2]),good(0,[1,2])),false);
 assert.equal(canCreditOriginalCorrect(original(0,[1,2]),good(0,[0,2])),false);
 assert.equal(canCreditOriginalCorrect({...original(),status:'ambiguous'},good()),false);
 assert.equal(canCreditOriginalCorrect({...original(),marked:[0,0]},good()),false);
 assert.equal(canCreditOriginalCorrect(original(0),{...good(),correct_index:null}),false);
 assert.equal(canCreditOriginalCorrect(original(0),{...good(),uncertainty:{reading:['bubble_ambiguous'],identity:[],answer_key:[]}}),false);
});
test('confirmed multiple can be left WRONG without selecting a single bubble',()=>{
 const x=good(2,[0,3]);
 assert.equal(confirmedMultiple(x),true);
 assert.equal(canCreditOriginalCorrect(original(2,[0,3]),x),false);
 assert.deepEqual(x.marked,[0,3]);
 assert.equal(x.selected,null);
 assert.equal(confirmedMultiple({...x,selected:3}),false);
 assert.equal(confirmedMultiple({...x,marked:[0]}),false);
});
test('backend is teacher-authenticated, checks answer version and writes through audited edit RPC',()=>{
 const src=readFileSync('supabase/functions/nafes-exam/paper-scan.ts','utf8');
 assert(src.includes("'teacher_scan_resolve_multiple','teacher_scan_verify'"));
 assert(src.includes("if(b.action==='teacher_scan_resolve_multiple')"));
 assert(src.includes("if(mode==='credit_correct'&&!canCreditOriginalCorrect(source,current))"));
 assert(src.includes("if(!confirmedMultiple(current))"));
 assert(src.includes("if(row.answer_version!==version)"));
 assert(src.includes("if(session.completed_at)"));
 assert(src.includes("if(row.blocked_duplicate||!row.student_id)"));
 assert(src.includes("db.rpc('nafes_scan_edit_answer'"));
 assert(src.includes("p_reason:reason"));
 assert(src.includes("p_request:b.request_id"));
 assert(src.includes("p_marked:newMarks"));
 assert(src.includes("const newMarks=mode==='credit_correct'?[key]:marks"));
});
test('UI requires an explicit per-question teacher choice and retains original optical marks',()=>{
 const js=readFileSync('review-scan-journal.js','utf8');
 const html=readFileSync('review-scan.html','utf8');
 assert(js.includes('data-resolution="credit_correct"'));
 assert(js.includes('data-resolution="count_wrong"'));
 assert(js.includes("original?.status==='multiple'"));
 assert(js.includes('original.marked.includes(key)'));
 assert(js.includes("resolveMultiple(Number(decide.dataset.resolveQuestion)"));
 assert(js.includes("if(!confirm('تأكيد قرار مراجعة الصورة"));
 assert(html.includes('review-scan-journal.js?v=20261010-multiple-decision'));
});
