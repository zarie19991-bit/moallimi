(()=>{
'use strict';
const $=id=>document.getElementById(id);
const A=window.NafesAnalytics;
const SUBJECT_LABEL={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const DATA_CACHE='__NAFES_ANALYSIS_DATA_CACHE__';

function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function normSubject(v){
 const s=clean(v).toLowerCase();
 if(['reading','arabic','language','القراءة','العربية','اللغة العربية'].includes(s))return'reading';
 if(['math','mathematics','الرياضيات'].includes(s))return'math';
 if(['science','العلوم'].includes(s))return'science';
 return'';
}
function submitted(a){return A&&A.isSubmitted?A.isSubmitted(a):!!(a&&a.submitted_at)}
function testId(a){return String(a&&((a.test_id||a.assessment_id||a.exam_id))||'').trim()}
function sid(a){return A&&A.studentIdentity?A.studentIdentity(a):String(a&&(a.student_id||a.student_key||a.student_no||a.id||a.student_name)||'')}
function scorable(q){return A&&A.isScorable?A.isScorable(q):typeof(q&&q.correct)==='boolean'}
function indKey(q){return clean(A&&A.indicatorKey?A.indicatorKey(q):(q&&(q.indicator_key||q.indicator_id||q.indicator_text))||'')}
function pct(n){return Number.isFinite(Number(n))?new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(n))+'٪':'—'}
function cognitive(q){
 const raw=clean(q&&(q.bloom||q.cognitive_level||q.cognitive||q.level||q.thinking_level)).toLowerCase();
 const stem=clean(q&&(q.question||q.stem||q.text));
 if(/استدلال|استنتاج|infer|reason/.test(raw)||/استنتج|يدل|يفسر|أفضل تفسير|لماذا|سبب|نتيجة|العلاقة|يتوقع/.test(stem))return'inference';
 if(/تطبيق|apply|application/.test(raw)||/احسب|أوجد|حل|طبّق|طبق|قارن|رتب|مثّل|مثل|استخدم|حدد/.test(stem))return'application';
 return'knowledge';
}
function cognitiveLabel(k){return k==='inference'?'استدلالي':k==='application'?'تطبيقي':'معرفي'}
function kindFor(subject,text){
 const t=clean(text);
 if(subject==='reading'){
  if(/مفرد|مرادف|مضاد|معنى|دلالة|سياق/.test(t))return'vocabulary';
  if(/فكرة رئيس|فكرة فرع|الفكرة|موضوع النص/.test(t))return'ideas';
  if(/علاقة|سبب|نتيجة|تفسيرية/.test(t))return'relations';
  if(/استنتج|ضمني|استدلال|دليل/.test(t))return'inference';
  if(/نوع النص|الغرض|هدف الكاتب/.test(t))return'purpose';
  if(/قارن|تشابه|اختلاف/.test(t))return'compare';
  if(/ترتيب|تسلسل|أحداث/.test(t))return'sequence';
  return'comprehension';
 }
 if(subject==='math'){
  if(/خط الأعداد|ترتيب|مقارنة.*عدد|الأعداد.*النسبية/.test(t))return'numberline';
  if(/كسر|كسور|نسبة|تناسب|نسب مئوية|٪/.test(t))return'fractions';
  if(/معادلة|مجهول|عبارة جبرية|جبر/.test(t))return'algebra';
  if(/مساحة|محيط|حجم|زاوية|مثلث|دائرة|هندس/.test(t))return'geometry';
  if(/متوسط|وسيط|منوال|بيانات|جدول|رسم بياني|احتمال/.test(t))return'data';
  if(/قاسم|مضاعف|تحليل.*عوامل|أولي/.test(t))return'factors';
  if(/جمع|طرح|ضرب|قسمة|عمليات/.test(t))return'operations';
  return'problem';
 }
 if(subject==='science'){
  if(/خلية|خلايا|نسيج|عضو/.test(t))return'cells';
  if(/دورة|دورات|مرحلة/.test(t))return'cycle';
  if(/طاقة|قوة|حركة|حرارة|ضوء|كهرب/.test(t))return'energy';
  if(/مادة|ذرة|عنصر|مركب|محلول|تغير/.test(t))return'matter';
  if(/بيئة|نظام بيئي|مخلوقات|سلسلة غذائية|تكيف/.test(t))return'ecology';
  if(/تجربة|متغير|فرضية|استنتاج|رسم|جدول|بيانات/.test(t))return'experiment';
  if(/جسم الإنسان|تنفس|دوران|هضم|جهاز/.test(t))return'body';
  return'concept';
 }
 return'general';
}
function actionFor(p){
 const lead=p.dominant==='inference'
  ?'تركز الخطأ في الأسئلة الاستدلالية؛ يبدأ التدريب بتحديد الدليل الذي يقود للإجابة ثم تبرير الاختيار. '
  :p.dominant==='application'
   ?'تركز الخطأ في الأسئلة التطبيقية؛ يبدأ التدريب بمثال محلول ثم ينتقل إلى تطبيق مستقل مشابه. '
   :'تركز الخطأ في الأسئلة المعرفية؛ يبدأ التدريب بتثبيت المفهوم والمصطلحات ثم التحقق باسترجاع سريع. ';
 const reading={
  vocabulary:'تدريب على قرائن السياق: تحديد الكلمات المحيطة بالمفردة، توقع معناها قبل قراءة البدائل، ثم تطبيق على سياقات جديدة.',
  ideas:'تحديد الجملة المحورية في كل فقرة، فصل الفكرة الرئيسة عن التفاصيل، ثم تلخيص الفقرة في جملة واحدة.',
  relations:'تحديد العبارتين المرتبطتين في النص ورسم علاقة سبب/نتيجة أو تفسير بينهما، ثم تطبيق على مثال جديد.',
  inference:'تحديد الدليل الصريح أولًا ثم صياغة الاستنتاج الذي يسمح به الدليل فقط.',
  purpose:'مقارنة خصائص أنواع النصوص والغرض منها، ثم تبرير الاختيار بدليل من النص.',
  compare:'جدول تشابه/اختلاف من عمودين ثم تحويل المقارنة إلى إجابة كاملة.',
  sequence:'ترتيب الأحداث أو الأفكار اعتمادًا على ألفاظ الزمن والربط ثم إعادة بناء التسلسل.',
  comprehension:'تحديد المطلوب في السؤال، وضع خط تحت الدليل المناسب، ثم استبعاد المشتتات واحدًا واحدًا.'
 };
 const math={
  numberline:'تمثيل الأعداد على خط الأعداد ومقارنة مواقعها ثم حل أسئلة ترتيب وتمثيل جديدة.',
  fractions:'استخدام نموذج بصري للكسر أو النسبة، توحيد المقامات أو الوحدات عند الحاجة، ثم تطبيق متدرج.',
  algebra:'تحديد المجهول، تنفيذ العملية العكسية خطوة بخطوة، ثم التحقق بالتعويض.',
  geometry:'رسم الشكل وكتابة المعطيات عليه، اختيار القانون المناسب والوحدة، ثم حل مسألة مماثلة بقيم جديدة.',
  data:'قراءة عنوان الجدول أو الرسم والمحاور أولًا، استخراج القيم المطلوبة، ثم الحساب أو الاستنتاج.',
  factors:'تفكيك العدد إلى عوامله وتمييز القاسم من المضاعف ثم تطبيق على أعداد جديدة مع تفسير السبب.',
  operations:'تحديد العملية المطلوبة، تنفيذها مع تقدير تقريبي قبل الحل، ثم فحص معقولية الناتج.',
  problem:'تحويل المسألة إلى معطيات، مطلوب، خطة، حل، تحقق؛ ثم حل مسألة جديدة من البنية نفسها.'
 };
 const science={
  cells:'مخطط يربط الجزء بوظيفته ثم مقارنة مثالين وتفسير أثر تغير الجزء على الوظيفة.',
  cycle:'ترتيب مراحل الدورة بأسهم، شرح كل مرحلة، ثم إعادة ترتيب دورة جديدة من دون تلميحات.',
  energy:'تحديد شكل الطاقة أو القوة قبل وبعد الموقف ورسم مسار التحول ثم تفسير النتيجة.',
  matter:'تصنيف المادة أو التغير وفق الخصائص الظاهرة ثم تبرير التصنيف بدليل من الموقف.',
  ecology:'بناء شبكة علاقة بين المخلوقات والعوامل ثم توقع أثر تغير عنصر واحد وتفسير النتيجة.',
  experiment:'تحديد المتغير المستقل والتابع والثوابت، قراءة البيانات، ثم صياغة استنتاج تدعمه نتيجة من التجربة.',
  body:'ربط العضو بالجهاز والوظيفة ثم تتبع مسار العملية داخل الجسم في مخطط مبسط.',
  concept:'مراجعة المفهوم من مثال أو رسم، تمييزه من مفهوم قريب، ثم تفسير إجابة جديدة بالمفهوم نفسه.'
 };
 const maps={reading:reading,math:math,science:science};
 return lead+((maps[p.subject]&&maps[p.subject][p.kind])||'إعادة بناء المفهوم من مثال مرتبط بالسؤال ثم تطبيق موجه يليه تطبيق مستقل مع تفسير الإجابة.');
}
function followupFor(p){
 if(p.dominant==='inference')return'ثلاثة أسئلة استدلالية جديدة من سياقات مختلفة؛ معيار الإتقان 80٪ فأعلى مع ذكر الدليل.';
 if(p.dominant==='application')return'مثال موجه واحد ثم ثلاثة تطبيقات مستقلة جديدة؛ معيار الإتقان 80٪ فأعلى دون مساعدة.';
 return'مراجعة سريعة ثم أربعة أسئلة قصيرة جديدة لتمييز المفهوم واسترجاعه؛ معيار الإتقان 80٪ فأعلى.';
}
function analyze(){
 const selected=String($('reportTest')&&$('reportTest').value||'').trim();
 const raw=window[DATA_CACHE]&&window[DATA_CACHE].data&&window[DATA_CACHE].data.attempts;
 if(!selected||!Array.isArray(raw)||!raw.length)return{ready:false,plans:[]};
 const groups=new Map();
 raw.forEach(function(a){
  if(!submitted(a)||testId(a)!==selected)return;
  const id=sid(a);
  (a.questions||[]).forEach(function(q){
   const subject=normSubject(q&& (q.subject||q.subject_key));
   if(!subject||!scorable(q))return;
   const keyPart=indKey(q);
   const indicator=clean(q&&(q.indicator_text||q.indicator)||keyPart);
   if(!indicator)return;
   const key=subject+'::'+(keyPart||indicator);
   if(!groups.has(key))groups.set(key,{subject:subject,indicator:indicator,total:0,wrong:0,stems:[],cog:{knowledge:0,application:0,inference:0},students:new Map()});
   const g=groups.get(key);
   const correct=q.correct===true;
   g.total++;
   if(!correct){g.wrong++;g.stems.push(clean(q.question||q.stem||q.text));g.cog[cognitive(q)]++;}
   if(!g.students.has(id))g.students.set(id,{total:0,wrong:0});
   const st=g.students.get(id);st.total++;if(!correct)st.wrong++;
  });
 });
 const plans=[];
 groups.forEach(function(g){
  if(!g.total||!g.wrong)return;
  const percent=(g.total-g.wrong)/g.total*100;
  if(percent>=80)return;
  const targets=[...g.students.values()].filter(function(s){return s.total&&((s.total-s.wrong)/s.total*100)<80});
  const dominant=Object.keys(g.cog).sort(function(a,b){return g.cog[b]-g.cog[a]})[0]||'knowledge';
  const p={subject:g.subject,indicator:g.indicator,total:g.total,wrong:g.wrong,percent:percent,targets:targets,dominant:dominant,kind:kindFor(g.subject,g.indicator+' '+g.stems.join(' '))};
  p.action=actionFor(p);p.followup=followupFor(p);plans.push(p);
 });
 plans.sort(function(a,b){return a.percent-b.percent});
 return{ready:true,plans:plans};
}
function addCell(row,text,tag){
 const el=document.createElement(tag||'td');el.textContent=text;row.appendChild(el);return el;
}
function buildSection(plans){
 const sec=document.createElement('section');sec.className='wr-remedial wr-remedial-diagnostic';sec.dataset.dynamicRemedial='1';
 const h=document.createElement('h3');h.textContent='الخطة العلاجية المبنية على الاختبار';sec.appendChild(h);
 const intro=document.createElement('p');intro.className='wr-remedial-intro';intro.textContent='هذه الإجراءات ناتجة من الأسئلة والمؤشرات التي أخفق فيها الطلاب في الاختبار المحدد؛ لذلك تتغير تلقائيًا عند تغير الاختبار أو نمط الأخطاء.';sec.appendChild(intro);
 if(!plans.length){
  const p=document.createElement('p');p.className='wr-remedial-empty';p.textContent='لا توجد مؤشرات منخفضة الأداء عن 80٪ في بيانات هذا الاختبار.';sec.appendChild(p);return sec;
 }
 const table=document.createElement('table'),thead=document.createElement('thead'),hr=document.createElement('tr');
 ['المادة','المهارة المستهدفة','دليل التشخيص من الاختبار','الطلاب المستهدفون','الإجراء العلاجي','إعادة القياس'].forEach(function(t){addCell(hr,t,'th')});
 thead.appendChild(hr);table.appendChild(thead);
 const tbody=document.createElement('tbody');
 plans.forEach(function(p){
  const tr=document.createElement('tr');
  addCell(tr,(SUBJECT_LABEL[p.subject]||p.subject)+' · '+pct(p.percent));
  addCell(tr,p.indicator);
  addCell(tr,p.wrong+' خطأ من '+p.total+' استجابة · التعثر '+pct(p.wrong/p.total*100)+' · النمط الغالب: '+cognitiveLabel(p.dominant));
  addCell(tr,(p.targets.length||0)+' طالبًا');
  addCell(tr,p.action);
  addCell(tr,p.followup);
  tbody.appendChild(tr);
 });
 table.appendChild(tbody);sec.appendChild(table);return sec;
}
let busy=false;
function patch(){
 if(busy)return;
 const host=$('reportPreview');if(!host)return;
 const pages=[...host.querySelectorAll('.weekly-report.report-sheet')];if(pages.length<2)return;
 const result=analyze();if(!result.ready)return;
 const page2=pages[1];
 const selected=String($('reportTest')&&$('reportTest').value||'');
 const signature=selected+'::'+result.plans.map(function(p){return [p.subject,p.indicator,p.total,p.wrong,p.dominant,p.targets.length].join('|')}).join('||');
 if(page2.dataset.dynamicRemedialSig===signature&&page2.querySelector('[data-dynamic-remedial="1"]'))return;
 busy=true;
 try{
  page2.dataset.compactRemedial='1';
  const title=page2.querySelector('.wr-title-pill');if(title)title.textContent='المتابعة والخطة العلاجية المبنية على الاختبار';
  page2.querySelectorAll('.wr-more-note').forEach(function(n){n.remove()});
  page2.querySelectorAll('.wr-remedial').forEach(function(n){n.remove()});
  const sec=buildSection(result.plans),signatures=page2.querySelector('.wr-signatures');
  if(signatures)signatures.parentNode.insertBefore(sec,signatures);else page2.appendChild(sec);
  page2.dataset.dynamicRemedialSig=signature;
 }finally{busy=false}
}
function printCurrent(){
 patch();
 const host=$('reportPreview');if(!host)return;
 const nodes=[...host.querySelectorAll('.weekly-report.report-sheet, .nafes-absence-sheet')];
 const unique=[];nodes.forEach(function(n){if(unique.indexOf(n)<0)unique.push(n)});
 if(!unique.length)return;
 const root=$('printRoot');root.innerHTML=unique.map(function(n){return n.outerHTML}).join('');root.setAttribute('aria-hidden','false');
 requestAnimationFrame(function(){window.print()});
}
function init(){
 const host=$('reportPreview');if(!host)return;
 let queued=false;
 new MutationObserver(function(){if(queued||busy)return;queued=true;queueMicrotask(function(){queued=false;patch()})}).observe(host,{childList:true,subtree:true,characterData:true});
 patch();
 const btn=$('printReportBtn');if(btn)btn.onclick=printCurrent;
 addEventListener('beforeprint',patch);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();