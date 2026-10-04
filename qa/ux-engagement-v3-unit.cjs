const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const student=fs.readFileSync(path.join(root,'lugati-student-adaptive.js'),'utf8');
const complete=fs.readFileSync(path.join(root,'lugati-complete.js'),'utf8');
const css=fs.readFileSync(path.join(root,'tamakkun-ux-v3.css'),'utf8');
const html=fs.readFileSync(path.join(root,'lugati-student.html'),'utf8');
const loginHtml=fs.readFileSync(path.join(root,'lugati-complete.html'),'utf8');
const api=fs.readFileSync(path.join(root,'supabase/functions/lugati-adaptive-plan/index.ts'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261004111500_lugati_ux_events.sql'),'utf8');
const production=fs.readFileSync(path.join(root,'production-files.txt'),'utf8');

assert.doesNotMatch(student,/function home\(\)/);
assert.doesNotMatch(student,/function progress\(\)/);
assert.match(student,/\['journeys','الرحلات'/);
assert.match(student,/\['remedial','العلاج'/);
assert.match(student,/\['growth','تعزيز وإثراء'/);
assert.match(student,/\['competition','المسابقات'/);

assert.match(student,/studentTaskStats/);
assert.match(student,/completionStreak/);
assert.match(student,/studentBadges/);
assert.match(student,/recommendedStudentAction/);
assert.match(student,/studentTodayPulse/);
assert.match(student,/studentNextAction/);
assert.match(student,/studentSubjectPulse/);
assert.match(student,/tamakkun_student_onboarding_v3/);
assert.match(student,/بداية قوية/);
assert.match(student,/مثابر/);
assert.match(student,/متقن/);
assert.match(student,/student_workspace_view/);
assert.match(student,/student_task_start/);
assert.match(student,/student_task_complete/);
assert.match(student,/student_onboarding_complete/);
assert.match(student,/goStudentTab/);

assert.match(complete,/tx-login-shell/);
assert.match(complete,/id="loginForm"/);
assert.match(complete,/ابدأ مساري/);
assert.match(complete,/دخول تجريبي للمعاينة/);
assert.match(complete,/trackUxEvent\('login_success'/);
assert.match(complete,/keepalive:true/);

assert.match(css,/\.txv3-hero/);
assert.match(css,/\.txv3-next/);
assert.match(css,/\.txv3-onboard/);
assert.match(css,/\.tx-login-shell/);
assert.match(css,/@media\(max-width:900px\)/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(html,/tamakkun-ux-v3\.css/);
assert.match(loginHtml,/tamakkun-ux-v3\.css/);
assert.match(production,/tamakkun-ux-v3\.css/);

assert.match(api,/async function uxEvent/);
assert.match(api,/lugati_ux_events/);
for(const event of ['login_success','student_workspace_view','student_section_open','student_task_start','student_task_complete','student_onboarding_complete','student_journey_open','teacher_dashboard_view'])assert.match(api,new RegExp(event));

assert.match(migration,/create table if not exists public\.lugati_ux_events/);
assert.match(migration,/enable row level security/);
assert.match(migration,/grant select,insert,delete .*service_role/);
assert.doesNotMatch(migration,/full_name/);
assert.doesNotMatch(migration,/question_text/);
assert.doesNotMatch(migration,/answers/);

console.log('PASS: UX v3 daily dashboard, simplified login, real-achievement gamification, responsive onboarding and privacy-minimal measurement.');
