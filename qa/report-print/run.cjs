/* Isolated browser QA. No production secrets or remote data are used. */
const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||'.'),out=path.resolve(process.argv[3]||'qa/report-print/output/after');
const baseline=process.argv.includes('--baseline');
const subjects=['reading','math','science'];
const students=Array.from({length:140},(_,i)=>({id:`s${i}`,full_name:`محمد عبدالله التجريبي ${i+1}`,class_name:['أ','ب','ج','د'][i%4],national_id_last3:String(100+i),is_active:true}));
const tests=subjects.map(s=>({id:s,title:`اختبار تجريبي ${s}`,subjects:[s],kind:'indicator',term:'الفصل الدراسي الأول',total:12}));
const attempts=subjects.flatMap(subject=>students.slice(0,72).map((s,i)=>({id:`${subject}-${i}`,source:'assessment',test_id:subject,student_id:s.id,student_name:s.full_name,student_no:s.national_id_last3,class_name:s.class_name,subjects:[subject],status:'submitted',submitted_at:'2026-09-27T08:00:00Z',score:4,total:12,percent:100/3,section_scores:[{subject,score:4,total:12,percent:100/3}],questions:Array.from({length:5},(_,j)=>({id:`q${j}`,subject,indicator_key:`${subject}:i${j}`,indicator_text:`مهارة تجريبية ${j+1} فهم المعلومات وتطبيق المعرفة في مواقف جديدة`,question:'سؤال تجريبي',options:['أ','ب','ج','د'],answer:0,correct_index:0,correct:j<3,scorable:true}))})));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!p.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(await fs.readFile(p));}catch{res.writeHead(404);res.end();}});
(async()=>{
 await fs.mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const site=`http://127.0.0.1:${server.address().port}/`;
 const browser=await chromium.launch({headless:true});
 const results=[];
 try{
 for(const name of ['general','subject','official','absentees','remedial']){
  const context=await browser.newContext({locale:'ar-SA',viewport:{width:1200,height:900}});
  const page=await context.newPage();
  await context.addInitScript(()=>{
   window.print=()=>{window.__printCalled=true;window.dispatchEvent(new Event('beforeprint'));};
   localStorage.setItem('nafes_school_report_settings_v1',JSON.stringify({schoolName:'مدرسة اختبار الطباعة',teacherName:'معلم تجريبي',principalName:'مدير تجريبي'}));
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.route('**/*',async route=>{
   const url=route.request().url();
   const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(url.includes('/functions/v1/nafes-teacher-profile'))return json({label:'اختبار آلي',subject_scope:'all'});
   if(url.includes('/functions/v1/nafes-students-lite'))return json({ok:true,students});
   if(url.includes('/functions/v1/nafes-exam')){
    const body=JSON.parse(route.request().postData()||'{}');
    if(body.action==='teacher_data')return json({attempts,tests,indicators:[],next_cursor:null});
    if(body.action==='teacher_students_list')return json({ok:true,students});
    throw Error(`Unexpected API action: ${body.action}`);
   }
   if(url.startsWith(site))return route.continue();
   // The broken historical renderer is deliberately blocked in the baseline
   // too: it cannot parse, and the functioning production fallback uses printRoot.
   return route.abort();
  });
  await page.goto(`${site}analysis.html#key=${'a'.repeat(64)}`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#dashboard:not([hidden])');
  // Baseline main still requires the legacy manual date field before print.
  // Populate it when present so the baseline can reach window.print().
  await page.evaluate(()=>{
   const input=document.querySelector('#manualPrintDate');
   if(input){
    const d=new Date(),pad=n=>String(n).padStart(2,'0');
    input.value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
   }
  });
  if(name==='official'){
   await page.waitForFunction(()=>document.querySelector('#analysisReadingTest')?.value==='reading');
   await page.click('#printOverviewAnalysisBtn');
  }else if(name==='subject'||name==='absentees'){
   await page.click('[data-view="subjectReport"]');
   await page.waitForFunction(()=>[...document.querySelectorAll('#reportSubjectTest option')].some(o=>o.value==='reading'));
   await page.selectOption('#reportSubjectTest','reading');await page.click('#buildSubjectReportBtn');
   await page.waitForSelector('#subjectOfficialReport .na-table');await page.click('#printSubjectReportBtn');
  }else{
   await page.click('[data-view="report"]');await page.waitForSelector('#reportMultiPicker input[data-test-id]');
   await page.click('#buildReportBtn');await page.waitForSelector('#reportPreview .wr-remedial tbody tr');
   await page.click('#printReportBtn');
  }
  await page.waitForFunction(()=>window.__printCalled&&document.querySelector('#printRoot')?.children.length>0);
  // Isolated exports of the actual generated subsection, not replacement templates.
  if(name==='absentees')await page.evaluate(()=>document.querySelectorAll('#printRoot > :not(.nafes-absence-sheet)').forEach(x=>x.remove()));
  if(name==='remedial')await page.evaluate(()=>{const root=document.querySelector('#printRoot'),sheet=root.querySelector('.wr-follow-sheet'),plan=sheet.querySelector('.wr-remedial').cloneNode(true),sig=sheet.querySelector('.wr-signatures')?.cloneNode(true);root.replaceChildren(sheet);sheet.replaceChildren(plan);if(sig)sheet.append(sig);});
  await page.emulateMedia({media:'print'});await page.evaluate(()=>document.fonts.ready);
  const info=await page.evaluate(()=>{
   const root=document.querySelector('#printRoot'),tables=[];
   const marker=(text)=>{const s=document.createElement('span');s.textContent=text;s.style.cssText='font:1px/1px Arial!important;display:block!important;color:#333!important';return s;};
   root.querySelectorAll('table').forEach((table,i)=>{
    const id=`T${String(i).padStart(3,'0')}`,rows=[];
    table.querySelector('thead th')?.prepend(marker(`${id}HEAD`));
    table.querySelectorAll('tbody tr').forEach((tr,j)=>{const key=`${id}R${String(j).padStart(3,'0')}`;tr.firstElementChild.prepend(marker(`${key}START`));tr.lastElementChild.append(marker(`${key}END`));rows.push(key);});
    tables.push({id,rows});
   });
   const sheets=[...root.children].map(e=>{const c=getComputedStyle(e);return{className:e.className,zoom:c.zoom,breakAfter:c.breakAfter,minHeight:c.minHeight,maxHeight:c.maxHeight,width:c.width};});
   const big=[...root.querySelectorAll('.sar-analysis-grid,.sar-stats,.sar-achievement,.wr-focus,.wr-performance,.wr-remedial,table,tbody')].map(e=>({class:e.className,inside:getComputedStyle(e).breakInside}));
   const small=[...root.querySelectorAll('.sar-chart-card,.wr-indicator-card,.wr-callout')].map(e=>({class:e.className,inside:getComputedStyle(e).breakInside}));
   const fonts=[...root.querySelectorAll('td,th')].map(e=>getComputedStyle(e).fontSize);
   return{tables,sheets,big,small,fonts,readabilityMedia:document.querySelector('link[href*="report-readability.css"]').media,scaleGuard:!!document.querySelector('#analysisPrintScaleTune')};
  });
  await fs.writeFile(path.join(out,`${name}.json`),JSON.stringify(info,null,2));
  await page.pdf({path:path.join(out,`${name}.pdf`),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
  if(!baseline){
   assert(!info.scaleGuard,'runtime 80% scaling returned');assert.notEqual(info.readabilityMedia,'screen');
   assert(info.sheets.every(s=>Number(s.zoom)===1&&s.breakAfter==='auto'&&s.minHeight==='0px'&&s.maxHeight==='none'),JSON.stringify(info.sheets));
   assert(info.big.every(s=>s.inside==='auto'),JSON.stringify(info.big.filter(s=>s.inside!=='auto')));
   assert(info.small.every(s=>['avoid','avoid-page'].includes(s.inside)),JSON.stringify(info.small.filter(s=>!['avoid','avoid-page'].includes(s.inside))));
   assert(info.fonts.every(s=>parseFloat(s)>=16),`Small table font: ${Math.min(...info.fonts.map(parseFloat))}`);
   assert(!errors.length,errors.join('\n'));
  }
  results.push({name,generated:true,errors});await context.close();
 }
 }finally{await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
