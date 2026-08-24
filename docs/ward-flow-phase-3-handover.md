# Ward Flow Phase 3 — session handover

Rewritten 2026-08-23, at the end of session 3. **All twelve tasks are built.** A whole-branch review
found 2 Critical, 6 Important and 5 Minor; the Criticals and all six Importants are fixed. What
remains is reconciliation, verification, the `main` merge, and closing out.

**Read this file first, then `docs/ward-flow-phase-3-ledger.md`, then
`docs/ward-flow-phase-3-rulings.md`.**

---

## 1. STOP AND READ THIS FIRST — the branch is DIVERGED

`git rev-list --left-right --count HEAD...@{u}` reports **8 local, 10 remote.**

**A second Claude session worked on this same branch and pushed ten commits.** It independently fixed
the same two defects my agents were fixing. Both sides are real work. `git merge-tree` reports
**8 conflicting files**.

### DO NOT

- **Do not force-push.** This repo's own memory records work destroyed twice by cleanup of exactly
  this kind.
- **Do not `git reset --hard`, and do not discard either side.**
- **Do not blindly `git pull`.** The merge needs a decision per hunk; see the plan below.
- **Do not `git checkout --` any file with uncommitted changes without backing it up first.** That
  destroyed a completed fix round earlier in this phase.

### The reconciliation plan (ruling R74, decided by reading both sides)

| Concern                             | Take                           | Why                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Live unit capacity** (Critical 1) | **Local (mine)**               | Theirs is `eligibleCandidates(…, units = allUnits())` — a **defaulted parameter falling back to the frozen fixture**. The Global Constraints forbid "no defaulted-parameter equivalent", and Task 6's reviewer was assigned to hunt exactly that because "a default is how a frozen value creeps back". Mine requires `units`, adds a parser-based guard barring `allUnits()` outside an allow-list, and adds a permanent Playwright test. |
| **Expired bed holds**               | **Remote (theirs), wholesale** | Spec line 201: _"An expiring hold raises an exception. It never auto-releases the bed."_ **My side never implemented it** — `bedHeldUntil` appears nowhere in `ward-derivations.ts` or `exception-drawer.tsx`. Their `a5716d832` / `1a6f163e0` add it to the action inbox. Missed by every task and by the whole-branch review.                                                                                                            |
| **Form 1A expiry**                  | **Neither**                    | The product owner cancelled the whole category (ruling R73, below). Their `e8f9805fb` builds it; a local agent was mid-way through removing mine.                                                                                                                                                                                                                                                                                          |

Their other commits (`57e33749d` attaching examination forms to non-voluntary referrals) overlap with
local finding I5 — compare before choosing.

**Local commits are UNPUSHED** because the divergence blocks a fast-forward. They are safe in the
shared object store (worktrees share `D:\Repos\Database\.git`), but they are not on GitHub.

---

## 2. Where the work is

| What         | Where                                                             |
| ------------ | ----------------------------------------------------------------- |
| Worktree     | `C:\Users\joshs\.codex\worktrees\ward-management-design\Database` |
| Branch       | `codex/ward-management-design`                                    |
| **NOT** here | `D:\Repos\Database` contains none of this work                    |
| Dev server   | `npm run ensure` prints the URL. **Never assume a port.**         |

---

## 3. What remains, in order

1. **Finish removing the legal deadlines** (ruling R73). An agent was mid-task when this was written;
   check `git status` for uncommitted work before re-dispatching — it may be complete and uncommitted.
2. **Reconcile the divergence** per the table above. Roughly an hour, eight files.
3. **Verify the last seven fixes independently.** Their test counts were taken on report and have
   **not** been re-run by the controller: node-env **153**, Chromium **42**. Everything before
   `2db08e045` was verified first-hand.
4. **Merge `origin/main`** — 568 commits behind, 33 conflicting files, mostly a squash-merge artefact
   of this branch's own earlier work (PR #2140). The product owner decided this happens after the
   phase (R35). **Bundle ruling R55's fix into it** — see §6.
5. **Handover / close out.**

---

## 4. The clinical decisions that shaped this phase

Four answers from the product owner, all of which changed the software.

**"It is just counting how long they have been in ED determining priority. So counting up."**
Deleted a fabricated Form 3B statutory deadline that seven surfaces rendered as legal timing.

**"For question 3… the reality is in ED that a patient needs review before they are referred for a
bed as they may not need a bed."** Produced the "Bed need confirmed" score factor: a patient
confirmed to need a bed now outranks one nobody has assessed. **Known gap, documented in code with no
invented proxy:** 21 of 41 open movements are voluntary, never receive a Mental Health Act
examination, and can therefore never earn it.

**"change the 4 hour limit to 24 for patients in ED."** `ED_ACCESS_TARGET_MINUTES` is 1440.

