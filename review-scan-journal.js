/* Original scans are immutable; reviewer changes are versioned and audited server-side. */
(()=>{'use strict';
const $=id=>document.getElementById(id),ar=n=>new Intl.NumberFormat('ar-SA').format(n||0);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={blank:'غير محلول',multiple:'إجابات متعددة',correct:'صحيح مؤكد',incorrect:'إجابة خاطئة',uncertain:'قراءة غير مؤكدة'};
const letters=['أ','ب','ج','د'];
let draft=null,session=null,sheets=[],active=-1,busy=false,pending=null,alerts=[],imageCache=new Map(),poll=null,loadedImage=null;
const api=(action,b={})=>NafesTeacher.api(action,{review_id:draft.review_id,session_id:session?.id,...b});
const effective=s=>s.effective_snapshot||s.snapshot;
const duplicate=s=>!!(s.duplicate_of||s.duplicate_legacy_at);
const status=s=>s.disposition==='duplicate'?'مراجَع — نسخة مكررة':s.disposition==='requires_rescan'?'مراجَع — يلزم إعادة المسح':s.reviewed_at?'تم التحقق':'بانتظار التحقق';
function message(t,error=false){$('journalStatus').textContent=t;$('journalStatus').className='notice '+(error?'error':'');if($('modalFeedback')){$('modalFeedback').textContent=t;$('modalFeedback').className=error?'notice error':'notice';}}
function firstPending(){return sheets.findIndex(s=>!s.reviewed_at);}
function ready(){return session&&sheets.length===session.expected_count;}
function lock(value){busy=value;for(const id of ['saveSheetBtn','nextSheetBtn','finishReviewBtn','approveBtn','processBtn','clearBtn','sessionPicker','resumeSessionBtn','retryUploadBtn'])if($(id))$(id).disabled=value;renderButtons();}
function renderButtons(){
 const s=sheets[active];
 $('saveSheetBtn').disabled=busy||!ready()||!s||loadedImage!==s.id||!!s.reviewed_at||!$('verifiedCheck').checked||(duplicate(s)&&!$('duplicateCheck').checked);
 $('nextSheetBtn').disabled=busy||!s?.reviewed_at||active>=sheets.length-1;
 $('finishReviewBtn').disabled=busy||!ready()||firstPending()>=0||!!session.completed_at;
 $('approveBtn').disabled=busy||!session?.completed_at||!sheets.some(s=>s.disposition==='verified');
 document.querySelectorAll('[data-edit-question]').forEach(b=>{b.disabled=busy||!ready()||!s||loadedImage!==s.id||!!session?.completed_at;});
 $('retryUploadBtn').classList.toggle('hidden',!pending);
}
function render(){
 $('resultsSection').classList.remove('hidden');$('summarySection').classList.remove('hidden');
 const count=sheets.reduce((m,s)=>{for(const [k,v]of Object.entries(effective(s).counts))m[k]=(m[k]||0)+v;return m;},{});
 $('summaryCards').innerHTML=[['الأوراق',sheets.length],['تمت مراجعتها',sheets.filter(s=>s.reviewed_at).length],['تنبيهات التكرار',sheets.filter(s=>duplicate(s)).length],...Object.entries(labels).map(([k,l])=>[l,count[k]||0])].map(([l,n])=>'<div class="summary"><span>'+l+'</span><b>'+ar(n)+'</b></div>').join('');
 const only=$('alertFilter').checked;
 $('resultsBody').innerHTML=sheets.map((s,i)=>({s,i})).filter(({s})=>!only||duplicate(s)).map(({s,i})=>'<tr><td>'+esc(s.snapshot.student_name)+'</td><td>'+esc(s.snapshot.model)+'</td><td>'+ar(effective(s).score)+' / '+ar(s.snapshot.total)+'</td><td>'+esc(status(s))+(duplicate(s)?' <strong class="duplicate-label">رفع مكرر</strong>':'')+'</td><td><button class="secondary" data-open="'+i+'" type="button">مراجعة</button></td></tr>').join('')||'<tr><td colspan="5">لا توجد أوراق مطابقة.</td></tr>';
 $('sessionProgress').textContent=session?(session.completed_at?'جلسة منتهية · ':'')+'تم التحقق من '+ar(sheets.filter(s=>s.reviewed_at).length)+' من '+ar(session.expected_count)+' ورقة':'';
 renderButtons();
}
async function open(i){
 if(busy||!sheets[i])return;
 const p=firstPending();if(p>=0&&i>p){i=p;message('يجب التحقق من الورقة السابقة قبل الانتقال.');}
 active=i;loadedImage=null;const s=sheets[i],a=effective(s);
 $('modalTitle').textContent=a.student_name+' — نموذج '+a.model;
 $('modalSub').textContent='الورقة '+ar(i+1)+' من '+ar(sheets.length)+' · الدرجة '+ar(a.score)+' / '+ar(a.total)+' · '+status(s)+' · رفع '+new Date(s.uploaded_at).toLocaleString('ar-SA');
 $('scanImage').removeAttribute('src');$('scanImage').alt='جارٍ تحميل الورقة كاملة…';
 $('manualAssignmentWrap').classList.add('hidden');
 $('answerEditor').innerHTML=a.answers.map(x=>{
   const original=s.snapshot.answers[x.question-1],originalText=original.marked.length?original.marked.map(j=>letters[j]).join(' + '):'فارغة';
   return '<div class="answer-row-edit state-'+x.state+'"><div><b>س '+ar(x.question)+'</b><small>'+labels[x.state]+' · '+(x.reviewed_manually?'معدلة يدويًا':'ثقة القراءة '+ar(Math.round(x.confidence*100))+'٪')+'</small>'+(x.reviewed_manually?'<small class="original-answer">القراءة الأصلية: '+esc(originalText)+' — '+labels[original.state]+'</small>':'')+'</div><div class="choice-buttons" aria-label="تعديل إجابة السؤال '+x.question+'">'+letters.map((l,j)=>'<button type="button" data-edit-question="'+x.question+'" data-choice="'+j+'" aria-pressed="'+x.marked.includes(j)+'" class="readonly-choice '+(x.marked.includes(j)?'selected':'')+'">'+l+'</button>').join('')+'<button type="button" data-edit-question="'+x.question+'" data-choice="blank" class="blank-choice" aria-pressed="'+(x.marked.length===0)+'">فارغة</button></div></div>';
 }).join('');
 $('sheetEditHistory').innerHTML='';$('editHistoryDetails').open=false;
 $('editMode').disabled=!!session?.completed_at;
 $('sheetWarning').textContent=!a.identity_valid?'تعذر تأكيد هوية الورقة من QR؛ ستُحفظ للمراجعة دون اعتماد درجة. أعد المسح بعد التحقق من الورقة.':!a.markers_ok||a.counts.uncertain?'توجد قراءة غير مؤكدة؛ يمكنك تعديل الإجابات بعد فحص الصورة، أو طلب إعادة المسح.':s.blocked_duplicate?'هذه نسخة مكررة؛ ستبقى في السجل ولن تُحتسب درجة إضافية.':duplicate(s)?'إعادة رفع بعد ورقة طلبت إعادة مسحها؛ يبقى تنبيه التكرار محفوظًا.':'';
 $('duplicateConfirm').classList.toggle('hidden',!duplicate(s));
 $('duplicateCheck').checked=!!s.reviewed_at;$('verifiedCheck').checked=!!s.reviewed_at;
 $('verifiedCheck').disabled=!!s.reviewed_at;$('duplicateCheck').disabled=!!s.reviewed_at;
 $('sheetModal').classList.remove('hidden');renderButtons();
 try{let src=imageCache.get(s.id);if(!src){const data=await api('teacher_scan_image',{sheet_id:s.id});src=data.image_data;if(imageCache.size>5)imageCache.delete(imageCache.keys().next().value);imageCache.set(s.id,src);}if(sheets[active]?.id===s.id){$('scanImage').onload=()=>{loadedImage=s.id;renderButtons();};$('scanImage').src=src;$('scanImage').alt='ورقة '+a.student_name+' كاملة — اضغط للتكبير';}}
 catch(e){message('تعذر تحميل الصورة: '+e.message,true);$('saveSheetBtn').disabled=true;}
}
async function editAnswer(question,choice){
 const sheet=sheets[active];if(busy||!ready()||!sheet||loadedImage!==sheet.id||session.completed_at)return;
 const a=effective(sheet).answers[question-1];if(!a)return;
 let marked=[];
 if(choice!=='blank'){
   const value=Number(choice);
   marked=$('editMode').checked?(a.marked.includes(value)?a.marked.filter(v=>v!==value):[...a.marked,value].sort()):[value];
 }
 lock(true);let refresh=false;
 try{
   const r=await api('teacher_scan_edit_answer',{sheet_id:sheet.id,question,marked,answer_version:sheet.answer_version||0,request_id:crypto.randomUUID()});
   sheets[active]=r.sheet;render();refresh=true;
   message('حُفظ تعديل السؤال '+ar(question)+' وتحدث اللون والدرجة. أعد حفظ التحقق من الورقة قبل الانتقال.');
 }catch(e){message('تعذر حفظ التعديل: '+e.message,true);try{const r=await api('teacher_scan_list');session=r.session;sheets=r.sheets;render();refresh=true;}catch(_){}}
 finally{lock(false);if(refresh)await open(active);}
}
async function editHistory(){
 const s=sheets[active];if(!s||busy)return;
 try{const r=await api('teacher_scan_edit_history',{sheet_id:s.id});
 const mark=a=>a.marked?.length?a.marked.map(j=>letters[j]).join(' + '):'فارغة';
 $('sheetEditHistory').innerHTML=r.edits.length?r.edits.map(e=>'<p>س '+ar(e.question)+': '+esc(mark(e.before_answer))+' ← '+esc(mark(e.after_answer))+' · '+new Date(e.created_at).toLocaleString('ar-SA')+'<small>المراجع: '+esc(e.reviewer_id)+' · تعديل '+ar(e.answer_version)+'</small></p>').join(''):'لا توجد تعديلات على الورقة.';
 $('editHistoryDetails').open=true;
 }catch(e){message('تعذر عرض سجل التعديلات: '+e.message,true);}
}
async function verify(){
 if(busy||$('saveSheetBtn').disabled)return;lock(true);
 try{const r=await api('teacher_scan_verify',{sheet_id:sheets[active].id,acknowledge_duplicate:$('duplicateCheck').checked,answer_version:sheets[active].answer_version||0});sheets[active]=r.sheet;$('modalSub').textContent='الورقة '+ar(active+1)+' من '+ar(sheets.length)+' · الدرجة '+ar(effective(r.sheet).score)+' / '+ar(effective(r.sheet).total)+' · '+status(r.sheet);message('حُفظ التحقق من الورقة. يمكنك الانتقال إلى التالية.');render();}
 catch(e){message('لم يُحفظ التحقق: '+e.message,true);}finally{lock(false);}
}
async function finish(){
 if(busy||$('finishReviewBtn').disabled)return;lock(true);
 try{const r=await api('teacher_scan_finish');session=r.session;$('sheetModal').classList.add('hidden');message('تم المراجعة — سُجل وقت الإنهاء رسميًا. يمكنك اعتماد الأوراق المتحقق منها.');render();await sessions();}
 catch(e){message('تعذر إنهاء الجلسة: '+e.message,true);}finally{lock(false);}
}
async function refreshAlerts(){
 if(!draft)return;try{const r=await api('teacher_scan_alerts');alerts=r.alerts||[];
 $('alertLog').innerHTML=alerts.length?'<summary>سجل تنبيهات التكرار — أحدث '+ar(alerts.length)+' تنبيه</summary><div class="alert-list">'+alerts.map(a=>'<p><b>'+esc(a.sheet?.snapshot?.student_name)+'</b> · '+new Date(a.created_at).toLocaleString('ar-SA')+' · '+(a.kind==='same_image'?'نفس صورة الورقة':'نفس الطالب والاختبار')+' · '+(a.acknowledged_at?'تم الاطلاع':'بانتظار الاطلاع')+' <small>رقم التنبيه: '+esc(a.id)+'</small></p>').join('')+'</div>':'<summary>لا توجد تنبيهات تكرار لهذا الاختبار</summary>';
 }catch(e){message('تعذر تحديث التنبيهات: '+e.message,true);}
}
async function sessions(){
 const r=await api('teacher_scan_sessions');$('sessionPicker').innerHTML='<option value="">اختر جلسة محفوظة…</option>'+r.sessions.map(s=>'<option value="'+s.id+'" '+(s.id===session?.id?'selected':'')+'>'+new Date(s.created_at).toLocaleString('ar-SA')+' · '+ar(s.expected_count)+' ورقة · '+(s.completed_at?'منتهية':'مفتوحة')+'</option>').join('');
}
async function resume(id){
 if(!id||busy)return;lock(true);
 try{session={id};const r=await api('teacher_scan_list');session=r.session;sheets=r.sheets;active=-1;pending=null;imageCache.clear();render();message(ready()?'استُعيدت حالة المراجعة المحفوظة.':'الرفع غير مكتمل. أعد اختيار الملف الأصلي واضغط إعادة استكمال الرفع.');await refreshAlerts();}
 catch(e){message(e.message,true);}finally{lock(false);}
}
async function digestHex(data){const bytes=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function shaFile(file){return digestHex(await file.arrayBuffer());}
async function shaBatch(files){
 const parts=[];for(const f of files){parts.push([f.name,f.size,f.lastModified,await shaFile(f)].join('|'));}
 return digestHex(new TextEncoder().encode(parts.join('\n')));
}
async function upload(data,batch){
 if(busy)throw Error('انتظر اكتمال العملية الحالية.');
 if(!data.length)throw Error('لم يتم التعرف على أي ورقة قابلة للمراجعة.');
 if(data.length>400)throw Error('الحد الأقصى ٤٠٠ ورقة تظليل ناتجة من ٢٠٠ صفحة.');
 const inputFiles=[...(batch?.files||[])],meta=batch?.batchMeta||{};
 if(!inputFiles.length)throw Error('بيانات ملفات الدفعة غير متاحة.');
 if(!Number.isInteger(meta.totalPages)||meta.totalPages<1||meta.totalPages>200)throw Error('عدد صفحات الدفعة غير صالح.');
 const fileHash=await shaBatch(inputFiles);
 const resumeUpload=session&&!ready()&&session.file_hash===fileHash&&session.expected_count===data.length&&Number(session.expected_page_count||meta.totalPages)===meta.totalPages;
 const id=resumeUpload?session.id:crypto.randomUUID();
 pending={data,fileHash,id,meta:{expected_page_count:meta.totalPages,source_file_count:meta.sourceFileCount||inputFiles.length,batch_manifest:meta.manifest||[]}};await transfer();
}
async function transfer(){
 if(!pending||busy)return;lock(true);const p=pending;
 try{
 const r=await api('teacher_scan_start',{session_id:p.id,file_hash:p.fileHash,expected_count:p.data.length,...p.meta});session=r.session;
 const existing=await api('teacher_scan_list');sheets=existing.sheets;active=-1;
 const existingOrdinals=new Set(sheets.map(s=>s.ordinal)),chunkSize=4;
 for(let i=0;i<p.data.length;i+=chunkSize){
   const chunk=[];
   for(let j=i;j<Math.min(p.data.length,i+chunkSize);j++){
     if(existingOrdinals.has(j+1))continue;
     const x=p.data[j];
     chunk.push({ordinal:j+1,sheet_no:x.qr?.sheetNo,qr_valid:x.qrValid===true&&!x.identitySource,model:x.model,markers_ok:x.markersOk,answers:x.answers,image_data:x.fullImage||x.thumbnail,page_no:x.pageNo,region_no:x.regionNo,source_file_index:x.sourceFileIndex,source_file_name:x.sourceFileName,source_page_no:x.sourcePageNo,quality_score:x.quality?.score,quality_flags:x.quality?.flags||[]});
   }
   if(!chunk.length)continue;
   message('حفظ دفعة الأوراق '+ar(i+1)+'–'+ar(Math.min(p.data.length,i+chunkSize))+' من '+ar(p.data.length)+'…');
   const saved=await api('teacher_scan_register_batch',{sheets:chunk});
   for(const sh of saved.sheets||[]){if(!existingOrdinals.has(sh.ordinal)){existingOrdinals.add(sh.ordinal);sheets.push(sh);}}
   sheets.sort((x,y)=>x.ordinal-y.ordinal);render();
   if((saved.sheets||[]).some(duplicate))await refreshAlerts();
 }
 pending=null;render();await sessions();await refreshAlerts();message('حُفظت الدفعة كاملة. يمكنك تعديل أي إجابة، ثم حفظ التحقق من الورقة والانتقال بالترتيب.');
 }catch(e){message('توقف حفظ الدفعة: '+e.message+' — تقدمك محفوظ؛ اضغط إعادة استكمال الرفع.',true);throw e;}
 finally{lock(false);}
}
async function approve(){
 if(busy||$('approveBtn').disabled)return;lock(true);
 try{const r=await api('teacher_paper_review_save');$('approvedSection').classList.remove('hidden');$('indicatorSummary').textContent='تم اعتماد '+ar(r.saved_count)+' ورقة وربط نتائجها بالتحليل. النسخ المكررة والأوراق المطلوب إعادة مسحها مستبعدة.';for(const [id,page]of [['paperAnalysisLink','review-analysis.html'],['paperReportLink','review-report.html']])$(id).href=page+'?rid='+encodeURIComponent(draft.review_id);message('حُفظت النتائج في المنصة.');}
 catch(e){message('تعذر الاعتماد: '+e.message,true);}finally{lock(false);}
}
function download(rows,name){const safe=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const blob=new Blob(['\ufeff'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function report(){
 if(!draft)return;try{
 let all=[],cursor=0;do{const r=await api('teacher_scan_alerts',{cursor});all.push(...r.alerts);cursor=r.next_cursor;}while(cursor!==null);
 const rows=[['نوع السجل','معرف الورقة / التنبيه','الطالب','النموذج','وقت الرفع','وقت الرفع الأول','فارغ — أحمر','متعدد — أصفر','صحيح — أخضر','خاطئ','غير مؤكد','حالة المراجعة','وقت المراجعة','معرف المراجع','السؤال','قبل التعديل','بعد التعديل']];
 for(const s of sheets){const x=effective(s),c=x.counts;rows.push(['ملخص ورقة',s.id,x.student_name,x.model,s.uploaded_at,'',c.blank,c.multiple,c.correct,c.incorrect,c.uncertain,status(s),s.reviewed_at,s.reviewed_by]);}
 for(const a of all)rows.push(['تنبيه تكرار',a.id,a.sheet?.snapshot?.student_name,a.sheet?.snapshot?.model,a.sheet?.uploaded_at,a.original?.uploaded_at||a.original_uploaded_at,'','','','','',a.acknowledged_at?'تم الاطلاع — التنبيه محفوظ':'بانتظار الاطلاع',a.acknowledged_at,a.acknowledged_by]);
 for(const s of sheets){if(!(s.answer_version>0))continue;let cursor=0;do{const r=await api('teacher_scan_edit_history',{sheet_id:s.id,cursor});for(const e of r.edits)rows.push(['تعديل إجابة',e.id,s.snapshot.student_name,s.snapshot.model,s.uploaded_at,'','','','','','','تعديل محفوظ',e.created_at,e.reviewer_id,e.question,(e.before_answer.marked||[]).map(i=>letters[i]).join(' + ')||'فارغة',(e.after_answer.marked||[]).map(i=>letters[i]).join(' + ')||'فارغة']);cursor=r.next_cursor;}while(cursor!==null);}
 download(rows,'تقرير-مراجعة-الأوراق.csv');
 }catch(e){message('تعذر استخراج التقرير: '+e.message,true);}
}
async function init(p){draft=p;clearInterval(poll);await sessions();await refreshAlerts();poll=setInterval(()=>{if(!document.hidden&&!busy)refreshAlerts();},10000);}
$('answerEditor').onclick=e=>{const b=e.target.closest('[data-edit-question]');if(b&&!b.disabled)editAnswer(Number(b.dataset.editQuestion),b.dataset.choice);};
$('loadEditHistoryBtn').onclick=editHistory;
$('saveSheetBtn').onclick=verify;$('nextSheetBtn').onclick=()=>open(active+1);$('finishReviewBtn').onclick=finish;
$('closeModal').onclick=()=>$('sheetModal').classList.add('hidden');$('reviewNextBtn').onclick=()=>open(Math.max(0,firstPending()));
$('resultsBody').onclick=e=>{const b=e.target.closest('[data-open]');if(b)open(Number(b.dataset.open));};
$('verifiedCheck').onchange=renderButtons;$('duplicateCheck').onchange=renderButtons;$('alertFilter').onchange=render;
$('resumeSessionBtn').onclick=()=>resume($('sessionPicker').value);$('retryUploadBtn').onclick=()=>transfer().catch(()=>{});
$('approveBtn').onclick=approve;$('journalExportBtn').onclick=report;$('exportBtn').onclick=report;
$('scanImage').onclick=()=> $('scanImage').classList.toggle('zoomed');
addEventListener('nafes:auth-changed',e=>{if(!e.detail.authenticated){clearInterval(poll);session=null;sheets=[];imageCache.clear();$('sheetModal').classList.add('hidden');$('resultsSection').classList.add('hidden');$('summarySection').classList.add('hidden');$('alertLog').innerHTML='';}});
window.NafesScanJournal={init,upload,isBusy:()=>busy};
})();
