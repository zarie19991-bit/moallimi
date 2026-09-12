import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (name) => fs.readFileSync(name, 'utf8');
const analysis = read('analysis-print.js');
const subject = read('subject-report-separate.js');
const general = read('report-test-options.js');
const html = read('analysis.html');
const signature = read('official-analysis-signature-fix.css');
const examHtml = read('e.html');
const retry = read('edge-retry.js');
const retryUi = read('edge-retry-ui.js');

assert.match(analysis, /نسبة التحصيل/);
assert.match(analysis, /achievement=possible\?sum\/possible\*100:null/);
assert.match(analysis, /data-grade-source="saved"/);
assert.doesNotMatch(analysis, /answer_snapshot/);
assert.doesNotMatch(analysis, /نسبة النجاح/);

assert.match(subject, /نسبة التحصيل/);
assert.match(subject, /achievement=possible\?sum\/possible\*100:null/);
assert.match(subject, /section_scores/);
assert.match(general, /savedMeasure/);
assert.match(general, /score\/total\*100/);

assert.match(html, /analysis-achievement-fix\.js\?v=20260912-1/);
assert.match(signature, /content:none!important/);
assert.match(signature, /\.sar-signatures span::before/);
assert.match(signature, /\.sar-signatures span::after/);

assert.match(examHtml, /edge-retry\.js\?v=20260912-1/);
assert.match(examHtml, /edge-retry-ui\.js\?v=20260912-1/);
assert.match(retry, /502,503,504/);
assert.match(retry, /nafes:edge-retry/);
assert.match(retryUi, /جارٍ إعادة الاتصال تلقائيًا/);

console.log('Analysis, print, saved-grade and transient-retry contracts passed.');
