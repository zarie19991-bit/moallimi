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
 if(!chosen)return{reviews,review:null,payload:null,attempts:[],students:[],indicators:[],questions:[],cognitive:[],absent:[],summary:summary([],0),recommendations:[]};
 const review=await getReview(chosen.review_id);
 const payload=review?.payload||{};
 const scoped=scopedAttempts(attempts,chosen.review_id,className);
 const subjects=(Array.isArray(payload.subjects)&&payload.subjects.length?payload.subjects:(Array.isArray(review?.subjects)&&review.subjects.length?review.subjects:[review?.subject])).filter(Boolean);
 const students=studentRows(scoped),meta=metadata(payload),indicators=indicatorRows(scoped,meta),questions=questionRows(scoped,meta),cognitive=cognitiveRows(scoped,meta),subjectSummary=subjectRows(scoped,subjects);
 const assigned=assignmentsFor(payload,className,rosterRows),absent=absentStudents(payload,scoped,className,rosterRows),sum=summary(students,assigned.length||students.length);
 const bundle={reviews,review,payload,subjects,subjectSummary,attempts:scoped,assigned,students,indicators,questions,cognitive,absent,summary:sum,subjectName:subjects.map(x=>subjectNames[x]||x).join(' + ')||'—',recommendations:[]};
 bundle.recommendations=recommendations(bundle);
 return bundle;
}
window.NafesPaperResults={load,listReviews,getReview,subjectNames,ar,pct,level,clean,normName};
})();