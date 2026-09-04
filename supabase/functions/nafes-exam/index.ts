import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const MODEL_COUNT = 4;
const QUESTION_COUNT = 15;
const GRADE_KEY = "middle_3";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const norm = (s: string) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const hashKey = async (s: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(bytes))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
};

type BankRow = {
  id: string;
  indicator_text: string;
  measurement_focus: string;
  alignment_profile: string | null;
  alignment_verified: boolean;
  alignment_evidence: Record<string, unknown> | null;
  context_text: string | null;
  question_text: string;
  options: unknown;
  correct_index: number;
  explanation: string | null;
  difficulty: string;
  cognitive_level: string;
  question_no: number;
  model_no: number;
};

function publicQuestions(items: Record<string, unknown>[]) {
  return items.map((q) => ({
    id: q.id,
    context: q.context || null,
    question: q.question,
    options: q.options,
  }));
}

function examContentKey(items: Record<string, unknown>[]) {
  return JSON.stringify((items || []).map((q) => ({
    id: String(q.id || ""),
    context: String(q.context || ""),
    question: String(q.question || ""),
    options: Array.isArray(q.options) ? q.options.map(String) : [],
    correctIndex: Number(q.correctIndex),
    explanation: String(q.explanation || ""),
    difficulty: String(q.difficulty || ""),
    cognitive_level: String(q.cognitive_level || ""),
  })));
}

function grade(rendered: Record<string, unknown>[], answers: Record<string, unknown>) {
  let score = 0;
  for (const q of rendered || []) {
    if (Number(answers?.[String(q.id)]) === Number(q.correctIndex)) score++;
  }
  const total = (rendered || []).length;
  const percent = total ? Math.round(score * 10000 / total) / 100 : 0;
  return { score, total, percent };
}

async function settings(subject: string, outcome: string, indicator: number, model: number) {
  const { data, error } = await db
    .from("nafes_exam_settings")
    .select("*")
    .eq("subject_key", subject)
    .eq("outcome_code", outcome)
    .eq("indicator_index", indicator)
    .eq("model_no", model)
    .maybeSingle();
  if (error) throw error;
  return data || {
    subject_key: subject,
    outcome_code: outcome,
    indicator_index: indicator,
    model_no: model,
    duration_minutes: 20,
    question_count: QUESTION_COUNT,
    is_open: true,
    opens_at: null,
    closes_at: null,
    show_answers: "immediately",
  };
}

async function loadIndicatorBank(subject: string, outcome: string, indicator: number) {
  const { data, error } = await db
    .from("nafes_question_bank")
    .select("id,indicator_text,measurement_focus,alignment_profile,alignment_verified,alignment_evidence,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level,question_no,model_no")
    .eq("grade_key", GRADE_KEY)
    .eq("subject_key", subject)
    .eq("outcome_code", outcome)
    .eq("indicator_index", indicator)
    .eq("review_status", "approved")
    .eq("is_active", true)
    .not("model_no", "is", null)
    .order("model_no", { ascending: true })
    .order("question_no", { ascending: true });
  if (error) throw error;
  return (data || []) as BankRow[];
}

