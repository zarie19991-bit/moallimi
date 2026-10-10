/* تمكّن: تصنيف الطلاب لكل اختبار — 50 / 80 */
(()=>{
"use strict";
const API="https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/tamakkun-exam-classifications";
const labels={all:"الكل",remedial:"علاجي",reinforcement:"تعزيز",enrichment:"إثرائي",unmeasured:"لم يُقَس"};
const A={host:null,tests:[],detail:null,testId:"",scope:"",filter:"all",loading:false,sending:false,error:"",notice:"",ready:false,query:"",groupKeys:[],groupOpen:false,statusFilter:"all",letterSchool:"مدرسة ابن سينا المتوسطة",letterTo:"وكيل المدرسة لشؤون الطلاب"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=n=>n==null||!Number.isFinite(Number(n))?"—":new Intl.NumberFormat("ar-SA",{maximumFractionDigits:2}).format(Number(n));
const date=s=>s?new Date(s).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"}):"—";
const statusName=s=>s==="completed"?"مكتمل":s==="in_progress"?"قيد التنفيذ":s==="assigned"?"لم يبدأ":"لم تُسند";
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
 e.textContent+='.tkc-indicators{display:flex;gap:8px;flex-wrap:wrap;max-height:190px;overflow:auto;margin:14px 0}.tkc-indicator{display:inline-flex;align-items:center;gap:7px;background:#f4faf5;border:1px solid #d9e8dc;border-radius:12px;padding:8px 11px;color:#224c38;font-size:12px;cursor:pointer}.tkc-indicator input{width:17px;min-height:17px;accent-color:#08765a}.tkc-interventions{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between}.tkc-interventions>div{min-width:155px;background:#f3f9f4;padding:13px;border-radius:15px}.tkc-interventions b{font-size:23px;font-weight:950;display:block;margin:4px 0}.tkc-interventions small{color:#607c6b;font-size:11px;font-weight:800}.tkc-status{font-size:11px;font-weight:900;padding:6px 9px;background:#ebf7ef;border-radius:9px;white-space:nowrap}.tkc-status.none{background:#f1f3f5;color:#667582}.tkc-print-small{font-size:11px;font-weight:900;border:1px solid #bfddca;border-radius:10px;background:#f0faf4;padding:8px 10px;color:#09664c;white-space:nowrap}@media(max-width:640px){.tkc-interventions>div{min-width:130px;flex:1}}';
 e.textContent+='.tkc-coverage{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.tkc-coverage strong{font-size:27px;color:#086746}.tkc-coverage .tkc-alert{color:#a33b45}.tkc-absentees{width:100%;border-collapse:collapse;font-size:12px}.tkc-absentees th,.tkc-absentees td{text-align:right;padding:9px;border-bottom:1px solid #dfebe3}.tkc-absentees th{background:#f3f8f4}.tkc-letter-fields{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.tkc-letter-fields>div{flex:1;min-width:175px}.tkc-status.started_unsubmitted{color:#9b5c10;background:#fff4d7}.tkc-status.not_started{color:#9a324b;background:#fff0f2}';
 document.head.appendChild(e);
}
function draw(){
 if(!A.host?.isConnected)return;
 const d=A.detail,c=d?.counts||{},ps=d?.percentages||{},all=d?.rows||[],filtered=all.filter(x=>(A.filter==="all"||x.classification===A.filter)&&(A.statusFilter==="all"||x.plan_status===A.statusFilter)),needle=A.query.trim().toLowerCase(),shown=filtered.filter(x=>!needle||String(x.student_name).toLowerCase().includes(needle)||String(x.class_name).toLowerCase().includes(needle));
 const options=A.tests.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===A.testId?'selected':'')+'>'+esc(x.title)+' • '+esc(date(x.date))+'</option>').join("");
 const scopes=(d?.scopes||[]).map(x=>'<option value="'+esc(x.key)+'" '+(x.key===d.scope?'selected':'')+'>'+esc(x.label)+'</option>').join("");
 A.host.innerHTML='<div class="tkc">'+
 '<section class="tkc-hero"><span class="tkc-tag">تقرير تشخيصي • من نتائج الاختبارات الفعلية</span><h1>تصنيف الطلاب بعد كل اختبار</h1><p>علاجي أقل من 50%، تعزيز من 50% إلى أقل من 80%، إثرائي من 80% فأعلى. غير المختبر خارج فئات الأداء.</p></section>'+
 '<section class="tkc-box"><div class="tkc-controls">'+
 '<div><label for="tkc-test">اختر الاختبار</label><select id="tkc-test" '+(A.loading?'disabled':'')+'><option value="">اختر اختبارًا منشورًا</option>'+options+'</select></div>'+
 '<div><label for="tkc-scope">التصنيف حسب</label><select id="tkc-scope" '+(!d||A.loading?'disabled':'')+'>'+scopes+'</select></div>'+
 '<div><label for="tkc-search">بحث عن طالب</label><input id="tkc-search" value="'+esc(A.query)+'" placeholder="اسم الطالب أو الفصل" /></div>'+
 '<button id="tkc-reload" class="tkc-btn alt" '+(A.loading?'disabled':'')+'>↻ تحديث</button></div>'+
 (d?.indicators?.length>1?'<div style="margin-top:16px;border-top:1px solid #e6eee7;padding-top:14px"><button class="tkc-btn alt" id="tkc-group-toggle" type="button">تحديد مجموعة مؤشرات ('+num(A.groupKeys.length)+')</button>'+
 (A.groupOpen?'<div class="tkc-indicators">'+d.indicators.map(x=>'<label class="tkc-indicator"><input type="checkbox" data-tkc-indicator="'+esc(x.key)+'" '+(A.groupKeys.includes(x.key)?'checked':'')+' /><span>'+esc(x.label)+'</span></label>').join("")+'</div><div class="tkc-top-buttons"><button id="tkc-apply-group" class="tkc-btn" '+(A.groupKeys.length<2?'disabled':'')+'>تحليل المؤشرات المحددة</button><button class="tkc-btn alt" id="tkc-clear-group">إلغاء التحديد</button></div>':'')+'</div>':'')+
 '</section>'+
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
 '<section class="tkc-box"><div class="tkc-coverage"><div><h2 style="margin:0 0 7px">التأكد من خطة لكل طالب مختبر</h2><p class="tkc-note" style="margin:0">تغطية الخطط المرتبطة بنتيجة الاختبار والمؤشر المختارين فقط. دون تكرار الخطط الموجودة.</p></div><div><strong class="'+(d.coverage?.missing?'tkc-alert':'')+'">'+num(d.coverage?.covered||0)+' / '+num(d.coverage?.tested||0)+'</strong><div class="tkc-note">'+(d.coverage?.missing?num(d.coverage.missing)+' طالبًا ما زالوا بلا خطة':'جميع المختبرين لهم خطط')+'</div></div><button id="tkc-ensure-all" class="tkc-btn" '+(A.sending||!d.coverage?.missing?'disabled':'')+'>'+(A.sending?'جارٍ استكمال الخطط…':'استكمال خطط جميع المختبرين')+'</button></div>'+(d.coverage?.missing?'<div class="tkc-message" style="margin-top:14px">بلا خطة: علاجي '+num(d.coverage.missing_by_tier?.remedial||0)+'، تعزيز '+num(d.coverage.missing_by_tier?.reinforcement||0)+'، إثرائي '+num(d.coverage.missing_by_tier?.enrichment||0)+'. اضغط استكمال الخطط لمراجعة الإسناد لكل طالب.</div>':'')+'</section>'+
 '<section class="tkc-box"><div class="tkc-heading"><div><h2>متابعة تنفيذ الخطط وقياس الأثر</h2><p>نتيجة قبل → ورقة عمل → إنجاز → اختبار بعدي لنفس المؤشر → قياس التحسن</p></div></div><div class="tkc-interventions">'+[
 ["إسنادات لم تبدأ",d.effect?.assigned||0],
 ["قيد التنفيذ",d.effect?.in_progress||0],
 ["خطط مكتملة",d.effect?.completed||0],
 ["أُجري لهم قياس بعدي",d.effect?.post_tested||0],
 ["تحسنوا",d.effect?.improved||0],
 ["بلغوا الإتقان بعد التدخل",d.effect?.new_mastery||0],
 ["ما زالوا بحاجة إلى علاج",d.effect?.still_remedial||0],
 ["بانتظار القياس البعدي",d.effect?.pending_post||0]
 ].map(x=>'<div><small>'+x[0]+'</small><b>'+num(x[1])+'</b></div>').join("")+'</div></section>'+
 '<section class="tkc-box"><div class="tkc-heading"><div><h2>أسماء الطلاب ودرجاتهم</h2><p>'+esc(d.test.title)+' · '+esc((d.test.subject_keys||[]).map(sub).join("، "))+' · '+esc(d.test.grade)+' · '+esc(date(d.test.date))+'</p></div><span class="tkc-note">'+num(shown.length)+' من '+num(all.length)+' طالب</span></div>'+
 '<div class="tkc-tabs">'+["all","remedial","reinforcement","enrichment","unmeasured"].map(k=>'<button class="tkc-tab '+(k===A.filter?'active':'')+'" data-tkc-filter="'+k+'">'+labels[k]+' ('+num(k==="all"?all.length:c[k]||0)+')</button>').join("")+'</div>'+
 '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:13px"><label for="tkc-status" style="margin:0">حالة متابعة الخطة</label><select id="tkc-status" style="max-width:230px"><option value="all">كل الحالات</option>'+[["none","لم تُسند خطة"],["assigned","لم يبدأ"],["in_progress","قيد التنفيذ"],["completed","مكتمل"]].map(x=>'<option value="'+x[0]+'" '+(A.statusFilter===x[0]?'selected':'')+'>'+x[1]+'</option>').join("")+'</select><span class="tkc-note">الترتيب حسب أولوية التدخل ودرجة الطالب ثم الفصل.</span></div>'+
 '<div class="tkc-tablebox"><table class="tkc-table" style="min-width:1450px"><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>الدرجة القبلية</th><th>الدرجة الكلية</th><th>النسبة</th><th>التصنيف</th><th>الخطة وورقة العمل</th><th>حالة التنفيذ</th><th>تاريخ الإسناد/الإنجاز</th><th>القياس البعدي</th><th>التحسن</th><th>قياس الأثر</th></tr></thead><tbody>'+
 (shown.length?shown.map((r,i)=>'<tr><td>'+num(i+1)+'</td><td><b>'+esc(r.student_name)+'</b></td><td>'+esc(r.class_name||"—")+'</td><td>'+(r.tested?num(r.score):"—")+'</td><td>'+(r.tested?num(r.total):"—")+'</td><td>'+(r.tested?num(r.percent)+"%":"—")+'</td><td><span class="tkc-pill '+r.classification+'">'+labels[r.classification]+'</span></td>'+
 '<td>'+(r.plans?.length?r.plans.map(x=>'<div style="padding:5px 0"><b>'+esc(x.title)+'</b><div>'+esc(x.indicator_text||"")+'</div><button class="tkc-print-small" data-tkc-sheet="'+esc(x.id)+'">طباعة الورقة</button></div>').join(""):"لم تُسند")+'</td>'+
 '<td><span class="tkc-status '+(r.plan_status||"none")+'">'+statusName(r.plan_status)+'</span></td>'+
 '<td>'+(r.assigned_at?date(r.assigned_at):"—")+' / '+(r.completed_at?date(r.completed_at):"—")+'</td>'+
 '<td>'+(r.post_percent!=null?num(r.post_score)+" من "+num(r.post_total)+" • "+num(r.post_percent)+"%":"لم يُقَس بعد")+'</td>'+
 '<td>'+(r.improvement!=null?(r.improvement>0?"+":"")+num(r.improvement)+" نقطة":"—")+'</td>'+
 '<td>'+esc(r.effect_status||"—")+'</td></tr>').join(""):'<tr><td colspan="13" class="tkc-blank">لا توجد أسماء في هذا التصنيف.</td></tr>')+
 '</tbody></table></div><div class="tkc-actions"><button class="tkc-btn" id="tkc-assign" '+(A.sending||!["remedial","reinforcement","enrichment"].includes(A.filter)||!filtered.length?'disabled':'')+'>'+(A.sending?"جارٍ إسناد الخطط…":"إسناد خطة للفئة: "+(labels[A.filter]||"اختر فئة"))+'</button><button class="tkc-btn paper" id="tkc-print">طباعة PDF</button><span class="tkc-note">إسناد الطلاب المقاسين فقط؛ وطباعتها تتم من نافذة حفظ PDF.</span></div></section>'+
 '<section class="tkc-box"><div class="tkc-heading"><div><h2>تقرير الطلاب الذين لم ينجزوا الاختبار</h2><p>هذه القائمة للاختبار كاملًا، مستقلة عن الطلاب الذين اختبروا لكن لم يُقاسوا في المؤشر المختار.</p></div><span class="tkc-note">غير مسلّمين: '+num(d.counts.exam_absentees||0)+' • بدأ ولم يسلّم: '+num(d.counts.started_unsubmitted||0)+'</span></div>'+
 '<div class="tkc-letter-fields"><div><label for="tkc-letter-school">اسم المدرسة في الخطاب</label><input id="tkc-letter-school" value="'+esc(A.letterSchool)+'" /></div><div><label for="tkc-letter-to">الجهة المخاطبة</label><input id="tkc-letter-to" value="'+esc(A.letterTo)+'" /></div></div>'+
 '<div class="tkc-tablebox"><table class="tkc-absentees"><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>حالة الاختبار</th></tr></thead><tbody>'+
 (d.absentees?.length?d.absentees.map((x,i)=>'<tr><td>'+num(i+1)+'</td><td>'+esc(x.student_name)+'</td><td>'+esc(x.class_name)+'</td><td><span class="tkc-status '+x.attempt_state+'">'+(x.attempt_state==="started_unsubmitted"?"بدأ ولم يسلّم":x.attempt_state==="not_submitted"?"محاولة غير مسلّمة":"لم تُسجّل بداية اختبار")+'</span></td></tr>').join(""):'<tr><td colspan="4" class="tkc-blank">جميع الطلاب المستهدفين سلّموا الاختبار، ولا توجد أسماء لخطاب متابعة.</td></tr>')+
 '</tbody></table></div><div class="tkc-actions"><button class="tkc-btn alt" id="tkc-print-absentees" '+(!d.absentees?.length?'disabled':'')+'>طباعة كشف غير المختبرين PDF</button><button class="tkc-btn" id="tkc-print-letter" '+(!d.absentees?.length?'disabled':'')+'>خطاب رسمي جاهز بأسماء الطلاب</button><span class="tkc-note">الخطاب يطلب متابعة الأسباب، ولا يصف الطالب بالغائب عن المدرسة.</span></div></section>'+
 '<div class="tkc-message">الغائب ومن لم يسلّم الاختبار لا يُصنّف علاجيًا. وعند اختيار مؤشر لا يُحتسب الطالب إلا إذا ظهر له قياس فعلي في المؤشر نفسه. خطاب عدم الإنجاز يعتمد الاختبار كاملًا.</div>')+
 '</div>';wire();
}
function wire(){
 if(!A.host?.isConnected)return;
 const $=id=>A.host.querySelector("#"+id);
 const t=$("tkc-test");if(t)t.onchange=()=>{A.testId=t.value;A.scope="";A.filter="all";A.query="";A.groupKeys=[];A.groupOpen=false;A.statusFilter="all";loadDetail()};
 const s=$("tkc-scope");if(s)s.onchange=()=>{A.scope=s.value;A.filter="all";loadDetail()};
 const q=$("tkc-search");if(q)q.oninput=()=>{A.query=q.value;const pos=q.selectionStart;draw();const r=$("tkc-search");r?.focus();r?.setSelectionRange(pos,pos)};
 const b=$("tkc-reload");if(b)b.onclick=()=>A.testId?loadDetail():loadList(true);
 const z=$("tkc-retry");if(z)z.onclick=()=>A.testId?loadDetail():loadList(true);
 A.host.querySelectorAll("[data-tkc-filter]").forEach(b=>b.onclick=()=>{A.filter=b.dataset.tkcFilter;A.statusFilter="all";A.notice="";draw()});
 const status=$("tkc-status");if(status)status.onchange=()=>{A.statusFilter=status.value;draw()};
 const a=$("tkc-assign");if(a)a.onclick=assign;
 const allBtn=$("tkc-ensure-all");if(allBtn)allBtn.onclick=ensureAll;
 const p=$("tkc-print");if(p)p.onclick=print;
 const school=$("tkc-letter-school");if(school)school.oninput=()=>{A.letterSchool=school.value};
 const to=$("tkc-letter-to");if(to)to.oninput=()=>{A.letterTo=to.value};
 const rosterBtn=$("tkc-print-absentees");if(rosterBtn)rosterBtn.onclick=()=>printAbsentees(false);
 const letterBtn=$("tkc-print-letter");if(letterBtn)letterBtn.onclick=()=>printAbsentees(true);
 const g=$("tkc-group-toggle");if(g)g.onclick=()=>{A.groupOpen=!A.groupOpen;draw()};
 A.host.querySelectorAll("[data-tkc-indicator]").forEach(ch=>ch.onchange=()=>{A.groupKeys=ch.checked?[...new Set([...A.groupKeys,ch.dataset.tkcIndicator])]:A.groupKeys.filter(x=>x!==ch.dataset.tkcIndicator);draw()});
 const apply=$("tkc-apply-group");if(apply)apply.onclick=()=>{if(A.groupKeys.length>=2){A.scope="group:"+A.groupKeys.join("|");A.filter="all";loadDetail()}};
 const clear=$("tkc-clear-group");if(clear)clear.onclick=()=>{A.groupKeys=[];draw()};
 A.host.querySelectorAll("[data-tkc-sheet]").forEach(b=>b.onclick=()=>printSheet(b.dataset.tkcSheet));
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
 try{const r=await api("assign",{test_id:A.testId,scope:d.scope,tier});const message=(r.message||"تمت العملية.")+" أُرسلت: "+num(r.sent||0)+"؛ موجودة: "+num(r.skipped||0)+"؛ تحتاج مراجعة: "+num(r.unavailable||0)+".";await loadDetail();A.notice=message}
 catch(e){A.error=e.message||"تعذر إسناد الخطط"}
 finally{A.sending=false;draw()}
}

