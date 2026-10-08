// Unit tests with explicit DB doubles. NOT proof of original-schema deletion/publishing.
import {test,expect} from "bun:test";
import {developmentAssessments} from "./source";
const id="11111111-1111-4111-8111-111111111111";
for(const action of ["teacher_attempt_delete","teacher_test_clear_results","teacher_test_delete","teacher_tests_bulk_clear"]){
 test("generic "+action+" cannot bypass reviewed-paper audit",async()=>{
  const writes:string[]=[];
  const teacher={id:"33333333-3333-4333-8333-333333333333",subject_scope:"all"};
  const db={
   from(table:string){
    let single=false;
    const row=table==="nafes_teacher_access"?teacher:table==="nafes_assessment_attempts"?
      {id,assessment_id:id,events:[{type:"paper_scan",scan_sheet_id:id}],config:{paper_review:true},is_demo:false}:
      {id,config:{paper_review:true,paper_review_id:"RTEST"},owner_id:teacher.id};
    const query:any={select(){return query;},eq(){return query;},contains(){return query;},limit(){return query;},
      maybeSingle(){single=true;return query;},delete(){writes.push(table);return query;},
      then(resolve:any){return Promise.resolve({data:single?row:[row],error:null}).then(resolve);}};
    return query;
   },rpc(){writes.push("RPC");throw Error("Unexpected destructive RPC");},
  };
  const req=new Request("https://synthetic.invalid",{headers:{"x-teacher-key":"0000000001"}});
  const confirm=action==="teacher_attempt_delete"?"حذف النتيجة":action==="teacher_test_delete"?"حذف":"مسح النتائج";
  await expect(developmentAssessments.handleAssessments(db,req,{action,source:"assessment",attempt_id:id,test_id:id,test_ids:[id],confirm_word:confirm}))
   .rejects.toThrow(/المراجعة|التراجع/);
  expect(writes).toEqual([]);
 });
}
test("global clear cannot erase a reviewed paper through an unrelated RPC",async()=>{
 const calls:string[]=[];
 const db={from(table:string){
  let single=false;const q:any={select(){return q;},eq(){return q;},contains(){return q;},limit(){return q;},
   maybeSingle(){single=true;return q;},then(resolve:any){const r=table==="nafes_teacher_access"?{id,subject_scope:"all"}:{id};
    return Promise.resolve({data:single?r:[r],error:null}).then(resolve);}};
  return q;
 },rpc(){calls.push("destructive RPC");}};
 await expect(developmentAssessments.handleAssessments(db,new Request("https://synthetic.invalid",{headers:{"x-teacher-key":"0000000001"}}),
  {action:"teacher_tests_bulk_clear",clear_all:true,confirm_word:"حذف جميع النتائج"})).rejects.toThrow("محمي");
 expect(calls).toEqual([]);
});
