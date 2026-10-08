import jpeg from "npm:jpeg-js@0.4.4";

type GrayImage={width:number;height:number;gray:Uint8Array};
type Point={x:number;y:number;score?:number};
const median=(a:number[])=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),n=b.length;return n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2;};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

function decodeDataUrl(src:string):GrayImage{
 const m=String(src||'').match(/^data:image\/jpeg;base64,(.+)$/s);
 if(!m)throw new Error('الصورة المخزنة ليست JPEG صالحًا للقراءة الخادمية.');
 const bin=atob(m[1]),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 const d:any=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true});
 if(!d?.width||!d?.height||!d?.data)throw new Error('تعذر فك ترميز صورة الورقة.');
 const g=new Uint8Array(d.width*d.height);
 for(let i=0,j=0;i<d.data.length;i+=4,j++)g[j]=Math.round(d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114);
 return d.width<=d.height?{width:d.width,height:d.height,gray:g}:rotate90({width:d.width,height:d.height,gray:g});
}
function rotate90(im:GrayImage):GrayImage{
 const out=new Uint8Array(im.width*im.height),nw=im.height,nh=im.width;
 for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const nx=im.height-1-y,ny=x;out[ny*nw+nx]=im.gray[y*im.width+x];}
 return{width:nw,height:nh,gray:out};
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
function detectMarkers(im:GrayImage){
 const I=integral(im);
 const tl=findSquare(I,[.035,.145,.40,.52],.079,.461),tr=findSquare(I,[.75,.91,.39,.51],.823,.449),bl=findSquare(I,[.035,.15,.64,.79],.082,.720),br=findSquare(I,[.75,.94,.63,.79],.847,.708);
 if(!tl||!tr||!bl||!br)throw new Error('لم تُكتشف المربعات السوداء الأربعة في الصورة المخزنة.');
 const topDx=tr.x-tl.x,bottomDx=br.x-bl.x,leftDy=bl.y-tl.y,rightDy=br.y-tr.y;
 if(topDx<im.width*.52||bottomDx<im.width*.52||leftDy<im.height*.18||rightDy<im.height*.18)throw new Error('هندسة مربعات المحاذاة غير مكتملة.');
 const target=172/104,aspect=((topDx+bottomDx)/2)/((leftDy+rightDy)/2),err=Math.abs(Math.log(aspect/target));
 if(err>.36)throw new Error('منظور الورقة خارج حدود القالب.');
 return{tl,tr,bl,br,confidence:Math.max(.90,1-err)};
}
function mapPoint(m:any,x:number,y:number){
 const u=(x-4)/172,v=(y-4)/104,p0=m.tl,p1=m.tr,p2=m.br,p3=m.bl;
 const dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x,dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y,den=dx1*dy2-dx2*dy1;
 let g=0,h=0;if(Math.abs(den)>1e-6){g=(dx3*dy2-dx2*dy3)/den;h=(dx1*dy3-dx3*dy1)/den;}
 const a=p1.x-p0.x+g*p1.x,b=p3.x-p0.x+h*p3.x,c=p0.x,d=p1.y-p0.y+g*p1.y,e=p3.y-p0.y+h*p3.y,f=p0.y,z=g*u+h*v+1;
 return{x:(a*u+b*v+c)/z,y:(d*u+e*v+f)/z};
}
function meanAt(im:GrayImage,cx:number,cy:number,r:number,inner=0){
 let sum=0,n=0,rr=r*r,ii=inner*inner;
 for(let y=Math.floor(cy-r);y<=Math.ceil(cy+r);y++)for(let x=Math.floor(cx-r);x<=Math.ceil(cx+r);x++){
  if(x<0||y<0||x>=im.width||y>=im.height)continue;const dx=x-cx,dy=y-cy,dd=dx*dx+dy*dy;if(dd>rr||dd<ii)continue;sum+=im.gray[y*im.width+x];n++;
 }return n?sum/n:255;
}
function fillScore(im:GrayImage,cx:number,cy:number,r:number){const center=meanAt(im,cx,cy,r*.55),ring=meanAt(im,cx,cy,r*1.55,r*1.05);return{score:(ring-center)/255,center,ring};}

