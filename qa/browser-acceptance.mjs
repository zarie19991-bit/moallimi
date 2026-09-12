import fs from 'node:fs';
import { chromium } from 'playwright-core';

const KEY=process.env.QA_TEACHER_KEY||'';
const SITE='https://zarie19991-bit.github.io/moallimi/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const state=JSON.parse(fs.readFileSync('/tmp/qa-state.json','utf8'));
const checks=[];const failures=[];
function rec(name,ok,detail=''){checks.push({name,ok,detail});if(!ok)failures.push({name,detail});console.log(`${ok?'PASS':'FAIL'} ${name}${detail?` :: ${detail}`:''}`);}
async function check(name,fn){try{const d=await fn();rec(name,true,typeof d==='string'?d:d?JSON.stringify(d):'');}catch(e){rec(name,false,e?.message||String(e));}}
const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--no-sandbox']});
const context=await browser.newContext({locale:'ar-SA'});
const page=await context.newPage();
page.on('dialog',d=>d.accept().catch(()=>{}));

await check('browser_student_page_real_login',async()=>{
 await page.goto(`${SITE}e.html?t=${state.main.code}`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('#identity:not([hidden])',{timeout:30000});
 await page.fill('#studentName',state.mainStudent.full_name);
 await page.fill('#studentNo',state.mainStudent.national_id_last3);
 await page.selectOption('#className',state.mainStudent.class_name);
 await page.click('#startBtn');
 await page.waitForSelector('#player:not([hidden])',{timeout:30000});
 const qText=(await page.locator('#questions').innerText()).trim();if(qText.length<20)throw new Error('questions did not render');
 const wm=(await page.locator('#watermark').innerText()).trim();if(!wm.includes(state.mainStudent.full_name.split(' ')[0]))throw new Error('student watermark missing');
 const shields=await page.evaluate(()=>({copy:document.body.oncopy!==null||true,printShield:!!document.getElementById('printShield')}));
 await page.click('#finish');
 await page.waitForSelector('#result:not([hidden])',{timeout:30000});
 return{question_text_length:qText.length,watermark:wm.slice(0,80),printShield:shields.printShield};
});

await check('browser_create_page_catalog_route',async()=>{
 await page.goto(`${SITE}create.html#key=${KEY}`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('#builder',{timeout:30000});
 await page.waitForFunction(()=>window.NafesTeacher&&window.NafesTeacher.getKey?.(),null,{timeout:30000});
 const data=await page.evaluate(async()=>await window.NafesTeacher.api('teacher_catalog'));
 if(!data||!Array.isArray(data.simulation_indicators)||data.simulation_indicators.length!==270)throw new Error('browser catalog did not return 270 indicators');
 if(Number(data.simulation_summary?.science)<1590)throw new Error(`browser science summary ${JSON.stringify(data.simulation_summary)}`);
 return data.simulation_summary;
});

await check('browser_analysis_participation_and_print',async()=>{
 await page.goto(`${SITE}analysis.html#key=${KEY}`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('#dashboard:not([hidden])',{timeout:30000});
 await page.click('button[data-view="subject"]');
 await page.waitForSelector('#analysisSubjectTest',{timeout:30000});
 await page.selectOption('#subjectSelect','reading');
 await page.waitForFunction(id=>[...document.querySelectorAll('#analysisSubjectTest option')].some(o=>o.value===id),state.main.id,{timeout:30000});
 await page.selectOption('#analysisSubjectTest',state.main.id);
 await page.selectOption('#subjectClass','أ');
 await page.click('#buildSubjectOfficialBtn');
 await page.waitForSelector('#subjectOfficialPreview .subject-analysis-sheet',{timeout:30000});
 await page.waitForFunction(()=>[...document.querySelectorAll('#subjectOfficialPreview .sar-stat-list > div span')].some(x=>x.textContent.trim()==='الطلاب المختبرون'),null,{timeout:30000});
 const info=await page.evaluate(()=>{const sheet=document.querySelector('#subjectOfficialPreview .subject-analysis-sheet');const row=[...sheet.querySelectorAll('.sar-stat-list>div')].find(r=>r.querySelector('span')?.textContent.trim()==='الطلاب المختبرون');const sig=sheet.querySelector('.sar-signatures span');return{row:row?.innerText||'',after:getComputedStyle(sig,'::after').content,before:getComputedStyle(sig,'::before').content};});
 const expected=new Intl.NumberFormat('ar-SA').format(state.classACount);if(!info.row.includes(expected))throw new Error(`participation denominator missing: ${info.row}, expected ${expected}`);if(!['none','normal','""'].includes(info.after)&&info.after!=='')throw new Error(`signature ::after=${info.after}`);if(!['none','normal','""'].includes(info.before)&&info.before!=='')throw new Error(`signature ::before=${info.before}`);
 await page.evaluate(()=>{const src=document.querySelector('#subjectOfficialPreview .subject-analysis-sheet');const root=document.getElementById('printRoot');root.innerHTML=src.outerHTML;root.setAttribute('aria-hidden','false');});
 const pdf='/tmp/qa-analysis.pdf';await page.pdf({path:pdf,format:'A4',printBackground:true,preferCSSPageSize:true});const size=fs.statSync(pdf).size;if(size<15000)throw new Error(`printed PDF too small ${size}`);return{participation:info.row,pdf_bytes:size,after:info.after,before:info.before};
});

await check('browser_student_papers',async()=>{
 await page.goto(`${SITE}student-papers.html#key=${KEY}`,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(name=>document.body.innerText.includes(name),state.mainStudent.full_name,{timeout:30000});
 return'QA student visible in student papers';
});

await check('browser_legacy_exam_page',async()=>{
 const url=state.legacy?.url;if(!url)throw new Error('legacy URL missing');await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});const body=(await page.locator('body').innerText()).trim();if(body.length<50)throw new Error('legacy exam page empty');const retry=await page.evaluate(()=>[...document.scripts].some(s=>String(s.src).includes('edge-retry.js')));if(!retry)throw new Error('edge retry not loaded in legacy exam page');return'legacy page loaded with retry';
});

await browser.close();
fs.writeFileSync('/tmp/qa-browser-result.json',JSON.stringify({checks,failures},null,2));
console.log('BROWSER_ACCEPTANCE_SUMMARY',JSON.stringify({passed:checks.filter(x=>x.ok).length,failed:failures.length,failures}));
