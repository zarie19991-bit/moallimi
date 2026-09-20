/* Shared teacher access. Real teacher keys never enter student URLs or request bodies. */
(() => {
  'use strict';
  if (window.NafesTeacher) return;
  const STORAGE = 'nafes_teacher_key_v1';
  const SESSION_STORAGE = 'nafes_teacher_session_key_v1';
  const QA_STORAGE = 'nafes_teacher_qa_v1';
  const PROFILE_CACHE = 'nafes_teacher_profile_cache_v1';
  const ENDPOINT = 'https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam';
  const QA_ENDPOINT = 'https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-qa-teacher';
  const PROFILE_ENDPOINT = 'https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-teacher-profile';
  const READ_ACTIONS = new Set(['teacher_data', 'teacher_students_list']);
  const READ_CACHE_TTL = 15000;
  const SUBJECTS = new Set(['reading','math','science']);
  const readCache = new Map();
  let memoryKey = '';
  let profile = null;
  let profilePromise = null;

  function isQa() {
    try { return sessionStorage.getItem(QA_STORAGE) === '1' || localStorage.getItem(QA_STORAGE) === '1'; } catch (_) { return false; }
  }
  function getKey() {
    if (isQa()) return '__qa__';
    try { return sessionStorage.getItem(SESSION_STORAGE) || memoryKey || localStorage.getItem(STORAGE) || ''; } catch (_) { return memoryKey; }
  }
  function clearReadCache() { readCache.clear(); }
  function readCachedProfile(){try{const raw=sessionStorage.getItem(PROFILE_CACHE)||localStorage.getItem(PROFILE_CACHE)||'';const p=raw?JSON.parse(raw):null;return p&&['all','reading','math','science'].includes(p.subject_scope)?p:null;}catch(_){return null;}}
  function cacheProfile(p){try{sessionStorage.setItem(PROFILE_CACHE,JSON.stringify(p));if(localStorage.getItem(STORAGE))localStorage.setItem(PROFILE_CACHE,JSON.stringify(p));else localStorage.removeItem(PROFILE_CACHE);}catch(_){}}
  function clearProfileCache(){try{sessionStorage.removeItem(PROFILE_CACHE);localStorage.removeItem(PROFILE_CACHE);}catch(_){}}
  function resetProfile() { profile = null; profilePromise = null; document.documentElement.removeAttribute('data-teacher-scope'); document.documentElement.classList.remove('teacher-scoped-preboot'); document.getElementById('nafesTeacherScopeStyle')?.remove(); }
  function emit(authenticated) { window.dispatchEvent(new CustomEvent('nafes:auth-changed', { detail: { authenticated, mode: isQa() ? 'qa' : 'teacher' } })); }
  function subjectOfQuestion(q) { return String(q?.subject || q?.subject_key || '').trim().toLowerCase(); }
  function scope() { return profile?.subject_scope || readCachedProfile()?.subject_scope || 'all'; }
  function scopeAllows(subject) { const s = scope(); return s === 'all' || s === String(subject || '').trim().toLowerCase(); }

  function filterAttempt(a) {
    const s = scope();
    if (s === 'all' || !a) return a;
    const questions = (a.questions || []).filter(q => subjectOfQuestion(q) === s);
    if (!questions.length) return null;
    const scorable = questions.filter(q => q.scorable !== false && q.correct !== null && q.correct !== undefined);
    const correct = scorable.filter(q => q.correct === true).length;
    const submitted = a.status === 'submitted' || !!a.submitted_at;
    const total = scorable.length || questions.length;
    return { ...a, subjects: [s], questions, score: submitted ? correct : null, total, percent: submitted && total ? Math.round(correct * 10000 / total) / 100 : (submitted ? 0 : null) };
  }
  function filterResponse(action, data) {
    const s = scope();
    if (s === 'all' || !data || typeof data !== 'object') return data;
    if (action === 'teacher_data') return { ...data, attempts: (data.attempts || []).filter(a => a?.source !== 'simulation').map(filterAttempt).filter(Boolean), tests: (data.tests || []).filter(t => t?.kind !== 'simulation' && (t.subjects || []).includes(s)), indicators: (data.indicators || []).filter(i => i.subject === s) };
    if (action === 'teacher_catalog') {
      const tests = (data.tests || []).filter(t => t?.kind !== 'simulation' && (t.subjects || []).includes(s));
      const indicators = (data.indicators || []).filter(i => i.subject === s);
      const simulation_indicators = (data.simulation_indicators || []).filter(i => i.subject === s);
      const forms = (data.forms || []).filter(f => f.subject === s);
      const sum = data.simulation_summary || {};
      return { ...data, tests, indicators, simulation_indicators, forms, simulation_summary: { reading: s === 'reading' ? Number(sum.reading || 0) : 0, math: s === 'math' ? Number(sum.math || 0) : 0, science: s === 'science' ? Number(sum.science || 0) : 0 } };
    }
    if (action === 'teacher_paper') {
      const sections = (data.sections || []).filter(sec => String(sec.subject || '') === s);
      const attempt = filterAttempt(data.attempt);
      if (!sections.length || !attempt) throw new Error('هذه الورقة لا تتبع مادة هذا المعلم.');
      return { ...data, attempt, sections };
    }
    return data;
  }

  function validateScopedAction(action, body) {
    const s = scope(); if (s === 'all') return;
    if (action === 'teacher_preview') { const sections = body?.config?.sections || []; if (!sections.length || sections.some(sec => String(sec.subject || '') !== s)) throw new Error('يمكنك إنشاء اختبارات مادة حسابك فقط.'); }
    if (action === 'teacher_shorten_legacy' || action === 'teacher_build_forms') { if (String(body?.subject || '') !== s) throw new Error('هذه العملية ليست ضمن مادة حسابك.'); }
    if (action === 'teacher_test_clear_results') { const id = String(body?.test_id || body?.id || ''); if (id.startsWith('exam:') && id.split(':')[1] !== s) throw new Error('لا يمكنك مسح نتائج مادة أخرى.'); if (id.startsWith('simulation:')) throw new Error('مسح نتائج المحاكاة المشتركة متاح للحساب الشامل فقط.'); }
    if (action === 'teacher_tests_bulk_clear') { if (body?.clear_all === true) throw new Error('حذف جميع النتائج متاح للحساب الشامل فقط.'); for (const raw of body?.test_ids || []) { const id = String(raw || ''); if (id.startsWith('exam:') && id.split(':')[1] !== s) throw new Error('تتضمن القائمة اختبارًا من مادة أخرى.'); if (id.startsWith('simulation:')) throw new Error('مسح نتائج المحاكاة المشتركة متاح للحساب الشامل فقط.'); } }
  }

  function applyScopeDom() {
    const s = scope(); document.documentElement.dataset.teacherScope = s; document.documentElement.classList.remove('teacher-scoped-preboot'); document.getElementById('nafesTeacherScopeStyle')?.remove();
    const currentPage=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    if (s !== 'all' && (currentPage==='' || currentPage==='index.html')) { location.replace('teacher.html'); return; }
    if (s === 'all') return;
    const style = document.createElement('style'); style.id = 'nafesTeacherScopeStyle'; style.textContent = `[data-subject]:not([data-subject="${s}"]){display:none!important}.selection-panel[data-select-subject]:not([data-select-subject="${s}"]){display:none!important}#navStudentsBtn,.btn-quick-manage,.simulation-secondary-btn,#resetTrialDataBtn{display:none!important}`; document.head.appendChild(style);
    const fix = () => {
      for (const id of ['subjectSelect','reportSubjectSelect','paperSubject']) { const sel = document.getElementById(id); if (!sel) continue; [...sel.options].forEach(o => { o.hidden = o.value && o.value !== s; o.disabled = o.value && o.value !== s; }); if ([...sel.options].some(o => o.value === s)) { sel.value = s; sel.dispatchEvent(new Event('change', { bubbles: true })); } }
      document.querySelectorAll('.section-row[data-subject]').forEach(row => { const allowed = row.dataset.subject === s; row.hidden = !allowed; const enabled = row.querySelector('.enabled'); if (enabled) { enabled.disabled = !allowed; enabled.checked = allowed; } });
      const full = document.querySelector('input[name="testType"][value="full"]'); if (full) { const label = full.closest('label'); if (label) label.style.display = 'none'; if (full.checked) { const custom = document.querySelector('input[name="testType"][value="custom"]'); if (custom) { custom.checked = true; custom.dispatchEvent(new Event('change', { bubbles: true })); } } }
      const overviewTab = document.querySelector('[data-view="overview"]'), reportTab = document.querySelector('[data-view="report"]'); if (overviewTab) overviewTab.style.display = 'none'; if (reportTab) reportTab.style.display = 'none'; if (overviewTab?.classList.contains('active')) document.querySelector('[data-view="subject"]')?.click();
      document.querySelectorAll('[data-master-home]').forEach(a=>{a.setAttribute('href','teacher.html');a.textContent='حساب المعلم';});
      document.querySelectorAll('[data-teacher-area-title]').forEach(el=>{el.textContent=(profile?.label||readCachedProfile()?.label||'معلم المادة')+' — '+subjectLabel(s);});
    };
    fix(); setTimeout(fix, 0); setTimeout(fix, 250);
  }

  async function ensureProfile(key = getKey()) {
    if (isQa()) { profile = { label: 'دخول تجريبي', subject_scope: 'all', qa: true }; cacheProfile(profile); applyScopeDom(); return profile; }
    if (!key || key === '__qa__') return null; if (profile) return profile; if (profilePromise) return profilePromise;
    profilePromise = (async () => { const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000); try { const response = await fetch(PROFILE_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json','x-teacher-key':key}, body:'{}', signal:controller.signal, cache:'no-store' }); const data = await response.json().catch(() => ({})); if (!response.ok || data.error) throw Object.assign(new Error(data.error || 'تعذر التحقق من صلاحية المعلم.'), { status: response.status }); profile = { label: data.label || 'معلم المنصة', subject_scope: SUBJECTS.has(data.subject_scope) ? data.subject_scope : 'all' }; cacheProfile(profile); applyScopeDom(); window.dispatchEvent(new CustomEvent('nafes:teacher-profile', { detail: profile })); return profile; } finally { clearTimeout(timeout); profilePromise = null; } })();
    return profilePromise;
  }

  function setQa(enabled) {
    memoryKey = ''; clearReadCache(); clearProfileCache(); resetProfile();
    try { localStorage.removeItem(STORAGE); sessionStorage.removeItem(SESSION_STORAGE); localStorage.removeItem(QA_STORAGE); if (enabled) sessionStorage.setItem(QA_STORAGE, '1'); else sessionStorage.removeItem(QA_STORAGE); } catch (_) {}
    document.getElementById('nafesTeacherLogin')?.remove(); if (enabled) ensureProfile('__qa__').catch(()=>{}); emit(!!enabled);
  }
  function setKey(value, remember = false) {
    memoryKey = String(value || '').trim(); clearReadCache(); clearProfileCache(); resetProfile();
    try {
      localStorage.removeItem(QA_STORAGE); sessionStorage.removeItem(QA_STORAGE);
      if (memoryKey) sessionStorage.setItem(SESSION_STORAGE, memoryKey); else sessionStorage.removeItem(SESSION_STORAGE);
      if (memoryKey && remember) localStorage.setItem(STORAGE, memoryKey); else localStorage.removeItem(STORAGE);
    } catch (_) {}
    document.getElementById('nafesTeacherLogin')?.remove(); if (memoryKey) ensureProfile(memoryKey).catch(() => {}); emit(!!memoryKey);
  }
  function clearKey() {
    memoryKey = ''; clearReadCache(); clearProfileCache(); resetProfile();
    try { sessionStorage.removeItem(SESSION_STORAGE); sessionStorage.removeItem(QA_STORAGE); localStorage.removeItem(STORAGE); localStorage.removeItem(QA_STORAGE); } catch (_) {}
    document.getElementById('nafesTeacherLogin')?.remove(); emit(false);
  }
  function requireKey(message = 'أدخل رقم دخول المعلم أو المفتاح الرئيسي لعرض الاختبارات والنتائج.') {
    const event = new CustomEvent('nafes:auth-required', { cancelable: true, detail: { message } }); if (!window.dispatchEvent(event) || document.getElementById('nafesTeacherLogin')) return;
    const layer = document.createElement('div'); layer.id = 'nafesTeacherLogin'; layer.dir = 'rtl'; layer.style.cssText = 'position:fixed;inset:0;z-index:5000;background:#102f3cbb;display:grid;place-items:center;padding:20px;font-family:Tahoma,Arial,sans-serif';
    layer.innerHTML = '<form role="dialog" aria-modal="true" aria-labelledby="nafesLoginTitle" style="width:min(480px,100%);background:white;color:#17324d;padding:28px;border-radius:20px;box-shadow:0 24px 70px #0004"><h2 id="nafesLoginTitle" style="font:700 1.3rem Arial,Tahoma,sans-serif;margin:0 0 12px">دخول المعلم</h2><p data-message style="font-size:1rem;line-height:1.8"></p><label style="display:grid;gap:8px;font-size:1rem">رقم دخول المعلم / المفتاح الرئيسي<input name="teacherKey" type="password" required autocomplete="off" spellcheck="false" dir="ltr" style="font:inherit;min-width:0;width:100%;border:1px solid #bacdce;border-radius:10px;padding:12px"></label><label style="display:flex;gap:8px;align-items:center;margin:12px 0;font-size:.92rem"><input name="remember" type="checkbox"> تذكرني على هذا الجهاز (لا تستخدمه على جهاز مشترك)</label><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="submit" style="font:inherit;background:#0f6b63;color:white;border:0;border-radius:10px;padding:10px 18px;cursor:pointer">دخول المعلم</button><button type="button" data-close style="font:inherit;background:#edf3f3;color:#17324d;border:0;border-radius:10px;padding:10px 18px;cursor:pointer">إغلاق</button></div><hr style="border:0;border-top:1px solid #d8e3e5;margin:20px 0 14px"><div style="background:#f5f9fc;border:1px solid #d6e5ee;border-radius:12px;padding:12px"><b style="display:block;margin-bottom:6px">وضع الاختبار التجريبي</b><p style="font-size:.84rem;line-height:1.7;color:#526776;margin:0 0 10px">للمعاينة وإنشاء الاختبارات فقط؛ لا يتيح بيانات الطلاب أو النتائج أو الحذف.</p><button type="button" data-qa style="font:inherit;background:#e8f4ff;color:#0b5a8f;border:1px solid #b8d8ef;border-radius:10px;padding:9px 14px;cursor:pointer;font-weight:700">دخول تجريبي آمن</button></div></form>';
    layer.querySelector('[data-message]').textContent = message; layer.querySelector('[data-close]').onclick = () => layer.remove(); layer.querySelector('[data-qa]').onclick = () => setQa(true);
    layer.addEventListener('keydown', e => { if (e.key === 'Escape') layer.remove(); if (e.key === 'Tab') { const items = [...layer.querySelectorAll('input,button')]; if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus(); } } });
    layer.querySelector('form').onsubmit = e => { e.preventDefault(); const form=e.currentTarget; setKey(form.elements.teacherKey.value, !!form.elements.remember.checked); };
    document.body.appendChild(layer); layer.querySelector('input[name="teacherKey"]').focus();
  }
  function cacheKey(action, body) { return `${action}|${JSON.stringify(body || {})}`; }
  async function request(action, body, key) {
    const qa = isQa(), endpoint = qa ? QA_ENDPOINT : ENDPOINT, controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
    let response, data;
    try { const headers = { 'Content-Type': 'application/json' }; if (!qa) headers['x-teacher-key'] = key; response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ ...body, action }), signal: controller.signal, cache: 'no-store' }); data = await response.json().catch(() => ({})); }
    catch (error) { throw new Error(error.name === 'AbortError' ? 'استغرق الاتصال أكثر من 30 ثانية. أعد المحاولة؛ لن تبقى الصفحة في حالة تحميل بلا نهاية.' : 'تعذر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.'); }
    finally { clearTimeout(timeout); }
    if (!response.ok || data.error) { if (response.status === 401 || response.status === 403) { if (qa) setQa(false); else clearKey(); requireKey(data.error || (qa ? 'تعذر تشغيل الدخول التجريبي الآمن.' : 'رقم أو مفتاح المعلم غير صالح. أدخل بيانات الدخول الصحيحة.')); } throw Object.assign(new Error(data.error || 'تعذر إتمام الطلب. أعد المحاولة.'), { status: response.status, code: response.status === 401 || response.status === 403 ? 'TEACHER_AUTH_REQUIRED' : 'API_ERROR' }); }
    return data;
  }
  async function api(action, body = {}) {
    const key = getKey(); if (!key) { requireKey(); throw Object.assign(new Error('يلزم دخول المعلم للمتابعة.'), { status: 401, code: 'TEACHER_AUTH_REQUIRED' }); }
    await ensureProfile(key); validateScopedAction(action, body);
    if (READ_ACTIONS.has(action)) { const ck = cacheKey(action, body), now = Date.now(), hit = readCache.get(ck); if (hit && hit.expires > now) return hit.promise; const promise = request(action, body, key).then(data => filterResponse(action, data)); readCache.set(ck, { expires: now + READ_CACHE_TTL, promise }); try { return await promise; } catch (error) { if (readCache.get(ck)?.promise === promise) readCache.delete(ck); throw error; } }
    const data = filterResponse(action, await request(action, body, key)); clearReadCache(); return data;
  }

  function subjectLabel(value) {
    return ({ reading:'القراءة', math:'الرياضيات', science:'العلوم', all:'جميع المواد' })[String(value||'all')] || 'جميع المواد';
  }
  function refreshAccountDom() {
    const signedIn = !!getKey();
    const cached=profile||readCachedProfile(); document.querySelectorAll('[data-teacher-label]').forEach(el => { el.textContent = signedIn ? (cached?.label || 'حساب المعلم') : 'غير مسجل الدخول'; });
    document.querySelectorAll('[data-teacher-scope-label]').forEach(el => { el.textContent = signedIn ? subjectLabel(cached?.subject_scope||scope()) : '—'; });
    document.querySelectorAll('[data-teacher-login]').forEach(el => { el.hidden = signedIn; });
    document.querySelectorAll('[data-teacher-logout]').forEach(el => { el.hidden = !signedIn; });
  }
  function logoutAndRedirect(target='teacher.html') {
    clearKey();
    refreshAccountDom();
    if (target) location.href = target;
  }
  document.addEventListener('click', e => {
    const logout = e.target.closest('[data-teacher-logout]');
    if (logout) { e.preventDefault(); logoutAndRedirect(logout.getAttribute('data-logout-target') || 'teacher.html'); return; }
    const login = e.target.closest('[data-teacher-login]');
    if (login) { e.preventDefault(); requireKey('أدخل رقم دخول المعلم أو المفتاح الرئيسي.'); }
  });
  window.addEventListener('nafes:teacher-profile', refreshAccountDom);
  window.addEventListener('nafes:auth-changed', refreshAccountDom);
  addEventListener('DOMContentLoaded', () => { refreshAccountDom(); if (getKey()) ensureProfile().then(refreshAccountDom).catch(()=>refreshAccountDom()); });

  window.NafesTeacher = { api, getKey, setKey, clearKey, requireKey, clearReadCache, isQa, setQa, getProfile: () => profile, getScope: () => scope(), ensureProfile, scopeAllows, logoutAndRedirect, subjectLabel };
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (fragment.has('key')) { const key = fragment.get('key'); fragment.delete('key'); history.replaceState(history.state, '', location.pathname + location.search + (fragment.toString() ? '#' + fragment.toString() : '')); setKey(key, false); }
  else if (getKey()) { ensureProfile().catch(() => {}); }
})();