function inspectBank(rows: BankRow[], expectedIndicatorText: string, expectedFocus: string, subject: string) {
  const issues: string[] = [];
  if (rows.length !== QUESTION_COUNT) issues.push("count");

  const positions = rows.map((q) => Number(q.question_no));
  const expectedPositions = Array.from({ length: QUESTION_COUNT }, (_, i) => i + 1);
  if (positions.length !== QUESTION_COUNT || positions.some((x, i) => x !== expectedPositions[i])) {
    issues.push("positions");
  }

  const questionKeys = new Set<string>();
  const questionStems = new Set<string>();
  const levels = new Set<string>();
  const levelCounts: Record<string, number> = { knowledge: 0, application: 0, reasoning: 0 };
  const answerCounts = [0, 0, 0, 0];
  const bannedPlaceholder = /^(المعنى المضاد لها|تفصيل لا علاقة له|اسم مكان ورد في النص|معنى حرفي لا يناسب السياق|تكرار عنوان النص|نستخدم قاعدة لا ترتبط بمعطيات|نعتمد شكل الخيار دون فحص العلاقة|لا نحتاج إلى مفهوم أو قاعدة قبل الإجابة|الإجابة صحيحة؛ ولا حاجة إلى التحقق|لا يمكن الحكم على الحل مع أن معطيات السؤال مكتملة|لا يمكن الحكم على الإجابة مع اكتمال معطيات السؤال)/;
  const bannedStem = /^(أي قاعدة أو حقيقة أساسية تساعد مباشرة|في نشاط لتطبيق مهارة|اقترح طالب الإجابة)/;
  const bannedExplanation = /ترتبط بالمفهوم المحدد|تتفق مع المفهوم|الوارد في المؤشر|تثبت المعرفة العلمية أن تنص/;
  const genderMismatch = /(سأل|راجع|طبّق|اختار|استخدم|حلّل|ناقش|درس|بحث|فحص|قارن|وظّف|نقل|ربط|قوّم) (نورة|هيا|ريم|سارة|ليان|جود)/;
  const redundantStem = /أي إجابة علمية صحيحة عن السؤال الآتي: أي|ما الإجابة التي تتفق.+؟ أي|أي اختيار يعبّر.+؟ أي|الموقف المرتبط بمفهوم/;
  const typographyError = /%|\s+،|-?\d+,\s*-?\d+|\d+\.\d{3,}|(^|[ «:])(حلل|بسط)([ :])|مهارة «(?:على|بين)\s/;
  const implausibleScienceOption = /توقف الزمن|تغير عدد الكواكب|تختفي الذرات|محرار زئبقي|يمنع انقسام الخلايا|يقيس كتلة الخلية مباشرة|كائن أكبر فعليًا/;

  for (const q of rows) {
    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    const key = `${q.context_text || ""}\u001f${q.question_text}`;
    if (questionKeys.has(key)) issues.push("duplicate_question");
    questionKeys.add(key);
    if (questionStems.has(q.question_text)) issues.push("duplicate_stem");
    questionStems.add(q.question_text);
    if (options.length !== 4 || new Set(options).size !== 4) issues.push("options");
    if (options.some((x) => bannedPlaceholder.test(x))) issues.push("placeholder_option");
    if (bannedStem.test(q.question_text)) issues.push("generic_task");
    if (bannedExplanation.test(q.explanation || "")) issues.push("generic_explanation");
    const displayText = [q.context_text || "", q.question_text, q.explanation || "", ...options].join("\n");
    if (genderMismatch.test(q.question_text) || redundantStem.test(q.question_text) || typographyError.test(displayText)) {
      issues.push("language_quality");
    }
    if (subject === "science" && implausibleScienceOption.test(displayText)) issues.push("implausible_distractor");
    if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) {
      issues.push("correct_index");
    } else {
      answerCounts[q.correct_index]++;
    }
    levels.add(q.cognitive_level);
    if (q.cognitive_level in levelCounts) levelCounts[q.cognitive_level]++;
    const expectedDifficulty = q.cognitive_level === "knowledge" ? "easy" : q.cognitive_level === "application" ? "medium" : q.cognitive_level === "reasoning" ? "hard" : "";
    if (!expectedDifficulty || q.difficulty !== expectedDifficulty) issues.push("difficulty_level");
    if (subject !== "reading") {
      const expectedLevel = q.question_no <= 3 ? "knowledge" : q.question_no <= 10 ? "application" : "reasoning";
      if (q.cognitive_level !== expectedLevel) issues.push("level_position");
      if (expectedLevel === "application" && !/(تقرير|تجربة|ملاحظة|نتائج|نتيجة|قرار|موقف|بيانات|قياس|نموذج|خطة|مشروع|نشاط|تصميم|عينة|مخطط|درجات|وعاء|لعبة|نمط|ارتفاع|متجر|معدل الإنجاز|كمية مطلوبة|تفسيرات|تفسير|مراجعة|رُوجعت|تطبيق|فريق|طبّق|استخدم|راجع|تحقق|قارن|حوّل|اختار)/.test(q.question_text)) issues.push("application_task");
      if (expectedLevel === "reasoning" && !/(تحليل|تبرير|تعليل|تفسير|تصحيح|يصحح|مدعومة|المعطيات)/.test(q.question_text)) issues.push("reasoning_task");
      if (expectedLevel === "reasoning" && (q.question_text.includes("اختار طالب") || options.some((x) => x.includes("إجابة الطالب")))) issues.push("meta_reasoning_wrapper");
      if (expectedLevel === "reasoning" && options.some((x) => !/(التبرير|لأن|بسبب)/.test(x))) issues.push("reasoning_without_justification");
      if (/لأن يمكن|يتصل بـ«[^»]+»، في موقف علمي يتصل/.test(displayText)) issues.push("rhetorical_quality");
    }
    if (norm(q.indicator_text) !== norm(expectedIndicatorText)) {
      issues.push("indicator_mismatch");
    }
    if (q.measurement_focus !== expectedFocus) issues.push("measurement_focus_mismatch");
    if (subject !== "reading") {
      if (q.alignment_verified !== true) issues.push("semantic_alignment_unverified");
      if (!String(q.alignment_profile || "").startsWith(`${expectedFocus}:`)) issues.push("semantic_alignment_profile");
      if (String(q.alignment_evidence?.validator || "") !== "semantic-contract-v2") issues.push("semantic_alignment_validator");
      if (!String(q.alignment_evidence?.source_task || "").trim() || !String(q.alignment_evidence?.source_answer || "").trim()) {
        issues.push("semantic_alignment_evidence");
      }
    }
  }

  if (rows.length === QUESTION_COUNT && Math.max(...answerCounts) - Math.min(...answerCounts) > 1) {
    issues.push("answer_distribution");
  }
  if (!["knowledge", "application", "reasoning"].every((level) => levels.has(level))) {
    issues.push("cognitive_levels");
  }
  const expectedLevelCounts = { knowledge: 3, application: 7, reasoning: 5 };
  if (Object.entries(expectedLevelCounts).some(([level, count]) => levelCounts[level] !== count)) {
    issues.push("cognitive_distribution");
  }

  return {
    ready: issues.length === 0,
    issues: [...new Set(issues)],
    approved_count: rows.length,
    required_count: QUESTION_COUNT,
    answer_distribution: answerCounts,
    cognitive_levels: [...levels],
    cognitive_distribution: levelCounts,
  };
}

