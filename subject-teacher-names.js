(()=>{
'use strict';
const TEACHERS={reading:'زرعي شبير',math:'عبدالله العماري',science:'مليدان بالحارث'};
const LABELS={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const KEYS=['reading','math','science'];
let pending=false;

function subjectKeys(root){
  const text=String(root?.textContent||'');
  return KEYS.filter(k=>text.includes(LABELS[k]));
}
function uniqueSubject(root){
  const keys=subjectKeys(root);
  return keys.length===1?keys[0]:'';
}
function allTeachersText(){
  return `القراءة: ${TEACHERS.reading} | الرياضيات: ${TEACHERS.math} | العلوم: ${TEACHERS.science}`;
}
function teacherFor(root){
  const k=uniqueSubject(root);
  return k?TEACHERS[k]:'';
}
function applyOfficialSheets(root=document){
  root.querySelectorAll?.('.official-analysis-sheet').forEach(sheet=>{
    const key=uniqueSubject(sheet.querySelector('h1')||sheet);
    if(!key)return;
    const value=sheet.querySelector('.sar-signatures>div:first-child span');
    if(value&&value.textContent!==TEACHERS[key])value.textContent=TEACHERS[key];
    sheet.dataset.subjectTeacher=TEACHERS[key];
  });
}
function applySubjectCards(root=document){
  root.querySelectorAll?.('.wr-performance-card,.wr-indicator-card').forEach(card=>{
    const key=uniqueSubject(card);
    if(!key)return;
    let line=card.querySelector('.wr-subject-teacher');
    if(!line){
      line=document.createElement('small');
      line.className='wr-subject-teacher';
      line.style.cssText='display:block;margin-top:5px;font-weight:900;color:#50666c;line-height:1.4';
      card.appendChild(line);
    }
    line.textContent=`المعلم: ${TEACHERS[key]}`;
  });
}
function applyWeeklySignatures(root=document){
  root.querySelectorAll?.('.weekly-report .wr-signatures').forEach(sig=>{
    const report=sig.closest('.weekly-report')||sig;
    const target=sig.querySelector(':scope>div:first-child b');
    if(!target)return;
    const single=teacherFor(report);
    const value=single||allTeachersText();
    if(target.textContent!==value)target.textContent=value;
    target.style.whiteSpace='normal';
    target.style.lineHeight='1.55';
  });
}
function hideGenericTeacherInputs(){
  const wr=document.getElementById('wrTeacher');
  if(wr){
    const label=wr.closest('label');
    if(label)label.style.display='none';
    const grid=wr.closest('.wr-settings-grid');
    if(grid&&!grid.querySelector('.fixed-subject-teachers')){
      const note=document.createElement('div');
      note.className='fixed-subject-teachers';
      note.style.cssText='grid-column:1/-1;padding:10px 12px;border:1px solid #d9e6e7;border-radius:10px;background:#f7fbfb;font-weight:800;line-height:1.7';
      note.textContent=`معلمو المواد: ${allTeachersText()}`;
      grid.insertBefore(note,grid.firstChild);
    }
  }
  const modal=document.getElementById('teacherNameInput');
  if(modal){
    const label=modal.closest('label');
    if(label)label.style.display='none';
    const grid=modal.closest('.settings-grid');
    if(grid&&!grid.querySelector('.fixed-subject-teachers')){
      const note=document.createElement('div');
      note.className='fixed-subject-teachers';
      note.style.cssText='grid-column:1/-1;padding:10px 12px;border:1px solid #d9e6e7;border-radius:10px;background:#f7fbfb;font-weight:800;line-height:1.7';
      note.textContent=`معلمو المواد: ${allTeachersText()}`;
      grid.insertBefore(note,grid.firstChild);
    }
  }
}
function applyAll(){
  pending=false;
  applyOfficialSheets(document);
  applySubjectCards(document);
  applyWeeklySignatures(document);
  hideGenericTeacherInputs();
}
function schedule(){
  if(pending)return;
  pending=true;
  queueMicrotask(applyAll);
}
function install(){
  applyAll();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  addEventListener('beforeprint',applyAll);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
