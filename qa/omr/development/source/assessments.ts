import { handlePaperScan, reviewedScanPayload } from './paper-scan.ts';
import { FRAMEWORK } from './framework.ts';
import { hasCurrentReview, reviewedImage, REVIEW_VERSION } from './reviewed-bank.ts';
import { type Row, SUBJECTS, THRESHOLDS, tidy, fail, hash, token, shuffle, randomFrom, normalizeConfig, questionKey, indicatorOf, selectUnique, buildForms, cleanAnswers, gradeSections, publicSections, permuteQuestion, normalizeArabicName, normalizeLast3Digits, verifyStudentIdentity } from './assessment-engine.ts';
const BASE='https://zarie19991-bit.github.io/moallimi/';
const BANK_COLUMNS='id,subject_key,outcome_code,indicator_index,indicator_text,model_no,question_no,measurement_focus,alignment_profile,alignment_verified,alignment_evidence,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level';
const CURATED_COLUMNS='id,subject_key,outcome_code,indicator_index,indicator_key,indicator_text,model_no,question_no,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level,quality_version,image';
const isUUID=(s:unknown)=>/^[a-f0-9-]{36}$/i.test(String(s));
const INTERNAL_STUDENT_CONTEXT=/^(?:موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|مهمة تقويمية جديدة|مراجعة الحل)/;
const INTERNAL_STUDENT_STEM=/(?:موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|وردت في سجل الأمثلة المهمة|المهمة المسجلة في (?:ملخص القواعد|مخطط المراجعة)|وردت في مخطط المراجعة المهمة|ظهرت المهمة|أي خيار يطبق المفهوم تطبيقًا صحيحًا|لتمييز المعرفة المرتبطة|ضمن مقارنة النتيجة ببديل قريب|باستخدام مقارنة النتيجة ببديل قريب|باستخدام كشف الافتراض الذي أدى إلى الخطأ|بعد كشف الافتراض الذي أدى إلى الخطأ|عند كشف الافتراض الذي أدى إلى الخطأ|أي تصحيح يجمع النتيجة السليمة ودليلها|أي تحليل يكشف الخطأ ويبرر البديل|أي تفسير يطابق النتيجة الصحيحة|في (?:مخطط لعلاقة بين متغيرين|مقارنة حالتين فيزيائيتين|مقارنة كائنين أو خليتين|تقويم إجراء صحي أو بيئي|تحليل تغير في نظام حيوي|اختيار إجراء مختبري|مقارنة عينتين ماديتين|تقويم تصميم تقني|تقويم قرار بيئي|خريطة ميدانية|سجل رصد طويل المدى|مقارنة موقعين) بهدف|بعد أن (?:أجريت محاكاة رقمية|عُرضت بيانات نشاط|حُدد طول مسار|قورنت كتل مواد))/;
function studentFacingContext(subject:unknown,value:unknown){
  const ctx=String(value||'').trim();
  if(!ctx)return null;
  if((subject==='math'||subject==='science')&&INTERNAL_STUDENT_CONTEXT.test(ctx))return null;
  return ctx;
}
function studentFacingQuestion(subject:unknown,value:unknown,cognitiveLevel:unknown){
  const text=String(value||'').trim();
  if(!text||!(subject==='math'||subject==='science'))return text;
  const level=String(cognitiveLevel||'');
  if(!INTERNAL_STUDENT_STEM.test(text))return text;
  const matches=[...text.matchAll(/«([^»]+)»/g)].map(m=>String(m[1]||'').trim()).filter(Boolean);
  if(level==='knowledge'||level==='application'){
    const task=matches.length?matches[matches.length-1]:'';
    if(task.length<4)return text;
    return /[؟?!.]$/.test(task)?task:task+'؟';
  }
  if(level==='reasoning'&&matches.length>=2){
    const result=matches[0],task=matches[matches.length-1];
    if(/أي تحليل يكشف الخطأ ويبرر البديل/.test(text))return 'في السؤال «'+task+'»، اختار طالب «'+result+'». أي تحليل يوضح الخطأ ويبرر البديل الصحيح؟';
    if(/أي تصحيح يجمع النتيجة السليمة ودليلها/.test(text))return 'في السؤال «'+task+'»، كانت الإجابة «'+result+'». أي خيار يصحح الإجابة ويذكر دليلًا مناسبًا؟';
    if(/أي تفسير يطابق النتيجة الصحيحة/.test(text))return 'في السؤال «'+task+'»، كانت الإجابة المقترحة «'+result+'». أي تفسير يدعم الإجابة الصحيحة؟';
    if(/أي حكم مدعوم/.test(text))return 'في السؤال «'+task+'»، قورنت المعطيات بالإجابة «'+result+'». أي حكم تدعمه المعطيات؟';
  }
  return text;
}

function must(result:Row) {if(result.error)throw result.error;return result.data;}
function rendered(row:Row) {return{id:row.id,subject:row.subject_key,outcome:row.outcome_code,indicator:row.indicator_index,indicator_key:`${row.subject_key}:${row.outcome_code}:i${row.indicator_index}`,indicator_text:row.indicator_text,model_no:row.model_no,question_no:row.question_no,context:studentFacingContext(row.subject_key,row.context_text),question:row.question_text,options:row.options,correctIndex:row.correct_index,explanation:row.explanation||null,cognitive_level:row.cognitive_level,difficulty:row.difficulty,image:reviewedImage(row)};}
function curatedVersion(subject:string){return subject==='science'?'science-curated-v4':subject==='math'?'math-curated-v4':'';}
function renderedCurated(row:Row){return{id:row.id,bank_source:'indicator_curated_bank',quality_version:row.quality_version,subject:row.subject_key,outcome:row.outcome_code,indicator:row.indicator_index,indicator_key:row.indicator_key,indicator_text:row.indicator_text,model_no:row.model_no,question_no:row.question_no,context:studentFacingContext(row.subject_key,row.context_text),question:studentFacingQuestion(row.subject_key,row.question_text,row.cognitive_level),options:row.options,correctIndex:row.correct_index,explanation:row.explanation||null,cognitive_level:row.cognitive_level,difficulty:row.difficulty,image:row.image&&row.image.url?{url:String(row.image.url),alt:String(row.image.alt||'')}:null};}
const PREVIEW_POOL_CACHE_TTL_MS=45_000;
const previewPoolMemoryCache=new Map<string,{at:number;rows:Row[]}>();
function previewPoolCacheKey(subject:string,keys?:string[],ids?:string[]){
  if(ids?.length)return '';
  return subject+'|'+(keys||[]).map(String).sort().join(',');
}
function previewPoolCacheGet(key:string):Row[]|null{
  if(!key)return null;
  const hit=previewPoolMemoryCache.get(key);
  if(!hit||Date.now()-hit.at>PREVIEW_POOL_CACHE_TTL_MS){if(hit)previewPoolMemoryCache.delete(key);return null;}
  return hit.rows;
}
function previewPoolCacheSet(key:string,rows:Row[]){
  if(!key)return;
  previewPoolMemoryCache.set(key,{at:Date.now(),rows});
  if(previewPoolMemoryCache.size>24){
    const oldest=[...previewPoolMemoryCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,previewPoolMemoryCache.size-24);
    for(const [k] of oldest)previewPoolMemoryCache.delete(k);
  }
}

async function attachQualityAudit(db:any,rows:Row[]):Promise<Row[]>{
  if(!rows.length)return rows;
  const ids=rows.map(q=>String(q.id||'')).filter(isUUID),audit=new Map<string,any>();
  for(let i=0;i<ids.length;i+=300){
    const {data,error}=await db.from('maintenance_agent_item_quality_audit')
      .select('question_id,detected_level,level_match,semantic_current,semantic_judgment,distractor_score,design_score,alignment_band,flags')
      .in('question_id',ids.slice(i,i+300));
    if(error)throw error;
    for(const a of data||[])audit.set(String(a.question_id),a);
  }
  return rows.map(q=>{
    const a=audit.get(String(q.id||''));if(!a)return q;
    const detected=String(a.detected_level||'');
    const effective=(a.semantic_current&&a.level_match===false&&['knowledge','application','reasoning'].includes(detected))?detected:String(q.cognitive_level||'');
    return {...q,registered_cognitive_level:q.cognitive_level,cognitive_level:effective,quality_audit:a};
  });
}
async function fullPool(db:any,subject:string,keys?:string[],ids?:string[]) {
  const cacheKey=previewPoolCacheKey(subject,keys,ids),cached=previewPoolCacheGet(cacheKey);
  if(cached)return cached;
  const all:Row[]=[];
  const version=curatedVersion(subject);
  if(version){
    for(let start=0;;start+=500){
      let query=db.from('nafes_indicator_curated_bank').select(CURATED_COLUMNS)
        .eq('subject_key',subject).eq('quality_version',version).eq('quality_status','approved')
        .order('indicator_key',{ascending:true}).order('model_no',{ascending:true}).order('question_no',{ascending:true});
      if(keys?.length)query=query.in('indicator_key',keys);
      if(ids?.length)query=query.in('id',ids);
      const page=must(await query.range(start,start+499));
      for(const q of page||[])all.push(renderedCurated(q));
      if(!page||page.length<500)break;
    }
    // Safe auto-completion: curated items remain the preferred source, but a
    // preview must not fail merely because exclusions/regeneration exhausted one
    // cognitive level. Supplement with currently-reviewed approved bank items
    // for the exact same indicator. Selection below still enforces structure,
    // cognitive level, uniqueness, distractor quality, and semantic audit.
    if(!ids?.length){
      const scoped=keys?.map(key=>FRAMEWORK.find(i=>i.key===key)).filter(Boolean)||[];
      for(let start=0;;start+=500){
        let fallback=db.from('nafes_question_bank').select(BANK_COLUMNS)
          .eq('grade_key','middle_3').eq('subject_key',subject).eq('is_active',true)
          .eq('review_status','approved').lte('model_no',4).order('id');
        if(scoped.length)fallback=fallback.in('outcome_code',[...new Set(scoped.map(i=>i!.outcome))]).in('indicator_index',[...new Set(scoped.map(i=>i!.indicator))]);
        const page=must(await fallback.range(start,start+499));
        for(const q of page||[]){
          if(!hasCurrentReview(q))continue;
          const item=rendered(q);
          item.bank_source='reviewed_bank_fallback';
          all.push(item);
        }
        if(!page||page.length<500)break;
      }
    }
    const audited=await attachQualityAudit(db,all);
    previewPoolCacheSet(cacheKey,audited);
    return audited;
  }
  const scoped=keys?.map(key=>FRAMEWORK.find(i=>i.key===key)).filter(Boolean)||[];
  for(let start=0;;start+=500){
    let query=db.from('nafes_question_bank').select(BANK_COLUMNS)
      .eq('grade_key','middle_3').eq('subject_key',subject).eq('is_active',true)
      .eq('review_status','approved').lte('model_no',4).order('id');
    if(scoped.length)query=query.in('outcome_code',[...new Set(scoped.map(i=>i!.outcome))]).in('indicator_index',[...new Set(scoped.map(i=>i!.indicator))]);
    if(ids?.length)query=query.in('id',ids);
    const page=must(await query.range(start,start+499));
    for(const q of page||[])if(hasCurrentReview(q))all.push(rendered(q));
    if(!page||page.length<500)break;
  }
  previewPoolCacheSet(cacheKey,all);
  return all;
}


function stemKey(q:Row){
  return String(q?.question??q?.question_text??'')
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g,'')
    .replace(/[؟?!.،,:؛;'"“”‘’()\[\]{}\-–—_/\\]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
}
function selectionStemKey(q:Row,subject:string){
  const stem=stemKey(q);
  if(subject!=='reading')return stem;
  const context=String(q?.context??q?.context_text??'')
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0670\u0640]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .toLowerCase();
  return context?context+'\u241f'+stem:stem;
}

function selectIndicatorQuestions(candidates:Row[],count:number,subject:string,seed:string,usedContent:Set<string>,usedStems:Set<string>):Row[]{
  const mixed=rankQuestionCandidates(candidates,seed+'|quality');
  const unique:Row[]=[];
  const localStems=new Set<string>();
  for(const q of mixed){
    const ck=questionKey(q),sk=selectionStemKey(q,subject);
    if(!sk||usedContent.has(ck)||usedStems.has(sk)||localStems.has(sk))continue;
    localStems.add(sk);unique.push(q);
  }
  if(unique.length<count)fail(`لا توجد صياغات مستقلة كافية لهذا المؤشر: المطلوب ${count} والمتاح دون تكرار في نص السؤال ${unique.length} فقط.`);
  let visualTarget=0;
  if((subject==='math'||subject==='science')&&count>=5){
    const availableVisual=unique.filter(q=>!!q.image?.url).length;
    visualTarget=Math.min(availableVisual,Math.max(1,Math.floor(count*0.20)));
  }
  const picked:Row[]=[];
  if(visualTarget){
    const visual=rankQuestionCandidates(unique.filter(q=>!!q.image?.url),seed+'|visual-quality');
    picked.push(...visual.slice(0,visualTarget));
  }
  const pickedIds=new Set(picked.map(q=>q.id));
  const pickedContent=new Set([...usedContent,...picked.map(questionKey)]);
  const need=count-picked.length;
  if(need>0){
    const nonVisual=rankQuestionCandidates(unique.filter(q=>!pickedIds.has(q.id)&&!q.image?.url),seed+'|rest-nonvisual-quality');
    if(nonVisual.length>=need)picked.push(...nonVisual.slice(0,need));
    else{
      if(nonVisual.length)picked.push(...nonVisual);
      const nowPicked=new Set(picked.map(q=>q.id));
      const fallback=rankQuestionCandidates(unique.filter(q=>!nowPicked.has(q.id)),seed+'|rest-fallback-quality');
      const remaining=count-picked.length;
      if(remaining)picked.push(...fallback.slice(0,remaining));
    }
  }
  for(const q of picked){usedContent.add(questionKey(q));usedStems.add(selectionStemKey(q,subject));}
  return picked;
}

