import { chromium } from 'playwright-core';

const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const students=[
  {id:'s1',full_name:'طالب أول',name_normalized:'طالب اول',class_name:'أ',national_id_last3:'123',is_active:true},
  {id:'s2',full_name:'طالب ثان',name_normalized:'طالب ثان',class_name:'ب',national_id_last3:'456',is_active:true},
  {id:'s3',full_name:'طالب ثالث',name_normalized:'طالب ثالث',class_name:'ج',national_id_last3:'789',is_active:true}
];
const attempts=[
  {id:'a1',source:'assessment',test_id:'t1',student_id:'s1',student_name:'طالب أول',student_no:'123',class_name:'أ',subjects:['reading'],status:'submitted',submitted_at:'2026-09-14T10:00:00Z',score:8,total:10,percent:80,questions:[]},
  {id:'a2',source:'exam',test_id:'t1',student_id:null,student_key:'legacy-unlinked',student_name:'طالب ثان',student_no:'456',class_name:'ب',subjects:['reading'],status:'submitted',submitted_at:'2026-09-14T10:05:00Z',score:6,total:10,percent:60,questions:[]}
];
const tests=[{id:'t1',title:'اختبار قراءة تجريبي',kind:'indicator',subjects:['reading'],class_name:'',term:'الفصل الدراسي الأول',total:10}];
const key='a'.repeat(64);
const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--no-sandbox']});
const context=await browser.newContext({locale:'ar-SA'});
const page=await context.newPage();
page.on('dialog',d=>d.accept().catch(()=>{}));

await page.route('**/functions/v1/nafes-teacher-profile',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({label:'اختبار آلي',subject_scope:'all'})}));
await page.route('**/functions/v1/nafes-students-lite',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,students})}));
await page.route('**/functions/v1/nafes-exam',async route=>{
  let body={};try{body=JSON.parse(route.request().postData()||'{}')}catch{}
  if(body.action==='teacher_data')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({attempts,tests,indicators:[],thresholds:{mastered:80,near:70,support:50},next_cursor:null})});
  if(body.action==='teacher_students_list')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,students})});
  return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:`unexpected ${body.action||'action'}`})});
});

const checks=[];
function record(name,detail){checks.push({name,detail});console.log(`PASS ${name} :: ${typeof detail==='string'?detail:JSON.stringify(detail)}`)}
function assert(condition,message){if(!condition)throw new Error(message)}
async function statMap(root){return page.evaluate(sel=>Object.fromEntries([...document.querySelectorAll(`${sel} .sar-stat-list>div`)].map(r=>[r.querySelector('span')?.textContent.trim(),r.querySelector('b')?.textContent.trim()])),root)}
const nf=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1});

try{
  await page.goto(`${SITE}analysis.html#key=${key}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#dashboard:not([hidden])',{timeout:30000});

  await page.click('button[data-view="subject"]');
  await page.selectOption('#subjectSelect','reading');
  await page.waitForFunction(()=>[...document.querySelectorAll('#analysisSubjectTest option')].some(o=>o.value==='t1'),null,{timeout:30000});
  await page.selectOption('#analysisSubjectTest','t1');
  await page.selectOption('#subjectClass','');
  await page.click('#buildSubjectOfficialBtn');
  await page.waitForSelector('#subjectOfficialPreview .official-analysis-sheet',{timeout:30000});
  const official=await statMap('#subjectOfficialPreview');
  assert(official['إجمالي عدد الطلاب']===nf.format(3),`official total ${official['إجمالي عدد الطلاب']}`);
  assert(official['عدد الطلاب المختبرين']===nf.format(2),`official tested ${official['عدد الطلاب المختبرين']}`);
  assert(official['عدد الطلاب الذين لم يختبروا']===nf.format(1),`official absent ${official['عدد الطلاب الذين لم يختبروا']}`);
  const officialText=await page.locator('#subjectOfficialPreview').innerText();
  for(const text of ['المملكة العربية السعودية','وزارة التعليم','الإدارة العامة للتعليم بمنطقة نجران','مدرسة ابن سينا المتوسطة'])assert(officialText.includes(text),`official header missing ${text}`);
  record('official_analysis_participation',official);

  await page.click('button[data-view="subjectReport"]');
  await page.selectOption('#reportSubjectSelect','reading');
  await page.waitForFunction(()=>[...document.querySelectorAll('#reportSubjectTest option')].some(o=>o.value==='t1'),null,{timeout:30000});
  await page.selectOption('#reportSubjectTest','t1');
  await page.selectOption('#reportSubjectClass','');
  await page.click('#buildSubjectReportBtn');
  await page.waitForSelector('#subjectOfficialReport .subject-analysis-sheet',{timeout:30000});
  const subjectText=await page.locator('#subjectOfficialReport').innerText();
  for(const text of ['المملكة العربية السعودية','وزارة التعليم','الإدارة العامة للتعليم بمنطقة نجران'])assert(subjectText.includes(text),`subject report header missing ${text}`);
  assert(subjectText.includes('طالب ثالث'),'subject report should list confirmed non-tester');
  record('subject_report_header_and_absentee','طالب ثالث ظاهر كغير مختبر');

  await page.click('button[data-view="report"]');
  await page.waitForSelector('#reportMultiPicker input[data-test-id="t1"]',{timeout:30000});
  await page.click('#buildReportBtn');
  await page.waitForSelector('#reportPreview .weekly-report.report-sheet',{timeout:30000});
  const kpis=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#reportPreview .wr-kpis article')].map(a=>[a.querySelector('span')?.textContent.trim(),a.querySelector('strong')?.textContent.trim()])));
  assert(kpis['إجمالي الطلاب في الكشف']===nf.format(3),`general total ${kpis['إجمالي الطلاب في الكشف']}`);
  assert(kpis['المختبرون في الاختبارات المحددة']===nf.format(2),`general tested ${kpis['المختبرون في الاختبارات المحددة']}`);
  assert(kpis['لم يظهر لهم أي تسليم']===nf.format(1),`general missing ${kpis['لم يظهر لهم أي تسليم']}`);
  const followText=await page.locator('#reportPreview .wr-follow-sheet').innerText();
  assert(followText.includes('طالب ثان'),'60% student missing from support list');
  assert(!followText.includes('طالب أول'),'80% student incorrectly included in support list');
  record('general_report_participation_and_support',kpis);

  await page.evaluate(()=>{const root=document.querySelector('#printRoot');root.innerHTML=document.querySelector('#reportPreview').innerHTML;root.setAttribute('aria-hidden','false')});
  await page.emulateMedia({media:'print'});
  const printStyle=await page.evaluate(()=>{const td=document.querySelector('#printRoot td'),th=document.querySelector('#printRoot th');const cs=getComputedStyle(td),hs=getComputedStyle(th);return{fontSize:cs.fontSize,lineHeight:cs.lineHeight,border:cs.borderTopWidth,headerFont:hs.fontSize}});
  assert(parseFloat(printStyle.fontSize)>=15.5,`print font too small ${printStyle.fontSize}`);
  assert(parseFloat(printStyle.border)>=1,`print border too thin ${printStyle.border}`);
  record('print_readability',printStyle);

  console.log('CORE_BROWSER_SMOKE',JSON.stringify({passed:checks.length,checks}));
} finally {
  await browser.close();
}
