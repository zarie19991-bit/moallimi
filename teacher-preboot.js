(()=>{
'use strict';
const PROFILE='nafes_teacher_profile_cache_v1',KEY='nafes_teacher_key_v1',SESSION='nafes_teacher_session_key_v1';
const LOGO='moallimi-logo-ui.png?v=20261003-brand2';
const ICON='moallimi-brand-icon-v2.webp';
function ensureBrandHead(){
 try{
  if(!document.querySelector('link[data-moallimi-logo-preload]')){
   const preload=document.createElement('link');
   preload.rel='preload';preload.as='image';preload.href=LOGO;preload.setAttribute('fetchpriority','high');preload.dataset.moallimiLogoPreload='1';
   document.head.appendChild(preload);
  }
  if(!document.querySelector('link[rel="icon"]')){
   const icon=document.createElement('link');icon.rel='icon';icon.type='image/webp';icon.href=ICON;document.head.appendChild(icon);
  }
 }catch(_){}
}
try{
 ensureBrandHead();
 const hasKey=!!(sessionStorage.getItem(SESSION)||localStorage.getItem(KEY));
 if(!hasKey)return;
 const raw=sessionStorage.getItem(PROFILE)||localStorage.getItem(PROFILE)||'';
 const p=raw?JSON.parse(raw):null;
 if(!p||!['reading','math','science'].includes(p.subject_scope))return;
 const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 // Never redirect from cached profile data before the current teacher key is verified.
 // teacher-access.js performs any subject-scoped redirect after a live profile check.
 if(page===''||page==='index.html')return;
 const html=document.documentElement;
 html.classList.add('teacher-scoped-preboot');
 html.dataset.prebootTeacherLabel=p.label||'معلم المادة';
 html.dataset.prebootTeacherSubject=({reading:'القراءة',math:'الرياضيات',science:'العلوم'})[p.subject_scope]||'';
 const style=document.createElement('style');
 style.id='teacherPrebootStyle';
 style.textContent=`html.teacher-scoped-preboot body{visibility:hidden!important}html.teacher-scoped-preboot:before{content:"";position:fixed;inset:0;z-index:2147483647;background:#f3f7f6 url("${LOGO}") center calc(50% - 38px)/190px auto no-repeat;visibility:visible!important}html.teacher-scoped-preboot:after{content:attr(data-preboot-teacher-label) " — " attr(data-preboot-teacher-subject);position:fixed;inset:calc(50% + 38px) 0 auto;z-index:2147483647;text-align:center;color:#0f514c;font:800 20px Tahoma,Arial,sans-serif;visibility:visible!important}`;
 document.head.appendChild(style);
}catch(_){}
})();