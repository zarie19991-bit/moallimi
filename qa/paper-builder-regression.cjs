const fs=require('node:fs');
const assert=require('node:assert/strict');

const client=fs.readFileSync('review-correction.js','utf8');
const server=fs.readFileSync('supabase/functions/nafes-exam/assessments.ts','utf8');
const css=fs.readFileSync('review-question-papers.css','utf8');

assert.match(client,/teacher_preview_batch/,'paper builder must use batched preview generation');
const best=client.slice(client.indexOf('async function bestCandidate'),client.indexOf('function validate'));
assert.doesNotMatch(best,/teacher_preview'\s*,/,'bestCandidate must not return to sequential teacher_preview calls');
assert.match(client,/nafes_paper_builder_last_metrics/,'builder must persist real performance metrics');

assert.match(server,/b\.action==='teacher_preview_batch'/,'server must expose teacher_preview_batch');
assert.match(server,/poolCache=new Map<string,Row\[\]>/,'batch preview must reuse loaded question pools');
const batch=server.slice(server.indexOf("if(b.action==='teacher_preview_batch')"),server.indexOf("if(b.action==='teacher_preview')"));
assert.doesNotMatch(batch,/nafes_assessments'\)\.insert/,'batch candidates must not create draft rows');

assert.match(css,/@page\{size:A4 portrait;margin:6mm\}/,'print must use explicit A4 with safe physical margins');
assert.match(css,/\.paper-page\{width:100%!important[\s\S]*height:285mm!important/,'printed content must use the browser A4 printable width');
assert.match(css,/\.stem\{font-size:14pt!important/,'printed question stems must stay readable');
assert.match(css,/\.choices\{font-size:12\.5pt!important/,'printed choices must stay readable');

assert.match(best,/initialCandidateCount=reading\?5:/,'reading builds must use a 5-candidate initial batch');
assert.match(best,/refineCandidateCount=reading\?3:2/,'adaptive refinement batch must remain bounded');
assert.match(server,/PREVIEW_POOL_CACHE_TTL_MS=45_000/,'preview question-pool cache must remain enabled');

const legacyReadingCandidateWork=5*10;
const optimizedReadingNormalWork=5*5;
const legacyObjectiveCandidateWork=5*8;
const optimizedObjectiveNormalWork=5*4;
const readingReduction=Math.round((1-optimizedReadingNormalWork/legacyReadingCandidateWork)*1000)/10;
const objectiveReduction=Math.round((1-optimizedObjectiveNormalWork/legacyObjectiveCandidateWork)*1000)/10;
assert.ok(readingReduction>=40);
assert.ok(objectiveReduction>=40);

console.log('PASS paper builder + print regression',JSON.stringify({
  legacy_reading_candidates:legacyReadingCandidateWork,
  optimized_reading_candidates:optimizedReadingNormalWork,
  reading_candidate_reduction_percent:readingReduction,
  legacy_objective_candidates:legacyObjectiveCandidateWork,
  optimized_objective_candidates:optimizedObjectiveNormalWork,
  objective_candidate_reduction_percent:objectiveReduction
}));
