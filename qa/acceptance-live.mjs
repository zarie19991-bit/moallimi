import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

const PROJECT='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1';
const EXAM=`${PROJECT}/nafes-exam`;
const CATALOG=`${PROJECT}/nafes-catalog`;
const GRADES=`${PROJECT}/nafes-analysis-grades`;
const RESULTS=`${PROJECT}/nafes-results-admin`;
const SITE='https://zarie19991-bit.github.io/moallimi/';
const KEY=process.env.QA_TEACHER_KEY||'';
const run=Date.now().toString(36).slice(-7);
const checks=[];
const failures=[];
const state={run,createdTests:[],createdStudents:[],loadMetrics:null,baselineRoster:null};

function record(name,ok,detail=''){checks.push({name,ok,detail});if(!ok)failures.push({name,detail});console.log(`${ok?'PASS':'FAIL'} ${name}${detail?` :: ${detail}`:''}`);}
async function check(name,fn){try{const detail=await fn();record(name,true,typeof detail==='string'?detail:detail?JSON.stringify(detail):'');return detail;}catch(e){record(name,false,e?.message||String(e));return null;}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function post(url,body,key=KEY,retries=2){let last;for(let i=0;i<=retries;i++){const started=performance.now();try{const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(key?{'x-teacher-key':key}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});const text=await res.text();let data={};try{data=JSON.parse(text)}catch{data={raw:text}};last={status:res.status,data,ms:performance.now()-started};if(![502,503,504].includes(res.status))return last;}catch(e){last={status:0,data:{error:e.message},ms:performance.now()-started};}if(i<retries)await sleep(i?900:400);}return last;}
function must(r,label){if(!r||r.status!==200||r.data?.error)throw new Error(`${label}: HTTP ${r?.status} ${r?.data?.error||JSON.stringify(r?.data||{})}`);return r.data;}
const teacher=(action,body={})=>post(EXAM,{action,...body});
const student=(action,body={})=>post(EXAM,{action,...body},'',2);
const ar=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(n);
function settings(){return{show_result:true,show_answers:true,show_indicator_result:true,show_correct_count:true,shuffle_questions:true,shuffle_options:true,allow_copy:false,disable_right_click:true,disable_print:true,disable_shortcuts:true,allow_back:true,one_per_page:false,lock_session:true,log_visibility:true,watermark:true,attempts:3,break_minutes:0,opens_at:null,closes_at:null};}
function indicatorConfig(ind,title,className='أ'){return{kind:'multi_indicator',bank_source:'indicator_bank',grade_key:'middle_3',title,class_name:className,term:'QA',academic_term:'QA',school_name:'مدرسة ابن سينا المتوسطة',teacher_name:'QA',principal_name:'QA',identity_mode:'manual',roster:[],count_mode:'per_indicator',sections:[{subject:ind.subject,question_count:15,duration_minutes:20,calculator:false,model_no:1,indicators:[{key:ind.key,count:15}]}],settings:settings()};}
function simCustomConfig(ind,title,className='QATEST'){return{kind:'simulation',simulation_mode:'custom',bank_source:'simulation_bank',grade_key:'middle_3',title,class_name:className,term:'QA',academic_term:'QA',school_name:'مدرسة ابن سينا المتوسطة',teacher_name:'QA',principal_name:'QA',identity_mode:'manual',roster:[],count_mode:'per_indicator',sections:[{subject:ind.subject,question_count:10,duration_minutes:20,calculator:false,model_no:1,indicators:[{key:ind.key,count:10}]}],settings:settings()};}
function fullConfig(title,className='QATEST'){return{kind:'simulation',simulation_mode:'standard',bank_source:'simulation_bank',grade_key:'middle_3',title,class_name:className,term:'QA',academic_term:'QA',school_name:'مدرسة ابن سينا المتوسطة',teacher_name:'QA',principal_name:'QA',identity_mode:'manual',roster:[],count_mode:'total',sections:[{subject:'reading',question_count:20,duration_minutes:30,calculator:false,model_no:1,indicators:[]},{subject:'math',question_count:25,duration_minutes:35,calculator:true,model_no:1,indicators:[]},{subject:'science',question_count:20,duration_minutes:30,calculator:false,model_no:1,indicators:[]}],settings:settings()};}
async function publishConfig(config,{replace=false}={}){const p=must(await teacher('teacher_preview',{config}),'preview');if(!p.draft_id)throw new Error('draft_id missing');let preview=p;if(replace){const first=p.sections?.[0]?.questions?.[0];if(!first)throw new Error('preview question missing');const r=must(await teacher('teacher_replace',{draft_id:p.draft_id,question_id:first.id}),'replace');if(r.sections?.[0]?.questions?.[0]?.id===first.id)throw new Error('question replacement did not change id');preview=r;}const pub=must(await teacher('teacher_publish',{draft_id:p.draft_id}),'publish');state.createdTests.push({id:pub.id,code:pub.short_code,title:pub.title});return{preview,pub};}
async function addStudent(full_name,national_id_last3,class_name){const d=must(await teacher('teacher_student_add',{full_name,national_id_last3,class_name,grade:'الصف الثالث المتوسط'}),'student_add');state.createdStudents.push(d.student.id);return d.student;}
function flatSections(x){return (x.sections||[]).flatMap(s=>s.questions||[]);}
async function finishFlow(code,st,label){const wrong=await student('assessment_start',{code,session_id:`wrong-${run}-${label}`,student_name:'اسم غير مطابق',student_no:st.national_id_last3,class_name:st.class_name});if(wrong.status===200&&!wrong.data?.error)throw new Error('wrong identity was accepted');const session=`qa-${run}-${label}`;const start=must(await student('assessment_start',{code,session_id:session,student_name:st.full_name,student_no:st.national_id_last3,class_name:st.class_name}),'start');let qs=flatSections(start);if(!qs.length)throw new Error('no public questions');if(qs.some(q=>'correctIndex' in q||'correct_index' in q||'explanation' in q))throw new Error('answer key leaked to student');const resumed=must(await student('assessment_start',{code,session_id:session,student_name:st.full_name,student_no:st.national_id_last3,class_name:st.class_name}),'resume');if(!resumed.resumed)throw new Error('active attempt did not resume');qs=flatSections(resumed);const answers=Object.fromEntries(qs.map(q=>[q.id,0]));const common={code,session_id:session,attempt_id:resumed.attempt_id,access_token:resumed.access_token,answers,cursor:0};const saved=must(await student('assessment_save',{...common,event:{type:'page_leave'}}),'save');if(Object.keys(saved.answers||{}).length<1)throw new Error('answers not saved');const done=must(await student('assessment_finish',common),'finish');if(!done.submitted||!Number.isFinite(Number(done.score))||!Number.isFinite(Number(done.total)))throw new Error('invalid final grade');if(Array.isArray(done.review)){const expected=done.review.filter(q=>Number(q.correct_index)===0).length;if(Number(done.score)!==expected)throw new Error(`score mismatch ${done.score} != ${expected}`);}return{start:resumed,done};}
function percentile(xs,p){const a=[...xs].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))]||0;}

