import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {classify,generateExam,MODEL_COUNT,QUESTION_COUNT} from '../../nafes-factory.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const errors=[];
const normalize=value=>String(value||'')
 .normalize('NFKD')
 .replace(/[\u064B-\u065F\u0670]/g,'')
 .replace(/[أإآ]/g,'ا')
 .replace(/ة/g,'ه')
 .replace(/ى/g,'ي')
 .replace(/[^\p{L}\p{N}]+/gu,' ')
 .trim()
 .toLowerCase();
const stop=new Set('يستنتج يوضح يحدد يميز يصف يشرح يعرف يقارن يحسب يحل يذكر يتعرف يفسر يطبق يعدد يقترح يقدم يعلل يصنف ينظم يحلل يتنبأ يوجد يقدر في من على الى عن بين التي الذي هذا هذه ذلك مع كل ثم او كما بعض لها منه منها فيها فيه عند بعد قبل خلال اكثر اقل'.split(' '));
const concepts=value=>normalize(value).split(/\s+/)
 .map(token=>token.replace(/^بال/,'').replace(/^ال/,'').replace(/ها$/,''))
 .filter(token=>(token.length>=3||/[a-z]/.test(token))&&!stop.has(token));
const conceptOverlap=(indicator,evidence)=>{
 const a=concepts(indicator),b=concepts(evidence);
 return a.filter(x=>b.some(y=>x===y||(x.length>=3&&y.length>=3&&(x.includes(y)||y.includes(x)))));
};
const loadSource=subject=>{
 const sandbox={window:{}};
 vm.createContext(sandbox);
 const file=subject==='math'?'nafes-math.js':'nafes-science.js';
 const globalName=subject==='math'?'NAFES_MATH':'NAFES_SCIENCE';
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
 return sandbox.window[globalName];
};

