const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.join(root, new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };

async function setup(browser, { sections = 1, allowBack = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 384, height: 832 }, locale: 'ar-SA', isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.install();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const calls = [], heldSave = deferred(), heldFinish = deferred();
  let blockSave = false, blockFinish = false, failFinish = false;
  const settings = { allow_back: allowBack, one_per_page: true, watermark: false, log_visibility: false, allow_copy: true, lock_session: false };
  let state = {
    attempt_id: 'qa-attempt', access_token: 'qa-token', student_name: 'طالب تجريبي', submitted: false,
    current_section: 0, cursor: allowBack ? 19 : 0,
    answers: Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['q0-' + i, 0])),
    section_started_at: new Date(Date.now() - 1000).toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), settings,
    sections: Array.from({ length: sections }, (_, s) => ({ subject: s ? 'math' : 'reading', duration_minutes: 30, questions: Array.from({ length: 20 }, (_, i) => ({ id: `q${s}-${i}`, context: 'نص تجريبي للتحقق من التسليم.', question: 'سؤال تجريبي ' + (i + 1), options: ['الأول', 'الثاني', 'الثالث', 'الرابع'] })) }))
  };
  await context.addInitScript(() => {
    sessionStorage.setItem('nafes_attempt_QATEST22', JSON.stringify({ attempt_id: 'qa-attempt', access_token: 'qa-token' }));
  });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:')) return route.continue();
    if (!url.includes('/functions/v1/nafes-exam')) return route.fulfill({ status: 200, body: '' });
    const body = route.request().postDataJSON();
    const action = body.action;
    const reply = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
    if (action === 'assessment_info') return reply({ title: 'اختبار تجريبي', settings, sections: state.sections.map(s => ({ ...s, question_count: 20 })) });
    if (action === 'assessment_resume') return reply(state);
    if (action === 'assessment_timing' || action === 'assessment_delivery_event') return reply({ ok: true });
    calls.push(body);
    if (action === 'assessment_save' && blockSave) { blockSave = false; await heldSave.promise; }
    if (action === 'assessment_finish' && blockFinish) { blockFinish = false; await heldFinish.promise; }
    if (action === 'assessment_finish' && failFinish) {
      failFinish = false;
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'تعذر تأكيد التسليم في الاختبار التجريبي' }) });
    }
    if (body.expected_section === state.current_section) {
      if (!allowBack) assert.ok(body.cursor === state.cursor || body.cursor === state.cursor + 1, 'no-back cursor cannot skip');
      state = { ...state, answers: body.answers, cursor: body.cursor, version: (state.version || 0) + 1 };
      if (action === 'assessment_advance') state = { ...state, current_section: state.current_section + 1, cursor: 0, section_started_at: new Date().toISOString() };
      if (action === 'assessment_finish') state = { ...state, submitted: true, result_hidden: true };
    }
    return reply(state);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/e.html?t=QATEST22`);
  await page.locator('#player:not([hidden])').waitFor();
  const select = async n => { await page.locator(`.choice:has(input[value="${n}"])`).click(); await page.clock.runFor(400); };
  const until = async fn => { for (let i = 0; i < 100; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('Condition not met'); };
  return { page, context, calls, errors, select, until, holdSave: () => { blockSave = true; }, releaseSave: heldSave.resolve, holdFinish: () => { blockFinish = true; }, releaseFinish: heldFinish.resolve, failFinish: () => { failFinish = true; } };
}

async function run(browser, name) {
  // Reproduce the video: final question, slow save, repeated save intents, then delivery.
  {
    const t = await setup(browser);
    t.holdSave(); await t.select(1); await t.until(() => t.calls.length === 1);
    await t.select(2); await t.select(3); await t.page.clock.runFor(30000);
    assert.equal(t.calls.length, 1, 'only one request in flight');
    assert.equal(await t.page.locator('#next').isVisible(), false, 'no Next button after the final question');
    t.holdFinish(); await t.page.locator('#finish').click();
    assert.match(await t.page.locator('#finish').textContent(), /جارٍ تسليم الاختبار/);
    assert.equal(await t.page.locator('#finish').isDisabled(), true);
    t.releaseSave(); await t.until(() => t.calls.some(c => c.action === 'assessment_finish'));
    assert.deepEqual(t.calls.map(c => c.action), ['assessment_save', 'assessment_finish'], 'delivery jumps ahead of queued saves');
    assert.equal(t.calls[1].answers['q0-19'], 3, 'delivery includes latest answer');
    t.releaseFinish(); await t.page.locator('#result:not([hidden])').waitFor();
    assert.match(await t.page.locator('#saveState').textContent(), /تم تسليم/);
    assert.equal(await t.page.evaluate(() => localStorage.getItem('nafes_draft_v2_QATEST22')), null);
    assert.deepEqual(t.errors, []); await t.context.close();
  }
  {
    const t = await setup(browser);
    t.holdSave(); await t.select(1); await t.until(() => t.calls.length === 1);
    await t.select(2); await t.select(3); await t.page.clock.runFor(30000);
    t.releaseSave(); await t.until(() => t.calls.length === 2);
    assert.equal(t.calls[1].answers['q0-19'], 3, 'queued autosaves coalesce to latest answer');
    assert.deepEqual(t.errors, []); await t.context.close();
  }
  {
    const t = await setup(browser);
    await t.context.setOffline(true); await t.select(2); await t.page.locator('#finish').click();
    await t.until(async () => !await t.page.locator('#finish').isDisabled());
    const draft = await t.page.evaluate(() => JSON.parse(localStorage.getItem('nafes_draft_v2_QATEST22')));
    assert.equal(draft.finish_requested, true); assert.equal(draft.answers['q0-19'], 2);
    assert.equal(t.calls.length, 0, 'offline saves do not occupy network queue');
    await t.context.setOffline(false); await t.page.locator('#result:not([hidden])').waitFor();
    assert.equal(t.calls.filter(c => c.action === 'assessment_finish').length, 1);
    assert.deepEqual(t.errors, []); await t.context.close();
  }
  {
    const t = await setup(browser);
    t.failFinish(); await t.page.locator('#finish').click();
    await t.until(async () => !await t.page.locator('#finish').isDisabled());
    assert.match(await t.page.locator('#playerError').textContent(), /تعذر تأكيد/);
    await t.page.locator('#finish').click(); await t.page.locator('#result:not([hidden])').waitFor();
    assert.equal(t.calls.filter(c => c.action === 'assessment_finish').length, 2);
    assert.deepEqual(t.errors, []); await t.context.close();
  }
  {
    const t = await setup(browser, { sections: 2 });
    t.holdSave(); await t.select(1); await t.until(() => t.calls.length === 1);
    await t.select(2); await t.page.locator('#finish').click(); t.releaseSave();
    await t.until(async () => (await t.page.locator('#sectionTitle').textContent()).includes('الرياضيات'));
    assert.deepEqual(t.calls.map(c => c.action), ['assessment_save', 'assessment_advance']);
    assert.equal(t.calls[1].expected_section, 0); assert.equal(t.calls[1].answers['q0-19'], 2);
    assert.equal(await t.page.locator('#finish').isDisabled(), false);
    assert.match(await t.page.locator('#finish').textContent(), /تسليم الاختبار/);
    assert.deepEqual(t.errors, []); await t.context.close();
  }
  {
    const t = await setup(browser, { allowBack: false });
    t.holdSave(); await t.page.locator('#next').click(); await t.until(() => t.calls.length === 1);
    await t.page.locator('#next').click(); await t.page.locator('#next').click();
    t.releaseSave(); await t.until(async () => (await t.page.locator('#questionTitle').textContent()).includes('٢ من'));
    assert.equal(t.calls.length, 1, 'repeated navigation cannot skip locked questions');
    assert.deepEqual(t.errors, []); await t.context.close();
  }
  console.log(`PASS ${name}: 6 mobile delivery scenarios`);
}
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    for (const [name, type] of [['Chromium', chromium], ['WebKit', webkit]]) {
      const browser = await type.launch({ headless: true });
      try { await run(browser, name); } finally { await browser.close(); }
    }
  } finally { server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
