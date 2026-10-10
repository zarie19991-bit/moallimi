import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { hasIndependentCenterEvidence } from '../../supabase/functions/nafes-exam/omr-center-evidence.ts';

test('printed rings and bright centers never become confirmed answers',()=>{
 assert.equal(hasIndependentCenterEvidence([{center:253},{center:254},{center:253},{center:254}],0),false);
 assert.equal(hasIndependentCenterEvidence([{center:250},{center:253},{center:254},{center:253}],0),false);
 assert.equal(hasIndependentCenterEvidence([{center:230},{center:254},{center:255},{center:254}],0),false);
});
test('a dark selected center separated from unmarked options is supported',()=>{
 assert.equal(hasIndependentCenterEvidence([{center:53},{center:253},{center:254},{center:253}],0),true);
 assert.equal(hasIndependentCenterEvidence([{center:254},{center:160},{center:250},{center:254}],1),true);
 assert.equal(hasIndependentCenterEvidence([{center:180},{center:182},{center:253},{center:254}],0),false);
 assert.equal(hasIndependentCenterEvidence([{center:180},{center:182},{center:253},{center:254}],7),false);
});
test('an unconfirmed raw clear result must be downgraded BEFORE calculating counts and grades',()=>{
 const code=readFileSync('supabase/functions/nafes-exam/omr-server.ts','utf8');
 assert(code.includes('const verifiedAnswers=answers.map'));
 assert(code.includes("status:'ambiguous',marked:[answer.selected],selected:null"));
 assert(code.includes('return{answers:verifiedAnswers,markers_ok:true'));
 assert(code.includes('blank:verifiedAnswers.filter'));
 assert(code.includes('clear:verifiedAnswers.filter'));
});
test('optical diagnostic displays physical lightness/ink units, not impossible percentages',()=>{
 const code=readFileSync('review-scan-journal.js','utf8');
 const start=code.indexOf('function opticalEvidenceText(x){');
 const end=code.indexOf('const verifiedQuality=a=>',start);
 assert(start>0&&end>start);
 const {opticalEvidenceText}=runInNewContext(code.slice(start,end)+'\n({opticalEvidenceText})');
 const blue={reader:'blue-row',selected:1,marked:[1],center_values:[253,55,254,254],
   top_score:255,second_score:0,threshold:5,separation:255};
 const label=opticalEvidenceText(blue);
 assert(label.includes('55/255'));
 assert(label.includes('255 أو أكثر'));
 assert(!label.includes('25500'));
 assert(!label.includes('٪'));
 const blank=opticalEvidenceText({reader:'blank-interior-consensus',selected:null,
  marked:[],center_values:[253,254,254,253]});
 assert(blank.includes('المراكز فارغة'));
 assert(!blank.includes('25500'));
 assert(!code.includes('(top*100).toFixed(1)'));
 assert(!code.includes('ثقة القراءة '+"'+ar(Math.round(x.confidence*100))"));
});
