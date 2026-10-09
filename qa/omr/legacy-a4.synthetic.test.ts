// Fully synthetic A4 regression for the real-world lower-half MR2 layout.
// No student names, school IDs, or actual images are embedded.
import jpeg from 'npm:jpeg-js@0.4.4';
import {readOmrJpeg} from '../../supabase/functions/nafes-exam/omr-server.ts';
const W=1367,H=1821;
const image=new Uint8Array(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 const paper=246-Math.round(15*y/H)+(((x*13+y*17)%9)-4);
 image[i]=image[i+1]=image[i+2]=paper;image[i+3]=255;
}
function pixel(x:number,y:number,v:number,blue=false){
 x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=W||y>=H)return;
 const i=(y*W+x)*4;image[i]=blue?38:v;image[i+1]=blue?86:v;image[i+2]=blue?151:v;
}
function square(x:number,y:number,side:number,gray=36){
 for(let dy=-side/2;dy<=side/2;dy++)for(let dx=-side/2;dx<=side/2;dx++)pixel(x+dx,y+dy,gray);
}
const P={tl:[89,958],tr:[1278,952],bl:[80,1784],br:[1292,1763]};
function map(u:number,v:number){
 const tl=P.tl,tr=P.tr,bl=P.bl,br=P.br;
 return [(1-u)*(1-v)*tl[0]+u*(1-v)*tr[0]+(1-u)*v*bl[0]+u*v*br[0],
         (1-u)*(1-v)*tl[1]+u*(1-v)*tr[1]+(1-u)*v*bl[1]+u*v*br[1]];
}
for(const xy of Object.values(P))square(xy[0],xy[1],20,35);
// QR-like nuisance dark squares in the *top* of the A4 document.
for(let y=50;y<180;y+=11)for(let x=145;x<275;x+=11){
 if(((x+y)%5)>1)square(x,y,6,37);
}
const rights=[171,128,85,42],offs=[7.5,15.5,23.5,31.5];
for(let n=0;n<60;n++){
 const block=Math.floor(n/15),row=n%15;
 for(let j=0;j<4;j++){
   const px=rights[block]-offs[j],py=29+4.85*row;
   const [cx,cy]=map((px-4)/172,(py-4)/104);
   for(let dy=-18;dy<=18;dy++)for(let dx=-18;dx<=18;dx++){
     const d=Math.hypot(dx,dy);if(Math.abs(d-14)<2.2)pixel(cx+dx,cy+dy,58);
     if(j===n%4&&n%8!==0&&d<11)pixel(cx+dx,cy+dy,60,n%3===0);
   }
 }
}
const bytes=jpeg.encode({width:W,height:H,data:image},87).data;
const dataUrl='data:image/jpeg;base64,'+btoa(String.fromCharCode(...bytes.subarray(0,32768)))+
  (()=>{let b='';for(let i=32768;i<bytes.length;i+=32768)b+=btoa(String.fromCharCode(...bytes.subarray(i,Math.min(i+32768,bytes.length))));return b})();
const b64=(()=>{let str='';for(let i=0;i<bytes.length;i+=10000)str+=String.fromCharCode(...bytes.subarray(i,Math.min(i+10000,bytes.length)));return btoa(str)})();
const result=readOmrJpeg('data:image/jpeg;base64,'+b64,60,1);
const grid=result.grid_alignment||{};
console.log(JSON.stringify({markers_ok:result.markers_ok,detector:result.detector,rotation:result.rotation,
 grid_score:grid.score,row_start_mm:grid.row_start_mm,row_step_mm:grid.row_step_mm,layout:grid.layout,
 answer_count:result.answers?.length,clear:result.answers?.filter((a:any)=>a.status==='clear').length}));
if(!result.markers_ok||result.answers?.length!==60||grid.score<.07||
 Math.abs(grid.row_start_mm-29)>2||Math.abs(grid.row_step_mm-4.85)>.35){
 console.error('OMR_A4_LEGACY_CALIBRATION_REJECTED');Deno.exit(1);
}
console.log('OMR_A4_LEGACY_CALIBRATION_PASS');

// A low-exposure phone photo: printed ink remains separated from paper by
// only ~20 grayscale levels, and QR noise stays above the normal dark threshold.
const dim=new Uint8Array(image);
for(let i=0;i<dim.length;i+=4){
 const v=Math.round(210-(232-image[i])*.12);
 dim[i]=dim[i+1]=dim[i+2]=v;
}
const weakJpeg=jpeg.encode({width:W,height:H,data:dim},87).data;
let weakBinary='';for(let i=0;i<weakJpeg.length;i+=10000)
 weakBinary+=String.fromCharCode(...weakJpeg.subarray(i,Math.min(i+10000,weakJpeg.length)));
const weakResult=readOmrJpeg('data:image/jpeg;base64,'+btoa(weakBinary),60,1);
console.log(JSON.stringify({low_exposure:true,markers_ok:weakResult.markers_ok,
 preprocessing:weakResult.preprocessing?.mode,needs_manual:weakResult.verification?.requires_manual_review,
 grid_score:weakResult.grid_alignment?.score}));
if(weakResult.markers_ok!==true||weakResult.preprocessing?.mode!=='enhanced_geometry_requires_review'||
 weakResult.verification?.requires_manual_review!==true){
 console.error('OMR_LOW_EXPOSURE_SAFE_FALLBACK_FAILED');Deno.exit(1);
}
console.log('OMR_LOW_EXPOSURE_SAFE_FALLBACK_PASS');

