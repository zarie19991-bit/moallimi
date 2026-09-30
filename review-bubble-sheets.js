(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const DEFAULT_QUESTION_START=1;
let activeDraft=null;
function draft(){if(activeDraft)return activeDraft;try{return JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');}catch(_){return null;}}
function makeSheet(item,index,d){
 const total=Number(d.question_count||20),startNo=Number(d.question_start||DEFAULT_QUESTION_START),sheetNo=Number(item.sheet_no||index+1);
 const payload='MR2|'+String(d.review_id||'R')+'|'+String(sheetNo)+'|'+String(item.model||'');
 return '<section class="bubble-sheet" data-qr="'+esc(payload)+'">'+
 '<header class="sheet-head"><div class="identity"><h1>'+esc(d.title||'مراجعة مؤشرات نافس')+'</h1>'+
 '<div class="identity-grid"><span><b>اسم الطالب:</b> '+esc(item.student_name||'')+'</span><span><b>الفصل:</b> '+esc(d.class_name||'—')+'</span>'+
 '<span><b>المادة:</b> '+esc(({reading:'القراءة',math:'الرياضيات',science:'العلوم'})[d.subject]||d.subject||'—')+'</span><span><b>عدد الأسئلة:</b> '+ar(total)+'</span></div>'+
 '<div class="model">نموذج '+esc(item.model||'—')+'</div></div><div class="qr" data-qr-box></div></header>'+
 '<div class="omr-wrap">'+NafesOmrTemplate.svg(startNo,total)+'</div>'+
 '<footer class="sheet-foot">ظلّل دائرة واحدة فقط لكل سؤال تظليلًا واضحًا. عند تغيير الإجابة امسح التظليل السابق جيدًا.<div class="sheet-code">'+esc(payload)+'</div></footer></section>';
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
 $('screenTitle').textContent=d.title||'أوراق التظليل';
 $('screenMeta').textContent=ar(d.assignments.length)+' طالب · '+ar(d.model_count||5)+' نماذج';
 const rid=d.review_id||new URLSearchParams(location.search).get('rid')||'';
 document.querySelectorAll('a[href^="review-scan.html"]').forEach(a=>a.href='review-scan.html'+(rid?'?rid='+encodeURIComponent(rid):''));
 let html='';
 for(let i=0;i<d.assignments.length;i+=2){
   html+='<section class="paper">';
   html+=makeSheet(d.assignments[i],i,d);
   if(d.assignments[i+1])html+=makeSheet(d.assignments[i+1],i+1,d);
   html+='</section>';
 }
 $('pages').innerHTML=html;
 for(const sheet of document.querySelectorAll('.bubble-sheet')){
   const box=sheet.querySelector('[data-qr-box]');
   try{renderOmrQr(box,sheet.dataset.qr);}catch(_){box.textContent='QR غير متاح';}
 }
}
$('printBtn').onclick=()=>window.print();
render();
})();