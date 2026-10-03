(()=>{
'use strict';
if(window.NafesPaperResults)return;
const T=window.NafesTeacher;
const clean=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ');
const normName=v=>clean(v).replace(/[إأآٱ]/g,'ا').replace(/ة/g,'ه').replace(/[ىي]/g,'ي').replace(/[\u064B-\u0652\u0670\u0640]/g,'').toLowerCase();
const subjectNames={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const ar=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(n||0));
const pct=n=>(n===null||n===undefined||n===''||!Number.isFinite(Number(n)))?'—':ar(n)+'٪';
function level(p){
 if(p===null||p===undefined||p===''||!Number.isFinite(Number(p)))return{key:'unmeasured',label:'غير مقاس'};
 const n=Number(p);
 if(n>=80)return{key:'mastered',label:'متقن'};
 if(n>=70)return{key:'near',label:'قريب من الإتقان'};
 if(n>=50)return{key:'support',label:'بحاجة إلى دعم'};
 return{key:'nonmastered',label:'غير متقن'};
}
function mean(xs){const v=xs.map(Number).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null}
function median(xs){const v=xs.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!v.length)return null;const m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2}
function variance(xs){const v=xs.map(Number).filter(Number.isFinite);if(v.length<2)return null;const m=v.reduce((a,b)=>a+b,0)/v.length;return v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1)}
function pearson(xs,ys){
 const a=xs.map(Number),b=ys.map(Number);if(a.length!==b.length||a.length<2)return null;
 const ma=mean(a),mb=mean(b);if(ma===null||mb===null)return null;
 let num=0,da=0,db=0;for(let i=0;i<a.length;i++){const x=a[i]-ma,y=b[i]-mb;num+=x*y;da+=x*x;db+=y*y}
 const den=Math.sqrt(da*db);return den?num/den:null;
}

