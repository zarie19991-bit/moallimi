/* Shared teacher access. Keys never enter student URLs or request bodies. */
(() => {
  'use strict';
  if (window.NafesTeacher) return;
  const STORAGE = 'nafes_teacher_key_v1';
  const ENDPOINT = 'https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam';
  const READ_ACTIONS = new Set(['teacher_data', 'teacher_students_list']);
  const READ_CACHE_TTL = 15000;
  const readCache = new Map();
  let memoryKey = '';
  function getKey() { try { return localStorage.getItem(STORAGE) || memoryKey; } catch (_) { return memoryKey; } }
  function clearReadCache() { readCache.clear(); }
  function emit(authenticated) { window.dispatchEvent(new CustomEvent('nafes:auth-changed', { detail: { authenticated } })); }
  function setKey(value) {
    memoryKey = String(value || '').trim();
    clearReadCache();
    try { if (memoryKey) localStorage.setItem(STORAGE, memoryKey); else localStorage.removeItem(STORAGE); } catch (_) {}
    document.getElementById('nafesTeacherLogin')?.remove();
    emit(!!memoryKey);
  }
  function clearKey() { setKey(''); }
  function requireKey(message = 'أدخل مفتاح المعلم لعرض الاختبارات والنتائج.') {
    const event = new CustomEvent('nafes:auth-required', { cancelable: true, detail: { message } });
    if (!window.dispatchEvent(event) || document.getElementById('nafesTeacherLogin')) return;
    const layer = document.createElement('div');
    layer.id = 'nafesTeacherLogin'; layer.dir = 'rtl';
    layer.style.cssText = 'position:fixed;inset:0;z-index:5000;background:#102f3cbb;display:grid;place-items:center;padding:20px;font-family:inherit';
    layer.innerHTML = '<form role="dialog" aria-modal="true" aria-labelledby="nafesLoginTitle" style="width:min(460px,100%);background:white;color:#17324d;padding:28px;border-radius:20px;box-shadow:0 24px 70px #0004"><h2 id="nafesLoginTitle" style="font-size:1.3rem;margin:0 0 12px">دخول المعلم</h2><p data-message style="font-size:1rem;line-height:1.8"></p><label style="display:grid;gap:8px;font-size:1rem">مفتاح المعلم<input name="teacherKey" type="password" required autocomplete="off" spellcheck="false" dir="ltr" style="font:inherit;min-width:0;width:100%;border:1px solid #bacdce;border-radius:10px;padding:12px"></label><p style="font-size:.9rem;line-height:1.8;color:#526776">يُحفظ الدخول على هذا الجهاز. احتفظ بالمفتاح لنفسك.</p><div style="display:flex;gap:10px"><button type="submit" style="font:inherit;background:#0f6b63;color:white;border:0;border-radius:10px;padding:10px 18px;cursor:pointer">دخول</button><button type="button" data-close style="font:inherit;background:#edf3f3;color:#17324d;border:0;border-radius:10px;padding:10px 18px;cursor:pointer">إغلاق</button></div></form>';
    layer.querySelector('[data-message]').textContent = message;
    layer.querySelector('[data-close]').onclick = () => layer.remove();
    layer.addEventListener('keydown', e => {
      if (e.key === 'Escape') layer.remove();
      if (e.key === 'Tab') {
        const items = [...layer.querySelectorAll('input,button')];
        if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1).focus(); }
        else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus(); }
      }
    });
    layer.querySelector('form').onsubmit = e => { e.preventDefault(); setKey(layer.querySelector('input').value); };
    document.body.appendChild(layer); layer.querySelector('input').focus();
  }
  function cacheKey(action, body) { return `${action}|${JSON.stringify(body || {})}`; }
  async function request(action, body, key) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45000);
    let response, data;
    try {
      response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-teacher-key': key }, body: JSON.stringify({ ...body, action }), signal: controller.signal, cache: 'no-store' });
      data = await response.json().catch(() => ({}));
    } catch (error) {
      throw new Error(error.name === 'AbortError' ? 'استغرق الاتصال وقتًا طويلًا. أعد المحاولة.' : 'تعذر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.');
    } finally { clearTimeout(timeout); }
    if (!response.ok || data.error) {
      if (response.status === 401 || response.status === 403) { clearKey(); requireKey(data.error || 'مفتاح المعلم غير صالح. أدخل المفتاح الصحيح.'); }
      throw Object.assign(new Error(data.error || 'تعذر إتمام الطلب. أعد المحاولة.'), { status: response.status, code: response.status === 401 || response.status === 403 ? 'TEACHER_AUTH_REQUIRED' : 'API_ERROR' });
    }
    return data;
  }
  async function api(action, body = {}) {
    const key = getKey();
    if (!key) {
      requireKey();
      throw Object.assign(new Error('يلزم دخول المعلم للمتابعة.'), { status: 401, code: 'TEACHER_AUTH_REQUIRED' });
    }
    if (READ_ACTIONS.has(action)) {
      const ck = cacheKey(action, body), now = Date.now(), hit = readCache.get(ck);
      if (hit && hit.expires > now) return hit.promise;
      const promise = request(action, body, key);
      readCache.set(ck, { expires: now + READ_CACHE_TTL, promise });
      try { return await promise; }
      catch (error) { if (readCache.get(ck)?.promise === promise) readCache.delete(ck); throw error; }
    }
    const data = await request(action, body, key);
    clearReadCache();
    return data;
  }
  window.NafesTeacher = { api, getKey, setKey, clearKey, requireKey, clearReadCache };
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (fragment.has('key')) {
    const key = fragment.get('key'); fragment.delete('key');
    history.replaceState(history.state, '', location.pathname + location.search + (fragment.toString() ? '#' + fragment.toString() : ''));
    setKey(key);
  }
})();
