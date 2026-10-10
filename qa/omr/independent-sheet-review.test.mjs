import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const journal=readFileSync('review-scan-journal.js','utf8');
const safety=readFileSync('review-omr-safety.js','utf8');
const migration=readFileSync('supabase/migrations/20261010083000_omr_independent_sheet_review.sql','utf8');
const html=readFileSync('review-scan.html','utf8');
const env={globalThis:{}};
runInNewContext(safety,env);
const omr=env.globalThis.NafesOmrSafety;

const base={
 state:'correct',status:'clear',reading_status:'clear',
 selected:0,marked:[0],correct:true,review_pending:false,
 requires_verification:false,uncertainty:{reading:[],identity:[],answer_key:[]}
};
const fakeSheet=(answers)=>({
 student_id:'student',snapshot:{identity_valid:true,markers_ok:true,answers}
});

test('a valid clean sheet can be verified independently and cannot be confused with an uncertain one',()=>{
 assert.equal(omr.unresolvedSheet(fakeSheet([base])),false);
 assert.equal(omr.unresolvedSheet(fakeSheet([{...base,state:'uncertain'}])),true);
 assert.equal(omr.unresolvedSheet(fakeSheet([{...base,requires_verification:true}])),true);
 assert.equal(omr.unresolvedSheet(fakeSheet([{...base,status:'ambiguous'}])),true);
 assert.equal(omr.unresolvedSheet(fakeSheet([{...base,uncertainty:{reading:['bubble_ambiguous'],identity:[],answer_key:[]}}])),true);
});
test('true blank zero is reviewable; unresolved multiple requires explicit handling',()=>{
 const blank={...base,state:'blank',status:'blank',reading_status:'blank',selected:null,marked:[],correct:false};
 assert.equal(omr.unresolvedSheet(fakeSheet([blank])),false);
 const multiple={...base,state:'multiple',status:'multiple',reading_status:'multiple',selected:null,marked:[0,1],correct:false,requires_verification:true};
 assert.equal(omr.unresolvedSheet(fakeSheet([multiple])),true);
 assert.equal(omr.unresolvedSheet(fakeSheet([{...multiple,requires_verification:false}])),false);
});
test('independent sheet review remains guarded, while browsing next page never requires previous review',()=>{
 assert(journal.includes("$('nextSheetBtn').disabled=busy||!s||active>=sheets.length-1"));
 assert(journal.includes('pendingAnswerCount(effective(s))>0||scoreMismatch(effective(s))'));
 assert(journal.includes('يمكنك اختيار أي ورقة أخرى'));
 assert(html.includes('id="reviewEligibilityNote"'));
 assert(html.includes('review-scan-journal.js?v=20261010-independent-verify'));
 assert(html.includes('review-omr-safety.js?v=20261010-independent-verify'));
});
test('database migration only removes sequential dependency and preserves remaining validation',()=>{
 assert(migration.includes("'public.nafes_scan_verify(uuid,uuid,uuid,boolean)'::regprocedure"));
 assert(migration.includes("'public.nafes_scan_edit_answer(uuid,uuid,uuid,integer,integer[],integer,uuid,text)'::regprocedure"));
 assert(migration.includes('pg_get_functiondef(func)'));
 assert(migration.includes("replace(source_sql,guard,"));
 assert(migration.includes("'راجع الورقة السابقة أولًا'"));
 assert(migration.includes('answer_version'));
 assert(migration.includes('reviewed_at'));
 assert(migration.includes('BEGIN;')&&migration.includes('COMMIT;'));
});
