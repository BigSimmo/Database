# Developer hub Phase 1 — handoff

**Read this before touching the plan.** It is committed to the branch on purpose: two earlier
copies of this record lived in git-ignored scratch and were destroyed along with their worktrees.

Branch: `claude/developer-button-settings-fb9b51`
Plan: `docs/superpowers/plans/2026-08-21-developer-hub-phase-1.md`
Spec: `docs/superpowers/specs/2026-08-21-developer-hub-phase-1-design.md`
Method: `superpowers:subagent-driven-development` (one implementer per task, controller reviews)

---

## 1. Status

| Task | What it is                          | State                     |
| ---- | ----------------------------------- | ------------------------- |
| 1    | Snapshot generator + parser         | **Committed** `80ae20d54` |
| 2    | Staleness gate + npm wiring         | **Committed** `9a8e2d60b` |
| 3    | Typed reader (`ledger-snapshot.ts`) | Not started               |
| 4    | Panel registry (`hub-panels.ts`)    | Not started               |
| 5    | Nav-header sibling                  | Not started               |
| 6    | Hub presentation components         | Not started               |
| 7    | Hub page                            | Not started               |
| 8    | Ledger page                         | Not started               |
| 9    | Settings rename to "Developer"      | Not started               |
| 10   | Docs + verification                 | Not started               |

**Tasks 1 and 2 have been reviewed and every finding fixed** (2 Critical, 2 Important, several
Minor), with regression tests. Tests 17/17. **Start at Task 3.**

Both Critical findings are traps a later task could re-create, so know them:

1. **A gate that fired when nothing was wrong.** `compareSnapshots` compared `ledger_revision` — a
   git sha that changes as a _side effect_ of committing a ledger edit. The gate could therefore
   never pass for a single-commit ledger change, and `main` would have gone red after every squash
   merge touching the ledger. A gate that cries wolf is one people stop watching, which is exactly
   the failure this feature exists to prevent. Fixed by excluding that field; the reasoning is
   in-code with a test named for the regression. **Do not re-add it thinking you are tightening the
   check.**
2. **Green tests hid a branch that would not compile.** Vitest does not typecheck, so 13/13 passing
   masked two `TS18048`/`TS2532` errors that fail the repo's typecheck gate. **Run
   `npm run typecheck:source` as well as the tests** — passing tests are not evidence the branch
   compiles. This applies to every remaining task.

---

## 2. The five environment traps

These cost roughly three hours and 1.2M tokens to learn. Do not rediscover them.

1. **Bash calls that run tests need an explicit `timeout: 600000`.** The default is 120s, and
   anything longer is silently moved to the background, which ends a subagent's turn. This killed
   four implementers consecutively. 600000 ms is the cap; larger values are rejected.
2. **`npm run test:focused` cannot be used on this plan.** Every task adds a test file and focused
   selection fails closed on exactly that (`Focused test selection is unsafe: test or configuration
paths changed`). Use `npm run test`, optionally with a filter argument.
3. **Never pipe a gate through `tail`/`head`/`grep`.** The pipe's exit status replaces the
   command's, so a failing suite reports success. This happened: a run with 7 failures reported
   exit 0 and was nearly recorded as green. Redirect to a file, or run it backgrounded and read the
   harness output file.
4. **The full suite needs an exclusive run-coordinator lease** and 25+ sibling worktrees compete for
   it. Queue and wait. Never force it, never set `CLINICAL_KB_HEAVY_LOCK_PATH`, never call vitest
   around `scripts/run-vitest.mjs`. **The controller should run the full suite, not the implementer**
   — a subagent waiting in the queue burns ~200k tokens for nothing.
5. **Verify the worktree before every commit.** `git rev-parse --abbrev-ref HEAD` must report
   `claude/developer-button-settings-fb9b51`.

---

## 3. The worktree hazard — read before creating one

**Two worktrees were destroyed mid-run during this session**, roughly three hours apart. Symptoms:
the directory loses its `.git`, `git worktree list` stops listing it, and every git command then
silently resolves to the MAIN checkout at `D:/Repos/Database` — which is usually on another
session's branch with their uncommitted work. **A commit at that moment writes your work into
someone else's changes.** Both implementers detected it and refused to commit, which is the only
reason no damage occurred.

Cause is unconfirmed. The machine was running 30+ concurrent agent sessions against copies of this
repo. Best hypothesis: under heavy I/O contention a worktree briefly appears missing and another
session's cleanup prunes it. Not proven.

Mitigations now in place:

- This handoff is **committed to the branch**, not held in git-ignored scratch.
- Commit early and often; uncommitted work is the only thing at risk.
- Check the branch name before every commit.

---

## 4. Baseline test state — established, do not re-litigate

