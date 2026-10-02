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
const tidy=(v:unknown,n=200)=>String(v??"").normalize("NFKC").trim().slice(0,n);
const num=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;
async function sha256(value:string){
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function master(req:Request){
  const key=tidy(req.headers.get("x-teacher-key"),120);
  if(!/^[a-f0-9]{48,96}$/i.test(key))throw Object.assign(new Error("مفتاح الحساب الرئيسي غير صالح."),{status:401});
  const {data,error}=await db.from("nafes_teacher_access").select("id,label,subject_scope").eq("key_hash",await sha256(key)).eq("active",true).maybeSingle();
  if(error)throw error;
  if(!data)throw Object.assign(new Error("تعذر التحقق من الحساب الرئيسي."),{status:401});
  if(String(data.subject_scope||"")!=="all")throw Object.assign(new Error("وكيل الصيانة متاح للحساب الرئيسي فقط."),{status:403});
  return data;
}
type Finding={code:string;area:string;severity:"info"|"warning"|"critical";title:string;detail:string;safe_action:string;auto_apply:boolean};
const weight=(s:string)=>({info:1,warning:2,critical:3}[s]||0);
function inspect(snapshot:any):Finding[]{
  const out:Finding[]=[];
  const sec=snapshot?.database_security||{},q=snapshot?.question_quality||{},paper=snapshot?.paper_review||{};
  if(num(sec.rls_disabled_public_count)>0)out.push({
    code:"RLS_DISABLED_PUBLIC",area:"database_security",severity:"critical",
    title:"جداول عامة بلا حماية RLS",
    detail:"يوجد "+num(sec.rls_disabled_public_count)+" جدولًا في public دون RLS. لا ينفذ الوكيل أي تغيير تلقائي لأن تفعيل RLS بلا تصميم سياسات قد يعطل المنصة.",
    safe_action:"مراجعة استخدام كل جدول ثم إعداد سياسة وصول محددة قبل أي تفعيل.",auto_apply:false
  });
  if(num(q.prompt_leak_rows)>0)out.push({
    code:"QUESTION_PROMPT_LEAK",area:"question_quality",severity:"critical",
    title:"صياغات داخلية ظهرت داخل بنك الأسئلة",
    detail:"اكتشف الفحص "+num(q.prompt_leak_rows)+" صفًا يحتوي عبارات تصميم داخلية أو قوالب لا ينبغي أن تظهر للطالب.",
    safe_action:"عزل الأسئلة المتأثرة عن الاختبارات الجديدة ثم مراجعتها دلاليًا قبل الإرجاع.",auto_apply:false
  });
  const dup=num(q.duplicate_groups_question_bank)+num(q.duplicate_groups_curated_bank);
  if(dup>0)out.push({
    code:"QUESTION_EXACT_DUPLICATES",area:"question_quality",severity:"warning",
    title:"مجموعات أسئلة متطابقة",
    detail:"اكتشف الفحص "+dup+" مجموعة تكرار حرفي داخل البنوك المستخدمة.",
    safe_action:"إبقاء السجلات التاريخية وعدم حذفها، مع منع النسخ المكررة من دخول الاختبارات الجديدة.",auto_apply:false
  });
  if(num(q.question_bank_needs_quality_review)>0)out.push({
    code:"QUESTION_REVIEW_BACKLOG",area:"question_quality",severity:"info",
    title:"أسئلة ما زالت تحتاج مراجعة جودة",
    detail:"يوجد "+num(q.question_bank_needs_quality_review)+" صفًا غير مصنف كمعتمد أو جاهز وفق بوابة الجودة.",
    safe_action:"استكمال التحكيم على دفعات حسب المادة والمؤشر دون تعديل نتائج الطلاب.",auto_apply:false
  });
  if(num(paper.saved_reviews)>0&&num(paper.approved_attempts)===0)out.push({
    code:"PAPER_RESULTS_EMPTY",area:"printing",severity:"info",
    title:"اختبارات ورقية محفوظة بلا نتائج معتمدة",
    detail:"يوجد "+num(paper.saved_reviews)+" اختبارًا ورقيًا محفوظًا، ولم يسجل الفحص نتائج OMR معتمدة حتى الآن.",
    safe_action:"فحص مسار الرفع والاعتماد عند أول دفعة أوراق قبل ربطه بالتقارير النهائية.",auto_apply:false
  });
  return out;
}
function overall(findings:Finding[]){
  if(!findings.length)return "ok";
  return findings.reduce((a,b)=>weight(b.severity)>weight(a)?b.severity:a,"info");
}
function summaryFor(findings:Finding[]){
  if(!findings.length)return "لم يكتشف الفحص الحالي مشكلات ضمن النطاق الآمن.";
  const critical=findings.filter(x=>x.severity==="critical").length;
  const warning=findings.filter(x=>x.severity==="warning").length;
  const info=findings.filter(x=>x.severity==="info").length;
  return "اكتشف الوكيل "+findings.length+" ملاحظة: "+critical+" حرجة، "+warning+" تحذيرية، "+info+" معلوماتية.";
}
function proposalFor(f:Finding,runId:string,ownerId:string){
  const base={run_id:runId,owner_id:ownerId,status:"pending",contains_personal_data:false};
  if(f.code==="QUESTION_PROMPT_LEAK")return {...base,area:"question_quality",title:"عزل صياغات الأسئلة الداخلية",risk_level:"medium",proposal:{mode:"quarantine_only",scope:"new_tests_only",preserve_history:true,requires_manual_review:true,auto_apply:false,source_finding:f.code}};
  if(f.code==="QUESTION_EXACT_DUPLICATES")return {...base,area:"question_quality",title:"منع التكرار الحرفي في الاختبارات الجديدة",risk_level:"medium",proposal:{mode:"selection_filter",delete_rows:false,preserve_history:true,requires_manual_review:true,auto_apply:false,source_finding:f.code}};
  if(f.code==="RLS_DISABLED_PUBLIC")return {...base,area:"database_security",title:"خطة تقوية RLS بعد فحص الاستخدام",risk_level:"high",proposal:{mode:"policy_design_first",apply_rls_immediately:false,requires_usage_audit:true,requires_manual_approval:true,auto_apply:false,source_finding:f.code}};
  if(f.code==="PAPER_RESULTS_EMPTY")return {...base,area:"printing",title:"فحص مسار اعتماد نتائج OMR",risk_level:"low",proposal:{mode:"read_only_trace",change_student_results:false,auto_apply:false,source_finding:f.code}};
  return {...base,area:"question_quality",title:"خطة مراجعة جودة مرحلية",risk_level:"low",proposal:{mode:"review_batch",auto_apply:false,source_finding:f.code}};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  try{
    const owner=await master(req);
    const b=await req.json().catch(()=>({}));
    const action=tidy(b.action,50)||"diagnose";

    if(action==="diagnose"){
      const {data:snapshot,error}=await db.rpc("maintenance_agent_snapshot");
      if(error)throw error;
      const findings=inspect(snapshot||{});
      const severity=overall(findings);
      const summary=summaryFor(findings);
      const {data:run,error:saveError}=await db.from("maintenance_agent_runs").insert({
        owner_id:owner.id,run_type:"full",status:"completed",severity,summary,
        findings,metrics:snapshot||{},contains_personal_data:false
      }).select("id,run_type,status,severity,summary,findings,metrics,created_at").single();
      if(saveError)throw saveError;
      return json({ok:true,mode:"read_only",privacy:snapshot?.privacy||{},run});
    }

    if(action==="history"){
      const limit=Math.max(1,Math.min(30,num(b.limit)||12));
      const {data:runs,error:runsError}=await db.from("maintenance_agent_runs")
        .select("id,run_type,status,severity,summary,findings,metrics,created_at")
        .eq("owner_id",owner.id).order("created_at",{ascending:false}).limit(limit);
      if(runsError)throw runsError;
      const {data:proposals,error:proposalError}=await db.from("maintenance_agent_proposals")
        .select("id,run_id,area,title,risk_level,status,proposal,created_at,decided_at")
        .eq("owner_id",owner.id).order("created_at",{ascending:false}).limit(50);
      if(proposalError)throw proposalError;
      return json({ok:true,runs:runs||[],proposals:proposals||[],mode:"read_only"});
    }

    if(action==="prepare_plan"){
      const runId=tidy(b.run_id,80);
      if(!/^[0-9a-f-]{36}$/i.test(runId))return json({error:"معرّف الفحص غير صالح."},400);
      const {data:run,error:runError}=await db.from("maintenance_agent_runs")
        .select("id,findings").eq("id",runId).eq("owner_id",owner.id).maybeSingle();
      if(runError)throw runError;
      if(!run)return json({error:"الفحص غير موجود."},404);
      const {data:existing,error:existingError}=await db.from("maintenance_agent_proposals")
        .select("id,run_id,area,title,risk_level,status,proposal,created_at,decided_at")
        .eq("run_id",runId).eq("owner_id",owner.id);
      if(existingError)throw existingError;
      if(existing?.length)return json({ok:true,proposals:existing,mode:"approval_only"});
      const rows=(Array.isArray(run.findings)?run.findings:[]).map((f:Finding)=>proposalFor(f,runId,owner.id));
      if(!rows.length)return json({ok:true,proposals:[],mode:"approval_only"});
      const {data:created,error:createError}=await db.from("maintenance_agent_proposals").insert(rows)
        .select("id,run_id,area,title,risk_level,status,proposal,created_at,decided_at");
      if(createError)throw createError;
      return json({ok:true,proposals:created||[],mode:"approval_only"});
    }

    if(action==="decide"){
      const id=tidy(b.proposal_id,80),decision=tidy(b.decision,20);
      if(!/^[0-9a-f-]{36}$/i.test(id)||!["approved","rejected"].includes(decision))return json({error:"قرار الخطة غير صالح."},400);
      if(decision==="approved"&&tidy(b.confirm,80)!=="اعتماد الخطة")return json({error:"اكتب «اعتماد الخطة» لتأكيد اعتماد الخطة. لن يتم تنفيذها تلقائيًا."},400);
      const {data:row,error}=await db.from("maintenance_agent_proposals")
        .update({status:decision,decided_at:new Date().toISOString()})
        .eq("id",id).eq("owner_id",owner.id).eq("status","pending")
        .select("id,run_id,area,title,risk_level,status,proposal,created_at,decided_at").maybeSingle();
      if(error)throw error;
      if(!row)return json({error:"الخطة غير موجودة أو سبق اتخاذ قرار بشأنها."},409);
      return json({ok:true,proposal:row,executed:false,message:"تم حفظ القرار فقط. لا ينفذ وكيل الإصدار الأول أي تغيير في قاعدة البيانات أو الشفرة."});
    }

    return json({error:"إجراء غير معروف."},400);
  }catch(error:any){
    console.error("maintenance-agent",error);
    return json({error:String(error?.message||"تعذر تشغيل وكيل الصيانة.")},Number(error?.status||500));
  }
});
