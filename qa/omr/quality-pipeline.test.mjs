import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),jpeg=require('jpeg-js');
const temp=mkdtempSync(join(tmpdir(),'omr-quality-'));
const dir='supabase/functions/nafes-exam/';
for(const f of ['omr-blank.ts','omr-center-evidence.ts','omr-multiple-evidence.ts'])copyFileSync(dir+f,join(temp,f));
writeFileSync(join(temp,'reader.ts'),readFileSync(dir+'omr-server.ts','utf8').replace('npm:jpeg-js@0.4.4',pathToFileURL(require.resolve('jpeg-js')).href));
const {readOmrJpeg}=await import(pathToFileURL(join(temp,'reader.ts')));
process.on('exit',()=>rmSync(temp,{recursive:true,force:true}));
function synthetic({blank=false,rotate=false,worn=false}={}){
 const width=1000,height=1500,data=new Uint8Array(width*height*4).fill(255);
 const point=(x,y)=>({x:70+(x-4)*5,y:850+(y-4)*5});
 function pixel(x,y,v){if(x>=0&&x<width&&y>=0&&y<height){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=v;}}
 for(const [cx,cy] of [[4,4],[176,4],[4,108],[176,108]]){const p=point(cx,cy);for(let y=-7;y<=7;y++)for(let x=-7;x<=7;x++)pixel(p.x+x,p.y+y,worn&&cx===176&&cy===4&&(x+y)%4===0?240:20);}
 const expected=[];
 for(let i=0;i<60;i++){const right=[171,128,85,42][Math.floor(i/15)],cy=20+(i%15)*5.45,chosen=(i*3+1)%4;expected.push(blank?null:chosen);
  for(let j=0;j<4;j++){const p=point(right-[7.5,15.5,23.5,31.5][j],cy);for(let y=Math.floor(p.y-13);y<=p.y+13;y++)for(let x=Math.floor(p.x-13);x<=p.x+13;x++){const r=Math.hypot(x-p.x,y-p.y);if(r>=9&&r<=11||!blank&&j===chosen&&r<=8)pixel(x,y,25);}}
 }
 let pixels=data,w=width,h=height;
 if(rotate){pixels=new Uint8Array(data.length);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const to=(x*height+(height-1-y))*4;pixels.set(data.subarray((y*width+x)*4,(y*width+x)*4+4),to);}w=height;h=width;}
 return {src:'data:image/jpeg;base64,'+jpeg.encode({width:w,height:h,data:pixels},90).data.toString('base64'),expected};
}
for(const options of [{},{rotate:true},{worn:true},{blank:true}])test('optical reader follows known marks '+JSON.stringify(options),()=>{
 const {src,expected}=synthetic(options),result=readOmrJpeg(src,60);
 assert.deepEqual(result.answers.map(a=>a.selected),expected);
 assert.ok(result.answers.every(a=>options.blank?a.status==='blank':a.status==='clear'));
});
function resultsHarness(api){const window={NafesTeacher:{api}};vm.runInNewContext(readFileSync('review-results-core.js','utf8'),{window,console,Intl,URLSearchParams});return window.NafesPaperResults;}
const base=(action)=>action==='teacher_paper_review_list'?{reviews:[{review_id:'r'}]}:action==='teacher_students_list'?{students:[]}:action==='teacher_paper_review_get'?{review:{review_id:'r',payload:{models:[],assignments:[]}}}:null;
test('report rejects repeated pagination rather than publishing a partial result',async()=>{
 const r=resultsHarness(async(action)=>base(action)||{attempts:[],next_cursor:0});await assert.rejects(()=>r.load('r'),/صفحات النتائج/);
});
test('roster failure is visible instead of silently changing absence figures',async()=>{
 const r=resultsHarness(async(action)=>{if(action==='teacher_students_list')throw Error('roster unavailable');return base(action)||{attempts:[],next_cursor:null};});await assert.rejects(()=>r.load('r'),/roster unavailable/);
});
test('missing grade is not reported as a real zero',async()=>{
 const r=resultsHarness(async(action)=>base(action)||{attempts:[{id:'a',student_id:'s',submitted_at:'2026-10-15',score:null,total:60,events:[{type:'paper_scan',review_id:'r'}],questions:[]}],next_cursor:null});await assert.rejects(()=>r.load('r'),/درجة غير مكتملة/);
});
test('verified zero remains a real result with a zero percentage',async()=>{
 const r=resultsHarness(async(action)=>base(action)||{attempts:[{id:'a',student_id:'s',submitted_at:'2026-10-15',score:0,total:60,percent:null,events:[{type:'paper_scan',review_id:'r'}],questions:[]}],next_cursor:null});const b=await r.load('r');assert.equal(b.students[0].percent,0);assert.equal(b.summary.tested,1);
});
