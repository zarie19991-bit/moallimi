/** Multiple-bubble adjudication policy. Never infer a grade from the answer key. */
const option=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<4;
export function confirmedMultiple(a:any):boolean {
 const marked=a?.marked;
 return a?.status==='multiple'&&a?.state==='multiple'&&a?.selected===null&&
   Array.isArray(marked)&&marked.length>=2&&marked.every(option)&&
   new Set(marked).size===marked.length&&
   ['reading','identity','answer_key'].every(k=>
     Array.isArray(a?.uncertainty?.[k])&&a.uncertainty[k].length===0);
}
export function canCreditOriginalCorrect(original:any,current:any):boolean{
 const answer=current?.correct_index;
 return confirmedMultiple(current)&&option(answer)&&
   original?.status==='multiple'&&original?.correct_index===answer&&
   Array.isArray(original?.marked)&&original.marked.length>=2&&
   original.marked.every(option)&&new Set(original.marked).size===original.marked.length&&
   original.marked.includes(answer)&&current.marked.includes(answer);
}
