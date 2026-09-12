(()=>{
'use strict';
const $=id=>document.getElementById(id);
const retryText='يوجد ضغط مؤقت على الخادم، جارٍ إعادة الاتصال تلقائيًا… لا تغلق الصفحة.';
window.addEventListener('nafes:edge-retry',event=>{
  const detail=event.detail||{},save=$('saveState'),message=$('message'),player=$('player');
  const inExam=player&&!player.hidden;
  if(detail.phase==='retry'){
    if(inExam&&save)save.textContent='ضغط مؤقت — جارٍ إعادة الاتصال تلقائيًا…';
    if(!inExam&&message)message.textContent=retryText;
    return;
  }
  if(detail.phase==='recovered'){
    if(message&&message.textContent===retryText)message.textContent='';
    if(inExam&&save&&save.textContent.includes('ضغط مؤقت'))save.textContent='تم استعادة الاتصال';
    return;
  }
  if(detail.phase==='failed'){
    if(!inExam&&message&&message.textContent===retryText)message.textContent='تعذر الاتصال بالخادم بعد عدة محاولات. تحقق من الإنترنت ثم أعد المحاولة.';
  }
});
})();
