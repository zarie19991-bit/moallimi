(()=>{
'use strict';
const $=id=>document.getElementById(id);
const subjectAction={
 'القراءة':'قراءة موجهة قصيرة، توضيح المعنى أو الفكرة من السياق، ثم تدريب تطبيقي متدرج.',
 'الرياضيات':'مثال محلول مختصر، تدريب موجه جماعي، ثم مسائل متدرجة فردية مع تغذية راجعة.',
 'العلوم':'مراجعة المفهوم برسم أو موقف علمي، ثم تطبيق قصير يطلب تفسير الإجابة وربطها بالمفهوم.'
};
function clean(s){return String(s||'').replace(/\s+/g,' ').trim()}
function short(s,n=110){s=clean(s);return s.length<=n?s:s.slice(0,n-1).replace(/\s+\S*$/,'')+'…'}
function cleanSchoolLogo(root){
 if(!root||!root.querySelectorAll)return;
 root.querySelectorAll('.wr-school').forEach(slot=>{
   [...slot.childNodes].forEach(node=>{
     if(node.nodeType===1&&node.classList?.contains('wr-logo-card'))return;
     node.remove();
   });
   const card=slot.querySelector('.wr-logo-card');
   if(!card)return;
   card.querySelectorAll('.wr-school-name,.school-name,figcaption,small,strong,p,[data-school-caption]').forEach(el=>el.remove());
 });
}
function extractPlans(page1,page2){
 const rows=[...page2.querySelectorAll('.wr-student-table tbody tr')];
 const weakCounts={};
 for(const r of rows){const sub=clean(r.querySelector('.wr-weak-subject b')?.textContent);if(sub)weakCounts[sub]=(weakCounts[sub]||0)+1;}
 const plans=[],seen=new Set();
 const add=(subject,item)=>{
   subject=clean(subject);if(!subject||!item)return;
   const parts=[...item.querySelectorAll('span')].map(x=>clean(x.textContent)).filter(Boolean);
   const indicator=short(parts.join(' ')||item.textContent,105);
   if(!indicator)return;
   const key=`${subject}::${indicator}`;if(seen.has(key))return;seen.add(key);
   const percent=clean(item.querySelector('strong')?.textContent)||'—';
   plans.push({subject,indicator,percent,target:weakCounts[subject]||0,action:subjectAction[subject]||'إعادة شرح المهارة، تدريب موجه، ثم قياس قصير.'});
 };
 for(const card of page1.querySelectorAll('.wr-indicator-card')){
   const subject=card.querySelector('header b')?.textContent;
   for(const item of card.querySelectorAll('.wr-indicator-item'))add(subject,item);
 }
 for(const row of rows){
   for(const item of row.querySelectorAll('.wr-student-ind')){
     const subject=item.querySelector('.wr-ind-subject')?.textContent;
     add(subject,item);
   }
 }
 return plans;
}
function planHtml(plans){
 if(!plans.length)return `<section class="wr-remedial"><h3>الخطة العلاجية للأسبوع القادم</h3><p style="padding:10px;text-align:center">لا توجد بيانات كافية لبناء خطة علاجية آلية.</p></section>`;
 return `<section class="wr-remedial"><h3>الخطة العلاجية للأسبوع القادم</h3><p style="margin:0 0 8px">تُدرج جميع المهارات منخفضة الأداء المتاحة في التقرير دون حد ثابت لعدد الخطط.</p><table><thead><tr><th>المادة</th><th>المهارة المستهدفة</th><th>الطلاب المستهدفون</th><th>الإجراء العلاجي</th><th>المتابعة ومعيار النجاح</th></tr></thead><tbody>${plans.map(p=>`<tr><td><b>${p.subject}</b><br><small>${p.percent}</small></td><td>${p.indicator}</td><td>${p.target?`${p.target} طالبًا ممن ظهر لديهم الضعف`:'طلاب المؤشر منخفض الأداء'}</td><td>${p.action}</td><td>ورقة عمل قصيرة ثم قياس من 5 أسئلة.<br><b>النجاح: 80٪ فأعلى.</b></td></tr>`).join('')}</tbody></table></section>`;
}
function patch(){
 const host=$('reportPreview');if(!host)return;
 cleanSchoolLogo(host);
 const pages=host.querySelectorAll('.weekly-report.report-sheet');if(pages.length<2)return;
 const page1=pages[0],page2=pages[1];
 if(page2.dataset.compactRemedial!=='1'){
   page2.dataset.compactRemedial='1';
   const title=page2.querySelector('.wr-title-pill');if(title)title.textContent='المتابعة والخطة العلاجية للأسبوع القادم';
   const tbody=page2.querySelector('.wr-student-table tbody');
   if(tbody){
     page2.querySelectorAll('.wr-more-note').forEach(n=>n.remove());
   }
   const plans=extractPlans(page1,page2);
   const sig=page2.querySelector('.wr-signatures');if(sig)sig.insertAdjacentHTML('beforebegin',planHtml(plans));else page2.insertAdjacentHTML('beforeend',planHtml(plans));
 }
 cleanSchoolLogo(host);
}
function init(){
 const host=$('reportPreview');if(!host)return;
 new MutationObserver(()=>queueMicrotask(patch)).observe(host,{childList:true,subtree:true,characterData:true});
 patch();
 const print=$('printReportBtn');if(print)print.onclick=()=>{patch();const pages=[...host.querySelectorAll('.weekly-report.report-sheet')];if(!pages.length)return;const root=$('printRoot');root.innerHTML=pages.map(p=>p.outerHTML).join('');cleanSchoolLogo(root);root.setAttribute('aria-hidden','false');window.print();};
 addEventListener('beforeprint',()=>{cleanSchoolLogo(host);cleanSchoolLogo($('printRoot'));});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();