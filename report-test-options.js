(()=>{
'use strict';
const T=window.NafesTeacher;
const A=window.NafesAnalytics;
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const keys=['reading','math','science'];
const SETTINGS_KEY='nafes_school_report_settings_v1';
let busy=false;
let allHtml='';

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
function identity(a){return A?.studentIdentity?.(a)||String(a?.student_id||a?.student_name||a?.full_name||a?.id||'');}
function scorable(q){return A?.isScorable?A.isScorable(q):(typeof q?.correct==='boolean'||Number(q?.correct_index??q?.correctIndex)>=0);}
function indKey(q){return A?.indicatorKey?A.indicatorKey(q):(q?.indicator_key||null);}
function ar(v){return v===null||v===undefined||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v));}
function pct(v){return v===null||v===undefined||Number.isNaN(Number(v))?'غير مقاس':`${ar(v)}٪`;}
function mean(v){const a=v.filter(x=>x!==null&&x!==undefined&&Number.isFinite(Number(x))).map(Number);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
function settings(){try{return{schoolName:'',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:'',...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(_){return{schoolName:'',teacherName:'',principalName:'',ministryLogo:'',schoolLogo:''}}}
function logo(src,label){return src?`<img src="${src}" alt="${E(label)}">`:`<span class="wr-logo-empty">${E(label)} غير مرفوع</span>`;}
function bullets(items){return `<ul>${items.map(x=>`<li>${E(x)}</li>`).join('')}</ul>`;}

async function loadData(){
  let cursor=0,rawAttempts=[],tests=[];
  do{
    const d=await T.api('teacher_data',{cursor,limit:100});
    rawAttempts.push(...(d.attempts||[]));
    if(cursor===0)tests=d.tests||[];
    cursor=d.next_cursor;
  }while(cursor!==null);
  return{attempts:rawAttempts.map(normalize),tests};
}

async function refreshReportTests(){
  const select=$('reportTest');
  if(!select||!T?.getKey?.()||busy)return;
  busy=true;
  const keep=select.value;
  try{
    const {attempts,tests}=await loadData();
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
      return{id,title:titleOf(g.latest,t),time:when(g.latest),count:g.count};
    }).sort((a,b)=>b.time-a.time);

    if(rows.length){
      const totalResults=rows.reduce((s,r)=>s+r.count,0);
      select.innerHTML=`<option value="__all__">جميع الاختبارات التي تم أداؤها — ${rows.length} اختبار / ${totalResults} نتيجة</option>`+
        rows.map(r=>`<option value="${E(r.id)}">${E(r.title)} — ${r.count} نتيجة</option>`).join('');
      if(keep==='__all__'||rows.some(r=>r.id===keep))select.value=keep||'__all__';
      else select.value='__all__';
    }else{
      select.innerHTML='<option value="">لا توجد اختبارات مكتملة بنتائج حقيقية</option>';
    }
  }catch(err){
    console.error('تعذر تحميل اختبارات التقرير:',err);
    select.innerHTML='<option value="">تعذر تحميل الاختبارات — اضغط تحديث البيانات</option>';
  }finally{busy=false;}
}

function latestPerStudentPerTest(attempts){
  const map=new Map();
  for(const a of attempts){
    if(!submitted(a))continue;
    const tid=testIdOf(a),sid=identity(a);
    if(!tid||!sid)continue;
    const k=`${tid}::${sid}`;
    const old=map.get(k);
    if(!old||when(a)>when(old))map.set(k,a);
  }
  return[...map.values()];
}

function qList(a){return Array.isArray(a?.questions)?a.questions:[];}
function attemptTotal(a){
  const n=Number(a?.total);
  if(Number.isFinite(n)&&n>0)return n;
  return qList(a).filter(scorable).length;
}
function attemptScore(a){
  const n=Number(a?.score);
  if(Number.isFinite(n))return n;
  return qList(a).filter(q=>scorable(q)&&q.correct===true).length;
}

function mergeStudents(attempts){
  const map=new Map();
  for(const a of attempts){
    const sid=identity(a);if(!sid)continue;
    if(!map.has(sid))map.set(sid,{student_name:a.student_name||a.full_name||'اسم غير مسجل',class_name:a.class_name||'—',score:0,total:0,questions:[],tests:new Set()});
    const s=map.get(sid);
    s.score+=attemptScore(a);
    s.total+=attemptTotal(a);
    s.questions.push(...qList(a));
    s.tests.add(testIdOf(a));
    if((!s.class_name||s.class_name==='—')&&a.class_name)s.class_name=a.class_name;
  }
  return[...map.values()];
}

function measureStudent(st,subject){
  const qs=(st.questions||[]).filter(q=>q.subject===subject&&scorable(q));
  const correct=qs.filter(q=>q.correct===true).length;
  return{correct,total:qs.length,percent:qs.length?correct/qs.length*100:null};
}
function subjectStats(students,subject){
  const ms=students.map(s=>measureStudent(s,subject)).filter(m=>m.total>0);
  return{count:ms.length,avg:mean(ms.map(m=>m.percent)),avgCorrect:mean(ms.map(m=>m.correct)),avgTotal:mean(ms.map(m=>m.total)),mastery:ms.length?ms.filter(m=>m.percent>=80).length/ms.length*100:null};
}
function indicatorStats(students,subject){
  const g=new Map();
  for(const st of students){for(const q of st.questions||[]){if(q.subject!==subject||!scorable(q))continue;const k=indKey(q);if(!k)continue;if(!g.has(k))g.set(k,{text:q.indicator_text||k,c:0,t:0});const x=g.get(k);x.t++;if(q.correct===true)x.c++;}}
  return[...g.values()].map(x=>({...x,percent:x.t?x.c/x.t*100:null})).sort((a,b)=>(a.percent??101)-(b.percent??101));
}
function weakestSubject(st){
  const a=keys.map(k=>({k,m:measureStudent(st,k)})).filter(x=>x.m.total>0).sort((x,y)=>x.m.percent-y.m.percent);
  return a.length?{label:names[a[0].k],percent:a[0].m.percent}:{label:'غير مقاس',percent:null};
}
function weakIndicators(st){
  const out=[];
  for(const subject of keys){
    const g=new Map();
    for(const q of st.questions||[]){if(q.subject!==subject||!scorable(q))continue;const k=indKey(q);if(!k)continue;if(!g.has(k))g.set(k,{text:q.indicator_text||k,c:0,t:0});const x=g.get(k);x.t++;if(q.correct===true)x.c++;}
    for(const x of g.values()){const p=x.t?x.c/x.t*100:null;if(p!==null&&p<50)out.push(x.text);}
  }
  return out.slice(0,3);
}

async function buildAllTestsReport(){
  const preview=$('reportPreview'),btn=$('buildReportBtn');
  if(btn){btn.disabled=true;btn.textContent='جارٍ إنشاء التقرير…';}
  try{
    const {attempts}=await loadData();
    const latest=latestPerStudentPerTest(attempts);
    if(!latest.length){preview.innerHTML='<div class="report-preview-empty">لا توجد نتائج حقيقية مسلّمة.</div>';return;}
    const students=mergeStudents(latest);
    if(!students.length){preview.innerHTML='<div class="report-preview-empty">لا توجد نتائج حقيقية مسلّمة.</div>';return;}

    const testCount=new Set(latest.map(testIdOf).filter(Boolean)).size;
    const s=settings(),week=$('reportWeek')?.value.trim()||'غير محدد';
    const sm=Object.fromEntries(keys.map(k=>[k,subjectStats(students,k)]));
    const inds=Object.fromEntries(keys.map(k=>[k,indicatorStats(students,k)]));
    const overall=students.map(st=>({st,p:st.total>0?st.score/st.total*100:null})).filter(x=>x.p!==null);
    const low=overall.filter(x=>x.p<50).sort((a,b)=>a.p-b.p);
    const measured=keys.map(k=>({k,...sm[k]})).filter(x=>x.count&&x.avg!==null).sort((a,b)=>b.avg-a.avg);
    const best=measured[0],worst=measured[measured.length-1];

    const positives=[];
    if(best)positives.push(`أعلى نسبة تحصيل في ${names[best.k]} وبلغت ${pct(best.avg)}.`);
    const good=measured.filter(x=>(x.mastery??0)>=50);
    if(good.length)positives.push(`ظهرت مستويات إتقان جيدة في ${good.map(x=>names[x.k]).join(' و ')}.`);
    if(!low.length)positives.push('لا يوجد طلاب أقل من 50٪ في جميع الاختبارات المجمعة.');

    const follow=[];
    if(worst)follow.push(`أقل نسبة تحصيل في ${names[worst.k]} وبلغت ${pct(worst.avg)}.`);
    if(low.length)follow.push(`يوجد ${ar(low.length)} طالبًا أقل من 50٪ في النتيجة المجمعة ويحتاجون متابعة مباشرة.`);
    for(const k of keys){if(inds[k][0])follow.push(`المؤشر الأضعف في ${names[k]}: ${inds[k][0].text} (${pct(inds[k][0].percent)}).`);}

    const target=[];
    for(const k of keys){const weak=inds[k].slice(0,2);target.push(weak.length?`${names[k]}: ${weak.map(x=>x.text).join('، ')}`:`${names[k]}: غير مقاس`);}
    const avgAll=mean(overall.map(x=>x.p));
    const progress=[`متوسط نتيجة الطلاب في جميع الاختبارات ${pct(avgAll)}.`,best?`أفضل أداء ظهر في ${names[best.k]}.`:'لا توجد مواد مقاسة.',`عدد الاختبارات المجمعة: ${ar(testCount)}.`];
    const targetStudents=[`عدد الطلاب المقاسين: ${ar(students.length)} طالبًا.`,low.length?`الطلاب الأقل من 50٪ محصورون في الورقة الثانية.`:'لا يوجد طلاب أقل من 50٪.',`التقرير يجمع آخر محاولة مسلّمة لكل طالب في كل اختبار.`];

    const top=`<header class="wr-topbar"><div class="wr-admin"><b>المملكة العربية السعودية</b><br>وزارة التعليم<br>الإدارة العامة للتعليم بمنطقة نجران<br><b>${E(s.schoolName||'')}</b></div><div class="wr-ministry">${logo(s.ministryLogo,'شعار وزارة التعليم')}</div><div class="wr-school">${logo(s.schoolLogo,'شعار المدرسة')}</div></header>`;
    const achievement=keys.map(k=>`<div>نسبة التحصيل في ${names[k]}: ${pct(sm[k].avg)}</div>`).join('');
    const scoreAvgs=keys.map(k=>`<div>متوسط الدرجات في ${names[k]}: ${sm[k].count?`${ar(sm[k].avgCorrect)} من ${ar(sm[k].avgTotal)}`:'غير مقاس'}</div>`).join('');

    const page1=`<article class="weekly-report report-sheet">${top}<div class="wr-title-pill">تقرير نتائج نافس</div><div class="wr-subtitle">تقرير مجمع لجميع الاختبارات التي تم أداؤها<br><b>${E(week)}</b> · ${ar(testCount)} اختبار</div><div class="wr-triple"><section class="wr-info-box"><h3>المهارة المستهدفة</h3>${bullets(target)}</section><section class="wr-info-box"><h3>الطلاب المستهدفون</h3>${bullets(targetStudents)}</section><section class="wr-info-box"><h3>متوسط التقدم</h3>${bullets(progress)}</section></div><div class="wr-two"><section class="wr-callout"><h3>أبرز إيجابيات الاختبارات</h3>${bullets(positives.length?positives:['لا توجد بيانات كافية لإبراز نقطة إيجابية.'])}</section><section class="wr-callout"><h3>نقاط تحتاج متابعة عاجلة</h3>${bullets(follow.length?follow:['لا توجد نقاط متابعة آلية من النتائج الحالية.'])}</section></div><section class="wr-band"><h3>نسبة التحصيل في المواد</h3><div class="wr-band-grid">${achievement}</div></section><section class="wr-band"><h3>متوسط الدرجات</h3><div class="wr-band-grid">${scoreAvgs}</div></section><div class="wr-footer-curve"></div></article>`;

    const lowRows=low.map((x,i)=>{const w=weakestSubject(x.st),wis=weakIndicators(x.st);return`<tr><td>${ar(i+1)}</td><td><b>${E(x.st.student_name)}</b></td><td>${E(x.st.class_name||'—')}</td><td>${ar(x.st.score)} / ${ar(x.st.total)}</td><td>${pct(x.p)}</td><td>${E(w.label)}${w.percent!==null?` (${pct(w.percent)})`:''}</td><td>${E(wis.join('، ')||'لا يوجد مؤشر منخفض محدد')}</td></tr>`;}).join('');
    const page2=`<article class="weekly-report report-sheet">${top}<div class="wr-low-title">حصر الطلاب ذوي الدرجات المتدنية - ${E(week)}</div><table class="wr-low-table"><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الدرجة المجمعة</th><th>النسبة</th><th>أضعف مادة</th><th>أبرز المؤشرات الضعيفة</th></tr></thead><tbody>${lowRows||'<tr><td class="empty" colspan="7">لا يوجد طلاب أقل من 50٪ في جميع الاختبارات المجمعة.</td></tr>'}</tbody></table><div class="wr-signatures"><div class="wr-signature">المدير<span>${E(s.principalName||'—')}</span></div><div class="wr-signature">المعلم<span>${E(s.teacherName||'—')}</span></div></div><div class="wr-footer-curve"></div></article>`;

    allHtml=page1+page2;
    preview.innerHTML=allHtml;
    const p=$('printReportBtn');if(p)p.disabled=false;
  }catch(err){
    preview.innerHTML=`<div class="report-preview-empty">تعذر إنشاء التقرير المجمع: ${E(err?.message||err)}</div>`;
  }finally{
    if(btn){btn.disabled=false;btn.textContent='إنشاء التقرير';}
  }
}

function installAllReportHandlers(){
  const btn=$('buildReportBtn'),print=$('printReportBtn'),select=$('reportTest');
  if(!btn||!print||!select||btn.dataset.allTestsWrapped)return;
  btn.dataset.allTestsWrapped='1';
  const originalBuild=btn.onclick;
  const originalPrint=print.onclick;
  btn.onclick=function(e){
    if(select.value==='__all__')return buildAllTestsReport();
    allHtml='';
    return originalBuild?originalBuild.call(this,e):undefined;
  };
  print.onclick=function(e){
    if(select.value==='__all__'&&allHtml){const root=$('printRoot');root.innerHTML=allHtml;root.setAttribute('aria-hidden','false');window.print();return;}
    return originalPrint?originalPrint.call(this,e):undefined;
  };
}

function schedule(delay=80){setTimeout(()=>{refreshReportTests();installAllReportHandlers();},delay);}
window.addEventListener('load',()=>schedule(250));
window.addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)schedule(250);});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-view="report"]')||e.target.closest('#refreshBtn'))schedule(120);
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installAllReportHandlers,0));else setTimeout(installAllReportHandlers,0);
let timer=0;
const observer=new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(()=>{
    const report=document.getElementById('reportView');
    if(report&&!report.hidden&&T?.getKey?.()){refreshReportTests();installAllReportHandlers();}
  },150);
});
observer.observe(document.documentElement,{subtree:true,childList:true});
})();
