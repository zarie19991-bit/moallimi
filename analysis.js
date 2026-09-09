(()=>{
'use strict';

const A = window.NafesAnalytics;
const $ = id => document.getElementById(id);
const E = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = x => x === null || x === undefined || isNaN(x) ? '—' : new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(x);
const pct = x => x === null || x === undefined || isNaN(x) ? 'غير مقاس' : num(x) + '٪';
const date = x => x ? new Date(x).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const names = { reading: 'القراءة', math: 'الرياضيات', science: 'العلوم' };
const kinds = { indicator: 'اختبار مؤشر', multi_indicator: 'اختبار مجمع', simulation: 'اختبار محاكاة' };
const subjectIcons = { reading: '📖', math: '📐', science: '🔬' };

// School Grade Thresholds (Used ONLY for Official School Report matching Ministry PDF)
function getSchoolGrade(percent) {
  const p = Number(percent);
  if (p === null || isNaN(p) || percent === null || percent === undefined) return { key: 'none', label: 'غير مقاس', range: '—', color: '#9aa0a6' };
  if (p >= 90) return { key: 'excellent', label: 'ممتاز', range: '٩٠ - ١٠٠', color: '#1b8a5a' };
  if (p >= 80) return { key: 'vgood', label: 'جيد جداً', range: '٨٠ - ٨٩', color: '#0f8b8d' };
  if (p >= 70) return { key: 'good', label: 'جيد', range: '٧٠ - ٧٩', color: '#2196f3' };
  if (p >= 50) return { key: 'pass', label: 'مقبول', range: '٥٠ - ٦٩', color: '#ff9800' };
  return { key: 'fail', label: 'راسب', range: '٠ - ٤٩', color: '#e53935' };
}

// NAFES Mastery Thresholds (Pedagogical Analysis)
function getNafesMastery(percent, questionsCount = null) {
  if (questionsCount !== null && questionsCount < 2) {
    return {
      key: 'insufficient',
      label: 'أدلة غير كافية',
      badgeHtml: `<span class="badge insufficient" title="عدد الأسئلة (${num(questionsCount)}) غير كافٍ لإصدار حكم موثوق؛ يلزم سؤالان على الأقل">أدلة غير كافية</span>`
    };
  }
  const p = Number(percent);
  if (p === null || isNaN(p) || percent === null || percent === undefined) {
    return { key: 'unmeasured', label: 'غير مقاس', badgeHtml: '<span class="badge unmeasured">غير مقاس</span>' };
  }
  if (p >= 80) return { key: 'mastered', label: 'متقن', badgeHtml: '<span class="badge mastered">متقن</span>' };
  if (p >= 65) return { key: 'near', label: 'قريب من الإتقان', badgeHtml: '<span class="badge near">قريب من الإتقان</span>' };
  if (p >= 50) return { key: 'support', label: 'بحاجة إلى دعم', badgeHtml: '<span class="badge support">بحاجة إلى دعم</span>' };
  return { key: 'nonmastered', label: 'غير متقن', badgeHtml: '<span class="badge nonmastered">غير متقن</span>' };
}

// Indicator Priority Engine (Multi-Factor Classification)
function getIndicatorPriority(indicatorSummary, questionsCount, studentCount, repeatedCount = 0) {
  if (questionsCount < 2 || studentCount < 2) {
    return { key: 'insufficient', label: 'أدلة غير كافية', class: 'priority-insufficient', rank: 5 };
  }
  const p = indicatorSummary.percent ?? 0;
  if (p < 50 && (studentCount >= 5 || repeatedCount >= 2)) {
    return { key: 'urgent', label: 'أولوية عاجلة', class: 'priority-urgent', rank: 1 };
  }
  if (p < 65) {
    return { key: 'medium', label: 'أولوية متوسطة', class: 'priority-medium', rank: 2 };
  }
  if (p < 80) {
    return { key: 'follow', label: 'متابعة', class: 'priority-follow', rank: 3 };
  }
  return { key: 'stable', label: 'مستقر', class: 'priority-stable', rank: 4 };
}

// Fair Comparison Trend (Strictly requires same test or >=2 shared indicators)
function getFairTrend(currentAttempt, priorAttempts, filters = {}) {
  if (!currentAttempt || !priorAttempts || !priorAttempts.length) {
    return { direction: 'unavailable', label: 'لا تتوفر مقارنة عادلة', badgeHtml: '<span class="badge fair-na">لا تتوفر مقارنة عادلة</span>' };
  }
  for (const prior of priorAttempts) {
    if (!A.isSubmitted(prior)) continue;
    const isSameTest = currentAttempt.test_id && prior.test_id && currentAttempt.test_id === prior.test_id;
    const cmp = A.comparison(currentAttempt, prior, filters);
    if (isSameTest) {
      const curP = A.savedPercent(currentAttempt);
      const priP = A.savedPercent(prior);
      if (curP === null || priP === null) continue;
      const deltaVal = Math.round((curP - priP) * 10) / 10;
      const direction = Math.abs(deltaVal) < 1e-4 ? 'stable' : deltaVal > 0 ? 'up' : 'down';
      const text = direction === 'up' ? `تحسّن (+${num(Math.abs(deltaVal))}٪)` : direction === 'down' ? `تراجع (-${num(Math.abs(deltaVal))}٪)` : 'استقرار';
      return { direction, delta: deltaVal, label: text, badgeHtml: `<span class="badge ${direction}">${text}</span>` };
    }
    if (cmp && cmp.keys.length >= 2) {
      const deltaVal = Math.round(cmp.delta * 10) / 10;
      const direction = cmp.direction;
      const text = direction === 'up' ? `تحسّن (+${num(Math.abs(deltaVal))}٪)` : direction === 'down' ? `تراجع (-${num(Math.abs(deltaVal))}٪)` : 'استقرار';
      return {
        direction,
        delta: deltaVal,
        label: text,
        badgeHtml: `<span class="badge ${direction}">${text}</span>`
      };
    }
  }
  return { direction: 'unavailable', label: 'لا تتوفر مقارنة عادلة', badgeHtml: '<span class="badge fair-na">لا تتوفر مقارنة عادلة</span>' };
}

// State
let rawAttempts = [];
let tests = [];
let indicators = [];
let studentsRoster = [];

let currentPillar = 'subjects'; // 'subjects' | 'tests' | 'students'
let selectedSubjectKey = null;   // 'reading' | 'math' | 'science'
let activeSubjectSubtab = 'summary';
let selectedTestId = null;
let activeTestSubtab = 'general';
let selectedStudentKey = null;
let activeStudentSubtab = 'summary';

let loading = false;
let printContent = '';

// Filter values for the 3-pillar system
function getFilters() {
  return {
    subject: selectedSubjectKey || '',
    className: '',
    test: selectedTestId || '',
    policy: $('quickPolicySelect')?.value || 'latest',
    indicator: '',
    level: '',
    trend: '',
    search: $('studentRosterSearch')?.value || ''
  };
}

// Attempt Policy Filter Implementation
function filterAttemptsByPolicy(attemptsList, policy = 'latest') {
  if (policy === 'all') return attemptsList;
  const groups = new Map();
  for (const a of attemptsList) {
    const key = `${a.studentIdentity || A.studentIdentity(a)}\u0000${a.test_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  const result = [];
  for (const group of groups.values()) {
    group.sort(A.compareTime);
    const submitted = group.filter(A.isSubmitted);
    if (!submitted.length) {
      result.push(group[group.length - 1]);
      continue;
    }
    if (policy === 'first') {
      result.push(submitted[0]);
    } else if (policy === 'highest') {
      const best = submitted.reduce((max, cur) => (A.savedPercent(cur) ?? -1) > (A.savedPercent(max) ?? -1) ? cur : max, submitted[0]);
      result.push(best);
    } else {
      result.push(submitted[submitted.length - 1]);
    }
  }
  return result;
}

// Table Renderer Helper
function renderTable(headers, rows, tableClass = '') {
  return `<div class="table-wrap">
    <table class="print-table ${tableClass}">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="muted" style="text-align:center;padding:24px;">لا توجد بيانات مسجلة في هذا النطاق.</td></tr>`}
      </tbody>
    </table>
  </div>`;
}

// Quality Alerts Scanner
function checkQualityAlerts() {
  const banner = $('qualityAlertsBanner');
  const list = $('qualityAlertsList');
  const alerts = [];

  const invalidSnapshots = rawAttempts.filter(a => a.snapshot_warning);
  if (invalidSnapshots.length) {
    alerts.push(`يوجد ${num(invalidSnapshots.length)} محاولة تحتوي على تحذير مفتاح إجابة تاريخي غير صالح؛ تم عزلها تلقائياً من تقييم الإتقان والتحسن.`);
  }

  const unlinkedAttempts = rawAttempts.filter(a => a.identityUncertain);
  if (unlinkedAttempts.length) {
    alerts.push(`يوجد ${num(unlinkedAttempts.length)} محاولة غير مرتبطة بمعرّف طالب موثق (student_id)؛ يتم تتبعها كحالات منفصلة لمنع تداخل السجلات.`);
  }

  if (alerts.length) {
    banner.hidden = false;
    list.innerHTML = alerts.map(msg => `<li>${E(msg)}</li>`).join('');
  } else {
    banner.hidden = true;
  }
}

// Breadcrumbs Navigator
function updateBreadcrumbs() {
  const nav = $('breadcrumbs');
  const pillarBtn = $('crumbPillarBtn');
  const detailSep = $('crumbDetailSep');
  const detailName = $('crumbDetailName');

  nav.hidden = false;

  if (currentPillar === 'subjects') {
    pillarBtn.textContent = 'تحليل المواد';
    pillarBtn.onclick = () => { selectedSubjectKey = null; render(); };
    if (selectedSubjectKey) {
      detailSep.hidden = false;
      detailName.hidden = false;
      detailName.textContent = names[selectedSubjectKey] || selectedSubjectKey;
    } else {
      detailSep.hidden = true;
      detailName.hidden = true;
    }
  } else if (currentPillar === 'tests') {
    pillarBtn.textContent = 'تحليل الاختبارات';
    pillarBtn.onclick = () => { selectedTestId = null; render(); };
    if (selectedTestId) {
      const currentTest = tests.find(t => t.id === selectedTestId);
      detailSep.hidden = false;
      detailName.hidden = false;
      detailName.textContent = currentTest?.title || 'تفاصيل الاختبار';
    } else {
      detailSep.hidden = true;
      detailName.hidden = true;
    }
  } else if (currentPillar === 'students') {
    pillarBtn.textContent = 'ملفات الطلاب';
    pillarBtn.onclick = () => { selectedStudentKey = null; $('detailPanel').hidden = true; render(); };
    if (selectedStudentKey) {
      detailSep.hidden = false;
      detailName.hidden = false;
      const stAttempt = rawAttempts.find(a => (a.studentIdentity || A.studentIdentity(a)) === selectedStudentKey);
      detailName.textContent = stAttempt?.student_name || 'ملف الطالب';
    } else {
      detailSep.hidden = true;
      detailName.hidden = true;
    }
  }
}

// ==========================================================================
// URL STATE SYNCHRONIZATION & ROUTING
// ==========================================================================
function syncUrl() {
  try {
    const url = new URL(location.href);
    url.searchParams.delete('view');
    url.searchParams.delete('test');
    url.searchParams.delete('subject');
    url.searchParams.delete('student');

    if (selectedStudentKey) {
      url.searchParams.set('student', selectedStudentKey);
    } else if (selectedTestId) {
      url.searchParams.set('test', selectedTestId);
    } else if (selectedSubjectKey) {
      url.searchParams.set('subject', selectedSubjectKey);
    } else if (currentPillar === 'students') {
      url.searchParams.set('view', 'students');
    } else if (currentPillar === 'tests') {
      url.searchParams.set('view', 'tests');
    }
    const newSearch = url.searchParams.toString();
    const newPath = url.pathname + (newSearch ? '?' + newSearch : '');
    history.replaceState(null, '', newPath);
  } catch (_) {}
}

function handleUrlParams() {
  const params = new URLSearchParams(location.search);
  const testId = params.get('test');
  const subject = params.get('subject');
  const studentId = params.get('student');
  const view = params.get('view');

  if (testId) {
    currentPillar = 'tests';
    selectedTestId = testId;
    activeTestSubtab = 'summary';
  } else if (subject && ['reading', 'math', 'science'].includes(subject)) {
    currentPillar = 'subjects';
    selectedSubjectKey = subject;
    activeSubjectSubtab = 'summary';
  } else if (studentId) {
    currentPillar = 'students';
    selectedStudentKey = studentId;
  } else if (view === 'followup' || view === 'students') {
    // Route legacy followup or students links directly to the new Students Hub
    currentPillar = 'students';
    selectedStudentKey = null;
  } else if (view === 'tests') {
    currentPillar = 'tests';
    selectedTestId = null;
  } else if (view === 'subjects') {
    currentPillar = 'subjects';
    selectedSubjectKey = null;
  }
}

// ==========================================================================
// MAIN RENDER ORCHESTRATOR
// ==========================================================================
function render() {
  if (!rawAttempts.length && !tests.length) return;

  const f = getFilters();
  syncUrl();
  $('dashboard').hidden = false;
  $('detailPanel').hidden = true;

  checkQualityAlerts();
  updateBreadcrumbs();

  // Sync pillar nav buttons
  document.querySelectorAll('.pillar-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pillar === currentPillar);
  });

  // Sync quick policy selector
  if ($('quickPolicySelect')) $('quickPolicySelect').value = f.policy;

  $('subjectsSection').hidden = currentPillar !== 'subjects';
  $('testsSection').hidden = currentPillar !== 'tests';
  $('studentsSection').hidden = currentPillar !== 'students';

  if (currentPillar === 'subjects') {
    renderSubjectsSection(f);
  } else if (currentPillar === 'tests') {
    renderTestsSection(f);
  } else if (currentPillar === 'students') {
    renderStudentsSection(f);
  }
}

// ==========================================================================
// PILLAR 1: SUBJECTS ANALYSIS ENGINE
// ==========================================================================
function renderSubjectsSection(f) {
  const catalogView = $('subjectsCatalogView');
  const detailView = $('subjectDetailView');

  if (!selectedSubjectKey) {
    catalogView.hidden = false;
    detailView.hidden = true;
    $('printBtn').hidden = true;
    renderSubjectsCatalog(f);
    return;
  }

  catalogView.hidden = true;
  detailView.hidden = false;
  $('printBtn').hidden = false;
  renderSubjectDetail(selectedSubjectKey, f);
}

function renderSubjectsCatalog(f) {
  const grid = $('subjectsGrid');
  const subjectKeys = ['reading', 'math', 'science'];
  const scoped = filterAttemptsByPolicy(rawAttempts, f.policy);

  grid.innerHTML = subjectKeys.map(subj => {
    const subjAttempts = scoped.filter(a => (a.subjects || []).includes(subj) && A.isSubmitted(a));
    const testedStudents = new Set(subjAttempts.map(a => a.studentIdentity || A.studentIdentity(a))).size;

    const percentages = [];
    for (const a of subjAttempts) {
      const qSubj = (a.questions || []).filter(q => q.subject === subj && A.isScorable(q));
      if (qSubj.length) {
        const correct = qSubj.filter(q => q.correct).length;
        percentages.push((correct / qSubj.length) * 100);
      }
    }
    const avgScore = A.mean(percentages);
    const masteredCount = percentages.filter(p => p >= 80).length;
    const masteryRate = percentages.length ? Math.round((masteredCount / percentages.length) * 1000) / 10 : null;

    return `
      <article class="subject-card">
        <div class="subject-card-head">
          <span class="subject-card-icon">${subjectIcons[subj] || '📚'}</span>
          <span class="badge ${masteryRate !== null ? (masteryRate >= 80 ? 'mastered' : masteryRate >= 50 ? 'near' : 'nonmastered') : 'unmeasured'}">
            ${masteryRate !== null ? (masteryRate >= 80 ? 'متقن' : masteryRate >= 50 ? 'متوسط' : 'بحاجة لدعم') : 'غير مقاس'}
          </span>
        </div>
        <h3>مادة ${names[subj]}</h3>
        <div class="subject-summary-tags">
          <span>الطلاب المختبرون: <b>${num(testedStudents)}</b></span>
          <span>متوسط الأداء: <b>${pct(avgScore)}</b></span>
          <span>نسبة الإتقان: <b>${pct(masteryRate)}</b></span>
        </div>
        <p class="muted" style="font-size:11px;line-height:1.8;">تحليل مجمع لاختبارات المؤشرات والمحاكاة التابعة لمادة ${names[subj]}.</p>
        <button type="button" class="button small" data-open-subject="${subj}">تحليل مادة ${names[subj]} ←</button>
      </article>
    `;
  }).join('');
}

function renderSubjectDetail(subj, f) {
  const container = $('subjectHeaderContainer');
  const scoped = filterAttemptsByPolicy(rawAttempts, f.policy);

  const subjAttempts = scoped.filter(a => (a.subjects || []).includes(subj) && A.isSubmitted(a));
  const testedStudents = new Set(subjAttempts.map(a => a.studentIdentity || A.studentIdentity(a))).size;
  const enrolledStudents = studentsRoster.filter(s => s.is_active !== false).length;

  const studentSubjectScores = [];
  for (const a of subjAttempts) {
    const qSubj = (a.questions || []).filter(q => q.subject === subj && A.isScorable(q));
    if (qSubj.length) {
      const correct = qSubj.filter(q => q.correct).length;
      studentSubjectScores.push({
        attempt: a,
        studentKey: a.studentIdentity || A.studentIdentity(a),
        studentName: a.student_name,
        className: a.class_name,
        percent: (correct / qSubj.length) * 100,
        count: qSubj.length
      });
    }
  }

  const percentages = studentSubjectScores.map(s => s.percent);
  const avg = A.mean(percentages);
  const mastered = percentages.filter(p => p >= 80).length;
  const near = percentages.filter(p => p >= 65 && p < 80).length;
  const support = percentages.filter(p => p >= 50 && p < 65).length;
  const nonmastered = percentages.filter(p => p < 50).length;
  const masteryRate = percentages.length ? Math.round((mastered / percentages.length) * 1000) / 10 : null;

  const subjReport = A.report(subjAttempts, indicators, { ...f, subject: subj });
  const measuredIndicators = subjReport.indicators.filter(i => i.subject === subj && i.measuredStudents);

  const sortedInd = measuredIndicators.slice().sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const strongestInd = sortedInd[0]?.text || '—';
  const weakestInd = sortedInd[sortedInd.length - 1]?.text || '—';
  const priorityInd = measuredIndicators.find(i => (i.percent ?? 100) < 50 && i.measuredStudents >= 3) || sortedInd[sortedInd.length - 1];

  container.innerHTML = `
    <div class="card official-report-card">
      <div class="official-title-banner" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <h2 style="margin:0;">${subjectIcons[subj] || '📚'} التحليل الشامل لمادة ${names[subj]}</h2>
        <button type="button" class="btn-primary-pro" id="downloadSubjectExcelBtn">
          <span>📊</span> تصدير نتائج مادة ${names[subj]} Excel
        </button>
      </div>
      <div class="official-meta-cards">
        <div class="off-meta-box"><span>الطلاب المقاسون فعلياً:</span><b>${num(testedStudents)} طالبًا</b></div>
        <div class="off-meta-box"><span>المسجلون في الكشف:</span><b>${num(enrolledStudents || testedStudents)} طالبًا</b></div>
        <div class="off-meta-box"><span>متوسط نسبة الأداء:</span><b>${pct(avg)}</b></div>
      </div>
      <div class="summary-grid" style="margin-top:12px;">
        <div class="metric"><span>نسبة الإتقان العامة</span><strong>${pct(masteryRate)}</strong><small>${num(mastered)} متقن</small></div>
        <div class="metric"><span>أقوى مؤشر</span><strong style="font-size:13px;color:var(--brand);">${E(strongestInd)}</strong></div>
        <div class="metric"><span>أضعف مؤشر</span><strong style="font-size:13px;color:var(--red);">${E(weakestInd)}</strong></div>
      </div>
    </div>
  `;

  if ($('downloadSubjectExcelBtn')) {
    $('downloadSubjectExcelBtn').onclick = () => {
      if (!window.NafesExcel?.exportSubjectExcel) {
        alert('محرك Excel غير محمل.');
        return;
      }
      const relevantTests = tests.filter(t => (t.subjects || []).includes(subj));
      const subjectExportData = {
        testsCount: relevantTests.length,
        studentsCount: testedStudents,
        averagePercent: avg,
        masteryRate: masteryRate,
        indicatorsCount: measuredIndicators.length,
        tests: relevantTests.map(t => {
          const tAtt = subjAttempts.filter(a => a.test_id === t.id);
          const pL = [];
          for (const a of tAtt) {
            const qS = (a.questions || []).filter(q => q.subject === subj && A.isScorable(q));
            if (qS.length) pL.push((qS.filter(q => q.correct).length / qS.length) * 100);
          }
          return {
            title: t.title,
            kind: t.kind,
            class_name: t.class_name,
            created_at: t.created_at,
            students_count: tAtt.length,
            average_percent: A.mean(pL)
          };
        }),
        indicators: measuredIndicators.map(ind => ({
          text: ind.text,
          question_count: (subjAttempts.find(a => a.questions?.length)?.questions || []).filter(q => A.indicatorKey(q) === ind.key).length || 1,
          students_count: ind.measuredStudents,
          average_percent: ind.percent,
          mastery_rate: ind.masteryRate,
          priority: getIndicatorPriority(ind, 2, ind.measuredStudents).label
        }))
      };
      window.NafesExcel.exportSubjectExcel(subj, subjectExportData);
    };
  }

  document.querySelectorAll('.subject-subtabs button').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.subjectTab === activeSubjectSubtab));
  });

  $('subjectTabSummaryView').hidden = activeSubjectSubtab !== 'summary';
  $('subjectTabStudentsView').hidden = activeSubjectSubtab !== 'students';
  $('subjectTabIndicatorsView').hidden = activeSubjectSubtab !== 'indicators';
  $('subjectTabTestsView').hidden = activeSubjectSubtab !== 'tests';
  $('subjectTabQuestionsView').hidden = activeSubjectSubtab !== 'questions';
  $('subjectTabEvolutionView').hidden = activeSubjectSubtab !== 'evolution';

  if (activeSubjectSubtab === 'summary') {
    renderSubjectSummaryTab(subj, avg, masteryRate, mastered, near, support, nonmastered, strongestInd, weakestInd, priorityInd, testedStudents, enrolledStudents);
  } else if (activeSubjectSubtab === 'students') {
    renderSubjectStudentsTab(studentSubjectScores);
  } else if (activeSubjectSubtab === 'indicators') {
    renderSubjectIndicatorsTab(measuredIndicators, subjAttempts);
  } else if (activeSubjectSubtab === 'tests') {
    renderSubjectTestsTab(subj, scoped);
  } else if (activeSubjectSubtab === 'questions') {
    renderSubjectQuestionsTab(subjReport);
  } else if (activeSubjectSubtab === 'evolution') {
    renderSubjectEvolutionTab(subj, scoped);
  }
}

