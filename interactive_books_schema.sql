-- Interactive curriculum library for Moallimi

create table if not exists public.interactive_books (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  grade_level text not null check (grade_level in ('الأول المتوسط','الثاني المتوسط','الثالث المتوسط')),
  subject_code text not null check (subject_code in ('arabic','english','science','math')),
  title text not null,
  description text,
  storage_path text,
  original_file_name text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  cover_color text not null default '#0d6259',
  last_page integer not null default 1 check (last_page >= 1),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, grade_level, subject_code)
);

create table if not exists public.interactive_book_units (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.interactive_books(id) on delete cascade,
  unit_number integer not null check (unit_number >= 1),
  title text not null,
  description text,
  start_page integer check (start_page is null or start_page >= 1),
  end_page integer check (end_page is null or end_page >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, unit_number),
  check (end_page is null or start_page is null or end_page >= start_page)
);

create table if not exists public.interactive_book_skills (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.interactive_books(id) on delete cascade,
  unit_id uuid references public.interactive_book_units(id) on delete set null,
  linked_skill_id uuid references public.skills(id) on delete set null,
  name text not null,
  domain text,
  description text,
  indicator text,
  level text not null default 'foundational' check (level in ('foundational','intermediate','advanced')),
  page_number integer check (page_number is null or page_number >= 1),
  sort_order integer not null default 0,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, name)
);

create table if not exists public.interactive_book_bookmarks (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.interactive_books(id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  title text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (book_id, page_number, title)
);

create index if not exists interactive_books_teacher_idx on public.interactive_books(teacher_id);
create index if not exists interactive_book_units_teacher_idx on public.interactive_book_units(teacher_id);
create index if not exists interactive_book_units_book_idx on public.interactive_book_units(book_id, sort_order);
create index if not exists interactive_book_skills_teacher_idx on public.interactive_book_skills(teacher_id);
create index if not exists interactive_book_skills_book_idx on public.interactive_book_skills(book_id, sort_order);
create index if not exists interactive_book_skills_unit_idx on public.interactive_book_skills(unit_id);
create index if not exists interactive_book_skills_linked_idx on public.interactive_book_skills(linked_skill_id);
create index if not exists interactive_book_bookmarks_teacher_idx on public.interactive_book_bookmarks(teacher_id);
create index if not exists interactive_book_bookmarks_book_idx on public.interactive_book_bookmarks(book_id, page_number);

alter table public.interactive_books enable row level security;
alter table public.interactive_book_units enable row level security;
alter table public.interactive_book_skills enable row level security;
alter table public.interactive_book_bookmarks enable row level security;

drop policy if exists interactive_books_owner on public.interactive_books;
create policy interactive_books_owner on public.interactive_books
for all to authenticated
using (teacher_id = (select auth.uid()))
with check (teacher_id = (select auth.uid()));

drop policy if exists interactive_book_units_owner on public.interactive_book_units;
create policy interactive_book_units_owner on public.interactive_book_units
for all to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.interactive_books b
    where b.id = book_id and b.teacher_id = (select auth.uid())
  )
);

drop policy if exists interactive_book_skills_owner on public.interactive_book_skills;
create policy interactive_book_skills_owner on public.interactive_book_skills
for all to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.interactive_books b
    where b.id = book_id and b.teacher_id = (select auth.uid())
  )
  and (
    unit_id is null or exists (
      select 1 from public.interactive_book_units u
      where u.id = unit_id and u.book_id = book_id and u.teacher_id = (select auth.uid())
    )
  )
  and (
    linked_skill_id is null or exists (
      select 1 from public.skills s
      where s.id = linked_skill_id and s.teacher_id = (select auth.uid())
    )
  )
);

drop policy if exists interactive_book_bookmarks_owner on public.interactive_book_bookmarks;
create policy interactive_book_bookmarks_owner on public.interactive_book_bookmarks
for all to authenticated
using (teacher_id = (select auth.uid()))
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.interactive_books b
    where b.id = book_id and b.teacher_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.interactive_books to authenticated;
