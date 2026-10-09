-- Correct a contradictory science indicator question while preserving its ID.
-- Existing rendered assessments retain their stored snapshots; affected drafts with no attempts are archived.

update public.nafes_indicator_curated_bank
set question_text='اصطف أزواج الكروموسومات المتماثلة عند خط الاستواء، وبقيت الأزواج متجاورة دون أن تنفصل نحو القطبين. أي مرحلة يصفها الحدث؟',
    explanation='في الطور الاستوائي الأول تصطف أزواج الكروموسومات المتماثلة عند خط الاستواء قبل انفصالها نحو القطبين.'
where id='5718ce72-3678-40e0-8d4a-d120f136872e'
  and subject_key='science'
  and indicator_key='science:2-1-1-5-9:i4';

update public.nafes_assessments
set status='archived'
where status='draft'
  and id in (
    'df228d41-805f-4f47-8c9f-40fc05499aa8',
    '9c6a642b-b531-418e-9b74-dce1e45623c3',
    'ecc60d3a-6bec-40d7-ba83-1b00fbedcda4',
    '790b3638-9b07-486f-acd8-18618fcd4b8c',
    '8781282a-5c71-4a1f-90e3-0ab70a5af70f',
    'cd745800-caf1-49a4-979f-5aa54c3c5459',
    '1a68dfce-e7f5-4e19-ab92-53645e3de9c7',
    '0a5892cf-f3b2-4e1f-be6b-aa5cf8d308b2',
    '6f6c3e8a-a6e2-40df-a6e9-012e39b6619e',
    '805f5574-c00a-4490-bb06-a9111a401108'
  )
  and not exists (
    select 1 from public.nafes_assessment_attempts att
    where att.assessment_id=public.nafes_assessments.id
  );