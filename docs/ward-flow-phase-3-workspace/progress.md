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

## Session 2 — resumed 2026-08-20

New controller session. Confirmed the worktree, branch `codex/ward-management-design`, clean tree at f3ebd8ccf (60 commits ahead of origin/main, none pushed). Live ledger and the committed copy at `docs/ward-flow-phase-3-ledger.md` agree apart from Prettier reflow, so no ledger work was lost with the previous session.

Independent baseline taken before dispatching anything, not read from the previous session's report: `tsc --noEmit` clean, and 58 unit tests green across the seven Phase 3 suites.

Ruling F13 — dispatch a fresh implementer for Task 6 fix round 3 rather than resuming the original. The skill routes rounds 1-3 back to the original implementer, but that agent died with the previous Claude Code process and cannot be resumed across sessions. The fresh agent gets the brief, the accumulated report file and the findings verbatim, which is the persistent memory the skill names for exactly this case. Cost if wrong: the fresh implementer re-derives context the original held, costing turns rather than correctness.

Ruling F14 — the Phase 3 unit suites must be run in two invocations, not one. Running all seven together fails 2 of 7 with `[vitest-pool-runner]: Timeout waiting for worker to respond`, while the same files pass when the jsdom `.dom.test.tsx` pair is run separately (53 node-env + 5 jsdom = 58). This is environment contention between jsdom and node pools on this machine, not a source defect. Recorded because a single-invocation run reports 5 files passed and looks green at a glance while silently dropping two suites — the "gate that did not run" shape, and this phase's standing instruction is to read gate output rather than exit codes. Cost if wrong: two extra seconds per verification run.

Task 6 fix round 3 dispatched (fresh implementer, sonnet) carrying `task-6-fix-round-3-findings.md`: the inverted `NOW_ANCHOR` allow-list guard under F12, and the `QueueView` captured-movement fix. BASE f3ebd8ccf.

### The open clinical question is answered — and it invalidates a modelled deadline

The user answered the standing question about the post-examination clock: **"It is just counting how long they have been in ED determining priority. So counting up."**

So there is no post-examination deadline at all. The number on screen is elapsed time in the emergency department, ascending, and it feeds placement priority. `EXAMINATION_TO_BED_WINDOW_MINUTES = 240` was not merely the wrong value — the quantity it represents does not exist.

What the code does today, read rather than assumed:

- `ward-model.ts:50` holds the constant; `ward-flow-reducer.ts:177` derives `dueAt = event.now + 240` when `RECORD_EXAMINATION` records an inpatient order; three fixture records (WF-003, WF-009, WF-017) derive their 3B `dueAt` the same way under ruling F5.
- Seven surfaces read `legalForm.dueAt` and treat it as statutory: the priority queue's breach row, the shortlist panel's `"passed its deadline N min ago"`, `buildActionInbox`'s "Legal timing breached" exception, the pressure strip's breach counts, the console's "due <time>" line, and `operationalScore`'s 30-point "Statutory timing" factor.
- So a 3B patient currently renders a fabricated statutory breach and is awarded 30 priority points for it. That is the "surface stating something the data does not support" class this phase exists to catch, now confirmed clinically false by the user rather than merely suspected.

What is already right and must not be rebuilt: `elapsedLabel` counts up from `openedAt`, and `operationalScore`'s "Time waiting" factor already awards up to 40 points at one point per 15 minutes elapsed. That _is_ the user's rule. The defect is the fabricated deadline layered on top of it, not a missing count-up.

Ruling F15 — delete the modelled post-examination deadline rather than retune its value, and make `LegalForm.dueAt` optional so a 3B form can honestly carry none. Retuning the constant would keep every surface asserting a statutory breach the Act does not impose; the user's answer says the quantity is not a deadline, so no value for it is correct. Making `dueAt` optional forces each of the seven readers to handle absence explicitly instead of rendering a fabricated number, which is the same discipline applied to the shortlist's missing-record case. The 1A (awaiting examination) countdown is untouched and stays a countdown — the user's answer was scoped to the post-examination case, and this assumption is stated back to him rather than buried. Cost if wrong: if a real post-examination timeframe is later supplied, it returns as an optional field on the same type plus one derivation — the readers' absence handling stays correct either way.

Ruling F16 — land this as its own task inserted between Task 6 and Task 7, not as a controller-side edit and not deferred into Task 11. Two reasons. The Task 6 fix implementer is live in `ward-management-modes.tsx` and `tests/ward-flow-single-source.test.ts` right now, so editing alongside it would collide. More importantly Tasks 8 to 12 render this quantity — Task 11 _is_ the ED screen — so correcting the meaning after they are built means retrofitting five screens instead of one model. Controller-side fixes also skip review, which is the one thing this phase's defect record says never to do. Cost if wrong: one extra task-and-review cycle before Task 7 starts.

Ruling F17 — the Playwright assertion at `tests/ui-ward-coordinator.spec.ts:269`, which ruling F5 satisfied by engineering WF-017's 3B breach to the top of the queue, must be re-satisfied from a genuinely breached 1A instead. Checked the fixture: WF-001 (`dueAt: NOW_ANCHOR - 15`) and the movement at ward-movements.ts:114 (`dueAt: NOW_ANCHOR - 40`) both carry real breached examination deadlines, so a true breach is available without inventing one. Under no circumstances relax that assertion to keep it green — it is the check that a breached statutory deadline reaches the surface, and it is now the only kind of legal breach the prototype claims. Cost if wrong: the queue's top row is a different patient in the demo.

### Task 6 fix round 3 — returned and independently verified

Fix round 3 returned DONE at c8f7b22ec (three files: the guard, `ward-management-modes.tsx`, and a new `tests/ward-flow-queue-selection.dom.test.tsx`).

