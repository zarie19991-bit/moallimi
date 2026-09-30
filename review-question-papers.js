(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const letters=['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
function getDraft(){try{return JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');}catch(_){return null;}}
function subjectLabel(s){return({reading:'القراءة',math:'الرياضيات',science:'العلوم'})[s]||s||'—';}
function copiesFor(d,model){return(d.assignments||[]).filter(a=>a.model===model).length;}
function normText(s){return String(s||'').replace(/\s+/g,' ').trim();}
function renderQuestions(questions){
 const seenContexts=new Set(),seenImages=new Set();
 let out='';
 questions.forEach((q,i)=>{
   const contextKey=normText(q.context);
   if(contextKey&&!seenContexts.has(contextKey)){
     seenContexts.add(contextKey);
     out+='<div class="passage">'+esc(q.context)+'</div>';
   }
   const imageKey=String(q.image_url||'').trim();
   if(imageKey&&!seenImages.has(imageKey)){
     seenImages.add(imageKey);
     out+='<img class="q-image" src="'+esc(imageKey)+'" alt="'+esc(q.image_alt||'صورة مرتبطة بالأسئلة')+'">';
   }
   out+='<article class="question"><p class="stem">'+ar(i+1)+') '+esc(q.question||'')+'</p><div class="choices">'+
   (q.options||[]).map((o,j)=>'<div class="choice"><b>'+letters[j]+')</b><span>'+esc(o)+'</span></div>').join('')+
   '</div></article>';
 });
 return out;
}
function paper(model,d,copyIndex,totalCopies){
 const questions=model.questions||[];
 return '<section class="paper" data-model="'+esc(model.model)+'">'+
 '<header class="paper-head"><div><h1>'+esc(d.title||'مراجعة مؤشرات نافس')+'</h1><div class="meta"><span><b>المادة:</b> '+esc(subjectLabel(d.subject))+'</span><span><b>الفصل:</b> '+esc(d.class_name||'—')+'</span><span><b>الأسئلة:</b> '+ar(questions.length)+'</span></div></div><div class="model-badge">نموذج '+esc(model.model)+'</div></header>'+
 '<div class="instructions">اقرأ النصوص والأسئلة جيدًا، ثم سجّل إجابتك في ورقة التظليل. النص المشترك يظهر مرة واحدة فقط للأسئلة التابعة له.</div>'+
 renderQuestions(questions)+
 '<footer class="footer"><span>منصة معلّمي — مراجعة مؤشرات نافس</span><span>نموذج '+esc(model.model)+(totalCopies>1?' · نسخة '+ar(copyIndex)+'/'+ar(totalCopies):'')+'</span></footer></section>';
}
function render(){
 const d=getDraft();
 if(!d||!Array.isArray(d.models)||!d.models.length){document.body.innerHTML='<div class="empty"><h2>لا توجد أوراق أسئلة جاهزة بعد</h2><p>ارجع إلى قسم «المراجعة والتصحيح الآلي»، أنشئ النماذج ثم اعتمد التوزيع مرة أخرى.</p><a href="review-correction.html">العودة للقسم</a></div>';return;}
 $('screenTitle').textContent=d.title||'أوراق الأسئلة';
 $('screenMeta').textContent=ar(d.models.length)+' نماذج · '+ar((d.assignments||[]).length)+' طالب';
 $('modelFilter').innerHTML='<option value="all">جميع النماذج</option>'+d.models.map(m=>'<option value="'+esc(m.model)+'">نموذج '+esc(m.model)+' فقط</option>').join('');
 renderPages();
}
function renderPages(){
 const d=getDraft(),filter=$('modelFilter').value||'all',mode=$('copyMode').value||'master';
 const models=(d.models||[]).filter(m=>filter==='all'||m.model===filter);
 let html='';
 for(const m of models){
   const copies=mode==='students'?Math.max(1,copiesFor(d,m.model)):1;
   for(let i=1;i<=copies;i++)html+=paper(m,d,i,copies);
 }
 $('pages').innerHTML=html;
 const displayed=models.reduce((n,m)=>n+(mode==='students'?Math.max(1,copiesFor(d,m.model)):1),0);
 $('screenMeta').textContent=ar(models.length)+' نماذج · '+ar(displayed)+' نسخة معروضة للطباعة';
}
$('modelFilter').addEventListener('change',renderPages);
$('copyMode').addEventListener('change',renderPages);
$('printBtn').onclick=()=>window.print();
render();
})();