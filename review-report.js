(()=>{
'use strict';
const $=id=>document.getElementById(id),R=window.NafesPaperResults,T=window.NafesTeacher;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SETTINGS='nafes_school_report_settings_v1';
const SUBJECT_TEACHERS={reading:'زرعي شبير',math:'عبدالله العماري',science:'مليدان بالحارث'};
let bundle=null;
function settings(){try{return JSON.parse(localStorage.getItem(SETTINGS)||'{}')}catch{return{}}}
function setState(msg,error=false){const s=$('state');s.textContent=msg;s.className='state'+(error?' error':'')}
function fillSelect(reviews,selected){
 $('reviewSelect').innerHTML=reviews.length?reviews.map(r=>{
   const subs=(r.subjects||[r.subject]).filter(Boolean).map(x=>R.subjectNames[x]||x).join(' + ');
   return '<option value="'+esc(r.review_id)+'" '+(String(r.review_id)===String(selected)?'selected':'')+'>'+esc(r.title||'اختبار آلي')+' · '+esc(subs||'—')+'</option>';
 }).join(''):'<option value="">لا توجد اختبارات محفوظة</option>';
}
function fillClasses(b){
 const classes=[...new Set([...(b.attempts||[]).map(a=>String(a.class_name||'').trim()),...(b.assigned||[]).map(a=>String(a.class_name||'').trim())].filter(Boolean))].sort();
 const keep=$('classSelect').value;
 $('classSelect').innerHTML='<option value="">جميع الفصول</option>'+classes.map(c=>'<option '+(c===keep?'selected':'')+'>'+esc(c)+'</option>').join('');
}
function rowStudent(x,i){return '<tr><td>'+R.ar(i+1)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.className)+'</td><td>'+esc(x.model)+'</td><td>'+R.ar(x.score)+' / '+R.ar(x.total)+'</td><td>'+R.pct(x.percent)+'</td><td>'+esc(x.level.label)+'</td></tr>'}
function rowIndicator(x,i){return '<tr><td>'+R.ar(i+1)+'</td><td>'+esc(x.text)+'</td><td>'+R.ar(x.correct)+' / '+R.ar(x.total)+'</td><td>'+R.pct(x.percent)+'</td><td>'+esc(x.level.label)+'</td></tr>'}
function n3(v){return Number.isFinite(Number(v))?Number(v).toFixed(3):'—'}
function subjectQuestionCount(b,subject){
 const model=b.payload?.models?.[0];if(model?.questions)return model.questions.filter(q=>String(q.subject||String(q.indicator||'').split(':')[0]||'')===subject).length;
 return Number(b.payload?.question_count||0);
}
function subjectRecommendations(b,subject){
 const inds=(b.indicators||[]).filter(x=>x.subject===subject),items=(b.psychometrics?.items||[]).filter(x=>x.subject===subject),out=[];
 const weak=inds[0],strong=inds.at(-1);
 if(weak&&Number.isFinite(Number(weak.percent)))out.push('إعادة تدريس المؤشر «'+weak.text+'» لأنه الأقل أداءً بنسبة '+R.pct(weak.percent)+'.');
 const lowDisc=items.filter(x=>Number.isFinite(Number(x.discrimination))&&Number(x.discrimination)<.2);
 if(lowDisc.length)out.push('مراجعة '+R.ar(lowDisc.length)+' سؤالًا معامل تمييزها أقل من 0.20 قبل إعادة استخدامها.');
 const badDist=items.filter(x=>x.distractors?.available&&(x.distractors.nonfunctional||[]).length);
 if(badDist.length)out.push('تقوية مشتتات '+R.ar(badDist.length)+' سؤالًا لوجود مشتت غير وظيفي وفق اختيارات الطلاب.');
 if(strong&&strong.key!==weak?.key)out.push('تثبيت التعلم في المؤشر «'+strong.text+'» بأنشطة إثرائية لأنه الأعلى أداءً بنسبة '+R.pct(strong.percent)+'.');
 if(!out.length)out.push('لا توجد إشارة إحصائية كافية لإجراء حاسم؛ استمر في جمع الاستجابات وإعادة القياس.');
 return out;
}
function reportHead(b,cfg,school){
 const subjects=(b.subjects||[]).map(x=>R.subjectNames[x]||x).join(' + ');
 return '<div class="report-head">'+
  '<div class="right">'+(cfg.ministryLogo?'<img src="'+esc(cfg.ministryLogo)+'" alt="شعار الوزارة" style="max-height:18mm;max-width:35mm">':'<b>المملكة العربية السعودية</b><b>وزارة التعليم</b>')+'<b>'+esc(school)+'</b></div>'+
  '<div class="center"><h1>تقرير نتائج الاختبار الآلي</h1><b>'+esc(b.review.title||'اختبار آلي')+'</b><small>المواد: '+esc(subjects||'—')+'</small></div>'+
  '<div class="left">'+(cfg.schoolLogo?'<img src="'+esc(cfg.schoolLogo)+'" alt="شعار المدرسة" style="max-height:18mm;max-width:35mm;margin-right:auto">':'<b>منصة معلّمي</b>')+'</div>'+
 '</div>';
}
function subjectBlock(b,subject){
 const label=R.subjectNames[subject]||subject,teacher=SUBJECT_TEACHERS[subject]||'............................';
 const ss=(b.subjectSummary||[]).find(x=>x.key===subject)||{},inds=(b.indicators||[]).filter(x=>x.subject===subject);
 const cogs=b.cognitiveBySubject?.[subject]||[],items=(b.psychometrics?.items||[]).filter(x=>x.subject===subject),rels=(b.psychometrics?.reliability||[]).filter(x=>x.subject===subject);
 const cognitiveRows=cogs.map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+R.ar(x.correct)+' / '+R.ar(x.total)+'</td><td>'+R.pct(x.percent)+'</td></tr>').join('');
 const itemRows=items.map((x,i)=>{
   const dist=x.distractors?.available?(R.pct(x.distractors.efficiency)+(x.distractors.nonfunctional?.length?' · غير وظيفي: '+x.distractors.nonfunctional.map(j=>['أ','ب','ج','د'][Number(j)]||'?').join('، '):'')):'عينة ناقصة';
   const band=({easy:'سهل',medium:'متوسط',hard:'صعب',insufficient:'عينة ناقصة'})[x.difficulty_band]||'—';
   return '<tr><td>'+R.ar(i+1)+'</td><td>'+esc(String(x.question||'').slice(0,180))+'</td><td>'+R.ar(x.sample_size)+'</td><td>'+(x.facility===null?'—':R.pct(Number(x.facility)*100))+' · '+band+'</td><td>'+n3(x.discrimination)+'</td><td>'+esc(dist)+'</td></tr>';
 }).join('');
 const relRows=rels.map(x=>'<tr><td>'+esc(x.model)+'</td><td>'+R.ar(x.n)+'</td><td>'+R.ar(x.item_count)+'</td><td>'+(x.kr20===null?'عينة ناقصة':n3(x.kr20))+'</td></tr>').join('');
 const recs=subjectRecommendations(b,subject).map(x=>'<li>'+esc(x)+'</li>').join('');
 return '<section class="subject-report-block">'+
   '<div class="subject-report-title"><h2>التقرير التفصيلي لمادة '+esc(label)+'</h2><span>معلم المادة: <b>'+esc(teacher)+'</b></span></div>'+
   '<div class="report-meta subject-meta"><div><b>المادة:</b><br>'+esc(label)+'</div><div><b>عدد أسئلة المادة:</b><br>'+R.ar(subjectQuestionCount(b,subject))+'</div><div><b>الطلاب المقاسون:</b><br>'+R.ar(ss.students||0)+'</div><div><b>نسبة التحصيل:</b><br>'+R.pct(ss.percent)+'</div></div>'+
   '<section class="report-section"><h2>المستويات المعرفية</h2><table class="report-table"><thead><tr><th>المستوى</th><th>الصحيح / الإجمالي</th><th>النسبة</th></tr></thead><tbody>'+cognitiveRows+'</tbody></table></section>'+
   '<section class="report-section report-flow-section"><h2>تحليل مؤشرات المادة</h2><table class="report-table"><thead><tr><th>م</th><th>المؤشر</th><th>الصحيح</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>'+(inds.length?inds.map(rowIndicator).join(''):'<tr><td colspan="5">لا توجد بيانات مؤشرات.</td></tr>')+'</tbody></table></section>'+
   '<section class="report-section report-flow-section"><h2>تحليل الأسئلة: السهولة والتمييز وفاعلية المشتتات</h2><p class="report-method-note">تظهر معاملات التمييز عند ١٠ استجابات صالحة فأكثر، وفاعلية المشتت عند ٢٠ استجابة فأكثر. لا تُفسر الأرقام النهائية عند نقص العينة.</p><table class="report-table"><thead><tr><th>م</th><th>السؤال</th><th>العينة</th><th>السهولة</th><th>التمييز</th><th>المشتتات</th></tr></thead><tbody>'+(itemRows||'<tr><td colspan="6">لا توجد استجابات قابلة للتحليل.</td></tr>')+'</tbody></table></section>'+
   '<section class="report-section"><h2>الثبات KR-20 حسب النموذج</h2><table class="report-table"><thead><tr><th>النموذج</th><th>الطلاب</th><th>البنود المشتركة</th><th>KR-20</th></tr></thead><tbody>'+(relRows||'<tr><td colspan="4">يلزم ١٠ طلاب على الأقل في النموذج و٥ بنود مشتركة.</td></tr>')+'</tbody></table></section>'+
   '<section class="report-section"><h2>إجراءات المادة</h2><ol class="report-list">'+recs+'</ol></section>'+
   '<div class="signatures subject-signatures"><div>معلم المادة<br><br>'+esc(teacher)+'</div><div>مدير المدرسة<br><br>............................</div></div>'+
 '</section>';
}
function build(){
 const b=bundle;if(!b?.review)return;
 const s=b.summary,cfg=settings(),date=$('reportDate').value.trim(),school=cfg.schoolName||'مدرسة ابن سينا المتوسطة',cls=$('classSelect').value||b.review.class_name||'الثالث المتوسط (جميع الفصول)';
 const kpis=[['الموزع عليهم',s.assigned],['المختبرون',s.tested],['غير المختبرين',b.absent.length],['المتوسط',R.pct(s.average)],['الإتقان',R.pct(s.masteryRate)],['بحاجة إلى دعم',s.support]].map(x=>'<div class="report-kpi"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');
 const absent=b.absent.length?'<ol class="report-list">'+b.absent.map(a=>'<li>'+esc(a.student_name||a.full_name||'طالب')+'</li>').join('')+'</ol>':'<p>لا يوجد طلاب غير مختبرين ضمن التوزيع المعتمد.</p>';
 const subjectSummary=(b.subjectSummary||[]).map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+R.ar(x.correct)+'</td><td>'+R.ar(x.total)+'</td><td>'+R.pct(x.percent)+'</td><td>'+esc(x.level.label)+'</td></tr>').join('');
 $('reportSheet').innerHTML=
 reportHead(b,cfg,school)+
 '<div class="report-meta"><div><b>اسم الاختبار:</b><br>'+esc(b.review.title||'اختبار آلي')+'</div><div><b>الفصل:</b><br>'+esc(cls)+'</div><div><b>عدد الأسئلة:</b><br>'+R.ar(b.payload.question_count||b.students[0]?.total||0)+'</div><div><b>التاريخ:</b><br>'+esc(date||'—')+'</div></div>'+
 '<div class="report-kpis">'+kpis+'</div>'+
 '<section class="report-section"><h2>أداء المواد داخل الاختبار</h2><table class="report-table"><thead><tr><th>المادة</th><th>الصحيح</th><th>إجمالي الإجابات</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>'+subjectSummary+'</tbody></table></section>'+
 '<section class="report-section report-flow-section"><h2>نتائج الطلاب</h2><table class="report-table"><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>النموذج</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>'+(b.students.length?b.students.map(rowStudent).join(''):'<tr><td colspan="7">لا توجد نتائج معتمدة حتى الآن.</td></tr>')+'</tbody></table></section>'+
 '<section class="report-section"><h2>الطلاب غير المختبرين</h2>'+absent+'</section>'+
 (b.subjects||[]).map(subject=>subjectBlock(b,subject)).join('');
 $('reportSheet').hidden=false;
 setState('تم إنشاء التقرير الشامل مع تقرير تفصيلي مستقل لكل مادة.');
}
async function load(initial=false){
 try{
   setState('جارٍ تحميل بيانات التقرير…');
   if(!T?.getKey?.()){T.requireKey('أدخل مفتاح المعلم لفتح التقرير الرسمي للاختبار الآلي.');return;}
   const url=new URL(location.href),rid=$('reviewSelect').value||url.searchParams.get('rid')||'',cls=$('classSelect').value||url.searchParams.get('class')||'';
   bundle=await R.load(rid,cls);
   if(initial)fillSelect(bundle.reviews,bundle.review?.review_id||rid);
   if(!bundle.review){$('reportSheet').hidden=true;setState('لا توجد اختبارات آلية محفوظة بعد.',true);return;}
   if(initial){fillClasses(bundle);if(cls&&[...$('classSelect').options].some(o=>o.value===cls))$('classSelect').value=cls;}
   const u=new URL(location.href);u.searchParams.set('rid',bundle.review.review_id);if($('classSelect').value)u.searchParams.set('class',$('classSelect').value);else u.searchParams.delete('class');history.replaceState(null,'',u);
   build();
 }catch(e){$('reportSheet').hidden=true;setState('تعذر إنشاء التقرير: '+(e.message||e),true);}
}
$('reviewSelect').addEventListener('change',()=>{$('classSelect').value='';load(true)});
$('classSelect').addEventListener('change',()=>load(false));
$('reportDate').addEventListener('input',build);
$('printBtn').onclick=()=>window.print();
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load(true)});
load(true);
})();