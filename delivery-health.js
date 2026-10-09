(()=>{
'use strict';
if(window.__NAFES_DELIVERY_HEALTH__)return;
window.__NAFES_DELIVERY_HEALTH__=true;
const T=window.NafesTeacher,$=id=>document.getElementById(id);
let timer=null,lastPending=0,loading=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ar=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(n||0));
function ensure(){
  const dash=$('dashboard');if(!dash||$('deliveryHealthPanel'))return null;
  const style=document.createElement('style');style.id='deliveryHealthStyle';style.textContent=`
  .dh-panel{margin:0 0 16px;padding:16px;border:1px solid #d8e5e2;border-radius:16px;background:#fff;box-shadow:0 8px 25px #17324d0d}
  .dh-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.dh-head h2{margin:0;font-size:17px;color:#17324d}.dh-head p{margin:5px 0 0;color:#647773;font-size:11px;line-height:1.7}
  .dh-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dh-tools select,.dh-tools button{font:inherit;border:1px solid #cfdedb;border-radius:9px;background:#fff;padding:8px 10px;font-size:11px}.dh-tools button{font-weight:800;cursor:pointer;color:#0f6258}
  .dh-status{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900}.dh-good{background:#e9f7ef;color:#176b47}.dh-warn{background:#fff7df;color:#8b650a}.dh-bad{background:#fff0ef;color:#a13a32}
  .dh-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:14px}.dh-card{border:1px solid #e3ece9;border-radius:11px;padding:10px;background:#fafdfc}.dh-card small{display:block;color:#72827f;font-size:9px;margin-bottom:4px}.dh-card b{font-size:18px;color:#17324d}
  .dh-pending{margin-top:14px;border-top:1px solid #edf2f0;padding-top:12px}.dh-pending h3{font-size:13px;margin:0 0 8px;color:#17324d}.dh-pending table{width:100%;border-collapse:collapse;font-size:10px}.dh-pending th,.dh-pending td{padding:7px 8px;border-bottom:1px solid #edf2f0;text-align:right}.dh-muted{color:#71817f;font-size:10px}
  @media(max-width:850px){.dh-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:520px){.dh-grid{grid-template-columns:repeat(2,1fr)}}
  `;document.head.appendChild(style);
  const panel=document.createElement('section');panel.id='deliveryHealthPanel';panel.className='dh-panel';
  panel.innerHTML=`
   <div class="dh-head"><div><h2>موثوقية تسليم الاختبارات</h2><p>مراقبة الحفظ، إعادة الإرسال، انقطاع الاتصال وإيصالات التسليم. لا تعرض هذه اللوحة محتوى الإجابات.</p></div>
   <div class="dh-tools"><span id="deliveryHealthStatus" class="dh-status dh-good">جارٍ الفحص…</span><select id="deliveryHealthHours"><option value="1">آخر ساعة</option><option value="24" selected>آخر 24 ساعة</option><option value="72">آخر 3 أيام</option></select><button id="deliveryHealthRefresh" type="button">تحديث</button></div></div>
   <div id="deliveryHealthGrid" class="dh-grid"></div><div id="deliveryHealthPending" class="dh-pending"></div>`;
  const tabs=dash.querySelector('.main-tabs');dash.insertBefore(panel,tabs||dash.firstChild);
  $('deliveryHealthRefresh').onclick=()=>load(true);
  $('deliveryHealthHours').onchange=()=>load(true);
  return panel;
}
function setStatus(summary){
  const el=$('deliveryHealthStatus');if(!el)return;
  const pending=Number(summary.pending_attempts||0),failed=Number(summary.failed_events||0),retries=Number(summary.retry_events||0);
  el.className='dh-status '+(pending?'dh-bad':failed||retries?'dh-warn':'dh-good');
  el.textContent=pending?'تحتاج متابعة: '+ar(pending):failed||retries?'حدثت أعطال وتعافت':'الحالة مستقرة';
}
function fmtDate(v){try{return v?new Date(v).toLocaleString('ar-SA'):'—'}catch(_){return'—'}}
function render(data){
 const s=data.summary||{};setStatus(s);
 $('deliveryHealthGrid').innerHTML=[
  ['المحاولات المتأثرة',s.affected_attempts],
  ['إعادات الإرسال',s.retry_events],
  ['انقطاع الاتصال',s.offline_events],
  ['أخطاء نهائية',s.failed_events],
  ['إيصالات التسليم',s.submit_receipts],
  ['تحتاج متابعة',s.pending_attempts]
 ].map(([label,val])=>`<div class="dh-card"><small>${esc(label)}</small><b>${ar(val)}</b></div>`).join('');
 const pending=data.pending||[],wrap=$('deliveryHealthPending');
 if(!pending.length){wrap.innerHTML='<h3>الحالات التي تحتاج متابعة</h3><div class="dh-muted">لا توجد محاولات معلقة حاليًا في النافذة المختارة.</div>';return;}
 wrap.innerHTML=`<h3>الحالات التي تحتاج متابعة</h3><table><thead><tr><th>الطالب</th><th>الفصل</th><th>آخر حالة</th><th>العملية</th><th>آخر تحديث</th></tr></thead><tbody>${pending.map(x=>`<tr><td><b>${esc(x.student_name||'طالب')}</b></td><td>${esc(x.class_name||'—')}</td><td>${esc(x.event_type||'—')}</td><td>${esc(x.action_name||'—')}</td><td>${esc(fmtDate(x.last_event_at))}</td></tr>`).join('')}</tbody></table>`;
 if(pending.length>lastPending&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
   try{new Notification('منصة معلّمي',{body:'يوجد '+pending.length+' محاولة اختبار تحتاج متابعة في التسليم.'});}catch(_){}
 }
 lastPending=pending.length;
}
async function load(force=false){
 if(loading||!T?.getKey?.())return;
 ensure();loading=true;
 try{
   if(force)T.clearReadCache?.();
   const hours=Number($('deliveryHealthHours')?.value||24);
   const data=await T.api('teacher_delivery_health',{hours});
   render(data);
 }catch(e){
   const status=$('deliveryHealthStatus');if(status){status.className='dh-status dh-warn';status.textContent='تعذر تحديث المراقبة';}
   const pending=$('deliveryHealthPending');if(pending)pending.innerHTML=`<div class="dh-muted">${esc(e.message||'تعذر تحميل بيانات الاعتمادية.')}</div>`;
 }finally{loading=false;}
}
function install(){
 ensure();load();
 clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)load(true)},60000);
 addEventListener('online',()=>load(true));
 addEventListener('nafes:auth-changed',()=>setTimeout(load,100));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();