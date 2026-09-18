(()=>{
'use strict';
const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-adaptive-plan',KEY='lugati_exact_session_v2';
const S={token:null,data:null,loading:false,error:'',q:'',cls:'all',subject:'all',type:'all',selected:new Set(),printing:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const subj=s=>s==='reading'?'القراءة':s==='math'?'الرياضيات':s==='science'?'العلوم':'—';
const typeLabel=t=>t==='starter'?'تمهيدي':t==='remedial'?'علاجي':t==='reinforcement'?'تعزيز':t==='enrichment'?'إثرائي':t==='mastery'?'إتقان':'تدريب';
const sourceLabel=s=>s==='mastery'?'رحلة الإتقان':s==='direct'?'إرسال مباشر':'تدريب تلقائي';
function ses(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch{return null}}
async function post(action,extra={}){const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+S.token},body:JSON.stringify({action,...extra})});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||'تعذر الاتصال');return d}
function icons(){try{window.lucide?.createIcons()}catch{}}
function dateTime(v){if(!v)return'—';try{return new Date(v).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'})}catch{return'—'}}
function fmt(n){return n==null||Number.isNaN(Number(n))?'—':(Math.round(Number(n)*10)/10).toLocaleString('ar-SA')}
function ensure(){
 const s=ses();if(!s||s.role!=='teacher')return;S.token=s.token;
 const nav=document.querySelector('aside nav');if(!nav||document.getElementById('trainingArchiveBtn'))return;
 const b=document.createElement('button');b.id='trainingArchiveBtn';b.type='button';b.className='w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium text-right text-slate-600 hover:bg-sky-50 hover:text-sky-800 transition-all';
 b.innerHTML='<div class="flex items-center gap-3"><i data-lucide="archive" class="w-5 h-5 text-sky-600"></i><div class="flex flex-col"><span class="font-black">أرشيف تدريبات نافس</span><span class="text-[11px] text-slate-400">نسخ الطلاب والطباعة</span></div></div><span class="text-[9px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">شواهد</span>';
 b.onclick=open;const ref=document.getElementById('teacherMasteryBtn')||document.getElementById('adaptivePlansBtn');if(ref)ref.insertAdjacentElement('afterend',b);else nav.appendChild(b);icons();
}
function open(){
 if(document.getElementById('trainingArchiveModal'))return;
 const w=document.createElement('div');w.id='trainingArchiveModal';w.dir='rtl';w.className='fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-sm overflow-y-auto p-3 sm:p-6';
 w.innerHTML='<div class="max-w-7xl mx-auto min-h-[92vh] bg-[#f6f8fc] rounded-[2rem] shadow-2xl overflow-hidden"><header class="bg-gradient-to-l from-sky-950 via-indigo-950 to-emerald-900 text-white p-6"><div class="flex items-start justify-between gap-4"><div><div class="text-[10px] text-sky-200 font-black">شواهد ملف نافس</div><h1 class="text-3xl font-black mt-1">أرشيف تدريبات الطلاب</h1><p class="text-xs text-sky-100 mt-2 leading-6">يحفظ المحاولات الفعلية التي أداها الطلاب، ويتيح طباعة نسخة فارغة أو نسخة الطالب بإجاباته ونتيجته.</p></div><button id="taClose" class="w-10 h-10 rounded-xl bg-white/10 text-xl">×</button></div></header><div id="taBody" class="p-4 sm:p-6"></div></div>';
 document.body.appendChild(w);document.getElementById('taClose').onclick=()=>w.remove();load();
}
async function load(){S.loading=true;S.error='';paint();try{S.data=await post('teacher_training_archive')}catch(e){S.error=e.message}finally{S.loading=false;paint()}}
function rows(){
 const q=S.q.trim();return(S.data?.items||[]).filter(x=>(S.cls==='all'||String(x.class_name)===S.cls)&&(S.subject==='all'||x.subject_key===S.subject)&&(S.type==='all'||x.training_type===S.type)&&(!q||String(x.student_name).includes(q)||String(x.indicator_text).includes(q)||String(x.title).includes(q)));
}
function paint(){
 const b=document.getElementById('taBody');if(!b)return;
 if(S.loading&&!S.data){b.innerHTML='<div class="py-24 text-center text-sm text-slate-400">جارٍ جمع نسخ التدريبات الفعلية…</div>';return}
 if(S.error&&!S.data){b.innerHTML='<div class="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-rose-700 font-bold">'+esc(S.error)+'<button id="taRetry" class="block mt-4 px-4 py-2 bg-white border rounded-xl">إعادة المحاولة</button></div>';document.getElementById('taRetry').onclick=load;return}
 const t=S.data?.totals||{},all=S.data?.items||[],r=rows(),classes=[...new Set(all.map(x=>x.class_name).filter(Boolean))].sort();
 b.innerHTML='<div class="grid grid-cols-3 gap-3">'+
  card('المحاولات المحفوظة',t.attempts||0,'slate')+card('طلاب لديهم شواهد',t.students||0,'emerald')+card('قابلة للطباعة',t.printable||0,'sky')+
 '</div><section class="mt-5 bg-white border rounded-3xl p-4">'+
 '<div class="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between"><div><h2 class="font-black">نسخ تدريبات الطلاب</h2><p class="text-[11px] text-slate-400 mt-1">اختر طالبًا أو فصلًا أو مادة أو مؤشرًا، ثم اطبع النماذج التي تريدها.</p></div>'+
 '<div class="flex flex-wrap gap-2"><input id="taSearch" value="'+esc(S.q)+'" placeholder="اسم الطالب أو المؤشر" class="border bg-slate-50 rounded-xl px-3 py-2 text-xs">'+
 '<select id="taClass" class="border bg-slate-50 rounded-xl px-3 py-2 text-xs"><option value="all">كل الفصول</option>'+classes.map(c=>'<option value="'+esc(c)+'" '+(S.cls===String(c)?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+
 '<select id="taSubject" class="border bg-slate-50 rounded-xl px-3 py-2 text-xs"><option value="all">كل المواد</option><option value="reading" '+(S.subject==='reading'?'selected':'')+'>القراءة</option><option value="math" '+(S.subject==='math'?'selected':'')+'>الرياضيات</option><option value="science" '+(S.subject==='science'?'selected':'')+'>العلوم</option></select>'+
 '<select id="taType" class="border bg-slate-50 rounded-xl px-3 py-2 text-xs"><option value="all">كل أنواع التدريب</option><option value="remedial" '+(S.type==='remedial'?'selected':'')+'>علاجي</option><option value="reinforcement" '+(S.type==='reinforcement'?'selected':'')+'>تعزيز</option><option value="enrichment" '+(S.type==='enrichment'?'selected':'')+'>إثرائي</option><option value="starter" '+(S.type==='starter'?'selected':'')+'>تمهيدي</option><option value="mastery" '+(S.type==='mastery'?'selected':'')+'>إتقان</option></select>'+
 '<button id="taRefresh" class="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-black">تحديث</button></div></div>'+
 '<div class="mt-4 flex flex-wrap items-center gap-2"><button id="taSelectVisible" class="px-3 py-2 bg-sky-50 text-sky-700 border border-sky-100 rounded-xl text-xs font-black">تحديد الظاهر</button><button id="taClear" class="px-3 py-2 bg-slate-50 text-slate-600 border rounded-xl text-xs font-black">إلغاء التحديد</button><span class="text-xs text-slate-400">المحدد: <b id="taSelectedCount" class="text-slate-700">'+S.selected.size+'</b></span><button id="taPrintSolved" class="mr-auto px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-black">طباعة نسخ الطلاب</button><button id="taPrintBlank" class="px-4 py-2 bg-indigo-700 text-white rounded-xl text-xs font-black">طباعة نماذج فارغة</button></div>'+
 '<div class="mt-4 overflow-x-auto"><table class="w-full min-w-[1180px] text-xs"><thead><tr class="text-slate-400 border-b"><th class="p-3 text-right">اختيار</th><th class="p-3 text-right">الطالب</th><th class="p-3 text-right">الفصل</th><th class="p-3 text-right">المادة</th><th class="p-3 text-right">المؤشر</th><th class="p-3 text-right">نوع التدريب</th><th class="p-3 text-right">النتيجة</th><th class="p-3 text-right">التاريخ</th><th class="p-3 text-right">الطباعة</th></tr></thead><tbody>'+
 r.map(rowHtml).join('')+'</tbody></table>'+(r.length?'':'<div class="py-12 text-center text-slate-400">لا توجد تدريبات مطابقة.</div>')+'</div></section>'+
 '<div class="mt-3 text-[10px] text-slate-400">لا تظهر هنا بيانات تجريبية؛ الأرشيف مبني على محاولات الطلاب المسجلة فعليًا. التدريبات القديمة التي لم تكن تحفظ تفاصيل الأسئلة ستظهر بدون زر طباعة حتى توجد نسخة سؤال موثقة.</div>';
 wire();
}
function card(label,n,color){return'<div class="bg-white border rounded-2xl p-4"><div class="text-[10px] text-slate-400 font-bold">'+label+'</div><div class="text-2xl font-black text-'+color+'-700 mt-1">'+n+'</div></div>'}
function rowHtml(x){
 const key=x.source+':'+x.attempt_id,checked=S.selected.has(key)?'checked':'',can=x.has_questions;
 return'<tr class="border-b border-slate-100 hover:bg-slate-50"><td class="p-3"><input data-ta-check="'+esc(key)+'" type="checkbox" '+checked+' '+(can?'':'disabled')+'></td><td class="p-3 font-black">'+esc(x.student_name)+'</td><td class="p-3">'+esc(x.class_name||'—')+'</td><td class="p-3">'+subj(x.subject_key)+'</td><td class="p-3 max-w-[330px]"><div class="text-[10px] text-slate-400">مؤشر '+esc(x.indicator_index)+'</div><div class="font-bold leading-5">'+esc(x.indicator_text||'—')+'</div></td><td class="p-3"><div class="font-black">'+esc(typeLabel(x.training_type))+'</div><div class="text-[10px] text-slate-400">'+esc(sourceLabel(x.source))+'</div></td><td class="p-3 font-black">'+fmt(x.score)+' / '+fmt(x.total)+'<div class="text-[10px] text-emerald-700 mt-1">'+fmt(x.percent)+'%</div></td><td class="p-3 text-[11px]">'+dateTime(x.submitted_at)+'</td><td class="p-3">'+(can?'<div class="flex gap-1"><button data-ta-one="'+esc(key)+'" data-mode="solved" class="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-black">نسخة الطالب</button><button data-ta-one="'+esc(key)+'" data-mode="blank" class="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-black">فارغ</button></div>':'<span class="text-[10px] text-slate-400">لا توجد تفاصيل محفوظة</span>')+'</td></tr>';
}
function wire(){
 document.getElementById('taSearch').oninput=e=>{S.q=e.target.value;paint()};
 document.getElementById('taClass').onchange=e=>{S.cls=e.target.value;paint()};
 document.getElementById('taSubject').onchange=e=>{S.subject=e.target.value;paint()};
 document.getElementById('taType').onchange=e=>{S.type=e.target.value;paint()};
 document.getElementById('taRefresh').onclick=load;
 document.getElementById('taSelectVisible').onclick=()=>{rows().filter(x=>x.has_questions).forEach(x=>S.selected.add(x.source+':'+x.attempt_id));paint()};
 document.getElementById('taClear').onclick=()=>{S.selected.clear();paint()};
 document.querySelectorAll('[data-ta-check]').forEach(c=>c.onchange=()=>{c.checked?S.selected.add(c.dataset.taCheck):S.selected.delete(c.dataset.taCheck);document.getElementById('taSelectedCount').textContent=String(S.selected.size)});
 document.querySelectorAll('[data-ta-one]').forEach(b=>b.onclick=()=>printKeys([b.dataset.taOne],b.dataset.mode));
 document.getElementById('taPrintSolved').onclick=()=>printKeys([...S.selected],'solved');
 document.getElementById('taPrintBlank').onclick=()=>printKeys([...S.selected],'blank');
}
async function detail(key){const p=String(key).split(':');return post('teacher_training_archive_detail',{source:p[0],attempt_id:p.slice(1).join(':')})}
async function printKeys(keys,mode){
 if(S.printing)return;if(!keys.length){alert('حدد تدريبًا واحدًا على الأقل للطباعة.');return}if(keys.length>40){alert('لضمان جودة الطباعة اختر 40 تدريبًا أو أقل في الدفعة الواحدة.');return}
 S.printing=true;try{const docs=[];for(const k of keys){const d=await detail(k);if(d.questions?.length)docs.push(d)}if(!docs.length)throw new Error('لا توجد أسئلة محفوظة للنماذج المحددة.');openPrint(docs,mode)}catch(e){alert(e.message)}finally{S.printing=false}
}
function optionHtml(o,i,q,mode){
 const ar=['أ','ب','ج','د','هـ'];let cls='opt',mark='';
 if(mode==='solved'){if(Number(q.correct_index)===i){cls+=' correct';mark=' ✓ الإجابة الصحيحة'}if(Number(q.selected_index)===i){cls+=' selected';mark+=(q.correct?' • اختيار الطالب صحيح':' • اختيار الطالب')}}
 return'<div class="'+cls+'"><span class="letter">'+(ar[i]||String(i+1))+')</span> '+esc(o)+(mark?'<span class="mark">'+esc(mark)+'</span>':'')+'</div>';
}
function sheet(d,mode,idx){
 const a=d.attempt,solved=mode==='solved',questions=d.questions||[];
 return'<article class="sheet"><div class="top"><div><b>المملكة العربية السعودية</b><br>وزارة التعليم<br>ابن سينا المتوسطة</div><div class="brand">نموذج تدريب نافس</div><div class="metaTop">رقم الشاهد: '+String(idx+1)+'</div></div>'+
 '<h1>'+esc(a.title||'تدريب نافس')+'</h1><div class="indicator"><b>'+subj(a.subject_key)+' • المؤشر '+esc(a.indicator_index)+'</b><br>'+esc(a.indicator_text||'')+'</div>'+
 '<div class="info"><div><b>اسم الطالب:</b> '+(solved?esc(a.student_name):'........................................................')+'</div><div><b>الفصل:</b> '+(solved?esc(a.class_name||'—'):'........')+'</div><div><b>نوع التدريب:</b> '+esc(typeLabel(a.training_type))+'</div><div><b>التاريخ:</b> '+(solved?dateTime(a.submitted_at):'..... / ..... / ........')+'</div>'+(solved?'<div><b>الدرجة:</b> '+fmt(a.score)+' / '+fmt(a.total)+'</div><div><b>النسبة:</b> '+fmt(a.percent)+'%</div>':'')+'</div>'+
 questions.map((q,qi)=>'<section class="q"><div class="qnum">السؤال '+String(qi+1)+'</div>'+(q.context_text?'<div class="context">'+esc(q.context_text).replace(/\n/g,'<br>')+'</div>':'')+'<div class="stem">'+esc(q.question_text)+'</div><div class="opts">'+(Array.isArray(q.options)?q.options.map((o,i)=>optionHtml(o,i,q,mode)).join(''):'')+'</div>'+(solved&&q.explanation?'<div class="exp"><b>التغذية الراجعة:</b> '+esc(q.explanation)+'</div>':'')+'</section>').join('')+
 '<div class="foot"><span>المعلم: ....................................</span><span>شاهد من تدريبات منصة نافس</span></div></article>';
}
function openPrint(docs,mode){
 const w=window.open('','_blank');if(!w){alert('اسمح بالنوافذ المنبثقة للطباعة.');return}
 const css='@page{size:A4;margin:11mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#111827;font-size:12pt}.sheet{page-break-after:always;min-height:270mm}.sheet:last-child{page-break-after:auto}.top{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:start;border-bottom:2px solid #0f766e;padding-bottom:8px;font-size:9.5pt;line-height:1.6}.brand{text-align:center;font-weight:800;font-size:15pt;color:#0f766e}.metaTop{text-align:left;color:#64748b}.sheet h1{text-align:center;font-size:17pt;margin:13px 0 7px}.indicator{background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:9px 12px;line-height:1.7;font-size:10.5pt}.info{display:grid;grid-template-columns:2fr 1fr 1fr 1.4fr;gap:7px;margin:10px 0;font-size:10pt}.info>div{border:1px solid #e2e8f0;border-radius:7px;padding:7px}.q{break-inside:avoid;border:1px solid #cbd5e1;border-radius:10px;padding:11px;margin:10px 0}.qnum{font-size:9pt;color:#64748b;font-weight:bold;margin-bottom:5px}.context{background:#f8fafc;border-right:3px solid #94a3b8;padding:8px;margin-bottom:8px;line-height:1.8;font-size:10.5pt}.stem{font-weight:700;line-height:1.8;margin-bottom:7px}.opts{display:grid;grid-template-columns:1fr 1fr;gap:6px}.opt{border:1px solid #e2e8f0;border-radius:7px;padding:7px 9px;min-height:34px}.opt.correct{border:2px solid #059669;background:#ecfdf5}.opt.selected{outline:2px solid #4f46e5;outline-offset:-2px}.letter{font-weight:bold}.mark{display:block;font-size:8.5pt;color:#047857;margin-top:3px;font-weight:bold}.exp{margin-top:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:7px;font-size:9.5pt;line-height:1.6}.foot{display:flex;justify-content:space-between;margin-top:12px;padding-top:7px;border-top:1px solid #cbd5e1;font-size:9pt;color:#64748b}@media print{button{display:none}}';
 const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>نماذج تدريبات نافس</title><style>'+css+'</style></head><body>'+docs.map((d,i)=>sheet(d,mode,i)).join('')+'<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>';
 w.document.open();w.document.write(html);w.document.close();
}
function boot(){const s=ses();if(!s||s.role!=='teacher')return;S.token=s.token;ensure();new MutationObserver(ensure).observe(document.documentElement,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();