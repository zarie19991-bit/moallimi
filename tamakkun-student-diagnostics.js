(()=>{
'use strict';
/* Tamakkun phase 1: teacher-only, read-only, grounded in the existing authenticated monitor snapshot. */
const ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/tamakkun-student-monitor';
const S={host:null,token:null,scope:'all',data:null,student:'',cls:'all',subject:'all',search:'',loading:false,error:'',mountVersion:0,question:null,qError:'',qLoading:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=v=>String(v??'').trim();
const pct=n=>n===null||n===undefined||Number.isNaN(Number(n))?'لم يُقَس':(Math.round(Number(n)*10)/10).toLocaleString('ar-SA')+'٪';
const sub=v=>({math:'الرياضيات',science:'العلوم',reading:'القراءة',lughati:'لغتي الخالدة'})[v]||'غير محدد';
const when=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ar-SA',{timeZone:'Asia/Riyadh',dateStyle:'short',timeStyle:'short'})};
function style(){
 if(document.getElementById('tamakkun-student-diagnostics-style'))return;
 const c=document.createElement('style');c.id='tamakkun-student-diagnostics-style';
 c.textContent='.tsd{font-family:Tajawal,Tahoma,Arial,sans-serif;color:#174139;direction:rtl;max-width:1280px;margin:auto;padding:12px}.tsd *{box-sizing:border-box}.tsd-head{background:linear-gradient(120deg,#074b40,#0c7965);color:white;padding:27px;border-radius:23px;margin-bottom:15px}.tsd-head h1{font-size:25px;font-weight:900;margin:4px 0 9px}.tsd-head p{color:#d9f8ed;line-height:1.8;font-size:14px}.tsd-head small{color:#caf9e7}.tsd-btn{border:1px solid #cfe3d9;background:white;color:#075d4c;border-radius:11px;padding:10px 15px;cursor:pointer;font-weight:800;font:inherit}.tsd-btn:disabled{opacity:.45;cursor:not-allowed}.tsd-btn.primary{background:#08735c;color:white;border-color:#08735c}.tsd-controls{display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:10px;margin:14px 0}.tsd-controls label{display:block;font-size:12px;font-weight:800;color:#526d65;margin-bottom:5px}.tsd input,.tsd select{width:100%;border:1px solid #cadfd4;border-radius:12px;background:white;padding:10px;min-height:44px;font:inherit}.tsd-panel{background:white;border:1px solid #dbe9e2;border-radius:19px;padding:19px;margin-bottom:14px}.tsd-note{background:#f0f7f4;border:1px solid #d8e9df;padding:13px 16px;border-radius:13px;line-height:1.9;color:#355e51;font-size:13px}.tsd-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:15px 0}.tsd-card{background:#f7faf8;border:1px solid #deebe4;border-radius:15px;padding:14px}.tsd-card b{font-size:20px;display:block;color:#0b6757}.tsd-card small{font-size:11px;color:#587668}.tsd-tablewrap{overflow-x:auto}.tsd table{border-collapse:collapse;width:100%;font-size:13px;min-width:690px}.tsd th,.tsd td{padding:12px 10px;text-align:right;border-bottom:1px solid #edf1ee;vertical-align:top}.tsd th{background:#f0f6f2;color:#234b40;position:sticky;top:0}.tsd-badge{display:inline-block;border-radius:50px;background:#eff2f0;color:#466058;font-size:11px;padding:4px 9px;white-space:nowrap}.tsd-badge.low{background:#fee8e7;color:#9d292c}.tsd-badge.mid{background:#fff3d7;color:#865a08}.tsd-badge.high{background:#e2f5eb;color:#147047}.tsd-muted{color:#71897b}.tsd-rowhead{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap}.tsd-empty{padding:30px;text-align:center;color:#75867c}@media(max-width:900px){.tsd-controls{grid-template-columns:1fr 1fr}.tsd-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:580px){.tsd-controls{grid-template-columns:1fr}.tsd-cards{grid-template-columns:1fr 1fr}.tsd-head{padding:20px}.tsd-head h1{font-size:21px}}';
 document.head.appendChild(c);
}
function options(rows,selected){
 return rows.map(x=>'<option value="'+esc(x[0])+'"'+(String(x[0])===String(selected)?' selected':'')+'>'+esc(x[1])+'</option>').join('');
}
function students(){
 const d=S.data;if(!d)return[];
 const allowed=(d.students||[]).filter(x=>S.cls==='all'||text(x.class_name)===S.cls);
 const query=S.search.toLocaleLowerCase('ar');
 return allowed.filter(x=>!query||text(x.full_name).toLocaleLowerCase('ar').includes(query)||text(x.class_name).includes(query)).sort((a,b)=>text(a.full_name).localeCompare(text(b.full_name),'ar'));
}
function student(){return (S.data?.students||[]).find(x=>String(x.id)===String(S.student))||null}
function indicators(){
 const d=S.data||{},s=student();if(!s)return[];
 const id=String(s.id),evidence=(d.evidence||[]).filter(x=>String(x.student_id)===id),tasks=(d.tasks||[]).filter(x=>String(x.student_id)===id);
 return (d.indicators||[]).filter(i=>S.scope==='all'||i.subject_key===S.scope).filter(i=>S.subject==='all'||i.subject_key===S.subject).map(i=>{
   const key=x=>String(x.subject_key)===String(i.subject_key)&&String(x.outcome_code)===String(i.outcome_code)&&Number(x.indicator_index)===Number(i.indicator_index);
   const found=evidence.filter(key).sort((a,b)=>String(b.submitted_at||'').localeCompare(String(a.submitted_at||'')));
   const assigned=tasks.filter(key).sort((a,b)=>String(b.assigned_at||'').localeCompare(String(a.assigned_at||'')));
   const recent=found[0]||null,plan=assigned[0]||null;
   const score=recent&&Number(recent.total)>0?100*Number(recent.score)/Number(recent.total):null;
   const state=score===null?'unmeasured':score<50?'low':score<80?'mid':'high';
   return{ind:i,score,state,recent,plan,attempts:found.length,assignments:assigned.length};
 }).sort((a,b)=>{const v=x=>x.score===null?Infinity:x.score;return v(a)-v(b)});
}
function header(){
 return '<div class="tsd-head"><small>منصة تمكّن • المرحلة الأولى • للمعلم فقط</small><h1>ملف التشخيص الفردي للطالب</h1><p>متابعة مؤشرات نافس في الرياضيات والعلوم والقراءة، وربط النتائج بالتدخلات القائمة دون تغيير الدرجات أو منح إتقان تلقائي.</p></div>';
}

const attemptEndpoint='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-moallimi-read';
const optionValue=v=>typeof v==='string'?v:text(v?.text??v?.label??v?.value??'');
function errorDetails(){
 if(S.qLoading)return '<section class="tsd-panel">جارٍ فتح الأسئلة الأصلية…</section>';
 if(S.qError)return '<section class="tsd-panel"><div class="tsd-note">'+esc(S.qError)+'</div></section>';
 if(!S.question)return '';
 const wrong=S.question.items.filter(x=>!x.right);
 return '<section class="tsd-panel"><div class="tsd-rowhead"><h2>شرح الأسئلة الخاطئة</h2><button id="tsd-close-q" class="tsd-btn">إغلاق</button></div><div class="tsd-note">'+wrong.length+' من '+S.question.items.length+' أسئلة أخطأ فيها الطالب أو لم يجب عنها. لا تثبت الإجابة الخاطئة وحدها سبب التعثر.</div>'+
 (wrong.length?wrong.map(x=>'<article style="padding:13px;border:1px solid #dbe6db;margin:12px 0;border-radius:12px"><b>السؤال '+esc(x.no)+'</b>'+
 (x.context?'<p style="white-space:pre-wrap">'+esc(x.context)+'</p>':'')+'<p style="white-space:pre-wrap">'+esc(x.body)+'</p>'+
 (x.image?'<div class="tsd-note">يحتوي السؤال على صورة؛ راجع ورقة الاختبار الأصلية.</div>':'')+
 '<p>إجابة الطالب: <b style="color:#ac2f3b">'+esc(x.answered?optionValue(x.options[x.selected]):'لم يجب')+'</b></p>'+
 '<p>الإجابة الصحيحة: <b style="color:#086c4b">'+esc(optionValue(x.options[x.correctIndex]))+'</b></p>'+
 '<div class="tsd-note"><strong>التفسير المسجل:</strong> '+esc(x.explanation||'لا يوجد تفسير محفوظ؛ يحتاج مراجعة المعلم.')+'</div></article>').join(''):'<p class="tsd-empty">لم يُسجل خطأ في أسئلة هذا المؤشر بهذه المحاولة.</p>')+'</section>';
}
async function showErrors(index){
 const st=student(),r=indicators()[index];if(!st||!r?.recent?.attempt_id)return;
 const id=String(st.id),version=S.mountVersion,token=S.token;S.question=null;S.qError='';S.qLoading=true;render();
 try{
 const response=await fetch(attemptEndpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'attempt',source:'assessment',id:r.recent.attempt_id}),cache:'no-store'});
 const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok||!result.attempt)throw Error(result.error||'لم تتوفر تفاصيل المحاولة.');
 if(String(result.attempt.student_id)!==id)throw Error('معرّف الطالب لا يطابق المحاولة.');
 const items=[],answers=result.attempt.answers||{};
 for(const section of(Array.isArray(result.attempt.rendered_sections)?result.attempt.rendered_sections:[])){
  for(const q of(Array.isArray(section.questions)?section.questions:[])){
   if(String(q.subject||section.subject)!==String(r.ind.subject_key)||String(q.outcome)!==String(r.ind.outcome_code)||Number(q.indicator)!==Number(r.ind.indicator_index))continue;
   const options=Array.isArray(q.options)?q.options:[],correctIndex=Number(q.correctIndex);
   if(!q.id||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>=options.length)continue;
   const exists=Object.prototype.hasOwnProperty.call(answers,q.id),selected=exists?Number(answers[q.id]):null;
   const answered=exists&&answers[q.id]!==null&&answers[q.id]!==''&&Number.isInteger(selected)&&selected>=0&&selected<options.length;
   items.push({no:q.question_no||items.length+1,body:q.question||'',context:q.context||'',image:q.image,options,selected,correctIndex,answered,right:answered&&selected===correctIndex,explanation:q.explanation||''});
  }
 }
 if(version!==S.mountVersion||String(S.student)!==id||S.token!==token)return;
 if(items.length)S.question={items};else S.qError='لا توجد أسئلة لهذا المؤشر في المحاولة المحفوظة.';
 }catch(e){if(version===S.mountVersion&&String(S.student)===id)S.qError=e.message}
 finally{if(version===S.mountVersion&&String(S.student)===id){S.qLoading=false;render()}}
}

