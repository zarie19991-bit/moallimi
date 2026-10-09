import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ALLOWED=new Set(["https://zarie19991-bit.github.io","http://localhost:8000","http://127.0.0.1:8000","http://localhost:5500","http://127.0.0.1:5500","https://skyblue-cheetah-940953.hostingersite.com"]);
const tidy=(v:unknown)=>String(v??"").trim();
function cors(req:Request){const origin=req.headers.get("origin")||"";const allow=ALLOWED.has(origin)?origin:"https://zarie19991-bit.github.io";return{"Access-Control-Allow-Origin":allow,"Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"};}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors(req)});
async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");}
type SubjectScope="all"|"reading"|"math"|"science";
type Access={role:"teacher"|"student";student_id?:string;teacher_access_id?:string;subject_scope?:SubjectScope;is_demo?:boolean};
const teacherScope=(a:Access):SubjectScope=>a.role==="teacher"?(a.subject_scope||"all"):"all";
const teacherAllows=(a:Access,s:unknown)=>a.role!=="teacher"||teacherScope(a)==="all"||teacherScope(a)===tidy(s);
async function requireAccess(req:Request):Promise<Access>{const auth=tidy(req.headers.get("authorization"));const token=auth.toLowerCase().startsWith("bearer ")?auth.slice(7).trim():"";if(!token)throw Object.assign(new Error("تسجيل الدخول مطلوب."),{status:401});const {data:s,error}=await db.from("lugati_sessions").select("id,role,student_id,teacher_access_id,expires_at").eq("token_hash",await sha256(token)).gt("expires_at",new Date().toISOString()).maybeSingle();if(error)throw error;if(!s)throw Object.assign(new Error("انتهت جلسة الدخول أو أصبحت غير صالحة."),{status:401});if(s.role==="student"){const {data:u,error:e}=await db.from("nafes_students").select("id,is_active,is_demo").eq("id",s.student_id).eq("is_active",true).maybeSingle();if(e)throw e;if(!u)throw Object.assign(new Error("حساب الطالب غير متاح."),{status:401});return{role:"student",student_id:String(u.id),is_demo:u.is_demo===true}}const {data:t,error:te}=await db.from("nafes_teacher_access").select("id,active,subject_scope").eq("id",s.teacher_access_id).eq("active",true).maybeSingle();if(te)throw te;if(!t)throw Object.assign(new Error("حساب المعلم غير متاح."),{status:401});return{role:"teacher",teacher_access_id:String(t.id),subject_scope:(["reading","math","science"].includes(String(t.subject_scope))?String(t.subject_scope):"all") as SubjectScope}}
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
function archiveReadingRows(rows:any[],subject:string){return subject==="reading"?rows.map((q:any)=>({...q,context_text:shortReadingContext(q.context_text,q.question_text)})):rows;}
function sectionPerfs(r:any,source:string){const answers=(r?.answers&&typeof r.answers==="object")?r.answers:{};const groups=new Map<string,any>();for(const sec of(Array.isArray(r?.rendered_sections)?r.rendered_sections:[])){for(const q of(Array.isArray(sec?.questions)?sec.questions:[])){const subject=tidy(q?.subject||sec?.subject),outcome=tidy(q?.outcome),indicator=Number(q?.indicator||0),key=`${subject}:${outcome}:i${indicator}`;if(!["reading","math","science"].includes(subject)||!indicator||!q?.id)continue;if(!groups.has(key))groups.set(key,{student_id:r.student_id,subject_key:subject,outcome_code:outcome,indicator_index:indicator,indicator_text:tidy(q?.indicator_text),correct:0,total:0,source,source_attempt_id:String(r.id),source_submitted_at:r.submitted_at});const g=groups.get(key);g.total++;if(Number(answers[q.id])===Number(q.correctIndex))g.correct++;}}return[...groups.values()].map(g=>({...g,percent:g.total?Math.round((g.correct/g.total)*1000)/10:0}))}
function examPerfs(r:any){const answers=(r?.answers&&typeof r.answers==="object")?r.answers:{},qs=Array.isArray(r?.rendered_questions)?r.rendered_questions:[],groups=new Map<string,any>();for(const q of qs){const subject=tidy(q?.subject||r.subject_key),outcome=tidy(q?.outcome||r.outcome_code),indicator=Number(q?.indicator||r.indicator_index||0),key=`${subject}:${outcome}:i${indicator}`;if(!["reading","math","science"].includes(subject)||!indicator||!q?.id)continue;if(!groups.has(key))groups.set(key,{student_id:r.student_id,subject_key:subject,outcome_code:outcome,indicator_index:indicator,indicator_text:tidy(q?.indicator_text),correct:0,total:0,source:"exam",source_attempt_id:String(r.id),source_submitted_at:r.submitted_at});const g=groups.get(key);g.total++;if(Number(answers[q.id])===Number(q.correctIndex))g.correct++;}return[...groups.values()].map(g=>({...g,percent:g.total?Math.round((g.correct/g.total)*1000)/10:Number(r.percent||0)}))}
function tierFor(p:number|null){if(p==null)return"unclassified";if(p<70)return"remedial";if(p<90)return"reinforcement";return"enrichment"}
function priorityFor(p:number|null){if(p==null)return 0;if(p<70)return Math.max(1,Math.round(p));if(p<90)return 100+Math.round(p);return 200+Math.round(p)}
async function roster(ids?:string[]){let q=db.from("nafes_students").select("id,full_name,class_name,grade,is_active,is_demo").eq("is_active",true).order("class_name").order("full_name");if(ids?.length)q=q.in("id",ids);else q=q.eq("is_demo",false);const {data,error}=await q;if(error)throw error;return data||[]}
async function latestPerformances(ids?:string[]){
  let aq=db.from("nafes_assessment_attempts").select("id,student_id,rendered_sections,answers,submitted_at").not("submitted_at","is",null).order("submitted_at",{ascending:false}).limit(5000),
      sq=db.from("nafes_simulation_attempts").select("id,student_id,rendered_sections,answers,submitted_at").not("submitted_at","is",null).order("submitted_at",{ascending:false}).limit(5000),
      eq=db.from("nafes_exam_attempts").select("id,student_id,subject_key,outcome_code,indicator_index,rendered_questions,answers,percent,submitted_at").not("submitted_at","is",null).order("submitted_at",{ascending:false}).limit(5000);
  if(ids?.length){aq=aq.in("student_id",ids);sq=sq.in("student_id",ids);eq=eq.in("student_id",ids)}
  const[a,s,e]=await Promise.all([aq,sq,eq]);if(a.error)throw a.error;if(s.error)throw s.error;if(e.error)throw e.error;
  let perfs:any[]=[];for(const r of a.data||[])perfs.push(...sectionPerfs(r,"assessment"));for(const r of s.data||[])perfs.push(...sectionPerfs(r,"simulation"));for(const r of e.data||[])perfs.push(...examPerfs(r));
  perfs.sort((x,y)=>String(y.source_submitted_at||"").localeCompare(String(x.source_submitted_at||"")));
  const groups=new Map<string,any>();
  for(const p of perfs){
    if(!p.student_id)continue;
    const k=`${p.student_id}:${p.subject_key}:${p.outcome_code}:i${p.indicator_index}`;
    if(!groups.has(k))groups.set(k,{student_id:p.student_id,subject_key:p.subject_key,outcome_code:p.outcome_code,indicator_index:p.indicator_index,indicator_text:p.indicator_text||"",correct:0,total:0,evidence_count:0,latest_percent:null,previous_percent:null,best_percent:null,source_attempt_id:p.source_attempt_id||null,source_submitted_at:p.source_submitted_at||null,source:p.source||"assessment"});
    const g=groups.get(k);
    if(g.evidence_count===0){g.latest_percent=Number(p.percent||0);g.indicator_text=p.indicator_text||g.indicator_text;g.source_attempt_id=p.source_attempt_id||null;g.source_submitted_at=p.source_submitted_at||null;g.source=p.source||g.source}
    else if(g.evidence_count===1)g.previous_percent=Number(p.percent||0);
    g.correct+=Number(p.correct||0);g.total+=Number(p.total||0);g.evidence_count++;
    const pp=Number(p.percent||0);g.best_percent=g.best_percent==null?pp:Math.max(Number(g.best_percent),pp);
  }
  return [...groups.values()].map(g=>{
    const weighted=g.total?Math.round((g.correct/g.total)*1000)/10:Number(g.latest_percent||0);
    const trend=g.previous_percent==null?null:Math.round((Number(g.latest_percent)-Number(g.previous_percent))*10)/10;
    return {...g,percent:weighted,diagnostic_percent:weighted,trend_points:trend};
  });
}


// Assessment eligibility comes exclusively from submitted Moallimi/NAFES exam,
// assessment, or simulation attempts. No grade or missing answer means no classification.
function moallimiAssessed(p:any){return !!(p&&p.source_attempt_id&&p.source_submitted_at&&Number(p.total)>0&&Number.isFinite(Number(p.percent)));}
function matchesAssessedIndicator(p:any,subject:string,outcome:string,indicator:number){
 return moallimiAssessed(p)&&String(p.subject_key)===subject&&Number(p.indicator_index)===indicator&&(!outcome||String(p.outcome_code||"")===outcome);
}
function taskHasVerifiedMoallimiAttempt(t:any,perfs:any[]){
 return perfs.some(p=>String(p.student_id)===String(t.student_id)&&matchesAssessedIndicator(p,String(t.subject_key||""),String(t.outcome_code||""),Number(t.indicator_index||0)));
}
function planSourceMeta(at:any,assessment:any){
  const paperEvent=Array.isArray(at?.events)&&at.events.some((e:any)=>e?.type==="paper_scan"||e?.method==="omr");
  const isPaper=at?.config?.paper_review===true||assessment?.config?.paper_review===true||paperEvent;
  return{
    source_type:isPaper?"paper_omr":"electronic",
    source_label:isPaper?"التصحيح الآلي الورقي":"اختبار المؤشرات الإلكتروني",
    paper_review_id:isPaper?(tidy(at?.config?.paper_review_id||assessment?.config?.paper_review_id)||null):null
  };
}
async function assessmentPlanSources(studentId:string,scope:SubjectScope="all"){
  const {data:attempts,error}=await db.from("nafes_assessment_attempts")
    .select("id,assessment_id,config,events,rendered_sections,answers,submitted_at")
    .eq("student_id",studentId).not("submitted_at","is",null)
    .order("submitted_at",{ascending:false}).limit(120);
  if(error)throw error;
  const assessmentIds=[...new Set((attempts||[]).map((x:any)=>String(x.assessment_id||"")).filter(Boolean))];
  if(!assessmentIds.length)return[];
  const {data:assessments,error:ae}=await db.from("nafes_assessments")
    .select("id,title,kind,status,config").in("id",assessmentIds).eq("kind","multi_indicator");
  if(ae)throw ae;
  const am=new Map((assessments||[]).map((x:any)=>[String(x.id),x]));
  const sources:any[]=[];
  for(const at of attempts||[]){
    const assessment=am.get(String(at.assessment_id||""));if(!assessment)continue;
    const {source_type,source_label,paper_review_id}=planSourceMeta(at,assessment);
    const raw=sectionPerfs(at,"assessment").filter((p:any)=>["math","science"].includes(String(p.subject_key))&&(scope==="all"||p.subject_key===scope));
    for(const subject of [...new Set(raw.map((p:any)=>String(p.subject_key)))]){
      const perfs=raw.filter((p:any)=>p.subject_key===subject).map((p:any)=>({
        ...p,evidence_count:1,diagnostic_percent:Number(p.percent||0),latest_percent:Number(p.percent||0),
        previous_percent:null,best_percent:Number(p.percent||0),trend_points:null,
        assessment_id:String(at.assessment_id),assessment_title:assessment.title||"اختبار مؤشرات",
        source_key:String(at.id)+":"+subject
      }));
      if(!perfs.length)continue;
      sources.push({
        source_key:String(at.id)+":"+subject,attempt_id:String(at.id),assessment_id:String(at.assessment_id),
        title:assessment.title||"اختبار مؤشرات",subject_key:subject,subject_label:unifiedSubjectLabel(subject),
        submitted_at:at.submitted_at,indicator_count:perfs.length,source_type,source_label,paper_review_id:paper_review_id||null,perfs
      });
    }
  }
  return sources.sort((a:any,b:any)=>String(b.submitted_at||"").localeCompare(String(a.submitted_at||"")));
}
function publicPlanSource(s:any){return s?{source_key:s.source_key,attempt_id:s.attempt_id,assessment_id:s.assessment_id,title:s.title,subject_key:s.subject_key,subject_label:s.subject_label,submitted_at:s.submitted_at,indicator_count:s.indicator_count,source_type:s.source_type||"electronic",source_label:s.source_label||"اختبار المؤشرات الإلكتروني",paper_review_id:s.paper_review_id||null}:null}

