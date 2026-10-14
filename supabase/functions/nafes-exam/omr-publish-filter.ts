// Pure, runtime-portable OMR publication gate.
// Unverified, duplicated and explicitly deferred-to-rescan pages never become grades.
// This function NEVER changes evidence, answers, source scans or teacher decisions.
type ReviewedSheet = {disposition?:string|null,blocked_duplicate?:boolean|null,[key:string]:unknown};
export function verifiedSheetsForPublication(rows:ReviewedSheet[]):ReviewedSheet[]{
 const verified=(Array.isArray(rows)?rows:[]).filter(s=>s?.disposition==='verified'&&s?.blocked_duplicate!==true);
 if(!verified.length)throw new Error('لا توجد أوراق تحقق معتمدة للنشر. راجع الأوراق السليمة أولًا.');
 return verified;
}
