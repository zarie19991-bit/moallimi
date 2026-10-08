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
