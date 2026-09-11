/* Route teacher_catalog on the simulation page to the paginated catalog endpoint. */
(() => {
  'use strict';
  if (!window.NafesTeacher || window.__simulationCatalogRouteInstalled) return;
  window.__simulationCatalogRouteInstalled = true;

  const CATALOG_ENDPOINT = 'https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-catalog';
  const originalApi = window.NafesTeacher.api.bind(window.NafesTeacher);

  window.NafesTeacher.api = async function(action, body = {}) {
    if (action !== 'teacher_catalog') return originalApi(action, body);

    const key = window.NafesTeacher.getKey?.() || '';
    if (!key) {
      window.NafesTeacher.requireKey?.();
      throw Object.assign(new Error('يلزم دخول المعلم للمتابعة.'), { status: 401, code: 'TEACHER_AUTH_REQUIRED' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    let response, data;
    try {
      response = await fetch(CATALOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-key': key },
        body: JSON.stringify({ ...body, action }),
        signal: controller.signal,
        cache: 'no-store'
      });
      data = await response.json().catch(() => ({}));
    } catch (error) {
      throw new Error(error?.name === 'AbortError' ? 'استغرق تحميل مؤشرات المحاكاة وقتًا طويلًا. أعد المحاولة.' : 'تعذر تحميل مؤشرات المحاكاة.');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok || data?.error) {
      if (response.status === 401 || response.status === 403) {
        window.NafesTeacher.clearKey?.();
        window.NafesTeacher.requireKey?.(data?.error || 'مفتاح المعلم غير صالح.');
      }
      throw Object.assign(new Error(data?.error || 'تعذر تحميل كتالوج المحاكاة.'), { status: response.status || 500 });
    }
    return data;
  };
})();
