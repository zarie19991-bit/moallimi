import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {identityOnlyUncertainty,preserveOpticalEvidence} from '../../supabase/functions/nafes-exam/omr-identity-fix.ts';
import {provenMultipleCenters} from '../../supabase/functions/nafes-exam/omr-multiple-evidence.ts';
const identityOnly={
 state:'uncertain',status:'clear',reading_status:'clear',selected:3,marked:[3],
 reader:'blue-row',top_score:88.5,center_values:[203,204,205,94],
 blue_scores:[0,0,0,.46],dark_scores:[.2,.2,.2,.88],
 uncertainty:{reading:[],identity:['identity_not_verified'],answer_key:['answer_key_missing_or_invalid','answer_key_incomplete']},
 requires_verification:true
};
test('a previously unidentified sheet retains 60 proven answers instead of 60 false prior-uncertainty flags',()=>{
 const rows=Array.from({length:60},()=>({...identityOnly}));
 assert(rows.every(identityOnlyUncertainty));
 const key={state:'correct',selected:3,marked:[3],status:'clear',correct:true,confidence:.99,
   uncertainty:{reading:[],identity:[],answer_key:[]},correct_index:3};
 const updated=rows.map(x=>preserveOpticalEvidence(x,key));
 assert(updated.every(x=>x.state==='correct'&&x.center_values[3]===94&&x.top_score===88.5));
 assert(updated.every(x=>x.blue_scores[3]===.46&&x.uncertainty.identity.length===0));
});
test('genuine scan ambiguity or an answer manually changed is never silently cleared by identifying student',()=>{
 for(const alt of [
  {...identityOnly,status:'ambiguous',reading_status:'ambiguous'},
  {...identityOnly,uncertainty:{...identityOnly.uncertainty,reading:['bubble_ambiguous']}},
  {...identityOnly,reviewed_manually:true},
  {...identityOnly,marked:[0,3]},
  {...identityOnly,reading_status:'invalid'},
  {...identityOnly,uncertainty:{...identityOnly.uncertainty,identity:[]}}
 ])assert.equal(identityOnlyUncertainty(alt),false);
});
const bubble=(center,blueInsideMass=0,blueInsideHits=0)=>({center,blueInsideMass,blueInsideHits});
test('do not call a filled circle plus a faint printed ring two filled answers',()=>{
 assert.equal(provenMultipleCenters([bubble(95),bubble(251),bubble(252),bubble(250)],[0,1]),false);
 assert.equal(provenMultipleCenters([bubble(92),bubble(91),bubble(253),bubble(252)],[0,1]),true);
 assert.equal(provenMultipleCenters([bubble(240,9,6),bubble(241,10,6),bubble(252),bubble(251)],[0,1]),true);
 assert.equal(provenMultipleCenters([bubble(255),bubble(253),bubble(254),bubble(251)],[0,2]),false);
 assert.equal(provenMultipleCenters([bubble(94),bubble(91),bubble(253),bubble(252)],[0,0]),false);
});
test('identity refresh requires confirmation, a manual identity, no prior edits and a version match',()=>{
 const s=readFileSync('supabase/functions/nafes-exam/paper-scan.ts','utf8');
 assert(s.includes("if(b.action==='teacher_scan_refresh_identity_grade')"));
 assert(s.includes('b.confirm!==true'));
 assert(s.includes("current.identity_source!=='manual'"));
 assert(s.includes("original.identity_valid===true"));
 assert(s.includes("(current.answers||[]).some((a:Row)=>a.reviewed_manually===true)"));
 assert(s.includes(".eq('answer_version',row.answer_version).is('reviewed_at',null)"));
 assert(s.includes('preserveOpticalEvidence(raw,classified)'));
 assert(s.includes("identityOnlyUncertainty(raw)"));
 assert(s.includes("if((raw.state==='uncertain'||raw.review_pending===true)&&classified.state!=='uncertain'&&!identityOnlyUncertainty(raw))"));
});
test('real multiple and optical ambiguity now have different explanations',()=>{
 const server=readFileSync('supabase/functions/nafes-exam/omr-server.ts','utf8');
 assert(server.includes('provenMultipleCenters(raw[i],answer.marked)'));
 assert(server.includes("reader:'multiple-ink-unconfirmed'"));
 assert(server.includes('إجابة غير واضحة تحتاج مراجعة الصورة'));
 assert(server.includes('إجابة متعددة التظليل مثبتة تحتاج قرار المعلم'));
 const html=readFileSync('review-scan.html','utf8');
 const ui=readFileSync('review-scan-journal.js','utf8');
 assert(html.includes('id="refreshIdentityGradeBtn"'));
 assert(html.includes('review-scan-journal.js?v=20261010-'),'Reviewer scripts must have explicit current cache-busting version');
 assert(ui.includes("api('teacher_scan_refresh_identity_grade'"));
 assert(ui.includes("if(reopen)await open(active)"));
 assert(ui.includes('تعذرت مطابقة رمز QR والطالب'));
});
