// Auth is performed by handleAssessments before invoking this module.
import { fail, hash } from './assessment-engine.ts';
type Row=Record<string,any>;
const must=(r:any)=>{if(r.error)fail(r.error.message,400);return r.data;};
const uuid=(v:any)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v));
const publicSession=(s:Row)=>{const {review_snapshot,...out}=s;return out;};
const summaryColumns='id,session_id,ordinal,student_id,sheet_no,snapshot,effective_snapshot,answer_version,duplicate_of,duplicate_legacy_at,blocked_duplicate,uploaded_at,reviewed_at,reviewed_by,disposition';
export function classifyAnswer(raw:Row,key:Row,index:number){
 const status=String(raw?.status||'ambiguous');
 const selected=Number.isInteger(raw?.selected)&&raw.selected>=0&&raw.selected<4?raw.selected:null;
 const correctIndex=Number.isInteger(key?.correct_index)&&key.correct_index>=0&&key.correct_index<4?key.correct_index:null;
 const marked=Array.isArray(raw?.marked)?[...new Set(raw.marked.filter((x:any)=>Number.isInteger(x)&&x>=0&&x<4))]:selected===null?[]:[selected];
 const state=status==='multiple'||marked.length>1?'multiple':status==='blank'?'blank':status!=='clear'||selected===null||correctIndex===null?'uncertain':selected===correctIndex?'correct':'incorrect';
 return {question:index+1,selected,marked,status,state,correct_index:correctIndex,correct:state==='correct',indicator:String(key?.indicator||''),confidence:Math.max(0,Math.min(1,Number(raw?.confidence)||0))};
}
async function reviewFor(db:any,b:Row,owner:Row){
 let q=db.from('nafes_paper_reviews').select('*').eq('review_id',String(b.review_id||''));
 if(owner.subject_scope!=='all')q=q.eq('owner_id',owner.id);
 const r=must(await q.maybeSingle());if(!r)fail('الاختبار غير موجود أو غير مصرح به.',404);
 if(owner.subject_scope!=='all'&&(r.subjects||[r.subject]).some((s:string)=>s!==owner.subject_scope))fail('غير مصرح.',403);
 return r;
}
export async function scanSession(db:any,b:Row,owner:Row){
 const review=await reviewFor(db,b,owner);
 const session=must(await db.from('nafes_scan_sessions').select('*').eq('id',b.session_id).eq('review_pk',review.id).maybeSingle());
 if(!session)fail('جلسة المراجعة غير موجودة.',404);
 return {review,session};
}
export async function handlePaperScan(db:any,b:Row,owner:Row){
 const review=await reviewFor(db,b,owner);
 if(b.action==='teacher_scan_start'){
   if(!uuid(b.session_id)||!/^([a-f0-9]{64})$/.test(b.file_hash)||!Number.isInteger(b.expected_count)||b.expected_count<1||b.expected_count>300)fail('بيانات رفع غير صالحة.');
   const old=must(await db.from('nafes_scan_sessions').select('*').eq('id',b.session_id).maybeSingle());
   if(old){if(old.review_pk!==review.id||old.file_hash!==b.file_hash||old.expected_count!==b.expected_count)fail('تعارض جلسة الرفع.',409);return {ok:true,session:publicSession(old)};}
   return {ok:true,session:must(await db.from('nafes_scan_sessions').insert({id:b.session_id,review_pk:review.id,reviewer_id:owner.id,file_hash:b.file_hash,expected_count:b.expected_count,review_snapshot:review.payload}).select('id,review_pk,reviewer_id,file_hash,expected_count,created_at,completed_at').single())};
 }
 if(b.action==='teacher_scan_sessions')return {ok:true,sessions:must(await db.from('nafes_scan_sessions').select('id,review_pk,reviewer_id,file_hash,expected_count,created_at,completed_at').eq('review_pk',review.id).order('created_at',{ascending:false}).limit(100))};
 if(b.action==='teacher_scan_alerts'){
   const after=Number(b.cursor||0);if(!Number.isInteger(after)||after<0)fail('مؤشر غير صالح.');
   const alerts=must(await db.from('nafes_scan_alerts').select('*,sheet:nafes_scan_sheets!sheet_id(student_id,snapshot,uploaded_at),original:nafes_scan_sheets!original_sheet_id(uploaded_at,session_id)').eq('review_pk',review.id).order('created_at',{ascending:false}).order('id').range(after,after+199));
   return {ok:true,alerts,next_cursor:alerts.length===200?after+200:null};
 }
 const {session}=await scanSession(db,b,owner);
 if(b.action==='teacher_scan_list')return {ok:true,session:publicSession(session),sheets:must(await db.from('nafes_scan_sheets').select(summaryColumns).eq('session_id',session.id).order('ordinal'))};
 if(b.action==='teacher_scan_register'){
   const raw=b.sheet||{},p=session.review_snapshot;
   if(!Number.isInteger(raw.ordinal)||raw.ordinal<1||raw.ordinal>session.expected_count)fail('رقم الورقة غير صالح.');
   if(typeof raw.image_data!=='string'||raw.image_data.length>2000000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(raw.image_data))fail('صورة الورقة غير صالحة أو كبيرة جدًا.');
   const assignment=(p.assignments||[]).find((a:Row)=>Number(a.sheet_no)===raw.sheet_no);
   const valid=!!assignment&&uuid(assignment.student_id)&&raw.qr_valid===true&&raw.model===assignment.model;
   const model=valid?assignment.model:String(raw.model||'').slice(0,12);
   const key=(p.answer_keys||[]).find((k:Row)=>k.model===model)?.answers||[];
   const rawAnswers=Array.isArray(raw.answers)?raw.answers:[];
   const answers=Array.from({length:p.question_count},(_,i)=>classifyAnswer(rawAnswers[i]||{},valid?(key[i]||{}):{},i));
   const identityValid=valid&&key.length===p.question_count;
   const snapshot={student_name:identityValid?assignment.student_name:'غير معروف — يلزم إعادة المسح',model,identity_valid:identityValid,markers_ok:raw.markers_ok===true&&rawAnswers.length===p.question_count,answers,score:answers.filter(a=>a.correct).length,total:p.question_count,
   counts:answers.reduce((m:Row,a:Row)=>(m[a.state]=(m[a.state]||0)+1,m),{blank:0,multiple:0,correct:0,incorrect:0,uncertain:0}),page_no:Number(raw.page_no)||1,region_no:Number(raw.region_no)||1};
   const legacy=identityValid?must(await db.from('nafes_assessment_attempts').select('submitted_at,events').eq('student_id',assignment.student_id).contains('config',{paper_review_id:review.review_id}).not('submitted_at','is',null).order('submitted_at').limit(20)):[];
   const legacyAt=(legacy||[]).find((x:Row)=>x.events?.some((e:Row)=>e.type==='paper_scan'&&e.review_id===review.review_id&&!e.scan_sheet_id))?.submitted_at||null;
   const sheet=must(await db.rpc('nafes_scan_register',{p_session:session.id,p_sheet:{ordinal:raw.ordinal,legacy_at:legacyAt,student_id:identityValid?assignment.student_id:null,sheet_no:identityValid?raw.sheet_no:null,image_hash:await hash(raw.image_data),image_data:raw.image_data,snapshot}}));
   return {ok:true,sheet};
 }
 if(b.action==='teacher_scan_image'){
   const row=must(await db.from('nafes_scan_sheets').select('image_data').eq('session_id',session.id).eq('id',b.sheet_id).single());return {ok:true,...row};
 }
 if(b.action==='teacher_scan_edit_answer'){
   if(!uuid(b.request_id)||!uuid(b.sheet_id)||!Number.isInteger(b.question)||!Number.isInteger(b.answer_version)||!Array.isArray(b.marked)||b.marked.length>4||b.marked.some((n:any)=>!Number.isInteger(n)||n<0||n>3))fail('بيانات تعديل الإجابة غير صالحة.');
   return {ok:true,sheet:must(await db.rpc('nafes_scan_edit_answer',{p_session:session.id,p_sheet:b.sheet_id,p_reviewer:owner.id,p_question:b.question,p_marked:b.marked,p_version:b.answer_version,p_request:b.request_id}))};
 }
 if(b.action==='teacher_scan_edit_history'){
   const found=must(await db.from('nafes_scan_sheets').select('id').eq('session_id',session.id).eq('id',b.sheet_id).maybeSingle());if(!found)fail('ورقة غير موجودة.',404);
   const cursor=Number(b.cursor||0);if(!Number.isInteger(cursor)||cursor<0)fail('مؤشر غير صالح.');
   const edits=must(await db.from('nafes_scan_answer_edits').select('*').eq('sheet_id',b.sheet_id).order('answer_version',{ascending:false}).range(cursor,cursor+199));
   return {ok:true,edits,next_cursor:edits.length===200?cursor+200:null};
 }
 if(b.action==='teacher_scan_verify')return {ok:true,sheet:must(await db.rpc('nafes_scan_verify_current',{p_session:session.id,p_sheet:b.sheet_id,p_reviewer:owner.id,p_ack:b.acknowledge_duplicate===true,p_version:b.answer_version}))};
 if(b.action==='teacher_scan_finish')return {ok:true,session:publicSession(must(await db.rpc('nafes_scan_finish',{p_session:session.id})))};
 fail('إجراء مراجعة غير معروف.');
}
export async function reviewedScanPayload(db:any,b:Row,owner:Row){
 if(!uuid(b.session_id))fail('أكمل جلسة مراجعة الأوراق قبل اعتماد النتائج.',409);
 const {review,session}=await scanSession(db,b,owner);
 if(!session.completed_at)fail('اضغط «تم المراجعة» قبل اعتماد النتائج.',409);
 const sheets=must(await db.from('nafes_scan_sheets').select(summaryColumns).eq('session_id',session.id).eq('disposition','verified').eq('blocked_duplicate',false).order('ordinal'));
 if(!sheets.length)fail('لا توجد أوراق قابلة للاعتماد؛ راجع تنبيهات التكرار وإعادة المسح.',409);
 return {...session.review_snapshot,review_owner_id:review.owner_id,session_id:session.id,results:sheets.map((s:Row)=>{const x=s.effective_snapshot||s.snapshot;return {student_id:s.student_id,student_name:x.student_name,model:x.model,sheet_id:s.id,answers:x.answers,omr:{answer_count:x.total,manual_answers:x.answers.filter((a:Row)=>a.reviewed_manually).length}};})};
}
