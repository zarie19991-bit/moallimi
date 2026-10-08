---
name: OMR validation timing
description: Avoid confusing local test-runner timing failures with scan-reading accuracy.
---

Preserve source image resolution in real-sheet accuracy comparisons. Do not shrink
scans merely to satisfy the test runner's default deadline. Give synchronous JPEG
decoding and orientation search sufficient test time, and evaluate performance
separately from agreement with visible shading.

**Why:** Identical local tests had substantially different execution times between
runs. The default per-test deadline produced timing failures without evidence of
different extracted answers. A more generous deadline allowed correctness checks
to finish; it did not establish an acceptable production processing speed.

**How to apply:** For full-resolution scan regressions, distinguish timeout, image
rejection, ambiguous reading, and wrong choice. Record timing independently and do
not change answer expectations or image detail to make a timeout disappear.

For browser-to-SQL audit checks, wait for the history response and rendered audit
rather than sleeping for a fixed delay. A successful save does not mean the next
UI refresh and history query have finished.

**Why:** A local native-SQL audit existed and was correct while an early browser
assertion reported that its reason was absent. The assertion raced the asynchronous UI.

**How to apply:** Observe actual completion of each API/render step. Browser contexts
do not reset a running preview's synthetic database; repeat runs may begin with an
already reviewed sheet, so check its persisted manual reason or reseed deliberately.
