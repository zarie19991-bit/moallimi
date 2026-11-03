// Runs the REAL exam-session-guard.js + e-player-demo-fix.js inside node:vm with a small DOM stub,
// wired to the REAL server code (handleAssessments) through a fake fetch.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CODE } from './fixtures.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
export const EDGE_URL = 'https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam';
const sleep0 = () => new Promise(r => setImmediate(r));

const storage = (map = new Map()) => ({
  _m: map, getItem: k => (map.has(String(k)) ? map.get(String(k)) : null),
  setItem: (k, v) => { map.set(String(k), String(v)); }, removeItem: k => { map.delete(String(k)); },
  get length() { return map.size; }, key: i => [...map.keys()][i] ?? null
});

const STATIC_IDS = new Set([...read('e.html').matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

function el(id, onIds = () => {}) {
  let html = '';
  const e = {
    id, hidden: false, disabled: false, textContent: '', value: '',
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); for (const m of html.matchAll(/\sid="([^"]+)"/g)) onIds(m[1]); }, checked: false, readOnly: false,
    style: {}, dataset: {}, children: [], _h: {}, _q: new Map(), className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(t, f) { (e._h[t] ??= []).push(f); }, removeEventListener() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    querySelector(s) { if (!e._q.has(s)) e._q.set(s, el(s, onIds)); return e._q.get(s); },
    querySelectorAll: () => [], appendChild(c) { e.children.push(c); if (c.id) onIds(c.id, c); return c; }, prepend(c) { e.children.unshift(c); },
    replaceChildren() {}, remove() { e.removed = true; }, focus() {}, scrollIntoView() {}, closest: () => e,
    requestSubmit() { return e.onsubmit?.({ preventDefault() {} }); }, showModal() {}, close() {}
  };
  return e;
}

// A "device" = storage shared by every tab of one browser profile (localStorage + durable store).
export function makeDevice(server, { idb = true } = {}) {
  return { server, local: new Map(), durable: idb ? new Map() : null, offline: false, fetchLog: [], failWhen: null, tabs: [] };
}

export function openTab(device, { session = new Map(), url = `?t=${CODE}` } = {}) {
  const elements = new Map(), intervals = [], timeouts = [], listeners = {};
  const dynamic = new Set();
  const onIds = (id, node) => { dynamic.add(id); if (node) elements.set(id, node); };
  const body = el('body', onIds);
  const nav = { onLine: !device.offline, sendBeacon() { return true; } };
  let pending = 0;
  const doc = {
    body, hidden: false, activeElement: null,
    getElementById(id) {
      if (!STATIC_IDS.has(id) && !dynamic.has(id)) return null;
      if (!elements.has(id)) elements.set(id, el(id, onIds));
      return elements.get(id);
    },
    createElement: tag => el(tag, onIds), querySelector: s => el(s, onIds), querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}
  };
  const fakeFetch = async (input, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    device.fetchLog.push({ action: body.action, attempt_id: body.attempt_id, session_id: body.session_id });
    if (device.offline || nav.onLine === false) throw new TypeError('Failed to fetch');
    const hook = device.failWhen?.(body);
    if (hook === 'network') throw new TypeError('Failed to fetch');
    if (typeof hook === 'number') return { ok: false, status: hook, json: async () => ({ error: 'server error' }) };
    pending++;
    try {
      const r = await device.server.call(body);
      return r.ok ? { ok: true, status: 200, json: async () => r.data } : { ok: false, status: r.status, json: async () => ({ error: r.error }) };
    } finally { pending--; }
  };
  const ctx = {
    console, URL, URLSearchParams, AbortController, Blob, TextEncoder, structuredClone, queueMicrotask,
    performance, crypto: webcrypto, Intl, document: doc, navigator: nav,
    localStorage: storage(device.local), sessionStorage: storage(session),
    location: { search: url, href: `https://x.test/e.html${url}`, replace() {} },
    confirm: () => true, alert() {}, fetch: fakeFetch,
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval: id => { if (intervals[id - 1]) intervals[id - 1].dead = true; },
    setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; }, clearTimeout: id => { if (timeouts[id - 1]) timeouts[id - 1].dead = true; },
    addEventListener(t, f) { (listeners[t] ??= []).push(f); }, removeEventListener() {}, dispatchEvent() {}, CustomEvent: class {}
  };
  ctx.window = ctx;
  if (device.durable) {
    ctx.NafesDurableStore = Object.freeze({
      get: async k => device.durable.get(String(k))?.value ?? null,
      put: async (k, v) => { device.durable.set(String(k), { value: structuredClone(v) }); return true; },
      remove: async k => { device.durable.delete(String(k)); return true; }
    });
  }
  vm.createContext(ctx);
  const tab = {
    ctx, el: id => doc.getElementById(id), body, nav, device, session,
    async idle() { for (let i = 0, quiet = 0; i < 400 && quiet < 4; i++) { await sleep0(); quiet = pending === 0 ? quiet + 1 : 0; } },
    async runIntervals(ms) { for (const t of intervals.filter(x => x.ms === ms && !x.dead)) await t.fn(); await tab.idle(); },
    async runTimeouts(ms) { for (const t of timeouts.filter(x => x.ms === ms && !x.dead)) { t.dead = true; await t.fn(); } await tab.idle(); },
    async runAllTimeouts(rounds = 1) { for (let i = 0; i < rounds; i++) { for (const t of timeouts.filter(x => !x.dead)) { t.dead = true; await t.fn(); } await tab.idle(); } },
    fire(type, ev = {}) { for (const f of listeners[type] || []) f(ev); },
    setOffline(v) { nav.onLine = !v; },
    load(files = ['exam-session-guard.js', 'e-player-demo-fix.js']) { for (const f of files) vm.runInContext(read(f), ctx, { filename: f }); return tab.idle(); },
    async fillIdentity(who) {
      tab.el('studentName').value = who.full_name; tab.el('studentNo').value = who.national_id_last3; tab.el('className').value = who.class_name;
    },
    async start(who) {
      await tab.fillIdentity(who);
      tab.el('identity').onsubmit({ preventDefault() {} });
      tab.el('integrityCheck').checked = true;
      tab.el('confirmExamStart')._h.click[0]();
      await tab.idle();
    },
    answer(qid, n) {
      tab.el('questions').onchange({ target: { matches: () => true, value: String(n), closest: s => (s === '[data-question]' ? { dataset: { question: qid } } : { querySelectorAll: () => [] }) } });
    },
    async submit() {
      const p = tab.el('finish').onclick();
      await sleep0();
      const overlay = body.children.filter(c => c.className === 'exam-submit-confirm' && !c.removed).pop();
      overlay.querySelector('[data-confirm-submit]').onclick();
      await p; await tab.idle();
    },
    draftFor(attemptId) {
      for (const key of [`nafes_draft_v2_${CODE}_${attemptId}`, `nafes_draft_v2_${CODE}`]) {
        try { const d = JSON.parse(device.local.get(key) || 'null'); if (d?.attempt_id === attemptId) return d; } catch { /* ignore */ }
      }
      return null;
    }
  };
  device.tabs.push(tab);
  return tab;
}
