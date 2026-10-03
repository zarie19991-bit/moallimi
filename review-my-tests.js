(()=>{
'use strict';
const T=window.NafesTeacher,$=id=>document.getElementById(id);
if(!T||!$('publishedList'))return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={reading:'القراءة',math:'الرياضيات',science:'العلوم'};
let busy=false;
function state(msg){if($('myTestsState'))$('myTestsState').textContent=msg}
async function load(){
 if(busy)return;
 if(!T.getKey()){state('يلزم تسجيل دخول المعلم لعرض اختباراتك.');return;}
 busy=true;state('جارٍ تحميل اختباراتك…');
 try{
   const d=await T.api('teacher_catalog');
   const tests=(d.tests||[]).filter(t=>t.kind!=='simulation'&&t.is_owner===true);
   $('publishedList').innerHTML=tests.length?tests.map(t=>{
     const subjects=(t.subjects||[]).map(s=>names[s]||s).join(' + ')||'—';
     const code=String(t.short_code||'').trim();
     const openUrl=code?'e.html?t='+encodeURIComponent(code):'#';
     return '<article class="published-test" data-test-id="'+esc(t.id)+'">'+
       '<b>'+esc(t.title||'اختبار بدون اسم')+'</b>'+
       '<small>'+esc(subjects)+' · '+esc(t.class_name||'جميع الفصول')+(code?' · الرمز: '+esc(code):'')+'</small>'+
       '<div class="published-core-actions">'+
         (code?'<a target="_blank" rel="noopener" href="'+openUrl+'">فتح الاختبار</a>':'')+
         '<a href="analysis.html?test='+encodeURIComponent(t.id)+'">تحليل النتائج</a>'+
         (code?'<button type="button" data-copy-test-link data-code="'+esc(code)+'">نسخ الرابط</button>':'')+
       '</div>'+
     '</article>';
   }).join(''):'<div class="archive-empty"><b>لا توجد اختبارات إلكترونية منشورة أنشأها هذا الحساب حاليًا.</b><br><span>أي اختبار جديد تنشره سيظهر هنا تلقائيًا.</span></div>';
   state(tests.length?'عدد اختباراتك: '+new Intl.NumberFormat('ar-SA').format(tests.length):'لا توجد اختبارات محفوظة حاليًا.');
   setTimeout(()=>window.NafesTestManagement?.refresh?.(),0);
 }catch(e){
   $('publishedList').innerHTML='<div class="archive-empty">'+esc(e.message||'تعذر تحميل الاختبارات.')+'</div>';
   state('تعذر تحميل اختباراتك.');
 }finally{busy=false;}
}
$('refreshMyTests')?.addEventListener('click',load);
$('publishedList').addEventListener('click',async e=>{
 const b=e.target.closest('[data-copy-test-link]');if(!b)return;
 const url=new URL('e.html?t='+encodeURIComponent(b.dataset.code||''),location.href).href;
 try{await navigator.clipboard.writeText(url);b.textContent='تم النسخ';setTimeout(()=>b.textContent='نسخ الرابط',1500)}
 catch(_){prompt('انسخ رابط الاختبار:',url)}
});
window.NafesReloadPublished=load;
addEventListener('nafes:auth-changed',e=>{if(e.detail?.authenticated)load();});
addEventListener('nafes:teacher-profile',load);
load();
})();