import {readFileSync,existsSync} from "node:fs";
import {resolve,extname} from "node:path";
import {localDatabase} from "./sql/local-db";
import {developmentScan} from "./source";
const cfg=JSON.parse(readFileSync(process.argv[2],"utf8"));
const db=localDatabase(cfg),root=resolve(".");
const allowed=new Set(readFileSync("production-files.txt","utf8").split("\n").filter(s=>s&&!s.startsWith("#")));
const headers={"Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'",
 "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,"Content-Type":"application/json; charset=utf-8"}});
Bun.serve({port:5000,hostname:"0.0.0.0",async fetch(req){
 const url=new URL(req.url);
 if(url.pathname==="/api/omr-local"){
  try{
   if(req.method==="GET")return json({synthetic_only:true,review_id:"batch-140",session_id:cfg.session_id,can_delete_sql:false,can_publish_sql:false});
   if(req.method!=="POST"||!req.headers.get("content-type")?.includes("application/json"))return json({error:"JSON required"},400);
   const origin=req.headers.get("origin");if(origin&&new URL(origin).host!==req.headers.get("host"))return json({error:"Cross-origin denied"},403);
   const body=await req.json();
   if(!String(body.action).startsWith("teacher_scan_")||["teacher_scan_start","teacher_scan_register","teacher_scan_delete","teacher_scan_deletion_log"].includes(body.action))
     return json({error:"المسار يحتاج تعريفات SQL الأصلية غير المتاحة؛ لم تُحفظ محاولات أو تُحذف بيانات."},409);
   if(body.review_id!=="batch-140"||body.session_id!==cfg.session_id)return json({error:"Synthetic session only"},403);
   const result=await developmentScan.handlePaperScan(db,body,{id:cfg.owner_id,subject_scope:"all"});
   return json(result);
  }catch(e:any){return json({error:e.message},409);}
 }
 let path=decodeURIComponent(url.pathname);
 if(path==="/")path="/qa/omr/development/frontend/student-papers.html";
 const rel=path.slice(1),file=resolve(root,rel);
 const qa=rel.startsWith("qa/omr/development/frontend/")&&[".html",".js",".css"].includes(extname(file));
 if(!file.startsWith(root+"/")||(!qa&&!allowed.has(rel))||!existsSync(file))return new Response("Not found",{status:404,headers});
 const types:any={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"};
 return new Response(Bun.file(file),{headers:{...headers,"Content-Type":types[extname(file)]||"application/octet-stream"}});
}});
console.log("Moallimi isolated synthetic OMR preview ready on 5000. Production network blocked.");
