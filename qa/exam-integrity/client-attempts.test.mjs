import test from 'node:test';
import assert from 'node:assert/strict';
import { build, STUDENTS } from './fixtures.mjs';
import vm from 'node:vm';
import fs from 'node:fs';
import { makeDevice, openTab } from './player-harness.mjs';

const { ali, omar } = STUDENTS;
const attemptsOf = t => t.db.tables.nafes_assessment_attempts;
const finishes = d => d.fetchLog.filter(x => x.action === 'assessment_finish');

test('sanity: the real player + guard load, start an attempt, autosave and resume', async () => {
  const t = build({ lock_session: false });
  const dev = makeDevice(t);
  const tab = openTab(dev); await tab.load();
  await tab.start(ali);
  assert.equal(attemptsOf(t).length, 1);
  tab.answer('q1', 2); await tab.runTimeouts(350);
  assert.deepEqual(attemptsOf(t)[0].answers, { q1: 2 });
  const reload = openTab(dev, { session: tab.session }); await reload.load();
  assert.equal(reload.el('saveState').textContent !== undefined, true);
  assert.equal(attemptsOf(t).length, 1, 'same-tab reload resumes, no new attempt');
});

test('CAUSE 1: another attempt\'s unconfirmed "finish" intent must not auto-submit a different student\'s attempt', async () => {
  const t = build({ lock_session: false });
  const dev = makeDevice(t);
  // Ali presses "submit test" but the network is down; he walks away. The finish intent stays in this device's draft.
  const a = openTab(dev); await a.load(); await a.start(ali);
  a.answer('q1', 2); a.setOffline(true);
  await a.submit();
  const aliAttempt = attemptsOf(t).find(r => r.student_name === ali.full_name);
  assert.equal(a.draftFor(aliAttempt.id).finish_requested, true, 'precondition: Ali\'s unconfirmed finish intent is stored locally');
  // Omar sits down at the same device (new tab/session) and starts his own attempt.
  dev.offline = false;
  const b = openTab(dev); await b.load(); await b.start(omar);
  const omarAttempt = attemptsOf(t).find(r => r.student_name === omar.full_name);
  assert.ok(omarAttempt, 'omar has his own attempt');
  assert.notEqual(b.draftFor(omarAttempt.id)?.finish_requested, true, "omar's draft must not inherit ali's finish intent");
  assert.equal(b.draftFor(aliAttempt.id)?.finish_requested, true, "ali's own finish intent is kept for ali's own retry");
  await b.runIntervals(10000);          // the player's 10s "retry pending finish" watchdog
  assert.equal(finishes(dev).filter(x => x.attempt_id === omarAttempt.id).length, 0, "no finish may be sent for omar's attempt");
  assert.equal(attemptsOf(t).find(r => r.id === omarAttempt.id).submitted_at, null, "omar's attempt must still be open");
});

test('CAUSE 2: a draft that belongs to another attempt must not hide this attempt\'s own unsent answers', async () => {
  const t = build({ lock_session: false });
  const dev = makeDevice(t);
  // Ali answers q1 while offline: the answer exists only in Ali's local draft.
  const a = openTab(dev); await a.load(); await a.start(ali);
  a.setOffline(true); a.answer('q1', 2);
  const aliAttempt = attemptsOf(t)[0];
  assert.deepEqual(aliAttempt.answers, {}, 'precondition: q1 never reached the server');
  // Omar uses a second tab of the same browser profile and keeps answering (his autosaves rewrite the draft slot).
  const b = openTab(dev); await b.load(); await b.start(omar);
  b.answer('q1', 1); await b.runTimeouts(350);
  // Ali's tab dies; Ali re-enters his identity in a fresh tab.
  const c = openTab(dev); await c.load(); await c.start(ali);
  await c.idle();
  await c.runTimeouts(350); await c.runIntervals(15000);
  assert.equal(attemptsOf(t).find(r => r.id === aliAttempt.id).answers.q1, 2, "ali's own unsent answer must be restored and synced");
  assert.equal(attemptsOf(t).find(r => r.student_name === omar.full_name).answers.q1, 1, "omar's answer is untouched");
});

test('CAUSE 3: a transient failure while resuming must not wipe the resume token (definitive 403 still does)', async () => {
  const t = build({ lock_session: false });
  const dev = makeDevice(t);
  const a = openTab(dev); await a.load(); await a.start(ali);
  assert.ok(a.session.get(`nafes_attempt_${'ABCD2345'}`), 'precondition: resume record exists');
  dev.failWhen = b => (b.action === 'assessment_resume' ? 'network' : null);
  const slow = openTab(dev, { session: a.session }); await slow.load();
  assert.ok(a.session.get('nafes_attempt_ABCD2345'), 'resume record survives a network failure');
  dev.failWhen = null;
  const ok = openTab(dev, { session: a.session }); await ok.load();
  assert.equal(ok.el('player').hidden, false, 'the next reload resumes the attempt without re-entering identity');
  assert.equal(attemptsOf(t).length, 1);
  // A definitive rejection (token superseded) must still clear the record.
  const row = attemptsOf(t)[0]; row.access_hash = 'rotated';
  const dead = openTab(dev, { session: a.session }); await dead.load();
  assert.equal(a.session.get('nafes_attempt_ABCD2345') ?? null, null);
});

test('LOAD: a flaky network on the first assessment_info call recovers by itself (no manual retry needed)', async () => {
  const t = build();
  const dev = makeDevice(t);
  let n = 0; dev.failWhen = b => (b.action === 'assessment_info' && ++n <= 2 ? 'network' : null);
  const tab = openTab(dev); await tab.load();
  for (let i = 0; i < 4 && tab.el('title').textContent !== 'اختبار'; i++) await tab.runAllTimeouts();
  assert.equal(tab.el('title').textContent, 'اختبار');
  assert.equal(tab.el('identity').hidden, false);
});

test('LOAD: a permanent server refusal (e.g. unknown test code) is not retried and shows the error at once', async () => {
  const t = build();
  const dev = makeDevice(t);
  const tab = openTab(dev, { url: '?t=ZZZZ2222' }); await tab.load();
  assert.equal(dev.fetchLog.filter(x => x.action === 'assessment_info').length, 1);
  assert.equal(tab.el('title').textContent, 'تعذر فتح الاختبار');
});

test('REGRESSION: with localStorage wiped, the durable store still restores this attempt\'s own unsent answer', async () => {
  const t = build({ lock_session: false });
  const dev = makeDevice(t);
  const a = openTab(dev); await a.load(); await a.start(ali);
  a.setOffline(true); a.answer('q2', 3);
  dev.local.clear();                                   // e.g. the browser evicted localStorage but kept IndexedDB
  const b = openTab(dev); await b.load(); await b.start(ali);
  await b.runIntervals(15000);
  assert.equal(attemptsOf(t)[0].answers.q2, 3);
});

test('HANG: a durable store whose indexedDB.open never answers must not freeze the exam', async () => {
  const ctx = { window: {}, indexedDB: { open: () => ({}) }, setTimeout, clearTimeout, Promise };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('../../exam-durable-store.js', import.meta.url), 'utf8'), ctx);
  const raced = p => Promise.race([p, new Promise(r => setTimeout(() => r('HUNG'), 4000))]);
  assert.equal(await raced(ctx.NafesDurableStore.get('k')), null);
  assert.equal(await raced(ctx.NafesDurableStore.put('k', { a: 1 })), false);
  assert.equal(await raced(ctx.NafesDurableStore.remove('k')), false);
});
