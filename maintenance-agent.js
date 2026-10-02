(()=>{
'use strict';
const $=id=>document.getElementById(id);
const ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/maintenance-agent';
let latestRun=null,allProposals=[],lastBrainQuestion='';
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sevLabel={ok:'سليم',info:'معلومة',warning:'تحذير',critical:'حرج'};
const riskLabel={low:'منخفض',medium:'متوسط',high:'مرتفع'};
function setState(msg,type=''){const el=$('state');el.textContent=msg;el.className='state'+(type?' '+type:'');}
async function call(action,body={}){
 const key=window.NafesTeacher?.getKey?.();
 if(!key)throw new Error('يلزم دخول الحساب الرئيسي.');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),30000);
 try{
  const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','x-teacher-key':key},body:JSON.stringify({...body,action}),cache:'no-store',signal:ctrl.signal});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.error)throw new Error(data.error||'تعذر تنفيذ طلب وكيل الصيانة.');
  return data;
 }catch(e){if(e.name==='AbortError')throw new Error('استغرق الفحص أكثر من 30 ثانية. أعد المحاولة.');throw e;}
 finally{clearTimeout(timer);}
}
function metric(label,value,muted=false){return '<div class="metric"><span>'+esc(label)+'</span><b class="'+(muted?'muted':'')+'">'+esc(value)+'</b></div>'}
function metricValue(v){return v===null||v===undefined||v===''?{text:'لم يُفحص بعد',muted:true}:{text:ar(v),muted:false}}
function renderMetrics(run){
 const m=run?.metrics||{},s=m.database_security||{},q=m.question_quality||{},p=m.paper_review||{};
 const leak=metricValue(q.prompt_leak_rows);
 const dupKnown=q.duplicate_groups_question_bank!==null&&q.duplicate_groups_question_bank!==undefined&&q.duplicate_groups_curated_bank!==null&&q.duplicate_groups_curated_bank!==undefined;
 const dup=dupKnown?{text:ar(Number(q.duplicate_groups_question_bank||0)+Number(q.duplicate_groups_curated_bank||0)),muted:false}:{text:'لم يُفحص بعد',muted:true};
 $('metrics').innerHTML=[
  metric('جداول public بلا RLS',ar(s.rls_disabled_public_count)),
  metric('صفوف بصياغات داخلية',leak.text,leak.muted),
  metric('مجموعات تكرار حرفي',dup.text,dup.muted),
  metric('مراجعات ورقية محفوظة',ar(p.saved_reviews))
 ].join('');
}
function renderFindings(run){
 latestRun=run||null;
 $('preparePlan').disabled=!run||!(run.findings||[]).length;
 const sev=run?.severity||'ok';$('runSeverity').className='status-pill '+sev;$('runSeverity').textContent=sevLabel[sev]||sev;
 const rows=run?.findings||[];
 $('findings').innerHTML=rows.length?rows.map(f=>'<article class="finding"><span class="dot '+esc(f.severity)+'"></span><div><div class="proposal-head"><h3>'+esc(f.title)+'</h3><span class="status-pill '+esc(f.severity)+'">'+esc(sevLabel[f.severity]||f.severity)+'</span></div><p>'+esc(f.detail)+'</p><p class="safe-action"><b>الإجراء الآمن:</b> '+esc(f.safe_action)+'</p></div></article>').join(''):'<div class="empty">لم يكتشف الفحص الحالي مشكلات ضمن النطاق الآمن.</div>';
 renderMetrics(run||{});
}
function renderHistory(runs){
 $('history').innerHTML=runs?.length?runs.map(r=>'<article class="history-item"><div class="history-top"><b>'+esc(r.summary)+'</b><span class="status-pill '+esc(r.severity)+'">'+esc(sevLabel[r.severity]||r.severity)+'</span></div><div class="history-meta"><span>'+new Date(r.created_at).toLocaleString('ar-SA')+'</span><span>•</span><span>'+ar((r.findings||[]).length)+' ملاحظات</span></div></article>').join(''):'<div class="empty">لا يوجد سجل حتى الآن.</div>';
}
function renderProposals(rows){
 allProposals=rows||[];
 $('proposals').innerHTML=allProposals.length?allProposals.map(p=>{
   const pending=p.status==='pending';
   return '<article class="proposal"><div class="proposal-head"><h3>'+esc(p.title)+'</h3><span class="risk">المخاطر: '+esc(riskLabel[p.risk_level]||p.risk_level)+'</span></div><p>الوضع: '+esc(({pending:'بانتظار قرارك',approved:'معتمدة — دون تنفيذ',rejected:'مرفوضة',applied:'مطبقة'})[p.status]||p.status)+'</p>'+(pending?'<div class="proposal-actions"><button class="approve" data-approve="'+esc(p.id)+'">اعتماد الخطة دون تنفيذ</button><button class="reject" data-reject="'+esc(p.id)+'">رفض</button></div>':'')+'</article>';
 }).join(''):'<div class="empty">لا توجد خطط إصلاح حتى الآن.</div>';
}

