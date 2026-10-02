(()=>{
'use strict';
const $=id=>document.getElementById(id);
const ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/maintenance-agent';
const TEST_AUDIT_ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/maintenance-test-audit';
const SEMANTIC_AUDIT_ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/maintenance-semantic-audit';
let latestRun=null,latestPrintRun=null,allProposals=[],allHandoffs=[],lastBrainQuestion='';
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sevLabel={ok:'سليم',info:'معلومة',warning:'تحذير',critical:'حرج'};
const riskLabel={low:'منخفض',medium:'متوسط',high:'مرتفع'};
function setState(msg,type=''){const el=$('state');el.textContent=msg;el.className='state'+(type?' '+type:'');}
async function call(action,body={}){
 const key=window.NafesTeacher?.getKey?.();
 if(!key)throw new Error('يلزم دخول الحساب الرئيسي.');
 const timeoutMs=action==='indicator_audit'?90000:30000;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 try{
  const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','x-teacher-key':key},body:JSON.stringify({...body,action}),cache:'no-store',signal:ctrl.signal});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.error)throw new Error(data.error||'تعذر تنفيذ طلب وكيل الصيانة.');
  return data;
 }catch(e){if(e.name==='AbortError')throw new Error(action==='indicator_audit'?'استغرق فحص جميع المؤشرات أكثر من 90 ثانية. أعد المحاولة.':'استغرق الفحص أكثر من 30 ثانية. أعد المحاولة.');throw e;}
 finally{clearTimeout(timer);}
}
async function callGeneratedTestAudit(){
 const key=window.NafesTeacher?.getKey?.();
 if(!key)throw new Error('يلزم دخول الحساب الرئيسي.');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),90000);
 try{
  const res=await fetch(TEST_AUDIT_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','x-teacher-key':key},body:'{}',cache:'no-store',signal:ctrl.signal});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.error)throw new Error(data.error||'تعذر فحص الاختبارات الفعلية للمؤشرات.');
  return data;
 }catch(e){if(e.name==='AbortError')throw new Error('استغرق فحص الاختبارات الفعلية أكثر من 90 ثانية. أعد المحاولة.');throw e;}
 finally{clearTimeout(timer);}
}

async function callSemanticAudit(action,body={}){
 const key=window.NafesTeacher?.getKey?.();
 if(!key)throw new Error('يلزم دخول الحساب الرئيسي.');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),90000);
 try{
  const res=await fetch(SEMANTIC_AUDIT_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','x-teacher-key':key},body:JSON.stringify({...body,action}),cache:'no-store',signal:ctrl.signal});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.error)throw new Error(data.error||'تعذر تشغيل المحكّم التربوي.');
  return data;
 }catch(e){if(e.name==='AbortError')throw new Error('استغرق التحكيم التربوي أكثر من 90 ثانية في هذه الدفعة. أعد المحاولة للمتابعة.');throw e;}
 finally{clearTimeout(timer);}
}
function semanticJudgmentLabel(v,provider){if(v==='pass')return provider==='openai'?'سليم دلاليًا':'اجتاز الفحص القاعدي';return ({review:'يحتاج مراجعة',reject:'مشكلة مؤكدة'})[v]||v||'—';}
function semanticJobStatusLabel(v){return ({queued:'في الانتظار',running:'جارٍ التحكيم',completed:'اكتمل التحكيم الدلالي',partial:'مكتمل جزئيًا',provider_required:'اكتمل الفحص القاعدي — الذكاء الدلالي غير موصول',failed:'تعذر التحكيم'})[v]||v||'—';}
function renderSemanticProvider(provider){
 const badge=$('semanticJudgeBadge'),note=$('semanticProviderNote');
 if(!badge||!note)return;
 if(provider?.configured){
   badge.className='status-pill ok';badge.textContent='محكّم دلالي متصل';
   note.className='semantic-provider-note ok';
   note.innerHTML='التحكيم الدلالي مفعّل عبر نموذج ذكاء اصطناعي. تُرسل فقط بيانات السؤال التعليمية: المؤشر، السؤال، البدائل، الإجابة، والسياق عند الحاجة. <b>لا تُرسل بيانات الطلاب أو المحاولات.</b>';
 }else{
   badge.className='status-pill warning';badge.textContent='محكّم تربوي قاعدي فقط';
   note.className='semantic-provider-note warning';
   note.innerHTML='طبقة التحكيم التربوي القاعدية مفعّلة الآن، وتكشف التناقضات والقواعد التربوية المعروفة. <b>للفهم الدلالي العام لكل سؤال يلزم ربط مزود نموذج لغوي في وظيفة Supabase.</b>';
 }
}
function renderSemanticProgress(job){
 const host=$('semanticJudgeProgress');if(!host)return;
 if(!job){host.innerHTML='';return;}
 const total=Number(job.total_candidates||0),done=Number(job.reviewed_count||0),pct=total?Math.min(100,Math.round(done*100/total)):0;
 host.innerHTML='<div class="semantic-progress-card"><div class="semantic-progress-top"><b>'+esc(semanticJobStatusLabel(job.status))+'</b><span>'+ar(done)+' / '+ar(total)+'</span></div><div class="semantic-progress-bar"><i style="width:'+pct+'%"></i></div><div class="semantic-progress-meta"><span>سليم: '+ar(job.pass_count||0)+'</span><span>مراجعة: '+ar(job.review_count||0)+'</span><span>مرفوض: '+ar(job.reject_count||0)+'</span></div></div>';
}
function semanticDimensionSummary(r){
 const d=r?.dimensions||{},labels={indicator_alignment:'مطابقة المؤشر',content_accuracy:'صحة المحتوى',single_correct_answer:'وحدة الإجابة',distractors:'المشتتات',cognitive_level:'المستوى المعرفي',wording:'الصياغة',semantic_repetition:'التكرار المعنوي'};
 return Object.entries(labels).map(([k,l])=>{
   const x=d[k],v=typeof x==='string'?x:x?.status;
   if(!v||v==='pass'||v==='unknown')return '';
   return '<span class="semantic-dim '+esc(v)+'">'+esc(l)+': '+esc(v==='fail'?'مشكلة':'مراجعة')+'</span>';
 }).filter(Boolean).join('');
}
function renderSemanticReport(data){
 const host=$('semanticJudgeResult');if(!host)return;
 const job=data?.job||{},rows=Array.isArray(data?.reviews)?data.reviews:[];
 renderSemanticProvider(data?.provider||{});
 renderSemanticProgress(job);
 if(!rows.length){
   host.innerHTML='<div class="empty">'+(job.status==='completed'?'لم تظهر حالات تحتاج مراجعة في هذا النطاق.':'لا توجد حالات محفوظة تحتاج مراجعة حتى الآن.')+'</div>';
   return;
 }
 host.innerHTML='<div class="semantic-report-head">'+
   metric('راجع المحكّم',ar(job.reviewed_count||0))+
   metric(job.provider==='openai'?'سليم دلاليًا':'اجتاز القواعد',ar(job.pass_count||0))+
   metric('يحتاج مراجعة',ar(job.review_count||0))+
   metric('مرفوض',ar(job.reject_count||0))+
 '</div>'+
 rows.map(r=>{
   const reasons=(r.reasons||[]).map(x=>'<li>'+esc(x)+'</li>').join('');
   const suggestion=r.suggested_question?'<div class="semantic-suggestion"><b>صياغة مقترحة:</b> '+esc(r.suggested_question)+'</div>':'';
   const optionRows=Array.isArray(r.options)?r.options.map((o,i)=>'<div class="semantic-option '+(Number(r.correct_index)===i?'correct':'')+'"><b>'+['أ','ب','ج','د'][i]+'.</b> '+esc(o)+(Number(r.correct_index)===i?' <span>الإجابة المعتمدة</span>':'')+'</div>').join(''):'';
   const options=optionRows?'<details class="semantic-options"><summary>عرض البدائل والإجابة المعتمدة</summary>'+optionRows+'</details>':'';
   const level=r.detected_level&&r.detected_level!==r.registered_level?'<div class="semantic-level"><b>المستوى المسجل:</b> '+esc(r.registered_level||'—')+' <span>←</span> <b>المستوى المرجح:</b> '+esc(r.detected_level)+'</div>':'';
   return '<article class="semantic-review '+esc(r.judgment)+'"><div class="proposal-head"><h3>'+esc(r.indicator_text||r.indicator_key||'سؤال مؤشر')+'</h3><span class="status-pill '+(r.judgment==='reject'?'critical':r.judgment==='review'?'warning':'ok')+'">'+esc(semanticJudgmentLabel(r.judgment,r.provider))+'</span></div>'+
     '<div class="semantic-question">'+esc(r.question_text||'')+'</div>'+
     level+'<div class="semantic-dims">'+semanticDimensionSummary(r)+'</div>'+
     options+(reasons?'<ul class="semantic-reasons">'+reasons+'</ul>':'')+suggestion+
     '<div class="semantic-meta">الثقة: '+Math.round(Number(r.confidence||0)*100)+'% · '+esc(r.provider||'rules')+(r.model?' · '+esc(r.model):'')+'</div></article>';
 }).join('');
}
async function loadSemanticStatus(){
 try{
   const d=await callSemanticAudit('status');
   renderSemanticProvider(d.provider||{});
   const job=d.jobs?.[0];if(job)renderSemanticProgress(job);
 }catch(e){
   const badge=$('semanticJudgeBadge');if(badge){badge.className='status-pill warning';badge.textContent='تعذر فحص المحكّم';}
   const note=$('semanticProviderNote');if(note)note.textContent=e.message||String(e);
 }
}
async function runSemanticAudit(scope,subject=''){
 const buttons=[...document.querySelectorAll('[data-semantic-scope]')];
 buttons.forEach(b=>b.disabled=true);
 const host=$('semanticJudgeResult');
 try{
   if(host)host.innerHTML='<div class="empty">جارٍ تجهيز الأسئلة للتحكيم التربوي…</div>';
   let d=await callSemanticAudit('start',{scope,...(subject?{subject}:{})}),job=d.job;
   renderSemanticProvider(d.provider||{});renderSemanticProgress(job);
   let rounds=0;
   while(job?.status==='running'&&rounds<30){
     d=await callSemanticAudit('process',{job_id:job.id});job=d.job;rounds++;
     renderSemanticProvider(d.provider||{});renderSemanticProgress(job);
     await new Promise(r=>setTimeout(r,80));
   }
   const report=await callSemanticAudit('report',{job_id:job.id});
   renderSemanticReport(report);
   if(job.status==='running'){
     const more=document.createElement('button');more.type='button';more.className='btn primary';more.textContent='متابعة التحكيم من حيث توقف';
     more.addEventListener('click',()=>resumeSemanticJob(job.id));$('semanticJudgeResult')?.prepend(more);
   }
   setState(job.status==='provider_required'?'اكتمل التحكيم القاعدي. المحكّم الدلالي العام يحتاج مزود ذكاء متصل.':'اكتمل التحكيم التربوي للنطاق المحدد.','ok');
 }catch(e){
   if(host)host.innerHTML='<div class="empty">'+esc(e.message||String(e))+'</div>';
   setState(e.message||String(e),'error');
 }finally{buttons.forEach(b=>b.disabled=false);}
}
async function resumeSemanticJob(jobId){
 const buttons=[...document.querySelectorAll('[data-semantic-scope]')];buttons.forEach(b=>b.disabled=true);
 try{
  let job={id:jobId,status:'running'},rounds=0;
  while(job.status==='running'&&rounds<30){const d=await callSemanticAudit('process',{job_id:jobId});job=d.job;renderSemanticProvider(d.provider||{});renderSemanticProgress(job);rounds++;await new Promise(r=>setTimeout(r,80));}
  renderSemanticReport(await callSemanticAudit('report',{job_id:jobId}));
 }catch(e){setState(e.message||String(e),'error');}
 finally{buttons.forEach(b=>b.disabled=false);}
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


function renderIndicatorAudit(run){
 const host=$('indicatorAuditResult'),badge=$('indicatorAuditBadge');
 if(!host)return;
 const m=run?.metrics||{},subs=m.subjects||{},tot=m.totals||{};
 const sev=run?.severity||'ok';
 if(badge){badge.className='status-pill '+sev;badge.textContent=sevLabel[sev]||sev;}
 const labels={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
 const subjectCards=['reading','math','science'].map(k=>{
   const x=subs[k]||{};
   return '<div class="indicator-subject-card"><b>'+labels[k]+'</b>'+
     '<span>'+ar(x.indicators||0)+' مؤشر</span>'+
     '<span>'+ar(x.questions||0)+' سؤال</span>'+
     '<span>مؤشرات سليمة آليًا: '+ar(x.clean_indicators||0)+'</span></div>';
 }).join('');
 const findings=(run?.findings||[]).map(f=>'<article class="finding"><span class="dot '+esc(f.severity)+'"></span><div><div class="proposal-head"><h3>'+esc(f.title)+'</h3><span class="status-pill '+esc(f.severity)+'">'+esc(sevLabel[f.severity]||f.severity)+'</span></div><p>'+esc(f.detail)+'</p><p class="safe-action"><b>الإجراء المقترح:</b> '+esc(f.safe_action)+'</p></div></article>').join('');
 host.innerHTML='<div class="indicator-audit-summary">'+
   '<div class="indicator-audit-kpis">'+
     metric('إجمالي المؤشرات',ar(m.total_indicators||0))+
     metric('إجمالي الأسئلة',ar(m.total_questions||0))+
     metric('تسرب ظاهر داخل السؤال',ar(tot.prompt_stem||0))+
     metric('سياقات داخلية مخفية',ar(tot.prompt_context||0))+
     metric('عائلات صياغة متكررة',ar(tot.template_family_groups||0))+
   '</div>'+
   '<div class="indicator-subjects">'+subjectCards+'</div>'+
   '<div class="indicator-audit-note">تم حفظ التفاصيل لكل مؤشر وتسليم التقرير للمساعد. اكتب في المحادثة <b>«راجع تقرير المؤشرات»</b> لأراجعه معك وأبدأ معالجة الأخطاء.</div>'+
   (findings||'<div class="empty">لم يكتشف الفحص الآلي أخطاء بنيوية.</div>')+
 '</div>';
}
function renderGeneratedTestAudit(run){
 const host=$('indicatorAuditResult');if(!host)return;
 const m=run?.metrics||{},tot=m.totals||{};
 const findings=(run?.findings||[]).map(f=>'<article class="finding"><span class="dot '+esc(f.severity)+'"></span><div><div class="proposal-head"><h3>'+esc(f.title)+'</h3><span class="status-pill '+esc(f.severity)+'">'+esc(sevLabel[f.severity]||f.severity)+'</span></div><p>'+esc(f.detail)+'</p><p class="safe-action"><b>الإجراء المقترح:</b> '+esc(f.safe_action)+'</p></div></article>').join('');
 host.insertAdjacentHTML('beforeend','<div class="indicator-audit-summary generated-tests-audit">'+
   '<div class="panel-head"><div><span class="kicker">الاختبارات الفعلية المحفوظة</span><h2>مراجعة النماذج التي أنشأتها المنصة</h2></div><span class="status-pill '+esc(run?.severity||'ok')+'">'+esc(sevLabel[run?.severity]||run?.severity||'سليم')+'</span></div>'+
   '<div class="indicator-audit-kpis">'+
     metric('الاختبارات المحفوظة',ar(m.total_tests||0))+
     metric('الأسئلة داخل الاختبارات',ar(m.total_rendered_questions||0))+
     metric('فجوات المستويات الثلاثة',ar(tot.indicator_level_gaps||0))+
     metric('اختبارات توزيع الإجابة غير متوازن',ar(tot.answer_position_imbalanced_tests||0))+
   '</div>'+
   '<div class="indicator-audit-note">هذا الجزء يراجع <b>الاختبارات التي أنشأتها المنصة نفسها</b>، وليس بنك الأسئلة فقط: توزيع الأسئلة داخل كل اختبار، المعرفة/التطبيق/الاستدلال، التكرار، البدائل، الإجابة الصحيحة، بنية القراءة والصور المفقودة.</div>'+
   (findings||'<div class="empty">لم يكتشف الفحص أخطاء بنيوية في الاختبارات الفعلية.</div>')+
 '</div>');
}
async function runIndicatorAudit(){
 const btn=$('runIndicatorAudit');if(!btn)return;
 btn.disabled=true;
 const badge=$('indicatorAuditBadge'),host=$('indicatorAuditResult');
 if(badge){badge.className='status-pill info';badge.textContent='جارٍ فحص جميع المؤشرات…';}
 host.innerHTML='<div class="empty">يجري الآن أولًا فحص بنك المؤشرات، ثم فحص الاختبارات الفعلية المحفوظة التي أنشأتها المنصة.</div>';
 setState('جارٍ فحص بنك المؤشرات والاختبارات الفعلية وإنشاء تقريرين للمساعد…');
 try{
   const d=await call('indicator_audit');
   renderIndicatorAudit(d.run);
   if(badge){badge.className='status-pill info';badge.textContent='جارٍ فحص الاختبارات الفعلية…';}
   setState('اكتمل فحص بنك المؤشرات. جارٍ الآن مراجعة الاختبارات التي أنشأتها المنصة فعليًا…');
   const t=await callGeneratedTestAudit();
   renderGeneratedTestAudit(t.run);
   const ranks={ok:0,info:1,warning:2,critical:3};
   const finalSev=(ranks[t.run?.severity||'ok']>ranks[d.run?.severity||'ok'])?(t.run?.severity||'ok'):(d.run?.severity||'ok');
   if(badge){badge.className='status-pill '+finalSev;badge.textContent=sevLabel[finalSev]||finalSev;}
   await Promise.all([loadHistory(),loadHandoffs()]);
   setState('اكتمل فحص بنك المؤشرات والاختبارات الفعلية، وتم تسليم التقريرين للمساعد.','ok');
 }catch(e){
   if(badge){badge.className='status-pill critical';badge.textContent='تعذر الفحص';}
   host.innerHTML='<div class="empty">'+esc(e.message||String(e))+'</div>';
   setState(e.message||String(e),'error');
 }finally{btn.disabled=false;}
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


const printTargets={
  question_papers:'review-question-papers.html',
  bubble_sheets:'review-bubble-sheets.html',
  paper_report:'review-report.html'
};
function renderPrintAudit(run){
  latestPrintRun=run||null;
  const host=$('printAuditResult'),btn=$('printPreparePlan'),handoffBtn=$('printHandoff'),badge=$('printAuditBadge');
  const hasIssues=!!run&&(run.findings||[]).length>0;
  if(btn)btn.disabled=!hasIssues;
  if(handoffBtn)handoffBtn.disabled=!hasIssues;
  const sev=run?.severity||'ok';
  if(badge){badge.className='status-pill '+sev;badge.textContent=sevLabel[sev]||sev;}
  const rows=run?.findings||[];
  host.innerHTML=rows.length?rows.map(f=>'<article class="finding"><span class="dot '+esc(f.severity)+'"></span><div><div class="proposal-head"><h3>'+esc(f.title)+'</h3><span class="status-pill '+esc(f.severity)+'">'+esc(sevLabel[f.severity]||f.severity)+'</span></div><p>'+esc(f.detail)+'</p><p class="safe-action"><b>المعالجة المقترحة:</b> '+esc(f.safe_action)+'</p></div></article>').join(''):'<div class="empty">الفحص المرئي لم يكتشف مشكلة تخطيط في القالب الحالي.</div>';
}
async function auditSurface(source,handoffId=''){
  const target=printTargets[source];if(!target)return;
  const host=$('printAuditFrameHost'),result=$('printAuditResult'),badge=$('printAuditBadge');
  document.querySelectorAll('[data-print-audit]').forEach(b=>b.disabled=true);
  if($('printPreparePlan'))$('printPreparePlan').disabled=true;
  if(badge){badge.className='status-pill info';badge.textContent='جارٍ القياس الفعلي…';}
  result.innerHTML='<div class="empty">جارٍ فتح قالب الطباعة وقياس A4 والعناصر داخل الصفحة…</div>';
  host.replaceChildren();
  const iframe=document.createElement('iframe');
  iframe.src=target+'?audit='+Date.now();
  iframe.title='فحص الطباعة';
  iframe.tabIndex=-1;
  host.appendChild(iframe);
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('لم يكتمل تحميل صفحة الطباعة خلال الوقت المحدد.')),22000);
      iframe.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});
    });
    const started=Date.now();
    while(!iframe.contentWindow?.NafesPrintAudit){
      if(Date.now()-started>22000)throw new Error('أداة القياس لم تصبح جاهزة داخل صفحة الطباعة.');
      await new Promise(r=>setTimeout(r,250));
    }
    const audit=await iframe.contentWindow.NafesPrintAudit.run();
    audit.version=iframe.contentWindow.NafesPrintAudit.version||'visual-print-audit-v1';
    const saved=await call('print_audit_ingest',{audit,...(handoffId?{handoff_id:handoffId}:{})});
    renderPrintAudit(saved.run);
    await loadHistory();
    if(saved.handoff){
      await loadHandoffs();
      const verified=saved.handoff.status==='verified';
      setState(verified?'أكد الوكيل نجاح الإصلاح بعد إعادة الفحص.':'ما زالت بعض الأخطاء موجودة بعد الإصلاح؛ أعاد الوكيل الطلب للمراجعة. ',verified?'ok':'error');
    }else setState(saved.run.summary,'ok');
  }catch(e){
    if(badge){badge.className='status-pill warning';badge.textContent='تعذر الفحص';}
    result.innerHTML='<div class="empty">'+esc(e.message||String(e))+'</div>';
  }finally{
    host.replaceChildren();
    document.querySelectorAll('[data-print-audit]').forEach(b=>b.disabled=false);
  }
}


