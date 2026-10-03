import fs from 'node:fs';
import { chromium } from 'playwright-core';

const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';

const longStem='اقرأ السؤال الآتي بعناية، ثم اختر الإجابة الأدق التي تحقق المطلوب وفق المعطيات المذكورة في السؤال دون الاعتماد على التخمين.';
const questions=Array.from({length:15},(_,i)=>({
  id:'q'+(i+1),
  subject:'math',
  indicator:'math:qa:i1',
  indicator_text:'مؤشر تجريبي للطباعة',
  context:'',
  question:(i+1)+'. '+longStem+' القيمة التجريبية رقم '+(i+1)+'؟',
  options:[
    'الخيار الأول بصياغة واضحة ومقروءة',
    'الخيار الثاني بصياغة واضحة ومقروءة',
    'الخيار الثالث بصياغة واضحة ومقروءة',
    'الخيار الرابع بصياغة واضحة ومقروءة'
  ],
  correctIndex:i%4
}));
const draft={
  review_id:'RQA_PRINT_1',
  title:'اختبار تجريبي للطباعة A4',
  subject:'math',
  subjects:['math'],
  class_name:'أ',
  question_count:15,
  question_start:1,
  model_count:1,
  models:[{model:'أ',questions}],
  assignments:[{sheet_no:1,student_id:'s1',student_name:'طالب تجريبي',class_name:'أ',model:'أ'}],
  answer_keys:[{model:'أ',answers:questions.map(q=>({question_id:q.id,correct_index:q.correctIndex,subject:'math',indicator:q.indicator}))}]
};

const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--no-sandbox']});
const context=await browser.newContext({locale:'ar-SA'});
await context.addInitScript(d=>{
  localStorage.setItem('nafes_review_correction_draft',JSON.stringify(d));
},draft);
const page=await context.newPage();
await page.goto(SITE+'review-question-papers.html?pv=qa-print',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForSelector('.paper-page',{timeout:30000});

// UAT آلي لزر الطباعة نفسه، مع محاكاة وسم فشل قديم كان يعطل الزر.
await page.evaluate(()=>{
  const first=document.querySelector('.paper-page');
  if(first)first.dataset.layoutUnresolved='1';
  window.__printCalls=0;
  window.print=()=>{window.__printCalls++;};
});
await page.click('#printBtn');
await page.waitForTimeout(150);
const buttonAudit=await page.evaluate(()=>({
  calls:window.__printCalls||0,
  stale_unresolved:document.querySelector('.paper-page')?.dataset.layoutUnresolved==='1',
  disabled:document.getElementById('printBtn')?.disabled===true
}));
if(buttonAudit.calls!==1)throw new Error('print button did not call window.print exactly once: '+JSON.stringify(buttonAudit));
if(buttonAudit.stale_unresolved)throw new Error('stale unresolved flag still blocks print');
await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));

await page.emulateMedia({media:'print'});
await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
await page.waitForTimeout(150);

const audit=await page.evaluate(()=>{
  const pxPerMm=96/25.4;
  const pages=[...document.querySelectorAll('.paper-page')];
  const inners=[...document.querySelectorAll('.page-inner')];
  const flows=[...document.querySelectorAll('.questions-flow')];
  const stem=document.querySelector('.stem');
  const choices=document.querySelector('.choices');
  const pageRects=pages.map(x=>x.getBoundingClientRect());
  const innerRects=inners.map(x=>x.getBoundingClientRect());
  return{
    page_count:pages.length,
    page_width_mm:pageRects[0]?.width/pxPerMm||0,
    page_height_mm:pageRects[0]?.height/pxPerMm||0,
    inner_width_mm:innerRects[0]?.width/pxPerMm||0,
    inner_height_mm:innerRects[0]?.height/pxPerMm||0,
    stem_font_px:stem?parseFloat(getComputedStyle(stem).fontSize):0,
    choices_font_px:choices?parseFloat(getComputedStyle(choices).fontSize):0,
    overflow_pages:flows.filter(x=>x.scrollHeight>x.clientHeight+2||x.scrollWidth>x.clientWidth+2).length,
    unresolved_pages:pages.filter(x=>x.dataset.layoutUnresolved==='1').length,
    tail_gaps_px:pages.map((page,i)=>{
      const flow=page.querySelector('.questions-flow');
      const last=flow?.lastElementChild;
      if(!flow||!last||i===pages.length-1)return 0;
      return Math.max(0,flow.getBoundingClientRect().bottom-last.getBoundingClientRect().bottom);
    }),
    body_scroll_width:document.body.scrollWidth,
    viewport_width:document.documentElement.clientWidth
  };
});

const near=(v,target,tol)=>Math.abs(v-target)<=tol;
if(!near(audit.page_width_mm,198,0.8))throw new Error('print page width '+audit.page_width_mm);
if(!near(audit.page_height_mm,285,0.8))throw new Error('print page height '+audit.page_height_mm);
if(!near(audit.inner_width_mm,198,0.8))throw new Error('inner width '+audit.inner_width_mm);
if(!near(audit.inner_height_mm,285,0.8))throw new Error('inner height '+audit.inner_height_mm);
if(audit.stem_font_px<18)throw new Error('question font too small '+audit.stem_font_px);
if(audit.choices_font_px<16)throw new Error('choice font too small '+audit.choices_font_px);
if(audit.overflow_pages!==0)throw new Error('overflow pages '+audit.overflow_pages);
if(audit.unresolved_pages!==0)throw new Error('unresolved pages '+audit.unresolved_pages);
const maxTailGap=Math.max(0,...audit.tail_gaps_px);
if(maxTailGap>150)throw new Error('excessive blank tail space '+maxTailGap+'px');
if(audit.page_count<2)throw new Error('large-font pagination did not add pages');

fs.mkdirSync('qa-output',{recursive:true});
await page.screenshot({path:'qa-output/question-paper-print.png',fullPage:true});
fs.writeFileSync('qa-output/question-paper-audit.json',JSON.stringify(audit,null,2));
console.log('PASS question paper A4 browser QA',JSON.stringify(audit));
await browser.close();
