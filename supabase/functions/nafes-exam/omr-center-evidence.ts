/**
 * A bubble is not proven filled by its outer ring or row ink mass alone.
 * Require independent grayscale evidence from the central disk versus all
 * three alternative disks before calling the mark clear/graded.
 * Weak or unusual markings remain reviewable, never invented as confirmed.
 */
export function hasIndependentCenterEvidence(
 row:Array<{center:number}>,selected:number
):boolean{
 if(!Array.isArray(row)||row.length!==4||!Number.isInteger(selected)||selected<0||selected>3)return false;
 const centers=row.map(x=>Number(x?.center));
 if(centers.some(x=>!Number.isFinite(x)||x<0||x>255))return false;
 const chosen=centers[selected],others=centers.filter((_,i)=>i!==selected);
 return chosen<=225&&Math.min(...others)-chosen>=10;
}
