-- Archive the remaining published indicator test that has no attempts and
-- still uses an old materially imbalanced answer-position distribution.
-- Published tests are immutable except for status changes, so preserve all content.

update public.nafes_assessments a
set status='archived'
where a.id='ecb39843-b828-4c79-81ae-bce37ff4f9ca'
  and a.kind='multi_indicator'
  and a.status='published'
  and not exists (
    select 1
    from public.nafes_assessment_attempts att
    where att.assessment_id=a.id
  );