function levelTargets(subject:string,count:number,custom?:Row|null){
  const base=custom&&['knowledge','application','reasoning'].every(k=>Number.isFinite(Number(custom[k])))
    ?{knowledge:Number(custom.knowledge),application:Number(custom.application),reasoning:Number(custom.reasoning)}
    :(subject==='science'?{knowledge:20,application:47,reasoning:33}:{knowledge:13,application:54,reasoning:33});
  const levels=['knowledge','application','reasoning'];
  const raw=levels.map(level=>({level,raw:count*Number((base as any)[level]||0)/100,count:Math.floor(count*Number((base as any)[level]||0)/100)}));
  let left=count-raw.reduce((s,x)=>s+x.count,0);
  raw.sort((x,y)=>(y.raw-y.count)-(x.raw-x.count));
  for(let i=0;i<raw.length&&left>0;i++,left--)raw[i].count++;
  return Object.fromEntries(raw.map(x=>[x.level,x.count])) as Record<string,number>;
}
function rebalanceQuestionOptions(qs:Row[],seed:string):Row[]{
  const rnd=randomFrom(seed+'|answer-balance');
  const shift=Math.floor(rnd()*4);
  return qs.map((q,i)=>{
    const options=Array.isArray(q.options)?q.options.map(String):[];
    const ci=Number(q.correctIndex);
    if(options.length!==4||!Number.isInteger(ci)||ci<0||ci>3)return q;
    const target=(i+shift)%4;
    if(target===ci)return q;
    const correct=options[ci],d=options.filter((_,idx)=>idx!==ci);
    const next=target===0?[correct,d[0],d[1],d[2]]
      :target===1?[d[0],correct,d[1],d[2]]
      :target===2?[d[0],d[1],correct,d[2]]
      :[d[0],d[1],d[2],correct];
    return {...q,options:next,correctIndex:target};
  });
}
function stemFamilyKey(q:Row){
  return stemKey(q)
    .replace(/[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?/g,'#')
    .replace(/\b(طالب|طالبة|باحث|باحثة|معلم|معلمة)\b/g,'شخص')
    .split(' ')
    .slice(0,7)
    .join(' ');
}
function auditFlagCodes(q:Row):Set<string>{
  const raw=Array.isArray(q?.quality_audit?.flags)?q.quality_audit.flags:[];
  return new Set(raw.map((x:any)=>String(x?.code||x||'')).filter(Boolean));
}
function qualityAuditTier(q:Row):number{
  const a=q?.quality_audit;if(!a)return 4;
  const band=String(a.alignment_band||''),current=a.semantic_current===true,flags=auditFlagCodes(q);
  if(band==='weak'||flags.has('weak_distractors'))return 5;
  if(current&&band==='strong'&&!flags.has('template_repetition'))return 0;
  if(current&&(band==='strong'||band==='acceptable'))return 1;
  if(band==='strong'||band==='acceptable')return 2;
  if(band==='review'&&!flags.has('template_repetition'))return 3;
  return 4;
}
function structuralQuestionStrength(q:Row):number{
  let score=58;
  const text=String(q?.question??q?.question_text??'').trim();
  const options=Array.isArray(q?.options)?q.options.map((x:any)=>String(x).trim()):[];
  const ci=Number(q?.correctIndex??q?.correct_index);
  if(text.length>=18&&text.length<=250)score+=9;else score-=6;
  if(options.length===4&&options.every(Boolean)&&new Set(options).size===4)score+=12;else score-=24;
  if(Number.isInteger(ci)&&ci>=0&&ci<4)score+=7;else score-=18;
  if(['knowledge','application','reasoning'].includes(String(q?.cognitive_level||'')))score+=6;
  if(['easy','medium','hard'].includes(String(q?.difficulty||'')))score+=4;
  if(String(q?.explanation||'').trim().length>=8)score+=5;
  if(String(q?.indicator_key||'').trim())score+=5;
  if(String(q?.quality_version||'').trim())score+=7;
  if(q?.image?.url&&q?.image?.alt)score+=3;
  const lens=options.map((x:string)=>x.length).filter(Boolean);
  if(lens.length===4){
    const mn=Math.min(...lens),mx=Math.max(...lens);
    if(mn>0&&mx/Math.max(1,mn)<=2.8)score+=4;else score-=4;
  }
  if(/كل ما سبق|جميع ما سبق|لا شيء مما سبق/.test(options.join(' ')))score-=5;
  const a=q?.quality_audit;
  if(a){
    const design=Number(a.design_score),distr=Number(a.distractor_score);
    if(Number.isFinite(design)&&Number.isFinite(distr))score=Math.round(score*.32+design*.38+distr*.30);
    const flags=auditFlagCodes(q);
    if(a.semantic_current===true)score+=5;else score-=3;
    if(String(a.alignment_band)==='strong')score+=6;
    else if(String(a.alignment_band)==='acceptable')score+=2;
    else if(String(a.alignment_band)==='review')score-=9;
    else if(String(a.alignment_band)==='weak')score-=28;
    if(a.level_match===false)score-=12;
    if(flags.has('template_repetition'))score-=10;
    if(flags.has('option_length_imbalance'))score-=5;
    if(flags.has('weak_distractors'))score-=18;
  }
  return Math.max(0,Math.min(100,Math.round(score)));
}
function rankQuestionCandidates(rows:Row[],seed:string):Row[]{
  return rows.map(q=>({q,tier:qualityAuditTier(q),score:structuralQuestionStrength(q),tie:randomFrom(seed+'|'+String(q.id||stemKey(q)))()}))
    .sort((a,b)=>a.tier-b.tier||b.score-a.score||b.tie-a.tie).map(x=>x.q);
}

function curatedQuestionEligible(q:Row,subject:string){
  const text=String(q?.question??q?.question_text??'').trim();
  const options=Array.isArray(q?.options)?q.options.map((x:any)=>String(x).trim()):[];
  const ci=Number(q?.correctIndex??q?.correct_index);
  if(!text||options.length!==4||new Set(options).size!==4||options.some((x:string)=>!x))return false;
  if(!Number.isInteger(ci)||ci<0||ci>3)return false;
  const audit=q?.quality_audit;
  if(String(audit?.alignment_band||'')==='weak')return false;
  if(/أي إجابة يمكن اعتمادها|طُرحت المهمة|عند استرجاع المفهوم الأساسي|المهمة المسجلة في ملخص القواعد|استنادًا إلى.+اختبر صحة النتيجة|أي خيار يقدم تصحيحًا وبرهانًا متسقين|ما الإجابة التي تنقل مفهوم|لزم حل المهمة/.test(text))return false;
  if((subject==='math'||subject==='science')&&INTERNAL_STUDENT_STEM.test(text))return false;
  if(subject==='science'){
    const weakScienceTemplate=/(في (?:مخطط لعلاقة بين متغيرين|مقارنة حالتين فيزيائيتين|مقارنة كائنين أو خليتين|تقويم إجراء صحي أو بيئي|تحليل تغير في نظام حيوي|اختيار إجراء مختبري|مقارنة عينتين ماديتين) بهدف|اختيرت الإجابة|لزم التحقق من|ظهرت المهمة)/;
    if(weakScienceTemplate.test(text))return false;
  }
  const needsVisual=/(أي رسم(?! سهمي)|الرسم الآتي|الشكل الآتي|المخطط الآتي|الصورة الآتية|أي نقطة في الشكل)/.test(text);
  if(needsVisual&&(!q?.image?.url||!q?.image?.alt))return false;
  return true;
}
function allocateSectionLevelTargets(indicators:Row[],pool:Row[],subject:string,total:number,custom?:Row|null,fixedModel?:number|null){
  const remaining=levelTargets(subject,total,custom),plans=new Map<string,Record<string,number>>();
  const levels=['knowledge','application','reasoning'];
  for(const ind of indicators||[]){
    const need=Math.max(0,Number(ind.count||0));
    let candidates=pool.filter(q=>q.indicator_key===ind.key&&curatedQuestionEligible(q,subject));
    if(fixedModel)candidates=candidates.filter(q=>q.model_no===fixedModel);
    const available:Object=Object.fromEntries(levels.map(level=>[level,candidates.filter(q=>q.cognitive_level===level).length]));
    const plan:Record<string,number>={knowledge:0,application:0,reasoning:0};
    for(let slot=0;slot<need;slot++){
      const feasible=levels.filter(level=>plan[level]<Number((available as any)[level]||0));
      if(!feasible.length)break;
      feasible.sort((x,y)=>{
        const rx=Math.max(0,Number(remaining[x]||0)),ry=Math.max(0,Number(remaining[y]||0));
        if(ry!==rx)return ry-rx;
        const ax=Number((available as any)[x]||0)-plan[x],ay=Number((available as any)[y]||0)-plan[y];
        return ay-ax;
      });
      const level=feasible[0];plan[level]++;if(remaining[level]>0)remaining[level]--;
    }
    plans.set(String(ind.key),plan);
  }
  return plans;
}
function selectCuratedIndicatorQuestions(candidates:Row[],count:number,subject:string,seed:string,usedContent:Set<string>,usedStems:Set<string>,explicitTargets?:Record<string,number>):Row[]{
  const mixed=rankQuestionCandidates(candidates.filter(q=>curatedQuestionEligible(q,subject)),seed+'|curated-quality');
  const unique:Row[]=[];
  const localStems=new Set<string>();
  const crossIndicatorStemReuse=new Set<string>();
  for(const q of mixed){
    const ck=questionKey(q),sk=selectionStemKey(q,subject);
    if(!sk||usedContent.has(ck)||localStems.has(sk))continue;
    localStems.add(sk);
    if(usedStems.has(sk))crossIndicatorStemReuse.add(String(q.id));
    unique.push(q);
  }
  if(unique.length<count)fail(`لا توجد أسئلة محكَّمة ومتنوعة كافية لهذا المؤشر: المطلوب ${count} والمتاح بعد استبعاد الصياغات الضعيفة والمتكررة ${unique.length} فقط.`);

  const targets=explicitTargets||levelTargets(subject,count),picked:Row[]=[];
  const pickedIds=new Set<string>();
  const familyCounts=new Map<string,number>();
  const add=(q:Row)=>{
    picked.push(q);
    pickedIds.add(String(q.id));
    const family=stemFamilyKey(q);
    familyCounts.set(family,(familyCounts.get(family)||0)+1);
  };
  const takeLevel=(level:string,desired:number)=>{
    if(!desired)return 0;
    const basePool=unique.filter(q=>q.cognitive_level===level&&!pickedIds.has(String(q.id)));
    let taken=0;
    // Prefer stems not used by earlier indicators. Only if that strict pass cannot
    // satisfy the cognitive target do we admit a stem seen under another indicator.
    for(const reuseCrossIndicatorStem of [false,true]){
      for(const tier of [0,1,2,3,4,5]){
        const stage=basePool.filter(q=>reuseCrossIndicatorStem||!crossIndicatorStemReuse.has(String(q.id)));
        const pool=rankQuestionCandidates(stage.filter(q=>qualityAuditTier(q)===tier),seed+'|'+level+'|reuse'+Number(reuseCrossIndicatorStem)+'|tier'+tier);
        for(const cap of [1,2,3,99]){
          for(const q of pool){
            if(taken>=desired)break;
            if(pickedIds.has(String(q.id)))continue;
            const family=stemFamilyKey(q);
            if((familyCounts.get(family)||0)>=cap)continue;
            add(q);taken++;
          }
          if(taken>=desired)break;
        }
        if(taken>=desired)break;
      }
      if(taken>=desired)break;
    }
    return taken;
  };

  for(const level of ['knowledge','application','reasoning']){
    const desired=Number(targets[level]||0),taken=takeLevel(level,desired);
    if(taken<desired){
      const key=String(candidates[0]?.indicator_key||'');
      fail(`لا توجد أسئلة سليمة كافية في مستوى ${level} لهذا المؤشر${key?' ('+key+')':''}: المطلوب ${desired} والمتاح ${taken}. لن يكتمل النموذج على حساب التوازن المعرفي.`);
    }
  }
  if(picked.length<count){
    const strictRest=rankQuestionCandidates(unique.filter(q=>!pickedIds.has(String(q.id))&&!crossIndicatorStemReuse.has(String(q.id))),seed+'|fallback-quality-strict');
    const reusedRest=rankQuestionCandidates(unique.filter(q=>!pickedIds.has(String(q.id))&&crossIndicatorStemReuse.has(String(q.id))),seed+'|fallback-quality-reuse');
    const rest=[...strictRest,...reusedRest];
    for(const cap of [1,2,3,99]){
      for(const q of rest){
        if(picked.length>=count)break;
        if(pickedIds.has(String(q.id)))continue;
        const family=stemFamilyKey(q);
        if((familyCounts.get(family)||0)>=cap)continue;
        add(q);
      }
      if(picked.length>=count)break;
    }
  }
  if(picked.length!==count)fail(`تعذر تكوين نموذج متوازن ومتنوّع لهذا المؤشر: المطلوب ${count} والمتاح بعد التحكيم ${picked.length}.`);
  const arranged=arrangeObjectiveQuestions(picked,seed+'|arrange');
  const balanced=rebalanceQuestionOptions(arranged,seed);
  for(const q of balanced){usedContent.add(questionKey(q));usedStems.add(selectionStemKey(q,subject));}
  return balanced;
}
function arrangeObjectiveQuestions(qs:Row[],seed:string):Row[]{
  const remaining=shuffle(qs,randomFrom(seed));
  const out:Row[]=[];
  while(remaining.length){
    const last=out[out.length-1],last2=out[out.length-2];
    let best=0,bestPenalty=Number.POSITIVE_INFINITY;
    for(let i=0;i<remaining.length;i++){
      const q=remaining[i];
      let p=0;
      if(last&&q.indicator_key===last.indicator_key)p+=80;
      if(last&&q.cognitive_level===last.cognitive_level)p+=22;
      if(last2&&q.cognitive_level===last2.cognitive_level&&last?.cognitive_level===q.cognitive_level)p+=30;
      if(last&&Number(q.correctIndex)===Number(last.correctIndex))p+=8;
      if(p<bestPenalty){bestPenalty=p;best=i;}
    }
    out.push(remaining.splice(best,1)[0]);
  }
  return out;
}

const COGNITIVE_SEQUENCE:Record<string,number>={knowledge:0,application:1,reasoning:2};
const DIFFICULTY_SEQUENCE:Record<string,number>={easy:0,medium:1,hard:2,very_hard:3};

/**
 * Educational sequence for indicator tests:
 * indicator/topic order -> knowledge -> application -> reasoning -> difficulty.
 * Reading keeps each passage together before applying the cognitive progression.
 * Original order is the final stable tie-breaker, so this is deterministic.
 */
export function sequenceLearningQuestions(qs:Row[],subject:string,indicatorPlan:Row[]=[]):Row[]{
  const plan=new Map<string,number>();
  for(const item of indicatorPlan||[]){
    const key=String(item?.key||item?.indicator_key||'').trim();
    if(key&&!plan.has(key))plan.set(key,plan.size);
  }
  let nextRank=plan.size;
  for(const q of qs||[]){
    const key=String(q?.indicator_key||indicatorOf(q)||'').trim();
    if(key&&!plan.has(key))plan.set(key,nextRank++);
  }
  const contexts=new Map<string,number>();
  if(subject==='reading'){
    for(const q of qs||[]){
      const ctx=String(q?.context||'').trim();
      const key=ctx||'__no_context__'+contexts.size;
      if(!contexts.has(key))contexts.set(key,contexts.size);
    }
  }
  return (qs||[]).map((q,index)=>{
    const indicator=String(q?.indicator_key||indicatorOf(q)||'').trim();
    const context=String(q?.context||'').trim();
    return{
      q,index,
      indicatorRank:plan.get(indicator)??9999,
      contextRank:subject==='reading'?(contexts.get(context)||0):0,
      cognitiveRank:COGNITIVE_SEQUENCE[String(q?.cognitive_level||'')]??9,
      difficultyRank:DIFFICULTY_SEQUENCE[String(q?.difficulty||'')]??9
    };
  }).sort((a,b)=>
    a.contextRank-b.contextRank||
    a.indicatorRank-b.indicatorRank||
    a.cognitiveRank-b.cognitiveRank||
    a.difficultyRank-b.difficultyRank||
    a.index-b.index
  ).map(x=>x.q);
}

export function planReadingPassageAllocation(capacities:number[],count:number,preferredPerPassage=5):number[]{
  const need=Math.trunc(Number(count)||0),preferred=Math.max(1,Math.trunc(Number(preferredPerPassage)||5));
  const caps=(Array.isArray(capacities)?capacities:[]).map(x=>Math.max(0,Math.trunc(Number(x)||0)));
  if(need<=0||!caps.length||caps.reduce((a,b)=>a+b,0)<need)return [];
  const order=caps.map((cap,index)=>({cap,index,preferred:Math.min(cap,preferred)}))
    .filter(x=>x.cap>0)
    .sort((a,b)=>b.preferred-a.preferred||b.cap-a.cap||a.index-b.index);
  const selected:number[]=[];let preferredCapacity=0;
  for(const x of order){selected.push(x.index);preferredCapacity+=x.preferred;if(preferredCapacity>=need)break;}
  if(preferredCapacity<need){
    for(const x of order)if(!selected.includes(x.index))selected.push(x.index);
  }
  const allocation=Array(caps.length).fill(0);let remaining=need;
  const fill=(limit:(idx:number)=>number)=>{
    while(remaining>0){
      let progressed=false;
      for(const idx of selected){
        if(allocation[idx]>=limit(idx))continue;
        allocation[idx]++;remaining--;progressed=true;
        if(!remaining)break;
      }
      if(!progressed)break;
    }
  };
  fill(idx=>Math.min(caps[idx],preferred));
  if(remaining>0)fill(idx=>caps[idx]);
  return remaining===0?allocation:[];
}

function selectReadingPassageQuestions(candidates:Row[],count:number,seed:string,usedContent:Set<string>,usedStems:Set<string>):Row[]{
  const groups=new Map<string,Row[]>();
  for(const q of candidates){
    const context=String(q.context||'').trim();
    if(!context)continue;
    const list=groups.get(context)||[];
    list.push(q);groups.set(context,list);
  }

  const prepared=[...groups.entries()].map(([context,rows])=>{
    const local=new Set<string>(),available:Row[]=[];
    for(const q of rankQuestionCandidates(rows,seed+'|passage-items|'+context.slice(0,80))){
      const ck=questionKey(q),sk=selectionStemKey(q,'reading');
      if(!sk||usedContent.has(ck)||usedStems.has(sk)||local.has(sk))continue;
      local.add(sk);available.push(q);
    }
    const quality=available.length?available.reduce((s,q)=>s+structuralQuestionStrength(q),0)/available.length:0;
    return{context,available,quality,tie:randomFrom(seed+'|passage|'+context.slice(0,80))()};
  }).filter(g=>g.available.length>0)
    .sort((a,b)=>b.quality-a.quality||b.tie-a.tie);

  const totalAvailable=prepared.reduce((s,g)=>s+g.available.length,0);
  if(totalAvailable<count){
    fail(`موارد القراءة لهذا المؤشر غير كافية بعد استبعاد التكرار: المطلوب ${count} سؤالًا، والمتاح ${totalAvailable} سؤالًا صالحًا موزعًا على ${prepared.length} نصوص. أضف أسئلة/نصوص محكّمة أو خفّض عدد أسئلة المؤشر.`);
  }

  const allocation=planReadingPassageAllocation(prepared.map(g=>g.available.length),count,5);
  if(!allocation.length){
    fail(`تعذر توزيع ${count} سؤالًا على النصوص المتاحة توزيعًا صالحًا، رغم وجود ${totalAvailable} سؤالًا. راجع سلامة ارتباط الأسئلة بالنصوص.`);
  }

  const picked:Row[]=[];
  for(let i=0;i<prepared.length;i++){
    const take=allocation[i]||0;if(!take)continue;
    const group=prepared[i];
    const batch=selectIndicatorQuestions(group.available,take,'reading',seed+'|passage|'+i,usedContent,usedStems);
    picked.push(...batch);
  }
  if(picked.length!==count)fail(`تعذر إكمال توزيع أسئلة القراءة: المطلوب ${count} وتم اختيار ${picked.length} فقط.`);
  return picked;
}

const SIM_BANK_COLUMNS='id,grade_key,subject_key,outcome_code,indicator_index,indicator_key,indicator_text,context_text,question_text,normalized_content_text,options,correct_index,explanation,difficulty,cognitive_level,review_status,content_sha256,semantic_similarity_cleared,semantic_review_evidence,is_active';

function isValidSemanticEvidence(ev:any):boolean {
  if(!ev||typeof ev!=='object'||Array.isArray(ev)) return false;
  if(!ev.method||!String(ev.method).trim()) return false;
  if(!ev.checked_at||!String(ev.checked_at).trim()) return false;
  if(!ev.reviewed_by||!String(ev.reviewed_by).trim()) return false;
  if(ev.score===undefined||ev.score===null||String(ev.score).trim()==='') return false;
  const res=String(ev.result||'').trim().toLowerCase();
  return res==='pass'||res==='cleared';
}

function renderedSimQuestion(row:Row):Row {
  return {
    id:row.id,
    bank_source:'simulation_bank',
    subject:row.subject_key,
    outcome:row.outcome_code,
    indicator:row.indicator_index,
    indicator_key:row.indicator_key,
    indicator_text:row.indicator_text,
    context:studentFacingContext(row.subject_key,row.context_text),
    question:row.question_text,
    options:row.options,
    correctIndex:row.correct_index,
    explanation:row.explanation||null,
    cognitive_level:row.cognitive_level,
    difficulty:row.difficulty,
    image:null
  };
}

async function simulationPool(db:any,subject:string,keys?:string[],ids?:string[]):Promise<Row[]> {
  const all:Row[]=[];
  for(let start=0;;start+=500){
    let query=db.from('nafes_simulation_question_bank')
      .select(SIM_BANK_COLUMNS)
      .eq('grade_key','middle_3')
      .eq('subject_key',subject)
      .eq('is_active',true)
      .eq('review_status','approved')
      .eq('semantic_similarity_cleared',true)
      .order('id');
    if(keys?.length)query=query.in('indicator_key',keys);
    if(ids?.length)query=query.in('id',ids);
    const page=must(await query.range(start,start+499));
    for(const q of page||[]){
      if(isValidSemanticEvidence(q.semantic_review_evidence)){
        all.push(renderedSimQuestion(q));
      }
    }
    if(!page||page.length<500)break;
  }
  return all;
}


async function teacherStudentsList(db:any, b?:Row) {
  let query = db.from('nafes_students').select('*').eq('is_demo', false);
  if (b?.include_archived !== true) {
    query = query.eq('is_active', true);
  }
  const students = must(await query.order('class_name',{ascending:true}).order('name_normalized',{ascending:true}));
  const attemptCounts = new Map<string, number>();
  for (const table of ['nafes_assessment_attempts', 'nafes_simulation_attempts', 'nafes_exam_attempts']) {
    const { data: rows } = await db.from(table).select('student_id, student_key').eq('is_demo', false);
    for (const r of rows || []) {
      const key = r.student_id || (isUUID(r.student_key) ? r.student_key : null);
      if (key) attemptCounts.set(key, (attemptCounts.get(key) || 0) + 1);
    }
  }
  const result = (students || []).map((s: Row) => ({
    ...s,
    attempts_count: attemptCounts.get(s.id) || 0
  }));
  return { ok: true, students: result };
}

async function teacherStudentAdd(db:any, b:Row) {
  const full_name = tidy(b.full_name || b.student_name, 120);
  if (full_name.length < 2) fail('الاسم الكامل يجب أن يتكون من حرفين على الأقل.');
  const last3 = normalizeLast3Digits(b.national_id_last3 || b.student_no);
  if (!last3 || last3.length !== 3) fail('يجب إدخال آخر ٣ أرقام فقط من رقم الهوية الوطنية (٣ أرقام بالضبط).');
  const grade = tidy(b.grade, 80) || 'الصف الثالث المتوسط';
  const class_name = tidy(b.class_name, 80);
  const name_normalized = normalizeArabicName(full_name);

  // Check globally for existing student (active or archived)
  const existing = must(await db.from('nafes_students')
    .select('id, is_active, full_name')
    .eq('national_id_last3', last3)
    .eq('name_normalized', name_normalized)
    .maybeSingle());

  if (existing) {
    if (existing.is_active) {
      fail('يوجد طالب نشط مسجل مسبقًا بنفس الاسم وآخر ٣ أرقام من الهوية. يرجى توضيح الاسم (مثل كتابة الاسم الرباعي) لتفادي التضارب أثناء تسجيل الدخول.', 409);
    }
    // Student was previously archived: reactivate/restore existing record to preserve single student_id and all historical attempts
    const restored = must(await db.from('nafes_students').update({
      full_name,
      name_normalized,
      grade,
      class_name,
      national_id_last3: last3,
      is_active: true,
      archived_at: null,
      updated_at: new Date().toISOString()
    }).eq('id', existing.id).select().single());

    return {
      ok: true,
      student: restored,
      restored: true,
      message: 'تم استعادة السجل السابق للطالب وإعادة تفعيله بنجاح مع الحفاظ على جميع محاولاته السابقة.'
    };
  }

  const student = must(await db.from('nafes_students').insert({
    full_name,
    name_normalized,
    grade,
    class_name,
    national_id_last3: last3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).select().single());

  return { ok: true, student };
}

async function teacherStudentUpdate(db:any, b:Row) {
  const id = b.id || b.student_id;
  if (!isUUID(id)) fail('معرّف الطالب غير صحيح.');
  const full_name = tidy(b.full_name || b.student_name, 120);
  if (full_name.length < 2) fail('الاسم الكامل يجب أن يتكون من حرفين على الأقل.');
  const last3 = normalizeLast3Digits(b.national_id_last3 || b.student_no);
  if (!last3 || last3.length !== 3) fail('يجب إدخال آخر ٣ أرقام فقط من رقم الهوية الوطنية (٣ أرقام بالضبط).');
  const grade = tidy(b.grade, 80) || 'الصف الثالث المتوسط';
  const class_name = tidy(b.class_name, 80);
  const name_normalized = normalizeArabicName(full_name);

  const existing = must(await db.from('nafes_students')
    .select('id')
    .eq('national_id_last3', last3)
    .eq('name_normalized', name_normalized)
    .neq('id', id)
    .maybeSingle());
  if (existing) {
    fail('يوجد طالب آخر مسجل مسبقًا بنفس الاسم وآخر ٣ أرقام من الهوية. يرجى توضيح الاسم لتفادي التضارب أثناء تسجيل الدخول.', 409);
  }

  const student = must(await db.from('nafes_students').update({
    full_name,
    name_normalized,
    grade,
    class_name,
    national_id_last3: last3,
    updated_at: new Date().toISOString()
  }).eq('id', id).select().single());

  return { ok: true, student };
}

async function teacherStudentDelete(db:any, b:Row) {
  const id = b.id || b.student_id;
  if (!isUUID(id)) fail('معرّف الطالب غير صحيح.');
  const student = must(await db.from('nafes_students').select('id, full_name, is_active').eq('id', id).maybeSingle());
  if (!student) fail('الطالب غير موجود.', 404);

  // Soft archive to protect student_id link across all historical and future attempts
  const archived = must(await db.from('nafes_students').update({
    is_active: false,
    archived_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', id).select().single());

  return { ok: true, id, student: archived, archived: true };
}

async function teacherStudentRestore(db:any, b:Row) {
  const id = b.id || b.student_id;
  if (!isUUID(id)) fail('معرّف الطالب غير صحيح.');
  const student = must(await db.from('nafes_students').select('id, full_name, name_normalized, national_id_last3, is_active').eq('id', id).maybeSingle());
  if (!student) fail('الطالب غير موجود.', 404);

  // Check if restoring would collide with another currently active student
  const conflict = must(await db.from('nafes_students')
    .select('id')
    .eq('national_id_last3', student.national_id_last3)
    .eq('name_normalized', student.name_normalized)
    .eq('is_active', true)
    .neq('id', id)
    .maybeSingle());
  if (conflict) {
    fail('لا يمكن استعادة الطالب لوجود طالب نشط آخر حاليًا بنفس الاسم وآخر ٣ أرقام من الهوية. يرجى تعديل اسم أحدهما أولًا لمنع الالتباس.', 409);
  }

  const restored = must(await db.from('nafes_students').update({
    is_active: true,
    archived_at: null,
    updated_at: new Date().toISOString()
  }).eq('id', id).select().single());

  return { ok: true, id, student: restored, restored: true };
}

async function teacherStudentsBulkImport(db: any, b: Row) {
  const rawList = Array.isArray(b.students) ? b.students : [];
  if (!rawList.length) fail('قائمة الطلاب فارغة.');
  if (rawList.length > 500) fail('الحد الأقصى للإضافة الجماعية ٥٠٠ طالب في الدفعة الواحدة.');

  let added = 0, updated = 0, restored = 0, ignored = 0, failed = 0;
  const processed = [];
  const seenInBatch = new Set<string>();

  for (const item of rawList) {
    const fullName = tidy(item.full_name || item.student_name, 120);
    const last3 = normalizeLast3Digits(item.national_id_last3 || item.student_no);
    const grade = tidy(item.grade, 80) || 'الصف الثالث المتوسط';
    const className = tidy(item.class_name, 80);
    const normName = normalizeArabicName(fullName);

    // Strict backend validation
    if (fullName.length < 2 || !last3 || last3.length !== 3 || !/^\d{3}$/.test(last3)) {
      failed++;
      processed.push({ full_name: fullName, national_id_last3: last3, status: 'rejected', reason: 'بيانات غير صالحة' });
      continue;
    }

    const batchKey = `${last3}:${normName}`;
    if (seenInBatch.has(batchKey)) {
      ignored++;
      processed.push({ full_name: fullName, national_id_last3: last3, status: 'ignored', reason: 'مكرر في نفس الملف' });
      continue;
    }
    seenInBatch.add(batchKey);

    const existing = must(await db.from('nafes_students')
      .select('id, full_name, class_name, grade, is_active')
      .eq('national_id_last3', last3)
      .eq('name_normalized', normName)
      .maybeSingle());

    if (existing) {
      if (!existing.is_active) {
        const res = must(await db.from('nafes_students').update({
          full_name: fullName,
          name_normalized: normName,
          grade,
          class_name: className,
          is_active: true,
          archived_at: null,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id).select().single());
        restored++;
        processed.push({ ...res, status: 'restored' });
      } else {
        if (existing.class_name !== className || existing.grade !== grade) {
          const res = must(await db.from('nafes_students').update({
            grade,
            class_name: className,
            updated_at: new Date().toISOString()
          }).eq('id', existing.id).select().single());
          updated++;
          processed.push({ ...res, status: 'updated' });
        } else {
          ignored++;
          processed.push({ ...existing, status: 'ignored' });
        }
      }
    } else {
      const res = must(await db.from('nafes_students').insert({
        full_name: fullName,
        name_normalized: normName,
        grade,
        class_name: className,
        national_id_last3: last3,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).select().single());
      added++;
      processed.push({ ...res, status: 'added' });
    }
  }

  return { ok: true, added, updated, restored, ignored, failed, total: rawList.length, students: processed };
}

async function teacherStudentHardDelete(db: any, b: Row) {
  const id = b.id || b.student_id;
  if (!isUUID(id)) fail('معرّف الطالب غير صحيح.');
  const confirmWord = tidy(b.confirm_word);
  if (confirmWord !== 'حذف') fail('يجب كتابة كلمة «حذف» للتأكيد.');

  const rpcRes = await db.rpc('nafes_teacher_hard_delete_student', { p_student_id: id, p_confirm_word: confirmWord });
  if (rpcRes.error) {
    if (rpcRes.error.code === '42883' || rpcRes.error.message?.includes('42883') || rpcRes.error.message?.includes('function nafes_teacher_hard_delete_student')) {
      fail('تعذر تنفيذ العملية الآمنة لأن تحديث قاعدة البيانات المطلوب لم يُطبق بعد.', 500);
    }
    fail(rpcRes.error.message || 'فشلت عملية الحذف النهائي للطالب.');
  }
  return rpcRes.data;
}

async function protectReviewedPaperTest(db:any,testId:string){
 if(!isUUID(testId))return;
 const t=must(await db.from('nafes_assessments').select('id,config').eq('id',testId).maybeSingle());
 if(t?.config?.paper_review===true||t?.config?.paper_review_id)
   fail('نتائج أوراق المراجعة لا تُمسح من هذا المسار؛ استخدم التراجع الإداري المدقق.',409);
}
async function teacherTestClearResults(db: any, b: Row, owner?: Row) {
  const testId = String(b.test_id || b.id || '').trim();
  if (!testId) fail('معرّف الاختبار مطلوب.');
  const confirmWord = tidy(b.confirm_word);
  if (confirmWord !== 'مسح النتائج') fail('يجب كتابة كلمة «مسح النتائج» للتأكيد.');

  const ownerId = owner?.id || null;
  if (isUUID(testId) && !ownerId) {
    fail('معرّف مالك الحساب مطلوب للتحقق من صلاحية الاختبار.', 401);
  }

  if (!isUUID(testId) && !testId.startsWith('simulation:') && !testId.startsWith('exam:')) {
    fail('معرّف الاختبار تالف أو غير صالح.');
  }
  if (testId.startsWith('exam:')) {
    if (!/^exam:(reading|math|science):[a-zA-Z0-9_]+:i[0-9]+:m[0-9]+$/.test(testId)) {
      fail('معرّف اختبار المؤشر تالف أو غير صالح.');
    }
    const parts = testId.split(':');
    if (parts.length !== 5 || !/^[0-9]+$/.test(parts[3].slice(1)) || !/^[0-9]+$/.test(parts[4].slice(1))) {
      fail('أرقام المؤشر أو النموذج غير صالحة.');
    }
  }
  if (testId.startsWith('simulation:') && !/^simulation:[a-z0-9_]+$/.test(testId)) {
    fail('معرّف اختبار المحاكاة تالف أو غير صالح.');
  }

  await protectReviewedPaperTest(db,testId);
  const rpcRes = await db.rpc('nafes_teacher_clear_test_results', {
    p_test_id: testId,
    p_confirm_word: confirmWord,
    p_owner_id: isUUID(testId) ? ownerId : null
  });

  if (rpcRes.error) {
    if (rpcRes.error.code === '42883' || rpcRes.error.message?.includes('42883') || rpcRes.error.message?.includes('function nafes_teacher_clear_test_results')) {
      fail('تعذر تنفيذ العملية الآمنة لأن تحديث قاعدة البيانات المطلوب لم يُطبق بعد.', 500);
    }
    fail(rpcRes.error.message || 'فشلت عملية مسح نتائج الاختبار.');
  }

  return rpcRes.data;
}

async function teacherTestDelete(db: any, b: Row, owner?: Row) {
  const testId = String(b.test_id || b.id || '').trim();
  if (!testId) fail('معرّف الاختبار مطلوب.');
  const confirmWord = tidy(b.confirm_word);
  if (confirmWord !== 'حذف') fail('يجب كتابة كلمة «حذف» للتأكيد.');

  if (testId.startsWith('exam:') || testId.startsWith('simulation:')) {
    fail('لا يمكن حذف هذا الاختبار نهائيًا لأنه يتبع بنك المؤشرات. يمكنك فقط مسح نتائجه.', 400);
  }

  if (!isUUID(testId)) fail('معرّف الاختبار غير صالح لحذف السجل.');

  const ownerId = owner?.id || null;
  if (!ownerId) fail('معرّف مالك الحساب مطلوب للتحقق من صلاحية حذف الاختبار.', 401);

  await protectReviewedPaperTest(db,testId);
  const rpcRes = await db.rpc('nafes_teacher_delete_published_test', {
    p_test_id: testId,
    p_confirm_word: confirmWord,
    p_owner_id: ownerId
  });

  if (rpcRes.error) {
    if (rpcRes.error.code === '42883' || rpcRes.error.message?.includes('42883') || rpcRes.error.message?.includes('function nafes_teacher_delete_published_test')) {
      fail('تعذر تنفيذ العملية الآمنة لأن تحديث قاعدة البيانات المطلوب لم يُطبق بعد.', 500);
    }
    fail(rpcRes.error.message || 'فشلت عملية حذف الاختبار.');
  }

  return rpcRes.data;
}

async function teacherTestsBulkClear(db: any, b: Row, owner?: Row) {
  if(b.clear_all===true){
    const papers=must(await db.from('nafes_assessments').select('id').contains('config',{paper_review:true}).limit(1));
    if(papers?.length)fail('تتضمن النتائج أوراق مراجعة محمية؛ لا يمكن مسحها جماعيًا خارج التراجع المدقق.',409);
  }else{
    for(const id of Array.isArray(b.test_ids)?b.test_ids:[])await protectReviewedPaperTest(db,String(id));
  }
  const isClearAll = b.clear_all === true;
  const confirmWord = tidy(b.confirm_word);
  const ownerId = owner?.id || null;
  if (!ownerId) fail('معرّف مالك الحساب مطلوب لمسح النتائج.', 401);

  if (isClearAll) {
    if (confirmWord !== 'حذف جميع النتائج') {
      fail('يرجى تأكيد الحذف بكتابة «حذف جميع النتائج».');
    }
  } else {
    if (confirmWord !== 'مسح النتائج' && confirmWord !== 'حذف') {
      fail('يجب كتابة «مسح النتائج» أو «حذف» لتأكيد مسح نتائج الاختبارات المحددة.');
    }
  }

  const ids = Array.isArray(b.test_ids) ? b.test_ids : [];
  if (!isClearAll && !ids.length) fail('لم يتم تحديد أي اختبارات.');

  // Validate format of each ID upfront in Edge Function too:
  if (!isClearAll) {
    for (const tid of ids) {
      const s = String(tid || '').trim();
      if (!isUUID(s) && !s.startsWith('simulation:') && !s.startsWith('exam:')) {
        fail(`معرّف اختبار تالف أو غير صالح في المجموعة: ${s}`);
      }
      if (s.startsWith('exam:')) {
        if (!/^exam:(reading|math|science):[a-zA-Z0-9_]+:i[0-9]+:m[0-9]+$/.test(s)) {
          fail(`معرّف اختبار المؤشر تالف أو غير صالح البنية: ${s}`);
        }
        const parts = s.split(':');
        if (parts.length !== 5 || !/^[0-9]+$/.test(parts[3].slice(1)) || !/^[0-9]+$/.test(parts[4].slice(1))) {
          fail(`أرقام المؤشر أو النموذج غير صالحة في معرّف الاختبار: ${s}`);
        }
      }
      if (s.startsWith('simulation:')) {
        if (!/^simulation:[a-z0-9_]+$/.test(s)) {
          fail(`معرّف اختبار المحاكاة تالف أو غير صالح: ${s}`);
        }
      }
    }
  }

  // Single atomic PostgreSQL transaction via RPC
  const rpcRes = await db.rpc('nafes_teacher_bulk_clear_test_results', {
    p_test_ids: isClearAll ? null : ids,
    p_clear_all: isClearAll,
    p_confirm_word: confirmWord,
    p_owner_id: ownerId
  });

  if (rpcRes.error) {
    if (rpcRes.error.code === '42883' || rpcRes.error.message?.includes('42883') || rpcRes.error.message?.includes('function nafes_teacher_bulk_clear_test_results')) {
      fail('تعذر تنفيذ العملية الآمنة لأن تحديث قاعدة البيانات المطلوب لم يُطبق بعد.', 500);
    }
    fail(rpcRes.error.message || 'فشلت عملية مسح نتائج الاختبارات.');
  }

  return rpcRes.data;
}


async function manageablePublishedTest(db:any,testId:unknown,owner:Row){
  if(!isUUID(testId))fail('معرّف الاختبار غير صالح.');
  const t=must(await db.from('nafes_assessments').select('*').eq('id',String(testId)).eq('status','published').maybeSingle());
  if(!t)fail('الاختبار غير موجود أو غير منشور.',404);
  if(teacherScope(owner)!=='all'&&String(t.owner_id||'')!==String(owner.id))fail('لا يمكنك إدارة اختبار أنشأه حساب آخر.',403);
  return t;
}
async function teacherTestUpdateSchedule(db:any,b:Row,owner:Row){
  const t=await manageablePublishedTest(db,b.test_id,owner);
  const parse=(v:unknown)=>{if(v===null||v===undefined||String(v).trim()==='')return null;const d=new Date(String(v));if(!Number.isFinite(d.getTime()))fail('التاريخ غير صالح.');return d.toISOString();};
  const opens=parse(b.opens_at),closes=parse(b.closes_at);
  if(opens&&closes&&new Date(opens).getTime()>=new Date(closes).getTime())fail('وقت الإغلاق يجب أن يكون بعد وقت الفتح.');
  const config={...(t.config||{}),settings:{...(t.config?.settings||{}),opens_at:opens,closes_at:closes}};
  const saved=must(await db.from('nafes_assessments').update({config}).eq('id',t.id).eq('status','published').select().single());
  return {ok:true,test:testInfo(saved)};
}
async function teacherTestRename(db:any,b:Row,owner:Row){
  const t=await manageablePublishedTest(db,b.test_id,owner);
  const title=tidy(b.title,160);if(title.length<3)fail('اسم الاختبار قصير جدًا.');
  const saved=must(await db.from('nafes_assessments').update({title,config:{...(t.config||{}),title}}).eq('id',t.id).eq('status','published').select().single());
  return {ok:true,test:testInfo(saved)};
}
async function teacherTestSetOpen(db:any,b:Row,owner:Row){
  const t=await manageablePublishedTest(db,b.test_id,owner);
  const open=b.open===true;
  const config={...(t.config||{}),settings:{...(t.config?.settings||{}),manual_closed:!open}};
  const saved=must(await db.from('nafes_assessments').update({config}).eq('id',t.id).eq('status','published').select().single());
  return {ok:true,open,test:testInfo(saved)};
}
async function teacherTestArchive(db:any,b:Row,owner:Row){
  const t=await manageablePublishedTest(db,b.test_id,owner);
  if(!['سحب','حذف'].includes(tidy(b.confirm_word)))fail('اكتب «سحب» أو «حذف» لتأكيد إزالة الاختبار من قائمة الطلاب.');
  must(await db.from('nafes_assessments').update({status:'archived'}).eq('id',t.id).eq('status','published').select().single());
  return {ok:true,archived:true,test_id:t.id};
}
async function teacherAttemptDelete(db:any,b:Row,owner:Row){
  if(tidy(b.confirm_word)!=='حذف النتيجة')fail('تأكيد حذف النتيجة غير صحيح.');
  const source=tidy(b.source,20),attemptId=tidy(b.attempt_id,80);
  if(!['assessment','exam'].includes(source)||!isUUID(attemptId))fail('بيانات المحاولة غير صالحة.');
  if(source==='assessment'){
    const a=must(await db.from('nafes_assessment_attempts').select('id,assessment_id,student_id,is_demo,events,config').eq('id',attemptId).maybeSingle());
    if(!a||a.is_demo===true)fail('المحاولة غير موجودة.',404);
    if(a.config?.paper_review===true||a.config?.paper_review_id||Array.isArray(a.events)&&a.events.some((e:Row)=>e.type==='paper_scan'))
      fail('هذه محاولة مرتبطة بورقة مراجعة؛ استخدم التراجع الإداري المصرح به مع سبب وسجل تدقيق.',409);
    const t=must(await db.from('nafes_assessments').select('id,owner_id,config').eq('id',a.assessment_id).maybeSingle());
    if(!t)fail('الاختبار غير موجود.',404);
    const subjects=[...new Set((t.config?.sections||[]).map((s:Row)=>String(s.subject||'')))].filter(Boolean);
    const scope=teacherScope(owner);
    if(scope!=='all'&&!(subjects.length===1&&subjects[0]===scope))fail('هذه النتيجة ليست ضمن مادة حساب المعلم.',403);
    const del=must(await db.from('nafes_assessment_attempts').delete().eq('id',attemptId).select('id'));
    return {ok:true,deleted:del?.length||0};
  }
  const a=must(await db.from('nafes_exam_attempts').select('id,subject_key,is_demo').eq('id',attemptId).maybeSingle());
  if(!a||a.is_demo===true)fail('المحاولة غير موجودة.',404);
  if(teacherScope(owner)!=='all'&&!scopeAllows(owner,a.subject_key))fail('هذه النتيجة ليست ضمن مادة حساب المعلم.',403);
  const del=must(await db.from('nafes_exam_attempts').delete().eq('id',attemptId).select('id'));
  return {ok:true,deleted:del?.length||0};
}
async function teacherQuestionCreate(db:any,b:Row,owner:Row){
  assertMainAccount(owner);
  const indicatorKey=tidy(b.indicator_key,120);
  const entry=FRAMEWORK.find(i=>i.key===indicatorKey);
  if(!entry)fail('اختر مؤشرًا صحيحًا من قائمة المؤشرات.');
  const context=tidy(b.context_text,4000);
  const question=tidy(b.question_text,2000);
  if(question.length<5)fail('اكتب نص السؤال كاملًا.');
  const options=Array.isArray(b.options)?b.options.map((x:unknown)=>tidy(x,800)):[];
  if(options.length!==4||options.some((x:string)=>!x)||new Set(options.map((x:string)=>x.toLowerCase())).size!==4)fail('أدخل أربعة اختيارات مختلفة وغير فارغة.');
  const correct=Number(b.correct_index);if(!Number.isInteger(correct)||correct<0||correct>3)fail('حدد إجابة صحيحة واحدة.');
  const explanation=tidy(b.explanation,2000);if(explanation.length<3)fail('أدخل سبب الإجابة الصحيحة.');
  const cognitive=['knowledge','application','reasoning'].includes(String(b.cognitive_level))?String(b.cognitive_level):'application';
  const difficulty=['easy','medium','hard','very_hard'].includes(String(b.difficulty))?String(b.difficulty):'medium';
  const imageUrl=tidy(b.image_url,500),imageAlt=tidy(b.image_alt,300);
  let image:any=null;
  if(imageUrl){
    if(!/^https:\/\/zarie19991-bit\.github\.io\/moallimi\/question-bank\/assets\/[a-f0-9]{64}\.png$/.test(imageUrl))fail('رابط الصورة يجب أن يكون من مجلد صور بنك الأسئلة في المنصة.');
    if(!imageAlt)fail('اكتب وصفًا مختصرًا للصورة.');
    image={url:imageUrl,alt:imageAlt};
  }
  const existing=must(await db.from('nafes_question_bank').select('question_text').eq('grade_key','middle_3').eq('subject_key',entry.subject).eq('outcome_code',entry.outcome).eq('indicator_index',entry.indicator).eq('is_active',true).eq('review_status','approved'));
  const sk=stemKey({question});
  if((existing||[]).some((x:Row)=>stemKey({question:x.question_text})===sk))fail('يوجد في هذا المؤشر سؤال بنفس الصياغة؛ غيّر صياغة السؤال قبل الحفظ.',409);
  const positions=must(await db.from('nafes_question_bank').select('question_no').eq('grade_key','middle_3').eq('subject_key',entry.subject).eq('outcome_code',entry.outcome).eq('indicator_index',entry.indicator).eq('model_no',3).order('question_no',{ascending:false}).limit(1));
  const questionNo=Math.max(1,Number(positions?.[0]?.question_no||0)+1);
  const focus=entry.key;
  const evidence={
    validator:REVIEW_VERSION,
    indicator_text:entry.text,
    measurement_focus:focus,
    source_task:question,
    source_context:context||'',
    source_options:options,
    source_answer:options[correct],
    explanation,
    target_aspect:entry.text,
    content_sha256:await hash(JSON.stringify([context,question,options,imageUrl||''])),
    checks:{indicator_alignment:true,single_answer:true,distractors:true,independence:true,grade9_level:true},
    image,
    requires_image:!!image,
    manual_review:'main-account-question-designer',
    manual_reviewed_at:new Date().toISOString(),
    cognitive_operation:cognitive
  };
  const row={
    grade_key:'middle_3',subject_key:entry.subject,outcome_code:entry.outcome,indicator_index:entry.indicator,indicator_text:entry.text,
    context_text:context||null,question_text:question,options,correct_index:correct,explanation,difficulty,cognitive_level:cognitive,
    review_status:'approved',source_note:'main-account-question-designer',model_no:3,question_no:questionNo,is_active:true,
    reviewed_at:new Date().toISOString(),reviewer_note:'اعتماد يدوي من الحساب الرئيس',measurement_focus:focus,
    alignment_profile:`${focus}:reviewed-v4`,alignment_verified:true,alignment_evidence:evidence
  };
  const ins=await db.from('nafes_question_bank').insert(row).select(BANK_COLUMNS).single();
  if(ins.error?.code==='23505')fail('يوجد سؤال مطابق أو موضع مستخدم بالفعل؛ غيّر الصياغة وأعد الحفظ.',409);
  const saved=must(ins);
  return {ok:true,question:rendered(saved)};
}

async function teacher(db:any,req:Request) {
 const key=tidy(req.headers.get('x-teacher-key'),128);
 if(!/^(?:[0-9]{10}|[a-f0-9]{48,96})$/i.test(key))fail('أدخل رقم أو مفتاح دخول المعلم لعرض النتائج وإعداد الاختبارات.',401);
 const row=must(await db.from('nafes_teacher_access').select('id,label,subject_scope').eq('key_hash',await hash(key)).eq('active',true).maybeSingle());
 if(!row)fail('مفتاح دخول المعلم غير صحيح.',401);
 if(row.subject_scope!=='all'&&!SUBJECTS.includes(String(row.subject_scope)))fail('صلاحية حساب المعلم غير صالحة.',403);
 return {...row,subject_scope:String(row.subject_scope)};
}
function teacherScope(owner:Row){
 const scope=String(owner?.subject_scope||'');
 if(scope!=='all'&&!SUBJECTS.includes(scope))fail('صلاحية حساب المعلم غير صالحة.',403);
 return scope;
}
function assertMainAccount(owner:Row){if(teacherScope(owner)!=='all')fail('هذه العملية الإدارية متاحة للحساب الرئيسي فقط.',403);}
function scopeAllows(owner:Row,subject:unknown){const s=teacherScope(owner);return s==='all'||s===String(subject||'');}
function assertSubjectScope(owner:Row,subject:unknown){if(!scopeAllows(owner,subject))fail('هذه المادة ليست ضمن صلاحية حساب المعلم.',403);}
function assertIndicatorBuilderConfig(owner:Row,c:Row){
 if(c.kind==='simulation'||c.bank_source==='simulation_bank')fail('تم إيقاف قسم الاختبارات المحاكية. استخدم اختبار المؤشرات واختر مؤشرًا واحدًا أو عدة مؤشرات.',400);
 const sections=Array.isArray(c.sections)?c.sections:[];
 if(!sections.length)fail('اختر مادة واحدة على الأقل.');
 for(const s of sections)assertSubjectScope(owner,s.subject);
}
function scopedAttempt(a:Row,owner:Row){
 if(a?.source==='simulation')return null;
 const scope=teacherScope(owner);
 if(scope==='all')return a;
 const questions=(a?.questions||[]).filter((q:Row)=>String(q.subject||'')===scope);
 if(!questions.length)return null;
 const scorable=questions.filter((q:Row)=>q.scorable!==false&&q.correct!==null&&q.correct!==undefined);
 const submitted=a.status==='submitted'||!!a.submitted_at;
 const correct=scorable.filter((q:Row)=>q.correct===true).length;
 const total=scorable.length||questions.length;
 return {...a,questions,subjects:[scope],score:submitted?correct:null,total,percent:submitted&&total?Math.round(correct*10000/total)/100:(submitted?0:null)};
}
async function teacherDirectory(db:any){
 const rows=must(await db.from('nafes_teacher_access').select('id,label,subject_scope').eq('active',true));
 return new Map((rows||[]).map((x:Row)=>[String(x.id),x]));
}
async function scopedTeacherData(db:any,b:Row,owner:Row){
 const data=await teacherData(db,b);
 const scope=teacherScope(owner);
 const dir=await teacherDirectory(db);
 const attempts=(data.attempts||[]).filter((a:Row)=>a?.is_demo!==true).map((a:Row)=>scopedAttempt(a,owner)).filter(Boolean);
 const tests=(data.tests||[]).filter((t:Row)=>t.kind!=='simulation'&&(scope==='all'||(t.subjects||[]).includes(scope))).map((t:Row)=>{
   const creator=dir.get(String(t.owner_id||''));
   return {...t,created_by_label:creator?.label||((t.owner_id)?'حساب معلم':'النظام'),created_by_scope:creator?.subject_scope||null};
 });
 const indicators=(data.indicators||[]).filter((i:Row)=>scope==='all'||i.subject===scope);
 return {...data,attempts,tests,indicators};
}
function testInfo(t:Row) {const c=t.config||{},s=c.settings||{};return{id:t.kind==='legacy'?legacyTestId(t.legacy_target):t.id,owner_id:t.owner_id||null,title:t.title,kind:t.kind==='legacy'?'indicator':t.kind,simulation_mode:c.simulation_mode,bank_source:c.bank_source,subjects:(c.sections||[]).map((x:Row)=>x.subject),class_name:c.class_name||'',term:c.term||c.academic_term||'',academic_term:c.academic_term||c.term||'',school_name:c.school_name||'',teacher_name:c.teacher_name||'',principal_name:c.principal_name||'',grade_key:'middle_3',created_at:t.published_at||t.created_at,published_at:t.published_at||null,total:(c.sections||[]).reduce((n:number,x:Row)=>n+x.question_count,0),short_code:t.short_code,opens_at:s.opens_at||null,closes_at:s.closes_at||null,manual_closed:s.manual_closed===true};}
function legacyTestId(t:Row) {return`exam:${t.subject||t.subject_key}:${t.outcome||t.outcome_code}:i${t.indicator||t.indicator_index}:m${t.model||t.model_no}`;}

async function simulationCatalogCounts(db:any):Promise<Map<string,number>> {
  const simCounts=new Map<string,number>();
  try {
    const {data:rows,error}=await db.from('nafes_simulation_question_bank')
      .select('indicator_key')
      .eq('grade_key','middle_3')
      .eq('is_active',true)
      .eq('review_status','approved')
      .eq('semantic_similarity_cleared',true);
    if(!error&&rows){
      for(const r of rows){
        if(r.indicator_key){
          simCounts.set(r.indicator_key,(simCounts.get(r.indicator_key)||0)+1);
        }
      }
    }
  } catch(_) {}
  return simCounts;
}

async function catalog(db:any) {
  const counts=must(await db.rpc('nafes_teacher_catalog_counts'));
  const available=new Map<string,number>((counts||[]).map((x:Row)=>[x.key,x.available]));
  try{
    const curatedCounts=new Map<string,number>();
    for(let start=0;;start+=1000){
      const page=must(await db.from('nafes_indicator_curated_bank')
        .select('indicator_key,subject_key,quality_version')
        .in('quality_version',['science-curated-v4','math-curated-v4'])
        .order('id',{ascending:true})
        .range(start,start+999));
      for(const q of page||[])curatedCounts.set(q.indicator_key,(curatedCounts.get(q.indicator_key)||0)+1);
      if(!page||page.length<1000)break;
    }
    for(const [key,n] of curatedCounts)available.set(key,n);
  }catch(_){};
  const simCounts=await simulationCatalogCounts(db);
  const simSummary={
    reading:[...simCounts.entries()].filter(([k])=>k.startsWith('reading:')).reduce((s,[,c])=>s+c,0),
    math:[...simCounts.entries()].filter(([k])=>k.startsWith('math:')).reduce((s,[,c])=>s+c,0),
    science:[...simCounts.entries()].filter(([k])=>k.startsWith('science:')).reduce((s,[,c])=>s+c,0)
  };
  const rows=must(await db.from('nafes_simulation_forms').select('subject,model_no,created_at'));
  const forms=SUBJECTS.flatMap(subject=>Array.from({length:60},(_,i)=>({subject,model_no:i+1,question_count:30,ready:rows.some((r:Row)=>r.subject===subject&&r.model_no===i+1)})));
  const readingResources=new Map<string,Row>();
  try{
    const readingPool=await fullPool(db,'reading');
    for(const q of readingPool){
      const key=String(q.indicator_key||'');if(!key)continue;
      const x=readingResources.get(key)||{questions:0,contexts:new Map<string,number>()};
      x.questions++;
      const context=String(q.context||'').trim();
      if(context)x.contexts.set(context,(x.contexts.get(context)||0)+1);
      readingResources.set(key,x);
    }
  }catch(_){}
  const resourceMeta=(key:string)=>{
    const x=readingResources.get(key);if(!x)return{};
    const counts=[...x.contexts.values()];
    return{passage_count:counts.length,passages_with_5plus:counts.filter(n=>n>=5).length,max_questions_per_passage:counts.length?Math.max(...counts):0,reading_question_capacity:x.questions};
  };
  return{
    indicators:FRAMEWORK.map(i=>({...i,available:available.get(i.key)||0,...(i.subject==='reading'?resourceMeta(i.key):{})})),
    simulation_indicators:FRAMEWORK.map(i=>({...i,available:simCounts.get(i.key)||0})),
    simulation_summary:simSummary,
    forms,
    thresholds:THRESHOLDS
  };
}
async function findDraft(db:any,id:unknown,owner:Row) {if(!isUUID(id))fail('المسودة غير موجودة.');const t=must(await db.from('nafes_assessments').select('*').eq('id',id).eq('owner_id',owner.id).maybeSingle());if(!t)fail('المسودة غير موجودة.',404);if(t.status!=='draft')fail('نُشر الاختبار بالفعل؛ أنشئ نسخة جديدة لتغيير الأسئلة.',409);return t;}
function preview(t:Row) {return{draft_id:t.id,config:t.config,sections:t.rendered_sections};}
async function draftSections(db:any,c:Row,regenerate=false,excludeQuestionIds:unknown[]=[],poolCache?:Map<string,Row[]>):Promise<Row[]> {
  const isSimulation=c.kind==='simulation'&&c.bank_source==='simulation_bank';
  const excludedIds=new Set((Array.isArray(excludeQuestionIds)?excludeQuestionIds:[]).slice(0,2000).map(String));
  const simulationMode=c.simulation_mode==='custom'?'custom':'standard';
  const sections:Row[]=[];
  const used=new Set<string>();
  const usedStems=new Set<string>();
  const subNames:Record<string,string>={reading:'القراءة',math:'الرياضيات',science:'العلوم'};

  for(const s of c.sections){
    let pool:Row[]=[];
    let qs:Row[]=[];

    if(isSimulation){
      if(simulationMode==='custom'){
        const keys=s.indicators?.map((i:Row)=>i.key);
        pool=await simulationPool(db,s.subject,keys);
        for(const i of s.indicators||[]){
          const candidates=pool.filter(q=>q.indicator_key===i.key);
          const picked=selectIndicatorQuestions(candidates,i.count,s.subject,token(8),used,usedStems);
          qs.push(...picked);
        }
      } else {
        pool=await simulationPool(db,s.subject);
        const actual=new Set(pool.map(questionKey)).size;
        if(actual===0)fail(`لا توجد حاليًا أسئلة محاكاة معتمدة لمادة «${subNames[s.subject]||s.subject}» في بنك المحاكاة المستقل.`);
        qs=selectIndicatorQuestions(pool,s.question_count,s.subject,token(8),used,usedStems);
      }
    } else {
      const keys=(s.indicators||[]).map((i:Row)=>String(i.key)).sort();
      const cacheKey=s.subject+'|'+keys.join(',');
      if(poolCache?.has(cacheKey))pool=poolCache.get(cacheKey)!;
      else{
        pool=await fullPool(db,s.subject,keys);
        if(poolCache)poolCache.set(cacheKey,pool);
      }
      if(excludedIds.size)pool=pool.filter(q=>!excludedIds.has(String(q.id)));
      const levelPlan=(s.subject==='math'||s.subject==='science')
        ?allocateSectionLevelTargets(s.indicators||[],pool,s.subject,s.question_count,c.cognitive_targets||null,s.fixed_model||null)
        :null;
      for(const i of s.indicators){
        let candidates=pool.filter(q=>q.indicator_key===i.key);
        if(s.fixed_model)candidates=candidates.filter(q=>q.model_no===s.fixed_model);
        const picked=(c.review_passage_mode===true&&s.subject==='reading')
          ?selectReadingPassageQuestions(candidates,i.count,token(8),used,usedStems)
          :((s.subject==='math'||s.subject==='science'||s.subject==='reading')
            ?selectCuratedIndicatorQuestions(
              candidates,
              i.count,
              s.subject,
              token(8),
              used,
              usedStems,
              s.subject==='reading'
                ?levelTargets('reading',i.count,c.cognitive_targets||null)
                :levelPlan?.get(String(i.key))
            )
            :selectIndicatorQuestions(candidates,i.count,s.subject,token(8),used,usedStems));
        qs.push(...picked);
      }
      // Final student-facing order is pedagogical, not random:
      // indicator/passage -> knowledge -> application -> reasoning.
      qs=sequenceLearningQuestions(qs,s.subject,s.indicators||[]);
    }

    sections.push({...s,questions:qs});
  }
  return sections;
}
async function codeFor(db:any) {for(let n=0;n<6;n++){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=[...crypto.getRandomValues(new Uint8Array(8))].map(x=>chars[x%chars.length]).join('');const r=must(await db.from('nafes_assessments').select('id').eq('short_code',code).maybeSingle());if(!r)return code;}fail('تعذر إنشاء رمز الاختبار؛ أعد المحاولة.');}
async function assessment(db:any,code:unknown) {if(!/^[A-Z2-9]{8}$/.test(String(code||'')))fail('رمز الاختبار غير صالح.',404);const t=must(await db.from('nafes_assessments').select('*').eq('short_code',code).eq('status','published').maybeSingle());if(!t)fail('رابط الاختبار غير موجود.',404);return t;}
function studentInfo(t:Row) {const c=t.config;return{id:t.id,code:t.short_code,title:t.title,kind:t.kind,class_name:c.class_name,term:c.term||c.academic_term||'',academic_term:c.academic_term||c.term||'',school_name:c.school_name,teacher_name:c.teacher_name,grade_key:'middle_3',identity_mode:c.identity_mode,settings:c.settings,sections:(c.sections||[]).map((s:Row)=>({subject:s.subject,question_count:s.question_count,duration_minutes:s.duration_minutes,calculator:s.calculator})),ready:true,...(t.kind==='legacy'?{legacy_url:new URL(`exam.html?s=${t.legacy_target.subject}&o=${t.legacy_target.outcome}&i=${t.legacy_target.indicator}&m=${t.legacy_target.model}`,BASE).href}:{})};}
const snapshotKey=(q:Row)=>JSON.stringify([q.id,q.context||null,q.question,q.options,q.correctIndex,q.explanation||null,q.indicator_key,q.indicator_text,q.cognitive_level,q.difficulty,q.model_no,q.question_no,q.image?.url||null,q.image?.alt||null]);
const flat=(a:Row)=>(a.rendered_sections||[]).flatMap((s:Row)=>s.questions||[]);
async function finish(db:any,a:Row,answers=a.answers) {if(a.submitted_at)return a;const result=gradeSections(a.rendered_sections,answers);const end=new Date(Math.min(Date.now(),new Date(a.expires_at).getTime())).toISOString();const r=must(await db.from('nafes_assessment_attempts').update({answers,...result,submitted_at:end,version:a.version+1}).eq('id',a.id).eq('version',a.version).is('submitted_at',null).select().maybeSingle());return r||must(await db.from('nafes_assessment_attempts').select('*').eq('id',a.id).single());}
function attemptResponse(a:Row) {const c=a.config,s=c.settings;const response:Row={attempt_id:a.id,submitted:!!a.submitted_at,expires_at:a.expires_at,started_at:a.started_at,section_started_at:a.section_started_at,current_section:a.section_index,cursor:a.cursor,version:a.version,answers:a.answers,sections:publicSections(a.rendered_sections),settings:s,student_name:a.student_name,demo_mode:a.is_demo===true};if(a.submitted_at){if(s.show_result)Object.assign(response,{score:a.score,total:a.total,percent:a.percent,section_scores:a.section_scores});else response.result_hidden=true;if(s.show_correct_count)response.correct_count=a.score;if(s.show_indicator_result){const groups=new Map<string,Row[]>();for(const q of flat(a)){const key=indicatorOf(q),g=groups.get(key)||[];g.push(q);groups.set(key,g);}response.indicators=[...groups].map(([key,qs])=>({key,text:qs[0].indicator_text,...gradeSections([{subject:qs[0].subject,questions:qs}],a.answers)}));}if(s.show_answers)response.review=flat(a).map(q=>({id:q.id,correct_index:q.correctIndex,explanation:q.explanation,indicator_text:q.indicator_text}));}return response;}
async function saveState(db:any,a:Row,body:Row) {
 if(a.submitted_at)return a;const now=Date.now();if(now>=new Date(a.expires_at).getTime())return await finish(db,a);
 const s=a.config.settings;let index=a.section_index,cursor=a.cursor,sectionStarted=a.section_started_at;const section=a.rendered_sections[index],deadline=new Date(sectionStarted).getTime()+section.duration_minutes*60000;
 const raw=cleanAnswers(flat(a),body.answers),answers={...a.answers};
 if(now>=new Date(sectionStarted).getTime()&&now<=deadline){for(let i=0;i<section.questions.length;i++){const q=section.questions[i];if(s.allow_back||i===cursor){if(Object.hasOwn(raw,q.id))answers[q.id]=raw[q.id];}}
  const requested=Number(body.cursor);if(Number.isInteger(requested)&&requested>=0&&requested<section.questions.length&&(s.allow_back||requested===cursor||requested===cursor+1))cursor=requested;
 }
 const advance=body.action==='assessment_advance'||now>deadline;
 if(advance){if(index===a.rendered_sections.length-1)return await finish(db,a,answers);index++;cursor=0;sectionStarted=new Date(Math.min(now,deadline)+s.break_minutes*60000).toISOString();}
 let events=a.events||[];if(s.log_visibility&&['hidden','visible','page_leave','copy_blocked','print_blocked'].includes(body.event?.type)&&events.length<2000)events=[...events,{type:body.event.type,at:new Date().toISOString(),section:index}];
 if(body.action==='assessment_finish')return await finish(db,a,answers);
 const update={answers,cursor,section_index:index,section_started_at:sectionStarted,events,lease_until:new Date(now+45000).toISOString(),version:a.version+1};
 const row=must(await db.from('nafes_assessment_attempts').update(update).eq('id',a.id).eq('version',a.version).is('submitted_at',null).select().maybeSingle());if(!row)fail('تغيرت المحاولة أثناء الحفظ؛ أعد المحاولة.',409);return row;
}
async function studentAction(db:any,body:Row) {
 async function demoStudentByCode(codeValue:unknown){
   const demoCode=String(codeValue||'').trim();
   if(!/^\d{6}$/.test(demoCode))fail('رمز حساب الطالب التجريبي غير صحيح.',401);
   const demoHash=await hash(demoCode);
   const student=must(await db.from('nafes_students')
     .select('id,full_name,class_name,national_id_last3,is_demo,is_active')
     .eq('is_demo',true).eq('is_active',true).eq('demo_access_hash',demoHash).maybeSingle());
   if(!student)fail('رمز حساب الطالب التجريبي غير صحيح.',401);
   return student;
 }
 if(body.action==='assessment_demo_catalog'){
   const student=await demoStudentByCode(body.demo_code);
   const rows=must(await db.from('nafes_assessments')
     .select('id,title,short_code,kind,status,config,published_at')
     .eq('status','published').neq('kind','simulation')
     .order('published_at',{ascending:false}));
   const now=Date.now();
   const tests=(rows||[]).map((t:Row)=>{
     const settings=t.config?.settings||{};
     const opens=settings.opens_at?new Date(settings.opens_at).getTime():null;
     const closes=settings.closes_at?new Date(settings.closes_at).getTime():null;
     const availability=settings.manual_closed===true?'paused':opens&&now<opens?'upcoming':closes&&now>closes?'closed':'open';
     return {
       id:t.id,title:t.title,short_code:t.short_code,availability,
       opens_at:settings.opens_at||null,closes_at:settings.closes_at||null,
       subjects:(t.config?.sections||[]).map((s:Row)=>s.subject),
       question_count:(t.config?.sections||[]).reduce((n:number,s:Row)=>n+Number(s.question_count||0),0),
       class_name:t.config?.class_name||'',teacher_name:t.config?.teacher_name||'',published_at:t.published_at
     };
   });
   return {ok:true,demo:true,student:{full_name:student.full_name,class_name:student.class_name,national_id_last3:student.national_id_last3},tests};
 }
 if(body.action==='assessment_info'){const t=await assessment(db,body.code);if(t.config?.settings?.manual_closed===true)fail('هذا الاختبار موقوف مؤقتًا من المعلم.',403);return studentInfo(t);}
 if(body.action==='assessment_training'){
   const t=await assessment(db,body.code);
   if(t.kind==='legacy')fail('التدريب المخصص متاح للاختبارات المنشورة من النظام الجديد فقط.',409);
   const student=await verifyStudentIdentity(db,String(body.student_name||''),String(body.student_no||body.national_id_last3||''),String(body.class_name||''));
   const attempts=must(await db.from('nafes_assessment_attempts')
     .select('*')
     .eq('assessment_id',t.id)
     .eq('student_key',student.id)
     .not('submitted_at','is',null)
     .order('attempt_no',{ascending:false})
     .limit(1));
   const a=attempts?.[0];
   if(!a)fail('أكمل هذا الاختبار أولًا قبل فتح تدريبك المخصص.',403);
   const groups=new Map<string,Row[]>();
   for(const q of flat(a)){
     const key=indicatorOf(q);
     const list=groups.get(key)||[];
     list.push(q);
     groups.set(key,list);
   }
   const summaries=[...groups].map(([key,qs])=>{
     const result=gradeSections([{subject:qs[0].subject,questions:qs}],a.answers||{});
     const percent=Number(result.percent||0);
     const training_level=percent>=THRESHOLDS.mastered?'enrichment':percent>=THRESHOLDS.near?'reinforcement':'remedial';
     return {key,text:qs[0].indicator_text||FRAMEWORK.find(i=>i.key===key)?.text||key,subject:qs[0].subject,percent,score:result.score,total:result.total,training_level};
   });
   const keys=summaries.map(x=>x.key);
   let rows:Row[]=[];
   if(keys.length){
     rows=must(await db.from('nafes_training_question_bank')
       .select('id,subject_key,indicator_key,indicator_text,training_level,question_no,context_text,question_text,options,correct_index,explanation,difficulty,cognitive_level,separation_review_evidence')
       .eq('grade_key','middle_3')
       .eq('is_active',true)
       .eq('review_status','approved')
       .in('indicator_key',keys)
       .order('indicator_key',{ascending:true})
       .order('training_level',{ascending:true})
       .order('question_no',{ascending:true}));
   }
   const valid=(row:Row)=>{
     const ev=row.separation_review_evidence;
     return !!ev&&typeof ev==='object'&&!Array.isArray(ev)&&ev.separation_confirmed===true&&ev.original_training_content===true&&ev.reviewed_against_assessment_bank===true;
   };
   const indicators=summaries.map(summary=>{
     const questions=rows
       .filter((q:Row)=>q.indicator_key===summary.key&&q.training_level===summary.training_level&&valid(q))
       .slice(0,5)
       .map((q:Row)=>({id:q.id,context:q.context_text||null,question:q.question_text,options:q.options,correct_index:q.correct_index,explanation:q.explanation||'',difficulty:q.difficulty,cognitive_level:q.cognitive_level}));
     return {...summary,status:questions.length?'ready':'needs_content',questions};
   });
   return {ok:true,assessment_code:t.short_code,assessment_id:t.id,title:t.title,student_name:a.student_name,attempt_id:a.id,indicators};
 }
 if(body.action==='assessment_start'){
   const t=await assessment(db,body.code);if(t.kind==='legacy')return studentInfo(t);const c=t.config,s=c.settings,now=Date.now();
   if(s.manual_closed===true)fail('هذا الاختبار موقوف مؤقتًا من المعلم.',403);
   if(s.opens_at&&now<new Date(s.opens_at).getTime())fail('لم يبدأ وقت إتاحة الاختبار بعد.',403);
   if(s.closes_at&&now>new Date(s.closes_at).getTime())fail('انتهى وقت إتاحة الاختبار.',403);
   const session=tidy(body.session_id,96);if(!session)fail('بيانات الجلسة غير مكتملة.');
   const requestedDemo=String(body.demo_code||'').trim();
   const student=/^\d{6}$/.test(requestedDemo)
     ? await demoStudentByCode(requestedDemo)
     : await verifyStudentIdentity(db, String(body.student_name || ''), String(body.student_no || body.national_id_last3 || ''), String(body.class_name || ''));
   const isDemo=student.is_demo===true;
   const name=student.full_name, no=student.national_id_last3, student_id=student.id, student_key=student.id;
   const className=student.class_name || c.class_name || tidy(body.class_name,80);
   if(!isDemo&&c.identity_mode==='list'&&!c.roster.some((n:string)=>normalizeArabicName(n)===normalizeArabicName(name)))fail('اكتب اسمك كما هو في كشف الفصل.',403);
   const previous=must(await db.from('nafes_assessment_attempts').select('*').eq('assessment_id',t.id).eq('student_key',student_key).order('attempt_no',{ascending:false}));
   for(const a of previous)if(!a.submitted_at&&now>=new Date(a.expires_at).getTime())Object.assign(a,await finish(db,a));
   let active=previous.find((a:Row)=>!a.submitted_at);const access=token();
   if(active){if(!isDemo&&s.lock_session&&active.session_id!==session&&now<new Date(active.lease_until).getTime())fail('المحاولة مفتوحة في جهاز أو تبويب آخر. أغلقها هناك وانتظر ٤٥ ثانية لإكمالها هنا.',409);
    active=must(await db.from('nafes_assessment_attempts').update({session_id:session,access_hash:await hash(access),lease_until:new Date(now+45000).toISOString(),version:active.version+1}).eq('id',active.id).eq('version',active.version).is('submitted_at',null).select().maybeSingle());if(!active)fail('فُتحت المحاولة في تبويب آخر؛ أعد المحاولة.',409);return{...attemptResponse(active),access_token:access,resumed:true};}
   const completed=previous.find((a:Row)=>!!a.submitted_at);
   if(completed&&!isDemo&&body.start_new_attempt!==true){
     return {...attemptResponse(completed),resumed:true,completed_before:true,training_url:`${BASE}training.html?t=${t.short_code}`};
   }
   if(!isDemo&&previous.length>=s.attempts){if(previous[0])return{...attemptResponse(previous[0]),attempts_exhausted:true,training_url:`${BASE}training.html?t=${t.short_code}`};fail('استُنفد عدد المحاولات المسموح به.',409);}
   const seed=token(12);const rand=randomFrom(seed);const sections=t.rendered_sections.map((section:Row)=>{
     // Indicator tests preserve the learning progression. Only simulation mode may randomize question order.
     const ordered=(c.kind==='simulation'&&s.shuffle_questions)
       ?shuffle(section.questions,rand)
       :sequenceLearningQuestions(section.questions,section.subject,section.indicators||[]);
     return{...section,questions:ordered.map((q:Row)=>s.shuffle_options?permuteQuestion(q,rand):q)};
   });
   const duration=c.sections.reduce((n:number,sec:Row)=>n+sec.duration_minutes,0)+s.break_minutes*(sections.length-1);const expires=new Date(Math.min(now+duration*60000,s.closes_at?new Date(s.closes_at).getTime():Infinity)).toISOString();
   const r=await db.from('nafes_assessment_attempts').insert({assessment_id:t.id,student_id,student_name:name,student_no:no,student_key,class_name:className,attempt_no:previous.length+1,config:c,rendered_sections:sections,session_id:session,access_hash:await hash(access),lease_until:new Date(now+45000).toISOString(),expires_at:expires,is_demo:isDemo}).select().single();if(r.error?.code==='23505')fail('بدأت محاولة لهذا الطالب؛ أعد فتحها من التبويب الأصلي.',409);const created=must(r);return{...attemptResponse(created),access_token:access,resumed:false};
 }
 if(!isUUID(body.attempt_id)||!body.access_token)fail('تعذر التحقق من المحاولة.',403);let a=must(await db.from('nafes_assessment_attempts').select('*').eq('id',body.attempt_id).eq('access_hash',await hash(String(body.access_token))).maybeSingle());if(!a)fail('تعذر التحقق من المحاولة.',403);
 if(!a.submitted_at&&a.config.settings.lock_session&&a.session_id!==body.session_id)fail('المحاولة قيد الاستخدام في تبويب آخر.',409);
 if(!['assessment_save','assessment_finish','assessment_advance','assessment_resume','assessment_event'].includes(body.action))fail('إجراء غير معروف.');
 if(body.action==='assessment_resume'&&!a.submitted_at&&Date.now()<new Date(a.expires_at).getTime())return attemptResponse(a);
 a=await saveState(db,a,body);return{ok:true,...attemptResponse(a)};
}
const SOURCES:Row={exam:'nafes_exam_attempts',simulation:'nafes_simulation_attempts',assessment:'nafes_assessment_attempts'};
const READING_FOCUS=['vocab_context','vocab_definition','vocab_classify','vocab_distinguish','vocab_use','main_structure','implicit_questions','compare_texts','fact_opinion','relationships','emotion_language','credibility_solutions','values_impact','arguments_evidence','summary_organize','problem_solving'];
async function metadata(db:any,rows:Row[],source:string) {
  for(const a of rows)for(const q of (source==='exam'?(a.rendered_questions||[]):flat(a)))q.question_fingerprint=await hash(questionKey(q));
  const map=new Map<string,Row>();
  if(source==='assessment'||source==='exam')return map;
  // For legacy simulation attempts (nafes_simulation_attempts) only:
  // Exclude any questions belonging to simulation_bank
  const ids=[...new Set(rows.flatMap(a=>flat(a)).filter(q=>q.bank_source!=='simulation_bank').map(q=>q.id).filter(isUUID))];
  for(let i=0;i<ids.length;i+=150){
    const data=must(await db.from('nafes_question_bank').select('id,subject_key,outcome_code,indicator_index,indicator_text').in('id',ids.slice(i,i+150)));
    for(const q of data||[])map.set(q.id,q);
  }
  return map;
}
function canonical(a:Row,source:string,map:Map<string,Row>,test?:Row):Row {
 const c=a.config||{};const sections=source==='exam'?[{subject:a.subject_key,questions:a.rendered_questions||[]}]:a.rendered_sections||[];
 let warning='';const qs=sections.flatMap((sec:Row)=>sec.questions.map((q:Row)=>{
  const m=map.get(q.id);let key=q.indicator_key;if(!key&&source==='exam')key=`${a.subject_key}:${a.outcome_code}:i${a.indicator_index}`;
  if(!key&&m)key=`${m.subject_key}:${m.outcome_code}:i${m.indicator_index}`;
  if(!key&&q.measurement_focus){const f=FRAMEWORK.find(i=>i.key===q.measurement_focus);if(f)key=f.key;else if(sec.subject==='reading'){const pos=READING_FOCUS.indexOf(q.measurement_focus);if(pos>=0)key=FRAMEWORK.filter(i=>i.subject==='reading')[pos]?.key;}}
  const indicator=FRAMEWORK.find(i=>i.key===key);const correct_index=Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<q.options?.length?q.correctIndex:null;const answer=Number.isInteger(a.answers?.[q.id])&&a.answers[q.id]>=0&&a.answers[q.id]<q.options?.length?a.answers[q.id]:null;
  if(correct_index===null)warning='تحتوي الورقة التاريخية على مفتاح إجابة غير صالح؛ حُفظت الدرجة الأصلية، ولا تدخل هذه المحاولة في تقدير المستوى أو التحسن.';
  return{id:q.id,question:q.question,question_fingerprint:q.question_fingerprint,subject:sec.subject,indicator_key:key||null,indicator_text:q.indicator_text||indicator?.text||m?.indicator_text||'لم يُحفظ ارتباط هذا السؤال بمؤشر',answer,correct:correct_index===null?null:answer===correct_index,scorable:correct_index!==null,correct_index};
 }));
 const id=source==='exam'?legacyTestId(a):source==='simulation'?`simulation:${a.simulation_key}`:a.assessment_id;
const submitted=!!a.submitted_at;const levelTotal=a.total||qs.length;return{id:a.id,source,is_demo:a.is_demo===true,test_id:id,title:test?.title||c.title||(source==='exam'?`اختبار مؤشر ${a.indicator_index} — النموذج ${a.model_no}`:'اختبار نافس'),kind:source==='exam'?'indicator':source==='simulation'?'simulation':c.kind,subjects:[...new Set(sections.map((s:Row)=>s.subject))],student_id:a.student_id||(isUUID(a.student_key)?a.student_key:null),student_key:a.student_key,student_name:a.student_name,student_no:a.student_no,class_name:a.class_name||c.class_name||'',school_name:a.school_name||'',teacher_name:a.teacher_name||'',principal_name:a.principal_name||'',grade_key:'middle_3',started_at:a.started_at,submitted_at:a.submitted_at,expires_at:a.expires_at,elapsed_seconds:submitted?Math.max(0,Math.round((Math.min(new Date(a.submitted_at).getTime(),new Date(a.expires_at).getTime())-new Date(a.started_at).getTime())/1000)):null,status:submitted?'submitted':Date.now()>new Date(a.expires_at).getTime()?'expired':'in_progress',score:submitted?a.score:null,total:levelTotal,percent:submitted?a.percent:null,questions:qs,events:a.events||[],...(warning?{snapshot_warning:warning}:{})};
}
async function teacherData(db:any,b:Row) {
 const limit=Math.min(100,Math.max(1,Math.trunc(Number(b.limit)||100))),cursor=Math.max(0,Math.trunc(Number(b.cursor)||0));
 const page=must(await db.rpc('nafes_teacher_attempt_page',{p_cursor:cursor,p_limit:limit}));const attempts:Row[]=[];const offset=page.total;for(const source of Object.keys(SOURCES)){const rows=page.rows.filter((x:Row)=>x.source===source).map((x:Row)=>x.row).filter((a:Row)=>a?.is_demo!==true);if(!rows.length)continue;const map=await metadata(db,rows,source);attempts.push(...rows.map((a:Row)=>canonical(a,source,map)));}
 let tests:Row[]=[];if(cursor===0){const published=must(await db.from('nafes_assessments').select('id,owner_id,title,kind,status,config,short_code,created_at,published_at,legacy_target').eq('status','published').neq('kind','simulation'));tests=published.map(testInfo);}
 return{attempts,tests,indicators:cursor===0?FRAMEWORK:[],thresholds:THRESHOLDS,next_cursor:cursor+limit<offset?cursor+limit:null};
}

function validatePaperReviewPayload(raw:unknown,owner:Row):Row {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('بيانات المراجعة الورقية غير مكتملة.');
  const p=raw as Row;
  const reviewId=tidy(p.review_id,80);
  if(!/^R[A-Z0-9_-]{4,79}$/i.test(reviewId))fail('معرّف المراجعة الورقية غير صالح.');
  const requested=Array.isArray(p.subjects)?p.subjects:[p.subject];
  const subjects=[...new Set(requested.map((x:unknown)=>tidy(x,20)).filter((x:string)=>SUBJECTS.includes(x)))];
  if(!subjects.length)fail('اختر مادة واحدة على الأقل للمراجعة.');
  for(const subject of subjects)assertSubjectScope(owner,subject);
  const subject=subjects[0];
  const models=Array.isArray(p.models)?p.models:[];
  const keys=Array.isArray(p.answer_keys)?p.answer_keys:[];
  const assignments=Array.isArray(p.assignments)?p.assignments:[];
  if(models.length<1||models.length>10)fail('عدد نماذج المراجعة يجب أن يكون من ١ إلى ١٠.');
  if(keys.length!==models.length)fail('مفاتيح الإجابة لا تطابق عدد النماذج.');
  if(assignments.length>500)fail('عدد الطلاب في المراجعة أكبر من الحد المسموح.');
  const compact={
    ...p,
    review_id:reviewId,
    title:tidy(p.title,160)||'اختبار ورقي',
    subject,subjects,
    class_name:tidy(p.class_name,80),
    question_count:Number(p.question_count||0),
    question_start:Number(p.question_start||1),
    model_count:Number(p.model_count||models.length),
    models,answer_keys:keys,assignments,
    indicator_counts:Array.isArray(p.indicator_counts)?p.indicator_counts:[],
    saved_at:tidy(p.saved_at,80)||new Date().toISOString()
  };
  if(!Number.isInteger(compact.question_count)||compact.question_count<10||compact.question_count>60)fail('عدد أسئلة الاختبار يجب أن يكون من ١٠ إلى ٦٠ سؤالًا.');
  for(const model of models){
    for(const q of Array.isArray(model?.questions)?model.questions:[]){
      const indicator=tidy(q?.indicator,160);
      const entry=FRAMEWORK.find(x=>x.key===indicator);
      if(entry&&!subjects.includes(entry.subject))fail('يوجد سؤال من مادة غير محددة ضمن الاختبار.');
    }
  }
  const bytes=new TextEncoder().encode(JSON.stringify(compact)).byteLength;
  if(bytes>2500000)fail('حجم بيانات المراجعة أكبر من الحد المسموح.');
  return compact;
}
async function teacherPaperReviewUpsert(db:any,b:Row,owner:Row){
  const payload=validatePaperReviewPayload(b.review||b.payload,owner);
  const row={
    owner_id:owner.id,review_id:payload.review_id,title:payload.title,subject:payload.subject,subjects:payload.subjects,
    class_name:payload.class_name||'',payload,updated_at:new Date().toISOString()
  };
  const existing=must(await db.from('nafes_paper_reviews').select('id').eq('owner_id',owner.id).eq('review_id',payload.review_id).maybeSingle());
  const saved=existing
    ?must(await db.from('nafes_paper_reviews').update(row).eq('id',existing.id).select('id,review_id,title,subject,subjects,class_name,updated_at').single())
    :must(await db.from('nafes_paper_reviews').insert(row).select('id,review_id,title,subject,subjects,class_name,updated_at').single());
  return{ok:true,review:saved};
}
async function teacherPaperReviewGet(db:any,b:Row,owner:Row){
  let q=db.from('nafes_paper_reviews').select('id,review_id,title,subject,subjects,class_name,payload,created_at,updated_at');
  if(teacherScope(owner)!=='all')q=q.eq('owner_id',owner.id);
  const reviewId=tidy(b.review_id,80);
  if(reviewId)q=q.eq('review_id',reviewId);
  else q=q.order('updated_at',{ascending:false}).limit(1);
  const row=must(await q.maybeSingle());
  if(!row)return{ok:true,review:null};
  const subjects=(Array.isArray(row.subjects)&&row.subjects.length?row.subjects:[row.subject]).filter((x:string)=>SUBJECTS.includes(x));
  for(const subject of subjects)assertSubjectScope(owner,subject);
  return{ok:true,review:{...row,subjects,payload:{...row.payload,subjects}}};
}
async function teacherPaperReviewList(db:any,owner:Row){
  let q=db.from('nafes_paper_reviews').select('id,review_id,title,subject,subjects,class_name,created_at,updated_at,owner_id').order('updated_at',{ascending:false}).limit(200);
  const scope=teacherScope(owner);
  if(scope!=='all')q=q.eq('owner_id',owner.id);
  const rows=must(await q);
  const visible=(rows||[]).filter((row:Row)=>{
    const subjects=(Array.isArray(row.subjects)&&row.subjects.length?row.subjects:[row.subject]).filter((x:string)=>SUBJECTS.includes(x));
    return scope==='all'||(subjects.length===1&&subjects[0]===scope);
  });
  return{ok:true,reviews:visible};
}

async function teacherPaperReviewSave(db:any,b:Row,owner:Row){
  b=await reviewedScanPayload(db,b,owner);
  const reviewId=tidy(b.review_id,80);
  if(!/^R[A-Z0-9_-]{4,79}$/i.test(reviewId))fail('معرّف المراجعة الورقية غير صالح.');
  const title=tidy(b.title,160)||'اختبار ورقي';
  const models=Array.isArray(b.models)?b.models:[];
  const answerKeys=Array.isArray(b.answer_keys)?b.answer_keys:[];
  const results=Array.isArray(b.results)?b.results:[];
  if(!models.length||!answerKeys.length)fail('نماذج المراجعة أو مفاتيح الإجابة غير مكتملة.');
  if(!results.length)fail('لا توجد نتائج لاعتمادها.');
  if(results.length>300)fail('عدد النتائج في الدفعة أكبر من الحد المسموح.');

  const subjectCandidates:unknown[]=[
    ...(Array.isArray(b.subjects)?b.subjects:[]),b.subject,
    ...models.flatMap((m:Row)=>Array.isArray(m?.questions)?m.questions.flatMap((q:Row)=>[q?.subject,String(q?.indicator||'').split(':')[0]]):[]),
    ...(Array.isArray(b.indicator_counts)?b.indicator_counts.flatMap((x:Row)=>[x?.subject,String(x?.key||'').split(':')[0]]):[])
  ];
  const subjects=[...new Set(subjectCandidates.map(x=>tidy(x,20)).filter(x=>SUBJECTS.includes(x)))];
  if(!subjects.length)fail('مواد المراجعة غير صحيحة.');
  for(const subject of subjects)assertSubjectScope(owner,subject);
  const subject=subjects[0],className=tidy(b.class_name,80);

  const keyMap=new Map<string,Row>();
  for(const row of answerKeys){
    const model=tidy(row?.model,12),answers=Array.isArray(row?.answers)?row.answers:[];
    if(!model||!answers.length)continue;
    keyMap.set(model,{model,answers});
  }

  const modelMap=new Map<string,Row>();
  for(const row of models){
    const model=tidy(row?.model,12),questions=Array.isArray(row?.questions)?row.questions:[];
    if(!model||!questions.length)continue;
    const key=keyMap.get(model);
    if(!key||key.answers.length!==questions.length)fail('مفتاح الإجابة لا يطابق نموذج '+model+'.');
    const keyed=new Map((key.answers||[]).map((a:Row)=>[String(a.question_id||''),a]));
    const rendered=questions.map((q:Row,i:number)=>{
      const id=tidy(q.id||q.question_id,120);
      if(!id)fail('يوجد سؤال بلا معرّف في نموذج '+model+'.');
      const options=Array.isArray(q.options)?q.options.map((x:unknown)=>tidy(x,800)):[];
      if(options.length!==4||options.some((x:string)=>!x))fail('أحد أسئلة نموذج '+model+' لا يحتوي أربعة اختيارات صالحة.');
      const k=keyed.get(id)||key.answers[i];
      const correctIndex=Number(k?.correct_index);
      if(!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3)fail('مفتاح إجابة غير صالح في نموذج '+model+'.');
      const indicatorKey=tidy(k?.indicator||q.indicator,160);
      const entry=FRAMEWORK.find(x=>x.key===indicatorKey);
      if(!entry)fail('ارتباط سؤال بمؤشر غير صالح في نموذج '+model+'.');
      const questionSubject=tidy(q.subject||k?.subject,20)||entry.subject;
      if(questionSubject!==entry.subject||!subjects.includes(questionSubject))fail('مادة السؤال لا تطابق المؤشر في نموذج '+model+'.');
      return{
        id,subject:questionSubject,context:tidy(q.context,8000)||null,question:tidy(q.question,2400),options,
        correctIndex,outcome:entry.outcome,indicator:entry.indicator,
        indicator_key:entry.key,indicator_text:entry.text,
        cognitive_level:tidy(q.cognitive_level,40)||null,difficulty:tidy(q.difficulty,40)||null,
        image:q.image_url?{url:tidy(q.image_url,800),alt:tidy(q.image_alt,300)}:null,
        paper_review:true
      };
    });
    modelMap.set(model,{model,questions:rendered});
  }
  if(!modelMap.size)fail('لم يتم العثور على نماذج صالحة للمراجعة.');

  const firstModel=[...modelMap.values()][0];
  const indicatorRaw=Array.isArray(b.indicator_counts)?b.indicator_counts:[];
  const inferred=new Map<string,number>();
  for(const q of firstModel.questions)inferred.set(q.indicator_key,(inferred.get(q.indicator_key)||0)+1);
  const indicators=(indicatorRaw.length?indicatorRaw:[...inferred].map(([key,count])=>({key,count})))
    .map((x:Row)=>{
      const key=tidy(x.key,160),entry=FRAMEWORK.find(f=>f.key===key);
      return entry?{key,count:Number(x.count||0),subject:entry.subject}:null;
    })
    .filter((x:Row|null)=>!!x&&subjects.includes(x.subject)&&Number.isInteger(x.count)&&x.count>0) as Row[];

  const sectionForQuestions=(questions:Row[])=>subjects.map(sectionSubject=>{
    const sectionQuestions=questions.filter(q=>q.subject===sectionSubject);
    return{subject:sectionSubject,question_count:sectionQuestions.length,duration_minutes:5,calculator:sectionSubject==='math',questions:sectionQuestions};
  }).filter(sec=>sec.questions.length);

  const configSections=subjects.map(sectionSubject=>{
    const question_count=firstModel.questions.filter((q:Row)=>q.subject===sectionSubject).length;
    const sectionIndicators=indicators.filter((x:Row)=>x.subject===sectionSubject).map((x:Row)=>({key:x.key,count:x.count}));
    return{subject:sectionSubject,question_count,duration_minutes:5,calculator:sectionSubject==='math',model_no:1,indicators:sectionIndicators};
  }).filter(sec=>sec.question_count>0);

  const questionCount=firstModel.questions.length;
  const config={
    paper_review:true,paper_review_id:reviewId,paper_subjects:subjects,kind:'multi_indicator',grade_key:'middle_3',title,class_name:className,
    term:'الفصل الدراسي الأول',academic_term:'الفصل الدراسي الأول',school_name:'مدرسة ابن سينا المتوسطة',
    teacher_name:'',principal_name:'',identity_mode:'list',roster:results.map((r:Row)=>tidy(r.student_name,120)).filter(Boolean),
    sections:configSections,count_mode:'per_indicator',
    settings:{show_result:false,show_answers:false,show_indicator_result:true,show_correct_count:true,shuffle_questions:false,shuffle_options:false,allow_copy:false,disable_right_click:true,disable_print:true,disable_shortcuts:true,allow_back:true,one_per_page:false,lock_session:false,log_visibility:false,watermark:false,opens_at:null,closes_at:null,attempts:1,break_minutes:0,manual_closed:true}
  };

  const assessmentSections=sectionForQuestions(firstModel.questions);

  const students=must(await db.from('nafes_students').select('id,full_name,name_normalized,class_name,national_id_last3,is_demo,is_active').eq('is_demo',false));
  const studentById=new Map((students||[]).map((st:Row)=>[String(st.id),st]));
  const now=new Date(),submittedAt=now.toISOString(),expiresAt=new Date(now.getTime()+5*60000).toISOString();
  const saved:Row[]=[];
  const prepared:Row[]=[];

  for(const result of results){
    const model=tidy(result.model,12),m=modelMap.get(model);
    if(!m)fail('نموذج نتيجة غير معروف: '+model);
    let student=isUUID(result.student_id)?studentById.get(String(result.student_id)):null;
     // A reviewed sheet UUID is authoritative. Names cannot silently choose another pupil.
    if(!student)fail('تعذر ربط نتيجة الطالب «'+tidy(result.student_name,120)+'» بسجل الطلاب.');
    const sections=sectionForQuestions(m.questions);
    const answers:Row={};
    const rawAnswers=Array.isArray(result.answers)?result.answers:[];
    for(let i=0;i<m.questions.length;i++){
      const a=rawAnswers[i],selected=a?.selected;
      if(['correct','incorrect'].includes(a?.state)&&a?.status==='clear'&&Number.isInteger(selected)&&selected>=0&&selected<4)answers[m.questions[i].id]=selected;
    }
    const graded=gradeSections(sections,answers);
    const attemptConfig={...config,paper_model:model};
    const rawOmr=result.omr&&typeof result.omr==='object'?result.omr:{};
    const clamp01=(v:any)=>Math.max(0,Math.min(1,Number(v)||0));
    const omr={
      confidence:clamp01(rawOmr.confidence),
      min_clear_confidence:clamp01(rawOmr.min_clear_confidence),
      marker_confidence:clamp01(rawOmr.marker_confidence),
      manual_answers:Math.max(0,Math.min(questionCount,Math.trunc(Number(rawOmr.manual_answers)||0))),
      low_confidence_answers:Math.max(0,Math.min(questionCount,Math.trunc(Number(rawOmr.low_confidence_answers)||0))),
      answer_count:Math.max(0,Math.min(questionCount,Math.trunc(Number(rawOmr.answer_count)||0))),
      auto_accept:rawOmr.auto_accept===true
    };
     const event={type:'paper_scan',at:submittedAt,review_id:reviewId,model,method:'omr',subjects,omr,scan_session_id:b.session_id,scan_sheet_id:result.sheet_id,scan_answer_version:result.answer_version,answer_states:rawAnswers.map((a:Row)=>({question:a.question,state:a.state,status:a.status,selected:a.selected,reviewed_manually:a.reviewed_manually===true}))};
    const lastSection=sections[sections.length-1];
    const payload={
       student_id:student.id,student_name:student.full_name,student_no:student.national_id_last3,
       student_key:student.id,class_name:student.class_name||className,attempt_no:1,config:attemptConfig,
      rendered_sections:sections,answers,events:[event],cursor:Math.max(0,(lastSection?.questions?.length||1)-1),section_index:Math.max(0,sections.length-1),section_started_at:submittedAt,
      session_id:'paper:'+reviewId+':'+student.id,access_hash:await hash('paper:'+reviewId+':'+student.id),
       lease_until:submittedAt,started_at:submittedAt,expires_at:expiresAt,submitted_at:submittedAt,
      score:graded.score,total:graded.total,percent:graded.percent,section_scores:graded.section_scores,is_demo:false
    };
     prepared.push({sheet_id:result.sheet_id,answer_version:result.answer_version,payload});
  }
   // One database transaction, never sequential per-student writes or immutable-attempt updates.
  const existingReview=must(await db.from('nafes_paper_reviews').select('id,payload').eq('owner_id',(b.review_owner_id||owner.id)).eq('review_id',reviewId).maybeSingle());
  const baseReview=existingReview?.payload||{};
  const reviewPayload=validatePaperReviewPayload({
    ...baseReview,review_id:reviewId,title,subject,subjects,class_name:className,question_count:questionCount,
    model_count:models.length,models,answer_keys:answerKeys,indicator_counts:indicators,
    assignments:Array.isArray(baseReview.assignments)?baseReview.assignments:(Array.isArray(b.assignments)?b.assignments:[])
  },owner);
  const publication=must(await db.rpc('nafes_scan_publish_attempts',{p_session:b.session_id,p_owner:owner.id,
    p_assessment:{title,config,rendered_sections:assessmentSections,review_payload:reviewPayload},p_attempts:prepared}));
  const assessment={id:publication.assessment_id};
  saved.push(...publication.results);

  return{ok:true,review_id:reviewId,assessment_id:assessment.id,subjects,saved_count:saved.length,results:saved};
}

export async function handleAssessments(db:any,req:Request,b:Row):Promise<Row> {
 if(String(b.action).startsWith('assessment_'))return await studentAction(db,b);
 const owner=await teacher(db,req);
 if(String(b.action).startsWith('teacher_scan_'))return await handlePaperScan(db,b,owner);
 if(b.action==='teacher_build_forms')fail('تم إيقاف قسم الاختبارات المحاكية. استخدم اختبارات المؤشرات.',400);
 if(b.action==='teacher_students_list')return await teacherStudentsList(db);
 if(b.action==='teacher_student_add'){assertMainAccount(owner);return await teacherStudentAdd(db,b);}
 if(b.action==='teacher_student_update'){assertMainAccount(owner);return await teacherStudentUpdate(db,b);}
 if(b.action==='teacher_student_delete'){assertMainAccount(owner);return await teacherStudentDelete(db,b);}
 if(b.action==='teacher_student_restore'){assertMainAccount(owner);return await teacherStudentRestore(db,b);}
 if(b.action==='teacher_students_bulk_import'){assertMainAccount(owner);return await teacherStudentsBulkImport(db,b);}
 if(b.action==='teacher_student_hard_delete'){assertMainAccount(owner);return await teacherStudentHardDelete(db,b);}
 if(b.action==='teacher_attempt_delete')return await teacherAttemptDelete(db,b,owner);
 if(b.action==='teacher_test_update_schedule')return await teacherTestUpdateSchedule(db,b,owner);
 if(b.action==='teacher_test_rename')return await teacherTestRename(db,b,owner);
 if(b.action==='teacher_test_set_open')return await teacherTestSetOpen(db,b,owner);
 if(b.action==='teacher_test_archive')return await teacherTestArchive(db,b,owner);
 if(b.action==='teacher_question_create')return await teacherQuestionCreate(db,b,owner);
 if(b.action==='teacher_test_clear_results'){assertMainAccount(owner);return await teacherTestClearResults(db,b,owner);}
 if(b.action==='teacher_test_delete')return await teacherTestDelete(db,b,owner);
 if(b.action==='teacher_tests_bulk_clear'){assertMainAccount(owner);return await teacherTestsBulkClear(db,b,owner);}
 if(b.action==='teacher_data')return await scopedTeacherData(db,b,owner);
 if(b.action==='teacher_paper_review_upsert')return await teacherPaperReviewUpsert(db,b,owner);
 if(b.action==='teacher_paper_review_get')return await teacherPaperReviewGet(db,b,owner);
 if(b.action==='teacher_paper_review_list')return await teacherPaperReviewList(db,owner);
 if(b.action==='teacher_paper_review_save')return await teacherPaperReviewSave(db,b,owner);
 if(b.action==='teacher_paper') {
  if(!SOURCES[b.source]||!isUUID(b.attempt_id)||b.source==='simulation')fail('المحاولة غير موجودة.',404);
  const a=must(await db.from(SOURCES[b.source]).select('*').eq('id',b.attempt_id).maybeSingle());
  if(!a||a.is_demo===true)fail('المحاولة غير موجودة.',404);
  const map=await metadata(db,[a],b.source),rawAttempt=canonical(a,b.source,map),attempt=scopedAttempt(rawAttempt,owner);
  if(!attempt)fail('هذه الورقة ليست ضمن مادة حساب المعلم.',403);
  const scope=teacherScope(owner);
  const rawSections=b.source==='exam'?[{subject:a.subject_key,questions:a.rendered_questions||[]}]:a.rendered_sections;
  let n=0;
  const sections=rawSections.map((s:Row)=>({...s,questions:s.questions.map((q:Row)=>{const summary=rawAttempt.questions[n++];return{...q,...summary,correctIndex:summary.correct_index};})})).filter((s:Row)=>scope==='all'||s.subject===scope);
  return{attempt,sections,settings:a.config?.settings||{}};
 }
 if(b.action==='teacher_catalog'){
  const base=await catalog(db),scope=teacherScope(owner),dir=await teacherDirectory(db);
  const published=must(await db.from('nafes_assessments').select('id,owner_id,title,kind,config,short_code,created_at,published_at,legacy_target').eq('status','published'));
  const tests=(published||[]).filter((t:Row)=>t.kind!=='simulation').map(testInfo).filter((t:Row)=>scope==='all'||(t.subjects||[]).includes(scope)).map((t:Row)=>{
    const creator=dir.get(String(t.owner_id||''));
    return {...t,created_by_label:creator?.label||'النظام',created_by_scope:creator?.subject_scope||null,is_owner:String(t.owner_id||'')===String(owner.id),can_manage:scope==='all'||String(t.owner_id||'')===String(owner.id)};
  });
  return {...base,indicators:(base.indicators||[]).filter((i:Row)=>scope==='all'||i.subject===scope),simulation_indicators:[],simulation_summary:{reading:0,math:0,science:0},forms:[],tests};
 }
 if(b.action==='teacher_preview_batch') {
  const config=normalizeConfig(b.config);
  assertIndicatorBuilderConfig(owner,config);
  const requested=Math.trunc(Number(b.candidate_count)||6),candidateCount=Math.max(1,Math.min(12,requested));
  const excluded=Array.isArray(b.exclude_question_ids)?b.exclude_question_ids:[];
  const started=performance.now(),poolCache=new Map<string,Row[]>(),candidates:Row[]=[];
  for(let i=0;i<candidateCount;i++){
    try{
      const sections=await draftSections(db,config,true,excluded,poolCache);
      candidates.push({config,sections});
    }catch(e){
      if(!candidates.length)throw e;
      break;
    }
  }
  return{
    candidates,
    candidate_count:candidates.length,
    pool_groups:poolCache.size,
    timing_ms:Math.round((performance.now()-started)*10)/10
  };
 }
 if(b.action==='teacher_preview') {
  const config=normalizeConfig(b.config);
  assertIndicatorBuilderConfig(owner,config);
  const sections=await draftSections(db,config,b.regenerate===true,Array.isArray(b.exclude_question_ids)?b.exclude_question_ids:[]);
  const draft=must(await db.from('nafes_assessments').insert({owner_id:owner.id,kind:config.kind,title:config.title,config,rendered_sections:sections}).select().single());
  return preview(draft);
 }
 if(b.action==='teacher_replace') {
  const t=await findDraft(db,b.draft_id,owner);
  const isSim=false;
  if(t.kind==='simulation'||t.config?.bank_source==='simulation_bank')fail('تم إيقاف قسم الاختبارات المحاكية.',400);
  const sections=t.rendered_sections;
  const all=sections.flatMap((s:Row)=>s.questions),old=all.find((q:Row)=>q.id===b.question_id);
  if(!old)fail('السؤال غير موجود في المسودة.');
  const pool=isSim
    ?(await simulationPool(db,old.subject,[old.indicator_key])).filter(q=>q.indicator_key===old.indicator_key)
    :(await fullPool(db,old.subject,[old.indicator_key])).filter(q=>q.indicator_key===old.indicator_key);
  const other=all.filter((x:Row)=>x.id!==old.id);
  const usedContent=new Set(other.map(questionKey)),
        usedStems=new Set(other.map((q:Row)=>selectionStemKey(q,String(q.subject||old.subject||''))));
  let candidates=pool.filter(q=>!usedContent.has(questionKey(q))&&!usedStems.has(selectionStemKey(q,String(q.subject||old.subject||''))));
  if(old.cognitive_level){
    const sameLevel=candidates.filter(q=>q.cognitive_level===old.cognitive_level);
    if(sameLevel.length)candidates=sameLevel;
  }
  if(old.image?.url){const visual=candidates.filter(q=>!!q.image?.url);if(visual.length)candidates=visual;}
  if(!candidates.length)fail('لا يوجد سؤال بديل مستقل بصياغة مختلفة متاح لهذا المؤشر في بنك الأسئلة المعتمد.');
  const replacement=(old.subject==='math'||old.subject==='science')
    ?selectCuratedIndicatorQuestions(candidates,1,old.subject,token(8),usedContent,usedStems)[0]
    :selectIndicatorQuestions(candidates,1,old.subject,token(8),usedContent,usedStems)[0];
  for(const s of sections)s.questions=s.questions.map((q:Row)=>q.id===old.id?replacement:q);
  return preview(must(await db.from('nafes_assessments').update({rendered_sections:sections}).eq('id',t.id).eq('status','draft').select().single()));
 }
 if(b.action==='teacher_publish') {
  let t=await findDraft(db,b.draft_id,owner);
  const isSim=false;
  if(t.kind==='simulation'||t.config?.bank_source==='simulation_bank')fail('تم إيقاف قسم الاختبارات المحاكية.',400);

  const needsCognitiveRepair=(t.rendered_sections||[]).some((section:Row)=>{
    const states=new Map<string,{count:number;levels:Set<string>}>();
    for(const q of section.questions||[]){
      const key=String(q.indicator_key||indicatorOf(q));
      const state=states.get(key)||{count:0,levels:new Set<string>()};
      state.count++;
      if(q.cognitive_level)state.levels.add(String(q.cognitive_level));
      states.set(key,state);
    }
    return [...states.values()].some(state=>state.count>=3&&
      (!state.levels.has('knowledge')||!state.levels.has('application')||!state.levels.has('reasoning')));
  });
  let autoRebalanced=false;
  if(needsCognitiveRepair){
    const rebuilt=await draftSections(db,t.config,true,[]);
    t=must(await db.from('nafes_assessments')
      .update({rendered_sections:rebuilt})
      .eq('id',t.id).eq('status','draft')
      .select().single());
    autoRebalanced=true;
  }

  const seenStems=new Set<string>();
  for(const section of t.rendered_sections){
    const familyCounts=new Map<string,number>();
    const indicatorLevels=new Map<string,{count:number;levels:Set<string>}>();
    const readingContextCounts=new Map<string,number>();
    const answerPositionCounts=[0,0,0,0];
    for(const q of section.questions||[]){
      const sk=selectionStemKey(q,section.subject);
      if(seenStems.has(sk))fail('توجد صياغة سؤال مكررة في المسودة؛ بدّل السؤال المكرر قبل النشر.',409);
      seenStems.add(sk);
      const indicatorKey=String(q.indicator_key||indicatorOf(q));
      const levelState=indicatorLevels.get(indicatorKey)||{count:0,levels:new Set<string>()};
      levelState.count++;
      if(q.cognitive_level)levelState.levels.add(String(q.cognitive_level));
      indicatorLevels.set(indicatorKey,levelState);
      const ci=Number(q.correctIndex);
      if(Number.isInteger(ci)&&ci>=0&&ci<4)answerPositionCounts[ci]++;
      if(section.subject==='reading'){
        const ctx=String(q.context||'').trim();
        if(!ctx)fail('يوجد سؤال قراءة بلا نص مرتبط؛ أعد تكوين المسودة قبل النشر.',409);
        readingContextCounts.set(ctx,(readingContextCounts.get(ctx)||0)+1);
      }
      if(section.subject==='math'||section.subject==='science'){
        if(!curatedQuestionEligible(q,section.subject))fail('توجد أسئلة ضعيفة أو قالبية في المسودة؛ أعد تكوين الأسئلة قبل النشر.',409);
        const family=`${q.indicator_key||indicatorOf(q)}|${stemFamilyKey(q)}`;
        const n=(familyCounts.get(family)||0)+1;
        familyCounts.set(family,n);
        if(n>2)fail('توجد أسئلة متقاربة جدًا في الصياغة داخل المؤشر نفسه؛ أعد تكوين المسودة قبل النشر.',409);
      }
    }
    for(const [key,state] of indicatorLevels){
      if(state.count>=3&&(!state.levels.has('knowledge')||!state.levels.has('application')||!state.levels.has('reasoning'))){
        fail(`المؤشر ${key} لا يجمع المعرفة والتطبيق والاستدلال في المسودة؛ أعد تكوينها قبل النشر.`,409);
      }
    }
    if(section.subject==='reading'&&t.config?.review_passage_mode===true){
      for(const count of readingContextCounts.values())if(count!==5)fail('بنية القراءة يجب أن تكون: نص واحد ثم خمسة أسئلة مرتبطة به.',409);
    }
    if((section.questions||[]).length>=8){
      const max=Math.max(...answerPositionCounts),min=Math.min(...answerPositionCounts);
      if(min===0||max-min>Math.max(3,Math.ceil((section.questions||[]).length*0.25)))fail('توزيع مواقع الإجابات الصحيحة غير متوازن؛ أعد تكوين المسودة قبل النشر.',409);
    }
    const qIds=section.questions.map((q:Row)=>q.id);
    const pool=isSim
      ?await simulationPool(db,section.subject,undefined,qIds)
      :await fullPool(db,section.subject,undefined,qIds);
    const current=new Map(pool.map(q=>[q.id,q]));
    if(section.questions.some((q:Row)=>!current.has(q.id)||snapshotKey(current.get(q.id)!)!==snapshotKey(q)))fail('تغير البنك بعد المعاينة؛ أعد تكوين المسودة قبل نشرها.',409);
  }
  const short_code=await codeFor(db);
  const saved=must(await db.from('nafes_assessments').update({status:'published',short_code,published_at:new Date().toISOString()}).eq('id',t.id).eq('status','draft').select().single());
  return{id:saved.id,short_code,url:`${BASE}e.html?t=${short_code}`,title:saved.title,auto_rebalanced:autoRebalanced};
 }
 if(b.action==='teacher_shorten_legacy')fail('تم إيقاف مسار الاختبارات القديم. أنشئ الاختبار من قسم اختبارات المؤشرات الجديد.',410);
 if(b.action==='teacher_build_forms') {if(!SUBJECTS.includes(b.subject))fail('المادة غير صحيحة.');const pool=await fullPool(db,b.subject),expected=FRAMEWORK.filter(i=>i.subject===b.subject).length*30;if(pool.length!==expected)fail(`لم يكتمل البنك المراجع للمادة: ${pool.length} من ${expected}.`,409);const bank_hash=await hash(JSON.stringify(pool));const forms=buildForms(pool,b.subject);for(const f of forms){f.signature=await hash(f.signature);f.bank_hash=bank_hash;}const result=must(await db.rpc('replace_nafes_simulation_forms',{payload:forms}));return{ok:true,subject:b.subject,forms:60,question_slots:1800,unique_questions:new Set(forms.flatMap(f=>f.questions.map((q:Row)=>q.id))).size,result};}
 fail('إجراء غير معروف.');
}
