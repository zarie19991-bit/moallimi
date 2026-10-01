(()=>{
'use strict';
if(window.NafesOmrTemplate)return;
const WIDTH=180,HEIGHT=104,MAX_QUESTIONS=60;
const MARKERS={tl:[4,4],tr:[176,4],bl:[4,100],br:[176,100],size:3};
const LETTERS=['أ','ب','ج','د'];
function layout(total){
 const n=Math.max(1,Math.min(MAX_QUESTIONS,Number(total)||20));
 if(n<=20)return{count:n,blockSize:10,rights:[151,71],rowStart:19,rowStep:7.05,optionOffsets:[10,20,30,40],blockLeftOffset:47};
 if(n<=30)return{count:n,blockSize:15,rights:[151,71],rowStart:17,rowStep:5.35,optionOffsets:[10,20,30,40],blockLeftOffset:47};
 return{count:n,blockSize:15,rights:[171,128,85,42],rowStart:17,rowStep:5.35,optionOffsets:[9,18,27,36],blockLeftOffset:40};
}
function answerPoints(index,total=20){
 const L=layout(total),block=Math.floor(index/L.blockSize),row=index%L.blockSize,right=L.rights[block];
 if(right===undefined||index>=L.count)return[];
 const y=L.rowStart+row*L.rowStep;
 return L.optionOffsets.map((off,choice)=>({x:right-off,y,choice}));
}
function svg(startNo=1,total=20){
 const L=layout(total),blocks=Math.ceil(L.count/L.blockSize);
 let s='<svg class="omr-svg" viewBox="0 0 '+WIDTH+' '+HEIGHT+'" xmlns="http://www.w3.org/2000/svg" aria-label="إجابات الأسئلة">';
 s+='<rect x="2.5" y="2.5" width="3" height="3" rx=".3" fill="#111"/><rect x="174.5" y="2.5" width="3" height="3" rx=".3" fill="#111"/><rect x="2.5" y="98.5" width="3" height="3" rx=".3" fill="#111"/><rect x="174.5" y="98.5" width="3" height="3" rx=".3" fill="#111"/>';
 for(let b=0;b<blocks;b++){
   const right=L.rights[b],left=right-L.blockLeftOffset,headY=7;
   s+='<rect x="'+left+'" y="'+headY+'" width="'+(right-left+3)+'" height="89" rx="2.2" fill="none" stroke="#13888b" stroke-width=".6"/>';
   const pts=answerPoints(b*L.blockSize,L.count);
   pts.forEach((p,j)=>{
     s+='<rect x="'+(p.x-4.1)+'" y="8.2" width="8.2" height="7.2" rx="2.4" fill="#0c8184"/>';
     s+='<text x="'+p.x+'" y="13.1" text-anchor="middle" font-size="4.1" font-weight="700" fill="#fff" font-family="Tahoma,Arial,sans-serif">'+LETTERS[j]+'</text>';
   });
   for(let r=0;r<L.blockSize;r++){
     const idx=b*L.blockSize+r;if(idx>=L.count)break;
     const y=L.rowStart+r*L.rowStep,num=startNo+idx;
     s+='<rect x="'+(right-2.2)+'" y="'+(y-2.25)+'" width="5.3" height="4.5" rx=".3" fill="#fff" stroke="#13888b" stroke-width=".55"/>';
     s+='<text x="'+(right+.45)+'" y="'+(y+1.05)+'" text-anchor="middle" font-size="3.25" font-weight="700" fill="#087176" font-family="Tahoma,Arial,sans-serif">'+num+'</text>';
     answerPoints(idx,L.count).forEach(p=>{s+='<circle cx="'+p.x+'" cy="'+p.y+'" r="2.12" fill="#fff" stroke="#13888b" stroke-width=".68"/>';});
     if(r<L.blockSize-1)s+='<line x1="'+left+'" y1="'+(y+L.rowStep/2)+'" x2="'+(right+3)+'" y2="'+(y+L.rowStep/2)+'" stroke="#d9eded" stroke-width=".25"/>';
   }
 }
 s+='</svg>';return s;
}
window.NafesOmrTemplate={version:4,width:WIDTH,height:HEIGHT,maxQuestions:MAX_QUESTIONS,markers:MARKERS,letters:LETTERS,layout,answerPoints,svg};
})();