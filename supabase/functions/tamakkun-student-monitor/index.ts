import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINS=new Set(["https://zarie19991-bit.github.io","http://localhost:8000","http://127.0.0.1:8000","http://localhost:5500","http://127.0.0.1:5500"]);
const str=(x:unknown)=>String(x??"").trim();
function cors(req:Request){const origin=req.headers.get("origin")||"";return{"Access-Control-Allow-Origin":ORIGINS.has(origin)?origin:"https://zarie19991-bit.github.io","Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"}}
function send(req:Request,data:any,status=200){return new Response(JSON.stringify(data),{status,headers:cors(req)})}
async function hash(token:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")}
function err(msg:string,status=400){return Object.assign(new Error(msg),{status})}
async function getAccess(req:Request){
 const token=str(req.headers.get("authorization")).replace(/^bearer\s+/i,"");
 if(!token)throw err("سجّل الدخول أولًا.",401);
 const {data:s,error}=await db.from("lugati_sessions").select("id,role,student_id,teacher_access_id,last_seen_at,created_at,expires_at").eq("token_hash",await hash(token)).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error)throw error;if(!s)throw err("انتهت جلسة الدخول؛ سجّل الدخول مجددًا.",401);
 if(s.role==="student"){
  const {data:st,error:se}=await db.from("nafes_students").select("id,is_active,is_demo").eq("id",s.student_id).eq("is_active",true).maybeSingle();
  if(se)throw se;if(!st)throw err("حساب الطالب غير متاح.",403);
  return{role:"student",session:s,student_id:String(st.id),is_demo:st.is_demo===true};
 }
 if(s.role!=="teacher")throw err("الصلاحية غير متاحة.",403);
 const {data:t,error:te}=await db.from("nafes_teacher_access").select("id,active,subject_scope").eq("id",s.teacher_access_id).eq("active",true).maybeSingle();
 if(te)throw te;if(!t)throw err("صلاحية حساب المعلم منتهية.",403);
 return{role:"teacher",session:s,teacher_id:String(t.id),scope:["reading","math","science"].includes(String(t.subject_scope))?String(t.subject_scope):"all"};
}
async function collect(table:string,fields:string,prepare:(q:any)=>any,limit=15000){
 const items:any[]=[];const size=450;
 for(let offset=0;offset<limit;offset+=size){
  let q=db.from(table).select(fields).order("id",{ascending:true}).range(offset,offset+size-1);
  q=prepare(q);
  const {data,error}=await q;if(error)throw error;
  items.push(...(data||[]));
  if((data||[]).length<size)return items;
 }
 throw err("عدد السجلات تجاوز حد المتابعة الآمن. لم تُعرض بيانات ناقصة.",409);
}
async function trackPresence(req:Request,ac:any){
 if(ac.role!=="student"||ac.is_demo)return send(req,{ok:true,tracked:false});
 const now=new Date(),last=new Date(ac.session.last_seen_at||0);
 if(now.getTime()-last.getTime()>=60000){
  const {error}=await db.from("lugati_sessions").update({last_seen_at:now.toISOString()}).eq("id",ac.session.id).gt("expires_at",now.toISOString());
  if(error)throw error;
 }
 return send(req,{ok:true,tracked:true});
}

/*
 * Read-only attendance history. The private daily ledger is written only by
 * authenticated student session database triggers, never by teacher/student input.
 * If the staged SQL has not been deployed, this action will fail safely; the
 * client falls back to its limited legacy session evidence with clear warnings.
 */
