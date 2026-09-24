import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINS=new Set(["https://zarie19991-bit.github.io","http://localhost:8000","http://127.0.0.1:8000","http://localhost:5500","http://127.0.0.1:5500","https://skyblue-cheetah-940953.hostingersite.com"]);
const tidy=(v:unknown)=>String(v??"").trim();
function cors(req:Request){const o=req.headers.get("origin")||"";return{"Access-Control-Allow-Origin":ORIGINS.has(o)?o:"https://zarie19991-bit.github.io","Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"}}
const json=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors(req)});
async function sha256(v:string){const x=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(x)).map(n=>n.toString(16).padStart(2,"0")).join("")}
type SubjectScope="all"|"reading"|"math"|"science";
type Access={role:"teacher"|"student";student_id?:string;teacher_access_id?:string;subject_scope?:SubjectScope;is_demo?:boolean};
const teacherScope=(a:Access):SubjectScope=>a.role==="teacher"?(a.subject_scope||"all"):"all";
const teacherAllows=(a:Access,s:unknown)=>a.role!=="teacher"||teacherScope(a)==="all"||teacherScope(a)===tidy(s);
async function access(req:Request):Promise<Access>{
 const h=tidy(req.headers.get("authorization")),token=h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";
 if(!token)throw Object.assign(new Error("تسجيل الدخول مطلوب."),{status:401});
 const {data:s,error}=await db.from("lugati_sessions").select("role,student_id,teacher_access_id").eq("token_hash",await sha256(token)).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error)throw error;if(!s)throw Object.assign(new Error("انتهت جلسة الدخول أو أصبحت غير صالحة."),{status:401});
 if(s.role==="student"){
  const {data:u,error:e}=await db.from("nafes_students").select("id,is_demo").eq("id",s.student_id).eq("is_active",true).maybeSingle();
  if(e)throw e;if(!u)throw Object.assign(new Error("حساب الطالب غير متاح."),{status:401});
  return{role:"student",student_id:String(u.id),is_demo:u.is_demo===true};
 }
 const {data:t,error:e}=await db.from("nafes_teacher_access").select("id,subject_scope").eq("id",s.teacher_access_id).eq("active",true).maybeSingle();
 if(e)throw e;if(!t)throw Object.assign(new Error("حساب المعلم غير متاح."),{status:401});
 return{role:"teacher",teacher_access_id:String(t.id),subject_scope:(["reading","math","science"].includes(String(t.subject_scope))?String(t.subject_scope):"all") as SubjectScope};
}
async function demoStudentIds(){const {data,error}=await db.from("nafes_students").select("id").eq("is_active",true).eq("is_demo",true);if(error)throw error;return new Set((data||[]).map((x:any)=>String(x.id)))}

