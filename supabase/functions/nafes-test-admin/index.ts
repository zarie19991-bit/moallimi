import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-teacher-key",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json; charset=utf-8"
};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const tidy=(v:unknown)=>String(v??"").trim();
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash=async(s:string)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,"0")).join("");

async function teacher(req:Request){
  const key=tidy(req.headers.get("x-teacher-key"));
  if(!/^[a-f0-9]{48,96}$/i.test(key))throw Object.assign(new Error("مفتاح دخول المعلم غير صالح."),{status:401});
  const {data,error}=await db.from("nafes_teacher_access").select("id,label").eq("key_hash",await hash(key)).eq("active",true).maybeSingle();
  if(error)throw error;
  if(!data)throw Object.assign(new Error("مفتاح دخول المعلم غير صحيح."),{status:401});
  return data;
}

function schedule(test:any){
  const s=test?.config?.settings||{};
  return {id:test.id,title:test.title,kind:test.kind,short_code:test.short_code,status:test.status,class_name:test?.config?.class_name||"",opens_at:s.opens_at||null,closes_at:s.closes_at||null,published_at:test.published_at||null};
}

async function ownedPublished(ownerId:string,id:string){
  if(!uuid.test(id))throw Object.assign(new Error("معرّف الاختبار غير صالح."),{status:400});
  const {data,error}=await db.from("nafes_assessments").select("id,owner_id,title,kind,short_code,status,config,published_at").eq("id",id).eq("owner_id",ownerId).eq("status","published").maybeSingle();
  if(error)throw error;
  if(!data)throw Object.assign(new Error("الاختبار غير موجود أو غير مصرح بإدارته."),{status:404});
  return data;
}

function parseDate(v:unknown){
  if(v===null||v===undefined||tidy(v)==="")return null;
  const d=new Date(String(v));
  if(!Number.isFinite(d.getTime()))throw Object.assign(new Error("صيغة التاريخ أو الوقت غير صحيحة."),{status:400});
  return d.toISOString();
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const owner=await teacher(req);
    const body=await req.json().catch(()=>({}));
    const action=tidy(body?.action);

    if(action==="list"){
      const {data,error}=await db.from("nafes_assessments").select("id,title,kind,short_code,status,config,published_at").eq("owner_id",owner.id).eq("status","published").order("published_at",{ascending:false});
      if(error)throw error;
      return json({ok:true,tests:(data||[]).map(schedule)});
    }

    if(action==="update_schedule"){
      const test=await ownedPublished(owner.id,tidy(body?.test_id));
      const opens_at=parseDate(body?.opens_at);
      const closes_at=parseDate(body?.closes_at);
      if(opens_at&&closes_at&&new Date(closes_at).getTime()<=new Date(opens_at).getTime())throw Object.assign(new Error("وقت الإغلاق يجب أن يكون بعد وقت الفتح."),{status:400});
      if(closes_at&&new Date(closes_at).getTime()<=Date.now())throw Object.assign(new Error("وقت الإغلاق يجب أن يكون في المستقبل."),{status:400});
      const config={...(test.config||{}),settings:{...(test.config?.settings||{}),opens_at,closes_at}};
      const {data,error}=await db.from("nafes_assessments").update({config}).eq("id",test.id).eq("owner_id",owner.id).eq("status","published").select("id,title,kind,short_code,status,config,published_at").single();
      if(error)throw error;
      return json({ok:true,test:schedule(data),message:"تم تحديث موعد الاختبار."});
    }

    if(action==="archive"){
      const test=await ownedPublished(owner.id,tidy(body?.test_id));
      if(tidy(body?.confirm_word)!=="حذف")throw Object.assign(new Error("اكتب كلمة «حذف» لتأكيد حذف الاختبار."),{status:400});
      const {data:errorCount,error:countError}=await db.from("nafes_assessment_attempts").select("id",{count:"exact",head:true}).eq("assessment_id",test.id);
      if(countError)throw countError;
      const {data,error}=await db.from("nafes_assessments").update({status:"archived"}).eq("id",test.id).eq("owner_id",owner.id).eq("status","published").select("id,title,status").single();
      if(error)throw error;
      return json({ok:true,test:data,results_preserved:true,message:"تم حذف الاختبار من القائمة وتعطيل رابط الطالب مع الاحتفاظ بنتائج الطلاب السابقة."});
    }

    return json({error:"إجراء غير معروف."},400);
  }catch(e:any){
    console.error(e);
    return json({error:e?.message||"تعذر إدارة الاختبار."},Number(e?.status)||500);
  }
});