Verified myself, not taken on report. Gates re-run in this session: `tsc --noEmit` clean (after deleting the corrupted `.next/dev/types/validator.ts` artefact — the known trap, hit again), node-env suites **53 passed**, jsdom suites **6 passed** (up from 5, the one new test), ward browser gate **24 passed (4.1m)**. Every number in the implementer's report matches what I measured.

Mutation-tested the new guard myself with three mutations of my own, each printed back from the file before running and reverted after:

- **Namespace import** — `import * as wardSites from ".../ward-sites"` plus `wardSites.NOW_ANCHOR` in `coordinator-screen.tsx`: KILLED. This is the form the fix-round-2 rule missed entirely.
- **Helper indirection** — a new `ward-frozen-helper.ts` reading `NOW_ANCHOR` internally: KILLED, and it flags the helper file itself with no component calling it. That is what actually closes the hole the reviewer found under F12: the helper cannot exist unflagged, so there is nothing for a component to hide behind.
- **Emptied allow-list**: KILLED, naming exactly `ward-sites.ts`, `ward-movements.ts` and `ward-flow-provider.tsx`. Every entry is doing real work — no inert names, which is the defect the older `ALLOWED` set carried.

The `QueueView` fix matches `WardNetworkWorkspace`: id in state, `useMemo` `.find()` against live `movements`, and an explicit "No synthetic movement matches the current selection" panel instead of any fallback record. The absence guard sits in the JSX, so hooks above it still run unconditionally.

Ruling F18 — the rebuilt guard is scoped to one directory while its name claims the whole rule, so fix round 4 is required rather than closing the task here. I probed it: a file at `src/lib/ward-probe/frozen.ts` importing `NOW_ANCHOR` and re-exporting a frozen elapsed helper leaves the suite **5 passed**, fully green. The test is named "restricts every read of NOW_ANCHOR to the named allow-list" and it restricts every read _inside `src/components/ward-management`_. This repo has roughly 200 modules under `src/lib`, and a ward screen importing a time helper from there is an ordinary thing to do, so the escape is not exotic. It is also the identical defect to F12 one layer out — a check promising more than it delivers, which is precisely what stops anyone looking harder — and the fix is to widen the scan to `src` while keeping the fixture-import rule where it is. Cost if wrong: the scan walks a few hundred more files and the allow-list needs path-qualified keys rather than bare basenames to avoid a collision.

Fix round 4 dispatched. Findings 1 and 2 look correct to me but have not been reviewed yet, so the scoped re-review after round 4 covers c8f7b22ec and the round-4 commit together rather than round 4 alone.

### Task 6 fix round 4 — agent lost to a usage limit, work recovered and verified

The fix round 4 implementer was terminated mid-run by a hard usage limit (resets 03:50 Perth), the same failure mode that ended the previous session. It had committed nothing, but unlike the earlier loss it left a complete, correct change in the working tree: `SRC_DIR = "src"`, path-qualified allow-list keys, a `normalizePath` helper for the Windows separator mismatch, and both test bodies rescoped. Its final self-instruction was to revert its last mutation — which it had in fact already done, and no probe directory survived.

**My own error, recorded because it nearly cost the work.** Reaching for a proof run I ran `git checkout -- tests/ward-flow-single-source.test.ts` _before_ taking a backup, which reverted the uncommitted round-4 work to HEAD and destroyed it. Nothing was stashed and nothing was committed, so git held no copy.

Ruling F19 — reconstruct from the diff already read into context and apply it as a patch that git verifies, rather than retyping the file or re-dispatching under a usage limit. `git apply --check` passed, which means every context line matched the HEAD file byte-for-byte; only the added lines came from transcription, and the five mutation proofs below exercise exactly those. A hand-retyped file would have had no such verification, and re-dispatching was unavailable. Cost if wrong: a transcription error in an added line, which the proof set and `tsc` would have to catch — and did have to catch, since that is now the only thing standing behind those lines. Byte check: 8245 bytes, **0 CR bytes**, Prettier reports the file unchanged.

All five proofs run by me against the reconstructed file, each printed back from disk before the run:

- **Out-of-tree named import** — `src/lib/ward-probe/frozen.ts`, the exact probe that defeated round 3: KILLED, naming the file. The F18 gap is closed.
- **Out-of-tree namespace import** — `import * as sites` then `sites.NOW_ANCHOR`: KILLED.
- **Emptied allow-list**: KILLED, naming exactly `ward-sites.ts`, `ward-movements.ts` and `ward-flow-provider.tsx` — every entry doing real work, no inert names. This also proves the forward-slash normalisation matches on Windows, since a broken `normalizePath` would have made the populated list fail instead.
- **Zero-match tripwire** — `SRC_DIR` pointed at an empty directory: KILLED.
- **Comment trap** — `coordinator-screen.tsx` names `NOW_ANCHOR` at line 38 in a doc comment and is not allow-listed: stays GREEN, so the comment/string stripping still works.

Gates, all re-run by me at 845b7d456: `tsc --noEmit` clean; node-env suites **53 passed**; the wider ward suites (`ward-management`, `ward-priority`, `ward-pressure`, `ward-derivations`, `ward-model`) **58 passed**, run because widening a scan to all of `src` can surface readers the ward suites never touch; jsdom suites **6 passed**. Browser gate deliberately not re-run and said so plainly: this commit changes one test file and no `src` file, and I ran the gate myself at c8f7b22ec (**24 passed, 4.1m**).

