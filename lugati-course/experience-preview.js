import { UNITS } from "./course-data.js";

const app=document.querySelector("#app");
const roleButtons=[...document.querySelectorAll("[data-role]")];
let role="student";
let step=0;
let depth="brief";
let lessonScore=0;
let attempts={};
const lesson=UNITS[0].lessons.find(x=>x.id==="u1-l08");

const microSteps=[
  {
    kind:"concept",
    title:"ما اسم الفاعل؟",
    label:"المحور 1 · المفهوم",
    body:"اسم الفاعل اسم مشتق يدل على من قام بالفعل.",
    concepts:[["كتب","كاتب","الذي قام بالكتابة"],["حفظ","حافظ","الذي قام بالحفظ"],["جلس","جالس","الذي قام بالجلوس"]],
    deep:"اختبار سريع للمعنى: إذا كانت الكلمة تدل على من وقع عليه الفعل فهي ليست اسم فاعل، مثل «مكتوب»؛ فالكتاب وقع عليه فعل الكتابة.",
    question:{prompt:"أي كلمة تدل على من قام بالفعل؟",options:["مكتوب","كاتب","كتاب","كتابة"],answer:1,ok:"أحسنت. «كاتب» يدل على من قام بالكتابة.",no:"اسأل: من الذي قام بالفعل؟ «كاتب» هو الذي كتب، أما «مكتوب» فقد وقع عليه الفعل."}
  },
  {
    kind:"concept",
    title:"من الفعل الثلاثي",
    label:"المحور 2 · الصياغة",
    body:"نصوغ اسم الفاعل من الفعل الثلاثي على وزن «فاعِل».",
    concepts:[["نصر","ناصر","فاعِل"],["سمع","سامع","فاعِل"],["حفظ","حافظ","فاعِل"]],
    deep:"لا تحفظ الكلمات كلمة كلمة؛ قارن ترتيب الحروف: الحرف الأول يبقى، وبعده ألف، ثم الحرف الثاني، ثم الحرف الثالث.",
    question:{prompt:"اسم الفاعل من «سمع» هو:",options:["مسموع","سامع","سميع","سماع"],answer:1,ok:"صحيح. سمع ← سامع على وزن فاعِل.",no:"الفعل ثلاثي، لذلك ابحث عن صيغة «فاعِل»: سامع."}
  },
  {
    kind:"concept",
    title:"من الفعل غير الثلاثي",
    label:"المحور 3 · الصياغة المتقدمة",
    body:"نأتي بالمضارع، ونستبدل حرف المضارعة ميمًا مضمومة، ونكسر ما قبل الآخر.",
    concepts:[["يُكرم","مُكرِم","أكرم"],["يستخرج","مُستخرِج","استخرج"],["يتعاون","مُتعاوِن","تعاون"]],
    deep:"قارن «مُكرِم» و«مُكرَم»: الكسرة قبل الآخر في «مُكرِم» تساعدك على تمييز اسم الفاعل من اسم المفعول في هذا المثال.",
    question:{prompt:"ما اسم الفاعل من «استخرج»؟",options:["مُستخرَج","استخراج","مُستخرِج","خارِج"],answer:2,ok:"ممتاز. يستخرج ← مُستخرِج.",no:"ابدأ بالمضارع «يستخرج»، ثم ميم مضمومة وكسر ما قبل الآخر: مُستخرِج."}
  },
  {
    kind:"sort",
    title:"صنّف بسرعة",
    label:"نشاط تطبيقي",
    body:"اضغط كلمة ثم اختر المجموعة المناسبة. الهدف أن تميز «من قام بالفعل» من «من وقع عليه الفعل».",
    tokens:["كاتب","مكتوب","مُكرِم","مُكرَم","مُستخرِج","مُستخرَج"]
  },
  {
    kind:"scenario",
    title:"طبّق في سياق جديد",
    label:"نقل التعلم",
    body:"في الإذاعة المدرسية قيل: «الطالبُ مبادرٌ إلى خدمة زملائه». لماذا تعد «مبادر» اسم فاعل؟",
    question:{prompt:"اختر أفضل تفسير:",options:["لأنها تدل على من قام بالمبادرة","لأنها تدل على من وقعت عليه المبادرة","لأنها مصدر للفعل","لأنها اسم مكان"],answer:0,ok:"صحيح. هذا تطبيق للمعنى، لا مجرد تعرف الشكل.",no:"ارجع إلى التعريف: اسم الفاعل يدل على من قام بالفعل."}
  },
  {
    kind:"mastery",
    title:"بوابة الإتقان",
    label:"تقويم ختامي قصير",
    body:"أجب عن سؤالين جديدين. لن يعتمد الانتقال على مشاهدة الصفحة، بل على إتقان المهارة.",
    finals:[
      {prompt:"اسم الفاعل من «تعاون»:",options:["مُتعاوَن","مُتعاوِن","تعاوُن","عاوَن"],answer:1},
      {prompt:"أي جملة استُعمل فيها اسم الفاعل استعمالًا صحيحًا؟",options:["الدرسُ مكتوبٌ الطالبُ.","الطالبُ حافظٌ القصيدةَ.","محمدٌ كتابةٌ واجبه.","الكتابُ قارئٌ خالدًا."],answer:1}
    ]
  }
];

