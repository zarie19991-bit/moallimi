(()=>{
'use strict';
if(window.NafesOmrTemplate)return;
const WIDTH=180,HEIGHT=72;
const MARKERS={tl:[4,4],tr:[176,4],bl:[4,68],br:[176,68],size:4};
const RIGHT_X=[112,126,140,154],LEFT_X=[20,34,48,62];
const ROW_Y=Array.from({length:10},(_,i)=>10+i*5.65);
const LETTERS=['أ','ب','ج','د'];
function answerPoints(index){
 const row=index%10, xs=index<10?RIGHT_X:LEFT_X;
 return xs.map((x,choice)=>({x,y:ROW_Y[row],choice}));
}
function svg(startNo=1,total=20){
 let s='<svg class="omr-svg" viewBox="0 0 '+WIDTH+' '+HEIGHT+'" xmlns="http://www.w3.org/2000/svg" aria-label="شبكة تظليل الإجابات">';
 s+='<rect x="2" y="2" width="4" height="4" fill="#000"/><rect x="174" y="2" width="4" height="4" fill="#000"/><rect x="2" y="66" width="4" height="4" fill="#000"/><rect x="174" y="66" width="4" height="4" fill="#000"/>';
 s+='<line x1="90" y1="7" x2="90" y2="65" stroke="#b8b8b8" stroke-width=".35"/>';
 for(let i=0;i<Math.min(total,20);i++){
   const row=i%10, right=i<10, y=ROW_Y[row], xs=right?RIGHT_X:LEFT_X, qx=right?168:84;
   s+='<line x1="'+(right?96:8)+'" y1="'+(y+2.65)+'" x2="'+(right?172:86)+'" y2="'+(y+2.65)+'" stroke="#e1e1e1" stroke-width=".25"/>';
   s+='<text x="'+qx+'" y="'+(y+1.05)+'" text-anchor="middle" font-size="3.7" font-weight="700" font-family="Tahoma,Arial,sans-serif">'+(startNo+i)+'</text>';
   xs.forEach((x,j)=>{
     s+='<circle cx="'+x+'" cy="'+y+'" r="2.15" fill="white" stroke="#111" stroke-width=".55"/>';
     s+='<text x="'+(x+4.2)+'" y="'+(y+1)+'" text-anchor="middle" font-size="3.25" font-weight="700" font-family="Tahoma,Arial,sans-serif">'+LETTERS[j]+'</text>';
   });
 }
 s+='</svg>';return s;
}
window.NafesOmrTemplate={version:2,width:WIDTH,height:HEIGHT,markers:MARKERS,rightX:RIGHT_X,leftX:LEFT_X,rowY:ROW_Y,letters:LETTERS,answerPoints,svg};
})();