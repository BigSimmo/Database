# Ward Flow — cold-start handover, 2026-08-29

Everything a session with no memory of this work needs, in one page. Supersedes
`docs/ward-flow-handover-2026-08-28.md`, which described a single branch and is now wrong about the
most important thing: **there are two.**

§3 goes stale first — **check it against `git log` before acting on it.**

---

## 1. What this is

A **synthetic, offline prototype** of a psychiatric bed-flow hub for Western Australia, built for a
practising psychiatrist in Perth. It coordinates bed flow from a community team's decision to admit,
through the emergency department, to the ward, and out again through discharge.

It holds **no real patient data**, is reachable only through the administrator-gated developer hub at
`/mockups/ward-flow`, and is **not clinical decision support**. Its real output is a shared
understanding of what such a system would have to do — something to put in front of colleagues.

## 2. Where the work lives — TWO branches, deliberately

|                 | **Phase 8 — distance and the state**      | **The ward board**                                                   |
| --------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| **Worktree**    | `D:\Worktrees\Database\pr-2390-fix`       | `D:\Repos\Database\.claude\worktrees\nostalgic-vaughan-7ee231`       |
| **Branch**      | `claude/ward-flow-phases-6-7-design`      | `claude/ward-flow-ward-board`                                        |
| **`cd` prefix** | `cd /d/Worktrees/Database/pr-2390-fix &&` | `cd /d/Repos/Database/.claude/worktrees/nostalgic-vaughan-7ee231 &&` |
| **Holds**       | Phases 1–7 complete, Phase 8 in progress  | The ward board's calculation layer only — no screens yet             |

**Prefix every shell command with the `cd` for the branch you are on.** The working directory does
not reliably persist and silently reverts to a different checkout. An implementer lost an hour to
this, running its tests where its test file did not exist.

**Do not create a new worktree.** There are 221 and the machine is measurably degraded. The ward
board branch reuses an existing, already-installed folder.

**The ward board folds into Phase 8's branch when Phase 8 lands.** Phase 8 stays the main line —
owner's decision. There are no overlapping code files, so the merge should be clean.

## 3. State (verify against `git log`)

