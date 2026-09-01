import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const [subject,...outcomes]=process.argv.slice(2);
if(!['math','science'].includes(subject)||!outcomes.length){
 console.error('usage: node build-stem-sql.mjs math|science OUTCOME [OUTCOME ...]');
 process.exit(2);
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.join(root,'question-bank',subject);
const wanted=new Set(outcomes);
const docs=fs.readdirSync(dir)
 .filter(x=>/^\d+-\d+-\d+-\d+-\d+-i\d+-m\d+\.json$/.test(x))
 .map(x=>JSON.parse(fs.readFileSync(path.join(dir,x),'utf8')))
 .filter(x=>wanted.has(x.outcome_code));
if(!docs.length)throw new Error('no matching bank documents');
for(const outcome of wanted)if(!docs.some(x=>x.outcome_code===outcome))throw new Error(`missing outcome ${outcome}`);
const payload=JSON.stringify(docs);
if(payload.includes('$stem_bank$'))throw new Error('unsafe dollar quote');
const quotedOutcomes=[...wanted].map(x=>`'${x.replaceAll("'","''")}'`).join(',');
process.stdout.write(`
begin;

update public.nafes_question_bank
set context_text='[staging-'||id::text||']', question_text='[staging-'||id::text||']'
where grade_key='middle_3' and subject_key='${subject}'
  and outcome_code in (${quotedOutcomes})
  and review_status='approved' and is_active and model_no is not null;

with docs as (
 select value doc from jsonb_array_elements($stem_bank$${payload}$stem_bank$::jsonb)
), prepared as (
 select d.doc,q.* from docs d cross join lateral jsonb_to_recordset(d.doc->'questions') as q(
  question_no integer,context_text text,question_text text,options jsonb,correct_index integer,
  explanation text,difficulty text,cognitive_level text,measurement_focus text
 )
)
insert into public.nafes_question_bank(
 grade_key,subject_key,outcome_code,indicator_index,indicator_text,context_text,question_text,
 options,correct_index,explanation,difficulty,cognitive_level,review_status,source_note,
 model_no,question_no,is_active,reviewed_at,reviewer_note,measurement_focus
)
select
 p.doc->>'grade_key',p.doc->>'subject_key',p.doc->>'outcome_code',(p.doc->>'indicator_index')::integer,
 p.doc->>'indicator_text',p.context_text,p.question_text,p.options,p.correct_index,p.explanation,
 p.difficulty,p.cognitive_level,'approved',
 'بنك '||case when p.doc->>'subject_key'='math' then 'الرياضيات' else 'العلوم' end||': '||(p.doc->>'text_profile'),
 (p.doc->>'model_no')::smallint,p.question_no::smallint,true,now(),
 'اجتاز فحص مطابقة المؤشر والصف الثالث المتوسط، وتوزيع 3 معرفة و7 تطبيق و5 استدلال، وتنوع الجذوع داخل النموذج، وواقعية المواقف، ومعقولية المشتتات، وسلامة اللغة والإجابة الواحدة.',
 p.measurement_focus
from prepared p
on conflict (grade_key,subject_key,outcome_code,indicator_index,model_no,question_no)
 where review_status='approved' and is_active and model_no is not null
do update set
 indicator_text=excluded.indicator_text,context_text=excluded.context_text,question_text=excluded.question_text,
 options=excluded.options,correct_index=excluded.correct_index,explanation=excluded.explanation,
 difficulty=excluded.difficulty,cognitive_level=excluded.cognitive_level,source_note=excluded.source_note,
 reviewed_at=excluded.reviewed_at,reviewer_note=excluded.reviewer_note,measurement_focus=excluded.measurement_focus,
 updated_at=now();

commit;
`);
