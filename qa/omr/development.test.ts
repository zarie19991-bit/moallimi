import { test, expect } from "bun:test";
import { developmentOmr as omr } from "./source";
import { syntheticSheet, blue } from "./fixtures";

test("square markers can move with the answer area into the upper page",()=>{
  const r=omr.readOmrJpeg(syntheticSheet({originY:350,marks:[{row:0,option:1}]}),1);
  expect(r.answers[0].selected).toBe(1);
  expect(r.answers[0].status).toBe("clear");
});
test("printed bubble grid offset is recovered before reading small black marks",()=>{
  const r=omr.readOmrJpeg(syntheticSheet({bubbleDx:1.1,bubbleDy:.9,marks:[{row:0,option:3,radius:1}]}),1);
  expect(r.answers[0].selected).toBe(3);
  expect(r.answers[0].status).toBe("clear");
  expect(r.grid_alignment.blocks[0].dx).toBeGreaterThan(2);
});
test("a small real fill in an offset printed bubble does not become blank or multiple",()=>{
  const r=omr.readOmrJpeg(syntheticSheet({bubbleDx:1.1,bubbleDy:.9,marks:[{row:0,option:3,radius:.45}]}),1);
  expect(r.answers[0].selected).toBe(3);
  expect(r.answers[0].status).toBe("clear");
});
test("all 60 small offset marks retain their known options and clear status",()=>{
  const marks=Array.from({length:60},(_,row)=>({row,option:row%4,radius:.45}));
  const r=omr.readOmrJpeg(syntheticSheet({bubbleDx:1.1,bubbleDy:.9,marks}),60);
  expect(r.answers.map((a:any)=>[a.status,a.selected])).toEqual(marks.map(m=>["clear",m.option]));
});
test("slightly tilted markers still map to the original bubble grid",()=>{
  const r=omr.readOmrJpeg(syntheticSheet({tilt:6,marks:[{row:0,option:1}]}),1);
  expect(r.answers[0].selected).toBe(1);
  expect(r.answers[0].status).toBe("clear");
});
test("60 single answers alternating black and blue never become blank or multiple",()=>{
  const marks=Array.from({length:60},(_,row)=>({row,option:row%4,color:row%2?blue:[25,25,25] as [number,number,number]}));
  const r=omr.readOmrJpeg(syntheticSheet({marks}),60);
  expect(r.answers.map((a:any)=>[a.status,a.selected])).toEqual(marks.map(m=>["clear",m.option]));
});
test("a blue mark outside a bubble cannot override the black answer as clear",()=>{
  const r=omr.readOmrJpeg(syntheticSheet({marks:[
    {row:0,option:0},{row:0,option:2,color:blue,radius:.4,dy:2.7},
  ]}),1);
  expect(r.answers[0].status==="clear"&&r.answers[0].selected===2).toBe(false);
});
test("zero and fractional question counts are rejected",()=>{
  const src=syntheticSheet();
  expect(()=>omr.readOmrJpeg(src,0)).toThrow();
  expect(()=>omr.readOmrJpeg(src,1.5)).toThrow();
});
