import jpeg from "npm:jpeg-js@0.4.4";

type GrayImage={width:number;height:number;gray:Uint8Array;rgba:Uint8Array};
type Point={x:number;y:number;score?:number};
export class OMRReadFailure extends Error{
 readonly code:string;
 readonly diagnostics:Record<string,unknown>;
 constructor(code:string,message:string,diagnostics:Record<string,unknown>={}){
  super(message);this.name='OMRReadFailure';this.code=code;this.diagnostics=diagnostics;
 }
}
const median=(a:number[])=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),n=b.length;return n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2;};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

function decodeDataUrl(src:string):GrayImage{
 const m=String(src||'').match(/^data:image\/jpeg;base64,(.+)$/s);
 if(!m)throw new Error('الصورة المخزنة ليست JPEG صالحًا للقراءة الخادمية.');
 const bin=atob(m[1]),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 const d:any=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true});
 if(!d?.width||!d?.height||!d?.data)throw new Error('تعذر فك ترميز صورة الورقة.');
 const rgba=new Uint8Array(d.data),g=new Uint8Array(d.width*d.height);
 for(let i=0,j=0;i<rgba.length;i+=4,j++)g[j]=Math.round(rgba[i]*.299+rgba[i+1]*.587+rgba[i+2]*.114);
  return{width:d.width,height:d.height,gray:g,rgba};
}
// This is a *secondary* alignment-only pass, never an automatic grade repair.
// Local averaging removes isolated camera noise and percentile stretching
// recovers weak printed square edges when the original marker pass was rejected.
function enhanceGeometryGray(im:GrayImage){
 const hist=new Uint32Array(256);
 for(let i=0;i<im.gray.length;i+=7)hist[im.gray[i]]++;
 const total=hist.reduce((a,b)=>a+b,0);
 const quantile=(p:number)=>{let c=0;for(let k=0;k<256;k++){c+=hist[k];if(c>=total*p)return k;}return 255;};
 const lo=quantile(.005),hi=quantile(.995),range=hi-lo;
 if(range<18)throw new OMRReadFailure('OMR_LOW_DYNAMIC_RANGE','التباين منخفض جدًا لتأكيد علامات القالب.',{percentile_low:lo,percentile_high:hi});
 const gain=clamp(175/range,1,2.5),out=new Uint8Array(im.gray.length);
 const {width:w,height:h,gray:g}=im;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=y*w+x;
   const mixed=x===0||y===0||x+1===w||y+1===h?g[i]:
     (g[i]*4+g[i-1]+g[i+1]+g[i-w]+g[i+w])/8;
   out[i]=Math.round(clamp(55+(mixed-lo)*gain,0,255));
 }
 return{image:{...im,gray:out},diagnostics:{percentile_low:lo,percentile_high:hi,gain:Number(gain.toFixed(3)),noise_filter:'weighted_5_point'}};
}
function rotate90(im:GrayImage):GrayImage{
 const nw=im.height,nh=im.width,outG=new Uint8Array(im.width*im.height),outRgba=new Uint8Array(im.width*im.height*4);
 for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){
   const nx=im.height-1-y,ny=x,src=y*im.width+x,dst=ny*nw+nx;
   outG[dst]=im.gray[src];
   const si=src*4,di=dst*4;outRgba[di]=im.rgba[si];outRgba[di+1]=im.rgba[si+1];outRgba[di+2]=im.rgba[si+2];outRgba[di+3]=im.rgba[si+3];
 }
 return{width:nw,height:nh,gray:outG,rgba:outRgba};
}
function integral(im:GrayImage){
 const W=im.width+1,H=im.height+1,ii=new Uint32Array(W*H);
 for(let y=1;y<H;y++){let row=0;for(let x=1;x<W;x++){row+=im.gray[(y-1)*im.width+(x-1)];ii[y*W+x]=ii[(y-1)*W+x]+row;}}
 return{ii,w:im.width,h:im.height};
}
function rectMean(I:any,x:number,y:number,w:number,h:number){
 const x1=clamp(Math.round(x),0,I.w),y1=clamp(Math.round(y),0,I.h),x2=clamp(Math.round(x+w),0,I.w),y2=clamp(Math.round(y+h),0,I.h),W=I.w+1,n=Math.max(1,(x2-x1)*(y2-y1));
 return(I.ii[y2*W+x2]-I.ii[y1*W+x2]-I.ii[y2*W+x1]+I.ii[y1*W+x1])/n;
}
function findSquare(I:any,zone:number[],ex:number,ey:number){
 const sizes=[.008,.010,.013,.016,.020].map(f=>Math.max(7,Math.round(I.w*f)));let best:any=null;
 for(const size of sizes){const half=Math.floor(size/2),step=Math.max(2,Math.floor(size/3));
  const x0=Math.max(half,Math.floor(I.w*zone[0])),x1=Math.min(I.w-half,Math.ceil(I.w*zone[1])),y0=Math.max(half,Math.floor(I.h*zone[2])),y1=Math.min(I.h-half,Math.ceil(I.h*zone[3]));
  for(let y=y0;y<=y1;y+=step)for(let x=x0;x<=x1;x+=step){
   const core=rectMean(I,x-half,y-half,size,size),outer=rectMean(I,x-size,y-size,size*2,size*2),contrast=outer-core,prox=(Math.abs(x/I.w-ex)*40+Math.abs(y/I.h-ey)*60),score=(255-core)*.70+contrast*.50-prox*20;
   if(contrast<10||core>170)continue;if(!best||score>best.score)best={x,y,size,score,core,contrast};
  }
 }return best;
}
function otsuThreshold(im:GrayImage,y0f=.34,y1f=.90){
 const hist=new Uint32Array(256),y0=Math.max(0,Math.floor(im.height*y0f)),y1=Math.min(im.height,Math.ceil(im.height*y1f));
 let total=0,sum=0;
 for(let y=y0;y<y1;y++)for(let x=0;x<im.width;x++){const g=im.gray[y*im.width+x];hist[g]++;total++;sum+=g;}
 let sumB=0,wB=0,best=0,bestVar=-1;
 for(let t=0;t<256;t++){wB+=hist[t];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=t*hist[t];const mB=sumB/wB,mF=(sum-sumB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>bestVar){bestVar=v;best=t;}}
 return Math.max(55,Math.min(180,best));
}
function binaryIntegral(im:GrayImage,threshold:number){
 const W=im.width+1,H=im.height+1,ii=new Uint32Array(W*H);
 for(let y=1;y<H;y++){let row=0;for(let x=1;x<W;x++){row+=im.gray[(y-1)*im.width+(x-1)]<threshold?1:0;ii[y*W+x]=ii[(y-1)*W+x]+row;}}
 return{ii,w:im.width,h:im.height};
}
function binaryRect(I:any,x:number,y:number,w:number,h:number){
 const x1=clamp(Math.round(x),0,I.w),y1=clamp(Math.round(y),0,I.h),x2=clamp(Math.round(x+w),0,I.w),y2=clamp(Math.round(y+h),0,I.h),W=I.w+1;
 return I.ii[y2*W+x2]-I.ii[y1*W+x2]-I.ii[y2*W+x1]+I.ii[y1*W+x1];
}
function squareCandidates(I:any,zone:number[],expectX:number,expectY:number,maxN=24){
 const sizes=[.0065,.0075,.0085,.0095,.011,.013,.015,.018].map(f=>Math.max(6,Math.round(I.w*f)));
 const raw:any[]=[];
 for(const size of sizes){
   const half=Math.floor(size/2),step=Math.max(2,Math.floor(size/3));
   const x0=Math.max(half,Math.floor(I.w*zone[0])),x1=Math.min(I.w-half,Math.ceil(I.w*zone[1]));
   const y0=Math.max(half,Math.floor(I.h*zone[2])),y1=Math.min(I.h-half,Math.ceil(I.h*zone[3]));
   for(let y=y0;y<=y1;y+=step)for(let x=x0;x<=x1;x+=step){
     const core=binaryRect(I,x-half,y-half,size,size)/(size*size);
     if(core<.55)continue;
     const outer=binaryRect(I,x-size,y-size,size*2,size*2)/(size*size*4),contrast=core-outer;
     if(contrast<.12)continue;
     const prox=Math.abs(x/I.w-expectX)+Math.abs(y/I.h-expectY);
     raw.push({x,y,size,core,outer,contrast,score:core+.70*contrast-.10*prox});
   }
 }
 raw.sort((a,b)=>b.score-a.score);
 const out:any[]=[];
 for(const p of raw){
   if(out.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<Math.max(p.size,q.size)*1.4))continue;
   out.push(p);if(out.length>=maxN)break;
 }
 return out;
}
// Supplement the existing window detector with connected square components.
// This accepts a moved/cropped answer area without mistaking hollow bubbles for markers.
function componentSquares(im:GrayImage,threshold:number){
  const seen=new Uint8Array(im.gray.length),queue=new Uint32Array(im.gray.length),out:any[]=[];
  const minSide=Math.max(5,Math.floor(Math.min(im.width,im.height)*.004));
  const maxSide=Math.max(24,Math.ceil(Math.min(im.width,im.height)*.045));
  for(let p=0;p<im.gray.length;p++){
    if(seen[p]||im.gray[p]>=threshold)continue;
    let head=0,tail=1,count=0,minX=im.width,maxX=0,minY=im.height,maxY=0;
    queue[0]=p;seen[p]=1;
    while(head<tail){
      const q=queue[head++],x=q%im.width,y=Math.floor(q/im.width);count++;
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      const push=(n:number)=>{if(!seen[n]&&im.gray[n]<threshold){seen[n]=1;queue[tail++]=n;}};
      if(x>0)push(q-1);if(x+1<im.width)push(q+1);if(y>0)push(q-im.width);if(y+1<im.height)push(q+im.width);
    }
    const w=maxX-minX+1,h=maxY-minY+1,density=count/(w*h),aspect=w/h;
    if(w<minSide||h<minSide||w>maxSide||h>maxSide||aspect<.72||aspect>1.38||density<.82)continue;
    const size=(w+h)/2;
    out.push({x:(minX+maxX)/2,y:(minY+maxY)/2,size,core:density,score:density+.35,component:true});
  }
  return out; // Preserve alignment markers lower on A4; global top-48 truncation discards them.
}
function detectMarkers(im:GrayImage){
 const threshold=otsuThreshold(im),I=binaryIntegral(im,threshold);
  const components=componentSquares(im,threshold);
  const candidates=(zone:number[],ex:number,ey:number)=>{
    const c=components.filter(p=>p.x>=im.width*zone[0]&&p.x<=im.width*zone[1]&&p.y>=im.height*zone[2]&&p.y<=im.height*zone[3])
      .sort((a,b)=>(b.score-.45*(Math.abs(b.x/im.width-ex)+Math.abs(b.y/im.height-ey)))-
                    (a.score-.45*(Math.abs(a.x/im.width-ex)+Math.abs(a.y/im.height-ey))));
    // Use the original detector as fallback for skewed/fragmented printed squares.
    if(c.length>=2)return c.slice(0,16);
    const original=squareCandidates(I,zone,ex,ey,12);
    return [...c,...original.filter(p=>!c.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<q.size))].slice(0,16);
  };
  // Printed A4 has its answer-template markers in the lower half.
  // A pre-cropped answer panel has four corners near the edges.
  const fullA4=im.height>im.width*1.08;
  const TL=candidates(fullA4?[0,.25,.34,.72]:[0,.45,0,.85],fullA4?.06:.10,fullA4?.53:.59),
        TR=candidates(fullA4?[.75,1,.34,.72]:[.55,1,0,.85],fullA4?.94:.88,fullA4?.53:.59),
        BL=candidates(fullA4?[0,.25,.73,1]:[0,.45,.15,1],fullA4?.06:.10,fullA4?.97:.92),
        BR=candidates(fullA4?[.75,1,.73,1]:[.55,1,.15,1],fullA4?.94:.88,fullA4?.97:.92);
 const target=172/104;let best:any=null;
 for(const tl of TL)for(const tr of TR){
    const topDx=tr.x-tl.x;if(topDx<im.width*.35||Math.abs(tr.y-tl.y)>im.height*.12)continue;
   for(const bl of BL){
     if(bl.y<=tl.y)continue;
     for(const br of BR){
       if(br.y<=tr.y)continue;
        const bottomDx=br.x-bl.x;if(bottomDx<im.width*.35||Math.abs(br.y-bl.y)>im.height*.12)continue;
       const leftDy=bl.y-tl.y,rightDy=br.y-tr.y;
        if(leftDy<im.height*.08||rightDy<im.height*.08)continue;
        if(Math.abs(tl.x-bl.x)>im.width*.18||Math.abs(tr.x-br.x)>im.width*.18)continue;
       const widthRatio=Math.max(topDx,bottomDx)/Math.max(1,Math.min(topDx,bottomDx));if(widthRatio>1.25)continue;
       const dy=(leftDy+rightDy)/2,aspect=((topDx+bottomDx)/2)/dy,aspectErr=Math.abs(Math.log(aspect/target));
       if(aspectErr>.45)continue;
       const sizes=[tl.size,tr.size,bl.size,br.size],sizeRatio=Math.max(...sizes)/Math.max(1,Math.min(...sizes));
       if(sizeRatio>2)continue;
       const horiz=(Math.abs(tr.y-tl.y)+Math.abs(br.y-bl.y))/im.height;
       const vert=(Math.abs(tl.x-bl.x)+Math.abs(tr.x-br.x))/im.width;
       const density=(tl.score+tr.score+bl.score+br.score)/4;
       const score=density-aspectErr*1.8-horiz*4-vert*3-(sizeRatio-1)*.2;
       if(!best||score>best.score)best={tl,tr,bl,br,score,aspectErr};
     }
   }
 }
 if(!best)throw new Error('لم يتم العثور على رباعي علامات محاذاة يطابق هندسة القالب.');
 return{
   tl:best.tl,tr:best.tr,bl:best.bl,br:best.br,
    confidence:clamp(1-best.aspectErr,0,.995),
    detector:'otsu-component-grid-dev',threshold
 };
}
function mapPoint(m:any,x:number,y:number){
 const u=(x-4)/172,v=(y-4)/104,p0=m.tl,p1=m.tr,p2=m.br,p3=m.bl;
 const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x,dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y,den=dx1*dy2-dx2*dy1;
 let g=0,h=0;if(Math.abs(den)>1e-6){g=(dx3*dy2-dx2*dy3)/den;h=(dx1*dy3-dx3*dy1)/den;}
 const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x,c=p0.x,d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y,f=p0.y,z=g*u+h*v+1;
 return{x:(a*u+b*v+c)/z,y:(d*u+e*v+f)/z};
}
function projectiveMapper(m:any){
 const p0=m.tl,p1=m.tr,p2=m.br,p3=m.bl;
 const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x,dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y,den=dx1*dy2-dx2*dy1;
 let g=0,h=0;if(Math.abs(den)>1e-6){g=(dx3*dy2-dx2*dy3)/den;h=(dx1*dy3-dx3*dy1)/den;}
 const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x,c=p0.x,d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y,f=p0.y;
 return(x:number,y:number)=>{
   const u=(x-4)/172,v=(y-4)/104,z=g*u+h*v+1;
   return{x:(a*u+b*v+c)/z,y:(d*u+e*v+f)/z};
 };
}
function warpTemplate(im:GrayImage,m:any,scale=5):GrayImage{
 const w=180*scale,h=112*scale,g=new Uint8Array(w*h),rgba=new Uint8Array(w*h*4),map=projectiveMapper(m);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const p=map((x+.5)/scale,(y+.5)/scale),sx=Math.round(p.x),sy=Math.round(p.y),dst=y*w+x,di=dst*4;
   if(sx>=0&&sy>=0&&sx<im.width&&sy<im.height){
     const src=sy*im.width+sx,si=src*4;g[dst]=im.gray[src];rgba[di]=im.rgba[si];rgba[di+1]=im.rgba[si+1];rgba[di+2]=im.rgba[si+2];rgba[di+3]=255;
   }else{g[dst]=255;rgba[di]=rgba[di+1]=rgba[di+2]=rgba[di+3]=255;}
 }
 return{width:w,height:h,gray:g,rgba};
}