function render(){
 if(!S.host)return;style();
 if(S.loading&&!S.data){S.host.innerHTML='<div class="tsd">'+header()+'<div class="tsd-panel tsd-empty">جارٍ تحميل النتائج المصرّح بها…</div></div>';return}
 if(S.error&&!S.data){S.host.innerHTML='<div class="tsd">'+header()+'<div class="tsd-panel tsd-empty">'+esc(S.error)+' <button class="tsd-btn" id="tsd-retry">إعادة المحاولة</button></div></div>';S.host.querySelector('#tsd-retry').onclick=load;return}
 const d=S.data||{students:[],indicators:[],evidence:[],tasks:[],sessions:[]},list=students();
 if(S.student&&!(d.students||[]).some(x=>String(x.id)===String(S.student)))S.student='';
 const classes=[...new Set((d.students||[]).map(x=>text(x.class_name)).filter(Boolean))].sort();
 let html='<div class="tsd">'+header()+'<div class="tsd-panel"><div class="tsd-rowhead"><strong>اختيار الطالب ومادته</strong><button class="tsd-btn" id="tsd-refresh"'+(S.loading?' disabled':'')+'>تحديث البيانات</button></div><div class="tsd-controls">'+
 '<div><label>بحث عن الطالب</label><input id="tsd-search" type="search" placeholder="اسم الطالب أو الفصل" value="'+esc(S.search)+'"></div>'+
 '<div><label>الفصل</label><select id="tsd-class">'+options([['all','جميع الفصول'],...classes.map(x=>[x,x])],S.cls)+'</select></div>'+
 '<div><label>المادة</label><select id="tsd-subject">'+options([['all','مواد نافس الثلاث'],...[['reading','القراءة'],['math','الرياضيات'],['science','العلوم']].filter(x=>S.scope==='all'||x[0]===S.scope)],S.subject)+'</select></div>'+
 '<div><label>اختيار</label><button class="tsd-btn primary" id="tsd-print"'+(student()?'':' disabled')+'>طباعة مسودة علاج</button></div></div>'+
 '<div><label for="tsd-student" style="font-size:12px;display:block;margin-bottom:5px">الطالب</label><select id="tsd-student">'+options([['','اختر الطالب لعرض ملفه'],...list.map(x=>[x.id,text(x.full_name)+' — '+text(x.class_name||'دون فصل')])],S.student)+'</select></div></div>';
 const s=student();
 if(s){
 const rows=indicators(),measured=rows.filter(x=>x.score!==null),low=rows.filter(x=>x.state==='low'),pending=rows.filter(x=>x.score===null),assigned=rows.filter(x=>x.assignments>0),lastSeen=(d.sessions||[]).filter(x=>String(x.student_id)===String(s.id)).sort((a,b)=>String(b.last_seen_at||b.created_at).localeCompare(String(a.last_seen_at||a.created_at)))[0];
 html+='<section class="tsd-panel"><div class="tsd-rowhead"><div><strong>'+esc(s.full_name)+'</strong><div class="tsd-muted">'+esc(s.class_name||'الفصل غير محدد')+' • آخر نشاط مسجل: '+esc(when(lastSeen?.last_seen_at||lastSeen?.created_at))+'</div></div><span class="tsd-badge">معرّف الطالب موحّد داخل قاعدة نافس</span></div>'+
 '<div class="tsd-cards">'+[['مؤشرات قِيست',measured.length],['مؤشرات دون قياس',pending.length],['مؤشرات أقل من 50٪',low.length],['مؤشرات لها تكليف',assigned.length]].map(x=>'<div class="tsd-card"><small>'+esc(x[0])+'</small><b>'+x[1].toLocaleString('ar-SA')+'</b></div>').join('')+'</div>'+
 '<div class="tsd-note">يمكن فتح أخطاء الأسئلة الأصلية وإجابات الطالب وتفسير الإجابة المحفوظ. يتطلب تحديد سبب التعثر مراجعة المعلم. لا يُعد ارتفاع الدرجة وحده اعتمادًا للإتقان.</div></section>'+
 '<section class="tsd-panel"><h2 style="font-size:18px;font-weight:900;margin-bottom:12px">نتائج المؤشرات والخطط المسندة</h2><div class="tsd-tablewrap"><table><thead><tr><th>المادة</th><th>المؤشر</th><th>آخر قياس</th><th>التصنيف الأولي</th><th>التدخل</th><th>تاريخ القياس</th><th>تفاصيل الخطأ</th></tr></thead><tbody>'+
 (rows.length?rows.map((x,i)=>'<tr><td>'+esc(sub(x.ind.subject_key))+'</td><td style="max-width:350px">'+esc(x.ind.indicator_text||('مؤشر '+x.ind.indicator_index))+'</td><td><b>'+esc(pct(x.score))+'</b></td><td><span class="tsd-badge '+x.state+'">'+(x.state==='unmeasured'?'لم يُقَس':x.state==='low'?'يحتاج علاجًا':x.state==='mid'?'يحتاج تعزيزًا':'أداء مرتفع')+'</span></td><td>'+(x.plan?esc(x.plan.solved?'مكتمل وفق سجل التكليف':x.plan.status||'مسند'):'غير مسند')+'</td><td>'+esc(when(x.recent?.submitted_at))+'</td><td>'+(x.recent?.attempt_id?'<button class="tsd-btn" data-tsd-errors="'+i+'">شرح الأسئلة الخاطئة</button>':'—')+'</td></tr>').join(''):'<tr><td colspan="7" class="tsd-empty">لا توجد مؤشرات مطابقة للمرشح الحالي.</td></tr>')+
 '</tbody></table></div></section>'+errorDetails();
 }else{
 html+='<div class="tsd-panel tsd-empty">اختر طالبًا من القائمة ليظهر تشخيصه القائم على سجلات المنصة.</div>';
 }
 html+='<section class="tsd-panel"><h2 style="font-size:17px;font-weight:900;margin-bottom:9px">لغتي الخالدة • الثالث المتوسط</h2><p class="tsd-note">دروس لغتي الخالدة محفوظة في قاعدة بيانات أخرى. لم ندمج الحسابات بالاسم، ولم نعرض نتائج غير مؤكدة. يتطلب إظهارها في هذا الملف اعتماد رابط هوية آمن بين الحسابين وخدمة قراءة بصلاحيات المعلم.</p></section></div>';
 S.host.innerHTML=html;
 const on=(id,ev,fn)=>{const x=S.host.querySelector('#'+id);if(x)x.addEventListener(ev,fn)};
 on('tsd-retry','click',load);on('tsd-refresh','click',load);on('tsd-search','change',e=>{S.search=e.target.value;S.student='';render()});
 on('tsd-class','change',e=>{S.cls=e.target.value;S.student='';render()});
 on('tsd-subject','change',e=>{S.subject=e.target.value;S.question=null;S.qError='';S.qLoading=false;render()});
 on('tsd-student','change',e=>{S.student=e.target.value;S.question=null;S.qError='';S.qLoading=false;render()});
 on('tsd-print','click',printDraft);
 on('tsd-close-q','click',()=>{S.question=null;S.qError='';render()});
 S.host.querySelectorAll('[data-tsd-errors]').forEach(b=>b.onclick=()=>showErrors(Number(b.dataset.tsdErrors)));
}
function printDraft(){
 const s=student();if(!s)return;const arr=indicators().filter(x=>x.state==='low'||x.state==='mid'),items=arr.length?arr.map(x=>'<tr><td>'+esc(sub(x.ind.subject_key))+'</td><td>'+esc(x.ind.indicator_text||'—')+'</td><td>'+esc(pct(x.score))+'</td><td>مراجعة السؤال الخاطئ مع الطالب، شرح المهارة، تدريب جديد ثم قياس مستقل</td></tr>').join(''):'<tr><td colspan="4">لا توجد مؤشرات علاجية مطابقة للاختيار. راجع نتائج القياس قبل إصدار خطة.</td></tr>';
 const w=window.open('','_blank','width=900,height=850');if(!w){alert('اسمح بفتح نافذة الطباعة لهذا الموقع.');return}
 try{w.opener=null}catch(_){}
 w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>مسودة خطة علاجية</title><style>body{font:14px Tahoma,Arial;padding:22px;color:#163b34;line-height:1.8}h1{font-size:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:9px;text-align:right;vertical-align:top}th{background:#edf5f1}.note{border:1px solid #d5e7dc;background:#f5faf6;padding:13px;margin:15px 0}@page{size:A4;margin:14mm}@media print{button{display:none}}</style></head><body><header><strong>المملكة العربية السعودية – وزارة التعليم – إدارة التعليم بنجران – مدرسة ابن سينا المتوسطة</strong><h1>مسودة خطة علاجية فردية • تمكّن</h1></header><p>الطالب: '+esc(s.full_name)+'　|　الفصل: '+esc(s.class_name||'—')+'</p><div class="note">هذه مسودة مراجعة للمعلم من نتائج المؤشرات. ليست شرحًا معتمدًا للأسئلة الخاطئة، ولا تنشئ خطة في قاعدة البيانات. يجب توثيق الأسئلة والمهارات الدقيقة وتحديد موعد القياس البعدي قبل الاعتماد.</div><table><thead><tr><th>المادة</th><th>المؤشر</th><th>القياس</th><th>الإجراء المقترح</th></tr></thead><tbody>'+items+'</tbody></table><p>ملاحظات المعلم: ____________________________________________</p><p>القياس البعدي: ____________________　النتيجة: ____________________</p><button onclick="print()">طباعة</button></body></html>');
 w.document.close();w.focus();
}
async function load(){
 if(!S.host||!S.token)return;
 const version=S.mountVersion;S.loading=true;S.error='';render();
 try{
 const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+S.token},body:JSON.stringify({action:'snapshot'}),cache:'no-store'});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.ok!==true||!Array.isArray(d.students)||!Array.isArray(d.indicators))throw Error(d.error||'تعذّر قراءة ملف التشخيص من الخادم.');
 if(version!==S.mountVersion)return;S.data=d;
 }catch(err){if(version===S.mountVersion)S.error=err.message||'تعذّر تحميل البيانات.'}
 finally{if(version===S.mountVersion){S.loading=false;render()}}
}
window.TamakkunStudentDiagnostics={mount(opts={}){
 if(opts.role!=='teacher'||!opts.token)return;
 S.mountVersion++;S.host=document.getElementById('tamakkunStudentDiagnosticsMount');if(!S.host)return;
 if(S.token!==opts.token){S.data=null;S.student='';S.search='';S.cls='all';S.subject='all';S.error='';}
 S.question=null;S.qError='';S.qLoading=false;S.token=opts.token;S.scope=['reading','math','science'].includes(opts.profile?.subject_scope)?opts.profile.subject_scope:'all';
 if(S.subject!=='all'&&S.scope!=='all'&&S.subject!==S.scope)S.subject='all';
 if(S.data)render();else load();
},unmount(){S.mountVersion++;S.question=null;S.qLoading=false;S.host=null;S.token=null;S.data=null},refresh:load};
})();