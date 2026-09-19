(()=>{
'use strict';
const KEY='lugati_exact_session_v2';
const STUDENT_PAGE='./lugati-student.html';
function parse(v){try{return JSON.parse(v||'null')}catch{return null}}
function isStudent(v){return parse(v)?.role==='student'}
function goStudent(){
  if(!location.pathname.endsWith('/lugati-student.html')) location.replace(STUDENT_PAGE);
}
try{
  if(isStudent(sessionStorage.getItem(KEY)||localStorage.getItem(KEY))) goStudent();
  const nativeSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    nativeSet.call(this,key,value);
    if((this===sessionStorage||this===localStorage)&&key===KEY&&isStudent(value)) setTimeout(goStudent,0);
  };
}catch(e){console.warn('lugati role router',e)}
})();