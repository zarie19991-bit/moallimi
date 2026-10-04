import fs from 'node:fs';
import { chromium } from 'playwright-core';

const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const passages=[
 'تبدو الشعاب المرجانية للناظر إليها صخورًا ملونة، لكنها في حقيقتها مستعمرات من كائنات دقيقة تبني هياكل صلبة عبر سنوات طويلة. وتوفر هذه الشعاب موئلًا لعدد كبير من الكائنات البحرية، وتحمي الأسماك الصغيرة، وتوفر الغذاء ومواقع التكاثر. وعلى الرغم من صلابة هياكلها فإن المنظومة شديدة الهشاشة أمام ارتفاع حرارة الماء والتلوث وتغير الظروف البيئية، لذلك يعتمد العلماء على القياسات الدورية والصور لمراقبة صحة الشعاب والحفاظ عليها.',
 'تسهم القراءة الواعية في بناء المعرفة؛ لأنها لا تقتصر على معرفة الكلمات، بل تشمل فهم العلاقات بين الأفكار، واستنتاج المعاني غير المباشرة، والتمييز بين الرأي والحقيقة. وكلما تدرب القارئ على العودة إلى الأدلة داخل النص أصبح أكثر قدرة على الحكم على المعلومات، وربط الأسباب بالنتائج، وتلخيص الأفكار الرئيسة بأسلوب دقيق وواضح.'
];
const indicators=[
 'يحدد الفكرة الرئيسة في النص المقروء.',
 'يستنتج معنى ضمنيًا مستندًا إلى شواهد من النص.',
 'يربط بين السبب والنتيجة في النص.'
];
const questions=[];
let n=0;
for(let p=0;p<2;p++){
 for(let i=0;i<5;i++){
   n++;
   questions.push({
     id:'rq'+n,subject:'reading',indicator:'reading:qa:i'+((i%3)+1),indicator_text:indicators[i%3],
     context:passages[p],
     question:'ما الإجابة الأدق عن الفكرة الواردة في النص وفق الدليل المذكور؟',
     options:['الخيار الأول المرتبط بالنص','الخيار الثاني المرتبط بالنص','الخيار الثالث المرتبط بالنص','الخيار الرابع المرتبط بالنص'],
     correctIndex:i%4
   });
 }
}
const draft={
 review_id:'READING_REVIEW_QA',title:'مراجعة مؤشرات نافس',subject:'reading',subjects:['reading'],
 question_count:10,question_start:1,model_count:1,
 models:[{model:'أ',questions}],assignments:[],
 answer_keys:[{model:'أ',answers:questions.map(q=>({question_id:q.id,correct_index:q.correctIndex,subject:'reading',indicator:q.indicator}))}]
};

