(()=>{
'use strict';
const $=id=>document.getElementById(id),R=window.NafesPaperResults,T=window.NafesTeacher;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SETTINGS_KEY='nafes_school_report_settings_v1';
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
function levelKey(p){
 const n=Number(p);
 if(n>=90)return'excellent';
 if(n>=80)return'verygood';
 if(n>=70)return'good';
 if(n>=50)return'pass';
 return'fail';
}
function logo(src,label){return src?'<img src="'+src+'" alt="'+esc(label)+'">':'<div class="sar-logo-fallback">'+esc(label)+'</div>'}
function ar(v){return new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v||0))}
function pct(v){return Number.isFinite(Number(v))?ar(v)+'٪':'—'}
function ring(label,count,total,key){
 const p=total?count/total*100:0;
 return '<div class="sar-ring-item"><div class="sar-ring '+key+'" style="--p:'+Math.max(0,Math.min(100,p))+'%"><div><b>'+esc(label)+'</b><strong>'+pct(p)+'</strong></div></div></div>';
}
function bar(label,count,max,key){
 const h=max?Math.max(4,count/max*100):4;
 return '<div class="sar-bar-item"><div class="sar-bar-track"><i class="'+key+'" style="--h:'+h+'%"><b>'+ar(count)+'</b></i></div><span>'+esc(label)+'</span></div>';
}
function setState(msg,error=false){const s=$('state');s.textContent=msg;s.className='state'+(error?' error':'');}
function fillSelect(reviews,selected){
 $('reviewSelect').innerHTML=reviews.length?reviews.map(r=>'<option value="'+esc(r.review_id)+'" '+(String(r.review_id)===String(selected)?'selected':'')+'>'+esc(r.title||'اختبار آلي')+' · '+esc(R.subjectNames[r.subject]||r.subject||'')+'</option>').join(''):'<option value="">لا توجد اختبارات محفوظة</option>';
}
function fillClasses(b){
 const classes=[...new Set([...(b.attempts||[]).map(a=>String(a.class_name||'').trim()),...(b.assigned||[]).map(a=>String(a.class_name||'').trim())].filter(Boolean))].sort();
 const keep=$('classSelect').value;
 $('classSelect').innerHTML='<option value="">جميع الفصول</option>'+classes.map(c=>'<option '+(c===keep?'selected':'')+'>'+esc(c)+'</option>').join('');
}
function buildOfficial(b){
 const students=b.students||[],n=students.length,s=b.summary||{},cfg=settings(),review=b.review||{},payload=b.payload||{};
 const scores=students.map(x=>Number(x.score)).filter(Number.isFinite);
 const totals=students.map(x=>Number(x.total)).filter(Number.isFinite);
 const percents=students.map(x=>Number(x.percent)).filter(Number.isFinite);
 const sum=scores.reduce((a,v)=>a+v,0);
 const possible=totals.reduce((a,v)=>a+v,0);
 const achievement=possible?sum/possible*100:null;
 const highest=scores.length?Math.max(...scores):0;
 const lowest=scores.length?Math.min(...scores):0;
 const average=n?sum/n:0;
 const maxTotal=totals.length?Math.max(...totals):Number(payload.question_count||review.question_count||0);
 const counts=Object.fromEntries(levels.map(l=>[l.key,percents.filter(p=>levelKey(p)===l.key).length]));
 const maxCount=Math.max(1,...Object.values(counts));
 const rows=levels.map(l=>'<tr><td><span class="sar-level-tag '+l.key+'">'+l.label+'</span></td><td>'+l.range+'</td><td>'+ar(counts[l.key])+'</td></tr>').join('');
 const subjectText=b.subjectName&&b.subjectName!=='—'?b.subjectName:'الاختبار الآلي';
 const title=(b.subjects||[]).length===1?'تحليل نتائج اختبار مادة ['+subjectText+']':'تحليل نتائج الاختبار الآلي ['+subjectText+']';
 const term=review.academic_term||review.term||payload.academic_term||payload.term||'الفصل الدراسي الأول';
 const rosterTotal=Number(s.assigned||0)||n;
 const testedTotal=Number(s.tested||n);
 const missingTotal=Number((b.absent||[]).length||Math.max(0,rosterTotal-testedTotal));
 const teacher=cfg.teacherName||'________________';
 const principal=cfg.principalName||'________________';
 return '<article class="subject-analysis-sheet official-analysis-sheet reference-analysis">'+
   '<header class="sar-head">'+
     '<div class="sar-admin"><b>المملكة العربية السعودية</b><span>وزارة التعليم</span><span>الإدارة العامة للتعليم بمنطقة نجران</span><span>'+esc(cfg.schoolName||'مدرسة ابن سينا المتوسطة')+'</span></div>'+
     '<div class="sar-ministry">'+logo(cfg.ministryLogo,'وزارة التعليم')+'</div>'+
     '<div class="sar-form-no">تحليل نتائج</div>'+
   '</header>'+
   '<h1>'+esc(title)+'</h1>'+
   '<div class="sar-teacher-band"><span>معلم المادة:</span><b>'+esc(teacher)+'</b></div>'+
   '<div class="sar-meta">'+
     '<div><span>المرحلة الدراسية / الصف:</span><b>الثالث متوسط</b></div>'+
     '<div><span>السنة / الفصل الدراسي:</span><b>'+esc(term)+'</b></div>'+
     '<div><span>درجة القياس (الاختبار):</span><b>'+ar(maxTotal)+'</b></div>'+
   '</div>'+
   '<div class="sar-analysis-grid">'+
     '<section class="sar-stats"><h2>الإحصائيات الأساسية</h2><div class="sar-stat-list">'+
       '<div><span>إجمالي عدد الطلاب</span><b>'+ar(rosterTotal)+'</b></div>'+
       '<div><span>عدد الطلاب المختبرين</span><b>'+ar(testedTotal)+'</b></div>'+
       '<div><span>عدد الطلاب الذين لم يختبروا</span><b>'+ar(missingTotal)+'</b></div>'+
       '<div><span>أعلى درجة</span><b>'+ar(highest)+'</b></div>'+
       '<div><span>أقل درجة</span><b>'+ar(lowest)+'</b></div>'+
       '<div><span>متوسط الدرجات</span><b>'+ar(average)+'</b></div>'+
       '<div><span>نسبة التحصيل</span><b>'+pct(achievement)+'</b></div>'+
       '<div><span>مجموع الدرجات</span><b>'+ar(sum)+'</b></div>'+
     '</div></section>'+
     '<section class="sar-achievement"><h2>الإحصائيات التحصيلية</h2><table><thead><tr><th>المستوى</th><th>النطاق</th><th>عدد الطلاب</th></tr></thead><tbody>'+rows+'</tbody></table></section>'+
   '</div>'+
   '<section class="sar-chart-card"><h2>رسم بياني (نسب الطلاب لكل تقدير)</h2><div class="sar-rings">'+levels.map(l=>ring(l.label,counts[l.key],n,l.key)).join('')+'</div></section>'+
   '<section class="sar-chart-card"><h2>رسم بياني (عدد الطلاب لكل تقدير)</h2><div class="sar-bars">'+levels.map(l=>bar(l.label,counts[l.key],maxCount,l.key)).join('')+'</div></section>'+
   '<footer class="sar-signatures"><div><b>معلم/ة المادة:</b><span>'+esc(teacher)+'</span></div><div><b>مدير/ة المدرسة:</b><span>'+esc(principal)+'</span></div></footer>'+
 '</article>';
}
function render(){
 reportHtml=buildOfficial(bundle);
 $('officialAnalysisPreview').innerHTML=reportHtml;
 $('content').hidden=false;
 $('printAnalysisBtn').disabled=false;
 $('reportLink').href='review-report.html?rid='+encodeURIComponent(bundle.review.review_id)+($('classSelect').value?'&class='+encodeURIComponent($('classSelect').value):'');
 setState('تم إنشاء التحليل الرسمي لـ '+R.ar((bundle.students||[]).length)+' نتيجة معتمدة.');
}
async function load(initial=false){
 try{
   $('printAnalysisBtn').disabled=true;reportHtml='';
   setState('جارٍ تحميل نتائج الاختبار الآلي…');
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
$('reviewSelect').addEventListener('change',()=>{$('classSelect').value='';load(true);});
$('classSelect').addEventListener('change',()=>load(false));
$('refreshBtn').onclick=()=>load(false);
$('printAnalysisBtn').onclick=()=>{
 if(!reportHtml)return;
 const root=$('printRoot');root.innerHTML=reportHtml;root.setAttribute('aria-hidden','false');window.print();
};
window.addEventListener('afterprint',()=>{const root=$('printRoot');if(root){root.innerHTML='';root.setAttribute('aria-hidden','true')}});
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load(true);});
load(true);
})();