await check('public_pages_and_assets',async()=>{const paths=['','create.html','e.html','exam.html','analysis.html','student-papers.html','analysis-participation.js','simulation-catalog-route.js','edge-retry.js','official-analysis-signature-fix.css'];for(const p of paths){const r=await fetch(SITE+p,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`${p||'index'} HTTP ${r.status}`);const t=await r.text();if(t.length<20)throw new Error(`${p||'index'} empty`);}const analysis=await (await fetch(SITE+'analysis.html')).text();if(!analysis.includes('analysis-participation.js'))throw new Error('participation layer not linked');const create=await (await fetch(SITE+'create.html')).text();if(!create.includes('simulation-catalog-route.js'))throw new Error('simulation catalog route not linked');const exam=await (await fetch(SITE+'exam.html')).text();if(!exam.includes('edge-retry.js'))throw new Error('legacy exam retry not linked');return'live Pages assets OK';});

let catalog;
await check('teacher_catalog_corrected',async()=>{catalog=must(await post(CATALOG,{action:'teacher_catalog'}),'catalog');if((catalog.indicators||[]).length!==270)throw new Error(`framework indicators ${(catalog.indicators||[]).length}`);if((catalog.simulation_indicators||[]).length!==270)throw new Error(`simulation indicators ${(catalog.simulation_indicators||[]).length}`);const s=catalog.simulation_summary||{};if(Number(s.reading)<160||Number(s.math)<950||Number(s.science)<1590)throw new Error(`simulation summary ${JSON.stringify(s)}`);return s;});

