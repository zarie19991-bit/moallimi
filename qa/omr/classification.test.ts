import {test,expect} from "bun:test";
import {scan as original,developmentScan as repaired,developmentOmr} from "./source";
import {syntheticSheet,blue} from "./fixtures";
import {memoryDb,ids} from "./memory-db";
import {classificationCases} from "./classification-cases";

for(const c of classificationCases)test(`classification meaning: ${c.id}`,()=>{
 const a=repaired.classifyAnswer(c.raw,c.key,0,c.context);
 expect(a.reading_status).toBe(c.reading);
 expect(a.state).toBe(c.state);
 expect(Object.entries(a.uncertainty).filter(([,v]:any)=>v.length).map(([k])=>k)).toEqual(c.categories);
 if(c.state==="uncertain"){
   expect(a.correct).toBe(false);
   expect(a.requires_verification).toBe(true);
 }
 if(c.reading==="ambiguous"){expect(a.confirmed_marks).toEqual([]);expect(a.candidates).toEqual(c.raw.marked);expect(a.selected).toBeNull();}
});

test("all 16 healthy option/key combinations retain the original classification and choice",()=>{
 for(let option=0;option<4;option++)for(let key=0;key<4;key++){
   const raw={status:"clear",selected:option,marked:[option],confidence:1};
   const old=original.classifyAnswer(raw,{correct_index:key},0);
   const fresh=repaired.classifyAnswer(raw,{correct_index:key},0,{identity_valid:true,key_complete:true,markers_ok:true});
   expect(fresh.state).toBe(old.state);expect(fresh.correct).toBe(old.correct);
   expect(fresh.selected).toBe(old.selected);expect(fresh.marked).toEqual(old.marked);
   expect(fresh.requires_verification).toBe(false);
 }
});

test("ambiguous candidates never become correct for any key or confidence",()=>{
 for(const marked of [[],[0],[0,2],[0,1,2,3]])for(let key=0;key<4;key++)for(const confidence of [0,1]){
   const a=repaired.classifyAnswer({status:"ambiguous",selected:marked[0]??null,marked,confidence},{correct_index:key},0,{identity_valid:true,key_complete:true,markers_ok:true});
   expect(a.status).toBe("ambiguous");expect(a.state).toBe("uncertain");expect(a.correct).toBe(false);expect(a.selected).toBeNull();
 }
});

test("malformed or contradictory evidence cannot turn into blank, correct or proven multiple",()=>{
 for(const raw of [
   {status:"blank",selected:9,marked:[]},{status:"clear",selected:2,marked:"0,2"},
   {status:"multiple",selected:null,marked:[0,0]},{status:"multiple",selected:1,marked:[0,2]},
   {status:"multiple",selected:0,marked:[0,2,9]},{status:"unknown",selected:2,marked:[2]},
 ]){
   const a=repaired.classifyAnswer(raw,{correct_index:2},0);
   expect(a.state).toBe("uncertain");expect(a.reading_status).toBe("invalid");
   expect(a.confirmed_marks).toEqual([]);expect(a.correct).toBe(false);
 }
});