**Phases 1–7 — COMPLETE**, merged into the Phase 8 branch. Phase 6 is the morning page; Phase 7 is
the front door (referrals, matching, the coordinator's board).

**Phase 8 — the distance work. IN PROGRESS**, roughly task 4–8 of 10. Travel bands, the out-of-area
ledger, the network diagram rework. The remaining items at the time of writing: the diagram's third
step, the final visual pass, and a whole-branch review.

**The ward board — CALCULATION LAYER COMPLETE, no screens.** Nine commits, 116 tests, all green
together. Built to run safely beside Phase 8 by touching no file that exists on its branch.

| Module                      | What it holds                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `ward-admissions.ts`        | The `Admission` record — the first person _inside_ a bed, not travelling toward one |
| `ward-admissions-seed.ts`   | 267 synthetic occupancies across 23 units                                           |
| `ward-discharge-dates.ts`   | The ward's date drives the bed release                                              |
| `ward-board-derivations.ts` | The headline figure and the constraint sentence under it                            |
| `ward-statistics.ts`        | Six ward-level flow figures                                                         |
| `ward-teams.ts`             | A synthetic community team per WA region                                            |

**Nothing renders. There is no screen, no page, no picture.** Every remaining task touches files
Phase 8 owns, so the screens wait for the fold.

## 4. The documents, in the order a newcomer should read them

1. **This file.**
2. `docs/superpowers/specs/2026-08-28-ward-flow-ward-board-design.md` — the ward board's binding
   specification. Numbered decisions with their reasoning, plus **DB-1 to DB-9**, the decisions taken
   _during_ the build, each recording what an implementer refused to invent.
3. `docs/superpowers/plans/2026-08-28-ward-flow-ward-board.md` — the task plan, its parallel-execution
   addendum, and the speed model.
4. `docs/ward-flow-roadmap.md` — direction and the refusals already settled, **with their reasons**. A
   refusal with no reason attached gets reversed by the next person who finds it inconvenient.
5. `docs/ward-flow-phase-6-7-decisions.md` — every owner decision through Phases 6 and 7.
6. `docs/ward-flow-phase-8-decisions.md` and `docs/superpowers/specs/2026-08-28-ward-flow-phase-8-distance-design.md` — Phase 8.
7. `docs/ward-flow-clinician-check.md` — **the one-page summary still waiting to go to a clinician.**
8. `AGENTS.md` and `CLAUDE.md` — repository rules. They override generic habits.

## 5. The constraints that override everything

1. **Never invent a legal figure.** No figure, timeframe, threshold or duration from the Mental Health
   Act, anywhere — code, copy, comment, test or fixture. A plain Voluntary/Involuntary label is
   permitted and is **not** a legal figure. If one seems needed, stop and ask.
2. **Synthetic data only. No free text anywhere.** Every category comes from a fixed runtime array
   with a membership check.
3. **No diagnosis.** Owner decision. The layout leaves space; adding it costs one field and needs a
   recorded decision.
4. **Nothing predicted, confirmed-but-unreleased, or on leave ever reaches "beds available right now."**
5. **Every bed dimension is "does this bed accept this person", never an equality.** Most beds are
   undesignated for sex, and undesignated accepts everyone; `bed.sexDesignation === referral.sex`
   would exclude most of the network **and looks entirely reasonable in review.**
6. **Local and offline only.** Never `verify:release`, any `eval:*`, `check:supabase-project`,
   `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live database.
7. **Never push and never open a pull request.**
8. **Never `git stash`** — the stack is shared across every worktree on this machine.
9. **No gate skipped, no assertion deleted, no test loosened.**
10. **Never edit a file that exists on the other branch**, and never `git add -A` — another session may
    share the worktree.

## 6. The owner's decisions that must not be re-litigated

- **The bed is lost at the PULL, not the arrival** — even while the person waits on transport. His
  correction, and the rule the whole board rests on.
- **One discharge date drives everything.** Confirming is a **separate act** from setting it.
- **A discharge nobody has spoken about says nothing.** "Nothing outstanding" stays in the approved
  picker but is never assumed — silence and a clean bill are different facts.
- **Stay bands, verbatim:** under 1 week · 1–4 weeks · 1–3 months · over 3 months.
- **The ward states its sex-acceptance counts daily.** No per-bed designations.
- **Ten WA regions stay.** Screens lead with region; travel distance is a footnote, because most
  patients have no band (the table covers 6 of 10 regions).
- **The bed tile:** solid fill for stay length, big day count, heavy outline when past its own date.
- **The transport officer screen answers one question** — which job can I start now, and if not why
  not. A task surface, never a statistics surface.
- **A rolling 24-hour clock**, not "before tonight". Lands in `ward-bed-availability.ts` and **changes
  the printed morning page's figures** — do it at the fold, and say so on the page.
- **Leave-bed usable is multi-role** and an override is **recorded**, by role and time. The stages
  rule is unchanged: wards move beds, coordinators watch.
- **The morning page does NOT gain the blocked-discharge figure** — declined for now.

## 7. Still owed by the owner

1. **The receiving-time options** — what a ward can say about when it can take a handover. Five
   drafted and unstruck: any time · business hours only · not overnight · after the afternoon
   handover · tomorrow, not today. Needed for the transport officer's screen.
2. **The clinician check.** `predicted → confirmed → released` (with `blocked` as a flag) has still
   never been put to a ward clinician. It has now been revised once without one. He asked to be
   reminded when this phase closes, not before.
3. The three approved lists are **liable to change** — expected to become more specific. Verbatim rule
   unchanged; no agent may alter them.

## 8. How to work here, learned the hard way

**Mutation-test every test.** Break what it guards, run it, watch it go red, quote the failure line,
restore. Seventeen tests across Phases 6 and 7 passed while the behaviour they named was broken.

**`mutate.sh` is broken** — it diffs the backup against a copy of itself, so "restore verified" only
ever proved `cp` succeeded. Use `git hash-object` before and after, and compare `git status
--porcelain` against a **pre-mutation snapshot** rather than requiring it to be empty (a check that is
always red is one people learn to ignore).

**`git checkout --` cannot restore an UNTRACKED file.** It leaves the mutation in place and the
porcelain listing looks identical. Back new files up out-of-tree and restore by copy.

**A mutation that fails to bite is a question, not an answer.** Three readings, not two: the test is
fake, the test is fine, or _the probe never exercised the property_. The third looks like both.

**An invariance test needs a companion that pins an absolute** in a case where the answers _should_
differ. "This number must not change" proves nothing when everything collapses to one value — a
function refusing everyone is perfectly invariant, and so is one accepting everyone.

**`npm run test:focused` refuses a NEW test file** and demands the full suite. Use
`node scripts/run-vitest.mjs run <files>` — same lock, one file.

**Quote the `N passed` line, never the exit code.** Results are memoised, so a re-run can exit 0
having printed nothing. `GATE_RECEIPTS=refresh` when fresh evidence is the point. A refusal citing
capacity, or exit 75, means **BLOCKED, retry** — never a failure.

**Do not run `lint`, `typecheck`, the full suite, `build` or Playwright per task.** They serialise
across every worktree on this machine. Run them once, at the end.

**The pre-commit hook refuses a commit whenever other unstaged or untracked files exist under
`src/components/` or `tests/`.** That is the real mechanism behind "one implementer per worktree":
concurrent agents can _write_, but only the controller can _commit_.

**Look at the rendered page.** Every defect that actually reached the screen in this project was found
by rendering and looking — never by a test. Three widths (390/820/1440) plus print.

**The sentence the whole programme has converged on:**

> **An absent signal reads exactly like a passing one.**

A guard that never ran, a scanner that lost its place and reported clean, a retry loop exiting 0 while
printing "STILL BLOCKED", a memoised gate exiting 0 having executed nothing, and a commit made without
reading the test output. All the same shape.

## 9. What happens next, in order

1. **Phase 8 finishes** and says so.
2. **The fold** — the ward board branch merges into Phase 8's. Re-read the model afterwards rather
   than trusting this page; it has changed twice already under finished designs.
3. **Something ugly on screen in the first hour.** One ward, real seeded data, no styling.
4. **The daily sheet, before the pretty parts** — timed with a stopwatch against a 20-bed ward.
5. **The board proper**, then the print sheet **built alongside it, not after**.
6. **The transport officer's screen, the statistics page**, and retiring the old ward screen — after
   enumerating every control on it and where each one went.
