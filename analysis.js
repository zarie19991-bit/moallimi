(()=>{
'use strict';const A=window.NafesAnalytics,$=id=>document.getElementById(id),E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=x=>x===null||x===undefined?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(x),pct=x=>x===null||x===undefined?'غير مقاس':num(x)+'٪',date=x=>x?new Date(x).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'}):'—',names={reading:'القراءة',math:'الرياضيات',science:'العلوم'},kinds={indicator:'اختبارات المؤشرات',multi_indicator:'اختبارات متعددة المؤشرات',simulation:'الاختبارات المحاكية'};
let attempts=[],tests=[],indicators=[],view=new URLSearchParams(location.search).get('view')==='followup'?'followup':'overview',currentReport=null,printContent='',loading=false,detail=null;
const table=(heads,rows)=>`<div class="table-wrap"><table class="print-table"><thead><tr>${heads.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(x=>`<tr>${x.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}">لا توجد نتائج في هذا النطاق.</td></tr>`}</tbody></table></div>`;
const badge=p=>`<span class="badge ${A.levelFor(p).key}">${A.levelFor(p).label}</span>`;
const delta=t=>!t?'لا تتوفر مقارنة':`${t.direction==='up'?'تحسّن':t.direction==='down'?'تراجع':'ثبات'}${t.delta?' '+num(Math.abs(t.delta))+' نقطة مئوية':''}`;
const linkStudent=r=>`<button type="button" class="text-button" data-student="${E(r.key)}">${E(r.student.student_name)}</button>`;
function filters(){return{subject:$('subjectFilter').value,className:$('classFilter').value,test:$('testFilter').value,indicator:$('indicatorFilter').value,level:$('levelFilter').value,trend:$('trendFilter').value,followup:$('followupFilter').value,search:$('studentSearch').value};}
function metric(label,value,note=''){return`<div class="metric"><span>${E(label)}</span><strong>${value}</strong><small>${E(note)}</small></div>`;}
function distribution(levels){const max=Math.max(1,...levels.map(l=>l.count));return`<div class="distribution">${levels.map(l=>`<div class="distribution-row ${l.key}"><span>${l.label}</span><div class="bar-track"><i style="width:${l.count/max*100}%"></i></div><b>${num(l.count)}</b></div>`).join('')}</div>`;}
function chart(history){const hs=history.filter(a=>A.isAnalyzable(a)&&A.savedPercent(a)!==null).sort(A.compareTime);if(!hs.length)return'<p class="muted">لا توجد درجات صالحة للرسم بعد.</p>';const width=800,height=240,pad=45,x=i=>pad+(hs.length===1? (width-pad*2)/2:i*(width-pad*2)/(hs.length-1)),y=p=>height-pad-p*(height-pad*2)/100;return`<svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="تطور الدرجات حسب تاريخ المحاولة">${[0,25,50,75,100].map(p=>`<line x1="${pad}" x2="${width-pad}" y1="${y(p)}" y2="${y(p)}" stroke="#dce6e0"/><text x="${pad-8}" y="${y(p)+4}" text-anchor="end" font-size="12">${num(p)}</text>`).join('')}<polyline points="${hs.map((a,i)=>`${x(i)},${y(A.savedPercent(a))}`).join(' ')}" fill="none" stroke="#117564" stroke-width="3"/>${hs.map((a,i)=>`<circle cx="${x(i)}" cy="${y(A.savedPercent(a))}" r="5" fill="#117564"><title>${E(a.title)} · ${E(date(a.submitted_at))} · ${pct(A.savedPercent(a))}</title></circle>${hs.length<=12?`<text x="${x(i)}" y="${height-10}" text-anchor="middle" font-size="11">${num(i+1)}</text>`:''}`).join('')}</svg><p class="chart-caption">الترتيب الزمني من اليسار إلى اليمين. اختلاف الأسئلة والمؤشرات قد يؤثر في الدرجة؛ تقدير التحسن يعتمد على المؤشرات المشتركة.</p>`;}
function rowsTable(rows,followup=false){return table(followup?['اسم الطالب','الفصل','الاختبارات','آخر درجة','المتوسط','مستواه في آخر قياس','التغيّر','أضعف مؤشر','الحالة']:['اسم الطالب','الفصل','الدرجة','النسبة','المستوى','الصحيح / الخطأ','المؤشرات المتقنة / غير المتقنة','التغيّر'],rows.map(r=>{const saved=r.latest?`${num(r.latest.score)} من ${num(r.latest.total)}`:'لم يسلم',skills=r.skills.filter(s=>s.latest),strong=skills.filter(s=>s.latest.percent>=80),weak=skills.filter(s=>s.latest.percent<80),worst=skills.slice().sort((a,b)=>a.latest.percent-b.latest.percent)[0];const avg=A.mean(r.history.filter(A.isAnalyzable).map(A.savedPercent));return followup?[linkStudent(r),E(r.student.class_name)||'غير مسجل',num(r.history.filter(A.isSubmitted).length),saved,pct(avg),badge(r.measured.percent),delta(r.trend),E(worst?.latest.text||'غير مقاس'),r.repeated.length?'يحتاج متابعة في '+num(r.repeated.length)+' مؤشر':r.resolved.length?'تحسّن بعد دعم متكرر':'دون تنبيه متكرر']:[linkStudent(r),E(r.student.class_name)||'غير مسجل',saved,r.latest?pct(A.savedPercent(r.latest)):'—',badge(r.measured.percent),r.measured.total?`صحيح: ${num(r.measured.correct)} · خطأ: ${num(r.measured.total-r.measured.correct)}`:'—',`<details><summary>متقن: ${num(strong.length)} · دون الإتقان: ${num(weak.length)}</summary>${skills.map(s=>`<p>${E(s.latest.text)} · ${pct(s.latest.percent)} · ${A.levelFor(s.latest.percent).label}</p>`).join('')}</details>`,delta(r.trend)];}));}
function skillTable(groups,sourceAttempts){return table(['المؤشر','متوسط الأداء','نسبة الطلاب المتقنين','متقن / غير متقن','الطلاب دون الإتقان'],groups.map(g=>{const measured=A.studentRows(sourceAttempts,{indicator:g.key});const low=measured.filter(r=>r.measured.percent!==null&&r.measured.percent<80);return[E(g.text),pct(g.percent),pct(g.masteryRate),g.measuredStudents?`متقن: ${num(g.mastered)} · دون الإتقان: ${num(g.measuredStudents-g.mastered)}`:'لم يُقَس',low.map(linkStudent).join('، ')||'—'];}));}
function questionTable(groups){return table(['السؤال','المؤشر','أخطأ / قيس','نسبة الإخفاق'],groups.filter(g=>g.measured).map(g=>[E(g.question),`<span title="${E(g.indicator_text)}">${names[g.subject]||''} — المؤشر ${num(indicators.filter(i=>i.subject===g.subject).findIndex(i=>i.key===g.indicator_key)+1)}</span>`,`${num(g.wrong)} من ${num(g.measured)}`,pct(g.failureRate)]));}
function examHtml(report,test){const s=report.summary,measured=report.indicators.filter(g=>g.measuredStudents),weak=measured[0],strong=measured.at(-1),mastered=s.levels.find(x=>x.key==='mastered').count;const title=test?.title||'تحليل نتائج الطلاب';return`<section class="card"><h2>${E(title)}</h2>${test?`<p>${(test.subjects||[]).map(x=>names[x]).join(' · ')} · ${E(test.class_name||'الفصل غير مسجل')} · الدرجة الكلية: ${num(test.total)}</p>`:''}<div class="summary-grid">${metric('الطلاب الذين سلموا',num(s.submitted))}${metric('أعلى نسبة',pct(s.highest),test?.total&&s.highest!==null?'الدرجة: '+num(s.highest*test.total/100)+' من '+num(test.total):'')}${metric('أقل نسبة',pct(s.lowest),test?.total&&s.lowest!==null?'الدرجة: '+num(s.lowest*test.total/100)+' من '+num(test.total):'')}${metric('متوسط النسب',pct(s.average),test?.total&&s.average!==null?'متوسط الدرجات: '+num(s.average*test.total/100):'')}${metric('نسبة الإتقان',s.measured?pct(mastered/s.measured*100):'غير مقاس','٨٠٪ فأكثر')}${metric('متقن / دون الإتقان',`${num(mastered)} متقن · ${num(s.measured-mastered)} دون الإتقان`)}</div><p class="muted">محاولات جارية: ${num(s.active)} · انتهى وقتها دون تسليم: ${num(s.expired)}. يؤخذ آخر تسليم لكل طالب في الاختبار، وتحفظ جميع المحاولات في ملفه.</p><div class="two-columns"><section><h3>توزيع مستويات الطلاب</h3>${distribution(s.levels)}</section><section><h3>تحليل المؤشرات</h3><p>أقوى مؤشر: ${E(strong?.text||'غير مقاس')} ${strong?pct(strong.percent):''}</p><p>أضعف مؤشر: ${E(weak?.text||'غير مقاس')} ${weak?pct(weak.percent):''}</p></section></div><h3>نتائج الطلاب</h3>${rowsTable(report.rows)}<h3>تحليل المؤشرات المقاسة</h3>${skillTable(measured,report.attempts)}<h3>الأسئلة الأكثر إخفاقًا</h3>${questionTable(report.questions)}</section>`;}
function render(){if(!attempts.length&&!tests.length)return;detail=null;$('detailPanel').hidden=true;$('dashboard').hidden=false;const f=filters(),report=A.report(attempts,indicators,f);currentReport=report;const test=tests.find(t=>t.id===f.test);$('reportTitle').textContent=test?test.title:view==='followup'?'متابعة الطلاب':'تحليل نتائج الطلاب';$('reportScope').textContent=`${num(report.rows.length)} طالبًا · ${num(report.attempts.length)} محاولة محفوظة. ${f.subject?names[f.subject]:'جميع المواد'}`;$('qualityNotice').innerHTML=report.attempts.some(a=>a.snapshot_warning)?'<div class="notice danger">توجد محاولة تاريخية بمفتاح تصحيح غير صالح. تظهر درجتها القديمة في السجل وتستبعد من حساب المستوى والتحسن.</div>':'';
 for(const id of ['overview','students','followup','tests'])$(id+'View').hidden=view!==id;
 $('overviewView').innerHTML=examHtml(report,test);$('studentsView').innerHTML=`<section class="card"><h2>ملفات الطلاب</h2>${rowsTable(report.rows)}</section>`;$('followupView').innerHTML=`<section class="card"><h2>متابعة الطلاب</h2>${rowsTable(report.rows,true)}</section>`;
 const visibleTests=f.test?tests.filter(t=>t.id===f.test):tests.filter(t=>report.attempts.some(a=>a.test_id===t.id));$('testsView').innerHTML=`<section class="card"><h2>الاختبارات ذات المحاولات المسجلة</h2><p>يمكن اختيار أي اختبار، بما في ذلك الاختبار الذي لم يدخله طلاب بعد، من مرشح الاختبار أعلاه.</p>${table(['الاختبار','النوع','الطلاب','التحليل'],visibleTests.map(t=>[E(t.title),kinds[t.kind],num(new Set(report.attempts.filter(a=>a.test_id===t.id).map(a=>a.studentIdentity)).size),`<button class="button small" data-test="${E(t.id)}">تحليل نتائج الاختبار</button>`]))}</section>`;
 $('printBtn').hidden=false;printContent=wrapPrint(test?'تحليل نتائج الاختبار':'تحليل نتائج الطلاب',examHtml(report,test),test||{});}
function wrapPrint(title,body,meta={}){
  const schoolName = meta.school_name || 'الثانوية / المتوسطة';
  const grade = meta.grade || 'الصف الثالث المتوسط';
  const className = meta.class_name || 'غير مسجل';
  const teacherName = meta.teacher_name || 'معلم المادة';
  const currentDate = date(new Date());

  // STRICT REQUIREMENT: DO NOT SHOW LAST 3 DIGITS OF NATIONAL ID OR ANY STUDENT ID ON PRINTED REPORT
  return `<header class="print-header">
    <div class="print-header-right">
      <p class="print-gov">المملكة العربية السعودية</p>
      <p class="print-gov">وزارة التعليم</p>
      <p>مدرسة: ${E(schoolName)}</p>
    </div>
    <div class="print-header-center">
      <h1>تقرير نتائج نافس المعتمد</h1>
      <h2>${E(title)}</h2>
      <p>${E(grade)} · ${E(meta.subjects ? meta.subjects.map(s=>names[s]||s).join(' · ') : 'جميع المواد')}</p>
    </div>
    <div class="print-header-left">
      <div class="print-brand">معلّمي<small>منصة نافس المعتمدة</small></div>
      <p>التاريخ: ${E(currentDate)}</p>
      <p>الفصل: ${E(className)}</p>
    </div>
  </header>
  <div class="print-meta-bar">
    <div><b>الصف الدراسي:</b> ${E(grade)}</div>
    <div><b>الفصل:</b> ${E(className)}</div>
    <div><b>المعلم المشرف:</b> ${E(teacherName)}</div>
    <div><b>تاريخ التقرير:</b> ${E(currentDate)}</div>
  </div>
  <p class="print-note">تقدير تدريبي وفق معايير المنصة: متقن (٨٠٪ فأكثر) · يحتاج تحسينًا (٥٠٪ إلى ٧٩٪) · غير متقن (أقل من ٥٠٪).</p>
  ${body}
  <div class="print-signatures">
    <div><b>معلم المادة</b><span>${E(teacherName)}</span></div>
    <div><b>الموجه الطلابي</b><span></span></div>
    <div><b>مدير المدرسة / الوكيل</b><span></span></div>
  </div>
  <footer class="print-footer">معلّمي — تقرير رسمي موثق ومستخرج من سجلات أداء الطلاب في منصة نافس.</footer>`;
}

function showStudent(key){
  const history = attempts.filter(a=>a.studentIdentity===key);
  const r = A.studentRows(history)[0];
  if(!r) return;

  const records = history.filter(A.isSubmitted).sort(A.compareTime);
  const reliable = records.filter(A.isAnalyzable);
  const avg = A.mean(reliable.map(A.savedPercent));
  const skills = r.skills.filter(s=>s.latest);
  const current = A.mean(skills.map(s=>s.latest.percent));

  // Correct and wrong calculations across attempts
  const totalCorrect = records.reduce((sum, a) => sum + (Number(a.score) || 0), 0);
  const totalQuestions = records.reduce((sum, a) => sum + (Number(a.total) || 0), 0);
  const totalWrong = Math.max(0, totalQuestions - totalCorrect);

  // 3-tier categorization:
  // 1. Mastered: >= 80%
  // 2. Needs Improvement: 50% to 79%
  // 3. Unmastered / Weak repeated: < 50%
  const masteredSkills = skills.filter(s => s.latest.percent >= 80);
  const improveSkills = skills.filter(s => s.latest.percent >= 50 && s.latest.percent < 80);
  const weakSkills = skills.filter(s => s.latest.percent < 50);

  // Visual SVG Level bar & legend
  const totalSkillsCount = skills.length || 1;
  const mPct = Math.round((masteredSkills.length / totalSkillsCount) * 100);
  const iPct = Math.round((improveSkills.length / totalSkillsCount) * 100);
  const wPct = Math.max(0, 100 - mPct - iPct);

  const levelChartSvg = `<div class="student-level-visual">
    <div class="level-bars-track">
      <div class="bar-seg mastered" style="width:${mPct}%" title="متقن: ${mPct}%"></div>
      <div class="bar-seg improve" style="width:${iPct}%" title="يحتاج تحسينًا: ${iPct}%"></div>
      <div class="bar-seg weak" style="width:${wPct}%" title="غير متقن: ${wPct}%"></div>
    </div>
    <div class="level-bars-legend">
      <span class="leg-item leg-mastered">● متقن (٨٠٪+): ${num(masteredSkills.length)} مؤشر (${mPct}٪)</span>
      <span class="leg-item leg-improve">● يحتاج تحسينًا (٥٠-٧٩٪): ${num(improveSkills.length)} مؤشر (${iPct}٪)</span>
      <span class="leg-item leg-weak">● غير متقن (<٥٠٪): ${num(weakSkills.length)} مؤشر (${wPct}٪)</span>
    </div>
  </div>`;

  const skillRows = skills.map(s => {
    const p = s.latest.percent;
    const tierBadge = p >= 80 ? '<span class="badge mastered">متقن</span>' : p >= 50 ? '<span class="badge near">يحتاج تحسينًا</span>' : '<span class="badge support">غير متقن</span>';
    return [
      E(s.latest.text),
      pct(p),
      tierBadge,
      `${num(s.latest.correct)} من ${num(s.latest.total)}`,
      s.repeated ? 'ضعف متكرر' : 'طبيعي',
      delta(s.trend)
    ];
  });

  const body = `<section class="card student-detail-card">
    <div class="student-profile-head">
      <div class="student-avatar-box">${E(r.student.student_name.charAt(0))}</div>
      <div class="student-info-main">
        <h1>${E(r.student.student_name)}</h1>
        <div class="student-meta-tags">
          <span class="info-pill">الصف: ${E(r.student.grade || 'الثالث المتوسط')}</span>
          <span class="info-pill">الفصل: ${E(r.student.class_name || 'غير مسجل')}</span>
          <span class="info-pill highlight">المستوى العام: ${badge(current)}</span>
        </div>
      </div>
    </div>

    <!-- Core Student Metrics -->
    <div class="summary-grid">
      ${metric('الاختبارات المسلّمة', num(records.length))}
      ${metric('متوسط النسبة المئوية', pct(avg))}
      ${metric('إجمالي الإجابات الصحيحة', num(totalCorrect), `من إجمالي ${num(totalQuestions)} سؤال`)}
      ${metric('إجمالي الإجابات الخاطئة', num(totalWrong))}
      ${metric('آخر درجة محفوظة', r.latest ? num(r.latest.score) + ' من ' + num(r.latest.total) : '—')}
      ${metric('التغير في المؤشرات', delta(r.trend))}
    </div>

    <!-- Visual Mastery Progress Chart -->
    <div class="section-card-inner">
      <h3>خريطة إتقان المؤشرات والمستويات</h3>
      ${levelChartSvg}
    </div>

    <!-- 3-Tier Classification Cards -->
    <div class="three-tier-container">
      <div class="tier-box tier-mastered">
        <div class="tier-head">
          <h4>🌟 المؤشرات المتقنة (٨٠٪ فأكثر)</h4>
          <span class="tier-count">${num(masteredSkills.length)}</span>
        </div>
        <div class="tier-body">
          ${masteredSkills.length ? list(masteredSkills.map(s => s.latest.text + ' (' + pct(s.latest.percent) + ')')) : '<p class="muted">لا توجد مؤشرات في هذه الفئة بعد.</p>'}
        </div>
      </div>

      <div class="tier-box tier-improve">
        <div class="tier-head">
          <h4>⚠️ مؤشرات تحتاج إلى تحسين (٥٠٪ إلى ٧٩٪)</h4>
          <span class="tier-count">${num(improveSkills.length)}</span>
        </div>
        <div class="tier-body">
          ${improveSkills.length ? list(improveSkills.map(s => s.latest.text + ' (' + pct(s.latest.percent) + ')')) : '<p class="muted">لا توجد مؤشرات في هذه الفئة بعد.</p>'}
        </div>
      </div>

      <div class="tier-box tier-weak">
        <div class="tier-head">
          <h4>🚨 مؤشرات غير متقنة / ضعيفة مكررة (أقل من ٥٠٪)</h4>
          <span class="tier-count">${num(weakSkills.length)}</span>
        </div>
        <div class="tier-body">
          ${weakSkills.length ? list(weakSkills.map(s => s.latest.text + ' (' + pct(s.latest.percent) + ')')) : '<p class="muted">لا توجد مؤشرات ضعيفة.</p>'}
        </div>
      </div>
    </div>

    <!-- Historical Score Chart -->
    <h2>تطور الدرجات عبر المحاولات</h2>
    ${chart(records)}

    <!-- Detailed Skills Table -->
    <h2>تحليل المؤشرات التفصيلي</h2>
    ${table(['المؤشر', 'النسبة المئوية', 'المستوى', 'الصحيح / المقاس', 'المتابعة', 'التغير'], skillRows)}

    <!-- Test History & Paper Review -->
    <h2>سجل الاختبارات وأوراق الإجابة</h2>
    <p class="muted">يمكن للمعلم الضغط على «عرض ورقة الاختبار» لفحص كل سؤال وإجابة الطالب وشرح الحل بالتفصيل.</p>
    ${history.length ? table(
      ['الاختبار والتاريخ', 'الدرجة', 'النسبة', 'المستوى / الحالة', 'ورقة الإجابة'],
      history.slice().sort(A.compareTime).map(a => [
        `${E(a.title)}<br><small>${date(a.submitted_at || a.started_at)}</small>${a.snapshot_warning ? `<p class="notice danger">${E(a.snapshot_warning)}</p>` : ''}`,
        A.isSubmitted(a) ? `${num(a.score)} من ${num(a.total)}` : 'لم يسلم',
        pct(A.savedPercent(a)),
        a.snapshot_warning ? 'تعذر تقدير المستوى' : A.isSubmitted(a) ? badge(A.measure(a).percent) : a.status === 'expired' ? 'انتهى الوقت' : 'قيد الاختبار',
        `<button type="button" class="button small no-print" data-paper="${E(a.id)}" data-source="${a.source}">عرض ورقة الاختبار</button>`
      ])
    ) : '<p class="muted">لم يدخل الطالب اختبارات من هذا النوع بعد.</p>'}
  </section>`;

  detail = { type: 'student', key };
  $('dashboard').hidden = true;
  $('detailPanel').hidden = false;
  $('detailPanel').innerHTML = `
    <div class="detail-top">
      <button class="button secondary" data-back>العودة إلى لوحة التحليل</button>
      <button class="button" data-print>🖨️ طباعة تقرير الطالب الرسمي (A4)</button>
    </div>
    ${body}
  `;

  // NOTICE: Omit national_id_last3 / student_no from wrapPrint metadata!
  printContent = wrapPrint('تقرير مستوى الطالب في نافس', body, {
    student_name: r.student.student_name,
    class_name: r.student.class_name,
    grade: r.student.grade,
    subjects: [...new Set(history.flatMap(a => a.subjects))]
  });
  $('detailPanel').focus();
}

async function showPaper(source, id) {
  $('loadState').textContent = 'جارٍ تحميل ورقة الطالب المحفوظة…';
  try {
    const p = await NafesTeacher.api('teacher_paper', { source, attempt_id: id });
    const a = p.attempt;
    const body = `
      <section class="card paper-card">
        <div class="paper-header-info">
          <h1>ورقة اختبار ${E(a.student_name)}</h1>
          <h2>${E(a.title)}</h2>
          <div class="paper-meta-pills">
            <span>تاريخ البدء: ${E(date(a.started_at))}</span>
            <span>الدرجة: <b>${num(a.score)} من ${num(a.total)}</b> (${pct(a.percent)})</span>
            <span>الزمن الفعلي: ${num(a.elapsed_seconds === null ? null : Math.round(a.elapsed_seconds / 60 * 10) / 10)} دقيقة</span>
          </div>
        </div>
        ${a.snapshot_warning ? `<p class="notice danger">${E(a.snapshot_warning)}</p>` : ''}
        <p class="paper-intro-note">الورقة محفوظة بترتيب الأسئلة والاختيارات الذي ظهر للطالب مع الإجابة الصحيحة وشرح الحل.</p>
        ${p.sections.map(s => `
          <div class="paper-section-heading"><h2>${names[s.subject] || s.subject}</h2></div>
          ${s.questions.map((q, i) => `
            <article class="paper-question">
              <header>
                <b>السؤال ${num(i + 1)}</b>
                <span class="${q.correct ? 'badge-correct' : 'badge-wrong'}">
                  ${!A.isSubmitted(a) ? 'محاولة غير مسلمة' : q.scorable ? q.correct ? '✓ صحيح' : q.answer === null ? 'لم يجب' : '✗ خطأ' : 'تعذر التصحيح'}
                </span>
              </header>
              <div class="question-indicator">${E(q.indicator_text)}</div>
              ${q.context ? `<div class="question-context">${E(q.context)}</div>` : ''}
              ${window.NafesMedia.render(q)}
              <p class="question-stem">${E(q.question)}</p>
              <div class="question-options">
                ${q.options.map((o, n) => `
                  <div class="paper-option ${q.correctIndex === n ? 'correct-option' : ''} ${q.answer === n ? 'chosen-option' : ''}">
                    <span>${['أ', 'ب', 'ج', 'د'][n]})</span>
                    <div class="option-text">${E(o)}</div>
                    <small class="option-note">${q.answer === n ? 'إجابة الطالب' : ''} ${q.correctIndex === n ? '✓ الصحيحة' : ''}</small>
                  </div>
                `).join('')}
              </div>
              <p class="answer-explanation">${E(q.explanation)}</p>
            </article>
          `).join('')}
        `).join('')}
        <h2>سجل مغادرة الصفحة والنزاهة</h2>
        ${a.events?.length ? table(['الحدث', 'الوقت'], a.events.map(e => [
          E(({ hidden: 'غيّر التبويب أو أخفى الصفحة', visible: 'عاد إلى الصفحة', page_leave: 'غادر صفحة الاختبار', copy_blocked: 'محاولة نسخ محظورة', print_blocked: 'محاولة طباعة محظورة' })[e.type] || e.type),
          date(e.at)
        ])) : '<p>لم تُسجّل أحداث مغادرة لهذه المحاولة. التسجيل غير متاح لبعض المحاولات القديمة.</p>'}
      </section>
    `;

    $('dashboard').hidden = true;
    $('detailPanel').hidden = false;
    $('detailPanel').innerHTML = `
      <div class="detail-top">
        <button class="button secondary" data-student="${E(A.studentIdentity(a))}">العودة إلى ملف الطالب</button>
        <button class="button" data-print>🖨️ طباعة ورقة الاختبار</button>
      </div>
      ${body}
    `;
    detail = { type: 'paper', id };
    // Notice: Never include student_no or national_id_last3 in wrapPrint metadata
    printContent = wrapPrint('ورقة الطالب المحفوظة', body, {
      student_name: a.student_name,
      class_name: a.class_name,
      grade: a.grade
    });
    $('detailPanel').focus();
  } catch (e) {
    $('loadErrorText').textContent = e.message;
    $('loadError').hidden = false;
  } finally {
    $('loadState').textContent = '';
  }
}
async function print(){const node=$('printReport');node.innerHTML=printContent;node.setAttribute('aria-hidden','false');node.querySelectorAll('details').forEach(d=>d.open=true);node.querySelectorAll('button[data-student]').forEach(b=>b.replaceWith(document.createTextNode(b.textContent)));node.querySelectorAll('button').forEach(b=>b.remove());node.querySelectorAll('.table-wrap').forEach(x=>x.style.overflow='visible');await document.fonts.ready;await Promise.all([...node.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r;})));window.print();}
function options(){const old=filters();const fill=(id,data,label,value)=>{$(id).innerHTML=`<option value="">${label}</option>`+data.map(d=>`<option value="${E(value(d))}">${E(d.label||d.title||d.text||d)}</option>`).join('');};fill('classFilter',[...new Set(attempts.map(a=>a.class_name).filter(Boolean))].sort(),'جميع الفصول',x=>x);if(attempts.some(a=>!a.class_name))$('classFilter').insertAdjacentHTML('beforeend',`<option value="${A.UNKNOWN_CLASS}">الفصل غير مسجل</option>`);fill('testFilter',tests,'جميع الاختبارات',x=>x.id);fill('indicatorFilter',indicators,'جميع المؤشرات',x=>x.key);for(const[id,key]of [['subjectFilter','subject'],['classFilter','className'],['testFilter','test'],['indicatorFilter','indicator']])$(id).value=old[key]||'';const initial=new URLSearchParams(location.search).get('test');if(initial&&!old.test)$('testFilter').value=initial;}
async function load(){if(loading)return;if(!NafesTeacher.getKey()){$('authPanel').hidden=false;return;}loading=true;$('loadError').hidden=true;$('authPanel').hidden=true;$('loadState').textContent='جارٍ قراءة المحاولات الحقيقية المحفوظة…';try{let cursor=0,all=[],testList=[],catalog=[];do{const d=await NafesTeacher.api('teacher_data',{cursor,limit:100});all.push(...d.attempts);if(cursor===0){testList=d.tests;catalog=d.indicators;}cursor=d.next_cursor;}while(cursor!==null);attempts=all.map(A.normalizeAttempt);tests=testList;indicators=catalog;for(const a of attempts)if(!tests.some(t=>t.id===a.test_id))tests.push({id:a.test_id,title:a.title,kind:a.kind,subjects:a.subjects,class_name:a.class_name,total:a.total});options();$('updatedAt').textContent='آخر تحديث: '+date(new Date());for(const id of ['refreshBtn','signoutBtn'])$(id).hidden=false;render();}catch(e){$('loadError').hidden=false;$('loadErrorText').textContent=e.message;if(e.status===401)$('authPanel').hidden=false;}finally{loading=false;$('loadState').textContent='';}}
$('filtersForm').onchange=render;$('studentSearch').oninput=render;$('resetFilters').onclick=()=>{$('filtersForm').reset();render();};$('refreshBtn').onclick=load;$('retryBtn').onclick=load;$('printBtn').onclick=print;$('signoutBtn').onclick=()=>{NafesTeacher.clearKey();attempts=[];tests=[];printContent='';$('dashboard').hidden=true;$('detailPanel').hidden=true;$('printReport').replaceChildren();$('authPanel').hidden=false;$('signoutBtn').hidden=true;$('printBtn').hidden=true;};$('authForm').onsubmit=e=>{e.preventDefault();NafesTeacher.setKey($('teacherKey').value);$('teacherKey').value='';load();};
addEventListener('nafes:auth-required',e=>{e.preventDefault();$('authPanel').hidden=false;});addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load();});document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.view){view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}else if(b.dataset.student)showStudent(b.dataset.student);else if(b.dataset.paper)showPaper(b.dataset.source,b.dataset.paper);else if(b.dataset.test){$('testFilter').value=b.dataset.test;view='overview';render();}else if(b.hasAttribute('data-print'))print();else if(b.hasAttribute('data-back'))render();});
load();
})();
