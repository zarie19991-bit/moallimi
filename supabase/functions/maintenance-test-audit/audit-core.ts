export const INTERNAL_CONTEXT=/^(?:موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|مهمة تقويمية جديدة|مراجعة الحل)/;
export const INTERNAL_STEM=/(?:موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|وردت في سجل الأمثلة المهمة|المهمة المسجلة في (?:ملخص القواعد|مخطط المراجعة)|ظهرت المهمة|أي خيار يطبق المفهوم تطبيقًا صحيحًا|لتمييز المعرفة المرتبطة|وردت في مخطط المراجعة المهمة|ضمن مقارنة النتيجة ببديل قريب|باستخدام مقارنة النتيجة ببديل قريب|باستخدام كشف الافتراض الذي أدى إلى الخطأ|بعد كشف الافتراض الذي أدى إلى الخطأ)/;
const tidy=(v:any,n=240)=>String(v??"").normalize("NFKC").trim().slice(0,n);
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const norm=(v:any)=>String(v??"").normalize("NFKC").toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[؟?!.،,:؛;'"“”‘’()\[\]{}\-–—_/\\]+/g," ").replace(/\s+/g," ").trim();

export function auditTest(a:any){
  const sec=Array.isArray(a.rendered_sections)?a.rendered_sections:[],qs:any[]=[];
  for(const x of sec){const sj=tidy(x?.subject,20);for(const q of Array.isArray(x?.questions)?x.questions:[])qs.push({...q,__subject:tidy(q?.subject,20)||sj})}
  const issues:any={empty_test:0,internal_prompt_leaks:0,hidden_internal_contexts:0,invalid_options:0,invalid_correct:0,duplicate_ids:0,duplicate_texts:0,template_family_repetition:0,missing_cognitive_level:0,indicators_missing_three_levels:0,answer_position_imbalance:0,reading_group_errors:0,missing_required_image:0};
  if(!qs.length)issues.empty_test=1;
  const ids=new Map(),txt=new Map(),families=new Map(),ind=new Map(),ctx=new Map();let noctx=0;
  const levels:any={knowledge:0,application:0,reasoning:0,other:0},pos=[0,0,0,0],samples:any[]=[];
  const add=(c:string,q:any)=>{if(samples.length<10)samples.push({code:c,id:tidy(q?.id,80),indicator_key:tidy(q?.indicator_key,160),question:tidy(q?.question,170)})};
  for(const q of qs){
    const sj=tidy(q.__subject,20),id=tidy(q.id,80),qq=String(q.question||"").trim(),cc=String(q.context||"").trim();
    if(id)ids.set(id,(ids.get(id)||0)+1);const nt=norm(qq);if(nt){txt.set(nt,(txt.get(nt)||0)+1);const fam=nt.replace(/[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?/g,"#").split(" ").slice(0,7).join(" ");const fk=String(q?.indicator_key||"")+"|"+fam;families.set(fk,(families.get(fk)||0)+1);}
    const ik=tidy(q.indicator_key,160)||[sj,tidy(q.outcome,80),"i"+Math.trunc(num(q.indicator))].join(":");
    const slot=ind.get(ik)||{c:0,l:new Set()};slot.c++;
    const lv=tidy(q.cognitive_level,30);if(["knowledge","application","reasoning"].includes(lv)){levels[lv]++;slot.l.add(lv)}else{levels.other++;issues.missing_cognitive_level++;add("MISSING_COGNITIVE_LEVEL",q)}ind.set(ik,slot);
    if((sj==="math"||sj==="science")&&INTERNAL_CONTEXT.test(cc))issues.hidden_internal_contexts++;
    if(INTERNAL_STEM.test(qq)){issues.internal_prompt_leaks++;add("INTERNAL_PROMPT_LEAK",q)}
    const o=Array.isArray(q.options)?q.options.map((x:any)=>String(x??"").trim()):[];if(o.length!==4||o.some((x:string)=>!x)||new Set(o).size!==4){issues.invalid_options++;add("INVALID_OPTIONS",q)}
    const ci=Number(q.correctIndex);if(!Number.isInteger(ci)||ci<0||ci>3){issues.invalid_correct++;add("INVALID_CORRECT_INDEX",q)}else pos[ci]++;
    if(sj==="reading"){if(cc)ctx.set(cc,(ctx.get(cc)||0)+1);else noctx++}
    if(/(أي رسم(?! سهمي)|الرسم الآتي|الشكل الآتي|المخطط الآتي|الصورة الآتية|أي نقطة في الشكل)/.test(qq)&&!q?.image?.url){issues.missing_required_image++;add("MISSING_REQUIRED_IMAGE",q)}
  }
  issues.duplicate_ids=[...ids.values()].filter((x:any)=>x>1).length;issues.duplicate_texts=[...txt.values()].filter((x:any)=>x>1).length;issues.template_family_repetition=[...families.values()].filter((x:any)=>x>2).length;
  for(const x of ind.values())if(x.c>=3&&(!x.l.has("knowledge")||!x.l.has("application")||!x.l.has("reasoning")))issues.indicators_missing_three_levels++;
  const mx=Math.max(...pos),mn=Math.min(...pos);if(qs.length>=8&&(mn===0||mx-mn>Math.max(3,Math.ceil(qs.length*.25))))issues.answer_position_imbalance=1;
  const subjects=[...new Set(qs.map(q=>q.__subject).filter(Boolean))],subject=subjects.length===1?subjects[0]:subjects.length>1?"mixed":"";
  if(subject==="reading")issues.reading_group_errors=noctx+[...ctx.values()].filter((x:any)=>x!==5).length;
  return{assessment_id:a.id,title:tidy(a.title,240),status:tidy(a.status,30),subject,question_count:qs.length,indicator_count:ind.size,levels,answer_positions:{a:pos[0],b:pos[1],c:pos[2],d:pos[3]},issues,samples,question_ids:[...ids.keys()]};
}
export function summarize(reports:any[]){
  let empty=0,prompt=0,hiddenContexts=0,invalid=0,dups=0,familyRepeats=0,gaps=0,answer=0,reading=0,images=0;
  for(const r of reports){empty+=r.issues.empty_test;prompt+=r.issues.internal_prompt_leaks;hiddenContexts+=r.issues.hidden_internal_contexts||0;invalid+=r.issues.invalid_options+r.issues.invalid_correct;dups+=r.issues.duplicate_ids+r.issues.duplicate_texts;familyRepeats+=r.issues.template_family_repetition||0;gaps+=r.issues.indicators_missing_three_levels;answer+=r.issues.answer_position_imbalance;reading+=r.issues.reading_group_errors;images+=r.issues.missing_required_image}
  const findings:any[]=[];const add=(code:string,severity:string,title:string,detail:string,safe_action:string,count:number)=>findings.push({code,area:"question_quality",severity,title,detail,safe_action,auto_apply:false,source:"generated_indicator_tests",source_files:["supabase/functions/nafes-exam/assessments.ts"],count});
  if(empty)add("TEST_EMPTY_RENDER","critical","اختبارات مؤشرات بلا أسئلة","يوجد "+empty+" اختبارًا محفوظًا بلا أسئلة فعلية.","منع النشر وإعادة بناء الاختبار.",empty);
  if(prompt)add("TEST_INTERNAL_PROMPT_LEAK","critical","عبارات داخلية داخل نص السؤال","ظهر تسرب لغة تصميم أو مراجعة في "+prompt+" سؤالًا فعليًا يمكن أن يراه الطالب.","إعادة توليد الاختبارات المتأثرة بعد بوابة الجودة.",prompt);
  if(hiddenContexts)add("TEST_INTERNAL_CONTEXT_HIDDEN","info","سياقات داخلية قديمة مخفية عن الطالب","يوجد "+hiddenContexts+" سياقًا داخليًا محفوظًا في اختبارات قديمة، لكن طبقة العرض الحالية تحجبه عن الطالب.","الإبقاء عليه كسجل تاريخي وعدم اعتباره تسربًا ما دام العرض يحجبه.",hiddenContexts);
  if(invalid)add("TEST_INVALID_STRUCTURE","critical","بنية أسئلة غير صالحة داخل اختبارات فعلية","وجد الفحص "+invalid+" خللًا في البدائل أو الإجابة الصحيحة.","منع النشر وإعادة بناء النموذج.",invalid);
  if(images)add("TEST_REQUIRED_IMAGE_MISSING","critical","أسئلة تحتاج صورة مفقودة","وجد الفحص "+images+" سؤالًا فعليًا يشير إلى صورة أو رسم مفقود.","استبعاد السؤال حتى تتوافر الصورة.",images);
  if(dups)add("TEST_DUPLICATE_QUESTIONS","warning","تكرار داخل الاختبار نفسه","وجد الفحص "+dups+" حالة تكرار داخل اختبار واحد.","إعادة اختيار الأسئلة مع منع التكرار.",dups);
  if(familyRepeats)add("TEST_TEMPLATE_FAMILY_REPETITION","warning","قالب سؤال مكرر أكثر من اللازم","وجد الفحص "+familyRepeats+" مجموعة صياغية تكررت أكثر من مرتين داخل المؤشر نفسه في اختبار فعلي.","إعادة إنشاء الاختبارات المتأثرة؛ المولد الحالي يحد هذا القالب بمرتين كحد أقصى.",familyRepeats);
  if(gaps)add("TEST_COGNITIVE_LEVEL_GAPS","warning","المستويات الثلاثة غير مكتملة داخل بعض المؤشرات","وجد الفحص "+gaps+" حالة لمؤشر له ثلاثة أسئلة أو أكثر دون اجتماع المعرفة والتطبيق والاستدلال.","ضبط موزع الأسئلة ليضمن المستويات الثلاثة.",gaps);
  if(answer)add("TEST_ANSWER_POSITION_IMBALANCE","warning","توزيع الإجابات الصحيحة غير متوازن","وجد الفحص "+answer+" اختبارًا بتوزيع غير متوازن لمواضع الإجابة الصحيحة.","موازنة A/B/C/D قبل الحفظ.",answer);
  if(reading)add("TEST_READING_GROUP_STRUCTURE","warning","بنية نصوص القراءة تحتاج مراجعة","وجد الفحص "+reading+" خللًا في بناء «نص ثم خمسة أسئلة».","إعادة بناء مجموعات القراءة.",reading);
  findings.push({code:"TEST_SEMANTIC_REVIEW_REQUIRED",area:"question_quality",severity:"info",title:"الاختبارات الفعلية تحتاج مراجعة دلالية من المساعد",detail:"راجع الوكيل البنية والتوزيع والتكرار لكل اختبار محفوظ، ويحتاج المساعد لمراجعة مطابقة العينات للمؤشرات وجودة الصياغة.",safe_action:"تسليم تقارير الاختبارات ذات المشكلات للمساعد.",auto_apply:false,source:"generated_indicator_tests",source_files:["supabase/functions/nafes-exam/assessments.ts"]});
  return{findings,totals:{empty_tests:empty,prompt_leaks:prompt,hidden_internal_contexts:hiddenContexts,invalid_structure:invalid,duplicate_cases:dups,template_family_repetition:familyRepeats,indicator_level_gaps:gaps,answer_position_imbalanced_tests:answer,reading_group_errors:reading,missing_required_images:images}};
}