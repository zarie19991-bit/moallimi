/**
 * moallimi - Teacher Student Identity & Roster Management
 * Assistant 1: Teacher UI
 */
(()=>{
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizeDigits = str => String(str ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

  let studentList = [];
  let isManaging = false;

  function ensureStudentModal() {
    let el = $('studentsModal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'studentsModal';
    el.className = 'modal-layer hidden';
    el.innerHTML = `
      <div class="modal-card students-modal">
        <button class="modal-close" type="button" aria-label="إغلاق" id="closeStudentsModalBtn">×</button>
        <header class="students-head">
          <div class="students-head-badge">قسم إدارة الطلاب</div>
          <h2>سجل بيانات الطلاب والفصول</h2>
          <p>إدارة قوائم الطلاب المعتمدين وتعيين آخر ٣ أرقام من الهوية الوطنية لضبط هوية الدخول ومنع الدخول العشوائي.</p>
        </header>

        <div class="students-body-grid">
          <!-- Add Student Panel -->
          <section class="student-add-box">
            <h3>إضافة طالب جديد</h3>
            <form id="addStudentForm" class="student-form">
              <div class="field">
                <label for="newStudentName">اسم الطالب الثلاثي أو الرباعي *</label>
                <input id="newStudentName" type="text" placeholder="مثال: أحمد عبد الله الغامدي" required autocomplete="off">
              </div>
              <div class="student-form-row">
                <div class="field">
                  <label for="newStudentGrade">الصف الدراسي</label>
                  <select id="newStudentGrade">
                    <option value="الثالث المتوسط" selected>الثالث المتوسط</option>
                    <option value="الثاني المتوسط">الثاني المتوسط</option>
                    <option value="الأول المتوسط">الأول المتوسط</option>
                    <option value="السادس الابتدائي">السادس الابتدائي</option>
                  </select>
                </div>
                <div class="field">
                  <label for="newStudentClass">الفصل / الشعبة *</label>
                  <input id="newStudentClass" type="text" placeholder="مثال: ٣/١" required>
                </div>
              </div>
              <div class="field">
                <label for="newStudentId3">آخر ٣ أرقام من الهوية الوطنية *</label>
                <div class="id3-input-wrapper">
                  <input id="newStudentId3" type="text" maxlength="3" inputmode="numeric" placeholder="مثال: 456" pattern="[0-9]{3}" required>
                  <span class="id3-hint">٣ أرقام فقط للتحقق</span>
                </div>
                <small class="field-help">يستخدمها الطالب عند تسجيل الدخول للاختبار لتأكيد هويته.</small>
              </div>
              <button type="submit" class="btn-primary" id="saveStudentBtn">
                <span>+</span> إضافة الطالب للقائمة
              </button>
              <div id="addStudentMsg" class="form-feedback hidden"></div>
            </form>
          </section>

          <!-- Student List & Search Panel -->
          <section class="students-list-box">
            <div class="list-toolbar">
              <div class="list-counts">
                <span>إجمالي الطلاب المسجلين:</span>
                <b id="studentCount">0</b>
              </div>
              <div class="list-search">
                <input id="studentSearchInput" type="search" placeholder="بحث بالاسم أو الفصل أو الهوية...">
              </div>
            </div>

            <div id="studentsTableContainer" class="students-table-wrap">
              <div class="table-loading">جارٍ تحميل قائمة الطلاب...</div>
            </div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('#closeStudentsModalBtn')) {
        closeStudentsModal();
      }
    });

    $('addStudentForm').addEventListener('submit', handleAddStudent);
    $('studentSearchInput').addEventListener('input', e => renderStudentsTable(e.target.value));

    // Handle arabic digits conversion on input
    $('newStudentId3').addEventListener('input', e => {
      e.target.value = normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 3);
    });

    return el;
  }

  async function openStudentsModal() {
    if (!window.NafesTeacher?.getKey()) {
      window.NafesTeacher?.requireKey();
      return;
    }
    const modal = ensureStudentModal();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    await fetchStudents();
  }

  function closeStudentsModal() {
    const modal = $('studentsModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  async function fetchStudents() {
    const container = $('studentsTableContainer');
    if (!container) return;
    container.innerHTML = '<div class="table-loading">جارٍ تحميل بيانات الطلاب...</div>';
    try {
      const res = await window.NafesTeacher.api('teacher_students_list', { include_archived: true });
      studentList = res.students || [];
      renderStudentsTable();
    } catch (e) {
      container.innerHTML = `<div class="table-empty error">تعذر تحميل الطلاب: ${esc(e.message)}</div>`;
    }
  }

  function renderStudentsTable(filterQuery = '') {
    const container = $('studentsTableContainer');
    const countEl = $('studentCount');
    if (!container) return;

    const q = filterQuery.trim().toLowerCase();
    const filtered = studentList.filter(s => {
      const sName = s.full_name || s.student_name || '';
      if (!q) return true;
      return sName.toLowerCase().includes(q) ||
             (s.class_name || '').toLowerCase().includes(q) ||
             (s.national_id_last3 || '').includes(q);
    });

    if (countEl) countEl.textContent = studentList.length;

    if (!filtered.length) {
      container.innerHTML = `
        <div class="table-empty">
          ${studentList.length === 0 ? 'لم تتم إضافة طلاب بعد. يمكنك إضافة طلاب الفصل من النموذج الجانبي.' : 'لا توجد نتائج مطابقة لبحثك.'}
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="students-table">
        <thead>
          <tr>
            <th>اسم الطالب</th>
            <th>الصف</th>
            <th>الفصل</th>
            <th>آخر ٣ أرقام</th>
            <th>الحالة</th>
            <th>المحاولات</th>
            <th class="actions-col">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(st => {
            const displayName = st.full_name || st.student_name || 'بدون اسم';
            const isActive = st.is_active !== false;
            return `
            <tr data-student-id="${esc(st.id)}" class="${isActive ? '' : 'archived-row'}">
              <td><b>${esc(displayName)}</b></td>
              <td>${esc(st.grade || 'الثالث المتوسط')}</td>
              <td><span class="class-badge">${esc(st.class_name || '—')}</span></td>
              <td><code class="id3-badge">${esc(st.national_id_last3 || '—')}</code></td>
              <td>
                ${isActive ? '<span class="badge-active">نشط</span>' : '<span class="badge-archived">مؤرشف</span>'}
              </td>
              <td><small>${st.attempts_count || 0} محاولة</small></td>
              <td class="actions-col">
                ${isActive ? `
                  <button type="button" class="btn-del" data-archive-id="${esc(st.id)}" data-name="${esc(displayName)}" title="أرشفة الطالب وحفظ سجلاته">أرشفة</button>
                ` : `
                  <button type="button" class="btn-restore" data-restore-id="${esc(st.id)}" data-name="${esc(displayName)}" title="استعادة الطالب لقائمة النشطين">استعادة</button>
                `}
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('[data-archive-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.archiveId;
        const name = btn.dataset.name;
        if (!confirm(`هل أنت متأكد من أرشفة الطالب "${name}"؟\nستبقى جميع محاولاته التاريخية ونتائجه محفوظة دائمًا ولن تُحذف.`)) return;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await window.NafesTeacher.api('teacher_student_delete', { student_id: id, id: id });
          toast('تمت أرشفة الطالب بأمان مع الحفاظ على جميع محاولاته');
          await fetchStudents();
        } catch (err) {
          alert('فشلت الأرشفة: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'أرشفة';
        }
      });
    });

    container.querySelectorAll('[data-restore-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.restoreId;
        const name = btn.dataset.name;
        btn.disabled = true;
        btn.textContent = '...';
        try {
          await window.NafesTeacher.api('teacher_student_restore', { student_id: id, id: id });
          toast('تمت استعادة الطالب بنجاح');
          await fetchStudents();
        } catch (err) {
          alert('فشلت الاستعادة: ' + err.message);
          btn.disabled = false;
          btn.textContent = 'استعادة';
        }
      });
    });
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    if (isManaging) return;

    const name = $('newStudentName').value.trim();
    const grade = $('newStudentGrade').value;
    const className = $('newStudentClass').value.trim();
    const id3 = normalizeDigits($('newStudentId3').value.trim());
    const msgEl = $('addStudentMsg');
    const submitBtn = $('saveStudentBtn');

    if (!name || name.length < 3) {
      showMsg(msgEl, 'يرجى إدخال اسم الطالب كاملاً (٣ أحرف على الأقل)', 'err');
      return;
    }
    if (!/^\d{3}$/.test(id3)) {
      showMsg(msgEl, 'آخر ٣ أرقام من الهوية يجب أن تكون ٣ أرقام عددية دقيقة', 'err');
      return;
    }

    isManaging = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'جارٍ الحفظ...';
    msgEl.classList.add('hidden');

    try {
      const res = await window.NafesTeacher.api('teacher_student_add', {
        student_name: name,
        grade: grade,
        class_name: className,
        national_id_last3: id3
      });

      if (res.student) {
        studentList = studentList.filter(s => s.id !== res.student.id);
        studentList.unshift(res.student);
      }
      $('newStudentName').value = '';
      $('newStudentClass').value = '';
      $('newStudentId3').value = '';
      showMsg(msgEl, res.message || 'تمت إضافة الطالب بنجاح!', 'ok');
      renderStudentsTable($('studentSearchInput')?.value || '');
      toast(res.restored ? 'تمت استعادة سجل الطالب بنجاح' : 'تمت إضافة الطالب بنجاح');
    } catch (err) {
      showMsg(msgEl, 'خطأ: ' + err.message, 'err');
    } finally {
      isManaging = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>+</span> إضافة الطالب للقائمة';
    }
  }

  function showMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `form-feedback ${type === 'ok' ? 'success' : 'danger'}`;
    el.classList.remove('hidden');
    if (type === 'ok') {
      setTimeout(() => el.classList.add('hidden'), 3500);
    }
  }

  function toast(t) {
    let x = $('miniToast');
    if (!x) {
      x = document.createElement('div');
      x.id = 'miniToast';
      x.className = 'mini-toast';
      document.body.appendChild(x);
    }
    x.textContent = t;
    x.classList.add('show');
    setTimeout(() => x.classList.remove('show'), 2200);
  }

  window.openStudentsModal = openStudentsModal;
  window.closeStudentsModal = closeStudentsModal;

  // Bind to navigation button when DOM loads
  document.addEventListener('DOMContentLoaded', () => {
    const btn = $('navStudentsBtn');
    if (btn) btn.addEventListener('click', openStudentsModal);
  });
})();