Trap worth carrying forward: the first jsdom invocation returned `Test Files no tests / Tests no tests` and exited 0. Re-running the identical command gave 3 files / 6 passed. This environment can report a vitest run that silently collected nothing while looking successful — the purest form of the "gate that did not run" shape this phase keeps guarding against. Always read the file and test counts, never the exit code.

Cost noted, not acted on: widening the scan took the guard's own runtime from ~80 ms to ~7 s. Acceptable for a static guard that runs in the unit suite; flagged so nobody is surprised.

### Scoped re-review of rounds 3 and 4 — two ADDRESSED, one real Critical

Reviewer verdicts: Finding 1 (guard evadability) ADDRESSED; Finding 2 (`QueueView` stale selection) ADDRESSED and live-verified with a real dispatch test; Finding 3 (guard scope) ADDRESSED on its literal requirements, but the widening exposed a defect in the mechanism underneath.

**Critical, and I reproduced it myself rather than taking the report.** `stripCommentsAndStrings` has no concept of a regex literal. A quote character inside a regex opens a phantom string and desyncs comment/string tracking for the remainder of the file, so every later line is invisible to the scan. Two real files under `src` carry exactly that pattern — `clinical-dashboard/search-utils.ts:331` (`/"[^"]+"|(?:^|\s)'[^']+'(?=\s|$)/`) and `lib/document-summary-badges.ts:61` — and both are newly in scope precisely because round 4 widened the walk to `src`.

My reproduction: appended a plain `import { NOW_ANCHOR } from "@/components/ward-management/ward-sites"; export const leaked = NOW_ANCHOR;` to the end of `search-utils.ts`, printed the appended lines back from disk, and ran the guard: **5 passed**, fully green, with an ordinary named import of the frozen epoch in the tree. Restored from backup, tree clean. This is a genuine false negative in the exact property round 4 claims to hold — the third time this guard has promised more than it delivers.

Ruling F20 — replace the hand-rolled scanner with the TypeScript compiler's own parser behind a cheap substring pre-filter, rather than teaching the scanner about regex literals. Distinguishing a regex literal from a division operator requires the preceding token, which is the classic reason ad-hoc JavaScript scanners are wrong; a heuristic there would buy a fourth version of the same overclaim. Meanwhile only **6 files under all of `src` contain the string `NOW_ANCHOR` at all**, so `source.includes("NOW_ANCHOR")` discards every other file instantly and the exact parser runs on six. That is both more correct and faster than what it replaces, and it deletes the hand-rolled scanner rather than patching it. Cost if wrong: the test gains a `typescript` import (already a repo dependency, used by `tsc`) and the guard's correctness now rests on the same parser the build already trusts.

Ruling F21 — treat the guard as load-bearing right now rather than parking this at the round cap. It would be defensible to park a tripwire nothing currently trips: no file under `src` reads `NOW_ANCHOR` outside the allow-list today, and the false negative only fires in a file carrying a quote-bearing regex ahead of the read, which the two known files do and a new ward screen would not. But Tasks 7 to 12 add six screens in exactly the area this guard polices, so it has to work _during_ the remaining work, not after it. Cost if wrong: one more fix round spent on a test file at the cap.

Ruling F22 — dispatch round 5 on the same model tier rather than escalating as the skill's rounds 4-5 rule directs. The escalation exists for an implementer that cannot see its own problem; here the diagnosis and the replacement design are both settled and written down, which makes this transcription plus proof rather than design. The account also hit a hard usage limit mid-round-4, so spending a more expensive tier on specified work risks losing the round to the ceiling again. Cost if wrong: one round at the cap, after which I adjudicate rather than dispatch again.

Fix round 5 dispatched — the last for this task. BASE 845b7d456.

### Pre-flight scan of the remaining tasks — one real defect found before dispatch

Scanned briefs 7 to 12 against the state the branch is actually in, prompted by the clinician's clock answer. No brief references `dueAt`, `EXAMINATION_TO_BED_WINDOW_MINUTES`, or a Form 3B deadline, so ruling F15 breaks nothing by name. But Task 11 requires "the four-hour access target", and the spec is explicit at §7:

> Time against the four-hour access target is shown, because that is the number a department is judged on and mental health patients are its largest breachers.

Ruling F23 — refine F15 rather than let it delete a required feature. The four-hour figure is real, but it was attached to entirely the wrong quantity. It is the **emergency department access target** — a departmental performance measure counted **up from `openedAt`**, the time the patient has been in the department — and the spec names it as such, distinct from the Mental Health Act clocks it lists separately. What Task 2 built under ruling F1 instead bolted 240 minutes onto `legalForm.dueAt` for a Form 3B, derived from `examination.at`, and rendered it through surfaces that call it statutory timing and count it as a legal breach. So the number was not wrong; its meaning, its anchor, and its rendering all were. Ledger entry F1 even recorded at the time that "4 hours is the ED access target rather than a detention window", and it was wired to the legal form anyway.

Therefore: `EXAMINATION_TO_BED_WINDOW_MINUTES` and the post-examination `legalForm.dueAt` are deleted as F15 requires, and a separately named ED access-target constant of 240 minutes is introduced for Task 11, measured from `openedAt`, labelled on screen as a departmental access target and never as a legal or statutory deadline. This also matches the clinician's answer exactly — a count-up from arrival in the department, which is what an access target is.

Cost if wrong: if the access target is not four hours in WA metro EDs, it is one named constant on one screen. If the two had been left conflated instead, Task 11 would have rendered a performance measure and a detention clock as the same kind of thing on a screen a clinician reads — the precise failure this phase exists to prevent.

Task 6A's brief amended accordingly before dispatch.

### Task 6 fix round 5 — landed and independently verified

