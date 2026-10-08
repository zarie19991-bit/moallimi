import {chromium} from "@playwright/test";
import {writeFileSync,mkdirSync} from "node:fs";
const base="https://"+process.env.REPLIT_DEV_DOMAIN;
const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",headless:true,args:["--no-sandbox"]});
const context=await browser.newContext();
const leaks=[];await context.route("**/*",route=>{
 const url=new URL(route.request().url());if(url.hostname!==new URL(base).hostname){leaks.push(url.hostname);return route.abort();}
 return route.continue();
});
const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
const checks=[];
function assert(value,name){if(!value)throw Error(name);checks.push(name);}
try{
 await page.goto(base,{waitUntil:"networkidle"});
 await page.waitForSelector("#omrSheets .omr-sheet-item");
 assert(await page.locator("#omrSheets .omr-sheet-item").count()===140,"140 sheets shown in existing UI");
 await page.locator("#omrSheets .omr-sheet-item").first().click();
 await page.waitForSelector("#omrAnswerReason");
 const currentList=await(await context.request.post(base+"/api/omr-local",{headers:{"x-teacher-key":"0000000001"},data:{action:"teacher_scan_list",review_id:"batch-140",session_id:"11111111-1111-4111-8111-111111111111"}})).json();
 const initialAnswer=(currentList.sheets[0].effective_snapshot||currentList.sheets[0].snapshot).answers[0];
 if(initialAnswer.state==="uncertain")
   assert((await page.locator("#omrDetail").innerText()).includes("synthetic_review_injection"),"injected reading cause shown");
 else assert(initialAnswer.reviewed_manually&&initialAnswer.manual_reason,"previous resolution still has explicit human reason");
 const edit=page.locator('[data-action="edit-answer"]');
 for(const input of await page.locator('input[name="omr-marked"]').all())await input.uncheck();
 await page.locator('input[name="omr-marked"][value="0"]').check();
 await edit.click();
 assert((await page.locator("#omrError").innerText()).length>0,"manual reason required in browser");
 await page.locator("#omrAnswerReason").fill("حسم الاختيار وفق صورة الاختبار الاصطناعية");
 const request=page.waitForRequest(r=>r.url().includes("/api/omr-local")&&r.method()==="POST"&&r.postDataJSON().action==="teacher_scan_edit_answer");
 const response=page.waitForResponse(r=>r.url().includes("/api/omr-local")&&r.request().postDataJSON()?.action==="teacher_scan_edit_answer");
 await edit.click();
 const posted=(await request).postDataJSON();assert(posted.question===1,"one-based question matches SQL contract");
 const saved=await(await response).json();assert(!saved.error,"actual Edge handler saved reason in native PostgreSQL");
 await page.waitForTimeout(600);
 const historyResponse=page.waitForResponse(r=>r.url().includes("/api/omr-local")&&r.request().method()==="POST"&&r.request().postDataJSON()?.action==="teacher_scan_edit_history");
 await page.locator('[data-action="history"]').click();
 const history=await(await historyResponse).json();
 if(history.error)throw Error("History API: "+history.error);
 await page.waitForFunction(()=>document.getElementById("omrHistory")?.innerText.includes("حسم الاختيار"));
 assert((await page.locator("#omrHistory").innerText()).includes("حسم الاختيار"),"saved audit reason shown");
 await page.locator('[data-action="image"]').click();
 await page.waitForFunction(()=>document.getElementById("omrSheetImage")?.naturalWidth===900);
 assert(await page.locator("#omrSheetImage").isVisible(),"actual stored synthetic JPEG displayed");
 const reread=page.waitForResponse(r=>r.url().includes("/api/omr-local")&&r.request().method()==="POST"&&r.request().postDataJSON()?.action==="teacher_scan_reprocess_server");
 await page.locator('[data-action="reprocess"]').click();
 const proposal=await(await reread).json();
 assert(proposal.proposal_only===true&&proposal.sheet.answer_version===saved.sheet.answer_version
   &&proposal.sheet.effective_snapshot.answers[0].selected===0,"actual reread preserves reviewed answer and version");
 await page.waitForTimeout(600);
 const detail=await page.locator("#omrDetail").innerText();
 assert(detail.includes("اقتراح")||detail.includes("مقترح"),"reread shown only as proposal");
 const finish=await context.request.post(base+"/api/omr-local",{headers:{"x-teacher-key":"0000000001"},data:{action:"teacher_scan_finish",review_id:"batch-140",session_id:"11111111-1111-4111-8111-111111111111"}});
 assert(!finish.ok(),"unfinished batch cannot be approved by actual handler");
 assert(await page.locator("#omrDelete").isDisabled(),"admin rollback blocked without original DDL");
 assert(errors.length===0,"no browser JavaScript exceptions");
 assert(leaks.filter(h=>h.includes("supabase")).length===0,"no production Supabase requests");
 mkdirSync("qa/omr/results/integrated",{recursive:true});
 await page.screenshot({path:"qa/omr/results/integrated/ui-browser.png",fullPage:false});
 writeFileSync("qa/omr/results/integrated/ui-evidence.json",JSON.stringify({passed:checks.length,checks,errors,external_requests_blocked:leaks,synthetic_only:true},null,2));
 console.log(JSON.stringify({passed:checks.length,checks}));
}finally{await browser.close();}
