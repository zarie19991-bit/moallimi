(()=>{
const LPREF={loaded:false,loading:null,surveys:[],results:[]};
const STYLE={
 visual:{label:'بصري / منظم',short:'بصري',advice:'استفد من المخططات والنماذج المنظمة، ثم انتقل دائمًا إلى الاسترجاع والتطبيق حتى لا يبقى التعلم مجرد مشاهدة.'},
 auditory:{label:'سمعي / لفظي',short:'سمعي',advice:'استفد من الشرح والحوار وإعادة الصياغة بصوتك، ثم ثبّت الفهم بأسئلة مكتوبة وتطبيقات فعلية.'},
 kinesthetic:{label:'تطبيقي / عملي',short:'تطبيقي',advice:'ابدأ بأمثلة ومهام قصيرة وتعلم من المحاولة والتغذية الراجعة، مع الرجوع إلى الشرح والتمثيل المنظم عند الحاجة.'},
 mixed:{label:'مرن / متوازن',short:'مرن',advice:'تفضيلاتك متقاربة؛ غيّر طريقة التعلم بحسب المهمة: تنظيم بصري، شرح لفظي، ثم تطبيق واسترجاع.'}
};
const styleLabel=k=>STYLE[k]?.label||'غير محدد';
const styleAdvice=k=>STYLE[k]?.advice||STYLE.mixed.advice;
const currentClass=()=>state.classes.find(c=>c.id===state.classId)||null;
const classSurveys=(cid=state.classId)=>LPREF.surveys.filter(s=>s.class_id===cid).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
const surveyResults=sid=>LPREF.results.filter(r=>r.survey_id===sid).sort((a,b)=>new Date(b.submitted_at)-new Date(a.submitted_at));
const latestStudentResult=id=>LPREF.results.filter(r=>r.student_id===id).sort((a,b)=>new Date(b.submitted_at)-new Date(a.submitted_at))[0]||null;
const avg=(rows,key)=>rows.length?rows.reduce((s,r)=>s+(Number(r[key])||0),0)/rows.length:0;
const pct0=v=>`${Math.round(Number(v)||0)}٪`;
const linkFor=s=>`${location.origin}${location.pathname.replace(/[^/]*$/,'')}learning.html?code=${encodeURIComponent(s.survey_code)}`;

async function loadPrefs(force=false){
 if(LPREF.loading)return LPREF.loading;
 if(LPREF.loaded&&!force)return LPREF;
 LPREF.loading=(async()=>{
  const [surveys,results]=await Promise.all([
   list('learning_style_surveys','&order=created_at.desc'),
   list('learning_style_results','&order=submitted_at.desc')
  ]);
  LPREF.surveys=surveys;LPREF.results=results;LPREF.loaded=true;LPREF.loading=null;
  state.learningStyleSurveys=surveys;state.learningStyleResults=results;
  return LPREF;
 })().catch(e=>{LPREF.loading=null;throw e});
 return LPREF.loading;
}

function bars(rows){
 const data=[['visual','بصري / منظم'],['auditory','سمعي / لفظي'],['kinesthetic','تطبيقي / عملي']];
 return `<div class="ls-bars">${data.map(([k,l])=>{const v=avg(rows,k+'_score');return `<div class="ls-bar-row"><span>${l}</span><div class="ls-track"><i style="width:${Math.max(0,Math.min(100,v))}%"></i></div><b>${pct0(v)}</b></div>`}).join('')}</div>`;
}
function distribution(rows){
 const c={visual:0,auditory:0,kinesthetic:0,mixed:0};rows.forEach(r=>{if(c[r.dominant_style]!==undefined)c[r.dominant_style]++});return c;
}
function panelHtml(){
 const cls=currentClass();if(!cls)return '';
 const roster=classStudents(cls.id),surveys=classSurveys(cls.id),survey=surveys[0],rows=survey?surveyResults(survey.id):[],dist=distribution(rows);
 if(!survey)return `<section class="ls-panel"><div class="ls-panel-head"><div><h3>تفضيلات التعلم</h3><p>ملف سلوكي قصير يوضح ميل الطالب في مواقف دراسية حقيقية دون وضعه في قالب ثابت.</p></div><button class="btn primary" onclick="createLearningSurvey()">إنشاء استبانة للفصل</button></div><div class="ls-note">الاستبانة الجديدة تتكون من 24 موقفًا دراسيًا مركّزًا. لا تسأل الطالب مباشرة «هل أنت بصري أو سمعي؟»، بل تجعله يختار ما يفعله في مواقف تعلم فعلية، ثم تعرض النتيجة كتفضيلات نسبية.</div></section>`;
 const answered=new Set(rows.map(r=>r.student_id).filter(Boolean)).size;
 return `<section class="ls-panel"><div class="ls-panel-head"><div><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><h3>تفضيلات التعلم</h3><span class="ls-badge ${survey.is_open?'open':'closed'}">${survey.is_open?'مفتوحة للطلاب':'مغلقة'}</span></div><p>${esc(cls.name)} · ${answered} من ${roster.length} طالبًا أكملوا الملف.</p></div><button class="btn" onclick="openLearningManager()">إدارة ونتائج</button></div><div class="ls-summary"><div class="ls-metric"><span>بصري / منظم</span><b>${dist.visual}</b><small>تفضيل أوضح</small></div><div class="ls-metric"><span>سمعي / لفظي</span><b>${dist.auditory}</b><small>تفضيل أوضح</small></div><div class="ls-metric"><span>تطبيقي / عملي</span><b>${dist.kinesthetic}</b><small>تفضيل أوضح</small></div><div class="ls-metric"><span>مرن / متوازن</span><b>${dist.mixed}</b><small>لا يفرض نمطًا واحدًا</small></div></div>${rows.length?bars(rows):'<div class="ls-empty" style="margin-top:14px">لم تصل نتائج بعد. أرسل الكود أو QR للطلاب.</div>'}<div class="ls-actions"><button class="btn primary" onclick="shareLearningSurvey('${survey.id}')">QR / كود الاستبانة</button><button class="btn" onclick="toggleLearningSurvey('${survey.id}')">${survey.is_open?'إغلاق الاستبانة':'فتح الاستبانة'}</button><button class="btn" onclick="refreshLearningResults()">تحديث النتائج</button></div><div class="ls-note">الاستخدام الأفضل: معرفة تفضيلات الفصل وتنويع العرض والممارسة، لا تقسيم الطلاب إلى مجموعات ثابتة ولا تقليل توقعات التعلم عن أي طالب.</div></section>`;
}
async function attachPanel(){
 const area=document.getElementById('studentsArea');if(!area||!state.user)return;
 try{await loadPrefs();if(!document.getElementById('learningPreferencesPanel')){const wrap=document.createElement('div');wrap.id='learningPreferencesPanel';wrap.innerHTML=panelHtml();area.appendChild(wrap)}else document.getElementById('learningPreferencesPanel').innerHTML=panelHtml()}catch(e){console.warn('learning_preferences_load_failed',e)}
}

const baseRenderStudents=window.renderStudents;
if(typeof baseRenderStudents==='function')window.renderStudents=function(){baseRenderStudents();setTimeout(attachPanel,0)};

window.createLearningSurvey=async()=>{
 const cls=currentClass();if(!cls)return toast('اختر فصلًا أولًا',true);
 const existing=classSurveys(cls.id)[0];if(existing)return openLearningManager();
 let code='LP'+rand(6),r;
 for(let i=0;i<3;i++){
  r=await req('/rest/v1/learning_style_surveys','POST',{teacher_id:state.user.id,class_id:cls.id,title:`ملف تفضيلات التعلم — ${cls.name}`,survey_code:code,is_open:true,survey_type:'learning_style',questions:null,instructions:'اقرأ كل موقف واختر الخيار الأقرب لما تفعله عادة في الدراسة، وليس ما تعتقد أنه الإجابة المثالية.',require_roster:true,opens_at:null,closes_at:null},true);
  if(r.ok)break;code='LP'+rand(6);
 }
 if(!r?.ok)return toast(r?.msg||'تعذر إنشاء الاستبانة',true);
 await loadPrefs(true);renderStudents();toast('تم إنشاء استبانة تفضيلات التعلم');
 const s=classSurveys(cls.id)[0];if(s)shareLearningSurvey(s.id);
};

window.refreshLearningResults=async()=>{await loadPrefs(true);renderStudents();toast('تم تحديث نتائج تفضيلات التعلم')};
window.toggleLearningSurvey=async id=>{
 const s=LPREF.surveys.find(x=>x.id===id);if(!s)return;
 const r=await req('/rest/v1/learning_style_surveys?id=eq.'+encodeURIComponent(id),'PATCH',{is_open:!s.is_open},false);
 if(!r.ok)return toast(r.msg,true);await loadPrefs(true);renderStudents();toast(s.is_open?'تم إغلاق الاستبانة':'تم فتح الاستبانة');
};
window.updateLearningSchedule=async id=>{
 const f=document.getElementById('learningScheduleForm');if(!f)return;const d=Object.fromEntries(new FormData(f));
 const payload={opens_at:d.opens_at?new Date(d.opens_at).toISOString():null,closes_at:d.closes_at?new Date(d.closes_at).toISOString():null};
 const r=await req('/rest/v1/learning_style_surveys?id=eq.'+encodeURIComponent(id),'PATCH',payload,false);if(!r.ok)return toast(r.msg,true);
 await loadPrefs(true);openLearningManager();toast('تم حفظ وقت فتح وإغلاق الاستبانة');
};

window.shareLearningSurvey=id=>{
 const s=LPREF.surveys.find(x=>x.id===id);if(!s)return;const url=linkFor(s);
 modal('إرسال استبانة تفضيلات التعلم',`<div class="ls-qr-wrap"><span class="status high">كود موحد للفصل</span><h2 style="margin:10px 0 4px;color:#17324d">${esc(s.survey_code)}</h2><p style="color:#71808a;font-size:11px">كل طالب يدخل باسمه المسجل في كشف الفصل وتُربط النتيجة بملفه.</p><div id="learningQr"></div><div class="ls-qr-link">${esc(url)}</div><div class="actions" style="justify-content:center;margin-top:14px"><button class="btn primary" onclick="navigator.clipboard?.writeText('${url.replace(/'/g,"\\'")}').then(()=>toast('تم نسخ الرابط'))">نسخ الرابط</button><button class="btn" onclick="closeModal()">إغلاق</button></div></div>`,()=>{const el=document.getElementById('learningQr');if(el&&window.QRCode)new QRCode(el,{text:url,width:210,height:210})});
};

function resultRows(survey){
 const roster=classStudents(survey.class_id),rows=surveyResults(survey.id),map=new Map(rows.filter(r=>r.student_id).map(r=>[r.student_id,r]));
 return roster.map((st,i)=>{const r=map.get(st.id);return `<tr><td>${i+1}</td><td><button class="ach-student-link" onclick="closeModal();openStudent('${st.id}')">${esc(st.full_name)}</button></td>${r?`<td class="style-main">${esc(styleLabel(r.dominant_style))}</td><td>${pct0(r.visual_score)}</td><td>${pct0(r.auditory_score)}</td><td>${pct0(r.kinesthetic_score)}</td><td>${pct0(r.confidence_percentage)}</td>`:'<td colspan="5"><span class="status neutral">لم يكمل الاستبانة</span></td>'}</tr>`}).join('');
}
window.openLearningManager=async()=>{
 try{await loadPrefs(true)}catch(e){return toast('تعذر تحميل نتائج الاستبانة',true)}
 const cls=currentClass();if(!cls)return toast('اختر فصلًا أولًا',true);const surveys=classSurveys(cls.id),s=surveys[0];
 if(!s){modal('تفضيلات التعلم',`<div class="ls-empty">لا توجد استبانة لهذا الفصل بعد.</div><button class="btn primary wide" style="margin-top:12px" onclick="closeModal();createLearningSurvey()">إنشاء الاستبانة</button>`);return}
 const rows=surveyResults(s.id),dist=distribution(rows),openVal=s.opens_at?new Date(new Date(s.opens_at).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'',closeVal=s.closes_at?new Date(new Date(s.closes_at).getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):'';
 modal('تفضيلات التعلم — '+cls.name,`<div class="ls-manager"><div class="ls-survey-card"><div class="ls-survey-top"><div><h4>${esc(s.title)}</h4><p>24 موقفًا دراسيًا · ملف تفضيلات نسبي لا تصنيف ثابت</p></div><div class="ls-code">${esc(s.survey_code)}</div></div><div class="ls-actions"><button class="btn primary" onclick="shareLearningSurvey('${s.id}')">QR / كود</button><button class="btn" onclick="toggleLearningSurvey('${s.id}');closeModal()">${s.is_open?'إغلاق الآن':'فتح الآن'}</button></div></div><form id="learningScheduleForm" class="ls-survey-card"><h4 style="margin:0 0 10px;color:#17324d">الفتح والإغلاق المجدول</h4><div class="ls-threshold"><div class="field"><label>يفتح في</label><input name="opens_at" type="datetime-local" value="${openVal}"></div><div class="field"><label>يغلق في</label><input name="closes_at" type="datetime-local" value="${closeVal}"></div><button type="button" class="btn" onclick="updateLearningSchedule('${s.id}')">حفظ الوقت</button></div></form><div class="ls-survey-card"><div class="ls-summary"><div class="ls-metric"><span>بصري / منظم</span><b>${dist.visual}</b></div><div class="ls-metric"><span>سمعي / لفظي</span><b>${dist.auditory}</b></div><div class="ls-metric"><span>تطبيقي / عملي</span><b>${dist.kinesthetic}</b></div><div class="ls-metric"><span>مرن / متوازن</span><b>${dist.mixed}</b></div></div>${rows.length?bars(rows):''}</div><div class="ach-table-wrap ls-result-table"><table><thead><tr><th>م</th><th>الطالب</th><th>الملف الحالي</th><th>بصري</th><th>سمعي</th><th>تطبيقي</th><th>وضوح النتيجة</th></tr></thead><tbody>${resultRows(s)}</tbody></table></div><div class="ls-note">«وضوح النتيجة» يعبر عن مقدار الفرق بين التفضيل الأول والثاني فقط؛ لا يعني دقة تشخيص نفسي، ولا ينبغي استخدامه لحصر الطالب في طريقة تدريس واحدة.</div></div>`);
};

function profileHtml(id){
 const r=latestStudentResult(id);if(!r)return `<section class="ls-profile"><div class="ls-profile-head"><div><h3>تفضيلات التعلم</h3><p>لم يكمل الطالب الاستبانة حتى الآن.</p></div><span class="ls-badge mixed">غير مقاس</span></div></section>`;
 return `<section class="ls-profile"><div class="ls-profile-head"><div><h3>تفضيلات التعلم الحالية</h3><p>آخر قياس ${new Date(r.submitted_at).toLocaleDateString('ar-SA')}</p></div><span class="ls-badge open">${esc(styleLabel(r.dominant_style))}</span></div><div class="ls-profile-grid"><div class="ls-profile-score"><span>بصري / منظم</span><b>${pct0(r.visual_score)}</b></div><div class="ls-profile-score"><span>سمعي / لفظي</span><b>${pct0(r.auditory_score)}</b></div><div class="ls-profile-score"><span>تطبيقي / عملي</span><b>${pct0(r.kinesthetic_score)}</b></div></div><div class="ls-advice"><b>استخدام تربوي مقترح:</b> ${esc(styleAdvice(r.dominant_style))}<br>لا تُستخدم النتيجة للحكم على قدرة الطالب أو منعه من طرق تعلم أخرى.</div></section>`;
}
async function appendStudentProfile(id){
 try{await loadPrefs();const drawer=document.querySelector('#drawerRoot .drawer');if(!drawer||drawer.querySelector('.ls-profile'))return;const hero=drawer.querySelector('.student-hero');if(hero)hero.insertAdjacentHTML('afterend',profileHtml(id));else drawer.insertAdjacentHTML('beforeend',profileHtml(id))}catch(e){}
}
const baseOpenStudent=window.openStudent;
if(typeof baseOpenStudent==='function')window.openStudent=function(id){baseOpenStudent(id);setTimeout(()=>appendStudentProfile(id),0)};

// If the students page is already visible when this script arrives, attach the panel.
setTimeout(()=>{if(state?.section==='students')attachPanel()},800);
})();