/* Optional Arabic printed-name OCR. Image processing runs in the browser;
 * the language engine can be downloaded when the teacher clicks OCR.
 * Suggestions are NEVER identity verification or grading decisions.
 */
(function(root){
'use strict';
const scriptUrls=[
 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/6.0.1/tesseract.min.js',
 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js'
];
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
  let index=0;
  function next(){
   if(index>=scriptUrls.length){
     reject(new Error('تعذر تحميل محرك قراءة العربية من المصدرين. تحقق من اتصال المتصفح أو سياسات حجب الملفات، واستخدم البحث بالاسم.'));
     return;
   }
   const script=document.createElement('script');
   script.src=scriptUrls[index++];script.async=true;script.crossOrigin='anonymous';
   script.onload=()=>{
    if(root.Tesseract?.createWorker)resolve(root.Tesseract);
    else{script.remove();next();}
   };
   script.onerror=()=>{script.remove();next();};
   document.head.appendChild(script);
  }
  next();
 }).catch(e=>{loading=null;throw e;});
 return loading;
}
// Crop only text-bearing bands rather than asking OCR to read QR codes and
// answer-grid borders as one long line. All recognition runs on a local canvas.
function headerRegions(){
 return [
  {label:'رأس الورقة',x:0,y:0,w:1,h:.35,flip:false},
  {label:'حقل الاسم الأيمن',x:.35,y:.05,w:.65,h:.27,flip:false},
  {label:'حقل الاسم الأيسر',x:0,y:.05,w:.65,h:.27,flip:false},
  {label:'رأس الورقة المقلوبة',x:0,y:.65,w:1,h:.35,flip:true}
 ];
}
function makeOcrCrop(image,region){
 const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
 const x=Math.floor(w*region.x),y=Math.floor(h*region.y),
  sw=Math.max(1,Math.floor(w*region.w)),sh=Math.max(1,Math.floor(h*region.h));
 const factor=Math.min(2.5,Math.max(1,2100/sw));
 const canvas=document.createElement('canvas');
 canvas.width=Math.round(sw*factor);canvas.height=Math.round(sh*factor);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw new Error('تعذر إنشاء سطح معالجة الصورة.');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.filter='grayscale(1) contrast(1.6)';
 if(region.flip){
  ctx.translate(canvas.width,canvas.height);ctx.rotate(Math.PI);
 }
 ctx.drawImage(image,x,y,sw,sh,0,0,canvas.width,canvas.height);
 return canvas;
}
async function readPrintedName(imageData,notify=()=>{},roster=[]){
 if(typeof Image==='undefined'||typeof document==='undefined')throw new Error('المتصفح لا يدعم معالجة الصورة.');
 notify('تحميل محرك القراءة العربية (يحتاج تنزيل اللغة أول مرة)…');
 const T=await loadEngine(),image=new Image();image.decoding='async';
 await new Promise((resolve,reject)=>{
  image.onload=resolve;image.onerror=()=>reject(new Error('تعذر فتح صورة الورقة المحفوظة.'));
  image.src=imageData;
 });
 const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
 if(!w||!h)throw new Error('صورة الورقة غير صالحة.');
 let worker;
 const samples=[];
 try{
  notify('تحميل بيانات العربية محليًا. قد يستغرق ذلك قليلًا في أول استخدام…');
  worker=await T.createWorker('ara',1,{logger:m=>{
   if(m?.status==='recognizing text'&&Number.isFinite(m.progress))
    notify('التعرف على الاسم العربي… '+Math.round(m.progress*100)+'٪');
  }});
  if(typeof worker.setParameters==='function'){
   try{await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});}
   catch(_){/* Run with engine defaults if optional page segmentation is unavailable. */}
  }
  const regions=headerRegions();
  for(let i=0;i<regions.length;i++){
   const region=regions[i],canvas=makeOcrCrop(image,region);
   try{
    notify('قراءة '+region.label+' ('+(i+1)+'/'+regions.length+')…');
    const data=(await worker.recognize(canvas))?.data||{};
    const text=String(data.text||'').slice(0,1800);
    const confidence=Number(data.confidence||0);
    samples.push({region:region.label,text,confidence});
    if(Array.isArray(roster)&&roster.length){
     const found=proposals(text,roster);
     if(found.unique&&found.matches[0]?.score>=.90)break;
    }
   }finally{canvas.width=1;canvas.height=1;}
  }
  // Keep disjoint OCR regions separate for matching: joining them would create
  // artificial full names across unrelated form labels.
  let best=samples[0]||{region:'',text:'',confidence:0},rank=-1;
  for(const candidate of samples){
   const proposed=proposals(candidate.text,roster);
   const priority=proposed.matches[0]?.score||0;
   if(priority>rank){rank=priority;best=candidate;}
  }
  return {text:best.text,ocrConfidence:best.confidence,
   samples,recognizedArabic:samples.some(x=>/[\u0621-\u064a]{3}/.test(x.text))};
 }catch(error){
  if(error?.message)throw new Error('محرك OCR العربي: '+error.message);
  throw error;
 }finally{
  if(worker)await worker.terminate().catch(()=>{});
 }
}
root.NafesPrintedNameOCR={normalizeName,matchCandidate,proposals,readPrintedName};
})(typeof window!=='undefined'?window:globalThis);