function meanAt(im:GrayImage,cx:number,cy:number,r:number,inner=0){
 let sum=0,n=0,rr=r*r,ii=inner*inner;
 for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
  if(x<0||y<0||x>=im.width||y>=im.height)continue;const dx=x-cx,dy=y-cy,dd=dx*dx+dy*dy;if(dd>rr||dd<ii)continue;sum+=im.gray[y*im.width+x];n++;
 }return n?sum/n:255;
}
function fillScore(im:GrayImage,cx:number,cy:number,r:number){const center=meanAt(im,cx,cy,r*.55),ring=meanAt(im,cx,cy,r*1.55,r*1.05);return{score:(ring-center)/255,center,ring};}
function paperColorAt(im:GrayImage,cx:number,cy:number,r:number){
 const channels:number[][]=[[],[],[]],inner=r*1.35,outer=r*1.80;
 for(let y=Math.floor(cy-outer);y<=Math.ceil(cy+outer);y+=2)
  for(let x=Math.floor(cx-outer);x<=Math.ceil(cx+outer);x+=2){
   if(x<0||y<0||x>=im.width||y>=im.height)continue;
   const d=(x-cx)**2+(y-cy)**2;if(d<inner*inner||d>outer*outer)continue;
   const p=(y*im.width+x)*4;
   for(let c=0;c<3;c++)channels[c].push(im.rgba[p+c]);
  }
 if(channels[0].length<12)throw new Error('تعذر قياس لون الورق حول الفقاعة؛ يلزم مراجعة الصورة.');
 // Median suppresses printed rings/neighboring ink; no answer key is consulted.
 return channels.map(median);
}
function bluePixelWeight(R:number,G:number,B:number,paper?:number[]){
 if(paper){
  // Compare ink to local paper, not an assumed neutral-white camera image.
  R=clamp(R*255/Math.max(40,paper[0]),0,255);
  G=clamp(G*255/Math.max(40,paper[1]),0,255);
  B=clamp(B*255/Math.max(40,paper[2]),0,255);
 }
 const chroma=Math.max(R,G,B)-Math.min(R,G,B),blueDom=B-Math.max(R,G),mean=(R+G+B)/3;
 if(chroma<22||blueDom<8||mean>=225)return 0;
 return Math.min(1,Math.max(.08,(blueDom-6)/70));
}
function blueInkAt(im:GrayImage,cx:number,cy:number,r:number,paper?:number[]){
 let hit=0,weighted=0,n=0,rr=r*r;
 for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
   if(x<0||y<0||x>=im.width||y>=im.height)continue;
   const dx=x-cx,dy=y-cy;if(dx*dx+dy*dy>rr)continue;
   const p=(y*im.width+x)*4,w=bluePixelWeight(im.rgba[p],im.rgba[p+1],im.rgba[p+2],paper);
   if(w>0){hit++;weighted+=w;}n++;
 }
  return{density:n?hit/n:0,weighted:n?weighted/n:0,hits:hit,mass:weighted};
}
function rowBlueEvidence(im:GrayImage,centers:any[],rowGap:number,optionGap:number,papers:number[][]){
 const xs=centers.map(p=>p.x),ys=centers.map(p=>p.y),minX=Math.max(0,Math.floor(Math.min(...xs)-optionGap*.48)),maxX=Math.min(im.width-1,Math.ceil(Math.max(...xs)+optionGap*.48));
 const minY=Math.max(0,Math.floor(Math.min(...ys)-rowGap*.42)),maxY=Math.min(im.height-1,Math.ceil(Math.max(...ys)+rowGap*.42));
 const mass=[0,0,0,0],hits=[0,0,0,0];
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
   let best=-1,bestD=Infinity;
   for(let j=0;j<4;j++){
     const dx=(x-centers[j].x)/Math.max(1,optionGap),dy=(y-centers[j].y)/Math.max(1,rowGap),d=dx*dx+dy*dy*1.35;
     if(d<bestD){bestD=d;best=j;}
   }
   if(best>=0&&bestD<=.38){
    const p=(y*im.width+x)*4,w=bluePixelWeight(im.rgba[p],im.rgba[p+1],im.rgba[p+2],papers[best]);
    if(w>0){mass[best]+=w;hits[best]++;}
   }
 }
 const norm=Math.max(1,optionGap*rowGap*.18);
 return{mass,hits,scores:mass.map(x=>x/norm)};
}
function rowDarkEvidence(im:GrayImage,centers:any[],rowGap:number,optionGap:number){
 const scores=[0,0,0,0],hits=[0,0,0,0],pixels=[0,0,0,0];
 const rx=Math.max(5,optionGap*.34),ry=Math.max(4,rowGap*.33);
 for(let j=0;j<4;j++){
   const cx=centers[j].x,cy=centers[j].y;
   const x0=Math.max(0,Math.floor(cx-rx)),x1=Math.min(im.width-1,Math.ceil(cx+rx));
   const y0=Math.max(0,Math.floor(cy-ry)),y1=Math.min(im.height-1,Math.ceil(cy+ry));
   let sum=0,n=0,h=0;
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy>1)continue;
     const g=im.gray[y*im.width+x],w=Math.max(0,(210-g)/110);
     if(g<190)h++;sum+=Math.min(1,w);n++;
   }
   scores[j]=n?sum/n:0;hits[j]=h;pixels[j]=n;
 }
 return{scores,hits,pixels};
}


