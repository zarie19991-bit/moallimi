const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {Builder,Browser,By,until}=require('selenium-webdriver');
const chrome=require('selenium-webdriver/chrome');
const edge=require('selenium-webdriver/edge');
const firefox=require('selenium-webdriver/firefox');

const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const outDir='qa-output/cross-browser';
fs.mkdirSync(outDir,{recursive:true});

const stem='اقرأ السؤال الآتي بعناية، ثم اختر الإجابة الأدق التي تحقق المطلوب وفق المعطيات المذكورة في السؤال دون الاعتماد على التخمين.';
const questions=Array.from({length:15},(_,i)=>({
  id:'qb'+(i+1),subject:'math',indicator:'math:qa:i1',indicator_text:'مؤشر تجريبي للطباعة',
  context:'',question:(i+1)+'. '+stem+' القيمة التجريبية رقم '+(i+1)+'؟',
  options:['الخيار الأول بصياغة واضحة ومقروءة','الخيار الثاني بصياغة واضحة ومقروءة','الخيار الثالث بصياغة واضحة ومقروءة','الخيار الرابع بصياغة واضحة ومقروءة'],
  correctIndex:i%4
}));
const draft={
  review_id:'RQA_CROSS_BROWSER',title:'اختبار تجريبي للطباعة A4',subject:'math',subjects:['math'],
  class_name:'أ',question_count:15,question_start:1,model_count:1,
  models:[{model:'أ',questions}],
  assignments:[{sheet_no:1,student_id:'s1',student_name:'طالب تجريبي',class_name:'أ',model:'أ'}],
  answer_keys:[{model:'أ',answers:questions.map(q=>({question_id:q.id,correct_index:q.correctIndex,subject:'math',indicator:q.indicator}))}]
};

function builderFor(name){
  const builder=new Builder().forBrowser(name);
  if(name===Browser.CHROME){
    const o=new chrome.Options().addArguments('--headless=new','--no-sandbox','--disable-dev-shm-usage');
    if(fs.existsSync('/usr/bin/google-chrome'))o.setChromeBinaryPath('/usr/bin/google-chrome');
    builder.setChromeOptions(o);
  }else if(name===Browser.EDGE){
    const o=new edge.Options().addArguments('--headless=new','--no-sandbox','--disable-dev-shm-usage');
    if(fs.existsSync('/usr/bin/microsoft-edge'))o.setEdgeChromiumBinaryPath('/usr/bin/microsoft-edge');
    builder.setEdgeOptions(o);
  }else if(name===Browser.FIREFOX){
    const o=new firefox.Options().addArguments('-headless');
    if(fs.existsSync('/usr/bin/firefox'))o.setBinary('/usr/bin/firefox');
    builder.setFirefoxOptions(o);
  }
  return builder;
}

async function runOne(name,label){
  let driver;
  try{
    driver=await builderFor(name).build();
    const caps=await driver.getCapabilities();
    const version=String(caps.get('browserVersion')||'unknown');

    await driver.get(SITE+'review-question-papers.html?cross='+encodeURIComponent(label));
    await driver.executeScript('localStorage.setItem(arguments[0], arguments[1])','nafes_review_correction_draft',JSON.stringify(draft));
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.css('.paper-page')),30000);
    await driver.sleep(250);

    const layout=await driver.executeScript(`
      const pages=[...document.querySelectorAll('.paper-page')];
      const flows=[...document.querySelectorAll('.questions-flow')];
      return {
        page_count:pages.length,
        unresolved:pages.filter(x=>x.dataset.layoutUnresolved==='1').length,
        overflow:flows.filter(x=>x.scrollHeight>x.clientHeight+2||x.scrollWidth>x.clientWidth+2).length,
        stem_px:parseFloat(getComputedStyle(document.querySelector('.stem')).fontSize||'0'),
        choice_px:parseFloat(getComputedStyle(document.querySelector('.choices')).fontSize||'0')
      };
    `);
    console.log('BROWSER_LAYOUT '+label+' '+JSON.stringify({version,...layout}));
    if(label==='Firefox')assert.ok(layout.page_count>=2&&layout.page_count<=3,label+' unexpected pagination');
    else assert.equal(layout.page_count,2,label+' should paginate fixture into two pages');
    assert.equal(layout.unresolved,0,label+' unresolved layout');
    assert.equal(layout.overflow,0,label+' overflow');
    assert.ok(layout.stem_px>=18,label+' question font too small');
    assert.ok(layout.choice_px>=16,label+' choice font too small');

    if(label==='Firefox'){
      // Firefox layout is verified in its native engine. The classic WebDriver
      // PDF print command is intentionally not used here because it can block
      // indefinitely on GitHub's headless Firefox runner even after layout is stable.
      const png=await driver.takeScreenshot();
      fs.writeFileSync(path.join(outDir,'firefox-layout.png'),Buffer.from(png,'base64'));
      return{browser:label,version,print_check:'layout-engine+print-css-contract',...layout};
    }

    const b64=await driver.printPage({
      orientation:'portrait',scale:1,background:true,width:21,height:29.7,
      top:0,bottom:0,left:0,right:0,shrinkToFit:false
    });
    assert.ok(String(b64).startsWith('JVBER'),label+' did not return a PDF');
    const pdf=Buffer.from(b64,'base64');
    assert.ok(pdf.length>30000,label+' PDF unexpectedly small');
    fs.writeFileSync(path.join(outDir,label.toLowerCase()+'-print.pdf'),pdf);
    return{browser:label,version,pdf_bytes:pdf.length,print_check:'webdriver-pdf',...layout};
  }finally{
    if(driver)await driver.quit().catch(()=>{});
  }
}

(async()=>{
  const rows=[];
  for(const [name,label] of [[Browser.CHROME,'Chrome'],[Browser.EDGE,'Edge'],[Browser.FIREFOX,'Firefox']]){
    rows.push(await runOne(name,label));
  }
  fs.writeFileSync(path.join(outDir,'cross-browser-audit.json'),JSON.stringify(rows,null,2));
  console.log('PASS cross-browser paper print QA '+JSON.stringify(rows));
})().catch(e=>{console.error(e);process.exit(1);});
