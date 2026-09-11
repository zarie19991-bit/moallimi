(()=>{
'use strict';
const T=window.NafesTeacher,A=window.NafesAnalytics,$=id=>document.getElementById(id);
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
const keys=['reading','math','science'];
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=v=>v===null||v===undefined||Number.isNaN(Number(v))?'—':new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v));
const pct=v=>v===null||v===undefined||Number.isNaN(Number(v))?'غير مقاس':`${ar(v)}٪`;
function submitted(a){return A?.isSubmitted?A.isSubmitted(a):!!a.submitted_at}
function scorable(q){return A?.isScorable?A.isScorable(q):(typeof q.correct==='boolean'&&Number(q.correct_index??q.correctIndex)>=0)}
function measure(a,s){if(A?.measure)return A.measure(a,{subject:s});const qs=(a.questions||[]).filter(q=>q.subject===s&&scorable(q));const c=qs.filter(q=>q.correct).length;return{correct:c,total:qs.length,percent:qs.length?c/qs.length*100:null}}
function identity(a){return A?.studentIdentity?.(a)||String(a.student_id||a.student_name||a.id)}
function indKey(q){return A?.indicatorKey?A.indicatorKey(q):(q.indicator_key||null)}
function mean(v){const a=v.filter(x=>x!==null&&x!==undefined&&Number.isFinite(Number(x))).map(Number);return a.length?a.reduce((s,x)=>s+x,0)/a.length:null}
function median(v){const a=v.filter(x=>x!==null&&x!==undefined&&Number.isFinite(Number(x))).map(Number).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function level(p){if(p===null||p===undefined)return'غير مقاس';if(p>=80)return'متقن';if(p>=65)return'قريب من الإتقان';if(p>=50)return'بحاجة إلى دعم';return'غير متقن'}
function table(headers,rows){return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="muted">لا توجد بيانات حقيقية في هذا النطاق.</td></tr>`}</tbody></table></div>`}
async function loadAttempts(){let cursor=0,out=[];do{const d=await T.api('teacher_data',{cursor,limit:100});out.push(...(d.attempts||[]));cursor=d.next_cursor}while(cursor!==null);return out.filter(submitted)}
function latestByStudentSubject(attempts,className){const maps=Object.fromEntries(keys.map(k=>[k,new Map()]));for(const a of attempts){if(className&&String(a.class_name||'').trim()!==className)continue;for(const s of keys){const m=measure(a,s);if(!m.total)continue;const id=identity(a),old=maps[s].get(id),t=Date.parse(a.submitted_at||a.started_at||0)||0,ot=old?(Date.parse(old.a.submitted_at||old.a.started_at||0)||0):-1;if(!old||t>ot)maps[s].set(id,{a,m})}}return maps}
async function renderAll(){
 if($('subjectSelect')?.value!=='all'||!T?.getKey?.())return;
 const sumEl=$('subjectSummary'),stuEl=$('subjectStudents'),indEl=$('subjectIndicators'),qEl=$('subjectQuestions');
 sumEl.innerHTML='<div class="state">جارٍ إنشاء تحليل موحد للمواد الثلاث…</div>';
 try{
  const attempts=await loadAttempts(),className=$('subjectClass')?.value||'',maps=latestByStudentSubject(attempts,className),students=new Map();
  for(const s of keys){
    for(const [id,r] of maps[s]){
      if(!students.has(id))students.set(id,{name:r.a.student_name||'اسم غير مسجل',className:r.a.class_name||'—',correct:0,total:0,subjects:0});
      const st=students.get(id);st.correct+=Number(r.m.correct||0);st.total+=Number(r.m.total||0);st.subjects++;
    }
  }
  const rows=[...students.values()].map(x=>({...x,overall:x.total?x.correct/x.total*100:null})).sort((a,b)=>(a.overall??999)-(b.overall??999));
  const vals=rows.map(r=>r.overall).filter(v=>v!==null),allCorrect=rows.reduce((s,r)=>s+r.correct,0),allTotal=rows.reduce((s,r)=>s+r.total,0),combined=allTotal?allCorrect/allTotal*100:null,mastery=vals.length?vals.filter(v=>v>=80).length/vals.length*100:null;
  sumEl.innerHTML=`<section class="section-card combined-analysis-head"><div class="section-head"><div><h2>التحليل الموحد للمواد الثلاث</h2><p class="muted">تُدمج نتائج القراءة والرياضيات والعلوم في قياس واحد، ولا تُعرض كل مادة كتحليل مستقل هنا.</p></div></div><div class="metrics"><div class="metric"><span>عدد الطلاب المقاسين</span><b>${ar(vals.length)}</b></div><div class="metric"><span>النسبة المجمعة</span><b>${pct(combined)}</b></div><div class="metric"><span>متوسط الطلاب</span><b>${pct(mean(vals))}</b></div><div class="metric"><span>الوسيط</span><b>${pct(median(vals))}</b></div><div class="metric"><span>أعلى نتيجة مجمعة</span><b>${pct(vals.length?Math.max(...vals):null)}</b></div><div class="metric"><span>نسبة الإتقان</span><b>${pct(mastery)}</b></div></div><div class="combined-total"><b>${ar(allCorrect)}</b> إجابة صحيحة من <b>${ar(allTotal)}</b> سؤالًا مقاسًا في المواد الثلاث مجتمعة.</div></section>`;
  stuEl.innerHTML=`<div class="section-head"><div><h2>الطلاب — نتيجة موحدة للمواد الثلاث</h2><p class="muted">النسبة لكل طالب = مجموع إجاباته الصحيحة في المواد الثلاث ÷ مجموع الأسئلة المقاسة له في المواد الثلاث.</p></div></div>${table(['الطالب','الفصل','المواد المقاسة','الصحيح الكلي','إجمالي الأسئلة','النسبة المجمعة','المستوى'],rows.map(r=>[`<b>${E(r.name)}</b>`,E(r.className),ar(r.subjects),ar(r.correct),ar(r.total),pct(r.overall),E(level(r.overall))]))}`;
  const ig=new Map(),qg=new Map();
  for(const s of keys)for(const {a} of maps[s].values())for(const q of a.questions||[]){
    if(q.subject!==s||!scorable(q))continue;
    const ik=indKey(q);
    if(ik){const k=`${s}:${ik}`;if(!ig.has(k))ig.set(k,{subject:s,text:q.indicator_text||ik,c:0,t:0});const g=ig.get(k);g.t++;if(q.correct)g.c++}
    const qk=`${s}:${q.question_fingerprint||q.id||q.question}`;if(!qg.has(qk))qg.set(qk,{subject:s,text:q.question||'—',indicator:q.indicator_text||ik||'—',w:0,t:0});const z=qg.get(qk);z.t++;if(!q.correct)z.w++;
  }
  const inds=[...ig.values()].map(g=>({...g,p:g.t?g.c/g.t*100:null})).sort((a,b)=>(a.p??999)-(b.p??999));
  indEl.innerHTML=`<div class="section-head"><div><h2>المؤشرات الأضعف في المواد الثلاث مجتمعة</h2><p class="muted">قائمة موحدة مرتبة من الأضعف إلى الأقوى، مع بيان المادة فقط للتعريف بالمؤشر.</p></div></div>${table(['المادة','المؤشر','النسبة'],inds.slice(0,50).map(g=>[names[g.subject],E(g.text),pct(g.p)]))}`;
  const qs=[...qg.values()].map(g=>({...g,p:g.t?g.w/g.t*100:null})).sort((a,b)=>(b.p??-1)-(a.p??-1));
  qEl.innerHTML=`<div class="section-head"><div><h2>الأسئلة الأعلى خطأ في المواد الثلاث مجتمعة</h2><p class="muted">ترتيب موحد لجميع الأسئلة دون فصل التحليل إلى قراءة ورياضيات وعلوم.</p></div></div>${table(['المادة','السؤال','المؤشر','عدد المقاسين','نسبة الخطأ'],qs.slice(0,60).map(g=>[names[g.subject],E(g.text),E(g.indicator),ar(g.t),pct(g.p)]))}`;
 }catch(e){sumEl.innerHTML=`<div class="error">${E(e.message||'تعذر تحميل التحليل.')}</div>`}
}
function install(){const s=$('subjectSelect');if(!s)return;if(![...s.options].some(o=>o.value==='all'))s.insertAdjacentHTML('afterbegin','<option value="all">جميع المواد — تحليل موحد</option>');else{const o=[...s.options].find(o=>o.value==='all');if(o)o.textContent='جميع المواد — تحليل موحد'}s.addEventListener('change',()=>{if(s.value==='all')setTimeout(renderAll,20)});$('subjectClass')?.addEventListener('change',()=>{if(s.value==='all')setTimeout(renderAll,20)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
