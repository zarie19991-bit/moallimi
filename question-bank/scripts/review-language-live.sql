begin;

-- Mathematics: replace the three generated wrappers with clear, impersonal stems.
with src as (
  select id,
    (regexp_match(question_text, '^في ([^،]+)،'))[1] as setting,
    (regexp_match(question_text, '^في [^،]+، سأل ([^:]+):'))[1] as actor,
    (regexp_match(question_text, 'لحل «(.*)»؛ أي قاعدة أو خطوة صحيحة ينبغي استخدامها؟$'))[1] as base_question,
    question_no
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'math'
    and cognitive_level = 'knowledge'
    and question_text ~ 'لحل «.*»؛ أي قاعدة أو خطوة صحيحة ينبغي استخدامها؟$'
), revised as (
  select id,
    'في ' || setting || '، ' ||
    case question_no
      when 1 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'سألت ' else 'سأل ' end) || actor || ' عن القاعدة أو الخطوة الصحيحة لحل المسألة الآتية: '
      when 2 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'اختارت ' else 'اختار ' end) || actor || ' القاعدة المناسبة لبدء حل المسألة الآتية: '
      when 3 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'حدّدت ' else 'حدّد ' end) || actor || ' الخطوة الصحيحة التي ينبغي تطبيقها على المسألة الآتية: '
      when 4 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'بحثت ' else 'بحث ' end) || actor || ' عن المفهوم الرياضي اللازم لحل المسألة الآتية: '
      else (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'راجعت ' else 'راجع ' end) || actor || ' الإجراء الصحيح لحل المسألة الآتية: '
    end || '«' || base_question || '»' as question_text
  from src
)
update public.nafes_question_bank q
set question_text = revised.question_text
from revised
where q.id = revised.id;

with src as (
  select id,
    (regexp_match(question_text, '^في ([^،]+)،'))[1] as setting,
    (regexp_match(question_text, '^في [^،]+، طبّق ([^.]+) القاعدة'))[1] as actor,
    regexp_replace(question_text, '^في [^،]+، طبّق [^.]+ القاعدة على مسألة جديدة\. ', '') as base_question,
    question_no
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'math'
    and cognitive_level = 'application'
    and question_text ~ '^في [^،]+، طبّق [^.]+ القاعدة على مسألة جديدة\.'
), revised as (
  select id,
    'في ' || setting || '، ' ||
    case question_no
      when 6 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'طبّقت ' else 'طبّق ' end) || actor || ' القاعدة المناسبة على المسألة الآتية: '
      when 7 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'استخدمت ' else 'استخدم ' end) || actor || ' المفهوم الرياضي لحل المسألة الآتية: '
      when 8 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'حلّت ' else 'حلّ ' end) || actor || ' المسألة التطبيقية الآتية: '
      when 9 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'اختارت ' else 'اختار ' end) || actor || ' الإجابة الصحيحة للمسألة الآتية: '
      else (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'نفّذت ' else 'نفّذ ' end) || actor || ' الخطوات المناسبة لحل المسألة الآتية: '
    end || base_question as question_text
  from src
)
update public.nafes_question_bank q
set question_text = revised.question_text
from revised
where q.id = revised.id;

with src as (
  select id,
    (regexp_match(question_text, '^في ([^،]+)،'))[1] as setting,
    (regexp_match(question_text, '^في [^،]+، راجع ([^ ]+) حلًا'))[1] as actor,
    (regexp_match(question_text, 'حلًا لـ«(.*)» وكانت الإجابة «'))[1] as base_question,
    (regexp_match(question_text, 'وكانت الإجابة «(.*)»\. أي حكم صحيح؟$'))[1] as proposed_answer
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'math'
    and cognitive_level = 'reasoning'
    and question_text ~ 'حلًا لـ«.*» وكانت الإجابة «.*»\. أي حكم صحيح؟$'
), revised as (
  select id,
    'في ' || setting || '، ' ||
    (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'راجعت ' else 'راجع ' end) ||
    actor || ' حل المسألة الآتية: «' || base_question ||
    '» وكانت الإجابة المقترحة «' || proposed_answer || '». ما الحكم الصحيح على الحل؟' as question_text
  from src
)
update public.nafes_question_bank q
set question_text = revised.question_text
from revised
where q.id = revised.id;

