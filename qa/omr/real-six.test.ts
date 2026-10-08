import { test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import jpeg from "jpeg-js";
import { omr, developmentOmr } from "./source";
import labels from "./results/real-six/visual-labels.json";

const root = `${import.meta.dir}/results/real-six`;
const available = labels.sheets.every(s => existsSync(`${root}/page-${s.page}.jpg`));
const runTest = available ? test : test.skip;
const expected = (sheet:typeof labels.sheets[number]) =>
  sheet.blocks.join(" ").split(" ").map(v => labels.option_order.indexOf(v));

runTest("real-sheet reference contains 360 visually reviewed options, not an exam key", () => {
  expect(labels.sheets).toHaveLength(6);
  for (const sheet of labels.sheets) {
    expect(expected(sheet)).toHaveLength(60);
    expect(expected(sheet).every(i=>i>=0&&i<4)).toBe(true);
  }
  expect(labels.transcription_revisions).toHaveLength(4);
});
for (const sheet of labels.sheets) {
  for (const [name, engine] of [["original",omr],["development",developmentOmr]] as const) {
    runTest(`real page ${sheet.page}: ${name} matches 60 assistant-reviewed visual options`, () => {
      const data=readFileSync(`${root}/page-${sheet.page}.jpg`);
      const result=engine.readOmrJpeg(`data:image/jpeg;base64,${data.toString("base64")}`,60);
      expect(result.answers.map((a:any)=>a.selected)).toEqual(expected(sheet));
      expect(result.answers.map((a:any)=>a.status)).toEqual(Array(60).fill("clear"));
    });
  }
}
runTest("detected real-sheet marker centers contrast with adjacent paper; grid support remains strong", () => {
  const runs=JSON.parse(readFileSync(`${root}/readings.json`,"utf8"));
  for (const run of runs) {
    const image=jpeg.decode(readFileSync(`${root}/page-${run.page}.jpg`),{useTArray:true});
    for (const point of Object.values(run.after.marker_points) as number[][]) {
      const x=Math.round(point[0]), y=Math.round(point[1]);
      expect(x>=0&&x<image.width&&y>=0&&y<image.height).toBe(true);
      const i=(y*image.width+x)*4;
      const paper=(y*image.width+x+14)*4;
      const center=(image.data[i]+image.data[i+1]+image.data[i+2])/3;
      const background=(image.data[paper]+image.data[paper+1]+image.data[paper+2])/3;
      // Scanned printed markers are gray, not necessarily RGB <100.
      // Verify strong contrast against paper rather than assume pure black ink.
      expect(center).toBeLessThan(background*.5);
    }
    expect(run.after.grid_alignment.score).toBeGreaterThan(.10);
  }
});
runTest("a deliberately wrong reference option is not treated as a match", () => {
  const runs=JSON.parse(readFileSync(`${root}/readings.json`,"utf8"));
  const wrong=expected(labels.sheets[0]);
  wrong[0]=(wrong[0]+1)%4;
  expect(runs[0].after.answers.map((a:any)=>a.selected)).not.toEqual(wrong);
});
