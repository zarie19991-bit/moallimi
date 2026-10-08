import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { developmentOmr as omr } from "./source";
import { syntheticSheet, blue } from "./fixtures";
import { blueIllumination } from "./image-variants";
import labels from "./results/real-six/visual-labels.json";

test("weak second black ink beside a strong blue answer must block automatic acceptance",()=>{
  const result=omr.readOmrJpeg(syntheticSheet({marks:[
    {row:0,option:0,radius:.45},{row:0,option:2,color:blue},
  ]}),1);
  expect(result.answers[0].status).toBe("ambiguous");
  expect(result.answers[0].reader).toBe("mixed-ink-review");
  expect([...result.answers[0].marked].sort()).toEqual([0,2]);
  expect(result.verification.auto_accept).toBe(false);
  expect(result.verification.requires_manual_review).toBe(true);
});
test("blue-lit blank paper is not four blue answers",()=>{
  const result=omr.readOmrJpeg(blueIllumination(syntheticSheet()),60);
  expect(result.answers.map((a:any)=>[a.status,a.selected])).toEqual(Array.from({length:60},()=>["blank",null]));
});
for(const color of [blue,[25,25,25] as [number,number,number]]){
  test(`blue-lit ${color===blue?"blue":"black"} fills preserve all 60 choices`,()=>{
    const marks=Array.from({length:60},(_,row)=>({row,option:row%4,color}));
    const result=omr.readOmrJpeg(blueIllumination(syntheticSheet({marks})),60);
    expect(result.answers.map((a:any)=>[a.status,a.selected])).toEqual(marks.map(m=>["clear",m.option]));
  });
}
for(const page of [1,2,6]){
  const file=`${import.meta.dir}/results/hardening/real-page-${page}-blue-illumination.jpg`;
  (existsSync(file)?test:test.skip)(`controlled derivative of real page ${page}: blue paper cast does not produce multiple answers`,()=>{
    const image=`data:image/jpeg;base64,${readFileSync(file).toString("base64")}`;
    const result=omr.readOmrJpeg(image,60);
    const expected=labels.sheets[page-1].blocks.join(" ").split(" ").map(x=>labels.option_order.indexOf(x));
    expect(result.answers.map((a:any)=>a.selected)).toEqual(expected);
    expect(result.answers.map((a:any)=>a.status)).toEqual(Array(60).fill("clear"));
  });
}
