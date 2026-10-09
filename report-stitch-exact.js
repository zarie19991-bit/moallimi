(()=>{
'use strict';
const OLD_COMMIT='1aade7ee46e0230c00039e26a8253325ca198eec';
const RAW_BASE=`https://raw.githubusercontent.com/zarie19991-bit/moallimi/${OLD_COMMIT}/`;
const CDN_BASE=`https://cdn.jsdelivr.net/gh/zarie19991-bit/moallimi@${OLD_COMMIT}/`;
const TEACHERS={reading:'زرعي شبير',math:'عبدالله العماري',science:'مليدان بالحارث'};
const nativeFetch=window.fetch.bind(window);

window.fetch=function(input,init){
  const url=typeof input==='string'?input:(input&&input.url)||'';
  const m=url.match(/(?:^|\/)(stitch-report-template\.part[1-6])(?:\?.*)?$/);
  if(m){
    return nativeFetch(RAW_BASE+m[1],{...(init||{}),cache:'no-store',mode:'cors'});
  }
  return nativeFetch(input,init);
};

const FRAME_PRINT_CSS=`
.moallimi-teacher-middle{display:none!important}
@page{size:A4 portrait;margin:10mm}
@media print{
  html,body{margin:0!important;padding:0!important;background:#fff!important;direction:rtl!important;zoom:1!important;transform:none!important}
  body{font-family:Tahoma,Arial,sans-serif!important;font-size:12pt!important;font-weight:700!important;line-height:1.5!important;color:#182b32!important}
  body :is(p,li,span,small,b,strong,label,th,td):not(.material-symbols-outlined){font-family:Tahoma,Arial,sans-serif!important;font-size:12pt!important;font-weight:700!important;line-height:1.5!important}
  body .material-symbols-outlined{font-family:'Material Symbols Outlined'!important;font-weight:400!important;line-height:1!important}
  body :is(h2,h3,h4,.font-headline-lg,.font-headline-md,.font-title-md){font-family:Tahoma,Arial,sans-serif!important;font-size:14pt!important;font-weight:800!important;line-height:1.45!important}
  body :is(h1,.font-headline-xl){font-family:Tahoma,Arial,sans-serif!important;font-size:16pt!important;font-weight:800!important;line-height:1.45!important}
  body .font-data-metric{font-size:18pt!important;font-weight:800!important;line-height:1.35!important}
  main,main>div{width:auto!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding-top:0!important;overflow:visible!important;zoom:1!important;transform:none!important}
  table{width:100%!important;min-width:0!important;max-width:100%!important;border-collapse:collapse!important;border-spacing:0!important;table-layout:fixed!important;overflow:visible!important}
  th,td{border:1px solid #444!important;padding:6px!important;vertical-align:middle!important;overflow-wrap:anywhere!important;white-space:normal!important;color:#182b32!important;background:#fff!important}
  th{background:#e4ecee!important;font-weight:800!important}
  thead{display:table-header-group!important}
  tfoot{display:table-footer-group!important}
  tr,[data-subject-card]{break-inside:avoid!important;page-break-inside:avoid!important}
  .no-print,body>header{display:none!important}
  body *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
`;

function teacherKey(node){
  const card=node.closest?.('[data-subject-card]');
  const fromCard=String(card?.dataset?.subjectCard||'').trim().toLowerCase();
  if(Object.prototype.hasOwnProperty.call(TEACHERS,fromCard))return fromCard;
  const text=String(node.textContent||'');
  return Object.keys(TEACHERS).find(key=>text.includes(TEACHERS[key]))||'';
}
function teacherLabels(doc){
  return [...doc.querySelectorAll('span,p,small,div')].filter(node=>{
    if(node.children?.length)return false;
    const text=String(node.textContent||'').trim();
    return /^(?:المعلم المسؤول|معلم المادة|المعلم)\s*:/.test(text)&&!!teacherKey(node);
  });
}
function markTeacherBoundaries(doc){
  const labels=teacherLabels(doc),groups=new Map();
  for(const label of labels){
    label.classList.remove('moallimi-teacher-first','moallimi-teacher-last','moallimi-teacher-middle');
    const key=teacherKey(label);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(label);
  }
  for(const list of groups.values()){
    if(!list.length)continue;
    list[0].classList.add('moallimi-teacher-first');
    if(list.length===1){list[0].classList.add('moallimi-teacher-last');continue;}
    list[list.length-1].classList.add('moallimi-teacher-last');
    for(let i=1;i<list.length-1;i++)list[i].classList.add('moallimi-teacher-middle');
  }
}
function tuneFrame(frame){
  if(!frame||frame.dataset.moallimiPrintTuned==='1')return;
  frame.dataset.moallimiPrintTuned='1';
  const apply=()=>{
    try{
      const doc=frame.contentDocument;
      if(!doc?.head)return;
      let style=doc.getElementById('moallimi-analysis-report-print-fix');
      if(!style){
        style=doc.createElement('style');
        style.id='moallimi-analysis-report-print-fix';
        style.textContent=FRAME_PRINT_CSS;
        doc.head.appendChild(style);
      }
      markTeacherBoundaries(doc);
    }catch(error){console.warn('تعذر تطبيق ضبط طباعة التقرير العام',error)}
  };
  frame.addEventListener('load',()=>{apply();setTimeout(apply,150);setTimeout(apply,900)});
  apply();
}
function watchExactFrame(){
  const attach=()=>tuneFrame(document.getElementById('stitchExactReportFrame'));
  attach();
  new MutationObserver(attach).observe(document.documentElement,{childList:true,subtree:true});
}

watchExactFrame();
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
