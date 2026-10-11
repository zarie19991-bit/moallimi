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
async function snapshot(req:Request,ac:any){
 if(ac.role!=="teacher")throw err("التقرير متاح للمعلم فقط.",403);
 const roster=await collect("nafes_students","id,full_name,grade,class_name,is_active,is_demo",q=>q.eq("is_active",true).eq("is_demo",false),3500);
 const ids=roster.map(s=>String(s.id));
 const [sessions,tasks,evidence]=await Promise.all([
  collect("lugati_sessions","id,student_id,created_at,last_seen_at,expires_at",q=>q.eq("role","student").in("student_id",ids),10000),
  collect("lugati_teacher_tasks","id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,tier,status,assigned_at,started_at,completed_at,score,total,percent,source_attempt_id,source_percent,source_submitted_at,response,teacher_access_id",q=>q.in("student_id",ids).neq("status","revoked").order("id",{ascending:true}),15000),
  collect("tamakkun_indicator_evidence","id,attempt_id,student_id,subject_key,outcome_code,indicator_index,indicator_text,score,total,answered,knowledge_score,knowledge_total,application_score,application_total,reasoning_score,reasoning_total,submitted_at",q=>ac.scope==="all"?q:q.eq("subject_key",ac.scope),20000)
 ]);
 const allowed=new Set(ids);
 const safeTasks=tasks.filter(t=>allowed.has(String(t.student_id))&&(ac.scope==="all"||t.subject_key===ac.scope))
   .map(t=>{const answerCount=t.response?.answers&&typeof t.response.answers==="object"&&!Array.isArray(t.response.answers)?Object.keys(t.response.answers).length:0;
     return {id:t.id,student_id:t.student_id,subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:t.indicator_index,indicator_text:t.indicator_text,title:t.title,tier:t.tier,status:t.status,assigned_at:t.assigned_at,started_at:t.started_at,completed_at:t.completed_at,score:t.score,total:t.total,percent:t.percent,source_attempt_id:t.source_attempt_id,source_percent:t.source_percent,source_submitted_at:t.source_submitted_at,
       solved:t.status==="completed"&&!!t.completed_at&&t.total>0&&t.score!=null&&answerCount>0,answer_count:answerCount}
   });
 const validEvidence=evidence.filter(e=>allowed.has(String(e.student_id))&&e.total>0&&e.score!=null);
 const catalog=new Map<string,any>();
 for(const e of validEvidence){
  const key=[e.subject_key,e.outcome_code,e.indicator_index].join("|");
  if(!catalog.has(key))catalog.set(key,{key,subject_key:e.subject_key,outcome_code:e.outcome_code,indicator_index:e.indicator_index,indicator_text:e.indicator_text||"المؤشر "+e.indicator_index});
 }
 for(const t of safeTasks){const key=[t.subject_key,t.outcome_code,t.indicator_index].join("|");if(!catalog.has(key))catalog.set(key,{key,subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:t.indicator_index,indicator_text:t.indicator_text||"المؤشر "+t.indicator_index})}
 return send(req,{ok:true,generated_at:new Date().toISOString(),scope:ac.scope,
    students:roster,sessions:sessions.filter(s=>allowed.has(String(s.student_id))),tasks:safeTasks,
    evidence:validEvidence,indicators:[...catalog.values()],criteria:{mastery_percent:80,min_reliable_questions:5,online_within_minutes:5}});
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return send(req,{error:"الطريقة غير مدعومة."},405);
 try{
  const access=await getAccess(req);
  const body=await req.json().catch(()=>({}));
  if(body?.action==="student_ping")return await trackPresence(req,access);
  if(body?.action==="snapshot")return await snapshot(req,access);
  throw err("العملية غير معروفة.",400);
 }catch(e:any){console.error("tamakkun-student-monitor",e?.message||e);return send(req,{ok:false,error:e?.message||"تعذر تحميل المتابعة.",code:e?.code||null},Number(e?.status)||500)}
});