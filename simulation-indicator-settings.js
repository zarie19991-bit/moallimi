/*
 * Simulation indicator upgrade
 * - Applies only to simulation.html / independent simulation bank
 * - Guarantees 10 questions per selected indicator
 * - Exposes exam settings without changing legacy indicator tests
 */
(() => {
  'use strict';

  const TARGET_PER_INDICATOR = 10;
  const MAX_SECTION_QUESTIONS = 60;
  const MAX_SELECTED_INDICATORS = Math.floor(MAX_SECTION_QUESTIONS / TARGET_PER_INDICATOR);
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ar = x => new Intl.NumberFormat('ar-SA').format(Number(x || 0));
  const subjectNames = { reading: 'القراءة', math: 'الرياضيات', science: 'العلوم' };
  let catalog = [];
  let summary = { reading: 0, math: 0, science: 0 };
  let catalogPromise = null;
  let busy = false;

  function feedback(id, msg, ok = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `form-feedback ${ok ? 'success' : 'danger'}`;
    el.classList.remove('hidden');
  }

  async function ensureCatalog(force = false) {
    if (!window.NafesTeacher?.getKey?.()) return null;
    if (catalogPromise && !force) return catalogPromise;
    catalogPromise = window.NafesTeacher.api('teacher_catalog').then(data => {
      catalog = Array.isArray(data.simulation_indicators) ? data.simulation_indicators : [];
      summary = data.simulation_summary || summary;
      return data;
    }).catch(err => {
      console.warn('Simulation indicator catalog:', err);
      return null;
    });
    return catalogPromise;
  }

  function settingBlock(prefix, standard = false) {
    const breakValue = standard ? 2 : 0;
    return `
      <details class="sim-settings-panel" ${standard ? '' : 'open'} style="margin:14px 0;border:1px solid #d7e5e2;border-radius:14px;background:#fbfdfc;overflow:hidden;">
        <summary style="cursor:pointer;padding:12px 14px;font-weight:900;color:#17324d;background:#f2f8f6;">⚙️ إعدادات الاختبار</summary>
        <div style="padding:14px;display:grid;gap:12px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
            <div class="sim-form-group" style="margin:0;">
              <label for="${prefix}Attempts">عدد المحاولات</label>
              <select id="${prefix}Attempts">
                ${Array.from({length:10},(_,i)=>`<option value="${i+1}" ${i===0?'selected':''}>${ar(i+1)} ${i===0?'محاولة':'محاولات'}</option>`).join('')}
              </select>
            </div>
            <div class="sim-form-group" style="margin:0;">
              <label for="${prefix}Break">الاستراحة بين الأقسام (دقيقة)</label>
              <input id="${prefix}Break" type="number" min="0" max="30" value="${breakValue}">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;">
            <div class="sim-form-group" style="margin:0;">
              <label for="${prefix}Opens">فتح الاختبار (اختياري)</label>
              <input id="${prefix}Opens" type="datetime-local">
            </div>
            <div class="sim-form-group" style="margin:0;">
              <label for="${prefix}Closes">إغلاق الاختبار (اختياري)</label>
              <input id="${prefix}Closes" type="datetime-local">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px 14px;font-size:12px;color:#25465b;">
            <label><input id="${prefix}ShowResult" type="checkbox" checked> إظهار النتيجة للطالب بعد التسليم</label>
            <label><input id="${prefix}ShowCorrect" type="checkbox" checked> إظهار عدد الإجابات الصحيحة</label>
            <label><input id="${prefix}ShowIndicator" type="checkbox" checked> إظهار نتيجة كل مؤشر</label>
            <label><input id="${prefix}ShowAnswers" type="checkbox"> إظهار الإجابات الصحيحة والشرح</label>
            <label><input id="${prefix}ShuffleQ" type="checkbox" checked> ترتيب الأسئلة عشوائيًا</label>
            <label><input id="${prefix}ShuffleO" type="checkbox" checked> ترتيب الاختيارات عشوائيًا</label>
            <label><input id="${prefix}AllowBack" type="checkbox" checked> السماح بالعودة للسؤال السابق</label>
            <label><input id="${prefix}OnePage" type="checkbox" checked> سؤال واحد في كل صفحة</label>
          </div>
          <details style="border-top:1px dashed #d7e5e2;padding-top:9px;">
            <summary style="cursor:pointer;font-size:12px;font-weight:900;color:#0f514c;">🔒 إعدادات الحماية والنزاهة</summary>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px 14px;font-size:12px;color:#25465b;padding-top:10px;">
              <label><input id="${prefix}BlockCopy" type="checkbox" checked> منع نسخ محتوى الأسئلة</label>
              <label><input id="${prefix}RightClick" type="checkbox" checked> تعطيل زر الفأرة الأيمن</label>
              <label><input id="${prefix}Print" type="checkbox" checked> منع الطباعة من صفحة الطالب</label>
              <label><input id="${prefix}Shortcuts" type="checkbox" checked> تعطيل اختصارات النسخ والطباعة</label>
              <label><input id="${prefix}Session" type="checkbox" checked> قفل المحاولة على جلسة واحدة</label>
              <label><input id="${prefix}Visibility" type="checkbox" checked> تسجيل مغادرة/إخفاء صفحة الاختبار</label>
              <label><input id="${prefix}Watermark" type="checkbox" checked> علامة مائية على صفحة الاختبار</label>
            </div>
            <p style="margin:10px 0 0;color:#687a83;font-size:11px;line-height:1.7;">ملاحظة: قيود المتصفح تقلل النسخ والطباعة، لكنها لا تستطيع منع تصوير الشاشة على مستوى نظام التشغيل منعًا مضمونًا.</p>
          </details>
        </div>
      </details>`;
  }

  function readSettings(prefix) {
    const bool = (id, fallback) => $(id) ? !!$(id).checked : fallback;
    const value = id => $(id)?.value || null;
    return {
      show_result: bool(prefix + 'ShowResult', true),
      show_answers: bool(prefix + 'ShowAnswers', false),
      show_indicator_result: bool(prefix + 'ShowIndicator', true),
      show_correct_count: bool(prefix + 'ShowCorrect', true),
      shuffle_questions: bool(prefix + 'ShuffleQ', true),
      shuffle_options: bool(prefix + 'ShuffleO', true),
      allow_copy: !bool(prefix + 'BlockCopy', true),
      disable_right_click: bool(prefix + 'RightClick', true),
      disable_print: bool(prefix + 'Print', true),
      disable_shortcuts: bool(prefix + 'Shortcuts', true),
      allow_back: bool(prefix + 'AllowBack', true),
      one_per_page: bool(prefix + 'OnePage', true),
      lock_session: bool(prefix + 'Session', true),
      log_visibility: bool(prefix + 'Visibility', true),
      watermark: bool(prefix + 'Watermark', true),
      opens_at: value(prefix + 'Opens'),
      closes_at: value(prefix + 'Closes'),
      attempts: Math.max(1, Math.min(10, Number(value(prefix + 'Attempts') || 1))),
      break_minutes: Math.max(0, Math.min(30, Number(value(prefix + 'Break') || 0)))
    };
  }

  function mountSettings() {
    const customForm = $('customSimForm');
    if (customForm && !$('customSetAttempts')) {
      const submit = $('publishCustomSimBtn');
      submit?.insertAdjacentHTML('beforebegin', settingBlock('customSet', false));
      const count = $('customSimCount');
      if (count) {
        count.readOnly = true;
        count.min = '10';
        count.max = '60';
        count.value = '10';
        count.title = 'يُحسب آليًا: ١٠ أسئلة لكل مؤشر مختار';
        const label = document.querySelector('label[for="customSimCount"]');
        if (label) label.textContent = 'إجمالي الأسئلة (١٠ أسئلة لكل مؤشر)';
      }
      const subtitle = customForm.parentElement?.querySelector('.card-subtitle');
      if (subtitle) subtitle.textContent = 'اختر المادة والمؤشرات؛ لكل مؤشر ١٠ أسئلة من بنك المحاكاة فقط. يمكنك اختيار حتى ٦ مؤشرات في الاختبار الواحد.';
    }

    const standardForm = $('quickSimForm');
    if (standardForm && !$('standardSetAttempts')) {
      $('publishSimBtn')?.insertAdjacentHTML('beforebegin', settingBlock('standardSet', true));
    }
  }

  window.onCustomSubjectChange = async function() {
    await ensureCatalog();
    const subject = $('customSimSubject')?.value || 'reading';
    const list = $('customIndicatorsList');
    const notice = $('customSubjectBankNotice');
    const inds = catalog.filter(i => i.subject === subject);
    const readyCount = inds.filter(i => Number(i.available || 0) >= TARGET_PER_INDICATOR).length;

    if (notice) {
      notice.innerHTML = `<span style="color:${readyCount ? '#0f514c' : '#b3261e'};">${subjectNames[subject]}: ${ar(readyCount)} مؤشرًا جاهزًا من ${ar(inds.length)} · الجاهز يعني وجود ${ar(TARGET_PER_INDICATOR)} أسئلة معتمدة على الأقل لكل مؤشر.</span>`;
    }
    if (!list) return;
    if (!inds.length) {
      list.innerHTML = '<div style="padding:14px;text-align:center;color:#687a83;">لا توجد مؤشرات متاحة حاليًا.</div>';
      return;
    }

    list.innerHTML = inds.map((item, idx) => {
      const avail = Number(item.available || 0);
      const ready = avail >= TARGET_PER_INDICATOR;
      const status = ready ? `جاهز · ${ar(avail)} متاح` : `${ar(avail)}/${ar(TARGET_PER_INDICATOR)} · غير مكتمل`;
      return `<label class="sim-ind-row" data-key="${esc(item.key)}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #edf2f0;cursor:${ready?'pointer':'not-allowed'};opacity:${ready?'1':'.62'};">
        <div style="display:flex;align-items:center;gap:10px;flex:1;">
          <input type="checkbox" class="custom-ind-check" value="${esc(item.key)}" data-available="${avail}" ${ready?'':'disabled'} onchange="updateCustomAllocationNotice()" style="width:18px;height:18px;accent-color:#0f514c;">
          <div>
            <div style="font-size:13px;font-weight:700;color:#17324d;">${ar(idx+1)}) ${esc(item.text)}</div>
            <div style="display:inline-block;font-size:11px;font-weight:800;padding:2px 8px;border-radius:6px;margin-top:2px;background:${ready?'#e7f5ef':'#fdeeee'};color:${ready?'#0f514c':'#b3261e'};">${status}</div>
          </div>
        </div>
      </label>`;
    }).join('');
    window.updateCustomAllocationNotice();
  };

  window.selectAllCustomIndicators = function(selectAll) {
    const checks = [...document.querySelectorAll('#customIndicatorsList .custom-ind-check:not(:disabled)')];
    checks.forEach((c, i) => { c.checked = !!selectAll && i < MAX_SELECTED_INDICATORS; });
    window.updateCustomAllocationNotice();
  };

  window.updateCustomAllocationNotice = function() {
    const selected = [...document.querySelectorAll('#customIndicatorsList .custom-ind-check:checked')];
    if (selected.length > MAX_SELECTED_INDICATORS) {
      const last = selected[selected.length - 1];
      if (last) last.checked = false;
      return window.updateCustomAllocationNotice();
    }
    const k = selected.length;
    const total = k * TARGET_PER_INDICATOR;
    if ($('customSimCount')) $('customSimCount').value = String(total || TARGET_PER_INDICATOR);
    if ($('customIndicatorsCountBadge')) $('customIndicatorsCountBadge').textContent = k ? `تم اختيار ${ar(k)} مؤشرًا · ${ar(total)} سؤالًا` : 'لم يتم اختيار أي مؤشر بعد';
    const notice = $('customAllocationNotice');
    if (!notice) return;
    if (!k) {
      notice.style.background = '#fdeeee';
      notice.style.borderColor = '#f5c6cb';
      notice.innerHTML = '<div style="color:#b3261e;font-weight:900;">اختر مؤشرًا واحدًا على الأقل. كل مؤشر = ١٠ أسئلة.</div>';
      return;
    }
    notice.style.background = '#f4fbf8';
    notice.style.borderColor = '#cce8dd';
    notice.innerHTML = `<div style="color:#0f514c;font-weight:900;">✓ سيُنشأ الاختبار بـ ${ar(TARGET_PER_INDICATOR)} أسئلة لكل مؤشر.</div><div style="margin-top:4px;">المؤشرات المختارة: <b>${ar(k)}</b> · إجمالي الأسئلة: <b>${ar(total)}</b> · الحد الأقصى في الاختبار الواحد: <b>${ar(MAX_SELECTED_INDICATORS)} مؤشرات / ${ar(MAX_SECTION_QUESTIONS)} سؤالًا</b>.</div>`;
  };

  function installSubmitHandlers() {
    const customForm = $('customSimForm');
    if (customForm) customForm.onsubmit = async e => {
      e.preventDefault();
      if (busy) return;
      await ensureCatalog();
      const checked = [...document.querySelectorAll('#customIndicatorsList .custom-ind-check:checked')];
      if (!checked.length) return feedback('customSimFeedback','اختر مؤشرًا واحدًا على الأقل.');
      if (checked.length > MAX_SELECTED_INDICATORS) return feedback('customSimFeedback',`الحد الأعلى ${MAX_SELECTED_INDICATORS} مؤشرات لأن لكل مؤشر ١٠ أسئلة.`);

      const subject = $('customSimSubject')?.value || 'reading';
      const indicators = checked.map(ch => {
        const item = catalog.find(x => x.key === ch.value);
        return { key: ch.value, count: TARGET_PER_INDICATOR, text: item?.text || ch.value, available: Number(item?.available || 0) };
      });
      const short = indicators.find(i => i.available < TARGET_PER_INDICATOR);
      if (short) return feedback('customSimFeedback',`المؤشر «${short.text}» لا يملك ١٠ أسئلة معتمدة في بنك المحاكاة بعد.`);

      const className = $('customSimClass')?.value?.trim() || '';
      const term = $('customSimTerm')?.value?.trim() || '';
      if (!className || !term) return feedback('customSimFeedback','حدد الفصل الدراسي وشعبة الطالب.');
      const total = indicators.length * TARGET_PER_INDICATOR;
      const duration = Math.max(5, Math.min(120, Number($('customSimDuration')?.value || 30)));
      const config = {
        kind:'simulation', simulation_mode:'custom', bank_source:'simulation_bank', grade_key:'middle_3',
        title:$('customSimTitle')?.value?.trim() || 'اختبار مؤشرات نافس مخصص',
        class_name:className, term, academic_term:term,
        school_name:$('customSimSchool')?.value?.trim() || '',
        teacher_name:$('customSimTeacher')?.value?.trim() || '', principal_name:'', identity_mode:'manual', roster:[],
        sections:[{subject,question_count:total,duration_minutes:duration,calculator:subject==='math',indicators}],
        count_mode:'per_indicator', settings:readSettings('customSet')
      };
      const btn = $('publishCustomSimBtn');
      busy = true; if (btn) { btn.disabled = true; btn.textContent = 'جارٍ تكوين ونشر الاختبار...'; }
      try {
        const draft = await window.NafesTeacher.api('teacher_preview',{config,regenerate:false});
        if (!draft?.draft_id) throw new Error('تعذر إنشاء مسودة الاختبار.');
        const published = await window.NafesTeacher.api('teacher_publish',{draft_id:draft.draft_id});
        feedback('customSimFeedback',`تم نشر الاختبار بنجاح: ${published.url}`,true);
        if (window.showSimQr) window.showSimQr(published.id,published.title,published.url);
        setTimeout(() => location.reload(), 2600);
      } catch (err) {
        feedback('customSimFeedback','فشل نشر الاختبار: ' + (err?.message || err));
      } finally {
        busy = false; if (btn) { btn.disabled = false; btn.innerHTML = '<span>🚀</span> تكوين ونشر اختبار المؤشرات المخصص'; }
      }
    };

    const standardForm = $('quickSimForm');
    if (standardForm) standardForm.onsubmit = async e => {
      e.preventDefault();
      if (busy) return;
      await ensureCatalog();
      const r = Number(summary.reading || 0), m = Number(summary.math || 0), s = Number(summary.science || 0);
      if (r < 20 || m < 25 || s < 20) return feedback('simFormFeedback',`بنك المحاكاة غير كافٍ للمحاكاة الشاملة: القراءة ${ar(r)}/٢٠، الرياضيات ${ar(m)}/٢٥، العلوم ${ar(s)}/٢٠.`);
      const className = $('simClass')?.value?.trim() || '', term = $('simTerm')?.value?.trim() || '';
      if (!className || !term) return feedback('simFormFeedback','حدد الفصل الدراسي وشعبة الطالب.');
      const modelNo = Math.max(1, Math.min(60, Number($('simModel')?.value || 1)));
      const config = {
        kind:'simulation',simulation_mode:'standard',bank_source:'simulation_bank',grade_key:'middle_3',
        title:$('simTitle')?.value?.trim() || 'اختبار محاكاة نافس الشاملة',class_name:className,term,academic_term:term,
        school_name:$('simSchool')?.value?.trim() || '',teacher_name:$('simTeacher')?.value?.trim() || '',principal_name:'',identity_mode:'manual',roster:[],
        sections:[
          {subject:'reading',question_count:20,duration_minutes:45,calculator:false,model_no:modelNo},
          {subject:'math',question_count:25,duration_minutes:45,calculator:true,model_no:modelNo},
          {subject:'science',question_count:20,duration_minutes:30,calculator:false,model_no:modelNo}
        ],count_mode:'total',settings:readSettings('standardSet')
      };
      const btn = $('publishSimBtn');
      busy = true; if (btn) { btn.disabled = true; btn.textContent = 'جارٍ تكوين ونشر المحاكاة الشاملة...'; }
      try {
        const draft = await window.NafesTeacher.api('teacher_preview',{config,regenerate:false});
        if (!draft?.draft_id) throw new Error('تعذر إنشاء مسودة المحاكاة.');
        const published = await window.NafesTeacher.api('teacher_publish',{draft_id:draft.draft_id});
        feedback('simFormFeedback',`تم نشر المحاكاة بنجاح: ${published.url}`,true);
        if (window.showSimQr) window.showSimQr(published.id,published.title,published.url);
        setTimeout(() => location.reload(),2600);
      } catch (err) {
        feedback('simFormFeedback','فشل نشر المحاكاة: ' + (err?.message || err));
      } finally {
        busy=false; if (btn) { btn.disabled=false; btn.innerHTML='<span>🚀</span> تكوين ونشر الاختبار المحاكي الشامل'; }
      }
    };
  }

  async function boot() {
    mountSettings();
    await ensureCatalog();
    await window.onCustomSubjectChange();
    // Existing simulation.js finishes its async initialization after DOMContentLoaded.
    // Re-apply our handlers briefly so the dedicated simulation behavior wins without touching legacy tests.
    let runs = 0;
    const timer = setInterval(() => {
      mountSettings();
      installSubmitHandlers();
      if (++runs >= 24) clearInterval(timer);
    }, 250);
    installSubmitHandlers();
  }

  document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('nafes:auth-changed', e => { if (e.detail?.authenticated) { catalogPromise = null; boot(); } });
})();
