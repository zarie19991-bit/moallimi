const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'tamakkun-teacher-workspace.js'),'utf8');
const css=fs.readFileSync(path.join(root,'tamakkun-teacher-workspace.css'),'utf8');
const app=fs.readFileSync(path.join(root,'lugati-complete.js'),'utf8');
const html=fs.readFileSync(path.join(root,'lugati-complete.html'),'utf8');
const api=fs.readFileSync(path.join(root,'supabase/functions/lugati-adaptive-plan/index.ts'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261003222000_teacher_management_workspace.sql'),'utf8');

assert.match(app,/\['teachers','المعلمون والأعمال','الإنجاز والتقارير','users-round'\]/);
assert.match(app,/viewTeacherWorkspace/);
assert.match(app,/TamakkunTeacherWorkspace\.mount/);
assert.match(html,/tamakkun-teacher-workspace\.css/);
assert.match(html,/tamakkun-teacher-workspace\.js/);

assert.match(ui,/teacher_management_overview/);
assert.match(ui,/teacher_management_report/);
assert.match(ui,/اختيار المعلمين/);
assert.match(ui,/آخر الطلاب الذين أنجزوا/);
assert.match(ui,/غير منجز/);
assert.match(ui,/قيد التنفيذ/);
assert.match(ui,/منجز/);
assert.match(ui,/data-print-teacher/);
assert.match(ui,/data-print-student/);
assert.match(ui,/data-print-task/);
assert.match(ui,/draggable="true"/);
assert.match(ui,/dataTransfer\.getData/);
assert.match(ui,/status:'all'/);
assert.match(ui,/subject:'all'/);

assert.match(css,/@media print/);
assert.match(css,/@page\{size:A4/);
assert.match(css,/print-color-adjust:exact/);
assert.match(css,/tmw-status\.done/);
assert.match(css,/tmw-status\.doing/);
assert.match(css,/tmw-status\.pending/);

assert.match(api,/teacherManagementOverview/);
assert.match(api,/teacherManagementReport/);
assert.match(api,/p_student_id/);
assert.match(api,/teacherScope\(access\)/);

assert.match(migration,/lugati_teacher_management_snapshot/);
assert.match(migration,/lugati_teacher_management_report/);
assert.match(migration,/coalesce\(p_scope,'all'\)='all' or id=p_requester/);
assert.match(migration,/t\.status='completed'/);
assert.match(migration,/t\.status='in_progress'/);
assert.match(migration,/t\.status='assigned'/);
assert.match(migration,/p_student_id is null or t\.student_id=p_student_id/);
assert.match(migration,/grant execute .*service_role/);

console.log('PASS: teacher management workspace navigation, scoped data, status colors, drag selection and A4 reports.');
