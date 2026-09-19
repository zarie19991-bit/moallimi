(()=>{
'use strict';
const PROFILE='nafes_teacher_profile_cache_v1',KEY='nafes_teacher_key_v1',SESSION='nafes_teacher_session_key_v1';
try{
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
 style.textContent=`html.teacher-scoped-preboot body{visibility:hidden!important}html.teacher-scoped-preboot:before{content:attr(data-preboot-teacher-label) " — " attr(data-preboot-teacher-subject);position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#f3f7f6;color:#0f514c;font:800 22px Tahoma,Arial,sans-serif;visibility:visible!important}`;
 document.head.appendChild(style);
}catch(_){}
})();