import {chromium} from "@playwright/test";
const origin=process.argv[2],session=process.argv[3],mode=process.argv[4]||"audit";
if(new URL(origin).hostname!=="127.0.0.1")throw Error("Local browser only");
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
try{
 const context=await browser.newContext();
 const blocked:string[]=[];
 await context.route("**/*",async route=>{
  const u=new URL(route.request().url());
  if(u.origin!==origin){blocked.push(u.origin);await route.abort();}else await route.continue();
 });
 const page=await context.newPage();
 await page.goto(origin+"/qa/omr/development/frontend/student-papers.html");
 await page.waitForFunction(()=>!!(window as any).NafesTeacher?.api);
 const result=await page.evaluate(async({session,mode})=>{
  const api=(window as any).NafesTeacher.api;
  if(mode==="publish"){
   const responses=await Promise.all([1,2].map(()=>api("teacher_paper_review_save",{review_id:"RQA01",session_id:session})));
   if(responses.some(d=>d.saved_count!==1))throw Error("Concurrent browser publication failed");
   return {concurrent_publication_responses:responses.length,api_result:responses[0],actual_frontend_transport:true};
  }
  const d=await api("teacher_scan_deletion_log",{review_id:"RQA01",session_id:session});
  if(d.deletions?.length!==1)throw Error("Browser did not receive real persisted rollback audit");
  return {persisted_audit_rows:d.deletions.length,actual_frontend_transport:true};
 },{session,mode});
 console.log(JSON.stringify({...result,external_requests_aborted:blocked.length}));
}finally{await browser.close();}
