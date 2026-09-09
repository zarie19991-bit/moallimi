/**
 * moallimi - Excel Engine & Export Module
 * Assistant 3: Excel Engine & Reporting
 * 
 * Provides professional multi-sheet .xlsx generation using local xlsx-vendor.js
 * Strictly protects privacy (never exports national_id_last3, student_id, or database UUIDs).
 */
(()=>{
  const esc = s => String(s ?? '').trim();
  const round1 = n => Math.round((Number(n) || 0) * 10) / 10;
  const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

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

  /**
   * Helper to write and download workbook
   */
  function saveWorkbook(wb, filename) {
    assertXLSX();
    window.XLSX.writeFile(wb, filename);
  }

  /**
   * Helper to set RTL view direction on a worksheet
   */
  function makeRTL(ws) {
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ RTL: true });
    return ws;
  }

  /**
   * 1. Download Student Import Template
   * Columns: اسم الطالب | الصف | الفصل | آخر 3 أرقام (with 1 dummy row)
   */
  function downloadStudentTemplate() {
    assertXLSX();
    const headers = ['اسم الطالب', 'الصف', 'الفصل', 'آخر 3 أرقام'];
    const dummy = ['أحمد محمد علي الغامدي', 'الثالث المتوسط', '٣/١', '123'];

    const data = [headers, dummy];
    const ws = window.XLSX.utils.aoa_to_sheet(data);
    makeRTL(ws);

    // Set column widths
    ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 16 }];

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'نموذج استيراد الطلاب');
    saveWorkbook(wb, 'نموذج_استيراد_الطلاب_نافس.xlsx');
  }

  /**
   * 2. Single Test Multi-Sheet Excel Export
   */
  function exportSingleTestExcel(test, report, options = {}) {
    assertXLSX();
    const wb = window.XLSX.utils.book_new();
    const testTitle = test.title || 'اختبار نافس';
    const subName = test.subjects?.map(s => SUBJECT_AR[s] || s).join(' · ') || 'نافس';
    const policy = options.policy || 'latest';
    const isAll = policy === 'all';

    // ----------------------------------------------------
    // Sheet 1: ملخص الاختبار
    // ----------------------------------------------------
    const s1Data = [
      ['تقرير نتائج الاختبار — منصة معلّمي', ''],
      ['اسم الاختبار', testTitle],
      ['المادة / المواد', subName],
      ['الصف الدراسي', test.grade_key === 'middle_3' ? 'الثالث المتوسط' : (test.grade || '—')],
      ['الفصل / الشعبة', test.class_name || 'جميع الفصول'],
      ['رمز الاختبار', test.short_code || '—'],
      ['تاريخ إنشاء / نشر الاختبار', test.created_at ? new Date(test.created_at).toLocaleDateString('ar-SA') : '—'],
      ['سياسة المحاولات المطبقة', isAll ? 'جميع المحاولات (وزن متساوٍ للطلاب)' : (policy === 'highest' ? 'أعلى محاولة' : (policy === 'first' ? 'أول محاولة' : 'آخر محاولة'))],
      ['', ''],
      ['مؤشرات الأداء العامة', ''],
      [isAll ? 'عدد الطلاب الفريدين' : 'عدد الطلاب المختبرين', report.summary?.students ?? report.students?.length ?? 0],
      [isAll ? 'إجمالي عدد الاستجابات / المحاولات' : 'عدد المحاولات', report.summary?.totalAttempts ?? report.students?.length ?? 0],
      ['متوسط الأداء العام (%)', `${round1(report.summary?.averagePercent ?? 0)}%`],
      ['أعلى نسبة محققة', `${round1(report.summary?.maxScore ?? 0)}%`],
      ['أقل نسبة محققة', `${round1(report.summary?.minScore ?? 0)}%`],
      ['نسبة الإتقان العامة (نافس)', `${round1(report.summary?.masteryRate ?? 0)}%`],
      ['', ''],
      ['توزيع مستويات الطلاب', 'عدد الطلاب'],
      ['متقن (80% فأعلى)', report.summary?.masteredCount ?? 0],
      ['قريب من الإتقان (65% إلى 79%)', report.summary?.nearCount ?? 0],
      ['بحاجة إلى دعم (50% إلى 64%)', report.summary?.supportCount ?? 0],
      ['غير متقن (أقل من 50%)', report.summary?.nonMasteredCount ?? 0],
      ['أدلة غير كافية', report.summary?.insufficientEvidenceCount ?? 0]
    ];
    const ws1 = window.XLSX.utils.aoa_to_sheet(s1Data);
    makeRTL(ws1);
    ws1['!cols'] = [{ wch: 32 }, { wch: 32 }];
    window.XLSX.utils.book_append_sheet(wb, ws1, 'ملخص الاختبار');

    // ----------------------------------------------------
    // Sheet 2: درجات الطلاب (NO national_id_last3, NO student_id)
    // ----------------------------------------------------
    const s2Headers = [
      'اسم الطالب',
      'الصف',
      'الفصل',
      'الدرجة المحققة',
      'الدرجة الكلية',
      'النسبة المئوية',
      'المستوى العام',
      'عدد الإجابات الصحيحة',
      'عدد الإجابات الخاطئة',
      'تاريخ ووقت التسليم',
      'ملاحظات الجودة'
    ];
    const s2Rows = (report.students || []).map(st => {
      const isWarn = !!st.snapshot_warning;
      return [
        st.name || st.student_name || 'طالب',
        st.grade || 'الثالث المتوسط',
        st.class_name || '—',
        st.score ?? '—',
        st.total ?? '—',
        st.percent != null ? `${round1(st.percent)}%` : '—',
        isWarn ? 'محاولة تاريخية (مستبعدة من الإتقان)' : (st.level_label || st.level || '—'),
        st.correct_count ?? (st.score ?? 0),
        st.incorrect_count ?? Math.max(0, (st.total || 0) - (st.score || 0)),
        st.submitted_at ? new Date(st.submitted_at).toLocaleString('ar-SA') : '—',
        isWarn ? 'تحتوي الورقة على مفتاح قديم؛ حُفظت الدرجة واستُبعدت من الإتقان' : 'معتمد'
      ];
    });
    const ws2 = window.XLSX.utils.aoa_to_sheet([s2Headers, ...s2Rows]);
    makeRTL(ws2);
    ws2['!cols'] = [
      { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 32 }
    ];
    window.XLSX.utils.book_append_sheet(wb, ws2, 'درجات الطلاب');

    // ----------------------------------------------------
    // Sheet 3: تحليل المؤشرات
    // ----------------------------------------------------
    const s3Headers = [
      'المؤشر',
      'المادة',
      isAll ? 'عدد الطلاب المقاسين' : 'عدد الطلاب',
      'عدد الأسئلة',
      'متوسط الأداء (%)',
      'نسبة الإتقان (%)',
      'المتقنون',
      'قريب من الإتقان',
      'بحاجة إلى دعم',
      'غير متقن',
      'أدلة غير كافية',
      'أولوية التدخل'
    ];
    const s3Rows = (report.indicators || []).map(ind => [
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
      ind.insufficient_evidence ?? 0,
      ind.priority_label || ind.priority || 'عادية'
    ]);
    const ws3 = window.XLSX.utils.aoa_to_sheet([s3Headers, ...s3Rows]);
    makeRTL(ws3);
    ws3['!cols'] = [
      { wch: 45 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
      { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }
    ];
    window.XLSX.utils.book_append_sheet(wb, ws3, 'تحليل المؤشرات');

    // ----------------------------------------------------
    // Sheet 4: تحليل الأسئلة
    // ----------------------------------------------------
    const s4Headers = [
      'رقم السؤال',
      'المادة',
      'المؤشر المرتبط',
      'نسبة الإجابة الصحيحة (%)',
      'نسبة الخطأ (%)',
      isAll ? 'إجمالي الاستجابات' : 'عدد الطلاب المجيبين',
      'ترك السؤال',
      'نسبة الاختيار (أ) %',
      'نسبة الاختيار (ب) %',
      'نسبة الاختيار (ج) %',
      'نسبة الاختيار (د) %'
    ];
    const s4Rows = (report.questions || []).map((q, idx) => {
      const correctPct = round1(q.correct_percent ?? (q.correct_rate ? q.correct_rate * 100 : 0));
      const wrongPct = round1(100 - correctPct);
      const dist = q.options_distribution || q.option_percents || {};
      return [
        q.question_no ?? (idx + 1),
        SUBJECT_AR[q.subject] || q.subject || '—',
        q.indicator_text || q.indicator || '—',
        `${correctPct}%`,
        `${wrongPct}%`,
        q.responses_count ?? q.respondents_count ?? report.summary?.students ?? 0,
        q.skipped_count ?? 0,
        `${round1(dist[0] ?? dist['A'] ?? dist['أ'] ?? 0)}%`,
        `${round1(dist[1] ?? dist['B'] ?? dist['ب'] ?? 0)}%`,
        `${round1(dist[2] ?? dist['C'] ?? dist['ج'] ?? 0)}%`,
        `${round1(dist[3] ?? dist['D'] ?? dist['د'] ?? 0)}%`
      ];
    });
    const ws4 = window.XLSX.utils.aoa_to_sheet([s4Headers, ...s4Rows]);
    makeRTL(ws4);
    ws4['!cols'] = [
      { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 22 }, { wch: 16 },
      { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
    ];
    window.XLSX.utils.book_append_sheet(wb, ws4, 'تحليل الأسئلة');

    // ----------------------------------------------------
    // Additional Sheets for Multi-Subject / Simulation Tests
    // ----------------------------------------------------
    if (test.kind === 'simulation' || (test.subjects && test.subjects.length > 1)) {
      const subjects = test.subjects || ['reading', 'math', 'science'];
      for (const subj of subjects) {
        const arSubj = SUBJECT_AR[subj] || subj;
        const subjInds = (report.indicators || []).filter(i => i.subject === subj);
        const subjQs = (report.questions || []).filter(q => q.subject === subj);
        
        const sSubjData = [
          [`تحليل مادة: ${arSubj}`, ''],
          ['عدد المؤشرات', subjInds.length],
          ['عدد الأسئلة', subjQs.length],
          ['', ''],
          ['المؤشرات في هذه المادة', 'عدد الأسئلة', 'متوسط الأداء', 'نسبة الإتقان', 'أولوية التدخل']
        ];
        for (const ind of subjInds) {
          sSubjData.push([
            ind.text || ind.indicator_text || ind.key,
            ind.question_count ?? ind.questions_count ?? 1,
            `${round1(ind.average_percent ?? ind.percent ?? 0)}%`,
            `${round1(ind.mastery_rate ?? 0)}%`,
            ind.priority_label || ind.priority || 'عادية'
          ]);
        }
        const wsSubj = window.XLSX.utils.aoa_to_sheet(sSubjData);
        makeRTL(wsSubj);
        wsSubj['!cols'] = [{ wch: 45 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
        window.XLSX.utils.book_append_sheet(wb, wsSubj, arSubj);
      }
    }

    const cleanName = testTitle.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 40);
    saveWorkbook(wb, `نتائج_${cleanName}.xlsx`);
  }

  /**
   * 3. Multi-Test Group Analysis Excel Export
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
    makeRTL(ws1);
    ws1['!cols'] = [{ wch: 38 }, { wch: 38 }];
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
    makeRTL(ws2);
    ws2['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
    window.XLSX.utils.book_append_sheet(wb, ws2, 'الاختبارات المحددة');

    // Sheet 3: درجات الطلاب (Strictly NO last3, NO student_id)
    const s3Headers = ['اسم الطالب', 'الصف', 'الفصل', 'عدد الاختبارات المؤداة', 'متوسط الطالب (%)', 'المستوى العام'];
    const s3Rows = (groupData.studentRows || []).map(st => [
      st.name || st.student_name || 'طالب',
      st.grade || 'الثالث المتوسط',
      st.class_name || '—',
      st.tests_taken ?? 1,
      `${round1(st.average_percent ?? 0)}%`,
      st.level_label || st.level || '—'
    ]);
    const ws3 = window.XLSX.utils.aoa_to_sheet([s3Headers, ...s3Rows]);
    makeRTL(ws3);
    ws3['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 18 }];
    window.XLSX.utils.book_append_sheet(wb, ws3, 'درجات الطلاب');

    // Sheet 4: تحليل المواد
    const s4Headers = ['المادة', 'عدد الاختبارات', 'عدد الطلاب', 'متوسط الأداء (%)', 'نسبة الإتقان (%)'];
    const s4Rows = (groupData.subjectBreakdown || []).map(sb => [
      SUBJECT_AR[sb.subject] || sb.subject,
      sb.tests_count ?? 0,
      sb.students_count ?? 0,
      `${round1(sb.average_percent ?? 0)}%`,
      `${round1(sb.mastery_rate ?? 0)}%`
    ]);
    const ws4 = window.XLSX.utils.aoa_to_sheet([s4Headers, ...s4Rows]);
    makeRTL(ws4);
    ws4['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
    window.XLSX.utils.book_append_sheet(wb, ws4, 'تحليل المواد');

    // Sheet 5: تحليل المؤشرات المشتركة والمتكررة
    const s5Headers = ['المؤشر', 'المادة', 'عدد الاختبارات', 'عدد الطلاب', 'متوسط الأداء (%)', 'نسبة الإتقان (%)', 'الاتجاه', 'أولوية التدخل'];
    const s5Rows = (groupData.indicators || []).map(ind => [
      ind.text || ind.key,
      SUBJECT_AR[ind.subject] || ind.subject || '—',
      ind.tests_count ?? 1,
      ind.students_count ?? 0,
      `${round1(ind.average_percent ?? 0)}%`,
      `${round1(ind.mastery_rate ?? 0)}%`,
      ind.trend || (isComparable ? 'مستقر' : 'وصفي'),
      ind.priority_label || ind.priority || 'عادية'
    ]);
    const ws5 = window.XLSX.utils.aoa_to_sheet([s5Headers, ...s5Rows]);
    makeRTL(ws5);
    ws5['!cols'] = [{ wch: 45 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
    window.XLSX.utils.book_append_sheet(wb, ws5, 'تحليل المؤشرات');

    saveWorkbook(wb, `تحليل_مجموعة_اختبارات_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  /**
   * 4. Complete Subject Results Export
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
    makeRTL(ws1);
    ws1['!cols'] = [{ wch: 32 }, { wch: 32 }];
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
    makeRTL(ws2);
    ws2['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
    window.XLSX.utils.book_append_sheet(wb, ws2, 'الاختبارات');

    // Sheet 3: المؤشرات
    const s3Headers = ['المؤشر', 'عدد الأسئلة', 'الطلاب المقاسين', 'متوسط الأداء (%)', 'نسبة الإتقان (%)', 'أولوية التدخل'];
    const s3Rows = (subjectData.indicators || []).map(i => [
      i.text || i.key,
      i.question_count ?? 1,
      i.students_count ?? 0,
      `${round1(i.average_percent ?? 0)}%`,
      `${round1(i.mastery_rate ?? 0)}%`,
      i.priority_label || i.priority || 'عادية'
    ]);
    const ws3 = window.XLSX.utils.aoa_to_sheet([s3Headers, ...s3Rows]);
    makeRTL(ws3);
    ws3['!cols'] = [{ wch: 45 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
    window.XLSX.utils.book_append_sheet(wb, ws3, 'المؤشرات');

    saveWorkbook(wb, `نتائج_مادة_${arSubj}_نافس.xlsx`);
  }

  // Expose to window
  window.NafesExcel = {
    hasXLSX,
    downloadStudentTemplate,
    exportSingleTestExcel,
    exportGroupTestsExcel,
    exportSubjectExcel
  };
})();