const confidenceLabel={high:'ثقة عالية',medium:'ثقة متوسطة',low:'معرفة غير مكتملة'};
function renderBrainAnswer(data){
 const host=$('brainAnswer');if(!host)return;
 const sources=Array.isArray(data?.sources)?data.sources:[];
 const matched=Array.isArray(data?.matched)?data.matched:[];
 const followups=Array.isArray(data?.followups)?data.followups:[];
 host.innerHTML='<div class="brain-answer-card">'+
   '<p>'+esc(data?.answer||'لا توجد إجابة موثقة بعد.')+'</p>'+
   '<div class="brain-meta"><span>'+esc(confidenceLabel[data?.confidence]||data?.confidence||'—')+'</span><span>•</span><span>'+ar(matched.length)+' أجزاء معرفة مرتبطة</span><span>•</span><span>لا تُحفظ المحادثة</span></div>'+
   (sources.length?'<div class="brain-sources"><b>المصادر داخل المشروع:</b><br>'+sources.map(esc).join(' · ')+'</div>':'')+
   (followups.length?'<div class="brain-followups">'+followups.map(x=>'<button type="button" data-brain-followup="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div>':'')+
   '</div>';
}
async function loadBrainOverview(){
 try{
  const d=await call('brain_overview');
  const badge=$('brainBadge');
  if(badge){badge.className='status-pill ok';badge.textContent='يعرف '+ar(d.knowledge_count||0)+' قاعدة عن المنصة';}
 }catch(e){
  const badge=$('brainBadge');
  if(badge){badge.className='status-pill warning';badge.textContent='تعذر تحميل المعرفة';}
 }
}
async function askBrain(question){
 const q=String(question||'').trim();if(!q)return;
 lastBrainQuestion=q;
 const btn=$('brainAsk');if(btn)btn.disabled=true;
 $('brainQuestion').value=q;
 $('brainAnswer').innerHTML='<div class="empty">جارٍ الرجوع إلى خريطة المنصة وقرارات المشروع…</div>';
 try{
  const d=await call('ask_platform',{question:q});
  renderBrainAnswer(d);
 }catch(e){
  $('brainAnswer').innerHTML='<div class="empty">'+esc(e.message||String(e))+'</div>';
 }finally{if(btn)btn.disabled=false;}
}

async function loadHistory(){
 const d=await call('history',{limit:12});
 renderHistory(d.runs||[]);renderProposals(d.proposals||[]);
 if(!latestRun&&d.runs?.[0])renderFindings(d.runs[0]);
 return d;
}
async function init(){
 try{
  if(!window.NafesTeacher?.getKey?.()){window.NafesTeacher?.requireKey?.('أدخل المفتاح الرئيسي لفتح وكيل الصيانة.');setState('يلزم دخول الحساب الرئيسي.','error');return;}
  const p=await window.NafesTeacher.ensureProfile();
  if(p?.subject_scope!=='all'){$('denied').hidden=false;$('mainContent').hidden=true;setState('لا توجد صلاحية لهذا الحساب.','error');return;}
  $('mainContent').hidden=false;setState('الوضع الآمن جاهز. يمكنك تشغيل الفحص الشامل.','ok');
  await Promise.all([loadHistory(),loadBrainOverview()]);
 }catch(e){setState(e.message||String(e),'error');}
}
$('brainForm')?.addEventListener('submit',e=>{e.preventDefault();askBrain($('brainQuestion').value);});
document.querySelectorAll('[data-brain-q]').forEach(b=>b.addEventListener('click',()=>askBrain(b.dataset.brainQ||'')));
$('brainAnswer')?.addEventListener('click',e=>{const b=e.target.closest('[data-brain-followup]');if(b)askBrain((lastBrainQuestion?lastBrainQuestion+' — ':'')+(b.dataset.brainFollowup||''));});

$('runScan').onclick=async()=>{
 const btn=$('runScan');btn.disabled=true;setState('جارٍ فحص قاعدة البيانات وبنوك الأسئلة دون قراءة بيانات الطلاب الشخصية…');
 try{
  const d=await call('diagnose');renderFindings(d.run);await loadHistory();setState(d.run.summary,'ok');
 }catch(e){setState(e.message||String(e),'error');}
 finally{btn.disabled=false;}
};
$('refreshHistory').onclick=async()=>{try{setState('جارٍ تحديث سجل الوكيل…');await loadHistory();setState('تم تحديث السجل.','ok');}catch(e){setState(e.message||String(e),'error');}};
$('preparePlan').onclick=async()=>{
 if(!latestRun)return;
 const btn=$('preparePlan');btn.disabled=true;
 try{
  setState('جارٍ إعداد خطط إصلاح غير تنفيذية…');
  const d=await call('prepare_plan',{run_id:latestRun.id});renderProposals(d.proposals||[]);await loadHistory();setState('تم إعداد الخطة. لن ينفذ أي تغيير حتى نضيف مرحلة التنفيذ الآمن لاحقًا.','ok');
 }catch(e){setState(e.message||String(e),'error');}
 finally{btn.disabled=false;}
};
$('proposals').addEventListener('click',async e=>{
 const approve=e.target.closest('[data-approve]'),reject=e.target.closest('[data-reject]');
 if(!approve&&!reject)return;
 const id=(approve||reject).dataset[approve?'approve':'reject'];
 const decision=approve?'approved':'rejected';
 if(approve&&!confirm('سيتم اعتماد الخطة فقط دون تنفيذ أي تعديل. هل تريد المتابعة؟'))return;
 try{
  const body={proposal_id:id,decision};if(approve)body.confirm='اعتماد الخطة';
  setState('جارٍ حفظ قرارك…');await call('decide',body);await loadHistory();setState('تم حفظ القرار. لم يتم تنفيذ أي تعديل تلقائيًا.','ok');
 }catch(err){setState(err.message||String(err),'error');}
});
addEventListener('nafes:auth-changed',e=>{if(!e.detail.authenticated)location.href='teacher.html';});
init();
})();