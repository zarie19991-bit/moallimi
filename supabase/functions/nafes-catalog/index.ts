import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-teacher-key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function correctedCatalog(req: Request, body: Record<string, unknown>) {
  const teacherKey = String(req.headers.get("x-teacher-key") || "").trim();
  if (!teacherKey) return json({ error: "أدخل مفتاح دخول المعلم." }, 401);

  // Reuse the existing nafes-exam teacher authentication and catalog payload.
  const baseResponse = await fetch(`${SUPABASE_URL}/functions/v1/nafes-exam`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-teacher-key": teacherKey },
    body: JSON.stringify({ ...body, action: "teacher_catalog" }),
  });
  const base = await baseResponse.json().catch(() => ({}));
  if (!baseResponse.ok || base?.error) return json(base, baseResponse.status || 500);

  // PostgREST projects commonly cap one response at 1000 rows. Paginate explicitly,
  // otherwise a 1590-question science bank makes later indicators look incomplete.
  const counts = new Map<string, number>();
  const pageSize = 500;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await db
      .from("nafes_simulation_question_bank")
      .select("indicator_key,subject_key")
      .eq("grade_key", "middle_3")
      .eq("is_active", true)
      .eq("review_status", "approved")
      .eq("semantic_similarity_cleared", true)
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    for (const row of data || []) {
      const key = String(row.indicator_key || "");
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    if (!data || data.length < pageSize) break;
  }

  const indicators = Array.isArray(base.simulation_indicators)
    ? base.simulation_indicators.map((item: Record<string, unknown>) => ({
        ...item,
        available: counts.get(String(item.key || "")) || 0,
      }))
    : [];

  const summary = { reading: 0, math: 0, science: 0 } as Record<string, number>;
  for (const [key, count] of counts.entries()) {
    const subject = key.split(":", 1)[0];
    if (subject in summary) summary[subject] += count;
  }

  return json({ ...base, simulation_indicators: indicators, simulation_summary: summary });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    if (String(body.action || "") !== "teacher_catalog") return json({ error: "إجراء غير معروف." }, 400);
    return await correctedCatalog(req, body);
  } catch (error) {
    console.error(error);
    return json({ error: "تعذر تحميل كتالوج الاختبارات المحاكية." }, 500);
  }
});
