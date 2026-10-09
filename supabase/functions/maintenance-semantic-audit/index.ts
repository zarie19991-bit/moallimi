import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type,x-teacher-key,authorization,apikey,x-client-info",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json; charset=utf-8"
};
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const tidy=(v:unknown,n=500)=>String(v??"").normalize("NFKC").trim().slice(0,n);
const num=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0;

async function sha256(value:string){
  const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function master(req:Request){
  const key=tidy(req.headers.get("x-teacher-key"),120);
  if(!/^[a-f0-9]{48,96}$/i.test(key))throw Object.assign(new Error("مفتاح الحساب الرئيسي غير صالح."),{status:401});
  const {data,error}=await db.from("nafes_teacher_access").select("id,subject_scope").eq("key_hash",await sha256(key)).eq("active",true).maybeSingle();
  if(error)throw error;
  if(!data||String(data.subject_scope||"")!=="all")throw Object.assign(new Error("المحكّم التربوي متاح للحساب الرئيسي فقط."),{status:403});
  return data;
}

type Candidate={
  source_type:"active_test"|"indicator_bank"; source_id:string; assessment_id:string|null;
  subject:"reading"|"math"|"science"; indicator_key:string; indicator_text:string;
  registered_level:string; question_text:string; options:string[]; correct_index:number|null;
  context:string; option_parse_note:string|null;
};
type Review={
  source_id:string; judgment:"pass"|"review"|"reject"; confidence:number; detected_level:string|null;
  dimensions:Record<string,unknown>; reasons:string[]; suggested_question:string|null; provider:string; model:string|null;
};

function providerInfo(){
  const openaiKey=String(Deno.env.get("OPENAI_API_KEY")||"").trim();
  const enabled=String(Deno.env.get("PEDAGOGICAL_AI_ENABLED")||"true").toLowerCase()!=="false";
  return{
    configured:enabled&&!!openaiKey,
    provider:enabled&&openaiKey?"openai":"rules",
    model:enabled&&openaiKey?String(Deno.env.get("PEDAGOGICAL_AI_MODEL")||"gpt-6-luna"): "pedagogical-rules-v5"
  };
}
function normalized(v:unknown){
  return String(v??"").normalize("NFKC").toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g,"")
    .replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/[؟?!.،,:؛;'"“”‘’()\[\]{}\-–—_/\\]+/g," ")
    .replace(/\s+/g," ").trim();
}
function normalizedOption(v:unknown){
  return String(v??"").normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g,"")
    .replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/[–—−]/g,"-")
    .replace(/÷/g,"/")
    .replace(/×/g,"*")
    .replace(/\s+/g,"")
    .trim();
}
function optionArray(value:any){
  if(Array.isArray(value))return {options:value.map((x:any)=>tidy(x,500)),note:null};
  if(value&&typeof value==="object"){
    const preferred=["a","b","c","d"].map(k=>value[k]??value[k.toUpperCase()]).filter(v=>v!==undefined);
    if(preferred.length===4)return {options:preferred.map((x:any)=>tidy(x,500)),note:"حوّل المحكّم البدائل من كائن A/B/C/D إلى مصفوفة."};
    const alt=value.options||value.choices||value.answers;
    if(Array.isArray(alt))return {options:alt.map((x:any)=>tidy(x,500)),note:"حوّل المحكّم حقل البدائل المتداخل إلى مصفوفة."};
  }
  if(typeof value==="string"){
    try{const parsed=JSON.parse(value);return optionArray(parsed);}catch{}
  }
  return {options:[],note:"تعذر قراءة بنية البدائل من المصدر؛ تُصنّف الحالة «مراجعة» ولا تُرفض تربويًا تلقائيًا."};
}
const INTERNAL_STUDENT_CONTEXT=/^(?:موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|مهمة تقويمية جديدة|مراجعة الحل)/;
const INTERNAL_STUDENT_STEM=/(?:موقف تقويمي جديد|مراجعة جماعية للحل|تطبيق رياضي في موقف جديد|تطبيق علمي جديد|وردت في (?:سجل الأمثلة المهمة|بطاقة المفاهيم المهمة)|المهمة المسجلة في (?:ملخص القواعد|مخطط المراجعة|بطاقة المفاهيم|سجل الأمثلة)|وردت في مخطط المراجعة المهمة|ظهرت المهمة|أي خيار (?:يطبق المفهوم تطبيقًا صحيحًا|يجيب بدقة عن المهمة المسجلة)|لتمييز المعرفة المرتبطة|(?:ضمن|باستخدام|بعد|عند) مقارنة النتيجة ببديل قريب|(?:باستخدام|بعد|عند) كشف الافتراض الذي أدى إلى الخطأ|(?:باستخدام|بعد|عند) اختبار معقولية النتيجة|(?:ضمن|باستخدام|بعد|عند) التحقق من خطوات الاستدلال|أي تصحيح يجمع النتيجة السليمة ودليلها|أي تحليل يكشف الخطأ ويبرر البديل|أي تفسير يطابق النتيجة الصحيحة)/;
function studentFacingContext(subject:string,value:unknown){
  const ctx=tidy(value,1800);
  if(!ctx)return "";
  if((subject==="math"||subject==="science")&&INTERNAL_STUDENT_CONTEXT.test(ctx))return "";
  return ctx;
}
function studentFacingQuestion(subject:string,value:unknown,level:unknown){
  const text=tidy(value,1600),lv=String(level||"");
  if(!text||!(subject==="math"||subject==="science")||!INTERNAL_STUDENT_STEM.test(text))return text;
  const matches=[...text.matchAll(/«([^»]+)»/g)].map(m=>String(m[1]||"").trim()).filter(Boolean);
  if(lv==="knowledge"||lv==="application"){
    const task=matches.length?matches[matches.length-1]:"";
    return task.length<4?text:(/[؟?!.]$/.test(task)?task:task+"؟");
  }
  if(lv==="reasoning"&&matches.length>=2){
    const task=String(text.match(/(?:للمهمة|في المهمة|المهمة)\s*«([^»]+)»/)?.[1]||matches[0]||"").trim();
    const result=String(
      text.match(/(?:النتيجة|الاختيار)\s*«([^»]+)»/)?.[1]||
      text.match(/اقترحت النتيجة\s*«([^»]+)»/)?.[1]||
      matches.find(x=>x!==task)||""
    ).trim();
    if(task&&result){
      if(/أي تحليل يكشف الخطأ ويبرر البديل/.test(text))return "في السؤال «"+task+"»، اختار طالب «"+result+"». أي تحليل يوضح الخطأ ويبرر البديل الصحيح؟";
      if(/أي تصحيح يجمع النتيجة السليمة ودليلها/.test(text))return "في السؤال «"+task+"»، كانت الإجابة «"+result+"». أي خيار يصحح الإجابة ويذكر دليلًا مناسبًا؟";
      if(/أي تفسير يطابق النتيجة الصحيحة/.test(text))return "في السؤال «"+task+"»، كانت الإجابة المقترحة «"+result+"». أي تفسير يدعم الإجابة الصحيحة؟";
      if(/أي حكم مدعوم/.test(text))return "في السؤال «"+task+"»، قورنت المعطيات بالإجابة «"+result+"». أي حكم تدعمه المعطيات؟";
    }
  }
  return text;
}
function dim(status:string,note:string){return{status,note};}
function ruleReview(c:Candidate):Review{
  const q=c.question_text,opts=c.options.map(normalizedOption),reasons:string[]=[];
  const dimensions:any={
    indicator_alignment:dim("unknown","تحتاج فهمًا دلاليًا للمؤشر."),
    content_accuracy:dim("pass","لم يكتشف الفحص القاعدي تناقضًا معروفًا."),
    single_correct_answer:dim("pass","لا توجد علامة قاعدية قوية على تعدد الإجابات."),
    distractors:dim("pass","لم يكتشف الفحص البنيوي مشكلة مؤكدة في البدائل."),
    cognitive_level:dim("pass","لا توجد علامة قاعدية قوية على خطأ التصنيف."),
    wording:dim("pass","تُراجع الصياغة التي تصل للطالب، لا النص التاريخي الخام."),
    semantic_repetition:dim("unknown","يُحكم عليها على مستوى المجموعة.")
  };
  let judgment:"pass"|"review"|"reject"="pass",confidence=.62,detected:string|null=c.registered_level||null,suggested:string|null=null;
  const escalate=(j:"review"|"reject",conf:number,reason:string)=>{
    if(j==="reject"||judgment==="pass")judgment=j;
    confidence=Math.max(confidence,conf);reasons.push(reason);
  };

  if(c.option_parse_note){
    dimensions.distractors=dim("review",c.option_parse_note);
    escalate("review",.88,c.option_parse_note);
  }

  if(c.subject==="science"){
    const movementToPoles=/(نحو|إلى)\s+(?:كل\s+)?قطب/.test(q);
    const alignedAtEquator=/(مصطف|تصطف|في\s+المنتصف|عند\s+خط\s+الاستواء)/.test(q);
    const negatedMovement=/(?:دون\s+أن|لم|لا)\s+(?:ت)?(?:نفصل|تحرك|تتحرك|تتجه|تجه)[^؟.]{0,45}(?:نحو|إلى)\s+(?:كل\s+)?قطب/.test(q);
    const meiosisContradiction=movementToPoles&&alignedAtEquator&&!negatedMovement;
    if(meiosisContradiction){
      dimensions.content_accuracy=dim("fail","يجمع السؤال بين حركة الكروموسومات نحو القطبين والاصطفاف في المنتصف؛ وهما حدثان مرحليان مختلفان.");
      dimensions.single_correct_answer=dim("fail","المعطيات المتناقضة تجعل أكثر من مرحلة قابلة للدفاع.");
      escalate("reject",.99,"تناقض علمي داخلي بين الاصطفاف في المنتصف والاتجاه نحو القطبين.");
      suggested="اختر حدثًا واحدًا واضحًا للمرحلة: إما اصطفاف الأزواج عند خط الاستواء، أو انفصال المتماثلات واتجاهها نحو القطبين.";
    }
    const energyTransport=/نقل\s+المواد/.test(q)&&/(استهلاك|طاقة|atp)/i.test(q)&&/(يرتبط\s+مباشرة|التركيب)/.test(q);
    const hasMito=opts.some(x=>x.includes("ميتوكوند")),hasMembrane=opts.some(x=>x.includes("غشاء"));
    if(energyTransport&&hasMito&&hasMembrane){
      dimensions.single_correct_answer=dim("review","الغشاء موقع النقل والميتوكندريا مصدر ATP؛ كلمة «مباشرة» قد تجعل الخيارين قابلين للدفاع.");
      dimensions.wording=dim("review","السؤال يحتاج تحديد: مصدر الطاقة أم موضع النقل؟");
      escalate("review",.96,"احتمال وجود خيارين قابلين للدفاع بسبب عدم تحديد المقصود من «يرتبط مباشرة».");
      suggested="إذا كان المقصود مصدر ATP فاسأل: «أي تركيب يزوّد الخلية بمعظم الطاقة اللازمة للنقل النشط؟»";
    }
  }

  if(c.subject==="math"){
    const direct=/^(ما\s+قيمة|قرب|قرّب|رتب|رتّب|صنف|صنّف|ما\s+التصنيف|أي\s+عدد\s+يمثل)/.test(q);
    const hasReasonCue=/(فسر|فسّر|برر|برّر|لماذا|زعم|ادعى|خطأ|دليل|استنتج|أي\s+تفسير|أي\s+استدلال)/.test(q);
    if(c.registered_level==="reasoning"&&direct&&!hasReasonCue){
      detected="application";
      dimensions.cognitive_level=dim("review","المطلوب إجراء مباشر أو تصنيف مباشر، ولا يظهر فيه تبرير أو استنتاج متعدد الخطوات.");
      escalate("review",.90,"التصنيف المسجل «استدلال» لكن المهمة أقرب إلى التطبيق المباشر.");
    }
    if(c.registered_level==="reasoning"&&/إذا\s+كان\s+\|?.{0,20}\|?\s*=/.test(q)&&/فما\s+قيمة/.test(q)&&!hasReasonCue){
      detected="application";
      dimensions.cognitive_level=dim("review","المعطى يحدد عملية مباشرة للوصول إلى القيمة.");
      escalate("review",.93,"السؤال أقرب إلى التطبيق من الاستدلال.");
    }
  }

  if(c.subject==="reading"&&!c.context&&/(النص|الكاتب|ورد|الفقرة)/.test(q)){
    dimensions.indicator_alignment=dim("review","السؤال يحيل إلى نص غير متاح في سجل السؤال.");
    escalate("review",.91,"سؤال قراءة يعتمد على نص أو سياق غير موجود.");
  }

  const trimmed=c.options.map(x=>String(x??"").trim()),blankCount=trimmed.filter(x=>!x).length;
  const exactCount=new Set(trimmed.filter(Boolean)).size;
  const semanticCount=new Set(opts.filter(Boolean)).size;
  if(c.options.length!==4||blankCount>0){
    dimensions.distractors=dim("fail","عدد البدائل المقروءة: "+c.options.length+"، والبدائل الفارغة: "+blankCount+".");
    escalate(c.option_parse_note?"review":"reject",c.option_parse_note?.length?0.90:0.99,"بنية البدائل غير مكتملة: المطلوب أربعة بدائل غير فارغة.");
  }else if(exactCount<4){
    dimensions.distractors=dim("fail","يوجد بديلان متطابقان نصيًا.");
    escalate("reject",.99,"يوجد تكرار حرفي بين البدائل.");
  }else if(semanticCount<4){
    dimensions.distractors=dim("review","بعض البدائل تصبح متطابقة بعد إزالة الفروق الشكلية؛ تحتاج مراجعة بشرية.");
    escalate("review",.92,"بدائل متقاربة شكليًا/لغويًا وقد لا تكون مشتتات مستقلة.");
  }
  const ci=Number(c.correct_index);
  if(!Number.isInteger(ci)||ci<0||ci>3){
    dimensions.single_correct_answer=dim("fail","مؤشر الإجابة الصحيحة خارج النطاق 0–3 أو غير موجود.");
    escalate("reject",.99,"مؤشر الإجابة الصحيحة غير صالح.");
  }else if(c.options.length===4&&!String(c.options[ci]??"").trim()){
    dimensions.single_correct_answer=dim("fail","الإجابة المعتمدة تشير إلى بديل فارغ.");
    escalate("reject",.99,"الإجابة الصحيحة المعتمدة تشير إلى بديل فارغ.");
  }
  if(!reasons.length)reasons.push("اجتاز الفحص التربوي القاعدي فقط؛ لا يُعد ذلك اعتمادًا دلاليًا نهائيًا من دون نموذج لغوي.");
  return{source_id:c.source_id,judgment,confidence,detected_level:detected,dimensions,reasons,suggested_question:suggested,provider:"rules",model:"pedagogical-rules-v5"};
}

