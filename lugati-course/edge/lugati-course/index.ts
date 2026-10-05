import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const db=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false}});
const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json"
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});

function bytesToB64(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}
async function sha256Text(text:string){
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return bytesToB64(new Uint8Array(hash));
}
async function authAccount(req:Request){
  const h=req.headers.get("Authorization")||"";
  if(!h.startsWith("Bearer "))return null;
  const raw=h.slice(7).trim(); if(!raw)return null;
  const tokenHash=await sha256Text(raw);
  const {data:session}=await db.from("app_sessions").select("account_id,expires_at").eq("token_hash",tokenHash).maybeSingle();
  if(!session||new Date(session.expires_at).getTime()<=Date.now())return null;
  const {data:account}=await db.from("app_accounts").select("id,role,full_name,grade,class_name,is_active").eq("id",session.account_id).eq("is_active",true).maybeSingle();
  return account||null;
}
function unitNo(code:string){const m=/^U(\d+)-/.exec(code);return m?Number(m[1]):0}
function lessonNo(code:string){const m=/^U\d+-(\d+)$/.exec(code);return m?Number(m[1]):-1}
function codeFor(u:number,l:number){return `U${u}-${String(l).padStart(2,"0")}`}
function stable(v:any):string{
  if(Array.isArray(v))return JSON.stringify([...v].sort((a,b)=>String(a).localeCompare(String(b),"ar")));
  if(v&&typeof v==="object"){
    const o:any={}; for(const k of Object.keys(v).sort())o[k]=v[k];
    return JSON.stringify(o);
  }
  return JSON.stringify(v);
}
function pct(correct:number,total:number){return total?Math.round((correct/total)*100):0}
function cleanQuestion(q:any){
  return {
    question_key:q.question_key,
    point_key:q.point_key,
    variant_group:q.variant_group,
    cognitive_level:q.cognitive_level,
    difficulty:q.difficulty,
    question_type:q.question_type,
    context_text:q.context_text,
    prompt:q.prompt,
    options:q.options,
    objective_key:q.objective_key,
    metadata:q.metadata||{}
  };
}
function cryptoShuffle<T>(arr:T[]){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const r=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);
    [a[i],a[r]]=[a[r],a[i]];
  }
  return a;
}
async function getLesson(code:string){
  const {data:lesson}=await db.from("lessons").select("id,code,title,unit_title,lesson_type,goal,mastery_threshold,is_published,content_version").eq("code",code).maybeSingle();
  if(!lesson)return null;
  const {data:blueprint}=await db.from("lesson_blueprints").select("*").eq("lesson_id",lesson.id).maybeSingle();
  return {lesson,blueprint};
}
async function progressFor(studentId:string,codes:string[]){
  if(!codes.length)return new Map<string,any>();
  const {data:lessons}=await db.from("lessons").select("id,code").in("code",codes);
  const ids=(lessons||[]).map(x=>x.id);
  if(!ids.length)return new Map<string,any>();
  const {data:rows}=await db.from("student_lesson_progress").select("lesson_id,status,score,knowledge_percent,application_percent,reasoning_percent,last_attempt_at").eq("student_id",studentId).in("lesson_id",ids);
  const lm=Object.fromEntries((lessons||[]).map(x=>[x.id,x.code]));
  return new Map((rows||[]).map(r=>[lm[r.lesson_id],r]));
}
async function unitIsUnlocked(studentId:string,u:number){
  if(u<=1)return true;
  const prev=`U${u-1}`;
  const {data:um}=await db.from("student_unit_mastery").select("status").eq("student_id",studentId).eq("unit_code",prev).maybeSingle();
  if(um?.status==="mastered")return true;
  const finalCode=codeFor(u-1,15);
  const pm=await progressFor(studentId,[finalCode]);
  return pm.get(finalCode)?.status==="mastered";
}
async function lessonAccess(studentId:string,code:string){
  const rec=await getLesson(code);
  if(!rec)return {allowed:false,can_launch:false,reason:"lesson_not_found",lesson:null,blueprint:null};
  const {lesson,blueprint}=rec;
  if(!lesson.is_published)return {allowed:false,can_launch:false,reason:"lesson_closed",lesson,blueprint};
  if(!blueprint)return {allowed:false,can_launch:false,reason:"blueprint_missing",lesson,blueprint:null};
  const u=unitNo(code),n=lessonNo(code);
  if(!u||n<0)return {allowed:false,can_launch:false,reason:"invalid_course_code",lesson,blueprint};
  const unitOk=await unitIsUnlocked(studentId,u);
  if(!unitOk)return {allowed:false,can_launch:false,reason:"previous_unit_not_mastered",lesson,blueprint};
  let allowed=true,reason="available";
  if(n>=2&&n<=14){
    const prev=codeFor(u,n-1);
    const pm=await progressFor(studentId,[prev]);
    if(pm.get(prev)?.status!=="mastered"){allowed=false;reason="previous_lesson_not_mastered"}
  }else if(n===15){
    const required=Array.from({length:14},(_,i)=>codeFor(u,i+1));
    const pm=await progressFor(studentId,required);
    const missing=required.filter(c=>pm.get(c)?.status!=="mastered");
    if(missing.length){allowed=false;reason="unit_lessons_not_mastered"}
  }
  const canLaunch=allowed&&blueprint.ready_for_publish===true;
  return {allowed,can_launch:canLaunch,reason:allowed?(canLaunch?"available":"content_not_ready"):reason,lesson,blueprint};
}
async function recordForced(studentId:string,lessonId:string,reason:string){
  await db.from("learning_events").insert({
    student_id:studentId,lesson_id:lessonId,event_type:"forced_transition_attempt",
    interaction_type:"lesson_access",payload:{reason}
  });
}
async function allRegularPointsMastered(studentId:string,lessonId:string,blueprint:any){
  const points=(Array.isArray(blueprint?.learning_points)?blueprint.learning_points:[]).filter((p:any)=>p?.masteryRequired!==false);
  if(!points.length)return true;
  const keys=points.map((p:any)=>String(p.key));
  const {data:rows}=await db.from("student_point_mastery").select("point_key,status").eq("student_id",studentId).eq("lesson_id",lessonId).in("point_key",keys);
  const m=new Map((rows||[]).map(r=>[r.point_key,r.status]));
  return keys.every(k=>m.get(k)==="mastered");
}
async function pointIsOpen(studentId:string,lessonId:string,blueprint:any,pointKey:string){
  const points=Array.isArray(blueprint?.learning_points)?blueprint.learning_points:[];
  if(pointKey==="__final__")return await allRegularPointsMastered(studentId,lessonId,blueprint);
  const idx=points.findIndex((p:any)=>String(p.key)===pointKey);
  if(idx<0)return false;
  if(idx===0)return true;
  for(let i=0;i<idx;i++){
    if(points[i]?.masteryRequired===false)continue;
    const {data:r}=await db.from("student_point_mastery").select("status").eq("student_id",studentId).eq("lesson_id",lessonId).eq("point_key",String(points[i].key)).maybeSingle();
    if(r?.status!=="mastered")return false;
  }
  return true;
}
async function latestUniqueAttempts(studentId:string,lessonId:string,pointKey:string,limit=50){
  const {data:rows}=await db.from("student_attempts")
    .select("id,question_key,variant_group,cognitive_level,correct,answer_revealed,counts_for_mastery,created_at")
    .eq("student_id",studentId).eq("lesson_id",lessonId).eq("point_key",pointKey)
    .eq("counts_for_mastery",true).eq("answer_revealed",false)
    .order("created_at",{ascending:false}).limit(limit);
  const seen=new Set<string>(),out:any[]=[];
  for(const r of rows||[]){
    if(seen.has(r.question_key))continue;
    seen.add(r.question_key);out.push(r);
  }
  return out;
}
async function markLessonProgress(studentId:string,lessonId:string,status:string,score:number|null,k=0,a=0,r=0){
  const row={student_id:studentId,lesson_id:lessonId,status,score,knowledge_percent:k,application_percent:a,reasoning_percent:r,last_attempt_at:new Date().toISOString()};
  const {error}=await db.from("student_lesson_progress").upsert(row,{onConflict:"student_id,lesson_id"});
  if(error)throw error;
}
async function finalizeAutoLesson(studentId:string,lesson:any,blueprint:any){
  if(!(await allRegularPointsMastered(studentId,lesson.id,blueprint)))return {mastered:false,error:"points_not_mastered"};
  const cfg=blueprint.assessment||{};
  const needed=Math.max(1,Number(cfg.itemCount||5));
  const attempts=(await latestUniqueAttempts(studentId,lesson.id,"__final__",100)).slice(0,needed);
  if(attempts.length<needed)return {mastered:false,error:"final_check_incomplete",answered:attempts.length,required:needed};
  const keys=attempts.map(x=>x.question_key);
  const {data:qs}=await db.from("course_question_bank").select("question_key,objective_key,cognitive_level").in("question_key",keys);
  const qm=new Map((qs||[]).map(q=>[q.question_key,q]));
  const correct=attempts.filter(x=>x.correct===true).length;
  const overall=pct(correct,attempts.length);
  const level:any={knowledge:[0,0],application:[0,0],reasoning:[0,0]};
  const objective:any={};
  for(const a of attempts){
    const q=qm.get(a.question_key)||{};
    const lv=q.cognitive_level||a.cognitive_level;
    if(level[lv]){level[lv][1]++;if(a.correct)level[lv][0]++}
    const ok=q.objective_key||"unmapped";
    objective[ok]??=[0,0]; objective[ok][1]++; if(a.correct)objective[ok][0]++;
  }
  const objectivePct=Object.fromEntries(Object.entries(objective).map(([k,v]:any)=>[k,pct(v[0],v[1])]));
  const core=(Array.isArray(blueprint.objectives)?blueprint.objectives:[]).filter((o:any)=>o?.core!==false).map((o:any)=>String(o.key));
  const coreOk=core.every((k:string)=>Number(objectivePct[k]??0)>=80);
  const mastered=overall>=Number(lesson.mastery_threshold||85)&&coreOk;
  await markLessonProgress(studentId,lesson.id,mastered?"mastered":"needs_support",overall,pct(...level.knowledge),pct(...level.application),pct(...level.reasoning));
  if(mastered&&lessonNo(lesson.code)===15){
    const u=unitNo(lesson.code),unitCode=`U${u}`;
    await db.from("student_unit_mastery").upsert({
      student_id:studentId,unit_code:unitCode,lesson_mastery_percent:100,unit_final_percent:overall,
      core_objectives_ok:coreOk,performance_passed:true,status:"mastered",mastered_at:new Date().toISOString(),updated_at:new Date().toISOString()
    },{onConflict:"student_id,unit_code"});
  }
  return {mastered,overall,objective_percentages:objectivePct,knowledge_percent:pct(...level.knowledge),application_percent:pct(...level.application),reasoning_percent:pct(...level.reasoning)};
}
async function finalizeRubricLesson(studentId:string,lesson:any,blueprint:any){
  if(!(await allRegularPointsMastered(studentId,lesson.id,blueprint)))return {mastered:false,error:"points_not_mastered"};
  const rubricId=String(blueprint.assessment?.rubricId||"");
  if(!rubricId)return {mastered:false,error:"rubric_missing"};
  const {data:rows}=await db.from("performance_rubric_scores").select("criterion_key,score,is_core").eq("student_id",studentId).eq("lesson_id",lesson.id).eq("rubric_id",rubricId);
  if(!(rows||[]).length)return {mastered:false,error:"rubric_not_scored"};
  const core=(rows||[]).filter(x=>x.is_core!==false);
  const coreOk=core.length>0&&core.every(x=>Number(x.score)>=3);
  const avg=Math.round(((rows||[]).reduce((s,x)=>s+Number(x.score||0),0)/((rows||[]).length*4))*100);
  const mastered=coreOk&&avg>=75;
  await markLessonProgress(studentId,lesson.id,mastered?"mastered":"needs_support",avg,0,100,0);
  return {mastered,overall:avg,coreOk};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  try{
    const account=await authAccount(req);
    if(!account)return json({error:"unauthorized"},401);
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"");

    if(action==="catalog"){
      const [{data:units},{data:lessons},{data:blueprints}]=await Promise.all([
        db.from("course_units").select("*").order("unit_order"),
        db.from("lessons").select("id,code,title,unit_title,lesson_type,goal,mastery_threshold,is_published,content_version").like("code","U%").order("code"),
        db.from("lesson_blueprints").select("lesson_id,unit_code,lesson_order,estimated_minutes,difficulty,ready_for_publish,expected_outcome")
      ]);
      const bm=Object.fromEntries((blueprints||[]).map(x=>[x.lesson_id,x]));
      if(account.role!=="student")return json({units:units||[],lessons:(lessons||[]).map(l=>({...l,blueprint:bm[l.id]||null}))});
      const out=[];
      for(const l of lessons||[]){
        const a=await lessonAccess(account.id,l.code);
        const pm=await progressFor(account.id,[l.code]);
        out.push({...l,blueprint:bm[l.id]||null,progress:pm.get(l.code)||null,access:{allowed:a.allowed,can_launch:a.can_launch,reason:a.reason}});
      }
      return json({units:units||[],lessons:out});
    }

    if(action==="lesson_access"){
      if(account.role!=="student")return json({error:"forbidden"},403);
      const code=String(body.lesson_code||"").trim().toUpperCase();
      const a=await lessonAccess(account.id,code);
      if(!a.allowed&&a.lesson)await recordForced(account.id,a.lesson.id,a.reason);
      return json({lesson:a.lesson,access:{allowed:a.allowed,can_launch:a.can_launch,reason:a.reason}});
    }

    if(action==="lesson_blueprint"){
      const code=String(body.lesson_code||"").trim().toUpperCase();
      const rec=await getLesson(code); if(!rec)return json({error:"lesson_not_found"},404);
      if(account.role==="student"){
        const a=await lessonAccess(account.id,code);
        if(!a.allowed){await recordForced(account.id,rec.lesson.id,a.reason);return json({error:a.reason},403)}
        if(!rec.blueprint?.ready_for_publish)return json({error:"content_not_ready"},409);
      }
      return json({lesson:rec.lesson,blueprint:rec.blueprint});
    }

    if(action==="lesson_content"){
      const code=String(body.lesson_code||"").trim().toUpperCase();
      const rec=await getLesson(code); if(!rec)return json({error:"lesson_not_found"},404);
      if(account.role==="student"){
        const a=await lessonAccess(account.id,code);
        if(!a.allowed){await recordForced(account.id,rec.lesson.id,a.reason);return json({error:a.reason},403)}
        if(!a.can_launch)return json({error:"content_not_ready"},409);
      }
      const {data:blocks,error}=await db.from("lesson_micro_blocks")
        .select("point_key,block_order,block_type,title,body,payload,depth_note,remediation")
        .eq("lesson_id",rec.lesson.id).eq("active",true)
        .order("block_order",{ascending:true});
      if(error)throw error;
      return json({lesson:rec.lesson,blueprint:rec.blueprint,blocks:blocks||[]});
    }

    if(action==="student_mastery_map"){
      if(account.role!=="student")return json({error:"forbidden"},403);
      const {data:points}=await db.from("student_point_mastery").select("lesson_id,point_key,status,correct_count,checked_count,wrong_count,mastered_at,updated_at").eq("student_id",account.id);
      const {data:lessons}=await db.from("student_lesson_progress").select("lesson_id,status,score,knowledge_percent,application_percent,reasoning_percent,last_attempt_at").eq("student_id",account.id);
      const {data:units}=await db.from("student_unit_mastery").select("*").eq("student_id",account.id);
      return json({points:points||[],lessons:lessons||[],units:units||[]});
    }

    if(action==="start_point_check"){
      if(account.role!=="student")return json({error:"forbidden"},403);
      const code=String(body.lesson_code||"").trim().toUpperCase(),pointKey=String(body.point_key||"");
      const a=await lessonAccess(account.id,code);
      if(!a.allowed)return json({error:a.reason},403);
      if(!a.can_launch)return json({error:"content_not_ready"},409);
      if(!(await pointIsOpen(account.id,a.lesson.id,a.blueprint,pointKey)))return json({error:"point_locked"},403);
      const {data:all,error}=await db.from("course_question_bank").select("question_key,point_key,variant_group,cognitive_level,difficulty,question_type,context_text,prompt,options,objective_key,metadata").eq("lesson_id",a.lesson.id).eq("point_key",pointKey).eq("active",true);
      if(error)throw error;
      const recent=await latestUniqueAttempts(account.id,a.lesson.id,pointKey,20);
      const recentKeys=new Set(recent.slice(0,8).map(x=>x.question_key));
      let pool=(all||[]).filter(q=>!recentKeys.has(q.question_key));
      if(pool.length<3)pool=all||[];
      const groups=new Set<string>(),chosen:any[]=[];
      for(const q of cryptoShuffle(pool)){
        if(chosen.length>=3)break;
        if(!groups.has(q.variant_group)||groups.size>=3){chosen.push(q);groups.add(q.variant_group)}
      }
      for(const q of cryptoShuffle(pool))if(chosen.length<3&&!chosen.some(x=>x.question_key===q.question_key))chosen.push(q);
      if(chosen.length<3)return json({error:"insufficient_question_variants",available:chosen.length},409);
      await db.from("student_point_mastery").upsert({student_id:account.id,lesson_id:a.lesson.id,point_key:pointKey,status:"checking",updated_at:new Date().toISOString()},{onConflict:"student_id,lesson_id,point_key"});
      return json({lesson_code:code,point_key:pointKey,questions:chosen.map(cleanQuestion)});
    }

    if(action==="answer_point_question"){
      if(account.role!=="student")return json({error:"forbidden"},403);
      const questionKey=String(body.question_key||""),selected=body.selected_answer,elapsed=Math.max(0,Number(body.elapsed_ms||0));
      const {data:q}=await db.from("course_question_bank").select("*").eq("question_key",questionKey).eq("active",true).maybeSingle();
      if(!q)return json({error:"question_not_found"},404);
      const {data:lesson}=await db.from("lessons").select("id,code,title,mastery_threshold,is_published").eq("id",q.lesson_id).maybeSingle();
      if(!lesson)return json({error:"lesson_not_found"},404);
      const a=await lessonAccess(account.id,lesson.code); if(!a.allowed)return json({error:a.reason},403);
      if(!(await pointIsOpen(account.id,lesson.id,a.blueprint,q.point_key)))return json({error:"point_locked"},403);
      const correct=stable(selected)===stable(q.correct_answer);
      const {error}=await db.from("student_attempts").insert({
        student_id:account.id,lesson_id:lesson.id,point_key:q.point_key,question_key:q.question_key,
        variant_group:q.variant_group,cognitive_level:q.cognitive_level,selected_answer:selected??null,correct,
        answer_revealed:false,counts_for_mastery:true,elapsed_ms:elapsed
      });
      if(error)throw error;
      const {count}=await db.from("student_attempts").select("id",{count:"exact",head:true}).eq("student_id",account.id).eq("lesson_id",lesson.id).eq("point_key",q.point_key).eq("correct",false);
      const wrong=Number(count||0);
      const nextAction=correct?"continue":wrong>=3?"micro_remediation":wrong>=2?"enhanced_explanation":"hint_and_fresh_variant";
      return json({correct,feedback:correct?q.feedback_correct:q.feedback_wrong,hint:correct?"":q.remediation_hint,next_action:nextAction,objective_key:q.objective_key});
    }

    if(action==="finish_point_check"){
      if(account.role!=="student")return json({error:"forbidden"},403);
      const code=String(body.lesson_code||"").trim().toUpperCase(),pointKey=String(body.point_key||"");
      const rec=await getLesson(code); if(!rec)return json({error:"lesson_not_found"},404);
      const a=await lessonAccess(account.id,code);if(!a.allowed)return json({error:a.reason},403);
      const attempts=(await latestUniqueAttempts(account.id,rec.lesson.id,pointKey,20)).slice(0,3);
      const correct=attempts.filter(x=>x.correct===true).length;
      const mastered=attempts.length>=3&&correct>=2;
      const {count:wrongCount}=await db.from("student_attempts").select("id",{count:"exact",head:true}).eq("student_id",account.id).eq("lesson_id",rec.lesson.id).eq("point_key",pointKey).eq("correct",false);
      await db.from("student_point_mastery").upsert({
        student_id:account.id,lesson_id:rec.lesson.id,point_key:pointKey,
        status:mastered?"mastered":Number(wrongCount||0)>=3?"needs_remediation":"retry_ready",
        correct_count:correct,checked_count:attempts.length,wrong_count:Number(wrongCount||0),
        last_variant_group:attempts[0]?.variant_group||null,mastered_at:mastered?new Date().toISOString():null,updated_at:new Date().toISOString()
      },{onConflict:"student_id,lesson_id,point_key"});
      return json({mastered,correct,total:attempts.length,next_action:mastered?"next_point":Number(wrongCount||0)>=3?"micro_remediation":"retry"});
    }

    if(action==="start_remediation"){
      if(account.role!=="student")return json({error:"forbidden"},403);
      const code=String(body.lesson_code||"").trim().toUpperCase(),pointKey=String(body.point_key||"");
      const rec=await getLesson(code);if(!rec)return json({error:"lesson_not_found"},404);
      const {data:e,error}=await db.from("remediation_events").insert({
        student_id:account.id,lesson_id:rec.lesson.id,point_key:pointKey,trigger_wrong_count:Number(body.wrong_count||3),
        remediation_type:String(body.remediation_type||"micro_remediation"),status:"started",payload:body.payload&&typeof body.payload==="object"?body.payload:{}
      }).select("id,status,started_at").single();
      if(error)throw error;
      await db.from("student_point_mastery").upsert({student_id:account.id,lesson_id:rec.lesson.id,point_key:pointKey,status:"needs_remediation",updated_at:new Date().toISOString()},{onConflict:"student_id,lesson_id,point_key"});
      return json({event:e});
    }

    if(action==="complete_remediation"){
      if(account.role!=="student")return json({error:"forbidden"},403);
      const id=Number(body.event_id);
      const {data:e}=await db.from("remediation_events").select("id,student_id,lesson_id,point_key").eq("id",id).eq("student_id",account.id).maybeSingle();
      if(!e)return json({error:"remediation_not_found"},404);
      await db.from("remediation_events").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",id);
      await db.from("student_point_mastery").upsert({student_id:account.id,lesson_id:e.lesson_id,point_key:e.point_key,status:"retry_ready",updated_at:new Date().toISOString()},{onConflict:"student_id,lesson_id,point_key"});
      return json({ok:true,next_action:"fresh_variant_check"});
    }

    if(action==="finish_lesson_mastery"){
      if(account.role!=="student")return json({error:"forbidden"},403);
      const code=String(body.lesson_code||"").trim().toUpperCase();
      const rec=await getLesson(code);if(!rec)return json({error:"lesson_not_found"},404);
      const a=await lessonAccess(account.id,code);if(!a.allowed)return json({error:a.reason},403);
      const scoring=String(rec.blueprint?.assessment?.scoring||"");
      const result=scoring==="rubric"?await finalizeRubricLesson(account.id,rec.lesson,rec.blueprint):await finalizeAutoLesson(account.id,rec.lesson,rec.blueprint);
      return json(result,result.error?409:200);
    }

    if(action==="lesson_readiness_check"){
      if(!["teacher","admin"].includes(account.role))return json({error:"forbidden"},403);
      const code=String(body.lesson_code||"").trim().toUpperCase();
      const rec=await getLesson(code);if(!rec)return json({error:"lesson_not_found"},404);
      const bp=rec.blueprint;if(!bp)return json({error:"blueprint_missing"},404);
      const points=(Array.isArray(bp.learning_points)?bp.learning_points:[]).filter((p:any)=>p?.masteryRequired!==false);
      const {data:qs}=await db.from("course_question_bank").select("point_key,question_key,variant_group,objective_key").eq("lesson_id",rec.lesson.id).eq("active",true);
      const counts=Object.fromEntries(points.map((p:any)=>[p.key,(qs||[]).filter(q=>q.point_key===p.key).length]));
      const pointReady=points.every((p:any)=>Number(counts[p.key]||0)>=3);
      const scoring=String(bp.assessment?.scoring||"");
      const finalNeeded=scoring==="rubric"?0:Math.max(1,Number(bp.assessment?.itemCount||5));
      const finalCount=(qs||[]).filter(q=>q.point_key==="__final__").length;
      const finalReady=scoring==="rubric"||finalCount>=finalNeeded;
      const objectiveKeys=new Set((Array.isArray(bp.objectives)?bp.objectives:[]).filter((o:any)=>o?.core!==false).map((o:any)=>String(o.key)));
      const covered=new Set((qs||[]).filter(q=>q.objective_key).map(q=>String(q.objective_key)));
      const objectivesReady=scoring==="rubric"||[...objectiveKeys].every(k=>covered.has(k));
      const {data:blocks}=await db.from("lesson_micro_blocks").select("point_key").eq("lesson_id",rec.lesson.id).eq("active",true);
      const contentCounts=Object.fromEntries(points.map((p:any)=>[p.key,(blocks||[]).filter(b=>b.point_key===p.key).length]));
      const contentReady=points.every((p:any)=>Number(contentCounts[p.key]||0)>=1);
      const ready=pointReady&&finalReady&&objectivesReady&&contentReady;
      if(body.update===true)await db.from("lesson_blueprints").update({ready_for_publish:ready,updated_at:new Date().toISOString()}).eq("lesson_id",rec.lesson.id);
      return json({ready,point_counts:counts,content_counts:contentCounts,content_ready:contentReady,final:{count:finalCount,required:finalNeeded,ready:finalReady},objectives_ready:objectivesReady});
    }

    if(action==="score_rubric"){
      if(!["teacher","admin"].includes(account.role))return json({error:"forbidden"},403);
      const studentId=String(body.student_id||""),code=String(body.lesson_code||"").trim().toUpperCase(),rubricId=String(body.rubric_id||"");
      const rec=await getLesson(code);if(!rec)return json({error:"lesson_not_found"},404);
      const scores=Array.isArray(body.scores)?body.scores:[];
      if(!studentId||!rubricId||!scores.length)return json({error:"missing_rubric_data"},400);
      for(const s of scores){
        await db.from("performance_rubric_scores").upsert({
          student_id:studentId,lesson_id:rec.lesson.id,rubric_id:rubricId,criterion_key:String(s.criterion_key),
          score:Number(s.score),is_core:s.is_core!==false,teacher_id:account.id,note:s.note?String(s.note):null
        },{onConflict:"student_id,lesson_id,rubric_id,criterion_key"});
      }
      return json({ok:true});
    }

    if(action==="teacher_lesson_analytics"){
      if(!["teacher","admin"].includes(account.role))return json({error:"forbidden"},403);
      const code=String(body.lesson_code||"").trim().toUpperCase();
      const rec=await getLesson(code);if(!rec)return json({error:"lesson_not_found"},404);
      const [{data:p},{data:a},{data:r}]=await Promise.all([
        db.from("student_point_mastery").select("point_key,status,correct_count,checked_count,wrong_count,updated_at").eq("lesson_id",rec.lesson.id),
        db.from("student_attempts").select("student_id,point_key,correct,elapsed_ms,created_at").eq("lesson_id",rec.lesson.id),
        db.from("remediation_events").select("student_id,point_key,status,started_at,completed_at").eq("lesson_id",rec.lesson.id)
      ]);
      const points:any={};
      for(const row of p||[]){points[row.point_key]??={records:0,mastered:0,needs_remediation:0};points[row.point_key].records++;if(row.status==="mastered")points[row.point_key].mastered++;if(row.status==="needs_remediation")points[row.point_key].needs_remediation++}
      const attempts=a||[],avgTime=attempts.length?Math.round(attempts.reduce((s,x)=>s+Number(x.elapsed_ms||0),0)/attempts.length):0;
      return json({lesson:rec.lesson,points,attempt_count:attempts.length,average_response_ms:avgTime,remediation_count:(r||[]).length});
    }

    return json({error:"unknown_action"},400);
  }catch(e){
    return json({error:"server_error",detail:e instanceof Error?e.message:String(e)},500);
  }
});
