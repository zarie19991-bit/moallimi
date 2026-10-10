(()=>{'use strict';
const T=window.NafesTeacher,$=id=>document.getElementById(id),names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const labels={previous_result:'دخول أعاد نتيجة محاولة سابقة (مسجل بالخادم)',entry:'ظهرت صفحة الأسئلة',pulse:'تحديث رصد',hidden:'أصبحت الصفحة مخفية',visible:'عادت الصفحة للظهور',page_leave:'رُصدت مغادرة الصفحة (قد تكون تحديثًا أو إغلاقًا)',offline:'أبلغ المتصفح عن انقطاع الشبكة',online:'أبلغ المتصفح عن عودة الشبكة',server_error:'استجابة خطأ من الخادم',request_failed:'فشل طلب؛ السبب غير محسوم',client_error:'خطأ مسجل في المتصفح',submit_intent:'طلب الطالب التسليم',result:'ظهرت النتيجة',section:'انتقال إلى مادة أخرى'};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('ar-SA-u-ca-gregory',{timeZone:'Asia/Riyadh',hour12:false}):'غير مسجل';
const duration=ms=>ms===null?'غير مرصود':`${Math.floor(ms/60000)} د ${Math.floor(ms/1000)%60} ث`;
let attempts=[],tests=[],rows=[],busy=false,loaded=false,eventsCache=new Map(),epoch=0;
function setBusy(value){busy=value;for(const id of ['timingTest','timingClass','timingRefresh'])$(id).disabled=value;}
function summary(a,events){
 const es=[...events].sort((x,y)=>Date.parse(x.occurred_at)-Date.parse(y.occurred_at));
 const start=Date.parse(a.started_at),end=Math.min(Date.parse(a.submitted_at)||Date.now(),Date.parse(a.expires_at)||Infinity);
 const elapsed=Number.isFinite(start)&&Number.isFinite(end)?Math.max(0,end-start):null;
 const intervals=es.map(e=>{const to=Math.min(Date.parse(e.occurred_at),end);return {subject:e.subject,from:Math.max(start,Date.parse(e.occurred_at)-Number(e.visible_ms||0)),to};}).filter(x=>Number.isFinite(x.from)&&x.to>x.from);
 function union(xs){let sum=0,last=-Infinity;for(const x of [...xs].sort((a,b)=>a.from-b.from)){sum+=Math.max(0,x.to-Math.max(last,x.from));last=Math.max(last,x.to);}return sum;}
 const by={};for(const subject of [...new Set(es.filter(e=>e.event_type!=='previous_result').map(e=>e.subject))])by[subject]=union(intervals.filter(e=>e.subject===subject));
 const observed=es.some(e=>e.event_type!=='previous_result')?union(intervals):null;
 const signals=[...new Set(es.filter(e=>['hidden','page_leave','offline','server_error','request_failed','client_error','submit_intent','previous_result'].includes(e.event_type)).map(e=>labels[e.event_type]))];
 const status=a.recovery_pending?'بانتظار الاستكمال':a.submitted_at?(a.completion_reason==='time_expired'?'تسليم عند انتهاء الوقت':'مسلّم'):end<Date.now()?'انتهت المدة دون تأكيد تسليم':'جارٍ / غير مسلّم';
 return {a,events:es,elapsed,observed,by,status,first:es.find(e=>e.event_type==='entry')?.occurred_at,last:es.at(-1)?.occurred_at,signals:signals.join('؛ ')||'لا توجد أدلة كافية لتحديد سبب التوقف'};
}
window.NafesTimingSummary=summary;
async function load(force=false){
 if(busy||!T?.getKey?.())return;const generation=epoch;setBusy(true);$('timingState').textContent='جارٍ تحميل المحاولات…';
 try{if(force){T.clearReadCache?.();eventsCache.clear();}const data=await T.loadAnalysis(force);if(generation!==epoch)return;tests=data.tests||[];const all=data.attempts||[];attempts=all.filter(a=>a.is_demo!==true&&['exam','assessment'].includes(a.source)&&!a.events?.some(e=>e.type==='paper_scan'));
 const catalog=new Map(tests.filter(t=>t.kind!=='simulation').map(t=>[String(t.id),t.title]));for(const a of attempts)catalog.set(String(a.test_id),catalog.get(String(a.test_id))||a.title||'اختبار');
 const old=$('timingTest').value;$('timingTest').innerHTML='<option value="">اختر الاختبار</option>'+[...catalog].map(([id,title])=>`<option value="${esc(id)}">${esc(title)} · ${esc(id.slice(0,8))}</option>`).join('');if(catalog.has(old))$('timingTest').value=old;loaded=true;$('timingState').textContent='اختر اختبارًا لعرض كشف محاولاته.';
 }catch(e){if(generation===epoch)$('timingState').textContent=e.message;}finally{setBusy(false);}
 if($('timingTest').value)await build();
}
async function build(){
 if(busy)return;const id=$('timingTest').value;rows=[];$('timingResults').innerHTML='';if(!id)return;const generation=epoch;setBusy(true);$('timingState').textContent='جارٍ قراءة سجل الأوقات…';$('timingCsv').disabled=$('timingPrint').disabled=true;
 try{const selected=attempts.filter(a=>String(a.test_id)===id&&(!$('timingClass').value||a.class_name===$('timingClass').value));
 for(const source of ['exam','assessment']){const missing=selected.filter(a=>a.source===source&&!eventsCache.has(`${source}:${a.id}`));for(let i=0;i<missing.length;i+=5){const batch=missing.slice(i,i+5);const d=await T.api('teacher_timing',{source,attempt_ids:batch.map(a=>a.id)});if(generation!==epoch)return;for(const a of batch)eventsCache.set(`${source}:${a.id}`,(d.events||[]).filter(e=>e.attempt_id===a.id));}}
 rows=selected.map(a=>summary(a,eventsCache.get(`${a.source}:${a.id}`)||[])).sort((x,y)=>(x.a.student_name||'').localeCompare(y.a.student_name||'','ar')||Date.parse(x.a.started_at)-Date.parse(y.a.started_at));render();$('timingState').textContent=`${rows.length} محاولة — كل محاولة في صف مستقل. التوقيت بتوقيت الرياض.`;$('timingCsv').disabled=$('timingPrint').disabled=!rows.length;
 }catch(e){if(generation===epoch)$('timingState').textContent='تعذر تحميل السجل: '+e.message;}finally{setBusy(false);}
}
const headers=['الطالب','الفصل','بدء المحاولة على الخادم','أول ظهور مرصود للأسئلة','التسليم','المدة المنقضية','مدة ظهور الصفحة المرصودة','مدة كل مادة المرصودة','الحالة','دلائل التوقف / الخروج'];
function cells(r){return[r.a.student_name,r.a.class_name,date(r.a.started_at),r.first?date(r.first):'غير مرصود',r.a.submitted_at?date(r.a.submitted_at):'لم يسلّم',duration(r.elapsed),duration(r.observed),Object.entries(r.by).map(([s,ms])=>`${names[s]||s}: ${duration(ms)}`).join('؛ ')||'غير مرصود',r.status,r.signals];}
function render(){const title=$('timingTest').selectedOptions[0]?.textContent||'';$('timingResults').innerHTML=`<h2>${esc(title)}</h2><p>المدة المنقضية تشمل الغياب. مدة الظهور رصد تقريبي من المتصفح كل 30 ثانية؛ تستبعد إخفاء الصفحة والتوقف الطويل، ولا تثبت انتباه الطالب. عدم وجود سجل لا يثبت عدم حدوث عطل. أحداث المتصفح لا تحسم المسؤولية عن التوقف.</p><div style="overflow:auto"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}<th>سجل الأحداث</th></tr></thead><tbody>${rows.map(r=>`<tr>${cells(r).map(c=>`<td>${esc(c)}</td>`).join('')}<td><details><summary>عرض (${r.events.filter(e=>e.event_type!=='pulse').length})</summary><p>أوقات الرصد من المتصفح بعد مزامنة ساعة الخادم؛ وقت الاستلام مثبت بالخادم.</p>${r.events.filter(e=>e.event_type!=='pulse').map(e=>`<p>${esc(date(e.occurred_at))} — ${esc(labels[e.event_type]||e.event_type)} ${e.status_code?esc(e.status_code):''} · ${esc(names[e.subject]||e.subject)}<br><small>استلم الخادم: ${esc(date(e.received_at))}</small></p>`).join('')||'لا يتوفر سجل تفصيلي لهذه المحاولة.'}</details></td></tr>`).join('')}</tbody></table></div>`;}
$('timingTest').onchange=build;$('timingClass').onchange=build;$('timingRefresh').onclick=()=>load(true);
$('timingCsv').onclick=()=>{const quote=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const csv='\ufeff'+[headers,...rows.map(cells)].map(r=>r.map(quote).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='أوقات-الطلاب.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('timingPrint').onclick=()=>{const w=window.open('','_blank');if(!w){$('timingState').textContent='اسمح بفتح نافذة الطباعة ثم أعد المحاولة.';return;}w.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تقرير أوقات الطلاب</title><style>@page{size:A4 landscape;margin:12mm}body{font:12px Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:5px;text-align:right}thead{display:table-header-group}details{display:none}th:last-child,td:last-child{display:none}</style>'+ $('timingResults').innerHTML+'</html>');w.document.close();w.focus();setTimeout(()=>w.print(),250);};
document.querySelector('[data-view="timing"]')?.addEventListener('click',()=>{if(!loaded)load()});
addEventListener('nafes:auth-changed',()=>{epoch++;attempts=[];tests=[];rows=[];eventsCache.clear();loaded=false;$('timingResults').innerHTML='';$('timingTest').innerHTML='<option value="">اختر الاختبار</option>';$('timingCsv').disabled=$('timingPrint').disabled=true;});
})();
