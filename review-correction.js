(()=>{
'use strict';
const $=id=>document.getElementById(id);
const makeReviewId=()=>('R'+Date.now().toString(36).toUpperCase());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const labels={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const letters=['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
const MAX_CROSS_MODEL_REPEATS=10;
let catalog=null,students=[],models=[],activeModel=0,assignments=[];
function setStatus(msg,type){const el=$('status');el.textContent=msg;el.className='status'+(type?' '+type:'');}
function setReviewLinks(reviewId){
 const q=reviewId?'?rid='+encodeURIComponent(reviewId):'';
 const scan=document.querySelectorAll('a[href^="review-scan.html"]');
 const bubbles=document.querySelectorAll('a[href^="review-bubble-sheets.html"]');
 const papers=document.querySelectorAll('a[href^="review-question-papers.html"]');
 scan.forEach(a=>a.href='review-scan.html'+q);bubbles.forEach(a=>a.href='review-bubble-sheets.html'+q);papers.forEach(a=>a.href='review-question-papers.html'+q);
}
function formatArchiveTime(v){
 if(!v)return'';
 try{return new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch(_){return String(v);}
}
function archiveItem(row){
 const rid=encodeURIComponent(row.review_id||''),subject=labels[row.subject]||row.subject||'—',cls=row.class_name?('فصل '+row.class_name):'جميع الفصول';
 return '<article class="archive-item" data-review-id="'+esc(row.review_id||'')+'">'+
   '<h3>'+esc(row.title||'مراجعة ورقية')+'</h3>'+
   '<div class="archive-meta"><span>'+esc(subject)+'</span><span>'+esc(cls)+'</span><span>'+esc(formatArchiveTime(row.updated_at||row.created_at))+'</span></div>'+
   '<div class="archive-actions">'+
     '<button type="button" class="open-review" data-open-review="'+esc(row.review_id||'')+'">فتح الاختبار</button>'+
     '<a href="review-question-papers.html?rid='+rid+'">أوراق الأسئلة</a>'+
     '<a href="review-bubble-sheets.html?rid='+rid+'">ورق التظليل</a>'+
     '<a href="review-scan.html?rid='+rid+'">رفع وتصحيح</a>'+
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
   host.innerHTML=local?.review_id?archiveItem({review_id:local.review_id,title:local.title,subject:local.subject,class_name:local.class_name,updated_at:local.saved_at}):'<div class="archive-empty">تعذر تحميل الأرشيف الدائم الآن.</div>';
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
function selectedSubject(){return $('subject').value||'reading';}
function allowedSubjects(){
 const scope=window.NafesTeacher?.getScope?.()||'all';
 return scope==='all'?['reading','math','science']:[scope];
}
function cognitiveOf(q){
 const raw=String(q?.cognitive_level||q?.cognitive||q?.level||q?.bloom||'').toLowerCase();
 if(/knowledge|معرفة/.test(raw))return'knowledge';
 if(/application|apply|تطبيق/.test(raw))return'application';
 if(/reason|استدلال|analysis/.test(raw))return'reasoning';
 return'unknown';
}
function updateLevelSummary(){
 const k=Number($('knowledge').value||0),a=Number($('application').value||0),r=Number($('reasoning').value||0),sum=k+a+r,q=Number($('questionCount').value||20);
 const counts=[Math.round(q*k/100),Math.round(q*a/100),Math.max(0,q-Math.round(q*k/100)-Math.round(q*a/100))];
 $('levelSummary').textContent=(sum===100?'الهدف: ':'تنبيه: المجموع '+sum+'% — يجب أن يساوي 100%. ')+'معرفة '+counts[0]+' · تطبيق '+counts[1]+' · استدلال '+counts[2]+' من '+q+' سؤالًا.';
 $('buildModels').disabled=sum!==100;
}
function populateSubject(){
 $('subject').innerHTML=allowedSubjects().map(s=>'<option value="'+s+'">'+labels[s]+'</option>').join('');
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
function subjectIndicators(){
 const s=selectedSubject();
 return (catalog?.indicators||[]).filter(i=>i.subject===s);
}
function renderIndicators(){
 const q=$('indicatorSearch').value.trim();
 const items=subjectIndicators().filter(i=>!q||String(i.text||'').includes(q));
 $('indicators').innerHTML=items.map((i,n)=>'<label class="indicator-row" data-key="'+esc(i.key)+'"><input class="indicator-check" type="checkbox" value="'+esc(i.key)+'"><span><p>'+ar(n+1)+') '+esc(i.text||i.key)+'</p><small>المتاح في البنك: '+ar(i.available||0)+' سؤالًا</small></span><input class="indicator-count" type="number" min="1" max="60" value="1" disabled aria-label="عدد الأسئلة"></label>').join('');
 updateIndicatorSummary();
}
function distributeIndicatorCounts(){
 const rows=[...document.querySelectorAll('.indicator-row')].filter(r=>r.querySelector('.indicator-check')?.checked);
 if(!rows.length)return;
 const total=Number($('questionCount').value||20);
 if(selectedSubject()==='reading'){
   const blocks=Math.floor(total/5);
   if(blocks<rows.length){
     rows.forEach((r,i)=>{const x=r.querySelector('.indicator-count');x.disabled=false;x.value=5;});
     updateIndicatorSummary();
     return;
   }
   const base=Math.floor(blocks/rows.length),extra=blocks%rows.length;
   rows.forEach((r,i)=>{const x=r.querySelector('.indicator-count');x.disabled=false;x.value=(base+(i<extra?1:0))*5;});
   return;
 }
 const base=Math.floor(total/rows.length),extra=total%rows.length;
 rows.forEach((r,i)=>{const x=r.querySelector('.indicator-count');x.disabled=false;x.value=base+(i<extra?1:0);});
}
function updateIndicatorSummary(){
 const rows=[...document.querySelectorAll('.indicator-row')],sel=rows.filter(r=>r.querySelector('.indicator-check')?.checked);
 rows.forEach(r=>r.classList.toggle('selected',r.querySelector('.indicator-check')?.checked));
 sel.forEach(r=>r.querySelector('.indicator-count').disabled=false);
 rows.filter(r=>!r.querySelector('.indicator-check')?.checked).forEach(r=>r.querySelector('.indicator-count').disabled=true);
 const total=sel.reduce((n,r)=>n+Number(r.querySelector('.indicator-count').value||0),0),target=Number($('questionCount').value||20);
 const readingNote=selectedSubject()==='reading'?' · بناء القراءة: كل نص يتبعه ٥ أسئلة':'';
 $('indicatorSummary').textContent='المحدد: '+ar(sel.length)+' مؤشر · مجموع الأسئلة: '+ar(total)+' من '+ar(target)+readingNote+(sel.length&&total!==target?' — اختر عدد أسئلة يكفي ٥ أسئلة لكل مؤشر أو عدّل التوزيع.':'');
}
function getSelectedIndicators(){
 return [...document.querySelectorAll('.indicator-row')].filter(r=>r.querySelector('.indicator-check')?.checked).map(r=>({key:r.dataset.key,count:Number(r.querySelector('.indicator-count').value||0)}));
}
function selectedStudents(){
 const ids=new Set([...document.querySelectorAll('.student-check:checked')].map(x=>String(x.dataset.id)));
 return visibleStudents().filter(s=>ids.has(String(s.id)));
}
function configForModel(letter){
 const subject=selectedSubject(),inds=getSelectedIndicators();
 return {kind:'multi_indicator',review_passage_mode:subject==='reading',grade_key:'middle_3',title:$('reviewTitle').value.trim()+' — نموذج '+letter,class_name:$('className').value?('ثالث متوسط '+$('className').value):'ثالث متوسط',term:'الفصل الدراسي الأول',academic_term:'الفصل الدراسي الأول',school_name:'',teacher_name:'',principal_name:'',identity_mode:'manual',roster:[],sections:[{subject:subject,question_count:Number($('questionCount').value),duration_minutes:45,calculator:subject==='math',model_no:1,indicators:inds}],count_mode:'per_indicator',settings:{show_result:false,show_answers:false,show_indicator_result:false,show_correct_count:false,shuffle_questions:false,shuffle_options:false,allow_copy:false,disable_right_click:false,disable_print:false,disable_shortcuts:false,allow_back:true,one_per_page:false,lock_session:false,log_visibility:false,watermark:false,attempts:1,opens_at:null,closes_at:null,break_minutes:0}};
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
 const section=(d?.sections||[])[0];if(!section||!Array.isArray(section.questions)||section.questions.length<2)return d;
 const qs=[...section.questions],reading=selectedSubject()==='reading';
 let candidates=[];
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
 if(!candidates.length)return d;
 const prevQs=previous?modelQuestions(previous):[];
 const score=row=>{
   let same=0;
   for(let i=0;i<Math.min(row.length,prevQs.length);i++)if(questionId(row[i])&&questionId(row[i])===questionId(prevQs[i]))same++;
   const sameIndicator=row.reduce((n,q,i)=>n+(prevQs[i]&&String(q.indicator_key||q.indicator||'')===String(prevQs[i].indicator_key||prevQs[i].indicator||'')?1:0),0);
   return same*1000+sameIndicator;
 };
 candidates.sort((a,b)=>score(a)-score(b));
 section.questions=candidates[0];
 return d;
}
async function bestCandidate(letter,used,repeatBudget,modelIndex,previous){
 const reading=selectedSubject()==='reading';
 const attempts=reading?24:($('avoidRepeats').checked?16:10);
 let best=null,bestScore=Infinity,bestOverlap=Infinity;
 for(let n=0;n<attempts;n++){
   let d=await NafesTeacher.api('teacher_preview',{config:configForModel(letter),regenerate:n>0});
   if(incompleteChoices(d).length||!hasValidAnswerKey(d))continue;
   d=reorderModelQuestions(d,modelIndex,previous);
   const overlap=overlapCount(d,used);
   const repeatPenalty=overlap*1000000;
   const positionPenalty=previous?samePositionCount(previous,d)*10000:0;
   const cognitivePenalty=cognitiveScore(d)*2;
   const printPenalty=reading?layoutScore(d):0;
   const score=repeatPenalty+positionPenalty+cognitivePenalty+printPenalty;
   if(score<bestScore){best=d;bestScore=score;bestOverlap=overlap;}
   if(overlap===0&&(!previous||samePositionCount(previous,d)===0))break;
 }
 if(!best||bestOverlap>repeatBudget){
   throw new Error('تعذر بناء نموذج مكتمل الإجابات ضمن حد التكرار المتبقي ('+repeatBudget+'). لن يتم اعتماد أي سؤال ناقص الخيارات.');
 }
 return best;
}
function validate(){
 const inds=getSelectedIndicators(),q=Number($('questionCount').value),sum=inds.reduce((n,x)=>n+x.count,0),stu=selectedStudents();
 if(!$('reviewTitle').value.trim())throw new Error('اكتب اسم المراجعة.');
 if(!inds.length)throw new Error('اختر مؤشرًا واحدًا على الأقل.');
 if(sum!==q)throw new Error('مجموع أسئلة المؤشرات يجب أن يساوي '+q+' سؤالًا.');
 if(selectedSubject()==='reading'){
   if(q%5!==0)throw new Error('عدد أسئلة القراءة يجب أن يكون من مضاعفات ٥.');
   if(inds.some(x=>x.count%5!==0||x.count<5))throw new Error('في القراءة: كل مؤشر مختار يجب أن يأخذ ٥ أسئلة أو مضاعفاتها حتى يكون البناء: نص ثم ٥ أسئلة.');
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
  ['التكرارات بين النماذج',dup,dup>MAX_CROSS_MODEL_REPEATS?'warn':'ok'],
  ['الحد الأعلى للتكرار',MAX_CROSS_MODEL_REPEATS,'ok'],
  ['أسئلة بلا وسم معرفي',unknown,unknown?'warn':'ok']
 ];
 $('quality').innerHTML=cards.map(x=>'<div class="quality-card '+x[2]+'"><span>'+x[0]+'</span><b>'+ar(x[1])+'</b></div>').join('');
}
function renderModelTabs(){
 $('modelTabs').innerHTML=models.map((m,i)=>'<button class="model-tab '+(i===activeModel?'active':'')+'" data-model="'+i+'">نموذج '+letters[i]+'</button>').join('');
}
function renderModel(i){
 activeModel=i;renderModelTabs();
 const m=models[i],qs=modelQuestions(m),stats=modelStats(m);
 $('modelPreview').innerHTML='<div class="selection-summary">نموذج '+letters[i]+' · '+ar(qs.length)+' سؤالًا · معرفة '+ar(stats.knowledge)+' · تطبيق '+ar(stats.application)+' · استدلال '+ar(stats.reasoning)+(stats.unknown?' · غير موسوم '+ar(stats.unknown):'')+'</div>'+qs.map((q,n)=>'<article class="question-card"><div class="q-meta"><span class="chip">س'+ar(n+1)+'</span><span class="chip">'+esc(q.indicator_text||q.indicator||'مؤشر نافس')+'</span><span class="chip">'+({knowledge:'معرفة',application:'تطبيق',reasoning:'استدلال',unknown:'غير موسوم'})[cognitiveOf(q)]+'</span></div>'+(q.context?'<p>'+esc(q.context)+'</p>':'')+'<p><b>'+esc(q.question||'')+'</b></p><ol type="أ">'+(q.options||[]).map(o=>'<li>'+esc(o)+'</li>').join('')+'</ol><div class="correct-key">مفتاح المعلم: '+esc((q.options||[])[q.correctIndex]||'—')+'</div></article>').join('');
}
async function buildModels(){
 try{validate();}catch(e){setStatus(e.message,'error');return;}
 const btn=$('buildModels');btn.disabled=true;models=[];assignments=[];$('previewSection').classList.add('hidden');$('assignmentSection').classList.add('hidden');
 const count=Number($('modelCount').value||5),used=new Set();let repeatTotal=0;
 try{
   for(let i=0;i<count;i++){
     const remaining=Math.max(0,MAX_CROSS_MODEL_REPEATS-repeatTotal);
     setStatus('جارٍ بناء نموذج '+letters[i]+' من '+count+' — التكرار المسموح المتبقي '+remaining+' فقط…');
     const previous=models[i-1]||null;
     const d=await bestCandidate(letters[i],used,remaining,i,previous);
     const overlap=overlapCount(d,used);
     repeatTotal+=overlap;
     if(repeatTotal>MAX_CROSS_MODEL_REPEATS)throw new Error('تجاوزت النماذج حد التكرار الأقصى وهو '+MAX_CROSS_MODEL_REPEATS+'.');
     models.push(d);questionIds(d).forEach(id=>used.add(id));
   }
   if(models.length>1&&samePositionCount(models[0],models[1])>0){
     throw new Error('لم يتحقق اختلاف ترتيب النموذجين الأول والثاني بالكامل. أعد الإنشاء.');
   }
   activeModel=0;renderQuality();renderModelTabs();renderModel(0);$('previewSection').classList.remove('hidden');$('previewSection').scrollIntoView({behavior:'smooth'});setStatus('تم إنشاء '+count+' نماذج. إجمالي التكرار '+repeatTotal+' من حد أقصى '+MAX_CROSS_MODEL_REPEATS+'، وترتيب النموذجين أ وب مختلف بالكامل.','ok');
 }catch(e){setStatus('تعذر بناء النماذج: '+e.message,'error');}
 finally{btn.disabled=false;}
}
async function buildAssignments(){
 const bad=models.flatMap((m,i)=>incompleteChoices(m).map((q,n)=>({model:letters[i],question:q.question||'',n:n+1})));
 if(bad.length){setStatus('تم إيقاف التجهيز لأن هناك '+bad.length+' سؤالًا ناقص الاختيارات. أعد إنشاء النماذج؛ لن تُطبع ورقة ناقصة.','error');return;}
 if(models.some(m=>!hasValidAnswerKey(m))){setStatus('تم إيقاف التجهيز لأن مفتاح إجابة أحد الأسئلة غير مكتمل. أعد إنشاء النماذج.','error');return;}
 const list=selectedStudents(),count=models.length;
 assignments=list.map((s,i)=>({student:s,model:i%count,letter:letters[i%count]}));
 const counts=Array.from({length:count},(_,i)=>assignments.filter(a=>a.model===i).length);
 $('assignmentStats').innerHTML=counts.map((n,i)=>'<div class="quality-card ok"><span>نموذج '+letters[i]+'</span><b>'+ar(n)+' طلاب</b></div>').join('');
 $('assignments').innerHTML=assignments.map(a=>'<div class="assignment-row"><b>'+esc(a.student.full_name||a.student.student_name||'طالب')+'</b><span class="model-badge">نموذج '+a.letter+'</span></div>').join('');
 $('assignmentSection').classList.remove('hidden');$('assignmentSection').scrollIntoView({behavior:'smooth'});
 try{
   const existing=JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');
   const reviewId=existing?.review_id||makeReviewId();
   const printable=models.map((m,i)=>({model:letters[i],questions:orderedQuestions(modelQuestions(m))}));
   const draftPayload={
     review_id:reviewId,title:$('reviewTitle').value,subject:selectedSubject(),class_name:$('className').value,
     question_count:Number($('questionCount').value),question_start:1,model_count:models.length,bubble_name_mode:$('bubbleNameMode')?.value||'printed',indicator_counts:getSelectedIndicators(),
     assignments:assignments.map((a,i)=>({sheet_no:i+1,student_id:a.student.id||'',student_name:a.student.full_name||a.student.student_name,model:a.letter})),
     models:printable.map(m=>({model:m.model,questions:m.questions.map(q=>({
       id:q.id||q.question_id||'',context:q.context||'',question:q.question||'',options:q.options||[],
       image_url:q.image_url||q.imageUrl||q.media_url||'',image_alt:q.image_alt||q.imageAlt||'',
       indicator:q.indicator_key||q.indicator||q.indicator_text||'',cognitive_level:q.cognitive_level||q.cognitive||'',difficulty:q.difficulty||''
     }))})),
     answer_keys:printable.map(m=>({model:m.model,answers:m.questions.map(q=>({
       question_id:q.id||q.question_id||'',correct_index:Number(q.correctIndex),
       indicator:q.indicator_key||q.indicator||q.indicator_text||''
     }))})),
     saved_at:new Date().toISOString()
   };
   localStorage.setItem('nafes_review_correction_draft',JSON.stringify(draftPayload));
   history.replaceState(null,'','review-correction.html?rid='+encodeURIComponent(reviewId));setReviewLinks(reviewId);
   setStatus('جارٍ حفظ المراجعة والنماذج ومفاتيح الإجابة وتوزيع الطلاب في قاعدة البيانات…');
   await NafesTeacher.api('teacher_paper_review_upsert',{review:draftPayload});
   setStatus('تم حفظ المراجعة في منصة معلّمي. يمكنك الخروج والعودة من جهاز آخر بنفس حساب المعلم دون فقدانها.','ok');await loadArchive();
 }catch(e){
   setStatus('تم تجهيز الأوراق على هذا الجهاز، لكن تعذر الحفظ الدائم: '+e.message,'error');
 }
}
function restoreReviewPayload(payload){
 if(!payload||!Array.isArray(payload.models)||!payload.models.length)return false;
 localStorage.setItem('nafes_review_correction_draft',JSON.stringify(payload));
 if($('reviewTitle'))$('reviewTitle').value=payload.title||'مراجعة مؤشرات نافس';
 if($('subject')&&[...$('subject').options].some(o=>o.value===payload.subject)){$('subject').value=payload.subject;renderIndicators();}
 if($('className')&&[...$('className').options].some(o=>o.value===String(payload.class_name||'')))$('className').value=String(payload.class_name||'');
 if($('questionCount')&&[...$('questionCount').options].some(o=>Number(o.value)===Number(payload.question_count)))$('questionCount').value=String(payload.question_count);
 if($('modelCount')&&[...$('modelCount').options].some(o=>Number(o.value)===Number(payload.model_count)))$('modelCount').value=String(payload.model_count);if($('bubbleNameMode'))$('bubbleNameMode').value=payload.bubble_name_mode==='blank'?'blank':'printed';
 const indMap=new Map((payload.indicator_counts||[]).map(x=>[String(x.key),Number(x.count||0)]));
 document.querySelectorAll('.indicator-row').forEach(r=>{
   const n=indMap.get(String(r.dataset.key)),check=r.querySelector('.indicator-check'),cnt=r.querySelector('.indicator-count');
   if(check){check.checked=Number.isFinite(n);if(cnt&&Number.isFinite(n)){cnt.disabled=false;cnt.value=String(n);}}
 });
 updateIndicatorSummary();
 const selectedIds=new Set((payload.assignments||[]).map(a=>String(a.student_id||'')));
 const selectedNames=new Set((payload.assignments||[]).map(a=>String(a.student_name||'')));
 document.querySelectorAll('.student-check').forEach(x=>{
   const s=visibleStudents().find(st=>String(st.id)===String(x.dataset.id));
   x.checked=!!s&&(selectedIds.has(String(s.id))||selectedNames.has(String(s.full_name||s.student_name||'')));
 });
 $('studentCount').textContent=ar(selectedStudents().length)+' طالب محدد';
 const keyByModel=new Map((payload.answer_keys||[]).map(k=>[String(k.model),new Map((k.answers||[]).map(a=>[String(a.question_id||''),a]))]));
 models=(payload.models||[]).map(m=>{
   const keys=keyByModel.get(String(m.model))||new Map();
   return{sections:[{subject:payload.subject,questions:(m.questions||[]).map(q=>{
     const k=keys.get(String(q.id||q.question_id||''))||{};
     return{...q,correctIndex:Number(k.correct_index),indicator_key:q.indicator||k.indicator||'',cognitive_level:q.cognitive_level||'',difficulty:q.difficulty||''};
   })}]};
 });
 const studentMap=new Map(visibleStudents().map(s=>[String(s.id),s]));
 assignments=(payload.assignments||[]).map(a=>{
   const student=studentMap.get(String(a.student_id||''))||visibleStudents().find(s=>String(s.full_name||s.student_name||'')===String(a.student_name||''))||{id:a.student_id||'',full_name:a.student_name||'طالب'};
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
$('subject').addEventListener('change',()=>{renderIndicators();});
$('className').addEventListener('change',renderStudents);
$('questionCount').addEventListener('change',()=>{distributeIndicatorCounts();updateIndicatorSummary();updateLevelSummary();});
['knowledge','application','reasoning'].forEach(id=>$(id).addEventListener('input',updateLevelSummary));
$('indicatorSearch').addEventListener('input',renderIndicators);
$('indicators').addEventListener('change',e=>{if(e.target.matches('.indicator-check')){distributeIndicatorCounts();updateIndicatorSummary();}});
$('indicators').addEventListener('input',e=>{if(e.target.matches('.indicator-count'))updateIndicatorSummary();});
$('selectAllIndicators').onclick=()=>{[...document.querySelectorAll('.indicator-row:not([hidden]) .indicator-check')].forEach(x=>x.checked=true);distributeIndicatorCounts();updateIndicatorSummary();};
$('clearIndicators').onclick=()=>{document.querySelectorAll('.indicator-check').forEach(x=>x.checked=false);updateIndicatorSummary();};
$('selectAllStudents').onchange=e=>{document.querySelectorAll('.student-check').forEach(x=>x.checked=e.target.checked);$('studentCount').textContent=ar(selectedStudents().length)+' طالب محدد';};
$('students').addEventListener('change',()=>{$('studentCount').textContent=ar(selectedStudents().length)+' طالب محدد';});
$('buildModels').onclick=buildModels;
$('rebuildModels').onclick=buildModels;
$('assignModels').onclick=buildAssignments;
$('modelTabs').addEventListener('click',e=>{const b=e.target.closest('[data-model]');if(b)renderModel(Number(b.dataset.model));});
$('refreshArchive')?.addEventListener('click',loadArchive);
$('reviewArchive')?.addEventListener('click',e=>{const b=e.target.closest('[data-open-review]');if(b)openArchivedReview(b.dataset.openReview);});
addEventListener('nafes:teacher-profile',()=>{const keep=$('subject')?.value;populateSubject();if(keep&&[...$('subject').options].some(o=>o.value===keep))$('subject').value=keep;renderIndicators();});
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load();});
load();
})();