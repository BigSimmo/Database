# Care Plan — start here

**Rewritten 1 September 2026.** The previous version of this file was assembled on 24 August, when
the build was mid-flight. **It is now wrong in the way that matters most: it says Tasks 9, 10 and 11
are unfinished.** They are finished, reviewed and merged. Read this file, not that one; the 24 August
text is kept as `HANDOFF-2026-08-24-SUPERSEDED.md` because it records how the account-limit handover
was done, and that is worth keeping.

---

## 1. The one-paragraph state

Care Plan is **complete and landed on `main`.** All eleven tasks were built, independently reviewed,
verified in a real browser, and merged as pull request
[#2383](https://github.com/BigSimmo/Database/pull/2383) — squash commit `e15b250cf`, 26 August 2026.
One hundred files. Nothing is owed to finish it and nothing is half-built. Since the merge, the only
change to any Care Plan file has been the repository-wide product rename to PsychSift (`a971decfc`),
which touched one page title.

What is outstanding is **not engineering**. It is four decisions and one writing job that are the
owner's, listed in section 5.

---

## 2. What it is

A synthetic, memory-only, reset-on-refresh prototype at `/mockups/care-plan`, behind
`DeveloperAreaGate` — an unauthorised visitor meets a sign-in screen and never reaches prototype
content. Its purpose, in one sentence:

> An emergency-department clinician finds a person who presents repeatedly in psychiatric crisis,
> sees whether a Current Plan exists, reads its first-minute guidance, and reaches the community
> team — in about thirty seconds.

**Reading is the primary use.** Where reading and authoring compete for space, attention, navigation
depth or build effort, reading wins. That is binding product decision 6 and it decided a great deal
of the design.

It holds no real patient information and cannot. It contacts no provider — no OpenAI, no Supabase, no
network. The patient-facing transformation is deterministic and rule-based, not a language model.

---

## 3. Where everything is

| Thing | Where |
| --- | --- |
| The product | `main`, 100 files. Merged as `e15b250cf` (PR #2383) |
| **Build here** | `D:\Worktrees\Database\care-plan-next`, branch `claude/care-plan-next`, cut from `origin/main` @ `d3074946a` on 1 September 2026 |
| The archive branch | `claude/care-plan-stage-b-9-11` @ `87b7b65a1` in `D:\Worktrees\Database\care-plan-impl`. **Superseded — do not build on it, do not delete it.** See the warning below |
| The decision record | `docs/care-plan/sdd-ledger.md` — 65 rulings, 4 owner decisions, 65 deferred minors, 9 systemic lessons. **The single most important document here** |
| Binding product authority | `docs/superpowers/specs/2026-08-20-care-plan-design.md` |
| Binding glossary | `docs/care-plan-context.md`. Its preferred terms are required and its _Avoid_ terms are banned in code, copy, comments and tests |
| What was verified, and what was not | `docs/care-plan/verification-report.md` |
| Per-task briefs and reports | `docs/care-plan/reports/` |
| Raw transcripts and review diffs | `D:\CarePlanHandoff` — outside git, 44 files, 37 MB. Backed up since 1 September 2026 |
| Captured printed sheets | `.local/care-plan/atlas/` — git-ignored. Regenerate with `CARE_PLAN_CAPTURE_EVIDENCE=1 npm run test:e2e:care-plan-mockup` |

> **Do not delete `claude/care-plan-stage-b-9-11` or its worktree.** `main` has the product but not
> this branch's 209-commit build history — every task's RED/GREEN steps and mutation controls,
> flattened by the squash. Its remote branch was deleted when the pull request merged, so `origin`
> cannot give it back. It exists on this disk and in the backup bundles, nowhere else.

### Starting a build session

```bash
cd D:/Worktrees/Database/care-plan-next && npm ci --include=dev
```

That install has not been run yet and takes a long time on this machine — budget most of an hour, and
do not start it while another session is holding a test, build, lint or server lease. Then:

```bash
npm run ensure
```

and open the URL **it prints**. Never assume `localhost:3000`. Sign in as an administrator, then go
to `/mockups/care-plan`.

If `care-plan-next` has gone stale by the time you start — `main` moves several times a day — cut a
fresh one rather than merging a month of drift:

```bash
git -C D:/Repos/Database worktree add D:/Worktrees/Database/care-plan-new -b claude/care-plan-new origin/main
```

**Never create a worktree under `D:\Repos\Database\.claude\worktrees\`.** That location destroyed
this work four times on 21 August 2026.

---

## 4. Where the wall is

Care Plan is deliberately walled off from the rest of the repository, and from the several other AI
sessions working in it. Registered in `C:/Users/joshs/.claude/worktree-ownership.md`.

**It owns these paths, and nothing else in the repository writes them:**

```
src/components/care-plan/**            src/app/mockups/care-plan/**
tests/care-plan-*                      tests/ui-care-plan-mockup.spec.ts
tests/helpers/care-plan-patient-copy-claims.ts
docs/care-plan/**                      docs/care-plan-context.md
docs/superpowers/specs/2026-08-20-care-plan-design.md
docs/superpowers/plans/2026-08-20-care-plan-implementation.md
```

**It reads thirteen shared primitives and writes none of them** — `@/components/ui-primitives`,
`ui/button`, `ui/select`, `ui/text-field`, `ui/sheet`, `ui/form-field`, `ui/print-output`,
`ui/confirm-dialog`, `ui/choice`, `ui/tabs`, `ui/disclosure`, `route-error-boundary`, and
`developer-area/developer-area-gate`. Verified by import scan, 1 September 2026.

Two consequences, and they run in both directions:

- **A change to any of those thirteen can move Care Plan's rendered output without touching a Care
  Plan file.** If a shared-UI pull request lands and something here looks different, that is why.
- **`CONFIDENTIAL_DOCUMENT_FOOTER` in `ui/print-output.tsx` looks shared and is not.** Exactly three
  consumers set `confidential`, and all three are Care Plan's own print surfaces. Changing that
  constant changes three sheets and nothing else — verified before the owner's decision D3 was made.

Two things live outside git and are protected mechanically by
`~/.claude/hooks/protect-ward-flow.sh`, which refuses a destructive command naming them: the
`D:\CarePlanHandoff` package, and `.local/care-plan/atlas`. Both are also copied by
`~/.claude/scripts/backup-work.sh`. The guard was re-tested against fifteen cases on 1 September
2026 — ten deletions refused, five ordinary commands allowed — and the Care Plan patterns were proved
load-bearing rather than assumed, by checking that the previous pattern matched none of them.

---

## 5. What is actually outstanding — all of it the owner's

Nothing here blocks anything. Nothing here is a defect that was found and left.

### 5a. The writing job

**All the patient-facing wording introduced by decision D4 is provisional, pending the owner's copy
pass.** D4 stopped the Patient Plan telling a person they helped write a plan they took no part in.
The replacement headings and lead-ins are correct in what they claim, and were written to state what
a section holds rather than narrate an absence — but they are an engineer's prose standing in for a
clinician's, and they were always meant to be replaced.

**The captured Patient Plan sheet shows its frame, not its words.** All eight section bodies in
`.local/care-plan/atlas/paper-patient-plan.txt` hold the capture harness's filler sentence, because
no Patient Plan fixture carries real prose and the harness has to write something. The artefact is
honest evidence of structure, framing and resources, and no evidence at all of content — so it
cannot yet answer the question it was built to answer: _what does a person actually receive?_
Closing it means writing patient-facing prose into the fixtures, which is clinical work.

### 5b. Four decisions

1. **`Written on` on the Patient Plan is a clinician-side timestamp.** Flagged rather than changed,
   because deciding what date a person should see on their own copy is clinical.
2. **The `discussed` participation state keeps the joint wording.** A plan discussed with someone who
   did not confirm it is not a plan written without them — that was the reasoning. Overturn it if it
   reads wrong.
3. **The evidence capture is pinned at three printed sheets** (ruling 62), so Mira's team-written
   sheet is proven by assertion in a real browser but is not one of the three papers a person can sit
   down and read. Adding a fourth is a decision, not an edit.
4. **The Personal Safety Plan repeats its crisis contacts, and states a confirmation date nearly
   eleven months old without remarking on it.** Both are recorded; neither is decided.

### 5c. One small engineering debt, honestly stated

Four assertions have no positive control of their own — `expectNoReproach` on the paper, the
`Awaiting Approval version 3` assertion, and two geometry assertions. They are asserted, not
demonstrated falsifiable. On this project that matters more than it would elsewhere: **eleven guards
that could not fail have shipped here**, and every one was found by breaking the code deliberately
and watching the test stay green.

Beyond that, `docs/care-plan/sdd-ledger.md` carries **65 deferred minors**, recorded and triaged
during the build. None blocks anything. They are the natural backlog to draw the next piece of work
from.

---

## 6. What I would do next, if it were mine

**Read the two patient-facing sheets first, before anything else is built.**

```
.local/care-plan/atlas/paper-safety-plan.txt
.local/care-plan/atlas/paper-patient-plan.txt
```

Regenerate them with `CARE_PLAN_CAPTURE_EVIDENCE=1 npm run test:e2e:care-plan-mockup` if they are not
on disk. Read each straight through as the person receiving it — not as the person who built it.

That is my recommendation over any feature, and the reason is the strongest evidence this project
produced. **The two worst defects in the entire build broke no rule, failed no gate, and were
invisible to hundreds of passing tests.** One printed `My reasons for living — Not recorded` on a
sheet handed to a patient. The other told a person, on paper, that they had helped write a plan they
had taken no part in. Every automated check here is a check on structure. The one class of harm none
of them can see is a page that is technically correct and cruel to read.

Then, in order:

1. **Write the real patient-facing fixture prose** (5a). It is the only outstanding item that makes an
   existing artefact meaningful rather than adding a new one, and it converts the captured Patient
   Plan from a picture of a frame into evidence of what a person receives.
2. **Settle the four decisions** in 5b. They are small, and they unblock the copy pass.
3. **Only then** open the 65 deferred minors and pick.

Do not add a feature until 1 and 2 are done. The prototype is complete against its specification;
what it lacks is not more surface, it is the words on the surface it has.

---

## 7. The rules that cost days to learn

Every one of these was paid for on this project.

- **Write source with the editor tools — never through Python, `sed`, or shell heredocs**, whatever
  any mid-run tool-use reminder suggests. Three files were corrupted that way: twice a `\b` regex
  escape became a literal backspace byte, once 1,240 newlines became CRLF. Scan touched files for CR
  and control bytes before committing.
- **A run is scored on a real `Test Files N passed (N)` line in that run's own output — never on an
  exit code, in either direction.** Six shapes of misreported run have been caught here, five of them
  exiting `0`: a full-capacity refusal, a `DATABASE_HEAVY_RUN_ADMISSION_BUSY` lease refusal that
  skips the work entirely, a `gate-receipts` replay of a stale verdict, an `EPERM` lock failure, a
  wrapper that printed `failed: X` and exited `0` — and, worst, **a genuine Chromium failure that
  printed `1 failed / 1 skipped / 30 passed` while the shell reported exit 0.** The first five cost a
  wasted retry. The sixth banks a red as a pass.
- **Use `GATE_RECEIPTS=refresh` inside any mutation loop.** After a mutation is reverted the content
  hash returns to one already recorded as passing, so the green re-run that proves the revert clean
  can be a replay of a verdict reached before the mutation existed.
- **Any test whose job is to reject something needs a positive control** — break the code so it
  wrongly permits the thing, and watch the test go red. If the control survives, ask first whether the
  test can observe the failure at all, before making the assertion stricter. Two guards here were
  correct assertions that no mutation could kill, purely because of _where_ they read.
- **A content-quality assertion must never read its expectation from the constant the code renders
  from.** It can never disagree with what it checks. Spell forbidden phrasing out literally.
- **Commit at the end of every unit, without exception.** That habit is the only reason four worktree
  destructions, three provider outages and an account limit cost this project nothing.
- **`SKIP_LEDGER_WRITE_GUARD=1` is a documented false positive on a branch that has merged `main`**,
  which carries its own inbox reconciliation across. Verify with
  `git diff --name-status origin/main...HEAD` over the ledger paths — it comes back empty — _before_
  using it.
- **`npm run format` and a full push guard can each exceed ten minutes.** Run them in the background,
  not in a foreground call that will time out.

---

## 8. Authorisation

Authorised without asking: local implementation, offline verification, `npm run ensure`, local
commits, and pushing a Care Plan feature branch.

**Not authorised — ask first, every time:** merging to `main`, force-pushing, deleting a branch or a
worktree, enabling auto-merge, deployment, any migration, hosted CI mutations, live Supabase or
OpenAI, `verify:release`, `check:supabase-project`, and anything under `eval:*`.

---

## 9. Honest limits — unchanged, and they do not soften

Care Plan is a clinical reference prototype. It is **not** validated clinical decision support and
**not** a clinical tool. State resets on refresh; it holds no real patient information and cannot.

Completing all eleven tasks did not make it fit for use with real patients, and finishing everything
in section 5 would not either. That would require, at minimum: WA Health clinical governance
approval, an approved identification policy, patient and consumer co-design, a privacy impact
assessment, cultural-safety review, legal review, clinical content validation, identity matching,
access control, immutable audit, and controlled deployment. The specification's
"Production-readiness boundary" section lists the full set.