const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--no-sandbox']});
try{
 const context=await browser.newContext({locale:'ar-SA'});
 await context.addInitScript(d=>localStorage.setItem('nafes_review_correction_draft',JSON.stringify(d)),draft);
 const page=await context.newPage();
 await page.goto(SITE+'review-question-papers.html?reading-integrity=qa',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('.paper-page',{timeout:30000});
 await page.waitForTimeout(250);

 const screenAudit=await page.evaluate(({passages,indicators})=>{
   const brand=document.querySelector('.exam-brand')?.textContent.trim()||'';
   const strip=document.querySelector('.indicator-review-strip')?.textContent||'';
   const rendered=[...document.querySelectorAll('.passage')].map(x=>x.textContent.trim());
   return{
     brand,strip,
     passage_count:rendered.length,
     all_passages:passages.every(p=>rendered.includes(p)),
     all_indicators:indicators.every(x=>strip.includes(x)),
     page_inner_overflow:getComputedStyle(document.querySelector('.page-inner')).overflow,
     questions_overflow:getComputedStyle(document.querySelector('.questions-flow')).overflow
   };
 },{passages,indicators});
 if(screenAudit.brand!=='اختبار نافس')throw new Error('sanitized reading heading is wrong: '+screenAudit.brand);
 const exportedText=await page.locator('.paper-page').allTextContents();
 if(exportedText.some(x=>/مراجعة مؤشرات نافس/.test(x)))throw new Error('removed review heading leaked into exported paper');
 if(/اختبار القراءة/.test(screenAudit.brand+screenAudit.strip))throw new Error('اختبار القراءة must be removed');
 if(!screenAudit.all_passages||screenAudit.passage_count!==2)throw new Error('reading passage disappeared '+JSON.stringify(screenAudit));
 if(!screenAudit.all_indicators)throw new Error('NAFES indicators are incomplete '+JSON.stringify(screenAudit));
 if(screenAudit.page_inner_overflow!=='visible'||screenAudit.questions_overflow!=='visible')throw new Error('text clipping overflow contract failed '+JSON.stringify(screenAudit));

 await page.emulateMedia({media:'print'});
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 await page.waitForTimeout(150);
 const printAudit=await page.evaluate(()=>{
   const px=n=>parseFloat(n||'0');
   const passage=document.querySelector('.passage'),stem=document.querySelector('.stem'),choices=document.querySelector('.choices');
   const pages=[...document.querySelectorAll('.paper-page')],flows=[...document.querySelectorAll('.questions-flow')];
   return{
    passage_px:px(getComputedStyle(passage).fontSize),stem_px:px(getComputedStyle(stem).fontSize),choices_px:px(getComputedStyle(choices).fontSize),
    overflow:flows.filter(x=>x.scrollHeight>x.clientHeight+2||x.scrollWidth>x.clientWidth+2).length,
    unresolved:pages.filter(x=>x.dataset.layoutUnresolved==='1').length,
    visible_passages:[...document.querySelectorAll('.passage')].every(x=>getComputedStyle(x).overflow==='visible'),
    tail_gaps_px:pages.map((p,i)=>{
      if(i===pages.length-1)return 0;
      const f=p.querySelector('.questions-flow'),last=f?.lastElementChild;
      return f&&last?Math.max(0,f.getBoundingClientRect().bottom-last.getBoundingClientRect().bottom):0;
    }),
    page_layout:pages.map((p,i)=>{
      const f=p.querySelector('.questions-flow');
      return{
        page:i+1,
        class_name:p.className,
        diagnostics:{fill_visits:p.dataset.fillVisits||'',fill_candidates:p.dataset.fillCandidates||'',partial_attempts:p.dataset.partialAttempts||'',partial_result:p.dataset.partialResult||''},
        flow_client_height:f?.clientHeight||0,
        flow_scroll_height:f?.scrollHeight||0,
        groups:[...p.querySelectorAll('.questions-flow > .passage-group')].map(g=>({
          subject:g.dataset.subject||'',
          split:g.dataset.splitReading||'',
          has_passage:!!g.querySelector(':scope > .passage'),
          questions:g.querySelectorAll(':scope > .passage-questions > .question').length,
          height:g.getBoundingClientRect().height,
          passage_height:g.querySelector(':scope > .passage')?.getBoundingClientRect().height||0,
          after_height:g.querySelector(':scope > .after-passage')?.getBoundingClientRect().height||0,
          question_heights:[...g.querySelectorAll(':scope > .passage-questions > .question')].map(q=>q.getBoundingClientRect().height)
        }))
      };
    })
   };
 });
 for(const [k,v] of [['passage',printAudit.passage_px],['stem',printAudit.stem_px],['choices',printAudit.choices_px]]){
   if(Math.abs(v-14.6667)>0.8)throw new Error(k+' must be exactly 11pt; px='+v);
 }
 fs.mkdirSync('qa-output/reading',{recursive:true});
 await page.screenshot({path:'qa-output/reading/reading-review.png',fullPage:true});
 await page.pdf({
   path:'qa-output/reading/reading-review-after.pdf',
   format:'A4',
   printBackground:true,
   preferCSSPageSize:true,
   margin:{top:'0',right:'0',bottom:'0',left:'0'}
 });
 fs.writeFileSync('qa-output/reading/reading-review-audit.json',JSON.stringify({screenAudit,printAudit},null,2));

 if(printAudit.overflow||printAudit.unresolved||!printAudit.visible_passages)throw new Error('reading print integrity failed '+JSON.stringify(printAudit));
 console.log('READING_LAYOUT_DEBUG '+JSON.stringify(printAudit.page_layout));
  const maxReadingTailGap=Math.max(0,...printAudit.tail_gaps_px);
 if(maxReadingTailGap>140)throw new Error('reading page has excessive blank tail '+maxReadingTailGap+'px');
 console.log('PASS reading NAFES review integrity QA '+JSON.stringify({screenAudit,printAudit}));
}finally{await browser.close();}
