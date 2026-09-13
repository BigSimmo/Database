# Ward Flow — cold-start handover, 2026-08-28

Everything a session with no memory of this work needs, in one page. Written mid-build, so §3 is the
part that goes stale first — **check it against `git log` before acting on it.**

---

## 1. What this is

A **synthetic, offline prototype** of a psychiatric bed-flow hub for Western Australia, built for a
practising psychiatrist in Perth. It coordinates bed flow from a community team's decision to admit,
through the emergency department, to the ward, and out again through discharge.

It holds **no real patient data**, is reachable only through the administrator-gated developer hub at
`/mockups/ward-flow`, and is **not clinical decision support**. Its real output is a shared
understanding of what such a system would have to do — something to put in front of colleagues.

## 2. Where the work lives

|                  |                                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Worktree**     | `D:\Worktrees\Database\pr-2390-fix` — **use this one**; do not create another (221 exist and the machine is measurably degraded) |
| **Branch**       | `claude/ward-flow-phases-6-7-design` — local only, **never pushed**                                                              |
| **Product code** | `src/components/ward-management/**` and `src/app/mockups/ward-flow/**`                                                           |
| **Tests**        | `tests/ward-*.test.ts`, `tests/ward-*.dom.test.tsx`, `tests/ui-ward-*.spec.ts`                                                   |

**Prefix every shell command with `cd /d/Worktrees/Database/pr-2390-fix &&`.** The working directory
does not reliably persist and silently reverts to a different checkout. An implementer lost an hour to
this, running its tests where its test file did not exist.

## 3. State (verify against `git log` — this is the part that goes stale)

**Phase 5** — bed availability. Built, merged to `main` long before this session.

**Phase 6 — the morning page. COMPLETE.** A page a bed coordinator opens at the start of a shift:
beds available right now across seventeen hospitals, frozen to the 08:00 handover with a live view one
click away, printing on one A4 sheet, plus a sixty-second self-driving tour that drives the real
system. Route `/mockups/ward-flow/morning`. Reviewed, fixed, and re-verified.

**Phase 7 — the front door. IN PROGRESS.**

- Done: the four-dimension bed model, the referral record, matching, the coordinator's accept/decline
  decision, and two review fix rounds.
- In flight at the time of writing: **fix round B** (the home-region field, seed integrity, validation).
- Not started: the two screens (intake form, coordinator's board with match view), registration, the
  browser journey, the screenshot pass, and the people-waiting figure on the morning page.

**Phases 8 and 9** — questions document drafted, nothing built.

## 4. The documents, in the order a newcomer should read them

1. `docs/ward-flow-autonomous-session-2026-08-28.md` — **the charter and audit trail.** What is being
   decided autonomously, what is not, and every decision made on the owner's behalf.
2. `docs/ward-flow-roadmap.md` — direction, phase order, and the refusals already settled **with their
   reasons**. A refusal with no reason attached gets reversed by the next person who finds it
   inconvenient.
3. `docs/ward-flow-phase-6-7-decisions.md` — every owner decision, including six answered mid-build.
4. `docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md` and
   `…-phase-7-front-door-design.md` — the binding specifications, numbered decisions with reasoning.
5. `docs/superpowers/plans/2026-08-27-ward-flow-phase-6-*.md` and `…-phase-7-*.md` — the task plans.
6. `docs/ward-flow-phase-8-9-questions.md` — groundwork for what comes next.
7. `docs/ward-flow-clinician-check.md` — **the one-page summary still waiting to go to a clinician.**

**Execution ledgers** (git-ignored, this machine only) at
`.superpowers/sdd/2026-08-27-ward-flow-phase-6-morning-page/progress.md` and
`.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/progress.md` — every task, every ruling,
every review finding, and the defect-class register. `DISPATCH-PREAMBLE.md` in the Phase 7 folder is
the standing rules handed to every implementer.

## 5. The constraints that override everything

1. **Never invent a legal figure.** No figure, timeframe, threshold or duration from the Mental Health
   Act, anywhere — code, copy, comment, test or fixture. A plain Voluntary/Involuntary label is
   permitted and is **not** a legal figure. If one seems needed, stop and ask.
2. **Synthetic data only.** A referral carries exactly: age band, sex, home region (a region from a
   fixed list, never an address), secure-bed-needed, involuntary-bed-needed. **No free text anywhere.**
3. **Nothing predicted, confirmed-but-unreleased, or on leave ever reaches "beds available right now."**
   The one rule the whole hub rests on.
4. **Every bed dimension is "does this bed accept this person", never an equality.** Most beds are
   undesignated for sex, and undesignated accepts everyone; `bed.sexDesignation === referral.sex` would
   exclude every referral from most of the network **and looks entirely reasonable in review**.
5. **Local and offline only.** Never `verify:release`, any `eval:*`, `check:supabase-project`,
   `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live database.
6. **Never push and never open a pull request** without the owner saying so.
7. **Never `git stash`** — the stack is shared across every worktree and holds other people's work.
8. **No gate skipped, no assertion deleted, no test loosened.** If a change would reduce what can
   honestly be claimed, do not make it — say so.

## 6. How to work here, learned the hard way

**Mutation-test every test.** Break what it guards, run it, watch it go red, quote the failure line,
restore. **Ten tests in Phase 6 passed while the behaviour they named was deliberately broken.** A test
never watched to fail is not evidence.

**Look at the rendered page.** Every defect that actually reached the screen — hospital names vanishing
from print, five bold zeros under a real hospital's name, a five-page sheet that promised one — was
found by rendering and looking, never by a test. Three widths (390/820/1440) plus print.

**Read the exit status AND the decisive output line.** `GATE_RECEIPTS=refresh` when fresh evidence is
the point: results are memoised, so a plain re-run can exit 0 having printed no test-count line at all,
which proves nothing ran. A refusal saying "capacity is full" or exit 75 means **BLOCKED, retry** —
never a failure.

**The heavy-gate lock spans every worktree on this machine.** Lint, typecheck, full tests, build and
Playwright serialise across all of them. Waits of 20+ minutes are normal, not a fault.

**One implementer at a time in this worktree.** The pre-commit hook inspects the whole working tree, not
the staged set, so two agents cannot commit independently even with disjoint files. Read-only reviewers
may run concurrently.

**Reusable tooling** in the Phase 7 workspace: `mutate.sh` (apply, run, restore, verify — refuses a
mutation that matched nothing), `capture.mjs` (a route at three widths plus print, reporting overflow,
console errors, duplicate test ids and A4 page count), `check-registration.sh` (all six fail-closed
registration gates at once).

## 7. The defect classes this codebase actually produces

1. **A hand-maintained list a type change cannot reach** — four occurrences, the clear leader. A
   Playwright regex made a browser spec silently never run; a nav icon map crashed every ward screen;
   a route-coverage map left a red test on the branch; a cohort picker silently omits a new value.
2. **A test that passes while its behaviour is broken** — seventeen found across the two phases.
3. **A constraint stated in prose but not enforced in code** — one was stated four times in this
   phase's own documents and still was not implemented.
4. **A fixture that makes a rule vacuous** — a seeded acceptance the reducer would have refused.
5. **A defect visible only on the rendered page.**

## 8. The single most valuable outstanding item

`predicted -> confirmed -> blocked -> released` — the four-stage model of how a bed comes free — **has
never been checked by a ward clinician.** Everything in Phase 6 is derived from it.
`docs/ward-flow-clinician-check.md` is the one-page summary, written for someone with no software
knowledge, waiting to be sent. Phase 6 is built so that being wrong costs three strings; Phase 7 so
that it costs nothing at all. Only the owner can close this.