// Subject Subtab 1: Summary
function renderSubjectSummaryTab(subj, avg, masteryRate, mastered, near, support, nonmastered, strongest, weakest, priority, testedCount, enrolledCount) {
  const container = $('subjectTabSummaryView');

  let conclusionText = '';
  if (testedCount < 2) {
    conclusionText = 'لا تتوفر بيانات كافية لإصدار خلاصة تحليلية موثوقة للمادة.';
  } else {
    conclusionText = `أظهرت نتائج مادة ${names[subj]} متوسط أداء عام بلغ ${pct(avg)} ونسبة إتقان بلغت ${pct(masteryRate)}. يبلغ عدد الطلاب المحتاجين للدعم وغير المتقنين ${num(support + nonmastered)} من أصل ${num(testedCount)} طالبًا مقاسًا. يُعد مؤشر «${E(priority?.text || weakest)}» هو الأعلى أولوية للتدخل العلاجي السريع.`;
  }

  container.innerHTML = `
    <div class="card">
      <div class="performance-gap-box">
        <div>
          <strong>📋 الخلاصة التحليلية لمادة ${names[subj]}</strong>
          <p style="margin:6px 0 0;font-size:12px;color:#285247;line-height:1.9;">${conclusionText}</p>
        </div>
      </div>

      <div class="two-columns">
        <div class="card" style="margin-top:0;">
          <h3>توزيع مستويات الإتقان للطلاب (${num(testedCount)})</h3>
          <table class="off-levels-table" style="margin-top:14px;">
            <thead><tr><th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th></tr></thead>
            <tbody>
              <tr><td><span class="badge mastered">متقن</span></td><td>٨٠٪ فأكثر</td><td><b>${num(mastered)}</b></td></tr>
              <tr><td><span class="badge near">قريب من الإتقان</span></td><td>٦٥٪ - ٧٩٪</td><td><b>${num(near)}</b></td></tr>
              <tr><td><span class="badge support">بحاجة إلى دعم</span></td><td>٥٠٪ - ٦٤٪</td><td><b>${num(support)}</b></td></tr>
              <tr><td><span class="badge nonmastered">غير متقن</span></td><td>أقل من ٥٠٪</td><td><b>${num(nonmastered)}</b></td></tr>
            </tbody>
          </table>
        </div>

        <div class="card" style="margin-top:0;">
          <h3>مؤشرات الأولوية والتدخل</h3>
          <ul class="event-list" style="margin-top:14px;">
            <li><span>المؤشر الأعلى أولوية:</span><b>${E(priority?.text || '—')}</b></li>
            <li><span>أقوى مؤشر تميز:</span><b style="color:var(--brand);">${E(strongest)}</b></li>
            <li><span>أضعف مؤشر:</span><b style="color:var(--red);">${E(weakest)}</b></li>
            <li><span>نسبة تغطية الطلاب المقاسين:</span><b>${num(enrolledCount > 0 ? Math.round(testedCount / enrolledCount * 100) : 100)}٪</b></li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// Subject Subtab 2: Students in Subject
function renderSubjectStudentsTab(scores) {
  const container = $('subjectTabStudentsView');
  const rows = scores.map((s, i) => [
    num(i + 1),
    `<button type="button" class="text-button" data-student="${E(s.studentKey)}" style="font-weight:900;">${E(s.studentName)}</button>`,
    E(s.className || '—'),
    pct(s.percent),
    getNafesMastery(s.percent, s.count).badgeHtml,
    `${num(s.count)} سؤال مقاس`,
    `<button type="button" class="button small" data-student="${E(s.studentKey)}">ملف الطالب ←</button>`
  ]);

  container.innerHTML = `
    <div class="card">
      <div class="section-heading">
        <h2>قائمة الطلاب ونتائجهم في المادة (${num(scores.length)})</h2>
        <p class="muted">الدرجات معزولة حصراً على أسئلة ومؤشرات هذه المادة دون دمج أي مواد أخرى.</p>
      </div>
      ${renderTable(['#', 'اسم الطالب', 'الفصل', 'نسبة الإتقان', 'المستوى', 'الأسئلة المقاسة', 'الإجراء'], rows)}
    </div>
  `;
}

// Subject Subtab 3: Indicators Analysis
function renderSubjectIndicatorsTab(indicatorsList, scopedAttempts) {
  const container = $('subjectTabIndicatorsView');
  const sample = scopedAttempts.find(a => a.questions && a.questions.length);

  const rows = indicatorsList.map((g, i) => {
    const qCount = sample ? sample.questions.filter(q => A.indicatorKey(q) === g.key && A.isScorable(q)).length : (g.measuredStudents ? Math.round(g.total / g.measuredStudents) : 0);
    const masteryStatus = getNafesMastery(g.percent, qCount);
    const priority = getIndicatorPriority(g, qCount, g.measuredStudents);

    return [
      num(i + 1),
      `<button type="button" class="text-button" data-indicator="${E(g.key)}" style="font-weight:800;text-align:right;">${E(g.text)}</button>`,
      pct(g.percent),
      pct(g.masteryRate),
      masteryStatus.badgeHtml,
      `<span class="badge ${priority.class}">${priority.label}</span>`,
      `${num(qCount)} أسئلة · ${num(g.measuredStudents)} طالبًا`,
      `<button type="button" class="button small" data-indicator="${E(g.key)}">الطلاب المتأثرون ←</button>`
    ];
  });

  container.innerHTML = `
    <div class="card">
      <div class="section-heading">
        <h2>تحليل مؤشرات المادة وأولويات التدخل (${num(indicatorsList.length)})</h2>
        <p class="muted">اضغط على اسم أي مؤشر لعرض قائمة الطلاب المتأثرين وتصنيف تكرار الضعف لديهم.</p>
      </div>
      ${renderTable(['#', 'المؤشر المقاس', 'متوسط الأداء', 'نسبة الإتقان', 'حكم الإتقان', 'أولوية التدخل', 'كفاية الأدلة', 'الإجراء'], rows)}
    </div>
  `;
}

// Subject Subtab 4: Subject Performance Over Tests
function renderSubjectTestsTab(subj, scopedAttempts) {
  const container = $('subjectTabTestsView');
  const relevantTests = tests.filter(t => (t.subjects || []).includes(subj));

  const rows = [];
  let previousAvg = null;

  for (const t of relevantTests) {
    const tAttempts = scopedAttempts.filter(a => a.test_id === t.id && A.isSubmitted(a));
    if (!tAttempts.length) continue;

    const pList = [];
    for (const a of tAttempts) {
      const qSubj = (a.questions || []).filter(q => q.subject === subj && A.isScorable(q));
      if (qSubj.length) pList.push((qSubj.filter(q => q.correct).length / qSubj.length) * 100);
    }
    const tAvg = A.mean(pList);
    const tMastered = pList.filter(p => p >= 80).length;
    const tMasteryRate = pList.length ? Math.round((tMastered / pList.length) * 1000) / 10 : null;

    let deltaHtml = '<span class="badge fair-na">لا تتوفر مقارنة عادلة</span>';
    if (previousAvg !== null) {
      const diff = Math.round((tAvg - previousAvg) * 10) / 10;
      const dir = Math.abs(diff) < 1e-4 ? 'stable' : diff > 0 ? 'up' : 'down';
      const text = dir === 'up' ? `تحسّن (+${num(Math.abs(diff))}٪)` : dir === 'down' ? `تراجع (-${num(Math.abs(diff))}٪)` : 'استقرار';
      deltaHtml = `<span class="badge ${dir}">${text}</span>`;
    }
    previousAvg = tAvg;

    rows.push([
      `<b>${E(t.title)}</b>`,
      `<span class="badge unmeasured">${kinds[t.kind] || 'اختبار'}</span>`,
      date(t.created_at),
      num(tAttempts.length),
      pct(tAvg),
      pct(tMasteryRate),
      deltaHtml,
      `<button type="button" class="button small" data-open-test="${E(t.id)}">تحليل الاختبار ←</button>`
    ]);
  }

  container.innerHTML = `
    <div class="card">
      <div class="section-heading">
        <h2>أداء المادة عبر الاختبارات والمحاكاة</h2>
        <p class="muted">تتبع أداء المادة عبر الاختبارات المختلفة مع عزل نتائج المواد الأخرى وتطبيق شرط المقارنة العادلة.</p>
      </div>
      ${renderTable(['الاختبار', 'النوع', 'التاريخ', 'عدد الطلاب', 'متوسط المادة', 'نسبة الإتقان', 'التغير العادل', 'الإجراء'], rows)}
    </div>
  `;
}

// Subject Subtab 5: Hardest Questions with Distractor Analysis
function renderSubjectQuestionsTab(report) {
  const container = $('subjectTabQuestionsView');
  renderQuestionsWithDistractors(container, report.questions);
}

// Subject Subtab 6: Subject Evolution Chart
function renderSubjectEvolutionTab(subj, scopedAttempts) {
  const container = $('subjectTabEvolutionView');
  const relevantTests = tests.filter(t => (t.subjects || []).includes(subj));

  const points = [];
  for (const t of relevantTests) {
    const tAttempts = scopedAttempts.filter(a => a.test_id === t.id && A.isSubmitted(a));
    if (!tAttempts.length) continue;
    const pList = [];
    for (const a of tAttempts) {
      const qSubj = (a.questions || []).filter(q => q.subject === subj && A.isScorable(q));
      if (qSubj.length) pList.push((qSubj.filter(q => q.correct).length / qSubj.length) * 100);
    }
    const avgVal = A.mean(pList);
    if (avgVal !== null) points.push({ title: t.title, date: t.created_at, avg: avgVal });
  }

  if (points.length < 2) {
    container.innerHTML = `<div class="card empty-state"><h3>لا تتوفر بيانات كافية للرسم</h3><p>يلزم توفر اختبارين على الأقل لرسم منحنى تطور المادة الزمني.</p></div>`;
    return;
  }

  const width = 800, height = 240, pad = 45;
  const x = i => pad + (points.length === 1 ? (width - pad * 2) / 2 : i * (width - pad * 2) / (points.length - 1));
  const y = p => height - pad - p * (height - pad * 2) / 100;

  container.innerHTML = `
    <div class="card">
      <div class="section-heading">
        <h2>منحنى تطور مادة ${names[subj]} عبر الاختبارات</h2>
        <p class="muted">رسم بياني حقيقي يربط متوسط أداء المادة عبر الترتيب الزمني للاختبارات.</p>
      </div>
      <div class="svg-chart-wrap">
        <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img">
          ${[0, 25, 50, 75, 100].map(p => `
            <line x1="${pad}" x2="${width - pad}" y1="${y(p)}" y2="${y(p)}" stroke="#dce6e0"/>
            <text x="${pad - 8}" y="${y(p) + 4}" text-anchor="end" font-size="11">${num(p)}٪</text>
          `).join('')}
          <polyline points="${points.map((p, i) => `${x(i)},${y(p.avg)}`).join(' ')}" fill="none" stroke="#0f6b63" stroke-width="3"/>
          ${points.map((p, i) => `
            <circle cx="${x(i)}" cy="${y(p.avg)}" r="5" fill="#0f6b63">
              <title>${E(p.title)} · ${pct(p.avg)}</title>
            </circle>
            <text x="${x(i)}" y="${height - 12}" text-anchor="middle" font-size="9.5">${E(p.title.slice(0, 14))}…</text>
          `).join('')}
        </svg>
      </div>
    </div>
  `;
}

// ==========================================================================
// PILLAR 2: TESTS ANALYSIS ENGINE
// ==========================================================================
function renderTestsSection(f) {
  if (!selectedTestId) {
    $('testsCatalogSection').hidden = false;
    $('testAnalysisSection').hidden = true;
    $('printBtn').hidden = true;
    renderTestsCatalog(f);
    return;
  }

  $('testsCatalogSection').hidden = true;
  $('testAnalysisSection').hidden = false;
  $('printBtn').hidden = false;
  renderTestAnalysisDetail(selectedTestId, f);
}

let selectedGroupTestIds = new Set();

function renderTestsCatalog(f) {
  const grid = $('testsGrid');
  // Rule 8 & 25 & Point 3: ONLY show tests that have at least 1 ACTUALLY SUBMITTED attempt!
  const filtered = tests.filter(t => {
    const hasSubmitted = rawAttempts.some(a => a.test_id === t.id && A.isSubmitted(a));
    if (!hasSubmitted) return false;
    if (f.subject && !(t.subjects || []).includes(f.subject)) return false;
    if (f.className && t.class_name && t.class_name !== f.className) return false;
    return true;
  });

  const countBadge = $('selectedTestsCountBadge');
  const analyzeBtn = $('analyzeSelectedTestsBtn');

  function updateGroupToolbar() {
    if (countBadge) countBadge.textContent = `محدد: ${num(selectedGroupTestIds.size)} اختبار`;
    if (analyzeBtn) analyzeBtn.disabled = selectedGroupTestIds.size < 2;
  }

  // Bind group toolbar actions
  const btnReading = $('selectAllReadingTestsBtn');
  if (btnReading) {
    btnReading.onclick = () => {
      filtered.filter(t => (t.subjects || []).includes('reading')).forEach(t => selectedGroupTestIds.add(t.id));
      renderTestsCatalog(f);
    };
  }
  const btnMath = $('selectAllMathTestsBtn');
  if (btnMath) {
    btnMath.onclick = () => {
      filtered.filter(t => (t.subjects || []).includes('math')).forEach(t => selectedGroupTestIds.add(t.id));
      renderTestsCatalog(f);
    };
  }
  const btnScience = $('selectAllScienceTestsBtn');
  if (btnScience) {
    btnScience.onclick = () => {
      filtered.filter(t => (t.subjects || []).includes('science')).forEach(t => selectedGroupTestIds.add(t.id));
      renderTestsCatalog(f);
    };
  }
  const btnClear = $('clearSelectionBtn');
  if (btnClear) {
    btnClear.onclick = () => {
      selectedGroupTestIds.clear();
      renderTestsCatalog(f);
    };
  }
  if (analyzeBtn) {
    analyzeBtn.onclick = () => {
      if (selectedGroupTestIds.size >= 2) {
        renderGroupAnalysis([...selectedGroupTestIds], f);
      }
    };
  }
  const btnManagePrev = $('managePreviousResultsBtn');
  if (btnManagePrev) {
    btnManagePrev.onclick = () => handleManagePreviousResults();
  }

  updateGroupToolbar();

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state"><h3>لا توجد نتائج مسلّمة بعد</h3><p>لا تظهر في شاشة التحليل إلا الاختبارات التي أداها وسلّمها الطلاب بالفعل. بمجرد تسليم أول طالب سيظهر الاختبار هنا تلقائيًا.</p></div>';
    return;
  }

  const scoped = filterAttemptsByPolicy(rawAttempts, f.policy);
  const enrolledCount = studentsRoster.filter(s => s.is_active !== false).length;

  grid.innerHTML = filtered.map(t => {
    const tAttempts = scoped.filter(a => a.test_id === t.id && A.isSubmitted(a));
    const testedCount = new Set(tAttempts.map(a => a.studentIdentity || A.studentIdentity(a))).size;
    const absentCount = Math.max(0, (enrolledCount || testedCount) - testedCount);
    const validAttempts = tAttempts.filter(a => !a.snapshot_warning);
    const avgScore = A.mean(validAttempts.map(A.savedPercent));
    const pList = validAttempts.map(A.savedPercent).filter(p => p !== null);
    const masteryRate = pList.length ? Math.round((pList.filter(p => p >= 80).length / pList.length) * 1000) / 10 : null;
    const subjectList = (t.subjects || []).map(s => names[s] || s).join(' · ');
    const isChecked = selectedGroupTestIds.has(t.id);

    return `
      <article class="test-card ${isChecked ? 'selected-card' : ''}">
        <div class="test-card-header">
          <label class="test-card-select">
            <input type="checkbox" class="group-test-cb" data-test-id="${E(t.id)}" ${isChecked ? 'checked' : ''}>
            <span>تحديد</span>
          </label>
          <span class="badge ${tAttempts.length ? 'mastered' : 'unmeasured'}">${kinds[t.kind] || 'اختبار'}</span>
        </div>
        <h3 style="margin-top:4px;">${E(t.title)}</h3>
        <p class="muted">${subjectList || 'عام'} ${t.class_name ? `· الفصل: ${E(t.class_name)}` : ''} · ${num(t.total || 15)} درجة</p>
        <div class="mini-metrics">
          <span>المختبرون: <b>${num(testedCount)}</b></span>
          <span>لم يؤدوا: <b>${num(absentCount)}</b></span>
          <span>المتوسط: <b>${pct(avgScore)}</b></span>
          <span>نسبة الإتقان: <b>${pct(masteryRate)}</b></span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:auto;">
          <button type="button" class="button small" data-open-test="${E(t.id)}">تحليل الاختبار ←</button>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.group-test-cb').forEach(cb => {
    cb.onchange = e => {
      const id = e.target.dataset.testId;
      if (e.target.checked) selectedGroupTestIds.add(id);
      else selectedGroupTestIds.delete(id);
      updateGroupToolbar();
    };
  });
}

