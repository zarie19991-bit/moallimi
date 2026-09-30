(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const letters=['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
const DEFAULT_QUESTION_START=1;
function getDraft(){try{return JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');}catch(_){return null;}}
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
 const groups=[],byKey=new Map();
 questions.forEach((q,i)=>{
   const ctx=String(q.context||'').trim();
   const key=ctx?norm(ctx):'__NO_CONTEXT__:'+i;
   let group=byKey.get(key);
   if(!group){
     group={context:ctx,questions:[]};
     groups.push(group);
     byKey.set(key,group);
   }
   group.questions.push({...q,_no:startNo+i});
 });
 return groups;
}
function questionUnits(q){
 const stem=String(q.question||'').length,opts=(q.options||[]).join(' ').length;
 return 7+Math.ceil(stem/85)*1.5+Math.ceil(opts/130)*1.4+(q.image_url?10:0);
}
function groupUnits(g){
 return (g.context?8+Math.ceil(String(g.context).length/180)*3.2:0)+g.questions.reduce((n,q)=>n+questionUnits(q),0);
}
function splitIntoTwo(groups){
 const valid=groups.filter(g=>g&&g.questions?.length);
 if(valid.length===4&&valid.every(g=>g.questions.length===5)){
   return [valid.slice(0,2),valid.slice(2,4)];
 }
 const pages=[[],[]];
 const target=Math.ceil(valid.length/2);
 valid.forEach((g,i)=>pages[i<target?0:1].push(g));
 return pages;
}
function cleanStem(question,context){
 const stem=String(question||'').trim(),ctx=String(context||'').trim();
 if(ctx.length>90&&stem.startsWith(ctx))return stem.slice(ctx.length).replace(/^\s*[:\-–—،.؛]*\s*/,'').trim()||stem;
 return stem;
}
function renderQuestion(q,context){
 return '<article class="question"><p class="stem">'+ar(q._no)+') '+esc(cleanStem(q.question,context))+'</p><div class="choices">'+
 (q.options||[]).map((o,j)=>'<div class="choice"><b>'+letters[j]+')</b><span>'+esc(o)+'</span></div>').join('')+
 '</div></article>';
}
function renderGroup(g){
 let out='<section class="passage-group">';
 if(g.context)out+='<div class="passage">'+esc(g.context)+'</div>';
 if(g.continued)out+='<div class="continued">تابع أسئلة النص السابق</div>';
 const first=g.questions[0]?._no||1,last=g.questions.at(-1)?._no||first;
 out+='<div class="after-passage">بعد قراءتك للنص أعلاه، أجب عن الأسئلة من '+ar(first)+' - '+ar(last)+'</div>';
 const seenImages=new Set();
 for(const q of g.questions){const src=String(q.image_url||'').trim();if(src&&!seenImages.has(src)){seenImages.add(src);out+='<img class="q-image" src="'+esc(src)+'" alt="'+esc(q.image_alt||'صورة مرتبطة بالأسئلة')+'">';}}
 out+='<div class="passage-questions">'+g.questions.map(q=>renderQuestion(q,g.context)).join('')+'</div></section>';
 return out;
}
function pageHeader(model,d,pageNo,totalPages,totalQuestions){
 return '<div class="exam-frame-head">'+
 '<div class="official"><b>المملكة العربية السعودية</b><b>وزارة التعليم</b><b>إدارة تعليم نجران</b><b>مدرسة ابن سينا المتوسطة</b></div>'+
 '<div class="exam-brand">مراجعة نافس</div>'+
 '<div class="grade-box"><b>ثالث متوسط</b><span>نموذج '+esc(model.model)+'</span></div>'+
 '</div>'+
 '<div class="title-strip">'+esc(d.title||'مراجعة مؤشرات نافس')+'</div>'+
 '<div class="student-line"><b>الاسم:</b><span></span></div>'+
 '<div class="page-number">الصفحة '+ar(pageNo)+' من '+ar(totalPages)+' · عدد الأسئلة '+ar(totalQuestions)+'</div>';
}
function onePage(model,d,groups,pageNo,totalPages,totalQuestions){
 return '<section class="paper-page" data-model="'+esc(model.model)+'" data-page="'+pageNo+'"><div class="page-inner"><div class="page-flow">'+
 pageHeader(model,d,pageNo,totalPages,totalQuestions)+
 groups.map(renderGroup).join('')+
 '<footer class="footer"><span>منصة معلّمي — مراجعة مؤشرات نافس</span><span>نموذج '+esc(model.model)+' · '+ar(pageNo)+'/'+ar(totalPages)+'</span></footer>'+
 '</div></div></section>';
}
function modelBooklet(model,d){
 const questions=model.questions||[],startNo=Number(d.question_start||DEFAULT_QUESTION_START),groups=groupsFromQuestions(questions,startNo);
 if(d.subject==='reading'&&questions.length===20){
   const bad=groups.length!==4||groups.some(g=>!g.context||g.questions.length!==5);
   if(bad){
     return '<section class="paper-page error-page"><div class="page-inner"><div class="layout-error"><h2>هذا النموذج غير صالح للطباعة</h2><p>يجب أن يتكون من ٤ نصوص، وتحت كل نص ٥ أسئلة. أعد إنشاء النماذج من قسم المراجعة والتصحيح الآلي.</p></div></div></section>';
   }
   return '<div class="model-booklet" data-booklet="'+esc(model.model)+'">'+
     groups.map((g,i)=>onePage(model,d,[g],i+1,4,questions.length)).join('')+
     '</div>';
 }
 const pages=splitIntoTwo(groups);
 return '<div class="model-booklet" data-booklet="'+esc(model.model)+'">'+onePage(model,d,pages[0],1,2,questions.length)+onePage(model,d,pages[1],2,2,questions.length)+'</div>';
}
function render(){
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
 const copies=models.reduce((n,m)=>n+(mode==='students'?Math.max(1,copiesFor(d,m.model)):1),0);
 $('screenMeta').textContent=ar(models.length)+' نماذج · ورقتان A4 عند الطباعة على الوجهين لكل نموذج · '+ar(copies)+' نسخة';
}
$('modelFilter').addEventListener('change',renderPages);
$('copyMode').addEventListener('change',renderPages);
$('printBtn').onclick=()=>window.print();
render();
})();