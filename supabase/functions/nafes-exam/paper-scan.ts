import { canCreditOriginalCorrect, confirmedMultiple } from "./omr-multiple-review.ts";
// Auth is performed by handleAssessments before invoking this module.
import { fail, hash } from './assessment-engine.ts';
import { readOmrJpeg } from './omr-server.ts';
import { proposeVisionReading } from './omr-vision-assist.ts';
type Row=Record<string,any>;
const must=(r:any)=>{if(r.error)fail(r.error.message,400);return r.data;};
const uuid=(v:any)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(v));
const publicSession=(s:Row)=>{const {review_snapshot,...out}=s;return out;};
const summaryColumns='id,session_id,ordinal,student_id,sheet_no,snapshot,effective_snapshot,answer_version,duplicate_of,duplicate_legacy_at,blocked_duplicate,uploaded_at,reviewed_at,reviewed_by,disposition';
const OMR_POLICY='server_jpeg_homography_dev_grid';
const finite=(v:any,min:number,max:number,def=0)=>{const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):def;};
const compactImageQuality=(q:any)=>q&&typeof q==='object'?{
 width:Math.max(0,Math.min(10000,Number(q.width)||0)),height:Math.max(0,Math.min(10000,Number(q.height)||0)),
 mean:finite(q.mean,0,255),dynamic_range:finite(q.dynamic_range,0,255),illumination_range:finite(q.illumination_range,0,255),
 sharpness:finite(q.sharpness,0,100000),shadow_ratio:finite(q.shadow_ratio,0,1),glare_ratio:finite(q.glare_ratio,0,1)
}:null;
const compactVerification=(v:any)=>v&&typeof v==='object'?{
 risk:['low','medium','high'].includes(String(v.risk))?String(v.risk):'high',quality_score:finite(v.quality_score,0,100),
 reasons:Array.isArray(v.reasons)?v.reasons.slice(0,12).map((x:any)=>String(x).slice(0,160)):[],
 requires_manual_review:v.requires_manual_review===true,auto_accept:v.auto_accept===true,
 counts:v.counts&&typeof v.counts==='object'?{
   ambiguous:Math.max(0,Number(v.counts.ambiguous)||0),multiple:Math.max(0,Number(v.counts.multiple)||0),
   blank:Math.max(0,Number(v.counts.blank)||0),low_margin:Math.max(0,Number(v.counts.low_margin)||0),clear:Math.max(0,Number(v.counts.clear)||0)
 }:null
}:null;
const compactCalibration=(c:any)=>c&&typeof c==='object'?{
 baseline:finite(c.baseline,-1,1),mad:finite(c.mad,0,1),possible:finite(c.possible,-1,1),definite:finite(c.definite,-1,1),separation:finite(c.separation,0,1)
}:null;

