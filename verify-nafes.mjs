import fs from 'node:fs';
import vm from 'node:vm';
import { generateExam, MODEL_COUNT, QUESTION_COUNT } from './nafes-factory.mjs';

const sandbox={window:{}};
vm.createContext(sandbox);
for(const file of ['nafes-reading.js','nafes-math.js','nafes-science.js']){
  vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),sandbox,{filename:file});
}

const subjects=[sandbox.window.NAFES_READING,sandbox.window.NAFES_MATH,sandbox.window.NAFES_SCIENCE];
let indicators=0;
let exams=0;
const failures=[];

for(const subject of subjects){
  for(const outcome of subject.outcomes){
    for(let indicatorIndex=1;indicatorIndex<=outcome.indicators.length;indicatorIndex++){
      indicators++;
      const ids=new Set();
      for(let modelNo=1;modelNo<=MODEL_COUNT;modelNo++){
        const questions=generateExam({
          subject:subject.key,
          indicatorText:outcome.indicators[indicatorIndex-1],
          outcomeTitle:outcome.title,
          outcomeCode:outcome.code,
          indicatorIndex,
          modelNo,
          seed:'verification'
        });
        exams++;
        if(questions.length!==QUESTION_COUNT)failures.push(`${subject.key}/${outcome.code}/${indicatorIndex}/${modelNo}: question count`);
        for(const question of questions){
          if(ids.has(question.id))failures.push(`${subject.key}/${outcome.code}/${indicatorIndex}: duplicate id`);
          ids.add(question.id);
          if(question.options.length!==4)failures.push(`${subject.key}/${outcome.code}/${indicatorIndex}/${modelNo}: options`);
          if(question.correctIndex<0||question.correctIndex>3)failures.push(`${subject.key}/${outcome.code}/${indicatorIndex}/${modelNo}: correct index`);
        }
      }
    }
  }
}

if(failures.length){
  console.error(failures.slice(0,20).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({subjects:subjects.length,indicators,models_per_indicator:MODEL_COUNT,questions_per_model:QUESTION_COUNT,exams,questions:exams*QUESTION_COUNT}));
