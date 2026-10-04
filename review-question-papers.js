(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const letters=['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
const DEFAULT_QUESTION_START=1;
const PAPER_SUBJECT_ORDER=['science','math','reading'];
function paperSubjectRank(subject){const i=PAPER_SUBJECT_ORDER.indexOf(String(subject||''));return i<0?99:i;}
function paperOrderedQuestions(questions){
 return (questions||[]).map((q,index)=>{
   const subject=String(q.subject||String(q.indicator||'').split(':')[0]||'').trim()||'reading';
   return{q,index,subject};
 }).sort((a,b)=>paperSubjectRank(a.subject)-paperSubjectRank(b.subject)||a.index-b.index).map(x=>x.q);
}
let activeDraft=null;
function getDraft(){if(activeDraft)return activeDraft;try{return JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');}catch(_){return null;}}
function subjectLabel(s){return({reading:'القراءة',math:'الرياضيات',science:'العلوم'})[s]||s||'—';}
const REMOVED_PRINT_HEADING=new RegExp(['مراجعة','مؤشرات','نافس'].join('\\s+'),'g');
function exportPaperTitle(value){
 const fallback='اختبار نافس';
 const cleaned=String(value||fallback)
  .replace(REMOVED_PRINT_HEADING,' ')
  .replace(/\s{2,}/g,' ')
  .replace(/^[\s:،؛|\-–—]+|[\s:،؛|\-–—]+$/g,'')
  .trim();
 return cleaned||fallback;
}
function questionSubject(q){return String(q?.subject||String(q?.indicator||'').split(':')[0]||'').trim()||'reading';}
function indicatorLabels(model,subject='reading'){
 const seen=new Set(),out=[];
 for(const q of model?.questions||[]){
   if(questionSubject(q)!==subject)continue;
   const raw=String(q.indicator_text||q.indicator_label||q.indicator_name||q.indicator||'').trim();
   if(!raw)continue;
   const label=raw.replace(/^reading\s*[:|\-]\s*/i,'').trim()||raw;
   const key=norm(label);
   if(!key||seen.has(key))continue;
   seen.add(key);out.push(label);
 }
 return out;
}
function copiesFor(d,model){return(d.assignments||[]).filter(a=>a.model===model).length;}
function norm(s){return String(s||'').normalize('NFKC').replace(/[\u064B-\u0652\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ة/g,'ه').replace(/[ىي]/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();}

const INTERNAL_STUDENT_CONTEXT=/^(?:موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|مهمة تقويمية جديدة|مراجعة الحل)/;
function studentFacingContext(subject,value){
 const ctx=String(value||'').trim();
 if(!ctx)return '';
 if((subject==='math'||subject==='science')&&INTERNAL_STUDENT_CONTEXT.test(ctx))return '';
 return ctx;
}
function similarity(a,b){
 const A=norm(a),B=norm(b);if(!A||!B)return 0;if(A===B)return 1;
 const min=Math.min(A.length,B.length),max=Math.max(A.length,B.length);
 if(min>=90&&(A.includes(B)||B.includes(A)))return min/max;
 if(min<90)return 0;
 const wa=new Set(A.split(' ').filter(w=>w.length>1)),wb=new Set(B.split(' ').filter(w=>w.length>1));let inter=0;
 for(const w of wa)if(wb.has(w))inter++;const union=wa.size+wb.size-inter;return union?inter/union:0;
}
function groupsFromQuestions(questions,startNo=DEFAULT_QUESTION_START){
 const groups=[],byKey=new Map();let lastSubject='';
 questions.forEach((q,i)=>{
   const subject=String(q.subject||String(q.indicator||'').split(':')[0]||'').trim()||'reading';
   const ctx=studentFacingContext(subject,q.context);
   const key=subject+'|'+(ctx?norm(ctx):'__NO_CONTEXT__:'+i);
   let group=byKey.get(key);
   if(!group){
     group={subject,subjectStart:subject!==lastSubject,context:ctx,questions:[]};
     groups.push(group);byKey.set(key,group);lastSubject=subject;
   }
   group.questions.push({...q,subject,_no:startNo+i});
 });
 return groups;
}
function questionUnits(q){
 const stem=String(q.question||'').length,opts=(q.options||[]).join(' ').length;
 return 7+Math.ceil(stem/85)*1.5+Math.ceil(opts/130)*1.4+(q.image_url?10:0);
}
function groupUnits(g){
 return (g.subjectStart?5:0)+(g.context?8+Math.ceil(String(g.context).length/180)*3.2:0)+g.questions.reduce((n,q)=>n+questionUnits(q),0);
}
function paginateGroups(groups,subject){
 const valid=groups.filter(g=>g&&g.questions?.length);
 if(!valid.length)return[[]];

 // هذه مجرد قسمة أولية سريعة. القياس الحقيقي داخل المتصفح
 // سيعيد تعبئة الصفحات لاحقًا حسب الارتفاع الفعلي على A4.
 // القراءة لا تُجبر على صفحة مستقلة لكل نص.
 const reading=subject==='reading';
 const SOFT_LIMIT=reading?92:118;
 const HARD_LIMIT=reading?108:134;
 const weighted=valid.map(g=>({g,u:groupUnits(g)}));
 const total=weighted.reduce((n,x)=>n+x.u,0);
 let desiredPages=Math.max(1,Math.ceil(total/SOFT_LIMIT));
 desiredPages=Math.min(desiredPages,valid.length);

 const pages=[];let page=[],pageUnits=0,remainingUnits=total,remainingPages=desiredPages;
 for(let i=0;i<weighted.length;i++){
   const {g,u}=weighted[i];
   const groupsLeft=weighted.length-i;
   const target=remainingPages>0?remainingUnits/remainingPages:SOFT_LIMIT;
   const mustLeave=remainingPages-1;
   const canBreak=page.length>0&&(groupsLeft>mustLeave);
   const hardBreak=canBreak&&pageUnits+u>HARD_LIMIT;
   const balancedBreak=canBreak&&pageUnits>=target*.9&&pageUnits+u>target*1.12;
   if(hardBreak||balancedBreak){
     pages.push(page);
     remainingUnits-=pageUnits;
     remainingPages=Math.max(1,remainingPages-1);
     page=[];pageUnits=0;
   }
   page.push(g);pageUnits+=u;
 }
 if(page.length)pages.push(page);
 return pages.length?pages:[[]];
}
function cleanStem(question,context){
 const stem=String(question||'').trim(),ctx=String(context||'').trim();
 if(ctx.length>90&&stem.startsWith(ctx))return stem.slice(ctx.length).replace(/^\s*[:\-–—،.؛]*\s*/,'').trim()||stem;
 return stem;
}
function renderQuestion(q,context){
 const opts=Array.isArray(q.options)?q.options.filter(o=>String(o??'').trim()):[];
 if(opts.length!==4){
   return '<article class="question question-error"><p class="stem">'+ar(q._no)+') '+esc(cleanStem(q.question,context))+'</p><div class="missing-choices">تعذر عرض هذا السؤال لأن الاختيارات الأربعة لم تُحفظ كاملة.</div></article>';
 }
 return '<article class="question"><p class="stem">'+ar(q._no)+') '+esc(cleanStem(q.question,context))+'</p><div class="choices">'+
 opts.map((o,j)=>'<div class="choice"><b>'+letters[j]+')</b><span>'+esc(o)+'</span></div>').join('')+
 '</div></article>';
}
function renderGroup(g){
 let out='<section class="passage-group" data-subject="'+esc(g.subject||'')+'">';
 if(g.subjectStart)out+='<div class="subject-divider"><b>'+esc(subjectLabel(g.subject))+'</b><span>قسم '+esc(subjectLabel(g.subject))+'</span></div>';
 if(g.context)out+='<div class="passage">'+esc(g.context)+'</div>';
 if(g.continued)out+='<div class="continued">تابع أسئلة النص السابق</div>';
 const first=g.questions[0]?._no||1,last=g.questions.at(-1)?._no||first;
 if(g.subject==='reading'&&g.context)out+='<div class="after-passage">بعد قراءتك للنص أعلاه، أجب عن الأسئلة من '+ar(first)+' - '+ar(last)+'</div>';
 const seenImages=new Set();
 for(const q of g.questions){const src=String(q.image_url||'').trim();if(src&&!seenImages.has(src)){seenImages.add(src);out+='<img class="q-image" src="'+esc(src)+'" alt="'+esc(q.image_alt||'صورة مرتبطة بالأسئلة')+'">';}}
 out+='<div class="passage-questions">'+g.questions.map(q=>renderQuestion(q,g.context)).join('')+'</div></section>';
 return out;
}
function pageHeader(model,d,pageNo,totalPages,totalQuestions){
 const subjects=(Array.isArray(d.subjects)&&d.subjects.length?d.subjects:[d.subject]).filter(Boolean).sort((a,b)=>paperSubjectRank(a)-paperSubjectRank(b));
 const subjectText=subjects.map(subjectLabel).join(' + ')||'—';
 const title=exportPaperTitle(d.title);
 const readingOnly=subjects.length===1&&subjects[0]==='reading';
 const indicators=readingOnly?indicatorLabels(model,'reading'):[];
 const brand=readingOnly?title:'اختبار '+subjectText;
 const strip=readingOnly
   ?'<div class="title-strip indicator-review-strip"><b>مؤشرات نافس - القراءة</b><small class="indicator-list">'+
      esc(indicators.length?indicators.join(' • '):'المؤشرات المستهدفة في هذا النموذج')+
     '</small></div>'
   :'<div class="title-strip"><b>'+esc(title)+'</b><small>المادة: '+esc(subjectText)+'</small></div>';
 return '<div class="exam-frame-head">'+
 '<div class="official"><b>المملكة العربية السعودية</b><b>وزارة التعليم</b><b>إدارة تعليم نجران</b><b>مدرسة ابن سينا المتوسطة</b></div>'+
 '<div class="exam-brand">'+esc(brand)+'</div>'+
 '<div class="grade-box"><b>ثالث متوسط</b><span>نموذج '+esc(model.model)+'</span></div>'+
 '</div>'+
 strip+
 '<div class="student-line"><b>الاسم:</b><span></span></div>'+
 '<div class="page-number">الصفحة '+ar(pageNo)+' من '+ar(totalPages)+' · عدد الأسئلة '+ar(totalQuestions)+'</div>';
}
function onePage(model,d,groups,pageNo,totalPages,totalQuestions){
 const subjects=(Array.isArray(d.subjects)&&d.subjects.length?d.subjects:[d.subject]).filter(Boolean).sort((a,b)=>paperSubjectRank(a)-paperSubjectRank(b));
 const subjectText=subjects.map(subjectLabel).join(' + ')||'—';
 const title=exportPaperTitle(d.title);
 const mode=subjects.length>1?'mixed':(subjects[0]||d.subject||'');
 return '<section class="paper-page" data-model="'+esc(model.model)+'" data-subject="'+esc(mode)+'" data-page="'+pageNo+'"><div class="page-inner"><div class="page-flow">'+
 pageHeader(model,d,pageNo,totalPages,totalQuestions)+
 '<div class="questions-flow">'+groups.map(g=>renderGroup(g)).join('')+'</div>'+
 '<footer class="footer"><span>منصة معلّمي — '+esc(title)+' — '+esc(subjectText)+'</span><span>نموذج '+esc(model.model)+' · '+ar(pageNo)+'/'+ar(totalPages)+'</span></footer>'+
 '</div></div></section>';
}
function modelBooklet(model,d){
 const questions=paperOrderedQuestions(model.questions||[]),startNo=Number(d.question_start||DEFAULT_QUESTION_START),groups=groupsFromQuestions(questions,startNo);
 const subjects=(Array.isArray(d.subjects)&&d.subjects.length?d.subjects:[d.subject]).filter(Boolean).sort((a,b)=>paperSubjectRank(a)-paperSubjectRank(b));
 if(subjects.length===1&&subjects[0]==='reading'&&questions.length===20){
   const bad=groups.length!==4||groups.some(g=>!g.context||g.questions.length!==5);
   if(bad)return '<section class="paper-page error-page"><div class="page-inner"><div class="layout-error"><h2>هذا النموذج غير صالح للطباعة</h2><p>يجب أن يتكون من ٤ نصوص، وتحت كل نص ٥ أسئلة. أعد إنشاء النماذج من قسم الاختبار الآلي والتصحيح.</p></div></div></section>';
 }
 const mode=subjects.length>1?'mixed':(subjects[0]||d.subject);
 const pages=paginateGroups(groups,mode);
 return '<div class="model-booklet" data-booklet="'+esc(model.model)+'">'+pages.map((page,i)=>onePage(model,d,page,i+1,pages.length,questions.length)).join('')+'</div>';
}
function pageFits(page,slack=2){
 if(page?.parentElement?.classList.contains('model-booklet')){
   const pages=[...page.parentElement.querySelectorAll(':scope > .paper-page')];
   page.classList.toggle('continuation-page',pages.indexOf(page)>0);
 }
 const flow=page?.querySelector('.questions-flow');
 if(!flow)return true;
 return flow.scrollHeight<=flow.clientHeight+slack&&flow.scrollWidth<=flow.clientWidth+slack;
}
function emptyPageFrom(page){
 const clone=page.cloneNode(true);
 clone.classList.remove('compact-page','compact-page-strong');
 clone.classList.add('continuation-page');
 clone.querySelector('.questions-flow')?.replaceChildren();
 return clone;
}
function ensureNextPage(booklet,page){
 let pages=[...booklet.querySelectorAll(':scope > .paper-page')],i=pages.indexOf(page),next=pages[i+1];
 if(!next){
   next=emptyPageFrom(page);
   booklet.insertBefore(next,page.nextSibling);
 }
 return next;
}
function continuationGroupFrom(group){
 const clone=group.cloneNode(false);
 clone.removeAttribute('style');
 clone.dataset.continuation='1';
 clone.querySelectorAll?.('*').forEach(()=>{});
 const subject=String(group.dataset.subject||'');
 const notice=document.createElement('div');
 notice.className='continued';
 notice.textContent=subject==='reading'?'تابع أسئلة النص السابق':'تابع الأسئلة';
 clone.appendChild(notice);
 group.querySelectorAll(':scope > .q-image').forEach(img=>clone.appendChild(img.cloneNode(true)));
 const wrap=document.createElement('div');
 wrap.className='passage-questions';
 clone.appendChild(wrap);
 return clone;
}
function splitOversizeGroup(page,next){
 const flow=page.querySelector('.questions-flow'),nextFlow=next?.querySelector('.questions-flow');
 const group=flow?.lastElementChild;
 if(!flow||!nextFlow||!group)return false;
 const wrap=group.querySelector(':scope > .passage-questions');
 if(!wrap||wrap.children.length<=1)return false;
 const continuation=continuationGroupFrom(group),nextWrap=continuation.querySelector('.passage-questions');
 nextFlow.prepend(continuation);
 while(!pageFits(page)&&wrap.children.length>1){
   nextWrap.prepend(wrap.lastElementChild);
 }
 if(!nextWrap.children.length)continuation.remove();
 return pageFits(page);
}
function compactUntilFits(page){
 if(pageFits(page))return true;
 page.classList.add('compact-page');
 void page.offsetHeight;
 if(pageFits(page))return true;
 page.classList.add('compact-page-strong');
 void page.offsetHeight;
 return pageFits(page);
}
function tryCompactCandidate(page){
 const hadCompact=page.classList.contains('compact-page');
 const hadStrong=page.classList.contains('compact-page-strong');
 if(!hadCompact){page.classList.add('compact-page');void page.offsetHeight;}
 if(pageFits(page,-4))return true;
 if(!hadStrong){page.classList.add('compact-page-strong');void page.offsetHeight;}
 if(pageFits(page,-4))return true;
 if(!hadStrong)page.classList.remove('compact-page-strong');
 if(!hadCompact)page.classList.remove('compact-page');
 void page.offsetHeight;
 return false;
}
function repairOverflow(booklet){
 let pages=[...booklet.querySelectorAll(':scope > .paper-page')];
 for(let i=0;i<pages.length;i++){
   let page=pages[i],flow=page.querySelector('.questions-flow');
   page.removeAttribute('data-layout-unresolved');
   let guard=0;
   while(!pageFits(page)&&guard++<80){
     // أولوية الطباعة: وضوح الخط قبل تقليل عدد الصفحات.
     // إذا كانت الصفحة تحتوي أكثر من مجموعة، انقل آخر مجموعة كاملة أولاً.
     if(flow?.children.length>1){
       const next=ensureNextPage(booklet,page),nextFlow=next.querySelector('.questions-flow');
       nextFlow.prepend(flow.lastElementChild);
       pages=[...booklet.querySelectorAll(':scope > .paper-page')];
       continue;
     }

     // إذا كانت مجموعة واحدة كبيرة (خصوصًا نص القراءة وأسئلته)،
     // قسّم الأسئلة على صفحة تالية قبل التفكير في ضغط الخط.
     const next=ensureNextPage(booklet,page);
     if(splitOversizeGroup(page,next)){
       pages=[...booklet.querySelectorAll(':scope > .paper-page')];
       break;
     }

     // الضغط الآن حل أخير فقط، وبحدود مقروءة يفرضها CSS.
     if(compactUntilFits(page))break;

     // لا نقص سؤالًا منفردًا ولا نصغره إلى خط غير مقروء.
     page.dataset.layoutUnresolved='1';
     break;
   }
   // إذا نجحت إعادة التوزيع لاحقًا يجب حذف أي وسم فشل سابق فورًا.
   if(pageFits(page))page.removeAttribute('data-layout-unresolved');
 }
}
function renumberBooklet(booklet){
 const pages=[...booklet.querySelectorAll(':scope > .paper-page')];
 const total=pages.length;
 pages.forEach((page,i)=>{
   const no=i+1;
   page.dataset.page=String(no);
   page.classList.toggle('continuation-page',i>0);
   const pageNumber=page.querySelector('.page-number');
   if(pageNumber){
     const m=pageNumber.textContent.match(/عدد الأسئلة\s+(.+)$/);
     const q=m?m[1]:'';
     pageNumber.textContent='الصفحة '+ar(no)+' من '+ar(total)+(q?' · عدد الأسئلة '+q:'');
   }
   const tail=page.querySelector('.footer span:last-child');
   if(tail)tail.textContent='نموذج '+(page.dataset.model||'')+' · '+ar(no)+'/'+ar(total);
 });
}
function removeEmptyPages(booklet){
 [...booklet.querySelectorAll(':scope > .paper-page')].forEach(page=>{
   if(!page.querySelector('.questions-flow')?.children.length)page.remove();
 });
}
function pullPartialReadingGroup(page,next,candidate){
 const nextFlow=next?.querySelector('.questions-flow');
 const wrap=candidate?.querySelector(':scope > .passage-questions');
 const hasPassage=!!candidate?.querySelector(':scope > .passage');
 if(!nextFlow||!wrap||!hasPassage||wrap.children.length<=1)return false;

 const continuation=continuationGroupFrom(candidate);
 const nextWrap=continuation.querySelector('.passage-questions');
 nextFlow.prepend(continuation);

 // اترك النص في الصفحة الحالية ومعه أكبر عدد ممكن من أسئلته.
 while(!pageFits(page,-4)&&wrap.children.length>1){
   nextWrap.prepend(wrap.lastElementChild);
 }
 if(pageFits(page,-4)&&nextWrap.children.length){
   candidate.dataset.splitReading='1';
   return true;
 }

 // لم يتسع حتى النص مع سؤال واحد: أعد المجموعة كما كانت للصفحة التالية.
 while(nextWrap.firstElementChild)wrap.append(nextWrap.firstElementChild);
 continuation.remove();
 nextFlow.prepend(candidate);
 return false;
}
function pullContinuationQuestions(page,next,candidate){
 const flow=page?.querySelector('.questions-flow');
 const nextFlow=next?.querySelector('.questions-flow');
 const sourceWrap=candidate?.querySelector(':scope > .passage-questions');
 if(!flow||!nextFlow||!sourceWrap||!sourceWrap.children.length)return false;

 let targetGroup=flow.lastElementChild;
 let targetWrap=(targetGroup?.dataset.subject===candidate.dataset.subject)
   ?targetGroup.querySelector(':scope > .passage-questions')
   :null;
 let created=false;

 if(!targetWrap){
   targetGroup=document.createElement('section');
   targetGroup.className='passage-group';
   targetGroup.dataset.subject=String(candidate.dataset.subject||'reading');
   targetGroup.dataset.continuation='1';
   const notice=document.createElement('div');
   notice.className='continued';
   notice.textContent='تابع أسئلة النص السابق';
   targetWrap=document.createElement('div');
   targetWrap.className='passage-questions';
   targetGroup.append(notice,targetWrap);
   flow.appendChild(targetGroup);
   created=true;
 }

 let moved=0;
 while(sourceWrap.firstElementChild){
   const q=sourceWrap.firstElementChild;
   targetWrap.appendChild(q);
   if(pageFits(page,-4)){moved++;continue;}
   sourceWrap.prepend(q);
   break;
 }
 if(!moved&&created)targetGroup.remove();
 if(!sourceWrap.children.length)candidate.remove();
 return moved>0;
}
function fillAvailableSpace(booklet){
 let pages=[...booklet.querySelectorAll(':scope > .paper-page')];
 for(let i=0;i<pages.length-1;i++){
   const page=pages[i],flow=page.querySelector('.questions-flow');
   const next=pages[i+1],nextFlow=next.querySelector('.questions-flow');
   while(nextFlow?.firstElementChild){
     const candidate=nextFlow.firstElementChild;
     flow.append(candidate);
     if(pageFits(page,-4))continue;

     // قبل إرسال المحتوى إلى صفحة جديدة، اضغط الإيقاع الرأسي فقط
     // مع إبقاء حجم الخط 11pt. هذا يمنع الفراغات الكبيرة القابلة للاستفادة.
     if(tryCompactCandidate(page))continue;

     // متابعة نص سبق تقسيمه: اسحب الأسئلة واحدًا واحدًا بدل إبقاء
     // بقية المجموعة ككتلة واحدة تترك فراغًا كبيرًا في الصفحة السابقة.
     if(candidate.dataset.subject==='reading'&&!candidate.querySelector(':scope > .passage')&&candidate.querySelectorAll(':scope > .passage-questions > .question').length){
       nextFlow.prepend(candidate);
       if(pullContinuationQuestions(page,next,candidate)){
         if(candidate.isConnected&&candidate.parentElement===nextFlow)break;
         continue;
       }
       break;
     }

     // في القراءة لا نترك فراغًا كبيرًا لمجرد أن النص مع أسئلته الخمسة
     // لا يتسع ككتلة واحدة. نضع النص وما يتسع من أسئلته ثم نكمل الباقي.
     if(candidate.dataset.subject==='reading'&&candidate.querySelector(':scope > .passage')&&candidate.querySelectorAll(':scope > .passage-questions > .question').length>1){
       if(pullPartialReadingGroup(page,next,candidate))break;
       // الدالة أعادت المجموعة للصفحة التالية إذا لم يتسع النص مع سؤال واحد.
       break;
     }

     nextFlow.prepend(candidate);
     break;
   }
 }
 removeEmptyPages(booklet);
}
function resetFitState(booklet){
 [...booklet.querySelectorAll(':scope > .paper-page')].forEach(page=>{
   page.removeAttribute('data-layout-unresolved');
   page.classList.remove('compact-page','compact-page-strong');
 });
}
function fitBooklet(booklet){
 const first=booklet.querySelector(':scope > .paper-page');
 if(!first)return;

 // كل قياس يبدأ من حالة نظيفة؛ لا نسمح لضغط أو فشل سابق أن يظل
 // مؤثرًا بعد نقل الأسئلة أو تغيير عدد الصفحات.
 resetFitState(booklet);
 repairOverflow(booklet);
 removeEmptyPages(booklet);
 for(let pass=0;pass<5;pass++){
   fillAvailableSpace(booklet);
   repairOverflow(booklet);
   removeEmptyPages(booklet);
 }
 renumberBooklet(booklet);
}
function fitAllRenderedPages(){
 document.querySelectorAll('.model-booklet').forEach(fitBooklet);
}
function scheduleRealPageFit(){
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
   fitAllRenderedPages();
   const images=[...document.querySelectorAll('#pages img')];
   Promise.allSettled(images.map(img=>img.complete?Promise.resolve():new Promise(r=>{
     img.addEventListener('load',r,{once:true});
     img.addEventListener('error',r,{once:true});
   }))).then(()=>fitAllRenderedPages());
 }));
}
async function render(){
 activeDraft=await (window.NafesPaperReviewDraft?.load?.()||Promise.resolve(getDraft()));
 const d=getDraft();
 if(!d||!Array.isArray(d.models)||!d.models.length){document.body.innerHTML='<div class="empty"><h2>لا توجد أوراق أسئلة جاهزة بعد</h2><p>ارجع إلى قسم «الاختبار الآلي والتصحيح»، أنشئ النماذج ثم اعتمد التوزيع مرة أخرى.</p><a href="review-correction.html">العودة للقسم</a></div>';return;}
 $('screenTitle').textContent=exportPaperTitle(d.title)||'أوراق الأسئلة';
 $('modelFilter').innerHTML='<option value="all">جميع النماذج</option>'+d.models.map(m=>'<option value="'+esc(m.model)+'">نموذج '+esc(m.model)+' فقط</option>').join('');
 renderPages();
}
function renderPages(){
 const d=getDraft(),filter=$('modelFilter').value||'all',mode=$('copyMode').value||'master';
 const models=(d.models||[]).filter(m=>filter==='all'||m.model===filter);
 let html='';
 for(const m of models){
   const copies=mode==='students'?Math.max(1,copiesFor(d,m.model)):1;
   for(let i=0;i<copies;i++)html+=modelBooklet(m,d);
 }
 $('pages').innerHTML=html;
 scheduleRealPageFit();
 const copies=models.reduce((n,m)=>n+(mode==='students'?Math.max(1,copiesFor(d,m.model)):1),0);
 $('screenMeta').textContent=ar(models.length)+' نماذج · تعبئة فعلية لمساحة A4 قبل الانتقال للصفحة التالية · '+ar(copies)+' نسخة';
}
$('modelFilter').addEventListener('change',renderPages);
$('copyMode').addEventListener('change',renderPages);
function unusedBottomSpace(page){
 const flow=page?.querySelector('.questions-flow'),last=flow?.lastElementChild;
 if(!flow)return 0;
 if(!last)return Math.max(0,Math.round(flow.clientHeight));
 const fr=flow.getBoundingClientRect(),lr=last.getBoundingClientRect();
 return Math.max(0,Math.round(fr.bottom-lr.bottom));
}
function collectPrintMetrics(){
 const pages=[...document.querySelectorAll('.paper-page')];
 const details=pages.map((page,index)=>{
   const flow=page.querySelector('.questions-flow');
   const overflowY=flow?Math.max(0,flow.scrollHeight-flow.clientHeight):0;
   const overflowX=flow?Math.max(0,flow.scrollWidth-flow.clientWidth):0;
   const hiddenText=[...page.querySelectorAll('.passage,.stem,.choice span')].filter(el=>{
     const st=getComputedStyle(el);
     return /(hidden|clip)/.test(st.overflow+st.overflowY+st.overflowX)&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1);
   }).length;
   const booklet=page.parentElement?.classList.contains('model-booklet')?page.parentElement:null;
   const bookletPages=booklet?[...booklet.querySelectorAll(':scope > .paper-page')]:[page];
   const isFinalInBooklet=bookletPages.at(-1)===page;
   const unusedBottom=unusedBottomSpace(page);
   const largeGap=!isFinalInBooklet&&unusedBottom>140;
   return{page:index+1,overflow_y_px:overflowY,overflow_x_px:overflowX,unused_bottom_px:unusedBottom,large_gap:largeGap,hidden_text_nodes:hiddenText,unresolved:page.dataset.layoutUnresolved==='1'};
 });
 const maxOverflow=Math.max(0,...details.map(x=>Math.max(x.overflow_y_px,x.overflow_x_px)));
 const maxNonFinalGap=Math.max(0,...details.filter(x=>!x.large_gap||x.unused_bottom_px).map(x=>x.unused_bottom_px||0));
 return{at:new Date().toISOString(),pages:pages.length,max_overflow_px:maxOverflow,max_unused_bottom_px:maxNonFinalGap,details};
}
let printInProgress=false;
function prepareExactPrint(){
 document.documentElement.classList.add('print-preparing');
 const started=performance.now();
 // إعادة قياس كاملة من DOM الحالي، بدون الاعتماد على وسم unresolved قديم.
 for(let pass=0;pass<3;pass++)fitAllRenderedPages();
 const metrics=collectPrintMetrics();
 metrics.layout_ms=Math.round(performance.now()-started);
 localStorage.setItem('nafes_question_paper_last_print_metrics',JSON.stringify(metrics));
 const bad=metrics.details.filter(x=>x.unresolved||x.overflow_y_px>2||x.overflow_x_px>2||x.hidden_text_nodes>0||x.large_gap);
 if(bad.length){
   document.documentElement.classList.remove('print-preparing');
   $('screenMeta').textContent='تعذر فتح الطباعة لأن '+ar(bad.length)+' صفحة فيها قص أو فراغ كبير غير مبرر. أُوقف التصدير حتى تستقر الصفحة.';
   return false;
 }
 return true;
}
function releasePrintState(){
 printInProgress=false;
 const btn=$('printBtn');
 if(btn){btn.disabled=false;btn.textContent='طباعة';}
 document.documentElement.classList.remove('print-preparing');
 // لا نعيد إنشاء الصفحات بعد الطباعة؛ فقط نراجع القياس الموجود.
 scheduleRealPageFit();
}
$('printBtn').addEventListener('click',()=>{
 if(printInProgress)return;
 const btn=$('printBtn');
 if(!prepareExactPrint())return;
 printInProgress=true;
 btn.disabled=true;
 btn.textContent='جاري تجهيز الطباعة…';

 // window.print يستدعى مرة واحدة فقط. إعادة بناء DOM أثناء beforeprint
 // كانت تجعل بعض المتصفحات لا تفتح نافذة الطباعة أو تعيد توزيع الصفحات.
 requestAnimationFrame(()=>{
   try{window.print();}
   catch(e){
     console.error('paper print failed',e);
     $('screenMeta').textContent='تعذر فتح نافذة الطباعة في هذا المتصفح. أعد المحاولة بعد تحديث الصفحة.';
     releasePrintState();
   }
 });
});
addEventListener('beforeprint',()=>{
 // للطباعة المباشرة بـ Ctrl/Cmd+P فقط؛ زر المنصة جهّز الصفحات مسبقًا.
 if(!printInProgress)prepareExactPrint();
});
addEventListener('afterprint',releasePrintState);
render();
})();