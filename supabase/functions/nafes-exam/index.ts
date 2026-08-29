import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateExam } from "https://raw.githubusercontent.com/zarie19991-bit/moallimi/main/nafes-factory.mjs";

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
  context_text: string | null;
  question_text: string;
  options: unknown;
  correct_index: number;
  explanation: string | null;
  difficulty: string;
  cognitive_level: string;
  question_no: number;
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

async function loadBank(subject: string, outcome: string, indicator: number, model: number) {
  const { data, error } = await db
    .from("nafes_question_bank")
    .select("id,indicator_text,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level,question_no")
    .eq("grade_key", GRADE_KEY)
    .eq("subject_key", subject)
    .eq("outcome_code", outcome)
    .eq("indicator_index", indicator)
    .eq("model_no", model)
    .eq("review_status", "approved")
    .eq("is_active", true)
    .order("question_no", { ascending: true });
  if (error) throw error;
  return (data || []) as BankRow[];
}

function inspectBank(rows: BankRow[], expectedIndicatorText: string) {
  const issues: string[] = [];
  if (rows.length !== QUESTION_COUNT) issues.push("count");

  const positions = rows.map((q) => Number(q.question_no));
  const expectedPositions = Array.from({ length: QUESTION_COUNT }, (_, i) => i + 1);
  if (positions.length !== QUESTION_COUNT || positions.some((x, i) => x !== expectedPositions[i])) {
    issues.push("positions");
  }

  const questionKeys = new Set<string>();
  const levels = new Set<string>();
  const answerCounts = [0, 0, 0, 0];
  const bannedPlaceholder = /^(المعنى المضاد لها|تفصيل لا علاقة له|اسم مكان ورد في النص|معنى حرفي لا يناسب السياق|عبارة |جملة |سلوك |تكرار عنوان النص)/;

  for (const q of rows) {
    const options = Array.isArray(q.options) ? q.options.map(String) : [];
    const key = `${q.context_text || ""}\u001f${q.question_text}`;
    if (questionKeys.has(key)) issues.push("duplicate_question");
    questionKeys.add(key);
    if (options.length !== 4 || new Set(options).size !== 4) issues.push("options");
    if (options.some((x) => bannedPlaceholder.test(x))) issues.push("placeholder_option");
    if (!Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) {
      issues.push("correct_index");
    } else {
      answerCounts[q.correct_index]++;
    }
    levels.add(q.cognitive_level);
    if (norm(q.indicator_text) !== norm(expectedIndicatorText)) {
      issues.push("indicator_mismatch");
    }
  }

  if (rows.length === QUESTION_COUNT && Math.max(...answerCounts) - Math.min(...answerCounts) > 1) {
    issues.push("answer_distribution");
  }
  if (!["knowledge", "application", "reasoning"].every((level) => levels.has(level))) {
    issues.push("cognitive_levels");
  }

  return {
    ready: issues.length === 0,
    issues: [...new Set(issues)],
    approved_count: rows.length,
    required_count: QUESTION_COUNT,
    answer_distribution: answerCounts,
    cognitive_levels: [...levels],
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const b = await req.json();
    const action = String(b.action || "");
    const subject = String(b.subject || "");
    const outcome = String(b.outcome || "");
    const indicator = Number(b.indicator || 0);
    const model = Number(b.model || 0);
    const indicatorText = String(b.indicator_text || "").trim();
    const outcomeTitle = String(b.outcome_title || "").trim();

    if (!["reading", "math", "science"].includes(subject) || !outcome || indicator < 1 || model < 1 || model > MODEL_COUNT) {
      return json({ error: "بيانات الاختبار غير صحيحة." }, 400);
    }
    if (!indicatorText) return json({ error: "تعذر تحديد نص المؤشر لهذا الاختبار." }, 400);

    const s = await settings(subject, outcome, indicator, model);

    if (action === "preview" || action === "start") {
      const bank = await loadBank(subject, outcome, indicator, model);
      const audit = inspectBank(bank, indicatorText);
      const bankReady = audit.ready;
      const reviewedRendered = bankReady ? renderBank(bank) : null;

      if (action === "preview") {
        if (subject === "reading" && !bankReady) {
          return json({
            ready: false,
            error: "أوقف الاختبار لأن بنك الأسئلة غير مطابق للمؤشر المحدد.",
            engine: "blocked_indicator_mismatch",
            bank: audit,
          }, 409);
        }
        return json({
          ready: true,
          engine: bankReady ? "reviewed_question_bank" : "question_bank_with_temporary_fallback",
          model_count: MODEL_COUNT,
          bank: audit,
          settings: {
            duration_minutes: s.duration_minutes,
            question_count: QUESTION_COUNT,
            is_open: s.is_open,
            opens_at: s.opens_at,
            closes_at: s.closes_at,
          },
        });
      }

      if (subject === "reading" && !bankReady) {
        return json({
          error: "أوقف الاختبار لأن بنك الأسئلة غير مطابق للمؤشر المحدد.",
          bank: audit,
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

      const rendered = reviewedRendered
        ? reviewedRendered
        : generateExam({
          subject,
          indicatorText,
          outcomeTitle,
          outcomeCode: outcome,
          indicatorIndex: indicator,
          modelNo: model,
          seed: `${studentKey}|${crypto.randomUUID()}|${Date.now()}`,
        }).slice(0, QUESTION_COUNT);
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
