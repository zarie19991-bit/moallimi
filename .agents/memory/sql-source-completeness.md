---
name: SQL source completeness
description: Validate dependency closure before claiming original-schema SQL tests are runnable.
---

# صلاحيات التنفيذ في الاختبارات المحلية

اختبار الدوال بمالك PostgreSQL قد يخفي صلاحيات الجداول اللازمة للدوال ذات `SECURITY INVOKER`. تصدير أجسام الدوال والجداول لا يثبت اكتمال ACL.

**Why:** نجح المسار بمالك البيئة المحلية، ثم فشل بدور الخدمة لغياب ACL من التصدير. هذا نقص تركيب الاختبار، وليس دليلًا على عطل صلاحيات الإنتاج.

**How to apply:** اختبر مسار Edge والحفظ بدور الخدمة أيضًا؛ إن احتاجت نسخة التطوير منحًا صريحة فسمّها إصلاحات تطويرية، ولا تنسبها إلى تعريفات الإنتاج أو تمنح الأدوار العامة صلاحيات لتجاوز الفشل.

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
