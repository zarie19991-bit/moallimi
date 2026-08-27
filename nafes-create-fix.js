(()=>{
let creating=false;
const originalBuild=window.buildArabicReadyTest;
const isBankCreated=t=>String(t?.title||'').startsWith('اختبار مهارات القراءة — نموذج متغير');
function arabicProfileId(){return state.profiles.find(p=>p.subject_key==='arabic'&&p.grade_level==='الثالث المتوسط')?.id||''}
function bankCreatedTests(){const pid=arabicProfileId();return state.assessments.filter(a=>a.subject_profile_id===pid&&isBankCreated(a)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function ensurePanel(){
 const area=document.getElementById('nafesArea');if(!area||!area.children.length)return;
 const active=[...area.querySelectorAll('.nafes-subject')].findIndex(b=>b.classList.contains('active'));
 if(active!==0){area.querySelector('.nafes-bank-created-panel')?.remove();return}
 const tests=bankCreatedTests();
 let panel=area.querySelector('.nafes-bank-created-panel');
 if(!panel){panel=document.createElement('section');panel.className='card nafes-bank-created-panel';const bottom=area.querySelector('.nafes-tests');(bottom||area).before?.(panel);if(!panel.isConnected)area.appendChild(panel)}
 panel.innerHTML=`<div class="page-head" style="margin-bottom:10px"><div><h2 style="font-size:18px">اختبارات أنشأتها من بنك القراءة</h2><p>أي اختبار تنشئه من زر «إنشاء الاختبار من البنك» يظهر هنا مباشرة، مع الكود وQR.</p></div><span class="status high">${tests.length} اختبار</span></div><div class="test-list">${tests.map(t=>`<div class="test-row"><div><h4>${esc(t.title)}</h4><p>${t.status==='open'?'مفتوح للطلاب':'جاهز للفتح'}${t.access_code?' · الكود '+esc(t.access_code):''}</p></div><div class="actions">${t.status==='open'?`<button class="btn" onclick="shareTest('${t.id}')">كود / QR</button>`:`<button class="btn primary" onclick="openTest('${t.id}')">فتح للطلاب</button>`}</div></div>`).join('')||'<div class="empty"><b>لم تنشئ اختبارًا من البنك بعد.</b>اضغط الزر مرة واحدة، وسيظهر الاختبار هنا فور اكتمال إنشائه.</div>'}</div>`;
}
if(typeof originalBuild==='function'){
 window.buildArabicReadyTest=async function(){
  if(creating){toast('جارٍ إنشاء الاختبار الآن، انتظر حتى يكتمل.',true);return}
  creating=true;
  const before=bankCreatedTests().length;
  toast('جارٍ إنشاء الاختبار وإضافة أسئلته...');
  try{
   await originalBuild();
   const after=bankCreatedTests().length;
   setTimeout(()=>{switchSection('nafes');if(typeof window.setNafesSubject==='function')window.setNafesSubject('arabic');setTimeout(ensurePanel,80)},120);
   if(after>before)toast('تم إنشاء الاختبار وظهر الآن ضمن اختبارات بنك القراءة.');
  }catch(e){toast('تعذر إنشاء الاختبار. أعد المحاولة مرة واحدة.',true)}
  finally{creating=false}
 };
}
const target=document.getElementById('nafesArea');if(target)new MutationObserver(()=>queueMicrotask(ensurePanel)).observe(target,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest('[data-section="nafes"],.nafes-subject'))setTimeout(ensurePanel,120)});
setTimeout(ensurePanel,600);
})();