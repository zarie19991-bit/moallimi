import {test,expect} from "bun:test";
import {scan as original,developmentScan as repaired} from "./source";
import {manualReviewFixture,requestFor} from "./manual-review-fixture";
import {syntheticSheet} from "./fixtures";

for(const action of ["teacher_scan_reprocess_server","teacher_scan_reclassify"])test(`${action}: human answers and review stamps survive a conflicting new reading`,async()=>{
 const image=syntheticSheet({marks:[{row:0,option:2}]});
 for(const [engine,protectedReview] of [[original,false],[repaired,true]] as const){
   const m=manualReviewFixture();m.row.image_data=image;
   const before=structuredClone(m.row.snapshot.answers);
   m.row.snapshot.answers[0].reviewed_manually=true;
   m.row.snapshot.answers[0].manual_reason="synthetic original-image review";
   before[0]=structuredClone(m.row.snapshot.answers[0]);
   const stamps={reviewed_at:m.row.reviewed_at,reviewed_by:m.row.reviewed_by,disposition:m.row.disposition,answer_version:m.row.answer_version};
   const result=await engine.handlePaperScan(m.db,requestFor(m,action),m.owner);
   const current=m.row.effective_snapshot;
   if(protectedReview){
     expect(current.answers).toEqual(before);
     for(const [k,v] of Object.entries(stamps))expect(m.row[k]).toEqual(v);
     expect(current.omr_reprocess_proposal.applied).toBe(false);
     expect(current.omr_reprocess_proposal.answers[0].selected).toBe(2);
     expect(result.proposal_only).toBe(true);
   }else{
     expect(current.answers[0].selected).toBe(2);
     expect(current.answers[0].reviewed_manually).toBeUndefined();
     expect(m.row.reviewed_at).toBeNull();
   }
   expect(m.writes.some((x:any)=>x.table==="nafes_assessment_attempts")).toBe(false);
 }
});
test("failed reprocessing does not erase manual answers or stamps",async()=>{
 const m=manualReviewFixture();m.row.snapshot.answers[0].reviewed_manually=true;
 const before=structuredClone(m.row.snapshot.answers),date=m.row.reviewed_at;
 await expect(repaired.handlePaperScan(m.db,requestFor(m,"teacher_scan_reprocess_server"),m.owner)).rejects.toThrow("القارئ");
 expect(m.row.effective_snapshot.answers).toEqual(before);expect(m.row.reviewed_at).toBe(date);
 expect(m.row.effective_snapshot.omr_reprocess_proposal.applied).toBe(false);
 expect(m.row.effective_snapshot.omr_reprocess_proposal.error).toBeTruthy();
});
