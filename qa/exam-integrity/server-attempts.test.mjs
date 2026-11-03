// Runs the REAL supabase/functions/nafes-exam/assessments.ts against an in-memory DB.
// Separates a legitimate resume (same student) from cross-student / cross-attempt leakage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build, STUDENTS } from './fixtures.mjs';
import { recoveryPatch } from '../../supabase/functions/nafes-exam/assessments.ts';

const { ali, omar } = STUDENTS;
const auth = (r, session) => ({ session_id: session, attempt_id: r.attempt_id, access_token: r.access_token });
const save = (t, r, session, answers, extra = {}) => t.call({ action: 'assessment_save', ...auth(r, session), answers, cursor: 0, expected_section: 0, ...extra });

test('RESUME (legit): same student re-entering keeps the same attempt and every saved answer', async () => {
  const t = build();
  const first = (await t.start(ali, 'S1')).data;
  assert.equal((await save(t, first, 'S1', { q1: 2, q2: 1 })).ok, true);
  const again = await t.start(ali, 'S1');
  assert.equal(again.ok, true);
  assert.equal(again.data.attempt_id, first.attempt_id);
  assert.equal(again.data.resumed, true);
  assert.deepEqual(again.data.answers, { q1: 2, q2: 1 });
  assert.notEqual(again.data.access_token, first.access_token);
  assert.equal((await save(t, first, 'S1', { q3: 0 })).status, 403, 'superseded token must stop working');
});

test('RESUME (legit): a browser restart that keeps the same session id resumes at once, answers intact', async () => {
  const t = build({ lock_session: true });
  const first = (await t.start(ali, 'SAME-BROWSER')).data;
  await save(t, first, 'SAME-BROWSER', { q1: 3 });
  const again = await t.start(ali, 'SAME-BROWSER');
  assert.equal(again.ok, true);
  assert.deepEqual(again.data.answers, { q1: 3 });
});

test('MIXING: two students sharing one browser session id get separate attempts and answers', async () => {
  const t = build();
  const a = (await t.start(ali, 'SHARED-DEVICE')).data;
  await save(t, a, 'SHARED-DEVICE', { q1: 2, q2: 2 });
  const o = (await t.start(omar, 'SHARED-DEVICE')).data;
  assert.notEqual(o.attempt_id, a.attempt_id);
  assert.deepEqual(o.answers, {}, "omar must not receive ali's answers");
  assert.equal(o.student_name, omar.full_name);
  await save(t, o, 'SHARED-DEVICE', { q1: 0 });
  const rows = t.db.tables.nafes_assessment_attempts;
  assert.deepEqual(rows.find(r => r.id === a.attempt_id).answers, { q1: 2, q2: 2 });
  assert.deepEqual(rows.find(r => r.id === o.attempt_id).answers, { q1: 0 });
});

test('MIXING: a token never opens or writes another attempt', async () => {
  const t = build();
  const a = (await t.start(ali, 'S1')).data, o = (await t.start(omar, 'S2')).data;
  const cross = await save(t, { attempt_id: a.attempt_id, access_token: o.access_token }, 'S2', { q1: 1 });
  assert.equal(cross.ok, false); assert.equal(cross.status, 403);
  const peek = await t.call({ action: 'assessment_resume', session_id: 'S2', attempt_id: a.attempt_id, access_token: o.access_token });
  assert.equal(peek.status, 403);
  assert.deepEqual(t.db.tables.nafes_assessment_attempts.find(r => r.id === a.attempt_id).answers, {});
});

test('MIXING: answers posted for question ids that are not in the attempt are dropped', async () => {
  const t = build();
  const a = (await t.start(ali, 'S1')).data;
  const r = await save(t, a, 'S1', { q1: 1, 'foreign-q': 3 });
  assert.deepEqual(r.data.answers, { q1: 1 });
});

test('IDENTITY: verification is unchanged (wrong digits / wrong name / wrong class are refused)', async () => {
  const t = build();
  assert.equal((await t.start({ ...ali, national_id_last3: '999' }, 'S1')).ok, false);
  assert.equal((await t.start({ ...ali, national_id_last3: omar.national_id_last3 }, 'S1')).ok, false);
  assert.equal((await t.start({ ...ali, class_name: 'ب' }, 'S1')).ok, false);
  assert.equal((await t.start(ali, 'S1')).ok, true);
});

test('RETAKE: a new attempt starts empty even though the earlier attempt used the same question ids', async () => {
  const t = build({ attempts: 2 });
  const a1 = (await t.start(ali, 'S1')).data;
  await save(t, a1, 'S1', { q1: 2, q2: 2, q3: 2, q4: 2 });
  assert.equal((await t.call({ action: 'assessment_finish', ...auth(a1, 'S1'), answers: { q1: 2 }, cursor: 0, expected_section: 0 })).data.submitted, true);
  const again = await t.start(ali, 'S1');
  assert.equal(again.data.completed_before, true, 'without a grant the student only sees the completed result');
  const forced = await t.call({ action: 'assessment_start', session_id: 'S1', student_name: ali.full_name, student_no: ali.national_id_last3, class_name: ali.class_name, start_new_attempt: true });
  assert.equal(forced.ok, true);
  assert.notEqual(forced.data.attempt_id, a1.attempt_id);
  assert.deepEqual(forced.data.answers, {});
});

test('REOPEN: after a teacher reopens an incomplete attempt the old token is dead; identity re-entry resumes with answers kept', async () => {
  const t = build({ sections: 2 });
  const a = (await t.start(ali, 'S1')).data;
  await save(t, a, 'S1', { q1: 1, q2: 2, q3: 3, q4: 0 });
  await t.call({ action: 'assessment_advance', ...auth(a, 'S1'), answers: {}, cursor: 0, expected_section: 0 });
  assert.equal((await t.call({ action: 'assessment_finish', ...auth(a, 'S1'), answers: {}, cursor: 0, expected_section: 1 })).data.submitted, true);
  const row = t.db.tables.nafes_assessment_attempts[0];
  Object.assign(row, recoveryPatch(row), { access_hash: 'rotated-by-teacher' });   // what teacherReopenIncomplete writes
  assert.equal((await t.call({ action: 'assessment_resume', ...auth(a, 'S1') })).status, 403);
  const back = await t.start(ali, 'S1');
  assert.equal(back.ok, true); assert.equal(back.data.recovery_resumed, true);
  assert.deepEqual(back.data.answers, { q1: 1, q2: 2, q3: 3, q4: 0 });
});
