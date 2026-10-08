import {syntheticSheet,blue} from "./fixtures";
import {developmentOmr,developmentScan} from "./source";
import {createHash} from "node:crypto";
const out=process.argv[2];if(!out?.startsWith("/tmp/moallimi-synthetic-sql-"))throw Error("QA output only");
const rows=[];
for(let i=0;i<140;i++){
 const expected=Array.from({length:60},(_,r)=>(r+i)%4);
 const image=syntheticSheet({syntheticTag:i+1,marks:expected.map((option,row)=>({row,option,color:i%2?blue:[0,0,0]}))});
 const reading=developmentOmr.readOmrJpeg(image,60);
 const answers=reading.answers.map((a:any,r:number)=>developmentScan.classifyAnswer(a,{correct_index:r%4},r,
   {identity_valid:true,key_complete:true,markers_ok:reading.markers_ok===true}));
 rows.push({ordinal:i+1,image_data:image,image_hash:createHash("sha256").update(image).digest("hex"),expected,
   markers_ok:reading.markers_ok,answers,matched:answers.filter((a:any,r:number)=>a.selected===expected[r]&&a.status==="clear").length});
}
await Bun.write(out,JSON.stringify(rows));
console.log(JSON.stringify({sheets:rows.length,questions:8400,matched:rows.reduce((n,r)=>n+r.matched,0),markers_ok:rows.filter(r=>r.markers_ok).length}));
