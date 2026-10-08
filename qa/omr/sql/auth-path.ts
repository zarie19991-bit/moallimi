// Real teacher authenticator -> real Edge dispatcher -> native PostgreSQL, no Supabase network.
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {localDatabase} from "./local-db";
import {developmentAssessments,originalAssessments} from "../source";
const cfg=JSON.parse(readFileSync(process.argv[2],"utf8"));
const db=localDatabase({...cfg,auth_role:"service_role",rpc_role:cfg.original?undefined:"service_role",
 read_role:cfg.original?undefined:"service_role"});
const engine=cfg.original?originalAssessments:developmentAssessments;
const q=(s:string)=>"'"+s.replaceAll("'","''")+"'";
const actors=[
 {id:cfg.owner,key:"0000000001",scope:"all",active:true},
 {id:"55555555-5555-4555-8555-555555555555",key:"0000000002",scope:"math",active:true},
 {id:"66666666-6666-4666-8666-666666666666",key:"0000000003",scope:"science",active:true},
 {id:"77777777-7777-4777-8777-777777777777",key:"0000000004",scope:"all",active:false},
 {id:"88888888-8888-4888-8888-888888888888",key:"0000000005",scope:"all",active:true},
];
for(const a of actors)db.sql(`INSERT INTO public.nafes_teacher_access(id,key_hash,label,subject_scope,active)
 VALUES(${q(a.id)},${q(createHash("sha256").update(a.key).digest("hex"))},'synthetic auth fixture',${q(a.scope)},${a.active})
 ON CONFLICT(id) DO UPDATE SET key_hash=excluded.key_hash,subject_scope=excluded.subject_scope,active=excluded.active`);
const get=()=>JSON.parse(db.sql(`SELECT to_jsonb(s)-'image_data' FROM public.nafes_scan_sheets s WHERE id=${q(cfg.sheet)}`));
const initial=get(),initialFull=JSON.parse(db.sql(`SELECT to_jsonb(s) FROM public.nafes_scan_sheets s WHERE id=${q(cfg.sheet)}`)),cases:any[]=[];
function reset(owner=cfg.owner,reviewer=cfg.owner,subjects=["math"]){
 db.sql(`BEGIN;TRUNCATE public.nafes_scan_answer_edits,public.nafes_scan_identity_edits,public.nafes_scan_alerts,public.nafes_scan_sheets;
 UPDATE public.nafes_scan_sessions SET completed_at=NULL,reviewer_id=${q(reviewer)} WHERE id=${q(cfg.session)};
 UPDATE public.nafes_paper_reviews SET owner_id=${q(owner)},subject='math',subjects=${q("{"+subjects.join(",")+"}")}::text[] WHERE id=${q(initial.review_pk)};
 INSERT INTO public.nafes_scan_sheets SELECT * FROM jsonb_populate_record(NULL::public.nafes_scan_sheets,${q(JSON.stringify(initialFull))}::jsonb);COMMIT`);
}
async function request(key:string,body:any,database:any=db){
 const req=new Request("https://synthetic.invalid",{headers:{"x-teacher-key":key}});
 return await engine.handleAssessments(database,req,{review_id:"test-review",session_id:cfg.session,sheet_id:cfg.sheet,answer_version:0,...body});
}
const edit={action:"teacher_scan_edit_answer",question:1,marked:[0],request_id:"99999999-9999-4999-8999-999999999999",reason:"synthetic manual image confirmation"};
async function test(name:string,fn:()=>Promise<void>){
 try{await fn();cases.push({name,passed:true});}catch(e:any){cases.push({name,passed:false,error:e.message});}
}
async function denied(key:string,body:any,roleSetup?:()=>void){
 reset();roleSetup?.();const before=get();let rejected=false;
 try{await request(key,body);}catch{rejected=true;}
 if(!rejected||JSON.stringify(before)!==JSON.stringify(get()))throw Error("Denial or no-write invariant failed");
}
await test("active_main_real_auth_and_native_save",async()=>{
 reset();const result=await request(actors[0].key,edit);const after=get();
 if(result.sheet.answer_version!==1||(after.effective_snapshot||after.snapshot).answers[0].selected!==0)throw Error("Save not persisted");
 const audit=JSON.parse(db.sql(`SELECT to_jsonb(e) FROM public.nafes_scan_answer_edits e WHERE sheet_id=${q(cfg.sheet)}`));
 if(audit.after_answer.manual_reason!==edit.reason)throw Error("Reason absent from native audit");
});
await test("active_subject_teacher_own_session_native_save",async()=>{
 reset(actors[1].id,actors[1].id);const r=await request(actors[1].key,edit);
 if(r.sheet.answer_version!==1)throw Error("Scoped save failed");
});
await test("missing_key_no_write",()=>denied("",edit));
await test("unknown_key_no_write",()=>denied("0000000999",edit));
await test("inactive_key_no_write",()=>denied(actors[3].key,edit));
await test("wrong_subject_no_write",()=>denied(actors[2].key,edit));
await test("other_main_cannot_modify_assigned_reviewer_session",()=>denied(actors[4].key,edit));
await test("no_reason_cannot_promote_ambiguous",()=>denied(actors[0].key,{...edit,reason:""}));
await test("subject_teacher_cannot_use_admin_rollback",()=>denied(actors[1].key,
 {action:"teacher_scan_delete",confirm:true,sheet_ids:[cfg.sheet],request_id:edit.request_id,reason:"synthetic admin test"},
 ()=>reset(actors[1].id,actors[1].id)));