function same(a:any,b:any){return JSON.stringify(a)===JSON.stringify(b)}
function globalNo(outcome:string,idx:number){return outcome.startsWith("1-")?idx:outcome.startsWith("2-")?5+idx:outcome.startsWith("3-")?10+idx:idx}
function cleanText(v:any){
 let s=String(v??"").replace(/\s+/g," ").trim();
 s=s.replace(/^في تدريب الإنقاذ،\s*/,"").replace(/^في التحدي الإثرائي،\s*/,"").replace(/^وفق المعطيات الجديدة،\s*/,"");
 s=s.replace(/([\p{Script=Arabic}])(\d)/gu,"$1 $2").replace(/(\d)([\p{Script=Arabic}])/gu,"$1 $2");
 return s;
}
function cleanData(d:any){
 if(!d||typeof d!=="object")return d;
 const x={...d};
 for(const k of ["options","left","right","items","categories"])if(Array.isArray(x[k]))x[k]=x[k].map((v:any)=>cleanText(v));
 return x;
}
function cleanPrompt(v:any){
 let s=cleanText(v);
 const m:any={
  "اختر الأدق.":"أي خيار من الآتي يطابق المعطيات بدقة؟",
  "ما التصحيح؟":"أي تصحيح يعالج الخطأ السابق؟",
  "ما الناتج؟":"ما الناتج الصحيح وفق المعطيات؟",
  "أي تفسير علمي أدق؟":"أي تفسير علمي يفسر المعطيات بصورة أدق؟",
  "كيف تصنف؟":"كيف يُصنَّف المثال وفق المفهوم المطلوب؟"
 };
 return m[s]||s;
}
function lowValue(i:any){
 const p=cleanText(i?.prompt);
 return /أي وصف يعبّر بدقة عن المهارة|أي وصف يبين ما الذي يجب أن تتقنه|أي سؤال من الآتي يرتبط مباشرة بهذا المؤشر|أي صيغة سؤال تقيس هذا المؤشر بصورة مباشرة|أي علامة في السؤال تساعدك أكثر/.test(p);
}
function coreSubject(t:any){return t?.subject_key==="math"||t?.subject_key==="science"}
function visibleItem(t:any,i:any,stage:string){
 if(lowValue(i))return false;
 if(!coreSubject(t))return true;
 const n=Number(i?.order_no||0);
 if(stage==="guided")return n===1||n===2;
 if(stage==="challenge")return [10,11,12,13,14].includes(n);
 if(stage==="rescue")return false;
 return true;
}
function publicItem(i:any,obj?:{prompt:string;options:string[]}){
 return{
  id:i.id,source_id:i.source_id||null,idea_no:i.idea_no,order_no:i.order_no,activity_type:i.activity_type,
  idea_title:cleanText(i.idea_title),stimulus:cleanText(i.stimulus),prompt:cleanPrompt(i.prompt),
  activity_data:cleanData(i.activity_data),
  objective_prompt:obj?.prompt||cleanText(i.objective_prompt),
  objective_options:obj?.options||((Array.isArray(i.objective_options)?i.objective_options:[]).map((v:any)=>cleanText(v))),
  stage:i.stage,difficulty_label:i.difficulty_label,cognitive_level:i.cognitive_level,
  question_form:cleanText(i.question_form),transfer_focus:cleanText(i.transfer_focus)
 }
}
function virtualRescueItems(t:any,items:any[],responses:any){
 const byLevel=new Map<string,any>();
 for(const i of items){
   const rr=responses?.[i.id];
   if(rr?.correct===true)continue;
   const lv=String(i.cognitive_level||"application");
   if(byLevel.has(lv))continue;
   const opts=Array.isArray(i.activity_data?.options)?i.activity_data.options:[];
   const ci=Number(i.correct_answer?.index),si=Number(rr?.activity_answer?.index);
   let stim="",prompt="",ans={index:1};
   if(lv==="knowledge"){
     stim=cleanText(i.explanation)||cleanText(i.stimulus);
     prompt="بعد المراجعة: هل القاعدة السابقة صحيحة؟";
     ans={index:0};
   }else if(opts.length&&Number.isInteger(ci)){
     let wi=Number.isInteger(si)&&si>=0&&si<opts.length&&si!==ci?si:opts.findIndex((_:any,k:number)=>k!==ci);
     if(wi<0)wi=0;
     stim=[cleanText(i.stimulus),opts[wi]?("الإجابة التي تحتاج مراجعة: «"+cleanText(opts[wi])+"»."):""].filter(Boolean).join(" ");
     prompt="بعد مراجعة السبب، هل هذا الاختيار صحيح وفق المعطيات؟";
   }else{
     stim=cleanText(i.explanation)||cleanText(i.stimulus);
     prompt="بعد المراجعة، هل القاعدة السابقة تتفق مع المؤشر؟";
     ans={index:0};
   }
   byLevel.set(lv,{
     id:"vr:"+i.id,idea_no:99,order_no:100+byLevel.size,activity_type:"true_false",
     idea_title:"سؤال الإنقاذ",stimulus:stim,prompt:prompt,
     activity_data:{options:["صحيح","خطأ"]},correct_answer:ans,
     feedback_correct:"أحسنت؛ عالجت نقطة التعثر وربطت الحكم بالدليل.",
     feedback_wrong:cleanText(i.explanation)||"ارجع إلى سبب الإجابة الصحيحة ثم حاول مرة أخرى.",
     hint:cleanText(i.explanation),explanation:cleanText(i.explanation),
     objective_prompt:"",objective_options:[],stage:"rescue",
     difficulty_label:"علاجي",cognitive_level:lv,question_form:"علاج خطأ فعلي",transfer_focus:"تصحيح سبب الخطأ"
   });
 }
 return [...byLevel.values()];
}
async function objectivePool(t:any){
 const {data,error}=await db.from("lugati_pretest_templates")
   .select("id,outcome_code,display_index,indicator_text")
   .eq("subject_key",t.subject_key).eq("is_active",true).eq("quality_passed",true).neq("id",t.id).limit(30);
 if(error)throw error;
 return (data||[]).sort((a:any,b:any)=>{
   const ao=a.outcome_code===t.outcome_code?0:1,bo=b.outcome_code===t.outcome_code?0:1;
   if(ao!==bo)return ao-bo;
   return Math.abs(Number(a.display_index||0)-Number(t.display_index||0))-Math.abs(Number(b.display_index||0)-Number(t.display_index||0));
 }).map((x:any)=>cleanText(x.indicator_text)).filter(Boolean);
}
function objectiveFor(i:any,t:any,pool:string[]){
 const correct=cleanText(t.indicator_text),others=[...new Set(pool.filter(x=>x&&x!==correct))].slice(0,3);
 const base=[correct,...others];
 while(base.length<4)base.push(["مؤشر يقيس مهارة مختلفة عن السؤال","مؤشر يعتمد على مهارة أخرى","مؤشر لا يرتبط بالمطلوب"][base.length-1]||"مؤشر مختلف");
 const shift=Math.abs(Number(i.order_no||0))%base.length;
 return{prompt:"أي مؤشر تدربت عليه في هذه الفكرة؟",options:[...base.slice(shift),...base.slice(0,shift)]};
}
async function listTemplates(req:Request,b:any,a:Access){
 if(a.role!=="teacher")return json(req,{error:"هذه العملية للمعلم فقط."},403);
 const requested=tidy(b?.subject_key),scope=teacherScope(a);const subject=requested||(scope==="all"?"reading":scope);
 if(!["reading","math","science"].includes(subject))return json(req,{error:"المادة غير مدعومة."},400);if(!teacherAllows(a,subject))return json(req,{error:"هذه المادة خارج صلاحية حسابك."},403);
 const {data:t,error}=await db.from("lugati_pretest_templates")
   .select("id,subject_key,outcome_code,indicator_index,display_index,indicator_text,student_title,golden_rule,common_trap,challenge_minutes,ready_percent,quality_passed")
   .eq("subject_key",subject).eq("is_active",true).eq("quality_passed",true).order("display_index");
 if(error)throw error;
 const ids=(t||[]).map((x:any)=>x.id);let ds:any[]=[];
 if(ids.length){const {data,error:e}=await db.from("lugati_pretest_dispatches").select("id,template_id,sent_at,revoked_at").in("template_id",ids).order("sent_at",{ascending:false});if(e)throw e;ds=data||[]}
 const latest=new Map<string,any>();for(const d of ds)if(!latest.has(String(d.template_id))&&!d.revoked_at)latest.set(String(d.template_id),d);
 const dids=[...latest.values()].map((d:any)=>d.id),stats=new Map<string,any>();
 if(dids.length){const demos=await demoStudentIds();const {data:rows,error:e}=await db.from("lugati_pretest_student_assignments").select("dispatch_id,student_id,journey_status,current_stage,exit_passed,retention_status").in("dispatch_id",dids);if(e)throw e;for(const r of rows||[]){if(demos.has(String(r.student_id)))continue;const k=String(r.dispatch_id),s=stats.get(k)||{sent:0,in_progress:0,support:0,exit:0,ready:0,retention_review:0,total:0};s.total++;if(r.current_stage==="exit"&&r.journey_status!=="ready")s.exit++;else s[r.journey_status]=(s[r.journey_status]||0)+1;if(r.retention_status==="needs_review")s.retention_review++;stats.set(k,s)}}
 return json(req,{ok:true,subject_key:subject,templates:(t||[]).map((x:any)=>{const d=latest.get(String(x.id));return{...x,global_indicator:Number(x.display_index||globalNo(x.outcome_code,Number(x.indicator_index))),last_dispatch:d?{...d,stats:stats.get(String(d.id))||{total:0,sent:0,in_progress:0,support:0,exit:0,ready:0,retention_review:0}}:null}})});
}
async function sendAll(req:Request,b:any,a:Access){
 if(a.role!=="teacher")return json(req,{error:"هذه العملية للمعلم فقط."},403);
 const tid=tidy(b?.template_id);if(!tid)return json(req,{error:"حدد المؤشر أولًا."},400);
 const {data:gate,error:ge}=await db.rpc("lugati_validate_closed_mastery_template",{p_template_id:tid});if(ge)throw ge;
 if(!gate?.passed)return json(req,{error:"هذا المؤشر لم يجتز بوابة الإتقان المغلق، ولا يمكن إرساله."},409);
 const {data:t,error}=await db.from("lugati_pretest_templates").select("id,indicator_text,subject_key,quality_passed").eq("id",tid).eq("is_active",true).maybeSingle();
 if(error)throw error;if(!t)return json(req,{error:"المؤشر غير موجود."},404);if(!teacherAllows(a,t.subject_key))return json(req,{error:"هذا المؤشر خارج مادة حسابك."},403);
 if(!t.quality_passed)return json(req,{error:"هذا المؤشر لم يجتز بوابة الجودة، ولا يمكن إرساله للطلاب."},409);
 const demoOnly=b?.demo_only===true;
 const {data:students,error:se}=await db.from("nafes_students").select("id").eq("is_active",true).eq("is_demo",false).is("archived_at",null);if(se)throw se;if(!demoOnly&&!(students||[]).length)return json(req,{error:"لا يوجد طلاب نشطون."},409);
 const {data:demoRows,error:demoErr}=await db.from("nafes_students").select("id").eq("is_active",true).eq("is_demo",true);if(demoErr)throw demoErr;
 if(demoOnly&&!(demoRows||[]).length)return json(req,{error:"لا يوجد حساب طالب تجريبي نشط."},409);
 const {data:d,error:de}=await db.from("lugati_pretest_dispatches").insert({template_id:tid,teacher_access_id:a.teacher_access_id,target_scope:demoOnly?"demo":"all"}).select("id,sent_at").single();if(de)throw de;
 const rows=(demoOnly?[]:(students||[])).map((s:any)=>({dispatch_id:d.id,student_id:s.id,status:"new",journey_status:"sent",current_stage:"secret",response_json:{}}));
 const previewRows=(demoRows||[]).map((s:any)=>({dispatch_id:d.id,student_id:s.id,status:"new",journey_status:"sent",current_stage:"secret",response_json:{demo_preview:true,demo_only:demoOnly}}));
 const allRows=[...rows,...previewRows];
 for(let i=0;i<allRows.length;i+=500){const {error:e}=await db.from("lugati_pretest_student_assignments").insert(allRows.slice(i,i+500));if(e)throw e}
 return json(req,{ok:true,dispatch_id:d.id,sent_at:d.sent_at,students:rows.length,demo_students:previewRows.length,demo_only:demoOnly,indicator_text:t.indicator_text,subject_key:t.subject_key,demo_preview:previewRows.length>0});
}


