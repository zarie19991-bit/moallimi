(()=>{
'use strict';
const T=window.NafesTeacher,A=window.NafesAnalytics,$=id=>document.getElementById(id);
const N={reading:'القراءة',math:'الرياضيات',science:'العلوم'}, SUBJECTS=['reading','math','science'];
const SETTINGS_KEY='nafes_school_report_settings_v1';
let attempts=[],tests=[],loaded=false,loading=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
const ar=v=>num(v)===null?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v));
const pct=v=>num(v)===null?'—':`${ar(v)}٪`;
function settings(){try{return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:'',...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:''}}}
function submitted(a){return A?.isSubmitted?A.isSubmitted(a):!!(a?.submitted_at||['submitted','completed','finished'].includes(String(a?.status||'').toLowerCase()));}
function ident(a){return A?.studentIdentity?.(a)||String(a?.student_id||a?.student_key||a?.student_no||a?.id||'');}
function when(a){return Date.parse(a?.submitted_at||a?.completed_at||a?.finished_at||a?.started_at||0)||0;}
function testId(a){return String(a?.test_id||a?.assessment_id||a?.exam_id||'').trim();}
function classMatches(a,c){return !c||String(a?.class_name||'').trim()===String(c).trim();}
function normSubject(v){const s=String(v||'').trim().toLowerCase();if(['reading','arabic','language','القراءة','العربية','اللغة العربية'].includes(s))return'reading';if(['math','mathematics','الرياضيات'].includes(s))return'math';if(['science','العلوم'].includes(s))return'science';return'';}
function savedMeasure(a,subject){
 const sections=Array.isArray(a?.section_scores)?a.section_scores:[];
 const sec=sections.find(x=>normSubject(x?.subject||x?.subject_key)===subject);
 if(sec){const score=num(sec.score??sec.correct),total=num(sec.total),percent=num(sec.percent);if(score!==null&&total!==null&&total>0)return{correct:score,total,percent:percent!==null?percent:score/total*100,source:'saved_section'};}
 const subjects=(Array.isArray(a?.subjects)?a.subjects:[]).map(normSubject).filter(Boolean);
 const score=num(a?.score),total=num(a?.total),percent=num(a?.percent);
 if(subjects.length===1&&subjects[0]===subject&&score!==null&&total!==null&&total>0)return{correct:score,total,percent:percent!==null?percent:score/total*100,source:'saved_grade'};
 return null;
}
function measure(a,subject){
 const saved=savedMeasure(a,subject);if(saved)return saved;
 if(A?.measure){const m=A.measure(a,{subject});if(m?.total)return{...m,source:'answer_snapshot'};}
 const qs=(Array.isArray(a?.questions)?a.questions:[]).filter(q=>normSubject(q.subject||q.subject_key)===subject&&typeof q.correct==='boolean');
 const correct=qs.filter(q=>q.correct===true).length;
 return{correct,total:qs.length,percent:qs.length?correct/qs.length*100:null,source:'answer_snapshot'};
}
function latestRecords(id,subject,cls=''){
 const map=new Map();
 for(const a of attempts){if(!submitted(a)||testId(a)!==String(id)||!classMatches(a,cls))continue;const m=measure(a,subject);if(!m.total)continue;const k=ident(a);if(!k)continue;const old=map.get(k);if(!old||when(a)>when(old.a))map.set(k,{a,m});}
 return [...map.values()];
}
function titleOf(id){const t=tests.find(x=>String(x.id||x.test_id||'')===String(id));const a=attempts.find(x=>testId(x)===String(id));return String(t?.title||a?.title||'اختبار نافس');}
function testMeta(id){return tests.find(x=>String(x.id||x.test_id||'')===String(id))||{};}
function testsFor(subject){const g=new Map();for(const a of attempts){if(!submitted(a))continue;const id=testId(a),m=measure(a,subject);if(!id||!m.total)continue;const r=g.get(id)||{id,title:titleOf(id),count:0,time:0};r.count++;r.time=Math.max(r.time,when(a));g.set(id,r);}return [...g.values()].sort((a,b)=>b.time-a.time);}
function mode(xs){const m=new Map();let best=null,n=-1;for(const x of xs){m.set(x,(m.get(x)||0)+1);if(m.get(x)>n){best=x;n=m.get(x)}}return best;}
const LEVELS=[{key:'excellent',label:'ممتاز',range:'٩٠ - ١٠٠'},{key:'verygood',label:'جيد جدًا',range:'٨٠ - أقل من ٩٠'},{key:'good',label:'جيد',range:'٧٠ - أقل من ٨٠'},{key:'pass',label:'مقبول',range:'٥٠ - أقل من ٧٠'},{key:'fail',label:'راسب',range:'أقل من ٥٠'}];
function level(p){return p>=90?'excellent':p>=80?'verygood':p>=70?'good':p>=50?'pass':'fail';}
function logo(src){return src?`<img src="${src}" alt="شعار وزارة التعليم">`:'<div class="sar-logo-fallback">وزارة التعليم</div>';}
function ring(l,c,n){const p=n?c/n*100:0;return `<div class="sar-ring-item"><div class="sar-ring ${l.key}" style="--p:${Math.max(0,Math.min(100,p))}%"><div><b>${l.label}</b><strong>${pct(p)}</strong></div></div></div>`;}
function bar(l,c,max){const h=max?(c/max*100):0;return `<div class="sar-bar-item"><div class="sar-bar-track"><i class="${l.key}" style="--h:${h}%">${c?`<b>${ar(c)}</b>`:''}</i></div><span>${l.label}</span></div>`;}
function sheet(subject,id,cls=''){
 const recs=latestRecords(id,subject,cls);if(!recs.length)return'';
 const scores=recs.map(x=>num(x.m.correct)).filter(x=>x!==null),totals=recs.map(x=>num(x.m.total)).filter(x=>x!==null),vals=recs.map(x=>num(x.m.percent)).filter(x=>x!==null);
 if(!scores.length||!totals.length)return'';
 const n=recs.length,sum=scores.reduce((a,b)=>a+b,0),possible=totals.reduce((a,b)=>a+b,0),achievement=possible?sum/possible*100:null;
 const degree=mode(totals)??Math.max(...totals),highest=Math.max(...scores),lowest=Math.min(...scores),avg=sum/n;
 const counts=Object.fromEntries(LEVELS.map(l=>[l.key,vals.filter(p=>level(p)===l.key).length]));const maxCount=Math.max(1,...Object.values(counts));
 const s=settings(),t=testMeta(id),term=t.term||t.academic_term||t.semester||'—',classLabel=cls||t.class_name||'كل الفصول';
 const rows=LEVELS.map(l=>`<tr><td><span class="sar-level-tag ${l.key}">${l.label}</span></td><td>${l.range}</td><td>${ar(counts[l.key])}</td></tr>`).join('');
 const allSaved=recs.every(x=>String(x.m.source).startsWith('saved_'));
 return `<article class="subject-analysis-sheet official-analysis-sheet" data-grade-source="${allSaved?'saved':'mixed'}">
 <header class="sar-head"><div class="sar-admin"><b>الإدارة العامة للتعليم بمنطقة نجران</b><span>${esc(s.schoolName||'مدرسة /')}</span></div><div class="sar-ministry">${logo(s.ministryLogo)}</div><div class="sar-form-no">١</div></header>
 <h1>تحليل نتائج اختبار مادة [${esc(N[subject])}]</h1>
 <div class="sar-meta"><div><span>المرحلة الدراسية / الصف:</span><b>الثالث المتوسط${classLabel&&classLabel!=='كل الفصول'?` / ${esc(classLabel)}`:''}</b></div><div><span>السنة / الفصل الدراسي:</span><b>${esc(term)}</b></div><div><span>درجة القياس (الاختبار):</span><b>${ar(degree)}</b></div></div>
 <div class="sar-analysis-grid"><section class="sar-stats"><h2>الإحصائيات الأساسية</h2><div class="sar-stat-list">
 <div><span>عدد الطلاب</span><b>${ar(n)}</b></div><div><span>أعلى درجة</span><b>${ar(highest)}</b></div><div><span>أقل درجة</span><b>${ar(lowest)}</b></div><div><span>متوسط الدرجات</span><b>${ar(avg)}</b></div><div><span>نسبة التحصيل</span><b>${pct(achievement)}</b></div><div><span>مجموع الدرجات</span><b>${ar(sum)}</b></div>
 </div></section><section class="sar-achievement"><h2>الإحصائيات التحصيلية</h2><table><thead><tr><th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th></tr></thead><tbody>${rows}</tbody></table></section></div>
 <section class="sar-chart-card"><h2>رسم بياني (نسب الطلاب لكل تقدير)</h2><div class="sar-rings">${LEVELS.map(l=>ring(l,counts[l.key],n)).join('')}</div></section>
 <section class="sar-chart-card"><h2>رسم بياني (عدد الطلاب لكل تقدير)</h2><div class="sar-bars">${LEVELS.map(l=>bar(l,counts[l.key],maxCount)).join('')}</div></section>
 <footer class="sar-signatures"><div><b>معلم/ة المادة:</b><span>${esc(s.teacherName||'')}</span></div><div><b>مدير/ة المدرسة:</b><span>${esc(s.principalName||'')}</span></div></footer></article>`;
}
function addSelect(toolbar,id,label){if($(id))return;const w=document.createElement('label');w.innerHTML=`<span>${label}</span><select id="${id}"><option value="">جارٍ تحميل النتائج…</option></select>`;toolbar.insertBefore(w,toolbar.querySelector('button[id^="print"]')||null);}
function addButton(toolbar,id,text){if($(id))return;const b=document.createElement('button');b.id=id;b.type='button';b.className='btn ghost';b.textContent=text;toolbar.insertBefore(b,toolbar.querySelector('button[id^="print"]')||null);}
function addPreview(viewId,id){if($(id))return;const view=$(viewId),control=view?.querySelector('.section-control-card');if(!view||!control)return;const p=document.createElement('div');p.id=id;p.className='official-analysis-preview';control.insertAdjacentElement('afterend',p);const d=document.createElement('div');d.className='analysis-diagnostic-title';d.innerHTML='<h3>التحليل التشخيصي الإضافي</h3><p>بيانات إضافية للطلاب والمؤشرات والأسئلة، ولا تدخل في طباعة النموذج الرسمي.</p>';p.insertAdjacentElement('afterend',d);}
function install(){const ov=$('overviewView')?.querySelector('.toolbar');if(ov){addSelect(ov,'analysisReadingTest','اختبار القراءة');addSelect(ov,'analysisMathTest','اختبار الرياضيات');addSelect(ov,'analysisScienceTest','اختبار العلوم');addButton(ov,'buildOverviewOfficialBtn','إنشاء التحليل الرسمي');addPreview('overviewView','overviewOfficialPreview');}const sv=$('subjectView')?.querySelector('.toolbar');if(sv){addSelect(sv,'analysisSubjectTest','الاختبار');addButton(sv,'buildSubjectOfficialBtn','إنشاء التحليل الرسمي');addPreview('subjectView','subjectOfficialPreview');}}
function fill(id,subject){const el=$(id);if(!el)return;const rows=testsFor(subject),old=el.value;el.innerHTML=rows.length?rows.map(r=>`<option value="${esc(r.id)}">${esc(r.title)} (${ar(r.count)} نتيجة فعلية)</option>`).join(''):'<option value="">لا توجد نتائج مسلّمة</option>';if(rows.some(r=>r.id===old))el.value=old;}
function populate(){fill('analysisReadingTest','reading');fill('analysisMathTest','math');fill('analysisScienceTest','science');fill('analysisSubjectTest',$('subjectSelect')?.value||'reading');}
function buildOverview(){const cls=$('overviewClass')?.value||'',ids={reading:$('analysisReadingTest')?.value,math:$('analysisMathTest')?.value,science:$('analysisScienceTest')?.value};const html=SUBJECTS.map(s=>ids[s]?sheet(s,ids[s],cls):'').filter(Boolean).join('');const host=$('overviewOfficialPreview');if(host)host.innerHTML=html||'<div class="report-preview-empty">لا توجد نتائج فعلية مسلّمة للاختبارات المختارة.</div>';return html;}
function buildSubject(){const s=$('subjectSelect')?.value||'reading',id=$('analysisSubjectTest')?.value||'',cls=$('subjectClass')?.value||'',html=id?sheet(s,id,cls):'';const host=$('subjectOfficialPreview');if(host)host.innerHTML=html||'<div class="report-preview-empty">اختر اختبارًا لديه نتائج فعلية مسلّمة.</div>';return html;}
function printHtml(html){if(!html)return;const root=$('printRoot');root.innerHTML=html;root.setAttribute('aria-hidden','false');requestAnimationFrame(()=>window.print());}
async function load(){if(loading||!T?.getKey?.())return;loading=true;try{let cursor=0,raw=[],ts=[];do{const d=await T.api('teacher_data',{cursor,limit:100});raw.push(...(d.attempts||[]));if(cursor===0)ts=d.tests||[];cursor=d.next_cursor}while(cursor!==null);attempts=raw.map(x=>A?.normalizeAttempt?A.normalizeAttempt(x):x);tests=ts;loaded=true;populate();}catch(e){console.error('official analysis load',e)}finally{loading=false;}}
function clear(id){const h=$(id);if(h)h.innerHTML='';}
function init(){install();$('subjectSelect')?.addEventListener('change',()=>{if(loaded)fill('analysisSubjectTest',$('subjectSelect').value);clear('subjectOfficialPreview')});$('overviewClass')?.addEventListener('change',()=>clear('overviewOfficialPreview'));$('subjectClass')?.addEventListener('change',()=>clear('subjectOfficialPreview'));['analysisReadingTest','analysisMathTest','analysisScienceTest'].forEach(id=>$(id)?.addEventListener('change',()=>clear('overviewOfficialPreview')));$('analysisSubjectTest')?.addEventListener('change',()=>clear('subjectOfficialPreview'));$('buildOverviewOfficialBtn')?.addEventListener('click',buildOverview);$('buildSubjectOfficialBtn')?.addEventListener('click',buildSubject);$('printOverviewAnalysisBtn')?.addEventListener('click',()=>printHtml(buildOverview()));$('printSubjectAnalysisBtn')?.addEventListener('click',()=>printHtml(buildSubject()));$('refreshBtn')?.addEventListener('click',()=>setTimeout(()=>{loaded=false;load()},100));addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated){loaded=false;load()}});addEventListener('afterprint',()=>{const r=$('printRoot');if(r){r.innerHTML='';r.setAttribute('aria-hidden','true')}});load();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
