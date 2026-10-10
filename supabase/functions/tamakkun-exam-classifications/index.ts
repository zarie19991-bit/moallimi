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
 const [students,res,pending]=await Promise.all([
  roster(test),
  db.from("nafes_assessment_attempts").select("id,assessment_id,student_id,score,total,section_scores,rendered_sections,answers,submitted_at,is_demo").eq("assessment_id",id).not("submitted_at","is",null).order("submitted_at",{ascending:false}).limit(2500),
  db.from("nafes_assessment_attempts").select("id,student_id,started_at,is_demo").eq("assessment_id",id).is("submitted_at",null).limit(2500)
 ]);
 if(res.error)throw res.error;if(pending.error)throw pending.error;
 if((pending.data||[]).length===2500)throw httpError("هناك سجلات محاولات غير مكتملة أكثر من حد القراءة، لم يُصدر تقرير غير المختبرين حتى لا يكون ناقصًا.",409);
 const startedIds=new Set((pending.data||[]).filter((a:any)=>a.is_demo!==true).map((a:any)=>clean(a.student_id)));
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
 const latest=new Map<string,any>(),overall=new Set<string>();
 for(const at of attempts){
  const sid=clean(at.student_id);if(!studentsMap.has(sid))continue;
  if(metric(at,"overall"))overall.add(sid);
  if(!latest.has(sid)&&metric(at,requested))latest.set(sid,at);
 }
 const rows=students.map((s:any)=>{
  const at=latest.get(String(s.id)),m=at?metric(at,requested):null,v=m?validScore(m.score,m.total):null,classification=classify(v);
  const examTested=overall.has(String(s.id));
  return {student_id:s.id,student_name:s.full_name,class_name:s.class_name,grade:s.grade,score:v?.score??null,total:v?.total??null,percent:v?Math.round(v.score/v.total*10000)/100:null,classification,tested:!!v,exam_tested:examTested,attempt_state:examTested?"submitted":startedIds.has(String(s.id))?"started_unsubmitted":"not_started",attempt_id:at?.id||null,submitted_at:at?.submitted_at||null};
 });
 // Highest-priority educational interventions first; no random order.
 const priority:any={remedial:0,reinforcement:1,enrichment:2,unmeasured:3};
 rows.sort((a:any,b:any)=>priority[a.classification]-priority[b.classification]||
 (a.tested&&b.tested?Number(a.percent)-Number(b.percent):0)||
 clean(a.class_name).localeCompare(clean(b.class_name),"ar")||
 clean(a.student_name).localeCompare(clean(b.student_name),"ar"));
 const counts={tested:rows.filter((r:any)=>r.tested).length,unmeasured:rows.filter((r:any)=>!r.tested).length,remedial:rows.filter((r:any)=>r.classification==="remedial").length,reinforcement:rows.filter((r:any)=>r.classification==="reinforcement").length,enrichment:rows.filter((r:any)=>r.classification==="enrichment").length,exam_absentees:rows.filter((r:any)=>!r.exam_tested).length,started_unsubmitted:rows.filter((r:any)=>r.attempt_state==="started_unsubmitted").length};
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
 if(!["all","remedial","reinforcement","enrichment"].includes(tier))throw httpError("اختر نوع التصنيف الصحيح.");
 const view=await build(testId,scope,t);
 const chosen=view.rows.filter((r:any)=>r.tested&&r.classification!=="unmeasured"&&(tier==="all"||r.classification===tier));
 if(!chosen.length)return {sent:0,skipped:0,unavailable:0,total_targets:0,message:"لا توجد نتائج فعلية في هذا النطاق."};
 const attempts=view._attempts;
 const targetIds=chosen.map((r:any)=>r.student_id);
 const covered=new Set<string>(),existingIds=new Set<string>();
 for(let i=0;i<targetIds.length;i+=130){
  const {data:old,error}=await db.from("lugati_teacher_tasks").select("student_id,source_attempt_id,subject_key,outcome_code,indicator_index,tier,status").eq("teacher_access_id",t.id).in("student_id",targetIds.slice(i,i+130)).in("status",["assigned","in_progress","completed"]).limit(5000);
  if(error)throw error;if((old||[]).length===5000)throw httpError("هناك خطط كثيرة لم تُراجع كاملة، أوقف الإسناد لمنع التكرار.",409);
  for(const x of old||[]){
   if(!clean(x.source_attempt_id))continue;
   existingIds.add([x.student_id,x.source_attempt_id,x.subject_key,x.outcome_code,x.indicator_index,x.tier].join("|"));
   if(planScopeMatches(x,view.scope))covered.add([x.student_id,x.source_attempt_id,x.tier].join("|"));
  }
 }
 const pool=new Map<string,string[]>(),inserts:any[]=[];
 let skipped=0,unavailable=0;const failures:any[]=[];const now=new Date().toISOString();
 for(const row of chosen){
  const key=[row.student_id,row.attempt_id,row.classification].join("|");
  if(covered.has(key)){skipped++;continue}
  const at=attempts.get(String(row.student_id));
  let indicatorGroups=at?questionParts(at).filter((g:any)=>view.test.subject_keys.includes(g.subject_key)&&g.total>0):[];
  if(view.scope.startsWith("subject:"))indicatorGroups=indicatorGroups.filter((g:any)=>g.subject_key===view.scope.slice(8));
  if(view.scope.startsWith("indicator:"))indicatorGroups=indicatorGroups.filter((g:any)=>g.key===view.scope);
  if(view.scope.startsWith("group:")){const keys=new Set(view.scope.slice(6).split("|"));indicatorGroups=indicatorGroups.filter((g:any)=>keys.has(g.key))}
  const preferred=indicatorGroups.filter((g:any)=>classify(g)===row.classification);
  const fallback=indicatorGroups.filter((g:any)=>classify(g)!==row.classification);
  const order=(a:any,b:any)=>row.classification==="enrichment"?b.score/b.total-a.score/a.total:a.score/a.total-b.score/b.total;
  const ranked=[...preferred.sort(order),...fallback.sort(order)];
  let selected:any=null,ids:string[]=[];
  for(const candidate of ranked){
   const groupIds=await questionsFor(candidate.subject_key,candidate.outcome_code,candidate.indicator_index,pool);
   if(groupIds.length<5)continue;
   const exactKey=[row.student_id,row.attempt_id,candidate.subject_key,candidate.outcome_code,candidate.indicator_index,row.classification].join("|");
   if(existingIds.has(exactKey)){covered.add(key);skipped++;selected="already";break}
   selected=candidate;ids=groupIds;break;
  }
  if(selected==="already")continue;
  if(!selected){unavailable++;failures.push({student_id:row.student_id,reason:"لم تتوفر أسئلة معتمدة كافية لمؤشر الطالب"});continue}
  inserts.push({teacher_access_id:t.id,student_id:row.student_id,subject_key:selected.subject_key,outcome_code:selected.outcome_code,indicator_index:selected.indicator_index,indicator_text:selected.indicator_text,title:(row.classification==="remedial"?"خطة علاجية":row.classification==="reinforcement"?"خطة تعزيزية":"خطة إثرائية")+" • "+view.test.title.slice(0,110),instructions:"خطة مخصصة بناءً على نتيجة هذا الاختبار. أتقن مهارة المؤشر ثم أجرِ القياس البعدي لنفس المؤشر.",tier:row.classification,question_count:ids.length,question_ids:ids,source_percent:Math.round(selected.score/selected.total*10000)/100,source_attempt_id:row.attempt_id,source_submitted_at:row.submitted_at,status:"assigned",assigned_at:now,updated_at:now});
  covered.add(key);
 }
 let sent=0;
 for(let i=0;i<inserts.length;i+=80){
  const {data,error}=await db.from("lugati_teacher_tasks").insert(inserts.slice(i,i+80)).select("id");
  if(error)throw error;sent+=(data||[]).length;
 }
 return {sent,skipped,unavailable,total_targets:chosen.length,remaining:unavailable,failures,message:unavailable?
 "أُسندت "+sent+" خطة، وبقي "+unavailable+" طالبًا يحتاج إلى مراجعة أسئلة المؤشر. لا يُعرض الإسناد على أنه مكتمل.":
 "تم التحقق من تغطية جميع المختبرين في النطاق المحدد. خطط جديدة: "+sent+"، وخطط موجودة: "+skipped+"."};
}

