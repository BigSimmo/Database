# Ward Flow — handover after Phase 7

**Written 2026-08-28** by the autonomous session that built Phases 6 and 7. This is what a new chat
needs to pick the work up without re-deriving anything.

---

## 1. Where to work — read this before running any command

**Worktree:** `D:\Worktrees\Database\pr-2390-fix`
**Branch:** `claude/ward-flow-phases-6-7-design`

**Do NOT create a new worktree.** This machine already has over 200 of them and it is measurably
degrading performance. Prefix `cd /d/Worktrees/Database/pr-2390-fix &&` onto **every** command — an
agent that relied on a directory persisting silently operated on a different checkout for an entire
task.

**Everything is local. Nothing has been pushed and no pull request exists.** The product owner
authorised building, not publishing. Do not push, do not open a PR, do not make any GitHub write
unless he asks in that session.

---

## 2. The constraints that override everything

These are not style preferences. Each was learned expensively and two of them are the reason this
prototype is still defensible.

1. **Never invent a legal figure.** No figure, timeframe, threshold or duration from the Mental
   Health Act, anywhere — code, copy, comment, test or fixture. A plain Voluntary/Involuntary label
   is permitted and is not a legal figure. This codebase has already carried an invented Form 1A
   deadline, written in from an assistant's recollection; the owner removed it on 2026-08-23.
   `tests/ward-legal-figure-guard.test.ts` enforces this by the **shape** of a declaration, not its
   name — any new exported declaration in `ward-model.ts` that writes a number down needs a real
   `MODEL_CONSTANT_PROVENANCE` entry. It caught one on this branch.
2. **Synthetic data only.** A `Referral` carries exactly five permitted facts about a person — age
   band, sex, home region, whether a secure bed is needed, whether a bed that can hold someone
   involuntarily is needed. Nothing else, ever. No name, date of birth, record number, address,
   diagnosis, narrative history or treatment. **Free text counts as data.** Widening that list is a
   governance decision the owner takes; he took one on 2026-08-28 to add home region.
