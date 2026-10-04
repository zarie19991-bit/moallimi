(()=>{
'use strict';
if(window.NafesOmrTemplate)return;
const WIDTH=180,HEIGHT=112,MAX_QUESTIONS=60;
const MARKERS={tl:[4,4],tr:[176,4],bl:[4,108],br:[176,108],size:3};
const LETTERS=['أ','ب','ج','د'];
function layout(){
 return{count:60,blockSize:15,rights:[171,128,85,42],rowStart:20,rowStep:5.45,optionOffsets:[9,18,27,36],blockLeftOffset:40};
}
function answerPoints(index,total=60){
 const L=layout(),block=Math.floor(index/L.blockSize),row=index%L.blockSize,right=L.rights[block];
 if(right===undefined||index>=MAX_QUESTIONS)return[];
 const y=L.rowStart+row*L.rowStep;
 return L.optionOffsets.map((off,choice)=>({x:right-off,y,choice}));
}
function svg(startNo=1,total=60,activeTotal=60){
 const L=layout(),blocks=4,active=Math.max(1,Math.min(MAX_QUESTIONS,Number(activeTotal)||Number(total)||60));
 let s='<svg class="omr-svg" viewBox="0 0 '+WIDTH+' '+HEIGHT+'" xmlns="http://www.w3.org/2000/svg" aria-label="إجابات الأسئلة">';
 s+='<rect x="2.5" y="2.5" width="3" height="3" rx=".3" fill="#111"/><rect x="174.5" y="2.5" width="3" height="3" rx=".3" fill="#111"/><rect x="2.5" y="106.5" width="3" height="3" rx=".3" fill="#111"/><rect x="174.5" y="106.5" width="3" height="3" rx=".3" fill="#111"/>';
 const headY=8,outerLeft=L.rights[blocks-1]-L.blockLeftOffset,outerRight=L.rights[0]+3,outerBottom=102;
 // connected-answer-grid: one continuous frame for 1–15 | 16–30 | 31–45 | 46–60.
 s+='<rect x="'+outerLeft+'" y="'+headY+'" width="'+(outerRight-outerLeft)+'" height="'+(outerBottom-headY)+'" rx="2" fill="none" stroke="#13888b" stroke-width=".55"/>';
 for(let b=1;b<blocks;b++){
   const divider=L.rights[b-1]-L.blockLeftOffset;
   s+='<line x1="'+divider+'" y1="'+headY+'" x2="'+divider+'" y2="'+outerBottom+'" stroke="#13888b" stroke-width=".55"/>';
 }
 for(let b=0;b<blocks;b++){
   const right=L.rights[b],left=right-L.blockLeftOffset;
   const pts=answerPoints(b*L.blockSize,60);
   pts.forEach((p,j)=>{
     s+='<rect x="'+(p.x-4.1)+'" y="9.3" width="8.2" height="7.1" rx="2.2" fill="#0c8184"/>';
     s+='<text x="'+p.x+'" y="14.2" text-anchor="middle" font-size="4.1" font-weight="700" fill="#fff" font-family="Tahoma,Arial,sans-serif">'+LETTERS[j]+'</text>';
   });
   for(let r=0;r<L.blockSize;r++){
     const idx=b*L.blockSize+r,y=L.rowStart+r*L.rowStep,num=startNo+idx,isActive=idx<active;
     s+='<rect x="'+(right-2.2)+'" y="'+(y-2.25)+'" width="5.3" height="4.5" rx=".3" fill="#fff" stroke="#13888b" stroke-width=".55"/>';
     s+='<text x="'+(right+.45)+'" y="'+(y+1.05)+'" text-anchor="middle" font-size="3.15" font-weight="700" fill="#087176" font-family="Tahoma,Arial,sans-serif">'+num+'</text>';
     answerPoints(idx,60).forEach(p=>{s+='<circle cx="'+p.x+'" cy="'+p.y+'" r="2.08" fill="#fff" stroke="'+(isActive?'#13888b':'#79aeb0')+'" stroke-width=".66" opacity="'+(isActive?'1':'.62')+'"/>';});
     if(r<L.blockSize-1)s+='<line x1="'+left+'" y1="'+(y+L.rowStep/2)+'" x2="'+(right+3)+'" y2="'+(y+L.rowStep/2)+'" stroke="#d9eded" stroke-width=".24"/>';
   }
 }
 s+='</svg>';return s;
}
window.NafesOmrTemplate={version:6,width:WIDTH,height:HEIGHT,maxQuestions:MAX_QUESTIONS,markers:MARKERS,letters:LETTERS,layout,answerPoints,svg};
})();