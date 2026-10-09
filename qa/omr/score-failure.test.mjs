import assert from 'node:assert/strict';
import {gradeScan} from '../../supabase/functions/nafes-exam/scan-grade-policy.ts';
import {readFileSync} from 'node:fs';

const complete=({correct=false,state='incorrect',reading_status='clear',uncertainty={reading:[],identity:[],answer_key:[]}}={})=>({
 correct,state,reading_status,uncertainty,requires_verification:false,review_pending:false
});
const valid={markers_ok:true,reader_error:null,identity_valid:true,key_complete:true};
function check(title,answers,context,expectedStatus,expectedScore){
 const v=gradeScan(answers,60,{...valid,...context});
 assert.equal(v.grade_status,expectedStatus,title+' status');
 assert.equal(v.score,expectedScore,title+' score');
 console.log('PASS '+title);
}
const allWrong=Array.from({length:60},()=>complete());
check('genuine_zero_from_sixty_valid_bubbles',allWrong,{},'provisional',0);
check('reader_exception_must_not_be_zero',allWrong,{reader_error:'OMR_MARKERS_NOT_FOUND'},'unreadable',null);
check('markers_unverified_must_not_be_zero',allWrong,{markers_ok:false},'unreadable',null);
check('empty_reader_output_must_not_be_zero',[],{},'unreadable',null);
check('incomplete_answer_set_must_not_be_zero',allWrong.slice(0,59),{},'unreadable',null);
check('missing_student_identity_must_not_be_zero',allWrong,{identity_valid:false},'unreadable',null);
check('missing_answer_key_must_not_be_zero',allWrong,{key_complete:false},'unreadable',null);
check('unavailable_reading_must_not_be_zero',[complete({state:'uncertain',reading_status:'unavailable'}),...allWrong.slice(1)],{},'unreadable',null);
check('ambiguous_reading_must_not_be_zero',[complete({state:'uncertain',reading_status:'ambiguous'}),...allWrong.slice(1)],{},'needs_review',null);
check('confirmed_multiple_requires_review',[complete({state:'multiple',reading_status:'multiple'}),...allWrong.slice(1)],{},'needs_review',null);
check('prior_ambiguity_requires_explicit_review',[complete({state:'correct',correct:true,uncertainty:{reading:['previous_ambiguity']}}),...allWrong.slice(1)],{},'needs_review',null);
check('enhanced_geometry_requires_human_review',allWrong,{reader_requires_review:true},'needs_review',null);
check('valid_all_correct',Array.from({length:60},()=>complete({state:'correct',correct:true})),{},'provisional',60);
const source=readFileSync('supabase/functions/nafes-exam/paper-scan.ts','utf8');
const ui=readFileSync('review-scan-journal.js','utf8');
assert((source.match(/gradeScan\(/g)||[]).length>=4,'every persistence path applies no-zero policy');
assert(source.includes("snapshot.markers_ok!==true||snapshot.omr_reader_error"),'approval guarded on marker verification');
assert(ui.includes('فشل القراءة — بلا درجة'),'UI must never render historical unreadable zero as official grade');
console.log('PASS real_persistence_paths_and_public_display_are_wired');
console.log('OMR_NO_ZERO_POLICY_TEST_PASS');
