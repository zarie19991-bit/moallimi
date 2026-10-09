import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {productionScan,productionOmr,productionAssessments} from "./production-source";
import {syntheticSheet} from "./fixtures";
const code=(name:string)=>readFileSync(new URL("../../"+name,import.meta.url),"utf8");
const ctx:any={};runInNewContext(code("review-omr-safety.js"),ctx);
const safety=ctx.NafesOmrSafety;
test("runtime module exposes preserved upstream bank and answer-balance guards",()=>{
 expect(typeof productionAssessments.matchesBankSnapshot).toBe("function");
 expect(typeof productionAssessments.rebalanceQuestionOptions).toBe("function");
 const qs=Array.from({length:12},(_,i)=>({id:String(i),options:["a","b","c","d"],correctIndex:0}));
 const balanced=productionAssessments.rebalanceQuestionOptions(qs,"production-binding");
 for(let n=0;n<4;n++)expect(balanced.filter((q:any)=>q.correctIndex===n)).toHaveLength(3);
 expect(()=>productionAssessments.rebalanceQuestionOptions([{options:["x","x","y","z"],correctIndex:0}],"bad")).toThrow();
});
test("runtime classifier cannot resolve ambiguous evidence using a matching key",()=>{
 for(let k=0;k<4;k++){
  const a=productionScan.classifyAnswer({status:"ambiguous",selected:k,marked:[k],confidence:1},{correct_index:k},0,
   {identity_valid:true,key_complete:true,markers_ok:true});
  expect(a.state).toBe("uncertain");expect(a.selected).toBeNull();
  expect(safety.classify({status:"ambiguous",selected:k,marked:[k]},k).correct).toBe(false);
 }
});
test("browser uncertainty keeps readable selection while separating identity from reading",()=>{
 const a=safety.classify({status:"clear",selected:1,marked:[1]},1,{identity_valid:false});
 expect(a.state).toBe("uncertain");expect(a.selected).toBe(1);
 expect(a.uncertainty.identity).toHaveLength(1);expect(a.uncertainty.reading).toHaveLength(0);
});
test("browser classifier preserves all sixteen healthy option/key combinations",()=>{
 for(let selected=0;selected<4;selected++)for(let key=0;key<4;key++){
  const a=safety.classify({status:"clear",selected,marked:[selected]},key);
  expect(a.selected).toBe(selected);expect(a.state).toBe(selected===key?"correct":"incorrect");
 }
});
test("production journal supplies edit reason, version and unresolved verification guard",()=>{
 const js=code("review-scan-journal.js"),html=code("review-scan.html");
 expect(js).toContain("request_id:crypto.randomUUID(),reason");
 expect(js.match(/teacher_scan_assign_identity'.*/g)?.every(line=>line.includes(",reason"))).toBe(true);
 expect(js).toContain("answer_version:sheets[active].answer_version||0,verified:true");
 expect(js).toContain("safety.unresolvedSheet(sheets[active])");
 expect(html).toContain('id="manualReviewReason"');
 expect(html.indexOf('src="review-omr-safety.js')).toBeLessThan(html.indexOf('src="review-scan-journal.js'));
});
for(const color of [[24,55,190],[25,25,25]] as [number,number,number][])test(`deployment reader reads all 60 ${color[2]===190?"blue":"black"} choices`,()=>{
 const image=syntheticSheet({marks:Array.from({length:60},(_,row)=>({row,option:row%4,color}))});
 const r=productionOmr.readOmrJpeg(image,60,1);
 expect(r.answers).toHaveLength(60);
 r.answers.forEach((a:any,i:number)=>{expect(a.status).toBe("clear");expect(a.selected).toBe(i%4);});
},60000);