-- Science knowledge: preserve five distinct, correct phrasings for generic concepts.
with src as (
  select id, question_no,
    (regexp_match(question_text, '^في ([^،]+)،'))[1] as setting,
    (regexp_match(question_text, '^في [^،]+، راجع ([^.]+) المفهوم'))[1] as actor,
    trim(regexp_replace(
      split_part(regexp_replace(indicator_text, '[.؛]+$', '', 'g'), '،', 1),
      '^(يستنتج|يوضح|يحدد|يميز|يصف|يشرح|يعرف|يقارن|يحسب|يحل|يذكر|يتعرف|يفسر|يطبق|يعدد|يقترح|يقدم|يعلل|يصنف|ينظم|يحلل|يتنبأ|يستوعب)[[:space:]]+',
      '', 'i'
    )) as target
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'science'
    and cognitive_level = 'knowledge'
    and question_text like '%أي عبارة علمية صحيحة ترتبط مباشرة بـ«%'
), revised as (
  select id,
    'في ' || setting || '، ' ||
    case question_no
      when 1 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'راجعت ' else 'راجع ' end) || actor || ' مفهوم «' || target || '». ما العبارة العلمية الصحيحة التي تشرحه؟'
      when 2 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'درست ' else 'درس ' end) || actor || ' مفهوم «' || target || '». أي الخيارات الآتية يتفق معه؟'
      when 3 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'ناقشت ' else 'ناقش ' end) || actor || ' مفهوم «' || target || '». اختر الوصف العلمي الأدق.'
      when 4 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'استعرضت ' else 'استعرض ' end) || actor || ' مفهوم «' || target || '». أي العبارات الآتية تعبّر عن فهم صحيح له؟'
      else (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'بحثت ' else 'بحث ' end) || actor || ' في مفهوم «' || target || '». أي المعلومات الآتية ترتبط به مباشرة؟'
    end as question_text
  from src
)
update public.nafes_question_bank q
set question_text = revised.question_text
from revised
where q.id = revised.id;

-- Science knowledge: remove redundant question-within-question wrappers.
with src as (
  select id, question_no,
    (regexp_match(question_text, '^في ([^،]+)،'))[1] as setting,
    (regexp_match(question_text, '^في [^،]+، راجع ([^.]+) المفهوم'))[1] as actor,
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(question_text, '^في [^،]+، راجع [^.]+ المفهوم\. ', ''),
              '^أي إجابة علمية صحيحة عن السؤال الآتي: ', ''
            ),
            '^أي اختيار يعبّر عن المعرفة العلمية الصحيحة؟ ', ''
          ),
          '^اختر الوصف الأدق علميًا: ', ''
        ),
        '^ما الإجابة التي تتفق مع مفهوم «[^»]+»؟ ', ''
      ),
      '^عند مراجعة مفهوم «[^»]+»، ', ''
    ) as base_question
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'science'
    and cognitive_level = 'knowledge'
    and question_text not like '%أي عبارة علمية صحيحة ترتبط مباشرة بـ«%'
    and question_text ~ '^في [^،]+، راجع [^.]+ المفهوم\.'
), revised as (
  select id,
    'في ' || setting || '، ' ||
    case question_no
      when 1 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'أجابت ' else 'أجاب ' end) || actor || ' عن السؤال العلمي الآتي: '
      when 2 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'راجعت ' else 'راجع ' end) || actor || ' السؤال الآتي بحثًا عن الإجابة الصحيحة: '
      when 3 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'بحثت ' else 'بحث ' end) || actor || ' عن الوصف العلمي الأدق في السؤال الآتي: '
      when 4 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'حلّلت ' else 'حلّل ' end) || actor || ' الموقف العلمي الآتي: '
      else (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'طبّقت ' else 'طبّق ' end) || actor || ' المفهوم المناسب للإجابة عن السؤال الآتي: '
    end || base_question as question_text
  from src
)
update public.nafes_question_bank q
set question_text = revised.question_text
from revised
where q.id = revised.id;

