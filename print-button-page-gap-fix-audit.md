# Print Button and Page-Gap Fix Audit

Date: 2026-10-03
Scope: automatic paper question printing in `review-question-papers.html`

## Executive summary
Two production defects were addressed:

1. The Print button could be blocked even after the layout became valid because a stale `data-layout-unresolved="1"` marker survived later successful page fitting.
2. Large blank areas could remain before the next printed page, especially after splitting reading passages, because continuation questions were treated as one indivisible block and because previous compact-layout classes could survive later reflow passes.

The deployed fix clears stale layout state before every measured fit, moves continuation questions one-by-one into available space, avoids rebuilding the whole document during the print lifecycle, and keeps the physical A4 contract at 198 × 285 mm inside 6 mm margins.

## Root causes

### Print button
Previous sequence:
- A page temporarily failed fitting.
- `repairOverflow()` set `data-layout-unresolved="1"`.
- A later pass could make the page fit, but the attribute was not guaranteed to be removed.
- `prepareExactPrint()` treated the stale flag as a current error and returned `false`.
- The button therefore never reached `window.print()`.

A second risk was repeated DOM mutation:
- the click handler prepared the layout,
- `beforeprint` prepared it again,
- `afterprint` rebuilt all pages with `renderPages()`.

This could change pagination while the browser was opening or closing the print dialog.

### Large page gaps
Reading groups that had already been split generated continuation groups. When a continuation group did not fit as a whole, the old filling algorithm moved the whole group back to the next page instead of pulling the number of remaining questions that would fit. This left avoidable blank tail space.

Print CSS also marked several inner wrappers as `break-inside: avoid`, even though JavaScript already performs explicit pagination. Browser engines could therefore make additional conservative break decisions.

## Implemented changes

### JavaScript — `review-question-papers.js`
- Added clean fit-state reset before each measured pagination pass.
- Clears stale `data-layout-unresolved` after a page becomes valid.
- Clears previous `compact-page` and `compact-page-strong` state before re-measurement.
- Added continuation-question filling that moves reading questions one-by-one into the previous page while space remains.
- Print button calls `window.print()` once after one validated preparation cycle.
- `beforeprint` no longer rebuilds an already prepared button-print layout.
- `afterprint` no longer recreates every page; it only releases state and schedules a non-destructive re-fit.
- Button displays `جاري تجهيز الطباعة…` while print is active.

### CSS — `review-question-papers.css`
- Keeps the exact physical print contract:
  - A4 portrait.
  - 6 mm page margins.
  - 198 mm content width.
  - 285 mm content height.
- Keeps the physical page itself unbreakable.
- Inner wrappers now use normal break behavior because JavaScript already owns pagination.
- Readable font contract remains unchanged:
  - question stem: 14 pt.
  - choices: 12.5 pt.

### Regression QA
- The QA deliberately injects a stale unresolved marker before clicking the real Print button.
- The test fails unless the Print button reaches `window.print()` exactly once.
- It measures residual blank tail space on non-final pages.
- Chrome and Edge generate real PDF output.
- Firefox validates its native layout engine and print CSS contract.
- WebKit validates the Safari-family rendering engine.

## Before / after

| Behavior | Before | After |
| --- | --- | --- |
| Stale unresolved state | Could permanently block Print | Cleared on every new measured fit |
| Print API | Could never be reached | Automated button test reaches `window.print()` exactly once |
| Print lifecycle | Re-fit multiple times and rebuild after print | Single validated preparation; no destructive afterprint rebuild |
| Reading continuation | Remaining questions treated as one block | Questions pulled individually into available space |
| Inner CSS page breaking | Several wrappers forced `break-inside: avoid` | Only the explicit physical page is protected |
| A4 size | 198 × 285 mm contract | 198 × 285 mm contract preserved |
| Overflow in acceptance fixture | Risk of stale failure / clipping | 0 pages |
| Unresolved pages | Could persist from old state | 0 pages |
| Chrome first-page residual tail gap | Not measured | 32.734 px |
| WebKit maximum residual tail gap | Not measured | 46.344 px |

## Browser acceptance results

### Chrome 154
- Pages: 2
- Overflow: 0
- Unresolved: 0
- Stem: 18.6667 px (~14 pt)
- Choices: 16.6667 px (~12.5 pt)
- PDF generated successfully.

### Edge 154
- Pages: 2
- Overflow: 0
- Unresolved: 0
- Stem: 18.6667 px
- Choices: 16.6667 px
- PDF generated successfully.

### Firefox 156
- Pages: 3
- Overflow: 0
- Unresolved: 0
- Stem: 18.6563 px
- Choices: 16.6563 px
- Firefox uses different Arabic font metrics, so one extra page is accepted instead of shrinking the text.

### WebKit / Safari-family engine
- Pages: 3
- Printable box: 197.999 × 284.998 mm
- Overflow: 0
- Unresolved: 0
- Stem: 18.666666 px
- Choices: 16.666666 px
- Maximum non-final tail gap: 46.34375 px

The CI environment is Linux, so it cannot open the native macOS Safari print dialog. WebKit is used to validate Safari-family CSS/layout behavior; native Safari dialog behavior should remain a final device-level UAT item.

## Acceptance thresholds
- `overflow = 0`
- `unresolved = 0`
- non-final tail gap <= 150 px
- question font >= 18 px
- choice font >= 16 px
- physical page width approximately 198 mm
- physical page height approximately 285 mm
- Print button must invoke `window.print()` exactly once after stale-state recovery.

## Maintenance
Do not:
- reintroduce `renderPages()` inside `afterprint`,
- preserve `data-layout-unresolved` between independent fit cycles,
- make continuation reading groups indivisible,
- change the physical page to `width:100%` under print media.

Any change to:
- `review-question-papers.js`
- `review-question-papers.css`
- `review-question-papers.html`

must pass `QA automatic paper builder and print`, including Chrome, Edge, Firefox, and WebKit.
