import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {classify} from '../../nafes-factory.mjs';

const subject=process.argv[2];
if(!['math','science'].includes(subject)){
 console.error('usage: node audit-stem-bank.mjs math|science');
 process.exit(2);
}
const expectedTotals={math:{indicators:95,models:380,questions:5700},science:{indicators:159,models:636,questions:9540}}[subject];
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sourceFile=subject==='math'?'nafes-math.js':'nafes-science.js';
const globalName=subject==='math'?'NAFES_MATH':'NAFES_SCIENCE';
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,sourceFile),'utf8'),sandbox);
const data=sandbox.window[globalName];
const expected=new Map();
for(const outcome of data.outcomes)outcome.indicators.forEach((text,i)=>expected.set(`${outcome.code}|${i+1}`,{text,profile:classify(subject,text),focus:`${subject}:${outcome.code}:i${i+1}`}));
const dir=path.join(root,'question-bank',subject);
const files=fs.readdirSync(dir).filter(x=>/^\d+-\d+-\d+-\d+-\d+-i\d+-m\d+\.json$/.test(x));
const errors=[],modelKeys=new Set(),indicatorKeys=new Set(),contentByIndicator=new Map();
let questions=0;
for(const file of files){
 const doc=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
 const indicatorKey=`${doc.outcome_code}|${doc.indicator_index}`;
 const modelKey=`${indicatorKey}|${doc.model_no}`;
 const exp=expected.get(indicatorKey);
 if(!exp)errors.push(`${file}: unknown indicator`); else {
 if(doc.indicator_text!==exp.text)errors.push(`${file}: indicator text mismatch`);
  if(doc.grade_key!=='middle_3')errors.push(`${file}: grade mismatch`);
  if(doc.text_profile!==exp.profile||doc.text_profile.endsWith('_general'))errors.push(`${file}: profile mismatch`);
  if(doc.measurement_focus!==exp.focus)errors.push(`${file}: focus mismatch`);
 }
 if(modelKeys.has(modelKey))errors.push(`${file}: duplicate model`);modelKeys.add(modelKey);indicatorKeys.add(indicatorKey);
 if(doc.questions.length!==15)errors.push(`${file}: question count`);
 const answers=[0,0,0,0],levels=new Set(),positions=[];
 if(!contentByIndicator.has(indicatorKey))contentByIndicator.set(indicatorKey,new Set());
 const contents=contentByIndicator.get(indicatorKey);
 for(const q of doc.questions){
  questions++;positions.push(q.question_no);levels.add(q.cognitive_level);
  if(q.measurement_focus!==exp?.focus)errors.push(`${file} q${q.question_no}: focus`);
  if(q.options.length!==4||new Set(q.options).size!==4)errors.push(`${file} q${q.question_no}: options`);
  if(!Number.isInteger(q.correct_index)||q.correct_index<0||q.correct_index>3)errors.push(`${file} q${q.question_no}: key`);else answers[q.correct_index]++;
  if(!q.explanation?.trim())errors.push(`${file} q${q.question_no}: explanation`);
  const expectedLevel=q.question_no<=5?'knowledge':q.question_no<=10?'application':'reasoning';
  const expectedDifficulty=expectedLevel==='knowledge'?'easy':expectedLevel==='application'?'medium':'hard';
  if(q.cognitive_level!==expectedLevel||q.difficulty!==expectedDifficulty)errors.push(`${file} q${q.question_no}: cognitive level`);
  if(expectedLevel==='knowledge'&&!q.question_text.startsWith('أي قاعدة أو حقيقة أساسية'))errors.push(`${file} q${q.question_no}: knowledge task`);
  if(expectedLevel==='knowledge'&&/ترتبط بالمفهوم المحدد|تتفق مع المفهوم|الوارد في المؤشر/.test(q.options[q.correct_index]))errors.push(`${file} q${q.question_no}: generic knowledge answer`);
  if(expectedLevel==='reasoning'&&!q.question_text.startsWith('اقترح طالب الإجابة'))errors.push(`${file} q${q.question_no}: reasoning task`);
  if(subject==='science'&&['أي عبارة علمية صحيحة؟','أي تفسير ينسجم أكثر مع هذا المؤشر؟','في موقف تطبيقي مرتبط بهذا المفهوم، أي استنتاج هو الأدق؟','أي اختيار يمثل الفهم العلمي الصحيح للمفهوم؟'].includes(q.question_text))errors.push(`${file} q${q.question_no}: generic science stem`);
  const content=`${q.context_text||''}\u001f${q.question_text}`;
  if(contents.has(content))errors.push(`${file} q${q.question_no}: repeated content`);contents.add(content);
 }
 if(positions.some((x,i)=>x!==i+1))errors.push(`${file}: positions`);
 if(answers.join(',')!=='4,4,4,3')errors.push(`${file}: answer distribution ${answers.join(',')}`);
 if(!['knowledge','application','reasoning'].every(x=>levels.has(x)))errors.push(`${file}: levels`);
}
if(indicatorKeys.size!==expectedTotals.indicators)errors.push(`indicators ${indicatorKeys.size}/${expectedTotals.indicators}`);
if(files.length!==expectedTotals.models)errors.push(`models ${files.length}/${expectedTotals.models}`);
if(questions!==expectedTotals.questions)errors.push(`questions ${questions}/${expectedTotals.questions}`);
if(errors.length){console.error(errors.slice(0,200).join('\n'));console.error(`errors=${errors.length}`);process.exit(1);}
console.log(JSON.stringify({subject,indicators:indicatorKeys.size,models:files.length,questions,wrong_indicator_links:0,wrong_measurement_profiles:0,incomplete_models:0,duplicate_content:0,answer_rule:'4-4-4-3',levels:['knowledge','application','reasoning']},null,2));