function renderRole(){
  roleButtons.forEach(b=>b.classList.toggle("active",b.dataset.role===role));
  const tpl=document.querySelector("#"+role+"Template");
  app.replaceChildren(tpl.content.cloneNode(true));
  if(role==="student") initStudent();
  if(role==="author") initAuthor();
}

roleButtons.forEach(b=>b.onclick=()=>{role=b.dataset.role;renderRole()});

function initStudent(){
  const nav=document.querySelector("#lessonNav");
  const sections=[
    ["الفهم والاستماع",UNITS[0].lessons.slice(0,5)],
    ["المهارات اللغوية",UNITS[0].lessons.slice(5,10)],
    ["الكتابة والتواصل",UNITS[0].lessons.slice(10)]
  ];
  nav.innerHTML=sections.map(([label,items])=>'<div class="nav-section">'+label+'</div>'+items.map((l,i)=>{
    const current=l.id===lesson.id;
    const done=l.order<lesson.order;
    return '<div class="nav-lesson '+(current?"current":"")+'"><span class="n">'+String(l.order).padStart(2,"0")+'</span><span>'+l.title.replace(/^.*?:\s*/,"")+'</span><span class="lock">'+(current?"●":done?"✓":"🔒")+'</span></div>';
  }).join("")).join("");
  document.querySelectorAll("[data-depth]").forEach(b=>b.onclick=()=>{
    depth=b.dataset.depth;
    document.querySelectorAll("[data-depth]").forEach(x=>x.classList.toggle("active",x.dataset.depth===depth));
    document.querySelector(".learning-stage").classList.toggle("depth-deep",depth==="deep");
  });
  renderStep();
  document.querySelector("#prevStep").onclick=()=>{if(step>0){step--;renderStep()}};
  document.querySelector("#nextStep").onclick=()=>{if(step<microSteps.length-1){step++;renderStep()}};
}

function renderStep(){
  const s=microSteps[step];
  const stage=document.querySelector("#microStage");
  document.querySelector("#prevStep").disabled=step===0;
  document.querySelector("#nextStep").textContent=step===microSteps.length-1?"أكمل التقويم":"التالي";
  document.querySelector("#stepDots").innerHTML=microSteps.map((_,i)=>'<i class="'+(i===step?"active":"")+'"></i>').join("");
  if(s.kind==="concept") stage.innerHTML=conceptCard(s);
  if(s.kind==="sort") stage.innerHTML=sortCard(s);
  if(s.kind==="scenario") stage.innerHTML=conceptCard(s);
  if(s.kind==="mastery") stage.innerHTML=masteryCard(s);
  wireChecks();
  if(s.kind==="sort") wireSort();
  if(s.kind==="mastery") wireFinals();
}

function conceptCard(s){
  const c=s.concepts?'<div class="concept-grid">'+s.concepts.map(x=>'<div class="concept"><small>'+x[0]+'</small><b>'+x[1]+'</b><span>'+x[2]+'</span></div>').join("")+'</div>':"";
  return '<article class="micro-card"><div class="micro-label">'+s.label+'</div><h2>'+s.title+'</h2><p>'+s.body+'</p>'+c+'<div class="deep-note"><b>تعمّق أكثر</b><p>'+s.deep+'</p></div>'+questionHtml(s.question,step)+'</article>';
}

function questionHtml(q,key){
  if(!q)return "";
  return '<div class="quick-check" data-check="'+key+'" data-answer="'+q.answer+'"><h3>'+q.prompt+'</h3><div class="choice-grid">'+q.options.map((o,i)=>'<button class="choice" data-index="'+i+'">'+String.fromCharCode(0x0623+i)+' — '+o+'</button>').join("")+'</div><div class="feedback ok">'+q.ok+'</div><div class="feedback no">'+q.no+'</div><div class="remedy" hidden><h3>دقيقة علاج</h3><p>أعد القاعدة بصوتك، ثم انظر إلى مثال جديد، وبعدها جرّب سؤالًا مختلفًا. لا نعيد السؤال الذي عرفت إجابته.</p></div></div>';
}

