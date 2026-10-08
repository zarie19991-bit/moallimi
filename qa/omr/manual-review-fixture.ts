import {memoryDb,ids} from "./memory-db";

// This is a JavaScript boundary recorder, not a SQL database or RPC replacement.
export function manualReviewFixture(mode="clear"){
 const m=memoryDb("data:image/jpeg;base64,AA=="),row=m.tables.nafes_scan_sheets[0];
 const count=m.tables.nafes_scan_sessions[0].review_snapshot.question_count;
 row.snapshot={
   identity_valid:true,markers_ok:true,model:"A",total:count,
   answers:Array.from({length:count},(_,i)=>({
     question:i+1,status:"clear",state:"correct",selected:0,marked:[0],correct:true,correct_index:0,
   })),
 };
 row.effective_snapshot=null;row.student_id=ids.student;row.blocked_duplicate=false;
 if(mode==="ambiguous")Object.assign(row.snapshot.answers[0],{status:"ambiguous",state:"uncertain",selected:2,marked:[0,2],correct:false});
 if(mode==="uncertain")Object.assign(row.snapshot.answers[0],{state:"uncertain",correct:false});
 const calls:{name:string;args:any}[]=[];
 m.db.rpc=async(name:string,args:any)=>{
   calls.push({name,args:structuredClone(args)});
   // Stop before persistence. Never simulate successful SQL execution.
   throw new Error("QA_RPC_BOUNDARY_NO_SQL_EXECUTED");
 };
 return {...m,row,calls};
}
export function requestFor(m:ReturnType<typeof manualReviewFixture>,action:string){
 return {...m.request,action,sheet_id:ids.sheet,student_id:ids.student,
   answer_version:m.row.answer_version,question:1,marked:[0],
   request_id:"00000000-0000-4000-8000-000000000009",reason:"synthetic visual review"};
}
export async function inspectBoundary(engine:any,m:ReturnType<typeof manualReviewFixture>,action:string){
 let error:string|null=null;
 try{await engine.handlePaperScan(m.db,requestFor(m,action),m.owner);}
 catch(e:any){error=String(e.message);}
 return {rpc_reached:m.calls.length>0,error,calls:m.calls,sql_executed:false,memory_writes:m.writes.length};
}
