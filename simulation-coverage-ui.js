/* تحسين عرض اكتمال مؤشرات بنك المحاكاة — لا يغيّر منطق الاختبارات */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ar = n => new Intl.NumberFormat('ar-SA').format(Number(n || 0));
  const subjectNames = { reading: 'القراءة', math: 'الرياضيات', science: 'العلوم' };
  let catalog = [];

  function ensureUi() {
    const list = $('customIndicatorsList');
    if (!list) return;
    list.style.maxHeight = '520px';
    list.style.overflowY = 'auto';

    if (!$('simCoverageSummary')) {
      const notice = $('customSubjectBankNotice');
      notice?.insertAdjacentHTML('beforebegin', `
        <div id="simCoverageSummary" style="margin:0 0 10px;padding:10px 12px;border:1px solid #cce8dd;background:#f4fbf8;border-radius:12px;color:#184e3d;font-size:12px;font-weight:800;line-height:1.7;">
          جارٍ التحقق من اكتمال المؤشرات في بنك المحاكاة...
        </div>
      `);
    }

    if (!$('customIndicatorSearch')) {
      list.insertAdjacentHTML('beforebegin', `
        <div style="margin:0 0 8px;">
          <input id="customIndicatorSearch" type="search" placeholder="ابحث في مؤشرات المادة..." autocomplete="off"
            style="width:100%;box-sizing:border-box;border:1px solid #d7e5e2;border-radius:10px;padding:9px 11px;font-family:inherit;font-size:12px;background:#fff;">
        </div>
      `);
      $('customIndicatorSearch')?.addEventListener('input', applyFilter);
    }
  }

  function applyFilter() {
    const q = String($('customIndicatorSearch')?.value || '').trim().toLowerCase();
    const rows = [...document.querySelectorAll('#customIndicatorsList .sim-ind-row')];
    let visible = 0;
    rows.forEach(row => {
      const show = !q || String(row.textContent || '').toLowerCase().includes(q) || String(row.dataset.key || '').toLowerCase().includes(q);
      row.style.display = show ? 'flex' : 'none';
      if (show) visible++;
    });
    const badge = $('customIndicatorsCountBadge');
    if (badge && q) badge.dataset.searchCount = String(visible);
  }

  function renderCoverage() {
    const summary = $('simCoverageSummary');
    if (!summary || !catalog.length) return;
    const parts = ['reading','math','science'].map(subject => {
      const items = catalog.filter(i => i.subject === subject);
      const ready = items.filter(i => Number(i.available || 0) >= 10).length;
      const ok = items.length > 0 && ready === items.length;
      return `<span style="display:inline-block;margin-left:12px;color:${ok ? '#0f514c' : '#b3261e'};">${ok ? '✓' : '⚠'} ${subjectNames[subject]}: ${ar(ready)}/${ar(items.length)}</span>`;
    });
    summary.innerHTML = `<b>اكتمال مؤشرات المحاكاة:</b> ${parts.join('')}<div style="font-weight:600;color:#5c7079;margin-top:3px;">كل مؤشر جاهز يحتوي على ١٠ أسئلة معتمدة على الأقل. استخدم البحث أو مرّر داخل القائمة لعرض جميع المؤشرات.</div>`;
  }

  async function loadCoverage() {
    ensureUi();
    if (!window.NafesTeacher?.getKey?.()) return;
    try {
      const data = await window.NafesTeacher.api('teacher_catalog');
      catalog = Array.isArray(data?.simulation_indicators) ? data.simulation_indicators : [];
      renderCoverage();
    } catch (e) {
      const summary = $('simCoverageSummary');
      if (summary) summary.textContent = 'تعذر التحقق من اكتمال المؤشرات حاليًا.';
    }
  }

  function observeIndicatorList() {
    const list = $('customIndicatorsList');
    if (!list) return;
    const observer = new MutationObserver(() => {
      ensureUi();
      applyFilter();
    });
    observer.observe(list, { childList: true, subtree: false });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureUi();
    observeIndicatorList();
    loadCoverage();
    $('customSimSubject')?.addEventListener('change', () => {
      if ($('customIndicatorSearch')) $('customIndicatorSearch').value = '';
      setTimeout(applyFilter, 0);
    });
  });
  window.addEventListener('nafes:auth-changed', e => {
    if (e.detail?.authenticated) loadCoverage();
  });
})();
