import https from 'node:https';
import { performance } from 'node:perf_hooks';

const endpoint = new URL('https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam');
const STUDENTS = 150;
const CODE = 'LDTESTAB';
const CLASS_NAME = 'LOAD150';
const agent = new https.Agent({ keepAlive: true, maxSockets: 220, maxFreeSockets: 220 });

function post(payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const started = performance.now();
    const req = https.request({
      hostname: endpoint.hostname,
      port: 443,
      path: endpoint.pathname,
      method: 'POST',
      agent,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(data),
        'user-agent': 'moallimi-load-test-150/1.0'
      },
      timeout: 60000
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        let body = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300 && !body?.error, status: res.statusCode, ms: performance.now() - started, body });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err) => resolve({ ok: false, status: 0, ms: performance.now() - started, body: { error: err.message } }));
    req.write(data);
    req.end();
  });
}

function percentile(values, p) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  const i = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  return Number(a[i].toFixed(1));
}

function stats(name, rows) {
  const good = rows.filter(r => r.ok);
  const bad = rows.filter(r => !r.ok);
  const times = good.map(r => r.ms);
  const statuses = {};
  for (const r of rows) statuses[String(r.status)] = (statuses[String(r.status)] || 0) + 1;
  const errors = {};
  for (const r of bad) {
    const key = String(r.body?.error || r.body?.message || 'unknown').slice(0, 180);
    errors[key] = (errors[key] || 0) + 1;
  }
  return {
    phase: name,
    total: rows.length,
    success: good.length,
    failed: bad.length,
    success_rate: Number((good.length / Math.max(rows.length, 1) * 100).toFixed(2)),
    p50_ms: percentile(times, 50),
    p95_ms: percentile(times, 95),
    p99_ms: percentile(times, 99),
    max_ms: times.length ? Number(Math.max(...times).toFixed(1)) : null,
    statuses,
    errors
  };
}

const pad = n => String(n).padStart(3, '0');
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

console.log(`LOAD_TEST_BEGIN students=${STUDENTS} run=${runId}`);

// Warm one read so the test measures a warmed Edge Function and then tests the burst.
const warm = await post({ action: 'assessment_info', code: CODE });
console.log('WARMUP', JSON.stringify(stats('warmup', [warm])));
if (!warm.ok) {
  console.error('Warmup failed:', JSON.stringify(warm.body));
  process.exit(2);
}

const identities = Array.from({ length: STUDENTS }, (_, idx) => {
  const n = idx + 1;
  return {
    n,
    student_name: `loadtest student ${pad(n)}`,
    student_no: pad(n),
    class_name: CLASS_NAME,
    session_id: `load-${runId}-${pad(n)}`
  };
});

const burstStart = performance.now();
const startRows = await Promise.all(identities.map(s => post({
  action: 'assessment_start',
  code: CODE,
  student_name: s.student_name,
  student_no: s.student_no,
  class_name: s.class_name,
  session_id: s.session_id
})));
const startWallMs = performance.now() - burstStart;
console.log('START_STATS', JSON.stringify({ ...stats('start', startRows), wall_ms: Number(startWallMs.toFixed(1)) }));

const active = [];
for (let i = 0; i < startRows.length; i++) {
  const r = startRows[i];
  if (r.ok && r.body?.attempt_id && r.body?.access_token) active.push({ ...identities[i], attempt_id: r.body.attempt_id, access_token: r.body.access_token });
}

const answers = { 'load-q1': 0, 'load-q2': 1, 'load-q3': 1, 'load-q4': 1, 'load-q5': 2 };
const saveBurst = performance.now();
const saveRows = await Promise.all(active.map(s => post({
  action: 'assessment_save',
  attempt_id: s.attempt_id,
  access_token: s.access_token,
  session_id: s.session_id,
  cursor: 4,
  answers
})));
const saveWallMs = performance.now() - saveBurst;
console.log('SAVE_STATS', JSON.stringify({ ...stats('save', saveRows), wall_ms: Number(saveWallMs.toFixed(1)) }));

const finishable = active.filter((_, i) => saveRows[i]?.ok);
const finishBurst = performance.now();
const finishRows = await Promise.all(finishable.map(s => post({
  action: 'assessment_finish',
  attempt_id: s.attempt_id,
  access_token: s.access_token,
  session_id: s.session_id,
  answers
})));
const finishWallMs = performance.now() - finishBurst;
console.log('FINISH_STATS', JSON.stringify({ ...stats('finish', finishRows), wall_ms: Number(finishWallMs.toFixed(1)) }));

const finishedScored = finishRows.filter(r => r.ok && r.body?.submitted === true && Number(r.body?.score) === 5 && Number(r.body?.total) === 5).length;
console.log('INTEGRITY', JSON.stringify({ active_after_start: active.length, save_ok: saveRows.filter(r => r.ok).length, finish_ok: finishRows.filter(r => r.ok).length, finished_with_expected_score: finishedScored }));
console.log('LOAD_TEST_END');

agent.destroy();

if (active.length !== STUDENTS || saveRows.filter(r => r.ok).length !== STUDENTS || finishRows.filter(r => r.ok).length !== STUDENTS || finishedScored !== STUDENTS) {
  process.exitCode = 1;
}