-- Science application: use concise, varied stems without gender-agreement errors.
with src as (
  select id, question_no,
    (regexp_match(question_text, '^في ([^،]+)،'))[1] as setting,
    (regexp_match(question_text, '^في [^،]+، طبّق ([^.]+) المفهوم'))[1] as actor,
    trim(regexp_replace(
      split_part(regexp_replace(indicator_text, '[.؛]+$', '', 'g'), '،', 1),
      '^(يستنتج|يوضح|يحدد|يميز|يصف|يشرح|يعرف|يقارن|يحسب|يحل|يذكر|يتعرف|يفسر|يطبق|يعدد|يقترح|يقدم|يعلل|يصنف|ينظم|يحلل|يتنبأ|يستوعب)[[:space:]]+',
      '', 'i'
    )) as target
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'science'
    and cognitive_level = 'application'
    and question_text like '%أي استنتاج يطبّق مفهوم «%'
), revised as (
  select id,
    'في ' || setting || '، ' ||
    case question_no
      when 6 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'طبّقت ' else 'طبّق ' end) || actor || ' مفهوم «' || target || '». أي الاستنتاجات الآتية صحيح؟'
      when 7 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'استخدمت ' else 'استخدم ' end) || actor || ' مفهوم «' || target || '». أي الخيارات الآتية يتفق معه؟'
      when 8 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'نقلت ' else 'نقل ' end) || actor || ' مفهوم «' || target || '» إلى موقف جديد. اختر التطبيق الصحيح.'
      when 9 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'ربطت ' else 'ربط ' end) || actor || ' موقفًا جديدًا بمفهوم «' || target || '». أي استنتاج علمي صحيح؟'
      else (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'وظّفت ' else 'وظّف ' end) || actor || ' مفهوم «' || target || '». أي العبارات الآتية تمثل توظيفًا صحيحًا له؟'
    end as question_text
  from src
)
update public.nafes_question_bank q
set question_text = revised.question_text
from revised
where q.id = revised.id;

with src as (
  select id, question_no,
    (regexp_match(question_text, '^في ([^،]+)،'))[1] as setting,
    (regexp_match(question_text, '^في [^،]+، طبّق ([^.]+) المفهوم'))[1] as actor,
    regexp_replace(question_text, '^في [^،]+، طبّق [^.]+ المفهوم على موقف جديد\. ', '') as base_question
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'science'
    and cognitive_level = 'application'
    and question_text not like '%أي استنتاج يطبّق مفهوم «%'
    and question_text ~ '^في [^،]+، طبّق [^.]+ المفهوم على موقف جديد\.'
), revised as (
  select id,
    'في ' || setting || '، ' ||
    case question_no
      when 6 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'طبّقت ' else 'طبّق ' end) || actor || ' المفهوم العلمي في الموقف الآتي: '
      when 7 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'استخدمت ' else 'استخدم ' end) || actor || ' المفهوم العلمي للإجابة عن السؤال الآتي: '
      when 8 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'حلّلت ' else 'حلّل ' end) || actor || ' الموقف العلمي الآتي: '
      when 9 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'درست ' else 'درس ' end) || actor || ' الموقف التطبيقي الآتي: '
      else (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'طبّقت ' else 'طبّق ' end) || actor || ' المفهوم المناسب على الموقف الآتي: '
    end || base_question as question_text
  from src
)
update public.nafes_question_bank q
set question_text = revised.question_text
from revised
where q.id = revised.id;

