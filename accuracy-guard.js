(()=>{
const BLOCKED=new Set(['math','science']);
const LABEL={math:'الرياضيات',science:'العلوم'};
function activeNafesKey(){
  const btns=[...document.querySelectorAll('#nafesArea .nafes-subject')];
  const i=btns.findIndex(b=>b.classList.contains('active'));
  return ['arabic','math','science'][Math.max(0,i)]||'arabic';
}
function warningHtml(key){return `<div class="accuracy-warning" style="margin:18px 0;padding:22px;border:1px solid #d8c58d;border-radius:18px;background:#fffaf0;color:#493f26"><h3 style="margin:0 0 8px;font-size:18px">تم إيقاف محتوى نافس السابق في ${LABEL[key]}</h3><p style="margin:0;line-height:1.9">المؤشرات والاختبارات التي كانت هنا لم تكن مبنية على وثيقة نواتج التعلم الرسمية، لذلك أوقفت عرضها وإرسالها. الملف المدرسي المرفوع يثبت أن ${LABEL[key]} من مواد نافس، لكنه لا يسرد مؤشرات المادة التفصيلية. لن يظهر هنا أي معيار أو اختبار جديد إلا بعد إدخاله من المرجع الرسمي لهيئة تقويم التعليم والتدريب.</p></div>`}
function scrubNafes(){
  const area=document.getElementById('nafesArea'); if(!area||!area.children.length)return;
  const key=activeNafesKey();
  const old=area.querySelector('.accuracy-warning');
  if(!BLOCKED.has(key)){
    if(old)old.remove();
    area.querySelectorAll('[data-accuracy-hidden="1"]').forEach(el=>{el.style.display='';el.removeAttribute('data-accuracy-hidden')});
    return;
  }
  area.querySelectorAll('.nafes-goal,.nafes-tests,.nafes-model-bank,.nafes-unlimited-btn,.nafes-unlimited-hint').forEach(el=>{el.style.display='none';el.setAttribute('data-accuracy-hidden','1')});
  if(!old){
    const host=area.querySelector('.nafes-headline')||area.firstElementChild;
    if(host)host.insertAdjacentHTML('afterend',warningHtml(key)); else area.insertAdjacentHTML('afterbegin',warningHtml(key));
  }
}
const originalCreator=window.openNafesTestCreator;
window.openNafesTestCreator=function(key){
  key=key||activeNafesKey();
  if(BLOCKED.has(key)){if(typeof toast==='function')toast('تم إيقاف إنشاء اختبارات نافس في '+LABEL[key]+' حتى اعتماد المؤشرات الرسمية.',true);return;}
  return originalCreator?.apply(this,arguments);
};
const originalModel=window.openNafesCriterionModel;
window.openNafesCriterionModel=function(id,key){
  if(BLOCKED.has(key)){if(typeof toast==='function')toast('هذا النموذج غير معتمد وتم إيقافه.',true);return;}
  return originalModel?.apply(this,arguments);
};
function scrubAchievement(){
  const area=document.getElementById('achievementArea'); if(!area||!area.children.length)return;
  const key=state?.achievementOfficialPage||'';
  if(key==='nafes-results'||key==='nafes-plan'){
    const paper=area.querySelector('.ach-paper'); if(!paper)return;
    let note=paper.querySelector('.achievement-accuracy-note');
    if(!note){
      note=document.createElement('div');note.className='achievement-accuracy-note';
      note.innerHTML='<div style="margin:18px 0;padding:18px;border:1px solid #d8c58d;border-radius:16px;background:#fffaf0;color:#493f26"><b>تنبيه دقة البيانات:</b> تم استبعاد نتائج ومؤشرات نافس السابقة في الرياضيات والعلوم لأنها لم تكن مبنية على المرجع الرسمي. يبقى هنا فقط منطق المعالجة الذي يدعمه ملف التحصيل، ولا تُعتمد نتائج الرياضيات والعلوم حتى إعادة بنائها من وثيقة هيئة تقويم التعليم والتدريب.</div>';
      const head=paper.querySelector('.ach-paper-head'); if(head)head.insertAdjacentElement('afterend',note); else paper.prepend(note);
    }
    const metrics=paper.querySelector('.ach-metrics'); if(metrics){
      [...metrics.children].forEach(el=>{const t=el.textContent||'';if(t.includes('الرياضيات')||t.includes('العلوم'))el.style.display='none'});
    }
  }
  if((key==='periodic'||key==='final'||key==='subjects'||key==='previous')&&BLOCKED.has(state?.subject)){
    const paper=area.querySelector('.ach-paper'); if(!paper||paper.querySelector('.subject-accuracy-note'))return;
    const n=document.createElement('div');n.className='subject-accuracy-note';
    n.innerHTML='<div style="margin:12px 0;padding:14px;border:1px solid #e1d8bc;border-radius:14px;background:#fffdf7;color:#5b5135"><b>ملاحظة:</b> أي تحليل ظاهر هنا يعتمد فقط على نتائج فعلية مسجلة للطلاب. لا تُستخدم المؤشرات السابقة في الرياضيات أو العلوم بعد إيقافها.</div>';
    const head=paper.querySelector('.ach-paper-head'); if(head)head.insertAdjacentElement('afterend',n);
  }
}
const originalRenderAchievement=window.renderAchievement;
if(typeof originalRenderAchievement==='function')window.renderAchievement=function(){const r=originalRenderAchievement.apply(this,arguments);queueMicrotask(scrubAchievement);return r};
const nafes=document.getElementById('nafesArea');if(nafes)new MutationObserver(()=>queueMicrotask(scrubNafes)).observe(nafes,{childList:true,subtree:true});
const ach=document.getElementById('achievementArea');if(ach)new MutationObserver(()=>queueMicrotask(scrubAchievement)).observe(ach,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('[data-section="nafes"],.nafes-subject'))setTimeout(scrubNafes,40);if(e.target.closest('[data-section="achievement"]'))setTimeout(scrubAchievement,40)});
setTimeout(()=>{scrubNafes();scrubAchievement()},700);
})();