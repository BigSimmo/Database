> **Committed copy taken 2026-08-20 for session handover.** The live ledger this was copied
> from is `.superpowers/sdd/2026-08-19-ward-flow-phase-3-role-screens/progress.md`, which is
> gitignored and does not travel with a clone or push. A continuing session should keep
> appending to that live copy — the skill's scripts expect it there — and refresh this file at
> the next handover. Start with `docs/ward-flow-phase-3-handover.md`.

# SDD ledger — plan: docs/superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md

Spec: docs/superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md (reachable, 19 sections)
Worktree: C:/Users/joshs/.codex/worktrees/ward-management-design/Database — branch codex/ward-management-design
Base at start: cf751504f (clean tree). Phase 2 complete and green at 04cf7bc53/3789eea62.
Build-order item 1 (correcting docs/ward-flow-context.md) already done at 7f373e80f.

## How this phase is being run (read this first on a fresh session)

Standing instructions from the user, carried from Phase 2. A session resuming this ledger inherits them:

- **Verify every claim a subagent makes.** Run `tsc --noEmit` and the test suites yourself after each task; never accept a pasted number. Phase 2's worst defects all passed their own tests.
- **Mutation-test, do not trust green.** For each new test, make the single change that should kill it, run, watch it fail, revert. Print the edited line back before trusting the run — several mutations have silently failed to apply this session and each nearly became a false negative.
- **Read gate output, never exit codes.** `npm run lint` exits 0 without running when the repo lock is held (`DATABASE_HEAVY_RUN_ADMISSION_BUSY`). A bare `npx playwright test` is rejected by a config guard while still looking like it ran — always pass `PLAYWRIGHT_BASE_URL` and read the "N passed" line.
- **Run the browser gate after any task touching the fixture, the reducer or a screen** — not only screen tasks. Skipping this let a browser regression sit undetected across three tasks (see ruling F5).
- **Send the user screenshots on every screen task**, and say what to look at. Look at the screen yourself, not only the test output.
- **Do not run `verify:ui`, `verify:release`, or any provider-backed gate.**
- **Rule, do not stall.** Decide ambiguities and plan defects, record each as a ruling with what it costs if wrong, and keep going. Stop only for something irreversible, destructive, security-sensitive, or a plan so broken every path forward is a guess. The full ruling list is owed to the user at the end.
- **Work in this worktree on `codex/ward-management-design`. No branch, no push, no PR.**

Open question with the user, not blocking: what the post-examination countdown should represent and over what period. `EXAMINATION_TO_BED_WINDOW_MINUTES` holds 240 until answered.

## Pre-flight scan

### Cross-task rows (shared file or interface)

| Tasks                 | Produces -> consumes                                                                                                    | Finding                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1 -> 2,3              | `Movement.formedAt/arrivalMode/bedHeldUntil/examination/withdrawnReferrals/escalation`, `Rejection`, `out_of_catchment` | Names match at every consumer. Clean.                                                    |
| 2 -> 3,4              | `seedWardFlowState`, `wardFlowReducer`, `WardFlowState`, `WardFlowEvent`, `WardFlowRole`                                | Match. Clean.                                                                            |
| 4 -> 5,6,8,9,10,11,12 | `useWardFlow()` returning `{ movements, units, rejections, now, dispatch }`                                             | Match. Clean.                                                                            |
| 5 -> 8                | `restrictionNotice(movement, unit)`                                                                                     | Task 5 defines it, Task 8 renders it. Clean.                                             |
| 5 -> 12               | the referral control's testid                                                                                           | **P1** — mismatch, see below.                                                            |
| 6 -> all              | the single-source static test                                                                                           | Only scans `.tsx`; the `.ts` entries in its ALLOWED set are inert. Harmless, noted.      |
| 7 -> 9                | the pinned-control pattern                                                                                              | Clean.                                                                                   |
| 8 -> 12               | `ward-unit-screen`, `ward-incoming-<id>`                                                                                | Match. Clean.                                                                            |
| 9 -> 12               | `ward-officer-job-<id>`                                                                                                 | Match. Clean.                                                                            |
| 1 -> 11               | `formedAt`, `arrivalMode`, `examination`                                                                                | **P2** — Task 11 asserts a community-formed patient at peel-ed; Task 1 never says where. |

### Per-task self-consistency rows