async function latestAssessmentPlanPerfs(studentIds:string[],scope:SubjectScope="all"){
  if(!studentIds.length)return[];
  let q=db.from("nafes_assessment_attempts")
    .select("id,assessment_id,student_id,rendered_sections,answers,submitted_at")
    .in("student_id",studentIds).not("submitted_at","is",null)
    .order("submitted_at",{ascending:false}).limit(5000);
  const {data:attempts,error}=await q;if(error)throw error;
  const assessmentIds=[...new Set((attempts||[]).map((x:any)=>String(x.assessment_id||"")).filter(Boolean))];
  if(!assessmentIds.length)return[];
  const {data:assessments,error:ae}=await db.from("nafes_assessments").select("id,title,kind").in("id",assessmentIds).eq("kind","multi_indicator");if(ae)throw ae;
  const am=new Map((assessments||[]).map((x:any)=>[String(x.id),x])),seen=new Set<string>(),out:any[]=[];
  for(const at of attempts||[]){
    const assessment=am.get(String(at.assessment_id||""));if(!assessment)continue;
    const raw=sectionPerfs(at,"assessment").filter((p:any)=>["math","science"].includes(String(p.subject_key))&&(scope==="all"||p.subject_key===scope));
    for(const subject of [...new Set(raw.map((p:any)=>String(p.subject_key)))]){
      const key=String(at.student_id)+":"+subject;if(seen.has(key))continue;seen.add(key);
      for(const p of raw.filter((x:any)=>x.subject_key===subject))out.push({...p,evidence_count:1,diagnostic_percent:Number(p.percent||0),latest_percent:Number(p.percent||0),previous_percent:null,best_percent:Number(p.percent||0),trend_points:null,assessment_id:String(at.assessment_id),assessment_title:assessment.title||"اختبار مؤشرات",source_key:String(at.id)+":"+subject});
    }
  }
  return out;
}

async function pickPlanQuestionIds(subject:string,outcome:string,indicator:number,tier:string,count:number){
  const {data,error}=await db.from("nafes_question_bank")
    .select("id,cognitive_level,options,correct_index,context_text,question_text")
    .eq("is_active",true).eq("review_status","approved").eq("alignment_verified",true)
    .eq("subject_key",subject).eq("outcome_code",outcome).eq("indicator_index",indicator).limit(160);
  if(error)throw error;
  const ids=(data||[]).map((q:any)=>q.id);let excluded=new Set<string>();
  if(ids.length){const {data:ex,error:xe}=await db.from("lugati_remedial_question_exclusions").select("question_id").in("question_id",ids);if(xe)throw xe;excluded=new Set((ex||[]).map((x:any)=>String(x.question_id)))}
  const badVisual=/(?:في الشكل|من الشكل|كما في الشكل|الشكل الآتي|الشكل التالي|الشكل الموضح|الرسم الآتي|الرسم التالي|الرسم الموضح|المخطط الآتي|المخطط التالي|المخطط الموضح|الجدول الآتي|الجدول التالي|الجدول الموضح)/;
  const badMeta=/(?:أي صيغة سؤال تقيس|ما الذي يجب أن تتقنه|أي وصف يعبّر بدقة عن المهارة|أفضل خطوة تبدأ بها|أي سؤال من الآتي يرتبط مباشرة بهذا المؤشر|أي علامة في السؤال تساعدك أكثر)/;
  const rows=(data||[]).filter((q:any)=>{
    const text=String(q.context_text||"")+" "+String(q.question_text||"");
    return !excluded.has(String(q.id))&&!badVisual.test(text)&&!badMeta.test(text)&&Array.isArray(q.options)&&q.options.length===4&&new Set(q.options.map((x:any)=>String(x).trim())).size===4&&Number.isInteger(Number(q.correct_index));
  });
  if(!rows.length)throw Object.assign(new Error("لا توجد أسئلة معتمدة كافية لهذا المؤشر."),{status:409});
  const shuffle=(a:any[])=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const pools:any={knowledge:shuffle(rows.filter((q:any)=>q.cognitive_level==="knowledge")),application:shuffle(rows.filter((q:any)=>q.cognitive_level==="application")),reasoning:shuffle(rows.filter((q:any)=>q.cognitive_level==="reasoning"))};
  const n=Math.max(2,Math.min(6,Math.trunc(Number(count)||3)));
  const target:any=tier==="remedial"
    ?{knowledge:Math.ceil(n*.45),application:Math.floor(n*.45),reasoning:Math.max(0,n-Math.ceil(n*.45)-Math.floor(n*.45))}
    :tier==="enrichment"
      ?{knowledge:0,application:Math.max(1,Math.floor(n*.35)),reasoning:n-Math.max(1,Math.floor(n*.35))}
      :{knowledge:Math.max(0,Math.floor(n*.2)),application:Math.ceil(n*.5),reasoning:n-Math.max(0,Math.floor(n*.2))-Math.ceil(n*.5)};
  const chosen:any[]=[];
  for(const lv of ["knowledge","application","reasoning"])chosen.push(...(pools[lv]||[]).slice(0,target[lv]||0));
  for(const q of shuffle(rows))if(chosen.length<n&&!chosen.some((x:any)=>String(x.id)===String(q.id)))chosen.push(q);
  return chosen.slice(0,n).map((q:any)=>String(q.id));
}
function withEqualWeights(rows:any[]){
  const w=rows.length?Math.round((100/rows.length)*100)/100:0;
  return rows.map((r:any)=>({...r,weight_percent:w,indicator_kind:"مؤشر أداء أكاديمي"}));
}
function overallPlanDecision(rows:any[]){
  const scores=rows.map((r:any)=>Number(r.diagnostic_percent??0));
  if(!scores.length)return{tier:"reinforcement",tier_label:"تعزيزية",overall_score:null,minimum:null,maximum:null,weak_count:0,strong_count:0,critical_count:0,reason:"لا توجد بيانات كافية للتصنيف.",recommendation:""};
  const avg=Math.round((scores.reduce((a,b)=>a+b,0)/scores.length)*10)/10,min=Math.min(...scores),max=Math.max(...scores);
  const weak=scores.filter(x=>x<70).length,critical=scores.filter(x=>x<60).length,strong=scores.filter(x=>x>=90).length;
  let tier="reinforcement",reason="";
  if(avg<70||weak>=2||critical>=1){
    tier="remedial";
    const why=[];if(avg<70)why.push("المتوسط الكلي أقل من 70٪");if(weak>=2)why.push("يوجد مؤشرين علاجيين أو أكثر");if(critical>=1)why.push("يوجد مؤشر شديد الضعف أقل من 60٪");reason=why.join("، ");
  }else if(avg>=90&&min>=80&&strong>=Math.max(1,Math.ceil(scores.length*.8))){
    tier="enrichment";reason="المتوسط 90٪ فأعلى، ولا يوجد مؤشر دون 80٪، ومعظم المؤشرات في مستوى الإتقان.";
  }else{
    tier="reinforcement";reason="الأداء العام فوق الحد العلاجي، لكنه لم يحقق شروط الإثراء المتوازن في جميع المؤشرات.";
  }
  const recommendation=tier==="remedial"
    ?"ورقة علاجية تجمع المؤشرات كلها، مع زيادة التدريب في المؤشرات الأقل أداءً وتثبيت المؤشرات المتقنة."
    :tier==="enrichment"
      ?"ورقة إثرائية تجمع المؤشرات كلها في تطبيقات أعلى تفكيرًا، مع المحافظة على تمثيل كل مؤشر."
      :"ورقة تعزيزية تجمع المؤشرات كلها، وتركز على التطبيق والاستقلالية مع دعم إضافي للمؤشرات الأقرب للحد العلاجي.";
  return{tier,tier_label:tier==="remedial"?"علاجية":tier==="enrichment"?"إثرائية":"تعزيزية",overall_score:avg,minimum:min,maximum:max,weak_count:weak,strong_count:strong,critical_count:critical,reason,recommendation};
}
async function planQuestionGroups(rows:any[],decision:any,baseCount=3){
  const groups:any[]=[];
  for(const r of rows){
    const tier=String(r.tier||"reinforcement");
    let count=Math.max(2,Math.min(5,Number(baseCount||3)));
    if(decision?.tier==="remedial"&&tier==="remedial")count=Math.min(5,count+1);
    if(decision?.tier==="enrichment")count=Math.max(3,count);
    try{
      const ids=await pickPlanQuestionIds(r.subject_key,r.outcome_code,Number(r.indicator_index),tier,count);
      groups.push({subject_key:r.subject_key,outcome_code:r.outcome_code,indicator_index:r.indicator_index,indicator_text:r.indicator_text,tier:r.tier,tier_label:r.tier_label,questions:await taskQuestions(ids)});
    }catch(error){
      groups.push({subject_key:r.subject_key,outcome_code:r.outcome_code,indicator_index:r.indicator_index,indicator_text:r.indicator_text,tier:r.tier,tier_label:r.tier_label,questions:[],warning:String((error as Error)?.message||"تعذر اختيار أسئلة لهذا المؤشر.")});
    }
  }
  return groups;
}