function outputText(data:any){
  if(typeof data?.output_text==="string")return data.output_text;
  const parts:any[]=[];
  for(const item of data?.output||[])for(const c of item?.content||[])if(typeof c?.text==="string")parts.push(c.text);
  return parts.join("\n");
}
function stripJsonFence(s:string){return s.trim().replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"").trim();}
async function aiReview(batch:Candidate[],base:Review[]):Promise<Review[]>{
  const p=providerInfo();if(!p.configured)return base;
  const key=String(Deno.env.get("OPENAI_API_KEY")||"");
  const payload=batch.map((c,i)=>({
    index:i,source_id:c.source_id,subject:c.subject,indicator_key:c.indicator_key,indicator_text:c.indicator_text,
    registered_level:c.registered_level,context:c.context,question:c.question_text,options:c.options,correct_index:c.correct_index,
    rule_flags:base[i]?.reasons||[]
  }));
  const instructions=[
    "أنت محكّم تربوي متخصص في اختبارات نافس للمرحلة المتوسطة في القراءة والرياضيات والعلوم.",
    "راجع كل سؤال بوصفه سؤال اختيار من متعدد. لا تعتمد التصنيف المخزن دون فحص.",
    "احكم على: مطابقة المؤشر، صحة المحتوى وعدم التناقض، وجود إجابة صحيحة واحدة فقط، جودة المشتتات، المستوى الحقيقي knowledge/application/reasoning، وضوح الصياغة، والتكرار المعنوي إن ظهر من المادة المقدمة.",
    "إذا أمكن الدفاع عن خيارين فالحكم review أو reject. إذا كانت المعطيات متناقضة فالحكم reject. إذا لم يكف السياق فالحكم review.",
    "أعد JSON فقط بالشكل:",
    '{"reviews":[{"source_id":"...","judgment":"pass|review|reject","confidence":0.0,"detected_level":"knowledge|application|reasoning","dimensions":{"indicator_alignment":"pass|review|fail","content_accuracy":"pass|review|fail","single_correct_answer":"pass|review|fail","distractors":"pass|review|fail","cognitive_level":"pass|review|fail","wording":"pass|review|fail","semantic_repetition":"pass|review|fail"},"reasons":["سبب عربي محدد"],"suggested_question":null}]}'
  ].join("\n");
  const res=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({model:p.model,store:false,max_output_tokens:3500,input:[
      {role:"system",content:[{type:"input_text",text:instructions}]},
      {role:"user",content:[{type:"input_text",text:JSON.stringify(payload)}]}
    ]})
  });
  if(!res.ok)throw new Error("تعذر تشغيل المحكّم الدلالي: "+res.status+" "+(await res.text()).slice(0,300));
  const data=await res.json(),parsed=JSON.parse(stripJsonFence(outputText(data)));
  const byId=new Map((parsed?.reviews||[]).map((x:any)=>[String(x.source_id),x]));
  return batch.map((c,i)=>{
    const x:any=byId.get(c.source_id);if(!x)return base[i];
    const judgment=["pass","review","reject"].includes(String(x.judgment))?x.judgment:"review";
    return{source_id:c.source_id,judgment,confidence:Math.max(0,Math.min(1,num(x.confidence)||.7)),
      detected_level:["knowledge","application","reasoning"].includes(String(x.detected_level))?String(x.detected_level):base[i].detected_level,
      dimensions:x.dimensions&&typeof x.dimensions==="object"?x.dimensions:base[i].dimensions,
      reasons:Array.isArray(x.reasons)?x.reasons.map((z:any)=>tidy(z,500)).slice(0,6):base[i].reasons,
      suggested_question:x.suggested_question?tidy(x.suggested_question,1000):null,provider:"openai",model:p.model} as Review;
  });
}

