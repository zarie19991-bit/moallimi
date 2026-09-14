/* Participation comes from the school roster and submitted attempts, never grades. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.NafesReportAbsentees=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const clean=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ');
 const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const digits=v=>clean(v).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g,'').slice(-3);
 const nameKey=v=>clean(v).replace(/[\u064B-\u0652\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ة/g,'ه').replace(/[ىي]/g,'ي').toLowerCase();
 const ar=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(v);
 const subjects={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
 const rowsPerPage=14;
 function classKey(value){
  const raw=clean(value);
  if(!raw||/^(all|كل الفصول|جميع الفصول)$/i.test(raw))return '';
  const text=raw.replace(/[إآا]/g,'أ');
  if(text.length===1)return text;
  const letters=[...new Set([...text.matchAll(/(?:^|[\s/\\()\-])([أبجد])(?=$|[\s/\\()\-])/g)].map(m=>m[1]))];
  return letters.length>1?'':letters[0]||text;
 }
 const isSubmitted=a=>!['in_progress','expired'].includes(a.status)&&(!!a.submitted_at||['submitted','completed','finished'].includes(a.status));
 const testId=a=>clean(a.test_id||a.assessment_id||a.exam_id);
 function identityKey(row){const n=nameKey(row?.full_name||row?.student_name),c=classKey(row?.class_name),d=digits(row?.national_id_last3||row?.student_no);return n&&c&&d.length===3?`${n}\u0000${c}\u0000${d}`:''}
 function groups({roster,attempts=[],tests=[],selectedIds=[],className='',subject}={}){
  if(!Array.isArray(roster))throw new Error('تعذر تحميل كشف الطلاب.');
  const active=new Map(),knownIds=new Set(),identityIndex=new Map();
  for(const student of roster){
   const id=clean(student?.id||student?.student_id);
   if(id)knownIds.add(id);
   if(student&&student.is_active!==false&&id&&!active.has(id))active.set(id,student);
  }
  for(const [sid,student] of active){const key=identityKey(student);if(!key)continue;if(!identityIndex.has(key))identityIndex.set(key,sid);else identityIndex.set(key,null)}
  return [...new Set(selectedIds.map(clean).filter(Boolean))].map(id=>{
   const test=tests.find(t=>clean(t.id)===id)||{};
   const scope=classKey(className);
   const eligible=[...active.entries()].filter(([,s])=>!scope||classKey(s.class_name)===scope);
   const eligibleIds=new Set(eligible.map(([sid])=>sid));
   const completed=new Set();let unresolved=0,legacyLinked=0;
   for(const a of attempts){
    if(testId(a)!==id||!isSubmitted(a))continue;
    let sid=[a.student_id,a.student_key].map(clean).find(key=>knownIds.has(key));
    if(!sid){const fallback=identityKey(a),matched=fallback?identityIndex.get(fallback):null;if(matched){sid=matched;legacyLinked++;}}
    if(sid){if(eligibleIds.has(sid))completed.add(sid);continue;}
    if(scope&&classKey(a.class_name)&&classKey(a.class_name)!==scope)continue;
    unresolved++;
   }
   const missing=eligible.filter(([sid])=>!completed.has(sid)).map(([,s])=>({name:clean(s.full_name||s.student_name)||'اسم غير مسجل',className:clean(s.class_name)||'غير محدد'})).sort((a,b)=>a.className.localeCompare(b.className,'ar')||a.name.localeCompare(b.name,'ar'));
   const warning=!eligible.length?'لا توجد أسماء في كشف الطلاب ضمن الفصل المحدد.':unresolved?`يوجد ${ar(unresolved)} من النتائج المسلّمة لم يمكن ربطها بطالب واحد بأمان. تظهر القائمة أدناه بحسب الربط الحالي، ويجب مراجعة هذه النتائج غير المرتبطة.`:'';
   const subjectLabel=subject?subjects[subject]:(test.subjects||[]).map(s=>subjects[s]).filter(Boolean).join('، ');
   return {id,title:clean(test.title||attempts.find(a=>testId(a)===id)?.title)||'اختبار نافس',subjectLabel:subjectLabel||'',className:scope,total:eligible.length,tested:completed.size,missing,warning,unresolved,legacyLinked};
  });
 }
 function render(groupList,{settings={},style='subject'}={}){
  return groupList.map(group=>{
   const chunks=[];for(let start=0;start<group.missing.length;start+=rowsPerPage)chunks.push(group.missing.slice(start,start+rowsPerPage));if(!chunks.length)chunks.push([]);
   return chunks.map((students,page)=>`<article class="report-sheet nafes-absence-sheet${style==='weekly'?' weekly-report':''}" dir="rtl">
    <header class="na-head"><div><span>المملكة العربية السعودية</span><b>${esc(settings.schoolName||'مدرسة ابن سينا المتوسطة')}</b><span>متابعة المشاركة في اختبارات نافس</span></div><small>${ar(page+1)} / ${ar(chunks.length)}</small></header>
    <h2>الطلاب الذين لم يختبروا</h2><p class="na-test">${esc(group.title)}</p><p class="na-scope">${group.subjectLabel?`المادة: ${esc(group.subjectLabel)} · `:''}الفصل: ${esc(group.className||'جميع الفصول')}</p>
    ${group.total===null?'':`<div class="na-counts"><div><span>إجمالي عدد الطلاب</span><b>${ar(group.total)}</b></div><div><span>عدد الطلاب المختبرين المرتبطين بالكشف</span><b>${group.tested===null?'—':ar(group.tested)}</b></div><div><span>لم يظهر لهم تسليم مرتبط</span><b>${ar(group.missing.length)}</b></div></div>`}
    ${group.warning?`<p class="na-empty">${esc(group.warning)}</p>`:''}
    ${students.length?`<table class="na-table"><thead><tr><th>م</th><th>اسم الطالب</th><th>الفصل</th></tr></thead><tbody>${students.map((s,i)=>`<tr><td>${ar(page*rowsPerPage+i+1)}</td><td>${esc(s.name)}</td><td>${esc(s.className)}</td></tr>`).join('')}</tbody></table>`:!group.warning?'<p class="na-empty">أدّى جميع الطلاب في هذا النطاق الاختبار.</p>':''}
    <footer class="na-footer">${settings.teacherName?`المعلم: ${esc(settings.teacherName)}`:'كشف متابعة الطلاب'}</footer></article>`).join('');
  }).join('');
 }
 async function create(options){try{const data=await root.NafesTeacher.api('teacher_students_list',{include_archived:false});return render(groups({...options,roster:data?.students}),options)}catch(error){return render([{title:'متابعة المشاركة في الاختبارات المحددة',total:null,tested:null,missing:[],warning:'تعذر تحميل كشف الطلاب لتحديد غير المختبرين. حدّث البيانات ثم أعد إنشاء التقرير.'}],options)}}
 return Object.freeze({groups,render,create});
});