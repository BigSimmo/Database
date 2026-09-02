# Ward Flow — the pinned-clock defect: session handover

> **STATUS as at 2026-09-02: the provider fix IS on `main`. Do not cherry-pick anything.**
> The 2026-08-27 banner this replaced said the opposite ("Nothing here is on `main`"), and
> acting on it means trying to re-apply a change that is already applied. An equivalent fix
> reached `main` by another route; `origin/main` at `45a3dca` carries it, and the Phase 6
> branch independently carries its own. What remains outstanding is the Phase 6 half only —
> §4, now narrowed. Re-verify every SHA below before acting on it; branches move.

**Why this file exists.** It was written when the fix was stranded on an unpushed branch, to
stop that work being lost. That is no longer the situation and the introduction it carried has
been removed rather than left to contradict the banner above: the fix has landed, twice, by two
independent routes, and nothing needs carrying anywhere. What the file is _for_ now is the
opposite job — stopping a session from redoing settled work. It records what is done, what the
numbers actually are, and the one thing genuinely left: a **decision** about spec D5 on the
Phase 6 branch, which §4 shows is not the test the earlier drafts asked for.

Companion documents, none of which this file duplicates:

| For                                      | Read                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| The Phase 6 specification, including D5  | `docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md` |
| Direction, phase order, settled refusals | `docs/ward-flow-roadmap.md`                                                  |
| Phase 5's handover, for the house style  | `docs/ward-flow-phase-5-handover.md`                                         |

The Phase 6 spec is **not on this branch** — it exists only on
`claude/ward-flow-phases-6-7-design`, and it is readable from anywhere, including a cloud
container, once that branch is fetched (§4 gives the exact commands; note the `origin/` prefix,
without which the `git show` fails in a fresh clone). Read it there rather than concluding it is
missing. The other two are here.

---

## 1. The defect, in one paragraph

`WardFlowProvider` takes an optional `initialNow` prop, documented as pinning the clock at
that instant so tests and deterministic renders are reproducible. **Its value was silently
discarded.** The render body set `elapsed = 0` whenever `initialNow` was defined and then
computed `now = NOW_ANCHOR + elapsed + clockOffsetMinutes`, so a pinned provider always
served `NOW_ANCHOR` (642 — 10:42) no matter what instant it was handed. The prop was doing
two real jobs — acting as a "do not tick" flag, and seeding a clock checkpoint the pinned
path never reads again — and one job it only appeared to do.

**It was latent, not active.** Every `initialNow=` call site in the suite passed `NOW_ANCHOR`
at the time (see §3 for the current figure, which is no longer uniform), and `NOW_ANCHOR + 0`
equals `initialNow` precisely when the pinned instant _is_ `NOW_ANCHOR`.
So no test was ever asserting against a clock it did not receive, and no screen was ever
wrong at runtime — the live app never passes the prop at all.

**Why it still mattered.** It made every time-of-day branch in the ward screens unreachable
through the real provider. A test could not obtain any clock other than the one instant the
fixture happens to be authored around. That is what forced the workaround §4 retires under
"The workaround has moved".

---

## 2. Where the fix is: on `main`, and separately on the Phase 6 branch

**`origin/main`** (`45a3dca`, read 2026-09-02) —
`src/components/ward-management/ward-flow-provider.tsx`:

```ts
const base =
  initialNow !== undefined
    ? initialNow
    : NOW_ANCHOR + clockCheckpoint.elapsedBefore + elapsedMinutesSinceMount(clockCheckpoint.reading, wallClockNow());
const now = base + state.clockOffsetMinutes;
```

The pinned instant is used verbatim. `tests/ward-flow-provider.dom.test.tsx` on `main` already
pins `PINNED_BEFORE_ANCHOR` (450, 07:30) and `PINNED_AFTER_ANCHOR` (1265, 21:05) and asserts
`now` is not `NOW_ANCHOR`, so the fix is defended in both directions rather than by a one-sided
offset.

**`claude/ward-flow-phases-6-7-design`** carries its own independent fix, dated 2026-08-30,
written a different way — the pinned instant becomes an `anchorOffsetMinutes` the render body
adds to `NOW_ANCHOR`. Same behaviour, different shape. It is already there; the "carry the fix
across" action is done and has been struck from §4.

**`claude/serene-heyrovsky-7a5e53` is redundant — close it.** That was outstanding action (4)
below, explicitly the owner's call, and the call is now moot: `main` has the behaviour, so the
branch has nothing left to contribute. It was never pushed and is not visible from any cloud
session, so it can only be closed from the Windows workstation that holds it. Commit `62f798c2a`
does not need to reach anywhere.

---

## 3. What is proven, and by what evidence

Run in this worktree on the committed tree. All offline; nothing touched a provider.

| Check                                   | Result                                         |
| --------------------------------------- | ---------------------------------------------- |
| `tests/ward-flow-provider.dom.test.tsx` | 9 passed (5 pre-existing + 4 added)            |
| All 17 files passing `initialNow=`      | 92 passed                                      |
| Whole ward suite (48 files)             | 519 passed                                     |
| `npm run typecheck`                     | pass                                           |
| `npm run lint` (whole repo)             | pass — see the trap in §6, it lied twice first |
| Prettier, both changed files            | pass                                           |