-- Science reasoning: remove nested quotation marks and use "answer" rather than "solution".
with src as (
  select id, question_no,
    (regexp_match(question_text, '^في ([^،]+)،'))[1] as setting,
    (regexp_match(question_text, '^في [^،]+، راجع ([^ ]+) حلًا'))[1] as actor,
    trim(regexp_replace(
      split_part(regexp_replace(indicator_text, '[.؛]+$', '', 'g'), '،', 1),
      '^(يستنتج|يوضح|يحدد|يميز|يصف|يشرح|يعرف|يقارن|يحسب|يحل|يذكر|يتعرف|يفسر|يطبق|يعدد|يقترح|يقدم|يعلل|يصنف|ينظم|يحلل|يتنبأ|يستوعب)[[:space:]]+',
      '', 'i'
    )) as target,
    (regexp_match(question_text, 'وكانت الإجابة «(.*)»\. أي حكم صحيح؟$'))[1] as proposed_answer
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'science'
    and cognitive_level = 'reasoning'
    and question_text like '%الموقف المرتبط بمفهوم%'
), revised as (
  select id,
    'في ' || setting || '، ' ||
    case question_no
      when 11 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'قوّمت ' else 'قوّم ' end) || actor || ' إجابة عن مفهوم «' || target || '»، وكانت «' || proposed_answer || '». ما التقويم العلمي الصحيح؟'
      when 12 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'راجعت ' else 'راجع ' end) || actor || ' إجابة عن موقف يتصل بمفهوم «' || target || '»، ونصها «' || proposed_answer || '». أي حكم علمي عليها صحيح؟'
      when 13 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'فحصت ' else 'فحص ' end) || actor || ' الإجابة «' || proposed_answer || '» عن مفهوم «' || target || '». ما الحكم الصحيح؟'
      when 14 then (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'حلّلت ' else 'حلّل ' end) || actor || ' إجابة عن مفهوم «' || target || '» نصها «' || proposed_answer || '». ما التصحيح المناسب؟'
      else (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'قارنت ' else 'قارن ' end) || actor || ' الإجابة «' || proposed_answer || '» بمفهوم «' || target || '». اختر التقويم الصحيح.'
    end as question_text
  from src
)
update public.nafes_question_bank q
set question_text = revised.question_text
from revised
where q.id = revised.id;

with src as (
  select id,
    (regexp_match(question_text, '^في ([^،]+)،'))[1] as setting,
    (regexp_match(question_text, '^في [^،]+، راجع ([^ ]+) حلًا'))[1] as actor,
    (regexp_match(question_text, 'حلًا لـ«(.*)» وكانت الإجابة «'))[1] as base_question,
    (regexp_match(question_text, 'وكانت الإجابة «(.*)»\. أي حكم صحيح؟$'))[1] as proposed_answer
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'science'
    and cognitive_level = 'reasoning'
    and question_text not like '%الموقف المرتبط بمفهوم%'
    and question_text ~ 'حلًا لـ«.*» وكانت الإجابة «.*»\. أي حكم صحيح؟$'
), revised as (
  select id,
    'في ' || setting || '، ' ||
    (case when actor ~ '^(نورة|هيا|ريم|سارة|ليان|جود)$' then 'راجعت ' else 'راجع ' end) ||
    actor || ' الإجابة عن السؤال الآتي: «' || base_question ||
    '» وكانت الإجابة المقترحة «' || proposed_answer || '». ما التقويم العلمي الصحيح؟' as question_text
  from src
)
update public.nafes_question_bank q
set question_text = revised.question_text
from revised
where q.id = revised.id;

