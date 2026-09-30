(()=>{
'use strict';
const $=id=>document.getElementById(id);
const makeReviewId=()=>('R'+Date.now().toString(36).toUpperCase());
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const labels={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const letters=['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
let catalog=null,students=[],models=[],activeModel=0,assignments=[];
function setStatus(msg,type){const el=$('status');el.textContent=msg;el.className='status'+(type?' '+type:'');}
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
 $('indicators').innerHTML=items.map((i,n)=>'<label class="indicator-row" data-key="'+esc(i.key)+'"><input class="indicator-check" type="checkbox" value="'+esc(i.key)+'"><span><p>'+ar(n+1)+') '+esc(i.text||i.key)+'</p><small>المتاح في البنك: '+ar(i.available||0)+' سؤالًا</small></span><input class="indicator-count" type="number" min="1" max="30" value="1" disabled aria-label="عدد الأسئلة"></label>').join('');
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
async function bestCandidate(letter,used){
 const reading=selectedSubject()==='reading';
 const attempts=reading?9:($('avoidRepeats').checked?2:1);
 let best=null,bestScore=Infinity;
 for(let n=0;n<attempts;n++){
   const d=await NafesTeacher.api('teacher_preview',{config:configForModel(letter),regenerate:n>0});
   const repeatPenalty=overlapCount(d,used)*1000;
   const cognitivePenalty=cognitiveScore(d)*2;
   const printPenalty=reading?layoutScore(d)*3:0;
   const score=repeatPenalty+cognitivePenalty+printPenalty;
   if(score<bestScore){best=d;bestScore=score;}
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
  ['التكرارات بين النماذج',dup,dup?'warn':'ok'],
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
 const count=Number($('modelCount').value||5),used=new Set();
 try{
   for(let i=0;i<count;i++){
     setStatus('جارٍ بناء نموذج '+letters[i]+' من '+count+' ومقارنته ببقية النماذج…');
     const d=await bestCandidate(letters[i],used);models.push(d);questionIds(d).forEach(id=>used.add(id));
   }
   activeModel=0;renderQuality();renderModelTabs();renderModel(0);$('previewSection').classList.remove('hidden');$('previewSection').scrollIntoView({behavior:'smooth'});setStatus('تم إنشاء '+count+' نماذج فعلية من بنك المؤشرات. راجعها قبل تجهيز أوراق التظليل.','ok');
 }catch(e){setStatus('تعذر بناء النماذج: '+e.message,'error');}
 finally{btn.disabled=false;}
}
function buildAssignments(){
 const list=selectedStudents(),count=models.length;
 assignments=list.map((s,i)=>({student:s,model:i%count,letter:letters[i%count]}));
 const counts=Array.from({length:count},(_,i)=>assignments.filter(a=>a.model===i).length);
 $('assignmentStats').innerHTML=counts.map((n,i)=>'<div class="quality-card ok"><span>نموذج '+letters[i]+'</span><b>'+ar(n)+' طلاب</b></div>').join('');
 $('assignments').innerHTML=assignments.map(a=>'<div class="assignment-row"><b>'+esc(a.student.full_name||a.student.student_name||'طالب')+'</b><span class="model-badge">نموذج '+a.letter+'</span></div>').join('');
 $('assignmentSection').classList.remove('hidden');$('assignmentSection').scrollIntoView({behavior:'smooth'});setStatus('تم توزيع النماذج بالتساوي قدر الإمكان. أصبحت البيانات جاهزة للمرحلة التالية: ورقة التظليل بالاسم وQR.','ok');
 try{
 const existing=JSON.parse(localStorage.getItem('nafes_review_correction_draft')||'null');
 const reviewId=existing?.review_id||makeReviewId();
 const printable=models.map((m,i)=>({model:letters[i],questions:orderedQuestions(modelQuestions(m))}));
 localStorage.setItem('nafes_review_correction_draft',JSON.stringify({
   review_id:reviewId,title:$('reviewTitle').value,subject:selectedSubject(),class_name:$('className').value,
   question_count:Number($('questionCount').value),question_start:1,model_count:models.length,indicator_counts:getSelectedIndicators(),
   assignments:assignments.map((a,i)=>({sheet_no:i+1,student_name:a.student.full_name||a.student.student_name,model:a.letter})),
   models:printable.map(m=>({model:m.model,questions:m.questions.map(q=>({
     id:q.id||q.question_id||'',context:q.context||'',question:q.question||'',options:q.options||[],
     image_url:q.image_url||q.imageUrl||q.media_url||'',image_alt:q.image_alt||q.imageAlt||'',
     indicator:q.indicator_key||q.indicator||q.indicator_text||''
   }))})),
   answer_keys:printable.map(m=>({model:m.model,answers:m.questions.map(q=>({
     question_id:q.id||q.question_id||'',correct_index:Number(q.correctIndex),
     indicator:q.indicator_key||q.indicator||q.indicator_text||''
   }))})),
   saved_at:new Date().toISOString()
 }));
}catch(_){}
}
async function load(){
 if(!window.NafesTeacher?.getKey()){NafesTeacher.requireKey('أدخل مفتاح المعلم لفتح قسم المراجعة والتصحيح الآلي.');setStatus('يلزم تسجيل دخول المعلم.');return;}
 try{
   setStatus('جارٍ تحميل بنك المؤشرات وسجل الطلاب…');
   const [cat,stu]=await Promise.all([NafesTeacher.api('teacher_catalog'),NafesTeacher.api('teacher_students_list',{include_archived:false})]);
   catalog=cat;students=stu.students||[];populateSubject();populateClasses();renderIndicators();updateLevelSummary();
   setStatus('تم ربط القسم ببنك المؤشرات وسجل الطلاب الحالي في منصة معلّمي.','ok');
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
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)load();});
load();
})();