async function ensureAll(){
 const d=A.detail;if(!d||A.sending||!d.coverage?.missing)return;
 const count=d.coverage.missing;
 if(!confirm("سيتم استكمال الخطط المناسبة لكل طالب مختبر لا يملك خطة في «"+d.test.title+"» حسب التصنيف الحالي.\nالطلاب غير المختبرين لن تُسند لهم خطط.\nعدد الطلاب المطلوب استكمالهم: "+num(count)+".\nهل تعتمد الإسناد؟"))return;
 A.sending=true;A.error="";A.notice="";draw();
 let message="";
 try{
  const r=await api("ensure_all",{test_id:A.testId,scope:d.scope});
  message=r.message||"اكتملت مراجعة التغطية.";
  await loadDetail();
  if(A.detail?.coverage?.missing)message+=" بعد التحقق بقي "+num(A.detail.coverage.missing)+" طالبًا دون خطة؛ راجع الأسئلة المتاحة والتفاصيل.";
  else message+=" تم التأكد من تغطية جميع الطلاب المقاسين في النطاق.";
  A.notice=message;
 }catch(e){A.error=e.message||"تعذر استكمال خطط الجميع."}
 finally{A.sending=false;draw()}
}
function printAbsentees(letter){
 const d=A.detail,students=d?.absentees||[];if(!students.length)return;
 const w=window.open("","_blank","width=1050,height=850");
 if(!w){alert("اسمح بفتح نافذة الطباعة الجديدة.");return}
 const day=new Date().toLocaleDateString("ar-SA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"});
 const school=esc(A.letterSchool.trim()||"اسم المدرسة"),addressee=esc(A.letterTo.trim()||"وكيل المدرسة لشؤون الطلاب"),count=students.length;
 const table=students.map((r,i)=>'<tr><td>'+num(i+1)+'</td><td>'+esc(r.student_name)+'</td><td>'+esc(r.class_name)+'</td><td>'+(r.attempt_state==="started_unsubmitted"?"بدأ الاختبار ولم يكتمل التسليم":r.attempt_state==="not_submitted"?"محاولة غير مسلّمة":"لم تُرصد محاولة بدء")+'</td></tr>').join("");
 const css='@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#1a392e;font-size:11pt;line-height:1.8}header{display:flex;justify-content:space-between;border-bottom:3px solid #07583f;padding-bottom:12px}h1{font-size:18pt;text-align:center;color:#075c44;margin:16px 0}h2{font-size:13pt;color:#075c44}.meta{display:flex;justify-content:space-between;gap:12px;margin:12px 0}.formal{padding:10px 0;text-align:justify;line-height:2.15}table{width:100%;border-collapse:collapse;font-size:10pt;margin:16px 0}th,td{padding:8px;border:1px solid #aebfb4;text-align:right}th{background:#edf5ef}tr{break-inside:avoid}thead{display:table-header-group}.sign{display:flex;justify-content:space-between;gap:25px;margin-top:27px;font-size:10pt}.note{font-size:9pt;color:#566c5c}';
 const header='<header><div><b>المملكة العربية السعودية</b><div>وزارة التعليم</div><div>'+school+'</div></div><div>الرقم: ....................<div>التاريخ: '+esc(day)+'</div><div>المرفقات: كشف بالأسماء ('+num(count)+')</div></div></header>';
 const intro=letter?'<div class="formal"><b>سعادة '+addressee+' المحترم</b><p>السلام عليكم ورحمة الله وبركاته، وبعد:</p><p><b>الموضوع: متابعة الطلاب الذين لم ينجزوا الاختبار.</b></p><p>نفيدكم بأنه بعد مراجعة سجلات منصة تمكّن للاختبار الموضح أدناه، لم تُرصد نتائج مسلّمة للطلاب الواردة أسماؤهم في الكشف، وعددهم ('+num(count)+') طالبًا. نأمل منكم التكرم بمتابعة حالاتهم والتحقق من أسباب عدم البدء أو عدم اكتمال التسليم، واتخاذ ما يلزم لتمكينهم من أداء الاختبار، مع مراعاة الأعطال التقنية المحتملة.</p><p>وتفضلوا بقبول فائق الاحترام والتقدير.</p></div>':'<p class="formal">كشف متابعة الطلاب الذين لم يُرصد لهم تسليم مكتمل لهذا الاختبار. يُرجى التحقق من السجلات الفنية للطلاب الذين لديهم محاولات غير مسلّمة.</p>';
 const foot=letter?'<div class="sign"><div>مُعدّ الخطاب: ________________________<div>التوقيع: _______________________</div></div><div>مدير المدرسة: _______________________<div>التوقيع: _______________________</div></div></div>':'';
 w.document.open();w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+(letter?"خطاب متابعة الطلاب غير المختبرين":"كشف الطلاب الذين لم ينجزوا الاختبار")+'</title><style>'+css+'</style></head><body>'+header+'<h1>'+(letter?'خطاب متابعة الطلاب الذين لم ينجزوا الاختبار':'تقرير الطلاب الذين لم ينجزوا الاختبار')+'</h1><div class="meta"><span>الاختبار: '+esc(d.test.title)+'</span><span>الصف: '+esc(d.test.grade)+'</span></div><div class="meta"><span>الفصل المستهدف: '+esc(d.test.class_name)+'</span><span>تاريخ نشر الاختبار: '+esc(date(d.test.date))+'</span></div>'+intro+'<h2>كشف الأسماء ('+num(count)+' طلاب)</h2><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>حالة التسليم</th></tr></thead><tbody>'+table+'</tbody></table><p class="note">تعني «لم تُرصد محاولة بدء» عدم وجود سجل لمحاولة دخول أو تسليم لهذا الاختبار، ولا تثبت غياب الطالب عن المدرسة. وتعني «بدأ ولم يكتمل التسليم» وجود نشاط دون نتيجة اختبار مسلّمة.</p>'+foot+'</body></html>');
 w.document.close();w.focus();setTimeout(()=>w.print(),400);
}

