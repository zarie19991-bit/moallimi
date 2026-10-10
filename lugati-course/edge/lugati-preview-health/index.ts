import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const db=createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {auth:{persistSession:false}}
);

Deno.serve(async () => {
  try {
    const [{count:blocks,error:be},{count:questions,error:qe},{data:blue,error:ble},{data:lesson,error:le}] = await Promise.all([
      db.from("lesson_micro_blocks").select("*",{count:"exact",head:true}).eq("active",true),
      db.from("course_question_bank").select("*",{count:"exact",head:true}).eq("active",true),
      db.from("lesson_blueprints").select("lesson_id,unit_code,ready_for_publish").in("unit_code",["U1","U2","U3"]),
      db.from("lessons").select("id,code,title").eq("code","U1-08").maybeSingle()
    ]);
    if(be||qe||ble||le) throw be||qe||ble||le;
    if(!lesson) throw new Error("sample_lesson_missing");

    const [{data:sampleBlocks,error:sbe},{data:sampleQuestions,error:sqe}] = await Promise.all([
      db.from("lesson_micro_blocks").select("id,point_key").eq("lesson_id",lesson.id).eq("active",true),
      db.from("course_question_bank").select("id,point_key").eq("lesson_id",lesson.id).eq("point_key","p03").eq("active",true)
    ]);
    if(sbe||sqe) throw sbe||sqe;

    const ready=(blue||[]).filter((x:any)=>x.ready_for_publish).length;
    const byUnit=Object.fromEntries(["U1","U2","U3"].map(u=>[
      u,
      {
        total:(blue||[]).filter((x:any)=>x.unit_code===u).length,
        ready:(blue||[]).filter((x:any)=>x.unit_code===u&&x.ready_for_publish).length
      }
    ]));

    return new Response(JSON.stringify({
      ok:true,
      active_micro_blocks:blocks||0,
      active_questions:questions||0,
      ready_blueprints:ready,
      by_unit:byUnit,
      sample_lesson:{code:lesson.code,title:lesson.title,blocks:(sampleBlocks||[]).length,p03_questions:(sampleQuestions||[]).length}
    }),{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ok:false,error:"health_check_failed"}),{status:500,headers:{"Content-Type":"application/json"}});
  }
});