| Task | Finding                                                                                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 10 tests vs the fixture instructions. Verified against real data: 13 units have exactly one allocatable bed, 22 movements are Voluntary+Open, 14 are Open+non-voluntary, so every later test's fixture precondition holds. **P2** below. |
| 2    | 12 tests vs the reducer description. The last-bed test's `find` resolves to `rph-adult-secure`; WF-009 and WF-017 are both Adult/Secure so the cohort gate does not interfere. Clean.                                                    |
| 3    | 7 invariants vs `walk()`. Declines `fsh-adult-secure` with `out_of_catchment`, which Task 1 adds. Consistent.                                                                                                                            |
| 4    | 2 tests vs the provider. Clean.                                                                                                                                                                                                          |
| 5    | **P1** below.                                                                                                                                                                                                                            |
| 6    | Static test is `.tsx`-only; deleting `movementStageSummary` is pinned separately. Clean.                                                                                                                                                 |
| 7    | Clean.                                                                                                                                                                                                                                   |
| 8    | **P3** — the decline-reason assertion sits behind `if (await incoming.count())`, and at seed nothing is referred to `rph-adult-secure`, so it may never execute.                                                                         |
| 9-12 | Clean.                                                                                                                                                                                                                                   |

### Rulings made before execution

Ruling P1 — the plan's Task 5 and Task 12 tests select `[data-testid^="ward-candidate-"]`, but Phase 2 renders `ward-shortlist-candidate-`. The selector is corrected to the existing one in both tasks. Separately, Phase 2's control is `data-testid="ward-shortlist-confirm"` and the plan asserts `ward-shortlist-refer`: Task 5 renames it as part of turning Confirm into Refer, and that rename is now stated rather than implied. Cost if wrong: a test selecting nothing and passing vacuously, or failing for a reason unrelated to the code — the exact class this project keeps finding.

Ruling P2 — Task 1's fixture instruction now names **peel-ed** explicitly as one of the departments receiving a community-formed patient (`formedAt` earlier than `openedAt`). Task 11's ED-screen test asserts at least one such patient at peel-ed, and Task 1 as written only said "at least three carry a formedAt" without saying where. peel-ed has 7 open movements, so there is room. Cost if wrong: Task 11's test fails for a fixture reason rather than a code reason, and an implementer spends a round chasing it.

Ruling P3 — Task 8's decline-reason assertion is made unconditional. Checked the fixture: exactly five movements carry live `referredUnitIds` at seed (`sjgm-adult-open`, `gry-adult-secure`, `fsh-older-adult`, `bty-adult-secure`, and the pair `bty-older-adult`/`gry-older-adult`), and `rph-adult-secure` — the unit Task 8 stood on — is not among them, so the body behind `if (await incoming.count())` would never have run. Task 8 now targets `bty-adult-secure`, asserts `not.toHaveCount(0)` before acting, and Task 1 is told to preserve every existing `referredUnitIds` entry. A test body that cannot execute is a test that cannot fail, which is the defect class that consumed four Phase 2 rounds. Cost if wrong: Task 8 proves the decline flow on BTY rather than RPH — same code path, different unit.

## Task log

Plan edits for these three rulings are committed before Task 1 is dispatched, so every implementer reads the corrected text.

Plan corrections committed at fbd9a8628 (three rulings applied to the plan text) before Task 1 dispatch.

### Task 1 — the model and the fixture

BASE fbd9a8628. Brief: task-1-brief.md. Dispatched.

Implementer returned DONE at f3b1f74f0. Verified independently: tsc clean; 87/87 across the six suites; all five live `referredUnitIds` preserved; `peel-ed` carries WF-005 with a `formedAt`; zero `3A` codes remain.

Mutation check on the three fixture guards:

- `formedAt <= openedAt` -> flipped to `toBeGreaterThan`: KILLED.
- `bedHeldUntil` defined at `bed_held` -> flipped to `toBeUndefined`: KILLED.
- privacy guard -> `forbidden` widened to `new RegExp('.*')`: **SURVIVED**. Every `withdrawnReferrals` is `[]` and no movement carries an `escalation`, so both loop bodies execute zero times. The test cannot fail. This is the exact shape the Global Constraints name: "a guard that checks properties and never reads strings is how the Phase 1 privacy defect survived."

Fix round 1 dispatched to the same implementer.

Fix round 1 returned at 39042cd61. Verified independently, not taken on report: two `withdrawnReferrals` (WF-006, WF-018) and one `escalation` (WF-009) now carry synthetic operational text; the guard accumulates what it inspects and asserts `>= 3`. I killed it twice myself — once by widening `forbidden` to `new RegExp('.*')` (1 failed, 9 passed) and once by emptying every `withdrawnReferrals` back to `[]` (1 failed, 9 passed) — then reverted both and re-confirmed 87/87 and tsc clean. All five live `referredUnitIds` intact.

Task reviewer dispatched on fbd9a8628..39042cd61.

Task 1: complete. Commits f3b1f74f0, 39042cd61. Reviewer: APPROVED / APPROVED, no findings; it re-ran the suite and re-mutated the privacy guard itself rather than trusting the report, and hand-computed the generator's `index % 7 === 3` bed-held indices (304, 311, 318, 325) to confirm that loop is not empty either. One interpretation noted and accepted: three of the five ex-3A records go straight to 3B rather than passing through 1A, which matches the user's ruling that 3B in ED means awaiting bed and 1A means awaiting examination.

