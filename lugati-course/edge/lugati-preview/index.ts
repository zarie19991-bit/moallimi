import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")??"";
const SERVICE_ROLE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const db=createClient(SUPABASE_URL,SERVICE_ROLE,{auth:{persistSession:false}});
const PREVIEW_KEY="lugati-2026-preview-7f31c9a2b648";
const jsonHeaders={
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer"
};
const htmlHeaders={
  "Content-Type":"text/html; charset=utf-8",
  "Cache-Control":"no-store",
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer",
  "Content-Security-Policy":"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
};
const j=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:jsonHeaders});
const norm=(v:unknown)=>String(v??"").trim();
const unitName=(code:string)=>code==="U1"?"حقوق وواجبات":code==="U2"?"أعلام معاصرون":"أمن وازدهار";
function authorized(req:Request){
  const u=new URL(req.url);
  return u.searchParams.get("key")===PREVIEW_KEY;
}
function safeQuestion(q:any){
  return {id:q.id,prompt:q.prompt,context_text:q.context_text,options:Array.isArray(q.options)?q.options:[],cognitive_level:q.cognitive_level,difficulty:q.difficulty,point_key:q.point_key};
}
function eqAnswer(a:unknown,b:unknown){
  const av=Array.isArray(a)?a.map(norm):[norm(a)];
  const bv=Array.isArray(b)?b.map(norm):[norm(b)];
  return av.length===bv.length&&av.every((x,i)=>x===bv[i]);
}

async function catalog(){
  const {data:lessons,error:le}=await db.from("lessons")
    .select("id,code,title,unit_title,lesson_type,mastery_threshold,is_published")
    .or("code.like.U1-%,code.like.U2-%,code.like.U3-%")
    .order("code");
  if(le)throw le;
  const ids=(lessons||[]).map((x:any)=>x.id);
  const {data:blue,error:be}=await db.from("lesson_blueprints")
    .select("lesson_id,unit_code,lesson_order,estimated_minutes,difficulty,ready_for_publish,summary,assessment")
    .in("lesson_id",ids);
  if(be)throw be;
  const bm=new Map((blue||[]).map((x:any)=>[x.lesson_id,x]));
  const items=(lessons||[])
    .filter((l:any)=>!/-(00)$/.test(l.code))
    .map((l:any)=>({...l,...(bm.get(l.id)||{})}))
    .filter((l:any)=>["U1","U2","U3"].includes(l.unit_code))
    .sort((a:any,b:any)=>a.unit_code.localeCompare(b.unit_code)||Number(a.lesson_order)-Number(b.lesson_order));
  const units=["U1","U2","U3"].map(code=>({
    code,title:unitName(code),
    lessons:items.filter((x:any)=>x.unit_code===code).map((x:any)=>({
      code:x.code,title:x.title,lesson_type:x.lesson_type,order:x.lesson_order,
      minutes:x.estimated_minutes,difficulty:x.difficulty,ready:!!x.ready_for_publish,
      mastery:x.mastery_threshold,summary:x.summary,
      final:x.code.endsWith("-15")
    }))
  }));
  const {count:blockCount}=await db.from("lesson_micro_blocks").select("*",{count:"exact",head:true}).eq("active",true);
  const {count:qCount}=await db.from("course_question_bank").select("*",{count:"exact",head:true}).eq("active",true);
  return {units,stats:{lessons:items.length,blocks:blockCount||0,questions:qCount||0,mastery:85}};
}

async function lessonData(code:string){
  const {data:l,error:le}=await db.from("lessons").select("id,code,title,unit_title,lesson_type,mastery_threshold").eq("code",code).maybeSingle();
  if(le)throw le;if(!l)return null;
  const [{data:b,error:be},{data:blocks,error:me}]=await Promise.all([
    db.from("lesson_blueprints").select("summary,estimated_minutes,difficulty,objectives,prerequisites,learning_points,activities,resources,assessment,expected_outcome,ready_for_publish").eq("lesson_id",l.id).maybeSingle(),
    db.from("lesson_micro_blocks").select("point_key,block_order,block_type,title,body,payload,depth_note,remediation").eq("lesson_id",l.id).eq("active",true).order("block_order")
  ]);
  if(be)throw be;if(me)throw me;
  return {lesson:l,blueprint:b,blocks:blocks||[]};
}

