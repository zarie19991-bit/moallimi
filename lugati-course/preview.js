import { UNITS, COURSE_META } from "./course-data.js";

const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
let unitIndex=0,view="map";

function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function stateFor(i){
  if(i<2)return i===0?"mastered":"current";
  return "locked";
}
function stateLabel(s){return s==="mastered"?"متقن":s==="current"?"الدرس الحالي":"مقفل حتى إتقان السابق"}

function renderTabs(){
  qs("#unitTabs").innerHTML=UNITS.map((u,i)=>`<button class="unit-tab ${i===unitIndex?"active":""}" data-unit="${i}">
    <b>الوحدة ${u.order}: ${esc(u.title)}</b><span>${u.lessons.length} درسًا تعليميًا</span>
  </button>`).join("");
  qsa("[data-unit]").forEach(b=>b.onclick=()=>{unitIndex=Number(b.dataset.unit);render()});
}
function renderHeader(u){
  qs("#unitHeader").innerHTML=`<div class="unit-head">
    <div><div class="eyebrow" style="color:#1f7a64">الوحدة ${u.order}</div><h2>${esc(u.title)}</h2><p>${esc(u.unitGoal)}</p></div>
    <div class="unit-stats"><span>تقدم تجريبي للمعاينة</span><b>18%</b><div class="progress"><i></i></div><span>1 من ${u.lessons.length} متقن</span></div>
  </div>`;
}
function renderMap(u){
  return `<div class="lesson-list">${u.lessons.map((l,i)=>{
    const s=stateFor(i);
    return `<article class="lesson-row" data-lesson="${i}">
      <div class="lesson-num">${String(l.order).padStart(2,"0")}</div>
      <div class="lesson-title"><b>${esc(l.title)}</b><span>${esc(l.type)} · ${l.estimatedMinutes} دقيقة · ${esc(l.difficulty)}</span></div>
      <div class="state ${s}">${stateLabel(s)}</div>
    </article>`;
  }).join("")}</div>`;
}
function renderObjectives(u){
  return `<div class="objective-grid">${u.measurableObjectives.map((o,i)=>`<div class="objective"><small>هدف قابل للقياس ${i+1}</small><p>${esc(o)}</p></div>`).join("")}</div>`;
}
function renderJourney(){
  const steps=[
    ["1","أعرف هدفي","يرى الطالب هدف الدرس ومؤشرات النجاح قبل أن يبدأ."],
    ["2","أتعلم نقطة صغيرة","شرح قصير + مثال + تفاعل، وليس صفحة نصية طويلة."],
    ["3","أثبت فهمي","3 أسئلة قصيرة متنوعة؛ المطلوب 2 من 3."],
    ["4","أتعالج عند الحاجة","تلميح ثم شرح معزز ثم علاج مصغر بعد تكرر الخطأ."],
    ["5","أتحقق بسؤال جديد","لا يعاد السؤال الذي كُشفت إجابته."],
    ["6","أنتقل فقط بعد الإتقان","85% للدرس و80% على الأقل لكل هدف أساسي."]
  ];
  return `<div class="journey">${steps.map(x=>`<div class="journey-step"><i>${x[0]}</i><div><h3>${x[1]}</h3><p>${x[2]}</p></div></div>`).join("")}</div>`;
}
function renderView(u){
  const root=qs("#viewRoot");
  root.innerHTML=view==="map"?renderMap(u):view==="objectives"?renderObjectives(u):renderJourney();
  qsa("[data-lesson]",root).forEach(el=>el.onclick=()=>openLesson(u.lessons[Number(el.dataset.lesson)]));
}
function openLesson(l){
  qs("#lessonDetail").innerHTML=`<div class="lesson-detail">
    <div><span class="pill">${esc(l.type)}</span><span class="pill">${esc(l.difficulty)}</span><span class="pill">${l.estimatedMinutes} دقيقة</span></div>
    <h2>${esc(l.title)}</h2>
    <div class="detail-goal"><b>ملخص الدرس</b><br>${esc(l.summary)}</div>
    <div class="detail-grid">
      <div class="detail-box"><h3>الأهداف السلوكية</h3><ul>${(l.objectives||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="detail-box"><h3>نقاط الإتقان</h3><ul>${(l.learningPoints||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="detail-box"><h3>الأنشطة المقترحة</h3><ul>${(l.activities||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="detail-box"><h3>المتطلبات والموارد</h3><ul>${[...(l.prerequisites||[]),...(l.resources||[])].map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
    </div>
    <div class="mastery-flow"><strong>منطق الإتقان لهذا الدرس</strong><div><span>تعلم النقطة</span><span>تحقق 3 أسئلة</span><span>2/3 على الأقل</span><span>علاج عند التعثر</span><span>سؤال بديل</span><span>85% نهاية الدرس</span><span>فتح التالي</span></div></div>
  </div>`;
  qs("#lessonDrawer").hidden=false;
}
function render(){
  const u=UNITS[unitIndex];
  renderTabs();renderHeader(u);renderView(u);
}
qsa("[data-view]").forEach(b=>b.onclick=()=>{
  qsa("[data-view]").forEach(x=>x.classList.remove("active"));b.classList.add("active");view=b.dataset.view;renderView(UNITS[unitIndex]);
});
qs("#closeDrawer").onclick=()=>qs("#lessonDrawer").hidden=true;
qs("#lessonDrawer").onclick=e=>{if(e.target.id==="lessonDrawer")e.currentTarget.hidden=true};
document.addEventListener("keydown",e=>{if(e.key==="Escape")qs("#lessonDrawer").hidden=true});
render();