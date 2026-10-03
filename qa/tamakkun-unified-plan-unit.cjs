const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'..');

const ui=fs.readFileSync(path.join(root,'tamakkun-unified-plan.js'),'utf8');
assert.match(ui,/student_unified_plan/);
assert.match(ui,/teacher_unified_plan/);
assert.match(ui,/window\.print\(\)/);
assert.match(fs.readFileSync(path.join(root,'lugati-dashboard.html'),'utf8'),/data-tamakkun-unified-plan/);
assert.match(fs.readFileSync(path.join(root,'lugati-student.html'),'utf8'),/tamakkun-unified-plan\.js/);
for(const html of ['lugati-dashboard.html','lugati-student.html','lugati-complete.html']){
  const text=fs.readFileSync(path.join(root,html),'utf8');
  assert.ok(!text.includes('\\\\n'), html+' must not contain literal \\n markup escapes');
}
assert.match(fs.readFileSync(path.join(root,'tamakkun-unified-plan.css'),'utf8'),/print-color-adjust:exact/);
assert.match(fs.readFileSync(path.join(root,'tamakkun-unified-plan.css'),'utf8'),/:focus-visible/);

const source=fs.readFileSync(path.join(root,'supabase/functions/lugati-adaptive-plan/index.ts'),'utf8');
assert.match(source,/g\.correct\+=Number\(p\.correct\|\|0\)/);
assert.match(source,/diagnostic_percent:weighted/);
assert.match(source,/teacher_unified_overview/);
assert.match(source,/teacher_unified_sources/);
assert.match(source,/assessmentPlanSources/);
assert.match(source,/source_key/);
assert.match(source,/planQuestionGroups/);
assert.match(source,/kind","multi_indicator"/);
assert.match(ui,/teacher_unified_sources/);
assert.match(ui,/tupSource/);
assert.match(ui,/questions_per_indicator:3/);
const js=stripTypeScriptTypes(source,{mode:'strip'}).replace(/^import .*;\s*$/gm,'');
const context={createClient:()=>({}),Deno:{env:{get:()=>'',},serve:()=>{}},console,Response:function(){},crypto:{subtle:{digest:async()=>new ArrayBuffer(32)}},TextEncoder};
vm.createContext(context);
vm.runInContext(js+';globalThis.check={tierFor,unifiedRows,unifiedSummary};',context);
const check=context.check;
assert.equal(check.tierFor(69.9),'remedial');
assert.equal(check.tierFor(70),'reinforcement');
assert.equal(check.tierFor(89.9),'reinforcement');
assert.equal(check.tierFor(90),'enrichment');
const sample=[
 {subject_key:'math',outcome_code:'M1',indicator_index:1,indicator_text:'حل المسألة',diagnostic_percent:62,percent:62,latest_percent:80,previous_percent:55,best_percent:80,trend_points:25,evidence_count:3,total:12,source_submitted_at:'2026-10-03T10:00:00Z'},
 {subject_key:'science',outcome_code:'S1',indicator_index:2,indicator_text:'تفسير التجربة',diagnostic_percent:78,percent:78,latest_percent:85,previous_percent:70,best_percent:85,trend_points:15,evidence_count:2,total:8,source_submitted_at:'2026-10-03T10:00:00Z'},
 {subject_key:'science',outcome_code:'S2',indicator_index:3,indicator_text:'الاستدلال العلمي',diagnostic_percent:94,percent:94,latest_percent:96,previous_percent:92,best_percent:96,trend_points:4,evidence_count:2,total:8,source_submitted_at:'2026-10-03T10:00:00Z'},
 {subject_key:'reading',outcome_code:'R1',indicator_index:4,indicator_text:'قراءة',diagnostic_percent:40,percent:40,latest_percent:40,evidence_count:1,total:4}
];
const rows=check.unifiedRows(sample,'all');
assert.equal(rows.length,3);
assert.deepEqual(Array.from(rows,r=>r.tier),['remedial','reinforcement','enrichment']);
assert.match(rows[0].action,/حل المسألة/);
assert.match(rows[1].action,/تفسير التجربة/);
const summary=check.unifiedSummary(rows);
assert.equal(summary.remedial,1);assert.equal(summary.reinforcement,1);assert.equal(summary.enrichment,1);assert.equal(summary.measurements,7);
console.log('PASS: Tamakkun plan is scoped to selected Moallimi multi-indicator assessment, with exact-indicator question groups and print UI.');
