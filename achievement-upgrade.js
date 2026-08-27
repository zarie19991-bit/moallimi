(()=>{
const baseRender=window.renderAchievement||renderAchievement;
const U={loaded:false,loading:null,meetings:[],evidence:[],blocks:[],sections:[]};
const B=()=>state.books?.[0]||{};
const norm=s=>String(s??'').replace(/\s+/g,' ').trim();
const n=v=>Number.isFinite(+v)?+v:null;
const when=d=>d?new Date(d).toLocaleDateString('ar-SA'):'—';
const lines=v=>String(v||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const uniq=a=>[...new Set(a.filter(Boolean))];

function isNafesRow(r){
 const label=norm(r?.assessment_label);
 const a=state.assessments.find(x=>x.subject_profile_id===r?.subject_profile_id&&norm(x.title)===label);
 return label.includes('نافس')||a?.term==='نافس';
}
function filteredRows(p,mode='general'){
 let rows=p?state.results.filter(r=>r.subject_profile_id===p.id&&r.student_id):[];
 if(mode==='nafes') rows=rows.filter(isNafesRow);
 if(mode==='general') rows=rows.filter(r=>!isNafesRow(r));
 return rows;
}
function examGroups(rows){
 const map=new Map();
 for(const r of rows){
   const key=[r.student_id,norm(r.assessment_label)||'قياس',r.assessment_date||String(r.created_at||'').slice(0,10),r.source_file_name||''].join('§');
   if(!map.has(key))map.set(key,[]);
   map.get(key).push(r);
 }
 return [...map.values()].map(rs=>{
   const overall=rs.filter(r=>!r.skill_name&&!r.objective_title&&n(r.percent)!=null);
   let percent=null;
   if(overall.length) percent=overall.reduce((s,r)=>s+n(r.percent),0)/overall.length;
   else{
     const weighted=rs.filter(r=>n(r.score)!=null&&n(r.max_score)>0);
     const max=weighted.reduce((s,r)=>s+n(r.max_score),0);
     if(max>0) percent=weighted.reduce((s,r)=>s+n(r.score),0)/max*100;
     else{
       const vals=rs.map(r=>n(r.percent)).filter(v=>v!=null);
       percent=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
     }
   }
   return {student_id:rs[0].student_id,label:rs[0].assessment_label||'قياس',date:rs[0].assessment_date||rs[0].created_at,percent,rows:rs};
 }).filter(x=>x.percent!=null);
}
function levelFor(percent,p){
 if(percent==null)return'none';
 const hi=n(p?.high_threshold)??80,mid=n(p?.medium_threshold)??60;
 return percent>=hi?'high':percent>=mid?'medium':'low';
}
function statsFor(p,mode='general'){
 const rows=filteredRows(p,mode),exams=examGroups(rows),by=new Map();
 for(const e of exams){if(!by.has(e.student_id))by.set(e.student_id,[]);by.get(e.student_id).push(e)}
 const students=[...by.entries()].map(([id,es])=>{
   es.sort((a,b)=>new Date(a.date)-new Date(b.date));
   const avg=es.reduce((s,e)=>s+e.percent,0)/es.length;
   const trend=es.length>1?es.at(-1).percent-es[0].percent:0;
   const weak=rows.filter(r=>r.student_id===id&&(r.skill_name||r.objective_title)&&n(r.percent)!=null&&n(r.percent)<(n(p?.medium_threshold)??60));
   return {id,name:state.students.find(s=>s.id===id)?.full_name||es[0]?.rows?.[0]?.student_name||'طالب',avg,trend,level:levelFor(avg,p),exams:es,weak,last:es.at(-1)};
 });
 const avg=students.length?students.reduce((s,x)=>s+x.avg,0)/students.length:null;
 return {rows,exams,students,avg,high:students.filter(x=>x.level==='high').length,medium:students.filter(x=>x.level==='medium').length,low:students.filter(x=>x.level==='low').length,up:students.filter(x=>x.trend>1).length,down:students.filter(x=>x.trend<-1).length};
}
async function loadExtras(force=false){
 if(U.loaded&&!force)return U;
 if(U.loading&&!force)return U.loading;
 const bid=B().id;if(!bid)return U;
 U.loading=Promise.all([
  req('/rest/v1/achievement_meetings?select=*&book_id=eq.'+bid+'&order=sort_order.asc,meeting_date.asc'),
  req('/rest/v1/achievement_evidence?select=*&book_id=eq.'+bid+'&order=created_at.desc'),
  req('/rest/v1/achievement_book_blocks?select=*&order=sort_order.asc,created_at.asc'),
  req('/rest/v1/achievement_book_sections?select=*&book_id=eq.'+bid+'&order=sort_order.asc')
 ]).then(([m,e,b,s])=>{U.meetings=m.ok?m.data||[]:[];U.evidence=e.ok?e.data||[]:[];U.blocks=b.ok?b.data||[]:[];U.sections=s.ok?s.data||[]:[];U.loaded=true;U.loading=null;return U});
 return U.loading;
}
function sectionId(key){return U.sections.find(x=>x.section_key===key)?.id||''}
function planFor(studentId,subjectKey,type='remedial_plan'){return U.blocks.find(b=>b.block_type===type&&b.content?.student_id===studentId&&b.content?.subject_key===subjectKey)}
function configBlock(type){return U.blocks.find(b=>b.block_type===type)}
function paper(){return document.querySelector('#achievementArea .ach-paper')}
function footerHtml(title){return `<footer class="ach-page-footer"><span>${esc(title)}</span><b>ملف التحصيل الدراسي</b></footer>`}
function head(title,sub=''){return `<div class="ach-paper-head"><div><span>المملكة العربية السعودية · وزارة التعليم · إدارة التعليم بمنطقة نجران</span><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div><div class="ach-school"><b>${esc(B().school_name||'متوسطة ابن سينا')}</b><small>${esc(B().academic_year||'1448هـ')}</small></div></div>`}
function gradeChips(){return `<div class="ach-grade-chips">${GRADES.map(g=>`<button class="${state.grade===g?'active':''}" onclick="achievementGrade('${g}')">${g}</button>`).join('')}</div>`}
function subjectChips(keys=Object.keys(SUBJECTS)){return `<div class="ach-subject-chips">${keys.map(k=>`<button class="${state.subject===k?'active':''}" onclick="achievementSubject('${k}')">${esc(SUBJECTS[k]?.name||k)}</button>`).join('')}</div>`}
function metric(label,value,sub='',cls=''){return `<div class="ach-metric ${cls}"><span>${esc(label)}</span><b>${value}</b>${sub?`<small>${esc(sub)}</small>`:''}</div>`}
function weakTags(a,limit=4){return uniq(a.map(r=>r.skill_name||r.objective_title)).slice(-limit).map(x=>`<span class="ach-weak">${esc(x)}</span>`).join('')||'—'}

function analysisPage(kind){
 const p=state.profiles.find(x=>x.subject_key===state.subject&&x.grade_level===state.grade),st=statsFor(p,'general'),hi=n(p?.high_threshold)??80,mid=n(p?.medium_threshold)??60;
 return `${head(kind==='final'?'تحليل نتائج الاختبارات النهائية لكل فصل دراسي':'تحليل نتائج الاختبارات الفترية لكل فصل دراسي','النتائج العامة مفصولة عن نافس، وكل اختبار يُحسب مرة واحدة مهما تعددت مهاراته')}
 ${gradeChips()}${subjectChips()}
 <div class="ach-toolbar no-print"><button class="btn" onclick="editAchievementThresholds()">حدود التصنيف: مرتفع ${hi}٪ · متوسط ${mid}٪</button></div>
 <div class="ach-metrics">${metric('متوسط المادة',pct(st.avg),'متوسط الاختبارات الفعلية')}${metric('مرتفع',st.high,`${hi}٪ فأكثر`,'good')}${metric('متوسط',st.medium,`${mid}–${hi-1}٪`,'mid')}${metric('متدني',st.low,`أقل من ${mid}٪`,'low')}</div>
 <div class="ach-block"><h3>تحليل الطلاب</h3><div class="ach-table-wrap"><table><thead><tr><th>الطالب</th><th>عدد الاختبارات</th><th>المتوسط</th><th>المستوى</th><th>الاتجاه</th><th>آخر اختبار</th><th>المهارات المتدنية</th></tr></thead><tbody>
 ${st.students.map(s=>`<tr><td><button class="ach-student-link" onclick="openStudent('${s.id}')">${esc(s.name)}</button></td><td>${s.exams.length}</td><td>${pct(s.avg)}</td><td><span class="status ${s.level}">${levelText(s.level)}</span></td><td>${trendHtml(s.trend)}</td><td>${esc(s.last?.label||'—')} · ${pct(s.last?.percent)}</td><td>${weakTags(s.weak)}</td></tr>`).join('')||'<tr><td colspan="7">لا توجد نتائج عامة مسجلة لهذه المادة والمرحلة بعد.</td></tr>'}
 </tbody></table></div></div>${footerHtml(kind==='final'?'التحليل النهائي':'التحليل الفتري')}`;
}
function nafesLevel(avg,p,cfg){
 if(avg==null)return'none'; const hi=n(p?.high_threshold)??80,mid=n(p?.medium_threshold)??60,vl=n(cfg?.very_low_threshold);
 if(avg>=hi)return'high';if(avg>=mid)return'medium';if(vl!=null&&avg<vl)return'very-low';return'low';
}
function nafesPage(plan=false){
 const cfg=configBlock('nafes_thresholds')?.content||{},subjects=['arabic','math','science'];
 const cards=subjects.map(k=>{const p=state.profiles.find(x=>x.subject_key===k&&x.grade_level==='الثالث المتوسط'),st=statsFor(p,'nafes'),vl=n(cfg.very_low_threshold);const counts={high:0,medium:0,low:0,'very-low':0};st.students.forEach(s=>counts[nafesLevel(s.avg,p,cfg)]++);return {k,p,st,vl,counts}});
 return `${head(plan?'إجراءات خطة معالجة نتائج الطلاب في اختبار نافس':'تحليل نتائج اختبارات نافس','القراءة · الرياضيات · العلوم — الصف الثالث المتوسط')}
 <div class="ach-toolbar no-print"><button class="btn" onclick="editNafesThresholds()">إعداد تصنيف نافس</button><button class="btn primary" onclick="switchSection('nafes')">فتح قسم نافس</button></div>
 ${cfg.very_low_threshold==null?'<div class="ach-alert">ملف المدرسة يذكر أربع فئات: منخفض جدًا، منخفض، متوسط، مرتفع؛ ولم يحدد حدًا رقميًا للفصل بين «منخفض جدًا» و«منخفض». لذلك لن يخترع النظام رقمًا من عنده. اضغط «إعداد تصنيف نافس» وحدد الحد المعتمد في المدرسة.</div>':''}
 <div class="ach-nafes-grid">${cards.map(x=>`<section class="ach-block"><h3>${x.k==='arabic'?'القراءة':esc(SUBJECTS[x.k].name)}</h3><strong class="ach-big">${pct(x.st.avg)}</strong><div class="ach-mini-levels"><span>مرتفع ${x.counts.high}</span><span>متوسط ${x.counts.medium}</span><span>منخفض ${x.counts.low}</span><span>منخفض جدًا ${x.vl==null?'—':x.counts['very-low']}</span></div><small>${x.st.exams.length} اختبار/محاولة محتسبة من نافس فقط</small></section>`).join('')}</div>
 ${plan?`<div class="ach-process"><span>تحليل نتيجة نافس</span><b>←</b><span>تحديد القوة والضعف</span><b>←</b><span>تصنيف المستوى</span><b>←</b><span>إجراء علاجي</span><b>←</b><span>قياس الأثر</span></div>`:''}
 <div class="ach-block"><h3>نتائج الطلاب في نافس فقط</h3><div class="ach-table-wrap"><table><thead><tr><th>المادة</th><th>الطالب</th><th>الاختبارات</th><th>المتوسط</th><th>التصنيف</th><th>المهارات المتدنية</th></tr></thead><tbody>
 ${cards.flatMap(x=>x.st.students.map(s=>`<tr><td>${x.k==='arabic'?'القراءة':esc(SUBJECTS[x.k].name)}</td><td>${esc(s.name)}</td><td>${s.exams.length}</td><td>${pct(s.avg)}</td><td>${nafesLevel(s.avg,x.p,cfg)==='very-low'?'منخفض جدًا':nafesLevel(s.avg,x.p,cfg)==='low'?'منخفض':nafesLevel(s.avg,x.p,cfg)==='medium'?'متوسط':'مرتفع'}</td><td>${weakTags(s.weak)}</td></tr>`)).join('')||'<tr><td colspan="6">لا توجد نتائج نافس مسجلة حتى الآن.</td></tr>'}
 </tbody></table></div></div>${footerHtml('نافس')}`;
}
function meetingsPage(){
 return `${head('اجتماعات لجنة التحصيل الدراسي','نموذج حي قابل للحفظ والتعديل والتوثيق')}
 <div class="ach-toolbar no-print"><button class="btn primary" onclick="editAchievementMeeting()">+ اجتماع جديد</button><button class="btn" onclick="addAchievementEvidence('meetings')">+ إضافة شاهد</button></div>
 <div class="ach-block"><div class="ach-table-wrap"><table><thead><tr><th>رقم</th><th>التاريخ</th><th>الفئة</th><th>الموضوع</th><th>المكان</th><th>القرارات</th><th class="no-print">إدارة</th></tr></thead><tbody>
 ${U.meetings.map(m=>`<tr><td>${m.meeting_no??'—'}</td><td>${when(m.meeting_date)}</td><td>${esc(m.target_group||'—')}</td><td>${esc(m.topic||'—')}</td><td>${esc(m.venue||'—')}</td><td>${Array.isArray(m.decisions)?m.decisions.length:0}</td><td class="no-print"><button class="btn" onclick="editAchievementMeeting('${m.id}')">تعديل</button> <button class="btn" onclick="addAchievementEvidence('meetings','${m.id}')">شاهد</button></td></tr>`).join('')||'<tr><td colspan="7">لم تُسجل اجتماعات بعد. اضغط «اجتماع جديد» لإنشاء المحضر الأول.</td></tr>'}
 </tbody></table></div></div>
 <div class="ach-block"><h3>المحاور المعتمدة في ملف المدرسة</h3><ul><li>عرض ومناقشة خطة التحصيل الدراسي.</li><li>مناقشة تقارير تحليل النتائج والاختبارات الوطنية.</li><li>مناقشة برامج رفع المستوى والخطط العلاجية.</li><li>تحديد القرارات والتوصيات ومسؤول التنفيذ والمتابعة.</li></ul></div>${footerHtml('اجتماعات اللجنة')}`;
}
function lowCases(){
 const out=[]; for(const k of Object.keys(SUBJECTS)){const p=state.profiles.find(x=>x.subject_key===k&&x.grade_level===state.grade);if(!p)continue;const st=statsFor(p,'general');for(const s of st.students.filter(x=>x.level==='low'))out.push({k,p,s,plan:planFor(s.id,k)})} return out;
}
function delayedPage(){
 const cases=lowCases();
 return `${head('خطة الطلاب المتأخرين دراسيًا','الحصر مبني على المادة والاختبارات الفعلية، لا على متوسط عام مختلط')}
 ${gradeChips()}<div class="ach-block"><div class="ach-table-wrap"><table><thead><tr><th>الطالب</th><th>المادة</th><th>المتوسط</th><th>آخر اختبار</th><th>المهارات المتدنية</th><th>تكرار الضعف</th><th>الخطة</th><th>قياس الأثر</th></tr></thead><tbody>
 ${cases.map(x=>{const c=x.plan?.content||{},imp=n(c.post_percent)!=null&&n(c.pre_percent)!=null?n(c.post_percent)-n(c.pre_percent):null;return `<tr><td><button class="ach-student-link" onclick="openStudent('${x.s.id}')">${esc(x.s.name)}</button></td><td>${esc(SUBJECTS[x.k].name)}</td><td>${pct(x.s.avg)}</td><td>${esc(x.s.last?.label||'—')} · ${pct(x.s.last?.percent)}</td><td>${weakTags(x.s.weak)}</td><td>${x.s.weak.length}</td><td>${x.plan?'<span class="status medium">خطة قائمة</span>':'<span class="status low">تحتاج خطة</span>'}<br><button class="btn no-print" onclick="editRemedialPlan('${x.s.id}','${x.k}')">${x.plan?'تعديل':'إنشاء'}</button></td><td>${imp==null?'—':(imp>0?'+':'')+Math.round(imp)+'٪'}</td></tr>`}).join('')||'<tr><td colspan="8">لا توجد حالات مصنفة متدنية في المواد العامة حاليًا.</td></tr>'}
 </tbody></table></div></div>${footerHtml('الطلاب المتأخرون')}`;
}
function remedialPage(){
 const plans=U.blocks.filter(b=>b.block_type==='remedial_plan'),cases=lowCases();
 return `${head('نماذج الخطط العلاجية والاختبارات القبلية والبعدية','اسم الطالب · الصف · المادة · مظاهر الضعف · الأسباب · الأنشطة · المتابعة · الملاحظات')}
 <div class="ach-toolbar no-print">${gradeChips()}<button class="btn" onclick="addAchievementEvidence('remedial')">+ شاهد للخطة العلاجية</button></div>
 <div class="ach-block"><h3>خطط محفوظة</h3>${plans.map(b=>{const c=b.content||{},s=state.students.find(x=>x.id===c.student_id),imp=n(c.post_percent)!=null&&n(c.pre_percent)!=null?n(c.post_percent)-n(c.pre_percent):null;return `<div class="ach-plan-card"><div><b>${esc(s?.full_name||b.title||'طالب')}</b><small>${esc(SUBJECTS[c.subject_key]?.name||'—')} · ${esc(c.grade||'')}</small></div><div>قبلي ${pct(c.pre_percent)} ← بعدي ${pct(c.post_percent)} ${imp==null?'':`<strong>${imp>=0?'+':''}${Math.round(imp)}٪</strong>`}</div><button class="btn no-print" onclick="editRemedialPlan('${c.student_id}','${c.subject_key}')">تعديل</button></div>`}).join('')||'<p>لم تُحفظ خطط علاجية بعد.</p>'}</div>
 <div class="ach-block"><h3>حالات تقترح لها خطة</h3>${cases.slice(0,20).map(x=>`<button class="ach-suggest no-print" onclick="editRemedialPlan('${x.s.id}','${x.k}')">${esc(x.s.name)} · ${esc(SUBJECTS[x.k].name)} · ${pct(x.s.avg)}</button>`).join('')||'<p>لا توجد حالات جديدة حاليًا.</p>'}</div>
 <div class="ach-process"><span>قياس قبلي</span><b>←</b><span>تشخيص المهارة</span><b>←</b><span>خطة علاجية</span><b>←</b><span>اختبار بعدي</span><b>←</b><span>قياس التحسن</span></div>${footerHtml('الخطط العلاجية')}`;
}
function highPage(){
 const rows=[];for(const k of Object.keys(SUBJECTS)){const p=state.profiles.find(x=>x.subject_key===k&&x.grade_level===state.grade);if(!p)continue;for(const s of statsFor(p,'general').students.filter(x=>x.level==='high'))rows.push({k,s,plan:planFor(s.id,k,'enrichment_plan')})}
 return `${head('خطة الطلاب المتفوقين','رصد التفوق وربطه بخطة إثرائية ومتابعة')}
 ${gradeChips()}<div class="ach-block"><div class="ach-table-wrap"><table><thead><tr><th>الطالب</th><th>المادة</th><th>المتوسط</th><th>مظاهر التفوق</th><th>الخطة الإثرائية</th><th>المتابعة</th></tr></thead><tbody>
 ${rows.map(x=>`<tr><td>${esc(x.s.name)}</td><td>${esc(SUBJECTS[x.k].name)}</td><td>${pct(x.s.avg)}</td><td>${esc(x.plan?.content?.strengths||'أداء تحصيلي مرتفع ومستمر')}</td><td>${x.plan?'محفوظة':'لم تُنشأ'}<br><button class="btn no-print" onclick="editEnrichmentPlan('${x.s.id}','${x.k}')">${x.plan?'تعديل':'إنشاء'}</button></td><td>${esc(x.plan?.content?.follow_up||'—')}</td></tr>`).join('')||'<tr><td colspan="6">لا توجد حالات مرتفعة مسجلة بعد.</td></tr>'}
 </tbody></table></div></div>${footerHtml('المتفوقون')}`;
}
function followupPage(){
 const gradeIds=new Set(state.classes.filter(c=>c.grade===state.grade).map(c=>c.id)),roster=state.students.filter(s=>gradeIds.has(s.class_id));
 return `${head('متابعة الطلاب','ملف مركزي يربط النتائج والمهارات والخطط وقياس الأثر')}
 ${gradeChips()}<div class="ach-block"><div class="ach-table-wrap"><table><thead><tr><th>الطالب</th><th>المواد المقاسة</th><th>آخر قياس</th><th>خطط علاجية</th><th>خطط إثرائية</th><th class="no-print">الملف</th></tr></thead><tbody>
 ${roster.map(s=>{const subjectStats=Object.keys(SUBJECTS).map(k=>{const p=state.profiles.find(x=>x.subject_key===k&&x.grade_level===state.grade);return p?statsFor(p,'general').students.find(x=>x.id===s.id):null}).filter(Boolean),last=subjectStats.flatMap(x=>x.exams).sort((a,b)=>new Date(b.date)-new Date(a.date))[0],rp=U.blocks.filter(b=>b.block_type==='remedial_plan'&&b.content?.student_id===s.id).length,ep=U.blocks.filter(b=>b.block_type==='enrichment_plan'&&b.content?.student_id===s.id).length;return `<tr><td>${esc(s.full_name)}</td><td>${subjectStats.length}</td><td>${last?`${esc(last.label)} · ${pct(last.percent)}`:'—'}</td><td>${rp}</td><td>${ep}</td><td class="no-print"><button class="btn" onclick="openStudent('${s.id}')">فتح الملف</button></td></tr>`}).join('')||'<tr><td colspan="6">لا يوجد طلاب في هذا الصف.</td></tr>'}
 </tbody></table></div></div>${footerHtml('متابعة الطلاب')}`;
}
function evidencePage(){
 return `${head('الشواهد والتوثيق','كل شاهد مرتبط بموضعه ويمكن إدراجه في ملف PDF النهائي')}
 <div class="ach-toolbar no-print"><button class="btn primary" onclick="addAchievementEvidence('general')">+ إضافة شاهد</button></div>
 <div class="ach-block"><div class="ach-evidence-grid">${U.evidence.map(e=>`<article class="ach-evidence-card"><b>${esc(e.title)}</b><small>${esc(e.evidence_type||'ملف')} · ${when(e.created_at)}</small><p>${esc(e.note||'')}</p><div>${e.include_in_pdf?'<span class="status high">ضمن PDF</span>':'<span class="status neutral">خارج PDF</span>'}</div><button class="btn no-print" onclick="openAchievementEvidence('${e.id}')">فتح</button></article>`).join('')||'<p>لا توجد شواهد مرفوعة بعد.</p>'}</div></div>${footerHtml('الشواهد والتوثيق')}`;
}
function printPage(){
 return `${head('الطباعة والاعتماد')}<div class="ach-print-card"><h3>إصدار ملف التحصيل كاملًا</h3><p>يطبع النظام جميع صفحات السجل الرسمية مع التحليلات والخطط والاجتماعات والشواهد في تسلسل واحد، بدل طباعة الصفحة المفتوحة فقط.</p><button class="btn primary no-print" onclick="printFullAchievement()">إصدار الملف الكامل PDF</button></div>${footerHtml('الطباعة والاعتماد')}`;
}
function addEvidenceIndex(){
 const list=document.querySelector('#achievementArea .ach-index-list');if(!list||list.querySelector('[data-ach-evidence]'))return;
 const btn=document.createElement('button');btn.dataset.achEvidence='1';btn.className=state.achievementOfficialPage==='evidence-plus'?'active':'';btn.innerHTML='<i>+</i><span>الشواهد والتوثيق</span>';btn.onclick=()=>{state.achievementOfficialPage='evidence-plus';renderAchievement()};list.appendChild(btn);
}
function replacePage(){
 const key=state.achievementOfficialPage||'cover',p=paper();if(!p)return;
 let html=null;
 if(key==='periodic'||key==='final')html=analysisPage(key);
 if(key==='nafes-results')html=nafesPage(false);
 if(key==='nafes-plan')html=nafesPage(true);
 if(key==='meetings')html=meetingsPage();
 if(key==='delayed')html=delayedPage();
 if(key==='remedial')html=remedialPage();
 if(key==='high')html=highPage();
 if(key==='followup')html=followupPage();
 if(key==='evidence-plus')html=evidencePage();
 if(key==='print')html=printPage();
 if(html!=null)p.innerHTML=html;
 addEvidenceIndex();
}
renderAchievement=function(){baseRender();replacePage();if(!U.loaded&&!U.loading)loadExtras().then(()=>{if(state.section==='achievement')renderAchievement()})};
window.renderAchievement=renderAchievement;

window.editAchievementThresholds=function(){
 const p=state.profiles.find(x=>x.subject_key===state.subject&&x.grade_level===state.grade);if(!p)return toast('تعذر تحديد المادة والمرحلة',true);
 modal('حدود تصنيف التحصيل',`<form id="achThresholdForm" class="formgrid"><div class="field"><label>بداية المستوى المرتفع</label><input name="high" type="number" min="1" max="100" value="${n(p.high_threshold)??80}" required></div><div class="field"><label>بداية المستوى المتوسط</label><input name="mid" type="number" min="1" max="99" value="${n(p.medium_threshold)??60}" required></div><div class="soft-card full">أقل من حد المتوسط يصنف متدنيًا. هذه الحدود خاصة بـ ${esc(SUBJECTS[state.subject].name)} في ${esc(state.grade)}.</div><button class="btn primary full">حفظ</button></form>`,()=>{$('achThresholdForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),hi=+f.get('high'),mid=+f.get('mid');if(mid>=hi)return toast('حد المتوسط يجب أن يكون أقل من حد المرتفع',true);const r=await req('/rest/v1/achievement_subject_profiles?id=eq.'+p.id,'PATCH',{high_threshold:hi,medium_threshold:mid,updated_at:new Date().toISOString()},true);if(!r.ok)return toast(r.msg,true);p.high_threshold=hi;p.medium_threshold=mid;closeModal();renderAchievement();toast('تم حفظ حدود التصنيف')}})
};
async function saveConfigBlock(type,content,sectionKey='nafes'){
 const old=configBlock(type),sid=sectionId(sectionKey);if(!sid)return toast('تعذر تحديد قسم الحفظ',true);
 const payload={section_id:sid,block_type:type,title:type==='nafes_thresholds'?'حدود تصنيف نافس':type,content,sort_order:99,is_visible:true};
 const r=old?await req('/rest/v1/achievement_book_blocks?id=eq.'+old.id,'PATCH',{content,updated_at:new Date().toISOString()},true):await req('/rest/v1/achievement_book_blocks','POST',payload,true);
 if(!r.ok)return toast(r.msg,true);await loadExtras(true);return true;
}
window.editNafesThresholds=function(){
 const cfg=configBlock('nafes_thresholds')?.content||{};
 modal('إعداد تصنيف نافس',`<form id="nafesThresholdForm" class="formgrid"><div class="field full"><label>الحد الفاصل: أقل منه = منخفض جدًا</label><input name="vl" type="number" min="1" max="59" value="${cfg.very_low_threshold??''}" placeholder="اكتب الحد المعتمد في المدرسة" required></div><div class="soft-card full">الملف الأصلي يذكر أربع فئات لكنه لا يحدد رقم هذا الحد؛ لذلك يجب أن تضع هنا الرقم المعتمد لديكم بدل أن يخترعه النظام.</div><button class="btn primary full">حفظ</button></form>`,()=>{$('nafesThresholdForm').onsubmit=async e=>{e.preventDefault();const vl=+new FormData(e.target).get('vl'),mins=['arabic','math','science'].map(k=>state.profiles.find(p=>p.subject_key===k&&p.grade_level==='الثالث المتوسط')).filter(Boolean).map(p=>n(p.medium_threshold)??60),limit=Math.min(...mins);if(vl>=limit)return toast('حد منخفض جدًا يجب أن يكون أقل من حد المستوى المتوسط',true);if(await saveConfigBlock('nafes_thresholds',{very_low_threshold:vl})){closeModal();renderAchievement();toast('تم حفظ تصنيف نافس')}}})
};
window.editAchievementMeeting=function(id=''){
 const m=U.meetings.find(x=>x.id===id)||{};
 modal(id?'تعديل اجتماع':'اجتماع جديد',`<form id="achMeetingForm" class="formgrid"><div class="field"><label>رقم الاجتماع</label><input name="meeting_no" type="number" min="1" value="${m.meeting_no??U.meetings.length+1}"></div><div class="field"><label>التاريخ</label><input name="meeting_date" type="date" value="${m.meeting_date||''}"></div><div class="field"><label>الفئة المستهدفة</label><input name="target_group" value="${esc(m.target_group||'')}"></div><div class="field"><label>المكان</label><input name="venue" value="${esc(m.venue||'')}"></div><div class="field full"><label>موضوع الاجتماع</label><input name="topic" value="${esc(m.topic||'متابعة التحصيل الدراسي ونتائج الاختبارات والخطط العلاجية')}"></div><div class="field full"><label>الحضور — اسم في كل سطر</label><textarea name="attendees">${esc((m.attendees||[]).join('\n'))}</textarea></div><div class="field full"><label>جدول الأعمال — بند في كل سطر</label><textarea name="agenda">${esc((m.agenda||[]).join('\n'))}</textarea></div><div class="field full"><label>ما تم خلال الاجتماع / المناقشة</label><textarea name="discussion">${esc(m.discussion||'')}</textarea></div><div class="field full"><label>القرارات والتوصيات — قرار في كل سطر</label><textarea name="decisions">${esc((m.decisions||[]).join('\n'))}</textarea></div><div class="field full"><label>المتابعة ومسؤول التنفيذ — بند في كل سطر</label><textarea name="follow_up">${esc((m.follow_up||[]).join('\n'))}</textarea></div><label class="field full ach-check"><input type="checkbox" name="include_in_pdf" ${m.include_in_pdf!==false?'checked':''}> إدراج الاجتماع في PDF النهائي</label><button class="btn primary full">حفظ الاجتماع</button></form>`,()=>{$('achMeetingForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),payload={book_id:B().id,meeting_no:+f.get('meeting_no')||null,meeting_date:f.get('meeting_date')||null,target_group:f.get('target_group')||null,topic:f.get('topic')||null,venue:f.get('venue')||null,attendees:lines(f.get('attendees')),agenda:lines(f.get('agenda')),discussion:f.get('discussion')||null,decisions:lines(f.get('decisions')),follow_up:lines(f.get('follow_up')),signatures:m.signatures||[],include_in_pdf:f.get('include_in_pdf')==='on',is_visible:true,sort_order:+f.get('meeting_no')||U.meetings.length+1};const r=id?await req('/rest/v1/achievement_meetings?id=eq.'+id,'PATCH',{...payload,updated_at:new Date().toISOString()},true):await req('/rest/v1/achievement_meetings','POST',payload,true);if(!r.ok)return toast(r.msg,true);closeModal();await loadExtras(true);renderAchievement();toast('تم حفظ الاجتماع')}})
};
function weakForStudent(studentId,subjectKey){
 const p=state.profiles.find(x=>x.subject_key===subjectKey&&x.grade_level===state.grade);return p?uniq(statsFor(p,'general').students.find(x=>x.id===studentId)?.weak.map(r=>r.skill_name||r.objective_title)||[]):[];
}
async function savePlan(type,studentId,subjectKey,data,old){
 const sid=sectionId('improvement');if(!sid)return toast('تعذر تحديد قسم خطط التحسين',true);
 const s=state.students.find(x=>x.id===studentId),payload={section_id:sid,block_type:type,title:`${s?.full_name||'طالب'} — ${SUBJECTS[subjectKey]?.name||subjectKey}`,content:{...data,student_id:studentId,subject_key:subjectKey,grade:state.grade},sort_order:100+U.blocks.filter(x=>x.block_type===type).length,is_visible:true};
 const r=old?await req('/rest/v1/achievement_book_blocks?id=eq.'+old.id,'PATCH',{title:payload.title,content:payload.content,updated_at:new Date().toISOString()},true):await req('/rest/v1/achievement_book_blocks','POST',payload,true);
 if(!r.ok)return toast(r.msg,true);await loadExtras(true);return true;
}
window.editRemedialPlan=function(studentId,subjectKey){
 const old=planFor(studentId,subjectKey),c=old?.content||{},s=state.students.find(x=>x.id===studentId),weak=weakForStudent(studentId,subjectKey);
 modal('الخطة العلاجية',`<form id="remedialPlanForm" class="formgrid"><div class="soft-card full"><b>${esc(s?.full_name||'طالب')}</b> · ${esc(state.grade)} · ${esc(SUBJECTS[subjectKey]?.name||subjectKey)}</div><div class="field full"><label>مظاهر الضعف</label><textarea name="weaknesses">${esc((c.weaknesses||weak).join('\n'))}</textarea></div><div class="field full"><label>أسباب الضعف</label><textarea name="causes">${esc(c.causes||'')}</textarea></div><div class="field full"><label>الأنشطة العلاجية</label><textarea name="activities">${esc(c.activities||'')}</textarea></div><div class="field"><label>القياس القبلي ٪</label><input name="pre" type="number" min="0" max="100" value="${c.pre_percent??''}"></div><div class="field"><label>القياس البعدي ٪</label><input name="post" type="number" min="0" max="100" value="${c.post_percent??''}"></div><div class="field full"><label>فترات المتابعة</label><input name="follow" value="${esc(c.follow_up||'')}"></div><div class="field full"><label>الملاحظات</label><textarea name="notes">${esc(c.notes||'')}</textarea></div><button class="btn primary full">حفظ الخطة</button></form>`,()=>{$('remedialPlanForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),data={weaknesses:lines(f.get('weaknesses')),causes:f.get('causes')||'',activities:f.get('activities')||'',pre_percent:f.get('pre')===''?null:+f.get('pre'),post_percent:f.get('post')===''?null:+f.get('post'),follow_up:f.get('follow')||'',notes:f.get('notes')||'',updated_at:new Date().toISOString()};if(await savePlan('remedial_plan',studentId,subjectKey,data,old)){closeModal();renderAchievement();toast('تم حفظ الخطة العلاجية')}}})
};
window.editEnrichmentPlan=function(studentId,subjectKey){
 const old=planFor(studentId,subjectKey,'enrichment_plan'),c=old?.content||{},s=state.students.find(x=>x.id===studentId);
 modal('الخطة الإثرائية',`<form id="enrichPlanForm" class="formgrid"><div class="soft-card full"><b>${esc(s?.full_name||'طالب')}</b> · ${esc(SUBJECTS[subjectKey]?.name||subjectKey)}</div><div class="field full"><label>مظاهر التفوق</label><textarea name="strengths">${esc(c.strengths||'أداء تحصيلي مرتفع ومستمر')}</textarea></div><div class="field full"><label>الأنشطة الإثرائية</label><textarea name="activities">${esc(c.activities||'')}</textarea></div><div class="field full"><label>فترات المتابعة</label><input name="follow" value="${esc(c.follow_up||'')}"></div><div class="field full"><label>الملاحظات</label><textarea name="notes">${esc(c.notes||'')}</textarea></div><button class="btn primary full">حفظ الخطة الإثرائية</button></form>`,()=>{$('enrichPlanForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),data={strengths:f.get('strengths')||'',activities:f.get('activities')||'',follow_up:f.get('follow')||'',notes:f.get('notes')||'',updated_at:new Date().toISOString()};if(await savePlan('enrichment_plan',studentId,subjectKey,data,old)){closeModal();renderAchievement();toast('تم حفظ الخطة الإثرائية')}}})
};
window.addAchievementEvidence=function(scope='general',meetingId=''){
 modal('إضافة شاهد',`<form id="achEvidenceForm" class="formgrid"><div class="field full"><label>عنوان الشاهد</label><input name="title" required></div><div class="field"><label>النوع</label><select name="type"><option>تقرير</option><option>صورة</option><option>PDF</option><option>Excel</option><option>Word</option><option>ورقة عمل</option><option>نتيجة اختبار</option><option>خطة علاجية</option><option>محضر اجتماع</option></select></div><div class="field"><label>الملف</label><input name="file" type="file" required></div><div class="field full"><label>ملاحظة</label><textarea name="note"></textarea></div><label class="field full ach-check"><input type="checkbox" name="pdf" checked> إدراج الشاهد في PDF النهائي</label><button class="btn primary full">رفع الشاهد</button></form>`,()=>{$('achEvidenceForm').onsubmit=async e=>{e.preventDefault();const f=e.target,file=f.elements.file.files[0];if(!file)return toast('اختر ملفًا',true);if(file.size>50*1024*1024)return toast('الحد الأقصى 50 ميجابايت',true);const safe=file.name.replace(/[^\w.\-\u0600-\u06FF]/g,'_'),path=`${state.user.id}/achievement/${B().id}/${Date.now()}-${safe}`,btn=f.querySelector('button');btn.disabled=true;btn.textContent='جارٍ رفع الشاهد...';try{const up=await fetch(`${SB_URL}/storage/v1/object/teacher-files/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+state.token,'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file});if(!up.ok)throw new Error('تعذر رفع الملف');const fd=new FormData(f),payload={book_id:B().id,subject_profile_id:state.profiles.find(p=>p.subject_key===state.subject&&p.grade_level===state.grade)?.id||null,meeting_id:meetingId||null,title:fd.get('title'),evidence_type:fd.get('type'),storage_path:path,original_file_name:file.name,mime_type:file.type||null,file_size:file.size,linked_scope:{page:state.achievementOfficialPage||scope,scope,grade:state.grade,subject_key:state.subject},visibility:'private',include_in_pdf:fd.get('pdf')==='on',note:fd.get('note')||null};const r=await req('/rest/v1/achievement_evidence','POST',payload,true);if(!r.ok)throw new Error(r.msg);closeModal();await loadExtras(true);renderAchievement();toast('تم رفع الشاهد وربطه بالتحصيل')}catch(err){toast(err.message||'تعذر رفع الشاهد',true);btn.disabled=false;btn.textContent='رفع الشاهد'}}})
};
window.openAchievementEvidence=async function(id){
 const e=U.evidence.find(x=>x.id===id);if(!e)return;const r=await fetch(`${SB_URL}/storage/v1/object/sign/teacher-files/${e.storage_path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:{apikey:SB_KEY,Authorization:'Bearer '+state.token,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600})});const d=await r.json().catch(()=>({}));if(!r.ok)return toast('تعذر فتح الشاهد',true);const u=d.signedURL||d.signedUrl;if(u)window.open(u.startsWith('http')?u:SB_URL+'/storage/v1'+u,'_blank');
};
const PRINT_KEYS=['cover','intro','purpose','vision','help','committee','workflow','teachers','meetings','schedules','periodic','final','nafes-results','nafes-plan','notices','followup','delayed','previous','swot','remedial','high','gifted','honor','subjects'];
window.printFullAchievement=async function(){
 await loadExtras();const old=state.achievementOfficialPage||'cover',host=document.createElement('div');host.id='achievementFullPrint';host.className='ach-full-print';
 for(const key of PRINT_KEYS){state.achievementOfficialPage=key;baseRender();replacePage();const p=paper();if(p){const sec=document.createElement('section');sec.className='ach-print-page';sec.innerHTML=p.innerHTML;host.appendChild(sec)}}
 const ev=document.createElement('section');ev.className='ach-print-page';ev.innerHTML=evidencePage();host.appendChild(ev);document.body.appendChild(host);state.achievementOfficialPage=old;renderAchievement();
 const cleanup=()=>{host.remove();window.removeEventListener('afterprint',cleanup)};window.addEventListener('afterprint',cleanup);setTimeout(()=>window.print(),150);
};
document.addEventListener('click',e=>{if(e.target.closest('[data-section="achievement"]'))loadExtras()});
loadExtras().then(()=>{if(state.section==='achievement')renderAchievement()});
})();