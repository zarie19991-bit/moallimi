(()=>{
'use strict';

const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-adaptive-plan';
const W={
 token:null,profile:null,data:null,report:null,loading:false,error:'',
 selected:new Set(),teacherSearch:'',teacherSubject:'all',
 filters:{status:'all',subject:'all',from:'',to:''},page:1,pageSize:40,
 refreshTimer:null
};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt=n=>Number(n||0).toLocaleString('ar-SA',{maximumFractionDigits:1});
const pct=n=>n==null?'—':fmt(n)+'٪';
const dt=v=>{if(!v)return'—';try{return new Date(v).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'})}catch{return'—'}};
const dOnly=v=>{if(!v)return'—';try{return new Date(v).toLocaleDateString('ar-SA',{dateStyle:'medium'})}catch{return'—'}};
const subjectLabel=s=>s==='reading'?'القراءة':s==='math'?'الرياضيات':s==='science'?'العلوم':'جميع المواد';
const tierLabel=t=>t==='remedial'?'علاجي':t==='reinforcement'?'تعزيز':t==='enrichment'?'إثرائي':'—';
function statusMeta(s){
 if(s==='completed')return{label:'منجز',cls:'done',icon:'✓'};
 if(s==='in_progress')return{label:'قيد التنفيذ',cls:'doing',icon:'◔'};
 return{label:'غير منجز',cls:'pending',icon:'!'};
}
async function post(action,extra={}){
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+W.token},body:JSON.stringify({action,...extra}),cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw new Error(d.error||'تعذر تحميل بيانات المعلمين.');
 return d;
}
function mountHost(){return document.getElementById('tamakkunTeacherWorkspace')}
function selectedTeacherIds(){return [...W.selected]}
function allowedTeachers(){return Array.isArray(W.data?.teachers)?W.data.teachers:[]}
function filteredTeacherCards(){
 const q=W.teacherSearch.trim().toLowerCase();
 return allowedTeachers().filter(t=>{
   const subjectOk=W.teacherSubject==='all'||t.subject_scope===W.teacherSubject;
   const text=(String(t.label||'')+' '+subjectLabel(t.subject_scope)).toLowerCase();
   return subjectOk&&(!q||text.includes(q));
 });
}
function activeSummary(){return W.report?.summary||W.data?.totals||{}}
function activeRows(){return Array.isArray(W.report?.rows)?W.report.rows:[]}
function selectedLabel(){
 const all=allowedTeachers();
 if(!W.selected.size)return W.data?.access_mode==='self'?(all[0]?.label||'حساب المعلم'):'جميع المعلمين';
 const names=all.filter(t=>W.selected.has(String(t.id))).map(t=>t.label);
 return names.length<=2?names.join('، '):names.slice(0,2).join('، ')+' +'+fmt(names.length-2);
}
function completionBar(rate){
 const n=Math.max(0,Math.min(100,Number(rate||0)));
 return '<div class="tmw-progress" aria-label="نسبة الإنجاز '+esc(fmt(n))+' بالمئة"><i style="width:'+n+'%"></i></div>';
}
function kpis(){
 const s=activeSummary();
 return '<section class="tmw-kpis">'+
  '<article class="tmw-kpi total"><span>إجمالي الأعمال</span><b>'+fmt(s.task_total)+'</b><small>'+fmt(s.students)+' طالبًا ضمن النطاق</small></article>'+
  '<article class="tmw-kpi done"><span>منجز</span><b>'+fmt(s.completed)+'</b><small>أعمال مكتملة</small></article>'+
  '<article class="tmw-kpi doing"><span>قيد التنفيذ</span><b>'+fmt(s.in_progress)+'</b><small>بدأ الطالب العمل عليها</small></article>'+
  '<article class="tmw-kpi pending"><span>غير منجز</span><b>'+fmt(s.assigned)+'</b><small>أعمال لم تبدأ بعد</small></article>'+
  '<article class="tmw-kpi rate"><span>نسبة الإنجاز</span><b>'+pct(s.completion_rate)+'</b>'+completionBar(s.completion_rate)+'</article>'+
 '</section>';
}
function teacherCard(t){
 const id=String(t.id),sel=W.selected.has(id),rate=Number(t.completion_rate||0);
 return '<article class="tmw-teacher-card '+(sel?'selected':'')+'" draggable="true" data-teacher-drag="'+esc(id)+'">'+
   '<div class="tmw-teacher-head"><div class="tmw-teacher-avatar">'+esc((t.label||'م').slice(0,1))+'</div><div class="tmw-teacher-name"><b>'+esc(t.label||'معلم')+'</b><span>'+esc(subjectLabel(t.subject_scope))+'</span></div><button type="button" class="tmw-select-btn" data-teacher-toggle="'+esc(id)+'" aria-pressed="'+(sel?'true':'false')+'">'+(sel?'محدد ✓':'اختيار')+'</button></div>'+
   '<div class="tmw-teacher-numbers"><span><b>'+fmt(t.task_total)+'</b> عمل</span><span class="ok"><b>'+fmt(t.completed)+'</b> منجز</span><span class="bad"><b>'+fmt(t.assigned)+'</b> غير منجز</span></div>'+
   '<div class="tmw-teacher-rate"><div><span>الإنجاز</span><b>'+pct(rate)+'</b></div>'+completionBar(rate)+'</div>'+
   '<div class="tmw-teacher-foot"><span>آخر نشاط: '+esc(dt(t.last_activity))+'</span><button type="button" data-print-teacher="'+esc(id)+'">طباعة تقرير المعلم</button></div>'+
 '</article>';
}
function teacherSelector(){
 const self=W.data?.access_mode==='self';
 const cards=filteredTeacherCards();
 return '<section class="tmw-panel tmw-teachers"><div class="tmw-panel-head"><div><span class="tmw-eyebrow">اختيار المعلمين</span><h2>'+(self?'متابعة حسابك':'حدد المعلمين المطلوب تحليلهم')+'</h2><p>'+(self?'يظهر لك حسابك ومهامه فقط وفق صلاحية المادة.':'اسحب بطاقة المعلم إلى منطقة الاختيار أو اضغط «اختيار». ترك القائمة فارغة يعني تحليل جميع المعلمين.')+'</p></div><div class="tmw-head-actions"><button type="button" data-select-all>'+(W.selected.size?'إلغاء التحديد':'تحديد الكل')+'</button></div></div>'+
   (!self?'<div class="tmw-teacher-tools"><input id="tmwTeacherSearch" value="'+esc(W.teacherSearch)+'" placeholder="بحث باسم المعلم..." aria-label="بحث باسم المعلم"><select id="tmwTeacherSubject" aria-label="تصفية المعلمين حسب المادة"><option value="all">كل المواد</option><option value="reading" '+(W.teacherSubject==='reading'?'selected':'')+'>القراءة</option><option value="math" '+(W.teacherSubject==='math'?'selected':'')+'>الرياضيات</option><option value="science" '+(W.teacherSubject==='science'?'selected':'')+'>العلوم</option></select></div>':'')+
   '<div class="tmw-teacher-grid">'+(cards.length?cards.map(teacherCard).join(''):'<div class="tmw-empty">لا يوجد معلمون مطابقون للبحث.</div>')+'</div>'+
   '<div class="tmw-dropzone '+(W.selected.size?'has-items':'')+'" id="tmwTeacherDrop"><div><b>المعلمون المحددون للتقرير</b><span>'+(W.selected.size?selectedLabel():(self?'حسابك الحالي':'جميع المعلمين حاليًا'))+'</span></div><div class="tmw-selected-chips">'+(W.selected.size?allowedTeachers().filter(t=>W.selected.has(String(t.id))).map(t=>'<button type="button" data-teacher-remove="'+esc(t.id)+'">'+esc(t.label)+' ×</button>').join(''):'<span>اسحب بطاقة إلى هنا لتخصيص التقرير</span>')+'</div></div>'+
 '</section>';
}
function filters(){
 return '<section class="tmw-panel"><div class="tmw-panel-head"><div><span class="tmw-eyebrow">التقارير والفلاتر</span><h2>فلترة الأعمال</h2><p>الفلترة تطبق على الخادم قبل إنشاء التقرير والطباعة.</p></div><button type="button" class="tmw-print-main" data-print-current>طباعة التقرير الحالي</button></div>'+
 '<div class="tmw-filters">'+
 '<label><span>الحالة</span><select id="tmwStatus"><option value="all">كل الحالات</option><option value="completed" '+(W.filters.status==='completed'?'selected':'')+'>منجز</option><option value="in_progress" '+(W.filters.status==='in_progress'?'selected':'')+'>قيد التنفيذ</option><option value="assigned" '+(W.filters.status==='assigned'?'selected':'')+'>غير منجز</option></select></label>'+
 '<label><span>المادة</span><select id="tmwSubject"><option value="all">كل المواد</option><option value="reading" '+(W.filters.subject==='reading'?'selected':'')+'>القراءة</option><option value="math" '+(W.filters.subject==='math'?'selected':'')+'>الرياضيات</option><option value="science" '+(W.filters.subject==='science'?'selected':'')+'>العلوم</option></select></label>'+
 '<label><span>من تاريخ</span><input id="tmwFrom" type="date" value="'+esc(W.filters.from)+'"></label>'+
 '<label><span>إلى تاريخ</span><input id="tmwTo" type="date" value="'+esc(W.filters.to)+'"></label>'+
 '<div class="tmw-filter-actions"><button type="button" class="primary" data-apply-filters>تطبيق</button><button type="button" data-reset-filters>إعادة ضبط</button></div>'+
 '</div></section>';
}
function recentCompleted(){
 const rows=activeRows().filter(x=>x.status==='completed').slice(0,8);
 return '<section class="tmw-panel"><div class="tmw-panel-head"><div><span class="tmw-eyebrow">آخر الإنجازات</span><h2>آخر الطلاب الذين أنجزوا</h2><p>الأخضر يعني أن العمل مكتمل ومسجل فعليًا.</p></div></div>'+
 (rows.length?'<div class="tmw-recent-grid">'+rows.map(x=>'<article class="tmw-recent done"><div class="tmw-recent-icon">✓</div><div><b>'+esc(x.student_name||'طالب')+'</b><span>الفصل '+esc(x.class_name||'—')+' · '+esc(subjectLabel(x.subject_key))+'</span><small>'+esc(x.title||x.indicator_text||'عمل تدريبي')+' · '+esc(dt(x.completed_at||x.event_at))+'</small></div><button type="button" data-print-student="'+esc(x.student_id)+'">تقرير الطالب</button></article>').join('')+'</div>':'<div class="tmw-empty">لا توجد أعمال مكتملة ضمن الفلتر الحالي.</div>')+
 '</section>';
}
function statusBadge(s){const m=statusMeta(s);return '<span class="tmw-status '+m.cls+'">'+m.icon+' '+m.label+'</span>'}
function activityTable(){
 const rows=activeRows(),total=rows.length,pages=Math.max(1,Math.ceil(total/W.pageSize));if(W.page>pages)W.page=pages;
 const start=(W.page-1)*W.pageSize,shown=rows.slice(start,start+W.pageSize);
 return '<section class="tmw-panel"><div class="tmw-panel-head"><div><span class="tmw-eyebrow">التفاصيل</span><h2>سجل الأعمال</h2><p>الألوان وظيفية: أخضر منجز، عنبري قيد التنفيذ، أحمر غير منجز.</p></div><span class="tmw-count">عرض '+fmt(shown.length)+' من '+fmt(total)+'</span></div>'+
 (shown.length?'<div class="tmw-table-wrap"><table class="tmw-table"><thead><tr><th>الطالب</th><th>المعلم</th><th>المادة</th><th>العمل</th><th>الحالة</th><th>النتيجة</th><th>آخر نشاط</th><th>تقرير</th></tr></thead><tbody>'+
 shown.map(x=>'<tr><td><b>'+esc(x.student_name||'طالب')+'</b><small>الفصل '+esc(x.class_name||'—')+'</small></td><td>'+esc(x.teacher_label||'معلم')+'</td><td>'+esc(subjectLabel(x.subject_key))+'</td><td><b>'+esc(x.title||'عمل')+'</b><small>'+esc(x.indicator_text||'')+'</small></td><td>'+statusBadge(x.status)+'</td><td>'+(x.percent==null?'—':pct(x.percent))+'</td><td>'+esc(dt(x.event_at))+'</td><td><div class="tmw-row-actions"><button type="button" data-print-student="'+esc(x.student_id)+'">طالب</button><button type="button" data-print-task="'+esc(x.task_id)+'">العمل</button></div></td></tr>').join('')+
 '</tbody></table></div><div class="tmw-pagination"><button type="button" data-page-prev '+(W.page<=1?'disabled':'')+'>السابق</button><span>صفحة '+fmt(W.page)+' من '+fmt(pages)+'</span><button type="button" data-page-next '+(W.page>=pages?'disabled':'')+'>التالي</button></div>':'<div class="tmw-empty">لا توجد أعمال مطابقة للفلاتر الحالية.</div>')+
 '</section>';
}
function render(){
 const host=mountHost();if(!host)return;
 if(W.loading&&!W.data){host.innerHTML='<div class="tmw-loading"><span></span><b>جارٍ تحميل لوحة المعلمين…</b></div>';return}
 if(W.error&&!W.data){host.innerHTML='<div class="tmw-error"><b>تعذر تحميل بيانات المعلمين</b><span>'+esc(W.error)+'</span><button type="button" data-retry>إعادة المحاولة</button></div>';wire();return}
 host.innerHTML='<div class="tmw-shell">'+
 '<section class="tmw-hero"><div><span class="tmw-hero-tag">'+(W.data?.access_mode==='all'?'الحساب الرئيسي • متابعة المعلمين':'حساب معلم المادة • متابعة الأداء')+'</span><h1>المعلمون والأعمال</h1><p>لوحة واحدة لمتابعة الإنجاز، اختيار المعلمين، مراجعة آخر أعمال الطلاب، وإصدار تقارير قابلة للطباعة.</p></div><div class="tmw-hero-side"><div><span>النطاق الحالي</span><b>'+esc(selectedLabel())+'</b></div><button type="button" data-refresh>تحديث البيانات</button></div></section>'+
 kpis()+teacherSelector()+filters()+recentCompleted()+activityTable()+
 '</div>';
 wire();
}
function dragTeacher(id){if(id)W.selected.add(String(id));W.page=1;loadReport()}
function wire(){
 const host=mountHost();if(!host)return;
 const retry=host.querySelector('[data-retry]');if(retry)retry.onclick=()=>loadOverview(true);
 const refresh=host.querySelector('[data-refresh]');if(refresh)refresh.onclick=()=>loadOverview(true);
 const search=host.querySelector('#tmwTeacherSearch');if(search)search.oninput=e=>{W.teacherSearch=e.target.value;render()};
 const ts=host.querySelector('#tmwTeacherSubject');if(ts)ts.onchange=e=>{W.teacherSubject=e.target.value;render()};
 host.querySelectorAll('[data-teacher-toggle]').forEach(b=>b.onclick=()=>{const id=String(b.dataset.teacherToggle);W.selected.has(id)?W.selected.delete(id):W.selected.add(id);W.page=1;loadReport()});
 host.querySelectorAll('[data-teacher-remove]').forEach(b=>b.onclick=()=>{W.selected.delete(String(b.dataset.teacherRemove));W.page=1;loadReport()});
 host.querySelectorAll('[data-teacher-drag]').forEach(card=>{card.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(card.dataset.teacherDrag));e.dataTransfer.effectAllowed='copy'}});
 const drop=host.querySelector('#tmwTeacherDrop');if(drop){drop.ondragover=e=>{e.preventDefault();drop.classList.add('drag-over')};drop.ondragleave=()=>drop.classList.remove('drag-over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag-over');dragTeacher(e.dataTransfer.getData('text/plain'))}}
 const allBtn=host.querySelector('[data-select-all]');if(allBtn)allBtn.onclick=()=>{if(W.selected.size)W.selected.clear();else allowedTeachers().forEach(t=>W.selected.add(String(t.id)));W.page=1;loadReport()};
 const apply=host.querySelector('[data-apply-filters]');if(apply)apply.onclick=()=>{W.filters.status=host.querySelector('#tmwStatus')?.value||'all';W.filters.subject=host.querySelector('#tmwSubject')?.value||'all';W.filters.from=host.querySelector('#tmwFrom')?.value||'';W.filters.to=host.querySelector('#tmwTo')?.value||'';W.page=1;loadReport()};
 const reset=host.querySelector('[data-reset-filters]');if(reset)reset.onclick=()=>{W.filters={status:'all',subject:'all',from:'',to:''};W.page=1;loadReport()};
 const prev=host.querySelector('[data-page-prev]');if(prev)prev.onclick=()=>{W.page=Math.max(1,W.page-1);render()};
 const next=host.querySelector('[data-page-next]');if(next)next.onclick=()=>{W.page++;render()};
 const pc=host.querySelector('[data-print-current]');if(pc)pc.onclick=()=>printReport('activity',activeRows(),activeSummary(),'تقرير الأعمال الحالي',selectedLabel());
 host.querySelectorAll('[data-print-teacher]').forEach(b=>b.onclick=()=>printTeacher(String(b.dataset.printTeacher)));
 host.querySelectorAll('[data-print-student]').forEach(b=>b.onclick=()=>printStudent(String(b.dataset.printStudent)));
 host.querySelectorAll('[data-print-task]').forEach(b=>b.onclick=()=>printTask(String(b.dataset.printTask)));
}
async function loadOverview(force=false){
 if(W.loading&&!force)return;
 W.loading=true;W.error='';render();
 try{
   const [data,report]=await Promise.all([
     post('teacher_management_overview'),
     post('teacher_management_report',{status:W.filters.status,subject:W.filters.subject,from:W.filters.from||null,to:W.filters.to||null,teacher_ids:selectedTeacherIds(),limit:1000})
   ]);
   W.data=data;W.report=report;
   if(data.access_mode==='self'&&Array.isArray(data.teachers)&&data.teachers[0])W.selected=new Set([String(data.teachers[0].id)]);
 }catch(e){W.error=e.message||'تعذر تحميل البيانات'}
 finally{W.loading=false;render()}
}
async function loadReport(extra={}){
 if(!W.data)return loadOverview();
 const host=mountHost();if(host)host.classList.add('tmw-busy');
 try{
  W.report=await post('teacher_management_report',{status:W.filters.status,subject:W.filters.subject,from:W.filters.from||null,to:W.filters.to||null,teacher_ids:selectedTeacherIds(),limit:1000,...extra});
 }catch(e){W.error=e.message||'تعذر تحديث التقرير'}
 finally{host?.classList.remove('tmw-busy');render()}
}
async function reportFetch(extra={}){
 return await post('teacher_management_report',{teacher_ids:selectedTeacherIds(),status:'all',subject:'all',from:null,to:null,limit:1000,...extra});
}
function reportRowsHtml(rows){
 return '<table class="tmw-print-table"><thead><tr><th>الطالب</th><th>المعلم</th><th>المادة</th><th>العمل</th><th>الحالة</th><th>النتيجة</th><th>التاريخ</th></tr></thead><tbody>'+
 rows.map(x=>'<tr><td>'+esc(x.student_name||'طالب')+'<small>الفصل '+esc(x.class_name||'—')+'</small></td><td>'+esc(x.teacher_label||'معلم')+'</td><td>'+esc(subjectLabel(x.subject_key))+'</td><td>'+esc(x.title||x.indicator_text||'عمل')+'</td><td>'+esc(statusMeta(x.status).label)+'</td><td>'+(x.percent==null?'—':pct(x.percent))+'</td><td>'+esc(dOnly(x.event_at))+'</td></tr>').join('')+
 '</tbody></table>';
}
function printReport(kind,rows,summary,title,subtitle){
 document.querySelector('.tmw-print-root')?.remove();
 const root=document.createElement('section');root.className='tmw-print-root';root.dir='rtl';
 const s=summary||{},safeRows=Array.isArray(rows)?rows:[];
 root.innerHTML='<article class="tmw-print-sheet"><header><div><small>مِنَصَّةُ تَمَكُّن • تقرير '+(kind==='teacher'?'معلم':kind==='student'?'طالب':kind==='task'?'عمل':'أعمال')+'</small><h1>'+esc(title)+'</h1><p>'+esc(subtitle||'')+'</p></div><div class="tmw-print-date">تاريخ الطباعة<br><b>'+esc(new Date().toLocaleDateString('ar-SA'))+'</b></div></header>'+
 '<section class="tmw-print-kpis"><div><span>إجمالي الأعمال</span><b>'+fmt(s.task_total??safeRows.length)+'</b></div><div class="done"><span>منجز</span><b>'+fmt(s.completed??safeRows.filter(x=>x.status==='completed').length)+'</b></div><div class="doing"><span>قيد التنفيذ</span><b>'+fmt(s.in_progress??safeRows.filter(x=>x.status==='in_progress').length)+'</b></div><div class="pending"><span>غير منجز</span><b>'+fmt(s.assigned??safeRows.filter(x=>x.status==='assigned').length)+'</b></div><div><span>الإنجاز</span><b>'+pct(s.completion_rate??(safeRows.length?safeRows.filter(x=>x.status==='completed').length/safeRows.length*100:0))+'</b></div></section>'+
 reportRowsHtml(safeRows)+
 '<footer>تقرير آلي من بيانات الأعمال الفعلية في تمكّن • لا توجد حالة «متأخر» دون موعد استحقاق مسجل.</footer></article>';
 document.body.appendChild(root);document.body.classList.add('tmw-printing');
 const cleanup=()=>{document.body.classList.remove('tmw-printing');root.remove();window.removeEventListener('afterprint',cleanup)};
 window.addEventListener('afterprint',cleanup);setTimeout(()=>window.print(),60);setTimeout(()=>{if(document.body.classList.contains('tmw-printing'))cleanup()},30000);
}
async function printTeacher(id){
 try{
  const teacher=allowedTeachers().find(t=>String(t.id)===id),r=await post('teacher_management_report',{teacher_ids:[id],status:'all',subject:'all',limit:1000});
  printReport('teacher',r.rows||[],r.summary||{},'تقرير '+(teacher?.label||'المعلم'),subjectLabel(teacher?.subject_scope));
 }catch(e){alert(e.message)}
}
async function printStudent(id){
 try{
  const r=await reportFetch({student_id:id}),row=(r.rows||[])[0];
  printReport('student',r.rows||[],r.summary||{},'تقرير الطالب: '+(row?.student_name||'طالب'),'الفصل '+(row?.class_name||'—')+' • '+selectedLabel());
 }catch(e){alert(e.message)}
}
function printTask(id){
 const row=activeRows().find(x=>String(x.task_id)===id);if(!row)return;
 const s={task_total:1,completed:row.status==='completed'?1:0,in_progress:row.status==='in_progress'?1:0,assigned:row.status==='assigned'?1:0,completion_rate:row.status==='completed'?100:0};
 printReport('task',[row],s,'تقرير العمل: '+(row.title||'عمل تدريبي'),row.student_name+' • '+row.teacher_label);
}
function startAutoRefresh(){
 clearInterval(W.refreshTimer);
 W.refreshTimer=setInterval(()=>{if(!mountHost()){clearInterval(W.refreshTimer);W.refreshTimer=null;return}if(document.visibilityState==='visible')loadOverview(true)},60000);
}
async function mount(opts={}){
 W.token=opts.token||W.token;W.profile=opts.profile||W.profile;
 if(!W.token)return;
 const host=mountHost();if(!host)return;
 await loadOverview();
 startAutoRefresh();
}
window.TamakkunTeacherWorkspace={mount};
})();