const handoffStatusLabel={
  needs_assistant:'بانتظار معالجة المساعد',
  fix_in_progress:'المساعد يعالج المشكلة',
  fix_ready:'الإصلاح جاهز لإعادة الفحص',
  verified:'تم التحقق من الإصلاح',
  verification_failed:'لم يجتز الإصلاح إعادة الفحص',
  closed:'مغلق'
};
function renderHandoffs(rows){
  allHandoffs=rows||[];
  const host=$('handoffState');if(!host)return;
  if(!allHandoffs.length){host.innerHTML='<div class="empty">لا توجد عمليات تسليم للمساعد حتى الآن.</div>';return;}
  host.innerHTML=allHandoffs.slice(0,6).map(h=>{
    const status=handoffStatusLabel[h.status]||h.status;
    const fix=h.fix||{},verify=h.verification||{};
    const action=h.status==='fix_ready'
      ?'<button type="button" class="btn primary" data-verify-handoff="'+esc(h.id)+'" data-source="'+esc(h.source||'')+'">إعادة الفحص والتحقق</button>'
      :'';
    const note=h.status==='needs_assistant'
      ?'<p>التقرير محفوظ للمساعد. في المحادثة يكفي أن تقول: <b>راجع الوكيل</b>.</p>'
      :h.status==='fix_ready'
        ?'<p>تم تسجيل الإصلاح'+(fix.commit_sha?' عند النسخة '+esc(String(fix.commit_sha).slice(0,8)):'')+'. الوكيل ينتظر إعادة الفحص المرئي.</p>'
        :h.status==='verified'
          ?'<p>نجح الفحص بعد الإصلاح ولم تبق الأخطاء المستهدفة.</p>'
          :h.status==='verification_failed'
            ?'<p>أعاد الوكيل الفحص وما زالت أخطاء مستهدفة موجودة؛ يحتاج الإصلاح جولة أخرى.</p>'
            :'';
    return '<article class="handoff-card"><div class="proposal-head"><h3>'+esc(h.summary||'تسليم صيانة')+'</h3><span class="handoff-pill '+esc(h.status)+'">'+esc(status)+'</span></div>'+note+
      '<div class="handoff-meta"><span>'+esc((h.source_files||[]).join(' · ')||'—')+'</span>'+
      (verify.after_issue_count!==undefined?'<span>بعد الإصلاح: '+ar(verify.after_issue_count)+' ملاحظات</span>':'')+
      '</div>'+action+'</article>';
  }).join('');
}
async function loadHandoffs(){
  const d=await call('handoffs');
  renderHandoffs(d.handoffs||[]);
  return d;
}
async function createPrintHandoff(){
  if(!latestPrintRun)return;
  const btn=$('printHandoff');btn.disabled=true;
  try{
    setState('جارٍ تجهيز تقرير الأخطاء للمساعد…');
    const d=await call('create_handoff',{run_id:latestPrintRun.id});
    await loadHandoffs();
    setState('تم تجهيز التقرير. اكتب لي في المحادثة «راجع الوكيل» وسأقرأه مباشرة وأبدأ الإصلاح.','ok');
  }catch(e){setState(e.message||String(e),'error');}
  finally{btn.disabled=false;}
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
  await Promise.all([loadHistory(),loadBrainOverview(),loadHandoffs(),loadSemanticStatus()]);
 }catch(e){setState(e.message||String(e),'error');}
}
$('runIndicatorAudit')?.addEventListener('click',runIndicatorAudit);
document.querySelectorAll('[data-semantic-scope]').forEach(b=>b.addEventListener('click',()=>runSemanticAudit(b.dataset.semanticScope||'active_tests',b.dataset.semanticSubject||'')));
$('brainForm')?.addEventListener('submit',e=>{e.preventDefault();askBrain($('brainQuestion').value);});
document.querySelectorAll('[data-brain-q]').forEach(b=>b.addEventListener('click',()=>askBrain(b.dataset.brainQ||'')));
$('brainAnswer')?.addEventListener('click',e=>{const b=e.target.closest('[data-brain-followup]');if(b)askBrain((lastBrainQuestion?lastBrainQuestion+' — ':'')+(b.dataset.brainFollowup||''));});

document.querySelectorAll('[data-print-audit]').forEach(b=>b.addEventListener('click',()=>auditSurface(b.dataset.printAudit||'')));
$('printHandoff')?.addEventListener('click',createPrintHandoff);
$('handoffState')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-verify-handoff]');
  if(b)auditSurface(b.dataset.source||'',b.dataset.verifyHandoff||'');
});
$('printPreparePlan')?.addEventListener('click',async()=>{
 if(!latestPrintRun)return;
 const btn=$('printPreparePlan');btn.disabled=true;
 try{
   setState('جارٍ إعداد خطة إصلاح للطباعة دون تنفيذ…');
   const d=await call('prepare_plan',{run_id:latestPrintRun.id});
   renderProposals(d.proposals||[]);
   await loadHistory();
   setState('تم إنشاء خطة إصلاح للطباعة. تحتاج قرارك قبل أي تنفيذ.','ok');
 }catch(e){setState(e.message||String(e),'error');}
 finally{btn.disabled=false;}
});

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