await check('baseline_roster',async()=>{const d=must(await teacher('teacher_students_list',{include_archived:false}),'students_list');state.baselineRoster=d.students.length;return{active:d.students.length,classes:Object.fromEntries(['أ','ب','ج','د'].map(c=>[c,d.students.filter(s=>s.class_name===c).length]))};});

const primaryName=`طالب قبول متصفح مؤقت ${run}`;
const secondaryName=`طالب أرشفة قبول مؤقت ${run}`;
let primary,secondary;
await check('student_management_add_update_archive_restore',async()=>{primary=await addStudent(primaryName,'984','أ');secondary=await addStudent(secondaryName,'986','QATEST');const updatedName=`طالب أرشفة قبول محدث ${run}`;secondary=must(await teacher('teacher_student_update',{id:secondary.id,full_name:updatedName,national_id_last3:'986',class_name:'QATEST',grade:'الصف الثالث المتوسط'}),'student_update').student;must(await teacher('teacher_student_delete',{id:secondary.id}),'student_archive');let list=must(await teacher('teacher_students_list',{include_archived:true}),'students_list_all').students;const archived=list.find(s=>s.id===secondary.id);if(!archived||archived.is_active!==false)throw new Error('archive not reflected');secondary=must(await teacher('teacher_student_restore',{id:secondary.id}),'student_restore').student;if(!secondary.is_active)throw new Error('restore failed');return{primary:primary.id,secondary:secondary.id};});

let readingInd,scienceInd,simReadingInd;
await check('catalog_indicator_selection',async()=>{readingInd=(catalog.indicators||[]).find(i=>i.subject==='reading'&&Number(i.available)>=15);scienceInd=(catalog.indicators||[]).find(i=>i.subject==='science'&&Number(i.available)>=15);simReadingInd=(catalog.simulation_indicators||[]).find(i=>i.subject==='reading'&&Number(i.available)>=10);if(!readingInd||!scienceInd||!simReadingInd)throw new Error('required indicators unavailable');return{reading:readingInd.key,science:scienceInd.key,sim:simReadingInd.key};});

let main;
await check('create_regular_reading_preview_replace_publish',async()=>{main=await publishConfig(indicatorConfig(readingInd,`QA قبول قراءة ${run}`,'أ'),{replace:true});if(main.preview.sections?.[0]?.questions?.length!==15)throw new Error('reading preview count !=15');state.main={id:main.pub.id,code:main.pub.short_code,title:main.pub.title};return state.main;});

await check('create_regular_science_from_unified_builder',async()=>{const p=must(await teacher('teacher_preview',{config:indicatorConfig(scienceInd,`QA قبول علوم ${run}`,'QATEST')}),'science_preview');if(p.sections?.[0]?.questions?.length!==15)throw new Error('science preview count !=15');state.createdTests.push({id:p.draft_id,draft:true,title:`QA قبول علوم ${run}`});return'15 science questions previewed';});

let simCustom;
await check('create_simulation_custom',async()=>{simCustom=await publishConfig(simCustomConfig(simReadingInd,`QA محاكاة مؤشرات ${run}`));if(simCustom.preview.sections?.[0]?.questions?.length!==10)throw new Error('simulation custom count !=10');return{code:simCustom.pub.short_code};});

let full;
await check('create_full_simulation',async()=>{full=await publishConfig(fullConfig(`QA محاكاة شاملة ${run}`));const counts=(full.preview.sections||[]).map(s=>s.questions.length);if(JSON.stringify(counts)!==JSON.stringify([20,25,20]))throw new Error(`full simulation counts ${counts}`);state.full={id:full.pub.id,code:full.pub.short_code,title:full.pub.title};return{code:full.pub.short_code,counts};});

