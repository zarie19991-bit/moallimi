import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isVerifiedBlankBubbleRow } from '../../supabase/functions/nafes-exam/omr-blank.ts';

const blankRow = () => [
  {center:253.8,score:-0.103,blueInsideMass:0,blueInsideHits:0,darkRowScore:.200},
  {center:253.7,score:-0.100,blueInsideMass:0,blueInsideHits:0,darkRowScore:.165},
  {center:253.9,score:-0.101,blueInsideMass:0,blueInsideHits:0,darkRowScore:.163},
  {center:253.8,score:-0.147,blueInsideMass:0,blueInsideHits:0,darkRowScore:.152},
];

test('60 objectively blank rows stay blank despite a printed outer-ring dark signal',()=>{
 const rows=Array.from({length:60},blankRow);
 assert(rows.every(isVerifiedBlankBubbleRow));
 assert.equal(rows.reduce((n,r)=>n+(isVerifiedBlankBubbleRow(r)?0:1),0),0);
});

test('faint, colored or uncertain marks are NOT silently turned into blank',()=>{
 const white=blankRow();
 for(const [index,override] of [
  [0,{center:235}],
  [1,{score:-.04}],
  [2,{blueInsideMass:7}],
  [2,{blueInsideHits:5}],
  [3,{score:0.3}],
  [3,{center:NaN}],
 ]){
  const row=white.map((x,i)=>i===index?{...x,...override}:x);
  assert.equal(isVerifiedBlankBubbleRow(row),false,JSON.stringify(override));
 }
 assert.equal(isVerifiedBlankBubbleRow(white.slice(0,3)),false);
});

test('per-row white evidence overrides printed-ring dark-row selection; geometry remains gated',()=>{
 const src=readFileSync('supabase/functions/nafes-exam/omr-server.ts','utf8');
 const blank=src.indexOf('if(isVerifiedBlankBubbleRow(ev))');
 const blue=src.indexOf('if(hasBlue)',blank);
 const dark=src.indexOf('if(darkRowMultiple)',blank);
 assert(blank>0 && blue>blank && dark>blank,'blank guard must take precedence over the ink fallbacks');
 assert(src.includes('blankGeometryVerified=m.confidence>=.85&&grid.score>=.10'));
 assert(src.includes("status:blankGeometryVerified?'blank':'ambiguous'"));
 assert(src.includes('selected:null,marked:[]'));
 assert(src.includes("reader:blankGeometryVerified?'blank-interior-consensus'"));
});
