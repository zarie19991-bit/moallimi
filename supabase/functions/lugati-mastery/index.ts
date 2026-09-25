import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ALLOWED=new Set([
  "https://zarie19991-bit.github.io",
  "http://localhost:8000","http://127.0.0.1:8000",
  "http://localhost:5500","http://127.0.0.1:5500",
  "https://skyblue-cheetah-940953.hostingersite.com"
]);
const tidy=(v:unknown)=>String(v??"").trim();
function cors(req:Request){const origin=req.headers.get("origin")||"";const allow=ALLOWED.has(origin)?origin:"https://zarie19991-bit.github.io";return{"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors(req)});
async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");}
type SubjectScope="all"|"reading"|"math"|"science";
type Access={role:"teacher"|"student";student_id?:string;teacher_access_id?:string;subject_scope?:SubjectScope};
const teacherScope=(a:Access):SubjectScope=>a.role==="teacher"?(a.subject_scope||"all"):"all";
const teacherAllows=(a:Access,s:unknown)=>a.role!=="teacher"||teacherScope(a)==="all"||teacherScope(a)===tidy(s);
async function requireAccess(req:Request):Promise<Access>{
  const auth=tidy(req.headers.get("authorization"));
  const token=auth.toLowerCase().startsWith("bearer ")?auth.slice(7).trim():"";
  if(!token)throw Object.assign(new Error("تسجيل الدخول مطلوب."),{status:401});
  const {data:s,error}=await db.from("lugati_sessions").select("id,role,student_id,teacher_access_id,expires_at").eq("token_hash",await sha256(token)).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(error)throw error;
  if(!s)throw Object.assign(new Error("انتهت جلسة الدخول أو أصبحت غير صالحة."),{status:401});
  if(s.role==="student"){
    const {data:u,error:e}=await db.from("nafes_students").select("id,is_active").eq("id",s.student_id).eq("is_active",true).maybeSingle();
    if(e)throw e;if(!u)throw Object.assign(new Error("حساب الطالب غير متاح."),{status:401});
    return{role:"student",student_id:String(u.id)};
  }
  const {data:t,error:te}=await db.from("nafes_teacher_access").select("id,active,subject_scope").eq("id",s.teacher_access_id).eq("active",true).maybeSingle();
  if(te)throw te;if(!t)throw Object.assign(new Error("حساب المعلم غير متاح."),{status:401});
  return{role:"teacher",teacher_access_id:String(t.id),subject_scope:(["reading","math","science"].includes(String(t.subject_scope))?String(t.subject_scope):"all") as SubjectScope};
}
function riyadhDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function phaseLabel(p:string){return p==="guided"?"تدريب موجه":p==="independent"?"تدريب مستقل":p==="check"?"تحقق من الإتقان":p==="review"?"مراجعة تثبيت":p==="enrichment"?"إثراء":"تدريب";}
function shuffle<T>(a:T[]){const x=[...a];for(let i=x.length-1;i>0;i--){const b=new Uint32Array(1);crypto.getRandomValues(b);const j=b[0]%(i+1);[x[i],x[j]]=[x[j],x[i]];}return x;}
function desiredCount(p:string){return p==="check"?5:p==="enrichment"?5:4;}
const SHORT_STOP=new Set(["ما","من","في","على","إلى","عن","هو","هي","هذا","هذه","ذلك","التي","الذي","وفق","قول","الكاتب","النص","الفقرة","لماذا","كيف","أقرب","معنى","المقصود","يدل","عبارة"]);
function shortTokens(v:string){return tidy(v).replace(/[«»"”“()[\]{}،,:؛؟.!ـ]/g," ").split(/\s+/).map(x=>x.replace(/^[وفبالكل]+(?=.{3,})/,"")).filter(x=>x.length>=3&&!SHORT_STOP.has(x));}
function shortReadingContext(context:string,question:string){
  const full=tidy(context);if(!full)return"";
  const paras=full.split(/\n\s*\n+/).map(tidy).filter(Boolean);if(paras.length<=1&&full.length<=520)return full;
  const quoted=[...String(question||"").matchAll(/[«"]([^»"]{2,80})[»"]/g)].map(m=>tidy(m[1])),keys=[...new Set(shortTokens(question))].slice(0,18);
  const score=(p:string)=>quoted.reduce((n,q)=>n+(q&&p.includes(q)?12:0),0)+keys.reduce((n,k)=>n+(p.includes(k)?1:0),0);
  let best=paras[0]||full,bestScore=-1;for(const p of paras){const s=score(p);if(s>bestScore){best=p;bestScore=s}}
  if(best.length<=520)return best;
  const sents=best.split(/(?<=[.!؟؛])\s+/).map(tidy).filter(Boolean);let focus=0,fs=-1;for(let i=0;i<sents.length;i++){const s=score(sents[i]);if(s>fs){fs=s;focus=i}}
  const chosen:string[]=[];let chars=0;for(let radius=0;radius<sents.length&&chosen.length<5;radius++){for(const idx of(radius===0?[focus]:[focus-radius,focus+radius])){if(idx<0||idx>=sents.length||chosen.includes(sents[idx]))continue;const add=sents[idx];if(chars+add.length>520&&chosen.length>=2)continue;chosen.push(add);chars+=add.length}}
  chosen.sort((a,b)=>sents.indexOf(a)-sents.indexOf(b));let out=chosen.join(" ");if(out.length>520)out=out.slice(0,520).replace(/\s+\S*$/,"")+"…";return out;
}
function nextPhaseFrom(status:string|null,tier:string|null){
  if(status==="review_due")return"review";
  if(status==="mastered")return tier==="enrichment"?"enrichment":"review";
  if(status==="check")return"check";
  if(status==="independent")return"independent";
  if(status==="guided"||status==="learning"||status==="needs_remediation")return"guided";
  if(tier==="enrichment")return"check";
  if(tier==="reinforcement")return"independent";
  return"guided";
}
async function pilotBlueprints(){
  const {data,error}=await db.from("lugati_mastery_blueprints").select("*").eq("active",true).eq("pilot",true).order("subject_key").order("indicator_index");
  if(error)throw error;return data||[];
}
async function componentsFor(ids:string[]){
  if(!ids.length)return[];
  const {data,error}=await db.from("lugati_mastery_components").select("*").in("blueprint_id",ids).eq("required",true).order("sort_order");
  if(error)throw error;return data||[];
}
async function progressFor(studentId:string,componentIds:string[]){
  if(!componentIds.length)return[];
  const {data,error}=await db.from("lugati_student_component_progress").select("*").eq("student_id",studentId).in("component_id",componentIds);
  if(error)throw error;return data||[];
}
function safeBlueprint(b:any){return{id:b.id,subject_key:b.subject_key,outcome_code:b.outcome_code,indicator_index:b.indicator_index,indicator_text:b.indicator_text,student_goal:b.student_goal,recognition_cues:b.recognition_cues||[],strategy_steps:b.strategy_steps||[],common_errors:b.common_errors||[],mastery_threshold:Number(b.mastery_threshold||90)}}
function safeComponent(c:any,p:any=null){return{id:c.id,blueprint_id:c.blueprint_id,component_key:c.component_key,title:c.title,objective:c.objective,explanation:c.explanation,recognition_cues:c.recognition_cues||[],strategy_steps:c.strategy_steps||[],common_errors:c.common_errors||[],worked_example:c.worked_example||{},sort_order:c.sort_order,progress:p?{status:p.status,mastery_percent:p.mastery_percent,guided_attempts:p.guided_attempts,independent_attempts:p.independent_attempts,check_attempts:p.check_attempts,review_attempts:p.review_attempts,enrichment_attempts:p.enrichment_attempts,total_hints:p.total_hints,last_activity_at:p.last_activity_at,mastered_at:p.mastered_at,next_review_at:p.next_review_at}:null}}

async function myOverview(req:Request,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  const bs=await pilotBlueprints(),cs=await componentsFor(bs.map((x:any)=>String(x.id))),ps=await progressFor(access.student_id!,cs.map((x:any)=>String(x.id)));
  const pm=new Map(ps.map((p:any)=>[String(p.component_id),p]));
  const {data:assign,error:ae}=await db.from("lugati_adaptive_assignments").select("subject_key,outcome_code,indicator_index,tier,status,priority,source_percent,last_training_percent").eq("student_id",access.student_id!).order("priority",{ascending:true});
  if(ae)throw ae;
  const am=new Map((assign||[]).map((a:any)=>[a.subject_key+"|"+a.outcome_code+"|"+a.indicator_index,a]));
  const blueprints=bs.map((b:any)=>{
    const key=b.subject_key+"|"+b.outcome_code+"|"+b.indicator_index,a=am.get(key)||null;
    const parts=cs.filter((c:any)=>String(c.blueprint_id)===String(b.id)).map((c:any)=>safeComponent(c,pm.get(String(c.id))));
    const mastered=parts.filter((x:any)=>x.progress?.status==="mastered").length;
    return{...safeBlueprint(b),assignment:a,components:parts,mastered_components:mastered,total_components:parts.length,mastery_ready:parts.length>0&&mastered===parts.length};
  });
  const answered=(ps||[]).filter((p:any)=>p.status==="mastered").length;
  return json(req,{ok:true,blueprints,totals:{pilot_indicators:bs.length,components:cs.length,mastered_components:answered}});
}

async function today(req:Request,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  const date=riyadhDate();
  const {data:existing,error:ee}=await db.from("lugati_daily_missions").select("*,lugati_mastery_blueprints(subject_key,outcome_code,indicator_index,indicator_text,student_goal),lugati_mastery_components(component_key,title,objective,sort_order)").eq("student_id",access.student_id!).eq("mission_date",date).order("assigned_at");
  if(ee)throw ee;
  if(existing?.length)return json(req,{ok:true,date,missions:existing});
  const bs=await pilotBlueprints(),cs=await componentsFor(bs.map((x:any)=>String(x.id))),ps=await progressFor(access.student_id!,cs.map((x:any)=>String(x.id)));
  const pm=new Map(ps.map((p:any)=>[String(p.component_id),p]));
  const bm=new Map(bs.map((b:any)=>[String(b.id),b]));
  const now=Date.now();
  const missions:any[]=[];
  const due=cs.find((c:any)=>{const p=pm.get(String(c.id));return p?.next_review_at&&new Date(p.next_review_at).getTime()<=now;});
  if(due)missions.push({student_id:access.student_id,mission_date:date,blueprint_id:due.blueprint_id,component_id:due.id,mission_type:"review",status:"assigned"});
  const {data:assign,error:ae}=await db.from("lugati_adaptive_assignments").select("subject_key,outcome_code,indicator_index,tier,status,priority,source_percent").eq("student_id",access.student_id!).order("priority",{ascending:true});
  if(ae)throw ae;
  let learning:any=null,learningTier:string|null=null;
  for(const a of assign||[]){
    const b=bs.find((x:any)=>x.subject_key===a.subject_key&&x.outcome_code===a.outcome_code&&Number(x.indicator_index)===Number(a.indicator_index));
    if(!b)continue;
    const c=cs.find((x:any)=>String(x.blueprint_id)===String(b.id)&&pm.get(String(x.id))?.status!=="mastered")||cs.find((x:any)=>String(x.blueprint_id)===String(b.id));
    if(c){learning=c;learningTier=a.tier;break;}
  }
  if(learning&&!missions.some(m=>String(m.component_id)===String(learning.id)))missions.push({student_id:access.student_id,mission_date:date,blueprint_id:learning.blueprint_id,component_id:learning.id,mission_type:"learn",status:"assigned"});
  const mastered=cs.find((c:any)=>pm.get(String(c.id))?.status==="mastered"&&!missions.some(m=>String(m.component_id)===String(c.id)));
  if(mastered)missions.push({student_id:access.student_id,mission_date:date,blueprint_id:mastered.blueprint_id,component_id:mastered.id,mission_type:"challenge",status:"assigned"});
  if(missions.length){
    const {data:ins,error:ie}=await db.from("lugati_daily_missions").insert(missions.slice(0,3)).select("*,lugati_mastery_blueprints(subject_key,outcome_code,indicator_index,indicator_text,student_goal),lugati_mastery_components(component_key,title,objective,sort_order)");
    if(ie)throw ie;return json(req,{ok:true,date,missions:ins||[],recommended_phase:learning?nextPhaseFrom(pm.get(String(learning.id))?.status||null,learningTier):null});
  }
  return json(req,{ok:true,date,missions:[],recommended_phase:null,message:"لا توجد مهمة تجريبية من المؤشرات الثلاثة المفعلة لهذا الطالب اليوم."});
}

async function startPhase(req:Request,body:any,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  const componentId=tidy(body?.component_id),phase=tidy(body?.phase);
  if(!componentId||!["guided","independent","check","review","enrichment"].includes(phase))return json(req,{error:"بيانات التدريب غير مكتملة."},400);
  const {data:c,error:ce}=await db.from("lugati_mastery_components").select("*,lugati_mastery_blueprints(*)").eq("id",componentId).maybeSingle();
  if(ce)throw ce;if(!c||!c.lugati_mastery_blueprints?.active)return json(req,{error:"نقطة الإتقان غير متاحة."},404);
  const {data:tags,error:te}=await db.from("lugati_mastery_question_tags").select("question_id,weight").eq("component_id",componentId).eq("phase",phase).eq("active",true);
  if(te)throw te;
  let tagRows=tags||[];
  if(!tagRows.length&&phase!=="guided"){
    const {data:fallback,error:fe}=await db.from("lugati_mastery_question_tags").select("question_id,weight").eq("component_id",componentId).eq("phase","guided").eq("active",true);
    if(fe)throw fe;tagRows=fallback||[];
  }
  if(!tagRows.length)return json(req,{error:"لا توجد أسئلة محكمة كافية لهذه النقطة حاليًا."},409);
  const ids=tagRows.map((x:any)=>x.question_id);
  const {data:qs,error:qe}=await db.from("nafes_question_bank").select("id,context_text,question_text,options,difficulty,cognitive_level").in("id",ids).eq("is_active",true);
  if(qe)throw qe;
  const {data:recent,error:re}=await db.from("lugati_mastery_question_events").select("question_id,submitted_at").eq("student_id",access.student_id!).eq("component_id",componentId).order("submitted_at",{ascending:false}).limit(80);
  if(re)throw re;
  const recentSet=new Set((recent||[]).map((x:any)=>String(x.question_id)));
  let usable=(qs||[]).filter((q:any)=>!(String(q.question_text||"").includes("في الشكل")&&!tidy(q.context_text)));
  const unseen=shuffle(usable.filter((q:any)=>!recentSet.has(String(q.id)))),seen=shuffle(usable.filter((q:any)=>recentSet.has(String(q.id))));
  const picked=[...unseen,...seen].slice(0,Math.min(desiredCount(phase),usable.length));
  if(!picked.length)return json(req,{error:"لا توجد أسئلة قابلة للعرض لهذه النقطة حاليًا."},409);
  const {data:s,error:se}=await db.from("lugati_mastery_sessions").insert({student_id:access.student_id,component_id:componentId,phase,question_ids:picked.map((q:any)=>q.id),status:"active",total:picked.length}).select("id").single();
  if(se)throw se;
  const current={student_id:access.student_id,component_id:componentId,status:phase==="guided"?"guided":phase==="independent"?"independent":phase==="check"?"check":phase==="review"?"review_due":"mastered",last_activity_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const {error:pe}=await db.from("lugati_student_component_progress").upsert(current,{onConflict:"student_id,component_id"});
  if(pe)throw pe;
  const b=c.lugati_mastery_blueprints;
  const shown=b.subject_key==="reading"?picked.map((q:any)=>({...q,context_text:shortReadingContext(q.context_text,q.question_text)})):picked;
  return json(req,{ok:true,session_id:s.id,phase,phase_label:phaseLabel(phase),blueprint:safeBlueprint(b),component:safeComponent(c),questions:shown});
}

async function hint(req:Request,body:any,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  const sessionId=tidy(body?.session_id),questionId=tidy(body?.question_id);
  const {data:s,error:se}=await db.from("lugati_mastery_sessions").select("id,student_id,component_id,phase,question_ids,status").eq("id",sessionId).eq("student_id",access.student_id!).maybeSingle();
  if(se)throw se;if(!s||s.status!=="active")return json(req,{error:"جلسة التدريب غير متاحة."},404);
  if(s.phase!=="guided")return json(req,{error:"التلميحات متاحة في التدريب الموجه فقط."},403);
  if(!Array.isArray(s.question_ids)||!s.question_ids.map(String).includes(questionId))return json(req,{error:"السؤال لا ينتمي لهذه الجلسة."},400);
  const {count,error:he}=await db.from("lugati_mastery_hint_events").select("id",{count:"exact",head:true}).eq("session_id",sessionId).eq("question_id",questionId);
  if(he)throw he;const level=Math.min(3,Number(count||0)+1);
  const {data:c,error:ce}=await db.from("lugati_mastery_components").select("recognition_cues,strategy_steps,common_errors").eq("id",s.component_id).single();
  if(ce)throw ce;
  const rc=Array.isArray(c.recognition_cues)?c.recognition_cues:[],st=Array.isArray(c.strategy_steps)?c.strategy_steps:[],er=Array.isArray(c.common_errors)?c.common_errors:[];
  let message=level===1?(rc[0]||"حدد المطلوب في السؤال أولًا."):level===2?(st.slice(0,2).join(" ← ")||"ارجع إلى خطوات الحل الخاصة بهذه النقطة."):("تجنب هذا الخطأ الشائع: "+(er[0]||"لا تتسرع في اختيار أول إجابة تبدو مناسبة."));
  const {error:ie}=await db.from("lugati_mastery_hint_events").upsert({session_id:sessionId,student_id:access.student_id,component_id:s.component_id,question_id:questionId,hint_level:level},{onConflict:"session_id,question_id,hint_level"});
  if(ie)throw ie;
  return json(req,{ok:true,level,message});
}

async function answer(req:Request,body:any,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  const sessionId=tidy(body?.session_id),questionId=tidy(body?.question_id),selected=Number(body?.selected_index);
  const elapsed=Number(body?.elapsed_seconds),changes=Math.max(0,Number(body?.answer_changes||0));
  if(!sessionId||!questionId||!Number.isInteger(selected)||selected<0)return json(req,{error:"الإجابة غير مكتملة."},400);
  const {data:s,error:se}=await db.from("lugati_mastery_sessions").select("id,student_id,component_id,phase,question_ids,status").eq("id",sessionId).eq("student_id",access.student_id!).maybeSingle();
  if(se)throw se;if(!s||s.status!=="active")return json(req,{error:"جلسة التدريب غير متاحة."},404);
  if(!Array.isArray(s.question_ids)||!s.question_ids.map(String).includes(questionId))return json(req,{error:"السؤال لا ينتمي لهذه الجلسة."},400);
  const {data:old,error:oe}=await db.from("lugati_mastery_question_events").select("id,correct").eq("session_id",sessionId).eq("question_id",questionId).maybeSingle();
  if(oe)throw oe;if(old)return json(req,{error:"تم تسجيل إجابة هذا السؤال بالفعل."},409);
  const {data:q,error:qe}=await db.from("nafes_question_bank").select("id,options,correct_index,explanation").eq("id",questionId).eq("is_active",true).maybeSingle();
  if(qe)throw qe;if(!q)return json(req,{error:"السؤال غير متاح."},404);
  const {count:hints,error:he}=await db.from("lugati_mastery_hint_events").select("id",{count:"exact",head:true}).eq("session_id",sessionId).eq("question_id",questionId);
  if(he)throw he;
  const correct=selected===Number(q.correct_index),hintCount=Number(hints||0);
  const {error:ie}=await db.from("lugati_mastery_question_events").insert({session_id:sessionId,student_id:access.student_id,component_id:s.component_id,question_id:questionId,phase:s.phase,selected_index:selected,correct,first_try:true,hints_used:hintCount,answer_changes:changes,elapsed_seconds:Number.isFinite(elapsed)?Math.max(0,Math.round(elapsed)):null});
  if(ie)throw ie;
  const {data:c,error:ce}=await db.from("lugati_mastery_components").select("objective,common_errors").eq("id",s.component_id).single();if(ce)throw ce;
  return json(req,{ok:true,correct,correct_index:Number(q.correct_index),explanation:q.explanation||"راجع طريقة التفكير في هذه النقطة.",objective:c.objective,common_error:!correct&&Array.isArray(c.common_errors)?c.common_errors[0]:null});
}

async function finishPhase(req:Request,body:any,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  const sessionId=tidy(body?.session_id);
  const {data:s,error:se}=await db.from("lugati_mastery_sessions").select("*").eq("id",sessionId).eq("student_id",access.student_id!).maybeSingle();
  if(se)throw se;if(!s||s.status!=="active")return json(req,{error:"جلسة التدريب غير متاحة."},404);
  const {data:ev,error:ee}=await db.from("lugati_mastery_question_events").select("correct,hints_used,answer_changes").eq("session_id",sessionId);
  if(ee)throw ee;
  const total=Number(s.total||0),answered=(ev||[]).length;if(answered<total)return json(req,{error:"أكمل جميع الأسئلة قبل إنهاء المرحلة."},409);
  const score=(ev||[]).filter((x:any)=>x.correct).length,percent=total?Math.round(score/total*1000)/10:0,hints=(ev||[]).reduce((n:number,x:any)=>n+Number(x.hints_used||0),0),changes=(ev||[]).reduce((n:number,x:any)=>n+Number(x.answer_changes||0),0);
  const {error:ue}=await db.from("lugati_mastery_sessions").update({status:"completed",score,total,percent,hints_used:hints,answer_changes:changes,completed_at:new Date().toISOString()}).eq("id",sessionId);if(ue)throw ue;
  const {data:prev,error:pe}=await db.from("lugati_student_component_progress").select("*").eq("student_id",access.student_id!).eq("component_id",s.component_id).maybeSingle();if(pe)throw pe;
  const now=new Date(),patch:any={student_id:access.student_id,component_id:s.component_id,last_activity_at:now.toISOString(),updated_at:now.toISOString(),total_hints:Number(prev?.total_hints||0)+hints,mastery_percent:percent};
  if(s.phase==="guided"){patch.guided_attempts=Number(prev?.guided_attempts||0)+1;patch.status=percent>=70?"independent":"needs_remediation";}
  if(s.phase==="independent"){patch.independent_attempts=Number(prev?.independent_attempts||0)+1;patch.status=percent>=80?"check":"needs_remediation";}
  if(s.phase==="check"){patch.check_attempts=Number(prev?.check_attempts||0)+1;if(percent>=90){patch.status="mastered";patch.mastered_at=now.toISOString();patch.next_review_at=new Date(now.getTime()+2*86400000).toISOString()}else patch.status="needs_remediation";}
  if(s.phase==="review"){patch.review_attempts=Number(prev?.review_attempts||0)+1;if(percent>=90){patch.status="mastered";patch.next_review_at=new Date(now.getTime()+7*86400000).toISOString()}else patch.status="needs_remediation";}
  if(s.phase==="enrichment"){patch.enrichment_attempts=Number(prev?.enrichment_attempts||0)+1;patch.status=prev?.status==="mastered"?"mastered":percent>=90?"mastered":"check";if(patch.status==="mastered"&&!prev?.mastered_at)patch.mastered_at=now.toISOString();}
  const {data:p,error:pue}=await db.from("lugati_student_component_progress").upsert(patch,{onConflict:"student_id,component_id"}).select("*").single();if(pue)throw pue;
  await db.from("lugati_daily_missions").update({status:"completed",completed_at:now.toISOString()}).eq("student_id",access.student_id!).eq("component_id",s.component_id).eq("mission_date",riyadhDate()).in("status",["assigned","in_progress"]);
  return json(req,{ok:true,score,total,percent,hints_used:hints,progress:p,next_phase:nextPhaseFrom(p.status,null),message:p.status==="mastered"?"أثبتَّ إتقان هذه النقطة. ستعود لك لاحقًا للتأكد من ثبات الإتقان.":p.status==="check"?"أصبحت جاهزًا لاختبار التحقق من الإتقان.":p.status==="independent"?"أكملت التدريب الموجه؛ الآن أثبت قدرتك دون تلميحات.":"هذه النقطة تحتاج علاجًا إضافيًا قبل الانتقال."});
}


async function teacherStudentProfile(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const studentId=tidy(body?.student_id);
  if(!studentId)return json(req,{error:"حدد الطالب أولًا."},400);
  const scope=teacherScope(access),since30=new Date(Date.now()-30*86400000).toISOString(),since7=new Date(Date.now()-7*86400000).toISOString();

  const {data:student,error:se}=await db.from("nafes_students")
    .select("id,full_name,class_name,grade,is_demo,is_active")
    .eq("id",studentId).eq("is_active",true).eq("is_demo",false).maybeSingle();
  if(se)throw se;if(!student)return json(req,{error:"الطالب غير متاح."},404);

  const {data:blueprints,error:be}=await db.from("lugati_mastery_blueprints")
    .select("id,subject_key,outcome_code,indicator_index,indicator_text,student_goal")
    .eq("active",true).order("subject_key").order("indicator_index");
  if(be)throw be;
  const allowedBlueprints=(blueprints||[]).filter((b:any)=>scope==="all"||b.subject_key===scope);
  const bpIds=allowedBlueprints.map((x:any)=>x.id);

  let components:any[]=[];
  if(bpIds.length){
    const z=await db.from("lugati_mastery_components").select("id,blueprint_id,title,objective,sort_order").in("blueprint_id",bpIds).eq("required",true).order("sort_order");
    if(z.error)throw z.error;components=z.data||[];
  }
  const compIds=components.map((x:any)=>x.id);

  let progress:any[]=[],events:any[]=[],sessions:any[]=[],missions:any[]=[];
  if(compIds.length){
    const [p,e,s,m]=await Promise.all([
      db.from("lugati_student_component_progress").select("component_id,status,mastery_percent,guided_attempts,independent_attempts,check_attempts,review_attempts,enrichment_attempts,total_hints,last_activity_at,mastered_at,next_review_at").eq("student_id",studentId).in("component_id",compIds),
      db.from("lugati_mastery_question_events").select("component_id,phase,correct,hints_used,elapsed_seconds,submitted_at").eq("student_id",studentId).in("component_id",compIds).gte("submitted_at",since30).order("submitted_at",{ascending:false}).limit(500),
      db.from("lugati_mastery_sessions").select("id,component_id,phase,status,score,total,percent,hints_used,started_at,completed_at").eq("student_id",studentId).in("component_id",compIds).order("started_at",{ascending:false}).limit(120),
      db.from("lugati_daily_missions").select("component_id,mission_date,mission_type,status,assigned_at,completed_at").eq("student_id",studentId).in("component_id",compIds).gte("mission_date",since30.slice(0,10)).order("mission_date",{ascending:false}).limit(120)
    ]);
    for(const x of [p,e,s,m])if((x as any).error)throw (x as any).error;
    progress=(p as any).data||[];events=(e as any).data||[];sessions=(s as any).data||[];missions=(m as any).data||[];
  }

  const bpMap=new Map(allowedBlueprints.map((x:any)=>[String(x.id),x]));
  const compMap=new Map(components.map((x:any)=>[String(x.id),x]));
  const progressMap=new Map(progress.map((x:any)=>[String(x.component_id),x]));
  const indicatorRows=allowedBlueprints.map((b:any)=>{
    const parts=components.filter((x:any)=>String(x.blueprint_id)===String(b.id));
    const ps=parts.map((x:any)=>progressMap.get(String(x.id))).filter(Boolean);
    const mastered=ps.filter((x:any)=>x.status==="mastered").length;
    const avg=ps.length?Math.round(ps.reduce((n:number,x:any)=>n+Number(x.mastery_percent||0),0)/ps.length*10)/10:null;
    const attempts=ps.reduce((n:number,x:any)=>n+Number(x.guided_attempts||0)+Number(x.independent_attempts||0)+Number(x.check_attempts||0)+Number(x.review_attempts||0)+Number(x.enrichment_attempts||0),0);
    const hints=ps.reduce((n:number,x:any)=>n+Number(x.total_hints||0),0);
    const last=ps.map((x:any)=>x.last_activity_at).filter(Boolean).sort().reverse()[0]||null;
    return{id:b.id,subject_key:b.subject_key,outcome_code:b.outcome_code,indicator_index:b.indicator_index,indicator_text:b.indicator_text,student_goal:b.student_goal,
      components:parts.length,started_components:ps.length,mastered_components:mastered,mastery_percent:avg,attempts,hints,last_activity_at:last,
      state:parts.length&&mastered===parts.length?"mastered":ps.length?"in_progress":"not_started"};
  }).filter((x:any)=>x.started_components>0||x.state==="mastered");

  const ev7=events.filter((x:any)=>x.submitted_at&&x.submitted_at>=since7),correct30=events.filter((x:any)=>x.correct).length,correct7=ev7.filter((x:any)=>x.correct).length;
  const activeDays=new Set(events.map((x:any)=>String(x.submitted_at||"").slice(0,10)).filter(Boolean)).size;
  const lastActivity=[...progress.map((x:any)=>x.last_activity_at),...sessions.map((x:any)=>x.completed_at||x.started_at)].filter(Boolean).sort().reverse()[0]||null;
  const daysSince=lastActivity?Math.max(0,Math.floor((Date.now()-new Date(lastActivity).getTime())/86400000)):null;

  const {data:adaptive,error:ae}=await db.from("lugati_adaptive_assignments")
    .select("id,subject_key,outcome_code,indicator_index,indicator_text,source_percent,tier,status,priority,training_attempts,last_training_percent,assigned_at,completed_at,updated_at")
    .eq("student_id",studentId).order("priority",{ascending:true}).limit(120);
  if(ae)throw ae;
  const adaptiveRows=(adaptive||[]).filter((x:any)=>scope==="all"||x.subject_key===scope);

  const {data:pa,error:pae}=await db.from("lugati_pretest_student_assignments")
    .select("id,dispatch_id,status,journey_status,current_stage,challenge_percent,exit_percent,exit_passed,exit_attempts,rescue_passed,enrichment_completed,assigned_at,started_at,completed_at,mastery_confirmed_at,retention_status,retention_passed")
    .eq("student_id",studentId).order("assigned_at",{ascending:false}).limit(120);
  if(pae)throw pae;
  const dispatchIds=(pa||[]).map((x:any)=>x.dispatch_id);
  let dispatches:any[]=[],templates:any[]=[];
  if(dispatchIds.length){
    const z=await db.from("lugati_pretest_dispatches").select("id,template_id,bundle_id,bundle_title,bundle_order,bundle_size,sent_at,revoked_at").in("id",dispatchIds);
    if(z.error)throw z.error;dispatches=(z.data||[]).filter((x:any)=>!x.revoked_at);
    const tids=[...new Set(dispatches.map((x:any)=>x.template_id))];
    if(tids.length){
      const t=await db.from("lugati_pretest_templates").select("id,subject_key,outcome_code,indicator_index,display_index,indicator_text,student_title").in("id",tids);
      if(t.error)throw t.error;templates=t.data||[];
    }
  }
  const dm=new Map(dispatches.map((x:any)=>[String(x.id),x])),tm=new Map(templates.map((x:any)=>[String(x.id),x]));
  const journeys=(pa||[]).map((x:any)=>{
    const dd=dm.get(String(x.dispatch_id));if(!dd)return null;const t=tm.get(String(dd.template_id));if(!t)return null;
    if(scope!=="all"&&t.subject_key!==scope)return null;
    return{assignment_id:x.id,subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:t.indicator_index,global_indicator:t.display_index||t.indicator_index,
      indicator_text:t.indicator_text,student_title:t.student_title||"",bundle_id:dd.bundle_id||null,bundle_title:dd.bundle_title||null,bundle_order:dd.bundle_order||null,bundle_size:dd.bundle_size||null,
      journey_status:x.journey_status,current_stage:x.current_stage,challenge_percent:x.challenge_percent,exit_percent:x.exit_percent,exit_passed:x.exit_passed,
      exit_attempts:x.exit_attempts,rescue_passed:x.rescue_passed,enrichment_completed:x.enrichment_completed,assigned_at:x.assigned_at,started_at:x.started_at,
      completed_at:x.completed_at,mastery_confirmed_at:x.mastery_confirmed_at,retention_status:x.retention_status,retention_passed:x.retention_passed};
  }).filter(Boolean);

  const {data:gameAttempts,error:gae}=await db.from("lugati_competition_attempts")
    .select("id,round_id,status,started_at,submitted_at,correct_questions,wrong_attempts,duration_ms,points,max_streak,last_activity_at")
    .eq("student_id",studentId).order("created_at",{ascending:false}).limit(40);
  if(gae)throw gae;
  const roundIds=(gameAttempts||[]).map((x:any)=>x.round_id);
  let rounds:any[]=[];
  if(roundIds.length){
    const z=await db.from("lugati_competition_rounds").select("id,subject_key,title,question_count,status,game_config,created_at").in("id",roundIds);
    if(z.error)throw z.error;rounds=z.data||[];
  }
  const rm=new Map(rounds.map((x:any)=>[String(x.id),x]));
  const games=(gameAttempts||[]).map((x:any)=>{const rr=rm.get(String(x.round_id));if(!rr||(scope!=="all"&&rr.subject_key!==scope))return null;
    return{attempt_id:x.id,subject_key:rr.subject_key,title:rr.title,question_count:rr.question_count,status:x.status,correct_questions:x.correct_questions,wrong_attempts:x.wrong_attempts,points:x.points,max_streak:x.max_streak,started_at:x.started_at,submitted_at:x.submitted_at,last_activity_at:x.last_activity_at,demo_only:rr.game_config?.demo_only===true};
  }).filter(Boolean);

  const [examsRes,assessRes]=await Promise.all([
    db.from("nafes_exam_attempts").select("id,subject_key,outcome_code,indicator_index,model_no,started_at,submitted_at,score,percent,is_demo").eq("student_id",studentId).eq("is_demo",false).not("submitted_at","is",null).order("submitted_at",{ascending:false}).limit(60),
    db.from("nafes_assessment_attempts").select("id,assessment_id,started_at,submitted_at,score,total,percent,section_scores,is_demo").eq("student_id",studentId).eq("is_demo",false).not("submitted_at","is",null).order("submitted_at",{ascending:false}).limit(40)
  ]);
  if(examsRes.error)throw examsRes.error;if(assessRes.error)throw assessRes.error;
  const exams=(examsRes.data||[]).filter((x:any)=>scope==="all"||x.subject_key===scope);
  const assessmentIds=(assessRes.data||[]).map((x:any)=>x.assessment_id);
  let assessmentMeta:any[]=[];
  if(assessmentIds.length){
    const z=await db.from("nafes_assessments").select("id,title,kind").in("id",assessmentIds);if(z.error)throw z.error;assessmentMeta=z.data||[];
  }
  const asm=new Map(assessmentMeta.map((x:any)=>[String(x.id),x]));
  const assessments=(assessRes.data||[]).map((x:any)=>({id:x.id,assessment_id:x.assessment_id,title:asm.get(String(x.assessment_id))?.title||"اختبار مؤشرات",kind:asm.get(String(x.assessment_id))?.kind||"",started_at:x.started_at,submitted_at:x.submitted_at,score:x.score,total:x.total,percent:x.percent,section_scores:x.section_scores||[]})).filter((x:any)=>{
    if(scope==="all")return true;
    const scores=Array.isArray(x.section_scores)?x.section_scores:[];
    return scores.some((s:any)=>s.subject===scope||s.subject_key===scope);
  });

  const timeline:any[]=[];
  for(const x of sessions.slice(0,30)){const cp=compMap.get(String(x.component_id)),bp=cp?bpMap.get(String(cp.blueprint_id)):null;timeline.push({type:"mastery",at:x.completed_at||x.started_at,title:(bp?.indicator_text||cp?.title||"جلسة إتقان"),detail:phaseLabel(x.phase)+" • "+(x.percent==null?"قيد التنفيذ":Math.round(Number(x.percent))+"%"),subject_key:bp?.subject_key||""});}
  for(const x of journeys.slice(0,30))timeline.push({type:"journey",at:x.completed_at||x.mastery_confirmed_at||x.started_at||x.assigned_at,title:x.student_title||x.indicator_text,detail:x.journey_status==="ready"?"أتقن الرحلة":x.journey_status==="support"?"في العلاج":x.journey_status==="in_progress"?"قيد التدريب":"مُرسلة",subject_key:x.subject_key});
  for(const x of games.slice(0,20))timeline.push({type:"game",at:x.submitted_at||x.last_activity_at||x.started_at,title:x.title,detail:(x.submitted_at?"أكمل اللعبة":"بدأ اللعبة")+" • "+Number(x.correct_questions||0)+"/"+Number(x.question_count||0),subject_key:x.subject_key});
  for(const x of exams.slice(0,30))timeline.push({type:"exam",at:x.submitted_at,title:"اختبار مؤشر",detail:Math.round(Number(x.percent||0))+"%",subject_key:x.subject_key});
  for(const x of assessments.slice(0,20))timeline.push({type:"assessment",at:x.submitted_at,title:x.title,detail:Math.round(Number(x.percent||0))+"%",subject_key:"all"});
  timeline.sort((a:any,b:any)=>String(b.at||"").localeCompare(String(a.at||"")));

  const pendingJourneys=journeys.filter((x:any)=>x.journey_status!=="ready").length;
  const supportJourneys=journeys.filter((x:any)=>x.journey_status==="support").length;
  const masteredIndicators=indicatorRows.filter((x:any)=>x.state==="mastered").length;
  const weakAdaptive=[...adaptiveRows].filter((x:any)=>x.status!=="mastered").sort((a:any,b:any)=>Number(a.source_percent??999)-Number(b.source_percent??999))[0]||null;
  const weakMastery=[...indicatorRows].filter((x:any)=>x.state!=="mastered"&&x.mastery_percent!=null).sort((a:any,b:any)=>Number(a.mastery_percent)-Number(b.mastery_percent))[0]||null;
  let nextAction="لا توجد مهمة ملحّة الآن؛ استمر في المتابعة الدورية.";
  let attention="stable";
  if(daysSince!=null&&daysSince>=7&&(pendingJourneys>0||adaptiveRows.some((x:any)=>x.status!=="mastered"))){nextAction="لم ينشط منذ "+daysSince+" أيام؛ ابدأ بمتابعته وإعادته إلى المهمة الحالية.";attention="inactive";}
  else if(supportJourneys>0){nextAction="لديه "+supportJourneys+" رحلة في المسار العلاجي؛ ابدأ بها قبل إضافة مهمة جديدة.";attention="support";}
  else if(events.length&&correct30/events.length<0.7){nextAction="دقته خلال 30 يومًا أقل من 70٪؛ ركّز على "+(weakMastery?.indicator_text||weakAdaptive?.indicator_text||"المؤشر الأضعف")+".";attention="low_accuracy";}
  else if(weakAdaptive){nextAction="الأولوية الحالية: "+(weakAdaptive.indicator_text||"المؤشر الأقل أداءً")+" ("+Math.round(Number(weakAdaptive.source_percent||0))+"٪ في المصدر).";attention="priority";}
  else if(pendingJourneys>0){nextAction="لديه "+pendingJourneys+" رحلة غير مكتملة؛ الأفضل إكمالها قبل إرسال نشاط جديد.";attention="pending";}

  const subjectTests:any={};
  for(const s of ["reading","math","science"]){
    if(scope!=="all"&&scope!==s)continue;
    const vals=[
      ...exams.filter((x:any)=>x.subject_key===s).map((x:any)=>({at:x.submitted_at,percent:Number(x.percent||0)})),
      ...assessments.flatMap((x:any)=>(Array.isArray(x.section_scores)?x.section_scores:[]).filter((z:any)=>(z.subject||z.subject_key)===s).map((z:any)=>({at:x.submitted_at,percent:Number(z.percent||0)})))
    ].sort((a:any,b:any)=>String(a.at).localeCompare(String(b.at)));
    const recent=vals.slice(-8),first=recent[0]?.percent??null,last=recent[recent.length-1]?.percent??null;
    subjectTests[s]={count:vals.length,latest:last,change:first!=null&&last!=null?Math.round((last-first)*10)/10:null,history:recent};
  }

  return json(req,{ok:true,subject_scope:scope,student,summary:{
    last_activity_at:lastActivity,days_since_last_activity:daysSince,active_days_30:activeDays,questions_7d:ev7.length,questions_30d:events.length,
    accuracy_7d:ev7.length?Math.round(correct7/ev7.length*1000)/10:null,accuracy_30d:events.length?Math.round(correct30/events.length*1000)/10:null,
    hints_30d:events.reduce((n:number,x:any)=>n+Number(x.hints_used||0),0),mastered_indicators:masteredIndicators,started_indicators:indicatorRows.length,
    pending_journeys:pendingJourneys,support_journeys:supportJourneys,games_completed:games.filter((x:any)=>!!x.submitted_at).length,
    tests_completed:exams.length+assessments.length,attention,next_action:nextAction
  },subject_tests:subjectTests,indicators:indicatorRows,adaptive:adaptiveRows,journeys,games,exams,assessments,timeline:timeline.slice(0,60),missions:missions.slice(0,60)});
}

async function teacherDashboard(req:Request,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const since=new Date(Date.now()-7*86400000).toISOString(),todayDate=riyadhDate(),scope=teacherScope(access);
  const [rr,pr,er,mr,cr,br,xr,ar,gar,grr,jar,jdr,jtr]=await Promise.all([
    db.from("nafes_students").select("id,full_name,class_name,grade,is_demo").eq("is_active",true).eq("is_demo",false).order("class_name").order("full_name"),
    db.from("lugati_student_component_progress").select("student_id,component_id,status,mastery_percent,total_hints,last_activity_at,mastered_at,next_review_at"),
    db.from("lugati_mastery_question_events").select("student_id,component_id,correct,hints_used,elapsed_seconds,submitted_at").gte("submitted_at",since),
    db.from("lugati_daily_missions").select("student_id,component_id,status,mission_type").eq("mission_date",todayDate),
    db.from("lugati_mastery_components").select("id,blueprint_id"),
    db.from("lugati_mastery_blueprints").select("id,subject_key"),
    db.from("nafes_exam_attempts").select("student_id,subject_key,submitted_at,percent,is_demo").eq("is_demo",false).not("submitted_at","is",null),
    db.from("nafes_assessment_attempts").select("student_id,submitted_at,percent,section_scores,is_demo").eq("is_demo",false).not("submitted_at","is",null),
    db.from("lugati_competition_attempts").select("student_id,round_id,status,started_at,submitted_at,last_activity_at"),
    db.from("lugati_competition_rounds").select("id,subject_key,game_config"),
    db.from("lugati_pretest_student_assignments").select("student_id,dispatch_id,journey_status,assigned_at,started_at,completed_at,mastery_confirmed_at"),
    db.from("lugati_pretest_dispatches").select("id,template_id,revoked_at"),
    db.from("lugati_pretest_templates").select("id,subject_key")
  ]);
  for(const x of [rr,pr,er,mr,cr,br,xr,ar,gar,grr,jar,jdr,jtr])if((x as any).error)throw (x as any).error;

  const blueprintSubject=new Map(((br as any).data||[]).map((x:any)=>[String(x.id),String(x.subject_key)]));
  const componentSubject=new Map(((cr as any).data||[]).map((x:any)=>[String(x.id),blueprintSubject.get(String(x.blueprint_id))||""]));
  const allowed=(componentId:any)=>scope==="all"||componentSubject.get(String(componentId))===scope;
  const ps=((pr as any).data||[]).filter((x:any)=>allowed(x.component_id));
  const es=((er as any).data||[]).filter((x:any)=>allowed(x.component_id));
  const ms=((mr as any).data||[]).filter((x:any)=>allowed(x.component_id));
  const byP=new Map<string,any[]>(),byE=new Map<string,any[]>(),byM=new Map<string,any[]>();
  for(const x of ps){const k=String(x.student_id);if(!byP.has(k))byP.set(k,[]);byP.get(k)!.push(x)}
  for(const x of es){const k=String(x.student_id);if(!byE.has(k))byE.set(k,[]);byE.get(k)!.push(x)}
  for(const x of ms){const k=String(x.student_id);if(!byM.has(k))byM.set(k,[]);byM.get(k)!.push(x)}

  const roundMap=new Map(((grr as any).data||[]).map((x:any)=>[String(x.id),x]));
  const dispatchMap=new Map(((jdr as any).data||[]).filter((x:any)=>!x.revoked_at).map((x:any)=>[String(x.id),x]));
  const templateMap=new Map(((jtr as any).data||[]).map((x:any)=>[String(x.id),x]));

  const workByStudent=new Map<string,any[]>();
  const pushWork=(studentId:any,row:any)=>{const k=String(studentId||"");if(!k)return;if(!workByStudent.has(k))workByStudent.set(k,[]);workByStudent.get(k)!.push(row)};

  for(const x of (xr as any).data||[]){
    if(scope!=="all"&&x.subject_key!==scope)continue;
    pushWork(x.student_id,{type:"exam",subject_key:x.subject_key,at:x.submitted_at,completed:true,percent:x.percent});
  }
  for(const x of (ar as any).data||[]){
    const scores=Array.isArray(x.section_scores)?x.section_scores:[];
    if(scope!=="all"&&!scores.some((s:any)=>(s.subject||s.subject_key)===scope))continue;
    pushWork(x.student_id,{type:"assessment",subject_key:scope==="all"?"all":scope,at:x.submitted_at,completed:true,percent:x.percent});
  }
  for(const x of (gar as any).data||[]){
    const round=roundMap.get(String(x.round_id));if(!round)continue;
    if(scope!=="all"&&round.subject_key!==scope)continue;
    if(round.game_config?.demo_only===true)continue;
    const at=x.submitted_at||x.last_activity_at||x.started_at;
    if(at)pushWork(x.student_id,{type:"game",subject_key:round.subject_key,at,completed:!!x.submitted_at,status:x.status});
  }

  const pendingByStudent=new Map<string,number>();
  for(const x of (jar as any).data||[]){
    const disp=dispatchMap.get(String(x.dispatch_id));if(!disp)continue;
    const t=templateMap.get(String(disp.template_id));if(!t)continue;
    if(scope!=="all"&&t.subject_key!==scope)continue;
    const at=x.completed_at||x.mastery_confirmed_at||x.started_at;
    if(at)pushWork(x.student_id,{type:"journey",subject_key:t.subject_key,at,completed:!!(x.completed_at||x.mastery_confirmed_at),status:x.journey_status});
    if(x.journey_status!=="ready"&&!x.started_at){
      const k=String(x.student_id);pendingByStudent.set(k,(pendingByStudent.get(k)||0)+1);
    }
  }

  const students=((rr as any).data||[]).map((s:any)=>{
    const sid=String(s.id),p=byP.get(sid)||[],e=byE.get(sid)||[],m=byM.get(sid)||[],works=workByStudent.get(sid)||[],correct=e.filter((x:any)=>x.correct).length;
    const activeComponents=p.length,masteredComponents=p.filter((x:any)=>x.status==="mastered").length;
    const masteryLast=p.map((x:any)=>x.last_activity_at).filter(Boolean).sort().reverse()[0]||null;
    const workLast=works.map((x:any)=>x.at).filter(Boolean).sort().reverse()[0]||null;
    const lastActivity=[masteryLast,workLast].filter(Boolean).sort().reverse()[0]||null;
    const accuracy=e.length?Math.round(correct/e.length*1000)/10:null;
    const hints=e.reduce((n:number,x:any)=>n+Number(x.hints_used||0),0);
    const missionsCompleted=m.filter((x:any)=>x.status==="completed").length;
    const pendingJourneys=pendingByStudent.get(sid)||0;
    const completedTests=works.filter((x:any)=>x.type==="exam"||x.type==="assessment").length;
    const completedGames=works.filter((x:any)=>x.type==="game"&&x.completed).length;
    const startedJourneys=works.filter((x:any)=>x.type==="journey").length;
    const active7=!!lastActivity&&String(lastActivity)>=since;
    const daysSince=lastActivity?Math.max(0,Math.floor((Date.now()-new Date(lastActivity).getTime())/86400000)):null;
    const reasons:string[]=[];

    if(!works.length&&activeComponents===0&&pendingJourneys===0)reasons.push("لم يبدأ أي عمل مسجل في المنصة.");
    if(pendingJourneys>0&&startedJourneys===0)reasons.push("لديه "+pendingJourneys+" رحلة إتقان مرسلة لم يبدأها.");
    if(daysSince!==null&&daysSince>=7&&(works.length>0||activeComponents>0||pendingJourneys>0))reasons.push("آخر نشاط مسجل منذ "+daysSince+" أيام.");
    if(accuracy!==null&&accuracy<70)reasons.push("دقة منخفضة في تدريب الإتقان خلال آخر 7 أيام ("+accuracy+"٪).");
    if(m.length>missionsCompleted)reasons.push("لم يكمل مهام اليوم ("+missionsCompleted+" من "+m.length+").");
    if(hints>=4)reasons.push("استخدام متكرر للتلميحات ("+hints+" خلال 7 أيام).");
    if(activeComponents>=3&&masteredComponents/activeComponents<0.5)reasons.push("نسبة الإتقان الحالية منخفضة ("+masteredComponents+" من "+activeComponents+" مكونات).");

    const needsFollowup=reasons.length>0;
    return{id:s.id,full_name:s.full_name,class_name:s.class_name,grade:s.grade,is_demo:s.is_demo===true,
      mastered_components:masteredComponents,active_components:activeComponents,last_activity_at:lastActivity,
      questions_7d:e.length,accuracy_7d:accuracy,hints_7d:hints,missions_today:m.length,missions_completed_today:missionsCompleted,
      work_count:works.length,tests_completed:completedTests,games_completed:completedGames,journeys_started:startedJourneys,pending_journeys:pendingJourneys,
      active_7d:active7,needs_followup:needsFollowup,followup_reasons:reasons,followup_issue:reasons.slice(0,3).join(" ")||"لا توجد مشكلة ظاهرة حاليًا."};
  });

  return json(req,{ok:true,date:todayDate,subject_scope:scope,totals:{
    students:students.length,active_7d:students.filter((s:any)=>s.active_7d).length,
    completed_today:students.filter((s:any)=>s.missions_completed_today>0).length,
    needs_followup:students.filter((s:any)=>s.needs_followup).length
  },students});
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
  try{
    const access=await requireAccess(req),body=await req.json().catch(()=>({})),action=tidy(body?.action||"my_overview");
    if(action==="my_overview")return await myOverview(req,access);
    if(action==="today")return await today(req,access);
    if(action==="start_phase")return await startPhase(req,body,access);
    if(action==="hint")return await hint(req,body,access);
    if(action==="answer")return await answer(req,body,access);
    if(action==="finish_phase")return await finishPhase(req,body,access);
    if(action==="teacher_dashboard")return await teacherDashboard(req,access);
    if(action==="teacher_student_profile")return await teacherStudentProfile(req,body,access);
    return json(req,{error:"action_not_supported"},400);
  }catch(error){
    console.error("lugati-mastery",error);
    const status=error&&typeof error==="object"&&"status" in error?Number((error as any).status):500;
    return json(req,{error:status===500?"تعذر تشغيل مسار الإتقان الآن.":String((error as Error).message)},status);
  }
});