### Task 2 — the reducer

BASE 39042cd61. Brief: task-2-brief.md. Dispatched.

Implementer returned DONE at 3b76b093e — 13 tests, not the brief's stated 12 (the brief's own verbatim test file always had 13; a plan miscount, not a defect). Verified independently: 13/13 pass, tsc clean. Mutation-tested four things myself, each applied and reverted in isolation:

- seed aliases the fixture instead of `structuredClone`: KILLED "copies the fixture rather than aliasing it".
- role gate short-circuited to `false`: KILLED "refuses an event raised by the wrong role". The implementer's report doubted this test; the doubt is wrong.
- parallel-referral cap check removed: KILLED "never refers above the parallel cap".
- `HOLD_BED` never decrements `allocatable.value`: KILLED two tests, including "consumes the bed and closes the record".

Ruling F1 — `RECORD_EXAMINATION` sets `dueAt` to `now + 240`, an unnamed magic number no test pins. The fixture's own three 3B records sit at roughly `openedAt + 405`, `+740` and `+820`, so 240 matches nothing, and 4 hours is the ED access target rather than a detention window. It becomes a single named exported constant with a pinning test, and the value is raised with the user as a clinical figure to confirm rather than silently invented. Cost if wrong: one constant and one test line; but left as-is it would put a fabricated legal deadline on the ED screen in Task 11, which is precisely the "surface stating something the data does not support" class.

Task reviewer dispatched on 39042cd61..3b76b093e, with F1 and the four confirmed mutations excluded so it does not re-report them. Its primary assignment is the unpinned-branch gap: 15 event branches against 13 tests.

Reviewer: APPROVED (spec) / CHANGES REQUESTED (quality). Test file byte-identical to the brief; nothing required missing, nothing extra added. Finding: 6 of 15 event branches have zero test exposure anywhere in the repo. The reviewer proved it rather than asserting it — it replaced each branch body with `return state` and the full 62-test suite stayed green. Ranked: `RECORD_EXAMINATION`'s `inpatient_order` branch (flips the legal form 1A -> 3B, the highest-consequence transition in the file), `CONFIRM_CAPACITY`, `DECLINE`, then `RECORD_ESCALATION` / `ADVANCE_CLOCK` / `RESET_SCENARIO`. Plus a non-blocking note: `PATIENT_ARRIVED` decrements `empty.value` with no floor check, where `HOLD_BED` guards `allocatable.value <= 0`.

Ruling F2 — pin all six in Task 2 rather than leaving them to Task 3's contract walk. Task 3 exercises `DECLINE` incidentally via its `fsh-adult-secure` out-of-catchment case, so three of the six would plausibly acquire indirect cover later. Leaning on that is how gaps survive: an incidental pass through a branch does not assert what the branch did, and the branch at issue changes a patient's legal status. Cost if wrong: six cheap unit tests that partly duplicate Task 3's coverage.

Fix round 1 dispatched to the same implementer, carrying F1 (the `dueAt` constant, value held at 240 pending the user's clinical answer) and the `PATIENT_ARRIVED` floor check.

Fix round 1 returned at e7faa7b5a — 21 reducer tests (was 13), 43/43 across the two suites, tsc clean. Verified independently: I replaced each of the seven branch bodies with `return state` in isolation and all seven killed at least one test — `RECORD_EXAMINATION` 2, `CONFIRM_CAPACITY` 2, `DECLINE` 1, `RECORD_ESCALATION` 1, `ADVANCE_CLOCK` 2, `PATIENT_ARRIVED` 2, `RESET_SCENARIO` 1.

My own first `RESET_SCENARIO` mutation was invalid and I nearly recorded a false negative: the regex matched the first `case "RESET_SCENARIO":` in the file, which is inside `subjectId()`, not the reducer's. The suite stayed green because nothing had been mutated in the branch under test. Re-applied against the reducer's own branch and it killed "resets a genuinely mutated state back to the seed, not just back to itself". Second time this session that a mutation silently failed to apply — from here every mutation gets its post-edit file content printed before the run, not just an assertion that the string changed.

The implementer also confirmed the `PATIENT_ARRIVED` floor gap was genuinely reachable rather than theoretical: `CONFIRM_CAPACITY` can raise `allocatable.value` above `empty.value`, so arrivals can outrun physically empty beds. It added the guard and a test walking that exact sequence.

`EXAMINATION_TO_BED_WINDOW_MINUTES = 240` now exists in `ward-model.ts` per F1, held at 240 pending the user's clinical answer.

Scoped re-review of 3b76b093e..e7faa7b5a: ALL FINDINGS ADDRESSED. Two things it established that my mutation runs could not: the new `PATIENT_ARRIVED` floor guard blocks no legitimate sequence, because no event in the `WardFlowEvent` union ever increments `unit.empty.value` — there is no discharge or release event in this phase, so once `empty` reaches 0 it can only stay there; and the seven new tests assert specific fields and values rather than merely killing the `return state` mutation. One softness recorded and accepted: the arrival-floor test asserts `stage !== "arrived"` rather than the exact resulting stage, while still pinning `empty.value` at 0 and the `no_bed` rejection.

Task 2: complete. Commits 3b76b093e, e7faa7b5a. Reducer tests 13 -> 21; 43/43 across the two suites; tsc clean.

Open question for the user, not blocking: what the post-examination countdown should represent and over what period. `EXAMINATION_TO_BED_WINDOW_MINUTES` holds 240 until answered.

### Task 3 — the contracts

BASE e7faa7b5a. Brief: task-3-brief.md. Dispatched.

Implementer returned DONE at f01a4f8f3 — 7 contract invariants, not the brief's stated 6 (second plan miscount; the brief's verbatim code always had 7). It self-reported, unprompted, that two of the seven were vacuous and two more only died under forced mutations. That disclosure is the right outcome and saved a review round.

