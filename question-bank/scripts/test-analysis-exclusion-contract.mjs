import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../../' + file, import.meta.url), 'utf8');

test('analysis roster requests only eligible students', () => {
  const source = read('analysis-data-service.js');
  assert.match(source, /analysis_only\s*:\s*true/);
});

test('student analysis exclusion UI supports manual and bulk controls', () => {
  const source = read('student-analysis-exclusion.js');
  assert.match(source, /teacher_student_analysis_exclusion/);
  assert.match(source, /teacher_students_analysis_exclusion_bulk/);
  assert.match(source, /teacher_analysis_exclusion_audit/);
  assert.match(source, /\.xlsx,\.csv/);
  assert.match(source, /معرف الطالب/);
  assert.match(source, /استبعاد من التحليل/);
});

test('subject teacher labels are loaded from the backend mapping', () => {
  const source = read('subject-teacher-names.js');
  assert.match(source, /teacher_subject_teachers/);
  assert.match(source, /data\?\.primary/);
});

test('teacher access caches and scopes subject-teacher directory reads', () => {
  const source = read('teacher-access.js');
  assert.match(source, /READ_ACTIONS[^\n]+teacher_subject_teachers/);
  assert.match(source, /action === 'teacher_subject_teachers'/);
});

test('production manifest publishes the exclusion UI', () => {
  const manifest = read('production-files.txt');
  assert.match(manifest, /^student-analysis-exclusion\.js$/m);
});
