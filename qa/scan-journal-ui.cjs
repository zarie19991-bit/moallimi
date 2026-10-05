const {chromium}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.OMR_CHROMIUM_PATH?{executablePath:process.env.OMR_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--no-zygote','--single-process']}: {})});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let html=fs.readFileSync('review-scan.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]*>/g,'');
 await page.route("https://omr.test/",route=>route.fulfill({contentType:"text/html",body:html}));await page.goto("https://omr.test/");await page.addStyleTag({content:fs.readFileSync('review-scan.css','utf8')});
 await page.evaluate(()=>{
 const answers=[{question:1,state:'blank',status:'blank',selected:null,marked:[],confidence:.99},{question:2,state:'multiple',status:'multiple',selected:0,marked:[0,1],confidence:.4},{question:3,state:'correct',status:'clear',selected:0,marked:[0],confidence:.99},{question:4,state:'incorrect',status:'clear',selected:1,marked:[1],confidence:.99},{question:5,state:'uncertain',status:'ambiguous',selected:0,marked:[0],confidence:.5}];
 const snap={student_name:'طالب تجريبي',model:'A',score:1,total:5,identity_valid:true,markers_ok:true,counts:{blank:1,multiple:1,correct:1,incorrect:1,uncertain:1},answers};
 const session={id:'session',expected_count:2,created_at:new Date().toISOString()};
 const sheets=[{id:'sheet1',ordinal:1,snapshot:snap,uploaded_at:new Date().toISOString()},{id:'sheet2',ordinal:2,snapshot:snap,uploaded_at:new Date().toISOString(),duplicate_of:'sheet1',blocked_duplicate:true}];
 window.fixture={sheets,session,calls:[],edits:[]};
 window.NafesTeacher={api:async(action,b)=>{window.fixture.calls.push({action,b});if(action==='teacher_scan_sessions')return {sessions:[session]};if(action==='teacher_scan_alerts')return {alerts:[],next_cursor:null};if(action==='teacher_scan_list')return {session,sheets:structuredClone(sheets)};if(action==='teacher_scan_image'){const c=document.createElement('canvas');c.width=100;c.height=100;return {image_data:c.toDataURL('image/jpeg')};}if(action==='teacher_scan_edit_answer'){
 const s=sheets.find(s=>s.id===b.sheet_id),x=structuredClone(s.effective_snapshot||s.snapshot),before=structuredClone(x.answers[b.question-1]);
 const a=x.answers[b.question-1];a.marked=b.marked;a.selected=b.marked.length===1?b.marked[0]:null;a.state=b.marked.length===0?'blank':b.marked.length>1?'multiple':b.marked[0]===0?'correct':'incorrect';a.status=a.state==='blank'?'blank':a.state==='multiple'?'multiple':'clear';a.reviewed_manually=true;
 x.counts={blank:0,multiple:0,correct:0,incorrect:0,uncertain:0};for(const q of x.answers)x.counts[q.state]++;x.score=x.counts.correct;s.effective_snapshot=x;s.answer_version=(s.answer_version||0)+1;s.reviewed_at=null;s.disposition=null;
 window.fixture.edits.push({question:b.question,before_answer:before,after_answer:structuredClone(a),reviewer_id:'test-reviewer',created_at:new Date().toISOString(),answer_version:s.answer_version});return {sheet:structuredClone(s)};}
 if(action==='teacher_scan_edit_history')return {edits:window.fixture.edits,next_cursor:null};
 if(action==='teacher_scan_verify'){const s=sheets.find(s=>s.id===b.sheet_id);s.reviewed_at=new Date().toISOString();s.disposition=s.duplicate_of?'duplicate':'requires_rescan';return {sheet:structuredClone(s)};}if(action==='teacher_scan_finish'){session.completed_at=new Date().toISOString();return {session};}throw Error(action);}};
 });
 await page.addScriptTag({content:fs.readFileSync('review-scan-journal.js','utf8')});await page.evaluate(()=>NafesScanJournal.init({review_id:'RTEST'}));
 await page.selectOption('#sessionPicker','session');await page.click('#resumeSessionBtn');await page.click('[data-open="1"]');
 await page.waitForFunction(()=>document.querySelector('#scanImage').complete&&document.querySelector('#scanImage').naturalWidth>0);
 assert.match(await page.locator('#modalSub').innerText(),/١ من ٢/,'cannot skip first');
 assert.equal(await page.locator('#answerEditor button[data-edit-question]').count(),25,'all five questions are editable');
 for(const c of ['blank','multiple','correct','incorrect','uncertain'])assert.equal(await page.locator('.answer-row-edit.state-'+c).count(),1);
 assert.equal(await page.locator('#nextSheetBtn').isDisabled(),true);
 await page.click('[data-edit-question="1"][data-choice="0"]');await page.waitForFunction(()=>window.fixture.sheets[0].answer_version===1);await page.waitForFunction(()=>document.querySelector('[data-edit-question="1"]').disabled===false);
 assert.equal(await page.locator('.answer-row-edit.state-correct').count(),2,'blank becomes green');
 assert.equal(await page.evaluate(()=>window.fixture.sheets[0].snapshot.answers[0].state),'blank','original unchanged');
 await page.click('[data-edit-question="3"][data-choice="1"]');await page.waitForFunction(()=>window.fixture.sheets[0].answer_version===2);await page.waitForFunction(()=>document.querySelector('[data-edit-question="1"]').disabled===false);
 assert.equal(await page.locator('.answer-row-edit.state-incorrect').count(),2,'correct answers can be changed');
 await page.check('#editMode');await page.click('[data-edit-question="1"][data-choice="1"]');await page.waitForFunction(()=>window.fixture.sheets[0].answer_version===3);await page.waitForFunction(()=>document.querySelector('[data-edit-question="1"]').disabled===false);
 assert.equal(await page.locator('.answer-row-edit.state-multiple').count(),2,'multi marks yellow');await page.uncheck('#editMode');
 await page.click('[data-edit-question="1"][data-choice="blank"]');await page.waitForFunction(()=>window.fixture.sheets[0].answer_version===4);await page.waitForFunction(()=>document.querySelector('[data-edit-question="1"]').disabled===false);
 assert.equal(await page.locator('.answer-row-edit.state-blank').count(),1,'can clear answer');
 await page.check('#verifiedCheck');await page.click('#saveSheetBtn');assert.equal(await page.locator('#nextSheetBtn').isEnabled(),true);
 await page.click('[data-edit-question="1"][data-choice="0"]');await page.waitForFunction(()=>window.fixture.sheets[0].answer_version===5);await page.waitForFunction(()=>document.querySelector('[data-edit-question="1"]').disabled===false);
 assert.equal(await page.locator('#nextSheetBtn').isDisabled(),true,'edit invalidates previous verification');
 await page.check('#verifiedCheck');await page.click('#saveSheetBtn');
 await page.click('#nextSheetBtn');await page.waitForFunction(()=>document.querySelector('#scanImage').naturalWidth>0);await page.check('#verifiedCheck');assert.equal(await page.locator('#saveSheetBtn').isDisabled(),true,'duplicate acknowledgment mandatory');await page.check('#duplicateCheck');await page.click('#saveSheetBtn');assert.equal(await page.locator('#finishReviewBtn').isEnabled(),true);
 await page.screenshot({path:'/workspace/scratch/1cf253576288/review-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/workspace/scratch/1cf253576288/review-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'no horizontal page overflow');
 await page.click('#finishReviewBtn');assert.equal(await page.locator('#sheetModal').isHidden(),true);assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: editable UI, original preservation, live colors/score, blank and multiple, verification reset, no skipping, duplicate acknowledgement, next, finish and mobile.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
