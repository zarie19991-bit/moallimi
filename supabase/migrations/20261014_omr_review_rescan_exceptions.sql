-- Explicitly defer an unreadable OMR paper without assigning a guessed score.
-- Does not modify original snapshot or existing student grades.
CREATE OR REPLACE FUNCTION public.nafes_scan_mark_rescan(
 p_session uuid,p_sheet uuid,p_reviewer uuid,p_version integer,p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public','pg_temp'
AS $rescan$
DECLARE s public.nafes_scan_sessions; r public.nafes_scan_sheets; reason text;
BEGIN
 reason:=btrim(coalesce(p_reason,''));
 IF char_length(reason) NOT BETWEEN 10 AND 600 THEN
  RAISE EXCEPTION 'اكتب سبب إعادة المسح (من 10 إلى 600 حرف)';
 END IF;
 SELECT * INTO s FROM public.nafes_scan_sessions WHERE id=p_session FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'جلسة غير موجودة'; END IF;
 IF s.reviewer_id IS DISTINCT FROM p_reviewer THEN
  RAISE EXCEPTION 'تأجيل الورقة متاح لمراجع الجلسة فقط';
 END IF;
 IF s.completed_at IS NOT NULL THEN RAISE EXCEPTION 'الجلسة منتهية ولا تقبل تعديل المراجعات'; END IF;
 IF (SELECT count(*) FROM public.nafes_scan_sheets WHERE session_id=s.id)<>s.expected_count THEN
  RAISE EXCEPTION 'يجب اكتمال رفع جميع الأوراق قبل تحديد ما يحتاج إعادة المسح';
 END IF;
 SELECT * INTO r FROM public.nafes_scan_sheets WHERE session_id=s.id AND id=p_sheet FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'الورقة غير موجودة'; END IF;
 IF p_version IS DISTINCT FROM r.answer_version THEN
  RAISE EXCEPTION 'تغيرت الورقة؛ أعد فتحها لتسجيل قرارك على أحدث نسخة';
 END IF;
 IF r.blocked_duplicate THEN
  RAISE EXCEPTION 'النسخ المكررة لها مسار مراجعة مستقل؛ لا تسجلها لإعادة المسح';
 END IF;
 IF r.reviewed_at IS NOT NULL THEN
  IF r.disposition='requires_rescan' THEN RETURN to_jsonb(r)-'image_data'; END IF;
  RAISE EXCEPTION 'الورقة لديها اعتماد محفوظ؛ لا يمكن تغيير القرار بعد اعتماده';
 END IF;
 UPDATE public.nafes_scan_sheets
 SET disposition='requires_rescan',reviewed_at=now(),reviewed_by=p_reviewer,
 effective_snapshot=coalesce(r.effective_snapshot,r.snapshot)||
   jsonb_build_object('omr_rescan_decision',
     jsonb_build_object('reason',reason,'reviewer_id',p_reviewer,'recorded_at',now(),
       'grade_published',false))
 WHERE id=r.id RETURNING * INTO r;
 RETURN to_jsonb(r)-'image_data';
END
$rescan$;

REVOKE ALL ON FUNCTION public.nafes_scan_mark_rescan(uuid,uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nafes_scan_mark_rescan(uuid,uuid,uuid,integer,text) TO service_role;

-- The existing finish function validates every VERIFIED row, including all
-- answer evidence and exact grades. Extend ONLY the separate exception branch.
DO $patch$
DECLARE fn text; updated text;
BEGIN
 SELECT pg_get_functiondef('public.nafes_scan_finish(uuid)'::regprocedure) INTO fn;
 IF fn IS NULL
    OR (length(fn)-length(replace(fn,'if r.blocked_duplicate then','')))/length('if r.blocked_duplicate then')<>1
    OR position('update public.nafes_scan_sessions set completed_at' IN fn)=0 THEN
  RAISE EXCEPTION 'Unexpected OMR finish function definition; do not patch';
 END IF;
 updated:=replace(fn,'if r.blocked_duplicate then',
 'if r.disposition=''requires_rescan'' then
   if r.reviewed_at is null or r.reviewed_by is null or
      coalesce(r.effective_snapshot,r.snapshot)->''omr_rescan_decision''->>''reason'' is null then
      raise exception ''ورقة مستبعدة بلا قرار مراجعة موثق'';
   end if;
 elsif r.blocked_duplicate then');
 updated:=replace(updated,
 'update public.nafes_scan_sessions set completed_at',
 'if (select count(*) from public.nafes_scan_sheets where session_id=s.id and disposition=''verified'')=0 then
     raise exception ''لا توجد ورقة واحدة متحقق منها للنشر؛ يجب مراجعة ورقة سليمة على الأقل'';
  end if;
 update public.nafes_scan_sessions set completed_at');
 EXECUTE updated;
END
$patch$;
