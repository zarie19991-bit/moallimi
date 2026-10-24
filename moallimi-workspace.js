/* Shared teacher navigation. Existing application actions and data stay in their original modules. */
(()=>{
 'use strict';
 const side=document.getElementById('mlSidebar'),open=document.getElementById('mlOpenNav'),close=document.getElementById('mlCloseNav'),backdrop=document.getElementById('mlBackdrop');
 if(!side||!open)return;
 const mobile=window.matchMedia('(max-width: 1000px)');
 const setOpen=value=>{side.classList.toggle('is-open',value);open.setAttribute('aria-expanded',String(value));backdrop.hidden=!value;document.body.classList.toggle('ml-nav-open',value);if(mobile.matches)side.inert=!value;if(value)close.focus();else open.focus()};
 open.addEventListener('click',()=>setOpen(true));close.addEventListener('click',()=>setOpen(false));backdrop.addEventListener('click',()=>setOpen(false));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&side.classList.contains('is-open'))setOpen(false);if(e.key==='Tab'&&mobile.matches&&side.classList.contains('is-open')){const controls=[...side.querySelectorAll('a[href],button:not([hidden])')].filter(el=>el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 const resize=()=>{if(!mobile.matches){side.inert=false;side.classList.remove('is-open');open.setAttribute('aria-expanded','false');backdrop.hidden=true;document.body.classList.remove('ml-nav-open')}else side.inert=!side.classList.contains('is-open')};
 mobile.addEventListener('change',resize);resize();
 side.addEventListener('click',e=>{if(e.target.closest('a,button')!==close&&e.target.closest('.ml-nav-link,.ml-logout')&&mobile.matches)setOpen(false)});
 const showStudents=()=>{if(location.hash==='#students'&&typeof window.openStudentsModal==='function'){document.getElementById('navStudentsBtn')?.click()}};
 window.addEventListener('hashchange',showStudents);document.addEventListener('DOMContentLoaded',showStudents,{once:true});
})();
