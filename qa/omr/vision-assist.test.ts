import jpeg from 'npm:jpeg-js@0.4.4';
import {redactedAnswerImage,validateVisionAnswers,compareVisionToOmr} from '../../supabase/functions/nafes-exam/omr-vision-assist.ts';
const assert=(b:boolean,msg:string)=>{if(!b)throw new Error(msg);};
const W=260,H=420,data=new Uint8Array(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const j=(y*W+x)*4,v=y<H*.35?[210,5,5]:[205,205,205];
 data[j]=v[0];data[j+1]=v[1];data[j+2]=v[2];data[j+3]=255;
}
const jpegData=jpeg.encode({width:W,height:H,data},75).data;
let b='';for(let i=0;i<jpegData.length;i+=4096)
 b+=String.fromCharCode(...jpegData.subarray(i,i+4096));
const crop=redactedAnswerImage('data:image/jpeg;base64,'+btoa(b));
const arr=Uint8Array.from(atob(crop.split(',')[1]),c=>c.charCodeAt(0));
const image=jpeg.decode(arr,{useTArray:true});
assert(image.width===W&&image.height===Math.floor(H*.65),'crop dimensions');
assert(Math.abs(image.data[0]-image.data[1])<8,'header should not appear in cropped image');
console.log('OMR_VISION_REDACTION_PASS');
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