function inspectIndicatorBank(rows: BankRow[], expectedIndicatorText: string, expectedFocus: string, subject: string) {
  const issues: string[] = [];
  if (rows.length !== MODEL_COUNT * QUESTION_COUNT) issues.push("indicator_count");
  const contentKeys = new Set<string>();
  for (let model = 1; model <= MODEL_COUNT; model++) {
    const modelRows = rows.filter((q) => Number(q.model_no) === model);
    const audit = inspectBank(modelRows, expectedIndicatorText, expectedFocus, subject);
    if (!audit.ready) issues.push(...audit.issues.map((issue) => `model_${model}_${issue}`));
    for (const q of modelRows) {
      const key = subject === "reading"
        ? `${q.context_text || ""}\u001f${q.question_text}`
        : q.question_text;
      if (contentKeys.has(key)) issues.push("duplicate_across_models");
      contentKeys.add(key);
    }
  }
  if (contentKeys.size !== MODEL_COUNT * QUESTION_COUNT) issues.push("distinct_question_count");
  return {
    ready: issues.length === 0,
    issues: [...new Set(issues)],
    approved_count: rows.length,
    required_count: MODEL_COUNT * QUESTION_COUNT,
    distinct_questions: contentKeys.size,
  };
}

function renderBank(rows: BankRow[]) {
  return rows.map((q) => ({
    id: q.id,
    context: q.context_text || null,
    question: q.question_text,
    options: q.options,
    correctIndex: q.correct_index,
    explanation: q.explanation || null,
    difficulty: q.difficulty,
    cognitive_level: q.cognitive_level,
  }));
}

function checkWindow(s: Record<string, unknown>) {
  const now = Date.now();
  if (!s.is_open) return "هذا الاختبار مغلق.";
  if (s.opens_at && now < new Date(String(s.opens_at)).getTime()) return "لم يبدأ وقت الاختبار بعد.";
  if (s.closes_at && now > new Date(String(s.closes_at)).getTime()) return "انتهى وقت الاختبار.";
  return null;
}

function buildReview(
  rendered: Record<string, unknown>[],
  s: Record<string, unknown>,
) {
  const afterClose = !!s.closes_at &&
    Date.now() > new Date(String(s.closes_at)).getTime();
  const show = s.show_answers === "immediately" ||
    (s.show_answers === "after_close" && afterClose);
  if (!show) return [];
  return (rendered || []).map((q) => ({
    id: q.id,
    correct_index: q.correctIndex,
    explanation: q.explanation || null,
  }));
}

type SimulationSection = {
  subject: string;
  question_count: number;
  duration_minutes: number;
  calculator: boolean;
};

