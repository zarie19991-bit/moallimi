(()=>{
'use strict';
const $=id=>document.getElementById(id);
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SUBJECT={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const subj=v=>({'القراءة':'reading','الرياضيات':'math','العلوم':'science','arabic':'reading'}[String(v||'').toLowerCase()]||String(v||'').toLowerCase());
const submitted=a=>!!(a.submitted_at||['submitted','completed','finished'].includes(a.status))&&!['expired','in_progress'].includes(a.status)&&!a.snapshot_warning;
const stamp=a=>Date.parse(a.submitted_at||a.updated_at||a.created_at||'')||0;
const studentKey=a=>String(a.student_id||a.student_key||a.student_no||'').trim();
const valid=q=>typeof q?.correct==='boolean'&&q.scorable!==false&&Number(q.correct_index??q.correctIndex)!==-1;
const key=q=>String(q.indicator_key||'').trim();
const rowQuestions=(a,subject,ind)=>Array.isArray(a.questions)?a.questions.filter(q=>subj(q.subject||q.subject_key)===subject&&key(q)===ind&&valid(q)):[];
const percent=v=>v===null?'—':v.toFixed(1)+'٪';
const label=v=>v===null?'لم يُقَس':v<50?'علاجي':v<80?'تعزيز':'إثرائي/متقن';
const options=(items,selected)=>items.map(x=>'<option value="'+E(x.id)+'"'+(String(x.id)===String(selected)?' selected':'')+'>'+E(x.name)+'</option>').join('');
const examTime=t=>Date.parse(t?.published_at||t?.created_at||'')||0;
const state={attempts:[],tests:[],students:[],subject:'reading',before:'',after:'',indicator:'',className:''};
function testsFor(subject){
 const ids=new Set(state.attempts.filter(submitted).filter(a=>(a.questions||[]).some(q=>subj(q.subject||q.subject_key)===subject&&key(q)&&valid(q))).map(a=>String(a.test_id||'')));
 return state.tests.filter(t=>ids.has(String(t.id||''))).map(t=>({id:String(t.id),name:t.title||t.name||String(t.id),time:examTime(t)})).sort((a,b)=>a.time-b.time);
}
function indicators(testId,subject){
 const found=new Map();
 for(const a of state.attempts)if(submitted(a)&&String(a.test_id||'')===String(testId))
  for(const q of a.questions||[])if(subj(q.subject||q.subject_key)===subject&&key(q)&&valid(q))found.set(key(q),q.indicator_text||q.indicator_name||key(q));
 return found;
}
function fill(){
 if(!$('impactSubject'))return;
 const subject=state.subject=$('impactSubject').value;
 const tests=testsFor(subject);if(!tests.length){$('impactBefore').innerHTML=$('impactAfter').innerHTML='<option value="">لا توجد اختبارات مقاسة</option>';$('impactIndicator').innerHTML='<option value="">لا توجد مؤشرات</option>';return}
 if(!tests.some(x=>x.id===state.before))state.before=tests[0].id;
 if(!tests.some(x=>x.id===state.after))state.after=tests[tests.length-1].id;
 $('impactBefore').innerHTML=options(tests,state.before);$('impactAfter').innerHTML=options(tests,state.after);
 const pre=indicators(state.before,subject),post=indicators(state.after,subject),shared=[...pre.entries()].filter(([k])=>post.has(k)).map(([id,name])=>({id,name}));
 if(!shared.some(x=>x.id===state.indicator))state.indicator=shared[0]?.id||'';
 $('impactIndicator').innerHTML=shared.length?options(shared,state.indicator):'<option value="">لا يوجد مؤشر مشترك بين الاختبارين</option>';
 const classes=[...new Set([...state.students.map(s=>String(s.class_name||'').trim()),...state.attempts.map(a=>String(a.class_name||'').trim())].filter(Boolean))].sort();
 $('impactClass').innerHTML='<option value="">جميع الفصول</option>'+options(classes.map(x=>({id:x,name:x})),state.className);
}
function collect(testId,subject,indicator){
 const map=new Map();
 for(const a of state.attempts){
  if(!submitted(a)||String(a.test_id||'')!==String(testId)||!studentKey(a))continue;
  const qs=rowQuestions(a,subject,indicator);if(!qs.length)continue;
  const id=studentKey(a),previous=map.get(id);
  if(!previous||stamp(a)>stamp(previous.a))map.set(id,{a,qs,id,correct:qs.filter(q=>q.correct).length,total:qs.length,percent:100*qs.filter(q=>q.correct).length/qs.length});
 }
 return map;
}
function report(){
 const target=$('impactResult'),subject=state.subject,preId=state.before,postId=state.after,indicator=state.indicator;
 if(!preId||!postId||!indicator){target.innerHTML='<p>لا يوجد اختباران يحملان بيانات موثوقة للمؤشر نفسه حتى الآن.</p>';return}
 if(preId===postId){target.innerHTML='<p>اختر اختبارين مختلفين؛ لا يمكن قياس الأثر بمقارنة الاختبار بنفسه.</p>';return}
 const preMap=collect(preId,subject,indicator),postMap=collect(postId,subject,indicator);
 const t1=state.tests.find(t=>String(t.id)===preId),t2=state.tests.find(t=>String(t.id)===postId);
 if(examTime(t1)&&examTime(t2)&&examTime(t2)<examTime(t1)){target.innerHTML='<p>يجب أن يكون الاختبار البعدي أحدث من القبلي. عكس الترتيب لا يمثل قياس أثر.</p>';return}
 const ids=[...new Set([...preMap.keys(),...postMap.keys()])];
 const rows=ids.map(id=>{
  const before=preMap.get(id),after=postMap.get(id);
  const a=after?.a||before?.a;const cls=String(a?.class_name||'').trim();
  if(state.className&&cls!==state.className)return null;
  const old=before?.percent??null,now=after?.percent??null,delta=old===null||now===null?null:now-old;
  return{id,name:a?.student_name||a?.full_name||'اسم غير محفوظ',cls,old,now,delta,before,after};
 }).filter(Boolean).sort((a,b)=>a.cls.localeCompare(b.cls,'ar')||a.name.localeCompare(b.name,'ar'));
 const paired=rows.filter(r=>r.delta!==null),improved=paired.filter(r=>r.delta>0),masters=paired.filter(r=>r.now>=80),need=paired.filter(r=>r.now<80);
 const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
 const missing=rows.filter(r=>r.delta===null);
 const fmt=r=>'<tr><td>'+E(r.name)+'</td><td>'+E(r.cls||'—')+'</td><td>'+percent(r.old)+'</td><td>'+percent(r.now)+'</td><td>'+ (r.delta===null?'لا توجد مقارنة':(r.delta>0?'+':'')+r.delta.toFixed(1)+' نقطة')+'</td><td>'+E(r.now===null?'لم يُقَس':label(r.now))+'</td><td>'+E(r.delta===null?'قياس ناقص':r.delta>0?'تحسن':r.delta<0?'انخفض':'ثابت')+'</td></tr>';
 const stats=[['طلاب لهم قياسان',paired.length],['تحسنوا',improved.length],['أتقنوا بعديًا',masters.length],['يحتاجون متابعة',need.length],['قياس غير مكتمل',missing.length],['متوسط الفرق',percent(avg(paired.map(r=>r.delta))) ]];
 target.innerHTML='<header class="impact-report-heading"><div><strong>المملكة العربية السعودية</strong><strong>وزارة التعليم</strong><strong>إدارة التعليم بنجران</strong><strong>مدرسة ابن سينا المتوسطة</strong></div><h2>تقرير قياس أثر نواتج التعلم</h2></header>'+
 '<p><b>المادة:</b> '+E(SUBJECT[subject])+' | <b>المؤشر:</b> '+E($('impactIndicator').selectedOptions[0]?.textContent||indicator)+'</p>'+
 '<p><b>القياس القبلي:</b> '+E(t1?.title||preId)+' | <b>القياس البعدي:</b> '+E(t2?.title||postId)+'</p>'+
 '<div class="impact-stats">'+stats.map(([k,v])=>'<div><span>'+E(k)+'</span><b>'+E(v)+'</b></div>').join('')+'</div>'+
 '<h3>تفصيل الطلاب الذين لديهم قياسان للمؤشر نفسه</h3>'+
 '<div class="table-wrap"><table class="data-table"><thead><tr>'+['الطالب','الفصل','القبلي','البعدي','الفرق','التصنيف الحالي','التغير'].map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+ (rows.length?rows.map(fmt).join(''):'<tr><td colspan="7">لا توجد قياسات مشتركة مؤكدة للطلاب في هذا الاختيار.</td></tr>')+'</tbody></table></div>'+
 '<p class="muted">التصنيف علاجي أقل من 50٪، تعزيز من 50٪ إلى أقل من 80٪، إثرائي/متقن من 80٪ فأعلى. الأرقام تعكس تغير الأداء في المؤشر نفسه فقط، ولا تثبت وحدها نجاح الخطة؛ لا تتوفر حالة تنفيذ الخطة موثقة في هذه المقارنة.</p>'+
 '<footer class="impact-signatures"><span>مسؤول نافس: زرعي شبير<br>التوقيع: _____________</span><span>مدير المدرسة: سعيد الزبادين<br>التوقيع: _____________</span></footer>';
}
function render({attempts,tests,students}){
 state.attempts=attempts||[];state.tests=tests||[];state.students=students||[];
 const dom=$('impactSubject');if(!dom)return;dom.value=state.subject;fill();if(state.before&&state.after&&state.indicator)report();
}
function init(){
 const fields=['Subject','Before','After','Indicator','Class'];
 for(const field of fields)$('impact'+field)?.addEventListener('change',()=>{
  state.subject=$('impactSubject').value;state.before=$('impactBefore').value;state.after=$('impactAfter').value;state.indicator=$('impactIndicator').value;state.className=$('impactClass').value;
  if(['Subject','Before','After'].includes(field))fill();
 });
 $('impactBuild')?.addEventListener('click',report);
 $('impactPrint')?.addEventListener('click',()=>{
  if(!$('impactResult')?.querySelector('.impact-report-heading'))return;
  document.body.classList.add('impact-print-mode');
  window.print();
 });
 window.addEventListener('afterprint',()=>document.body.classList.remove('impact-print-mode'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.NafesImpactReport={render};
})();