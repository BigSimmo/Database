# Developer hub Phase 1 — complete worklog

Everything done on this work, in order, including what failed. Companion to
`2026-08-21-developer-hub-phase-1-HANDOFF.md`, which is the shorter "what you need to resume"
document. This one is the full record, kept because most of the expensive lessons here came from
failures that leave no trace in the git history.

Branch: `claude/developer-button-settings-fb9b51`. Sessions: 2026-08-20 into 2026-08-21.

---

## 1. Origin

The user asked for a button in Settings that opens a Developer page. Investigation found it already
existed and worked (`/mockups/development`, gated by `DeveloperAreaGate`, authorised by the
Supabase `app_metadata.site_role === "administrator"` claim — not an email allowlist).

Scope then grew in three steps:

1. Put the page live behind a login → already true.
2. Add a task-ledger artifact that is "always up to date".
3. Brainstorm everything else worth putting on a developer hub → 18 panels, decomposed into 4
   phases.

Phase 1 (hub shell + environment strip + task ledger) was specced and planned. Phases 2–4 are
outlined in the spec, not specced.

---

## 2. Design decisions and where they came from

Taken by the owner, via explicit questions:

| Decision    | Choice                                                     |
| ----------- | ---------------------------------------------------------- |
| Freshness   | Build-time snapshot with an honest age stamp               |
| Content     | Queue + open items + pending inbox requests                |
| Primary use | Decide what to do next (not browse/search) → no search UI  |
| Page shape  | Hub page with in-page sections; own route for heavy panels |
| Alert band  | Only signals the page can compute                          |
| Item detail | Summary + next action, expandable                          |
| Device      | Desktop-first design (phone-chrome gate still required)    |
| Entry label | "Developer"                                                |

Taken by the assistant and flagged: read-only (writing would breach
`check:ledger-write-discipline`); phone-chrome gate retained despite desktop-first, because
`InPageNavHeader` is shared chrome and a defect there degrades pages that _are_ used on a phone.

**The finding that shaped the whole design:** the ledger carries two independent ranking scales —
`Pri` (P1–P3, how much it matters) on open rows, and `Acuity` (A1–A3, how urgently to start) on
queue rows. They are disjoint in practice: P1 = `#316`, `#CCZ4HB`; A1 = `#231`. A shared "urgent"
badge would have reported three items as one urgent set.

---

## 3. What is built

| Commit      | What                                                                  |
| ----------- | --------------------------------------------------------------------- |
| `436c43817` | Spec + plan                                                           |
| `13f71e6fd` | Ignore the SDD scratch workspace                                      |
| `9c25472f5` | Correct three plan defects found by the failed first run              |
| `9a637e188` | Correct the spec's resolved count (271 → 336, measured)               |
| `80ae20d54` | **Task 1** — snapshot generator + parser                              |
| `9a8e2d60b` | **Task 2** — staleness gate, `.prettierignore` fix, committed handoff |
| `bb0028db9` | Record the Task 2 sha in the handoff                                  |

Tasks 3–10 not started. Neither built task has had its formal task review.

---

## 4. Failure log — five distinct causes, ~4 hours, ~1.4M subagent tokens, zero output at the time

**4.1 No dependencies in the worktree (attempt 1).** The first implementer discovered
`node_modules` was absent and spent ~25 minutes on `npm ci`, then died on an account session limit.
Controller error: provisioning the worktree was setup work the controller should have done.
→ Fix: controller runs `node scripts/setup-codex-worktree.mjs` before dispatching.

**4.2 The 120-second Bash default (attempts 2–5).** This was the expensive one. Any command
exceeding the Bash tool's 120s default is silently moved to the background, which ends a subagent's
turn. Every run-coordinator queue wait exceeds 120s, so every correctly-behaved implementer was
killed mid-wait. Four consecutive deaths, ~715k tokens, one untracked test file produced. It read
as agent incompetence and was a tool default.
→ Fix: explicit `timeout: 600000` (the cap) on every test command; controller absorbs long waits.

**4.3 Plan defect — `test:focused` fails closed.** Every task in the plan adds a test file, and
focused selection refuses exactly that case. Measured, not inferred: the command returned
"Focused test selection is unsafe: test or configuration paths changed" in 62s. So every task needs
the full suite (~26 min) under an _exclusive_ lease, on a machine with 25+ competing worktrees.
→ Fix: all 15 occurrences rewritten to `npm run test`.

**4.4 Two worktrees destroyed mid-run.** Roughly three hours apart. The directory loses `.git`,
`git worktree list` stops listing it, and every git command then silently resolves to the MAIN
checkout — which was on another session's branch with their uncommitted work. **A commit at that
moment would have written this work into someone else's changes.** Both implementers detected the
condition and refused to commit; that refusal is the only reason no damage occurred. Cause
unconfirmed; the machine was running 30+ concurrent agent sessions against copies of this repo.
→ Fix: handoff committed to the branch rather than held in git-ignored scratch; branch check
required before every commit; commit early.

**4.5 A gate that could not fail.** `npm run test 2>&1 | tail -40` reports _tail's_ exit status, so
a suite with 7 failures returned exit 0 and was nearly recorded as green. The same pipe discarded
the list of failing files. Controller error, and one the repo's own documentation warns about.
→ Fix: never pipe a gate; redirect or read the harness output file.