function renderGroupAnalysis(selectedTestIds, f) {
  const container = $('groupAnalysisSection');
  const catalog = $('testsCatalogSection');
  if (!container || !catalog) return;

  const selectedTests = tests.filter(t => selectedTestIds.includes(t.id));
  if (!selectedTests.length) return;

  catalog.hidden = true;
  container.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const scoped = filterAttemptsByPolicy(rawAttempts.filter(a => selectedTestIds.includes(a.test_id) && A.isSubmitted(a)), f.policy);

  // Equal student weighting (Point 9)
  const studentMap = new Map();
  for (const a of scoped) {
    const sKey = a.studentIdentity || A.studentIdentity(a);
    if (!studentMap.has(sKey)) studentMap.set(sKey, []);
    studentMap.get(sKey).push(a);
  }

  const studentAverages = [];
  const studentRows = [];
  for (const [sKey, atts] of studentMap) {
    const validScores = atts.filter(a => !a.snapshot_warning).map(A.savedPercent).filter(p => p !== null);
    const sAvg = validScores.length ? A.mean(validScores) : null;
    if (sAvg !== null) studentAverages.push(sAvg);
    const firstAtt = atts[0];
    studentRows.push({
      sKey,
      name: firstAtt.student_name,
      grade: firstAtt.grade || 'الثالث المتوسط',
      class_name: firstAtt.class_name || '—',
      tests_taken: atts.length,
      average_percent: sAvg,
      level_label: getNafesMastery(sAvg).label
    });
  }

  const overallAverage = studentAverages.length ? A.mean(studentAverages) : null;
  const masteredStudents = studentAverages.filter(p => p >= 80).length;
  const masteryRate = studentAverages.length ? Math.round((masteredStudents / studentAverages.length) * 1000) / 10 : null;

  const allDates = selectedTests.map(t => t.created_at).filter(Boolean).sort();
  const dateRange = allDates.length ? `${date(allDates[0])} إلى ${date(allDates[allDates.length - 1])}` : '—';
  const allSubjects = [...new Set(selectedTests.flatMap(t => t.subjects || []))];

  // Fair comparison check
  let isComparable = true;
  if (allSubjects.length > 1) {
    isComparable = false;
  } else {
    const indSets = selectedTests.map(t => {
      const qs = scoped.filter(a => a.test_id === t.id).flatMap(a => a.questions || []);
      return new Set(qs.map(A.indicatorKey).filter(Boolean));
    });
    if (indSets.length >= 2) {
      const intersection = [...indSets[0]].filter(k => indSets.every(s => s.has(k)));
      if (intersection.length < 1) isComparable = false;
    }
  }

  // Indicator Aggregation
  const indicatorStats = new Map();
  for (const a of scoped) {
    if (a.snapshot_warning) continue;
    for (const q of (a.questions || []).filter(A.isScorable)) {
      const k = A.indicatorKey(q);
      if (!k) continue;
      if (!indicatorStats.has(k)) {
        indicatorStats.set(k, {
          key: k,
          text: q.indicator_text || k,
          subject: q.subject,
          testsSet: new Set(),
          studentsSet: new Set(),
          correct: 0,
          total: 0
        });
      }
      const st = indicatorStats.get(k);
      st.testsSet.add(a.test_id);
      st.studentsSet.add(a.studentIdentity || A.studentIdentity(a));
      if (q.correct) st.correct++;
      st.total++;
    }
  }

  const groupIndicators = [...indicatorStats.values()].map(st => {
    const avgP = st.total > 0 ? Math.round((st.correct / st.total) * 1000) / 10 : 0;
    const priority = getIndicatorPriority({ percent: avgP }, Math.round(st.total / Math.max(1, st.studentsSet.size)), st.studentsSet.size);
    return {
      key: st.key,
      text: st.text,
      subject: st.subject,
      tests_count: st.testsSet.size,
      students_count: st.studentsSet.size,
      average_percent: avgP,
      mastery_rate: avgP,
      trend: isComparable ? 'مستقر' : 'وصفي',
      priority: priority.label,
      priority_label: priority.label
    };
  });

  groupIndicators.sort((a, b) => (b.average_percent ?? 0) - (a.average_percent ?? 0));
  const strongestIndicators = groupIndicators.slice(0, 3);
  const weakestIndicators = groupIndicators.slice().reverse().slice(0, 3);

  const groupExportData = {
    tests: selectedTests.map(t => {
      const atts = scoped.filter(a => a.test_id === t.id);
      const pL = atts.filter(a => !a.snapshot_warning).map(A.savedPercent).filter(p => p !== null);
      return {
        title: t.title,
        subjects: t.subjects,
        class_name: t.class_name,
        created_at: t.created_at,
        students_count: new Set(atts.map(a => a.studentIdentity || A.studentIdentity(a))).size,
        average_percent: A.mean(pL),
        mastery_rate: pL.length ? Math.round((pL.filter(p => p >= 80).length / pL.length) * 1000) / 10 : 0
      };
    }),
    dateRange,
    uniqueStudentsCount: studentMap.size,
    overallAverage: overallAverage,
    masteryRate: masteryRate,
    subjects: allSubjects,
    indicatorsCount: groupIndicators.length,
    isComparable,
    strongestIndicators,
    weakestIndicators,
    studentRows,
    subjectBreakdown: allSubjects.map(sub => {
      const subTests = selectedTests.filter(t => (t.subjects || []).includes(sub));
      const subAtts = scoped.filter(a => (a.subjects || []).includes(sub));
      const pL = subAtts.filter(a => !a.snapshot_warning).map(A.savedPercent).filter(p => p !== null);
      return {
        subject: sub,
        tests_count: subTests.length,
        students_count: new Set(subAtts.map(a => a.studentIdentity || A.studentIdentity(a))).size,
        average_percent: A.mean(pL),
        mastery_rate: pL.length ? Math.round((pL.filter(p => p >= 80).length / pL.length) * 1000) / 10 : 0
      };
    }),
    indicators: groupIndicators
  };

  container.innerHTML = `
    <div class="group-header-banner">
      <div>
        <span class="badge mastered" style="font-size:11px;margin-bottom:6px;">تحليل مجمع (${num(selectedTests.length)} اختبارات)</span>
        <h2 style="margin:0;font-size:22px;">تحليل مجموعة اختبارات نافس المحددة</h2>
        <p class="muted" style="margin:4px 0 0;">الفترة: ${E(dateRange)} · المواد: ${E(allSubjects.map(s => names[s] || s).join(' · '))}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn-primary-pro" id="downloadGroupExcelBtn">
          <span>📊</span> تنزيل تحليل المجموعة Excel
        </button>
        <button type="button" class="btn-secondary-pro" id="closeGroupAnalysisBtn">
          <span>←</span> العودة لقائمة الاختبارات
        </button>
      </div>
    </div>

    <div class="fair-comparison-alert ${isComparable ? 'fair' : ''}">
      ${isComparable 
        ? '✓ تتوفر مقارنة معيارية عادلة بين الاختبارات المحددة لتقارب نواتج التعلم ومؤشرات القياس.' 
        : '⚠️ هذه النتائج وصفية ولا تتوفر مقارنة عادلة لجميع الاختبارات المحددة لاختلاف المواد أو المؤشرات المقاسة.'}
    </div>

    <div class="official-meta-cards">
      <div class="off-meta-box"><span>الطلاب الفريدون:</span><b>${num(studentMap.size)} طالبًا</b></div>
      <div class="off-meta-box"><span>متوسط الأداء العام (وزن متساوٍ):</span><b>${pct(overallAverage)}</b></div>
      <div class="off-meta-box"><span>نسبة الإتقان الموحدة:</span><b>${pct(masteryRate)}</b></div>
    </div>

    <div class="two-columns" style="margin-top:16px;">
      <div class="card tier-mastered">
        <h4>🌟 المؤشرات الأقوى أداءً في المجموعة</h4>
        <ul>
          ${strongestIndicators.map(i => `<li><b>${E(i.text)}</b>: ${pct(i.average_percent)}</li>`).join('') || '<li>لا توجد مؤشرات</li>'}
        </ul>
      </div>
      <div class="card tier-weak">
        <h4>⚠️ المؤشرات الأضعف / ذات الضعف المتكرر</h4>
        <ul>
          ${weakestIndicators.map(i => `<li><b>${E(i.text)}</b>: ${pct(i.average_percent)}</li>`).join('') || '<li>لا توجد مؤشرات</li>'}
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top:20px;">
      <div class="section-heading">
        <h2>تحليل المؤشرات المشتركة في الاختبارات المحددة (${num(groupIndicators.length)})</h2>
        <p class="muted">اضغط على أي مؤشر لفتح تحليله المستقل ورسم مستويات الطلاب التابعين له.</p>
      </div>
      ${renderTable(
        ['#', 'المؤشر', 'المادة', 'الاختبارات', 'الطلاب', 'متوسط الأداء', 'نسبة الإتقان', 'الاتجاه', 'الأولوية', 'إجراء'],
        groupIndicators.map((ind, idx) => [
          num(idx + 1),
          `<button type="button" class="text-button" data-indicator="${E(ind.key)}" style="font-weight:800;text-align:right;">${E(ind.text)}</button>`,
          names[ind.subject] || ind.subject || '—',
          num(ind.tests_count),
          num(ind.students_count),
          pct(ind.average_percent),
          pct(ind.mastery_rate),
          `<span class="badge ${ind.trend === 'مستقر' ? 'stable' : 'fair-na'}">${ind.trend}</span>`,
          `<span class="badge ${ind.priority === 'أولوية عاجلة' ? 'priority-urgent' : 'priority-stable'}">${ind.priority}</span>`,
          `<button type="button" class="button small" data-indicator="${E(ind.key)}">التحليل المستقل ←</button>`
        ])
      )}
    </div>
  `;

  $('downloadGroupExcelBtn').onclick = () => {
    if (window.NafesExcel?.exportGroupTestsExcel) {
      window.NafesExcel.exportGroupTestsExcel(groupExportData);
    } else {
      alert('محرك Excel غير محمل.');
    }
  };

  $('closeGroupAnalysisBtn').onclick = () => {
    container.hidden = true;
    catalog.hidden = false;
  };
}

