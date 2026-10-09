(()=>{
'use strict';
if(window.__NAFES_ANALYSIS_EXCLUSION_UI__)return;
window.__NAFES_ANALYSIS_EXCLUSION_UI__=true;
const T=window.NafesTeacher;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let studentMap=new Map(),pendingRows=[],scheduled=false,refreshing=false,tableObserver=null,bodyObserver=null;

function boolValue(value){
  const v=String(value??'').trim().toLowerCase();
  if(['1','true','yes','y','نعم','مستبعد','استبعاد','استبعد'].includes(v))return true;
  if(['0','false','no','n','لا','مشمول','تضمين','ضم'].includes(v))return false;
  return null;
}
function normalizeHeader(v){return String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();}
function showState(text,type='info'){
  const el=$('analysisExclusionState');if(!el)return;
  el.textContent=text||'';el.dataset.type=type;
}
async function loadStudents(force=false){
  if(refreshing)return;
  refreshing=true;
  try{
    T?.clearReadCache?.();
    const data=await T.api('teacher_students_list',{include_archived:true,analysis_admin:true,force:force===true});
    studentMap=new Map((data.students||[]).map(s=>[String(s.id),s]));
    annotateTable();
    updateSummary();
  }catch(e){console.error('analysis exclusion student load failed',e);showState('تعذر تحميل حالات الاستبعاد: '+e.message,'error');}
  finally{refreshing=false;}
}
function ensureStyles(){
  if($('analysisExclusionStyle'))return;
  const style=document.createElement('style');style.id='analysisExclusionStyle';
  style.textContent=`
  .analysis-exclusion-panel{margin:0 0 14px;padding:14px;border:1px solid #d7e7e3;border-radius:14px;background:#f8fcfb}
  .analysis-exclusion-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
  .analysis-exclusion-head h4{margin:0;color:#17324d;font-size:14px}.analysis-exclusion-head p{margin:4px 0 0;color:#667b78;font-size:11px;line-height:1.7}
  .analysis-exclusion-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}
  .analysis-exclusion-actions button,.analysis-exclusion-actions label{font:inherit}
  .analysis-exclusion-btn{border:1px solid #bed9d3;background:#fff;color:#0f6258;border-radius:9px;padding:8px 11px;font-weight:800;font-size:11px;cursor:pointer}
  .analysis-exclusion-btn.primary{background:#0f6258;color:#fff}.analysis-exclusion-btn:disabled{opacity:.55;cursor:not-allowed}
  .analysis-exclusion-filter{border:1px solid #d8e4e1;border-radius:9px;padding:7px 9px;background:#fff;font:inherit;font-size:11px}
  .analysis-exclusion-summary{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.analysis-exclusion-chip{padding:5px 9px;border-radius:999px;background:#edf6f4;color:#315e58;font-size:10px;font-weight:800}
  .analysis-badge-in{display:inline-block;background:#e8f7ef;color:#176b47;border:1px solid #bfe3ce;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:900}
  .analysis-badge-out{display:inline-block;background:#fff1f0;color:#a13a32;border:1px solid #efc6c2;border-radius:999px;padding:3px 8px;font-size:10px;font-weight:900}
  .analysis-exclusion-reason{display:block;margin-top:4px;color:#7b6764;font-size:9px;max-width:210px}
  .btn-analysis-toggle{border:1px solid #c9dcd8;background:#fff;color:#265c55;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;cursor:pointer;margin-inline-start:4px}
  .btn-analysis-toggle.exclude{border-color:#efc4c0;color:#9c342d;background:#fff6f5}
  #analysisExclusionPreview,#analysisAuditPanel{margin-top:12px;max-height:260px;overflow:auto;border:1px solid #e0e9e7;border-radius:10px;background:#fff}
  #analysisExclusionPreview table,#analysisAuditPanel table{width:100%;border-collapse:collapse;font-size:10px}
  #analysisExclusionPreview th,#analysisExclusionPreview td,#analysisAuditPanel th,#analysisAuditPanel td{padding:7px 8px;border-bottom:1px solid #eef3f2;text-align:right}
  #analysisExclusionState[data-type="error"]{color:#a32a2a}#analysisExclusionState[data-type="success"]{color:#176b47}
  .analysis-excluded-row td{background:#fffafa!important}
  `;
  document.head.appendChild(style);
}
function ensurePanel(){
  const manage=$('tabManage');if(!manage||$('analysisExclusionPanel'))return;
  ensureStyles();
  const host=manage.querySelector('.manage-box')||manage;
  const panel=document.createElement('section');panel.id='analysisExclusionPanel';panel.className='analysis-exclusion-panel';
  panel.innerHTML=`
    <div class="analysis-exclusion-head">
      <div><h4>الاستبعاد من التحليل والتقارير</h4><p>الطالب التجريبي مستبعد تلقائيًا. ويمكن استبعاد طالب حقيقي مؤقتًا دون حذف سجلاته أو أرشفته.</p></div>
      <select id="analysisExclusionFilter" class="analysis-exclusion-filter">
        <option value="">كل حالات التحليل</option><option value="included">المشمولون فقط</option><option value="excluded">المستبعدون فقط</option>
      </select>
    </div>
    <div id="analysisExclusionSummary" class="analysis-exclusion-summary"></div>
    <div class="analysis-exclusion-actions">
      <button id="analysisExclusionTemplateBtn" class="analysis-exclusion-btn" type="button">تنزيل قالب Excel بالحالات</button>
      <label class="analysis-exclusion-btn">استيراد Excel/CSV<input id="analysisExclusionFile" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label>
      <button id="analysisExclusionCommitBtn" class="analysis-exclusion-btn primary" type="button" disabled>اعتماد التغييرات</button>
      <button id="analysisAuditBtn" class="analysis-exclusion-btn" type="button">سجل التدقيق</button>
      <small id="analysisExclusionState"></small>
    </div>
    <div id="analysisExclusionPreview" hidden></div>
    <div id="analysisAuditPanel" hidden></div>`;
  host.insertBefore(panel,host.firstChild);
  $('analysisExclusionFilter').addEventListener('change',annotateTable);
  $('analysisExclusionTemplateBtn').addEventListener('click',downloadTemplate);
  $('analysisExclusionFile').addEventListener('change',e=>handleFile(e.target.files?.[0]));
  $('analysisExclusionCommitBtn').addEventListener('click',commitBulk);
  $('analysisAuditBtn').addEventListener('click',toggleAudit);
  loadStudents();
}
function updateSummary(){
  const el=$('analysisExclusionSummary');if(!el)return;
  const rows=[...studentMap.values()].filter(s=>s.is_demo!==true);
  const excluded=rows.filter(s=>s.exclude_from_analysis===true).length;
  const included=rows.length-excluded;
  el.innerHTML=`<span class="analysis-exclusion-chip">مشمول في التحليل: <b>${included}</b></span><span class="analysis-exclusion-chip">مستبعد يدويًا: <b>${excluded}</b></span>`;
}
function annotateTable(){
  ensurePanel();
  const table=$('studentsTableContainer')?.querySelector('table.students-table');if(!table)return;
  const head=table.querySelector('thead tr');
  if(head&&!head.querySelector('[data-analysis-head]')){
    const th=document.createElement('th');th.dataset.analysisHead='1';th.textContent='التحليل';
    const actions=head.querySelector('th.actions-col')||head.lastElementChild;head.insertBefore(th,actions);
  }
  const filter=$('analysisExclusionFilter')?.value||'';
  table.querySelectorAll('tbody tr[data-student-id]').forEach(row=>{
    const id=String(row.dataset.studentId||''),st=studentMap.get(id);
    if(!st)return;
    const excluded=st.exclude_from_analysis===true;
    row.classList.toggle('analysis-excluded-row',excluded);
    if(filter==='included'&&excluded||filter==='excluded'&&!excluded)row.style.display='none';else row.style.removeProperty('display');
    let cell=row.querySelector('[data-analysis-cell]');
    const actions=row.querySelector('td.actions-col')||row.lastElementChild;
    if(!cell){cell=document.createElement('td');cell.dataset.analysisCell='1';row.insertBefore(cell,actions);}
    cell.innerHTML=excluded
      ?`<span class="analysis-badge-out">مستبعد</span>${st.analysis_exclusion_reason?`<small class="analysis-exclusion-reason">${esc(st.analysis_exclusion_reason)}</small>`:''}`
      :'<span class="analysis-badge-in">مشمول</span>';
    let btn=actions.querySelector('[data-analysis-toggle]');
    if(!btn){btn=document.createElement('button');btn.type='button';btn.dataset.analysisToggle='1';btn.className='btn-analysis-toggle';actions.prepend(btn);}
    btn.dataset.studentId=id;btn.dataset.excluded=String(excluded);
    btn.classList.toggle('exclude',!excluded);
    btn.textContent=excluded?'↩️ تضمين في التحليل':'⛔ استبعاد من التحليل';
    btn.onclick=()=>toggleStudent(id,!excluded,btn);
  });
}
async function toggleStudent(id,next,btn){
  const st=studentMap.get(id);if(!st)return;
  let reason='';
  if(next){
    const value=prompt(`سبب استبعاد "${st.full_name||'الطالب'}" من التحليل (اختياري):`,st.analysis_exclusion_reason||'');
    if(value===null)return;reason=value.trim();
    if(!confirm('سيُستبعد الطالب من جميع التحليلات والتقارير والخطط المبنية على النتائج، مع بقاء سجلاته محفوظة. متابعة؟'))return;
  }else if(!confirm('إعادة تضمين الطالب في التحليل والتقارير؟'))return;
  btn.disabled=true;
  try{
    await T.api('teacher_student_analysis_exclusion',{student_id:id,exclude_from_analysis:next,reason});
    showState(next?'تم استبعاد الطالب من التحليل.':'تمت إعادة الطالب إلى التحليل.','success');
    await loadStudents(true);
  }catch(e){showState(e.message,'error');btn.disabled=false;}
}
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(!quoted&&(c===','||c===';'||c==='\t')){row.push(cell);cell='';}
    else if(!quoted&&(c==='\n'||c==='\r')){
      if(c==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);cell='';if(row.some(v=>String(v).trim()))rows.push(row);row=[];
    }else cell+=c;
  }
  row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);return rows;
}
async function handleFile(file){
  if(!file)return;
  try{
    let rows;
    if(/\.csv$/i.test(file.name)){rows=parseCsv(await file.text());}
    else{
      if(!window.XLSX)throw new Error('مكتبة Excel غير جاهزة.');
      const buf=await file.arrayBuffer(),wb=window.XLSX.read(new Uint8Array(buf),{type:'array'});
      rows=window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false});
    }
    buildPreview(rows||[]);
  }catch(e){showState('تعذر قراءة الملف: '+e.message,'error');}
  finally{const input=$('analysisExclusionFile');if(input)input.value='';}
}
function buildPreview(rows){
  pendingRows=[];const preview=$('analysisExclusionPreview'),commit=$('analysisExclusionCommitBtn');
  if(!rows.length){showState('الملف فارغ.','error');return;}
  const headers=rows[0].map(normalizeHeader);
  const find=(patterns)=>headers.findIndex(h=>patterns.some(p=>p.test(h)));
  const idCol=find([/^معرف الطالب$/, /^student[_ ]?id$/, /^id$/]);
  const exCol=find([/^استبعاد من التحليل$/, /^exclude[_ ]?from[_ ]?analysis$/, /^مستبعد من التحليل$/]);
  const reasonCol=find([/^سبب الاستبعاد$/, /^reason$/, /^analysis[_ ]?exclusion[_ ]?reason$/]);
  if(idCol<0||exCol<0){showState('يجب أن يحتوي الملف على عمودي «معرف الطالب» و«استبعاد من التحليل».','error');preview.hidden=true;commit.disabled=true;return;}
  for(let i=1;i<rows.length;i++){
    const r=rows[i]||[],id=String(r[idCol]||'').trim(),excluded=boolValue(r[exCol]);
    if(!id&&!String(r[exCol]||'').trim())continue;
    const st=studentMap.get(id),reason=reasonCol>=0?String(r[reasonCol]||'').trim():'';
    let status='صالح';
    if(!st)status='معرف غير موجود';else if(excluded===null)status='قيمة الاستبعاد غير مفهومة';
    pendingRows.push({student_id:id,exclude_from_analysis:excluded,reason,student:st,status,valid:!!st&&excluded!==null});
  }
  const valid=pendingRows.filter(x=>x.valid).length;
  preview.hidden=false;preview.innerHTML=`<table><thead><tr><th>الطالب</th><th>المعرف</th><th>الحالة الحالية</th><th>الحالة المطلوبة</th><th>السبب</th><th>التحقق</th></tr></thead><tbody>${pendingRows.map(x=>`<tr><td>${esc(x.student?.full_name||'—')}</td><td dir="ltr">${esc(x.student_id)}</td><td>${x.student?.exclude_from_analysis?'مستبعد':'مشمول'}</td><td>${x.exclude_from_analysis===true?'مستبعد':x.exclude_from_analysis===false?'مشمول':'—'}</td><td>${esc(x.reason||'—')}</td><td>${esc(x.status)}</td></tr>`).join('')}</tbody></table>`;
  commit.disabled=valid===0;showState(`تمت معاينة ${pendingRows.length} سجلًا؛ الصالح للتطبيق: ${valid}.`,valid?'info':'error');
}
async function commitBulk(){
  const valid=pendingRows.filter(x=>x.valid).map(x=>({student_id:x.student_id,exclude_from_analysis:x.exclude_from_analysis,reason:x.reason}));
  if(!valid.length)return;
  if(!confirm(`اعتماد ${valid.length} تغييرًا في حالات الاستبعاد من التحليل؟`))return;
  const btn=$('analysisExclusionCommitBtn');btn.disabled=true;
  try{
    const res=await T.api('teacher_students_analysis_exclusion_bulk',{students:valid});
    pendingRows=[];$('analysisExclusionPreview').hidden=true;
    showState(`تم تحديث ${res.updated||0} طالب، ولم تتغير حالة ${res.unchanged||0}، وتعذر ${res.failed||0}.`,'success');
    await loadStudents(true);
  }catch(e){showState(e.message,'error');}
  finally{btn.disabled=pendingRows.filter(x=>x.valid).length===0;}
}
function downloadTemplate(){
  if(!window.XLSX){showState('مكتبة Excel غير جاهزة.','error');return;}
  const rows=[['معرف الطالب','اسم الطالب','الفصل','استبعاد من التحليل','سبب الاستبعاد']];
  [...studentMap.values()].filter(s=>s.is_demo!==true).forEach(s=>rows.push([
    s.id,s.full_name||'',s.class_name||'',s.exclude_from_analysis?'نعم':'لا',s.analysis_exclusion_reason||''
  ]));
  const ws=window.XLSX.utils.aoa_to_sheet(rows);ws['!views']=[{rightToLeft:true,RTL:true}];ws['!cols']=[{wch:38},{wch:30},{wch:12},{wch:20},{wch:35}];
  const wb=window.XLSX.utils.book_new();window.XLSX.utils.book_append_sheet(wb,ws,'استبعاد التحليل');
  window.XLSX.writeFile(wb,'قالب_استبعاد_الطلاب_من_التحليل.xlsx');
}
async function toggleAudit(){
  const panel=$('analysisAuditPanel');if(!panel)return;
  if(!panel.hidden){panel.hidden=true;return;}
  panel.hidden=false;panel.innerHTML='<div style="padding:12px">جارٍ تحميل سجل التدقيق…</div>';
  try{
    const data=await T.api('teacher_analysis_exclusion_audit',{limit:100});
    const events=data.events||[];
    panel.innerHTML=events.length?`<table><thead><tr><th>الطالب</th><th>التغيير</th><th>المصدر</th><th>السبب</th><th>الوقت</th></tr></thead><tbody>${events.map(e=>{const st=studentMap.get(String(e.student_id));return`<tr><td>${esc(st?.full_name||e.student_id)}</td><td>${e.new_excluded?'استبعاد':'إعادة تضمين'}</td><td>${esc(e.source||'—')}</td><td>${esc(e.reason||'—')}</td><td>${esc(new Date(e.changed_at).toLocaleString('ar-SA'))}</td></tr>`}).join('')}</tbody></table>`:'<div style="padding:12px">لا توجد تغييرات مسجلة حتى الآن.</div>';
  }catch(e){panel.innerHTML=`<div style="padding:12px;color:#a32a2a">${esc(e.message)}</div>`;}
}
function observeStudentTable(){
  const container=$('studentsTableContainer');
  if(!container||tableObserver)return;
  tableObserver=new MutationObserver(()=>schedule());
  tableObserver.observe(container,{childList:true,subtree:false});
}
function schedule(){
  if(scheduled)return;scheduled=true;
  queueMicrotask(()=>{scheduled=false;ensurePanel();observeStudentTable();annotateTable();});
}
function install(){
  ensureStyles();schedule();
  bodyObserver=new MutationObserver(()=>{
    if($('studentsModal')){
      schedule();
      if(bodyObserver){bodyObserver.disconnect();bodyObserver=null;}
    }
  });
  bodyObserver.observe(document.body,{childList:true,subtree:false});
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#navStudentsBtn,.btn-quick-manage,[data-tab="manage"],#tabBtnManage'))setTimeout(()=>loadStudents(),0);
  },true);
  document.addEventListener('input',e=>{
    if(['studentSearchInput'].includes(e.target?.id))setTimeout(schedule,0);
  },true);
  document.addEventListener('change',e=>{
    if(['filterGradeSelect','filterClassSelect'].includes(e.target?.id))setTimeout(schedule,0);
  },true);
  addEventListener('nafes:auth-changed',()=>{studentMap.clear();setTimeout(()=>loadStudents(),50);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();