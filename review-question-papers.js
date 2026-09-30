(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const letters=['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
function getDraft(){try{return JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');}catch(_){return null;}}
function subjectLabel(s){return({reading:'القراءة',math:'الرياضيات',science:'العلوم'})[s]||s||'—';}
function copiesFor(d,model){return(d.assignments||[]).filter(a=>a.model===model).length;}
function paper(model,d,copyIndex,totalCopies){
 const questions=model.questions||[];
 return '<section class="paper" data-model="'+esc(model.model)+'">'+
 '<header class="paper-head"><div><h1>'+esc(d.title||'مراجعة مؤشرات نافس')+'</h1><div class="meta"><span><b>المادة:</b> '+esc(subjectLabel(d.subject))+'</span><span><b>الفصل:</b> '+esc(d.class_name||'—')+'</span><span><b>عدد الأسئلة:</b> '+ar(questions.length)+'</span><span><b>النسخة:</b> '+ar(copyIndex)+' من '+ar(totalCopies)+'</span></div></div><div class="model-badge">نموذج '+esc(model.model)+'</div></header>'+
 '<div class="instructions">اقرأ السؤال جيدًا، ثم اختر إجابة واحدة فقط لكل سؤال، وسجّل الإجابة في ورقة التظليل الخاصة بك.</div>'+
 '<div class="copy-note">هذه الورقة مخصّصة للأسئلة فقط؛ الإجابات تُسجّل في ورقة التظليل المطبوعة باسم الطالب.</div>'+
 questions.map((q,i)=>'<article class="question">'+
 (q.context?'<div class="context">'+esc(q.context)+'</div>':'')+
 (q.image_url?'<img class="q-image" src="'+esc(q.image_url)+'" alt="'+esc(q.image_alt||'صورة مرتبطة بالسؤال')+'">':'')+
 '<p class="stem">'+ar(i+1)+') '+esc(q.question||'')+'</p>'+
 '<div class="choices">'+(q.options||[]).map((o,j)=>'<div class="choice"><b>'+letters[j]+')</b><span>'+esc(o)+'</span></div>').join('')+'</div></article>').join('')+
 '<footer class="footer"><span>منصة معلّمي — مراجعة مؤشرات نافس</span><span>نموذج '+esc(model.model)+'</span></footer></section>';
}
function render(){
 const d=getDraft();
 if(!d||!Array.isArray(d.models)||!d.models.length){document.body.innerHTML='<div class="empty"><h2>لا توجد أوراق أسئلة جاهزة بعد</h2><p>ارجع إلى قسم «المراجعة والتصحيح الآلي»، أنشئ النماذج ثم اضغط «اعتماد التوزيع وتجهيز أوراق التظليل» حتى تحفظ أوراق الأسئلة للطباعة.</p><a href="review-correction.html">العودة للقسم</a></div>';return;}
 $('screenTitle').textContent=d.title||'أوراق الأسئلة';
 $('screenMeta').textContent=ar(d.models.length)+' نماذج · '+ar((d.assignments||[]).length)+' طالب';
 $('modelFilter').innerHTML='<option value="all">جميع النماذج بعدد الطلاب</option>'+d.models.map(m=>'<option value="'+esc(m.model)+'">نموذج '+esc(m.model)+' فقط</option>').join('');
 renderPages();
}
function renderPages(){
 const d=getDraft(),filter=$('modelFilter').value||'all';
 const models=(d.models||[]).filter(m=>filter==='all'||m.model===filter);
 let html='';
 for(const m of models){
   const copies=filter==='all'?Math.max(1,copiesFor(d,m.model)):1;
   for(let i=1;i<=copies;i++)html+=paper(m,d,i,copies);
 }
 $('pages').innerHTML=html;
}
$('modelFilter').addEventListener('change',renderPages);
$('printBtn').onclick=()=>window.print();
render();
})();