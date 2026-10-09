(()=>{
'use strict';
const $=id=>document.getElementById(id),R=window.NafesPaperResults,T=window.NafesTeacher;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SETTINGS_KEY='nafes_school_report_settings_v1';
const SUBJECT_TEACHERS={reading:'زرعي شبير',math:'عبدالله العماري',science:'مليدان بالحارث'};
const levels=[
 {key:'excellent',label:'ممتاز',range:'٩٠ – ١٠٠'},
 {key:'verygood',label:'جيد جدًا',range:'٨٠ – أقل من ٩٠'},
 {key:'good',label:'جيد',range:'٧٠ – أقل من ٨٠'},
 {key:'pass',label:'مقبول',range:'٥٠ – أقل من ٧٠'},
 {key:'fail',label:'راسب',range:'أقل من ٥٠'}
];
let bundle=null,reportHtml='';

function settings(){
 try{return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:'',...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}
 catch(_){return{schoolName:'مدرسة ابن سينا المتوسطة',teacherName:'',principalName:'',ministryLogo:''}}
}
function levelKey(p){const n=Number(p);if(n>=90)return'excellent';if(n>=80)return'verygood';if(n>=70)return'good';if(n>=50)return'pass';return'fail'}
function logo(src,label){return src?'<img src="'+src+'" alt="'+esc(label)+'">':'<div class="sar-logo-fallback">'+esc(label)+'</div>'}
function ar(v){return new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v||0))}
function pct(v){return Number.isFinite(Number(v))?ar(v)+'٪':'—'}
function n3(v){return Number.isFinite(Number(v))?Number(v).toFixed(3):'—'}
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
function baseHead(title,cfg){
 return '<header class="sar-head">'+
   '<div class="sar-admin"><b>المملكة العربية السعودية</b><span>وزارة التعليم</span><span>الإدارة العامة للتعليم بمنطقة نجران</span><span>'+esc(cfg.schoolName||'مدرسة ابن سينا المتوسطة')+'</span></div>'+
   '<div class="sar-ministry">'+logo(cfg.ministryLogo,'وزارة التعليم')+'</div>'+
   '<div class="sar-form-no">تحليل نتائج</div>'+
 '</header><h1>'+esc(title)+'</h1>';
}
function subjectQuestionCount(b,subject){
 const model=b.payload?.models?.[0];
 if(model?.questions)return model.questions.filter(q=>String(q.subject||String(q.indicator||'').split(':')[0]||'')===subject).length;
 return Number(b.payload?.question_count||0);
}
function buildOverall(b){
 const students=b.students||[],n=students.length,s=b.summary||{},cfg=settings(),review=b.review||{},payload=b.payload||{};
 const percents=students.map(x=>Number(x.percent)).filter(Number.isFinite),counts=Object.fromEntries(levels.map(l=>[l.key,percents.filter(p=>levelKey(p)===l.key).length]));
 const rows=levels.map(l=>'<tr><td><span class="sar-level-tag '+l.key+'">'+l.label+'</span></td><td>'+l.range+'</td><td>'+ar(counts[l.key])+'</td></tr>').join('');
 const subjectRows=(b.subjectSummary||[]).map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+ar(x.correct)+' / '+ar(x.total)+'</td><td>'+pct(x.percent)+'</td><td>'+esc(x.level?.label||'—')+'</td></tr>').join('');
 const cls=$('classSelect').value||review.class_name||'جميع الفصول',term=review.academic_term||payload.academic_term||payload.term||'الفصل الدراسي الأول';
 return '<article class="subject-analysis-sheet official-analysis-sheet reference-analysis analysis-overview-sheet">'+
   baseHead('التحليل الشامل للاختبار ['+(review.title||'اختبار آلي')+']',cfg)+
   '<div class="sar-meta"><div><span>الصف:</span><b>الثالث متوسط</b></div><div><span>الفصل:</span><b>'+esc(cls)+'</b></div><div><span>عدد الأسئلة:</span><b>'+ar(payload.question_count||0)+'</b></div></div>'+
   '<div class="sar-analysis-grid">'+
     '<section class="sar-stats"><h2>الإحصائيات الأساسية</h2><div class="sar-stat-list">'+
       '<div><span>الموزع عليهم</span><b>'+ar(s.assigned||0)+'</b></div><div><span>المختبرون</span><b>'+ar(s.tested||0)+'</b></div>'+
       '<div><span>غير المختبرين</span><b>'+ar((b.absent||[]).length)+'</b></div><div><span>متوسط الاختبار</span><b>'+pct(s.average)+'</b></div>'+
       '<div><span>نسبة الإتقان</span><b>'+pct(s.masteryRate)+'</b></div><div><span>الفصل الدراسي</span><b>'+esc(term)+'</b></div>'+
     '</div></section>'+
     '<section class="sar-achievement"><h2>توزيع مستويات الطلاب</h2><table><thead><tr><th>المستوى</th><th>النطاق</th><th>الطلاب</th></tr></thead><tbody>'+rows+'</tbody></table></section>'+
   '</div>'+
   '<section class="sar-chart-card"><h2>أداء كل مادة داخل الاختبار</h2><table><thead><tr><th>المادة</th><th>الصحيح / الإجمالي</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>'+subjectRows+'</tbody></table></section>'+
   '<div class="sar-teacher-band"><span>نوع التقرير:</span><b>ملخص شامل — التقارير التفصيلية لكل مادة في الصفحات التالية</b></div>'+
 '</article>';
}
function buildSubjectSheet(b,subject){
 const cfg=settings(),review=b.review||{},payload=b.payload||{},label=R.subjectNames[subject]||subject,teacher=SUBJECT_TEACHERS[subject]||'________________';
 const ss=(b.subjectSummary||[]).find(x=>x.key===subject)||{},inds=(b.indicators||[]).filter(x=>x.subject===subject);
 const cogs=b.cognitiveBySubject?.[subject]||[],psy=(b.psychometrics?.items||[]).filter(x=>x.subject===subject),rels=(b.psychometrics?.reliability||[]).filter(x=>x.subject===subject);
 const weak=inds[0],strong=inds.at(-1),measured=psy.filter(x=>x.sample_size>=Number(b.psychometrics?.minimum_item_sample||10));
 const avgFacility=measured.length?measured.reduce((s,x)=>s+Number(x.facility||0),0)/measured.length:null;
 const discRows=measured.filter(x=>Number.isFinite(Number(x.discrimination))),avgDisc=discRows.length?discRows.reduce((s,x)=>s+Number(x.discrimination),0)/discRows.length:null;
 const indicators=inds.slice(0,10).map((x,i)=>'<tr><td>'+ar(i+1)+'</td><td>'+esc(x.text)+'</td><td>'+ar(x.correct)+' / '+ar(x.total)+'</td><td>'+pct(x.percent)+'</td><td>'+esc(x.level?.label||'—')+'</td></tr>').join('');
 const cognitive=cogs.map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+ar(x.correct)+' / '+ar(x.total)+'</td><td>'+pct(x.percent)+'</td></tr>').join('');
 const psych=[...psy].sort((a,b)=>{
   const ad=Number.isFinite(Number(a.discrimination))?Number(a.discrimination):9,bd=Number.isFinite(Number(b.discrimination))?Number(b.discrimination):9;
   return ad-bd||Number(a.facility??2)-Number(b.facility??2);
 }).slice(0,8).map((x,i)=>'<tr><td>'+ar(i+1)+'</td><td>'+esc(String(x.question||'').slice(0,95))+'</td><td>'+ar(x.sample_size)+'</td><td>'+(x.facility===null?'—':pct(Number(x.facility)*100))+'</td><td>'+n3(x.discrimination)+'</td><td>'+(x.distractors?.available?pct(x.distractors.efficiency):'عينة ناقصة')+'</td></tr>').join('');
 const reliability=rels.map(x=>'<tr><td>'+esc(x.model)+'</td><td>'+ar(x.n)+'</td><td>'+ar(x.item_count)+'</td><td>'+(x.kr20===null?'عينة ناقصة':n3(x.kr20))+'</td></tr>').join('');
 const cls=$('classSelect').value||review.class_name||'جميع الفصول',term=review.academic_term||payload.academic_term||payload.term||'الفصل الدراسي الأول';
 return '<article class="subject-analysis-sheet official-analysis-sheet reference-analysis subject-detail-sheet" data-subject="'+esc(subject)+'">'+
   baseHead('تحليل نتائج اختبار مادة ['+label+']',cfg)+
   '<div class="sar-teacher-band"><span>معلم المادة:</span><b>'+esc(teacher)+'</b></div>'+
   '<div class="sar-meta"><div><span>الصف / الفصل:</span><b>ثالث متوسط · '+esc(cls)+'</b></div><div><span>الفصل الدراسي:</span><b>'+esc(term)+'</b></div><div><span>عدد أسئلة المادة:</span><b>'+ar(subjectQuestionCount(b,subject))+'</b></div></div>'+
   '<div class="sar-analysis-grid">'+
    '<section class="sar-stats"><h2>ملخص الأداء</h2><div class="sar-stat-list">'+
      '<div><span>الطلاب المقاسون</span><b>'+ar(ss.students||0)+'</b></div><div><span>نسبة التحصيل</span><b>'+pct(ss.percent)+'</b></div>'+
      '<div><span>متوسط السهولة المرصودة</span><b>'+(avgFacility===null?'—':pct(avgFacility*100))+'</b></div><div><span>متوسط التمييز</span><b>'+(avgDisc===null?'—':n3(avgDisc))+'</b></div>'+
      '<div><span>أضعف مؤشر</span><b>'+(weak?pct(weak.percent):'—')+'</b></div><div><span>أقوى مؤشر</span><b>'+(strong?pct(strong.percent):'—')+'</b></div>'+
    '</div></section>'+
    '<section class="sar-achievement"><h2>المستويات المعرفية</h2><table><thead><tr><th>المستوى</th><th>الصحيح / الإجمالي</th><th>النسبة</th></tr></thead><tbody>'+cognitive+'</tbody></table></section>'+
   '</div>'+
   '<section class="sar-chart-card"><h2>المؤشرات الأقل أداءً — أولوية التدخل</h2><table><thead><tr><th>م</th><th>المؤشر</th><th>الصحيح</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>'+(indicators||'<tr><td colspan="5">لا توجد بيانات كافية.</td></tr>')+'</tbody></table></section>'+
   '<section class="sar-chart-card"><h2>تحليل العناصر — السهولة والتمييز والمشتتات</h2><table><thead><tr><th>م</th><th>السؤال</th><th>العينة</th><th>السهولة</th><th>التمييز</th><th>فاعلية المشتتات</th></tr></thead><tbody>'+(psych||'<tr><td colspan="6">لا توجد عينة كافية للتحليل السيكومتري بعد.</td></tr>')+'</tbody></table></section>'+
   '<section class="sar-chart-card"><h2>ثبات KR-20 حسب النموذج</h2><table><thead><tr><th>النموذج</th><th>الطلاب</th><th>البنود المشتركة</th><th>KR-20</th></tr></thead><tbody>'+(reliability||'<tr><td colspan="4">يحتاج ١٠ استجابات على الأقل للنموذج.</td></tr>')+'</tbody></table></section>'+
   '<footer class="sar-signatures"><div><b>معلم المادة:</b><span>'+esc(teacher)+'</span></div><div><b>مدير المدرسة:</b><span>'+esc(cfg.principalName||'________________')+'</span></div></footer>'+
 '</article>';
}
function buildOfficial(b){
 const subjects=b.subjects||[];
 if(subjects.length===1)return buildSubjectSheet(b,subjects[0]);
 return buildOverall(b)+subjects.map(s=>buildSubjectSheet(b,s)).join('');
}
function render(){
 reportHtml=buildOfficial(bundle);
 $('officialAnalysisPreview').innerHTML=reportHtml;
 $('content').hidden=false;$('printAnalysisBtn').disabled=false;
 $('reportLink').href='review-report.html?rid='+encodeURIComponent(bundle.review.review_id)+($('classSelect').value?'&class='+encodeURIComponent($('classSelect').value):'');
 setState('تم إنشاء التحليل الشامل والتقارير المنفصلة لكل مادة من '+R.ar((bundle.students||[]).length)+' نتيجة معتمدة.');
}
async function load(initial=false){
 try{
   $('printAnalysisBtn').disabled=true;reportHtml='';setState('جارٍ تحميل نتائج الاختبار الآلي…');
   if(!T?.getKey?.()){T.requireKey('أدخل مفتاح المعلم لفتح تحليل الاختبار الآلي.');return;}
   const url=new URL(location.href),rid=$('reviewSelect').value||url.searchParams.get('rid')||'',cls=$('classSelect').value||url.searchParams.get('class')||'';
   bundle=await R.load(rid,cls);
   if(initial)fillSelect(bundle.reviews,bundle.review?.review_id||rid);
   if(!bundle.review){$('content').hidden=true;setState('لا توجد اختبارات آلية محفوظة بعد.',true);return;}
   if(initial){fillClasses(bundle);if(cls&&[...$('classSelect').options].some(o=>o.value===cls))$('classSelect').value=cls;}
   const u=new URL(location.href);u.searchParams.set('rid',bundle.review.review_id);if($('classSelect').value)u.searchParams.set('class',$('classSelect').value);else u.searchParams.delete('class');history.replaceState(null,'',u);
   render();
 }catch(e){$('content').hidden=true;$('printAnalysisBtn').disabled=true;setState('تعذر تحميل التحليل: '+(e.message||e),true);}
}
$('reviewSelect').addEventListener('change',()=>{$('classSelect').value='';load(true)});
$('classSelect').addEventListener('change',()=>load(false));
$('refreshBtn').onclick=()=>load(false);
$('printAnalysisBtn').onclick=()=>{if(!reportHtml)return;const root=$('printRoot');root.innerHTML=reportHtml;root.setAttribute('aria-hidden','false');window.print()};
window.addEventListener('afterprint',()=>{const root=$('printRoot');if(root){root.innerHTML='';root.setAttribute('aria-hidden','true')}});
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load(true)});
load(true);
})();