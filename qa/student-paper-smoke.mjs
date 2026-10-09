import { chromium } from 'playwright-core';
const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--no-sandbox']});
const context=await browser.newContext({locale:'ar-SA'});
await context.addInitScript(()=>sessionStorage.setItem('nafes_teacher_session_key_v1','qa-test-session'));
const page=await context.newPage();
const roster=[
 {id:'s1',full_name:'اسم متشابه',class_name:'أ',national_id_last3:'111',is_active:true},
 {id:'s2',full_name:'اسم متشابه',class_name:'أ',national_id_last3:'222',is_active:true}
];
const questions=[{id:'pq1',subject:'reading',indicator_key:'reading:x:i1',indicator_text:'مؤشر تجريبي',question:'سؤال تجريبي',options:['أ','ب','ج','د'],answer:0,correct_index:0,correct:true,scorable:true}];
const attempt={id:'paper-a1',source:'assessment',test_id:'paper-test',student_id:'s1',student_name:'اسم متشابه',student_no:'111',class_name:'أ',subjects:['reading'],status:'submitted',submitted_at:'2026-09-14T10:00:00Z',score:1,total:1,percent:100,questions};
await page.route('**/functions/v1/nafes-teacher-profile',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({label:'اختبار آلي',subject_scope:'all'})}));
await page.route('**/functions/v1/nafes-exam',async route=>{
 let body={};try{body=JSON.parse(route.request().postData()||'{}')}catch{}
 if(body.action==='teacher_data')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({attempts:[attempt],tests:[{id:'paper-test',title:'اختبار ورقة تجريبي',subjects:['reading']}],indicators:[],next_cursor:null})});
 if(body.action==='teacher_students_list')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,students:roster})});
 if(body.action==='teacher_paper'&&body.attempt_id==='paper-a1')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({attempt,sections:[{subject:'reading',questions}]})});
 return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'unexpected action'})});
});
await page.goto(`${SITE}student-papers.html`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForSelector('#papersDashboard:not([hidden])',{timeout:30000});
await page.selectOption('#classSelect','أ');
await page.selectOption('#paperSubject','reading');
await page.waitForFunction(()=>[...document.querySelectorAll('#paperTest option')].some(o=>o.value==='paper-test'),null,{timeout:30000});
await page.selectOption('#paperTest','paper-test');
await page.dispatchEvent('#paperTest','change');
await page.waitForSelector('#studentsList table',{timeout:30000});
const buttons=await page.locator('#studentsList .btn-paper').count();
const statuses=await page.locator('#studentsList .badge').allTextContents();
if(buttons!==1)throw new Error(`paper buttons ${buttons}`);
if(statuses.filter(x=>x.includes('مختبر')).length!==1)throw new Error(`tested statuses ${JSON.stringify(statuses)}`);
if(statuses.filter(x=>x.includes('لم يختبر')).length!==1)throw new Error(`non-tested statuses ${JSON.stringify(statuses)}`);
await page.locator('#studentsList .btn-paper').click();
await page.waitForSelector('#paperPanel:not([hidden]) .paper-question',{timeout:30000});
if(await page.locator('#paperPanel .paper-question').count()!==1)throw new Error('paper did not load');
console.log('PASS student_paper_strict_student_id',JSON.stringify({buttons,statuses}));
await browser.close();
