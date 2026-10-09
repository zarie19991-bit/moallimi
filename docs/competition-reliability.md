# Competition reliability update

Scope: competition only; existing student sessions and assessment analysis are unchanged.

## Release order

1. Apply `supabase/competition-reliability.sql` to the existing project.
2. Deploy `supabase/functions/lugati-competition/index.ts` with existing custom-session authentication (`verify_jwt=false`). The SQL RPCs are SECURITY INVOKER and executable only by service_role; authorization remains in the Edge Function.
3. Publish the matching JavaScript and cache-busted teacher/student HTML entry points. Old clients must refresh; requests missing a question ID fail safely instead of grading the next question.

## Verified

- `node qa/competition-unit.cjs`: mocked-DOM UI regressions and backend TypeScript parsing/guards.
- Run the installation SQL without its final COMMIT followed by `qa/competition-database-rollback.sql`: transactional start, repeated start, shuffled answer grading, replay after advancement, foreign-question rejection, final submission and final-answer replay. ROLLBACK removes all fixtures and schema changes from this test.
- `qa/competition-reliability.cjs` provides browser checks. Requires Playwright with Chromium; this workspace did not have a browser executable, so browser checks have not run here.

## Content limitations

- Images are optional frozen question metadata (`image: {url,alt}`) with a trusted asset URL allowlist. Missing visual references stay excluded. No images have been invented or automatically assigned to existing questions.
- No claim of a comprehensive academic review of the bank. Existing approved/alignment-verified flags are still required.
- Support report uses less than 70% of all assigned indicator questions, includes unanswered items, and only reports completed/closed attempts. This is a support signal, not a mastery assessment.
- Student archive currently returns the latest 200 participated closed rounds across seasons.
- Counts are 3, 6, 9, 12, 15; at least three questions per selected indicator, balanced across cognitive levels.