function paperEvent(a,rid){return (a?.events||[]).find(e=>e?.type==='paper_scan'&&String(e.review_id||'')===String(rid||''));}
async function allAttempts(){
 let cursor=0,out=[],guard=0;
 while(guard++<200){
   const d=await T.api('teacher_data',{cursor,limit:100});
   out.push(...(d.attempts||[]));
   if(d.next_cursor===null||d.next_cursor===undefined)break;
   cursor=Number(d.next_cursor);
 }
 return out;
}
async function listReviews(){const d=await T.api('teacher_paper_review_list',{});return d.reviews||[];}
async function roster(){try{const d=await T.api('teacher_students_list',{include_archived:false});return d.students||[];}catch(_){return[];}}
async function getReview(reviewId){const d=await T.api('teacher_paper_review_get',reviewId?{review_id:reviewId}:{});return d.review||null;}
function latestByStudent(rows){
 const map=new Map();
 for(const a of rows){
   const k=String(a.student_id||normName(a.student_name)||a.id);
   const prev=map.get(k);
   if(!prev||Date.parse(a.submitted_at||0)>Date.parse(prev.submitted_at||0))map.set(k,a);
 }
 return [...map.values()];
}
function metadata(payload){
 const map=new Map();
 for(const m of payload?.models||[])for(const q of m.questions||[]){
   map.set(String(q.id||q.question_id||''),{
     indicator:q.indicator||q.indicator_key||'',
     subject:q.subject||String(q.indicator||q.indicator_key||'').split(':')[0]||'',
     cognitive:String(q.cognitive_level||'').toLowerCase(),
     difficulty:q.difficulty||'',
     question:q.question||''
   });
 }
 return map;
}
function scopedAttempts(attempts,rid,className=''){
 const rows=latestByStudent(attempts.filter(a=>paperEvent(a,rid)));
 return className?rows.filter(a=>clean(a.class_name)===clean(className)):rows;
}
function assignmentsFor(payload,className='',rosterRows=[]){
 const byId=new Map(rosterRows.map(s=>[String(s.id||''),s]));
 const byName=new Map(rosterRows.map(s=>[normName(s.full_name||s.student_name),s]));
 const rows=(payload?.assignments||[]).map(a=>{
   const st=byId.get(String(a.student_id||''))||byName.get(normName(a.student_name))||{};
   return {...a,class_name:a.class_name||st.class_name||''};
 });
 if(!className)return rows;
 return rows.filter(a=>clean(a.class_name||'')===clean(className));
}
function absentStudents(payload,attempts,className='',rosterRows=[]){
 const assigned=assignmentsFor(payload,className,rosterRows);
 const ids=new Set(attempts.map(a=>String(a.student_id||'')));
 const names=new Set(attempts.map(a=>normName(a.student_name)));
 return assigned.filter(a=>{
   const id=String(a.student_id||'');
   const name=normName(a.student_name);
   return !(id&&ids.has(id))&&!(name&&names.has(name));
 });
}
function studentRows(attempts){
 return attempts.map(a=>{
   const score=Number(a.score||0),total=Number(a.total||0),percent=Number.isFinite(Number(a.percent))?Number(a.percent):(total?score*100/total:null);
   const ev=(a.events||[]).find(e=>e?.type==='paper_scan')||{};
   return{name:a.student_name||'—',student_id:a.student_id||'',className:a.class_name||'—',model:ev.model||'—',score,total,percent,level:level(percent),attempt:a};
 }).sort((a,b)=>(a.percent??999)-(b.percent??999)||a.name.localeCompare(b.name,'ar'));
}
function indicatorRows(attempts,meta){
 const map=new Map();
 for(const a of attempts)for(const q of a.questions||[]){
   const m=meta.get(String(q.id||''))||{};
   const key=q.indicator_key||m.indicator||'';
   if(!key||typeof q.correct!=='boolean')continue;
   if(!map.has(key))map.set(key,{key,subject:q.subject||m.subject||String(key).split(':')[0]||'',text:q.indicator_text||key,correct:0,total:0,students:new Set()});
   const g=map.get(key);g.total++;if(q.correct)g.correct++;g.students.add(String(a.student_id||a.student_name||a.id));
 }
 return [...map.values()].map(g=>({...g,students:g.students.size,percent:g.total?g.correct*100/g.total:null,level:level(g.total?g.correct*100/g.total:null)})).sort((a,b)=>(a.percent??999)-(b.percent??999));
}
function questionRows(attempts,meta){
 const map=new Map();
 for(const a of attempts)for(const q of a.questions||[]){
   if(typeof q.correct!=='boolean')continue;
   const id=String(q.id||q.question_fingerprint||q.question||'');
   if(!map.has(id))map.set(id,{id,subject:q.subject||meta.get(String(q.id||''))?.subject||String(q.indicator_key||'').split(':')[0]||'',question:q.question||meta.get(String(q.id||''))?.question||'—',indicator:q.indicator_text||q.indicator_key||'—',wrong:0,total:0});
   const g=map.get(id);g.total++;if(!q.correct)g.wrong++;
 }
 return [...map.values()].map(g=>({...g,failure:g.total?g.wrong*100/g.total:null})).sort((a,b)=>(b.failure??-1)-(a.failure??-1)||b.total-a.total);
}
function cognitiveRows(attempts,meta){
 const labels={knowledge:'معرفة',application:'تطبيق',reasoning:'استدلال'};
 const map=new Map();
 for(const a of attempts)for(const q of a.questions||[]){
   if(typeof q.correct!=='boolean')continue;
   const c=meta.get(String(q.id||''))?.cognitive;
   if(!labels[c])continue;
   const g=map.get(c)||{key:c,label:labels[c],correct:0,total:0};g.total++;if(q.correct)g.correct++;map.set(c,g);
 }
 return ['knowledge','application','reasoning'].map(k=>map.get(k)||{key:k,label:labels[k],correct:0,total:0}).map(g=>({...g,percent:g.total?g.correct*100/g.total:null}));
}
function cognitiveRowsBySubject(attempts,meta,subjects=[]){
 const labels={knowledge:'معرفة',application:'تطبيق',reasoning:'استدلال'},out={};
 for(const subject of subjects)out[subject]=Object.fromEntries(Object.keys(labels).map(k=>[k,{key:k,label:labels[k],correct:0,total:0}]));
 for(const a of attempts)for(const q of a.questions||[]){
   if(typeof q.correct!=='boolean')continue;
   const m=meta.get(String(q.id||''))||{},subject=q.subject||m.subject||String(q.indicator_key||'').split(':')[0]||'',key=m.cognitive;
   if(!labels[key]||!subject)continue;
   if(!out[subject])out[subject]=Object.fromEntries(Object.keys(labels).map(k=>[k,{key:k,label:labels[k],correct:0,total:0}]));
   const g=out[subject][key];g.total++;if(q.correct)g.correct++;
 }
 return Object.fromEntries(Object.entries(out).map(([subject,map])=>[subject,['knowledge','application','reasoning'].map(k=>map[k]).map(g=>({...g,percent:g.total?g.correct*100/g.total:null}))]));
}
function subjectRows(attempts,subjects=[]){
 const map=new Map(subjects.map(subject=>[subject,{key:subject,label:subjectNames[subject]||subject,correct:0,total:0,students:new Set()}]));
 for(const a of attempts)for(const q of a.questions||[]){
   if(typeof q.correct!=='boolean')continue;
   const subject=q.subject||String(q.indicator_key||'').split(':')[0]||'';
   if(!subject)continue;
   const g=map.get(subject)||{key:subject,label:subjectNames[subject]||subject,correct:0,total:0,students:new Set()};
   g.total++;if(q.correct)g.correct++;g.students.add(String(a.student_id||a.student_name||a.id));map.set(subject,g);
 }
 return [...map.values()].filter(g=>g.total>0).map(g=>({...g,students:g.students.size,percent:g.total?g.correct*100/g.total:null,level:level(g.total?g.correct*100/g.total:null)}));
}
function psychometrics(attempts,meta,reviewId){
 const minItemSample=10,minDistractorSample=20;
 const subjectScores=new Map();
 for(const a of attempts){
   const scores={};
   for(const q of a.questions||[])if(typeof q.correct==='boolean'){
     const m=meta.get(String(q.id||''))||{},subject=q.subject||m.subject||String(q.indicator_key||'').split(':')[0]||'';
     if(subject)scores[subject]=(scores[subject]||0)+(q.correct?1:0);
   }
   subjectScores.set(String(a.id),scores);
 }
 const items=new Map();
 for(const a of attempts)for(const q of a.questions||[]){
   if(typeof q.correct!=='boolean')continue;
   const id=String(q.id||q.question_fingerprint||q.question||''),m=meta.get(String(q.id||''))||{};
   const subject=q.subject||m.subject||String(q.indicator_key||'').split(':')[0]||'';
   if(!items.has(id))items.set(id,{id,subject,question:q.question||m.question||'—',indicator:q.indicator_text||q.indicator_key||m.indicator||'—',obs:[]});
   const correct=q.correct?1:0,selected=Number(q.answer),score=Number(subjectScores.get(String(a.id))?.[subject]||0);
   items.get(id).obs.push({correct,selected:Number.isInteger(selected)?selected:null,adjusted:score-correct});
 }
 const rows=[...items.values()].map(x=>{
   const n=x.obs.length,facility=n?x.obs.reduce((s,o)=>s+o.correct,0)/n:null;
   const discrimination=n>=minItemSample?pearson(x.obs.map(o=>o.correct),x.obs.map(o=>o.adjusted)):null;
   const difficulty_band=n<minItemSample?'insufficient':facility>=.8?'easy':facility>=.4?'medium':'hard';
   let distractors={available:false,efficiency:null,functional_count:null,nonfunctional:[],over_attractive:[],options:[]};
   if(n>=minDistractorSample){
     const ranked=[...x.obs].sort((a,b)=>a.adjusted-b.adjusted),groupSize=Math.max(5,Math.floor(n*.27)),lower=ranked.slice(0,groupSize),upper=ranked.slice(-groupSize);
     const correctIndex=(()=>{const q=(attempts.flatMap(a=>a.questions||[]).find(q=>String(q.id||q.question_fingerprint||q.question||'')===x.id));return Number(q?.correct_index)})();
     if(Number.isInteger(correctIndex)&&correctIndex>=0&&correctIndex<4){
       const opts=[0,1,2,3].map(index=>{
         const count=x.obs.filter(o=>o.selected===index).length,rate=count/n;
         const lowerRate=lower.filter(o=>o.selected===index).length/lower.length,upperRate=upper.filter(o=>o.selected===index).length/upper.length;
         const isCorrect=index===correctIndex,functional=isCorrect?null:(rate>=.05&&lowerRate>=upperRate);
         return{index,label:['أ','ب','ج','د'][index],is_correct:isCorrect,count,rate,lower_rate:lowerRate,upper_rate:upperRate,functional,over_attractive:!isCorrect&&rate>.35};
       });
       const d=opts.filter(o=>!o.is_correct),fc=d.filter(o=>o.functional===true).length;
       distractors={available:true,efficiency:Math.round(fc/3*100),functional_count:fc,nonfunctional:d.filter(o=>!o.functional).map(o=>o.index),over_attractive:d.filter(o=>o.over_attractive).map(o=>o.index),options:opts};
     }
   }
   return{id:x.id,subject:x.subject,question:x.question,indicator:x.indicator,sample_size:n,facility,discrimination,difficulty_band,distractors};
 }).sort((a,b)=>(a.subject||'').localeCompare(b.subject||'')||(a.facility??2)-(b.facility??2));

 const groups=new Map();
 for(const a of attempts){
   const model=String(paperEvent(a,reviewId)?.model||'—');
   const bySubject={};
   for(const q of a.questions||[])if(typeof q.correct==='boolean'){
     const m=meta.get(String(q.id||''))||{},subject=q.subject||m.subject||String(q.indicator_key||'').split(':')[0]||'',id=String(q.id||q.question_fingerprint||q.question||'');
     if(!subject||!id)continue;if(!bySubject[subject])bySubject[subject]=new Map();bySubject[subject].set(id,q.correct?1:0);
   }
   for(const [subject,responses] of Object.entries(bySubject)){const key=model+'|'+subject,list=groups.get(key)||[];list.push({model,subject,responses});groups.set(key,list);}
 }
 const reliability=[...groups.values()].map(group=>{
   const n=group.length,model=group[0]?.model||'—',subject=group[0]?.subject||'';
   if(n<minItemSample)return{model,subject,n,item_count:0,kr20:null,status:'insufficient'};
   const common=[...group[0].responses.keys()].filter(id=>group.every(r=>r.responses.has(id)));
   if(common.length<5)return{model,subject,n,item_count:common.length,kr20:null,status:'insufficient'};
   const scores=group.map(r=>common.reduce((s,id)=>s+Number(r.responses.get(id)||0),0)),v=variance(scores);
   if(v===null||v<=0)return{model,subject,n,item_count:common.length,kr20:null,status:'zero_variance'};
   let pq=0;for(const id of common){const p=group.reduce((s,r)=>s+Number(r.responses.get(id)||0),0)/n;pq+=p*(1-p)}
   const k=common.length,kr20=(k/(k-1))*(1-pq/v);
   return{model,subject,n,item_count:k,kr20:Number(Math.max(-1,Math.min(1,kr20)).toFixed(3)),status:'measured'};
 });
 return{minimum_item_sample:minItemSample,minimum_distractor_sample:minDistractorSample,items:rows,reliability,
   note:'معامل السهولة والتمييز وKR-20 لا يُفسَّر حكمًا نهائيًا عند نقص العينة. فاعلية المشتت تحتاج 20 استجابة صالحة على الأقل للسؤال.'};
}
function summary(students,assignedCount){
 const values=students.map(x=>x.percent).filter(Number.isFinite),avg=mean(values),med=median(values);
 return{
   assigned:assignedCount,tested:students.length,absent:Math.max(0,assignedCount-students.length),average:avg,median:med,
   highest:values.length?Math.max(...values):null,lowest:values.length?Math.min(...values):null,
   mastered:students.filter(x=>Number(x.percent)>=80).length,
   support:students.filter(x=>Number(x.percent)<70).length,
   masteryRate:students.length?students.filter(x=>Number(x.percent)>=80).length*100/students.length:null
 };
}
function recommendations(bundle){
 const out=[],inds=bundle.indicators||[],weak=inds[0],strong=inds.length?inds[inds.length-1]:null;
 if(weak&&Number.isFinite(weak.percent))out.push('إعادة تدريس المؤشر «'+weak.text+'»؛ لأنه الأقل أداءً بنسبة '+pct(weak.percent)+'.');
 if(bundle.summary.support)out.push('تنفيذ تدريب علاجي موجه لـ '+ar(bundle.summary.support)+' من الطلاب الذين تقل نتائجهم عن 70٪، ثم إعادة قياس المؤشرات المتعثرة.');
 if(bundle.absent.length)out.push('استكمال قياس '+ar(bundle.absent.length)+' من الطلاب غير المختبرين قبل اعتماد المقارنة النهائية للفصل.');
 if(strong&&Number.isFinite(strong.percent)&&strong.key!==weak?.key)out.push('تثبيت التعلم في المؤشر «'+strong.text+'» بأنشطة إثرائية؛ لأنه الأعلى أداءً بنسبة '+pct(strong.percent)+'.');
 if(!out.length)out.push('الاستمرار في المتابعة الدورية للمؤشرات وإعادة القياس بعد الأنشطة الصفية للتحقق من ثبات الإتقان.');
 return out;
}
async function load(reviewId,className=''){
 const [reviews,attempts,rosterRows]=await Promise.all([listReviews(),allAttempts(),roster()]);
 let chosen=reviewId?reviews.find(r=>String(r.review_id)===String(reviewId)):reviews[0];
 if(!chosen&&reviewId)chosen={review_id:reviewId};
 if(!chosen)return{reviews,review:null,payload:null,attempts:[],students:[],indicators:[],questions:[],cognitive:[],cognitiveBySubject:{},psychometrics:{minimum_item_sample:10,minimum_distractor_sample:20,items:[],reliability:[]},absent:[],summary:summary([],0),recommendations:[]};
 const review=await getReview(chosen.review_id);
 const payload=review?.payload||{};
 const scoped=scopedAttempts(attempts,chosen.review_id,className);
 const subjects=(Array.isArray(payload.subjects)&&payload.subjects.length?payload.subjects:(Array.isArray(review?.subjects)&&review.subjects.length?review.subjects:[review?.subject])).filter(Boolean);
 const students=studentRows(scoped),meta=metadata(payload),indicators=indicatorRows(scoped,meta),questions=questionRows(scoped,meta),cognitive=cognitiveRows(scoped,meta),cognitiveBySubject=cognitiveRowsBySubject(scoped,meta,subjects),subjectSummary=subjectRows(scoped,subjects),psych=psychometrics(scoped,meta,chosen.review_id);
 const assigned=assignmentsFor(payload,className,rosterRows),absent=absentStudents(payload,scoped,className,rosterRows),sum=summary(students,assigned.length||students.length);
 const bundle={reviews,review,payload,subjects,subjectSummary,cognitiveBySubject,psychometrics:psych,attempts:scoped,assigned,students,indicators,questions,cognitive,absent,summary:sum,subjectName:subjects.map(x=>subjectNames[x]||x).join(' + ')||'—',recommendations:[]};
 bundle.recommendations=recommendations(bundle);
 return bundle;
}
window.NafesPaperResults={load,listReviews,getReview,subjectNames,ar,pct,level,clean,normName};
})();