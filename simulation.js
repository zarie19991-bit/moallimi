/**
 * moallimi - Dedicated Simulation Hub (مركز الاختبارات المحاكية)
 * 1. اختبار مؤشرات مخصص (Custom Indicators Exam)
 * 2. اختبار محاكي مثل نافس (Simulation Exam like NAFES)
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

  const subjectNames = {
    reading: 'القراءة',
    math: 'الرياضيات',
    science: 'العلوم'
  };

  let simulationTests = [];
  let catalogIndicators = [];
  let simulationSummary = { reading: 0, math: 0, science: 0, total: 0 };
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

  // Tab switching: Only Two Options as mandated:
  // 1. اختبار مؤشرات مخصص (custom)
  // 2. اختبار محاكي مثل نافس (full)
  window.switchSimTab = function(tab) {
    const isCustom = tab === 'custom';
    const isFull = tab === 'full' || tab === 'standard';

    $('tabCustomBtn')?.classList.toggle('active', isCustom);
    $('tabFullBtn')?.classList.toggle('active', isFull);

    $('customSimView')?.classList.toggle('hidden', !isCustom);
    $('standardSimView')?.classList.toggle('hidden', !isFull);
  };

  async function loadCatalogData() {
    try {
      const catalog = await window.NafesTeacher.api('teacher_catalog');
      catalogIndicators = catalog.simulation_indicators || [];
      simulationSummary = catalog.simulation_summary || { reading: 0, math: 0, science: 0, total: 0 };

      onCustomSubjectChange();
      updateStandardSpecsDisplay();
    } catch (err) {
      console.warn('Catalog load warning:', err);
    }
  }

  // Called when subject dropdown changes in Custom Indicators Exam
  window.onCustomSubjectChange = function() {
    const subject = $('customSimSubject')?.value || 'reading';
    const listContainer = $('customIndicatorsList');
    const noticeContainer = $('customSubjectBankNotice');

    const subjectTotal = simulationSummary[subject] || 0;
    if (noticeContainer) {
      if (subjectTotal === 0) {
        noticeContainer.innerHTML = `<span style="color:#b3261e;">رصيد بنك المحاكاة لمادة ${subjectNames[subject]}: ٠ سؤال معتمد (البنك فارغ حالياً)</span>`;
      } else {
        noticeContainer.innerHTML = `<span style="color:#0f514c;">رصيد بنك المحاكاة لمادة ${subjectNames[subject]}: ${ar(subjectTotal)} سؤال معتمد صالح للاستخدام</span>`;
      }
    }

    if (!listContainer) return;

    const inds = catalogIndicators.filter(i => i.subject === subject);
    if (!inds.length) {
      listContainer.innerHTML = '<div style="padding:14px;font-size:12px;color:#687a83;text-align:center;">جارٍ تحميل مؤشرات المادة من بنك المحاكاة...</div>';
      return;
    }

    listContainer.innerHTML = inds.map((item, idx) => {
      const isAvailable = (item.available || 0) > 0;
      const availText = isAvailable
        ? `${ar(item.available)} سؤالًا متاحًا في بنك المحاكاة`
        : '٠ متاح في بنك المحاكاة المستقل';
      const badgeClass = isAvailable ? 'avail' : 'zero';

      return `
        <label class="sim-ind-row" data-key="${esc(item.key)}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #edf2f0;cursor:pointer;">
          <div style="display:flex;align-items:center;gap:10px;flex:1;">
            <input type="checkbox" class="custom-ind-check" value="${esc(item.key)}" ${!isAvailable ? 'disabled' : ''} onchange="updateCustomAllocationNotice()" style="width:18px;height:18px;accent-color:#0f514c;">
            <div>
              <div style="font-size:13px;font-weight:700;color:#17324d;">${ar(idx + 1)}) ${esc(item.text)}</div>
              <div class="sim-ind-badge ${badgeClass}" style="display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;margin-top:2px;">${availText}</div>
            </div>
          </div>
        </label>
      `;
    }).join('');

    updateCustomAllocationNotice();
  };

  window.selectAllCustomIndicators = function(selectAll) {
    const listContainer = $('customIndicatorsList');
    if (!listContainer) return;
    const checks = listContainer.querySelectorAll('.custom-ind-check:not(:disabled)');
    checks.forEach(c => { c.checked = !!selectAll; });
    updateCustomAllocationNotice();
  };

  window.updateCustomAllocationNotice = function() {
    const notice = $('customAllocationNotice');
    const countBadge = $('customIndicatorsCountBadge');
    if (!notice) return;

    const subject = $('customSimSubject')?.value || 'reading';
    const totalQ = Math.max(1, Number($('customSimCount')?.value || 20));
    const checked = [...document.querySelectorAll('#customIndicatorsList .custom-ind-check:checked')];
    const k = checked.length;

    if (countBadge) {
      countBadge.textContent = k > 0 ? `تم اختيار ${ar(k)} مؤشرًا` : 'لم يتم اختيار أي مؤشر بعد';
    }

    if (k === 0) {
      notice.style.background = '#fdeeee';
      notice.style.borderColor = '#f5c6cb';
      notice.innerHTML = `
        <div style="color:#b3261e;font-weight:bold;">⚠️ يرجى اختيار مؤشر واحد أو عدة مؤشرات من القائمة أعلاه.</div>
      `;
      return;
    }

    // Distribute questions evenly across selected indicators with balanced remainder
    const basePerInd = Math.floor(totalQ / k);
    const remainder = totalQ % k;

    let totalAvailForSelected = 0;
    let insufficient = false;
    const allocations = [];

    checked.forEach((ch, idx) => {
      const allocated = basePerInd + (idx < remainder ? 1 : 0);
      const indObj = catalogIndicators.find(x => x.key === ch.value);
      const avail = indObj?.available || 0;
      totalAvailForSelected += avail;
      if (allocated > avail) {
        insufficient = true;
      }
      allocations.push({ text: indObj?.text || ch.value, allocated, avail });
    });

    if (insufficient || totalQ > totalAvailForSelected) {
      notice.style.background = '#fdeeee';
      notice.style.borderColor = '#f5c6cb';
      notice.innerHTML = `
        <div style="color:#b3261e;font-weight:900;font-size:13px;">الرصيد المتاح لا يكفي لإنشاء الاختبار بهذه الإعدادات.</div>
        <div style="color:#781c1c;margin-top:4px;">
          المطلوب: <b>${ar(totalQ)} سؤالًا</b> موزعة على <b>${ar(k)} مؤشرات</b> · الرصيد المتاح للمؤشرات المختارة في بنك المحاكاة: <b>${ar(totalAvailForSelected)} سؤالًا معتمدًا</b>.
        </div>
        <div style="color:#781c1c;font-size:11px;margin-top:2px;">
          ممنوع تكرار الأسئلة أو السحب من بنك المؤشرات الأساسي. يرجى خفض عدد الأسئلة أو اختيار مؤشرات يتوفر لها رصيد كافٍ.
        </div>
      `;
    } else {
      notice.style.background = '#f4fbf8';
      notice.style.borderColor = '#cce8dd';
      const remainderNotice = remainder > 0 ? ` (مع سؤال إضافي لـ ${ar(remainder)} مؤشرات لتحقيق المجموع)` : '';
      notice.innerHTML = `
        <div style="color:#0f514c;font-weight:900;font-size:13px;">✓ توزيع متوازن للأسئلة على المؤشرات المختارة:</div>
        <div style="color:#184e3d;margin-top:4px;">
          سيتم توزيع <b>${ar(totalQ)} سؤالًا</b> على <b>${ar(k)} مؤشرات</b>: <b>${ar(basePerInd)} أسئلة</b> لكل مؤشر${remainderNotice}.
        </div>
        <div style="color:#184e3d;font-size:11px;margin-top:2px;">
          الرصيد المتاح للمؤشرات المختارة كافٍ تماماً (${ar(totalAvailForSelected)} سؤالًا معتمدًا في بنك المحاكاة).
        </div>
      `;
    }
  };

  function updateStandardSpecsDisplay() {
    const totalEl = $('standardSummaryTotal');
    const readEl = $('standardReadingSpec');
    const mathEl = $('standardMathSpec');
    const sciEl = $('standardScienceSpec');

    const rAvail = simulationSummary.reading || 0;
    const mAvail = simulationSummary.math || 0;
    const sAvail = simulationSummary.science || 0;
    const totAvail = simulationSummary.total || (rAvail + mAvail + sAvail);

    if (totalEl) totalEl.textContent = `رصيد بنك المحاكاة المستقل: ${ar(totAvail)} سؤال معتمد`;
    if (readEl) readEl.textContent = `٢٠ سؤالًا · ٤٥ دقيقة (المتاح في بنك المحاكاة: ${ar(rAvail)})`;
    if (mathEl) mathEl.textContent = `٢٥ سؤالًا · ٤٥ دقيقة · 🧮 حاسبة مفعّلة (المتاح في بنك المحاكاة: ${ar(mAvail)})`;
    if (sciEl) {
      if (sAvail > 0) {
        sciEl.textContent = `٢٠ سؤالًا · ٣٠ دقيقة (المتاح في بنك المحاكاة: ${ar(sAvail)})`;
        sciEl.style.color = '#0f514c';
      } else {
        sciEl.textContent = `المتاح في بنك المحاكاة: ٠ سؤال معتمد (غير جاهز)`;
        sciEl.style.color = '#b3261e';
      }
    }
  }

  async function loadSimulations() {
    const listEl = $('simCardsList');
    const countEl = $('simCountBadge');
    if (!listEl) return;

    listEl.innerHTML = '<div class="table-loading">جارٍ تحميل الاختبارات المحاكية المنشورة...</div>';

    try {
      const catalog = await window.NafesTeacher.api('teacher_catalog');
      const tests = catalog.tests || [];

      // Filter simulation tests
      simulationTests = tests.filter(t => t.kind === 'simulation' || t.kind === 'multi_indicator' || (t.title && t.title.includes('محاكاة')));

      if (countEl) countEl.textContent = `${ar(simulationTests.length)} اختبار محاكاة`;

      if (!simulationTests.length) {
        listEl.innerHTML = `
          <div class="table-empty">
            لم تنشر أي اختبار محاكاة بعد.<br>
            استخدم نموذج "اختبار مؤشرات مخصص" أو "اختبار محاكي مثل نافس" لتكوين أول محاكاة ونشرها لفصلك فورًا.
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

        const termDisplay = test.term || test.academic_term || 'غير محدد';
        const classDisplay = test.class_name || '—';

        return `
          <article class="sim-card" data-test-id="${esc(test.id)}">
            <div class="sim-card-top">
              <div>
                <h3 class="sim-card-title">${esc(test.title || 'اختبار محاكاة نافس')}</h3>
                <div class="sim-card-meta">
                  <span>فصل الطالب: <b>${esc(classDisplay)}</b></span>
                  <span>·</span>
                  <span>الفصل الدراسي: <b>${esc(termDisplay)}</b></span>
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
              <span class="sim-part-pill" style="background:#f0f4f3;color:#2c5b52;">⚡ بنك المحاكاة المستقل</span>
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
              <button type="button" class="sim-act-btn danger" style="color:#b3261e;border-color:#f5c6cb;background:#fff5f5;" onclick="deleteSimTest('${esc(test.id)}', '${esc(test.title)}')">
                <span>🗑️</span> حذف الاختبار
              </button>
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
  }

  // 1. اختبار مؤشرات مخصص
  function setupCustomForm() {
    const form = $('customSimForm');
    if (!form) return;

    form.onsubmit = async e => {
      e.preventDefault();
      if (isPublishing) return;

      const title = $('customSimTitle').value.trim() || 'اختبار مؤشرات نافس مخصص';
      const subject = $('customSimSubject').value;
      const totalQ = Math.max(1, Number($('customSimCount').value || 20));
      const duration = Math.max(5, Number($('customSimDuration').value || 30));
      const className = $('customSimClass').value.trim();
      const term = $('customSimTerm').value.trim();
      const schoolName = $('customSimSchool').value.trim();
      const teacherName = $('customSimTeacher').value.trim();
      const submitBtn = $('publishCustomSimBtn');
      const feedback = $('customSimFeedback');

      if (!className) {
        showCustomFeedback('يرجى تحديد فصل الطالب (أ / ب / ج / د)', 'err');
        return;
      }
      if (!term) {
        showCustomFeedback('يرجى تحديد الفصل الدراسي', 'err');
        return;
      }

      const checkedBoxes = [...document.querySelectorAll('#customIndicatorsList .custom-ind-check:checked')];
      if (!checkedBoxes.length) {
        showCustomFeedback('يرجى اختيار مؤشر واحد على الأقل للمادة.', 'err');
        return;
      }

      // Check balance and distribute evenly
      const k = checkedBoxes.length;
      const basePerInd = Math.floor(totalQ / k);
      const remainder = totalQ % k;

      let totalAvail = 0;
      let insufficient = false;
      const indicatorsList = [];

      checkedBoxes.forEach((ch, idx) => {
        const allocated = basePerInd + (idx < remainder ? 1 : 0);
        const indObj = catalogIndicators.find(x => x.key === ch.value);
        const avail = indObj?.available || 0;
        totalAvail += avail;

        if (allocated > avail) {
          insufficient = true;
        }

        indicatorsList.push({
          key: ch.value,
          count: allocated,
          text: indObj?.text || ch.value
        });
      });

      if (insufficient || totalQ > totalAvail) {
        showCustomFeedback(`الرصيد المتاح لا يكفي لإنشاء الاختبار بهذه الإعدادات. الرصيد المتاح في بنك المحاكاة المستقل للمؤشرات المختارة: ${ar(totalAvail)} سؤالًا معتمدًا، بينما المطلوب: ${ar(totalQ)} سؤالًا. لن يتم تكرار أي سؤال.`, 'err');
        return;
      }

      isPublishing = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'جارٍ تكوين ونشر اختبار المؤشرات المخصص...';
      feedback.classList.add('hidden');

      try {
        const config = {
          kind: 'simulation',
          simulation_mode: 'custom',
          bank_source: 'simulation_bank',
          grade_key: 'middle_3',
          title: title,
          class_name: className,
          term: term,
          academic_term: term,
          school_name: schoolName,
          teacher_name: teacherName,
          principal_name: '',
          identity_mode: 'manual',
          roster: [],
          sections: [
            {
              subject: subject,
              question_count: totalQ,
              duration_minutes: duration,
              calculator: subject === 'math',
              indicators: indicatorsList
            }
          ],
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
            break_minutes: 0
          }
        };

        // 1. Preview Draft
        const draft = await window.NafesTeacher.api('teacher_preview', { config, regenerate: false });
        if (!draft?.draft_id) throw new Error('فشل إعداد مسودة اختبار المؤشرات.');

        // 2. Publish Test
        const published = await window.NafesTeacher.api('teacher_publish', { draft_id: draft.draft_id });

        showCustomFeedback(`تم نشر اختبار المؤشرات المخصص بنجاح! الرابط جاهز: ${published.url}`, 'ok');

        // Show QR modal with the newly created test
        showSimQr(published.id, published.title, published.url);

        // Reload published simulations list
        await loadSimulations();
      } catch (err) {
        showCustomFeedback('فشل نشر اختبار المؤشرات المخصص: ' + err.message, 'err');
      } finally {
        isPublishing = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀</span> تكوين ونشر اختبار المؤشرات المخصص';
      }
    };
  }

  // 2. اختبار محاكي مثل نافس (شامل: القراءة والرياضيات والعلوم)
  function setupStandardForm() {
    const form = $('quickSimForm');
    if (!form) return;

    form.onsubmit = async e => {
      e.preventDefault();
      if (isPublishing) return;

      const title = $('simTitle').value.trim() || 'اختبار محاكاة نافس الشاملة';
      const className = $('simClass').value.trim();
      const term = $('simTerm').value.trim();
      const schoolName = $('simSchool').value.trim();
      const teacherName = $('simTeacher').value.trim();
      const modelNo = Number($('simModel').value || 1);
      const submitBtn = $('publishSimBtn');
      const feedback = $('simFormFeedback');

      if (!className) {
        showStandardFeedback('يرجى تحديد فصل الطالب (أ / ب / ج / د)', 'err');
        return;
      }
      if (!term) {
        showStandardFeedback('يرجى تحديد الفصل الدراسي', 'err');
        return;
      }

      // Check available questions in independent simulation bank across Reading, Math, Science
      const rAvail = simulationSummary.reading || 0;
      const mAvail = simulationSummary.math || 0;
      const sAvail = simulationSummary.science || 0;
      const totalAvail = rAvail + mAvail + sAvail;

      if (totalAvail === 0 || rAvail < 20 || mAvail < 25 || sAvail < 20) {
        showStandardFeedback(`الرصيد المتاح لا يكفي لإنشاء الاختبار بهذه الإعدادات. رصيد بنك المحاكاة المستقل: القراءة (${ar(rAvail)}/٢٠)، الرياضيات (${ar(mAvail)}/٢٥)، العلوم (${ar(sAvail)}/٢٠). لا يمكن استخدام بنك المؤشرات الأساسي كبديل.`, 'err');
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
          term: term,
          academic_term: term,
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
            },
            {
              subject: 'science',
              question_count: 20,
              duration_minutes: 30,
              calculator: false,
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

  window.deleteSimTest = async function(testId, title) {
    const conf = prompt(`تنبيه: سيتم حذف اختبار "${title}" مع كافة محاولاته ونتائجه نهائياً.\nهذا الإجراء لا يحذف الطلاب في إدارة الطلاب.\nلتأكيد الحذف، اكتب كلمة: حذف`);
    if (!conf || conf.trim() !== 'حذف') {
      if (conf) alert('تم إلغاء الحذف: كلمة التأكيد غير مطابقة.');
      return;
    }

    try {
      await window.NafesTeacher.api('teacher_test_delete', { test_id: testId, confirm_word: 'حذف' });
      toast('تم حذف الاختبار ونتائجه بنجاح');
      await loadSimulations();
    } catch (err) {
      alert('فشل حذف الاختبار: ' + err.message);
    }
  };

  window.copySimLink = async function(inputId) {
    const input = $(inputId);
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input.value);
      toast('تم نسخ رابط الاختبار بنجاح');
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
