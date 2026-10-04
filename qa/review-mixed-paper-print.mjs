import fs from 'node:fs';
import { chromium } from 'playwright-core';

const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';

const opts=['الخيار الأول','الخيار الثاني','الخيار الثالث','الخيار الرابع'];
const questions=[];
let n=0;
for(let i=0;i<20;i++){
  n++;questions.push({id:'s'+n,subject:'science',indicator:'science:qa:i1',indicator_text:'مؤشر علوم',context:'',question:'سؤال علوم تقويمي واضح رقم '+(i+1)+' يختبر المفهوم دون نص إضافي.',options:opts,correctIndex:i%4});
}
for(let i=0;i<20;i++){
  n++;questions.push({id:'m'+n,subject:'math',indicator:'math:qa:i1',indicator_text:'مؤشر رياضيات',context:'',question:'سؤال رياضيات تقويمي واضح رقم '+(i+1)+' مع معطيات مختصرة مناسبة للطباعة.',options:opts,correctIndex:i%4});
}
const passageBase=[
 'تتابع المدرسة استهلاك المياه أسبوعيًا باستخدام قراءات منتظمة للعداد، وتقارن القيم الجديدة بخط أساس معروف. وعندما يظهر تغير غير معتاد يبدأ الفريق بفحص الفروع بالتتابع حتى يحدد مصدر الخلل، ثم يوثق الإجراء والنتيجة ويعيد القياس بعد الإصلاح للتأكد من استمرار التحسن.',
 'استخدم الطلاب منصة رقمية لتنظيم الملاحظات بحسب المادة والموضوع، ثم قارنوا بين النسخ الحرفي والتلخيص النشط. أظهرت التجربة أن تنظيم الكلمات المفتاحية وربط الأفكار يسهل الاسترجاع ويقلل الوقت الضائع، بينما تبقى الأداة وسيلة مساعدة ولا تنوب عن الفهم.',
 'راقب فريق بيئي منطقة ساحلية عدة أشهر وسجل تغيرات الحرارة وكثافة الكائنات ومعدلات النمو. ساعدت السجلات المتتابعة على التمييز بين التغير المؤقت والاتجاه المستمر، كما أتاحت مقارنة النتائج قبل الإجراء وبعده وتحديد أثر العوامل المختلفة.',
 'عمل فريق ترميم على مبنى تراثي فبدأ بالتوثيق والتصوير ورسم المخطط، ثم عالج الشقوق وثبت العناصر السليمة واستبدل المتآكل فقط. كان الهدف المحافظة على أصالة المبنى مع رفع سلامته، لذلك سجل الفريق كل قرار وأعد خطة صيانة دورية.'
];
for(let p=0;p<4;p++){
  const ctx=passageBase[p]+' '+passageBase[p];
  for(let i=0;i<5;i++){
    n++;questions.push({
      id:'r'+n,subject:'reading',indicator:'reading:qa:i'+(p+1),indicator_text:'مؤشر قراءة '+(p+1),
      context:ctx,question:'أي إجابة أدق وفق النص في السؤال '+(i+1)+'؟',options:opts,correctIndex:(p+i)%4
    });
  }
}
const draft={
  review_id:'MIXED_60_QA',title:'اختبار نافس',subject:'science',subjects:['science','math','reading'],
  question_count:60,question_start:1,model_count:1,
  models:[{model:'أ',questions}],assignments:[],
  answer_keys:[{model:'أ',answers:questions.map(q=>({question_id:q.id,correct_index:q.correctIndex,subject:q.subject,indicator:q.indicator}))}]
};

const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--no-sandbox']});
try{
  const context=await browser.newContext({locale:'ar-SA'});
  await context.addInitScript(d=>localStorage.setItem('nafes_review_correction_draft',JSON.stringify(d)),draft);
  const page=await context.newPage();
  await page.goto(SITE+'review-question-papers.html?mixed-60=qa',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('.paper-page',{timeout:30000});
  await page.waitForTimeout(700);

  const redundantUpper=await page.locator('.exam-frame-head .exam-brand').allTextContents();
  if(redundantUpper.some(x=>/اختبار\s+العلوم\s*\+\s*الرياضيات\s*\+\s*القراءة/.test(x)))throw new Error('redundant upper mixed title still rendered: '+JSON.stringify(redundantUpper));
  const stripText=await page.locator('.title-strip').first().textContent();
  if(!/اختبار نافس/.test(stripText||'')||!/المادة:/.test(stripText||''))throw new Error('mixed title strip is incomplete: '+stripText);

  const audit=await page.evaluate(()=>{
    const readingGroups=[...document.querySelectorAll('.passage-group[data-subject="reading"]')].filter(g=>g.querySelector(':scope > .passage'));
    const allQuestions=document.querySelectorAll('.question').length;
    const error=document.querySelector('.error-page,.layout-error')?.textContent||'';
    const pages=[...document.querySelectorAll('.paper-page')];
    const finalQuestions=pages.at(-1)?.querySelectorAll('.question').length||0;
    return{
      error,
      total_questions:allQuestions,
      page_count:pages.length,
      reading_passages:readingGroups.length,
      reading_counts:readingGroups.map(g=>g.querySelectorAll(':scope > .passage-questions > .question').length),
      final_page_questions:finalQuestions
    };
  });

  if(audit.error)throw new Error('mixed paper rendered layout error: '+audit.error);
  if(audit.total_questions!==60)throw new Error('mixed paper must contain 60 questions '+JSON.stringify(audit));
  if(audit.reading_passages!==4)throw new Error('mixed reading must contain four passages '+JSON.stringify(audit));
  if(audit.reading_counts.some(n=>n!==5))throw new Error('each mixed reading passage must have five questions '+JSON.stringify(audit));

  await page.evaluate(()=>{window.print=()=>{};document.getElementById('printBtn')?.click();});
  await page.waitForTimeout(250);
  const metrics=await page.evaluate(()=>JSON.parse(localStorage.getItem('nafes_question_paper_last_print_metrics')||'null'));
  if(!metrics)throw new Error('missing print metrics');
  if(metrics.details.some(x=>x.unresolved||x.overflow_y_px>2||x.overflow_x_px>2||x.hidden_text_nodes>0||x.avoidable_large_gap)){
    throw new Error('mixed 60 print did not stabilize '+JSON.stringify(metrics));
  }

  fs.mkdirSync('qa-output/mixed-60',{recursive:true});
  await page.screenshot({path:'qa-output/mixed-60/mixed-60-after.png',fullPage:true});
  await page.emulateMedia({media:'print'});
  await page.pdf({path:'qa-output/mixed-60/mixed-60-after.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
  fs.writeFileSync('qa-output/mixed-60/mixed-60-audit.json',JSON.stringify({audit,metrics},null,2));
  console.log('PASS mixed 60 paper QA '+JSON.stringify({audit,metrics}));
}finally{
  await browser.close();
}
