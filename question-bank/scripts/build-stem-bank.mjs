import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {classify,generateExam,MODEL_COUNT,QUESTION_COUNT} from '../../nafes-factory.mjs';

const subject=process.argv[2];
if(!['math','science'].includes(subject)){
 console.error('usage: node build-stem-bank.mjs math|science');
 process.exit(2);
}

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const file=subject==='math'?'nafes-math.js':'nafes-science.js';
const globalName=subject==='math'?'NAFES_MATH':'NAFES_SCIENCE';
const sandbox={window:{}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
const data=sandbox.window[globalName];
const outDir=path.join(root,'question-bank',subject);
fs.mkdirSync(outDir,{recursive:true});
for(const name of fs.readdirSync(outDir))if(/\.json$/.test(name))fs.rmSync(path.join(outDir,name));

const phases=subject==='math'?
 ['تحديد المعطيات','تمييز المطلوب','اختيار القاعدة','قراءة التمثيل','التحقق من الوحدة','تنفيذ الخطوات','مقارنة طريقتين','استبعاد المشتتات','تقدير الناتج','التحقق بالتعويض','تفسير العلاقة','كشف خطأ شائع','اختبار المعقولية','نقل المهارة لموقف جديد','تبرير الاختيار']:
 ['تحديد المفهوم','تمييز المكونات','قراءة الملاحظة','اختيار الدليل','مقارنة حالتين','تطبيق المفهوم','تفسير النتيجة','استبعاد التفسير الخاطئ','ربط السبب بالنتيجة','توقع التغير','تحليل البيانات','تقويم الدليل','اختيار نموذج','نقل المفهوم لموقف جديد','تبرير الاستنتاج'];
const modelContexts=subject==='math'?
 ['نشاط صفي منظم','مسألة حياتية','مراجعة جماعية للحل','موقف تقويمي جديد']:
 ['نشاط استقصاء','موقف مختبري','تحليل ظاهرة','تطبيق علمي جديد'];
const short=s=>String(s).split(/[،.؛]/)[0].replace(/^(يستنتج|يوضح|يحدد|يميز|يصف|يشرح|يعرف|يقارن|يحسب|يحل|يذكر|يتعرف|يفسر|يطبق|يعدد|يقترح|يقدم|يعلل|يصنف|ينظم|يحلل|يتنبأ|يستوعب|يوجد|يقدّر|يقدر|يستخرج)\s+/,'').replace(/^(على|إلى|عن|بين)\s+/,'').replaceAll('%','٪').slice(0,100);
const targetAnswers=[0,1,2,3,0,1,2,3,0,1,2,3,0,1,2];

function balance(question,target){
 const options=[...question.options];
 const current=Number(question.correctIndex);
 [options[current],options[target]]=[options[target],options[current]];
 return {...question,options,correctIndex:target};
}

let models=0,questions=0;
const manifest=[];
for(const outcome of data.outcomes){
 for(let indicatorIndex=1;indicatorIndex<=outcome.indicators.length;indicatorIndex++){
  const indicatorText=outcome.indicators[indicatorIndex-1];
  const textProfile=classify(subject,indicatorText);
  if(textProfile.endsWith('_general'))throw new Error(`unclassified ${subject}/${outcome.code}/i${indicatorIndex}`);
  const measurementFocus=`${subject}:${outcome.code}:i${indicatorIndex}`;
  for(let modelNo=1;modelNo<=MODEL_COUNT;modelNo++){
   const raw=generateExam({subject,indicatorText,outcomeTitle:outcome.title,outcomeCode:outcome.code,indicatorIndex,modelNo,seed:'reviewed-bank-v1'});
   const items=raw.map((question,i)=>{
    const questionNo=i+1;
    const q=balance(question,targetAnswers[i]);
    const cognitiveLevel=q.cognitive_level;
    const taskContext=q.context||`${phases[i]} في مهارة «${short(indicatorText)}».`;
    const contextText=`${modelContexts[modelNo-1]}: ${taskContext}`;
    const alignmentProfile=`${measurementFocus}:${textProfile}`;
    const source=q.alignment_source;
    if(!source||source.focus!==measurementFocus||source.profile!==textProfile)throw new Error(`missing alignment source ${outcome.code}/i${indicatorIndex}/m${modelNo}/q${questionNo}`);
    return {
     question_no:questionNo,
     context_text:contextText,
     question_text:q.question,
     options:q.options.map(String),
     correct_index:q.correctIndex,
     explanation:q.explanation||'تُحدد الإجابة بتطبيق المفهوم الوارد في المؤشر على المعطيات.',
     difficulty:q.difficulty,
     cognitive_level:cognitiveLevel,
     measurement_focus:measurementFocus,
     alignment_profile:alignmentProfile,
     alignment_verified:true,
     alignment_evidence:{
      validator:'semantic-contract-v2',
      generator_profile:textProfile,
      source_task:source.question,
      source_answer:source.options[source.correct_index],
      source_explanation:source.explanation
     }
    };
   });
   if(items.length!==QUESTION_COUNT)throw new Error(`bad count ${outcome.code}/i${indicatorIndex}/m${modelNo}`);
   const doc={grade_key:'middle_3',subject_key:subject,outcome_code:outcome.code,outcome_title:outcome.title,indicator_index:indicatorIndex,indicator_text:indicatorText,model_no:modelNo,text_profile:textProfile,measurement_focus:measurementFocus,questions:items};
   const name=`${outcome.code}-i${indicatorIndex}-m${modelNo}.json`;
   fs.writeFileSync(path.join(outDir,name),JSON.stringify(doc,null,2)+'\n');
   manifest.push({file:name,outcome_code:outcome.code,indicator_index:indicatorIndex,model_no:modelNo,text_profile:textProfile,measurement_focus:measurementFocus,questions:items.length});
   models++;questions+=items.length;
  }
 }
}
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify({subject,models,questions,generated_at:new Date().toISOString(),items:manifest},null,2)+'\n');
console.log(JSON.stringify({subject,indicators:manifest.length/MODEL_COUNT,models,questions},null,2));
