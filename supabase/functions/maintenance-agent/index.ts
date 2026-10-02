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
const hasNumber=(v:unknown)=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
function normAr(v:unknown){
  return tidy(v,1200).toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g,"")
    .replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/[^\u0621-\u063A\u0641-\u064A0-9a-z_\- ]/gi," ")
    .replace(/\s+/g," ").trim();
}
function tokens(v:unknown){
  return [...new Set(normAr(v).split(" ").filter(x=>x.length>=3))].slice(0,80);
}
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
  if(hasNumber(q.prompt_leak_rows)&&num(q.prompt_leak_rows)>0)out.push({
    code:"QUESTION_PROMPT_LEAK",area:"question_quality",severity:"critical",
    title:"صياغات داخلية ظهرت داخل بنك الأسئلة",
    detail:"اكتشف الفحص "+num(q.prompt_leak_rows)+" صفًا يحتوي عبارات تصميم داخلية أو قوالب لا ينبغي أن تظهر للطالب.",
    safe_action:"عزل الأسئلة المتأثرة عن الاختبارات الجديدة ثم مراجعتها دلاليًا قبل الإرجاع.",auto_apply:false
  });
  const dup=(hasNumber(q.duplicate_groups_question_bank)?num(q.duplicate_groups_question_bank):0)+(hasNumber(q.duplicate_groups_curated_bank)?num(q.duplicate_groups_curated_bank):0);
  if((hasNumber(q.duplicate_groups_question_bank)||hasNumber(q.duplicate_groups_curated_bank))&&dup>0)out.push({
    code:"QUESTION_EXACT_DUPLICATES",area:"question_quality",severity:"warning",
    title:"مجموعات أسئلة متطابقة",
    detail:"اكتشف الفحص "+dup+" مجموعة تكرار حرفي داخل البنوك المستخدمة.",
    safe_action:"إبقاء السجلات التاريخية وعدم حذفها، مع منع النسخ المكررة من دخول الاختبارات الجديدة.",auto_apply:false
  });
  if(hasNumber(q.question_bank_needs_quality_review)&&num(q.question_bank_needs_quality_review)>0)out.push({
    code:"QUESTION_REVIEW_BACKLOG",area:"question_quality",severity:"info",
    title:"أسئلة ما زالت تحتاج مراجعة جودة",
    detail:"يوجد "+num(q.question_bank_needs_quality_review)+" صفًا غير مصنف كمعتمد أو جاهز وفق بوابة الجودة.",
    safe_action:"استكمال التحكيم على دفعات حسب المادة والمؤشر دون تعديل نتائج الطلاب.",auto_apply:false
  });
  if(num(paper.saved_reviews)>0&&num(paper.approved_attempts)===0)out.push({
    code:"PAPER_RESULTS_EMPTY",area:"printing",severity:"info",
    title:"OMR جاهز ولم تُعتمد نتائج بعد",
    detail:"يوجد "+num(paper.saved_reviews)+" اختبارًا ورقيًا محفوظًا، ولا توجد نتائج OMR معتمدة حتى الآن. هذه حالة طبيعية ما لم تكن قد ضغطت «اعتماد النتائج» بعد رفع الأوراق.",
    safe_action:"لا يلزم إصلاح. عند أول اعتماد فعلي للنتائج يتحقق الوكيل من إنشاء سجلات paper_scan وربطها بالتحليل.",auto_apply:false
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
  if(f.code==="PAPER_RESULTS_EMPTY")return null;
  if(f.code.startsWith("PRINT_")){
    const files=Array.isArray((f as any).source_files)?(f as any).source_files:[];
    const risk=f.severity==="critical"?"medium":"low";
    return {...base,area:"printing",title:"إصلاح مشكلة الطباعة: "+f.title,risk_level:risk,proposal:{mode:"print_layout_repair",source_files:files,issue_code:f.code,preserve_content:true,no_data_changes:true,requires_visual_retest:true,auto_apply:false}};
  }
  return {...base,area:"question_quality",title:"خطة مراجعة جودة مرحلية",risk_level:"low",proposal:{mode:"review_batch",auto_apply:false,source_finding:f.code}};
}



const PRINT_SOURCES:Record<string,{label:string,files:string[]}>={
  question_papers:{label:"أوراق الأسئلة",files:["review-question-papers.html","review-question-papers.css","review-question-papers.js"]},
  bubble_sheets:{label:"أوراق التظليل",files:["review-bubble-sheets.html","review-bubble-sheets.css","review-bubble-sheets.js","review-omr-template.js"]},
  paper_report:{label:"التقرير الورقي",files:["review-report.html","review-report.js","review-results.css"]},
  analysis_report:{label:"تقارير التحليل",files:["analysis.html","analysis-section-router.js","analysis-print.js","report-a4-flow-final.css","report-print-exact.css"]}
};
const PRINT_CODES:Record<string,{title:string,severity:"info"|"warning"|"critical";detail:string;safe_action:string}>={
  PRINT_NO_PAGES:{title:"لا توجد صفحات جاهزة للفحص",severity:"warning",detail:"لم يجد الفاحص صفحات طباعة مكتملة في الواجهة المستهدفة.",safe_action:"التأكد من وجود مراجعة محفوظة أو بيانات تقرير ثم إعادة الفحص."},
  PRINT_NO_REPORT:{title:"لا يوجد تقرير جاهز للفحص",severity:"warning",detail:"صفحة التقرير لم تنتج ورقة تقرير مرئية بعد.",safe_action:"اختيار الاختبار أو الفصل المطلوب ثم إعادة الفحص."},
  PRINT_SURFACE_UNKNOWN:{title:"تعذر تحديد قالب الطباعة",severity:"warning",detail:"لم يتعرف الفاحص على نوع صفحة الطباعة الحالية.",safe_action:"مراجعة ربط أداة الفحص بصفحة الطباعة المستهدفة."},
  PRINT_STRUCTURE_MISSING:{title:"بنية قالب الطباعة ناقصة",severity:"critical",detail:"حاوية أساسية يحتاجها قياس A4 غير موجودة.",safe_action:"مراجعة HTML وJavaScript للقالب قبل الطباعة."},
  PRINT_OVERFLOW:{title:"محتوى يتجاوز حدود A4",severity:"critical",detail:"قياس المتصفح وجد محتوى أطول أو أعرض من المساحة المسموحة داخل الصفحة.",safe_action:"إعادة توزيع المحتوى أو ضبط أحجام الخط والمسافات ثم إعادة القياس الفعلي."},
  PRINT_CLIPPED_ELEMENTS:{title:"عناصر تقع خارج مساحة الطباعة",severity:"critical",detail:"يوجد عنصر واحد أو أكثر يتجاوز حدود الحاوية المطبوعة.",safe_action:"إصلاح CSS أو منطق التقسيم ثم إعادة الفحص المرئي."},
  PRINT_BROKEN_CHOICES:{title:"اختيارات سؤال غير مكتملة",severity:"critical",detail:"يوجد سؤال مطبوع لا يعرض أربعة اختيارات كاملة.",safe_action:"إيقاف طباعة السؤال المتأثر حتى تكتمل الاختيارات من المصدر."},
  PRINT_BROKEN_IMAGES:{title:"صورة لم تُحمّل في ورقة الأسئلة",severity:"warning",detail:"الفاحص وجد صورة مرتبطة بالسؤال فشل تحميلها.",safe_action:"التحقق من رابط الصورة ثم إعادة الطباعة."},
  PRINT_INTERNAL_PROMPT_LEAK:{title:"عبارات داخلية ظهرت للطالب",severity:"critical",detail:"ظهرت في ورقة الطالب عبارات مخصصة لتصميم السؤال أو المراجعة وليست جزءًا من السؤال نفسه.",safe_action:"إخفاء سياق التصميم الداخلي واستبعاد أي سؤال يحتوي لغة إنشاء داخل نصه، ثم إعادة الفحص المرئي."},
  PRINT_BLANK_PAGE:{title:"صفحة طباعة فارغة",severity:"warning",detail:"تم إنشاء صفحة A4 بلا أسئلة أو محتوى فعلي.",safe_action:"حذف الصفحة الفارغة من التدفق وإعادة ترقيم الصفحات."},
  PRINT_UNDERFILLED_PAGE:{title:"صفحة غير مستغلة جيدًا",severity:"warning",detail:"المحتوى يشغل جزءًا صغيرًا من مساحة A4 رغم وجود صفحات أخرى.",safe_action:"إعادة موازنة المجموعات والأسئلة بين الصفحات مع منع القص."},
  PRINT_ORPHAN_LAST_PAGE:{title:"صفحة أخيرة ضعيفة",severity:"warning",detail:"الصفحة الأخيرة تحتوي عددًا قليلًا جدًا من الأسئلة مقارنة بالصفحة السابقة.",safe_action:"نقل مجموعة مناسبة من الصفحة السابقة إذا أثبت القياس أنها تتسع."},
  PRINT_TEXT_TOO_SMALL:{title:"خط صغير للطباعة",severity:"warning",detail:"يوجد نص أساسي بحجم منخفض قد يؤثر في وضوح النسخة الورقية.",safe_action:"رفع حجم الخط مع إعادة اختبار عدد الصفحات وعدم حدوث overflow."},
  PRINT_QR_MISSING:{title:"QR مفقود في ورقة التظليل",severity:"critical",detail:"رمز QR لم يُرسم داخل ورقة التظليل.",safe_action:"منع الطباعة حتى ينجح توليد QR لأن الربط الآلي يعتمد عليه."},
  PRINT_OMR_GRID_MISSING:{title:"شبكة OMR مفقودة",severity:"critical",detail:"منطقة تظليل الإجابات غير موجودة في الورقة.",safe_action:"منع الطباعة حتى يظهر قالب OMR الصحيح."},
  PRINT_UNBREAKABLE_LARGE_SECTION:{title:"قسم كبير قد ينقسم بشكل سيئ",severity:"warning",detail:"يوجد قسم كبير مع قواعد تمنع الانقسام وقد ينتقل أو يترك فراغًا كبيرًا.",safe_action:"تخفيف break-inside على الحاوية الكبيرة مع إبقائه على الصفوف والعناصر الصغيرة."}
};
function sanitizedPrintAudit(raw:any){
  const source=tidy(raw?.source,40);
  if(!PRINT_SOURCES[source])throw Object.assign(new Error("نوع فحص الطباعة غير مدعوم."),{status:400});
  const incoming=Array.isArray(raw?.issues)?raw.issues.slice(0,100):[];
  const findings:Finding[]=[];
  for(const x of incoming){
    const code=tidy(x?.code,80),def=PRINT_CODES[code];
    if(!def)continue;
    const page=Math.max(0,Math.min(500,Math.trunc(num(x?.page))));
    const metric=(x&&typeof x.metric==="object"&&x.metric)?x.metric:{};
    const f:any={code,area:"printing",severity:def.severity,title:def.title+(page?" — صفحة "+page:""),detail:def.detail,safe_action:def.safe_action,auto_apply:false,source,source_files:PRINT_SOURCES[source].files,page,metric};
    findings.push(f);
  }
  const summaryRaw=raw?.summary&&typeof raw.summary==="object"?raw.summary:{};
  const metrics={
    source,
    source_label:PRINT_SOURCES[source].label,
    page_count:Math.max(0,Math.min(5000,Math.trunc(num(summaryRaw.pages)))),
    issue_count:findings.length,
    audit_version:tidy(raw?.version||"visual-print-audit-v1",60),
    privacy:{contains_student_names:false,contains_student_ids:false,contains_teacher_keys:false,raw_text_collected:false}
  };
  return{source,findings,metrics};
}


type HandoffRow={
  id:string;owner_id:string;run_id:string;area:string;source:string|null;status:string;
  summary:string;findings:any[];source_files:string[];verification:any;fix:any;
  created_at:string;updated_at:string;verified_at:string|null;
};
function handoffFiles(findings:any[]){
  return [...new Set((findings||[]).flatMap((f:any)=>Array.isArray(f?.source_files)?f.source_files:[]).map((x:any)=>tidy(x,240)).filter(Boolean))].slice(0,30);
}
async function createHandoff(owner:any,runId:string){
  const {data:run,error:runError}=await db.from("maintenance_agent_runs")
    .select("id,run_type,summary,findings,metrics,created_at")
    .eq("id",runId).eq("owner_id",owner.id).maybeSingle();
  if(runError)throw runError;
  if(!run)throw Object.assign(new Error("الفحص غير موجود."),{status:404});
  const findings=Array.isArray(run.findings)?run.findings:[];
  if(!findings.length&&run.run_type!=="questions")throw Object.assign(new Error("لا توجد أخطاء تحتاج تسليمًا للمساعد."),{status:400});
  const source=tidy(run.metrics?.source||findings[0]?.source,50)||null;
  const area=run.run_type==="printing"?"printing":run.run_type==="questions"?"question_quality":tidy(findings[0]?.area,40)||"runtime";
  const payload={
    owner_id:owner.id,run_id:run.id,area,source,status:"needs_assistant",
    summary:tidy(run.summary,500),findings,source_files:handoffFiles(findings),
    verification:{before_run_id:run.id,before_issue_count:findings.length,before_critical_count:findings.filter((x:any)=>x?.severity==="critical").length},
    fix:{},contains_personal_data:false,updated_at:new Date().toISOString()
  };
  const {data,error}=await db.from("maintenance_agent_handoffs").upsert(payload,{onConflict:"owner_id,run_id"})
    .select("id,run_id,area,source,status,summary,findings,source_files,verification,fix,created_at,updated_at,verified_at").single();
  if(error)throw error;
  return data as HandoffRow;
}
async function listHandoffs(owner:any){
  const {data,error}=await db.from("maintenance_agent_handoffs")
    .select("id,run_id,area,source,status,summary,source_files,verification,fix,created_at,updated_at,verified_at")
    .eq("owner_id",owner.id).order("updated_at",{ascending:false}).limit(30);
  if(error)throw error;
  return (data||[]) as HandoffRow[];
}
async function verifyHandoff(owner:any,handoffId:string,run:any){
  if(!/^[0-9a-f-]{36}$/i.test(handoffId))throw Object.assign(new Error("معرّف التسليم غير صالح."),{status:400});
  const {data:h,error}=await db.from("maintenance_agent_handoffs")
    .select("id,run_id,area,source,status,summary,findings,source_files,verification,fix,created_at,updated_at,verified_at")
    .eq("id",handoffId).eq("owner_id",owner.id).maybeSingle();
  if(error)throw error;
  if(!h)throw Object.assign(new Error("طلب التسليم غير موجود."),{status:404});
  const findings=Array.isArray(run?.findings)?run.findings:[];
  const critical=findings.filter((x:any)=>x?.severity==="critical").length;
  const beforeCodes=new Set((Array.isArray(h.findings)?h.findings:[]).map((x:any)=>String(x?.code||"")));
  const remainingTarget=findings.filter((x:any)=>beforeCodes.has(String(x?.code||"")));
  const verified=critical===0&&remainingTarget.length===0;
  const verification={
    ...(h.verification||{}),after_run_id:run.id,after_issue_count:findings.length,
    after_critical_count:critical,remaining_target_issue_count:remainingTarget.length,
    checked_at:new Date().toISOString(),result:verified?"passed":"failed"
  };
  const status=verified?"verified":"verification_failed";
  const {data:updated,error:updateError}=await db.from("maintenance_agent_handoffs")
    .update({status,verification,verified_at:verified?new Date().toISOString():null,updated_at:new Date().toISOString()})
    .eq("id",handoffId).eq("owner_id",owner.id)
    .select("id,run_id,area,source,status,summary,source_files,verification,fix,created_at,updated_at,verified_at").single();
  if(updateError)throw updateError;
  return updated;
}


type AuditQuestion={
  id:string;subject_key:string;outcome_code?:string;indicator_index?:number;indicator_key?:string;indicator_text?:string;
  context_text?:string|null;question_text?:string|null;options?:any;correct_index?:number;cognitive_level?:string|null;
  quality_status?:string|null;quality_version?:string|null;review_status?:string|null;alignment_verified?:boolean|null;image?:any;
};
type IndicatorAuditRow={
  key:string;subject:string;indicator_text:string;total:number;
  levels:{knowledge:number;application:number;reasoning:number;other:number};
  prompt_context:number;prompt_stem:number;invalid_options:number;invalid_correct:number;
  missing_reading_context:number;exact_duplicate_groups:number;template_family_groups:number;
  low_alignment_rows:number;samples:any[];
};
const AUDIT_INTERNAL_CONTEXT=/^(?:موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|مهمة تقويمية جديدة|مراجعة الحل)/;
const AUDIT_INTERNAL_STEM=/(?:موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|وردت في سجل الأمثلة المهمة|المهمة المسجلة في (?:ملخص القواعد|مخطط المراجعة)|وردت في مخطط المراجعة المهمة|ظهرت المهمة|أي خيار يطبق المفهوم تطبيقًا صحيحًا|لتمييز المعرفة المرتبطة|ضمن مقارنة النتيجة ببديل قريب|باستخدام مقارنة النتيجة ببديل قريب|باستخدام كشف الافتراض الذي أدى إلى الخطأ|بعد كشف الافتراض الذي أدى إلى الخطأ|عند كشف الافتراض الذي أدى إلى الخطأ|أي تصحيح يجمع النتيجة السليمة ودليلها|أي تحليل يكشف الخطأ ويبرر البديل|أي تفسير يطابق النتيجة الصحيحة|في (?:مخطط لعلاقة بين متغيرين|مقارنة حالتين فيزيائيتين|مقارنة كائنين أو خليتين|تقويم إجراء صحي أو بيئي|تحليل تغير في نظام حيوي|اختيار إجراء مختبري|مقارنة عينتين ماديتين|تقويم تصميم تقني|تقويم قرار بيئي|خريطة ميدانية|سجل رصد طويل المدى|مقارنة موقعين) بهدف|بعد أن (?:أجريت محاكاة رقمية|عُرضت بيانات نشاط|حُدد طول مسار|قورنت كتل مواد))/;
function auditStudentQuestion(subject:string,text:string,level:string){
  if(!(subject==="math"||subject==="science"))return text;
  if(!AUDIT_INTERNAL_STEM.test(text))return text;
  const matches=[...text.matchAll(/«([^»]+)»/g)].map(m=>String(m[1]||"").trim()).filter(Boolean);
  if(level==="knowledge"||level==="application"){
    const task=matches.length?matches[matches.length-1]:"";
    if(task.length<4)return text;
    return /[؟?!.]$/.test(task)?task:task+"؟";
  }
  if(level==="reasoning"&&matches.length>=2){
    const result=matches[0],task=matches[matches.length-1];
    if(/أي تحليل يكشف الخطأ ويبرر البديل/.test(text))return "في السؤال «"+task+"»، اختار طالب «"+result+"». أي تحليل يوضح الخطأ ويبرر البديل الصحيح؟";
    if(/أي تصحيح يجمع النتيجة السليمة ودليلها/.test(text))return "في السؤال «"+task+"»، كانت الإجابة «"+result+"». أي خيار يصحح الإجابة ويذكر دليلًا مناسبًا؟";
    if(/أي تفسير يطابق النتيجة الصحيحة/.test(text))return "في السؤال «"+task+"»، كانت الإجابة المقترحة «"+result+"». أي تفسير يدعم الإجابة الصحيحة؟";
    if(/أي حكم مدعوم/.test(text))return "في السؤال «"+task+"»، قورنت المعطيات بالإجابة «"+result+"». أي حكم تدعمه المعطيات؟";
  }
  return text;
}
function auditNorm(v:unknown){
  return String(v??"").normalize("NFKC").toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g,"")
    .replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/[؟?!.،,:؛;'"“”‘’()\[\]{}\-–—_/\\]+/g," ")
    .replace(/\s+/g," ").trim();
}
function auditFamily(v:unknown){
  return auditNorm(v).replace(/[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?/g,"#")
    .replace(/\b(طالب|طالبة|باحث|باحثة|معلم|معلمة)\b/g,"شخص")
    .split(" ").slice(0,9).join(" ");
}
function auditIndicatorKey(q:AuditQuestion){
  return tidy(q.indicator_key,160)||[tidy(q.subject_key,20),tidy(q.outcome_code,80),"i"+Math.trunc(num(q.indicator_index))].join(":");
}
function newIndicatorAudit(q:AuditQuestion,key:string):IndicatorAuditRow{
  return{key,subject:tidy(q.subject_key,20),indicator_text:tidy(q.indicator_text,500),total:0,
    levels:{knowledge:0,application:0,reasoning:0,other:0},
    prompt_context:0,prompt_stem:0,invalid_options:0,invalid_correct:0,missing_reading_context:0,
    exact_duplicate_groups:0,template_family_groups:0,low_alignment_rows:0,samples:[]};
}
function addAuditSample(row:IndicatorAuditRow,q:AuditQuestion,code:string){
  if(row.samples.length>=12)return;
  row.samples.push({id:tidy(q.id,80),code,question:tidy(q.question_text,170),context:tidy(q.context_text,120)});
}
async function fetchAuditRows(){
  const out:AuditQuestion[]=[];
  for(let start=0;;start+=1000){
    const {data,error}=await db.from("nafes_question_bank")
      .select("id,subject_key,outcome_code,indicator_index,indicator_text,context_text,question_text,options,correct_index,cognitive_level,review_status,alignment_verified")
      .eq("grade_key","middle_3").eq("subject_key","reading").eq("is_active",true).eq("review_status","approved")
      .order("id",{ascending:true}).range(start,start+999);
    if(error)throw error;
    out.push(...((data||[]) as AuditQuestion[]));
    if(!data||data.length<1000)break;
  }
  for(const subject of ["math","science"]){
    const version=subject==="math"?"math-curated-v4":"science-curated-v4";
    for(let start=0;;start+=1000){
      const {data,error}=await db.from("nafes_indicator_curated_bank")
        .select("id,subject_key,outcome_code,indicator_index,indicator_key,indicator_text,context_text,question_text,options,correct_index,cognitive_level,quality_status,quality_version,image")
        .eq("subject_key",subject).eq("quality_version",version)
        .order("indicator_key",{ascending:true}).order("model_no",{ascending:true}).order("question_no",{ascending:true})
        .range(start,start+999);
      if(error)throw error;
      out.push(...((data||[]) as AuditQuestion[]));
      if(!data||data.length<1000)break;
    }
  }
  return out;
}
async function deepIndicatorAudit(){
  const rows=await fetchAuditRows();
  const indicators=new Map<string,IndicatorAuditRow>();
  const exactByIndicator=new Map<string,Map<string,number>>();
  const familyByIndicator=new Map<string,Map<string,number>>();
  const crossSubject=new Map<string,{count:number,indicators:Set<string>,subject:string}>();
  let promptContext=0,promptStem=0,invalidOptions=0,invalidCorrect=0,missingReadingContext=0,unknownLevels=0,lowAlignment=0;
  const subjectTotals:Record<string,{questions:number;indicators:Set<string>;critical_rows:number;warning_rows:number}>={
    reading:{questions:0,indicators:new Set(),critical_rows:0,warning_rows:0},
    math:{questions:0,indicators:new Set(),critical_rows:0,warning_rows:0},
    science:{questions:0,indicators:new Set(),critical_rows:0,warning_rows:0}
  };

  for(const q of rows){
    const key=auditIndicatorKey(q),subject=tidy(q.subject_key,20);
    let a=indicators.get(key);if(!a){a=newIndicatorAudit(q,key);indicators.set(key,a);}
    a.total++;subjectTotals[subject]?.indicators.add(key);if(subjectTotals[subject])subjectTotals[subject].questions++;
    const level=tidy(q.cognitive_level,30);
    if(level==="knowledge"||level==="application"||level==="reasoning")a.levels[level]++;
    else{a.levels.other++;unknownLevels++;addAuditSample(a,q,"UNKNOWN_COGNITIVE_LEVEL");}

    const ctx=String(q.context_text||"").trim(),rawQuestion=String(q.question_text||"").trim();
    const question=auditStudentQuestion(subject,rawQuestion,level);
    if((subject==="math"||subject==="science")&&AUDIT_INTERNAL_CONTEXT.test(ctx)){
      a.prompt_context++;promptContext++;
    }
    if(AUDIT_INTERNAL_STEM.test(question)){
      a.prompt_stem++;promptStem++;subjectTotals[subject].critical_rows++;
      addAuditSample(a,{...q,question_text:question},"INTERNAL_STEM");
    }
    const opts=Array.isArray(q.options)?q.options.map((x:any)=>String(x??"").trim()):[];
    if(opts.length!==4||opts.some((x:string)=>!x)||new Set(opts).size!==4){
      a.invalid_options++;invalidOptions++;subjectTotals[subject].critical_rows++;addAuditSample(a,q,"INVALID_OPTIONS");
    }
    const ci=Number(q.correct_index);
    if(!Number.isInteger(ci)||ci<0||ci>3){
      a.invalid_correct++;invalidCorrect++;subjectTotals[subject].critical_rows++;addAuditSample(a,q,"INVALID_CORRECT_INDEX");
    }
    if(subject==="reading"&&!ctx){
      a.missing_reading_context++;missingReadingContext++;subjectTotals[subject].warning_rows++;addAuditSample(a,q,"READING_CONTEXT_MISSING");
    }
    if(subject==="reading"&&q.alignment_verified===false){
      a.low_alignment_rows++;lowAlignment++;subjectTotals[subject].warning_rows++;addAuditSample(a,q,"ALIGNMENT_NOT_VERIFIED");
    }
    const n=auditNorm(question);
    if(n){
      const em=exactByIndicator.get(key)||new Map<string,number>();em.set(n,(em.get(n)||0)+1);exactByIndicator.set(key,em);
      const fam=auditFamily(question);const fm=familyByIndicator.get(key)||new Map<string,number>();fm.set(fam,(fm.get(fam)||0)+1);familyByIndicator.set(key,fm);
      const crossKey=subject+"|"+n;const c=crossSubject.get(crossKey)||{count:0,indicators:new Set<string>(),subject};c.count++;c.indicators.add(key);crossSubject.set(crossKey,c);
    }
  }

  let exactGroups=0,familyGroups=0,crossIndicatorDuplicates=0,coverageIssues=0,cognitiveCoverageIssues=0;
  for(const [key,a] of indicators){
    const exact=[...(exactByIndicator.get(key)||new Map()).values()].filter(n=>n>1).length;
    const families=[...(familyByIndicator.get(key)||new Map()).values()].filter(n=>n>2).length;
    a.exact_duplicate_groups=exact;a.template_family_groups=families;exactGroups+=exact;familyGroups+=families;
    if(a.total<30)coverageIssues++;
    if(a.levels.knowledge===0||a.levels.application===0||a.levels.reasoning===0)cognitiveCoverageIssues++;
  }
  for(const c of crossSubject.values())if(c.count>1&&c.indicators.size>1)crossIndicatorDuplicates++;

  const bySubject:any={};
  for(const subject of ["reading","math","science"]){
    const relevant=[...indicators.values()].filter(x=>x.subject===subject);
    bySubject[subject]={
      questions:subjectTotals[subject].questions,
      indicators:relevant.length,
      clean_indicators:relevant.filter(x=>x.prompt_stem+x.invalid_options+x.invalid_correct+x.missing_reading_context+x.exact_duplicate_groups+x.template_family_groups===0).length,
      indicators_with_critical:relevant.filter(x=>x.prompt_stem+x.invalid_options+x.invalid_correct>0).length,
      indicators_with_warnings:relevant.filter(x=>x.missing_reading_context+x.exact_duplicate_groups+x.template_family_groups+x.low_alignment_rows>0).length
    };
  }

  const findings:any[]=[];
  const add=(code:string,severity:"info"|"warning"|"critical",title:string,detail:string,safe_action:string,extra:any={})=>
    findings.push({code,area:"question_quality",severity,title,detail,safe_action,auto_apply:false,
      source:"indicator_audit",source_files:["supabase/functions/nafes-exam/assessments.ts"],...extra});
  if(promptStem>0)add("INDICATOR_INTERNAL_PROMPT_LEAK","critical","عبارات تصميم داخلية في نص أسئلة المؤشرات",
    "اكتشف الفحص "+promptStem+" سؤالًا يحتوي لغة تصميم أو مراجعة يمكن أن تظهر للطالب.",
    "استبعاد هذه الصياغات من الاختبارات الجديدة مع إبقاء السجلات التاريخية.",{count:promptStem});
  if(promptContext>0)add("INDICATOR_INTERNAL_CONTEXT_HIDDEN","info","سياقات داخلية قديمة مخفية عن الطالب",
    "يوجد "+promptContext+" سياقًا داخليًا محفوظًا كبيانات تاريخية في الرياضيات والعلوم، وطبقة العرض الحالية تحجبه عن الطالب.",
    "لا يلزم حذفها تاريخيًا؛ يستمر الفاحص في التأكد من أن العرض لا يكشفها.",{count:promptContext});
  if(invalidOptions+invalidCorrect>0)add("INDICATOR_INVALID_STRUCTURE","critical","أسئلة ببنية اختيار من متعدد غير صالحة",
    "اكتشف الفحص "+(invalidOptions+invalidCorrect)+" خللًا في عدد البدائل أو مؤشر الإجابة الصحيحة.",
    "منع السؤال المتأثر من الاختبارات الجديدة حتى اكتمال أربعة بدائل وإجابة صحيحة واحدة.",{count:invalidOptions+invalidCorrect});
  if(exactGroups>0||crossIndicatorDuplicates>0)add("INDICATOR_DUPLICATES","warning","تكرار حرفي في أسئلة المؤشرات",
    "اكتشف الفحص "+exactGroups+" مجموعة تكرار داخل المؤشر و"+crossIndicatorDuplicates+" تكرارًا يمتد بين مؤشرات مختلفة.",
    "الإبقاء على السجل التاريخي مع منع النسخ المتكررة من التحديد في النماذج الجديدة.",{within_indicator:exactGroups,cross_indicator:crossIndicatorDuplicates});
  if(familyGroups>0)add("INDICATOR_TEMPLATE_REPETITION","warning","عائلات صياغية متكررة",
    "اكتشف الفحص "+familyGroups+" عائلة صياغية تكررت أكثر من ثلاث مرات داخل المؤشر.",
    "مراجعة العينات دلاليًا وتنويع المواقف والمطلوب دون تغيير مستوى القياس.",{count:familyGroups});
  if(missingReadingContext>0)add("INDICATOR_READING_CONTEXT_MISSING","warning","أسئلة قراءة بلا نص مرتبط",
    "اكتشف الفحص "+missingReadingContext+" سؤال قراءة معتمدًا بلا سياق نصي.",
    "مراجعة هذه الأسئلة قبل استخدامها في نمط «نص ثم خمسة أسئلة».",{count:missingReadingContext});
  if(coverageIssues>0)add("INDICATOR_BANK_COVERAGE","warning","مؤشرات بأقل من 30 سؤالًا",
    "يوجد "+coverageIssues+" مؤشرًا بعدد أقل من 30 سؤالًا في البنك المستخدم حاليًا.",
    "استكمال البنك قبل الاعتماد على تنويع النماذج.",{count:coverageIssues});
  if(cognitiveCoverageIssues>0||unknownLevels>0)add("INDICATOR_COGNITIVE_COVERAGE","warning","تغطية المستويات المعرفية تحتاج مراجعة",
    "يوجد "+cognitiveCoverageIssues+" مؤشرًا لا يظهر فيه أحد مستويات المعرفة/التطبيق/الاستدلال، و"+unknownLevels+" سؤالًا بمستوى غير معروف.",
    "إعادة تحكيم التصنيف المعرفي للأسئلة المتأثرة.",{indicators:cognitiveCoverageIssues,unknown_rows:unknownLevels});
  if(lowAlignment>0)add("INDICATOR_ALIGNMENT_NOT_VERIFIED","warning","أسئلة قراءة بلا توثيق محاذاة مكتمل",
    "يوجد "+lowAlignment+" سؤال قراءة معتمدًا لكن علامة alignment_verified ليست صحيحة.",
    "مراجعة مطابقة السؤال للمؤشر قبل الاستمرار في استخدامه.",{count:lowAlignment});
  add("INDICATOR_SEMANTIC_REVIEW_REQUIRED","info","التقرير يحتاج مراجعة دلالية من المساعد",
    "الفحص الآلي راجع جميع الصفوف المستخدمة فعليًا، لكنه لا يدّعي أن المطابقة الدلالية للمؤشر يمكن إثباتها بالأنماط وحدها.",
    "يُسلَّم التقرير والعينات للمساعد لمراجعة الصياغة والمطابقة للمؤشر في الحالات الأعلى خطورة.");

  const indicatorResults=[...indicators.values()].sort((a,b)=>a.subject.localeCompare(b.subject)||a.key.localeCompare(b.key)).map(a=>({
    key:a.key,subject:a.subject,indicator_text:a.indicator_text,total:a.total,levels:a.levels,
    issues:{prompt_context:a.prompt_context,prompt_stem:a.prompt_stem,invalid_options:a.invalid_options,
      invalid_correct:a.invalid_correct,missing_reading_context:a.missing_reading_context,
      exact_duplicate_groups:a.exact_duplicate_groups,template_family_groups:a.template_family_groups,
      alignment_not_verified:a.low_alignment_rows},
    samples:a.samples
  }));
  return{
    findings,
    metrics:{
      source:"indicator_audit",audit_version:"indicator-audit-v1",generated_at:new Date().toISOString(),
      total_questions:rows.length,total_indicators:indicators.size,subjects:bySubject,
      totals:{prompt_context:promptContext,prompt_stem:promptStem,invalid_options:invalidOptions,invalid_correct:invalidCorrect,
        exact_duplicate_groups:exactGroups,cross_indicator_duplicates:crossIndicatorDuplicates,template_family_groups:familyGroups,
        missing_reading_context:missingReadingContext,unknown_cognitive_rows:unknownLevels,alignment_not_verified:lowAlignment,
        indicators_below_30:coverageIssues,indicators_missing_cognitive_level:cognitiveCoverageIssues},
      indicator_results:indicatorResults,
      privacy:{contains_student_names:false,contains_student_ids:false,contains_teacher_keys:false,student_attempts_read:false}
    }
  };
}

type KnowledgeRow={
  id:string;category:string;module:string;title:string;summary:string;details:any;
  keywords:string[];source_paths:string[];priority:number;active:boolean;
};
function knowledgeScore(row:KnowledgeRow,q:string,qTokens:string[]){
  const hay=normAr([row.title,row.summary,row.module,row.category,...(row.keywords||[])].join(" "));
  let score=Math.max(0,Number(row.priority||50)/100);
  for(const t of qTokens){
    if(hay.includes(t))score+=3;
    if(normAr(row.title).includes(t))score+=2;
    if((row.keywords||[]).some(k=>normAr(k).includes(t)||t.includes(normAr(k))))score+=2;
  }
  const aliases:Record<string,string[]>={
    question_quality:["سؤال","اسئله","صياغه","مؤشر","تكرار","مشتت","استدلال","معرفه","تطبيق"],
    omr:["omr","تظليل","تصحيح","ورق","رفع","مسح","اعتماد"],
    printing:["طباعه","a4","صفحه","فراغ"],
    database:["rls","قاعده","supabase","جداول","امان"],
    deployment:["github","فرع","main","نشر","دمج"],
    accounts:["حساب","معلم","صلاحيات","مفتاح","دخول"],
    tests:["اختبار","مؤشر","نموذج","انشاء"],
    analysis:["تحليل","تقرير","نتائج"]
  };
  for(const [module,words] of Object.entries(aliases)){
    if(row.module===module&&words.some(w=>q.includes(normAr(w))))score+=4;
  }
  return score;
}
function platformAnswer(question:string,rows:KnowledgeRow[],snapshot:any){
  const q=normAr(question),qt=tokens(question);
  const ranked=rows.map(row=>({row,score:knowledgeScore(row,q,qt)})).sort((a,b)=>b.score-a.score);
  const matched=ranked.filter(x=>x.score>=3.5).slice(0,6).map(x=>x.row);
  const fallback=ranked.slice(0,4).map(x=>x.row);
  const picked=matched.length?matched:fallback;
  const sec=snapshot?.database_security||{},paper=snapshot?.paper_review||{};
  const parts:string[]=[];
  const asksCurrent=/الان|حاليا|الحالي|اخطر|مشكله|حاله/.test(q);
  const asksHow=/كيف|مسار|يعمل|طريقه/.test(q);
  const asksWhy=/لماذا|سبب|ليش/.test(q);

  if(asksCurrent&&hasNumber(sec.rls_disabled_public_count)&&num(sec.rls_disabled_public_count)>0){
    parts.push("الحالة الحالية التي تحتاج انتباهًا هي أمان قاعدة البيانات: يوجد "+num(sec.rls_disabled_public_count)+" جداول عامة بلا RLS. الوكيل لا يفعّل الحماية تلقائيًا لأن ذلك قد يعطل المسارات الحية قبل فحص الاستخدام.");
  }
  if(/omr|تظليل|تصحيح ورقي|ورقي/.test(q)&&num(paper.saved_reviews)>0&&num(paper.approved_attempts)===0){
    parts.push("في OMR لديك مراجعة ورقية محفوظة، ولا توجد نتائج معتمدة بعد. هذا طبيعي ما لم تكن قد ضغطت «اعتماد النتائج» بعد رفع الأوراق.");
  }
  if(picked.length){
    if(asksHow)parts.push("المسار الموثق في المنصة هو: "+picked.map(x=>x.summary).join(" ثم "));
    else if(asksWhy)parts.push(picked.map(x=>x.summary).join(" "));
    else parts.push(picked.map(x=>x.summary).join(" "));
  }else{
    parts.push("لا أملك معلومة موثقة كافية عن هذا الجزء بعد. أستطيع الإجابة بثقة أعلى عن الاختبارات، بنوك الأسئلة، جودة الصياغة، OMR، التحليل، الطباعة، الحسابات، GitHub وSupabase.");
  }
  const unique=[...new Set(parts)].join("\n\n");
  const sources=[...new Set(picked.flatMap(x=>x.source_paths||[]))].slice(0,10);
  const confidence=matched.length>=3?"high":matched.length?"medium":"low";
  return{
    answer:unique,
    confidence,
    matched: picked.map(x=>({id:x.id,module:x.module,title:x.title,summary:x.summary})),
    sources,
    current_state:{
      rls_disabled_public_count:hasNumber(sec.rls_disabled_public_count)?num(sec.rls_disabled_public_count):null,
      saved_paper_reviews:num(paper.saved_reviews),
      approved_paper_attempts:num(paper.approved_attempts)
    },
    followups:[
      "اشرح لي مسار هذا الجزء خطوة بخطوة",
      "ما الملفات والجداول المرتبطة به؟",
      "ما المخاطر قبل أن نعدله؟"
    ]
  };
}
async function brainKnowledge(){
  const {data,error}=await db.from("maintenance_agent_knowledge")
    .select("id,category,module,title,summary,details,keywords,source_paths,priority,active")
    .eq("active",true).order("priority",{ascending:false});
  if(error)throw error;
  return (data||[]) as KnowledgeRow[];
}
async function safeSnapshot(){
  const {data,error}=await db.rpc("maintenance_agent_snapshot");
  if(error)throw error;
  return data||{};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  try{
    const owner=await master(req);
    const b=await req.json().catch(()=>({}));
    const action=tidy(b.action,50)||"diagnose";

    if(action==="brain_overview"){
      const rows=await brainKnowledge();
      const modules=new Map<string,{module:string,count:number,titles:string[]}>();
      for(const row of rows){
        const x=modules.get(row.module)||{module:row.module,count:0,titles:[]};
        x.count++;x.titles.push(row.title);modules.set(row.module,x);
      }
      return json({ok:true,version:"platform-brain-v1",knowledge_count:rows.length,modules:[...modules.values()],privacy:{stores_chat:false,contains_personal_data:false,external_ai:false}});
    }

    if(action==="ask_platform"){
      const question=tidy(b.question,700);
      if(question.length<2)return json({error:"اكتب سؤالك عن المنصة."},400);
      const [rows,snapshot]=await Promise.all([brainKnowledge(),safeSnapshot()]);
      return json({ok:true,version:"platform-brain-v1",...platformAnswer(question,rows,snapshot),privacy:{stored:false,external_ai:false,student_data_used:false}});
    }

    if(action==="print_audit_ingest"){
      const audit=sanitizedPrintAudit(b.audit||{});
      const severity=audit.findings.length?overall(audit.findings):"ok";
      const summary=audit.findings.length
        ?"فحص "+PRINT_SOURCES[audit.source].label+": "+audit.findings.length+" ملاحظة طباعة ("+audit.findings.filter(x=>x.severity==="critical").length+" حرجة)."
        :"فحص "+PRINT_SOURCES[audit.source].label+": لم يكتشف الفاحص مشكلات تخطيط.";
      const {data:run,error}=await db.from("maintenance_agent_runs").insert({
        owner_id:owner.id,run_type:"printing",status:"completed",severity,summary,
        findings:audit.findings,metrics:audit.metrics,contains_personal_data:false
      }).select("id,run_type,status,severity,summary,findings,metrics,created_at").single();
      if(error)throw error;
      let handoff=null;
      const handoffId=tidy(b.handoff_id,80);
      if(handoffId)handoff=await verifyHandoff(owner,handoffId,run);
      return json({ok:true,run,handoff,mode:"visual_print_audit"});
    }


    if(action==="create_handoff"){
      const runId=tidy(b.run_id,80);
      if(!/^[0-9a-f-]{36}$/i.test(runId))return json({error:"معرّف الفحص غير صالح."},400);
      const handoff=await createHandoff(owner,runId);
      return json({ok:true,handoff,message:"تم تجهيز تقرير التسليم للمساعد. لا يحتوي بيانات طلاب أو مفاتيح."});
    }

    if(action==="handoffs"){
      const handoffs=await listHandoffs(owner);
      return json({ok:true,handoffs});
    }


    if(action==="indicator_audit"){
      const audit=await deepIndicatorAudit();
      const severity=audit.findings.length?overall(audit.findings as Finding[]):"ok";
      const critical=audit.findings.filter((x:any)=>x.severity==="critical").length;
      const warning=audit.findings.filter((x:any)=>x.severity==="warning").length;
      const summary="فحص جميع اختبارات المؤشرات: "+audit.metrics.total_indicators+" مؤشرًا و"+audit.metrics.total_questions+" سؤالًا؛ "+critical+" أنواع أخطاء حرجة و"+warning+" أنواع تحذيرات.";
      const {indicator_results,...compactMetrics}=audit.metrics as any;
      const {data:run,error}=await db.from("maintenance_agent_runs").insert({
        owner_id:owner.id,run_type:"questions",status:"completed",severity,summary,
        findings:audit.findings,metrics:compactMetrics,contains_personal_data:false
      }).select("id,run_type,status,severity,summary,findings,metrics,created_at").single();
      if(error)throw error;
      const details=(indicator_results||[]).map((x:any)=>({
        run_id:run.id,owner_id:owner.id,subject:x.subject,indicator_key:x.key,indicator_text:x.indicator_text||"",
        question_count:x.total,levels:x.levels||{},issues:x.issues||{},samples:x.samples||[],contains_personal_data:false
      }));
      for(let i=0;i<details.length;i+=100){
        const {error:detailError}=await db.from("maintenance_agent_indicator_reports").insert(details.slice(i,i+100));
        if(detailError)throw detailError;
      }
      const handoff=await createHandoff(owner,run.id);
      return json({ok:true,run,handoff,mode:"deep_indicator_audit"});
    }

    if(action==="diagnose"){
      const snapshot=await safeSnapshot();
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
      const rows=(Array.isArray(run.findings)?run.findings:[]).map((f:Finding)=>proposalFor(f,runId,owner.id)).filter(Boolean);
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
