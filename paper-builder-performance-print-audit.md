# Automatic Paper Test — Performance and Print Audit

Date: 2026-10-03

## Scope
This audit covers the automatic paper-test builder and the A4 question-paper renderer.

## Performance finding
Before this change, the browser requested 10 candidate builds for every reading model and 8 candidates for most non-reading models before choosing one final model. Five models therefore caused roughly 40–50 internal candidate builds even though only five models were retained.

### Implemented change
- Reading initial batch: 5 candidates instead of 10.
- Other subjects initial batch: 3–4 candidates instead of 6–8.
- A small refinement batch is requested only when the first batch does not produce an ideal non-repeating model.
- A fallback batch is used only when no valid model exists.
- Each model build now records elapsed milliseconds in `nafes_paper_builder_last_metrics`.
- Catalog and student roster are cached in session storage for 5 minutes and refreshed in the background.
- The edge function keeps a 45-second bounded in-memory cache of question pools for rapid consecutive model builds.

### Expected workload reduction
| Scenario | Previous candidate work | New normal-path candidate work | Reduction |
| --- | ---: | ---: | ---: |
| Reading, 5 models | 50 | 25 | 50% |
| Math/science, 5 models | 40 | 20 | 50% |
| Non-repeat disabled, 5 models | 30 | 15 | 50% |

The refinement path intentionally trades some of this saving back when quality requires more candidates. This keeps quality gates intact while targeting at least 40% typical reduction.

## Print finding
The print renderer previously relied on fixed physical widths/heights plus hidden overflow. Browser and printer rounding differences could therefore clip the lower or side content silently.

### Implemented print contract
- A4 page: `@page { size: A4 portrait; margin: 6mm; }`.
- The rendered paper uses 100% of the browser-provided printable width instead of a hard 198 mm width.
- Question font: 14 pt.
- Choice font: 12.5 pt.
- Page fitting runs immediately before print.
- Print metrics are saved to `nafes_question_paper_last_print_metrics`.
- If any page has more than 2 px overflow or unresolved layout, printing is blocked instead of producing a clipped sheet.
- Firefox keeps the same font size; only vertical rhythm is compacted to compensate for different Arabic font metrics.

## Measurement fields
Builder metrics:
- `total_ms`
- `api_calls`
- `candidates`
- `server_ms`
- `client_api_ms`
- `model_ms[]`

Print metrics:
- `layout_ms`
- `pages`
- `max_overflow_px`
- per-page horizontal/vertical overflow

## Acceptance targets
- Typical model-build candidate workload reduction: >= 40%.
- Print max overflow: <= 2 px.
- No unresolved page may reach `window.print()`.
- Chrome, Edge and Firefox must preserve the A4 margin and readable font contract.

## Regression gate
Run:
`node question-bank/scripts/test-paper-builder-performance.mjs`

The production Pages workflow runs this contract so future changes cannot silently restore eager candidate generation or unsafe print sizing.