async function sendBundle(req:Request,b:any,a:Access){
 if(a.role!=="teacher")return json(req,{error:"هذه العملية للمعلم فقط."},403);
 const tids=[...new Set((Array.isArray(b?.template_ids)?b.template_ids:[]).map((x:any)=>tidy(x)).filter(Boolean))];
 if(tids.length<2)return json(req,{error:"اختر مؤشرين على الأقل لإنشاء رحلة إتقان مدمجة."},400);
 if(tids.length>50)return json(req,{error:"الحد الأعلى للرحلة الواحدة 50 مؤشرًا حفاظًا على سرعة المنصة."},400);
 const {data:templates,error}=await db.from("lugati_pretest_templates")
   .select("id,subject_key,outcome_code,indicator_index,display_index,indicator_text,student_title,quality_passed")
   .in("id",tids).eq("is_active",true);
 if(error)throw error;
 if((templates||[]).length!==tids.length)return json(req,{error:"بعض المؤشرات المحددة غير متاحة أو غير نشطة."},409);
 const subjects=[...new Set((templates||[]).map((x:any)=>String(x.subject_key)))];
 if(subjects.length!==1)return json(req,{error:"اجمع مؤشرات من المادة نفسها داخل الرحلة الواحدة."},400);
 const subject=subjects[0];
 if(!teacherAllows(a,subject))return json(req,{error:"هذه المادة خارج صلاحية حسابك."},403);
 if((templates||[]).some((x:any)=>!x.quality_passed))return json(req,{error:"يوجد مؤشر لم يجتز بوابة الجودة، ولا يمكن إضافته للرحلة."},409);
 for(const t of templates||[]){
   const {data:gate,error:ge}=await db.rpc("lugati_validate_closed_mastery_template",{p_template_id:t.id});
   if(ge)throw ge;
   if(!gate?.passed)return json(req,{error:"المؤشر «"+cleanText(t.indicator_text)+"» لم يجتز بوابة الإتقان المغلق."},409);
 }
 const ordered=[...(templates||[])].sort((x:any,y:any)=>Number(x.display_index||x.indicator_index)-Number(y.display_index||y.indicator_index));
 const defaultTitle=(subject==="math"?"رحلة إتقان الرياضيات":subject==="science"?"رحلة إتقان العلوم":"رحلة إتقان القراءة")+" — "+ordered.length+" مؤشرات";
 const title=cleanText(b?.bundle_title||defaultTitle).slice(0,140)||defaultTitle;
 const demoOnly=b?.demo_only===true;
 const {data:students,error:se}=await db.from("nafes_students").select("id").eq("is_active",true).eq("is_demo",false).is("archived_at",null);
 if(se)throw se;if(!demoOnly&&!(students||[]).length)return json(req,{error:"لا يوجد طلاب نشطون."},409);
 const {data:demos,error:de}=await db.from("nafes_students").select("id").eq("is_active",true).eq("is_demo",true);if(de)throw de;
 if(demoOnly&&!(demos||[]).length)return json(req,{error:"لا يوجد حساب طالب تجريبي نشط."},409);
 const bundleId=crypto.randomUUID(),now=new Date().toISOString();
 const dispatchRows=ordered.map((t:any,i:number)=>({
   template_id:t.id,teacher_access_id:a.teacher_access_id,target_scope:demoOnly?"demo":"all",
   bundle_id:bundleId,bundle_title:title,bundle_order:i+1,bundle_size:ordered.length,sent_at:now
 }));
 const {data:dispatches,error:di}=await db.from("lugati_pretest_dispatches").insert(dispatchRows)
   .select("id,template_id,bundle_order,sent_at");
 if(di)throw di;
 const realStudents=demoOnly?[]:(students||[]),demoStudents=demos||[],rows:any[]=[];
 for(const d of dispatches||[]){
   for(const s of realStudents)rows.push({dispatch_id:d.id,student_id:s.id,status:"new",journey_status:"sent",current_stage:"secret",response_json:{bundle_id:bundleId}});
   for(const s of demoStudents)rows.push({dispatch_id:d.id,student_id:s.id,status:"new",journey_status:"sent",current_stage:"secret",response_json:{bundle_id:bundleId,demo_preview:true,demo_only:demoOnly}});
 }
 for(let i=0;i<rows.length;i+=500){const {error:e}=await db.from("lugati_pretest_student_assignments").insert(rows.slice(i,i+500));if(e)throw e}
 return json(req,{ok:true,bundle_id:bundleId,bundle_title:title,subject_key:subject,students:realStudents.length,demo_students:demoStudents.length,demo_only:demoOnly,
   indicator_count:ordered.length,indicators:ordered.map((t:any,i:number)=>({template_id:t.id,order:i+1,global_indicator:Number(t.display_index||t.indicator_index),indicator_text:t.indicator_text,student_title:t.student_title||""})),
   demo_preview:demoStudents.length>0,sent_at:now});
}