async function attendanceHistory(req:Request,body:any,ac:any){
 if(ac.role!=="teacher")throw err("سجل دخول الطلاب التفصيلي متاح للمعلم فقط.",403);
 const from=str(body?.from),to=str(body?.to);
 const valid=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T12:00:00Z"))&&new Date(v+"T12:00:00Z").toISOString().slice(0,10)===v;
 if(!valid(from)||!valid(to)||from>to)throw err("اختر بداية ونهاية صحيحين للفترة.",400);
 const duration=(Date.parse(to+"T12:00:00Z")-Date.parse(from+"T12:00:00Z"))/86400000;
 if(duration>365)throw err("الحد الأقصى لقراءة السجل اليومي 366 يومًا.",400);
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 if(to>today)throw err("الفترة لا يمكن أن تشمل المستقبل.",400);

 const {data:configuration,error:ce}=await db.from("tamakkun_activity_tracking_config")
   .select("recording_started_at,complete_from_day").eq("singleton",true).maybeSingle();
 if(ce)throw err("السجل اليومي الدائم غير مُفعّل على الخادم بعد.",503);
 if(!configuration)throw err("لم يبدأ التسجيل اليومي الدائم بعد.",503);

 const roster=await collect("nafes_students","id,created_at",q=>q.eq("is_active",true).eq("is_demo",false),3500);
 const allowed=new Set(roster.map(s=>String(s.id)));
 if(!allowed.size)return send(req,{ok:true,mode:"durable",complete_from_day:configuration.complete_from_day,activity_days:[]});
 const ids=[...allowed];
 const history:any[]=[];const batch=450;const ceiling=60000;
 for(let offset=0;offset<ceiling;offset+=batch){
  const {data,error}=await db.from("tamakkun_student_activity_days")
    .select("student_id,activity_day,login_events,heartbeat_events")
    .in("student_id",ids).gte("activity_day",from).lte("activity_day",to)
    .order("student_id",{ascending:true}).order("activity_day",{ascending:true})
    .range(offset,offset+batch-1);
  if(error)throw err("تعذّر قراءة سجل الدخول اليومي؛ لم يُعرض كشف ناقص.",503);
  const rows=(data||[]).filter(x=>allowed.has(String(x.student_id)));
  history.push(...rows);
  if(rows.length<batch){
   return send(req,{ok:true,mode:"durable",complete_from_day:configuration.complete_from_day,
      history_start:configuration.recording_started_at,activity_days:history});
  }
 }
 throw err("بيانات الدخول كثيرة جدًا لهذه المدة؛ اختصر الفترة حتى لا يصدر كشف ناقص.",409);
}

