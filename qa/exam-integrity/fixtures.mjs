import { randomUUID } from 'node:crypto';
import { normalizeArabicName } from '../../supabase/functions/nafes-exam/assessment-engine.ts';
import { handleAssessments } from '../../supabase/functions/nafes-exam/assessments.ts';
import { makeDb } from './fake-db.mjs';

export const CODE = 'ABCD2345';
export const STUDENTS = {
  ali:  { id: randomUUID(), full_name: 'علي بن سعد الحربي', national_id_last3: '123', class_name: 'أ' },
  omar: { id: randomUUID(), full_name: 'عمر بن خالد الزهراني', national_id_last3: '456', class_name: 'أ' }
};

export function question(n) {
  return { id: `q${n}`, subject: 'math', outcome: 'o1', indicator: 1, indicator_key: 'math:o1:i1', indicator_text: 'مؤشر',
    question: `س${n}`, options: ['أ', 'ب', 'ج', 'د'], correctIndex: n % 4, cognitive_level: 'knowledge', difficulty: 'medium' };
}

export function build({ sections = 1, lock_session = true, attempts = 3 } = {}) {
  const secs = Array.from({ length: sections }, (_, s) => ({
    subject: 'math', duration_minutes: 30, question_count: 4, calculator: false,
    questions: [1, 2, 3, 4].map(n => question(s * 10 + n)), indicators: []
  }));
  const settings = { attempts, lock_session, break_minutes: 0, allow_back: true, one_per_page: false, shuffle_questions: false,
    shuffle_options: false, show_result: true, show_correct_count: false, show_indicator_result: false, show_answers: false,
    log_visibility: false, allow_copy: true, watermark: false, disable_print: false, disable_right_click: false, disable_shortcuts: false };
  const config = { kind: 'indicator', identity_mode: 'national', class_name: 'أ', school_name: 'م', teacher_name: 'ت', settings,
    sections: secs.map(s => ({ subject: s.subject, question_count: s.question_count, duration_minutes: s.duration_minutes, calculator: false })) };
  const db = makeDb({
    nafes_assessments: [{ id: randomUUID(), short_code: CODE, status: 'published', kind: 'indicator', title: 'اختبار', config, rendered_sections: secs }],
    nafes_students: Object.values(STUDENTS).map(s => ({ ...s, name_normalized: normalizeArabicName(s.full_name), is_active: true, is_demo: false }))
  });
  const call = async (body) => {
    try { return { ok: true, data: await handleAssessments(db, new Request('https://x.test'), { code: CODE, ...body }) }; }
    catch (e) { return { ok: false, status: e.status || 500, error: e.message }; }
  };
  const start = (who, session) => call({ action: 'assessment_start', session_id: session,
    student_name: who.full_name, student_no: who.national_id_last3, class_name: who.class_name });
  return { db, call, start };
}
