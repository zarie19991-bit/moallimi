import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { omr, developmentOmr } from "./source";

const out = "qa/omr/results/real-six";
const runs = [];
for (let page=1; page<=6; page++) {
  const bytes=readFileSync(`${out}/page-${page}.jpg`);
  const image=`data:image/jpeg;base64,${bytes.toString("base64")}`;
  const result:any={page,sha256:createHash("sha256").update(bytes).digest("hex")};
  for (const [name, engine] of [["before",omr],["after",developmentOmr]] as const) {
    try { result[name]=engine.readOmrJpeg(image,60); }
    catch (error:any) { result[name]={error:String(error.message)}; }
  }
  runs.push(result);
}
writeFileSync(`${out}/readings.json`,JSON.stringify(runs,null,2));
console.log(runs.map(r=>({page:r.page,before:r.before.error||r.before.verification,
  after:r.after.error||r.after.verification,markers:r.after.marker_points,
  grid:r.after.grid_alignment})));
