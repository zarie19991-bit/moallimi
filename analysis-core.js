/* Pure analytics: no network, storage, DOM, or fabricated records. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NafesAnalytics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const THRESHOLDS = Object.freeze({ mastered: 80, near: 65, support: 50 });
  const LEVELS = Object.freeze([
    { key: 'mastered', label: 'متقن', min: 80 },
    { key: 'near', label: 'قريب من الإتقان', min: 65 },
    { key: 'support', label: 'بحاجة إلى دعم', min: 50 },
    { key: 'nonmastered', label: 'غير متقن', min: 0 }
  ]);
  const UNKNOWN_CLASS = '__unknown_class__';
  const num = value => value === null || value === '' || value === undefined || typeof value === 'boolean' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  const canonicalDigits = value => clean(value).replace(/[٠-٩۰-۹]/g, c => String('٠١٢٣٤٥٦٧٨٩'.includes(c) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(c) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  const dateValue = value => Number.isFinite(Date.parse(value || '')) ? Date.parse(value) : 0;
  const attemptRef = a => `${a.source || 'assessment'}:${a.id}`;
  const timeOf = a => dateValue(a.submitted_at || a.started_at);
  const compareTime = (a, b) => timeOf(a) - timeOf(b) || attemptRef(a).localeCompare(attemptRef(b));
  function isSubmitted(a) {
    if (a.status === 'in_progress' || a.status === 'expired') return false;
    return !!a.submitted_at || ['submitted', 'completed', 'finished'].includes(a.status);
  }
  const isAnalyzable = a => isSubmitted(a) && !clean(a.snapshot_warning);
  function studentIdentity(a) {
    if (clean(a.student_key)) return `key:${clean(a.student_key)}`;
    if (clean(a.student_no)) return `number:${canonicalDigits(a.school_name)}:${canonicalDigits(a.student_no).toLocaleLowerCase()}`;
    // A name alone cannot establish that two attempts belong to the same person.
    return `unlinked:${attemptRef(a)}`;
  }
  function normalizeAttempt(raw) {
    const a = { ...raw };
    a.id = String(raw.id ?? '');
    a.source = raw.source || 'assessment';
    a.questions = Array.isArray(raw.questions) ? raw.questions.map(q => ({ ...q })) : [];
    a.events = Array.isArray(raw.events) ? raw.events : [];
    a.subjects = [...new Set([...(Array.isArray(raw.subjects) ? raw.subjects : []), ...a.questions.map(q => q.subject)].filter(Boolean))];
    a.kind = ['indicator', 'multi_indicator', 'simulation'].includes(raw.kind) ? raw.kind : (raw.source === 'simulation' ? 'simulation' : raw.source === 'exam' ? 'indicator' : 'multi_indicator');
    a.test_id = String(raw.test_id || `unknown-test:${a.source}:${a.id}`);
    a.student_name = clean(raw.student_name) || 'اسم غير مسجل';
    a.class_name = clean(raw.class_name);
    a.studentIdentity = studentIdentity(a);
    a.identityUncertain = !clean(raw.student_key) && !clean(raw.student_no);
    return a;
  }
  function savedPercent(a) {
    if (!isSubmitted(a)) return null;
    const p = num(a.percent);
    if (p !== null && p >= 0 && p <= 100) return p;
    const score = num(a.score), total = num(a.total);
    return total > 0 && score !== null && score >= 0 && score <= total ? score / total * 100 : null;
  }
  function isScorable(q) {
    if (q.scorable === false || num(q.correct_index ?? q.correctIndex) === -1) return false;
    return typeof q.correct === 'boolean' && (q.scorable === true || num(q.correct_index ?? q.correctIndex) >= 0 && num(q.correct_index ?? q.correctIndex) !== null);
  }
  function indicatorKey(q) {
    const key = clean(q.indicator_key);
    // Missing or contradictory metadata is unknown, never a guessed skill.
    return key && q.subject && key.startsWith(`${q.subject}:`) ? key : null;
  }
  function matchesQuestion(q, filters = {}) {
    return (!filters.subject || q.subject === filters.subject) && (!filters.indicator || indicatorKey(q) === filters.indicator);
  }
  function measure(a, filters = {}) {
    const questions = a.questions.filter(q => matchesQuestion(q, filters));
    const valid = isAnalyzable(a) ? questions.filter(isScorable) : [];
    const correct = valid.filter(q => q.correct).length;
    return { correct, total: valid.length, percent: valid.length ? correct / valid.length * 100 : null, excluded: questions.length - valid.length, unknownIndicators: valid.filter(q => !indicatorKey(q)).length };
  }
  function levelFor(percent) {
    const p = num(percent);
    return p === null ? { key: 'unmeasured', label: 'غير مقاس', min: null } : LEVELS.find(l => p >= l.min) || LEVELS[3];
  }
  function mean(values) {
    const usable = values.filter(v => v !== null && Number.isFinite(v));
    return usable.length ? usable.reduce((sum, v) => sum + v, 0) / usable.length : null;
  }
  function skillMeasurements(a, filters = {}) {
    const groups = new Map();
    if (!isAnalyzable(a)) return groups;
    for (const q of a.questions) {
      const key = indicatorKey(q);
      if (!key || !isScorable(q) || !matchesQuestion(q, filters)) continue;
      if (!groups.has(key)) groups.set(key, { key, subject: q.subject, text: clean(q.indicator_text) || key, correct: 0, total: 0, attempt: a, at: a.submitted_at || a.started_at });
      const g = groups.get(key); g.total++; if (q.correct) g.correct++;
    }
    for (const g of groups.values()) g.percent = g.correct / g.total * 100;
    return groups;
  }
  function observations(attempts, filters = {}) {
    const all = new Map();
    for (const a of attempts.filter(isSubmitted).slice().sort(compareTime)) {
      for (const [key, entry] of skillMeasurements(a, filters)) {
        if (!all.has(key)) all.set(key, []);
        all.get(key).push(entry);
      }
    }
    return all;
  }
  function comparison(current, previous, filters = {}) {
    if (!current || !previous || !isSubmitted(current) || !isSubmitted(previous)) return null;
    const a = skillMeasurements(current, filters), b = skillMeasurements(previous, filters);
    const keys = [...a.keys()].filter(key => b.has(key) && a.get(key).subject === b.get(key).subject);
    if (!keys.length) return null;
    // Equal skill weights prevent differing question distributions changing the comparison.
    const currentPercent = mean(keys.map(key => a.get(key).percent));
    const previousPercent = mean(keys.map(key => b.get(key).percent));
    const delta = currentPercent - previousPercent;
    return { keys, subjects: [...new Set(keys.map(key => a.get(key).subject))], currentPercent, previousPercent, delta, direction: Math.abs(delta) < 1e-8 ? 'stable' : delta > 0 ? 'up' : 'down', current, previous };
  }
  function latestComparison(attempts, filters = {}) {
    const ordered = attempts.filter(a => isSubmitted(a) && measure(a, filters).total).slice().sort(compareTime).reverse();
    const current = ordered[0];
    if (!current) return null;
    for (const prior of ordered.slice(1)) {
      const result = comparison(current, prior, filters);
      if (result) return result;
    }
    return null;
  }
  function followupFor(entries) {
    const history = entries.slice().sort((a, b) => compareTime(a.attempt, b.attempt));
    if (!history.length) return { state: 'unmeasured', streak: 0, history: [], latest: null };
    let streak = 0, hadRepeated = false;
    for (const entry of history) {
      if (entry.percent < THRESHOLDS.near) { streak++; if (streak >= 2) hadRepeated = true; }
      else streak = 0;
    }
    const latest = history[history.length - 1];
    return { state: streak >= 2 ? 'repeated' : streak === 1 ? 'first_low' : hadRepeated ? 'resolved' : 'clear', streak, history, latest };
  }
  function latestByStudentTest(attempts) {
    const map = new Map();
    for (const a of attempts.filter(isSubmitted)) {
      const key = `${a.studentIdentity || studentIdentity(a)}\u0000${a.test_id}`;
      if (!map.has(key) || compareTime(a, map.get(key)) > 0) map.set(key, a);
    }
    return [...map.values()];
  }
  function matchesContext(a, filters = {}) {
    if (filters.subject && !a.subjects.includes(filters.subject)) return false;
    if (filters.test && a.test_id !== filters.test) return false;
    if (filters.className === UNKNOWN_CLASS ? !!a.class_name : filters.className && a.class_name !== filters.className) return false;
    if (filters.indicator && !a.questions.some(q => indicatorKey(q) === filters.indicator)) return false;
    const search = canonicalDigits(filters.search).toLocaleLowerCase();
    return !search || canonicalDigits(`${a.student_name} ${a.student_no || ''}`).toLocaleLowerCase().includes(search);
  }
  function studentRows(attempts, filters = {}) {
    const map = new Map();
    for (const a of attempts.filter(a => matchesContext(a, filters))) {
      const identity = a.studentIdentity || studentIdentity(a);
      if (!map.has(identity)) map.set(identity, []);
      map.get(identity).push(a);
    }
    const rows = [];
    for (const [key, history] of map) {
      history.sort(compareTime);
      const submitted = history.filter(isSubmitted), latest = submitted[submitted.length - 1] || null;
      const recent = history[history.length - 1];
      const reliable = submitted.filter(a => measure(a, filters).total), measuredAttempt = reliable[reliable.length - 1] || null;
      const measured = measuredAttempt ? measure(measuredAttempt, filters) : { correct: 0, total: 0, percent: null, excluded: latest ? measure(latest, filters).excluded : 0, unknownIndicators: 0 };
      const previousHistory = attempts.filter(a => (a.studentIdentity || studentIdentity(a)) === key && matchesContext(a, {...filters,test:''}) && latest && compareTime(a,latest)<0);
      let trend = null;
      if (latest) for (const prior of previousHistory.sort(compareTime).reverse()) { trend=comparison(latest,prior,filters); if(trend)break; }
      const skills = [...observations(history, filters)].map(([indicator, entries]) => ({ key: indicator, ...followupFor(entries) }));
      const repeated = skills.filter(s => s.state === 'repeated'), resolved = skills.filter(s => s.state === 'resolved');
      const row = { key, student: recent, history, latest, measuredAttempt, measured, level: levelFor(measured.percent), trend, skills, repeated, resolved };
      if (filters.level && row.level.key !== filters.level) continue;
      if (filters.trend && (trend?.direction || 'unavailable') !== filters.trend) continue;
      if (filters.followup === 'repeated' && !repeated.length || filters.followup === 'resolved' && !resolved.length || filters.followup === 'clear' && repeated.length) continue;
      rows.push(row);
    }
    return rows.sort((a, b) => a.student.student_name.localeCompare(b.student.student_name, 'ar'));
  }
  function indicatorSummary(attempts, catalog = [], filters = {}) {
    const groups = new Map();
    for (const indicator of catalog) {
      const key = indicator.key || indicator.indicator_key;
      if (!key || filters.subject && indicator.subject !== filters.subject || filters.indicator && key !== filters.indicator) continue;
      groups.set(key, { key, subject: indicator.subject, text: indicator.text || indicator.indicator_text || key, students: new Map() });
    }
    for (const a of attempts.filter(isSubmitted).slice().sort(compareTime)) {
      for (const [key, entry] of skillMeasurements(a, filters)) {
        if (!groups.has(key)) groups.set(key, { key, subject: entry.subject, text: entry.text, students: new Map() });
        groups.get(key).students.set(a.studentIdentity || studentIdentity(a), entry);
      }
    }
    return [...groups.values()].map(g => {
      const values = [...g.students.values()];
      const mastered = values.filter(v => v.percent >= THRESHOLDS.mastered).length;
      return { key: g.key, subject: g.subject, text: g.text, measuredStudents: values.length, percent: mean(values.map(v => v.percent)), mastered, masteryRate: values.length ? mastered / values.length * 100 : null, correct: values.reduce((sum, v) => sum + v.correct, 0), total: values.reduce((sum, v) => sum + v.total, 0) };
    }).sort((a, b) => (a.percent === null) - (b.percent === null) || (a.percent ?? 0) - (b.percent ?? 0) || a.text.localeCompare(b.text, 'ar'));
  }
  function questionFingerprint(q) {
    // The summary API provides the saved stem, not the mutable bank or its ID.
    if (q.question_fingerprint) return q.question_fingerprint;
    const stem = clean(q.question);
    return JSON.stringify([q.subject || '', indicatorKey(q) || '', stem || `unknown:${q.id || ''}`]);
  }
  function questionSummary(attempts, filters = {}) {
    const groups = new Map();
    for (const a of latestByStudentTest(attempts).sort(compareTime)) {
      for (const q of a.questions.filter(q => matchesQuestion(q, filters))) {
        const fingerprint = questionFingerprint(q);
        if (!groups.has(fingerprint)) groups.set(fingerprint, { fingerprint, question: q.question || 'نص غير متاح', subject: q.subject, indicator_key: indicatorKey(q), indicator_text: q.indicator_text || 'مؤشر غير معروف', students: new Map(), example: a, questionId: String(q.id) });
        const group = groups.get(fingerprint);
        group.students.set(a.studentIdentity || studentIdentity(a), { q, a });
      }
    }
    return [...groups.values()].map(g => {
      const rows = [...g.students.values()], valid = rows.filter(v => isAnalyzable(v.a) && isScorable(v.q));
      const wrong = valid.filter(v => !v.q.correct).length, missing = valid.filter(v => v.q.answer === null || v.q.answer === undefined).length;
      return { ...g, students: undefined, measured: valid.length, wrong, missing, excluded: rows.length - valid.length, failureRate: valid.length ? wrong / valid.length * 100 : null };
    }).sort((a, b) => (b.failureRate ?? -1) - (a.failureRate ?? -1) || b.measured - a.measured);
  }
  function report(attempts, catalog = [], filters = {}) {
    const rows = studentRows(attempts, filters), identities = new Set(rows.map(r => r.key));
    const scoped = attempts.filter(a => matchesContext(a, filters) && identities.has(a.studentIdentity || studentIdentity(a)));
    const measuredRows = rows.filter(r => r.measured.percent !== null), submitted = rows.filter(r => r.latest);
    const percentages = measuredRows.map(r => r.measured.percent), avg = mean(percentages);
    const high = percentages.length ? Math.max(...percentages) : null, low = percentages.length ? Math.min(...percentages) : null;
    const indicators = indicatorSummary(scoped, catalog, filters), questions = questionSummary(scoped, filters);
    return { rows, attempts: scoped, indicators, questions, summary: {
      participants: rows.length, submitted: submitted.length, measured: measuredRows.length, average: avg, highest: high, lowest: low,
      highestStudents: high === null ? [] : measuredRows.filter(r => Math.abs(r.measured.percent - high) < 1e-8).map(r => r.student.student_name),
      lowestStudents: low === null ? [] : measuredRows.filter(r => Math.abs(r.measured.percent - low) < 1e-8).map(r => r.student.student_name),
      averageSaved: mean(submitted.filter(r => isAnalyzable(r.latest)).map(r => savedPercent(r.latest))),
      active: scoped.filter(a => a.status === 'in_progress').length, expired: scoped.filter(a => a.status === 'expired').length,
      attempts: scoped.length, excludedQuestions: scoped.filter(isSubmitted).reduce((sum, a) => sum + measure(a, filters).excluded, 0),
      uncertainIdentities: rows.filter(r => r.student.identityUncertain).length,
      repeatedStudents: rows.filter(r => r.repeated.length).length,
      levels: [...LEVELS, { key: 'unmeasured', label: 'غير مقاس' }].map(l => ({ ...l, count: rows.filter(r => r.level.key === l.key).length }))
    } };
  }
  return Object.freeze({ THRESHOLDS, LEVELS, UNKNOWN_CLASS, num, clean, canonicalDigits, dateValue, attemptRef, timeOf, compareTime, isSubmitted, isAnalyzable, studentIdentity, normalizeAttempt, savedPercent, isScorable, indicatorKey, matchesQuestion, measure, levelFor, mean, skillMeasurements, observations, comparison, latestComparison, followupFor, latestByStudentTest, matchesContext, studentRows, indicatorSummary, questionFingerprint, questionSummary, report });
});
