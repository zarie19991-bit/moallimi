(()=>{
'use strict';
function enhance(root){
  if(!root||root.dataset.practiceEnhanced==='1')return;
  root.dataset.practiceEnhanced='1';
  const body=root.querySelector('.lw3-body');
  const examples=root.querySelector('#lw3-examples');
  const practice=root.querySelector('#lw3-practice');
  const diagnostic=root.querySelector('#lw3-diagnostic');
  if(!body||!practice)return;
  if(examples&&examples.nextElementSibling!==practice){examples.insertAdjacentElement('afterend',practice)}
  const title=practice.querySelector('.lw3-section-title h3');
  if(title)title.textContent='التدريب على المؤشر — ٥ أسئلة';
  const small=practice.querySelector('.lw3-section-title small');
  if(small)small.textContent='تدريب تفاعلي قبل القياس';
  const help=practice.querySelector('.lw3-section-help');
  if(help)help.textContent='أجب عن الأسئلة الخمسة ثم اضغط «تحقق من الإجابة». عند الخطأ يظهر تلميح أولًا، ثم تفسير الإجابة بعد المحاولة الثانية.';
  practice.classList.add('practice-prominent');
  if(diagnostic){
    const dtitle=diagnostic.querySelector('.lw3-section-title h3');
    if(dtitle)dtitle.textContent='قياس مستواك بعد التدريب';
    const dsmall=diagnostic.querySelector('.lw3-section-title small');
    if(dsmall)dsmall.textContent='قياس مستوى الطالب';
    const dhelp=diagnostic.querySelector('.lw3-section-help');
    if(dhelp)dhelp.textContent='بعد إنهاء التدريب، أجب عن هذه الأسئلة لقياس مستوى فهمك قبل التقويم النهائي.';
  }
  const nav=[...root.querySelectorAll('.lw3-nav button')];
  if(nav.length>=5){
    nav[0].innerHTML='<b>١</b>افهم';
    nav[1].innerHTML='<b>٢</b>شاهد';
    nav[2].dataset.jump='practice'; nav[2].innerHTML='<b>٣</b>تدرّب';
    nav[3].dataset.jump='diagnostic'; nav[3].innerHTML='<b>٤</b>قِس';
    nav[4].innerHTML='<b>٥</b>أتقن';
  }
}
new MutationObserver(()=>enhance(document.getElementById('lw3Overlay'))).observe(document.documentElement,{childList:true,subtree:true});
enhance(document.getElementById('lw3Overlay'));
})();