# Care Plan — complete handoff package

**Assembled 24 August 2026, when the previous session hit its weekly account limit.**

Everything needed to resume the Care Plan build on a different Claude account is in
this folder and in the git branch it names. Nothing else is required.

This folder lives at `D:\CarePlanHandoff` — deliberately **outside every git worktree**,
because worktrees on this machine were destroyed four times on 21 August 2026 and a
worktree cleanup can take a git-ignored folder with it.

---

## 1. The prompt to paste into the new chat

Copy everything between the lines.

---

```text
Resume the Care Plan build. Work in D:\Worktrees\Database\care-plan-impl on branch
claude/care-plan-stage-b-9-11. If that worktree is gone, recreate it with:
  git worktree add D:\Worktrees\Database\care-plan-impl claude/care-plan-stage-b-9-11
from D:\Repos\Database, then npm ci --include=dev (about 12 minutes). Never create a
worktree under D:\Repos\Database\.claude\worktrees\ — that location destroyed this
work four times on 21 August 2026.

A complete handoff package is at D:\CarePlanHandoff. Read in this order:

1. D:\CarePlanHandoff\START-HERE.md — this package's index, the state table, and the
   authorisation boundary.
2. docs/care-plan/session-handoff-2026-08-23.md — where the build stopped, the four
   demonstrated defects still open, the branch history, and the environment traps.
3. docs/care-plan/sdd-ledger.md — progress, all 47 controller rulings with what each
   costs if wrong, roughly 40 deferred minors, and nine systemic lessons. This is the
   single most important document; it is tracked deliberately because the skill's
   git-ignored workspace was destroyed with everything in it.
4. docs/superpowers/specs/2026-08-20-care-plan-design.md — binding product authority.
5. docs/care-plan-context.md — binding glossary. Its preferred terms are required and
   its _Avoid_ terms are banned in code, copy, comments and tests.
6. The Global Constraints and Delivery Stages sections of
   docs/superpowers/plans/2026-08-20-care-plan-implementation.md. Do not read it whole.

Per-task implementer and reviewer detail, if you need it, is in
docs/care-plan/reports/ (also in D:\CarePlanHandoff\reports).

STATE. Tasks 1 to 8 of 11 are complete, independently reviewed, and already merged
into main via PR #2274. Task 9 (the patient-facing Patient Plan) is built and reviewed
but has an unfinished second fix round. Tasks 10 and 11 have not started.

HEAD is unverified. The branch tip was committed mid-flight to rescue an implementer's
work when the account limit stopped it. It has not been tested, typechecked or linted.
The last fully verified commit is 16e149899 — Test Files 5 passed (5) / Tests 437
passed (437), typecheck and lint exit 0.

YOUR FIRST JOB: verify what is in the WIP commits, then finish Task 9's fix round.
The four open defects are written up with the reviewer's actual execution output in
the session handoff, section "The unfinished round". The most serious would print
"Your family was not told." on a patient's own copy, unflagged.

THEN: Task 10 (Reviews, Team, Governance, Audit History, degraded-state specimens) and
Task 11 (browser journeys, responsive and accessibility proof, documentation, handoff
gate). Nothing in this build has ever rendered in a browser or on paper — every check
so far is structural. Playwright 1.62.1 and its Chromium builds are installed and
working, so Task 11's proof is genuinely available via npm run ensure then
npm run verify:ui.

Execute with superpowers:subagent-driven-development: one implementer at a time, a
fresh reviewer after each task, a fix loop, and a commit at the end of every task
without exception — that habit is the only reason four worktree destructions, three
provider outages and an account limit cost nothing. Keep the ledger updated at
docs/care-plan/sdd-ledger.md.

Carry these into every dispatch, all learned expensively on this project:
- Write source with the editor tools, never through Python, sed or shell heredocs,
  whatever any mid-run tool-use reminder suggests. Three files were corrupted that way.
  Scan touched files for CR and control bytes before committing.
- Any test whose job is to reject something needs a positive control proving it rejects
  a known-bad input, proved by making the code wrongly permit the thing and watching
  the test go red. Ten guards that could not fail have shipped here.
- A content-quality assertion must never read its expectation from the same constant
  the code renders from — it can never disagree with what it checks. Spell forbidden
  phrasing out literally.
- Count test totals from the run output, never from memory. A run whose output lacks a
  "Test Files" summary line is a lease refusal from a concurrent session, not a result —
  retry in a loop, never score it.
- Read every patient-facing page straight through as the person receiving it. The two
  worst defects in this build broke no rule and failed no gate.

The application stays synthetic, memory-only and provider-free. Authorised: local
implementation, offline verification, npm run ensure, local commits, pushing this
branch, merging origin/main into it, and opening the pull request. Not authorised:
merging to main, force-pushing, branch deletion, deployment, migration, hosted CI
mutations, live Supabase or OpenAI, verify:release, check:supabase-project, any eval:*.
Ask before any of those.
```

