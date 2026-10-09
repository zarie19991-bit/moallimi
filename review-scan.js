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
function percentile(a,p){if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),i=Math.max(0,Math.min(b.length-1,Math.round((b.length-1)*p)));return b[i];}
function imageQualityMetrics(src){
 const c=scaledCanvas(src,640),d=imageData(c),w=d.width,h=d.height,vals=[],tiles=Array.from({length:16},()=>({sum:0,n:0}));
 const step=Math.max(1,Math.floor(Math.min(w,h)/260));
 let edgeSum=0,edgeSq=0,edgeN=0,shadow=0,glare=0;
 const gray=(x,y)=>{const i=(y*w+x)*4;return d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114;};
 for(let y=1;y<h-1;y+=step)for(let x=1;x<w-1;x+=step){
   const g=gray(x,y);vals.push(g);if(g<55)shadow++;if(g>245)glare++;
   const tx=Math.min(3,Math.floor(x/w*4)),ty=Math.min(3,Math.floor(y/h*4)),t=tiles[ty*4+tx];t.sum+=g;t.n++;
   const lap=4*g-gray(x-1,y)-gray(x+1,y)-gray(x,y-1)-gray(x,y+1);edgeSum+=lap;edgeSq+=lap*lap;edgeN++;
 }
 const tileMeans=tiles.filter(t=>t.n).map(t=>t.sum/t.n),mean=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
 const sharpness=edgeN?Math.max(0,edgeSq/edgeN-Math.pow(edgeSum/edgeN,2)):0;
 return{
   width:src.width,height:src.height,mean:Number(mean.toFixed(1)),
   dynamic_range:Number((percentile(vals,.95)-percentile(vals,.05)).toFixed(1)),
   illumination_range:Number((Math.max(...tileMeans)-Math.min(...tileMeans)).toFixed(1)),
   sharpness:Number(sharpness.toFixed(1)),
   shadow_ratio:Number((shadow/Math.max(1,vals.length)).toFixed(4)),
   glare_ratio:Number((glare/Math.max(1,vals.length)).toFixed(4))
 };
}
function robustBubbleCalibration(raw){
 const vals=raw.flat().map(x=>Number(x.score)).filter(Number.isFinite),base=median(vals),mad=median(vals.map(x=>Math.abs(x-base)));
 const possible=Math.max(.012,Math.min(.032,base+Math.max(.018,mad*2.4)));
 const definite=Math.max(.025,Math.min(.052,base+Math.max(.028,mad*3.5)));
 const separation=Math.max(.020,Math.min(.042,Math.max(.024,mad*2.2)));
 return{baseline:Number(base.toFixed(4)),mad:Number(mad.toFixed(4)),possible:Number(possible.toFixed(4)),definite:Number(definite.toFixed(4)),separation:Number(separation.toFixed(4))};
}
function assessOmrQuality({canvas,markers,markerConfidence,answers,identityValid=true}){
 const image=imageQualityMetrics(canvas),rows=Array.isArray(answers)?answers:[],cal=rows.omrCalibration||null;
 const ambiguous=rows.filter(a=>a.status==='ambiguous').length,multiple=rows.filter(a=>a.status==='multiple').length,blanks=rows.filter(a=>a.status==='blank').length;
 const lowMargin=rows.filter(a=>a.status==='clear'&&Number(a.separation)<Math.max(.026,(cal?.separation||.024)*1.15)).length;
 const reasons=[];let risk='low',penalty=0;
 const elevate=(level,reason,p)=>{if(level==='high'||(level==='medium'&&risk==='low'))risk=level;reasons.push(reason);penalty+=p;};
 if(!identityValid)elevate('high','هوية الورقة غير مؤكدة',35);
 if(!markers)elevate('high','فشل تثبيت مربعات المحاذاة الأربعة',50);
 else if(markerConfidence<.88)elevate('high','ثقة المحاذاة الهندسية منخفضة',35);
 else if(markerConfidence<.93)elevate('medium','ثقة المحاذاة أقل من المستوى المثالي',12);
 if(image.dynamic_range<45)elevate('high','المدى الضوئي للصورة ضعيف',25);
 else if(image.dynamic_range<65)elevate('medium','التباين العام منخفض',8);
 if(image.illumination_range>105)elevate('high','الإضاءة غير متجانسة بشدة',25);
 else if(image.illumination_range>70)elevate('medium','الإضاءة غير متجانسة',10);
 if(image.sharpness<6)elevate('high','الصورة ضبابية بدرجة تعيق القراءة',30);
 else if(image.sharpness<12)elevate('medium','حدة الصورة منخفضة',10);
 if(image.glare_ratio>.08)elevate('medium','انعكاس ضوئي مرتفع',8);
 if(ambiguous||multiple)elevate('high','توجد '+(ambiguous+multiple)+' إجابة غير حاسمة/متعددة',Math.min(35,(ambiguous+multiple)*5));
 if(lowMargin)elevate('medium','فارق ضعيف بين الخيار الأول والثاني في '+lowMargin+' سؤال',Math.min(20,lowMargin*2));
 if(rows.length&&blanks/rows.length>.85)elevate('medium','نسبة الإجابات الفارغة مرتفعة جدًا وتحتاج تحققًا',8);
 const score=Math.max(0,Math.min(100,100-penalty));
 return{
   risk,quality_score:score,reasons:[...new Set(reasons)],
   requires_manual_review:risk!=='low',auto_accept:risk==='low'&&identityValid&&!!markers,
   counts:{ambiguous,multiple,blank:blanks,low_margin:lowMargin,clear:rows.filter(a=>a.status==='clear').length},
   image,marker_confidence:Number(markerConfidence||0),calibration:cal
 };
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
function integralDark(d,threshold=158){
 const w=d.width,h=d.height,ii=new Uint32Array((w+1)*(h+1));
 for(let y=1;y<=h;y++){let row=0;for(let x=1;x<=w;x++){const i=((y-1)*w+(x-1))*4;const gray=(d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114);row+=gray<threshold?1:0;ii[y*(w+1)+x]=ii[(y-1)*(w+1)+x]+row;}}
 return{ii,w,h,threshold};
}
function rectSum(I,x,y,w,h){const W=I.w+1,x1=Math.max(0,x),y1=Math.max(0,y),x2=Math.min(I.w,x+w),y2=Math.min(I.h,y+h);return I.ii[y2*W+x2]-I.ii[y1*W+x2]-I.ii[y2*W+x1]+I.ii[y1*W+x1];}
function integralGray(d){
 const w=d.width,h=d.height,ii=new Uint32Array((w+1)*(h+1));
 for(let y=1;y<=h;y++){let row=0;for(let x=1;x<=w;x++){const i=((y-1)*w+(x-1))*4;row+=Math.round(d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114);ii[y*(w+1)+x]=ii[(y-1)*(w+1)+x]+row;}}
 return{ii,w,h};
}
function rectMean(I,x,y,w,h){const x1=Math.max(0,Math.round(x)),y1=Math.max(0,Math.round(y)),x2=Math.min(I.w,Math.round(x+w)),y2=Math.min(I.h,Math.round(y+h)),n=Math.max(1,(x2-x1)*(y2-y1));return rectSum(I,x1,y1,x2-x1,y2-y1)/n;}

function markerWorkCanvas(src){
 const maxW=1400;
 if(src.width<=maxW)return{canvas:src,sx:1,sy:1};
 const scale=maxW/src.width,c=document.createElement('canvas');
 c.width=Math.round(src.width*scale);c.height=Math.round(src.height*scale);
 c.getContext('2d',{willReadFrequently:true}).drawImage(src,0,0,c.width,c.height);
 return{canvas:c,sx:src.width/c.width,sy:src.height/c.height};
}
function markerCandidates(c){
 const d=imageData(c);
 // Phone photos flatten black ink into gray. Estimate paper brightness from the upper half
 // and use a relative threshold, clamped to a safe range, instead of assuming pure black.
 const sample=[];
 const step=Math.max(8,Math.floor(Math.min(c.width,c.height)/120));
 for(let y=0;y<Math.floor(c.height*.78);y+=step)for(let x=0;x<c.width;x+=step){
   const i=(y*c.width+x)*4,g=d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114;
   if(g>90)sample.push(g);
 }
 const paper=sample.length?median(sample):190,inkThreshold=Math.max(140,Math.min(175,paper-10));
 const I=integralDark(d,inkThreshold),raw=[];
 const sizes=[.007,.010,.013,.017,.022,.028].map(f=>Math.max(7,Math.round(I.w*f)));
 for(const size of sizes){
   const half=Math.floor(size/2),step=Math.max(3,Math.floor(size/2));
   for(let y=half;y<I.h-half;y+=step)for(let x=half;x<I.w-half;x+=step){
     const score=rectSum(I,x-half,y-half,size,size)/(size*size);
     if(score>=.62)raw.push({x,y,size,score});
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
function findTemplateSquare(G,zone,expectX,expectY){
 const sizes=[.008,.010,.013,.016,.020].map(f=>Math.max(7,Math.round(G.w*f)));
 let best=null;
 for(const size of sizes){
   const half=Math.floor(size/2),step=Math.max(2,Math.floor(size/3));
   const x0=Math.max(half,Math.floor(G.w*zone[0])),x1=Math.min(G.w-half,Math.ceil(G.w*zone[1]));
   const y0=Math.max(half,Math.floor(G.h*zone[2])),y1=Math.min(G.h-half,Math.ceil(G.h*zone[3]));
   for(let y=y0;y<=y1;y+=step)for(let x=x0;x<=x1;x+=step){
     const core=rectMean(G,x-half,y-half,size,size);
     const outer=rectMean(G,x-size,y-size,size*2,size*2);
     const contrast=outer-core;
     const prox=(Math.abs(x/G.w-expectX)*40+Math.abs(y/G.h-expectY)*60);
     const score=(255-core)*.70+contrast*.50-prox*20;
     if(contrast<10||core>170)continue;
     if(!best||score>best.score)best={x,y,size,score,core,outer,contrast};
   }
 }
 return best;
}
function detectTemplateMarkerSet(src){
 const prep=markerWorkCanvas(src),c=prep.canvas,d=imageData(c),G=integralGray(d);
 // Tight zones are calibrated from the real printed sheet:
 // TL≈(.08,.46), TR≈(.82,.45), BL≈(.08,.72), BR≈(.85,.71).
 const tl=findTemplateSquare(G,[.04,.13,.42,.50],.079,.461);
 const tr=findTemplateSquare(G,[.77,.89,.41,.49],.823,.449);
 const bl=findTemplateSquare(G,[.04,.14,.66,.77],.082,.720);
 const br=findTemplateSquare(G,[.77,.92,.65,.77],.847,.708);
 if(!tl||!tr||!bl||!br)return null;
 const topDx=tr.x-tl.x,bottomDx=br.x-bl.x,leftDy=bl.y-tl.y,rightDy=br.y-tr.y;
 if(topDx<c.width*.55||bottomDx<c.width*.55||leftDy<c.height*.20||rightDy<c.height*.20)return null;
 const target=(NafesOmrTemplate.markers.tr[0]-NafesOmrTemplate.markers.tl[0])/(NafesOmrTemplate.markers.bl[1]-NafesOmrTemplate.markers.tl[1]);
 const aspect=((topDx+bottomDx)/2)/((leftDy+rightDy)/2),aspectErr=Math.abs(Math.log(aspect/target));
 if(aspectErr>.32)return null;
 const topSlope=Math.abs(tr.y-tl.y)/Math.max(1,topDx),bottomSlope=Math.abs(br.y-bl.y)/Math.max(1,bottomDx);
 if(topSlope>.12||bottomSlope>.12)return null;
 const scale=p=>({x:p.x*prep.sx,y:p.y*prep.sy,score:Math.max(.88,Math.min(.99,.88+p.contrast/300))});
 return{tl:scale(tl),tr:scale(tr),bl:scale(bl),br:scale(br),detector:'template-dark-square-v2',geometry_confidence:Math.max(.90,1-aspectErr)};
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
 const pts=detectTemplateMarkerSet(c);if(!pts)return null;
 return{...pts,image:imageData(c)};
}
function mapTemplate(markers,x,y){
 const T=NafesOmrTemplate.markers,u=(x-T.tl[0])/(T.tr[0]-T.tl[0]),v=(y-T.tl[1])/(T.bl[1]-T.tl[1]);
 const p0=markers.tl,p1=markers.tr,p2=markers.br,p3=markers.bl;
 const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x;
 const dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y;
 const den=dx1*dy2-dx2*dy1;
 let g=0,h=0;
 if(Math.abs(den)>1e-6){g=(dx3*dy2-dx2*dy3)/den;h=(dx1*dy3-dx3*dy1)/den;}
 const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x,c=p0.x;
 const d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y,f=p0.y;
 const z=g*u+h*v+1;
 return{x:(a*u+b*v+c)/z,y:(d*u+e*v+f)/z};
}
function darknessAt(d,cx,cy,r,inner=0){
 const w=d.width,h=d.height;let sum=0,n=0,rr=r*r,ii=inner*inner;
 for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
   if(x<0||y<0||x>=w||y>=h)continue;const dx=x-cx,dy=y-cy,dd=dx*dx+dy*dy;if(dd>rr||dd<ii)continue;
   const i=(y*w+x)*4,gray=d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114;sum+=(255-gray)/255;n++;
 }
 return n?sum/n:0;
}
function grayMeanAt(d,cx,cy,r,inner=0){
 const w=d.width,h=d.height;let sum=0,n=0,rr=r*r,ii=inner*inner;
 for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
   if(x<0||y<0||x>=w||y>=h)continue;
   const dx=x-cx,dy=y-cy,dd=dx*dx+dy*dy;if(dd>rr||dd<ii)continue;
   const i=(y*w+x)*4;sum+=d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114;n++;
 }
 return n?sum/n:255;
}
function bubbleFillScore(d,cx,cy,r){
 // Use only the center of the bubble, avoiding the printed ring itself.
 const center=grayMeanAt(d,cx,cy,r*.55);
 // Local paper/outline reference. This automatically compensates for shadows and uneven light.
 const ring=grayMeanAt(d,cx,cy,r*1.55,r*1.05);
 return{score:(ring-center)/255,center,ring};
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
 const radius=Math.max(3.2,Math.min(7.5,span*.0082)),raw=[];
 for(let i=0;i<Math.min(total,NafesOmrTemplate.maxQuestions||60);i++){
   const ev=NafesOmrTemplate.answerPoints(i,total).map(p=>{
     const m=mapTemplate(markers,p.x,p.y),z=bubbleFillScore(markers.image,m.x,m.y,radius);
     return{...z,x:m.x,y:m.y};
   });
   raw.push(ev);
 }
 const cal=robustBubbleCalibration(raw),clamp=v=>Math.max(0,Math.min(1,v));
 const out=raw.map((ev,i)=>{
   const order=ev.map((e,j)=>({e,j,s:e.score})).sort((a,b)=>b.s-a.s),top=order[0],second=order[1],separation=top.s-second.s;
   const definite=order.filter(x=>x.s>=cal.definite),possible=order.filter(x=>x.s>=cal.possible);
   const scores=ev.map(x=>Number(x.score.toFixed(4)));
   const evidence=ev.map(x=>({score:Number(x.score.toFixed(4)),center:Number(x.center.toFixed(1)),ring:Number(x.ring.toFixed(1)),x:Number(x.x.toFixed(1)),y:Number(x.y.toFixed(1))}));
   if(top.s<cal.possible){
     const confidence=clamp(.86+(cal.possible-top.s)*1.6);
     return{question:startNo+i,selected:null,status:'blank',marked:[],scores,evidence,confidence:Number(confidence.toFixed(3)),topScore:top.s,secondScore:second.s,threshold:cal.possible,separation};
   }
   if(definite.length>1){
     return{question:startNo+i,selected:top.j,status:'multiple',marked:definite.map(x=>x.j),scores,evidence,confidence:Number(Math.min(.49,clamp(separation/Math.max(.01,cal.separation))).toFixed(3)),topScore:top.s,secondScore:second.s,threshold:cal.definite,separation};
   }
   if(possible.length>1||top.s<cal.definite||separation<cal.separation){
     return{question:startNo+i,selected:top.j,status:'ambiguous',marked:[top.j],scores,evidence,confidence:Number(Math.min(.79,clamp(.50+(top.s-cal.possible)*6+separation*4)).toFixed(3)),topScore:top.s,secondScore:second.s,threshold:cal.definite,separation};
   }
   const confidence=clamp(.94+(top.s-cal.definite)*.45+separation*.30);
   return{question:startNo+i,selected:top.j,status:'clear',marked:[top.j],scores,evidence,confidence:Number(confidence.toFixed(3)),topScore:top.s,secondScore:second.s,threshold:cal.definite,separation};
 });
 out.omrCalibration=cal;return out;
}
function validateOmrRead(answers,total){
 const rows=Array.isArray(answers)?answers:[];
 if(rows.length!==Number(total||0))return{ok:false,reason:'عدد الإجابات المقروءة لا يطابق عدد أسئلة الاختبار.'};
 const clear=rows.filter(a=>a.status==='clear').length;
 const blanks=rows.filter(a=>a.status==='blank').length;
 const bad=rows.filter(a=>a.status==='multiple'||a.status==='ambiguous').length;
 if(clear+blanks+bad!==rows.length)return{ok:false,reason:'حالات القراءة غير مكتملة.'};
 // Do not reject legitimately blank papers; only reject impossible/non-finite evidence.
 if(rows.some(a=>!Array.isArray(a.scores)||a.scores.length!==4||a.scores.some(x=>!Number.isFinite(Number(x)))))return{ok:false,reason:'بيانات قياس التظليل غير صالحة.'};
 return{ok:true,clear,blanks,bad};
}
function fullImage(c){const o=document.createElement('canvas'),scale=Math.min(1,1400/c.width);o.width=Math.round(c.width*scale);o.height=Math.round(c.height*scale);o.getContext('2d').drawImage(c,0,0,o.width,o.height);const out=o.toDataURL('image/jpeg',.76);o.width=1;o.height=1;return out;}
function thumb(c){const w=Math.min(420,c.width),h=Math.round(c.height*w/c.width),o=document.createElement('canvas');o.width=w;o.height=h;o.getContext('2d').drawImage(c,0,0,w,h);const out=o.toDataURL('image/jpeg',.58);o.width=1;o.height=1;return out;}
function scoreResult(r){
 const key=keyForModel(r.model);let score=0,total=Math.min(Number(draft.question_count||20),key.length||20);
 r.answers.forEach((a,i)=>{const k=key[i];a.correctIndex=k?Number(k.correct_index):null;a.indicator=k?.indicator||'';a.correct=a.status==='clear'&&a.selected!==null&&a.correctIndex!==null&&Number(a.selected)===Number(a.correctIndex);if(a.correct)score++;});
 const confs=r.answers.map(a=>Number(a.originalConfidence??a.confidence)).filter(Number.isFinite),clearConfs=r.answers.filter(a=>a.status==='clear'||a.status==='manual').map(a=>Number(a.originalConfidence??a.confidence)).filter(Number.isFinite);
 const avg=confs.length?confs.reduce((s,x)=>s+x,0)/confs.length:0,minClear=clearConfs.length?Math.min(...clearConfs):0;
 const manual=r.answers.filter(a=>a.status==='manual'||a.manualChanged===true).length;
 const low=r.answers.filter(a=>Number.isFinite(Number(a.originalConfidence??a.confidence))&&Number(a.originalConfidence??a.confidence)<.80).length;
 r.score=score;r.total=total;
 r.unresolved=r.answers.filter(a=>a.status==='multiple'||a.status==='ambiguous').length+(!r.qrValid?1:0)+(Number(r.markerConfidence||0)<.88?1:0);
 const verifiedAuto=!!r.verification?.auto_accept&&r.unresolved===0&&manual===0;
 r.omr={confidence:Number(avg.toFixed(3)),min_clear_confidence:Number(minClear.toFixed(3)),marker_confidence:Number(r.markerConfidence||0),manual_answers:manual,low_confidence_answers:low,answer_count:r.answers.length,auto_accept:verifiedAuto,quality_score:Number(r.verification?.quality_score||0),risk:r.verification?.risk||'high'};
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
 const assignment=q&&q.reviewId===draft.review_id?assignmentBySheet(q.sheetNo):null;
 const qrValid=!!assignment&&q.model===assignment.model,model=assignment?.model||q?.model||'';
 // The browser no longer reads or scores bubbles. It only prepares the full JPEG and QR identity.
 // All OMR geometry, bubble classification and scoring are performed once on the server.
 return{
   id:'p'+pageNo+'r'+regionNo,pageNo,regionNo,qrRaw,qr:q,qrValid,assignment,model,
   studentName:assignment?.student_name||'غير معروف',
   markersOk:false,markerConfidence:0,answers:[],
   fullImage:fullImage(canvas),unresolved:0,score:0,total:Number(draft.question_count||20),
   sourceCanvas:canvas,detector:'server-only',markerPoints:null,imageQuality:null,verification:null,calibration:null
 };
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
function regionsForPage(c,forceSingle=false){
 let page=c;
 if(c.width>c.height)page=rotateCanvas(c,90);
 if(forceSingle)return[page];
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
   setProgress(1,'تهيئة الصور وقراءة QR ثم التصحيح الخادمي…');
   await window.NafesScanJournal.beginStream(inputFiles);streamStarted=true;
   for(let fi=0;fi<inputFiles.length;fi++){
     const inputFile=inputFiles[fi],standaloneImage=!(inputFile.type==='application/pdf'||inputFile.name.toLowerCase().endsWith('.pdf')||isTiff(inputFile));
     for await(const page of sourcePages(inputFile)){
       sourcePageCount++;if(sourcePageCount>200)throw new Error('تجاوزت الدفعة الحد الأقصى: ٢٠٠ صفحة.');
       const regs=regionsForPage(page.canvas,standaloneImage);
       for(let ri=0;ri<regs.length;ri++){
         if(queuedCount>=200)throw new Error('تجاوزت الدفعة الحد الأقصى: ٢٠٠ ورقة/صفحة.');
         while(inflight.length>=2)await Promise.race(inflight);
         const approx=Math.min(96,3+((fi+(page.pageNo/Math.max(1,page.total)))/inputFiles.length)*90);
         setProgress(approx,'الملف '+ar(fi+1)+' من '+ar(inputFiles.length)+' · الصفحة '+ar(page.pageNo)+' من '+ar(page.total)+' · تجهيز '+ar(queuedCount+1)+' · محفوظ '+ar(savedCount));
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
 const c=await canvasFromDataUrl(src),canvas=c.height>=c.width?c:rotateCanvas(c,90),markers=detectTemplateMarkerSet(canvas);
 if(!markers){c.width=1;c.height=1;throw new Error('لم تُعثر هندسة القالب على المربعات الأربع في مواضعها الصحيحة.');}
 const data={...markers,image:imageData(canvas)};
 const answers=readAnswers(canvas,data,total,startNo),validation=validateOmrRead(answers,total);
 if(!validation.ok){c.width=1;c.height=1;throw new Error(validation.reason);}
 const markerConfidence=Number(markers.geometry_confidence||.9),verification=assessOmrQuality({canvas,markers,markerConfidence,answers,identityValid:true});
 const out={
   answers,markers_ok:true,marker_confidence:Number(markerConfidence.toFixed(3)),detector:markers.detector||'template-dark-square-v2',
   marker_points:{tl:[Number(markers.tl.x.toFixed(1)),Number(markers.tl.y.toFixed(1))],tr:[Number(markers.tr.x.toFixed(1)),Number(markers.tr.y.toFixed(1))],bl:[Number(markers.bl.x.toFixed(1)),Number(markers.bl.y.toFixed(1))],br:[Number(markers.br.x.toFixed(1)),Number(markers.br.y.toFixed(1))]},
   image_quality:verification.image,verification,calibration:answers.omrCalibration||null
 };
 c.width=1;c.height=1;return out;
}
function benchmarkOmr(samples){
 let questions=0,exact=0,tp=0,fp=0,fn=0;
 for(const sample of samples||[]){
   const got=sample?.answers||[],expected=sample?.expected||[];
   for(let i=0;i<Math.min(got.length,expected.length);i++){
     questions++;const g=got[i]?.status==='clear'?got[i].selected:null,e=Number.isInteger(expected[i])?expected[i]:null;
     if(g===e)exact++;if(e!==null&&g===e)tp++;else{if(g!==null)fp++;if(e!==null)fn++;}
   }
 }
 const precision=tp/Math.max(1,tp+fp),recall=tp/Math.max(1,tp+fn),f1=2*precision*recall/Math.max(.000001,precision+recall);
 return{questions,accuracy:questions?exact/questions:0,precision,recall,f1,target_met:questions>=100&&exact/questions>=.995};
}
window.NafesScanReader={decodeStoredIdentity,readStoredOmr,benchmarkOmr};
addEventListener('nafes:auth-changed',e=>{if(e.detail.authenticated)init();});
init();
})();