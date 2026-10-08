// Narrow test adapter to a real local PostgreSQL socket, not a memory persistence mock.
// Does not import index.ts, Supabase client, production configuration or auth secrets.
import {spawnSync} from "node:child_process";
import {developmentScan, scan} from "../source";
import {syntheticSheet} from "../fixtures";
const cfg=JSON.parse(await Bun.stdin.text());
if(!/^\/tmp\/moallimi-synthetic-sql-[^/]+\/socket$/.test(cfg.socket)
 ||!["omr_original","omr_repaired"].includes(cfg.database)||cfg.port!==56439)throw Error("Non-QA database denied");
const env={PATH:process.env.PATH!,HOME:"/tmp",LANG:"C.UTF-8"};
let operations=0;
const quote=(x:any)=>"'"+String(x).replaceAll("'","''")+"'";
function sql(statement:string){
 operations++;
 const p=spawnSync("psql",["-X","-A","-t","-v","ON_ERROR_STOP=1","-h",cfg.socket,
   "-p",String(cfg.port),"-U","postgres","-d",cfg.database],
   {input:statement,encoding:"utf8",env,timeout:20000,maxBuffer:4_000_000});
 if(p.status!==0)throw Error(p.stderr||"Local SQL command failed");
 return p.stdout.trim();
}
function encoded(x:any):string{
 if(x===null)return "NULL";
 if(typeof x==="boolean")return x?"true":"false";
 if(typeof x==="number"&&Number.isFinite(x))return String(x);
 if(typeof x==="object")return quote(JSON.stringify(x))+"::jsonb";
 return quote(x);
}
const tables=new Set(["nafes_paper_reviews","nafes_scan_sessions","nafes_scan_sheets"]);
class Query{
 cols="*"; conditions:string[]=[]; values:any=null; one=false;
 constructor(public table:string){if(!tables.has(table))throw Error("Unexpected table in local bridge");}
 select(cols="*"){if(!/^[a-z_,*]+$/.test(cols))throw Error("Unexpected projection");this.cols=cols;return this;}
 eq(k:string,v:any){if(!/^[a-z_]+$/.test(k))throw Error("Unexpected column");this.conditions.push(`"${k}"=${encoded(v)}`);return this;}
 update(v:any){this.values=v;return this;}
 maybeSingle(){this.one=true;return this;}
 then(resolve:any,reject:any){return Promise.resolve().then(()=>this.execute()).then(resolve,reject);}
 execute(){
  try{
   const where=this.conditions.length?" WHERE "+this.conditions.join(" AND "):"";
   let query:string;
   if(this.values){
    const pairs=Object.entries(this.values).map(([k,v])=>{
      if(!/^[a-z_]+$/.test(k))throw Error("Unexpected update column");
      return `"${k}"=${encoded(v)}`;
    });
    query=`WITH rows AS (UPDATE public.${this.table} SET ${pairs.join(",")}${where} RETURNING ${this.cols}) `
     +"SELECT coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) FROM rows;";
   }else query=`SELECT coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) FROM (SELECT ${this.cols} FROM public.${this.table}${where}) rows;`;
   const data=JSON.parse(sql(query));
   if(this.one&&data.length>1)throw Error("Unexpected multiple local rows");
   return {data:this.one?(data[0]??null):data,error:null};
  }catch(e:any){return {data:null,error:{message:e.message}};}
 }
}
const get=()=>JSON.parse(sql(`SELECT to_jsonb(s)-'image_data' FROM public.nafes_scan_sheets s WHERE id=${quote(cfg.sheet_id)}`));
const before=get();
// Only synthetic image; no uploaded real papers are used in this test.
sql(`UPDATE public.nafes_scan_sheets SET image_data=${quote(syntheticSheet({marks:[{row:0,option:2}]}))} WHERE id=${quote(cfg.sheet_id)}`);
const db={from:(table:string)=>new Query(table)};
const engine=cfg.source==="repaired"?developmentScan:scan;
let error:string|null=null,result:any=null;
try{
 result=await engine.handlePaperScan(db,{action:"teacher_scan_reprocess_server",review_id:"test-review",
   session_id:cfg.session_id,sheet_id:cfg.sheet_id,answer_version:before.answer_version},
   {id:cfg.owner_id,subject_scope:"all"});
}catch(e:any){error=e.message;}
const after=get();
const snapshot=(x:any)=>x.effective_snapshot||x.snapshot;
console.log(JSON.stringify({
 error,proposal_only:result?.proposal_only===true,sql_operations:operations,
 answers_preserved:JSON.stringify(snapshot(before).answers)===JSON.stringify(snapshot(after).answers),
 version_preserved:before.answer_version===after.answer_version,
 selected_before:snapshot(before).answers[0].selected,selected_after:snapshot(after).answers[0].selected,
 audit_rows:Number(sql("SELECT count(*) FROM public.nafes_scan_answer_edits")),
}));
