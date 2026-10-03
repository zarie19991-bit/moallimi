(()=>{
'use strict';
const $=id=>document.getElementById(id);
const ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/maintenance-agent';
const TEST_AUDIT_ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/maintenance-test-audit';
const SEMANTIC_AUDIT_ENDPOINT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/maintenance-semantic-audit';
let latestRun=null,latestPrintRun=null,allProposals=[],allHandoffs=[],lastBrainQuestion='',lastCorrection=null,correctionDebounce=null,latestEvaluationReport=null,evaluationSources=[];
const itemQualityState={offset:0,limit:100,count:0,loaded:false};
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
async function runSemanticAudit(scope,subject='',staleOnly=false){
 const buttons=[...document.querySelectorAll('[data-semantic-scope]')];
 buttons.forEach(b=>b.disabled=true);
 const host=$('semanticJudgeResult');
 try{
   if(host)host.innerHTML='<div class="empty">جارٍ تجهيز الأسئلة للتحكيم التربوي…</div>';
   let d=await callSemanticAudit('start',{scope,...(subject?{subject}:{}),stale_only:staleOnly===true}),job=d.job;
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



function pct1(v){return v===null||v===undefined||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v))+'٪';}
function num2(v){return v===null||v===undefined||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(Number(v));}
function subjectLabel(v){return({reading:'القراءة',math:'الرياضيات',science:'العلوم'})[String(v||'')]||String(v||'—');}
function strengthLabel(v){return({excellent:'ممتاز',strong:'قوي',acceptable:'مقبول',weak:'ضعيف'})[String(v||'')]||String(v||'—');}
function cohortLabel(v){return({needs_support:'بحاجة إلى دعم',developing:'متوسط / نامٍ',advanced:'متقدم',unknown:'لا توجد نتائج كافية'})[String(v||'')]||String(v||'—');}
function semanticLabel(v){return({pass:'سليم',review:'مراجعة',reject:'مرفوض',unknown:'غير محكّم'})[String(v||'')]||String(v||'—');}

async function loadEvaluationSources(){
 const sel=$('evaluationSource');if(!sel)return;
 try{
   const d=await call('evaluation_sources');
   evaluationSources=d.sources||[];
   sel.innerHTML=evaluationSources.length?evaluationSources.map(x=>{
     const val=x.source_type+'|'+x.source_id;
     const meta=(x.class_name?x.class_name+' · ':'')+ar(x.attempt_count||0)+' نتيجة';
     return '<option value="'+esc(val)+'">'+esc(x.title||'اختبار')+' — '+esc(meta)+'</option>';
   }).join(''):'<option value="">لا توجد اختبارات متاحة للتحليل</option>';
   $('evaluationState').textContent=evaluationSources.length?'تم تحميل '+ar(evaluationSources.length)+' اختبارًا/مراجعة.':'لا توجد اختبارات محفوظة حاليًا.';
 }catch(e){
   sel.innerHTML='<option value="">تعذر تحميل الاختبارات</option>';
   $('evaluationState').textContent=e.message||String(e);
 }
}
function renderBlueprint(title,data,kind){
 const entries=Object.entries(data||{});
 const labels=kind==='difficulty'?{easy:'سهل',medium:'متوسط',hard:'صعب'}:{knowledge:'معرفة',application:'تطبيق',reasoning:'استدلال'};
 return '<div class="evaluation-blueprint-row"><b>'+esc(title)+'</b><div><div class="evaluation-bars">'+entries.map(([k,v])=>'<i class="'+esc(k)+'" style="width:'+Math.max(0,Number(v)||0)+'%"></i>').join('')+'</div><div class="evaluation-legend">'+entries.map(([k,v])=>'<span>'+esc(labels[k]||k)+' '+ar(v)+'٪</span>').join('')+'</div></div></div>';
}
function standaloneEvaluationHtml(){
 if(!latestEvaluationReport)return'';
 const body=$('evaluationReport')?.innerHTML||'';
 return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير ذكاء التقييم</title><style>body{font-family:Tahoma,Arial,sans-serif;background:#f5f8f7;color:#17324d;padding:24px}*{box-sizing:border-box}.evaluation-report{display:grid;gap:12px;max-width:1200px;margin:auto}.evaluation-report-title{display:flex;justify-content:space-between;gap:12px;padding:14px;border:1px solid #cfe2dc;border-radius:13px;background:linear-gradient(135deg,#edf9f5,#f9fbff)}.evaluation-report-title h3{margin:0;color:#17493e}.evaluation-hero{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.evaluation-kpi,.evaluation-card{border:1px solid #dbe7e4;border-radius:14px;background:#fff;padding:12px}.evaluation-kpi span{display:block;color:#72847f;font-size:11px}.evaluation-kpi b{display:block;margin-top:6px;color:#173f37;font-size:22px}.evaluation-kpi small{display:block;margin-top:6px;color:#899692;font-size:10px}.evaluation-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.evaluation-bars{display:flex;gap:5px;height:12px;border-radius:999px;overflow:hidden;background:#eef3f1}.evaluation-bars i{display:block;height:100%}.easy{background:#55a978}.medium{background:#e0a638}.hard{background:#c86658}.knowledge{background:#5b8dd3}.application{background:#7f63bd}.reasoning{background:#d05a8a}.evaluation-legend{display:flex;gap:8px;flex-wrap:wrap;font-size:10px;color:#758681;margin-top:6px}.evaluation-items{width:100%;border-collapse:collapse;font-size:10px}.evaluation-items th{background:#eff6f4;padding:8px}.evaluation-items td{padding:8px;border-bottom:1px solid #edf2f0}.strength-pill{padding:4px 7px;border-radius:999px;font-weight:700}.excellent{background:#e5f5ec;color:#247047}.strong{background:#e6f1fb;color:#326b9e}.acceptable{background:#fff4da;color:#8d670d}.weak{background:#fdebea;color:#a13e38}.evaluation-rec{border:1px solid #e0e8e6;border-radius:11px;padding:10px;background:#fff;margin:7px 0}.evaluation-note{padding:10px;border-radius:10px;background:#fff8e8;border:1px solid #f0ddb0;color:#795e20}.evaluation-reliability-row{display:flex;justify-content:space-between;padding:8px;background:#f7faf9;border-radius:9px;margin:6px 0}@media print{body{background:#fff;padding:0}.evaluation-report{max-width:none}.evaluation-card,.evaluation-kpi{break-inside:avoid}.evaluation-items{font-size:8.5px}}</style></head><body><main class="evaluation-report">'+body+'</main></body></html>';
}
function renderEvaluationReport(report){
 latestEvaluationReport=report||null;
 const host=$('evaluationReport'),badge=$('evaluationBadge'),htmlBtn=$('exportEvaluationHtml'),pdfBtn=$('printEvaluationPdf');
 if(htmlBtn)htmlBtn.disabled=!report;if(pdfBtn)pdfBtn.disabled=!report;
 if(!report){host.innerHTML='<div class="empty">لم يتم إنشاء تقرير ذكاء تقييم بعد.</div>';return;}
 const s=report.summary||{},omr=report.omr||{},selection=report.selection||{},items=report.items||[],rels=report.reliability?.by_model||[];
 const sampleOk=Number(s.attempts||0)>=Number(report.reliability?.minimum_sample||10);
 const weak=Number(s.weak_items||0);
 if(badge){badge.className='status-pill '+(weak?'warning':'ok');badge.textContent=weak?'يوجد أسئلة تحتاج مراجعة':'جودة الاختبار مستقرة';}
 const krRows=rels.length?rels.map(r=>'<div class="evaluation-reliability-row"><b>النموذج '+esc(r.model||'—')+' · '+ar(r.n||0)+' طالب</b><span>'+(r.kr20===null?'غير متاح':num2(r.kr20))+'</span></div>').join(''):'<div class="evaluation-note">لا توجد بيانات كافية لحساب الثبات.</div>';
 const omrNote=omr.validation_status==='requires_labeled_calibration_sample'
   ?'<div class="evaluation-note">هدف دقة OMR هو 95٪، لكن الدقة الفعلية <b>غير مثبتة إحصائيًا بعد</b>. يلزم عينة مرجعية موسومة. بوابة القبول الآلي الحالية تتطلب ثقة داخلية ≥ '+ar(Math.round(Number(omr.auto_accept_confidence||.95)*100))+'٪.</div>'
   :'<div class="evaluation-note ok">معايرة OMR مكتملة.</div>';
 const rows=items.slice(0,100).map((x,i)=>{
   const da=x.distractor_analysis||{};
   const distractorCell=!da.available
     ?'<span class="metric-na">يحتاج 20 استجابة</span>'
     :'<b>'+ar(da.efficiency||0)+'٪</b><small>'+ar(da.functional_count||0)+' من 3 مشتتات وظيفية'+((da.nonfunctional||[]).length?' · غير وظيفية: '+(da.nonfunctional||[]).map(j=>['أ','ب','ج','د'][Number(j)]||'?').join('، '):'')+'</small>';
   return '<tr>'+
   '<td>'+ar(i+1)+'</td><td>'+esc(subjectLabel(x.subject))+'</td><td>'+esc(String(x.question||'').slice(0,180))+'</td>'+
   '<td>'+(x.facility===null?'<span class="metric-na">عينة ناقصة</span>':pct1(Number(x.facility)*100))+'</td>'+
   '<td>'+(x.discrimination===null?'<span class="metric-na">عينة ناقصة</span>':num2(x.discrimination))+'</td>'+
   '<td>'+distractorCell+'</td>'+
   '<td>'+esc(semanticLabel(x.semantic_judgment))+'</td>'+
   '<td><span class="strength-pill '+esc(x.strength_class)+'">'+ar(x.strength_score)+' · '+esc(strengthLabel(x.strength_class))+'</span></td></tr>';
 }).join('');
 const recs=(report.recommendations||[]).map(r=>'<article class="evaluation-rec '+esc(r.priority||'medium')+'"><span class="prio"></span><div><b>'+esc(r.title)+'</b><p>'+esc(r.detail)+'</p></div></article>').join('');
 host.innerHTML=
   '<div class="evaluation-report-title"><div><h3>'+esc(report.source?.title||'تقرير الاختبار')+'</h3><span>تقرير عملي بدون بيانات شخصية · '+esc(new Date(report.generated_at).toLocaleString('ar-SA'))+'</span></div><span>الإصدار '+esc(report.version||'—')+'</span></div>'+
   '<div class="evaluation-hero">'+
     '<div class="evaluation-kpi"><span>النتائج المعتمدة</span><b>'+ar(s.attempts||0)+'</b><small>'+(sampleOk?'صالحة للتحليل السيكومتري':'أقل من الحد الأدنى لبعض المؤشرات')+'</small></div>'+
     '<div class="evaluation-kpi info"><span>متوسط الأداء</span><b>'+pct1(s.mean_percent)+'</b><small>'+esc(cohortLabel(selection.cohort_level))+'</small></div>'+
     '<div class="evaluation-kpi"><span>متوسط قوة الأسئلة</span><b>'+pct1(s.average_strength)+'</b><small>درجة جودة مركبة</small></div>'+
     '<div class="evaluation-kpi '+(weak?'critical':'')+'"><span>أسئلة ضعيفة</span><b>'+ar(s.weak_items||0)+'</b><small>أقل من 55/100</small></div>'+
     '<div class="evaluation-kpi"><span>أسئلة قوية</span><b>'+ar(s.strong_items||0)+'</b><small>70/100 فأعلى</small></div>'+
     '<div class="evaluation-kpi '+(s.nonfunctional_distractor_items?'warning':'')+'"><span>فاعلية المشتتات</span><b>'+(s.average_distractor_efficiency===null||s.average_distractor_efficiency===undefined?'—':pct1(s.average_distractor_efficiency))+'</b><small>'+ar(s.empirical_distractor_items||0)+' سؤالًا بعينة ميدانية · '+ar(s.nonfunctional_distractor_items||0)+' يحتاج تطويرًا</small></div>'+
     '<div class="evaluation-kpi '+(omr.low_confidence_answers?'warning':'')+'"><span>ثقة OMR</span><b>'+(omr.mean_confidence===null?'—':pct1(Number(omr.mean_confidence)*100))+'</b><small>'+ar(omr.low_confidence_answers||0)+' إجابة منخفضة الثقة</small></div>'+
   '</div>'+
   '<div class="evaluation-grid">'+
     '<section class="evaluation-card"><h3>مخطط الاختيار المتكيف</h3><div class="evaluation-blueprint">'+renderBlueprint('الصعوبة',selection.difficulty_blueprint,'difficulty')+renderBlueprint('المستوى',selection.cognitive_blueprint,'cognitive')+'</div></section>'+
     '<section class="evaluation-card"><h3>ثبات الاختبار KR-20</h3>'+krRows+'</section>'+
   '</div>'+
   '<section class="evaluation-card"><h3>تشخيص أوراق التظليل</h3>'+omrNote+'<div class="evaluation-legend"><span>أوراق ممسوحة: '+ar(omr.scanned_sheets||0)+'</span><span>قبول آلي: '+ar(omr.auto_accepted_sheets||0)+'</span><span>تعديلات يدوية: '+ar(omr.manual_answers||0)+'</span><span>خلايا منخفضة الثقة: '+ar(omr.low_confidence_answers||0)+'</span></div></section>'+
   '<section class="evaluation-card"><h3>قوة الأسئلة — الصعوبة والتمييز وفاعلية المشتتات</h3><div class="evaluation-items-wrap"><table class="evaluation-items"><thead><tr><th>#</th><th>المادة</th><th>السؤال</th><th>معامل السهولة</th><th>التمييز</th><th>المشتتات ميدانيًا</th><th>دلالي</th><th>القوة</th></tr></thead><tbody>'+rows+'</tbody></table></div></section>'+
   '<section class="evaluation-card"><h3>إجراءات عملية</h3><div class="evaluation-recommendations">'+(recs||'<div class="evaluation-note ok">لا توجد إجراءات عاجلة.</div>')+'</div></section>';
 $('evaluationState').textContent='اكتمل التحليل: '+ar(s.question_count||0)+' سؤالًا · '+ar(s.attempts||0)+' نتيجة · '+ar(s.weak_items||0)+' سؤالًا يحتاج مراجعة.';
}
async function runEvaluationIntelligence(){
 const raw=$('evaluationSource')?.value||'';const [source_type,source_id]=raw.split('|');
 if(!source_id){$('evaluationState').textContent='اختر اختبارًا أولًا.';return;}
 const btn=$('runEvaluationIntelligence');btn.disabled=true;
 const badge=$('evaluationBadge');if(badge){badge.className='status-pill info';badge.textContent='جارٍ التحليل…';}
 $('evaluationState').textContent='جارٍ تحليل قوة الأسئلة، الاستجابات، وثقة OMR…';
 try{
   const d=await call('evaluation_report',{source_type,source_id});
   renderEvaluationReport(d.report);
 }catch(e){
   latestEvaluationReport=null;$('exportEvaluationHtml').disabled=true;$('printEvaluationPdf').disabled=true;
   $('evaluationReport').innerHTML='<div class="empty">'+esc(e.message||String(e))+'</div>';
   $('evaluationState').textContent='تعذر إنشاء التقرير.';
   if(badge){badge.className='status-pill warning';badge.textContent='تعذر التحليل';}
 }finally{btn.disabled=false;}
}
function downloadEvaluationHtml(){
 if(!latestEvaluationReport)return;
 const html=standaloneEvaluationHtml(),blob=new Blob([html],{type:'text/html;charset=utf-8'}),a=document.createElement('a');
 a.href=URL.createObjectURL(blob);a.download='تقرير-ذكاء-التقييم-'+Date.now()+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function printEvaluationReport(){
 if(!latestEvaluationReport)return;
 const w=window.open('','_blank','noopener,noreferrer');
 if(!w){alert('اسمح بفتح نافذة الطباعة من المتصفح.');return;}
 w.document.open();w.document.write(standaloneEvaluationHtml());w.document.close();
 setTimeout(()=>{w.focus();w.print();},350);
}


function itemQualityFilters(){
 return{
   subject:$('itemQualitySubject')?.value||'',
   level:$('itemQualityLevel')?.value||'',
   band:$('itemQualityBand')?.value||'',
   semantic_state:$('itemQualitySemantic')?.value||'',
   q:$('itemQualitySearch')?.value?.trim()||''
 };
}
function itemBandLabel(v){return({strong:'قوي',acceptable:'مقبول',review:'يحتاج مراجعة',weak:'ضعيف'})[String(v||'')]||String(v||'—');}
function levelLabel(v){return({knowledge:'معرفة',application:'تطبيق',reasoning:'استدلال'})[String(v||'')]||String(v||'—');}
function renderItemQualitySummary(d){
 const host=$('itemQualitySummary');if(!host)return;
 const m=d?.summary?.math||{},s=d?.summary?.science||{};
 const card=(title,x)=>'<article class="item-summary-card"><h4>'+title+'</h4>'+
   '<div class="item-summary-kpis"><span><b>'+ar(x.total||0)+'</b> سؤال</span><span><b>'+pct1(x.avg_design)+'</b> جودة تصميم</span><span><b>'+pct1(x.avg_distractors)+'</b> جودة مشتتات بنيوية</span></div>'+
   '<div class="item-summary-lines"><span>معرفة '+ar(x.levels?.knowledge||0)+'</span><span>تطبيق '+ar(x.levels?.application||0)+'</span><span>استدلال '+ar(x.levels?.reasoning||0)+'</span><span>تحكيم محدث '+ar(x.current_semantic||0)+'</span><span class="'+((x.needs_fresh_semantic||0)?'warn':'')+'">يحتاج تحكيمًا محدثًا '+ar(x.needs_fresh_semantic||0)+'</span><span>تفاوت أطوال البدائل '+ar(x.flags?.length_imbalance||0)+'</span></div></article>';
 host.innerHTML='<div class="item-summary-grid">'+card('الرياضيات',m)+card('العلوم',s)+'</div>'+
   '<div class="evaluation-note">المقارنة مع أسلوب نافس هنا تقيس البناء: أربعة بدائل، إجابة واحدة، تنوع معرفي، وضوح، وعدم اعتماد مشتتات شكلية. <b>فاعلية المشتت إحصائيًا لا تُثبت إلا من اختيارات الطلاب الفعلية.</b> '+esc(d.evidence_note||'')+'</div>';
}
function flagsText(row){
 const flags=Array.isArray(row?.flags)?row.flags:[];
 const labels=[...new Set(flags.map(x=>x?.label).filter(Boolean))];
 if(!row?.semantic_current&&!labels.some(x=>String(x).includes('التحكيم')))labels.unshift('يحتاج تحكيمًا دلاليًا للنسخة الحالية');
 return labels.slice(0,4).join(' · ')||'لا توجد ملاحظة بنيوية';
}
function renderItemQualityRows(d){
 const body=$('itemQualityBody');if(!body)return;
 const rows=d?.rows||[];
 itemQualityState.count=Number(d?.count||0);itemQualityState.offset=Number(d?.offset||0);itemQualityState.limit=Number(d?.limit||100);itemQualityState.loaded=true;
 body.innerHTML=rows.length?rows.map(r=>'<tr>'+
   '<td>'+esc(subjectLabel(r.subject_key))+'</td>'+
   '<td><b>'+esc(r.indicator_key||'—')+'</b><small>'+esc(String(r.indicator_text||'').slice(0,140))+'</small></td>'+
   '<td>'+esc(String(r.question_text||''))+'</td>'+
   '<td><span class="level-chip">'+esc(levelLabel(r.registered_level))+'</span>'+(r.detected_level&&r.detected_level!==r.registered_level?'<small>مرجح: '+esc(levelLabel(r.detected_level))+'</small>':'')+'</td>'+
   '<td><b>'+ar(r.distractor_score||0)+'/90</b><small>'+(r.semantic_current?'دلالي + بنيوي':'بنيوي فقط')+'</small></td>'+
   '<td><span class="strength-pill '+esc(r.alignment_band||'review')+'">'+ar(r.design_score||0)+'/90 · '+esc(itemBandLabel(r.alignment_band))+'</span></td>'+
   '<td>'+(r.semantic_current?'<span class="audit-current">محدث</span>':'<span class="audit-stale">يحتاج تحديثًا</span>')+'</td>'+
   '<td>'+esc(flagsText(r))+'</td>'+
   '</tr>').join(''):'<tr><td colspan="8">لا توجد أسئلة مطابقة للتصفية الحالية.</td></tr>';
 const from=itemQualityState.count?itemQualityState.offset+1:0,to=Math.min(itemQualityState.count,itemQualityState.offset+itemQualityState.limit);
 $('itemQualityPageState').textContent=ar(from)+'–'+ar(to)+' من '+ar(itemQualityState.count);
 $('itemQualityPrev').disabled=itemQualityState.offset<=0;
 $('itemQualityNext').disabled=itemQualityState.offset+itemQualityState.limit>=itemQualityState.count;
 $('exportItemQualityCsv').disabled=itemQualityState.count===0;
}
async function loadItemQualitySummary(){
 try{const d=await call('item_quality_summary');renderItemQualitySummary(d);return d;}
 catch(e){$('itemQualitySummary').innerHTML='<div class="empty">'+esc(e.message||String(e))+'</div>';throw e;}
}
async function loadItemQualityPage(reset=false){
 if(reset)itemQualityState.offset=0;
 const filters=itemQualityFilters();
 const d=await call('item_quality_page',{...filters,offset:itemQualityState.offset,limit:itemQualityState.limit});
 renderItemQualityRows(d);return d;
}
async function loadItemQualityAudit(){
 const btn=$('loadItemQualityAudit');if(btn)btn.disabled=true;
 try{
   await loadItemQualitySummary();
   await loadItemQualityPage(true);
   setState('اكتمل تحميل التدقيق الشامل لبنك العلوم والرياضيات.','ok');
 }catch(e){setState(e.message||String(e),'error');}
 finally{if(btn)btn.disabled=false;}
}
function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"';}
async function exportItemQualityCsv(){
 const btn=$('exportItemQualityCsv');if(btn){btn.disabled=true;btn.textContent='جارٍ تجهيز CSV…';}
 try{
   const filters=itemQualityFilters(),all=[];let offset=0,count=1;
   while(offset<count){
     const d=await call('item_quality_page',{...filters,offset,limit:250});
     count=Number(d.count||0);all.push(...(d.rows||[]));offset+=Number(d.limit||250);
     if(all.length>10000)break;
   }
   const head=['المادة','المؤشر','نص المؤشر','السؤال','البدائل','الإجابة الصحيحة','المستوى المسجل','المستوى المرجح','حالة المطابقة','الصعوبة','درجة المشتتات من 90','درجة التصميم من 90','الحالة','التحكيم محدث','ملاحظات','دليل التقييم'];
   const rows=[head,...all.map(r=>[
     subjectLabel(r.subject_key),r.indicator_key,r.indicator_text,r.question_text,
     Array.isArray(r.options)?r.options.join(' | '):'',Number(r.correct_index)+1,levelLabel(r.registered_level),levelLabel(r.detected_level),
     r.level_match?'مطابق':'مراجعة',r.difficulty,r.distractor_score,r.design_score,itemBandLabel(r.alignment_band),
     r.semantic_current?'نعم':'لا',flagsText(r),r.evidence_note
   ])];
   const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\n');
   const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
   a.href=URL.createObjectURL(blob);a.download='تدقيق-أسئلة-العلوم-والرياضيات-'+Date.now()+'.csv';a.click();
   setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }catch(e){setState(e.message||String(e),'error');}
 finally{if(btn){btn.disabled=false;btn.textContent='تصدير CSV كامل';}}
}

function correctionModeLabel(v){
 return ({arabic:'نص عربي',instruction:'تعليمات تشغيلية',javascript:'JavaScript',css:'CSS',html:'HTML',sql:'SQL'})[String(v||'')]||String(v||'');
}
function correctionSeverityLabel(v){return({info:'تصحيح تلقائي',warning:'مراجعة',critical:'حرج'})[String(v||'')]||v||'ملاحظة';}
function renderCorrectionResult(result){
 const host=$('correctorResult');if(!host)return;
 const issues=Array.isArray(result?.issues)?result.issues:[];
 const critical=issues.filter(x=>x.severity==='critical').length;
 const warning=issues.filter(x=>x.severity==='warning').length;
 host.innerHTML='<div class="corrector-summary">'+
   '<div><span>تصحيحات تلقائية</span><b>'+ar(result?.auto_fix_count||0)+'</b></div>'+
   '<div><span>تحتاج مراجعة</span><b>'+ar(result?.review_count||0)+'</b></div>'+
   '<div><span>حرجة</span><b>'+ar(critical)+'</b></div>'+
 '</div>'+
 (issues.length?issues.map(x=>'<div class="corrector-issue"><span class="tag '+esc(x.severity||'info')+'">'+esc(correctionSeverityLabel(x.severity))+'</span><div><b>'+esc(x.message||'ملاحظة')+'</b><small>'+esc(x.applied?'طُبق داخل الحقل تلقائيًا.':'لم يُنفذ تلقائيًا؛ يحتاج مراجعة قبل أي تغيير.')+'</small></div></div>').join(''):'<div class="empty">لم يكتشف المصحح أخطاء ضمن القواعد الداخلية الحالية.</div>');
 const badge=$('correctorBadge');
 if(badge){
   badge.className='status-pill '+(critical?'critical':warning?'warning':'ok');
   badge.textContent=critical?'توجد ملاحظات حرجة':warning?'توجد ملاحظات للمراجعة':'التصحيح آمن';
 }
}
function applyCorrectionResult(result,preserveCaret=false){
 const input=$('correctorInput');if(!input||!result)return;
 const before=input.value,after=result.corrected??before;
 if(after===before)return;
 const start=input.selectionStart??after.length,end=input.selectionEnd??after.length,delta=after.length-before.length;
 input.value=after;
 if(preserveCaret){
   const ns=Math.max(0,Math.min(after.length,start+delta)),ne=Math.max(ns,Math.min(after.length,end+delta));
   try{input.setSelectionRange(ns,ne);}catch(_){}
 }
}
async function saveCorrection(result){
 const source=$('correctorSource')?.value?.trim()||'';
 return call('correction_save',{
   mode:result.mode,source_label:source,
   original_text:result.original,corrected_text:result.corrected,
   issues:result.issues,auto_fix_count:result.auto_fix_count,review_count:result.review_count,
   status:'applied'
 });
}
function renderCorrectionHistory(rows){
 const host=$('correctionHistory');if(!host)return;
 if(!rows?.length){host.innerHTML='<div class="empty">لا توجد تصحيحات محفوظة بعد.</div>';return;}
 host.innerHTML=rows.map(r=>{
   const preview=String(r.corrected_text||r.original_text||'').slice(0,260);
   return '<article class="correction-history-item" data-correction-id="'+esc(r.id||'')+'">'+
     '<div class="correction-history-top"><b>'+esc(r.source_label||correctionModeLabel(r.mode))+'</b><span>'+esc(correctionModeLabel(r.mode))+' · '+ar(r.auto_fix_count||0)+' تلقائي · '+ar(r.review_count||0)+' مراجعة</span></div>'+
     '<p>'+esc(preview)+'</p>'+
     '<div class="correction-history-actions"><button type="button" data-reopen-correction>إعادة فتح في المحرر</button></div>'+
   '</article>';
 }).join('');
 host.querySelectorAll('[data-reopen-correction]').forEach(b=>b.addEventListener('click',()=>{
   const row=rows.find(x=>String(x.id)===String(b.closest('[data-correction-id]')?.dataset.correctionId));
   if(!row)return;
   $('correctorMode').value=row.mode||'arabic';$('correctorSource').value=row.source_label||'';
   $('correctorInput').value=row.corrected_text||row.original_text||'';
   lastCorrection={original:row.original_text||'',corrected:row.corrected_text||'',mode:row.mode||'arabic',issues:row.issues||[],auto_fix_count:row.auto_fix_count||0,review_count:row.review_count||0};
   $('undoCorrection').disabled=false;renderCorrectionResult(lastCorrection);$('correctorInput').focus();
 }));
}
async function loadCorrections(){
 try{
   const d=await call('corrections',{limit:20});
   renderCorrectionHistory(d.corrections||[]);
 }catch(e){$('correctionHistory').innerHTML='<div class="empty">'+esc(e.message||String(e))+'</div>';}
}
async function runInternalCorrection({save=true,preserveCaret=false}={}){
 const input=$('correctorInput'),mode=$('correctorMode')?.value||'arabic',engine=window.MoallimiCorrector;
 if(!input||!engine)throw new Error('وحدة التصحيح الداخلي غير جاهزة.');
 const raw=input.value;
 if(!raw.trim()){renderCorrectionResult({issues:[],auto_fix_count:0,review_count:0});return null;}
 const result=engine.analyze(raw,mode);
 lastCorrection=result;
 applyCorrectionResult(result,preserveCaret);
 $('undoCorrection').disabled=false;
 renderCorrectionResult(result);
 if(save){
   const d=await saveCorrection(result);
   await loadCorrections();
   setState('تم التصحيح داخل المنصة وحفظ النتيجة في سجل الحساب الرئيسي.','ok');
   return d;
 }
 return result;
}
function scheduleLiveCorrection(){
 if(!$('correctorLive')?.checked)return;
 const mode=$('correctorMode')?.value||'arabic';
 if(!['arabic','instruction'].includes(mode))return;
 clearTimeout(correctionDebounce);
 correctionDebounce=setTimeout(()=>runInternalCorrection({save:false,preserveCaret:true}).catch(()=>{}),650);
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
  await Promise.all([loadHistory(),loadBrainOverview(),loadHandoffs(),loadSemanticStatus(),loadCorrections(),loadEvaluationSources(),loadItemQualitySummary()]);
 }catch(e){setState(e.message||String(e),'error');}
}
$('runIndicatorAudit')?.addEventListener('click',runIndicatorAudit);
document.querySelectorAll('[data-semantic-scope]').forEach(b=>b.addEventListener('click',()=>runSemanticAudit(b.dataset.semanticScope||'active_tests',b.dataset.semanticSubject||'',b.dataset.semanticStale==='true')));
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

$('loadItemQualityAudit')?.addEventListener('click',loadItemQualityAudit);
$('applyItemQualityFilters')?.addEventListener('click',()=>loadItemQualityPage(true).catch(e=>setState(e.message||String(e),'error')));
$('itemQualityPrev')?.addEventListener('click',()=>{itemQualityState.offset=Math.max(0,itemQualityState.offset-itemQualityState.limit);loadItemQualityPage(false).catch(e=>setState(e.message||String(e),'error'));});
$('itemQualityNext')?.addEventListener('click',()=>{itemQualityState.offset+=itemQualityState.limit;loadItemQualityPage(false).catch(e=>setState(e.message||String(e),'error'));});
$('exportItemQualityCsv')?.addEventListener('click',exportItemQualityCsv);
$('itemQualitySearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadItemQualityPage(true).catch(err=>setState(err.message||String(err),'error'));}});
$('runEvaluationIntelligence')?.addEventListener('click',runEvaluationIntelligence);
$('refreshEvaluationSources')?.addEventListener('click',loadEvaluationSources);
$('exportEvaluationHtml')?.addEventListener('click',downloadEvaluationHtml);
$('printEvaluationPdf')?.addEventListener('click',printEvaluationReport);
$('runCorrection')?.addEventListener('click',async()=>{
 const btn=$('runCorrection');btn.disabled=true;
 try{setState('جارٍ فحص النص أو الأمر داخل المنصة…');await runInternalCorrection({save:true});}
 catch(e){setState(e.message||String(e),'error');}
 finally{btn.disabled=false;}
});
$('undoCorrection')?.addEventListener('click',()=>{
 if(!lastCorrection)return;
 $('correctorInput').value=lastCorrection.original||'';
 $('undoCorrection').disabled=true;
 setState('تم التراجع داخل المحرر فقط. سجل التدقيق السابق بقي محفوظًا.','ok');
});
$('refreshCorrections')?.addEventListener('click',loadCorrections);
$('correctorInput')?.addEventListener('input',scheduleLiveCorrection);
$('correctorMode')?.addEventListener('change',()=>{clearTimeout(correctionDebounce);if($('correctorInput')?.value)runInternalCorrection({save:false}).catch(()=>{});});
window.addEventListener('moallimi:autocorrect',e=>{
 const c=Number(e.detail?.count||0);if(c>0&&$('mainContent')&&!$('mainContent').hidden)setState('صحح محرك الواجهة '+ar(c)+' نصوص عرض آمنة تلقائيًا.','ok');
});
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