-- Turn indicator fragments used as concept labels into grammatical noun phrases.
with targets as (
  select id,
    (regexp_match(question_text, 'مفهوم «([^»]+)»'))[1] as old_target,
    indicator_text
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and subject_key = 'science'
    and question_text ~ 'مفهوم «[^»]+»'
), revised as (
  select id, old_target,
    regexp_replace(
      case
        when old_target = 'بالأمراض الناتجة عن خلل في عمل الأعضاء والأجهزة في جسم الإنسان'
          then 'الأمراض الناتجة عن خلل في أعضاء جسم الإنسان وأجهزته'
        when old_target = 'حلولًا ووسائل للوقاية من الأخطار الطبيعية'
          then 'وسائل الوقاية من الأخطار الطبيعية'
        when old_target = 'على موقع العناصر الممثلة'
          then 'مواقع العناصر الممثلة والانتقالية في الجدول الدوري'
        when old_target = 'على وحدة بناء أجسام المخلوقات الحية'
          then 'الخلية بوصفها وحدة بناء أجسام المخلوقات الحية'
        when old_target = 'كيف تتفاعل وتتكامل الأجهزة معًا في المحافظة على صحة وسلامة اتزان الجسم'
          then 'تكامل أجهزة الجسم في المحافظة على صحته واتزانه'
        when old_target = 'كيف يتم تدوير المادة وتدفق الطاقة بين المكونات الحيوية وغير الحيوية في الشبكات الغذائية في النظام البيئي'
          then 'دوران المادة وتدفق الطاقة بين مكونات الشبكات الغذائية'
        when old_target = 'ما يترتب على انقراض أنواع معينة من المخلوقات الحية وأثره على التنوع الحيوي في المملكة العربية السعودية'
          then 'آثار انقراض بعض المخلوقات الحية على التنوع الحيوي في المملكة العربية السعودية'
        when old_target = 'يتوقع الآثار والمتغيرات الناتجة عن الاعتماد الكلي على مصادر الطاقة غير المتجددة'
          then 'آثار الاعتماد الكلي على مصادر الطاقة غير المتجددة'
        when old_target = 'يفرق بين الجينات المتماثلة والجينات غير المتماثلة'
          then 'الفرق بين الجينات المتماثلة وغير المتماثلة'
        when old_target like 'بين %' and indicator_text like 'يقارن بين %'
          then 'المقارنة بين ' || substring(old_target from 5)
        when old_target like 'بين %' and indicator_text like 'يميز بين %'
          then 'التمييز بين ' || substring(old_target from 5)
        else old_target
      end,
      '[[:space:]]+(ويوضح|ويحدد|ويقدم|ويفسرها|ويصنفها)([[:space:]].*)?$',
      '', 'g'
    ) as new_target
  from targets
)
update public.nafes_question_bank q
set question_text = replace(q.question_text,
  'مفهوم «' || revised.old_target || '»',
  'مفهوم «' || revised.new_target || '»')
from revised
where q.id = revised.id
  and revised.old_target <> revised.new_target;

-- Use consistent Arabic mathematical typography and a currency abbreviation that
-- avoids incorrect counted-noun agreement after numerals.
update public.nafes_question_bank
set question_text =
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      replace(question_text, '%', '٪'),
                      '(-?[0-9]+),[[:space:]]*(-?[0-9]+)', E'\\1، \\2', 'g'
                    ),
                    '([0-9])،[[:space:]]*([+-]?[0-9])', E'\\1، \\2', 'g'
                  ),
                  '[[:space:]]+،[[:space:]]*', '، ', 'g'
                ),
                '([0-9]+)[[:space:]]+(ريالًا|ريالات|ريالين|ريالان|ريال)', E'\\1 ر.س', 'g'
              ),
              '2 أرطال', 'رطلين', 'g'
            ),
            '2 جالونات', 'جالونين', 'g'
          ),
          '2 ساعات', 'ساعتين', 'g'
        ),
        '2 وحدات', 'وحدتين', 'g'
      ),
      '2 ياردات', 'ياردتين', 'g'
    ),
    '2 ثوانٍ', 'ثانيتين', 'g'
  )
where grade_key = 'middle_3'
  and review_status = 'approved'
  and is_active
  and subject_key in ('math', 'science');

update public.nafes_question_bank
set question_text = regexp_replace(
    regexp_replace(question_text, '(^|[ «:])حلل([ :])', E'\\1حلّل\\2', 'g'),
    '(^|[ «:])بسط([ :])', E'\\1بسّط\\2', 'g'
  )
where grade_key = 'middle_3'
  and review_status = 'approved'
  and is_active
  and subject_key = 'math'
  and (question_text ~ '(^|[ «:])حلل([ :])'
    or question_text ~ '(^|[ «:])بسط([ :])');