3. **Local and offline only.** Never `verify:release`, any `eval:*`, `check:supabase-project`,
   `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live database.
4. **Nothing predicted, confirmed-but-unreleased, or on leave is ever added into "available now."**
   The rule Phase 5 exists to hold and Phase 6 was built to protect.
5. **Never force-push, `git reset --hard`, or discard either side of a diverged branch. Never delete
   a worktree unasked. Never `git stash`** — the stash stack is shared across every worktree on this
   machine and holds other people's work; an agent did it once against instruction. **Never a
   wildcard revert** — `git checkout HEAD -- .`, `git restore .`, `git clean -fd` — for the same
   reason: this worktree is shared and there is no undo for a working tree.
6. **Do not skip a gate, delete an assertion, loosen a test, or lower a tolerance.** If a change
   would reduce what can honestly be claimed, do not make it — say so instead.

---

## 3. The bed model — the owner's own, and easy to get wrong

A bed is a **combination** across four independent dimensions:

- **age** — Older Adult / Adult / Youth
- **legal status** — Voluntary / Involuntary
- **sex designation** — and **most beds are UNDESIGNATED**
- **forensic**

**Sex designation is a CONSTRAINT on who may occupy a bed, never a value to compare for equality.**
Every dimension is an accepts-rule: "does this bed accept this person", not "does this field equal
that field". Getting this wrong is the phase's defining hazard, and it was finally proven correct by
raising two referrals identical but for sex through the app's own form and looking: twelve
undesignated units accept both, Geraldton accepts only Female, Fiona Stanley only Male, thirteen of
twenty-three each way.

**Still unvalidated, and it is the highest-value thing outstanding:** the four-stage bed model
(`predicted → confirmed → blocked → released`) **has never been checked by a ward clinician.**
`docs/ward-flow-clinician-check.md` is the one-page summary waiting to go out. Phase 6 was built so
being wrong costs three strings; Phase 7 so it costs nothing at all; Phase 8 the same. Only the owner
can close this.

---

## 4. What exists now

**Phase 7 — the front door — is complete.** Nine tasks, four fix rounds, three reviews. The branch is
green: `Test Files 57 passed (57)`, and every static gate, registration gate and Chromium ward
journey passes.

Built this phase: the referral model and its events; the referral intake form (phone-first); the
coordinator's referral board and match view; the people-waiting figure on the morning page; nav
registration at six fail-closed sites; and a Chromium journey from phone intake through to
acceptance.

Phase 6 built the morning page and its printed sheet. Phases 1–5 built the coordinator screens, ward
screens, emergency department screens, transport, handover and the statewide flow diagram.

---

## 5. Where everything is written down

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Owner decisions, Phases 6 and 7      | `docs/ward-flow-phase-6-7-decisions.md`                                                   |
| Direction and settled refusals       | `docs/ward-flow-roadmap.md`                                                               |
| Phase 7 spec                         | `docs/superpowers/specs/2026-08-27-ward-flow-phase-7-front-door-design.md`                |
| Phase 8 questions (both phases)      | `docs/ward-flow-phase-8-9-questions.md` — **section 3 is the facts nobody has**           |
| Phase 8 decisions D8-1 … D8-8        | `docs/ward-flow-phase-8-decisions.md`                                                     |
| Phase 8 spec (14 decisions)          | `docs/superpowers/specs/2026-08-28-ward-flow-phase-8-distance-design.md`                  |
| Phase 8 implementation plan          | `.superpowers/sdd/phase-8-draft/2026-08-28-ward-flow-phase-8-distance.md` — 10 tasks      |
| Phase 9 decisions D9-1 … D9-9        | `.superpowers/sdd/phase-9-draft/ward-flow-phase-9-decisions.md`                           |
| The autonomous session's audit trail | `docs/ward-flow-autonomous-session-2026-08-28.md` — decisions made on his behalf, and why |
| Execution ledger, every task         | `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/progress.md`                    |
| Standing rules given to implementers | `.superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/DISPATCH-PREAMBLE.md`           |

**`.superpowers/` is git-ignored**, so the ledger, the task reports and the two draft documents live
only on this machine. The specs, plans and decisions that matter for the product are committed.

**Two documents still need moving into `docs/` and committing** once the tree is clean: the Phase 8
implementation plan (→ `docs/superpowers/plans/`) and the Phase 9 decisions (→ `docs/`). They were
drafted into the ignored area deliberately, because an untracked file under `docs/` makes
`snapshot:repo-awareness` refuse to run and can block another agent's commit in a shared worktree.

---

## 6. How to verify anything — the part most easily got wrong

**Run the whole ward suite, discovered from disk, never a hand-picked list:**

    cd /d/Worktrees/Database/pr-2390-fix && bash .superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/check-ward-suite.sh

**A hand-picked list of suites shipped a red test on this branch twice**, and did the same in Phase 6.
The script discovers every ward test file from disk, refuses when discovery returns zero, and refuses
to call an exit-0 run green when it printed no `Tests N passed` line.

For a new route, run every registration gate the same way:

    cd /d/Worktrees/Database/pr-2390-fix && bash .superpowers/sdd/2026-08-27-ward-flow-phase-7-front-door/check-registration.sh

Other tools in that directory: `mutate.sh` (applies a mutation, runs tests with lease retry, restores
byte-identically, verifies, re-runs — and refuses if the `sed` matched nothing) and `capture.mjs`
(renders a route at 390/820/1440 plus print, reporting overflow, `h1` count, console errors,
duplicate test ids, A4 page count and print ink colour).

**Six things that will otherwise cost you a day:**

- **`GATE_RECEIPTS=refresh` on every gate run.** Without it a memoised run exits 0 having executed
  nothing, printing no test count.
- **Read the decisive line, never the exit code.** An agent's twenty-minute retry loop exited 0 while
  its own final line read "STILL BLOCKED" — the zero came from the loop's closing `echo`.
- **`capacity is full` / `heavyweight command is active` / exit 75 /
  `DATABASE_HEAVY_RUN_ADMISSION_BUSY` means BLOCKED, not failed.** The lease is machine-wide and
  shared with every other worktree. Retry in a loop; never delete lock state.
- **Chromium reaches assertions Vitest cannot.** Two red tests shipped here because only the Vitest
  suite was re-run. If a `ui-ward-*.spec.ts` is in your diff, run it.
- **If `typecheck` behaves strangely while a dev server is running**, check
  `.next/dev/types/routes.d.ts` — the dev server corrupted it mid-write once, and a later run passed
  only because the file was _absent_. Neither result was trustworthy.
- **`npm run ensure` and use the URL it prints.** Never assume `localhost:3000`; verify project
  identity at `/api/local-project-id` before attaching to anything.

---

## 7. The defect classes this project actually ships

Not hypothetical. Each has happened here, most of them more than once.

**A hand-maintained list a type change cannot reach.** Five instances: a Playwright spec regex that
made a browser test silently never run, the nav icon map, the route-coverage map, the emergency
department's cohort picker, and the CI scope list. Fixed structurally in Phase 7 — a guard now
enumerates `ui-ward-*.spec.ts` **on disk** and fails if any is missing from either hand-maintained
regex.

**Two screens, two answers, from the same state.** Four instances on this branch alone: two gates
reading `allocatable` where the rest of the system reads `availableNow`, and an urgency picker showing
"1" while two boards showed "Tier 1 · most urgent", then the match view showing a bare "Tier 2" under
a board row showing the full version. **The fix is one exported function, not two files agreeing.**

**A test that looks like a guard and is not.** At least six instances. Shapes seen here: a regex
missing `\w*` or a word boundary; `toContain("age")` matching "manage"; truthiness where membership
was needed; a denylist an obvious rephrasing survives; a `Required<T>`/`Object.keys` structural check
(**Vitest does not typecheck**, so a new optional field leaves it green); an assertion written against
the very function it tests; and a non-vacuity floor that can never be violated. **Every new assertion
gets mutation-tested — break it, watch it go red, quote the line, restore byte-identically.** And
**check the mutation you chose can actually fail on the fixture you run it against**: one proposed
here was a no-op, which made a test look like a guard when it was not.

**A defect invisible to every test and visible on screen.** Phases 4, 5 and 6 each shipped one.
Phase 6's were: every hospital name missing from the printed sheet, five bold zeros under a real
hospital's name, and a sheet that promised one page and rendered five. Phase 7's sweep found four
more text colours printing near-invisibly on white paper — by measuring **every painted leaf of
text**, not by reading the list of styles that were supposed to be covered. **Look at every screen at
390, 820 and 1440, plus print, before calling a phase done.**

**A stale comment asserting a fact.** How the invented Form 1A deadline entered this codebase in the
first place. Treat one as a real finding, not a nitpick.

---

## 8. What to do next

**Phase 8 — "Distance and the state"** is fully specified and planned, and nothing blocks it. Ten
tasks: `1→2→3` serial, then `4` and `5` independent, `6` before `7→8→9` (all three edit the same
diagram component), and `10` is the look-at-every-screen pass. Only one implementer can commit at a
time regardless — the pre-commit hook inspects the whole working tree.

**The single thing most likely to go wrong in Phase 8**, in the plan writer's own words: _"it will
look like diligence when it happens."_ Showing the out-of-area measure working at all means recording
that some real hospital is far from some real region. The owner ruled on 2026-08-28: **"Invent simple
placeholders for now easy to change later."** That is D8-8, and it comes with four binding rules —
one fixture table with nothing derived; no test asserting a specific band for a specific place; values
chosen to exercise the code with an explicit instruction **not to open a map**; and the screen saying
they are invented. An implementer who looks up the real distances has quietly turned a placeholder
into an unverified claim about a real hospital.

**Phase 9 — "Daily use and trust"** has nine decisions written but no specification yet. **D9-4 is the
highest-risk item in the whole project**: an ownership clock whose colour threshold is invented, on a
screen full of legal-sounding language. Three prohibitions travel with it — no unprovenanced duration
constant, no word implying legal consequence (expired, breached, overdue), and no countdown counting
_down_ to anything.

---

## 9. Open questions only the owner can answer

Nothing is blocked on these; each was designed around rather than across. But each changes what gets
built, and they are cheaper to answer early.

1. **The four-stage bed model has never been checked by a ward clinician.** The cheapest,
   highest-value thing available. `docs/ward-flow-clinician-check.md`.
2. **The transport and transfer forms (4A, 4C) still carry due times** of the same unverified kind he
   removed from Forms 1A and 3B on 2026-08-23; that correction was deliberately scoped and left these
   two. The screens render a passed due time in danger red. **A legal question, untouched.**
3. **The home-region field was built as the ten WA regions**, not the four-way grouping the option he
   approved described ("too broad to point at any individual"). Cheaper to settle before Phase 8
   authors travel bands against ten regions.
4. **"Stale" versus "confirmed"** — the match view calls a bed stale; the morning page calls the same
   ward confirmed. "Stale" implies a threshold and that threshold is invented.
5. **Should a long enough wait ever outrank a more urgent person?** The only option that changes who
   gets the next bed. Explicitly not taken.
6. **Named escalation levels** — do real ones exist in WA mental health? If they do, using their names
   asserts something real. If not, whatever they are called must be visibly invented.
7. **Wording:** "People waiting for a bed" on the morning page is the session's, not his.

---

## 10. Working method

Subagent-driven development. One implementer at a time in this worktree; read-only reviewers may run
concurrently **if pinned to a commit** (`git show <sha>:<path>`) rather than reading the working tree
— that is what let a review and a build run at the same time without the reviewer reporting another
agent's half-finished edit as a defect.

Every task gets a brief, a report, a review, and a fix round wherever the review finds anything.

**Model split, the owner's instruction on 2026-08-28:** Sonnet 5 at high effort for safe, mechanical,
fully-specified subagent work; Opus for reviewers, spec and plan writers, and implementers on
clinically risky or constraint-dense surfaces. Subagents inherit the session's model unless overridden,
so this must be set deliberately on each dispatch.

**Communication with the owner:** he is a psychiatrist, not a software engineer. Lead with what
happened, plain English, no file paths or internal names unless they change what he decides, one
recommendation rather than a menu, and state plainly when something is broken or unproven.
