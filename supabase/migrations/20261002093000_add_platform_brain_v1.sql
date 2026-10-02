-- Platform Brain v1: privacy-safe project knowledge for the maintenance agent.
-- Contains architecture and project decisions only. Never store student PII, credentials, or raw attempt data here.

create table if not exists public.maintenance_agent_knowledge (
  id text primary key,
  category text not null check (category in ('architecture','module','workflow','decision','quality','safety','known_issue')),
  module text not null,
  title text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  keywords text[] not null default '{}'::text[],
  source_paths text[] not null default '{}'::text[],
  priority integer not null default 50 check (priority between 1 and 100),
  active boolean not null default true,
  contains_personal_data boolean not null default false check (contains_personal_data = false),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_agent_knowledge_module_idx
  on public.maintenance_agent_knowledge(module, active);

alter table public.maintenance_agent_knowledge enable row level security;
revoke all on table public.maintenance_agent_knowledge from anon, authenticated;
grant select, insert, update on table public.maintenance_agent_knowledge to service_role;

insert into public.maintenance_agent_knowledge
(id,category,module,title,summary,details,keywords,source_paths,priority)
values
('platform.identity','architecture','platform','هوية منصة معلّمي',
 'منصة معلّمي هي منصة نافس للصف الثالث المتوسط وتغطي القراءة والرياضيات والعلوم، والواجهة الحية منشورة عبر GitHub Pages والخلفية على Supabase.',
 '{"repo":"zarie19991-bit/moallimi","deployment":"GitHub Pages","backend":"Supabase","grade":"ثالث متوسط"}',
 array['معلّمي','المنصة','github','supabase','نافس','ثالث متوسط'],
 array['index.html','production-files.txt','supabase/functions/nafes-exam/index.ts'],100),

('platform.auth','architecture','accounts','نظام حسابات المعلمين',
 'الحساب الرئيسي نطاقه all، وحسابات المواد مقيدة بالقراءة أو الرياضيات أو العلوم. مفاتيح المعلمين لا تدخل روابط الطلاب ولا يجب إظهارها في الواجهة.',
 '{"master_scope":"all","subject_scopes":["reading","math","science"],"rule":"server-side verification"}',
 array['حساب','معلم','الرئيسي','صلاحية','مفتاح','دخول','scope'],
 array['teacher-access.js','teacher-preboot.js','teacher.html'],95),

('platform.indicator-builder','module','tests','إنشاء اختبارات المؤشرات',
 'إنشاء الاختبارات يتم من قسم اختبارات المؤشرات ويمكن اختيار مؤشر واحد أو عدة مؤشرات وعدد الأسئلة، مع مراجعة المسودة قبل النشر.',
 '{"simulation_section":"disabled","multi_indicator":true,"subjects":["reading","math","science"]}',
 array['اختبار','مؤشر','إنشاء','مسودة','نشر','أسئلة','عدة مؤشرات'],
 array['create.html','create.js','supabase/functions/nafes-exam/assessments.ts'],95),

('platform.banks','architecture','question_bank','بنوك الأسئلة الحية',
 'البنك العام nafes_question_bank مستخدم للقراءة، بينما تعتمد الرياضيات والعلوم في المسار الحديث على nafes_indicator_curated_bank بإصدارات جودة محددة. السجلات التاريخية لا تُحذف لمجرد تحسين الجودة.',
 '{"general_bank":"nafes_question_bank","curated_bank":"nafes_indicator_curated_bank","preserve_history":true}',
 array['بنك','أسئلة','curated','question_bank','تاريخية','قراءة','رياضيات','علوم'],
 array['supabase/functions/nafes-exam/assessments.ts','supabase/functions/nafes-exam/reviewed-bank.ts'],100),

('platform.question-quality','quality','question_quality','معيار جودة السؤال',
 'السؤال الجيد يطابق المؤشر مباشرة، له أربعة بدائل وإجابة واحدة، مشتتاته معقولة، لغته طبيعية، ومستواه المعرفي حقيقي وليس مجرد تسمية.',
 '{"options":4,"single_correct":true,"levels":["knowledge","application","reasoning"],"semantic_alignment":true}',
 array['صياغة','جودة','سؤال','مشتتات','معرفة','تطبيق','استدلال','مطابقة','مؤشر'],
 array['supabase/functions/nafes-exam/assessments.ts'],100),

('platform.question-language','quality','question_quality','منع لغة التصميم الداخلية',
 'لا يجوز أن يرى الطالب عبارات مثل تطبيق علمي جديد أو موقف تقويمي جديد أو مراجعة جماعية للحل أو تعليمات إنشاء السؤال. يجب أن يبدأ السؤال بالموقف أو المعطى مباشرة.',
 '{"forbidden_examples":["تطبيق علمي جديد","موقف تقويمي جديد","مراجعة جماعية للحل","أي اختيار يحقق المطلوب دون إهمال المعطيات"]}',
 array['تطبيق علمي جديد','موقف تقويمي','مراجعة جماعية','صياغة آلية','لغة داخلية','قالب'],
 array['supabase/functions/nafes-exam/assessments.ts'],100),

('platform.question-diversity','quality','question_quality','منع التكرار والقوالب',
 'يجب منع التكرار الحرفي وشبه الحرفي والعائلات الصياغية المتقاربة بين النماذج، ولا يكفي تغيير الأرقام أو ترتيب الخيارات لاعتبار السؤال جديدًا.',
 '{"exact_duplicate":false,"near_duplicate":false,"stem_family_limit":2}',
 array['تكرار','متكرر','قالب','نموذج','شبه متطابق','stem','family'],
 array['supabase/functions/nafes-exam/assessments.ts'],98),

('platform.reading-quality','quality','reading','جودة أسئلة القراءة',
 'أسئلة القراءة ترتبط بالنص والمؤشر، ولا ينبغي أن تكون خمسة أسئلة متتالية من القالب العقلي نفسه مثل اختر المختلف أو لا ينتمي. يجب تنويع المهمة داخل حدود المؤشر.',
 '{"passage_bound":true,"diverse_item_tasks":true}',
 array['قراءة','نص','فهم','اختر المختلف','لا ينتمي','تنويع'],
 array['nafes-reading.js','supabase/functions/nafes-exam/assessments.ts'],95),

('platform.math-quality','quality','math','جودة الرياضيات وعرض الرموز',
 'الرياضيات تحتاج مسائل طبيعية مرتبطة بالمؤشر، كما يجب حماية اتجاه الكسور والجذور والأسس والإشارات عند العرض والطباعة حتى لا تتشوه بسبب RTL.',
 '{"rtl_math_sensitive":true,"symbols":["fractions","roots","powers","negative signs"]}',
 array['رياضيات','كسر','جذر','أس','إشارة','rtl','طباعة','رموز'],
 array['review-question-papers.js','supabase/functions/nafes-exam/assessments.ts'],96),

('platform.science-quality','quality','science','جودة العلوم',
 'العلوم يجب أن تستخدم مواقف وملاحظات وبيانات حقيقية عند ادعاء التطبيق أو الاستدلال، وألا تتحول تعليمات بناء السؤال إلى نص يراه الطالب.',
 '{"application_requires_context":true,"reasoning_requires_evidence":true}',
 array['علوم','تجربة','ملاحظة','بيانات','استدلال','تطبيق','صياغة'],
 array['supabase/functions/nafes-exam/assessments.ts'],100),

('platform.paper-builder','workflow','paper','مسار إنشاء الاختبار الورقي',
 'قسم المراجعة والتصحيح الآلي ينشئ نماذج متعددة ويحفظ المراجعة في nafes_paper_reviews مع النماذج ومفاتيح الإجابة وتوزيع الطلاب.',
 '{"review_table":"nafes_paper_reviews","multi_model":true,"multi_subject":true}',
 array['ورقي','مراجعة','نماذج','ورق','حفظ','paper','review'],
 array['review-correction.js','review-draft-sync.js','supabase/functions/nafes-exam/assessments.ts'],94),

('platform.omr','workflow','omr','مسار التصحيح الآلي OMR',
 'review-scan.js يقرأ أوراق التظليل ويطلب مراجعة الحالات غير الواضحة، ولا تُحفظ النتيجة النهائية في التحليل إلا بعد الضغط على اعتماد النتائج. الخادم يسجل حدث paper_scan في nafes_assessment_attempts.',
 '{"approval_required":true,"event_type":"paper_scan","attempt_table":"nafes_assessment_attempts"}',
 array['omr','تظليل','تصحيح','رفع','اعتماد النتائج','paper_scan','نتائج'],
 array['review-scan.js','supabase/functions/nafes-exam/assessments.ts'],100),

('platform.paper-analysis','workflow','analysis','تحليل وتقارير الاختبارات الورقية',
 'للمراجعات الورقية صفحات تحليل وتقرير مخصصة تعتمد نتائج paper_scan المرتبطة بمعرف المراجعة، ولا ينبغي اعتبار وجود مراجعة بلا نتائج معتمدة عطلًا بحد ذاته.',
 '{"analysis_page":"review-analysis.html","report_page":"review-report.html","empty_results_can_be_normal":true}',
 array['تحليل','تقرير','ورقي','paper_scan','نتائج معتمدة'],
 array['review-analysis.js','review-report.js','review-results-core.js'],90),

('platform.printing','decision','printing','قواعد الطباعة',
 'الطباعة يجب أن تستغل صفحة A4 دون فراغات كبيرة وألا تقسم القسم بلا حاجة، مع الحفاظ على مجموعات نص القراءة وأسئلته وعدم فرض صفحة مستقلة لكل قسم.',
 '{"paper":"A4","avoid_unnecessary_breaks":true,"keep_reading_groups":true}',
 array['طباعة','A4','صفحة','فراغ','تقسيم','قراءة'],
 array['report-print-exact.css','analysis-section-router.js','review-question-papers.js'],92),

('platform.safety-history','safety','data','حماية السجل التاريخي',
 'أي تحسين لبنك الأسئلة يجب أن يحافظ على معرّفات الأسئلة والسجلات المرتبطة بمحاولات سابقة. الإصلاحات الجديدة تؤثر في الاختبارات الجديدة دون إتلاف التاريخ.',
 '{"delete_historical_questions":false,"preserve_attempt_references":true}',
 array['حذف','تاريخي','نتائج','محاولات','معرف','سجل','history'],
 array['supabase/migrations/20261001204500_enforce_question_quality.sql'],100),

('platform.safety-changes','safety','deployment','قواعد تعديل المنصة',
 'التغييرات التقنية عالية الأثر يجب أن تنفذ على فرع GitHub منفصل، تختبر قبل الدمج، ولا يعدل الوكيل الإنتاج أو قاعدة البيانات تغييرًا عالي الخطورة دون موافقة صريحة.',
 '{"branch_first":true,"test_before_merge":true,"approval_for_high_risk":true}',
 array['فرع','github','main','دمج','نشر','موافقة','أمان'],
 array['.github/workflows/deploy-supabase-admin.yml'],100),

('platform.privacy','safety','privacy','خصوصية الطلاب والمفاتيح',
 'تشخيص الوكيل لا يحتاج أسماء الطلاب أو أرقامهم أو مفاتيح المعلمين. يجب استخدام بيانات مجمعة أو معرفات غير شخصية عند الحاجة للتحليل التقني.',
 '{"student_names":false,"student_ids":false,"teacher_keys":false,"aggregates_only":true}',
 array['خصوصية','طلاب','أسماء','أرقام','مفاتيح','بيانات','سرية'],
 array['supabase/functions/maintenance-agent/index.ts'],100),

('platform.rls-known-risk','known_issue','database','الجداول العامة غير المحمية حاليًا',
 'الفحص الحالي اكتشف ثلاثة جداول public بلا RLS: nafes_indicator_curated_bank وnafes_indicator_v5_blueprints وnafes_indicator_v5_staging. يجب فحص الاستخدام قبل تنفيذ الحماية حتى لا يتعطل المسار الحي.',
 '{"tables":["nafes_indicator_curated_bank","nafes_indicator_v5_blueprints","nafes_indicator_v5_staging"],"execute_automatically":false}',
 array['rls','قاعدة البيانات','حماية','curated','staging','blueprints'],
 array['supabase/functions/nafes-exam/assessments.ts'],97),

('platform.agent-timeout','known_issue','agent','الفحص العميق لا يعمل داخل الطلب السريع',
 'الفحص العميق لكل بنك الأسئلة تسبب سابقًا في statement timeout، لذلك الفحص الحي الحالي سريع، ويجب تنفيذ تحليلات الجودة الثقيلة على دفعات أو عبر نتائج مخزنة.',
 '{"fast_scan":true,"deep_scan_inline":false,"reason":"statement timeout"}',
 array['timeout','فحص عميق','statement','بطيء','وكيل','دفعات'],
 array['supabase/functions/maintenance-agent/index.ts'],94)
on conflict (id) do update set
  category=excluded.category,module=excluded.module,title=excluded.title,summary=excluded.summary,
  details=excluded.details,keywords=excluded.keywords,source_paths=excluded.source_paths,
  priority=excluded.priority,active=true,contains_personal_data=false,updated_at=now();

-- Keep the user-facing health scan fast. Deep question analysis is a separate concern.
create or replace function public.maintenance_agent_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
with
rls as (
  select
    count(*) filter (where not c.relrowsecurity)::int as disabled_count,
    coalesce(jsonb_agg(c.relname order by c.relname) filter (where not c.relrowsecurity),'[]'::jsonb) as disabled_tables
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
),
est as (
  select
    coalesce(max(case when relname='nafes_question_bank' then n_live_tup end),0)::bigint as question_bank_rows,
    coalesce(max(case when relname='nafes_indicator_curated_bank' then n_live_tup end),0)::bigint as curated_rows
  from pg_stat_user_tables
),
paper as (
  select
    (select count(*)::int from public.nafes_paper_reviews) as reviews_count,
    (select count(*)::int from public.nafes_assessment_attempts
      where is_demo=false and coalesce(config->>'paper_review','false')='true') as approved_attempts
)
select jsonb_build_object(
  'generated_at', now(),
  'mode', 'fast',
  'deep_question_scan', false,
  'privacy', jsonb_build_object(
    'contains_student_names', false,
    'contains_student_ids', false,
    'contains_teacher_keys', false
  ),
  'database_security', jsonb_build_object(
    'rls_disabled_public_count', rls.disabled_count,
    'rls_disabled_public_tables', rls.disabled_tables
  ),
  'question_quality', jsonb_build_object(
    'question_bank_estimated_rows', est.question_bank_rows,
    'curated_estimated_rows', est.curated_rows,
    'prompt_leak_rows', null,
    'duplicate_groups_question_bank', null,
    'duplicate_groups_curated_bank', null,
    'question_bank_needs_quality_review', null
  ),
  'paper_review', jsonb_build_object(
    'saved_reviews', paper.reviews_count,
    'approved_attempts', paper.approved_attempts
  )
)
from rls, est, paper;
$$;

revoke all on function public.maintenance_agent_snapshot() from public, anon, authenticated;
grant execute on function public.maintenance_agent_snapshot() to service_role;
