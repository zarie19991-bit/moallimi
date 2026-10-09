# Reading NAFES Review — Text Integrity, 11pt Typography, and Print Audit

Date: 2026-10-03

## Scope
This change is intentionally limited to the automatic paper question-sheet view used by the paper assessment workflow.

## Implemented changes

### 1. Reading header
The former top heading `اختبار القراءة` is removed for reading-only paper models.

The first-page header now displays:
- `مراجعة مؤشرات نافس`
- `مؤشرات نافس - القراءة`
- the actual unique indicator labels found in that model's reading questions.

The indicator list is derived from question metadata (`indicator_text`, with supported fallbacks) and is de-duplicated without inventing indicators.

### 2. Missing / clipped reading text
The following containers no longer use hidden clipping:
- `.page-inner`
- `.questions-flow`
- `.passage`
- `.stem`
- option text

The measured paginator remains responsible for page transitions. Before printing, print metrics now also count hidden/clipped text nodes. Printing is rejected if a hidden text node, unresolved page, horizontal overflow, or vertical overflow remains.

### 3. Exact 11pt content contract
The following student-facing content uses exactly 11pt on screen and in print:
- reading passages
- question stems
- answer choices
- reading instruction line / continuation text

Compact layout modes may reduce vertical spacing and line height but may not reduce the font below 11pt.

11pt is approximately 14.6667 CSS px at 96dpi; this is asserted in browser QA.

### 4. A4 print contract
The existing verified physical print box remains:
- A4 portrait
- 6 mm physical page margins
- 198 mm printable content width
- 285 mm printable content height
- print scale 1
- no hidden overflow
- native Print button call exactly once after validation

## Acceptance results

### Generic A4 fixture — Chromium
- page count: 2
- physical width: 197.9993 mm
- physical height: 284.9976 mm
- question font: 14.6667 px = 11pt
- choice font: 14.6667 px = 11pt
- overflow pages: 0
- unresolved pages: 0
- non-final page tail gap: 40.875 px

### Cross-browser
| Engine | Version | Pages | Stem | Choices | Overflow | Unresolved |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Chrome | 154.0.8037.57 | 2 | 14.6667 px | 14.6667 px | 0 | 0 |
| Edge | 154.0.4258.37 | 2 | 14.6667 px | 14.6667 px | 0 | 0 |
| Firefox | 156.0 | 2 | 14.6719 px | 14.6719 px | 0 | 0 |
| WebKit (Safari-family engine) | Playwright WebKit | 2 | 14.6667 px | 14.6667 px | 0 | 0 |

WebKit maximum measured non-final tail gap: 64.625 px.

### Dedicated reading integrity fixture
The reading-specific QA uses two full Arabic passages and three NAFES indicator labels.

Verified:
- top brand = `مراجعة مؤشرات نافس`
- `اختبار القراءة` is absent
- all reading passages are present
- all indicator labels are present
- `.page-inner` overflow = `visible`
- `.questions-flow` overflow = `visible`
- passage = 11pt
- stem = 11pt
- choices = 11pt
- print overflow = 0
- unresolved pages = 0
- all passages remain visible in print media

## Regression protection
CI workflow `QA automatic paper builder and print` now checks:
- syntax
- print-state regression contract
- A4 browser print
- Chrome / Edge / Firefox
- WebKit
- reading NAFES heading, indicators, text integrity and exact 11pt typography

Any future change that restores `اختبار القراءة`, clips a passage, changes the content font away from 11pt, or reintroduces overflow will fail QA.

## Files changed
- `review-question-papers.js`
- `review-question-papers.css`
- `review-question-papers.html`
- `qa/review-question-paper-print.mjs`
- `qa/review-question-paper-cross-browser.cjs`
- `qa/review-question-paper-webkit.mjs`
- `qa/review-reading-review-print.mjs`
- `.github/workflows/qa-paper-builder.yml`

## User verification
1. Open the paper assessment section.
2. Open a reading model using **طباعة أوراق الأسئلة**.
3. Confirm the upper heading is **مراجعة مؤشرات نافس**.
4. Confirm the next strip lists the real reading indicators.
5. Confirm passage, question, and choice text are visually the same 11pt size.
6. Press **طباعة**.
7. In the browser print dialog select A4, portrait, scale 100%; do not enable custom scaling.
8. Verify no text is cut and no passage disappears.