async function questions(code:string,point:string){
  const {data:l,error:le}=await db.from("lessons").select("id").eq("code",code).maybeSingle();
  if(le)throw le;if(!l)return null;
  const {data:b}=await db.from("lesson_blueprints").select("assessment").eq("lesson_id",l.id).maybeSingle();
  const limit=point==="__final__"?Math.max(1,Number(b?.assessment?.itemCount||5)):3;
  const {data,error}=await db.from("course_question_bank")
    .select("id,point_key,prompt,context_text,options,cognitive_level,difficulty")
    .eq("lesson_id",l.id).eq("point_key",point).eq("active",true)
    .order("question_key").limit(limit);
  if(error)throw error;
  return {questions:(data||[]).map(safeQuestion),required:point==="__final__"?limit:Math.min(3,limit)};
}

async function answer(questionId:string,selectedIndex:number){
  const {data:q,error}=await db.from("course_question_bank")
    .select("options,correct_answer,feedback_correct,feedback_wrong,remediation_hint")
    .eq("id",questionId).eq("active",true).maybeSingle();
  if(error)throw error;if(!q)return null;
  const opts=Array.isArray(q.options)?q.options:[];
  if(!Number.isInteger(selectedIndex)||selectedIndex<0||selectedIndex>=opts.length)return {error:"invalid_selection"};
  const selected=opts[selectedIndex];
  const correct=eqAnswer(selected,q.correct_answer);
  const correctIndex=opts.findIndex((x:any)=>eqAnswer(x,q.correct_answer));
  return {
    correct,
    selected_index:selectedIndex,
    correct_index:correctIndex,
    feedback:correct?q.feedback_correct:q.feedback_wrong,
    remediation_hint:correct?null:q.remediation_hint
  };
}

