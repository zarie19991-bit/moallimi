---
name: SQL source completeness
description: Validate dependency closure before claiming original-schema SQL tests are runnable.
---

# صلاحيات التنفيذ في الاختبارات المحلية

اختبار الدوال بمالك PostgreSQL قد يخفي صلاحيات الجداول اللازمة للدوال ذات `SECURITY INVOKER`. تصدير أجسام الدوال والجداول لا يثبت اكتمال ACL.

**Why:** نجح المسار بمالك البيئة المحلية، ثم فشل بدور الخدمة لغياب ACL من التصدير. هذا نقص تركيب الاختبار، وليس دليلًا على عطل صلاحيات الإنتاج.

**How to apply:** اختبر مسار Edge والحفظ بدور الخدمة أيضًا؛ إن احتاجت نسخة التطوير منحًا صريحة فسمّها إصلاحات تطويرية، ولا تنسبها إلى تعريفات الإنتاج أو تمنح الأدوار العامة صلاحيات لتجاوز الفشل.

في التصدير الأصلي، ACL خام بقيمة NULL لا يعني غياب الصلاحيات؛ يجب تفسير الصلاحيات الافتراضية المناسبة لنوع الكائن أيضًا.

**Why:** قد تشمل صلاحيات الوظائف الافتراضية EXECUTE للدور PUBLIC؛ تجاهلها يغيّر التفويض الذي يفترض أن الاختبار يطابقه.

**How to apply:** استعد الصلاحيات الفعلية مع مالك الكائن والمنح الصريحة، وميّز بين NULL وبين ACL فارغ أو REVOKE صريح.

## وجود مكونات الإنتاج مقابل توافر تعريفاتها

أكد صاحب المشروع وجود جداول الحذف والاختبارات والطلاب ووظيفتي مزامنة المحاولات في الإنتاج بعد تحقق للقراءة فقط. لا تصف تعذر اختبارها محليًا بأنه غياب المكونات من الإنتاج.

**Why:** صاحب المشروع ميّز صراحة بين وجود المكونات في Supabase وبين نقص تعريفاتها الأصلية محليًا.

**How to apply:** اعرض العائق باعتباره نقص مصدر المخطط وتبعياته؛ لا تستبدل التعريفات المنشورة الأحدث بترحيلات GitHub التاريخية دون إثبات مطابقتها.

An empty missing-requested-tables list proves only that the requested roots were
exported, not that their schema can be imported. Follow foreign-key parents and
inspect trigger/function bodies for procedural callees; catalog dependency lists
alone are not a complete account of PL/pgSQL body dependencies.

For partial exports, establish closure for the requested workflow separately
from downstream grade-publishing or administrative-rollback workflows. A closed
core can be tested honestly without fabricating the downstream schema, but its
success must not be presented as deployment readiness for the whole platform.

**Why:** The initial owner-provided metadata contained all requested roots but
omitted a reviewer parent table required by scan foreign keys, plus helpers for
attempt triggers. Treating the root list as complete would require fabricated
dependencies or disabling original integrity checks.

**How to apply:** Audit closure before local SQL execution. Keep prerequisites
blocked rather than passed or business-logic failures. Distinguish dependencies
of standalone scan RPC tests from those needed for the broader grade-attempt path.

## وصف الأعمدة المولّدة والهوية

لا تستنتج نوع العمود من حقل default وحده في حزمة metadata مبسّطة؛ يلزم وصف generated/identity والتسلسل الأصلي.

**Why:** بعض المصادر المرفقة فقدت وصف توليد الأعمدة، فأصبح تعبير يعتمد على أعمدة أخرى ممثلًا كـDEFAULT غير صالح، وأصبح رقم تدقيق إلزامي بلا مصدر توليد. هذه أخطاء تمثيل المصدر المحلي وليست دليلًا على فساد مخطط الإنتاج.

**How to apply:** عند هذه الأخطاء، ارجع إلى خصائص الكتالوج الأصلية؛ لا تحوّل التعبير إلى generated أو تضف identity/sequence بالتخمين لمجرد تمرير الاختبار.

## خصوصية الحزم المرجعية

يطلب صاحب المشروع عدم رفع حزم تعريفات الإنتاج المفكوكة إلى مستودع عام.

**Why:** الحزمة الأصلية مسلّمة مشفّرة للاختبار المحلي فقط.

**How to apply:** أبقِ المصدر المفكوك خارج شجرة المستودع في مجلد مؤقت خاص؛ احفظ في المشروع أدوات الاختبار والنتائج المنقحة فقط، ولا تضمّن كلمة الفتح أو أجسام المصدر الخاص في حزم المراجعة.
