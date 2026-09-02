## Summary

- Add `docs/branch-review-index.md`, a generated, human-readable index of the 576 immutable records in `docs/branch-review-records/`. Every filename there is a raw SHA-256 content address, so the directory cannot be navigated by hand, and the hash-filename to review-row join existed in no static artifact: `scripts/generate-repo-awareness-snapshot.ts` reads each record's path in `readReviewRecordRows` and then discards it in `buildReviewStateSection`, emitting only the six cells. The index supplies that missing join.
- Add `scripts/generate-branch-review-index.mjs` (`npm run ledger:index`, refreshed by `npm run docs:update`) plus `tests/branch-review-index.test.ts`. The generator reuses the existing corpus reader — `listLedgerRecordPaths` and `parseLedgerRows` from `scripts/branch-review-ledger.mjs` — rather than adding a third parser, which matters because four records carry escaped pipes that a naive split on the pipe character would mis-parse.
- Add `docs/branch-review-archival-policy.md`, recording what may and may not be done to the append-only corpus with the enforcing code quoted at file and line, so the constraint is not re-derived by the next session.
- Register both documents in `docs/README.md`, extend `docs/branch-review-records/README.md` with pointers, add the index to `GENERATED_CATALOGS` in `scripts/check-stale-docs.mjs` and to `.prettierignore`, and refresh the generated `docs/scripts-index.md` and `data/repo-awareness-snapshot.json`.

**Deliberately not a gate.** Records are appended at roughly 26 a day (576 records spanning only 2026-08-12 to 2026-09-02, 570 of them in August). A byte-equality drift check on a file derived from that corpus would turn `main` red after nearly every merge and would conflict between concurrent pull requests. This is not a new judgement: `scripts/check-repo-awareness-snapshot.ts:21-28` already excludes `review_state` from `COMPARED_CONTENT_KEYS` for exactly this reason. So nothing is added to `verify:cheap:internal`, CI, `verify-pr-local.mjs`, or the pre-commit hook; `ledger:index:check` is advisory; and `npm run ledger:lookup` remains authoritative for "has this ref been reviewed?". The index states its own possible staleness in its header.

**Scope note — no archival.** The task also asked whether records could be archived. They cannot, and the policy document records why with the code quoted. Editing a row is blocked (`check-branch-review-ledger.mjs:379-381` recomputes the filename as the sha256 of the row); compacting rows into one file is blocked (`:374-377`); deletion is forbidden by `docs/codex-review-protocol.md:65` and caught by nothing. Moving records into subdirectories is the dangerous one: the only reader is a non-recursive `readdirSync` filtered to `*.record.md` (`branch-review-ledger.mjs:172-180`), so a nested record disappears from `ledger:lookup`, from `check:branch-review-ledger`, and from the repo-awareness snapshot **while every gate still passes green**. No gate was weakened, exempted, or bypassed.

One incidental gain: because the index links every record relatively, `npm run docs:check-links` now resolves 578 more references than before, which makes it the first — partial — enforcement of the never-delete-a-record rule. It only catches deletions of records the index already lists, and the policy document says so rather than overstating it.

## Verification

Local gates were selected to match the change (documentation, a new offline generator, and generated-document machinery) rather than running a broad gate that covers no plausible failure path here. All output quoted below is verbatim.

