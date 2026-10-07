import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8');

test('retry layer covers transient gateway failures and critical actions',()=>{
  const s=read('edge-retry.js');
  for(const code of ['408','425','429','500','502','503','504','520','522','524'])assert.match(s,new RegExp('\\b'+code+'\\b'));
  assert.match(s,/CRITICAL/);
  assert.match(s,/maxAttempts=.*5/);
  assert.match(s,/Retry-After/);
});

test('modern exam stores only a durable answer draft and resubmits final intent',()=>{
  const s=read('e-player-demo-fix.js');
  assert.match(s,/nafes_draft_v2_/);
  assert.match(s,/writeDraft/);
  assert.match(s,/finish_requested/);
  assert.match(s,/retryPendingFinish/);
  assert.match(s,/submission_receipt/);
  assert.match(s,/assessment_delivery_event/);
  assert.doesNotMatch(s,/localStorage\.setItem\([^\n]+access_token/);
});

test('legacy exam has durable draft and automatic final retry',()=>{
  const s=read('exam.js');
  assert.match(s,/nafes_legacy_draft_v2_/);
  assert.match(s,/finish_requested/);
  assert.match(s,/setInterval\([^\n]+finish\(true\)/);
  assert.match(s,/submission_receipt/);
});

test('teacher dashboard exposes delivery health monitoring',()=>{
  const s=read('delivery-health.js');
  assert.match(s,/teacher_delivery_health/);
  assert.match(s,/pending_attempts/);
  assert.match(s,/submit_receipts/);
  assert.match(s,/60000/);
});

test('live pages publish the resilience assets',()=>{
  const e=read('e.html'),legacy=read('exam.html'),analysis=read('analysis.html'),manifest=read('production-files.txt');
  assert.match(e,/edge-retry\.js\?v=20261007-delivery2/);
  assert.match(e,/e-player-demo-fix\.js\?v=20261007-delivery2/);
  assert.match(legacy,/exam\.js\?v=20261007-delivery2/);
  assert.match(analysis,/delivery-health\.js\?v=20261007-delivery2/);
  assert.match(manifest,/^delivery-health\.js$/m);
});