async function fetchActiveTestCandidates(subject:string|null):Promise<Candidate[]>{
  const tests:any[]=[];
  for(let start=0;;start+=100){
    const {data,error}=await db.from("nafes_assessments").select("id,rendered_sections,created_at")
      .eq("kind","multi_indicator").in("status",["draft","published"]).order("created_at",{ascending:true}).range(start,start+99);
    if(error)throw error;tests.push(...(data||[]));if(!data||data.length<100)break;
  }
  const out:Candidate[]=[],seen=new Set<string>();
  for(const a of tests)for(const sec of Array.isArray(a.rendered_sections)?a.rendered_sections:[]){
    const sj=tidy(sec?.subject,20) as any;if(subject&&sj!==subject)continue;
    for(const x of Array.isArray(sec?.questions)?sec.questions:[]){
      const sid=tidy(x?.id,100);if(!sid||seen.has(sid)||!["reading","math","science"].includes(sj))continue;seen.add(sid);
      const parsed=optionArray(x?.options);
      out.push({source_type:"active_test",source_id:sid,assessment_id:String(a.id),subject:sj,indicator_key:tidy(x?.indicator_key,180),
        indicator_text:tidy(x?.indicator_text,700),registered_level:tidy(x?.cognitive_level,30),question_text:tidy(x?.question,1600),
        options:parsed.options.slice(0,4),option_parse_note:parsed.note,
        correct_index:Number.isInteger(Number(x?.correctIndex))?Number(x.correctIndex):null,context:studentFacingContext(sj,x?.context)});
    }
  }
  return out.sort((a,b)=>a.subject.localeCompare(b.subject)||a.indicator_key.localeCompare(b.indicator_key)||a.source_id.localeCompare(b.source_id));
}