const planScopeMatches=(p:any,scope:string)=>{
 const key=["indicator",clean(p.subject_key),clean(p.outcome_code),Number(p.indicator_index||0)].join(":");
 return scope==="overall"||scope.startsWith("subject:")&&clean(p.subject_key)===scope.slice(8)||scope.startsWith("group:")&&scope.slice(6).split("|").includes(key)||scope===key;
};
function sameIndicatorKeys(at:any,scope:string){
 return questionParts(at).filter((g:any)=>scope==="overall"||scope.startsWith("subject:")&&g.subject_key===scope.slice(8)||scope.startsWith("group:")&&scope.slice(6).split("|").includes(g.key)||scope===g.key).map((x:any)=>x.key);
}
async function addProgress(view:any,access:any){
 const tested=(view.rows||[]).filter((r:any)=>r.tested&&r.attempt_id);
 const effects:any={assigned:0,in_progress:0,completed:0,post_tested:0,improved:0,mastered_after:0,new_mastery:0,still_remedial:0,declined:0,pending_post:0};
 const byStudent=new Map<string,any[]>();
 const mapPlans=new Map<string,any[]>();
 if(tested.length){
  const aid=[...new Set(tested.map((r:any)=>String(r.attempt_id)))];
  for(let i=0;i<aid.length;i+=150){
   const {data,error}=await db.from("lugati_teacher_tasks").select("id,student_id,source_attempt_id,subject_key,outcome_code,indicator_index,indicator_text,title,tier,question_count,status,assigned_at,started_at,completed_at,percent").eq("teacher_access_id",access.id).in("source_attempt_id",aid.slice(i,i+150)).neq("status","revoked").order("assigned_at",{ascending:false}).limit(2500);
   if(error)throw error;
   for(const p of data||[]){
    if(!planScopeMatches(p,view.scope))continue;
    const key=String(p.student_id)+"|"+String(p.source_attempt_id);
    if(!mapPlans.has(key))mapPlans.set(key,[]);
    mapPlans.get(key)!.push(p);
   }
  }
 }
 const completedDates=[...mapPlans.values()].flat().filter((p:any)=>p.status==="completed"&&p.completed_at).map((p:any)=>p.completed_at).sort();
 if(completedDates.length){
  const ids=[...new Set(tested.map((r:any)=>String(r.student_id)))];
  for(let i=0;i<ids.length;i+=100){
   const {data,error}=await db.from("nafes_assessment_attempts").select("id,student_id,assessment_id,rendered_sections,answers,submitted_at,is_demo").in("student_id",ids.slice(i,i+100)).gt("submitted_at",completedDates[0]).order("submitted_at",{ascending:true}).limit(2500);
   if(error)throw error;if((data||[]).length===2500)throw httpError("هناك نتائج لاحقة كثيرة، ولا يمكن إصدار تقرير أثر ناقص.",409);
   for(const a of data||[]){if(a.is_demo===true)continue;const k=String(a.student_id);if(!byStudent.has(k))byStudent.set(k,[]);byStudent.get(k)!.push(a)}
  }
 }
 for(const row of view.rows||[]){
  row.plans=[];row.plan_status="none";row.assigned_at=null;row.completed_at=null;row.post_score=null;row.post_total=null;row.post_percent=null;row.post_at=null;row.post_attempt_id=null;row.improvement=null;row.mastered_after=null;row.effect_status=row.tested?"لم تُسند خطة":"لم يُقَس";
  if(!row.tested)continue;
  const plans=mapPlans.get(String(row.student_id)+"|"+String(row.attempt_id))||[];
  if(!plans.length)continue;
  row.plans=plans.map((p:any)=>({id:p.id,title:p.title,tier:p.tier,status:p.status,assigned_at:p.assigned_at,started_at:p.started_at,completed_at:p.completed_at,indicator_text:p.indicator_text,subject_key:p.subject_key,percent:p.percent,question_count:p.question_count}));
  row.assigned_at=plans.map((p:any)=>p.assigned_at).filter(Boolean).sort()[0]||null;
  row.completed_at=plans.map((p:any)=>p.completed_at).filter(Boolean).sort().at(-1)||null;
  row.plan_status=plans.every((p:any)=>p.status==="completed")?"completed":plans.some((p:any)=>p.status==="completed"||p.status==="in_progress")?"in_progress":"assigned";
  effects[row.plan_status]++;
  if(row.plan_status!=="completed"||!row.completed_at){row.effect_status="بانتظار إكمال الخطة";continue}
  const before=view._attempts.get(String(row.student_id));
  const keys=sameIndicatorKeys(before,view.scope);
  if(!keys.length){row.effect_status="لا توجد مهارات قابلة للمقارنة";effects.pending_post++;continue}
  const later=(byStudent.get(String(row.student_id))||[]).filter((a:any)=>a.id!==row.attempt_id&&a.submitted_at>row.completed_at);
  let found:any=null;
  for(const attempt of later){
   const group=new Map(questionParts(attempt).map((x:any)=>[x.key,x]));
   if(keys.some((k:string)=>!group.has(k)))continue;
   const metric=keys.reduce((v:any,k:string)=>({score:v.score+group.get(k).score,total:v.total+group.get(k).total}),{score:0,total:0});
   const valid=validScore(metric.score,metric.total);if(valid){found={attempt,valid};break}
  }
  if(!found){row.effect_status="بانتظار اختبار بعدي لنفس المؤشر";effects.pending_post++;continue}
  row.post_score=found.valid.score;row.post_total=found.valid.total;row.post_percent=Math.round(row.post_score/row.post_total*10000)/100;row.post_at=found.attempt.submitted_at;row.post_attempt_id=found.attempt.id;
  row.improvement=Math.round((row.post_percent-row.percent)*100)/100;row.mastered_after=row.post_percent>=80;
  row.effect_status=row.mastered_after?"متقن":row.improvement>0?"تحسّن ويحتاج متابعة":row.improvement<0?"انخفض أداؤه":"لم يتغير";
  effects.post_tested++;
  if(row.improvement>0)effects.improved++;
  if(row.improvement<0)effects.declined++;
  if(row.mastered_after){effects.mastered_after++;if(row.percent<80)effects.new_mastery++}
  if(row.post_percent<50)effects.still_remedial++;
 }
 view.effect=effects;
 return view;
}
async function planSheet(req:Request,body:any,access:any){
 const id=clean(body?.task_id);if(!/^[0-9a-f-]{36}$/i.test(id))throw httpError("اختر ورقة عمل صحيحة.",400);
 const {data:t,error}=await db.from("lugati_teacher_tasks").select("id,student_id,teacher_access_id,source_attempt_id,title,subject_key,indicator_text,tier,question_ids,status,assigned_at").eq("id",id).eq("teacher_access_id",access.id).neq("status","revoked").maybeSingle();
 if(error)throw error;if(!t)throw httpError("ورقة العمل غير موجودة.",404);
 const {data:student,error:se}=await db.from("nafes_students").select("full_name,class_name").eq("id",t.student_id).maybeSingle();if(se)throw se;
 const ids=(Array.isArray(t.question_ids)?t.question_ids:[]).map(String).slice(0,40);
 if(!ids.length)throw httpError("لا توجد أسئلة محفوظة في الورقة.",409);
 const {data:questions,error:qe}=await db.from("nafes_question_bank").select("id,question_text,context_text,options").in("id",ids);if(qe)throw qe;
 const map=new Map((questions||[]).map((q:any)=>[String(q.id),q]));
 return reply(req,{ok:true,student_name:student?.full_name||"طالب",class_name:student?.class_name||"",title:t.title,indicator_text:t.indicator_text,tier:t.tier,assigned_at:t.assigned_at,questions:ids.map((id:string)=>map.get(id)).filter(Boolean)});
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=="POST")return reply(req,{error:"الطريقة غير مدعومة."},405);
 try{
  const access=await teacher(req),body=await req.json().catch(()=>({})),action=clean(body.action||"list");
  if(action==="list")return reply(req,{ok:true,tests:await listTests(access)});
  if(action==="detail"){const d=await addProgress(await build(clean(body.test_id),clean(body.scope),access),access);delete d._attempts;return reply(req,{ok:true,...d})}
  if(action==="plan_sheet")return await planSheet(req,body,access);
  if(action==="assign")return reply(req,{ok:true,...await assign(clean(body.test_id),clean(body.scope),clean(body.tier),access)});
   if(action==="ensure_all")return reply(req,{ok:true,...await assign(clean(body.test_id),clean(body.scope),"all",access)});
  return reply(req,{error:"إجراء غير مدعوم."},400);
 }catch(e:any){console.error("tamakkun-exam-classifications",e);return reply(req,{error:(e?.status&&e.status<500)?clean(e.message):"تعذر معالجة نتائج هذا الاختبار. حاول مرة أخرى.",details:e?.status&&e.status<500?undefined:"server_error"},e?.status||500)}
});
