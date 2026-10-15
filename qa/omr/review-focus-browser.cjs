const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright');
(async()=>{
 for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await type.launch();
  try{
   const page=await browser.newPage({viewport:{width:1280,height:900}});
   await page.setContent(fs.readFileSync('review-scan.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
   await page.addStyleTag({path:'review-scan.css'});
   await page.evaluate(()=>document.getElementById('resultsSection').classList.remove('hidden'));
   assert.equal(await page.locator('#approveBtn').isVisible(),true);
   assert.equal(await page.locator('#resetOmrAttemptsBtn').isVisible(),false);
   await page.locator('.scan-extra>summary').click();
   assert.equal(await page.locator('#resetOmrAttemptsBtn').isVisible(),true);
   await page.locator('.scan-extra>summary').click();
   await page.evaluate(()=>{
    document.getElementById('sheetModal').classList.remove('hidden');
    document.getElementById('answerEditor').innerHTML=[1,2,3].map(q=>'<div class="answer-row-edit" data-question="'+q+'"><b>السؤال '+q+'</b><button>أ</button></div>').join('');
   });
   await page.addScriptTag({path:'review-focus.js'});
   await page.evaluate(()=>window.NafesReviewFocus.mount('s',[
    {question:1,state:'correct',status:'clear'},
    {question:2,state:'uncertain',status:'ambiguous'},
    {question:3,state:'multiple',status:'multiple'}
   ]));
   assert.equal(await page.locator('[data-question="1"]').isVisible(),false);
   assert.equal(await page.locator('[data-question="2"]').isVisible(),true);
   await page.locator('#reviewQuestionNext').click();
   assert.equal(await page.locator('[data-question="3"]').isVisible(),true);
   await page.evaluate(()=>window.NafesReviewFocus.mount('s',[
    {question:1,state:'correct',status:'clear'},
    {question:2,state:'correct',status:'clear',reviewed_manually:true},
    {question:3,state:'incorrect',status:'clear',reviewed_manually:true}
   ]));
   assert.match(await page.locator('#reviewFocusCount').textContent(),/لا توجد إجابات معلّقة/);
   await page.locator('#reviewFocusFilter').selectOption('all');
   await page.locator('#reviewQuestionList').click();
   assert.equal(await page.locator('#answerEditor>[data-question]:visible').count(),3);
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.locator('#reviewFocusFilter').isVisible(),true);
   await page.setContent(fs.readFileSync('review-correction.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));
   await page.addStyleTag({path:'review-correction.css'});
   assert.equal(await page.locator('#paperTests').isVisible(),true);
   assert.equal(await page.locator('#reviewTitle').isVisible(),false);
   await page.locator('#paperBuilder>summary').click();
   assert.equal(await page.locator('#reviewTitle').isVisible(),true);
   console.log('PASS '+name+': pending focus, navigation, saved decision, all questions and mobile view');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
