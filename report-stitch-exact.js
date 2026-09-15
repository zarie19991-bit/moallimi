(()=>{
'use strict';
const OLD_COMMIT='1aade7ee46e0230c00039e26a8253325ca198eec';
const RAW_BASE=`https://raw.githubusercontent.com/zarie19991-bit/moallimi/${OLD_COMMIT}/`;
const CDN_BASE=`https://cdn.jsdelivr.net/gh/zarie19991-bit/moallimi@${OLD_COMMIT}/`;
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  const url=typeof input==='string'?input:(input&&input.url)||'';
  const m=url.match(/(?:^|\/)(stitch-report-template\.part[1-6])(?:\?.*)?$/);
  if(m){
    return nativeFetch(RAW_BASE+m[1],{...(init||{}),cache:'no-store',mode:'cors'});
  }
  return nativeFetch(input,init);
};
const s=document.createElement('script');
s.src=CDN_BASE+'report-stitch-exact.js';
s.async=false;
s.onload=()=>console.info('Stitch exact renderer loaded');
s.onerror=()=>{
  console.error('تعذر تحميل مولد تقرير Stitch');
  alert('تعذر تحميل تصميم التقرير المطابق. حدّث الصفحة وحاول مرة أخرى.');
};
document.head.appendChild(s);
})();