async function printSheet(id){
 const popup=window.open("","_blank","width=950,height=850");
 if(!popup){alert("اسمح بالنوافذ المنبثقة لطباعة ورقة العمل.");return}
 popup.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font-family:Tahoma;padding:30px">جارٍ إعداد ورقة العمل…</body></html>');popup.document.close();
 try{
  const d=await api("plan_sheet",{task_id:id});
  const kind=labels[d.tier]||"خطة تدريبية";
  const cognitiveName=x=>x==="knowledge"?"معرفة أساسية":x==="application"?"تطبيق":x==="reasoning"?"استدلال متقدم":"نشاط";
  const q=(d.questions||[]).map((x,i)=>'<article class="q"><b>السؤال '+num(i+1)+'</b><span style="float:left;font-size:9pt;background:#e9f5eb;padding:2px 8px;border-radius:8px">'+cognitiveName(x.cognitive_level)+'</span>'+(x.context_text?'<div class="source">'+esc(x.context_text)+'</div>':'')+'<p>'+esc(x.question_text||"")+'</p><div class="opts">'+(Array.isArray(x.options)?x.options.map((v,j)=>'<div>◯ '+["أ","ب","ج","د"][j]+'. '+esc(v)+'</div>').join(""):'')+'</div></article>').join("");
  const css='@page{size:A4;margin:13mm}*{box-sizing:border-box}body{margin:0;font-family:Tahoma,Arial,sans-serif;color:#203b32;font-size:11pt;line-height:1.75}.head{border:2px solid #167d59;border-radius:12px;padding:18px}.head h1{margin:3px 0;font-size:21pt;color:#076b4e}.meta{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:7px}.meta span{padding:7px;border:1px solid #dce9df;background:#f6fbf8}.q{border:1px solid #d9e7dd;padding:15px;margin-top:14px;border-radius:12px;break-inside:avoid;page-break-inside:avoid}.q b{color:#096f55}.q p{font-weight:700;margin:9px 0}.source{background:#f5f7f3;border:1px solid #e0e8dc;border-radius:8px;padding:10px;margin:9px 0;white-space:pre-wrap}.opts{display:grid;grid-template-columns:1fr 1fr;gap:6px}.opts div{padding:6px;border-bottom:1px dashed #e4ece3}.foot{padding:14px 0;margin-top:18px;border-top:1px solid #cbded1;font-size:10pt}';
  popup.document.open();popup.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ورقة '+kind+' - '+esc(d.student_name)+'</title><style>'+css+'</style></head><body><div class="head"><small>مِنَصَّةُ تَمَكُّن • ورقة عمل خاصة بالطالب</small><h1>ورقة '+kind+'</h1><div class="meta"><span>الطالب: '+esc(d.student_name)+'</span><span>الفصل: '+esc(d.class_name||"—")+'</span><span>المؤشر: '+esc(d.indicator_text||"—")+'</span><span>تاريخ الإسناد: '+esc(date(d.assigned_at))+'</span></div></div>'+(d.instructions?'<div style="margin-top:12px;padding:12px;background:#f0f9f2;border-right:3px solid #0b704f"><b>التشخيص والتوجيه:</b> '+esc(d.instructions)+'</div>':'')+q+'<div class="foot">ملاحظات المعلم: __________________________________________________________<p>توقيع الطالب: ____________________ توقيع ولي الأمر: ____________________</p></div></body></html>');popup.document.close();popup.focus();setTimeout(()=>popup.print(),500);
 }catch(e){popup.close();alert(e.message||"تعذر إعداد ورقة العمل")}
}

