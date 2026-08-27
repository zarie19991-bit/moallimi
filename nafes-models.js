(()=>{
const KEYS=['arabic','math','science'];
const PAGE_SIZE=10;
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
function activeKey(){const buttons=[...document.querySelectorAll('#nafesArea .nafes-subject')];const i=buttons.findIndex(b=>b.classList.contains('active'));return KEYS[Math.max(0,i)]||'arabic'}
function profileId(key){return state.profiles.find(p=>p.subject_key===key&&p.grade_level==='الثالث المتوسط')?.id||''}
function testsFor(key,name){const pid=profileId(key);if(!pid)return[];return state.assessments.filter(a=>a.subject_profile_id===pid&&a.term==='نافس'&&a.unit_name===name&&String(a.title||'').includes('— معيار ')).sort((a,b)=>String(a.lesson_name||'').localeCompare(String(b.lesson_name||''),'ar',{numeric:true}))}
function modelNo(t,i){const m=String(t.lesson_name||'').match(/(\d+)$/);return m?String(+m[1]).padStart(2,'0'):String(i+1).padStart(2,'0')}
function criterionByCode(key,code){return (CRITERIA[key]||[]).find(x=>x.code===code)}
function renderPage(code,key,page=1){
 const c=criterionByCode(key,code),panel=document.getElementById('nafes-models-'+code);if(!c||!panel)return;
 const tests=testsFor(key,c.name),pages=Math.max(1,Math.ceil(tests.length/PAGE_SIZE)),p=Math.min(Math.max(1,page),pages),start=(p-1)*PAGE_SIZE,part=tests.slice(start,start+PAGE_SIZE);
 panel.innerHTML=`<div class="nafes-model-grid">${part.map((t,i)=>`<div class="nafes-model-row"><div><h5>النموذج ${modelNo(t,start+i)}</h5><p>${t.status==='open'?'مفتوح للطلاب':'جاهز للإرسال'}${t.status==='open'&&t.access_code?' · الكود '+esc(t.access_code):''}</p></div><div class="actions"><button class="btn ${t.status==='open'?'':'primary'}" onclick="openNafesCriterionModel('${t.id}','${key}')">${t.status==='open'?'كود / QR':'فتح للطلاب'}</button></div></div>`).join('')||'<div class="empty">لا توجد نماذج في هذا المعيار.</div>'}</div>${pages>1?`<div class="actions" style="justify-content:center;margin-top:12px"><button class="btn" ${p<=1?'disabled':''} onclick="nafesModelPage('${code}','${key}',${p-1})">السابق</button><span class="status neutral">${p} / ${pages}</span><button class="btn" ${p>=pages?'disabled':''} onclick="nafesModelPage('${code}','${key}',${p+1})">التالي</button></div>`:''}`;
 panel.dataset.page=String(p);
}
window.nafesModelPage=(code,key,page)=>renderPage(code,key,page);
window.toggleNafesModels=function(code,key){const p=document.getElementById('nafes-models-'+code);if(!p)return;const opening=!p.classList.contains('open');p.classList.toggle('open',opening);const b=document.querySelector(`[data-nafes-toggle="${code}"]`);if(b)b.textContent=opening?'إخفاء الاختبارات':'عرض الاختبارات';if(opening)renderPage(code,key,1);else p.innerHTML=''};
window.openNafesCriterionModel=async function(id,key){const t=state.assessments.find(x=>x.id===id);if(!t)return;if(t.status==='open'){shareTest(id);return}await openTest(id);setTimeout(()=>{switchSection('nafes');window.setNafesSubject?.(key);setTimeout(enhance,80)},250)};
function enhance(){
 const area=document.getElementById('nafesArea');if(!area||!area.children.length)return;
 const key=activeKey();
 if(area.dataset.modelsSubject===key&&area.querySelector('.nafes-model-bank'))return;
 area.querySelectorAll('.nafes-model-bank').forEach(x=>x.remove());
 const criteria=CRITERIA[key]||[],goalEls=[...area.querySelectorAll('.nafes-goal')];
 criteria.forEach((c,idx)=>{const goal=goalEls[idx];if(!goal)return;const tests=testsFor(key,c.name);const bank=document.createElement('div');bank.className='nafes-model-bank';bank.innerHTML=`<div class="nafes-model-bank-head"><div class="nafes-model-bank-title"><span class="nafes-model-count">${tests.length}</span><strong>اختبار نافس جاهز على هذا المعيار</strong></div><button class="nafes-model-toggle" data-nafes-toggle="${c.code}" onclick="toggleNafesModels('${c.code}','${key}')">عرض الاختبارات</button></div><div class="nafes-criterion-ready"><b>${tests.length>=50?'مكتمل:':'قيد الاستكمال:'}</b> ${tests.length} نموذج لهذا المعيار. لا تُحمّل قائمة النماذج إلا عند فتحها لتبقى المنصة سريعة.</div><div id="nafes-models-${c.code}" class="nafes-models-panel"></div>`;goal.appendChild(bank)});
 const bottom=area.querySelector('.nafes-tests');if(bottom){const total=criteria.reduce((n,c)=>n+testsFor(key,c.name).length,0);bottom.innerHTML=`<div class="nafes-tests-summary"><h3>بنوك اختبارات نافس حسب المعايير</h3><p>إجمالي النماذج في هذه المادة: <b>${total}</b>. تظهر 10 نماذج فقط في كل صفحة عند الطلب بدل تحميل جميع النماذج دفعة واحدة.</p></div>`}
 area.dataset.modelsSubject=key;
}
document.addEventListener('click',e=>{if(e.target.closest('[data-section="nafes"],.nafes-subject'))setTimeout(enhance,70)});
setTimeout(enhance,500);
})();