function unifiedTierLabel(t:string){return t==="remedial"?"علاجي":t==="reinforcement"?"تعزيز":"إثرائي"}
function unifiedSubjectLabel(s:string){return s==="math"?"الرياضيات":s==="science"?"العلوم":s==="reading"?"القراءة":"—"}
function unifiedAction(p:any){
  const name=tidy(p.indicator_text)||"المؤشر";
  const tier=tierFor(Number(p.percent||0));
  if(p.subject_key==="math"){
    if(tier==="remedial")return `إعادة بناء «${name}» بمثال محلول مع تبرير كل خطوة، ثم 3 مسائل متدرجة وتغذية راجعة مباشرة.`;
    if(tier==="reinforcement")return `تثبيت «${name}» بمسألتين تطبيقيتين ثم مسألة متعددة الخطوات مع تفسير استراتيجية الحل.`;
    return `تحدٍّ إثرائي في «${name}» يتطلب اختيار استراتيجية، حل موقف غير مألوف، ثم تبرير صحة الحل أو مقارنة طريقتين.`;
  }
  if(p.subject_key==="science"){
    if(tier==="remedial")return `إعادة بناء «${name}» برسم/نموذج أو موقف علمي، ثم ربط الدليل بالمفهوم وحل 3 أسئلة متدرجة.`;
    if(tier==="reinforcement")return `تثبيت «${name}» بتحليل بيانات أو تجربة قصيرة، ثم تفسير النتيجة وربط السبب بالأثر.`;
    return `مهمة إثرائية في «${name}» تتطلب التنبؤ أو تصميم تفسير/تجربة، واستخدام دليل علمي للدفاع عن الإجابة.`;
  }
  return `تدريب مخصص على «${name}» وفق نتيجة الطالب الحالية.`;
}
function unifiedSuccess(p:any){
  const tier=tierFor(Number(p.percent||0));
  if(tier==="remedial")return "تحقق قصير جديد: 80٪ فأعلى، ثم تثبيت لاحق دون مساعدة.";
  if(tier==="reinforcement")return "تحقق تطبيقي جديد: 90٪ فأعلى دون تلميحات.";
  return "تحدٍ أعلى تفكيرًا: 90٪ فأعلى مع تفسير أو تبرير الإجابة.";
}
function unifiedRows(perfs:any[],scope:SubjectScope="all"){
  return perfs
    .filter((p:any)=>["math","science"].includes(String(p.subject_key))&&(scope==="all"||p.subject_key===scope))
    .map((p:any)=>{
      const diagnostic=Number(p.diagnostic_percent??p.percent??0),latest=Number(p.latest_percent??diagnostic);
      const tier=tierFor(diagnostic);
      return {
        subject_key:p.subject_key,subject_label:unifiedSubjectLabel(p.subject_key),outcome_code:p.outcome_code||"",indicator_index:Number(p.indicator_index||0),
        indicator_text:p.indicator_text||`المؤشر ${p.indicator_index}`,measurements:Number(p.evidence_count||1),question_evidence:Number(p.total||0),
        diagnostic_percent:diagnostic,latest_percent:latest,previous_percent:p.previous_percent==null?null:Number(p.previous_percent),
        best_percent:p.best_percent==null?latest:Number(p.best_percent),trend_points:p.trend_points==null?null:Number(p.trend_points),
        last_measured_at:p.source_submitted_at||null,tier,tier_label:unifiedTierLabel(tier),action:unifiedAction({...p,percent:diagnostic}),success_criterion:unifiedSuccess({...p,percent:diagnostic})
      };
    })
    .sort((a:any,b:any)=>{
      const order:any={remedial:0,reinforcement:1,enrichment:2};
      return (order[a.tier]-order[b.tier])||a.diagnostic_percent-b.diagnostic_percent||String(a.subject_key).localeCompare(String(b.subject_key));
    });
}
function unifiedSummary(rows:any[]){return{indicators:rows.length,remedial:rows.filter(x=>x.tier==="remedial").length,reinforcement:rows.filter(x=>x.tier==="reinforcement").length,enrichment:rows.filter(x=>x.tier==="enrichment").length,measurements:rows.reduce((n,x)=>n+Number(x.measurements||0),0)}}
async function studentUnifiedPlan(req:Request,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  const students=await roster([access.student_id!]),student=students[0]||null,sources=await assessmentPlanSources(access.student_id!,"all"),source=sources[0]||null;
  if(!source)return json(req,{ok:true,student,selected_source:null,sources:[],summary:unifiedSummary([]),decision:null,rows:[],question_groups:[]});
  const rows=withEqualWeights(unifiedRows(source.perfs||[],"all")),decision=overallPlanDecision(rows),question_groups=await planQuestionGroups(rows,decision,3);
  return json(req,{ok:true,student,selected_source:publicPlanSource(source),sources:sources.map(publicPlanSource),method:{label:"تصنيف تربوي متوازن",description:"كل مؤشر له وزن متساوٍ داخل الاختبار. التصنيف النهائي لا يعتمد على المتوسط وحده؛ وجود ضعف حاد أو تكرر المؤشرات العلاجية يمنع إخفاء الفجوات.",weights:"متساوية بين مؤشرات الاختبار",thresholds:{indicator_remedial:"أقل من 70٪",indicator_reinforcement:"70٪ إلى أقل من 90٪",indicator_enrichment:"90٪ فأعلى"}},summary:unifiedSummary(rows),decision,rows,question_groups});
}
async function teacherUnifiedOverview(req:Request,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const scope=teacherScope(access);if(scope==="reading")return json(req,{ok:true,subject_scope:scope,summary:{students:0,remedial:0,reinforcement:0,enrichment:0}});
  const students=await roster(),ids=students.map((s:any)=>String(s.id)),perfs=await latestAssessmentPlanPerfs(ids,scope),bySource=new Map<string,any[]>();
  for(const p of perfs){const key=String(p.student_id)+":"+String(p.source_key);if(!bySource.has(key))bySource.set(key,[]);bySource.get(key)!.push(p)}
  const decisions=[...bySource.values()].map((group:any[])=>overallPlanDecision(withEqualWeights(unifiedRows(group,scope))));
  const summary={students:decisions.length,remedial:decisions.filter((d:any)=>d.tier==="remedial").length,reinforcement:decisions.filter((d:any)=>d.tier==="reinforcement").length,enrichment:decisions.filter((d:any)=>d.tier==="enrichment").length};
  return json(req,{ok:true,subject_scope:scope,summary});
}
async function teacherUnifiedSources(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const studentId=tidy(body?.student_id);if(!studentId)return json(req,{error:"اختر الطالب أولًا."},400);
  const students=await roster([studentId]);if(!students[0])return json(req,{error:"الطالب غير موجود أو غير نشط."},404);
  const scope=teacherScope(access);if(scope==="reading")return json(req,{ok:true,sources:[]});
  const sources=await assessmentPlanSources(studentId,scope);
  return json(req,{ok:true,sources:sources.map(publicPlanSource)});
}
async function teacherUnifiedPlan(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const studentId=tidy(body?.student_id);if(!studentId)return json(req,{error:"اختر الطالب أولًا."},400);
  const students=await roster([studentId]);const student=students[0];if(!student)return json(req,{error:"الطالب غير موجود أو غير نشط."},404);
  const scope=teacherScope(access);if(scope==="reading")return json(req,{ok:true,student,subject_scope:scope,summary:unifiedSummary([]),decision:null,rows:[],question_groups:[]});
  const sources=await assessmentPlanSources(studentId,scope),requested=tidy(body?.source_key),source=(requested?sources.find((x:any)=>String(x.source_key)===requested):sources[0])||null;
  if(!source)return json(req,{ok:true,student,subject_scope:scope,selected_source:null,sources:[],summary:unifiedSummary([]),decision:null,rows:[],question_groups:[]});
  const rows=withEqualWeights(unifiedRows(source.perfs||[],scope)),decision=overallPlanDecision(rows),question_groups=await planQuestionGroups(rows,decision,Math.max(2,Math.min(5,Number(body?.questions_per_indicator||3))));
  return json(req,{ok:true,student,subject_scope:scope,selected_source:publicPlanSource(source),sources:sources.map(publicPlanSource),method:{label:"تصنيف تربوي متوازن",description:"الخطة محصورة في مؤشرات المصدر المحدد نفسه، سواء كان اختبار المؤشرات الإلكتروني أو اختبارًا ورقيًا معتمدًا عبر التصحيح الآلي. كل مؤشر ممثل بوزن متساوٍ، والتصنيف النهائي يستخدم المتوسط مع بوابات أمان تمنع إخفاء مؤشر ضعيف داخل متوسط مرتفع.",weights:"متساوية بين مؤشرات الاختبار",thresholds:{indicator_remedial:"أقل من 70٪",indicator_reinforcement:"70٪ إلى أقل من 90٪",indicator_enrichment:"90٪ فأعلى"}},summary:unifiedSummary(rows),decision,rows,question_groups});
}