update public.nafes_question_bank
set question_text = replace(question_text, 'مقداره وحدتين', 'مقداره وحدتان')
where grade_key = 'middle_3'
  and review_status = 'approved'
  and is_active
  and subject_key = 'math'
  and question_text like '%مقداره وحدتين%';

-- Numerals from 11 to 99 take a singular counted noun.
update public.nafes_question_bank
set question_text =
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(question_text, '((1[1-9])|([2-9][0-9])) وحدات', E'\\1 وحدةً', 'g'),
            '((1[1-9])|([2-9][0-9])) درجات', E'\\1 درجةً', 'g'
          ),
          '((1[1-9])|([2-9][0-9])) أرطال', E'\\1 رطلًا', 'g'
        ),
        '((1[1-9])|([2-9][0-9])) جالونات', E'\\1 جالونًا', 'g'
      ),
      '((1[1-9])|([2-9][0-9])) ساعات', E'\\1 ساعةً', 'g'
    ),
    '((1[1-9])|([2-9][0-9])) ياردات', E'\\1 ياردةً', 'g'
  )
where grade_key = 'middle_3'
  and review_status = 'approved'
  and is_active
  and subject_key = 'math';

update public.nafes_question_bank
set question_text = regexp_replace(
  question_text,
  '((1[1-9])|([2-9][0-9])) تذاكر',
  E'\\1 تذكرةً',
  'g'
)
where grade_key = 'middle_3'
  and review_status = 'approved'
  and is_active
  and subject_key = 'math';

-- Normalize punctuation inside options as well.
with normalized as (
  select q.id,
    jsonb_agg(
      to_jsonb(
        regexp_replace(
          regexp_replace(
            regexp_replace(replace(o.value, '%', '٪'),
              '(-?[0-9]+),[[:space:]]*(-?[0-9]+)', E'\\1، \\2', 'g'),
            '([0-9])،[[:space:]]*([+-]?[0-9])', E'\\1، \\2', 'g'),
          '[[:space:]]+،[[:space:]]*', '، ', 'g'
        )
      ) order by o.ordinality
    ) as options
  from public.nafes_question_bank q
  cross join lateral jsonb_array_elements_text(q.options) with ordinality as o(value, ordinality)
  where q.grade_key = 'middle_3'
    and q.review_status = 'approved'
    and q.is_active
    and q.subject_key in ('math', 'science')
  group by q.id
)
update public.nafes_question_bank q
set options = normalized.options
from normalized
where q.id = normalized.id;

-- Science option wording should evaluate an answer, not a mathematical solution.
with normalized as (
  select q.id,
    jsonb_agg(
      to_jsonb(
        regexp_replace(
          regexp_replace(
            replace(o.value,
              'لا يمكن الحكم على الحل مع أن معطيات السؤال مكتملة.',
              'لا يمكن الحكم على الإجابة مع اكتمال معطيات السؤال.'
            ),
            '^الحل غير صحيح؛ الإجابة الصحيحة «(.*)»\.$',
            E'الإجابة غير صحيحة؛ والصحيح هو «\\1».'
          ),
          '^الحل صحيح؛ الإجابة «(.*)» توافق المعطيات\.$',
          E'الإجابة «\\1» صحيحة وتتفق مع المعطيات.'
        )
      ) order by o.ordinality
    ) as options
  from public.nafes_question_bank q
  cross join lateral jsonb_array_elements_text(q.options) with ordinality as o(value, ordinality)
  where q.grade_key = 'middle_3'
    and q.review_status = 'approved'
    and q.is_active
    and q.subject_key = 'science'
    and q.cognitive_level = 'reasoning'
  group by q.id
)
update public.nafes_question_bank q
set options = normalized.options,
    explanation = replace(
      replace(q.explanation, 'الحل المقترح', 'الإجابة المقترحة'),
      'الإجابة المقترحة لا يوافق', 'الإجابة المقترحة لا توافق'
    )
from normalized
where q.id = normalized.id;

update public.nafes_question_bank
set context_text = replace(context_text, '%', '٪'),
    explanation = replace(explanation, '%', '٪')
