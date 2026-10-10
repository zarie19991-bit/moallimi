import jpeg from 'npm:jpeg-js@0.4.4';
import {redactedAnswerImage,validateVisionAnswers,compareVisionToOmr} from '../../supabase/functions/nafes-exam/omr-vision-assist.ts';
const assert=(b:boolean,msg:string)=>{if(!b)throw new Error(msg);};
const W=260,H=420,pixels=new Uint8Array(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const j=(y*W+x)*4;
 // Light red identity header; synthetic dark-grid density in lower zone.
 const mark=y>=H*.60&&y<H*.94&&x>=W*.16&&x<W*.91&&(x%12<5);
 const v=mark?[32,34,37]:y<H*.35?[250,210,210]:[222,222,222];
 pixels[j]=v[0];pixels[j+1]=v[1];pixels[j+2]=v[2];pixels[j+3]=255;
}
const encode=(data:Uint8Array,w:number,h:number)=>{
 const bytes=jpeg.encode({width:w,height:h,data},90).data;
 let b='';for(let i=0;i<bytes.length;i+=4096)
   b+=String.fromCharCode(...bytes.subarray(i,Math.min(i+4096,bytes.length)));
 return 'data:image/jpeg;base64,'+btoa(b);
};
const makeTurn=(source:Uint8Array,width:number,height:number,clockwise:boolean)=>{
 const dw=height,dh=width,dest=new Uint8Array(dw*dh*4);
 for(let sy=0;sy<height;sy++)for(let sx=0;sx<width;sx++){
  const dx=clockwise?height-1-sy:sy,dy=clockwise?sx:width-1-sx;
  dest.set(source.subarray((sy*width+sx)*4,(sy*width+sx+1)*4),(dy*dw+dx)*4);
 }
 return encode(dest,dw,dh);
};
for(const [label,url] of [
 ['upright',encode(pixels,W,H)],['camera-cw',makeTurn(pixels,W,H,true)],
 ['camera-ccw',makeTurn(pixels,W,H,false)]
] as [string,string][]){
 const crop=redactedAnswerImage(url);
 const data=Uint8Array.from(atob(crop.split(',')[1]),c=>c.charCodeAt(0));
 const im=jpeg.decode(data,{useTArray:true});
 assert(im.width===Math.ceil(W*.985)-Math.floor(W*.02),'incorrect crop width: '+label);
 assert(im.height===Math.floor(H*.995)-Math.floor(H*.49),'incorrect crop height: '+label);
 assert(Math.abs(im.data[0]-im.data[1])<12,'student identity header leaked into crop: '+label);
 console.log('OMR_VISION_REDACTION_PASS_'+label);
}
const invalid=encode(new Uint8Array(pixels.map((x,i)=>i%4===3?255:235)),W,H);
let rejected=false;try{redactedAnswerImage(invalid);}catch{rejected=true;}
assert(rejected,'layout with no reliable answer region must be rejected');
console.log('OMR_VISION_UNKNOWN_ORIENTATION_REJECTED');
const answers=Array.from({length:60},(_,i)=>({question:i+1,status:i%7?'clear':'blank',
 marked:i%7?[i%4]:[],confidence:.7,reason:'test'}));
const valid=validateVisionAnswers({answers},60);
assert(valid.length===60,'expected 60 validated responses');
assert(compareVisionToOmr(valid,null).every(x=>x.comparison==='optical_reader_unavailable'),'unavailable optical reader');
assert(compareVisionToOmr(valid,answers).every(x=>x.comparison==='agree'),'comparison error');
console.log('OMR_VISION_60_ANSWERS_PASS');
for(const changed of [
 [{...answers[0],question:2},...answers.slice(1)],
 [{...answers[0],status:'clear',marked:[0,1]},...answers.slice(1)],
 [{...answers[0],confidence:3},...answers.slice(1)],
 answers.slice(1)
]){
 let failed=false;try{validateVisionAnswers({answers:changed},60);}catch{failed=true;}
 assert(failed,'invalid model response accepted');
}
console.log('OMR_VISION_REJECTION_PASS');
