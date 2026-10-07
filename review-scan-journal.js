/* Original scans are immutable; reviewer changes are versioned and audited server-side. */
(()=>{'use strict';
const $=id=>document.getElementById(id),ar=n=>new Intl.NumberFormat('ar-SA').format(n||0);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={blank:'غير محلول',multiple:'إجابات متعددة',correct:'صحيح مؤكد',incorrect:'إجابة خاطئة',uncertain:'قراءة غير مؤكدة'};
const letters=['أ','ب','ج','د'];
let draft=null,session=null,sheets=[],reviewInventory=[],active=-1,busy=false,pending=null,alerts=[],deletions=[],selected=new Set(),imageCache=new Map(),poll=null,loadedImage=null;
const api=(action,b={})=>NafesTeacher.api(action,{review_id:draft.review_id,session_id:session?.id,...b});
const effective=s=>s.effective_snapshot||s.snapshot;
const duplicate=s=>!!(s.duplicate_of||s.duplicate_legacy_at);
const status=s=>s.disposition==='duplicate'?'مراجَع — نسخة مكررة':s.disposition==='requires_rescan'?'مراجَع — يلزم إعادة المسح':s.reviewed_at?'تم التحقق':'بانتظار التحقق';
function message(t,error=false){$('journalStatus').textContent=t;$('journalStatus').className='notice '+(error?'error':'');if($('modalFeedback')){$('modalFeedback').textContent=t;$('modalFeedback').className=error?'notice error':'notice';}}
function firstPending(){return sheets.findIndex(s=>!s.reviewed_at);}
function ready(){return session&&sheets.length===session.expected_count;}
function lock(value){busy=value;for(const id of ['saveSheetBtn','nextSheetBtn','finishReviewBtn','approveBtn','processBtn','clearBtn','sessionPicker','resumeSessionBtn','retryUploadBtn','deleteSelectedBtn','applyManualAssignmentBtn','rereadAllBtn'])if($(id))$(id).disabled=value;renderButtons();}
function ensureSelectAll(){
 let box=$('selectAllSheets');
 if(!box){
   const toolbar=document.querySelector('.review-toolbar');if(!toolbar)return;
   const label=document.createElement('label');label.innerHTML='<input id="selectAllSheets" type="checkbox"> تحديد الكل';
   toolbar.appendChild(label);box=label.querySelector('input');
 }
 if(box&&!box.dataset.bound){
   box.dataset.bound='1';
   box.addEventListener('change',()=>toggleSelectAll());
 }
 const btn=$('selectAllBtn');
 if(btn&&!btn.dataset.bound){
   btn.dataset.bound='1';
   btn.addEventListener('click',toggleSelectAll);
 }
}
function renderButtons(){
 const s=sheets[active];
 $('saveSheetBtn').disabled=busy||!ready()||!s||loadedImage!==s.id||!!s.reviewed_at||!$('verifiedCheck').checked||(duplicate(s)&&!$('duplicateCheck').checked);
 $('nextSheetBtn').disabled=busy||!s?.reviewed_at||active>=sheets.length-1;
 $('finishReviewBtn').disabled=busy||!ready()||firstPending()>=0||!!session.completed_at;
 $('approveBtn').disabled=busy||!session?.completed_at||!sheets.some(s=>s.disposition==='verified');
 if($('deleteSelectedBtn')){$('deleteSelectedBtn').disabled=busy||selected.size===0;$('deleteSelectedBtn').textContent=selected.size?'حذف التصحيحات المحددة ('+ar(selected.size)+')':'حذف التصحيحات المحددة';}if($('selectAllBtn')){$('selectAllBtn').disabled=busy||!sheets.length;$('selectAllBtn').textContent=sheets.length&&selected.size===sheets.length?'إلغاء تحديد الكل':'تحديد الكل';}
 if($('applyManualAssignmentBtn'))$('applyManualAssignmentBtn').disabled=busy||!s||effective(s).identity_valid===true||!!session?.completed_at||!$('manualAssignment')?.value;
 document.querySelectorAll('[data-edit-question]').forEach(b=>{b.disabled=busy||!ready()||!s||loadedImage!==s.id||!!session?.completed_at;});
 $('retryUploadBtn').classList.toggle('hidden',!pending);
}
function render(){
 ensureSelectAll();
 $('resultsSection').classList.remove('hidden');$('summarySection').classList.remove('hidden');
 const count=sheets.reduce((m,s)=>{for(const [k,v]of Object.entries(effective(s).counts))m[k]=(m[k]||0)+v;return m;},{});
 $('summaryCards').innerHTML=[['الأوراق',sheets.length],['تمت مراجعتها',sheets.filter(s=>s.reviewed_at).length],['تنبيهات التكرار',sheets.filter(s=>duplicate(s)).length],...Object.entries(labels).map(([k,l])=>[l,count[k]||0])].map(([l,n])=>'<div class="summary"><span>'+l+'</span><b>'+ar(n)+'</b></div>').join('');
 const only=$('alertFilter').checked;
 $('resultsBody').innerHTML=sheets.map((s,i)=>({s,i,a:effective(s)})).filter(({s})=>!only||duplicate(s)).map(({s,i,a})=>'<tr><td><input type="checkbox" data-select-sheet="'+esc(s.id)+'" '+(selected.has(s.id)?'checked':'')+' aria-label="تحديد تصحيح '+esc(a.student_name)+'"></td><td>'+esc(a.student_name)+'</td><td>'+esc(a.model)+'</td><td>'+ar(a.score)+' / '+ar(a.total)+'</td><td>'+esc(status(s))+(duplicate(s)?' <strong class="duplicate-label">رفع مكرر</strong>':'')+(!a.identity_valid?' <strong class="duplicate-label">الاسم غير مؤكد</strong>':'')+'</td><td><button class="secondary" data-open="'+i+'" type="button">مراجعة</button> '+(!a.identity_valid?'<button class="secondary" data-recover-identity="'+esc(s.id)+'" type="button">إعادة قراءة الاسم</button> ':'')+'<button class="secondary" data-delete-sheet="'+esc(s.id)+'" type="button">حذف التصحيح</button></td></tr>').join('')||'<tr><td colspan="6">لا توجد أوراق مطابقة.</td></tr>';
 $('sessionProgress').textContent=session?(session.completed_at?'جلسة منتهية · ':'')+'تم التحقق من '+ar(sheets.filter(s=>s.reviewed_at).length)+' من '+ar(session.expected_count)+' ورقة':'';
 if($('selectAllSheets')){$('selectAllSheets').checked=sheets.length>0&&selected.size===sheets.length;$('selectAllSheets').indeterminate=selected.size>0&&selected.size<sheets.length;}
 renderButtons();
}
async function open(i){
 if(busy||!sheets[i])return;
 const p=firstPending();if(p>=0&&i>p){i=p;message('يجب التحقق من الورقة السابقة قبل الانتقال.');}
 active=i;loadedImage=null;const s=sheets[i],a=effective(s);
 $('modalTitle').textContent=a.student_name+' — نموذج '+a.model;
 $('modalSub').textContent='الورقة '+ar(i+1)+' من '+ar(sheets.length)+' · الدرجة '+ar(a.score)+' / '+ar(a.total)+' · '+status(s)+' · رفع '+new Date(s.uploaded_at).toLocaleString('ar-SA');
 $('scanImage').removeAttribute('src');$('scanImage').alt='جارٍ تحميل الورقة كاملة…';
 if(!a.identity_valid){
   const used=new Set(sheets.filter(x=>x.id!==s.id&&x.student_id).map(x=>String(x.student_id)));
   const options=(draft.assignments||[]).map(x=>'<option value="'+esc(x.student_id)+'" '+(used.has(String(x.student_id))?'disabled':'')+'>'+esc(x.student_name)+' — نموذج '+esc(x.model)+(used.has(String(x.student_id))?' (مرتبط بورقة أخرى)':'')+'</option>').join('');
   $('manualAssignment').innerHTML='<option value="">اختر الطالب…</option>'+options;
   $('manualAssignmentWrap').classList.remove('hidden');
 }else $('manualAssignmentWrap').classList.add('hidden');
 $('answerEditor').innerHTML=a.answers.map(x=>{
   const original=s.snapshot.answers[x.question-1],originalText=original.marked.length?original.marked.map(j=>letters[j]).join(' + '):'فارغة';
   return '<div class="answer-row-edit state-'+x.state+'"><div><b>س '+ar(x.question)+'</b><small>'+labels[x.state]+' · '+(x.reviewed_manually?'معدلة يدويًا':'ثقة القراءة '+ar(Math.round(x.confidence*100))+'٪')+'</small>'+(x.reviewed_manually?'<small class="original-answer">القراءة الأصلية: '+esc(originalText)+' — '+labels[original.state]+'</small>':'')+'</div><div class="choice-buttons" aria-label="تعديل إجابة السؤال '+x.question+'">'+letters.map((l,j)=>'<button type="button" data-edit-question="'+x.question+'" data-choice="'+j+'" aria-pressed="'+x.marked.includes(j)+'" class="readonly-choice '+(x.marked.includes(j)?'selected':'')+'">'+l+'</button>').join('')+'<button type="button" data-edit-question="'+x.question+'" data-choice="blank" class="blank-choice" aria-pressed="'+(x.marked.length===0)+'">فارغة</button></div></div>';
 }).join('');
 $('sheetEditHistory').innerHTML='';$('editHistoryDetails').open=false;
 $('editMode').disabled=!!session?.completed_at;
 $('sheetWarning').textContent=!a.identity_valid?'تعذر تأكيد هوية الورقة من QR. اختر الطالب من القائمة بعد مطابقة الاسم الظاهر على الورقة؛ لن تعتمد النتيجة قبل تأكيد الهوية.':!a.markers_ok||a.counts.uncertain?'توجد قراءة غير مؤكدة؛ يمكنك تعديل الإجابات بعد فحص الصورة، أو طلب إعادة المسح.':s.blocked_duplicate?'هذه نسخة مكررة؛ ستبقى في السجل ولن تُحتسب درجة إضافية.':duplicate(s)?'إعادة رفع بعد ورقة طلبت إعادة مسحها؛ يبقى تنبيه التكرار محفوظًا.':'';
 $('duplicateConfirm').classList.toggle('hidden',!duplicate(s));
 $('duplicateCheck').checked=!!s.reviewed_at;$('verifiedCheck').checked=!!s.reviewed_at;
 $('verifiedCheck').disabled=!!s.reviewed_at;$('duplicateCheck').disabled=!!s.reviewed_at;
 $('sheetModal').classList.remove('hidden');renderButtons();
 try{let src=imageCache.get(s.id);if(!src){const data=await api('teacher_scan_image',{sheet_id:s.id});src=data.image_data;if(imageCache.size>5)imageCache.delete(imageCache.keys().next().value);imageCache.set(s.id,src);}if(sheets[active]?.id===s.id){$('scanImage').onload=()=>{loadedImage=s.id;renderButtons();};$('scanImage').src=src;$('scanImage').alt='ورقة '+a.student_name+' كاملة — اضغط للتكبير';}}
 catch(e){message('تعذر تحميل الصورة: '+e.message,true);$('saveSheetBtn').disabled=true;}
}
async function recoverIdentity(sheetId){
 const i=sheets.findIndex(x=>x.id===sheetId),sheet=sheets[i];if(i<0||!sheet||busy)return;
 lock(true);
 try{
   let src=imageCache.get(sheet.id);
   if(!src){const data=await api('teacher_scan_image',{sheet_id:sheet.id});src=data.image_data;imageCache.set(sheet.id,src);}
   const q=await window.NafesScanReader?.decodeStoredIdentity?.(src);
   if(!q)throw new Error('لم يتمكن القارئ المحسن من العثور على QR في الصورة المحفوظة.');
   if(q.reviewId!==draft.review_id)throw new Error('رمز الورقة يعود إلى مراجعة مختلفة.');
   const assignment=(draft.assignments||[]).find(a=>Number(a.sheet_no)===Number(q.sheetNo)&&String(a.model)===String(q.model));
   if(!assignment)throw new Error('تمت قراءة QR لكن لم تتم مطابقة الطالب أو النموذج في هذه المراجعة.');
   const r=await api('teacher_scan_assign_identity',{sheet_id:sheet.id,student_id:assignment.student_id,answer_version:sheet.answer_version||0});
   sheets[i]=r.sheet;selected.delete(sheet.id);render();message('تمت استعادة اسم الطالب تلقائيًا من QR المحفوظ: '+assignment.student_name);
 }catch(e){message('تعذر استعادة الاسم تلقائيًا: '+e.message,true);}
 finally{lock(false);}
}
async function rereadAllStrict(){
 if(busy)return;
 if(!confirm('سيعاد تحليل التظليل لكل ورقة ذات هوية مؤكدة بخوارزمية صارمة. أي إجابة غير مؤكدة لن تُحتسب تلقائيًا. هل تريد المتابعة؟'))return;
 lock(true);
 let processed=0,skippedIdentity=0,uncertainSheets=0,failed=0;
 try{
   const sr=await api('teacher_scan_sessions'),sessionsList=sr.sessions||[];
   for(let si=0;si<sessionsList.length;si++){
     const sid=sessionsList[si].id;
     const lr=await api('teacher_scan_list',{session_id:sid}),list=lr.sheets||[];
     for(let i=0;i<list.length;i++){
       const sh=list[i],eff=effective(sh);
       if(eff?.identity_valid!==true||!sh.student_id){skippedIdentity++;continue;}
       try{
         message('إعادة قراءة دقيقة: '+ar(processed+1)+' · الورقة '+ar(i+1)+' من '+ar(list.length)+' · الجلسة '+ar(si+1)+' من '+ar(sessionsList.length));
         const im=await api('teacher_scan_image',{session_id:sid,sheet_id:sh.id});
         const rr=await window.NafesScanReader.readStoredOmr(im.image_data,Number(eff.total||draft.question_count||0),Number(draft.question_start||1));
         const saved=await api('teacher_scan_reclassify',{session_id:sid,sheet_id:sh.id,answer_version:sh.answer_version||0,answers:rr.answers,markers_ok:rr.markers_ok,marker_confidence:rr.marker_confidence});
         processed++;if(Number(saved.unresolved||0)>0)uncertainSheets++;
       }catch(e){failed++;}
     }
   }
   reviewInventory=[];selected.clear();
   if(session?.id){
     const fresh=await api('teacher_scan_list',{session_id:session.id});session=fresh.session;sheets=fresh.sheets||[];render();
   }
   message('اكتملت إعادة القراءة الصارمة: '+ar(processed)+' ورقة أعيد تحليلها، '+ar(uncertainSheets)+' بها إجابات تحتاج مراجعة، '+ar(skippedIdentity)+' ورقة هويتها غير مؤكدة ولم تُحسب، '+ar(failed)+' تعذر تحليلها ولم تُمنح قراءة وهمية.');
 }catch(e){message('تعذرت إعادة القراءة الشاملة: '+e.message,true);}
 finally{lock(false);}
}
async function assignIdentity(){
 const sheet=sheets[active],studentId=$('manualAssignment')?.value;
 if(busy||!sheet||!studentId||effective(sheet).identity_valid||session?.completed_at)return;
 if(!confirm('سيتم ربط هذه الورقة بالطالب المحدد وإعادة احتساب الدرجة وفق نموذج الطالب. هل أنت متأكد؟'))return;
 lock(true);
 try{
   const r=await api('teacher_scan_assign_identity',{sheet_id:sheet.id,student_id:studentId,answer_version:sheet.answer_version||0});
   sheets[active]=r.sheet;selected.delete(sheet.id);render();message('تم تأكيد اسم الطالب وإعادة ربط الإجابات بالنموذج الصحيح.');
   await open(active);
 }catch(e){message('تعذر تأكيد اسم الطالب: '+e.message,true);}
 finally{lock(false);}
}
async function refreshDeletionLog(){
 if(!draft)return;
 try{
   const r=await api('teacher_scan_deletion_log');deletions=r.deletions||[];
   $('deleteLog').innerHTML=deletions.length?'<summary>سجل حذف التصحيحات — أحدث '+ar(deletions.length)+' عملية</summary><div class="alert-list">'+deletions.map(d=>'<p><b>'+esc(d.student_name||'ورقة بلا اسم')+'</b> · '+new Date(d.deleted_at).toLocaleString('ar-SA')+' · '+esc(d.reason)+' · '+(d.had_published_attempt?'حُذفت النتيجة المعتمدة المرتبطة أيضًا':'لا توجد نتيجة معتمدة مرتبطة')+' <small>رقم العملية: '+esc(d.batch_id)+'</small></p>').join('')+'</div>':'<summary>لا توجد عمليات حذف مسجلة</summary>';
 }catch(e){message('تعذر تحميل سجل الحذف: '+e.message,true);}
}
async function loadReviewInventory(){
 const sr=await api('teacher_scan_sessions'),all=[];
 for(const se of sr.sessions||[]){
   const r=await api('teacher_scan_list',{session_id:se.id});
   for(const sh of r.sheets||[])all.push(sh);
 }
 reviewInventory=all;return all;
}
async function toggleSelectAll(){
 if(busy)return;
 lock(true);
 try{
   const all=await loadReviewInventory();
   if(!all.length){selected.clear();message('لا توجد تصحيحات في هذا الاختبار.',true);return;}
   const allSelected=all.every(x=>selected.has(String(x.id)));
   selected.clear();
   if(!allSelected)all.forEach(x=>selected.add(String(x.id)));
   document.querySelectorAll('#resultsBody [data-select-sheet]').forEach(c=>{c.checked=!allSelected;});
   if($('selectAllSheets')){$('selectAllSheets').checked=!allSelected;$('selectAllSheets').indeterminate=false;}
   renderButtons();
   const sessionCount=new Set(all.map(x=>x.session_id)).size;
   message(allSelected?'تم إلغاء تحديد جميع الأوراق.':'تم تحديد جميع التصحيحات: '+ar(all.length)+' ورقة عبر '+ar(sessionCount)+' جلسة.');
 }catch(e){message('تعذر تحديد جميع التصحيحات: '+e.message,true);}
 finally{lock(false);}
}
async function deleteCorrections(ids){
 let source=reviewInventory.length?reviewInventory:sheets;
 const wanted=[...new Set((ids||[]).map(String))];
 if(wanted.some(id=>!source.some(s=>String(s.id)===id))){
   try{source=await loadReviewInventory();}catch(_){}
 }
 const unique=wanted.filter(id=>source.some(s=>String(s.id)===id));
 if(!unique.length||busy)return;
 const reason=prompt('اكتب سبب حذف التصحيح (مثال: رفع خاطئ أو ورقة مكررة):','رفع أو تصحيح غير صحيح');
 if(reason===null)return;
 if(reason.trim().length<3){message('لم يتم الحذف: سبب الحذف مطلوب.',true);return;}
 const names=unique.slice(0,12).map(id=>effective(source.find(s=>String(s.id)===id)).student_name).join('، ')+(unique.length>12?' …':'');
 if(!confirm('سيتم حذف '+ar(unique.length)+' تصحيح فعليًا، وإزالة أي نتيجة معتمدة مرتبطة به، مع الاحتفاظ بسجل تدقيق فقط.\n\n'+names+'\n\nهل تريد المتابعة؟'))return;
 lock(true);
 try{
   const groups=new Map();
   for(const id of unique){
     const sh=source.find(x=>String(x.id)===id),sid=String(sh?.session_id||session?.id||'');
     if(!sid)continue;
     if(!groups.has(sid))groups.set(sid,[]);
     groups.get(sid).push(id);
   }
   let deleted=0,currentResult=null;
   for(const [sid,group] of groups){
     const r=await api('teacher_scan_delete',{session_id:sid,sheet_ids:group,reason:reason.trim(),confirm:true,request_id:crypto.randomUUID()});
     deleted+=Number(r.deleted_count||0);
     if(session?.id===sid)currentResult=r;
   }
   unique.forEach(id=>{selected.delete(String(id));imageCache.delete(String(id));});
   reviewInventory=reviewInventory.filter(x=>!unique.includes(String(x.id)));
   $('sheetModal').classList.add('hidden');active=-1;
   const sr=await api('teacher_scan_sessions');
   if(!(sr.sessions||[]).length){
     session=null;sheets=[];$('resultsSection').classList.add('hidden');$('summarySection').classList.add('hidden');
     message('تم حذف جميع التصحيحات في الاختبار: '+ar(deleted)+' ورقة.');
   }else{
     const keep=(sr.sessions||[]).find(x=>x.id===session?.id)||(sr.sessions||[])[0];
     session={id:keep.id};
     const rr=await api('teacher_scan_list',{session_id:keep.id});session=rr.session;sheets=rr.sheets;render();
     message('تم حذف '+ar(deleted)+' تصحيح عبر جميع الجلسات المحددة.');
   }
   await sessions();await refreshAlerts();await refreshDeletionLog();
 }catch(e){message('تعذر حذف التصحيح: '+e.message,true);}
 finally{lock(false);}
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
async function shaFiles(files){
 const list=Array.from(files||[]);if(!list.length)throw Error('لم يتم اختيار ملفات.');
 const enc=new TextEncoder(),parts=[];
 for(const file of list){
   const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
   parts.push(file.name+'|'+file.size+'|'+file.lastModified+'|'+[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join(''));
 }
 const bytes=await crypto.subtle.digest('SHA-256',enc.encode(parts.join('\n')));
 return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function streamHash(files){
 const enc=new TextEncoder(),meta=Array.from(files||[]).map(f=>[f.name,f.size,f.lastModified,f.type].join('|')).join('\n');
 const bytes=await crypto.subtle.digest('SHA-256',enc.encode(meta));
 return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function beginStream(files){
 const fileHash=await streamHash(files),id=crypto.randomUUID();
 const r=await api('teacher_scan_start',{session_id:id,file_hash:fileHash,expected_count:1});
 session=r.session;sheets=[];active=-1;pending=null;imageCache.clear();render();
 return {session_id:id,file_hash:fileHash};
}
async function appendStream(x,ordinal){
 if(!session?.id)throw Error('جلسة الحفظ غير جاهزة.');
 const r=await api('teacher_scan_register',{sheet:{ordinal,sheet_no:x.qr?.sheetNo,qr_valid:x.qrValid===true&&!x.identitySource,model:x.model,markers_ok:x.markersOk,answers:x.answers,image_data:x.fullImage,page_no:x.pageNo,region_no:x.regionNo}});
 sheets.push(r.sheet);
 if(duplicate(r.sheet)){$('duplicateLive').textContent='تنبيه فوري: تكرر رفع ورقة '+r.sheet.snapshot.student_name+'؛ سُجلت الحالة.';}
 return r.sheet;
}
async function finalizeStream(actualCount){
 if(!session?.id)throw Error('جلسة الحفظ غير جاهزة.');
 const r=await api('teacher_scan_finalize_upload',{actual_count:actualCount});
 session=r.session;sheets=r.sheets||[];render();await sessions();await refreshAlerts();
 return r;
}
async function upload(data,files){
 if(busy)throw Error('انتظر اكتمال العملية الحالية.');
 if(!data.length)throw Error('لم يتم التعرف على أي ورقة قابلة للمراجعة.');
 if(data.length>200)throw Error('الحد الأقصى ٢٠٠ صفحة/ورقة في الدفعة الواحدة.');
 const fileHash=await shaFiles(files);
 // Resume only an incomplete transfer of the same file. A completed transfer is a new upload event.
 const resumeUpload=session&&!ready()&&session.file_hash===fileHash&&session.expected_count===data.length;
 const id=resumeUpload?session.id:crypto.randomUUID();
 pending={data,fileHash,id};await transfer();
}
async function transfer(){
 if(!pending||busy)return;lock(true);const p=pending;
 try{
 const r=await api('teacher_scan_start',{session_id:p.id,file_hash:p.fileHash,expected_count:p.data.length});session=r.session;
 const existing=await api('teacher_scan_list');sheets=existing.sheets;active=-1;
 for(let i=0;i<p.data.length;i++){
   if(sheets.some(s=>s.ordinal===i+1))continue;
   const x=p.data[i];message('حفظ الورقة '+ar(i+1)+' من '+ar(p.data.length)+'…');
   const r=await api('teacher_scan_register',{sheet:{ordinal:i+1,sheet_no:x.qr?.sheetNo,qr_valid:x.qrValid===true&&!x.identitySource,model:x.model,markers_ok:x.markersOk,answers:x.answers,image_data:x.fullImage||x.thumbnail,page_no:x.pageNo,region_no:x.regionNo}});
   sheets.push(r.sheet);render();
   if(duplicate(r.sheet)){$('duplicateLive').textContent='تنبيه فوري: تكرر رفع ورقة '+r.sheet.snapshot.student_name+'؛ سُجلت الحالة في قسم المراجعة.';await refreshAlerts();}
 }
 pending=null;render();await sessions();await refreshAlerts();message('حُفظت الأوراق. يمكنك تعديل أي إجابة، ثم حفظ التحقق من الورقة والانتقال بالترتيب.');
 }catch(e){message('توقف الحفظ: '+e.message+' — تقدمك محفوظ؛ اضغط إعادة استكمال الرفع.',true);throw e;}
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
async function init(p){draft=p;clearInterval(poll);await sessions();await refreshAlerts();await refreshDeletionLog();poll=setInterval(()=>{if(!document.hidden&&!busy){refreshAlerts();refreshDeletionLog();}},10000);}
$('answerEditor').onclick=e=>{const b=e.target.closest('[data-edit-question]');if(b&&!b.disabled)editAnswer(Number(b.dataset.editQuestion),b.dataset.choice);};
$('manualAssignment').onchange=renderButtons;$('applyManualAssignmentBtn').onclick=assignIdentity;$('rereadAllBtn').onclick=rereadAllStrict;
$('loadEditHistoryBtn').onclick=editHistory;
$('saveSheetBtn').onclick=verify;$('nextSheetBtn').onclick=()=>open(active+1);$('finishReviewBtn').onclick=finish;
$('closeModal').onclick=()=>$('sheetModal').classList.add('hidden');$('reviewNextBtn').onclick=()=>open(Math.max(0,firstPending()));
$('resultsBody').onclick=e=>{
 const openBtn=e.target.closest('[data-open]');if(openBtn){open(Number(openBtn.dataset.open));return;}
 const recover=e.target.closest('[data-recover-identity]');if(recover){recoverIdentity(recover.dataset.recoverIdentity);return;} const del=e.target.closest('[data-delete-sheet]');if(del)deleteCorrections([del.dataset.deleteSheet]);
};
$('resultsBody').onchange=e=>{
 const c=e.target.closest('[data-select-sheet]');if(!c)return;
 c.checked?selected.add(String(c.dataset.selectSheet)):selected.delete(String(c.dataset.selectSheet));
 if($('selectAllSheets')){
   const checked=document.querySelectorAll('#resultsBody [data-select-sheet]:checked').length;
   const total=document.querySelectorAll('#resultsBody [data-select-sheet]').length;
   $('selectAllSheets').checked=total>0&&checked===total;
   $('selectAllSheets').indeterminate=checked>0&&checked<total;
 }
 renderButtons();
};
$('deleteSelectedBtn').onclick=()=>deleteCorrections([...selected]);
$('verifiedCheck').onchange=renderButtons;$('duplicateCheck').onchange=renderButtons;$('alertFilter').onchange=render;
$('resumeSessionBtn').onclick=()=>resume($('sessionPicker').value);$('retryUploadBtn').onclick=()=>transfer().catch(()=>{});
$('approveBtn').onclick=approve;$('journalExportBtn').onclick=report;$('exportBtn').onclick=report;
$('scanImage').onclick=()=> $('scanImage').classList.toggle('zoomed');
addEventListener('nafes:auth-changed',e=>{if(!e.detail.authenticated){clearInterval(poll);session=null;sheets=[];selected.clear();imageCache.clear();$('sheetModal').classList.add('hidden');$('resultsSection').classList.add('hidden');$('summarySection').classList.add('hidden');$('alertLog').innerHTML='';$('deleteLog').innerHTML='';}});
window.NafesScanJournal={init,upload,isBusy:()=>busy,toggleSelectAll,beginStream,appendStream,finalizeStream};
})();
