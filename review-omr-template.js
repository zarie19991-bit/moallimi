(()=>{
'use strict';
if(window.NafesOmrTemplate)return;
const WIDTH=180,HEIGHT=94,MAX_QUESTIONS=60;
const MARKERS={tl:[4,4],tr:[176,4],bl:[4,90],br:[176,90],size:4};
const LETTERS=['أ','ب','ج','د'];
const BLOCK_RIGHT=[170,127,84,41];
const ROW_Y=Array.from({length:15},(_,i)=>12+i*5.05);
function answerPoints(index){
 const block=Math.floor(index/15),row=index%15,right=BLOCK_RIGHT[block];
 if(block<0||block>3)return[];
 return [11,19,27,35].map((off,choice)=>({x:right-off,y:ROW_Y[row],choice}));
}
function svg(startNo=1,total=20){
 const count=Math.max(1,Math.min(MAX_QUESTIONS,Number(total)||20));
 let s='<svg class="omr-svg" viewBox="0 0 '+WIDTH+' '+HEIGHT+'" xmlns="http://www.w3.org/2000/svg" aria-label="إجابات الأسئلة">';
 s+='<rect x="2" y="2" width="4" height="4" rx=".4" fill="#111"/><rect x="174" y="2" width="4" height="4" rx=".4" fill="#111"/><rect x="2" y="88" width="4" height="4" rx=".4" fill="#111"/><rect x="174" y="88" width="4" height="4" rx=".4" fill="#111"/>';
 const blocks=Math.ceil(count/15);
 for(let b=0;b<blocks;b++){
   const right=BLOCK_RIGHT[b],left=right-39;
   s+='<rect x="'+(left-1.5)+'" y="7" width="41" height="79" rx="2.2" fill="none" stroke="#087f83" stroke-width=".65"/>';
   s+='<rect x="'+(left-1.5)+'" y="7" width="41" height="7" rx="2.2" fill="#087f83"/>';
   [11,19,27,35].forEach((off,j)=>{s+='<text x="'+(right-off)+'" y="12" text-anchor="middle" font-size="4" font-weight="700" fill="#fff" font-family="Tahoma,Arial,sans-serif">'+LETTERS[j]+'</text>';});
   for(let r=0;r<15;r++){
     const idx=b*15+r;if(idx>=count)break;const y=ROW_Y[r],num=startNo+idx;
     s+='<text x="'+(right+1)+'" y="'+(y+1.25)+'" text-anchor="middle" font-size="3.3" font-weight="700" fill="#075f63" font-family="Tahoma,Arial,sans-serif">'+num+'</text>';
     answerPoints(idx).forEach(p=>{s+='<circle cx="'+p.x+'" cy="'+p.y+'" r="2.05" fill="#fff" stroke="#087f83" stroke-width=".65"/>';});
     if(r<14)s+='<line x1="'+left+'" y1="'+(y+2.55)+'" x2="'+(right+3)+'" y2="'+(y+2.55)+'" stroke="#d6ecec" stroke-width=".28"/>';
   }
 }
 s+='</svg>';return s;
}
window.NafesOmrTemplate={version:3,width:WIDTH,height:HEIGHT,maxQuestions:MAX_QUESTIONS,markers:MARKERS,letters:LETTERS,rowY:ROW_Y,answerPoints,svg};
})();