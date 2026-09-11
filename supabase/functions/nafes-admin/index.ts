import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type,x-teacher-key,authorization,apikey,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json; charset=utf-8"
};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const isUuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""));
async function sha256(value:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")}
async function teacher(req:Request){const key=String(req.headers.get("x-teacher-key")||"").trim();if(!/^[a-f0-9]{48,96}$/i.test(key))throw Object.assign(new Error("مفتاح المعلم غير صالح."),{status:401});const {data,error}=await db.from("nafes_teacher_access").select("id,label").eq("key_hash",await sha256(key)).eq("active",true).maybeSingle();if(error)throw error;if(!data)throw Object.assign(new Error("مفتاح المعلم غير صحيح."),{status:401});return data}
function realTestId(source:string,a:any){if(source==="assessment")return String(a.assessment_id||"");if(source==="simulation")return `simulation:${a.simulation_key}`;if(source==="exam")return `exam:${a.subject_key}:${a.outcome_code}:i${a.indicator_index}:m${a.model_no}`;return""}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  try{
    const owner=await teacher(req);
    const b=await req.json().catch(()=>({}));
    if(String(b.action||"")!=="teacher_attempt_delete")return json({error:"إجراء غير معروف."},400);
    if(String(b.confirm_word||"").trim()!=="حذف النتيجة")return json({error:"يجب تأكيد العملية بعبارة «حذف النتيجة»."},400);
    const source=String(b.source||"").trim();
    const tables:Record<string,string>={assessment:"nafes_assessment_attempts",simulation:"nafes_simulation_attempts",exam:"nafes_exam_attempts"};
    const table=tables[source];
    const attemptId=String(b.attempt_id||"").trim(),studentId=String(b.student_id||"").trim(),expectedTest=String(b.test_id||"").trim();
    if(!table||!isUuid(attemptId)||!isUuid(studentId)||!expectedTest)return json({error:"بيانات النتيجة المراد حذفها غير مكتملة."},400);
    const {data:a,error:readError}=await db.from(table).select("*").eq("id",attemptId).maybeSingle();
    if(readError)throw readError;if(!a)return json({error:"النتيجة غير موجودة."},404);
    if(String(a.student_id||"")!==studentId)return json({error:"النتيجة لا تخص الطالب المحدد."},409);
    if(realTestId(source,a)!==expectedTest)return json({error:"النتيجة لا تخص الاختبار المحدد."},409);
    if(source==="assessment"){
      const {data:t,error:te}=await db.from("nafes_assessments").select("owner_id").eq("id",a.assessment_id).maybeSingle();
      if(te)throw te;if(!t||String(t.owner_id)!==String(owner.id))return json({error:"لا تملك صلاحية حذف نتيجة هذا الاختبار."},403);
    }
    const {error:delError,count}=await db.from(table).delete({count:"exact"}).eq("id",attemptId).eq("student_id",studentId);
    if(delError)throw delError;
    return json({ok:true,deleted:count??1,attempt_id:attemptId,test_id:expectedTest,student_id:studentId});
  }catch(error:any){console.error(error);return json({error:String(error?.message||"تعذر حذف نتيجة الطالب.")},Number(error?.status||500))}
});
