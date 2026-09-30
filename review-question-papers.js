(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const letters=['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
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
function groupsFromQuestions(questions){
 const groups=[];
 questions.forEach((q,i)=>{
   const ctx=String(q.context||'').trim();
   const last=groups.at(-1);
   if(ctx&&last?.context&&similarity(ctx,last.context)>=.80){
     last.questions.push({...q,_no:i+1});
     if(norm(ctx).length>norm(last.context).length)last.context=ctx;
   }else if(!ctx&&last&&!last.context){
     last.questions.push({...q,_no:i+1});
   }else{
     groups.push({context:ctx,questions:[{...q,_no:i+1}]});
   }
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
 const total=groups.reduce((n,g)=>n+groupUnits(g),0),target=total/2;
 const pages=[[],[]];let used=0,page=0;
 for(const g of groups){
   const units=groupUnits(g);
   if(page===0&&used>0&&used+units>target){
     page=1;
   }
   if(page===0&&units>target&&g.questions.length>1){
     const first={context:g.context,questions:[]},second={context:'',continued:true,questions:[]};
     let gu= g.context?8+Math.ceil(String(g.context).length/180)*3.2:0;
     for(const q of g.questions){
       const qu=questionUnits(q);
       if(first.questions.length&&gu+qu>target){second.questions.push(q);}
       else{first.questions.push(q);gu+=qu;}
     }
     pages[0].push(first);
     if(second.questions.length)pages[1].push(second);
     page=1;used=0;
   }else{
     pages[page].push(g);used+=units;
   }
 }
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
function pageHeader(model,d,pageNo,totalQuestions){
 return '<div class="exam-frame-head">'+
 '<div class="official"><b>المملكة العربية السعودية</b><b>وزارة التعليم</b><b>إدارة تعليم نجران</b><b>مدرسة ابن سينا المتوسطة</b></div>'+
 '<div class="exam-brand">مراجعة نافس</div>'+
 '<div class="grade-box"><b>ثالث متوسط</b><span>نموذج '+esc(model.model)+'</span></div>'+
 '</div>'+
 '<div class="title-strip">'+esc(d.title||'مراجعة مؤشرات نافس')+'</div>'+
 '<div class="student-line"><b>الاسم:</b><span></span></div>'+
 '<div class="page-number">الصفحة '+ar(pageNo)+' من ٢ · عدد الأسئلة '+ar(totalQuestions)+'</div>';
}
function onePage(model,d,groups,pageNo,totalQuestions){
 return '<section class="paper-page" data-model="'+esc(model.model)+'" data-page="'+pageNo+'"><div class="page-inner"><div class="page-flow">'+
 pageHeader(model,d,pageNo,totalQuestions)+
 (pageNo===1?'':'')+
 groups.map(renderGroup).join('')+
 '<footer class="footer"><span>منصة معلّمي — مراجعة مؤشرات نافس</span><span>نموذج '+esc(model.model)+' · '+ar(pageNo)+'/٢</span></footer>'+
 '</div></div></section>';
}
function modelBooklet(model,d){
 const questions=model.questions||[],groups=groupsFromQuestions(questions),pages=splitIntoTwo(groups);
 return '<div class="model-booklet" data-booklet="'+esc(model.model)+'">'+onePage(model,d,pages[0],1,questions.length)+onePage(model,d,pages[1],2,questions.length)+'</div>';
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
 $('screenMeta').textContent=ar(models.length)+' نماذج · صفحتان كحد أقصى لكل نموذج · '+ar(copies)+' نسخة';
}
$('modelFilter').addEventListener('change',renderPages);
$('copyMode').addEventListener('change',renderPages);
$('printBtn').onclick=()=>window.print();
render();
})();