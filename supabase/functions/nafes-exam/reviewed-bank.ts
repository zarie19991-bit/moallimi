/** Runtime checks preserve an item review; they do not perform semantic review. */
export const REVIEW_VERSION = 'question-review-v4';
const normalize = (value: unknown) => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
const levels = ['knowledge', 'application', 'reasoning'];
export type ReviewedRow = {
  id: string; indicator_text: string; measurement_focus: string;
  alignment_profile: string | null; alignment_verified: boolean;
  alignment_evidence: Record<string, any> | null;
  context_text: string | null; question_text: string; options: unknown;
  correct_index: number; explanation: string | null; difficulty: string;
  cognitive_level: string; question_no: number; model_no: number;
};

export function reviewedImage(row: ReviewedRow | Record<string, any>) {
  const value = row.alignment_evidence?.image;
  if (!value || typeof value !== 'object') return null;
  const url = String(value.url || '');
  const alt = String(value.alt || '').trim();
  if (!/^https:\/\/zarie19991-bit\.github\.io\/moallimi\/question-bank\/assets\/[a-f0-9]{64}\.png$/.test(url) || !alt) return null;
  return { url, alt };
}

export function itemContentKey(row: ReviewedRow) {
  // Candidate sets can contain the mathematical givens (for example, four
  // triples of side lengths). Reordering them does not create a new task.
  const candidates = Array.isArray(row.options) ? row.options.map(normalize).sort() : [];
  return JSON.stringify([normalize(row.context_text), normalize(row.question_text), reviewedImage(row)?.url || '', candidates]);
}

export function hasCurrentReview(row: ReviewedRow | Record<string, any>, expectedFocus = String(row.measurement_focus || '')) {
  const e = row.alignment_evidence;
  const options = Array.isArray(row.options) ? row.options.map(String) : [];
  return row.alignment_verified === true && e?.validator === REVIEW_VERSION &&
    row.alignment_profile === `${expectedFocus}:reviewed-v4` &&
    e.indicator_text === row.indicator_text && e.measurement_focus === expectedFocus &&
    e.source_task === row.question_text && e.source_context === (row.context_text || '') &&
    JSON.stringify(e.source_options) === JSON.stringify(options) &&
    e.source_answer === options[row.correct_index] && e.explanation === row.explanation &&
    typeof e.target_aspect === 'string' && !!e.target_aspect.trim() &&
    /^[a-f0-9]{64}$/.test(String(e.content_sha256 || '')) &&
    ['indicator_alignment', 'single_answer', 'distractors', 'independence', 'grade9_level'].every(k => e.checks?.[k] === true);
}

export function inspectReviewedBank(rows: ReviewedRow[], indicatorText: string, focus: string, subject: string) {
  const issues: string[] = [];
  const answerCounts = [0, 0, 0, 0];
  const levelCounts: Record<string, number> = { knowledge: 0, application: 0, reasoning: 0 };
  const keys = new Set<string>();
  const generic = /^(قُدمت الإجابة|أي قاعدة أو حقيقة أساسية تساعد مباشرة|في نشاط لتطبيق مهارة|أي عبارة علمية صحيحة في موضوع)/;
  const placeholders = /^(تفصيل لا علاقة له|نستخدم قاعدة لا ترتبط بمعطيات|نعتمد شكل الخيار دون فحص العلاقة)$/;
  if (rows.length !== 15) issues.push('count');
  for (const [index, row] of rows.entries()) {
    if (Number(row.question_no) !== index + 1) issues.push('positions');
    if (normalize(row.indicator_text) !== normalize(indicatorText)) issues.push('indicator_mismatch');
    if (row.measurement_focus !== focus) issues.push('measurement_focus_mismatch');
    if (!hasCurrentReview(row, focus)) issues.push('item_review_mismatch');
    if (!normalize(row.question_text) || generic.test(row.question_text)) issues.push('generic_task');
    if (!normalize(row.explanation)) issues.push('missing_explanation');
    const options = Array.isArray(row.options) ? row.options.map(normalize) : [];
    if (options.length !== 4 || new Set(options).size !== 4 || options.some(x => !x)) issues.push('options');
    if (options.some(x => placeholders.test(x))) issues.push('placeholder_option');
    if (subject === 'reading' && !normalize(row.context_text)) issues.push('missing_passage');
    if (/ـ/.test([row.question_text, row.context_text || '', ...options].join(' '))) issues.push('language_quality');
    if (!Number.isInteger(row.correct_index) || row.correct_index < 0 || row.correct_index > 3) issues.push('correct_index');
    else answerCounts[row.correct_index]++;
    if (!levels.includes(row.cognitive_level)) issues.push('cognitive_level');
    else levelCounts[row.cognitive_level]++;
    if (!['easy', 'medium', 'hard', 'very_hard'].includes(row.difficulty)) issues.push('difficulty');
    if (row.alignment_evidence?.image && !reviewedImage(row)) issues.push('image');
    if (row.alignment_evidence?.requires_image && !reviewedImage(row)) issues.push('missing_image');
    const key = itemContentKey(row);
    if (keys.has(key)) issues.push('duplicate_question');
    keys.add(key);
  }
  if (rows.length === 15 && Math.max(...answerCounts) - Math.min(...answerCounts) > 1) issues.push('answer_distribution');
  // A fixed 3/7/5 quota mislabeled narrow indicator tasks. Keep the actual
  // reviewed levels and report their distribution without rewriting questions.
  return { ready: issues.length === 0, issues: [...new Set(issues)], approved_count: rows.length,
    required_count: 15, answer_distribution: answerCounts,
    cognitive_levels: levels.filter(x => levelCounts[x] > 0), cognitive_distribution: levelCounts,
    review_version: REVIEW_VERSION };
}

export function publicReviewedQuestions(items: Record<string, any>[]) {
  return items.map(q => ({ id: q.id, context: q.context || null, question: q.question,
    options: q.options, ...(q.image ? { image: q.image } : {}) }));
}
