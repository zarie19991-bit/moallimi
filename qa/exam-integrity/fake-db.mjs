// Minimal in-memory stand-in for the supabase-js query builder.
// It supports only what supabase/functions/nafes-exam/assessments.ts uses on the
// student start / save / resume path, so the REAL server code can run unchanged.
import { randomUUID } from 'node:crypto';

const DEFAULTS = {
  nafes_assessment_attempts: () => ({
    answers: {}, events: [], cursor: 0, section_index: 0,
    section_started_at: new Date().toISOString(), version: 1,
    started_at: new Date().toISOString(), submitted_at: null,
    score: null, total: null, percent: null, section_scores: null
  })
};

export function makeDb(seed = {}) {
  const tables = { ...seed };
  const log = [];
  const rowsOf = name => (tables[name] ??= []);

  function builder(name) {
    const rows = rowsOf(name);
    let op = 'select', payload = null, filters = [], order = null, mode = 'many', returning = false;
    const q = {
      select() { if (op !== 'select') returning = true; return q; },
      eq(k, v) { filters.push(r => r[k] === v); return q; },
      neq(k, v) { filters.push(r => r[k] !== v); return q; },
      is(k, v) { filters.push(r => (v === null ? r[k] == null : r[k] === v)); return q; },
      in(k, vs) { filters.push(r => vs.includes(r[k])); return q; },
      order(k, o = {}) { order = [k, o.ascending !== false]; return q; },
      update(p) { op = 'update'; payload = p; return q; },
      insert(p) { op = 'insert'; payload = p; return q; },
      upsert(p) { op = 'upsert'; payload = p; return q; },
      maybeSingle() { mode = 'maybe'; return q; },
      single() { mode = 'one'; return q; },
      then(resolve, reject) { return Promise.resolve().then(exec).then(resolve, reject); }
    };
    function exec() {
      log.push({ table: name, op });
      if (op === 'insert' || op === 'upsert') {
        const list = Array.isArray(payload) ? payload : [payload];
        const made = list.map(p => {
          const row = { id: randomUUID(), ...(DEFAULTS[name]?.() || {}), ...structuredClone(p) };
          if (name === 'nafes_assessment_attempts') {
            const clash = rows.find(r => !r.submitted_at && r.assessment_id === row.assessment_id && r.student_key === row.student_key);
            if (clash) return { error: { code: '23505' } };
          }
          rows.push(row); return row;
        });
        const bad = made.find(m => m.error);
        if (bad) return { data: null, error: bad.error };
        const out = made.map(x => structuredClone(x));
        return { data: mode === 'many' && !returning ? null : (mode === 'many' ? out : out[0]), error: null };
      }
      let hit = rows.filter(r => filters.every(f => f(r)));
      if (order) hit = [...hit].sort((a, b) => (a[order[0]] > b[order[0]] ? 1 : -1) * (order[1] ? 1 : -1));
      if (op === 'update') {
        for (const r of hit) Object.assign(r, structuredClone(payload));
        const out = hit.map(x => structuredClone(x));
        if (!returning) return { data: null, error: null };
        return { data: mode === 'many' ? out : (out[0] ?? null), error: null };
      }
      const out = hit.map(x => structuredClone(x));
      return { data: mode === 'many' ? out : (out[0] ?? null), error: null };
    }
    return q;
  }
  return { tables, log, from: builder, rpc: async () => ({ data: null, error: null }) };
}
