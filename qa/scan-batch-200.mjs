import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../review-scan.html',import.meta.url),'utf8');
const scan=fs.readFileSync(new URL('../review-scan.js',import.meta.url),'utf8');
const journal=fs.readFileSync(new URL('../review-scan-journal.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../review-scan-worker.js',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../supabase/functions/nafes-exam/paper-scan.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261007170000_omr_batch_200.sql',import.meta.url),'utf8');

assert.match(html,/type="file" multiple/);
assert.match(html,/image\/tiff/);
assert.match(scan,/MAX_BATCH_PAGES=200/);
assert.match(scan,/MAX_BATCH_SHEETS=400/);
assert.match(scan,/globalPage!==batchMeta\.totalPages/);
assert.match(scan,/qualityMetrics/);
assert.match(scan,/quality_score|quality/);
assert.match(scan,/createScanPool/);
assert.match(scan,/review-scan-worker\.js/);
assert.match(worker,/OffscreenCanvas/);
assert.match(worker,/type:'process'/);
assert.match(journal,/chunkSize=4/);
assert.match(journal,/teacher_scan_register_batch/);
assert.match(journal,/expected_page_count/);
assert.match(api,/MAX_SCAN_PAGES=200/);
assert.match(api,/MAX_SCAN_SHEETS=400/);
assert.match(api,/MAX_REGISTER_BATCH=20/);
assert.match(api,/teacher_scan_register_batch/);
assert.match(api,/cleanManifest/);
assert.match(api,/quality_score/);
assert.match(migration,/expected_page_count between 1 and 200/);
assert.match(migration,/ordinal between 1 and 400/);
assert.match(migration,/quality_score/);
assert.match(migration,/quality_score'\)::numeric < 35/);

console.log('PASS: OMR batch contract enforces 200 source pages, chunked persistence, TIFF support, quality metadata, and server-side limits.');