Confirmed independently: the walk's subject `WF-009` arrives with three declines already recorded at seed — `rph-adult-secure` (`no_bed`), `gry-adult-secure` (`acuity_mix`), `bty-adult-secure` (`bed_held_for_earlier_referral`) — and `referredUnitIds: []`. Invariants 4 and 5 therefore assert against fixture state, not walk state.

Ruling F3 — fix the walk's subject rather than its assertions. Of the 18 hand-authored records, only WF-001, WF-003, WF-004, WF-005 and WF-006 carry neither seed declines nor seed referrals, and only WF-001 is early enough in its journey (`placement_requested`, Adult/Open) to walk the whole path. Rebuilding on WF-001 makes every decline, referral and withdrawal the invariants inspect one the walk itself caused. Patching the assertions instead would have left the same trap for the next person to widen the walk. Cost if wrong: the walk exercises an Adult/Open journey rather than Adult/Secure, so the secure-cohort gate is proven by the reducer's own tests instead of by the contract walk.

Also instructed: stop routing invariant 2 through `unitCapacity()`, which is defensively robust and so absorbs the arithmetic errors the invariant exists to catch — read raw counts before and after each bed-moving step; and give invariant 7 a real rejection to inspect plus the Task 1 accumulate-and-assert-count tripwire.

Fix round 1 dispatched.

Fix round 1 returned at cbdd47f71 — walk rebuilt on WF-001, 28/28 across contracts and reducer. Verified the two invariants that were vacuous, by mutating the reducer writes they depend on:

- `ACCEPT_IN_PRINCIPLE` stops appending to `withdrawnReferrals`: KILLED "records the withdrawal the referral's own acceptance caused".
- `DECLINE` stops appending to `declines`: KILLED "never returns a declined unit to that patient's eligible candidates".

My first attempt at the DECLINE mutation was itself invalid — `...movement.declines.slice(0, 0)` drops the prior declines but still appends the new one, so the invariant correctly stayed green. Third invalid mutation this session, and the same root cause each time: not reading what the edited line actually says afterwards. The printed-file-content-before-running discipline caught it this time.

Task reviewer dispatched on e7faa7b5a..cbdd47f71.

Reviewer: CHANGES REQUESTED (spec, documentation only) / APPROVED (quality). It confirmed all five invariants I had not checked die under realistic single-line reducer changes — including the two previously weak ones: killing `HOLD_BED`'s decrement now gives `expected 3 to be 2` directly rather than being absorbed by `unitCapacity()`, and the privacy invariant now inspects 39 real strings and fails on the regex itself, not merely on the tripwire count. It also confirmed the walk reaches `stage: "arrived"` and that `state.rejections` holds a real entry.

The spec finding is that the built file is not the brief's code verbatim — different subject, different units, one added wrong-role event. That deviation is ruling F3, made deliberately, so the defect is in the plan text, not the code.

Ruling F4 — correct the plan rather than the code. Task 3's step now states 7 tests and carries a paragraph explaining why the subject is WF-001 and directing the reader to the built file for the units and payloads that follow. Task 2's stale "12 tests" is corrected to 13 the same way. A plan that disagrees with its own built artefact is how a later reader "restores" the vacuous version. Cost if wrong: none — it is documentation catching up with a decision already made and verified.

Task 3: complete. Commits f01a4f8f3, cbdd47f71, plus plan reconciliation e2b72a300. 28/28 across contracts and reducer; tsc clean.

### Task 4 — the provider, the clock and the layout

BASE e2b72a300. Brief: task-4-brief.md. First task needing a running dev server and Playwright. Dispatched.

### Task 4 — the provider, the clock and the layout