**Three tests fail on this branch and are NOT caused by this work.** Proven by removing all of
Task 1's files and re-running: the identical three failed.

- `tests/codex-cloud-setup.test.ts` — 2 failures (Codex Cloud environment contract)
- `tests/design-sync-contract.test.ts` — 1 failure (design-sync public contract)

**The suite is also flaky.** Two runs of byte-identical code gave 7 failures across 6 files, then 3
across 2, with almost no overlap (`document-viewer-page-virtualization` failed once, passed once).
A red result is therefore not automatically a regression — and a real regression can hide in that
noise. **Always A/B against a clean tree before attributing a failure to the current task.**

Full suite runtime: ~26 minutes, plus queue.

---

## 5. Plan defects already fixed (commit `9c25472f5`)

The plan as first written would not have worked. Corrected:

1. Every task used `npm run test:focused`, which fails closed here. All 15 occurrences replaced.
2. The parser split cells naively. The live ledger has **8 escaped pipes**, each of which a naive
   split turns into a column boundary, rejecting valid rows. Now uses `splitCells` from
   `scripts/outstanding-issues.mjs`.
3. The parser took ID cells verbatim. **62 rows carry an `<!-- issue-ulid:… -->` comment inside the
   ID cell**, which would leave markup in the id and silently break the queue→row detail join. Now
   normalised.
4. `## Resolved / archive` holds **three tables**; one-shot header skipping counted the 2nd and 3rd
   header rows as data. Now per-row detection.
5. The freshness stamp claimed a build time the page cannot know — the route is dynamic because
   `DeveloperAreaGate` reads cookies, so render time is request time. `Freshness` is now
   `{ contentAt, viewedAt, ageHours }` and the stamp reports ledger-content age.
6. `generated_at` removed from the snapshot: it must be byte-deterministic or the Task 2 gate fails
   on every run.
7. Two panel cards linked to their own section. Replaced with real `caring-contact` and `ward-flow`
   destinations.
8. The plan's main-module guard (`` `file://${process.argv[1]}` ``) never matches on Windows. Use
   `pathToFileURL(process.argv[1]).href`. **Any later task copying that idiom must apply this.**
9. `data/outstanding-issues-snapshot.json` added to `.prettierignore`. Prettier collapses short
   arrays that the generator expands, so without this every regeneration dirties the file. Matches
   the existing treatment of `supabase/drift-manifest.json`.

---

## 6. Verified facts (measured, not assumed)

Against the live ledger, with the corrected parser:

| Claim                            | Verified                                                  |
| -------------------------------- | --------------------------------------------------------- |
| open / p1 / p2 / p3              | 67 / 2 / 33 / 32                                          |
| queued / pending / resolved      | 11 / 3 / 336                                              |
| malformed rows                   | 0 across all three tables                                 |
| ids containing markup            | 0                                                         |
| Priority and Acuity are disjoint | P1 = `#316`, `#CCZ4HB`; A1 = `#231`; no overlap           |
| Snapshot regeneration            | byte-identical after a format run                         |
| Gate catches corruption          | corrupt → exit 1 with the exact diff; regenerate → exit 0 |

The Priority/Acuity row is the one the whole design rests on: they are two different scales and a
shared "urgent" badge would misreport them.

**Not verified:** none of the plan's UI code has been compiled or run. The DOM tests in Tasks 6–8
are a specification, not proven code, and will likely need mocking scaffolding — the repo's
existing `tests/in-page-nav-route-sections.dom.test.tsx` needs a lot of it and the plan's tests
have none.

---

## 7. Controller rulings

R1 no `generated_at` · R2 `Freshness` = `{contentAt, viewedAt, ageHours}` · R3 drop self-linking
panels, add real prototype cards · R4 per-row header detection · R5 discard unverifiable partial
work rather than reuse it · R6 dependency install is controller setup · R7 never force the
run-coordinator lock · R8 superseded by R9 · R9 explicit Bash timeout is the root cause of agent
death · R10 plan's focused-test commands are wrong throughout · R11 controller absorbs test waiting
· R12 implementers run filtered tests only · R13 controller may commit verified work when its
implementer was blocked by environment.

---

## 8. Next actions, in order

1. Run the task review for Tasks 1 and 2 (never done).
2. Task 3 — typed reader. Note it must use the corrected `Freshness` shape.
3. Tasks 4–10 per the plan.

Suggested effort: Tasks 3–4 medium; Task 5 medium-high (must match the pinned `InPageNavHeader`
template — the repo records two prior attempts getting this wrong); Tasks 6–8 **high**
(constraint-dense: design tokens, `min-h-12` tap targets, button-wiring rules, section anchors,
phone chrome all at once); Task 9 low; Task 10 low-medium.
