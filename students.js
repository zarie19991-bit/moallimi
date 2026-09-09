/**
 * moallimi - Teacher Student Identity & Roster Management
 * Assistant 1: Teacher UI & Student Management
 */
(()=>{
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  
  const normalizeDigits = str => String(str ?? '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

  const normalizeArabicName = str => String(str ?? '')
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  let studentList = [];
  let currentTab = 'single';
  let isManaging = false;

  function ensureStudentModal() {
    let el = $('studentsModal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'studentsModal';
    el.className = 'modal-layer hidden';
    el.innerHTML = `
      <div class="modal-card students-modal-pro">
        <button class="modal-close" type="button" aria-label="إغلاق" id="closeStudentsModalBtn">×</button>
        <header class="students-head">
          <div class="students-head-badge">إدارة طلاب وفصول نافس</div>
          <h2>سجل بيانات الطلاب والفصول</h2>
          <p>إدارة قوائم الطلاب، استيراد السجلات من Excel أو اللصق اليدوي، مع التحقق الدقيق ومنع التكرار والحفظ الآمن.</p>
        </header>

        <!-- Navigation Tabs -->
        <nav class="students-tabs" role="tablist">
          <button type="button" class="students-tab-btn active" data-tab="single" id="tabBtnSingle">
            <span>👤</span> إضافة طالب واحد
          </button>
          <button type="button" class="students-tab-btn" data-tab="bulk" id="tabBtnBulk">
            <span>📋</span> إضافة مجموعة يدويًا
          </button>
          <button type="button" class="students-tab-btn" data-tab="excel" id="tabBtnExcel">
            <span>📊</span> استيراد Excel
          </button>
          <button type="button" class="students-tab-btn" data-tab="manage" id="tabBtnManage">
            <span>👥</span> إدارة الطلاب (<span id="tabCount">0</span>)
          </button>
        </nav>

        <!-- Tab 1: Single Student -->
        <section id="tabSingle" class="students-tab-content">
          <div class="student-box-single">
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
                <small class="field-help">يستخدمها الطالب عند تسجيل الدخول للاختبار لتأكيد هويته بدون تخزين رقم الهوية كاملاً.</small>
              </div>
              <button type="submit" class="btn-primary" id="saveStudentBtn">
                <span>+</span> إضافة الطالب للقائمة
              </button>
              <div id="addStudentMsg" class="form-feedback hidden"></div>
            </form>
          </div>
        </section>

        <!-- Tab 2: Bulk Manual Paste -->
        <section id="tabBulk" class="students-tab-content hidden">
          <div class="bulk-box">
            <div class="bulk-settings-row">
              <div class="field">
                <label for="bulkGrade">الصف الدراسي لجميع الأسماء</label>
                <select id="bulkGrade">
                  <option value="الثالث المتوسط" selected>الثالث المتوسط</option>
                  <option value="الثاني المتوسط">الثاني المتوسط</option>
                  <option value="الأول المتوسط">الأول المتوسط</option>
                  <option value="السادس الابتدائي">السادس الابتدائي</option>
                </select>
              </div>
              <div class="field">
                <label for="bulkClass">الفصل / الشعبة لجميع الأسماء *</label>
                <input id="bulkClass" type="text" placeholder="مثال: ٣/١" required>
              </div>
            </div>

            <div class="field">
              <label for="bulkTextarea">الصق قائمة الطلاب هنا (كل طالب في سطر):</label>
              <textarea id="bulkTextarea" rows="7" placeholder="الصيغ المقبولة:&#10;أحمد محمد علي | 123&#10;خالد سعيد حسن    456&#10;عبدالله صالح محمد, 789&#10;يدعم الأرقام العربية والإنجليزية (١٢٣ أو 123)"></textarea>
              <small class="field-help">افصل بين الاسم وآخر ٣ أرقام بـ (|) أو مسافة أو Tab أو فاصلة.</small>
            </div>

            <div class="bulk-actions-row">
              <button type="button" class="btn-secondary" id="bulkPreviewBtn">
                <span>🔍</span> معاينة وتدقيق القائمة
              </button>
              <button type="button" class="btn-primary hidden" id="bulkCommitBtn">
                <span>✓</span> اعتماد وإضافة الطلاب (<span id="bulkValidCount">0</span>)
              </button>
            </div>

            <div id="bulkFeedback" class="form-feedback hidden"></div>

            <!-- Preview Area -->
            <div id="bulkPreviewArea" class="preview-area hidden">
              <div class="preview-stats-bar" id="bulkStatsBar"></div>
              <div class="preview-table-wrap">
                <table class="students-table preview-table" id="bulkPreviewTable">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الاسم</th>
                      <th>الصف</th>
                      <th>الفصل</th>
                      <th>آخر ٣ أرقام</th>
                      <th>الحالة المتوقعة</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- Tab 3: Excel Import -->
        <section id="tabExcel" class="students-tab-content hidden">
          <div class="excel-box">
            <div class="excel-top-actions">
              <div class="excel-upload-zone">
                <label for="excelFileInput" class="upload-dropzone" id="excelDropzone">
                  <span class="upload-icon">📁</span>
                  <b>اختر ملف Excel (.xlsx)</b>
                  <small>اسحب الملف وأفلته هنا أو اضغط للاختيار</small>
                </label>
                <input type="file" id="excelFileInput" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hidden">
              </div>
              <div class="excel-template-box">
                <h4>نموذج Excel الجاهز</h4>
                <p>قم بتنزيل النموذج وتعبئته ثم رفعه مباشرة لضمان التعرف الدقيق على الأعمدة.</p>
                <button type="button" class="btn-template" id="downloadTemplateBtn">
                  <span>📥</span> تنزيل نموذج Excel
                </button>
              </div>
            </div>

            <div id="excelWarningAlert" class="alert-danger-box hidden"></div>
            <div id="excelFeedback" class="form-feedback hidden"></div>

            <!-- Excel Preview Area -->
            <div id="excelPreviewArea" class="preview-area hidden">
              <div class="preview-stats-bar" id="excelStatsBar"></div>
              <div class="excel-commit-row">
                <button type="button" class="btn-primary" id="excelCommitBtn">
                  <span>✓</span> اعتماد وإضافة الطلاب (<span id="excelValidCount">0</span>)
                </button>
              </div>
              <div class="preview-table-wrap">
                <table class="students-table preview-table" id="excelPreviewTable">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الاسم</th>
                      <th>الصف</th>
                      <th>الفصل</th>
                      <th>آخر ٣ أرقام</th>
                      <th>الحالة المتوقعة</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- Tab 4: Manage Students -->
        <section id="tabManage" class="students-tab-content hidden">
          <div class="manage-box">
            <!-- Filter & Search Toolbar -->
            <div class="manage-toolbar">
              <div class="manage-search">
                <input id="studentSearchInput" type="search" placeholder="ابحث بالاسم أو الفصل أو آخر 3 أرقام...">
              </div>
              <div class="manage-filters">
                <select id="filterGradeSelect">
                  <option value="">جميع الصفوف</option>
                  <option value="الثالث المتوسط">الثالث المتوسط</option>
                  <option value="الثاني المتوسط">الثاني المتوسط</option>
                  <option value="الأول المتوسط">الأول المتوسط</option>
                  <option value="السادس الابتدائي">السادس الابتدائي</option>
                </select>
                <select id="filterClassSelect">
                  <option value="">جميع الفصول</option>
                </select>
              </div>
            </div>

            <!-- Class Student Counts -->
            <div class="class-counts-bar" id="classCountsBar"></div>

            <!-- Students Table -->
            <div id="studentsTableContainer" class="students-table-wrap">
              <div class="table-loading">جارٍ تحميل قائمة الطلاب...</div>
            </div>
          </div>
        </section>
      </div>

      <!-- Edit Student Sub-Modal -->
      <div id="editStudentModal" class="sub-modal-layer hidden">
        <div class="sub-modal-card">
          <h3>تعديل بيانات الطالب</h3>
          <form id="editStudentForm">
            <input type="hidden" id="editStudentId">
            <div class="field">
              <label for="editStudentName">اسم الطالب</label>
              <input id="editStudentName" type="text" required>
            </div>
            <div class="student-form-row">
              <div class="field">
                <label for="editStudentGrade">الصف الدراسي</label>
                <select id="editStudentGrade">
                  <option value="الثالث المتوسط">الثالث المتوسط</option>
                  <option value="الثاني المتوسط">الثاني المتوسط</option>
                  <option value="الأول المتوسط">الأول المتوسط</option>
                  <option value="السادس الابتدائي">السادس الابتدائي</option>
                </select>
              </div>
              <div class="field">
                <label for="editStudentClass">الفصل / الشعبة</label>
                <input id="editStudentClass" type="text" required>
              </div>
            </div>
            <div class="field">
              <label for="editStudentId3">آخر ٣ أرقام من الهوية الوطنية</label>
              <input id="editStudentId3" type="text" maxlength="3" inputmode="numeric" required>
            </div>
            <div class="sub-modal-actions">
              <button type="submit" class="btn-primary" id="saveEditStudentBtn">حفظ التعديلات</button>
              <button type="button" class="btn-secondary" id="cancelEditStudentBtn">إلغاء</button>
            </div>
            <div id="editStudentMsg" class="form-feedback hidden"></div>
          </form>
        </div>
      </div>

      <!-- Hard Delete Confirmation Dialog -->
      <div id="hardDeleteModal" class="sub-modal-layer hidden">
        <div class="sub-modal-card danger-card">
          <div class="danger-icon">⚠️</div>
          <h3>حذف الطالب ونتائجه نهائيًا</h3>
          <p class="danger-warning-text">سيتم حذف الطالب وجميع محاولاته وإجاباته ونتائجه وتحليلاته التاريخية نهائيًا من كافة السجلات.</p>
          
          <div class="danger-details-box" id="hardDeleteDetails">
            <div><b>اسم الطالب:</b> <span id="delStudentName">—</span></div>
            <div><b>الفصل:</b> <span id="delStudentClass">—</span></div>
            <div class="danger-stats-grid">
              <div class="stat-pill">محاولات المؤشرات: <b id="delExamCount">0</b></div>
              <div class="stat-pill">محاولات المحاكاة: <b id="delSimCount">0</b></div>
              <div class="stat-pill">محاولات أخرى: <b id="delAssessCount">0</b></div>
              <div class="stat-pill total">المجموع: <b id="delTotalCount">0</b></div>
            </div>
          </div>

          <div class="field confirm-field">
            <label for="deleteConfirmInput">لتأكيد الحذف النهائي، اكتب كلمة «<b>حذف</b>» أدناه:</label>
            <input id="deleteConfirmInput" type="text" placeholder="اكتب حذف هنا" autocomplete="off">
          </div>

          <div class="sub-modal-actions">
            <button type="button" class="btn-danger" id="confirmHardDeleteBtn" disabled>
              حذف الطالب وجميع نتائجه نهائيًا
            </button>
            <button type="button" class="btn-secondary" id="cancelHardDeleteBtn">إلغاء وتراجع</button>
          </div>
          <div id="hardDeleteMsg" class="form-feedback hidden"></div>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    // Event Bindings
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('#closeStudentsModalBtn')) {
        closeStudentsModal();
      }
    });

    // Tab buttons
    el.querySelectorAll('.students-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Tab 1: Single Student
    $('addStudentForm').addEventListener('submit', handleAddStudent);
    $('newStudentId3').addEventListener('input', e => {
      e.target.value = normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 3);
    });

    // Tab 2: Bulk
    $('bulkPreviewBtn').addEventListener('click', handleBulkPreview);
    $('bulkCommitBtn').addEventListener('click', handleBulkCommit);

    // Tab 3: Excel
    $('downloadTemplateBtn').addEventListener('click', () => {
      if (window.NafesExcel?.downloadStudentTemplate) {
        window.NafesExcel.downloadStudentTemplate();
      } else {
        alert('مكتبة Excel غير جاهزة.');
      }
    });

    const fileInput = $('excelFileInput');
    const dropzone = $('excelDropzone');
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files?.length) {
        handleExcelFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', e => {
      if (e.target.files?.length) {
        handleExcelFile(e.target.files[0]);
      }
    });
    $('excelCommitBtn').addEventListener('click', handleExcelCommit);

    // Tab 4: Search & Filters
    $('studentSearchInput').addEventListener('input', () => renderStudentsTable());
    $('filterGradeSelect').addEventListener('change', () => renderStudentsTable());
    $('filterClassSelect').addEventListener('change', () => renderStudentsTable());

    // Edit Modal events
    $('editStudentForm').addEventListener('submit', handleSaveEditStudent);
    $('cancelEditStudentBtn').addEventListener('click', () => $('editStudentModal').classList.add('hidden'));
    $('editStudentId3').addEventListener('input', e => {
      e.target.value = normalizeDigits(e.target.value).replace(/\D/g, '').slice(0, 3);
    });

    // Hard Delete Modal events
    $('cancelHardDeleteBtn').addEventListener('click', () => $('hardDeleteModal').classList.add('hidden'));
    $('deleteConfirmInput').addEventListener('input', e => {
      $('confirmHardDeleteBtn').disabled = e.target.value.trim() !== 'حذف';
    });
    $('confirmHardDeleteBtn').addEventListener('click', handleExecuteHardDelete);

    return el;
  }

  function switchTab(tabKey) {
    currentTab = tabKey;
    const modal = $('studentsModal');
    if (!modal) return;
    
    modal.querySelectorAll('.students-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabKey);
    });

    $('tabSingle').classList.toggle('hidden', tabKey !== 'single');
    $('tabBulk').classList.toggle('hidden', tabKey !== 'bulk');
    $('tabExcel').classList.toggle('hidden', tabKey !== 'excel');
    $('tabManage').classList.toggle('hidden', tabKey !== 'manage');

    if (tabKey === 'manage') {
      renderStudentsTable();
    }
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
    try {
      const res = await window.NafesTeacher.api('teacher_students_list', { include_archived: true });
      studentList = res.students || [];
      updateCountsAndFilters();
      renderStudentsTable();
    } catch (e) {
      const container = $('studentsTableContainer');
      if (container) container.innerHTML = `<div class="table-empty error">تعذر تحميل الطلاب: ${esc(e.message)}</div>`;
    }
  }

  function updateCountsAndFilters() {
    const activeStudents = studentList.filter(s => s.is_active !== false);
    const countEl = $('tabCount');
    if (countEl) countEl.textContent = activeStudents.length;

    // Populate Class Filter & Badges
    const classMap = new Map();
    activeStudents.forEach(s => {
      const c = s.class_name || 'بدون فصل';
      classMap.set(c, (classMap.get(c) || 0) + 1);
    });

    const filterClass = $('filterClassSelect');
    if (filterClass) {
      const prevVal = filterClass.value;
      filterClass.innerHTML = '<option value="">جميع الفصول</option>' + 
        [...classMap.keys()].sort().map(c => `<option value="${esc(c)}">${esc(c)} (${classMap.get(c)})</option>`).join('');
      filterClass.value = prevVal;
    }

    const countsBar = $('classCountsBar');
    if (countsBar) {
      countsBar.innerHTML = [...classMap.entries()].sort().map(([c, count]) => `
        <span class="class-count-pill" onclick="filterByClass('${esc(c)}')">
          <b>${esc(c)}:</b> ${count} طالب
        </span>
      `).join('') || '<small>لا توجد فصول نشطة بعد</small>';
    }
  }

  window.filterByClass = function(className) {
    const sel = $('filterClassSelect');
    if (sel) {
      sel.value = className;
      renderStudentsTable();
    }
  };

  // ----------------------------------------------------
  // Tab 1: Single Student Addition
  // ----------------------------------------------------
  async function handleAddStudent(e) {
    e.preventDefault();
    if (isManaging) return;

    const name = $('newStudentName').value.trim();
    const grade = $('newStudentGrade').value;
    const className = $('newStudentClass').value.trim();
    const id3 = normalizeDigits($('newStudentId3').value.trim());
    const msgEl = $('addStudentMsg');
    const submitBtn = $('saveStudentBtn');

    if (!name || name.length < 2) {
      showMsg(msgEl, 'يرجى إدخال اسم الطالب كاملاً (حرفان على الأقل)', 'err');
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
      updateCountsAndFilters();
      renderStudentsTable();
      toast(res.restored ? 'تمت استعادة سجل الطالب بنجاح' : 'تمت إضافة الطالب بنجاح');
    } catch (err) {
      showMsg(msgEl, 'خطأ: ' + err.message, 'err');
    } finally {
      isManaging = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>+</span> إضافة الطالب للقائمة';
    }
  }

  // ----------------------------------------------------
  // Tab 2: Bulk Manual Paste Logic
  // ----------------------------------------------------
  let parsedBulkRows = [];

  function parseBulkText(text, defaultGrade, defaultClass) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      let name = '';
      let id3 = '';

      // Pattern 1: Delimited with | or ,
      if (rawLine.includes('|') || rawLine.includes(',')) {
        const parts = rawLine.split(/[|,]/);
        name = parts[0].trim();
        id3 = normalizeDigits(parts[1] || '').replace(/\D/g, '').slice(-3);
      } else {
        // Pattern 2: Whitespace or Tabs: "Name    123"
        const match = rawLine.match(/^(.*?)(?:\s+|\t+)([0-9٠-٩۰-۹]{3})$/);
        if (match) {
          name = match[1].trim();
          id3 = normalizeDigits(match[2]).replace(/\D/g, '').slice(-3);
        } else {
          // Fallback: extract last contiguous digits
          const allDigits = normalizeDigits(rawLine).match(/[0-9]+/g);
          if (allDigits && allDigits.length) {
            const lastGroup = allDigits[allDigits.length - 1];
            id3 = lastGroup.slice(-3);
            name = rawLine.replace(new RegExp(`${lastGroup}$`), '').trim();
          } else {
            name = rawLine.trim();
            id3 = '';
          }
        }
      }

      const normName = normalizeArabicName(name);
      let status = 'new';
      let statusLabel = 'جديد';
      let reason = '';

      if (!name || name.length < 2) {
        status = 'rejected';
        statusLabel = 'مرفوض';
        reason = 'الاسم قصير جداً';
      } else if (!id3 || id3.length !== 3) {
        status = 'review';
        statusLabel = 'يحتاج مراجعة';
        reason = 'رقم الهوية غير مكتمل';
      } else {
        // Check database matching
        const existing = studentList.find(s => 
          (s.national_id_last3 === id3) && 
          (normalizeArabicName(s.full_name || s.student_name) === normName)
        );

        if (existing) {
          if (!existing.is_active) {
            status = 'restore';
            statusLabel = 'سيتم استعادته';
          } else if (existing.class_name !== defaultClass || existing.grade !== defaultGrade) {
            status = 'update';
            statusLabel = 'سيتم تحديثه';
          } else {
            status = 'existing';
            statusLabel = 'موجود مسبقًا';
          }
        }
      }

      rows.push({
        lineNo: i + 1,
        full_name: name,
        grade: defaultGrade,
        class_name: defaultClass,
        national_id_last3: id3,
        status,
        statusLabel,
        reason
      });
    }

    return rows;
  }

  function handleBulkPreview() {
    const text = $('bulkTextarea').value.trim();
    const grade = $('bulkGrade').value;
    const className = $('bulkClass').value.trim();
    const feedback = $('bulkFeedback');
    const previewArea = $('bulkPreviewArea');
    const commitBtn = $('bulkCommitBtn');

    if (!className) {
      showMsg(feedback, 'يرجى كتابة الفصل / الشعبة أولاً لتطبيقه على جميع الأسماء', 'err');
      return;
    }
    if (!text) {
      showMsg(feedback, 'يرجى لصق قائمة الأسماء في المربع المخصص', 'err');
      return;
    }

    parsedBulkRows = parseBulkText(text, grade, className);
    if (!parsedBulkRows.length) {
      showMsg(feedback, 'لم يتم التعرف على أي أسطر قابلة للقراءة.', 'err');
      return;
    }

    renderPreviewTable('bulk', parsedBulkRows);
    previewArea.classList.remove('hidden');

    const validCount = parsedBulkRows.filter(r => ['new', 'update', 'restore'].includes(r.status)).length;
    $('bulkValidCount').textContent = validCount;
    commitBtn.classList.toggle('hidden', validCount === 0);
  }

  function renderPreviewTable(prefix, rows) {
    const statsBar = $(`${prefix}StatsBar`);
    const tableTbody = $(`${prefix}PreviewTable`).querySelector('tbody');

    const counts = {
      total: rows.length,
      new: rows.filter(r => r.status === 'new').length,
      update: rows.filter(r => r.status === 'update').length,
      restore: rows.filter(r => r.status === 'restore').length,
      existing: rows.filter(r => r.status === 'existing').length,
      review: rows.filter(r => r.status === 'review').length,
      rejected: rows.filter(r => r.status === 'rejected').length
    };

    statsBar.innerHTML = `
      <span class="p-chip total">إجمالي الصفوف: <b>${counts.total}</b></span>
      <span class="p-chip new">جديد: <b>${counts.new}</b></span>
      <span class="p-chip update">سيتم تحديثه: <b>${counts.update}</b></span>
      <span class="p-chip restore">سيتم استعادته: <b>${counts.restore}</b></span>
      <span class="p-chip existing">موجود مسبقًا: <b>${counts.existing}</b></span>
      <span class="p-chip review">يحتاج مراجعة: <b>${counts.review}</b></span>
      <span class="p-chip rejected">مرفوض: <b>${counts.rejected}</b></span>
    `;

    tableTbody.innerHTML = rows.map((r, i) => `
      <tr class="status-row-${esc(r.status)}">
        <td>${i + 1}</td>
        <td><b>${esc(r.full_name || '—')}</b></td>
        <td>${esc(r.grade || '—')}</td>
        <td><span class="class-badge">${esc(r.class_name || '—')}</span></td>
        <td><code class="id3-badge">${esc(r.national_id_last3 || '—')}</code></td>
        <td>
          <span class="status-badge-${esc(r.status)}">${esc(r.statusLabel)}</span>
          ${r.reason ? `<small class="status-reason">(${esc(r.reason)})</small>` : ''}
        </td>
      </tr>
    `).join('');
  }

  async function handleBulkCommit() {
    const validRows = parsedBulkRows.filter(r => ['new', 'update', 'restore'].includes(r.status));
    if (!validRows.length) return;

    const commitBtn = $('bulkCommitBtn');
    const feedback = $('bulkFeedback');
    commitBtn.disabled = true;
    commitBtn.textContent = 'جارٍ الحفظ والاعتماد...';

    try {
      const res = await window.NafesTeacher.api('teacher_students_bulk_import', {
        students: validRows.map(r => ({
          full_name: r.full_name,
          grade: r.grade,
          class_name: r.class_name,
          national_id_last3: r.national_id_last3
        }))
      });

      const msg = `تمت العملية بنجاح! تمت إضافة ${res.added || 0}، تم تحديث ${res.updated || 0}، تمت استعادة ${res.restored || 0}، تم تجاهل ${res.ignored || 0}، تعذر إضافة ${res.failed || 0}.`;
      showMsg(feedback, msg, 'ok');
      toast('تم اعتماد الطلاب بنجاح');
      $('bulkTextarea').value = '';
      $('bulkPreviewArea').classList.add('hidden');
      commitBtn.classList.add('hidden');

      await fetchStudents();
    } catch (err) {
      showMsg(feedback, 'فشل الحفظ: ' + err.message, 'err');
    } finally {
      commitBtn.disabled = false;
      commitBtn.innerHTML = '<span>✓</span> اعتماد وإضافة الطلاب (<span id="bulkValidCount">0</span>)';
    }
  }

  // ----------------------------------------------------
  // Tab 3: Excel Import Logic
  // ----------------------------------------------------
  let parsedExcelRows = [];

  function handleExcelFile(file) {
    if (!file) return;
    const alertBox = $('excelWarningAlert');
    const feedback = $('excelFeedback');
    alertBox.classList.add('hidden');
    feedback.classList.add('hidden');

    if (typeof window.XLSX === 'undefined') {
      showMsg(feedback, 'مكتبة Excel غير متوفرة محليًا في المتصفح.', 'err');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rawJson || rawJson.length < 2) {
          showMsg(feedback, 'ملف Excel فارغ أو لا يحتوي على صفوف بيانات.', 'err');
          return;
        }

        processExcelJson(rawJson);
      } catch (err) {
        showMsg(feedback, 'تعذر قراءة ملف Excel: ' + err.message, 'err');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function processExcelJson(rawJson) {
    const alertBox = $('excelWarningAlert');
    const previewArea = $('excelPreviewArea');
    const headers = (rawJson[0] || []).map(h => String(h || '').trim());

    // Map Headers
    const colMap = { name: -1, grade: -1, class: -1, id3: -1 };
    headers.forEach((h, idx) => {
      const cleanH = h.replace(/\s+/g, ' ');
      if (/^(اسم الطالب|الاسم|الطالب|اسم)$/i.test(cleanH)) colMap.name = idx;
      if (/^(الصف|الصف الدراسي)$/i.test(cleanH)) colMap.grade = idx;
      if (/^(الفصل|الشعبة)$/i.test(cleanH)) colMap.class = idx;
      if (/^(آخر 3 أرقام|آخر ٣ أرقام|آخر 3 أرقام من الهوية|الهوية)$/i.test(cleanH)) colMap.id3 = idx;
    });

    if (colMap.name === -1) {
      showMsg($('excelFeedback'), 'تعذر العثور على عمود "اسم الطالب" في ملف Excel.', 'err');
      return;
    }

    // Strict Privacy Check: Check if ANY cell contains full National ID (10 digits)
    for (let r = 1; r < rawJson.length; r++) {
      const row = rawJson[r];
      for (const cell of row || []) {
        const strCell = normalizeDigits(cell).replace(/\s+/g, '');
        if (/^[12]\d{9}$/.test(strCell) || strCell.length >= 7) {
          alertBox.innerHTML = `
            <b>تنبيه أمان وحماية الخصوصية:</b>
            <p>الملف يحتوي رقم هوية كاملًا. حفاظًا على الخصوصية، استخدم ملفًا يحتوي آخر 3 أرقام فقط.</p>
          `;
          alertBox.classList.remove('hidden');
          previewArea.classList.add('hidden');
          $('excelFileInput').value = '';
          return;
        }
      }
    }

    parsedExcelRows = [];
    for (let r = 1; r < rawJson.length; r++) {
      const row = rawJson[r];
      if (!row || !row.length) continue;

      const rawName = String(row[colMap.name] || '').trim();
      const rawGrade = colMap.grade !== -1 ? String(row[colMap.grade] || '').trim() : 'الثالث المتوسط';
      const rawClass = colMap.class !== -1 ? String(row[colMap.class] || '').trim() : '';
      const rawId3 = colMap.id3 !== -1 ? normalizeDigits(row[colMap.id3]).replace(/\D/g, '').slice(-3) : '';

      const normName = normalizeArabicName(rawName);
      let status = 'new';
      let statusLabel = 'جديد';
      let reason = '';

      if (!rawName || rawName.length < 2) {
        status = 'rejected';
        statusLabel = 'مرفوض';
        reason = 'الاسم غير صالح';
      } else if (!rawId3 || rawId3.length !== 3) {
        status = 'review';
        statusLabel = 'يحتاج مراجعة';
        reason = 'آخر 3 أرقام غير مكتملة';
      } else {
        const existing = studentList.find(s => 
          (s.national_id_last3 === rawId3) && 
          (normalizeArabicName(s.full_name || s.student_name) === normName)
        );

        if (existing) {
          if (!existing.is_active) {
            status = 'restore';
            statusLabel = 'سيتم استعادته';
          } else if (existing.class_name !== rawClass || existing.grade !== rawGrade) {
            status = 'update';
            statusLabel = 'سيتم تحديثه';
          } else {
            status = 'existing';
            statusLabel = 'موجود مسبقًا';
          }
        }
      }

      parsedExcelRows.push({
        lineNo: r,
        full_name: rawName,
        grade: rawGrade || 'الثالث المتوسط',
        class_name: rawClass,
        national_id_last3: rawId3,
        status,
        statusLabel,
        reason
      });
    }

    renderPreviewTable('excel', parsedExcelRows);
    previewArea.classList.remove('hidden');

    const validCount = parsedExcelRows.filter(r => ['new', 'update', 'restore'].includes(r.status)).length;
    $('excelValidCount').textContent = validCount;
    $('excelCommitBtn').classList.toggle('hidden', validCount === 0);
  }

  async function handleExcelCommit() {
    const validRows = parsedExcelRows.filter(r => ['new', 'update', 'restore'].includes(r.status));
    if (!validRows.length) return;

    const commitBtn = $('excelCommitBtn');
    const feedback = $('excelFeedback');
    commitBtn.disabled = true;
    commitBtn.textContent = 'جارٍ الحفظ والاعتماد...';

    try {
      const res = await window.NafesTeacher.api('teacher_students_bulk_import', {
        students: validRows.map(r => ({
          full_name: r.full_name,
          grade: r.grade,
          class_name: r.class_name,
          national_id_last3: r.national_id_last3
        }))
      });

      const msg = `تم الاستيراد بنجاح! تمت إضافة ${res.added || 0}، تم تحديث ${res.updated || 0}، تمت استعادة ${res.restored || 0}، تم تجاهل ${res.ignored || 0}، تعذر إضافة ${res.failed || 0}.`;
      showMsg(feedback, msg, 'ok');
      toast('تم استيراد الطلاب بنجاح');
      $('excelPreviewArea').classList.add('hidden');
      $('excelFileInput').value = '';

      await fetchStudents();
    } catch (err) {
      showMsg(feedback, 'فشل الاستيراد: ' + err.message, 'err');
    } finally {
      commitBtn.disabled = false;
      commitBtn.innerHTML = '<span>✓</span> اعتماد وإضافة الطلاب (<span id="excelValidCount">0</span>)';
    }
  }

  // ----------------------------------------------------
  // Tab 4: Manage Students Table & Actions
  // ----------------------------------------------------
  function renderStudentsTable() {
    const container = $('studentsTableContainer');
    if (!container) return;

    const q = ($('studentSearchInput')?.value || '').trim().toLowerCase();
    const gradeFilter = $('filterGradeSelect')?.value || '';
    const classFilter = $('filterClassSelect')?.value || '';

    const filtered = studentList.filter(s => {
      const sName = (s.full_name || s.student_name || '').toLowerCase();
      const sClass = (s.class_name || '').toLowerCase();
      const sId3 = s.national_id_last3 || '';
      const sGrade = s.grade || 'الثالث المتوسط';

      if (gradeFilter && sGrade !== gradeFilter) return false;
      if (classFilter && sClass !== classFilter.toLowerCase()) return false;
      if (!q) return true;

      return sName.includes(q) || sClass.includes(q) || sId3.includes(q);
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div class="table-empty">
          ${studentList.length === 0 ? 'لم تتم إضافة طلاب بعد. استخدم أحد خيارات الإضافة أعلاه.' : 'لا توجد نتائج مطابقة لمعايير البحث والتصفية.'}
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
                <button type="button" class="btn-tbl-edit" data-edit-id="${esc(st.id)}" title="تعديل بيانات الطالب">تعديل</button>
                ${isActive ? `
                  <button type="button" class="btn-tbl-archive" data-archive-id="${esc(st.id)}" data-name="${esc(displayName)}" title="أرشفة الطالب وحفظ سجلاته">أرشفة</button>
                ` : `
                  <button type="button" class="btn-tbl-restore" data-restore-id="${esc(st.id)}" data-name="${esc(displayName)}" title="استعادة الطالب للنشطين">استعادة</button>
                `}
                <button type="button" class="btn-tbl-hard-del" data-hard-del-id="${esc(st.id)}" data-name="${esc(displayName)}" data-class="${esc(st.class_name || '—')}" data-attempts="${st.attempts_count || 0}" title="حذف الطالب وجميع نتائجه نهائيًا">حذف نهائي</button>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Bind Edit Buttons
    container.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editId;
        const st = studentList.find(s => s.id === id);
        if (!st) return;
        $('editStudentId').value = st.id;
        $('editStudentName').value = st.full_name || st.student_name || '';
        $('editStudentGrade').value = st.grade || 'الثالث المتوسط';
        $('editStudentClass').value = st.class_name || '';
        $('editStudentId3').value = st.national_id_last3 || '';
        $('editStudentMsg').classList.add('hidden');
        $('editStudentModal').classList.remove('hidden');
      });
    });

    // Bind Archive Buttons
    container.querySelectorAll('[data-archive-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.archiveId;
        const name = btn.dataset.name;
        if (!confirm(`هل أنت متأكد من أرشفة الطالب "${name}"؟\nستبقى جميع محاولاته التاريخية ونتائجه محفوظة دائمًا.`)) return;
        btn.disabled = true;
        try {
          await window.NafesTeacher.api('teacher_student_delete', { student_id: id });
          toast('تمت أرشفة الطالب بأمان مع الحفاظ على نتائجه');
          await fetchStudents();
        } catch (err) {
          alert('فشلت الأرشفة: ' + err.message);
          btn.disabled = false;
        }
      });
    });

    // Bind Restore Buttons
    container.querySelectorAll('[data-restore-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.restoreId;
        btn.disabled = true;
        try {
          await window.NafesTeacher.api('teacher_student_restore', { student_id: id });
          toast('تمت استعادة الطالب بنجاح');
          await fetchStudents();
        } catch (err) {
          alert('فشلت الاستعادة: ' + err.message);
          btn.disabled = false;
        }
      });
    });

    // Bind Hard Delete Buttons
    container.querySelectorAll('[data-hard-del-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.hardDelId;
        const st = studentList.find(s => s.id === id);
        if (!st) return;

        $('delStudentName').textContent = btn.dataset.name;
        $('delStudentClass').textContent = btn.dataset.class;
        
        // Approximate breakdown from attempts count or detail
        const total = Number(btn.dataset.attempts || 0);
        $('delExamCount').textContent = st.exam_attempts_count || '—';
        $('delSimCount').textContent = st.sim_attempts_count || '—';
        $('delAssessCount').textContent = st.assess_attempts_count || '—';
        $('delTotalCount').textContent = total;

        $('deleteConfirmInput').value = '';
        $('confirmHardDeleteBtn').disabled = true;
        $('confirmHardDeleteBtn').dataset.targetId = id;
        $('hardDeleteMsg').classList.add('hidden');
        $('hardDeleteModal').classList.remove('hidden');
      });
    });
  }

  // Edit Student Form Submit
  async function handleSaveEditStudent(e) {
    e.preventDefault();
    const id = $('editStudentId').value;
    const name = $('editStudentName').value.trim();
    const grade = $('editStudentGrade').value;
    const className = $('editStudentClass').value.trim();
    const id3 = normalizeDigits($('editStudentId3').value.trim());
    const msg = $('editStudentMsg');
    const btn = $('saveEditStudentBtn');

    if (!name || name.length < 2) {
      showMsg(msg, 'الاسم الكامل يجب أن يكون حرفين على الأقل', 'err');
      return;
    }
    if (!/^\d{3}$/.test(id3)) {
      showMsg(msg, 'آخر ٣ أرقام يجب أن تكون ٣ أرقام بالضبط', 'err');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'جارٍ الحفظ...';

    try {
      const res = await window.NafesTeacher.api('teacher_student_update', {
        id,
        student_id: id,
        full_name: name,
        grade,
        class_name: className,
        national_id_last3: id3
      });

      toast('تم تحديث بيانات الطالب بنجاح');
      $('editStudentModal').classList.add('hidden');
      await fetchStudents();
    } catch (err) {
      showMsg(msg, 'خطأ: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'حفظ التعديلات';
    }
  }

  // Hard Delete Execute
  async function handleExecuteHardDelete() {
    const btn = $('confirmHardDeleteBtn');
    const id = btn.dataset.targetId;
    const confirmWord = $('deleteConfirmInput').value.trim();
    const msg = $('hardDeleteMsg');

    if (confirmWord !== 'حذف') {
      showMsg(msg, 'يجب كتابة كلمة «حذف» بالضبط للمتابعة.', 'err');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'جارٍ الحذف النهائي...';

    try {
      const res = await window.NafesTeacher.api('teacher_student_hard_delete', {
        student_id: id,
        confirm_word: confirmWord
      });

      toast('تم حذف الطالب وكافة محاولاته نهائيًا بنجاح');
      $('hardDeleteModal').classList.add('hidden');
      await fetchStudents();
    } catch (err) {
      showMsg(msg, 'فشل الحذف: ' + err.message, 'err');
      btn.disabled = false;
      btn.textContent = 'حذف الطالب وجميع نتائجه نهائيًا';
    }
  }

  function showMsg(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `form-feedback ${type === 'ok' ? 'success' : 'danger'}`;
    el.classList.remove('hidden');
    if (type === 'ok') {
      setTimeout(() => el.classList.add('hidden'), 4500);
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
    setTimeout(() => x.classList.remove('show'), 2500);
  }

  window.openStudentsModal = openStudentsModal;
  window.closeStudentsModal = closeStudentsModal;

  document.addEventListener('DOMContentLoaded', () => {
    const btn = $('navStudentsBtn');
    if (btn) btn.addEventListener('click', openStudentsModal);
  });
})();
