// Build the runtime deployment files, not development/source copies.
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
const root=join(import.meta.dir,"../.."),source=join(root,"supabase/functions/nafes-exam");
const dir=mkdtempSync(join(tmpdir(),"omr-production-runtime-"));
const require=createRequire(import.meta.url);
export const runtimeHashes=Object.fromEntries(["assessments.ts","paper-scan.ts","omr-server.ts","assessment-engine.ts","framework.ts","reviewed-bank.ts","index.ts"]
 .map(name=>[name,createHash("sha256").update(readFileSync(join(source,name))).digest("hex")]));
const built=await Bun.build({
 entrypoints:["assessments.ts","paper-scan.ts","omr-server.ts"].map(name=>join(source,name)),
 outdir:dir,target:"bun",format:"esm",
 plugins:[{name:"local-jpeg-for-deno",setup(build){
  build.onResolve({filter:/^(npm:|jsr:|https?:)/},args=>{
   if(args.path!=="npm:jpeg-js@0.4.4")throw Error("External runtime dependency denied: "+args.path);
   return {path:require.resolve("jpeg-js")};
  });
 }}]
});
if(!built.success)throw Error(built.logs.join("\n"));
globalThis.fetch=async()=>{throw Error("Runtime OMR tests forbid production network");};
export const productionAssessments=await import(join(dir,"assessments.js"));
export const productionScan=await import(join(dir,"paper-scan.js"));
export const productionOmr=await import(join(dir,"omr-server.js"));
process.on("exit",()=>rmSync(dir,{recursive:true,force:true}));