**"please can you leave the legal part and just start a clock once the patient arrives to ED. Keep
it simple for now."** — ruling **R73**, and the most important instruction of the session.

### Why R73 matters more than it looks

An agent invented a statutory figure ("72 hours… the real statutory figure under the WA Mental
Health Act 2014") from its own recollection. Asked about it, the owner gave the real two-part rule —
which then exposed that **fourteen of the fifteen Form 1A deadlines in the fixture were invented
numbers rendered as statutory timing, and all four "passed its deadline" warnings on the board were
fabricated breaches.**

That is the Form 3B disaster repeated for Form 1A, undetected through the entire phase. Worse:
Task 6A's ruling F17 had deliberately re-pointed the breach assertion at "a genuinely breached 1A" —
those were not genuine either. **One fabrication was replaced with another and nobody measured the
second.**

He then removed the whole category. **There is now no legal countdown in this model.** What remains
is time since arrival, counting up, and a departmental access target that has never claimed to be
legal.

**The standing prohibition, absolute: no agent may cite, paraphrase or infer any figure from the
Mental Health Act.** If a legal quantity is needed, it comes from the product owner or it does not
exist.

---

## 5. Still open with the product owner

1. **Does the Form 1A countdown stay gone?** R73 said "for now". If real timeframes arrive, Task 6A's
   precedent is that they return as an optional field plus one derivation — `LegalForm.dueAt` is
   already optional and `operationalScore`'s "Statutory timing" factor is dormant, not deleted.
2. **Voluntary patients cannot evidence review at all**, so they can never earn "Bed need confirmed".
   Closing it needs a general notion of "reviewed" the model does not have — the same work as gating
   referral on review, which he raised and which was measured as out of scope (only 2 of 17 referable
   movements are examined; 23 more already past that stage are not).
3. **Both 24-hour clocks now run from `openedAt`** — the departmental access target and, formerly,
   the legal window. They will read the same length. The surfaces must keep saying which is which.

---

## 6. Known and deliberately unfixed

- **R55 — no Ward Flow browser spec has ever run in CI's Production UI lane.** `scripts/playwright-pr-shards.mjs`
  holds its own copy of the spec pattern with **no ward alternation at all**, and the test whose job
  is to catch that drift has been failing rather than being fixed. Pre-existing on `main`. Correcting
  it needs hosted timing measurements unavailable locally — **bundle it with the `main` merge**, which
  is the only point it can be verified.
- **Four repository tests fail and are pre-existing**: a stale hard-coded route count in
  `design-system-adoption.test.ts` (expects 51, actual 61 — nine stale before this phase added one);
  shard-matcher drift; a `contextual-back-navigation-contract.test.ts` offender in an untouched file;
  and a Windows-environmental `session-start-hook` failure.
- **M1** — no dark, forced-colours or print coverage for any of the four new screens, which spec §14
  requires.
- **M2** — the voluntary-patient scoring gap is documented in a code comment where no user reads it.
- **M4** — `CONFIRM_CAPACITY` is role-gated but not unit-gated; the event carries no ward identity, so
  it cannot be enforced today.
- **R62** — the tracker's `Accepted` and `Collected` badges render identically.
- **`TransportView` / `mode === "transport"`** is unreachable after Task 10, deliberately not deleted
  (`AGENTS.md`: "nothing imports it" is insufficient grounds in this repository).

---

## 7. How this session was run, and why

Standing instructions from the product owner. They are not optional and they are why this phase found
what it found.

- **Verify every claim a subagent makes.** Re-run its gates yourself. Never accept a pasted number.
- **Mutation-test every test**: make the change that should kill it, **print the edited line back from
  the file**, run, watch it fail, revert. _A mutation you did not read back did not happen._
- **Read gate output, never exit codes.** Several commands here exit 0 without running.
- **Look at the screen.** Three of this session's defects were found by looking at a screenshot and
  none by a test.
- **Rule, do not stall.** 74 rulings are recorded with what each costs if wrong.

**Eleven implementers volunteered a surviving mutation this session.** Two were genuinely untestable
assertions; nine were mistimed mutations correctly diagnosed. _A mistimed mutation and an untestable
assertion look identical from outside — only the diagnosis separates them._

---

## 8. Environment traps — every one hit for real

- **`node_modules` empties to zero.** The symptom is **not** a dependency error: it is `tsc` unable to
  find `process` and most test files failing at once. **Run `ls node_modules | wc -l` before debugging
  anything broad.** Recovery: `npm ci --include=dev`, about 7 minutes. Cause is ambient to the machine
  (another worktree's push guard borrowing this one's tree), not this branch.
- **The dev server is reaped when the shell that launched it exits.** Start it as a **backgrounded
  task**, never `nohup … & disown`. **Prove liveness with Node, not `curl`** — the Playwright config
  guard uses Node, and `curl` succeeding against a dead server sends you hunting an IPv6 problem that
  does not exist.
- **`npm run lint` exits 0 without running** when the repo lock is held, printing
  `DATABASE_HEAVY_RUN_ADMISSION_BUSY`, and has also failed with `EPERM … owner.json`. **A real pass
  echoes the inner `lint:internal` eslint command with no busy marker.**
- **`git push` can succeed with its own static gate not run**, for the same reason. Read the output.
- **Vitest reports `Test Files no tests` at exit 0** under load — six recorded occurrences. **The count
  is the evidence, never the word "passed".** Run jsdom files one per invocation.
- **A bare `npx playwright test` is rejected by a config guard while still looking like it ran.**
  Always pass `PLAYWRIGHT_BASE_URL`.
- **Warm every route with `curl` before Playwright.** `cpus: 1` means a first compile can exceed
  Playwright's waits and produce a failure identical to a regression.
- **The Browser pane cannot composite frames here.** Drive headless Chromium directly; put the script
  inside the repo so it resolves `playwright`.
- **`.next/dev/types/validator.ts` goes corrupt** and turns `tsc` red for no source reason. Delete it.
- **`git commit` can exceed two minutes** on the pre-commit docs hook.
- **`npm run format` can hang.** Use `npx prettier --write <files>`.
- **Do not use the Monitor tool for gates.** Events routinely never fire; five agents stalled on them.

---

## 9. Verification baselines

Measured first-hand by the controller at `421d9a666`:

| Gate                                           | Result                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit -p tsconfig.json`            | clean                                                                                                   |
| Node-env ward suites, 11 files, one invocation | **152 passed**                                                                                          |
| jsdom, one file per invocation                 | `ward-screen` 3, `ward-flow-clock-consistency` 1, `ward-flow-provider` 4, `ward-flow-queue-selection` 1 |
| Ward Chromium, chromium only, 3 spec files     | **40 passed**                                                                                           |
| `npm run lint`                                 | genuine pass                                                                                            |

**Not yet verified first-hand:** the six commits after `421d9a666` report node-env **153** and
Chromium **42**. Re-run before trusting.

```bash
npx vitest run tests/ward-flow-reducer.test.ts tests/ward-flow-contracts.test.ts tests/ward-model-phase3.test.ts tests/ward-model.test.ts tests/ward-flow-single-source.test.ts tests/ward-clock.test.ts tests/ward-priority.test.ts tests/ward-pressure.test.ts tests/ward-derivations.test.ts tests/ward-management.test.ts tests/tracker-derivations.test.ts
```

```bash
PLAYWRIGHT_BASE_URL=<url from npm run ensure> npx playwright test tests/ui-ward-coordinator.spec.ts tests/ui-ward-management.spec.ts tests/ui-ward-roles.spec.ts --project=chromium --reporter=line
```

**Never run** `verify:ui`, `verify:release`, `eval:*`, `check:supabase-project`, `test:live`, or
anything touching OpenAI, Supabase, GitHub Actions or the live database.

---

## 10. Where everything is

| Need                                         | File                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| **State and how to resume**                  | this file                                                                    |
| Execution record, every ruling in full       | `docs/ward-flow-phase-3-ledger.md`                                           |
| **All 74 rulings, owner-facing, with costs** | `docs/ward-flow-phase-3-rulings.md`                                          |
| The whole-branch review                      | `docs/ward-flow-phase-3-workspace/whole-branch-review.md`                    |
| Briefs, reports, addenda                     | `docs/ward-flow-phase-3-workspace/`                                          |
| Binding authority                            | `docs/superpowers/specs/2026-08-19-ward-flow-phase-3-role-screens-design.md` |
| The 12-task plan                             | `docs/superpowers/plans/2026-08-19-ward-flow-phase-3-role-screens.md`        |
| Cross-phase map, Phases 1–3                  | `docs/ward-flow-complete-ledger.md`                                          |

The live workspace at `.superpowers/sdd/2026-08-19-ward-flow-phase-3-role-screens/` is **gitignored**
and does not survive a clone. `docs/ward-flow-phase-3-workspace/` is the committed copy — refresh it
before any handover.

---

## 11. The lesson, stated once

**A check that claims more than it delivers is worse than no check, because it stops anyone looking
harder.** It has appeared in every phase in a different disguise: a privacy guard that read no
strings; three unfalsifiable tests; a guard whose loops ran zero times; a scanner blinded by a quote
inside a regex; a scroll assertion comparing zero to zero; a vacuity tripwire counting iterations
instead of matches; and a fixture invariant derived correctly and then only half written down.

Every one was found by someone deliberately trying to defeat the check, by measuring the data, or by
looking at the screen. **Not one was found by running the suite.**
