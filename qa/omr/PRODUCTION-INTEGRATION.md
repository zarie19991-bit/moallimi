# Runtime integration review

## What changed

Isolated branch: `dev/omr-production-integration`. Latest imported upstream
production baseline was merged first. A three-way merge against the supplied
Edge Function archive then integrated the verified development changes into:

- `supabase/functions/nafes-exam/omr-server.ts`
- `supabase/functions/nafes-exam/paper-scan.ts`
- `supabase/functions/nafes-exam/assessments.ts`

The current upstream bank-snapshot validation, balanced-option validation,
lazy imports and draft rebalancing remain intact.

The actual `review-scan.html`, `review-scan.js`, `review-scan-journal.js` and
new `review-omr-safety.js` now separate reading/identity/key uncertainty, require
manual edit reasons, display audited reasons and block unresolved verification
and approval. Both identity correction routes supply explicit reasons.
`production-files.txt` includes the new dependency.

## Evidence

- `results/production-integration/evidence.json`: 32 passing integration checks,
  zero failures; real PostgREST 13 and isolated PostgreSQL 17.6, synthetic data.
  Runtime source hashes identify the actual deployment-path modules.
- The test browser loads the actual production review page and teacher-access
  script. Only the network destination is redirected to the loopback fixture.
  It opens the actual review modal, displays ambiguity reasons, prevents
  verification and blocks an edit with no reason. Screenshot:
  `results/production-integration/review-modal.png`.
- Publication passes through the compiled **production** assessments handler,
  writes one 10/10 attempt and its analysis under concurrent requests, and
  authorized rollback removes only its targeted grade. An unrelated 5/10 result
  and its analysis survive. Backup/restore of the synthetic database passes.
- 162 Bun OMR/regression tests, zero failures, including 7 new production-binding
  tests. The deployment reader correctly reads all 60 blue and all 60 black marks.
- 28 upstream assessment/review-contract tests pass using `bun test`.
  Node 20 cannot import their TypeScript dependencies; `bun run` is not the
  appropriate test runner. The upstream A4/performance script passes under Node.

## Explicit limitations / deployment gate

This is a reviewed-development candidate, **not approval to deploy**.

- The isolated database applies the existing
  `qa/omr/development/manual-review-repairs.sql` contract through its builder.
  Runtime handlers need these SQL repairs, including
  `nafes_scan_publish_attempts` and `nafes_scan_verify_current`. Copying only
  the three TypeScript files to production is insufficient. No production
  migration has been applied or asserted compatible with current live schema.
- `nafes-teacher-profile` is not supplied as runtime source in this repository.
  The test login-profile endpoint is explicitly a synthetic fixture selecting
  the synthetic access row, **not proof of that deployed function**.
  Teacher authorization on every scan/save/rollback request runs the actual
  production assessments handler against PostgREST.
- Supplied metadata still does not establish complete original schema ACL,
  paper-review ACL and scan RPC ACL. The local repaired service-role grants
  are not a claim of live Supabase permission equivalence.
- The 140-paper experiment is preserved historical evidence, not a new
  140-paper run through this integrated interface.
- The managed preview intentionally blocks external services and CDN scripts;
  PDF/TIFF/QR decoding via those CDN assets is not certified by the preview.

No real student rows, grades or production database were accessed or changed.
No GitHub branch was pushed, no main change was published, no Supabase or
GitHub Pages deployment occurred. Decrypted catalogs and database dumps remain
outside the repository. Review runtime changes against `origin/main`, not
against the older imported main, to distinguish repairs from the upstream sync.
