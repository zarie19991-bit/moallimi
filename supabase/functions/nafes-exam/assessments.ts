import { FRAMEWORK } from './framework.ts';
import { hasCurrentReview, reviewedImage, REVIEW_VERSION } from './reviewed-bank.ts';
import { type Row, SUBJECTS, THRESHOLDS, tidy, fail, hash, token, shuffle, randomFrom, normalizeConfig, questionKey, indicatorOf, selectUnique, buildForms, cleanAnswers, gradeSections, publicSections, permuteQuestion, normalizeArabicName, normalizeLast3Digits, verifyStudentIdentity } from './assessment-engine.ts';
const BASE='https://zarie19991-bit.github.io/moallimi/';
const BANK_COLUMNS='id,subject_key,outcome_code,indicator_index,indicator_text,model_no,question_no,measurement_focus,alignment_profile,alignment_verified,alignment_evidence,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level';
const isUUID=(s:unknown)=>/^[a-f0-9-]{36}$/i.test(String(s));
function must(result:Row) {if(result.error)throw result.error;return result.data;}
function rendered(row:Row) {return{id:row.id,subject:row.subject_key,outcome:row.outcome_code,indicator:row.indicator_index,indicator_key:`${row.subject_key}:${row.outcome_code}:i${row.indicator_index}`,indicator_text:row.indicator_text,model_no:row.model_no,question_no:row.question_no,context:row.context_text||null,question:row.question_text,options:row.options,correctIndex:row.correct_index,explanation:row.explanation||null,cognitive_level:row.cognitive_level,difficulty:row.difficulty,image:reviewedImage(row)};}
async function fullPool(db:any,subject:string,keys?:string[],ids?:string[]) {const all:Row[]=[];const scoped=keys?.map(key=>FRAMEWORK.find(i=>i.key===key)).filter(Boolean)||[];for(let start=0;;start+=500){let query=db.from('nafes_question_bank').select(BANK_COLUMNS).eq('grade_key','middle_3').eq('subject_key',subject).eq('is_active',true).eq('review_status','approved').lte('model_no',2).order('id');if(scoped.length)query=query.in('outcome_code',[...new Set(scoped.map(i=>i!.outcome))]).in('indicator_index',[...new Set(scoped.map(i=>i!.indicator))]);if(ids?.length)query=query.in('id',ids);const page=must(await query.range(start,start+499));for(const q of page||[])if(hasCurrentReview(q))all.push(rendered(q));if(!page||page.length<500)break;}return all;}

const SIM_BANK_COLUMNS='id,grade_key,subject_key,outcome_code,indicator_index,indicator_key,indicator_text,context_text,question_text,normalized_content_text,options,correct_index,explanation,difficulty,cognitive_level,review_status,content_sha256,semantic_similarity_cleared,semantic_review_evidence,is_active';

function isValidSemanticEvidence(ev:any):boolean {
  if(!ev||typeof ev!=='object'||Array.isArray(ev)) return false;
  if(!ev.method||!String(ev.method).trim()) return false;
  if(!ev.checked_at||!String(ev.checked_at).trim()) return false;
  if(!ev.reviewed_by||!String(ev.reviewed_by).trim()) return false;
  if(ev.score===undefined||ev.score===null||String(ev.score).trim()==='') return false;
  const res=String(ev.result||'').trim().toLowerCase();
  return res==='pass'||res==='cleared';
}

function renderedSimQuestion(row:Row):Row {
  return {
    id:row.id,
    bank_source:'simulation_bank',
    subject:row.subject_key,
    outcome:row.outcome_code,
    indicator:row.indicator_index,
    indicator_key:row.indicator_key,
    indicator_text:row.indicator_text,
    context:row.context_text||null,
    question:row.question_text,
    options:row.options,
    correctIndex:row.correct_index,
    explanation:row.explanation||null,
    cognitive_level:row.cognitive_level,
    difficulty:row.difficulty,
    image:null
  };
}

async function simulationPool(db:any,subject:string,keys?:string[],ids?:string[]):Promise<Row[]> {
  const all:Row[]=[];
  for(let start=0;;start+=500){
    let query=db.from('nafes_simulation_question_bank')
      .select(SIM_BANK_COLUMNS)
      .eq('grade_key','middle_3')
      .eq('subject_key',subject)
      .eq('is_active',true)
      .eq('review_status','approved')
      .eq('semantic_similarity_cleared',true)
      .order('id');
    if(keys?.length)query=query.in('indicator_key',keys);
    if(ids?.length)query=query.in('id',ids);
    const page=must(await query.range(start,start+499));
    for(const q of page||[]){
      if(isValidSemanticEvidence(q.semantic_review_evidence)){
        all.push(renderedSimQuestion(q));
      }
    }
    if(!page||page.length<500)break;
  }
  return all;
}


async function teacherStudentsList(db:any, b?:Row) {
  let query = db.from('nafes_students').select('*');
  if (b?.include_archived !== true) {
    query = query.eq('is_active', true);
  }
  const students = must(await query.order('class_name',{ascending:true}).order('name_normalized',{ascending:true}));
  const attemptCounts = new Map<string, number>();
  for (const table of ['nafes_assessment_attempts', 'nafes_simulation_attempts', 'nafes_exam_attempts']) {
    const { data: rows } = await db.from(table).select('student_id, student_key');
    for (const r of rows || []) {
      const key = r.student_id || (isUUID(r.student_key) ? r.student_key : null);
      if (key) attemptCounts.set(key, (attemptCounts.get(key) || 0) + 1);
    }
  }
  const result = (students || []).map((s: Row) => ({
    ...s,
    attempts_count: attemptCounts.get(s.id) || 0
  }));
  return { ok: true, students: result };
}

