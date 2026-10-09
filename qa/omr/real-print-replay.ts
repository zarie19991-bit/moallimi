// Replay the six legacy printed sheets against archived per-question visual labels.
// Archived "visual" labels are reference data prepared earlier by the same
// project; their independence has NOT been established. NOT a release signoff.
// No personal identities, QR tokens or student imagery are emitted to CI logs.
import {readOmrJpeg} from '../../supabase/functions/nafes-exam/omr-server.ts';
const dir=Deno.args[0]||'omr_reference/qa/omr/results/real-six';
function toBase64(bytes:Uint8Array){
 let binary='';for(let i=0;i<bytes.length;i+=12000)
   binary+=String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+12000)));
 return btoa(binary);
}
const header=(await Deno.readTextFile(dir+'/answers.csv')).replace(/^\uFEFF/,'').trim().split(/\r?\n/);
const columns=header.shift()!.split(',').map(x=>x.trim());
const data=header.map(row=>Object.fromEntries(row.split(',').map((x,i)=>[columns[i],x.trim()])));
const indexes:Record<string,number>={'أ':0,'ب':1,'ج':2,'د':3};
let accepted=0,matched=0,count=0,rejected=0,unreadable=0;const examples:any[]=[];
for(let i=1;i<=6;i++){
 const labels=data.filter(row=>row.page===String(i)).sort((a,b)=>Number(a.question)-Number(b.question));
 if(labels.length!==60||labels.some((v,j)=>Number(v.question)!==j+1||indexes[v.visual]===undefined)){
   throw new Error('Missing or invalid visual labels for page '+i);
 }
 try{
  const bytes=await Deno.readFile(dir+'/page-'+i+'.jpg');
  const result=readOmrJpeg('data:image/jpeg;base64,'+toBase64(bytes),60,1);
  if(result.markers_ok!==true||result.answers.length!==60)throw new Error('Markers/answer count not verified');
  accepted++;
  let localMatch=0,localUnreadable=0;
  for(let j=0;j<60;j++){
    count++;
    const predicted=result.answers[j];
    if(predicted.status!=='clear'||predicted.selected===null||predicted.selected===undefined){
      unreadable++;localUnreadable++;if(examples.length<12)examples.push({page:i,question:j+1,issue:'unreadable',status:predicted.status});continue;
    }
    if(predicted.selected===indexes[labels[j].visual]){matched++;localMatch++}
    else if(examples.length<12)examples.push({page:i,question:j+1,issue:'wrong_choice'});
  }
  console.log(JSON.stringify({case:i,markers_verified:true,rotation:result.rotation,
    grid_score:result.grid_alignment?.score,row_start_mm:result.grid_alignment?.row_start_mm,row_step_mm:result.grid_alignment?.row_step_mm,layout:result.grid_alignment?.layout,matched:localMatch,total:60,unreadable:localUnreadable}));
 }catch(error:any){
  rejected++;count+=60;unreadable+=60;
  console.log(JSON.stringify({case:i,result:'rejected',code:error?.code||'OMR_UNKNOWN',
    message:String(error?.message||error).slice(0,100)}));
 }
}
const accuracy=count?matched/count:0;
console.log(JSON.stringify({reference:'archived_nonindependent_visual_labels',sheets:6,
  accepted,rejected,answers:count,exact_match:matched,accuracy,
  unreadable,first_mismatches:examples}));
if(rejected!==0||count!==360||matched!==360)Deno.exit(1);
console.log('OMR_SIX_SHEET_VISUAL_LABELS_360_OF_360_PASS');