const validOption=(v:any)=>Number.isInteger(v)&&v>=0&&v<4;
export function classifyAnswer(raw:Row,key:Row,index:number,context:Row={}){
 const rawStatus=String(raw?.status||'ambiguous');
 const selected=Number.isInteger(raw?.selected)&&raw.selected>=0&&raw.selected<4?raw.selected:null;
 const correctIndex=Number.isInteger(key?.correct_index)&&key.correct_index>=0&&key.correct_index<4?key.correct_index:null;
 const marked=Array.isArray(raw?.marked)?[...new Set(raw.marked.filter((x:any)=>Number.isInteger(x)&&x>=0&&x<4))]:selected===null?[]:[selected];
 const uncertainty={reading:[] as string[],identity:[] as string[],answer_key:[] as string[]};
 let readingStatus=rawStatus;
 if(context.reader_error===true){readingStatus='unavailable';uncertainty.reading.push('reader_failed');}
 else if(context.reading_not_run===true){readingStatus='unavailable';uncertainty.reading.push('reading_not_run');}
 else if(!['clear','blank','multiple','ambiguous'].includes(rawStatus)){
   readingStatus='invalid';uncertainty.reading.push('reading_status_unrecognized');
 }else if(raw?.selected!==null&&raw?.selected!==undefined&&!validOption(raw.selected)){
   readingStatus='invalid';uncertainty.reading.push('invalid_selected_evidence');
 }else if(raw?.marked!==null&&raw?.marked!==undefined&&!Array.isArray(raw.marked)){
   readingStatus='invalid';uncertainty.reading.push('invalid_marked_evidence');
 }else if(Array.isArray(raw?.marked)&&raw.marked.some((x:any)=>!validOption(x))){
   readingStatus='invalid';uncertainty.reading.push('invalid_marked_evidence');
 }else if(rawStatus==='ambiguous'){
   // These are candidates, not proven filled bubbles. A matching key cannot resolve them.
   uncertainty.reading.push('bubble_ambiguous');
 }else if(rawStatus==='clear'&&(selected===null||marked.length!==1||marked[0]!==selected)){
   readingStatus='invalid';uncertainty.reading.push('contradictory_clear_evidence');
 }else if(rawStatus==='blank'&&(selected!==null||marked.length!==0)){
   readingStatus='invalid';uncertainty.reading.push('contradictory_blank_evidence');
 }else if(rawStatus==='multiple'&&(marked.length<2||(selected!==null&&!marked.includes(selected)))){
   readingStatus='invalid';uncertainty.reading.push('multiple_evidence_incomplete');
 }
 if(context.markers_ok===false)uncertainty.reading.push('markers_not_verified');
 if(context.identity_valid===false)uncertainty.identity.push('identity_not_verified');
 if(correctIndex===null)uncertainty.answer_key.push('answer_key_missing_or_invalid');
 if(context.key_complete===false)uncertainty.answer_key.push('answer_key_incomplete');
 const unresolved=Object.values(uncertainty).some(x=>x.length>0);
 const status=['invalid','unavailable'].includes(readingStatus)?'ambiguous':readingStatus;
 const state=unresolved?'uncertain':readingStatus==='multiple'?'multiple':readingStatus==='blank'?'blank':selected===correctIndex?'correct':'incorrect';
 const scores=Array.isArray(raw?.scores)?raw.scores.slice(0,4).map((x:any)=>finite(x,-1,1)):null;
 const blueScores=Array.isArray(raw?.blueScores)?raw.blueScores.slice(0,4).map((x:any)=>finite(x,0,2)):null;
 const darkScores=Array.isArray(raw?.darkScores)?raw.darkScores.slice(0,4).map((x:any)=>finite(x,0,2)):null;
 const centerValues=Array.isArray(raw?.centerValues)?raw.centerValues.slice(0,4).map((x:any)=>finite(x,0,255)):null;
 // A leading candidate (or one of multiple fills) is not a single confirmed answer.
 const confirmedSelected=readingStatus==='clear'&&!uncertainty.reading.length?selected:null;
 return {question:index+1,selected:confirmedSelected,reader_selected:selected,marked,status,state,reading_status:readingStatus,raw_reader_status:rawStatus,
   candidates:readingStatus==='ambiguous'?marked:[],confirmed_marks:!uncertainty.reading.length&&['clear','multiple'].includes(readingStatus)?marked:[],
   uncertainty,requires_verification:state==='uncertain'||state==='multiple',
   correct_index:correctIndex,correct:state==='correct',indicator:String(key?.indicator||''),confidence:Math.max(0,Math.min(1,Number(raw?.confidence)||0)),
   scores,blue_scores:blueScores,dark_scores:darkScores,center_values:centerValues,reader:String(raw?.reader||'').slice(0,16),
   top_score:finite(raw?.topScore,-1,255),second_score:finite(raw?.secondScore,-1,255),separation:finite(raw?.separation,0,255),threshold:finite(raw?.threshold,-1,255)};
}
function classificationDiagnostics(answers:Row[]){
 return {
   review_pending_count:answers.filter(a=>a.review_pending===true).length,
   reading_counts:answers.reduce((m:Row,a:Row)=>(m[a.reading_status]=(m[a.reading_status]||0)+1,m),{clear:0,blank:0,multiple:0,ambiguous:0,invalid:0,unavailable:0}),
   uncertainty_counts:Object.fromEntries(['reading','identity','answer_key'].map(category=>[category,answers.filter(a=>a.uncertainty?.[category]?.length>0).length]))
 };
}
function classificationVerification(verification:any,answers:Row[]){
 const base=compactVerification(verification)||{risk:'high',quality_score:0,reasons:[],requires_manual_review:true,auto_accept:false,counts:null};
 const needsReview=answers.some(a=>a.requires_verification);
 if(!needsReview)return base;
 const reasons=[...new Set(answers.flatMap(a=>Object.values(a.uncertainty||{}).flat()) as string[])];
 if(answers.some(a=>a.review_pending===true))reasons.push('prior_uncertainty_requires_explicit_review');
 if(answers.some(a=>a.reading_status==='multiple'))reasons.push('confirmed_multiple_requires_review');
 return {...base,risk:'high',requires_manual_review:true,auto_accept:false,reasons:[...new Set([...base.reasons,...reasons])].slice(0,12)};
}
async function reprocessServerSheet(db:any,session:Row,row:Row){
 const current=row.effective_snapshot||row.snapshot||{};
 if(current?.identity_valid!==true||!row.student_id)return {row,skipped:'identity'};
 const p=session.review_snapshot||{},assignment=(p.assignments||[]).find((a:Row)=>String(a.student_id)===String(row.student_id));
 if(!assignment)return {row,error:'تعذر مطابقة الطالب مع قائمة الاختبار.'};
 const key=(p.answer_keys||[]).find((k:Row)=>k.model===assignment.model)?.answers||[];
 if(key.length!==p.question_count||key.some((k:Row)=>!validOption(k?.correct_index)))return {row,error:'مفتاح النموذج غير مكتمل.'};
 if((current.answers||[]).some((a:Row)=>a.reviewed_manually===true)||row.reviewed_at||row.reviewed_by){
   // A fresh machine reading is a proposal, never a replacement for human review.
   let proposal:Row;
   try{
     const reading=readOmrJpeg(String(row.image_data||''),Number(p.question_count||0),Number(p.question_start||1));
     const answers=Array.from({length:p.question_count},(_,i)=>classifyAnswer(reading.answers[i]||{},key[i]||{},i,
       {identity_valid:true,key_complete:true,markers_ok:reading.markers_ok===true}));
     proposal={answers,omr_policy:OMR_POLICY,applied:false,error:null};
   }catch(e:any){proposal={answers:[],omr_policy:OMR_POLICY,applied:false,error:String(e?.message||e)};}
   const updated=must(await db.from('nafes_scan_sheets').update({effective_snapshot:{...current,omr_reprocess_proposal:proposal}})
     .eq('id',row.id).eq('session_id',session.id).eq('answer_version',row.answer_version).select(summaryColumns+',image_data').maybeSingle());
   if(!updated)return {row,error:'تغيرت الورقة أثناء إعادة القراءة.'};
   return {row:updated,proposal_only:true,error:proposal.error,
     unresolved:proposal.answers.filter((a:Row)=>a.state==='uncertain'||a.state==='multiple').length};
 }
 let rr:any;
 try{rr=readOmrJpeg(String(row.image_data||''),Number(p.question_count||0),Number(p.question_start||1));}
 catch(e:any){
   const msg=String(e?.message||e);
   const failed={...current,omr_policy:OMR_POLICY+'_error',markers_ok:false,marker_confidence:0,omr_reader_error:msg,
     omr_verification:{risk:'high',quality_score:0,reasons:[msg],requires_manual_review:true,auto_accept:false,
       counts:{ambiguous:p.question_count,multiple:0,blank:0,low_margin:0,clear:0}}};
   const updated=must(await db.from('nafes_scan_sheets').update({effective_snapshot:failed,answer_version:row.answer_version+1,reviewed_at:null,reviewed_by:null,disposition:null})
     .eq('id',row.id).eq('session_id',session.id).eq('answer_version',row.answer_version).select(summaryColumns+',image_data').maybeSingle());
   return {row:updated||row,error:msg};
 }
 const answers=Array.from({length:p.question_count},(_,i)=>classifyAnswer(rr.answers[i]||{},key[i]||{},i,{identity_valid:true,key_complete:true,markers_ok:rr.markers_ok===true}));
 const uncertain=answers.filter((a:Row)=>a.state==='uncertain'||a.state==='multiple').length;
 const next={...current,student_name:assignment.student_name,model:assignment.model,identity_valid:true,
   markers_ok:rr.markers_ok===true,marker_confidence:finite(rr.marker_confidence,0,1),answers,
   score:answers.filter((a:Row)=>a.correct).length,total:p.question_count,
   counts:answers.reduce((m:Row,a:Row)=>(m[a.state]=(m[a.state]||0)+1,m),{blank:0,multiple:0,correct:0,incorrect:0,uncertain:0}),
   omr_policy:OMR_POLICY,omr_detector:String(rr.detector||'').slice(0,64),marker_points:rr.marker_points||null,
   omr_verification:classificationVerification(rr.verification,answers),omr_calibration:compactCalibration(rr.calibration),
   omr_reading_verification:compactVerification(rr.verification),
   ...classificationDiagnostics(answers),
   omr_reader_error:null,unresolved_answers:uncertain};
 const updated=must(await db.from('nafes_scan_sheets').update({effective_snapshot:next,answer_version:row.answer_version+1,reviewed_at:null,reviewed_by:null,disposition:null})
   .eq('id',row.id).eq('session_id',session.id).eq('answer_version',row.answer_version).select(summaryColumns+',image_data').maybeSingle());
 if(!updated)return {row,error:'تغيرت الورقة أثناء إعادة القراءة.'};
 return {row:updated,unresolved:uncertain};
}