async function handleManagePreviousResults() {
  const choice = prompt(
    "إدارة النتائج السابقة:\n" +
    "1. لمسح نتائج الاختبارات المحددة حاليًا، اكتب: مسح النتائج\n" +
    "2. لمسح جميع النتائج السابقة نهائيًا، اكتب: حذف جميع النتائج\n\n" +
    "أدخل اختيارك:"
  );
  if (!choice) return;

  const trimmed = choice.trim();
  if (trimmed === 'مسح النتائج' || trimmed === 'حذف' || trimmed === 'محدد') {
    if (!selectedGroupTestIds.size) {
      alert('لم تقم بتحديد أي اختبارات بعد من القائمة.');
      return;
    }
    if (!confirm(`هل أنت متأكد من مسح نتائج ${selectedGroupTestIds.size} اختبار؟ ستبقى الاختبارات ولكن ستُمسح درجات الطلاب.`)) return;
    try {
      await window.NafesTeacher.api('teacher_tests_bulk_clear', { test_ids: [...selectedGroupTestIds], confirm_word: 'مسح النتائج' });
      alert('تم مسح نتائج الاختبارات المحددة بنجاح.');
      selectedGroupTestIds.clear();
      await load();
    } catch (err) {
      alert('فشل مسح النتائج: ' + err.message);
    }
  } else if (trimmed === 'حذف جميع النتائج') {
    if (!confirm('تنبيه شديد الخطورة: سيتم مسح جميع المحاولات والدرجات والإجابات لجميع الاختبارات نهائيًا.\nهل أنت متأكد بنسبة 100%؟')) return;
    try {
      await window.NafesTeacher.api('teacher_tests_bulk_clear', { clear_all: true, confirm_word: 'حذف جميع النتائج' });
      alert('تم مسح جميع النتائج السابقة بنجاح.');
      selectedGroupTestIds.clear();
      await load();
    } catch (err) {
      alert('فشل مسح النتائج: ' + err.message);
    }
  } else {
    alert('إلغاء الإجراء؛ لم يتم إدخال خيار مطابق للتأكيد.');
  }
}

function renderTestAnalysisDetail(testId, f) {
  const currentTest = tests.find(t => t.id === testId) || { id: testId, title: 'اختبار غير معروف', total: 15, subjects: ['reading'] };
  const isMultiSubject = (currentTest.subjects || []).length > 1;

  const scopedAttempts = filterAttemptsByPolicy(rawAttempts, f.policy);
  const report = A.report(scopedAttempts, indicators, { ...f, test: testId });

  // Render Subtabs Navigation dynamically
  const subtabsNav = $('testSubtabsNav');
  let navButtons = '';

  if (!isMultiSubject) {
    navButtons = `
      <button type="button" data-test-tab="summary" aria-pressed="${activeTestSubtab === 'summary'}">📊 الملخص</button>
      <button type="button" data-test-tab="students" aria-pressed="${activeTestSubtab === 'students'}">👥 الطلاب</button>
      <button type="button" data-test-tab="indicators" aria-pressed="${activeTestSubtab === 'indicators'}">🎯 المؤشرات</button>
      <button type="button" data-test-tab="questions" aria-pressed="${activeTestSubtab === 'questions'}">❓ الأسئلة</button>
      <button type="button" data-test-tab="absent" aria-pressed="${activeTestSubtab === 'absent'}">⏳ لم يؤدوا الاختبار</button>
      <button type="button" data-test-tab="official_report" aria-pressed="${activeTestSubtab === 'official_report'}">📄 التقرير المدرسي</button>
    `;
    if (activeTestSubtab === 'general' || activeTestSubtab === 'reading' || activeTestSubtab === 'math' || activeTestSubtab === 'science') {
      activeTestSubtab = 'summary';
    }
  } else {
    const subjTabs = (currentTest.subjects || []).map(s => `
      <button type="button" data-test-tab="${s}" aria-pressed="${activeTestSubtab === s}">${subjectIcons[s] || ''} ${names[s] || s}</button>
    `).join('');

    navButtons = `
      <button type="button" data-test-tab="general" aria-pressed="${activeTestSubtab === 'general'}">🌐 الملخص العام</button>
      ${subjTabs}
      <button type="button" data-test-tab="students" aria-pressed="${activeTestSubtab === 'students'}">👥 الطلاب</button>
      <button type="button" data-test-tab="indicators" aria-pressed="${activeTestSubtab === 'indicators'}">🎯 المؤشرات</button>
      <button type="button" data-test-tab="questions" aria-pressed="${activeTestSubtab === 'questions'}">❓ الأسئلة</button>
      <button type="button" data-test-tab="absent" aria-pressed="${activeTestSubtab === 'absent'}">⏳ لم يؤدوا الاختبار</button>
      <button type="button" data-test-tab="official_report" aria-pressed="${activeTestSubtab === 'official_report'}">📄 التقرير المدرسي</button>
    `;
    if (activeTestSubtab === 'summary') activeTestSubtab = 'general';
  }
  subtabsNav.innerHTML = navButtons;

  renderTestHeaderSummary(report, currentTest, scopedAttempts, f);

  $('tabGeneralSummaryView').hidden = !(activeTestSubtab === 'summary' || activeTestSubtab === 'general');
  $('tabSubjectSectionView').hidden = !(['reading', 'math', 'science'].includes(activeTestSubtab));
  $('tabStudentsView').hidden = activeTestSubtab !== 'students';
  $('tabIndicatorsView').hidden = activeTestSubtab !== 'indicators';
  $('tabQuestionsView').hidden = activeTestSubtab !== 'questions';
  $('tabAbsentView').hidden = activeTestSubtab !== 'absent';
  $('tabOfficialReportView').hidden = activeTestSubtab !== 'official_report';

  if (activeTestSubtab === 'summary' || activeTestSubtab === 'general') {
    renderGeneralSummaryTab(report, currentTest, scopedAttempts, isMultiSubject);
  } else if (['reading', 'math', 'science'].includes(activeTestSubtab)) {
    renderIsolatedSubjectTab(currentTest, activeTestSubtab, scopedAttempts);
  } else if (activeTestSubtab === 'students') {
    renderStudentsTab(report, currentTest, scopedAttempts, f);
  } else if (activeTestSubtab === 'indicators') {
    renderIndicatorsTab(report, currentTest, scopedAttempts);
  } else if (activeTestSubtab === 'questions') {
    renderQuestionsTab(report, currentTest);
  } else if (activeTestSubtab === 'absent') {
    renderAbsentTab(currentTest);
  } else if (activeTestSubtab === 'official_report') {
    renderOfficialReportTab(report, currentTest);
  }

  printContent = buildOfficialPrintReport(report, currentTest, isMultiSubject);
}