grant select, insert, update, delete on public.interactive_book_units to authenticated;
grant select, insert, update, delete on public.interactive_book_skills to authenticated;
grant select, insert, update, delete on public.interactive_book_bookmarks to authenticated;

create or replace function public.ensure_interactive_library()
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_teacher uuid := auth.uid();
  v_books integer;
  v_units integer;
  v_skills integer;
begin
  if v_teacher is null then
    raise exception 'Authentication required';
  end if;

  insert into public.interactive_books
    (teacher_id, grade_level, subject_code, title, description, cover_color)
  select v_teacher, g.grade_level, s.subject_code,
         s.subject_name || ' — ' || g.grade_level,
         'كتاب تفاعلي للوحدات والصفحات والمهارات المطلوبة. ارفع نسخة PDF المعتمدة لتفعيل القراءة والانتقال المباشر.',
         s.cover_color
  from (values ('الأول المتوسط'),('الثاني المتوسط'),('الثالث المتوسط')) as g(grade_level)
  cross join (values
    ('arabic','لغتي الخالدة','#0d6259'),
    ('english','اللغة الإنجليزية','#245f9b'),
    ('science','العلوم','#287a53'),
    ('math','الرياضيات','#8a5a18')
  ) as s(subject_code, subject_name, cover_color)
  on conflict (teacher_id, grade_level, subject_code) do nothing;

  insert into public.interactive_book_units
    (teacher_id, book_id, unit_number, title, description, sort_order)
  select v_teacher, b.id, n,
         'الوحدة ' || n,
         'عدّل عنوان الوحدة وحدد صفحة البداية والنهاية وفق نسخة الكتاب المرفوعة.',
         n
  from public.interactive_books b
  cross join generate_series(1, 6) n
  where b.teacher_id = v_teacher
  on conflict (book_id, unit_number) do nothing;

  insert into public.interactive_book_skills
    (teacher_id, book_id, name, domain, description, indicator, level, sort_order, is_required)
  select v_teacher, b.id, t.name, t.domain, t.description, t.indicator, t.level, t.sort_order, true
  from public.interactive_books b
  join (values
    ('arabic','فهم المقروء واستخلاص الأفكار','الفهم القرائي','فهم النص الصريح والضمني وتحديد الفكرة الرئيسة والتفاصيل.','يستخلص الفكرة الرئيسة والأفكار الفرعية ويستدل عليها من النص.','foundational',1),
    ('arabic','تفسير المفردات والتراكيب في السياق','الثروة اللغوية','استخدام السياق لفهم المفردات والعلاقات الدلالية.','يفسر معنى المفردة أو التركيب ويحدد المرادف والضد وفق السياق.','foundational',2),
    ('arabic','تحليل النصوص الأدبية','التذوق الأدبي','تحليل الفكرة والصورة والأسلوب والقيمة في النص الأدبي.','يحلل عناصر النص ويبين أثر الأساليب والصور في المعنى.','intermediate',3),
    ('arabic','تطبيق الوظيفة النحوية','النحو','تطبيق القواعد النحوية في القراءة والكتابة.','يضبط التراكيب ويعلل العلامة الإعرابية ويصحح الخطأ النحوي.','intermediate',4),
    ('arabic','تطبيق الصنف اللغوي','الصنف اللغوي','تمييز الأبنية والصيغ الصرفية وتوظيفها.','يميز الصيغة الصرفية ويوظفها في جملة صحيحة.','intermediate',5),
    ('arabic','إتقان الرسم الإملائي والكتابي','الإملاء','كتابة الكلمات والتراكيب وفق القواعد الإملائية.','يكتب كتابة صحيحة ويصحح الخطأ الإملائي ويعلل القاعدة.','foundational',6),
    ('arabic','إنتاج نص مكتوب مترابط','التواصل الكتابي','التخطيط والكتابة والمراجعة لإنتاج نص واضح.','ينتج نصًا منظمًا مترابط الأفكار سليم اللغة.','advanced',7),
    ('arabic','التواصل الشفهي والعرض','التواصل الشفهي','عرض الأفكار بوضوح والاستماع والتفاعل.','يعرض فكرة أو رأيًا بلغة سليمة ويستجيب لما يسمعه.','advanced',8),

    ('english','Listening Comprehension','Listening','Understand main ideas, details, and speaker purpose in age-appropriate audio.','Identifies gist, key details, and meaning from spoken English.','foundational',1),
    ('english','Spoken Interaction and Pronunciation','Speaking','Participate in short exchanges with understandable pronunciation.','Uses suitable expressions, pronunciation, and turn-taking in communication.','intermediate',2),
    ('english','Reading Comprehension','Reading','Understand explicit and inferred meaning in varied texts.','Locates evidence, identifies main ideas, and makes supported inferences.','foundational',3),
    ('english','Vocabulary in Context','Vocabulary','Use context and word relationships to determine meaning.','Chooses and uses vocabulary accurately in context.','foundational',4),
    ('english','Grammar and Sentence Structure','Grammar','Build and edit accurate sentences using target structures.','Applies grammar rules and corrects structural errors.','intermediate',5),
    ('english','Writing Coherent Texts','Writing','Plan, draft, and revise connected paragraphs and messages.','Writes organized text with suitable vocabulary, cohesion, and mechanics.','advanced',6),
    ('english','Functional Communication','Communication','Use English for everyday academic and social purposes.','Selects appropriate language functions for purpose and audience.','intermediate',7),
    ('english','Critical Response to Texts','Critical literacy','Compare ideas, evaluate evidence, and express a supported response.','Evaluates a text and supports an opinion with relevant evidence.','advanced',8),

    ('science','فهم المفاهيم العلمية','المفاهيم','بناء فهم مترابط للمفاهيم والقوانين والنماذج العلمية.','يفسر الظواهر باستخدام المفهوم العلمي المناسب.','foundational',1),
    ('science','ممارسة الاستقصاء العلمي','الاستقصاء','صياغة الأسئلة والفرضيات وجمع الأدلة.','يصوغ سؤالًا قابلًا للاختبار ويقترح فرضية مبنية على المعرفة.','intermediate',2),
    ('science','تصميم التجربة وضبط المتغيرات','التجريب','تخطيط تجربة عادلة وتحديد أدواتها ومتغيراتها.','يميز المتغيرات ويحدد خطوات تجربة قابلة للتكرار.','advanced',3),
    ('science','تفسير البيانات والرسوم','البيانات','قراءة الجداول والرسوم واكتشاف الأنماط.','يحلل البيانات ويستنتج علاقة أو نمطًا مدعومًا بالدليل.','intermediate',4),
    ('science','تطبيق المعرفة في مواقف حياتية','التطبيق','نقل المعرفة العلمية إلى مواقف جديدة وحياتية.','يطبق المفهوم في موقف جديد ويتنبأ بالنتيجة.','intermediate',5),
    ('science','الاستدلال العلمي وحل المشكلات','الاستدلال','استخدام الأدلة لتفسير النتائج واتخاذ قرار.','يبني تفسيرًا علميًا ويربط الادعاء بالدليل والتعليل.','advanced',6),
    ('science','التواصل العلمي','التواصل','عرض الإجراءات والنتائج بلغة ورموز دقيقة.','يوثق العمل ويعرض النتائج والمصطلحات العلمية بوضوح.','intermediate',7),
    ('science','السلامة المعملية','السلامة','اتباع قواعد السلامة والتعامل المسؤول مع الأدوات.','يختار إجراء السلامة المناسب للموقف العملي.','foundational',8),

    ('math','الطلاقة العددية والعمليات','الأعداد','تنفيذ العمليات وفهم خصائص الأعداد وتقدير النتائج.','يختار العملية المناسبة ويحسب ويتحقق من معقولية الناتج.','foundational',1),
    ('math','التمثيل الجبري وحل المعادلات','الجبر','ترجمة المواقف إلى عبارات ومعادلات وحلها.','يمثل العلاقة جبريًا ويحل المعادلة ويتحقق من الحل.','intermediate',2),
    ('math','الأنماط والعلاقات والدوال','العلاقات','اكتشاف الأنماط وتمثيل العلاقات بين الكميات.','يعمم نمطًا ويمثل العلاقة بجدول أو قاعدة أو رسم.','intermediate',3),
    ('math','الهندسة والاستدلال المكاني','الهندسة','تحليل خصائص الأشكال والعلاقات المكانية.','يستخدم الخصائص الهندسية في التفسير والبرهان والحل.','intermediate',4),
    ('math','القياس والتحويل','القياس','اختيار الوحدات والقوانين وإجراء التحويلات.','يحسب قياسًا ويستخدم الوحدة والقانون المناسبين.','foundational',5),
    ('math','الإحصاء وتمثيل البيانات','الإحصاء','جمع البيانات وتمثيلها وتحليلها.','يقرأ التمثيل ويحسب المقاييس ويستنتج من البيانات.','intermediate',6),
    ('math','الاحتمالات','الاحتمال','وصف فرص النتائج وحساب الاحتمال وتفسيره.','يحدد فضاء العينة ويحسب احتمال حدث ويفسره.','intermediate',7),
    ('math','حل المسألة والتبرير','حل المشكلات','اختيار استراتيجية للحل وتبرير الخطوات والنتائج.','يحل مسألة غير مألوفة ويشرح استراتيجيته ويتحقق من الحل.','advanced',8)
  ) as t(subject_code, name, domain, description, indicator, level, sort_order)
    on t.subject_code = b.subject_code
  where b.teacher_id = v_teacher
  on conflict (book_id, name) do nothing;

  select count(*) into v_books from public.interactive_books where teacher_id = v_teacher;
  select count(*) into v_units from public.interactive_book_units where teacher_id = v_teacher;
  select count(*) into v_skills from public.interactive_book_skills where teacher_id = v_teacher;
  return jsonb_build_object('books', v_books, 'units', v_units, 'skills', v_skills);