---

## 5. Plan defects found and corrected

The plan as first written would not have run. All fixed in `9c25472f5` unless noted.

1. `test:focused` used throughout — fails closed here (§4.3).
2. **8 rows in the live ledger contain escaped pipes (`\|`).** A naive `line.split("|")` turns each
   into a column boundary and rejects a valid row as malformed. Now uses `splitCells` from
   `scripts/outstanding-issues.mjs`.
3. **62 rows carry an `<!-- issue-ulid:… -->` comment inside the ID cell.** Taking the cell verbatim
   leaves markup in the id, which then fails to match the queue's plain `#SZGPAH` and silently
   breaks the queue→row detail join. Now normalised.
4. `## Resolved / archive` holds **three** tables; one-shot header skipping counted the 2nd and 3rd
   header rows as data. Now per-row detection.
5. The freshness stamp claimed a build time the page cannot know — the route is dynamic because the
   auth gate reads cookies, so render time is request time. `Freshness` became
   `{ contentAt, viewedAt, ageHours }`, reporting ledger-content age.
6. `generated_at` removed from the snapshot: it must be byte-deterministic or the Task 2 gate fails
   on every run.
7. Two panel cards linked to their own section anchor. Replaced with real `caring-contact` and
   `ward-flow` destinations.
8. The main-module guard `` `file://${process.argv[1]}` `` never matches on Windows. Fixed by Task
   1's implementer using `pathToFileURL(process.argv[1]).href`. **Any later task copying that idiom
   must apply this.**
9. The spec's example `resolved` count was invented (271); the measured value is 336 (`9a637e188`).
10. `data/outstanding-issues-snapshot.json` added to `.prettierignore` (`9a8e2d60b`). Prettier
    collapses short arrays the generator expands, so without it every regeneration dirtied the file
    and the gate would have reported a false mismatch on every run — a gate that cries wolf is a
    gate people learn to ignore. Same treatment as `supabase/drift-manifest.json`.

Items 2, 3 and 10 were found by running code against real data. None were visible by reading the
ledger's own stated conventions, which describe neither hazard.

---

## 6. Verification performed

| Check                          | Result                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| Snapshot counts vs live ledger | open 67, p1 2, p2 33, p3 32, queued 11, pending 3, resolved 336 — exact    |
| Malformed rows                 | 0 across all three tables                                                  |
| IDs containing markup          | 0                                                                          |
| Priority/Acuity disjointness   | P1 `#316`,`#CCZ4HB`; A1 `#231`; no overlap                                 |
| Snapshot determinism           | Regeneration byte-identical after a format run                             |
| Gate proven to fail            | Corrupt → exit 1 naming the field + fix command; regenerate → exit 0       |
| Snapshot unit tests            | 13/13 passing across both files                                            |
| Full unit suite                | 3 pre-existing failures, proven pre-existing by A/B with the files removed |
| Plan/spec integrity            | Plan 1474 lines, 10 tasks, no placeholders; spec 382 lines, 12 sections    |
| npm chain preservation         | `check:outstanding-issues` retained all original clauses                   |

**Not verified:** no UI code has been compiled or run. The DOM tests in Tasks 6–8 are a
specification, not proven code, and will likely need mocking scaffolding — the repo's existing
`tests/in-page-nav-route-sections.dom.test.tsx` carries a lot of it and the plan's tests have none.

---

## 7. Baseline test state

Three tests fail on this branch and are **not** caused by this work, proven by removing Task 1's
files and re-running: `tests/codex-cloud-setup.test.ts` (2), `tests/design-sync-contract.test.ts`
(1).

The suite is also flaky: two runs of byte-identical code gave 7 failures across 6 files, then 3
across 2, with almost no overlap. A red result is not automatically a regression — and a real
regression can hide in that noise. Always A/B against a clean tree.

---

## 8. Rulings made on the owner's behalf

R1 no `generated_at` · R2 `Freshness` = `{contentAt, viewedAt, ageHours}` · R3 drop self-linking
panel cards, add real prototype cards · R4 per-row header detection · R5 discard unverifiable
partial work rather than reuse it · R6 dependency install is controller setup · R7 never force the
run-coordinator lock (it was held by live external runs) · R8 superseded by R9 · R9 explicit Bash
timeout is the root cause of agent death · R10 the plan's focused-test commands are wrong
throughout · R11 controller absorbs test waiting · R12 implementers run filtered tests only · R13
controller may commit verified work when its implementer was blocked by environment.

---

## 9. Open items for the owner

1. **Something is destroying worktrees on this machine.** Twice in one session. Cause unidentified;
   30+ concurrent agent sessions were running against this repo. Worth finding.
2. **Three tests fail on this branch**, inherited from main. Not urgent for this work, but they
   fail for anyone on this branch.
3. **The unit suite is unreliable.** Different failures on identical code. That hides real
   regressions as much as it creates false alarms.
4. **The ledger's stated conventions are wrong about IDs.** They describe monotonic `#NNN`; the
   file also contains alphanumeric ids and ULID comments. Correcting that prose is a separate,
   ledger-serial change.