async function reviewFor(db:any,b:Row,owner:Row){
 if(!['all','reading','math','science'].includes(owner.subject_scope))fail('صلاحية حساب المعلم غير صالحة.',403);
 let q=db.from('nafes_paper_reviews').select('*').eq('review_id',String(b.review_id||''));
 if(owner.subject_scope!=='all')q=q.eq('owner_id',owner.id);
 const r=must(await q.maybeSingle());if(!r)fail('الاختبار غير موجود أو غير مصرح به.',404);
 const subjects=Array.isArray(r.subjects)&&r.subjects.length?r.subjects:[r.subject];
 if(!subjects.length||subjects.some((s:string)=>!['reading','math','science'].includes(s)))fail('مواد المراجعة غير صالحة.',403);
 if(owner.subject_scope!=='all'&&subjects.some((s:string)=>s!==owner.subject_scope))fail('غير مصرح.',403);
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
   if(!uuid(b.session_id)||!/^([a-f0-9]{64})$/.test(b.file_hash)||!Number.isInteger(b.expected_count)||b.expected_count<1||b.expected_count>200)fail('بيانات رفع غير صالحة.');
   const old=must(await db.from('nafes_scan_sessions').select('*').eq('id',b.session_id).maybeSingle());
   if(old){if(old.review_pk!==review.id||old.file_hash!==b.file_hash||old.expected_count!==b.expected_count)fail('تعارض جلسة الرفع.',409);return {ok:true,session:publicSession(old)};}
   return {ok:true,session:must(await db.from('nafes_scan_sessions').insert({id:b.session_id,review_pk:review.id,reviewer_id:owner.id,file_hash:b.file_hash,expected_count:b.expected_count,review_snapshot:review.payload}).select('id,review_pk,reviewer_id,file_hash,expected_count,created_at,completed_at').single())};
 }
 if(b.action==='teacher_scan_sessions')return {ok:true,sessions:must(await db.from('nafes_scan_sessions').select('id,review_pk,reviewer_id,file_hash,expected_count,created_at,completed_at').eq('review_pk',review.id).order('created_at',{ascending:false}).limit(100))};
 if(b.action==='teacher_scan_deletion_log'){
   const rows=must(await db.from('nafes_scan_deletions').select('*').eq('review_pk',review.id).order('deleted_at',{ascending:false}).limit(200));
   return {ok:true,deletions:rows};
 }
 if(b.action==='teacher_scan_alerts'){
   const after=Number(b.cursor||0);if(!Number.isInteger(after)||after<0)fail('مؤشر غير صالح.');
   const alerts=must(await db.from('nafes_scan_alerts').select('*,sheet:nafes_scan_sheets!sheet_id(student_id,snapshot,uploaded_at),original:nafes_scan_sheets!original_sheet_id(uploaded_at,session_id)').eq('review_pk',review.id).order('created_at',{ascending:false}).order('id').range(after,after+199));
    return {ok:true,alerts,next_cursor:alerts.length===200?after+200:null,omr_auto_upgraded:0,omr_policy:OMR_POLICY};
 }
 const {session}=await scanSession(db,b,owner);
 const mutations=['teacher_scan_finalize_upload','teacher_scan_register','teacher_scan_assign_identity',
   'teacher_scan_reprocess_server','teacher_scan_reclassify','teacher_scan_edit_answer','teacher_scan_resolve_multiple','teacher_scan_verify','teacher_scan_finish'];
 if(mutations.includes(b.action)&&session.reviewer_id!==owner.id)fail('التعديل متاح لمراجع الجلسة المسجل فقط.',403);
 if(b.action==='teacher_scan_list'){
    const rows=must(await db.from('nafes_scan_sheets').select(summaryColumns).eq('session_id',session.id).order('ordinal'));
   const safe=rows.map((x:Row)=>{const {image_data,...rest}=x;return rest;});
    return {ok:true,session:publicSession(session),sheets:safe,auto_reprocessed:0,omr_policy:OMR_POLICY,
       vision_available:Deno.env.get('OMR_VISION_ASSIST_ENABLED')==='true'&&!!Deno.env.get('OPENAI_API_KEY')};
 }
 if(b.action==='teacher_scan_quality_report'){
   const rows=must(await db.from('nafes_scan_sheets').select(summaryColumns).eq('session_id',session.id).order('ordinal'));
   const items=rows.map((r:Row)=>{const x=r.effective_snapshot||r.snapshot||{},v=x.omr_verification||{};return{
     id:r.id,ordinal:r.ordinal,student_name:x.student_name||'',model:x.model||'',score:x.score||0,total:x.total||0,
     risk:v.risk||(!x.markers_ok?'high':'medium'),quality_score:Number(v.quality_score||0),reasons:Array.isArray(v.reasons)?v.reasons:[],
     markers_ok:x.markers_ok===true,marker_confidence:Number(x.marker_confidence||0),counts:x.counts||{},image_quality:x.image_quality||null,
     reviewed_at:r.reviewed_at,disposition:r.disposition
   };});
   const summary={total:items.length,low:items.filter((x:Row)=>x.risk==='low').length,medium:items.filter((x:Row)=>x.risk==='medium').length,high:items.filter((x:Row)=>x.risk==='high').length,
     markers_failed:items.filter((x:Row)=>!x.markers_ok).length,needs_manual:items.filter((x:Row)=>x.risk!=='low').length};
   return {ok:true,policy:OMR_POLICY,summary,items};
 }

 if(b.action==='teacher_scan_vision_proposal'){
   if(session.reviewer_id!==owner.id)fail('القراءة بالذكاء الاصطناعي متاحة لمراجع الجلسة فقط.',403);
   if(!uuid(b.sheet_id)||!Number.isInteger(b.answer_version))fail('بيانات الورقة غير صالحة.',400);
   const row=must(await db.from('nafes_scan_sheets').select(summaryColumns+',image_data')
     .eq('session_id',session.id).eq('id',b.sheet_id).maybeSingle());
   if(!row)fail('لم يتم العثور على الورقة.',404);
   if(row.answer_version!==b.answer_version)fail('تغيرت الورقة؛ حدّث الصفحة أولًا.',409);
   const total=Number(session.review_snapshot?.question_count);
   if(!Number.isInteger(total)||total<1||total>60)fail('عدد الأسئلة غير مدعوم.',400);
   const current=row.effective_snapshot||row.snapshot||{};
   const optical=current.markers_ok===true&&!current.omr_reader_error&&
     Array.isArray(current.answers)&&current.answers.length===total?
     current.answers.map((a:Row)=>({
       status:a.reading_status||a.status,
       marked:Array.isArray(a.confirmed_marks)&&a.confirmed_marks.length?
         a.confirmed_marks:Array.isArray(a.marked)?a.marked:[]
     })):null;
   const proposal=await proposeVisionReading(String(row.image_data||''),total,optical,String(b.vision_consent||''));
   return{ok:true,proposal,unverified:true,save_performed:false,grade_changed:false,
     sheet_id:row.id,answer_version:row.answer_version};
 }
 if(b.action==='teacher_scan_finalize_upload'){
   const actual=Number(b.actual_count);
   if(!Number.isInteger(actual)||actual<1||actual>200)fail('عدد الأوراق النهائي غير صالح.');
   const rows=must(await db.from('nafes_scan_sheets').select('id,ordinal').eq('session_id',session.id).order('ordinal'));
   if(rows.length!==actual)fail('عدد الأوراق المحفوظة لا يطابق العدد النهائي.',409);
   if(rows.some((r:Row,i:number)=>Number(r.ordinal)!==i+1))fail('ترتيب الأوراق المحفوظة غير متسلسل.',409);
   const updated=must(await db.from('nafes_scan_sessions').update({expected_count:actual,completed_at:null}).eq('id',session.id).select('*').single());
   return {ok:true,session:publicSession(updated),sheets:must(await db.from('nafes_scan_sheets').select(summaryColumns).eq('session_id',session.id).order('ordinal'))};
 }
 if(b.action==='teacher_scan_register'){
   const raw=b.sheet||{},p=session.review_snapshot;
   if(!Number.isInteger(raw.ordinal)||raw.ordinal<1||raw.ordinal>200)fail('رقم الورقة غير صالح.');
   if(raw.ordinal>session.expected_count)must(await db.from('nafes_scan_sessions').update({expected_count:raw.ordinal,completed_at:null}).eq('id',session.id).select('id').single());
   if(typeof raw.image_data!=='string'||raw.image_data.length>2000000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(raw.image_data))fail('صورة الورقة غير صالحة أو كبيرة جدًا.');
   const assignment=(p.assignments||[]).find((a:Row)=>Number(a.sheet_no)===raw.sheet_no);
   const valid=!!assignment&&uuid(assignment.student_id)&&raw.qr_valid===true&&raw.model===assignment.model;
   const model=valid?assignment.model:String(raw.model||'').slice(0,12);
   const key=(p.answer_keys||[]).find((k:Row)=>k.model===model)?.answers||[];
   // Identity and answer-key completeness are independent checks.
   const identityValid=valid,keyComplete=key.length===p.question_count&&key.every((k:Row)=>validOption(k?.correct_index));

   // Single source of truth: the server reads OMR from the stored JPEG.
   // Browser-provided bubble results are ignored for scoring.
   let rr:any=null,readerError='';
   // Pixel reading does not need a student's identity or a grading key.
   try{
     rr=readOmrJpeg(String(raw.image_data),Number(p.question_count||0),Number(p.question_start||1));
   }catch(e:any){
     readerError=String(e?.message||e);
   }

   const sourceAnswers=rr?.answers||[];
   const markersOk=rr?.markers_ok===true&&sourceAnswers.length===p.question_count;
   const answers=Array.from({length:p.question_count},(_,i)=>classifyAnswer(sourceAnswers[i]||{},key[i]||{},i,{
     identity_valid:identityValid,key_complete:keyComplete,markers_ok:markersOk,reader_error:!!readerError
   }));
   const verification=rr?.verification||{
     risk:'high',quality_score:0,
     reasons:[identityValid?(readerError||'فشل القارئ الخادمي في تحليل التظليل.'):'هوية الورقة غير مؤكدة.'],
     requires_manual_review:true,auto_accept:false,
     counts:{ambiguous:p.question_count,multiple:0,blank:0,low_margin:0,clear:0}
   };
   const snapshot={
     student_name:identityValid?assignment.student_name:'غير معروف — يلزم إعادة المسح',model,identity_valid:identityValid,
     markers_ok:markersOk,marker_confidence:finite(rr?.marker_confidence,0,1),
     answers,score:answers.filter((a:Row)=>a.correct).length,total:p.question_count,
     counts:answers.reduce((m:Row,a:Row)=>(m[a.state]=(m[a.state]||0)+1,m),{blank:0,multiple:0,correct:0,incorrect:0,uncertain:0}),
     page_no:Number(raw.page_no)||1,region_no:Number(raw.region_no)||1,
     omr_policy:OMR_POLICY,
     omr_detector:String(rr?.detector||'').slice(0,64),
     marker_points:rr?.marker_points||null,
     omr_verification:classificationVerification(verification,answers),
     omr_reading_verification:compactVerification(rr?.verification),
     ...classificationDiagnostics(answers),
     omr_calibration:compactCalibration(rr?.calibration),
     omr_reader_error:readerError||null
   };
   const legacy=identityValid?must(await db.from('nafes_assessment_attempts').select('submitted_at,events').eq('student_id',assignment.student_id).contains('config',{paper_review_id:review.review_id}).not('submitted_at','is',null).order('submitted_at').limit(20)):[];
   const legacyAt=(legacy||[]).find((x:Row)=>x.events?.some((e:Row)=>e.type==='paper_scan'&&e.review_id===review.review_id&&!e.scan_sheet_id))?.submitted_at||null;
   const sheet=must(await db.rpc('nafes_scan_register',{p_session:session.id,p_sheet:{ordinal:raw.ordinal,legacy_at:legacyAt,student_id:identityValid?assignment.student_id:null,sheet_no:identityValid?raw.sheet_no:null,image_hash:await hash(raw.image_data),image_data:raw.image_data,snapshot}}));
    return {ok:true,sheet,reader:OMR_POLICY,reader_error:readerError||null};
 }
 if(b.action==='teacher_scan_image'){
   const row=must(await db.from('nafes_scan_sheets').select('image_data').eq('session_id',session.id).eq('id',b.sheet_id).single());return {ok:true,...row};
 }
 if(b.action==='teacher_scan_assign_identity'){
   if(!uuid(b.sheet_id)||!uuid(b.student_id)||!Number.isInteger(b.answer_version))fail('بيانات تعيين الطالب غير صالحة.');
   const p=session.review_snapshot,assignment=(p.assignments||[]).find((a:Row)=>String(a.student_id)===String(b.student_id));
   if(!assignment||!uuid(assignment.student_id))fail('الطالب غير موجود في قائمة أوراق هذا الاختبار.',404);
   const key=(p.answer_keys||[]).find((k:Row)=>k.model===assignment.model)?.answers||[];
   if(key.length!==p.question_count||key.some((k:Row)=>!validOption(k?.correct_index)))fail('تعذر العثور على مفتاح نموذج الطالب.',409);
   const row=must(await db.from('nafes_scan_sheets').select(summaryColumns).eq('session_id',session.id).eq('id',b.sheet_id).maybeSingle());
   if(!row)fail('ورقة غير موجودة.',404);
   const current=row.effective_snapshot||row.snapshot,rawAnswers=Array.isArray(current?.answers)?current.answers:[];
   const answers=Array.from({length:p.question_count},(_,i)=>{
     const raw=rawAnswers[i]||{};
     // Assigning identity cannot resolve a bubble ambiguity, even on a reviewed row.
     const classified:Row=classifyAnswer(raw,key[i]||{},i,{identity_valid:true,key_complete:true,
       markers_ok:current.markers_ok===true,reader_error:!!current.omr_reader_error});
     // Changing the identity/key is not an explicit answer review.
     // Keep previously uncertain answers pending even if the new key matches.
     if((raw.state==='uncertain'||raw.review_pending===true)&&classified.state!=='uncertain'){
       classified.state='uncertain';classified.correct=false;classified.requires_verification=true;
       classified.review_pending=true;classified.review_pending_reason='prior_uncertainty_requires_explicit_review';
     }
     return {...raw,...classified,
       reader_selected:validOption(raw.reader_selected)?raw.reader_selected:classified.reader_selected,
       reviewed_manually:raw.reviewed_manually===true};
   });
   if(typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.trim().length>1000)fail('سبب تعديل الهوية مطلوب.');
   const effective={...current,student_name:assignment.student_name,model:assignment.model,identity_valid:true,identity_source:'manual',identity_manual_reason:b.reason.trim(),answers,
     score:answers.filter((a:Row)=>a.correct).length,
     counts:answers.reduce((m:Row,a:Row)=>(m[a.state]=(m[a.state]||0)+1,m),{blank:0,multiple:0,correct:0,incorrect:0,uncertain:0}),
     omr_verification:classificationVerification(current.omr_reading_verification||current.omr_verification,answers),...classificationDiagnostics(answers)};
   const sheet=must(await db.rpc('nafes_scan_assign_identity',{p_session:session.id,p_sheet:b.sheet_id,p_reviewer:owner.id,p_student:assignment.student_id,p_sheet_no:assignment.sheet_no,p_student_name:assignment.student_name,p_model:assignment.model,p_effective:effective,p_version:b.answer_version}));
   return {ok:true,sheet};
 }
 if(b.action==='teacher_scan_delete'){
   if(owner.subject_scope!=='all')fail('التراجع الإداري متاح للحساب الرئيسي فقط.',403);
   if(b.confirm!==true||!uuid(b.request_id)||!Array.isArray(b.sheet_ids)||!b.sheet_ids.length||b.sheet_ids.length>200||b.sheet_ids.some((x:any)=>!uuid(x)))fail('تأكيد الحذف أو البيانات غير صالحة.');
   const reason=String(b.reason||'').trim();if(reason.length<3||reason.length>200)fail('اكتب سبب الحذف باختصار.');
   const result=must(await db.rpc('nafes_scan_delete_corrections',{p_session:session.id,p_sheet_ids:b.sheet_ids,p_reviewer:owner.id,p_reason:reason,p_batch:b.request_id}));
   if(result?.session_deleted)return {ok:true,...result,session:null,sheets:[]};
   const refreshed=must(await db.from('nafes_scan_sessions').select('*').eq('id',session.id).single());
   const sheets=must(await db.from('nafes_scan_sheets').select(summaryColumns).eq('session_id',session.id).order('ordinal'));
   return {ok:true,...result,session:publicSession(refreshed),sheets};
 }
 if(b.action==='teacher_scan_reprocess_server'){
   if(!uuid(b.sheet_id)||!Number.isInteger(b.answer_version))fail('بيانات إعادة القراءة الخادمية غير صالحة.');
   const row=must(await db.from('nafes_scan_sheets').select(summaryColumns+',image_data').eq('session_id',session.id).eq('id',b.sheet_id).maybeSingle());
   if(!row)fail('ورقة غير موجودة.',404);
   if(row.answer_version!==b.answer_version)fail('تغيرت الورقة أثناء إعادة القراءة؛ أعد المحاولة.',409);
   const rr=await reprocessServerSheet(db,session,row);
   if(rr.skipped)fail('لا يمكن احتساب درجة آلية قبل تأكيد هوية الطالب.',409);
   if(rr.error)fail('فشل القارئ الخادمي: '+rr.error,422);
   await db.from('nafes_scan_sessions').update({completed_at:null}).eq('id',session.id);
   const {image_data,...safe}=rr.row;
    return {ok:true,sheet:safe,unresolved:Number(rr.unresolved||0),reader:OMR_POLICY,proposal_only:rr.proposal_only===true};
 }
 if(b.action==='teacher_scan_reclassify'){
   if(!uuid(b.sheet_id)||!Number.isInteger(b.answer_version))fail('بيانات إعادة القراءة غير صالحة.');
   const row=must(await db.from('nafes_scan_sheets').select(summaryColumns+',image_data').eq('session_id',session.id).eq('id',b.sheet_id).maybeSingle());
   if(!row)fail('ورقة غير موجودة.',404);
   if(row.answer_version!==b.answer_version)fail('تغيرت الورقة أثناء إعادة القراءة؛ أعد المحاولة.',409);
   const rr=await reprocessServerSheet(db,session,row);
   if(rr.skipped)fail('لا يمكن إعادة التصنيف قبل تأكيد هوية الطالب.',409);
   if(rr.error)fail('فشل القارئ الخادمي: '+rr.error,422);
   const {image_data,...safe}=rr.row;
    return {ok:true,sheet:safe,unresolved:Number(rr.unresolved||0),reader:OMR_POLICY,proposal_only:rr.proposal_only===true};
 }
 if(b.action==='teacher_scan_edit_answer'){
   if(!uuid(b.request_id)||!uuid(b.sheet_id)||!Number.isInteger(b.question)||!Number.isInteger(b.answer_version)||!Array.isArray(b.marked)||b.marked.length>4||b.marked.some((n:any)=>!Number.isInteger(n)||n<0||n>3))fail('بيانات تعديل الإجابة غير صالحة.');
   if(typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.trim().length>1000)fail('سبب التعديل اليدوي مطلوب.');
   return {ok:true,sheet:must(await db.rpc('nafes_scan_edit_answer',{p_session:session.id,p_sheet:b.sheet_id,p_reviewer:owner.id,p_question:b.question,p_marked:b.marked,p_version:b.answer_version,p_request:b.request_id,p_reason:b.reason.trim()}))};
 }
 if(b.action==='teacher_scan_resolve_multiple'){
   // Explicit teacher adjudication only; no automatic grade for multiple shading.
   // The existing versioned, audited RPC remains the sole write authority.
   const mode=String(b.resolution||'');
   const q=Number(b.question),version=b.answer_version;
   if(!uuid(b.sheet_id)||!uuid(b.request_id)||!Number.isInteger(version)||
      !Number.isInteger(q)||q<1||q>60||
      !['credit_correct','count_wrong'].includes(mode))fail('قرار التظليل المتعدد غير صالح.',400);
   if(session.completed_at)fail('الجلسة منتهية؛ لا يجوز تعديل درجاتها.',409);
   const row=must(await db.from('nafes_scan_sheets').select(summaryColumns)
      .eq('session_id',session.id).eq('id',b.sheet_id).maybeSingle());
   if(!row)fail('الورقة غير موجودة.',404);
   if(row.answer_version!==version)fail('تغيرت الإجابات أثناء المراجعة؛ أعد فتح الورقة.',409);
   if(row.blocked_duplicate||!row.student_id)fail('لا يمكن منح درجة لنسخة مكررة أو ورقة دون هوية.',409);
   const doc=row.effective_snapshot||row.snapshot||{},original=row.snapshot||{};
   if(doc.identity_valid!==true||doc.markers_ok!==true||doc.omr_reader_error)
     fail('يجب تأكيد هوية الورقة والمحاذاة أولًا.',409);
   if(!Array.isArray(doc.answers)||!Array.isArray(original.answers)||
      doc.answers.length!==Number(session.review_snapshot?.question_count)||
      q>doc.answers.length)fail('أسئلة الورقة غير مكتملة.',409);
   const current=doc.answers[q-1],source=original.answers[q-1];
   const originalMarks=Array.isArray(source?.marked)?source.marked:[];
   const marks=Array.isArray(current?.marked)?current.marked:[];
   if(!confirmedMultiple(current))
     fail('التظليل متعدد الخيارات غير مثبت أو يتضمن قراءة غير محسومة؛ راجع الصورة أولًا.',409);
   const key=current.correct_index;
   if(!validOption(key)||source?.correct_index!==key)
     fail('مفتاح الإجابة غير صالح أو لا يطابق النموذج الأصلي.',409);
   if(mode==='credit_correct'&&!canCreditOriginalCorrect(source,current))
     fail('لا يمكن منح درجة: الخيار الصحيح غير مثبت ضمن الخيارات المظللة في القراءة الأصلية.',409);
   const detail=mode==='credit_correct'?
     'قرار مراجعة متعدد التظليل: احتساب الإجابة الصحيحة التي ثبت أنها ضمن الدوائر المظللة في الصورة الأصلية':
     'قرار مراجعة متعدد التظليل: إبقاء التظليل المتعدد واحتساب السؤال خطأً دون درجة';
   const extra=typeof b.reason==='string'?b.reason.trim():'';
   if(extra.length>600)fail('سبب المراجعة طويل جدًا.',400);
   const reason=detail+(extra?' — '+extra:'');
   const newMarks=mode==='credit_correct'?[key]:marks;
   const updated=must(await db.rpc('nafes_scan_edit_answer',{
      p_session:session.id,p_sheet:row.id,p_reviewer:owner.id,p_question:q,
      p_marked:newMarks,p_version:version,p_request:b.request_id,p_reason:reason
   }));
   return {ok:true,sheet:updated,resolution:mode,
      original_marks:originalMarks,official_grade_changed:mode==='credit_correct'};
 }
 if(b.action==='teacher_scan_edit_history'){
   const found=must(await db.from('nafes_scan_sheets').select('id').eq('session_id',session.id).eq('id',b.sheet_id).maybeSingle());if(!found)fail('ورقة غير موجودة.',404);
   const cursor=Number(b.cursor||0);if(!Number.isInteger(cursor)||cursor<0)fail('مؤشر غير صالح.');
   const edits=must(await db.from('nafes_scan_answer_edits').select('*').eq('sheet_id',b.sheet_id).order('answer_version',{ascending:false}).range(cursor,cursor+199));
   const identity_edits=must(await db.from('nafes_scan_identity_edits').select('*').eq('sheet_id',b.sheet_id).order('created_at',{ascending:false}).range(cursor,cursor+199));
   return {ok:true,edits,identity_edits,next_cursor:edits.length===200||identity_edits.length===200?cursor+200:null};
 }
 if(b.action==='teacher_scan_verify'){
   if(!uuid(b.sheet_id)||!Number.isInteger(b.answer_version))fail('بيانات التحقق من الورقة غير صالحة.');
   const sheet=must(await db.from('nafes_scan_sheets').select(summaryColumns).eq('session_id',session.id).eq('id',b.sheet_id).maybeSingle());
   if(!sheet)fail('ورقة غير موجودة.',404);
   if(sheet.answer_version!==b.answer_version)fail('تغيرت الورقة أثناء المراجعة؛ حدّثها قبل التحقق.',409);
   if(!sheet.blocked_duplicate)assertReviewedSheet(sheet,Number(session.review_snapshot?.question_count));
   // SQL still owns the atomic version check and audit; its source must be verified separately.
   return {ok:true,sheet:must(await db.rpc('nafes_scan_verify_current',{p_session:session.id,p_sheet:b.sheet_id,p_reviewer:owner.id,p_ack:b.acknowledge_duplicate===true,p_version:b.answer_version}))};
 }
 if(b.action==='teacher_scan_finish'){
   await reviewedBatchSheets(db,session);
   return {ok:true,session:publicSession(must(await db.rpc('nafes_scan_finish',{p_session:session.id})))};
 }
 fail('إجراء مراجعة غير معروف.');
}
function assertReviewedSheet(sheet:Row,questionCount:number){
   const snapshot=sheet.effective_snapshot||sheet.snapshot||{};
   if(snapshot.identity_valid!==true||!uuid(sheet.student_id))fail('هوية الورقة غير مؤكدة؛ لا يمكن اعتمادها.',409);
   if(!Array.isArray(snapshot.answers)||snapshot.answers.length!==questionCount)
     fail('إجابات الورقة غير مكتملة؛ لا يمكن اعتمادها.',409);
   for(const a of snapshot.answers){
     const unresolved=a.state==='uncertain'||a.status==='ambiguous'||a.review_pending===true
       ||!['correct','incorrect','blank','multiple'].includes(a.state)
       ||Object.values(a.uncertainty||{}).some((v:any)=>Array.isArray(v)&&v.length>0);
     const invalidMultiple=a.state==='multiple'&&(a.status!=='multiple'||a.selected!==null
       ||!Array.isArray(a.marked)||a.marked.some((v:any)=>!validOption(v))||new Set(a.marked).size<2);
     if(unresolved||invalidMultiple)fail('توجد قراءة غير محسومة أو أدلة متناقضة؛ تحقق منها قبل اعتماد النتائج.',409);
   }
}
async function reviewedBatchSheets(db:any,session:Row){
 const sheets=must(await db.from('nafes_scan_sheets').select(summaryColumns).eq('session_id',session.id).eq('blocked_duplicate',false).order('ordinal'));
 if(!sheets.length)fail('لا توجد أوراق قابلة للاعتماد؛ راجع تنبيهات التكرار وإعادة المسح.',409);
 for(const sheet of sheets){
   if(sheet.disposition!=='verified')fail('توجد أوراق لم تُحسم مراجعتها؛ لا يمكن اعتماد الدفعة.',409);
   assertReviewedSheet(sheet,Number(session.review_snapshot?.question_count));
 }
 return sheets;
}
export async function reviewedScanPayload(db:any,b:Row,owner:Row){
 if(!uuid(b.session_id))fail('أكمل جلسة مراجعة الأوراق قبل اعتماد النتائج.',409);
 const {review,session}=await scanSession(db,b,owner);
 if(session.reviewer_id!==owner.id)fail('نشر النتائج متاح لمراجع الجلسة المسجل فقط.',403);
 if(!session.completed_at)fail('اضغط «تم المراجعة» قبل اعتماد النتائج.',409);
 const sheets=await reviewedBatchSheets(db,session);
 return {...session.review_snapshot,review_owner_id:review.owner_id,session_id:session.id,results:sheets.map((s:Row)=>{const x=s.effective_snapshot||s.snapshot;return {student_id:s.student_id,student_name:x.student_name,model:x.model,sheet_id:s.id,answer_version:s.answer_version,answers:x.answers,omr:{answer_count:x.total,manual_answers:x.answers.filter((a:Row)=>a.reviewed_manually).length,policy:x.omr_policy||null,risk:x.omr_verification?.risk||null,quality_score:x.omr_verification?.quality_score||null}};})};
}
