import {test,expect} from "bun:test";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";

// One native PostgreSQL run shared by four integration groups; no pre-existing evidence is trusted.
const run=spawnSync("python3",["qa/omr/sql/run-tests.py"],{
 cwd:process.cwd(),encoding:"utf8",timeout:180000,maxBuffer:4_000_000,
});
if(run.status!==0)throw new Error("Native SQL regression failed:\n"+run.stdout+"\n"+run.stderr);
const evidence=JSON.parse(readFileSync("qa/omr/results/sql/sql-evidence.json","utf8"));
const names=[
 "SQL: saving, explicit reason and atomic manual audit",
 "SQL: verify rejects unresolved evidence and stale versions",
 "SQL: batch finish, identity audit and manual reprocessing protection",
 "SQL: replay, duplicate images and real concurrent approval",
];
for(let group=1;group<=4;group++)test(names[group-1],()=>{
 const cases=evidence.cases.filter((r:any)=>r.database==="omr_repaired"&&r.group===group);
 expect(cases.length).toBeGreaterThan(0);
 expect(cases.every((r:any)=>r.passed)).toBe(true);
 expect(evidence.production_connected).toBe(false);
 expect(evidence.synthetic_only).toBe(true);
 expect(evidence.original_constraints_preserved).toBe(true);
 if(group===4)expect(evidence.concurrency_proofs.filter((p:any)=>
   p.database==="omr_repaired"&&p.independent_backends_waiting===2).length).toBeGreaterThanOrEqual(5);
});
