(()=>{
'use strict';
const $=id=>document.getElementById(id);
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const letters=['أ','ب','ج','د'];
let draft=null,file=null,results=[],activeIndex=-1,studentRoster=[],ocrWorkerPromise=null;

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
 const m=String(raw||'').match(/^MR(2|3|4)\|([^|]+)\|(\d+)\|(.+)$/);if(!m)return null;
 return{version:Number(m[1]),reviewId:m[2],sheetNo:Number(m[3]),model:m[4]};
}
function normalizeOrientation(c){
 let out=c.height>=c.width?c:rotateCanvas(c,90);
 let qr=qrDecode(out);
 if(!qr){
   const flipped=rotateCanvas(out,180),q2=qrDecode(flipped);
   if(q2){out=flipped;qr=q2;}
 }
 if(qr){
   const ys=Object.values(qr.location||{}).filter(v=>v&&Number.isFinite(v.y)).map(v=>v.y);
   const cy=ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:0;
   if(cy<out.height*.18&&parseQr(qr.data)?.version===3){
     const flipped=rotateCanvas(out,180),q2=qrDecode(flipped);
     if(q2){out=flipped;qr=q2;}
   }
 }
 return{canvas:out,qr};
}
function integralDark(d){
 const w=d.width,h=d.height,ii=new Uint32Array((w+1)*(h+1));
 for(let y=1;y<=h;y++){let row=0;for(let x=1;x<=w;x++){const i=((y-1)*w+(x-1))*4;const gray=(d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114);row+=gray<105?1:0;ii[y*(w+1)+x]=ii[(y-1)*(w+1)+x]+row;}}
 return{ii,w,h};
}
function rectSum(I,x,y,w,h){const W=I.w+1,x1=Math.max(0,x),y1=Math.max(0,y),x2=Math.min(I.w,x+w),y2=Math.min(I.h,y+h);return I.ii[y2*W+x2]-I.ii[y1*W+x2]-I.ii[y2*W+x1]+I.ii[y1*W+x1];}
function markerWorkCanvas(src){
 const maxW=1400;
 if(src.width<=maxW)return{canvas:src,sx:1,sy:1};
 const scale=maxW/src.width,c=document.createElement('canvas');
 c.width=Math.round(src.width*scale);c.height=Math.round(src.height*scale);
 c.getContext('2d',{willReadFrequently:true}).drawImage(src,0,0,c.width,c.height);
 return{canvas:c,sx:src.width/c.width,sy:src.height/c.height};
}
function markerCandidates(c){
 const d=imageData(c),I=integralDark(d),raw=[];
 const sizes=[.007,.010,.013,.017,.022,.028].map(f=>Math.max(7,Math.round(I.w*f)));
 for(const size of sizes){
   const half=Math.floor(size/2),step=Math.max(3,Math.floor(size/2));
   for(let y=half;y<I.h-half;y+=step)for(let x=half;x<I.w-half;x+=step){
     const score=rectSum(I,x-half,y-half,size,size)/(size*size);
     if(score>=.72)raw.push({x,y,size,score});
   }
 }
 raw.sort((a,b)=>b.score-a.score);
 const out=[];
 for(const p of raw){
   if(out.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<Math.max(p.size,q.size)*1.4))continue;
   out.push(p);if(out.length>=120)break;
 }
 return out;
}
function detectMarkerSets(src){
 const prep=markerWorkCanvas(src),c=prep.canvas,cands=markerCandidates(c),rows=[],T=NafesOmrTemplate.markers,target=(T.tr[0]-T.tl[0])/(T.bl[1]-T.tl[1]);
 for(let i=0;i<cands.length;i++)for(let j=i+1;j<cands.length;j++){
   let a=cands[i],b=cands[j];if(a.x>b.x){const t=a;a=b;b=t;}
   const dx=b.x-a.x;if(dx<c.width*.32||Math.abs(a.y-b.y)>c.height*.04)continue;
   rows.push({l:a,r:b,y:(a.y+b.y)/2,dx,ink:(a.score+b.score)/2});
 }
 const rects=[];
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
   let top=rows[i],bottom=rows[j];if(top.y>bottom.y){const t=top;top=bottom;bottom=t;}
   const dy=bottom.y-top.y;if(dy<c.height*.10)continue;
   if(Math.abs(top.l.x-bottom.l.x)>c.width*.045||Math.abs(top.r.x-bottom.r.x)>c.width*.045)continue;
   const dx=(top.dx+bottom.dx)/2,aspect=dx/dy,aspectErr=Math.abs(Math.log(aspect/target));
   if(aspectErr>.28)continue;
   const area=(dx*dy)/(c.width*c.height);
   rects.push({top,bottom,score:area+(top.ink+bottom.ink)*.12-aspectErr*.35});
 }
 rects.sort((a,b)=>b.score-a.score);
 const chosen=[];
 for(const r of rects){
   const center={x:(r.top.l.x+r.top.r.x+r.bottom.l.x+r.bottom.r.x)/4,y:(r.top.y+r.bottom.y)/2};
   const dx=(r.top.dx+r.bottom.dx)/2,dy=r.bottom.y-r.top.y;
   const sharesMarkerRow=chosen.some(s=>{
     const ys=[s.r.top.y,s.r.bottom.y],ry=[r.top.y,r.bottom.y],tol=Math.max(8,Math.min(dy,s.dy)*.08);
     return ry.some(y=>ys.some(sy=>Math.abs(y-sy)<tol));
   });
   if(sharesMarkerRow)continue;
   if(chosen.some(s=>Math.abs(center.x-s.center.x)<Math.min(dx,s.dx)*.25&&Math.abs(center.y-s.center.y)<Math.min(dy,s.dy)*.55))continue;
   chosen.push({r,center,dx,dy});if(chosen.length>=8)break;
 }
 return chosen.map(x=>({
   tl:{x:x.r.top.l.x*prep.sx,y:x.r.top.l.y*prep.sy,score:x.r.top.l.score},
   tr:{x:x.r.top.r.x*prep.sx,y:x.r.top.r.y*prep.sy,score:x.r.top.r.score},
   bl:{x:x.r.bottom.l.x*prep.sx,y:x.r.bottom.l.y*prep.sy,score:x.r.bottom.l.score},
   br:{x:x.r.bottom.r.x*prep.sx,y:x.r.bottom.r.y*prep.sy,score:x.r.bottom.r.score}
 })).sort((a,b)=>Math.min(a.tl.y,a.tr.y)-Math.min(b.tl.y,b.tr.y)||Math.min(a.tl.x,a.bl.x)-Math.min(b.tl.x,b.bl.x));
}
function detectMarkers(c){
 const pts=detectMarkerSets(c)[0];if(!pts)return null;
 return{...pts,image:imageData(c)};
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
 const radius=Math.max(2.5,span*(1.08/Math.max(1,NafesOmrTemplate.markers.tr[0]-NafesOmrTemplate.markers.tl[0]))),allScores=[],raw=[];
 for(let i=0;i<Math.min(total,NafesOmrTemplate.maxQuestions||60);i++){
   const scores=NafesOmrTemplate.answerPoints(i,total).map(p=>{const m=mapTemplate(markers,p.x,p.y);return darknessAt(markers.image,m.x,m.y,radius);});
   raw.push(scores);allScores.push(...scores);
 }
 const base=median(allScores),threshold=Math.min(.34,Math.max(.12,base+.095)),clamp=v=>Math.max(0,Math.min(1,v));
 return raw.map((scores,i)=>{
   const order=scores.map((s,j)=>({s,j})).sort((a,b)=>b.s-a.s),top=order[0],second=order[1];
   const separation=Math.max(0,top.s-second.s),signal=top.s-threshold;
   if(top.s<threshold){
     const confidence=clamp((threshold-top.s)/.08);
     return{question:startNo+i,selected:null,status:'blank',scores,confidence:Number(confidence.toFixed(3)),topScore:top.s,secondScore:second.s,threshold,separation};
   }
   const confidence=clamp(.58*Math.max(0,signal)/.16+.42*separation/.10);
   if(second.s>=Math.max(threshold*.92,top.s-.045))return{question:startNo+i,selected:top.j,status:'multiple',scores,confidence:Number(Math.min(.49,confidence).toFixed(3)),topScore:top.s,secondScore:second.s,threshold,separation};
   if(top.s<threshold+.045||confidence<.72)return{question:startNo+i,selected:top.j,status:'ambiguous',scores,confidence:Number(confidence.toFixed(3)),topScore:top.s,secondScore:second.s,threshold,separation};
   return{question:startNo+i,selected:top.j,status:'clear',scores,confidence:Number(confidence.toFixed(3)),topScore:top.s,secondScore:second.s,threshold,separation};
 });
}
function thumb(c){const w=520,h=Math.round(c.height*w/c.width),o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').drawImage(c,0,0,w,h);return o.toDataURL('image/jpeg',.68);}
function normalizeArabic(v){
 return String(v||'').normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\u0621-\u063A\u0641-\u064A0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}
function editDistance(a,b){
 a=String(a||'');b=String(b||'');const prev=Array.from({length:b.length+1},(_,i)=>i),cur=new Array(b.length+1);
 for(let i=1;i<=a.length;i++){cur[0]=i;for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));for(let j=0;j<=b.length;j++)prev[j]=cur[j];}
 return prev[b.length];
}
function nameMatchScore(name,text){
 const n=normalizeArabic(name),t=normalizeArabic(text);if(!n||!t)return 0;if(t.includes(n))return 1;
 const tokens=n.split(' ').filter(x=>x.length>1),tt=t.split(' ').filter(x=>x.length>1);
 let covered=0;
 for(const tok of tokens){
   let best=0;for(const x of tt){const d=editDistance(tok,x),s=1-d/Math.max(tok.length,x.length,1);if(s>best)best=s;}
   if(best>=.72)covered+=best;
 }
 const tokenScore=tokens.length?covered/tokens.length:0;
 const lines=String(text||'').split(/[\n\r]+/).map(normalizeArabic).filter(Boolean);let lineScore=0;
 for(const line of lines){const d=editDistance(n,line),s=1-d/Math.max(n.length,line.length,1);if(s>lineScore)lineScore=s;}
 return Math.max(tokenScore,lineScore);
}
function ocrWorker(){
 if(!window.Tesseract?.createWorker)return Promise.resolve(null);
 if(!ocrWorkerPromise)ocrWorkerPromise=Tesseract.createWorker('ara').catch(()=>null);
 return ocrWorkerPromise;
}
async function inferNameFromPrintedHeader(canvas){
 const candidates=new Map();
 for(const a of (draft?.assignments||[])){if(a.student_name)candidates.set(normalizeArabic(a.student_name),{name:a.student_name,id:a.student_id||'',assignment:a});}
 for(const s of studentRoster){const name=s.full_name||s.student_name||'';if(name&&!candidates.has(normalizeArabic(name)))candidates.set(normalizeArabic(name),{name,id:s.id||'',assignment:null});}
 if(!candidates.size)return null;
 const header=cropCanvas(canvas,0,0,canvas.width,Math.max(1,Math.round(canvas.height*.34)));
 const worker=await ocrWorker();if(!worker)return null;
 try{
   const out=await worker.recognize(header),text=out?.data?.text||'';if(!text.trim())return null;
   const ranked=[...candidates.values()].map(x=>({...x,score:nameMatchScore(x.name,text)})).sort((a,b)=>b.score-a.score);
   const best=ranked[0],second=ranked[1];
   if(!best||best.score<.62||(second&&best.score-second.score<.07))return null;
   return{...best,text};
 }catch(_){return null;}
}
function scoreResult(r){
 const key=keyForModel(r.model),start=Number(draft.question_start||1);let score=0,total=Math.min(Number(draft.question_count||20),key.length||20);
 r.answers.forEach((a,i)=>{const k=key[i];a.correctIndex=k?Number(k.correct_index):null;a.indicator=k?.indicator||'';a.correct=a.selected!==null&&a.correctIndex!==null&&Number(a.selected)===Number(a.correctIndex);if(a.correct)score++;});
 const confs=r.answers.map(a=>Number(a.originalConfidence??a.confidence)).filter(Number.isFinite),clearConfs=r.answers.filter(a=>a.status==='clear'||a.status==='manual').map(a=>Number(a.originalConfidence??a.confidence)).filter(Number.isFinite);
 const avg=confs.length?confs.reduce((s,x)=>s+x,0)/confs.length:0,minClear=clearConfs.length?Math.min(...clearConfs):0;
 const manual=r.answers.filter(a=>a.status==='manual'||a.manualChanged===true).length;
 const low=r.answers.filter(a=>Number.isFinite(Number(a.originalConfidence??a.confidence))&&Number(a.originalConfidence??a.confidence)<.80).length;
 r.score=score;r.total=total;
 r.unresolved=r.answers.filter(a=>a.status==='multiple'||a.status==='ambiguous').length+(!r.qrValid?1:0);
 r.omr={confidence:Number(avg.toFixed(3)),min_clear_confidence:Number(minClear.toFixed(3)),marker_confidence:Number(r.markerConfidence||0),manual_answers:manual,low_confidence_answers:low,answer_count:r.answers.length,auto_accept:!!r.qrValid&&!!r.markersOk&&r.unresolved===0&&manual===0&&avg>=.95&&minClear>=.90};
 return r;
}
async function processRegion(c,pageNo,regionNo){
 const normed=normalizeOrientation(c),canvas=normed.canvas,qrRaw=normed.qr?.data||'',q=parseQr(qrRaw);
 const qrValid=!!q&&q.reviewId===draft.review_id,assignment=qrValid?assignmentBySheet(q.sheetNo):null,model=assignment?.model||q?.model||'';
 const markers=detectMarkers(canvas),answers=markers?readAnswers(canvas,markers,Number(draft.question_count||20),Number(draft.question_start||1)):[];
 const markerScores=markers?[markers.tl?.score,markers.tr?.score,markers.bl?.score,markers.br?.score].map(Number).filter(Number.isFinite):[];
 const markerConfidence=markerScores.length?Math.max(0,Math.min(1,(markerScores.reduce((s,x)=>s+x,0)/markerScores.length-.70)/.30)):0;
 const r={id:'p'+pageNo+'r'+regionNo,pageNo,regionNo,qrRaw,qr:q,qrValid,assignment,model,studentName:assignment?.student_name||'غير معروف',markersOk:!!markers,markerConfidence:Number(markerConfidence.toFixed(3)),answers,thumbnail:thumb(canvas),unresolved:0,score:0,total:Number(draft.question_count||20),sourceCanvas:canvas};
 if(!markers){r.unresolved++;r.error='تعذر تحديد علامات المحاذاة في ورقة التظليل.';}
 if(markers&&answers.length)scoreResult(r);return r;
}
function assignLegacySheetsByOrder(){
 const unidentified=results.filter(r=>!r.qrValid&&r.markersOk).sort((a,b)=>a.pageNo-b.pageNo||a.regionNo-b.regionNo);
 if(!unidentified.length)return;
 const byNo=new Map((draft?.assignments||[]).map(a=>[Number(a.sheet_no),a]));
 const alreadyUsed=new Set(results.filter(r=>r.qrValid&&r.assignment).map(r=>Number(r.assignment.sheet_no)));
 for(const r of unidentified){
   const expectedNo=(Number(r.pageNo)-1)*2+Number(r.regionNo);
   let a=byNo.get(expectedNo);
   if(!a||alreadyUsed.has(Number(a.sheet_no))){
     a=(draft?.assignments||[]).find(x=>!alreadyUsed.has(Number(x.sheet_no)))||null;
   }
   if(!a)continue;
   alreadyUsed.add(Number(a.sheet_no));
   r.assignment=a;r.model=a.model;r.studentName=a.student_name;r.qrValid=true;
   r.identitySource='print-order';
   r.qr={reviewId:draft.review_id,sheetNo:Number(a.sheet_no),model:a.model,legacyOrder:true};
   if(r.answers.length)scoreResult(r);
 }
}
async function recoverLegacyNamesByOcr(){
 const targets=results.filter(r=>r.markersOk&&(!r.studentName||r.studentName==='غير معروف'));
 if(!targets.length)return;
 let done=0;
 for(const r of targets){
   setProgress(92+Math.round(6*done/Math.max(1,targets.length)),'قراءة اسم الطالب من الورقة '+ar(done+1)+' من '+ar(targets.length)+'…');
   const hit=await inferNameFromPrintedHeader(r.sourceCanvas);
   if(hit){
     r.studentName=hit.name;r.identitySource='header-ocr';
     let a=hit.assignment;
     if(!a)a=(draft?.assignments||[]).find(x=>normalizeArabic(x.student_name)===normalizeArabic(hit.name))||null;
     if(a){r.assignment=a;r.model=a.model;r.qrValid=true;r.qr={reviewId:draft.review_id,sheetNo:Number(a.sheet_no),model:a.model,legacyOcr:true};if(r.answers.length)scoreResult(r);}
   }
   done++;await new Promise(res=>setTimeout(res,0));
 }
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
function cropAroundMarkers(c,m){
 const left=Math.min(m.tl.x,m.bl.x),right=Math.max(m.tr.x,m.br.x),top=Math.min(m.tl.y,m.tr.y),bottom=Math.max(m.bl.y,m.br.y);
 const dx=Math.max(1,right-left),dy=Math.max(1,bottom-top);
 const x=Math.max(0,left-dx*.10),y=Math.max(0,top-dy*.78),x2=Math.min(c.width,right+dx*.10),y2=Math.min(c.height,bottom+dy*.55);
 return cropCanvas(c,x,y,x2-x,y2-y);
}
function regionsForPage(c){
 let page=c,sets=detectMarkerSets(page);
 if(!sets.length&&c.width>c.height){page=rotateCanvas(c,90);sets=detectMarkerSets(page);}
 if(sets.length){
   const ordered=[...sets].sort((a,b)=>Math.min(a.tl.y,a.tr.y)-Math.min(b.tl.y,b.tr.y));
   if(ordered.length===1)return[page];
   return ordered.slice(0,2).map(m=>cropAroundMarkers(page,m));
 }
 const portrait=page.height/page.width>1.18;if(!portrait)return[page];
 return[page];
}
async function processFile(){
 if(!file||!draft)return;results=[];$('resultsSection').classList.add('hidden');$('approvedSection').classList.add('hidden');$('summarySection').classList.add('hidden');$('processBtn').disabled=true;
 try{
   setProgress(3,'قراءة الملف…');const pages=await sourcePages(file),totalRegions=pages.reduce((n,p)=>n+regionsForPage(p).length,0);let done=0;
   for(let pi=0;pi<pages.length;pi++){const regs=regionsForPage(pages[pi]);for(let ri=0;ri<regs.length;ri++){setProgress(5+90*done/Math.max(1,totalRegions),'الصفحة '+ar(pi+1)+' — قراءة الورقة '+ar(ri+1));const r=await processRegion(regs[ri],pi+1,ri+1);if(r.qrRaw||r.markersOk)results.push(r);done++;await new Promise(res=>setTimeout(res,0));}}
   assignLegacySheetsByOrder();
   await recoverLegacyNamesByOcr();
   results.forEach(r=>{delete r.sourceCanvas;});
   setProgress(100,'اكتمل التحليل');renderResults();
 }catch(e){setProgress(0,'تعذر التحليل: '+e.message);}
 finally{$('processBtn').disabled=false;}
}
function renderSummary(){
 const total=results.length,identified=results.filter(r=>r.qrValid).length,ready=results.filter(r=>r.qrValid&&r.unresolved===0&&r.markersOk).length,review=results.filter(r=>r.unresolved>0).length,unknown=total-identified;
 const confs=results.map(r=>Number(r.omr?.confidence)).filter(Number.isFinite),avgConf=confs.length?Math.round(confs.reduce((s,x)=>s+x,0)*100/confs.length):0,auto=results.filter(r=>r.omr?.auto_accept).length;
 const cards=[['الأوراق',total,''],['تم التعرف',identified,'ok'],['جاهزة',ready,'ok'],['تحتاج مراجعة',review,review?'warn':'ok'],['QR غير معروف',unknown,unknown?'bad':'ok'],['ثقة OMR',avgConf+'٪',avgConf>=95?'ok':avgConf>=80?'warn':'bad'],['قبول آلي ≥95٪',auto,auto===ready&&ready?'ok':'']];
 $('summaryCards').innerHTML=cards.map(c=>'<div class="summary '+c[2]+'"><span>'+c[0]+'</span><b>'+(/٪/.test(String(c[1]))?c[1]:ar(c[1]))+'</b></div>').join('');$('summarySection').classList.remove('hidden');
}
function renderResults(){
 renderSummary();$('resultsBody').innerHTML=results.map((r,i)=>{const st=statusLabel(r);return'<tr class="'+(r.unresolved?'needs-review':'')+'"><td>'+r.studentName+'</td><td>'+(r.model||'—')+'</td><td>'+ar(r.score)+' / '+ar(r.total)+'</td><td><span class="badge '+st[1]+'">'+st[0]+'</span></td><td><button class="secondary" data-open="'+i+'" type="button">مراجعة</button></td></tr>';}).join('')||'<tr><td colspan="5">لم يتم العثور على أوراق تظليل قابلة للقراءة.</td></tr>';
 $('resultsSection').classList.remove('hidden');
}
function openModal(i){
 activeIndex=i;const r=results[i];if(!r)return;$('modalTitle').textContent=r.studentName+' — نموذج '+(r.model||'—');$('modalSub').textContent='الصفحة '+ar(r.pageNo)+' · الدرجة الحالية '+ar(r.score)+'/'+ar(r.total)+' · ثقة OMR '+ar(Math.round(Number(r.omr?.confidence||0)*100))+'٪';$('scanImage').src=r.thumbnail;
 $('manualAssignmentWrap').classList.toggle('hidden',r.qrValid);$('manualAssignment').innerHTML='<option value="">اختر الطالب…</option>'+assignmentOptions(r.qr?.sheetNo||'');
 $('answerEditor').innerHTML=r.answers.map((a,idx)=>'<div class="answer-row-edit '+((a.status==='multiple'||a.status==='ambiguous')?'ambiguous':'')+'"><div><b>س '+ar(a.question)+'</b><small>'+(a.status==='multiple'?'تظليل مزدوج':a.status==='ambiguous'?'غير واضح':a.status==='blank'?'بدون إجابة':a.correct?'صحيح':'خطأ')+' · ثقة '+ar(Math.round(Number(a.confidence||0)*100))+'٪</small></div><div class="choice-buttons">'+letters.map((l,j)=>'<button type="button" data-answer="'+idx+'" data-choice="'+j+'" class="'+(a.selected===j?'selected':'')+'">'+l+'</button>').join('')+'<button type="button" data-answer="'+idx+'" data-choice="-1" class="'+(a.selected===null?'selected':'')+'">—</button></div></div>').join('');
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
 const payload={review_id:draft.review_id,title:draft.title,approved_at:new Date().toISOString(),results:results.map(r=>({student_id:r.assignment?.student_id||'',student_name:r.studentName,model:r.model,score:r.score,total:r.total,omr:r.omr||null,answers:r.answers.map(a=>({question:a.question,selected:a.selected,correct_index:a.correctIndex,correct:a.correct,indicator:a.indicator,status:a.status,original_status:a.originalStatus||a.status,confidence:Number(a.originalConfidence??a.confidence??0),manual_changed:a.manualChanged===true}))}))};
 const btn=$('approveBtn');btn.disabled=true;btn.textContent='جارٍ حفظ النتائج في المنصة…';
 try{
   const saved=await NafesTeacher.api('teacher_paper_review_save',{
     review_id:draft.review_id,title:draft.title,subject:draft.subject,subjects:draft.subjects||[draft.subject],class_name:draft.class_name,
     question_count:draft.question_count,model_count:draft.model_count,assignments:draft.assignments||[],
     indicator_counts:draft.indicator_counts||[],models:draft.models||[],answer_keys:draft.answer_keys||[],results:payload.results
   });
   payload.platform=saved;localStorage.setItem('nafes_review_scan_results_'+draft.review_id,JSON.stringify(payload));renderApproved(payload);
 }catch(e){alert('تعذر اعتماد النتائج في المنصة: '+e.message);}
 finally{btn.disabled=false;btn.textContent='اعتماد النتائج';}
}
function renderApproved(payload){
 const rid=encodeURIComponent(draft?.review_id||payload?.review_id||'');
 if($('paperAnalysisLink'))$('paperAnalysisLink').href='review-analysis.html?rid='+rid;
 if($('paperReportLink'))$('paperReportLink').href='review-report.html?rid='+rid;
 const map=new Map();for(const r of payload.results)for(const a of r.answers){if(!a.indicator)continue;const x=map.get(a.indicator)||{correct:0,total:0};x.total++;if(a.correct)x.correct++;map.set(a.indicator,x);}
 $('indicatorSummary').innerHTML=[...map].map(([k,v])=>'<div class="indicator-item"><b>'+k+'</b><span>'+ar(v.correct)+' من '+ar(v.total)+' · '+ar(Math.round(v.correct*100/Math.max(1,v.total)))+'%</span></div>').join('')||'<div>تم حفظ النتائج.</div>';$('approvedSection').classList.remove('hidden');$('approvedSection').scrollIntoView({behavior:'smooth'});
}
function exportCsv(){
 const saved=JSON.parse(localStorage.getItem('nafes_review_scan_results_'+draft.review_id)||'null');if(!saved)return;const rows=[['اسم الطالب','النموذج','الدرجة','المجموع']];saved.results.forEach(r=>rows.push([r.student_name,r.model,r.score,r.total]));const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(draft.title||'نتائج المراجعة')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function init(){
 draft=await (window.NafesPaperReviewDraft?.load?.()||Promise.resolve(null));if(!draft){$('noDraft').classList.remove('hidden');$('processBtn').disabled=true;return;}const subjectNames={reading:'القراءة',math:'الرياضيات',science:'العلوم'},subs=(Array.isArray(draft.subjects)&&draft.subjects.length?draft.subjects:[draft.subject]).filter(Boolean);$('reviewMeta').textContent=(draft.title||'مراجعة')+' · '+subs.map(x=>subjectNames[x]||x).join(' + ')+' · '+(draft.assignments?.length||0)+' طالب';
 if(!NafesTeacher?.getKey())NafesTeacher.requireKey('أدخل مفتاح المعلم لرفع أوراق الطلاب وتصحيحها.');
 try{const stu=await NafesTeacher.api('teacher_students_list',{include_archived:false});studentRoster=stu.students||[];}catch(_){studentRoster=[];}
 const saved=JSON.parse(localStorage.getItem('nafes_review_scan_results_'+draft.review_id)||'null');if(saved)renderApproved(saved);
}
$('fileInput').addEventListener('change',e=>{file=e.target.files?.[0]||null;$('processBtn').disabled=!file;$('dropzone').querySelector('b').textContent=file?file.name:'اختر PDF أو اسحبه هنا';});
$('processBtn').onclick=processFile;$('clearBtn').onclick=()=>{file=null;$('fileInput').value='';$('processBtn').disabled=true;$('dropzone').querySelector('b').textContent='اختر PDF أو اسحبه هنا';$('progressWrap').classList.add('hidden');};
['dragenter','dragover'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.add('drag');}));['dragleave','drop'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{$('dropzone').classList.remove('drag');if(ev==='drop'){e.preventDefault();file=e.dataTransfer.files?.[0]||null;$('processBtn').disabled=!file;$('dropzone').querySelector('b').textContent=file?file.name:'اختر PDF أو اسحبه هنا';}}));
$('resultsBody').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)openModal(Number(b.dataset.open));});
$('answerEditor').addEventListener('click',e=>{const b=e.target.closest('[data-answer]');if(!b||activeIndex<0)return;const a=results[activeIndex].answers[Number(b.dataset.answer)],choice=Number(b.dataset.choice);const before=a.selected;if(!a.originalStatus)a.originalStatus=a.status;if(a.originalConfidence===undefined)a.originalConfidence=a.confidence;a.selected=choice<0?null:choice;a.manualChanged=before!==a.selected;a.status='manual';scoreResult(results[activeIndex]);openModal(activeIndex);});
$('saveSheetBtn').onclick=saveModal;$('closeModal').onclick=()=>$('sheetModal').classList.add('hidden');$('reviewNextBtn').onclick=()=>{const i=results.findIndex(r=>r.unresolved>0);if(i>=0)openModal(i);};$('approveBtn').onclick=approve;$('exportBtn').onclick=exportCsv;
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)init();});
init();
})();