end;
$$;

revoke all on function public.ensure_interactive_library() from public;
grant execute on function public.ensure_interactive_library() to authenticated;

-- Seed the existing teacher accounts. New accounts are seeded by the authenticated RPC.
insert into public.interactive_books
  (teacher_id, grade_level, subject_code, title, description, cover_color)
select p.id, g.grade_level, s.subject_code,
       s.subject_name || ' — ' || g.grade_level,
       'كتاب تفاعلي للوحدات والصفحات والمهارات المطلوبة. ارفع نسخة PDF المعتمدة لتفعيل القراءة والانتقال المباشر.',
       s.cover_color
from public.profiles p
cross join (values ('الأول المتوسط'),('الثاني المتوسط'),('الثالث المتوسط')) as g(grade_level)
cross join (values
  ('arabic','لغتي الخالدة','#0d6259'),
  ('english','اللغة الإنجليزية','#245f9b'),
  ('science','العلوم','#287a53'),
  ('math','الرياضيات','#8a5a18')
) as s(subject_code, subject_name, cover_color)
where p.role = 'teacher'
on conflict (teacher_id, grade_level, subject_code) do nothing;

insert into public.interactive_book_units
  (teacher_id, book_id, unit_number, title, description, sort_order)
select b.teacher_id, b.id, n, 'الوحدة ' || n,
       'عدّل عنوان الوحدة وحدد صفحة البداية والنهاية وفق نسخة الكتاب المرفوعة.', n