Implementer returned DONE at 0612fdfa0. Unit tests 4/4 (it added 2 beyond the brief's 2). Playwright: **20 passed, 1 failed**, not the 21 the plan requires. Two deviations it disclosed, both accepted: the DOM test is named `ward-flow-provider.dom.test.tsx` because this repo's Vitest config only collects `*.dom.test.tsx` for jsdom — under the brief's literal name it would never have run at all, which is the "test that cannot fail" shape in its purest form; and the brief's `useRef`-read-during-render clock sketch trips this repo's `react-hooks/refs` lint rule, so it uses a lazy `useState` initializer with the same compute-once-at-mount guarantee.

**The failing journey is not Task 4's, and it is not "pre-existing" in the sense the implementer meant.** It reported reproducing the failure with its own files removed, which rules out Task 4 but not Tasks 1-3 — and Tasks 1-3 are entirely offline, so no Playwright ran across three tasks. I reproduced it and read the error: `ui-ward-coordinator.spec.ts:269` expects the coordinator queue's top row to show "passed its deadline"; the top row is WF-017, whose deadline is no longer in the past. Before Task 1, WF-017 was a 3A with `dueAt: NOW_ANCHOR - 25`. Task 1 converted it to 3B and set `dueAt: NOW_ANCHOR + 5`, removing the only breach at the top of the queue.

Process failure, mine: I ran the browser gate only when a task created a screen. A task that changes the fixture or the reducer changes what every existing screen renders. From here the ward Chromium journeys run after any task touching either.

Ruling F5 — do not relax the Phase 2 assertion; fix the data, and retire the class rather than the instance. Checked all three 3B records against their own examinations: WF-003 examined `-60` with `dueAt +480`, WF-009 examined `-45` with `dueAt +400`, WF-017 examined `-10` with `dueAt +5`. Not one is `examination.at` plus any consistent interval, while Task 2's reducer now derives exactly that from `EXAMINATION_TO_BED_WINDOW_MINUTES`. So a patient examined by the reducer would get a derived deadline and a patient examined in the fixture an invented one, and Task 11's ED screen would render both as if they meant the same thing. Every 3B `dueAt` becomes `examination.at + EXAMINATION_TO_BED_WINDOW_MINUTES`, pinned by a test, with WF-017 examined at `NOW_ANCHOR - 260` so it sits past its window — a detained patient examined four hours ago and still waiting for a bed is the case the board exists to surface. Cost if wrong: the three examined patients' deadlines shift, and if the user's answer on the window is not 240 minutes they shift again — but by one constant, which is the point.

Fix round 2 dispatched to the Task 1 implementer, with the browser gate as its acceptance criterion.

Task 1 fix round 2 returned at 2d59219d0. Verified myself rather than from the report: all three 3B deadlines are now written literally as `NOW_ANCHOR <examination offset> + EXAMINATION_TO_BED_WINDOW_MINUTES` — WF-003 examined -60, WF-009 examined -100, WF-017 examined -260 and so 20 minutes past its window. 61/61 across the four unit suites, tsc clean, and I ran the browser gate myself: **21 passed (44.5s)**. Mutating one deadline by a single minute kills "derives every 3B deadline from its own examination rather than inventing one".

The implementer surfaced a second, genuinely pre-existing issue while fixing the first: `WF-303`, a _generated_ movement from Phase 1/2's `routineMovements` formula, has always carried a coincidentally-breached tier-1 deadline, previously masked by WF-009's invented one. It resolved the ordering by moving WF-009's `examination.at` — within the latitude the brief gave it — rather than touching WF-303 or relaxing the test. WF-303's own breach stands, untouched and out of scope. Worth carrying forward: a generated movement whose index-derived deadline lands in the past is not wrong, but nothing states it deliberately.

Task 4 + Task 1 fix round 2 packaged together for review as e2b72a300..2d59219d0.

Task 4 reviewer: APPROVED / APPROVED with one residual risk. It confirmed by grep that no wall-clock read exists anywhere under `src/components/ward-management/**` outside `ward-clock.ts` and the provider; that the pinned path provably never calls `setInterval` (spy test, not "starts and ignores"); that the interval is cleaned up; that the reducer seeds exactly once via a lazy `useReducer` initializer; that `useWardFlow()` throws a named error matching the existing `useAccountData` convention; and that `layout.tsx` matches `node_modules/next/dist/docs/05-server-and-client-components.md` § "Context providers" — a plain server layout wrapping a `"use client"` provider. The fixture commit's new pin test iterates a dynamically filtered non-empty set rather than a hard-coded id list, and touches only `legalForm.dueAt` and `examination.at`.

Ruling F6 — fix the midnight wrap now rather than capturing it. `wallClockNow()` returns minutes since midnight and wraps to 0 at 24:00, while the provider computes `elapsed = Math.max(0, wallClockNow() - mountedAt)` on the assumption the value only rises. A session left open across midnight clamps to 0 and every deadline on every screen silently freezes at the moment of the wrap. It is pre-existing Phase 2 code and no test can see it, since every test pins `initialNow` — which is exactly why it would survive the whole phase. This is a prototype that gets demonstrated live, the failure is invisible until it matters, and the fix is arithmetic. Required the wrap to be extracted as an exported pure function so it is reachable from a test at all. Cost if wrong: a few lines in the provider and one unit test.

Also correcting a comment claiming `wallClockNow()` is read once per mount when the unpinned path calls it every render. The behaviour is fine; the claim is not, and an untrue comment is the same defect class as an untrue surface.

Fix round 1 dispatched to the Task 4 implementer.

Session interruption: the Task 4 fix-round agent was killed with the previous Claude Code process and left its work uncommitted — `ward-clock.ts`, `ward-flow-provider.tsx`, `tests/ward-clock.test.ts`. The work was complete and correct, so I verified and committed it myself rather than re-dispatching (Ruling F7; the same call as Phase 2's F32 for Task 5's lost implementer).

Recovered fix, verified before committing: `elapsedMinutesSinceMount(mountedAt, current)` is a new exported pure function in `ward-clock.ts` that unwraps a negative difference by adding `MINUTES_PER_DAY`, with three tests covering same-day, the 23:50 -> 00:10 rollover, and the 23:59 -> 00:00 boundary. Restoring the old `Math.max(0, raw)` kills two of them. 13/13 across the clock and provider suites, tsc clean, browser gate **21 passed (54.3s)**. The overstated comment is corrected too — it now says `wallClockNow()` is called on every unpinned render and that only `mountedAt` is captured once.

Task 4: complete. Commits 0612fdfa0, 9ae334230 (plus Task 1's fix round 2 at 2d59219d0).

### Task 5 — the coordinator rewire

BASE 9ae334230. Brief: task-5-brief.md. First screen task: the coordinator screen goes live and Confirm becomes Refer. Screenshots owed to the user at the end of this task.

Implementer returned DONE_WITH_CONCERNS at 4d36099ca. Verified myself: browser gate **23 passed (49.1s)** — 21 pre-existing plus 2 new; `tsc --noEmit` clean after deleting the corrupted `.next/dev/types/validator.ts` artefact (the known trap, hit again); and I drove the screen in a real browser rather than reading test output. The Refer control reports `aria-disabled="true"` before a ward is picked and drops it after; referring writes "Referred by a human coordinator to RPH Adult Secure at 10:42. Up to 3 parallel referrals allowed; no bed has been allocated automatically" onto the screen; the flow diagram picks up "Outstanding referral". Four screenshots captured and three sent to the user.

Two things the screenshots confirmed beyond the tests: WF-017 renders "Form 3B passed its deadline 20 min ago", so ruling F5's derived deadline reaches the surface; and WF-303 renders "Form 1A passed its deadline 1 min ago", the coincidentally-breached generated movement, still unexplained by anything in the data.

Implementer's concern 2 is the one that matters: it left `flow-diagram.tsx` untouched, so the diagram still uses the older `isMoreRestrictiveThanRequired` / `MORE_RESTRICTIVE_NOTE` pair while the shortlist uses the new `restrictionNotice`. The user ruled explicitly that a voluntary patient on a locked ward gets its own flag, and only the new function makes that distinction. Not ruling on it yet — the reviewer is asked to establish whether the diagram is ever _wrong_ or merely less specific, and to recommend closing it here or at Task 8.

It also found and fixed a real regression mid-task: its first `eligibleCandidates` reordering changed candidate membership rather than order and broke the network route's test. Reviewer is checking whether the landed fix is itself pinned.

Task reviewer dispatched on 9ae334230..4d36099ca.

Task 5 reviewer: CHANGES REQUESTED / CHANGES REQUESTED. Three findings.

**Finding 1, the most consequential defect of the phase so far — the screen claims a referral succeeded when the reducer refused it.** Confirmed myself by reading both sides: `handleRefer` dispatches and then calls `setConfirmation(...)` unconditionally, while `REFER_TO_UNITS` rejects unless the stage is `placement_requested` or `destination_review`, appending a `Rejection` and leaving `referredUnitIds` untouched. The reviewer drove it live on WF-004 (`bed_held`, open in the queue, all three shortlist candidates eligible): `referredUnitIds` unchanged, a rejection appended reading "cannot refer a movement while it is bed_held", and the screen still showing "Referred by a human coordinator … no bed has been allocated automatically". Nine of the eighteen hand-authored movements sit in a non-referable stage while still open, so this is half the board. New to Task 5 — the old Confirm control never dispatched anything at all.

Ruling F8 — fix all three layers rather than the visible symptom. The control stops advertising an action it cannot perform (stage referability folded into `canRefer`, `aria-disabled` plus a reason naming the actual stage); the referral record is derived from the movement's own `referredUnitIds` so it is structurally incapable of claiming a referral that did not happen; and a refusal is surfaced with the reducer's own reason rather than swallowed. Guarding the button alone would leave the optimistic banner able to lie the next time a guard is missed, and deriving alone would leave a control that looks available and silently does nothing. Cost if wrong: more surface area changed in one round than the finding strictly required.

Finding 2 — the `eligibleCandidates` membership regression the implementer found and fixed mid-task is only caught incidentally, by one Playwright assertion on one unit name for one movement; the contract test passes `Number.POSITIVE_INFINITY` and never engages truncation. A direct "reordering never changes top-N membership" test is required.

Finding 3 — the new "shows a refused transition" Playwright test is vacuous: it opens Exceptions with zero rejections ever raised and asserts `/refus/i`, which the empty-state copy itself contains. It must raise a real refusal and assert its specific reason text.

Ruling F9 — close the flow-diagram restriction question here rather than at Task 8, accepting the reviewer's finding that it is not a Task 5 defect. All six `Voluntary` movements in the fixture also carry `security: "Open"`, so the older `isMoreRestrictiveThanRequired` fires in every case `restrictionNotice` would flag `voluntary_on_locked`: the diagram is never wrong today, only less specific. But `security` and `legalStatus` are independent fields, so a future voluntary-plus-Secure record would make the diagram silently wrong while the shortlist beside it was right. Task 8 owns closing that, and it is now explicitly its job rather than an assumption. Cost if wrong: the diagram stays blunter than the shortlist for two more tasks, on data where the two never disagree.

Fix round 1 dispatched.

Fix round 1 returned at 868853b58 — browser gate **24 passed**, ward Vitest 166, tsc clean. Verified the headline finding myself in a live browser on WF-004 (`bed_held`): the Refer control carries `aria-disabled="true"` and the title "WF-004 cannot be referred while it is bed held — referral is only available while placement is requested or a destination is under review"; a forced click does nothing; the screen makes no referral claim. Screenshot sent to the user.

Scoped re-review: ALL FINDINGS ADDRESSED, with the part I could not check myself established properly. It enumerated all five `REFER_TO_UNITS` refusal branches — role mismatch, missing movement, parallel cap, non-referable stage, unknown unit id — and confirmed every one routes through `reject()`, which appends to `rejections` and never touches `state.movements`. Both success paths now read `movement.referredUnitIds` fresh, so they are structurally incapable of lying regardless of which branch fires, rather than merely guarded against the single case that was found. `canRefer`'s new stage term is a strict copy of the reducer's own `REFERRABLE_MOVEMENT_STAGES`, so nothing previously referable is now blocked.

It killed all three new tests itself, including the sharpest check available on finding 3: it rewrote the reducer's rejection text to different wording that still contains "refus", and the test still failed — proving it asserts the real reason rather than the empty-state substring. CRLF verified at byte level, not by grep, which gave a false positive on this machine.

Task 5: complete. Commits 4d36099ca, 868853b58.

### Task 6 — the other ten routes

BASE 868853b58. Brief: task-6-brief.md. Starting conditions confirmed: `export const movementStageSummary = stageSummaries(wardMovements)` still at ward-derivations.ts:55, and exactly three components still import the fixture directly — `ward-management-console.tsx`, `ward-management-modes.tsx`, `ward-management-network.tsx`. Dispatched.

Implementer returned DONE at af90428ce — 16/16 unit, tsc clean, browser gate 24 passed. Its Step 6 browser proof is the evidence the task actually needed: it referred WF-001 to SCGH Adult Open on the coordinator, then clicked the Priority-queue and Movements rail links without reloading, and WF-001 moved from "Placement requested" to "Destination review" on the movements board while the queue page's badge flipped from "Suggested destination" to "Eligibility check". It also widened the static single-source scan to `.ts` as instructed, and reported three offenders where the brief predicted four rather than fabricating the fourth.

Ruling F10 — the `NOW_ANCHOR` question the implementer raised as a scoping call is not one; it defeats the task, and the fix is required. The coordinator destructures the ticking `now` from `useWardFlow()`, while the three rewired files still read `NOW_ANCHOR` at roughly nineteen sites for waiting times, elapsed labels, eligibility verdicts, capacity freshness and the "Updated …" stamp. Half an hour into a live session the same patient reads "7h 10m waiting" on one screen and "6h 40m waiting" on another. Task 6 exists to stop two screens disagreeing about one patient; movements are now shared and the clock is not, so they still disagree, just about something else. Two consequences are worse than the drift: `eligibility(patient, unit, NOW_ANCHOR)` folds in capacity freshness, so a ward can read fresh on one screen and stale on another — a clinical decision surface stating what the data does not support; and the reducer's `ADVANCE_CLOCK` offset lives in the provider's `now`, so anything anchored to `NOW_ANCHOR` ignores a clock advance entirely, which Task 12's demo controls would have surfaced at the worst moment. Cost if wrong: about nineteen call sites change in three files that the brief's literal substitution list did not name.

Required with it: a test that dispatches `ADVANCE_CLOCK` and asserts one of these routes moves in step with the coordinator. Every existing test pins the clock, so this whole class of bug is invisible to the suite as it stands.

Fix round 1 dispatched. The implementer was right to flag rather than silently decide — that is the behaviour that made this catchable.

Fix round 1 returned at b5caa5345 — all three files now read zero `NOW_ANCHOR`, ward Vitest 55, tsc clean, browser gate 24 passed. Its browser re-check showed the same patient reading `1h 35m waiting` identically on the coordinator queue and the movements board.

Verified the new `ward-flow-clock-consistency.dom.test.tsx` myself and it is honest for its own surface: reverting the exact call site it reads — `ward-management-modes.tsx`, the movements card's `elapsedLabel(patient, now)` beside `movementHealthService` — kills it. My first mutation attempt hit line 200, a different `elapsedLabel(patient, now)` in the detail panel, and **every test stayed green**.

Ruling F11 — that survival is the finding, not a bad mutation. The test pins one surface out of roughly nineteen, so the instance is guarded and the class is not, which is the same gap as Task 1's invented deadlines: three records fixed, the rule that produced them left alone. It matters more here because every other test in the suite pins the clock, so a frozen read reintroduced anywhere else is invisible to all of them. Required a static guard in the existing single-source test asserting that no component reading `useWardFlow()` also reads `NOW_ANCHOR`, scoped by that rule rather than by naming three files so a later route is covered automatically, and failing if the scan matches zero files. Cost if wrong: one extra static assertion, and a legitimate epoch reader would need an explicit named allow-list entry.

Fix round 2 dispatched.

Fix round 2 returned at 18f57736f — 57 ward Vitest, tsc clean, browser gate deliberately not re-run and said so plainly (test-file-only change). Verified the guard myself with the mutation that previously survived: reverting the detail-panel `elapsedLabel(patient, now)` at ward-management-modes.tsx:200 now kills "has no component holding both the live clock and the frozen epoch". The class is retired, not just the instance. `CLOCK_EXEMPT` is empty by design — `ward-flow-provider.tsx` reads `NOW_ANCHOR` legitimately but never calls its own `useWardFlow()`, so it was never in scope for the rule.

Task reviewer dispatched on 868853b58..18f57736f, with its primary assignment being what the guard does _not_ catch: a component importing a helper that itself reads the frozen epoch, a route that never calls `useWardFlow()` and so sits outside the rule entirely, or a frozen value obtained some other way. Also asked to enumerate all ten routes for `useMemo` dependency arrays omitting `now` and for helpers still carrying a defaulted time parameter, since a default is how a frozen value creeps back.

Task 6 reviewer: APPROVED (spec) / CHANGES REQUESTED (quality), both findings non-blocking. It verified all nine routes individually — zero `wardMovements`, `allUnits`, `movementStageSummary` or `NOW_ANCHOR` reads remain, `useMemo` dependency arrays correct, `candidatesFor` and `settingFit` take `now` as a required parameter rather than a default — and checked the Next 16 server/client boundary against the doc text directly.

Ruling F12 — the class-level clock guard I recorded under F11 as retiring the class does not. The reviewer proved the hole live: it added a helper reading `NOW_ANCHOR` internally, had `WardPatientWorkspace` call that helper instead of `now`, and the guard stayed 5/5 green with a frozen read in the tree. It text-matches each file's own imports, so helper indirection, a namespace import, and any component not calling `useWardFlow()` all evade it. Nothing exploits it today, but I built policy on a check that promises more than it delivers — which is exactly what stops anyone looking harder.

Inverting the rule rather than attempting transitive import analysis: `NOW_ANCHOR` may be imported only by an explicit named allow-list — the fixture, `ward-sites.ts`, the provider, and tests — and every other reader fails, whether or not it calls `useWardFlow()`. Stronger than the current rule, still a cheap text match, and it closes helper indirection and the outside-the-rule case together because a new reader must be declared to pass. The guard's name and comment must also state exactly what they enforce. Cost if wrong: a legitimate future epoch reader needs one allow-list line.

Second finding, small: `ward-management-modes.tsx:277`'s `QueueView` holds `useState(movements[0])`, capturing a movement object by value instead of holding an id and re-deriving from live state — the "captured once, silently stale" shape this task exists to remove, with the safe pattern already in use one file over in `ward-management-network.tsx`. Not exploitable today (nothing on that route mutates state, and it remounts on navigation).

Also corrected: this is nine routes, not the ten the plan and my briefs have been saying — the coordinator, seven mode routes, and the patient workspace.

Fix round 3 dispatched, and it is the last for this task.