// Test Header Summary Banner with Actions (Excel, Clear Results, Delete Test)
function renderTestHeaderSummary(report, test, scopedAttempts = [], f = {}) {
  const container = $('testSummaryContainer');
  const s = report.summary;
  const maxScore = Number(test.total) || 100;
  const masteredCount = s.levels.find(l => l.key === 'mastered')?.count || 0;
  const masteryRate = s.measured ? Math.round((masteredCount / s.measured) * 1000) / 10 : null;
  const isLegacy = test.id && test.id.startsWith('exam:');

  container.innerHTML = `
    <div class="card official-report-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <h2 style="margin:0;font-size:20px;">تحليل نتائج اختبار: ${E(test.title)}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn-primary-pro" id="downloadTestExcelBtn">
            <span>📊</span> تنزيل النتائج Excel
          </button>
          <button type="button" class="btn-secondary-pro" id="clearTestResultsBtn" style="color:#c5221f;border-color:#fce8e6;">
            <span>🗑️</span> مسح نتائج الاختبار
          </button>
          ${!isLegacy ? `
            <button type="button" class="btn-secondary-pro" id="deleteTestPermanentlyBtn" style="color:#a51d24;border-color:#fad2cf;">
              <span>❌</span> حذف الاختبار نهائيًا
            </button>
          ` : ''}
        </div>
      </div>
      <div class="official-meta-cards">
        <div class="off-meta-box"><span>المرحلة الدراسية / الصف:</span><b>${E(test.grade_key === 'middle_3' ? 'الصف الثالث المتوسط' : test.grade_key || 'الصف الثالث المتوسط')}</b></div>
        <div class="off-meta-box"><span>الفصل / الشعبة:</span><b>${E(test.class_name || 'جميع الفصول')}</b></div>
        <div class="off-meta-box"><span>درجة القياس (الاختبار):</span><b>${num(maxScore)}</b></div>
      </div>
      <div class="official-stats-split">
        <table class="off-metrics-table">
          <tbody>
            <tr><th>عدد الطلاب الذين سلموا</th><td>${num(s.submitted)}</td></tr>
            <tr><th>أعلى درجة محققة</th><td>${pct(s.highest)} ${test.total && s.highest !== null ? `(${num(Math.round(s.highest * maxScore / 100 * 10) / 10)} من ${num(maxScore)})` : ''}</td></tr>
            <tr><th>أقل درجة محققة</th><td>${pct(s.lowest)} ${test.total && s.lowest !== null ? `(${num(Math.round(s.lowest * maxScore / 100 * 10) / 10)} من ${num(maxScore)})` : ''}</td></tr>
            <tr><th>متوسط درجات الطلاب</th><td>${pct(s.average)} ${test.total && s.average !== null ? `(متوسط: ${num(Math.round(s.average * maxScore / 100 * 10) / 10)})` : ''}</td></tr>
            <tr><th>نسبة إتقان نافس (٨٠٪ فأكثر)</th><td>${pct(masteryRate)} <small class="muted">(${num(masteredCount)} متقن)</small></td></tr>
            <tr><th>مجموع درجات الطلاب</th><td>${test.total && s.average !== null ? num(Math.round((s.average * maxScore / 100) * s.submitted * 10) / 10) : '—'}</td></tr>
          </tbody>
        </table>
        <div class="off-detailed-levels-box">
          <h3>توزيع مستويات إتقان نافس</h3>
          <table class="off-levels-table">
            <thead><tr><th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th></tr></thead>
            <tbody>
              <tr><td><span class="badge mastered">متقن</span></td><td>٨٠٪ فأكثر</td><td><b>${num(masteredCount)}</b></td></tr>
              <tr><td><span class="badge near">قريب من الإتقان</span></td><td>٦٥٪ - ٧٩٪</td><td><b>${num(s.levels.find(l => l.key === 'near')?.count || 0)}</b></td></tr>
              <tr><td><span class="badge support">بحاجة إلى دعم</span></td><td>٥٠٪ - ٦٤٪</td><td><b>${num(s.levels.find(l => l.key === 'support')?.count || 0)}</b></td></tr>
              <tr><td><span class="badge nonmastered">غير متقن</span></td><td>أقل من ٥٠٪</td><td><b>${num(s.levels.find(l => l.key === 'nonmastered')?.count || 0)}</b></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  if ($('downloadTestExcelBtn')) {
    $('downloadTestExcelBtn').onclick = () => {
      if (!window.NafesExcel?.exportSingleTestExcel) {
        alert('محرك Excel غير محمل.');
        return;
      }
      const masteredCountVal = s.levels.find(l => l.key === 'mastered')?.count || 0;
      const nearCountVal = s.levels.find(l => l.key === 'near')?.count || 0;
      const supportCountVal = s.levels.find(l => l.key === 'support')?.count || 0;
      const nonMasteredCountVal = s.levels.find(l => l.key === 'nonmastered')?.count || 0;
      const insufficientCountVal = s.levels.find(l => l.key === 'insufficient')?.count || 0;

      const exportReport = {
        summary: {
          students: s.submitted,
          totalAttempts: scopedAttempts.filter(a => a.test_id === test.id && A.isSubmitted(a)).length,
          averagePercent: s.average,
          maxScore: s.highest,
          minScore: s.lowest,
          masteryRate: masteryRate,
          masteredCount: masteredCountVal,
          nearCount: nearCountVal,
          supportCount: supportCountVal,
          nonMasteredCount: nonMasteredCountVal,
          insufficientEvidenceCount: insufficientCountVal
        },
        students: report.rows.map(r => {
          const a = r.latest;
          return {
            name: r.student.student_name,
            grade: r.student.grade,
            class_name: r.student.class_name,
            score: a?.score,
            total: a?.total,
            percent: a ? A.savedPercent(a) : null,
            level_label: a ? getNafesMastery(A.savedPercent(a)).label : '—',
            correct_count: a?.score,
            incorrect_count: a && a.total != null && a.score != null ? a.total - a.score : 0,
            submitted_at: a?.submitted_at,
            snapshot_warning: a?.snapshot_warning
          };
        }),
        indicators: report.indicators.filter(i => i.measuredStudents).map(ind => {
          const qCount = (scopedAttempts.find(a => a.questions?.length)?.questions || []).filter(q => A.indicatorKey(q) === ind.key).length || 1;
          const prio = getIndicatorPriority(ind, qCount, ind.measuredStudents);
          return {
            text: ind.text,
            subject: ind.subject,
            student_count: ind.measuredStudents,
            question_count: qCount,
            average_percent: ind.percent,
            mastery_rate: ind.masteryRate,
            mastered_count: ind.mastered,
            near_count: ind.near || 0,
            support_count: ind.support || 0,
            non_mastered_count: (ind.measuredStudents || 0) - (ind.mastered || 0),
            insufficient_evidence: qCount < 2 ? ind.measuredStudents : 0,
            priority_label: prio.label
          };
        }),
        questions: report.questions.filter(q => q.measured).map((q, idx) => {
          const counts = [0, 0, 0, 0];
          let totalQ = 0;
          let skippedQ = 0;
          for (const a of scopedAttempts.filter(x => x.test_id === test.id && A.isSubmitted(x))) {
            const mq = (a.questions || []).find(x => A.questionFingerprint(x) === q.fingerprint);
            if (mq) {
              totalQ++;
              if (mq.answer === null || mq.answer === undefined) skippedQ++;
              else if (Number.isInteger(mq.answer) && mq.answer >= 0 && mq.answer < 4) counts[mq.answer]++;
            }
          }
          return {
            question_no: idx + 1,
            subject: q.subject,
            indicator_text: q.indicator_text,
            correct_percent: q.percent,
            respondents_count: totalQ,
            skipped_count: skippedQ,
            options_distribution: counts.map(c => totalQ > 0 ? Math.round((c / totalQ) * 100) : 0)
          };
        })
      };
      window.NafesExcel.exportSingleTestExcel(test, exportReport, { policy: f.policy });
    };
  }

  if ($('clearTestResultsBtn')) {
    $('clearTestResultsBtn').onclick = async () => {
      const conf = prompt(`هل أنت متأكد من مسح نتائج اختبار "${test.title}"؟\nسيبقى الاختبار ورابطه ورمز QR متاحين للطلاب ولكن ستُمسح جميع الإجابات والدرجات المسجلة نهائيًا.\n\nلتأكيد المسح، اكتب: مسح النتائج`);
      if (!conf || conf.trim() !== 'مسح النتائج') {
        if (conf) alert('تم إلغاء المسح: كلمة التأكيد غير مطابقة.');
        return;
      }
      try {
        await window.NafesTeacher.api('teacher_test_clear_results', { test_id: test.id, confirm_word: 'مسح النتائج' });
        alert('تم مسح نتائج الاختبار بنجاح.');
        await load();
      } catch (err) {
        alert('فشل مسح النتائج: ' + err.message);
      }
    };
  }

  if ($('deleteTestPermanentlyBtn')) {
    $('deleteTestPermanentlyBtn').onclick = async () => {
      const conf = prompt(`تنبيه شديد الخطورة: سيتم حذف اختبار "${test.title}" مع كافة محاولاته ونتائجه نهائيًا ولا يمكن استرجاعه.\nلتأكيد الحذف، اكتب كلمة: حذف`);
      if (!conf || conf.trim() !== 'حذف') {
        if (conf) alert('تم إلغاء الحذف: كلمة التأكيد غير مطابقة.');
        return;
      }
      try {
        await window.NafesTeacher.api('teacher_test_delete', { test_id: test.id, confirm_word: 'حذف' });
        alert('تم حذف الاختبار نهائيًا بنجاح.');
        selectedTestId = null;
        await load();
      } catch (err) {
        alert('فشل حذف الاختبار: ' + err.message);
      }
    };
  }
}

// General Summary Tab (Multi-Subject Performance Gap)
function renderGeneralSummaryTab(report, test, scopedAttempts, isMultiSubject) {
  const container = $('tabGeneralSummaryView');
  const s = report.summary;

  if (!isMultiSubject) {
    container.innerHTML = `
      <div class="card">
        <h3>نظرة عامة على الاختبار</h3>
        <p class="muted">تم إنجاز الاختبار بنجاح بمشاركة ${num(s.submitted)} طالبًا. استعرض نتائج الطلاب والمؤشرات والأسئلة عبر التبويبات أعلاه.</p>
      </div>
    `;
    return;
  }

  const subjs = test.subjects || [];
  const subjMetrics = [];

  for (const sub of subjs) {
    const pList = [];
    for (const a of scopedAttempts.filter(x => x.test_id === test.id && A.isSubmitted(x))) {
      const qSub = (a.questions || []).filter(q => q.subject === sub && A.isScorable(q));
      if (qSub.length) pList.push((qSub.filter(q => q.correct).length / qSub.length) * 100);
    }
    const avgVal = A.mean(pList);
    const masteredVal = pList.filter(p => p >= 80).length;
    const masteryRate = pList.length ? Math.round((masteredVal / pList.length) * 1000) / 10 : null;
    subjMetrics.push({ subject: sub, avg: avgVal ?? 0, masteryRate, count: pList.length });
  }

  subjMetrics.sort((a, b) => b.avg - a.avg);
  const highestSubj = subjMetrics[0];
  const lowestSubj = subjMetrics[subjMetrics.length - 1];
  const gap = highestSubj && lowestSubj ? Math.round((highestSubj.avg - lowestSubj.avg) * 10) / 10 : 0;

  const comparisonRows = subjMetrics.map(sm => [
    `<b>${names[sm.subject] || sm.subject}</b>`,
    pct(sm.avg),
    pct(sm.masteryRate),
    num(sm.count),
    `<button type="button" class="button small" data-test-tab="${sm.subject}">تحليل قسم ${names[sm.subject]} ←</button>`
  ]);

  container.innerHTML = `
    <div class="card">
      <div class="performance-gap-box">
        <div>
          <strong>📊 فجوة الأداء بين مواد الاختبار المحاكي:</strong>
          <span style="display:block;margin-top:4px;">مادة <b>${names[lowestSubj?.subject]}</b> أقل من مادة <b>${names[highestSubj?.subject]}</b> بفارق <b>${num(gap)} نقطة مئوية</b>.</span>
        </div>
        <div class="mini-metrics" style="padding:0;">
          <span>أعلى مادة: <b>${names[highestSubj?.subject]} (${pct(highestSubj?.avg)})</b></span>
          <span>أدنى مادة: <b>${names[lowestSubj?.subject]} (${pct(lowestSubj?.avg)})</b></span>
        </div>
      </div>

      <div class="section-heading">
        <h2>مقارنة أداء المواد داخل هذا الاختبار</h2>
        <p class="muted">اضغط على أي مادة للانتقال إلى تحليلها المعزول دون خلط نتائج المواد الأخرى.</p>
      </div>
      ${renderTable(['المادة', 'متوسط الأداء', 'نسبة الإتقان', 'عدد الطلاب المقاسين', 'التحليل التفصيلي'], comparisonRows)}
    </div>
  `;
}

// Isolated Subject Tab inside Simulation
function renderIsolatedSubjectTab(test, subj, scopedAttempts) {
  const container = $('tabSubjectSectionView');
  const tAttempts = scopedAttempts.filter(a => a.test_id === test.id && A.isSubmitted(a));

  const pList = [];
  const studentRowsList = [];

  for (const a of tAttempts) {
    const qSub = (a.questions || []).filter(q => q.subject === subj && A.isScorable(q));
    if (qSub.length) {
      const correct = qSub.filter(q => q.correct).length;
      const percent = (correct / qSub.length) * 100;
      pList.push(percent);
      studentRowsList.push({
        studentKey: a.studentIdentity || A.studentIdentity(a),
        studentName: a.student_name,
        className: a.class_name,
        score: correct,
        total: qSub.length,
        percent
      });
    }
  }

  const avg = A.mean(pList);
  const mastered = pList.filter(p => p >= 80).length;
  const masteryRate = pList.length ? Math.round((mastered / pList.length) * 1000) / 10 : null;

  const studentRows = studentRowsList.map((s, i) => [
    num(i + 1),
    `<button type="button" class="text-button" data-student="${E(s.studentKey)}" style="font-weight:900;">${E(s.studentName)}</button>`,
    E(s.className || '—'),
    `${num(s.score)} من ${num(s.total)}`,
    pct(s.percent),
    getNafesMastery(s.percent, s.total).badgeHtml,
    `<button type="button" class="button small" data-student="${E(s.studentKey)}">ملف الطالب ←</button>`
  ]);

  container.innerHTML = `
    <div class="card">
      <div class="section-heading">
        <div>
          <h2>${subjectIcons[subj] || ''} تحليل قسم ${names[subj]} داخل هذا الاختبار</h2>
          <p class="muted">الدرجات والمؤشرات والأسئلة معزولة حصراً على أسئلة مادة ${names[subj]}.</p>
        </div>
        <div class="mini-metrics">
          <span>متوسط القسم: <b>${pct(avg)}</b></span>
          <span>نسبة الإتقان: <b>${pct(masteryRate)}</b></span>
          <span>المختبرون: <b>${num(pList.length)}</b></span>
        </div>
      </div>
      ${renderTable(['#', 'اسم الطالب', 'الفصل', 'درجة القسم', 'النسبة المئوية', 'مستوى الإتقان', 'الإجراء'], studentRows)}
    </div>
  `;
}

// Students Table Subtab
function renderStudentsTab(report, test, scopedAttempts = [], filters = {}) {
  const container = $('tabStudentsView');
  const policy = filters.policy || 'latest';
  let rows = [];

  if (policy === 'all') {
    const testAttempts = scopedAttempts.filter(a => a.test_id === test.id && A.isSubmitted(a)).sort(A.compareTime).reverse();
    const studentMap = new Map();
    for (const a of testAttempts.slice().sort(A.compareTime)) {
      const sKey = a.studentIdentity || A.studentIdentity(a);
      if (!studentMap.has(sKey)) studentMap.set(sKey, []);
      studentMap.get(sKey).push(a);
    }

    rows = testAttempts.map((a, i) => {
      const sKey = a.studentIdentity || A.studentIdentity(a);
      const studentHistory = rawAttempts.filter(x => (x.studentIdentity || A.studentIdentity(x)) === sKey && A.compareTime(x, a) < 0).sort(A.compareTime).reverse();
      const trend = getFairTrend(a, studentHistory);
      const mastery = getNafesMastery(A.savedPercent(a));
      const attemptsList = studentMap.get(sKey) || [];
      const attemptIdx = attemptsList.findIndex(x => x.id === a.id);
      const attemptBadge = attemptsList.length > 1 
        ? `<span class="badge unmeasured" style="margin-right:6px;font-size:9.5px;">المحاولة ${num(attemptIdx + 1)} من ${num(attemptsList.length)}</span>` 
        : '';

      return {
        trendDir: trend.direction,
        cells: [
          num(i + 1),
          `<button type="button" class="text-button" data-student="${E(sKey)}" style="font-weight:900;font-size:13px;">${E(a.student_name)}</button>${attemptBadge}<small class="muted">${date(a.submitted_at)}</small>`,
          E(a.class_name || '—'),
          `${num(a.score)} من ${num(a.total)}`,
          pct(A.savedPercent(a)),
          mastery.badgeHtml,
          `${num(a.score)} صحيح`,
          trend.badgeHtml,
          `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <button type="button" class="button small" data-paper="${E(a.id)}" data-source="${E(a.source)}" title="عرض ورقة الإجابة المحفوظة">ورقة الاختبار</button>
            <button type="button" class="button small" data-student="${E(sKey)}" title="عرض التحليل المستقل للطالب">تحليل الطالب ←</button>
          </div>`
        ]
      };
    });
  } else {
    rows = report.rows.map((r, i) => {
      const rawScore = r.latest ? `${num(r.latest.score)} من ${num(r.latest.total)}` : 'لم يسلّم';
      const percentVal = r.latest ? A.savedPercent(r.latest) : null;
      const mastery = getNafesMastery(percentVal);

      const studentHistory = rawAttempts.filter(a => (a.studentIdentity || A.studentIdentity(a)) === r.key && r.latest && A.compareTime(a, r.latest) < 0).sort(A.compareTime).reverse();
      const trend = getFairTrend(r.latest, studentHistory);
      const correctCount = r.measured.total ? `صحيح: ${num(r.measured.correct)} · خطأ: ${num(r.measured.total - r.measured.correct)}` : '—';

      return {
        trendDir: trend.direction,
        cells: [
          num(i + 1),
          `<button type="button" class="text-button" data-student="${E(r.key)}" style="font-weight:900;font-size:13px;">${E(r.student.student_name)}</button>`,
          E(r.student.class_name || '—'),
          rawScore,
          pct(percentVal),
          mastery.badgeHtml,
          correctCount,
          trend.badgeHtml,
          `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            ${r.latest ? `<button type="button" class="button small" data-paper="${E(r.latest.id)}" data-source="${E(r.latest.source)}" title="عرض ورقة الإجابة المحفوظة">ورقة الاختبار</button>` : ''}
            <button type="button" class="button small" data-student="${E(r.key)}" title="عرض التحليل المستقل للطالب">تحليل الطالب ←</button>
          </div>`
        ]
      };
    });
  }

  if (filters.trend) {
    rows = rows.filter(r => r.trendDir === filters.trend);
  }

  const policyLabels = { latest: 'آخر محاولة لكل طالب (افتراضي)', highest: 'أعلى محاولة لكل طالب', first: 'أول محاولة لكل طالب', all: 'جميع المحاولات (تراكمي)' };
  const renderedCells = rows.map(r => r.cells);

  container.innerHTML = `
    <div class="card">
      <div class="section-heading">
        <div>
          <h2>قائمة نتائج الطلاب المسلّمين (${num(rows.length)})</h2>
          <p class="muted">السياسة المطبقة: <b>${policyLabels[policy] || policy}</b>. اضغط على اسم الطالب لعرض ملفه التراكمي ونقاط القوة والضعف.</p>
        </div>
      </div>
      ${renderTable(['#', 'اسم الطالب', 'الفصل', 'الدرجة', 'النسبة', 'مستوى إتقان نافس', 'الإجابات', 'الاتجاه العادل', 'الإجراءات'], renderedCells)}
    </div>
  `;
}

// Indicators Subtab
function renderIndicatorsTab(report, test, scopedAttempts = []) {
  const container = $('tabIndicatorsView');
  const measured = report.indicators.filter(g => g.measuredStudents);
  const sample = scopedAttempts.find(a => a.questions && a.questions.length);

  const rows = measured.map(g => {
    const questionsForIndicator = sample 
      ? sample.questions.filter(q => A.indicatorKey(q) === g.key && A.isScorable(q)).length 
      : (g.measuredStudents ? Math.round(g.total / g.measuredStudents) : 0);
    const masteryStatus = getNafesMastery(g.percent, questionsForIndicator);
    const priority = getIndicatorPriority(g, questionsForIndicator, g.measuredStudents);

    return [
      `<button type="button" class="text-button" data-indicator="${E(g.key)}" style="font-weight:800;text-align:right;">${E(g.text)}</button>`,
      pct(g.percent),
      pct(g.masteryRate),
      masteryStatus.badgeHtml,
      `<span class="badge ${priority.class}">${priority.label}</span>`,
      g.measuredStudents ? `متقن: ${num(g.mastered)} · دون الإتقان: ${num(g.measuredStudents - g.mastered)}` : 'لم يُقَس',
      `${num(questionsForIndicator)} أسئلة · ${num(g.measuredStudents)} طالبًا`,
      `<button type="button" class="button small" data-indicator="${E(g.key)}">عرض الطلاب ←</button>`
    ];
  });

  container.innerHTML = `
    <div class="card">
      <div class="section-heading">
        <div>
          <h2>تحليل إتقان المؤشرات المقاسة وأولويات التدخل</h2>
          <p class="muted">نسب إتقان كل مؤشر مع التحقق من كفاية الأدلة (يلزم سؤالان على الأقل لإصدار حكم موثوق). اضغط على أي مؤشر لعرض الطلاب المتأثرين به.</p>
        </div>
      </div>
      ${renderTable(['المؤشر المقاس', 'متوسط الأداء', 'نسبة إتقان الطلاب', 'حكم الإتقان', 'أولوية التدخل', 'توزيع الطلاب', 'كفاية الأدلة', 'الإجراء'], rows)}
    </div>
  `;
}

// Questions Analysis with Distractor Analysis
function renderQuestionsTab(report, test) {
  const container = $('tabQuestionsView');
  renderQuestionsWithDistractors(container, report.questions);
}

function renderQuestionsWithDistractors(container, questionsList) {
  const measuredQuestions = questionsList.filter(g => g.measured);

  const rows = measuredQuestions.map((g, i) => {
    const optionLetters = ['أ', 'ب', 'ج', 'د'];
    const counts = [0, 0, 0, 0];
    let skipped = 0;
    let total = 0;
    let correctIdx = null;

    if (g.example?.questions) {
      for (const a of rawAttempts.filter(A.isSubmitted)) {
        const matchingQ = (a.questions || []).find(q => A.questionFingerprint(q) === g.fingerprint);
        if (matchingQ) {
          total++;
          if (matchingQ.correct_index !== null && correctIdx === null) correctIdx = matchingQ.correct_index;
          if (matchingQ.answer === null || matchingQ.answer === undefined) {
            skipped++;
          } else if (Number.isInteger(matchingQ.answer) && matchingQ.answer >= 0 && matchingQ.answer < 4) {
            counts[matchingQ.answer]++;
          }
        }
      }
    }

    const distractorPcts = counts.map(c => total > 0 ? Math.round((c / total) * 100) : 0);
    const skippedPct = total > 0 ? Math.round((skipped / total) * 100) : 0;

    let maxDistractorIdx = null;
    let maxDistractorCount = -1;
    for (let o = 0; o < 4; o++) {
      if (o !== correctIdx && counts[o] > maxDistractorCount) {
        maxDistractorCount = counts[o];
        maxDistractorIdx = o;
      }
    }

    const attractivePct = maxDistractorIdx !== null ? distractorPcts[maxDistractorIdx] : 0;
    const isHighlyAttractive = attractivePct >= 25;

    const distractorBarsHtml = `
      <div class="distractor-grid">
        ${optionLetters.map((letter, idx) => {
          const isCorrect = idx === correctIdx;
          const isAtt = idx === maxDistractorIdx && counts[idx] > 0;
          return `
            <div class="distractor-item ${isCorrect ? 'is-correct' : ''} ${isAtt ? 'is-attractive' : ''}">
              <div class="distractor-head">
                <span><b>${letter}</b> ${isCorrect ? '✓' : ''}</span>
                <span>${distractorPcts[idx]}٪ (${num(counts[idx])})</span>
              </div>
              <div class="distractor-track">
                <div class="distractor-fill" style="width:${distractorPcts[idx]}%"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      ${skipped > 0 ? `<small class="muted" style="display:block;margin-top:4px;">لم يجب على السؤال: ${skippedPct}٪ (${num(skipped)} طالبًا)</small>` : ''}
      ${isHighlyAttractive ? `<span class="distractor-notice">⚠️ المشتت (${optionLetters[maxDistractorIdx]}) جذب ${attractivePct}٪ من الطلاب</span>` : ''}
    `;

    return [
      num(i + 1),
      `<div style="font-weight:700;line-height:1.7;">${E(g.question)}</div><small class="muted">${E(g.indicator_text)}</small>`,
      names[g.subject] || g.subject || '—',
      `${num(g.wrong)} من ${num(g.measured)} (${pct(g.failureRate)})`,
      distractorBarsHtml
    ];
  });

  container.innerHTML = `
    <div class="card">
      <div class="section-heading">
        <div>
          <h2>تحليل الأسئلة ومشتتات الإجابة (Distractor Analysis)</h2>
          <p class="muted">مرتبة تنازلياً حسب نسبة الخطأ، مع تفصيل توزيع اختيارات الطلاب للبدائل (أ، ب، ج، د) وتحديد المشتت الأكثر جذباً.</p>
        </div>
      </div>
      ${renderTable(['#', 'نص السؤال والمؤشر', 'المادة', 'معدل الخطأ', 'توزيع البدائل والمشتتات'], rows)}
    </div>
  `;
}

// Absent Students Subtab
function renderAbsentTab(test) {
  const container = $('tabAbsentView');
  const targetClass = test.class_name;
  const eligibleStudents = studentsRoster.filter(s => s.is_active !== false && (!targetClass || s.class_name === targetClass));

  const testSubmissions = rawAttempts.filter(a => a.test_id === test.id && A.isSubmitted(a));
  const submittedKeys = new Set(testSubmissions.map(a => a.student_id || a.student_key || a.studentIdentity));
  const absentList = eligibleStudents.filter(s => !submittedKeys.has(s.id));

  if (!absentList.length) {
    container.innerHTML = `
      <div class="card empty-state" style="border-color:#bce1d5;background:#f6fcf9;">
        <h3 style="color:#1f6151;">🎉 لا يوجد طلاب متغيبون</h3>
        <p>جميع طلاب الفصل المسجلين (${num(eligibleStudents.length)} طالبًا) أتموا تسليم هذا الاختبار بنجاح!</p>
      </div>
    `;
    return;
  }

  const rows = absentList.map((s, i) => [
    num(i + 1),
    `<b>${E(s.full_name || s.student_name)}</b>`,
    E(s.grade || 'الصف الثالث المتوسط'),
    E(s.class_name || 'غير محدد'),
    `<span class="badge support">لم يسلّم بعد</span>`
  ]);

  container.innerHTML = `
    <div class="card">
      <div class="section-heading">
        <div>
          <h2>الطلاب الذين لم يؤدوا هذا الاختبار (${num(absentList.length)} طالبًا)</h2>
          <p class="muted">مقارنة كشف الطلاب الفعلي بجدول nafes_students بالمسلمين عبر student_id.</p>
        </div>
      </div>
      ${renderTable(['#', 'اسم الطالب', 'الصف', 'الفصل', 'الحالة'], rows)}
    </div>
  `;
}

// Official School Report Subtab
function renderOfficialReportTab(report, test) {
  const container = $('tabOfficialReportView');
  const isMulti = (test.subjects || []).length > 1;
  container.innerHTML = buildOfficialPrintReport(report, test, isMulti, false);
}

// ==========================================================================
// PILLAR 3: STUDENTS DIRECT HUB & PROFILES
// ==========================================================================
function renderStudentsSection(f) {
  const wrap = $('studentsCatalogTableWrap');
  const search = ($('studentRosterSearch')?.value || '').trim().toLowerCase();
  let activeStudents = studentsRoster.filter(s => s.is_active !== false);

  if (search) {
    activeStudents = activeStudents.filter(s =>
      (s.full_name || s.student_name || '').toLowerCase().includes(search) ||
      (s.class_name || '').toLowerCase().includes(search)
    );
  }

  const rows = activeStudents.map((s, i) => {
    const studentHistory = rawAttempts.filter(a => a.student_id === s.id || (a.studentIdentity || A.studentIdentity(a)).includes(s.id));
    const submitted = studentHistory.filter(A.isSubmitted);
    const avgScore = A.mean(submitted.map(A.savedPercent));
    const mastery = getNafesMastery(avgScore);

    return [
      num(i + 1),
      `<button type="button" class="text-button" data-student="${E(s.id)}" style="font-weight:900;font-size:13px;">${E(s.full_name || s.student_name)}</button>`,
      E(s.grade || 'الصف الثالث المتوسط'),
      E(s.class_name || 'غير مسجل'),
      num(submitted.length),
      pct(avgScore),
      mastery.badgeHtml,
      `<button type="button" class="button small" data-student="${E(s.id)}">عرض الملف التراكمي ←</button>`
    ];
  });

  wrap.innerHTML = renderTable(['#', 'اسم الطالب', 'الصف', 'الفصل', 'الاختبارات المسلمة', 'متوسط الأداء', 'المستوى العام', 'الإجراء'], rows);
}

// Student Profile Detailed View
function showStudent(key) {
  selectedStudentKey = key;
  syncUrl();
  updateBreadcrumbs();

  const history = rawAttempts.filter(a => (a.studentIdentity || A.studentIdentity(a)) === key || a.student_id === key);
  const r = A.studentRows(history)[0];
  if (!r) return;

  const records = history.filter(A.isSubmitted).sort(A.compareTime);
  const reliable = records.filter(A.isAnalyzable);
  const avg = A.mean(reliable.map(A.savedPercent));
  const skills = r.skills.filter(s => s.latest);
  const current = A.mean(skills.map(s => s.latest.percent));

  const sortedSkills = skills.slice().sort((a, b) => b.latest.percent - a.latest.percent);
  const topStrengths = sortedSkills.slice(0, 5);
  const topWeaknesses = sortedSkills.slice().reverse().slice(0, 5);
  const repeatedWeaknesses = skills.filter(s => s.repeated);

  const skillRows = skills.map(s => {
    const p = s.latest.percent;
    const qCount = s.latest.total || 0;
    const masteryStatus = getNafesMastery(p, qCount);
    return [
      E(s.latest.text),
      pct(p),
      masteryStatus.badgeHtml,
      `${num(s.latest.correct)} من ${num(s.latest.total)}`,
      s.repeated ? '<span class="badge down">ضعف متكرر</span>' : '<span class="badge stable">طبيعي</span>'
    ];
  });

  const body = `
    <section class="card student-detail-card">
      <div class="student-profile-head">
        <div class="student-avatar-box">${E(r.student.student_name.charAt(0))}</div>
        <div class="student-info-main">
          <h1>${E(r.student.student_name)}</h1>
          <div class="student-meta-tags">
            <span class="info-pill">الصف: ${E(r.student.grade || 'الصف الثالث المتوسط')}</span>
            <span class="info-pill">الفصل: ${E(r.student.class_name || 'غير مسجل')}</span>
            <span class="info-pill highlight">مستوى نافس العام: ${getNafesMastery(current).badgeHtml}</span>
          </div>
        </div>
      </div>

      <div class="summary-grid">
        <div class="metric"><span>الاختبارات المسلّمة</span><strong>${num(records.length)}</strong></div>
        <div class="metric"><span>متوسط نسبة الإتقان</span><strong>${pct(avg)}</strong></div>
        <div class="metric"><span>نقاط الضعف المتكررة</span><strong>${num(repeatedWeaknesses.length)}</strong></div>
        <div class="metric"><span>آخر نتيجة محفوظة</span><strong>${r.latest ? `${num(r.latest.score)} من ${num(r.latest.total)}` : '—'}</strong></div>
      </div>

      <h2>📈 تطور مستوى الطالب عبر المحاولات</h2>
      ${renderTrendChart(records)}

      <h2>🎯 نقاط القوة والضعف (أهم ٥ مؤشرات)</h2>
      <div class="two-columns">
        <div class="card tier-mastered" style="margin-top:0;">
          <h4>🌟 أقوى ٥ مؤشرات تميز</h4>
          <ul style="margin:10px 0 0;padding-right:20px;font-size:12px;line-height:1.9;">
            ${topStrengths.length ? topStrengths.map(s => `<li>${E(s.latest.text)} (${pct(s.latest.percent)})</li>`).join('') : '<li class="muted">لا توجد مؤشرات كافية</li>'}
          </ul>
        </div>
        <div class="card tier-weak" style="margin-top:0;">
          <h4>🚨 أهم ٥ مؤشرات بحاجة لدعم عاجل</h4>
          <ul style="margin:10px 0 0;padding-right:20px;font-size:12px;line-height:1.9;">
            ${topWeaknesses.length ? topWeaknesses.map(s => `<li>${E(s.latest.text)} (${pct(s.latest.percent)}) ${s.repeated ? '⚠️ ضعف متكرر' : ''}</li>`).join('') : '<li class="muted">لا توجد نقاط ضعف مسجلة</li>'}
          </ul>
        </div>
      </div>

      <h2>تحليل المؤشرات التفصيلي</h2>
      ${renderTable(['المؤشر', 'النسبة المئوية', 'مستوى الإتقان', 'الصحيح / المقاس', 'المتابعة والتكرار'], skillRows)}

      <h2>سجل الاختبارات وأوراق الإجابة الفعلية</h2>
      ${history.length ? renderTable(
        ['الاختبار والتاريخ', 'الدرجة', 'النسبة', 'الحالة', 'ورقة الإجابة'],
        history.slice().sort(A.compareTime).reverse().map(a => [
          `${E(a.title)}<br><small class="muted">${date(a.submitted_at || a.started_at)}</small>`,
          A.isSubmitted(a) ? `${num(a.score)} من ${num(a.total)}` : 'لم يسلّم',
          pct(A.savedPercent(a)),
          A.isSubmitted(a) ? getNafesMastery(A.savedPercent(a)).badgeHtml : '<span class="badge in_progress">قيد الاختبار</span>',
          `<button type="button" class="button small no-print" data-paper="${E(a.id)}" data-source="${E(a.source)}">عرض ورقة الاختبار ←</button>`
        ])
      ) : '<p class="muted">لم يدخل الطالب اختبارات بعد.</p>'}
    </section>
  `;

  const printBody = `
    <article class="card official-report-card print-page-match">
      <header class="print-header">
        <div class="print-header-right">
          <p class="print-gov">المملكة العربية السعودية</p>
          <p class="print-gov">وزارة التعليم</p>
          <p>الإدارة العامة للتعليم بالمنطقة</p>
          <p>تقرير الأداء الفردي للطالب</p>
        </div>
        <div class="print-header-center">
          <div class="moe-emblem-box">
            <svg class="moe-emblem" viewBox="0 0 120 32" width="120" height="32" aria-label="شعار وزارة التعليم">
              <circle cx="60" cy="5" r="3.2" fill="#1b8a5a"/>
              <circle cx="51" cy="9" r="2.8" fill="#1b8a5a"/>
              <circle cx="69" cy="9" r="2.8" fill="#1b8a5a"/>
              <circle cx="43" cy="14" r="2.5" fill="#1b8a5a"/>
              <circle cx="77" cy="14" r="2.5" fill="#1b8a5a"/>
              <circle cx="55" cy="16" r="3.0" fill="#0f6b63"/>
              <circle cx="65" cy="16" r="3.0" fill="#0f6b63"/>
              <circle cx="37" cy="21" r="2.3" fill="#1b8a5a"/>
              <circle cx="83" cy="21" r="2.3" fill="#1b8a5a"/>
              <circle cx="49" cy="23" r="2.8" fill="#0f6b63"/>
              <circle cx="71" cy="23" r="2.8" fill="#0f6b63"/>
              <circle cx="60" cy="22" r="3.2" fill="#0f6b63"/>
            </svg>
            <h1 style="font-size:12pt;margin:2px 0 0;color:#135245;font-weight:900;">وزارة التعليم</h1>
            <p style="font-size:7.5pt;color:#666;margin:0 0 4px;letter-spacing:.5px;">Ministry of Education</p>
          </div>
          <div class="official-title-banner" style="margin:4px 0 0;">
            <h2 style="font-size:12pt;margin:0;">ملف المتابعة والتشخيص الفردي لنواتج التعلم</h2>
          </div>
        </div>
        <div class="print-header-left">
          <div class="print-brand">معلّمي<small>منصة تدريب وتحليل نافس</small></div>
          <p>تاريخ التقرير: ${date(new Date())}</p>
        </div>
      </header>

      <div class="official-meta-cards" style="margin-top:10px;">
        <div class="off-meta-box"><span>اسم الطالب:</span><b>${E(r.student.student_name)}</b></div>
        <div class="off-meta-box"><span>المرحلة / الصف:</span><b>${E(r.student.grade || 'الصف الثالث المتوسط')}</b></div>
        <div class="off-meta-box"><span>الفصل:</span><b>${E(r.student.class_name || 'غير مسجل')}</b></div>
      </div>

      <div class="summary-grid" style="margin-top:10px;">
        <div class="metric"><span>الاختبارات المسلّمة</span><strong>${num(records.length)}</strong></div>
        <div class="metric"><span>متوسط نسبة الإتقان</span><strong>${pct(avg)}</strong></div>
        <div class="metric"><span>نقاط الضعف المتكررة</span><strong>${num(repeatedWeaknesses.length)}</strong></div>
        <div class="metric"><span>مستوى نافس العام</span><strong>${getNafesMastery(current).label}</strong></div>
      </div>

      <h3 style="margin-top:14px;">🎯 أهم مؤشرات التميز والضعف للطالب</h3>
      <div class="two-columns">
        <div class="card tier-mastered" style="margin-top:0;">
          <h4>🌟 أقوى المؤشرات</h4>
          <ul style="margin:8px 0 0;padding-right:18px;font-size:11px;line-height:1.8;">
            ${topStrengths.length ? topStrengths.map(s => `<li>${E(s.latest.text)} (${pct(s.latest.percent)})</li>`).join('') : '<li class="muted">لا توجد مؤشرات كافية</li>'}
          </ul>
        </div>
        <div class="card tier-weak" style="margin-top:0;">
          <h4>🚨 المؤشرات بحاجة لدعم عاجل</h4>
          <ul style="margin:8px 0 0;padding-right:18px;font-size:11px;line-height:1.8;">
            ${topWeaknesses.length ? topWeaknesses.map(s => `<li>${E(s.latest.text)} (${pct(s.latest.percent)}) ${s.repeated ? '⚠️ ضعف متكرر' : ''}</li>`).join('') : '<li class="muted">لا توجد نقاط ضعف مسجلة</li>'}
          </ul>
        </div>
      </div>

      <h3 style="margin-top:14px;">تحليل المؤشرات التفصيلي</h3>
      ${renderTable(['المؤشر', 'النسبة المئوية', 'مستوى الإتقان', 'الصحيح / المقاس', 'المتابعة والتكرار'], skillRows)}

      <h3 style="margin-top:14px;">سجل الاختبارات الفعلية</h3>
      ${history.length ? renderTable(
        ['الاختبار والتاريخ', 'الدرجة', 'النسبة', 'الحالة'],
        history.slice().sort(A.compareTime).reverse().map(a => [
          `${E(a.title)} (${date(a.submitted_at || a.started_at)})`,
          A.isSubmitted(a) ? `${num(a.score)} من ${num(a.total)}` : 'لم يسلّم',
          pct(A.savedPercent(a)),
          A.isSubmitted(a) ? getNafesMastery(A.savedPercent(a)).label : 'قيد الاختبار'
        ])
      ) : '<p class="muted">لم يدخل الطالب اختبارات بعد.</p>'}

      <div class="official-signatures-row" style="margin-top:28px;">
        <div class="off-sig-col"><b>المرشد الطلابي / الموجه:</b><span>_________________</span></div>
        <div class="off-sig-col"><b>معلم/ة المادة:</b><span>_________________</span></div>
        <div class="off-sig-col"><b>مدير/ة المدرسة:</b><span>_________________</span></div>
      </div>
    </article>
  `;

  $('dashboard').hidden = true;
  $('detailPanel').hidden = false;
  $('detailPanel').innerHTML = `
    <div class="detail-top">
      <button class="button secondary" data-back>← العودة</button>
      <button class="button" data-print>🖨️ طباعة التقرير المدرسي للطالب (A4)</button>
    </div>
    ${body}
  `;

  printContent = printBody;
  $('detailPanel').focus();
}

// Student Paper Review Snapshot
async function showPaper(source, id) {
  $('loadState').textContent = 'جارٍ تحميل ورقة الاختبار الأصلية المحفوظة…';
  try {
    const p = await NafesTeacher.api('teacher_paper', { source, attempt_id: id });
    const a = p.attempt;

    const body = `
      <section class="card paper-card">
        <div class="paper-header-info">
          <h1>ورقة اختبار: ${E(a.student_name)}</h1>
          <h2>${E(a.title)}</h2>
          <div class="paper-meta-pills">
            <span>تاريخ البدء: ${E(date(a.started_at))}</span>
            <span>الدرجة: <b>${num(a.score)} من ${num(a.total)}</b> (${pct(a.percent)})</span>
            <span>الزمن المستغرق: ${num(a.elapsed_seconds === null ? null : Math.round(a.elapsed_seconds / 60 * 10) / 10)} دقيقة</span>
          </div>
        </div>

        ${a.snapshot_warning ? `<p class="notice danger">${E(a.snapshot_warning)}</p>` : ''}
        <p class="paper-intro-note">الورقة محفوظة بالترتيب الفعلي للأسئلة والخيارات، مع توضيح إجابة الطالب والإجابة الصحيحة وشرح الحل دون عرض بيانات الهوية.</p>

        ${(p.sections || []).map(s => `
          <div class="paper-section-heading"><h2>${names[s.subject] || s.subject}</h2></div>
          ${(s.questions || []).map((q, i) => `
            <article class="paper-question">
              <header>
                <b>السؤال ${num(i + 1)}</b>
                <span class="${q.correct ? 'badge-correct' : 'badge-wrong'}">
                  ${!A.isSubmitted(a) ? 'محاولة غير مسلمة' : q.scorable ? (q.correct ? '✓ إجابة صحيحة' : q.answer === null ? 'لم يجب' : '✗ إجابة خاطئة') : 'تعذر التصحيح'}
                </span>
              </header>
              <div class="question-indicator">${E(q.indicator_text)}</div>
              ${q.context ? `<div class="question-context">${E(q.context)}</div>` : ''}
              ${window.NafesMedia?.render ? window.NafesMedia.render(q) : ''}
              <p class="question-stem">${E(q.question)}</p>
              <div class="question-options">
                ${(q.options || []).map((o, n) => `
                  <div class="paper-option ${q.correctIndex === n ? 'correct-option' : ''} ${q.answer === n ? 'chosen-option' : ''}">
                    <span>${['أ', 'ب', 'ج', 'د'][n] || n + 1})</span>
                    <div class="option-text">${E(o)}</div>
                    <small class="option-note">${q.answer === n ? 'إجابة الطالب' : ''} ${q.correctIndex === n ? '✓ الصحيحة' : ''}</small>
                  </div>
                `).join('')}
              </div>
              ${q.explanation ? `<p class="answer-explanation">${E(q.explanation)}</p>` : ''}
            </article>
          `).join('')}
        `).join('')}
      </section>
    `;

    $('dashboard').hidden = true;
    $('detailPanel').hidden = false;
    $('detailPanel').innerHTML = `
      <div class="detail-top">
        <button class="button secondary" data-student="${E(a.student_id || a.student_key || A.studentIdentity(a))}">← العودة إلى ملف الطالب</button>
        <button class="button" data-print>🖨️ طباعة ورقة الاختبار</button>
      </div>
      ${body}
    `;

    printContent = body;
    $('detailPanel').focus();
  } catch (err) {
    $('loadErrorText').textContent = err.message;
    $('loadError').hidden = false;
  } finally {
    $('loadState').textContent = '';
  }
}

