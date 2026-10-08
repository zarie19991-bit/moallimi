import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import jpeg from "jpeg-js";
import { omr, developmentOmr } from "./source";
import { syntheticSheet, blue } from "./fixtures";

const output="qa/omr/results/hardening";
mkdirSync(output,{recursive:true});
const file=process.argv[2]||"probe-after.json";
if(!/^[a-zA-Z0-9-]+\.json$/.test(file))throw new Error("Local report filename only.");
if(file==="probe-before.json"&&existsSync(`${output}/${file}`))
  throw new Error("Historical pre-fix results are immutable; choose a new output filename.");
const cases:any[]=[];
for(const radius of [.45,.8,1,1.3]){
  cases.push({id:`small-black-${radius}-with-blue`,image:syntheticSheet({marks:[
    {row:0,option:0,radius},{row:0,option:2,color:blue},
  ]}),expected:[{status:"multiple",marked:[0,2]}],kind:"synthetic"});
}
const labels=JSON.parse(readFileSync("qa/omr/results/real-six/visual-labels.json","utf8"));
for(const page of [1,2,6]){
  const bytes=readFileSync(`qa/omr/results/real-six/page-${page}.jpg`);
  const expected=labels.sheets[page-1].blocks.join(" ").split(" ").map((v:string)=>({
    status:"clear",selected:labels.option_order.indexOf(v),
  }));
  for(const cast of [false,true]){
    const image=jpeg.decode(bytes,{useTArray:true});
    if(cast)for(let i=0;i<image.data.length;i+=4){
      // Controlled blue illumination, NOT a genuine new scan or historical template.
      image.data[i]=Math.round(image.data[i]*.62);
      image.data[i+1]=Math.round(image.data[i+1]*.72);
      image.data[i+2]=Math.round(image.data[i+2]*.85);
    }
    const data=jpeg.encode(image,95).data;
    cases.push({id:`real-page-${page}-${cast?"blue-illumination":"reencoded-control"}`,
      image:`data:image/jpeg;base64,${Buffer.from(data).toString("base64")}`,
      expected,kind:"real-derived"});
  }
}
const match=(e:any,a:any)=>a?.status===e.status&&(e.status==="multiple"?
  JSON.stringify([...(a.marked||[])].sort())===JSON.stringify([...e.marked].sort()):
  a.selected===e.selected);
const results=[];
for(const c of cases){
  const result:any={id:c.id,kind:c.kind,expected:c.expected};
  writeFileSync(`${output}/${c.id}.jpg`,Buffer.from(c.image.split(",")[1],"base64"));
  for(const [key,engine] of [["original",omr],["development",developmentOmr]] as const){
    try{
      const r=engine.readOmrJpeg(c.image,c.expected.length);
      result[key]={matched:c.expected.filter((e:any,i:number)=>match(e,r.answers[i])).length,
        total:c.expected.length,answers:r.answers};
    }catch(error:any){result[key]={error:error.message,total:c.expected.length,matched:0};}
  }
  results.push(result);
  console.log(c.id,...["original","development"].map(key=>`${key}: ${result[key].matched}/${result[key].total}${result[key].error?" REJECT "+result[key].error:""}`));
}
writeFileSync(`${output}/${file}`,JSON.stringify(results,null,2));
