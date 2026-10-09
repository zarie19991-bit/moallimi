(()=>{
'use strict';
const KEY='tamakkun_encourage_counter_v1';
const BANK={
 welcome:[
  'أمامك اليوم خطوة جديدة نحو الإتقان.',
  'ابدأ بهدوء، وافهم المطلوب قبل أن تختار الإجابة.',
  'كل مهارة تتقنها اليوم تجعل أسئلة نافس أوضح غدًا.'
 ],
 correct:[
  'أحسنت! ركّزت على المطلوب ووصلت إلى الإجابة الصحيحة.',
  'إجابة موفقة؛ استمر بالطريقة نفسها في قراءة السؤال.',
  'ممتاز! فهمك للمطلوب قادك إلى الاختيار الصحيح.'
 ],
 correct_context:[
  'ممتاز! لم تعتمد على التخمين؛ استخدمت ما في النص للوصول إلى الإجابة.',
  'أحسنت! ربطت السؤال بالدليل الموجود في النص.',
  'رائع! عرفت أين تبحث عن الإجابة قبل أن تختار.'
 ],
 streak:[
  'تركيز ممتاز! لديك الآن {streak} إجابات صحيحة متتالية.',
  'سلسلة قوية: {streak} إجابات صحيحة. حافظ على الدقة.',
  '{streak} إجابات متتالية صحيحة؛ طريقتك في الحل أصبحت أكثر ثباتًا.'
 ],
 incorrect:[
  'محاولة جيدة. حدّد ما يطلبه السؤال ثم ارجع إلى الدليل في النص.',
  'لا تتعجل في الاختيار؛ اقرأ صياغة السؤال وحدد أين ستبحث عن الإجابة.',
  'راجع المطلوب أولًا، ثم استبعد الخيار الذي لا ينسجم مع النص.'
 ],
 near_mastery:[
  'أنت قريب من الإتقان. ركّز في صياغة السؤال والدليل الذي يقود للإجابة.',
  'بقيت خطوة قصيرة. لا تغيّر طريقتك؛ زد دقتك فقط.',
  'تقدّم واضح. راجع نقطة التعثر ثم أعد المحاولة بثقة.'
 ],
 mastery:[
  'أحسنت! أثبتَّ أنك تفهم المهارة حتى عندما تتغير صياغة السؤال.',
  'إتقان مستحق. أصبحت تعرف ماذا يطلب السؤال وكيف تصل إلى دليله.',
  'ممتاز! لم تتقن الإجابة فقط؛ أتقنت طريقة الوصول إليها.'
 ],
 improvement:[
  'تقدمت من {from}% إلى {to}% — تحسن واضح في فهم المهارة.',
  'نتيجتك ارتفعت من {from}% إلى {to}%. استمر بالطريقة نفسها.',
  'تحسن حقيقي: {from}% ← {to}%.'
 ],
 remedial_complete:[
  'عمل ممتاز؛ أنهيت تدريبًا عالج نقطة كانت تحتاج إلى تقوية.',
  'أحسنت إكمال التدريب العلاجي. راقب الآن كيف تتغير دقتك في صياغات السؤال.',
  'أنجزت مرحلة مهمة؛ استخدم ما تعلمته في السؤال التالي دون استعجال.'
 ],
 enrichment_complete:[
  'ممتاز! تجاوزت مستوى الإتقان وأكملت التحدي الإثرائي.',
  'أداء قوي؛ طبقت المهارة في مستوى أعلى.',
  'أحسنت! استطعت نقل المهارة إلى سؤال أكثر تحديًا.'
 ],
 competition_finish:[
  'أنهيت الجولة. الأهم أنك حافظت على الدقة حتى النهاية.',
  'جولة مكتملة. راجع بعد ظهور النتيجة المؤشرات التي تحتاج تقوية.',
  'أحسنت إنهاء التحدي؛ استخدم نتيجتك لتعرف أين تتقدم أكثر.'
 ],
 resume:[
  'أهلًا بعودتك. نكمل من حيث توقفت.',
  'مرحبًا بعودتك؛ تقدمك محفوظ ويمكنك المتابعة مباشرة.'
 ]
};
let memory=0;
function nextIndex(len){
 if(len<=1)return 0;
 let n=0;try{n=Number(sessionStorage.getItem(KEY)||0)}catch{n=memory}
 n=(n+1)%997;memory=n;try{sessionStorage.setItem(KEY,String(n))}catch{}
 return n%len;
}
function fill(s,c){
 return String(s||'').replace(/\{(\w+)\}/g,(_,k)=>c?.[k]??'');
}
function pick(type,ctx={}){
 let key=type;
 if(type==='correct'&&ctx.use_context)key='correct_context';
 if(type==='correct'&&Number(ctx.streak)>=3)key='streak';
 const rows=BANK[key]||BANK[type]||BANK.correct;
 return fill(rows[nextIndex(rows.length)],ctx);
}
function tone(type){
 if(['incorrect','near_mastery'].includes(type))return 'amber';
 if(['mastery','correct','remedial_complete','enrichment_complete','improvement'].includes(type))return 'emerald';
 if(['competition_finish','streak'].includes(type))return 'indigo';
 return 'sky';
}
function icon(type){
 if(type==='incorrect')return '↺';
 if(type==='near_mastery')return '🎯';
 if(type==='mastery')return '★';
 if(type==='streak')return '🔥';
 if(type==='improvement')return '↗';
 if(type==='competition_finish')return '🏁';
 return '✓';
}
function card(type,ctx={}){
 const t=tone(type),msg=pick(type,ctx);
 return '<div class="tamakkun-encourage tamakkun-encourage-'+t+'" role="status" aria-live="polite"><span class="tamakkun-encourage-icon">'+icon(type)+'</span><span>'+escapeHtml(msg)+'</span></div>';
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function ensureStyle(){
 if(document.getElementById('tamakkunEncourageStyle'))return;
 const s=document.createElement('style');s.id='tamakkunEncourageStyle';s.textContent=`
 .tamakkun-encourage{display:flex;align-items:flex-start;gap:10px;border:1px solid;border-radius:16px;padding:12px 14px;font-size:12px;line-height:1.8;font-weight:800;text-align:right}
 .tamakkun-encourage-icon{width:28px;height:28px;flex:0 0 28px;border-radius:10px;display:grid;place-items:center;font-size:14px;font-weight:900}
 .tamakkun-encourage-emerald{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.tamakkun-encourage-emerald .tamakkun-encourage-icon{background:#d1fae5}
 .tamakkun-encourage-amber{background:#fffbeb;border-color:#fde68a;color:#92400e}.tamakkun-encourage-amber .tamakkun-encourage-icon{background:#fef3c7}
 .tamakkun-encourage-indigo{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}.tamakkun-encourage-indigo .tamakkun-encourage-icon{background:#e0e7ff}
 .tamakkun-encourage-sky{background:#f0f9ff;border-color:#bae6fd;color:#075985}.tamakkun-encourage-sky .tamakkun-encourage-icon{background:#e0f2fe}
 .tamakkun-encourage-toast{position:fixed;z-index:999999;right:16px;bottom:calc(82px + env(safe-area-inset-bottom));max-width:min(420px,calc(100vw - 32px));box-shadow:0 18px 48px rgba(15,23,42,.18)}
 @media(min-width:1024px){.tamakkun-encourage-toast{bottom:22px}}
 `;document.head.appendChild(s);
}
let toastTimer=null;
function toast(type,ctx={},ms=3200){
 ensureStyle();document.getElementById('tamakkunEncourageToast')?.remove();
 const d=document.createElement('div');d.id='tamakkunEncourageToast';d.className='tamakkun-encourage-toast';d.innerHTML=card(type,ctx);document.body.appendChild(d);
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>d.remove(),ms);
 return d;
}
function welcome(name){
 const first=String(name||'').trim().split(/\s+/)[0];
 return (first?('مرحبًا '+first+'، '):'')+pick('welcome');
}
ensureStyle();
window.TamakkunEncouragement={pick,card,toast,welcome};
})();