from public.interactive_books b
cross join generate_series(1, 6) n
on conflict (book_id, unit_number) do nothing;

insert into public.interactive_book_skills
  (teacher_id, book_id, name, domain, description, indicator, level, sort_order, is_required)
select b.teacher_id, b.id, t.name, t.domain, t.description, t.indicator, t.level, t.sort_order, true
from public.interactive_books b
join (values
  ('arabic','فهم المقروء واستخلاص الأفكار','الفهم القرائي','فهم النص الصريح والضمني وتحديد الفكرة الرئيسة والتفاصيل.','يستخلص الفكرة الرئيسة والأفكار الفرعية ويستدل عليها من النص.','foundational',1),
  ('arabic','تفسير المفردات والتراكيب في السياق','الثروة اللغوية','استخدام السياق لفهم المفردات والعلاقات الدلالية.','يفسر معنى المفردة أو التركيب ويحدد المرادف والضد وفق السياق.','foundational',2),
  ('arabic','تحليل النصوص الأدبية','التذوق الأدبي','تحليل الفكرة والصورة والأسلوب والقيمة في النص الأدبي.','يحلل عناصر النص ويبين أثر الأساليب والصور في المعنى.','intermediate',3),
  ('arabic','تطبيق الوظيفة النحوية','النحو','تطبيق القواعد النحوية في القراءة والكتابة.','يضبط التراكيب ويعلل العلامة الإعرابية ويصحح الخطأ النحوي.','intermediate',4),
  ('arabic','تطبيق الصنف اللغوي','الصنف اللغوي','تمييز الأبنية والصيغ الصرفية وتوظيفها.','يميز الصيغة الصرفية ويوظفها في جملة صحيحة.','intermediate',5),
  ('arabic','إتقان الرسم الإملائي والكتابي','الإملاء','كتابة الكلمات والتراكيب وفق القواعد الإملائية.','يكتب كتابة صحيحة ويصحح الخطأ الإملائي ويعلل القاعدة.','foundational',6),
  ('arabic','إنتاج نص مكتوب مترابط','التواصل الكتابي','التخطيط والكتابة والمراجعة لإنتاج نص واضح.','ينتج نصًا منظمًا مترابط الأفكار سليم اللغة.','advanced',7),
  ('arabic','التواصل الشفهي والعرض','التواصل الشفهي','عرض الأفكار بوضوح والاستماع والتفاعل.','يعرض فكرة أو رأيًا بلغة سليمة ويستجيب لما يسمعه.','advanced',8),
  ('english','Listening Comprehension','Listening','Understand main ideas, details, and speaker purpose in age-appropriate audio.','Identifies gist, key details, and meaning from spoken English.','foundational',1),
  ('english','Spoken Interaction and Pronunciation','Speaking','Participate in short exchanges with understandable pronunciation.','Uses suitable expressions, pronunciation, and turn-taking in communication.','intermediate',2),
  ('english','Reading Comprehension','Reading','Understand explicit and inferred meaning in varied texts.','Locates evidence, identifies main ideas, and makes supported inferences.','foundational',3),
  ('english','Vocabulary in Context','Vocabulary','Use context and word relationships to determine meaning.','Chooses and uses vocabulary accurately in context.','foundational',4),
  ('english','Grammar and Sentence Structure','Grammar','Build and edit accurate sentences using target structures.','Applies grammar rules and corrects structural errors.','intermediate',5),
  ('english','Writing Coherent Texts','Writing','Plan, draft, and revise connected paragraphs and messages.','Writes organized text with suitable vocabulary, cohesion, and mechanics.','advanced',6),
  ('english','Functional Communication','Communication','Use English for everyday academic and social purposes.','Selects appropriate language functions for purpose and audience.','intermediate',7),
  ('english','Critical Response to Texts','Critical literacy','Compare ideas, evaluate evidence, and express a supported response.','Evaluates a text and supports an opinion with relevant evidence.','advanced',8),
  ('science','فهم المفاهيم العلمية','المفاهيم','بناء فهم مترابط للمفاهيم والقوانين والنماذج العلمية.','يفسر الظواهر باستخدام المفهوم العلمي المناسب.','foundational',1),
  ('science','ممارسة الاستقصاء العلمي','الاستقصاء','صياغة الأسئلة والفرضيات وجمع الأدلة.','يصوغ سؤالًا قابلًا للاختبار ويقترح فرضية مبنية على المعرفة.','intermediate',2),
  ('science','تصميم التجربة وضبط المتغيرات','التجريب','تخطيط تجربة عادلة وتحديد أدواتها ومتغيراتها.','يميز المتغيرات ويحدد خطوات تجربة قابلة للتكرار.','advanced',3),
  ('science','تفسير البيانات والرسوم','البيانات','قراءة الجداول والرسوم واكتشاف الأنماط.','يحلل البيانات ويستنتج علاقة أو نمطًا مدعومًا بالدليل.','intermediate',4),
  ('science','تطبيق المعرفة في مواقف حياتية','التطبيق','نقل المعرفة العلمية إلى مواقف جديدة وحياتية.','يطبق المفهوم في موقف جديد ويتنبأ بالنتيجة.','intermediate',5),
  ('science','الاستدلال العلمي وحل المشكلات','الاستدلال','استخدام الأدلة لتفسير النتائج واتخاذ قرار.','يبني تفسيرًا علميًا ويربط الادعاء بالدليل والتعليل.','advanced',6),
  ('science','التواصل العلمي','التواصل','عرض الإجراءات والنتائج بلغة ورموز دقيقة.','يوثق العمل ويعرض النتائج والمصطلحات العلمية بوضوح.','intermediate',7),
  ('science','السلامة المعملية','السلامة','اتباع قواعد السلامة والتعامل المسؤول مع الأدوات.','يختار إجراء السلامة المناسب للموقف العملي.','foundational',8),
  ('math','الطلاقة العددية والعمليات','الأعداد','تنفيذ العمليات وفهم خصائص الأعداد وتقدير النتائج.','يختار العملية المناسبة ويحسب ويتحقق من معقولية الناتج.','foundational',1),
  ('math','التمثيل الجبري وحل المعادلات','الجبر','ترجمة المواقف إلى عبارات ومعادلات وحلها.','يمثل العلاقة جبريًا ويحل المعادلة ويتحقق من الحل.','intermediate',2),
  ('math','الأنماط والعلاقات والدوال','العلاقات','اكتشاف الأنماط وتمثيل العلاقات بين الكميات.','يعمم نمطًا ويمثل العلاقة بجدول أو قاعدة أو رسم.','intermediate',3),
  ('math','الهندسة والاستدلال المكاني','الهندسة','تحليل خصائص الأشكال والعلاقات المكانية.','يستخدم الخصائص الهندسية في التفسير والبرهان والحل.','intermediate',4),
  ('math','القياس والتحويل','القياس','اختيار الوحدات والقوانين وإجراء التحويلات.','يحسب قياسًا ويستخدم الوحدة والقانون المناسبين.','foundational',5),
  ('math','الإحصاء وتمثيل البيانات','الإحصاء','جمع البيانات وتمثيلها وتحليلها.','يقرأ التمثيل ويحسب المقاييس ويستنتج من البيانات.','intermediate',6),
  ('math','الاحتمالات','الاحتمال','وصف فرص النتائج وحساب الاحتمال وتفسيره.','يحدد فضاء العينة ويحسب احتمال حدث ويفسره.','intermediate',7),
  ('math','حل المسألة والتبرير','حل المشكلات','اختيار استراتيجية للحل وتبرير الخطوات والنتائج.','يحل مسألة غير مألوفة ويشرح استراتيجيته ويتحقق من الحل.','advanced',8)
) as t(subject_code, name, domain, description, indicator, level, sort_order)
  on t.subject_code = b.subject_code
on conflict (book_id, name) do nothing;
