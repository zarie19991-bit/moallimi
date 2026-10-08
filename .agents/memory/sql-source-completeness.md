---
name: SQL source completeness
description: Validate dependency closure before claiming original-schema SQL tests are runnable.
---

An empty missing-requested-tables list proves only that the requested roots were
exported, not that their schema can be imported. Follow foreign-key parents and
inspect trigger/function bodies for procedural callees; catalog dependency lists
alone are not a complete account of PL/pgSQL body dependencies.

**Why:** The initial owner-provided metadata contained all requested roots but
omitted a reviewer parent table required by scan foreign keys, plus helpers for
attempt triggers. Treating the root list as complete would require fabricated
dependencies or disabling original integrity checks.

**How to apply:** Audit closure before local SQL execution. Keep prerequisites
blocked rather than passed or business-logic failures. Distinguish dependencies
of standalone scan RPC tests from those needed for the broader grade-attempt path.
