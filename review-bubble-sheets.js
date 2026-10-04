(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
let activeDraft=null;
function draft(){if(activeDraft)return activeDraft;try{return JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');}catch(_){return null;}}
function digitPanel(title,cols,klass=''){
 const boxes='<div class="digit-boxes">'+Array.from({length:cols},()=>'<span class="digit-box"></span>').join('')+'</div>';
 const rows='<div class="digit-bubbles">'+Array.from({length:10},(_,d)=>'<div class="digit-row">'+Array.from({length:cols},()=>'<i>'+d+'</i>').join('')+'</div>').join('')+'</div>';
 return '<section class="digit-panel '+klass+'"><h3>'+title+'</h3>'+boxes+rows+'</section>';
}
function makeSheet(item,index,d){
 const total=Number(d.question_count||20),sheetNo=Number(item.sheet_no||index+1),nameMode=d.bubble_name_mode==='blank'?'blank':'printed';
 const payload='MR4|'+String(d.review_id||'R')+'|'+String(sheetNo)+'|'+String(item.model||'');
 const name=nameMode==='printed'?esc(item.student_name||''):'';
 const school=esc(d.school_name||''),cls=esc(d.class_name||'');
 return '<section class="bubble-sheet" data-qr="'+esc(payload)+'">'+
 '<div class="sheet-title"><span>ورقة التظليل</span></div>'+
 '<div class="brand-row">'+
   '<div class="brand-spacer" aria-hidden="true"></div>'+
   '<div class="sheet-logo-wrap" aria-hidden="true"></div>'+
   '<div class="qr" data-qr-box aria-label="رمز الورقة"></div>'+
 '</div>'+
 '<div class="exam-pill"><b>الاختبارات الوطنية</b><span>الصف الثالث متوسط</span></div>'+
 '<div class="student-name"><b>الاسم الرباعي</b><span>'+name+'</span></div>'+
 '<div class="info-grid">'+
   digitPanel('رقم السجل المدني / رقم الإقامة',10,'identity-number')+
   digitPanel('رمز المدرسة',6,'school-code')+
   '<div class="info-stack">'+
     '<div class="info-panel"><b>اسم المدرسة</b><span class="field-line">'+school+'</span></div>'+
     '<div class="info-panel"><b>الصف</b><span class="field-line">'+cls+'</span></div>'+
     '<div class="info-panel grade-panel"><span class="grade-line"></span><strong>الصف الثالث متوسط</strong></div>'+
   '</div>'+
 '</div>'+
 '<div class="answers-title">إجابات الأسئلة</div>'+
 '<div class="omr-wrap">'+NafesOmrTemplate.svg(1,60,total)+'</div>'+
 '<div class="sheet-meta" aria-hidden="true"><span class="model-hidden">نموذج '+esc(item.model||'—')+'</span><span class="sheet-code">'+esc(payload)+'</span></div>'+
 '</section>';
}
function renderOmrQr(box,payload){
 const lib=window.qrcodegen;if(!lib?.QrCode)throw new Error('تعذر تحميل مولّد QR.');
 const qr=lib.QrCode.encodeText(String(payload||''),lib.QrCode.Ecc.MEDIUM),quiet=4,scale=6,side=(qr.size+quiet*2)*scale;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=side;
 canvas.style.cssText='display:block;width:100%;height:auto;image-rendering:pixelated;background:#fff';
 const g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,side,side);g.fillStyle='#000';
 for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))g.fillRect((x+quiet)*scale,(y+quiet)*scale,scale,scale);
 box.replaceChildren(canvas);box.dataset.qrPayload=payload;
}
async function render(){
 activeDraft=await (window.NafesPaperReviewDraft?.load?.()||Promise.resolve(draft()));
 const d=draft();
 if(!d||!Array.isArray(d.assignments)||!d.assignments.length){document.body.innerHTML='<div style="padding:40px;text-align:center;font-family:Tahoma">لا توجد مراجعة مجهزة للطباعة.</div>';return;}
 if(Number(d.question_count||0)<1||Number(d.question_count||0)>60){document.body.innerHTML='<div style="padding:40px;text-align:center;font-family:Tahoma">ورقة التظليل تدعم من سؤال واحد حتى ٦٠ سؤالًا.</div>';return;}
 $('screenTitle').textContent=d.title||'أوراق التظليل';
 $('screenMeta').textContent=ar(d.assignments.length)+' طالب · '+ar(d.question_count)+' سؤال · '+(d.bubble_name_mode==='blank'?'الاسم فارغ':'الاسم مطبوع');
 const rid=d.review_id||new URLSearchParams(location.search).get('rid')||'';
 document.querySelectorAll('a[href^="review-scan.html"]').forEach(a=>a.href='review-scan.html'+(rid?'?rid='+encodeURIComponent(rid):''));
 $('pages').innerHTML=d.assignments.map((item,i)=>'<section class="paper">'+makeSheet(item,i,d)+'</section>').join('');
 for(const sheet of document.querySelectorAll('.bubble-sheet')){
   const box=sheet.querySelector('[data-qr-box]');
   try{renderOmrQr(box,sheet.dataset.qr);}catch(_){box.textContent='QR';}
 }
}
$('printBtn').onclick=()=>window.print();
render();
})();