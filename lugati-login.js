(()=>{
  'use strict';
  const EDGE='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/lugati-auth';
  const SESSION_KEY='lugati_session_v1';
  const PROFILE_KEY='lugati_profile_v1';
  const ROLE_KEY='lugati_role_v1';
  const $=id=>document.getElementById(id);
  const studentForm=$('studentForm'),teacherForm=$('teacherForm'),message=$('message'),sessionCard=$('sessionCard');
  const digits=v=>String(v??'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g,'');
  function say(text,type='error'){message.textContent=text||'';message.className='message'+(text?` show ${type}`:'')}
  function setBusy(form,busy,text){const btn=form.querySelector('button[type="submit"]');if(!btn)return;btn.disabled=busy;const span=btn.querySelector('span');if(span){if(!span.dataset.original)span.dataset.original=span.textContent;span.textContent=busy?text:span.dataset.original}}
  async function call(body,token=''){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),18000);try{const headers={'Content-Type':'application/json'};if(token)headers.Authorization=`Bearer ${token}`;const r=await fetch(EDGE,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',signal:controller.signal});const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw new Error(d.error||'تعذر إتمام العملية.');return d}catch(err){if(err.name==='AbortError')throw new Error('استغرق الاتصال وقتًا طويلًا. أعد المحاولة.');throw err}finally{clearTimeout(timeout)}}
  function stores(remember=false){return remember?localStorage:sessionStorage}
  function clearStored(){for(const store of [localStorage,sessionStorage]){try{store.removeItem(SESSION_KEY);store.removeItem(PROFILE_KEY);store.removeItem(ROLE_KEY)}catch(_){}}}
  function saveAuth(data,remember=false){clearStored();const store=stores(remember);store.setItem(SESSION_KEY,data.session.token);store.setItem(PROFILE_KEY,JSON.stringify(data.profile||{}));store.setItem(ROLE_KEY,data.role||'')}
  function readAuth(){for(const store of [sessionStorage,localStorage]){try{const token=store.getItem(SESSION_KEY);if(token)return{token,profile:JSON.parse(store.getItem(PROFILE_KEY)||'{}'),role:store.getItem(ROLE_KEY)||'',store}}catch(_){}}return null}
  function showSession(data){studentForm.classList.add('hidden');teacherForm.classList.add('hidden');document.querySelector('.role-tabs').classList.add('hidden');say('');sessionCard.classList.remove('hidden');const p=data.profile||{};$('sessionText').textContent=data.role==='student'?`مرحبًا ${p.full_name||'بك'}${p.class_name?` · الفصل ${p.class_name}`:''}`:`مرحبًا ${p.label||'بك'} · دخول المعلم مفعل`}
  function showRole(role){sessionCard.classList.add('hidden');say('');document.querySelector('.role-tabs').classList.remove('hidden');document.querySelectorAll('.role-tab').forEach(b=>b.classList.toggle('active',b.dataset.role===role));studentForm.classList.toggle('hidden',role!=='student');teacherForm.classList.toggle('hidden',role!=='teacher')}
  document.querySelectorAll('.role-tab').forEach(btn=>btn.onclick=()=>showRole(btn.dataset.role));
  $('studentNo').addEventListener('input',e=>{e.target.value=digits(e.target.value).slice(0,3)});
  $('toggleKey').onclick=()=>{const input=$('teacherKey');const show=input.type==='password';input.type=show?'text':'password';$('toggleKey').textContent=show?'إخفاء':'إظهار'};
  studentForm.addEventListener('submit',async e=>{e.preventDefault();say('');const name=$('studentName').value.trim(),cls=$('className').value.trim(),last3=digits($('studentNo').value).slice(0,3);if(name.length<3)return say('اكتب اسم الطالب كاملًا كما هو في كشف المدرسة.');if(!cls)return say('اختر الفصل.');if(last3.length!==3)return say('أدخل آخر ٣ أرقام من الهوية الوطنية.');setBusy(studentForm,true,'جارٍ التحقق...');try{const d=await call({action:'login_student',student_name:name,class_name:cls,national_id_last3:last3});saveAuth(d,false);showSession(d)}catch(err){say(err.message||'تعذر تسجيل الدخول.')}finally{setBusy(studentForm,false)}});
  teacherForm.addEventListener('submit',async e=>{e.preventDefault();say('');const key=$('teacherKey').value.trim();if(!key)return say('أدخل مفتاح المعلم.');setBusy(teacherForm,true,'جارٍ التحقق...');try{const d=await call({action:'login_teacher',teacher_key:key});saveAuth(d,$('rememberTeacher').checked);showSession(d);$('teacherKey').value=''}catch(err){say(err.message||'تعذر تسجيل الدخول.')}finally{setBusy(teacherForm,false)}});
  $('logoutBtn').onclick=async()=>{const auth=readAuth();try{if(auth?.token)await call({action:'logout'},auth.token)}catch(_){}clearStored();showRole('student');say('تم تسجيل الخروج بنجاح.','info')};
  (async()=>{const auth=readAuth();if(!auth)return;try{const d=await call({action:'verify'},auth.token);auth.store.setItem(PROFILE_KEY,JSON.stringify(d.profile||{}));auth.store.setItem(ROLE_KEY,d.role||'');showSession(d)}catch(_){clearStored()}})();
})();
