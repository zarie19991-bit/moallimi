(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const state = { sheets: [], selected: null, session: null, busy: new Set(), edits: [], canDelete: false, imageData: '', proposal: null };
  const labels = { correct:'صحيحة', incorrect:'خاطئة', blank:'فارغة', multiple:'تظليل متعدد مؤكد', uncertain:'غير محسومة', ambiguous:'قراءة ملتبسة' };
  const uncertaintyNames = { reading:'عدم يقين القراءة', identity:'عدم يقين الهوية', answer_key:'عدم يقين مفتاح الإجابة' };
  const reasonLabels = {
    reading_status_unrecognized:'حالة القراءة غير معروفة؛ يجب التحقق من التظليل.',
    invalid_selected_evidence:'الاختيار المرصود خارج الخيارات الصحيحة للفقاعة.',
    contradictory_clear_evidence:'تتعارض القراءة المنفردة مع دليل الفقاعات.',
    contradictory_blank_evidence:'تتعارض حالة الفراغ مع وجود تظليل.',
    multiple_evidence_incomplete:'لا يوجد دليل كافٍ لإثبات تظليل فقاعتين مختلفتين.',
    markers_not_verified:'لم تُثبت مواضع المربعات الأربع؛ قد تكون شبكة الفقاعات غير محاذية.',
    identity_not_verified:'هوية الطالب لم تُثبت؛ هذا لا يغيّر الاختيارات المقروءة.',
    answer_key_missing_or_invalid:'مفتاح السؤال مفقود أو غير صالح؛ لا يُحكم بصحة الإجابة.',
    answer_key_incomplete:'مفتاح التصحيح غير مكتمل؛ يلزم استكماله والتحقق منه.',
    identity_unconfirmed:'لم تُؤكد هوية الطالب.', identity_invalid:'تعذر التحقق من هوية الطالب.',
    answer_key_missing:'مفتاح الإجابة غير مكتمل.', answer_key_invalid:'مفتاح الإجابة غير صالح.',
    reader_error:'حدث خطأ أثناء قراءة التظليل.', markers_invalid:'علامات الورقة غير واضحة.',
    prior_uncertainty_requires_explicit_review:'تحتاج الإجابة غير المحسومة سابقًا إلى مراجعة صريحة.',
    ambiguous:'توجد أكثر من قراءة محتملة.', low_confidence:'ثقة القراءة منخفضة.',
    no_mark:'لم يُرصد تظليل واضح.', conflicting_marks:'التظليل المرصود متعارض.',
    reader_failed:'تعذر تشغيل قارئ التظليل.', reading_not_run:'لم تُنفّذ قراءة التظليل.',
    reading_status_unrecognized:'حالة القراءة غير معروفة.', invalid_selected_evidence:'دليل الخيار المحدد غير صالح.',
    invalid_marked_evidence:'دليل التظليل غير صالح.', bubble_ambiguous:'التظليل يحتمل أكثر من قراءة ولا يُعد إجابة مؤكدة.',
    contradictory_clear_evidence:'بيانات التظليل الواضح متناقضة.', contradictory_blank_evidence:'بيانات الإجابة الفارغة متناقضة.',
    multiple_evidence_incomplete:'دليل التظليل المتعدد غير مكتمل.', markers_not_verified:'علامات تحديد موضع الورقة غير مؤكدة.',
    identity_not_verified:'هوية الطالب غير مؤكدة.', answer_key_missing_or_invalid:'مفتاح الإجابة مفقود أو غير صالح.',
    answer_key_incomplete:'مفتاح الإجابة غير مكتمل.', confirmed_multiple_requires_review:'تم رصد تظليل متعدد ويحتاج إلى مراجعة بشرية.'
  };
  function identifiers() { return { review_id: $('omrReviewId').value.trim(), session_id: $('omrSessionId').value.trim() }; }
  function api() {
    if (!window.NafesTeacher || typeof window.NafesTeacher.api !== 'function') throw new Error('ناقل التطوير المحلي غير محمّل. لم يُجرَ أي اتصال بالخدمات الإنتاجية.');
    return window.NafesTeacher.api;
  }
  function setError(error) { const el = $('omrError'); el.hidden = false; el.textContent = error?.message || String(error); }
  function clearError() { $('omrError').hidden = true; $('omrError').textContent = ''; }
  function announce(text) { $('omrNotice').textContent = text; }
  function busy(key, value) {
    if (value) state.busy.add(key); else state.busy.delete(key);
    document.querySelectorAll(`[data-busy="${CSS.escape(key)}"]`).forEach(el => { el.disabled = value || el.dataset.intrinsicDisabled === 'true'; });
  }
  function requestId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    throw new Error('تعذر إنشاء UUID آمن للطلب في هذا المتصفح.');
  }
  function snapshot(sheet) { return sheet?.effective_snapshot || sheet?.snapshot || {}; }
  function identityName(sheet) { const snap=snapshot(sheet);return snap.student_name || sheet?.student_name || sheet?.identity?.student_name || 'هوية غير معروفة'; }
  function unresolvedAnswer(a) {
    return a?.state === 'uncertain' || a?.status === 'ambiguous' || a?.review_pending === true ||
      !['correct','incorrect','blank','multiple'].includes(a?.state) ||
      (a?.state==='multiple' && !provenMultiple(a)) ||
      Object.values(a?.uncertainty || {}).some(v => Array.isArray(v) && v.length);
  }
  function provenMultiple(a) {
    return a?.state==='multiple' && a?.status==='multiple' && a?.selected===null &&
      Array.isArray(a?.marked) && a.marked.length>1 &&
      a.marked.every(v=>Number.isInteger(v)&&v>=0&&v<=3) && new Set(a.marked).size===a.marked.length;
  }
  function unresolvedSheet(sheet) {
    const snap=snapshot(sheet), answers=Array.isArray(snap.answers)?snap.answers:[];
    const expected=Number(state.session?.review_snapshot?.question_count);
    return snap.identity_valid !== true || !sheet?.student_id || answers.some(unresolvedAnswer) ||
      answers.length===0 || (Number.isInteger(expected) && expected > 0 && answers.length !== expected);
  }
  function statusLabel(sheet) {
    if (sheet?.blocked_duplicate) return 'تكرار يحتاج إقرارًا';
    if (sheet?.disposition === 'verified') return 'تم التحقق';
    if (unresolvedSheet(sheet)) return 'تحتاج حسمًا';
    return sheet?.disposition || 'بانتظار التحقق';
  }
  function listFrom(response) { return response?.sheets || response?.rows || response?.items || response?.data?.sheets || []; }
  function countsHtml(session) {
    const p=session?.review_snapshot||{}, first=snapshot(state.sheets[0]||{}), completed=session?.completed_at;
    const questionCount=p.question_count ?? first.total ?? first.answers?.length ?? '—';
    const rows=[['عدد الأوراق المتوقع',session?.expected_count ?? state.sheets.length],['عدد الأسئلة',questionCount],['مكتملة المراجعة',completed?'نعم':'لا'],['الإكمال',completed?new Date(completed).toLocaleString('ar-SA'):'غير مكتملة']];
    $('omrSessionSummary').innerHTML=rows.map(([a,b])=>`<div class="omr-summary-item">${escape(a)}<b>${escape(b)}</b></div>`).join('');
    $('omrSessionSummary').hidden=false;
  }
  function renderList() {
    $('omrListCount').textContent=new Intl.NumberFormat('ar-SA').format(state.sheets.length);
    if (!state.sheets.length) {
      $('omrSheets').innerHTML='<div class="omr-empty"><b>لا توجد أوراق مستلمة</b><span>لم تُحمّل أوراق من مسار التطوير المحلي.</span></div>';
      return;
    }
    $('omrSheets').innerHTML=state.sheets.map((s,i)=>{
      const id=s.id||s.sheet_id||`sheet-${i}`, selected=(state.selected?.id||state.selected?.sheet_id)===id;
      const cls=s.blocked_duplicate?'is-blocked':s.disposition==='verified'?'is-verified':'';
      return `<button type="button" class="omr-sheet-item" data-sheet-index="${i}" aria-current="${selected}" aria-label="فتح ورقة ${escape(identityName(s))}"><span class="omr-sheet-top"><span class="omr-sheet-name">${escape(identityName(s))}</span><span class="omr-state-chip ${cls}">${escape(statusLabel(s))}</span></span><span class="omr-sheet-id">${escape(id)}</span></button>`;
    }).join('');
    $('omrSheets').querySelectorAll('[data-sheet-index]').forEach(button=>button.addEventListener('click',()=>selectSheet(Number(button.dataset.sheetIndex))));
  }
  function reasonList(value) {
    if (Array.isArray(value)) return value.map(x=>typeof x==='string'?x:JSON.stringify(x));
    if (value === null || value === undefined || value === '') return [];
    return [typeof value==='string'?value:JSON.stringify(value)];
  }
  function explanation(uncertainty={}) {
    const known=['reading','identity','answer_key'];
    const parts=known.map(key=>{
      const values=reasonList(uncertainty?.[key]);
      if (!values.length) return '';
      return `<span class="omr-explain-line"><b>${uncertaintyNames[key]}:</b> ${values.map(v=>escape(reasonLabels[v]||`رمز غير معروف: ${v}`)).join('، ')}</span>`;
    }).filter(Boolean);
    const unknown=uncertainty&&typeof uncertainty==='object'?Object.keys(uncertainty).filter(k=>!known.includes(k)&&uncertainty[k]):[];
    for(const key of unknown) parts.push(`<span class="omr-explain-line"><b>رمز عدم يقين غير معروف (${escape(key)}):</b> ${reasonList(uncertainty[key]).map(escape).join('، ')}</span>`);
    return parts.join('') || '<span class="omr-explain-line">لا يوجد رمز عدم يقين مسجل.</span>';
  }
  function displayAnswer(a) {
    if (a?.state==='uncertain' || a?.status==='ambiguous' || a?.review_pending) return '<span class="omr-unresolved">غير محسومة — لا تُعرض كإجابة مؤكدة</span>';
    if (a?.state==='multiple') return provenMultiple(a) ? `متعدد مؤكد: ${a.marked.map(n=>escape(n)).join('، ')}` : '<span class="omr-unresolved">تظليل متعدد غير محسوم — لا يُعرض كإجابة مؤكدة</span>';
    if (a?.state==='blank') return 'فارغ';
    if (a?.selected !== null && a?.selected !== undefined) return `الخيار ${escape(a.selected)}`;
    if (Array.isArray(a?.marked) && a.marked.length===1 && ['correct','incorrect'].includes(a.state)) return `الخيار ${escape(a.marked[0])}`;
    return 'غير محسومة — لا تُعرض كإجابة مؤكدة';
  }
  function explanationAlerts(sheet) {
    const snap=snapshot(sheet), alerts=[];
    if (sheet?.blocked_duplicate) alerts.push(`<div class="omr-alert critical"><b>ورقة مكررة:</b> هذه الورقة محظورة حتى الإقرار الصريح عند التحقق. لا يعني ذلك أن إجاباتها خاطئة.</div>`);
    if (snap.identity_valid!==true) alerts.push('<div class="omr-alert critical"><b>الهوية غير مؤكدة.</b> لا يمكن اعتماد ورقة عادية قبل تعيين هوية صحيحة.</div>');
    if (snap.disposition==='proposal_only' || sheet?.proposal_only) alerts.push('<div class="omr-reprocess-note">نتيجة إعادة القراءة اقتراح فقط؛ لم تطبّق على إجابات الورقة. راجع الورقة واتخذ قرارًا يدويًا صريحًا.</div>');
    return alerts.join('');
  }
  function answerTable(sheet) {
    const answers=Array.isArray(snapshot(sheet).answers)?snapshot(sheet).answers:[];
    if (!answers.length) return '<div class="omr-empty"><b>لا توجد صفوف إجابة في اللقطة</b><span>لا نخمن عدد الأسئلة ولا نولّد بيانات بديلة.</span></div>';
    return `<div class="omr-table-wrap"><table class="omr-answer-table"><thead><tr><th>السؤال</th><th>المحدد / القراءة</th><th>التظليل المرصود</th><th>الحالة</th><th>عدم اليقين وأسبابه</th><th>المراجعة</th></tr></thead><tbody>${answers.map((a,i)=>{
      const stateName=a?.state||a?.status||'غير معروف', unresolved=unresolvedAnswer(a);
      const q=a?.question_number ?? a?.question ?? i+1;
      return `<tr class="${unresolved?'is-uncertain':''} ${a?.state==='multiple'?'is-multiple':''}"><td>${escape(q)}</td><td class="omr-answer-value">${displayAnswer(a)}</td><td>${Array.isArray(a?.marked)?a.marked.map(escape).join('، ')||'—':'—'}</td><td><span class="omr-status">${escape(labels[stateName]||stateName||'رمز غير معروف')}</span>${a?.reviewed_manually?'<br><small>مراجعة يدوية</small>':''}</td><td><div class="omr-explain">${explanation(a?.uncertainty)}</div></td><td>${a?.review_pending?escape(a.review_pending_reason||'تتطلب مراجعة صريحة'):unresolved?'يتطلب الحسم':'—'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function proposalHtml() {
    if (!state.proposal) return '';
    const answers=Array.isArray(snapshot(state.proposal).answers)?snapshot(state.proposal).answers:[];
    return `<section class="omr-proposal"><h4>مقترح إعادة القراءة — للعرض فقط</h4><p>المقترح التالي لم يُطبّق على الورقة. الإصدار الفعلي والإجابات المعروضة أعلاه لم تتغير تلقائيًا.</p>${answerTable(state.proposal)}</section>`;
  }
  function fact(label,value) { return `<div class="omr-fact"><span>${escape(label)}</span><b>${escape(value??'—')}</b></div>`; }
  function canVerify(sheet) {
    return !!sheet && (sheet.blocked_duplicate || !unresolvedSheet(sheet));
  }
  function hasHumanReview(sheet) {
    const answers=Array.isArray(snapshot(sheet).answers)?snapshot(sheet).answers:[];
    return !!(sheet?.reviewed_at || sheet?.reviewed_by || answers.some(a=>a?.reviewed_manually===true));
  }
  function renderDetail() {
    const sheet=state.selected;
    if (!sheet) {
      $('omrDetail').innerHTML='<div class="omr-empty omr-empty-large"><b>اختر ورقة للمراجعة</b><span>تُعرض بيانات كل ورقة وإجاباتها كاملة هنا. لن نعتبر الاحتمالات إجابات مؤكدة.</span></div>';
      return;
    }
    const snap=snapshot(sheet),answers=Array.isArray(snap.answers)?snap.answers:[],counts=snap.counts||{};
    const known=['blank','multiple','correct','incorrect','uncertain'];
    const countText=known.map(k=>`${labels[k]||k}: ${counts[k]??answers.filter(a=>a.state===k).length}`).join(' · ');
    const id=sheet.id||sheet.sheet_id;
    const verifyDisabled=!canVerify(sheet);
    const reprocessDisabled=!hasHumanReview(sheet);
    $('omrDetail').innerHTML=`<div class="omr-detail-head"><div><h3>${escape(identityName(sheet))}</h3><p>${escape(id)}</p></div><div class="omr-detail-actions"><button class="omr-action" type="button" data-action="image">عرض صورة الورقة</button><button class="omr-action" type="button" data-action="history">سجل التعديلات</button><button class="omr-action" type="button" data-action="reprocess" ${reprocessDisabled?'disabled title="إعادة القراءة هنا مقصورة على الأوراق التي سبق أن راجعها معلم"':''}>إعادة القراءة — اقتراح فقط</button><button class="omr-action primary" type="button" data-action="verify" ${verifyDisabled?'disabled title="لا يمكن اعتماد ورقة عادية غير محسومة"':''}>تحقق من الورقة</button></div></div>
      ${explanationAlerts(sheet)}
      <div class="omr-facts">${fact('الطالب',identityName(sheet))}${fact('رقم الطالب',sheet.student_id||'غير معيّن')}${fact('النموذج',snap.model||'—')}${fact('إصدار الإجابة',sheet.answer_version??'—')}</div>
      <div class="omr-facts">${fact('حالة الهوية',snap.identity_valid===true?'مؤكدة':'غير مؤكدة')}${fact('حالة الورقة',statusLabel(sheet))}${fact('الدرجات/الحالات',countText)}${fact('الإجابات المسجلة',answers.length)}</div>
      ${proposalHtml()}<figure id="omrImageContainer" class="omr-image-frame" hidden><figcaption>صورة الورقة من ناقل التطوير المحلي</figcaption><img id="omrSheetImage" alt="صورة ورقة إجابة ممسوحة"></figure>${answerTable(sheet)}
      <section class="omr-form-card" aria-labelledby="editAnswerTitle"><h4 id="editAnswerTitle">تعديل إجابة يدويًا — كل اختيار يمثل تظليلًا مرصودًا</h4><div class="omr-form-grid"><label>رقم السؤال<input id="omrQuestion" type="number" min="1" max="60" step="1" value="1"></label><div class="omr-form-wide"><span class="omr-help">اختر صفرًا أو أكثر من الخيارات. اتركها كلها فارغة لتسجيل إجابة فارغة.</span><div class="omr-checks">${[0,1,2,3].map(n=>`<label class="omr-check-choice"><input type="checkbox" name="omr-marked" value="${n}"><span>الخيار ${n}</span></label>`).join('')}</div></div><label class="omr-form-wide">سبب التعديل (٣–١٠٠٠ حرف)<textarea id="omrAnswerReason" minlength="3" maxlength="1000" required></textarea></label></div><div class="omr-form-foot"><button class="omr-action primary" type="button" data-action="edit-answer">حفظ التعديل</button><span class="omr-help">يرسل رقم السؤال من ١ إلى ٦٠، وإصدار الإجابة وUUID فريدًا لمنع التعارض والتكرار.</span></div></section>
      <section class="omr-form-card" aria-labelledby="identityTitle"><h4 id="identityTitle">تعيين هوية الطالب</h4><div class="omr-form-grid"><label class="omr-form-wide">معرّف الطالب (UUID)<input id="omrStudentId" type="text" dir="ltr" autocomplete="off"></label><label class="omr-form-wide">سبب تعيين الهوية<textarea id="omrIdentityReason" minlength="3" maxlength="1000" required></textarea></label></div><div class="omr-form-foot"><button class="omr-action" type="button" data-action="assign">تعيين الهوية</button></div></section>
      ${sheet.blocked_duplicate?'<section class="omr-form-card"><label class="omr-check-choice"><input id="omrDuplicateAck" type="checkbox"><span>أقر صراحةً أنني راجعت تنبيه التكرار قبل التحقق من هذه الورقة.</span></label><p class="omr-help">لا يمكن التحقق من ورقة مكررة دون هذا الإقرار الصريح.</p></section>':''}
      <div id="omrHistory" class="omr-history"></div>`;
    $('omrDetail').querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>runAction(btn.dataset.action,btn)));
  }
  async function selectSheet(index) {
    const item=state.sheets[index];if(!item)return;
    clearError();
    state.selected=item;
    state.imageData='';
    state.proposal=null;
    renderList();renderDetail();
  }
  function mergeSelected() {
    if(!state.selected)return;
    const id=state.selected.id||state.selected.sheet_id;
    const i=state.sheets.findIndex(s=>(s.id||s.sheet_id)===id);
    if(i>=0)state.sheets[i]=state.selected;
  }
  function disableDouble(btn,key) {
    if(state.busy.has(key))return false;
    state.busy.add(key);btn.disabled=true;btn.dataset.intrinsicDisabled='false';return true;
  }
  function enableButton(btn) { state.busy.delete(btn.dataset.action||'');btn.disabled=false; }
  async function runAction(action,button) {
    const sheet=state.selected, key=button?.dataset.action||action;
    if(!sheet||!disableDouble(button,key))return;
    clearError();
    try {
      const common={...identifiers(),sheet_id:sheet.id||sheet.sheet_id,answer_version:Number(sheet.answer_version)};
      let data;
      if(action==='edit-answer'){
        const reason=$('omrAnswerReason').value.trim(), question=Number($('omrQuestion').value);
        if(reason.length<3||reason.length>1000)throw new Error('سبب التعديل مطلوب بطول ٣ إلى ١٠٠٠ حرف.');
        if(!Number.isInteger(question)||question<1||question>60)throw new Error('رقم السؤال يجب أن يكون من ١ إلى ٦٠.');
        const marked=[...document.querySelectorAll('input[name="omr-marked"]:checked')].map(x=>Number(x.value));
        data=await api()('teacher_scan_edit_answer',{...common,question,marked,reason,request_id:requestId()});
      } else if(action==='assign'){
        const student_id=$('omrStudentId').value.trim(), reason=$('omrIdentityReason').value.trim();
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(student_id))throw new Error('أدخل معرّف الطالب بصيغة UUID صحيحة.');
        if(reason.length<3||reason.length>1000)throw new Error('سبب تعيين الهوية مطلوب بطول ٣ إلى ١٠٠٠ حرف.');
        data=await api()('teacher_scan_assign_identity',{...common,student_id,reason});
      } else if(action==='verify'){
        if(sheet.blocked_duplicate&&!$('omrDuplicateAck')?.checked)throw new Error('أكّد مراجعة تنبيه التكرار قبل المتابعة.');
        if(!sheet.blocked_duplicate&&unresolvedSheet(sheet))throw new Error('لا يمكن التحقق: يلزم حسم الهوية وكل حالات عدم اليقين أولًا.');
        data=await api()('teacher_scan_verify',{...common,acknowledge_duplicate:!!$('omrDuplicateAck')?.checked});
      } else if(action==='history'){
        const data=await api()('teacher_scan_edit_history',{...identifiers(),sheet_id:common.sheet_id,cursor:0});
        const edits=[...(data.edits||data.history||[]),...(data.identity_edits||[]).map(e=>({...e,kind:'تعيين الهوية'}))];
        $('omrHistory').innerHTML=`<h4>سجل التعديلات</h4>${edits.length?edits.map(edit=>`<article class="omr-history-entry"><b>${escape(edit.action||edit.kind||`السؤال ${edit.question??'—'}`)}</b><p>${escape(edit.reason||edit.after_answer?.manual_reason||'لا يوجد سبب مسجل')}</p><span>الإصدار ${escape(edit.answer_version??'—')} · ${escape(edit.reviewer_name||edit.reviewer_id||'مراجع')}</span>${edit.created_at?`<br><time>${escape(new Date(edit.created_at).toLocaleString('ar-SA'))}</time>`:''}</article>`).join(''):'<div class="omr-empty">لا توجد تعديلات مسجلة لهذه الورقة.</div>'}`;
        return;
      } else if(action==='image'){
        const imageResult=await api()('teacher_scan_image',{...identifiers(),sheet_id:common.sheet_id});
        const image=String(imageResult?.image_data||'');
        if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))throw new Error('لم يُعد ناقل التطوير صورة JPEG صالحة لهذه الورقة.');
        state.imageData=image;
        $('omrSheetImage').src=image;
        $('omrImageContainer').hidden=false;
        return;
      } else if(action==='reprocess'){
        data=await api()('teacher_scan_reprocess_server',common);
        state.proposal=data?.sheet?{...data.sheet,proposal_only:data.proposal_only===true}:null;
      } else return;
      await load(common.sheet_id);
      if(action==='edit-answer')announce('حُفظ التعديل في ناقل التطوير. راجع الحالة الجديدة قبل التحقق.');
      if(action==='assign')announce('حُفظ تعيين الهوية. تعيين الهوية لا يحسم إجابات القراءة غير المؤكدة.');
      if(action==='verify')announce('أعاد ناقل التطوير نتيجة التحقق؛ لا يعني ذلك نشر الدرجات.');
      if(action==='reprocess')announce(`أُعيدت القراءة كاقتراح فقط${data?.proposal_only===true?' (proposal_only=true)':''}. لم تُعدّل الإجابات تلقائيًا.`);
    } catch(error) {
      setError(error);
      // Form controls are left untouched: retry retains the user's reason and selections.
    } finally { enableButton(button); }
  }
  async function load(preserveId='') {
    if(state.busy.has('load'))return;
    const ids=identifiers();
    if(!ids.review_id||!ids.session_id){setError(new Error('أدخل معرّف المراجعة ومعرّف الجلسة النصيين قبل التحميل.'));return;}
    state.busy.add('load');$('omrReload').disabled=true;clearError();
    try {
      const result=await api()('teacher_scan_list',ids);
      state.session=result.session||result;
      state.sheets=listFrom(result);
      if(!state.sheets.length&&result.sheet)state.sheets=[result.sheet];
      countsHtml(state.session);
      state.selected=preserveId?state.sheets.find(s=>(s.id||s.sheet_id)===preserveId)||null:null;
      state.imageData='';
      if(!preserveId)state.proposal=null;
      renderList();renderDetail();
      $('omrFinish').disabled=!!state.session.completed_at || state.sheets.some(s=>s.disposition!=='verified'||(!s.blocked_duplicate&&unresolvedSheet(s)));
      announce(state.sheets.length?`تم تحميل ${new Intl.NumberFormat('ar-SA').format(state.sheets.length)} ورقة من ناقل التطوير المحلي.`:'اكتملت استجابة الناقل، ولا تتضمن أوراقًا. لم تُختلق بيانات محاولات.');
    }catch(error){setError(error);announce('تعذر تحميل بيانات جلسة التطوير. لم يتم الاتصال بخدمة الإنتاج.');}
    finally{state.busy.delete('load');$('omrReload').disabled=false;}
  }
  async function finish() {
    if($('omrFinish').disabled||state.busy.has('finish'))return;
    state.busy.add('finish');$('omrFinish').disabled=true;clearError();
    try {
      const result=await api()('teacher_scan_finish',identifiers());
      state.session=result.session||state.session;
      countsHtml(state.session);
      announce('أعاد ناقل التطوير حالة إكمال المراجعة. نشر الدرجات ما زال محظورًا بصورة مستقلة.');
    }catch(error){setError(error);$('omrFinish').disabled=false;}
    finally{state.busy.delete('finish');}
  }
  $('omrReload').addEventListener('click',load);
  $('omrFinish').addEventListener('click',finish);
  $('omrCapabilities').addEventListener('click',()=>announce(`قدرات البيئة المحلية: can_delete_sql=${state.canDelete?'true':'false'}. لا يوجد إجراء حذف مفعّل.`));
  $('omrDelete').disabled=true; // No authorized deletion handler is available in this UI.
  $('omrDelete').dataset.intrinsicDisabled='true';
  $('omrReviewId').addEventListener('input',clearError);
  $('omrSessionId').addEventListener('input',clearError);
  const localReady=window.MoallimiLocal?.ready;
  if(localReady){
    Promise.resolve(typeof localReady==='function'?localReady():localReady).then(response=>{
      const ready=response?.session||response||{};
      $('omrReviewId').value=String(ready.review_id||'batch-140');
      $('omrSessionId').value=String(ready.session_id||'11111111-1111-4111-8111-111111111111');
      $('omrReload').click();
    }).catch(error=>setError(error));
  }
  // Do not fabricate records if the preloaded legacy teacher_data path is unavailable.
  if (!window.NafesTeacher?.api) setError(new Error('ناقل التطوير المحلي غير متاح. لم يُستخدم teacher-access.js ولا توجد محاولة إنتاجية.'));
  else state.canDelete=window.NafesTeacher.capabilities?.can_delete_sql===true;
})();