async function snapshot(req:Request,ac:any){
 if(ac.role!=="teacher")throw err("التقرير متاح للمعلم فقط.",403);
 const roster=await collect("nafes_students","id,full_name,grade,class_name,created_at,is_active,is_demo",q=>q.eq("is_active",true).eq("is_demo",false),3500);
 const ids=roster.map(s=>String(s.id));
 const [sessions,tasks,evidence,posttests,reviews]=await Promise.all([
  collect("lugati_sessions","id,student_id,created_at,last_seen_at,expires_at",q=>q.eq("role","student").in("student_id",ids),10000),
  collect("lugati_teacher_tasks","id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,tier,status,assigned_at,started_at,completed_at,score,total,percent,source_attempt_id,source_percent,source_submitted_at,response,teacher_access_id",q=>q.in("student_id",ids).neq("status","revoked").order("id",{ascending:true}),15000),
  collect("tamakkun_indicator_evidence","id,attempt_id,student_id,subject_key,outcome_code,indicator_index,indicator_text,score,total,answered,knowledge_score,knowledge_total,application_score,application_total,reasoning_score,reasoning_total,submitted_at",q=>ac.scope==="all"?q:q.eq("subject_key",ac.scope),20000),
  collect("tamakkun_indicator_posttests","id,student_id,source_task_id,subject_key,outcome_code,indicator_index,status,assigned_at,started_at,submitted_at,score,total,percent",q=>ac.scope==="all"?q:q.eq("subject_key",ac.scope),10000),
  collect("tamakkun_remedial_teacher_reviews","id,task_id,teacher_access_id,student_id,event_type,execution_date,execution_mode,evidence_type,decision,posttest_id,notes,created_at",q=>q.eq("teacher_access_id",ac.teacher_id),15000)
 ]);
 const allowed=new Set(ids);
 const safeTasks=tasks.filter(t=>allowed.has(String(t.student_id))&&(ac.scope==="all"||t.subject_key===ac.scope))
   .map(t=>{const answerCount=t.response?.answers&&typeof t.response.answers==="object"&&!Array.isArray(t.response.answers)?Object.keys(t.response.answers).length:0;
     return {id:t.id,teacher_access_id:t.teacher_access_id,student_id:t.student_id,subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:t.indicator_index,indicator_text:t.indicator_text,title:t.title,tier:t.tier,status:t.status,assigned_at:t.assigned_at,started_at:t.started_at,completed_at:t.completed_at,score:t.score,total:t.total,percent:t.percent,source_attempt_id:t.source_attempt_id,source_percent:t.source_percent,source_submitted_at:t.source_submitted_at,
       solved:t.status==="completed"&&!!t.completed_at&&t.total>0&&t.score!=null&&answerCount>0,answer_count:answerCount}
   });
 const taskIds=new Set(safeTasks.filter(t=>String(t.teacher_access_id)===String(ac.teacher_id)).map(t=>String(t.id)));
 const validReviews=reviews.filter(r=>allowed.has(String(r.student_id))&&taskIds.has(String(r.task_id)));
 const validEvidence=evidence.filter(e=>allowed.has(String(e.student_id))&&e.total>0&&e.score!=null);
 const catalog=new Map<string,any>();
 for(const e of validEvidence){
  const key=[e.subject_key,e.outcome_code,e.indicator_index].join("|");
  if(!catalog.has(key))catalog.set(key,{key,subject_key:e.subject_key,outcome_code:e.outcome_code,indicator_index:e.indicator_index,indicator_text:e.indicator_text||"المؤشر "+e.indicator_index});
 }
 for(const t of safeTasks){const key=[t.subject_key,t.outcome_code,t.indicator_index].join("|");if(!catalog.has(key))catalog.set(key,{key,subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:t.indicator_index,indicator_text:t.indicator_text||"المؤشر "+t.indicator_index})}
 return send(req,{ok:true,generated_at:new Date().toISOString(),scope:ac.scope,teacher_id:ac.teacher_id,
    students:roster,sessions:sessions.filter(s=>allowed.has(String(s.student_id))),tasks:safeTasks,
    evidence:validEvidence,posttests:posttests.filter(p=>allowed.has(String(p.student_id))),reviews:validReviews,indicators:[...catalog.values()],criteria:{mastery_percent:80,min_reliable_questions:5,online_within_minutes:5}});
}


const reviewUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const riyadhDay=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const validReviewDay=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+"T12:00:00Z"))&&new Date(d+"T12:00:00Z").toISOString().slice(0,10)===d;
async function reviewedTask(taskId:string,ac:any){
 if(ac.role!=="teacher")throw err("متاح للمعلم فقط.",403);
 if(!reviewUuid.test(taskId))throw err("معرّف التكليف غير صحيح.",400);
 const {data,error}=await db.from("lugati_teacher_tasks")
 .select("id,teacher_access_id,student_id,subject_key,outcome_code,indicator_index,status,assigned_at,completed_at,total,score,response")
 .eq("id",taskId).eq("teacher_access_id",ac.teacher_id).neq("status","revoked").maybeSingle();
 if(error)throw error;
 if(!data)throw err("التكليف غير موجود ضمن صلاحيات حساب المعلم.",404);
 if(ac.scope!=="all"&&data.subject_key!==ac.scope)throw err("هذه المادة خارج صلاحيات المعلم.",403);
 return data;
}
async function latestTeacherReviews(taskId:string,teacherId:string){
 const {data,error}=await db.from("tamakkun_remedial_teacher_reviews")
 .select("id,task_id,student_id,event_type,execution_date,execution_mode,evidence_type,decision,posttest_id,notes,created_at")
 .eq("task_id",taskId).eq("teacher_access_id",teacherId)
 .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50);
 if(error)throw err("سجل مراجعة المعلم غير متاح؛ لم تُسجّل موافقة.",503);
 return data||[];
}
async function teacherReviewExecution(req:Request,body:any,ac:any){
 const task=await reviewedTask(str(body?.task_id),ac);
 const day=str(body?.execution_date),mode=str(body?.execution_mode),evidence=str(body?.evidence_type),notes=str(body?.notes);
 if(!validReviewDay(day)||day>riyadhDay()||day<str(task.assigned_at).slice(0,10))
  throw err("اختر تاريخًا صحيحًا بعد إسناد التكليف، ولا يكون في المستقبل.",400);
 if(!["in_class","home","online","other"].includes(mode)||!["teacher_observation","student_work","online_submission","other"].includes(evidence))
  throw err("طريقة التنفيذ أو نوع الشاهد غير صحيح.",400);
 if(notes.length<3||notes.length>1200)throw err("الملاحظات مطلوبة (3–1200 حرف).",400);
 // Teacher attestation; it does not rewrite the student's digital submission.
 const {data,error}=await db.from("tamakkun_remedial_teacher_reviews").insert({
  task_id:task.id,teacher_access_id:ac.teacher_id,student_id:task.student_id,
  event_type:"execution",execution_date:day,execution_mode:mode,evidence_type:evidence,notes
 }).select("id,task_id,event_type,execution_date,execution_mode,evidence_type,notes,created_at").single();
 if(error)throw error;
 return send(req,{ok:true,review:data,message:"حُفظ توثيق تنفيذ العلاج، ولا يعني ذلك اعتماد الإتقان."},201);
}
async function teacherReviewDecision(req:Request,body:any,ac:any){
 const task=await reviewedTask(str(body?.task_id),ac);
 const decision=str(body?.decision),notes=str(body?.notes);
 if(!["mastered","needs_retraining"].includes(decision)||notes.length<3||notes.length>1200)
  throw err("حدد القرار وأدخل ملاحظة تشرح اعتماد المعلم.",400);
 const execution=await latestTeacherReviews(task.id,ac.teacher_id);
 const lastExecution=execution.find((r:any)=>r.event_type==="execution");
 const onlineDone=task.status==="completed"&&!!task.completed_at&&Number(task.total)>=1&&
   task.response?.answers&&typeof task.response.answers==="object"&&Object.keys(task.response.answers).length>0;
 if(!lastExecution&&!onlineDone)throw err("لا يوجد تنفيذ علاجي موثّق أو تسليم إلكتروني مكتمل.",409);
 const {data:posttest,error:pe}=await db.from("tamakkun_indicator_posttests")
 .select("id,student_id,teacher_access_id,source_task_id,subject_key,outcome_code,indicator_index,status,score,total,percent,submitted_at")
 .eq("source_task_id",task.id).eq("student_id",task.student_id).eq("teacher_access_id",ac.teacher_id).maybeSingle();
 if(pe)throw pe;
 if(!posttest||posttest.status!=="completed"||!posttest.submitted_at||!Number.isFinite(Number(posttest.score))||
    !Number.isInteger(Number(posttest.total))||Number(posttest.total)<5||Number(posttest.score)<0||
    Number(posttest.score)>Number(posttest.total)||
    posttest.subject_key!==task.subject_key||posttest.outcome_code!==task.outcome_code||
    Number(posttest.indicator_index)!==Number(task.indicator_index))
  throw err("يجب اكتمال قياس بعدي سليم لا يقل عن خمسة أسئلة ومرتبط بالتكليف نفسه.",409);
 const after=Number(posttest.score)*100/Number(posttest.total);
 if(decision==="mastered"&&after<80)throw err("لم يبلغ الطالب حد الإتقان ٨٠٪ في القياس البعدي المرتبط بالخطة.",409);
 const completedAt=onlineDone?Date.parse(task.completed_at):0;
 const reviewedAt=lastExecution?Date.parse(lastExecution.created_at):0;
 const executionDay=lastExecution?str(lastExecution.execution_date):'';
 const posttestDay=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(posttest.submitted_at));
 const beforeClassEvidence=!!executionDay&&posttestDay<executionDay;
 if(beforeClassEvidence||Date.parse(posttest.submitted_at)<(completedAt||0))throw err("نتيجة القياس البعدي سبقت توثيق تنفيذ العلاج؛ أعد القياس قبل الاعتماد.",409);
 const {data,error}=await db.from("tamakkun_remedial_teacher_reviews").insert({
  task_id:task.id,teacher_access_id:ac.teacher_id,student_id:task.student_id,
  event_type:"decision",decision,posttest_id:posttest.id,notes
 }).select("id,task_id,event_type,decision,posttest_id,notes,created_at").single();
 if(error)throw error;
 return send(req,{ok:true,review:data,posttest_percent:Math.round(after*10)/10,message:decision==="mastered"?
   "حُفظ اعتماد المعلم للإتقان بعد التحقق من القياس البعدي.":"حُفظ قرار استمرار العلاج."},201);
}