export function readOmrJpeg(src:string,total:number,startNo=1){
 const im=decodeDataUrl(src),m=detectMarkers(im),topSpan=Math.hypot(m.tr.x-m.tl.x,m.tr.y-m.tl.y),bottomSpan=Math.hypot(m.br.x-m.bl.x,m.br.y-m.bl.y),radius=clamp(((topSpan+bottomSpan)/2)*.0082,3.2,7.5);
 const rights=[171,128,85,42],offs=[7.5,15.5,23.5,31.5],raw:any[]=[];
 for(let i=0;i<Math.min(total,60);i++){const block=Math.floor(i/15),row=i%15,y=20+row*5.45,right=rights[block],ev=[];
  for(const off of offs){const p=mapPoint(m,right-off,y),z=fillScore(im,p.x,p.y,radius);ev.push({...z,x:p.x,y:p.y});}raw.push(ev);
 }
 if(raw.length!==total)throw new Error('عدد أسئلة القالب لا يطابق الاختبار.');
 const vals=raw.flat().map((x:any)=>Number(x.score)),base=median(vals),mad=median(vals.map((x:number)=>Math.abs(x-base))),possible=clamp(base+Math.max(.018,mad*2.4),.012,.032),definite=clamp(base+Math.max(.028,mad*3.5),.025,.052),sepThr=clamp(Math.max(.024,mad*2.2),.020,.042);
 const answers=raw.map((ev:any[],i:number)=>{const order=ev.map((e:any,j:number)=>({j,s:e.score})).sort((a:any,b:any)=>b.s-a.s),top=order[0],second=order[1],sep=top.s-second.s,defs=order.filter((x:any)=>x.s>=definite),poss=order.filter((x:any)=>x.s>=possible),scores=ev.map((x:any)=>Number(x.score.toFixed(4)));
  if(top.s<possible)return{question:startNo+i,selected:null,status:'blank',marked:[],scores,confidence:.96,topScore:top.s,secondScore:second.s,threshold:possible,separation:sep};
  if(defs.length>1)return{question:startNo+i,selected:top.j,status:'multiple',marked:defs.map((x:any)=>x.j),scores,confidence:Math.min(.49,sep/Math.max(.01,sepThr)),topScore:top.s,secondScore:second.s,threshold:definite,separation:sep};
  if(poss.length>1||top.s<definite||sep<sepThr)return{question:startNo+i,selected:top.j,status:'ambiguous',marked:[top.j],scores,confidence:Math.min(.79,.5+(top.s-possible)*6+sep*4),topScore:top.s,secondScore:second.s,threshold:definite,separation:sep};
  return{question:startNo+i,selected:top.j,status:'clear',marked:[top.j],scores,confidence:Math.min(1,.94+(top.s-definite)*.45+sep*.30),topScore:top.s,secondScore:second.s,threshold:definite,separation:sep};
 });
 const ambiguous=answers.filter((a:any)=>a.status==='ambiguous').length,multiple=answers.filter((a:any)=>a.status==='multiple').length;
 return{answers,markers_ok:true,marker_confidence:Number(m.confidence.toFixed(3)),detector:'server-jpeg-homography-v1',
  marker_points:{tl:[m.tl.x,m.tl.y],tr:[m.tr.x,m.tr.y],bl:[m.bl.x,m.bl.y],br:[m.br.x,m.br.y]},
  calibration:{baseline:Number(base.toFixed(4)),mad:Number(mad.toFixed(4)),possible:Number(possible.toFixed(4)),definite:Number(definite.toFixed(4)),separation:Number(sepThr.toFixed(4))},
  verification:{risk:(ambiguous||multiple)?'high':'low',quality_score:(ambiguous||multiple)?70:100,reasons:(ambiguous||multiple)?['توجد إجابات غير حاسمة أو متعددة']:[],requires_manual_review:!!(ambiguous||multiple),auto_accept:!(ambiguous||multiple),counts:{ambiguous,multiple,blank:answers.filter((a:any)=>a.status==='blank').length,low_margin:0,clear:answers.filter((a:any)=>a.status==='clear').length}}
 };
}