async function syncStudents(ids?:string[],scope:SubjectScope="all"){
  const students=await roster(ids),studentIds=students.map((s:any)=>String(s.id));
  let perfs=await latestPerformances(studentIds);
  if(scope!=="all")perfs=perfs.filter((p:any)=>p.subject_key===scope);
  const byStudent=new Map<string,any[]>();
  for(const p of perfs){const id=String(p.student_id);if(!byStudent.has(id))byStudent.set(id,[]);byStudent.get(id)!.push(p)}

  let existingQ=db.from("lugati_adaptive_assignments")
    .select("id,student_id,subject_key,outcome_code,indicator_index,source_attempt_id,source_submitted_at,status,training_attempts,last_training_percent,completed_at");
  if(studentIds.length)existingQ=existingQ.in("student_id",studentIds);
  if(scope!=="all")existingQ=existingQ.eq("subject_key",scope);
  const {data:existing,error:xe}=await existingQ;if(xe)throw xe;

  const em=new Map<string,any>();
  for(const x of existing||[])em.set(`${x.student_id}:${x.subject_key}:${x.outcome_code}:i${x.indicator_index}`,x);
  const inserts:any[]=[],updates:any[]=[];

  for(const s of students){
    const sid=String(s.id),wanted=byStudent.get(sid)||[];
    // لا ننشئ أي مؤشر افتراضي لطالب لم يختبر؛ الخطة تعتمد على نتائج فعلية فقط.
    for(const p of wanted){
      const key=`${sid}:${p.subject_key}:${p.outcome_code}:i${p.indicator_index}`,ex=em.get(key);
      const payload={student_id:sid,subject_key:p.subject_key,outcome_code:p.outcome_code||"",indicator_index:Number(p.indicator_index),
        indicator_text:p.indicator_text||`المؤشر ${p.indicator_index}`,source_percent:p.percent==null?null:Number(p.percent),
        source_attempt_id:p.source_attempt_id||null,source_submitted_at:p.source_submitted_at||null,
        tier:tierFor(p.percent==null?null:Number(p.percent)),priority:priorityFor(p.percent==null?null:Number(p.percent)),updated_at:new Date().toISOString()};
      if(!ex)inserts.push({...payload,status:"assigned",assigned_at:new Date().toISOString()});
      else{
        const newer=p.source_attempt_id&&String(p.source_attempt_id)!==String(ex.source_attempt_id||"");
        updates.push({id:ex.id,payload:newer?{...payload,status:"assigned",completed_at:null}:{...payload}});
      }
    }
  }
  if(inserts.length){for(let i=0;i<inserts.length;i+=500){const {error}=await db.from("lugati_adaptive_assignments").insert(inserts.slice(i,i+500));if(error&&error.code!=="23505")throw error}}
  for(const u of updates){const {error}=await db.from("lugati_adaptive_assignments").update(u.payload).eq("id",u.id);if(error)throw error}
  return{students:students.length,performance_rows:perfs.length,created:inserts.length,updated:updates.length,subject_scope:scope};
}
async function myPlan(req:Request,access:Access){await syncStudents([access.student_id!]);const {data,error}=await db.from("lugati_adaptive_assignments").select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,source_percent,tier,status,priority,training_attempts,last_training_percent,assigned_at,completed_at,updated_at").eq("student_id",access.student_id!).order("priority",{ascending:true}).order("updated_at",{ascending:false});if(error)throw error;return json(req,{ok:true,assignments:data||[]})}
async function teacherOverview(req:Request,access:Access){
  const sync=await syncStudents(undefined,teacherScope(access));
  const [sr,ar]=await Promise.all([
    roster(),
    db.from("lugati_adaptive_assignments")
      .select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,source_percent,tier,status,priority,training_attempts,last_training_percent,assigned_at,completed_at,updated_at")
      .order("priority",{ascending:true})
  ]);
  if((ar as any).error)throw (ar as any).error;
  const assignments=((ar as any).data||[]).filter((a:any)=>teacherAllows(access,a.subject_key));
  const by=new Map<string,any[]>();
  for(const a of assignments){const id=String(a.student_id);if(!by.has(id))by.set(id,[]);by.get(id)!.push(a)}
  const students=sr.map((s:any)=>{
    const rows=by.get(String(s.id))||[],active=rows.find((x:any)=>x.status!=="mastered")||rows[0]||null;
    const noResult=rows.length===0;
    return{id:s.id,full_name:s.full_name,class_name:s.class_name,grade:s.grade,total_assignments:rows.length,
      remedial:rows.filter((x:any)=>x.tier==="remedial").length,
      reinforcement:rows.filter((x:any)=>x.tier==="reinforcement").length,
      enrichment:rows.filter((x:any)=>x.tier==="enrichment").length,
      mastered:rows.filter((x:any)=>x.status==="mastered").length,no_result:noResult,current:active};
  });
  const noResultStudents=students.filter((x:any)=>x.no_result===true).length;
  const totals={students:students.length,assignments:assignments.length,
    starter:0,
    students_without_result:noResultStudents,
    remedial:assignments.filter((x:any)=>x.tier==="remedial").length,
    reinforcement:assignments.filter((x:any)=>x.tier==="reinforcement").length,
    enrichment:assignments.filter((x:any)=>x.tier==="enrichment").length,
    mastered:assignments.filter((x:any)=>x.status==="mastered").length,
    needs_retry:assignments.filter((x:any)=>x.status==="needs_retry").length};
  return json(req,{ok:true,subject_scope:teacherScope(access),sync,totals,students});
}
async function submitTraining(req:Request,body:any,access:Access){
  const id=tidy(body?.assignment_id);
  if(!id)return json(req,{error:"التدريب غير محدد."},400);
  if(access.role!=="student")return json(req,{error:"تسليم التدريب متاح للطالب فقط."},403);

  const {data:a,error}=await db.from("lugati_adaptive_assignments")
    .select("id,student_id,training_attempts,subject_key,outcome_code,indicator_index")
    .eq("id",id).maybeSingle();
  if(error)throw error;
  if(!a)return json(req,{error:"التدريب غير موجود."},404);
  if(String(a.student_id)!==access.student_id)return json(req,{error:"غير مصرح بهذا التدريب."},403);

  const response=body?.response&&typeof body.response==="object"&&!Array.isArray(body.response)?body.response:null;
  const answers=response?.answers&&typeof response.answers==="object"&&!Array.isArray(response.answers)?response.answers:null;
  if(!answers||!Object.keys(answers).length)return json(req,{error:"أرسل إجابات التدريب ليتم تصحيحها في الخادم."},400);

  const ids=Object.keys(answers).map(String).slice(0,100);
  const {data:qs,error:qe}=await db.from("nafes_question_bank")
    .select("id,subject_key,outcome_code,indicator_index,correct_index,is_active,review_status")
    .in("id",ids);
  if(qe)throw qe;
  const valid=(qs||[]).filter((q:any)=>q.is_active&&q.review_status==="approved"&&q.subject_key===a.subject_key&&q.outcome_code===a.outcome_code&&Number(q.indicator_index)===Number(a.indicator_index));
  if(valid.length!==ids.length)return json(req,{error:"تتضمن الإجابات سؤالًا غير صالح لهذا التدريب."},400);

  let score=0;
  for(const q of valid)if(Number(answers[String(q.id)])===Number(q.correct_index))score++;
  const total=valid.length;
  const percent=total?Math.round((score/total)*1000)/10:0;
  const safeResponse={answers:Object.fromEntries(ids.map(k=>[k,Number(answers[k])]))};

  const {error:ie}=await db.from("lugati_adaptive_training_attempts")
    .insert({assignment_id:id,student_id:access.student_id,score,total,percent,response:safeResponse});
  if(ie)throw ie;
  const mastered=percent>=90;
  const {data:updated,error:ue}=await db.from("lugati_adaptive_assignments")
    .update({status:mastered?"mastered":"needs_retry",training_attempts:Number(a.training_attempts||0)+1,last_training_percent:percent,completed_at:mastered?new Date().toISOString():null,updated_at:new Date().toISOString()})
    .eq("id",id).eq("student_id",access.student_id!)
    .select("id,status,training_attempts,last_training_percent,completed_at").single();
  if(ue)throw ue;
  return json(req,{ok:true,score,total,percent,mastered,assignment:updated});
}
async function startTraining(req:Request,body:any,access:Access){const id=tidy(body?.assignment_id);if(!id)return json(req,{error:"التدريب غير محدد."},400);const {data,error}=await db.from("lugati_adaptive_assignments").update({status:"in_progress",updated_at:new Date().toISOString()}).eq("id",id).eq("student_id",access.student_id!).select("id,status").maybeSingle();if(error)throw error;if(!data)return json(req,{error:"التدريب غير متاح."},404);return json(req,{ok:true,assignment:data})}


async function teacherResponseTracking(req:Request,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const [rr,ar,tr,dr]=await Promise.all([
    db.from("nafes_students").select("id,full_name,class_name,grade,is_active,is_demo").eq("is_active",true).eq("is_demo",false),
    db.from("lugati_adaptive_assignments").select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,tier,status,training_attempts,last_training_percent,assigned_at,updated_at"),
    db.from("lugati_adaptive_training_attempts").select("assignment_id,student_id,score,total,percent,submitted_at").order("submitted_at",{ascending:false}),
    db.from("lugati_teacher_tasks").select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,tier,status,score,total,percent,assigned_at,started_at,completed_at,updated_at").eq("teacher_access_id",access.teacher_access_id!)
  ]);
  for(const x of [rr,ar,tr,dr]) if((x as any).error) throw (x as any).error;
  const students=(rr as any).data||[], sm=new Map<string,any>(); for(const s of students) sm.set(String(s.id),s);
   const eligiblePerfs=students.length?await latestPerformances(students.map((s:any)=>String(s.id))):[];
  const latest=new Map<string,any>(); for(const a of (tr as any).data||[]){const k=String(a.assignment_id);if(!latest.has(k))latest.set(k,a)}
  const auto=((ar as any).data||[]).filter((a:any)=>teacherAllows(access,a.subject_key)&&["starter","remedial","reinforcement","enrichment"].includes(String(a.tier))).map((a:any)=>{const st=sm.get(String(a.student_id))||null,la=latest.get(String(a.id))||null;return{
    source:"auto",id:a.id,student_id:a.student_id,student_name:st?.full_name||"طالب",class_name:st?.class_name||"",grade:st?.grade||"",
    subject_key:a.subject_key,outcome_code:a.outcome_code,indicator_index:a.indicator_index,indicator_text:a.indicator_text,title:a.tier==="enrichment"?"ورقة إثرائية":a.tier==="reinforcement"?"ورقة تعزيز":"ورقة علاجية",
    tier:a.tier,status:a.status,responded:!!la,score:la?.score??null,total:la?.total??null,percent:la?.percent??a.last_training_percent??null,
    assigned_at:a.assigned_at,submitted_at:la?.submitted_at??null,updated_at:a.updated_at
  }});
  const direct=((dr as any).data||[]).filter((a:any)=>taskHasVerifiedMoallimiAttempt(a,eligiblePerfs)).map((a:any)=>{const st=sm.get(String(a.student_id))||null;return{
    source:"direct",id:a.id,student_id:a.student_id,student_name:st?.full_name||"طالب",class_name:st?.class_name||"",grade:st?.grade||"",
    subject_key:a.subject_key,outcome_code:a.outcome_code,indicator_index:a.indicator_index,indicator_text:a.indicator_text,title:a.title||"تدريب من المعلم",
    tier:a.tier,status:a.status,responded:a.status==="completed",score:a.score??null,total:a.total??null,percent:a.percent??null,
    assigned_at:a.assigned_at,submitted_at:a.completed_at??null,updated_at:a.updated_at
  }});
  const items=[...auto,...direct].sort((a:any,b:any)=>String(b.submitted_at||b.assigned_at||"").localeCompare(String(a.submitted_at||a.assigned_at||"")));
  const totals={
    total:items.length,
    answered:items.filter((x:any)=>x.responded).length,
    pending:items.filter((x:any)=>!x.responded).length,
    remedial:items.filter((x:any)=>x.tier==="remedial"||x.tier==="starter").length,
    enrichment:items.filter((x:any)=>x.tier==="enrichment").length,
    reinforcement:items.filter((x:any)=>x.tier==="reinforcement").length
  };
  return json(req,{ok:true,totals,items});
}


async function pickTaskQuestionIds(subject:string,outcome:string,indicator:number,count:number){
  const {data,error}=await db.from("nafes_question_bank")
    .select("id,cognitive_level,options,correct_index")
    .eq("is_active",true).eq("review_status","approved").eq("alignment_verified",true)
    .eq("subject_key",subject).eq("outcome_code",outcome).eq("indicator_index",indicator).limit(120);
  if(error)throw error;
  const ids=(data||[]).map((q:any)=>q.id);
  let excluded=new Set<string>();
  if(ids.length){const {data:ex,error:xe}=await db.from("lugati_remedial_question_exclusions").select("question_id").in("question_id",ids);if(xe)throw xe;excluded=new Set((ex||[]).map((x:any)=>String(x.question_id)))}
  const badVisual=/(?:في الشكل|من الشكل|كما في الشكل|الشكل الآتي|الشكل التالي|الشكل الموضح|الرسم الآتي|الرسم التالي|الرسم الموضح|المخطط الآتي|المخطط التالي|المخطط الموضح|الجدول الآتي|الجدول التالي|الجدول الموضح)/;
  const badMeta=/(?:أي صيغة سؤال تقيس|ما الذي يجب أن تتقنه|أي وصف يعبّر بدقة عن المهارة|أفضل خطوة تبدأ بها|أي سؤال من الآتي يرتبط مباشرة بهذا المؤشر|أي علامة في السؤال تساعدك أكثر)/;
  const rows=(data||[]).filter((q:any)=>{
    const text=String(q.context_text||"")+" "+String(q.question_text||"");
    return !excluded.has(String(q.id))&&!badVisual.test(text)&&!badMeta.test(text)&&Array.isArray(q.options)&&q.options.length===4&&new Set(q.options.map((x:any)=>String(x).trim())).size===4&&Number.isInteger(Number(q.correct_index));
  });
  if(!rows.length)throw Object.assign(new Error("لا توجد أسئلة علاجية صالحة كافية لهذا المؤشر."),{status:409});
  const shuffle=(a:any[])=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const pools:any={knowledge:shuffle(rows.filter((q:any)=>q.cognitive_level==="knowledge")),application:shuffle(rows.filter((q:any)=>q.cognitive_level==="application")),reasoning:shuffle(rows.filter((q:any)=>q.cognitive_level==="reasoning"))};
  const target=count>=8?{knowledge:3,application:3,reasoning:2}:{knowledge:Math.max(1,Math.floor(count/3)),application:Math.max(1,Math.floor(count/3)),reasoning:Math.max(1,count-2*Math.floor(count/3))};
  const chosen:any[]=[];for(const lv of ["knowledge","application","reasoning"]){chosen.push(...(pools[lv]||[]).slice(0,target[lv]||0))}
  for(const q of shuffle(rows))if(chosen.length<count&&!chosen.some((x:any)=>String(x.id)===String(q.id)))chosen.push(q);
  return chosen.slice(0,count).map((q:any)=>String(q.id));
}
async function taskQuestions(ids:string[]){
  if(!ids.length)return[];
  const {data,error}=await db.from("nafes_question_bank").select("id,context_text,question_text,options,cognitive_level,difficulty").in("id",ids);if(error)throw error;
  const m=new Map((data||[]).map((q:any)=>[String(q.id),q]));
  return ids.map(id=>m.get(String(id))).filter(Boolean).map((q:any)=>({id:q.id,context_text:q.context_text||"",question_text:q.question_text,options:q.options,cognitive_level:q.cognitive_level,difficulty:q.difficulty}));
}
async function teacherSendIndicator(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const subject=tidy(body?.subject_key),outcome=tidy(body?.outcome_code),indicator=Number(body?.indicator_index||0),tier=["remedial","reinforcement","enrichment"].includes(tidy(body?.tier))?tidy(body.tier):"remedial";
  if(!["reading","math","science"].includes(subject)||!outcome||!indicator)return json(req,{error:"بيانات المؤشر غير مكتملة."},400);
  if(!teacherAllows(access,subject))return json(req,{error:"هذه المادة خارج صلاحية حسابك."},403);

  const [allPerfs,students]=await Promise.all([latestPerformances(),roster()]);
  const rosterIds=new Set((students||[]).map((s:any)=>String(s.id)));
  const perfs=(allPerfs||[]).filter((p:any)=>rosterIds.has(String(p.student_id))&&p.subject_key===subject&&p.outcome_code===outcome&&Number(p.indicator_index)===indicator);

  // Never add students with no submitted Moallimi result to any of these tiers.
  const targets=perfs.filter((p:any)=>moallimiAssessed(p)&&(
    tier==="remedial"?Number(p.percent)<70:
    tier==="reinforcement"?Number(p.percent)>=70&&Number(p.percent)<90:
    Number(p.percent)>=90
  ));
  if(!targets.length)return json(req,{ok:true,sent:0,skipped:0,total_targets:0,no_result_targets:0,message:"لا توجد نتائج اختبار معلّمي مؤهلة لهذا المسار والمؤشر."});
  const studentIds=[...new Set(targets.map((p:any)=>String(p.student_id)))];
  const {data:existing,error:xe}=await db.from("lugati_teacher_tasks").select("student_id,source_attempt_id,status").eq("teacher_access_id",access.teacher_access_id!).eq("subject_key",subject).eq("outcome_code",outcome).eq("indicator_index",indicator).eq("tier",tier).in("student_id",studentIds);if(xe)throw xe;
  const existingActive=new Set((existing||[]).filter((x:any)=>x.source_attempt_id&&["assigned","in_progress"].includes(String(x.status))).map((x:any)=>String(x.student_id)));
  const qcount=Math.max(5,Math.min(12,Number(body?.question_count||8))),questionIds=await pickTaskQuestionIds(subject,outcome,indicator,qcount),now=new Date().toISOString(),rows:any[]=[];let skipped=0;
  for(const p of targets){
    if(existingActive.has(String(p.student_id))){skipped++;continue}
    rows.push({teacher_access_id:access.teacher_access_id,student_id:p.student_id,subject_key:subject,outcome_code:outcome,indicator_index:indicator,indicator_text:tidy(body?.indicator_text)||p.indicator_text||("المؤشر "+indicator),
      title:tier==="remedial"?"مسار علاجي للمؤشر":tier==="reinforcement"?"مسار تعزيزي للمؤشر":"مسار إثرائي للمؤشر",
      instructions:tier==="remedial"?"تدريب علاجي بناءً على نتيجة اختبار معلّمي المسلّم.":tier==="reinforcement"?"تدريب تعزيز بناءً على نتيجة اختبار معلّمي المسلّم.":"تدريب إثرائي بناءً على نتيجة اختبار معلّمي المسلّم.",
      tier,question_count:questionIds.length,status:"assigned",source_percent:Number(p.percent),source_attempt_id:p.source_attempt_id||null,source_submitted_at:p.source_submitted_at||null,question_ids:questionIds,assigned_at:now,updated_at:now});
  }
  if(rows.length){for(let i=0;i<rows.length;i+=300){const {error}=await db.from("lugati_teacher_tasks").insert(rows.slice(i,i+300));if(error)throw error}}
  const sentMissing=rows.filter((r:any)=>r.source_percent==null).length;
  return json(req,{ok:true,sent:rows.length,skipped,total_targets:targets.length,no_result_targets:0,sent_without_result:sentMissing,
    message:rows.length?("تم الإرسال إلى "+rows.length+" طالبًا ممن اختبروا في معلّمي وحققوا شروط المسار."):"سبق إرسال المسار للطلاب المؤهلين."});
}
async function teacherSendTask(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const studentId=tidy(body?.student_id),subject=tidy(body?.subject_key),outcome=tidy(body?.outcome_code),indicator=Number(body?.indicator_index||0);
  if(!studentId||!["reading","math","science"].includes(subject)||!indicator)return json(req,{error:"بيانات التدريب غير مكتملة."},400);if(!teacherAllows(access,subject))return json(req,{error:"هذه المادة خارج صلاحية حسابك."},403);
  const {data:s,error:se}=await db.from("nafes_students").select("id,is_active").eq("id",studentId).eq("is_active",true).maybeSingle();if(se)throw se;if(!s)return json(req,{error:"الطالب غير موجود."},404);
  const tested=(await latestPerformances([studentId])).find((p:any)=>matchesAssessedIndicator(p,subject,outcome,indicator));if(!tested)return json(req,{error:"لا يمكن إرسال مسار علاجي أو تعزيز أو إثراء: لا توجد نتيجة مسلّمة في معلّمي لهذا الطالب والمؤشر."},409);
  const qcount=Math.max(3,Math.min(20,Number(body?.question_count||8))),questionIds=await pickTaskQuestionIds(subject,outcome,indicator,qcount);const payload={teacher_access_id:access.teacher_access_id,student_id:studentId,subject_key:subject,outcome_code:outcome,indicator_index:indicator,indicator_text:tidy(body?.indicator_text)||`المؤشر ${indicator}`,title:tidy(body?.title)||"تدريب من المعلم",instructions:tidy(body?.instructions).slice(0,2000),tier:["remedial","reinforcement","enrichment"].includes(tidy(body?.tier))?tidy(body?.tier):"remedial",question_count:questionIds.length,question_ids:questionIds,source_percent:Number(tested.percent),source_attempt_id:tested.source_attempt_id,source_submitted_at:tested.source_submitted_at,status:"assigned",assigned_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const {data,error}=await db.from("lugati_teacher_tasks").insert(payload).select("*").single();if(error)throw error;
  return json(req,{ok:true,task:data},201);
}
async function myTeacherTasks(req:Request,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  if(access.is_demo){
    const {data,error}=await db.from("lugati_teacher_tasks")
      .select("id,teacher_access_id,subject_key,outcome_code,indicator_index,indicator_text,title,instructions,tier,question_count,status,score,total,percent,source_percent,assigned_at,started_at,completed_at,updated_at")
      .neq("status","revoked").order("assigned_at",{ascending:false}).limit(1500);
    if(error)throw error;
    const seen=new Set<string>(),tasks:any[]=[];
    for(const t of data||[]){
      const key=[t.teacher_access_id,t.subject_key,t.outcome_code,t.indicator_index,t.tier,t.title,t.assigned_at].map((x:any)=>String(x??"")).join("|");
      if(seen.has(key))continue;seen.add(key);
      tasks.push({...t,student_id:access.student_id,status:"assigned",score:null,total:null,percent:null,started_at:null,completed_at:null,preview_mode:true});
      if(tasks.length>=100)break;
    }
    return json(req,{ok:true,demo_preview:true,tasks:[],message:"الحساب التجريبي لا يملك نتيجة اختبار معلّمي حقيقية للتصنيف."});
  }
  const {data,error}=await db.from("lugati_teacher_tasks").select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,instructions,tier,question_count,status,score,total,percent,source_percent,assigned_at,started_at,completed_at,updated_at").eq("student_id",access.student_id!).neq("status","revoked").order("assigned_at",{ascending:false}).limit(100);if(error)throw error;
  const perfs=await latestPerformances([access.student_id!]);
  return json(req,{ok:true,tasks:(data||[]).filter((t:any)=>taskHasVerifiedMoallimiAttempt(t,perfs))});
}
async function teacherTasks(req:Request,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const {data,error}=await db.from("lugati_teacher_tasks").select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,instructions,tier,question_count,status,score,total,percent,assigned_at,started_at,completed_at,updated_at").eq("teacher_access_id",access.teacher_access_id!).order("assigned_at",{ascending:false}).limit(1000);if(error)throw error;
  const ids=[...new Set((data||[]).map((x:any)=>String(x.student_id)))];const perfs=ids.length?await latestPerformances(ids):[];const eligible=(data||[]).filter((t:any)=>taskHasVerifiedMoallimiAttempt(t,perfs));const sm=new Map<string,any>();if(ids.length){const {data:ss,error:se}=await db.from("nafes_students").select("id,full_name,class_name,grade").in("id",ids);if(se)throw se;for(const s of ss||[])sm.set(String(s.id),s)}
  return json(req,{ok:true,tasks:eligible.map((x:any)=>({...x,student:sm.get(String(x.student_id))||null}))});
}

async function startTeacherTask(req:Request,body:any,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  const id=tidy(body?.task_id);if(!id)return json(req,{error:"التدريب غير محدد."},400);
  let q=db.from("lugati_teacher_tasks").select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,instructions,tier,question_count,status,question_ids,score,total,percent").eq("id",id).neq("status","revoked");
  if(!access.is_demo)q=q.eq("student_id",access.student_id!);
  const {data:t,error:te}=await q.maybeSingle();if(te)throw te;if(!t)return json(req,{error:"تم سحب هذا التدريب من المعلم أو أنه غير متاح."},410);
  if(!access.is_demo&&!taskHasVerifiedMoallimiAttempt(t,await latestPerformances([access.student_id!])))return json(req,{error:"لا توجد نتيجة اختبار مسلّمة في معلّمي تتيح هذا التدريب."},403);
  let ids=Array.isArray(t.question_ids)?t.question_ids.map(String):[];
  if(!ids.length){
    ids=await pickTaskQuestionIds(t.subject_key,t.outcome_code,Number(t.indicator_index),Number(t.question_count||8));
    if(!access.is_demo){const {error:qe}=await db.from("lugati_teacher_tasks").update({question_ids:ids,question_count:ids.length,updated_at:new Date().toISOString()}).eq("id",id);if(qe)throw qe}
  }
  if(access.is_demo)return json(req,{ok:true,demo_preview:true,task:{...t,student_id:access.student_id,status:"assigned",score:null,total:null,percent:null,preview_mode:true},questions:await taskQuestions(ids)});
  const now=new Date().toISOString();if(t.status!=="completed"){const {error}=await db.from("lugati_teacher_tasks").update({status:"in_progress",started_at:t.status==="assigned"?now:undefined,updated_at:now}).eq("id",id).eq("student_id",access.student_id!);if(error)throw error}
  return json(req,{ok:true,task:{...t,status:t.status==="completed"?"completed":"in_progress"},questions:await taskQuestions(ids)});
}
async function submitTeacherTask(req:Request,body:any,access:Access){
  if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);
  const id=tidy(body?.task_id),answers=body?.answers&&typeof body.answers==="object"?body.answers:null;if(!id||!answers)return json(req,{error:"إجابات التدريب غير مكتملة."},400);
  let q=db.from("lugati_teacher_tasks").select("id,student_id,subject_key,outcome_code,indicator_index,question_ids,status").eq("id",id).neq("status","revoked");
  if(!access.is_demo)q=q.eq("student_id",access.student_id!);
  const {data:t,error:te}=await q.maybeSingle();if(te)throw te;if(!t)return json(req,{error:"تم سحب هذا التدريب من المعلم أو أنه غير متاح."},410);
  if(!access.is_demo&&!taskHasVerifiedMoallimiAttempt(t,await latestPerformances([access.student_id!])))return json(req,{error:"لا توجد نتيجة اختبار مسلّمة في معلّمي تتيح تسليم هذا التدريب."},403);
  const ids=Array.isArray(t.question_ids)?t.question_ids.map(String):[];if(!ids.length)return json(req,{error:"لا توجد أسئلة محفوظة لهذا التدريب."},409);
  const {data:qs,error:qe}=await db.from("nafes_question_bank").select("id,correct_index").in("id",ids);if(qe)throw qe;const cm=new Map((qs||[]).map((q:any)=>[String(q.id),Number(q.correct_index)]));let score=0;for(const qid of ids){if(Number(answers[qid])===cm.get(qid))score++}
  const total=ids.length,percent=total?Math.round(score*1000/total)/10:0;
  if(access.is_demo)return json(req,{ok:true,demo_preview:true,task:{id,status:"completed",score,total,percent,preview_mode:true},score,total,percent});
  const response={answers};const {data,error}=await db.from("lugati_teacher_tasks").update({status:"completed",score,total,percent,response,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("student_id",access.student_id!).select("id,status,score,total,percent,completed_at").maybeSingle();if(error)throw error;if(!data)return json(req,{error:"التدريب غير متاح."},404);
  return json(req,{ok:true,task:data,score,total,percent});
}


async function teacherRevokeCatalog(req:Request,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const scope=teacherScope(access),items:any[]=[];

  let tq=db.from("lugati_teacher_tasks")
    .select("id,teacher_access_id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,tier,status,assigned_at")
    .in("status",["assigned","in_progress"]).order("assigned_at",{ascending:false}).limit(4000);
  if(scope!=="all")tq=tq.eq("teacher_access_id",access.teacher_access_id!).eq("subject_key",scope);
  const {data:tasks,error:te}=await tq;if(te)throw te;
  const studentIds=[...new Set((tasks||[]).map((x:any)=>String(x.student_id)).filter(Boolean))];
  const sm=new Map<string,any>();
  if(studentIds.length){
    const {data:ss,error:se}=await db.from("nafes_students").select("id,full_name,class_name").in("id",studentIds);
    if(se)throw se;for(const s of ss||[])sm.set(String(s.id),s);
  }
  const groups=new Map<string,any>();
  for(const t of tasks||[]){
    const key=[t.teacher_access_id,t.subject_key,t.outcome_code,t.indicator_index,t.tier,t.title,t.assigned_at].map((x:any)=>String(x??"")).join("|");
    if(!groups.has(key))groups.set(key,{kind:"task_batch",selection_id:"task:"+key,task_ids:[],subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:Number(t.indicator_index||0),indicator_text:t.indicator_text||"",title:t.title||"تدريب مرسل",tier:t.tier||"remedial",status:t.status||"assigned",sent_at:t.assigned_at,students:[]});
    const g=groups.get(key);g.task_ids.push(String(t.id));const s=sm.get(String(t.student_id));if(s)g.students.push({id:s.id,full_name:s.full_name,class_name:s.class_name});
  }
  for(const g of groups.values()){
    const names=[...new Map((g.students||[]).map((s:any)=>[String(s.id),s])).values()];
    g.student_count=names.length;
    g.student_names=names.slice(0,4).map((s:any)=>s.full_name);
    delete g.students;items.push(g);
  }

  let dq=db.from("lugati_pretest_dispatches").select("id,template_id,teacher_access_id,target_scope,target_class,sent_at").is("revoked_at",null).order("sent_at",{ascending:false}).limit(1200);
  if(scope!=="all")dq=dq.eq("teacher_access_id",access.teacher_access_id!);
  const {data:dispatches,error:de}=await dq;if(de)throw de;
  const tids=[...new Set((dispatches||[]).map((x:any)=>String(x.template_id)).filter(Boolean))];
  const tm=new Map<string,any>();
  if(tids.length){
    let qq=db.from("lugati_pretest_templates").select("id,subject_key,outcome_code,indicator_index,display_index,indicator_text,title").in("id",tids);
    if(scope!=="all")qq=qq.eq("subject_key",scope);
    const {data:ts,error:xe}=await qq;if(xe)throw xe;for(const t of ts||[])tm.set(String(t.id),t);
  }
  const eligibleDispatches=(dispatches||[]).filter((d:any)=>tm.has(String(d.template_id)));
  const dids=eligibleDispatches.map((d:any)=>String(d.id));
  const dc=new Map<string,number>();
  if(dids.length){
    const {data:aa,error:ae}=await db.from("lugati_pretest_student_assignments").select("dispatch_id").in("dispatch_id",dids);
    if(ae)throw ae;for(const a of aa||[])dc.set(String(a.dispatch_id),(dc.get(String(a.dispatch_id))||0)+1);
  }
  for(const d of eligibleDispatches){
    const t=tm.get(String(d.template_id));
    items.push({kind:"pretest_dispatch",selection_id:"pretest:"+d.id,id:String(d.id),subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:Number(t.display_index||t.indicator_index||0),indicator_text:t.indicator_text||"",title:t.student_title||t.title||"رحلة المؤشر",tier:"journey",status:"sent",sent_at:d.sent_at,target_class:d.target_class||"",student_count:dc.get(String(d.id))||0});
  }

  let cq=db.from("lugati_competition_rounds").select("id,title,subject_key,arena_key,status,open_at,close_at,created_at,created_by").eq("status","open").order("created_at",{ascending:false}).limit(300);
  if(scope!=="all")cq=cq.eq("created_by",access.teacher_access_id!).eq("subject_key",scope);
  const {data:rounds,error:ce}=await cq;if(ce)throw ce;
  for(const r of rounds||[])items.push({kind:"competition",selection_id:"competition:"+r.id,id:String(r.id),subject_key:r.subject_key,title:r.title||"مسابقة المؤشرات",tier:"competition",status:r.status,sent_at:r.open_at||r.created_at,arena_key:r.arena_key||""});

  items.sort((a:any,b:any)=>String(b.sent_at||"").localeCompare(String(a.sent_at||"")));
  return json(req,{ok:true,items,total:items.length});
}

async function teacherRevokeSelected(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const raw=Array.isArray(body?.items)?body.items.slice(0,200):[];
  if(!raw.length)return json(req,{error:"حدد إرسالًا واحدًا على الأقل لسحبه."},400);
  const scope=teacherScope(access),now=new Date().toISOString();
  const taskIds=[...new Set(raw.filter((x:any)=>x?.kind==="task_batch").flatMap((x:any)=>Array.isArray(x.task_ids)?x.task_ids:[]).map(String).filter(Boolean))].slice(0,6000);
  const dispatchIds=[...new Set(raw.filter((x:any)=>x?.kind==="pretest_dispatch").map((x:any)=>String(x.id||"")).filter(Boolean))].slice(0,1000);
  const roundIds=[...new Set(raw.filter((x:any)=>x?.kind==="competition").map((x:any)=>String(x.id||"")).filter(Boolean))].slice(0,500);

  let revokedTasks:any[]=[];
  if(taskIds.length){
    let tq=db.from("lugati_teacher_tasks").update({status:"revoked",revoked_at:now,updated_at:now}).in("id",taskIds).in("status",["assigned","in_progress"]);
    if(scope!=="all")tq=tq.eq("teacher_access_id",access.teacher_access_id!).eq("subject_key",scope);
    const {data,error}=await tq.select("id");if(error)throw error;revokedTasks=data||[];
  }

  let eligibleDispatchIds:string[]=[];
  if(dispatchIds.length){
    let dq=db.from("lugati_pretest_dispatches").select("id,template_id,teacher_access_id").in("id",dispatchIds).is("revoked_at",null);
    if(scope!=="all")dq=dq.eq("teacher_access_id",access.teacher_access_id!);
    const {data:ds,error:de}=await dq;if(de)throw de;
    let eligible=ds||[];
    if(scope!=="all"&&eligible.length){
      const tt=[...new Set(eligible.map((x:any)=>String(x.template_id)))];
      const {data:ts,error:xe}=await db.from("lugati_pretest_templates").select("id,subject_key").in("id",tt);if(xe)throw xe;
      const allowed=new Set((ts||[]).filter((x:any)=>x.subject_key===scope).map((x:any)=>String(x.id)));
      eligible=eligible.filter((x:any)=>allowed.has(String(x.template_id)));
    }
    eligibleDispatchIds=eligible.map((x:any)=>String(x.id));
    if(eligibleDispatchIds.length){
      const {data:aa,error:ae}=await db.from("lugati_pretest_student_assignments").select("id").in("dispatch_id",eligibleDispatchIds);if(ae)throw ae;
      const aids=(aa||[]).map((x:any)=>String(x.id));
      if(aids.length){const {error:le}=await db.from("lugati_student_mastery_lock").delete().in("assignment_id",aids);if(le)throw le}
      const {error:ue}=await db.from("lugati_pretest_dispatches").update({revoked_at:now}).in("id",eligibleDispatchIds);if(ue)throw ue;
    }
  }

  let cancelledRounds:any[]=[];
  if(roundIds.length){
    let cq=db.from("lugati_competition_rounds").update({status:"cancelled",closed_at:now,updated_at:now}).in("id",roundIds).eq("status","open");
    if(scope!=="all")cq=cq.eq("created_by",access.teacher_access_id!).eq("subject_key",scope);
    const {data,error}=await cq.select("id");if(error)throw error;cancelledRounds=data||[];
  }
  const total=revokedTasks.length+eligibleDispatchIds.length+cancelledRounds.length;
  return json(req,{ok:true,revoked_tasks:revokedTasks.length,revoked_first_training:eligibleDispatchIds.length,cancelled_competitions:cancelledRounds.length,total,message:total?("تم سحب المحدد فقط ("+total+"). لم تُحذف الأعمال المكتملة أو النتائج."):"لم يتغير شيء؛ قد تكون العناصر المحددة مسحوبة أو مكتملة مسبقًا."});
}

async function teacherRevokeAll(req:Request,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const now=new Date().toISOString(),scope=teacherScope(access);
  let tq=db.from("lugati_teacher_tasks").update({status:"revoked",revoked_at:now,updated_at:now}).in("status",["assigned","in_progress"]);
  if(scope!=="all")tq=tq.eq("teacher_access_id",access.teacher_access_id!);
  const {data:tasks,error:te}=await tq.select("id");if(te)throw te;

  let dq=db.from("lugati_pretest_dispatches").select("id,template_id,teacher_access_id").is("revoked_at",null);
  if(scope!=="all")dq=dq.eq("teacher_access_id",access.teacher_access_id!);
  const {data:dispatches,error:de}=await dq;if(de)throw de;
  let eligible=(dispatches||[]);
  if(scope!=="all"&&eligible.length){
    const tids=[...new Set(eligible.map((x:any)=>String(x.template_id)))];
    const {data:ts,error:xe}=await db.from("lugati_pretest_templates").select("id,subject_key").in("id",tids);if(xe)throw xe;
    const allowed=new Set((ts||[]).filter((x:any)=>x.subject_key===scope).map((x:any)=>String(x.id)));
    eligible=eligible.filter((x:any)=>allowed.has(String(x.template_id)));
  }
  if(eligible.length){
    const ids=eligible.map((x:any)=>x.id);
    const {data:aa,error:ae}=await db.from("lugati_pretest_student_assignments").select("id").in("dispatch_id",ids);if(ae)throw ae;
    const aids=(aa||[]).map((x:any)=>x.id);
    if(aids.length){const {error:le}=await db.from("lugati_student_mastery_lock").delete().in("assignment_id",aids);if(le)throw le}
    const {error:ue}=await db.from("lugati_pretest_dispatches").update({revoked_at:now}).in("id",ids);if(ue)throw ue;
  }
  let cq=db.from("lugati_competition_rounds").update({status:"cancelled",closed_at:now,updated_at:now}).eq("status","open");
  if(scope!=="all")cq=cq.eq("created_by",access.teacher_access_id!).eq("subject_key",scope);
  const {data:rounds,error:ce}=await cq.select("id");if(ce)throw ce;
  return json(req,{ok:true,revoked_tasks:(tasks||[]).length,revoked_first_training:eligible.length,cancelled_competitions:(rounds||[]).length,
    message:scope==="all"?"تم سحب جميع الإرسالات النشطة والمسابقات المفتوحة من الطلاب مع إبقاء الأعمال والنتائج المكتملة محفوظة.":"تم سحب جميع إرسالاتك النشطة ومسابقاتك المفتوحة من الطلاب مع إبقاء الأعمال والنتائج المكتملة محفوظة."});
}

async function teacherPrintCatalog(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const scope=teacherScope(access),kind=tidy(body?.kind);
  const page=Math.max(1,Math.trunc(Number(body?.page||1)||1));
  const pageSize=Math.max(20,Math.min(100,Math.trunc(Number(body?.page_size||50)||50)));
  const from=(page-1)*pageSize,to=from+pageSize-1;

  if(kind==="remedial"){
    let tq=db.from("lugati_teacher_tasks")
      .select("id,teacher_access_id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,tier,status,question_count,question_ids,score,total,percent",{count:"exact"})
      .eq("tier","remedial")
      .order("assigned_at",{ascending:false})
      .range(from,to);
    if(scope!=="all")tq=tq.eq("teacher_access_id",access.teacher_access_id!).eq("subject_key",scope);
    const {data:tasks,error:te,count}=await tq;if(te)throw te;
    const studentIds=[...new Set((tasks||[]).map((x:any)=>String(x.student_id)).filter(Boolean))];
    const students=new Map<string,any>();
    if(studentIds.length){
      const {data:ss,error:se}=await db.from("nafes_students").select("id,full_name,class_name,grade").in("id",studentIds);
      if(se)throw se;for(const s of ss||[])students.set(String(s.id),s);
    }
    const remedial=(tasks||[]).map((t:any)=>{
      const s=students.get(String(t.student_id)),qids=Array.isArray(t.question_ids)?t.question_ids.map(String):[];
      return{kind:"remedial",id:t.id,subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:t.indicator_index,indicator_text:t.indicator_text,title:"ورقة المعالجة",question_count:qids.length||t.question_count||0,student_id:t.student_id,student_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||"",status:t.status||"",score:t.score,total:t.total,percent:t.percent};
    });
    return json(req,{ok:true,remedial,first_training:[],page,page_size:pageSize,total:Number(count||0),has_more:from+remedial.length<Number(count||0)});
  }

  if(kind==="first_training"){
    let dq=db.from("lugati_pretest_dispatches").select("id,template_id,teacher_access_id").order("sent_at",{ascending:false}).limit(1500);
    if(scope!=="all")dq=dq.eq("teacher_access_id",access.teacher_access_id!);
    const {data:ds,error:de}=await dq;if(de)throw de;
    const tids=[...new Set((ds||[]).map((x:any)=>String(x.template_id)))];let templates:any[]=[];
    if(tids.length){
      let qq=db.from("lugati_pretest_templates").select("id,subject_key,outcome_code,indicator_index,display_index,indicator_text").in("id",tids);
      if(scope!=="all")qq=qq.eq("subject_key",scope);
      const z=await qq;if(z.error)throw z.error;templates=z.data||[];
    }
    const tm=new Map(templates.map((x:any)=>[String(x.id),x])),dispatchMap=new Map((ds||[]).map((x:any)=>[String(x.id),x]));
    const eligible=(ds||[]).filter((x:any)=>tm.has(String(x.template_id))).map((x:any)=>String(x.id));
    if(!eligible.length)return json(req,{ok:true,remedial:[],first_training:[],page,page_size:pageSize,total:0,has_more:false});
    const aq=await db.from("lugati_pretest_student_assignments")
      .select("id,dispatch_id,student_id,status,score,total,percent",{count:"exact"})
      .in("dispatch_id",eligible).order("assigned_at",{ascending:false}).range(from,to);
    if(aq.error)throw aq.error;
    const assignments=aq.data||[],studentIds=[...new Set(assignments.map((x:any)=>String(x.student_id)).filter(Boolean))];
    const students=new Map<string,any>();
    if(studentIds.length){
      const {data:ss,error:se}=await db.from("nafes_students").select("id,full_name,class_name,grade").in("id",studentIds);
      if(se)throw se;for(const s of ss||[])students.set(String(s.id),s);
    }
    const first_training=assignments.map((a:any)=>{
      const d=dispatchMap.get(String(a.dispatch_id)),t=d?tm.get(String(d.template_id)):null,s=students.get(String(a.student_id));if(!t)return null;
      return{kind:"first_training",id:a.id,dispatch_id:a.dispatch_id,subject_key:t.subject_key,outcome_code:t.outcome_code,indicator_index:t.indicator_index,global_indicator:Number(t.display_index||t.indicator_index),indicator_text:t.indicator_text,title:"ورقة التدريب الأول",student_id:a.student_id,student_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||"",status:a.status||"",score:a.score,total:a.total,percent:a.percent};
    }).filter(Boolean);
    return json(req,{ok:true,remedial:[],first_training,page,page_size:pageSize,total:Number(aq.count||0),has_more:from+first_training.length<Number(aq.count||0)});
  }

  return json(req,{error:"نوع الطباعة غير مدعوم."},400);
}
async function teacherPrintSheet(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const kind=tidy(body?.kind),id=tidy(body?.id),scope=teacherScope(access);if(!id)return json(req,{error:"الورقة غير محددة."},400);

  if(kind==="remedial"){
    let q=db.from("lugati_teacher_tasks")
      .select("id,teacher_access_id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,question_ids,status")
      .eq("id",id)
      .eq("tier","remedial");
    if(scope!=="all")q=q.eq("teacher_access_id",access.teacher_access_id!).eq("subject_key",scope);
    const {data:t,error}=await q.maybeSingle();if(error)throw error;if(!t)return json(req,{error:"ورقة المعالجة غير متاحة."},404);

    const ids=Array.isArray(t.question_ids)?t.question_ids.map(String):[];
    const questions=archiveReadingRows(await archiveQuestionRows(ids),t.subject_key);
    const {data:s,error:se}=await db.from("nafes_students").select("id,full_name,class_name,grade").eq("id",t.student_id).maybeSingle();
    if(se)throw se;
    return json(req,{
      ok:true,kind,title:"ورقة المعالجة",subject_key:t.subject_key,outcome_code:t.outcome_code,
      indicator_index:t.indicator_index,indicator_text:t.indicator_text,
      student:{id:t.student_id,full_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||""},
      questions
    });
  }

  if(kind==="first_training"){
    const {data:a,error:ae}=await db.from("lugati_pretest_student_assignments")
      .select("id,dispatch_id,student_id,status")
      .eq("id",id)
      .maybeSingle();
    if(ae)throw ae;if(!a)return json(req,{error:"ورقة التدريب الأول غير متاحة."},404);

    let q=db.from("lugati_pretest_dispatches").select("id,template_id,teacher_access_id,revoked_at").eq("id",a.dispatch_id);
    if(scope!=="all")q=q.eq("teacher_access_id",access.teacher_access_id!);
    const {data:d,error}=await q.maybeSingle();if(error)throw error;if(!d)return json(req,{error:"ورقة التدريب الأول غير متاحة."},404);

    const {data:t,error:te}=await db.from("lugati_pretest_templates")
      .select("id,subject_key,outcome_code,indicator_index,display_index,indicator_text")
      .eq("id",d.template_id)
      .maybeSingle();
    if(te)throw te;if(!t||!teacherAllows(access,t.subject_key))return json(req,{error:"هذه الورقة خارج صلاحية حسابك."},403);

    const {data:items,error:ie}=await db.from("lugati_pretest_items")
      .select("id,order_no,stimulus,prompt,activity_data,correct_answer,objective_correct_index,explanation,feedback_correct,cognitive_level")
      .eq("template_id",t.id)
      .eq("stage","guided")
      .order("order_no");
    if(ie)throw ie;

    const questions=(items||[]).map((x:any)=>{
      const ca=x.correct_answer&&typeof x.correct_answer==="object"?x.correct_answer:{};
      const ci=Number.isInteger(ca.index)?Number(ca.index):(Number.isInteger(x.objective_correct_index)?Number(x.objective_correct_index):null);
      return {
        id:x.id,
        context_text:x.stimulus||"",
        question_text:x.prompt,
        options:Array.isArray(x.activity_data?.options)?x.activity_data.options:[],
        correct_index:ci,
        explanation:x.explanation||x.feedback_correct||"",
        cognitive_level:x.cognitive_level
      };
    });
    const {data:s,error:se}=await db.from("nafes_students").select("id,full_name,class_name,grade").eq("id",a.student_id).maybeSingle();
    if(se)throw se;

    return json(req,{
      ok:true,kind,title:"ورقة التدريب الأول",subject_key:t.subject_key,outcome_code:t.outcome_code,
      indicator_index:t.indicator_index,global_indicator:Number(t.display_index||t.indicator_index),indicator_text:t.indicator_text,
      student:{id:a.student_id,full_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||""},
      questions
    });
  }

  return json(req,{error:"نوع الورقة غير مدعوم."},400);
}

function phaseArabic(p:string){return p==="guided"?"تدريب موجه":p==="independent"?"تدريب مستقل":p==="check"?"تحقق من الإتقان":p==="review"?"مراجعة تثبيت":p==="enrichment"?"إثراء":"تدريب";}
function tierArabic(t:string){return t==="starter"?"تمهيدي":t==="remedial"?"علاجي":t==="reinforcement"?"تعزيز":t==="enrichment"?"إثرائي":"تدريب";}
async function teacherTrainingArchive(req:Request,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const [sr,aa,at,dt,ms,cs,bs]=await Promise.all([
    db.from("nafes_students").select("id,full_name,class_name,grade,is_demo").eq("is_active",true).eq("is_demo",false),
    db.from("lugati_adaptive_assignments").select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,tier"),
    db.from("lugati_adaptive_training_attempts").select("id,assignment_id,student_id,score,total,percent,response,submitted_at").order("submitted_at",{ascending:false}).limit(5000),
    db.from("lugati_teacher_tasks").select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,tier,status,score,total,percent,response,completed_at").eq("teacher_access_id",access.teacher_access_id!).eq("status","completed").order("completed_at",{ascending:false}).limit(2000),
    db.from("lugati_mastery_sessions").select("id,student_id,component_id,phase,question_ids,status,score,total,percent,hints_used,completed_at").eq("status","completed").order("completed_at",{ascending:false}).limit(5000),
    db.from("lugati_mastery_components").select("id,blueprint_id,title"),
    db.from("lugati_mastery_blueprints").select("id,subject_key,outcome_code,indicator_index,indicator_text")
  ]);
  for(const x of [sr,aa,at,dt,ms,cs,bs])if((x as any).error)throw (x as any).error;
  const sm=new Map(((sr as any).data||[]).map((x:any)=>[String(x.id),x]));
  const am=new Map(((aa as any).data||[]).map((x:any)=>[String(x.id),x]));
  const cm=new Map(((cs as any).data||[]).map((x:any)=>[String(x.id),x]));
  const bm=new Map(((bs as any).data||[]).map((x:any)=>[String(x.id),x]));
  const items:any[]=[];
  for(const x of (at as any).data||[]){
    const a=am.get(String(x.assignment_id));if(!a)continue;const s=sm.get(String(x.student_id));
    items.push({source:"adaptive",attempt_id:x.id,student_id:x.student_id,student_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||"",subject_key:a.subject_key,outcome_code:a.outcome_code,indicator_index:a.indicator_index,indicator_text:a.indicator_text,title:"تدريب "+tierArabic(a.tier),training_type:a.tier,phase:null,score:x.score,total:x.total,percent:x.percent,submitted_at:x.submitted_at,has_questions:!!(x.response?.answers&&Object.keys(x.response.answers).length)});
  }
  for(const x of (dt as any).data||[]){
    const s=sm.get(String(x.student_id));
    items.push({source:"direct",attempt_id:x.id,student_id:x.student_id,student_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||"",subject_key:x.subject_key,outcome_code:x.outcome_code,indicator_index:x.indicator_index,indicator_text:x.indicator_text,title:x.title||"تدريب مباشر من المعلم",training_type:x.tier,phase:null,score:x.score,total:x.total,percent:x.percent,submitted_at:x.completed_at,has_questions:!!(x.response?.answers&&Object.keys(x.response.answers).length)});
  }
  for(const x of (ms as any).data||[]){
    const c=cm.get(String(x.component_id));const b=c?bm.get(String(c.blueprint_id)):null;if(!b)continue;const s=sm.get(String(x.student_id));
    items.push({source:"mastery",attempt_id:x.id,student_id:x.student_id,student_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||"",subject_key:b.subject_key,outcome_code:b.outcome_code,indicator_index:b.indicator_index,indicator_text:b.indicator_text,title:(c?.title?c.title+" • ":"")+phaseArabic(x.phase),training_type:x.phase==="enrichment"?"enrichment":"mastery",phase:x.phase,score:x.score,total:x.total,percent:x.percent,submitted_at:x.completed_at,has_questions:Array.isArray(x.question_ids)&&x.question_ids.length>0,hints_used:x.hints_used||0});
  }
  const scopedItems=items.filter((x:any)=>teacherAllows(access,x.subject_key));
  scopedItems.sort((a:any,b:any)=>String(b.submitted_at||"").localeCompare(String(a.submitted_at||"")));
  return json(req,{ok:true,subject_scope:teacherScope(access),totals:{attempts:scopedItems.length,students:new Set(scopedItems.map((x:any)=>String(x.student_id))).size,printable:scopedItems.filter((x:any)=>x.has_questions).length},items:scopedItems});
}
async function archiveQuestionRows(ids:string[]){
  if(!ids.length)return[];
  const {data,error}=await db.from("nafes_question_bank").select("id,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level").in("id",ids);
  if(error)throw error;const m=new Map((data||[]).map((q:any)=>[String(q.id),q]));return ids.map(id=>m.get(String(id))).filter(Boolean);
}
async function uxEvent(req:Request,body:any,access:Access){
  const allowed=new Set([
    "login_success","student_workspace_view","student_section_open",
    "student_task_start","student_task_complete","student_onboarding_complete",
    "student_journey_open","teacher_dashboard_view"
  ]);
  const eventName=tidy(body?.event_name);
  if(!allowed.has(eventName))return json(req,{error:"حدث UX غير معتمد."},400);
  if(access.is_demo)return json(req,{ok:true,stored:false,demo:true});
  const area=tidy(body?.area).slice(0,48);
  const variant=(tidy(body?.variant)||"ux_v3").slice(0,32);
  const rawElapsed=Number(body?.elapsed_ms);
  const elapsed=Number.isFinite(rawElapsed)?Math.max(0,Math.min(7200000,Math.round(rawElapsed))):null;
  const row={
    role:access.role,
    student_id:access.role==="student"?access.student_id:null,
    teacher_access_id:access.role==="teacher"?access.teacher_access_id:null,
    event_name:eventName,
    area,
    variant,
    elapsed_ms:elapsed
  };
  const {error}=await db.from("lugati_ux_events").insert(row);
  if(error)throw error;
  return json(req,{ok:true,stored:true});
}

async function teacherManagementOverview(req:Request,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const {data,error}=await db.rpc("lugati_teacher_management_snapshot",{
    p_requester:access.teacher_access_id!,
    p_scope:teacherScope(access)
  });
  if(error)throw error;
  return json(req,{ok:true,...(data||{})});
}
async function teacherManagementReport(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const rawIds=Array.isArray(body?.teacher_ids)?body.teacher_ids.map((x:any)=>tidy(x)).filter(Boolean).slice(0,250):[];
  const status=["all","assigned","in_progress","completed"].includes(tidy(body?.status))?tidy(body.status):"all";
  const subject=["all","reading","math","science"].includes(tidy(body?.subject))?tidy(body.subject):"all";
  const from=tidy(body?.from)||null,to=tidy(body?.to)||null,studentId=tidy(body?.student_id)||null;
  const limit=Math.max(1,Math.min(1000,Number(body?.limit||500)));
  const {data,error}=await db.rpc("lugati_teacher_management_report",{
    p_requester:access.teacher_access_id!,
    p_scope:teacherScope(access),
    p_teacher_ids:rawIds.length?rawIds:null,
    p_status:status,
    p_subject:subject,
    p_from:from,
    p_to:to,
    p_student_id:studentId,
    p_limit:limit
  });
  if(error)throw error;
  return json(req,{ok:true,...(data||{})});
}

async function teacherTrainingArchiveDetail(req:Request,body:any,access:Access){
  if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);
  const source=tidy(body?.source),id=tidy(body?.attempt_id);if(!["adaptive","direct","mastery"].includes(source)||!id)return json(req,{error:"التدريب غير محدد."},400);
  if(source==="adaptive"){
    const {data:x,error}=await db.from("lugati_adaptive_training_attempts").select("id,assignment_id,student_id,score,total,percent,response,submitted_at").eq("id",id).maybeSingle();if(error)throw error;if(!x)return json(req,{error:"محاولة التدريب غير موجودة."},404);
    const [{data:a,error:ae},{data:s,error:se}]=await Promise.all([db.from("lugati_adaptive_assignments").select("subject_key,outcome_code,indicator_index,indicator_text,tier").eq("id",x.assignment_id).maybeSingle(),db.from("nafes_students").select("full_name,class_name,grade").eq("id",x.student_id).maybeSingle()]);if(ae)throw ae;if(se)throw se;if(!a)return json(req,{error:"بيانات التدريب غير مكتملة."},404);if(!teacherAllows(access,a.subject_key))return json(req,{error:"هذه المحاولة خارج مادة حسابك."},403);
    const answers=(x.response?.answers&&typeof x.response.answers==="object")?x.response.answers:{},ids=Object.keys(answers),qs=archiveReadingRows(await archiveQuestionRows(ids),a.subject_key);
    return json(req,{ok:true,attempt:{source,attempt_id:x.id,student_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||"",subject_key:a.subject_key,outcome_code:a.outcome_code,indicator_index:a.indicator_index,indicator_text:a.indicator_text,title:"تدريب "+tierArabic(a.tier),training_type:a.tier,score:x.score,total:x.total,percent:x.percent,submitted_at:x.submitted_at},questions:qs.map((q:any)=>({...q,selected_index:answers[String(q.id)]??null,correct:Number(answers[String(q.id)])===Number(q.correct_index)}))});
  }
  if(source==="direct"){
    const {data:x,error}=await db.from("lugati_teacher_tasks").select("id,student_id,subject_key,outcome_code,indicator_index,indicator_text,title,tier,score,total,percent,response,completed_at").eq("id",id).eq("teacher_access_id",access.teacher_access_id!).eq("status","completed").maybeSingle();if(error)throw error;if(!x)return json(req,{error:"التدريب المباشر غير موجود."},404);if(!teacherAllows(access,x.subject_key))return json(req,{error:"هذه المحاولة خارج مادة حسابك."},403);
    const {data:s,error:se}=await db.from("nafes_students").select("full_name,class_name,grade").eq("id",x.student_id).maybeSingle();if(se)throw se;
    const answers=(x.response?.answers&&typeof x.response.answers==="object")?x.response.answers:{},ids=Object.keys(answers),qs=archiveReadingRows(await archiveQuestionRows(ids),x.subject_key);
    return json(req,{ok:true,attempt:{source,attempt_id:x.id,student_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||"",subject_key:x.subject_key,outcome_code:x.outcome_code,indicator_index:x.indicator_index,indicator_text:x.indicator_text,title:x.title||"تدريب مباشر من المعلم",training_type:x.tier,score:x.score,total:x.total,percent:x.percent,submitted_at:x.completed_at},questions:qs.map((q:any)=>({...q,selected_index:answers[String(q.id)]??null,correct:Number(answers[String(q.id)])===Number(q.correct_index)}))});
  }
  const {data:x,error}=await db.from("lugati_mastery_sessions").select("id,student_id,component_id,phase,question_ids,score,total,percent,hints_used,completed_at").eq("id",id).eq("status","completed").maybeSingle();if(error)throw error;if(!x)return json(req,{error:"جلسة الإتقان غير موجودة."},404);
  const [{data:c,error:ce},{data:s,error:se},{data:ev,error:ee}]=await Promise.all([db.from("lugati_mastery_components").select("id,blueprint_id,title").eq("id",x.component_id).maybeSingle(),db.from("nafes_students").select("full_name,class_name,grade").eq("id",x.student_id).maybeSingle(),db.from("lugati_mastery_question_events").select("question_id,selected_index,correct,hints_used,elapsed_seconds").eq("session_id",x.id)]);if(ce)throw ce;if(se)throw se;if(ee)throw ee;if(!c)return json(req,{error:"نقطة الإتقان غير موجودة."},404);
  const {data:b,error:be}=await db.from("lugati_mastery_blueprints").select("subject_key,outcome_code,indicator_index,indicator_text").eq("id",c.blueprint_id).maybeSingle();if(be)throw be;if(!b)return json(req,{error:"المؤشر غير موجود."},404);if(!teacherAllows(access,b.subject_key))return json(req,{error:"هذه المحاولة خارج مادة حسابك."},403);
  const ids=(Array.isArray(x.question_ids)?x.question_ids:[]).map(String),qs=archiveReadingRows(await archiveQuestionRows(ids),b.subject_key),em=new Map((ev||[]).map((e:any)=>[String(e.question_id),e]));
  return json(req,{ok:true,attempt:{source,attempt_id:x.id,student_name:s?.full_name||"طالب",class_name:s?.class_name||"",grade:s?.grade||"",subject_key:b.subject_key,outcome_code:b.outcome_code,indicator_index:b.indicator_index,indicator_text:b.indicator_text,title:(c.title?c.title+" • ":"")+phaseArabic(x.phase),training_type:x.phase==="enrichment"?"enrichment":"mastery",phase:x.phase,score:x.score,total:x.total,percent:x.percent,submitted_at:x.completed_at,hints_used:x.hints_used||0},questions:qs.map((q:any)=>{const e=em.get(String(q.id));return{...q,selected_index:e?.selected_index??null,correct:e?.correct??null,hints_used:e?.hints_used??0,elapsed_seconds:e?.elapsed_seconds??null}})});
}

Deno.serve(async(req:Request)=>{if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);try{const access=await requireAccess(req),body=await req.json().catch(()=>({})),action=tidy(body?.action||"my_plan");if(action==="my_plan"){if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);return await myPlan(req,access)}if(action==="teacher_overview"){if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);return await teacherOverview(req,access)}if(action==="student_unified_plan")return await studentUnifiedPlan(req,access);if(action==="teacher_unified_overview")return await teacherUnifiedOverview(req,access);if(action==="teacher_unified_sources")return await teacherUnifiedSources(req,body,access);if(action==="teacher_unified_plan")return await teacherUnifiedPlan(req,body,access);if(action==="sync_all"){if(access.role!=="teacher")return json(req,{error:"متاح للمعلم فقط."},403);return json(req,{ok:true,...await syncStudents(undefined,teacherScope(access))})}if(action==="start_training"){if(access.role!=="student")return json(req,{error:"متاح للطالب فقط."},403);return await startTraining(req,body,access)}if(action==="submit_training")return await submitTraining(req,body,access);if(action==="teacher_send_task")return await teacherSendTask(req,body,access);if(action==="teacher_send_indicator")return await teacherSendIndicator(req,body,access);if(action==="teacher_revoke_catalog")return await teacherRevokeCatalog(req,access);if(action==="teacher_revoke_selected")return await teacherRevokeSelected(req,body,access);if(action==="teacher_revoke_all")return await teacherRevokeAll(req,access);if(action==="teacher_print_catalog")return await teacherPrintCatalog(req,body,access);if(action==="teacher_print_sheet")return await teacherPrintSheet(req,body,access);if(action==="my_teacher_tasks")return await myTeacherTasks(req,access);if(action==="teacher_tasks")return await teacherTasks(req,access);if(action==="teacher_response_tracking")return await teacherResponseTracking(req,access);if(action==="teacher_training_archive")return await teacherTrainingArchive(req,access);if(action==="teacher_training_archive_detail")return await teacherTrainingArchiveDetail(req,body,access);if(action==="teacher_management_overview")return await teacherManagementOverview(req,access);if(action==="teacher_management_report")return await teacherManagementReport(req,body,access);if(action==="ux_event")return await uxEvent(req,body,access);if(action==="start_teacher_task")return await startTeacherTask(req,body,access);if(action==="submit_teacher_task")return await submitTeacherTask(req,body,access);return json(req,{error:"action_not_supported"},400)}catch(error){console.error("lugati-adaptive-plan",error);const status=error&&typeof error==="object"&&"status" in error?Number((error as any).status):500;return json(req,{error:status===500?"تعذر مزامنة الخطة التكيفية الآن.":String((error as Error).message)},status)}});