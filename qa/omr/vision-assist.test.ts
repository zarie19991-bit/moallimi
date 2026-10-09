import jpeg from 'npm:jpeg-js@0.4.4';
import {redactedAnswerImage,validateVisionAnswers,compareVisionToOmr,proposeVisionReading}
 from '../../supabase/functions/nafes-exam/omr-vision-assist.ts';
const assert=(c:boolean,m:string)=>{if(!c)throw new Error(m);};
const W=260,H=420;
const pixels=new Uint8Array(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const i=(y*W+x)*4;
 if(y<H*.35){pixels[i]=240;pixels[i+1]=20;pixels[i+2]=20;}
 else{pixels[i]=205;pixels[i+1]=205;pixels[i+2]=205;}
 pixels[i+3]=255;
}
const encoded=jpeg.encode({width:W,height:H,data:pixels},84).data;
let bytes='';for(let i=0;i<encoded.length;i+=8192)
 bytes+=String.fromCharCode(...encoded.subarray(i,Math.min(i+8192,encoded.length)));
const full='data:image/jpeg;base64,'+btoa(bytes);
const cut=redactedAnswerImage(full);
const cropped=jpeg.decode(new Uint8Array(atob(cut.split(',')[1]).split('').map(x=>x.charCodeAt(0))),{useTArray:true});
assert(cropped.width===W&&cropped.height===Math.floor(H*.65),'unexpected crop dimensions');
assert(cropped.data[0]>170&&Math.abs(cropped.data[0]-cropped.data[1])<5,'private header appeared in crop');
assert(!cut.includes(bytes.slice(0,200)),'original image was not stripped');
console.log('VISION_HEADER_CROP_PASS');
let refused=false;
try{redactedAnswerImage('data:image/jpeg;base64,INVALID!!!');}catch{refused=true;}
assert(refused,'bad input accepted');
console.log('VISION_INVALID_IMAGE_REJECTED');
const base=Array.from({length:60},(_,i)=>({question:i+1,status:i%7===0?'blank':'clear',
 marked:i%7===0?[]:[i%4],confidence:.62,reason:'test'}));
const out=validateVisionAnswers({answers:base},60);
assert(out.length===60&&out[6].question===7,'60-answer validation failed');
const compare=compareVisionToOmr(out,base);
assert(compare.every(x=>x.comparison==='agree'),'unexpected mismatch');
const unknown=compareVisionToOmr(out,null);
assert(unknown.every(x=>x.comparison==='optical_reader_unavailable'),'failed OMR must remain unavailable');
console.log('VISION_STRICT_60_ANSWERS_PASS');
const illegal=[
 {answers:[...base.slice(0,59)]},
 {answers:[{...base[0],question:2},...base.slice(1)]},
 {answers:[{...base[0],status:'clear',marked:[0,1]},...base.slice(1)]},
 {answers:[{...base[0],confidence:5},...base.slice(1)]},
 {answers:[{...base[0],marked:[-1]},...base.slice(1)]}
];
for(let i=0;i<illegal.length;i++){
 let rejected=false;
 try{validateVisionAnswers(illegal[i],60);}catch{rejected=true;}
 assert(rejected,'unsafe/invalid AI result accepted: '+i);
}
console.log('VISION_HALLUCINATION_REJECTION_PASS');
if(Deno.env.get('OMR_VISION_ASSIST_ENABLED')!=='true'){
 let disabled=false;try{await proposeVisionReading(full,60,null,'I_AGREE_TO_SEND_REDACTED_OMR_IMAGE');}
 catch(e){disabled=String(e).includes('غير مفعل');}
 assert(disabled,'disabled vision must not contact external service');
 console.log('VISION_DISABLED_NO_EXTERNAL_CALL_PASS');
}
