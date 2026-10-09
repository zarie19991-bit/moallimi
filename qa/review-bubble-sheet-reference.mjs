import fs from 'node:fs';
import { chromium } from 'playwright-core';

const SITE=process.env.QA_LOCAL_SITE||'http://127.0.0.1:4173/';
const CHROME=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const draft={
  review_id:'BUBBLE_REF_QA',
  title:'اختبار نافس',
  question_count:60,
  bubble_name_mode:'printed',
  school_name:'يجب ألا يظهر اسم المدرسة',
  class_name:'يجب ألا يظهر الفصل',
  assignments:[{sheet_no:1,student_id:'s1',student_name:'محمد أحمد علي القحطاني',class_name:'3A',model:'أ'}]
};

const browser=await chromium.launch({headless:true,executablePath:CHROME,args:['--no-sandbox']});
try{
  const context=await browser.newContext({locale:'ar-SA'});
  await context.addInitScript(d=>localStorage.setItem('nafes_review_correction_draft',JSON.stringify(d)),draft);
  const page=await context.newPage();
  await page.goto(SITE+'review-bubble-sheets.html?refqa=1',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('.bubble-sheet .omr-svg',{timeout:30000});
  await page.waitForTimeout(250);

  const audit=await page.evaluate(()=>{
    const svg=document.querySelector('.omr-svg');
    const groupRects=[...svg.querySelectorAll('rect')].filter(r=>Math.abs(Number(r.getAttribute('height'))-94)<0.01);
    const headerShapes=[...svg.querySelectorAll('path')].filter(p=>p.getAttribute('fill')==='#0c8184');
    const letters=[...svg.querySelectorAll('text')].filter(t=>['أ','ب','ج','د'].includes(t.textContent.trim()));
    const sorted=groupRects.map(r=>({x:Number(r.getAttribute('x')),w:Number(r.getAttribute('width'))})).sort((a,b)=>a.x-b.x);
    const gaps=[];
    for(let i=0;i<sorted.length-1;i++)gaps.push(sorted[i+1].x-(sorted[i].x+sorted[i].w));
    const containment=letters.map(t=>{
      const tb=t.getBBox();
      const tc=tb.x+tb.width/2;
      const rc=headerShapes.map(r=>({r,b:r.getBBox(),d:Math.abs((r.getBBox().x+r.getBBox().width/2)-tc)})).sort((a,b)=>a.d-b.d)[0];
      const b=rc.b;
      return {
        letter:t.textContent.trim(),
        inside:tb.x>=b.x-.05&&tb.x+tb.width<=b.x+b.width+.05&&tb.y>=b.y-.35&&tb.y+tb.height<=b.y+b.height+.35,
        text:{x:tb.x,y:tb.y,w:tb.width,h:tb.height},
        box:{x:b.x,y:b.y,w:b.width,h:b.height}
      };
    });
    return{
      group_count:groupRects.length,
      gaps,
      header_shapes:headerShapes.length,
      letters:letters.length,
      containment,
      printed_name:document.querySelector('.printed-student-name')?.textContent.trim()||'',
      visible_text:document.querySelector('.bubble-sheet')?.innerText||'',
      logo_count:document.querySelectorAll('.sheet-logo').length
    };
  });

  if(audit.group_count!==4)throw new Error('expected four answer groups '+JSON.stringify(audit));
  if(audit.gaps.length!==3||audit.gaps.some(g=>Math.abs(g-5.5)>0.15))throw new Error('group gaps are not equal 5.5mm '+JSON.stringify(audit.gaps));
  if(audit.header_shapes!==16||audit.letters!==16)throw new Error('expected 16 rounded-top option headers '+JSON.stringify(audit));
  if(audit.containment.some(x=>!x.inside))throw new Error('Arabic option letter escaped its capsule '+JSON.stringify(audit.containment));
  if(audit.printed_name!=='محمد أحمد علي القحطاني')throw new Error('student name not printed correctly '+audit.printed_name);
  if(audit.visible_text.includes('يجب ألا يظهر اسم المدرسة')||audit.visible_text.includes('يجب ألا يظهر الفصل'))throw new Error('school/class dynamic data must remain blank');
  if(audit.logo_count!==0)throw new Error('platform logo returned to bubble sheet');

  fs.mkdirSync('qa-output/bubble-reference',{recursive:true});
  await page.screenshot({path:'qa-output/bubble-reference/bubble-reference-after.png',fullPage:true});
  await page.emulateMedia({media:'print'});
  await page.pdf({path:'qa-output/bubble-reference/bubble-reference-after.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,margin:{top:'0',right:'0',bottom:'0',left:'0'}});
  fs.writeFileSync('qa-output/bubble-reference/bubble-reference-audit.json',JSON.stringify(audit,null,2));
  console.log('PASS bubble reference QA '+JSON.stringify(audit));
}finally{
  await browser.close();
}
