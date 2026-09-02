# Deleting tests, or letting a tool delete them for you

On 2026-08-31 a commit on PR #2481 titled "test(ui): compare answer status surfaces" changed
one file with 4 insertions and 4,924 deletions: `tests/ui-smoke.spec.ts` fell from 6,001
lines / 89 test cases to 1,081 / 9. The four "insertions" were not code — they were a
file-reading tool's own truncation banner written back as file content, one line carrying a
literal `N tokens truncated` marker inside what should have been TypeScript. A tool had
regenerated the whole file from a truncated read instead of editing a region of it. Squash
auto-merge was armed; only an unrelated merge conflict stopped it, and the branch's later
merge of `main` silently restored the file, so the squash landed clean. Nothing was lost, by
luck rather than by any gate (`#Y30AXB`).

`npm run check:diff-integrity` is that gate. It runs unconditionally in `verify:cheap` and
`verify:pr-local`, and in CI's `static-pr` job, comparing against the merge base with
`origin/main` — never the previous commit, so removing tests across several small commits is
still measured as the whole drop. Two rules:

- **Test-case floor.** Test cases are counted from the TypeScript AST, not by grepping for
  `test(`: a grep counts `/re/.test(x)` and, far worse, keeps counting a block of tests after
  someone comments it out. Measured both in aggregate (all changed test files together, 25%)
  and per surviving file (50%, above a 3-case floor so tiny edits stay quiet). The aggregate
  alone would flag the ordinary refactor that deletes one spec and adds its replacement; the
  per-file rule alone would miss a suite gutted inside a large PR whose other additions absorb
  the loss. Calibrated against 300 real commits touching `tests/`: zero flagged, while the
  #Y30AXB commit fails both.
- **Truncation artefact.** No added line, in any file, may carry a tool's truncation banner.
  This is the actual signature, and unlike the first rule it also covers the same tool failure
  landing in `src/`.

Known limitation, deliberately accepted: a `test()` inside a `for (const viewport of …)` loop
counts once, not once per iteration, so shrinking that loop's array loses real cases without
moving the count. Any static count has this hole; the aggregate and the truncation rule are
unaffected, and closing it would mean evaluating the spec rather than parsing it.

A deliberate reduction is a **reviewed** change, not a silent one: add the exact
`{path, before, after, reason, approvedOn}` to `diff-integrity.json`. An approval pins both
counts, so it cannot quietly cover a later, larger cut. Do not raise the thresholds to clear a
diff — that is the move this gate exists to prevent. The gate fails closed: an unresolvable
base or an unreadable blob is a failure, never a pass.
