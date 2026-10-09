import {chromium} from "@playwright/test";
const origin=process.argv[2],session=process.argv[3],mode=process.argv[4]||"audit";
const production=process.argv[5]==="production";
if(new URL(origin).hostname!=="127.0.0.1")throw Error("Local browser only");
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]});
try{
 const context=await browser.newContext();
 if(production)await context.addInitScript(({origin})=>{
  const real=window.fetch.bind(window);
  window.fetch=(input,init)=>{
   const url=typeof input==="string"?input:input instanceof URL?input.href:input.url;
   if(url==="https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam")
     return real(origin+"/api/omr-local",init);
   if(url==="https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-teacher-profile")
     return real(origin+"/qa-profile",init);
   return real(input,init);
  };
 },{origin});
 const blocked:string[]=[];
 await context.route("**/*",async route=>{
  const u=new URL(route.request().url());
  if(u.origin!==origin){blocked.push(u.origin);await route.abort();}else await route.continue();
 });
 const page=await context.newPage();
 const pageErrors:string[]=[];page.on("pageerror",e=>pageErrors.push(e.message));
 await page.goto(origin+(production?"/review-scan.html":"/qa/omr/development/frontend/student-papers.html"));
 await page.waitForFunction(()=>!!(window as any).NafesTeacher?.api);
 if(production)await page.evaluate(()=>{(window as any).NafesTeacher.setKey("0000000001");});
 if(mode==="review"){
  const cfg=await(await page.request.get(origin+"/qa-config")).json();
  await page.evaluate(async draft=>{await (window as any).NafesScanJournal.init(draft);},cfg.draft);
  await page.locator("#resultsBody button").first().click();
  try{await page.waitForFunction(()=>!document.getElementById("sheetModal")?.classList.contains("hidden"),{},{timeout:5000});}
  catch(e){throw Error("Review modal failed: "+pageErrors.join(" | "));}
  await page.locator("#verifiedCheck").check();
  if(await page.locator("#saveSheetBtn").isEnabled())throw Error("Ambiguous sheet enabled verification");
  if(!(await page.locator("#omrUncertaintyReasons").innerText()).includes("غير محسومة"))throw Error("Reading uncertainty reason not visible");
  await page.waitForFunction(()=>{const img=document.getElementById("scanImage") as HTMLImageElement;return img?.complete&&img.naturalWidth>0;});
  await page.locator('[data-edit-question="1"][data-choice="0"]').click();
  if(!(await page.locator("#modalFeedback").innerText()).includes("سبب التعديل"))throw Error("Missing manual reason was not blocked by real UI");
  await page.screenshot({path:"qa/omr/results/production-integration/review-modal.png"});
  console.log(JSON.stringify({actual_review_modal:true,ambiguous_verify_disabled:true,reading_reason_visible:true,manual_without_reason_blocked:true}));
  await browser.close();process.exit(0);
 }
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
