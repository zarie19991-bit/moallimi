import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const load=name=>JSON.parse(fs.readFileSync(new URL('../../question-bank/patches/'+name,import.meta.url),'utf8')).questions;
const items=[
 ...load('science-biodiversity-application-20261013.json'),
 ...load('science-biodiversity-knowledge-reasoning-20261013.json')
];
const normalized=s=>s.normalize('NFKC').replace(/[\u064B-\u0652\u0670\u0640]/g,'').replace(/[؟?!.،,:؛;'"“”‘’()\[\]{}\-–—_/\\]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const rejected=/(ظهرت المهمة|اختيرت الإجابة|لزم التحقق من|لزم حل المهمة|أي خيار يطبق المفهوم تطبيقًا صحيحًا|ما الإجابة التي تنقل مفهوم|في (?:مقارنة كائنين أو خليتين|تحليل تغير في نظام حيوي|تقويم إجراء صحي أو بيئي) بهدف)/;
test('all patched questions carry unique meaningful scientific stems and one keyed answer',()=>{
 assert.equal(items.length,40);
 assert.equal(new Set(items.map(q=>normalized(q.question_text))).size,items.length);
 assert.equal(new Set(items.map(q=>q.source_id)).size,items.length);
 for(const q of items){
  assert.ok(['knowledge','application','reasoning'].includes(q.cognitive_level));
  assert.ok(q.question_text.length>=55);
  assert.doesNotMatch(q.question_text,rejected);
  assert.equal(q.options.length,4);
  assert.equal(new Set(q.options.map(normalized)).size,4);
  assert.ok(Number.isInteger(q.correct_index)&&q.correct_index>=0&&q.correct_index<4);
  assert.ok(q.explanation.length>=32);
  assert.ok(['easy','medium','hard'].includes(q.difficulty));
 }
});
test('cognitive-level coverage for 15-question science selection and both fixed models',()=>{
 const perLevel=l=>items.filter(q=>q.cognitive_level===l);
 assert.equal(perLevel('application').length,24);
 assert.equal(perLevel('knowledge').length,8);
 assert.equal(perLevel('reasoning').length,8);
 for(const model of [1,2]){
  assert.ok(perLevel('knowledge').filter(q=>q.model_no===model).length>=3);
  assert.ok(perLevel('application').filter(q=>q.model_no===model).length>=7);
  assert.ok(perLevel('reasoning').filter(q=>q.model_no===model).length>=4);
 }
 const app=perLevel('application');
 assert.deepEqual([0,1,2,3].map(i=>app.filter(q=>q.correct_index===i).length),[6,6,6,6]);
});
