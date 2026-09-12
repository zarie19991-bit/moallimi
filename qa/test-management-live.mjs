const SITE='https://zarie19991-bit.github.io/moallimi/';
const ADMIN='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-test-admin';
const EXAM='https://udznpifopbnrcgxtpzza.supabase.co/functions/v1/nafes-exam';
const KEY=process.env.QA_TEACHER_KEY;
const TEST_ID=process.env.QA_TEST_ID;
const CODE=process.env.QA_TEST_CODE;
if(!KEY||!TEST_ID||!CODE)throw new Error('missing QA env');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function post(url,body,key=KEY){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(key?{'x-teacher-key':key}:{})},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));return{status:r.status,data:d};}
function ok(r,label){if(r.status!==200||r.data?.error)throw new Error(`${label}: ${r.status} ${r.data?.error||JSON.stringify(r.data)}`);return r.data;}
let live=false;for(let i=0;i<24;i++){const html=await (await fetch(SITE+'create.html?qa='+Date.now(),{cache:'no-store'})).text();if(html.includes('test-management.js?v=20260912-1')){const js=await (await fetch(SITE+'test-management.js?qa='+Date.now(),{cache:'no-store'})).text();if(js.includes('data-manage-schedule')&&js.includes('data-manage-delete')){live=true;break;}}await sleep(5000);}if(!live)throw new Error('published create page does not include management controls');console.log('PASS live management assets');
const list1=ok(await post(ADMIN,{action:'list'}),'list initial');if(!list1.tests.some(t=>t.id===TEST_ID))throw new Error('QA test missing from admin list');console.log('PASS list');
const opens=new Date(Date.now()+3600_000).toISOString();const closes=new Date(Date.now()+7200_000).toISOString();const updated=ok(await post(ADMIN,{action:'update_schedule',test_id:TEST_ID,opens_at:opens,closes_at:closes}),'update schedule');if(updated.test.opens_at!==opens||updated.test.closes_at!==closes)throw new Error('schedule values not persisted');console.log('PASS update schedule',updated.test.opens_at,updated.test.closes_at);
const infoBefore=ok(await post(EXAM,{action:'assessment_info',code:CODE},''),'assessment info before delete');if(infoBefore.id!==TEST_ID)throw new Error('student link not resolving before archive');console.log('PASS student link before delete');
const archived=ok(await post(ADMIN,{action:'archive',test_id:TEST_ID,confirm_word:'حذف'}),'archive');if(!archived.results_preserved)throw new Error('archive did not confirm result preservation');console.log('PASS archive');
const list2=ok(await post(ADMIN,{action:'list'}),'list after archive');if(list2.tests.some(t=>t.id===TEST_ID))throw new Error('archived test still shown');console.log('PASS removed from list');
const infoAfter=await post(EXAM,{action:'assessment_info',code:CODE},'');if(infoAfter.status!==404)throw new Error(`student link still active after archive: ${infoAfter.status}`);console.log('PASS student link disabled');
console.log('TEST_MANAGEMENT_ACCEPTANCE_OK');