where grade_key = 'middle_3'
  and review_status = 'approved'
  and is_active
  and subject_key = 'math'
  and (strpos(coalesce(context_text, ''), '%') > 0
    or strpos(coalesce(explanation, ''), '%') > 0);

-- Round machine-generated floating-point artifacts to a student-readable value.
with src as (
  select id,
    (regexp_match(question_text, '([0-9]+\.[0-9]{5,})'))[1] as old_number
  from public.nafes_question_bank
  where grade_key = 'middle_3'
    and review_status = 'approved'
    and is_active
    and question_text ~ '[0-9]+\.[0-9]{5,}'
), revised as (
  select id, old_number,
    rtrim(rtrim(round(old_number::numeric, 2)::text, '0'), '.') as new_number
  from src
)
update public.nafes_question_bank q
set question_text = replace(q.question_text, revised.old_number, revised.new_number)
from revised
where q.id = revised.id;

with normalized as (
  select q.id,
    jsonb_agg(to_jsonb(
      case when o.value ~ '[0-9]+\.[0-9]{5,}' then
        replace(
          o.value,
          (regexp_match(o.value, '([0-9]+\.[0-9]{5,})'))[1],
          rtrim(rtrim(round(((regexp_match(o.value, '([0-9]+\.[0-9]{5,})'))[1])::numeric, 2)::text, '0'), '.')
        )
      else o.value end
    ) order by o.ordinality) as options
  from public.nafes_question_bank q
  cross join lateral jsonb_array_elements_text(q.options) with ordinality as o(value, ordinality)
  where q.grade_key = 'middle_3'
    and q.review_status = 'approved'
    and q.is_active
  group by q.id
)
update public.nafes_question_bank q
set options = normalized.options
from normalized
where q.id = normalized.id;

update public.nafes_question_bank
set explanation = replace(
  explanation,
  (regexp_match(explanation, '([0-9]+\.[0-9]{5,})'))[1],
  rtrim(rtrim(round(((regexp_match(explanation, '([0-9]+\.[0-9]{5,})'))[1])::numeric, 2)::text, '0'), '.')
)
where grade_key = 'middle_3'
  and review_status = 'approved'
  and is_active
  and explanation ~ '[0-9]+\.[0-9]{5,}';

commit;

-- Post-change language-quality checks. Every count should be zero.
with bank as (
  select q.*,
    concat_ws(E'\n', q.question_text, q.context_text, q.explanation,
      (select string_agg(v, E'\n') from jsonb_array_elements_text(q.options) v)
    ) as all_text
  from public.nafes_question_bank q
  where q.grade_key = 'middle_3'
    and q.review_status = 'approved'
    and q.is_active
)
select
  count(*) filter (where question_text ~ '(سأل|راجع|طبّق) (نورة|هيا|ريم|سارة|ليان|جود)')::int as gender_agreement_errors,
  count(*) filter (where question_text ~ 'أي إجابة علمية صحيحة عن السؤال الآتي: أي|ما الإجابة التي تتفق.+؟ أي|أي اختيار يعبّر.+؟ أي')::int as redundant_science_stems,
  count(*) filter (where question_text like '%الموقف المرتبط بمفهوم%')::int as nested_science_stems,
  count(*) filter (where strpos(all_text, '%') > 0)::int as english_percent_signs,
  count(*) filter (where all_text ~ '[[:space:]]+،')::int as spaces_before_arabic_comma,
  count(*) filter (where all_text ~ '(-?[0-9]+),[[:space:]]*(-?[0-9]+)')::int as english_coordinate_commas,
  count(*) filter (where question_text ~ '2 (أرطال|جالونات|ساعات|وحدات|ياردات|ثوانٍ)')::int as dual_noun_errors,
  count(*) filter (where question_text ~ '((1[1-9])|([2-9][0-9])) (وحدات|درجات|أرطال|جالونات|ساعات|ياردات|تذاكر|ريالات)')::int as counted_noun_errors
from bank;