**Blast radius, re-measured — and now stale twice over.** The original brief said 43
`initialNow=` call sites; the count on `be65b8a1b` was **40**, all passing `NOW_ANCHOR`. On
`origin/main` at `45a3dca` it is **51 call sites across 20 test files, of which 47 pass
`NOW_ANCHOR` and 4 deliberately do not** — the four non-anchor pins added with the fix itself,
all in `tests/ward-flow-provider.dom.test.tsx`. Quote the current number, not "40, all
`NOW_ANCHOR`"; that sentence stopped being true the moment the fix landed.

**Mutation test, performed.** The fix was reverted with the new tests kept. Three of the four
new tests went red. The decisive line:

```
Expected element to have text content: 450
Received: 642
```

`642` is `NOW_ANCHOR` — the provider serving the hardcoded anchor while the test pinned 07:30.
The fix was then restored and the suite re-run green.

**Mutation test, repeated at screen level on 2026-09-02.** The two tests added to
`tests/ward-discharge-board.dom.test.tsx` drive `releaseBand`'s two `now`-dependent branches
through a rendered `DischargeBoard` rather than by calling the pure function directly. With the
defect reintroduced on `main`'s provider (`? NOW_ANCHOR` in place of `? initialNow`), **both new
tests went red and all six pre-existing tests in the same file stayed green** — which is the
point twice over: the new tests detect the defect, and the suite that was already there
demonstrably could not, because every one of its renders pins `NOW_ANCHOR`. The decisive lines:

```
AssertionError: expected [ 'By midday', 'By midday' ] to deeply equal [ 'Now', 'Now' ]
TestingLibraryElementError: Unable to find an element by: [data-testid="ward-discharge-group-released-today-empty"]
```

The provider was restored and the file re-run: 8 passed. The fourth new test (a pinned provider
never starts its tick interval) passes either way by design; it is a guard against the fix
costing the prop its other job, not a detector of this bug.

---

## 4. What remains — the Phase 6 half, and only that

**Two of the four original actions are done and have been struck.** Carrying the fix across:
done, independently, on 2026-08-30 (§2). Deciding the fate of `claude/serene-heyrovsky-7a5e53`:
answered in §2 — redundant, close it.

**Target branch: `claude/ward-flow-phases-6-7-design`**, tip `1888ad1` when read on 2026-09-02.
It was actively advancing when this document was first written and had moved substantially by
this reading, so **confirm ownership before editing it**. The similarly named
`claude/ward-flow-phases-6-7-4358c2` is a different branch with no morning page on it; it is not
the target.

**Correction to this document's own assumption:** it previously implied the Phase 6 branch and
its spec could not be read from a session that lacks the Windows worktree. That is wrong — the
branch is on the remote and fetches normally from a cloud container:

```bash
git fetch --depth=50 origin claude/ward-flow-phases-6-7-design
git show origin/claude/ward-flow-phases-6-7-design:docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md
```

Nothing about this work needs the workstation. Read the branch before planning against it.

Two checkboxes remain. Both are written out below rather than crammed into the list, because
the first one changed shape entirely between the 2026-08-27 draft and this reading.

- [ ] Decide whether D5 still exists as a requirement — see "The D5 action is a decision" below.
- [ ] Correct the stale workaround comments — see "The workaround has moved" below.

### The D5 action is a decision, not a test

This supersedes the instruction the ledger row and this document both previously gave: "render
`MorningPage` inside `<WardFlowProvider initialNow={7 * 60 + 30}>`". **That test cannot pass as
written**, and the reason has nothing to do with the clock.

Spec D5 says that when the demo clock is before 08:00 there is no morning handover for that day
yet, so the page must say _"The 08:00 handover has not been taken for this day"_, offer the live
view, and show no figures — never yesterday's snapshot and never a silent fall back to `now`.

But at `1888ad1`, owner decision **WB-DB-11 ("ONE VIEW, ALWAYS LIVE")** removed the fixed/live
split. `MorningPage` now renders `MorningBody` and nothing else. `NoHandoverYet` (which holds the
sentence), `ViewControl`, `buildFrozenMorning` and the `FrozenMorning` / `MorningView` types are
all still exported and **none of them is rendered or called by anything**. Pinning the provider
before 08:00 therefore renders the ordinary live page, and an assertion on the sentence fails no
matter how correct the clock is.

So the remaining work is a decision: either D5 is retired along with the fixed view — in which
case that unrendered code goes with it — or the fixed view is restored first and the D5 test
written against it. **Only then** is `initialNow={7 * 60 + 30}` the right mechanism. The
pinned-clock fix has already made it available; it is no longer the blocker.

