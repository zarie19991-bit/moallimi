(()=>{
'use strict';
const T=window.NafesTeacher;
const A=window.NafesAnalytics;
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false;

if(!document.querySelector('link[data-analysis-ux]')){
  const l=document.createElement('link');
  l.rel='stylesheet';
  l.href='analysis-ux-fix.css?v=20260911-1';
  l.dataset.analysisUx='1';
  document.head.appendChild(l);
}

function normalize(a){return A?.normalizeAttempt?A.normalizeAttempt(a):a;}
function submitted(a){return A?.isSubmitted?A.isSubmitted(a):!!(a&&(a.submitted_at||a.completed_at||a.finished_at||['submitted','completed','finished'].includes(String(a.status||'').toLowerCase())));}
function testIdOf(a){return String(a?.test_id||a?.assessment_id||a?.exam_id||'').trim();}
function when(a){return Date.parse(a?.submitted_at||a?.completed_at||a?.finished_at||a?.started_at||0)||0;}
function titleOf(a,t){return String(t?.title||a?.test_title||a?.assessment_title||a?.exam_title||a?.title||'اختبار نافس').trim();}

async function refreshReportTests(){
  const select=$('reportTest');
  if(!select||!T?.getKey?.()||busy)return;
  busy=true;
  const keep=select.value;
  try{
    let cursor=0,rawAttempts=[],tests=[];
    do{
      const d=await T.api('teacher_data',{cursor,limit:100});
      rawAttempts.push(...(d.attempts||[]));
      if(cursor===0)tests=d.tests||[];
      cursor=d.next_cursor;
    }while(cursor!==null);

    const attempts=rawAttempts.map(normalize);
    const groups=new Map();
    for(const a of attempts){
      const id=testIdOf(a);
      if(!id||!submitted(a))continue;
      const g=groups.get(id)||{latest:a,count:0};
      g.count++;
      if(when(a)>=when(g.latest))g.latest=a;
      groups.set(id,g);
    }

    const testById=new Map((tests||[]).map(t=>[String(t.id||t.test_id||''),t]));
    const rows=[...groups.entries()].map(([id,g])=>{
      const t=testById.get(id);
      return {id,title:titleOf(g.latest,t),time:when(g.latest),count:g.count};
    }).sort((a,b)=>b.time-a.time);

    select.innerHTML=rows.length
      ? '<option value="">اختر الاختبار</option>'+rows.map(r=>`<option value="${E(r.id)}">${E(r.title)} — ${r.count} نتيجة</option>`).join('')
      : '<option value="">لا توجد اختبارات مكتملة بنتائج حقيقية</option>';

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
