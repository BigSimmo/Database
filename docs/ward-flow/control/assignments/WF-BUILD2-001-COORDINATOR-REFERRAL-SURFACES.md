# WF-BUILD2-001 — a community referral must not be flagged on the coordinator's screen

**Assigned to:** Ward Builder Two — `claude/ward-builder-two`, worktree `D:/Worktrees/Database/ward-builder-two`
**Assigned by:** Ward Lead, 2026-09-01, from `6df4f86fd`
**Status:** open

---

## The ruling

The owner, 2026-09-01, verbatim:

> "Any referrals to community Do NOT need to be flagged in the coordinators screen."

His reasoning, from the same afternoon: **a community referral is discharge planning.** The patient is
about to leave. It is not a rival bed offer and it is not work in the coordinator's bed-matching flow.
He also settled the general criterion in the same breath — **direction**: a referral belongs in the
coordinator's work if the patient is arriving at the bed question, and does not if they have already
left it.

## ⚠️ The scope of "the coordinators screen" is NOT settled, and this task is in two halves because of it

The question put to him was about the **bed-matching queue**. He answered about **the coordinator's
screen**. Those are not obviously the same surface — a referral can be absent from the queue and still
appear in a recently-decided list, a count, a pressure figure, or a panel.

**So half one is a measurement, and it is what the owner needs before he can answer precisely.**

### Half one — enumerate, change nothing

List **every** place on the coordinator's screen where a referral, or a count derived from referrals,
reaches the reader. For each one give: the file and line, what it renders, and whether a community
referral can appear in it today. Start from `src/components/ward-management/coordinator/` and follow
what it renders — `priority-queue.tsx`, `shortlist-panel.tsx`, `pressure-strip.tsx`,
`exception-drawer.tsx`, `flow-diagram.tsx` — and check `src/components/ward-management/ward-referrals.ts`
and `ward-referral-visibility.ts` for the filters they read.

**Write it to `docs/ward-flow/coordinator-referral-surfaces.md`, commit it, and report.** That document
is the question the owner gets asked. Do not change behaviour in half one.

⚠️ **Do not answer this from the filters alone.** A filter tells you what a list contains; it does not
tell you what the reader sees. A count computed over all referrals and rendered beside the queue is a
surface even though no filter mentions it.

### Half two — apply it, once the owner has ruled on scope

Held until the owner answers "only the queue, or every surface you found?". Do not start it.

## What already exists, so you do not rebuild it

- `referralQueueOrder` filters on `referralState === "queued"` **and nothing else** — so it is the
  queue's only gate today.
- `ward-referral-visibility.ts` exists. **Read it first**: it may already be the right home for this
  rule, and adding a second mechanism for one fact is how two mechanisms come to disagree. This project
  has two cancellation mechanisms for exactly that reason and is still paying for it.
- ⚠️ **`RF-009` is the case that decides whether your rule is right.** It is an
  `emergency_department`-only referral asking for **no ward bed at all**, and the owner has ruled it
  **stays** in the queue. So _"asks for no bed"_ is NOT the criterion — it gives the wrong answer here.
  The criterion is **direction**. Any rule you write must keep RF-009 in and take community out, and a
  test must prove both, or the rule is untested against the only case that separates the two.

## Constraints — these are the whole reason a second builder is safe

**You own exactly these paths and nothing else:**

- `src/components/ward-management/coordinator/**`
- `src/components/ward-management/ward-referral-visibility.ts`
- `src/components/ward-management/ward-referrals.ts`
- `docs/ward-flow/coordinator-referral-surfaces.md`
- Tests you create, plus existing `tests/ward-referral*.test.ts` and `tests/ward-coordinator*`

**Never touch, under any circumstance:** `ward-flow-reducer.ts`, `ward-flow-events.ts`, `ward-nav.ts`,
`ward-nav-icons.ts`, anything under `statistics/`, anything under `community/`, or
`tests/ward-nav.test.ts` / `tests/ward-landmarks.test.ts`. Ward Lead owns the first group and has an
agent live in it now; Ward Builder One owns the second and third.

**If the task cannot be done without touching a forbidden path, STOP AND HAND IT BACK.** That is a
finding and it is worth more than a diff. It is also how the last three collisions here were avoided.

- **You never merge, rebase, push, or touch another branch.** Ward Lead is the sole integration
  authority. When something lands, say so; do not integrate it.
- **Never `git add -A`.** `git status`, then stage by name.
- **Never invent a clinical value.** No honest source means `null`.
- **Commit each coherent step.** This machine crashed twice on 2026-08-31 and this branch exists on one
  disk and is never pushed. An unverified commit is recoverable; an unwritten one is not.

## How to check

- `npx tsc -p tsconfig.typecheck.json --noEmit`, and report the exit code. ⚠️ **Vitest runs no
  typecheck** — a file can be green and uncompilable at the same time. That has happened three times on
  this branch.
- Discover the suite from disk, never by naming files:
  `ls tests/ward-*.test.ts tests/ward-*.test.tsx | wc -l` must be **at least 100** (136 today). Fewer
  means a broken glob — refuse to run rather than report a green subset.
- Run it redirected to a file and READ the file. ⚠️ **Never pipe a test run through `tail`**: the
  summary survives and every FAIL line is discarded.
- ⚠️ **`tests/ward-*` excludes every browser test.** Change a rendered string and you must also grep
  `tests/ui-*.spec.ts` for it. A rename shipped on 2026-09-01 with the screen and its browser test
  contradicting each other, invisible to 1696 passing Vitest tests and a clean typecheck.
- Prove a new test is not vacuous by mutation: assert the match count **before** mutating, mutate, run,
  paste the failure, restore, confirm byte-identity by sha256. A mutation that fails to apply reports
  as a passing suite.

## Falsifier

Half one lists filters instead of surfaces; or it is derived from reading the filters rather than from
following what the screen renders; or half two starts before the owner rules on scope; or any rule is
written that does not keep RF-009 in the queue while taking community referrals out, proved by a test.