Returned at f4963f28a. `stripCommentsAndStrings` is deleted; `readsNowAnchor` now does a cheap `source.includes("NOW_ANCHOR")` pre-filter and then parses the survivors with `ts.createSourceFile`, walking for an identifier node named `NOW_ANCHOR`. Comments and string contents are not identifier nodes, so they are excluded by construction rather than by a scanner that has to be right about regex literals.

Verified myself, not from the report:

- **The regression that caused the round**: appended a plain `import { NOW_ANCHOR } … ; export const leaked = NOW_ANCHOR;` to `search-utils.ts` — the file whose quote-bearing regex blinded the v4 scanner — printed the lines back from disk, ran the guard: **KILLED**, naming `search-utils.ts`. The Critical is closed.
- **No new false positive**: `export const note = "NOW_ANCHOR is the frozen epoch…"` in the same non-allow-listed file stays **5 passed**. A mention is not a read.
- Restored `search-utils.ts` from backup both times and confirmed `git status` clean each time, so the file is byte-identical to its commit.

Gates re-run by me at f4963f28a: `tsc --noEmit` clean; node-env suites **53 passed**; wider ward suites **58 passed**; jsdom **6 passed** (1 + 4 + 1, run one file at a time — see below). Browser gate not re-run: this commit changes one test file and no `src` file, and I ran it myself at c8f7b22ec (**24 passed, 4.1m**).

Trap, now seen three times and worth treating as standing: this machine's vitest worker pool is unreliable under load. A three-file jsdom invocation returned `Test Files 1 passed (1) / Tests 1 passed (1)` with `Errors 2` — two of the three files never ran, while the summary line looked like a pass. `VITEST_MAX_WORKERS=1` did not fix it and produced the same truncated result. Running each jsdom file in its own invocation gave the true 1 + 4 + 1. **The count is the evidence, never the word "passed".** The implementer hit the same thing and reported ~78 resident `node.exe` processes, consistent with contention rather than regression.

Guard runtime improved as predicted by F20: roughly 12.5s under v4's whole-tree character scan, 5–8s under v5's pre-filter-plus-parser. More correct and faster.

Implementer's third concern is accurate and needs no action: `task-6-report.md` has no round-4 section because the round-4 agent was killed by the usage limit before it could report. That round's full record lives in this ledger instead, and the work itself is committed at 845b7d456.

**Task 6: complete.** Commits af90428ce, b5caa5345, 18f57736f, c8f7b22ec, 845b7d456, f4963f28a. Five fix rounds, three of them spent on one static guard that overclaimed in three successive forms — co-occurrence scoping, directory scoping, and a hand-rolled scanner. Each was found by someone deliberately trying to defeat the check rather than by running it.

### Task 6A — the ED clock counts up. Implemented at 2d8200a09, independently verified

Returned DONE_WITH_CONCERNS. 16 files: `LegalForm.dueAt` is now optional, `EXAMINATION_TO_BED_WINDOW_MINUTES` is gone and `ED_ACCESS_TARGET_MINUTES = 240` replaces it with a doc comment forbidding it from ever touching a `LegalForm`, the reducer's 1A→3B transition no longer invents a deadline, the three fixture 3B records drop theirs, and the surfaces handle absence.

Gates re-run by me at 2d8200a09: `tsc --noEmit` clean; node-env suites **114 passed** across 10 files; jsdom **6 passed** (1 + 4 + 1, one file per invocation); ward browser gate **24 passed (2.1m)**.

**Verified on the actual screen, which is what this task was really about.** The Browser pane cannot composite frames in this session — the implementer hit the same wall and reported no screenshots — so I drove headless Chromium directly against the running dev server and dumped the queue. Result:

```
WF-303  7h 51m waiting   Operational 61   Form 1A passed its deadline 1 min ago
WF-009  7h 00m waiting   Operational 53
WF-312 13h 24m waiting   Operational 50
```

Whole-page counts: `3B` appears **0 times**, `passed its deadline` 4 times, `due in` 0 times. So every remaining breach on the coordinator is a genuine Form 1A examination-window breach, and WF-009 — examined, detained, awaiting a bed — now shows only elapsed time counting up with no deadline claim of any kind. That is exactly the clinician's rule reaching the surface. Screenshot at `artifacts/ward-management/phase3-6a-coordinator.png`, sent to the user.

Ruling F17 is satisfied honestly and without touching the assertion: the top row is no longer WF-017 propped up by a fabricated breach, it is WF-303 with a real 1A breach, and the "passed its deadline" test passes unchanged.

The implementer's judgment call is sound and I checked the diff rather than the description: the "refers a patient to up to three wards" test previously clicked the queue's first row, which was only ever WF-017 because the fabricated deadline inflated its score. It now selects WF-002 by id. No assertion was weakened — only which movement is clicked — and selecting by explicit id matches every other test in that file.

**Two findings of my own, carried into the task review rather than fixed here:**

1. `tests/ui-ward-coordinator.spec.ts` around line 266 still comments "WF-017 (first row) has a passed Form 2A deadline". That is now wrong twice over — the first row is WF-303, and its form is 1A, not 2A. The "2A" was already wrong before this task. An untrue comment beside a passing assertion is what this phase has repeatedly ruled is the same defect class as an untrue surface.
2. **The demo now leads with an accident.** WF-303 is a _generated_ movement whose breached deadline comes from the `index % 7` formula in `routineMovements`, not from anything authored deliberately — the Task 1 fix round flagged exactly this and left it out of scope. It has now been promoted to the top of the queue and is the first thing anyone sees. A synthetic prototype whose headline case is unintentional is not wrong, but nothing states it, and Task 12's guided journey may well walk a user straight into it.

### Task 6A review — spec PASS, quality PASS WITH IMPORTANT FINDINGS

