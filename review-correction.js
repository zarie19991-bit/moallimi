(()=>{
'use strict';
const $=id=>document.getElementById(id);
const makeReviewId=()=>('R'+Date.now().toString(36).toUpperCase());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const labels={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const letters=['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
const MAX_CROSS_MODEL_REPEATS=10;
function minimumRequiredRepeats(){
 if(!catalog)return 0;
 const modelCount=Number($('modelCount')?.value||5);
 const byKey=new Map((catalog?.indicators||[]).map(i=>[String(i.key),Number(i.available||0)]));
 return getSelectedIndicators().reduce((sum,x)=>{
   const available=Number(byKey.get(String(x.key))||0);
   return sum+Math.max(0,modelCount*Number(x.count||0)-available);
 },0);
}
function repeatLimit(){
 return minimumRequiredRepeats()+MAX_CROSS_MODEL_REPEATS;
}
let catalog=null,students=[],models=[],activeModel=0,assignments=[];const indicatorState=new Map();
function setStatus(msg,type){const el=$('status');el.textContent=msg;el.className='status'+(type?' '+type:'');}
function setReviewLinks(reviewId){
 const q=reviewId?'?rid='+encodeURIComponent(reviewId):'';
 const scan=document.querySelectorAll('a[href^="review-scan.html"]');
 const bubbles=document.querySelectorAll('a[href^="review-bubble-sheets.html"]');
 const papers=document.querySelectorAll('a[href^="review-question-papers.html"]');
 const analysis=document.querySelectorAll('a[href^="review-analysis.html"]');
 const reports=document.querySelectorAll('a[href^="review-report.html"]');
 scan.forEach(a=>a.href='review-scan.html'+q);bubbles.forEach(a=>a.href='review-bubble-sheets.html'+q);papers.forEach(a=>a.href='review-question-papers.html'+q);analysis.forEach(a=>a.href='review-analysis.html'+q);reports.forEach(a=>a.href='review-report.html'+q);
}
function formatArchiveTime(v){
 if(!v)return'';
 try{return new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch(_){return String(v);}
}
function archiveItem(row){
 const rid=encodeURIComponent(row.review_id||''),subs=Array.isArray(row.subjects)?row.subjects:(Array.isArray(row.payload?.subjects)?row.payload.subjects:[row.subject].filter(Boolean));
 const subject=subs.length>1?subs.map(x=>labels[x]||x).join(' + '):(labels[subs[0]]||subs[0]||'—'),cls=row.class_name?('فصل '+row.class_name):'جميع الفصول';
 return '<article class="archive-item" data-review-id="'+esc(row.review_id||'')+'">'+
   '<h3>'+esc(row.title||'مراجعة ورقية')+'</h3>'+
   '<div class="archive-meta"><span>'+esc(subject)+'</span><span>'+esc(cls)+'</span><span>'+esc(formatArchiveTime(row.updated_at||row.created_at))+'</span></div>'+
   '<div class="archive-actions">'+
     '<button type="button" class="open-review" data-open-review="'+esc(row.review_id||'')+'">فتح الاختبار</button>'+
     '<a href="review-question-papers.html?rid='+rid+'">أوراق الأسئلة</a>'+
     '<a href="review-bubble-sheets.html?rid='+rid+'">ورق التظليل</a>'+
     '<a href="review-scan.html?rid='+rid+'">رفع وتصحيح</a>'+
     '<a href="review-analysis.html?rid='+rid+'">التحليل</a>'+
     '<a href="review-report.html?rid='+rid+'">التقرير</a>'+
   '</div></article>';
}
async function loadArchive(){
 const host=$('reviewArchive'),state=$('archiveState');if(!host||!state)return;
 state.textContent='جارٍ تحميل المراجعات المحفوظة…';
 try{
   const res=await NafesTeacher.api('teacher_paper_review_list',{});
   const rows=Array.isArray(res?.reviews)?res.reviews:[];
   host.innerHTML=rows.length?rows.map(archiveItem).join(''):'<div class="archive-empty">لا توجد اختبارات ورقية محفوظة حتى الآن.</div>';
   state.textContent=rows.length?'محفوظ '+ar(rows.length)+' اختبار/مراجعة ورقية.':'ابدأ بإنشاء أول مراجعة وسيتم حفظها هنا.';
 }catch(e){
   const local=JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');
   host.innerHTML=local?.review_id?archiveItem({review_id:local.review_id,title:local.title,subject:local.subject,subjects:local.subjects,class_name:local.class_name,updated_at:local.saved_at}):'<div class="archive-empty">تعذر تحميل الأرشيف الدائم الآن.</div>';
   state.textContent='تعذر تحميل الأرشيف من قاعدة البيانات: '+(e.message||e);
 }
}
async function openArchivedReview(reviewId){
 if(!reviewId)return;
 try{
   setStatus('جارٍ فتح الاختبار الورقي المحفوظ…');
   const res=await NafesTeacher.api('teacher_paper_review_get',{review_id:reviewId});
   if(!res?.review?.payload)throw new Error('لم يتم العثور على المراجعة المحفوظة.');
   restoreReviewPayload(res.review.payload);
   setStatus('تم فتح المراجعة المحفوظة، ويمكنك إعادة طباعة أوراق الأسئلة أو ورق التظليل.','ok');
   document.querySelector('.builder-grid')?.scrollIntoView({behavior:'smooth'});
 }catch(e){setStatus('تعذر فتح المراجعة: '+(e.message||e),'error');}
}
function selectedSubject(){return selectedSubjects()[0]||'reading';}
function allowedSubjects(){
 const scope=window.NafesTeacher?.getScope?.()||'all';
 return scope==='all'?['reading','math','science']:[scope];
}
function selectedSubjects(){
 const picked=[...document.querySelectorAll('.subject-check:checked')].map(x=>String(x.value));
 const allowed=allowedSubjects();
 const safe=picked.filter(x=>allowed.includes(x));
 return safe.length?safe:[allowed[0]||'reading'];
}
function hasReading(){return selectedSubjects().includes('reading');}
function captureIndicatorState(){
 document.querySelectorAll('.indicator-row').forEach(r=>{
   const key=String(r.dataset.key||''),subject=String(r.dataset.subject||key.split(':')[0]||'');
   const check=r.querySelector('.indicator-check'),cnt=r.querySelector('.indicator-count');
   if(key&&check&&cnt)indicatorState.set(key,{checked:!!check.checked,count:Number(cnt.value||0),subject});
 });
}
function cognitiveOf(q){
 const raw=String(q?.cognitive_level||q?.cognitive||q?.level||q?.bloom||'').toLowerCase();
 if(/knowledge|معرفة/.test(raw))return'knowledge';
 if(/application|apply|تطبيق/.test(raw))return'application';
 if(/reason|استدلال|analysis/.test(raw))return'reasoning';
 return'unknown';
}
function updateLevelSummary(){
 const k=Number($('knowledge').value||0),a=Number($('application').value||0),r=Number($('reasoning').value||0),sum=k+a+r,q=Number($('questionCount').value||15);
 const counts=[Math.round(q*k/100),Math.round(q*a/100),Math.max(0,q-Math.round(q*k/100)-Math.round(q*a/100))];
 $('levelSummary').textContent=(sum===100?'الهدف: ':'تنبيه: المجموع '+sum+'% — يجب أن يساوي 100%. ')+'معرفة '+counts[0]+' · تطبيق '+counts[1]+' · استدلال '+counts[2]+' من '+q+' سؤالًا.';
 $('buildModels').disabled=sum!==100;
}
function populateSubject(){
 const allowed=allowedSubjects();
 const existing=selectedSubjects().filter(x=>allowed.includes(x));
 const chosen=existing.length?existing:[allowed[0]];
 $('subjectChoices').innerHTML=allowed.map(sub=>'<label class="subject-choice"><input class="subject-check" type="checkbox" value="'+sub+'" '+(chosen.includes(sub)?'checked':'')+'><span>'+labels[sub]+'</span></label>').join('');
 $('subject').innerHTML=allowed.map(sub=>'<option value="'+sub+'">'+labels[sub]+'</option>').join('');
 $('subject').value=chosen[0]||allowed[0]||'reading';
}
function populateClasses(){
 const active=students.filter(s=>s.is_active!==false);
 const classes=[...new Set(active.map(s=>String(s.class_name||'').trim()).filter(Boolean))].sort();
 $('className').innerHTML='<option value="">جميع الفصول</option>'+classes.map(c=>'<option value="'+esc(c)+'">فصل '+esc(c)+'</option>').join('');
 renderStudents();
}
function visibleStudents(){
 const c=$('className').value;
 return students.filter(s=>s.is_active!==false&&(!c||String(s.class_name||'').trim()===c));
}
function renderStudents(){
 const list=visibleStudents();
 $('students').innerHTML=list.map((s,i)=>'<label class="student-item"><input class="student-check" type="checkbox" data-id="'+esc(s.id)+'" checked><span><b>'+esc(s.full_name||s.student_name||'طالب')+'</b><small>'+esc(s.grade||'')+' · فصل '+esc(s.class_name||'—')+'</small></span></label>').join('')||'<p>لا يوجد طلاب نشطون في هذا الفصل.</p>';
 $('studentCount').textContent=ar(list.length)+' طالب';
 $('selectAllStudents').checked=true;
}
function subjectIndicators(subject){
 const subjects=subject?[subject]:selectedSubjects();
 return (catalog?.indicators||[]).filter(i=>subjects.includes(i.subject));
}
function renderIndicators(){
 captureIndicatorState();
 const q=$('indicatorSearch').value.trim();
 const subjects=selectedSubjects();
 const groups=subjects.map(subject=>{
   const items=subjectIndicators(subject).filter(i=>!q||String(i.text||'').includes(q));
   const rows=items.map((i,n)=>{
     const state=indicatorState.get(String(i.key))||{checked:false,count:subject==='reading'?5:1,subject};
     indicatorState.set(String(i.key),state);
     return '<label class="indicator-row" data-key="'+esc(i.key)+'" data-subject="'+subject+'"><input class="indicator-check" type="checkbox" value="'+esc(i.key)+'" '+(state.checked?'checked':'')+'><span><p>'+ar(n+1)+') '+esc(i.text||i.key)+'</p><small>المتاح في البنك: '+ar(i.available||0)+' سؤالًا</small></span><input class="indicator-count" type="number" min="1" max="60" value="'+Math.max(1,Number(state.count||1))+'" '+(state.checked?'':'disabled')+' aria-label="عدد الأسئلة"></label>';
   }).join('');
   return '<section class="indicator-subject-group" data-indicator-subject="'+subject+'"><div class="indicator-subject-title"><b>'+labels[subject]+'</b><span>'+ar(items.length)+' مؤشرًا متاحًا</span></div><div class="indicator-subject-items">'+(rows||'<div class="archive-empty">لا توجد مؤشرات مطابقة للبحث في هذه المادة.</div>')+'</div></section>';
 }).join('');
 $('indicators').innerHTML=groups||'<div class="archive-empty">اختر مادة واحدة على الأقل.</div>';
 updateIndicatorSummary();
}
function distributeIndicatorCounts(){
 const rows=[...document.querySelectorAll('.indicator-row')].filter(r=>r.querySelector('.indicator-check')?.checked);
 if(!rows.length)return;
 const total=Number($('questionCount').value||15);
 let used=0;
 for(const r of rows){
   const step=r.dataset.subject==='reading'?5:1;
   const x=r.querySelector('.indicator-count');x.disabled=false;x.value=String(step);used+=step;
 }
 let remaining=total-used,guard=0,index=0;
 while(remaining>0&&guard++<1000){
   const r=rows[index%rows.length],step=r.dataset.subject==='reading'?5:1;
   if(step<=remaining){
     const x=r.querySelector('.indicator-count');x.value=String(Number(x.value||0)+step);remaining-=step;
   }
   index++;
   if(index>rows.length*4&&remaining>0&&!rows.some(r=>(r.dataset.subject==='reading'?5:1)<=remaining))break;
 }
 captureIndicatorState();
 updateIndicatorSummary();
}
function updateIndicatorSummary(){
 captureIndicatorState();
 const selected=getSelectedIndicators(),target=Number($('questionCount').value||15);
 document.querySelectorAll('.indicator-row').forEach(r=>r.classList.toggle('selected',r.querySelector('.indicator-check')?.checked));
 const total=selected.reduce((n,x)=>n+Number(x.count||0),0);
 const bySubject=selectedSubjects().map(subject=>{
   const rows=selected.filter(x=>x.subject===subject),n=rows.reduce((a,x)=>a+Number(x.count||0),0);
   return rows.length?labels[subject]+' '+ar(n)+' سؤالًا / '+ar(rows.length)+' مؤشر':''; 
 }).filter(Boolean);
 const readingBad=selected.some(x=>x.subject==='reading'&&(x.count<5||x.count%5!==0));
 $('indicatorSummary').textContent='المحدد: '+ar(selected.length)+' مؤشر · مجموع الأسئلة: '+ar(total)+' من '+ar(target)+(bySubject.length?' · '+bySubject.join(' · '):'')+(readingBad?' · القراءة يجب أن تكون ٥ أسئلة أو مضاعفاتها لكل مؤشر':'')+(selected.length&&total!==target?' · عدّل الأعداد حتى يساوي المجموع العدد الكلي':'');
}
function getSelectedIndicators(){
 captureIndicatorState();
 const subjects=new Set(selectedSubjects());
 return [...indicatorState.entries()].filter(([,v])=>v.checked&&subjects.has(v.subject)&&Number(v.count)>0).map(([key,v])=>({key,subject:v.subject,count:Number(v.count)}));
}
function selectedStudents(){
 const ids=new Set([...document.querySelectorAll('.student-check:checked')].map(x=>String(x.dataset.id)));
 return visibleStudents().filter(s=>ids.has(String(s.id)));
}
function configForModel(letter){
 const inds=getSelectedIndicators(),subjects=selectedSubjects();
 const sections=subjects.map(subject=>{
   const items=inds.filter(x=>x.subject===subject);
   return {subject,question_count:items.reduce((n,x)=>n+x.count,0),duration_minutes:45,calculator:subject==='math',model_no:1,indicators:items.map(x=>({key:x.key,count:x.count}))};
 }).filter(s=>s.question_count>0);
 return {kind:'multi_indicator',review_passage_mode:subjects.includes('reading'),grade_key:'middle_3',title:$('reviewTitle').value.trim()+' — نموذج '+letter,class_name:$('className').value?('ثالث متوسط '+$('className').value):'ثالث متوسط',term:'الفصل الدراسي الأول',academic_term:'الفصل الدراسي الأول',school_name:'',teacher_name:'',principal_name:'',identity_mode:'manual',roster:[],sections,count_mode:'per_indicator',settings:{show_result:false,show_answers:false,show_indicator_result:false,show_correct_count:false,shuffle_questions:false,shuffle_options:false,allow_copy:false,disable_right_click:false,disable_print:false,disable_shortcuts:false,allow_back:true,one_per_page:false,lock_session:false,log_visibility:false,watermark:false,attempts:1,opens_at:null,closes_at:null,break_minutes:0}};
}
function questionIds(d){
 return (d.sections||[]).flatMap(s=>(s.questions||[]).map(q=>String(q.id||q.question_id||q.question||'')));
}
function cognitiveScore(d){
 const target={knowledge:Number($('knowledge').value),application:Number($('application').value),reasoning:Number($('reasoning').value)};
 const qs=(d.sections||[]).flatMap(s=>s.questions||[]),known=qs.map(cognitiveOf).filter(x=>x!=='unknown');
 if(!known.length)return 0;
 const pct={knowledge:0,application:0,reasoning:0};known.forEach(x=>pct[x]++);
 Object.keys(pct).forEach(k=>pct[k]=pct[k]*100/known.length);
 return Math.abs(pct.knowledge-target.knowledge)+Math.abs(pct.application-target.application)+Math.abs(pct.reasoning-target.reasoning);
}
function overlapCount(d,used){
 return questionIds(d).filter(id=>used.has(id)).length;
}
function incompleteChoices(d){
 return modelQuestions(d).filter(q=>!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>!String(o??'').trim()));
}
function hasValidAnswerKey(d){
 return modelQuestions(d).every(q=>Number.isInteger(Number(q.correctIndex))&&Number(q.correctIndex)>=0&&Number(q.correctIndex)<4);
}
function normalizeContext(s){
 return String(s||'').normalize('NFKC')
  .replace(/[\u064B-\u0652\u0670\u0640]/g,'')
  .replace(/[إأآٱ]/g,'ا').replace(/ة/g,'ه').replace(/[ىي]/g,'ي')
  .replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
}
function contextSimilarity(a,b){
 const A=normalizeContext(a),B=normalizeContext(b);
 if(!A||!B)return 0;
 if(A===B)return 1;
 const min=Math.min(A.length,B.length),max=Math.max(A.length,B.length);
 if(min>=90&&(A.includes(B)||B.includes(A)))return min/max;
 if(min<90)return 0;
 const wa=new Set(A.split(' ').filter(w=>w.length>1)),wb=new Set(B.split(' ').filter(w=>w.length>1));
 let inter=0; for(const w of wa)if(wb.has(w))inter++;
 const union=wa.size+wb.size-inter;
 return union?inter/union:0;
}
function clusterModelQuestions(qs){
 const groups=[],byKey=new Map();
 qs.forEach((q,index)=>{
   const ctx=String(q.context||'').trim();
   const key=ctx?normalizeContext(ctx):'__NO_CONTEXT__:'+index;
   let group=byKey.get(key);
   if(!group){
     group={context:ctx,questions:[]};
     groups.push(group);
     byKey.set(key,group);
   }
   group.questions.push({q,index});
 });
 return groups;
}
function layoutScore(d){
 const qs=modelQuestions(d),groups=clusterModelQuestions(qs);
 const passages=groups.filter(g=>g.context);
 const uniqueChars=passages.reduce((n,g)=>n+normalizeContext(g.context).length,0);
 const isolated=groups.filter(g=>!g.context).length;
 const images=qs.filter(q=>q.image_url||q.imageUrl||q.media_url).length;
 const passagePenalty=Math.max(0,passages.length-3)*1200;
 const textPenalty=Math.max(0,uniqueChars-2600)*1.8;
 return passages.length*180 + uniqueChars/8 + isolated*60 + images*45 + passagePenalty + textPenalty;
}
function orderedQuestions(qs){
 return clusterModelQuestions(qs).flatMap(g=>g.questions.map(x=>x.q));
}
function rotateList(list,shift){
 const a=[...list],n=a.length;if(!n)return a;
 const k=((shift%n)+n)%n;return a.slice(k).concat(a.slice(0,k));
}
function questionId(q){return String(q?.id||q?.question_id||q?.question||'');}
function samePositionCount(a,b){
 const A=modelQuestions(a),B=modelQuestions(b),n=Math.min(A.length,B.length);let same=0;
 for(let i=0;i<n;i++)if(questionId(A[i])&&questionId(A[i])===questionId(B[i]))same++;
 return same;
}
function reorderModelQuestions(d,modelIndex,previous){
 const sections=Array.isArray(d?.sections)?d.sections:[];
 if(!sections.length)return d;
 for(const section of sections){
   const qs=Array.isArray(section.questions)?[...section.questions]:[];
   if(qs.length<2)continue;
   const reading=section.subject==='reading';
   const prevSection=(previous?.sections||[]).find(x=>x.subject===section.subject);
   const prevQs=prevSection?.questions||[];
   const candidates=[];
   if(reading){
     const groups=clusterModelQuestions(qs).map(g=>g.questions.map(x=>x.q));
     for(let gs=0;gs<Math.max(1,groups.length);gs++){
       for(let variant=0;variant<Math.max(2,Math.min(6,qs.length));variant++){
         let moved=rotateList(groups,gs+modelIndex).map((g,gi)=>{
           let row=rotateList(g,1+modelIndex+gi+variant);
           if((modelIndex+gi+variant)%2)row=[...row].reverse();
           return row;
         });
         if((modelIndex+variant)%2)moved=[...moved].reverse();
         candidates.push(moved.flat());
       }
     }
   }else{
     for(let shift=1;shift<qs.length;shift++){
       let row=rotateList(qs,shift+modelIndex);
       if((shift+modelIndex)%2)row=[...row].reverse();
       candidates.push(row);
     }
   }
   if(!candidates.length)continue;
   const score=row=>{
     let same=0;
     for(let i=0;i<Math.min(row.length,prevQs.length);i++)if(questionId(row[i])&&questionId(row[i])===questionId(prevQs[i]))same++;
     const sameIndicator=row.reduce((n,q,i)=>n+(prevQs[i]&&String(q.indicator_key||q.indicator||'')===String(prevQs[i].indicator_key||prevQs[i].indicator||'')?1:0),0);
     return same*1000+sameIndicator;
   };
   candidates.sort((a,b)=>score(a)-score(b));
   section.questions=candidates[0];
 }
 return d;
}
function modelSignature(d){return questionIds(d).slice().sort().join('|');}
function candidateAttemptCount(modelIndex){
 const indicatorCount=getSelectedIndicators().length;
 const subjectCount=selectedSubjects().length;
 const questionCount=Number($('questionCount').value||15);
 if(modelIndex===0)return 1;
 if(indicatorCount>=20||questionCount>=50)return 3;
 if(indicatorCount>=12||subjectCount===3||questionCount>=35)return 4;
 if(indicatorCount>=7||questionCount>=25)return 6;
 return hasReading()?8:($('avoidRepeats').checked?8:6);
}
async function bestCandidate(letter,used,repeatBudget,modelIndex,previous){
 const reading=hasReading();
 const attempts=candidateAttemptCount(modelIndex);
 let best=null,bestScore=Infinity,bestOverlap=Infinity;
 const previousSignatures=new Set(models.map(modelSignature));
 let exclusionUsable=used.size>0;
 for(let n=0;n<attempts;n++){
   const body={config:configForModel(letter),regenerate:n>0,ephemeral:true};
   if(exclusionUsable)body.exclude_question_ids=[...used];
   let d;
   try{
     d=await NafesTeacher.api('teacher_preview',body);
   }catch(e){
     if(!exclusionUsable)throw e;
     // إذا نفدت الأسئلة الفريدة لا نعيد طلبًا فاشلًا في كل محاولة.
     // نتحول مرة واحدة إلى البنك الكامل ثم نواصل اختيار أقل تكرار.
     exclusionUsable=false;
     d=await NafesTeacher.api('teacher_preview',{config:configForModel(letter),regenerate:true,ephemeral:true});
   }
   if(incompleteChoices(d).length||!hasValidAnswerKey(d))continue;
   d=reorderModelQuestions(d,modelIndex,previous);
   const overlap=overlapCount(d,used);
   const duplicateSetPenalty=previousSignatures.has(modelSignature(d))?5000000:0;
   const repeatPenalty=overlap*1000000;
   const positionPenalty=previous?samePositionCount(previous,d)*10000:0;
   const cognitivePenalty=cognitiveScore(d)*2;
   const printPenalty=reading?layoutScore(d):0;
   const score=duplicateSetPenalty+repeatPenalty+positionPenalty+cognitivePenalty+printPenalty;
   if(score<bestScore){best=d;bestScore=score;bestOverlap=overlap;}
   if(overlap===0&&!duplicateSetPenalty&&(!previous||samePositionCount(previous,d)===0))break;
 }
 if(!best)throw new Error('تعذر تكوين نموذج مكتمل من بنك الأسئلة المعتمد.');
 best._repeat_overlap=bestOverlap;
 best._repeat_budget=repeatBudget;
 best._candidate_attempts=attempts;
 return best;
}
function validate(){
 const inds=getSelectedIndicators(),subjects=selectedSubjects(),q=Number($('questionCount').value),sum=inds.reduce((n,x)=>n+x.count,0),stu=selectedStudents();
 if(!$('reviewTitle').value.trim())throw new Error('اكتب اسم المراجعة.');
 if(!subjects.length)throw new Error('اختر مادة واحدة على الأقل.');
 if(!inds.length)throw new Error('اختر مؤشرًا واحدًا على الأقل.');
 for(const subject of subjects)if(!inds.some(x=>x.subject===subject))throw new Error('اختر مؤشرًا واحدًا على الأقل من مادة '+labels[subject]+'.');
 if(sum!==q)throw new Error('مجموع أسئلة المؤشرات يجب أن يساوي '+q+' سؤالًا.');
 const reading=inds.filter(x=>x.subject==='reading');
 if(reading.some(x=>x.count%5!==0||x.count<5))throw new Error('في القراءة: كل مؤشر مختار يجب أن يأخذ ٥ أسئلة أو مضاعفاتها حتى يبقى النص مع أسئلته.');
 const byKey=new Map((catalog?.indicators||[]).map(i=>[String(i.key),Number(i.available||0)]));
 for(const x of inds){
   const available=Number(byKey.get(String(x.key))||0);
   if(x.count>available)throw new Error('المؤشر المحدد في '+labels[x.subject]+' يحتوي '+available+' سؤالًا محكّمًا فقط، بينما طلبت '+x.count+'.');
 }
 if(!stu.length)throw new Error('اختر طالبًا واحدًا على الأقل لتجهيز التوزيع.');
 const levels=Number($('knowledge').value)+Number($('application').value)+Number($('reasoning').value);
 if(levels!==100)throw new Error('مجموع مستويات معرفة/تطبيق/استدلال يجب أن يساوي 100%.');
}
function modelQuestions(m){return (m?.sections||[]).flatMap(s=>s.questions||[]);}
function modelStats(m){
 const qs=modelQuestions(m),c={knowledge:0,application:0,reasoning:0,unknown:0};
 qs.forEach(q=>c[cognitiveOf(q)]++);
 return c;
}
function renderQuality(){
 const all=models.flatMap(m=>questionIds(m)),unique=new Set(all),dup=Math.max(0,all.length-unique.size),total=all.length;
 const unknown=models.reduce((n,m)=>n+modelStats(m).unknown,0);
 const cards=[
  ['النماذج',models.length,'ok'],
  ['إجمالي الأسئلة',total,'ok'],
  ['التكرارات بين النماذج',dup,dup>repeatLimit()?'warn':'ok'],
  ['الحد الأعلى للتكرار',repeatLimit(),'ok'],
  ['أسئلة بلا وسم معرفي',unknown,unknown?'warn':'ok']
 ];
 $('quality').innerHTML=cards.map(x=>'<div class="quality-card '+x[2]+'"><span>'+x[0]+'</span><b>'+ar(x[1])+'</b></div>').join('');
}
function renderModelTabs(){
 $('modelTabs').innerHTML=models.map((m,i)=>'<button class="model-tab '+(i===activeModel?'active':'')+'" data-model="'+i+'">نموذج '+letters[i]+'</button>').join('');
}
function renderModel(i){
 activeModel=i;renderModelTabs();
 const m=models[i],stats=modelStats(m);let no=0;
 const sections=(m?.sections||[]).map(sec=>{
   const qs=sec.questions||[];
   const cards=qs.map(q=>{no++;const img=q.image?.url||q.image_url||q.imageUrl||q.media_url||'';return '<article class="question-card"><div class="q-meta"><span class="chip">س'+ar(no)+'</span><span class="chip">'+esc(q.indicator_text||q.indicator||'مؤشر نافس')+'</span><span class="chip">'+({knowledge:'معرفة',application:'تطبيق',reasoning:'استدلال',unknown:'غير موسوم'})[cognitiveOf(q)]+'</span></div>'+(q.context?'<p>'+esc(q.context)+'</p>':'')+(img?'<img class="preview-q-image" src="'+esc(img)+'" alt="'+esc(q.image?.alt||q.image_alt||'صورة السؤال')+'">':'')+'<p><b>'+esc(q.question||'')+'</b></p><ol type="أ">'+(q.options||[]).map(o=>'<li>'+esc(o)+'</li>').join('')+'</ol><div class="correct-key">مفتاح المعلم: '+esc((q.options||[])[q.correctIndex]||'—')+'</div></article>';}).join('');
   return '<section class="model-subject-block"><div class="model-subject-head"><b>'+labels[sec.subject]+'</b><span>'+ar(qs.length)+' سؤالًا</span></div>'+cards+'</section>';
 }).join('');
 $('modelPreview').innerHTML='<div class="selection-summary">نموذج '+letters[i]+' · '+ar(modelQuestions(m).length)+' سؤالًا · '+selectedSubjects().map(x=>labels[x]).join(' + ')+' · معرفة '+ar(stats.knowledge)+' · تطبيق '+ar(stats.application)+' · استدلال '+ar(stats.reasoning)+(stats.unknown?' · غير موسوم '+ar(stats.unknown):'')+'</div>'+sections;
}
async function buildModels(){
 try{validate();}catch(e){setStatus(e.message,'error');return;}
 const btn=$('buildModels');btn.disabled=true;models=[];assignments=[];$('previewSection').classList.add('hidden');$('assignmentSection').classList.add('hidden');
 const count=Number($('modelCount').value||5),used=new Set();let repeatTotal=0,maxRepeats=repeatLimit();
 const requiredRepeats=minimumRequiredRepeats();
 try{
   for(let i=0;i<count;i++){
     const remaining=Math.max(0,maxRepeats-repeatTotal);
     setStatus('جارٍ بناء نموذج '+letters[i]+' من '+count+' — تم تحسين السرعة للاختبارات الكبيرة، ونختار أقل تكرار ممكن دون عشرات المحاولات الزائدة…');
     const previous=models[i-1]||null;
     const d=await bestCandidate(letters[i],used,remaining,i,previous);
     const overlap=overlapCount(d,used);
     repeatTotal+=overlap;
     models.push(d);questionIds(d).forEach(id=>used.add(id));
   }
   const sameAB=models.length>1?samePositionCount(models[0],models[1]):0;
   const signatures=models.map(modelSignature),distinctSets=new Set(signatures).size;
   activeModel=0;renderQuality();renderModelTabs();renderModel(0);$('previewSection').classList.remove('hidden');$('previewSection').scrollIntoView({behavior:'smooth'});
   const repeatNote=repeatTotal>maxRepeats
     ?'استخدم النظام '+ar(repeatTotal)+' تكرارًا بين النماذج لأن بنك المؤشرات بعد فلاتر الجودة لا يسمح بالحد التقديري '+ar(maxRepeats)+'، مع اختيار أقل تكرار متاح.'
     :'إجمالي التكرار بين النماذج '+ar(repeatTotal)+' ضمن الحد التقديري '+ar(maxRepeats)+'.';
   setStatus('تم إنشاء '+count+' نماذج منظمة حسب المواد. '+repeatNote+' مجموعات الأسئلة المختلفة: '+ar(distinctSets)+' من '+ar(count)+'. اختلاف مواضع أ/ب: '+ar(Math.max(0,modelQuestions(models[0]).length-sameAB))+' من '+ar(modelQuestions(models[0]).length)+'.','ok');
 }catch(e){setStatus('تعذر بناء النماذج: '+e.message,'error');}
 finally{btn.disabled=false;}
}
async function buildAssignments(){
 const bad=models.flatMap((m,i)=>incompleteChoices(m).map((q,n)=>({model:letters[i],question:q.question||'',n:n+1})));
 if(bad.length){setStatus('تم إيقاف التجهيز لأن هناك '+bad.length+' سؤالًا ناقص الاختيارات. أعد إنشاء النماذج؛ لن تُطبع ورقة ناقصة.','error');return;}
 if(models.some(m=>!hasValidAnswerKey(m))){setStatus('تم إيقاف التجهيز لأن مفتاح إجابة أحد الأسئلة غير مكتمل. أعد إنشاء النماذج.','error');return;}
 const list=selectedStudents(),count=models.length,subjects=selectedSubjects();
 assignments=list.map((st,i)=>({student:st,model:i%count,letter:letters[i%count]}));
 const counts=Array.from({length:count},(_,i)=>assignments.filter(a=>a.model===i).length);
 $('assignmentStats').innerHTML=counts.map((n,i)=>'<div class="quality-card ok"><span>نموذج '+letters[i]+'</span><b>'+ar(n)+' طلاب</b></div>').join('');
 $('assignments').innerHTML=assignments.map(a=>'<div class="assignment-row"><b>'+esc(a.student.full_name||a.student.student_name||'طالب')+'</b><span class="model-badge">نموذج '+a.letter+'</span></div>').join('');
 $('assignmentSection').classList.remove('hidden');$('assignmentSection').scrollIntoView({behavior:'smooth'});
 try{
   const existing=JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');
   const reviewId=existing?.review_id||makeReviewId();
   const printable=models.map((m,i)=>({
     model:letters[i],
     questions:(m.sections||[]).flatMap(sec=>orderedQuestions(sec.questions||[]).map(q=>({...q,subject:sec.subject})))
   }));
   const selectedIndicators=getSelectedIndicators();
   const draftPayload={
     review_id:reviewId,title:$('reviewTitle').value,subject:subjects[0],subjects,class_name:$('className').value,
     question_count:Number($('questionCount').value),question_start:1,model_count:models.length,bubble_name_mode:$('bubbleNameMode')?.value||'printed',
     indicator_counts:selectedIndicators,
     assignments:assignments.map((a,i)=>({sheet_no:i+1,student_id:a.student.id||'',student_name:a.student.full_name||a.student.student_name,class_name:a.student.class_name||'',model:a.letter})),
     models:printable.map(m=>({model:m.model,questions:m.questions.map(q=>({
       id:q.id||q.question_id||'',subject:q.subject||String(q.indicator_key||q.indicator||'').split(':')[0]||subjects[0],context:q.context||'',question:q.question||'',options:q.options||[],
       image_url:q.image_url||q.imageUrl||q.media_url||q.image?.url||'',image_alt:q.image_alt||q.imageAlt||q.image?.alt||'',
       indicator:q.indicator_key||q.indicator||q.indicator_text||'',cognitive_level:q.cognitive_level||q.cognitive||'',difficulty:q.difficulty||''
     }))})),
     answer_keys:printable.map(m=>({model:m.model,answers:m.questions.map(q=>({
       question_id:q.id||q.question_id||'',correct_index:Number(q.correctIndex),
       subject:q.subject||String(q.indicator_key||q.indicator||'').split(':')[0]||subjects[0],
       indicator:q.indicator_key||q.indicator||q.indicator_text||''
     }))})),
     saved_at:new Date().toISOString()
   };
   localStorage.setItem('nafes_review_correction_draft',JSON.stringify(draftPayload));
   history.replaceState(null,'','review-correction.html?rid='+encodeURIComponent(reviewId));setReviewLinks(reviewId);
   setStatus('جارٍ حفظ الاختبار متعدد المؤشرات والمواد في قاعدة البيانات…');
   await NafesTeacher.api('teacher_paper_review_upsert',{review:draftPayload});
   setStatus('تم حفظ الاختبار. المواد مرتبة داخله: '+subjects.map(x=>labels[x]).join(' + ')+'.','ok');await loadArchive();
 }catch(e){setStatus('تم تجهيز الأوراق على هذا الجهاز، لكن تعذر الحفظ الدائم: '+e.message,'error');}
}
function restoreReviewPayload(payload){
 if(!payload||!Array.isArray(payload.models)||!payload.models.length)return false;
 localStorage.setItem('nafes_review_correction_draft',JSON.stringify(payload));
 if($('reviewTitle'))$('reviewTitle').value=payload.title||'مراجعة مؤشرات نافس';
 const payloadSubjects=(Array.isArray(payload.subjects)&&payload.subjects.length?payload.subjects:[payload.subject]).filter(x=>allowedSubjects().includes(x));
 document.querySelectorAll('.subject-check').forEach(x=>x.checked=payloadSubjects.includes(String(x.value)));
 if(!document.querySelector('.subject-check:checked')&&document.querySelector('.subject-check'))document.querySelector('.subject-check').checked=true;
 if($('subject'))$('subject').value=selectedSubjects()[0]||payload.subject||'reading';
 if($('className')&&[...$('className').options].some(o=>o.value===String(payload.class_name||'')))$('className').value=String(payload.class_name||'');
 renderStudents();
 if($('questionCount')&&[...$('questionCount').options].some(o=>Number(o.value)===Number(payload.question_count)))$('questionCount').value=String(payload.question_count);
 if($('modelCount')&&[...$('modelCount').options].some(o=>Number(o.value)===Number(payload.model_count)))$('modelCount').value=String(payload.model_count);
 if($('bubbleNameMode'))$('bubbleNameMode').value=payload.bubble_name_mode==='blank'?'blank':'printed';
 indicatorState.clear();
 for(const x of payload.indicator_counts||[]){
   const subject=x.subject||String(x.key||'').split(':')[0]||payload.subject;
   indicatorState.set(String(x.key),{checked:true,count:Number(x.count||0),subject});
 }
 renderIndicators();updateIndicatorSummary();
 const selectedIds=new Set((payload.assignments||[]).map(a=>String(a.student_id||'')));
 const selectedNames=new Set((payload.assignments||[]).map(a=>String(a.student_name||'')));
 document.querySelectorAll('.student-check').forEach(x=>{
   const st=visibleStudents().find(v=>String(v.id)===String(x.dataset.id));
   x.checked=!!st&&(selectedIds.has(String(st.id))||selectedNames.has(String(st.full_name||st.student_name||'')));
 });
 $('studentCount').textContent=ar(selectedStudents().length)+' طالب محدد';
 const keyByModel=new Map((payload.answer_keys||[]).map(k=>[String(k.model),new Map((k.answers||[]).map(a=>[String(a.question_id||''),a]))]));
 models=(payload.models||[]).map(m=>{
   const keys=keyByModel.get(String(m.model))||new Map(),sectionMap=new Map();
   for(const q of m.questions||[]){
     const k=keys.get(String(q.id||q.question_id||''))||{};
     const subject=q.subject||k.subject||String(q.indicator||k.indicator||'').split(':')[0]||payload.subject||'reading';
     if(!sectionMap.has(subject))sectionMap.set(subject,{subject,questions:[]});
     sectionMap.get(subject).questions.push({...q,subject,correctIndex:Number(k.correct_index),indicator_key:q.indicator||k.indicator||'',cognitive_level:q.cognitive_level||'',difficulty:q.difficulty||''});
   }
   const order=(payloadSubjects.length?payloadSubjects:[...sectionMap.keys()]);
   return{sections:order.filter(x=>sectionMap.has(x)).map(x=>sectionMap.get(x)).concat([...sectionMap.entries()].filter(([x])=>!order.includes(x)).map(([,v])=>v))};
 });
 const studentMap=new Map(visibleStudents().map(st=>[String(st.id),st]));
 assignments=(payload.assignments||[]).map(a=>{
   const student=studentMap.get(String(a.student_id||''))||visibleStudents().find(st=>String(st.full_name||st.student_name||'')===String(a.student_name||''))||{id:a.student_id||'',full_name:a.student_name||'طالب',class_name:a.class_name||''};
   const model=Math.max(0,letters.indexOf(String(a.model||'')));
   return{student,model,letter:String(a.model||letters[model]||'أ')};
 });
 if(models.length){activeModel=0;renderQuality();renderModelTabs();renderModel(0);$('previewSection').classList.remove('hidden');}
 if(assignments.length){
   const counts=Array.from({length:models.length},(_,i)=>assignments.filter(a=>a.model===i).length);
   $('assignmentStats').innerHTML=counts.map((n,i)=>'<div class="quality-card ok"><span>نموذج '+letters[i]+'</span><b>'+ar(n)+' طلاب</b></div>').join('');
   $('assignments').innerHTML=assignments.map(a=>'<div class="assignment-row"><b>'+esc(a.student.full_name||a.student.student_name||'طالب')+'</b><span class="model-badge">نموذج '+a.letter+'</span></div>').join('');
   $('assignmentSection').classList.remove('hidden');
 }
 history.replaceState(null,'','review-correction.html?rid='+encodeURIComponent(payload.review_id));setReviewLinks(payload.review_id);
 return true;
}
async function restoreSavedReview(){
 try{
   const local=JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');
   const rid=new URLSearchParams(location.search).get('rid')||local?.review_id||'';
   let res=await NafesTeacher.api('teacher_paper_review_get',rid?{review_id:rid}:{});
   if(!res?.review&&rid)res=await NafesTeacher.api('teacher_paper_review_get',{});
   const payload=res?.review?.payload;
   if(payload&&restoreReviewPayload(payload)){setStatus('تمت استعادة آخر مراجعة محفوظة من قاعدة البيانات، بما فيها النماذج ومفاتيح الإجابة وتوزيع الطلاب.','ok');return true;}
   if(local?.review_id&&Array.isArray(local.models)&&local.models.length){
     await NafesTeacher.api('teacher_paper_review_upsert',{review:local});
     if(restoreReviewPayload(local)){setStatus('تم نقل المراجعة الموجودة على هذا الجهاز إلى قاعدة البيانات وحفظها بشكل دائم.','ok');return true;}
   }
 }catch(e){console.warn('paper review restore failed',e);}
 return false;
}

async function load(){
 if(!window.NafesTeacher?.getKey()){NafesTeacher.requireKey('أدخل مفتاح المعلم لفتح قسم المراجعة والتصحيح الآلي.');setStatus('يلزم تسجيل دخول المعلم.');return;}
 try{
   setStatus('جارٍ تحميل بنك المؤشرات وسجل الطلاب…');
   await NafesTeacher.ensureProfile?.();
   const [cat,stu]=await Promise.all([NafesTeacher.api('teacher_catalog'),NafesTeacher.api('teacher_students_list',{include_archived:false})]);
   catalog=cat;students=stu.students||[];populateSubject();populateClasses();renderIndicators();updateLevelSummary();
   const restored=await restoreSavedReview();
   await loadArchive();
   if(!restored)setStatus('تم ربط القسم ببنك المؤشرات وسجل الطلاب الحالي في منصة معلّمي.','ok');
 }catch(e){setStatus(e.message,'error');}
}
$('subjectChoices').addEventListener('change',e=>{
 if(!e.target.matches('.subject-check'))return;
 captureIndicatorState();
 if(!document.querySelector('.subject-check:checked'))e.target.checked=true;
 $('subject').value=selectedSubjects()[0]||'reading';
 renderIndicators();
});
$('className').addEventListener('change',renderStudents);
$('questionCount').addEventListener('change',()=>{distributeIndicatorCounts();updateIndicatorSummary();updateLevelSummary();});
['knowledge','application','reasoning'].forEach(id=>$(id).addEventListener('input',updateLevelSummary));
$('indicatorSearch').addEventListener('input',renderIndicators);
$('indicators').addEventListener('change',e=>{if(e.target.matches('.indicator-check')){captureIndicatorState();distributeIndicatorCounts();updateIndicatorSummary();}});
$('indicators').addEventListener('input',e=>{if(e.target.matches('.indicator-count')){captureIndicatorState();updateIndicatorSummary();}});
$('selectAllIndicators').onclick=()=>{[...document.querySelectorAll('.indicator-row .indicator-check')].forEach(x=>x.checked=true);captureIndicatorState();distributeIndicatorCounts();updateIndicatorSummary();};
$('clearIndicators').onclick=()=>{document.querySelectorAll('.indicator-check').forEach(x=>x.checked=false);captureIndicatorState();updateIndicatorSummary();};
$('selectAllStudents').onchange=e=>{document.querySelectorAll('.student-check').forEach(x=>x.checked=e.target.checked);$('studentCount').textContent=ar(selectedStudents().length)+' طالب محدد';};
$('students').addEventListener('change',()=>{$('studentCount').textContent=ar(selectedStudents().length)+' طالب محدد';});
$('buildModels').onclick=buildModels;
$('rebuildModels').onclick=buildModels;
$('assignModels').onclick=buildAssignments;
$('modelTabs').addEventListener('click',e=>{const b=e.target.closest('[data-model]');if(b)renderModel(Number(b.dataset.model));});
$('refreshArchive')?.addEventListener('click',loadArchive);
$('reviewArchive')?.addEventListener('click',e=>{const b=e.target.closest('[data-open-review]');if(b)openArchivedReview(b.dataset.openReview);});
addEventListener('nafes:teacher-profile',()=>{const keep=selectedSubjects();populateSubject();document.querySelectorAll('.subject-check').forEach(x=>x.checked=keep.includes(String(x.value)));if(!document.querySelector('.subject-check:checked')&&document.querySelector('.subject-check'))document.querySelector('.subject-check').checked=true;$('subject').value=selectedSubjects()[0]||'reading';renderIndicators();});
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load();});
load();
})();