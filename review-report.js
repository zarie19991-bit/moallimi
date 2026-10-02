(()=>{
'use strict';
const $=id=>document.getElementById(id),R=window.NafesPaperResults,T=window.NafesTeacher;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SETTINGS='nafes_school_report_settings_v1';
let bundle=null;
function settings(){try{return JSON.parse(localStorage.getItem(SETTINGS)||'{}')}catch{return{}}}
function setState(msg,error=false){const s=$('state');s.textContent=msg;s.className='state'+(error?' error':'');}
function fillSelect(reviews,selected){$('reviewSelect').innerHTML=reviews.length?reviews.map(r=>'<option value="'+esc(r.review_id)+'" '+(String(r.review_id)===String(selected)?'selected':'')+'>'+esc(r.title||'مراجعة ورقية')+' · '+esc(R.subjectNames[r.subject]||r.subject||'')+'</option>').join(''):'<option value="">لا توجد مراجعات محفوظة</option>'}
function fillClasses(b){const classes=[...new Set((b.attempts||[]).map(a=>String(a.class_name||'').trim()).filter(Boolean))].sort();const keep=$('classSelect').value;$('classSelect').innerHTML='<option value="">جميع الفصول</option>'+classes.map(c=>'<option '+(c===keep?'selected':'')+'>'+esc(c)+'</option>').join('')}
function rowStudent(x,i){return '<tr><td>'+R.ar(i+1)+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.className)+'</td><td>'+esc(x.model)+'</td><td>'+R.ar(x.score)+' / '+R.ar(x.total)+'</td><td>'+R.pct(x.percent)+'</td><td>'+esc(x.level.label)+'</td></tr>'}
function rowIndicator(x,i){return '<tr><td>'+R.ar(i+1)+'</td><td>'+esc(R.subjectNames[x.subject]||x.subject||'—')+'</td><td>'+esc(x.text)+'</td><td>'+R.ar(x.correct)+' / '+R.ar(x.total)+'</td><td>'+R.pct(x.percent)+'</td><td>'+esc(x.level.label)+'</td></tr>'}
function build(){
 const b=bundle;if(!b?.review)return;
 const s=b.summary,cfg=settings(),date=$('reportDate').value.trim(),weak=b.indicators[0],strong=b.indicators.at(-1);
 const school=cfg.schoolName||'مدرسة ابن سينا المتوسطة',teacher=cfg.teacherName||'',principal=cfg.principalName||'';
 const cls=$('classSelect').value||b.review.class_name||'الثالث المتوسط (جميع الفصول)';
 const logos='<div class="right">'+(cfg.ministryLogo?'<img src="'+esc(cfg.ministryLogo)+'" alt="شعار الوزارة" style="max-height:18mm;max-width:35mm">':'<b>المملكة العربية السعودية</b><b>وزارة التعليم</b>')+'<b>'+esc(school)+'</b></div><div class="center"><h1>تقرير نتائج الاختبار الورقي</h1><b>'+esc(b.review.title||'مراجعة مؤشرات نافس')+'</b></div><div class="left">'+(cfg.schoolLogo?'<img src="'+esc(cfg.schoolLogo)+'" alt="شعار المدرسة" style="max-height:18mm;max-width:35mm;margin-right:auto">':'<b>منصة معلّمي</b>')+'</div>';
 const kpis=[
   ['الموزع عليهم',s.assigned],['المختبرون',s.tested],['غير المختبرين',b.absent.length],['المتوسط',R.pct(s.average)],['الإتقان',R.pct(s.masteryRate)],['بحاجة إلى دعم',s.support]
 ].map(x=>'<div class="report-kpi"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');
 const absent=b.absent.length?'<ol class="report-list">'+b.absent.map(a=>'<li>'+esc(a.student_name||a.full_name||'طالب')+'</li>').join('')+'</ol>':'<p>لا يوجد طلاب غير مختبرين ضمن التوزيع المعتمد.</p>';
 const recs='<ol class="report-list">'+b.recommendations.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol>';
 const summaryText=weak&&strong?'<p style="font-size:9pt;line-height:1.8;margin:0">أعلى مؤشر أداء: <b>'+esc(strong.text)+'</b> بنسبة <b>'+R.pct(strong.percent)+'</b>. وأقل مؤشر أداء: <b>'+esc(weak.text)+'</b> بنسبة <b>'+R.pct(weak.percent)+'</b>.</p>':'<p style="font-size:9pt;margin:0">لا توجد نتائج مؤشرات كافية لكتابة ملخص تشخيصي بعد.</p>';
 $('reportSheet').innerHTML=
 '<div class="report-head">'+logos+'</div>'+
 '<div class="report-meta"><div><b>المادة:</b><br>'+esc(b.subjectName)+'</div><div><b>الفصل:</b><br>'+esc(cls)+'</div><div><b>عدد الأسئلة:</b><br>'+R.ar(b.payload.question_count||b.students[0]?.total||0)+'</div><div><b>التاريخ:</b><br>'+esc(date||'—')+'</div></div>'+
 '<div class="report-kpis">'+kpis+'</div>'+
 '<section class="report-section"><h2>الملخص التشخيصي</h2>'+summaryText+'</section>'+
 ((b.subjects||[]).length>1?'<section class="report-section"><h2>أداء المواد داخل الاختبار</h2><table class="report-table"><thead><tr><th>المادة</th><th>الصحيح</th><th>إجمالي الإجابات</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>'+(b.subjectSummary||[]).map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+R.ar(x.correct)+'</td><td>'+R.ar(x.total)+'</td><td>'+R.pct(x.percent)+'</td><td>'+esc(x.level.label)+'</td></tr>').join('')+'</tbody></table></section>':'')+
 '<section class="report-section"><h2>نتائج الطلاب</h2><table class="report-table"><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>النموذج</th><th>الدرجة</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>'+(b.students.length?b.students.map(rowStudent).join(''):'<tr><td colspan="7">لا توجد نتائج معتمدة حتى الآن.</td></tr>')+'</tbody></table></section>'+
 '<section class="report-section"><h2>تحليل المؤشرات</h2><table class="report-table"><thead><tr><th>م</th><th>المادة</th><th>المؤشر</th><th>الصحيح</th><th>النسبة</th><th>المستوى</th></tr></thead><tbody>'+(b.indicators.length?b.indicators.map(rowIndicator).join(''):'<tr><td colspan="6">لا توجد بيانات مؤشرات.</td></tr>')+'</tbody></table></section>'+
 '<section class="report-section"><h2>الطلاب غير المختبرين</h2>'+absent+'</section>'+
 '<section class="report-section"><h2>الإجراءات العلاجية والإثرائية المقترحة</h2>'+recs+'</section>'+
 '<div class="signatures"><div>معلم المادة<br><br>'+esc(teacher||'............................')+'</div><div>مدير المدرسة<br><br>'+esc(principal||'............................')+'</div></div>';
 $('reportSheet').hidden=false;
 setState('تم إنشاء التقرير من نتائج الاختبار الورقي المحدد فقط.');
}
async function load(initial=false){
 try{
   setState('جارٍ تحميل بيانات التقرير…');
   if(!T?.getKey?.()){T.requireKey('أدخل مفتاح المعلم لفتح التقرير الرسمي للاختبارات الورقية.');return;}
   const url=new URL(location.href),rid=$('reviewSelect').value||url.searchParams.get('rid')||'',cls=$('classSelect').value||url.searchParams.get('class')||'';
   bundle=await R.load(rid,cls);
   if(initial)fillSelect(bundle.reviews,bundle.review?.review_id||rid);
   if(!bundle.review){$('reportSheet').hidden=true;setState('لا توجد مراجعات ورقية محفوظة بعد.',true);return;}
   if(initial){fillClasses(bundle);if(cls&&[...$('classSelect').options].some(o=>o.value===cls))$('classSelect').value=cls;}
   const u=new URL(location.href);u.searchParams.set('rid',bundle.review.review_id);if($('classSelect').value)u.searchParams.set('class',$('classSelect').value);else u.searchParams.delete('class');history.replaceState(null,'',u);
   build();
 }catch(e){$('reportSheet').hidden=true;setState('تعذر إنشاء التقرير: '+(e.message||e),true);}
}
$('reviewSelect').addEventListener('change',()=>{$('classSelect').value='';load(true);});
$('classSelect').addEventListener('change',()=>load(false));
$('reportDate').addEventListener('input',build);
$('printBtn').onclick=()=>window.print();
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load(true);});
load(true);
})();