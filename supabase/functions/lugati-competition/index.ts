
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINS=new Set(["https://zarie19991-bit.github.io","http://localhost:8000","http://127.0.0.1:8000","http://localhost:5500","http://127.0.0.1:5500","https://skyblue-cheetah-940953.hostingersite.com"]);
const tidy=(v:unknown)=>String(v??"").trim();
function cors(req:Request){const o=req.headers.get("origin")||"";return{"Access-Control-Allow-Origin":ORIGINS.has(o)?o:"https://zarie19991-bit.github.io","Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"}}
const json=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:cors(req)});
async function sha256(v:string){const x=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v));return Array.from(new Uint8Array(x)).map(n=>n.toString(16).padStart(2,"0")).join("")}
type SubjectScope="all"|"reading"|"math"|"science";
type Access={role:"teacher"|"student";student_id?:string;teacher_access_id?:string;subject_scope?:SubjectScope};
async function access(req:Request):Promise<Access>{
 const h=tidy(req.headers.get("authorization")),token=h.toLowerCase().startsWith("bearer ")?h.slice(7).trim():"";
 if(!token)throw Object.assign(new Error("تسجيل الدخول مطلوب."),{status:401});
 const {data:s,error}=await db.from("lugati_sessions").select("role,student_id,teacher_access_id").eq("token_hash",await sha256(token)).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error)throw error;if(!s)throw Object.assign(new Error("انتهت جلسة الدخول أو أصبحت غير صالحة."),{status:401});
 if(s.role==="student"){
  const {data:u,error:e}=await db.from("nafes_students").select("id").eq("id",s.student_id).eq("is_active",true).maybeSingle();
  if(e)throw e;if(!u)throw Object.assign(new Error("حساب الطالب غير متاح."),{status:401});
  return{role:"student",student_id:String(u.id)};
 }
 const {data:t,error:e}=await db.from("nafes_teacher_access").select("id,subject_scope").eq("id",s.teacher_access_id).eq("active",true).maybeSingle();
 if(e)throw e;if(!t)throw Object.assign(new Error("حساب المعلم غير متاح."),{status:401});
 return{role:"teacher",teacher_access_id:String(t.id),subject_scope:(["reading","math","science"].includes(String(t.subject_scope))?String(t.subject_scope):"all") as SubjectScope};
}
const ARENAS:any={
 reading_1:{key:"reading_1",label:"القراءة 1",subject:"reading",outcome:"1-1-1-2-9",icon:"📘"},
 reading_2:{key:"reading_2",label:"القراءة 2",subject:"reading",outcome:"2-1-1-2-9",icon:"📗"},
 reading_3:{key:"reading_3",label:"القراءة 3",subject:"reading",outcome:"3-1-1-2-9",icon:"📙"},
 math:{key:"math",label:"الرياضيات",subject:"math",outcome:null,icon:"➗"},
 science:{key:"science",label:"العلوم",subject:"science",outcome:null,icon:"🔬"}
};
const LEVELS=["knowledge","application","reasoning"];
const levelLabel=(v:string)=>v==="knowledge"?"معرفة وفهم":v==="application"?"تطبيق":"استدلال";
const shuffle=<T>(x:T[])=>{const a=[...x];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function arena(k:string){const x=ARENAS[k];if(!x)throw Object.assign(new Error("قسم المسابقة غير صحيح."),{status:400});return x}
const teacherScope=(a:Access):SubjectScope=>a.role==="teacher"?(a.subject_scope||"all"):"all";
const teacherAllowsSubject=(a:Access,s:unknown)=>a.role!=="teacher"||teacherScope(a)==="all"||teacherScope(a)===tidy(s);
function requireTeacherSubject(a:Access,s:unknown){if(!teacherAllowsSubject(a,s))throw Object.assign(new Error("هذه المادة خارج صلاحية حسابك."),{status:403})}
function teacherArenaKeys(a:Access){const s=teacherScope(a);return s==="all"?Object.keys(ARENAS):Object.keys(ARENAS).filter(k=>ARENAS[k].subject===s)}
async function currentSeason(){
 let {data:s,error}=await db.from("lugati_competition_seasons").select("*").eq("is_current",true).maybeSingle();if(error)throw error;
 if(!s){
   const {data:last,error:le}=await db.from("lugati_competition_seasons").select("season_no").order("season_no",{ascending:false}).limit(1).maybeSingle();if(le)throw le;
   const no=Number(last?.season_no||0)+1;
   const {data:n,error:ne}=await db.from("lugati_competition_seasons").insert({season_no:no,title:"الموسم "+no,is_current:true}).select("*").single();if(ne)throw ne;s=n;
 }
 return s;
}
async function closeRoundInternal(id:string,when?:string|null){
 const {error}=await db.rpc("lugati_comp_close_round",{p_round_id:id,p_closed_at:when||new Date().toISOString()});if(error)throw error;
}
async function refreshExpired(seasonId?:string){
 let q=db.from("lugati_competition_rounds").select("id,close_at,status").eq("status","open").not("close_at","is",null).lte("close_at",new Date().toISOString());
 if(seasonId)q=q.eq("season_id",seasonId);
 const {data,error}=await q;if(error)throw error;
 for(const r of data||[])await closeRoundInternal(String(r.id),r.close_at);
}
function effectiveStatus(r:any){
 if(r.status==="closed"||r.status==="cancelled"||r.status==="draft")return r.status;
 const now=Date.now(),op=r.open_at?new Date(r.open_at).getTime():0,cl=r.close_at?new Date(r.close_at).getTime():Infinity;
 if(now<op)return"scheduled";if(now>=cl)return"closed";return"open";
}
async function getRound(id:string){
 let {data:r,error}=await db.from("lugati_competition_rounds").select("*").eq("id",id).maybeSingle();if(error)throw error;if(!r)throw Object.assign(new Error("الجولة غير موجودة."),{status:404});
 if(r.status==="open"&&r.close_at&&new Date(r.close_at).getTime()<=Date.now()){
   await closeRoundInternal(id,r.close_at);
   const z=await db.from("lugati_competition_rounds").select("*").eq("id",id).single();if(z.error)throw z.error;r=z.data;
 }
 return r;
}
async function indicatorCatalog(key:string){const {data,error}=await db.rpc("lugati_comp_indicator_catalog",{p_arena_key:key});if(error)throw error;return data||[]}
function validateIndicators(meta:any,raw:any[],catalog:any[]){
 if(!Array.isArray(raw)||raw.length<1||raw.length>5)throw Object.assign(new Error("اختر من مؤشر واحد إلى خمسة مؤشرات."),{status:400});
 const map=new Map(catalog.map((x:any)=>[x.outcome_code+"|"+x.indicator_index,x])),seen=new Set<string>(),out:any[]=[];
 for(const z of raw){
   const k=tidy(z?.outcome_code)+"|"+Number(z?.indicator_index);if(seen.has(k))continue;
   const x:any=map.get(k);if(!x)throw Object.assign(new Error("أحد المؤشرات المختارة غير متاح في هذا القسم."),{status:400});
   if(meta.outcome&&x.outcome_code!==meta.outcome)throw Object.assign(new Error("المؤشر لا ينتمي إلى قسم القراءة المختار."),{status:400});
   seen.add(k);out.push({outcome_code:x.outcome_code,indicator_index:Number(x.indicator_index),indicator_text:x.indicator_text,
     knowledge_count:Number(x.knowledge_count),application_count:Number(x.application_count),reasoning_count:Number(x.reasoning_count)});
 }
 if(out.length<1||out.length>5)throw Object.assign(new Error("اختر من مؤشر واحد إلى خمسة مؤشرات مختلفة."),{status:400});return out;
}
function compactText(v:any){return tidy(v).replace(/\s+/g," ").toLowerCase()}
function needsMissingVisual(x:any){
 const t=compactText((x?.question_text||"")+" "+(x?.context_text||""));
 return /(الشكل|الرسم|الرسم البياني|الصورة|المخطط|التمثيل البياني|الجدول التالي|الجدول أدناه|كما هو موضح|الموضح أدناه|الموضحة أدناه|انظر إلى الشكل|انظر إلى الرسم)/.test(t);
}
function validImage(im:any){return !!im&&/^https:\/\/zarie19991-bit\.github\.io\/moallimi\/question-bank\/assets\/[a-f0-9]{64}\.png$/.test(String(im.url||""))}
function safeCompetitionQuestion(x:any){
 if(!Array.isArray(x?.options)||x.options.length!==4||x.options.some((v:any)=>typeof v!=="string"))return false;
 const ci=Number(x.correct_index);if(!Number.isInteger(ci)||ci<0||ci>3)return false;
 const opts=x.options.map((v:any)=>compactText(v));if(opts.some((v:string)=>!v))return false;
 if(new Set(opts).size!==4)return false;
 if(compactText(x.question_text).length<8)return false;
 if(needsMissingVisual(x)&&!validImage(x.image))return false;
 return true;
}
function cleanCompetitionContext(v:any){
 const t=tidy(v);if(!t)return "";
 if(/^(مراجعة جماعية للحل|موقف تقويمي جديد|تدريب جديد|سؤال تدريبي|نشاط تدريبي)\s*:/i.test(t))return "";
 return t;
}
async function pickCandidate(meta:any,ind:any,level:string,used:Set<string>,usedSeason:Set<string>,usedText:Set<string>){
 const {data,error}=await db.from("nafes_question_bank")
  .select("id,subject_key,outcome_code,indicator_index,indicator_text,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level,image")
  .eq("is_active",true).eq("review_status","approved").eq("alignment_verified",true)
  .eq("subject_key",meta.subject).eq("outcome_code",ind.outcome_code).eq("indicator_index",ind.indicator_index).eq("cognitive_level",level).limit(160);
 if(error)throw error;
 const valid=(data||[]).filter((x:any)=>safeCompetitionQuestion(x)&&!used.has(String(x.id))&&!usedText.has(compactText(x.question_text)));
 if(!valid.length)throw Object.assign(new Error("لا توجد أسئلة سليمة كافية للمؤشر المختار في مستوى "+levelLabel(level)+"."),{status:409});
 const fresh=valid.filter((x:any)=>!usedSeason.has(String(x.id))&&!usedSeason.has(compactText(x.question_text)));if(!fresh.length)throw Object.assign(new Error("نفدت الأسئلة غير المكررة لهذا المؤشر. اختر مؤشرًا آخر أو ابدأ موسمًا جديدًا."),{status:409});const x=shuffle(fresh)[0];
 used.add(String(x.id));usedText.add(compactText(x.question_text));return x;
}
async function buildQuestions(meta:any,inds:any[],seasonId:string,count=15){
 const {data:rs,error:re}=await db.from("lugati_competition_rounds").select("id").eq("season_id",seasonId);if(re)throw re;
 const rids=(rs||[]).map((x:any)=>x.id),usedSeason=new Set<string>();
 for(let offset=0;rids.length;offset+=1000){const {data:u,error:ue}=await db.from("lugati_competition_round_questions").select("id,source_question_id,question_text").in("round_id",rids).order("id").range(offset,offset+999);if(ue)throw ue;for(const x of u||[]){if(x.source_question_id)usedSeason.add(String(x.source_question_id));usedSeason.add(compactText(x.question_text))}if((u||[]).length<1000)break}
 const used=new Set<string>(),usedText=new Set<string>(),out:any[]=[];let pos=1;
 for(let cycle=0;cycle<count/3;cycle++)for(let li=0;li<LEVELS.length;li++){
   const level=LEVELS[li],ind=inds[(cycle+li)%inds.length],x=await pickCandidate(meta,ind,level,used,usedSeason,usedText);
   out.push({position:pos++,source_question_id:x.id,subject_key:x.subject_key,outcome_code:x.outcome_code,indicator_index:Number(x.indicator_index),indicator_text:x.indicator_text,
     image:validImage(x.image)?x.image:null,cognitive_level:x.cognitive_level,context_text:x.context_text||'',question_text:x.question_text,options:x.options,correct_index:Number(x.correct_index),
     explanation:x.explanation||"",difficulty:x.difficulty||null});
 }
 return out;
}
function safeRound(r:any){return{id:r.id,arena_key:r.arena_key,title:r.title,status:r.status,effective_status:effectiveStatus(r),open_at:r.open_at,close_at:r.close_at,closed_at:r.closed_at,selected_indicators:r.selected_indicators,question_count:r.question_count,points_per_correct:r.points_per_correct}}
async function teacherDashboard(req:Request,a:Access){
 if(a.role!=="teacher")return json(req,{error:"هذه العملية للمعلم فقط."},403);
 const s=await currentSeason();await refreshExpired(s.id);
 let rq=db.from("lugati_competition_rounds").select("*").eq("season_id",s.id).order("created_at",{ascending:false});if(teacherScope(a)!=="all")rq=rq.eq("subject_key",teacherScope(a));const {data:rounds,error}=await rq;if(error)throw error;
 const ids=(rounds||[]).map((x:any)=>x.id),counts=new Map<string,any>();
 if(ids.length){const {data:aa,error:ae}=await db.from("lugati_competition_attempts").select("round_id,status").in("round_id",ids);if(ae)throw ae;for(const x of aa||[]){const k=String(x.round_id),z=counts.get(k)||{started:0,finished:0};z.started++;if(x.status!=="in_progress")z.finished++;counts.set(k,z)}}
 const by:any={};for(const k of teacherArenaKeys(a))by[k]=[];
 for(const r of rounds||[])by[r.arena_key].push({...safeRound(r),stats:counts.get(String(r.id))||{started:0,finished:0}});
 const allowed:any={};for(const k of teacherArenaKeys(a))allowed[k]=ARENAS[k];return json(req,{ok:true,season:s,subject_scope:teacherScope(a),arenas:allowed,rounds_by_arena:by});
}
async function catalogAction(req:Request,b:any,a:Access){
 if(a.role!=="teacher")return json(req,{error:"هذه العملية للمعلم فقط."},403);const key=tidy(b?.arena_key),meta=arena(key);requireTeacherSubject(a,meta.subject);
 return json(req,{ok:true,arena:ARENAS[key],indicators:await indicatorCatalog(key)});
}
async function createRound(req:Request,b:any,a:Access){
 if(a.role!=="teacher")return json(req,{error:"هذه العملية للمعلم فقط."},403);
 const key=tidy(b?.arena_key),meta=arena(key);requireTeacherSubject(a,meta.subject);const s=await currentSeason();await refreshExpired(s.id);
 const {data:active,error:ae}=await db.from("lugati_competition_rounds").select("id").eq("season_id",s.id).eq("arena_key",key).eq("status","open").limit(1);if(ae)throw ae;
 if((active||[]).length)throw Object.assign(new Error("يوجد جولة مفتوحة أو مجدولة في هذا القسم. أغلقها أولًا قبل إرسال جولة جديدة."),{status:409});
 const inds=validateIndicators(meta,b?.indicators,await indicatorCatalog(key)),count=Number(b?.question_count??15);
 if(![3,6,9,12,15].includes(count)||count<inds.length*3)return json(req,{error:"اختر عددًا من ٣ إلى ١٥ من مضاعفات الثلاثة، وبحد أدنى ثلاثة أسئلة لكل مؤشر."},400);
 const questions=await buildQuestions(meta,inds,s.id,count);
 const openAt=b?.open_at?new Date(b.open_at):new Date();if(Number.isNaN(openAt.getTime()))throw Object.assign(new Error("وقت فتح الجولة غير صحيح."),{status:400});
 const closeAt=b?.close_at?new Date(b.close_at):null;if(closeAt&&Number.isNaN(closeAt.getTime()))throw Object.assign(new Error("وقت إغلاق الجولة غير صحيح."),{status:400});
 if(closeAt&&closeAt<=openAt)throw Object.assign(new Error("وقت الإغلاق يجب أن يكون بعد وقت الفتح."),{status:400});
 const {count:roundCount,error:ce}=await db.from("lugati_competition_rounds").select("id",{count:"exact",head:true}).eq("season_id",s.id).eq("arena_key",key);if(ce)throw ce;
 const n=Number(roundCount||0)+1,title=tidy(b?.title)||(meta.label+" • الجولة "+n);
 const {data:r,error}=await db.from("lugati_competition_rounds").insert({season_id:s.id,arena_key:key,subject_key:meta.subject,reading_outcome_code:meta.outcome,title,
   selected_indicators:inds,question_count:count,status:"open",open_at:openAt.toISOString(),close_at:closeAt?closeAt.toISOString():null,opened_at:new Date().toISOString(),created_by:a.teacher_access_id}).select("*").single();if(error)throw error;
 const {error:qe}=await db.from("lugati_competition_round_questions").insert(questions.map((q:any)=>({...q,round_id:r.id})));if(qe){await db.from("lugati_competition_rounds").delete().eq("id",r.id);throw qe}
 return json(req,{ok:true,round:{...safeRound(r),effective_status:effectiveStatus(r)},question_count:count,distribution:{knowledge:count/3,application:count/3,reasoning:count/3}});
}
async function closeRound(req:Request,b:any,a:Access){
 if(a.role!=="teacher")return json(req,{error:"هذه العملية للمعلم فقط."},403);const r=await getRound(tidy(b?.round_id));requireTeacherSubject(a,r.subject_key);
 if(r.status!=="closed")await closeRoundInternal(r.id,new Date().toISOString());return json(req,{ok:true,round:safeRound(await getRound(r.id))});
}
async function resetSeason(req:Request,a:Access){
 if(a.role!=="teacher")return json(req,{error:"هذه العملية للمعلم فقط."},403);
 if(teacherScope(a)!=="all")return json(req,{error:"تصفير الموسم متاح للحساب الرئيسي فقط."},403);
 const s=await currentSeason();await refreshExpired(s.id);
 const {data:open,error}=await db.from("lugati_competition_rounds").select("id").eq("season_id",s.id).eq("status","open");if(error)throw error;
 for(const r of open||[])await closeRoundInternal(String(r.id),new Date().toISOString());
 const u=await db.from("lugati_competition_seasons").update({is_current:false,ended_at:new Date().toISOString()}).eq("id",s.id);if(u.error)throw u.error;
 const no=Number(s.season_no||0)+1,{data:n,error:ne}=await db.from("lugati_competition_seasons").insert({season_no:no,title:"الموسم "+no,is_current:true,created_by:a.teacher_access_id}).select("*").single();if(ne)throw ne;
 return json(req,{ok:true,season:n,message:"بدأ موسم جديد وأصبحت النقاط الحالية صفرًا، مع حفظ الموسم السابق في الأرشيف."});
}
async function roundLeaderboards(id:string){
 const [x,y]=await Promise.all([db.rpc("lugati_comp_round_leaderboard",{p_round_id:id}),db.rpc("lugati_comp_round_class_leaderboard",{p_round_id:id})]);
 if(x.error)throw x.error;if(y.error)throw y.error;return{students:x.data||[],classes:y.data||[]};
}

async function teacherIndicatorReport(r:any){
 const [questions,attempts]=await Promise.all([
 db.from("lugati_competition_round_questions").select("id,outcome_code,indicator_index,indicator_text").eq("round_id",r.id),
 db.from("lugati_competition_attempts").select("id,student_id,status,student:nafes_students(full_name,class_name)").eq("round_id",r.id).in("status",["submitted","closed"])
 ]);
 if(questions.error)throw questions.error;if(attempts.error)throw attempts.error;
 const qs=questions.data||[],ats=attempts.data||[],answers:any[]=[];
 for(let i=0;i<ats.length;i+=50){const res=await db.from("lugati_competition_attempt_answers").select("attempt_id,round_question_id,is_correct,completed").in("attempt_id",ats.slice(i,i+50).map((x:any)=>x.id));if(res.error)throw res.error;answers.push(...res.data||[])}
 const key=(q:any)=>q.outcome_code+"|"+q.indicator_index;
 const groups=new Map<string,any>();for(const q of qs){const k=key(q),g=groups.get(k)||{indicator_text:q.indicator_text,outcome_code:q.outcome_code,indicator_index:q.indicator_index,question_ids:[],students:[]};g.question_ids.push(q.id);groups.set(k,g)}
 const byAttempt=new Map<string,Map<string,any>>();for(const x of answers){if(!byAttempt.has(x.attempt_id))byAttempt.set(x.attempt_id,new Map());byAttempt.get(x.attempt_id)!.set(x.round_question_id,x)}
 for(const g of groups.values())for(const at of ats){const aa=byAttempt.get(at.id)||new Map();const correct=g.question_ids.filter((id:string)=>aa.get(id)?.completed&&aa.get(id)?.is_correct).length;const answered=g.question_ids.filter((id:string)=>aa.get(id)?.completed).length;g.students.push({student_id:at.student_id,full_name:(at as any).student?.full_name||"",class_name:(at as any).student?.class_name||"",correct,total:g.question_ids.length,unanswered:g.question_ids.length-answered,percent:Math.round(correct/g.question_ids.length*100)})}
 return {indicator_report:[...groups.values()].map(g=>({indicator_text:g.indicator_text,indicator_index:g.indicator_index,outcome_code:g.outcome_code,questions:g.question_ids.length,students:g.students,needs_support:g.students.filter((x:any)=>x.percent<70)})),support_threshold:70};
}

async function roundResults(req:Request,b:any,a:Access){
 const r=await getRound(tidy(b?.round_id));if(a.role==="teacher")requireTeacherSubject(a,r.subject_key);if(a.role==="student"&&r.status!=="closed")return json(req,{error:"تظهر النتائج بعد إغلاق الجولة من المعلم."},409);
 const boards=await roundLeaderboards(r.id);if(a.role==="teacher")return json(req,{ok:true,round:safeRound(r),...boards,...(await teacherIndicatorReport(r))});
 const me=(boards.students||[]).find((x:any)=>String(x.student_id)===String(a.student_id))||null;
 const {data:at,error}=await db.from("lugati_competition_attempts").select("*").eq("round_id",r.id).eq("student_id",a.student_id).maybeSingle();if(error)throw error;
 let analysis:any[]=[];
 if(at){
   const {data:aa,error:xe}=await db.from("lugati_competition_attempt_answers").select("wrong_attempts,is_correct,completed,elapsed_ms,round_question_id").eq("attempt_id",at.id);if(xe)throw xe;
   const qids=(aa||[]).map((x:any)=>x.round_question_id);let qq:any[]=[];
   if(qids.length){const z=await db.from("lugati_competition_round_questions").select("id,indicator_index,indicator_text,outcome_code,cognitive_level").in("id",qids);if(z.error)throw z.error;qq=z.data||[]}
   const qm=new Map(qq.map((x:any)=>[String(x.id),x])),m=new Map<string,any>();
   for(const x of aa||[]){if(!x.completed)continue;const q:any=qm.get(String(x.round_question_id));if(!q)continue;const k=q.outcome_code+"|"+q.indicator_index,z=m.get(k)||{indicator_index:q.indicator_index,indicator_text:q.indicator_text,outcome_code:q.outcome_code,questions:0,correct:0,wrong_attempts:0,total_time_ms:0,levels:{knowledge:{correct:0,total:0},application:{correct:0,total:0},reasoning:{correct:0,total:0}}};z.questions++;if(x.is_correct)z.correct++;z.wrong_attempts+=Number(x.wrong_attempts||0);z.total_time_ms+=Number(x.elapsed_ms||0);const lv=z.levels[q.cognitive_level];if(lv){lv.total++;if(x.is_correct)lv.correct++}m.set(k,z)}
   analysis=[...m.values()];
 }
 return json(req,{ok:true,round:safeRound(r),me,total_participants:boards.students.length,top_students:(boards.students||[]).slice(0,10),class_leaderboard:boards.classes,indicator_analysis:analysis});
}
const perm=()=>shuffle([0,1,2,3]);
async function finalizeAttempt(at:any,when=new Date()){
 if(at.status!=="in_progress")return at;const duration=Math.max(0,when.getTime()-new Date(at.started_at).getTime());
 const {data,error}=await db.from("lugati_competition_attempts").update({status:"submitted",submitted_at:when.toISOString(),duration_ms:duration,current_position:at.current_position,updated_at:when.toISOString(),last_activity_at:when.toISOString()}).eq("id",at.id).select("*").single();if(error)throw error;return data;
}
async function currentPayload(r:any,at:any){
 if(at.status!=="in_progress")return{finished:true,attempt:{status:at.status}};const pos=Number(at.current_position||1);if(pos>Number(r.question_count||15)){at=await finalizeAttempt(at);return{finished:true,attempt:{status:at.status}}}
 const {data:ans,error:ae}=await db.from("lugati_competition_attempt_answers").select("*").eq("attempt_id",at.id).eq("position",pos).single();if(ae)throw ae;
 const {data:q,error:qe}=await db.from("lugati_competition_round_questions").select("id,position,indicator_index,indicator_text,outcome_code,cognitive_level,context_text,question_text,options,image").eq("id",ans.round_question_id).single();if(qe)throw qe;
 let first=ans.first_seen_at;if(!first){first=new Date().toISOString();const u=await db.from("lugati_competition_attempt_answers").update({first_seen_at:first,updated_at:first}).eq("id",ans.id);if(u.error)throw u.error}
 const order=(Array.isArray(ans.option_order)?ans.option_order:[0,1,2,3]).map(Number),orig=Array.isArray(q.options)?q.options:[],options=order.map((i:number)=>orig[i]);
 return{finished:false,attempt:{id:at.id,current_position:pos,correct_questions:at.correct_questions,wrong_attempts:at.wrong_attempts,started_at:at.started_at},question:{id:q.id,position:pos,indicator_index:q.indicator_index,indicator_text:q.indicator_text,outcome_code:q.outcome_code,cognitive_level:q.cognitive_level,context_text:q.context_text,question_text:q.question_text,image:q.image,options,hearts_remaining:3-Number(ans.wrong_attempts||0),tried_options:ans.selected_history||[]},elapsed_ms:Math.max(0,Date.now()-new Date(at.started_at).getTime())};
}
async function startAttempt(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 const r=await getRound(tidy(b?.round_id));
 const {data:at,error}=await db.rpc("lugati_comp_start_safe",{p_round_id:r.id,p_student_id:a.student_id});
 if(error)throw error;if(at.error)return json(req,at,409);
 if(at.status!=="in_progress")return json(req,{ok:true,already_finished:true});
 return json(req,{ok:true,round:safeRound(r),...(await currentPayload(r,at))});
}
async function currentAttempt(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);const r=await getRound(tidy(b?.round_id));
 const {data:at,error}=await db.from("lugati_competition_attempts").select("*").eq("round_id",r.id).eq("student_id",a.student_id).maybeSingle();if(error)throw error;if(!at)return json(req,{error:"ابدأ الجولة أولًا."},404);
 if(r.status==="closed"&&at.status==="in_progress"){await closeRoundInternal(r.id,r.closed_at||r.close_at||new Date().toISOString());const z=await db.from("lugati_competition_attempts").select("*").eq("id",at.id).single();if(z.error)throw z.error;return json(req,{ok:true,round_closed:true,finished:true,attempt:z.data})}
 return json(req,{ok:true,round:safeRound(r),...(await currentPayload(r,at))});
}
async function answerQuestion(req:Request,b:any,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);
 if(!/^[0-9a-f-]{36}$/i.test(tidy(b.question_id))||!Number.isInteger(b.option_index)||b.option_index<0||b.option_index>3)
   return json(req,{error:"حدّث صفحة المسابقة ثم اختر إجابة واحدة."},400);
 const {data,error}=await db.rpc("lugati_comp_answer_safe",{p_round_id:tidy(b.round_id),p_student_id:a.student_id,p_question_id:b.question_id,p_option_index:b.option_index});
 if(error)throw error;return json(req,data,data.error?409:200);
}
async function studentHome(req:Request,a:Access){
 if(a.role!=="student")return json(req,{error:"هذه العملية للطالب فقط."},403);const s=await currentSeason();await refreshExpired(s.id);
 const {data:student,error:se}=await db.from("nafes_students").select("id,full_name,class_name").eq("id",a.student_id).single();if(se)throw se;
 const {data:rounds,error}=await db.from("lugati_competition_rounds").select("*").eq("season_id",s.id).neq("status","cancelled").order("created_at",{ascending:false});if(error)throw error;
 const rids=(rounds||[]).map((x:any)=>x.id);let attempts:any[]=[];if(rids.length){const z=await db.from("lugati_competition_attempts").select("*").eq("student_id",a.student_id).in("round_id",rids);if(z.error)throw z.error;attempts=z.data||[]}
 const am=new Map(attempts.map((x:any)=>[String(x.round_id),x])),by:any={};
 for(const k of Object.keys(ARENAS)){const all=(rounds||[]).filter((r:any)=>r.arena_key===k).map((r:any)=>({...safeRound(r),attempt:am.get(String(r.id))||null})),op=all.find((r:any)=>r.effective_status==="open"||r.effective_status==="scheduled");by[k]=op||all[0]||null}
 const [lb,ip]=await Promise.all([db.rpc("lugati_comp_season_leaderboard",{p_season_id:s.id}),db.rpc("lugati_comp_student_indicator_points",{p_season_id:s.id,p_student_id:a.student_id})]);if(lb.error)throw lb.error;if(ip.error)throw ip.error;
 const me=(lb.data||[]).find((x:any)=>String(x.student_id)===String(a.student_id))||{rank_no:null,total_points:0,total_correct:0,total_wrong:0,total_duration_ms:0,rounds_played:0};
 const archive=await db.from("lugati_competition_attempts").select("round:lugati_competition_rounds!inner(*)").eq("student_id",a.student_id).eq("round.status","closed").order("created_at",{ascending:false}).limit(200);if(archive.error)throw archive.error;
 return json(req,{ok:true,history:(archive.data||[]).map((x:any)=>safeRound(x.round)),season:s,student,arenas:ARENAS,current_rounds:by,account:me,top_students:(lb.data||[]).slice(0,10),indicator_points:ip.data||[]});
}
async function roundDetail(req:Request,b:any,a:Access){
 if(a.role!=="teacher")return json(req,{error:"هذه العملية للمعلم فقط."},403);const r=await getRound(tidy(b?.round_id));requireTeacherSubject(a,r.subject_key);
 const {data:q,error}=await db.from("lugati_competition_round_questions").select("*").eq("round_id",r.id).order("position");if(error)throw error;return json(req,{ok:true,round:safeRound(r),questions:q||[]});
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
 try{
  const a=await access(req),b=await req.json().catch(()=>({})),act=tidy(b?.action);
  if(act==="teacher_dashboard")return await teacherDashboard(req,a);
  if(act==="indicator_catalog")return await catalogAction(req,b,a);
  if(act==="create_round")return await createRound(req,b,a);
  if(act==="close_round")return await closeRound(req,b,a);
  if(act==="reset_season")return await resetSeason(req,a);
  if(act==="round_results")return await roundResults(req,b,a);
  if(act==="round_detail")return await roundDetail(req,b,a);
  if(act==="student_home")return await studentHome(req,a);
  if(act==="start_attempt")return await startAttempt(req,b,a);
  if(act==="current_attempt")return await currentAttempt(req,b,a);
  if(act==="answer")return await answerQuestion(req,b,a);
  return json(req,{error:"action_not_supported"},400);
 }catch(e){console.error("lugati-competition",e);const s=e&&typeof e==="object"&&"status" in e?Number((e as any).status):500;return json(req,{error:s===500?"تعذر تنفيذ العملية الآن.":String((e as Error).message)},s)}
});
