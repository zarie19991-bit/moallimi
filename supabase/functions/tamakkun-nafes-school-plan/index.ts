import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const db=createClient(Deno.env.get("SUPABASE_URL"),Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const ALLOWED=new Set(["https://zarie19991-bit.github.io","http://localhost:8000","http://127.0.0.1:8000","http://localhost:5500","http://127.0.0.1:5500"]);
const SUBJECT_BY_ACTION={r1:"reading",r2:"reading",r3:"reading",r4:"reading",m1:"math",m2:"math",m3:"math",m4:"math",m5:"math",m6:"math",s1:"science",s2:"science",s3:"science",s4:"science",s5:"science"};
const TABLE="tamakkun_nafes_school_plan_entries";
const tidy=v=>String(v??"").trim();
function headers(req){
 const origin=req.headers.get("origin")||"";
 return {"Access-Control-Allow-Origin":ALLOWED.has(origin)?origin:"https://zarie19991-bit.github.io","Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Max-Age":"600","Cache-Control":"no-store","Vary":"Origin","Content-Type":"application/json; charset=utf-8"};
}
const output=(req,obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:headers(req)});
const err=(message,status)=>Object.assign(new Error(message),{status});
async function sha256(value){
 const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function teacherSession(req){
 const auth=tidy(req.headers.get("authorization"));
 const token=auth.toLowerCase().startsWith("bearer ")?auth.slice(7).trim():"";
 if(!token)throw err("سجل الدخول بحساب معلم أولًا.",401);
 const {data:s,error:e}=await db.from("lugati_sessions").select("teacher_access_id,role,expires_at").eq("token_hash",await sha256(token)).eq("role","teacher").gt("expires_at",new Date().toISOString()).maybeSingle();
 if(e)throw e;
 if(!s?.teacher_access_id)throw err("جلسة المعلم غير صالحة أو انتهت.",401);
 const {data:t,error:te}=await db.from("nafes_teacher_access").select("id,active,subject_scope").eq("id",s.teacher_access_id).eq("active",true).maybeSingle();
 if(te)throw te;
 if(!t)throw err("صلاحية المعلم غير متاحة.",403);
 if(!["reading","math","science","all"].includes(t.subject_scope))throw err("صلاحية المادة غير محددة في حساب المعلم.",403); const scope=t.subject_scope;
 return {id:t.id,scope};
}
const numeric=v=>{
 if(v===null||v===undefined||v==="")return null;
 const n=Number(v);
 if(!Number.isFinite(n)||n<0||n>100)throw err("نتيجة القياس يجب أن تكون بين صفر و100.",400);
 return Math.round(n*10)/10;
};
function validate(body,teacher){
 const action_code=tidy(body.action_code);
 const subject=SUBJECT_BY_ACTION[action_code];
 if(!subject)throw err("الإجراء غير موجود في الخطة المعتمدة.",400);
 if(teacher.scope!=="all"&&teacher.scope!==subject)throw err("الإجراء خارج صلاحية مادة المعلم.",403);
 const week_no=Number(body.week_no);
 if(!Number.isInteger(week_no)||week_no<1||week_no>8)throw err("رقم الأسبوع يجب أن يكون من 1 إلى 8.",400);
 const status=tidy(body.status);
 if(!["planned","in_progress","completed"].includes(status))throw err("حالة التنفيذ غير صحيحة.",400);
 const evidence_note=tidy(body.evidence_note),evidence_url=tidy(body.evidence_url);
 if(evidence_note.length>2000)throw err("وصف الشاهد يتجاوز الحد المسموح.",400);
 if(evidence_url.length>500||(evidence_url&&!/^https:\/\/[a-z0-9]/i.test(evidence_url)))throw err("رابط الشاهد يجب أن يبدأ بـ https:// وألا يتجاوز 500 حرف.",400);
 return {action_code,week_no,status,evidence_note,evidence_url,pre_measure:numeric(body.pre_measure),post_measure:numeric(body.post_measure),updated_by:teacher.id,updated_at:new Date().toISOString()};
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=="POST")return output(req,{error:"الطلب غير مدعوم."},405);
 try{
  const teacher=await teacherSession(req);
  const raw=await req.text();
  if(raw.length>12000)throw err("حجم الطلب أكبر من المسموح.",413);
  let body={};try{body=JSON.parse(raw)}catch{throw err("بيانات الطلب غير صحيحة.",400)}
  if(body.action==="list"){
   const allowed=Object.keys(SUBJECT_BY_ACTION).filter(k=>teacher.scope==="all"||SUBJECT_BY_ACTION[k]===teacher.scope);
   const {data,error:e}=await db.from(TABLE).select("action_code,week_no,status,pre_measure,post_measure,evidence_note,evidence_url,updated_at").in("action_code",allowed).order("action_code").order("week_no");
   if(e)throw e;
   return output(req,{scope:teacher.scope,entries:data||[],reference:"تحليل نافس ثالث متوسط 1447، صفحات 6 و9 و12"});
  }
  if(body.action==="save"){
   const row=validate(body,teacher);
   const {data,error:e}=await db.from(TABLE).upsert(row,{onConflict:"action_code,week_no"}).select("action_code,week_no,status,pre_measure,post_measure,evidence_note,evidence_url,updated_at").single();
   if(e)throw e;
   return output(req,{entry:data,ok:true});
  }
  throw err("الإجراء المطلوب غير متاح.",400);
 }catch(error){
  const status=[400,401,403,405,413].includes(Number(error?.status))?error.status:500;
  const message=status===500?"تعذر حفظ أو قراءة المتابعة. يرجى مراجعة مسؤول المنصة.":String(error?.message||"حدث خطأ.");
  return output(req,{error:message},status);
 }
});