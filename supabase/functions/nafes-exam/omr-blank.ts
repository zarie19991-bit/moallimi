/**
 * Conservative evidence check for a bubble row with no pencil/pen shading.
 * Uses the interiors of all four bubbles and their independent local
 * paper-contrast and blue-ink signals. Outer pre-printed rings must never
 * be mistaken for a student's selected option.
 *
 * Faint/partial/poorly aligned cases remain unresolved rather than being
 * converted into a blank answer.
 */
type BubbleBlankEvidence = {
  center:number;
  score:number;
  blueInsideMass:number;
  blueInsideHits:number;
};
export function isVerifiedBlankBubbleRow(row:BubbleBlankEvidence[]):boolean{
 if(!Array.isArray(row)||row.length!==4)return false;
 return row.every(e=>e!==null&&typeof e==='object'&&
  Number.isFinite(e.center)&&e.center>=248&&
  Number.isFinite(e.score)&&e.score<=-0.06&&
  Number.isFinite(e.blueInsideMass)&&e.blueInsideMass<5&&
  Number.isFinite(e.blueInsideHits)&&e.blueInsideHits<4);
}