const single=syntheticSheet({marks:[{row:0,option:0}]});
async function register(db:ReturnType<typeof memoryDb>,qr=true,image=single){
 return (await repaired.handlePaperScan(db.db,{
   ...db.request,action:"teacher_scan_register",
   sheet:{ordinal:1,sheet_no:1,model:"A",qr_valid:qr,image_data:image},
 },db.owner)).sheet.snapshot;
}
function noStudentWrites(db:ReturnType<typeof memoryDb>){
 expect(db.writes.every((w:any)=>w.rpc==="nafes_scan_register"||w.rpc==="nafes_scan_assign_identity")).toBe(true);
}
test("valid synthetic registration preserves the correct answer and existing score",async()=>{
 const db=memoryDb(single),s=await register(db);
 expect(s.answers[0].selected).toBe(0);expect(s.answers[0].state).toBe("correct");
 expect(s.score).toBe(1);expect(s.counts.blank).toBe(3);
 expect(s.uncertainty_counts).toEqual({reading:0,identity:0,answer_key:0});
 noStudentWrites(db);
});
test("identity failure does not falsely become a bubble reading failure",async()=>{
 const db=memoryDb(single),s=await register(db,false),a=s.answers[0];
 expect(s.identity_valid).toBe(false);expect(s.markers_ok).toBe(true);
 expect(a.reading_status).toBe("clear");expect(a.state).toBe("uncertain");
 expect(a.uncertainty).toEqual({reading:[],identity:["identity_not_verified"],answer_key:[]});
 expect(s.reading_counts).toMatchObject({clear:1,blank:3});
 expect(s.score).toBe(0);expect(s.omr_verification.auto_accept).toBe(false);
 noStudentWrites(db);
});
for(const invalidKey of [[],[{correct_index:0}],[{correct_index:null},{correct_index:0},{correct_index:0},{correct_index:0}]]){
 test(`incomplete/invalid key is independent of identity (${JSON.stringify(invalidKey)})`,async()=>{
   const db=memoryDb(single);
   db.tables.nafes_scan_sessions[0].review_snapshot.answer_keys[0].answers=invalidKey;
   const s=await register(db),a=s.answers[0];
   expect(s.identity_valid).toBe(true);expect(s.markers_ok).toBe(true);
   expect(a.reading_status).toBe("clear");expect(a.state).toBe("uncertain");
   expect(a.uncertainty.reading).toEqual([]);expect(a.uncertainty.identity).toEqual([]);
   expect(a.uncertainty.answer_key).toContain("answer_key_incomplete");
   expect(s.score).toBe(0);expect(s.omr_verification.auto_accept).toBe(false);
   expect(s.omr_verification.requires_manual_review).toBe(true);noStudentWrites(db);
 });
}
test("JPEG decoding failure remains unavailable, never a fabricated blank",async()=>{
 const db=memoryDb(single),s=await register(db,true,"data:image/jpeg;base64,AA==");
 expect(s.reading_counts.unavailable).toBe(4);expect(s.counts.blank).toBe(0);
 expect(s.answers[0].uncertainty.reading).toContain("reader_failed");
 expect(s.answers[0].uncertainty.identity).toEqual([]);
 expect(s.answers[0].uncertainty.answer_key).toEqual([]);
 expect(s.omr_verification.auto_accept).toBe(false);noStudentWrites(db);
});
for(const reviewed of [false,true])test(`identity assignment cannot promote ambiguous candidates (reviewed=${reviewed})`,async()=>{
 const image=syntheticSheet({marks:[{row:0,option:0,radius:.45},{row:0,option:2,color:blue}]});
 const db=memoryDb(image),s=await register(db,false,image);
 const row=db.tables.nafes_scan_sheets[0];
 row.snapshot=s;row.effective_snapshot=null;row.student_id=null;
 row.snapshot.answers[0].reviewed_manually=reviewed;
 const r=await repaired.handlePaperScan(db.db,{...db.request,action:"teacher_scan_assign_identity",sheet_id:ids.sheet,student_id:ids.student,answer_version:row.answer_version},db.owner);
 const a=r.sheet.effective_snapshot.answers[0];
 expect(a.status).toBe("ambiguous");expect(a.state).toBe("uncertain");expect(a.correct).toBe(false);
 expect(a.uncertainty.reading).toContain("bubble_ambiguous");expect(a.uncertainty.identity).toEqual([]);
 expect(r.sheet.effective_snapshot.omr_verification.auto_accept).toBe(false);noStudentWrites(db);
});
test("physical black/blue double fill stays multiple; a small competing mark stays ambiguous",()=>{
 for(const radius of [1.3,.45]){
   const image=syntheticSheet({marks:[{row:0,option:0,radius},{row:0,option:2,color:blue}]});
   const raw=developmentOmr.readOmrJpeg(image,4).answers[0];
   const a=repaired.classifyAnswer(raw,{correct_index:2},0,{identity_valid:true,key_complete:true,markers_ok:true});
   expect(a.state).toBe(radius===1.3?"multiple":"uncertain");
   expect(a.status).toBe(radius===1.3?"multiple":"ambiguous");
   expect(a.correct).toBe(false);expect(a.requires_verification).toBe(true);
 }
});
test("all 60 healthy synthetic choices retain their classification and selections",()=>{
 const marks=Array.from({length:60},(_,row)=>({row,option:row%4,...(row%2?{color:blue}:{})}));
 const raw=developmentOmr.readOmrJpeg(syntheticSheet({marks}),60).answers;
 for(let i=0;i<60;i++){
   expect(raw[i].status).toBe("clear");expect(raw[i].selected).toBe(i%4);
   const old=original.classifyAnswer(raw[i],{correct_index:i%4},i);
   const fresh=repaired.classifyAnswer(raw[i],{correct_index:i%4},i,{identity_valid:true,key_complete:true,markers_ok:true});
   expect(fresh.state).toBe(old.state);expect(fresh.state).toBe("correct");
   expect(fresh.selected).toBe(old.selected);expect(fresh.marked).toEqual(old.marked);
 }
});
test("missing visual markers cannot masquerade as identity or key failure",async()=>{
 const image=syntheticSheet({markers:false}),db=memoryDb(image),s=await register(db,true,image);
 expect(s.identity_valid).toBe(true);expect(s.markers_ok).toBe(false);
 expect(s.reading_counts.unavailable).toBe(4);
 expect(s.answers[0].uncertainty.reading).toContain("reader_failed");
 expect(s.answers[0].uncertainty.identity).toEqual([]);
 expect(s.answers[0].uncertainty.answer_key).toEqual([]);
 expect(s.omr_verification.auto_accept).toBe(false);noStudentWrites(db);
});
function markFakeVerified(db:ReturnType<typeof memoryDb>,snapshot:any){
 db.tables.nafes_scan_sessions[0].completed_at="2026-01-01T00:00:00Z";
 const row=db.tables.nafes_scan_sheets[0];
 Object.assign(row,{snapshot,effective_snapshot:null,student_id:ids.student,disposition:"verified",blocked_duplicate:false});
}
test("final payload preserves healthy synthetic choices and does not write attempts",async()=>{
 const db=memoryDb(single),s=await register(db);
 markFakeVerified(db,s);
 const payload=await repaired.reviewedScanPayload(db.db,db.request,db.owner);
 expect(payload.results[0].answers[0].selected).toBe(0);
 expect(payload.results[0].answers[0].state).toBe("correct");noStudentWrites(db);
});
for(const staleState of ["uncertain","multiple"])test(`a stale verified label cannot approve ambiguous candidates (${staleState})`,async()=>{
 const db=memoryDb(single),s=await register(db);
 s.answers[0]={...s.answers[0],status:"ambiguous",state:staleState,selected:2,marked:[0,2]};
 markFakeVerified(db,s);
 await expect(repaired.reviewedScanPayload(db.db,db.request,db.owner)).rejects.toThrow("غير محسومة");
 noStudentWrites(db);
});
test("a stale verified label cannot approve an unverified identity",async()=>{
 const db=memoryDb(single),s=await register(db,false);
 markFakeVerified(db,s);
 await expect(repaired.reviewedScanPayload(db.db,db.request,db.owner)).rejects.toThrow("هوية");
 noStudentWrites(db);
});
test("a verified physical multiple remains multiple, never a single keyed answer",async()=>{
 const image=syntheticSheet({marks:[{row:0,option:0,radius:1.3},{row:0,option:2,color:blue}]});
 const db=memoryDb(image),s=await register(db,true,image);
 expect(s.answers[0].state).toBe("multiple");expect(s.answers[0].selected).toBeNull();
 markFakeVerified(db,s);
 const payload=await repaired.reviewedScanPayload(db.db,db.request,db.owner);
 expect(payload.results[0].answers[0].state).toBe("multiple");
 expect(payload.results[0].answers[0].selected).toBeNull();noStudentWrites(db);
});
