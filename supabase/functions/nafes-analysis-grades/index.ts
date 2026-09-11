import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-teacher-key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const tidy = (value: unknown) => String(value ?? "").trim();

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function requireTeacher(req: Request) {
  const key = tidy(req.headers.get("x-teacher-key"));
  if (!/^[a-f0-9]{48,96}$/i.test(key)) throw Object.assign(new Error("مفتاح دخول المعلم مطلوب."), { status: 401 });
  const { data, error } = await db.from("nafes_teacher_access").select("id").eq("key_hash", await sha256(key)).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error("مفتاح دخول المعلم غير صحيح."), { status: 401 });
  return data;
}

async function allRows(table: string, columns: string) {
  const rows: Record<string, unknown>[] = [];
  for (let start = 0;; start += 500) {
    const { data, error } = await db.from(table).select(columns).not("submitted_at", "is", null).order("submitted_at", { ascending: true }).range(start, start + 499);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    await requireTeacher(req);
    const [assessment, simulation, exam] = await Promise.all([
      allRows("nafes_assessment_attempts", "id,assessment_id,student_id,student_key,score,total,percent,section_scores,submitted_at"),
      allRows("nafes_simulation_attempts", "id,simulation_key,student_id,student_key,score,total,percent,section_scores,submitted_at"),
      allRows("nafes_exam_attempts", "id,subject_key,outcome_code,indicator_index,model_no,student_id,student_key,score,percent,rendered_questions,submitted_at"),
    ]);
    const grades = [
      ...assessment.map((r: any) => ({ source: "assessment", id: r.id, test_id: r.assessment_id, student_id: r.student_id, student_key: r.student_key, score: r.score, total: r.total, percent: r.percent, section_scores: Array.isArray(r.section_scores) ? r.section_scores : [], submitted_at: r.submitted_at })),
      ...simulation.map((r: any) => ({ source: "simulation", id: r.id, test_id: `simulation:${r.simulation_key}`, student_id: r.student_id, student_key: r.student_key, score: r.score, total: r.total, percent: r.percent, section_scores: Array.isArray(r.section_scores) ? r.section_scores : [], submitted_at: r.submitted_at })),
      ...exam.map((r: any) => ({ source: "exam", id: r.id, test_id: `exam:${r.subject_key}:${r.outcome_code}:i${r.indicator_index}:m${r.model_no}`, student_id: r.student_id, student_key: r.student_key, score: r.score, total: Array.isArray(r.rendered_questions) ? r.rendered_questions.length : 15, percent: r.percent, section_scores: [], submitted_at: r.submitted_at })),
    ];
    return json({ ok: true, grades });
  } catch (error) {
    console.error(error);
    const status = error && typeof error === "object" && "status" in error ? Number((error as any).status) : 500;
    return json({ error: status === 500 ? "تعذر تحميل الدرجات المحفوظة للتحليل." : String((error as Error).message) }, status);
  }
});
