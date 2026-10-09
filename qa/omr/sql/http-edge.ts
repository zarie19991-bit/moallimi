// QA only: actual application dispatcher -> official PostgREST client -> local HTTP.
import {PostgrestClient} from "@supabase/postgrest-js";
import {readFileSync,existsSync} from "node:fs";
import {resolve,extname} from "node:path";
import {FRAMEWORK} from "../development/source/framework";
import {syntheticSheet} from "../fixtures";
const cfg=JSON.parse(readFileSync(process.argv[2],"utf8"));
const rest=new URL(cfg.rest);
if(rest.hostname!=="127.0.0.1")throw Error("Local PostgREST only");
const realFetch=globalThis.fetch;
// Existing loader rewrites Deno npm: imports for Bun and denies unrelated fetch.
const {developmentAssessments}=await import("../source");
const {handleAssessments}=developmentAssessments;
const traffic:any[]=[];
const db=new PostgrestClient(cfg.rest,{
 headers:{Authorization:`Bearer ${cfg.service_token}`},
 fetch:async(input:any,init:any)=>{
  const url=new URL(String(input));
  if(url.origin!==rest.origin)throw Error("Production/external network denied");
  const res=await realFetch(input,init);
  traffic.push({method:init?.method||"GET",path:url.pathname,status:res.status});
  return res;
 },
});
const model={model:"A",questions:Array.from({length:10},(_,i)=>({
 id:`qa${i+1}`,subject:"math",indicator:FRAMEWORK.find(x=>x.subject==="math")!.key,
 question:`Synthetic question ${i+1}`,options:["A","B","C","D"],
}))};
const keys=[{model:"A",answers:model.questions.map(q=>({question_id:q.id,correct_index:0,indicator:q.indicator}))}];
const root=resolve(".");
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const server=Bun.serve({hostname:"127.0.0.1",port:0,async fetch(req){
 const u=new URL(req.url);
 if(u.pathname==="/qa-config")return json({model,keys,image:syntheticSheet({marks:Array.from({length:10},(_,row)=>({row,option:0}))})});
 if(u.pathname==="/qa-traffic")return json(traffic);
 if(u.pathname==="/api/omr-local"){
  if(req.method==="GET")return json({synthetic_only:true,review_id:"RQA01",session_id:cfg.session,
    can_delete_sql:true,can_publish_sql:true});
  if(req.method!=="POST")return json({error:"POST required"},405);
  const origin=req.headers.get("origin");
  if(origin&&origin!==u.origin)return json({error:"Cross origin rejected"},403);
  try{
   const b=await req.json();
   if(!String(b.action).startsWith("teacher_scan_")&&!["teacher_paper_review_get","teacher_paper_review_save"].includes(b.action))
    return json({error:"OMR test scope only"},403);
   return json(await handleAssessments(db,req,b));
  }catch(e:any){return json({error:e.message},e.status||500);}
 }
 let rel=u.pathname.slice(1)||"qa/omr/development/frontend/student-papers.html";
 const file=resolve(root,rel);
 if(!file.startsWith(root+"/")||!existsSync(file)||![".html",".js",".css"].includes(extname(file)))
  return json({error:"Not found"},404);
 const mime:any={".html":"text/html",".js":"text/javascript",".css":"text/css"};
 return new Response(Bun.file(file),{headers:{"Content-Type":mime[extname(file)],
  "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"}});
}});
console.log(JSON.stringify({port:server.port}));
