type Row=Record<string,any>;
const TYPES=new Set(['entry','pulse','hidden','visible','page_leave','offline','online','server_error','request_failed','client_error','submit_intent','result','section']);
export function cleanTimingEvents(body:Row,a:Row,source:string,trusted=false){
 const sections=source==='exam'?[{subject:a.subject_key}]:a.rendered_sections||[];
 return (Array.isArray(body.timing_events)?body.timing_events:[]).slice(0,10).filter((e:Row)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id)&&(TYPES.has(e.type)||(trusted&&e.type==='previous_result'))&&Number.isInteger(e.section)&&e.section>=0&&e.section<sections.length).map((e:Row)=>({id:e.id,attempt_id:a.id,source,event_type:e.type,section:e.section,subject:sections[e.section].subject,occurred_at:Number.isFinite(Date.parse(e.at))?new Date(Math.max(Date.parse(a.started_at),Math.min(Date.now(),Date.parse(e.at)))).toISOString():new Date().toISOString(),visible_ms:Math.round(Math.min(45000,Math.max(0,Number(e.visible_ms)||0))),status_code:Number.isInteger(e.status)&&e.status>=400&&e.status<=599?e.status:null}));
}
export async function recordTiming(db:any,a:Row,body:Row,source:string,trusted=false){
 const rows=cleanTimingEvents(body,a,source,trusted);
 if(!rows.length)return {ok:true};
 const r=await db.from('nafes_attempt_activity').upsert(rows,{onConflict:'id',ignoreDuplicates:true});if(r.error)throw r.error;
 return {ok:true};
}
export async function readTiming(db:any,source:string,ids:string[]){
 const rows:Row[]=[];
 for(let offset=0;offset<20000;offset+=1000){const r=await db.from('nafes_attempt_activity').select('id,attempt_id,event_type,section,subject,occurred_at,received_at,visible_ms,status_code').eq('source',source).in('attempt_id',ids).order('received_at').order('id').range(offset,offset+999);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<1000)return rows;}
 throw new Error('حجم السجل كبير؛ اعرض مجموعة أصغر من المحاولات.');
}
