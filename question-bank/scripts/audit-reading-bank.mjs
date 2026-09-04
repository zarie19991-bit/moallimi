import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../reading');
const files=fs.readdirSync(dir).filter(x=>/^\d+-\d+-\d+-\d+-\d+-i\d+-m\d+\.json$/.test(x));
const docs=files.map(file=>({file,...JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'))}));
const errors=[];
const MODEL_COUNT=2;
const INDICATOR_COUNT=16;
const QUESTION_COUNT=15;
const modelKeys=new Set(),contextHashes=new Set(),questionKeys=new Set();
let questionCount=0;
const expectedProfiles={
 '1-1-1-2-9':['vocab_context','vocab_definition','vocab_classify','vocab_distinguish','vocab_use'],
 '2-1-1-2-9':['main_structure','implicit_questions','compare_texts','fact_opinion','relationships'],
 '3-1-1-2-9':['emotion_language','credibility_solutions','values_impact','arguments_evidence','summary_organize','problem_solving']
};
const banned=/^(المعنى المضاد لها|تفصيل لا علاقة له|اسم مكان ورد في النص|معنى حرفي لا يناسب السياق|عبارة |جملة |سلوك |تكرار عنوان النص)/;
const countWords=s=>String(s).trim().split(/\s+/).filter(Boolean).length;

for(const doc of docs){
 const modelKey=`${doc.outcome_code}|${doc.indicator_index}|${doc.model_no}`;
 if(modelKeys.has(modelKey))errors.push(`${doc.file}: duplicate model`);modelKeys.add(modelKey);
 const expectedProfile=expectedProfiles[doc.outcome_code]?.[doc.indicator_index-1];
 if(!expectedProfile||doc.text_profile!==expectedProfile)errors.push(`${doc.file}: profile ${doc.text_profile}/${expectedProfile}`);
 const hash=crypto.createHash('sha256').update(doc.context_text).digest('hex');
 if(contextHashes.has(hash))errors.push(`${doc.file}: duplicate context`);contextHashes.add(hash);
 if(doc.text_profile==='compare_texts'){
  const parts=doc.context_text.split(/\n\nــــــ\n\n/);
  if(parts.length!==2||parts.some(x=>countWords(x)<250||countWords(x)>350))errors.push(`${doc.file}: paired length`);
 }else{
  const words=countWords(doc.context_text);
  if(words<600||words>800)errors.push(`${doc.file}: context length ${words}`);
 }
 if(doc.questions.length!==15)errors.push(`${doc.file}: question count`);
 const answers=[0,0,0,0],levels=new Set(),positions=[];
 for(const q of doc.questions){
  questionCount++;positions.push(q.question_no);levels.add(q.cognitive_level);
  const questionKey=`${doc.outcome_code}|${doc.indicator_index}|${q.question_text}`;
  if(questionKeys.has(questionKey))errors.push(`${doc.file}: repeated stem`);questionKeys.add(questionKey);
  if(q.options.length!==4||new Set(q.options).size!==4)errors.push(`${doc.file} q${q.question_no}: options`);
  if(!Number.isInteger(q.correct_index)||q.correct_index<0||q.correct_index>3)errors.push(`${doc.file} q${q.question_no}: key`);else answers[q.correct_index]++;
  if(!q.explanation?.trim())errors.push(`${doc.file} q${q.question_no}: explanation`);
  const display=[doc.context_text||'',q.question_text,q.explanation||'',...q.options].join('\n');
  if(/%|\s+،|-?\d+,\s*-?\d+|\d+\.\d{3,}|(^|[ «:])(حلل|بسط)([ :])|تثبت المعرفة العلمية أن تنص/.test(display))errors.push(`${doc.file} q${q.question_no}: language quality`);
  if((display.match(/«/g)||[]).length!==(display.match(/»/g)||[]).length)errors.push(`${doc.file} q${q.question_no}: quotation balance`);
  const expectedDifficulty=q.cognitive_level==='knowledge'?'easy':q.cognitive_level==='application'?'medium':q.cognitive_level==='reasoning'?'hard':'';
  if(!expectedDifficulty||q.difficulty!==expectedDifficulty)errors.push(`${doc.file} q${q.question_no}: difficulty level`);
  if(q.measurement_focus!==expectedProfile)errors.push(`${doc.file} q${q.question_no}: measurement focus`);
  if(q.options.some(x=>banned.test(x)))errors.push(`${doc.file} q${q.question_no}: placeholder`);
  const correct=String(q.options[q.correct_index]||'').length;
  const wrong=q.options.filter((_,i)=>i!==q.correct_index).map(x=>String(x).length);
  if(wrong.length===3&&(correct>Math.max(...wrong)*2.2||correct<Math.min(...wrong)*.35))errors.push(`${doc.file} q${q.question_no}: option length bias`);
 }
 if(positions.some((x,i)=>x!==i+1))errors.push(`${doc.file}: positions`);
 if(Math.max(...answers)-Math.min(...answers)>1)errors.push(`${doc.file}: answer distribution`);
 if(!['knowledge','application','reasoning'].every(x=>levels.has(x)))errors.push(`${doc.file}: cognitive levels`);
 const levelCounts=doc.questions.reduce((a,q)=>(a[q.cognitive_level]=(a[q.cognitive_level]||0)+1,a),{});
 if(levelCounts.knowledge!==3||levelCounts.application!==7||levelCounts.reasoning!==5)errors.push(`${doc.file}: cognitive distribution`);
}

const expectedModels=INDICATOR_COUNT*MODEL_COUNT;
const expectedQuestions=expectedModels*QUESTION_COUNT;
if(docs.length!==expectedModels)errors.push(`models ${docs.length}/${expectedModels}`);
if(questionCount!==expectedQuestions)errors.push(`questions ${questionCount}/${expectedQuestions}`);
if(contextHashes.size!==expectedModels)errors.push(`contexts ${contextHashes.size}/${expectedModels}`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(JSON.stringify({models:docs.length,questions:questionCount,distinct_contexts:contextHashes.size,answer_rule:'4-4-4-3 per model',levels:['knowledge','application','reasoning']},null,2));