type SimulationConfig = {
  id: string;
  grade_key: string;
  title: string;
  class_name: string;
  school_name: string;
  teacher_name: string;
  principal_name: string;
  identity_mode: string;
  roster: string[];
  sections: SimulationSection[];
  show_result: boolean;
  show_answers: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_copy: boolean;
  attempts: number;
  closes_at: string | null;
  break_minutes: number;
};

const shortText = (value: unknown, max: number) => String(value || "").trim().slice(0, max);

function parseSimulationConfig(raw: unknown): SimulationConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = shortText(value.id, 64);
  if (!/^[a-z0-9]{8,64}$/i.test(id)) return null;
  const sourceSections = Array.isArray(value.sections) ? value.sections : [];
  const seen = new Set<string>();
  const sections: SimulationSection[] = [];
  for (const source of sourceSections.slice(0, 3)) {
    if (!source || typeof source !== "object") return null;
    const row = source as Record<string, unknown>;
    const subject = String(row.subject || "");
    const questionCount = Number(row.question_count);
    const duration = Number(row.duration_minutes);
    if (!["reading", "math", "science"].includes(subject) || seen.has(subject)) return null;
    if (!Number.isInteger(questionCount) || questionCount < 5 || questionCount > 40) return null;
    if (!Number.isInteger(duration) || duration < 5 || duration > 120) return null;
    seen.add(subject);
    sections.push({ subject, question_count: questionCount, duration_minutes: duration, calculator: subject === "math" && !!row.calculator });
  }
  if (!sections.length || sections.reduce((sum, section) => sum + section.question_count, 0) > 100) return null;
  const identityMode = ["list", "manual", "email"].includes(String(value.identity_mode)) ? String(value.identity_mode) : "manual";
  const roster = Array.isArray(value.roster)
    ? [...new Set(value.roster.map((name) => shortText(name, 120)).filter((name) => name.length >= 2))].slice(0, 120)
    : [];
  if (identityMode === "list" && !roster.length) return null;
  const attempts = Math.min(3, Math.max(1, Math.trunc(Number(value.attempts) || 1)));
  const breakMinutes = Math.min(30, Math.max(0, Math.trunc(Number(value.break_minutes) || 0)));
  let closesAt: string | null = null;
  if (value.closes_at) {
    const date = new Date(String(value.closes_at));
    if (Number.isNaN(date.getTime())) return null;
    closesAt = date.toISOString();
  }
  return {
    id,
    grade_key: GRADE_KEY,
    title: shortText(value.title, 160) || "محاكاة نافس الكاملة",
    class_name: shortText(value.class_name, 80),
    school_name: shortText(value.school_name, 120),
    teacher_name: shortText(value.teacher_name, 120),
    principal_name: shortText(value.principal_name, 120),
    identity_mode: identityMode,
    roster,
    sections,
    show_result: value.show_result !== false,
    show_answers: value.show_answers === true,
    shuffle_questions: value.shuffle_questions !== false,
    shuffle_options: value.shuffle_options !== false,
    allow_copy: value.allow_copy === true,
    attempts,
    closes_at: closesAt,
    break_minutes: breakMinutes,
  };
}

