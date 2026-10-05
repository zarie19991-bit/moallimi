import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const db=createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {auth:{persistSession:false}}
);

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff"
  }
});
const tidy=(v:unknown)=>String(v??"").trim();
async function sha256Hex(value:string){
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async(req)=>{
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  const auth=tidy(req.headers.get("authorization"));
  const token=auth.toLowerCase().startsWith("bearer ")?auth.slice(7).trim():"";
  if(!token)return json({valid:false},401);

  try{
    const tokenHash=await sha256Hex(token);
    const {data:s,error}=await db.from("lugati_sessions")
      .select("id,role,student_id,teacher_access_id,expires_at")
      .eq("token_hash",tokenHash)
      .gt("expires_at",new Date().toISOString())
      .maybeSingle();
    if(error)throw error;
    if(!s)return json({valid:false},401);

    await db.from("lugati_sessions").update({last_seen_at:new Date().toISOString()}).eq("id",s.id);

    if(s.role==="student"){
      const {data:student,error:se}=await db.from("nafes_students")
        .select("id,is_active")
        .eq("id",s.student_id)
        .eq("is_active",true)
        .maybeSingle();
      if(se)throw se;
      if(!student)return json({valid:false},401);
      return json({valid:true,role:"student",external_id:String(student.id),expires_at:s.expires_at});
    }

    if(s.role==="teacher"){
      const {data:teacher,error:te}=await db.from("nafes_teacher_access")
        .select("id,active")
        .eq("id",s.teacher_access_id)
        .eq("active",true)
        .maybeSingle();
      if(te)throw te;
      if(!teacher)return json({valid:false},401);
      return json({valid:true,role:"teacher",external_id:String(teacher.id),expires_at:s.expires_at});
    }

    return json({valid:false},401);
  }catch(e){
    console.error("lugati-session-verify",e);
    return json({error:"verification_failed"},500);
  }
});