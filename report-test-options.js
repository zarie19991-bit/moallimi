(()=>{
'use strict';
const T=window.NafesTeacher;
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
let busy=false;

async function refreshReportTests(){
  const select=$('reportTest');
  if(!select||!T?.getKey?.()||busy)return;
  busy=true;
  const keep=select.value;
  try{
    let cursor=0,tests=[],attempts=[];
    do{
      const d=await T.api('teacher_data',{cursor,limit:100});
      attempts.push(...(d.attempts||[]));
      if(cursor===0)tests=d.tests||[];
      cursor=d.next_cursor;
    }while(cursor!==null);

    const resultIds=new Set(attempts.filter(a=>a?.submitted_at||a?.status==='submitted').map(a=>String(a.test_id||'')));
    const candidates=tests.filter(t=>{
      const id=String(t.id||'');
      return isUuid(id)||resultIds.has(id);
    }).sort((a,b)=>{
      const at=Date.parse(a.created_at||a.published_at||0)||0;
      const bt=Date.parse(b.created_at||b.published_at||0)||0;
      return bt-at;
    });

    const seen=new Set();
    const rows=candidates.filter(t=>{
      const id=String(t.id||'');
      if(!id||seen.has(id))return false;
      seen.add(id);return true;
    });

    select.innerHTML='<option value="">اختر الاختبار</option>'+rows.map(t=>{
      const id=String(t.id||'');
      const has=resultIds.has(id);
      const suffix=has?' — توجد نتائج':' — لم يُختبر بعد';
      return `<option value="${E(id)}">${E(t.title||id)}${suffix}</option>`;
    }).join('');

    if(keep&&rows.some(t=>String(t.id)===keep))select.value=keep;
  }catch(err){
    console.warn('تعذر تحديث قائمة اختبارات التقرير',err);
  }finally{busy=false;}
}

function schedule(){setTimeout(refreshReportTests,50)}
window.addEventListener('load',schedule);
window.addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)schedule()});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-view="report"]')||e.target.closest('#refreshBtn'))schedule();
});
const selectObserver=new MutationObserver(()=>{
  const s=$('reportTest');
  if(s&&s.options.length<=1&&T?.getKey?.())schedule();
});
selectObserver.observe(document.documentElement,{subtree:true,childList:true});
})();