function print(){
 const d=A.detail;if(!d)return;const w=window.open("","_blank","width=1100,height=850");if(!w){alert("اسمح بفتح نافذة جديدة ثم اطبع التقرير.");return}
 const c=d.counts,p=d.percentages,r=d.rows.filter(x=>(A.filter==="all"||x.classification===A.filter)&&(A.statusFilter==="all"||x.plan_status===A.statusFilter));
 const fx=d.effect||{};
 const table=r.map((s,i)=>'<tr><td>'+num(i+1)+'</td><td>'+esc(s.student_name)+'</td><td>'+esc(s.class_name)+'</td><td>'+(s.tested?num(s.score):"—")+'/'+(s.tested?num(s.total):"—")+'</td><td>'+(s.tested?num(s.percent)+"%":"—")+'</td><td>'+labels[s.classification]+'</td><td>'+(s.plans?.length?s.plans.map(p=>esc(p.title)+' — '+esc(p.indicator_text||"")).join('<p>'):"لم تُسند")+'</td><td>'+statusName(s.plan_status)+'</td><td>'+(s.assigned_at?date(s.assigned_at):"—")+'</td><td>'+(s.completed_at?date(s.completed_at):"—")+'</td><td>'+(s.post_percent!=null?num(s.post_percent)+"%":"لم يُقَس")+'</td><td>'+(s.improvement!=null?((s.improvement>0?"+":"")+num(s.improvement)):"—")+'</td><td>'+esc(s.effect_status||"—")+'</td></tr>').join("");
 const style='@page{size:A4 landscape;margin:8mm}body{font-family:Tahoma,Arial,sans-serif;color:#19362b;font-size:10pt}h1{color:#056849;border-bottom:3px solid #056849;padding-bottom:8px;font-size:20pt}.meta,.summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.meta span,.summary b{border:1px solid #d9e7de;background:#f2f8f4;padding:8px;flex:1;min-width:130px}.summary b{text-align:center}.summary em{display:block;font-style:normal;color:#087858;font-size:16pt}table{width:100%;border-collapse:collapse;font-size:7.4pt;table-layout:auto}th,td{border:1px solid #d9e2db;padding:5px;text-align:right;vertical-align:top;overflow-wrap:anywhere}th{background:#e2f0e8}tr{break-inside:avoid}thead{display:table-header-group}.note{font-size:8.5pt;color:#586b5e;margin-top:14px}';
 w.document.open();w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير تصنيف الطلاب</title><style>'+style+'</style></head><body><small>مِنَصَّةُ تَمَكُّن · التقرير الفعلي</small><h1>'+esc(d.test.title)+'</h1><p>'+esc(d.scopes.find(x=>x.key===d.scope)?.label||"")+' · الفئة: '+labels[A.filter]+'</p><div class="meta"><span>المادة: '+esc(d.test.subject_keys.map(sub).join("، "))+'</span><span>الصف: '+esc(d.test.grade)+'</span><span>الفصول: '+esc(d.test.class_name)+'</span><span>تاريخ الاختبار (النشر): '+esc(date(d.test.date))+'</span></div><div style="margin:14px 0;border:1px solid #d8e8dc;padding:10px"><b>قياس الأثر — </b> مكتملون: '+num(fx.completed||0)+' • اختبروا بعديًا: '+num(fx.post_tested||0)+' • تحسنوا: '+num(fx.improved||0)+' • أتقنوا بعد التدخل: '+num(fx.new_mastery||0)+' • ما زالوا بحاجة إلى علاج: '+num(fx.still_remedial||0)+' • بانتظار القياس: '+num(fx.pending_post||0)+'</div><div class="summary"><b>المختبرون<em>'+num(c.tested)+'</em></b><b>لم يُقَس<em>'+num(c.unmeasured)+'</em></b><b>علاجي<em>'+num(c.remedial)+'</em></b><b>تعزيز<em>'+num(c.reinforcement)+'</em></b><b>إثرائي<em>'+num(c.enrichment)+'</em></b></div><table><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th><th>قبلي</th><th>النسبة</th><th>التصنيف</th><th>الخطة والمؤشر</th><th>التنفيذ</th><th>الإسناد</th><th>الإنجاز</th><th>بعدي</th><th>التحسن (نقطة)</th><th>الأثر</th></tr></thead><tbody>'+table+'</tbody></table><p class="note">نسب المختبرين فقط: علاجي '+num(p.remedial)+'%، تعزيز '+num(p.reinforcement)+'%، إثرائي '+num(p.enrichment)+'%. الغائب وغير المختبر لا يُصنّف أكاديميًا.</p></body></html>');w.document.close();w.focus();setTimeout(()=>w.print(),350);
}
window.TamakkunClassifications={mount(view){const host=view?.querySelector("#tamakkunClassificationMount");if(!host)return;A.host=host;style();draw();if(!A.ready)loadList();else if(!A.detail||A.detail.test.id!==A.testId)loadDetail()}};
})();