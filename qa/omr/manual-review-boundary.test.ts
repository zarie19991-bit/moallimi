import {test,expect} from "bun:test";
import {scan as original,developmentScan as repaired} from "./source";
import {manualReviewFixture,requestFor,inspectBoundary} from "./manual-review-fixture";

for(const mode of ["ambiguous","uncertain"])test(`verification blocks ${mode} before RPC; original forwarded it`,async()=>{
 const before=await inspectBoundary(original,manualReviewFixture(mode),"teacher_scan_verify");
 const after=await inspectBoundary(repaired,manualReviewFixture(mode),"teacher_scan_verify");
 expect(before.rpc_reached).toBe(true);expect(after.rpc_reached).toBe(false);
 expect(after.error).toContain("غير محسومة");expect(after.memory_writes).toBe(0);
});
test("verification rejects a stale answer version before calling SQL",async()=>{
 const m=manualReviewFixture();
 await expect(repaired.handlePaperScan(m.db,{...requestFor(m,"teacher_scan_verify"),answer_version:m.row.answer_version+1},m.owner)).rejects.toThrow("تغيرت الورقة");
 expect(m.calls).toHaveLength(0);expect(m.writes).toHaveLength(0);
});
test("healthy verification keeps the existing RPC arguments unchanged, without pretending to save",async()=>{
 const m=manualReviewFixture(),result=await inspectBoundary(repaired,m,"teacher_scan_verify");
 expect(result.error).toBe("QA_RPC_BOUNDARY_NO_SQL_EXECUTED");
 expect(m.calls[0].name).toBe("nafes_scan_verify_current");
 expect(Object.keys(m.calls[0].args).sort()).toEqual(["p_ack","p_reviewer","p_session","p_sheet","p_version"]);
 expect(m.row.disposition).toBe("verified");expect(m.writes).toHaveLength(0);
});
for(const reviewed of [false,true])test(`identity assignment keeps prior uncertain answers pending (reviewed=${reviewed})`,async()=>{
 const beforeFixture=manualReviewFixture("uncertain"),afterFixture=manualReviewFixture("uncertain");
 beforeFixture.row.snapshot.answers[0].reviewed_manually=reviewed;
 afterFixture.row.snapshot.answers[0].reviewed_manually=reviewed;
 await inspectBoundary(original,beforeFixture,"teacher_scan_assign_identity");
 await inspectBoundary(repaired,afterFixture,"teacher_scan_assign_identity");
 const before=beforeFixture.calls[0].args.p_effective.answers[0];
 const after=afterFixture.calls[0].args.p_effective.answers[0];
 expect(before.state).toBe("correct");expect(after.state).toBe("uncertain");
 expect(after.correct).toBe(false);expect(after.review_pending).toBe(true);
 expect(afterFixture.calls[0].args.p_effective.omr_verification.auto_accept).toBe(false);
 expect(afterFixture.writes).toHaveLength(0);
});
test("identity assignment cannot relabel ambiguous candidates as proven multiple",async()=>{
 const m=manualReviewFixture("ambiguous");m.row.snapshot.answers[0].reviewed_manually=true;
 await inspectBoundary(repaired,m,"teacher_scan_assign_identity");
 const a=m.calls[0].args.p_effective.answers[0];
 expect(a.status).toBe("ambiguous");expect(a.state).toBe("uncertain");
 expect(a.selected).toBeNull();expect(a.correct).toBe(false);
});
test("healthy answers retain their choice and classification during identity assignment",async()=>{
 const m=manualReviewFixture();await inspectBoundary(repaired,m,"teacher_scan_assign_identity");
 const after=m.calls[0].args.p_effective.answers;
 expect(after.map((a:any)=>a.selected)).toEqual([0,0,0,0]);
 expect(after.every((a:any)=>a.state==="correct")).toBe(true);
});
test("identity assignment preserves existing human review metadata and raw reader evidence",async()=>{
 const m=manualReviewFixture("uncertain"),a=m.row.snapshot.answers[0];
 Object.assign(a,{reviewed_manually:true,manual_reason:"synthetic visual confirmation",
   manual_review:{reviewer:"synthetic",reason:"image checked"},reader_selected:3});
 await inspectBoundary(repaired,m,"teacher_scan_assign_identity");
 const after=m.calls[0].args.p_effective.answers[0];
 expect(after.manual_reason).toBe(a.manual_reason);expect(after.manual_review).toEqual(a.manual_review);
 expect(after.reader_selected).toBe(3);expect(after.selected).toBe(a.selected);
 expect(after.marked).toEqual(a.marked);expect(after.state).toBe("uncertain");
});
test("stale verified labels cannot export a complete ambiguous synthetic sheet",async()=>{
 for(const [engine,allowed] of [[original,true],[repaired,false]] as const){
   const m=manualReviewFixture("ambiguous");m.row.disposition="verified";
   m.tables.nafes_scan_sessions[0].completed_at="2026-01-01T00:00:00Z";
   let exported=false,error="";
   try{await engine.reviewedScanPayload(m.db,m.request,m.owner);exported=true;}catch(e:any){error=e.message;}
   expect(exported).toBe(allowed);if(!allowed)expect(error).toContain("غير محسومة");
   expect(m.writes).toHaveLength(0);
 }
});
test("audit only: edit request stops at the real RPC boundary; no reason support is invented",async()=>{
 const m=manualReviewFixture("ambiguous"),result=await inspectBoundary(repaired,m,"teacher_scan_edit_answer");
 expect(result.error).toBe("QA_RPC_BOUNDARY_NO_SQL_EXECUTED");
 expect(m.calls[0].name).toBe("nafes_scan_edit_answer");
 expect(Object.keys(m.calls[0].args).sort()).toEqual(["p_marked","p_question","p_request","p_reviewer","p_session","p_sheet","p_version"]);
 expect(m.row.snapshot.answers[0].state).toBe("uncertain");expect(m.writes).toHaveLength(0);
});
test.todo("Original SQL source required: persist manual edits and their reason atomically");
test.todo("Original SQL source required: verify SQL rejects unresolved sheets and stale versions");
test.todo("Original SQL source required: session finish checks pending reviews and logs identity edits");
test.todo("Original SQL source required: repeated registration, duplicate images and concurrent approval are idempotent");
for(const mode of ["ambiguous","uncertain"])test(`finish rejects ${mode} before SQL`,async()=>{
 const before=await inspectBoundary(original,manualReviewFixture(mode),"teacher_scan_finish");
 const after=await inspectBoundary(repaired,manualReviewFixture(mode),"teacher_scan_finish");
 expect(before.rpc_reached).toBe(true);expect(after.rpc_reached).toBe(false);
 expect(after.error).toContain("غير محسومة");expect(after.memory_writes).toBe(0);
});
test("healthy batch finish preserves existing RPC signature",async()=>{
 const m=manualReviewFixture();await inspectBoundary(repaired,m,"teacher_scan_finish");
 expect(m.calls[0].name).toBe("nafes_scan_finish");
 expect(Object.keys(m.calls[0].args)).toEqual(["p_session"]);
});
test("a pending second sheet cannot be silently omitted from a finished batch",async()=>{
 for(const [engine,allowed] of [[original,true],[repaired,false]] as const){
   const m=manualReviewFixture();m.tables.nafes_scan_sessions[0].completed_at="2026-01-01T00:00:00Z";
   const pending=structuredClone(m.row);
   Object.assign(pending,{id:"55555555-5555-4555-8555-555555555555",ordinal:2,disposition:null});
   pending.snapshot.answers[0].state="uncertain";m.tables.nafes_scan_sheets.push(pending);
   let exported=false;
   try{await engine.reviewedScanPayload(m.db,m.request,m.owner);exported=true;}catch{}
   expect(exported).toBe(allowed);expect(m.writes).toHaveLength(0);
 }
});
