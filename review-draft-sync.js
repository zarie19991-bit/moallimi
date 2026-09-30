(()=>{
'use strict';
if(window.NafesPaperReviewDraft)return;
const STORAGE='nafes_review_correction_draft';
function local(){try{return JSON.parse(localStorage.getItem(STORAGE)||'null');}catch(_){return null;}}
function store(p){if(!p)return null;try{localStorage.setItem(STORAGE,JSON.stringify(p));}catch(_){}return p;}
async function load(){
 const fallback=local();
 if(!window.NafesTeacher?.getKey?.())return fallback;
 try{
   const rid=new URLSearchParams(location.search).get('rid')||fallback?.review_id||'';
   let res=await NafesTeacher.api('teacher_paper_review_get',rid?{review_id:rid}:{});
   if(!res?.review&&rid)res=await NafesTeacher.api('teacher_paper_review_get',{});
   return store(res?.review?.payload)||fallback;
 }catch(_){return fallback;}
}
async function save(payload){
 store(payload);
 if(!window.NafesTeacher?.getKey?.())return{ok:false,local:true};
 return await NafesTeacher.api('teacher_paper_review_upsert',{review:payload});
}
window.NafesPaperReviewDraft={local,store,load,save};
})();