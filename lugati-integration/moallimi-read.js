/* Read-only bridge from Lugati Interactive to Moallimi NAFES results. */
(() => {
  'use strict';

  if (window.LugatiMoallimi) return;

  const ENDPOINT = 'https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-moallimi-read';
  const LOCAL_KEY = 'nafes_teacher_key_v1';
  const SESSION_KEY = 'nafes_teacher_session_key_v1';

  function teacherKey() {
    try {
      return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(LOCAL_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  async function call(body = {}) {
    const key = teacherKey();
    if (!key) throw new Error('أدخل مفتاح المعلم أولًا.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-teacher-key': key,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) throw new Error(data?.error || 'تعذر قراءة نتائج معلّمي.');
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('استغرق الاتصال بمنصة معلّمي وقتًا أطول من المتوقع.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function grades({ studentId = '', subjectKey = '', limit = 500 } = {}) {
    const data = await call({
      action: 'grades',
      student_id: studentId || undefined,
      subject_key: subjectKey || undefined,
      limit,
    });
    return Array.isArray(data?.rows) ? data.rows : [];
  }

  async function attempt({ source, id } = {}) {
    if (!source || !id) throw new Error('يلزم تحديد مصدر المحاولة ومعرّفها.');
    const data = await call({ action: 'attempt', source, id });
    return data?.attempt || null;
  }

  window.LugatiMoallimi = Object.freeze({
    endpoint: ENDPOINT,
    teacherKey,
    grades,
    attempt,
  });
})();