async function activeMasteryLock(sid:string){
 const {data:l,error}=await db.from("lugati_student_mastery_lock").select("*").eq("student_id",sid).maybeSingle();if(error)throw error;
 if(!l)return null;
 const {data:x,error:xe}=await db.from("lugati_pretest_student_assignments").select("id,journey_status,exit_passed,dispatch_id").eq("id",l.assignment_id).maybeSingle();if(xe)throw xe;
 let stale=!x||(x.journey_status==="ready"&&x.exit_passed===true);
 if(x&&!stale){
   const {data:d,error:de}=await db.from("lugati_pretest_dispatches").select("revoked_at").eq("id",x.dispatch_id).maybeSingle();if(de)throw de;
   stale=!d||!!d.revoked_at;
 }
 if(stale){await db.from("lugati_student_mastery_lock").delete().eq("student_id",sid);return null}
 return l;
}
async function ensureMasteryLock(_z:any,_sid:string){
 // كل مؤشر يرسله المعلم متاح للطالب مباشرة؛ لا يوجد قفل بين المؤشرات.
 return;
}
async function releaseMasteryLock(sid:string,aid:string){
 await db.from("lugati_student_mastery_lock").delete().eq("student_id",sid).eq("assignment_id",aid);
}
function virtualExitRetryItems(t:any,raw:any[],state:any,attempt:number){
 const out:any[]=[];
 const rule=cleanText(t?.golden_rule)||cleanText(t?.transfer_rule)||"أحدد المطلوب ثم أطبق القاعدة المناسبة على المعطيات.";
 const steps=Array.isArray(t?.solution_steps)?t.solution_steps.map((x:any)=>cleanText(x)).filter(Boolean):[];
 const transfer=cleanText(t?.transfer_rule)||rule;
 const trap=cleanText(t?.common_trap)||"الاعتماد على شكل السؤال بدل فهم المهارة.";
 for(const i of raw){
   if(state?.[i.id]===true)continue;
   const lv=String(i.cognitive_level||"application");
   let prompt="",correct="",d1="",d2="",d3="",stim="";
   if(lv==="knowledge"){
     stim="تغيّرت صياغة السؤال ولم تتغير المهارة التي يقيسها.";
     prompt="أي قاعدة تبقى صالحة لتبدأ بها الحل؟";
     correct=rule;
     d1="أختار الإجابة التي تشبه سؤالًا سابقًا دون فحص المعطيات.";
     d2="أغيّر قاعدة الحل كلما تغيّرت أسماء الأشياء في السؤال.";
     d3="أختار البديل الأطول لأنه غالبًا الأكثر دقة.";
   }else if(lv==="application"){
     stim="أمامك سؤال جديد على المؤشر نفسه لكن بأرقام أو أسماء أو تمثيل مختلف.";
     prompt="ما الخطوة العملية الأولى التي تساعدك على نقل المهارة إلى السؤال الجديد؟";
     correct=steps[0]||transfer;
     d1="أبدأ بالحساب أو الاختيار قبل تحديد المطلوب.";
     d2="أبحث عن رقم أو كلمة مألوفة وأكرر حلًا سابقًا حرفيًا.";
     d3="أتجاهل الشروط الجديدة لأنها لا تؤثر في طريقة الحل.";
   }else{
     stim="أحد البدائل يبدو مألوفًا، لكن السؤال الجديد غيّر المعطيات وطريقة العرض.";
     prompt="أي تصرف يدل على استدلال صحيح قبل اختيار الإجابة؟";
     correct=steps.length?steps[steps.length-1]:transfer;
     d1="أختار البديل المألوف ثم أبحث عن سبب يؤيده.";
     d2="أتجاهل الدليل المخالف لأن صياغة السؤال تشبه تدريبًا سابقًا.";
     d3="أقع في هذا الفخ: "+trap;
   }
   const base=[correct,d1,d2,d3];
   const shift=(Math.abs(attempt)+out.length)%4;
   const options=[...base.slice(shift),...base.slice(0,shift)];
   const ci=options.indexOf(correct);
   out.push({
     id:"xr:"+i.id+":"+attempt,source_id:i.id,idea_no:12,order_no:200+out.length,
     activity_type:"choice",idea_title:"تحقق بديل من الإتقان",stimulus:stim,prompt:prompt,
     activity_data:{options},correct_answer:{index:ci},
     feedback_correct:"صحيح؛ أثبتَّ أنك تعرف كيف تنقل المهارة إلى صياغة جديدة.",
     feedback_wrong:"الإجابة الصحيحة تعتمد على فهم قاعدة المؤشر وخطواته، لا على حفظ السؤال السابق.",
     hint:"",explanation:lv==="knowledge"?rule:(lv==="application"?(steps[0]||transfer):(steps.length?steps[steps.length-1]:transfer)),
     stage:"exit",difficulty_label:"اختبار خروج",cognitive_level:lv,
     question_form:"تحقق جديد بعد العلاج",transfer_focus:"نقل المهارة إلى صياغة جديدة"
   });
 }
 return out;
}
async function rawExitItems(tid:string){
 const {data,error}=await db.from("lugati_pretest_items").select("*").eq("template_id",tid).eq("stage","exit").order("order_no");if(error)throw error;
 return data||[];
}
async function combinedAssessmentJourney(studentId:string,subject:string,items:any[]){
 if(!["math","science"].includes(subject))return null;
 const {data:attempts,error}=await db.from("nafes_assessment_attempts")
   .select("id,assessment_id,answers,rendered_sections,submitted_at")
   .eq("student_id",studentId).not("submitted_at","is",null)
   .order("submitted_at",{ascending:false}).limit(30);
 if(error)throw error;if(!(attempts||[]).length)return null;
 const assessmentIds=[...new Set((attempts||[]).map((x:any)=>String(x.assessment_id||"")).filter(Boolean))];
 if(!assessmentIds.length)return null;
 const {data:assessments,error:ae}=await db.from("nafes_assessments")
   .select("id,title,kind,status").in("id",assessmentIds).eq("kind","multi_indicator");
 if(ae)throw ae;
 const am=new Map((assessments||[]).map((x:any)=>[String(x.id),x]));
 const byKey=new Map(items.map((x:any)=>[`${x.subject_key}:${x.outcome_code}:i${x.indicator_index}`,x]));
 for(const at of attempts||[]){
   const assessment=am.get(String(at.assessment_id));if(!assessment)continue;
   const answers=(at.answers&&typeof at.answers==="object")?at.answers:{};
   const perf=new Map<string,any>();
   for(const sec of(Array.isArray(at.rendered_sections)?at.rendered_sections:[])){
     for(const q of(Array.isArray(sec?.questions)?sec.questions:[])){
       const s=tidy(q?.subject||sec?.subject),outcome=tidy(q?.outcome),idx=Number(q?.indicator||0);
       if(s!==subject||!outcome||!idx||!q?.id)continue;
       const key=`${s}:${outcome}:i${idx}`;
       if(!perf.has(key))perf.set(key,{key,subject_key:s,outcome_code:outcome,indicator_index:idx,indicator_text:cleanText(q?.indicator_text),correct:0,total:0});
       const p=perf.get(key);p.total++;
       if(Number(answers[q.id])===Number(q.correctIndex))p.correct++;
     }
   }
   if(perf.size<2)continue;
   const indicators=[...perf.values()].map((p:any)=>{
     const item=byKey.get(p.key),percent=p.total?Math.round(p.correct*1000/p.total)/10:0;
     const assignment=item?.assignment||null,journeyState=assignment?.journey_status||null;
     const masteredFromAssessment=!assignment&&percent>=90;
     const state=assignment?journeyState:(masteredFromAssessment?"ready":"missing");
     return{
       key:p.key,subject_key:p.subject_key,outcome_code:p.outcome_code,indicator_index:p.indicator_index,
       global_indicator:item?.global_indicator||p.indicator_index,
       indicator_text:item?.indicator_text||p.indicator_text,student_title:item?.student_title||"",
       score:p.correct,total:p.total,percent,
       template_id:item?.template_id||null,assignment,state,
       mastered_from_assessment:masteredFromAssessment
     };
   }).sort((x:any,y:any)=>Number(x.global_indicator)-Number(y.global_indicator));
   const mastered=indicators.filter((x:any)=>x.state==="ready").length;
   const pending=indicators.filter((x:any)=>x.assignment&&x.state!=="ready");
   return{
     id:`assessment:${at.assessment_id}:${at.id}:${subject}`,
     assessment_id:at.assessment_id,attempt_id:at.id,title:assessment.title||"اختبار مؤشرات",
     subject_key:subject,submitted_at:at.submitted_at,total:indicators.length,mastered_count:mastered,
     pending_count:pending.length,progress_percent:indicators.length?Math.round(mastered*1000/indicators.length)/10:0,
     next_assignment_id:pending[0]?.assignment?.id||null,indicators
   };
 }
 return null;
}
async function mapFor(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const subject=tidy(b?.subject_key)||"reading";
 if(!["reading","math","science"].includes(subject))return json(req,{error:"المادة غير مدعومة."},400);
 const {data:templates,error}=await db.from("lugati_pretest_templates")
   .select("id,subject_key,outcome_code,indicator_index,display_index,indicator_text,student_title")
   .eq("subject_key",subject).eq("is_active",true).eq("quality_passed",true).order("display_index");
 if(error)throw error;
 const {data:as,error:ae}=await db.from("lugati_pretest_student_assignments")
   .select("id,dispatch_id,status,journey_status,current_stage,challenge_percent,rescue_passed,exit_passed,exit_percent,exit_attempts,mastery_confirmed_at,retention_due_at,retention_status,retention_passed,enrichment_completed,bonus_points,assigned_at,completed_at")
   .eq("student_id",a.student_id).order("assigned_at",{ascending:false});if(ae)throw ae;
 const dids=[...new Set((as||[]).map((x:any)=>x.dispatch_id))];let ds:any[]=[];
 if(dids.length){const {data,error:e}=await db.from("lugati_pretest_dispatches").select("id,template_id,revoked_at,sent_at,bundle_id,bundle_title,bundle_order,bundle_size").in("id",dids);if(e)throw e;ds=(data||[]).filter((x:any)=>!x.revoked_at)}
 const dm=new Map(ds.map((d:any)=>[String(d.id),d])),latest=new Map<string,any>();
 for(const x of as||[]){const d=dm.get(String(x.dispatch_id));if(!d)continue;if(!latest.has(String(d.template_id)))latest.set(String(d.template_id),{...x,sent_at:d.sent_at})}
 const items=(templates||[]).map((t:any)=>{
   const x=latest.get(String(t.id));
   return{template_id:t.id,subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:Number(t.indicator_index),global_indicator:Number(t.display_index||globalNo(t.outcome_code,Number(t.indicator_index))),
     indicator_text:t.indicator_text,student_title:t.student_title,state:x?x.journey_status:"locked",
     locked_by_active:false,assignment:x||null};
 });
 const current=items.find((x:any)=>x.assignment&&x.state!=="ready")||items.find((x:any)=>x.assignment)||null;
 const assignmentByDispatch=new Map((as||[]).map((x:any)=>[String(x.dispatch_id),x]));
 const templateById=new Map((templates||[]).map((x:any)=>[String(x.id),x]));
 const bundleGroups=new Map<string,any>();
 for(const d of ds){
   if(!d.bundle_id)continue;
   const t=templateById.get(String(d.template_id));if(!t||t.subject_key!==subject)continue;
   const x=assignmentByDispatch.get(String(d.id));if(!x)continue;
   const bid=String(d.bundle_id);
   if(!bundleGroups.has(bid))bundleGroups.set(bid,{id:"teacher:"+bid,bundle_id:bid,title:d.bundle_title||"رحلة إتقان مدمجة",subject_key:subject,source_type:"teacher_bundle",sent_at:d.sent_at||x.assigned_at,indicators:[]});
   const g=bundleGroups.get(bid);
   g.sent_at=String(d.sent_at||x.assigned_at||"")>String(g.sent_at||"")?(d.sent_at||x.assigned_at):g.sent_at;
   g.indicators.push({
     key:subject+":"+t.outcome_code+":i"+t.indicator_index,subject_key:subject,outcome_code:t.outcome_code,indicator_index:Number(t.indicator_index),
     global_indicator:Number(t.display_index||globalNo(t.outcome_code,Number(t.indicator_index))),indicator_text:t.indicator_text,student_title:t.student_title||"",
     template_id:t.id,assignment:x,state:x.journey_status||"sent",bundle_order:Number(d.bundle_order||999),mastered_from_assessment:false
   });
 }
 const teacherBundles=[...bundleGroups.values()].map((g:any)=>{
   g.indicators.sort((x:any,y:any)=>Number(x.bundle_order)-Number(y.bundle_order));
   g.total=g.indicators.length;g.mastered_count=g.indicators.filter((x:any)=>x.state==="ready").length;g.pending_count=g.total-g.mastered_count;
   g.progress_percent=g.total?Math.round(g.mastered_count*1000/g.total)/10:0;
   g.next_assignment_id=g.indicators.find((x:any)=>x.state!=="ready")?.assignment?.id||null;
   return g;
 }).sort((x:any,y:any)=>String(y.sent_at||"").localeCompare(String(x.sent_at||""))).slice(0,20);
 const assessmentJourney=await combinedAssessmentJourney(String(a.student_id),subject,items);
 return json(req,{ok:true,subject_key:subject,total:items.length,indicators:items,current,teacher_bundles:teacherBundles,assessment_journey:assessmentJourney,active_lock_assignment_id:null});
}
async function bundle(aid:string,sid:string){
 const {data:x,error}=await db.from("lugati_pretest_student_assignments").select("*").eq("id",aid).eq("student_id",sid).maybeSingle();if(error)throw error;if(!x)throw Object.assign(new Error("رحلة المؤشر غير موجودة."),{status:404});
 const {data:d,error:de}=await db.from("lugati_pretest_dispatches").select("template_id,revoked_at,sent_at").eq("id",x.dispatch_id).maybeSingle();if(de)throw de;if(!d||d.revoked_at)throw Object.assign(new Error("تم سحب هذه المهمة من المعلم."),{status:410});
 const {data:t,error:te}=await db.from("lugati_pretest_templates").select("*").eq("id",d.template_id).single();if(te)throw te;
 return{x,d,t};
}
async function getJourney(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));
 if(!(z.x.journey_status==="ready"&&z.x.exit_passed===true))await ensureMasteryLock(z,String(a.student_id));
 let assignment={...z.x};
 if(z.x.status==="new"){
   const now=new Date().toISOString();
   await db.from("lugati_pretest_student_assignments").update({status:"in_progress",journey_status:"in_progress",current_stage:"secret",started_at:now,updated_at:now}).eq("id",z.x.id);
   assignment={...assignment,status:"in_progress",journey_status:"in_progress",current_stage:"secret",started_at:now};
 }
 const {data:guidedRaw,error}=await db.from("lugati_pretest_items").select("*").eq("template_id",z.t.id).eq("stage","guided").order("order_no");if(error)throw error;
 const guided=(guidedRaw||[]).filter((i:any)=>visibleItem(z.t,i,"guided")),objPool=await objectivePool(z.t);
 let support_review:any[]=[],rescue:any[]=[];
 if(assignment.journey_status==="support"){
   const r=assignment.response_json||{};
   let sourceItems:any[]=[];
   if(assignment.support_source==="exit")sourceItems=await rawExitItems(z.t.id);
   else{
     const {data:ch,error:ce}=await db.from("lugati_pretest_items").select("*").eq("template_id",z.t.id).eq("stage","challenge").order("order_no");if(ce)throw ce;
     sourceItems=(ch||[]).filter((x:any)=>visibleItem(z.t,x,"challenge"));
   }
   const levelState=assignment.support_source==="exit"?(assignment.exit_level_state||{}):{};
   const unresolved=sourceItems.filter((i:any)=>assignment.support_source==="exit"?levelState[i.id]!==true:r[i.id]?.correct!==true);
   for(const i of unresolved){
     const rr=r[i.id]||{},opts=Array.isArray(i.activity_data?.options)?i.activity_data.options:[],si=Number(rr?.activity_answer?.index),ci=Number(i.correct_answer?.index);
     support_review.push({id:i.id,prompt:i.prompt,stimulus:i.stimulus,selected:Number.isInteger(si)?opts[si]:"لم تُجب",correct:Number.isInteger(ci)?opts[ci]:"",explanation:i.explanation,cognitive_level:i.cognitive_level,question_form:i.question_form});
   }
   const fake={...r};for(const i of sourceItems)if(assignment.support_source==="exit"&&levelState[i.id]===true)fake[i.id]={correct:true};
   rescue=virtualRescueItems(z.t,sourceItems,fake).map((x:any)=>publicItem(x));
 }
 const due=assignment.retention_due_at&&new Date(assignment.retention_due_at).getTime()<=Date.now()&&assignment.retention_status!=="passed";
 return json(req,{ok:true,assignment,template:{id:z.t.id,subject_key:z.t.subject_key,outcome_code:z.t.outcome_code,indicator_index:z.t.indicator_index,global_indicator:Number(z.t.display_index||globalNo(z.t.outcome_code,Number(z.t.indicator_index))),indicator_text:z.t.indicator_text,student_title:z.t.student_title,golden_rule:z.t.golden_rule,common_trap:z.t.common_trap,recognition_cues:z.t.recognition_cues||[],solution_steps:z.t.solution_steps||[],question_patterns:z.t.question_patterns||[],transfer_rule:z.t.transfer_rule||"",challenge_minutes:z.t.challenge_minutes,ready_percent:z.t.ready_percent},guided:guided.map((x:any)=>publicItem(x,objectiveFor(x,z.t,objPool))),responses:assignment.response_json||{},support_review,rescue,retention_due:!!due});
}
async function checkGuided(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));await ensureMasteryLock(z,String(a.student_id));const iid=tidy(b?.item_id),oi=Number(b?.objective_index);
 const {data:i,error}=await db.from("lugati_pretest_items").select("*").eq("id",iid).eq("template_id",z.t.id).eq("stage","guided").maybeSingle();if(error)throw error;if(!i)return json(req,{error:"النشاط غير موجود."},404);
 if(!visibleItem(z.t,i,"guided"))return json(req,{error:"هذا السؤال غير متاح في المسار الحالي."},410);
 const ac=same(b?.activity_answer,i.correct_answer),oa=cleanText(b?.objective_answer),oc=oa?oa===cleanText(z.t.indicator_text):(Number.isFinite(oi)&&oi===Number(i.objective_correct_index)),r=(z.x.response_json&&typeof z.x.response_json==="object")?z.x.response_json:{},prev=r[iid]||{},tries=Number(prev.tries||0)+1;
 r[iid]={stage:"guided",activity_answer:b?.activity_answer,objective_index:oi,activity_correct:ac,objective_correct:oc,tries,checked_at:new Date().toISOString()};
 const {error:ue}=await db.from("lugati_pretest_student_assignments").update({status:"in_progress",journey_status:"in_progress",current_stage:"guided",response_json:r,updated_at:new Date().toISOString()}).eq("id",z.x.id);if(ue)throw ue;
 return json(req,{ok:true,activity_correct:ac,objective_correct:oc,passed:ac&&oc,tries,hint:ac?"":i.hint,feedback:ac?i.feedback_correct:(tries===1?i.hint:i.feedback_wrong)});
}
async function guidedDone(z:any){
 const {data:g,error}=await db.from("lugati_pretest_items").select("id,stage,cognitive_level,prompt").eq("template_id",z.t.id).eq("stage","guided");if(error)throw error;
 const r=z.x.response_json||{};return(g||[]).filter((i:any)=>visibleItem(z.t,i,"guided")).every((i:any)=>r[i.id]?.activity_correct===true&&r[i.id]?.objective_correct===true);
}
async function startChallenge(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));await ensureMasteryLock(z,String(a.student_id));if(!(await guidedDone(z)))return json(req,{error:"أكمل «جرّب معي» أولًا قبل فتح تحدي المؤشر."},409);
 const now=new Date();if(!z.x.challenge_started_at)await db.from("lugati_pretest_student_assignments").update({current_stage:"challenge",challenge_started_at:now.toISOString(),updated_at:now.toISOString()}).eq("id",z.x.id);
 const {data:rawItems,error}=await db.from("lugati_pretest_items").select("*").eq("template_id",z.t.id).eq("stage","challenge").order("order_no");if(error)throw error;
 const items=(rawItems||[]).filter((i:any)=>visibleItem(z.t,i,"challenge"));
 const coverage={knowledge:(items||[]).filter((i:any)=>i.cognitive_level==="knowledge").length,application:(items||[]).filter((i:any)=>i.cognitive_level==="application").length,reasoning:(items||[]).filter((i:any)=>i.cognitive_level==="reasoning").length};
 return json(req,{ok:true,items:items.map((x:any)=>publicItem(x)),timed:false,limit_seconds:null,remaining_seconds:null,ready_percent:Number(z.t.ready_percent||80),coverage});
}
async function submitChallenge(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));await ensureMasteryLock(z,String(a.student_id));if(!(await guidedDone(z)))return json(req,{error:"أكمل التدريب الموجّه أولًا."},409);
 const {data:rawItems,error}=await db.from("lugati_pretest_items").select("*").eq("template_id",z.t.id).eq("stage","challenge").order("order_no");if(error)throw error;
 const items=(rawItems||[]).filter((i:any)=>visibleItem(z.t,i,"challenge"));
 const answers=b?.answers&&typeof b.answers==="object"?b.answers:{},r=(z.x.response_json&&typeof z.x.response_json==="object")?z.x.response_json:{},wrong:any[]=[];let score=0;
 const levels:any={knowledge:{correct:0,total:0},application:{correct:0,total:0},reasoning:{correct:0,total:0}};
 for(const i of items){const ans=answers[i.id],ok=same(ans,i.correct_answer),lv=String(i.cognitive_level||"application");levels[lv].total++;if(ok){score++;levels[lv].correct++}r[i.id]={stage:"challenge",activity_answer:ans,correct:ok,cognitive_level:lv,submitted_at:new Date().toISOString()};if(!ok){const opts=Array.isArray(i.activity_data?.options)?i.activity_data.options:[],si=Number(ans?.index),ci=Number(i.correct_answer?.index);wrong.push({id:i.id,prompt:i.prompt,stimulus:i.stimulus,selected:Number.isInteger(si)?opts[si]:"لم تُجب",correct:Number.isInteger(ci)?opts[ci]:"",explanation:i.explanation,cognitive_level:lv,question_form:i.question_form})}}
 const total=items.length,percent=total?Math.round(score*1000/total)/10:0;
 const levelScores=Object.fromEntries(Object.entries(levels).map(([k,v]:any)=>[k,{...v,percent:v.total?Math.round(v.correct*1000/v.total)/10:0}]));
 const testedLevels=Object.values(levels).filter((v:any)=>v.total>0),levelFloor=testedLevels.length>0&&testedLevels.every((v:any)=>v.correct>=1);
 const gatePassed=percent>=Number(z.t.ready_percent||80)&&levelFloor,now=new Date().toISOString();
 const patch:any={response_json:r,challenge_score:score,challenge_total:total,challenge_percent:percent,challenge_submitted_at:now,
   current_stage:gatePassed?"exit":"support",journey_status:gatePassed?"in_progress":"support",status:"in_progress",
   support_source:"challenge",updated_at:now};
 const {error:ue}=await db.from("lugati_pretest_student_assignments").update(patch).eq("id",z.x.id);if(ue)throw ue;
 let rescue:any[]=[];if(!gatePassed)rescue=virtualRescueItems(z.t,items,r).map((x:any)=>publicItem(x));
 return json(req,{ok:true,score,total,percent,ready:false,challenge_passed:gatePassed,next_stage:gatePassed?"exit":"support",level_scores:levelScores,level_floor_passed:levelFloor,wrong_reviews:gatePassed?[]:wrong,rescue});
}
async function submitRescue(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));await ensureMasteryLock(z,String(a.student_id));if(z.x.journey_status!=="support")return json(req,{error:"مسار الإنقاذ غير مطلوب لهذه الرحلة."},409);
 const iid=tidy(b?.item_id);if(!iid)return json(req,{error:"حدد سؤال الإنقاذ."},400);
 const r=(z.x.response_json&&typeof z.x.response_json==="object")?z.x.response_json:{};
 let sourceItems:any[]=[];
 if(z.x.support_source==="exit")sourceItems=await rawExitItems(z.t.id);
 else{const {data:ch,error:ce}=await db.from("lugati_pretest_items").select("*").eq("template_id",z.t.id).eq("stage","challenge").order("order_no");if(ce)throw ce;sourceItems=(ch||[]).filter((x:any)=>visibleItem(z.t,x,"challenge"))}
 const state=z.x.exit_level_state||{},fake={...r};
 for(const q of sourceItems)if(z.x.support_source==="exit"&&state[q.id]===true)fake[q.id]={correct:true};
 const items=virtualRescueItems(z.t,sourceItems,fake),i=items.find((x:any)=>String(x.id)===iid);
 if(!i)return json(req,{error:"سؤال الإنقاذ غير متاح."},404);
 const ok=same(b?.activity_answer,i.correct_answer);
 r[i.id]={stage:"rescue",activity_answer:b?.activity_answer,correct:ok,cognitive_level:i.cognitive_level,checked_at:new Date().toISOString()};
 const allPassed=items.every((x:any)=>x.id===i.id?ok:r[x.id]?.correct===true);
 const remaining=items.filter((x:any)=>!(x.id===i.id?ok:r[x.id]?.correct===true)).length;
 const now=new Date().toISOString(),patch:any={response_json:r,updated_at:now};
 if(allPassed)Object.assign(patch,{rescue_passed:true,journey_status:"in_progress",current_stage:"exit",status:"in_progress"});
 const {error:ue}=await db.from("lugati_pretest_student_assignments").update(patch).eq("id",z.x.id);if(ue)throw ue;
 return json(req,{ok:true,passed:ok,all_passed:allPassed,remaining,cognitive_level:i.cognitive_level,next_stage:allPassed?"exit":"support",hint:ok?"":i.hint,feedback:ok?(allPassed?"أحسنت! عالجت نقطة التعثر. الآن أثبت الإتقان في سؤال خروج جديد.":"صحيح. انتقل إلى نقطة التعثر التالية."):(i.explanation||i.hint)});
}