await check('legacy_short_link',async()=>{const d=must(await teacher('teacher_shorten_legacy',{subject:readingInd.subject,outcome:readingInd.outcome,indicator:readingInd.indicator,model:1}),'legacy_short');if(!d.url?.includes('e.html?t='))throw new Error('legacy short URL invalid');state.legacy=d;return{code:d.short_code};});

let mainFlow;
await check('student_identity_resume_save_finish_grade',async()=>{mainFlow=await finishFlow(main.pub.short_code,primary,'main');if(Number(mainFlow.done.total)!==15)throw new Error(`total ${mainFlow.done.total}`);state.mainAttempt=mainFlow.start.attempt_id;return{score:mainFlow.done.score,total:mainFlow.done.total,percent:mainFlow.done.percent};});

await check('teacher_data_and_paper',async()=>{let cursor=0,all=[],tests=[];do{const d=must(await teacher('teacher_data',{cursor,limit:100}),'teacher_data');all.push(...(d.attempts||[]));if(cursor===0)tests=d.tests||[];cursor=d.next_cursor;}while(cursor!==null);const a=all.find(x=>x.id===state.mainAttempt);if(!a||a.status!=='submitted')throw new Error('submitted attempt missing from teacher data');const p=must(await teacher('teacher_paper',{source:'assessment',attempt_id:state.mainAttempt}),'teacher_paper');if(!p.sections?.[0]?.questions?.length)throw new Error('paper has no questions');if(!p.sections[0].questions.every(q=>'correctIndex' in q))throw new Error('teacher paper missing answer keys');return{attempts:all.length,tests:tests.length,paperQuestions:p.sections[0].questions.length};});

await check('saved_grades_analysis_service',async()=>{const d=must(await post(GRADES,{}),'analysis_grades');const g=(d.grades||[]).find(x=>x.id===state.mainAttempt);if(!g)throw new Error('saved grade missing');if(g.class_name!=='أ'||Number(g.total)!==15)throw new Error(`wrong saved grade ${JSON.stringify(g)}`);return{score:g.score,total:g.total,class_name:g.class_name};});

let fullFlow;
await check('multi_subject_section_scores',async()=>{fullFlow=await finishFlow(full.pub.short_code,secondary,'full');if(Number(fullFlow.done.total)!==65)throw new Error(`full total ${fullFlow.done.total}`);if(!Array.isArray(fullFlow.done.section_scores)||fullFlow.done.section_scores.length!==3)throw new Error('section_scores missing');const subjects=fullFlow.done.section_scores.map(x=>x.subject).sort().join(',');if(subjects!=='math,reading,science')throw new Error(`section subjects ${subjects}`);state.fullAttempt=fullFlow.start.attempt_id;return fullFlow.done.section_scores;});

await check('individual_result_deletion',async()=>{const r=must(await post(RESULTS,{action:'teacher_attempt_delete',source:'assessment',attempt_id:state.fullAttempt,student_id:secondary.id,test_id:full.pub.id,confirm_word:'حذف النتيجة'}),'delete_attempt');if(Number(r.deleted)!==1)throw new Error(`deleted=${r.deleted}`);return r;});

let loadTest;
await check('create_load_test',async()=>{loadTest=await publishConfig(indicatorConfig(readingInd,`QA ضغط 140 ${run}`,'QALOAD'));state.load={id:loadTest.pub.id,code:loadTest.pub.short_code,title:loadTest.pub.title};return state.load;});

const loadStudents=Array.from({length:140},(_,i)=>{const n=String(i).padStart(3,'0');return{full_name:`طالب ضغط قبول ${run} ${n}`,national_id_last3:n,class_name:'QALOAD',grade:'الصف الثالث المتوسط'};});
await check('bulk_import_140_students',async()=>{const d=must(await teacher('teacher_students_bulk_import',{students:loadStudents}),'bulk_import');if(Number(d.added||0)+Number(d.updated||0)+Number(d.restored||0)<140)throw new Error(JSON.stringify(d));return{added:d.added,updated:d.updated,restored:d.restored,failed:d.failed};});

