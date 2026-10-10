/**
 * A raw "multiple" detector needs independent ink evidence for EVERY
 * suggested filled bubble; otherwise display "ambiguous / review", not
 * falsely accuse a pupil of shading two answers.
 */
export type BubbleInkEvidence={center:number,blueInsideMass:number,blueInsideHits:number};
export function provenMultipleCenters(row:BubbleInkEvidence[],marked:number[]):boolean{
 if(!Array.isArray(row)||row.length!==4||!Array.isArray(marked)||
    marked.length<2||marked.length>4||new Set(marked).size!==marked.length||
    marked.some(i=>!Number.isInteger(i)||i<0||i>3))return false;
 const others=row.filter((_,i)=>!marked.includes(i)).map(r=>Number(r?.center));
 const lightestAlternatives=others.length?Math.max(...others):255;
 return marked.every(i=>{
   const r=row[i],center=Number(r?.center),
     blue=Number(r?.blueInsideMass),hits=Number(r?.blueInsideHits);
   if(!Number.isFinite(center)||center<0||center>255)return false;
   const darkEnough=center<=225&&lightestAlternatives-center>=10;
   const blueEnough=Number.isFinite(blue)&&blue>=7&&Number.isFinite(hits)&&hits>=5;
   return darkEnough||blueEnough;
 });
}
