const fs=require('node:fs');
const assert=require('node:assert/strict');

const client=fs.readFileSync('review-correction.js','utf8');
const printClient=fs.readFileSync('review-question-papers.js','utf8');
const server=fs.readFileSync('supabase/functions/nafes-exam/assessments.ts','utf8');
const css=fs.readFileSync('review-question-papers.css','utf8');

const production=fs.readFileSync('production-files.txt','utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
for(const file of production){
  if(!/\.(?:html|js|css)$/.test(file)||!fs.existsSync(file))continue;
  const live=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(live,/مراجعة مؤشرات نافس/,file+' reintroduced the removed print heading');
}


assert.match(client,/const\s+PAPER_QUESTION_TARGET\s*=\s*60/,'paper builder must use a fixed 60-question target');
assert.match(client,/function allocateIndicatorRows\(rows,target\)/,'indicator allocation must be capacity-aware');
assert.match(client,/المتاح في البنك/,'UI must distinguish bank availability from allocated exam questions');
assert.doesNotMatch(client,/x\.count%5!==0\|\|x\.count<5/,'reading indicators must not be forced to five questions each');
assert.match(client,/paper_review_builder:true/,'paper preview requests must carry the server-side fixed-60 guard');
assert.match(client,/function readingIndicatorsForModel\(letter,total\)/,'reading indicators must rotate across models while keeping passage blocks');
assert.match(client,/٤ نصوص × ٥ أسئلة/,'mixed 60-question paper must document four reading passages with five questions each');
assert.match(printClient,/readingQuestions\.length\/5/,'print renderer must validate reading groups in mixed papers');
assert.match(printClient,/قسم القراءة يجب أن يكون «نص ثم ٥ أسئلة»/,'mixed reading print errors must explain the five-question passage contract');


assert.match(client,/teacher_preview_batch/,'paper builder must use batched preview generation');
const best=client.slice(client.indexOf('async function bestCandidate'),client.indexOf('function validate'));
assert.doesNotMatch(best,/teacher_preview'\s*,/,'bestCandidate must not return to sequential teacher_preview calls');
assert.match(client,/nafes_paper_builder_last_metrics/,'builder must persist real performance metrics');

assert.match(server,/b\.action==='teacher_preview_batch'/,'server must expose teacher_preview_batch');
assert.match(server,/poolCache=new Map<string,Row\[\]>/,'batch preview must reuse loaded question pools');
const batch=server.slice(server.indexOf("if(b.action==='teacher_preview_batch')"),server.indexOf("if(b.action==='teacher_preview')"));
assert.doesNotMatch(batch,/nafes_assessments'\)\.insert/,'batch candidates must not create draft rows');

assert.match(css,/@page\{size:A4 portrait;margin:6mm\}/,'print must use explicit A4 with safe physical margins');
assert.match(css,/\.paper-page\{width:198mm!important[\s\S]*height:285mm!important/,'printed content must fit exactly inside A4 minus 6mm margins');
assert.match(css,/\.stem\{font-size:11pt!important/,'printed question stems must be exactly 11pt');
assert.match(css,/\.choices\{font-size:11pt!important/,'printed choices must be exactly 11pt');
assert.match(printClient,/removeAttribute\('data-layout-unresolved'\)/,'stale unresolved print state must be cleared before re-measurement');
assert.match(printClient,/window\.print\(\)/,'print button must call the native print API');
assert.doesNotMatch(printClient,/addEventListener\('afterprint',[\s\S]{0,240}renderPages\(\)/,'afterprint must not rebuild all pages and reintroduce layout gaps');
assert.doesNotMatch(printClient,/مراجعة مؤشرات نافس/,'exported question papers must never contain the removed review heading');
assert.match(printClient,/function tryCompactCandidate\(page\)/,'page packer must try vertical-rhythm compaction before moving content to another page');
assert.match(printClient,/unused_bottom_px/,'print metrics must measure unused bottom space');
assert.match(printClient,/function avoidableLargeGap\(page,threshold=140\)/,'large gaps must be classified by whether the next block can actually fit');
assert.match(printClient,/avoidable_large_gap/,'only genuinely fillable large gaps may block printing');
assert.doesNotMatch(printClient,/\|\|x\.large_gap\)/,'raw large-gap size alone must not block printing');
assert.match(printClient,/large_gap&&!x\.avoidable_large_gap/,'structural gaps must be reported without blocking print');
assert.match(css,/gap-control contract/,'print CSS must keep the gap-control contract');
assert.match(css,/compact-page-strong \.stem\{font-size:11pt!important;line-height:1\.28!important/,'gap control may tighten vertical rhythm but must preserve 11pt stems');

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

assert.match(css,/@media screen and \(max-width:900px\)/,'responsive scale must be screen-only and must never affect print preview');
assert.match(css,/@media print\{[\s\S]*html,body,#pages,\.model-booklet,\.paper-page,\.page-inner\{[\s\S]*transform:none!important;[\s\S]*zoom:1!important;/,'print CSS must explicitly reset responsive transform and zoom');
assert.doesNotMatch(css,/@media\(max-width:900px\)\{#pages\{transform-origin:top right;transform:scale\(\.7\)/,'unscoped mobile scale must never return');

assert.doesNotMatch(printClient,/<footer class="footer">/,'printed paper must not render a footer that can overlap the final question');
assert.match(css,/\.questions-flow\{flex:1;min-height:0;overflow:visible\}/,'question flow must recover the full printable height after footer removal');
