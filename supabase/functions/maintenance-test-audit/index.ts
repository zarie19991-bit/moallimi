import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { auditTest, summarize } from "./audit-core.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-teacher-key,authorization,apikey,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8"};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:cors});
const tidy=(v:any,n=200)=>String(v??"").normalize("NFKC").trim().slice(0,n);
async function sha256(value:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")}
async function master(req:Request){
  const key=tidy(req.headers.get("x-teacher-key"),120);
  if(!/^[a-f0-9]{48,96}$/i.test(key))throw Object.assign(new Error("مفتاح الحساب الرئيسي غير صالح."),{status:401});
  const {data,error}=await db.from("nafes_teacher_access").select("id,subject_scope").eq("key_hash",await sha256(key)).eq("active",true).maybeSingle();
  if(error)throw error;
  if(!data||String(data.subject_scope||"")!=="all")throw Object.assign(new Error("هذا الفحص للحساب الرئيسي فقط."),{status:403});
  return data;
}
async function fetchTests(){
  const out:any[]=[];
  for(let start=0;;start+=200){
    const {data,error}=await db.from("nafes_assessments")
      .select("id,title,status,rendered_sections,created_at")
      .eq("kind","multi_indicator").order("created_at",{ascending:true}).range(start,start+199);
    if(error)throw error;
    out.push(...(data||[]));
    if(!data||data.length<200)break;
  }
  return out;
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  try{
    const owner=await master(req),tests=await fetchTests(),reports=tests.map(auditTest),summaryData=summarize(reports);
    const findings=summaryData.findings;
    const severity=findings.some((x:any)=>x.severity==="critical")?"critical":findings.some((x:any)=>x.severity==="warning")?"warning":"info";
    const metrics={source:"generated_indicator_tests",audit_version:"generated-indicator-tests-v1",total_tests:reports.length,total_rendered_questions:reports.reduce((z:number,r:any)=>z+r.question_count,0),totals:summaryData.totals,privacy:{contains_student_names:false,contains_student_ids:false,contains_teacher_keys:false,student_attempts_read:false,roster_read:false}};
    const summary="فحص الاختبارات الفعلية للمؤشرات: "+metrics.total_tests+" اختبارًا و"+metrics.total_rendered_questions+" سؤالًا مرسومًا.";
    const {data:run,error}=await db.from("maintenance_agent_runs").insert({owner_id:owner.id,run_type:"questions",status:"completed",severity,summary,findings,metrics,contains_personal_data:false})
      .select("id,run_type,status,severity,summary,findings,metrics,created_at").single();
    if(error)throw error;
    for(let i=0;i<reports.length;i+=100){
      const rows=reports.slice(i,i+100).map((r:any)=>({run_id:run.id,owner_id:owner.id,assessment_id:r.assessment_id,title:r.title,status:r.status,subject:r.subject,question_count:r.question_count,indicator_count:r.indicator_count,levels:r.levels,answer_positions:r.answer_positions,issues:r.issues,samples:r.samples,contains_personal_data:false}));
      const {error:e}=await db.from("maintenance_agent_assessment_reports").insert(rows);if(e)throw e;
    }
    const {data:handoff,error:hError}=await db.from("maintenance_agent_handoffs").insert({owner_id:owner.id,run_id:run.id,area:"question_quality",source:"generated_indicator_tests",status:"needs_assistant",summary,findings,source_files:["supabase/functions/nafes-exam/assessments.ts"],verification:{before_run_id:run.id,before_issue_count:findings.length,before_critical_count:findings.filter((x:any)=>x.severity==="critical").length},fix:{},contains_personal_data:false}).select("id,status,summary").single();
    if(hError)throw hError;
    return json({ok:true,run,handoff});
  }catch(error:any){
    return json({error:String(error?.message||"تعذر فحص الاختبارات الفعلية.")},Number(error?.status||500));
  }
});