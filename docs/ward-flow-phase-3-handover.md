# Ward Flow Phase 3 — session handover

Written 2026-08-20; refreshed 2026-08-21 after Task 6 closed. Everything a fresh Claude Code
session needs to continue Phase 3 with full context. Read this file first, then
`docs/ward-flow-phase-3-ledger.md`, then the plan.

---

## 1. Where the work is

**The work is NOT in `D:\Repos\Database`.** It lives in a separate Codex worktree:

| What             | Where                                                             |
| ---------------- | ----------------------------------------------------------------- |
| Worktree         | `C:\Users\joshs\.codex\worktrees\ward-management-design\Database` |
| Branch           | `codex/ward-management-design`                                    |
| HEAD at handover | `f4963f28a`                                                       |
| State            | Clean tree, **63 commits ahead of `origin/main`, none pushed**    |
| Dev server       | `npm run ensure` → `http://localhost:3718` (never assume a port)  |

The 59 commits exist **only on this machine**. Nothing is pushed and no PR exists — that was
the user's explicit instruction ("do not create a branch, do not push, do not open a PR").

## 2. The three documents that carry the context

| Document                                                                     | Committed?                     | Purpose                                                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `docs/superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md` | yes                            | The binding authority. 19 sections. Conflicts resolve against this.                                        |
| `docs/superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md`        | yes                            | 12 tasks, 71 steps, with the exact test code for each. Already corrected in three places during execution. |
| `docs/ward-flow-phase-3-ledger.md`                                           | yes (copied here for handover) | The execution record: every task's commits, every ruling, what was verified and how.                       |
| `docs/ward-flow-context.md`                                                  | yes                            | Cold-start orientation for the whole Ward Flow project (Phases 1–3).                                       |

