(()=>{
'use strict';
const T=window.NafesTeacher;
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false;

function submitted(a){return !!(a&&(a.submitted_at||a.status==='submitted'));}
function when(a){return Date.parse(a?.submitted_at||a?.started_at||0)||0;}

async function refreshReportTests(){
  const select=$('reportTest');
  if(!select||!T?.getKey?.()||busy)return;
  busy=true;
  const keep=select.value;
  try{
    let cursor=0,attempts=[],tests=[];
    do{
      const d=await T.api('teacher_data',{cursor,limit:100});
      attempts.push(...(d.attempts||[]));
      if(cursor===0)tests=d.tests||[];
      cursor=d.next_cursor;
    }while(cursor!==null);

    // المصدر الأساسي للقائمة هو المحاولات الحقيقية المسلّمة نفسها، وليس قائمة الاختبارات.
    // بهذا يظهر أي اختبار اختبره طالب فعليًا حتى لو لم يوجد له سجل مطابق في tests.
    const groups=new Map();
    for(const a of attempts){
      if(!submitted(a)||!a.test_id)continue;
      const id=String(a.test_id);
      const prev=groups.get(id);
      if(!prev||when(a)>when(prev))groups.set(id,a);
    }

    const testById=new Map((tests||[]).map(t=>[String(t.id||''),t]));
    const rows=[...groups.entries()].map(([id,a])=>{
      const t=testById.get(id);
      return {
        id,
        title:(t?.title||a.title||'اختبار نافس').trim(),
        time:when(a),
        count:attempts.filter(x=>submitted(x)&&String(x.test_id||'')===id).length
      };
    }).sort((a,b)=>b.time-a.time);

    select.innerHTML=rows.length
      ? '<option value="">اختر الاختبار الذي تم أداؤه</option>'+rows.map(r=>`<option value="${E(r.id)}">${E(r.title)} — ${r.count} نتيجة</option>`).join('')
      : '<option value="">لا توجد اختبارات بنتائج مسلّمة</option>';

    if(keep&&rows.some(r=>r.id===keep))select.value=keep;
  }catch(err){
    console.error('تعذر تحميل اختبارات التقرير:',err);
    select.innerHTML='<option value="">تعذر تحميل الاختبارات — اضغط تحديث البيانات</option>';
  }finally{busy=false;}
}

function schedule(delay=80){setTimeout(refreshReportTests,delay);}
window.addEventListener('load',()=>schedule(250));
window.addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)schedule(250);});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-view="report"]')||e.target.closest('#refreshBtn'))schedule(120);
});
// إذا قام analysis.js بإعادة كتابة القائمة بعدنا، نعيد بنائها من النتائج الحقيقية.
let timer=0;
const observer=new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(()=>{
    const report=document.getElementById('reportView');
    if(report&&!report.hidden&&T?.getKey?.())refreshReportTests();
  },120);
});
observer.observe(document.documentElement,{subtree:true,childList:true});
})();