function numberSeed(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadSimulationPool(subject: string, seed: number) {
  const base = db.from("nafes_question_bank")
    .select("id", { count: "exact", head: true })
    .eq("grade_key", GRADE_KEY)
    .eq("subject_key", subject)
    .eq("review_status", "approved")
    .eq("is_active", true)
    .not("model_no", "is", null);
  const { count, error: countError } = await base;
  if (countError) throw countError;
  const pageSize = subject === "reading" ? 360 : 900;
  const maxStart = Math.max(0, Number(count || 0) - pageSize);
  const start = maxStart ? seed % (maxStart + 1) : 0;
  const { data, error } = await db.from("nafes_question_bank")
    .select("id,subject_key,outcome_code,indicator_index,indicator_text,measurement_focus,alignment_profile,alignment_verified,alignment_evidence,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level,question_no,model_no")
    .eq("grade_key", GRADE_KEY)
    .eq("subject_key", subject)
    .eq("review_status", "approved")
    .eq("is_active", true)
    .not("model_no", "is", null)
    .order("id", { ascending: true })
    .range(start, start + pageSize - 1);
  if (error) throw error;
  return (data || []).filter((q: Record<string, unknown>) => {
    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    const semanticallyVerified = subject === "reading" || (
      q.alignment_verified === true &&
      String(q.alignment_profile || "").startsWith(`${String(q.measurement_focus || "")}:`) &&
      String((q.alignment_evidence as Record<string, unknown> | null)?.validator || "") === "semantic-contract-v2" &&
      !!String((q.alignment_evidence as Record<string, unknown> | null)?.source_task || "").trim() &&
      !!String((q.alignment_evidence as Record<string, unknown> | null)?.source_answer || "").trim()
    );
    return semanticallyVerified && options.length === 4 && new Set(options).size === 4 && Number.isInteger(q.correct_index) && Number(q.correct_index) >= 0 && Number(q.correct_index) <= 3 && !!String(q.explanation || "").trim();
  }) as Record<string, unknown>[];
}

function shuffleQuestionOptions(question: Record<string, unknown>, random: () => number) {
  const options = (question.options as unknown[]).map((text, index) => ({ text: String(text), correct: index === Number(question.correct_index) }));
  const mixed = shuffled(options, random);
  return { ...question, options: mixed.map((item) => item.text), correctIndex: mixed.findIndex((item) => item.correct) };
}

function selectSimulationQuestions(pool: Record<string, unknown>[], section: SimulationSection, config: SimulationConfig, seed: number) {
  const random = seededRandom(seed);
  const mixed = shuffled(pool, random);
  const chosen: Record<string, unknown>[] = [];
  if (section.subject === "reading") {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of mixed) {
      const context = String(row.context_text || "");
      if (!context) continue;
      const group = groups.get(context) || [];
      group.push(row);
      groups.set(context, group);
    }
    for (const group of shuffled([...groups.values()], random)) {
      const remaining = section.question_count - chosen.length;
      if (remaining <= 0) break;
      chosen.push(...shuffled(group, random).slice(0, Math.min(5, remaining)));
    }
  } else {
    const focusCounts = new Map<string, number>();
    for (const maxPerFocus of [1, 2, 4]) {
      for (const row of mixed) {
        if (chosen.length >= section.question_count) break;
        if (chosen.some((item) => item.id === row.id)) continue;
        const focus = String(row.measurement_focus || "");
        const used = focusCounts.get(focus) || 0;
        if (used >= maxPerFocus) continue;
        chosen.push(row);
        focusCounts.set(focus, used + 1);
      }
    }
  }
  if (chosen.length < section.question_count) throw new Error(`insufficient_${section.subject}_questions`);
  let rendered = chosen.slice(0, section.question_count).map((row) => ({
    id: row.id,
    context: row.context_text || null,
    question: row.question_text,
    options: row.options,
    correctIndex: Number(row.correct_index),
    explanation: row.explanation || null,
    difficulty: row.difficulty,
    cognitive_level: row.cognitive_level,
    measurement_focus: row.measurement_focus,
  }));
  if (config.shuffle_options) rendered = rendered.map((q) => shuffleQuestionOptions(q, random));
  if (config.shuffle_questions && section.subject !== "reading") rendered = shuffled(rendered, random);
  return rendered;
}

function publicSimulationSections(sections: Record<string, unknown>[]) {
  return sections.map((section) => ({
    subject: section.subject,
    duration_minutes: section.duration_minutes,
    calculator: section.calculator,
    questions: publicQuestions((section.questions || []) as Record<string, unknown>[]),
  }));
}

function simulationGrade(sections: Record<string, unknown>[], answers: Record<string, unknown>) {
  const sectionScores = sections.map((section) => {
    const result = grade((section.questions || []) as Record<string, unknown>[], answers);
    return { subject: section.subject, ...result };
  });
  const score = sectionScores.reduce((sum, section) => sum + section.score, 0);
  const total = sectionScores.reduce((sum, section) => sum + section.total, 0);
  return { score, total, percent: total ? Math.round(score * 10000 / total) / 100 : 0, section_scores: sectionScores };
}

function simulationReview(sections: Record<string, unknown>[], config: SimulationConfig) {
  if (!config.show_answers) return [];
  return sections.flatMap((section) => ((section.questions || []) as Record<string, unknown>[]).map((q) => ({ id: q.id, correct_index: q.correctIndex, explanation: q.explanation || null })));
}

