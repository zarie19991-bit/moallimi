(()=>{
const KEYS=['arabic','math','science'];
const CRITERIA={
 arabic:[
  {code:'A1',name:'اكتساب المفردات وتوظيف الدلالات اللفظية'},
  {code:'A2',name:'الفهم القرائي وتحليل النص'},
  {code:'A3',name:'التقويم والنقد وإبداء الرأي'}
 ],
 math:[
  {code:'M1',name:'الأعداد والعمليات عليها'},
  {code:'M2',name:'الجبر والعلاقات والأنماط'},
  {code:'M3',name:'الهندسة والقياس'},
  {code:'M4',name:'الإحصاء والاحتمالات'}
 ],
 science:[
  {code:'S1',name:'علوم الأرض والفضاء'},
  {code:'S2',name:'علوم الحياة'},
  {code:'S3',name:'العلوم الفيزيائية'},
  {code:'S4',name:'الاستقصاء والممارسات العلمية'}
 ]
};
function activeKey(){
 const buttons=[...document.querySelectorAll('#nafesArea .nafes-subject')];
 const i=buttons.findIndex(b=>b.classList.contains('active'));
 return KEYS[Math.max(0,i)]||'arabic';
}
function profileId(key){return state.profiles.find(p=>p.subject_key===key&&p.grade_level==='الثالث المتوسط')?.id||''}
function testsFor(key,name){
 const pid=profileId(key);if(!pid)return[];
 return state.assessments.filter(a=>a.subject_profile_id===pid&&a.term==='نافس'&&a.unit_name===name&&String(a.title||'').includes('— معيار ')).sort((a,b)=>String(a.lesson_name||'').localeCompare(String(b.lesson_name||''),'ar',{numeric:true}));
}
function modelNo(t,i){const m=String(t.lesson_name||'').match(/(\d+)$/);return m?String(+m[1]).padStart(2,'0'):String(i+1).padStart(2,'0')}
window.toggleNafesModels=function(code){const p=document.getElementById('nafes-models-'+code);if(!p)return;p.classList.toggle('open');const b=document.querySelector(`[data-nafes-toggle="${code}"]`);if(b)b.textContent=p.classList.contains('open')?'إخفاء الاختبارات':'عرض الاختبارات'};
window.openNafesCriterionModel=async function(id,key){
 const t=state.assessments.find(x=>x.id===id);if(!t)return;
 if(t.status==='open'){shareTest(id);return}
 await openTest(id);
 setTimeout(()=>{switchSection('nafes');if(typeof window.setNafesSubject==='function')window.setNafesSubject(key)},250);
};
function enhance(){
 const area=document.getElementById('nafesArea');if(!area||!area.children.length)return;
 const key=activeKey();
 if(area.dataset.modelsSubject===key&&area.querySelector('.nafes-model-bank'))return;
 const criteria=CRITERIA[key]||[];
 const goalEls=[...area.querySelectorAll('.nafes-goal')];
 criteria.forEach((c,idx)=>{
  const goal=goalEls[idx];if(!goal)return;
  const tests=testsFor(key,c.name);
  const bank=document.createElement('div');bank.className='nafes-model-bank';
  bank.innerHTML=`<div class="nafes-model-bank-head"><div class="nafes-model-bank-title"><span class="nafes-model-count">${tests.length}</span><strong>اختبار نافس جاهز على هذا المعيار</strong></div><button class="nafes-model-toggle" data-nafes-toggle="${c.code}" onclick="toggleNafesModels('${c.code}')">عرض الاختبارات</button></div><div class="nafes-criterion-ready"><b>${tests.length>=50?'مكتمل:':'قيد الاستكمال:'}</b> ${tests.length} نموذج مستقل لهذا المعيار. عند دخول الطالب يختار النظام 9 أسئلة من بنك المعيار وتختلف صيغة الاختيارات وترتيب الأسئلة بين النماذج.</div><div id="nafes-models-${c.code}" class="nafes-models-panel"><div class="nafes-model-grid">${tests.map((t,i)=>`<div class="nafes-model-row"><div><h5>النموذج ${modelNo(t,i)}</h5><p>${t.status==='open'?'مفتوح للطلاب':'جاهز للإرسال'}${t.status==='open'&&t.access_code?' · الكود '+esc(t.access_code):''}</p></div><div class="actions"><button class="btn ${t.status==='open'?'':'primary'}" onclick="openNafesCriterionModel('${t.id}','${key}')">${t.status==='open'?'كود / QR':'فتح للطلاب'}</button></div></div>`).join('')}</div></div>`;
  goal.appendChild(bank);
 });
 const bottom=area.querySelector('.nafes-tests');
 if(bottom){
  const total=criteria.reduce((n,c)=>n+testsFor(key,c.name).length,0);
  bottom.innerHTML=`<div class="nafes-tests-summary"><h3>بنوك اختبارات نافس حسب المعايير</h3><p>تم توزيع الاختبارات داخل كل معيار بدل جمعها في قائمة طويلة. إجمالي النماذج في هذه المادة الآن: <b>${total}</b> نموذج، وبحد أدنى 50 نموذجًا لكل معيار.</p></div>`;
 }
 area.dataset.modelsSubject=key;
}
const target=document.getElementById('nafesArea');
if(target)new MutationObserver(()=>queueMicrotask(enhance)).observe(target,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('[data-section="nafes"],.nafes-subject'))setTimeout(enhance,30)});
setTimeout(enhance,500);
})();