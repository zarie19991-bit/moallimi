import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectReviewedBank, hasCurrentReview, publicReviewedQuestions, reviewedImage, itemContentKey } from '../../supabase/functions/nafes-exam/reviewed-bank.ts';

const focus='vocab_definition';
const indicator='يستنتج التعريفات لمصطلحات جديدة وردت في النص المقروء.';
function rows() {
  return Array.from({length:15},(_,i)=> {
    const options=['اختيار أول','اختيار ثان','اختيار ثالث','اختيار رابع'];
    const correct=i%4;
    const q={id:`fixture-${i}`,indicator_text:indicator,measurement_focus:focus,
      alignment_profile:`${focus}:reviewed-v4`,alignment_verified:true,
      context_text:`نص الفحص ${i}`,question_text:`سؤال الفحص ${i}`,options,correct_index:correct,
      explanation:'تعليل اختباري محفوظ.',difficulty:'medium',cognitive_level:'application',question_no:i+1,model_no:1};
    q.alignment_evidence={validator:'question-review-v4',indicator_text:indicator,measurement_focus:focus,
      source_task:q.question_text,source_context:q.context_text,source_options:options.slice(),source_answer:options[correct],
      explanation:q.explanation,target_aspect:'استخلاص تعريف من مثال',content_sha256:'a'.repeat(64),
      checks:{indicator_alignment:true,single_answer:true,distractors:true,independence:true,grade9_level:true}};
    return q;
  });
}
test('keeps actual cognitive levels for a narrow indicator',()=>{
  const result=inspectReviewedBank(rows(),indicator,focus,'reading');
  assert.equal(result.ready,true); assert.deepEqual(result.cognitive_distribution,{knowledge:0,application:15,reasoning:0});
});
test('rejects altered keys, options, passages, and explanations after review',()=>{
  for(const [key,value] of [['correct_index',2],['options',['x','y','z','w']],['context_text','different'],['explanation','different']]){
    const q=rows()[0];q[key]=value;assert.equal(hasCurrentReview(q),false,key);
  }
});
test('rejects a wrong indicator and a missing review',()=>{
  const set=rows(); set[4].indicator_text='مؤشر آخر';set[7].alignment_evidence.checks.single_answer=false;
  const audit=inspectReviewedBank(set,indicator,focus,'reading');
  assert.equal(audit.ready,false);assert.ok(audit.issues.includes('indicator_mismatch'));assert.ok(audit.issues.includes('item_review_mismatch'));
});
test('detects duplicate complete tasks and missing image dependencies',()=>{
  const set=rows();set[1].question_text=set[0].question_text;set[1].context_text=set[0].context_text;
  set[2].alignment_evidence.requires_image=true;
  const audit=inspectReviewedBank(set,indicator,focus,'reading');
  assert.ok(audit.issues.includes('duplicate_question'));assert.ok(audit.issues.includes('missing_image'));
});
test('allows distinct diagrams while rejecting unsafe image URLs',()=>{
  const q=rows()[0],other=structuredClone(q);
  q.alignment_evidence.image={url:`https://zarie19991-bit.github.io/moallimi/question-bank/assets/${'a'.repeat(64)}.png`,alt:'معطيات الشكل'};
  other.alignment_evidence.image={url:`https://zarie19991-bit.github.io/moallimi/question-bank/assets/${'b'.repeat(64)}.png`,alt:'معطيات أخرى'};
  assert.notEqual(itemContentKey(q),itemContentKey(other));assert.ok(reviewedImage(q));
  q.alignment_evidence.image.url='javascript:alert(1)';assert.equal(reviewedImage(q),null);
});
test('student payload contains no answer key, explanation, or review evidence',()=>{
  const item={id:'id',context:'نص',question:'سؤال',options:['a','b','c','d'],image:{url:'diagram',alt:'data'},correctIndex:2,explanation:'secret',alignment_evidence:{source_answer:'c'}};
  const [shown]=publicReviewedQuestions([item]);
  assert.deepEqual(Object.keys(shown).sort(),['context','id','image','options','question']);assert.equal(shown.image.alt,'data');
});
test('distinguishes candidate data but detects an option-order-only duplicate',()=>{
  const q=rows()[0],other=structuredClone(q);
  q.question_text=other.question_text='أي مجموعة أطوال تحقق شرط المثلث القائم؟';
  q.options=['3، 4، 5','3، 4، 6','3، 4، 4','3، 4، 7'];
  other.options=['5، 12، 13','5، 12، 14','5، 12، 12','5، 12، 15'];
  assert.notEqual(itemContentKey(q),itemContentKey(other));
  other.options=[...q.options].reverse();
  assert.equal(itemContentKey(q),itemContentKey(other));
});
