(function(){
'use strict';
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=x=>x===null||x===undefined||x===''?null:(Number.isFinite(Number(x))?Number(x):null);
const P=x=>x===null||!Number.isFinite(x)?'لم يُقَس':x.toFixed(1)+'٪';
const K='moallimi_indicator_mastery_threshold';
const sub=x=>({'arabic':'reading','language':'reading','القراءة':'reading','الرياضيات':'math','العلوم':'science'}[String(x||'').toLowerCase()]||String(x||'').toLowerCase());
const uid=a=>String(a.student_id||a.student_key||a.student_no||'').trim();
const date=a=>Date.parse(a.submitted_at||a.updated_at||a.created_at||'')||0;
const time=a=>Date.parse(a.submitted_at||a.updated_at||a.created_at||'')||0;
const valid=q=>typeof q?.correct==='boolean' && q.scorable!==false && Number(q.correct_index??q.correctIndex)!==-1;
const indicator=q=>String(q?.indicator_key||'').trim();
const questionId=q=>String(q?.question_id||q?.questionId||q?.id||'').trim();
const level=q=>{let v=String(q?.cognitive_level||q?.level||q?.bloom_level||'').toLowerCase();return /knowledge|remember|معرفة/.test(v)?'معرفة':/application|apply|تطبيق/.test(v)?'تطبيق':/reason|inference|استدلال/.test(v)?'استدلال':'غير محدد'};
const complete=a=>!!(a.submitted_at||['submitted','completed','finished'].includes(a.status))&&!['expired','in_progress'].includes(a.status)&&!a.snapshot_warning;
const eligible=(a,s)=>Array.isArray(a.questions)&&a.questions.some(q=>sub(q.subject||q.subject_key)===s&&indicator(q));
const filtered=(a,s)=>Array.isArray(a.questions)?a.questions.filter(q=>sub(q.subject||q.subject_key)===s&&indicator(q)&&valid(q)):[];
const classify=(v,t)=>v===null?'لم يُقَس / لم يختبر':v<50?'علاجي':v<t?'تعزيز':'إثرائي';
const table=(headers,rows)=>'<div class="iad-scroll"><table class="iad-table"><thead><tr>'+headers.map(x=>'<th>'+E(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">لا توجد بيانات مؤكدة قابلة للتحليل.</td></tr>')+'</tbody></table></div>';
const box=(title,html)=>'<section class="iad-section"><h2>'+E(title)+'</h2>'+html+'</section>';
const score=g=>g&&g.t?100*g.c/g.t:null;
const cats=(x,t)=>({therapy:x.filter(p=>p.v!==null&&p.v<50),boost:x.filter(p=>p.v!==null&&p.v>=50&&p.v<t),enrich:x.filter(p=>p.v!==null&&p.v>=t)});
const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c');
let context=null;
function render({test,subject,testId,className,recs,attempts,students,part}){
 const threshold=Math.max(1,Math.min(100,Number(localStorage.getItem(K))||80));
 const firstDate=recs.map(r=>time(r.a)).filter(Boolean).sort((a,b)=>a-b)[0];
 const ready=recs.filter(r=>eligible(r.a,subject));const data=ready.map(r=>({a:r.a,qs:filtered(r.a,subject)})).filter(r=>r.qs.length);
 const identified=new Map();
 for(const r of data){const k=uid(r.a);if(k&&(!identified.has(k)||time(r.a)>time(identified.get(k).a)))identified.set(k,r)}
 const people=[...identified.values()];
 const inx=new Map(),qmap=new Map(),cognitive=new Map(),studentsData=[];
 for(const r of people){
  const groups=new Map();
  for(const [index,q] of r.qs.entries()){
   const id=indicator(q),g=groups.get(id)||{key:id,text:q.indicator_text||q.indicator_name||id,c:0,t:0};
   g.t++;if(q.correct)g.c++;groups.set(id,g);
   const z=inx.get(id)||{key:id,text:q.indicator_text||q.indicator_name||id,c:0,t:0,persons:[]};
   z.t++;if(q.correct)z.c++;inx.set(id,z);
   const l=level(q),lv=cognitive.get(l)||{c:0,t:0};lv.t++;if(q.correct)lv.c++;cognitive.set(l,lv);
   const qid=questionId(q);
   if(qid){
    const ky=id+'::'+qid,h=qmap.get(ky)||{id:qid,indicator:g.text,level:l,correct:0,wrong:0,blank:0,total:0,unknown:0};
    h.total++;if(q.correct)h.correct++;else if(q.selected_index===null||q.selectedIndex===null||q.answered===false||q.unanswered===true)h.blank++;else if(q.selected_index!==undefined||q.selectedIndex!==undefined||q.selected_answer!==undefined||q.answer!==undefined||q.answered===true)h.wrong++;else h.unknown++;
    qmap.set(ky,h);
   }
  }
  const total=r.qs.length,correct=r.qs.filter(q=>q.correct).length;
  const p={id:uid(r.a),name:r.a.student_name||r.a.full_name||'اسم غير مسجل',score:correct,total,v:100*correct/total,groups};
  studentsData.push(p);
  for(const g of groups.values())inx.get(g.key).persons.push({name:p.name,id:p.id,v:score(g)});
 }
 const indicators=[...inx.values()].map(g=>{const measured=g.persons.filter(p=>p.v!==null),masters=measured.filter(p=>p.v>=threshold);return {...g,mean:measured.length?measured.reduce((s,p)=>s+p.v,0)/measured.length:null,mastery:measured.length?masters.length/measured.length*100:null,measured:measured.length,masters:masters.length,not:measured.length-masters.length};}).sort((a,b)=>(a.mastery??101)-(b.mastery??101)||(a.mean??101)-(b.mean??101));
 const previous=new Map();
 const currentMax=Math.max(0,...recs.map(r=>time(r.a)));
 for(const a of attempts){if(!complete(a)||String(a.test_id||'')===String(testId)||(!uid(a))||time(a)>=currentMax||!eligible(a,subject))continue;
  if(className&&String(a.class_name||'').trim()!==className)continue;
  const by=new Map();
  for(const q of filtered(a,subject)){const id=indicator(q),g=by.get(id)||{c:0,t:0};g.t++;if(q.correct)g.c++;by.set(id,g)}
  for(const [id,g] of by){const key=uid(a)+'::'+id,old=previous.get(key);if(!old||time(a)>old.at)previous.set(key,{at:time(a),v:score(g)});}
 }
 const changes=indicators.map(g=>{const both=g.persons.map(p=>({p,prior:previous.get(p.id+'::'+g.key)})).filter(x=>x.prior&&x.prior.v!==null&&x.p.v!==null);if(!both.length)return null;
  const old=both.reduce((s,x)=>s+x.prior.v,0)/both.length,now=both.reduce((s,x)=>s+x.p.v,0)/both.length,d=now-old;
  return {key:g.key,text:g.text,old,now,d,n:both.length,improved:both.filter(x=>x.p.v>x.prior.v).length,below:both.filter(x=>x.p.v<threshold).length};
 }).filter(Boolean);
 const eligibleCount=Number(part?.total);const target=Number.isFinite(eligibleCount)&&eligibleCount>=0?eligibleCount:null;
 const participation=target!==null&&target>0?100*(Number(part?.tested??recs.length))/target:null;
 const missed=part?.missing?.length??(target===null?null:Math.max(0,target-Number(part?.tested??recs.length)));
 const strengths=indicators.filter(x=>x.mastery!==null).slice().sort((a,b)=>b.mastery-a.mastery||b.mean-a.mean);
 const cs=cats(studentsData,threshold),weakLevels=['معرفة','تطبيق','استدلال'].filter(x=>cognitive.get(x)?.t).sort((a,b)=>score(cognitive.get(a))-score(cognitive.get(b)));
 const unsupported=recs.length-data.length;
 const heading='<div class="iad-meta"><span>الاختبار: <b>'+E(test.title||'اختبار نافس')+'</b></span><span>المادة: <b>'+E({reading:'القراءة',math:'الرياضيات',science:'العلوم'}[subject]||subject)+'</b></span><span>الصف: <b>الثالث المتوسط</b></span><span>التاريخ: <b>'+(firstDate?E(new Date(firstDate).toLocaleDateString('ar-SA')):'غير متوفر')+'</b></span><span>الدرجة الكلية: <b>'+E(recs[0]?.m?.total??'غير محددة')+'</b></span><span>المستهدفون: <b>'+E(target??'غير متوفر')+'</b></span><span>المختبرون: <b>'+E(part?.tested??recs.length)+'</b></span><span>لم يختبروا: <b>'+E(missed??'غير متوفر')+'</b></span><span>المشاركة: <b>'+P(participation)+'</b></span><span>متوسط الدرجة: <b>'+(recs.length?(recs.reduce((s,x)=>s+x.m.score,0)/recs.length).toFixed(1):'—')+'</b></span><span>التحصيل: <b>'+P(recs.length?recs.reduce((s,x)=>s+x.m.percent,0)/recs.length:null)+'</b></span><span>أعلى / أقل: <b>'+E(recs.length?Math.max(...recs.map(x=>x.m.score))+' / '+Math.min(...recs.map(x=>x.m.score)):'—')+'</b></span><span>إتقان الطلاب المقاسين بالمؤشرات: <b>'+P(studentsData.length?100*studentsData.filter(p=>p.v>=threshold).length/studentsData.length:null)+'</b></span></div>';
 const meta=box('بيانات الاختبار ومؤشرات الأداء',heading+'<p class="iad-note">النتائج التي لا تتضمن سجلات أسئلة ومؤشرات موثوقة مستبعدة من تحليل المهارات دون تغيير درجاتها المحفوظة. السجلات المستبعدة: '+unsupported+'.</p>');
 const questionRows=[...qmap.values()].map((g,i)=>{let known=g.correct+g.wrong+g.blank,pp=known?100*g.correct/known:null;return [E(i+1),E(g.indicator),E(g.level),E(g.correct)+' / '+P(known?100*g.correct/known:null),E(g.wrong)+' / '+P(known?100*g.wrong/known:null),E(g.blank)+(g.unknown?' (غير محسوم: '+g.unknown+')':''),pp===null?'غير متحقق':pp>=80?'قوي':pp>=50?'متوسط':'يحتاج تحسينًا']});
 const qs=box('تحليل الأسئلة',table(['رقم','المؤشر / المهارة','المستوى المعرفي','صحيح (عدد / نسبة)','خاطئ (عدد / نسبة)','لم يجب','مستوى السؤال'],questionRows)+(qmap.size?'':'<p class="iad-note">تعذر تجميع السؤال بثقة: لم تحفظ معرّفات الأسئلة في السجلات المتاحة. لا يُستخدم ترتيب الأسئلة المفترض.</p>'));
 const indRows=indicators.map(g=>[E(g.text),E(g.measured),E(g.t),P(g.mean),P(g.mastery),E(g.masters),E(g.not),E(g.persons.filter(p=>p.v<threshold).map(p=>p.name).join('، ')||'—'),g.mastery>=threshold?'نقطة قوة':g.mastery>=50?'متوسط':'فجوة تعلم']);
 const inds=box('تحليل مؤشرات نافس — من الأضعف إلى الأقوى',table(['المؤشر كاملًا','طلاب قيسوا','إجمالي إجابات المؤشر','متوسط الأداء','نسبة الإتقان','متقنون','غير متقنين','أسماء غير المتقنين','التصنيف'],indRows));
 const cards=box('أبرز الفجوات التعليمية',indicators.slice(0,Math.min(5,indicators.length)).map(x=>'<p>'+E(x.text)+' — '+P(x.mastery)+'</p>').join('')||'<p>لا توجد بيانات مؤكدة.</p>')+ '<h2>نقاط القوة</h2>'+(strengths.slice(0,3).map(x=>'<p>'+E(x.text)+' — '+P(x.mastery)+'</p>').join('')||'<p>لا توجد بيانات مؤكدة.</p>'));
 const levels=box('الأداء حسب المستوى المعرفي',table(['المستوى','نسبة الأداء','عدد الأسئلة المقاسة'],['معرفة','تطبيق','استدلال'].map(l=>[l,P(score(cognitive.get(l))),E(cognitive.get(l)?.t??0)]))+'<p>أضعف مستوى: <b>'+E(weakLevels[0]||'لم يُقَس')+'</b></p>');
 const interventions=box('الطلاب المستهدفون بالتدخل',table(['الطالب','فئة التدخل','مؤشرات تحتاج دعمًا'],studentsData.map(p=>[E(p.name),E(classify(p.v,threshold)),E([...p.groups.values()].filter(g=>score(g)<threshold).map(g=>g.text).join('؛ ')||'لا يوجد')]))+'<p class="iad-note">التصنيف بحسب مستوى المؤشرات المقاسة فقط، ولا يصنف غير المختبرين راسبين أو غير متقنين.</p>');
 const lists=box('قوائم الطلاب لكل مؤشر',indicators.map(g=>{const groups={master:g.persons.filter(p=>p.v>=threshold),boost:g.persons.filter(p=>p.v>=50&&p.v<threshold),therapy:g.persons.filter(p=>p.v<50)};return '<h3>'+E(g.text)+'</h3>'+table(['متقنون','يحتاجون تعزيزًا','يحتاجون علاجًا','لم يقاسوا'],[[E(groups.master.map(p=>p.name).join('، ')||'—'),E(groups.boost.map(p=>p.name).join('، ')||'—'),E(groups.therapy.map(p=>p.name).join('، ')||'—'),E((part?.missing||[]).map(p=>typeof p==='string'?p:p?.name||p?.student_name||'').filter(Boolean).join('، ')||'غير محدد')]])}).join('')||'<p>لا توجد سجلات مؤشرات.</p>');
 const impact=changes.length?box('قياس الأثر والتقدم — المؤشر نفسه لدى الطالب نفسه',table(['المؤشر','القياس السابق','القياس الحالي','التغير بالنقاط','الحالة','طلاب تحسنوا','ما زالوا دون الإتقان','طلاب مشتركون'],changes.map(g=>[E(g.text),P(g.old),P(g.now),(g.d>0?'+':'')+g.d.toFixed(1),Math.abs(g.d)<.01?'ثابت':g.d>0?'تحسن':'تراجع',E(g.improved),E(g.below),E(g.n)]))):'';
 const executive=box('الملخص التنفيذي','<div class="iad-meta"><span>المشاركة: '+P(participation)+'</span><span>الإتقان: '+P(studentsData.length?100*studentsData.filter(p=>p.v>=threshold).length/studentsData.length:null)+'</span><span>علاجي: '+cs.therapy.length+'</span><span>تعزيز: '+cs.boost.length+'</span><span>إثراء: '+cs.enrich.length+'</span><span>أضعف مستوى: '+E(weakLevels[0]||'لم يُقَس')+'</span></div><p><b>أقوى 3 مؤشرات:</b> '+E(strengths.slice(0,3).map(x=>x.text).join('؛ ')||'غير متاح')+'</p><p><b>أضعف 3 مؤشرات:</b> '+E(indicators.slice(0,3).map(x=>x.text).join('؛ ')||'غير متاح')+'</p><p><b>التوصية:</b> '+E(indicators.length?'ابدأ بمعالجة المؤشرات الأقل إتقانًا، ثم نفّذ قياسًا بعديًا يقيس المؤشرات نفسها.':'تحقق من حفظ معرف المؤشر لكل سؤال قبل اتخاذ قرار علاجي.')+'</p>');
 const options='<div class="iad-actions no-print"><label>حد الإتقان <input id="iadThreshold" type="number" min="1" max="100" value="'+threshold+'" style="width:72px">٪</label><button id="iadRebuild" type="button">تحديث التقرير</button><button id="iadPlan" type="button" '+(studentsData.length?'':'disabled')+'>إنشاء خطة علاجية وإثرائية</button><button id="iadImpact" type="button" '+(changes.length?'':'disabled')+'>تقرير قياس الأثر</button></div>';
 context={studentsData,indicators,changes,threshold};
 return '<div class="iad-root">'+options+meta+qs+inds+cards+levels+interventions+lists+impact+'<section class="iad-page">'+executive+'</section></div>';
}
function install(){
 document.addEventListener('click',e=>{
  if(e.target?.id==='iadRebuild'){const n=N(document.getElementById('iadThreshold')?.value);if(n===null||n<1||n>100){alert('أدخل حد إتقان من 1 إلى 100.');return;}localStorage.setItem(K,String(n));document.getElementById('buildSubjectReportBtn')?.click();}
  if(e.target?.id==='iadPlan'&&context){const weak=context.indicators;const rows=context.studentsData.map(p=>[E(p.name),E(classify(p.v,context.threshold)),E([...p.groups.values()].filter(g=>score(g)<context.threshold).map(g=>g.text).join('؛ ')||'إثراء في المؤشرات المتقنة')]);const node=document.createElement('div');node.className='iad-generated';node.innerHTML=box('خطة علاجية وتعزيزية وإثرائية — مؤشر لكل طالب',table(['الطالب','الخطة','المؤشرات المستهدفة'],rows));document.querySelector('#subjectOfficialReport .iad-generated')?.remove();document.querySelector('#subjectOfficialReport .iad-root')?.append(node);}
  if(e.target?.id==='iadImpact'&&context?.changes?.length){document.querySelector('#subjectOfficialReport .iad-section:has(.iad-table)');const btn=document.getElementById('printSubjectReportBtn');if(btn)btn.click();}
 });
 const style=document.createElement('style');style.textContent='.iad-root{font-family:inherit;color:#243f40}.iad-section{margin:16px 0;padding:14px;border:1px solid #d4e5df;border-radius:12px;break-inside:auto;background:white}.iad-section h2{font-size:16px;color:#065f46;margin:0 0 10px}.iad-section h3{font-size:13px;margin:12px 0 6px}.iad-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.iad-meta span{padding:7px;background:#f3f8f6;border-radius:6px;font-size:12px}.iad-table{width:100%;border-collapse:collapse;font-size:11px;text-align:right}.iad-table th,.iad-table td{border:1px solid #d7e3dd;padding:6px;vertical-align:top;overflow-wrap:anywhere}.iad-table th{background:#eaf5ef}.iad-scroll{overflow-x:auto}.iad-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px}.iad-actions button{padding:8px 10px;background:#066b58;color:white;border:0;border-radius:7px;cursor:pointer}.iad-actions button:disabled{opacity:.4;cursor:not-allowed}.iad-note{font-size:11px;color:#697474}.iad-page{break-before:page}@media print{.iad-actions{display:none!important}.iad-section{break-inside:auto}.iad-table tr{break-inside:avoid}.iad-meta{grid-template-columns:repeat(3,1fr)}.iad-scroll{overflow:visible}.iad-root{font-size:11px}}';document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
window.NafesIndicatorDetailedReport={render};
})();
