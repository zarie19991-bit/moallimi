import {spawnSync} from "node:child_process";
export function localDatabase(cfg:any){
 if(!/^\/tmp\/moallimi-synthetic-sql-[^/]+\/socket$/.test(cfg.socket)||!["omr_repaired","omr_original"].includes(cfg.database))throw Error("Non-QA DB denied");
 const env={PATH:process.env.PATH!,HOME:"/tmp",LANG:"C.UTF-8"};
 const quote=(v:any)=>"'"+String(v).replaceAll("'","''")+"'";
 const encode=(v:any):string=>v===null?"NULL":typeof v==="number"?String(v):typeof v==="boolean"?String(v):typeof v==="object"?quote(JSON.stringify(v))+"::jsonb":quote(v);
 const ident=(v:string)=>{if(!/^[a-z_]+$/.test(v))throw Error("Invalid identifier");return '"'+v+'"';};
 function sql(text:string,role?:string){
  if(role&&role!=="service_role")throw Error("Unexpected QA role");
  const p=spawnSync("psql",["-X","-q","-A","-t","-v","ON_ERROR_STOP=1","-h",cfg.socket,"-p","56439","-U","postgres","-d",cfg.database],
   {env,input:role?`BEGIN;SET LOCAL ROLE service_role;${text};COMMIT;`:text,encoding:"utf8",timeout:25000,maxBuffer:8_000_000});
  if(p.status!==0)throw Error(p.stderr);
  return p.stdout.trim();
 }
 const tables=new Set(["nafes_teacher_access","nafes_paper_reviews","nafes_scan_sessions","nafes_scan_sheets","nafes_scan_answer_edits","nafes_scan_identity_edits","nafes_scan_alerts"]);
 class Query{
  cols="*";where:string[]=[];values:any=null;one=false;sort="";pagination="";
  constructor(public table:string){if(!tables.has(table))throw Error("Original downstream SQL definitions unavailable");}
  select(c="*"){if(!/^[a-z_,*]+$/.test(c))throw Error("Invalid projection");this.cols=c;return this;}
  eq(k:string,v:any){this.where.push(ident(k)+"="+encode(v));return this;}
  update(v:any){this.values=v;return this;}
  order(k:string,o:any={}){this.sort=` ORDER BY ${ident(k)} ${o.ascending===false?"DESC":"ASC"}`;return this;}
  limit(n:number){if(!Number.isInteger(n)||n<1||n>400)throw Error("Limit invalid");this.pagination=" LIMIT "+n;return this;}
  range(a:number,b:number){if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<a)throw Error("Range invalid");this.pagination=` LIMIT ${b-a+1} OFFSET ${a}`;return this;}
  single(){this.one=true;return this;}
  maybeSingle(){this.one=true;return this;}
  then(resolve:any,reject:any){return Promise.resolve().then(()=>this.exec()).then(resolve,reject);}
  exec(){
   try{
    const where=this.where.length?" WHERE "+this.where.join(" AND "):"";
    let text;
    if(this.values)text=`WITH rows AS (UPDATE public.${ident(this.table)} SET ${Object.entries(this.values).map(([k,v])=>ident(k)+"="+encode(v)).join(",")}${where} RETURNING ${this.cols}) SELECT coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) FROM rows`;
    else text=`SELECT coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) FROM (SELECT ${this.cols} FROM public.${ident(this.table)}${where}${this.sort}${this.pagination}) rows`;
    const rows=JSON.parse(sql(text,this.table==="nafes_teacher_access"?cfg.auth_role:cfg.read_role));if(this.one&&rows.length>1)throw Error("Multiple rows");
    return {data:this.one?(rows[0]??null):rows,error:null};
   }catch(e:any){return {data:null,error:{message:e.message}};}
  }
 }
 const funcs=new Set(["nafes_scan_register","nafes_scan_edit_answer","nafes_scan_assign_identity","nafes_scan_verify_current","nafes_scan_finish",
 "nafes_scan_publish_attempts","nafes_scan_delete_corrections","nafes_scan_actor_context"]);
 return{
  sql,
  from:(t:string)=>new Query(t),
  rpc:async(name:string,args:any)=>{
   try{
    if(!funcs.has(name))throw Error("Unexpected RPC");
    const values=Object.entries(args).map(([k,v]:any)=>{
     const value=k==="p_marked"?"ARRAY["+v.map(encode).join(",")+"]::integer[]":
      k==="p_sheet_ids"?"ARRAY["+v.map(encode).join(",")+"]::uuid[]":encode(v);
     return ident(k)+"=>"+value;
    });
    return {data:JSON.parse(sql(`SELECT public.${ident(name)}(${values.join(",")});`,cfg.rpc_role)),error:null};
   }catch(e:any){return{data:null,error:{message:e.message}};}
  },
 };
}