// Locate the printed rings, not the chosen answers. No answer key is consulted.
function locateBubbleGrid(im:GrayImage,scale:number){
  const rights=[171,128,85,42],offs=[7.5,15.5,23.5,31.5],radius=2.08*scale;
  // The current printable SVG uses 20/5.45 mm. Older actual MR2 A4 prints
  // have different row origin/pitch: calibrate from printed empty bubble rings,
  // not answer choices, colors, or a student's score.
  // Registered print profiles only: the unconstrained Cartesian search aliases
  // bubble rings and silently shifted the grid on three of six actual sheets.
  // Unknown geometries must be rejected, never auto-graded.
  const registeredProfiles=[{start:20,step:5.45,name:'current_print'},{start:29,step:4.8,name:'legacy_candidate_requires_review'}];
  const ringEvidence=(right:number,row:number,off:number,rowStart:number,rowStep:number,dx=0,dy=0)=>{
    const x=(right-off)*scale+dx,y=(rowStart+row*rowStep)*scale+dy;
    const ring=meanAt(im,x,y,radius*1.13,radius*.87);
    const paper=meanAt(im,x,y,radius*1.65,radius*1.3);
    return Math.max(0,(paper-ring)/255);
  };
  const scored=[] as {start:number;step:number;score:number}[];
  for(const {start,step} of registeredProfiles){
    const values:number[]=[];
    for(const right of rights)for(let row=0;row<15;row++)for(const off of offs)
       values.push(ringEvidence(right,row,off,start,step));
    scored.push({start,step,score:median(values)});
  }
  scored.sort((a,b)=>b.score-a.score);
  const candidate=scored[0],runner=scored[1],rowStart=candidate.start,rowStep=candidate.step;
  const blocks=rights.map(right=>{
    const evidence=(dx:number,dy:number)=>{
      const values:number[]=[];
      for(const row of [0,7,14])for(const off of offs)
        values.push(ringEvidence(right,row,off,rowStart,rowStep,dx,dy));
      return median(values);
    };
    const initial=evidence(0,0);let best={dx:0,dy:0,score:initial};
    for(let dy=-6;dy<=6;dy+=2)for(let dx=-6;dx<=6;dx+=2){
      const score=evidence(dx,dy);if(score>best.score+.001)best={dx,dy,score};
    }
    const coarse={...best};
    for(let dy=coarse.dy-1;dy<=coarse.dy+1;dy++)for(let dx=coarse.dx-1;dx<=coarse.dx+1;dx++){
      if(Math.abs(dx)>6||Math.abs(dy)>6)continue;
      const score=evidence(dx,dy);if(score>best.score+.001)best={dx,dy,score};
    }
    return best.score-initial>=.018?best:{dx:0,dy:0,score:initial};
  });
  return{blocks,score:median(blocks.map(b=>b.score)),
    rowStart,rowStep,nominal:rowStart===20&&rowStep===5.45,
    candidate_margin:Number((candidate.score-(runner?.score||0)).toFixed(4)),
    layout:rowStart===20&&rowStep===5.45?'current_print':'legacy_candidate_requires_review'};
}

