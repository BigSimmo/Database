# Ward Flow Phase 2 — kickoff brief for a fresh session

Paste the block at the bottom of this file into a new chat. Everything above it is context for
the human deciding whether to start.

---

## Why a fresh session

Phase 1 was executed in a session that had already run five mockup rounds, a design brainstorm,
spec authoring, two plans and about fifteen subagent dispatches. Orchestration state is what
compaction destroys first, and a controller that forgets where it is re-dispatches completed work.
Each phase therefore gets its own session, starting cold from three files.

Continuity lives in the repository, not in a conversation:

| File                                                                        | What it carries                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `docs/ward-flow-phase-handoff.md`                                           | Phase 1's rulings, parked findings, repo traps, closing state |
| `docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md`  | The binding authority all phases argue from                   |
| `docs/superpowers/plans/2026-08-18-ward-flow-phase-2-coordinator-screen.md` | Phase 2's executable detail                                   |

## Before starting: open the app

Phase 1 ended green — 50 unit tests, lint clean, Chromium 6/6, whole-branch review clean after one
fix wave. It also shipped, at various points, a wait time labelled "1h 35m overdue" on every queue
row, a green tick beside "is not authorised under the Mental Health Act", and a bed grid that did
not reconcile on ten of twenty-two units. Every one passed tests and survived a review.

```bash
npm run ensure
```

Then open `/ward-management` and look at it. That is the check the process cannot perform.

## What Phase 2 builds

The flow coordinator's single screen — the surface that replaces the phone-around — in five
regions: emergency-department pressure strip, priority queue, flow diagram (departments left,
statewide flow centre, inpatient units right), explainable shortlist, exceptions drawer. Plus a
queue-first phone form, and the retirement of Constellation into it.

Ten tasks. Two build pure derivations (the operational score, per-department pressure), six build
the screen, one retires Constellation, one proves the phase.

## Process calibration recommended for this phase

Phase 1 used full subagent-driven development on every task. That was right for model work and it
caught real defects — but Phase 2 is mostly screens, and the same treatment would cost more than
it returns.

- **Full treatment** (implementer, task review, fix rounds) for Tasks 1, 2, 6 and 9 — the two
  derivations, the flow diagram, and the destructive retirement.
- **Single review seat** for Tasks 4, 5, 7 and 8 — screen regions rendering derivations that are
  already proved.
- **A screenshot pass on every screen task**, reviewed by the owner rather than only a subagent.
  This is the substitution for the second review seat, and it is the better instrument for this
  kind of defect.
- **Do not run** `verify:ui`, `verify:release`, or any provider-backed gate. The owner has asked
  for CI restraint; the plan's Task 10 names the gates that are in scope.

---

## Paste this into the new chat

> I'm continuing a build called Ward Flow — a synthetic offline prototype for Western Australian
> metro psychiatry patient flow, coordinating a patient from a metropolitan emergency department
> to an inpatient psychiatric bed. Phase 1 (the model) is complete. I want you to execute Phase 2
> (the coordinator screen).
>
> Work in this worktree, on the existing branch — do not create a new one, and do not push or open
> a PR:
> `C:/Users/joshs/.codex/worktrees/ward-management-design/Database` (branch
> `codex/ward-management-design`)
>
> Read these three files first, in this order:
>
> 1. `docs/ward-flow-phase-handoff.md` — what Phase 1 decided, what it parked, and the repo traps
>    that will otherwise cost you an hour each
> 2. `docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md` — the binding
>    authority; sections 6, 7, 8, 10 and 11 are the ones Phase 2 touches
> 3. `docs/superpowers/plans/2026-08-18-ward-flow-phase-2-coordinator-screen.md` — the plan to
>    execute
>
> Use the `superpowers:subagent-driven-development` skill to execute it. Calibrate the process as
> the kickoff brief recommends: full treatment (implementer plus task review plus fix rounds) for
> Tasks 1, 2, 6 and 9; a single review seat for Tasks 4, 5, 7 and 8; and a screenshot pass on every
> screen task that you send to me rather than only reviewing yourself.
>
> Three things I care about more than speed:
>
> - **Verify every claim a subagent makes about typecheck and tests by running it yourself.** In
>   Phase 1 an implementer reported `tsc --noEmit` clean when it was not, and the repo stayed red
>   across two tasks.
> - **Show me screenshots as you go.** Phase 1's worst defects all passed their tests: a wait time
>   rendered as "overdue" on every row, a green tick beside an unmet Mental Health Act gate, a bed
>   count that did not add up. Tests do not catch things that are plausible but false.
> - **Do not run** `verify:ui`, `verify:release`, or any provider-backed gate.
>
> Record the rulings you make on my behalf, and give me the full list at the end with what each
> costs if it turns out to be wrong.
