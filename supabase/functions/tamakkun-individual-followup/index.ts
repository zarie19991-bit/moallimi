import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
const db=createClient(Deno.env.get("SUPABASE_URL"),Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const ORIGINS=new Set(["https://zarie19991-bit.github.io","http://localhost:8000","http://127.0.0.1:8000","http://localhost:5500","http://127.0.0.1:5500"]);
const SUBJECTS=new Set(["reading","math","science"]);
const tidy=x=>String(x??"").trim();
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const ACCESS="tamakkun_followup_events",TARGETS="tamakkun_followup_targets";
const isUuid=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tidy(s));
const dateOk=s=>/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s)&&!Number.isNaN(Date.parse(s+"T12:00:00Z"))&&new Date(s+"T12:00:00Z").toISOString().slice(0,10)===s;
const headers=req=>{const o=req.headers.get("origin")||"";return {"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":ORIGINS.has(o)?o:"https://zarie19991-bit.github.io","Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin","Cache-Control":"no-store"}};
const out=(req,value,status=200)=>new Response(JSON.stringify(value),{status,headers:headers(req)});
async function sha256(text){const x=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return [...new Uint8Array(x)].map(n=>n.toString(16).padStart(2,"0")).join("")}
async function teacher(req){
 const auth=tidy(req.headers.get("authorization")),token=auth.toLowerCase().startsWith("bearer ")?auth.slice(7).trim():"";
 if(!token)throw fail("يلزم تسجيل الدخول بحساب معلم.",401);
 const {data:s,error}=await db.from("lugati_sessions").select("teacher_access_id,role,expires_at").eq("token_hash",await sha256(token)).eq("role","teacher").gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error)throw error;
 if(!s?.teacher_access_id)throw fail("جلسة المعلم غير متاحة أو انتهت.",401);
 const {data:t,error:e}=await db.from("nafes_teacher_access").select("id,subject_scope,active,label").eq("id",s.teacher_access_id).eq("active",true).maybeSingle();
 if(e)throw e;if(!t)throw fail("حساب المعلم غير مفعل.",403);
 if(!["all",...SUBJECTS].includes(t.subject_scope))throw fail("صلاحية المادة غير محددة.",403);
 return {id:t.id,scope:t.subject_scope,label:t.label||"معلم المادة"};
}
async function checkStudent(student_id){
 if(!isUuid(student_id))throw fail("معرّف الطالب غير صحيح.");
 const {data,error}=await db.from("nafes_students").select("id,full_name,class_name,grade").eq("id",student_id).eq("is_active",true).eq("is_demo",false).maybeSingle();
 if(error)throw error;if(!data)throw fail("لا يوجد طالب فعلي نشط بهذا المعرّف.",404);
 return data;
}
function requireSubject(t,subject){
 if(!SUBJECTS.has(subject))throw fail("المادة غير صحيحة.");
 if(t.scope!=="all"&&t.scope!==subject)throw fail("هذه المادة خارج صلاحيات المعلم.",403);
}
async function roster(t){
 const [students,sums,targets,visits]=await Promise.all([
  db.from("nafes_students").select("id,full_name,class_name,grade").eq("is_active",true).eq("is_demo",false).order("class_name").order("full_name").limit(300),
  db.from("tamakkun_followup_student_subject_summary").select("student_id,subject_key,measured_count,weak_count,scored_80_count").limit(1000),
  db.from(TARGETS).select("student_id").limit(300),
  db.from("tamakkun_followup_event_summary").select("student_id,event_count,last_event_date").limit(300)
 ]);
 for(const r of [students,sums,targets,visits])if(r.error)throw r.error;
 const aggregate=new Map();
 for(const x of sums.data||[]){
  if(t.scope!=="all"&&x.subject_key!==t.scope)continue;
  const s=aggregate.get(x.student_id)||{measured:0,weak:0,scored80:0};
  s.measured+=Number(x.measured_count)||0;s.weak+=Number(x.weak_count)||0;s.scored80+=Number(x.scored_80_count)||0;
  aggregate.set(x.student_id,s);
 }
 const targetSet=new Set((targets.data||[]).map(x=>x.student_id));
 const activity=new Map((visits.data||[]).map(x=>[x.student_id,x]));
 return {scope:t.scope,teacher_label:t.label,students:(students.data||[]).map(x=>({...x,followup_target:targetSet.has(x.id),...(aggregate.get(x.id)||{measured:0,weak:0,scored80:0}),last_followup:activity.get(x.id)?.last_event_date||null,event_count:activity.get(x.id)?.event_count||0})),mastery_policy:"الدرجة 80% وحدها ليست اعتماد إتقان"};
}
async function profile(t,body){
 const student=await checkStudent(body.student_id),period=body.period||"week";
 if(!["day","week","month"].includes(period))throw fail("فترة المتابعة غير صحيحة.");
 const date=tidy(body.anchor_date)||new Date().toISOString().slice(0,10);
 if(!dateOk(date))throw fail("تاريخ المتابعة غير صحيح.");
 const d=new Date(date+"T12:00:00Z");let start,end;
 if(period==="day")start=end=date;
 else if(period==="week"){const days=(d.getUTCDay()+1)%7;d.setUTCDate(d.getUTCDate()-days);start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);end=d.toISOString().slice(0,10)}
 else{start=date.slice(0,7)+"-01";d.setUTCMonth(d.getUTCMonth()+1,0);end=d.toISOString().slice(0,10)}
 let query=db.from("tamakkun_followup_latest_evidence").select("subject_key,outcome_code,indicator_index,indicator_text,score,total,percent,submitted_at,source").eq("student_id",student.id).order("subject_key").order("percent",{ascending:true}).limit(300);
 let events=db.from(ACCESS).select("id,event_date,event_type,subject_key,outcome_code,indicator_index,action_type,execution_status,attendance,note,next_date,recipient,delivery_status,teacher_access_id,created_at").eq("student_id",student.id).gte("event_date",start).lte("event_date",end).order("event_date",{ascending:false}).order("id",{ascending:false}).limit(350);
 if(t.scope!=="all"){query=query.eq("subject_key",t.scope);events=events.eq("subject_key",t.scope)}
 const [e,ev,target]=await Promise.all([query,events,db.from(TARGETS).select("student_id").eq("student_id",student.id).maybeSingle()]);
 for(const r of [e,ev,target])if(r.error)throw r.error;
 return {student,period,start,end,scope:t.scope,indicators:e.data||[],events:ev.data||[],events_truncated:(ev.data||[]).length>=350,target:!!target.data,teacher_label:t.label};
}
async function addTargets(t,ids){
 if(t.scope!=="all")throw fail("إدارة المستهدفين متاحة لمنسق المواد فقط.",403);
 if(!Array.isArray(ids)||!ids.length||ids.length>150||new Set(ids).size!==ids.length||!ids.every(isUuid))throw fail("قائمة الطلاب غير صحيحة.");
 const {data:allowed,error}=await db.from("nafes_students").select("id").in("id",ids).eq("is_active",true).eq("is_demo",false);
 if(error)throw error;if((allowed||[]).length!==ids.length)throw fail("تتضمن القائمة طالبًا غير مصرح أو غير نشط.");
 const {error:e}=await db.from(TARGETS).upsert(ids.map(student_id=>({student_id,added_by:t.id})),{onConflict:"student_id",ignoreDuplicates:true});
 if(e)throw e;return {added:ids.length};
}
async function removeTarget(t,id){
 if(t.scope!=="all")throw fail("إدارة المستهدفين متاحة لمنسق المواد فقط.",403);
 await checkStudent(id);const {error}=await db.from(TARGETS).delete().eq("student_id",id);if(error)throw error;return {removed:true};
}
function validateEvent(t,b){
 const event_type=tidy(b.event_type),subject_key=tidy(b.subject_key)||null;
 if(!["intervention","correspondence"].includes(event_type))throw fail("نوع السجل غير صحيح.");
 if(subject_key)requireSubject(t,subject_key);
 if(t.scope!=="all"&&subject_key!==t.scope)throw fail("يجب تحديد مادة المعلم.",403);
 const event_date=tidy(b.event_date),next_date=tidy(b.next_date)||null;
 if(!dateOk(event_date)||(next_date&&!dateOk(next_date)))throw fail("أحد التواريخ غير صحيح.");
 const note=tidy(b.note);if(note.length>1500)throw fail("الملاحظة أطول من المسموح.");
 let outcome_code=tidy(b.outcome_code)||null,indicator_index=b.indicator_index==null||b.indicator_index===""?null:Number(b.indicator_index);
 if(indicator_index!==null&&(!Number.isInteger(indicator_index)||indicator_index<1||indicator_index>100||!subject_key||!outcome_code))throw fail("مرجع المؤشر غير صحيح.");
 if(indicator_index===null)outcome_code=null;
 if(event_type==="intervention"){
  const action_type=tidy(b.action_type),execution_status=tidy(b.execution_status),attendance=tidy(b.attendance);
  if(!["training","homework","lesson","call","meeting","retest","other"].includes(action_type)||!["planned","completed","absent"].includes(execution_status)||!["not_recorded","present","absent"].includes(attendance))throw fail("بيانات متابعة الطالب غير صحيحة.");
  return {event_type,subject_key,indicator_index,outcome_code,event_date,next_date,note,action_type,execution_status,attendance,recipient:null,delivery_status:null};
 }
 const recipient=tidy(b.recipient);
 if(!["parent","vice_principal","counselor"].includes(recipient))throw fail("جهة الخطاب غير صحيحة.");
 return {event_type,subject_key,indicator_index,outcome_code,event_date,next_date,note,action_type:null,execution_status:"planned",attendance:"not_recorded",recipient,delivery_status:"prepared"};
}
async function saveEvent(t,b){
 const student=await checkStudent(b.student_id),item=validateEvent(t,b);
 if(item.indicator_index!==null){
  const {data,error}=await db.from("tamakkun_followup_latest_evidence").select("indicator_index").eq("student_id",student.id).eq("subject_key",item.subject_key).eq("outcome_code",item.outcome_code).eq("indicator_index",item.indicator_index).limit(1);
  if(error)throw error;if(!data?.length)throw fail("لا يوجد قياس معتمد لهذا المؤشر على هذا الطالب.");
 }
 const {data,error}=await db.from(ACCESS).insert({...item,student_id:student.id,teacher_access_id:t.id}).select("id,event_date,event_type,recipient,delivery_status").single();
 if(error)throw error;return {event:data};
}
async function updateDelivery(t,b){
 const id=Number(b.event_id),delivery_status=tidy(b.delivery_status);
 if(!Number.isSafeInteger(id)||id<1||!["delivered","responded"].includes(delivery_status))throw fail("حالة استلام الخطاب غير صحيحة.");
 let find=db.from(ACCESS).select("id,teacher_access_id,subject_key,event_type,delivery_status").eq("id",id).maybeSingle();
 const {data:record,error}=await find;if(error)throw error;
 if(!record||record.event_type!=="correspondence")throw fail("سجل الخطاب غير موجود.",404);
 if(t.scope!=="all"&&(record.teacher_access_id!==t.id||record.subject_key!==t.scope))throw fail("لا يمكنك تعديل خطاب معلم آخر.",403);
 if(!["prepared","delivered"].includes(record.delivery_status))throw fail("لا يمكن تغيير حالة الخطاب الحالية.");
 if(delivery_status==="responded"&&record.delivery_status!=="delivered")throw fail("يجب توثيق التسليم قبل الرد.");
 const {data,error:e}=await db.from(ACCESS).update({delivery_status}).eq("id",id).eq("delivery_status",record.delivery_status).select("id,delivery_status").maybeSingle();
 if(e)throw e;if(!data)throw fail("تغير سجل الخطاب، أعد تحميل الصفحة.",409);
 return {event:data};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=="POST")return out(req,{error:"الطريقة غير مدعومة."},405);
 try{
  const t=await teacher(req);
  const raw=await req.text();if(raw.length>30000)throw fail("الطلب أكبر من المسموح.",413);
  let b;try{b=JSON.parse(raw)}catch{throw fail("محتوى الطلب غير صحيح.")}
  switch(tidy(b.action)){
   case "roster":return out(req,await roster(t));
   case "profile":return out(req,await profile(t,b));
   case "add_targets":return out(req,await addTargets(t,b.student_ids));
   case "remove_target":return out(req,await removeTarget(t,b.student_id));
   case "save_event":return out(req,await saveEvent(t,b));
   case "delivery":return out(req,await updateDelivery(t,b));
   default:throw fail("الإجراء غير مدعوم.");
  }
 }catch(e){const status=[400,401,403,404,409,413].includes(Number(e.status))?e.status:500;return out(req,{error:status===500?"تعذر تشغيل متابعة الطلاب، يرجى مراجعة مسؤول المنصة.":String(e.message||"حدث خطأ")},status)}
});