function orientTemplate(source:GrayImage,scale:number){
 const candidates:any[]=[],attempts:any[]=[];let im=source;
 for(let turn=0;turn<4;turn++){
   try{
     const m=detectMarkers(im),warped=warpTemplate(im,m,scale),grid=locateBubbleGrid(warped,scale);
     candidates.push({m,im:warped,grid,rotation:turn*90});
     attempts.push({rotation:turn*90,geometry:'found',marker_confidence:Number(m.confidence.toFixed(3)),
       threshold:m.threshold,grid_score:Number(grid.score.toFixed(4))});
   }catch(e:any){
     const msg=String(e?.message||e);
     attempts.push({rotation:turn*90,geometry:'rejected',reason:msg.slice(0,160)});
     if(!msg.includes('علامات محاذاة'))throw e;
   }
   im=rotate90(im);
 }
 candidates.sort((a,b)=>b.grid.score-a.grid.score);
 const best=candidates[0],runner=candidates[1];
 const diag={image_width:source.width,image_height:source.height,
   expected_template_mm:{width:180,height:112,marker_centers:[[4,4],[176,4],[4,108],[176,108]],marker_size:3},
   min_grid_score:.07,rotations:attempts};
 if(!best||best.grid.score<.07)throw new OMRReadFailure(
   'OMR_GRID_NOT_VERIFIED','لم يتم العثور على علامات محاذاة وشبكة فقاعات موثوقة للقالب.',diag);
 if(runner&&best.grid.score-runner.grid.score<.025)throw new OMRReadFailure(
   'OMR_ROTATION_AMBIGUOUS','اتجاه الورقة غير حاسم؛ يلزم مراجعة الصورة.',
   {...diag,best_rotation:best.rotation,runner_rotation:runner.rotation,grid_gap:Number((best.grid.score-runner.grid.score).toFixed(4))});
 return best;
}
export function readOmrJpeg(src:string,total:number,startNo=1){
  if(!Number.isInteger(total)||total<1||total>60)throw new Error('عدد أسئلة القالب لا يطابق الاختبار.');
  const source=decodeDataUrl(src),scale=5;
  let oriented:any,preprocessing:any={mode:'original'};
  try{oriented=orientTemplate(source,scale);}
  catch(e:any){
    if(e?.code!=='OMR_GRID_NOT_VERIFIED')throw e;
    try{
      const enhanced=enhanceGeometryGray(source);
      oriented=orientTemplate(enhanced.image,scale);
      preprocessing={mode:'enhanced_geometry_requires_review',...enhanced.diagnostics};
    }catch(second:any){
      throw new OMRReadFailure('OMR_GRID_NOT_VERIFIED',e.message,{
        ...e.diagnostics,preprocessing_attempted:true,
        enhanced_failure_code:second?.code||'OMR_FALLBACK_REJECTED',
        enhanced_failure_reason:String(second?.message||second).slice(0,160)});
    }
  }
  const {m,im,grid,rotation}=oriented,radius=2.08*scale;
 const rights=[171,128,85,42],offs=[7.5,15.5,23.5,31.5],raw:any[]=[];
 const rowGap=grid.rowStep*scale,optionGap=8*scale;
 for(let i=0;i<Math.min(total,60);i++){
  const block=Math.floor(i/15),row=i%15,y=(grid.rowStart+row*grid.rowStep)*scale,right=rights[block],ev:any[]=[],centers:any[]=[];
   const alignment=grid.blocks[block];
   for(const off of offs){const p={x:(right-off)*scale+alignment.dx,y:y+alignment.dy};centers.push(p);const z=fillScore(im,p.x,p.y,radius);ev.push({...z,x:p.x,y:p.y});}
  const papers=centers.map(p=>paperColorAt(im,p.x,p.y,radius));
  const blue=rowBlueEvidence(im,centers,rowGap,optionGap,papers),dark=rowDarkEvidence(im,centers,rowGap,optionGap);
  for(let j=0;j<4;j++){
    ev[j].blueMass=blue.mass[j];ev[j].blueHits=blue.hits[j];ev[j].blueRowScore=blue.scores[j];
    ev[j].darkRowScore=dark.scores[j];ev[j].darkHits=dark.hits[j];
     const inside=blueInkAt(im,centers[j].x,centers[j].y,radius*.96,papers[j]);
     ev[j].paperGray=papers[j][0]*.299+papers[j][1]*.587+papers[j][2]*.114;
     ev[j].blueInsideMass=inside.mass;ev[j].blueInsideHits=inside.hits;
  }
  raw.push(ev);
 }
 if(raw.length!==total)throw new Error('عدد أسئلة القالب لا يطابق الاختبار.');
 const vals=raw.flat().map((x:any)=>Number(x.score)),base=median(vals),mad=median(vals.map((x:number)=>Math.abs(x-base))),possible=clamp(base+Math.max(.018,mad*2.4),.012,.032),definite=clamp(base+Math.max(.028,mad*3.5),.025,.052),sepThr=clamp(Math.max(.024,mad*2.2),.020,.042);
 const answers=raw.map((ev:any[],i:number)=>{
   const blueOrder=ev.map((e:any,j:number)=>({j,m:Number(e.blueInsideMass||0),h:Number(e.blueInsideHits||0),s:Number(e.blueRowScore||0)})).sort((a:any,b:any)=>b.m-a.m);
  const blueTop=blueOrder[0],blueSecond=blueOrder[1],blueSep=blueTop.m-blueSecond.m;
  const hasBlue=blueTop.m>=5&&blueTop.h>=4,strongBlue=blueTop.m>=9&&blueTop.h>=7&&blueSep>=3;
  const multipleBlue=blueSecond.m>=7&&blueSecond.h>=5&&blueSecond.m/Math.max(1,blueTop.m)>=.48;

  const darkRowScores=ev.map((e:any)=>Number(e.darkRowScore||0)),darkRowOrder=darkRowScores.map((v:number,j:number)=>({j,v})).sort((a:any,b:any)=>b.v-a.v);
  const darkRowTop=darkRowOrder[0],darkRowSecond=darkRowOrder[1],darkRowBase=median(darkRowScores),darkRowLift=darkRowTop.v-darkRowBase,darkRowSep=darkRowTop.v-darkRowSecond.v;
  const darkRowMultiple=darkRowSecond.v>=.105&&(darkRowSecond.v-darkRowBase)>=.028&&darkRowSecond.v/Math.max(.001,darkRowTop.v)>=.62;
  const darkRowClear=darkRowTop.v>=.115&&darkRowLift>=.038&&darkRowSep>=.022;
  const darkRowPossible=darkRowTop.v>=.085&&darkRowLift>=.022&&darkRowSep>=.012;

  const centerOrder=ev.map((e:any,j:number)=>({j,v:Number(e.center)})).sort((a:any,b:any)=>a.v-b.v);
  const centerTop=centerOrder[0],centerSecond=centerOrder[1],centerValues=ev.map((e:any)=>Number(Number(e.center).toFixed(1)));
  const centerBase=median(centerValues),centerLift=centerBase-centerTop.v,centerGap=centerSecond.v-centerTop.v,secondLift=centerBase-centerSecond.v;
  const darkMultiple=centerLift>=16&&secondLift>=14&&centerGap<9,darkClear=centerLift>=18&&centerGap>=10&&centerTop.v<=228,darkPossible=centerLift>=11&&centerGap>=6&&centerTop.v<=235;

  const grayOrder=ev.map((e:any,j:number)=>({j,s:e.score})).sort((a:any,b:any)=>b.s-a.s),top=grayOrder[0],second=grayOrder[1],sep=top.s-second.s;
  const scores=ev.map((x:any)=>Number(x.score.toFixed(4))),blueScores=ev.map((x:any)=>Number(Number(x.blueRowScore||0).toFixed(4))),darkScores=darkRowScores.map((x:number)=>Number(x.toFixed(4)));
  const rowBase=median(scores),lift=top.s-rowBase;
  const relativeClear=sep>=Math.max(.055,sepThr*1.15)&&lift>=.075,relativeStrong=sep>=.12&&lift>=.12;
  const ratio=(top.s>0&&second.s>0)?second.s/top.s:0,strongSecond=top.s>=definite&&second.s>=definite&&ratio>=.55,weakCompetition=top.s>=possible&&second.s>=possible&&ratio>=.42;

   if(hasBlue){
     const blueMarked=blueOrder.filter((x:any)=>x.m>=7&&x.h>=5&&x.m/Math.max(1,blueTop.m)>=.48).map((x:any)=>x.j);
     const darkMarked=darkRowOrder.filter((x:any)=>x.v>=.105&&(x.v-darkRowBase)>=.028).map((x:any)=>x.j);
     const combined=[...new Set([...blueMarked,...darkMarked])];
     if(combined.length>1)return{question:startNo+i,selected:blueTop.j,status:'multiple',marked:combined,scores,blueScores,darkScores,centerValues,reader:'mixed-ink',confidence:.45,topScore:blueTop.m,secondScore:blueSecond.m,threshold:5,separation:blueSep};
     // A tiny second mark may be an intended answer or an erasure/speck.
     // Require agreeing interior and local-paper contrast, then request review;
     // do not force "multiple" or silently auto-accept the dominant blue answer.
     const competing=ev.map((e:any,j:number)=>({j,e})).filter(({j,e}:any)=>
      !blueMarked.includes(j)&&e.score>=definite&&e.paperGray-e.center>=18).map((x:any)=>x.j);
     if(strongBlue&&competing.length)return{question:startNo+i,selected:blueTop.j,status:'ambiguous',marked:[...new Set([blueTop.j,...competing])],scores,blueScores,darkScores,centerValues,reader:'mixed-ink-review',confidence:.70,topScore:blueTop.m,secondScore:blueSecond.m,threshold:5,separation:blueSep};
    if(multipleBlue){
      const marked=blueOrder.filter((x:any)=>x.m>=7&&x.h>=5&&x.m/Math.max(1,blueTop.m)>=.48).map((x:any)=>x.j);
      return{question:startNo+i,selected:blueTop.j,status:'multiple',marked,scores,blueScores,darkScores,centerValues,reader:'blue-row',confidence:.45,topScore:blueTop.m,secondScore:blueSecond.m,threshold:5,separation:blueSep};
    }
    if(strongBlue)return{question:startNo+i,selected:blueTop.j,status:'clear',marked:[blueTop.j],scores,blueScores,darkScores,centerValues,reader:'blue-row',confidence:Math.min(1,.94+Math.min(.05,blueSep/80)),topScore:blueTop.m,secondScore:blueSecond.m,threshold:5,separation:blueSep};
    return{question:startNo+i,selected:blueTop.j,status:'ambiguous',marked:[blueTop.j],scores,blueScores,darkScores,centerValues,reader:'blue-row',confidence:.72,topScore:blueTop.m,secondScore:blueSecond.m,threshold:5,separation:blueSep};
  }

  if(darkRowMultiple){
    const marked=darkRowOrder.filter((x:any)=>x.v>=.105&&(x.v-darkRowBase)>=.028&&x.v/Math.max(.001,darkRowTop.v)>=.62).map((x:any)=>x.j);
    return{question:startNo+i,selected:darkRowTop.j,status:'multiple',marked,scores,blueScores,darkScores,centerValues,reader:'dark-row',confidence:.47,topScore:darkRowTop.v,secondScore:darkRowSecond.v,threshold:.115,separation:darkRowSep};
  }
  if(darkRowClear)return{question:startNo+i,selected:darkRowTop.j,status:'clear',marked:[darkRowTop.j],scores,blueScores,darkScores,centerValues,reader:'dark-row',confidence:Math.min(.99,.91+Math.min(.07,darkRowSep*.7)+Math.min(.04,darkRowLift*.35)),topScore:darkRowTop.v,secondScore:darkRowSecond.v,threshold:.115,separation:darkRowSep};
   // Do not let a weaker wide-row measurement veto a strong, agreeing center.
   // Disagreeing evidence still remains ambiguous rather than being forced clear.
   if(darkRowPossible&&!(darkClear&&centerTop.j===darkRowTop.j))return{question:startNo+i,selected:darkRowTop.j,status:'ambiguous',marked:[darkRowTop.j],scores,blueScores,darkScores,centerValues,reader:'dark-row',confidence:.74,topScore:darkRowTop.v,secondScore:darkRowSecond.v,threshold:.115,separation:darkRowSep};

  if(darkMultiple){
    const marked=centerOrder.filter((x:any)=>centerBase-x.v>=14).map((x:any)=>x.j);
    return{question:startNo+i,selected:centerTop.j,status:'multiple',marked,scores,blueScores,darkScores,centerValues,reader:'center-dark',confidence:.46,topScore:centerLift,secondScore:secondLift,threshold:18,separation:centerGap};
  }
  if(darkClear)return{question:startNo+i,selected:centerTop.j,status:'clear',marked:[centerTop.j],scores,blueScores,darkScores,centerValues,reader:'center-dark',confidence:Math.min(.99,.91+Math.min(.08,centerGap/120)+Math.min(.04,centerLift/300)),topScore:centerLift,secondScore:secondLift,threshold:18,separation:centerGap};
  if(darkPossible)return{question:startNo+i,selected:centerTop.j,status:'ambiguous',marked:[centerTop.j],scores,blueScores,darkScores,centerValues,reader:'center-dark',confidence:.74,topScore:centerLift,secondScore:secondLift,threshold:18,separation:centerGap};

  if(!relativeClear&&top.s<possible)return{question:startNo+i,selected:null,status:'blank',marked:[],scores,blueScores,darkScores,centerValues,reader:'gray',confidence:.96,topScore:top.s,secondScore:second.s,threshold:possible,separation:sep};
  if(strongSecond&&sep<.060)return{question:startNo+i,selected:top.j,status:'multiple',marked:grayOrder.filter((x:any)=>x.s>=definite&&x.s/top.s>=.55).map((x:any)=>x.j),scores,blueScores,darkScores,centerValues,reader:'gray',confidence:Math.min(.49,sep/Math.max(.01,sepThr)),topScore:top.s,secondScore:second.s,threshold:definite,separation:sep};
  if(!relativeStrong&&(sep<sepThr||weakCompetition||(top.s<definite&&!relativeClear)))return{question:startNo+i,selected:top.j,status:'ambiguous',marked:[top.j],scores,blueScores,darkScores,centerValues,reader:'gray',confidence:Math.min(.79,.5+Math.max(0,lift)*1.8+sep*1.5),topScore:top.s,secondScore:second.s,threshold:definite,separation:sep};
  return{question:startNo+i,selected:top.j,status:'clear',marked:[top.j],scores,blueScores,darkScores,centerValues,reader:'gray',confidence:Math.min(1,.93+Math.min(.06,sep*.12)+Math.min(.03,Math.max(0,lift)*.08)),topScore:top.s,secondScore:second.s,threshold:definite,separation:sep};
 });
 const ambiguous=answers.filter((a:any)=>a.status==='ambiguous').length,multiple=answers.filter((a:any)=>a.status==='multiple').length;
  const geometryUncertain=m.confidence<.85||grid.score<.10;
  const enhancedPreprocessing=preprocessing.mode!=='original'||grid.layout!=='current_print';
   const requiresReview=!!(ambiguous||multiple||geometryUncertain||enhancedPreprocessing);
  return{answers,markers_ok:true,marker_confidence:Number(m.confidence.toFixed(3)),detector:String(m.detector||'otsu-component-grid-dev'),rotation,preprocessing,
   color_calibration:{method:'local-paper-annular-median',weak_second_ink:'manual-review'},
   grid_alignment:{score:Number(grid.score.toFixed(4)),row_start_mm:grid.rowStart,row_step_mm:grid.rowStep,layout:grid.layout,blocks:grid.blocks.map((b:any)=>({dx:b.dx,dy:b.dy,score:Number(b.score.toFixed(4))}))},
  marker_points:{tl:[m.tl.x,m.tl.y],tr:[m.tr.x,m.tr.y],bl:[m.bl.x,m.bl.y],br:[m.br.x,m.br.y]},
  calibration:{baseline:Number(base.toFixed(4)),mad:Number(mad.toFixed(4)),possible:Number(possible.toFixed(4)),definite:Number(definite.toFixed(4)),separation:Number(sepThr.toFixed(4))},
   verification:{risk:requiresReview?'high':'low',quality_score:requiresReview?70:100,reasons:[...(ambiguous||multiple?['توجد إجابات غير حاسمة أو متعددة']:[]),...(geometryUncertain?['هندسة علامات المحاذاة أو شبكة الفقاعات تحتاج مراجعة']:[]),
      ...(enhancedPreprocessing?['تحسين تعرض وضجيج الصورة؛ تتطلب مراجعة بشرية قبل اعتماد الدرجة']:[])],requires_manual_review:requiresReview,auto_accept:!requiresReview,counts:{ambiguous,multiple,blank:answers.filter((a:any)=>a.status==='blank').length,low_margin:0,clear:answers.filter((a:any)=>a.status==='clear').length}}
 };
}