0 Critical, 2 Important, 2 Minor. The reviewer confirmed both of my findings and improved on both.

It verified independently what I could not: it grepped every `.dueAt` read in the whole repo rather than trusting the brief's list of seven and found the list complete; it confirmed `ED_ACCESS_TARGET_MINUTES` is quarantined from every legal-breach path; and it established a stronger guarantee than the brief asked for — an absent `dueAt` reaching arithmetic is a **compile error**, not merely a convention, which it proved by mutating a guard, getting a `tsc` type error, and reverting.

**Important 1 — the stale comment exists twice, and the second copy is a live fragility, not just wrong prose.** I fixed my attention on line 266 and missed that lines 611-644 carry the same assumption in executable form: the "shows a failing gate" test still does `.first().click()` and names the result `wf017Gates`, with a doc comment whose entire rationale — "WF-017's default candidate `rph-adult-secure` passes all eight gates, so the brief's conditional block would silently skip" — is about a movement that is no longer row 1. The implementer fixed exactly this shape 300 lines below and left this one. It passes today only because WF-303 happens to render 8 gates too.

**Important 2 — the implementer's report contains a false verification claim.** It states WF-001 and WF-005 "reach the top of their tier honestly". The reviewer ran the real `queueOrder`/`operationalScore` against the real fixture: WF-303 is rank 1 (score 61), WF-009 rank 2 (53), WF-001 rank 6, and WF-005 is not in tier 1 at all. The report contradicts itself, naming WF-303 correctly elsewhere in the same document. No code defect — my own browser dump had already established the true ordering independently — but a report that asserts an unrun check is the failure this phase's verify-everything rule exists to catch, and it is recorded rather than quietly dropped.

**Minor 1**, worth acting on before Task 11: `ED_ACCESS_TARGET_MINUTES`'s test pins only its numeric value. Nothing structurally stops Task 11 from attaching it to a `LegalForm` — precisely the mistake this task exists to undo.

**Correction to my own ledger entry above.** I wrote that WF-303's breach comes from an `index % 7` formula. That is wrong and I had not verified it. `index % 7` governs `security`. The real mechanism, read from `ward-movements.ts:585-592`: a generated movement gets a Form 1A only when `index % 3 === 0`, and its deadline is `NOW_ANCHOR + (((index * 53) % 400) - 60)`, so it is breached whenever `(index * 53) % 400 < 60` — roughly one in seven of those that have a form at all. The finding stands and is if anything sharper: the patient now heading the demo is breaching because of a multiply-and-modulo, and nothing in the fixture says so.

**On the "look at the screen" requirement:** the reviewer reports it as unmet by anyone, having hit the same Browser-pane compositing failure. That is not right, and I am recording the evidence rather than leaving the review's version standing. I drove headless Chromium against the running dev server myself, dumped the queue rows and whole-page string counts (`3B` × 0, `due in` × 0, four genuine 1A breaches), and captured `artifacts/ward-management/phase3-6a-coordinator.png`, which was sent to the user. The requirement is met; only the Browser-pane route to it is broken.

Fix round 1 dispatched with Important 1 and Minor 1. Important 2 needs no code change and is adjudicated here as recorded-not-fixed.

### Task 6A fix round 1 — returned at f1e32dcd4, independently verified

Two files, test-only. Site A repinned to `WF-017` **by id** rather than by rank, with the variable name and doc comment corrected; the implementer checked against the real fixture that WF-017 is now rank 9 (score 41) and that its default candidate still passes all eight gates, so it kept WF-017 rather than switching movement — the right call, since the test's contrast with WF-009's failing gate depends on that property. Site B is comment-only: "first row" and the "Form 2A" error corrected, `firstRow`/`secondRow` left position-based as required, and the `"passed its deadline"` assertion untouched.

**I broke the new quarantine guard myself rather than trusting the report.** Added `ED_ACCESS_TARGET_MINUTES` to `ward-movements.ts`'s imports and wired it into WF-003's 3B as `dueAt: NOW_ANCHOR + ED_ACCESS_TARGET_MINUTES`, printed both edited lines back from disk, and ran it: **both** new checks failed — "never lets a file that constructs a LegalForm reference ED_ACCESS_TARGET_MINUTES" and "never assigns a LegalForm's dueAt from ED_ACCESS_TARGET_MINUTES" — each naming `ward-movements.ts`. Restored from backup, `git status` clean. The prohibition in the constant's doc comment now has a shape that can actually fail, which is what Minor 1 asked for.

Gates re-run by me at f1e32dcd4: `tsc --noEmit` clean; node-env **118 passed** across 10 files (was 114 — four new static checks); jsdom **6 passed** (1 + 4 + 1); ward browser gate **24 passed (3.1m)**.

The jsdom worker flake hit me again mid-verification: `ward-flow-provider.dom.test.tsx` returned `Test Files no tests / Tests no tests` with an unhandled error, and passed 4/4 on an immediate re-run with nothing changed. Fourth occurrence. The implementer independently reported six consecutive worker-start timeouts on the same file with 23 concurrent node processes resident. This is now a well-characterised property of this machine under load, not a signal about any change.

Cost noted: the single-source guard file is getting expensive — the two new AST checks take roughly 26s and 23s, and the node-env suite is now ~77s total against ~10s before Task 6. Still cheap against what it prevents, but it will not take many more whole-tree AST guards before it needs a shared parse cache.

Fix round 1's scoped re-review dispatched over 2d8200a09..f1e32dcd4.

### Pre-flight scan of Task 7, before dispatch

Task 7's brief was extracted from the plan before Tasks 6 and 6A landed, and its test code no longer holds. Four corrections, written to `task-7-addendum.md` and given precedence over the brief.

