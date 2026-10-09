import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--no-sandbox']});
const context=await browser.newContext({locale:'ar-SA'});
const page=await context.newPage();
const errors=[],actions=[];
page.on('pageerror',e=>errors.push(String(e)));
const payload={
  review_id:'RSMOKEAUTH20261009',title:'اختبار دخول آلي وهمي',subject:'reading',subjects:['reading'],
  assignments:[{sheet_no:1,student_name:'طالب وهمي',model:'A'}],
  question_count:1,answer_keys:[{model:'A',answers:[{correct_index:0,indicator:'reading:test'}]}],
  models:[{model:'A',questions:[{id:'q1',options:['أ','ب','ج','د']}]}]
};
let noReview=false;
await page.route('**/functions/v1/nafes-teacher-profile',route=>route.fulfill({
 status:200,contentType:'application/json',body:JSON.stringify({label:'معلم اختبار وهمي',subject_scope:'all'})
}));
await page.route('**/functions/v1/nafes-exam',async route=>{
 let body={};try{body=JSON.parse(route.request().postData()||'{}')}catch{}
 actions.push(body.action);
 const res=body.action==='teacher_paper_review_get'
   ?{review:noReview?null:{payload}}
   :body.action==='teacher_scan_sessions'
   ?{sessions:[]}
   :body.action==='teacher_scan_alerts'
   ?{alerts:[],next_cursor:null}
   :body.action==='teacher_scan_deletion_log'
   ?{deletions:[],next_cursor:null}
   :body.action==='teacher_scan_start'
   ?{error:'رفض تجريبي مقصود للتحقق من ظهور خطأ القراءة'}
   :{error:'unexpected test action '+body.action};
 const status=body.action==='teacher_scan_start'?409:res.error?400:200;
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(res)});
});
try{
 await page.goto(SITE+'review-scan.html?qa=login-read',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('#nafesTeacherLogin',{timeout:20000});
 assert.equal(await page.locator('#processBtn').isDisabled(),true,'reading must stay disabled before login');
 assert.equal(await page.locator('#noDraft').isVisible(),false,'must not show missing draft before login');
 assert.equal(await page.locator('#progressText').innerText(),'جاهز','auth is not a scanning error');
 assert.match(await page.locator('#scanPrerequisiteText').innerText(),/سجّل دخول المعلم/);
 console.log('PASS scan_requires_authenticated_teacher');
 await page.locator('#nafesTeacherLogin input[name=teacherKey]').fill('synthetic-auth-key');
 await page.locator('#nafesTeacherLogin button[type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('#reviewMeta')?.textContent?.includes('اختبار دخول آلي وهمي'),{},{timeout:30000});
 assert.equal(await page.locator('#noDraft').isVisible(),false,'server review must load after login');
 assert.equal(await page.locator('#processBtn').isDisabled(),true,'reading must stay disabled until a file is chosen');
 assert(actions.includes('teacher_paper_review_get')&&actions.includes('teacher_scan_sessions'),'server review and sessions must load');
 console.log('PASS scan_recovers_server_review_after_login');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
 await page.locator('#fileInput').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png});
 await page.waitForFunction(()=>!document.querySelector('#processBtn')?.disabled,{},{timeout:10000});
 await page.locator('#processBtn').click();
 await page.waitForFunction(()=>document.querySelector('#progressText')?.textContent?.includes('رفض تجريبي مقصود'),{},{timeout:30000});
 assert(actions.includes('teacher_scan_start'),'read button should actually send scan start after login and file');
 assert.equal(await page.locator('#processBtn').isDisabled(),false,'button should recover after rejected operation');
 console.log('PASS scan_button_starts_request_and_displays_server_error');
 // Explicitly test login without server-side paper draft.
 noReview=true;
 const context2=await browser.newContext({locale:'ar-SA'});
 const page2=await context2.newPage();
 try{
  await page2.route('**/functions/v1/nafes-teacher-profile',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({label:'معلم وهمي',subject_scope:'all'})}));
  await page2.route('**/functions/v1/nafes-exam',async route=>{
    const request=JSON.parse(route.request().postData()||'{}');
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(request.action==='teacher_paper_review_get'?{review:null}:{sessions:[]})});
  });
  await page2.goto(SITE+'review-scan.html?qa=no-review',{waitUntil:'domcontentloaded',timeout:60000});
  await page2.locator('#nafesTeacherLogin input[name=teacherKey]').fill('synthetic-auth-key');
  await page2.locator('#nafesTeacherLogin button[type=submit]').click();
  await page2.waitForFunction(()=>!document.getElementById('noDraft')?.classList.contains('hidden'),{},{timeout:20000});
  assert.equal(await page2.locator('#processBtn').isDisabled(),true);
  assert.match(await page2.locator('#scanPrerequisiteText').innerText(),/لا يوجد اختبار ورقي/);
  console.log('PASS scan_missing_paper_review_explained');
 }finally{await context2.close();}
 assert.deepEqual(errors,[],'unexpected browser JS errors');
 console.log('SCAN_LOGIN_READ_ACCEPTANCE_PASS');
} finally{
 await browser.close();
}
