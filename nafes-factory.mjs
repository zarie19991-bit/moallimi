export const MODEL_COUNT=4;
export const QUESTION_COUNT=15;

function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^h>>>16)>>>0}}
function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
function rng(seed){return mulberry32(xmur3(String(seed))())}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
const ri=(r,a,b)=>Math.floor(r()*(b-a+1))+a;
function shuffle(r,a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function item(r,q,correct,wrong,explanation='',context=null,level='application'){
 const correctText=String(correct),distractors=[];
 const add=v=>{const t=String(v);if(t!==correctText&&!distractors.includes(t))distractors.push(t)};
 wrong.forEach(add);
 const numeric=correctText.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
 if(numeric){const value=Number(numeric[1]),suffix=numeric[2];[1,-1,2,-2,5,-5,10].forEach(step=>add(`${fmt(value+step)}${suffix}`))}
 ['لا يمكن تحديد ذلك من المعطيات.','لا توجد علاقة مباشرة بين المعطيات.','المعطيات تقود إلى نتيجة مختلفة.'].forEach(add);
 const opts=shuffle(r,[{t:correctText,ok:true},...distractors.slice(0,3).map(t=>({t,ok:false}))]);
 return {context,question:q,options:opts.map(x=>x.t),correctIndex:opts.findIndex(x=>x.ok),explanation,difficulty:level==='reasoning'?'hard':level==='knowledge'?'easy':'medium',cognitive_level:level};
}
const uniq=a=>[...new Set(a.map(String))];
function numWrongs(ans,step=1){const a=Number(ans);return uniq([a+step,a-step,a+2*step,a*2]).filter(x=>String(x)!==String(ans)).slice(0,3)}
function gcd(a,b){while(b){[a,b]=[b,a%b]}return a||1}
function frac(n,d){const g=gcd(Math.abs(n),Math.abs(d));n/=g;d/=g;if(d<0){n=-n;d=-d}return d===1?String(n):`${n}/${d}`}
function fmt(x){return Number.isInteger(x)?String(x):String(Math.round(x*100)/100)}
function shortIndicator(t){return String(t).replace(/[.؛]$/,'').split(/[،؛]/)[0].replace(/^(يستنتج|يوضح|يحدد|يميز|يصف|يشرح|يعرف|يقارن|يحسب|يحل|يذكر|يتعرف|يفسر|يطبق|يعدد|يقترح|يقدم|يعلل|يصنف|ينظم|يحلل|يتنبأ)\s+/,'').slice(0,110)}
function cognitiveVariant(r,q,level,indicatorText,serial){
 const target=shortIndicator(indicatorText);
 const correct=q.options[q.correctIndex];
 const wrong=q.options.filter((_,i)=>i!==q.correctIndex);
 if(level==='knowledge'){
  const rawRule=String(q.explanation||'').replace(/[.]+$/,'');
  const rule=!rawRule||/ترتبط بالمفهوم المحدد|تتفق مع المفهوم|الوارد في المؤشر/.test(rawRule)?String(correct):rawRule;
  return item(r,`أي قاعدة أو حقيقة أساسية تساعد مباشرة في معالجة مهمة «${target}»؟`,rule,[
   `نستخدم قاعدة لا ترتبط بمعطيات «${target}»`,
   'نعتمد شكل الخيار دون فحص العلاقة العلمية أو الرياضية',
   'لا نحتاج إلى مفهوم أو قاعدة قبل الإجابة'
  ],'السؤال المعرفي يتحقق من تعرف القاعدة أو الحقيقة اللازمة قبل التطبيق.',`تمهيد ${serial} للمهمة الأصلية: ${q.question}`,'knowledge');
 }
 if(level==='reasoning'){
  const proposed=wrong[serial%wrong.length];
  return item(r,`اقترح طالب الإجابة «${proposed}» عن السؤال: «${q.question}». ما التقويم الأدق؟`,
   `الإجابة غير صحيحة؛ الأدق «${correct}» لأن ${String(q.explanation||'المعطيات تؤيد هذا الاختيار').replace(/[.]+$/,'')}`,
   [
    'الإجابة صحيحة؛ ولا حاجة إلى التحقق من المعطيات',
    `الإجابة غير صحيحة؛ لكن الأدق «${proposed}» للسبب نفسه`,
    'لا يمكن تقويم الإجابة مع أن السؤال يتضمن معطيات كافية'
   ],
   'يتطلب سؤال الاستدلال فحص إجابة مقترحة وربط الحكم بالقاعدة أو الدليل.',
   `تحليل الخطأ رقم ${serial} في مهارة «${target}».`,'reasoning');
 }
 return {...q,context:`${q.context||`موقف تطبيقي مباشر في مهارة «${target}».`} (المهمة ${serial})`,difficulty:'medium',cognitive_level:'application'};
}

const READING_PASSAGES=[
{text:'تعمل المملكة على حماية موارد المياه عبر ترشيد الاستهلاك، وتطوير شبكات النقل، والاستفادة من التقنيات الحديثة في إعادة الاستخدام. ولا يقتصر النجاح على المشروعات الكبرى؛ فاختيارات الفرد اليومية، مثل إصلاح التسربات وتقليل الهدر، تصنع أثرًا متراكمًا يحفظ المورد للأجيال القادمة.',main:'حماية المياه مسؤولية مشتركة تجمع بين الحلول المؤسسية والسلوك الفردي',detail:'إصلاح التسربات يقلل الهدر',inference:'استدامة المياه تحتاج تعاون المؤسسات والأفراد',view:'السلوك اليومي جزء من الحل',value:'المسؤولية',problem:'هدر المياه',solution:'ترشيد الاستهلاك وإصلاح التسربات',word:['استدامة','استمرار المورد وقدرته على تلبية حاجات المستقبل'],evidence:'اختيارات الفرد اليومية تصنع أثرًا متراكمًا'},
{text:'حين دخلت التقنية إلى الفصول الدراسية لم تعد قيمة الدرس في كثرة الأدوات، بل في حسن توظيفها. فالمعلم الذي يختار أداة رقمية مناسبة لهدف واضح يستطيع أن يمنح الطالب فرصة للتجريب والتغذية الراجعة، بينما قد تتحول التقنية إلى تشتيت إذا استعملت بلا خطة.',main:'قيمة التقنية التعليمية ترتبط بحسن توظيفها لتحقيق هدف تعلم واضح',detail:'التغذية الراجعة من فوائد التوظيف الجيد للتقنية',inference:'كثرة الأدوات لا تضمن تعلمًا أفضل',view:'التخطيط يسبق اختيار الأداة الرقمية',value:'الإتقان',problem:'استخدام التقنية بلا خطة',solution:'اختيار الأداة وفق الهدف',word:['توظيف','استخدام الشيء في موضع يحقق غرضًا محددًا'],evidence:'قد تتحول التقنية إلى تشتيت إذا استعملت بلا خطة'},
{text:'تقوم المدن الذكية على جمع البيانات من وسائل النقل والطاقة والخدمات، ثم تحليلها لاتخاذ قرارات أسرع وأكثر دقة. غير أن جودة القرار لا تعتمد على كمية البيانات فقط؛ فصحة البيانات وحماية خصوصية الأفراد عنصران أساسيان حتى تكون التقنية في خدمة الإنسان.',main:'المدن الذكية تحتاج بيانات موثوقة مع حماية الخصوصية لاتخاذ قرارات نافعة',detail:'تحليل البيانات يساعد على قرارات أسرع وأكثر دقة',inference:'البيانات الكثيرة قد تقود إلى قرار ضعيف إذا كانت غير موثوقة',view:'حماية الخصوصية شرط في الاستخدام المسؤول للبيانات',value:'المسؤولية',problem:'استخدام بيانات غير موثوقة أو غير محمية',solution:'التحقق من البيانات وحماية الخصوصية',word:['موثوقة','يمكن الاعتماد على صحتها'],evidence:'صحة البيانات وحماية خصوصية الأفراد عنصران أساسيان'},
{text:'لا تُقاس قوة اللغة بعدد المتحدثين بها فقط، بل بقدرتها على إنتاج المعرفة واستيعاب المصطلحات الجديدة. وحين يقرأ الطالب نصوصًا متنوعة ويكتب بلغة دقيقة، فإنه لا يحافظ على لغته فحسب، بل يوسع قدرته على التفكير والتعبير.',main:'تنمية اللغة ترتبط بالقراءة والكتابة وإنتاج المعرفة',detail:'الكتابة الدقيقة توسع القدرة على التعبير',inference:'المحافظة على اللغة لا تعني رفض المصطلحات الجديدة',view:'اللغة أداة للتفكير وإنتاج المعرفة',value:'الاعتزاز باللغة',problem:'ضعف الممارسة اللغوية',solution:'القراءة المتنوعة والكتابة الدقيقة',word:['استيعاب','فهم الشيء وإدخاله ضمن نظام معرفي'],evidence:'يقرأ الطالب نصوصًا متنوعة ويكتب بلغة دقيقة'},
{text:'في العمل التطوعي يتعلم الفرد أن الأثر لا يرتبط بحجم المهمة فقط. فقد تكون ساعة تُقضى في تنظيم مكتبة أو مساعدة زائر سببًا في تحسين تجربة كثير من الناس. ومع تكرار المشاركة تنمو مهارات التواصل والانضباط والشعور بالمسؤولية.',main:'العمل التطوعي يصنع أثرًا مجتمعيًا وينمي مهارات الفرد',detail:'المشاركة المتكررة تنمي التواصل والانضباط',inference:'المهمات الصغيرة قد يكون لها أثر كبير',view:'قيمة التطوع في الاستمرار والأثر',value:'التعاون',problem:'ضعف المشاركة المجتمعية',solution:'المشاركة المنتظمة في أعمال تطوعية',word:['الأثر','النتيجة التي يتركها العمل'],evidence:'قد تكون ساعة في تنظيم مكتبة سببًا في تحسين تجربة كثير من الناس'},
{text:'عند انتشار خبر في وسائل التواصل قد يدفعنا عنوان مثير إلى مشاركته سريعًا، لكن القراءة الناقدة تبدأ بالسؤال عن المصدر والتاريخ والأدلة. فالمعلومة الصحيحة لا تخشى التحقق، والوقت الذي نقضيه في التأكد أقل كلفة من نشر معلومة مضللة.',main:'التحقق من الأخبار قبل نشرها ضرورة للحد من التضليل',detail:'من خطوات التحقق فحص المصدر والتاريخ والأدلة',inference:'العنوان المثير لا يكفي للحكم على صحة الخبر',view:'التثبت مسؤولية قبل المشاركة',value:'التثبت',problem:'نشر المعلومات المضللة',solution:'التحقق من المصدر والتاريخ والأدلة',word:['مضللة','تقود المتلقي إلى فهم غير صحيح'],evidence:'المعلومة الصحيحة لا تخشى التحقق'},
{text:'تتغير بعض البيئات بسرعة بسبب الجفاف أو التوسع العمراني، ولذلك تحتاج حماية التنوع الحيوي إلى معرفة الأنواع الموجودة ومواطنها والعوامل التي تهددها. وتفيد المتابعة المستمرة في اكتشاف التغير مبكرًا قبل أن يصبح إصلاحه أصعب.',main:'حماية التنوع الحيوي تحتاج رصدًا مستمرًا للأنواع والتهديدات',detail:'المتابعة تكشف التغير مبكرًا',inference:'التدخل المبكر يقلل صعوبة معالجة الضرر',view:'الرصد أساس القرار البيئي',value:'المحافظة على البيئة',problem:'تراجع التنوع الحيوي',solution:'الرصد المستمر والتدخل المبكر',word:['مواطنها','الأماكن التي تعيش فيها الأنواع طبيعيًا'],evidence:'المتابعة المستمرة تفيد في اكتشاف التغير مبكرًا'},
{text:'لا يكفي أن يحفظ الطالب قاعدة رياضية؛ فالفهم يظهر حين يختار القاعدة المناسبة لموقف جديد، ويشرح سبب اختياره، ويتحقق من معقولية الناتج. لذلك فإن الخطأ الذي يكشف طريقة التفكير يمكن أن يكون فرصة للتعلم أكثر من إجابة صحيحة جاءت بالمصادفة.',main:'الفهم الرياضي الحقيقي يظهر في الاختيار والتبرير والتحقق لا في الحفظ فقط',detail:'التحقق من معقولية الناتج جزء من الفهم',inference:'تحليل الخطأ يساعد على تحسين التفكير',view:'الخطأ قد يكون فرصة تعلم',value:'المثابرة',problem:'الحفظ دون فهم',solution:'التطبيق والتبرير والتحقق',word:['معقولية','مدى قبول النتيجة منطقيًا'],evidence:'الفهم يظهر حين يختار القاعدة المناسبة ويشرح سبب اختياره'},
{text:'تمنح القراءة المنتظمة القارئ فرصة لمقارنة أفكار مختلفة، لكنها لا تعني قبول كل ما يقرأ. فالقارئ الواعي يميز بين حقيقة يمكن التحقق منها ورأي يحتاج إلى حجة، ثم يبني موقفه بعد فحص الأدلة ومقارنة البدائل.',main:'القراءة الواعية تقوم على فحص الأدلة والتمييز بين الحقيقة والرأي',detail:'الرأي يحتاج إلى حجة',inference:'كثرة القراءة وحدها لا تكفي دون تفكير نقدي',view:'الموقف الجيد يبنى بعد مقارنة الأدلة والبدائل',value:'الموضوعية',problem:'قبول المعلومات دون فحص',solution:'فحص الأدلة ومقارنة البدائل',word:['حجة','دليل أو تعليل يدعم رأيًا'],evidence:'القارئ الواعي يميز بين حقيقة يمكن التحقق منها ورأي يحتاج إلى حجة'},
{text:'تسعى فرق الإنقاذ إلى التدريب قبل وقوع الأزمات، لأن القرار في اللحظات الحرجة يحتاج إلى مهارة اكتسبت مسبقًا. والتدريب الجيد لا يكرر السيناريو نفسه دائمًا؛ بل يغيّر الظروف حتى يتعلم الفرد المبادئ ويطبقها في مواقف جديدة.',main:'التدريب المتنوع قبل الأزمات يبني قدرة على تطبيق المبادئ في مواقف جديدة',detail:'التدريب الجيد يغير الظروف والسيناريوهات',inference:'حفظ إجراء واحد لا يكفي لكل أزمة',view:'الاستعداد المسبق يرفع جودة القرار',value:'الاستعداد',problem:'ضعف الجاهزية للأزمات',solution:'تدريب متنوع ومتكرر',word:['الحرجة','الحاسمة التي تتطلب قرارًا سريعًا ودقيقًا'],evidence:'يغيّر الظروف حتى يتعلم الفرد المبادئ ويطبقها في مواقف جديدة'},
{text:'يبدأ المشروع العلمي الجيد بسؤال واضح يمكن اختباره، ثم تُحدد المتغيرات وتجمع البيانات بطريقة منظمة. وإذا لم توافق النتائج التوقعات فلا ينبغي تغيير البيانات، بل مراجعة الفرضية والإجراءات والبحث عن تفسير مدعوم بالأدلة.',main:'الاستقصاء العلمي يعتمد سؤالًا قابلًا للاختبار وبيانات منظمة وتفسيرًا قائمًا على الأدلة',detail:'عدم توافق النتائج مع التوقع لا يبرر تغيير البيانات',inference:'مراجعة الفرضية جزء طبيعي من العمل العلمي',view:'الأمانة مع البيانات أساس الاستقصاء',value:'الأمانة العلمية',problem:'تحريف البيانات لتوافق التوقع',solution:'مراجعة الفرضية والإجراءات',word:['الفرضية','تفسير قابل للاختبار'],evidence:'لا ينبغي تغيير البيانات بل مراجعة الفرضية والإجراءات'},
{text:'في التخطيط للوقت قد تبدو قائمة المهام الطويلة علامة على النشاط، لكنها لا تضمن الإنجاز. الأفضل أن يرتب الشخص مهامه بحسب أهميتها وموعدها، ويخصص وقتًا للمهام العميقة، ثم يراجع خطته ليتعلم من التأخير ويعدل تقديراته.',main:'إدارة الوقت الفعالة تقوم على ترتيب الأولويات والمراجعة لا على كثرة المهام',detail:'مراجعة الخطة تساعد على تعديل التقديرات',inference:'الانشغال المستمر لا يعني إنجازًا حقيقيًا',view:'الأولوية أهم من كثرة البنود',value:'الانضباط',problem:'تراكم المهام دون إنجاز',solution:'ترتيب الأولويات ومراجعة الخطة',word:['الأولويات','الأعمال الأهم التي تقدم على غيرها'],evidence:'يرتب الشخص مهامه بحسب أهميتها وموعدها'}
];

function readingType(t){
 if(/معاني|مرادف|ترادف|تضاد|سياق|تعريف|مصطلح|مفردات|دلالات/.test(t))return'vocab';
 if(/تصنف|يصنف|تصنيف/.test(t))return'classify';
 if(/يوظف|سياقات جديدة/.test(t))return'use';
 if(/الرئيس|الفرعية|موضوع/.test(t))return'main';
 if(/ضمنية|غير المباشرة|استنتج|يستنتج/.test(t))return'infer';
 if(/علاقات|سبب|نتيجة|يقارن|مقارنة/.test(t))return'relation';
 if(/مشاعر|دوافع|تعبير/.test(t))return'emotion';
 if(/يقوم|يقوّم|ينقد|الرأي|وجهة|القيم|البدائل|الإقناع|التعليل|يلخص|تلخيص|مواقف حياتية/.test(t))return'evaluate';
 return'infer';
}
function readingQuestion(t,r,n){
 const p=READING_PASSAGES[(n+ri(r,0,READING_PASSAGES.length-1))%READING_PASSAGES.length],type=readingType(t),ctx=p.text;
 if(type==='vocab'){const[w,m]=p.word;const forms=[()=>item(r,`ما المعنى الأقرب لكلمة «${w}» في النص؟`,m,['المعنى المضاد لها','تفصيل لا علاقة له بالسياق','اسم مكان ورد في النص'],'يفهم معنى الكلمة من سياقها داخل النص.',ctx,'knowledge'),()=>item(r,`أي تفسير يوضح دلالة كلمة «${w}» كما استعملها الكاتب؟`,m,['معنى حرفي لا يناسب السياق','رأي الكاتب في الموضوع','نتيجة لم يذكرها النص'],'السياق هو الذي يحدد الدلالة المقصودة.',ctx,'application'),()=>item(r,`لو استبدلت كلمة «${w}» بعبارة دون أن يتغير المعنى، فأي عبارة أنسب؟`,m,['عبارة تناقض المعنى','عبارة أوسع من المعنى المقصود','عبارة لا ترتبط بالفكرة'],'البديل الصحيح يحافظ على الدلالة في السياق.',ctx,'application')];return forms[n%forms.length]();}
 if(type==='classify')return item(r,'أي زوج من المفاهيم يمكن تصنيفه تحت علاقة «المشكلة ← الحل» في النص؟',`${p.problem} ← ${p.solution}`,[`${p.solution} ← ${p.problem}`,`${p.value} ← ${p.word[0]}`,`${p.main} ← ${p.value}`],'التصنيف يعتمد العلاقة الدلالية بين المفاهيم.',ctx,'reasoning');
 if(type==='use')return item(r,`أي جملة توظف كلمة «${p.word[0]}» توظيفًا يوافق معناها في النص؟`,`جملة تدل على: ${p.word[1]}.`,['جملة تستخدم الكلمة بمعنى مضاد.','جملة لا يظهر منها معنى الكلمة.','جملة تجعل الكلمة اسمًا لمكان دون قرينة.'],'التوظيف الصحيح يحافظ على المعنى المقصود في سياق جديد.',ctx,'application');
 if(type==='main')return item(r,'ما الفكرة الرئيسة التي تجمع تفاصيل النص؟',p.main,[p.detail,p.problem,p.evidence],'الفكرة الرئيسة أشمل من التفاصيل الجزئية.',ctx,'application');
 if(type==='infer')return item(r,'أي استنتاج تدعمه معلومات النص دون أن يذكره الكاتب بهذه الصياغة مباشرة؟',p.inference,[p.detail,`لا توجد علاقة بين ${p.problem} والموضوع.`,`يرى الكاتب أن الحل الوحيد هو تجاهل المشكلة.`],'الاستنتاج الصحيح يبنى على قرائن من النص ولا يكرر معلومة مباشرة.',ctx,'reasoning');
 if(type==='relation')return item(r,'أي علاقة بين فكرتين في النص هي الأدق؟',`${p.problem} يدفع إلى الحاجة لـ ${p.solution}`,[`${p.solution} سبب مباشر في زيادة ${p.problem}`,`${p.value} يلغي الحاجة إلى ${p.solution}`,'لا توجد علاقة بين المشكلة والحل'],'تحديد العلاقة يتطلب تتبع السبب والنتيجة أو المشكلة والحل.',ctx,'reasoning');
 if(type==='emotion')return item(r,'أي عبارة تصف اتجاه الكاتب بصورة أدق؟',p.view,['الحياد التام دون موقف','رفض الموضوع كله دون تعليل','السخرية من المشكلة بدل مناقشتها'],'يستدل على اتجاه الكاتب من اختياراته اللغوية وحججه.',ctx,'reasoning');
 const evals=[()=>item(r,'أي حكم نقدي على النص هو الأقوى؟',`الفكرة مقنعة لأن الكاتب دعمها بقرينة: ${p.evidence}`,['الفكرة صحيحة لأن النص طويل','الفكرة مرفوضة لأن فيها كلمات كثيرة','لا يمكن تقويم النص مهما كانت أدلته'],'التقويم القوي يرتبط بدليل من النص.',ctx,'reasoning'),()=>item(r,'أي بديل عملي ينسجم أكثر مع مشكلة النص؟',p.solution,[`تجاهل ${p.problem}`,'زيادة المشكلة بدل علاجها','تأجيل أي إجراء دون سبب'],'البديل الجيد يعالج المشكلة ويستند إلى معطيات النص.',ctx,'application'),()=>item(r,'أي تلخيص هو الأدق؟',p.main,[p.detail,`${p.problem} فقط دون ذكر الفكرة العامة`,p.word[1]],'التلخيص يلتقط الفكرة المركزية دون غرق في التفاصيل.',ctx,'application'),()=>item(r,'أي موقف حياتي يطبق فكرة النص بصورة صحيحة؟',`اختيار سلوك يحقق ${p.solution}`,[`سلوك يزيد ${p.problem}`,'سلوك لا يرتبط بالفكرة','تكرار عنوان النص دون تطبيق'],'التوظيف في موقف جديد يتطلب نقل الفكرة إلى سلوك مناسب.',ctx,'reasoning')];return evals[n%evals.length]();
}

function mathType(t){
 if(/القيمة المطلقة|قيمة مطلقة/.test(t)&&/معادلات|متباينات/.test(t))return/متباينات/.test(t)?'ineq_abs':'eq_abs';
 if(/فضاء العينة/.test(t))return'sample_space';
 if(/مبدأ العد|التباديل|التوافيق/.test(t))return'counting_probability';
 if(/أنواع الحوادث|المتنافية|المتممة|المستقلة/.test(t))return'event_probability';
 if(/النظري، والتجريبي|النظري والتجريبي/.test(t))return'theoretical_experimental';
 if(/تطبيقات حياتية على الاحتمالات/.test(t))return'probability_app';
 if(/احتمال|الاحتمالات/.test(t))return'probability';
 if(/تطبيقات حياتية على مقاييس/.test(t))return'stats_app';
 if(/الانحراف المتوسط|الانحراف المعياري|التباين/.test(t))return'deviation';
 if(/مقاييس التشتت|المدى الربيعي|القيم المتطرفة/.test(t))return'dispersion';
 if(/يقارن بين مقاييس النزعة|المقياس الأنسب/.test(t))return'central_compare';
 if(/النزعة المركزية|المتوسط الحسابي|الوسيط|المنوال/.test(t))return'central';
 if(/شكل الانتشار/.test(t))return'scatter';
 if(/يقرأ البيانات من تمثيلاتها/.test(t))return'graph_interpret';
 if(/الساق والورقة|الصندوق وطرفيه|الأعمدة|المدرجات/.test(t))return'graphs';
 if(/الدراسة المسحية|العينة العشوائية/.test(t))return'sampling';
 if(/المساحة السطحية/.test(t)&&/تطبيقات حياتية/.test(t))return'volume_app';
 if(/المساحة السطحية/.test(t))return'surface_area';
 if(/الحجوم|الحجم/.test(t)&&/تطبيقات حياتية/.test(t))return'volume_app';
 if(/الحجم|حجوم/.test(t))return'volume';
 if(/محيطي شكلين متشابهين/.test(t))return'perimeter_similarity';
 if(/محيط|مساحة/.test(t)&&/تطبيقات حياتية/.test(t))return'area_app';
 if(/محيط|مساحة/.test(t))return'area';
 if(/وحدات الكتلة الإنجليزية/.test(t))return'unit_mass';
 if(/وحدتي السعة الإنجليزية/.test(t))return'unit_capacity';
 if(/وحدات الطول الإنجليزية/.test(t))return'unit_length';
 if(/الوحدات المترية/.test(t))return'unit_mixed';
 if(/الأشكال المتماثلة|محاور التماثل|تماثل دوراني/.test(t))return'symmetry';
 if(/التمدد/.test(t)&&!/تطبيقات/.test(t))return'transform_dilation';
 if(/المستوى الإحداثي.*تحويل|نوع التحويل الهندسي/.test(t))return'transform_coordinate';
 if(/انعكاس|انسحاب|دوران|تحويل التطابق/.test(t))return'transform';
 if(/المسافة بين نقطتين|نقطة المنتصف/.test(t))return'coordinate_distance';
 if(/متوازيين أو متعامدين|يوازي آخر أو يعامده/.test(t))return'parallel_perpendicular';
 if(/معادلة المستقيم/.test(t))return'line_equation';
 if(/ميل المستقيم/.test(t))return'slope';
 if(/مجالها|مداها|العلاقة بين متغيرين/.test(t))return'relation';
 if(/المستوى الإحداثي|الأزواج المرتبة/.test(t))return'coordinates';
 if(/معكوسات النسب المثلثية/.test(t))return'trig_inverse';
 if(/يحل المثلث القائم/.test(t))return'trig_solve';
 if(/الجيب|جيب التمام|الظل|النسب المثلثية/.test(t))return'trig';
 if(/تطبيقات حياتية على تطابق|تطبيقات حياتية على.*تشابه/.test(t))return'similarity_app';
 if(/تشابه/.test(t))return'similarity';
 if(/حالات تطابق مثلثين/.test(t))return'triangle_congruence';
 if(/تطابق مضلعين/.test(t))return'congruence';
 if(/فيثاغورس/.test(t)&&/تطبيقات حياتية/.test(t))return'pythagoras_app';
 if(/فيثاغورس/.test(t))return'pythagoras';
 if(/الخصائص المشتركة بين جميع المثلثات/.test(t))return'triangle';
 if(/ثلاثية الأبعاد|مساقط|مخططاتها/.test(t))return'solid_shape';
 if(/الأشكال الرباعية/.test(t))return'quadrilateral';
 if(/تماثل/.test(t))return'symmetry';
 if(/متبادلتان|متناظرتان|قاطع/.test(t))return'parallel_angles';
 if(/الزوايا الداخلية|تبليط/.test(t))return'polygon';
 if(/يميز المتباينة/.test(t))return'inequality_identify';
 if(/تطبيقات حياتية على المتباينات/.test(t))return'inequality_app';
 if(/متباينات/.test(t))return'inequality';
 if(/نظام.*بيانيًا|النظام المتسق/.test(t))return'system_graph';
 if(/تطبيقات حياتية على نظام/.test(t))return'system_app';
 if(/نظام.*معادلتين/.test(t))return'system';
 if(/المعادلة الخطية ذات المتغيرين/.test(t))return'linear_two_var';
 if(/معادلات تربيعية|معادلة تربيعية/.test(t))return'quadratic_eq';
 if(/معادلة خطية|معادلات خطية/.test(t))return'linear_eq';
 if(/عامل مشترك أكبر/.test(t))return'factor_gcf';
 if(/خاصية التوزيع|تجميع الحدود/.test(t))return'factor_group';
 if(/يحلل.*جبر|الفرق بين مربعين|المربع الكامل/.test(t))return'factor';
 if(/المتطابقات/.test(t))return'identity';
 if(/تتضمن قيمًا مطلقة، وقوى/.test(t))return'algebra_expression';
 if(/العبارات الجبرية|العمليات الأربع على العبارات/.test(t))return'algebra';
 if(/تطبيقات حياتية على الدوال/.test(t))return'function_app';
 if(/الدالة التربيعية|القطع المكافئ/.test(t))return'quadratic_function';
 if(/الدالة الخطية/.test(t))return'function';
 if(/يصف الدالة/.test(t))return'function_rule';
 if(/تطبيقات حياتية.*(?:المتتابعة|العلاقة بين متغيرين|معدلات التغير)/.test(t))return'sequence_app';
 if(/معدلات التغير/.test(t))return'rate';
 if(/يعبر عن المتتابعة.*بدالة/.test(t))return'sequence_function';
 if(/تطبيقات حياتية على المتتابعة/.test(t))return'sequence_app';
 if(/متتابعة/.test(t))return'sequence';
 if(/النسبة المئوية من عدد/.test(t))return'percent_estimate';
 if(/تطبيقات حياتية على النسبة/.test(t))return'percent_app';
 if(/نسبة مئوية|التناسب المئوي|الربح|الخسارة|الزكاة|التخفيض|القيمة المضافة/.test(t))return'percent';
 if(/معدل الوحدة|النسبة،|النسبة والمعدل/.test(t))return'ratio';
 if(/متناسبة|التناسب/.test(t))return'proportion';
 if(/ترتيب العمليات/.test(t))return'order_operations';
 if(/يجمع الأعداد النسبية/.test(t))return'rational_arithmetic';
 if(/تطبيقات حياتية على العمليات الأربع/.test(t))return'arithmetic_app';
 if(/يجمع الأعداد الصحيحة/.test(t))return'arithmetic';
 if(/إنطاق المقام/.test(t))return'roots_rationalize';
 if(/يجمع الجذور/.test(t))return'roots_operations';
 if(/يقربه إلى أقرب/.test(t))return'roots_approx';
 if(/جذر|الجذور/.test(t))return'roots';
 if(/الصيغة العلمية/.test(t))return'scientific';
 if(/قوانين الأسس|قوة عدد/.test(t))return'powers';
 if(/القيمة المطلقة/.test(t))return'absolute';
 if(/الأعداد غير النسبية/.test(t))return'irrational';
 if(/الأعداد الحقيقية|يصنفها إلى/.test(t))return'number_sets';
 if(/الأعداد النسبية/.test(t)&&/أشكالها|يمثلها/.test(t))return'rational_forms';
 if(/يقارن.*الأعداد|يرتب.*الأعداد/.test(t))return'compare_numbers';
 if(/الأعداد الصحيحة|مواقف متضادة|خط الأعداد/.test(t))return'integers';
 return'math_general';
}
function mathQuestion(t,r,n){
 const type=mathType(t);
 switch(type){
 case'irrational':{const k=ri(r,2,12),v=k*k+pick(r,[1,2,3]);return item(r,`أي وصف أدق للعدد √${v}؟`,'عدد غير نسبي وحقيقي',['عدد صحيح','عدد كلي','عدد غير حقيقي'],'جذر العدد غير المربع الكامل عدد غير نسبي يقع ضمن الأعداد الحقيقية.');}
 case'roots_approx':{const k=ri(r,2,12),v=k*k+ri(r,1,Math.max(1,2*k-1)),ans=Math.round(Math.sqrt(v)*10)/10;return item(r,`قرب √${v} إلى أقرب عُشر.`,ans,[Math.floor(Math.sqrt(v)),Math.ceil(Math.sqrt(v)),fmt(ans+.1)],'نحدد المربعين الكاملين المحيطين ثم نقرب قيمة الجذر.');}
 case'roots_operations':{const k=ri(r,2,9),a=ri(r,2,6),b=ri(r,1,5),ans=(a+b)*k;return item(r,`بسط: ${a}√${k*k}+${b}√${k*k}`,ans,[a*k+b,(a+b)*k*k,Math.abs(a-b)*k],'نجمع الجذور المتشابهة بعد إيجاد الجذر التربيعي.');}
 case'roots_rationalize':{const k=ri(r,2,9);return item(r,`ما الصورة ذات المقام الناطق للكسر 1/√${k}؟`,`√${k}/${k}`,[`1/${k}`,`√${k}`,`${k}/√${k}`],'نضرب البسط والمقام في الجذر نفسه، فيصبح المقام عددًا ناطقًا.');}
 case'order_operations':{const a=ri(r,2,7),b=ri(r,2,6),c=ri(r,2,5),ans=a+b*c;return item(r,`أوجد قيمة العبارة: ${a}+${b}×${c}.`,ans,[ (a+b)*c, a*b+c, a+b+c ],'ننجز الضرب قبل الجمع وفق ترتيب العمليات.');}
 case'rational_arithmetic':{const d=pick(r,[4,5,8,10]),a=ri(r,1,d-1),b=ri(r,1,d-1),ans=frac(a+b,d);return item(r,`أوجد ناتج ${a}/${d}+${b}/${d} في أبسط صورة.`,ans,[frac(a*b,d),frac(Math.abs(a-b),d),frac(a+b,d*d)],'عند تساوي المقامين نجمع البسطين ثم نبسط الكسر.');}
 case'arithmetic_app':{const start=ri(r,-8,5),change=ri(r,4,14),ans=start-change;return item(r,`كانت درجة الحرارة ${start}°س ثم انخفضت ${change} درجات. ما الدرجة الجديدة؟`,`${ans}°س`,[`${start+change}°س`,`${change-start}°س`,`${-ans}°س`],'يمثل الانخفاض طرح مقدار التغير من القيمة الابتدائية.');}
 case'percent_estimate':{const whole=pick(r,[80,120,160,240]),p=pick(r,[125,150,175]),ans=whole*p/100;return item(r,`ما ${p}% من ${whole}؟`,ans,[whole*(p-100)/100,whole+p,whole*p/10],'نحوّل النسبة إلى عدد عشري ثم نضرب في الكل، حتى إن تجاوزت 100%.');}
 case'percent_app':{const price=pick(r,[80,120,160,200]),p=pick(r,[10,15,20,25]),discount=price*p/100;return item(r,`سلعة سعرها ${price} ريالًا عليها خصم ${p}%. ما السعر بعد الخصم؟`,price-discount,[discount,price+discount,price-p],'نحسب مقدار الخصم ثم نطرحه من السعر الأصلي.');}
 case'sequence_function':{const first=ri(r,1,8),d=ri(r,2,7),b=first-d;return item(r,`متتابعة حسابية حدها الأول ${first} والفرق ${d}. أي دالة تمثل حدها النوني؟`,`حₙ=${d}ن${b>=0?'+':''}${b}`,[`حₙ=${first}ن+${d}`,`حₙ=${d}ن+${first}`,`حₙ=${first}+ن`],'قاعدة الحد النوني هي حₙ=د×ن+(الحد الأول−د).');}
 case'sequence_app':{const first=ri(r,3,10),d=ri(r,2,6),day=ri(r,6,12),ans=first+(day-1)*d;return item(r,`ادخر طالب ${first} ريالات في اليوم الأول، وزاد ادخاره اليومي ${d} ريالين كل يوم. كم يدخر في اليوم ${day}؟`,ans,[first+day*d,first+(day-2)*d,day*d],'الموقف متتابعة حسابية وحدها المطلوب حₙ=ح₁+(ن−1)د.');}
 case'function_rule':{const m=ri(r,2,6),b=ri(r,-4,4);return item(r,`إذا كانت الأزواج (1،${m+b}) و(2،${2*m+b}) و(3،${3*m+b})، فما قاعدة الدالة؟`,`ص=${m}س${b>=0?'+':''}${b}`,[`ص=${b}س+${m}`,`ص=${m+b}س`,`ص=س+${m}`],'نحدد معدل التغير ثم المقطع الثابت من الأزواج المرتبة.');}
 case'function_app':{const fee=ri(r,5,20),rate=ri(r,2,8),x=ri(r,3,9),ans=fee+rate*x;return item(r,`تكلفة خدمة تساوي ${fee} ريالًا ثابتة و${rate} ريالات لكل وحدة. ما التكلفة عند ${x} وحدات؟`,ans,[rate*x,fee*x,fee+rate+x],'نمثل الموقف بدالة خطية: التكلفة=الثابت+(المعدل×عدد الوحدات).');}
 case'algebra_expression':{const x=ri(r,-5,-2),a=ri(r,2,4),ans=Math.abs(x)+a*a;return item(r,`أوجد قيمة |س|+${a}² عندما س=${x}.`,ans,[x+a*a,Math.abs(x+a)*2,Math.abs(x)+a],'نوجد القيمة المطلقة والقوة قبل الجمع.');}
 case'factor_gcf':{const g=ri(r,2,8),a=ri(r,2,6),b=ri(r,2,6);return item(r,`حلل بإخراج العامل المشترك الأكبر: ${g*a}س+${g*b}`,`${g}(${a}س+${b})`,[`${a}(${g}س+${b})`,`(${g*a}س)(${g*b})`,`${g}(${a+b}س)`],'نقسم كل حد على العامل المشترك الأكبر ثم نضعه خارج القوس.');}
 case'factor_group':{const a=ri(r,2,6),b=ri(r,2,6);return item(r,`حلل بالتجميع: أ س+أ ${b}+${a}س+${a*b}`,`(أ+${a})(س+${b})`,[`(أ+س)(${a}+${b})`,`(أ+${b})(س+${a})`,`أ(س+${b})+${a}`],'نجمع كل حدين ونستخرج العامل المشترك المتكرر.');}
 case'linear_two_var':{const a=ri(r,2,5),b=ri(r,1,4),x=ri(r,1,6),y=ri(r,1,6),c=a*x+b*y;return item(r,`أي زوج مرتب يحقق المعادلة ${a}س+${b}ص=${c}؟`,`(${x}، ${y})`,[`(${y}، ${x})`,`(${x+1}، ${y})`,`(${x}، ${y+1})`],'نعوض بالإحداثيين ونتحقق من تساوي طرفي المعادلة.');}
 case'system_graph':{const m=ri(r,2,5),b1=ri(r,-4,0),b2=ri(r,1,5);return item(r,`المستقيمان ص=${m}س${b1>=0?'+':''}${b1}، وص=${m}س+${b2}. ما نوع النظام؟`,'غير متسق؛ لا حل',['متسق مستقل؛ حل واحد','متسق غير مستقل؛ حلول لا نهائية','متسق وله حلان'],'للمستقيمين الميل نفسه ومقطعان مختلفان؛ لذا هما متوازيان ولا يتقاطعان.');}
 case'system_app':{const adult=ri(r,10,20),child=ri(r,4,9),a=ri(r,2,6),c=ri(r,2,6),count=a+c,total=a*adult+c*child;return item(r,`باع نشاط ${count} تذاكر؛ للكبير ${adult} ريالًا وللصغير ${child} ريالات، وكان الدخل ${total} ريالًا. إذا كان عدد تذاكر الكبار ${a}، فكم تذكرة صغيرة بيعت؟`,c,[a,count,total/child],'نستخدم معادلتي العدد الكلي والدخل ثم نتحقق من الحل في الموقف.');}
 case'inequality_identify':{const k=ri(r,4,12);return item(r,`أي متباينة تمثل العبارة: «عدد يزيد على ${k}»؟`,`س>${k}`,[`س<${k}`,`س≥${k}`,`س=${k}`],'عبارة يزيد على تعني أكبر من دون مساواة.');}
 case'inequality_app':{const budget=pick(r,[60,80,100,120]),price=pick(r,[8,10,12]),max=Math.floor(budget/price);return item(r,`مع طالب ${budget} ريالًا، وثمن القطعة ${price} ريالات. ما أكبر عدد قطع يمكنه شراؤه دون تجاوز المبلغ؟`,max,[max+1,price,budget-price],'نكتب متباينة السعر×العدد≤المبلغ ثم نأخذ أكبر عدد صحيح يحققها.');}
 case'triangle':{const a=ri(r,35,70),b=ri(r,35,70),c=180-a-b;return item(r,`في مثلث زاويتان قياسهما ${a}° و${b}°. ما قياس الزاوية الثالثة؟`,`${c}°`,[`${a+b}°`,`${180-a}°`,`${180-b}°`],'مجموع زوايا المثلث 180°.');}
 case'pythagoras_app':{const[u,v,h]=pick(r,[[3,4,5],[5,12,13],[6,8,10]]);return item(r,`سُلّم يبعد أسفله ${u} م عن جدار ويصل إلى ارتفاع ${v} م. ما طول السلم؟`,`${h} م`,[`${u+v} م`,`${v-u} م`,`${h+1} م`],'المسافة والارتفاع ضلعان قائمان، وطول السلم هو الوتر.');}
 case'triangle_congruence':return item(r,'تساوى ضلعان والزاوية المحصورة بينهما في مثلثين. ما حالة التطابق؟','ضلع-زاوية-ضلع',['زاوية-زاوية فقط','ضلع-ضلع فقط','زاوية-ضلع غير محصور'],'تساوي ضلعين والزاوية المحصورة يثبت التطابق.');
 case'similarity_app':{const shadow=ri(r,2,5),height=ri(r,2,6),towerShadow=shadow*ri(r,3,7),ans=height*towerShadow/shadow;return item(r,`عمود طوله ${height} م وظله ${shadow} م، وظل برج في الوقت نفسه ${towerShadow} م. ما ارتفاع البرج؟`,`${ans} م`,[`${towerShadow-height} م`,`${towerShadow+height} م`,`${height*shadow} م`],'تشابه المثلثات يجعل نسبة الارتفاع إلى الظل ثابتة.');}
 case'trig_inverse':{const opp=3,adj=4,ans=Math.round(Math.atan(opp/adj)*180/Math.PI);return item(r,`في مثلث قائم، المقابل لزاوية حادة 3 والمجاور 4. ما قياس الزاوية تقريبًا؟`,`${ans}°`,[`37°`,`53°`,`60°`],'نستخدم معكوس الظل: الزاوية=tan⁻¹(3/4).');}
 case'trig_solve':{const tri=pick(r,[[3,4,5],[5,12,13],[8,15,17]]);return item(r,`في مثلث قائم وتره ${tri[2]} سم وأحد ضلعيه ${tri[0]} سم. ما طول الضلع الآخر؟`,`${tri[1]} سم`,[`${tri[2]-tri[0]} سم`,`${tri[0]+tri[2]} سم`,`${tri[1]+1} سم`],'يمكن استخدام النسبة المثلثية المناسبة أو فيثاغورس لإكمال حل المثلث.');}
 case'line_equation':{const m=ri(r,2,6),b=ri(r,-5,5);return item(r,`مستقيم ميله ${m} ومقطعه الصادي ${b}. ما معادلته بصيغة الميل والمقطع؟`,`ص=${m}س${b>=0?'+':''}${b}`,[`ص=${b}س+${m}`,`ص=${m}+س${b>=0?'+':''}${b}`,`${m}ص=س+${b}`],'صيغة الميل والمقطع هي ص=م س+ب.');}
 case'parallel_perpendicular':{const m=pick(r,[2,3,4,-2,-3]);return item(r,`ما ميل مستقيم عمودي على مستقيم ميله ${m}؟`,frac(-1,m),[String(m),String(-m),frac(1,m)],'ميلا المستقيمين المتعامدين متعاكسان مقلوبان وحاصل ضربهما -1.');}
 case'transform_dilation':{const k=pick(r,[2,3,.5]),x=ri(r,2,6),y=ri(r,2,6);return item(r,`تمدد مركزه الأصل ومعامله ${k} للنقطة (${x}،${y}). ما صورتها؟`,`(${fmt(k*x)}، ${fmt(k*y)})`,[`(${fmt(x+k)}، ${fmt(y+k)})`,`(${fmt(k*x)}، ${y})`,`(${x}، ${fmt(k*y)})`],'في تمدد مركزه الأصل نضرب كلا الإحداثيين في معامل التمدد.');}
 case'transform_coordinate':{const x=ri(r,1,6),y=ri(r,1,6),dx=ri(r,2,5),dy=ri(r,1,4);return item(r,`نقلت النقطة (${x}،${y}) بالقاعدة (س+${dx}، ص-${dy}). ما صورتها؟`,`(${x+dx}، ${y-dy})`,[`(${x-dx}، ${y+dy})`,`(${x+dx}، ${y+dy})`,`(${x-dx}، ${y-dy})`],'نطبق مقدار الإزاحة على كل إحداثي وفق إشارته.');}
 case'unit_length':{const yd=ri(r,2,12);return item(r,`كم قدمًا في ${yd} ياردات؟`,yd*3,[yd*12,yd+3,yd/3],'كل ياردة تساوي 3 أقدام.');}
 case'unit_mass':{const lb=ri(r,2,12);return item(r,`كم أوقية في ${lb} أرطال؟`,lb*16,[lb*12,lb+16,lb/16],'كل رطل يساوي 16 أوقية.');}
 case'unit_capacity':{const gal=ri(r,2,9);return item(r,`كم كوبًا في ${gal} جالونات؟`,gal*16,[gal*8,gal*4,gal+16],'كل جالون يساوي 16 كوبًا.');}
 case'unit_mixed':{const m=ri(r,2,15);return item(r,`كم سنتيمترًا في ${m} أمتار؟`,m*100,[m*10,m*1000,m+100],'كل متر يساوي 100 سنتيمتر.');}
 case'area_app':{const l=ri(r,8,20),w=ri(r,5,12),cut=ri(r,2,Math.min(4,w-1)),ans=l*w-cut*cut;return item(r,`ساحة مستطيلة ${l}×${w} م حُذف منها مربع ضلعه ${cut} م. ما المساحة المتبقية؟`,`${ans} م²`,[`${l*w} م²`,`${l*w-2*cut} م²`,`${2*(l+w)-cut*cut} م²`],'نحسب مساحة المستطيل ثم نطرح مساحة الجزء المربع.');}
 case'perimeter_similarity':{const k=ri(r,2,5),p=ri(r,12,40),ans=k*p;return item(r,`شكلان متشابهان، معامل التشابه من الأول إلى الثاني ${k}، ومحيط الأول ${p} سم. ما محيط الثاني؟`,`${ans} سم`,[`${p+k} سم`,`${p*k*k} سم`,`${fmt(p/k)} سم`],'نسبة المحيطين تساوي معامل التشابه الخطي.');}
 case'surface_area':{const r0=ri(r,2,6),h=ri(r,3,9),ans=2*3.14*r0*(r0+h);return item(r,`أسطوانة نصف قطرها ${r0} سم وارتفاعها ${h} سم. ما مساحتها السطحية الكلية تقريبًا؟`,`${fmt(ans)} سم²`,[`${fmt(3.14*r0*r0*h)} سم²`,`${fmt(2*3.14*r0*h)} سم²`,`${fmt(3.14*r0*r0)} سم²`],'المساحة الكلية للأسطوانة=2πنق²+2πنق×ع.');}
 case'volume_app':{const r0=ri(r,2,6),h=ri(r,3,9),ans=3.14*r0*r0*h;return item(r,`خزان أسطواني نصف قطره ${r0} م وارتفاعه ${h} م. ما حجمه تقريبًا؟`,`${fmt(ans)} م³`,[`${fmt(2*3.14*r0*h)} م³`,`${fmt(3.14*r0*h)} م³`,`${fmt(3.14*r0*r0)} م³`],'حجم الأسطوانة=πنق²×الارتفاع.');}
 case'graph_interpret':{const a=ri(r,20,40),b=a+ri(r,5,15),c=b+ri(r,5,15);return item(r,`أظهرت بيانات ثلاثة أعوام القيم ${a}، ${b}، ${c}. أي تنبؤ أقرب إذا استمر الاتجاه؟`,c+(b-a),[a,b,c-5],'نحدد اتجاه الزيادة ومقدارها التقريبي قبل التنبؤ.');}
 case'central_compare':return item(r,'للقيم 5، 6، 6، 7، 40؛ أي مقياس يمثل المركز بصورة أفضل؟','الوسيط',['المتوسط الحسابي','المدى','القيمة العظمى'],'القيمة المتطرفة 40 تؤثر في المتوسط، بينما يبقى الوسيط ممثلًا أفضل للمركز.');
 case'deviation':return item(r,'للقيم 2، 2، 4، 4؛ ما الانحراف المعياري إذا اعتُبرت المجموعة مجتمعًا؟','1',['2','3','4'],'المتوسط 3، والتباين 1، وجذر التباين يساوي 1.');
 case'stats_app':return item(r,'درجات مجموعة: 7، 7، 8، 8، 10. أي وصف يجمع المركز والتشتت؟','الوسيط 8 والمدى 3',['الوسيط 7 والمدى 2','المتوسط 10 والمدى 3','المنوال 8 فقط والمدى 10'],'نرتب القيم؛ الوسيط هو الثالثة والمدى الفرق بين الكبرى والصغرى.');
 case'sample_space':{const sides=pick(r,[4,6,8]);return item(r,`رُميت قطعة نقد ودُحرج حجر أرقام له ${sides} أوجه. كم ناتجًا في فضاء العينة؟`,2*sides,[sides,sides+2,sides*sides],'مبدأ العد: نتيجتان للقطعة × عدد أوجه الحجر.');}
 case'counting_probability':{const count=pick(r,[3,4,5]),ans=[0,0,2,6,24,120][count];return item(r,`بكم طريقة يمكن ترتيب ${count} عناصر مختلفة في صف؟`,ans,[count*count,count*2,ans/count],'عدد التباديل الكلية لعناصر مختلفة يساوي ن!.');}
 case'event_probability':return item(r,'عند رمي حجر أرقام، الحادثتان «ظهور عدد زوجي» و«ظهور عدد فردي» هما:','متنافيتان ومتممتان',['غير متنافيتين','مستقلتان فقط','حادثة بسيطة واحدة'],'لا يمكن وقوعهما معًا، واتحادهما يساوي فضاء العينة كله.');
 case'theoretical_experimental':{const trials=pick(r,[40,60,80]),heads=trials/2+pick(r,[-4,-2,2,4]);return item(r,`ظهرت الصورة ${heads} مرة في ${trials} رمية. ما الاحتمال التجريبي لظهورها؟`,frac(heads,trials),['1/2',frac(trials-heads,trials),frac(1,trials)],'الاحتمال التجريبي=عدد مرات وقوع الحادثة÷عدد التجارب.');}
 case'probability_app':{const good=ri(r,12,20),bad=ri(r,2,6),tot=good+bad;return item(r,`في فحص عينة فيها ${good} قطعة سليمة و${bad} معيبة، ما احتمال اختيار قطعة معيبة؟`,frac(bad,tot),[frac(good,tot),frac(bad,good),frac(1,tot)],'نقسم عدد النواتج المطلوبة على العدد الكلي للنواتج.');}
 case'integers':{const v=ri(r,2,25),neg=r()>.5?-v:v;return item(r,`أي عدد صحيح يمثل ${neg<0?'انخفاضًا':'ارتفاعًا'} مقداره ${v} وحدات عن نقطة الصفر؟`,neg,[-neg,0,neg<0?neg-1:neg+1],'الإشارة تحدد الاتجاه بالنسبة للصفر.');}
 case'compare_numbers':{const vals=uniq([ri(r,-20,20),ri(r,-20,20),ri(r,-20,20),ri(r,-20,20)]).slice(0,4);while(vals.length<4)vals.push(ri(r,-20,20));const s=[...vals].sort((x,y)=>x-y);return item(r,'أي ترتيب تصاعدي صحيح للأعداد الآتية؟',s.join(' ، '),[[...s].reverse().join(' ، '),[s[1],s[0],s[2],s[3]].join(' ، '),[s[0],s[2],s[1],s[3]].join(' ، ')],'في الترتيب التصاعدي نبدأ بالأصغر.');}
 case'absolute':{const v=ri(r,-25,-2);return item(r,`ما قيمة |${v}|؟`,Math.abs(v),numWrongs(Math.abs(v),1),'القيمة المطلقة تمثل البعد عن الصفر.',null,'knowledge');}
 case'rational_forms':{const d=pick(r,[2,4,5,10]),a=ri(r,1,d*2-1),v=a/d;return item(r,`أي عدد عشري يكافئ ${a}/${d}؟`,fmt(v),numWrongs(v,.1),'نحوّل الكسر بقسمة البسط على المقام.');}
 case'number_sets':{const k=ri(r,2,12),sq=k*k;return item(r,`أي تصنيف أدق للعدد √${sq}؟`,'عدد طبيعي وصحيح ونسبي وحقيقي',['غير نسبي فقط','تخيلي','غير حقيقي'],'جذر مربع كامل عدد صحيح، وكل صحيح عدد نسبي وحقيقي.');}
 case'roots':{const k=ri(r,3,15),sq=k*k;return item(r,`ما قيمة √${sq}؟`,k,numWrongs(k,1),`لأن ${k}×${k}=${sq}.`);}
 case'powers':{const a=ri(r,2,5),e=ri(r,2,4),ans=a**e;return item(r,`ما قيمة ${a}^${e}؟`,ans,numWrongs(ans,a),`نكرر ضرب الأساس في نفسه ${e} مرات.`);}
 case'scientific':{const m=ri(r,12,98)/10,e=ri(r,3,7),ans=m*10**e;return item(r,`أي صيغة قياسية تكافئ ${m} × 10^${e}؟`,String(ans),[String(m*10**(e-1)),String(m*10**(e+1)),String((m+1)*10**e)],'نحرك الفاصلة بعدد مراتب يساوي الأس.');}
 case'arithmetic':{const x=ri(r,-15,15),y=ri(r,-12,12)||3,op=pick(r,['+','−','×']);let ans,q;if(op==='+'){ans=x+y;q=`${x} + (${y})`}else if(op==='−'){ans=x-y;q=`${x} - (${y})`}else{ans=x*y;q=`${x} × (${y})`}return item(r,`أوجد قيمة: ${q}`,ans,numWrongs(ans,Math.max(1,Math.abs(y))),'نطبق قواعد العمليات على الأعداد.');}
 case'ratio':{const h=ri(r,2,10),rate=ri(r,3,12),total=h*rate;return item(r,`قطع شخص ${total} كم في ${h} ساعات بمعدل ثابت. ما معدل الوحدة؟`,`${rate} كم/ساعة`,[`${h} كم/ساعة`,`${total} كم/ساعة`,`${rate+h} كم/ساعة`],'معدل الوحدة = الكمية ÷ عدد الوحدات.');}
 case'proportion':{const x=ri(r,2,9),k=ri(r,2,6),y=x*k,z=ri(r,2,8);return item(r,`إذا كان ${x}/${y} = ${z}/س، فما قيمة س؟`,z*k,numWrongs(z*k,k),'نستخدم الضرب التبادلي في التناسب.');}
 case'percent':{const whole=pick(r,[80,100,120,160,200,240]),p=pick(r,[10,20,25,30,40,50]),ans=whole*p/100;return item(r,`ما ${p}% من ${whole}؟`,ans,numWrongs(ans,5),`النسبة المئوية = ${p}/100 × ${whole}.`);}
 case'sequence':{const first=ri(r,1,10),d=ri(r,2,8),k=ri(r,5,12),ans=first+(k-1)*d;return item(r,`متتابعة حسابية حدها الأول ${first} والفرق ${d}. ما الحد رقم ${k}؟`,ans,numWrongs(ans,d),'ح_n = ح_1 + (ن−1)د.');}
 case'rate':{const x1=ri(r,0,3),x2=x1+ri(r,2,5),m=ri(r,2,7),y1=ri(r,1,8),y2=y1+m*(x2-x1);return item(r,`ما معدل التغير بين النقطتين (${x1}, ${y1}) و(${x2}, ${y2})؟`,m,numWrongs(m,1),'معدل التغير = التغير في ص ÷ التغير في س.');}
 case'relation':{const xs=[1,2,3],m=ri(r,2,5),k=ri(r,0,4),ys=xs.map(x=>m*x+k);return item(r,`للعلاقة: (1,${ys[0]})، (2,${ys[1]})، (3,${ys[2]}). ما المدى؟`,`{${ys.join('، ')}}`,[`{${xs.join('، ')}}`,`{${[ys[0],ys[2]].join('، ')}}`,`{${[0,...ys].join('، ')}}`],'المدى هو مجموعة قيم المخرجات.');}
 case'function':{const m=ri(r,2,6),k=ri(r,-5,5),x=ri(r,1,6),ans=m*x+k;return item(r,`إذا كانت د(س)=${m}س${k>=0?'+':''}${k}، فما د(${x})؟`,ans,numWrongs(ans,m),'نعوض قيمة س في قاعدة الدالة.');}
 case'quadratic_function':{const h=ri(r,-3,3),k=ri(r,-4,4);return item(r,`للدالة ص=(س${h<=0?'+':''}${-h})²${k>=0?'+':''}${k}، ما رأس القطع المكافئ؟`,`(${h}, ${k})`,[`(${-h}, ${k})`,`(${h}, ${-k})`,`(0, ${k})`],'الصيغة (س−هـ)²+ك رأسها (هـ،ك).');}
 case'algebra':{const x=ri(r,2,8),c=ri(r,2,6),k=ri(r,-5,5),ans=c*x+k;return item(r,`أوجد قيمة ${c}س${k>=0?'+':''}${k} عندما س=${x}.`,ans,numWrongs(ans,c),'نعوض عن س ثم نجري العمليات.');}
 case'identity':{const x=ri(r,2,6),y=ri(r,1,5),ans=(x+y)**2;return item(r,`ما قيمة (${x}+${y})²؟`,ans,[x*x+y*y,(x+y)*2,x*x+2*x+y*y],'مربع مجموع حدين = أ² + 2أب + ب².');}
 case'factor':{const p=ri(r,2,7),q=ri(r,2,7);return item(r,`حلل: س² + ${p+q}س + ${p*q}`,`(س+${p})(س+${q})`,[`(س+${p+q})(س+${p*q})`,`(س−${p})(س−${q})`,`(س+${p})(س−${q})`],'نبحث عن عددين مجموعهما معامل س وحاصل ضربهما الحد الثابت.');}
 case'linear_eq':{const x=ri(r,2,15),m=ri(r,2,7),k=ri(r,-8,8),rhs=m*x+k;return item(r,`حل المعادلة: ${m}س${k>=0?'+':''}${k}=${rhs}`,x,numWrongs(x,1),'نعزل المتغير بإجراء العمليات العكسية.');}
 case'quadratic_eq':{const p=ri(r,1,6),q=ri(r,1,6),answer=p===q?`س=${p}`:`س=${p} أو س=${q}`;return item(r,`حل س² - ${p+q}س + ${p*q}=0`,answer,[`س=${p+q} فقط`,`س=${p*q} فقط`,'لا حل حقيقي'],'نحلل المقدار إلى (س−أ)(س−ب)=0.');}
 case'eq_abs':{const a=ri(r,3,12);return item(r,`حل |س|=${a}.`,`س=${a} أو س=${-a}`,[`س=${a} فقط`,`س=${-a} فقط`,'لا حل'],'للقيمة المطلقة الموجبة حلان متعاكسان.');}
 case'system':{const x=ri(r,1,6),y=ri(r,1,6),s=x+y,d=x-y;return item(r,`حل النظام: س+ص=${s} ، س−ص=${d}`,`س=${x}، ص=${y}`,[`س=${y}، ص=${x}`,`س=${s}، ص=${d}`,`س=${x+1}، ص=${y-1}`],'نجمع المعادلتين ثم نعوض لإيجاد المتغير الآخر.');}
 case'inequality':{const k=ri(r,2,8),b=ri(r,5,20);return item(r,`حل المتباينة: ${k}س < ${k*b}`,`س < ${b}`,[`س > ${b}`,`س ≤ ${b}`,`س > ${k*b}`],'القسمة على عدد موجب لا تغير اتجاه المتباينة.');}
 case'ineq_abs':{const k=ri(r,3,10);return item(r,`حل |س| < ${k}.`,`-${k} < س < ${k}`,[`س < -${k} أو س > ${k}`,`س > ${k} فقط`,`س < ${k} فقط`],'المسافة عن الصفر أقل من ك تعني أن س بين -ك وك.');}
 case'polygon':{const sides=pick(r,[5,6,8,10]),ans=(sides-2)*180;return item(r,`ما مجموع الزوايا الداخلية لمضلع عدد أضلاعه ${sides}؟`,`${ans}°`,[`${sides*180}°`,`${(sides-1)*180}°`,`${ans-180}°`],'المجموع = (ن−2)×180°.');}
 case'parallel_angles':{const a=ri(r,30,75);return item(r,`قاطع يقطع مستقيمين متوازيين، فإذا كانت زاوية متناظرة قياسها ${a}° فما قياس الزاوية المناظرة لها؟`,`${a}°`,[`${180-a}°`,`${90-a}°`,`${a+10}°`],'الزوايا المتناظرة بين مستقيمين متوازيين متساوية.');}
 case'symmetry':return item(r,'أي شكل له عدد لا نهائي من محاور التماثل؟','الدائرة',['مثلث مختلف الأضلاع','متوازي أضلاع عام','شبه منحرف غير متساوي الساقين'],'كل قطر في الدائرة يمثل محور تماثل.',null,'knowledge');
 case'quadrilateral':return item(r,'أي خاصية صحيحة للمستطيل؟','أضلاعه المتقابلة متوازية ومتساوية وزواياه قائمة',['أقطاره غير متساوية دائمًا','له ضلعان فقط','لا توجد أضلاع متوازية'],'هذه من الخصائص الأساسية للمستطيل.',null,'knowledge');
 case'solid_shape':return item(r,'أي مجسم له قاعدتان دائريتان متطابقتان ومتوازيتان؟','الأسطوانة',['المخروط','الهرم الرباعي','المنشور الثلاثي'],'الأسطوانة لها قاعدتان دائريتان.',null,'knowledge');
 case'pythagoras':{const[u,v,h]=pick(r,[[3,4,5],[5,12,13],[6,8,10],[8,15,17]]);return item(r,`مثلث قائم ضلعا قائمته ${u} سم و${v} سم. ما طول الوتر؟`,`${h} سم`,[`${u+v} سم`,`${Math.abs(v-u)} سم`,`${h+1} سم`],'نطبق أ²+ب²=ج².');}
 case'congruence':return item(r,'إذا تساوت الأضلاع الثلاثة في مثلثين كل مع نظيره، فأي مسلمة تثبت التطابق؟','ضلع-ضلع-ضلع',['زاوية-زاوية فقط','تشابه فقط','لا يمكن إثبات شيء'],'تساوي الأضلاع الثلاثة المتناظرة يثبت التطابق.',null,'knowledge');
 case'similarity':{const k=ri(r,2,5),a=ri(r,3,8),b=a*k,c=ri(r,2,7);return item(r,`مضلعان متشابهان، ضلعان متناظران طولهما ${a} و${b}. إذا كان ضلع في الأول ${c}، فما نظيره في الثاني؟`,c*k,numWrongs(c*k,k),'معامل التشابه ثابت بين الأضلاع المتناظرة.');}
 case'trig':{const tri=pick(r,[[3,4,5],[5,12,13],[8,15,17]]),opp=tri[0],adj=tri[1];return item(r,`في مثلث قائم، بالنسبة لزاوية حادة طول المقابل ${opp} والمجاور ${adj}. ما قيمة الظل؟`,frac(opp,adj),[frac(adj,opp),frac(opp,tri[2]),frac(adj,tri[2])],'ظل الزاوية = المقابل ÷ المجاور.');}
 case'slope':{const m=ri(r,2,6),x1=ri(r,0,3),x2=x1+2,y1=ri(r,1,5),y2=y1+2*m;return item(r,`ما ميل المستقيم المار بالنقطتين (${x1},${y1}) و(${x2},${y2})؟`,m,numWrongs(m,1),'الميل = (ص2−ص1)/(س2−س1).');}
 case'coordinate_distance':{const x1=ri(r,0,5),y1=ri(r,0,5),x2=x1+3,y2=y1+4;return item(r,`ما المسافة بين (${x1},${y1}) و(${x2},${y2})؟`,5,[4,6,7],'نستخدم صيغة المسافة، وهنا يتكون مثلث 3-4-5.');}
 case'coordinates':{const x=ri(r,-6,6),y=ri(r,-6,6);return item(r,`أي زوج مرتب يمثل نقطة إحداثيها السيني ${x} والصادي ${y}؟`,`(${x}, ${y})`,[`(${y}, ${x})`,`(${-x}, ${y})`,`(${x}, ${-y})`],'يكتب الزوج المرتب (س،ص).');}
 case'transform':{const x=ri(r,1,6),y=ri(r,1,6);return item(r,`انعكست النقطة (${x},${y}) حول محور الصادات. ما صورتها؟`,`(${-x}, ${y})`,[`(${x}, ${-y})`,`(${-x}, ${-y})`,`(${y}, ${x})`],'الانعكاس حول محور الصادات يغير إشارة س فقط.');}
 case'units':{const ft=ri(r,2,12);return item(r,`كم بوصة في ${ft} أقدام؟`,ft*12,[ft*3,ft+12,ft*36],'كل قدم = 12 بوصة.');}
 case'area':{const rad=ri(r,2,8);return item(r,`دائرة نصف قطرها ${rad} سم. ما مساحتها باستخدام π≈3.14؟`,fmt(3.14*rad*rad),[fmt(2*3.14*rad),fmt(3.14*rad),fmt(rad*rad)],'مساحة الدائرة = πنق².');}
 case'volume':{const l=ri(r,2,7),w=ri(r,2,7),h=ri(r,2,7),ans=l*w*h;return item(r,`منشور مستطيل أبعاده ${l}×${w}×${h} سم. ما حجمه؟`,`${ans} سم³`,[`${l*w+h} سم³`,`${2*(l*w+l*h+w*h)} سم³`,`${l+w+h} سم³`],'الحجم = الطول×العرض×الارتفاع.');}
 case'sampling':return item(r,'يريد باحث تمثيل جميع طلاب المدرسة دون تحيز. أي عينة أنسب؟','عينة عشوائية من جميع الصفوف',['أول عشرة طلاب يصلون صباحًا','طلاب فصل واحد فقط','الطلاب المتطوعون فقط'],'العينة العشوائية تقلل تحيز الاختيار.',null,'reasoning');
 case'graphs':return item(r,'أي تمثيل أنسب لمقارنة أعداد الطلاب في أربع فئات منفصلة؟','الأعمدة',['الخط الزمني','مخطط الانتشار','صندوق وطرفاه فقط'],'الأعمدة مناسبة لمقارنة فئات منفصلة.');
 case'scatter':return item(r,'في مخطط انتشار ترتفع النقاط من أسفل اليسار إلى أعلى اليمين. ماذا يدل ذلك غالبًا؟','ارتباط موجب',['ارتباط سالب','لا توجد علاقة مطلقًا','كل القيم متساوية'],'الاتجاه الصاعد يدل على علاقة موجبة.',null,'reasoning');
 case'central':{const v=[ri(r,2,8),ri(r,2,8),ri(r,2,8),ri(r,2,8),ri(r,2,8)],ans=v.reduce((a,b)=>a+b,0)/5;return item(r,`ما المتوسط الحسابي للقيم: ${v.join('، ')}؟`,fmt(ans),[fmt(ans+1),fmt(ans-1),String(Math.max(...v))],'المتوسط = مجموع القيم ÷ عددها.');}
 case'dispersion':{const v=[ri(r,2,5),ri(r,6,9),ri(r,10,15),ri(r,16,20)],ans=Math.max(...v)-Math.min(...v);return item(r,`ما المدى للقيم: ${v.join('، ')}؟`,ans,numWrongs(ans,1),'المدى = أكبر قيمة − أصغر قيمة.');}
 case'probability':{const red=ri(r,2,7),blue=ri(r,2,7),tot=red+blue;return item(r,`كيس فيه ${red} كرات حمراء و${blue} زرقاء. ما احتمال سحب حمراء؟`,frac(red,tot),[frac(blue,tot),frac(red,blue),frac(1,tot)],'الاحتمال = النواتج الملائمة ÷ جميع النواتج الممكنة.');}
 default:{const x=ri(r,2,12),y=ri(r,2,12);return item(r,`أي نتيجة صحيحة للعملية ${x}+${y}؟`,x+y,numWrongs(x+y,1),'نطبق العملية المطلوبة.');}
 }
}

function scienceType(t){
 const rules=[['cell_theory',/النظرية الخلوية|وحدة بناء|المجاهر|أجهزة التكبير/],['organelles',/التراكيب الخلوية|وظائفها المتخصصة/],['cell_types',/وحيدة الخلية|متعددة الخلايا/],['cell_process',/عمليات الخلية الحيوية|أنشطة.*الخلية/],['cell_cycle',/دورة الخلية|الطور البيني/],['meiosis',/الانقسام المنصف/],['mitosis',/الانقسام المتساوي/],['homeostasis',/تتكامل الأجهزة|اتزان الجسم|الاتزان الداخلي/],['disease',/الأمراض الناتجة|سبل الوقاية/],['body_systems',/الأجهزة الأساسية|الأعضاء المكونة|جسم الإنسان/],['classification',/التصنيف القديمة|الممالك|السلم التصنيفي|يصنف مخلوقات/],['life_traits',/الخصائص الرئيسة للمخلوقات الحية/],['biodiversity',/التنوع الحيوي|انقراض/],['fossils',/الأحافير|السجل الأحفوري|الرسوم والخرائط.*المخلوقات الحية عبر تاريخ/],['foodweb',/تدفق الطاقة|الشبكات الغذائية|انقراض مكون/],['cycles',/دورات المواد|دورة الماء|النيتروجين|ثاني أكسيد الكربون/],['ecointeractions',/التنافس|الافتراس|تبادل المنفعة|التطفل/],['ecosystems',/أنظمة بيئية مائية|يابسة|المجتمع الحيوي/],['ecobalance',/النظام البيئي المتوازن|كفاءة الأنظمة البيئية|العوامل البشرية|استعادة توازن/],['biomass',/الكتلة الحيوية|الوقود الحيوي|الانبعاث الكربوني/],['mendel',/مندل|قانون مندل|مربع بانيت|الجينات المتقابلة|الأليل/],['dna',/DNA|RNA|الكروموسوم|الجين|الطفرة|الكروموسومات/],['atom',/النماذج الذرية|نواة الذرة|البروتونات|النيوترونات|الإلكترونات|النظائر|ألفا|بيتا|عمر النصف/],['solubility',/الذائبية|معدل ذوبان/],['mixtures',/المركبات والمخاليط|المخاليط المتجانسة|المحلول|مذيب|مذاب/],['liquids',/اللزوجة|التوتر السطحي|المواد الصلبة البلورية|غير البلورية/],['electrons_bonds',/إلكترونات التكافؤ|التوزيع الإلكتروني|التمثيل النقطي|الرابطة الكيميائية|الأيون|الجزيء|الصيغة الكيميائية/],['periodic',/الجدول الدوري|مفتاح العنصر|الفلزات|اللافلزات|اللانثانيدات|العناصر المصنعة/],['acids',/الأحماض|القواعد|pH|التعادل|الملح/],['reaction',/التفاعل الكيميائي|المعادلة الكيميائية|حفظ الكتلة|ماص للحرارة|طارد للحرارة|خصائص المواد قبل وبعد التفاعل|دلائل حدوثه|ممتصة، متحررة/],['momentum',/الزخم/],['friction',/الاحتكاك/],['newton1',/نيوتن الأول|القانون الأول لنيوتن|القصور الذاتي/],['newton2',/نيوتن الثاني|تسارع الجسم المتأثر|الوزن|الكتلة|قوة الجاذبية/],['newton3',/نيوتن الثالث|الجذب الكوني|القوى المتبادلة/],['motion',/السرعة|التسارع|الإزاحة|الحركة الدائرية/],['ohm',/قانون أوم|التيار الكهربائي|الجهد|المقاومة|التيار المستمر|المتردد/],['electric_field',/المجال الكهربائي|القوة الكهربائية|الربط على التوالي|التوازي|الدوائر الكهربائية/],['conductors',/التوصيل الكهربائي|الموصلات|العازلة|فائقة التوصيل/],['electromagnet',/المجال المغناطيسي|المغناطيس الكهربائي|المنطقة المغناطيسية|تولد المغناطيس|تحول الطاقة الكهربائية إلى ميكانيكية/],['mechanical_energy',/الطاقة الحركية|الطاقة الكامنة|طاقة الوضع/],['energy_conservation',/حفظ الطاقة|تحولات الطاقة|تحول الطاقة من شكل|توليد الطاقة/],['thermal',/الطاقة الحرارية|درجة الحرارة|انتقال.*الحرارة|توصيل الحرارة|درجة توصيلها للحرارة|امتصاص أو فقد.*الطاقة الحرارية|امتصاص أو فقد الجسم للطاقة الحرارية|مقياس درجة الحرارة|السلسيوس|الفهرنهايتي|الكالفن|الحرارة النوعية/],['sound',/الموجة الصوتية|شدة الصوت|حدته|الصدى/],['light',/الموجة الضوئية|الألوان|الطيف الكهرومغناطيسي|انعكاس|انكسار|امتصاص الضوء/],['space',/استكشاف الفضاء|استكشاف الكون|المجرات|الأجرام السماوية|كواكب المجموعة الشمسية|الحياة خارج/],['climate',/التغيرات المناخية|احتباس|درجات الحرارة/],['carbon',/دورة الكربون|الكربون العضوي|أغلفة الأرض/],['natural_cycles',/الدورات الطبيعية/],['minerals',/الصخور والمعادن|الصفات العامة للصخور والمعادن|يصنف المعادن/],['rocks',/الصخور النارية|المتحولة|الرسوبية|دورة الصخور/],['earthquakes',/الصدع|الزلازل|الموجات الزلزالية|البراكين/],['plates',/الصفائح الأرضية|حدود الصفائح|حركة الصفائح|انجراف القارات/],['human_earth',/النشاط البشري|الأحداث الطبيعية|الأخطار الطبيعية/],['resources',/الموارد الطبيعية|الطاقة غير المتجددة|التلوث والاستنزاف/]];
 for(const[k,re]of rules)if(re.test(t))return k;return'science_general';
}
const F={
cell_theory:[['تنص النظرية الخلوية على أن جميع المخلوقات الحية تتكون من خلية أو أكثر.',['الخلايا توجد في الحيوانات فقط','كل الخلايا متطابقة تمامًا','الخلية لا تنشأ من خلية سابقة']],['المجهر يساعد على رؤية تراكيب صغيرة لا تميزها العين المجردة.',['المجهر يحول الخلية إلى كائن أكبر فعليًا','المجهر يقيس كتلة الخلية مباشرة','المجهر يمنع انقسام الخلايا']]],
organelles:[['الميتوكوندريا مرتبطة بإنتاج معظم طاقة الخلية.',['النواة تهضم الغذاء خارج الخلية','الريبوسوم يخزن الماء فقط','الغشاء الخلوي يصنع الكروموسومات']],['النواة تحتوي المادة الوراثية وتساعد على تنظيم أنشطة الخلية.',['النواة مسؤولة عن الحركة الخارجية فقط','النواة توجد خارج الخلية','النواة تحول الضوء إلى صوت']]],
cell_types:[['المخلوق وحيد الخلية ينجز وظائف الحياة بخلية واحدة.',['المخلوق وحيد الخلية لا يحتاج طاقة','متعدد الخلايا يتكون دائمًا من خليتين فقط','وحيد الخلية لا يتكاثر']],['في المخلوق متعدد الخلايا تتخصص خلايا مختلفة في وظائف مختلفة.',['كل الخلايا تؤدي الوظيفة نفسها دائمًا','لا يوجد تنظيم بين الخلايا','لا تحتوي الخلايا المتخصصة مادة وراثية']]],
cell_process:[['التنفس الخلوي يحرر طاقة قابلة للاستخدام من الغذاء.',['التنفس الخلوي يصنع الصخور','لا يرتبط بالطاقة','يحدث خارج المخلوقات الحية فقط']],['انتقال المواد عبر الغشاء يساعد الخلية على المحافظة على بيئة داخلية مناسبة.',['الغشاء يمنع مرور كل المواد','الخلية لا تتبادل مواد مع محيطها','الانتشار يحتاج دائمًا طاقة']]],
cell_cycle:[['تستعد الخلية للانقسام وتضاعف مادتها الوراثية في الطور البيني.',['تنقسم إلى أربع خلايا في الطور البيني','تفقد مادتها الوراثية كاملة','يتوقف كل نشاط خلوي']],['مرحلة الانقسام الخلوي تنتج خلايا جديدة بعد الاستعداد في الطور البيني.',['تسبق الطور البيني دائمًا','لا تتضمن توزيع المادة الوراثية','تحدث في الخلايا الميتة فقط']]],
mitosis:[['الانقسام المتساوي ينتج غالبًا خليتين متماثلتين وراثيًا وله دور في النمو والتعويض.',['ينتج أربع أمشاج مختلفة','يخفض عدد الكروموسومات إلى النصف','يحدث فقط في الخلايا الجنسية']],['في الطور الانفصالي من الانقسام المتساوي تنفصل الكروماتيدات الشقيقة نحو قطبي الخلية.',['تتضاعف الكروموسومات لأول مرة','تختفي الخلية كاملة','تتحد خليتان معًا']]],
meiosis:[['الانقسام المنصف ينتج خلايا أحادية المجموعة الكروموسومية ويزيد التنوع الوراثي.',['ينتج خليتين جسديتين متطابقتين فقط','يضاعف عدد الكروموسومات في الأمشاج','لا يتضمن انقسامين متتابعين']],['في الانفصالي الأول تنفصل الكروموسومات المتماثلة، وفي الانفصالي الثاني تنفصل الكروماتيدات الشقيقة.',['يحدث العكس تمامًا','لا يحدث انفصال في المرحلتين','تنفصل النواة عن الغشاء فقط']]],
body_systems:[['الجهاز التنفسي يبادل الغازات، والدوري ينقل الأكسجين والمواد إلى الخلايا.',['الهضمي يضخ الدم','الهيكلي ينتج الهواء','العصبي يهضم الدهون']],['الكليتان من أهم أعضاء الجهاز الإخراجي وتسهمان في تنقية الدم وتنظيم الماء والأملاح.',['الرئتان تنتجان البول','المعدة تضخ الدم','العظام تهضم الغذاء']]],
homeostasis:[['يزداد معدل التنفس والدوران أثناء الجهد لتلبية حاجة العضلات إلى الأكسجين والطاقة.',['يتوقف الجهازان عن العمل','ينخفض وصول الأكسجين عمدًا','لا تتغير حاجة العضلات للطاقة']],['يحافظ الجسم على الاتزان الداخلي بتكامل أجهزة متعددة بدل عمل كل جهاز بمعزل.',['الاتزان يعتمد جهازًا واحدًا فقط','الأجهزة لا تتبادل أي تأثير','الاتزان يعني ثبات كل شيء دون تغير']]],
disease:[['الوقاية من كثير من أمراض الأجهزة تشمل نمط حياة صحيًا وممارسات تقلل عوامل الخطر.',['إهمال الأعراض دائمًا','استخدام أدوية بلا حاجة','تجنب الفحوصات تمامًا']],['خلل تبادل الغازات في الرئتين قد يقلل كمية الأكسجين التي تصل إلى الخلايا.',['يزيد الأكسجين دائمًا','لا يؤثر في الجسم','يوقف الهضم فقط']]],
classification:[['التصنيف الحديث يعتمد خصائص متعددة وعلاقات بين المخلوقات ويستخدم مستويات متدرجة.',['يعتمد اللون فقط','يضع كل المخلوقات في مجموعة واحدة','لا يستخدم أي صفات']],['النوع أكثر مستويات التصنيف تحديدًا من المملكة.',['المملكة أكثر تحديدًا من النوع','المستويات كلها متساوية','لا توجد علاقة بين المستويات']]],
life_traits:[['من خصائص المخلوقات الحية النمو والاستجابة والتكاثر والحاجة إلى الطاقة.',['كلها لا تحتاج طاقة','لا تستجيب للمؤثرات','لا تحتوي تنظيمًا داخليًا']],['الاتزان الداخلي يساعد المخلوق الحي على الحفاظ على ظروف داخلية مناسبة.',['يعني توقف كل التغيرات','يحدث في الصخور فقط','يلغي الحاجة للطاقة']]],
biodiversity:[['ارتفاع التنوع الحيوي يمكن أن يزيد مرونة النظام البيئي أمام بعض التغيرات.',['يضمن عدم حدوث أي تغير','يعني وجود نوع واحد فقط','يزيل العلاقات الغذائية']],['انقراض نوع قد يغير شبكة غذائية ويؤثر في أنواع أخرى مرتبطة به.',['لا يؤثر أبدًا في غيره','يزيد عدد أفراد النوع المنقرض','يوقف دورة الماء مباشرة']]],
fossils:[['الطبقات الرسوبية الأعمق تكون أقدم غالبًا إذا لم تتعرض الطبقات للاضطراب.',['الأعمق أحدث دائمًا','كل الطبقات لها العمر نفسه','لا علاقة للموقع النسبي بالعمر']],['توزع الأحافير في طبقات مختلفة يوفر دليلًا على تغير أشكال الحياة عبر الزمن.',['الأحافير لا تعطي أي معلومات زمنية','وجود أحفورة يثبت أن كل الأنواع عاشت معًا','الأحافير تتكون في يوم واحد']]],
foodweb:[['الطاقة تتدفق في اتجاهات غذائية ولا يعاد تدويرها بالطريقة نفسها التي تعاد بها المادة.',['الطاقة تعاد تدويرها كاملة','المادة لا تنتقل بين المكونات','المنتجات لا تدخل الشبكات الغذائية']],['إزالة مفترس قد تزيد أعداد بعض الفرائس فتؤثر لاحقًا في مواردها الغذائية.',['لا يحدث أي تغير','تختفي الشمس','تتوقف دورة النيتروجين فورًا']]],
cycles:[['تدور ذرات المادة مثل الماء والكربون والنيتروجين بين المكونات الحيوية وغير الحيوية.',['تختفي المادة بعد استخدامها','لا تنتقل المادة إلى الغلاف الجوي','الدورات تحدث داخل الحيوانات فقط']],['التحلل يعيد مواد إلى البيئة يمكن أن تستخدمها مخلوقات أخرى.',['يمنع إعادة المواد','يوقف نمو النباتات دائمًا','يلغي دور المحللات']]],
ecosystems:[['المجتمع الحيوي يتكون من جماعات لأنواع مختلفة تعيش وتتفاعل في منطقة واحدة.',['يتكون من فرد واحد فقط','يشمل العوامل غير الحية فقط','لا يتضمن علاقات بين الأنواع']],['تختلف الأنظمة المائية واليابسة في عوامل مثل الماء والضوء والحرارة والملوحة.',['كلها متطابقة بيئيًا','لا تؤثر العوامل غير الحية','الملوحة لا تؤثر في الكائنات']]],
ecointeractions:[['الافتراس علاقة يستفيد فيها المفترس بالحصول على الغذاء وتتضرر الفريسة.',['يستفيد الطرفان دائمًا','لا يتأثر أي طرف','تستفيد الفريسة ويتضرر المفترس']],['في تبادل المنفعة يستفيد كلا النوعين من العلاقة.',['يتضرر الطرفان','يستفيد طرف ويتضرر الآخر دائمًا','لا يوجد تفاعل']]],
ecobalance:[['تنوع الأنواع وتوافر الموارد وجودة الماء والتربة عوامل تدعم استقرار النظام البيئي.',['إزالة كل التنوع تزيد الاستقرار','تلوث الماء لا يؤثر','انجراف التربة يحسن كل الأنظمة']],['تقويم حل بيئي جيد يوازن بين الفوائد والقيود ويقارن أثره ببدائل أخرى.',['يكتفي باسم الحل','يتجاهل الآثار الجانبية','يرفض جمع البيانات']]],
biomass:[['الكتلة الحيوية مادة عضوية يمكن استخدامها مصدرًا لإنتاج طاقة أو وقود حيوي.',['تعني المعادن فقط','لا تأتي من بقايا نباتية','لا يمكن تحويلها إلى طاقة']],['من قيود الوقود الحيوي الحاجة إلى إدارة الموارد والأراضي حتى لا تزاحم استخدامات مهمة أخرى.',['ليس له أي قيود','لا يحتاج مواد خام','لا يرتبط بالاستدامة']]],
mendel:[['ينفصل أليلا الصفة عند تكوين الأمشاج وفق مبدأ الانعزال.',['يبقيان معًا في كل مشيج','يختفيان نهائيًا','يتضاعف عدد الأليلات في المشيج']],['مربع بانيت يساعد على توقع احتمالات الأنماط الجينية والظاهرية للأبناء.',['يحدد نتيجة مؤكدة لكل فرد','يقيس كتلة الكروموسوم','لا يستخدم في الوراثة']]],
dna:[['DNA يحمل معظم المعلومات الوراثية، بينما يسهم RNA في استخدام هذه المعلومات لصنع البروتين.',['RNA لا يرتبط بالبروتين','DNA يوجد خارج الخلايا فقط','الكروموسوم لا يحتوي DNA']],['الطفرة تغير في المادة الوراثية وقد تؤثر في البروتين والصفة بحسب موقعها ونوعها.',['كل طفرة نافعة','كل طفرة مميتة','الطفرة لا تغير DNA']]],
atom:[['العدد الذري يساوي عدد البروتونات في نواة الذرة.',['يساوي عدد النيوترونات دائمًا','يساوي العدد الكتلي','لا يرتبط بالبروتونات']],['نظائر العنصر لها العدد الذري نفسه وتختلف في عدد النيوترونات والعدد الكتلي.',['تختلف في عدد البروتونات','هي عناصر مختلفة دائمًا','لها أعداد ذرية مختلفة']]],
mixtures:[['المخلوط يمكن فصل مكوناته بطرائق فيزيائية مناسبة، أما المركب فتتحد عناصره كيميائيًا.',['المركب يفصل دائمًا بالترشيح','المخلوط مادة نقية واحدة','لا فرق بينهما']],['في المحلول يكون المذيب عادة المكون الذي يذيب المذاب.',['المذاب يذيب المذيب دائمًا','لا توجد جسيمات مذابة','المحلول غير متجانس دائمًا']]],
solubility:[['رفع درجة الحرارة يزيد ذائبية كثير من المواد الصلبة في السوائل لكنه لا ينطبق بالطريقة نفسها على جميع المواد.',['يزيد الذائبية دائمًا لكل المواد دون استثناء','يمنع الذوبان تمامًا','لا يؤثر مطلقًا']],['التحريك وزيادة مساحة سطح المذاب يمكن أن يزيدا معدل الذوبان دون تغيير الذائبية النهائية بالضرورة.',['يغيران نوع المادة','يمنعان التصادم بين الجسيمات','يجعلان المذاب مذيبًا']]],
liquids:[['التوتر السطحي ينتج من قوى تجاذب بين جزيئات السائل عند سطحه.',['ينتج من انعدام التجاذب','خاصية للغازات فقط','يعني أن السائل صلب']],['المادة الصلبة البلورية لها ترتيب منتظم ممتد للجسيمات أكثر من الصلب غير البلوري.',['غير البلوري أكثر انتظامًا دائمًا','لا توجد جسيمات في الصلب','كلاهما غاز']]],
periodic:[['عناصر المجموعة الواحدة تتشابه في كثير من خصائصها الكيميائية بسبب تشابه إلكترونات التكافؤ.',['لها العدد الذري نفسه','تقع في الدورة نفسها دائمًا','كتلتها متساوية']],['الفلزات جيدة التوصيل غالبًا، واللافلزات أقل توصيلًا في كثير من الحالات.',['كل اللافلزات موصلة أفضل','الفلزات عازلة دائمًا','لا توجد فروق في الخواص']]],
acids:[['القيمة pH الأقل من 7 تدل غالبًا على محلول حمضي، والأكبر من 7 على محلول قاعدي.',['الأقل من 7 قاعدي','7 حمضي قوي','لا علاقة pH بالحموضة']],['التعادل بين حمض وقاعدة يمكن أن ينتج ملحًا وماءً.',['ينتج حمضًا فقط','لا يحدث تفاعل','ينتج إلكترونات فقط']]],
electrons_bonds:[['إلكترونات التكافؤ تشارك أساسًا في تكوين الروابط الكيميائية.',['إلكترونات النواة تكون الروابط','النيوترونات تنتقل بين الذرات في كل رابطة','لا علاقة للإلكترونات بالروابط']],['الرابطة الأيونية ترتبط بانتقال إلكترونات وتكون أيونات متجاذبة، والتساهمية بمشاركة إلكترونات.',['الأيونية مشاركة فقط دائمًا','التساهمية انتقال بروتونات','لا فرق بين النوعين']]],
reaction:[['قانون حفظ الكتلة يعني أن مجموع كتل المواد المتفاعلة يساوي مجموع كتل النواتج في نظام مغلق.',['الكتلة تختفي أثناء التفاعل','كتلة النواتج دائمًا أقل','الذرات تتحول إلى طاقة بالكامل']],['التفاعل الطارد للحرارة يطلق طاقة حرارية إلى الوسط، والماص يمتصها منه.',['كلاهما يطلق حرارة دائمًا','الماص لا يتبادل طاقة','الطارد يمتص الحرارة من الوسط']]],
motion:[['السرعة المتوسطة تساوي المسافة الكلية مقسومة على الزمن الكلي.',['الزمن ÷ المسافة','المسافة × الزمن','لا ترتبط بالزمن']],['التسارع هو معدل تغير السرعة المتجهة مع الزمن.',['هو المسافة فقط','يساوي الكتلة','لا يحدث عند تغير الاتجاه']]],
momentum:[['الزخم يساوي الكتلة مضروبة في السرعة المتجهة.',['الكتلة ÷ السرعة','السرعة ÷ الزمن','القوة × الزمن دائمًا كتعريف وحيد']],['في نظام معزول يبقى الزخم الكلي محفوظًا أثناء التصادم.',['يختفي الزخم','يزداد دائمًا','الحفظ لا ينطبق على التصادمات']]],
friction:[['الاحتكاك يعاكس الحركة أو محاولة الحركة بين سطحين متلامسين.',['يزيد الحركة في اتجاهها دائمًا','لا يعتمد على التلامس','هو قوة جاذبية فقط']],['الاحتكاك السكوني يعمل قبل بدء الانزلاق، والانزلاقي أثناء انزلاق السطحين.',['العكس دائمًا','لا يوجد احتكاك قبل الحركة','التدحرجي هو نفسه السكوني']]],
newton1:[['يميل الجسم للمحافظة على حالته الحركية ما لم تؤثر فيه قوة محصلة؛ وهذا يعبر عن القصور الذاتي.',['يتوقف كل جسم دون قوة فورًا','القوة لازمة للحركة المنتظمة دائمًا','القصور يقل بزيادة الكتلة']],['تزداد مقاومة الجسم لتغير حالته الحركية بزيادة كتلته.',['تقل مع الكتلة','لا علاقة للكتلة','تنعدم للأجسام الكبيرة']]],
newton2:[['التسارع يتناسب طرديًا مع محصلة القوة وعكسيًا مع الكتلة: F=ma.',['a=m/F','القوة لا تؤثر في التسارع','التسارع يزداد بزيادة الكتلة عند ثبات القوة']],['الوزن قوة جاذبية ويساوي تقريبًا الكتلة × تسارع الجاذبية.',['الوزن هو الكتلة نفسها','الكتلة تتغير مع المكان مثل الوزن','لا توجد وحدة للوزن']]],
newton3:[['لكل قوة يؤثر بها جسم في آخر قوة مساوية لها مقدارًا ومعاكسة اتجاهًا تؤثر في الجسم الأول.',['القوتان على الجسم نفسه','إحداهما أكبر دائمًا','لا تحدثان في الوقت نفسه']],['قوة التجاذب بين جسمين تزداد بزيادة كتلتيهما وتقل بزيادة المسافة بينهما.',['تزداد بالمسافة','لا تعتمد على الكتلة','تنعدم بين الكتل']]],
ohm:[['قانون أوم يربط الجهد والتيار والمقاومة بالعلاقة V=IR.',['V=I/R دائمًا','I=VR','لا علاقة بينها']],['التيار المستمر يسري باتجاه واحد تقريبًا، والمتردد يغير اتجاهه دوريًا.',['المتردد ثابت الاتجاه','المستمر يغير اتجاهه كل لحظة','كلاهما بلا شحنات']]],
electric_field:[['الشحنات المختلفة تتجاذب والمتشابهة تتنافر، ويصف المجال تأثير الشحنة في محيطها.',['المتشابهة تتجاذب دائمًا','لا توجد قوة بين الشحنات','المجال يوجد داخل الأسلاك فقط']],['في دائرة التوازي توجد فروع متعددة للتيار، أما التوالي فمسار واحد.',['التوالي فروع متعددة','لا فرق بينهما','التوازي لا يسمح بمرور تيار']]],
conductors:[['الموصل يسمح بحركة الشحنات بسهولة أكبر من العازل.',['العازل أفضل توصيلًا دائمًا','لا توجد شحنات في الموصل','كل المواد متساوية التوصيل']],['الموصلات فائقة التوصيل قد تصل إلى مقاومة كهربائية شديدة الانخفاض في ظروف مناسبة.',['مقاومتها لا نهائية','تعمل بالطريقة نفسها في كل درجة حرارة','هي عوازل دائمًا']]],
electromagnet:[['مرور تيار في سلك يولد مجالًا مغناطيسيًا حوله.',['التيار يلغي كل مجال','المجال يظهر دون تيار دائمًا','لا علاقة بين الكهرباء والمغناطيسية']],['المحرك الكهربائي يحول طاقة كهربائية إلى ميكانيكية، والمولد يفعل العكس.',['كلاهما يحول ميكانيكية إلى حرارية فقط','المولد لا يستخدم مجالًا مغناطيسيًا','المحرك يولد وقودًا']]],
thermal:[['تنتقل الحرارة تلقائيًا من الجسم الأعلى درجة حرارة إلى الأقل حتى يقتربا من الاتزان.',['من البارد إلى الساخن تلقائيًا','لا تنتقل بين الأجسام','تنتقل الكتلة بدل الطاقة']],['التوصيل يحتاج تلامسًا مباشرًا غالبًا، والحمل يحدث بحركة الموائع، والإشعاع لا يحتاج وسطًا ماديًا.',['الإشعاع يحتاج سائلًا','الحمل يحدث في الفراغ فقط','التوصيل لا يحتاج تماسًا']]],
mechanical_energy:[['الطاقة الحركية تعتمد على الكتلة ومربع السرعة: KE=1/2 mv².',['تعتمد على الارتفاع فقط','تتناسب عكسيًا مع السرعة','لا تعتمد على الكتلة']],['طاقة الوضع الثقالية قرب سطح الأرض تعتمد على الكتلة والجاذبية والارتفاع.',['لا تعتمد على الارتفاع','هي نفسها درجة الحرارة','تقل بزيادة الارتفاع دائمًا']]],
energy_conservation:[['الطاقة لا تفنى ولا تستحدث من عدم، لكنها تتحول من شكل إلى آخر.',['تختفي الطاقة بعد الاستخدام','تتولد من لا شيء','لا تتحول بين الأشكال']],['الخلايا الشمسية تحول جزءًا من طاقة الإشعاع الشمسي إلى طاقة كهربائية.',['تحول الكهرباء إلى ضوء فقط','لا تتعامل مع الطاقة','تنتج وقودًا أحفوريًا']]],
sound:[['الصوت موجة ميكانيكية تحتاج وسطًا ماديًا للانتقال ولا تنتقل في الفراغ.',['الصوت موجة كهرومغناطيسية','ينتقل في الفراغ أسرع','لا يرتبط بالاهتزاز']],['زيادة التردد ترتبط بزيادة حدة الصوت، وزيادة السعة ترتبط غالبًا بزيادة علوه.',['السعة تحدد الحدة فقط','التردد لا يؤثر في الحدة','لا علاقة بين الموجة والصوت']]],
light:[['الضوء موجة كهرومغناطيسية يمكنها الانتقال في الفراغ.',['يحتاج وسطًا ماديًا دائمًا','هو موجة صوتية','لا يحمل طاقة']],['الانكسار تغير اتجاه الضوء عند انتقاله بين وسطين تختلف فيهما سرعته.',['الانعكاس دخول الضوء في الوسط','الامتصاص ارتداد الضوء','لا يتغير الضوء بين الأوساط']]],
space:[['التلسكوبات والأقمار والمسابير أدوات تجمع بيانات تساعد على دراسة الكون والأجرام.',['لا تجمع أي بيانات','تستخدم داخل الخلية فقط','المسبار لا يغادر المختبر']],['اختلاف ظروف الكواكب في الحرارة والغلاف الجوي والجاذبية يؤثر في إمكان وجود حياة كما نعرفها.',['كل الكواكب متطابقة','الحياة لا تحتاج شروطًا','الموقع لا يؤثر في الظروف']]],
climate:[['زيادة غازات الدفيئة يمكن أن تزيد احتجاز الحرارة في الغلاف الجوي وتؤثر في المناخ.',['تمنع وصول كل ضوء الشمس','تخفض الحرارة دائمًا','لا تتفاعل مع الإشعاع']],['تحليل اتجاهات درجات الحرارة يحتاج بيانات ممتدة زمنيًا لا قراءة يوم واحد.',['يكفي يوم واحد للحكم على المناخ','المناخ يساوي الطقس اللحظي','لا تستخدم البيانات في المناخ']]],
carbon:[['ينتقل الكربون بين الغلاف الجوي والماء والتربة والمخلوقات عبر عمليات مثل البناء الضوئي والتنفس والتحلل.',['يبقى في مكان واحد دائمًا','لا يدخل المخلوقات الحية','لا يعود للغلاف الجوي']],['الوقود الأحفوري يخزن كربونًا قديمًا، واحتراقه يطلق ثاني أكسيد الكربون.',['لا يحتوي كربونًا','الاحتراق يزيل CO2 من الجو','الكربون لا يدخل الصخور']]],
natural_cycles:[['الدورات الطبيعية تعيد توزيع مواد وطاقة وتؤثر في البيئة عبر الزمن.',['تحدث مرة واحدة فقط','لا ترتبط بالبيئة','لا يمكن دراستها بالبيانات']],['دراسة دورة طبيعية تتطلب تتبع مدخلاتها ومساراتها ومخازنها وتغيرها مع الزمن.',['يكفي اسم الدورة','لا حاجة للقياس','كل الدورات متطابقة']]],
minerals:[['المعدن مادة صلبة طبيعية غير عضوية لها تركيب كيميائي وبناء بلوري مميز.',['كل صخر معدن واحد','المعدن مادة صناعية دائمًا','لا توجد بنية بلورية']],['يمكن استخدام خصائص مثل الصلادة والمخدش والبريق للمساعدة في تعرف المعادن.',['اللون وحده يكفي دائمًا','لا توجد خصائص فيزيائية','الكتلة تحدد اسم المعدن وحدها']]],
rocks:[['الصخر الناري يتكون من تبرد الصهارة أو اللابة.',['يتكون من تبخر الماء فقط','ينشأ دائمًا من أحافير','لا يتغير إلى نوع آخر']],['الصخر الرسوبي ينشأ غالبًا من تراكم الرواسب وتماسكها، والمتحول من تغير صخر سابق بفعل الحرارة والضغط دون انصهار كامل.',['المتحول يتطلب انصهارًا كاملًا','الرسوبي يتكون من الصهارة مباشرة','كل الصخور لها أصل واحد مباشر']]],
earthquakes:[['الصدع كسر في الصخور تتحرك على جانبيه الكتل الصخرية.',['هو طبقة ماء','نوع من السحب','لا يرتبط بالإجهاد']],['بؤرة الزلزال داخل الأرض، والمركز السطحي يقع على السطح فوقها تقريبًا.',['المركز السطحي أعمق من البؤرة','كلاهما في الغلاف الجوي','لا علاقة بينهما']]],
plates:[['تتباعد الصفائح عند الحدود المتباعدة وتتقارب عند المتقاربة وتنزلق جانبياً عند التحويلية.',['كل الحدود متقاربة','لا تتحرك الصفائح','الحدود التحويلية تبعد الصفائح فقط']],['تتركز كثير من الزلازل والبراكين قرب حدود الصفائح بسبب حركة الصفائح وتفاعلها.',['تنتشر عشوائيًا دون علاقة','لا تحدث عند الحدود','الصفائح لا تؤثر في باطن الأرض']]],
human_earth:[['يمكن للنشاط البشري تغيير استخدام الأرض وجودة الهواء والماء ودورات المواد.',['لا يؤثر البشر في الأنظمة','كل أثر بشري إيجابي','لا يمكن قياس أي تغير']],['تقليل مخاطر الكوارث يعتمد على الرصد والتنبؤ والتخطيط والاستجابة المناسبة.',['لا يمكن تقليل أي خطر','التنبؤ يوقف الحدث الطبيعي نفسه','لا أهمية لخطط الإخلاء']]],
resources:[['المورد المتجدد يمكن أن يتجدد طبيعيًا بمعدلات مفيدة إذا أُدير بصورة مستدامة.',['كل مورد متجدد لا ينفد مهما كان الاستخدام','الموارد غير المتجددة تتجدد سريعًا','لا حاجة لإدارة الموارد']],['الاعتماد الكبير على الوقود الأحفوري يرتبط بانبعاثات ومخاطر استنزاف مورد غير متجدد.',['لا ينتج أي انبعاث','المورد يتجدد يوميًا','لا توجد بدائل للطاقة']]],
science_general:[['الاستنتاج العلمي الجيد يستند إلى بيانات وأدلة قابلة للفحص.',['يعتمد الرأي دون بيانات','يغير البيانات لتوافق التوقع','يرفض المقارنة بين الأدلة']],['عند تقويم تفسير علمي ينبغي مقارنة التفسير بالأدلة المتاحة وببدائل معقولة.',['يكفي طول التفسير','لا حاجة للأدلة','نقبل أول تفسير دائمًا']]]
};
function scienceQuestion(t,r,n){
 const type=scienceType(t),facts=F[type]||F.science_general;
 // Each branch below is tied to the action and concept named in the exact
 // indicator. The broad fact library is only the final fallback inside a
 // classified concept; it is never used for an unclassified indicator.
 if(type==='reaction'&&/خصائص المواد قبل وبعد|دلائل حدوثه/.test(t)){
  const a=ri(r,8,20),b=ri(r,5,15),form=n%3;
  if(form===0)return item(r,`خلط طالبان مادتين، فتصاعد غاز وتكوّن راسب. ما الاستنتاج الأدق؟`,'حدث تفاعل كيميائي لأن مواد جديدة تكونت',['حدث تغير في الحالة فقط','لم يحدث تغير لأن الكتلة ثابتة','حدث ذوبان فقط'],'تصاعد الغاز وتكوّن الراسب دليلان على تكون مواد جديدة.');
  if(form===1)return item(r,`في وعاء مغلق كانت كتلة المادتين قبل التفاعل ${a+b} جم. ما الكتلة المتوقعة بعد التفاعل؟`,`${a+b} جم`,[`${a} جم`,`${b} جم`,`${Math.abs(a-b)} جم`],'في النظام المغلق تُحفظ الكتلة أثناء التفاعل.');
  return item(r,'أي بيانات تصلح دليلًا أقوى على حدوث تفاعل كيميائي؟','ظهور مادة صلبة جديدة مع تغير دائم في الخواص',['تغير شكل الوعاء','انصهار الثلج ثم تجمده','تقطيع المادة إلى أجزاء'],'تكون مادة جديدة ذات خواص مختلفة يميز التفاعل الكيميائي.');
 }
 if(type==='reaction'&&/المعادلة الكيميائية|حفظ الكتلة/.test(t)){const a=ri(r,5,18),b=ri(r,4,15),sum=a+b;return item(r,`تفاعل ${a} جم من مادة مع ${b} جم من أخرى في نظام مغلق. ما كتلة النواتج؟`,`${sum} جم`,[`${a} جم`,`${b} جم`,`${sum+5} جم`],'قانون حفظ الكتلة يساوي بين مجموع كتل المتفاعلات والنواتج.');}
 if(type==='reaction'&&/الأشكال المختلفة للطاقة/.test(t))return item(r,'أي مثال يوضح طاقة مصاحبة لتفاعل كيميائي؟','انطلاق ضوء وحرارة عند الاحتراق',['تغير موضع جسم دون تفاعل','انكسار زجاج','ذوبان ثلج فقط'],'قد يصاحب التفاعل إطلاق أو امتصاص حرارة أو ضوء أو كهرباء.');
 if(type==='reaction'&&/ماص للحرارة|طارد للحرارة/.test(t))return item(r,'انخفضت درجة حرارة الوسط المحيط أثناء تفاعل. ما التصنيف الأرجح؟','تفاعل ماص للحرارة',['تفاعل طارد للحرارة','تغير نووي بالضرورة','تفاعل لا يتبادل طاقة'],'انخفاض حرارة الوسط يدل على انتقال طاقة منه إلى التفاعل.');

 if(type==='solubility'&&/مفهوم الذائبية|بيانيًا/.test(t)){const temp=pick(r,[20,30,40]),g=ri(r,20,60);return item(r,`يذوب بحد أقصى ${g} جم من مادة في 100 جم ماء عند ${temp}°س. ماذا تمثل قيمة ${g}؟`,'ذائبية المادة عند درجة الحرارة المحددة',['معدل التحريك','كتلة المذيب','زمن الذوبان'],'الذائبية هي أكبر كمية تذوب في مقدار محدد من المذيب عند درجة حرارة معينة.');}
 if(type==='solubility'&&/درجة الحرارة وتركيب المركب/.test(t))return item(r,'أظهرت البيانات زيادة ذائبية مادة صلبة مع ارتفاع درجة الحرارة. أي تفسير يوافق البيانات؟','تأثير الحرارة في الذائبية يعتمد نوع المذاب والمذيب',['كل المواد تتأثر بالطريقة نفسها','الحرارة تلغي دور تركيب المادة','الذائبية لا تتغير مطلقًا'],'لا يعمم أثر الحرارة دون مراعاة طبيعة المواد.');
 if(type==='solubility'&&/العوامل المؤثرة في معدل/.test(t))return item(r,'أي إجراء يزيد معدل ذوبان مكعب سكر في الماء دون أن يغير كمية السكر القصوى التي يمكن أن تذوب؟','طحن المكعب وتحريك الماء',['إضافة مزيد من السكر','تبخير الماء','استخدام مذيب لا يذيب السكر'],'زيادة مساحة السطح والتحريك تسرعان الذوبان ولا تغيران الذائبية النهائية بالضرورة.');
 if(type==='mixtures'&&/طرق.*فصل|فصل المخاليط/.test(t))return item(r,'ما الطريقة الأنسب لفصل الرمل عن الماء؟','الترشيح',['التقطير التجزيئي','المغنطة','التبخير الكامل للهواء'],'يحجز المرشح الرمل ويسمح بمرور الماء.');
 if(type==='mixtures'&&/المركبات والمخاليط/.test(t))return item(r,'أي فرق صحيح بين المركب والمخلوط؟','للمركب تركيب ثابت وتفصل مكوناته كيميائيًا، أما المخلوط فيفصل فيزيائيًا',['كلاهما يفصل بالترشيح دائمًا','المخلوط مادة نقية','المركب يحتفظ دائمًا بخصائص عناصره منفردة'],'يرتبط الفرق بنوع اتحاد المكونات وطريقة فصلها.');
 if(type==='mixtures'&&/مكونات المحلول|المحاليل المائية/.test(t))return item(r,'في محلول ملح الطعام في الماء، ما المذيب؟','الماء',['الملح','المحلول كله','بلورات الملح غير الذائبة'],'المذيب هو المكون الذي يذيب المذاب، والمحلول المائي مذِيبه الماء.');

 if(type==='mendel'&&/تطور علم الوراثة|دور مندل/.test(t))return item(r,'ما الذي جعل تجارب مندل أساسًا لعلم الوراثة؟','استخدم صفات واضحة وتتبع نتائج أجيال متعددة عدديًا',['درس خلية واحدة بلا تزاوج','غيّر النتائج لتوافق توقعه','اعتمد الملاحظة دون عدّ'],'التجربة المنظمة والعد الكمي كشفا أنماط انتقال الصفات.');
 if(type==='mendel'&&/قانون مندل الأول والثاني/.test(t))return item(r,'عند تكوين الأمشاج، ماذا يحدث لأليلي الصفة وفق قانون الانعزال؟','ينفصلان فيحمل كل مشيج أليلًا واحدًا',['يبقيان معًا في كل مشيج','يختفيان','يتضاعفان بلا انفصال'],'يفسر الانعزال انتقال أليل واحد من كل والد عبر المشيج.');
 if(type==='mendel'&&/الجينات المتماثلة|غير المتماثلة/.test(t))return item(r,'أي تركيب جيني يمثل فردًا غير متماثل الجينات؟','Aa',['AA','aa','A فقط'],'غير المتماثل يحمل أليلين مختلفين للصفة.');
 if(type==='mendel'&&/مربع بانيت/.test(t)){const cross=n%2===0?'Aa × Aa':'Aa × aa';return item(r,`في التزاوج ${cross}، ما الأداة الأنسب لتنظيم احتمالات الأنماط الجينية؟`,'مربع بانيت',['المجهر الضوئي','ميزان الكتلة','الجدول الدوري'],'ينظم مربع بانيت الأمشاج الممكنة واحتمالات اتحادها.');}
 if(type==='dna'&&/الانحراف والخلل في الانقسام المنصف/.test(t))return item(r,'ما نتيجة محتملة لعدم انفصال الكروموسومات في الانقسام المنصف؟','أمشاج بعدد كروموسومات غير طبيعي',['خلايا متطابقة دائمًا','اختفاء DNA كله','تضاعف أعضاء الجسم مباشرة'],'عدم الانفصال يغيّر عدد الكروموسومات في بعض الأمشاج.');
 if(type==='dna'&&/DNA وRNA/.test(t))return item(r,'أي مقارنة صحيحة بين DNA وRNA؟','DNA يخزن المعلومات الوراثية غالبًا وRNA يسهم في استخدامها لصنع البروتين',['RNA مزدوج دائمًا وDNA مفرد','كلاهما بلا قواعد نيتروجينية','DNA يوجد خارج الخلايا فقط'],'تختلف البنية والوظيفة مع اشتراكهما في المعلومات الوراثية.');
 if(type==='dna'&&/عدد الكروموسومات|الثنائية المجموعة/.test(t))return item(r,'كم كروموسومًا في خلية جسدية بشرية طبيعية؟','46',['23','44','92'],'الخلايا الجسدية ثنائية المجموعة، بينما الأمشاج أحادية وبها 23.');
 if(type==='dna'&&/الطفرة الجينية|صنع البروتين/.test(t))return item(r,'كيف قد تؤثر طفرة في جين في صفة موروثة؟','قد تغير تسلسل البروتين أو كميته فتتغير الصفة',['تغير عدد الكواكب','تلغي كل الجينات','لا يمكن أن تؤثر في بروتين'],'يحمل الجين تعليمات بناء بروتين، وقد تغير الطفرة هذه التعليمات.');

 if(type==='atom'&&/النماذج الذرية وتطورها/.test(t))return item(r,'لماذا تغير النموذج الذري عبر التاريخ؟','ظهرت أدلة وتجارب جديدة لم يفسرها النموذج السابق كاملًا',['تغيرت الذرات نفسها كل قرن','اعتمد العلماء الرأي فقط','لم تكن هناك تجارب'],'النموذج العلمي يتطور عندما تفسر الأدلة الجديدة بصورة أدق.');
 if(type==='atom'&&/عدد البروتونات|النيوترونات|الإلكترونات|العدد الذري/.test(t)){const z=ri(r,5,20),mass=z+ri(r,z-2,z+4);return item(r,`ذرة متعادلة عددها الذري ${z} وعددها الكتلي ${mass}. كم عدد النيوترونات؟`,mass-z,[z,mass,mass+z],'النيوترونات = العدد الكتلي − العدد الذري.');}
 if(type==='atom'&&/النظائر|التحلل الإشعاعي/.test(t))return item(r,'أي وصف صحيح لنظيري عنصر واحد؟','لهما عدد البروتونات نفسه ويختلفان في عدد النيوترونات',['يختلفان في عدد البروتونات','لهما عدد كتلي واحد دائمًا','هما عنصران بلا نواة'],'ثبات العدد الذري يحفظ هوية العنصر، واختلاف النيوترونات يصنع النظائر.');
 if(type==='atom'&&/عمر النصف/.test(t)){const start=pick(r,[80,160,320]),periods=pick(r,[2,3]),ans=start/2**periods;return item(r,`عينة كتلتها ${start} جم مرت بها ${periods} فترات من عمر النصف. كم يتبقى؟`,`${ans} جم`,[`${start/2} جم`,`${start-periods} جم`,`${start/periods} جم`],'تنخفض الكمية إلى نصفها في كل فترة عمر نصف.');}
 if(type==='atom'&&/جسيمات ألفا|جسيمات بيتا/.test(t))return item(r,'أي تغير يحدث غالبًا عند انبعاث جسيم ألفا؟','ينخفض العدد الكتلي 4 والعدد الذري 2',['يزداد العدد الذري 2','لا تتغير النواة','ينخفض العدد الكتلي 1 فقط'],'جسيم ألفا نواة هيليوم تحوي بروتونين ونيوترونين.');

 if(type==='motion'&&/أنواع السرعة/.test(t)){const d=ri(r,30,150),time=ri(r,3,10),ans=d/time;return item(r,`قطع جسم ${d} مترًا في ${time} ثوانٍ. ما سرعته المتوسطة؟`,`${fmt(ans)} م/ث`,[`${fmt(d*time)} م/ث`,`${fmt(time/d)} م/ث`,`${fmt(ans+2)} م/ث`],'السرعة المتوسطة = المسافة الكلية ÷ الزمن الكلي.');}
 if(type==='motion'&&/مفهوم التسارع|التسارع الموجب والسالب/.test(t)){const v1=ri(r,2,10),a=ri(r,2,6),time=ri(r,2,5),v2=v1+a*time;return item(r,`زادت سرعة جسم من ${v1} إلى ${v2} م/ث خلال ${time} ثوانٍ. ما تسارعه؟`,`${a} م/ث²`,[`${v2/time} م/ث²`,`${v1*time} م/ث²`,`${v2-v1} م/ث²`],'التسارع=(السرعة النهائية−الابتدائية)÷الزمن.');}
 if(type==='motion'&&/العلاقة بين التسارع والسرعة والإزاحة/.test(t))return item(r,'إذا كان التسارع في اتجاه السرعة، فماذا يحدث لمقدار السرعة غالبًا؟','يزداد',['ينقص دائمًا','يبقى صفرًا','ينعكس الموضع فورًا'],'اتفاق اتجاه التسارع والسرعة يؤدي عادة إلى زيادة مقدار السرعة.');
 if(type==='motion'&&/الحركة الدائرية/.test(t))return item(r,'ما اتجاه القوة المركزية لجسم يتحرك في مسار دائري؟','نحو مركز المسار',['مماسًا للمسار دائمًا','بعيدًا عن المركز','لا اتجاه لها'],'القوة المركزية تغير اتجاه السرعة نحو مركز الدائرة.');
 if(type==='momentum'&&/يحسب قيمة الزخم/.test(t)){const m=ri(r,2,12),v=ri(r,2,10),ans=m*v;return item(r,`جسم كتلته ${m} كجم يتحرك بسرعة ${v} م/ث. ما زخمه؟`,`${ans} كجم·م/ث`,[`${m+v} كجم·م/ث`,`${fmt(v/m)} كجم·م/ث`,`${m*v*2} كجم·م/ث`],'الزخم = الكتلة × السرعة المتجهة.');}
 if(type==='momentum'&&/يتنبأ بحركة الأجسام/.test(t))return item(r,'تصادمت عربتان في نظام معزول. ما الكمية التي تبقى ثابتة للمجموع؟','الزخم الكلي',['سرعة كل عربة','الطاقة الحركية دائمًا','اتجاه كل عربة'],'يحفظ الزخم الكلي في النظام المعزول وإن تغيرت سرعات الأجسام.');
 if(type==='momentum'&&/العوامل المؤثرة/.test(t))return item(r,'عند ثبات السرعة، ماذا يحدث للزخم إذا تضاعفت الكتلة؟','يتضاعف',['ينخفض للنصف','يبقى ثابتًا','يصبح صفرًا'],'الزخم يتناسب طرديًا مع الكتلة.');
 if(type==='friction'&&/أنواع الاحتكاك/.test(t))return item(r,'كرة تتدحرج على أرضية؛ ما نوع الاحتكاك الرئيس؟','احتكاك تدحرجي',['احتكاك سكوني فقط','احتكاك انزلاقي فقط','لا يوجد احتكاك'],'حركة الجسم بالدوران على السطح ترتبط باحتكاك التدحرج.');
 if(type==='newton1')return item(r,'تحركت حافلة فجأة إلى الأمام فمال الراكب إلى الخلف. ما التفسير؟','قصور جسمه حافظ على حالته قبل تغير حركة الحافلة',['انعدمت كتلته','زادت الجاذبية لحظيًا','توقف الزمن'],'يميل الجسم للمحافظة على حالته الحركية وفق قانون نيوتن الأول.');
 if(type==='newton2'&&/يحسب قيمة تسارع/.test(t)){const m=ri(r,2,10),f=m*ri(r,2,8),ans=f/m;return item(r,`تؤثر قوة محصلة ${f} نيوتن في جسم كتلته ${m} كجم. ما تسارعه؟`,`${ans} م/ث²`,[`${f*m} م/ث²`,`${m/f} م/ث²`,`${f+m} م/ث²`],'من F=ma يكون a=F/m.');}
 if(type==='newton2'&&/الوزن|الكتلة/.test(t)){const m=ri(r,2,12),ans=m*10;return item(r,`كتلة جسم ${m} كجم. ما وزنه التقريبي على الأرض إذا g≈10 م/ث²؟`,`${ans} نيوتن`,[`${m} نيوتن`,`${m+10} نيوتن`,`${m/10} نيوتن`],'الوزن قوة ويساوي الكتلة × تسارع الجاذبية.');}
 if(type==='newton2'&&/قوة الجاذبية/.test(t))return item(r,'أي أثر مباشر لقوة الجاذبية قرب سطح الأرض؟','إكساب الأجسام وزنًا وتسارعها نحو الأرض',['إلغاء كتلة الجسم','دفع كل جسم إلى أعلى','منع المدارات'],'الجاذبية تجذب الكتل وتحدد الوزن قرب سطح الأرض.');
 if(type==='newton2'){const m=ri(r,2,10),a=ri(r,2,8),f=m*a;return item(r,`كتلة جسم ${m} كجم وتسارعه ${a} م/ث². ما محصلة القوة؟`,`${f} نيوتن`,[`${m+a} نيوتن`,`${fmt(a/m)} نيوتن`,`${f*2} نيوتن`],'F=ma.');}
 if(type==='newton3'&&/الجذب الكوني/.test(t))return item(r,'أي تغير يزيد قوة التجاذب بين جسمين؟','زيادة الكتلتين وتقليل المسافة بينهما',['تقليل الكتلتين وزيادة المسافة','زيادة المسافة فقط','إلغاء إحدى الكتلتين'],'تزداد القوة بالكتلتين وتقل بزيادة مربع المسافة.');
 if(type==='newton3')return item(r,'دفع سبّاح الماء إلى الخلف. ما قوة الفعل ورد الفعل؟','يدفع الماء السباح إلى الأمام بقوة مساوية ومعاكسة',['يدفعه الماء إلى الخلف بالقوة نفسها','تؤثر القوتان في الماء فقط','لا توجد قوة مقابلة'],'قوتا الفعل ورد الفعل متساويتان ومتعاكستان وتؤثران في جسمين مختلفين.');

 if(type==='ohm'&&/قانون أوم|علاقة التيار/.test(t)){const R=ri(r,2,12),I=ri(r,1,6),V=R*I;return item(r,`يمر تيار ${I} أمبير في مقاومة ${R} أوم. ما فرق الجهد؟`,`${V} فولت`,[`${R+I} فولت`,`${fmt(R/I)} فولت`,`${V*2} فولت`],'قانون أوم V=IR.');}
 if(type==='ohm'&&/المستمر والمتردد/.test(t))return item(r,'أي وصف صحيح للتيار المتردد؟','يغير اتجاهه دوريًا',['يسري في اتجاه واحد دائمًا','لا تنقله الأسلاك','لا يولد مجالًا مغناطيسيًا'],'التيار المتردد يبدل اتجاهه دوريًا بخلاف المستمر.');
 if(type==='ohm')return item(r,'ما المقصود بالتيار الكهربائي؟','معدل تدفق الشحنات عبر موصل',['كتلة الإلكترونات الساكنة','فرق الجهد وحده','مقاومة السلك فقط'],'التيار يقيس مرور الشحنة في وحدة الزمن.');
 if(type==='electric_field'&&/الربط على التوالي|الربط على التوازي/.test(t))return item(r,'أي خاصية تميز دائرة التوازي؟','لكل فرع مسار مستقل ويحصل على فرق الجهد نفسه',['للتيار مسار واحد فقط','تعطل فرع يوقف جميع الفروع حتمًا','المقاومة الكلية تساوي مجموع المقاومات دائمًا'],'تعدد الفروع هو السمة البنائية الأساسية للتوازي.');
 if(type==='electric_field'&&/تركيب ودور الدوائر/.test(t))return item(r,'ما دور المصدر الكهربائي في الدائرة؟','تزويد الشحنات بفرق جهد يدفع التيار',['استهلاك كل الشحنات','زيادة المقاومة فقط','قطع المسار'],'فرق الجهد من المصدر يسمح بنقل الطاقة في المسار المغلق.');
 if(type==='electric_field'&&/المجال المغناطيسي والمجال الكهربائي/.test(t))return item(r,'ما وجه اختلاف صحيح بين المجالين؟','الكهربائي يرتبط بالشحنات، والمغناطيسي بالمغانط والشحنات المتحركة',['كلاهما لا يؤثر في مادة','الكهربائي يوجد داخل السلك فقط','المغناطيسي لا اتجاه له'],'يختلف مصدر المجال وطبيعة تأثيره مع إمكان تمثيل كليهما بخطوط.');
 if(type==='electric_field')return item(r,'شحنتان موجبتان متقاربتان. ما اتجاه القوة بينهما؟','تتنافران',['تتجاذبان','لا تتأثران','تندمجان'],'الشحنات المتشابهة تتنافر والمختلفة تتجاذب.');
 if(type==='electromagnet'&&/العوامل المتحكمة/.test(t))return item(r,'أي تغيير يقوي مجال مغناطيس كهربائي غالبًا؟','زيادة شدة التيار وعدد لفات الملف',['قطع التيار','تقليل اللفات إلى الصفر','إزالة القلب دون بديل دائمًا'],'يعتمد المجال على التيار وعدد اللفات وخواص القلب.');
 if(type==='electromagnet'&&/المنطقة المغناطيسية/.test(t))return item(r,'ماذا يحدث للمناطق المغناطيسية في الحديد عند مغنطته؟','تنتظم اتجاهات عدد كبير منها في اتجاه متقارب',['تختفي الذرات','تتوقف الإلكترونات كلها','تتوزع عشوائيًا أكثر'],'نشوء المغنطة يرتبط بزيادة انتظام المجالات المجهرية.');
 if(type==='electromagnet'&&/أجهزة تحول الطاقة/.test(t))return item(r,'أي جهاز يحول الطاقة الميكانيكية إلى كهربائية؟','المولد الكهربائي',['المحرك الكهربائي','البطارية وحدها','المقاومة الحرارية'],'يستخدم المولد الحركة والمجال المغناطيسي لتوليد تيار.');
 if(type==='electromagnet')return item(r,'أي تطبيق يعتمد مغناطيسًا كهربائيًا؟','رافعة فرز الحديد',['ميزان ذو كفتين فقط','مرآة مستوية','محرار زئبقي'],'يمكن تشغيل المغناطيس الكهربائي وإيقافه بالتحكم في التيار.');

 if(type==='thermal'&&/السلسيوس|الفهرنهايتي|الكالفن/.test(t)){const c=pick(r,[0,10,20,25,30,40]),k=c+273;return item(r,`تقريبًا، كم كلفن تقابل ${c}°س؟`,`${k} K`,[`${c} K`,`${k+10} K`,`${273-c} K`],'كلفن ≈ سلسيوس + 273.');}
 if(type==='thermal'&&/طرق انتقال/.test(t))return item(r,'كيف تنتقل طاقة الشمس الحرارية عبر الفراغ إلى الأرض؟','بالإشعاع',['بالتوصيل','بالحمل','بالتلامس المباشر'],'الإشعاع لا يحتاج وسطًا ماديًا.');
 if(type==='thermal'&&/درجة توصيلها للحرارة/.test(t))return item(r,'لماذا يُصنع مقبض القدر من مادة عازلة؟','لتقليل انتقال الحرارة إلى اليد',['لزيادة التوصيل','لرفع كتلة القدر فقط','لإنتاج حرارة جديدة'],'العازل الحراري يبطئ انتقال الطاقة بالتوصيل.');
 if(type==='thermal'&&/الحرارة النوعية|امتصاص أو فقد/.test(t))return item(r,'تساوت كتلتا مادتين واكتسبتا الطاقة نفسها؛ ارتفعت حرارة الأولى أقل. ماذا نستنتج؟','حرارتها النوعية أكبر',['كتلتها صفر','حرارتها النوعية أصغر','لم تكتسب طاقة'],'المادة الأعلى حرارة نوعية تحتاج طاقة أكبر لرفع درجة حرارتها المقدار نفسه.');
 if(type==='thermal'&&/الطاقة الحرارية ودرجة الحرارة/.test(t))return item(r,'أي عبارة تفرق بين الطاقة الحرارية ودرجة الحرارة؟','الطاقة الحرارية تتأثر بعدد الجسيمات وطاقتها، والدرجة تقيس متوسط طاقتها الحركية',['هما الشيء نفسه دائمًا','الدرجة تعتمد الكتلة فقط','الطاقة الحرارية لا ترتبط بالجسيمات'],'قد يتساوى جسمان في الدرجة ويختلفان في الطاقة الحرارية بسبب الكتلة.');
 if(type==='thermal')return item(r,'لامس جسم ساخن جسمًا أبرد. ما اتجاه انتقال الحرارة؟','من الساخن إلى البارد حتى يقتربا من الاتزان',['من البارد إلى الساخن تلقائيًا','لا تنتقل','تنتقل المادة بدل الطاقة'],'الفرق في درجة الحرارة يقود انتقال الطاقة الحرارية.');

 if(type==='mechanical_energy'&&/العلاقة.*الكتلة.*سرعته/.test(t)){const m=ri(r,2,8),v=ri(r,2,8),ans=.5*m*v*v;return item(r,`جسم كتلته ${m} كجم وسرعته ${v} م/ث. ما طاقته الحركية؟`,`${fmt(ans)} جول`,[`${m*v} جول`,`${fmt(.5*m*v)} جول`,`${m*v*v} جول`],'KE=1/2 mv²؛ لذلك العلاقة مع السرعة غير خطية.');}
 if(type==='mechanical_energy'&&/يحسب الطاقة الحركية والكامنة/.test(t)){const m=ri(r,2,8),h=ri(r,2,10),ans=m*10*h;return item(r,`جسم كتلته ${m} كجم على ارتفاع ${h} م. ما طاقة وضعه إذا g≈10؟`,`${ans} جول`,[`${m*h} جول`,`${m*10} جول`,`${h*10} جول`],'طاقة الوضع=mgh.');}
 if(type==='mechanical_energy'&&/ارتفاع الجسم/.test(t))return item(r,'عند مضاعفة ارتفاع جسم مع ثبات كتلته، ماذا يحدث لطاقة وضعه؟','تتضاعف',['تنخفض للنصف','تبقى ثابتة','تتربع'],'طاقة الوضع تتناسب طرديًا مع الارتفاع.');
 if(type==='mechanical_energy')return item(r,'عند سقوط كرة دون مقاومة هواء، كيف تتحول الطاقة؟','تنقص طاقة الوضع وتزداد الحركية',['تزداد كلتاهما دائمًا','تختفي الطاقة','تنقص الحركية وتزداد الوضع'],'تتحول الطاقة بين الوضع والحركة مع بقاء مجموعهما.');
 if(type==='energy_conservation'&&/سلسلة/.test(t))return item(r,'في مصباح يعمل ببطارية، ما سلسلة التحول الأنسب؟','كيميائية ← كهربائية ← ضوئية وحرارية',['ضوئية ← كيميائية فقط','حرارية ← نووية','ميكانيكية ← كتلية'],'تنتقل الطاقة بين أشكال متتابعة مع حفظ مجموعها.');
 if(type==='energy_conservation'&&/توليد الطاقة من الموارد/.test(t))return item(r,'أي تقنية تولد كهرباء من مورد متجدد؟','الخلايا الشمسية',['حرق الفحم','محرك ديزل','استخراج النفط'],'تحول الخلايا الشمسية طاقة الإشعاع إلى كهرباء.');
 if(type==='energy_conservation')return item(r,'أي مثال يوضح تحولًا للطاقة؟','تحول كهرباء المروحة إلى حركة وحرارة وصوت',['اختفاء الطاقة بعد التشغيل','تكون طاقة من عدم','ثبات شكل الطاقة دائمًا'],'الأجهزة تحول الطاقة ولا تفنيها.');

 if(type==='sound'&&/شدة الصوت وحدته وعلوه/.test(t))return item(r,'زاد تردد موجة صوتية مع ثبات سعتها. ما الذي يزداد؟','حدة الصوت',['علو الصوت فقط','سرعة الصوت في الوسط دائمًا','كتلة المصدر'],'ترتبط الحدة بالتردد، والعلو بالسعة غالبًا.');
 if(type==='sound'&&/الصدى/.test(t))return item(r,'ما سبب سماع الصدى؟','انعكاس الموجات الصوتية وعودتها بعد زمن ملحوظ',['انكسار الضوء','امتصاص الصوت كاملًا','انتقال الصوت في الفراغ'],'ينتج الصدى من انعكاس الصوت عن سطح بعيد.');
 if(type==='sound')return item(r,'أي وصف صحيح للموجة الصوتية في الهواء؟','موجة ميكانيكية طولية تحتاج وسطًا',['موجة كهرومغناطيسية','مستعرضة دائمًا','تنتقل في الفراغ'],'يتذبذب الهواء في اتجاه انتشار الموجة تقريبًا.');
 if(type==='light'&&/رؤية الألوان/.test(t))return item(r,'لماذا يظهر جسم أحمر تحت ضوء أبيض؟','يعكس الأحمر ويمتص معظم الألوان الأخرى',['يصدر كل ألوان الطيف','يمتص الأحمر فقط','لا يتفاعل مع الضوء'],'يعتمد اللون المرئي على الأطوال الموجية المنعكسة.');
 if(type==='light'&&/الطيف الكهرومغناطيسي/.test(t))return item(r,'أي تطبيق يستخدم الأشعة تحت الحمراء؟','التصوير الحراري والتحكم عن بعد',['سماع الصدى','قياس الكتلة','ترشيح الماء'],'ترتبط تحت الحمراء بالإشعاع الحراري وتستخدم في أجهزة متعددة.');
 if(type==='light'&&/انعكاس، وانكسار، وامتصاص/.test(t))return item(r,'انحرف شعاع ضوئي عند دخوله الماء من الهواء. ما الظاهرة؟','الانكسار',['الانعكاس','الامتصاص الكامل','الحيود الصوتي'],'يتغير اتجاه الضوء عند تغير سرعته بين وسطين.');
 if(type==='light')return item(r,'أي وصف صحيح للضوء؟','موجة كهرومغناطيسية مستعرضة تنتقل في الفراغ',['موجة ميكانيكية طولية','لا تحمل طاقة','تحتاج هواء دائمًا'],'لا يحتاج الضوء وسطًا ماديًا للانتقال.');

 if(type==='space'&&/الظروف المناخية/.test(t))return item(r,'أي عاملين يفيدان في مقارنة ظروف كوكبين؟','درجة الحرارة وتركيب الغلاف الجوي',['اسم الكوكب ولونه فقط','عدد الصور المتاحة','ترتيب الحروف'],'الظروف المناخية تتأثر بالطاقة المستقبلة والغلاف الجوي وغيرها.');
 if(type==='space'&&/حركة الأجرام/.test(t))return item(r,'لماذا يتغير الموقع الظاهري لكوكب بين النجوم؟','بسبب الحركة النسبية للأرض والكوكب في مداريهما',['لأن النجوم تتحرك حول الأرض يوميًا','لأن الكوكب يختفي فعليًا','لأن الضوء يتوقف'],'الموقع الظاهري ينتج من مقارنة اتجاه الرصد عبر الزمن.');
 if(type==='space'&&/الحياة خارج/.test(t))return item(r,'أي دليل سيكون أقوى لدعم احتمال وجود حياة خارج الأرض؟','رصد غازات حيوية متعددة مع ماء سائل وظروف مستقرة',['صورة ضبابية واحدة','تشابه لون الكوكب مع الأرض','رأي غير مدعوم'],'الحجة الأقوى تجمع أدلة مستقلة قابلة للفحص وتستبعد بدائل غير حيوية.');
 if(type==='space'&&/البيانات.*اتساع الكون/.test(t))return item(r,'لقياس المسافات بين المجرات، أي وحدة أنسب؟','السنة الضوئية',['السنتيمتر','اللتر','النيوتن'],'المسافات الكونية ضخمة فتستخدم وحدات مثل السنة الضوئية.');
 if(type==='space')return item(r,'أي أداة تجمع صورًا وأطيافًا لأجرام بعيدة من خارج الغلاف الجوي؟','تلسكوب فضائي',['مجهر ضوئي','ميزان حرارة منزلي','بوصلة فقط'],'التلسكوب الفضائي يتجنب كثيرًا من تأثيرات الغلاف الجوي.');

 if(type==='climate'&&/يحلل البيانات/.test(t))return item(r,'أي بيانات أنسب للحكم على اتجاه مناخي في منطقة؟','سجل درجات حرارة ممتد لعقود وبطريقة قياس ثابتة',['درجة يوم واحد','رأي سكان محدود','أعلى قراءة في ساعة'],'المناخ يدرس باتجاهات طويلة المدى لا بحالة طقس منفردة.');
 if(type==='climate')return item(r,'كيف تزيد غازات الدفيئة حرارة الغلاف الجوي؟','تمتص جزءًا من الأشعة تحت الحمراء الصادرة من الأرض وتعيد بثه',['تمنع كل ضوء الشمس','تزيل الغلاف الجوي','تحول الحرارة إلى كتلة'],'زيادة احتجاز الإشعاع الحراري ترفع متوسط الطاقة في النظام المناخي.');

 const[correct,wrong]=facts[(n+ri(r,0,facts.length-1))%facts.length];
 return item(r,`أي تفسير علمي يصف بدقة «${shortIndicator(t)}»؟`,correct,wrong,'الإجابة الصحيحة ترتبط بالمفهوم المحدد في المؤشر ولا تكتفي بحقيقة عامة.',null,'application');
}

export function classify(subject,indicatorText){if(subject==='reading')return readingType(indicatorText);if(subject==='math')return mathType(indicatorText);if(subject==='science')return scienceType(indicatorText);return'unsupported'}
export function generateExam({subject,indicatorText,outcomeTitle='',outcomeCode='',indicatorIndex=1,modelNo=1,seed=''}){
 const r=rng(`${subject}|${outcomeCode}|${indicatorIndex}|${modelNo}|${seed}`),out=[];
 const measurementFocus=`${subject}:${outcomeCode}:i${indicatorIndex}`;
 const start=(modelNo-1)*QUESTION_COUNT;
 for(let i=0;i<QUESTION_COUNT;i++){let q;const serial=start+i+1;if(subject==='reading')q=readingQuestion(indicatorText,r,serial);else if(subject==='math')q=mathQuestion(indicatorText,r,serial);else if(subject==='science')q=scienceQuestion(indicatorText,r,serial);else throw new Error('unsupported subject');if(subject!=='reading'){const level=i<5?'knowledge':i<10?'application':'reasoning';q=cognitiveVariant(r,q,level,indicatorText,serial)}q.id=`G-${subject}-${String(outcomeCode).replace(/[^0-9A-Za-z-]/g,'')}-${indicatorIndex}-${modelNo}-${i+1}-${Math.floor(r()*1e9)}`;q.measurement_focus=measurementFocus;out.push(q)}return out;
}
