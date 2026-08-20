# Ward Flow Phase 3 — session handover

Written 2026-08-20, when the originating chat session ended. Everything a fresh Claude Code
session needs to continue Phase 3 with full context. Read this file first, then
`docs/ward-flow-phase-3-ledger.md`, then the plan.

---

## 1. Where the work is

**The work is NOT in `D:\Repos\Database`.** It lives in a separate Codex worktree:

| What             | Where                                                             |
| ---------------- | ----------------------------------------------------------------- |
| Worktree         | `C:\Users\joshs\.codex\worktrees\ward-management-design\Database` |
| Branch           | `codex/ward-management-design`                                    |
| HEAD at handover | `18f57736f`                                                       |
| State            | Clean tree, **59 commits ahead of `origin/main`, none pushed**    |
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

| Task                             | State                       | Commits                                           |
| -------------------------------- | --------------------------- | ------------------------------------------------- |
| 1 — model and fixture            | complete                    | `f3b1f74f0`, `39042cd61`, `2d59219d0`             |
| 2 — the reducer                  | complete                    | `3b76b093e`, `e7faa7b5a`                          |
| 3 — the contracts                | complete                    | `f01a4f8f3`, `cbdd47f71` (+ plan fix `e2b72a300`) |
| 4 — provider, clock, layout      | complete                    | `0612fdfa0`, `9ae334230`                          |
| 5 — coordinator rewire           | complete                    | `4d36099ca`, `868853b58`                          |
| 6 — the other nine routes        | **fix round 3 outstanding** | `af90428ce`, `b5caa5345`, `18f57736f`             |
| 7 — coordinator phone pin        | not started                 | —                                                 |
| 8 — the ward screen              | not started                 | —                                                 |
| 9 — transport officer phone      | not started                 | —                                                 |
| 10 — live tracker                | not started                 | —                                                 |
| 11 — emergency department screen | not started                 | —                                                 |
| 12 — role switcher + journey     | not started                 | —                                                 |

### The outstanding work, in full (ruling F12)

Two findings from the Task 6 review, neither a correctness bug in shipped code:

1. **The class-level clock guard in `tests/ward-flow-single-source.test.ts` overclaims.** It
   asserts that no component reading `useWardFlow()` also reads `NOW_ANCHOR`, but it only
   text-matches each file's _own_ imports. The reviewer proved the hole: it added a helper that
   reads `NOW_ANCHOR` internally, had `WardPatientWorkspace` call that helper, and the guard
   stayed green with a frozen clock read in the tree. Helper indirection, a namespace import,
   and any component not calling `useWardFlow()` all evade it.

   **The decided fix — invert the rule, do not attempt transitive import analysis.** Assert that
   `NOW_ANCHOR` is imported only by an explicit named allow-list: the fixture, `ward-sites.ts`
   itself, the provider, and tests. Every other reader fails, regardless of whether it calls
   `useWardFlow()`. Stronger, still a cheap text match, and it closes both evasions because a
   new reader must be declared to pass. Rename the guard and its comment to state exactly what
   it enforces.

   Prove it three ways: it fails on the helper-indirection case; it fails on a direct import;
   and it fails if the allow-list is emptied or the scan matches zero files.

2. **`src/components/ward-management/ward-management-modes.tsx:277`, `QueueView`,** holds
   `useState(movements[0])` — capturing a movement object by value rather than holding an id and
   re-deriving from live `movements`. Not exploitable today (nothing on that route mutates state
   and it remounts on navigation), but it is the "captured once, silently stale" shape Task 6
   exists to remove. `ward-management-network.tsx` already does it the safe way — hold the id,
   `.find()` against current state. Match that. If the `.find()` can miss, render an explicit
   absence; never fall back to another record.

   This touches a component serving several routes, so the browser gate must be re-run.

After that lands and is verified, Task 6 is complete and Task 7 is next.

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

## 7. One open question for the user, not blocking

When a patient is examined in the emergency department and ordered to an inpatient bed, what
should the countdown on screen represent, and over what period?

`EXAMINATION_TO_BED_WINDOW_MINUTES` in `src/components/ward-management/ward-model.ts` currently
holds **240** (four hours) as a synthetic placeholder, explicitly commented as awaiting clinical
confirmation and not a legal timeframe. Every 3B deadline in the fixture derives from it, and a
test pins that derivation, so changing the answer is a one-line change.

## 8. Resuming — the opening move

1. Confirm you are in `C:\Users\joshs\.codex\worktrees\ward-management-design\Database` on
   `codex/ward-management-design`, and that `git status` is clean at `18f57736f` or later.
2. Read `docs/ward-flow-phase-3-ledger.md` in full. It is the recovery map — the commits it names
   exist in git even when nothing else remembers them.
3. Invoke `superpowers:subagent-driven-development` with the plan file. It will find the existing
   ledger at `.superpowers/sdd/2026-08-19-ward-flow-phase-3-role-screens/progress.md` and resume;
   **do not re-dispatch tasks 1–5**, which are recorded complete.
4. Dispatch the Task 6 fix round described in section 3 above, verify it yourself, then continue
   to Task 7.
