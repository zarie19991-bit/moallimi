(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const letters=['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
const DEFAULT_QUESTION_START=1;
let activeDraft=null;
function getDraft(){if(activeDraft)return activeDraft;try{return JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');}catch(_){return null;}}
function subjectLabel(s){return({reading:'القراءة',math:'الرياضيات',science:'العلوم'})[s]||s||'—';}
function copiesFor(d,model){return(d.assignments||[]).filter(a=>a.model===model).length;}
function norm(s){return String(s||'').normalize('NFKC').replace(/[\u064B-\u0652\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ة/g,'ه').replace(/[ىي]/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();}
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
   const ctx=String(q.context||'').trim();
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

 // القراءة تبقى محافظة على النص مع أسئلته كوحدة واحدة.
 if(subject==='reading'){
   const pages=[];let page=[],units=0;
   const LIMIT=58;
   for(const g of valid){
     const gu=groupUnits(g);
     if(page.length&&units+gu>LIMIT){pages.push(page);page=[];units=0;}
     page.push(g);units+=gu;
   }
   if(page.length)pages.push(page);
   return pages.length?pages:[[]];
 }

 // الرياضيات والعلوم: نملأ A4 فعليًا بدل إيقاف الصفحة مبكرًا.
 // نحسب عدد الصفحات أولًا ثم نوازن الحمل بينها حتى لا تبقى صفحة
 // فيها سؤالان أو ثلاثة بينما الصفحة السابقة ما زالت تتسع.
 const SOFT_LIMIT=118;
 const HARD_LIMIT=134;
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
   const balancedBreak=canBreak&&pageUnits+u>target;
   const hardBreak=canBreak&&pageUnits+u>HARD_LIMIT;

   if(balancedBreak||hardBreak){
     pages.push(page);
     remainingUnits-=pageUnits;
     remainingPages=Math.max(1,remainingPages-1);
     page=[];pageUnits=0;
   }
   page.push(g);pageUnits+=u;
 }
 if(page.length)pages.push(page);

 // معالجة أخيرة: لا نترك الصفحة الأخيرة ضعيفة إذا أمكن نقل سؤال
 // من الصفحة السابقة دون تجاوز الحد الصلب.
 if(pages.length>1){
   const unitsOf=p=>p.reduce((n,g)=>n+groupUnits(g),0);
   let last=pages[pages.length-1],prev=pages[pages.length-2];
   while(prev.length>1&&unitsOf(last)<unitsOf(prev)*0.72){
     const candidate=prev[prev.length-1];
     if(unitsOf(last)+groupUnits(candidate)>HARD_LIMIT)break;
     last.unshift(prev.pop());
   }
 }
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
 const subjects=(Array.isArray(d.subjects)&&d.subjects.length?d.subjects:[d.subject]).filter(Boolean);
 const subjectText=subjects.map(subjectLabel).join(' + ');
 return '<div class="exam-frame-head">'+
 '<div class="official"><b>المملكة العربية السعودية</b><b>وزارة التعليم</b><b>إدارة تعليم نجران</b><b>مدرسة ابن سينا المتوسطة</b></div>'+
 '<div class="exam-brand">مراجعة نافس</div>'+
 '<div class="grade-box"><b>ثالث متوسط</b><span>نموذج '+esc(model.model)+'</span></div>'+
 '</div>'+
 '<div class="title-strip">'+esc(d.title||'مراجعة مؤشرات نافس')+(subjectText?'<small>'+esc(subjectText)+'</small>':'')+'</div>'+
 '<div class="student-line"><b>الاسم:</b><span></span></div>'+
 '<div class="page-number">الصفحة '+ar(pageNo)+' من '+ar(totalPages)+' · عدد الأسئلة '+ar(totalQuestions)+'</div>';
}
function onePage(model,d,groups,pageNo,totalPages,totalQuestions){
 const subjects=(Array.isArray(d.subjects)&&d.subjects.length?d.subjects:[d.subject]).filter(Boolean);
 const mode=subjects.length>1?'mixed':(subjects[0]||d.subject||'');
 return '<section class="paper-page" data-model="'+esc(model.model)+'" data-subject="'+esc(mode)+'" data-page="'+pageNo+'"><div class="page-inner"><div class="page-flow">'+
 pageHeader(model,d,pageNo,totalPages,totalQuestions)+
 '<div class="questions-flow">'+groups.map(g=>renderGroup(g)).join('')+'</div>'+
 '<footer class="footer"><span>منصة معلّمي — مراجعة مؤشرات نافس</span><span>نموذج '+esc(model.model)+' · '+ar(pageNo)+'/'+ar(totalPages)+'</span></footer>'+
 '</div></div></section>';
}
function modelBooklet(model,d){
 const questions=model.questions||[],startNo=Number(d.question_start||DEFAULT_QUESTION_START),groups=groupsFromQuestions(questions,startNo);
 const subjects=(Array.isArray(d.subjects)&&d.subjects.length?d.subjects:[d.subject]).filter(Boolean);
 if(subjects.length===1&&subjects[0]==='reading'&&questions.length===20){
   const bad=groups.length!==4||groups.some(g=>!g.context||g.questions.length!==5);
   if(bad)return '<section class="paper-page error-page"><div class="page-inner"><div class="layout-error"><h2>هذا النموذج غير صالح للطباعة</h2><p>يجب أن يتكون من ٤ نصوص، وتحت كل نص ٥ أسئلة. أعد إنشاء النماذج من قسم المراجعة والتصحيح الآلي.</p></div></div></section>';
   return '<div class="model-booklet" data-booklet="'+esc(model.model)+'">'+groups.map((g,i)=>onePage(model,d,[g],i+1,4,questions.length)).join('')+'</div>';
 }
 const mode=subjects.length>1?'mixed':(subjects[0]||d.subject);
 const pages=paginateGroups(groups,mode);
 return '<div class="model-booklet" data-booklet="'+esc(model.model)+'">'+pages.map((page,i)=>onePage(model,d,page,i+1,pages.length,questions.length)).join('')+'</div>';
}
function pageFits(page){
 const flow=page?.querySelector('.questions-flow');
 if(!flow)return true;
 return flow.scrollHeight<=flow.clientHeight+2;
}
function emptyPageFrom(page){
 const clone=page.cloneNode(true);
 clone.querySelector('.questions-flow')?.replaceChildren();
 return clone;
}
function renumberBooklet(booklet){
 const pages=[...booklet.querySelectorAll(':scope > .paper-page')];
 const total=pages.length;
 pages.forEach((page,i)=>{
   const no=i+1;
   page.dataset.page=String(no);
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
function fitBooklet(booklet){
 const first=booklet.querySelector(':scope > .paper-page');
 if(!first||first.dataset.subject==='reading')return;

 let pages=[...booklet.querySelectorAll(':scope > .paper-page')];

 // أولاً: أي صفحة ممتلئة أكثر من المساحة الفعلية تنقل آخر سؤال
 // إلى الصفحة التالية حتى لا يُقص أي سؤال أو اختيار.
 for(let i=0;i<pages.length;i++){
   let page=pages[i],flow=page.querySelector('.questions-flow');
   while(!pageFits(page)&&flow?.children.length>1){
     let next=pages[i+1];
     if(!next){
       next=emptyPageFrom(page);
       booklet.insertBefore(next,page.nextSibling);
       pages=[...booklet.querySelectorAll(':scope > .paper-page')];
     }
     const nextFlow=next.querySelector('.questions-flow');
     nextFlow.prepend(flow.lastElementChild);
   }
 }

 // ثانياً: نملأ الفراغ الحقيقي في كل صفحة من الصفحة التالية.
 // القياس هنا من المتصفح نفسه، لا من تقدير تقريبي لطول النص.
 pages=[...booklet.querySelectorAll(':scope > .paper-page')];
 for(let i=0;i<pages.length-1;i++){
   const page=pages[i],flow=page.querySelector('.questions-flow');
   let next=pages[i+1],nextFlow=next.querySelector('.questions-flow');
   while(nextFlow?.firstElementChild){
     const candidate=nextFlow.firstElementChild;
     flow.append(candidate);
     if(!pageFits(page)){
       nextFlow.prepend(candidate);
       break;
     }
   }
 }

 // احذف الصفحات الفارغة ثم أعد المحاولة مرة ثانية بعد تغير التوزيع.
 [...booklet.querySelectorAll(':scope > .paper-page')].forEach(page=>{
   if(!page.querySelector('.questions-flow')?.children.length)page.remove();
 });
 pages=[...booklet.querySelectorAll(':scope > .paper-page')];
 for(let i=0;i<pages.length-1;i++){
   const page=pages[i],flow=page.querySelector('.questions-flow');
   const next=pages[i+1],nextFlow=next.querySelector('.questions-flow');
   while(nextFlow?.firstElementChild){
     const candidate=nextFlow.firstElementChild;
     flow.append(candidate);
     if(!pageFits(page)){nextFlow.prepend(candidate);break;}
   }
 }
 [...booklet.querySelectorAll(':scope > .paper-page')].forEach(page=>{
   if(!page.querySelector('.questions-flow')?.children.length)page.remove();
 });
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
 if(!d||!Array.isArray(d.models)||!d.models.length){document.body.innerHTML='<div class="empty"><h2>لا توجد أوراق أسئلة جاهزة بعد</h2><p>ارجع إلى قسم «المراجعة والتصحيح الآلي»، أنشئ النماذج ثم اعتمد التوزيع مرة أخرى.</p><a href="review-correction.html">العودة للقسم</a></div>';return;}
 $('screenTitle').textContent=d.title||'أوراق الأسئلة';
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
$('printBtn').onclick=()=>window.print();
render();
})();