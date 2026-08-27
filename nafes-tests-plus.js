(()=>{
const SUBJECT_META={
 arabic:{label:'القراءة',poolTitle:'نافس القراءة — نموذج متغير'},
 math:{label:'الرياضيات',poolTitle:'بنك أسئلة الرياضيات الوطني'},
 science:{label:'العلوم',poolTitle:'بنك أسئلة العلوم الوطني'}
};
const KEYS=['arabic','math','science'];

function activeKey(){
 const buttons=[...document.querySelectorAll('#nafesArea .nafes-subject')];
 const i=buttons.findIndex(b=>b.classList.contains('active'));
 return KEYS[Math.max(0,i)]||'arabic';
}
function profileForNafes(key){return state.profiles.find(p=>p.subject_key===key&&p.grade_level==='الثالث المتوسط')||null}
function sourceAssessment(key){
 const p=profileForNafes(key); if(!p)return null;
 const wanted=SUBJECT_META[key].poolTitle;
 return state.assessments.find(a=>a.subject_profile_id===p.id&&a.title===wanted)||null;
}
function visibleNafesTests(key){
 const p=profileForNafes(key);if(!p)return[];
 return state.assessments.filter(a=>a.subject_profile_id===p.id&&String(a.title||'').includes('نافس')&&!String(a.title||'').startsWith('بنك '));
}
function nextTitle(key,type){
 const label=SUBJECT_META[key].label;
 const n=visibleNafesTests(key).length+1;
 const prefix=type==='training'?'تدريب نافس':type==='mastery'?'اختبار إتقان نافس':'اختبار نافس';
 return `${prefix} ${label} — النموذج ${n}`;
}

async function createFromPool(key,form){
 const p=profileForNafes(key),src=sourceAssessment(key);
 if(!p||!src||!state.books[0])return toast('تعذر الوصول إلى بنك أسئلة هذه المادة.',true);
 const items=await req(`/rest/v1/achievement_assessment_items?select=objective_id,question_bank_id,prompt,options,correct_answer,explanation,difficulty,points,sort_order&assessment_id=eq.${src.id}&order=sort_order.asc`);
 if(!items.ok||!items.data||items.data.length<9)return toast('بنك الأسئلة لهذه المادة غير مكتمل.',true);
 const title=(form.title||nextTitle(key,form.assessment_type)).trim();
 const created=await req('/rest/v1/achievement_assessments','POST',{
  book_id:state.books[0].id,subject_profile_id:p.id,title,
  assessment_type:form.assessment_type,level_target:form.level_target,
  source_year:'current',status:'draft',access_code:form.access_code.toUpperCase(),
  duration_min:+form.duration_min,attempts_allowed:+form.attempts_allowed
 },true);
 if(!created.ok)return toast(created.msg,true);
 const aid=created.data?.[0]?.id;if(!aid)return toast('تعذر إنشاء الاختبار.',true);
 const rows=items.data.map((x,i)=>({
  assessment_id:aid,objective_id:x.objective_id||null,question_bank_id:x.question_bank_id||null,
  prompt:x.prompt,options:x.options,correct_answer:x.correct_answer,
  explanation:x.explanation,difficulty:x.difficulty,points:x.points||1,sort_order:i+1
 }));
 const inserted=await req('/rest/v1/achievement_assessment_items','POST',rows,true);
 if(!inserted.ok)return toast('تم إنشاء الاختبار لكن تعذر نسخ أسئلته.',true);
 closeModal();await loadData();switchSection('nafes');
 if(typeof window.setNafesSubject==='function')window.setNafesSubject(key);
 toast(`تم إنشاء ${title}. يمكنك إنشاء أي عدد من الاختبارات بالطريقة نفسها.`);
}

window.openNafesTestCreator=function(key=activeKey()){
 const meta=SUBJECT_META[key]||SUBJECT_META.arabic;
 const defaultTitle=nextTitle(key,'formative');
 modal(`اختبار نافس جديد — ${meta.label}`,`<form id="nafesNewTestForm" class="formgrid">
  <div class="field full"><label>اسم الاختبار</label><input name="title" value="${esc(defaultTitle)}" required></div>
  <div class="field"><label>نوعه</label><select name="assessment_type"><option value="formative">اختبار قياس</option><option value="training">تدريب</option><option value="mastery">اختبار إتقان</option></select></div>
  <div class="field"><label>المستوى</label><select name="level_target"><option value="adaptive">حسب مستوى الطالب</option><option value="all">للجميع</option><option value="low">تأسيسي</option><option value="medium">متوسط</option><option value="high">متقدم</option></select></div>
  <div class="field"><label>المدة بالدقائق</label><input name="duration_min" type="number" value="25" min="5" max="120"></div>
  <div class="field"><label>عدد المحاولات</label><input name="attempts_allowed" type="number" value="1" min="1" max="10"></div>
  <div class="field full"><label>الكود</label><input name="access_code" value="${rand(7)}" required></div>
  <button class="btn primary full">إنشاء الاختبار وإضافة الأسئلة تلقائيًا</button>
 </form><div class="soft-card" style="margin-top:12px;font-size:11px"><b>لا يوجد حد لعدد الاختبارات.</b> كل اختبار جديد ينسخ بنك أسئلة المادة، وعند دخول الطلاب يختار النظام 9 أسئلة بصورة مختلفة لكل طالب.</div>`,()=>{
  const f=$('nafesNewTestForm');if(!f)return;
  const type=f.elements.assessment_type,title=f.elements.title;
  type.onchange=()=>{title.value=nextTitle(key,type.value)};
  f.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(f));const btn=f.querySelector('button');btn.disabled=true;btn.textContent='جارٍ تجهيز الاختبار...';await createFromPool(key,data);if(document.body.contains(btn)){btn.disabled=false;btn.textContent='إنشاء الاختبار وإضافة الأسئلة تلقائيًا'}};
 });
};

function enhance(){
 const area=document.getElementById('nafesArea');if(!area||!area.children.length)return;
 const key=activeKey();
 const actionBox=area.querySelector('.nafes-headline .actions');
 if(actionBox&&!actionBox.querySelector('.nafes-unlimited-btn')){
  const b=document.createElement('button');b.className='btn primary nafes-unlimited-btn';b.textContent=' + اختبار نافس جديد';b.onclick=()=>window.openNafesTestCreator(key);actionBox.appendChild(b);
  const hint=document.createElement('span');hint.className='nafes-unlimited-hint';hint.textContent='يمكنك إنشاء عدد غير محدود';actionBox.appendChild(hint);
 }
 const empty=area.querySelector('.nafes-tests .empty');
 if(empty&&['math','science'].includes(key))empty.innerHTML='<b>بنك الأسئلة جاهز.</b>اضغط «اختبار نافس جديد» لإنشاء اختبار جديد وإرساله للطلاب.';
}
const target=document.getElementById('nafesArea');
if(target)new MutationObserver(()=>queueMicrotask(enhance)).observe(target,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('[data-section="nafes"],.nafes-subject'))setTimeout(enhance,20)});
setTimeout(enhance,300);
})();