(()=>{
const SUBJECTS=[window.NAFES_READING,window.NAFES_MATH,window.NAFES_SCIENCE].filter(Boolean);
const EXPECTED={reading:16,math:95,science:159};
const TESTS_PER_INDICATOR=4;
let current='reading',query='',domain='';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const count=s=>s.outcomes.reduce((n,o)=>n+o.indicators.length,0);
const subject=k=>SUBJECTS.find(s=>s.key===k)||SUBJECTS[0];
function domains(s){return [...new Set(s.outcomes.map(o=>o.domain))]}
function totalOutcomes(){return SUBJECTS.reduce((n,s)=>n+s.outcomes.length,0)}
function totalIndicators(){return SUBJECTS.reduce((n,s)=>n+count(s),0)}
function verify(){const actual=Object.fromEntries(SUBJECTS.map(s=>[s.key,count(s)]));const ok=Object.keys(EXPECTED).every(k=>actual[k]===EXPECTED[k])&&totalIndicators()===270;return{ok,actual}}
function renderTop(){const v=verify();$('summary').innerHTML=`<article class="stat"><span>المواد</span><b>3</b></article><article class="stat"><span>نواتج التعلم</span><b>${totalOutcomes()}</b></article><article class="stat"><span>المؤشرات</span><b>${totalIndicators()}</b></article><article class="stat"><span>نماذج الاختبارات</span><b>${totalIndicators()*TESTS_PER_INDICATOR}</b><small>${TESTS_PER_INDICATOR} اختبارًا لكل مؤشر</small></article>`;
$('verification').className='verification'+(v.ok?'':' bad');$('verification').textContent=v.ok?`تم التحقق آليًا من اكتمال الأعداد: القراءة ${v.actual.reading} · الرياضيات ${v.actual.math} · العلوم ${v.actual.science} · الإجمالي 270 مؤشرًا.`:`تنبيه تحقق: القراءة ${v.actual.reading||0} · الرياضيات ${v.actual.math||0} · العلوم ${v.actual.science||0}.`}
function renderSubjects(){const host=$('subjects');host.innerHTML=SUBJECTS.map(s=>`<button class="subject ${s.key==='math'?'math':s.key==='science'?'science':''} ${s.key===current?'active':''}" data-subject="${s.key}"><div class="shead"><span class="icon">${s.icon}</span><div><h3>${esc(s.title)}</h3><p>نواتج ومؤشرات الصف التاسع</p></div></div><div class="counts"><span>${s.outcomes.length} ناتج تعلم</span><span>${count(s)} مؤشر</span><span>${count(s)*TESTS_PER_INDICATOR} اختبار</span></div></button>`).join('');host.querySelectorAll('[data-subject]').forEach(b=>b.onclick=()=>{current=b.dataset.subject;domain='';query='';$('search').value='';render()})}
function renderFilters(){const s=subject(current);$('domain').innerHTML='<option value="">كل المجالات</option>'+domains(s).map(d=>`<option value="${esc(d)}" ${d===domain?'selected':''}>${esc(d)}</option>`).join('')}
function matchOutcome(o){const q=query.trim().toLowerCase();if(domain&&o.domain!==domain)return false;if(!q)return true;return [o.domain,o.subdomain,o.code,o.title,...o.indicators].some(x=>String(x).toLowerCase().includes(q))}
function indicatorMatch(text,o){const q=query.trim().toLowerCase();if(!q)return true;return [text,o.domain,o.subdomain,o.code,o.title].some(x=>String(x).toLowerCase().includes(q))}
function renderContent(){const s=subject(current),matched=s.outcomes.filter(matchOutcome);let visibleIndicators=0;const groups=[];for(const d of domains(s)){const outcomes=matched.filter(o=>o.domain===d);if(!outcomes.length)continue;const html=outcomes.map(o=>{const inds=o.indicators.map((t,i)=>({t,i})).filter(x=>indicatorMatch(x.t,o));visibleIndicators+=inds.length;if(!inds.length)return'';return `<details class="outcome" ${query?'open':''}><summary><span class="code">${esc(o.code)}</span><div class="outcome-title"><b>${esc(o.title)}</b><small>${esc(o.subdomain)} · ${o.indicators.length} مؤشرات</small></div><span class="chev">⌄</span></summary><div class="indicator-list">${inds.map(x=>`<div class="indicator"><span class="num">${x.i+1}</span><div class="indicator-body"><p>${esc(x.t)}</p><div class="indicator-actions"><span class="model-badge">${TESTS_PER_INDICATOR} اختبار</span><button class="tests-btn" type="button" onclick="openNafesModels('${s.key}','${esc(o.code)}',${x.i+1})">الاختبارات والباركود</button></div></div></div>`).join('')}</div></details>`}).join('');if(html)groups.push(`<section class="domain"><div class="domain-head"><h4>${esc(d)}</h4><span>${outcomes.length} ناتج تعلم</span></div>${html}</section>`)}
$('contentTitle').textContent=s.title;$('liveCount').textContent=`${visibleIndicators} مؤشر ظاهر`;$('content').innerHTML=groups.join('')||'<div class="empty">لا توجد مؤشرات مطابقة للبحث أو المجال المحدد.</div>'}
function render(){renderTop();renderSubjects();renderFilters();renderContent()}
$('search').addEventListener('input',e=>{query=e.target.value;renderContent()});$('domain').addEventListener('change',e=>{domain=e.target.value;renderContent()});$('expandAll').onclick=()=>document.querySelectorAll('.outcome').forEach(x=>x.open=true);$('collapseAll').onclick=()=>document.querySelectorAll('.outcome').forEach(x=>x.open=false);
window.NAFES_SUBJECTS=SUBJECTS;
window.NAFES_TESTS_PER_INDICATOR=TESTS_PER_INDICATOR;
render();
})();