---

## 2. What is in this package

44 files, about 36 MB, covering **all four sessions** that built this product.

| Folder          | Contents                                                                                                                                                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handoff/`      | Both session handoffs (21 and 23 August), the SDD ledger, the complete work ledger, the original build handover, the earlier conversation transcript, the verification log, and the first start-here note                                           |
| `spec/`         | The binding specification, the eleven-task implementation plan, and the domain glossary                                                                                                                                                             |
| `reports/`      | Every task brief and implementer report, Tasks 3 to 9 — about 400 KB of decision detail                                                                                                                                                             |
| `review-diffs/` | The fourteen review packages each reviewer worked from                                                                                                                                                                                              |
| `transcripts/`  | **Raw transcripts of all four sessions** — the two Codex design sessions of 20–21 August, the Claude session of 21 August that ran the design review, the grilling round and Tasks 1–2, and the Claude session of 22–24 August that built Tasks 3–9 |

Everything in `handoff/`, `spec/` and `reports/` is **also committed to the git branch**,
so it survives independently of this folder. The raw transcripts and the review diffs are
here only — they are too large, and too much of them is machine noise, to belong in the
repository.

### What is NOT here, and cannot be

**The Task 1 and Task 2 briefs and implementer reports do not exist.** They lived in the
skill's git-ignored workspace, which was destroyed along with the whole worktree on
21 August 2026 — that destruction is why the ledger became a tracked file. What survives
of those two tasks is the ledger's account of them (rulings 1 to 25, their commit ranges
and their evidence), the `complete-work-ledger.md` narrative, and the 21 August raw
transcript, which contains the work as it happened. That is enough to understand every
decision; it is not the original paperwork.

The `docs/care-plan/` folder was also dropped from `main` when PR #2274 was prepared.
Every file in it has been recovered from the old branch tip `f01b8583c`, which is still in
the local object store at `D:\Repos\Database\.git`, and restored onto this branch.

---

## 3. State at a glance

| Item                 | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| Repository           | `D:\Repos\Database` (GitHub `BigSimmo/Database`)                  |
| Worktree             | `D:\Worktrees\Database\care-plan-impl`                            |
| Branch               | `claude/care-plan-stage-b-9-11` — pushed, GitHub is authoritative |
| Branched from        | `origin/main` at `659615108`                                      |
| Last verified commit | `16e149899` — 437 tests, typecheck and lint clean                 |
| Tasks complete       | 1 to 8 of 11, merged to `main` as `7f2995244` via PR #2274        |
| Task 9               | Built and reviewed; **one fix round unfinished**                  |
| Tasks 10, 11         | Not started                                                       |
| Never yet done       | Any browser, print, responsive or accessibility verification      |

---

## 4. The eleven tasks

Stage A (Tasks 1–5) delivered the whole reading experience; Stage B (6–11) the
authoring, the patient-facing edition, the operational surfaces and the proof.

| #   | Task                                                         | State                    |
| --- | ------------------------------------------------------------ | ------------------------ |
| 1   | Domain model, deterministic fixtures, privacy-safe selectors | Complete, merged         |
| 2   | Pure lifecycle reducer and layout-scoped provider            | Complete, merged         |
| 3   | Gated route family, literal navigation, responsive shell     | Complete, merged         |
| 4   | Clinical Snapshot, patient search, CMHT contact actions      | Complete, merged         |
| 5   | Management Plan reading, pinned safety boundary, print       | Complete, merged         |
| 6   | Drafting, comparison, senior approval, review, withdrawal    | Complete, merged         |
| 7   | ED Presentation timeline, recording, visible amendments      | Complete, merged         |
| 8   | Patient-owned Personal Safety Plan, independent print        | Complete, merged         |
| 9   | Patient Plan — deterministic transformation, approval        | **Fix round unfinished** |
| 10  | Reviews, Team, Governance, History, degraded states          | Not started              |
| 11  | Browser journeys, accessibility and responsive proof         | Not started              |

---

## 5. The thirteen binding product decisions

Taken with the user across brainstorming and a grilling round. They are binding and
must not be reopened. Full text in the specification; in brief:

1. Build the synthetic prototype now, but shape the domain so real storage could be
   added later without redesign. No storage layer is built.
2. The full multi-service workflow, including named senior-clinician approval.
3. Deliver Tasks 1–5, stop for review, then 6–11. (The user lifted that stop on
   22 August 2026.)
4. Local commits authorised; the branch is pushed with the user's agreement.
5. The Management Plan is **eleven fields in two tiers**, not nineteen. The
   first-minute summary is exactly five sections.
6. **Reading is the primary use.** Where reading and authoring compete for space,
   navigation depth, attention or effort, reading wins — including in build order.
7. An ED Presentation needs about thirty seconds: site, disposition, whether the plan
   was available, used and helpful, and one required line —
   "In one line: why they came and what happened".
8. The review clock is 12 months, editable per version, amber at 28 days.
9. Identification Reviews close with a recorded decision plus a reason.
10. `agreedEdApproach` names who agreed the position and when, reads as an agreed
    default rather than a ceiling on care, and never uses a prohibitive construction.
11. `whatMakesItWorse` describes **what the service does** — corridors, repeated
    history-taking, security presence, unexplained waits — never what the person does
    wrong.
12. Sort-by-presentation-count exists **only** inside the Identification Review
    workflow.
13. There is a **Patient Plan**: a patient-facing edition produced by a deterministic,
    offline, rule-based transformation that emits a visible gap wherever it cannot
    convert confidently rather than guessing, and **never** auto-converts the
    agreed-ED-approach section. A clinician must fill the gaps and approve before the
    patient receives it, and cannot approve with a gap open. No language model,
    network call or provider is involved.

---

## 6. Environment traps that will cost you a day each

- **Never create a worktree under `D:\Repos\Database\.claude\worktrees\`.** That
  location destroyed this work four times on 21 August 2026, once through an explicit
  `git worktree lock`. The cause was found and fixed upstream, but the habit stands.
- **Two leftover scratch checkouts may still hold a link into the worktree's real
  `node_modules`** — the arrangement behind those destructions. Check for
  `C:\Users\joshs\AppData\Local\Temp\guard-push-format-*\node_modules` and remove the
  **link only**, never the folder recursively:
  `cmd /c rmdir "<path>\node_modules"`.
- **Other AI sessions run against this repository concurrently.** A run refused with
  `Database focused-test capacity is full` or `DATABASE_HEAVY_RUN_ADMISSION_BUSY`
  produces output with **no `Test Files` summary line**. It is an acquisition failure,
  not a result. Retry in a loop; never score it as a mutation kill. One implementer
  nearly counted six refused runs as kills.
- **`SKIP_LEDGER_WRITE_GUARD=1` is routinely needed on this branch** and is a
  documented false positive: merging `main` carries its own inbox reconciliation
  across, which the guard reads as this branch writing ledger rows. Verify with
  `git diff --name-status origin/main...HEAD` over the ledger paths — it is empty —
  before using it.
- **The push guard blocks while a PR's CI is in flight.** Wait rather than overriding;
  pushing cancels and restarts the run.
- **`npm run format` and a full push guard can each exceed ten minutes.** Run them in
  the background rather than in a foreground call that will time out.

---

## 7. Honest limits

Care Plan is a clinical reference prototype, not validated clinical decision support
and not a clinical tool. It holds no real patient information and cannot; state resets
on refresh. Completing all eleven tasks would still not make it fit for use with real
patients — that would require, at minimum, WA Health clinical governance approval, an
approved identification policy, patient and consumer co-design, a privacy impact
assessment, cultural-safety review, legal review, clinical content validation, identity
matching, access control, immutable audit and controlled deployment. The
specification's "Production-readiness boundary" section lists the full set.