async function restartTraining(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));
 if(z.x.journey_status==="ready"&&z.x.exit_passed===true)return json(req,{error:"هذا المؤشر متقن بالفعل ولا يحتاج إعادة التدريب."},409);
 const now=new Date().toISOString();
 const patch:any={
   status:"in_progress",journey_status:"in_progress",current_stage:"secret",
   response_json:{},rescue_passed:false,support_source:"challenge",
   challenge_started_at:null,challenge_submitted_at:null,challenge_score:null,challenge_total:null,challenge_percent:null,
   exit_started_at:null,exit_submitted_at:null,exit_score:null,exit_total:null,exit_percent:null,exit_passed:false,exit_level_state:{},
   completed_at:null,mastery_confirmed_at:null,retention_due_at:null,retention_status:"not_due",retention_checked_at:null,retention_passed:false,
   enrichment_completed:false,bonus_points:0,started_at:now,updated_at:now
 };
 const {error}=await db.from("lugati_pretest_student_assignments").update(patch).eq("id",z.x.id).eq("student_id",a.student_id);
 if(error)throw error;
 return json(req,{ok:true,assignment_id:z.x.id,current_stage:"secret",journey_status:"in_progress",message:"تمت إعادة فتح التدريب من البداية."});
}

async function startExit(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));await ensureMasteryLock(z,String(a.student_id));
 if(z.x.current_stage!=="exit")return json(req,{error:"أكمل المراحل السابقة قبل اختبار الخروج."},409);
 const raw=await rawExitItems(z.t.id),state=z.x.exit_level_state||{},attempt=Number(z.x.exit_attempts||0);
 const items=attempt>0?virtualExitRetryItems(z.t,raw,state,attempt):raw.map((x:any)=>({...x,source_id:x.id}));
 if(!z.x.exit_started_at)await db.from("lugati_pretest_student_assignments").update({exit_started_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",z.x.id);
 return json(req,{ok:true,items:items.map((x:any)=>publicItem(x)),attempt:attempt+1,total_levels:3,remaining_levels:items.length,rule:"يجب إتقان المعرفة والتطبيق والاستدلال جميعًا. لا توجد تلميحات داخل اختبار الخروج."});
}
async function submitExit(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));await ensureMasteryLock(z,String(a.student_id));
 if(z.x.current_stage!=="exit")return json(req,{error:"اختبار الخروج غير متاح الآن."},409);
 const raw=await rawExitItems(z.t.id),oldState=(z.x.exit_level_state&&typeof z.x.exit_level_state==="object")?z.x.exit_level_state:{},state={...oldState};
 const attempt=Number(z.x.exit_attempts||0),items=attempt>0?virtualExitRetryItems(z.t,raw,state,attempt):raw.map((x:any)=>({...x,source_id:x.id}));
 const answers=b?.answers&&typeof b.answers==="object"?b.answers:{},r=(z.x.response_json&&typeof z.x.response_json==="object")?z.x.response_json:{};
 let currentScore=0;const wrong:any[]=[];
 for(const i of items){
   const ans=answers[i.id],ok=same(ans,i.correct_answer),sid=String(i.source_id||i.id);if(ok)currentScore++;
   state[sid]=ok===true;
   r[sid]={stage:"exit",activity_answer:ans,correct:ok,cognitive_level:i.cognitive_level,attempt:attempt+1,checked_at:new Date().toISOString()};
   if(!ok){const opts=Array.isArray(i.activity_data?.options)?i.activity_data.options:[],si=Number(ans?.index),ci=Number(i.correct_answer?.index);wrong.push({id:sid,prompt:i.prompt,stimulus:i.stimulus,selected:Number.isInteger(si)?opts[si]:"لم تُجب",correct:Number.isInteger(ci)?opts[ci]:"",explanation:i.explanation,cognitive_level:i.cognitive_level})}
 }
 const mastered=raw.filter((x:any)=>state[x.id]===true).length,total=raw.length,allPassed=total===3&&mastered===3,percent=total?Math.round(mastered*1000/total)/10:0,now=new Date();
 const patch:any={response_json:r,exit_level_state:state,exit_attempts:attempt+1,exit_score:mastered,exit_total:total,exit_percent:percent,exit_submitted_at:now.toISOString(),updated_at:now.toISOString()};
 let rescue:any[]=[];
 if(allPassed){
   const retention=new Date(now.getTime()+24*60*60*1000).toISOString();
   Object.assign(patch,{exit_passed:true,journey_status:"ready",current_stage:"ready",status:"completed",completed_at:now.toISOString(),mastery_confirmed_at:now.toISOString(),retention_due_at:retention,retention_status:"pending"});
 }else{
   Object.assign(patch,{exit_passed:false,journey_status:"support",current_stage:"support",status:"in_progress",support_source:"exit"});
   const fake={...r};for(const q of raw)if(state[q.id]===true)fake[q.id]={correct:true};
   rescue=virtualRescueItems(z.t,raw,fake).map((x:any)=>publicItem(x));
 }
 const {error:ue}=await db.from("lugati_pretest_student_assignments").update(patch).eq("id",z.x.id);if(ue)throw ue;
 if(allPassed)await releaseMasteryLock(String(a.student_id),z.x.id);
 return json(req,{ok:true,passed:allPassed,mastered_levels:mastered,total_levels:total,percent,attempt:attempt+1,wrong_reviews:allPassed?[]:wrong,rescue,next_stage:allPassed?"ready":"support",retention_due_at:patch.retention_due_at||null});
}
async function retention(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));
 if(!(z.x.journey_status==="ready"&&z.x.exit_passed===true))return json(req,{error:"ثبّت الإتقان أولًا."},409);
 const due=z.x.retention_due_at?new Date(z.x.retention_due_at):null;if(!due)return json(req,{error:"لا يوجد موعد تثبيت."},404);
 if(Date.now()<due.getTime())return json(req,{ok:true,due:false,due_at:z.x.retention_due_at,status:z.x.retention_status});
 const {data:i,error}=await db.from("lugati_pretest_items").select("*").eq("template_id",z.t.id).eq("stage","retention").maybeSingle();if(error)throw error;if(!i)return json(req,{error:"سؤال التثبيت غير متاح."},404);
 if(b?.mode==="get")return json(req,{ok:true,due:true,item:publicItem(i),status:z.x.retention_status});
 const ok=same(b?.activity_answer,i.correct_answer),now=new Date().toISOString();
 const {error:ue}=await db.from("lugati_pretest_student_assignments").update({retention_checked_at:now,retention_passed:ok,retention_status:ok?"passed":"needs_review",updated_at:now}).eq("id",z.x.id);if(ue)throw ue;
 return json(req,{ok:true,passed:ok,status:ok?"passed":"needs_review",feedback:ok?"ثبت إتقانك للمؤشر ✓":(i.explanation||"راجع المؤشر ثم أعد سؤال التثبيت.")});
}
async function enrichment(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const z=await bundle(tidy(b?.assignment_id),String(a.student_id));if(z.x.journey_status!=="ready")return json(req,{error:"أكمل رحلة المؤشر أولًا."},409);
 let i:any=null;
 if(coreSubject(z.t)){
   const {data,error}=await db.from("lugati_pretest_items").select("*").eq("template_id",z.t.id).eq("stage","challenge").eq("order_no",15).maybeSingle();if(error)throw error;
   if(data)i={...data,stage:"enrichment",idea_title:"سؤال العباقرة",difficulty_label:"إثرائي"};
 }else{
   const {data,error}=await db.from("lugati_pretest_items").select("*").eq("template_id",z.t.id).eq("stage","enrichment").maybeSingle();if(error)throw error;i=data;
 }
 if(!i)return json(req,{error:"التحدي الإثرائي غير متاح."},404);
 if(b?.mode==="get")return json(req,{ok:true,item:publicItem(i),completed:z.x.enrichment_completed,bonus_points:z.x.bonus_points});
 const ok=same(b?.activity_answer,i.correct_answer),now=new Date().toISOString();if(ok)await db.from("lugati_pretest_student_assignments").update({enrichment_completed:true,bonus_points:10,updated_at:now}).eq("id",z.x.id);
 return json(req,{ok:true,passed:ok,bonus_points:ok?10:0,feedback:ok?"رائع! حصلت على 10 نقاط إضافية.":(i.hint||"راجع المفهوم ثم حاول مرة أخرى.")});
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
 try{const a=await access(req),b=await req.json().catch(()=>({})),act=tidy(b?.action);
  if(act==="list_templates")return await listTemplates(req,b,a);
  if(act==="send_all")return await sendAll(req,b,a);
  if(act==="send_bundle")return await sendBundle(req,b,a);
  if(act==="journey_map"||act==="my_assignments")return await mapFor(req,b,a);
  if(act==="get_journey"||act==="get_sheet")return await getJourney(req,b,a);
  if(act==="check_guided"||act==="check_item")return await checkGuided(req,b,a);
  if(act==="start_challenge")return await startChallenge(req,b,a);
  if(act==="submit_challenge")return await submitChallenge(req,b,a);
  if(act==="submit_rescue")return await submitRescue(req,b,a);
  if(act==="restart_training")return await restartTraining(req,b,a);
  if(act==="start_exit")return await startExit(req,b,a);
  if(act==="submit_exit")return await submitExit(req,b,a);
  if(act==="retention")return await retention(req,b,a);
  if(act==="enrichment")return await enrichment(req,b,a);
  return json(req,{error:"action_not_supported"},400);
 }catch(e){console.error("lugati-pretest-worksheets",e);const s=e&&typeof e==="object"&&"status" in e?Number((e as any).status):500;return json(req,{error:s===500?"تعذر تنفيذ العملية الآن.":String((e as Error).message)},s)}
});