const PAGE=String.raw`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>معاينة لغتي الخالدة — قبل النشر</title>
<style>
*{box-sizing:border-box}html{font-family:Tahoma,Arial,sans-serif;background:#f3f6f5;color:#183a32}body{margin:0}
.preview{background:#8a5c15;color:#fff;text-align:center;padding:8px;font-size:12px;font-weight:900}
header{background:#fff;border-bottom:1px solid #dfe8e4;position:sticky;top:0;z-index:20;padding:13px 18px}
.head{max-width:1280px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{display:flex;align-items:center;gap:10px}.mark{width:42px;height:42px;border-radius:14px;background:#0f7059;color:#fff;display:grid;place-items:center;font-size:22px;font-weight:900}.brand b,.brand small{display:block}.brand small{font-size:10px;color:#71817b;margin-top:3px}
.stats{display:flex;gap:7px;flex-wrap:wrap}.stat{background:#f1f6f4;border:1px solid #e1e9e6;border-radius:999px;padding:7px 10px;font-size:10px}.stat b{color:#11634f}
.shell{max-width:1280px;margin:18px auto 42px;padding:0 16px;display:grid;grid-template-columns:280px 1fr;gap:16px}
.side,.main{background:#fff;border:1px solid #dfe8e4;border-radius:21px;box-shadow:0 9px 22px #123e300b}
.side{padding:15px;height:calc(100vh - 125px);position:sticky;top:89px;overflow:auto}.side h3{font-size:11px;color:#75837e;margin:2px 3px 10px}
.units{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:12px}.unit{border:1px solid #dfe8e4;background:#f8faf9;border-radius:10px;padding:8px 5px;font-weight:900;font-size:10px;cursor:pointer}.unit.active{background:#0f6d57;color:#fff;border-color:#0f6d57}
.lesson-list{display:grid;gap:6px}.lesson{display:grid;grid-template-columns:30px 1fr auto;gap:8px;align-items:center;border:1px solid #e5ece9;background:#fff;border-radius:12px;padding:9px;cursor:pointer;text-align:right}.lesson:hover{background:#f5faf8}.lesson.active{background:#e8f6f1;border-color:#9dcfbe}.num{width:27px;height:27px;border-radius:8px;background:#edf2f0;display:grid;place-items:center;font-size:10px;font-weight:900}.lesson.active .num{background:#16745d;color:#fff}.lesson b{font-size:10px;line-height:1.6}.lesson small{font-size:8px;color:#80908a}.badge{font-size:8px;padding:4px 6px;border-radius:99px;background:#e9f7ef;color:#24704f}.badge.final{background:#fff1d7;color:#896214}
.main{padding:23px;min-height:720px}.crumb{font-size:10px;color:#1a755e;font-weight:900}.title-row{display:flex;justify-content:space-between;gap:15px;align-items:start}.title-row h1{font-size:29px;margin:5px 0 8px}.summary{color:#60716b;line-height:1.9;max-width:790px;margin:0}.meta{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.chip{background:#f1f6f4;border:1px solid #e0e9e5;border-radius:999px;padding:6px 9px;font-size:9px}
.goal{background:#eaf7f2;border:1px solid #cce5db;border-radius:16px;padding:14px;margin:16px 0}.goal b{font-size:11px}.goal ul{margin:8px 0 0;padding-right:18px;line-height:1.9;font-size:11px;color:#456258}
.points{display:flex;gap:7px;overflow:auto;padding:3px 0 10px}.point{white-space:nowrap;border:1px solid #dfe7e4;background:#fff;border-radius:10px;padding:8px 11px;font-size:10px;font-weight:900;cursor:pointer}.point.active{background:#173f35;color:#fff;border-color:#173f35}
.block{border:1px solid #dfe8e4;border-radius:18px;padding:19px;margin:10px 0;background:#fff}.block .kind{font-size:9px;color:#1c765f;font-weight:900}.block h2{font-size:21px;margin:6px 0}.block p{line-height:1.9;color:#4e655d;font-size:13px}.examples{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:12px}.example{background:#f7faf9;border:1px solid #e3eae7;border-radius:12px;padding:11px;text-align:center;font-size:11px}.depth{background:#fff8e3;border:1px solid #ead79e;border-radius:12px;padding:11px;margin-top:11px;font-size:11px;line-height:1.8}.actions{display:flex;justify-content:space-between;gap:9px;margin-top:16px}.btn{border:0;border-radius:11px;padding:11px 15px;font-weight:900;cursor:pointer}.primary{background:#126d57;color:#fff}.ghost{background:#fff;border:1px solid #dae5e1;color:#35564c}.wide{width:100%}
.quizbox{max-width:760px;margin:15px auto}.qhead{display:flex;justify-content:space-between;font-size:10px;color:#74847e;margin-bottom:8px}.context{background:#f8faf9;border:1px solid #e4ebe8;border-radius:14px;padding:13px;white-space:pre-line;font-size:12px;line-height:1.8;margin-bottom:10px}.question{font-size:16px;font-weight:900;line-height:1.8}.options{display:grid;gap:8px;margin-top:14px}.opt{border:1px solid #dce6e2;background:#fff;border-radius:12px;padding:12px;text-align:right;cursor:pointer;font-size:12px}.opt:hover{background:#f5faf8;border-color:#88bfaf}.opt.correct{background:#e8f7ef;border-color:#58aa80}.opt.wrong{background:#fff0ed;border-color:#d6857c}.feedback{margin-top:12px;border-radius:13px;padding:12px;font-size:12px;line-height:1.8}.feedback.ok{background:#e9f8ef;color:#1f684a}.feedback.no{background:#fff2df;color:#83541d}.result{text-align:center;padding:35px 18px}.result .score{font-size:46px;font-weight:900;color:#126d57}.result h2{margin:7px 0}.empty{padding:70px 15px;text-align:center;color:#7d8b86}.error{background:#fff0ee;border:1px solid #e5aaa4;color:#903f36;border-radius:14px;padding:13px}
@media(max-width:900px){.shell{grid-template-columns:1fr}.side{height:auto;position:static}.lesson-list{grid-template-columns:repeat(2,1fr)}.stats{display:none}}
@media(max-width:560px){.lesson-list{grid-template-columns:1fr}.head{align-items:flex-start;flex-direction:column}.main{padding:16px}.title-row{flex-direction:column}.title-row h1{font-size:25px}.units{position:sticky;top:0;background:#fff;padding:4px 0}.actions{flex-direction:column}}
</style>
</head>
<body>
<div class="preview">معاينة داخلية للمقرر الجديد — لم تُدمج في واجهة الطلاب المنشورة</div>
<header><div class="head"><div class="brand"><div class="mark">ل</div><div><b>لغتي الخالدة</b><small>ثالث متوسط · تعلم بالإتقان</small></div></div><div id="stats" class="stats"></div></div></header>
<div class="shell"><aside class="side"><h3>اختر الوحدة</h3><div id="units" class="units"></div><div id="lessonList" class="lesson-list"></div></aside><main id="main" class="main"><div class="empty">جارٍ تحميل المقرر…</div></main></div>
<script>
const KEY=new URL(location.href).searchParams.get('key')||'';
const ENDPOINT=location.pathname+'?key='+encodeURIComponent(KEY);
const S={catalog:null,unit:'U1',code:null,lesson:null,point:null,q:null,qi:0,score:0,answered:false,last:null};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(action,extra={}){
 const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||d.error)throw new Error(d.error||'تعذر الاتصال');
 return d;
}
function typeName(t){const m={'مدخل وحدة':'مدخل','استماع':'استماع','فهم قرائي':'قراءة','إستراتيجية قراءة':'استراتيجية','تحليل أدبي':'أدب','رسم إملائي':'إملاء','رسم كتابي':'خط','صنف لغوي':'صرف','أسلوب لغوي':'أسلوب','وظيفة نحوية':'نحو','إستراتيجية كتابة':'تخطيط','تواصل كتابي':'كتابة','تواصل شفهي':'تحدث','نص إثرائي':'إثراء','تقويم وحدة':'تقويم'};return m[t]||t}
function renderCatalog(){
 const units=S.catalog.units;
 $('#units').innerHTML=units.map(u=>'<button class="unit '+(u.code===S.unit?'active':'')+'" data-u="'+u.code+'">'+u.code.replace('U','الوحدة ')+'</button>').join('');
 document.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{S.unit=b.dataset.u;S.code=null;renderCatalog();const u=units.find(x=>x.code===S.unit);if(u?.lessons[0])openLesson(u.lessons[0].code)});
 const u=units.find(x=>x.code===S.unit);
 $('#lessonList').innerHTML=(u?.lessons||[]).map(l=>'<button class="lesson '+(l.code===S.code?'active':'')+'" data-code="'+l.code+'"><span class="num">'+String(l.order).padStart(2,'0')+'</span><span><b>'+esc(l.title)+'</b><small>'+typeName(l.lesson_type)+' · '+esc(l.minutes||'—')+' د</small></span><span class="badge '+(l.final?'final':'')+'">'+(l.final?'اختبار':'جاهز')+'</span></button>').join('');
 document.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>openLesson(b.dataset.code));
}
function payloadExamples(p){
 const ex=p?.examples;if(!Array.isArray(ex)||!ex.length)return'';
 return '<div class="examples">'+ex.map(x=>'<div class="example">'+(Array.isArray(x)?x.map(esc).join(' ← '):esc(x))+'</div>').join('')+'</div>';
}
function pointTitle(key){
 const p=S.lesson?.blueprint?.learning_points||[];
 return p.find(x=>x.key===key)?.title||key;
}
function renderLesson(){
 const d=S.lesson;if(!d)return;
 const b=d.blueprint||{},l=d.lesson||{};
 const points=(b.learning_points||[]).map(x=>x.key);
 if(!S.point&&points.length)S.point=points[0];
 const blocks=(d.blocks||[]).filter(x=>x.point_key===S.point);
 const isFinal=l.code?.endsWith('-15');
 let body='<div class="title-row"><div><span class="crumb">'+esc(l.unit_title||'')+' · '+esc(typeName(l.lesson_type))+'</span><h1>'+esc(l.title)+'</h1><p class="summary">'+esc(b.summary||'')+'</p></div></div>';
 body+='<div class="meta"><span class="chip">الزمن: '+esc(b.estimated_minutes||'—')+' دقيقة</span><span class="chip">الصعوبة: '+esc(b.difficulty||'—')+'</span><span class="chip">حد الإتقان: '+esc(l.mastery_threshold||85)+'%</span></div>';
 if(Array.isArray(b.objectives)&&b.objectives.length)body+='<section class="goal"><b>أهداف الدرس</b><ul>'+b.objectives.map(o=>'<li>'+esc(o.text||o)+'</li>').join('')+'</ul></section>';
 if(isFinal){
   body+='<section class="block"><span class="kind">تقويم الوحدة</span><h2>اختبار إتقان جديد</h2><p>أسئلة الاختبار منفصلة عن أسئلة التدريب وتغطي أهداف الوحدة. في هذه المعاينة لن تُحفظ النتيجة على حساب طالب.</p><button id="finalBtn" class="btn primary wide">ابدأ اختبار الوحدة</button></section>';
 }else{
   body+='<div class="points">'+points.map(k=>'<button class="point '+(k===S.point?'active':'')+'" data-p="'+k+'">'+esc(pointTitle(k))+'</button>').join('')+'</div>';
   body+=blocks.length?blocks.map(x=>'<article class="block"><span class="kind">'+esc(x.block_type)+'</span><h2>'+esc(x.title)+'</h2><p>'+esc(x.body)+'</p>'+payloadExamples(x.payload)+(x.depth_note?'<div class="depth"><b>تعمق أكثر</b><br>'+esc(x.depth_note)+'</div>':'')+'</article>').join(''):'<div class="empty">لا توجد كتلة محتوى لهذه النقطة.</div>';
   body+='<div class="actions"><button id="pointCheck" class="btn primary">تحقق من إتقان هذه النقطة</button><button id="lessonFinal" class="btn ghost">معاينة التقويم النهائي للدرس</button></div>';
 }
 if(b.expected_outcome)body+='<section class="goal"><b>الناتج المتوقع</b><div style="margin-top:7px;font-size:11px;line-height:1.8">'+esc(b.expected_outcome)+'</div></section>';
 $('#main').innerHTML=body;
 document.querySelectorAll('[data-p]').forEach(x=>x.onclick=()=>{S.point=x.dataset.p;renderLesson()});
 $('#pointCheck')?.addEventListener('click',()=>startQuiz(S.point));
 $('#lessonFinal')?.addEventListener('click',()=>startQuiz('__final__'));
 $('#finalBtn')?.addEventListener('click',()=>startQuiz('__final__'));
}
async function openLesson(code){
 try{
  S.code=code;S.point=null;renderCatalog();
  $('#main').innerHTML='<div class="empty">جارٍ تحميل الدرس…</div>';
  S.lesson=await api('lesson',{code});renderLesson();
 }catch(e){$('#main').innerHTML='<div class="error">'+esc(e.message)+'</div>'}
}
async function startQuiz(point){
 try{
   const d=await api('questions',{code:S.code,point_key:point});
   S.q=d.questions||[];S.qi=0;S.score=0;S.answered=false;S.last=null;
   if(!S.q.length){$('#main').innerHTML='<div class="error">هذا الدرس يعتمد مهمة أداء بروبرك في التقويم النهائي، ولا يوجد اختبار آلي نهائي.</div><div class="actions"><button id="backLesson" class="btn ghost">العودة للدرس</button></div>';$('#backLesson').onclick=renderLesson;return}
   renderQuestion();
 }catch(e){$('#main').innerHTML='<div class="error">'+esc(e.message)+'</div>'}
}
function renderQuestion(){
 const q=S.q[S.qi];if(!q){renderResult();return}
 let h='<div class="quizbox"><div class="qhead"><span>السؤال '+(S.qi+1)+' من '+S.q.length+'</span><span>'+esc(q.cognitive_level)+' · '+esc(q.difficulty)+'</span></div>';
 if(q.context_text)h+='<div class="context">'+esc(q.context_text)+'</div>';
 h+='<div class="question">'+esc(q.prompt)+'</div><div class="options">'+(q.options||[]).map((o,i)=>'<button class="opt" data-i="'+i+'">'+(['أ','ب','ج','د'][i]||i+1)+') '+esc(o)+'</button>').join('')+'</div><div id="fb"></div><div class="actions"><button id="backLesson" class="btn ghost">العودة للدرس</button><button id="nextQ" class="btn primary" style="display:none">'+(S.qi===S.q.length-1?'النتيجة':'التالي')+'</button></div></div>';
 $('#main').innerHTML=h;
 $('#backLesson').onclick=renderLesson;
 document.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>submitAnswer(Number(b.dataset.i)));
 $('#nextQ').onclick=()=>{S.qi++;S.answered=false;S.last=null;renderQuestion()};
}
async function submitAnswer(i){
 if(S.answered)return;S.answered=true;
 try{
   const d=await api('answer',{question_id:S.q[S.qi].id,selected_index:i});S.last=d;if(d.correct)S.score++;
   const opts=[...document.querySelectorAll('.opt')];opts.forEach(x=>x.disabled=true);
   opts[i]?.classList.add(d.correct?'correct':'wrong');if(!d.correct&&d.correct_index>=0)opts[d.correct_index]?.classList.add('correct');
   $('#fb').innerHTML='<div class="feedback '+(d.correct?'ok':'no')+'"><b>'+(d.correct?'إجابة صحيحة ✓':'تحتاج مراجعة')+'</b><br>'+esc(d.feedback||'')+(d.remediation_hint?'<br><b>تلميح علاجي:</b> '+esc(d.remediation_hint):'')+'</div>';
   $('#nextQ').style.display='inline-block';
 }catch(e){S.answered=false;$('#fb').innerHTML='<div class="error">'+esc(e.message)+'</div>'}
}
function renderResult(){
 const total=S.q.length,pct=total?Math.round(S.score*100/total):0,pass=pct>=67;
 $('#main').innerHTML='<div class="result"><div class="score">'+pct+'%</div><h2>'+(pass?'أثبتَّ فهمًا جيدًا في المعاينة':'تحتاج مراجعة هذه النقطة')+'</h2><p>أجبت إجابة صحيحة عن '+S.score+' من '+total+'. في النظام الفعلي معيار النقطة 2 من 3، ومعيار الدرس 85% مع عدم هبوط الهدف الأساسي عن 80%.</p><div class="actions" style="justify-content:center"><button id="again" class="btn primary">محاولة جديدة</button><button id="back" class="btn ghost">العودة للدرس</button></div></div>';
 $('#again').onclick=()=>startQuiz(S.q[0]?.point_key||S.point);$('#back').onclick=renderLesson;
}
async function init(){
 try{
  S.catalog=await api('catalog');
  const st=S.catalog.stats;$('#stats').innerHTML='<span class="stat"><b>'+st.lessons+'</b> درسًا/تقويمًا</span><span class="stat"><b>'+st.blocks+'</b> كتلة تعلم</span><span class="stat"><b>'+st.questions+'</b> سؤالًا</span><span class="stat"><b>'+st.mastery+'%</b> حد الإتقان</span>';
  renderCatalog();const first=S.catalog.units[0]?.lessons[0];if(first)openLesson(first.code);
 }catch(e){$('#main').innerHTML='<div class="error">'+esc(e.message)+'</div>'}
}
init();
</script>
</body></html>`;

Deno.serve(async(req)=>{
  if(!authorized(req))return new Response("Preview link is invalid or expired.",{status:403,headers:{"Content-Type":"text/plain; charset=utf-8"}});
  if(req.method==="GET")return new Response(PAGE,{headers:htmlHeaders});
  if(req.method!=="POST")return j({error:"method_not_allowed"},405);
  try{
    const body=await req.json().catch(()=>({}));
    const action=norm(body.action);
    if(action==="catalog")return j(await catalog());
    if(action==="lesson"){
      const code=norm(body.code).toUpperCase();
      const d=await lessonData(code);return d?j(d):j({error:"lesson_not_found"},404);
    }
    if(action==="questions"){
      const code=norm(body.code).toUpperCase(),point=norm(body.point_key);
      const d=await questions(code,point);return d?j(d):j({error:"lesson_not_found"},404);
    }
    if(action==="answer"){
      const d=await answer(norm(body.question_id),Number(body.selected_index));
      if(!d)return j({error:"question_not_found"},404);
      if((d as any).error)return j(d,400);
      return j(d);
    }
    return j({error:"unknown_action"},400);
  }catch(e){
    console.error(e);
    return j({error:"preview_server_error"},500);
  }
});