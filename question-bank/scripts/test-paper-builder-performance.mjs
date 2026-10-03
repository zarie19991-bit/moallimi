import fs from 'node:fs';
import assert from 'node:assert/strict';

const builder=fs.readFileSync('review-correction.js','utf8');
const printJs=fs.readFileSync('review-question-papers.js','utf8');
const printCss=fs.readFileSync('review-question-papers.css','utf8');

assert.match(builder,/initialCandidateCount=reading\?5:/,'paper builder must start with 5 reading candidates, not 10');
assert.match(builder,/refineCandidateCount=reading\?3:2/,'adaptive refinement batch is required');
assert.doesNotMatch(builder,/candidateCount=reading\?10/,'legacy eager 10-candidate generation must not return');
assert.match(builder,/nafes_paper_builder_last_metrics/,'builder performance metrics must be retained');
assert.match(builder,/PAGE_CACHE_TTL_MS=5\*60\*1000/,'catalog and roster cache contract is missing');

assert.match(printCss,/@page\{size:A4 portrait;margin:6mm\}/,'A4 print page contract is missing');
assert.match(printCss,/\.paper-page\{width:100%!important/,'print page must use the browser printable width');
assert.match(printCss,/\.stem\{font-size:14pt!important/,'printed question font must stay readable');
assert.match(printCss,/\.choices\{font-size:12\.5pt!important/,'printed choice font must stay readable');

assert.match(printJs,/function collectPrintMetrics\(\)/,'print overflow metrics are required');
assert.match(printJs,/max_overflow_px/,'print overflow metric is required');
assert.match(printJs,/if\(!prepareExactPrint\(\)\)return;/,'printing must be blocked when layout is unresolved');

console.log('paper builder performance and A4 print contracts: OK');
