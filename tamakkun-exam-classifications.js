/* تمكّن: تصنيف الطلاب لكل اختبار — 50 / 80 */
(()=>{
"use strict";
const API="https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/tamakkun-exam-classifications";
const labels={all:"الكل",remedial:"علاجي",reinforcement:"تعزيز",enrichment:"إثرائي",unmeasured:"لم يُقَس"};
const A={host:null,tests:[],detail:null,testId:"",scope:"",filter:"all",loading:false,sending:false,error:"",notice:"",ready:false,query:""};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=n=>n==null||!Number.isFinite(Number(n))?"—":new Intl.NumberFormat("ar-SA",{maximumFractionDigits:2}).format(Number(n));
const date=s=>s?new Date(s).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"}):"—";
const sub=s=>s==="reading"?"القراءة":s==="math"?"الرياضيات":s==="science"?"العلوم":"—";
function getToken(){try{return JSON.parse(sessionStorage.getItem("lugati_exact_session_v2")||"null")?.token||""}catch{return""}}
async function api(action,payload={}){
 const t=getToken();if(!t)throw Error("جلسة المعلم غير متاحة. سجّل الدخول مجددًا.");
 const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({action,...payload}),cache:"no-store"});
 const data=await res.json().catch(()=>({error:"تعذر قراءة استجابة الخادم."}));
 if(!res.ok||data.error)throw Error(data.error||"تعذر قراءة نتائج الاختبار.");
 return data;
}
function style(){
 if(document.getElementById("tkc-style"))return;
 const e=document.createElement("style");e.id="tkc-style";
 e.textContent='.tkc{font-family:Tajawal,Tahoma,Arial,sans-serif;color:#173d30;direction:rtl;display:grid;gap:19px;padding-bottom:60px}.tkc *{box-sizing:border-box}.tkc-hero{border-radius:30px;background:radial-gradient(circle at 10% 35%,#ffffff24,transparent 33%),linear-gradient(110deg,#063e34,#087458 70%,#0c9b7b);color:white;padding:32px;box-shadow:0 20px 44px #07543b29}.tkc-hero h1{font-weight:950;color:#fff!important;font-size:clamp(24px,3vw,35px);margin:13px 0 5px}.tkc-hero p{font-size:13px;color:#e5fff4;line-height:1.9;margin:0}.tkc-tag{font-size:11px;font-weight:900;color:#fff;padding:7px 13px;border-radius:30px;background:#ffffff1e;border:1px solid #ffffff37}.tkc-box{border:1px solid #ddeae0;background:#fff;padding:22px;border-radius:23px;box-shadow:0 10px 26px #0b543010}.tkc-controls{display:grid;grid-template-columns:2fr 1.2fr 1.1fr auto;gap:11px;align-items:end}.tkc label{display:block;font-size:12px;font-weight:900;color:#456653;margin-bottom:6px}.tkc select,.tkc input{width:100%;background:#f8fbf8;color:#214735;border:1px solid #cbded2;border-radius:12px;min-height:45px;padding:11px 12px;font-size:12px;outline:0}.tkc select:focus,.tkc input:focus{border-color:#068f6a;box-shadow:0 0 0 3px #d8f6e4}.tkc button{font-family:inherit;cursor:pointer}.tkc button:disabled{opacity:.45;cursor:not-allowed}.tkc-btn{min-height:45px;border:0;border-radius:12px;padding:11px 17px;background:#08785b;color:#fff;font-weight:900;font-size:12px}.tkc-btn.alt{background:#ebf7ef;border:1px solid #cee6d9;color:#0b7056}.tkc-btn.paper{background:white;border:1px solid #cde0d4;color:#116e55}.tkc-btn:hover:not(:disabled){filter:brightness(.95)}.tkc-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.tkc-stat{background:#fff;border:1px solid #dde9df;border-top:4px solid #9bbfb0;border-radius:19px;padding:17px;box-shadow:0 8px 20px #155b2810}.tkc-stat b{font-size:30px;display:block;font-weight:950;margin:7px 0;color:#1a4c35}.tkc-stat span,.tkc-stat small{display:block;font-weight:800;font-size:11px;color:#68816f}.tkc-stat.remedial{border-top-color:#e36a7c}.tkc-stat.reinforcement{border-top-color:#eaa83c}.tkc-stat.enrichment{border-top-color:#239b66}.tkc-stat.unmeasured{border-top-color:#a9b5bb}.tkc-heading{display:flex;justify-content:space-between;align-items:center;gap:15px;flex-wrap:wrap;margin-bottom:15px}.tkc-heading h2{font-size:20px;font-weight:950;margin:0}.tkc-heading p{font-size:12px;color:#688474;margin:6px 0 0}.tkc-tabs{display:flex;gap:7px;flex-wrap:wrap}.tkc-tab{background:#f5f9f6;border:1px solid #d8e8df;border-radius:12px;color:#375f4b;font-size:12px;font-weight:900;padding:10px 14px}.tkc-tab.active{background:#087558;border-color:#087558;color:#fff}.tkc-tablebox{border:1px solid #e0eae2;border-radius:15px;overflow:auto;margin-top:15px}.tkc-table{border-collapse:collapse;width:100%;min-width:690px;font-size:12px}.tkc-table th{background:#eff7f2;text-align:right;color:#315a43;padding:14px 11px;white-space:nowrap}.tkc-table td{padding:12px 11px;border-top:1px solid #e7eee8}.tkc-table tr:hover td{background:#f9fcfa}.tkc-pill{border-radius:20px;font-weight:900;font-size:11px;padding:6px 11px;display:inline-block}.tkc-pill.remedial{background:#ffe6ed;color:#a53852}.tkc-pill.reinforcement{background:#fff3d8;color:#8b5e14}.tkc-pill.enrichment{background:#e1f6e9;color:#0b7146}.tkc-pill.unmeasured{background:#edf0f3;color:#5d6a77}.tkc-actions{border-top:1px solid #e5efe7;padding-top:15px;margin-top:18px;display:flex;gap:9px;align-items:center;flex-wrap:wrap}.tkc-note{font-size:12px;color:#748779;line-height:1.75}.tkc-message{font-size:12px;line-height:1.9;color:#72551f;background:#fff7e9;border:1px solid #f1dcba;border-radius:15px;padding:14px}.tkc-message.error{color:#a12b41;background:#fff0f3;border-color:#f0c8d1}.tkc-message.ok{color:#147551;background:#edfaf2;border-color:#c6e7d3}.tkc-blank{text-align:center;padding:55px 10px;font-size:13px;color:#668071}.tkc-top-buttons{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:1050px){.tkc-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.tkc-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:640px){.tkc-controls{grid-template-columns:1fr}.tkc-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.tkc-box{padding:15px}.tkc-hero{padding:25px 19px}.tkc-stat b{font-size:25px}.tkc-tab{padding:8px}.tkc-actions .tkc-btn{width:100%}}';
 document.head.appendChild(e);
}
function draw(){
 if(!A.host?.isConnected)return;
 const d=A.detail,c=d?.counts||{},ps=d?.percentages||{},all=d?.rows||[],filtered=all.filter(x=>A.filter==="all"||x.classification===A.filter),needle=A.query.trim().toLowerCase(),shown=filtered.filter(x=>!needle||String(x.student_name).toLowerCase().includes(needle)||String(x.class_name).toLowerCase().includes(needle));
 const options=A.tests.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===A.testId?'selected':'')+'>'+esc(x.title)+' • '+esc(date(x.date))+'</option>').join("");
 const scopes=(d?.scopes||[]).map(x=>'<option value="'+esc(x.key)+'" '+(x.key===d.scope?'selected':'')+'>'+esc(x.label)+'</option>').join("");
 A.host.innerHTML='<div class="tkc">'+
 '<section class="tkc-hero"><span class="tkc-tag">تقرير تشخيصي • من نتائج الاختبارات الفعلية</span><h1>تصنيف الطلاب بعد كل اختبار</h1><p>علاجي أقل من 50%، تعزيز من 50% إلى أقل من 80%، إثرائي من 80% فأعلى. غير المختبر خارج فئات الأداء.</p></section>'+
 '<section class="tkc-box"><div class="tkc-controls">'+
 '<div><label for="tkc-test">اختر الاختبار</label><select id="tkc-test" '+(A.loading?'disabled':'')+'><option value="">اختر اختبارًا منشورًا</option>'+options+'</select></div>'+
 '<div><label for="tkc-scope">التصنيف حسب</label><select id="tkc-scope" '+(!d||A.loading?'disabled':'')+'>'+scopes+'</select></div>'+
 '<div><label for="tkc-search">بحث عن طالب</label><input id="tkc-search" value="'+esc(A.query)+'" placeholder="اسم الطالب أو الفصل" /></div>'+
 '<button id="tkc-reload" class="tkc-btn alt" '+(A.loading?'disabled':'')+'>↻ تحديث</button></div></section>'+
 (A.error?'<div class="tkc-message error">'+esc(A.error)+' <button id="tkc-retry" class="tkc-btn alt">إعادة المحاولة</button></div>':'')+
 (A.notice?'<div class="tkc-message ok">'+esc(A.notice)+'</div>':'')+
 (A.loading?'<section class="tkc-box tkc-blank">جارٍ قراءة أسماء الطلاب ونتائج الاختبار…</section>':
 !d?'<section class="tkc-box tkc-blank">اختر أحد الاختبارات لعرض التصنيف التلقائي.</section>':
 '<section class="tkc-stats">'+[
 ["المختبرون",c.tested,"من لديهم درجة فعلية","tested"],
 ["لم يُقَس",c.unmeasured,"لا يدخل ضمن فئات الأداء","unmeasured"],
 ["علاجي",c.remedial,num(ps.remedial)+"% من المختبرين","remedial"],
 ["تعزيز",c.reinforcement,num(ps.reinforcement)+"% من المختبرين","reinforcement"],
 ["إثرائي / متقن",c.enrichment,num(ps.enrichment)+"% من المختبرين","enrichment"]
 ].map(x=>'<div class="tkc-stat '+x[3]+'"><span>'+x[0]+'</span><b>'+num(x[1])+'</b><small>'+x[2]+'</small></div>').join("")+'</section>'+
 '<section class="tkc-box"><div class="tkc-heading"><div><h2>أسماء الطلاب ودرجاتهم</h2><p>'+esc(d.test.title)+' · '+esc((d.test.subject_keys||[]).map(sub).join("، "))+' · '+esc(d.test.grade)+' · '+esc(date(d.test.date))+'</p></div><span class="tkc-note">'+num(shown.length)+' من '+num(all.length)+' طالب</span></div>'+
 '<div class="tkc-tabs">'+["all","remedial","reinforcement","enrichment","unmeasured"].map(k=>'<button class="tkc-tab '+(k===A.filter?'active':'')+'" data-tkc-filter="'+k+'">'+labels[k]+' ('+num(k==="all"?all.length:c[k]||0)+')</button>').join("")+'</div>'+
 '<div class="tkc-tablebox"><table class="tkc-table"><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الدرجة</th><th>الدرجة الكلية</th><th>النسبة</th><th>التصنيف</th></tr></thead><tbody>'+
 (shown.length?shown.map((r,i)=>'<tr><td>'+num(i+1)+'</td><td><b>'+esc(r.student_name)+'</b></td><td>'+esc(r.class_name||"—")+'</td><td>'+(r.tested?num(r.score):"—")+'</td><td>'+(r.tested?num(r.total):"—")+'</td><td>'+(r.tested?num(r.percent)+"%":"—")+'</td><td><span class="tkc-pill '+r.classification+'">'+labels[r.classification]+'</span></td></tr>').join(""):'<tr><td colspan="7" class="tkc-blank">لا توجد أسماء في هذا التصنيف.</td></tr>')+
 '</tbody></table></div><div class="tkc-actions"><button class="tkc-btn" id="tkc-assign" '+(A.sending||!["remedial","reinforcement","enrichment"].includes(A.filter)||!filtered.length?'disabled':'')+'>'+(A.sending?"جارٍ إسناد الخطط…":"إسناد خطة للفئة: "+(labels[A.filter]||"اختر فئة"))+'</button><button class="tkc-btn paper" id="tkc-print">طباعة PDF</button><span class="tkc-note">إسناد الطلاب المقاسين فقط؛ وطباعتها تتم من نافذة حفظ PDF.</span></div></section>'+
 '<div class="tkc-message">الغائب ومن لم يسلّم الاختبار لا يُصنّف علاجيًا. وعند اختيار مؤشر لا يُحتسب الطالب إلا إذا ظهر له قياس فعلي في المؤشر نفسه.</div>')+
 '</div>';wire();
}
function wire(){
 if(!A.host?.isConnected)return;
 const $=id=>A.host.querySelector("#"+id);
 const t=$("tkc-test");if(t)t.onchange=()=>{A.testId=t.value;A.scope="";A.filter="all";A.query="";loadDetail()};
 const s=$("tkc-scope");if(s)s.onchange=()=>{A.scope=s.value;A.filter="all";loadDetail()};
 const q=$("tkc-search");if(q)q.oninput=()=>{A.query=q.value;const pos=q.selectionStart;draw();const r=$("tkc-search");r?.focus();r?.setSelectionRange(pos,pos)};
 const b=$("tkc-reload");if(b)b.onclick=()=>A.testId?loadDetail():loadList(true);
 const z=$("tkc-retry");if(z)z.onclick=()=>A.testId?loadDetail():loadList(true);
 A.host.querySelectorAll("[data-tkc-filter]").forEach(b=>b.onclick=()=>{A.filter=b.dataset.tkcFilter;A.notice="";draw()});
 const a=$("tkc-assign");if(a)a.onclick=assign;
 const p=$("tkc-print");if(p)p.onclick=print;
}
async function loadList(force=false){
 if(A.loading)return;if(A.ready&&!force){draw();return}
 A.loading=true;A.error="";draw();
 try{const r=await api("list");A.tests=Array.isArray(r.tests)?r.tests:[];A.ready=true;if(!A.tests.some(x=>x.id===A.testId))A.testId=A.tests[0]?.id||"";A.scope="";A.filter="all"}
 catch(e){A.error=e.message||"تعذر تحميل الاختبارات";A.detail=null}
 finally{A.loading=false;draw()}
 if(A.testId&&!A.error)await loadDetail();
}
async function loadDetail(){
 if(A.loading)return;if(!A.testId){A.detail=null;draw();return}
 A.loading=true;A.error="";A.notice="";draw();
 try{A.detail=await api("detail",{test_id:A.testId,scope:A.scope});A.scope=A.detail.scope}
 catch(e){A.detail=null;A.error=e.message||"تعذر تحميل نتائج الاختبار"}
 finally{A.loading=false;draw()}
}
async function assign(){
 const d=A.detail,tier=A.filter;if(!d||!["remedial","reinforcement","enrichment"].includes(tier)||A.sending)return;
 const count=d.counts[tier]||0;if(!count)return;
 if(!confirm("هل تريد إسناد خطة "+labels[tier]+" إلى "+num(count)+" طالبًا ممن قيسوا في الاختبار «"+d.test.title+"»؟\nلن يتلقى الطالب غير المختبر خطة."))return;
 A.sending=true;A.error="";A.notice="";draw();
 try{const r=await api("assign",{test_id:A.testId,scope:d.scope,tier});A.notice=(r.message||"تمت العملية.")+" أُرسلت: "+num(r.sent||0)+"؛ مكررة: "+num(r.skipped||0)+"؛ لا توجد أسئلة أو مؤشر مطابق: "+num(r.unavailable||0)+"."}
 catch(e){A.error=e.message||"تعذر إسناد الخطط"}
 finally{A.sending=false;draw()}
}
function print(){
 const d=A.detail;if(!d)return;const w=window.open("","_blank","width=1100,height=850");if(!w){alert("اسمح بفتح نافذة جديدة ثم اطبع التقرير.");return}
 const c=d.counts,p=d.percentages,r=d.rows.filter(x=>A.filter==="all"||x.classification===A.filter);
 const table=r.map((s,i)=>'<tr><td>'+num(i+1)+'</td><td>'+esc(s.student_name)+'</td><td>'+esc(s.class_name)+'</td><td>'+(s.tested?num(s.score):"—")+'</td><td>'+(s.tested?num(s.total):"—")+'</td><td>'+(s.tested?num(s.percent)+"%":"—")+'</td><td>'+labels[s.classification]+'</td></tr>').join("");
 const style='@page{size:A4;margin:11mm}body{font-family:Tahoma,Arial,sans-serif;color:#19362b;font-size:10pt}h1{color:#056849;border-bottom:3px solid #056849;padding-bottom:8px;font-size:20pt}.meta,.summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.meta span,.summary b{border:1px solid #d9e7de;background:#f2f8f4;padding:8px;flex:1;min-width:130px}.summary b{text-align:center}.summary em{display:block;font-style:normal;color:#087858;font-size:16pt}table{width:100%;border-collapse:collapse;font-size:8.5pt}th,td{border:1px solid #d9e2db;padding:6px;text-align:right}th{background:#e2f0e8}tr{break-inside:avoid}thead{display:table-header-group}.note{font-size:8.5pt;color:#586b5e;margin-top:14px}';
 w.document.open();w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير تصنيف الطلاب</title><style>'+style+'</style></head><body><small>مِنَصَّةُ تَمَكُّن · التقرير الفعلي</small><h1>'+esc(d.test.title)+'</h1><p>'+esc(d.scopes.find(x=>x.key===d.scope)?.label||"")+' · الفئة: '+labels[A.filter]+'</p><div class="meta"><span>المادة: '+esc(d.test.subject_keys.map(sub).join("، "))+'</span><span>الصف: '+esc(d.test.grade)+'</span><span>الفصول: '+esc(d.test.class_name)+'</span><span>تاريخ الاختبار (النشر): '+esc(date(d.test.date))+'</span></div><div class="summary"><b>المختبرون<em>'+num(c.tested)+'</em></b><b>لم يُقَس<em>'+num(c.unmeasured)+'</em></b><b>علاجي<em>'+num(c.remedial)+'</em></b><b>تعزيز<em>'+num(c.reinforcement)+'</em></b><b>إثرائي<em>'+num(c.enrichment)+'</em></b></div><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الدرجة</th><th>الدرجة الكلية</th><th>النسبة</th><th>التصنيف</th></tr></thead><tbody>'+table+'</tbody></table><p class="note">نسب المختبرين فقط: علاجي '+num(p.remedial)+'%، تعزيز '+num(p.reinforcement)+'%، إثرائي '+num(p.enrichment)+'%. الغائب وغير المختبر لا يُصنّف أكاديميًا.</p></body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),350);
}
window.TamakkunClassifications={mount(view){const host=view?.querySelector("#tamakkunClassificationMount");if(!host)return;A.host=host;style();draw();if(!A.ready)loadList();else if(!A.detail||A.detail.test.id!==A.testId)loadDetail()}};
})();