**The live ledger is `.superpowers/sdd/2026-08-19-ward-flow-phase-3-role-screens/progress.md`,
and that whole directory is gitignored** (`.superpowers/sdd/.gitignore` is a single `*`). It
does not travel with a git push or clone. `docs/ward-flow-phase-3-ledger.md` is a committed
copy taken at handover. A continuing session should keep appending to the `.superpowers` copy
(the skill's scripts expect it there) and re-copy to `docs/` at the next handover.

The same directory also holds, all gitignored: a `task-N-brief.md` for all 12 tasks, a
`task-N-report.md` and `task-N-review.md` for tasks 1–6, and eight `review-<base>..<head>.diff`
files. 680 KB total. Useful but reconstructible — the briefs regenerate from the plan with
`scripts/task-brief`, and the diffs regenerate from git.

## 3. Exactly where execution stopped

Tasks 1–5 are **complete**: implemented, reviewed, every finding fixed, every fix verified.

**Task 6 is implemented and reviewed but has one outstanding fix round (ruling F12).** The
subagent carrying it was killed mid-work by a monthly spend limit. It committed nothing — the
tree is clean, so there is no orphaned work to recover, only work to redo.

Tasks 7–12 have not started. Their briefs are already extracted.

### Task-by-task state

| Task                             | State                    | Commits                                           |
| -------------------------------- | ------------------------ | ------------------------------------------------- |
| 1 — model and fixture            | complete                 | `f3b1f74f0`, `39042cd61`, `2d59219d0`             |
| 2 — the reducer                  | complete                 | `3b76b093e`, `e7faa7b5a`                          |
| 3 — the contracts                | complete                 | `f01a4f8f3`, `cbdd47f71` (+ plan fix `e2b72a300`) |
| 4 — provider, clock, layout      | complete                 | `0612fdfa0`, `9ae334230`                          |
| 5 — coordinator rewire           | complete                 | `4d36099ca`, `868853b58`                          |
| 6 — the other nine routes        | complete (5 fix rounds)  | `af90428ce` … `f4963f28a`                         |
| 6A — the ED clock counts up      | **next — brief written** | —                                                 |
| 7 — coordinator phone pin        | not started              | —                                                 |
| 8 — the ward screen              | not started              | —                                                 |
| 9 — transport officer phone      | not started              | —                                                 |
| 10 — live tracker                | not started              | —                                                 |
| 11 — emergency department screen | not started              | —                                                 |
| 12 — role switcher + journey     | not started              | —                                                 |

### What changed on 2026-08-21, and what is outstanding now

**Task 6 is complete** at `f4963f28a`, after five fix rounds. Three of those went to a single
static guard — the one asserting that no screen reads the frozen epoch `NOW_ANCHOR` instead of
the live clock. It overclaimed in three successive forms, each found by someone deliberately
trying to defeat it rather than by running it:

1. **Co-occurrence scoping** (ruling F12) — it flagged a file only if it both called
   `useWardFlow()` and named-imported `NOW_ANCHOR`, so helper indirection, a namespace import,
   and any component outside the rule all walked past it.
2. **Directory scoping** (ruling F18) — rebuilt as a named allow-list, but walking only
   `src/components/ward-management` while its test name claimed "every read". A probe file one
   directory out left it green.
3. **A hand-rolled scanner** (ruling F20) — it stripped comments and strings character by
   character with no concept of a regex literal, so a quote inside a regex desynced it and
   blinded it to the rest of that file. Two real files under `src` carry exactly that pattern.

It is now a cheap `includes("NOW_ANCHOR")` pre-filter plus a real TypeScript-parser walk over the
six files that survive it — more correct than the scanner, and about twice as fast.

**The clinician answered the standing open question** (§7, now closed): the post-examination
number is not a countdown at all. It counts **up** — how long the patient has been in the
department — and it feeds priority. That invalidates a modelled deadline rather than retuning it.
It is now **Task 6A**, inserted before Task 7, with its brief already written at
`.superpowers/sdd/2026-08-19-ward-flow-phase-3-role-screens/task-6a-brief.md`. Rulings F15 to F17
and F23 carry the reasoning. The short version:

- `EXAMINATION_TO_BED_WINDOW_MINUTES` and the Form 3B `legalForm.dueAt` are deleted, and `dueAt`
  becomes optional so a 3B honestly carries none. Seven surfaces must then handle absence
  explicitly instead of rendering a fabricated number.
- **But the four hours are real** — they were attached to the wrong quantity. Spec §7 requires the
  **emergency department access target**, a departmental performance measure counted up from
  `openedAt`. It returns as its own named constant that must never touch a `LegalForm`. Without
  this, Task 6A would delete a feature Task 11 requires.
- The Form 1A examination countdown is untouched and stays a countdown. That assumption was
  stated back to the clinician rather than buried.

**A machine trap now seen three times.** This box's vitest worker pool is unreliable under load.
A multi-file jsdom invocation returned `Test Files 1 passed (1) / Tests 1 passed (1)` with
`Errors 2` — two of three files never ran, while the summary line read like a pass.
`VITEST_MAX_WORKERS=1` did not help. Run jsdom suites one file per invocation and check the
counts. **The count is the evidence, never the word "passed".**

## 4. How the user wants this run

These are standing instructions from the user, carried from Phase 2. They are not optional and
they are the reason this phase has found what it has found.

- **Verify every claim a subagent makes.** Run `npx tsc --noEmit` and the test suites yourself
  after each task. Never accept a pasted number. Phase 2's worst defects all passed their own tests.
- **Mutation-test; do not trust green.** For each new test, make the single change that should
  kill it, run, watch it fail, revert. **Print the edited line back before trusting the run** —
  several mutations silently failed to apply during this phase and each nearly became a recorded
  false negative.
- **Read gate output, never exit codes.** `npm run lint` exits 0 without running when the repo
  lock is held (it prints `DATABASE_HEAVY_RUN_ADMISSION_BUSY`). A bare `npx playwright test` is
  rejected by a config guard while still looking like it ran.
- **Run the browser gate after any task touching the fixture, the reducer, or a screen** — not
  only screen tasks. Skipping this let a browser regression sit undetected for three tasks (F5).
- **Send the user screenshots on every screen task** and say what to look at. Look at the screen
  yourself, not only at test output.
- **Do not run `verify:ui`, `verify:release`, or any provider-backed gate.**
- **Rule, do not stall.** Decide ambiguities and plan defects, record each ruling with what it
  costs if wrong, and keep going. Stop only for something irreversible, destructive,
  security-sensitive, or a plan so broken every path forward is a guess.
- **Work in this worktree on this branch. No new branch, no push, no PR.**
- **Talk to the user in plain English.** He is a psychiatrist, not a software engineer. Lead with
  the answer, say what he needs to do as numbered steps, no jargon, no file paths unless they
  change his decision. Full style rules are in `C:\Users\joshs\.claude\CLAUDE.md`.

## 5. Commands that matter

```bash
npm run ensure
```

Starts or verifies the dev server and prints its URL. Run before any browser work.

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3718 npx playwright test tests/ui-ward-coordinator.spec.ts tests/ui-ward-management.spec.ts --project=chromium --reporter=line
```

The ward browser gate. **24 must pass** at `18f57736f`. Read the "N passed" line.

```bash
npx vitest run tests/ward-flow-reducer.test.ts tests/ward-flow-contracts.test.ts tests/ward-model-phase3.test.ts tests/ward-flow-single-source.test.ts tests/ward-flow-clock-consistency.dom.test.tsx
```

The Phase 3 unit suites.

```bash
npx tsc --noEmit -p tsconfig.json
```

If this reports errors inside `.next/dev/types/`, delete `.next/dev/types/validator.ts` and
re-run — it is a Next-generated artefact corrupted by a dev-server restart, not source. This
happened repeatedly during the phase.

## 6. Traps this phase actually hit

- **`.next/dev/types/validator.ts` goes corrupt** whenever the dev server is killed mid-write,
  turning `tsc` red for no source reason. Delete and re-run.
- **Writing files from Python in text mode on this Windows box injects CR bytes.** Use explicit
  `newline=""`. Check at byte level — `grep` gave a false positive here.
- **A Playwright `page.goto()` re-mounts the provider and resets all state.** Any test asserting
  the effect of a dispatch must stay on the same page and navigate by clicking.
- **The repo lock** silently no-ops heavyweight npm scripts. Always read their output.
- **`npm run format` can hang for minutes** on lock contention. `npx prettier --write <files>`
  instead.
- Two unused-variable lint warnings in the reducer files are **pre-existing** and not Phase 3's.

## 7. The open question, answered 2026-08-21

Asked: when a patient is examined in the emergency department and ordered to an inpatient bed,
what should the on-screen countdown represent, and over what period?

Answered, verbatim: _"It is just counting how long they have been in ED determining priority. So
counting up."_

So there is no post-examination deadline. See §3 for what that invalidates and what replaces it.
Three things remain unconfirmed and were stated to the clinician rather than assumed silently:
that the Form 1A pre-examination countdown stays a countdown; that being detained and examined
confers no priority bonus of its own beyond elapsed time; and whether four hours is the correct
access target for WA metro emergency departments.

## 8. Resuming — the opening move

1. Confirm you are in `C:\Users\joshs\.codex\worktrees\ward-management-design\Database` on
   `codex/ward-management-design`, and that `git status` is clean at `f4963f28a` or later.
2. Read `docs/ward-flow-phase-3-ledger.md` in full. It is the recovery map — the commits it names
   exist in git even when nothing else remembers them.
3. Invoke `superpowers:subagent-driven-development` with the plan file. It will find the existing
   ledger at `.superpowers/sdd/2026-08-19-ward-flow-phase-3-role-screens/progress.md` and resume;
   **do not re-dispatch tasks 1–5**, which are recorded complete.
4. Tasks 1-6 are complete. Dispatch **Task 6A** from its written brief, verify it yourself, then
   continue to Task 7. Tasks 7-12 are the six screen tasks, and each owes the user screenshots.
