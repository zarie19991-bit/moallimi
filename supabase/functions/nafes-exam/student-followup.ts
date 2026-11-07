import { FRAMEWORK } from './framework.ts';
type Row = Record<string,any>;
const tables:Row={exam:'nafes_exam_attempts',assessment:'nafes_assessment_attempts',simulation:'nafes_simulation_attempts'};
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
function unwrap(r:any){if(r.error)throw r.error;return r.data;}
const uuid=(s:any)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function text(v:any,n=1000){return String(v??'').trim().slice(0,n);}
function date(v:any){const s=text(v,10),d=new Date(s);if(s&&(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s))fail('التاريخ غير صالح.');return s;}
export function cleanPlan(raw:Row,subject:string){
 if(!raw||JSON.stringify(raw).length>80000)fail('حجم الخطة أكبر من المسموح.');
 const keys=new Set(FRAMEWORK.filter(i=>i.subject===subject).map(i=>i.key));
 if(!Array.isArray(raw.tasks)||raw.tasks.length>12||!Array.isArray(raw.notes)||raw.notes.length>100)fail('تجاوزت الخطة الحد المسموح.');
 const tasks=raw.tasks.map((t:Row)=>{if(!keys.has(t.indicator_key))fail('المؤشر لا يتبع المادة.');if(!['planned','training','trained','remeasured'].includes(t.status))fail('حالة المهمة غير صالحة.');return{id:text(t.id,80),indicator_key:t.indicator_key,activity:text(t.activity),responsible:text(t.responsible,120),due:date(t.due),retest:date(t.retest),status:t.status};});
 const notes=raw.notes.map((n:Row)=>({id:text(n.id,80),date:date(n.date),recipient:text(n.recipient,100),text:text(n.text,2000)}));
 const reviews:Row={};if(Object.keys(raw.reviews||{}).length>500)fail('عدد مراجعات المحاولات أكبر من المسموح.');
 for(const [key,v] of Object.entries(raw.reviews||{}) as [string,Row][]){const [source,id]=key.split(':');if(!tables[source]||!uuid(id)||!['unverified','independent','practice','excluded'].includes(v.mode))fail('مراجعة المحاولة غير صالحة.');reviews[key]={mode:v.mode,reason:text(v.reason,500)};}
 return {tasks,notes,reviews};
}
export async function handleFollowup(db:any,b:Row,owner:Row,helpers:Row):Promise<Row>{
 const scope=owner.subject_scope||'all',allowed=(s:string)=>scope==='all'||scope===s;
 if(b.action==='teacher_followup_roster'){
  const offset=Math.max(0,Math.trunc(Number(b.cursor)||0));
  const students=unwrap(await db.from('nafes_students').select('id,full_name,class_name,is_active').eq('is_demo',false).order('id').range(offset,offset+199));
  let q=db.from('nafes_student_followup').select('student_id,subject,payload,version,updated_at').in('student_id',students.map((s:Row)=>s.id));if(scope!=='all')q=q.eq('subject',scope);
  const plans=students.length?unwrap(await q):[];
  return{students,plans:plans.map((p:Row)=>({...p,payload:{tasks:p.payload.tasks}})),next_cursor:students.length===200?offset+200:null,scope};
 }
 if(!uuid(b.student_id))fail('اختر طالبًا صحيحًا.');
 const student=unwrap(await db.from('nafes_students').select('id,full_name,class_name,is_active').eq('id',b.student_id).eq('is_demo',false).maybeSingle());if(!student)fail('الطالب غير موجود.',404);
 if(b.action==='teacher_followup_student'){
  const source=b.source||'assessment';if(!tables[source])fail('مصدر الاختبار غير صالح.');
  const offset=Math.max(0,Math.trunc(Number(b.cursor)||0));
  const rows=unwrap(await db.from(tables[source]).select('*').or(`student_id.eq.${student.id},student_key.eq.${student.id}`).eq('is_demo',false).order('started_at',{ascending:false}).order('id').range(offset,offset+49));
  const map=await helpers.metadata(db,rows,source);const testIds=[...new Set(rows.map((a:Row)=>a.assessment_id).filter(Boolean))];
  const tests=source==='assessment'&&testIds.length?unwrap(await db.from('nafes_assessments').select('id,title').in('id',testIds)):[];
  let attempts=rows.map((a:Row)=>helpers.canonical(a,source,map,tests.find((t:Row)=>t.id===a.assessment_id)));
  attempts=attempts.map((a:Row)=>{const questions=a.questions.filter((q:Row)=>allowed(q.subject));if(!questions.length)return null;const scoped=scope==='all'?a:helpers.scopedAttempt({...a,source:'assessment'},owner);if(!scoped)return null;return{...scoped,source:a.source,events:undefined,student_key:undefined,questions:questions.map((q:Row)=>({...q,options:undefined,correct_index:undefined}))};}).filter(Boolean);
  let q=db.from('nafes_student_followup').select('*').eq('student_id',student.id);if(scope!=='all')q=q.eq('subject',scope);
  return {student,attempts,next_cursor:rows.length===50?offset+50:null,plans:unwrap(await q),indicators:FRAMEWORK.filter(i=>allowed(i.subject))};
 }
 if(b.action==='teacher_followup_save'){
  if(!['reading','math','science'].includes(b.subject)||!allowed(b.subject))fail('لا تملك صلاحية تعديل هذه المادة.',403);
  const payload=cleanPlan(b.payload,b.subject);
  for(const source of Object.keys(tables)){
   const ids=Object.keys(payload.reviews).filter(k=>k.startsWith(source+':')).map(k=>k.split(':')[1]);if(!ids.length)continue;
   const owned=unwrap(await db.from(tables[source]).select('id').in('id',ids).or(`student_id.eq.${student.id},student_key.eq.${student.id}`).eq('is_demo',false));if(owned.length!==ids.length)fail('تتضمن المراجعة محاولة لا تخص الطالب.',403);
  }
  const version=Number(b.version);if(!Number.isSafeInteger(version)||version<0)fail('إصدار الخطة غير صالح.');
  const row={student_id:student.id,subject:b.subject,payload,version:version+1,updated_by:owner.id,updated_at:new Date().toISOString()};
  const r=version===0?await db.from('nafes_student_followup').insert(row).select().single():await db.from('nafes_student_followup').update(row).eq('student_id',student.id).eq('subject',b.subject).eq('version',version).select().maybeSingle();
  if(r.error?.code==='23505'||!r.error&&!r.data)fail('عدّل مستخدم آخر الخطة. أعد فتح الملف قبل الحفظ.',409);return{plan:unwrap(r)};
 }
 fail('إجراء المتابعة غير معروف.');
}
