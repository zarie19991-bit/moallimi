/* Focused review only changes presentation; grading and audit stay server-side. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
let sheetId=null,answers=[],question=null,mode='pending',list=false;
const pending=a=>!a.reviewed_manually&&(a.state==='uncertain'||a.state==='multiple'||a.status==='ambiguous'||a.status==='multiple'||a.review_pending===true||a.requires_verification===true||Object.values(a.uncertainty||{}).some(v=>Array.isArray(v)&&v.length));
function visible(){return answers.filter(a=>mode==='all'||mode==='pending'&&pending(a)||mode==='multiple'&&(a.state==='multiple'||a.status==='multiple')&&!a.reviewed_manually||mode==='blank'&&a.state==='blank');}
function paint(){
 const rows=visible();if(!rows.some(a=>a.question===question))question=rows[0]?.question??null;
 const index=rows.findIndex(a=>a.question===question),count=answers.filter(pending).length;
 for(const row of $('answerEditor').children)row.hidden=!rows.some(a=>String(a.question)===row.dataset.question)||!list&&String(question)!==row.dataset.question;
 $('reviewFocusCount').textContent=count?'باقي '+count+' سؤالًا يحتاج قرارك من '+answers.length:'لا توجد إجابات معلّقة؛ تحقق من صورة الورقة ثم احفظ التحقق.';
 $('reviewQuestionPosition').textContent=rows.length?'السؤال '+question+' · '+(index+1)+' من '+rows.length+' في العرض الحالي':'لا توجد أسئلة في هذا التصنيف.';
 $('reviewQuestionPrev').disabled=index<=0;$('reviewQuestionNext').disabled=index<0||index>=rows.length-1;
 $('reviewQuestionList').textContent=list?'عرض سؤال واحد':'عرض القائمة';
 $('reviewFocusFilter').value=mode;
}
function mount(id,items){
 if(!$('reviewFocusToolbar')){
  const bar=document.createElement('section');bar.id='reviewFocusToolbar';bar.className='review-focus-toolbar';
  bar.innerHTML='<h3>مراجعة التظليل سؤالًا بسؤال</h3><p id="reviewFocusCount" role="status" aria-live="polite"></p><label>عرض <select id="reviewFocusFilter"><option value="pending">الأسئلة المعلّقة فقط</option><option value="multiple">متعدد التظليل</option><option value="blank">الإجابات الفارغة</option><option value="all">جميع الأسئلة</option></select></label><div class="actions"><button id="reviewQuestionPrev" type="button">السابق</button><button id="reviewQuestionNext" type="button">التالي</button><button id="reviewQuestionList" type="button">عرض القائمة</button></div><p id="reviewQuestionPosition" role="status" aria-live="polite"></p>';
  $('answerEditor').before(bar);
  $('reviewFocusFilter').onchange=e=>{mode=e.target.value;question=null;paint();};
  $('reviewQuestionPrev').onclick=()=>move(-1);$('reviewQuestionNext').onclick=()=>move(1);
  $('reviewQuestionList').onclick=()=>{list=!list;paint();};
 }
 if(sheetId!==id){sheetId=id;question=null;mode=items.some(pending)?'pending':'all';list=false;}
 answers=items;paint();
}
function move(delta){const rows=visible(),index=rows.findIndex(a=>a.question===question);if(rows[index+delta])question=rows[index+delta].question;paint();}
function focus(number){mode='all';list=false;question=Number(number);paint();$('reviewFocusToolbar').scrollIntoView({block:'nearest'});}
window.NafesReviewFocus={mount,focus};
})();
