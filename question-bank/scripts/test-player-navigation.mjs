import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../e-player-demo-fix.js',import.meta.url),'utf8');
const start=source.indexOf('function navigate(n)'),end=source.indexOf("$('next').onclick",start);
assert.ok(start>=0&&end>start);
function harness(save=()=>new Promise(()=>{})){
 const events=[];
 const ctx={active:true,deliveryJob:null,transitionPending:false,cursor:0,saveDelay:0,
  state:{current_section:1,settings:{allow_back:true},sections:[{}, {questions:Array.from({length:20},(_,i)=>({id:'q'+i}))}]},
  answers:{q0:2},clearTimeout(){},writeDraft(){events.push(['draft',ctx.cursor,{...ctx.answers}]);},
  render(){events.push(['render',ctx.cursor]);},$(){return{scrollIntoView(){events.push(['scroll']);}};},
  save(){events.push(['save',ctx.cursor]);return save();}
 };
 vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 return{ctx,events};
}
test('next and numbered navigation render immediately while server save is stalled',()=>{
 const {ctx,events}=harness();ctx.navigate(1);assert.equal(ctx.cursor,1);
 assert.deepEqual(events.map(x=>x[0]),['draft','render','scroll','save']);
 ctx.navigate(12);assert.equal(ctx.cursor,12);ctx.navigate(4);assert.equal(ctx.cursor,4);
 assert.deepEqual(ctx.answers,{q0:2});
});
test('offline save failures never roll back the selected question or answers',async()=>{
 const {ctx,events}=harness(()=>Promise.reject(new Error('offline')));
 ctx.navigate(5);await new Promise(r=>setImmediate(r));
 assert.equal(ctx.cursor,5);assert.equal(events[0][2].q0,2);
 ctx.answers.q5=1;ctx.navigate(6);await new Promise(r=>setImmediate(r));
 assert.equal(ctx.cursor,6);assert.deepEqual(ctx.answers,{q0:2,q5:1});
});
test('submission and subject transition retain navigation guards',()=>{
 for(const guard of ['deliveryJob','transitionPending']){
  const {ctx,events}=harness();ctx[guard]=true;ctx.navigate(2);assert.equal(ctx.cursor,0);assert.equal(events.length,0);
 }
});
test('invalid indexes and inactive attempts do not navigate',()=>{
 const {ctx,events}=harness();for(const n of [-1,20,1.5,NaN])ctx.navigate(n);
 ctx.active=false;ctx.navigate(1);assert.equal(events.length,0);
});
test('forward-only tests cannot skip or return to earlier questions',()=>{
 const {ctx}=harness();ctx.state.settings.allow_back=false;ctx.navigate(4);assert.equal(ctx.cursor,0);
 ctx.navigate(1);assert.equal(ctx.cursor,1);ctx.navigate(0);assert.equal(ctx.cursor,1);
});
