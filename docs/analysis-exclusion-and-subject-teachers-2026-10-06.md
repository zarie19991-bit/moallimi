# استبعاد الطلاب من التحليل وربط المواد بالمعلمين

تاريخ التنفيذ: 2026-10-06

## قواعد الأهلية للتحليل

يدخل السجل في التحليل فقط عندما:
- المحاولة ليست تجريبية (`is_demo = false`).
- الطالب المرتبط ليس تجريبيًا.
- الطالب المرتبط لا يحمل `exclude_from_analysis = true`.

الطالب التجريبي مستبعد دائمًا. الاستبعاد اليدوي لا يحذف المحاولات ولا يؤرشف الطالب؛ بل يمنع إدخاله في التحليل والتقارير مع بقاء البيانات الأصلية محفوظة.

## الحقول والجداول

أضيف إلى `nafes_students`:
- `exclude_from_analysis`
- `analysis_exclusion_reason`
- `analysis_exclusion_source`
- `analysis_exclusion_changed_at`
- `analysis_exclusion_changed_by`

سجل التدقيق:
- `nafes_analysis_exclusion_audit`

ربط المواد بالمعلمين:
- `nafes_subject_teacher`
- العرض الحالي: `nafes_subject_teacher_current`

يدعم جدول الربط أكثر من معلم للمادة، مع `is_primary` لتحديد المعلم الأساسي و`allocation_percent` لوصف نسبة الإسناد عند التدريس المشترك.

## الربط الحالي

- القراءة: زرعي شبير — معلم أساسي — 100%
- الرياضيات: عبدالله العماري — معلم أساسي — 100%
- العلوم: مليدان بالحارث — معلم أساسي — 100%

تقرأ التقارير هذا الربط من قاعدة البيانات. الأسماء الموجودة في JavaScript أصبحت قيمًا احتياطية فقط عند تعذر الخدمة.

## الفلترة المبكرة

الدالة `nafes_teacher_attempt_page` تطبق `nafes_analysis_student_allowed` قبل إرجاع محاولات:
- `nafes_exam_attempts`
- `nafes_simulation_attempts`
- `nafes_assessment_attempts`

قائمة الطلاب المستخدمة في التحليل تطلب `analysis_only=true` من `nafes-students-lite`، ولذلك لا يدخل الطالب المستبعد في قوائم الغياب أو أعداد الطلاب المقاسين.

## الإدارة

من شاشة إدارة الطلاب:
- تظهر حالة الطالب: مشمول / مستبعد.
- يمكن استبعاد طالب أو إعادة تضمينه دون حذف بياناته.
- يمكن كتابة سبب الاستبعاد.
- يوجد سجل تدقيق لأحدث التغييرات.
- يوجد استيراد جماعي Excel/CSV بالأعمدة:
  - معرف الطالب
  - استبعاد من التحليل
  - سبب الاستبعاد
- يمكن تنزيل قالب Excel يحتوي معرفات الطلاب الحالية وحالاتهم.

القيم المقبولة للاستبعاد تشمل: نعم/لا، true/false، 1/0، مستبعد/مشمول.

## اختبارات القبول المنفذة

1. طالب عادي غير مستبعد => مسموح للتحليل.
2. طالب تجريبي => غير مسموح للتحليل.
3. تحويل طالب حقيقي إلى `exclude_from_analysis=true` => غير مسموح للتحليل فورًا.
4. تغيير الاستبعاد يولد حدث تدقيق.
5. عينة من 100 سجل من مسار `nafes_teacher_attempt_page` أعادت:
   - 0 محاولات تجريبية.
   - 0 طلاب تجريبيين.
   - 0 طلاب مستبعدين يدويًا.
6. ربط المواد الحالي يعيد معلمًا أساسيًا لكل مادة.
7. ملفات JavaScript المعدلة اجتازت فحص الصياغة.
8. Supabase Security/Performance Advisors لا يعرضان ملاحظات تخص الجداول أو المفاتيح الأجنبية الجديدة.

## التراجع

نفذ التراجع فقط إذا تقرر إزالة الميزة بالكامل، وليس لإعادة طالب واحد للتحليل. لإعادة طالب فردي استخدم واجهة «تضمين في التحليل».

ترتيب التراجع الآمن:

1. إعادة نسخة الواجهة السابقة من Git.
2. إعادة نشر Edge Functions من النسخة السابقة.
3. إعادة `nafes_teacher_attempt_page` لتعريفها السابق قبل حذف الدالة المساعدة.
4. حذف الكائنات الجديدة بعد التأكد من عدم الحاجة لسجل التدقيق:

```sql
drop view if exists public.nafes_subject_teacher_current;
drop table if exists public.nafes_subject_teacher;
drop trigger if exists trg_nafes_student_analysis_exclusion_audit on public.nafes_students;
drop function if exists public.nafes_log_student_analysis_exclusion();
drop table if exists public.nafes_analysis_exclusion_audit;
drop function if exists public.nafes_analysis_student_allowed(uuid,text,boolean);

alter table public.nafes_students
  drop column if exists analysis_exclusion_changed_by,
  drop column if exists analysis_exclusion_changed_at,
  drop column if exists analysis_exclusion_source,
  drop column if exists analysis_exclusion_reason,
  drop column if exists exclude_from_analysis;
```

لا تنفذ أوامر الحذف أعلاه قبل استعادة تعريف `nafes_teacher_attempt_page` السابق، لأنه يعتمد على `nafes_analysis_student_allowed`.
