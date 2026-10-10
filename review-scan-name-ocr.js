/* Optional Arabic printed-name OCR. Image processing runs in the browser;
 * the language engine can be downloaded when the teacher clicks OCR.
 * Suggestions are NEVER identity verification or grading decisions.
 */
(function(root){
'use strict';
const scriptUrl='https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/6.0.1/tesseract.min.js';
let loading=null;
function normalizeName(value){
 return String(value||'').normalize('NFKC')
   .replace(/[\u064b-\u065f\u0670\u0640]/g,'')
   .replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
   .replace(/ؤ/g,'و').replace(/ئ/g,'ي')
   .replace(/[\u200c-\u200f\u202a-\u202e]/g,'')
   .replace(/[^\u0621-\u064a\u0660-\u0669a-z0-9]+/gi,' ')
   .trim().replace(/\s+/g,' ');
}
const words=x=>normalizeName(x).split(' ').filter(Boolean);
function levenshtein(a,b){
 if(a===b)return 0;
 if(!a.length)return b.length;
 if(!b.length)return a.length;
 let old=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const row=[i];
  for(let j=1;j<=b.length;j++){
   row[j]=Math.min(row[j-1]+1,old[j]+1,old[j-1]+(a[i-1]===b[j-1]?0:1));
  }
  old=row;
 }
 return old[b.length];
}
function tokenScore(a,b){
 return Math.max(0,1-levenshtein(a,b)/Math.max(a.length,b.length,1));
}
function matchCandidate(ocrText,studentName){
 const stream=words(ocrText),name=words(studentName);
 if(name.length<3||name.length>8||stream.length<3)return {score:0,matched:0,phrase:''};
 let best={score:0,matched:0,phrase:''};
 // Compare contiguous text windows so a few common Arabic names scattered
 // across a form cannot be interpreted as the printed student name.
 for(let start=0;start<stream.length;start++){
  for(let size of [name.length,name.length-1,name.length+1]){
   if(size<3||start+size>stream.length)continue;
   const part=stream.slice(start,start+size);
   // Allow one missing/misread word only for a *suggestion*, not confirmation.
   let matches=0,total=0;
   const n=Math.min(size,name.length);
   for(let shift of [-1,0,1]){
    let sum=0,hits=0,cnt=0;
    for(let i=0;i<name.length;i++){
     const j=i+shift;
     if(j<0||j>=part.length)continue;
     const v=tokenScore(name[i],part[j]);
     sum+=v;cnt++;if(v>=.70&&name[i].length>=3)hits++;
    }
    const coverage=cnt/name.length,avg=cnt?sum/cnt:0;
    const score=avg*coverage*(.77+.23*(hits/Math.max(1,name.length)));
    if(hits>=3&&score>best.score)best={score,matched:hits,phrase:part.join(' ')};
   }
  }
 }
 return {...best,score:Number(best.score.toFixed(3))};
}
function proposals(text,assignments,usedIds=[]){
 const used=new Set(usedIds.map(String));
 const matches=(assignments||[])
  .filter(a=>a&&a.student_id&&a.student_name&&!used.has(String(a.student_id)))
  .map(a=>({...a,...matchCandidate(text,a.student_name)}))
  .filter(a=>a.matched>=3&&a.score>=.62)
  .sort((a,b)=>b.score-a.score);
 const best=matches[0],second=matches[1];
 // A unique high score is a suggested choice only; a teacher must still
 // compare the original image and explicitly confirm the student.
 const unique=!!best&&best.score>=.82&&(!second||best.score-second.score>=.10);
 return {matches:matches.slice(0,4),unique};
}
function loadEngine(){
 if(root.Tesseract?.createWorker)return Promise.resolve(root.Tesseract);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  if(typeof document==='undefined')return reject(new Error('تتعذر قراءة الاسم خارج المتصفح.'));
  const script=document.createElement('script');
  script.src=scriptUrl;script.async=true;script.crossOrigin='anonymous';
  script.onload=()=>root.Tesseract?.createWorker?resolve(root.Tesseract):reject(new Error('محرك OCR لم يعمل.'));
  script.onerror=()=>reject(new Error('تعذر تحميل قارئ الاسم العربي. تأكد من الاتصال.'));
  document.head.appendChild(script);
 }).catch(e=>{loading=null;throw e;});
 return loading;
}
async function readPrintedName(imageData,notify=()=>{}){
 if(typeof Image==='undefined'||typeof document==='undefined')throw new Error('المتصفح لا يدعم معالجة الصورة.');
 notify('جارٍ تحميل محرك القراءة العربية داخل المتصفح لأول مرة…');
 const T=await loadEngine(),image=new Image();image.decoding='async';
 await new Promise((resolve,reject)=>{
  image.onload=resolve;image.onerror=()=>reject(new Error('تعذر فتح صورة الورقة.'));
  image.src=imageData;
 });
 const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
 if(!w||!h)throw new Error('صورة الورقة غير صالحة.');
 // Names on the printed OMR form are in the page header. Keep the QR and
 // answer circles outside the OCR image where possible.
 const canvas=document.createElement('canvas'),cropH=Math.floor(h*.44);
 const scale=Math.min(2.3,Math.max(1,2000/w));
 canvas.width=Math.round(w*scale);canvas.height=Math.round(cropH*scale);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(image,0,0,w,cropH,0,0,canvas.width,canvas.height);
 let worker;
 try{
  notify('جارٍ تنزيل بيانات اللغة العربية وتشغيل OCR محليًا…');
  worker=await T.createWorker('ara',1,{logger:m=>{
   if(m?.status==='recognizing text'&&Number.isFinite(m.progress))
     notify('التعرّف على الاسم المطبوع… '+Math.round(m.progress*100)+'٪');
  }});
  const result=await worker.recognize(canvas);
  return {text:String(result?.data?.text||'').slice(0,3000),
    ocrConfidence:Number(result?.data?.confidence||0)};
 }finally{
  if(worker)await worker.terminate().catch(()=>{});
  canvas.width=1;canvas.height=1;
 }
}
root.NafesPrintedNameOCR={normalizeName,matchCandidate,proposals,readPrintedName};
})(typeof window!=='undefined'?window:globalThis);
