(()=>{
const SUBJECTS=['arabic','math','science'];
const LABEL={arabic:'القراءة',math:'الرياضيات',science:'العلوم'};
let nafesScheduled=false,achievementScheduled=false;

function activeNafesKey(){
 const btns=[...document.querySelectorAll('#nafesArea .nafes-subject')];
 const i=btns.findIndex(b=>b.classList.contains('active'));
 return SUBJECTS[Math.max(0,i)]||'arabic';
}
function qualityNotice(key){
 return `<div class="accuracy-warning" style="margin:14px 0;padding:18px;border:1px solid #d8c58d;border-radius:16px;background:#fffaf0;color:#493f26"><h3 style="margin:0 0 7px;font-size:16px">إطار ${LABEL[key]} الرسمي محفوظ — التدريب السابق موقوف للمراجعة</h3><p style="margin:0;line-height:1.9">المؤشرات المعروضة مأخوذة من إطار نواتج التعلم 2026. أوقفت جميع تدريبات واختبارات نافس السابقة في المواد الثلاث؛ لأنها أُنشئت قبل اكتمال الربط بالمؤشرات الرسمية ولا أريد عرضها كأنها محتوى موثوق. لن يُفتح أي تدريب جديد حتى يكون كل سؤال مرتبطًا <b>بناتج تعلم + مؤشر رسمي محدد</b>، ومراجعًا من حيث صحة الإجابة والمشتتات ومستوى القياس، وبنك التدريب يحتوي على 24 سؤالًا معتمدًا مختلفًا على الأقل.</p></div>`;
}
function applyNafesQualityGuard(){
 nafesScheduled=false;
 const area=document.getElementById('nafesArea');if(!area||!area.children.length)return;
 const key=activeNafesKey();
 area.querySelectorAll('.nafes-tests,.nafes-legacy-tests,.nafes-model-bank,.nafes-unlimited-btn,.nafes-unlimited-hint,.nafes-bank-created-panel').forEach(el=>el.style.display='none');
 area.querySelectorAll('.nafes-headline .actions').forEach(el=>el.style.display='none');
 const metrics=[...area.querySelectorAll('.metrics .metric')];
 for(const m of metrics){
  const label=m.querySelector('span')?.textContent||'';
  if(label.includes('اختبارات متاحة')){const b=m.querySelector('b'),s=m.querySelector('small');if(b)b.textContent='0';if(s)s.textContent='لا يوجد بنك معتمد منشور حاليًا';}
  if(label.includes('طلاب تم قياسهم')){const b=m.querySelector('b'),s=m.querySelector('small');if(b)b.textContent='—';if(s)s.textContent='النتائج القديمة غير معتمدة للتحليل';}
 }
 let note=area.querySelector('.accuracy-warning');
 if(!note){
  const anchor=area.querySelector('.nafes-source-note')||area.querySelector('.nafes-subjects')||area.firstElementChild;
  if(anchor)anchor.insertAdjacentHTML('afterend',qualityNotice(key));
 }else note.outerHTML=qualityNotice(key);
}
function scheduleNafes(){if(nafesScheduled)return;nafesScheduled=true;queueMicrotask(applyNafesQualityGuard)}
function blockedAction(){if(typeof toast==='function')toast('هذا التدريب/الاختبار موقوف للمراجعة. لن يُفتح للطلاب قبل اعتماد أسئلته وربطها بالمؤشرات الرسمية.',true)}
window.openNafesTestCreator=function(){blockedAction()};
window.openNafesCriterionModel=function(){blockedAction()};
if(typeof window.buildArabicReadyTest==='function')window.buildArabicReadyTest=function(){blockedAction()};

function applyAchievementGuard(){
 achievementScheduled=false;
 const area=document.getElementById('achievementArea');if(!area||!area.children.length)return;
 const key=state?.achievementOfficialPage||'';
 if(key!=='nafes-results'&&key!=='nafes-plan')return;
 const paper=area.querySelector('.ach-paper');if(!paper)return;
 let note=paper.querySelector('.achievement-accuracy-note');
 if(!note){
  note=document.createElement('div');note.className='achievement-accuracy-note';
  note.innerHTML='<div style="margin:18px 0;padding:18px;border:1px solid #d8c58d;border-radius:16px;background:#fffaf0;color:#493f26"><b>تنبيه جودة البيانات:</b> تم إيقاف اعتماد نتائج نافس السابقة في القراءة والرياضيات والعلوم مؤقتًا. لا تدخل هذه النتائج في تحليل التحصيل حتى يعاد بناء بنوك الأسئلة على مؤشرات 2026 ومراجعتها واعتمادها.</div>';
  const head=paper.querySelector('.ach-paper-head');if(head)head.insertAdjacentElement('afterend',note);else paper.prepend(note);
 }
 const grid=paper.querySelector('.ach-nafes-grid');if(grid)grid.style.display='none';
 [...paper.querySelectorAll('.ach-block')].forEach(b=>{if((b.querySelector('h3')?.textContent||'').includes('نتائج الطلاب في نافس'))b.style.display='none'});
}
function scheduleAchievement(){if(achievementScheduled)return;achievementScheduled=true;queueMicrotask(applyAchievementGuard)}

const nafes=document.getElementById('nafesArea');
if(nafes)new MutationObserver(scheduleNafes).observe(nafes,{childList:true});
const ach=document.getElementById('achievementArea');
if(ach)new MutationObserver(scheduleAchievement).observe(ach,{childList:true});
document.addEventListener('click',e=>{if(e.target.closest('[data-section="nafes"],.nafes-subject'))setTimeout(scheduleNafes,30);if(e.target.closest('[data-section="achievement"],.ach-index-list button'))setTimeout(scheduleAchievement,30)});
setTimeout(()=>{scheduleNafes();scheduleAchievement()},500);
})();