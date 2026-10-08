import {test,expect} from "bun:test";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
const run=spawnSync("python3",["qa/omr/sql/auth-tests.py"],{encoding:"utf8",timeout:180000,maxBuffer:2_000_000});
if(run.status!==0)throw Error(run.stdout+"\n"+run.stderr);
const evidence=JSON.parse(readFileSync("qa/omr/results/integration-review/auth-save-evidence.json","utf8"));
for(const result of evidence.repaired.cases)test("authenticated Edge/native SQL: "+result.name,()=>{
 expect(result.passed).toBe(true);
 expect(evidence.repaired.rpc_role).toBe("service_role");
 expect(evidence.repaired.scan_selects_role).toBe("service_role");
 expect(evidence.repaired.publication_positive_tested).toBe(false);
 expect(evidence.repaired.rollback_positive_tested).toBe(false);
});