Ruling R24 — the brief's test selects the queue row with `.first().click()`. That is the exact fragility Task 6A removed from two separate tests: until 6A, row 1 was always WF-017 only because a fabricated Form 3B deadline inflated its score, and the real ordering is now WF-303, WF-009, with WF-017 at rank 9. The row must be pinned by id, chosen deliberately as a genuinely **referable** movement since the test asserts a referral control is reachable, and the property verified against the fixture rather than assumed. Cost if wrong: the test proves the pinned bar on a different movement — same code path, different patient.

Ruling R25 — the brief writes `await expect(page.evaluate(...)).resolves.toBe(...)`. `.resolves` is Jest/Vitest vocabulary and may not exist on Playwright's `expect`; if it silently no-ops, the scroll assertion becomes a test that cannot fail, which is the defect class that has already cost this phase several rounds. Rewritten as `expect(await page.evaluate(...)).toBe(...)`, which needs no matcher support. Cost if wrong: none — the plain form is strictly safer.

Ruling R26 — a fixed bottom bar is the one thing in this repo most likely to collide with the phone chrome contract, so I established the answer before dispatch rather than letting an implementer discover it. `/ward-management` is **not** in the `(search-app)` route group and its layout is only `WardFlowProvider` — no global search shell, no phone composer dock, no existing dock reserve. So the "one composer per page" rule is not engaged and a pinned bar is safe here. Carried with it: the bar paints its own safe-area inset flush to the viewport bottom, and production tap targets are `min-h-12`, **not** the `min-h-11` that generic WCAG guidance teaches — 44px reintroduces a known `ui-smoke` sub-pixel flake. Cost if wrong: a second fixed bottom element on a route that turns out to have one, which the addendum tells the implementer to re-confirm.

Ruling R27 — the brief's "capture a screenshot and look at it" step cannot be done through the Browser pane, which cannot composite frames in this environment; the Task 6A implementer, its reviewer and I all hit it independently. The addendum carries a working headless-Chromium recipe instead, the same one that produced the Task 6A screenshot, and requires the capture to happen **after** selecting a patient so the pinned bar is actually showing something. Cost if wrong: none — it replaces a blocked route to the evidence with one proven to work.

Also confirmed before dispatch, so the implementer is not chasing a stale premise: `coordinator.module.css` exists, and the nested double-`requestAnimationFrame` `scrollIntoView` the brief targets is really at `coordinator-screen.tsx:85-88`, with a comment explaining why a single frame was not enough. The addendum tells the implementer to read that comment before deleting it and to speak up if it names a constraint the pinned bar does not satisfy.

### Task 6A fix round 1 re-review — both findings ADDRESSED, two new risks

