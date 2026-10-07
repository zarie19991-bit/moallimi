(()=>{
'use strict';
const $=id=>document.getElementById(id);
const ar=n=>new Intl.NumberFormat('ar-SA').format(Number(n||0));
const letters=['أ','ب','ج','د'];
let draft=null,files=[],results=[],processing=false;

function keyForModel(model){return draft?.answer_keys?.find(x=>x.model===model)?.answers||[];}
function assignmentBySheet(no){return draft?.assignments?.find(x=>Number(x.sheet_no)===Number(no))||null;}
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
function qrDecodeOnce(c){
 if(typeof jsQR!=='function')return null;
 const d=imageData(c),q=jsQR(d.data,d.width,d.height,{inversionAttempts:'attemptBoth'});
 return q?{data:q.data,location:q.location}:null;
}
function scaledCanvas(src,maxW=1200){
 if(src.width<=maxW)return src;
 const scale=maxW/src.width,c=document.createElement('canvas');c.width=Math.max(1,Math.round(src.width*scale));c.height=Math.max(1,Math.round(src.height*scale));
 c.getContext('2d',{willReadFrequently:true}).drawImage(src,0,0,c.width,c.height);return c;
}
function resizeCanvas(src,targetW=1000){
 const scale=targetW/src.width,c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(src.width*scale));c.height=Math.max(1,Math.round(src.height*scale));
 const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;g.drawImage(src,0,0,c.width,c.height);return c;
}
function qrTemplateCrops(src){
 const w=src.width,h=src.height,out=[];
 // Current printed template: QR sits in the upper-left header block.
 const specs=[
   [0,0,.34,.25],
   [0,0,.28,.22],
   [0,.02,.24,.20],
   [.01,.01,.20,.18]
 ];
 for(const [xf,yf,wf,hf] of specs){
   const c=cropCanvas(src,Math.round(w*xf),Math.round(h*yf),Math.round(w*wf),Math.round(h*hf));
   out.push(resizeCanvas(c,900),resizeCanvas(c,1400));
 }
 return out;
}
function thresholdCanvas(src,threshold=176){
 const base=scaledCanvas(src,1200),d=imageData(base),o=document.createElement('canvas');o.width=base.width;o.height=base.height;
 const g=o.getContext('2d',{willReadFrequently:true}),out=g.createImageData(o.width,o.height);
 for(let i=0;i<d.data.length;i+=4){
   const gray=d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114,v=gray<threshold?0:255;
   out.data[i]=out.data[i+1]=out.data[i+2]=v;out.data[i+3]=255;
 }
 g.putImageData(out,0,0);return o;
}
function qrDecode(c){
 const full=scaledCanvas(c,1600),owned=[];
 const tryOne=x=>{
   if(!x||x.width<40||x.height<40)return null;
   const q=qrDecodeOnce(x);return q;
 };
 const useCrop=(x,y,w,h,scale=0)=>{
   const c=cropCanvas(full,x,y,w,h);owned.push(c);
   if(scale>0){const z=resizeCanvas(c,scale);owned.push(z);return z;}
   return c;
 };
 let q=tryOne(full);
 if(!q){
   const h=full.height,w=full.width;
   // Fast path for the current OMR template: QR in the upper-left header.
   const specs=[
     [0,0,.30,.23,900],
     [0,0,.24,.20,1100],
     [.01,.01,.20,.18,1200]
   ];
   for(const [xf,yf,wf,hf,target] of specs){
     const c=useCrop(Math.round(w*xf),Math.round(h*yf),Math.round(w*wf),Math.round(h*hf),target);
     q=tryOne(c);
     if(!q){
       const t=thresholdCanvas(c,175);owned.push(t);q=tryOne(t);
     }
     if(q)break;
   }
   // Wider header fallback only if exact-zone attempts fail.
   if(!q)q=tryOne(useCrop(0,0,w,Math.min(h,Math.round(h*.38))));
 }
 for(const c of owned){try{c.width=1;c.height=1;}catch(_){}}
 return q;
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
     if(score>=.70)raw.push({x,y,size,score});
   }
 }
 raw.sort((a,b)=>b.score-a.score);
 const out=[];
 for(const p of raw){
   if(out.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<Math.max(p.size,q.size)*1.4))continue;
   out.push(p);if(out.length>=140)break;
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
   if(Math.abs(top.l.x-bottom.l.x)>c.width*.065||Math.abs(top.r.x-bottom.r.x)>c.width*.065)continue;
   const dx=(top.dx+bottom.dx)/2,aspect=dx/dy,aspectErr=Math.abs(Math.log(aspect/target));
   if(aspectErr>.36)continue;
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
function darknessAt(d,cx,cy,r,inner=0){
 const w=d.width,h=d.height;let sum=0,n=0,rr=r*r,ii=inner*inner;
 for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
   if(x<0||y<0||x>=w||y>=h)continue;const dx=x-cx,dy=y-cy,dd=dx*dx+dy*dy;if(dd>rr||dd<ii)continue;
   const i=(y*w+x)*4,gray=d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114;sum+=(255-gray)/255;n++;
 }
 return n?sum/n:0;
}
function bubbleEvidence(d,cx,cy,r){
 const inner=darknessAt(d,cx,cy,r*.62);
 const ring=darknessAt(d,cx,cy,r*1.35,r*.82);
 const local=darknessAt(d,cx,cy,r*1.85,r*1.42);
 const fill=Math.max(0,inner-Math.max(local*.35,ring*.18));
 return{inner,ring,local,fill};
}
function readAnswers(c,markers,total,startNo){
 const span=(Math.hypot(markers.tr.x-markers.tl.x,markers.tr.y-markers.tl.y)+Math.hypot(markers.br.x-markers.bl.x,markers.br.y-markers.bl.y))/2;
 const radius=Math.max(3,span*(1.08/Math.max(1,NafesOmrTemplate.markers.tr[0]-NafesOmrTemplate.markers.tl[0])));
 const raw=[],allFill=[];
 for(let i=0;i<Math.min(total,NafesOmrTemplate.maxQuestions||60);i++){
   const ev=NafesOmrTemplate.answerPoints(i,total).map(p=>{const m=mapTemplate(markers,p.x,p.y);return bubbleEvidence(markers.image,m.x,m.y,radius);});
   raw.push(ev);allFill.push(...ev.map(x=>x.fill));
 }
 const base=median(allFill),clamp=v=>Math.max(0,Math.min(1,v));
 // Conservative fail-closed thresholds: an answer is "clear" only when the fill is strong
 // and clearly separated from every competing bubble.
 const filledThreshold=Math.max(.16,base+.105);
 const strongThreshold=Math.max(.23,base+.16);
 return raw.map((ev,i)=>{
   const order=ev.map((e,j)=>({e,j,s:e.fill})).sort((a,b)=>b.s-a.s),top=order[0],second=order[1];
   const separation=top.s-second.s;
   const strong=top.s>=strongThreshold&&separation>=.095&&top.e.inner>=.27;
   const possible=order.filter(x=>x.s>=filledThreshold&&x.e.inner>=.20);
   const scores=ev.map(x=>Number(x.fill.toFixed(4)));
   if(possible.length===0){
     const confidence=clamp((filledThreshold-top.s)/.10);
     return{question:startNo+i,selected:null,status:'blank',marked:[],scores,evidence:ev,confidence:Number(confidence.toFixed(3)),topScore:top.s,secondScore:second.s,threshold:filledThreshold,separation};
   }
   if(possible.length>1){
     return{question:startNo+i,selected:top.j,status:'multiple',marked:possible.map(x=>x.j),scores,evidence:ev,confidence:Number(Math.min(.45,clamp(separation/.12)).toFixed(3)),topScore:top.s,secondScore:second.s,threshold:filledThreshold,separation};
   }
   if(!strong){
     return{question:startNo+i,selected:top.j,status:'ambiguous',marked:[top.j],scores,evidence:ev,confidence:Number(Math.min(.79,clamp((top.s-filledThreshold)/.14*.55+separation/.12*.45)).toFixed(3)),topScore:top.s,secondScore:second.s,threshold:filledThreshold,separation};
   }
   const confidence=clamp(.55*(top.s-strongThreshold)/.22+.45*separation/.18+.82);
   return{question:startNo+i,selected:top.j,status:'clear',marked:[top.j],scores,evidence:ev,confidence:Number(confidence.toFixed(3)),topScore:top.s,secondScore:second.s,threshold:filledThreshold,separation};
 });
}
function fullImage(c){const o=document.createElement('canvas'),scale=Math.min(1,1400/c.width);o.width=Math.round(c.width*scale);o.height=Math.round(c.height*scale);o.getContext('2d').drawImage(c,0,0,o.width,o.height);const out=o.toDataURL('image/jpeg',.76);o.width=1;o.height=1;return out;}
function thumb(c){const w=Math.min(420,c.width),h=Math.round(c.height*w/c.width),o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').drawImage(c,0,0,w,h);const out=o.toDataURL('image/jpeg',.58);o.width=1;o.height=1;return out;}
function scoreResult(r){
 const key=keyForModel(r.model),start=Number(draft.question_start||1);let score=0,total=Math.min(Number(draft.question_count||20),key.length||20);
 r.answers.forEach((a,i)=>{const k=key[i];a.correctIndex=k?Number(k.correct_index):null;a.indicator=k?.indicator||'';a.correct=a.status==='clear'&&a.selected!==null&&a.correctIndex!==null&&Number(a.selected)===Number(a.correctIndex);if(a.correct)score++;});
 const confs=r.answers.map(a=>Number(a.originalConfidence??a.confidence)).filter(Number.isFinite),clearConfs=r.answers.filter(a=>a.status==='clear'||a.status==='manual').map(a=>Number(a.originalConfidence??a.confidence)).filter(Number.isFinite);
 const avg=confs.length?confs.reduce((s,x)=>s+x,0)/confs.length:0,minClear=clearConfs.length?Math.min(...clearConfs):0;
 const manual=r.answers.filter(a=>a.status==='manual'||a.manualChanged===true).length;
 const low=r.answers.filter(a=>Number.isFinite(Number(a.originalConfidence??a.confidence))&&Number(a.originalConfidence??a.confidence)<.80).length;
 r.score=score;r.total=total;
 r.unresolved=r.answers.filter(a=>a.status==='multiple'||a.status==='ambiguous').length+(!r.qrValid?1:0)+(Number(r.markerConfidence||0)<.72?1:0);
 r.omr={confidence:Number(avg.toFixed(3)),min_clear_confidence:Number(minClear.toFixed(3)),marker_confidence:Number(r.markerConfidence||0),manual_answers:manual,low_confidence_answers:low,answer_count:r.answers.length,auto_accept:!!r.qrValid&&!!r.markersOk&&Number(r.markerConfidence||0)>=.85&&r.unresolved===0&&manual===0&&avg>=.97&&minClear>=.94};
 return r;
}
function normalizeWorkCanvas(src,maxW=2200){
 if(src.width<=maxW)return src;
 const scale=maxW/src.width,c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(src.width*scale));c.height=Math.max(1,Math.round(src.height*scale));
 c.getContext('2d',{willReadFrequently:true}).drawImage(src,0,0,c.width,c.height);
 return c;
}
async function processRegion(c,pageNo,regionNo){
 const work=normalizeWorkCanvas(c),normed=normalizeOrientation(work),canvas=normed.canvas,qrRaw=normed.qr?.data||'',q=parseQr(qrRaw);
 const assignment=q&&q.reviewId===draft.review_id?assignmentBySheet(q.sheetNo):null,qrValid=!!assignment&&q.model===assignment.model,model=assignment?.model||q?.model||'';
 const markers=detectMarkers(canvas),answers=markers?readAnswers(canvas,markers,Number(draft.question_count||20),Number(draft.question_start||1)):[];
 const markerScores=markers?[markers.tl?.score,markers.tr?.score,markers.bl?.score,markers.br?.score].map(Number).filter(Number.isFinite):[];
 const markerConfidence=markerScores.length?Math.max(0,Math.min(1,(markerScores.reduce((s,x)=>s+x,0)/markerScores.length-.70)/.30)):0;
 const r={id:'p'+pageNo+'r'+regionNo,pageNo,regionNo,qrRaw,qr:q,qrValid,assignment,model,studentName:assignment?.student_name||'غير معروف',markersOk:!!markers,markerConfidence:Number(markerConfidence.toFixed(3)),answers,fullImage:fullImage(canvas),unresolved:0,score:0,total:Number(draft.question_count||20),sourceCanvas:canvas};
 if(!markers){r.unresolved++;r.error='تعذر تحديد علامات المحاذاة في ورقة التظليل.';}
 if(markers&&answers.length)scoreResult(r);return r;
}
async function canvasFromImage(file){
 let bmp;
 try{bmp=await createImageBitmap(file,{resizeWidth:2200,resizeQuality:'high'});}
 catch(_){bmp=await createImageBitmap(file);}
 const scale=Math.min(1,2200/bmp.width),c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(bmp.width*scale));c.height=Math.max(1,Math.round(bmp.height*scale));
 c.getContext('2d',{willReadFrequently:true}).drawImage(bmp,0,0,c.width,c.height);
 try{bmp.close();}catch(_){}
 return c;
}
function isTiff(file){return /\.tiff?$/i.test(file.name)||file.type==='image/tiff';}
async function* sourcePages(file){
 if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){
   pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
   const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
   try{for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:2}),c=document.createElement('canvas');c.width=Math.round(v.width);c.height=Math.round(v.height);await p.render({canvasContext:c.getContext('2d',{willReadFrequently:true}),viewport:v}).promise;yield {canvas:c,pageNo:n,total:pdf.numPages};p.cleanup();}}
   finally{await pdf.destroy();}
 }else if(isTiff(file)){
   if(!window.UTIF)throw Error('تعذر تحميل قارئ TIFF.');
   const buf=await file.arrayBuffer(),ifds=UTIF.decode(buf);UTIF.decodeImages(buf,ifds);
   for(let n=0;n<ifds.length;n++){
     const rgba=UTIF.toRGBA8(ifds[n]),c=document.createElement('canvas');c.width=ifds[n].width;c.height=ifds[n].height;
     const g=c.getContext('2d',{willReadFrequently:true}),img=g.createImageData(c.width,c.height);img.data.set(rgba);g.putImageData(img,0,0);
     yield {canvas:c,pageNo:n+1,total:ifds.length};
   }
 }else yield {canvas:await canvasFromImage(file),pageNo:1,total:1};
}
function cropAroundMarkers(c,m){
 const left=Math.min(m.tl.x,m.bl.x),right=Math.max(m.tr.x,m.br.x),top=Math.min(m.tl.y,m.tr.y),bottom=Math.max(m.bl.y,m.br.y);
 const dx=Math.max(1,right-left),dy=Math.max(1,bottom-top);
 const x=Math.max(0,left-dx*.10),y=Math.max(0,top-dy*.78),x2=Math.min(c.width,right+dx*.10),y2=Math.min(c.height,bottom+dy*.55);
 return cropCanvas(c,x,y,x2-x,y2-y);
}
function regionsForPage(c){
 let page=c;
 if(c.width>c.height)page=rotateCanvas(c,90);
 const ratio=page.height/Math.max(1,page.width);
 // Normal phone/PDF portrait scans contain one full OMR sheet. Avoid a second expensive
 // full-page marker pass; processRegion will do the precise marker read once.
 if(ratio>=1.18&&ratio<=1.70)return[page];
 const sets=detectMarkerSets(page);
 if(sets.length>1){
   const ordered=[...sets].sort((a,b)=>((a.tl.y+a.bl.y+a.tr.y+a.br.y)/4)-((b.tl.y+b.bl.y+b.tr.y+b.br.y)/4));
   const centers=ordered.slice(0,2).map(m=>(m.tl.y+m.bl.y+m.tr.y+m.br.y)/4);
   const split=Math.max(1,Math.min(page.height-1,Math.round((centers[0]+centers[1])/2)));
   return[cropCanvas(page,0,0,page.width,split),cropCanvas(page,0,split,page.width,page.height-split)];
 }
 return[page];
}
async function processFile(){
 if(!files.length||!draft||processing||window.NafesScanJournal.isBusy())return;
 const inputFiles=[...files];processing=true;results=[];$('resultsSection').classList.add('hidden');$('approvedSection').classList.add('hidden');$('summarySection').classList.add('hidden');$('processBtn').disabled=true;$('clearBtn').disabled=true;$('fileInput').disabled=true;
 let sourcePageCount=0,queuedCount=0,savedCount=0,streamStarted=false,inflight=[];
 const cleanupResult=r=>{delete r.fullImage;delete r.thumbnail;delete r.answers;delete r.evidence;};
 const submit=(r,ordinal)=>{
   const p=window.NafesScanJournal.appendStream(r,ordinal).then(()=>{savedCount++;}).finally(()=>cleanupResult(r));
   inflight.push(p);
   p.finally(()=>{inflight=inflight.filter(x=>x!==p);});
   return p;
 };
 try{
   setProgress(1,'تهيئة القراءة السريعة والحفظ المباشر…');
   await window.NafesScanJournal.beginStream(inputFiles);streamStarted=true;
   for(let fi=0;fi<inputFiles.length;fi++){
     const inputFile=inputFiles[fi];
     for await(const page of sourcePages(inputFile)){
       sourcePageCount++;if(sourcePageCount>200)throw new Error('تجاوزت الدفعة الحد الأقصى: ٢٠٠ صفحة.');
       const regs=regionsForPage(page.canvas);
       for(let ri=0;ri<regs.length;ri++){
         if(queuedCount>=200)throw new Error('تجاوزت الدفعة الحد الأقصى: ٢٠٠ ورقة/صفحة.');
         while(inflight.length>=2)await Promise.race(inflight);
         const approx=Math.min(96,3+((fi+(page.pageNo/Math.max(1,page.total)))/inputFiles.length)*90);
         setProgress(approx,'الملف '+ar(fi+1)+' من '+ar(inputFiles.length)+' · الصفحة '+ar(page.pageNo)+' من '+ar(page.total)+' · قراءة '+ar(queuedCount+1)+' · محفوظ '+ar(savedCount));
         const r=await processRegion(regs[ri],sourcePageCount,ri+1);
         delete r.sourceCanvas;
         queuedCount++;
         submit(r,queuedCount);
         if(regs[ri]!==page.canvas){try{regs[ri].width=1;regs[ri].height=1;}catch(_){}}
         if((queuedCount%3)===0)await new Promise(res=>setTimeout(res,0));
       }
       try{page.canvas.width=1;page.canvas.height=1;}catch(_){}
       await new Promise(res=>requestAnimationFrame(()=>res()));
     }
   }
   if(!queuedCount)throw new Error('لم يتم العثور على أوراق قابلة للمعالجة.');
   if(inflight.length)await Promise.all(inflight);
   setProgress(98,'تثبيت '+ar(savedCount)+' ورقة…');
   await window.NafesScanJournal.finalizeStream(savedCount);
   setProgress(100,'اكتمل — تمت قراءة وحفظ '+ar(savedCount)+' ورقة');
 }catch(e){
   try{if(inflight.length)await Promise.allSettled(inflight);}catch(_){}
   setProgress(0,'توقف التحليل بعد حفظ '+ar(savedCount)+' من '+ar(queuedCount)+' ورقة: '+e.message+(streamStarted?' — المحفوظ لا يضيع.':''));
 }finally{
   results=[];inflight=[];processing=false;$('processBtn').disabled=!files.length;$('clearBtn').disabled=false;$('fileInput').disabled=false;
 }
}
async function init(){
 draft=await (window.NafesPaperReviewDraft?.load?.()||Promise.resolve(null));if(!draft){$('noDraft').classList.remove('hidden');$('processBtn').disabled=true;return;}const subjectNames={reading:'القراءة',math:'الرياضيات',science:'العلوم'},subs=(Array.isArray(draft.subjects)&&draft.subjects.length?draft.subjects:[draft.subject]).filter(Boolean);$('reviewMeta').textContent=(draft.title||'مراجعة')+' · '+subs.map(x=>subjectNames[x]||x).join(' + ')+' · '+(draft.assignments?.length||0)+' طالب';
 if(!NafesTeacher?.getKey())NafesTeacher.requireKey('أدخل مفتاح المعلم لرفع أوراق الطلاب وتصحيحها.');
 try{await window.NafesScanJournal.init(draft);}catch(e){setProgress(0,'تعذر تحميل جلسات المراجعة: '+e.message);}
}
function setFiles(list){
 files=Array.from(list||[]).filter(f=>/\.(pdf|jpe?g|png|tiff?)$/i.test(f.name)||['application/pdf','image/jpeg','image/png','image/tiff'].includes(f.type));
 $('processBtn').disabled=!files.length;
 $('dropzone').querySelector('b').textContent=files.length?(files.length===1?files[0].name:ar(files.length)+' ملفات في الدفعة'):'اختر PDF أو صورًا متعددة أو اسحبها هنا';
}
$('fileInput').addEventListener('change',e=>setFiles(e.target.files));
$('processBtn').onclick=processFile;$('clearBtn').onclick=()=>{files=[];$('fileInput').value='';$('processBtn').disabled=true;$('dropzone').querySelector('b').textContent='اختر PDF أو صورًا متعددة أو اسحبها هنا';$('progressWrap').classList.add('hidden');};
['dragenter','dragover'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{e.preventDefault();$('dropzone').classList.add('drag');}));['dragleave','drop'].forEach(ev=>$('dropzone').addEventListener(ev,e=>{$('dropzone').classList.remove('drag');if(ev==='drop'){e.preventDefault();if(processing||window.NafesScanJournal.isBusy())return;setFiles(e.dataTransfer.files);}}));
async function canvasFromDataUrl(src){
 const img=new Image();img.decoding='async';
 await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('تعذر فتح صورة الورقة المحفوظة.'));img.src=src;});
 const c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;
 c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0);return c;
}
async function decodeStoredIdentity(src){
 const c=await canvasFromDataUrl(src),normed=normalizeOrientation(c),q=parseQr(normed.qr?.data||'');
 c.width=1;c.height=1;return q;
}
async function readStoredOmr(src,total,startNo){
 const c=await canvasFromDataUrl(src),normed=normalizeOrientation(c),canvas=normed.canvas,markers=detectMarkers(canvas);
 if(!markers){c.width=1;c.height=1;throw new Error('تعذر تثبيت علامات المحاذاة الأربع؛ لن يتم تخمين الإجابات.');}
 const markerScores=[markers.tl?.score,markers.tr?.score,markers.bl?.score,markers.br?.score].map(Number).filter(Number.isFinite);
 const markerConfidence=markerScores.length?Math.max(0,Math.min(1,(markerScores.reduce((a,b)=>a+b,0)/markerScores.length-.70)/.30)):0;
 if(markerConfidence<.72){c.width=1;c.height=1;throw new Error('ثقة محاذاة الورقة منخفضة؛ تم إيقاف القراءة الآلية لمنع درجة وهمية.');}
 const answers=readAnswers(canvas,markers,total,startNo);c.width=1;c.height=1;
 return{answers,markers_ok:true,marker_confidence:Number(markerConfidence.toFixed(3))};
}
window.NafesScanReader={decodeStoredIdentity,readStoredOmr};
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)init();});
init();
})();