// Indicator Drill-down Modal (14-Metric Standalone Deep Dive)
function openIndicatorModal(indicatorKey) {
  const modal = $('indicatorDetailModal');
  const title = $('indicatorModalTitle');
  const sub = $('indicatorModalSubtitle');
  const body = $('indicatorModalBody');

  const indMeta = indicators.find(i => i.key === indicatorKey) || { key: indicatorKey, text: indicatorKey, subject: '' };
  const subjName = names[indMeta.subject] || indMeta.subject || 'عام';
  title.textContent = `التحليل المستقل للمؤشر: ${indMeta.text}`;
  sub.textContent = `المادة: ${subjName} · كود المؤشر: ${indicatorKey}`;

  // Gather attempts that test this indicator
  const studentMap = new Map();
  const testIdsSet = new Set();
  let maxQCount = 0;

  for (const a of rawAttempts.filter(A.isSubmitted).slice().sort(A.compareTime)) {
    const qInd = (a.questions || []).filter(q => A.indicatorKey(q) === indicatorKey && A.isScorable(q));
    if (qInd.length) {
      testIdsSet.add(a.test_id);
      if (qInd.length > maxQCount) maxQCount = qInd.length;

      const sKey = a.studentIdentity || A.studentIdentity(a);
      if (!studentMap.has(sKey)) studentMap.set(sKey, []);

      studentMap.get(sKey).push({
        correct: qInd.filter(q => q.correct).length,
        total: qInd.length,
        percent: (qInd.filter(q => q.correct).length / qInd.length) * 100,
        studentName: a.student_name,
        className: a.class_name,
        at: a.submitted_at,
        isSnapshotWarning: !!a.snapshot_warning
      });
    }
  }

  // Categorize students by longitudinal tracking states
  const groups = {
    repeatedWeak: [],
    firstWeak: [],
    improved: [],
    mastered: [],
    insufficient: []
  };

  const validPercentages = [];

  for (const [sKey, records] of studentMap) {
    const latest = records[records.length - 1];
    if (!latest.isSnapshotWarning) {
      validPercentages.push(latest.percent);
    }

    if (latest.total < 2) {
      groups.insufficient.push({
        sKey,
        studentName: latest.studentName,
        className: latest.className,
        percent: latest.percent,
        qCount: latest.total,
        statusLabel: 'أدلة غير كافية (< سؤالين)',
        badgeClass: 'badge-state-insufficient'
      });
      continue;
    }

    const previousRecords = records.slice(0, records.length - 1);
    const hadPreviousWeak = previousRecords.some(r => r.percent < 65);

    if (latest.percent >= 80) {
      if (hadPreviousWeak) {
        groups.improved.push({
          sKey,
          studentName: latest.studentName,
          className: latest.className,
          percent: latest.percent,
          qCount: latest.total,
          statusLabel: 'تحسن بعد ضعف',
          badgeClass: 'badge-state-improved'
        });
      } else {
        groups.mastered.push({
          sKey,
          studentName: latest.studentName,
          className: latest.className,
          percent: latest.percent,
          qCount: latest.total,
          statusLabel: 'متقن مستمر',
          badgeClass: 'badge-state-mastered'
        });
      }
    } else if (latest.percent < 65) {
      const weakAttemptsCount = records.filter(r => r.percent < 65).length;
      if (weakAttemptsCount >= 2) {
        groups.repeatedWeak.push({
          sKey,
          studentName: latest.studentName,
          className: latest.className,
          percent: latest.percent,
          qCount: latest.total,
          statusLabel: `ضعف متكرر (${num(weakAttemptsCount)} مرات)`,
          badgeClass: 'badge-state-repeated-weak'
        });
      } else {
        groups.firstWeak.push({
          sKey,
          studentName: latest.studentName,
          className: latest.className,
          percent: latest.percent,
          qCount: latest.total,
          statusLabel: 'ضعف لأول مرة',
          badgeClass: 'badge-state-first-weak'
        });
      }
    } else {
      // 65% - 79% (near mastery)
      if (hadPreviousWeak) {
        groups.improved.push({
          sKey,
          studentName: latest.studentName,
          className: latest.className,
          percent: latest.percent,
          qCount: latest.total,
          statusLabel: 'تحسن وقريب من الإتقان',
          badgeClass: 'badge-state-improved'
        });
      } else {
        groups.mastered.push({
          sKey,
          studentName: latest.studentName,
          className: latest.className,
          percent: latest.percent,
          qCount: latest.total,
          statusLabel: 'قريب من الإتقان',
          badgeClass: 'badge-state-mastered'
        });
      }
    }
  }

  // 14 Core Metrics Calculation
  const totalStudents = studentMap.size;
  const avgPercent = A.mean(validPercentages);
  const masteredTotal = groups.mastered.length + groups.improved.filter(s => s.percent >= 80).length;
  const nearTotal = groups.mastered.filter(s => s.percent < 80).length + groups.improved.filter(s => s.percent < 80).length;
  const supportTotal = groups.firstWeak.filter(s => s.percent >= 50).length + groups.repeatedWeak.filter(s => s.percent >= 50).length;
  const nonMasteredTotal = groups.firstWeak.filter(s => s.percent < 50).length + groups.repeatedWeak.filter(s => s.percent < 50).length;
  const insufficientTotal = groups.insufficient.length;

  const masteryRate = totalStudents > 0 ? Math.round((masteredTotal / totalStudents) * 1000) / 10 : null;
  const masteryJudgment = getNafesMastery(avgPercent, maxQCount);
  const priority = getIndicatorPriority({ percent: avgPercent }, maxQCount, totalStudents, groups.repeatedWeak.length);
  const evidenceSufficiency = maxQCount >= 2 ? 'أدلة كافية (سؤالان فأكثر)' : 'أدلة غير كافية (سؤال واحد)';

  // Overall indicator trend
  let overallTrendText = 'مستقر';
  let overallTrendClass = 'stable';
  if (groups.improved.length > groups.repeatedWeak.length) {
    overallTrendText = `تحسن (+${num(groups.improved.length)} طالبًا)`;
    overallTrendClass = 'up';
  } else if (groups.repeatedWeak.length > groups.improved.length) {
    overallTrendText = `تراجع (${num(groups.repeatedWeak.length)} ضعف متكرر)`;
    overallTrendClass = 'down';
  }

  // Segmented Bar Widths
  const mPct = totalStudents > 0 ? Math.round((masteredTotal / totalStudents) * 100) : 0;
  const nPct = totalStudents > 0 ? Math.round((nearTotal / totalStudents) * 100) : 0;
  const sPct = totalStudents > 0 ? Math.round((supportTotal / totalStudents) * 100) : 0;
  const nmPct = totalStudents > 0 ? Math.round((nonMasteredTotal / totalStudents) * 100) : 0;
  const insPct = totalStudents > 0 ? Math.max(0, 100 - (mPct + nPct + sPct + nmPct)) : 0;

  body.innerHTML = `
    <div class="indicator-deepdive-head">
      <h3>🎯 بطاقة التشخيص المعياري للمؤشر</h3>
      <p class="muted" style="margin:4px 0 0;font-size:12px;line-height:1.8;">
        تحليل مستقل يعزل أداء الطلاب في هذا المؤشر عبر جميع الاختبارات، مع تتبع التكرار والتحسن واستبعاد المحاولات القديمة من نسب الإتقان.
      </p>
    </div>

    <!-- 14 Metrics Display Grid -->
    <div class="indicator-metrics-strip">
      <div class="ind-metric-card"><span>١. كود المؤشر</span><b style="font-size:11px;word-break:break-all;">${E(indicatorKey)}</b></div>
      <div class="ind-metric-card"><span>٢. المادة</span><b>${E(subjName)}</b></div>
      <div class="ind-metric-card"><span>٣. الاختبارات المشمولة</span><b>${num(testIdsSet.size)} اختبار</b></div>
      <div class="ind-metric-card"><span>٤. الطلاب المقاسون</span><b>${num(totalStudents)} طالبًا</b></div>
      <div class="ind-metric-card"><span>٥. متوسط الأداء</span><b style="color:var(--brand);">${pct(avgPercent)}</b></div>
      <div class="ind-metric-card"><span>٦. نسبة إتقان نافس</span><b>${pct(masteryRate)}</b></div>
      <div class="ind-metric-card"><span>٧. حكم إتقان المؤشر</span><b>${masteryJudgment.badgeHtml}</b></div>
      <div class="ind-metric-card"><span>٨. أولوية التدخل</span><b><span class="badge ${priority.class}">${priority.label}</span></b></div>
      <div class="ind-metric-card"><span>٩. كفاية الأدلة</span><b><small>${evidenceSufficiency}</small></b></div>
      <div class="ind-metric-card"><span>١٠. أقصى أسئلة مقاسة</span><b>${num(maxQCount)} أسئلة</b></div>
      <div class="ind-metric-card"><span>١١. حالات الضعف المتكرر</span><b style="color:#c5221f;">${num(groups.repeatedWeak.length)}</b></div>
      <div class="ind-metric-card"><span>١٢. حالات التحسن بعد ضعف</span><b style="color:#1a73e8;">${num(groups.improved.length)}</b></div>
      <div class="ind-metric-card"><span>١٣. حالات الضعف لأول مرة</span><b style="color:#b06000;">${num(groups.firstWeak.length)}</b></div>
      <div class="ind-metric-card"><span>١٤. الاتجاه العام للمؤشر</span><b><span class="badge ${overallTrendClass}">${overallTrendText}</span></b></div>
    </div>

    <!-- SVG Horizontal Distribution Bar -->
    <div class="distrib-chart-box">
      <h4>📊 التوزيع النسبي لمستويات الطلاب في هذا المؤشر</h4>
      <div class="svg-level-bar">
        <div class="svg-level-seg mastered" style="width:${mPct}%" title="متقن: ${num(masteredTotal)} (${mPct}٪)"></div>
        <div class="svg-level-seg near" style="width:${nPct}%" title="قريب من الإتقان: ${num(nearTotal)} (${nPct}٪)"></div>
        <div class="svg-level-seg support" style="width:${sPct}%" title="بحاجة إلى دعم: ${num(supportTotal)} (${sPct}٪)"></div>
        <div class="svg-level-seg nonmastered" style="width:${nmPct}%" title="غير متقن: ${num(nonMasteredTotal)} (${nmPct}٪)"></div>
        <div class="svg-level-seg insufficient" style="width:${insPct}%" title="أدلة غير كافية: ${num(insufficientTotal)} (${insPct}٪)"></div>
      </div>
      <div class="distrib-legend">
        <span><span class="legend-dot" style="background:#1b8a5a"></span> متقن: ${num(masteredTotal)} (${mPct}٪)</span>
        <span><span class="legend-dot" style="background:#c29d38"></span> قريب من الإتقان: ${num(nearTotal)} (${nPct}٪)</span>
        <span><span class="legend-dot" style="background:#e07b22"></span> بحاجة لدعم: ${num(supportTotal)} (${sPct}٪)</span>
        <span><span class="legend-dot" style="background:#d93025"></span> غير متقن: ${num(nonMasteredTotal)} (${nmPct}٪)</span>
        <span><span class="legend-dot" style="background:#9aa0a6"></span> أدلة غير كافية: ${num(insufficientTotal)} (${insPct}٪)</span>
      </div>
    </div>

    <!-- Section 1: Urgent Repeated Weakness -->
    ${groups.repeatedWeak.length ? `
      <div class="affected-students-group" style="border-color:#fad2cf;">
        <div class="affected-group-title" style="color:#a51d24;background:#fce8e6;">
          <span>🚨 حالات الضعف المتكرر (أولوية تدخل علاجية قصوى)</span>
          <b>${num(groups.repeatedWeak.length)} طالبًا</b>
        </div>
        ${renderTable(['اسم الطالب', 'الفصل', 'النسبة', 'الحالة التتبعية', 'الإجراء'], groups.repeatedWeak.map(s => [
          `<b>${E(s.studentName)}</b>`,
          E(s.className || '—'),
          pct(s.percent),
          `<span class="${s.badgeClass}">${s.statusLabel}</span>`,
          `<button type="button" class="button small" data-student="${E(s.sKey)}">ملف الطالب ←</button>`
        ]))}
      </div>
    ` : ''}

    <!-- Section 2: First-time Weakness -->
    ${groups.firstWeak.length ? `
      <div class="affected-students-group" style="border-color:#feefc3;">
        <div class="affected-group-title" style="color:#b06000;background:#fef7e0;">
          <span>⚠️ حالات الضعف لأول مرة (تحتاج متابعة وقائية)</span>
          <b>${num(groups.firstWeak.length)} طالبًا</b>
        </div>
        ${renderTable(['اسم الطالب', 'الفصل', 'النسبة', 'الحالة التتبعية', 'الإجراء'], groups.firstWeak.map(s => [
          `<b>${E(s.studentName)}</b>`,
          E(s.className || '—'),
          pct(s.percent),
          `<span class="${s.badgeClass}">${s.statusLabel}</span>`,
          `<button type="button" class="button small" data-student="${E(s.sKey)}">ملف الطالب ←</button>`
        ]))}
      </div>
    ` : ''}

    <!-- Section 3: Improved Students -->
    ${groups.improved.length ? `
      <div class="affected-students-group" style="border-color:#c2e7ff;">
        <div class="affected-group-title" style="color:#004a77;background:#e8f0fe;">
          <span>📈 حالات أظهرت تحسناً بعد ضعف سابق</span>
          <b>${num(groups.improved.length)} طالبًا</b>
        </div>
        ${renderTable(['اسم الطالب', 'الفصل', 'النسبة', 'الحالة التتبعية', 'الإجراء'], groups.improved.map(s => [
          `<b>${E(s.studentName)}</b>`,
          E(s.className || '—'),
          pct(s.percent),
          `<span class="${s.badgeClass}">${s.statusLabel}</span>`,
          `<button type="button" class="button small" data-student="${E(s.sKey)}">ملف الطالب ←</button>`
        ]))}
      </div>
    ` : ''}

    <!-- Section 4: Mastered Students -->
    ${groups.mastered.length ? `
      <div class="affected-students-group" style="border-color:#bce1d5;">
        <div class="affected-group-title" style="color:#1f6151;background:#f0fdf4;">
          <span>🌟 الطلاب المتقنون (٨٠٪ فأكثر)</span>
          <b>${num(groups.mastered.length)} طالبًا</b>
        </div>
        ${renderTable(['اسم الطالب', 'الفصل', 'النسبة', 'الحالة', 'الإجراء'], groups.mastered.map(s => [
          `<b>${E(s.studentName)}</b>`,
          E(s.className || '—'),
          pct(s.percent),
          `<span class="${s.badgeClass}">${s.statusLabel}</span>`,
          `<button type="button" class="button small" data-student="${E(s.sKey)}">ملف الطالب ←</button>`
        ]))}
      </div>
    ` : ''}

    <!-- Section 5: Insufficient Evidence -->
    ${groups.insufficient.length ? `
      <div class="affected-students-group" style="border-color:#e0e0e0;">
        <div class="affected-group-title" style="color:#5f6368;background:#f8f9fa;">
          <span>ℹ️ أدلة غير كافية (عدد الأسئلة المقاسة أقل من سؤالين)</span>
          <b>${num(groups.insufficient.length)} طالبًا</b>
        </div>
        ${renderTable(['اسم الطالب', 'الفصل', 'النسبة', 'ملاحظة', 'الإجراء'], groups.insufficient.map(s => [
          `<b>${E(s.studentName)}</b>`,
          E(s.className || '—'),
          pct(s.percent),
          `<span class="${s.badgeClass}">${s.statusLabel}</span>`,
          `<button type="button" class="button small" data-student="${E(s.sKey)}">ملف الطالب ←</button>`
        ]))}
      </div>
    ` : ''}
  `;

  modal.hidden = false;
}

