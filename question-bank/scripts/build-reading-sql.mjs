import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../reading');
const [outcome,indicatorArg,...modelArgs]=process.argv.slice(2);
const indicator=Number(indicatorArg);
const models=modelArgs.length?modelArgs.map(Number):[1,2,3,4];
if(!outcome||!Number.isInteger(indicator)||models.some(x=>!Number.isInteger(x)||x<1||x>4)){
 console.error('usage: node build-reading-sql.mjs OUTCOME INDICATOR [MODEL ...]');
 process.exit(2);
}
const docs=models.map(model=>{
 const file=path.join(dir,`${outcome}-i${indicator}-m${model}.json`);
 if(!fs.existsSync(file))throw new Error(`missing ${file}`);
 return JSON.parse(fs.readFileSync(file,'utf8'));
});
const payload=JSON.stringify(docs);
if(payload.includes('$reading_bank$'))throw new Error('unsafe dollar quote in payload');
process.stdout.write(`
begin;

-- Move the current rows to unique temporary content inside this transaction.
-- This preserves row IDs (and therefore old attempt references) while avoiding
-- transient unique-index collisions when questions change positions.
update public.nafes_question_bank
set
  context_text = '[staging-' || id::text || ']',
  question_text = '[staging-' || id::text || ']'
where grade_key = '${docs[0].grade_key}'
  and subject_key = '${docs[0].subject_key}'
  and outcome_code = '${docs[0].outcome_code}'
  and indicator_index = ${docs[0].indicator_index}
  and model_no = any(array[${models.join(',')}]::smallint[])
  and review_status = 'approved'
  and is_active = true;

with docs as (
  select value as doc
  from jsonb_array_elements($reading_bank$${payload}$reading_bank$::jsonb)
), prepared as (
  select
    d.doc,
    q.question_no,
    q.question_text,
    q.options,
    q.correct_index,
    q.explanation,
    q.difficulty,
    q.cognitive_level
  from docs d
  cross join lateral jsonb_to_recordset(d.doc->'questions') as q(
    question_no integer,
    question_text text,
    options jsonb,
    correct_index integer,
    explanation text,
    difficulty text,
    cognitive_level text
  )
), updated as (
  update public.nafes_question_bank b
  set
    indicator_text = p.doc->>'indicator_text',
    context_text = p.doc->>'context_text',
    question_text = p.question_text,
    options = p.options,
    correct_index = p.correct_index,
    explanation = p.explanation,
    difficulty = p.difficulty,
    cognitive_level = p.cognitive_level,
    source_note = 'بنك القراءة: ' || (p.doc->>'title') || ' · ' || coalesce(p.doc->>'text_profile','hand_reviewed'),
    reviewed_at = now(),
    reviewer_note = 'اجتاز فحص المطابقة الدلالية للمؤشر، وعدد الأسئلة، ونوع النص، والطول، والتفرد، والبدائل، وتوزيع الإجابات، ومستويات المعرفة والتطبيق والاستدلال.',
    updated_at = now()
  from prepared p
  where b.grade_key = p.doc->>'grade_key'
    and b.subject_key = p.doc->>'subject_key'
    and b.outcome_code = p.doc->>'outcome_code'
    and b.indicator_index = (p.doc->>'indicator_index')::integer
    and b.model_no = (p.doc->>'model_no')::smallint
    and b.question_no = p.question_no::smallint
    and b.review_status = 'approved'
    and b.is_active = true
  returning b.model_no, b.question_no
), inserted as (
  insert into public.nafes_question_bank (
    grade_key, subject_key, outcome_code, indicator_index, indicator_text,
    context_text, question_text, options, correct_index, explanation,
    difficulty, cognitive_level, review_status, source_note,
    model_no, question_no, is_active, reviewed_at, reviewer_note
  )
  select
    doc->>'grade_key',
    doc->>'subject_key',
    doc->>'outcome_code',
    (doc->>'indicator_index')::integer,
    doc->>'indicator_text',
    doc->>'context_text',
    question_text,
    options,
    correct_index,
    explanation,
    difficulty,
    cognitive_level,
    'approved',
    'بنك القراءة: ' || (doc->>'title') || ' · ' || coalesce(doc->>'text_profile','hand_reviewed'),
    (doc->>'model_no')::smallint,
    question_no::smallint,
    true,
    now(),
    'اجتاز فحص المطابقة الدلالية للمؤشر، وعدد الأسئلة، ونوع النص، والطول، والتفرد، والبدائل، وتوزيع الإجابات، ومستويات المعرفة والتطبيق والاستدلال.'
  from prepared
  on conflict do nothing
  returning model_no, question_no
)
select
  (select count(*)::int from updated) as updated_rows,
  (select count(distinct model_no)::int from updated) as updated_models,
  (select count(*)::int from inserted) as inserted_rows,
  (select count(distinct model_no)::int from inserted) as inserted_models;

commit;
`);
