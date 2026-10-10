import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';

const code=readFileSync('review-scan-name-ocr.js','utf8');
const page=readFileSync('review-scan.html','utf8');
const journal=readFileSync('review-scan-journal.js','utf8');
const sandbox={window:{}};
runInNewContext(code,sandbox);
const {normalizeName,matchCandidate,proposals}=sandbox.window.NafesPrintedNameOCR;
const roster=[
 {student_id:'1',student_name:'فهد إبراهيم محمد آل شيطه',model:'ب'},
 {student_id:'2',student_name:'محمد علي حسن القحطاني',model:'ج'},
 {student_id:'3',student_name:'محمد إبراهيم صالح آل عباس',model:'هـ'},
 {student_id:'4',student_name:'فهد محمد عبدالله الشهري',model:'أ'}
];
test('Arabic hamzas, tatweel, punctuation and taa marbuta normalize for roster matching',()=>{
 assert.equal(normalizeName('فَهد إِبـراهيم مُحمّد آل شيطَة'),normalizeName('فهد ابراهيم محمد ال شيطه'));
 assert.equal(normalizeName('صَالِح بن عَلِي'),'صالح بن علي');
 assert.equal(normalizeName('أَبْهَى'),'ابهي');
});
test('OCR names match only consecutive lines/words, not common first names alone',()=>{
 const line='اسم الطالب : فهد ابراهيم محمد ال شيطه الفصل الثالث';
 const r=proposals(line,roster);
 assert.equal(r.matches[0]?.student_id,'1');
 assert(r.matches[0].score>=.82);
 assert.equal(r.unique,true);
 assert.equal(proposals('اسم الطالب محمد',roster).matches.length,0);
 assert.equal(proposals('اسم الطالب ورقة التظليل نموذج',roster).matches.length,0);
 assert.equal(matchCandidate('محمد علي حسن القحطاني',roster[1].student_name).score,1);
});
test('already-linked student identities must not be offered again',()=>{
 const found=proposals('فهد ابراهيم محمد ال شيطه',roster,['1']);
 assert(!found.matches.some(a=>a.student_id==='1'));
});
test('neither OCR nor roster suggestions ever invoke the identity or grading API',()=>{
 assert(!code.includes('teacher_scan_assign_identity'));
 assert(!code.includes('teacher_scan_verify'));
 assert(!code.includes('teacher_scan_register'));
 assert(code.includes("T.createWorker('ara'"));
 assert(code.includes('cropH=Math.floor(h*.44)'));
 assert(code.includes('await worker.recognize(canvas)'));
 assert(code.includes('await worker.terminate()'));
 assert(code.includes('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/6.0.1/tesseract.min.js'));
});
test('teacher must explicitly confirm printed name and model to attach original review sheet',()=>{
 assert(page.includes('id="printedNameOcrBtn"'));
 assert(page.includes('id="studentNameSearch"'));
 assert(page.includes('id="printedNameOcrCandidates"'));
 assert(page.includes('review-scan-name-ocr.js?v=20261010-arabic-text-match1'));
 assert(journal.includes('async function readPrintedStudentName()'));
 assert(journal.includes("populateStudentNames(student.student_name,id)"));
 assert(journal.includes("window.NafesPrintedNameOCR.proposals(result.text"));
 assert(journal.includes("const r=await api('teacher_scan_assign_identity'"));
 assert(journal.includes("if(reason.length<3)"));
 assert(!journal.includes("api('teacher_scan_assign_identity',{sheet_id:sheet.id,student_id:found.matches[0]"));
});
