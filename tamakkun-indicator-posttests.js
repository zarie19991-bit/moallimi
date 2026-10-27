(()=>{
"use strict";
const API="https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/tamakkun-student-monitor";
const S={host:null,token:null,tests:[],active:null,questions:[],answers:{},busy:false};
const esc=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const date=v=>v?new Date(v).toLocaleString("ar-SA",{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Riyadh"}):"—";
const subj=v=>({reading:"القراءة",math:"الرياضيات",science:"العلوم"})[v]||v;
async function api(action,payload={}){
 const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+S.token},body:JSON.stringify({action,...payload})});
 const d=await r.json().catch(()=>({error:"استجابة غير مفهومة من خادم القياس."}));
 if(!r.ok||d.ok!==true)throw Error(d.error||"تعذّر فتح القياس.");
 return d;
}
function frame(content){
 if(!S.host)return;
 S.host.innerHTML='<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;text-align:right" class="space-y-5 pb-10">'+
 '<section class="p-6 sm:p-8 rounded-3xl text-white" style="background:linear-gradient(120deg,#083d31,#087758)"><div class="text-xs font-bold text-emerald-100">تمكّن • قياس أثر التدخل</div><h1 class="text-2xl font-black mt-2">الاختبارات البعدية لكل مؤشر</h1><p class="text-sm text-emerald-100 mt-2">أسئلة جديدة بعد إكمال خطة التعلم. نتيجتك هنا مستقلة عن درجة ورقة العمل.</p></section>'+content+'</div>';
}
function list(){
 const data=S.tests||[];
 const stats=[["الاختبارات المسندة",data.length],["بانتظار الحل",data.filter(x=>x.status==="assigned").length],["قيد الحل",data.filter(x=>x.status==="in_progress").length],["المكتملة",data.filter(x=>x.status==="completed").length]];
 const summary='<div class="grid grid-cols-2 md:grid-cols-4 gap-3">'+stats.map(x=>'<div class="bg-white rounded-2xl border p-4"><small class="text-slate-500">'+esc(x[0])+'</small><b class="block text-xl text-emerald-800">'+x[1]+'</b></div>').join("")+'</div>';
 const cards=data.length?data.map(t=>'<article class="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"><div><small class="text-emerald-700 font-black">'+esc(subj(t.subject_key))+' • المؤشر '+esc(t.indicator_index)+'</small><h2 class="font-black text-slate-900 mt-1">'+esc(t.indicator_text||"المؤشر")+'</h2><div class="text-xs text-slate-500 mt-2">تاريخ الإسناد: '+date(t.assigned_at)+' · حالة الاختبار: '+esc(t.status==="completed"?"مكتمل":t.status==="in_progress"?"قيد الحل":"لم يبدأ")+'</div>'+
 (t.status==="completed"?'<div class="font-bold text-emerald-700 mt-2">الدرجة: '+esc(t.score)+' من '+esc(t.total)+' · '+esc(t.percent)+'%</div>':'')+'</div><button data-test-id="'+esc(t.id)+'" class="rounded-xl px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm">'+(t.status==="completed"?"عرض النتيجة":t.status==="in_progress"?"متابعة القياس":"بدء القياس البعدي")+'</button></article>').join(""):'<section class="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-600">لا يوجد اختبار بعدي مسند إلى حسابك حاليًا. يُسنده المعلم بعد إكمال ورقة العمل.</section>';
 frame(summary+'<div class="flex justify-between items-center gap-4"><b class="text-lg">الاختبارات المسندة</b><button id="post-reload" class="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold">تحديث</button></div><div class="space-y-3">'+cards+'</div>');
 S.host.querySelector("#post-reload").onclick=load;
 S.host.querySelectorAll("[data-test-id]").forEach(b=>b.onclick=()=>open(b.dataset.testId));
}
function questions(){
 if(!S.active)return list();
 const d=S.active;
 const content='<section class="bg-white border border-slate-200 rounded-2xl p-5"><div class="flex justify-between items-center gap-3"><div><small class="font-black text-emerald-700">'+esc(subj(d.test.subject_key))+'</small><h2 class="font-black mt-2 text-lg">'+esc(d.test.indicator_text||"المؤشر")+'</h2></div><button id="post-back" class="px-3 py-2 bg-slate-100 text-slate-700 text-xs rounded-lg">رجوع للقائمة</button></div><p class="text-xs text-slate-600 mt-4">أجب عن الأسئلة الخمسة جميعها، ثم اضغط تسليم الاختبار. لا تُعرض الإجابات الصحيحة قبل التسليم.</p></section>'+
 S.questions.map((q,i)=>'<section class="bg-white rounded-2xl border border-slate-200 p-5"><b class="text-sm text-emerald-700">السؤال '+(i+1)+' من '+S.questions.length+'</b>'+
 (q.context_text?'<div class="p-4 rounded-xl bg-amber-50 text-slate-800 text-sm leading-8 mt-3" style="white-space:pre-wrap">'+esc(q.context_text)+'</div>':'')+
 '<h3 class="text-base font-black text-slate-900 mt-4 mb-4 leading-8">'+esc(q.question_text||"")+'</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-3">'+
 (Array.isArray(q.options)?q.options.map((value,j)=>'<label class="block p-4 border rounded-xl cursor-pointer hover:bg-emerald-50 text-sm leading-7 '+(S.answers[q.id]===j?'border-emerald-600 bg-emerald-50 font-bold':'border-slate-200')+'"><input type="radio" name="post-q-'+esc(q.id)+'" data-question="'+esc(q.id)+'" data-choice="'+j+'" '+(S.answers[q.id]===j?"checked":"")+' class="ml-2" />'+["أ","ب","ج","د"][j]+'. '+esc(value)+'</label>').join(""):"")+'</div></section>').join("")+
 '<section class="bg-white border rounded-2xl p-5 flex justify-between items-center gap-3"><small id="post-answered" class="font-bold text-slate-500">تمت الإجابة عن '+Object.keys(S.answers).length+' من '+S.questions.length+'</small><button id="post-submit" class="px-6 py-3 rounded-xl bg-emerald-700 text-white font-black">تسليم الاختبار وحفظ النتيجة</button></section>';
 frame(content);
 S.host.querySelector("#post-back").onclick=()=>{S.active=null;S.questions=[];S.answers={};list()};
 S.host.querySelectorAll("[data-question]").forEach(x=>x.onchange=()=>{
  const id=x.dataset.question;S.answers[id]=Number(x.dataset.choice);
  S.host.querySelector("#post-answered").textContent="تمت الإجابة عن "+Object.keys(S.answers).length+" من "+S.questions.length;
 });
 S.host.querySelector("#post-submit").onclick=submit;
}
function result(data){
 frame('<section class="bg-white border rounded-2xl p-8 text-center"><small class="font-bold text-emerald-700">تم تسليم القياس البعدي وحفظ النتيجة</small><h2 class="text-4xl text-emerald-800 font-black my-5">'+esc(data.score)+' / '+esc(data.total)+'</h2><p class="text-lg font-bold">'+esc(data.percent)+'%</p><p class="text-sm text-slate-500 my-3">'+(Number(data.percent)>=80?"بلغت ٨٠٪ في القياس البعدي. اعتماد إتقان المهارة النهائي يصدر من المعلم بعد مراجعة التنفيذ والنتيجة.":"هذه النتيجة تشير إلى استمرار الحاجة للتدريب والمتابعة.")+'</p><button id="post-home" class="bg-emerald-700 text-white rounded-xl py-3 px-6 font-black mt-3">العودة إلى الاختبارات</button></section>');
 S.host.querySelector("#post-home").onclick=()=>{S.active=null;load()};
}
async function load(){
 if(!S.token||S.busy)return;S.busy=true;
 frame('<div class="bg-white rounded-2xl p-6">جارٍ جلب الاختبارات البعدية المسندة…</div>');
 try{const d=await api("posttest_list");S.tests=d.tests||[];S.active=null;list()}
 catch(e){frame('<div class="bg-white border rounded-2xl p-6">'+esc(e.message)+' <button id="post-retry">إعادة المحاولة</button></div>');const b=S.host.querySelector("#post-retry");if(b)b.onclick=load}
 finally{S.busy=false}
}
async function open(id){
 if(S.busy)return;S.busy=true;
 try{
  const d=await api("posttest_open",{test_id:id});
  if(d.completed){result(d);return}
  S.active=d;S.questions=d.questions||[];S.answers={};questions()
 }catch(e){alert(e.message)}
 finally{S.busy=false}
}
async function submit(){
 if(S.busy||!S.active)return;
 if(Object.keys(S.answers).length!==S.questions.length){alert("أجب عن جميع الأسئلة قبل التسليم.");return}
 if(!confirm("هل تريد تسليم الإجابات وحفظ درجة الاختبار البعدي؟"))return;
 S.busy=true;const b=S.host.querySelector("#post-submit");if(b){b.disabled=true;b.textContent="جارٍ التصحيح والحفظ…"}
 try{const d=await api("posttest_submit",{test_id:S.active.test.id,answers:S.answers});result(d);S.answers={}}
 catch(e){alert(e.message);if(b){b.disabled=false;b.textContent="تسليم الاختبار وحفظ النتيجة"}}
 finally{S.busy=false}
}
window.TamakkunIndicatorPosttests={mount({token,role}={}){if(role!=="student")return;const host=document.getElementById("tamakkunStudentPosttestMount");if(!host)return;S.host=host;S.token=token;load()},unmount(){S.host=null;S.token=null;S.tests=[];S.active=null;S.answers={}}};
})();