await test("malformed_scope_cannot_be_promoted_to_all",async()=>{
 reset();const before=get();
 // Simulate a malformed teacher DTO; do NOT invent an invalid production SQL row.
 const malformed={...db,from:(table:string)=>{
  const query=db.from(table);
  if(table!=="nafes_teacher_access")return query;
  const proxy:any=new Proxy(query,{get(target,prop:any){
   if(prop==="then")return (resolve:any,reject:any)=>target.then((r:any)=>resolve({...r,data:r.data?{...r.data,subject_scope:"unknown"}:null}),reject);
   const v=(target as any)[prop];return typeof v==="function"?(...args:any[])=>{const result=v.apply(target,args);return result===target?proxy:result;}:v;
  }});
  return proxy;
 }};
 let rejected=false;try{await request(actors[0].key,{action:"teacher_scan_list"},malformed);}catch{rejected=true;}
 if(!rejected||JSON.stringify(before)!==JSON.stringify(get()))throw Error("Unknown scope expanded authority");
});
if(!cfg.original){
 await test("main_admin_authorization_across_owner_without_delete",async()=>{
  reset(actors[1].id,actors[1].id);
  const r=await db.rpc("nafes_scan_actor_context",{p_session:cfg.session,p_actor:cfg.owner,p_admin:true});
  if(r.error||r.data.review_owner_id!==actors[1].id||r.data.admin!==true)throw Error(r.error?.message||"Admin gate failed");
 });
 await test("main_reviewer_can_publish_for_original_review_owner_authorization_only",async()=>{
  reset(actors[1].id,cfg.owner);
  const r=await db.rpc("nafes_scan_actor_context",{p_session:cfg.session,p_actor:cfg.owner,p_admin:false});
  if(r.error||r.data.review_owner_id!==actors[1].id)throw Error("Review owner lost at authorization gate");
 });
}
console.log(JSON.stringify({cases,synthetic_only:true,teacher_lookup_role:"service_role",rpc_role:cfg.original?"postgres":"service_role",
 scan_selects_role:cfg.original?"postgres":"service_role",original_scan_acl_not_supplied:true,
 development_service_acl_explicit:!cfg.original,publication_positive_tested:false,rollback_positive_tested:false}));
