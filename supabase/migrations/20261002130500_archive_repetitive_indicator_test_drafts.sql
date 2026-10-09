update public.nafes_assessments
set status='archived'
where status='draft'
  and id in (
    '50dc4d5e-acc2-4983-8fc2-2d81133b450a',
    'b429bd16-a208-4465-b732-0dde7b442586',
    'edc0f18e-f5b4-4473-85b0-210090bbba71',
    '0d61d5e3-e698-40c9-b39b-85745135b030',
    '76948c9d-dd54-4c09-be6c-160d1714874e',
    'b8eb498e-636a-4c09-8503-acfb5c2ec0bb'
  )
  and not exists (
    select 1 from public.nafes_assessment_attempts att
    where att.assessment_id=public.nafes_assessments.id
  );