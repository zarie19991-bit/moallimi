const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../e-player-demo-fix.js'), 'utf8');
const queueSource = source.slice(source.indexOf('// One request in flight;'), source.indexOf('\nlet currentSection=0;'));
const settle = () => new Promise(r => setImmediate(r));
function setup() {
  const calls = [], elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, { textContent: '', disabled: false, setAttribute() {}, querySelectorAll: () => [] }); return elements.get(id); };
  const c = {
    state: { attempt_id: 'test', current_section: 0, sections: [{}, {}] }, currentSection: 0, answers: { q: 0 }, cursor: 0,
    active: true, navigator: { onLine: true }, saveDelay: null, clearTimeout,
    $: element, writeDraft() {}, flushDeliveryEvents() {},
    authBody: () => ({ answers: { ...c.answers }, cursor: c.cursor, expected_section: c.state.current_section }),
    render: () => { c.currentSection = c.state.current_section; },
    showResult: () => { c.active = false; element('saveState').textContent = 'تم تسليم المحاولة وحفظها'; },
    api: (action, payload) => new Promise((resolve, reject) => { calls.push({ action, payload, resolve, reject }); })
  };
  vm.createContext(c); vm.runInContext(queueSource + '\nglobalThis.save = save;', c);
  return { c, calls, element };
}
test('delivery overtakes a save backlog and carries the final answer', async () => {
  const { c, calls, element } = setup(); c.state.sections = [{}];
  const saves = [c.save()];
  for (let i = 1; i <= 100; i++) { c.answers.q = i; saves.push(c.save()); }
  const finish = c.save('assessment_finish');
  assert.equal(element('finish').disabled, true);
  assert.match(element('finish').textContent, /جارٍ تسليم الاختبار/);
  assert.equal(calls.length, 1);
  calls[0].resolve({ current_section: 0 }); await settle();
  assert.deepEqual(calls.map(x => x.action), ['assessment_save', 'assessment_finish']);
  assert.equal(calls[1].payload.answers.q, 100);
  assert.match(element('saveState').textContent, /تأكيد التسليم/);
  calls[1].resolve({ submitted: true, answers: { q: 100 } });
  await Promise.all([...saves, finish]);
  assert.match(element('saveState').textContent, /تم تسليم/);
  assert.equal(element('finish').disabled, false);
});
test('many pending autosaves send only their latest snapshot', async () => {
  const { c, calls } = setup(); const saves = [c.save()];
  for (let i = 1; i <= 100; i++) { c.answers.q = i; saves.push(c.save()); }
  calls[0].resolve({ current_section: 0 }); await settle();
  assert.equal(calls.length, 2); assert.equal(calls[1].payload.answers.q, 100);
  calls[1].resolve({ current_section: 0 }); await Promise.all(saves);
  assert.equal(calls.length, 2);
});
test('failed in-flight save cannot block queued submission', async () => {
  const { c, calls } = setup(); c.state.sections = [{}];
  const first = c.save().catch(() => {}), finish = c.save('assessment_finish');
  calls[0].reject(new Error('timeout')); await settle();
  assert.equal(calls[1].action, 'assessment_finish');
  calls[1].resolve({ submitted: true }); await Promise.all([first, finish]);
});
test('offline delivery releases the button and can be retried', async () => {
  const { c, calls, element } = setup(); c.state.sections = [{}]; c.navigator.onLine = false;
  await assert.rejects(c.save('assessment_finish'), /الاتصال منقطع/);
  assert.equal(calls.length, 0); assert.equal(element('finish').disabled, false);
  c.navigator.onLine = true; const retry = c.save('assessment_finish');
  calls[0].resolve({ submitted: true }); await retry;
});
test('a failed or unconfirmed finish does not masquerade as successful delivery', async () => {
  const { c, calls, element } = setup(); c.state.sections = [{}];
  const failed = c.save('assessment_finish');
  const rejected = assert.rejects(failed, /لم يؤكد الخادم/);
  calls[0].resolve({ current_section: 0, submitted: false }); await rejected;
  assert.equal(c.active, true); assert.equal(element('finish').disabled, false);
  const retry = c.save('assessment_finish'); calls[1].resolve({ submitted: true }); await retry;
});
test('old subject events are not replayed over the next subject', async () => {
  const { c, calls, element } = setup();
  const first = c.save(), oldEvent = c.save('assessment_event', { event: { type: 'visible' } });
  c.answers.q = 3; const advance = c.save('assessment_advance');
  calls[0].resolve({ current_section: 0 }); await settle();
  assert.equal(calls[1].action, 'assessment_advance'); assert.equal(calls[1].payload.answers.q, 3);
  calls[1].resolve({ current_section: 1, cursor: 0, answers: { q: 3 } });
  await Promise.all([first, oldEvent, advance]);
  assert.equal(calls.length, 2); assert.equal(c.currentSection, 1);
  assert.equal(element('finish').textContent, 'تسليم الاختبار');
});
test('duplicate delivery clicks share one network request', async () => {
  const { c, calls } = setup(); c.state.sections = [{}];
  const a = c.save('assessment_finish'), b = c.save('assessment_finish');
  assert.equal(a, b); assert.equal(calls.length, 1);
  calls[0].resolve({ submitted: true }); await Promise.all([a, b]);
});

function guardSetup(intent) {
  const sent = [], events = {}, data = new Map();
  if (intent) data.set('nafes_draft_v2_QATEST22', JSON.stringify(intent));
  const storage = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v) };
  const c = { URLSearchParams, location: { search: '?t=QATEST22' }, localStorage: storage, sessionStorage: storage,
    crypto: { randomUUID: () => 'session' }, addEventListener: (type, fn) => { events[type] = fn; },
    confirm: () => false, fetch: async (_, init) => { sent.push(JSON.parse(init.body)); return {}; } };
  c.window = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../exam-session-guard.js'), 'utf8'), c);
  const finish = id => c.fetch('/functions/v1/nafes-exam', { method: 'POST', body: JSON.stringify({ action: 'assessment_finish', attempt_id: id }) });
  return { sent, events, finish };
}
test('session guard blocks unconfirmed finish and intent from another attempt', async () => {
  for (const intent of [null, { attempt_id: 'other', finish_requested: true }, { attempt_id: 'test', finish_requested: false }]) {
    const g = guardSetup(intent); await g.finish('test'); assert.equal(g.sent[0].action, 'assessment_save');
  }
});
test('confirmed attempt survives repeated delivery retries but page close only saves', async () => {
  const g = guardSetup({ attempt_id: 'test', finish_requested: true, finish_requested_at: Date.now() - 60000 });
  await g.finish('test'); await g.finish('test');
  assert.deepEqual(g.sent.map(x => x.action), ['assessment_finish', 'assessment_finish']);
  g.events.pagehide(); await g.finish('test'); assert.equal(g.sent[2].action, 'assessment_save');
});
test('recorded timer expiry can deliver the matching attempt', async () => {
  const g = guardSetup({ attempt_id: 'test', finish_requested: true, auto_expiry: true });
  await g.finish('test'); assert.equal(g.sent[0].action, 'assessment_finish');
});
