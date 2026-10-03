import fs from 'node:fs';
import { webkit } from 'playwright';

const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const stem='اقرأ السؤال الآتي بعناية، ثم اختر الإجابة الأدق التي تحقق المطلوب وفق المعطيات المذكورة في السؤال دون الاعتماد على التخمين.';
const questions=Array.from({length:15},(_,i)=>({
  id:'wq'+(i+1),subject:'math',indicator:'math:qa:i1',indicator_text:'مؤشر تجريبي للطباعة',
  context:'',question:(i+1)+'. '+stem+' القيمة التجريبية رقم '+(i+1)+'؟',
  options:['الخيار الأول بصياغة واضحة ومقروءة','الخيار الثاني بصياغة واضحة ومقروءة','الخيار الثالث بصياغة واضحة ومقروءة','الخيار الرابع بصياغة واضحة ومقروءة'],
  correctIndex:i%4
}));
const draft={
  review_id:'RQA_WEBKIT',title:'اختبار تجريبي للطباعة A4',subject:'math',subjects:['math'],
  class_name:'أ',question_count:15,question_start:1,model_count:1,
  models:[{model:'أ',questions}],
  assignments:[{sheet_no:1,student_id:'s1',student_name:'طالب تجريبي',class_name:'أ',model:'أ'}],
  answer_keys:[{model:'أ',answers:questions.map(q=>({question_id:q.id,correct_index:q.correctIndex,subject:'math',indicator:q.indicator}))}]
};

const browser=await webkit.launch({headless:true});
try{
  const context=await browser.newContext({locale:'ar-SA'});
  await context.addInitScript(d=>localStorage.setItem('nafes_review_correction_draft',JSON.stringify(d)),draft);
  const page=await context.newPage();
  await page.goto(SITE+'review-question-papers.html?webkit=qa',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('.paper-page',{timeout:30000});

  // زر الطباعة نفسه: WebKit يجب أن يصل إلى الاستدعاء بعد إزالة وسم فشل قديم.
  await page.evaluate(()=>{
    document.querySelector('.paper-page')?.setAttribute('data-layout-unresolved','1');
    window.__printCalls=0;
    window.print=()=>{window.__printCalls++;};
  });
  await page.click('#printBtn');
  await page.waitForTimeout(150);
  const buttonCalls=await page.evaluate(()=>window.__printCalls||0);
  if(buttonCalls!==1)throw new Error('WebKit print button calls '+buttonCalls);
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));

  await page.emulateMedia({media:'print'});
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  await page.waitForTimeout(120);

  const audit=await page.evaluate(()=>{
    const pxPerMm=96/25.4;
    const pages=[...document.querySelectorAll('.paper-page')];
    const flows=[...document.querySelectorAll('.questions-flow')];
    const r=pages[0]?.getBoundingClientRect();
    const stem=document.querySelector('.stem'),choices=document.querySelector('.choices');
    const tail=pages.map((p,i)=>{
      if(i===pages.length-1)return 0;
      const f=p.querySelector('.questions-flow'),last=f?.lastElementChild;
      return f&&last?Math.max(0,f.getBoundingClientRect().bottom-last.getBoundingClientRect().bottom):0;
    });
    return{
      page_count:pages.length,
      page_width_mm:r?r.width/pxPerMm:0,
      page_height_mm:r?r.height/pxPerMm:0,
      overflow:flows.filter(x=>x.scrollHeight>x.clientHeight+2||x.scrollWidth>x.clientWidth+2).length,
      unresolved:pages.filter(x=>x.dataset.layoutUnresolved==='1').length,
      stem_px:stem?parseFloat(getComputedStyle(stem).fontSize):0,
      choice_px:choices?parseFloat(getComputedStyle(choices).fontSize):0,
      max_tail_gap_px:Math.max(0,...tail)
    };
  });

  const near=(v,t,tol)=>Math.abs(v-t)<=tol;
  if(!near(audit.page_width_mm,198,1))throw new Error('WebKit A4 width '+audit.page_width_mm);
  if(!near(audit.page_height_mm,285,1))throw new Error('WebKit A4 height '+audit.page_height_mm);
  if(audit.overflow!==0)throw new Error('WebKit overflow '+audit.overflow);
  if(audit.unresolved!==0)throw new Error('WebKit unresolved '+audit.unresolved);
  if(audit.stem_px<18||audit.choice_px<16)throw new Error('WebKit print font too small '+JSON.stringify(audit));
  if(audit.max_tail_gap_px>150)throw new Error('WebKit excessive tail gap '+audit.max_tail_gap_px);
  if(audit.page_count<2||audit.page_count>3)throw new Error('WebKit unexpected pagination '+audit.page_count);

  fs.mkdirSync('qa-output/webkit',{recursive:true});
  await page.screenshot({path:'qa-output/webkit/webkit-layout.png',fullPage:true});
  fs.writeFileSync('qa-output/webkit/webkit-audit.json',JSON.stringify(audit,null,2));
  console.log('PASS WebKit Safari-engine paper QA '+JSON.stringify(audit));
}finally{
  await browser.close();
}
