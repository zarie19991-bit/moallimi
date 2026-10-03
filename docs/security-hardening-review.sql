-- مراجعة تقوية الأمان المقترحة لمنصة معلّمي
-- لا تنفذ هذا الملف مباشرة على الإنتاج قبل نسخة احتياطية واختبار قراءة وكتابة.
-- الهدف: معالجة تحذيرات Supabase Advisors تدريجيًا دون كسر المنصة.

-- 1) مثال تثبيت search_path للوظائف التي ظهر عليها تحذير.
-- راجع جسم كل وظيفة قبل ALTER للتأكد من عدم اعتمادها على search_path متغير.
-- ALTER FUNCTION public.nafes_curated_question_quality_guard(...) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.nafes_standard_question_quality_guard(...) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.nafes_content_fingerprint(...) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.nafes_question_quality_checks(...) SET search_path = public, pg_temp;
-- ALTER FUNCTION public.nafes_question_quality_hard_pass(...) SET search_path = public, pg_temp;

-- 2) جداول public التي تحتاج قرارًا قبل تفعيل RLS.
-- لا تفعّل RLS إلا بعد التأكد من مسار القراءة في Edge Functions والواجهة.
-- ALTER TABLE public.nafes_indicator_v5_staging ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.nafes_indicator_v5_blueprints ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.nafes_indicator_curated_bank ENABLE ROW LEVEL SECURITY;

-- 3) نمط policy مقترح للقراءة العامة إذا كان الجدول يحتوي بنك مؤشرات غير حساس.
-- CREATE POLICY "read approved bank" ON public.nafes_indicator_curated_bank
-- FOR SELECT USING (true);

-- 4) منع الكتابة المباشرة من anon/authenticated على جداول البنك.
-- REVOKE INSERT, UPDATE, DELETE ON public.nafes_indicator_curated_bank FROM anon, authenticated;
-- REVOKE INSERT, UPDATE, DELETE ON public.nafes_indicator_v5_blueprints FROM anon, authenticated;
-- REVOKE INSERT, UPDATE, DELETE ON public.nafes_indicator_v5_staging FROM anon, authenticated;

-- 5) فهارس مفاتيح أجنبية غير مغطاة: أضفها فقط بعد مراجعة الحجم والاستعلامات.
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS maintenance_agent_handoffs_run_id_idx
-- ON public.maintenance_agent_handoffs(run_id);
