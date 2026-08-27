# Ward Flow — the pinned-clock defect: session handover

> **STATUS as at 2026-08-27: the fix is written, proven and committed — but it is committed
> ONLY to a local branch that has never been pushed, and the branch that actually needed it
> does not have it.** Nothing here is merged. Nothing here is on `main`. If this file is more
> than a few days old, re-verify every SHA and branch name below before acting on them; the
> Phase 6 branch was moving while this was written.

**Why this file exists.** The fix was finished and then sat. It lives on a branch nobody else
can see, and the one place it was needed — the Phase 6 morning page — is on a different
branch that is still being worked. A session with no memory of any of this needs to be able
to pick it up without re-deriving it, and without re-opening the parts that are settled.

Companion documents, none of which this file duplicates:

| For                                      | Read                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| The Phase 6 specification, including D5  | `docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md` |
| Direction, phase order, settled refusals | `docs/ward-flow-roadmap.md`                                                  |
| Phase 5's handover, for the house style  | `docs/ward-flow-phase-5-handover.md`                                         |

The Phase 6 spec is **not on this branch** — it exists only on
`claude/ward-flow-phases-6-7-design`. Read it there
(`git show claude/ward-flow-phases-6-7-design:docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md`)
rather than concluding it is missing. The other two are here.

---

## 1. The defect, in one paragraph

`WardFlowProvider` takes an optional `initialNow` prop, documented as pinning the clock at
that instant so tests and deterministic renders are reproducible. **Its value was silently
discarded.** The render body set `elapsed = 0` whenever `initialNow` was defined and then
computed `now = NOW_ANCHOR + elapsed + clockOffsetMinutes`, so a pinned provider always
served `NOW_ANCHOR` (642 — 10:42) no matter what instant it was handed. The prop was doing
two real jobs — acting as a "do not tick" flag, and seeding a clock checkpoint the pinned
path never reads again — and one job it only appeared to do.

**It was latent, not active.** Every `initialNow=` call site in the suite passes `NOW_ANCHOR`,
and `NOW_ANCHOR + 0` equals `initialNow` precisely when the pinned instant _is_ `NOW_ANCHOR`.
So no test was ever asserting against a clock it did not receive, and no screen was ever
wrong at runtime — the live app never passes the prop at all.

**Why it still mattered.** It made every time-of-day branch in the ward screens unreachable
through the real provider. A test could not obtain any clock other than the one instant the
fixture happens to be authored around. That is what forced the workaround described in §4.

---

## 2. Where the fix is

```bash
git log --oneline -1 claude/serene-heyrovsky-7a5e53
```

- **Commit:** `62f798c2a` — "Make WardFlowProvider's pinned clock actually read the instant it
  was given".
- **Branch:** `claude/serene-heyrovsky-7a5e53`, based on `be65b8a1b` (`origin/main` at the
  time of writing).
- **Worktree:** `D:\Repos\Database\.claude\worktrees\nostalgic-vaughan-7ee231`.
- **NOT pushed. No upstream configured. No pull request. Not on `main`.** This is the single
  most important fact in this document — the work exists in exactly one place on one machine.
- **Two files changed**, nothing else: `src/components/ward-management/ward-flow-provider.tsx`
  and `tests/ward-flow-provider.dom.test.tsx`.

The change itself: when pinned, `now` derives from `initialNow + clockOffsetMinutes`. The
unpinned path — `NOW_ANCHOR` plus accumulated real elapsed time, including the midnight-wrap
accumulator added in Phase 3 — is untouched.

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

**Blast radius, re-measured.** The original brief said 43 `initialNow=` call sites; the true
count on `be65b8a1b` is **40**, and all 40 pass `NOW_ANCHOR`. All 40 stayed green under the
fix, which is the point: a correct fix had to be a no-op for every existing test, and it was.

**Mutation test, performed.** The fix was reverted with the new tests kept. Three of the four
new tests went red. The decisive line:

```
Expected element to have text content: 450
Received: 642
```

`642` is `NOW_ANCHOR` — the provider serving the hardcoded anchor while the test pinned 07:30.
The fix was then restored and the suite re-run green. The fourth new test (a pinned provider
never starts its tick interval) passes either way by design; it is a guard against the fix
costing the prop its other job, not a detector of this bug.

---

## 4. What remains — the actual outstanding work

**All of it is on a different branch.** The morning page does not exist on
`claude/serene-heyrovsky-7a5e53`, so none of this could be done there.

**Target branch: `claude/ward-flow-phases-6-7-design`** (worktree
`D:\Worktrees\Database\pr-2390-fix`). Confirm before touching it: this branch was
**actively advancing while this document was written** — it moved from `a53a3a994` to
`0d29dd734` inside a single session, so another session is working it. Do not assume it is
idle, and do not edit it concurrently with whoever owns it. The similarly named
`claude/ward-flow-phases-6-7-4358c2` is a different branch sitting at `main` with no morning
page on it; it is not the target.

At `0d29dd734` that branch still carries the buggy provider and the workaround below.

- [ ] **Carry the fix across.** Cherry-pick `62f798c2a`, or re-apply the two-line change. It
      is self-contained and does not depend on anything else in this branch.

- [ ] **Write the D5 test through the real provider.** Spec D5 says that when the demo clock
      is before 08:00 there is no morning handover for that day yet, so the page must say
      _"The 08:00 handover has not been taken for this day"_, offer the live view, and show no
      figures — never yesterday's snapshot and never a silent fall back to `now`. With the fix
      in place, that branch is reachable by rendering the real `MorningPage` inside
      `<WardFlowProvider initialNow={7 * 60 + 30}>`. Today it is proven at the pure-function
      level only, not through the rendered page.

- [ ] **Delete the workaround it replaces.** `tests/ward-morning-page.dom.test.tsx` contains
      `NullHandoverHarness` and `DirectFrozenHarness`, plus two long doc comments that exist
      solely because of this defect and describe it as present-tense fact. Once the fix lands
      there, those comments become actively misleading — a later reader will believe the bug
      is still there and reach for the harness again. Remove the comments and whichever
      harness the new test makes redundant. This is a judgement call, not a mechanical
      delete: `DirectFrozenHarness` drives the _real_ `buildFrozenMorning`, so it may still
      earn its place as a unit-level check even once the page-level test exists, whereas
      `NullHandoverHarness` hand-authors `{ instant: null, rollup: null }` and is the one the
      page-level test genuinely supersedes.

- [ ] **Decide what happens to `claude/serene-heyrovsky-7a5e53`.** Once the fix is on the
      Phase 6 branch, this branch is probably redundant and should be closed rather than left
      to rot. If instead the fix should reach `main` on its own — it is a clean, low-risk,
      two-file change with a mutation-proven test — then it needs a push and a pull request.
      **This is the owner's call, not a session's.**

---

## 5. What must NOT be re-opened

- **Do not "fix" the 40 existing call sites to pass something other than `NOW_ANCHOR`.** They
  are correct as they are. Their uniformity is what made the defect latent, and changing them
  is churn that proves nothing.
- **Do not weaken or delete any assertion to make something pass.** If a test goes red against
  this fix, that test was relying on the bug and needs its own decision recorded here — not a
  quiet adjustment.
- **Do not touch the unpinned clock path.** The `elapsedBefore` accumulator and the
  midnight-rollover unwrap are Phase 3 work with their own reasoning and their own test (a
  50-tick walk past a full day). This fix deliberately left them alone.
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