Important 1 ADDRESSED (Site A pins `ward-queue-row-WF-017` by id; Site B's comment now names WF-303 and 1A). Minor 1 ADDRESSED for the literal scenario. 0 new Critical, 0 new Important breakage.

The reviewer did the thing I could not: it reimplemented both new AST checks verbatim and probed **twelve** construction shapes empirically, and it independently reproduced the fixture ordering bit-for-bit against the real `queueOrder`/`operationalScore` (WF-303 rank 1 score 61, WF-009 rank 2 score 53, WF-017 rank 9 score 41, WF-017's default candidate passing all eight gates). Given the previous report on this task asserted a fixture claim that was false, that independent reproduction is worth more than the verdict.

Ruling R28 — the `ED_ACCESS_TARGET_MINUTES` quarantine overclaims, and rather than chase completeness I am narrowing its claim and moving the real enforcement to where it can work. Both checks are file-scoped with no cross-statement or cross-file data flow, so an intermediate local, an aliased import, a `{ ...base, dueAt }` spread, a cross-file helper, or a direct `legalForm.dueAt = CONST` mutation all evade them whenever the consuming file does not also spell out a fresh `{code,label,kind}` literal. That is precisely the shape Task 11's ED screen will have, since it derives from an existing movement rather than authoring a new form — so the guard is weakest exactly where its one real consumer will exercise it. Completing it would need cross-file data-flow analysis, which is a type-checker's job and which I already ruled against for the `NOW_ANCHOR` guard. So: the checks keep their real value as a tripwire for the naive case, their names and comments must state the scope they actually enforce, and Task 11's brief carries the prohibition explicitly with its reviewer assigned to check it by reading the code. A guard whose name matches its reach is worth more than one that quietly does not. Cost if wrong: Task 11 could still wire the constant onto a legal form through a helper, and only a human reading the diff would catch it — which is why it goes in the brief rather than being left to the guard.

Ruling R29 — fix the runtime now rather than defer it, because it will cost the remaining six tasks repeatedly. The two new whole-`SRC_DIR` scans roughly doubled `ward-flow-single-source.test.ts` from ~28-33s to ~52-58s, against a 30s-per-test ceiling that this same file has already timed out against during this task; my own mutation run measured the two new checks at 26s and 23s individually. Nothing failed in the reviewer's run (9/9), so this is a risk rather than a failure — but a flaky timeout in the one file that guards every remaining screen task is the worst possible place for one. The cause is structural and cheap to remove: three rules each walk all of `src` and re-read the same ~896 files independently, so the tree is read roughly three times over. Walking once, reading each file once, and running all three rules against that single read should cut most of it. Cost if wrong: one more round on a test file, and if the optimisation does not help enough the fallback is a per-test timeout override, which I would rather avoid because it hides the cost rather than removing it.

Fix round 2 dispatched with both.

### Task 6A fix round 2 — returned at 496039d87, independently verified

The three rules now share one walk of `src` and one read per file, with the ward-scoped fixture rule deriving its subset by path-prefix filter instead of re-walking. No rule's scope, pre-filter or AST logic changed.

**R29 was understated: this had already crossed from risk into failure.** The implementer measured the pre-fix file at 61.19s with **one test genuinely timing out at 31.8s against the 30s ceiling**. The reviewer's run had passed 9/9, so the file was already intermittently failing and had simply not failed in the run that was looked at — which is exactly how a flake establishes itself as "known noise".

After: 9/9 in 10.77s and 16.53s on the implementer's back-to-back runs. My own run under heavy concurrent load: **9 passed, worst single test 10.2s**, everything else at or under 4.6s. Comfortably clear of the ceiling rather than a narrow squeak.

R28 is satisfied by naming rather than by chasing completeness. The two quarantine tests now read "never lets a file with a **direct** `{code, label, kind}` LegalForm literal also reference ED_ACCESS_TARGET_MINUTES" and "never assigns `dueAt: ED_ACCESS_TARGET_MINUTES` as a **direct property initializer**", and their comment names the five confirmed evasions and points enforcement of those shapes at Task 11's brief and review. The implementer also added a test asserting the field-triple predicate detects a real `LegalForm` construction, so it cannot pass vacuously — that vacuity check was not asked for and is the right instinct.

Verified myself rather than from the report: mutated **both** guards simultaneously — a `NOW_ANCHOR` reader at `src/lib/ward-probe/frozen.ts` and `dueAt: NOW_ANCHOR + ED_ACCESS_TARGET_MINUTES` wired into a Form 3B in the fixture — printed both back from disk, and all three affected tests failed. Restored, `git status` clean. Gates: `tsc --noEmit` clean, node-env **118 passed** across 10 files.

**Task 6A: complete.** Commits 2d8200a09, f1e32dcd4, 496039d87. Two fix rounds. The fabricated Form 3B deadline is gone from the model, the reducer, the fixture and every surface; the four-hour figure survives correctly named as the ED access target; and the guard protecting that distinction now states honestly what it does and does not catch.

### End-of-session audit and handover, 2026-08-21

Full audit run at the user's request before stopping.

**Repository integrity: clean.** `git fsck --connectivity-only` reports no broken objects. All 21 commits the ledger names by SHA resolve and are ancestors of HEAD. 67 commits ahead of `origin/main`, none pushed, working tree clean.

**No file corruption.** Checked all 1,573 files the branch changes for CR bytes: six matches, every one a `.png` under `tests/__screenshots__/`, where 0x0D is ordinary binary content. Zero CR bytes in any text file. No stray untracked files outside `node_modules`/`.next` — every probe file, backup and scratch script from this session's mutation testing was removed.

**Every superpowers artefact present and non-trivial**: 13 briefs (tasks 1-6, 6A, 7-12), 7 implementer reports, 4 reviews, 3 re-reviews, a Task 7 addendum, 11 review diffs, and this 88 KB ledger. Nothing empty, nothing truncated.

**One real problem found, and it is the machine rather than the code.** The final browser-gate re-run at 496039d87 aborted: `2 passed, 17 did not run` at **exit code 0**. Diagnosed rather than assumed — `dev-server.log` shows `/ward-management` taking 14 to 50 seconds against Playwright's 15-second waits, and the dev server then failed to become ready at all across a ten-minute wait. Cause: the machine is out of memory. Measured 1.3 GB free of 31.8 GB, with 45 `claude` processes holding 7.0 GB; `node` was not the culprit at 0.4 GB across 46 processes.

Ruling R30 — record the browser gate as verified at f1e32dcd4 and explicitly **not** verified at 496039d87, rather than carrying the earlier number forward as if it still applied. The only change between those commits is `tests/ward-flow-single-source.test.ts`, a node-environment static-guard file that `grep` confirms nothing under `src/` imports, so it cannot alter what a browser renders — but that is reasoning, and this phase's entire record says reasoning is not evidence. The handover states both the number and the caveat, and instructs the next session to run the gate before trusting it. Cost if wrong: the next session spends four minutes re-running a gate that was already green. The alternative — a handover asserting a measurement nobody took — is the failure this phase has caught in an implementer report once already.

Also recorded in the handover as a new environment trap: after hours of agent work this box can exhaust memory, and the symptom is not an error message but everything slowing, then the dev server refusing to start, then a Playwright run aborting as "N did not run" at exit 0. Check free memory before debugging code late in a session.

Handover rewritten in full at `docs/ward-flow-phase-3-handover.md`: state, task table, the clinician's verbatim answer and what it invalidated, the three unconfirmed assumptions, standing instructions, verification baselines with their provenance, eleven environment traps, the guard-overclaim lesson, and the resume steps. Committed ledger copy refreshed from this file.

### 2026-08-22 — the branch was pushed, and the push emptied `node_modules`

The user reversed the standing "no push" instruction and asked for the branch on GitHub. It is now at `origin/codex/ward-management-design`, verified by comparing the remote SHA to local rather than trusting the success message. No PR was opened; that half of the instruction stands.

**The first push attempt was blocked, and both blockers were real.** The static guard failed on two unused imports (`Instant` in `ward-flow-reducer.ts`, `PARALLEL_REFERRAL_CAP` in its test) — checked against 5f5c01146 and both genuinely pre-date Task 6A, exactly as the ledger recorded, but "pre-existing" does not make them pushable at `--max-warnings 0`. The format guard failed on the 26 workspace markdown files, which were agent-authored scratch and had never been through Prettier. Both fixed properly at 19ae5c662; neither documented override was used.

Also caught myself reading a pipeline's exit code instead of its output: `git push ... | tail` reported exit 0 while the output said `failed to push some refs`. Same class as the vitest "no tests" trap, and the reason the standing instruction exists.

**Then the push destroyed the dependency tree.** `node_modules` went to **zero entries**. Diagnosed rather than assumed: the format guard links a real dependency tree into a scratch checkout as a Windows junction (`guard-push.mjs:378`) and tears it down with `git worktree remove --force` plus a recursive `rmSync` (the `finally` at ~398). Both descend through the junction. The symptom was not a dependency error — it was `tsc` reporting it could not find `process`, and 8 of 10 test files failing at once, which reads precisely like a code regression. I nearly reported those numbers as one.

This is a known repo defect, fixed on `main` at `a04330ea0` (PR #2244). **`git merge-base --is-ancestor a04330ea0 HEAD` returns false — this branch predates the fix.**

Ruling R31 — write the equivalent minimal fix directly onto this branch rather than cherry-picking or merging `main`. `git apply --check` on the upstream patch fails on both files; this branch's `guard-push.mjs` has diverged from `main` by roughly 460 lines, so the patch has nothing to land on. Merging `main` would fix it and much else, but it is a large operation with real conflict risk across the ward-flow files and is the user's call, not a handover-boundary decision. So: `unlinkDependencyLink()` detaches the link before either force-delete, using `lstatSync` (never `existsSync`, which follows the link and so reads a dangling link as absent) and `unlinkSync` with an `rmdirSync` fallback for Windows directory reparse points, refusing a real directory outright. Cost if wrong: a hand-written fix to a push guard on one branch, covered by three tests, where upstream's reviewed version exists but cannot be applied.

The decisive test asserts **the borrowed tree survives** — a sentinel file inside it must still be readable after teardown. A test asserting only that the link is gone would pass just as happily if the target had been wiped, which is the bug.

Recovery: `npm ci --include=dev`. Note for anyone debugging a broad, unexplained failure on this machine — **check `ls node_modules | wc -l` before reading a single line of code.**

### Correction to R31 — the guard-push fix was reverted, and the mechanism is unproven

Ruling R31 is **withdrawn**. I wrote `unlinkDependencyLink()` onto this branch's `guard-push.mjs` with three tests, on the theory that the format guard's teardown followed a Windows junction into the borrowed `node_modules`. Then I mutation-tested it, as the standing discipline requires, by reverting the detach to the recursive delete that supposedly caused the damage.

**The mutation survived. 31 passed.** So the test did not test the bug.

I probed the mechanism directly rather than patching the test to match my theory. Two experiments, both on this machine:

- `rmSync(parentDir, { recursive: true, force: true })` over a directory containing a junction: **the target survived**. Node does not follow the junction.
- `git worktree remove --force` over a real git worktree containing a junction: **the target survived** too.

So neither force-delete in the teardown reproduces the destruction, and the theory I had already written into three documents as established fact is not established at all.

Ruling R32 — revert the fix and the tests rather than keep a defensive change justified by an unproven mechanism. Four reasons. I cannot reproduce the failure. My tests demonstrably do not catch it — the mutation proved that, not an opinion. Hand-writing a change to a **push guard** on a diverged branch, on a theory, is how a guard that promises more than it delivers gets shipped — which is precisely the defect class this phase's §7 lesson is about, and I was about to commit an instance of it in the same session I documented it. And the genuinely correct fix already exists upstream, reviewed, at `a04330ea0`; the route to it is merging `main`, which is a real piece of work with conflict risk and is the user's decision, not a handover-boundary one. Cost if wrong: the branch keeps a latent defect that may or may not exist in the form I imagined, mitigated by a documented diagnostic (`ls node_modules | wc -l` first) rather than by code.

What survives in the documents is what is actually known: `node_modules` went to zero entries around the first push; the symptom masquerades as a code regression; recovery is `npm ci --include=dev`; the cause is **unconfirmed** with two candidates ruled out by direct experiment and cross-worktree borrowing unexplored.

### The `node_modules` destruction — strongest explanation, found by looking at what was running

Asked to shut down "leftover" processes, I inventoried the 62 node processes first rather than killing them. Almost none were leftovers, and none were this worktree's: roughly 11 belong to a session working in `D:\Worktrees\Database\care-plan-impl`, 7 to one in `phase-5-closeout`, the rest are npm helpers and this session's own plugin/MCP processes. Several were actively running.

**One of them explains the destruction.** PID 22400 was `D:/Worktrees/Database/care-plan-impl/scripts/guard-push.mjs origin https://github.com…` — **another worktree running its own push guard, live.** `findPrettierBin` deliberately borrows another worktree's real `node_modules` when its own checkout lacks one, and this machine has dozens of siblings.

That fits every fact the earlier theory could not. It explains why probing the force-deletes _here_ never reproduced anything — the destroyer was in a different worktree entirely. And it explains the second occurrence, which followed no push from this session at all.

Ruling R33 — do not kill any of these processes, and do not treat this as a ward-flow defect to fix on this branch. They are other sessions' live work, and this repo's own memory records a cleanup sweep destroying an in-use worktree twice; PID 22400 was mid-push, where killing it could leave that branch broken. The exposure is ambient to the machine, not to this code: any session pushing from any worktree can empty this one's dependencies. Cost if wrong: `node_modules` is emptied again and costs a 7-minute reinstall — against the alternative cost of breaking another session's push. Documented as a diagnostic (`ls node_modules | wc -l` first) rather than defended against in code.

This also retires the question honestly. R31's mechanism was wrong, R32 withdrew the fix, and R33 names a cause that fits the evidence while still labelling it the strongest explanation rather than a proven one — no probe was run against a live cross-worktree borrow, and running one would have meant interfering with another session's push.
