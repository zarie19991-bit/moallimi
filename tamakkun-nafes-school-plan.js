(()=>{
'use strict';
const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/tamakkun-nafes-school-plan';
const SUBJECTS={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const PLAN=[
{id:'r1',s:'reading',d:'دلالات الألفاظ',base:24.6,target:35,term:1,description:'معجم صفي للمفردات الجديدة يُراجع أسبوعيًا',page:9},
{id:'r2',s:'reading',d:'دلالات الألفاظ',base:24.6,target:35,term:2,description:'تدريب على استنتاج المعنى من السياق قبل الرجوع للمعجم',page:9},
{id:'r3',s:'reading',d:'استيعاب المقروء',base:37.3,target:47,term:1,description:'قراءة يومية موجهة 15 دقيقة مع أسئلة استنتاج وتحليل لا استرجاع فقط',page:9},
{id:'r4',s:'reading',d:'استيعاب المقروء',base:37.3,target:47,term:2,description:'تطبيق استراتيجيات ما قبل القراءة وأثناءها وبعدها بشكل عملي ومتكرر',page:9},
{id:'m1',s:'math',d:'الهندسة والقياس',base:31.4,target:41,term:1,description:'استخدام أدوات القياس عمليًا داخل الصف بدل الاكتفاء بالصورة في الكتاب',page:6},
{id:'m2',s:'math',d:'الهندسة والقياس',base:31.4,target:41,term:2,description:'مسائل المحيط والمساحة والحجم من بيئة المدرسة والواقع',page:6},
{id:'m3',s:'math',d:'الأعداد والعمليات عليها',base:52.5,target:63,term:1,description:'تدريب يومي قصير (7 دقائق) على الحساب الذهني وخوارزميات العمليات الأربع',page:6},
{id:'m4',s:'math',d:'الأعداد والعمليات عليها',base:52.5,target:63,term:2,description:'تشخيص الأخطاء الشائعة في الكسور والأعداد العشرية ومعالجتها في مجموعات صغيرة',page:6},
{id:'m5',s:'math',d:'الجبر',base:52.5,target:63,term:1,description:'الانتقال من التمثيل بالنماذج المحسوسة إلى الرمز قبل التجريد',page:6},
{id:'m6',s:'math',d:'البيانات والاحتمالات',base:53.4,target:63,term:1,description:'قراءة جدول أو رسم بياني وتفسيره أسبوعيًا كنشاط افتتاحي',page:6},
{id:'s1',s:'science',d:'العلوم الفيزيائية والكيميائية',base:42.4,target:52,term:1,description:'تجارب مخبرية قصيرة مرتبطة بكل مفهوم رئيس بدل الشرح النظري',page:12},
{id:'s2',s:'science',d:'العلوم الفيزيائية والكيميائية',base:42.4,target:52,term:2,description:'رصد التصورات البديلة لدى الطلبة ومعالجتها صراحة',page:12},
{id:'s3',s:'science',d:'علم الأرض والفلك',base:44.1,target:54,term:1,description:'محاكاة رقمية للظواهر الفلكية والجيولوجية يصعب مشاهدتها مباشرة',page:12},
{id:'s4',s:'science',d:'علم الأرض والفلك',base:44.1,target:54,term:2,description:'ربط المحتوى بالبيئة المحلية (تضاريس، مناخ، موارد)',page:12},
{id:'s5',s:'science',d:'علوم الحياة',base:68.6,target:79,term:1,description:'استخدام النماذج والمجسمات والرسوم المفاهيمية للأنظمة الحيوية',page:12}
];
const STATUSES={planned:'لم يبدأ',in_progress:'قيد التنفيذ',completed:'منجز'};
const root=document.getElementById('schoolPlanRoot'),dlg=document.getElementById('schoolPlanDialog'),form=document.getElementById('schoolPlanForm');
const state={token:'',scope:'all',subject:'all',week:1,entries:[],selected:null,busy:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmt=n=>Number(n).toLocaleString('ar-SA',{maximumFractionDigits:1});
function readSession(){for(const store of [sessionStorage,localStorage]){try{const o=JSON.parse(store.getItem('lugati_exact_session_v2')||'null');if(o?.token&&o?.role)return o}catch{}}return null}
function toast(msg){const el=document.getElementById('schoolPlanToast');el.textContent=msg;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.textContent='',4500)}
async function request(action,body={}){const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.token},body:JSON.stringify({action,...body}),cache:'no-store'});let data={};try{data=await res.json()}catch{}if(!res.ok||data.error)throw Error(data.error||'تعذر الاتصال بالخادم ('+res.status+')');return data}
function key(p){return p.id+':'+state.week}
function entry(p){return state.entries.find(e=>e.action_code===p.id&&Number(e.week_no)===state.week)||null}
function getSubjectPlans(){return PLAN.filter(p=>(state.scope==='all'||p.s===state.scope)&&(state.subject==='all'||p.s===state.subject))}
function status(p){return entry(p)?.status||'planned'}
function measure(n){return n==null?'—':fmt(n)+'٪'}
function render(){
 const rows=getSubjectPlans(),done=rows.filter(p=>status(p)==='completed').length,active=rows.filter(p=>status(p)==='in_progress').length, documented=rows.filter(p=>!!entry(p)?.evidence_note||!!entry(p)?.evidence_url).length;
 root.innerHTML=`<section class="hero"><small class="eyebrow">التنفيذ والمتابعة المدرسية • ١٤٤٧هـ</small><h1>خطة تحسين أداء نافس</h1><p>خطة المدرسة الواردة في ملف «تحليل نافس ثالث متوسط 1447»؛ منفصلة عن التدريبات والخطط العلاجية الفردية.</p><div class="source">المصدر: جدول «خطة تحسين أداء نافس» في الصفحات ٦ و٩ و١٢. كل إجراء مدته ٨ أسابيع في الفصل الدراسي المحدد في الملف. تُسجَّل المتابعة الجديدة أدناه دون تغيير خط الأساس والمستهدف الأصليين.</div></section>
 <div class="kpis"><article class="kpi"><b>${fmt(rows.length)}</b><span>إجراءات الخطة</span></article><article class="kpi"><b>${fmt(done)}</b><span>منجز في الأسبوع ${fmt(state.week)}</span></article><article class="kpi"><b>${fmt(active)}</b><span>قيد التنفيذ</span></article><article class="kpi"><b>${fmt(documented)}</b><span>إجراءات لها شواهد</span></article></div>
 <div class="toolbar"><div class="filters">${(state.scope==='all'?['all','reading','math','science']:[state.scope]).map(s=>`<button type="button" class="tab ${state.subject===s?'active':''}" data-subject="${s}">${s==='all'?'جميع المواد':SUBJECTS[s]}</button>`).join('')}</div><div class="filters"><label>الأسبوع <select id="planWeek">${Array.from({length:8},(_,i)=>`<option value="${i+1}" ${i+1===state.week?'selected':''}>${fmt(i+1)}</option>`).join('')}</select></label><button type="button" class="action" id="printPlan">طباعة</button><button type="button" class="action" id="exportPlan">تصدير CSV</button></div></div>
 ${['reading','math','science'].filter(s=>rows.some(p=>p.s===s)).map(s=>`<section class="section"><div class="section-head"><h2>${SUBJECTS[s]}</h2><span>المسؤول: معلم ${SUBJECTS[s]} · الأسابيع ١–٨ لكل فصل</span></div><div class="cards">${rows.filter(p=>p.s===s).map(card).join('')}</div></section>`).join('')}
 <div class="help"><strong>قياس الأثر:</strong> أدخل نتائج القياس القبلي والبعدي المدرسي الجديد عند توفرها. يُحسب الفرق بالنقاط المئوية فقط إذا توفر القياسان، ولا يعد ذلك إثباتًا لتحقق مستهدف نافس الرسمي. لا تُرسل هذه الصفحة أي مهام للطلاب ولا تعدّل درجاتهم.</div>`;
 root.querySelectorAll('[data-subject]').forEach(b=>b.addEventListener('click',()=>{state.subject=b.dataset.subject;render()}));
 root.querySelector('#planWeek').addEventListener('change',e=>{state.week=Number(e.target.value);render()});
 root.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.edit)));
 root.querySelector('#printPlan').addEventListener('click',()=>window.print());
 root.querySelector('#exportPlan').addEventListener('click',exportCsv);
}
function card(p){
 const e=entry(p),current=e?.status||'planned',before=e?.pre_measure,after=e?.post_measure,diff=before==null||after==null?null:Number(after)-Number(before);
 const link=e?.evidence_url&&/^https:\/\//i.test(e.evidence_url)?`<a class="evidence-link" href="${esc(e.evidence_url)}" target="_blank" rel="noopener noreferrer">عرض رابط الشاهد</a>`:'';
 return `<article class="action-card"><div><div class="card-top"><span class="chip">${esc(p.d)}</span><span class="chip status ${current}">${STATUSES[current]||'لم يبدأ'}</span><span class="chip">الفصل ${p.term===1?'الأول':'الثاني'}</span></div><h3>${esc(p.description)}</h3><p>خط الأساس الرسمي: <b>${fmt(p.base)}٪</b> · المستهدف الرسمي: <b>${fmt(p.target)}٪</b> · المصدر: ص ${fmt(p.page)}</p><div class="metrics"><span>قياس قبلي جديد: <b>${measure(before)}</b></span><span>قياس بعدي جديد: <b>${measure(after)}</b></span><span>التحسن: <b>${diff==null?'—':(diff>0?'+':'')+fmt(diff)+' نقطة مئوية'}</b></span></div>${e?.evidence_note?`<p class="evidence">${esc(e.evidence_note)}</p>`:''}${link}${e?.updated_at?`<p class="measure-note">آخر تحديث: ${esc(new Date(e.updated_at).toLocaleDateString('ar-SA'))}</p>`:''}</div><button type="button" class="edit" data-edit="${p.id}">توثيق الأسبوع ${fmt(state.week)}</button></article>`;
}
function openEdit(id){
 const p=PLAN.find(p=>p.id===id);if(!p)return;
 const e=entry(p);state.selected=p;form.reset();
 document.getElementById('dialogAction').textContent=SUBJECTS[p.s]+' · '+p.d+' · '+p.description+' · الأسبوع '+fmt(state.week);
 form.elements.status.value=e?.status||'planned';
 form.elements.pre_measure.value=e?.pre_measure??'';
 form.elements.post_measure.value=e?.post_measure??'';
 form.elements.evidence_note.value=e?.evidence_note||'';
 form.elements.evidence_url.value=e?.evidence_url||'';
 dlg.showModal();
}
function numberOrNull(value){if(value==='')return null;const x=Number(value);if(!Number.isFinite(x)||x<0||x>100)throw Error('النسبة يجب أن تكون بين 0 و100');return x}
form.addEventListener('submit',async ev=>{
 ev.preventDefault();if(state.busy||!state.selected)return;
 const e=form.elements,link=String(e.evidence_url.value||'').trim();
 if(link&&!/^https:\/\/[a-z0-9]/i.test(link)){toast('رابط الشاهد يجب أن يبدأ بـ https://');return}
 try{
  const item={action_code:state.selected.id,week_no:state.week,status:e.status.value,pre_measure:numberOrNull(e.pre_measure.value),post_measure:numberOrNull(e.post_measure.value),evidence_note:e.evidence_note.value.trim(),evidence_url:link};
  state.busy=true;document.getElementById('saveSchoolPlan').disabled=true;
  const d=await request('save',item);
  const i=state.entries.findIndex(x=>x.action_code===d.entry.action_code&&Number(x.week_no)===Number(d.entry.week_no));
  if(i>=0)state.entries[i]=d.entry;else state.entries.push(d.entry);
  dlg.close();render();toast('تم حفظ متابعة الأسبوع في قاعدة بيانات المنصة.');
 }catch(err){toast(err.message||'تعذر الحفظ')}finally{state.busy=false;document.getElementById('saveSchoolPlan').disabled=false}
});
document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>dlg.close()));
function csvSafe(x){let v=String(x??'');if(/^[\s]*[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'}
function exportCsv(){
 const hdr=['المادة','المجال','الإجراء','الفصل','الأسبوع','خط الأساس الرسمي','المستهدف الرسمي','حالة التنفيذ','القياس القبلي الجديد','القياس البعدي الجديد','الشاهد','رابط الشاهد','آخر تحديث'];
 const records=getSubjectPlans().map(p=>{const e=entry(p);return[SUBJECTS[p.s],p.d,p.description,p.term,state.week,p.base,p.target,STATUSES[e?.status||'planned'],e?.pre_measure??'',e?.post_measure??'',e?.evidence_note||'',e?.evidence_url||'',e?.updated_at||'']});
 const csv='\uFEFF'+[hdr,...records].map(row=>row.map(csvSafe).join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tamakkun-nafes-1447-week-'+state.week+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function init(){
 const session=readSession();
 if(!session?.token||session.role!=='teacher'){root.innerHTML='<section class="empty danger">هذه الخطة مخصصة لمعلمي تمكّن. <a href="./lugati-complete.html">افتح المنصة وسجّل الدخول بحساب معلم.</a></section>';return}
 state.token=session.token;
 try{const data=await request('list');state.scope=data.scope||'all';state.subject=state.scope==='all'?'all':state.scope;state.entries=Array.isArray(data.entries)?data.entries:[];render()}
 catch(error){root.innerHTML='<section class="empty danger"><h2>تعذر تحميل متابعة الخطة</h2><p>'+esc(error.message||'حدث خطأ غير معروف')+'</p><button class="link-button" id="tryAgain">إعادة المحاولة</button></section>';document.getElementById('tryAgain').onclick=init}
}
init();
})();