function fingerprint(value:any){return str(value).normalize("NFKC").replace(/[\u0640\u064B-\u065F\u0670]/g,"").replace(/[إأآ]/g,"ا").replace(/ى/g,"ي").replace(/[^\p{L}\p{N}]/gu,"")}
function hashed(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
async function assignPosttest(req:Request,body:any,ac:any){
 if(ac.role!=="teacher")throw err("الإسناد للمعلم فقط.",403);
 const taskId=str(body?.task_id);
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(taskId))throw err("معرّف الخطة غير صالح.",400);
 const {data:task,error}=await db.from("lugati_teacher_tasks").select("id,student_id,teacher_access_id,subject_key,outcome_code,indicator_index,indicator_text,status,question_ids,source_attempt_id,total,completed_at,response")
  .eq("id",taskId).eq("teacher_access_id",ac.teacher_id).maybeSingle();
 if(error)throw error;if(!task)throw err("الخطة غير موجودة ضمن صلاحيات المعلم.",404);
 if(ac.scope!=="all"&&task.subject_key!==ac.scope)throw err("المادة خارج صلاحيتك.",403);
 const onlineCompleted=task.status==="completed"&&!!task.completed_at&&Number(task.total||0)>0&&Object.keys(task.response?.answers||{}).length>0;
 if(!onlineCompleted){
  const reviews=await latestTeacherReviews(task.id,ac.teacher_id);
  if(!reviews.some((r:any)=>r.event_type==="execution"))throw err("لا يمكن إسناد قياس بعدي قبل إكمال التدريب الإلكتروني أو توثيق تنفيذه في الفصل.",409);
 }
 const {data:existing,error:ee}=await db.from("tamakkun_indicator_posttests").select("id,status,assigned_at").eq("source_task_id",task.id).maybeSingle();
 if(ee)throw ee;if(existing)return send(req,{ok:true,already_assigned:true,posttest:existing,message:"الاختبار البعدي مسند مسبقًا لهذه الخطة."});
 const {data:bank,error:qe}=await db.from("nafes_question_bank")
 .select("id,question_text,context_text,options,correct_index,cognitive_level,review_status,alignment_verified,is_active")
 .eq("subject_key",task.subject_key).eq("outcome_code",task.outcome_code).eq("indicator_index",task.indicator_index)
 .eq("review_status","approved").eq("alignment_verified",true).eq("is_active",true).limit(500);
 if(qe)throw qe;
 const oldIds=new Set((Array.isArray(task.question_ids)?task.question_ids:[]).map(String));
 const original=Array.isArray(task.question_ids)&&task.question_ids.length?
 await db.from("nafes_question_bank").select("id,context_text").in("id",task.question_ids.slice(0,80)):null;
 if(original?.error)throw original.error;
 const previousPassages=new Set((original?.data||[]).map((x:any)=>fingerprint(x.context_text)).filter(Boolean));
 const usedStems=new Set<string>();
 const fresh=(bank||[]).filter((q:any)=>{
  if(oldIds.has(String(q.id))||!Array.isArray(q.options)||q.options.length!==4||!Number.isInteger(q.correct_index)||q.correct_index<0||q.correct_index>3)return false;
  const stem=fingerprint(q.question_text),passage=fingerprint(q.context_text);
  if(!stem||usedStems.has(stem)||task.subject_key==="reading"&&previousPassages.has(passage))return false;
  usedStems.add(stem);return true;
 }).sort((a:any,b:any)=>hashed(String(task.student_id)+"|posttest|"+String(a.id))-hashed(String(task.student_id)+"|posttest|"+String(b.id)));
 const parts:any={knowledge:fresh.filter((x:any)=>x.cognitive_level==="knowledge"),application:fresh.filter((x:any)=>x.cognitive_level==="application"),reasoning:fresh.filter((x:any)=>x.cognitive_level==="reasoning")};
 const used=new Set<string>(),selected:any[]=[];
 for(const [c,n] of [["knowledge",2],["application",2],["reasoning",1]] as [string,number][]){
  for(const q of parts[c].slice(0,n)){if(!used.has(q.id)){selected.push(q);used.add(q.id)}}
 }
 for(const q of fresh)if(selected.length<5&&!used.has(q.id)){selected.push(q);used.add(q.id)}
 if(selected.length<5)throw err("لا تتوافر خمسة أسئلة جديدة ومختلفة عن ورقة العمل لهذا المؤشر. أضف أسئلة معتمدة قبل الإسناد.",409);
 const {data:created,error:ce}=await db.from("tamakkun_indicator_posttests").insert({
  student_id:task.student_id,teacher_access_id:ac.teacher_id,source_task_id:task.id,
  subject_key:task.subject_key,outcome_code:task.outcome_code,indicator_index:task.indicator_index,
  indicator_text:task.indicator_text,question_ids:selected.map(x=>x.id)
 }).select("id,status,assigned_at").single();
 if(ce){if(ce.code==="23505")throw err("يوجد اختبار بعدي مرتبط بهذه الخطة.",409);throw ce}
 return send(req,{ok:true,posttest:created,message:"أُسند اختبار بعدي مستقل من خمسة أسئلة معتمدة إلى حساب الطالب."});
}
async function studentPosttestList(req:Request,ac:any){
 if(ac.role!=="student")throw err("للطالب فقط.",403);
 const {data,error}=await db.from("tamakkun_indicator_posttests")
  .select("id,subject_key,outcome_code,indicator_index,indicator_text,status,assigned_at,started_at,submitted_at,score,total,percent")
  .eq("student_id",ac.student_id).order("assigned_at",{ascending:false}).limit(300);
 if(error)throw error;return send(req,{ok:true,tests:data||[]});
}
async function studentOpenPosttest(req:Request,body:any,ac:any){
 if(ac.role!=="student")throw err("للطالب فقط.",403);
 const id=str(body?.test_id);
 const {data:t,error}=await db.from("tamakkun_indicator_posttests")
  .select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,status,question_ids,score,total,percent")
  .eq("id",id).eq("student_id",ac.student_id).maybeSingle();
 if(error)throw error;if(!t)throw err("لم يُسند هذا القياس إلى حسابك.",404);
 if(t.status==="completed")return send(req,{ok:true,completed:true,score:t.score,total:t.total,percent:t.percent});
 if(t.status==="assigned"){const {error:e}=await db.from("tamakkun_indicator_posttests").update({status:"in_progress",started_at:new Date().toISOString()}).eq("id",id).eq("status","assigned");if(e)throw e}
 const {data:questions,error:qe}=await db.from("nafes_question_bank")
  .select("id,question_text,context_text,options,cognitive_level")
  .in("id",t.question_ids);
 if(qe)throw qe;
 const map=new Map((questions||[]).map((q:any)=>[String(q.id),q]));
 const ordered=t.question_ids.map((id:string)=>map.get(String(id))).filter(Boolean);
 if(ordered.length!==t.question_ids.length)throw err("بعض أسئلة الاختبار لم تعد متاحة، تواصل مع المعلم.",409);
 return send(req,{ok:true,test:{id:t.id,indicator_text:t.indicator_text,subject_key:t.subject_key,question_count:ordered.length},questions:ordered});
}
async function studentSubmitPosttest(req:Request,body:any,ac:any){
 if(ac.role!=="student")throw err("تسليم الطالب فقط.",403);
 const id=str(body?.test_id),answers=body?.answers;
 if(!answers||typeof answers!=="object"||Array.isArray(answers))throw err("أرسل إجابات الأسئلة أولًا.",400);
 const {data:t,error}=await db.from("tamakkun_indicator_posttests")
  .select("id,student_id,status,question_ids,score,total,percent")
  .eq("id",id).eq("student_id",ac.student_id).maybeSingle();
 if(error)throw error;if(!t)throw err("لم يُسند إليك هذا الاختبار.",404);
 if(t.status==="completed")return send(req,{ok:true,already_submitted:true,score:t.score,total:t.total,percent:t.percent});
 if(t.status!=="in_progress")throw err("ابدأ الاختبار أولًا.",409);
 const ids=(t.question_ids||[]).map(String);if(ids.length<5)throw err("عدد الأسئلة غير كافٍ.",409);
 const submittedKeys=Object.keys(answers);
 if(submittedKeys.length!==ids.length||ids.some((qid:string)=>!Object.hasOwn(answers,qid)||!Number.isInteger(answers[qid])||answers[qid]<0||answers[qid]>3))
  throw err("يجب الإجابة عن جميع الأسئلة باختيار واحد لكل سؤال.",400);
 const {data:questions,error:qe}=await db.from("nafes_question_bank").select("id,correct_index").in("id",ids);
 if(qe)throw qe;if((questions||[]).length!==ids.length)throw err("أسئلة القياس غير مكتملة.",409);
 const correct=new Map((questions||[]).map((x:any)=>[String(x.id),x.correct_index]));
 const score=ids.reduce((n:number,qid:string)=>n+(answers[qid]===correct.get(qid)?1:0),0);
 const percent=Math.round(score/ids.length*10000)/100;
 const {data:saved,error:se}=await db.from("tamakkun_indicator_posttests")
  .update({answers,score,total:ids.length,percent,status:"completed",submitted_at:new Date().toISOString()})
  .eq("id",id).eq("student_id",ac.student_id).eq("status","in_progress").select("id,status,score,total,percent").maybeSingle();
 if(se)throw se;if(!saved)throw err("أصبح الاختبار مسلّمًا في جلسة أخرى؛ حدّث الصفحة.",409);
 return send(req,{ok:true,...saved,mastered:percent>=80});
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return send(req,{error:"الطريقة غير مدعومة."},405);
 try{
  const access=await getAccess(req);
  const body=await req.json().catch(()=>({}));
  if(body?.action==="student_ping")return await trackPresence(req,access);
  if(body?.action==="snapshot")return await snapshot(req,access);
  if(body?.action==="attendance_history")return await attendanceHistory(req,body,access);
  if(body?.action==="teacher_review_execution")return await teacherReviewExecution(req,body,access);
  if(body?.action==="teacher_review_decision")return await teacherReviewDecision(req,body,access);
  if(body?.action==="assign_posttest")return await assignPosttest(req,body,access);
  if(body?.action==="posttest_list")return await studentPosttestList(req,access);
  if(body?.action==="posttest_open")return await studentOpenPosttest(req,body,access);
  if(body?.action==="posttest_submit")return await studentSubmitPosttest(req,body,access);
  throw err("العملية غير معروفة.",400);
 }catch(e:any){console.error("tamakkun-student-monitor",e?.message||e);return send(req,{ok:false,error:e?.message||"تعذر تحميل المتابعة.",code:e?.code||null},Number(e?.status)||500)}
});