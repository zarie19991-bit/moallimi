(()=>{
'use strict';
const $=id=>document.getElementById(id),R=window.NafesPaperResults,T=window.NafesTeacher;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let bundle=null;
function badge(l){return '<span class="badge '+esc(l?.key||'unmeasured')+'">'+esc(l?.label||'غير مقاس')+'</span>'}
function setState(msg,error=false){const s=$('state');s.textContent=msg;s.className='state'+(error?' error':'');}
function median(values){
 const a=values.filter(Number.isFinite).slice().sort((x,y)=>x-y);
 if(!a.length)return 0;
 const m=Math.floor(a.length/2);
 return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function metricsHtml(b){
 const vals=(b.students||[]).map(x=>Number(x.percent)).filter(Number.isFinite);
 const avg=vals.length?vals.reduce((a,v)=>a+v,0)/vals.length:0;
 const med=median(vals),high=vals.length?Math.max(...vals):0;
 const support=(b.students||[]).filter(x=>Number(x.percent)<70).length;
 const mastery=vals.length?((vals.filter(v=>v>=70).length/vals.length)*100):0;
 return '<div class="metrics">'+
   '<div class="metric"><span>عدد الطلاب المقاسين</span><b>'+R.ar(vals.length)+'</b></div>'+
   '<div class="metric"><span>المتوسط</span><b>'+R.pct(avg)+'</b></div>'+
   '<div class="metric"><span>الوسيط</span><b>'+R.pct(med)+'</b></div>'+
   '<div class="metric"><span>أعلى نتيجة</span><b>'+R.pct(high)+'</b></div>'+
   '<div class="metric"><span>يحتاجون دعمًا (&lt;70٪)</span><b>'+R.ar(support)+'</b></div>'+
   '<div class="metric"><span>نسبة الإتقان</span><b>'+R.pct(mastery)+'</b></div>'+
 '</div>';
}
function fillSelect(reviews,selected){
 $('reviewSelect').innerHTML=reviews.length?reviews.map(r=>'<option value="'+esc(r.review_id)+'" '+(String(r.review_id)===String(selected)?'selected':'')+'>'+esc(r.title||'اختبار آلي')+' · '+esc(R.subjectNames[r.subject]||r.subject||'')+'</option>').join(''):'<option value="">لا توجد اختبارات محفوظة</option>';
}
function fillClasses(b){
 const classes=[...new Set([...(b.attempts||[]).map(a=>String(a.class_name||'').trim()),...(b.assigned||[]).map(a=>String(a.class_name||'').trim())].filter(Boolean))].sort();
 const keep=$('classSelect').value;
 $('classSelect').innerHTML='<option value="">جميع الفصول</option>'+classes.map(c=>'<option '+(c===keep?'selected':'')+'>'+esc(c)+'</option>').join('');
}
function rankBars(rows,empty='لا توجد بيانات بعد.'){
 if(!rows.length)return '<p class="muted">'+esc(empty)+'</p>';
 return rows.slice().sort((a,b)=>(Number(a.percent)||0)-(Number(b.percent)||0)).map(r=>{
   const p=Math.max(0,Math.min(100,Number(r.percent)||0));
   return '<div class="rank-row"><div><small>'+esc(r.text||r.label||r.key||'—')+'</small><div class="bar"><i style="width:'+p+'%"></i></div></div><b>'+R.pct(p)+'</b></div>';
 }).join('');
}
function renderSubjects(b){
 const rows=b.subjectSummary||[];
 $('subjectPerformanceCard').hidden=(b.subjects||[]).length<2;
 $('subjectCards').innerHTML=rows.map(x=>'<div class="subject-card"><h3>'+esc(x.label||R.subjectNames[x.subject]||x.subject||'مادة')+'</h3><div class="big">'+R.pct(x.percent)+'</div><div class="sub">'+R.ar(x.correct||0)+' صحيح من '+R.ar(x.total||0)+'</div></div>').join('');
}
function render(){
 const b=bundle,s=b.summary;
 $('metrics').innerHTML=metricsHtml(b);
 $('assignmentSummary').innerHTML='<span><b>الموزع عليهم:</b> '+R.ar(s.assigned)+'</span><span><b>المختبرون:</b> '+R.ar(s.tested)+'</span><span><b>غير المختبرين:</b> '+R.ar(b.absent.length)+'</span>';
 $('studentsBody').innerHTML=b.students.length?b.students.slice().sort((a,c)=>(Number(a.percent)||0)-(Number(c.percent)||0)).map(x=>'<tr><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.className)+'</td><td>'+esc(x.model)+'</td><td>'+R.ar(x.score)+' / '+R.ar(x.total)+'</td><td>'+R.pct(x.percent)+'</td><td>'+badge(x.level)+'</td></tr>').join(''):'<tr><td colspan="6" class="muted">لا توجد نتائج معتمدة لهذا الاختبار حتى الآن.</td></tr>';
 renderSubjects(b);
 $('indicatorBars').innerHTML=rankBars(b.indicators.map(x=>({...x,text:(R.subjectNames[x.subject]?R.subjectNames[x.subject]+' — ':'')+x.text})),'لا توجد مؤشرات مقاسة.');
 $('cognitiveBars').innerHTML=rankBars(b.cognitive.filter(x=>x.total>0),'لا توجد وسوم مستويات معرفية متاحة.');
 $('questionsBody').innerHTML=b.questions.length?b.questions.slice().sort((a,c)=>(Number(c.failure)||0)-(Number(a.failure)||0)).slice(0,20).map(q=>'<tr><td>'+esc(R.subjectNames[q.subject]||q.subject||'—')+'</td><td>'+esc(q.question)+'</td><td>'+esc(q.indicator)+'</td><td>'+R.ar(q.total)+'</td><td>'+R.ar(q.wrong)+'</td><td>'+R.pct(q.failure)+'</td></tr>').join(''):'<tr><td colspan="6" class="muted">لا توجد نتائج أسئلة بعد.</td></tr>';
 $('absentList').innerHTML=b.absent.length?'<div class="absent-chips">'+b.absent.map(a=>'<span>'+esc(a.student_name||a.full_name||'طالب')+'</span>').join('')+'</div>':'<p class="muted">لا يوجد طلاب غير مختبرين ضمن التوزيع الحالي.</p>';
 $('recommendations').innerHTML=(b.recommendations||[]).length?b.recommendations.map(x=>'<div class="recommendation">'+esc(x)+'</div>').join(''):'<p class="muted">لا توجد إجراءات إضافية مقترحة.</p>';
 $('content').hidden=false;
 $('reportLink').href='review-report.html?rid='+encodeURIComponent(b.review.review_id)+($('classSelect').value?'&class='+encodeURIComponent($('classSelect').value):'');
 setState('تم تحليل '+R.ar(b.students.length)+' نتيجة معتمدة لهذا الاختبار.');
}
async function load(initial=false){
 try{
   setState('جارٍ تحميل نتائج الاختبار الآلي…');
   if(!T?.getKey?.()){T.requireKey('أدخل مفتاح المعلم لفتح تحليل الاختبار الآلي.');return;}
   const url=new URL(location.href),rid=$('reviewSelect').value||url.searchParams.get('rid')||'',cls=$('classSelect').value||url.searchParams.get('class')||'';
   bundle=await R.load(rid,cls);
   if(initial)fillSelect(bundle.reviews,bundle.review?.review_id||rid);
   if(!bundle.review){$('content').hidden=true;setState('لا توجد اختبارات آلية محفوظة بعد.',true);return;}
   if(initial){fillClasses(bundle);if(cls&&[...$('classSelect').options].some(o=>o.value===cls))$('classSelect').value=cls;}
   const u=new URL(location.href);u.searchParams.set('rid',bundle.review.review_id);if($('classSelect').value)u.searchParams.set('class',$('classSelect').value);else u.searchParams.delete('class');history.replaceState(null,'',u);
   render();
 }catch(e){$('content').hidden=true;setState('تعذر تحميل التحليل: '+(e.message||e),true);}
}
$('reviewSelect').addEventListener('change',()=>{$('classSelect').value='';load(true);});
$('classSelect').addEventListener('change',()=>load(false));
$('refreshBtn').onclick=()=>load(false);\n$('printAnalysisBtn').onclick=()=>window.print();
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load(true);});
load(true);
})();