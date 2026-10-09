import { chromium } from 'playwright-core';

const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const ONLY=process.env.QA_SMOKE_ONLY||'all';
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
const nf=new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1});
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

function assert(condition,message){if(!condition)throw new Error(message)}
function pass(name,detail){console.log(`PASS ${name} :: ${typeof detail==='string'?detail:JSON.stringify(detail)}`)}
async function openAnalysis(){
  await page.emulateMedia({media:'screen'});
  await page.goto(`${SITE}analysis.html#key=${key}`,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#dashboard:not([hidden])',{timeout:30000});
}
async function statMap(root){return page.evaluate(sel=>Object.fromEntries([...document.querySelectorAll(`${sel} .sar-stat-list>div`)].map(r=>[r.querySelector('span')?.textContent.trim(),r.querySelector('b')?.textContent.trim()])),root)}

async function officialAnalysis(){
  await openAnalysis();
  const debug=await page.evaluate(async()=>{
    const roster=await window.NafesTeacher.api('teacher_students_list',{include_archived:false});
    const data=await window.NafesTeacher.api('teacher_data',{cursor:0,limit:100});
    const groups=window.NafesReportAbsentees?.groups?.({roster:roster.students,attempts:data.attempts,tests:data.tests,selectedIds:['t1'],className:'',subject:'reading'})||[];
    return {
      roster:(roster.students||[]).map(s=>({id:s.id,name:s.full_name,className:s.class_name,last3:s.national_id_last3})),
      attempts:(data.attempts||[]).map(a=>({id:a.id,student_id:a.student_id,student_key:a.student_key,name:a.student_name,className:a.class_name,no:a.student_no,test_id:a.test_id,status:a.status})),
      group:groups[0]||null
    };
  });
  console.log('DEBUG_OFFICIAL_PARTICIPATION',JSON.stringify(debug));
  await page.click('button[data-view="subject"]');
  await page.selectOption('#subjectSelect','reading');
  await page.waitForFunction(()=>[...document.querySelectorAll('#analysisSubjectTest option')].some(o=>o.value==='t1'),null,{timeout:30000});
  await page.selectOption('#analysisSubjectTest','t1');
  await page.selectOption('#subjectClass','');
  await page.click('#buildSubjectOfficialBtn');
  await page.waitForSelector('#subjectOfficialPreview .official-analysis-sheet',{timeout:30000});
  const stats=await statMap('#subjectOfficialPreview');
  console.log('DEBUG_OFFICIAL_STATS',JSON.stringify(stats));
  assert(stats['إجمالي عدد الطلاب']===nf.format(3),`official total ${stats['إجمالي عدد الطلاب']}`);
  assert(stats['عدد الطلاب المختبرين']===nf.format(2),`official tested ${stats['عدد الطلاب المختبرين']} group=${JSON.stringify(debug.group)}`);
  assert(stats['عدد الطلاب الذين لم يختبروا']===nf.format(1),`official absent ${stats['عدد الطلاب الذين لم يختبروا']}`);
  const text=await page.locator('#subjectOfficialPreview').innerText();
  for(const required of ['المملكة العربية السعودية','وزارة التعليم','الإدارة العامة للتعليم بمنطقة نجران','مدرسة ابن سينا المتوسطة'])assert(text.includes(required),`official header missing ${required}`);
  pass('official_analysis_participation',stats);
}

async function subjectReport(){
  await openAnalysis();
  await page.click('button[data-view="subjectReport"]');
  await page.selectOption('#reportSubjectSelect','reading');
  await page.waitForFunction(()=>[...document.querySelectorAll('#reportSubjectTest option')].some(o=>o.value==='t1'),null,{timeout:30000});
  await page.selectOption('#reportSubjectTest','t1');
  await page.selectOption('#reportSubjectClass','');
  await page.click('#buildSubjectReportBtn');
  await page.waitForSelector('#subjectOfficialReport .subject-analysis-sheet',{timeout:30000});
  const text=await page.locator('#subjectOfficialReport').innerText();
  for(const required of ['المملكة العربية السعودية','وزارة التعليم','الإدارة العامة للتعليم بمنطقة نجران'])assert(text.includes(required),`subject report header missing ${required}`);
  assert(text.includes('طالب ثالث'),'subject report should list confirmed non-tester');
  pass('subject_report_header_and_absentee','طالب ثالث ظاهر كغير مختبر');
}

async function buildGeneral(){
  await openAnalysis();
  await page.click('button[data-view="report"]');
  await page.waitForSelector('#reportMultiPicker input[data-test-id="t1"]',{timeout:30000});
  await page.click('#buildReportBtn');
  await page.waitForSelector('#reportPreview .weekly-report.report-sheet',{timeout:30000});
}
async function generalReport(){
  await buildGeneral();
  const kpis=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#reportPreview .wr-kpis article')].map(a=>[a.querySelector('span')?.textContent.trim(),a.querySelector('strong')?.textContent.trim()])));
  assert(kpis['إجمالي الطلاب في الكشف']===nf.format(3),`general total ${kpis['إجمالي الطلاب في الكشف']}`);
  assert(kpis['المختبرون في الاختبارات المحددة']===nf.format(2),`general tested ${kpis['المختبرون في الاختبارات المحددة']}`);
  assert(kpis['لم يظهر لهم أي تسليم']===nf.format(1),`general missing ${kpis['لم يظهر لهم أي تسليم']}`);
  const followText=await page.locator('#reportPreview .wr-follow-sheet').innerText();
  assert(followText.includes('طالب ثان'),'60% student missing from support list');
  assert(!followText.includes('طالب أول'),'80% student incorrectly included in support list');
  pass('general_report_participation_and_support',kpis);
}

async function printReadability(){
  await buildGeneral();
  await page.evaluate(()=>{const root=document.querySelector('#printRoot');root.innerHTML=document.querySelector('#reportPreview').innerHTML;root.setAttribute('aria-hidden','false')});
  await page.emulateMedia({media:'print'});
  const style=await page.evaluate(()=>{const td=document.querySelector('#printRoot td'),th=document.querySelector('#printRoot th');if(!td||!th)throw new Error('print table not rendered');const cs=getComputedStyle(td),hs=getComputedStyle(th);return{fontSize:cs.fontSize,lineHeight:cs.lineHeight,border:cs.borderTopWidth,headerFont:hs.fontSize}});
  assert(parseFloat(style.fontSize)>=15.5,`print font too small ${style.fontSize}`);
  assert(parseFloat(style.border)>=1,`print border too thin ${style.border}`);
  pass('print_readability',style);
}

try{
  if(ONLY==='all'||ONLY==='official')await officialAnalysis();
  if(ONLY==='all'||ONLY==='subject-report')await subjectReport();
  if(ONLY==='all'||ONLY==='general')await generalReport();
  if(ONLY==='all'||ONLY==='print')await printReadability();
} finally {
  await browser.close();
}