function wireChecks(){
  document.querySelectorAll("[data-check]").forEach(box=>{
    const answer=Number(box.dataset.answer);
    box.querySelectorAll(".choice").forEach(btn=>btn.onclick=()=>{
      if(box.dataset.done)return;
      box.dataset.done="1";
      const i=Number(btn.dataset.index);
      if(i===answer){
        btn.classList.add("correct");box.querySelector(".feedback.ok").classList.add("show");lessonScore++;
      }else{
        btn.classList.add("wrong");box.querySelectorAll(".choice")[answer].classList.add("correct");box.querySelector(".feedback.no").classList.add("show");
        const k=box.dataset.check;attempts[k]=(attempts[k]||0)+1;
        if(attempts[k]>=1)box.querySelector(".remedy").hidden=false;
      }
      emitXapi("answered",{step,correct:i===answer});
    });
  });
}

let selectedToken=null;
function sortCard(s){
  return '<article class="micro-card"><div class="micro-label">'+s.label+'</div><h2>'+s.title+'</h2><p>'+s.body+'</p><div class="token-wrap">'+s.tokens.map(t=>'<button class="token" data-token="'+t+'">'+t+'</button>').join("")+'</div><div class="sort-board"><div class="sort-col" data-bucket="فاعل"><h3>يدل على من قام بالفعل · اسم فاعل</h3></div><div class="sort-col" data-bucket="مفعول"><h3>يدل على من وقع عليه الفعل</h3></div></div><div id="sortFeedback" class="feedback"></div></article>';
}
function wireSort(){
  document.querySelectorAll("[data-token]").forEach(t=>t.onclick=()=>{selectedToken=t;document.querySelectorAll("[data-token]").forEach(x=>x.classList.toggle("selected",x===t))});
  document.querySelectorAll("[data-bucket]").forEach(b=>b.onclick=()=>{
    if(!selectedToken)return;
    const txt=selectedToken.dataset.token;
    const isF=["كاتب","مُكرِم","مُستخرِج"].includes(txt);
    const right=(b.dataset.bucket==="فاعل"&&isF)||(b.dataset.bucket==="مفعول"&&!isF);
    const clone=document.createElement("span");clone.className="token "+(right?"correct":"wrong");clone.textContent=txt;b.appendChild(clone);
    selectedToken.remove();selectedToken=null;
    const f=document.querySelector("#sortFeedback");f.className="feedback show "+(right?"ok":"no");f.textContent=right?"تصنيف صحيح.":"راجع المعنى: هل الكلمة تدل على من قام بالفعل أم من وقع عليه؟";
  });
}

function masteryCard(s){
  return '<article class="micro-card"><div class="micro-label">'+s.label+'</div><h2>'+s.title+'</h2><p>'+s.body+'</p>'+s.finals.map((q,i)=>'<div class="quick-check final-check" data-final="'+i+'" data-answer="'+q.answer+'"><h3>'+(i+1)+') '+q.prompt+'</h3><div class="choice-grid">'+q.options.map((o,j)=>'<button class="choice" data-index="'+j+'">'+o+'</button>').join("")+'</div></div>').join("")+'<div id="masteryResult"></div></article>';
}
function wireFinals(){
  let answered=0,correct=0;
  document.querySelectorAll("[data-final]").forEach(box=>{
    const ans=Number(box.dataset.answer);
    box.querySelectorAll(".choice").forEach(btn=>btn.onclick=()=>{
      if(box.dataset.done)return;
      box.dataset.done="1";answered++;
      const i=Number(btn.dataset.index);
      btn.classList.add(i===ans?"correct":"wrong");
      if(i===ans)correct++; else box.querySelectorAll(".choice")[ans].classList.add("correct");
      if(answered===2){
        const pass=correct===2;
        document.querySelector("#masteryResult").innerHTML='<div class="'+(pass?"feedback show ok":"remedy")+'"><b>'+(pass?"تم إتقان نقطة الدرس ✓":"لم يثبت الإتقان بعد")+'</b><p>'+(pass?"يمكن فتح الدرس التالي بعد تحقق بقية نقاط الدرس.":"سيقدم النظام علاجًا قصيرًا ثم سؤالين جديدين بدل كشف الطريق بالحفظ.")+'</p></div>';
        emitXapi("completed",{mastered:pass,score:correct/2});
      }
    });
  });
}

function initAuthor(){
  document.querySelectorAll("[data-block]").forEach(b=>b.onclick=()=>{
    const canvas=document.querySelector("#builderCanvas");
    const n=canvas.children.length+1;
    const el=document.createElement("div");el.className="builder-block";el.innerHTML='<span>'+n+'</span><div><b>'+b.textContent+'</b><p>لبنة جديدة — اكتب المحتوى وحدد نقطة الإتقان التي تقيسها.</p></div><button>⋮</button>';canvas.appendChild(el);
  });
  document.querySelector("#addBlock").onclick=()=>document.querySelector("[data-block='explain']").click();
}

function emitXapi(verb,result){
  const event={actor:"demo-student",verb,object:"lugati:u1-l08",result,timestamp:new Date().toISOString()};
  const history=JSON.parse(localStorage.getItem("lugati_xapi_demo")||"[]");history.push(event);localStorage.setItem("lugati_xapi_demo",JSON.stringify(history));
}

renderRole();