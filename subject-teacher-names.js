(()=>{
'use strict';
const TEACHERS={reading:'زرعي شبير',math:'عبدالله العماري',science:'مليدان بالحارث'};
const LABELS={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const KEYS=['reading','math','science'];
const REPORT_SCOPE_IDS=['subjectOfficialReport','overviewOfficialPreview','subjectOfficialPreview','reportPreview','printRoot'];
let pending=false;

function subjectKeys(root){
  const text=String(root?.textContent||'');
  return KEYS.filter(k=>text.includes(LABELS[k]));
}
function subjectFromNode(root){
  if(!root)return'';
  const dataKey=String(root.dataset?.subjectKey||root.dataset?.subject||root.dataset?.subjectCard||'').trim().toLowerCase();
  if(KEYS.includes(dataKey))return dataKey;
  for(const key of KEYS){
    if(root.classList?.contains(`wr-${key}`)||root.classList?.contains(`subject-${key}`))return key;
  }
  const keys=subjectKeys(root);
  return keys.length===1?keys[0]:'';
}
function uniqueSubject(root){return subjectFromNode(root)}
function allTeachersText(){
  return `القراءة: ${TEACHERS.reading} | الرياضيات: ${TEACHERS.math} | العلوم: ${TEACHERS.science}`;
}
function badgeStyle(){
  return 'margin-top:8px;padding:8px 12px;border:1px solid #d8e5e6;border-radius:10px;background:#f7fbfb;color:#294d52;font-weight:900;line-height:1.65';
}
function setTextIfChanged(node,value){
  if(node&&node.textContent!==value)node.textContent=value;
}
function toggleClass(node,name,on){
  if(!node)return;
  if(on&&!node.classList.contains(name))node.classList.add(name);
  if(!on&&node.classList.contains(name))node.classList.remove(name);
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
function reportScopes(){
  return REPORT_SCOPE_IDS.map(id=>document.getElementById(id)).filter(Boolean);
}
function ensureFirstTeacher(sheet,key){
  let line=sheet.querySelector(':scope > .sar-subject-teacher-first');
  if(!line){
    line=document.createElement('div');
    line.className='sar-subject-teacher-first';
    const h1=sheet.querySelector(':scope > h1');
    if(h1?.nextSibling)sheet.insertBefore(line,h1.nextSibling);else if(h1)sheet.appendChild(line);else sheet.insertBefore(line,sheet.firstChild);
  }
  setTextIfChanged(line,`معلم المادة: ${TEACHERS[key]}`);
}
function applyOfficialSheets(root){
  root.querySelectorAll?.('.official-analysis-sheet').forEach(sheet=>{
    const key=uniqueSubject(sheet.querySelector(':scope > h1')||sheet);
    if(!key)return;
    sheet.dataset.subjectKey=key;
    sheet.dataset.subjectTeacher=TEACHERS[key];
    ensureFirstTeacher(sheet,key);
    const value=sheet.querySelector('.sar-signatures>div:first-child span');
    setTextIfChanged(value,TEACHERS[key]);
  });
}
function ensureCardTeacher(card,key,positions){
  let line=card.querySelector(':scope > .wr-subject-teacher');
  if(!positions){
    if(line)line.remove();
    return;
  }
  if(!line){
    line=document.createElement('small');
    line.className='wr-subject-teacher';
    line.style.cssText='display:block;margin-top:5px;font-weight:900;color:#50666c;line-height:1.4';
    card.appendChild(line);
  }
  toggleClass(line,'wr-subject-teacher-first',positions.first);
  toggleClass(line,'wr-subject-teacher-last',positions.last);
  setTextIfChanged(line,`المعلم: ${TEACHERS[key]}`);
}
function applySubjectCardBoundaries(root){
  const cards=[...root.querySelectorAll?.('.wr-performance-card,.wr-indicator-card')||[]];
  const groups=new Map();
  for(const card of cards){
    const key=subjectFromNode(card);
    if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(card);
  }
  const desired=new Map();
  for(const [key,list] of groups){
    if(!list.length)continue;
    const first=list[0],last=list[list.length-1];
    desired.set(first,{key,first:true,last:first===last});
    if(last!==first)desired.set(last,{key,first:false,last:true});
  }
  for(const card of cards){
    const d=desired.get(card);
    if(!d)ensureCardTeacher(card,'',null);else ensureCardTeacher(card,d.key,d);
  }
}
function applyAbsenceBoundaryTeachers(root){
  const official=[...root.querySelectorAll?.('.official-analysis-sheet')||[]];
  const absences=[...root.querySelectorAll?.('.nafes-absence-sheet')||[]];
  const officialByKey=new Map();
  for(const sheet of official){
    const key=subjectFromNode(sheet);
    if(!key)continue;
    if(!officialByKey.has(key))officialByKey.set(key,[]);
    officialByKey.get(key).push(sheet);
  }
  const absenceByKey=new Map();
  for(const sheet of absences){
    const key=subjectFromNode(sheet.querySelector('.na-scope')||sheet);
    if(!key)continue;
    sheet.dataset.subjectKey=key;
    if(!absenceByKey.has(key))absenceByKey.set(key,[]);
    absenceByKey.get(key).push(sheet);
    const footer=sheet.querySelector('.na-footer');
    if(footer&&!footer.dataset.teacherBaseText)footer.dataset.teacherBaseText=footer.textContent||'كشف متابعة الطلاب';
  }
  for(const key of KEYS){
    const os=officialByKey.get(key)||[],as=absenceByKey.get(key)||[];
    const hasAbsence=as.length>0;
    for(const sheet of os)toggleClass(sheet,'subject-teacher-footer-suppressed',hasAbsence);
    const targets=new Set();
    if(as.length){
      if(!os.length)targets.add(as[0]);
      targets.add(as[as.length-1]);
    }
    for(const sheet of as){
      const footer=sheet.querySelector('.na-footer');
      if(!footer)continue;
      const active=targets.has(sheet);
      toggleClass(footer,'subject-teacher-boundary',active);
      setTextIfChanged(footer,active?`معلم المادة: ${TEACHERS[key]}`:(footer.dataset.teacherBaseText||'كشف متابعة الطلاب'));
    }
  }
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
function applyWeeklySignatures(root){
  root.querySelectorAll?.('.weekly-report .wr-signatures').forEach(sig=>{
    const target=sig.querySelector(':scope>div:first-child b');
    if(!target)return;
    setTextIfChanged(target,`معلمو المواد: ${allTeachersText()}`);
    target.style.whiteSpace='normal';
    target.style.lineHeight='1.55';
    target.style.removeProperty('font-size');
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
function markSinglePagePrintSheets(){
  const root=document.getElementById('printRoot');
  if(!root)return;
  const printablePx=277*(96/25.4);
  root.querySelectorAll('.official-analysis-sheet').forEach(sheet=>{
    const rect=sheet.getBoundingClientRect();
    const height=Math.max(rect.height||0,sheet.scrollHeight||0);
    toggleClass(sheet,'subject-teacher-single-page',height>0&&height<=printablePx*1.02);
  });
}
function clearPrintPageMarks(){
  document.querySelectorAll('.subject-teacher-single-page').forEach(x=>x.classList.remove('subject-teacher-single-page'));
}
function applyAll(){
  pending=false;
  for(const scope of reportScopes()){
    applyOfficialSheets(scope);
    applySubjectCardBoundaries(scope);
    applyAbsenceBoundaryTeachers(scope);
    applyWeeklySignatures(scope);
  }
  applyReportPickerTeachers(document);
  applyControlTeachers();
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
  addEventListener('beforeprint',()=>{applyAll();markSinglePagePrintSheets()});
  addEventListener('afterprint',clearPrintPageMarks);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