// Trend Line Chart SVG Helper
function renderTrendChart(history) {
  const hs = history.filter(a => A.isAnalyzable(a) && A.savedPercent(a) !== null).sort(A.compareTime);
  if (!hs.length) return '<p class="muted">لا توجد درجات مسجلة للرسم البياني بعد.</p>';

  const width = 800, height = 220, pad = 45;
  const x = i => pad + (hs.length === 1 ? (width - pad * 2) / 2 : i * (width - pad * 2) / (hs.length - 1));
  const y = p => height - pad - p * (height - pad * 2) / 100;

  return `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img">
      ${[0, 25, 50, 75, 100].map(p => `
        <line x1="${pad}" x2="${width - pad}" y1="${y(p)}" y2="${y(p)}" stroke="#dce6e0"/>
        <text x="${pad - 8}" y="${y(p) + 4}" text-anchor="end" font-size="11">${num(p)}٪</text>
      `).join('')}
      <polyline points="${hs.map((a, i) => `${x(i)},${y(A.savedPercent(a))}`).join(' ')}" fill="none" stroke="#0f6b63" stroke-width="3"/>
      ${hs.map((a, i) => `
        <circle cx="${x(i)}" cy="${y(A.savedPercent(a))}" r="5" fill="#0f6b63">
          <title>${E(a.title)} · ${date(a.submitted_at)} · ${pct(A.savedPercent(a))}</title>
        </circle>
        ${hs.length <= 12 ? `<text x="${x(i)}" y="${height - 12}" text-anchor="middle" font-size="10">${num(i + 1)}</text>` : ''}
      `).join('')}
    </svg>
  `;
}

