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
function badgeStyle(){
  return 'margin-top:8px;padding:8px 12px;border:1px solid #d8e5e6;border-radius:10px;background:#f7fbfb;color:#294d52;font-weight:900;line-height:1.65';
}
function setTextIfChanged(node,value){
  if(node&&node.textContent!==value)node.textContent=value;
}
function ensureBanner(host,keyOrAll,className){
  if(!host)return;
  let line=host.querySelector(`:scope > .${className}`);
  if(!line){
    line=document.createElement('div');
    line.className=className;
    line.style.cssText=badgeStyle();
    host.appendChild(line);
  }
  const value=keyOrAll==='all'?`معلمو المواد: ${allTeachersText()}`:`معلم المادة: ${TEACHERS[keyOrAll]}`;
  setTextIfChanged(line,value);
}
function applyOfficialSheets(root=document){
  root.querySelectorAll?.('.official-analysis-sheet').forEach(sheet=>{
    const key=uniqueSubject(sheet.querySelector('h1')||sheet);
    if(!key)return;
    const value=sheet.querySelector('.sar-signatures>div:first-child span');
    setTextIfChanged(value,TEACHERS[key]);
    if(sheet.dataset.subjectTeacher!==TEACHERS[key])sheet.dataset.subjectTeacher=TEACHERS[key];
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
    setTextIfChanged(line,`المعلم: ${TEACHERS[key]}`);
  });
}
function applyReportPickerTeachers(root=document){
  root.querySelectorAll?.('.report-test-group').forEach(group=>{
    const key=uniqueSubject(group.querySelector('.report-group-head')||group);
    if(!key)return;
    let line=group.querySelector(':scope > .report-group-teacher');
    if(!line){
      line=document.createElement('div');
      line.className='report-group-teacher';
      line.style.cssText='margin:4px 2px 9px;padding:7px 9px;border-radius:8px;background:#eef8f6;color:#165b55;font-weight:900;font-size:13px;text-align:right';
      const head=group.querySelector('.report-group-head');
      if(head?.nextSibling)group.insertBefore(line,head.nextSibling);else group.appendChild(line);
    }
    setTextIfChanged(line,`المعلم: ${TEACHERS[key]}`);
  });
}
function applyControlTeachers(){
  const subject=document.getElementById('subjectSelect')?.value||'reading';
  const subjectCard=document.querySelector('#subjectView .section-control-card');
  if(subjectCard&&TEACHERS[subject])ensureBanner(subjectCard,subject,'subject-control-teacher');

  const reportSubject=document.getElementById('reportSubjectSelect')?.value||'reading';
  const reportCard=document.querySelector('#subjectReportView .subject-report-controls');
  if(reportCard&&TEACHERS[reportSubject])ensureBanner(reportCard,reportSubject,'subject-report-control-teacher');

  const overviewCard=document.querySelector('#overviewView .section-control-card');
  if(overviewCard)ensureBanner(overviewCard,'all','overview-teachers');

  const reportIntro=document.querySelector('#reportView > .card:not(.report-controls)');
  if(reportIntro)ensureBanner(reportIntro,'all','general-report-teachers');
}
function applyWeeklySignatures(root=document){
  root.querySelectorAll?.('.weekly-report .wr-signatures').forEach(sig=>{
    const target=sig.querySelector(':scope>div:first-child b');
    if(!target)return;
    setTextIfChanged(target,allTeachersText());
    if(target.style.whiteSpace!=='normal')target.style.whiteSpace='normal';
    if(target.style.lineHeight!=='1.55')target.style.lineHeight='1.55';
    if(target.style.fontSize!=='10.5px')target.style.fontSize='10.5px';
  });
}
function hideGenericTeacherInputs(){
  const wr=document.getElementById('wrTeacher');
  if(wr){
    const label=wr.closest('label');
    if(label&&label.style.display!=='none')label.style.display='none';
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
    if(label&&label.style.display!=='none')label.style.display='none';
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
  applyReportPickerTeachers(document);
  applyControlTeachers();
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
  document.addEventListener('change',e=>{
    if(['subjectSelect','reportSubjectSelect'].includes(e.target?.id))schedule();
  });
  addEventListener('beforeprint',applyAll);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
