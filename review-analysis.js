(()=>{
'use strict';
const $=id=>document.getElementById(id),R=window.NafesPaperResults,T=window.NafesTeacher;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let bundle=null;
function badge(l){return '<span class="badge '+l.key+'">'+esc(l.label)+'</span>'}
function setState(msg,error=false){const s=$('state');s.textContent=msg;s.className='state'+(error?' error':'');}
function metric(label,value){return '<div class="metric"><span>'+label+'</span><b>'+value+'</b></div>'}
function fillSelect(reviews,selected){
 $('reviewSelect').innerHTML=reviews.length?reviews.map(r=>'<option value="'+esc(r.review_id)+'" '+(String(r.review_id)===String(selected)?'selected':'')+'>'+esc(r.title||'مراجعة ورقية')+' · '+esc(R.subjectNames[r.subject]||r.subject||'')+'</option>').join(''):'<option value="">لا توجد مراجعات محفوظة</option>';
}
function fillClasses(b){
 const classes=[...new Set((b.attempts||[]).map(a=>String(a.class_name||'').trim()).filter(Boolean))].sort();
 const keep=$('classSelect').value;
 $('classSelect').innerHTML='<option value="">جميع الفصول</option>'+classes.map(c=>'<option '+(c===keep?'selected':'')+'>'+esc(c)+'</option>').join('');
}
function bars(rows,empty='لا توجد بيانات بعد.'){
 if(!rows.length)return '<div class="empty">'+empty+'</div>';
 return rows.map(r=>'<div class="bar-row"><span>'+esc(r.text||r.label||r.key)+'</span><div class="bar"><i style="width:'+Math.max(0,Math.min(100,Number(r.percent)||0))+'%"></i></div><b>'+R.pct(r.percent)+'</b></div>').join('');
}
function render(){
 const b=bundle,s=b.summary;
 $('metrics').innerHTML=[
   metric('الموزع عليهم',R.ar(s.assigned)),
   metric('المختبرون',R.ar(s.tested)),
   metric('غير المختبرين',R.ar(b.absent.length)),
   metric('المتوسط',R.pct(s.average)),
   metric('نسبة الإتقان',R.pct(s.masteryRate)),
   metric('يحتاجون دعمًا',R.ar(s.support))
 ].join('');
 $('studentsBody').innerHTML=b.students.length?b.students.map(x=>'<tr><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.className)+'</td><td>'+esc(x.model)+'</td><td>'+R.ar(x.score)+' / '+R.ar(x.total)+'</td><td>'+R.pct(x.percent)+'</td><td>'+badge(x.level)+'</td></tr>').join(''):'<tr><td colspan="6" class="muted">لا توجد نتائج معتمدة لهذا الاختبار حتى الآن.</td></tr>';
 $('indicatorBars').innerHTML=bars(b.indicators,'لا توجد نتائج مؤشرات بعد.');
 $('cognitiveBars').innerHTML=bars(b.cognitive.filter(x=>x.total>0),'لا توجد وسوم مستويات معرفية متاحة في النماذج.');
 $('questionsBody').innerHTML=b.questions.length?b.questions.slice(0,15).map(q=>'<tr><td>'+esc(q.question)+'</td><td>'+esc(q.indicator)+'</td><td>'+R.ar(q.wrong)+' من '+R.ar(q.total)+'</td><td>'+R.pct(q.failure)+'</td></tr>').join(''):'<tr><td colspan="4" class="muted">لا توجد نتائج أسئلة بعد.</td></tr>';
 $('absentList').innerHTML=b.absent.length?'<div class="recommendations">'+b.absent.map(a=>'<div class="recommendation">'+esc(a.student_name||a.full_name||'طالب')+'</div>').join('')+'</div>':'<div class="empty">لا يوجد طلاب غير مختبرين ضمن التوزيع الحالي.</div>';
 $('recommendations').innerHTML=b.recommendations.map(x=>'<div class="recommendation">'+esc(x)+'</div>').join('');
 $('content').hidden=false;
 $('reportLink').href='review-report.html?rid='+encodeURIComponent(b.review.review_id)+($('classSelect').value?'&class='+encodeURIComponent($('classSelect').value):'');
 setState('تم تحليل '+R.ar(b.students.length)+' نتيجة معتمدة لهذا الاختبار.');
}
async function load(initial=false){
 try{
   setState('جارٍ تحميل نتائج الاختبار الورقي…');
   if(!T?.getKey?.()){T.requireKey('أدخل مفتاح المعلم لفتح تحليل الاختبارات الورقية.');return;}
   const url=new URL(location.href),rid=$('reviewSelect').value||url.searchParams.get('rid')||'',cls=$('classSelect').value||url.searchParams.get('class')||'';
   bundle=await R.load(rid,cls);
   if(initial)fillSelect(bundle.reviews,bundle.review?.review_id||rid);
   if(!bundle.review){$('content').hidden=true;setState('لا توجد مراجعات ورقية محفوظة بعد.',true);return;}
   if(initial){fillClasses(bundle);if(cls&&[...$('classSelect').options].some(o=>o.value===cls))$('classSelect').value=cls;}
   const u=new URL(location.href);u.searchParams.set('rid',bundle.review.review_id);if($('classSelect').value)u.searchParams.set('class',$('classSelect').value);else u.searchParams.delete('class');history.replaceState(null,'',u);
   render();
 }catch(e){$('content').hidden=true;setState('تعذر تحميل التحليل: '+(e.message||e),true);}
}
$('reviewSelect').addEventListener('change',()=>{$('classSelect').value='';load(true);});
$('classSelect').addEventListener('change',()=>load(false));
$('refreshBtn').onclick=()=>load(false);
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load(true);});
load(true);
})();