async function fetchBankCandidates(subject:string|null):Promise<Candidate[]>{
  const out:Candidate[]=[],subjects=subject?[subject]:["reading","math","science"];
  for(const sj of subjects){
    if(sj==="reading"){
      for(let start=0;;start+=500){
        const {data,error}=await db.from("nafes_question_bank")
          .select("id,subject_key,outcome_code,indicator_index,indicator_text,context_text,question_text,options,correct_index,cognitive_level")
          .eq("grade_key","middle_3").eq("subject_key","reading").eq("is_active",true).eq("review_status","approved")
          .order("id").range(start,start+499);
        if(error)throw error;
        for(const x of data||[]){const parsed=optionArray(x.options);out.push({source_type:"indicator_bank",source_id:String(x.id),assessment_id:null,subject:"reading",
          indicator_key:"reading:"+String(x.outcome_code)+":i"+String(x.indicator_index),indicator_text:tidy(x.indicator_text,700),
          registered_level:tidy(x.cognitive_level,30),question_text:tidy(x.question_text,1600),
          options:parsed.options.slice(0,4),option_parse_note:parsed.note,
          correct_index:Number.isInteger(Number(x.correct_index))?Number(x.correct_index):null,context:studentFacingContext("reading",x.context_text)});}
        if(!data||data.length<500)break;
      }
    }else{
      const version=sj==="math"?"math-curated-v4":"science-curated-v4";
      for(let start=0;;start+=500){
        const {data,error}=await db.from("nafes_indicator_curated_bank")
          .select("id,subject_key,indicator_key,indicator_text,context_text,question_text,options,correct_index,cognitive_level")
          .eq("subject_key",sj).eq("quality_version",version).eq("quality_status","approved").order("indicator_key").order("id").range(start,start+499);
        if(error)throw error;
        for(const x of data||[]){const parsed=optionArray(x.options),level=tidy(x.cognitive_level,30);out.push({source_type:"indicator_bank",source_id:String(x.id),assessment_id:null,subject:sj as any,
          indicator_key:tidy(x.indicator_key,180),indicator_text:tidy(x.indicator_text,700),registered_level:level,
          question_text:studentFacingQuestion(sj, x.question_text, level),options:parsed.options.slice(0,4),option_parse_note:parsed.note,
          correct_index:Number.isInteger(Number(x.correct_index))?Number(x.correct_index):null,context:studentFacingContext(sj,x.context_text)});}
        if(!data||data.length<500)break;
      }
    }
  }
  return out;
}
async function candidates(scope:string,subject:string|null){return scope==="indicator_bank"?fetchBankCandidates(subject):fetchActiveTestCandidates(subject);}
async function staleOnlyCandidates(all:Candidate[],cutoff:string):Promise<Candidate[]>{
  const ids=all.map(x=>x.source_id).filter(Boolean),current=new Set<string>();
  for(let i=0;i<ids.length;i+=150){
    const {data,error}=await db.from("maintenance_agent_semantic_reviews")
      .select("source_id,question_text,options,correct_index,registered_level,created_at")
      .in("source_id",ids.slice(i,i+150)).lt("created_at",cutoff).order("created_at",{ascending:false});
    if(error)throw error;
    const first=new Map<string,any>();
    for(const row of data||[]){const id=String(row.source_id);if(!first.has(id))first.set(id,row);}
    for(const x of all){
      const row=first.get(x.source_id);if(!row)continue;
      const sameQuestion=String(row.question_text||"")===String(x.question_text||"");
      const sameOptions=JSON.stringify(Array.isArray(row.options)?row.options:[])===JSON.stringify(x.options||[]);
      const sameCorrect=Number(row.correct_index)===Number(x.correct_index);
      const sameLevel=String(row.registered_level||"")===String(x.registered_level||"");
      if(sameQuestion&&sameOptions&&sameCorrect&&sameLevel)current.add(x.source_id);
    }
  }
  return all.filter(x=>!current.has(x.source_id));
}

