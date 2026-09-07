/* Locally rendered QR codes. Only validated NAFES learner links can be encoded. */
(() => {
  'use strict';
  if (window.NafesQR) return;
  const ENDPOINT = 'https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam';
  const PRODUCTION = new URL('https://zarie19991-bit.github.io/moallimi/');
  const assetBase = new URL('.', document.currentScript?.src || location.href);
  const states = new WeakMap(); let libraryPromise;
  async function publicApi(action, body) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, action }), signal: controller.signal, cache: 'no-store' });
      const data = await r.json(); if (!r.ok || data.error) throw new Error(data.error || 'تعذر التحقق من الاختبار.'); return data;
    } catch (e) { throw new Error(e.name === 'AbortError' ? 'انتهت مهلة التحقق. أعد المحاولة.' : (e.message || 'تعذر التحقق من الاختبار.')); }
    finally { clearTimeout(timer); }
  }
  function parseUrl(value) {
    const raw = String(value || ''); const url = new URL(raw);
    const base = url.origin === PRODUCTION.origin ? PRODUCTION : assetBase;
    if (url.href !== raw || url.origin !== base.origin || url.username || url.password || url.hash || !['https:', 'http:'].includes(url.protocol)) throw new Error('رابط الاختبار غير صالح.');
    const parameters = [...url.searchParams.keys()];
    if (url.pathname === base.pathname + 'e.html' && parameters.length === 1 && parameters[0] === 't' && /^[A-Za-z0-9]{8}$/.test(url.searchParams.get('t') || '')) return { url: raw, type: 'short', code: url.searchParams.get('t') };
    if (url.pathname === base.pathname + 'exam.html' && parameters.length === 4 && ['s', 'o', 'i', 'm'].every(k => parameters.includes(k))) {
      const subject = url.searchParams.get('s'), outcome = url.searchParams.get('o'), indicator = Number(url.searchParams.get('i')), model = Number(url.searchParams.get('m'));
      if (['reading', 'math', 'science'].includes(subject) && /^[A-Za-z0-9_.-]{1,50}$/.test(outcome || '') && Number.isInteger(indicator) && indicator >= 1 && indicator <= 200 && [1, 2].includes(model)) return { url: raw, type: 'legacy', subject, outcome, indicator, model };
    }
    throw new Error('استخدم رابط اختبار محفوظًا؛ لا يمكن إنشاء رمز لرابط طويل أو غير معروف.');
  }
  async function validateUrl(value) {
    const parsed = parseUrl(value);
    const info = parsed.type === 'short' ? await publicApi('assessment_info', { code: parsed.code }) : await publicApi('preview', { subject: parsed.subject, outcome: parsed.outcome, indicator: parsed.indicator, model: parsed.model, indicator_text: window['NAFES_'+parsed.subject.toUpperCase()]?.outcomes?.find(o=>o.code===parsed.outcome)?.indicators?.[parsed.indicator-1] || '' });
    if (!info.ready || (info.code && parsed.type === 'short' && info.code !== parsed.code)) throw new Error(info.error || 'الاختبار غير جاهز؛ لم يُنشأ الرمز.');
    return { ...parsed, info };
  }
  function library() {
    if (window.qrcodegen) return Promise.resolve(window.qrcodegen);
    if (!libraryPromise) libraryPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = new URL('qr-vendor.js', assetBase).href;
      s.onload = () => window.qrcodegen ? resolve(window.qrcodegen) : reject(new Error('تعذر تحميل مولّد الرمز.'));
      s.onerror = () => reject(new Error('تعذر تحميل مولّد الرمز. أعد المحاولة.')); document.head.appendChild(s);
    }).catch(e => { libraryPromise = null; throw e; });
    return libraryPromise;
  }
  function clear(container) { states.delete(container); container.replaceChildren(); container.removeAttribute('data-qr-url'); }
  async function render(container, value) {
    clear(container); const request = {}; states.set(container, request);
    container.textContent = 'جارٍ التحقق من رابط الاختبار…'; container.setAttribute('aria-busy', 'true');
    try {
      const checked = await validateUrl(value); const lib = await library();
      if (states.get(container) !== request) return null;
      const qr = lib.QrCode.encodeText(checked.url, lib.QrCode.Ecc.MEDIUM);
      const quiet = 4, scale = 8, side = (qr.size + quiet * 2) * scale;
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = side;
      canvas.style.cssText = 'display:block;width:min(280px,100%);height:auto;margin:auto;image-rendering:pixelated;background:white';
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'رمز الاستجابة السريعة لرابط الاختبار الذي تم التحقق منه');
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('تعذر رسم الرمز على هذا المتصفح.');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, side, side); ctx.fillStyle = '#000000';
      for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.getModule(x, y)) ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      container.replaceChildren(canvas); container.dataset.qrUrl = checked.url;
      states.set(container, { url: checked.url, canvas, info: checked.info }); return checked;
    } catch (error) {
      if (states.get(container) === request) { clear(container); container.textContent = error.message || 'تعذر إنشاء الرمز.'; }
      throw error;
    } finally { container.removeAttribute('aria-busy'); }
  }
  function download(container, filename = 'nafes-qr.png') {
    const state = states.get(container); if (!state?.canvas) throw new Error('تحقق من الرابط وأنشئ الرمز أولًا.');
    const link = document.createElement('a'); link.download = filename.replace(/[^A-Za-z0-9_.-]/g, '-'); link.href = state.canvas.toDataURL('image/png'); link.click();
  }
  function print(container, title = 'اختبار نافس') {
    const state = states.get(container); if (!state?.canvas) throw new Error('تحقق من الرابط وأنشئ الرمز أولًا.');
    const frame = document.createElement('iframe'); frame.title = 'طباعة رمز الاختبار'; frame.style.cssText = 'position:fixed;width:1px;height:1px;border:0;left:-10000px'; document.body.appendChild(frame);
    const doc = frame.contentDocument; const style = doc.createElement('style'); style.textContent = '@page{size:A4;margin:20mm}body{text-align:center;font-family:Tahoma,Arial,sans-serif;color:#000;direction:rtl}h1{font-size:24px;margin-top:40px}img{width:90mm;height:90mm;image-rendering:pixelated}p{font-size:13px;direction:ltr;word-break:break-all}'; doc.head.appendChild(style);
    const heading = doc.createElement('h1'); heading.textContent = title; doc.body.appendChild(heading);
    const img = doc.createElement('img'); img.alt = 'رمز الاختبار'; const link = doc.createElement('p'); link.textContent = state.url;
    img.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); }; img.src = state.canvas.toDataURL('image/png'); doc.body.append(img, link);
    frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true }); setTimeout(() => frame.remove(), 60000);
  }
  async function resolveLegacy(subject, outcome, indicator, model) {
    const old = new URL('exam.html', PRODUCTION); old.search = new URLSearchParams({ s: subject, o: outcome, i: String(indicator), m: String(model) }).toString();
    if (!window.NafesTeacher?.getKey()) { await validateUrl(old.href); return { url: old.href, legacy: true }; }
    const result = await window.NafesTeacher.api('teacher_shorten_legacy', { subject, outcome, indicator, model });
    const checked = await validateUrl(result.url); if (checked.type !== 'short') throw new Error('لم يُرجع الخادم رابطًا مختصرًا صالحًا.'); return result;
  }
  window.NafesQR = { render, clear, download, print, validateUrl, resolveLegacy };
})();
