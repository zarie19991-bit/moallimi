(()=>{
const GROUPS=[
 {title:'١ · التعريف والتنظيم',desc:'هوية الملف واللجنة وخطة العمل والاجتماعات',items:['الغلاف','المقدمة','الهدف من السجل','الرؤية والرسالة','خطة المساعدة','تشكيل لجنة التحصيل','مراحل عمل لجنة التحصيل','تصنيف المعلمين','اجتماعات اللجنة','جداول الاختبارات']},
 {title:'٢ · القياس والتحليل',desc:'خط الأساس والمواد والنتائج والفجوات',items:['تحليل نتائج العام الماضي','المواد الأربع والتحليل الحي','تحليل نتائج الاختبارات الفترية','تحليل نتائج الاختبارات النهائية','نقاط القوة والضعف']},
 {title:'٣ · نافس',desc:'تحليل القياس الوطني وخطة المعالجة',items:['تحليل نتائج اختبارات نافس','إجراءات خطة معالجة نتائج نافس']},
 {title:'٤ · المتابعة والتدخل',desc:'الطلاب والخطط العلاجية والإثرائية',items:['متابعة الطلاب','خطة الطلاب المتأخرين','الخطط العلاجية','خطة الطلاب المتفوقين','الطلاب الموهوبون','تكريم الطلاب','الإشعارات']},
 {title:'٥ · التوثيق والاعتماد',desc:'الشواهد والتوصيات والإصدار النهائي',items:['الشواهد والتوثيق','التوصيات والاعتماد','الطباعة والاعتماد']}
];
let approvalLoaded=false,approvalLoading=null,approvalBlocks=[];
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
function matches(label,part){return norm(label).includes(norm(part))}
async function loadApproval(){
 if(approvalLoaded)return approvalBlocks;if(approvalLoading)return approvalLoading;
 const bookId=state.books?.[0]?.id;if(!bookId)return[];
 approvalLoading=req('/rest/v1/achievement_book_sections?select=id&book_id=eq.'+bookId+'&section_key=eq.approval&limit=1').then(async s=>{
  const id=s.ok?s.data?.[0]?.id:null;if(!id)return[];
  const b=await req('/rest/v1/achievement_book_blocks?select=id,block_type,title,content,sort_order&section_id=eq.'+id+'&order=sort_order.asc');
  approvalBlocks=b.ok?(b.data||[]):[];approvalLoaded=true;approvalLoading=null;return approvalBlocks;
 }).catch(()=>{approvalLoading=null;return[]});return approvalLoading;
}
function ensureApprovalButton(list){
 let btn=[...list.querySelectorAll('button')].find(b=>matches(b.textContent,'التوصيات والاعتماد'));
 if(!btn){btn=document.createElement('button');btn.innerHTML='<i>✓</i><span>التوصيات والاعتماد</span>';btn.onclick=()=>{state.achievementOfficialPage='approval-plus';renderAchievement()};list.appendChild(btn)}
 btn.classList.toggle('active',state.achievementOfficialPage==='approval-plus');return btn;
}
function groupAchievementIndex(){
 const list=document.querySelector('#achievementArea .ach-index-list');if(!list)return;
 ensureApprovalButton(list);const buttons=[...list.querySelectorAll('button')];list.innerHTML='';
 GROUPS.forEach(g=>{
  const box=document.createElement('section');box.className='ach-nav-group';
  const head=document.createElement('div');head.className='ach-nav-group-head';head.innerHTML=`<b>${g.title}</b><small>${g.desc}</small>`;box.appendChild(head);
  const body=document.createElement('div');body.className='ach-nav-group-body';
  g.items.forEach(item=>{const b=buttons.find(x=>matches(x.textContent,item));if(b)body.appendChild(b)});
  if(body.children.length){box.appendChild(body);list.appendChild(box)}
 });
 buttons.filter(b=>!b.closest('.ach-nav-group')).forEach(b=>list.appendChild(b));
}
function tableHtml(block){
 const c=block.content||{},headers=Array.isArray(c.headers)?c.headers:[],rows=Array.isArray(c.rows)?c.rows:[];
 return `<section class="ach-block"><h3>${esc(block.title||'جدول')}</h3>${c.note?`<p class="ach-approval-note">${esc(c.note)}</p>`:''}<div class="ach-table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${(Array.isArray(r)?r:[]).map(v=>`<td>${esc(v||'—')}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${Math.max(headers.length,1)}">لم تُسجل بيانات بعد.</td></tr>`}</tbody></table></div></section>`;
}
function signaturesHtml(block){const fields=block.content?.fields||[];return `<section class="ach-block"><h3>${esc(block.title||'اعتماد الملف')}</h3><div class="ach-sign-grid">${fields.map(f=>`<div><span>${esc(f.label||'')}</span><b>${esc(f.value||'________________')}</b></div>`).join('')}</div></section>`}
function renderApproval(){
 const paper=document.querySelector('#achievementArea .ach-paper');if(!paper)return;const book=state.books?.[0]||{};
 paper.innerHTML=`<div class="ach-paper-head"><div><span>المملكة العربية السعودية · وزارة التعليم · إدارة التعليم بمنطقة نجران</span><h2>التوصيات والاعتماد</h2><p>المرحلة الختامية: تحويل نتائج التحليل إلى قرارات قابلة للمتابعة ثم اعتماد الملف.</p></div><div class="ach-school"><b>${esc(book.school_name||'متوسطة ابن سينا')}</b><small>${esc(book.academic_year||'1448هـ')}</small></div></div><div class="ach-process"><span>نتيجة</span><b>←</b><span>فجوة</span><b>←</b><span>قرار تحسين</span><b>←</b><span>مسؤول وزمن</span><b>←</b><span>مؤشر نجاح</span><b>←</b><span>اعتماد</span></div>${approvalBlocks.map(b=>b.block_type==='signatures'?signaturesHtml(b):tableHtml(b)).join('')||'<div class="ach-block"><p>لا توجد نماذج اعتماد محفوظة.</p></div>'}<footer class="ach-page-footer"><span>التوصيات والاعتماد</span><b>ملف التحصيل الدراسي</b></footer>`;
 const nav=document.querySelector('#achievementArea .ach-page-nav');if(nav)nav.innerHTML='<button onclick="state.achievementOfficialPage=\'evidence-plus\';renderAchievement()">→ الشواهد</button><span>التوصيات والاعتماد</span><button onclick="state.achievementOfficialPage=\'print\';renderAchievement()">الطباعة ←</button>';
}
function enhanceAchievement(){
 groupAchievementIndex();
 if(state.achievementOfficialPage==='approval-plus'){
  if(!approvalLoaded&&!approvalLoading)loadApproval().then(()=>{if(state.section==='achievement'&&state.achievementOfficialPage==='approval-plus'){renderApproval();groupAchievementIndex()}});
  renderApproval();
 }
}
const prev=window.renderAchievement;if(typeof prev==='function')window.renderAchievement=function(){const r=prev.apply(this,arguments);enhanceAchievement();return r};
document.addEventListener('click',e=>{if(e.target.closest('[data-section="achievement"]'))setTimeout(enhanceAchievement,40)});
if(state?.section==='achievement')enhanceAchievement();
})();