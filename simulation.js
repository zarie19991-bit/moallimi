/**
 * moallimi - Dedicated Simulation Hub (مركز الاختبارات المحاكية)
 * Multi-Subject Custom Indicator Simulation & Official Ministerial Forms
 */
(() => {
  'use strict';

  // 1. Automatic Student Redirect: If student opens simulation.html with test token (?t=...)
  const params = new URLSearchParams(location.search);
  if (params.has('t')) {
    location.replace('e.html?t=' + encodeURIComponent(params.get('t')));
    return;
  }
  if (params.has('c')) {
    location.replace('e.html?c=' + encodeURIComponent(params.get('c')));
    return;
  }

  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ar = x => new Intl.NumberFormat('ar-SA').format(x);

  let simulationTests = [];
  let catalogIndicators = [];
  let isPublishing = false;

  async function initSimulationHub() {
    if (!window.NafesTeacher?.getKey()) {
      window.NafesTeacher?.requireKey();
      return;
    }

    await loadCatalogData();
    await loadSimulations();
    setupForms();
  }

  // Tab switching
  window.switchSimTab = function(tab) {
    const isCustom = tab === 'custom';
    const isFull = tab === 'full' || tab === 'standard';
    const isSingle = tab === 'single';

    $('tabCustomBtn')?.classList.toggle('active', isCustom);
    $('tabFullBtn')?.classList.toggle('active', isFull);
    $('tabStandardBtn')?.classList.toggle('active', isFull);
    $('tabSingleBtn')?.classList.toggle('active', isSingle);

    $('customSimView')?.classList.toggle('hidden', !isCustom);
    $('standardSimView')?.classList.toggle('hidden', !isFull);
    $('singleDomainSimView')?.classList.toggle('hidden', !isSingle);
  };

  let simulationSummary = { reading: 0, math: 0, science: 0, total: 0 };

  async function loadCatalogData() {
    try {
      const catalog = await window.NafesTeacher.api('teacher_catalog');
      catalogIndicators = catalog.simulation_indicators || [];
      simulationSummary = catalog.simulation_summary || { reading: 0, math: 0, science: 0, total: 0 };
      renderIndicatorsForSubject('reading');
      renderIndicatorsForSubject('math');
      renderIndicatorsForSubject('science');
      updateScienceBankBadge();
      updateStandardSpecsDisplay();
      updateCustomSummary();
    } catch (err) {
      console.warn('Catalog load warning:', err);
    }
  }

  function updateScienceBankBadge() {
    const badge = $('science_bank_badge');
    if (!badge) return;
    const avail = simulationSummary.science || 0;
    badge.textContent = `الرصيد المتاح: ${ar(avail)} سؤال معتمد`;
    if (avail === 0) {
      badge.style.background = '#fdeeee';
      badge.style.color = '#b3261e';
    } else {
      badge.style.background = '#e6f7f2';
      badge.style.color = '#0f514c';
    }
  }

  function updateStandardSpecsDisplay() {
    const totalEl = $('standardSummaryTotal');
    const readEl = $('standardReadingSpec');
    const mathEl = $('standardMathSpec');
    const sciEl = $('standardScienceSpec');
    const rAvail = simulationSummary.reading || 0;
    const mAvail = simulationSummary.math || 0;
    const sAvail = simulationSummary.science || 0;
    const totAvail = simulationSummary.total || (rAvail + mAvail + sAvail);

    if (totalEl) totalEl.textContent = `رصيد البنك المستقل: ${ar(totAvail)} سؤال معتمد`;
    if (readEl) readEl.textContent = `٢٠ سؤالًا · ٤٥ دقيقة (المتاح: ${ar(rAvail)})`;
    if (mathEl) mathEl.textContent = `٢٥ سؤالًا · ٤٥ دقيقة · 🧮 حاسبة مفعّلة (المتاح: ${ar(mAvail)})`;
    if (sciEl) {
      if (sAvail > 0) {
        sciEl.textContent = `المتاح: ${ar(sAvail)} سؤال معتمد`;
        sciEl.style.color = '#0f514c';
      } else {
        sciEl.textContent = `المتاح: ٠ سؤال معتمد (غير جاهز)`;
        sciEl.style.color = '#b3261e';
      }
    }
  }

  function renderIndicatorsForSubject(subject) {
    const container = $(`list_${subject}`);
    if (!container) return;

    const inds = catalogIndicators.filter(i => i.subject === subject);
    if (!inds.length) {
      container.innerHTML = '<div style="padding:10px;font-size:11px;color:#687a83;text-align:center;">جارٍ تحميل مؤشرات المادة من بنك المحاكاة...</div>';
      return;
    }

    container.innerHTML = inds.map((item, idx) => {
      const isAvailable = (item.available || 0) > 0;
      const isChecked = false;
      const availText = isAvailable ? `${ar(item.available)} سؤالًا متاحًا في بنك المحاكاة` : '٠ متاح — لا توجد أسئلة معتمدة حالياً';
      const badgeClass = isAvailable ? 'avail' : 'zero';

      return `
        <label class="sim-ind-row" data-key="${esc(item.key)}" data-subject="${esc(subject)}">
          <div class="sim-ind-main">
            <input type="checkbox" class="sim-ind-check" data-subject="${esc(subject)}" value="${esc(item.key)}" ${isChecked ? 'checked' : ''} ${!isAvailable ? 'disabled' : ''} onchange="onIndicatorToggle('${esc(subject)}')">
            <div class="sim-ind-text-wrap">
              <span class="sim-ind-title" title="${esc(item.text)}">${ar(idx + 1)}) ${esc(item.text)}</span>
              <span class="sim-ind-badge ${badgeClass}">${availText}</span>
            </div>
          </div>
          <div class="sim-ind-count-ctrl">
            <span>الأسئلة:</span>
            <input type="number" class="sim-ind-count" min="1" max="15" value="${isAvailable ? 2 : 0}" data-key="${esc(item.key)}" data-subject="${esc(subject)}" onchange="updateCustomSummary()" ${!isAvailable ? 'disabled' : ''}>
          </div>
        </label>
      `;
    }).join('');

    updateSubjectBadge(subject);
  }

  window.filterIndicators = function(subject, query) {
    const q = String(query || '').trim().toLowerCase();
    const container = $(`list_${subject}`);
    if (!container) return;
    const rows = container.querySelectorAll('.sim-ind-row');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(q) ? 'flex' : 'none';
    });
  };

  window.selectAllIndicators = function(subject, selectAll) {
    const container = $(`list_${subject}`);
    if (!container) return;
    const checks = container.querySelectorAll('.sim-ind-check:not(:disabled)');
    checks.forEach(c => { c.checked = !!selectAll; });
    updateSubjectBadge(subject);
    updateCustomSummary();
  };

  window.selectFirstNIndicators = function(subject, n) {
    const container = $(`list_${subject}`);
    if (!container) return;
    const checks = container.querySelectorAll('.sim-ind-check:not(:disabled)');
    checks.forEach((c, idx) => {
      c.checked = idx < n;
    });
    updateSubjectBadge(subject);
    updateCustomSummary();
  };

  window.onIndicatorToggle = function(subject) {
    updateSubjectBadge(subject);
    updateCustomSummary();
  };

  function updateSubjectBadge(subject) {
    const badge = $(`${subject}_selected_badge`);
    if (!badge) return;
    const container = $(`list_${subject}`);
    if (!container) return;
    const checkedCount = container.querySelectorAll('.sim-ind-check:checked').length;
    badge.textContent = `تم اختيار ${ar(checkedCount)} مؤشرًا`;
  }

  window.toggleSubject = function(subject) {
    const isChecked = $(`subj_enable_${subject}`)?.checked;
    const card = $(`card_${subject}`);
    const body = $(`body_${subject}`);
    if (card) card.classList.toggle('enabled', !!isChecked);
    if (body) body.style.display = isChecked ? 'block' : 'none';
    updateCustomSummary();
  };

  function updateCustomSummary() {
    const sectionsEl = $('customSummarySections');
    const totalEl = $('customSummaryTotal');
    const timeEl = $('customSummaryTime');
    if (!sectionsEl || !totalEl || !timeEl) return;

    const subjects = [
      { key: 'reading', name: 'القراءة', icon: '📖' },
      { key: 'math', name: 'الرياضيات', icon: '📐' },
      { key: 'science', name: 'العلوم', icon: '🔬' }
    ];

    let grandTotalQuestions = 0;
    let grandTotalMinutes = 0;
    const activeSections = [];

    for (const sub of subjects) {
      const isEnabled = $(`subj_enable_${sub.key}`)?.checked;
      if (!isEnabled) continue;

      const duration = Number($(`subj_time_${sub.key}`)?.value || 30);
      const container = $(`list_${sub.key}`);
      let questionsCount = 0;
      let indicatorsCount = 0;

      if (container) {
        const checkedChecks = container.querySelectorAll('.sim-ind-check:checked');
        indicatorsCount = checkedChecks.length;
        checkedChecks.forEach(ch => {
          const countInput = container.querySelector(`.sim-ind-count[data-key="${ch.value}"]`);
          questionsCount += Number(countInput?.value || 2);
        });
      }

      grandTotalQuestions += questionsCount;
      grandTotalMinutes += duration;

      const calcBadge = sub.key === 'math' && $('subj_calc_math')?.checked ? ' · 🧮 حاسبة' : '';
      activeSections.push(`
        <div class="sim-spec-row">
          <b>${sub.icon} ${sub.name}</b>
          <span>${ar(questionsCount)} سؤالًا (${ar(indicatorsCount)} مؤشرًا) · ${ar(duration)} دقيقة${calcBadge}</span>
        </div>
      `);
    }

    if (!activeSections.length) {
      sectionsEl.innerHTML = '<div style="font-size:11px;color:#b3261e;padding:6px 0;">لم يتم تفعيل أي مادة للاختبار</div>';
      totalEl.textContent = '٠ سؤال';
      timeEl.textContent = '٠ دقيقة';
      return;
    }

    sectionsEl.innerHTML = activeSections.join('');
    totalEl.textContent = `${ar(grandTotalQuestions)} سؤالًا`;
    const breakNotice = activeSections.length > 1 ? ` (شاملًا استراحة ${ar(2)} دقيقة بين الأقسام)` : '';
    timeEl.textContent = `${ar(grandTotalMinutes)} دقيقة${breakNotice}`;
  }

  async function loadSimulations() {
    const listEl = $('simCardsList');
    const countEl = $('simCountBadge');
    if (!listEl) return;

    listEl.innerHTML = '<div class="table-loading">جارٍ تحميل الاختبارات المحاكية المنشورة...</div>';

    try {
      const catalog = await window.NafesTeacher.api('teacher_catalog');
      const tests = catalog.tests || [];
      
      // Filter simulations: kind === 'simulation' or 'multi_indicator' or title/config containing simulation
      simulationTests = tests.filter(t => t.kind === 'simulation' || t.kind === 'multi_indicator' || (t.title && t.title.includes('محاكاة')));

      if (countEl) countEl.textContent = `${ar(simulationTests.length)} اختبار محاكاة`;

      if (!simulationTests.length) {
        listEl.innerHTML = `
          <div class="table-empty">
            لم تنشر أي اختبار محاكاة بعد.<br>
            استخدم نموذج المحاكاة المخصصة أو النماذج القياسية على اليمين لتكوين أول محاكاة ونشرها لفصلك فورًا.
          </div>
        `;
        return;
      }

      listEl.innerHTML = simulationTests.map(test => {
        const studentUrl = `https://zarie19991-bit.github.io/moallimi/e.html?t=${encodeURIComponent(test.short_code || '')}`;
        const createdDate = test.created_at ? new Date(test.created_at).toLocaleDateString('ar-SA') : 'مؤخرًا';
        const subList = Array.isArray(test.subjects) ? test.subjects : [];

        const hasReading = subList.includes('reading');
        const hasMath = subList.includes('math');
        const hasScience = subList.includes('science');

        return `
          <article class="sim-card" data-test-id="${esc(test.id)}">
            <div class="sim-card-top">
              <div>
                <h3 class="sim-card-title">${esc(test.title || 'اختبار محاكاة نافس')}</h3>
                <div class="sim-card-meta">
                  <span>الفصل: <b>${esc(test.class_name || '—')}</b></span>
                  <span>·</span>
                  <span>الأسئلة: <b>${ar(test.total || 0)} سؤالًا</b></span>
                  <span>·</span>
                  <span>تاريخ النشر: ${esc(createdDate)}</span>
                </div>
              </div>
              <span class="sim-code-chip">${esc(test.short_code || '')}</span>
            </div>

            <div class="sim-parts-row">
              ${hasReading ? '<span class="sim-part-pill reading">📖 القراءة</span>' : ''}
              ${hasMath ? '<span class="sim-part-pill math">📐 الرياضيات مع حاسبة</span>' : ''}
              ${hasScience ? '<span class="sim-part-pill science">🔬 العلوم</span>' : ''}
              <span class="sim-part-pill" style="background:#f0f4f3;color:#2c5b52;">⚡ محاكاة موحدة</span>
            </div>

            <div class="sim-link-box">
              <input type="text" readonly value="${esc(studentUrl)}" id="link_${esc(test.id)}">
              <button type="button" class="sim-btn-copy" onclick="copySimLink('link_${esc(test.id)}')">نسخ الرابط</button>
            </div>

            <div class="sim-card-actions">
              <a href="analysis.html?test=${encodeURIComponent(test.id)}" class="sim-act-btn primary">
                <span>📊</span> تحليل النتائج
              </a>
              <button type="button" class="sim-act-btn excel" onclick="exportSimExcel('${esc(test.id)}')">
                <span>📥</span> تصدير Excel
              </button>
              <button type="button" class="sim-act-btn qr" onclick="showSimQr('${esc(test.id)}', '${esc(test.title)}', '${esc(studentUrl)}')">
                <span>📱</span> رمز QR
              </button>
              <a href="analysis.html?test=${encodeURIComponent(test.id)}#manage" class="sim-act-btn manage">
                <span>⚙️</span> إدارة ومسح النتائج
              </a>
            </div>
          </article>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `<div class="table-empty error">تعذر تحميل المحاكاة: ${esc(err.message)}</div>`;
    }
  }

  function setupForms() {
    setupCustomForm();
    setupStandardForm();
    setupSingleDomainForm();
  }

  function setupCustomForm() {
    const form = $('customSimForm');
    if (!form) return;

    form.onsubmit = async e => {
      e.preventDefault();
      if (isPublishing) return;

      const title = $('customSimTitle').value.trim() || 'اختبار محاكاة نافس المخصص';
      const className = $('customSimClass').value.trim();
      const schoolName = $('customSimSchool').value.trim();
      const teacherName = $('customSimTeacher').value.trim();
      const submitBtn = $('publishCustomSimBtn');
      const feedback = $('customSimFeedback');

      if (!className) {
        showCustomFeedback('يرجى تحديد الفصل الدراسي', 'err');
        return;
      }

      // Collect sections
      const sections = [];
      const subjectsToCheck = [
        { key: 'reading', name: 'القراءة', isEnabled: $('subj_enable_reading')?.checked, timeId: 'subj_time_reading', calc: false },
        { key: 'math', name: 'الرياضيات', isEnabled: $('subj_enable_math')?.checked, timeId: 'subj_time_math', calc: !!$('subj_calc_math')?.checked },
        { key: 'science', name: 'العلوم', isEnabled: $('subj_enable_science')?.checked, timeId: 'subj_time_science', calc: false }
      ];

      for (const item of subjectsToCheck) {
        if (!item.isEnabled) continue;
        const duration = Number($(item.timeId)?.value || 30);
        const container = $(`list_${item.key}`);
        if (!container) continue;

        const checkedBoxes = container.querySelectorAll('.sim-ind-check:checked');
        if (!checkedBoxes.length) {
          showCustomFeedback(`يرجى اختيار مؤشر واحد على الأقل في مادة ${item.name}`, 'err');
          return;
        }

        const sectionIndicators = [];
        let sectionQuestionsTotal = 0;

        for (const ch of checkedBoxes) {
          const countInput = container.querySelector(`.sim-ind-count[data-key="${ch.value}"]`);
          const count = Number(countInput?.value || 0);
          const indObj = catalogIndicators.find(k => k.key === ch.value);
          const available = indObj?.available || 0;
          const text = indObj?.text || ch.closest('.sim-ind-row')?.querySelector('.sim-ind-title')?.textContent || '';

          if (count <= 0) {
            showCustomFeedback(`يرجى تحديد عدد أسئلة صحيح للمؤشر «${text}»`, 'err');
            return;
          }

          if (count > available) {
            showCustomFeedback(`المؤشر «${text}»: المطلوب ${ar(count)} سؤالًا، بينما المتاح في بنك المحاكاة المستقل ${ar(available)} فقط. لن يتم تكرار أي سؤال، ولا يمكن إنشاء الاختبار بهذا العدد.`, 'err');
            return;
          }

          sectionIndicators.push({
            key: ch.value,
            count: count,
            text: text
          });
          sectionQuestionsTotal += count;
        }

        sections.push({
          subject: item.key,
          question_count: sectionQuestionsTotal,
          duration_minutes: duration,
          calculator: item.calc,
          indicators: sectionIndicators
        });
      }

      if (!sections.length) {
        showCustomFeedback('يرجى تفعيل مادة واحدة على الأقل في المحاكاة (القراءة أو الرياضيات أو العلوم)', 'err');
        return;
      }

      isPublishing = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'جارٍ تكوين ونشر المحاكاة المخصصة...';
      feedback.classList.add('hidden');

      try {
        const config = {
          kind: 'simulation',
          simulation_mode: 'custom',
          bank_source: 'simulation_bank',
          grade_key: 'middle_3',
          title: title,
          class_name: className,
          school_name: schoolName,
          teacher_name: teacherName,
          principal_name: '',
          identity_mode: 'manual',
          roster: [],
          sections: sections,
          count_mode: 'per_indicator',
          settings: {
            show_result: true,
            show_answers: false,
            show_indicator_result: true,
            show_correct_count: true,
            shuffle_questions: true,
            shuffle_options: true,
            allow_copy: false,
            disable_right_click: true,
            disable_print: true,
            disable_shortcuts: true,
            allow_back: true,
            one_per_page: true,
            lock_session: true,
            log_visibility: true,
            watermark: true,
            attempts: 1,
            break_minutes: 2
          }
        };

        // 1. Preview Draft
        const draft = await window.NafesTeacher.api('teacher_preview', { config, regenerate: false });
        if (!draft?.draft_id) throw new Error('فشل إعداد مسودة المحاكاة.');

        // 2. Publish Test
        const published = await window.NafesTeacher.api('teacher_publish', { draft_id: draft.draft_id });

        showCustomFeedback(`تم نشر المحاكاة بنجاح! الرابط جاهز للإرسال للطلاب: ${published.url}`, 'ok');

        // Show QR modal with the newly created test
        showSimQr(published.id, published.title, published.url);

        // Reload published simulations list
        await loadSimulations();
      } catch (err) {
        showCustomFeedback('فشل نشر المحاكاة المخصصة: ' + err.message, 'err');
      } finally {
        isPublishing = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀</span> تكوين ونشر المحاكاة المخصصة';
      }
    };
  }

  function setupStandardForm() {
    const form = $('quickSimForm');
    if (!form) return;

    form.onsubmit = async e => {
      e.preventDefault();
      if (isPublishing) return;

      const title = $('simTitle').value.trim() || 'اختبار محاكاة نافس الشاملة';
      const className = $('simClass').value.trim();
      const schoolName = $('simSchool').value.trim();
      const teacherName = $('simTeacher').value.trim();
      const modelNo = Number($('simModel').value || 1);
      const submitBtn = $('publishSimBtn');
      const feedback = $('simFormFeedback');

      if (!className) {
        showStandardFeedback('يرجى تحديد الفصل الدراسي', 'err');
        return;
      }

      // Check available questions in independent simulation bank
      const totalAvail = (simulationSummary.reading || 0) + (simulationSummary.math || 0) + (simulationSummary.science || 0);
      if (totalAvail === 0) {
        showStandardFeedback('لا يمكن إنشاء المحاكاة الشاملة حالياً: رصيد بنك المحاكاة المستقل (٠ سؤال معتمد). يرجى اعتماد أسئلة في بنك المحاكاة أولاً.', 'err');
        return;
      }

      isPublishing = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'جارٍ تكوين ونشر المحاكاة الشاملة...';
      feedback.classList.add('hidden');

      try {
        const config = {
          kind: 'simulation',
          simulation_mode: 'standard',
          bank_source: 'simulation_bank',
          grade_key: 'middle_3',
          title: title,
          class_name: className,
          school_name: schoolName,
          teacher_name: teacherName,
          principal_name: '',
          identity_mode: 'manual',
          roster: [],
          sections: [
            {
              subject: 'reading',
              question_count: 20,
              duration_minutes: 45,
              calculator: false,
              model_no: modelNo
            },
            {
              subject: 'math',
              question_count: 25,
              duration_minutes: 45,
              calculator: true,
              model_no: modelNo
            }
          ],
          count_mode: 'total',
          settings: {
            show_result: true,
            show_answers: false,
            show_indicator_result: true,
            show_correct_count: true,
            shuffle_questions: true,
            shuffle_options: true,
            allow_copy: false,
            disable_right_click: true,
            disable_print: true,
            disable_shortcuts: true,
            allow_back: true,
            one_per_page: true,
            lock_session: true,
            log_visibility: true,
            watermark: true,
            attempts: 1,
            break_minutes: 2
          }
        };

        // 1. Preview Draft
        const draft = await window.NafesTeacher.api('teacher_preview', { config, regenerate: false });
        if (!draft?.draft_id) throw new Error('فشل إعداد مسودة الاختبار.');

        // 2. Publish Test
        const published = await window.NafesTeacher.api('teacher_publish', { draft_id: draft.draft_id });

        showStandardFeedback(`تم نشر المحاكاة الشاملة بنجاح! الرابط جاهز: ${published.url}`, 'ok');

        // Show QR modal with the newly created test
        showSimQr(published.id, published.title, published.url);

        // Reload published simulations list
        await loadSimulations();
      } catch (err) {
        showStandardFeedback('فشل نشر المحاكاة الشاملة: ' + err.message, 'err');
      } finally {
        isPublishing = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀</span> تكوين ونشر المحاكاة الشاملة';
      }
    };
  }

  function showCustomFeedback(msg, type) {
    const el = $('customSimFeedback');
    if (!el) return;
    el.textContent = msg;
    el.className = `form-feedback ${type === 'ok' ? 'success' : 'danger'}`;
    el.classList.remove('hidden');
  }

  function showStandardFeedback(msg, type) {
    const el = $('simFormFeedback');
    if (!el) return;
    el.textContent = msg;
    el.className = `form-feedback ${type === 'ok' ? 'success' : 'danger'}`;
    el.classList.remove('hidden');
  }

  function setupSingleDomainForm() {
    const form = $('singleDomainSimForm');
    if (!form) return;

    form.onsubmit = async e => {
      e.preventDefault();
      if (isPublishing) return;

      const title = $('singleSimTitle').value.trim() || 'اختبار محاكاة نافس - مجال مخصص';
      const subject = $('singleSimSubject').value;
      const className = $('singleSimClass').value.trim();
      const count = Number($('singleSimCount').value || 20);
      const duration = Number($('singleSimDuration').value || 35);
      const schoolName = $('singleSimSchool').value.trim();
      const teacherName = $('singleSimTeacher').value.trim();
      const submitBtn = $('publishSingleSimBtn');
      const feedback = $('singleSimFeedback');

      if (!className) {
        showSingleFeedback('يرجى تحديد الفصل الدراسي', 'err');
        return;
      }

      const avail = simulationSummary[subject] || 0;
      if (avail === 0) {
        showSingleFeedback(`رصيد بنك المحاكاة المستقل لمادة (${subject === 'reading' ? 'القراءة' : subject === 'math' ? 'الرياضيات' : 'العلوم'}) هو ٠ سؤال معتمد حالياً. لا يمكن إنشاء اختبار محاكاة بدون أسئلة معتمدة في بنك المحاكاة، ولن يتم استخدام بنك المؤشرات كبديل.`, 'err');
        return;
      }

      if (count > avail) {
        showSingleFeedback(`العدد المطلوب (${ar(count)}) أكبر من الرصيد المتاح في بنك المحاكاة (${ar(avail)} سؤال). لن يتم تكرار أي أسئلة؛ يرجى طلب عدد لا يتجاوز ${ar(avail)} سؤالاً.`, 'err');
        return;
      }

      isPublishing = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'جارٍ تكوين ونشر اختبار المجال الواحد...';
      feedback.classList.add('hidden');

      try {
        const config = {
          kind: 'simulation',
          simulation_mode: 'single_domain',
          bank_source: 'simulation_bank',
          grade_key: 'middle_3',
          title: title,
          class_name: className,
          school_name: schoolName,
          teacher_name: teacherName,
          principal_name: '',
          identity_mode: 'manual',
          roster: [],
          sections: [
            {
              subject: subject,
              question_count: count,
              duration_minutes: duration,
              calculator: subject === 'math'
            }
          ],
          count_mode: 'total',
          settings: {
            show_result: true,
            show_answers: false,
            show_indicator_result: true,
            show_correct_count: true,
            shuffle_questions: true,
            shuffle_options: true,
            allow_copy: false,
            disable_right_click: true,
            disable_print: true,
            disable_shortcuts: true,
            allow_back: true,
            one_per_page: true,
            lock_session: true,
            log_visibility: true,
            watermark: true,
            attempts: 1,
            break_minutes: 2
          }
        };

        const draft = await window.NafesTeacher.api('teacher_preview', { config, regenerate: false });
        if (!draft?.draft_id) throw new Error('فشل إعداد مسودة اختبار المحاكاة.');

        const published = await window.NafesTeacher.api('teacher_publish', { draft_id: draft.draft_id });

        showSingleFeedback(`تم نشر اختبار المجال الواحد بنجاح! الرابط جاهز: ${published.url}`, 'ok');
        showSimQr(published.id, published.title, published.url);
        await loadSimulations();
      } catch (err) {
        showSingleFeedback('فشل نشر اختبار المجال الواحد: ' + err.message, 'err');
      } finally {
        isPublishing = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀</span> تكوين ونشر اختبار المجال الواحد';
      }
    };
  }

  function showSingleFeedback(msg, type) {
    const el = $('singleSimFeedback');
    if (!el) return;
    el.textContent = msg;
    el.className = `form-feedback ${type === 'ok' ? 'success' : 'danger'}`;
    el.classList.remove('hidden');
  }

  window.copySimLink = async function(inputId) {
    const input = $(inputId);
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input.value);
      toast('تم نسخ رابط المحاكاة بنجاح');
    } catch (_) {
      input.select();
      document.execCommand('copy');
      toast('تم نسخ الرابط');
    }
  };

  window.showSimQr = async function(testId, title, url) {
    let modal = $('simQrModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'simQrModal';
      modal.className = 'sim-modal-layer';
      modal.innerHTML = `
        <div class="sim-modal-card">
          <button type="button" class="modal-close" onclick="closeSimQrModal()" style="position:absolute;left:18px;top:14px;border:none;background:none;font-size:24px;cursor:pointer;">×</button>
          <h3 id="qrModalTitle" style="margin:0 0 6px;font-size:18px;color:#17324d;"></h3>
          <p style="margin:0;font-size:12px;color:#687a83;">وجّه كاميرا الهاتف أو الجهاز اللوحي لفتح الاختبار فورًا</p>
          <div id="simQrBox" class="sim-qr-box"></div>
          <div class="sim-link-box" style="margin-top:14px;">
            <input type="text" id="qrModalUrl" readonly style="direction:ltr;">
            <button type="button" class="sim-btn-copy" onclick="copySimLink('qrModalUrl')">نسخ</button>
          </div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;">
            <button type="button" class="sim-act-btn primary" onclick="downloadCurrentQr()">تحميل صورة QR</button>
            <button type="button" class="sim-act-btn qr" onclick="printCurrentQr()">طباعة QR</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    $('qrModalTitle').textContent = title || 'اختبار محاكاة نافس';
    $('qrModalUrl').value = url;
    modal.classList.remove('hidden');

    const qrBox = $('simQrBox');
    qrBox.innerHTML = '';
    if (window.NafesQR) {
      await window.NafesQR.render(qrBox, url);
    }
  };

  window.closeSimQrModal = function() {
    $('simQrModal')?.classList.add('hidden');
  };

  window.downloadCurrentQr = function() {
    const qrBox = $('simQrBox');
    if (window.NafesQR && qrBox) {
      window.NafesQR.download(qrBox, 'nafes-simulation-qr.png');
    }
  };

  window.printCurrentQr = function() {
    const qrBox = $('simQrBox');
    const title = $('qrModalTitle')?.textContent || 'اختبار محاكاة نافس';
    if (window.NafesQR && qrBox) {
      window.NafesQR.print(qrBox, title);
    }
  };

  window.exportSimExcel = async function(testId) {
    toast('جارٍ تجهيز ملف Excel للمحاكاة...');
    try {
      const res = await window.NafesTeacher.api('teacher_attempts_raw');
      const attempts = (res.attempts || []).filter(a => String(a.test_id) === String(testId) && (a.submitted || a.submitted_at));
      
      const test = simulationTests.find(t => String(t.id) === String(testId)) || { id: testId, title: 'اختبار محاكاة نافس' };

      if (!window.NafesExcelEngine) {
        throw new Error('محرك Excel غير متاح');
      }

      await window.NafesExcelEngine.exportOfficialWorkbook({
        test,
        attempts,
        analytics: null
      });

      toast('تم تحميل ملف Excel بنجاح');
    } catch (err) {
      alert('تعذر تصدير Excel: ' + err.message);
    }
  };

  function toast(msg) {
    let x = $('miniToast');
    if (!x) {
      x = document.createElement('div');
      x.id = 'miniToast';
      x.className = 'mini-toast';
      document.body.appendChild(x);
    }
    x.textContent = msg;
    x.classList.add('show');
    setTimeout(() => x.classList.remove('show'), 2500);
  }

  document.addEventListener('DOMContentLoaded', initSimulationHub);
  window.addEventListener('nafes:auth-changed', e => {
    if (e.detail?.authenticated) initSimulationHub();
  });
})();