- [x] `npm run check:ledger-write-discipline` — `Ledger write discipline passed for 45a3dcacb54a..HEAD.`
- [x] `npm run check:branch-review-ledger` — `Branch review ledger guard passed: 880 live table records + 1206 archived + 576 immutable (880 under the 2026-07-29 machine-readable contract), immutable review writes, six cells each, no conflict markers, mojibake, heading records, or duplicates.`
- [x] `npm run check:outstanding-issues` — `Outstanding-issues guard passed: 529 rows (75 open, 454 archived)` and `[snapshot] in step with data/outstanding-issues-snapshot.json (75 open, 8 pending)`
- [x] `npm run check:repo-awareness-snapshot` — `[repo-awareness] in step with data/repo-awareness-snapshot.json (204 pages, 568 documents, 2662 reviews)`
- [x] `npm run docs:check-links` — `docs link check passed: 5354 repo path references resolve.`
- [x] `npm run docs:check-scripts` — `docs script-ref check passed: 1209 npm-run reference(s) resolve to real scripts.`
- [x] `npm run docs:check-inventory` — `Docs inventory current: 284 script files, 286 npm scripts.`
- [x] `npm run ledger:index:check` — `[ledger:index] docs/branch-review-index.md is current.`
- [x] `npm run format:check` — `All matched files use Prettier code style!`
- [x] `npm run typecheck` — exit 0, `[gate-receipts] recorded a pass for "typecheck:internal" (6003 input files).`
- [x] `npx eslint scripts/generate-branch-review-index.mjs tests/branch-review-index.test.ts` — exit 0, no output.
- [x] `npx vitest run tests/branch-review-index.test.ts` — `Test Files  1 passed (1)`, `Tests  22 passed (22)`
- [x] Regression sweep over every existing test this diff could disturb — `npx vitest run tests/docs-inventory.test.ts tests/repo-hygiene.test.ts tests/site-map.test.ts tests/repo-awareness-generator.test.ts tests/branch-review-index.test.ts` — `Test Files  5 passed (5)`, `Tests  133 passed (133)`

Verification not run: `npm run verify:pr-local`, `npm run verify:ui` and `npm run verify:release` were deliberately skipped. The focused gates above cover this diff's plausible failure paths, no UI, routing, styling or browser behaviour changed, and no release confidence is claimed. CI remains the authoritative merge gate.

No provider-backed gate was run. Nothing touching OpenAI, Supabase, live CI, or any paid API was executed.

Two defects were found and fixed during verification rather than being left for CI: a stray NUL byte embedded in the generator's supersession-key separator, which made `grep` treat the source file as binary, replaced with its escape sequence; and a TypeScript error in the test fixture, whose spread through a `Record<string, string>` cast erased the `hash` property.

## Risk and rollout

- Risk: Low, and additive. The generator only ever writes `docs/branch-review-index.md` — it contains a single `writeFileSync` and no rename or unlink call, and it never modifies anything under `docs/branch-review-records/`. Nothing was added to any verification gate, so no existing gate changes behaviour. The one edit to an existing script is a single new entry in the advisory `GENERATED_CATALOGS` list in `scripts/check-stale-docs.mjs`.
- Rollback: Revert the single commit. Nothing reads the index, so no consumer breaks.
- Provider or production effects: None.
- RAG impact: none. No file under `src/lib/rag/`, no retrieval RPC, no ranking surface, no golden fixture, and no eval harness file is touched by this diff.

## Clinical Governance Preflight

This diff is documentation and offline tooling. It is classified clinical-risk solely because it regenerates `data/outstanding-issues-snapshot.json` and `data/repo-awareness-snapshot.json`, which the path classifier treats as clinical data exports. Both regenerations are mechanical output of committed generators, required because this change adds two documents; no clinical content, answer path, or access rule is touched. Each item below is confirmed against the actual diff, not assumed.

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

Evidence for the above: no file under `src/`, `worker/`, `supabase/`, or `src/lib/rag/` is in this diff; the Supabase integration bot confirmed on this PR that it detected no changes in the `supabase` directory; Gitleaks and GitGuardian both passed; and no clinical decision-support behaviour changed, so the TGA SaMD classification is unaffected.

## Notes

The policy check reports one advisory warning that is accurate and not worth splitting the PR over: operational-risk and clinical-risk paths are bundled, because `package.json` (two new npm scripts) and the regenerated `data/` snapshots must land in the same commit as the generator they describe. Splitting them would leave either the snapshot stale or the scripts unregistered, and each half would fail its own gate.

The index is 644 lines and about 172 KB, roughly 0.6% of the documentation tree — a real but small cost, stated plainly in the policy document alongside the growth figures rather than glossed over. The archival-policy document's size measurements are quoted with the measuring method (`du -sh` versus `du -sh --apparent-size` differ by about 6 MB across thousands of small files), so a later reader does not "correct" one figure into the other.

A repo audit of the diff found no defects; its residual observations — the size-measurement ambiguity and a missing curated entry in `docs/scripts-index.md` — were both fixed before the first push.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01AxPVZhAvzE2YupMiDz8sqF
