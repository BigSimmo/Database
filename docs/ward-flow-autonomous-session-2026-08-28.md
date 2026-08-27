# Ward Flow — autonomous session, 2026-08-28

**The product owner is away for 12+ hours and has authorised full autonomy** to complete Phase 7, then
plan and complete Phase 8, then Phase 9 if time allows — making decisions myself, grounded in the
repository and in what is already recorded about how he works.

This file is the audit trail he reads when he returns, and the recovery map if this session is
interrupted or its context is compacted. **It is maintained as work proceeds, not written at the end.**

---

## 1. What I will decide, and what I will not

### Decisions I will make and record

Product and design choices where the repository, the roadmap, or a prior owner decision gives me
adequate grounding: screen layout and copy, which existing pattern to follow, task ordering, how to
close a review finding, what to seed in a fixture, naming, and the smallest correct verification for a
change. Each is recorded in §4 with its reasoning and what it would cost to reverse.

### Decisions I will NOT make, whatever the pressure to keep moving

1. **Anything requiring a fact neither of us has** — clinical, legal, or about how a real Western
   Australian service actually operates. I will not guess and I will not smuggle a guess into a default.
   Where one is needed, the design states the gap explicitly, keeps it cheap to fill, and the question
   goes to §5 for him to answer. This is the rule that produced the best decisions of the last two
   phases; it does not lapse because he is asleep.
2. **Never invent a legal figure.** No figure, timeframe, threshold or duration from the Mental Health
   Act, anywhere — code, copy, comment, test or fixture. A plain Voluntary/Involuntary label is
   permitted and is not a legal figure. Absolute, and not a matter of judgement.
3. **No real patient data, ever.** Synthetic only. No free text anywhere in a referral.
4. **Nothing leaves this machine.** No push, no pull request, no GitHub write of any kind. He authorised
   building, not publishing, and the repository's own rules require explicit confirmation for provider
   or hosted actions. Every commit stays local on `claude/ward-flow-phases-6-7-design`.
5. **No provider-backed command** — never `verify:release`, any `eval:*`, `check:supabase-project`,
   `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live database.
6. **Nothing destructive.** No `git stash` (the stack is shared across worktrees and holds other
   people's work), no force-push, no reset, no worktree deletion, no touching another session's files.
7. **No gate skipped, no assertion deleted, no test loosened, no tolerance lowered.** If a change would
   reduce what can honestly be claimed, I do not make it — I record it instead.

---

## 2. The plan

| Phase                          | State                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **7 — the front door**         | Tasks 1–3 built and reviewed. Task 2a (fourth field) in flight. Then: the review fix round, the two screens, registration, browser proof, screenshots, and the morning page's people-waiting figure. |
| **8 — distance and the state** | Questions document drafted. Plan to be perfected as Phase 7 closes, then built.                                                                                                                      |
| **9 — daily use and trust**    | Planned only as Phase 8 closes, deliberately — most of it attaches to Phase 7's referral queue, which has changed shape twice during its own build.                                                  |

Working method throughout: subagent-driven development. One implementer at a time in this worktree (the
pre-commit hook inspects the whole tree, so two agents cannot commit independently); read-only reviewers
may run concurrently. Every task gets a brief, a report, a review, and a fix round where the review
finds anything.

**Every new test is mutation-tested** — the behaviour it guards is deliberately broken, the test watched
to go red, the failure line quoted, and the source restored byte-identically. Phase 6 found **ten** tests
that looked like they guarded something and did not. That is why this is not optional.

---

## 3. Where everything is written down

| What                                                                  | Where                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| This charter and audit trail                                          | `docs/ward-flow-autonomous-session-2026-08-28.md`                                                                                           |
| Owner decisions, all phases                                           | `docs/ward-flow-phase-6-7-decisions.md`                                                                                                     |
| Direction and settled refusals                                        | `docs/ward-flow-roadmap.md`                                                                                                                 |
| Phase 6 spec / plan / execution ledger                                | `docs/superpowers/specs/2026-08-27-ward-flow-phase-6-*`, `plans/`, `.superpowers/sdd/2026-08-27-ward-flow-phase-6-morning-page/progress.md` |
| Phase 7 spec / plan / execution ledger                                | `docs/superpowers/specs/2026-08-27-ward-flow-phase-7-*`, `plans/`, `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/progress.md`   |
| Phase 7 review findings, in full                                      | `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/review-findings-tasks-1-3.md`                                                     |
| Phase 8 and 9 questions                                               | `docs/ward-flow-phase-8-9-questions.md`                                                                                                     |
| Standing rules given to every implementer                             | `.superpowers/sdd/.../DISPATCH-PREAMBLE.md`                                                                                                 |
| Reusable tooling (mutation runner, page capture, registration checks) | `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/*.sh`, `*.mjs`                                                                    |

**Note:** `.superpowers/` is git-ignored, so the execution ledgers and task reports live only on this
machine. Everything that matters for the product — specs, plans, decisions, this file — is committed.

---

## 4. Decisions I made on his behalf

Appended as they happen. Each states what I decided, why, and what it costs if wrong.

_(none yet — this section fills as the session runs)_

---

## 5. Questions I did not answer, and why

Appended as they arise. These are the ones that need a fact neither of us has.

- **Still owed, and unchanged since Phase 5:** the four-stage bed model
  (`predicted → confirmed → blocked → released`) has never been checked by a ward clinician.
  `docs/ward-flow-clinician-check.md` is the one-page summary waiting to go out. Phase 6 was built so
  that being wrong costs three strings; Phase 7 so that it costs nothing at all. Phases 8 and 9 must be
  designed to the same standard. **This remains the cheapest, highest-value thing available and only he
  can do it.**

---

## 6. If this session is interrupted

Trust this file and `git log` over any recollection. The execution ledgers name every commit. Resume at
the first task in §2 without a completion line in its ledger. Do not re-dispatch a task the ledger
records as complete — a controller that lost its place and re-ran finished work is the most expensive
failure this project has recorded.

---

## 7. Things I am adding that were not asked for

Each is here because the session's own record says it is worth the time.

**A reliability gate at every phase boundary.** A local production build plus the full offline unit
suite, lint, typecheck and formatting, run once when a phase closes rather than after every task. The
build matters specifically: two defect classes in this project — a wrong Server/Client boundary, and a
missing icon entry that crashed every screen — are invisible to tests and visible only to a real build
or a real page load. All local; none provider-backed.

**Look at every screen before calling a phase done.** Ten tests in Phase 6 passed while the behaviour
they named was broken, and the defects that actually reached the rendered page — hospital names missing
from print, five bold zeros under a real hospital's name, a five-page sheet that promised one — were
each found by rendering the page and looking, never by a test. Screenshots at 390, 820 and 1440 plus
the print rendering, for every new screen.

**A running defect ledger rather than a tally at the end.** Every defect found, what class it was, and
what would have caught it earlier. Phase 6's most useful output was not the page; it was learning that
a hand-maintained list a type change cannot reach is this repository's most reliable way to ship a
silent failure. That pattern has now appeared four times: the Playwright spec regex, the nav icon map,
the route-coverage map, and the emergency department's cohort picker.

**Explicit statements of what is NOT proven.** Every phase summary says what was proven by a test I
watched fail, what was proven by looking at the screen, and what is neither. A hedge is worth less than
an honest gap.

**No pushing, no pull request.** Stated again because it is the boundary most easily eroded by a long
autonomous run. He authorised building, not publishing. Everything stays local on this branch, and the
morning summary will say exactly what is committed and where.
