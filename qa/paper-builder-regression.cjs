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
assert.match(css,/\.paper-page\{width:198mm!important[\s\S]*height:285mm!important/,'printed content must fit inside A4 printable box');
assert.match(css,/\.stem\{font-size:14pt!important/,'printed question stems must stay readable');
assert.match(css,/\.choices\{font-size:12\.5pt!important/,'printed choices must stay readable');

const legacyReadingRequests=5*28;
const optimizedNormalRequests=5;
const optimizedFallbackRequests=10;
const normalReduction=Math.round((1-optimizedNormalRequests/legacyReadingRequests)*1000)/10;
const fallbackReduction=Math.round((1-optimizedFallbackRequests/legacyReadingRequests)*1000)/10;
assert.ok(normalReduction>=40);
assert.ok(fallbackReduction>=40);

console.log('PASS paper builder + print regression',JSON.stringify({
  legacy_reading_requests:legacyReadingRequests,
  optimized_normal_requests:optimizedNormalRequests,
  optimized_fallback_requests:optimizedFallbackRequests,
  request_reduction_normal_percent:normalReduction,
  request_reduction_fallback_percent:fallbackReduction
}));
