-- Stage before deploying lugati-pretest-worksheets recipient targeting.
-- Old values remain legal. "selected" means audited explicit student-ID recipients.
BEGIN;
ALTER TABLE public.lugati_pretest_dispatches
 DROP CONSTRAINT IF EXISTS lugati_pretest_dispatches_target_scope_check;
ALTER TABLE public.lugati_pretest_dispatches
 ADD CONSTRAINT lugati_pretest_dispatches_target_scope_check
 CHECK (target_scope IN ('all','class','demo','selected'));
COMMIT;
-- Existing student assignments and results are not changed.
