// Independent audit. Never commit raw student sheets or answer labels to a public repository.
// Example: OMR_AUDIT_INPUT=/secure/private/audit.json node qa/omr/acceptance-audit.mjs
import {readFileSync} from 'node:fs';
const path=process.env.OMR_AUDIT_INPUT;
if(!path){console.error('RELEASE_BLOCKED: no independently labeled scan/answer dataset supplied');process.exit(3);}
let data;try{data=JSON.parse(readFileSync(path,'utf8'))}catch(e){console.error('RELEASE_BLOCKED: cannot parse private audited dataset: '+e.message);process.exit(3)}
const required=['normal','rotation','perspective','low_contrast','blank','multiple','ambiguous','marker_failure'];
const sheets=Array.isArray(data?.sheets)?data.sheets:[];
const tally=new Map(required.map(k=>[k,{sheets:0,questions:0,matched:0,unread:0,wrong:0}]));
let attempted=0,matched=0,total=0,falseZero=0,illegalRelease=0,missingManual=0;
for(const s of sheets){
 const k=String(s.category||'');
 if(!tally.has(k)){missingManual++;continue;}
 const t=tally.get(k);t.sheets++;
 const markerFail=s.reader_failed===true||s.marker_verified===false;
 if(markerFail && s.displayed_score===0)falseZero++;
 if(markerFail && s.published===true)illegalRelease++;
 if(!s.manual_reference_verified||!s.independently_reviewed)missingManual++;
 if(k==='marker_failure'){
   if(!markerFail)missingManual++;
   if(s.displayed_score!==null&&s.displayed_score!==undefined)illegalRelease++;
   continue;
 }
 if(!Array.isArray(s.expected)||s.expected.length!==60){missingManual++;continue;}
 const actual=Array.isArray(s.actual)?s.actual:[];
 for(let i=0;i<60;i++){
   total++;t.questions++;
   if(markerFail||i>=actual.length||actual[i]===null||actual[i]===undefined){t.unread++;continue;}
   attempted++;
   if(JSON.stringify(actual[i])===JSON.stringify(s.expected[i])){matched++;t.matched++}
   else t.wrong++;
 }
}
const accuracy=total?matched/total:0,rejection_rate=total?(total-attempted)/total:1;
const nCases=Object.fromEntries([...tally].map(([k,v])=>[k,v]));
const reasons=[];
if(sheets.length<30)reasons.push('less_than_30_independent_sheets');
if(total<1500)reasons.push('less_than_1500_labeled_questions');
if(required.some(x=>tally.get(x).sheets===0))reasons.push('missing_required_image_or_answer_case');
if(accuracy<.99)reasons.push('accuracy_below_99pct');
if(rejection_rate>.05)reasons.push('rejected_or_unread_answers_over_5pct');
if(falseZero>0)reasons.push('false_zero_on_reader_failure');
if(illegalRelease>0)reasons.push('failed_scan_published');
if(missingManual>0)reasons.push('missing_or_unverified_independent_ground_truth');
if(data?.reviewer_approval!==true)reasons.push('independent_auditor_not_approved');
const report={release_approved:reasons.length===0,sheets:sheets.length,verified_answers:total,matched,
 accuracy:Number(accuracy.toFixed(6)),rejection_rate:Number(rejection_rate.toFixed(6)),
 false_zero_count:falseZero,unsafe_publications:illegalRelease,missing_reference_count:missingManual,
 coverage:nCases,blocked_reasons:reasons};
console.log(JSON.stringify(report,null,2));
if(reasons.length)process.exit(2);
console.log('OMR_INDEPENDENT_AUDIT_PASS');
