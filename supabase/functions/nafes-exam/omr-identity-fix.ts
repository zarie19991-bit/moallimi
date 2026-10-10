/**
 * A manually confirmed QR/identity may clear ONLY old identity/key uncertainty.
 * Never turn an ambiguous optical reading into a clear mark.
 * Preserve the original bubble evidence and let the teacher verify the sheet.
 */
const option=(v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=3;
export function identityOnlyUncertainty(a:any):boolean{
 if(!a||a.reviewed_manually===true||
   !['clear','blank','multiple'].includes(a.status)||a.reading_status!==a.status)return false;
 const u=a.uncertainty;
 if(!u||!Array.isArray(u.reading)||u.reading.length||
   !Array.isArray(u.identity)||!u.identity.includes('identity_not_verified')||
   u.identity.some((x:unknown)=>x!=='identity_not_verified')||
   !Array.isArray(u.answer_key)||
   u.answer_key.some((x:unknown)=>!['answer_key_missing_or_invalid','answer_key_incomplete'].includes(x)))return false;
 const marks=a.marked;
 if(!Array.isArray(marks)||marks.some((v:unknown)=>!option(v))||new Set(marks).size!==marks.length)return false;
 if(a.status==='clear')return option(a.selected)&&marks.length===1&&a.selected===marks[0];
 if(a.status==='blank')return a.selected===null&&marks.length===0;
 return a.selected===null&&marks.length>=2;
}
/** Do not overwrite physical diagnostics with defaults from the old camelCase converter. */
export function preserveOpticalEvidence(original:any,classified:any):any{
 const fields=['scores','blue_scores','dark_scores','center_values','top_score','second_score','threshold',
   'separation','reader','confidence','confirmed_marks','raw_reader_status'];
 const kept:any={};
 for(const k of fields)if(original&&Object.prototype.hasOwnProperty.call(original,k))kept[k]=original[k];
 return {...original,...classified,...kept};
}
