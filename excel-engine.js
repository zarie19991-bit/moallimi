/**
 * moallimi - Official Excel Engine & Export Module
 * Assistant 5: Official Excel Export Engine
 * 
 * Generates official multi-sheet .xlsx workbooks with RTL layout, AutoFilter,
 * frozen headers, and complete simulation section breakdowns.
 * Strictly protects student privacy: never exports national ID fragments, student UUIDs, or teacher keys.
 */
(() => {
  'use strict';

  const esc = s => String(s ?? '').trim();
  const round1 = n => Math.round((Number(n) || 0) * 10) / 10;

  const SUBJECT_AR = {
    reading: 'القراءة',
    math: 'الرياضيات',
    science: 'العلوم'
  };

  function hasXLSX() {
    return typeof window.XLSX !== 'undefined';
  }

  function assertXLSX() {
    if (!hasXLSX()) {
      throw new Error('مكتبة Excel غير محملة. يرجى التأكد من وجود ملف xlsx-vendor.js محليًا.');
    }
  }

  function saveWorkbook(wb, filename) {
    assertXLSX();
    window.XLSX.writeFile(wb, filename);
  }

  function formatWorksheet(ws, colWidths, freezeRows = 1) {
    if (!ws) return;
    // Set RTL direction
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ rightToLeft: true, RTL: true });

    // Set Column Widths
    if (colWidths && colWidths.length) {
      ws['!cols'] = colWidths.map(w => ({ wch: w }));
    }

    // Freeze Header Row
    if (freezeRows > 0) {
      ws['!freeze'] = { xSplit: 0, ySplit: freezeRows, topLeftCell: `A${freezeRows + 1}`, activePane: 'bottomLeft' };
    }

    // AutoFilter
    if (ws['!ref']) {
      ws['!autofilter'] = { ref: ws['!ref'] };
    }
    return ws;
  }

  function getNafesLevel(percent) {
    const p = Number(percent) || 0;
    if (p >= 80) return 'متقن';
    if (p >= 65) return 'قريب من الإتقان';
    if (p >= 50) return 'يحتاج دعمًا';
    return 'غير متقن';
  }

  /**
   * 1. Download Student Import Template
   */
  function downloadStudentTemplate() {
    assertXLSX();
    const headers = ['اسم الطالب', 'الصف', 'الفصل', 'آخر 3 أرقام'];
    const dummy = ['أحمد محمد علي الغامدي', 'الثالث المتوسط', '٣/١', '123'];

    const ws = window.XLSX.utils.aoa_to_sheet([headers, dummy]);
    formatWorksheet(ws, [30, 20, 14, 18], 1);

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'نموذج استيراد الطلاب');
    saveWorkbook(wb, 'نموذج_استيراد_الطلاب_نافس.xlsx');
  }

  /**
   * 2. Single Test Excel Export (from analysis.js report)
   */
  function exportSingleTestExcel(test, report, options = {}) {
    assertXLSX();
    const wb = window.XLSX.utils.book_new();
    const testTitle = test.title || 'اختبار نافس';
    const subName = test.subjects?.map(s => SUBJECT_AR[s] || s).join(' · ') || 'نافس';
    const policy = options.policy || 'latest';
    const isAll = policy === 'all';
    const isSim = test.kind === 'simulation' || (test.subjects && test.subjects.length > 1);

    // Sheet 1: ملخص الاختبار
    const s1Data = [
      ['التقرير المدرسي لتحليل نتائج نافس — منصة معلّمي', ''],
      ['اسم الاختبار', testTitle],
      ['المادة / المواد', subName],
      ['الصف الدراسي', test.grade_key === 'middle_3' ? 'الثالث المتوسط' : (test.grade || 'الثالث المتوسط')],
      ['الفصل / الشعبة', test.class_name || 'جميع الفصول'],
      ['رمز الاختبار', test.short_code || '—'],
      ['تاريخ إنشاء / نشر الاختبار', test.created_at ? new Date(test.created_at).toLocaleDateString('ar-SA') : '—'],
      ['سياسة المحاولات المطبقة', isAll ? 'جميع المحاولات' : (policy === 'highest' ? 'أعلى محاولة' : (policy === 'first' ? 'أول محاولة' : 'آخر محاولة'))],
      ['', ''],
      ['مؤشرات الأداء العامة', ''],
      ['عدد الطلاب المختبرين', report.summary?.students ?? (report.students?.length || 0)],
      ['إجمالي عدد المحاولات المسلّمة', report.summary?.totalAttempts ?? (report.students?.length || 0)],
      ['متوسط الأداء العام (%)', `${round1(report.summary?.averagePercent ?? 0)}%`],
      ['أعلى نسبة محققة (%)', `${round1(report.summary?.maxScore ?? 0)}%`],
      ['أقل نسبة محققة (%)', `${round1(report.summary?.minScore ?? 0)}%`],
      ['نسبة الإتقان العامة (نافس)', `${round1(report.summary?.masteryRate ?? 0)}%`],
      ['', ''],
      ['توزيع مستويات الطلاب', 'عدد الطلاب'],
      ['متقن (80% فأعلى)', report.summary?.masteredCount ?? 0],
      ['قريب من الإتقان (65% إلى 79%)', report.summary?.nearCount ?? 0],
      ['بحاجة إلى دعم (50% إلى 64%)', report.summary?.supportCount ?? 0],
      ['غير متقن (أقل من 50%)', report.summary?.nonMasteredCount ?? 0]
    ];
    const ws1 = window.XLSX.utils.aoa_to_sheet(s1Data);
    formatWorksheet(ws1, [34, 34], 0);
    window.XLSX.utils.book_append_sheet(wb, ws1, 'ملخص الاختبار');

    // Sheet 2: درجات الطلاب
    let s2Headers = [];
    let s2Rows = [];

    const activeIndicators = report.indicators || [];

    if (isSim) {
      s2Headers = [
        'اسم الطالب',
        'الفصل',
        'الدرجة الكلية',
        'النسبة العامة',
        'درجة القراءة',
        'نسبة القراءة',
        'درجة الرياضيات',
        'نسبة الرياضيات',
        'درجة العلوم',
        'نسبة العلوم',
        ...activeIndicators.map(i => i.text || i.key)
      ];

      s2Rows = (report.students || []).map(st => {
        const sec = st.section_scores || {};
        const readingScore = sec.reading?.score ?? '—';
        const readingPct = sec.reading?.percent != null ? `${round1(sec.reading.percent)}%` : (sec.reading?.total ? `${round1((sec.reading.score / sec.reading.total) * 100)}%` : '—');
        const mathScore = sec.math?.score ?? '—';
        const mathPct = sec.math?.percent != null ? `${round1(sec.math.percent)}%` : (sec.math?.total ? `${round1((sec.math.score / sec.math.total) * 100)}%` : '—');
        const scienceScore = sec.science?.score ?? '—';
        const sciencePct = sec.science?.percent != null ? `${round1(sec.science.percent)}%` : (sec.science?.total ? `${round1((sec.science.score / sec.science.total) * 100)}%` : '—');

        const indCols = activeIndicators.map(i => {
          const indData = st.indicator_scores?.[i.key];
          if (!indData) return '—';
          return `${indData.score} من ${indData.total} (${round1(indData.percent)}% - ${indData.level})`;
        });

        return [
          st.name || st.student_name || 'طالب',
          st.class_name || '—',
          st.score ?? '—',
          st.percent != null ? `${round1(st.percent)}%` : '—',
          readingScore,
          readingPct,
          mathScore,
          mathPct,
          scienceScore,
          sciencePct,
          ...indCols
        ];
      });
    } else {
      s2Headers = [
        'اسم الطالب',
        'الفصل',
        'الدرجة',
        'الدرجة الكلية',
        'النسبة',
        'الصحيحة',
        'الخاطئة',
        ...activeIndicators.map(i => i.text || i.key)
      ];

      s2Rows = (report.students || []).map(st => {
        const indCols = activeIndicators.map(i => {
          const indData = st.indicator_scores?.[i.key];
          if (!indData) return '—';
          return `${indData.score} من ${indData.total} (${round1(indData.percent)}% - ${indData.level})`;
        });

        return [
          st.name || st.student_name || 'طالب',
          st.class_name || '—',
          st.score ?? '—',
          st.total ?? '—',
          st.percent != null ? `${round1(st.percent)}%` : '—',
          st.correct_count ?? (st.score ?? 0),
          st.incorrect_count ?? Math.max(0, (st.total || 0) - (st.score || 0)),
          ...indCols
        ];
      });
    }

    const ws2 = window.XLSX.utils.aoa_to_sheet([s2Headers, ...s2Rows]);
    const colWidths = isSim
      ? [28, 12, 14, 16, 16, 14, 14, 14, 16, 16, ...activeIndicators.map(() => 28)]
      : [28, 12, 12, 14, 14, 12, 12, 16, ...activeIndicators.map(() => 28)];
    formatWorksheet(ws2, colWidths, 1);
    window.XLSX.utils.book_append_sheet(wb, ws2, 'درجات الطلاب');

    // Sheet 3: تحليل المؤشرات
    if (report.indicators && report.indicators.length) {
      const s3Headers = [
        'المؤشر',
        'المادة',
        'عدد الطلاب',
        'عدد الأسئلة',
        'متوسط الأداء (%)',
        'نسبة الإتقان (%)',
        'المتقنون',
        'قريب من الإتقان',
        'بحاجة إلى دعم',
        'غير متقن',
        'أولوية التدخل'
      ];
      const s3Rows = report.indicators.map(ind => [
        ind.text || ind.indicator_text || ind.key || 'مؤشر',
        SUBJECT_AR[ind.subject] || ind.subject || '—',
        ind.student_count ?? report.summary?.students ?? 0,
        ind.question_count ?? ind.questions_count ?? 1,
        `${round1(ind.average_percent ?? ind.percent ?? 0)}%`,
        `${round1(ind.mastery_rate ?? 0)}%`,
        ind.mastered ?? ind.mastered_count ?? 0,
        ind.near ?? ind.near_count ?? 0,
        ind.support ?? ind.support_count ?? 0,
        ind.non_mastered ?? ind.non_mastered_count ?? 0,
        ind.priority_label || ind.priority || 'عادية'
      ]);
      const ws3 = window.XLSX.utils.aoa_to_sheet([s3Headers, ...s3Rows]);
      formatWorksheet(ws3, [45, 14, 14, 14, 16, 16, 12, 14, 14, 12, 16], 1);
      window.XLSX.utils.book_append_sheet(wb, ws3, 'تحليل المؤشرات');
    }

    // Sheet 4: تحليل الأسئلة
    if (report.questions && report.questions.length) {
      const s4Headers = [
        'رقم السؤال',
        'المادة',
        'المؤشر المرتبط',
        'نسبة الإجابة الصحيحة (%)',
        'عدد الطلاب المجيبين',
        'ترك السؤال',
        'نسبة الخيار (أ) %',
        'نسبة الخيار (ب) %',
        'نسبة الخيار (ج) %',
        'نسبة الخيار (د) %'
      ];
      const s4Rows = report.questions.map((q, idx) => {
        const correctPct = round1(q.correct_percent ?? (q.correct_rate ? q.correct_rate * 100 : 0));
        const dist = q.options_distribution || {};
        return [
          q.question_no ?? (idx + 1),
          SUBJECT_AR[q.subject] || q.subject || '—',
          q.indicator_text || q.indicator || '—',
          `${correctPct}%`,
          q.respondents_count ?? q.responses_count ?? report.summary?.students ?? 0,
          q.skipped_count ?? 0,
          `${round1(dist[0] ?? dist['A'] ?? dist['أ'] ?? 0)}%`,
          `${round1(dist[1] ?? dist['B'] ?? dist['ب'] ?? 0)}%`,
          `${round1(dist[2] ?? dist['C'] ?? dist['ج'] ?? 0)}%`,
          `${round1(dist[3] ?? dist['D'] ?? dist['د'] ?? 0)}%`
        ];
      });
      const ws4 = window.XLSX.utils.aoa_to_sheet([s4Headers, ...s4Rows]);
      formatWorksheet(ws4, [12, 14, 42, 22, 18, 12, 16, 16, 16, 16], 1);
      window.XLSX.utils.book_append_sheet(wb, ws4, 'تحليل الأسئلة');
    }

    const cleanTitle = (test.title || 'نتائج_اختبار_نافس').replace(/[\\\/:*?"<>|]/g, '_');
    saveWorkbook(wb, `${cleanTitle}.xlsx`);
  }

  /**
   * 3. Export directly from raw attempts (used by Simulation Hub and fallback)
   */
  async function exportOfficialWorkbook({ test, attempts, analytics }) {
    assertXLSX();
    const wb = window.XLSX.utils.book_new();
    const testTitle = test?.title || 'اختبار محاكاة نافس';
    const isSim = test?.kind === 'simulation' || (test?.sections && test.sections.length > 1);

    // Submitted attempts only
    const validAttempts = (attempts || []).filter(a => a && (a.submitted || a.submitted_at));

    // Summary calculations
    const studentCount = validAttempts.length;
    const scores = validAttempts.map(a => Number(a.score) || 0);
    const percents = validAttempts.map(a => {
      if (a.percent != null) return Number(a.percent);
      const total = Number(a.total) || 1;
      return ((Number(a.score) || 0) / total) * 100;
    });

    const avgPercent = percents.length ? percents.reduce((s, p) => s + p, 0) / percents.length : 0;
    const maxPercent = percents.length ? Math.max(...percents) : 0;
    const minPercent = percents.length ? Math.min(...percents) : 0;
    const masteredCount = percents.filter(p => p >= 80).length;
    const nearCount = percents.filter(p => p >= 65 && p < 80).length;
    const supportCount = percents.filter(p => p >= 50 && p < 65).length;
    const nonMasteredCount = percents.filter(p => p < 50).length;
    const masteryRate = studentCount ? (masteredCount / studentCount) * 100 : 0;

    // Sheet 1: ملخص التقرير
    const s1Data = [
      ['التقرير المدرسي لتحليل نتائج نافس — منصة معلّمي', ''],
      ['اسم الاختبار / المحاكاة', testTitle],
      ['نوع الاختبار', isSim ? 'محاكاة شاملة' : 'اختبار مؤشرات'],
      ['الفصل الدراسي', test?.class_name || 'جميع الفصول'],
      ['الصف', 'الصف الثالث المتوسط'],
      ['رمز الاختبار', test?.short_code || '—'],
      ['تاريخ استخراج التقرير', new Date().toLocaleDateString('ar-SA')],
      ['', ''],
      ['المؤشرات الإحصائية العامة', ''],
      ['عدد الطلاب المشاركين', studentCount],
      ['متوسط درجات الطلاب (%)', `${round1(avgPercent)}%`],
      ['أعلى نسبة محققة (%)', `${round1(maxPercent)}%`],
      ['أقل نسبة محققة (%)', `${round1(minPercent)}%`],
      ['نسبة الإتقان العامة (نافس)', `${round1(masteryRate)}%`],
      ['', ''],
      ['مستويات الأداء', 'عدد الطلاب'],
      ['متقن (80% فأعلى)', masteredCount],
      ['قريب من الإتقان (65% إلى 79%)', nearCount],
      ['بحاجة إلى دعم (50% إلى 64%)', supportCount],
      ['غير متقن (أقل من 50%)', nonMasteredCount]
    ];
    const ws1 = window.XLSX.utils.aoa_to_sheet(s1Data);
    formatWorksheet(ws1, [34, 34], 0);
    window.XLSX.utils.book_append_sheet(wb, ws1, 'ملخص التقرير');

    // Sheet 2: درجات الطلاب
    let s2Headers = [];
    let s2Rows = [];

    if (isSim) {
      s2Headers = [
        'اسم الطالب',
        'الصف',
        'الفصل',
        'درجة القراءة (من ٢٠)',
        'درجة الرياضيات (من ٢٥)',
        'درجة العلوم (من ٢٥)',
        'الدرجة الكلية (من ٧٠)',
        'النسبة المئوية (%)',
        'المستوى العام',
        'تاريخ التسليم'
      ];

      s2Rows = validAttempts.map(a => {
        const secScores = a.section_scores || [];
        let rScore = '—', mScore = '—', sScore = '—';

        if (Array.isArray(secScores)) {
          const r = secScores.find(s => s.subject === 'reading');
          const m = secScores.find(s => s.subject === 'math');
          const sc = secScores.find(s => s.subject === 'science');
          if (r) rScore = r.score;
          if (m) mScore = m.score;
          if (sc) sScore = sc.score;
        }

        const pct = a.percent != null ? Number(a.percent) : ((Number(a.score) || 0) / (Number(a.total) || 70)) * 100;

        return [
          a.student_name || 'طالب',
          a.grade || 'الثالث المتوسط',
          a.class_name || test?.class_name || '—',
          rScore,
          mScore,
          sScore,
          a.score ?? '—',
          `${round1(pct)}%`,
          getNafesLevel(pct),
          a.submitted_at ? new Date(a.submitted_at).toLocaleString('ar-SA') : '—'
        ];
      });
    } else {
      s2Headers = [
        'اسم الطالب',
        'الصف',
        'الفصل',
        'الدرجة المحققة',
        'الدرجة الكلية',
        'النسبة المئوية (%)',
        'المستوى العام',
        'تاريخ التسليم'
      ];

      s2Rows = validAttempts.map(a => {
        const pct = a.percent != null ? Number(a.percent) : ((Number(a.score) || 0) / (Number(a.total) || 1)) * 100;
        return [
          a.student_name || 'طالب',
          a.grade || 'الثالث المتوسط',
          a.class_name || test?.class_name || '—',
          a.score ?? '—',
          a.total ?? '—',
          `${round1(pct)}%`,
          getNafesLevel(pct),
          a.submitted_at ? new Date(a.submitted_at).toLocaleString('ar-SA') : '—'
        ];
      });
    }

    const ws2 = window.XLSX.utils.aoa_to_sheet([s2Headers, ...s2Rows]);
    formatWorksheet(ws2, isSim ? [28, 16, 12, 18, 18, 18, 18, 18, 18, 22] : [28, 16, 12, 16, 16, 18, 18, 22], 1);
    window.XLSX.utils.book_append_sheet(wb, ws2, 'درجات الطلاب');

    const filename = `درجات_${(testTitle).replace(/[\\\/:*?"<>|]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveWorkbook(wb, filename);
  }

  /**
   * 4. Multi-Test Group Analysis Export
   */
  function exportGroupTestsExcel(groupData, options = {}) {
    assertXLSX();
    const wb = window.XLSX.utils.book_new();
    const selectedTests = groupData.tests || [];
    const isComparable = groupData.isComparable !== false;

    // Sheet 1: ملخص المجموعة
    const s1Data = [
      ['تقرير تحليل مجموعة اختبارات نافس — منصة معلّمي', ''],
      ['عدد الاختبارات المحددة', selectedTests.length],
      ['الفترة الزمنية', groupData.dateRange || '—'],
      ['عدد الطلاب الفريدين', groupData.uniqueStudentsCount ?? 0],
      ['متوسط الأداء العام (وزن متساوٍ للطلاب)', `${round1(groupData.overallAverage ?? 0)}%`],
      ['نسبة الإتقان العامة', `${round1(groupData.masteryRate ?? 0)}%`],
      ['المواد المشمولة', groupData.subjects?.map(s => SUBJECT_AR[s] || s).join(' · ') || '—'],
      ['عدد المؤشرات المقيسة', groupData.indicatorsCount ?? 0],
      ['حالة المقارنة بين الاختبارات', isComparable ? 'مقارنة معيارية عادلة' : 'هذه النتائج وصفية ولا تتوفر مقارنة عادلة لجميع الاختبارات المحددة.'],
      ['', ''],
      ['المؤشرات الأقوى أداءً', 'متوسط الأداء'],
      ...(groupData.strongestIndicators || []).map(i => [i.text, `${round1(i.average_percent)}%`]),
      ['', ''],
      ['المؤشرات ذات الضعف المتكرر / الأضعف', 'متوسط الأداء'],
      ...(groupData.weakestIndicators || []).map(i => [i.text, `${round1(i.average_percent)}%`])
    ];
    const ws1 = window.XLSX.utils.aoa_to_sheet(s1Data);
    formatWorksheet(ws1, [38, 38], 0);
    window.XLSX.utils.book_append_sheet(wb, ws1, 'ملخص المجموعة');

    // Sheet 2: الاختبارات المحددة
    const s2Headers = ['اسم الاختبار', 'المادة', 'الفصل', 'تاريخ الاختبار', 'عدد الطلاب', 'متوسط الأداء (%)', 'نسبة الإتقان (%)'];
    const s2Rows = selectedTests.map(t => [
      t.title || 'اختبار',
      t.subjects?.map(s => SUBJECT_AR[s] || s).join(' · ') || '—',
      t.class_name || 'الكل',
      t.created_at ? new Date(t.created_at).toLocaleDateString('ar-SA') : '—',
      t.students_count ?? 0,
      `${round1(t.average_percent ?? 0)}%`,
      `${round1(t.mastery_rate ?? 0)}%`
    ]);
    const ws2 = window.XLSX.utils.aoa_to_sheet([s2Headers, ...s2Rows]);
    formatWorksheet(ws2, [35, 18, 14, 18, 14, 18, 18], 1);
    window.XLSX.utils.book_append_sheet(wb, ws2, 'الاختبارات المحددة');

    // Sheet 3: درجات الطلاب
    const s3Headers = ['اسم الطالب', 'الصف', 'الفصل', 'عدد الاختبارات المؤداة', 'متوسط الطالب (%)', 'المستوى العام'];
    const s3Rows = (groupData.studentRows || []).map(st => [
      st.name || st.student_name || 'طالب',
      st.grade || 'الثالث المتوسط',
      st.class_name || '—',
      st.tests_taken ?? 1,
      `${round1(st.average_percent ?? 0)}%`,
      st.level_label || getNafesLevel(st.average_percent)
    ]);
    const ws3 = window.XLSX.utils.aoa_to_sheet([s3Headers, ...s3Rows]);
    formatWorksheet(ws3, [28, 16, 14, 22, 18, 18], 1);
    window.XLSX.utils.book_append_sheet(wb, ws3, 'درجات الطلاب');

    saveWorkbook(wb, `تحليل_مجموعة_اختبارات_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /**
   * 5. Subject Results Export
   */
  function exportSubjectExcel(subjectKey, subjectData) {
    assertXLSX();
    const wb = window.XLSX.utils.book_new();
    const arSubj = SUBJECT_AR[subjectKey] || subjectKey;

    // Sheet 1: ملخص المادة
    const s1Data = [
      [`تقرير نتائج مادة: ${arSubj} — نافس`, ''],
      ['إجمالي الاختبارات التابعة للمادة', subjectData.testsCount ?? 0],
      ['عدد الطلاب المختبرين في المادة', subjectData.studentsCount ?? 0],
      ['متوسط أداء المادة العام', `${round1(subjectData.averagePercent ?? 0)}%`],
      ['نسبة الإتقان العامة للمادة', `${round1(subjectData.masteryRate ?? 0)}%`],
      ['عدد المؤشرات المغطاة', subjectData.indicatorsCount ?? 0]
    ];
    const ws1 = window.XLSX.utils.aoa_to_sheet(s1Data);
    formatWorksheet(ws1, [32, 32], 0);
    window.XLSX.utils.book_append_sheet(wb, ws1, 'ملخص المادة');

    // Sheet 2: اختبارات المادة
    const s2Headers = ['اسم الاختبار', 'النوع', 'الفصل', 'تاريخ النشر', 'عدد الطلاب', 'متوسط الأداء (%)'];
    const s2Rows = (subjectData.tests || []).map(t => [
      t.title || 'اختبار',
      t.kind === 'simulation' ? 'قسم المحاكاة' : 'اختبار مؤشر',
      t.class_name || 'الكل',
      t.created_at ? new Date(t.created_at).toLocaleDateString('ar-SA') : '—',
      t.students_count ?? 0,
      `${round1(t.average_percent ?? 0)}%`
    ]);
    const ws2 = window.XLSX.utils.aoa_to_sheet([s2Headers, ...s2Rows]);
    formatWorksheet(ws2, [35, 18, 14, 18, 14, 18], 1);
    window.XLSX.utils.book_append_sheet(wb, ws2, 'الاختبارات');

    saveWorkbook(wb, `نتائج_مادة_${arSubj}_نافس.xlsx`);
  }

  // Expose to window under both NafesExcel and NafesExcelEngine
  window.NafesExcel = {
    hasXLSX,
    downloadStudentTemplate,
    exportSingleTestExcel,
    exportOfficialWorkbook,
    exportGroupTestsExcel,
    exportSubjectExcel
  };
  window.NafesExcelEngine = window.NafesExcel;
})();
