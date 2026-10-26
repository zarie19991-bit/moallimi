(()=>{
'use strict';
/* Teacher-only, read-only: per-student missing-login days and dates from existing authorized snapshot.
   No claim that missing historical session = verified absence; roster is current active roster. */
const ST={host:null,data:null,from:'',to:'',klass:'all',dayMode:'school',minDays:1,minStreak:0,trackingStart:'',excluded:'',name:'',error:'',limit:366,token:null,history:null,historyKey:'',historyStatus:'idle',historyError:'',historyVersion:0};
const ESC=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const txt=s=>String(s??'').trim();
const pad=n=>String(n).padStart(2,'0');
const ymdUTC=d=>d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
const daySaudi=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):''};
const today=()=>daySaudi(new Date().toISOString());
const isoDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(txt(d))?txt(d):'';
const parse=d=>new Date(d+'T12:00:00Z');
const addDays=(d,n)=>ymdUTC(new Date(parse(d).getTime()+n*86400000));
const dateLong=d=>new Date(d+'T12:00:00Z').toLocaleDateString('ar-SA-u-ca-gregory',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'});
const daysOfWeek=d=>parse(d).getUTCDay();
const school=d=>daysOfWeek(d)!==5&&daysOfWeek(d)!==6;
const num=n=>Number(n).toLocaleString('ar-SA');
function style(){
 if(document.getElementById('tamakkun-missing-login-css'))return;
 const css=document.createElement('style');css.id='tamakkun-missing-login-css';
 css.textContent='.tml{direction:rtl;background:#fff;border:1px solid #d6e4dc;border-radius:17px;padding:19px;margin-top:15px;color:#173d2f;font:13px Tahoma,Arial,sans-serif}.tml *{box-sizing:border-box}.tml h2{font-size:20px;font-weight:900;margin:5px 0 9px}.tml p{line-height:1.9}.tml-sub{font-size:11px;color:#6d8073}.tml-guide{background:#edf6f1;color:#335d4b;padding:11px 13px;border:1px solid #d7eade;border-radius:10px;line-height:1.9;margin:12px 0}.tml-warn{background:#fff3dc;color:#80520f;border-color:#efd8a5}.tml-row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.tml-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:13px 0}.tml label{font-size:11px;color:#4b6558;font-weight:800}.tml input,.tml select{margin-top:6px;background:white;min-height:42px;border:1px solid #c6dbcc;padding:10px;width:100%;border-radius:10px;font:inherit}.tml-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:13px 0}.tml-card{background:#f5faf6;border:1px solid #d7e8db;padding:11px;border-radius:12px}.tml-card small{display:block;color:#647a6d;font-size:10px}.tml-card b{display:block;font-size:20px;color:#096548;margin-top:6px}.tml table{border-collapse:collapse;width:100%;min-width:710px}.tml th{text-align:right;background:#ecf5ee;position:sticky;top:0;padding:11px;border-bottom:1px solid #cbded0}.tml td{text-align:right;vertical-align:top;padding:11px;border-bottom:1px solid #e5ece6}.tml tbody tr:nth-child(even){background:#fafdfe}.tml-wrap{overflow:auto;border:1px solid #dfe9e2;border-radius:11px;max-height:58vh}.tml-date-list{white-space:normal;word-spacing:2px;line-height:2;max-width:380px;color:#4f6557}.tml-count{font-weight:900;color:#a12f39;background:#ffebeb;padding:3px 9px;border-radius:99px}.tml-btn{border:none;border-radius:10px;background:#08684c;color:#fff;cursor:pointer;padding:10px 14px;font:inherit;font-weight:800}.tml-btn.light{background:#e7f2eb;color:#075941}.tml-btn:disabled{cursor:not-allowed;opacity:.5}.tml-actions{display:flex;gap:8px;flex-wrap:wrap}.tml-empty{text-align:center;color:#6c8170;padding:25px}.tml-error{color:#a92d39;background:#fff0f0;border-radius:10px;padding:12px}@media(max-width:700px){.tml-cards{grid-template-columns:1fr 1fr}.tml{padding:12px}}@media print{.tml-controls,.tml-actions{display:none!important}}';document.head.appendChild(css);
}
function initialDates(){
 const d=today();return{to:addDays(d,-1),from:addDays(d,-14)};
}

const HISTORY_API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/tamakkun-student-monitor';
function resetHistory(){
 ST.historyVersion++;ST.history=null;ST.historyStatus='idle';ST.historyError='';ST.historyKey='';
}
async function fetchHistory(){
 if(!ST.host||!ST.token)return;
 const from=isoDate(ST.from),to=isoDate(ST.to);
 if(!from||!to||from>to||to>today()||parse(to)-parse(from)>365*86400000)return;
 const key=from+'|'+to+'|'+ST.token;
 if(ST.historyKey===key&&ST.historyStatus!=='idle')return;
 ST.historyKey=key;ST.history=null;ST.historyStatus='loading';ST.historyError='';
 const version=++ST.historyVersion,token=ST.token;
 render();
 try{
  const res=await fetch(HISTORY_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
   body:JSON.stringify({action:'attendance_history',from,to}),cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.ok!==true||data.mode!=='durable'||!Array.isArray(data.activity_days)||!isoDate(data.complete_from_day))
   throw Error(data.error||'السجل اليومي الدائم غير متاح حاليًا.');
  if(version!==ST.historyVersion||token!==ST.token||!ST.host)return;
  ST.history={complete_from_day:data.complete_from_day,activity_days:data.activity_days};
  ST.historyStatus='ready';
 }catch(e){
  if(version!==ST.historyVersion||token!==ST.token||!ST.host)return;
  ST.history=null;ST.historyStatus='legacy';
  ST.historyError='السجل اليومي الدائم لم يُفعّل أو لم يتوفر؛ يعتمد هذا الكشف مؤقتًا على جلسات الدخول المحفوظة وقد تنقصه الأيام القديمة.';
 }finally{if(version===ST.historyVersion&&ST.host)render()}
}

function attendance(data){
 const allSessions=Array.isArray(data?.sessions)?data.sessions:[];
 const dates=[...allSessions.flatMap(s=>[daySaudi(s.created_at),daySaudi(s.last_seen_at)]),ST.history?.complete_from_day].filter(Boolean).sort();
 const oldest=dates[0]||'',newest=dates[dates.length-1]||'';
 const from=isoDate(ST.from),to=isoDate(ST.to),errors=[];
 const excludedTokens=txt(ST.excluded).split(/[\s,،؛;]+/).filter(Boolean);
 const invalid=excludedTokens.filter(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)||ymdUTC(parse(d))!==d);
 if(invalid.length)errors.push('تواريخ الاستبعاد غير صحيحة؛ اكتب تواريخ ميلادية YYYY-MM-DD مفصولة بفواصل.');
 const excluded=new Set(excludedTokens.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)));
 const trackFrom=isoDate(ST.trackingStart);
 if(ST.trackingStart&&(!trackFrom||ymdUTC(parse(trackFrom))!==trackFrom))errors.push('تاريخ بداية الاستهداف غير صحيح.');
 if(!from||!to||from>to)errors.push('اختر تاريخ بداية ونهاية صحيحين.');
 if(to>today())errors.push('لا يمكن احتساب أيام مستقبلية.');
 if(from&&to&&parse(to)-parse(from)>((ST.limit-1)*86400000))errors.push('الحد الأقصى للفترة '+ST.limit+' يومًا؛ اختر فترة أقصر.');
 const eligible=[];
 if(!errors.length&&oldest){
  const begin=[from,oldest,trackFrom].filter(Boolean).sort().at(-1);
  for(let day=begin;day<=to;day=addDays(day,1)){
   if((ST.dayMode==='all'||school(day))&&!excluded.has(day))eligible.push(day);
   if(eligible.length>ST.limit)break;
  }
 }
 const warnings=[];
 if(ST.historyStatus==='loading')warnings.push('جارٍ تحميل سجل الدخول اليومي من الخادم؛ الأعداد مؤقتة حتى اكتمال القراءة.');
 if(ST.historyStatus==='legacy')warnings.push(ST.historyError);
 if(ST.historyStatus==='ready')warnings.push('السجل اليومي الدائم مفعل ابتداءً من '+dateLong(ST.history.complete_from_day)+'؛ أما الأيام الأقدم فتعتمد على الجلسات التاريخية المتاحة وقد تكون غير مكتملة.');
 if(!oldest)warnings.push('لا توجد جلسات طلاب محفوظة في المصدر؛ لا يمكن استخراج كشف تاريخي موثوق.');
 if(oldest&&from<oldest)warnings.push('المدة المطلوبة تبدأ قبل أقدم سجل متاح ('+dateLong(oldest)+')؛ استُبعدت الأيام الأقدم بدل احتسابها غيابًا.');
 if(trackFrom&&from<trackFrom)warnings.push('استُبعد ما قبل تاريخ بداية الاستهداف ('+dateLong(trackFrom)+').');
 if(!trackFrom)warnings.push('بداية استهداف كل طالب غير متاحة حاليًا؛ يُرجى مراجعة تاريخ انضمامه قبل اعتماد الحصر.');
 if(excluded.size)warnings.push('استُبعدت '+num(excluded.size)+' تواريخ إجازة أو توقف حددها المعلم.');
 if(to===today())warnings.push('اليوم الحالي لم ينتهِ؛ نتيجته مؤقتة حتى نهاية اليوم.');
 warnings.push('الحصر يعني عدم وجود دخول أو نشاط مسجل في الأيام المعروضة، وليس إثباتًا قاطعًا لعدم الدخول أو غياب الطالب عن المدرسة.');
 warnings.push('قائمة الطلاب تمثل الطلاب النشطين حاليًا؛ قد لا يكون الطالب مسجلًا في المنصة طوال المدة التاريخية.');
 // An event is evidenced on the created date or on the latest seen date, but
 // last_seen_at doesn't prove every intermediate day of a long-lived session.
 const access=new Map();
 for(const s of allSessions){
  const id=txt(s.student_id);
  if(!id)continue;
  let set=access.get(id);if(!set){set=new Set();access.set(id,set)}
  const a=daySaudi(s.created_at),b=daySaudi(s.last_seen_at);
  if(a)set.add(a);if(b)set.add(b);
 }
 if(ST.historyStatus==='ready')for(const row of ST.history.activity_days){
  const id=txt(row.student_id),day=isoDate(row.activity_day);
  if(!id||!day||!Number.isFinite(Number(row.login_events)+Number(row.heartbeat_events)))continue;
  let set=access.get(id);if(!set){set=new Set();access.set(id,set)}
  if(Number(row.login_events)+Number(row.heartbeat_events)>0)set.add(day);
 }
 const roster=(Array.isArray(data?.students)?data.students:[]).filter(s=>ST.klass==='all'||txt(s.class_name)===ST.klass)
 .filter(s=>!ST.name||txt(s.full_name).toLocaleLowerCase('ar').includes(ST.name.toLocaleLowerCase('ar')));
 const rows=!errors.length&&oldest?roster.map(s=>{
  const seen=access.get(txt(s.id))||new Set();
  const studentStart=daySaudi(s.created_at||s.targeted_at||'');
  const eligibleForStudent=studentStart?eligible.filter(day=>day>=studentStart):eligible;
  const missing=eligibleForStudent.filter(day=>!seen.has(day));
  const visits=eligibleForStudent.filter(day=>seen.has(day));
  let longest=0,current=0;for(const day of eligibleForStudent){current=seen.has(day)?0:current+1;if(current>longest)longest=current}
  const last=[...seen].sort().at(-1)||'';
  return{student:s,missing,visits,last,total:missing.length,allDays:eligibleForStudent.length,longest,endingStreak:current};
 }):[];
 return{rows:rows.filter(x=>x.total>=ST.minDays&&x.longest>=ST.minStreak).sort((a,b)=>b.total-a.total||txt(a.student.class_name).localeCompare(txt(b.student.class_name),'ar')||txt(a.student.full_name).localeCompare(txt(b.student.full_name),'ar')),eligible,oldest,newest,errors,warnings,excluded:[...excluded].sort(),rosterTotal:roster.length,allRows:rows};
}
function options(rows,current){return rows.map(([v,l])=>'<option value="'+ESC(v)+'"'+(String(v)===String(current)?' selected':'')+'>'+ESC(l)+'</option>').join('')}
function render(){
 if(!ST.host||!ST.data)return;style();const r=getRows(),classNames=[...new Set(ST.data.students.map(x=>txt(x.class_name)).filter(Boolean))].sort();
 const never=r.allRows.filter(x=>x.allDays>0&&x.total===x.allDays).length,missingCount=r.allRows.filter(x=>x.total>0).length;
 let h='<section class="tml" id="tml-register"><div class="tml-row"><div><small class="tml-sub">منصة تمكّن • كشف مستقل للطباعة والمتابعة</small><h2>حصر الطلاب الذين لم يدخلوا خلال فترة</h2><p>اختر الفترة والفصل، ثم راجع عدد الأيام دون دخول مسجل وتواريخها لكل طالب.</p></div><div class="tml-actions"><button class="tml-btn light" id="tml-csv"'+(ST.historyStatus==='loading'?' disabled':'')+'>تصدير كشف CSV</button><button class="tml-btn" id="tml-print"'+(ST.historyStatus==='loading'?' disabled':'')+'>طباعة الكشف A4</button></div></div>'+
 '<div class="tml-controls">'+
 '<label>من تاريخ<input type="date" id="tml-from" value="'+ESC(ST.from)+'"></label>'+
 '<label>إلى تاريخ<input type="date" id="tml-to" value="'+ESC(ST.to)+'"></label>'+
 '<label>نوع الأيام<select id="tml-daymode">'+options([['school','أيام الدراسة (الأحد–الخميس)'],['all','جميع الأيام']],ST.dayMode)+'</select></label>'+
 '<label>بداية استهداف الطلاب (اختياري)<input type="date" id="tml-start" value="'+ESC(ST.trackingStart)+'"></label>'+ 
 '<label>تواريخ الإجازات المستبعدة<input type="text" id="tml-excluded" placeholder="2026-10-21، 2026-10-22" value="'+ESC(ST.excluded)+'"></label>'+ 
 '<label>الفصل<select id="tml-class">'+options([['all','جميع الفصول'],...classNames.map(x=>[x,x])],ST.klass)+'</select></label>'+
 '<label>أقل عدد أيام دون دخول<select id="tml-min">'+options([[1,'يوم فأكثر'],[2,'يومان فأكثر'],[3,'3 أيام فأكثر'],[5,'5 أيام فأكثر'],[10,'10 أيام فأكثر'],[10000,'لم يسجل دخول طوال الفترة']],ST.minDays)+'</select></label>'+
 '<label>أطول انقطاع متتالٍ<select id="tml-streak">'+options([[0,'أي عدد'],[2,'يومان دراسيان متتاليان فأكثر'],[3,'ثلاثة أيام متتالية فأكثر'],[5,'خمسة أيام متتالية فأكثر']],ST.minStreak)+'</select></label>'+ 
 '<label>اسم الطالب<input type="search" id="tml-search" placeholder="البحث في كشف الحصر" value="'+ESC(ST.name)+'"></label></div>';
 h+='<div class="tml-guide"><b>مصدر البيانات:</b> '+(ST.historyStatus==='ready'?'سجل الدخول اليومي الدائم والجلسات التاريخية':'الجلسات التاريخية المحفوظة فقط')+'</div>';
 if(r.errors.length)h+='<div class="tml-error">'+r.errors.map(ESC).join(' • ')+'</div>';
 h+='<div class="tml-guide">'+r.warnings.map(ESC).join('<div style="margin-top:4px">')+'</div></div>';
 h+='<div class="tml-cards">'+
 [['أيام الفترة المحتسبة',r.eligible.length],['طلاب بلا دخول مسجل ليوم فأكثر',missingCount],['لم يسجل لهم نشاط طوال الفترة',never],['الطلاب في الكشف',r.rows.length]].map(x=>'<div class="tml-card"><small>'+ESC(x[0])+'</small><b>'+num(x[1])+'</b></div>').join('')+'</div>';
 if(ST.minDays===10000)h+='<div class="tml-guide">لإظهار من لم يدخل طوال المدة، أُدرج الطلاب الذين يساوي عدد أيامهم دون دخول عدد أيام الفترة المحتسبة فقط.</div>';
 h+='<div class="tml-row" style="padding:6px 0 13px"><b>كشف عدم الدخول خلال المدة</b><small class="tml-sub">'+ESC(dateLong(ST.from))+' – '+ESC(dateLong(ST.to))+' • '+(ST.dayMode==='school'?'أيام الدراسة':'جميع الأيام')+' • '+num(r.rows.length)+' طالب</small></div>'+
 '<div class="tml-wrap"><table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>عدد الأيام دون دخول مسجل</th><th>أطول انقطاع متتالٍ</th><th>التواريخ بالتفصيل</th><th>أيام النشاط المسجلة</th><th>آخر نشاط متاح</th></tr></thead><tbody>'+
 (r.rows.length?r.rows.map((x,i)=>'<tr><td>'+num(i+1)+'</td><td><b>'+ESC(x.student.full_name)+'</b></td><td>'+ESC(x.student.class_name||'—')+'</td><td><span class="tml-count">'+num(x.total)+'</span></td><td>'+num(x.longest)+'</td><td class="tml-date-list">'+x.missing.map(d=>'<span style="white-space:nowrap">'+ESC(dateLong(d))+'</span>').join('، ')+'</td><td>'+num(x.visits.length)+'</td><td>'+ESC(x.last?dateLong(x.last):'لا يوجد نشاط مسجل')+'</td></tr>').join(''):'<tr><td colspan="8" class="tml-empty">'+(r.eligible.length?'لا يوجد طلاب مطابقون لشرط الحصر.':'لا توجد أيام قابلة للحصر من السجلات المتاحة.')+'</td></tr>')+'</tbody></table></div>'+
 '<p class="tml-sub">هذا كشف رصد دخول إلكتروني؛ لا يُستخدم وحده لإثبات الغياب أو التقصير. لا تُحسب الجمعة والسبت عند اختيار أيام الدراسة، ولا تُحتسب الأيام الأقدم من السجلات المتاحة.</p></section>';
 ST.host.innerHTML=h;
 const setup=(id,prop,format)=>{const el=ST.host.querySelector('#'+id);if(el)el.onchange=e=>{const prior=ST[prop];ST[prop]=format?format(e.target.value):e.target.value;if(prior!==ST[prop]&&(prop==='from'||prop==='to'))resetHistory();render();if(prop==='from'||prop==='to')fetchHistory()}};
 setup('tml-from','from',v=>isoDate(v));setup('tml-to','to',v=>isoDate(v));setup('tml-start','trackingStart',v=>isoDate(v));setup('tml-excluded','excluded');setup('tml-class','klass');
 setup('tml-daymode','dayMode');setup('tml-min','minDays',Number);setup('tml-streak','minStreak',Number);setup('tml-search','name');
 ST.host.querySelector('#tml-csv').onclick=exportCSV;
 ST.host.querySelector('#tml-print').onclick=printReport;
}
function getRows(){const calc=attendance(ST.data);if(ST.minDays===10000)return{...calc,rows:calc.allRows.filter(x=>x.allDays>0&&x.total===x.allDays&&x.longest>=ST.minStreak)};return calc}
function csvCell(v){let s=txt(v);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function exportCSV(){
 const a=getRows();if(ST.historyStatus==='loading'||a.errors.length||!a.eligible.length){alert('اختر فترة صالحة وانتظر اكتمال قراءة سجلات الدخول.');return}
 const headers=['م','الطالب','الفصل','عدد الأيام دون دخول مسجل','أطول انقطاع متتالٍ','تواريخ الأيام دون دخول','عدد أيام النشاط المسجل','آخر نشاط','بداية الفترة','نهاية الفترة','نوع الأيام','بداية الاستهداف','تواريخ الإجازات المستبعدة','فلتر أطول انقطاع'];
 const values=[headers,...a.rows.map((x,i)=>[i+1,x.student.full_name,x.student.class_name||'',x.total,x.longest,x.missing.join('، '),x.visits.length,x.last||'',ST.from,ST.to,ST.dayMode==='school'?'الأحد–الخميس':'جميع الأيام',ST.trackingStart,a.excluded.join('، '),ST.minStreak])];
 const csv='\ufeff'+values.map(row=>row.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),el=document.createElement('a');
 el.href=url;el.download='tamakkun-missing-logins-'+ST.from+'-'+ST.to+'.csv';el.click();
 setTimeout(()=>URL.revokeObjectURL(url),2500);
}
function printReport(){
 const a=getRows();if(ST.historyStatus==='loading'||a.errors.length||!a.eligible.length){alert('اختر فترة صالحة وانتظر اكتمال قراءة سجلات الدخول.');return}
 const w=window.open('','_blank','width=950,height=840');if(!w){alert('اسمح بفتح نافذة طباعة الكشف.');return}
 try{w.opener=null}catch(_){}
 const out=a.rows.map((x,i)=>'<tr><td>'+num(i+1)+'</td><td>'+ESC(x.student.full_name)+'</td><td>'+ESC(x.student.class_name||'—')+'</td><td>'+num(x.total)+'</td><td>'+num(x.longest)+'</td><td style="line-height:1.8">'+x.missing.map(date=>ESC(dateLong(date))).join('، ')+'</td><td>'+num(x.visits.length)+'</td></tr>').join('');
 const body='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حصر عدم الدخول</title><style>@page{size:A4 landscape;margin:11mm}body{font:10.5pt Tahoma,Arial;color:#163b2d;line-height:1.7}h1{text-align:center;font-size:17pt}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #9cae9f;padding:7px;text-align:right;vertical-align:top;overflow-wrap:anywhere}th{background:#e8f2e9}th:nth-child(6){width:31%}.disclaimer{font-size:8.5pt;color:#46594e;border:1px solid #c8d6cc;padding:9px;margin:12px 0}.meta{display:flex;justify-content:space-between}.actions{padding:9px}@media print{.actions{display:none}}tr{break-inside:avoid}</style></head><body><b>المملكة العربية السعودية – وزارة التعليم – إدارة التعليم بنجران – مدرسة ابن سينا المتوسطة</b><h1>كشف حصر الطلاب الذين لم يدخلوا منصة تمكّن</h1><div class="meta"><b>من: '+ESC(dateLong(ST.from))+'　 إلى: '+ESC(dateLong(ST.to))+'</b><b>الفصل: '+ESC(ST.klass==='all'?'كل الفصول':ST.klass)+'</b><b>نوع الأيام: '+(ST.dayMode==='school'?'أيام الدراسة':'جميع الأيام')+'</b></div><p>عدد الطلاب في الكشف: '+num(a.rows.length)+' | عدد الأيام المشمولة بالحساب: '+num(a.eligible.length)+' | بداية الاستهداف: '+ESC(ST.trackingStart||'لم تحدد')+' | أقل انقطاع متتالٍ: '+num(ST.minStreak)+' | التواريخ المستبعدة: '+a.excluded.map(ESC).join('، ')+'</p><table><thead><tr><th style="width:5%">م</th><th style="width:21%">الطالب</th><th style="width:10%">الفصل</th><th style="width:10%">عدد الأيام</th><th style="width:12%">أطول انقطاع</th><th>التواريخ التي لم يُسجَّل فيها دخول</th><th style="width:11%">أيام النشاط</th></tr></thead><tbody>'+out+'</tbody></table><div class="disclaimer">'+a.warnings.map(ESC).join(' • ')+' لا يُثبت هذا الكشف الغياب المدرسي.</div><button class="actions" onclick="print()">طباعة / حفظ PDF</button></body></html>';
 w.document.write(body);w.document.close();w.focus();
}
window.TamakkunMissingLoginReport={
 mount({role,data,token}={}){
  if(role!=='teacher'||!data||!Array.isArray(data.students)||!Array.isArray(data.sessions))return;
  const host=document.getElementById('tamakkunMissingLoginMount');if(!host)return;
  if(ST.token!==token){resetHistory();ST.token=token||null}
  if(ST.data!==data){ST.data=data;resetHistory();const d=initialDates();if(!ST.from)ST.from=d.from;if(!ST.to)ST.to=d.to}
  ST.host=host;render();fetchHistory();
 },
 unmount(){resetHistory();ST.host=null;ST.token=null;ST.data=null;ST.from='';ST.to='';ST.klass='all';ST.dayMode='school';ST.minDays=1;ST.minStreak=0;ST.trackingStart='';ST.excluded='';ST.name=''}
};
})();