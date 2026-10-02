(()=>{
'use strict';
if(window.NafesPrintAudit)return;
const round=n=>Math.round(Number(n||0)*100)/100;
const sevRank={info:1,warning:2,critical:3};
const maxSeverity=issues=>issues.reduce((a,x)=>sevRank[x.severity]>sevRank[a]?x.severity:a,'info');
const safeNum=v=>Number.isFinite(Number(v))?Number(v):0;
function waitFrame(){return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}
async function settle(){
  try{if(document.fonts?.ready)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2500))]);}catch(_){}
  const imgs=[...document.images];
  await Promise.allSettled(imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true});setTimeout(r,2500);})));
  await waitFrame();await new Promise(r=>setTimeout(r,180));await waitFrame();
}
function issue(code,severity,page,detail,metric={}){return{code,severity,page:Number(page||0),detail:String(detail||''),metric};}
function pageQuestionCount(page){return page.querySelectorAll('.question').length;}
function auditQuestionPapers(){
  const pages=[...document.querySelectorAll('.paper-page')],issues=[],pageMetrics=[];
  if(!pages.length)return{source:'question_papers',status:'not_ready',summary:{pages:0,issues:1},issues:[issue('PRINT_NO_PAGES','warning',0,'لا توجد صفحات أسئلة جاهزة للفحص.')],pages:[]};
  pages.forEach((page,idx)=>{
    const no=idx+1,flow=page.querySelector('.questions-flow'),inner=page.querySelector('.page-inner');
    if(!flow||!inner){issues.push(issue('PRINT_STRUCTURE_MISSING','critical',no,'بنية الصفحة لا تحتوي حاوية القياس المتوقعة.'));return;}
    const overflowY=Math.max(0,flow.scrollHeight-flow.clientHeight),overflowX=Math.max(0,flow.scrollWidth-flow.clientWidth);
    const qCount=pageQuestionCount(page),subject=String(page.dataset.subject||''),ratio=flow.clientHeight?Math.min(2,flow.scrollHeight/flow.clientHeight):0;
    const brokenChoices=[...page.querySelectorAll('.question')].filter(q=>q.querySelectorAll('.choice').length!==4).length;
    const brokenImages=[...page.querySelectorAll('img')].filter(img=>img.complete&&img.naturalWidth===0).length;
    let clipped=0;
    const fr=flow.getBoundingClientRect();
    page.querySelectorAll('.question,.passage,.subject-divider,.q-image').forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.bottom>fr.bottom+2||r.left<fr.left-2||r.right>fr.right+2)clipped++;
    });
    const stems=[...page.querySelectorAll('.stem')],minStemPx=stems.length?Math.min(...stems.map(x=>parseFloat(getComputedStyle(x).fontSize)||99)):null;
    pageMetrics.push({page:no,subject,questions:qCount,fill_ratio:round(ratio),overflow_y_px:round(overflowY),overflow_x_px:round(overflowX),clipped_elements:clipped,broken_choices:brokenChoices,broken_images:brokenImages,min_stem_px:minStemPx===null?null:round(minStemPx)});
    if(overflowY>2||overflowX>2)issues.push(issue('PRINT_OVERFLOW','critical',no,'المحتوى يتجاوز مساحة A4 الفعلية.',{overflow_y_px:round(overflowY),overflow_x_px:round(overflowX)}));
    if(clipped>0)issues.push(issue('PRINT_CLIPPED_ELEMENTS','critical',no,'عناصر مطبوعة تخرج خارج مساحة المحتوى.',{count:clipped}));
    if(brokenChoices>0)issues.push(issue('PRINT_BROKEN_CHOICES','critical',no,'يوجد سؤال لا يعرض أربعة اختيارات كاملة.',{count:brokenChoices}));
    if(brokenImages>0)issues.push(issue('PRINT_BROKEN_IMAGES','warning',no,'توجد صورة مرتبطة بالسؤال لم تُحمّل بنجاح.',{count:brokenImages}));
    if(qCount===0&&!page.classList.contains('error-page'))issues.push(issue('PRINT_BLANK_PAGE','warning',no,'صفحة فارغة بلا أسئلة.'));
    if(subject!=='reading'&&ratio<0.42&&qCount>0)issues.push(issue('PRINT_UNDERFILLED_PAGE','warning',no,'الصفحة تستخدم جزءًا صغيرًا من مساحة A4.',{fill_ratio:round(ratio),questions:qCount}));
    if(minStemPx!==null&&minStemPx<12)issues.push(issue('PRINT_TEXT_TOO_SMALL','warning',no,'حجم خط السؤال منخفض للطباعة الواضحة.',{min_stem_px:round(minStemPx)}));
  });
  const booklets=[...document.querySelectorAll('.model-booklet')];
  for(const booklet of booklets){
    const ps=[...booklet.querySelectorAll(':scope > .paper-page')];
    if(ps.length<2)continue;
    const last=ps.at(-1),prev=ps.at(-2),lastQ=pageQuestionCount(last),prevQ=pageQuestionCount(prev);
    const flow=last.querySelector('.questions-flow');
    const ratio=flow?.clientHeight?flow.scrollHeight/flow.clientHeight:1;
    if(lastQ<=2&&prevQ>=4&&ratio<.5)issues.push(issue('PRINT_ORPHAN_LAST_PAGE','warning',Number(last.dataset.page||ps.length),'الصفحة الأخيرة ضعيفة ويمكن غالبًا إعادة موازنة الأسئلة قبل الطباعة.',{last_questions:lastQ,previous_questions:prevQ,fill_ratio:round(ratio)}));
  }
  return{source:'question_papers',status:'ready',summary:{pages:pages.length,issues:issues.length,severity:issues.length?maxSeverity(issues):'ok'},issues,pages:pageMetrics};
}
function auditBubbleSheets(){
  const papers=[...document.querySelectorAll('.paper')],issues=[],pageMetrics=[];
  if(!papers.length)return{source:'bubble_sheets',status:'not_ready',summary:{pages:0,issues:1},issues:[issue('PRINT_NO_PAGES','warning',0,'لا توجد أوراق تظليل جاهزة للفحص.')],pages:[]};
  papers.forEach((paper,idx)=>{
    const no=idx+1,sheet=paper.querySelector('.bubble-sheet');
    if(!sheet){issues.push(issue('PRINT_STRUCTURE_MISSING','critical',no,'ورقة التظليل لا تحتوي القالب المتوقع.'));return;}
    const sr=sheet.getBoundingClientRect();
    const overflowY=Math.max(0,sheet.scrollHeight-sheet.clientHeight),overflowX=Math.max(0,sheet.scrollWidth-sheet.clientWidth);
    const qr=sheet.querySelector('[data-qr-box] canvas,[data-qr-box] img'),omr=sheet.querySelector('.omr-svg'),foot=sheet.querySelector('.sheet-foot');
    let clipped=0;
    sheet.querySelectorAll('.sheet-title,.brand-row,.exam-pill,.student-name,.info-grid,.answers-title,.omr-wrap,.sheet-foot').forEach(el=>{const r=el.getBoundingClientRect();if(r.bottom>sr.bottom+2||r.left<sr.left-2||r.right>sr.right+2)clipped++;});
    pageMetrics.push({page:no,overflow_y_px:round(overflowY),overflow_x_px:round(overflowX),clipped_elements:clipped,qr_ready:!!qr,omr_ready:!!omr,footer_inside:!!foot&&foot.getBoundingClientRect().bottom<=sr.bottom+2});
    if(overflowY>2||overflowX>2)issues.push(issue('PRINT_OVERFLOW','critical',no,'ورقة التظليل تتجاوز حدود A4.',{overflow_y_px:round(overflowY),overflow_x_px:round(overflowX)}));
    if(clipped>0)issues.push(issue('PRINT_CLIPPED_ELEMENTS','critical',no,'عناصر في ورقة التظليل تقع خارج القالب.',{count:clipped}));
    if(!qr)issues.push(issue('PRINT_QR_MISSING','critical',no,'رمز QR لم يُنشأ في ورقة التظليل.'));
    if(!omr)issues.push(issue('PRINT_OMR_GRID_MISSING','critical',no,'شبكة الإجابات OMR غير موجودة.'));
  });
  return{source:'bubble_sheets',status:'ready',summary:{pages:papers.length,issues:issues.length,severity:issues.length?maxSeverity(issues):'ok'},issues,pages:pageMetrics};
}
function auditPaperReport(){
  const sheet=document.querySelector('.report-sheet:not([hidden])');
  if(!sheet)return{source:'paper_report',status:'not_ready',summary:{pages:0,issues:1},issues:[issue('PRINT_NO_REPORT','warning',0,'لا يوجد تقرير ورقي ظاهر جاهز للفحص.')],pages:[]};
  const issues=[],width=sheet.getBoundingClientRect().width,height=sheet.scrollHeight;
  const a4Height=width>0?width*(297/210):1122,estimatedPages=Math.max(1,Math.ceil(height/a4Height));
  const sections=[...sheet.querySelectorAll('.report-section')];
  const tooTall=sections.filter(s=>s.getBoundingClientRect().height>a4Height*.86).length;
  const tables=[...sheet.querySelectorAll('.report-table')];
  const minFont=Math.min(...[...sheet.querySelectorAll('td,th,p,li')].map(x=>parseFloat(getComputedStyle(x).fontSize)||99),99);
  if(tooTall>0)issues.push(issue('PRINT_UNBREAKABLE_LARGE_SECTION','warning',0,'يوجد قسم كبير جدًا مع break-inside: avoid وقد ينتقل أو ينقسم بصورة غير جيدة.',{count:tooTall}));
  if(minFont<11)issues.push(issue('PRINT_TEXT_TOO_SMALL','warning',0,'بعض نصوص التقرير صغيرة للطباعة الواضحة.',{min_font_px:round(minFont)}));
  return{source:'paper_report',status:'ready',summary:{pages:estimatedPages,issues:issues.length,severity:issues.length?maxSeverity(issues):'ok'},issues,pages:[{page:1,estimated_pages:estimatedPages,height_px:round(height),a4_height_px:round(a4Height),sections:sections.length,tables:tables.length,min_font_px:round(minFont)}]};
}
function detect(){
  if(document.querySelector('.paper-page'))return auditQuestionPapers();
  if(document.querySelector('.bubble-sheet'))return auditBubbleSheets();
  if(document.querySelector('.report-sheet'))return auditPaperReport();
  return{source:'unknown',status:'not_ready',summary:{pages:0,issues:1},issues:[issue('PRINT_SURFACE_UNKNOWN','warning',0,'تعذر تحديد نوع صفحة الطباعة.')],pages:[]};
}
async function run(){await settle();const result=detect();result.audited_at=new Date().toISOString();result.privacy={contains_student_names:false,contains_student_ids:false,contains_teacher_keys:false,raw_text_collected:false};return result;}
window.NafesPrintAudit={run,settle,detect,version:'visual-print-audit-v1'};
dispatchEvent(new CustomEvent('nafes:print-audit-ready'));
})();