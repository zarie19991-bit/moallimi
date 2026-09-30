(()=>{
'use strict';
const $=id=>document.getElementById(id);
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const letters=['أ','ب','ج','د'];
let draft=null,file=null,results=[],activeIndex=-1;

function keyForModel(model){return draft?.answer_keys?.find(x=>x.model===model)?.answers||[];}
function assignmentBySheet(no){return draft?.assignments?.find(x=>Number(x.sheet_no)===Number(no))||null;}
function assignmentOptions(selected=''){return (draft?.assignments||[]).map(a=>'<option value="'+a.sheet_no+'" '+(String(a.sheet_no)===String(selected)?'selected':'')+'>'+a.student_name+' — نموذج '+a.model+'</option>').join('');}
function statusLabel(r){if(!r.qrValid)return['تعذر QR','bad'];if(r.unresolved>0)return['يحتاج مراجعة','warn'];return['جاهز','ok'];}
function setProgress(p,text){$('progressWrap').classList.remove('hidden');$('progressBar').style.width=Math.max(0,Math.min(100,p))+'%';$('progressText').textContent=text;}
function median(a){const b=[...a].sort((x,y)=>x-y),n=b.length;if(!n)return 0;return n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2;}
function cropCanvas(src,x,y,w,h){
 const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));
 c.getContext('2d',{willReadFrequently:true}).drawImage(src,x,y,w,h,0,0,c.width,c.height);return c;
}
function rotateCanvas(src,deg){
 const rad=((deg%360)+360)%360,c=document.createElement('canvas'),swap=rad===90||rad===270;
 c.width=swap?src.height:src.width;c.height=swap?src.width:src.height;const g=c.getContext('2d',{willReadFrequently:true});
 g.translate(c.width/2,c.height/2);g.rotate(rad*Math.PI/180);g.drawImage(src,-src.width/2,-src.height/2);return c;
}
function imageData(c){return c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);}
function qrDecode(c){
 if(typeof jsQR!=='function')return null;const d=imageData(c);const q=jsQR(d.data,d.width,d.height,{inversionAttempts:'attemptBoth'});return q?{data:q.data,location:q.location}:null;
}
function parseQr(raw){
 const m=String(raw||'').match(/^MR2\|([^|]+)\|(\d+)\|(.+)$/);if(!m)return null;
 return{version:2,reviewId:m[1],sheetNo:Number(m[2]),model:m[3]};
}
function normalizeOrientation(c){
 let out=c;if(out.height>out.width*1.05)out=rotateCanvas(out,90);
 let qr=qrDecode(out);if(qr){
   const ys=Object.values(qr.location||{}).filter(v=>v&&Number.isFinite(v.y)).map(v=>v.y);
   const cy=ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:0;
   if(cy>out.height*.58){out=rotateCanvas(out,180);qr=qrDecode(out);}
 }
 return{canvas:out,qr};
}
function integralDark(d){
 const w=d.width,h=d.height,ii=new Uint32Array((w+1)*(h+1));
 for(let y=1;y<=h;y++){let row=0;for(let x=1;x<=w;x++){const i=((y-1)*w+(x-1))*4;const gray=(d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114);row+=gray<85?1:0;ii[y*(w+1)+x]=ii[(y-1)*(w+1)+x]+row;}}
 return{ii,w,h};
}
function rectSum(I,x,y,w,h){const W=I.w+1,x1=Math.max(0,x),y1=Math.max(0,y),x2=Math.min(I.w,x+w),y2=Math.min(I.h,y+h);return I.ii[y2*W+x2]-I.ii[y1*W+x2]-I.ii[y2*W+x1]+I.ii[y1*W+x1];}
function findMarker(I,nx,ny){
 const size=Math.max(8,Math.round(I.w*(4/210))),half=Math.round(size/2),rx=Math.round(I.w*.10),ry=Math.round(I.h*.12);
 const cx=Math.round(I.w*nx),cy=Math.round(I.h*ny),step=Math.max(2,Math.floor(size/4));let best=null;
 for(let y=cy-ry;y<=cy+ry;y+=step)for(let x=cx-rx;x<=cx+rx;x+=step){
   const dark=rectSum(I,x-half,y-half,size,size),score=dark/(size*size);
   if(!best||score>best.score)best={x,y,score};
 }
 return best&&best.score>.52?best:null;
}
function detectMarkers(c){
 const d=imageData(c),I=integralDark(d);
 const pts={
   tl:findMarker(I,.092,.273),tr:findMarker(I,.911,.273),
   bl:findMarker(I,.092,.704),br:findMarker(I,.911,.704)
 };
 if(Object.values(pts).some(x=>!x))return null;
 return{...pts,image:d};
}
function mapTemplate(markers,x,y){
 const T=NafesOmrTemplate.markers,u=(x-T.tl[0])/(T.tr[0]-T.tl[0]),v=(y-T.tl[1])/(T.bl[1]-T.tl[1]);
 const top={x:markers.tl.x+(markers.tr.x-markers.tl.x)*u,y:markers.tl.y+(markers.tr.y-markers.tl.y)*u};
 const bot={x:markers.bl.x+(markers.br.x-markers.bl.x)*u,y:markers.bl.y+(markers.br.y-markers.bl.y)*u};
 return{x:top.x+(bot.x-top.x)*v,y:top.y+(bot.y-top.y)*v};
}
function darknessAt(d,cx,cy,r){
 const w=d.width,h=d.height;let sum=0,n=0,rr=r*r;
 for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
   if(x<0||y<0||x>=w||y>=h)continue;const dx=x-cx,dy=y-cy;if(dx*dx+dy*dy>rr)continue;
   const i=(y*w+x)*4,gray=d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114;sum+=(255-gray)/255;n++;
 }
 return n?sum/n:0;
}
function readAnswers(c,markers,total,startNo){
 const span=(Math.hypot(markers.tr.x-markers.tl.x,markers.tr.y-markers.tl.y)+Math.hypot(markers.br.x-markers.bl.x,markers.br.y-markers.bl.y))/2;
 const radius=Math.max(2.5,span*(1.05/172)),allScores=[],raw=[];
 for(let i=0;i<Math.min(total,20);i++){
   const scores=NafesOmrTemplate.answerPoints(i).map(p=>{const m=mapTemplate(markers,p.x,p.y);return darknessAt(markers.image,m.x,m.y,radius);});
   raw.push(scores);allScores.push(...scores);
 }
 const base=median(allScores),threshold=Math.min(.34,Math.max(.12,base+.095));
 return raw.map((scores,i)=>{
   const order=scores.map((s,j)=>({s,j})).sort((a,b)=>b.s-a.s),top=order[0],second=order[1];
   if(top.s<threshold)return{question:startNo+i,selected:null,status:'blank',scores};
   if(second.s>=Math.max(threshold*.92,top.s-.045))return{question:startNo+i,selected:top.j,status:'multiple',scores};
   if(top.s<threshold+.045)return{question:startNo+i,selected:top.j,status:'ambiguous',scores};
   return{question:startNo+i,selected:top.j,status:'clear',scores};
 });
}
function thumb(c){const w=520,h=Math.round(c.height*w/c.width),o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').drawImage(c,0,0,w,h);return o.toDataURL('image/jpeg',.68);}
function scoreResult(r){
 const key=keyForModel(r.model),start=Number(draft.question_start||1);let score=0,total=Math.min(Number(draft.question_count||20),key.length||20);
 r.answers.forEach((a,i)=>{const k=key[i];a.correctIndex=k?Number(k.correct_index):null;a.indicator=k?.indicator||'';a.correct=a.selected!==null&&a.correctIndex!==null&&Number(a.selected)===Number(a.correctIndex);if(a.correct)score++;});
 r.score=score;r.total=total;r.unresolved=r.answers.filter(a=>a.status==='multiple'||a.status==='ambiguous').length+(!r.qrValid?1:0);return r;
}
async function processRegion(c,pageNo,regionNo){
 const normed=normalizeOrientation(c),canvas=normed.canvas,qrRaw=normed.qr?.data||'',q=parseQr(qrRaw);
 const qrValid=!!q&&q.reviewId===draft.review_id,assignment=qrValid?assignmentBySheet(q.sheetNo):null,model=assignment?.model||q?.model||'';
 const markers=detectMarkers(canvas),answers=markers?readAnswers(canvas,markers,Number(draft.question_count||20),Number(draft.question_start||1)):[];
 const r={id:'p'+pageNo+'r'+regionNo,pageNo,regionNo,qrRaw,qr:q,qrValid,assignment,model,studentName:assignment?.student_name||'غير معروف',markersOk:!!markers,answers,thumbnail:thumb(canvas),unresolved:0,score:0,total:Number(draft.question_count||20)};
 if(!markers){r.unresolved++;r.error='تعذر تحديد علامات المحاذاة في ورقة التظليل.';}
 if(markers&&answers.length)scoreResult(r);return r;
}
async function canvasFromImage(file){
 const bmp=await createImageBitmap(file),c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d',{willReadFrequently:true}).drawImage(bmp,0,0);return c;
}
async function sourcePages(file){
 const out=[];
 if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
   pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
   const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
   for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:2}),c=document.createElement('canvas');c.width=Math.round(v.width);c.height=Math.round(v.height);await p.render({canvasContext:c.getContext('2d',{willReadFrequently:true}),viewport:v}).promise;out.push(c);}
 }else out.push(await canvasFromImage(file));
 return out;
}
function regionsForPage(c){
 const portrait=c.height/c.width>1.18;if(!portrait)return[c];
 const h=Math.floor(c.height/2);return[cropCanvas(c,0,0,c.width,h),cropCanvas(c,0,h,c.width,c.height-h)];
}
async function processFile(){
 if(!file||!draft)return;results=[];$('resultsSection').classList.add('hidden');$('approvedSection').classList.add('hidden');$('summarySection').classList.add('hidden');$('processBtn').disabled=true;
 try{
   setProgress(3,'قراءة الملف…');const pages=await sourcePages(file),totalRegions=pages.reduce((n,p)=>n+regionsForPage(p).length,0);let done=0;
   for(let pi=0;pi<pages.length;pi++){const regs=regionsForPage(pages[pi]);for(let ri=0;ri<regs.length;ri++){setProgress(5+90*done/Math.max(1,totalRegions),'الصفحة '+ar(pi+1)+' — قراءة الورقة '+ar(ri+1));const r=await processRegion(regs[ri],pi+1,ri+1);if(r.qrRaw||r.markersOk)results.push(r);done++;await new Promise(res=>setTimeout(res,0));}}
   setProgress(100,'اكتمل التحليل');renderResults();
 }catch(e){setProgress(0,'تعذر التحليل: '+e.message);}
 finally{$('processBtn').disabled=false;}
}
function renderSummary(){
 const total=results.length,identified=results.filter(r=>r.qrValid).length,ready=results.filter(r=>r.qrValid&&r.unresolved===0&&r.markersOk).length,review=results.filter(r=>r.unresolved>0).length,unknown=total-identified;
 const cards=[['الأوراق',total,''],['تم التعرف',identified,'ok'],['جاهزة',ready,'ok'],['تحتاج مراجعة',review,review?'warn':'ok'],['QR غير معروف',unknown,unknown?'bad':'ok']];
 $('summaryCards').innerHTML=cards.map(c=>'<div class="summary '+c[2]+'"><span>'+c[0]+'</span><b>'+ar(c[1])+'</b></div>').join('');$('summarySection').classList.remove('hidden');
}
function renderResults(){
 renderSummary();$('resultsBody').innerHTML=results.map((r,i)=>{const st=statusLabel(r);return'<tr class="'+(r.unresolved?'needs-review':'')+'"><td>'+r.studentName+'</td><td>'+(r.model||'—')+'</td><td>'+ar(r.score)+' / '+ar(r.total)+'</td><td><span class="badge '+st[1]+'">'+st[0]+'</span></td><td><button class="secondary" data-open="'+i+'" type="button">مراجعة</button></td></tr>';}).join('')||'<tr><td colspan="5">لم يتم العثور على أوراق تظليل قابلة للقراءة.</td></tr>';
 $('resultsSection').classList.remove('hidden');
}
function openModal(i){
 activeIndex=i;const r=results[i];if(!r)return;$('modalTitle').textContent=r.studentName+' — نموذج '+(r.model||'—');$('modalSub').textContent='الصفحة '+ar(r.pageNo)+' · الدرجة الحالية '+ar(r.score)+'/'+ar(r.total);$('scanImage').src=r.thumbnail;
 $('manualAssignmentWrap').classList.toggle('hidden',r.qrValid);$('manualAssignment').innerHTML='<option value="">اختر الطالب…</option>'+assignmentOptions(r.qr?.sheetNo||'');
 $('answerEditor').innerHTML=r.answers.map((a,idx)=>'<div class="answer-row-edit '+((a.status==='multiple'||a.status==='ambiguous')?'ambiguous':'')+'"><div><b>س '+ar(a.question)+'</b><small>'+(a.status==='multiple'?'تظليل مزدوج':a.status==='ambiguous'?'غير واضح':a.status==='blank'?'بدون إجابة':a.correct?'صحيح':'خطأ')+'</small></div><div class="choice-buttons">'+letters.map((l,j)=>'<button type="button" data-answer="'+idx+'" data-choice="'+j+'" class="'+(a.selected===j?'selected':'')+'">'+l+'</button>').join('')+'<button type="button" data-answer="'+idx+'" data-choice="-1" class="'+(a.selected===null?'selected':'')+'">—</button></div></div>').join('');
 $('sheetModal').classList.remove('hidden');
}
function saveModal(){
 const r=results[activeIndex];if(!r)return;
 if(!r.qrValid){const no=Number($('manualAssignment').value||0),a=assignmentBySheet(no);if(a){r.assignment=a;r.model=a.model;r.studentName=a.student_name;r.qrValid=true;r.qr={reviewId:draft.review_id,sheetNo:no,model:a.model,manual:true};}}
 r.answers.forEach(a=>{if(a.status==='multiple'||a.status==='ambiguous')a.status='manual';});scoreResult(r);$('sheetModal').classList.add('hidden');renderResults();
}
async function approve(){
 const unresolved=results.filter(r=>!r.qrValid||!r.markersOk||r.answers.some(a=>a.status==='multiple'||a.status==='ambiguous'));
 if(unresolved.length){openModal(results.indexOf(unresolved[0]));return;}
 const payload={review_id:draft.review_id,title:draft.title,approved_at:new Date().toISOString(),results:results.map(r=>({student_id:r.assignment?.student_id||'',student_name:r.studentName,model:r.model,score:r.score,total:r.total,answers:r.answers.map(a=>({question:a.question,selected:a.selected,correct_index:a.correctIndex,correct:a.correct,indicator:a.indicator,status:a.status}))}))};
 const btn=$('approveBtn');btn.disabled=true;btn.textContent='جارٍ حفظ النتائج في المنصة…';
 try{
   const saved=await NafesTeacher.api('teacher_paper_review_save',{
     review_id:draft.review_id,title:draft.title,subject:draft.subject,class_name:draft.class_name,
     indicator_counts:draft.indicator_counts||[],models:draft.models||[],answer_keys:draft.answer_keys||[],results:payload.results
   });
   payload.platform=saved;localStorage.setItem('nafes_review_scan_results_'+draft.review_id,JSON.stringify(payload));renderApproved(payload);
 }catch(e){alert('تعذر اعتماد النتائج في المنصة: '+e.message);}
 finally{btn.disabled=false;btn.textContent='اعتماد النتائج';}
}
function renderApproved(payload){
 const map=new Map();for(const r of payload.results)for(const a of r.answers){if(!a.indicator)continue;const x=map.get(a.indicator)||{correct:0,total:0};x.total++;if(a.correct)x.correct++;map.set(a.indicator,x);}
 $('indicatorSummary').innerHTML=[...map].map(([k,v])=>'<div class="indicator-item"><b>'+k+'</b><span>'+ar(v.correct)+' من '+ar(v.total)+' · '+ar(Math.round(v.correct*100/Math.max(1,v.total)))+'%</span></div>').join('')||'<div>تم حفظ النتائج.</div>';$('approvedSection').classList.remove('hidden');$('approvedSection').scrollIntoView({behavior:'smooth'});
}
function exportCsv(){
 const saved=JSON.parse(localStorage.getItem('nafes_review_scan_results_'+draft.review_id)||'null');if(!saved)return;const rows=[['اسم الطالب','النموذج','الدرجة','المجموع']];saved.results.forEach(r=>rows.push([r.student_name,r.model,r.score,r.total]));const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(draft.title||'نتائج المراجعة')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function init(){
 draft=await (window.NafesPaperReviewDraft?.load?.()||Promise.resolve(null));if(!draft){$('noDraft').classList.remove('hidden');$('processBtn').disabled=true;return;}$('reviewMeta').textContent=(draft.title||'مراجعة')+' · '+(draft.assignments?.length||0)+' طالب';
 if(!NafesTeacher?.getKey())NafesTeacher.requireKey('أدخل مفتاح المعلم لرفع أوراق الطلاب وتصحيحها.');
 const saved=JSON.parse(localStorage.getItem('nafes_review_scan_results_'+draft.review_id)||'null');if(saved)renderApproved(saved);
}
$('fileInput').addEventListener('change',e=>{file=e.target.files?.[0]||null;$('processBtn').disabled=!file;$('dropzone').querySelector('b').textContent=file?file.name:'اختر PDF أو اسحبه هنا';});
$('processBtn').onclick=processFile;$('clearBtn').onclick=()=>{file=null;$('fileInput').value='';$('processBtn').disabled=true;$('dropzone').querySelector('b').textContent='اختر PDF أو اسحبه هنا';$('progressWrap').classList.add('hidden');};
['dragenter','dragover'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.add('drag');}));['dragleave','drop'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{$('dropzone').classList.remove('drag');if(ev==='drop'){e.preventDefault();file=e.dataTransfer.files?.[0]||null;$('processBtn').disabled=!file;$('dropzone').querySelector('b').textContent=file?file.name:'اختر PDF أو اسحبه هنا';}}));
$('resultsBody').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)openModal(Number(b.dataset.open));});
$('answerEditor').addEventListener('click',e=>{const b=e.target.closest('[data-answer]');if(!b||activeIndex<0)return;const a=results[activeIndex].answers[Number(b.dataset.answer)],choice=Number(b.dataset.choice);a.selected=choice<0?null:choice;a.status='manual';scoreResult(results[activeIndex]);openModal(activeIndex);});
$('saveSheetBtn').onclick=saveModal;$('closeModal').onclick=()=>$('sheetModal').classList.add('hidden');$('reviewNextBtn').onclick=()=>{const i=results.findIndex(r=>r.unresolved>0);if(i>=0)openModal(i);};$('approveBtn').onclick=approve;$('exportBtn').onclick=exportCsv;
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)init();});
init();
})();