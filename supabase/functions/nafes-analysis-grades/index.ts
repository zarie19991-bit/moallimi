import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type, x-teacher-key",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json; charset=utf-8",
};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const tidy=(v:unknown)=>String(v??"").trim();
const SUBJECTS=new Set(["reading","math","science"]);
async function sha256(value:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");}
async function requireTeacher(req:Request){
  const key=tidy(req.headers.get("x-teacher-key"));
  if(!/^(?:[0-9]{10}|[a-f0-9]{48,96})$/i.test(key))throw Object.assign(new Error("مفتاح دخول المعلم مطلوب."),{status:401});
  const {data,error}=await db.from("nafes_teacher_access").select("id,label,subject_scope").eq("key_hash",await sha256(key)).eq("active",true).maybeSingle();
  if(error)throw error;
  if(!data)throw Object.assign(new Error("مفتاح دخول المعلم غير صحيح."),{status:401});
  return {...data,subject_scope:SUBJECTS.has(String(data.subject_scope))?String(data.subject_scope):"all"};
}
async function allRows(table:string,columns:string,submittedOnly=true,excludeDemo=false){
  const rows:Record<string,unknown>[]=[];
  for(let start=0;;start+=500){
    let query=db.from(table).select(columns).order(submittedOnly?"submitted_at":"created_at",{ascending:true}).range(start,start+499);
    if(submittedOnly)query=query.not("submitted_at","is",null);
    if(excludeDemo)query=query.eq("is_demo",false);
    const {data,error}=await query;if(error)throw error;rows.push(...(data||[]));if(!data||data.length<500)break;
  }
  return rows;
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  try{
    const teacher=await requireTeacher(req),scope=teacher.subject_scope;
    const [assessment,exam,students,tests]=await Promise.all([
      allRows("nafes_assessment_attempts","id,assessment_id,student_id,student_key,score,total,percent,section_scores,submitted_at",true,true),
      allRows("nafes_exam_attempts","id,subject_key,outcome_code,indicator_index,model_no,student_id,student_key,score,percent,rendered_questions,submitted_at",true,true),
      allRows("nafes_students","id,full_name,class_name,created_at",false,true),
      allRows("nafes_assessments","id,kind,config,created_at",false),
    ]);
    const studentMap=new Map((students as any[]).map(s=>[String(s.id),s]));
    const testMap=new Map((tests as any[]).map(t=>[String(t.id),t]));
    const withStudent=(r:any)=>{const student=studentMap.get(String(r.student_id||""));return{student_name:student?.full_name||null,class_name:student?.class_name||null};};
    const grades:any[]=[];
    for(const r of assessment as any[]){
      const test=testMap.get(String(r.assessment_id||""));
      if(!test||test.kind==="simulation")continue;
      const testSubjects=(test.config?.sections||[]).map((s:any)=>String(s.subject||""));
      if(scope!=="all"&&!testSubjects.includes(scope))continue;
      let score=r.score,total=r.total,percent=r.percent,section_scores=Array.isArray(r.section_scores)?r.section_scores:[];
      if(scope!=="all"){
        const sec=section_scores.find((s:any)=>String(s.subject||"")===scope);
        if(sec){score=sec.score;total=sec.total;percent=sec.percent;section_scores=[sec];}
      }
      grades.push({source:"assessment",id:r.id,test_id:r.assessment_id,student_id:r.student_id,student_key:r.student_key,...withStudent(r),score,total,percent,section_scores,submitted_at:r.submitted_at});
    }
    for(const r of exam as any[]){
      if(scope!=="all"&&String(r.subject_key)!==scope)continue;
      grades.push({source:"exam",id:r.id,test_id:`exam:${r.subject_key}:${r.outcome_code}:i${r.indicator_index}:m${r.model_no}`,student_id:r.student_id,student_key:r.student_key,...withStudent(r),score:r.score,total:Array.isArray(r.rendered_questions)?r.rendered_questions.length:15,percent:r.percent,section_scores:[],submitted_at:r.submitted_at});
    }
    return json({ok:true,grades});
  }catch(error:any){
    console.error(error);
    const status=error&&typeof error==="object"&&"status" in error?Number(error.status):500;
    return json({error:status===500?"تعذر تحميل الدرجات المحفوظة للتحليل.":String(error.message)},status);
  }
});
