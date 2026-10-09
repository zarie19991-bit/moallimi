/**
 * Official grade gate for paper scans.
 * A failed or unverified reading has NO numeric score. Zero is reserved for
 * a complete, trustworthy, fully classified answer set containing no correct
 * answers. Never infer zero from a missing result or a caught reader error.
 */
export type PaperGradeStatus='unreadable'|'needs_review'|'provisional';
export type PaperGrade={score:number|null;grade_status:PaperGradeStatus;grade_reasons:string[]};
type ScannedAnswer={correct?:boolean;state?:string;reading_status?:string;requires_verification?:boolean;review_pending?:boolean;uncertainty?:Record<string,unknown>};
export function gradeScan(
 answers:ScannedAnswer[], expectedCount:number,
 context:{markers_ok:boolean;reader_error?:string|null;identity_valid?:boolean;key_complete?:boolean}
):PaperGrade{
 const reasons:string[]=[];
 if(!Number.isInteger(expectedCount)||expectedCount<1||expectedCount>60)reasons.push('invalid_question_count');
 if(context.reader_error)reasons.push('reader_failed');
 if(context.markers_ok!==true)reasons.push('markers_not_verified');
 if(context.identity_valid===false)reasons.push('identity_not_verified');
 if(context.key_complete===false)reasons.push('answer_key_not_verified');
 if(!Array.isArray(answers)||answers.length!==expectedCount)reasons.push('answer_count_mismatch');
 if(answers?.some(a=>!a||a.reading_status==='unavailable'||a.reading_status==='invalid'))reasons.push('answer_reading_failed');
 if(reasons.length)return{score:null,grade_status:'unreadable',grade_reasons:[...new Set(reasons)]};
 const unresolved=answers.some(a=>a.state==='uncertain'||a.state==='multiple'||a.state==='ambiguous'||
   a.requires_verification===true||a.review_pending===true||
   Object.values(a.uncertainty||{}).some(v=>Array.isArray(v)&&v.length>0)||
   !['correct','incorrect','blank'].includes(String(a.state||'')));
 if(unresolved)return{score:null,grade_status:'needs_review',grade_reasons:['answer_requires_review']};
 return{score:answers.filter(a=>a.state==='correct'&&a.correct===true).length,
   grade_status:'provisional',grade_reasons:[]};
}
