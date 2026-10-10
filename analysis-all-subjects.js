(()=>{
'use strict';
const T=window.NafesTeacher,A=window.NafesAnalytics,$=id=>document.getElementById(id);
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'},keys=['reading','math','science'];
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const ar=v=>v===null||v===undefined||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v));
const pct=v=>v===null||v===undefined||Number.isNaN(Number(v))?'غير مقاس':`${ar(v)}٪`;
let attempts=[],tests=[],loading=false,lastSubject='';
const CACHE_KEY='__NAFES_ANALYSIS_DATA_CACHE__',CACHE_TTL=30000;
function submitted(a){return A?.isSubmitted?A.isSubmitted(a):!!(a?.submitted_at||a?.status==='submitted')}
function scorable(q){return A?.isScorable?A.isScorable(q):(typeof q?.correct==='boolean'||Number(q?.correct_index??q?.correctIndex)>=0)}
function identity(a){return A?.studentIdentity?.(a)||String(a?.student_id||a?.student_key||a?.id||'')}
function testId(a){return String(a?.test_id||a?.assessment_id||a?.exam_id||'').trim()}
function when(a){return Date.parse(a?.submitted_at||a?.completed_at||a?.finished_at||a?.started_at||0)||0}
function indKey(q){return A?.indicatorKey?A.indicatorKey(q):(q?.indicator_key||null)}
function subjectOfQ(q){const s=String(q?.subject||q?.subject_key||'').trim().toLowerCase();if(['reading','arabic','القراءة','العربية','اللغة العربية'].includes(s))return'reading';if(['math','mathematics','الرياضيات'].includes(s))return'math';if(['science','العلوم'].includes(s))return'science';return''}
function qList(a){return Array.isArray(a?.questions)?a.questions:[]}
function classMatches(a,c){return !c||String(a?.class_name||'').trim()===c}
function titleOf(id){const t=tests.find(x=>String(x.id||x.test_id||'')===String(id));return String(t?.title||'اختبار نافس')}
function level(p){if(A?.levelFor)return A.levelFor(p);if(p===null||p===undefined)return{key:'unmeasured',label:'غير مقاس'};if(p>=80)return{key:'mastered',label:'متقن'};if(p>=70)return{key:'near',label:'قريب من الإتقان'};if(p>=50)return{key:'support',label:'بحاجة إلى دعم'};return{key:'nonmastered',label:'غير متقن'}}
function badge(p){const l=level(p);return `<span class="badge ${l.key}">${l.label}</span>`}
function mean(v){const a=v.filter(x=>x!==null&&x!==undefined&&Number.isFinite(Number(x))).map(Number);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
function median(v){const a=v.filter(x=>x!==null&&x!==undefined&&Number.isFinite(Number(x))).map(Number).sort((a,b)=>a-b);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function table(headers,rows){return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="muted">لا توجد بيانات حقيقية في هذا النطاق.</td></tr>`}</tbody></table></div>`}
function metrics(students,correct,total){const vals=students.map(s=>s.percent).filter(v=>v!==null);const mastery=vals.length?vals.filter(v=>v>=80).length/vals.length*100:null;const support=vals.filter(v=>v<70).length;return `<div class="metrics"><div class="metric"><span>عدد الطلاب المقاسين</span><b>${ar(vals.length)}</b></div><div class="metric"><span>نسبة التحصيل</span><b>${pct(total?correct/total*100:null)}</b></div><div class="metric"><span>متوسط الطلاب</span><b>${pct(mean(vals))}</b></div><div class="metric"><span>الوسيط</span><b>${pct(median(vals))}</b></div><div class="metric"><span>يحتاجون دعمًا (&lt;70٪)</span><b>${ar(support)}</b></div><div class="metric"><span>نسبة الإتقان</span><b>${pct(mastery)}</b></div></div>`}
function latestPerStudentTest(list){const map=new Map();for(const a of list){if(!submitted(a))continue;const tid=testId(a),sid=identity(a);if(!tid||!sid)continue;const k=`${tid}::${sid}`,old=map.get(k);if(!old||when(a)>when(old))map.set(k,a)}return[...map.values()]}
function buildStudents(list,subjects){const map=new Map();for(const a of list){const sid=identity(a);if(!sid)continue;if(!map.has(sid))map.set(sid,{name:a.student_name||a.full_name||'اسم غير مسجل',className:a.class_name||'—',by:{},correct:0,total:0,questions:[]});const st=map.get(sid);for(const q of qList(a)){const s=subjectOfQ(q);if(!subjects.includes(s)||!scorable(q))continue;if(!st.by[s])st.by[s]={correct:0,total:0};st.by[s].total++;st.total++;if(q.correct===true){st.by[s].correct++;st.correct++}st.questions.push({...q,subject:s})}}
 return[...map.values()].map(st=>{for(const s of subjects)if(st.by[s])st.by[s].percent=st.by[s].total?st.by[s].correct/st.by[s].total*100:null;st.percent=st.total?st.correct/st.total*100:null;return st})}
function aggregateIndicators(students,subjects){const g=new Map();for(const st of students)for(const q of st.questions){if(!subjects.includes(q.subject))continue;const k=indKey(q);if(!k)continue;const id=`${q.subject}:${k}`;if(!g.has(id))g.set(id,{subject:q.subject,text:q.indicator_text||k,c:0,t:0});const x=g.get(id);x.t++;if(q.correct===true)x.c++}return[...g.values()].map(x=>({...x,p:x.t?x.c/x.t*100:null})).sort((a,b)=>(a.p??999)-(b.p??999))}
function aggregateQuestions(students,subjects){const g=new Map();for(const st of students)for(const q of st.questions){if(!subjects.includes(q.subject))continue;const id=`${q.subject}:${q.question_fingerprint||q.id||q.question}`;if(!g.has(id))g.set(id,{subject:q.subject,text:q.question||q.question_text||'—',indicator:q.indicator_text||indKey(q)||'—',w:0,t:0});const x=g.get(id);x.t++;if(q.correct!==true)x.w++}return[...g.values()].map(x=>({...x,p:x.t?x.w/x.t*100:null})).sort((a,b)=>(b.p??-1)-(a.p??-1))}
function setBusy(on,message=''){const btn=$('refreshBtn');document.documentElement.toggleAttribute('data-analysis-loading',on);if(btn){if(on){btn.dataset.oldText=btn.textContent||'تحديث';btn.textContent='جارٍ تحميل النتائج…';btn.disabled=true}else{btn.textContent=btn.dataset.oldText||'تحديث';btn.disabled=false}}const host=document.querySelector('.main-tab.active')?.dataset.view==='subject'?$('subjectSummary'):$('overviewSummary');if(on&&host&&!host.children.length)host.innerHTML=`<div class="section-card" role="status">${E(message||'جارٍ تحميل نتائج الطلاب…')}</div>`}
function showLoadError(error){if($('jointState'))$('jointState').textContent=error?.message||'تعذر تحميل الاختبارات؛ أعد المحاولة.';const host=document.querySelector('.main-tab.active')?.dataset.view==='subject'?$('subjectSummary'):$('overviewSummary');if(host)host.innerHTML=`<section class="section-card" role="alert"><h2>تعذر تحميل التحليل</h2><p class="muted">${E(error?.message||'حدث خطأ أثناء تحميل النتائج.')}</p><p class="muted">يمكنك الضغط على «تحديث» لإعادة المحاولة.</p></section>`}
async function loadAllData(force=false){const existing=window[CACHE_KEY];if(!force&&existing?.data&&Date.now()-existing.at<CACHE_TTL)return existing.data;if(!force&&existing?.promise)return existing.promise;const promise=(async()=>{let cursor=0,all=[],ts=[],page=0;const seen=new Set();do{const cursorKey=String(cursor);if(seen.has(cursorKey))throw new Error('تكرر مؤشر صفحات النتائج؛ أوقف التحميل لحماية الصفحة.');seen.add(cursorKey);const d=await T.api('teacher_data',{cursor,limit:100});all.push(...(d.attempts||[]));if(page===0)ts=d.tests||[];cursor=d.next_cursor;page++;if(page>500)throw new Error('عدد صفحات النتائج أكبر من الحد الآمن للتحميل.');await new Promise(r=>setTimeout(r,0));}while(cursor!==null);const byId=new Map();for(const a of all){const id=String(a?.id||`${a?.source||''}:${a?.test_id||''}:${a?.student_id||''}:${a?.submitted_at||a?.started_at||''}`);const old=byId.get(id);if(!old||when(a)>when(old))byId.set(id,a)}return{attempts:[...byId.values()].map(x=>A?.normalizeAttempt?A.normalizeAttempt(x):x),tests:ts}})();window[CACHE_KEY]={promise,at:Date.now()};try{const data=await promise;window[CACHE_KEY]={data,at:Date.now()};return data}catch(e){delete window[CACHE_KEY];throw e}}
async function refreshData(force=false){if(loading||!T?.getKey?.())return;loading=true;setBusy(true);try{const data=await loadAllData(force);attempts=data.attempts;tests=data.tests;populateSubjectTests(true);populateJointTests();renderCurrent()}catch(e){console.error('analysis multi-test load',e);showLoadError(e)}finally{loading=false;setBusy(false)}}
function ensurePicker(){const toolbar=document.querySelector('#subjectView .toolbar');if(!toolbar||$('subjectTestPicker'))return;const box=document.createElement('section');box.id='subjectTestPicker';box.style.cssText='grid-column:1/-1;border:1px solid #d9e5e7;border-radius:12px;padding:12px;background:#fbfdfd;display:grid;gap:8px';box.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><b>الاختبارات الداخلة في تحليل المادة</b><div><button type="button" class="btn ghost" data-sel-all>تحديد الكل</button> <button type="button" class="btn ghost" data-sel-none>إلغاء التحديد</button></div></div><div id="subjectTestList" style="display:grid;gap:6px"></div><div id="subjectTestSummary" class="muted"></div>';toolbar.appendChild(box);box.addEventListener('click',e=>{if(e.target.closest('[data-sel-all]')){box.querySelectorAll('input[data-analysis-test]').forEach(x=>x.checked=true);renderSubjectMulti()}if(e.target.closest('[data-sel-none]')){box.querySelectorAll('input[data-analysis-test]').forEach(x=>x.checked=false);renderSubjectMulti()}});box.addEventListener('change',e=>{if(e.target.matches('input[data-analysis-test]'))renderSubjectMulti()})}
function testsForSubject(subject){const groups=new Map();for(const a of attempts){if(!submitted(a)||!testId(a))continue;const has=qList(a).some(q=>subjectOfQ(q)===subject&&scorable(q));if(!has)continue;const id=testId(a),g=groups.get(id)||{id,title:titleOf(id),time:0,count:0};g.count++;g.time=Math.max(g.time,when(a));groups.set(id,g)}return[...groups.values()].sort((a,b)=>b.time-a.time)}
function populateSubjectTests(force=false){ensurePicker();const subject=$('subjectSelect')?.value||'all',box=$('subjectTestPicker'),list=$('subjectTestList'),sum=$('subjectTestSummary');if(!box||!list)return;if(subject==='all'){box.style.display='none';lastSubject='all';return}box.style.display='grid';if(!force&&lastSubject===subject&&list.children.length)return;lastSubject=subject;const rows=testsForSubject(subject);list.innerHTML=rows.length?rows.map((r,i)=>`<label style="display:flex;align-items:flex-start;gap:8px"><input type="checkbox" ${i===0?'checked':''} data-analysis-test="${E(r.id)}"><span><b>${E(r.title)}</b><small style="display:block;color:#71858e">${ar(r.count)} نتيجة</small></span></label>`).join(''):'<span class="muted">لا توجد اختبارات مكتملة لهذه المادة.</span>';if(sum)sum.textContent=rows.length?'تم تحديد أحدث اختبار افتراضيًا. يمكنك اختيار اختبارات إضافية عند الحاجة.':'لا توجد اختبارات';}
function selectedSubjectTests(){return new Set([...document.querySelectorAll('#subjectTestPicker input[data-analysis-test]:checked')].map(x=>x.dataset.analysisTest))}
function renderOverviewMulti(){const cls=$('overviewClass')?.value||'';const base=attempts.filter(a=>submitted(a)&&classMatches(a,cls));const latest=latestPerStudentTest(base);const students=buildStudents(latest,keys).sort((a,b)=>(a.percent??999)-(b.percent??999));const correct=students.reduce((s,x)=>s+x.correct,0),total=students.reduce((s,x)=>s+x.total,0);$('overviewSummary').innerHTML=`<section class="section-card"><div class="section-head"><div><h2>التحليل الموحد لجميع الاختبارات</h2><p class="muted">يجمع آخر محاولة لكل طالب في كل اختبار تم أداؤه، ثم يحسب النتيجة من مجموع الإجابات الصحيحة ÷ مجموع الأسئلة المقاسة. كل نتيجة أقل من 70٪ تُعد بحاجة إلى دعم.</p></div></div>${metrics(students,correct,total)}<div class="combined-total"><b>${ar(correct)}</b> إجابة صحيحة من <b>${ar(total)}</b> سؤالًا مقاسًا.</div></section>`;const inds=aggregateIndicators(students,keys);$('overviewStudents').innerHTML=`<section class="section-card"><div class="section-head"><div><h2>مستوى الطلاب — جميع الاختبارات</h2><p class="muted">المادة غير المقاسة تظهر «غير مقاس» ولا تتحول إلى صفر.</p></div></div>${table(['الطالب','الفصل','القراءة','الرياضيات','العلوم','النسبة المجمعة','المستوى'],students.map(st=>[`<b>${E(st.name)}</b>`,E(st.className),pct(st.by.reading?.percent??null),pct(st.by.math?.percent??null),pct(st.by.science?.percent??null),pct(st.percent),badge(st.percent)]))}<div class="section-head" style="margin-top:18px"><div><h2>المؤشرات في جميع المواد</h2><p class="muted">مرتبة من الأقل تحصيلًا إلى الأعلى دون إخفاء مؤشرات.</p></div></div>${table(['المادة','المؤشر','النسبة'],inds.map(x=>[names[x.subject],E(x.text),pct(x.p)]))}</section>`}
function renderSubjectMulti(){const subject=$('subjectSelect')?.value||'all';if(subject==='all'){renderAllSubjects();return}populateSubjectTests();const cls=$('subjectClass')?.value||'',selected=selectedSubjectTests();const base=attempts.filter(a=>submitted(a)&&classMatches(a,cls)&&selected.has(testId(a)));const latest=latestPerStudentTest(base);const students=buildStudents(latest,[subject]).filter(s=>s.total>0).sort((a,b)=>(a.percent??999)-(b.percent??999));const correct=students.reduce((s,x)=>s+x.correct,0),total=students.reduce((s,x)=>s+x.total,0);const selectedCount=selected.size;if($('subjectTestSummary'))$('subjectTestSummary').textContent=`تم تحديد ${ar(selectedCount)} اختبارًا للتحليل.`;$('subjectSummary').innerHTML=metrics(students,correct,total);$('subjectStudents').innerHTML=`<div class="section-head"><div><h2>الطلاب — ${names[subject]}</h2><p class="muted">تُجمع الاختبارات المحددة لكل طالب. كل نتيجة أقل من 70٪ تدخل ضمن الدعم.</p></div></div>${table(['الطالب','الفصل','الصحيح','إجمالي الأسئلة','النسبة','المستوى'],students.map(st=>[`<b>${E(st.name)}</b>`,E(st.className),ar(st.correct),ar(st.total),pct(st.percent),badge(st.percent)]))}`;const inds=aggregateIndicators(students,[subject]);$('subjectIndicators').innerHTML=`<div class="section-head"><div><h2>المؤشرات</h2><p class="muted">محسوبة من جميع الاختبارات المحددة، وتظهر كاملة.</p></div></div>${table(['المؤشر','الصحيح','إجمالي القياسات','النسبة'],inds.map(x=>[E(x.text),ar(x.c),ar(x.t),pct(x.p)]))}`;const qs=aggregateQuestions(students,[subject]),shownQs=qs.slice(0,200),moreQs=Math.max(0,qs.length-shownQs.length);$('subjectQuestions').innerHTML=`<div class="section-head"><div><h2>تحليل الأسئلة</h2><p class="muted">الأسئلة الأعلى في نسبة الخطأ من الاختبارات المحددة. ${moreQs?`يُعرض أول 200 سؤال من أصل ${ar(qs.length)} لحماية سرعة الصفحة.`:''}</p></div></div>${table(['السؤال','المؤشر','عدد المقاسين','الإجابات الخاطئة','نسبة الخطأ'],shownQs.map(x=>[E(x.text),E(x.indicator),ar(x.t),ar(x.w),pct(x.p)]))}`}
function renderAllSubjects(){const box=$('subjectTestPicker');if(box)box.style.display='none';const cls=$('subjectClass')?.value||'';const latest=latestPerStudentTest(attempts.filter(a=>submitted(a)&&classMatches(a,cls)));const students=buildStudents(latest,keys).sort((a,b)=>(a.percent??999)-(b.percent??999));const correct=students.reduce((s,x)=>s+x.correct,0),total=students.reduce((s,x)=>s+x.total,0);$('subjectSummary').innerHTML=metrics(students,correct,total);$('subjectStudents').innerHTML=`<div class="section-head"><div><h2>الطلاب — جميع المواد</h2><p class="muted">نتيجة موحدة من جميع الاختبارات الحقيقية لكل طالب.</p></div></div>${table(['الطالب','الفصل','الصحيح','إجمالي الأسئلة','النسبة','المستوى'],students.map(st=>[`<b>${E(st.name)}</b>`,E(st.className),ar(st.correct),ar(st.total),pct(st.percent),badge(st.percent)]))}`;const inds=aggregateIndicators(students,keys);$('subjectIndicators').innerHTML=`<div class="section-head"><div><h2>المؤشرات الأضعف</h2></div></div>${table(['المادة','المؤشر','النسبة'],inds.map(x=>[names[x.subject],E(x.text),pct(x.p)]))}`;const qs=aggregateQuestions(students,keys),shownQs=qs.slice(0,200),moreQs=Math.max(0,qs.length-shownQs.length);$('subjectQuestions').innerHTML=`<div class="section-head"><div><h2>الأسئلة الأعلى خطأ</h2>${moreQs?`<p class="muted">يُعرض أول 200 سؤال من أصل ${ar(qs.length)} لحماية سرعة الصفحة.</p>`:''}</div></div>${table(['المادة','السؤال','المؤشر','نسبة الخطأ'],shownQs.map(x=>[names[x.subject],E(x.text),E(x.indicator),pct(x.p)]))}`}

// Joint tests are selected by test ID; participants remain visible without scores.
let jointRows=[],jointSubjects=[];
function jointCatalog(){
 const map=new Map();
 function add(item,id){
  if(!id||item?.kind==='simulation'||item?.source==='simulation')return;
  const g=map.get(id)||{id,title:item.title||titleOf(id),subjects:new Set(),time:0,code:item.short_code||''};
  const sections=item.config?.sections||item.sections||[];
  for(const value of [...(item.subjects||[]),...qList(item).map(q=>q.subject||q.subject_key),...sections.map(q=>q.subject)]){
   const subject=subjectOfQ({subject:value});if(subject)g.subjects.add(subject);
  }
  g.time=Math.max(g.time,when(item),Date.parse(item.created_at||'')||0);map.set(id,g);
 }
 for(const t of tests)add(t,String(t.id||t.test_id||''));
 for(const a of attempts)add(a,testId(a));
 return [...map.values()].filter(t=>t.subjects.size>1).sort((a,b)=>b.time-a.time||a.title.localeCompare(b.title,'ar'));
}
function populateJointTests(){
 const select=$('jointTest');if(!select)return;
 const old=select.value,rows=jointCatalog();
 select.innerHTML=rows.length?rows.map(t=>`<option value="${E(t.id)}">${E(t.title)} — ${E([...t.subjects].map(s=>names[s]).join('، '))}</option>`).join(''):'<option value="">لا توجد اختبارات مشتركة متاحة لهذا الحساب</option>';
 if(rows.some(t=>t.id===old))select.value=old;
 populateJointClasses();
}
function populateJointClasses(){
 const sel=$('jointClass'),old=sel.value;
 const classes=[...new Set(attempts.filter(a=>testId(a)===$('jointTest').value).map(a=>a.class_name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
 sel.innerHTML='<option value="">جميع الفصول</option>'+classes.map(c=>`<option value="${E(c)}">${E(c)}</option>`).join('');
 if(classes.includes(old))sel.value=old;
 renderJoint();
}
function renderJoint(){
 if(!$('jointResults'))return;
 const id=$('jointTest').value,test=jointCatalog().find(t=>t.id===id),cls=$('jointClass').value;
 jointRows=[];jointSubjects=[];$('jointExport').disabled=true;
 if(!test){$('jointResults').innerHTML='';$('jointState').textContent=loading?'جارٍ تحميل الاختبارات…':'لا توجد اختبارات مشتركة متاحة ضمن صلاحيات هذا الحساب.';return;}
 const scope=T.getScope?.()||'all';jointSubjects=keys.filter(s=>test.subjects.has(s)&&(scope==='all'||scope===s));
 const pool=attempts.filter(a=>testId(a)===id&&classMatches(a,cls)&&a.is_demo!==true);
 const grouped=new Map();for(const a of pool){const sid=identity(a);if(!grouped.has(sid))grouped.set(sid,[]);grouped.get(sid).push(a);}
 for(const history of grouped.values()){
  // A subsequent unfinished retry must not erase a submitted result.
  const done=history.filter(submitted).sort((a,b)=>when(b)-when(a));
  const a=done[0]||history.slice().sort((a,b)=>when(b)-when(a))[0];
  const reliable=submitted(a)&&A.isAnalyzable(a);
  const normalized={...a,questions:qList(a).map(q=>({...q,subject:subjectOfQ(q)}))};
  const by=Object.fromEntries(jointSubjects.map(s=>[s,A.measure(normalized,{subject:s})]));
  const m=A.measure(normalized);
  const complete=reliable&&m.total>0&&m.excluded===0;
  jointRows.push({a,by,m,complete,status:a.recovery_pending?'بانتظار الاستكمال':!submitted(a)?(a.status==='expired'?'انتهت دون تسليم':'لم يسلّم'):!reliable||!m.total?'مسلّم — يحتاج مراجعة':m.excluded?'مسلّم — تحليل جزئي':a.completion_reason==='time_expired'?'انتهى الوقت — راجع اكتمال المواد':'مسلّم'});
 }
 jointRows.sort((a,b)=>(a.a.student_name||'').localeCompare(b.a.student_name||'','ar'));
 const completed=jointRows.filter(r=>submitted(r.a)).length;
 $('jointState').textContent=`${completed} طالبًا سلّموا الاختبار · ${jointRows.length-completed} دون تسليم. تعرض آخر محاولة مسلّمة لكل طالب.`+(scope!=='all'?' يعرض حسابك تحليل مادتك فقط.':'');
 const degree=m=>m.total?`${ar(m.correct)} / ${ar(m.total)} (${pct(m.percent)})`:'غير مقاس';
 let html=`<section class="card"><h2>${E(test.title)}</h2><h3>الطلاب المشاركون</h3>${table(['الطالب','الفصل','الحالة',...jointSubjects.map(s=>names[s]),scope==='all'?'الإجمالي':'إجمالي المادة المتاحة','الاستكمال'],jointRows.map(r=>[E(r.a.student_name),E(r.a.class_name||'—'),E(r.status),...jointSubjects.map(s=>degree(r.by[s])),r.complete?degree(r.m):'غير مكتمل القياس',r.a.recovery_pending?'بانتظار دخول الطالب':scope==='all'&&submitted(r.a)&&r.a.questions.some(q=>q.answer===null||q.answer===undefined)?`<button class="btn ghost" type="button" data-joint-reopen="${E(r.a.id)}">إعادة فتح للاستكمال</button>`:'—']))}</section>`;
 const scored=jointRows.filter(r=>submitted(r.a)&&A.isAnalyzable(r.a)).map(r=>({...r.a,questions:qList(r.a).map(q=>({...q,subject:subjectOfQ(q)}))}));
 const students=buildStudents(scored,jointSubjects);
 for(const subject of jointSubjects){
  const inds=aggregateIndicators(students,[subject]),qs=aggregateQuestions(students,[subject]);
  const measures=jointRows.map(r=>r.by[subject]).filter(m=>m.total);
  const total=measures.reduce((n,m)=>n+m.total,0),correct=measures.reduce((n,m)=>n+m.correct,0);
  html+=`<section class="card"><h3>تحليل ${names[subject]}</h3><button type="button" class="btn primary" data-joint-report="${subject}">التقرير الرسمي والطباعة — ${names[subject]}</button><p>${ar(measures.length)} طالبًا مقاسًا · نسبة الإجابات الصحيحة ${pct(total?correct/total*100:null)}</p><h4>المؤشرات</h4>${table(['المؤشر','الصحيح','الأسئلة المقاسة','النسبة'],inds.map(x=>[E(x.text),ar(x.c),ar(x.t),pct(x.p)]))}<details><summary>تحليل الأسئلة (${ar(qs.length)})</summary>${table(['السؤال','المؤشر','عدد المقاسين','نسبة الخطأ'],qs.map(x=>[E(x.text),E(x.indicator),ar(x.t),pct(x.p)]))}</details></section>`;
 }
 $('jointResults').innerHTML=html;$('jointExport').disabled=!jointRows.length;
}
async function jointAction(event){
 const report=event.target.closest('[data-joint-report]');
 if(report){
  try{await window.NafesSubjectReport.open({subject:report.dataset.jointReport,testId:$('jointTest').value,className:$('jointClass').value});}
  catch(e){$('jointState').textContent=e.message||'تعذر فتح التقرير. حدّث البيانات.';}
  return;
 }
 const button=event.target.closest('[data-joint-reopen]');if(!button)return;
 const row=jointRows.find(r=>r.a.id===button.dataset.jointReopen),test=jointCatalog().find(t=>t.id===$('jointTest').value);
 if(!row||!test)return;
 if(!confirm(`إعادة فتح محاولة ${row.a.student_name} للاستكمال؟ ستبقى الإجابات السابقة محفوظة، وتبدأ المهلة الجديدة عند دخوله. تُحفظ الدرجة السابقة في سجل المراجعة ويُعاد احتساب النتيجة بعد التسليم.`))return;
 button.disabled=true;
 try{await T.api('teacher_attempt_reopen_incomplete',{attempt_id:row.a.id,test_id:test.id,code:test.code});T.clearReadCache?.();delete window[CACHE_KEY];await refreshData(true);$('jointState').textContent+=' تم السماح للطالب بالاستكمال من رابط الاختبار نفسه.';}
 catch(e){$('jointState').textContent=e.message||'تعذر إعادة فتح المحاولة.';button.disabled=false;}
}
function exportJoint(){
 if(!jointRows.length)return;
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
 const degree=m=>m.total?`${m.correct}/${m.total}`:'غير مقاس';
 const rows=[['الطالب','الفصل','الحالة',...jointSubjects.map(s=>names[s]),'الإجمالي'],...jointRows.map(r=>[r.a.student_name,r.a.class_name,r.status,...jointSubjects.map(s=>degree(r.by[s])),r.complete?degree(r.m):'غير مكتمل القياس'])];
 const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='كشف-طلاب-الاختبار-المشترك.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function renderCurrent(){const active=document.querySelector('.main-tab.active')?.dataset.view;if(active==='joint')renderJoint();if(active==='overview')renderOverviewMulti();if(active==='subject')renderSubjectMulti()}
function install(){$('jointResults')?.addEventListener('click',jointAction);$('jointTest')?.addEventListener('change',populateJointClasses);$('jointClass')?.addEventListener('change',renderJoint);$('jointExport')?.addEventListener('click',exportJoint);$('jointRefresh')?.addEventListener('click',()=>{T.clearReadCache?.();refreshData(true)});ensurePicker();$('overviewClass')?.addEventListener('change',()=>setTimeout(renderOverviewMulti,0));$('subjectSelect')?.addEventListener('change',()=>{populateSubjectTests(true);setTimeout(renderSubjectMulti,0)});$('subjectClass')?.addEventListener('change',()=>setTimeout(renderSubjectMulti,0));document.querySelectorAll('.main-tab').forEach(b=>b.addEventListener('click',()=>setTimeout(renderCurrent,40)));$('refreshBtn')?.addEventListener('click',()=>setTimeout(()=>refreshData(true),80));addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)setTimeout(()=>refreshData(false),40)});if(T?.getKey?.())refreshData(false)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();