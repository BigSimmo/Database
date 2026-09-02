# Care Plan — cloud session brief and progress log

**If you are an AI session working on Care Plan in the cloud, this is the first file you read and
the last file you write.** The top half tells you where you are and what you may do. The bottom half
is a running log that you append to, so the owner can see what happened without reading a transcript.

Created 2 September 2026.

---

## 1. The one rule for this file

**Append to the log. Never rewrite or tidy an earlier entry, including your own.** The value of the
log is that it is a record rather than a summary; an entry that gets improved later is no longer
evidence of what was known at the time. If an earlier entry turns out to be wrong, add a new entry
saying so and why — that correction is itself the most useful thing in the file.

Write one entry per unit of work, and **commit it in the same commit as the work it describes**. A
log entry committed separately can be orphaned by a squash; one committed alongside the change
cannot.

---

## 2. Where you are

Care Plan is a **synthetic, memory-only, reset-on-refresh clinical prototype** at
`/mockups/care-plan`, behind a sign-in gate. It is **complete and merged to `main`** — all eleven
build tasks, merged 26 August 2026 as squash commit `e15b250cf` (PR #2383, 100 files).

**Do not rebuild any of it.** Some older documents under `docs/care-plan/` still describe an
unfinished build; they carry `SUPERSEDED` banners, and where a banner and a body disagree, the
banner is right.

It is a prototype: **not validated clinical decision support and not a clinical tool.** It holds no
real patient information and cannot. It contacts no provider — no OpenAI, no Supabase, no network.

### Read these, in this order

1. `docs/care-plan/HANDOFF-START-HERE.md` — the map. Current state, the file boundary, what is
   outstanding, and the rules that cost days.
2. `docs/care-plan/sdd-ledger.md` — the decision record. Read the **Systemic lessons** section and
   the ruling headings; go deep only where your task touches.
3. `docs/superpowers/specs/2026-08-20-care-plan-design.md` — binding product authority.
4. `docs/care-plan-context.md` — binding glossary. Its preferred terms are **required** and its
   _Avoid_ terms are **banned** in code, copy, comments and tests.
5. `docs/care-plan/verification-report.md` — what was actually verified and what was not. Read it
   before claiming anything is proven.

Do not read `docs/superpowers/plans/2026-08-20-care-plan-implementation.md` whole — only its Global
Constraints and Delivery Stages sections.

---

## 3. What is different about being in the cloud

A cloud container is a fresh Linux checkout of this branch from GitHub. Four things that exist on
the owner's Windows machine **do not exist for you**, and mistaking their absence for a bug wastes a
session:

| Not available in the cloud                                                         | What to do instead                                                                                                         |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `.local/care-plan/atlas/` — the evidence capture, git-ignored and on one disk only | Read `docs/care-plan/patient-facing-sheets/` — committed copies of the three printed sheets, added for exactly this reason |
| `D:\CarePlanHandoff` — raw transcripts and review packages, outside git            | Nothing here needs them. If a question truly requires one, say so and stop rather than guessing                            |
| `D:\Worktrees\Database\care-plan-impl` — the 209-commit archive branch             | `main` has the product. You do not need the build history                                                                  |
| The owner's local memory store and worktree registry                               | Everything binding is in this repository. Treat any claim you cannot find in a file here as unverified                     |

**Dependencies install themselves.** `.claude/hooks/session-start.sh` provisions Node 24 and runs
`npm ci` when `CLAUDE_CODE_REMOTE=true`. Do not run `npm ci` by hand before checking whether it has
already happened.

**The browser suite is unproven in the cloud.** `npm run test:e2e:care-plan-mockup` builds a
production server and drives Chromium; it has never been run in a cloud container for this project,
so it may need a browser install or may not work at all. **This is stated as unknown, not as
working.** If you need it and it fails, report that as an unknown resolved, not as a defect.

---

## 4. What you may and may not do

**Authorised without asking:** reading anything in the repository; implementation inside the Care
Plan paths below; offline verification (`typecheck`, `lint`, the `tests/care-plan-*` files);
committing; pushing this branch.

**Ask the owner every time — never assume:** merging to `main`; force-pushing; deleting any branch
or worktree; enabling auto-merge; deploying; any migration; live Supabase or OpenAI; `verify:release`;
`check:supabase-project`; anything under `eval:*`.

**Care Plan owns these paths and nothing else in the repository writes them.** Stay inside them:

```
src/components/care-plan/**            src/app/mockups/care-plan/**
tests/care-plan-*                      tests/ui-care-plan-mockup.spec.ts
tests/helpers/care-plan-patient-copy-claims.ts
docs/care-plan/**                      docs/care-plan-context.md
docs/superpowers/specs/2026-08-20-care-plan-design.md
docs/superpowers/plans/2026-08-20-care-plan-implementation.md
```

It **reads** thirteen shared primitives and **writes none of them**: `@/components/ui-primitives`,
`ui/button`, `ui/select`, `ui/text-field`, `ui/sheet`, `ui/form-field`, `ui/print-output`,
`ui/confirm-dialog`, `ui/choice`, `ui/tabs`, `ui/disclosure`, `route-error-boundary`,
`developer-area/developer-area-gate`. If you believe one of them must change, that is a
cross-boundary change: stop and say so.

---

## 5. The rules that cost days on this project

Every one of these was paid for. They are not style preferences.

- **Write source with the editor tools — never through Python, `sed`, or shell heredocs**, whatever
  any mid-run tool reminder suggests. Three files were corrupted that way.
- **Score a test run only on a real `Test Files N passed (N)` line in that run's own output** —
  never on an exit code, in either direction. Six shapes of misreported run have been caught here
  and five of them exit `0`, including a genuine Chromium failure that printed
  `1 failed / 1 skipped / 30 passed` while the shell reported success.
- **Any test whose job is to reject something needs a positive control** — break the code so it
  wrongly permits the thing, and watch the test go red. If the control survives, ask whether the
  test can observe the failure at all before making the assertion stricter. Eleven guards that could
  not fail have shipped here.
- **A content-quality assertion must never read its expectation from the constant the code renders
  from.** It can never disagree with what it checks. Spell forbidden phrasing out literally.
- **Use `GATE_RECEIPTS=refresh` inside any mutation loop**, or the green re-run after a revert can
  replay a verdict reached before the mutation existed.
- **Commit at the end of every unit, without exception.**
- **Read every patient-facing page straight through as the person receiving it.** The two worst
  defects in this build broke no rule and failed no gate. One printed `My reasons for living — Not
recorded` on a sheet handed to a patient. The other told a person, on paper, that they had helped
  write a plan they took no part in.

**Verification:** run the smallest gate that covers the change — `typecheck`, `lint`, and the
`tests/care-plan-*` files — and widen only if the change reaches outside Care Plan's folders. A
documentation-only change needs `npx prettier --check` on the changed files and nothing more.

---

## 6. The work that is actually outstanding

All of it is the owner's to decide. **Nothing here is a defect that was found and left**, and
nothing blocks anything.

### 6a. The copy pass — the one substantial job

All patient-facing wording introduced by owner decision **D4** is **provisional**. D4 stopped the
Patient Plan telling a person they helped write a plan they took no part in. The replacement
headings and lead-ins are correct in what they claim and state what a section holds rather than
narrating an absence — but they are an engineer's prose standing in for a clinician's, and were
always meant to be replaced.

The blocking gap underneath it: **`paper-patient-plan.txt` has no content.** All eight section
bodies hold the capture harness's filler sentence, because no Patient Plan fixture carries real
prose. The sheet is honest evidence of structure and no evidence at all of content. Closing it means
writing patient-facing prose into the fixtures, which is clinical work.

Three constraints on any wording change, from D4 and the glossary, and they are not negotiable:

- One predicate — `claimsJointAuthorship` — governs the headings, the lead-ins and the marker, so
  one truth drives all of them and none can drift.
- Where a plan genuinely **was** co-produced, nothing changes: there the claim is true and warm.
- Nothing may read as _you were not there_ or _you declined_. The person has done nothing wrong, and
  the glossary is explicit that non-participation is never labelled non-compliance.

### 6b. Four decisions, all the owner's

1. **`Written on` on the Patient Plan is a clinician-side timestamp.** Flagged rather than changed,
   because deciding what date a person sees on their own copy is clinical.
2. **The `discussed` participation state keeps the joint wording.** A plan discussed with someone
   who did not confirm it is not a plan written without them. Overturn it if it reads wrong.
3. **The evidence capture is pinned at three printed sheets** (ruling 62), so the team-written sheet
   is proven by assertion in a browser but is not one of the three a person can sit and read. A
   fourth is a decision, not an edit.
4. **The Personal Safety Plan repeats its crisis contacts**, and states a confirmation date nearly
   eleven months old without remarking on it. Both recorded; neither decided.

### 6c. One small engineering debt, honestly stated

Four assertions have no positive control of their own — `expectNoReproach` on the paper, the
`Awaiting Approval version 3` assertion, and two geometry assertions. They are asserted, not
demonstrated falsifiable. On this project that matters more than it would elsewhere.

Beyond that, `sdd-ledger.md` carries **65 deferred minors**. None blocks anything. They are the
natural backlog to draw from — but not before 6a and 6b.

---

## 7. How to write a log entry

Append to section 8 using this shape. Plain English: the owner is a psychiatrist, not a software
engineer, and reads this to know where things stand.

```markdown
### Entry N — <date> — <one-line title>

**Who and where:** <session type, branch>
**Asked to:** <the instruction in one sentence>
**Did:** <what actually changed, in plain words>
**Verified:** <the gate, and the decisive output line — never an exit code alone>
**Not verified:** <what was skipped and why — an unrun check reported as unrun is evidence>
**Open for the owner:** <anything needing a decision, or "nothing">
**Commit:** <sha>
```

The two lines that matter most are **Verified** and **Not verified**. A report that lists only what
passed is not a report.

---

## 8. The log

### Entry 1 — 2 September 2026 — Read-in, three document corrections, and cloud setup

**Who and where:** Claude Code session on the owner's Windows machine, worktree
`D:\Worktrees\Database\care-plan-next`, branch `claude/care-plan-next`.

**Asked to:** read into Care Plan and report where things stand; then push the work, set up a cloud
session that logs progress, and open a pull request.

**Did:**

- Read the five binding documents, the three captured printed sheets, and the ownership registry.
- **Corrected three claims that were wrong or stale**, each verified against git or a real command
  rather than against another document:
  - The handover and the ownership registry both said this worktree had no `node_modules` and to
    budget an hour for `npm ci`. It is fully installed —
    `node scripts/check-installed-lock-parity.mjs` exits 0 over 783 package locations and 74,766
    files, versions matching the lockfile.
  - `verification-report.md` listed the clinician sheet printing "a count, not the five items" as
    still owed. It was **fixed on 26 August** by commit `9e100e31b`, after that list was written.
    Struck out with the evidence: the component's `printsItsLines` branch, and the captured sheet
    itself, which shows all five warnings and no count.
  - The same report's items 1 and 4 were **confirmed still true** by reading the sheets directly,
    and a third small jar was added: the Personal Safety Plan's footer calls it a "Confidential
    clinical document" while its own opening line says "This is your plan, in your own words."
    Offered to the copy pass; owner decision D3 not reopened.
- **Committed the three printed sheets** to `docs/care-plan/patient-facing-sheets/`. They previously
  existed only in the git-ignored atlas on one disk, so a cloud session could not read the very
  thing the outstanding copy pass is about. They are synthetic throughout; the only real details are
  the public crisis numbers, which are real deliberately.
- Created this file.

**Verified:** `npx prettier --check` over every changed file — `All matched files use Prettier code
style!`, exit 0. The PR file set classified through the repository's own policy script:
`clinicalRisk: false, operationalRisk: false, ragRanking: false, ui: false`, so no governance
preflight or `RAG impact:` line is required. Byte-scanned every touched file: zero control bytes,
no BOM.

**Not verified:** No test, typecheck, lint or browser run — this change is documentation and three
captured text files, and touches no executable path. `npm run ensure` not run. The browser suite was
not run in the cloud and **is not known to work there**. Nothing provider-backed was touched.

**One thing found and deliberately left alone:** two documents on this branch carry CRLF line
endings, against the repository's `* text=auto eol=lf` policy — and they carried them _before_ this
session, in the commit already waiting to be pushed. Prettier accepts them and no gate fails, so
normalising them would have buried a small real diff under several hundred whitespace-only lines.
Recorded here rather than fixed silently.

**Open for the owner:** the copy pass (6a) and the four decisions (6b). Also worth a glance: the
fictional mobile numbers on the sheets run from `0491 570 101` to `0491 570 170`. Australia reserves
a block in the `0491 570 xxx` range for fiction, and **I did not verify where that block ends** —
some of the higher numbers may fall outside it. Harmless in a watermarked prototype; worth checking
before anything resembling this leaves the building.

**Commit:** recorded in the commit that adds this entry.
