(()=>{
'use strict';
const $=id=>document.getElementById(id),R=window.NafesPaperResults,T=window.NafesTeacher;
const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let reviews=[],bundle=null,busy=false,latestHtml='';
const subjects=['reading','math','science'],norm=s=>String(s||'').trim().toLowerCase();
function message(s){$('paperIndicatorState').textContent=s}
function options(items){return items.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.label)+'</option>').join('')}
function rebuildClasses(){
 const old=$('paperIndicatorClass').value;
 const rows=[...(bundle?.assigned||[]),...(bundle?.attempts||[])];
 const list=[...new Set(rows.map(x=>String(x.class_name||'').trim()).filter(Boolean))].sort();
 $('paperIndicatorClass').innerHTML='<option value="">جميع الفصول</option>'+list.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
 if(list.includes(old))$('paperIndicatorClass').value=old;
}
function selectSubjects(){
 const present=bundle?.subjects||[];
 $('paperIndicatorSubject').innerHTML=present.map(s=>'<option value="'+esc(s)+'">'+esc(R.subjectNames[s]||s)+'</option>').join('');
 if(!present.length)$('paperIndicatorSubject').innerHTML='<option value="">لا توجد مواد مرتبطة</option>';
}
function questionMeta(){
 const result=new Map();
 for(const model of bundle?.payload?.models||[])for(const [pos,q] of (model.questions||[]).entries()){
  result.set(String(q.id||q.question_id||''),{...q,position:pos+1});
 }
 return result;
}
function normalizePaper(a,subject,meta){
 const src=(a.questions||[]).filter(q=>norm(q.subject||String(q.indicator_key||'').split(':')[0])===subject);
 const qs=src.map((q,i)=>{
  const m=meta.get(String(q.id||q.question_id||''))||{};
  return {...q,subject,indicator_key:q.indicator_key||m.indicator_key||m.indicator||'',indicator_text:q.indicator_text||m.indicator_text||'',cognitive_level:q.cognitive_level||m.cognitive_level||'',question_no:Number(q.question_no||q.question_number||m.question_no||m.position||i+1),correct_index:q.correct_index??m.correct_index??m.correctIndex,answer:q.answer??null};
 }).filter(q=>q.indicator_key&&typeof q.correct==='boolean'&&q.scorable!==false);
 return {...a,questions:qs};
}
async function load(){
 if(busy)return;busy=true;message('جارٍ تحميل الاختبارات الورقية المعتمدة…');
 try{
  if(!T?.getKey?.()){T?.requireKey?.('أدخل مفتاح المعلم للوصول إلى التقارير الورقية.');return;}
  reviews=await R.listReviews();
  const requested=new URL(location.href).searchParams.get('rid')||'';
  $('paperIndicatorTest').innerHTML=options(reviews.map(x=>({id:x.review_id,label:x.title||'اختبار آلي'})));
  const selected=reviews.find(x=>String(x.review_id)===requested)||reviews[0];
  if(!selected){message('لا توجد مراجعة اختبار آلي محفوظة.');return;}
  $('paperIndicatorTest').value=selected.review_id;
  await choose();
 }catch(e){message('فشل تحميل الاختبارات: '+(e?.message||e));}
 finally{busy=false;}
}
async function choose(){
 const rid=$('paperIndicatorTest').value;if(!rid)return;
 message('تحميل أوراق الاختبار المحفوظة…');
 bundle=await R.load(rid);
 rebuildClasses();selectSubjects();
 message('اختر المادة والفصل ثم اضغط إنشاء التقرير. تُستخدم المحاولات الورقية المنشورة في بيانات المعلم فقط.');
}
async function build(){
 if(busy)return;busy=true;latestHtml='';
 try{
  const rid=$('paperIndicatorTest').value,cls=$('paperIndicatorClass').value,subject=$('paperIndicatorSubject').value;
  if(!rid||!subject)throw Error('اختر اختبارًا ومادة.');
  message('جارٍ إعداد التقرير من درجات التصحيح المعتمدة…');
  const b=await R.load(rid,cls),meta=questionMeta(),saved=(b.attempts||[]).filter(a=>(a.events||[]).some(ev=>ev?.type==='paper_scan'&&String(ev.review_id)===rid));
  const records=saved.map(a=>normalizePaper(a,subject,meta));
  const recs=records.filter(a=>a.questions.length).map(a=>{
   const scores=(a.section_scores||[]).find(x=>norm(x.subject||x.subject_key)===subject);
   const correct=a.questions.filter(q=>q.correct).length,total=a.questions.length;
   const m=scores&&Number.isFinite(Number(scores.score))&&Number.isFinite(Number(scores.total))?{score:Number(scores.score),total:Number(scores.total),percent:Number(scores.percent??(100*Number(scores.score)/Number(scores.total)))}:{score:correct,total,percent:100*correct/total};
   return{a,m};
  });
  if(!recs.length)throw Error('لا توجد استجابات معتمدة مرتبطة بمؤشرات هذه المادة؛ لم يتم إنشاء تحليل تخميني.');
  const paperTest={...(b.review||{}),title:b.review?.title||'اختبار آلي',published_at:b.review?.approved_at||b.review?.updated_at||null};
  const absent=(b.absent||[]).map(x=>({name:x.student_name||x.full_name||'اسم غير مسجل'}));
  const part={total:(b.assigned||[]).length||null,tested:(b.students||[]).length,missing:absent};
  const html=window.NafesIndicatorDetailedReport.render({test:paperTest,subject,testId:rid,className:cls,recs,attempts:records,students:b.assigned||[],part});
  latestHtml=html;$('indicatorReportPreview').innerHTML=html;
  message('تم إعداد التقرير من '+recs.length+' ورقة ذات مؤشرات قابلة للتحليل. لا تُعتمد أي قراءة جديدة، ولا تتغير درجات الطالب.');
 }catch(e){$('indicatorReportPreview').innerHTML='<p>تعذر إنشاء التقرير من البيانات المعتمدة.</p>';message(e?.message||String(e));}
 finally{busy=false;}
}
$('paperIndicatorTest').addEventListener('change',async()=>{try{await choose()}catch(e){message(e.message)}});
$('paperIndicatorClass').addEventListener('change',()=>{latestHtml='';$('indicatorReportPreview').innerHTML='اختر إنشاء التقرير بعد تغيير الفصل.'});
$('paperIndicatorSubject').addEventListener('change',()=>{latestHtml='';$('indicatorReportPreview').innerHTML='اختر إنشاء التقرير بعد تغيير المادة.'});
$('buildIndicatorReportBtn').addEventListener('click',build);
addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)load()});
load();
})();