async function startJob(owner:any,body:any){
  const scope=body?.scope==="indicator_bank"?"indicator_bank":"active_tests";
  const subject=["reading","math","science"].includes(String(body?.subject||""))?String(body.subject):null;
  const candidateMode=body?.stale_only===true?"stale_only":"all",cutoff=new Date().toISOString();
  const raw=await candidates(scope,subject),all=candidateMode==="stale_only"?await staleOnlyCandidates(raw,cutoff):raw,p=providerInfo();
  const {data,error}=await db.from("maintenance_agent_semantic_jobs").insert({
    owner_id:owner.id,scope,subject,candidate_mode:candidateMode,status:"running",provider:p.provider,model:p.model,total_candidates:all.length,
    summary:candidateMode==="stale_only"
      ?"بدأ تحديث التحكيم للأسئلة التي تغيّرت نسختها أو لم تُحكّم بعد."
      :(p.configured?"بدأ التحكيم التربوي القاعدي والدلالي.":"بدأ التحكيم التربوي القاعدي. يلزم ربط مزود ذكاء دلالي لإكمال الفهم العميق لجميع الأسئلة."),
    contains_personal_data:false
  }).select("*").single();
  if(error)throw error;return data;
}
async function processJob(owner:any,jobId:string){
  const {data:job,error}=await db.from("maintenance_agent_semantic_jobs").select("*").eq("id",jobId).eq("owner_id",owner.id).single();
  if(error)throw error;if(!job)throw Object.assign(new Error("مهمة التحكيم غير موجودة."),{status:404});
  if(["completed","failed","provider_required"].includes(job.status))return job;
  const currentProvider=providerInfo();
  if(job.provider==="rules"&&job.model!==currentProvider.model){
    throw Object.assign(new Error("هذه المهمة بدأت بإصدار قديم من المحكّم. ابدأ تحكيمًا جديدًا لضمان أن تكون جميع النتائج بالإصدار نفسه."),{status:409});
  }
  const raw=await candidates(job.scope,job.subject||null),all=job.candidate_mode==="stale_only"?await staleOnlyCandidates(raw,String(job.created_at)):raw,p=providerInfo(),batchSize=p.configured?8:120,offset=num(job.current_offset),batch=all.slice(offset,offset+batchSize);
  if(!batch.length){
    const finalStatus=p.configured?"completed":"provider_required";
    const {data:done,error:e}=await db.from("maintenance_agent_semantic_jobs").update({status:finalStatus,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id).select("*").single();
    if(e)throw e;return done;
  }
  const rules=batch.map(ruleReview);let reviews=rules;
  if(p.configured){try{reviews=await aiReview(batch,rules);}catch(e){console.error("semantic-ai",e);reviews=rules;}}
  const rows=reviews.map((r,i)=>({
    job_id:job.id,owner_id:owner.id,source_type:batch[i].source_type,source_id:batch[i].source_id,assessment_id:batch[i].assessment_id,
    subject:batch[i].subject,indicator_key:batch[i].indicator_key,indicator_text:batch[i].indicator_text,registered_level:batch[i].registered_level||null,
    detected_level:r.detected_level,question_text:batch[i].question_text,options:batch[i].options,correct_index:batch[i].correct_index,
    judgment:r.judgment,confidence:r.confidence,dimensions:r.dimensions,reasons:r.reasons,suggested_question:r.suggested_question,
    provider:r.provider,model:r.model,review_version:"pedagogical-semantic-v3",contains_personal_data:false
  }));
  const {error:insErr}=await db.from("maintenance_agent_semantic_reviews").insert(rows);if(insErr)throw insErr;
  const next=offset+batch.length,finished=next>=all.length,finalStatus=finished?(p.configured?"completed":"provider_required"):"running";
  const summary=finished?(p.configured?"اكتمل التحكيم التربوي الدلالي للأسئلة ضمن النطاق المحدد.":"اكتمل التحكيم القاعدي؛ لم يُربط مزود الذكاء الدلالي بعد."):"جارٍ التحكيم التربوي: "+Math.min(next,all.length)+" من "+all.length+".";
  const {data:updated,error:upErr}=await db.from("maintenance_agent_semantic_jobs").update({
    status:finalStatus,provider:p.provider,model:p.model,current_offset:next,reviewed_count:num(job.reviewed_count)+batch.length,
    pass_count:num(job.pass_count)+reviews.filter(x=>x.judgment==="pass").length,
    review_count:num(job.review_count)+reviews.filter(x=>x.judgment==="review").length,
    reject_count:num(job.reject_count)+reviews.filter(x=>x.judgment==="reject").length,
    summary,updated_at:new Date().toISOString(),...(finished?{completed_at:new Date().toISOString()}:{})
  }).eq("id",job.id).select("*").single();
  if(upErr)throw upErr;return updated;
}
async function jobReport(owner:any,jobId:string){
  const {data:job,error}=await db.from("maintenance_agent_semantic_jobs").select("*").eq("id",jobId).eq("owner_id",owner.id).single();if(error)throw error;
  const {data:reviews,error:rErr}=await db.from("maintenance_agent_semantic_reviews")
    .select("subject,indicator_key,indicator_text,registered_level,detected_level,question_text,options,correct_index,judgment,confidence,dimensions,reasons,suggested_question,provider,model")
    .eq("job_id",jobId).in("judgment",["review","reject"]).order("confidence",{ascending:false}).limit(80);
  if(rErr)throw rErr;return{job,reviews:reviews||[],provider:providerInfo()};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  try{
    const owner=await master(req),body=await req.json().catch(()=>({})),action=String(body?.action||"status");
    if(action==="status"){
      const {data}=await db.from("maintenance_agent_semantic_jobs").select("*").eq("owner_id",owner.id).order("created_at",{ascending:false}).limit(5);
      return json({ok:true,provider:providerInfo(),jobs:data||[]});
    }
    if(action==="start")return json({ok:true,job:await startJob(owner,body),provider:providerInfo()});
    if(action==="process"){const id=tidy(body?.job_id,80);if(!id)throw Object.assign(new Error("معرّف مهمة التحكيم مطلوب."),{status:400});return json({ok:true,job:await processJob(owner,id),provider:providerInfo()});}
    if(action==="report"){const id=tidy(body?.job_id,80);if(!id)throw Object.assign(new Error("معرّف مهمة التحكيم مطلوب."),{status:400});return json({ok:true,...await jobReport(owner,id)});}
    throw Object.assign(new Error("إجراء غير معروف."),{status:400});
  }catch(error:any){
    console.error("maintenance-semantic-audit",error);
    return json({error:String(error?.message||"تعذر تشغيل المحكّم التربوي.")},Number(error?.status||500));
  }
});