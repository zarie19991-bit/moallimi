import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../review-scan-journal.js',import.meta.url),'utf8');
const actions=source.slice(source.indexOf('async function publishSheets('),source.indexOf('\nfunction download('));
function harness(count){
 const calls=[],messages=[],receipts=new Set(),nodes=new Map();let navigated=false;
 const context={sheets:Array.from({length:count},(_,i)=>({id:'s'+i,ordinal:i+1,answer_version:0,disposition:'verified'})),busy:false,
  session:{},draft:{review_id:'RTEST'},publishedSheets:receipts,receiptKey:s=>s.id+':'+s.answer_version,
  wasPublished:s=>receipts.has(s.id+':'+s.answer_version),confirm:()=>true,ar:String,
  $:id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,classList:{remove(){}}});return nodes.get(id)},
  NafesTeacher:{clearReadCache(){}},message:s=>messages.push(s),render(){},
  location:{assign:()=>{navigated=true}},api:async(action,b)=>{calls.push([...b.sheet_ids]);return{saved_count:b.sheet_ids.length,saved_sheet_ids:b.sheet_ids}}};
 context.lock=v=>context.busy=v;vm.createContext(context);vm.runInContext(actions,context);
 return{context,calls,messages,receipts,navigated:()=>navigated};
}
test('one paper publishes only its own ID and leaves reviewer on the page',async()=>{
 const h=harness(12);await h.context.approveOne('s7');
 assert.deepEqual(h.calls,[['s7']]);assert.equal(h.navigated(),false);assert.equal(h.receipts.size,1);
 await h.context.approveOne('s7');assert.equal(h.calls.length,1);
});
test('group publication is bounded and resumes after a failed batch',async()=>{
 const h=harness(12),base=h.context.api;let fail=true;
 h.context.api=async(a,b)=>{if(b.sheet_ids[0]==='s5'&&fail){fail=false;throw new Error('timeout')};return base(a,b)};
 await h.context.approve();assert.equal(h.receipts.size,5);assert.equal(h.navigated(),false);assert.equal(h.context.busy,false);
 await h.context.approve();assert.deepEqual(h.calls.map(x=>x.length),[5,5,2]);assert.equal(h.receipts.size,12);assert.equal(h.navigated(),true);
});
test('unverified and duplicate papers cannot be approved individually',async()=>{
 const h=harness(2);h.context.sheets[0].disposition=null;h.context.sheets[1].blocked_duplicate=true;
 await h.context.approveOne('s0');await h.context.approveOne('s1');assert.equal(h.calls.length,0);
});
test('no receipt is shown without a complete server acknowledgement',async()=>{
 const h=harness(1);h.context.api=async()=>({saved_count:0,saved_sheet_ids:[]});
 await h.context.approveOne('s0');assert.equal(h.receipts.size,0);assert.equal(h.context.busy,false);
});
