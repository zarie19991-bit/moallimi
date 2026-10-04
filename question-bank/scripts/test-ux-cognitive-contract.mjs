import fs from 'node:fs';
import assert from 'node:assert/strict';

const hex=v=>v.replace('#','');
const rgb=h=>{const x=hex(h);return [0,2,4].map(i=>parseInt(x.slice(i,i+2),16)/255)};
const lum=h=>rgb(h).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=lum(a),y=lum(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+.05)/(lo+.05)};

const css=fs.readFileSync('tamakkun-design-system.css','utf8');
const brand=fs.readFileSync('moallimi-brand.css','utf8');
const exam=fs.readFileSync('supabase/functions/nafes-exam/assessments.ts','utf8');
const engine=fs.readFileSync('supabase/functions/nafes-exam/assessment-engine.ts','utf8');
const production=fs.readFileSync('production-files.txt','utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&& !x.startsWith('#'));

for(const [name,fg,bg] of [
 ['primary white text','#ffffff','#0f766e'],
 ['secondary white text','#ffffff','#1d5f8a'],
 ['amber white text','#ffffff','#a86600'],
 ['body ink','#102a43','#f6f9fb'],
 ['muted text','#52677a','#ffffff']
]){
  assert.ok(contrast(fg,bg)>=4.5,name+' contrast '+contrast(fg,bg));
}
assert.match(css,/--tk-danger-700:#a33a3a/);
assert.match(css,/:focus-visible[\s\S]*outline:3px solid var\(--tk-sky-700\)/);
assert.match(brand,/object-fit:contain!important/);
assert.match(brand,/overflow:visible!important/);
assert.doesNotMatch(brand,/object-fit:cover/);

for(const file of production.filter(x=>x.endsWith('.html')&&fs.existsSync(x))){
  const h=fs.readFileSync(file,'utf8');
  assert.doesNotMatch(h,/moallimi-logo-ui\.png/,file+' still uses compact/cropped logo asset');
}
assert.match(exam,/export function sequenceLearningQuestions/);
assert.match(exam,/c\.kind==='simulation'&&s\.shuffle_questions/);
assert.doesNotMatch(exam,/questions:\(s\.shuffle_questions\?shuffle\(section\.questions/);
assert.match(engine,/question_sequence:isSimulation\?'randomized':'pedagogical_v1'/);
console.log('PASS cognitive UX contract',{
  primary:contrast('#ffffff','#0f766e').toFixed(2),
  secondary:contrast('#ffffff','#1d5f8a').toFixed(2),
  amber:contrast('#ffffff','#a86600').toFixed(2),
  ink:contrast('#102a43','#f6f9fb').toFixed(2)
});
