import { test, expect } from "bun:test";
import { scan as original, developmentScan as repaired } from "./source";
import { syntheticSheet, blue } from "./fixtures";
import { memoryDb } from "./memory-db";

test("ambiguous candidates remain uncertain; missing keys do not prove an OMR reading failure",()=>{
  const candidate={status:"ambiguous",selected:2,marked:[0,2]};
  expect(original.classifyAnswer(candidate,{correct_index:2},0).state).toBe("multiple");
  const result=repaired.classifyAnswer(candidate,{correct_index:2},0);
  expect(result.state).toBe("uncertain");
  expect(result.correct).toBe(false);
  expect(result.status).toBe("ambiguous");
  expect(result.marked).toEqual([0,2]);
  // Contradictory evidence needs verification, not a guessed multiple classification.
  expect(repaired.classifyAnswer({...candidate,status:"clear"},{correct_index:2},0).state).toBe("uncertain");
  expect(repaired.classifyAnswer({...candidate,status:"multiple"},{correct_index:2},0).state).toBe("multiple");
  for(const engine of [original,repaired]){
    expect(engine.classifyAnswer({status:"clear",selected:2,marked:[2]}, {},0).state).toBe("uncertain");
  }
});

test("local registration preserves weak mixed-ink uncertainty without student-attempt writes",async()=>{
  const image=syntheticSheet({marks:[
    {row:0,option:0,radius:.45},{row:0,option:2,color:blue},
  ]});
  const db=memoryDb(image);
  const result=await repaired.handlePaperScan(db.db,{
    ...db.request,action:"teacher_scan_register",
    sheet:{ordinal:1,sheet_no:1,model:"A",qr_valid:true,image_data:image},
  },db.owner);
  const snapshot=result.sheet.snapshot;
  expect(snapshot.answers[0].status).toBe("ambiguous");
  expect(snapshot.answers[0].state).toBe("uncertain");
  expect(snapshot.counts.uncertain).toBe(1);
  expect(snapshot.counts.multiple).toBe(0);
  expect(snapshot.omr_verification.auto_accept).toBe(false);
  expect(snapshot.omr_verification.requires_manual_review).toBe(true);
  expect(db.writes.every((w:any)=>w.rpc==="nafes_scan_register")).toBe(true);
});