Coverage as measured at `1888ad1`, for whoever takes that decision. D5's **clock rule** is well
covered: `tests/ward-morning-rollup.test.ts` pins `morningHandoverInstant` returning `null` at
07:59 and at 01:00, and explicitly not yesterday's 08:00. D5's **rendered failure behaviour** has
**no coverage of any kind** — a grep for `NoHandoverYet`, `no-handover` and `has not been taken`
across every file under `tests/` returns one unrelated comment in
`tests/ward-travel-grouping.test.ts`. That is worse than "proven at the pure-function level only",
which is what the ledger row said.

**A second consequence of WB-DB-11, recorded nowhere else.** `ViewControl` still contains the
`ward-morning-view-fixed` and `ward-morning-view-live` test ids, and `tests/ui-ward-morning.spec.ts`
still clicks them (lines 51-52 and 195-206) — but since nothing renders `ViewControl`, that
Playwright spec cannot pass against branch head. It is a separate breakage from this defect and is
in no ledger row; whoever takes the D5 decision meets it immediately.

**Weigh any further investment against where it sits.** PR #2466 ("Ward Flow — synthetic bed-flow
prototype (DRAFT, not for merge)") was **closed unmerged** on 2026-08-31: 299 commits ahead of
`main`, 276 files, `mergeable_state: dirty`. All of it is design scratch under
`src/app/mockups/ward-flow/**`, which 404s in production.

### The workaround has moved

The `NullHandoverHarness` and `DirectFrozenHarness` named in the ledger row and in the earlier
draft of this section **no longer exist** — neither identifier appears anywhere on the branch at
`1888ad1`. Do not go looking for them, and do not read their absence as the cleanup being done: it
appears they were removed without a replacement test, which is how D5's rendered branch ended up
with no coverage at all.

What survives is a **doc comment** on `MorningBody` in
`src/components/ward-management/morning/morning-page.tsx`, which justifies the seam partly as
letting "a test drive the null-handover failure branch (`frozen.instant === null`) with a
hand-authored `frozen` value instead of needing the provider's live clock to genuinely fall before
08:00". Two things are now wrong with it: the fix removed that need, and `MorningBody`'s exported
signature no longer takes a `frozen` prop at all — it takes `liveRollup` / `liveNow` /
`livePeopleWaiting` — so the comment describes an API that is gone. The same stale justification
appears on the `FrozenMorning` type just above it. Correct both alongside the D5 decision; the seam
itself still earns its place for the guided tour, which is its other stated reason.

## 5. What must NOT be re-opened

- **Do not "fix" the 47 call sites that pass `NOW_ANCHOR` to pass something else.** They are
  correct as they are. Their uniformity is what made the defect latent, and changing them is
  churn that proves nothing. The four deliberate non-anchor pins in
  `tests/ward-flow-provider.dom.test.tsx` are the exception that carries the proof, and
  `tests/ward-discharge-board.dom.test.tsx` adds two more at screen level — those six are the
  guard, not a pattern to spread.
- **Do not weaken or delete any assertion to make something pass.** If a test goes red against
  this fix, that test was relying on the bug and needs its own decision recorded here — not a
  quiet adjustment.
- **Do not touch the unpinned clock path.** The `elapsedBefore` accumulator and the
  midnight-rollover unwrap are Phase 3 work with their own reasoning and their own test (a
  50-tick walk past a full day). This fix deliberately left them alone.
- **Do not delete the correction blocks in the two Phase 3 documents.**
  `docs/superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md` and
  `docs/ward-flow-phase-3-workspace/task-4-brief.md` both still contain the original buggy clock
  snippet, deliberately, as the historical record of what was actually instructed. Each now
  carries a correction block above it saying so. The snippet is the regression vector — it is
  the only place in the repository that still _teaches_ the defect — so the warning stays as
  long as the snippet does. Removing the snippet instead would be rewriting the record of a
  completed plan.

- **Nothing here needs a provider.** No OpenAI, no Supabase, no hosted CI, no live database.
  If a step seems to want one, it is the wrong step.

---

## 6. Two traps this work actually hit

Both cost real time. Both will recur.

**A gate reported success without running.** `npm run lint` exited `0` twice while doing
nothing — once because another worktree held the repository's heavy-run lease
(`DATABASE_HEAVY_RUN_ADMISSION_BUSY`), once on a Windows `EPERM` collision creating the lock
directory. Piping through `tail` masks the real exit code, so both looked like passes. **Read
the output, not the exit code**, and re-run until the gate prints its own result line. The
third attempt genuinely passed and recorded a gate receipt.

**A fresh worktree has an empty `node_modules`.** `node scripts/run-vitest.mjs` fails with
`Cannot find module 'vitest/vitest.mjs'` and it looks like a broken checkout. It is not — run
`node scripts/setup-codex-worktree.mjs`, which copies a byte-identical dependency tree from
another worktree in about a minute. Do not reach for `npm ci`; it takes the better part of an
hour on this machine.

**How to run tests here**, since it is not the obvious command:

```bash
GATE_RECEIPTS=refresh node scripts/run-vitest.mjs run tests/ward-flow-provider.dom.test.tsx
```

Never bare `npx vitest`. `GATE_RECEIPTS=refresh` matters whenever fresh evidence is the point:
receipts are memoised against a content signature, so a plain re-run can exit `0` having
printed no result at all.
