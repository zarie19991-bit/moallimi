(()=>{'use strict';
function insert(){
 const app=document.getElementById('app');
 if(!app)return;
 const teachers=app.querySelector('.desktop-sidebar nav [data-nav="teachers"]');
 if(!teachers)return;
 const nav=teachers.parentElement;
 if(nav&&!nav.querySelector('[data-nafes-school-link]')){
  const link=document.createElement('a');
  link.href='./tamakkun-nafes-school-plan.html';
  link.setAttribute('data-nafes-school-link','1');
  link.className='w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all text-right text-emerald-50 hover:bg-white/15';
  link.style.cssText='display:flex;min-height:57px;text-decoration:none;border:1px solid rgba(255,255,255,.16);border-radius:17px;padding:11px 13px;background:rgba(38,202,157,.17);color:white;align-items:center';
  link.innerHTML='<span style="display:flex;flex-direction:column"><strong>خطة تحسين أداء نافس ١٤٤٧هـ</strong><small style="font-size:11px;color:#daf4e9">خطة مدرسية مستقلة · متابعة أسبوعية</small></span><span aria-hidden="true">↗</span>';
  const plans=nav.querySelector('[data-nav="plans"]');
  (plans||teachers).after(link);
 }
 if(nav&&!nav.querySelector('[data-followup-link]')){
  const follow=document.createElement('a');
  follow.href='./tamakkun-individual-followup.html';
  follow.setAttribute('data-followup-link','1');
  follow.className='w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all text-right text-emerald-50 hover:bg-white/15';
  follow.style.cssText='display:flex;min-height:58px;text-decoration:none;border:1px solid rgba(255,255,255,.24);border-radius:17px;padding:11px 13px;background:rgba(225,249,235,.16);color:white;align-items:center';
  follow.innerHTML='<span style="display:flex;flex-direction:column"><strong>ملفات متابعة الإتقان</strong><small style="font-size:11px;color:#daf4e9">١٢٠ طالبًا فأكثر · كشوف وخطابات</small></span><span aria-hidden="true">↗</span>';
  const plan=nav.querySelector('[data-nafes-school-link]');
  (plan||teachers).after(follow);
 }
 const view=document.getElementById('view');
 if(view&&!view.querySelector('[data-nafes-school-banner]')){
  const banner=document.createElement('a');
  banner.href='./tamakkun-nafes-school-plan.html';
  banner.setAttribute('data-nafes-school-banner','1');
  banner.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;text-decoration:none;background:#ecf7ef;border:1px solid #b5dfc5;border-radius:15px;padding:12px 17px;color:#075446;margin-bottom:14px;font-family:Tajawal,Tahoma,Arial,sans-serif;font-weight:800';
  banner.innerHTML='<span>خطة تحسين أداء نافس ١٤٤٧هـ — مستقلة عن علاج الطالب</span><span style="font-size:13px">فتح خطة المدرسة ←</span>';
  view.prepend(banner);
 }
 if(view&&!view.querySelector('[data-followup-banner]')){
  const banner=document.createElement('a');
  banner.href='./tamakkun-individual-followup.html';
  banner.setAttribute('data-followup-banner','1');
  banner.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;text-decoration:none;background:#fff7e6;border:1px solid #e4c991;border-radius:15px;padding:12px 17px;color:#624806;margin-bottom:14px;font-family:Tajawal,Tahoma,Arial,sans-serif;font-weight:800';
  banner.innerHTML='<span>ملفات متابعة إتقان الطلاب — سجل يومي وأسبوعي وشهري وخطابات رسمية</span><span style="font-size:13px">فتح المتابعة ←</span>';
  view.prepend(banner);
 }
}
function boot(){const app=document.getElementById('app');if(!app)return;const observer=new MutationObserver(insert);observer.observe(app,{childList:true,subtree:true});insert()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();