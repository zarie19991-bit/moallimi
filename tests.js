(()=>{
const EDGE='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam';
const TESTS_PER_INDICATOR=2;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const prefix={reading:'R',math:'M',science:'S'};
const getSubject=k=>(window.NAFES_SUBJECTS||[]).find(s=>s.key===k);
function indicatorGuide(subject,text){
 const guides={
  reading:[
   [/معاني المفردات|الترادف، والتضاد/,'استنتاج معنى المفردة من قرائن السياق، وربطها بالترادف أو التضاد أو التمثيل المناسب.','اقرأ الجملة وما حولها، ثم اختبر كل معنى في موضع الكلمة واختر الأكثر اتساقًا.','لا تختَر المعنى الأشهر إذا كانت قرائن النص تدل على معنى آخر.'],
   [/التعريفات لمصطلحات/,'بناء تعريف لمصطلح جديد من صفاته ووظيفته والأمثلة التي يوردها النص.','اجمع ما يذكره النص عن المصطلح، ثم اختر تعريفًا يشمل صفاته الأساسية دون زيادة.','المرادف وحده لا يكون تعريفًا كاملًا إذا أغفل وظيفة المصطلح أو قيوده.'],
   [/يصنف المفردات/,'وضع المفردات في مجموعات دلالية وتحديد العلاقة بينها، مثل الترادف والتضاد والمشكلة والحل.','ابحث عن المعنى المشترك أو نوع الصلة بين الكلمات، ثم اختر التصنيف الذي يشملها جميعًا.','تشابه ورود الكلمات في فقرة واحدة لا يعني أنها تنتمي إلى التصنيف نفسه.'],
   [/يميز المفردات المختلفة/,'تمييز الفروق الدقيقة بين الألفاظ المتقاربة، وتحديد معنى اللفظ المتعدد بحسب سياقه.','قارن القيود التي يضيفها السياق إلى كل لفظ، ولاحظ ما يتغير عند استبداله بغيره.','تقارب المعنى لا يعني إمكان استبدال لفظين في كل سياق.'],
   [/يوظف المفردات الجديدة/,'استخدام المفردة الجديدة أو المتعددة المعاني في موقف جديد مع الحفاظ على دلالتها الدقيقة.','حدد معنى المفردة أولًا، ثم اختر الجملة أو الحل الذي يستخدمها في موضع مناسب.','تكرار المفردة في جملة لا يعد توظيفًا صحيحًا إذا تغير معناها أو اختل السياق.'],
   [/الأفكار الرئيسة والفرعية/,'تمييز الفكرة التي تجمع النص من التفاصيل التي تشرحها، وتحليل ترتيب الأفكار والأدلة.','اسأل: عم يتحدث النص كله؟ ثم صنف ما تحته إلى تفاصيل وأمثلة وأدلة بحسب وظيفتها.','لا تختَر مثالًا صحيحًا أو تفصيلًا محدودًا على أنه الفكرة الرئيسة.'],
   [/معلومات النص غير المباشرة/,'استخراج ما يفهم من النص دون أن يذكر حرفيًا، وتكوين أسئلة توضيحية وتعليلية واستنتاجية ونقدية.','اربط بين قرينتين أو أكثر، وحدد نوع السؤال المطلوب قبل اختيار الإجابة.','لا تجعل معرفتك الخارجية بديلًا عن القرائن الموجودة في النص.'],
   [/نقاط التشابه والاختلاف|يقارن بين نصين/,'مقارنة نصين وفق معايير محددة: القضية والأمثلة وقوة الأدلة واللغة والأسلوب.','أنشئ ذهنيًا عمودًا لكل نص، ثم قارن العنصر نفسه في العمودين.','اتفاق النصين في الموضوع لا يعني اتفاقهما في الموقف أو قوة الدليل.'],
   [/الحقائق والآراء/,'التمييز بين الحقيقة القابلة للتحقق والرأي الذي يعبر عن حكم، وبين المباشر والمستنتج.','اسأل هل يمكن فحص مصدر العبارة؟ ثم حدد هل صرح بها النص أم فهمت من قرائنه.','نبرة الكاتب الواثقة لا تحول الرأي إلى حقيقة.'],
   [/العلاقات والروابط/,'تفسير الروابط بين أجزاء النص، مثل السبب والنتيجة والمشكلة والحل والدليل والاستنتاج، ثم نقلها إلى موقف حياتي.','حدد طرفي العلاقة واتجاهها، وابحث عن القرينة التي تبين كيف يقود أحدهما إلى الآخر.','لا تعكس اتجاه العلاقة؛ فالنتيجة ليست سببًا لمجرد أنها وردت قبله في السؤال.'],
   [/مشاعر ودوافع الكاتب/,'استنتاج المشاعر والدوافع من التعابير، وتقويم اختيار التراكيب، وإضافة تعبير مناسب من إنشاء الطالب.','حدد العبارة الدالة، واربط اللفظ أو الحركة بالسياق قبل الحكم على الشعور أو الدافع.','لا تنسب شعورًا أو دافعًا إلى الكاتب أو الشخصية من غير تعبير يؤيده.'],
   [/مصداقيتها واكتمالها/,'تقويم مصداقية أفكار النص واكتمالها، وتفنيد الاتجاهات الضعيفة واقتراح بدائل تطور الحل.','افحص مصدر الدليل وحدود القياس وما ينقص التنفيذ، ثم اختر حكمًا متزنًا وبديلًا قابلًا للفحص.','وجود نقص في تفصيل لا يبرر قبول النص كله أو رفضه كله بلا تعليل.'],
   [/القيم والاتجاهات/,'تحديد القيمة التي يتبناها النص، وتقويم أثرها على الفرد والمجتمع وربطها بسلوك واقعي.','استخرج السلوك الذي يجسد القيمة، ثم تتبع أثره الفردي والاجتماعي.','ذكر اسم القيمة لا يكفي؛ المطلوب بيان سلوكها وأثرها.'],
   [/الحجج والبراهين/,'استخراج الحجة ومقدماتها وبراهينها، وتقويم قوتها ودعمها بدليل مناسب من خارج النص.','اربط كل دليل بالادعاء الذي يسنده، ثم افحص صلته وكفايته وحدود تعميمه.','المثال الفردي أو الأسلوب الواثق لا يكفيان وحدهما برهانًا عامًا.'],
   [/يلخص النص/,'اختصار النص وإعادة صياغته وتنظيم أفكاره مع الحفاظ على المعنى الرئيس والعلاقات المهمة.','احذف التكرار والتفاصيل الثانوية، ثم رتب القضية والمشكلة والدليل والحل والنتيجة بأسلوبك.','التلخيص ليس نسخ أول فقرة ولا اختزال النص في مثال واحد.'],
   [/مشكلة من واقعه|حل مشكلات فردية/,'نقل طريقة معالجة المشكلة في النص إلى موقف واقعي، واختيار حل علمي أو إبداعي قابل للتجربة والتقويم.','عرّف المشكلة، واجمع دليلًا، وقارن بدائل، ثم اختر حلًا بمعيار نجاح واضح.','لا تنسخ تفاصيل حل النص حرفيًا إذا اختلفت ظروف المشكلة الجديدة.']
  ],
  math:[
   [/معادلة|متباينة|نظام|دالة|عبارات جبرية|تحليل/,'فهم العلاقة الجبرية واختيار القاعدة المناسبة ثم تنفيذ الخطوات والتحقق من الناتج.','حدد المعطيات والمطلوب، ونفّذ العمليات العكسية بترتيب واضح.','لا تغيّر طرفًا من العلاقة دون إجراء التغيير نفسه على الطرف الآخر.'],
   [/هندس|مثلث|مضلع|زاوية|دائرة|محيط|مساحة|حجم|تحويل/,'استخدام خصائص الأشكال والعلاقات الهندسية لحساب قياس أو تفسير تحول.','ارسم شكلًا مبسطًا، ودوّن القياسات، ثم اختر القانون المناسب.','ميّز بين المحيط والمساحة والحجم ووحدات كل منها.'],
   [/احتمال|عينة|بيانات|تمثيل|متوسط|وسيط|منوال|تشتت/,'قراءة البيانات أو تنظيمها واختيار المقياس أو التمثيل الذي يجيب عن السؤال.','حدد نوع البيانات وما المطلوب مقارنته قبل الحساب أو اختيار الرسم.','لا تحكم من قيمة واحدة إذا كان السؤال عن مجموعة البيانات كلها.'],
   [/نسبة|معدل|تناسب|مئوية|أسس|جذر|أعداد/,'اختيار العملية العددية المناسبة وتمثيل العلاقة بصورة صحيحة.','حوّل المعطيات إلى أعداد أو نسب متكافئة، ثم تحقق من معقولية الناتج.','انتبه إلى الإشارة ووحدة القياس وترتيب العمليات.']
  ],
  science:[
   [/تجربة|استقصاء|فرضية|متغير|بيانات|دليل|استنتاج/,'قراءة موقف علمي وتحديد الدليل أو المتغير أو الاستنتاج الذي تدعمه البيانات.','افصل بين الملاحظة والتفسير، ثم اربط النتيجة بالبيانات المعروضة.','لا تعد التوقع دليلًا، ولا تستنتج أكثر مما تسمح به البيانات.'],
   [/قوة|حركة|سرعة|تسارع|طاقة|كهرب|موج|ضوء|صوت|حرارة/,'تطبيق المفهوم الفيزيائي المناسب على موقف أو بيانات، مع الانتباه إلى العلاقة بين الكميات.','حدد الكميات ووحداتها، ثم اختر القانون أو العلاقة التي تربطها.','لا تستخدم قانونًا لمجرد وجود أرقام؛ تحقق أولًا من أنه يقيس المطلوب.'],
   [/خلية|وراث|جهاز|مخلوق|بيئ|تنوع|دورة/,'تفسير بنية أو عملية حيوية وربطها بوظيفتها أو أثرها في النظام الحي.','حدد الجزء أو العملية، ثم تتبع وظيفتها وما ينتج عنها.','لا تخلط بين وصف البنية وشرح وظيفتها.'],
   [/ذرة|عنصر|مركب|تفاعل|حمض|قاعدة|مادة/,'تمييز خصائص المادة أو تفسير تغيرها باستخدام نموذج أو دليل كيميائي مناسب.','حدد المواد قبل التغير وبعده، وابحث عن دليل يميز التغير الفيزيائي من الكيميائي.','تغير الشكل أو الحالة لا يعني دائمًا تكون مادة جديدة.'],
   [/صخر|معدن|زلزال|صفائح|مناخ|فضاء|موارد/,'تفسير ظاهرة في الأرض أو الفضاء وربط أسبابها بنتائجها أو بالأدلة المستخدمة في دراستها.','رتب السبب والعملية والنتيجة، وقارنها بالبيانات أو النموذج المعروض.','لا تخلط بين الطقس القصير المدى والمناخ طويل المدى.']
  ]
 };
 const fallback={reading:['فهم المهارة القرائية المحددة في المؤشر وتطبيقها على نص جديد.','اقرأ النص والسؤال معًا، وحدد الكلمة المفتاحية، ثم استبعد الاختيارات التي لا يدعمها النص.','اختر الإجابة التي يثبتها النص، لا الإجابة الممكنة في الحياة فقط.'],math:['فهم المهارة الرياضية المحددة في المؤشر وتطبيقها على مسألة جديدة.','حدد المعطيات والمطلوب، ثم اختر القاعدة المناسبة وتحقق من الناتج.','لا تبدأ بالحساب قبل فهم المطلوب ووحدة الإجابة.'],science:['فهم المفهوم العلمي المحدد في المؤشر وتطبيقه أو الاستدلال عليه من الأدلة.','حدد الظاهرة والمعطيات، ثم اختر التفسير الذي يوافق المفهوم العلمي.','ميّز بين الدليل العلمي والرأي أو التوقع.']};
 const match=(guides[subject]||[]).find(([pattern])=>pattern.test(text));
 const [meaning,method,warning]=match?match.slice(1):fallback[subject]||fallback.reading;
 return{meaning,method,warning};
}
const code=(s,o,i,m)=>`N3-${prefix[s]||'X'}-${String(o).replace(/[^0-9A-Za-z]/g,'')}-I${pad(i)}-M${pad(m)}`;
const url=(s,o,i,m)=>`${location.origin}${location.pathname.replace(/[^/]+$/,'')}exam.html?s=${encodeURIComponent(s)}&o=${encodeURIComponent(o)}&i=${i}&m=${m}`;
async function preview(s,o,i,m=1){const subj=getSubject(s),out=subj?.outcomes?.find(x=>x.code===o),indicatorText=out?.indicators?.[i-1]||'';try{const r=await fetch(EDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview',subject:s,outcome:o,indicator:i,model:m,indicator_text:indicatorText,outcome_title:out?.title||''})});return await r.json()}catch(e){return{ready:false,error:'تعذر الاتصال بمحرك الاختبارات'}}}
function ensureModal(){let x=document.getElementById('testModal');if(x)return x;x=document.createElement('div');x.id='testModal';x.className='modal-layer hidden';x.innerHTML='<div class="modal-card tests-modal"><button class="modal-close" type="button" aria-label="إغلاق">×</button><div id="testModalBody"></div></div>';document.body.appendChild(x);x.addEventListener('click',e=>{if(e.target===x||e.target.closest('.modal-close'))closeModels()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModels()});return x}
window.closeModels=()=>{const m=document.getElementById('testModal');if(m)m.classList.add('hidden')};
window.copyTestLink=async(s,o,i,m)=>{try{const d=await NafesQR.resolveLegacy(s,o,i,m);try{await navigator.clipboard.writeText(d.url);toast('تم نسخ رابط الاختبار')}catch(_){prompt('انسخ الرابط:',d.url)}}catch(e){toast(e.message)}};
window.openQr=async(s,o,i,m)=>{let q=document.getElementById('qrLayer');if(!q){q=document.createElement('div');q.id='qrLayer';q.className='modal-layer hidden';q.innerHTML='<div class="modal-card qr-card"><button class="modal-close" type="button">×</button><div class="qr-title"></div><div id="qrBox"></div><div class="qr-code"></div><div class="qr-actions"></div></div>';document.body.appendChild(q);q.addEventListener('click',e=>{if(e.target===q||e.target.closest('.modal-close'))q.classList.add('hidden')})}q.classList.remove('hidden');q.querySelector('.qr-title').textContent='رابط الطالب وباركود الاختبار';q.querySelector('.qr-code').textContent=code(s,o,i,m);q.querySelector('.qr-actions').replaceChildren();const box=q.querySelector('#qrBox');try{NafesQR.clear(box);box.textContent='جارٍ التحقق من الاختبار…';const d=await NafesQR.resolveLegacy(s,o,i,m);await NafesQR.render(box,d.url);const actions=q.querySelector('.qr-actions');const a=document.createElement('a');a.href=d.url;a.target='_blank';a.rel='noopener';a.textContent='فتح الاختبار';actions.append(a);for(const[label,fn]of [['نسخ الرابط',()=>copyTestLink(s,o,i,m)],['تحميل QR',()=>NafesQR.download(box,'nafes-qr.png')],['طباعة QR',()=>NafesQR.print(box,'اختبار نافس')]]){const b=document.createElement('button');b.textContent=label;b.onclick=fn;actions.append(b)}}catch(e){box.textContent=e.message}};
function toast(t){let x=document.getElementById('miniToast');if(!x){x=document.createElement('div');x.id='miniToast';x.className='mini-toast';document.body.appendChild(x)}x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1800)}
window.openNafesModels=async(s,o,i)=>{const subj=getSubject(s),out=subj?.outcomes?.find(x=>x.code===o),indicatorText=out?.indicators?.[i-1]||'',guide=indicatorGuide(s,indicatorText);const layer=ensureModal(),body=document.getElementById('testModalBody');layer.classList.remove('hidden');body.innerHTML='<div class="loading-box">جارٍ فحص محرك الاختبارات لهذا المؤشر...</div>';const p=await preview(s,o,i,1);const ready=!!p.ready;body.innerHTML=`<header class="tests-head"><span>نافس · ${esc(subj?.title||s)}</span><h3>${TESTS_PER_INDICATOR} اختباران على المؤشر</h3><p>${esc(indicatorText)}</p><div class="bank-state ${ready?'ready':'building'}"><b>${ready?'الاختبارات جاهزة للتشغيل':'تعذر تجهيز الاختبارات لهذا المؤشر'}</b><span>${ready?`${p.settings?.question_count||15} سؤالًا في كل اختبار · ${p.settings?.duration_minutes||20} دقيقة`:(p.error||'راجع محرك الاختبارات')}</span></div></header><section class="indicator-guide"><div class="guide-title"><span>قبل أن تبدأ</span><h4>شرح المؤشر بطريقة مبسطة</h4></div><div class="guide-grid"><article><b>ماذا يعني؟</b><p>${esc(guide.meaning)}</p></article><article><b>كيف أجيب؟</b><p>${esc(guide.method)}</p></article><article class="guide-warning"><b>انتبه</b><p>${esc(guide.warning)}</p></article></div></section><div class="models-note"><b>الاختباران</b><span>كل اختبار يحتوي على ١٥ سؤالًا تقيس المؤشر نفسه، وتُحفظ نتيجة الطالب لقياس مستوى إتقانه وتحسنه بين الاختبارين.</span></div><div class="models-grid">${Array.from({length:TESTS_PER_INDICATOR},(_,k)=>{const m=k+1,u=url(s,o,i,m),c=code(s,o,i,m);return `<article class="model-card ${ready?'':'locked'}"><div class="model-no">${pad(m)}</div><div class="model-main"><b>اختبار ${pad(m)}</b><small>١٥ سؤالًا · ${c}</small></div><div class="model-actions"><button ${ready?'':'disabled'} onclick="openQr('${s}','${o}',${i},${m})">باركود</button><button ${ready?'':'disabled'} onclick="copyTestLink('${s}','${o}',${i},${m})">نسخ الرابط</button><a class="${ready?'':'disabled'}" href="${ready?u:'#'}" target="_blank">فتح</a></div><div class="model-management"><button type="button" class="btn-adv-settings" onclick="openIndicatorSettings('${s}','${o}',${i},${m})">الإعدادات المتقدمة وإرسال الاختبار</button><a href="analysis.html?test=${encodeURIComponent(`exam:${s}:${o}:i${i}:m${m}`)}">تحليل نتائج الاختبار</a></div>${ready?'':'<span class="lock-note">غير متاح بسبب خطأ في محرك المؤشر</span>'}</article>`}).join('')}</div>`};

function ensureIndicatorSettingsModal(){
  let el = document.getElementById('indicatorSettingsModal');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'indicatorSettingsModal';
  el.className = 'modal-layer hidden';
  el.innerHTML = '<div class="modal-card indicator-settings-modal"><button class="modal-close" type="button" aria-label="إغلاق" id="closeIndSettingsModalBtn">×</button><div id="indSettingsModalBody"></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('#closeIndSettingsModalBtn')) closeIndicatorSettings();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !el.classList.contains('hidden')) closeIndicatorSettings();
  });
  return el;
}

window.closeIndicatorSettings = () => {
  const m = document.getElementById('indicatorSettingsModal');
  if (m) m.classList.add('hidden');
};

window.openIndicatorSettings = async (s, o, i, m = 1) => {
  if (!window.NafesTeacher?.getKey()) {
    window.NafesTeacher?.requireKey('أدخل مفتاح المعلم لفتح الإعدادات المتقدمة وتخصيص اختبار المؤشر.');
    return;
  }

  const subj = getSubject(s);
  const out = subj?.outcomes?.find(x => x.code === o);
  const indicatorText = out?.indicators?.[i - 1] || '';
  const initialModel = [1, 2].includes(Number(m)) ? Number(m) : 1;

  let draft = {};
  try { draft = JSON.parse(localStorage.getItem('nafes_builder_draft') || '{}'); } catch (_) {}

  const defaultTitle = `${subj?.title || s} — ${indicatorText} — النموذج ${initialModel}`;
  const defaultClass = draft.className || 'ثالث متوسط';
  const defaultSchool = draft.schoolName || '';
  const defaultTeacher = draft.teacherName || '';
  const defaultPrincipal = draft.principalName || '';

  const modal = ensureIndicatorSettingsModal();
  const body = document.getElementById('indSettingsModalBody');
  modal.classList.remove('hidden');

  body.innerHTML = `
    <header class="ind-settings-head">
      <span class="ind-badge">إعدادات متقدمة لمؤشر فردي</span>
      <h3>تخصيص وإرسال اختبار المؤشر</h3>
      <p>تحديد خيارات العرض، الحماية، وترتيب الأسئلة لهذا المؤشر فقط، مع إصدار رابط مباشر للطالب.</p>
      <div class="ind-indicator-summary">
        <b>المؤشر:</b> <span>${esc(subj?.title || s)} · ${esc(out?.title || o)} · المؤشر ${i}: ${esc(indicatorText)}</span>
      </div>
    </header>

    <form id="indSettingsForm" class="ind-form-body">
      <!-- Section 1: Basic Info -->
      <section class="ind-card-section">
        <h4>📋 بيانات الاختبار والفصل</h4>
        <div class="ind-grid-2">
          <div class="ind-field">
            <label for="indTitle">عنوان الاختبار *</label>
            <input id="indTitle" type="text" required value="${esc(defaultTitle)}" maxlength="160">
          </div>
          <div class="ind-field">
            <label for="indClassName">اسم الفصل / الشعبة *</label>
            <input id="indClassName" type="text" required value="${esc(defaultClass)}" maxlength="80">
          </div>
        </div>
        <div class="ind-grid-3" style="margin-top: 10px;">
          <div class="ind-field">
            <label for="indSchoolName">اسم المدرسة (اختياري)</label>
            <input id="indSchoolName" type="text" value="${esc(defaultSchool)}" placeholder="مثال: متوسطة الرواد" maxlength="120">
          </div>
          <div class="ind-field">
            <label for="indTeacherName">اسم المعلم (اختياري)</label>
            <input id="indTeacherName" type="text" value="${esc(defaultTeacher)}" placeholder="اسم معلم المادة" maxlength="120">
          </div>
          <div class="ind-field">
            <label for="indPrincipalName">اسم مدير المدرسة (اختياري)</label>
            <input id="indPrincipalName" type="text" value="${esc(defaultPrincipal)}" placeholder="اسم مدير المدرسة" maxlength="120">
          </div>
        </div>
      </section>

      <!-- Section 2: Student Identity Verification -->
      <section class="ind-card-section">
        <h4>👤 هوية الطالب وتسجيل الدخول</h4>
        <div class="ind-identity-badge-box">
          <div class="ind-id-icon">🔒</div>
          <div>
            <b>نظام هوية الطالب (الاسم + آخر ٣ أرقام من الهوية الوطنية):</b>
            <p>يدخل الطالب اسمه الثلاثي أو الرباعي وآخر ٣ أرقام من هويته الوطنية، وترتبط جميع محاولاته آليًا بملف الطالب الثابت (<code>student_id</code>) في قاعدة البيانات لمنع تكرار الهويات أو إنشاء سجلات عشوائية.</p>
          </div>
        </div>
      </section>

      <!-- Section 3: Question Model & Count -->
      <section class="ind-card-section">
        <h4>🎯 سحب الأسئلة ونموذج المؤشر</h4>
        <div class="ind-grid-3">
          <div class="ind-field">
            <label for="indModelChoice">اختيار النموذج أو طريقة السحب *</label>
            <select id="indModelChoice">
              <option value="1" ${initialModel === 1 ? 'selected' : ''}>النموذج الأول (١٥ سؤالًا مراجعًا)</option>
              <option value="2" ${initialModel === 2 ? 'selected' : ''}>النموذج الثاني (١٥ سؤالًا مراجعًا)</option>
              <option value="pool">سحب عشوائي متنوع من بنك أسئلة المؤشر (٣٠ سؤالًا)</option>
            </select>
          </div>
          <div class="ind-field">
            <label for="indQuestionCount">عدد الأسئلة</label>
            <select id="indQuestionCount" disabled>
              <option value="5">٥ أسئلة</option>
              <option value="10">١٠ أسئلة</option>
              <option value="15" selected>١٥ سؤالًا</option>
              <option value="20">٢٠ سؤالًا</option>
              <option value="25">٢٥ سؤالًا</option>
              <option value="30">٣٠ سؤالًا (كامل البنك)</option>
            </select>
            <small id="indCountNote">النموذج الثابت ١٥ سؤالًا مراجعًا.</small>
          </div>
          <div class="ind-field">
            <label for="indDuration">مدة الاختبار (بالدقائق) *</label>
            <input id="indDuration" type="number" min="5" max="60" value="20" required>
            <small>الوقت الموصى به: ٢٠ دقيقة للاختبار الفردي.</small>
          </div>
        </div>
        ${s === 'math' ? `
        <div style="margin-top: 12px;">
          <label class="ind-toggle-label" style="display: inline-flex;">
            <input id="indCalculator" type="checkbox" checked>
            <span>السماح باستخدام الآلة الحاسبة المدمجة أثناء الاختبار</span>
          </label>
        </div>` : ''}
      </section>

      <!-- Section 4: Ordering & Navigation -->
      <section class="ind-card-section">
        <h4>🔀 خيارات العرض والترتيب</h4>
        <div class="ind-toggles-grid">
          <label class="ind-toggle-label">
            <input id="indShuffleQuestions" type="checkbox" checked>
            <span>ترتيب عشوائي للأسئلة لكل طالب</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indShuffleOptions" type="checkbox" checked>
            <span>خلط ترتيب خيارات الإجابة لكل طالب</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indOnePerPage" type="checkbox" checked>
            <span>عرض سؤال واحد فقط في كل صفحة</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indAllowBack" type="checkbox" checked>
            <span>السماح بالرجوع للأسئلة السابقة ومراجعتها</span>
          </label>
        </div>
      </section>

      <!-- Section 5: Security & Anti-Cheat -->
      <section class="ind-card-section">
        <h4>🛡️ إعدادات الحماية والحد من النسخ والتصوير قدر الإمكان فقط</h4>
        <div class="ind-toggles-grid">
          <label class="ind-toggle-label">
            <input id="indAllowCopy" type="checkbox">
            <span>السماح بنسخ نص الأسئلة (غير موصى به)</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indDisableRightClick" type="checkbox" checked>
            <span>تعطيل الزر الأيمن في الفأرة أثناء الاختبار</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indDisablePrint" type="checkbox" checked>
            <span>تعطيل الطباعة وأمر حفظ الصفحة</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indDisableShortcuts" type="checkbox" checked>
            <span>تعطيل اختصارات النسخ والحفظ (Ctrl+C, Ctrl+P)</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indLockSession" type="checkbox" checked>
            <span>قصر المحاولة على تبويب أو جهاز واحد</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indLogVisibility" type="checkbox" checked>
            <span>تسجيل مغادرة الصفحة وتغيير التبويب في السجل</span>
          </label>
          <label class="ind-toggle-label" style="grid-column: 1 / -1;">
            <input id="indWatermark" type="checkbox" checked>
            <span>علامة مائية متحركة باسم الطالب ومعرف المحاولة وتاريخها</span>
          </label>
        </div>
      </section>

      <!-- Section 6: Results & Completion -->
      <section class="ind-card-section">
        <h4>📊 النتائج والتسليم</h4>
        <div class="ind-toggles-grid">
          <label class="ind-toggle-label">
            <input id="indShowResult" type="checkbox" checked>
            <span>عرض النتيجة والنسبة المئوية للطالب فور التسليم</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indShowAnswers" type="checkbox" checked>
            <span>عرض الإجابات الصحيحة والتفسير التعليمي بعد التسليم</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indShowIndicatorResult" type="checkbox" checked>
            <span>عرض مستوى إتقان المؤشر للطالب</span>
          </label>
          <label class="ind-toggle-label">
            <input id="indShowCorrectCount" type="checkbox" checked>
            <span>عرض عدد الأسئلة الصحيحة (مثال: ١٤ من ١٥)</span>
          </label>
        </div>
      </section>

      <!-- Section 7: Attempts & Scheduling -->
      <section class="ind-card-section">
        <h4>⏱️ عدد المحاولات والجدولة التلقائية</h4>
        <div class="ind-grid-3">
          <div class="ind-field">
            <label for="indAttempts">عدد المحاولات المسموح بها لكل طالب</label>
            <select id="indAttempts">
              <option value="1" selected>محاولة واحدة فقط</option>
              <option value="2">محاولتان</option>
              <option value="3">ثلاث محاولات</option>
            </select>
          </div>
          <div class="ind-field">
            <label for="indOpensAt">فتح الاختبار تلقائيًا في وقت محدد</label>
            <input id="indOpensAt" type="datetime-local">
            <small>اختياري: اتركه فارغًا ليفتح الاختبار فورًا.</small>
          </div>
          <div class="ind-field">
            <label for="indClosesAt">إغلاق الاختبار تلقائيًا في وقت محدد</label>
            <input id="indClosesAt" type="datetime-local">
            <small>اختياري: يمنع بدء أي محاولة جديدة بعد هذا الوقت.</small>
          </div>
        </div>
      </section>

      <div id="indFormError" class="ind-feedback-error" style="display: none;"></div>

      <div class="ind-actions-bar">
        <button type="button" class="btn-ind-cancel" onclick="closeIndicatorSettings()">إلغاء</button>
        <button type="submit" class="btn-ind-publish" id="indPublishBtn">
          <span>🚀 حفظ الإعدادات ونشر الاختبار</span>
        </button>
      </div>
    </form>

    <div id="indSuccessPanel" class="ind-success-panel" style="display: none;">
      <div class="ind-success-icon">✓</div>
      <h3>تم إنشاء ونشر اختبار المؤشر بنجاح</h3>
      <p id="indSuccessSummary"></p>
      
      <div class="ind-link-group">
        <input id="indGeneratedLink" type="text" readonly>
        <button type="button" id="indCopyLinkBtn">نسخ الرابط</button>
      </div>

      <div class="ind-qr-wrapper" id="indQrBox"></div>

      <div class="ind-success-actions">
        <button type="button" id="indDownloadQrBtn">تحميل الباركود QR</button>
        <button type="button" id="indPrintQrBtn">طباعة الباركود QR</button>
        <a id="indOpenLink" class="btn-primary-link" href="#" target="_blank">فتح الاختبار (عرض الطالب)</a>
        <a id="indAnalysisLink" href="#" target="_blank">تحليل نتائج الاختبار</a>
        <button type="button" id="indResetFormBtn">تعديل الإعدادات أو إنشاء اختبار آخر</button>
      </div>
    </div>
  `;

  // Attach interactivity
  const modelSelect = document.getElementById('indModelChoice');
  const countSelect = document.getElementById('indQuestionCount');
  const countNote = document.getElementById('indCountNote');
  const allowBackCheckbox = document.getElementById('indAllowBack');
  const onePerPageCheckbox = document.getElementById('indOnePerPage');
  const form = document.getElementById('indSettingsForm');
  const errorBox = document.getElementById('indFormError');
  const publishBtn = document.getElementById('indPublishBtn');
  const successPanel = document.getElementById('indSuccessPanel');

  modelSelect.onchange = () => {
    if (modelSelect.value === 'pool') {
      countSelect.disabled = false;
      countNote.textContent = 'سحب عشوائي متنوع من بنك أسئلة المؤشر.';
    } else {
      countSelect.value = '15';
      countSelect.disabled = true;
      countNote.textContent = 'النموذج الثابت ١٥ سؤالًا مراجعًا.';
      const titleInput = document.getElementById('indTitle');
      if (titleInput && titleInput.value.includes('النموذج')) {
        titleInput.value = `${subj?.title || s} — ${indicatorText} — النموذج ${modelSelect.value}`;
      }
    }
  };

  allowBackCheckbox.onchange = () => {
    if (!allowBackCheckbox.checked) {
      onePerPageCheckbox.checked = true;
    }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<span>جارٍ تجهيز واعتماد ونشر الاختبار…</span>';

    try {
      const titleVal = document.getElementById('indTitle').value.trim();
      const classVal = document.getElementById('indClassName').value.trim();
      const schoolVal = document.getElementById('indSchoolName').value.trim();
      const teacherVal = document.getElementById('indTeacherName').value.trim();
      const principalVal = document.getElementById('indPrincipalName').value.trim();
      const identityMode = 'manual';
      const rosterList = [];

      const modelVal = modelSelect.value;
      const isFixed = modelVal === '1' || modelVal === '2';
      const fixedModel = isFixed ? Number(modelVal) : null;
      const qCount = isFixed ? 15 : Number(countSelect.value || 15);
      const durationVal = Math.max(5, Math.min(120, Number(document.getElementById('indDuration').value || 20)));

      const opensAtInput = document.getElementById('indOpensAt').value;
      const closesAtInput = document.getElementById('indClosesAt').value;
      const opensAt = opensAtInput ? new Date(opensAtInput).toISOString() : null;
      const closesAt = closesAtInput ? new Date(closesAtInput).toISOString() : null;
      if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
        throw new Error('وقت إغلاق الاختبار يجب أن يكون بعد وقت الفتح.');
      }

      // Save user inputs to draft for future convenience
      try {
        localStorage.setItem('nafes_builder_draft', JSON.stringify({
          ...draft,
          className: classVal,
          schoolName: schoolVal,
          teacherName: teacherVal,
          principalName: principalVal
        }));
      } catch (_) {}

      const indicatorKey = `${s}:${o}:i${i}`;

      const config = {
        kind: 'indicator',
        grade_key: 'middle_3',
        title: titleVal,
        class_name: classVal,
        school_name: schoolVal,
        teacher_name: teacherVal,
        principal_name: principalVal,
        identity_mode: identityMode,
        roster: rosterList,
        count_mode: 'total',
        sections: [{
          subject: s,
          question_count: qCount,
          duration_minutes: durationVal,
          calculator: s === 'math' && !!document.getElementById('indCalculator')?.checked,
          model_no: fixedModel || 1,
          fixed_model: fixedModel,
          indicators: [{
            key: indicatorKey,
            count: qCount
          }]
        }],
        settings: {
          show_result: document.getElementById('indShowResult').checked,
          show_answers: document.getElementById('indShowAnswers').checked,
          show_indicator_result: document.getElementById('indShowIndicatorResult').checked,
          show_correct_count: document.getElementById('indShowCorrectCount').checked,
          shuffle_questions: document.getElementById('indShuffleQuestions').checked,
          shuffle_options: document.getElementById('indShuffleOptions').checked,
          allow_copy: document.getElementById('indAllowCopy').checked,
          disable_right_click: document.getElementById('indDisableRightClick').checked,
          disable_print: document.getElementById('indDisablePrint').checked,
          disable_shortcuts: document.getElementById('indDisableShortcuts').checked,
          allow_back: document.getElementById('indAllowBack').checked,
          one_per_page: document.getElementById('indOnePerPage').checked,
          lock_session: document.getElementById('indLockSession').checked,
          log_visibility: document.getElementById('indLogVisibility').checked,
          watermark: document.getElementById('indWatermark').checked,
          attempts: Number(document.getElementById('indAttempts').value || 1),
          opens_at: opensAt,
          closes_at: closesAt,
          break_minutes: 0
        }
      };

      const previewRes = await window.NafesTeacher.api('teacher_preview', { config });
      if (!previewRes?.draft_id) throw new Error('تعذر تكوين مسودة الاختبار للمؤشر.');

      const publishRes = await window.NafesTeacher.api('teacher_publish', { draft_id: previewRes.draft_id });
      if (!publishRes?.short_code) throw new Error('تعذر اعتماد ونشر الاختبار.');

      // Determine the test URL
      const prodUrl = publishRes.url;
      const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const localUrl = `${location.origin}${location.pathname.replace(/[^/]+$/, '')}e.html?t=${publishRes.short_code}`;
      const displayUrl = isLocal ? localUrl : prodUrl;

      // Switch to success view
      form.style.display = 'none';
      successPanel.style.display = 'block';

      document.getElementById('indSuccessSummary').textContent = `${publishRes.title} · الفصل: ${classVal} · الرمز: ${publishRes.short_code}`;
      document.getElementById('indGeneratedLink').value = displayUrl;
      document.getElementById('indOpenLink').href = displayUrl;
      document.getElementById('indAnalysisLink').href = `analysis.html?test=${encodeURIComponent(publishRes.id)}`;

      // Copy link
      document.getElementById('indCopyLinkBtn').onclick = async () => {
        try {
          await navigator.clipboard.writeText(displayUrl);
          document.getElementById('indCopyLinkBtn').textContent = 'تم النسخ ✓';
          setTimeout(() => { document.getElementById('indCopyLinkBtn').textContent = 'نسخ الرابط'; }, 2000);
        } catch (_) {
          document.getElementById('indGeneratedLink').select();
          document.execCommand('copy');
          document.getElementById('indCopyLinkBtn').textContent = 'تم التحديد';
        }
      };

      // QR Code
      const qrBox = document.getElementById('indQrBox');
      NafesQR.clear(qrBox);
      qrBox.textContent = 'جارٍ رسم الباركود…';
      try {
        await NafesQR.render(qrBox, prodUrl);
      } catch (err) {
        qrBox.textContent = 'تعذر إنشاء رمز الاستجابة السريعة: ' + err.message;
      }

      document.getElementById('indDownloadQrBtn').onclick = () => {
        try { NafesQR.download(qrBox, `nafes-${publishRes.short_code}.png`); } catch (err) { toast(err.message); }
      };
      document.getElementById('indPrintQrBtn').onclick = () => {
        try { NafesQR.print(qrBox, publishRes.title); } catch (err) { toast(err.message); }
      };

      document.getElementById('indResetFormBtn').onclick = () => {
        form.style.display = 'grid';
        successPanel.style.display = 'none';
      };

    } catch (err) {
      errorBox.textContent = err.message || 'حدث خطأ أثناء حفظ ونشر الاختبار.';
      errorBox.style.display = 'block';
    } finally {
      publishBtn.disabled = false;
      publishBtn.innerHTML = '<span>🚀 حفظ الإعدادات ونشر الاختبار</span>';
    }
  };
};
})();

