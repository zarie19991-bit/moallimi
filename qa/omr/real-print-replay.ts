// Read-only replay of six previously anonymized printed sheets already on the dev
// branch. This is a geometry regression test, NOT an independent 99% audit.
// Never print sheet images, names, QR payloads, or raw answer arrays.
import {readOmrJpeg} from '../../supabase/functions/nafes-exam/omr-server.ts';
const dir=Deno.args[0]||'omr_reference/qa/omr/results/real-six';
function toBase64(bytes:Uint8Array){
 let binary='';for(let i=0;i<bytes.length;i+=12000)
   binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+12000)));
 return btoa(binary);
}
let pass=0,fail=0,lowGrid=0;
for(let i=1;i<=6;i++){
 try{
  const bytes=await Deno.readFile(dir+'/page-'+i+'.jpg');
  const result=readOmrJpeg('data:image/jpeg;base64,'+toBase64(bytes),60,1);
  if(result.markers_ok!==true||result.answers.length!==60)
   throw new Error('Incomplete marker verification or answer count');
  pass++;
  if(result.grid_alignment?.score<.1)lowGrid++;
  console.log(JSON.stringify({case:i,result:'markers_verified',rotation:result.rotation,
   grid_score:result.grid_alignment?.score,answers:result.answers.length}));
 }catch(error){
  fail++;
  console.log(JSON.stringify({case:i,result:'rejected',code:error?.code||'OMR_UNKNOWN',
    message:String(error?.message||error).slice(0,150)}));
 }
}
console.log(JSON.stringify({total:6,pass,fail,lowGrid,criterion:'6/6 printed-sheet smoke; 99% independent audit separate'}));
if(pass!==6)Deno.exit(1);
console.log('OMR_PRINTED_MARKER_SMOKE_PASS');
