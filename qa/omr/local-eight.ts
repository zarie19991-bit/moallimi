/**
 * Offline OMR-only replay of eight PRIVATE JPEG student sheets.
 * Uses the exact updated readOmrJpeg from this development branch.
 * NO network calls, student identity queries, answer-key lookup, grades or DB writes.
 * Downloading the open-source jpeg-js decoder for Deno may require internet once.
 * Output stays in this folder and contains only ordinal sheet indexes.
 */
import {readOmrJpeg} from "../../supabase/functions/nafes-exam/omr-server.ts";
import {resolve} from "node:path";

const LETTERS=["أ","ب","ج","د"];
const filenames=Deno.args.filter(x=>x.toLowerCase().endsWith(".jpg")||x.toLowerCase().endsWith(".jpeg"));
if(filenames.length!==8){
 console.error("يجب تمرير ثماني صور JPEG بالضبط؛ تم تمرير "+filenames.length+".");
 console.error("حدد الصور الثماني في مستكشف الملفات واسحبها جميعًا فوق run-eight-local.cmd");
 Deno.exit(2);
}
const csvRows=["\uFEFFالورقة,السؤال,اختيار_القارئ,حالة_القراءة,الثقة,تأكيد_المحاذاة,سبب_الرفض"];
const report:{
 test:"offline_omr_eight";date:string;source:string;sheets:Array<{sheet:number,detector?:string,markers_verified:boolean,rotation?:number,grid_alignment?:unknown,preprocessing?:unknown,needs_manual_review?:boolean,clear:number,blank:number,multiple:number,ambiguous:number,rejected:boolean,rejection_reason?:string,answers:Array<{question:number,selected:number|null,letter:string,status:string,confidence:number|null}>}>;
}={test:"offline_omr_eight",date:new Date().toISOString(),
 source:"the actual OMR engine from fix/omr-no-zero-on-read-failure; private images never uploaded",
 sheets:[]};
function csv(v:unknown){const s=String(v??"");return '"'+s.replaceAll('"','""')+'"';}
function encodeBase64(bytes:Uint8Array):string{
 let binary="";
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(binary);
}
for(let n=0;n<8;n++){
 const file=resolve(filenames[n]);
 const sheet={sheet:n+1,markers_verified:false,clear:0,blank:0,multiple:0,ambiguous:0,
 rejected:false,answers:[] as Array<{question:number,selected:number|null,letter:string,status:string,confidence:number|null}>,
 rejection_reason:undefined as string|undefined,
 detector:undefined as string|undefined,rotation:undefined as number|undefined,
 grid_alignment:undefined as unknown,preprocessing:undefined as unknown,
 needs_manual_review:undefined as boolean|undefined};
 try{
  const bytes=await Deno.readFile(file);
  if(bytes.byteLength>30_000_000)throw new Error("الصورة أكبر من 30 ميغابايت.");
  const result:any=readOmrJpeg("data:image/jpeg;base64,"+encodeBase64(bytes),60,1);
  sheet.markers_verified=result.markers_ok===true;
  sheet.detector=String(result.detector||"");
  sheet.rotation=result.rotation;
  sheet.grid_alignment=result.grid_alignment||null;
  sheet.preprocessing=result.preprocessing||null;
  sheet.needs_manual_review=result.verification?.requires_manual_review===true;
  if(sheet.markers_verified!==true||result.answers?.length!==60)throw new Error("لم يتأكد القارئ من جميع العلامات والفقاعات.");
  for(let i=0;i<60;i++){
   const x=result.answers[i]||{},status=String(x.status||"unreadable");
   const selected=status==="clear"&&Number.isInteger(x.selected)&&x.selected>=0&&x.selected<4?x.selected:null;
   const letter=selected===null?"":LETTERS[selected];
   const confidence=Number.isFinite(Number(x.confidence))?Number(x.confidence):null;
   sheet.answers.push({question:i+1,selected,letter,status,confidence});
   if(status==="clear"&&selected!==null)sheet.clear++;
   else if(status==="blank")sheet.blank++;
   else if(status==="multiple")sheet.multiple++;
   else sheet.ambiguous++;
   csvRows.push([n+1,i+1,letter,status,confidence??"",true,""].map(csv).join(","));
  }
  console.log("ورقة "+(n+1)+": المحاذاة مؤكدة، "+sheet.clear+" واضحة، "+sheet.blank+" فارغة، "+sheet.multiple+" متعددة، "+sheet.ambiguous+" غير محسومة.");
 }catch(e){
  sheet.rejected=true;
  sheet.rejection_reason=String((e as Error)?.message||e).slice(0,250);
  console.log("ورقة "+(n+1)+": مرفوضة؛ "+sheet.rejection_reason);
  for(let i=1;i<=60;i++)csvRows.push([n+1,i,"","reader_failed","",false,sheet.rejection_reason].map(csv).join(","));
 }
 report.sheets.push(sheet);
}
const csvPath=resolve("omr-eight-result.csv"),jsonPath=resolve("omr-eight-result.json");
await Deno.writeTextFile(csvPath,csvRows.join("\r\n")+"\r\n");
await Deno.writeTextFile(jsonPath,JSON.stringify(report,null,2));
console.log("\nاكتمل فحص 8 صور؛ الناتج ملفان محليان:");
console.log(csvPath);
console.log(jsonPath);
console.log("لا تُعتمد أي درجة تلقائيًا. يجب مقارنة كل اختيار بالتظليل الحقيقي.");