async function teacherStudentAdd(db:any, b:Row) {
  const full_name = tidy(b.full_name || b.student_name, 120);
  if (full_name.length < 2) fail('الاسم الكامل يجب أن يتكون من حرفين على الأقل.');
  const last3 = normalizeLast3Digits(b.national_id_last3 || b.student_no);
  if (!last3 || last3.length !== 3) fail('يجب إدخال آخر ٣ أرقام فقط من رقم الهوية الوطنية (٣ أرقام بالضبط).');
  const grade = tidy(b.grade, 80) || 'الصف الثالث المتوسط';
  const class_name = tidy(b.class_name, 80);
  const name_normalized = normalizeArabicName(full_name);

  // Check globally for existing student (active or archived)
  const existing = must(await db.from('nafes_students')
    .select('id, is_active, full_name')
    .eq('national_id_last3', last3)
    .eq('name_normalized', name_normalized)
    .maybeSingle());

  if (existing) {
    if (existing.is_active) {
      fail('يوجد طالب نشط مسجل مسبقًا بنفس الاسم وآخر ٣ أرقام من الهوية. يرجى توضيح الاسم (مثل كتابة الاسم الرباعي) لتفادي التضارب أثناء تسجيل الدخول.', 409);
    }
    // Student was previously archived: reactivate/restore existing record to preserve single student_id and all historical attempts
    const restored = must(await db.from('nafes_students').update({
      full_name,
      name_normalized,
      grade,
      class_name,
      national_id_last3: last3,
      is_active: true,
      archived_at: null,
      updated_at: new Date().toISOString()
    }).eq('id', existing.id).select().single());

    return {
      ok: true,
      student: restored,
      restored: true,
      message: 'تم استعادة السجل السابق للطالب وإعادة تفعيله بنجاح مع الحفاظ على جميع محاولاته السابقة.'
    };
  }

  const student = must(await db.from('nafes_students').insert({
    full_name,
    name_normalized,
    grade,
    class_name,
    national_id_last3: last3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).select().single());

  return { ok: true, student };
}

async function teacherStudentUpdate(db:any, b:Row) {
  const id = b.id || b.student_id;
  if (!isUUID(id)) fail('معرّف الطالب غير صحيح.');
  const full_name = tidy(b.full_name || b.student_name, 120);
  if (full_name.length < 2) fail('الاسم الكامل يجب أن يتكون من حرفين على الأقل.');
  const last3 = normalizeLast3Digits(b.national_id_last3 || b.student_no);
  if (!last3 || last3.length !== 3) fail('يجب إدخال آخر ٣ أرقام فقط من رقم الهوية الوطنية (٣ أرقام بالضبط).');
  const grade = tidy(b.grade, 80) || 'الصف الثالث المتوسط';
  const class_name = tidy(b.class_name, 80);
  const name_normalized = normalizeArabicName(full_name);

  const existing = must(await db.from('nafes_students')
    .select('id')
    .eq('national_id_last3', last3)
    .eq('name_normalized', name_normalized)
    .neq('id', id)
    .maybeSingle());
  if (existing) {
    fail('يوجد طالب آخر مسجل مسبقًا بنفس الاسم وآخر ٣ أرقام من الهوية. يرجى توضيح الاسم لتفادي التضارب أثناء تسجيل الدخول.', 409);
  }

  const student = must(await db.from('nafes_students').update({
    full_name,
    name_normalized,
    grade,
    class_name,
    national_id_last3: last3,
    updated_at: new Date().toISOString()
  }).eq('id', id).select().single());

  return { ok: true, student };
}

async function teacherStudentDelete(db:any, b:Row) {
  const id = b.id || b.student_id;
  if (!isUUID(id)) fail('معرّف الطالب غير صحيح.');
  const student = must(await db.from('nafes_students').select('id, full_name, is_active').eq('id', id).maybeSingle());
  if (!student) fail('الطالب غير موجود.', 404);

  // Soft archive to protect student_id link across all historical and future attempts
  const archived = must(await db.from('nafes_students').update({
    is_active: false,
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', id).select().single());

  return { ok: true, id, student: archived, archived: true };
}

async function teacherStudentRestore(db:any, b:Row) {
  const id = b.id || b.student_id;
  if (!isUUID(id)) fail('معرّف الطالب غير صحيح.');
  const student = must(await db.from('nafes_students').select('id, full_name, name_normalized, national_id_last3, is_active').eq('id', id).maybeSingle());
  if (!student) fail('الطالب غير موجود.', 404);

  // Check if restoring would collide with another currently active student
  const conflict = must(await db.from('nafes_students')
    .select('id')
    .eq('national_id_last3', student.national_id_last3)
    .eq('name_normalized', student.name_normalized)
    .eq('is_active', true)
    .neq('id', id)
    .maybeSingle());
  if (conflict) {
    fail('لا يمكن استعادة الطالب لوجود طالب نشط آخر حاليًا بنفس الاسم وآخر ٣ أرقام من الهوية. يرجى تعديل اسم أحدهما أولًا لمنع الالتباس.', 409);
  }

  const restored = must(await db.from('nafes_students').update({
    is_active: true,
    archived_at: null,
    updated_at: new Date().toISOString()
  }).eq('id', id).select().single());

  return { ok: true, id, student: restored, restored: true };
}

async function teacherStudentsBulkImport(db: any, b: Row) {
  const rawList = Array.isArray(b.students) ? b.students : [];
  if (!rawList.length) fail('قائمة الطلاب فارغة.');
  if (rawList.length > 500) fail('الحد الأقصى للإضافة الجماعية ٥٠٠ طالب في الدفعة الواحدة.');

  let added = 0, updated = 0, restored = 0, ignored = 0, failed = 0;
  const processed = [];
  const seenInBatch = new Set<string>();

  for (const item of rawList) {
    const fullName = tidy(item.full_name || item.student_name, 120);
    const last3 = normalizeLast3Digits(item.national_id_last3 || item.student_no);
    const grade = tidy(item.grade, 80) || 'الصف الثالث المتوسط';
    const className = tidy(item.class_name, 80);
    const normName = normalizeArabicName(fullName);

    // Strict backend validation
    if (fullName.length < 2 || !last3 || last3.length !== 3 || !/^\d{3}$/.test(last3)) {
      failed++;
      processed.push({ full_name: fullName, national_id_last3: last3, status: 'rejected', reason: 'بيانات غير صالحة' });
      continue;
    }

    const batchKey = `${last3}:${normName}`;
    if (seenInBatch.has(batchKey)) {
      ignored++;
      processed.push({ full_name: fullName, national_id_last3: last3, status: 'ignored', reason: 'مكرر في نفس الملف' });
      continue;
    }
    seenInBatch.add(batchKey);

    const existing = must(await db.from('nafes_students')
      .select('id, full_name, class_name, grade, is_active')
      .eq('national_id_last3', last3)
      .eq('name_normalized', normName)
      .maybeSingle());

    if (existing) {
      if (!existing.is_active) {
        const res = must(await db.from('nafes_students').update({
          full_name: fullName,
          name_normalized: normName,
          grade,
          class_name: className,
          is_active: true,
          archived_at: null,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id).select().single());
        restored++;
        processed.push({ ...res, status: 'restored' });
      } else {
        if (existing.class_name !== className || existing.grade !== grade) {
          const res = must(await db.from('nafes_students').update({
            grade,
            class_name: className,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id).select().single());
          updated++;
          processed.push({ ...res, status: 'updated' });
        } else {
          ignored++;
          processed.push({ ...existing, status: 'ignored' });
        }
      }
    } else {
      const res = must(await db.from('nafes_students').insert({
        full_name: fullName,
        name_normalized: normName,
        grade,
        class_name: className,
        national_id_last3: last3,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select().single());
      added++;
      processed.push({ ...res, status: 'added' });
    }
  }

  return { ok: true, added, updated, restored, ignored, failed, total: rawList.length, students: processed };
}

async function teacherStudentHardDelete(db: any, b: Row) {
  const id = b.id || b.student_id;
  if (!isUUID(id)) fail('معرّف الطالب غير صحيح.');
  const confirmWord = tidy(b.confirm_word);
  if (confirmWord !== 'حذف') fail('يجب كتابة كلمة «حذف» للتأكيد.');

  const rpcRes = await db.rpc('nafes_teacher_hard_delete_student', { p_student_id: id, p_confirm_word: confirmWord });
  if (rpcRes.error) {
    if (rpcRes.error.code === '42883' || rpcRes.error.message?.includes('42883') || rpcRes.error.message?.includes('function nafes_teacher_hard_delete_student')) {
      fail('تعذر تنفيذ العملية الآمنة لأن تحديث قاعدة البيانات المطلوب لم يُطبق بعد.', 500);
    }
    fail(rpcRes.error.message || 'فشلت عملية الحذف النهائي للطالب.');
  }
  return rpcRes.data;
}

async function teacherTestClearResults(db: any, b: Row, owner?: Row) {
  const testId = String(b.test_id || b.id || '').trim();
  if (!testId) fail('معرّف الاختبار مطلوب.');
  const confirmWord = tidy(b.confirm_word);
  if (confirmWord !== 'مسح النتائج') fail('يجب كتابة كلمة «مسح النتائج» للتأكيد.');

  const ownerId = owner?.id || null;
  if (isUUID(testId) && !ownerId) {
    fail('معرّف مالك الحساب مطلوب للتحقق من صلاحية الاختبار.', 401);
  }

  if (!isUUID(testId) && !testId.startsWith('simulation:') && !testId.startsWith('exam:')) {
    fail('معرّف الاختبار تالف أو غير صالح.');
  }
  if (testId.startsWith('exam:')) {
    if (!/^exam:(reading|math|science):[a-zA-Z0-9_]+:i[0-9]+:m[0-9]+$/.test(testId)) {
      fail('معرّف اختبار المؤشر تالف أو غير صالح.');
    }
    const parts = testId.split(':');
    if (parts.length !== 5 || !/^[0-9]+$/.test(parts[3].slice(1)) || !/^[0-9]+$/.test(parts[4].slice(1))) {
      fail('أرقام المؤشر أو النموذج غير صالحة.');
    }
  }
  if (testId.startsWith('simulation:') && !/^simulation:[a-z0-9_]+$/.test(testId)) {
    fail('معرّف اختبار المحاكاة تالف أو غير صالح.');
  }

  const rpcRes = await db.rpc('nafes_teacher_clear_test_results', {
    p_test_id: testId,
    p_confirm_word: confirmWord,
    p_owner_id: isUUID(testId) ? ownerId : null
  });

  if (rpcRes.error) {
    if (rpcRes.error.code === '42883' || rpcRes.error.message?.includes('42883') || rpcRes.error.message?.includes('function nafes_teacher_clear_test_results')) {
      fail('تعذر تنفيذ العملية الآمنة لأن تحديث قاعدة البيانات المطلوب لم يُطبق بعد.', 500);
    }
    fail(rpcRes.error.message || 'فشلت عملية مسح نتائج الاختبار.');
  }

  return rpcRes.data;
}

async function teacherTestDelete(db: any, b: Row, owner?: Row) {
  const testId = String(b.test_id || b.id || '').trim();
  if (!testId) fail('معرّف الاختبار مطلوب.');
  const confirmWord = tidy(b.confirm_word);
  if (confirmWord !== 'حذف') fail('يجب كتابة كلمة «حذف» للتأكيد.');

  if (testId.startsWith('exam:') || testId.startsWith('simulation:')) {
    fail('لا يمكن حذف هذا الاختبار نهائيًا لأنه يتبع بنك المؤشرات. يمكنك فقط مسح نتائجه.', 400);
  }

  if (!isUUID(testId)) fail('معرّف الاختبار غير صالح لحذف السجل.');

  const ownerId = owner?.id || null;
  if (!ownerId) fail('معرّف مالك الحساب مطلوب للتحقق من صلاحية حذف الاختبار.', 401);

  const rpcRes = await db.rpc('nafes_teacher_delete_published_test', {
    p_test_id: testId,
    p_confirm_word: confirmWord,
    p_owner_id: ownerId
  });

  if (rpcRes.error) {
    if (rpcRes.error.code === '42883' || rpcRes.error.message?.includes('42883') || rpcRes.error.message?.includes('function nafes_teacher_delete_published_test')) {
      fail('تعذر تنفيذ العملية الآمنة لأن تحديث قاعدة البيانات المطلوب لم يُطبق بعد.', 500);
    }
    fail(rpcRes.error.message || 'فشلت عملية حذف الاختبار.');
  }

  return rpcRes.data;
}

async function teacherTestsBulkClear(db: any, b: Row, owner?: Row) {
  const isClearAll = b.clear_all === true;
  const confirmWord = tidy(b.confirm_word);
  const ownerId = owner?.id || null;
  if (!ownerId) fail('معرّف مالك الحساب مطلوب لمسح النتائج.', 401);

  if (isClearAll) {
    if (confirmWord !== 'حذف جميع النتائج') {
      fail('يرجى تأكيد الحذف بكتابة «حذف جميع النتائج».');
    }
  } else {
    if (confirmWord !== 'مسح النتائج' && confirmWord !== 'حذف') {
      fail('يجب كتابة «مسح النتائج» أو «حذف» لتأكيد مسح نتائج الاختبارات المحددة.');
    }
  }

  const ids = Array.isArray(b.test_ids) ? b.test_ids : [];
  if (!isClearAll && !ids.length) fail('لم يتم تحديد أي اختبارات.');

  // Validate format of each ID upfront in Edge Function too:
  if (!isClearAll) {
    for (const tid of ids) {
      const s = String(tid || '').trim();
      if (!isUUID(s) && !s.startsWith('simulation:') && !s.startsWith('exam:')) {
        fail(`معرّف اختبار تالف أو غير صالح في المجموعة: ${s}`);
      }
      if (s.startsWith('exam:')) {
        if (!/^exam:(reading|math|science):[a-zA-Z0-9_]+:i[0-9]+:m[0-9]+$/.test(s)) {
          fail(`معرّف اختبار المؤشر تالف أو غير صالح البنية: ${s}`);
        }
        const parts = s.split(':');
        if (parts.length !== 5 || !/^[0-9]+$/.test(parts[3].slice(1)) || !/^[0-9]+$/.test(parts[4].slice(1))) {
          fail(`أرقام المؤشر أو النموذج غير صالحة في معرّف الاختبار: ${s}`);
        }
      }
      if (s.startsWith('simulation:')) {
        if (!/^simulation:[a-z0-9_]+$/.test(s)) {
          fail(`معرّف اختبار المحاكاة تالف أو غير صالح: ${s}`);
        }
      }
    }
  }

  // Single atomic PostgreSQL transaction via RPC
  const rpcRes = await db.rpc('nafes_teacher_bulk_clear_test_results', {
    p_test_ids: isClearAll ? null : ids,
    p_clear_all: isClearAll,
    p_confirm_word: confirmWord,
    p_owner_id: ownerId
  });

  if (rpcRes.error) {
    if (rpcRes.error.code === '42883' || rpcRes.error.message?.includes('42883') || rpcRes.error.message?.includes('function nafes_teacher_bulk_clear_test_results')) {
      fail('تعذر تنفيذ العملية الآمنة لأن تحديث قاعدة البيانات المطلوب لم يُطبق بعد.', 500);
    }
    fail(rpcRes.error.message || 'فشلت عملية مسح نتائج الاختبارات.');
  }

  return rpcRes.data;
}

async function teacher(db:any,req:Request) {const key=tidy(req.headers.get('x-teacher-key'),128);if(!/^[a-f0-9]{48,96}$/i.test(key))fail('أدخل مفتاح دخول المعلم لعرض النتائج وإعداد الاختبارات.',401);const row=must(await db.from('nafes_teacher_access').select('id,label').eq('key_hash',await hash(key)).eq('active',true).maybeSingle());if(!row)fail('مفتاح دخول المعلم غير صحيح.',401);return row;}
function testInfo(t:Row) {const c=t.config||{};return{id:t.kind==='legacy'?legacyTestId(t.legacy_target):t.id,title:t.title,kind:t.kind==='legacy'?'indicator':t.kind,simulation_mode:c.simulation_mode,bank_source:c.bank_source,subjects:(c.sections||[]).map((s:Row)=>s.subject),class_name:c.class_name||'',term:c.term||c.academic_term||'',academic_term:c.academic_term||c.term||'',school_name:c.school_name||'',teacher_name:c.teacher_name||'',principal_name:c.principal_name||'',grade_key:'middle_3',created_at:t.published_at||t.created_at,total:(c.sections||[]).reduce((n:number,s:Row)=>n+s.question_count,0),short_code:t.short_code};}
function legacyTestId(t:Row) {return`exam:${t.subject||t.subject_key}:${t.outcome||t.outcome_code}:i${t.indicator||t.indicator_index}:m${t.model||t.model_no}`;}

async function simulationCatalogCounts(db:any):Promise<Map<string,number>> {
  const simCounts=new Map<string,number>();
  try {
    const {data:rows,error}=await db.from('nafes_simulation_question_bank')
      .select('indicator_key')
      .eq('grade_key','middle_3')
      .eq('is_active',true)
      .eq('review_status','approved')
      .eq('semantic_similarity_cleared',true);
    if(!error&&rows){
      for(const r of rows){
        if(r.indicator_key){
          simCounts.set(r.indicator_key,(simCounts.get(r.indicator_key)||0)+1);
        }
      }
    }
  } catch(_) {}
  return simCounts;
}

async function catalog(db:any) {
  const counts=must(await db.rpc('nafes_teacher_catalog_counts'));
  const available=new Map<string,number>((counts||[]).map((x:Row)=>[x.key,x.available]));
  const simCounts=await simulationCatalogCounts(db);
  const simSummary={
    reading:[...simCounts.entries()].filter(([k])=>k.startsWith('reading:')).reduce((s,[,c])=>s+c,0),
    math:[...simCounts.entries()].filter(([k])=>k.startsWith('math:')).reduce((s,[,c])=>s+c,0),
    science:[...simCounts.entries()].filter(([k])=>k.startsWith('science:')).reduce((s,[,c])=>s+c,0)
  };
  const rows=must(await db.from('nafes_simulation_forms').select('subject,model_no,created_at'));
  const forms=SUBJECTS.flatMap(subject=>Array.from({length:60},(_,i)=>({subject,model_no:i+1,question_count:30,ready:rows.some((r:Row)=>r.subject===subject&&r.model_no===i+1)})));
  return{
    indicators:FRAMEWORK.map(i=>({...i,available:available.get(i.key)||0})),
    simulation_indicators:FRAMEWORK.map(i=>({...i,available:simCounts.get(i.key)||0})),
    simulation_summary:simSummary,
    forms,
    thresholds:THRESHOLDS
  };
}
async function findDraft(db:any,id:unknown,owner:Row) {if(!isUUID(id))fail('المسودة غير موجودة.');const t=must(await db.from('nafes_assessments').select('*').eq('id',id).eq('owner_id',owner.id).maybeSingle());if(!t)fail('المسودة غير موجودة.',404);if(t.status!=='draft')fail('نُشر الاختبار بالفعل؛ أنشئ نسخة جديدة لتغيير الأسئلة.',409);return t;}
function preview(t:Row) {return{draft_id:t.id,config:t.config,sections:t.rendered_sections};}
async function draftSections(db:any,c:Row,regenerate=false):Promise<Row[]> {
  const isSimulation=c.kind==='simulation'&&c.bank_source==='simulation_bank';
  const simulationMode=c.simulation_mode==='custom'?'custom':'standard';
  const sections:Row[]=[];
  const used=new Set<string>();
  const subNames:Record<string,string>={reading:'القراءة',math:'الرياضيات',science:'العلوم'};

  for(const s of c.sections){
    let pool:Row[]=[];
    let qs:Row[]=[];

    if(isSimulation){
      // STRICT: Pull EXCLUSIVELY from simulationPool (nafes_simulation_question_bank). ZERO fallback to nafes_question_bank.
      if(simulationMode==='custom'){
        const keys=s.indicators?.map((i:Row)=>i.key);
        pool=await simulationPool(db,s.subject,keys);
        for(const i of s.indicators||[]){
          const candidates=pool.filter(q=>q.indicator_key===i.key);
          const actual=new Set(candidates.map(questionKey)).size;
          if(actual<i.count){
            fail(`المؤشر «${i.text}»: المطلوب ${i.count} سؤالًا، والمتاح ${actual} فقط في بنك المحاكاة المستقل. لن يتكرر أي سؤال.`);
          }
          qs.push(...selectUnique(candidates,i.count,token(8),new Map(),used));
        }
      } else {
        // Standard Comprehensive Simulation (محاكاة شاملة)
        pool=await simulationPool(db,s.subject);
        const actual=new Set(pool.map(questionKey)).size;
        if(actual===0){
          fail(`لا توجد حاليًا أسئلة محاكاة معتمدة لمادة «${subNames[s.subject]||s.subject}» في بنك المحاكاة المستقل.`);
        }
        if(actual<s.question_count){
          fail(`مادة «${subNames[s.subject]||s.subject}»: المطلوب ${s.question_count} سؤالًا، والمتاح في بنك المحاكاة المستقل ${actual} فقط.`);
        }
        qs=selectUnique(pool,s.question_count,token(8),new Map(),used);
      }
    } else {
      // Legacy indicator tests (indicator / multi_indicator / legacy) - untouched, uses fullPool
      pool=await fullPool(db,s.subject,s.indicators?.map((i:Row)=>i.key));
      for(const i of s.indicators){
        let candidates=pool.filter(q=>q.indicator_key===i.key);
        if(s.fixed_model)candidates=candidates.filter(q=>q.model_no===s.fixed_model);
        const actual=new Set(candidates.map(questionKey)).size;
        if(actual<i.count)fail(`المؤشر «${i.text}»: المطلوب ${i.count} سؤالًا، والمتاح ${actual} فقط. لن يتكرر أي سؤال.`);
        qs.push(...s.fixed_model?candidates.sort((a,b)=>a.question_no-b.question_no):selectUnique(candidates,i.count,token(8),new Map(),used));
      }
    }

    for(const q of qs){
      const k=questionKey(q);
      if(used.has(k))fail('يوجد سؤال مكرر بين المؤشرات المختارة؛ قلل العدد أو بدّل أحد المؤشرات.');
      used.add(k);
    }
    sections.push({...s,questions:qs});
  }
  return sections;
}
async function codeFor(db:any) {for(let n=0;n<6;n++){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=[...crypto.getRandomValues(new Uint8Array(8))].map(x=>chars[x%chars.length]).join('');const r=must(await db.from('nafes_assessments').select('id').eq('short_code',code).maybeSingle());if(!r)return code;}fail('تعذر إنشاء رمز الاختبار؛ أعد المحاولة.');}
async function assessment(db:any,code:unknown) {if(!/^[A-Z2-9]{8}$/.test(String(code||'')))fail('رمز الاختبار غير صالح.',404);const t=must(await db.from('nafes_assessments').select('*').eq('short_code',code).eq('status','published').maybeSingle());if(!t)fail('رابط الاختبار غير موجود.',404);return t;}
function studentInfo(t:Row) {const c=t.config;return{id:t.id,code:t.short_code,title:t.title,kind:t.kind,class_name:c.class_name,term:c.term||c.academic_term||'',academic_term:c.academic_term||c.term||'',school_name:c.school_name,teacher_name:c.teacher_name,grade_key:'middle_3',identity_mode:c.identity_mode,settings:c.settings,sections:(c.sections||[]).map((s:Row)=>({subject:s.subject,question_count:s.question_count,duration_minutes:s.duration_minutes,calculator:s.calculator})),ready:true,...(t.kind==='legacy'?{legacy_url:new URL(`exam.html?s=${t.legacy_target.subject}&o=${t.legacy_target.outcome}&i=${t.legacy_target.indicator}&m=${t.legacy_target.model}`,BASE).href}:{})};}
const snapshotKey=(q:Row)=>JSON.stringify([q.id,q.context||null,q.question,q.options,q.correctIndex,q.explanation||null,q.indicator_key,q.indicator_text,q.cognitive_level,q.difficulty,q.model_no,q.question_no,q.image?.url||null,q.image?.alt||null]);
const flat=(a:Row)=>(a.rendered_sections||[]).flatMap((s:Row)=>s.questions||[]);
async function finish(db:any,a:Row,answers=a.answers) {if(a.submitted_at)return a;const result=gradeSections(a.rendered_sections,answers);const end=new Date(Math.min(Date.now(),new Date(a.expires_at).getTime())).toISOString();const r=must(await db.from('nafes_assessment_attempts').update({answers,...result,submitted_at:end,version:a.version+1}).eq('id',a.id).eq('version',a.version).is('submitted_at',null).select().maybeSingle());return r||must(await db.from('nafes_assessment_attempts').select('*').eq('id',a.id).single());}
function attemptResponse(a:Row) {const c=a.config,s=c.settings;const response:Row={attempt_id:a.id,submitted:!!a.submitted_at,expires_at:a.expires_at,started_at:a.started_at,section_started_at:a.section_started_at,current_section:a.section_index,cursor:a.cursor,version:a.version,answers:a.answers,sections:publicSections(a.rendered_sections),settings:s,student_name:a.student_name};if(a.submitted_at){if(s.show_result)Object.assign(response,{score:a.score,total:a.total,percent:a.percent,section_scores:a.section_scores});else response.result_hidden=true;if(s.show_correct_count)response.correct_count=a.score;if(s.show_indicator_result){const groups=new Map<string,Row[]>();for(const q of flat(a)){const key=indicatorOf(q),g=groups.get(key)||[];g.push(q);groups.set(key,g);}response.indicators=[...groups].map(([key,qs])=>({key,text:qs[0].indicator_text,...gradeSections([{subject:qs[0].subject,questions:qs}],a.answers)}));}if(s.show_answers)response.review=flat(a).map(q=>({id:q.id,correct_index:q.correctIndex,explanation:q.explanation,indicator_text:q.indicator_text}));}return response;}
async function saveState(db:any,a:Row,body:Row) {
 if(a.submitted_at)return a;const now=Date.now();if(now>=new Date(a.expires_at).getTime())return await finish(db,a);
 const s=a.config.settings;let index=a.section_index,cursor=a.cursor,sectionStarted=a.section_started_at;const section=a.rendered_sections[index],deadline=new Date(sectionStarted).getTime()+section.duration_minutes*60000;
 const raw=cleanAnswers(flat(a),body.answers),answers={...a.answers};
 if(now>=new Date(sectionStarted).getTime()&&now<=deadline){for(let i=0;i<section.questions.length;i++){const q=section.questions[i];if(s.allow_back||i===cursor){if(Object.hasOwn(raw,q.id))answers[q.id]=raw[q.id];}}
  const requested=Number(body.cursor);if(Number.isInteger(requested)&&requested>=0&&requested<section.questions.length&&(s.allow_back||requested===cursor||requested===cursor+1))cursor=requested;
 }
 const advance=body.action==='assessment_advance'||now>deadline;
 if(advance){if(index===a.rendered_sections.length-1)return await finish(db,a,answers);index++;cursor=0;sectionStarted=new Date(Math.min(now,deadline)+s.break_minutes*60000).toISOString();}
 let events=a.events||[];if(s.log_visibility&&['hidden','visible','page_leave','copy_blocked','print_blocked'].includes(body.event?.type)&&events.length<2000)events=[...events,{type:body.event.type,at:new Date().toISOString(),section:index}];
 if(body.action==='assessment_finish')return await finish(db,a,answers);
 const update={answers,cursor,section_index:index,section_started_at:sectionStarted,events,lease_until:new Date(now+45000).toISOString(),version:a.version+1};
 const row=must(await db.from('nafes_assessment_attempts').update(update).eq('id',a.id).eq('version',a.version).is('submitted_at',null).select().maybeSingle());if(!row)fail('تغيرت المحاولة أثناء الحفظ؛ أعد المحاولة.',409);return row;
}
async function studentAction(db:any,body:Row) {
 if(body.action==='assessment_info')return studentInfo(await assessment(db,body.code));
 if(body.action==='assessment_start'){
   const t=await assessment(db,body.code);if(t.kind==='legacy')return studentInfo(t);const c=t.config,s=c.settings,now=Date.now();
   if(s.opens_at&&now<new Date(s.opens_at).getTime())fail('لم يبدأ وقت إتاحة الاختبار بعد.',403);
   if(s.closes_at&&now>new Date(s.closes_at).getTime())fail('انتهى وقت إتاحة الاختبار.',403);
   const session=tidy(body.session_id,96);if(!session)fail('بيانات الجلسة غير مكتملة.');
   const student=await verifyStudentIdentity(db, String(body.student_name || ''), String(body.student_no || body.national_id_last3 || ''), String(body.class_name || ''));
   const name=student.full_name, no=student.national_id_last3, student_id=student.id, student_key=student.id;
   const className=student.class_name || c.class_name || tidy(body.class_name,80);
   if(c.identity_mode==='list'&&!c.roster.some((n:string)=>normalizeArabicName(n)===normalizeArabicName(name)))fail('اكتب اسمك كما هو في كشف الفصل.',403);
   const previous=must(await db.from('nafes_assessment_attempts').select('*').eq('assessment_id',t.id).eq('student_key',student_key).order('attempt_no',{ascending:false}));
   for(const a of previous)if(!a.submitted_at&&now>=new Date(a.expires_at).getTime())Object.assign(a,await finish(db,a));
   let active=previous.find((a:Row)=>!a.submitted_at);const access=token();
   if(active){if(s.lock_session&&active.session_id!==session&&now<new Date(active.lease_until).getTime())fail('المحاولة مفتوحة في جهاز أو تبويب آخر. أغلقها هناك وانتظر ٤٥ ثانية لإكمالها هنا.',409);
    active=must(await db.from('nafes_assessment_attempts').update({session_id:session,access_hash:await hash(access),lease_until:new Date(now+45000).toISOString(),version:active.version+1}).eq('id',active.id).eq('version',active.version).is('submitted_at',null).select().maybeSingle());if(!active)fail('فُتحت المحاولة في تبويب آخر؛ أعد المحاولة.',409);return{...attemptResponse(active),access_token:access,resumed:true};}
   if(previous.length>=s.attempts){if(previous[0])return{...attemptResponse(previous[0]),attempts_exhausted:true};fail('استُنفد عدد المحاولات المسموح به.',409);}
   const seed=token(12);const rand=randomFrom(seed);const sections=t.rendered_sections.map((section:Row)=>({...section,questions:(s.shuffle_questions?shuffle(section.questions,rand):section.questions).map((q:Row)=>s.shuffle_options?permuteQuestion(q,rand):q)}));
   const duration=c.sections.reduce((n:number,sec:Row)=>n+sec.duration_minutes,0)+s.break_minutes*(sections.length-1);const expires=new Date(Math.min(now+duration*60000,s.closes_at?new Date(s.closes_at).getTime():Infinity)).toISOString();
   const r=await db.from('nafes_assessment_attempts').insert({assessment_id:t.id,student_id,student_name:name,student_no:no,student_key,class_name:className,attempt_no:previous.length+1,config:c,rendered_sections:sections,session_id:session,access_hash:await hash(access),lease_until:new Date(now+45000).toISOString(),expires_at:expires}).select().single();if(r.error?.code==='23505')fail('بدأت محاولة لهذا الطالب؛ أعد فتحها من التبويب الأصلي.',409);const created=must(r);return{...attemptResponse(created),access_token:access,resumed:false};
 }
 if(!isUUID(body.attempt_id)||!body.access_token)fail('تعذر التحقق من المحاولة.',403);let a=must(await db.from('nafes_assessment_attempts').select('*').eq('id',body.attempt_id).eq('access_hash',await hash(String(body.access_token))).maybeSingle());if(!a)fail('تعذر التحقق من المحاولة.',403);
 if(!a.submitted_at&&a.config.settings.lock_session&&a.session_id!==body.session_id)fail('المحاولة قيد الاستخدام في تبويب آخر.',409);
 if(!['assessment_save','assessment_finish','assessment_advance','assessment_resume','assessment_event'].includes(body.action))fail('إجراء غير معروف.');
 if(body.action==='assessment_resume'&&!a.submitted_at&&Date.now()<new Date(a.expires_at).getTime())return attemptResponse(a);
 a=await saveState(db,a,body);return{ok:true,...attemptResponse(a)};
}
const SOURCES:Row={exam:'nafes_exam_attempts',simulation:'nafes_simulation_attempts',assessment:'nafes_assessment_attempts'};
const READING_FOCUS=['vocab_context','vocab_definition','vocab_classify','vocab_distinguish','vocab_use','main_structure','implicit_questions','compare_texts','fact_opinion','relationships','emotion_language','credibility_solutions','values_impact','arguments_evidence','summary_organize','problem_solving'];
async function metadata(db:any,rows:Row[],source:string) {
  for(const a of rows)for(const q of (source==='exam'?(a.rendered_questions||[]):flat(a)))q.question_fingerprint=await hash(questionKey(q));
  const map=new Map<string,Row>();
  if(source==='assessment'||source==='exam')return map;
  // For legacy simulation attempts (nafes_simulation_attempts) only:
  // Exclude any questions belonging to simulation_bank
  const ids=[...new Set(rows.flatMap(a=>flat(a)).filter(q=>q.bank_source!=='simulation_bank').map(q=>q.id).filter(isUUID))];
  for(let i=0;i<ids.length;i+=150){
    const data=must(await db.from('nafes_question_bank').select('id,subject_key,outcome_code,indicator_index,indicator_text').in('id',ids.slice(i,i+150)));
    for(const q of data||[])map.set(q.id,q);
  }
  return map;
}
function canonical(a:Row,source:string,map:Map<string,Row>,test?:Row):Row {
 const c=a.config||{};const sections=source==='exam'?[{subject:a.subject_key,questions:a.rendered_questions||[]}]:a.rendered_sections||[];
 let warning='';const qs=sections.flatMap((sec:Row)=>sec.questions.map((q:Row)=>{
  const m=map.get(q.id);let key=q.indicator_key;if(!key&&source==='exam')key=`${a.subject_key}:${a.outcome_code}:i${a.indicator_index}`;
  if(!key&&m)key=`${m.subject_key}:${m.outcome_code}:i${m.indicator_index}`;
  if(!key&&q.measurement_focus){const f=FRAMEWORK.find(i=>i.key===q.measurement_focus);if(f)key=f.key;else if(sec.subject==='reading'){const pos=READING_FOCUS.indexOf(q.measurement_focus);if(pos>=0)key=FRAMEWORK.filter(i=>i.subject==='reading')[pos]?.key;}}
  const indicator=FRAMEWORK.find(i=>i.key===key);const correct_index=Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<q.options?.length?q.correctIndex:null;const answer=Number.isInteger(a.answers?.[q.id])&&a.answers[q.id]>=0&&a.answers[q.id]<q.options?.length?a.answers[q.id]:null;
  if(correct_index===null)warning='تحتوي الورقة التاريخية على مفتاح إجابة غير صالح؛ حُفظت الدرجة الأصلية، ولا تدخل هذه المحاولة في تقدير المستوى أو التحسن.';
  return{id:q.id,question:q.question,question_fingerprint:q.question_fingerprint,subject:sec.subject,indicator_key:key||null,indicator_text:q.indicator_text||indicator?.text||m?.indicator_text||'لم يُحفظ ارتباط هذا السؤال بمؤشر',answer,correct:correct_index===null?null:answer===correct_index,scorable:correct_index!==null,correct_index};
 }));
 const id=source==='exam'?legacyTestId(a):source==='simulation'?`simulation:${a.simulation_key}`:a.assessment_id;
const submitted=!!a.submitted_at;const levelTotal=a.total||qs.length;return{id:a.id,source,test_id:id,title:test?.title||c.title||(source==='exam'?`اختبار مؤشر ${a.indicator_index} — النموذج ${a.model_no}`:'اختبار نافس'),kind:source==='exam'?'indicator':source==='simulation'?'simulation':c.kind,subjects:[...new Set(sections.map((s:Row)=>s.subject))],student_id:a.student_id||(isUUID(a.student_key)?a.student_key:null),student_key:a.student_key,student_name:a.student_name,student_no:a.student_no,class_name:a.class_name||c.class_name||'',school_name:a.school_name||'',teacher_name:a.teacher_name||'',principal_name:a.principal_name||'',grade_key:'middle_3',started_at:a.started_at,submitted_at:a.submitted_at,expires_at:a.expires_at,elapsed_seconds:submitted?Math.max(0,Math.round((Math.min(new Date(a.submitted_at).getTime(),new Date(a.expires_at).getTime())-new Date(a.started_at).getTime())/1000)):null,status:submitted?'submitted':Date.now()>new Date(a.expires_at).getTime()?'expired':'in_progress',score:submitted?a.score:null,total:levelTotal,percent:submitted?a.percent:null,questions:qs,events:a.events||[],...(warning?{snapshot_warning:warning}:{})};
}
async function teacherData(db:any,b:Row) {
 const limit=Math.min(100,Math.max(1,Math.trunc(Number(b.limit)||100))),cursor=Math.max(0,Math.trunc(Number(b.cursor)||0));
 const page=must(await db.rpc('nafes_teacher_attempt_page',{p_cursor:cursor,p_limit:limit}));const attempts:Row[]=[];const offset=page.total;for(const source of Object.keys(SOURCES)){const rows=page.rows.filter((x:Row)=>x.source===source).map((x:Row)=>x.row);if(!rows.length)continue;const map=await metadata(db,rows,source);attempts.push(...rows.map((a:Row)=>canonical(a,source,map)));}
 let tests:Row[]=[];if(cursor===0){const published=must(await db.from('nafes_assessments').select('id,title,kind,status,config,short_code,created_at,published_at,legacy_target').eq('status','published'));tests=published.map(testInfo);const known=new Set(tests.map(t=>t.id));for(const i of FRAMEWORK)for(let model=1;model<=2;model++){const id=legacyTestId({...i,model});if(!known.has(id))tests.push({id,title:`${i.subject==='reading'?'القراءة':i.subject==='math'?'الرياضيات':'العلوم'} — ${i.text} — النموذج ${model}`,kind:'indicator',subjects:[i.subject],class_name:'',grade_key:'middle_3',total:15});}
 const sims=must(await db.from('nafes_simulation_attempts').select('simulation_key,config,started_at').order('started_at'));for(const a of sims){const id=`simulation:${a.simulation_key}`;if(known.has(id))continue;known.add(id);tests.push({...testInfo({id,title:a.config.title,kind:'simulation',config:a.config,created_at:a.started_at}),id});}}
 return{attempts,tests,indicators:cursor===0?FRAMEWORK:[],thresholds:THRESHOLDS,next_cursor:cursor+limit<offset?cursor+limit:null};
}
export async function handleAssessments(db:any,req:Request,b:Row):Promise<Row> {
 if(String(b.action).startsWith('assessment_'))return await studentAction(db,b);
 const owner=await teacher(db,req);
 if(b.action==='teacher_students_list')return await teacherStudentsList(db);
 if(b.action==='teacher_student_add')return await teacherStudentAdd(db,b);
 if(b.action==='teacher_student_update')return await teacherStudentUpdate(db,b);
 if(b.action==='teacher_student_delete')return await teacherStudentDelete(db,b);
 if(b.action==='teacher_student_restore')return await teacherStudentRestore(db,b);
 if(b.action==='teacher_students_bulk_import')return await teacherStudentsBulkImport(db,b);
 if(b.action==='teacher_student_hard_delete')return await teacherStudentHardDelete(db,b);
 if(b.action==='teacher_test_clear_results')return await teacherTestClearResults(db,b,owner);
 if(b.action==='teacher_test_delete')return await teacherTestDelete(db,b,owner);
 if(b.action==='teacher_tests_bulk_clear')return await teacherTestsBulkClear(db,b,owner);
 if(b.action==='teacher_data')return await teacherData(db,b);
 if(b.action==='teacher_paper') {if(!SOURCES[b.source]||!isUUID(b.attempt_id))fail('المحاولة غير موجودة.',404);const a=must(await db.from(SOURCES[b.source]).select('*').eq('id',b.attempt_id).maybeSingle());if(!a)fail('المحاولة غير موجودة.',404);const map=await metadata(db,[a],b.source),attempt=canonical(a,b.source,map);const ss=b.source==='exam'?[{subject:a.subject_key,questions:a.rendered_questions||[]}]:a.rendered_sections;let n=0;const sections=ss.map((s:Row)=>({...s,questions:s.questions.map((q:Row)=>{const summary=attempt.questions[n++];return{...q,...summary,correctIndex:summary.correct_index};})}));return{attempt,sections,settings:a.config?.settings||{}};}
 if(b.action==='teacher_catalog')return{...await catalog(db),tests:must(await db.from('nafes_assessments').select('id,title,kind,config,short_code,created_at,published_at,legacy_target').eq('status','published')).map(testInfo)};
 if(b.action==='teacher_preview') {const config=normalizeConfig(b.config),sections=await draftSections(db,config,b.regenerate===true);const draft=must(await db.from('nafes_assessments').insert({owner_id:owner.id,kind:config.kind,title:config.title,config,rendered_sections:sections}).select().single());return preview(draft);}
 if(b.action==='teacher_replace') {
  const t=await findDraft(db,b.draft_id,owner);
  const isSim=t.kind==='simulation'&&t.config?.bank_source==='simulation_bank';
  const sections=t.rendered_sections;
  const all=sections.flatMap((s:Row)=>s.questions),old=all.find((q:Row)=>q.id===b.question_id);
  if(!old)fail('السؤال غير موجود في المسودة.');
  const pool=isSim
    ?(await simulationPool(db,old.subject,[old.indicator_key])).filter(q=>q.indicator_key===old.indicator_key)
    :(await fullPool(db,old.subject,[old.indicator_key])).filter(q=>q.indicator_key===old.indicator_key);
  const candidates=pool.filter(q=>!all.some((x:Row)=>questionKey(x)===questionKey(q)));
  if(!candidates.length)fail('لا يوجد سؤال بديل مستقل متاح لهذا المؤشر في بنك المحاكاة المستقل.');
  const replacement=selectUnique(candidates,1,token(8))[0];
  for(const s of sections)s.questions=s.questions.map((q:Row)=>q.id===old.id?replacement:q);
  return preview(must(await db.from('nafes_assessments').update({rendered_sections:sections}).eq('id',t.id).eq('status','draft').select().single()));
 }
 if(b.action==='teacher_publish') {
  const t=await findDraft(db,b.draft_id,owner);
  const isSim=t.kind==='simulation'&&t.config?.bank_source==='simulation_bank';
  for(const section of t.rendered_sections){
    const qIds=section.questions.map((q:Row)=>q.id);
    const pool=isSim
      ?await simulationPool(db,section.subject,undefined,qIds)
      :await fullPool(db,section.subject,undefined,qIds);
    const current=new Map(pool.map(q=>[q.id,q]));
    if(section.questions.some((q:Row)=>!current.has(q.id)||snapshotKey(current.get(q.id)!)!==snapshotKey(q)))fail('تغير البنك بعد المعاينة؛ أعد تكوين المسودة قبل نشرها.',409);
  }
  const short_code=await codeFor(db);
  const saved=must(await db.from('nafes_assessments').update({status:'published',short_code,published_at:new Date().toISOString()}).eq('id',t.id).eq('status','draft').select().single());
  return{id:saved.id,short_code,url:`${BASE}e.html?t=${short_code}`,title:saved.title};
 }
 if(b.action==='teacher_shorten_legacy') {const i=FRAMEWORK.find(i=>i.subject===b.subject&&i.outcome===b.outcome&&i.indicator===Number(b.indicator));if(!i||![1,2].includes(Number(b.model)))fail('الاختبار غير موجود.');const target={subject:i.subject,outcome:i.outcome,indicator:i.indicator,model:Number(b.model)};const pool=(await fullPool(db,i.subject,[i.key])).filter(q=>q.indicator_key===i.key&&q.model_no===target.model);if(pool.length!==15)fail('الاختبار لم يكتمل اعتماده؛ لا يمكن إنشاء باركود له.',409);const previous=must(await db.from('nafes_assessments').select('*').eq('kind','legacy').eq('status','published').contains('legacy_target',target).limit(1));let t=previous?.[0];if(!t){const code=await codeFor(db);t=must(await db.from('nafes_assessments').insert({owner_id:owner.id,short_code:code,status:'published',kind:'legacy',title:`${i.text} — النموذج ${target.model}`,config:{sections:[{subject:i.subject,question_count:15,duration_minutes:20}],settings:{},identity_mode:'manual'},legacy_target:target,published_at:new Date().toISOString()}).select().single());}return{id:t.id,short_code:t.short_code,url:`${BASE}e.html?t=${t.short_code}`,title:t.title};}
 if(b.action==='teacher_build_forms') {if(!SUBJECTS.includes(b.subject))fail('المادة غير صحيحة.');const pool=await fullPool(db,b.subject),expected=FRAMEWORK.filter(i=>i.subject===b.subject).length*30;if(pool.length!==expected)fail(`لم يكتمل البنك المراجع للمادة: ${pool.length} من ${expected}.`,409);const bank_hash=await hash(JSON.stringify(pool));const forms=buildForms(pool,b.subject);for(const f of forms){f.signature=await hash(f.signature);f.bank_hash=bank_hash;}const result=must(await db.rpc('replace_nafes_simulation_forms',{payload:forms}));return{ok:true,subject:b.subject,forms:60,question_slots:1800,unique_questions:new Set(forms.flatMap(f=>f.questions.map((q:Row)=>q.id))).size,result};}
 fail('إجراء غير معروف.');
}
