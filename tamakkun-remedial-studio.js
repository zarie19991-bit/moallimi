(()=>{
'use strict';
/*
 * Tamakkun teacher reviewed treatment studio.
 * Read-only: approved item bank; teacher must choose items and confirm focused skill.
 * Does not assign or store interventions, change grades, or claim certified mastery.
 */
const API='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-question-bank-read';
const S={host:null,token:null,subject:'',outcome:'',index:0,indicator:'',student:null,wrong:[],sourceIds:new Set(),candidate:[],chosen:new Set(),focus:'',level:'match',approved:false,busy:false,error:'',generation:0,page:1,sourceTexts:new Set()};
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const T=v=>String(v??'').trim();
const subj=s=>({reading:'القراءة',math:'الرياضيات',science:'العلوم'})[s]||'';
const cognitive=s=>({knowledge:'معرفة',application:'تطبيق',reasoning:'استدلال'})[s]||s||'غير محدد';
const printableOption=o=>typeof o==='string'?o:T(o?.text??o?.label??o?.value??'');
const OK_SUB=new Set(['reading','math','science']);
const ID_MAX=10;
const PAGE_SIZE=16;
const norm=v=>T(v).normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[^\p{L}\p{N}]/gu,'');
function css(){
 if(document.getElementById('tmk-remedial-studio-css'))return;
 const el=document.createElement('style');el.id='tmk-remedial-studio-css';
 el.textContent='.trs{background:#fff;border:1px solid #ccddd3;border-radius:18px;padding:20px;direction:rtl;color:#184b3c;margin-top:16px;font-family:Tahoma,Arial,sans-serif}.trs *{box-sizing:border-box}.trs h2{font-size:19px;font-weight:900;margin:4px 0 10px}.trs h3{font-size:15px;font-weight:800;margin:0 0 8px}.trs p{font-size:12px;line-height:1.8}.trs-note{background:#f1f7f3;color:#355c4b;padding:12px;border-radius:12px;border:1px solid #deebdf;margin:10px 0;line-height:1.8;font-size:12px}.trs-row{display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap}.trs-grid{display:grid;grid-template-columns:2fr 1fr;gap:10px;margin:14px 0}.trs label{font-size:12px;font-weight:700;display:block}.trs input[type=text],.trs select{display:block;width:100%;min-height:43px;border-radius:10px;border:1px solid #bfdbca;background:white;padding:9px;margin-top:7px;font:inherit}.trs input[type=checkbox]{width:17px;height:17px;accent-color:#087059}.trs button{border:1px solid #c8ddd0;border-radius:10px;background:white;color:#075c49;padding:10px 14px;cursor:pointer;font-weight:700;font-size:12px}.trs button.primary{background:#08735c;color:white}.trs button:disabled{opacity:.5;cursor:not-allowed}.trs-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:10px;margin:12px 0}.trs-item{border:1px solid #d7e8de;border-radius:13px;padding:13px;background:#fbfdfc}.trs-item p{white-space:pre-wrap;overflow-wrap:anywhere}.trs-item small{color:#657969;display:block;margin-bottom:8px}.trs-item .trs-context{color:#50675a;font-size:11px;border-right:2px solid #97c7ac;padding-right:8px;max-height:130px;overflow:auto}.trs-status{border-radius:100px;padding:4px 9px;background:#ecf6ef;color:#12684b;font-size:11px;font-weight:700}.trs-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px}.trs-error{color:#a22f3c;background:#fff1f1;padding:12px;border-radius:10px}.trs-empty{padding:20px;text-align:center;color:#677d6f}@media(max-width:700px){.trs-grid{grid-template-columns:1fr}.trs{padding:13px}}';
 document.head.appendChild(el);
}
function eligible(q){
 if(!q||!q.id||!T(q.question_text))return false;
 const opts=Array.isArray(q.options)?q.options:[];
 const ix=Number(q.correct_index);
 if(opts.length<2||!opts.every(x=>T(printableOption(x))))return false;
 if(!Number.isInteger(ix)||ix<0||ix>=opts.length)return false;
 if(S.sourceIds.has(String(q.id))||S.sourceTexts.has(norm(q.question_text)))return false;
 // Image fields are not returned by the existing bank API.
 // Avoid questions that clearly reference graphics not available in this teacher review.
 if(/(?:الشكل|الصورة|الرسم|المخطط|الجدول)\s*(?:الآتي|التالي|أعلاه|أدناه|المرفق|يوضح|يبين)/.test(T(q.question_text)))return false;
 return true;
}
function matchingLevels(){
 return new Set(S.wrong.map(w=>T(w.level)).filter(Boolean));
}
function choices(){
 const levels=matchingLevels();
 let items=S.candidate.filter(eligible);
 if(S.level==='match'&&levels.size)items=items.filter(x=>levels.has(T(x.cognitive_level)));
 return items;
}
function render(){
 if(!S.host)return;css();
 const wrong=S.wrong,items=choices(),checked=items.filter(x=>S.chosen.has(String(x.id)));
 const allChosen=S.candidate.filter(x=>S.chosen.has(String(x.id)));
 let markup='<section class="trs"><div class="trs-row"><div><small>تمكّن • مسودة علاج فردية • المعلم صاحب القرار</small><h2>إنشاء تدريب علاجي من الأخطاء</h2><p>'+E(S.student?.name||'')+' • '+E(subj(S.subject))+' • '+E(S.indicator)+'</p></div><span class="trs-status">الأسئلة البديلة من البنك المعتمد</span></div>'+
 '<div class="trs-note">يعرض النظام <b>أسئلة جديدة للمؤشر نفسه</b>، ويحاول مطابقة المستوى المعرفي للسؤال الخاطئ. لا يضمن ذلك تطابق المهارة الدقيقة؛ يجب أن يحددها المعلم ويتحقق من ملاءمة كل تدريب قبل اعتماده. لا يجري هذا القسم أي تعديل في درجات الطالب أو بياناته.</div>'+
 '<div class="trs-grid"><label>المهارة الدقيقة المستهدفة (يكتبها المعلم)<input type="text" maxlength="160" id="trs-focus" placeholder="مثال: استنتاج معنى المفردة من السياق" value="'+E(S.focus)+'"></label>'+
 '<label>مطابقة المستوى المعرفي<select id="trs-level"><option value="match"'+(S.level==='match'?' selected':'')+'>المستوى نفسه أولًا</option><option value="all"'+(S.level==='all'?' selected':'')+'>جميع المستويات في المؤشر</option></select></label></div>'+
 '<div class="trs-note"><b>الأخطاء المستهدفة:</b> '+wrong.length+' سؤالًا • '+wrong.map(w=>'س'+E(w.no)+' ('+E(cognitive(w.level))+')').join('، ')+'</div>';
 if(S.busy)markup+='<div class="trs-empty">جارٍ قراءة الأسئلة المعتمدة للمؤشر…</div>';
 if(S.error)markup+='<div class="trs-error">'+E(S.error)+'</div>';
 if(!S.busy){
 markup+='<div class="trs-row"><h3>اختر الأسئلة البديلة المناسبة</h3><span class="trs-status">المختارة: '+allChosen.length+' / '+ID_MAX+'</span></div>';
 markup+=items.length?'<div class="trs-list">'+items.slice(0,S.page*PAGE_SIZE).map(q=>{
 const isSelected=S.chosen.has(String(q.id));
 return '<article class="trs-item"><div class="trs-row"><label style="display:flex;align-items:center;gap:9px"><input type="checkbox" data-trs-item="'+E(q.id)+'"'+(isSelected?' checked':'')+'><b>اختيار التدريب</b></label><small>'+E(cognitive(q.cognitive_level))+'</small></div>'+
 (q.context_text?'<p class="trs-context">'+E(q.context_text)+'</p>':'')+
 '<p><b>'+E(q.question_text)+'</b></p><div style="font-size:11px;color:#456253">'+q.options.map((v,i)=>'<div>'+'أبجد'[i%4]+' ـ '+E(printableOption(v))+'</div>').join('')+'</div>'+
 '<details style="font-size:11px;margin-top:8px"><summary>مفتاح السؤال وتفسيره للمعلم</summary><p>الإجابة: '+E(printableOption(q.options[q.correct_index]))+'</p><p>'+E(q.explanation||'يحتاج تفسير المعلم.')+'</p></details></article>';
 }).join('')+'</div>':'<div class="trs-empty">لا توجد أسئلة بديلة مناسبة لهذا الاختيار. غيّر المستوى المعرفي أو راجع بنك الأسئلة.</div>';
 if(items.length>S.page*PAGE_SIZE)markup+='<button id="trs-more">عرض المزيد من التدريبات ('+(items.length-S.page*PAGE_SIZE)+')</button>';
 }
 if(S.approved)markup+='<div class="trs-note" style="border-color:#57b887">راجع المعلم الأسئلة المحددة ووافق على ملاءمتها للمهارة المذكورة. هذه الموافقة تخص هذه المسودة فقط ولا تسندها للطالب.</div>';
 markup+='<div class="trs-actions"><button id="trs-reload">تحديث المقترحات</button><button class="primary" id="trs-approve"'+(!S.focus.trim()||S.focus.trim().length<7||!allChosen.length||S.busy?' disabled':'')+'>'+(S.approved?'تمت مراجعة التدريبات ✓':'تأكيد مراجعة المعلم')+'</button>'+
 '<button id="trs-print-student"'+(!S.approved?' disabled':'')+'>طباعة تدريب الطالب A4</button><button id="trs-print-teacher"'+(!S.approved?' disabled':'')+'>طباعة نموذج المعلم</button></div>'+
 '<p style="color:#748579">الملفان منفصلان حتى لا تظهر الإجابات الصحيحة في ورقة التدريب. لم تُعتمد المهارة بوصفها متقنة، ولا يُنشأ أي تكليف في قاعدة البيانات.</p></section>';
 S.host.innerHTML=markup;
 const at=id=>S.host?.querySelector('#'+id);
 if(at('trs-focus'))at('trs-focus').onchange=e=>{S.focus=T(e.target.value);S.approved=false;render()};
 if(at('trs-level'))at('trs-level').onchange=e=>{S.level=e.target.value;S.chosen.clear();S.approved=false;S.page=1;render()};
 if(at('trs-more'))at('trs-more').onclick=()=>{S.page++;render()};
 for(const el of S.host.querySelectorAll('[data-trs-item]'))el.onchange=e=>{
 const id=String(e.target.dataset.trsItem);
 if(e.target.checked){if(S.chosen.size>=ID_MAX){alert('الحد الأقصى عشرة تدريبات في الورقة الواحدة.');e.target.checked=false;return}S.chosen.add(id)}else S.chosen.delete(id);
 S.approved=false;render();
 };
 if(at('trs-reload'))at('trs-reload').onclick=loadBank;
 if(at('trs-approve'))at('trs-approve').onclick=()=>{if(S.focus.trim().length<7||!S.chosen.size)return;S.approved=true;render()};
 if(at('trs-print-student'))at('trs-print-student').onclick=()=>print('student');
 if(at('trs-print-teacher'))at('trs-print-teacher').onclick=()=>print('teacher');
}
async function loadBank(){
 if(!S.host||!S.token||S.busy)return;
 const gen=S.generation,token=S.token;
 S.busy=true;S.error='';S.candidate=[];S.chosen.clear();S.approved=false;render();
 try{
 const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'list',subject_key:S.subject,outcome_code:S.outcome,indicator_index:S.index,limit:120,training_mode:false}),cache:'no-store'});
 const body=await r.json().catch(()=>({}));if(!r.ok||!body.ok||!Array.isArray(body.rows))throw Error(body.error||'تعذر قراءة بنك الأسئلة.');
 if(gen!==S.generation||token!==S.token)return;
 S.candidate=body.rows.filter(q=>String(q.subject_key)===S.subject&&String(q.outcome_code)===S.outcome&&Number(q.indicator_index)===S.index&&eligible(q));
 if(!S.candidate.length)S.error='لا يوجد سؤال بديل صالح من بنك المؤشر في عينة القراءة الحالية. لا تُستخدم الأسئلة الأصلية بدلًا منه.';
 }catch(err){if(gen===S.generation)S.error=err.message||'تعذر الحصول على التدريب.'}
 finally{if(gen===S.generation){S.busy=false;render()}}
}
function safeHtml(v){return E(v).replace(/\n/g,'\n')}
function print(kind){
 if(!S.approved||!S.focus.trim()||!S.chosen.size||!S.host)return;
 const items=S.candidate.filter(q=>S.chosen.has(String(q.id)));
 if(!items.length)return;
 const student=kind==='student';
 const w=window.open('','_blank','width=950,height=820');if(!w){alert('اسمح بفتح نافذة طباعة التدريبات.');return}
 try{w.opener=null}catch(_){}
 const title=student?'ورقة التدريب العلاجي للطالب':'نموذج تصحيح التدريب العلاجي للمعلم';
 const questions=items.map((q,i)=>'<section class="question"><div class="qn">السؤال '+(i+1)+' • '+E(cognitive(q.cognitive_level))+'</div>'+
 (q.context_text?'<p class="context">'+safeHtml(q.context_text)+'</p>':'')+
 '<p class="stem">'+safeHtml(q.question_text)+'</p><div class="choices">'+q.options.map((o,j)=>'<div>'+'أبجد'[j%4]+' ـ '+E(printableOption(o))+'</div>').join('')+'</div>'+
 (student?'<div class="answer">الإجابة: __________________________</div>':
 '<div class="teacher-answer"><b>الإجابة الصحيحة:</b> '+E(printableOption(q.options[q.correct_index]))+'<p><b>التفسير:</b> '+E(q.explanation||'يضيف المعلم التفسير المناسب.')+'</p></div>')+'</section>').join('');
 const remedial=student?'<h3>مراجعة الأخطاء السابقة</h3>'+S.wrong.map(q=>'<section class="review"><b>السؤال السابق '+E(q.no)+':</b> '+E(q.body||'')+'<p><b>الإجابة الصحيحة:</b> '+E(printableOption(q.options?.[q.correctIndex]))+'</p><p><b>الشرح:</b> '+E(q.explanation||'يشرح المعلم طريقة الحل قبل التدريب.')+'</p></section>').join(''):'';
 const after='<p class="note">القياس البعدي مستقل ويُجرى بأسئلة أخرى بعد تنفيذ التدريب. تعتمد نتيجة الإتقان من المعلم وفق معيار القياس المعتمد، وليس من طباعة هذه الورقة.</p>';
 const doc='<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>'+title+'</title><style>@page{size:A4;margin:13mm}body{font-family:Tahoma,Arial,sans-serif;font-size:11pt;color:#1d3027;line-height:1.8}.school{font-size:9pt;border-bottom:2px solid #176e50;padding-bottom:8px}.title{text-align:center;margin:12px 0}.title h1{font-size:17pt;margin:0}.meta{font-size:10pt;background:#f0f7f2;padding:8px;margin:10px 0}.question{break-inside:avoid;page-break-inside:avoid;border:1px solid #bacbbf;padding:10px;margin:12px 0}.review{break-inside:avoid;border:1px solid #d7dfd8;padding:10px;margin:9px 0}.context{white-space:pre-wrap;background:#f8fbf8;padding:8px;font-size:9.5pt}.stem{white-space:pre-wrap;font-weight:bold}.choices{display:grid;grid-template-columns:1fr 1fr;gap:4px}.answer{margin-top:15px}.teacher-answer{border:1px solid #acd9b9;background:#f4fbf5;padding:7px;margin-top:10px}.note{font-size:9pt;color:#617567;padding:8px;border:1px solid #d7e2d9}.sign{margin-top:24px}.noprint{padding:8px}@media print{.noprint{display:none}}@media(max-width:700px){.choices{grid-template-columns:1fr}}</style></head><body>'+
 '<div class="school"><b>المملكة العربية السعودية – وزارة التعليم – إدارة التعليم بنجران – مدرسة ابن سينا المتوسطة</b></div>'+
 '<div class="title"><h1>'+title+'</h1><span>منصة تمكّن • '+E(subj(S.subject))+'</span></div>'+
 '<div class="meta"><b>الطالب:</b> '+E(S.student.name)+'　<b>الفصل:</b> '+E(S.student.className||'—')+'<p><b>المؤشر:</b> '+E(S.indicator)+'</p><b>المهارة الدقيقة التي حددها المعلم:</b> '+E(S.focus)+'</div>'+
 remedial+'<h3>'+(student?'تدريبات جديدة للتحقق من فهم المهارة':'التدريبات المعتمدة للمراجعة')+'</h3>'+questions+after+
 (student?'<div class="sign"><b>متابعة المعلم:</b> _____________　<b>تاريخ التنفيذ:</b> _____________</div>':'<p>ملاحظة: الاعتماد هنا للطباعة فقط، وليس اعتمادًا نهائيًا للإتقان في قاعدة البيانات.</p>')+
 '<button class="noprint" onclick="print()">طباعة</button></body></html>';
 w.document.write(doc);w.document.close();w.focus();
}
window.TamakkunRemedialStudio={
 mount(opts={}){
   const token=T(opts.token),student=opts.student||{},indicator=opts.indicator||{},wrong=Array.isArray(opts.wrong)?opts.wrong.filter(x=>x&&!x.right):[];
   if(opts.role!=='teacher'||!token||!OK_SUB.has(indicator.subject_key)||!wrong.length)return;
   const host=document.getElementById('tsd-remedial-host');if(!host)return;
   S.generation++;S.host=host;S.token=token;S.subject=String(indicator.subject_key);S.outcome=T(indicator.outcome_code);S.index=Number(indicator.indicator_index);S.indicator=T(indicator.indicator_text);S.student={id:String(student.id),name:T(student.name),className:T(student.className)};S.wrong=wrong;
   S.sourceIds=new Set((opts.attemptQuestionIds||wrong.map(q=>q.id)).filter(Boolean).map(String));
   S.sourceTexts=new Set(wrong.map(q=>norm(q.body)).filter(Boolean));
   S.focus='';S.level='match';S.page=1;S.approved=false;S.busy=false;S.error='';S.candidate=[];S.chosen.clear();
   if(!S.outcome||!Number.isInteger(S.index)||S.index<=0){S.error='لم يثبت تعريف المؤشر لهذا التدريب.';render();return}
   loadBank();
 },
 unmount(){S.generation++;S.host=null;S.token=null;S.student=null;S.candidate=[];S.chosen.clear();S.approved=false;S.wrong=[]}
};
})();