async function handleSimulationAction(body: Record<string, unknown>) {
  const action = String(body.action || "");
  const name = shortText(body.student_name, 120);
  const no = shortText(body.student_no, 160);
  if (!name || !no) return json({ error: "اكتب اسم الطالب وبياناته المميزة." }, 400);
  const studentKey = await hashKey(`${norm(name)}|${norm(no)}`);

  if (action === "simulation_start") {
    const config = parseSimulationConfig(body.config);
    if (!config) return json({ error: "إعدادات المحاكاة غير صحيحة." }, 400);
    if (config.closes_at && Date.now() > new Date(config.closes_at).getTime()) return json({ error: "انتهى وقت إتاحة هذه المحاكاة." }, 403);
    if (config.identity_mode === "list" && !config.roster.some((student) => norm(student) === norm(name))) return json({ error: "الاسم غير موجود في قائمة الفصل." }, 403);

    const { data: previous, error: previousError } = await db.from("nafes_simulation_attempts")
      .select("*")
      .eq("simulation_key", config.id)
      .eq("student_key", studentKey)
      .order("started_at", { ascending: false });
    if (previousError) throw previousError;
    const active = (previous || []).find((attempt) => !attempt.submitted_at && Date.now() <= new Date(attempt.expires_at).getTime());
    if (active) {
      const storedConfig = parseSimulationConfig(active.config)!;
      return json({ attempt_id: active.id, resumed: true, submitted: false, expires_at: active.expires_at, current_section: active.current_section || 0, answers: active.answers || {}, sections: publicSimulationSections(active.rendered_sections || []), review: [] });
    }
    if ((previous || []).length >= config.attempts) return json({ error: "استُنفد عدد المحاولات المسموح به." }, 409);

    const attemptNumber = (previous || []).length + 1;
    const sections: Record<string, unknown>[] = [];
    for (const section of config.sections) {
      const seed = numberSeed(`${config.id}|${studentKey}|${attemptNumber}|${section.subject}`);
      const pool = await loadSimulationPool(section.subject, seed);
      const questions = selectSimulationQuestions(pool, section, config, seed);
      sections.push({ ...section, questions });
    }
    const duration = config.sections.reduce((sum, section) => sum + section.duration_minutes, 0) + config.break_minutes * Math.max(0, config.sections.length - 1) + 5;
    const expiresAt = new Date(Date.now() + duration * 60000).toISOString();
    const { data: created, error: createError } = await db.from("nafes_simulation_attempts").insert({
      simulation_key: config.id,
      student_name: name,
      student_no: no,
      student_key: studentKey,
      config,
      rendered_sections: sections,
      expires_at: expiresAt,
    }).select().single();
    if (createError) throw createError;
    return json({ attempt_id: created.id, resumed: false, submitted: false, expires_at: expiresAt, current_section: 0, answers: {}, sections: publicSimulationSections(sections), review: [] });
  }

  const attemptId = shortText(body.attempt_id, 80);
  if (!attemptId) return json({ error: "المحاولة غير موجودة." }, 400);
  const { data: attempt, error: attemptError } = await db.from("nafes_simulation_attempts").select("*").eq("id", attemptId).eq("student_key", studentKey).maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt) return json({ error: "تعذر التحقق من المحاولة." }, 404);
  const storedConfig = parseSimulationConfig(attempt.config);
  if (!storedConfig) return json({ error: "إعدادات المحاولة غير صالحة." }, 409);
  if (attempt.submitted_at) {
    const result = simulationGrade(attempt.rendered_sections || [], attempt.answers || {});
    return json({ attempt_id: attempt.id, submitted: true, answers: attempt.answers || {}, sections: publicSimulationSections(attempt.rendered_sections || []), ...(storedConfig.show_result ? result : { result_hidden: true }), review: simulationReview(attempt.rendered_sections || [], storedConfig) });
  }

  const incomingAnswers = body.answers && typeof body.answers === "object" ? body.answers as Record<string, unknown> : {};
  if (action === "simulation_save") {
    const currentSection = Math.min(storedConfig.sections.length - 1, Math.max(0, Math.trunc(Number(body.current_section) || 0)));
    const { error } = await db.from("nafes_simulation_attempts").update({ answers: incomingAnswers, current_section: currentSection }).eq("id", attempt.id);
    if (error) throw error;
    return json({ ok: true });
  }
  if (action === "simulation_finish") {
    const result = simulationGrade(attempt.rendered_sections || [], incomingAnswers);
    const submittedAt = new Date().toISOString();
    const { error } = await db.from("nafes_simulation_attempts").update({ answers: incomingAnswers, submitted_at: submittedAt, score: result.score, total: result.total, percent: result.percent, section_scores: result.section_scores, current_section: storedConfig.sections.length - 1 }).eq("id", attempt.id);
    if (error) throw error;
    return json({ ok: true, submitted: true, ...(storedConfig.show_result ? result : { result_hidden: true }), review: simulationReview(attempt.rendered_sections || [], storedConfig) });
  }
  return json({ error: "إجراء المحاكاة غير معروف." }, 400);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const b = await req.json();
    const action = String(b.action || "");
    if (action.startsWith("simulation_")) return await handleSimulationAction(b);
    const subject = String(b.subject || "");
    const outcome = String(b.outcome || "");
    const indicator = Number(b.indicator || 0);
    const model = Number(b.model || 0);
    const indicatorText = String(b.indicator_text || "").trim();
    if (!["reading", "math", "science"].includes(subject) || !outcome || indicator < 1 || model < 1 || model > MODEL_COUNT) {
      return json({ error: "بيانات الاختبار غير صحيحة." }, 400);
    }
    if (!indicatorText) return json({ error: "تعذر تحديد نص المؤشر لهذا الاختبار." }, 400);
    const expectedFocus = `${subject}:${outcome}:i${indicator}`;

    const s = await settings(subject, outcome, indicator, model);

    if (action === "preview" || action === "start") {
      const indicatorBank = await loadIndicatorBank(subject, outcome, indicator);
      const bank = indicatorBank.filter((q) => Number(q.model_no) === model);
      const audit = inspectBank(bank, indicatorText, expectedFocus, subject);
      const indicatorAudit = inspectIndicatorBank(indicatorBank, indicatorText, expectedFocus, subject);
      const bankReady = audit.ready && indicatorAudit.ready;
      const reviewedRendered = bankReady ? renderBank(bank) : null;

      if (action === "preview") {
        if (!bankReady) {
          return json({
            ready: false,
            error: "أوقف الاختبار لأن بنك الأسئلة غير مطابق للمؤشر المحدد.",
            engine: "blocked_indicator_mismatch",
            bank: audit,
            indicator_bank: indicatorAudit,
          }, 409);
        }
        return json({
          ready: true,
          engine: "reviewed_question_bank",
          model_count: MODEL_COUNT,
          bank: audit,
          indicator_bank: indicatorAudit,
          settings: {
            duration_minutes: s.duration_minutes,
            question_count: QUESTION_COUNT,
            is_open: s.is_open,
            opens_at: s.opens_at,
            closes_at: s.closes_at,
          },
        });
      }

      if (!bankReady) {
        return json({
          error: "أوقف الاختبار لأن بنك الأسئلة غير مطابق للمؤشر المحدد.",
          bank: audit,
          indicator_bank: indicatorAudit,
        }, 409);
      }

      const windowError = checkWindow(s);
      if (windowError) return json({ error: windowError }, 403);
      const name = String(b.student_name || "").trim();
      const no = String(b.student_no || "").trim();
      if (!name || !no) return json({ error: "اكتب اسم الطالب ورقمه المميز." }, 400);
      const studentKey = await hashKey(`${norm(name)}|${norm(no)}`);

      const { data: existing, error: existingError } = await db
        .from("nafes_exam_attempts")
        .select("*")
        .eq("subject_key", subject)
        .eq("outcome_code", outcome)
        .eq("indicator_index", indicator)
        .eq("model_no", model)
        .eq("student_key", studentKey)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const savedIds = Array.isArray(existing.question_ids)
          ? existing.question_ids.map(String)
          : [];
        const reviewedIds = reviewedRendered?.map((q) => String(q.id)) || [];
        const staleContent = !!reviewedRendered && (
          savedIds.length !== reviewedIds.length ||
          savedIds.some((id, i) => id !== reviewedIds[i]) ||
          examContentKey(existing.rendered_questions || []) !==
            examContentKey(reviewedRendered)
        );

        // A reviewed bank must replace any older generated attempt. Otherwise the
        // student keeps seeing the pre-review text even after the bank is fixed.
        if (staleContent && reviewedRendered) {
          const started = new Date().toISOString();
          const expires = new Date(
            Date.now() + (Number(s.duration_minutes) || 20) * 60000,
          ).toISOString();
          const { error: refreshError } = await db.from("nafes_exam_attempts")
            .update({
              question_ids: reviewedIds,
              rendered_questions: reviewedRendered,
              answers: {},
              started_at: started,
              expires_at: expires,
              submitted_at: null,
              score: null,
              percent: null,
            })
            .eq("id", existing.id);
          if (refreshError) throw refreshError;
          return json({
            attempt_id: existing.id,
            resumed: false,
            refreshed: true,
            submitted: false,
            expired: false,
            expires_at: expires,
            answers: {},
            questions: publicQuestions(reviewedRendered),
          });
        }

        const expired = Date.now() > new Date(existing.expires_at).getTime();
        if (expired && !existing.submitted_at) {
          const g = grade(existing.rendered_questions || [], existing.answers || {});
          const finished = new Date().toISOString();
          const { error } = await db.from("nafes_exam_attempts")
            .update({ submitted_at: finished, score: g.score, percent: g.percent })
            .eq("id", existing.id);
          if (error) throw error;
          return json({
            attempt_id: existing.id,
            resumed: true,
            submitted: true,
            expired: true,
            expires_at: existing.expires_at,
            answers: existing.answers || {},
            questions: publicQuestions(existing.rendered_questions || []),
            score: g.score,
            percent: g.percent,
            review: buildReview(existing.rendered_questions || [], s),
          });
        }
        return json({
          attempt_id: existing.id,
          resumed: true,
          submitted: !!existing.submitted_at,
          expired,
          expires_at: existing.expires_at,
          answers: existing.answers || {},
          questions: publicQuestions(existing.rendered_questions || []),
          score: existing.score,
          percent: existing.percent,
          review: existing.submitted_at
            ? buildReview(existing.rendered_questions || [], s)
            : [],
        });
      }

      const rendered = reviewedRendered!;
      const expires = new Date(Date.now() + (Number(s.duration_minutes) || 20) * 60000).toISOString();
      const ids = rendered.map((q) => q.id);
      const { data: attempt, error: attemptError } = await db
        .from("nafes_exam_attempts")
        .insert({
          subject_key: subject,
          outcome_code: outcome,
          indicator_index: indicator,
          model_no: model,
          student_name: name,
          student_no: no,
          student_key: studentKey,
          question_ids: ids,
          rendered_questions: rendered,
          expires_at: expires,
        })
        .select()
        .single();
      if (attemptError) throw attemptError;
      return json({
        attempt_id: attempt.id,
        resumed: false,
        submitted: false,
        expired: false,
        expires_at: expires,
        answers: {},
        questions: publicQuestions(rendered),
      });
    }

    const windowError = checkWindow(s);
    if (windowError) return json({ error: windowError }, 403);
    const name = String(b.student_name || "").trim();
    const no = String(b.student_no || "").trim();
    if (!name || !no) return json({ error: "اكتب اسم الطالب ورقمه المميز." }, 400);
    const studentKey = await hashKey(`${norm(name)}|${norm(no)}`);
    const attemptId = String(b.attempt_id || "");
    if (!attemptId) return json({ error: "المحاولة غير موجودة." }, 400);

    const { data: a, error: attemptError } = await db
      .from("nafes_exam_attempts")
      .select("*")
      .eq("id", attemptId)
      .eq("student_key", studentKey)
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!a) return json({ error: "تعذر التحقق من المحاولة." }, 404);
    if (a.submitted_at) return json({ error: "تم تسليم هذه المحاولة سابقًا.", score: a.score, percent: a.percent }, 409);

    const expiredNow = Date.now() > new Date(a.expires_at).getTime();
    if (expiredNow && action !== "finish") return json({ error: "انتهى وقت الاختبار." }, 403);

    if (action === "save") {
      const answers = b.answers && typeof b.answers === "object" ? b.answers : {};
      const { error } = await db.from("nafes_exam_attempts").update({ answers }).eq("id", a.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "finish") {
      const answers = expiredNow
        ? (a.answers || {})
        : (b.answers && typeof b.answers === "object" ? b.answers : (a.answers || {}));
      const g = grade(a.rendered_questions || [], answers);
      const finished = new Date().toISOString();
      const { error } = await db.from("nafes_exam_attempts")
        .update({ answers, submitted_at: finished, score: g.score, percent: g.percent })
        .eq("id", a.id);
      if (error) throw error;
      const rendered = a.rendered_questions || [];
      const review = buildReview(rendered, s);
      return json({ ok: true, score: g.score, total: g.total, percent: g.percent, review });
    }

    return json({ error: "إجراء غير معروف." }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: "حدث خطأ أثناء تشغيل الاختبار." }, 500);
  }
});