const summary={};
for(const subject of ['math','science']){
 const data=loadSource(subject);
 const profiles=new Map();
 const sourcesByIndicator=new Map();
 const docsDir=path.join(root,'question-bank',subject);
 const docs=fs.readdirSync(docsDir).filter(name=>/^\d+-\d+-\d+-\d+-\d+-i\d+-m\d+\.json$/.test(name));
 const docsByKey=new Map(docs.map(name=>{
  const doc=JSON.parse(fs.readFileSync(path.join(docsDir,name),'utf8'));
  return [`${doc.outcome_code}|${doc.indicator_index}|${doc.model_no}`,{name,doc}];
 }));
 let indicators=0,questions=0;
 for(const outcome of data.outcomes){
  for(let indicatorIndex=1;indicatorIndex<=outcome.indicators.length;indicatorIndex++){
   indicators++;
   const indicatorText=outcome.indicators[indicatorIndex-1];
   const indicatorKey=`${outcome.code}|${indicatorIndex}`;
   const focus=`${subject}:${outcome.code}:i${indicatorIndex}`;
   const profile=classify(subject,indicatorText);
   if(profile.endsWith('_general'))errors.push(`${subject}/${indicatorKey}: generic profile`);
   const profileIndicators=profiles.get(profile)||[];
   profileIndicators.push(indicatorKey);profiles.set(profile,profileIndicators);
   const sourcePatterns=new Set();
   for(let modelNo=1;modelNo<=MODEL_COUNT;modelNo++){
    const generated=generateExam({subject,indicatorText,outcomeTitle:outcome.title,outcomeCode:outcome.code,indicatorIndex,modelNo,seed:'reviewed-bank-v1'});
    const stored=docsByKey.get(`${indicatorKey}|${modelNo}`);
    if(!stored){errors.push(`${subject}/${indicatorKey}/m${modelNo}: missing document`);continue;}
    const byNo=new Map(stored.doc.questions.map(q=>[q.question_no,q]));
    for(let i=0;i<generated.length;i++){
     questions++;
     const q=generated[i],source=q.alignment_source,storedQuestion=byNo.get(i+1);
     if(!source)errors.push(`${subject}/${indicatorKey}/m${modelNo}/q${i+1}: missing source task`);
     if(source?.focus!==focus||q.measurement_focus!==focus)errors.push(`${subject}/${indicatorKey}/m${modelNo}/q${i+1}: wrong focus`);
     if(source?.profile!==profile)errors.push(`${subject}/${indicatorKey}/m${modelNo}/q${i+1}: wrong generator profile`);
     const sourceTask=normalize(source?.question);
     const renderedTask=normalize(q.question);
     if(!sourceTask||!renderedTask.includes(sourceTask))errors.push(`${subject}/${indicatorKey}/m${modelNo}/q${i+1}: wrapper omitted measured task`);
     if(subject==='science'&&/^في موقف علمي يتصل بـ/.test(source?.question||''))errors.push(`${subject}/${indicatorKey}/m${modelNo}/q${i+1}: generic science fallback`);
     const sourceAnswer=source?.options?.[source?.correct_index];
     const evidence=[source?.question,sourceAnswer,source?.explanation].join(' ');
     if(subject==='science'&&conceptOverlap(indicatorText,evidence).length===0)errors.push(`${subject}/${indicatorKey}/m${modelNo}/q${i+1}: no indicator concept in source task`);
     sourcePatterns.add(sourceTask.replace(/\d+/g,'#'));
     const expectedAlignmentProfile=`${focus}:${profile}`;
     if(!storedQuestion?.alignment_verified)errors.push(`${stored.name} q${i+1}: alignment not verified`);
     if(storedQuestion?.alignment_profile!==expectedAlignmentProfile)errors.push(`${stored.name} q${i+1}: alignment profile mismatch`);
     if(storedQuestion?.alignment_evidence?.validator!=='semantic-contract-v3')errors.push(`${stored.name} q${i+1}: validator mismatch`);
     if(normalize(storedQuestion?.alignment_evidence?.source_task)!==sourceTask)errors.push(`${stored.name} q${i+1}: source task mismatch`);
     if(normalize(storedQuestion?.alignment_evidence?.source_answer)!==normalize(sourceAnswer))errors.push(`${stored.name} q${i+1}: source answer mismatch`);
    }
   }
   sourcesByIndicator.set(indicatorKey,{profile,patterns:sourcePatterns});
  }
 }
 if(subject==='math')for(const[profile,keys]of profiles)if(keys.length!==1)errors.push(`math profile reused by ${keys.join(',')}: ${profile}`);
 if(subject==='science'){
  const entries=[...sourcesByIndicator.entries()];
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
   const[aKey,a]=entries[i],[bKey,b]=entries[j];
   if(a.profile!==b.profile)continue;
   const shared=[...a.patterns].filter(pattern=>b.patterns.has(pattern));
   if(shared.length)errors.push(`science task reused across indicators ${aKey}/${bKey} (${a.profile})`);
  }
 }
 summary[subject]={indicators,questions,generic_tasks:0,wrong_focus:0,omitted_source_tasks:0,cross_indicator_task_reuse:0,verified_contracts:questions};
}

const readingDir=path.join(root,'question-bank','reading');
const readingDocs=fs.readdirSync(readingDir).filter(name=>/^\d+-\d+-\d+-\d+-\d+-i\d+-m\d+\.json$/.test(name)).map(name=>JSON.parse(fs.readFileSync(path.join(readingDir,name),'utf8')));
const readingProfiles=new Map();
for(const doc of readingDocs){
 const key=`${doc.outcome_code}|${doc.indicator_index}`;
 const existing=readingProfiles.get(key);
 if(existing&&existing!==doc.text_profile)errors.push(`reading/${key}: inconsistent profile`);
 readingProfiles.set(key,doc.text_profile);
}
if(new Set(readingProfiles.values()).size!==16)errors.push(`reading: expected 16 indicator-specific profiles, got ${new Set(readingProfiles.values()).size}`);
summary.reading={indicators:readingProfiles.size,questions:readingDocs.reduce((n,doc)=>n+doc.questions.length,0),indicator_specific_profiles:new Set(readingProfiles.values()).size};

if(errors.length){
 console.error(errors.slice(0,250).join('\n'));
 console.error(`semantic_alignment_errors=${errors.length}`);
 process.exit(1);
}
console.log(JSON.stringify({status:'passed',...summary,total_indicators:270,total_questions:Object.values(summary).reduce((n,x)=>n+x.questions,0)},null,2));