await check('load_140_start_save_finish',async()=>{async function request(body){let first=0,last;const totalStart=performance.now();for(let attempt=1;attempt<=3;attempt++){last=await post(EXAM,body,'',0);if(attempt===1)first=last.status;if(![502,503,504].includes(last.status))return{...last,attempts:attempt,first,totalMs:performance.now()-totalStart};if(attempt<3)await sleep(attempt===1?400:900);}return{...last,attempts:3,first,totalMs:performance.now()-totalStart};}
 const starts=await Promise.all(loadStudents.map((s,i)=>request({action:'assessment_start',code:loadTest.pub.short_code,session_id:`load-${run}-${i}`,student_name:s.full_name,student_no:s.national_id_last3,class_name:s.class_name})));
 const good=starts.map((r,i)=>({r,s:loadStudents[i],i})).filter(x=>x.r.status===200&&!x.r.data?.error&&x.r.data?.attempt_id);
 const saves=await Promise.all(good.map(async x=>{const qs=flatSections(x.r.data);const answers=Object.fromEntries(qs.map(q=>[q.id,0]));const r=await request({action:'assessment_save',code:loadTest.pub.short_code,session_id:`load-${run}-${x.i}`,attempt_id:x.r.data.attempt_id,access_token:x.r.data.access_token,answers,cursor:0});return{...r,answers,start:x};}));
 const saveGood=saves.filter(x=>x.status===200&&!x.data?.error);
 const finishes=await Promise.all(saveGood.map(x=>request({action:'assessment_finish',code:loadTest.pub.short_code,session_id:`load-${run}-${x.start.i}`,attempt_id:x.start.r.data.attempt_id,access_token:x.start.r.data.access_token,answers:x.answers,cursor:0})));
 const finGood=finishes.filter(x=>x.status===200&&!x.data?.error&&x.data?.submitted===true);
 const metrics={start_success:good.length,save_success:saveGood.length,finish_success:finGood.length,start_retries:starts.filter(x=>x.attempts>1).length,first_503:starts.filter(x=>x.first===503).length,start_p50_ms:Math.round(percentile(starts.map(x=>x.totalMs),.5)),start_p95_ms:Math.round(percentile(starts.map(x=>x.totalMs),.95)),save_p95_ms:Math.round(percentile(saves.map(x=>x.totalMs),.95)),finish_p95_ms:Math.round(percentile(finishes.map(x=>x.totalMs),.95))};state.loadMetrics=metrics;if(good.length!==140||saveGood.length!==140||finGood.length!==140)throw new Error(JSON.stringify(metrics));return metrics;});

await check('selected_test_bulk_clear',async()=>{const r=must(await post(RESULTS,{action:'teacher_tests_bulk_clear',test_ids:[loadTest.pub.id],clear_all:false,confirm_word:'مسح النتائج'}),'bulk_clear');return r;});

await check('roster_participation_source',async()=>{const d=must(await teacher('teacher_students_list',{include_archived:false}),'roster');const classA=d.students.filter(s=>s.class_name==='أ').length,qaload=d.students.filter(s=>s.class_name==='QALOAD').length,qatest=d.students.filter(s=>s.class_name==='QATEST').length;if(qaload!==140||qatest<1)throw new Error(`A=${classA},QALOAD=${qaload},QATEST=${qatest}`);state.classACount=classA;state.activeRosterDuringQA=d.students.length;return{total:d.students.length,classA,qaload,qatest};});

await check('participation_live_script_contract',async()=>{const text=await (await fetch(SITE+'analysis-participation.js')).text();for(const token of ['teacher_students_list','الطلاب المختبرون','rosterCount','beforeprint'])if(!text.includes(token))throw new Error(`missing ${token}`);return'participation script live and linked';});

fs.writeFileSync('/tmp/qa-state.json',JSON.stringify(state,null,2));
fs.writeFileSync('/tmp/qa-api-result.json',JSON.stringify({checks,failures,state},null,2));
console.log('API_ACCEPTANCE_SUMMARY',JSON.stringify({passed:checks.filter(x=>x.ok).length,failed:failures.length,failures,load:state.loadMetrics}));