// Donut Progress Gauges (5 Circular Progress Rings)
function renderDonutGauges(counts, total) {
  const grades = [
    { key: 'excellent', label: 'ممتاز', count: counts.excellent || 0, color: '#1b8a5a' },
    { key: 'vgood', label: 'جيد جداً', count: counts.vgood || 0, color: '#0f8b8d' },
    { key: 'good', label: 'جيد', count: counts.good || 0, color: '#2196f3' },
    { key: 'pass', label: 'مقبول', count: counts.pass || 0, color: '#ff9800' },
    { key: 'fail', label: 'راسب', count: counts.fail || 0, color: '#e53935' }
  ];
  const r = 36;
  const circumference = 2 * Math.PI * r;

  return `<div class="donut-gauges-grid">
    ${grades.map(g => {
      const p = total > 0 ? Math.round((g.count / total) * 100) : 0;
      const offset = circumference - (p / 100) * circumference;
      return `<div class="donut-gauge-item">
        <div class="donut-circle-wrap">
          <svg viewBox="0 0 100 100">
            <circle class="donut-bg-ring" cx="50" cy="50" r="${r}"></circle>
            <circle class="donut-val-ring" cx="50" cy="50" r="${r}" stroke="${g.color}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
          </svg>
          <div class="donut-center-text">
            <span class="donut-pct">${p > 0 ? p + '٪' : '٠٪'}</span>
          </div>
        </div>
        <span class="donut-label">${g.label}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// Vertical Column Histogram
function renderColumnChart(counts, maxCount) {
  const grades = [
    { key: 'excellent', label: 'ممتاز', count: counts.excellent || 0, color: '#1b8a5a' },
    { key: 'vgood', label: 'جيد جداً', count: counts.vgood || 0, color: '#0f8b8d' },
    { key: 'good', label: 'جيد', count: counts.good || 0, color: '#2196f3' },
    { key: 'pass', label: 'مقبول', count: counts.pass || 0, color: '#ff9800' },
    { key: 'fail', label: 'راسب', count: counts.fail || 0, color: '#e53935' }
  ];
  const max = Math.max(1, maxCount);

  return `<div class="column-chart-grid">
    ${grades.map(g => {
      const h = g.count > 0 ? Math.max(14, Math.round((g.count / max) * 120)) : 0;
      return `<div class="col-bar-group">
        <span class="col-count-num">${g.count > 0 ? num(g.count) : '—'}</span>
        <div class="col-bar-container">
          <div class="col-bar-fill" style="height:${h}px; background:${g.color}"></div>
        </div>
        <span class="col-bar-label">${g.label}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// Build Official School Print Report (Multi-Page Capable)
function buildOfficialPrintReport(report, test, isMultiSubject = false, isPrintMode = true) {
  const s = report.summary;
  const maxScore = Number(test.total) || 100;
  const schoolName = test.school_name || 'متوسطة الرواد';
  const gradeName = test.grade_key === 'middle_3' ? 'الصف الثالث المتوسط' : test.grade_key || 'الصف الثالث المتوسط';
  const teacherName = test.teacher_name || 'معلم/ة المادة';
  const principalName = test.principal_name || 'مدير/ة المدرسة';
  const currentDate = date(new Date());

  const gradeCounts = { excellent: 0, vgood: 0, good: 0, pass: 0, fail: 0 };
  for (const r of report.rows) {
    if (r.measured.percent !== null) {
      const g = getSchoolGrade(r.measured.percent);
      if (gradeCounts[g.key] !== undefined) gradeCounts[g.key]++;
    }
  }
  const totalGraded = report.rows.filter(r => r.measured.percent !== null).length;
  const maxGradeCount = Math.max(1, ...Object.values(gradeCounts));
  const passedCount = gradeCounts.excellent + gradeCounts.vgood + gradeCounts.good + gradeCounts.pass;
  const successRate = totalGraded > 0 ? Math.round((passedCount / totalGraded) * 1000) / 10 : 100;
  const totalSumScore = test.total && s.average !== null ? Math.round((s.average * maxScore / 100) * s.submitted * 10) / 10 : 0;

  return `
    <article class="card official-report-card ${isPrintMode ? 'print-page-match' : ''}">
      <!-- PAGE 1: EXECUTIVE BRIEFING -->
      <header class="print-header">
        <div class="print-header-right">
          <p class="print-gov">المملكة العربية السعودية</p>
          <p class="print-gov">وزارة التعليم</p>
          <p>الإدارة العامة للتعليم بالمنطقة</p>
          <p>مدرسة: <b>${E(schoolName)}</b></p>
        </div>
        <div class="print-header-center">
          <div class="moe-emblem-box">
            <svg class="moe-emblem" viewBox="0 0 120 32" width="120" height="32" aria-label="شعار وزارة التعليم">
              <circle cx="60" cy="5" r="3.2" fill="#1b8a5a"/>
              <circle cx="51" cy="9" r="2.8" fill="#1b8a5a"/>
              <circle cx="69" cy="9" r="2.8" fill="#1b8a5a"/>
              <circle cx="43" cy="14" r="2.5" fill="#1b8a5a"/>
              <circle cx="77" cy="14" r="2.5" fill="#1b8a5a"/>
              <circle cx="55" cy="16" r="3.0" fill="#0f6b63"/>
              <circle cx="65" cy="16" r="3.0" fill="#0f6b63"/>
              <circle cx="37" cy="21" r="2.3" fill="#1b8a5a"/>
              <circle cx="83" cy="21" r="2.3" fill="#1b8a5a"/>
              <circle cx="49" cy="23" r="2.8" fill="#0f6b63"/>
              <circle cx="71" cy="23" r="2.8" fill="#0f6b63"/>
              <circle cx="60" cy="22" r="3.2" fill="#0f6b63"/>
            </svg>
            <h1 style="font-size:12pt;margin:2px 0 0;color:#135245;font-weight:900;">وزارة التعليم</h1>
            <p style="font-size:7.5pt;color:#666;margin:0 0 4px;letter-spacing:.5px;">Ministry of Education</p>
          </div>
          <div class="official-title-banner" style="margin:4px 0 0;">
            <h2 style="font-size:12pt;margin:0;">التقرير المدرسي لتحليل نتائج اختبار [${E(test.title)}]</h2>
          </div>
        </div>
        <div class="print-header-left">
          <div class="print-brand">معلّمي<small>منصة تدريب وتحليل نافس</small></div>
          <p>تاريخ التقرير: ${E(currentDate)}</p>
          <p>رمز الاختبار: <code>${E(test.short_code || test.id?.slice(0, 8))}</code></p>
        </div>
      </header>

      <div class="official-meta-cards">
        <div class="off-meta-box"><span>المرحلة الدراسية / الصف:</span><b>${E(gradeName)}</b></div>
        <div class="off-meta-box"><span>السنة / الفصل الدراسي:</span><b>الفصل الدراسي الثاني</b></div>
        <div class="off-meta-box"><span>درجة القياس (الاختبار):</span><b>${num(maxScore)}</b></div>
      </div>

      <div class="official-stats-split">
        <table class="off-metrics-table">
          <tbody>
            <tr><th>عدد الطلاب</th><td>${num(s.submitted)}</td></tr>
            <tr><th>أعلى درجة</th><td>${s.highest !== null ? num(Math.round(s.highest * maxScore / 100 * 10) / 10) : '—'}</td></tr>
            <tr><th>أقل درجة</th><td>${s.lowest !== null ? num(Math.round(s.lowest * maxScore / 100 * 10) / 10) : '—'}</td></tr>
            <tr><th>متوسط الدرجات</th><td>${s.average !== null ? num(Math.round(s.average * maxScore / 100 * 10) / 10) : '—'}</td></tr>
            <tr><th>نسبة النجاح</th><td>${num(successRate)}٪</td></tr>
            <tr><th>مجموع الدرجات</th><td>${num(totalSumScore)}</td></tr>
          </tbody>
        </table>

        <div class="off-detailed-levels-box">
          <h3>الإحصائيات التفصيلية</h3>
          <table class="off-levels-table">
            <thead><tr><th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th></tr></thead>
            <tbody>
              <tr><td><span class="level-pill excellent">ممتاز</span></td><td>٩٠ - ١٠٠</td><td><b>${num(gradeCounts.excellent)}</b></td></tr>
              <tr><td><span class="level-pill vgood">جيد جداً</span></td><td>٨٠ - ٨٩</td><td><b>${num(gradeCounts.vgood)}</b></td></tr>
              <tr><td><span class="level-pill good">جيد</span></td><td>٧٠ - ٧٩</td><td><b>${num(gradeCounts.good)}</b></td></tr>
              <tr><td><span class="level-pill pass">مقبول</span></td><td>٥٠ - ٦٩</td><td><b>${num(gradeCounts.pass)}</b></td></tr>
              <tr><td><span class="level-pill fail">راسب</span></td><td>٠ - ٤٩</td><td><b>${num(gradeCounts.fail)}</b></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="official-chart-box">
        <span class="off-chart-legend-title">رسم بياني (نسب الطلاب لكل تقدير)</span>
        ${renderDonutGauges(gradeCounts, totalGraded)}
      </div>

      <div class="official-chart-box">
        <span class="off-chart-legend-title">رسم بياني (عدد الطلاب لكل تقدير)</span>
        ${renderColumnChart(gradeCounts, maxGradeCount)}
      </div>

      <div class="official-signatures-row">
        <div class="off-sig-col"><b>معلم/ة المادة:</b><span>${E(teacherName)}</span></div>
        <div class="off-sig-col"><b>مدير/ة المدرسة:</b><span>${E(principalName)}</span></div>
      </div>

      ${isMultiSubject ? `
        <!-- PAGE 2+: DETAILED SUBJECT BREAKDOWNS (NO BLANK PAGES) -->
        ${(test.subjects || []).map(subj => `
          <div class="print-page-break"></div>
          <header class="print-header">
            <div class="print-header-right"><p><b>مدرسة: ${E(schoolName)}</b></p></div>
            <div class="print-header-center"><h3>التحليل التفصيلي لقسم [${names[subj] || subj}] في المحاكاة</h3></div>
            <div class="print-header-left"><p>${E(currentDate)}</p></div>
          </header>
          <p class="muted">يتضمن هذا القسم الأداء المعزول لمادة ${names[subj] || subj} دون دمج درجات المواد الأخرى.</p>
        `).join('')}
      ` : ''}
    </article>
  `;
}

// Print Handler
async function printReport() {
  const node = $('printReport');
  node.innerHTML = printContent;
  node.setAttribute('aria-hidden', 'false');
  node.querySelectorAll('details').forEach(d => d.open = true);
  node.querySelectorAll('button[data-student]').forEach(b => b.replaceWith(document.createTextNode(b.textContent)));
  node.querySelectorAll('button').forEach(b => b.remove());
  node.querySelectorAll('.table-wrap').forEach(x => x.style.overflow = 'visible');

  await document.fonts.ready;
  await Promise.all([...node.querySelectorAll('img')].map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));
  window.print();
}

// Fetch Remote Data
async function load() {
  if (loading) return;
  if (!NafesTeacher.getKey()) {
    $('authPanel').hidden = false;
    return;
  }
  loading = true;
  $('loadError').hidden = true;
  $('authPanel').hidden = true;
  $('loadState').textContent = 'جارٍ تحميل النتائج وسجلات الطلاب الحقيقية…';

  try {
    let cursor = 0, allAttempts = [], testList = [], catalog = [];
    do {
      const d = await NafesTeacher.api('teacher_data', { cursor, limit: 100 });
      allAttempts.push(...d.attempts);
      if (cursor === 0) {
        testList = d.tests || [];
        catalog = d.indicators || [];
      }
      cursor = d.next_cursor;
    } while (cursor !== null);

    try {
      const sData = await NafesTeacher.api('teacher_students_list', { include_archived: false });
      studentsRoster = sData.students || [];
    } catch (_) {
      studentsRoster = [];
    }

    rawAttempts = allAttempts.map(A.normalizeAttempt);
    tests = testList;
    indicators = catalog;

    $('refreshBtn').hidden = false;
    $('signoutBtn').hidden = false;

    handleUrlParams();
    render();

    if (selectedStudentKey) {
      showStudent(selectedStudentKey);
    }
  } catch (err) {
    $('loadError').hidden = false;
    $('loadErrorText').textContent = err.message;
    if (err.status === 401) $('authPanel').hidden = false;
  } finally {
    loading = false;
    $('loadState').textContent = '';
  }
}

// Event Listeners
$('authForm').onsubmit = e => {
  e.preventDefault();
  NafesTeacher.setKey($('teacherKey').value);
  $('teacherKey').value = '';
  load();
};

$('refreshBtn').onclick = load;
$('retryBtn').onclick = load;
$('printBtn').onclick = printReport;

$('signoutBtn').onclick = () => {
  NafesTeacher.clearKey();
  rawAttempts = [];
  tests = [];
  studentsRoster = [];
  selectedTestId = null;
  selectedSubjectKey = null;
  selectedStudentKey = null;
  printContent = '';
  $('dashboard').hidden = true;
  $('detailPanel').hidden = true;
  $('printReport').replaceChildren();
  $('authPanel').hidden = false;
  $('refreshBtn').hidden = true;
  $('signoutBtn').hidden = true;
  $('printBtn').hidden = true;
};

if ($('quickPolicySelect')) {
  $('quickPolicySelect').onchange = () => { render(); };
}

if ($('studentRosterSearch')) {
  $('studentRosterSearch').oninput = () => {
    const f = getFilters();
    renderStudentsSection(f);
  };
}

if ($('closeIndicatorModalBtn')) {
  $('closeIndicatorModalBtn').onclick = () => { $('indicatorDetailModal').hidden = true; };
}
$('indicatorDetailModal').onclick = e => {
  if (e.target === $('indicatorDetailModal')) $('indicatorDetailModal').hidden = true;
};

// Main Delegated Click Handler
document.addEventListener('click', e => {
  // Pillar Navigation
  const pillarBtn = e.target.closest('[data-pillar]');
  if (pillarBtn) {
    currentPillar = pillarBtn.dataset.pillar;
    if (currentPillar === 'subjects') selectedSubjectKey = null;
    if (currentPillar === 'tests') selectedTestId = null;
    if (currentPillar === 'students') selectedStudentKey = null;
    $('detailPanel').hidden = true;
    render();
    return;
  }

  // Subject Selection
  const openSubjBtn = e.target.closest('[data-open-subject]');
  if (openSubjBtn) {
    selectedSubjectKey = openSubjBtn.dataset.openSubject;
    activeSubjectSubtab = 'summary';
    render();
    return;
  }

  // Subject Sub-tabs
  const subjTabBtn = e.target.closest('[data-subject-tab]');
  if (subjTabBtn) {
    activeSubjectSubtab = subjTabBtn.dataset.subjectTab;
    render();
    return;
  }

  // Test Selection
  const openTestBtn = e.target.closest('[data-open-test]');
  if (openTestBtn) {
    selectedTestId = openTestBtn.dataset.openTest;
    currentPillar = 'tests';
    activeTestSubtab = 'summary';
    render();
    return;
  }

  // Test Subtabs
  const testTabBtn = e.target.closest('[data-test-tab]');
  if (testTabBtn) {
    activeTestSubtab = testTabBtn.dataset.testTab;
    render();
    return;
  }

  // Indicator Drill-down Modal
  const indBtn = e.target.closest('[data-indicator]');
  if (indBtn) {
    openIndicatorModal(indBtn.dataset.indicator);
    return;
  }

  // Student Profile
  const studentBtn = e.target.closest('[data-student]');
  if (studentBtn) {
    showStudent(studentBtn.dataset.student);
    return;
  }

  // Test Paper Snapshot
  const paperBtn = e.target.closest('[data-paper]');
  if (paperBtn) {
    showPaper(paperBtn.dataset.source, paperBtn.dataset.paper);
    return;
  }

  if (e.target.closest('[data-print]')) {
    printReport();
    return;
  }

  if (e.target.closest('[data-back]')) {
    selectedStudentKey = null;
    $('detailPanel').hidden = true;
    render();
    return;
  }
});

addEventListener('nafes:auth-required', () => { $('authPanel').hidden = false; });
addEventListener('nafes:auth-changed', e => { if (e.detail.authenticated) load(); });

// Initialize
load();

})();
