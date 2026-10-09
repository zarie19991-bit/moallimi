import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'omr-private-audit-synthetic-'));
const categories=['normal','rotation','perspective','low_contrast','blank','multiple','ambiguous','marker_failure'];
const fake=()=>{
 const sheets=[];
 for(const category of categories)for(let i=0;i<5;i++){
   const fail=category==='marker_failure';
   const key=category==='multiple'?'multiple':category==='blank'?'blank':category==='ambiguous'?'ambiguous':1;
   sheets.push({category,reader_failed:fail,marker_verified:!fail,displayed_score:fail?null:category==='normal'?0:14,
    published:false,expected:Array(60).fill(key),actual:fail?[]:Array(60).fill(key),
    manual_reference_verified:true,independently_reviewed:true});
 }
 return{reviewer_approval:true,sheets};
};
const run=(name,mutate,expectPass)=>{
 const data=fake();mutate(data);
 const file=join(dir,name+'.json');writeFileSync(file,JSON.stringify(data));
 const p=spawnSync(process.execPath,['qa/omr/acceptance-audit.mjs'],{
 env:{...process.env,OMR_AUDIT_INPUT:file},encoding:'utf8'});
 assert.equal(p.status,expectPass?0:2,name+': expected '+(expectPass?'accepted':'blocked')+'; output '+p.stdout+' '+p.stderr);
 console.log('PASS '+name);
};
try{
 run('synthetic_complete_representation',()=>{},true);
 run('reject_false_zero_when_markers_fail',d=>{d.sheets.find(s=>s.category==='marker_failure').displayed_score=0},false);
 run('reject_wrong_answers_below_99pct',d=>{const x=d.sheets.find(s=>s.category==='normal');x.actual=Array(60).fill(2)},false);
 run('reject_unlabeled_ground_truth',d=>{d.sheets[0].independently_reviewed=false},false);
 run('reject_missing_reviewer_approval',d=>{d.reviewer_approval=false},false);
 run('reject_failed_scan_published',d=>{d.sheets.find(s=>s.category==='marker_failure').published=true},false);
 const blank=spawnSync(process.execPath,['qa/omr/acceptance-audit.mjs'],{env:{...process.env,OMR_AUDIT_INPUT:''},encoding:'utf8'});
 assert.equal(blank.status,3);console.log('PASS reject_missing_real_dataset');
 console.log('OMR_ACCEPTANCE_GATE_TEST_PASS');
}finally{rmSync(dir,{recursive:true,force:true})}
