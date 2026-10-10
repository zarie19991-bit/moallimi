import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";

const db=createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const origins=new Set(["https://zarie19991-bit.github.io","http://localhost:8000","http://127.0.0.1:8000","http://localhost:5500","http://127.0.0.1:5500"]);
const subjects:any={reading:"القراءة",math:"الرياضيات",science:"العلوم"};
const clean=(v:any)=>String(v??"").trim();
const httpError=(message:string,status=400)=>Object.assign(new Error(message),{status});
const headers=(req:Request)=>({"Access-Control-Allow-Origin":origins.has(req.headers.get("origin")||"")?(req.headers.get("origin") as string):"https://zarie19991-bit.github.io","Access-Control-Allow-Headers":"content-type,authorization","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin"});
const reply=(req:Request,result:any,status=200)=>new Response(JSON.stringify(result),{status,headers:headers(req)});
async function sha256(input:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")}
async function teacher(req:Request){
 const value=clean(req.headers.get("authorization"));const token=value.toLowerCase().startsWith("bearer ")?value.slice(7).trim():"";
 if(!token)throw httpError("سجّل الدخول بحساب المعلم أولًا.",401);
 const {data:s,error:se}=await db.from("lugati_sessions").select("role,teacher_access_id,expires_at").eq("token_hash",await sha256(token)).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(se)throw se;if(!s||s.role!=="teacher")throw httpError("جلسة المعلم غير صالحة أو منتهية.",401);
 const {data:t,error:te}=await db.from("nafes_teacher_access").select("id,active,subject_scope").eq("id",s.teacher_access_id).eq("active",true).maybeSingle();
 if(te)throw te;if(!t)throw httpError("الحساب غير مخوّل بعرض التقارير.",403);
 return {id:String(t.id),scope:["reading","math","science"].includes(clean(t.subject_scope))?clean(t.subject_scope):"all"};
}
function testSubjects(a:any){
 const secs=Array.isArray(a?.config?.sections)?a.config.sections:[];
 const rendered=Array.isArray(a?.rendered_sections)?a.rendered_sections:[];
 return [...new Set([...secs,...rendered].map((s:any)=>clean(s.subject||s.subject_key)).filter(s=>Boolean(subjects[s])))];
}
function inScope(a:any,t:any){return t.scope==="all"||testSubjects(a).includes(t.scope)}
async function listTests(t:any){
 const {data,error}=await db.from("nafes_assessments").select("id,title,kind,status,config,rendered_sections,published_at,created_at").eq("status","published").order("published_at",{ascending:false,nullsFirst:false}).range(0,999);
 if(error)throw error;
 return (data||[]).filter((a:any)=>inScope(a,t)).map((a:any)=>({id:a.id,title:clean(a.title)||"اختبار نافس",kind:a.kind,subject_keys:testSubjects(a),grade:clean(a.config?.grade_key)==="middle_3"?"الثالث المتوسط":clean(a.config?.grade_key)||"—",class_name:clean(a.config?.class_name)||"جميع الفصول",date:a.published_at||a.created_at})).sort((a:any,b:any)=>clean(b.date).localeCompare(clean(a.date)));
}
async function getTest(id:string,t:any){
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))throw httpError("معرّف الاختبار غير صحيح.");
 const {data,error}=await db.from("nafes_assessments").select("id,title,kind,status,config,rendered_sections,published_at,created_at").eq("id",id).maybeSingle();
 if(error)throw error;if(!data)throw httpError("الاختبار غير موجود.",404);
 if(!inScope(data,t))throw httpError("هذا الاختبار خارج مادة حسابك.",403);
 return data;
}
function targetedClasses(label:any){
 const value=clean(label);
 if(!value||/جميع|الكل|all/i.test(value))return null;
 if(["أ","ب","ج","د"].includes(value))return new Set([value]);
 const matches=[...value.matchAll(/(?:^|[\s(،,\/\-])([أبجد])(?=$|[\s)\/،,\-])/g)].map(m=>m[1]);
 return matches.length?new Set(matches):null;
}
async function roster(a:any){
 const {data,error}=await db.from("nafes_students").select("id,full_name,class_name,grade").eq("is_active",true).eq("is_demo",false).order("class_name").order("full_name").limit(3000);
 if(error)throw error;
 const grade=clean(a.config?.grade_key),classes=targetedClasses(a.config?.class_name);
 return (data||[]).filter((s:any)=>(!grade||grade==="middle_3"?(!grade||s.grade==="الثالث المتوسط"):clean(s.grade)===grade)&&(!classes||classes.has(clean(s.class_name))));
}
function validScore(score:any,total:any){
 if(score==null||total==null||!Number.isFinite(Number(score))||!Number.isFinite(Number(total))||Number(total)<=0||Number(score)<0||Number(score)>Number(total))return null;
 return {score:Number(score),total:Number(total)};
}
function classify(m:any){
 if(!m)return "unmeasured";
 const p=m.score/m.total*100;return p<50?"remedial":p<80?"reinforcement":"enrichment";
}
function questionParts(at:any){
 const groups=new Map<string,any>();
 const answers=at.answers&&typeof at.answers==="object"?at.answers:{};
 for(const sec of (Array.isArray(at.rendered_sections)?at.rendered_sections:[])){
  for(const q of (Array.isArray(sec.questions)?sec.questions:[])){
   const subject=clean(q.subject||sec.subject),outcome=clean(q.outcome||q.outcome_code),indicator=Number(q.indicator||q.indicator_index||0);
   if(!subjects[subject]||!Number.isInteger(indicator)||indicator<=0||!q.id)continue;
   const key=["indicator",subject,outcome,indicator].join(":");
   if(!groups.has(key))groups.set(key,{key,subject_key:subject,outcome_code:outcome,indicator_index:indicator,indicator_text:clean(q.indicator_text)||"المؤشر "+indicator,score:0,total:0});
   const g=groups.get(key);g.total++;
   const has=Object.prototype.hasOwnProperty.call(answers,String(q.id));
   if(has&&answers[q.id]!==null&&answers[q.id]!==""&&q.correctIndex!=null&&Number.isInteger(Number(q.correctIndex))&&Number.isInteger(Number(answers[q.id]))&&Number(answers[q.id])===Number(q.correctIndex))g.score++;
  }
 }
 return [...groups.values()];
}
function sectionsOf(at:any){
 const sections=Array.isArray(at.section_scores)?at.section_scores:[];
 const out=new Map<string,any>();
 for(const s of sections){
  const key=clean(s.subject||s.subject_key),v=validScore(s.score,s.total);
  if(!subjects[key]||!v)continue;
  const prev=out.get(key)||{score:0,total:0};prev.score+=v.score;prev.total+=v.total;out.set(key,prev);
 }
 if(!out.size){
  for(const g of questionParts(at)){const p=out.get(g.subject_key)||{score:0,total:0};p.score+=g.score;p.total+=g.total;out.set(g.subject_key,p)}
 }
 return out;
}
function metric(at:any,scope:string){
 if(scope==="overall"){
  const v=validScore(at.score,at.total);if(v)return v;
  const sec=[...sectionsOf(at).values()].reduce((a:any,b:any)=>({score:a.score+b.score,total:a.total+b.total}),{score:0,total:0});
  return validScore(sec.score,sec.total);
 }
 if(scope.startsWith("subject:"))return sectionsOf(at).get(scope.slice(8))||null;
 if(scope.startsWith("group:")){
   const keys=[...new Set(scope.slice(6).split("|").filter(Boolean))],groups=new Map(questionParts(at).map(g=>[g.key,g]));
   if(keys.length<2||keys.some(k=>!groups.has(k)))return null;
   return keys.reduce((v:any,k:string)=>({score:v.score+groups.get(k).score,total:v.total+groups.get(k).total}),{score:0,total:0});
 }
 return questionParts(at).find(g=>g.key===scope)||null;
}
async function build(id:string,scope:string,t:any){
 const test=await getTest(id,t);
 const [students,res]=await Promise.all([roster(test),db.from("nafes_assessment_attempts").select("id,assessment_id,student_id,score,total,section_scores,rendered_sections,answers,submitted_at,is_demo").eq("assessment_id",id).not("submitted_at","is",null).order("submitted_at",{ascending:false}).limit(2500)]);
 if(res.error)throw res.error;
 const attempts=(res.data||[]).filter((a:any)=>a.is_demo!==true);
 if(attempts.length===2500)throw httpError("عدد المحاولات كبير، أوقف النظام حسابًا ناقصًا. يلزم تقسيم تحميل هذا الاختبار.",409);
 const allowedSubjects=testSubjects(test).filter(s=>t.scope==="all"||s===t.scope);
 const indicatorMap=new Map<string,any>();
 for(const at of attempts)for(const g of questionParts(at))if(allowedSubjects.includes(g.subject_key)&&!indicatorMap.has(g.key))indicatorMap.set(g.key,{key:g.key,label:(subjects[g.subject_key]||g.subject_key)+" • "+g.indicator_text,subject_key:g.subject_key,outcome_code:g.outcome_code,indicator_index:g.indicator_index});
 const scopes=[...(t.scope==="all"?[{key:"overall",label:"الاختبار كامل"}]:[]),...allowedSubjects.map(s=>({key:"subject:"+s,label:"مادة "+subjects[s]})),...[...indicatorMap.values()]];
 const requested=scope||scopes[0]?.key||"overall";
 if(requested.startsWith("group:")){
  const keys=[...new Set(requested.slice(6).split("|").filter(Boolean))];
  if(keys.length<2||keys.length>25||keys.some(k=>!indicatorMap.has(k)))throw httpError("مجموعة المؤشرات غير صالحة للاختبار.",400);
  scopes.push({key:requested,label:"مجموعة من "+keys.length+" مؤشرات"});
 }else if(!scopes.some(s=>s.key===requested))throw httpError("النطاق المحدد غير متاح لهذا الاختبار.",400);
 const studentsMap=new Map(students.map((s:any)=>[String(s.id),s]));
 const latest=new Map<string,any>();
 for(const at of attempts){const sid=clean(at.student_id);if(studentsMap.has(sid)&&!latest.has(sid)&&metric(at,requested))latest.set(sid,at)}
 const rows=students.map((s:any)=>{
  const at=latest.get(String(s.id)),m=at?metric(at,requested):null,v=m?validScore(m.score,m.total):null,classification=classify(v);
  return {student_id:s.id,student_name:s.full_name,class_name:s.class_name,grade:s.grade,score:v?.score??null,total:v?.total??null,percent:v?Math.round(v.score/v.total*10000)/100:null,classification,tested:!!v,attempt_id:at?.id||null,submitted_at:at?.submitted_at||null};
 });
 const counts={tested:rows.filter((r:any)=>r.tested).length,unmeasured:rows.filter((r:any)=>!r.tested).length,remedial:rows.filter((r:any)=>r.classification==="remedial").length,reinforcement:rows.filter((r:any)=>r.classification==="reinforcement").length,enrichment:rows.filter((r:any)=>r.classification==="enrichment").length};
 const percentages:any={};for(const k of ["remedial","reinforcement","enrichment"])percentages[k]=counts.tested?Math.round(counts[k]/counts.tested*10000)/100:0;
 return {test:{id:test.id,title:clean(test.title)||"اختبار نافس",kind:test.kind,grade:clean(test.config?.grade_key)==="middle_3"?"الثالث المتوسط":clean(test.config?.grade_key)||"—",class_name:clean(test.config?.class_name)||"جميع الفصول",date:test.published_at||test.created_at,subject_keys:allowedSubjects},scope:requested,scopes,indicators:[...indicatorMap.values()],counts,percentages,rows,_attempts:latest};
}
async function questionsFor(subject:string,outcome:string,indicator:number,cache:Map<string,string[]>){
 const key=[subject,outcome,indicator].join(":");if(cache.has(key))return cache.get(key)!;
 const {data,error}=await db.from("nafes_question_bank").select("id,options,correct_index,cognitive_level,question_text,context_text").eq("subject_key",subject).eq("outcome_code",outcome).eq("indicator_index",indicator).eq("is_active",true).eq("review_status","approved").eq("alignment_verified",true).limit(200);
 if(error)throw error;
 const candidates=(data||[]).filter((q:any)=>Array.isArray(q.options)&&q.options.length===4&&new Set(q.options.map((x:any)=>clean(x))).size===4&&Number.isInteger(Number(q.correct_index))&&!/في الشكل|من الشكل|كما في الشكل|الشكل الآتي|الرسم الآتي|المخطط الآتي|الجدول الآتي|أي صيغة سؤال تقيس|ما الذي يجب أن تتقنه/.test(clean(q.question_text)+" "+clean(q.context_text)));
 let excluded=new Set<string>();if(candidates.length){const {data:e,error:ee}=await db.from("lugati_remedial_question_exclusions").select("question_id").in("question_id",candidates.map((x:any)=>x.id));if(ee)throw ee;excluded=new Set((e||[]).map((x:any)=>String(x.question_id)))}
 const good=candidates.filter((q:any)=>!excluded.has(String(q.id)));
 const selected:any[]=[];for(const k of ["knowledge","application","reasoning"]){const found=good.find((q:any)=>q.cognitive_level===k&&!selected.includes(q));if(found)selected.push(found)}
 for(const q of good)if(selected.length<8&&!selected.includes(q))selected.push(q);
 const ids=selected.slice(0,8).map((q:any)=>String(q.id));
 cache.set(key,ids);return ids;
}
async function assign(testId:string,scope:string,tier:string,t:any){
 if(!["remedial","reinforcement","enrichment"].includes(tier))throw httpError("اختر فئة أداء صحيحة.");
 const view=await build(testId,scope,t);
 const chosen=view.rows.filter((r:any)=>r.tested&&r.classification===tier);
 if(!chosen.length)return {sent:0,skipped:0,unavailable:0,message:"لا يوجد طلاب مقاسون في هذه الفئة."};
 const attempts=view._attempts;
 const candidate:any[]=[];
 for(const r of chosen){
  const at=attempts.get(String(r.student_id));if(!at)continue;
  let indicators=questionParts(at).filter((g:any)=>view.test.subject_keys.includes(g.subject_key)&&g.total>0);
  if(view.scope.startsWith("subject:"))indicators=indicators.filter((g:any)=>g.subject_key===view.scope.slice(8));
  if(view.scope.startsWith("indicator:"))indicators=indicators.filter((g:any)=>g.key===view.scope);
  if(view.scope.startsWith("group:")){const chosenKeys=new Set(view.scope.slice(6).split("|"));indicators=indicators.filter((g:any)=>chosenKeys.has(g.key))}
  const matching=indicators.filter((g:any)=>classify(g)===tier);
  if(!matching.length&&indicators.length)matching.push(...indicators);
  matching.sort((a:any,b:any)=>tier==="enrichment"?b.score/b.total-a.score/a.total:a.score/a.total-b.score/b.total);
  const p=matching[0];if(!p)continue;
  candidate.push({r,p});
 }
 const questions=new Map<string,string[]>(),inserts:any[]=[];let unavailable=chosen.length-candidate.length;
 const now=new Date().toISOString();
 const ids=chosen.map((r:any)=>r.student_id),existingIds=new Set<string>();
 for(let i=0;i<ids.length;i+=150){
  const {data:old,error}=await db.from("lugati_teacher_tasks").select("student_id,source_attempt_id,subject_key,outcome_code,indicator_index,tier,status").eq("teacher_access_id",t.id).in("student_id",ids.slice(i,i+150)).in("status",["assigned","in_progress","completed"]).limit(2000);
  if(error)throw error;for(const x of old||[])existingIds.add([x.student_id,x.source_attempt_id,x.subject_key,x.outcome_code,x.indicator_index,x.tier].join("|"));
 }
 let duplicate=0;
 for(const {r,p} of candidate){
  const dedup=[r.student_id,r.attempt_id,p.subject_key,p.outcome_code,p.indicator_index,tier].join("|");
  if(existingIds.has(dedup)){duplicate++;continue}
  const qids=await questionsFor(p.subject_key,p.outcome_code,p.indicator_index,questions);
  if(qids.length<5){unavailable++;continue}
  inserts.push({teacher_access_id:t.id,student_id:r.student_id,subject_key:p.subject_key,outcome_code:p.outcome_code,indicator_index:p.indicator_index,indicator_text:p.indicator_text,title:(tier==="remedial"?"خطة علاجية":tier==="reinforcement"?"خطة تعزيزية":"خطة إثرائية")+" • "+view.test.title.slice(0,110),instructions:"خطة مبنية على نتيجة الطالب المسلّمة في اختبار محدد، مع تدريب وقياس تحقق لاحق.",tier,question_count:qids.length,question_ids:qids,source_percent:Math.round(p.score/p.total*10000)/100,source_attempt_id:r.attempt_id,source_submitted_at:r.submitted_at,status:"assigned",assigned_at:now,updated_at:now});
 }
 let sent=0;for(let i=0;i<inserts.length;i+=100){const {data,error}=await db.from("lugati_teacher_tasks").insert(inserts.slice(i,i+100)).select("id");if(error)throw error;sent+=(data||[]).length}
 return {sent,skipped:duplicate,unavailable,total_targets:chosen.length,message:sent?"تم إسناد الخطط إلى "+sent+" طالبًا من نتيجة الاختبار المحدد.":"لم تُنشأ خطط جديدة. راجع توافر الأسئلة أو الإسنادات السابقة."};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=="POST")return reply(req,{error:"الطريقة غير مدعومة."},405);
 try{
  const access=await teacher(req),body=await req.json().catch(()=>({})),action=clean(body.action||"list");
  if(action==="list")return reply(req,{ok:true,tests:await listTests(access)});
  if(action==="detail"){const d=await build(clean(body.test_id),clean(body.scope),access);delete d._attempts;return reply(req,{ok:true,...d})}
  if(action==="assign")return reply(req,{ok:true,...await assign(clean(body.test_id),clean(body.scope),clean(body.tier),access)});
  return reply(req,{error:"إجراء غير مدعوم."},400);
 }catch(e:any){console.error("tamakkun-exam-classifications",e);return reply(req,{error:(e?.status&&e.status<500)?clean(e.message):"تعذر معالجة نتائج هذا الاختبار. حاول مرة أخرى.",details:e?.status&&e.status<500?undefined:"server_error"},e?.status||500)}
});
