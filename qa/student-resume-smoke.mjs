import { chromium } from 'playwright-core';
const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--no-sandbox']});
const page=await (await browser.newContext({locale:'ar-SA'})).newPage();
const settings={lock_session:false,allow_copy:false,allow_back:true,one_per_page:true,watermark:true,disable_print:true,disable_shortcuts:true,disable_right_click:true,log_visibility:false};
const state=()=>({attempt_id:'resume-attempt',access_token:'resume-token',submitted:false,student_name:'طالب أول',current_section:0,cursor:0,answers:{q1:1},expires_at:new Date(Date.now()+1200000).toISOString(),section_started_at:new Date().toISOString(),settings,sections:[{subject:'reading',duration_minutes:20,calculator:false,questions:[{id:'q1',question:'سؤال تجريبي',options:['أ','ب','ج','د'],image:null}]}]});
let starts=0,resumes=0;
await page.route('**/functions/v1/nafes-exam',async route=>{
 let body={};try{body=JSON.parse(route.request().postData()||'{}')}catch{}
 if(body.action==='assessment_info')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({title:'اختبار تجريبي',school_name:'مدرسة ابن سينا المتوسطة',class_name:'',teacher_name:'',identity_mode:'manual',settings,sections:[{subject:'reading',question_count:1,duration_minutes:20,calculator:false}]})});
 if(body.action==='assessment_start'){starts++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(state())});}
 if(body.action==='assessment_resume'){resumes++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(state())});}
 if(['assessment_save','assessment_event','assessment_advance'].includes(body.action))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,...state()})});
 return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'unexpected action'})});
});
await page.goto(`${SITE}e.html?t=resume-smoke`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForSelector('#identity:not([hidden])',{timeout:30000});
await page.fill('#studentName','طالب أول');
await page.fill('#studentNo','123');
await page.fill('#className','أ');
await page.click('#startBtn');
await page.waitForSelector('#player:not([hidden])',{timeout:30000});
if(starts!==1)throw new Error(`start count ${starts}`);
const stored=await page.evaluate(()=>({resume:sessionStorage.getItem('nafes_attempt_resume-smoke'),identity:sessionStorage.getItem('nafes_student_identity'),persistent:localStorage.getItem('nafes_student_identity')}));
if(!stored.resume)throw new Error('resume token missing');
if(stored.persistent!==null)throw new Error('identity persisted in localStorage');
if(stored.identity&&JSON.parse(stored.identity).no)throw new Error('last3 stored in identity');
await page.reload({waitUntil:'domcontentloaded',timeout:60000});
await page.waitForSelector('#player:not([hidden])',{timeout:30000});
if(starts!==1)throw new Error(`student registered again ${starts}`);
if(resumes!==1)throw new Error(`resume count ${resumes}`);
console.log('PASS student_resume_without_reregistration',JSON.stringify({starts,resumes}));
await browser.close();
