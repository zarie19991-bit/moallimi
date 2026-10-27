import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ALLOWED=new Set(["https://zarie19991-bit.github.io","http://localhost:8000","http://127.0.0.1:8000","http://localhost:5500","http://127.0.0.1:5500","https://skyblue-cheetah-940953.hostingersite.com"]);
const tidy=(v:unknown)=>String(v??"").trim();
function cors(req:Request){const origin=req.headers.get("origin")||"";const allow=ALLOWED.has(origin)?origin:"https://zarie19991-bit.github.io";return{"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors(req)});
async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");}
type Access={role:"teacher"|"student";student_id?:string;teacher_access_id?:string;subject_scope?:"all"|"reading"|"math"|"science"};
async function requireSession(req:Request):Promise<Access>{
  const auth=tidy(req.headers.get("authorization"));
  const token=auth.toLowerCase().startsWith("bearer ")?auth.slice(7).trim():"";
  if(!token)throw Object.assign(new Error("تسجيل الدخول مطلوب."),{status:401});
  const {data:s,error}=await db.from("lugati_sessions")
    .select("id,role,student_id,teacher_access_id,expires_at")
    .eq("token_hash",await sha256(token))
    .gt("expires_at",new Date().toISOString())
    .maybeSingle();
  if(error)throw error;
  if(!s)throw Object.assign(new Error("انتهت جلسة الدخول أو أصبحت غير صالحة."),{status:401});
  if(s.role==="student"){
    const {data:u,error:e}=await db.from("nafes_students").select("id,is_active").eq("id",s.student_id).eq("is_active",true).maybeSingle();
    if(e)throw e;if(!u)throw Object.assign(new Error("حساب الطالب غير متاح."),{status:401});
    return{role:"student",student_id:String(u.id)};
  }
  const {data:t,error:e}=await db.from("nafes_teacher_access")
    .select("id,active,subject_scope")
    .eq("id",s.teacher_access_id).eq("active",true).maybeSingle();
  if(e)throw e;if(!t)throw Object.assign(new Error("حساب المعلم غير متاح."),{status:401});
  const scope=(["reading","math","science"].includes(String(t.subject_scope))?String(t.subject_scope):"all") as Access["subject_scope"];
  return{role:"teacher",teacher_access_id:String(t.id),subject_scope:scope};
}
function publicRows(data:any[],includeAnswers=false){
  return (data||[]).map((r:any)=>{
    const base:any={id:r.id,subject_key:r.subject_key,outcome_code:r.outcome_code,indicator_index:Number(r.indicator_index||0),indicator_text:r.indicator_text||"",context_text:r.context_text||"",question_text:r.question_text||"",options:Array.isArray(r.options)?r.options:[],difficulty:r.difficulty||"",cognitive_level:r.cognitive_level||"",question_no:Number(r.question_no||0),model_no:Number(r.model_no||0)};
    if(includeAnswers){base.correct_index=Number(r.correct_index);base.explanation=r.explanation||"";base.measurement_focus=r.measurement_focus||"";base.alignment_verified=r.alignment_verified===true;}
    return base;
  });
}
const STOP=new Set(["ما","من","في","على","إلى","عن","هو","هي","هذا","هذه","ذلك","التي","الذي","وفق","وفقًا","قول","الكاتب","النص","الفقرة","لماذا","كيف","أقرب","معنى","المقصود","يدل","عبارة"]);
function tokens(v:string){return tidy(v).replace(/[«»"”“()[\]{}،,:؛؟.!ـ]/g," ").split(/\s+/).map(x=>x.replace(/^[وفبالكل]+(?=.{3,})/,"")).filter(x=>x.length>=3&&!STOP.has(x));}
function shortReadingContext(context:string,question:string,explanation:string){
 const full=tidy(context);if(!full)return"";
 const paras=full.split(/\n\s*\n+/).map(tidy).filter(Boolean);
 if(paras.length<=1&&full.length<=390)return full;
 const quoted=[...String(question||"").matchAll(/[«"]([^»"]{2,80})[»"]/g)].map(m=>tidy(m[1]));
 const keys=[...new Set([...tokens(question),...tokens(explanation)])].slice(0,24);
 const score=(p:string)=>quoted.reduce((n,q)=>n+(q&&p.includes(q)?12:0),0)+keys.reduce((n,k)=>n+(p.includes(k)?1:0),0);
 let best=paras[0]||full,bestScore=-1;for(const p of paras){const s=score(p);if(s>bestScore){best=p;bestScore=s}}
 const sents=best.split(/(?<=[.!؟؛])\s+/).map(tidy).filter(Boolean);
 if(!sents.length)return best.slice(0,520);
 let focus=0,fs=-1;for(let i=0;i<sents.length;i++){const s=score(sents[i]);if(s>fs){fs=s;focus=i}}
 const chosen:string[]=[];let chars=0;
 for(let radius=0;radius<sents.length&&chosen.length<5;radius++){
   const idxs=radius===0?[focus]:[focus-radius,focus+radius];
   for(const idx of idxs){if(idx<0||idx>=sents.length||chosen.includes(sents[idx]))continue;const add=sents[idx];if(chars+add.length>390&&chosen.length>=2)continue;chosen.push(add);chars+=add.length;}
 }
 chosen.sort((a,b)=>sents.indexOf(a)-sents.indexOf(b));
 let out=chosen.join(" ");
 if(out.length>390){let cut=out.slice(0,390);const last=Math.max(cut.lastIndexOf("؟"),cut.lastIndexOf("."),cut.lastIndexOf("؛"));out=last>220?cut.slice(0,last+1):cut.replace(/\s+\S*$/,"")+"…";}
 return out;
}
function trainingRows(data:any[],trainingMode:boolean,includeAnswers=false){return publicRows(data,includeAnswers).map((r:any)=>trainingMode&&r.subject_key==="reading"?{...r,context_text:shortReadingContext(r.context_text,r.question_text,includeAnswers?r.explanation:"")}:r);}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
 try{
  const access=await requireSession(req);
  const body=await req.json().catch(()=>({}));
  const action=tidy(body?.action||"list");

  if(action==="check"){
    if(access.role!=="student")return json(req,{error:"هذه العملية مخصصة للطالب."},403);
    const questionId=tidy(body?.question_id),selected=Number(body?.selected_index);
    if(!questionId||!Number.isInteger(selected)||selected<0||selected>3)return json(req,{error:"الإجابة غير مكتملة."},400);
    const {data:q,error}=await db.from("nafes_question_bank")
      .select("id,correct_index,explanation")
      .eq("id",questionId).eq("grade_key","middle_3").eq("review_status","approved").eq("is_active",true)
      .maybeSingle();
    if(error)throw error;if(!q)return json(req,{error:"السؤال غير متاح."},404);
    const correct=selected===Number(q.correct_index);
    return json(req,{ok:true,correct,correct_index:Number(q.correct_index),explanation:q.explanation||""});
  }

  if(action!=="list")return json(req,{error:"action_not_supported"},400);
  let subject=tidy(body?.subject_key);
  const scope=access.role==="teacher"?(access.subject_scope||"all"):"all";
  if(access.role==="teacher"&&scope!=="all"){
    if(subject&&subject!==scope)return json(req,{error:"هذه المادة خارج صلاحية حسابك."},403);
    subject=scope;
  }
  const outcome=tidy(body?.outcome_code);
  const indicatorRaw=Number(body?.indicator_index);
  const indicator=Number.isFinite(indicatorRaw)&&indicatorRaw>0?Math.trunc(indicatorRaw):null;
  const validSubject=["reading","math","science"].includes(subject);
  const trainingMode=body?.training_mode===true;
  const includeAnswers=access.role==="teacher";

  if(validSubject&&!outcome&&!indicator){
    const {data,error}=await db.rpc("lugati_question_bank_sample",{p_subject:subject,p_per_indicator:8});
    if(error)throw error;
    return json(req,{ok:true,mode:"balanced_indicator_sample",rows:trainingRows(data||[],trainingMode,includeAnswers)});
  }

  const requested=Number(body?.limit??60);
  const limit=Math.max(1,Math.min(120,Number.isFinite(requested)?Math.trunc(requested):60));
  let q=db.from("nafes_question_bank")
   .select("id,subject_key,outcome_code,indicator_index,indicator_text,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level,question_no,model_no,measurement_focus,alignment_verified")
   .eq("grade_key","middle_3").eq("review_status","approved").eq("is_active",true)
   .order("subject_key",{ascending:true}).order("outcome_code",{ascending:true})
   .order("indicator_index",{ascending:true}).order("model_no",{ascending:true})
   .order("question_no",{ascending:true}).limit(limit);
  if(validSubject)q=q.eq("subject_key",subject);
  if(outcome)q=q.eq("outcome_code",outcome);
  if(indicator)q=q.eq("indicator_index",indicator);
  const {data,error}=await q;if(error)throw error;
  return json(req,{ok:true,mode:"filtered",rows:trainingRows(data||[],trainingMode,includeAnswers)});
 }catch(error){
  console.error("lugati-question-bank-read",error);
  const status=error&&typeof error==="object"&&"status" in error?Number((error as any).status):500;
  return json(req,{error:status===500?"تعذر قراءة بنك الأسئلة الآن.":String((error as Error).message)},status);
 }
});
