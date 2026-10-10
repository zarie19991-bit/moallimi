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
 const firstDate=Date.parse(test?.published_at||test?.created_at||'')||recs.map(r=>time(r.a)).filter(Boolean).sort((a,b)=>a-b)[0];
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
   const z=inx.get(id)||{key:id,text:q.indicator_text||q.indicator_name||id,c:0,t:0,persons:[],questionIds:new Set()};
   z.t++;if(q.correct)z.c++;if(questionId(q))z.questionIds.add(questionId(q));inx.set(id,z);
   const l=level(q),lv=cognitive.get(l)||{c:0,t:0};lv.t++;if(q.correct)lv.c++;cognitive.set(l,lv);
   const qid=questionId(q);
   if(qid){
    const ky=id+'::'+qid,h=qmap.get(ky)||{id:qid,number:null,indicator:g.text,level:l,correct:0,wrong:0,blank:0,total:0,unknown:0};
    h.total++;if(q.correct)h.correct++;else if(q.answer===null||q.selected_index===null||q.selectedIndex===null||q.selected_answer===null||q.answered===false||q.unanswered===true)h.blank++;else if(q.selected_index!=null||q.selectedIndex!=null||q.selected_answer!=null||q.answer!=null||q.answered===true)h.wrong++;else h.unknown++;
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
 const currentByStudent=new Map(recs.filter(r=>uid(r.a)).map(r=>[uid(r.a),time(r.a)]));
 for(const a of attempts){if(!complete(a)||String(a.test_id||'')===String(testId)||(!uid(a))||!currentByStudent.has(uid(a))||time(a)>=currentByStudent.get(uid(a))||!eligible(a,subject))continue;
  if(className&&String(a.class_name||'').trim()!==className)continue;
  const by=new Map();
  for(const q of filtered(a,subject)){const id=indicator(q),g=by.get(id)||{c:0,t:0};g.t++;if(q.correct)g.c++;by.set(id,g)}
  for(const [id,g] of by){const key=uid(a)+'::'+id,old=previous.get(key);if(!old||time(a)>old.at)previous.set(key,{at:time(a),v:score(g)});}
 }
 const earliestCurrent=Math.min(...recs.map(r=>time(r.a)).filter(Boolean));
 const historicalKeys=new Set(attempts.filter(a=>complete(a)&&String(a.test_id||'')!==String(testId)&&time(a)<earliestCurrent).flatMap(a=>filtered(a,subject).map(indicator)));
 const sharedIndicators=indicators.filter(g=>historicalKeys.has(g.key));
 const priorExamList=new Map();for(const a of attempts){if(!complete(a)||String(a.test_id||'')===String(testId)||time(a)>=Math.min(...recs.map(r=>time(r.a)).filter(Boolean)))continue;if(!filtered(a,subject).some(q=>inx.has(indicator(q))))continue;const tid=String(a.test_id||'');if(!tid)continue;const previous=priorExamList.get(tid);if(!previous||time(a)>time(previous))priorExamList.set(tid,a)}
 const latestPrior=[...priorExamList.values()].sort((a,b)=>time(b)-time(a))[0];
 const impactMetadata='<p class="iad-note">الاختبار السابق: '+E(latestPrior?.title||'غير محدد')+' — التاريخ: '+E(latestPrior&&time(latestPrior)?new Date(time(latestPrior)).toLocaleDateString('ar-SA'):'غير متوفر')+' | الاختبار الحالي: '+E(test?.title||'اختبار نافس')+' — التاريخ: '+E(firstDate?new Date(firstDate).toLocaleDateString('ar-SA'):'غير متوفر')+'</p>';
 const changes=indicators.map(g=>{const both=g.persons.map(p=>({p,prior:previous.get(p.id+'::'+g.key)})).filter(x=>x.prior&&x.prior.v!==null&&x.p.v!==null);if(!both.length)return null;
  const old=both.reduce((s,x)=>s+x.prior.v,0)/both.length,now=both.reduce((s,x)=>s+x.p.v,0)/both.length,d=now-old;
  return {key:g.key,text:g.text,old,now,d,n:both.length,improved:both.filter(x=>x.p.v>x.prior.v).length,below:both.filter(x=>x.p.v<threshold).length};
 }).filter(Boolean);
 const eligibleCount=part?.total===null||part?.total===undefined?NaN:Number(part.total);const target=Number.isFinite(eligibleCount)&&eligibleCount>=0?eligibleCount:null;
 const participation=target!==null&&target>0?100*(Number(part?.tested??recs.length))/target:null;
 const missed=part?.missing?.length??(target===null?null:Math.max(0,target-Number(part?.tested??recs.length)));
 const strengths=indicators.filter(x=>x.mastery!==null).slice().sort((a,b)=>b.mastery-a.mastery||b.mean-a.mean);
 const cs=cats(studentsData,threshold),weakLevels=['معرفة','تطبيق','استدلال'].filter(x=>cognitive.get(x)?.t).sort((a,b)=>score(cognitive.get(a))-score(cognitive.get(b)));
 const unsupported=recs.length-people.length;
 const heading='<div class="iad-meta"><span>الاختبار: <b>'+E(test.title||'اختبار نافس')+'</b></span><span>المادة: <b>'+E({reading:'القراءة',math:'الرياضيات',science:'العلوم'}[subject]||subject)+'</b></span><span>الصف: <b>الثالث المتوسط</b></span><span>التاريخ: <b>'+(firstDate?E(new Date(firstDate).toLocaleDateString('ar-SA')):'غير متوفر')+'</b></span><span>الدرجة الكلية: <b>'+E(recs[0]?.m?.total??'غير محددة')+'</b></span><span>المستهدفون: <b>'+E(target??'غير متوفر')+'</b></span><span>المختبرون: <b>'+E(part?.tested??recs.length)+'</b></span><span>لم يختبروا: <b>'+E(missed??'غير متوفر')+'</b></span><span>المشاركة: <b>'+P(participation)+'</b></span><span>متوسط الدرجة: <b>'+(recs.length?(recs.reduce((s,x)=>s+x.m.score,0)/recs.length).toFixed(1):'—')+'</b></span><span>التحصيل: <b>'+P(recs.length?recs.reduce((s,x)=>s+x.m.percent,0)/recs.length:null)+'</b></span><span>أعلى درجة: <b>'+E(recs.length?Math.max(...recs.map(x=>x.m.score)):'—')+'</b></span><span>أقل درجة: <b>'+E(recs.length?Math.min(...recs.map(x=>x.m.score)):'—')+'</b></span><span>نسبة الطلاب المتقنين في الاختبار: <b>'+P(studentsData.length?100*studentsData.filter(p=>p.v>=threshold).length/studentsData.length:null)+'</b></span><span>حد الإتقان المعتمد: <b>'+E(threshold)+'٪</b></span></div>';
 const officialHeader='<header class="iad-official-head"><b>وزارة التعليم</b><b>الإدارة العامة للتعليم بمنطقة نجران</b><b>مدرسة ابن سينا المتوسطة</b></header>';
 const meta=box('بيانات الاختبار ومؤشرات الأداء',heading+'<p class="iad-note">النتائج التي لا تتضمن سجلات أسئلة ومؤشرات موثوقة مستبعدة من تحليل المهارات دون تغيير درجاتها المحفوظة. السجلات المستبعدة: '+unsupported+'.</p>'+(part?.warning?'<p class="iad-note">تنبيه المشاركة: '+E(part.warning)+'</p>':''));
 const questionOrder=new Map();for(const r of people)for(const q of r.qs){const id=indicator(q)+'::'+questionId(q);if(questionId(q)&&!questionOrder.has(id))questionOrder.set(id,questionOrder.size+1)}
 const questionRows=[...qmap.entries()].sort((a,b)=>(questionOrder.get(a[0])??99999)-(questionOrder.get(b[0])??99999)).map(([key,g],i)=>{let known=g.total,pp=known?100*g.correct/known:null;return [E(questionOrder.get(key)??'غير محدد'),E(g.indicator),E(g.level),E(g.correct)+' / '+P(known?100*g.correct/known:null),E(g.wrong)+' / '+P(known?100*g.wrong/known:null),E(g.blank)+(g.unknown?' (غير محسوم: '+g.unknown+')':''),pp===null?'غير متحقق':pp>=80?'قوي':pp>=50?'متوسط':'يحتاج تحسينًا']});
 const qs=box('تحليل الأسئلة',table(['رقم','المؤشر / المهارة','المستوى المعرفي','صحيح (عدد / نسبة)','خاطئ (عدد / نسبة)','لم يجب','مستوى السؤال'],questionRows)+(qmap.size?'':'<p class="iad-note">تعذر تجميع السؤال بثقة: لم تحفظ معرّفات الأسئلة في السجلات المتاحة. لا يُستخدم ترتيب الأسئلة المفترض.</p>'));
 const indRows=indicators.map(g=>[E(g.text),E(g.questionIds.size||'غير محفوظ'),E(g.measured),P(g.mean),P(g.mastery),E(g.masters),E(g.not),g.mastery>=threshold?'نقطة قوة':g.mastery>=50?'متوسط':'فجوة تعلم']);
 const inds=box('تحليل مؤشرات نافس — من الأضعف إلى الأقوى',table(['المؤشر كاملًا','عدد الأسئلة المختلفة','طلاب قيسوا','متوسط الأداء','نسبة الإتقان','متقنون','غير متقنين','التصنيف'],indRows));
 const strengthsAtMastery=strengths.filter(x=>x.mastery>=threshold);
 const cards=box('أبرز الفجوات التعليمية',table(['المؤشر','متوسط الأداء','نسبة الإتقان','طلاب يحتاجون للتدخل'],indicators.filter(g=>g.mastery!==null).slice(0,5).map(g=>[E(g.text),P(g.mean),P(g.mastery),E(g.not)]))+'<h2>نقاط القوة</h2>'+(strengthsAtMastery.length?'':'<p>لا توجد مؤشرات بلغت حد الإتقان، وفيما يلي المؤشرات الأعلى أداءً نسبيًا.</p>')+(strengthsAtMastery.length?strengthsAtMastery:strengths).slice(0,3).map(x=>'<p>'+E(x.text)+' — '+P(x.mastery)+'</p>').join(''));
 const cognitiveDistinct=new Map();for(const x of qmap.values())cognitiveDistinct.set(x.level,(cognitiveDistinct.get(x.level)||0)+1);
 const levels=box('الأداء حسب المستوى المعرفي',table(['المستوى','عدد الأسئلة الفعلية','عدد الاستجابات المقاسة','نسبة الأداء'],['معرفة','تطبيق','استدلال'].map(l=>[l,E(cognitiveDistinct.get(l)??0),E(cognitive.get(l)?.t??0),P(score(cognitive.get(l)))]))+'<p>أضعف مستوى: <b>'+E(weakLevels[0]||'لم يُقَس')+'</b></p>');
 const interventions=box('الطلاب المستهدفون بالتدخل',table(['فئة التدخل','المعيار','عدد الطلاب'],[['علاجي','أقل من 50%',E(cs.therapy.length)],['تعزيز','50% إلى أقل من '+threshold+'%',E(cs.boost.length)],['إثرائي',threshold+'% فأعلى',E(cs.enrich.length)]]));
 const lists=box('قوائم الطلاب لكل مؤشر',indicators.map(g=>{const groups={master:g.persons.filter(p=>p.v>=threshold),boost:g.persons.filter(p=>p.v>=50&&p.v<threshold),therapy:g.persons.filter(p=>p.v<50)};return '<h3>'+E(g.text)+'</h3>'+table(['متقنون','يحتاجون تعزيزًا','يحتاجون علاجًا','لم يقاسوا'],[[E(groups.master.map(p=>p.name).join('، ')||'—'),E(groups.boost.map(p=>p.name).join('، ')||'—'),E(groups.therapy.map(p=>p.name).join('، ')||'—'),E([...new Set([...(part?.missing||[]).map(p=>typeof p==='string'?p:p?.name||p?.student_name||''),...studentsData.filter(p=>!g.persons.some(y=>y.id===p.id)).map(p=>p.name)])].filter(Boolean).join('، ')||'غير محدد')]])}).join('')||'<p>لا توجد سجلات مؤشرات.</p>');
 const impact=sharedIndicators.length?box('قياس الأثر والتقدم — المؤشر نفسه لدى الطالب نفسه',impactMetadata+(!changes.length?'<p class="iad-note">يوجد مؤشر مشترك بين الاختبارين، لكن لا توجد بيانات موثوقة للطالب نفسه في القياسين؛ لا يمكن حساب التغير أو عدد المتحسنين حتى تتوافر نتائج قابلة للمقارنة.</p>':'')+table(['المؤشر','القياس السابق','القياس الحالي','التغير بالنقاط','الحالة','طلاب تحسنوا','ما زالوا دون الإتقان','طلاب مشتركون'],changes.map(g=>[E(g.text),P(g.old),P(g.now),(g.d>0?'+':'')+g.d.toFixed(1),Math.abs(g.d)<.01?'ثابت':g.d>0?'تحسن':'تراجع',E(g.improved),E(g.below),E(g.n)]))):'';
 const untested=(part?.missing||[]).map(p=>({name:typeof p==='string'?p:p.name||p.student_name||'',why:'لم يختبر'})).filter(x=>x.name);
 const noIndicator=recs.filter(r=>!people.some(p=>uid(p.a)&&uid(p.a)===uid(r.a))).map(r=>({name:r.a.student_name||r.a.full_name||'اسم غير مسجل',why:'لم يُقَس المؤشر في المحاولة المحفوظة'}));
 const notMeasured=[...new Map([...untested,...noIndicator].map(x=>[x.name,x])).values()];
 const unmeasured=box('لم يُقَس / لم يختبر',notMeasured.length?table(['م','الطالب','الحالة'],notMeasured.map((x,i)=>[E(i+1),E(x.name),E(x.why)])):'<p>لا توجد أسماء مؤكدة لطلاب غير مقاسين، أو لم تصل قائمة المستهدفين.</p>');
 const recommendations=indicators.filter(g=>g.mastery!==null).slice(0,3).map(g=>'معالجة المؤشر «'+g.text+'» بورقة عمل موجهة ثم اختبار بعدي للمؤشر ذاته').concat(weakLevels.length?['تكثيف أنشطة مستوى '+weakLevels[0]]:[]);
 const approvals='<footer class="iad-approvals"><div>معلم المادة: <b>زرعي شبير</b><p>التوقيع: ______________</p></div><div>مسؤول نافس: <b>______________</b><p>التوقيع: ______________</p></div><div>مدير المدرسة: <b>______________</b><p>التوقيع: ______________</p></div></footer>';
 const executive=box('الملخص التنفيذي','<div class="iad-meta"><span>المشاركة: '+P(participation)+'</span><span>التحصيل: '+P(recs.length?recs.reduce((t,r)=>t+r.m.percent,0)/recs.length:null)+'</span><span>الإتقان: '+P(studentsData.length?100*studentsData.filter(p=>p.v>=threshold).length/studentsData.length:null)+'</span><span>علاجي: '+cs.therapy.length+'</span><span>تعزيز: '+cs.boost.length+'</span><span>إثراء: '+cs.enrich.length+'</span><span>أضعف مستوى: '+E(weakLevels[0]||'لم يُقَس')+'</span></div><p><b>'+(strengthsAtMastery.length?'أقوى 3 مؤشرات':'أعلى 3 مؤشرات أداءً نسبيًا')+':</b> '+E((strengthsAtMastery.length?strengthsAtMastery:strengths).slice(0,3).map(x=>x.text).join('؛ ')||'غير متاح')+'</p><p><b>أضعف 3 مؤشرات:</b> '+E(indicators.slice(0,3).map(x=>x.text).join('؛ ')||'غير متاح')+'</p><p><b>التوصية:</b> '+E(recommendations.length?recommendations.join('؛ '):'تحقق من حفظ معرف المؤشر لكل سؤال قبل اتخاذ قرار علاجي.')+'</p>');
 const options='<div class="iad-actions no-print"><button id="iadPrintExecutive" type="button">طباعة التقرير التنفيذي</button><button id="iadPrintFull" type="button">طباعة التقرير الكامل مع ملحق الطلاب</button><label>حد الإتقان <input id="iadThreshold" type="number" min="1" max="100" value="'+threshold+'" style="width:72px">٪</label><button id="iadRebuild" type="button">تحديث التقرير</button><button id="iadPlan" type="button" '+(studentsData.length?'':'disabled')+'>إنشاء خطة علاجية وإثرائية</button><button id="iadImpact" type="button" '+(sharedIndicators.length?'':'disabled')+'>تقرير قياس الأثر</button></div>';
 context={studentsData,indicators,changes,sharedIndicators,threshold};
 const appendix=box('تفصيل الطلاب حسب المؤشر',indicators.map(g=>{const categories=[['متقنون',g.persons.filter(p=>p.v>=threshold)],['يحتاجون تعزيزًا',g.persons.filter(p=>p.v>=50&&p.v<threshold)],['يحتاجون علاجًا',g.persons.filter(p=>p.v<50)]];const missing=[...new Set([...(part?.missing||[]).map(p=>typeof p==='string'?p:p?.name||p?.student_name||''),...studentsData.filter(p=>!g.persons.some(y=>y.id===p.id)).map(p=>p.name)])].filter(Boolean);return '<div class="iad-appendix-indicator"><h3>'+E(g.text)+'</h3>'+table(['الفئة','أسماء الطلاب'],[...categories.map(([name,persons])=>[E(name),E([...new Set(persons.map(p=>p.name))].join('، ')||'—')]),['لم يُقاسوا',E(missing.join('، ')||'—')]])+'</div>'}).join('')+'<h3>تفصيل التدخل بحسب الطالب</h3>'+table(['الطالب','فئة التدخل','المؤشرات المطلوبة'],studentsData.map(p=>[E(p.name),E(classify(p.v,threshold)),E([...p.groups.values()].filter(g=>score(g)<threshold).map(g=>g.text).join('؛ ')||'لا يوجد')]))+'<h3>لم يُقاسوا</h3>'+table(['الطالب','الحالة'],notMeasured.map(p=>[E(p.name),E(p.why)])));
 return '<div class="iad-root" dir="rtl">'+options+'<div class="iad-executive-report">'+officialHeader+meta+inds+cards+levels+interventions+impact+'<section class="iad-page">'+executive+approvals+'</section></div><div class="iad-appendix" hidden>'+qs+appendix+'</div></div>';
}
function printIndicator(full){const preview=document.querySelector('#indicatorReportPreview .iad-root');if(!preview)return;const root=document.getElementById('printRoot');if(!root)return;const copy=preview.cloneNode(true);copy.querySelectorAll('.iad-actions,.iad-generated').forEach(x=>x.remove());const appendix=copy.querySelector('.iad-appendix');if(appendix)appendix.hidden=!full;root.innerHTML='<article class="subject-analysis-sheet official-analysis-sheet" data-indicator-report="true">'+copy.outerHTML+'</article>';root.setAttribute('aria-hidden','false');window.print();}
function printStandalone(html){const root=document.getElementById('printRoot');if(!root)return;root.innerHTML='<article class="subject-analysis-sheet official-analysis-sheet"><div class="iad-root">'+html+'</div></article>';root.setAttribute('aria-hidden','false');window.print();}
function install(){
 document.addEventListener('click',e=>{
  if(e.target?.id==='iadPrintExecutive'&&e.target.closest('#indicatorReportView'))printIndicator(false);
  if(e.target?.id==='iadPrintFull'&&e.target.closest('#indicatorReportView'))printIndicator(true);
  if(e.target?.id==='iadRebuild'&&e.target.closest('#indicatorReportView')){const n=N(document.getElementById('iadThreshold')?.value);if(n===null||n<1||n>100){alert('أدخل حد إتقان من 1 إلى 100.');return;}localStorage.setItem(K,String(n));document.getElementById('buildIndicatorReportBtn')?.click();}
  if(e.target?.id==='iadPlan'&&context&&e.target.closest('#indicatorReportView')){
   const targets=context.studentsData.flatMap(p=>{
     const weak=[...p.groups.values()].filter(g=>score(g)<context.threshold);
     if(weak.length)return weak.map(g=>({name:p.name,tier:classify(score(g),context.threshold),indicator:g.text,initial:score(g)}));
     return [{name:p.name,tier:'إثرائي',indicator:[...p.groups.values()].sort((a,b)=>score(b)-score(a))[0]?.text||'المؤشرات المتقنة',initial:p.v}];
   });
   const rows=targets.map((x,i)=>{
     const technique=x.tier==='علاجي'?'شرح موجّه وتدريبات متدرجة وتصحيح الأخطاء':x.tier==='تعزيز'?'تدريب تطبيقي ومناقشة وتصحيح فوري':'مهام استدلالية وتحديات إثرائية';
     return [E(i+1),E(x.name),E(x.tier),E(x.indicator),P(x.initial),E(technique),'الأسبوع 1: تشخيص ومراجعة، الأسبوعان 2 و3: تدخل وتدريب، الأسبوع 4: قياس بعدي للمؤشر نفسه',P(context.threshold)];
   });
   const node=document.createElement('div');node.className='iad-generated';
   node.innerHTML=box('خطة علاجية وتعزيزية وإثرائية — مبنية على مؤشرات كل طالب','<p>الهدف: تحقيق حد الإتقان في المهارة ذاتها خلال أربعة أسابيع. يقارن أثر التدخل بسؤال أو اختبار بعدي يقيس المؤشر نفسه.</p>'+table(['م','الطالب','نوع التدخل','المؤشر المستهدف','القياس القبلي','إجراء التدخل','الفترة الزمنية وآلية المتابعة','هدف الإتقان'],rows))+'<button type="button" class="no-print" id="iadPrintPlan">طباعة الخطة</button>';
   document.querySelector('#indicatorReportPreview .iad-generated')?.remove();
   document.querySelector('#indicatorReportPreview .iad-root')?.append(node);
  }
  if(e.target?.id==='iadPrintPlan'&&e.target.closest('#indicatorReportView')){const html=document.querySelector('#indicatorReportPreview .iad-generated .iad-section')?.outerHTML;if(html)printStandalone(html);}
  if(e.target?.id==='iadImpact'&&context?.sharedIndicators?.length&&e.target.closest('#indicatorReportView')){const rows=context.changes.map(g=>[E(g.text),P(g.old),P(g.now),(g.d>0?'+':'')+g.d.toFixed(1),Math.abs(g.d)<.01?'ثابت':g.d>0?'تحسن':'تراجع',E(g.improved),E(g.below),E(g.n)]);printStandalone(box('تقرير قياس الأثر — مقارنة المؤشر نفسه',(rows.length?'':'<p>توجد مؤشرات مشتركة، لكن لا يوجد طلاب مشتركون في قياسين قابلين للمقارنة.</p>')+table(['المؤشر','السابق','الحالي','التغير','الحالة','تحسنوا','دون الإتقان','طلاب مشتركون'],rows)));}
 });
 const style=document.createElement('style');style.textContent='.iad-root{font-family:Tahoma,Arial,sans-serif;color:#243f40;font-size:13px;line-height:1.85;word-break:normal;overflow-wrap:normal;hyphens:none}.iad-root *{letter-spacing:normal;word-break:normal;hyphens:none}.iad-root p,.iad-root h2,.iad-root h3,.iad-root td,.iad-root th{line-height:1.75}.iad-section{margin:16px 0;padding:14px;border:1px solid #d4e5df;border-radius:12px;break-inside:auto;background:white}.iad-section h2{font-size:16px;color:#065f46;margin:0 0 10px}.iad-section h3{font-size:13px;margin:12px 0 6px}.iad-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.iad-meta span{padding:7px;background:#f3f8f6;border-radius:6px;font-size:12px}.iad-table{width:100%;border-collapse:collapse;font-size:12px;text-align:right;table-layout:auto}.iad-table th,.iad-table td{border:1px solid #d7e3dd;padding:8px 7px;vertical-align:top;overflow-wrap:normal;word-break:normal;hyphens:none;line-break:strict}.iad-table th{background:#eaf5ef}.iad-scroll{overflow-x:auto;max-width:100%}.iad-scroll table{min-width:max-content}.iad-table th,.iad-table td{min-width:82px}.iad-table td:nth-child(1){min-width:110px}.iad-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px}.iad-actions button{padding:8px 10px;background:#066b58;color:white;border:0;border-radius:7px;cursor:pointer}.iad-actions button:disabled{opacity:.4;cursor:not-allowed}.iad-note{font-size:11px;color:#697474}.iad-page{break-before:page}.iad-appendix{margin-top:25px;break-before:page}.iad-appendix-indicator{break-inside:avoid;page-break-inside:avoid;margin-bottom:14px}.iad-root .iad-appendix[hidden]{display:none!important}@media print{@page{size:A4 landscape;margin:10mm}.iad-root{max-width:277mm;margin:0 auto}.iad-section{margin:7px 0;padding:7px}.iad-meta{grid-template-columns:repeat(3,minmax(0,1fr))}.iad-actions{display:none!important}.iad-section{break-inside:auto}.iad-table tr{break-inside:avoid}.iad-meta{grid-template-columns:repeat(3,1fr)}.iad-scroll{overflow:visible}.iad-root{font-size:11pt;line-height:1.65}.iad-table{font-size:9pt;table-layout:fixed;width:100%}.iad-table th,.iad-table td{min-width:0;padding:4px 3px;overflow-wrap:normal;word-break:normal}.iad-scroll table{min-width:0}.iad-table tr{break-inside:avoid}.iad-section{max-width:100%}}';style.textContent+= '.iad-official-head{display:flex;align-items:center;justify-content:space-around;flex-wrap:wrap;gap:8px;text-align:center;color:#165449;padding:10px;margin:8px 0;border-bottom:2px solid #0f514c;font-size:13px}.iad-approvals{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;text-align:center;margin-top:28px;padding:12px;border-top:1px solid #bccdc6;break-inside:avoid}.iad-approvals p{margin-top:16px}@media print{.iad-official-head{margin:0 0 2mm;padding:2mm;font-size:10pt;break-after:avoid}.iad-approvals{font-size:9pt;margin-top:12mm;break-inside:avoid}}';
 style.textContent+= '@media print{'
+'.iad-root{font-size:9pt!important;line-height:1.28!important;max-width:277mm!important;margin:0 auto!important}'
+'.iad-root .iad-section{margin:3mm 0!important;padding:2mm 2.5mm!important;border-radius:3mm!important;break-inside:auto!important}'
+'.iad-root .iad-section h2{font-size:11pt!important;line-height:1.25!important;margin:0 0 2mm!important;break-after:avoid!important}'
+'.iad-root .iad-table{width:100%!important;min-width:0!important;max-width:100%!important;table-layout:fixed!important;font-size:8pt!important;line-height:1.22!important}'
+'.iad-root .iad-table th,.iad-root .iad-table td{min-width:0!important;padding:1.5mm 1mm!important;font-size:8pt!important;line-height:1.25!important;vertical-align:middle!important;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:none!important}'
+'.iad-root .iad-table thead{display:table-header-group!important}.iad-root .iad-table tr{break-inside:avoid!important;page-break-inside:avoid!important}'
+'.iad-root .iad-executive-report>.iad-section:nth-child(2) .iad-table th:nth-child(2){width:32%!important}'
+'.iad-root .iad-executive-report>.iad-section:nth-child(2) .iad-table th:first-child{width:6%!important}'
+'.iad-root .iad-executive-report>.iad-section:nth-child(3) .iad-table th:first-child{width:34%!important}'
+'.iad-root .iad-executive-report>.iad-section:nth-child(7) .iad-table th:first-child{width:28%!important}'
+'.iad-root .iad-meta{gap:1.5mm!important;grid-template-columns:repeat(4,minmax(0,1fr))!important}'
+'.iad-root .iad-meta span{font-size:8.5pt!important;padding:1mm!important;line-height:1.35!important}'
+'.iad-root p{font-size:8.5pt!important;line-height:1.4!important;margin:1mm 0!important}'
+'.iad-root .iad-scroll{overflow:visible!important;width:100%!important;max-width:100%!important}'
+'.iad-root .iad-page{break-before:page!important}'
+'.iad-root .iad-appendix[hidden]{display:none!important}'
+'.iad-root .iad-executive-report{width:100%!important}'
+'}';document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
window.NafesIndicatorDetailedReport={render};
})();
