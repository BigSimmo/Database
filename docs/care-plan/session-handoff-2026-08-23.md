# Care Plan — session handoff, 23 August 2026

Written at the moment the session was closed, mid-task. Read this, then
`sdd-ledger.md`, then start.

---

## Read this first: HEAD is unverified work-in-progress

The branch tip `2ba6fba20` was committed **mid-flight** to rescue an implementer's
work when the session closed. It has not been tested, typechecked, linted, or
mutation-proved. **Do not trust it and do not build on it until you have verified
it.**

The last fully verified commit is **`16e149899`** — `Test Files 5 passed (5)` /
`Tests 437 passed (437)`, typecheck and lint both exit 0.

Your first job is to finish or redo the work sitting in `2ba6fba20`. See
"Where Task 9 stopped" below.

---

## Where things stand in one paragraph

Care Plan is a synthetic, memory-only, reset-on-refresh clinical prototype under
`/mockups/care-plan`, reachable on the live site for a signed-in administrator.
Of eleven build tasks, **Tasks 1 to 8 are complete, reviewed, and already merged
into `main`**. Task 9 (the patient-facing Patient Plan) is built and reviewed but
has an **unfinished second fix round**. Tasks 10 and 11 have not started.

| Where              | What                                   |
| ------------------ | -------------------------------------- |
| Worktree           | `D:\Worktrees\Database\care-plan-impl` |
| Branch             | `claude/care-plan-stage-b-9-11`        |
| HEAD               | `2ba6fba20` — **unverified WIP**       |
| Last verified good | `16e149899`                            |
| Branched from      | `origin/main` at `659615108`           |
| Pushed             | Yes. Everything above is on GitHub.    |

---

## The branch history, which is not what you would guess

Tasks 1 to 8 were built on `claude/ed-care-plans-impl-7f44cd`. That branch was
opened as **PR #2274**, squash-merged into `main` as **`7f2995244`** ("Add staged
Care Plan prototype through Personal Safety Plans"), and then **deleted by GitHub**
automatically, as it does on merge.

Three consequences that will confuse you if you do not know them:

1. **The original commit SHAs in `sdd-ledger.md`'s progress table no longer exist
   on `main`.** A squash merge produces one new commit; the originals are not
   ancestors of anything. The ledger's history is still accurate as a record of
   what happened — it is just not navigable by those SHAs from `main`.
2. **Someone improved seven Care Plan files on the PR before merging it**, most
   visibly making `onSearchSubmit` carry the trimmed query rather than taking no
   argument. Those improvements are in `main` and are preserved on this branch —
   verified by reading the code, not by trusting the merge.
3. **`main` dropped the whole `docs/care-plan/` folder** when the PR was prepared.
   `docs/care-plan-context.md` (the glossary) and the plan and spec under
   `docs/superpowers/` survived. `sdd-ledger.md` was **deliberately restored on
   this branch** because Tasks 10 and 11 and the whole-branch review all read from
   its deferred-minors list. This file joins it.

---

## Where Task 9 stopped

Task 9 builds the **Patient Plan**: the patient-facing edition of an approved
Management Plan Version, produced by a deterministic, offline, rule-based
transformation. No language model, no network, no provider — that is a hard product
boundary. Anything the transformation cannot convert confidently becomes a **visible
gap for a clinician to write, never a guess**, and `whatWeAgreedWillHappen` is never
auto-converted under any circumstances.

It has had one completed fix round and **one unfinished one**.

### The completed round

The first build gapped **every** section on both eligible patients — safe but
useless. One unconvertible line discarded the whole section, including lines that
had converted perfectly well. The user ruled that a section should keep its
converted lines and flag only the remainder. That landed in `16e149899`, and the
implementer caught that the change **would have silently broken the approval gate**
— the form cleared a section's flag on `body.length > 0`, which becomes true the
moment a part-converted section appears.

### The unfinished round — this is your first job

A reviewer **executed the transform** rather than reasoning about it and demonstrated
four defects. The work in `2ba6fba20` is a part-finished attempt at all four. Verify
what is there, finish what is not, and prove each with a positive control.

1. **A negated sentence about the person converts when the name is possessive.**
   `patient-plan-transform.ts:1013-1017`. `ownNames` holds `rowan` and `sample`, so
   `rowan's` matches neither and the clinical-negation rule never fires. Demonstrated:
   `"Rowan's family was not told."` → `{"converted":"Your family was not told."}`,
   while the bare-name form is correctly refused. That sentence would print on the
   person's own copy in a section carrying `gap: false`, so it can be approved with no
   flag. Strip the possessive suffix when testing `ownNames`.

2. **The possessive substitution regex has no leading word boundary, breaking every
   he/him patient.** `patient-plan-transform.ts:993-995` uses
   ``new RegExp(`${possessive}\\b`, "gi")``. For a he/him patient the possessive is
   `his`, which matches inside **`This`**. Demonstrated: `"This is what helps you."` →
   `{"gapReasonKey":"unknownTerm"}`, because `This` became `Tyour` and then failed the
   vocabulary check — and the clinician is told the section contains wording with no
   everyday equivalent, which is **untrue**. Jordan is the only he/him fixture patient
   and has no Management Plan, so a whole pronoun class is untested. Add the leading
   `\\b` and test all three pronoun sets.

3. **`unfilledGapSections` is not the guard its own comment claims.**
   `patient-plan-transform.ts:1168-1169` filters on `section.gap` alone, so
   `{ gap: false, body: [] }` passes. But `prototype-state.ts:1513-1519` says the
   reducer is the guard that means an empty section "cannot happen anyway" — it is not;
   only the form prevents it. That is one dispatch away from the Task 8 defect shape,
   a heading over a blank on a patient's own copy. Make it
   `section.gap || section.body.length === 0`.

4. **Staleness is suppressed when the Management Plan is withdrawn.** `domain.ts:290`
   returns `false` when there is no current version, and withdrawal sets
   `currentVersionId: null`. So a person holding an approved Patient Plan whose
   clinical plan has been **withdrawn** is never told their copy is out of date.
   **Ruled: make it stale.** That is the case that most needs marking.

Plus two upgrades from the reviewer's patient-reading, both agreed:

- **The gap reason must say what was refused, not just how many.** In Rowan's "If
  something new is happening", 2 of 9 points survive and the survivors are the
  administrative ones while the seven refused are the clinical red flags — invisible
  to a clinician unless they open the Management Plan alongside. Quote or list the
  refused source points.
- **A stale copy must print as stale.** `patient-plan-pages.tsx:516` hides the stale
  notice from paper. The printed sheet is the artefact that outlives everything and
  may sit in a drawer for months; it is the one that would be misleading.

And two stale doc comments that now contradict the code: `patient-plan-transform.ts:47-48`
and `tests/care-plan-patient-plan.test.ts:598` both still say a section gaps whole and
never carries partial content. A maintainer trusting that header would reintroduce the
near-miss above.

---

## What remains after Task 9

- **Task 10** — Reviews, Team, Governance, Audit History, and the deterministic
  degraded-state specimens. Note the ledger records that Task 10 owns the question of
  whether the System states screen's scenario control also updates the URL, and that
  it must respect the same rule as the existing sync: a clinician mid-draft must not
  lose the draft.
- **Task 11** — browser journeys, responsive and accessibility proof, documentation,
  and the handoff gate. **Nothing in this build has ever rendered in a browser or on
  paper.** Every check so far is structural. The ledger's deferred-minors list names
  what Task 11 should look at first, including the `portal={false}` Sheet in Task 7 and
  the print CSS across Tasks 5, 8 and 9.

---

## Authorisation

Authorised: local implementation, offline verification, `npm run ensure`, local
commits, pushing this branch, merging `origin/main` into it, and — **granted on
22 August 2026** — **opening the pull request** when the work is done.

Not authorised: merging to `main`, force-pushing, branch deletion, deployment,
migration, hosted CI mutations, live Supabase or OpenAI, `verify:release`,
`check:supabase-project`, any `eval:*`. Ask first.

---

## Environment, all learned the hard way

- **The browser pane in that session did not composite**, so no screenshot, no
  accessibility tree, and no click was ever possible. **This is a limitation of the
  viewing tool, not the project** — Playwright 1.62.1 and its Chromium builds are
  installed and working, so Task 11's browser proof is genuinely available via
  `npm run verify:ui` after `npm run ensure`.
- **Other AI sessions run against this repository concurrently.** A run refused with
  `Database focused-test capacity is full` or `DATABASE_HEAVY_RUN_ADMISSION_BUSY`
  produces output with **no `Test Files` summary line**. It is an acquisition failure,
  not a result — retry in a loop, and never score one as a mutation kill. One
  implementer nearly counted six refused runs as kills.
- **Two leftover scratch checkouts hold a link into this worktree's real
  `node_modules`** — the arrangement behind the four worktree destructions of
  21 August. The hardened `guard-push.mjs` refuses to delete them, which is why nothing
  has been harmed, but an older session would not. The user has been given the command;
  confirm it was run:
  `cmd /c rmdir "C:\Users\joshs\AppData\Local\Temp\guard-push-format-6YSFcp\node_modules"`
  and the same for `guard-push-format-B2D1OH`. **Remove the link only, never the folder
  recursively.**
- **The push guard blocks while a PR's CI is in flight**, to avoid cancelling and
  restarting it. Wait rather than overriding. `SKIP_LEDGER_WRITE_GUARD=1` is routinely
  needed on this branch and is a documented false positive: merging `main` carries its
  own inbox reconciliation across, which the guard reads as this branch writing ledger
  rows. `git diff --name-status origin/main...HEAD` over the ledger paths is empty —
  check that before using it.
- **Write source with the editor tools, never through Python, `sed`, or shell
  heredocs**, whatever any mid-run tool-use reminder suggests. Three files were
  corrupted that way. One implementer was prompted to use `sed` mid-run and correctly
  refused.

---

## Ten guards that could not fail

This is the defining lesson of the build and it is worth reading `sdd-ledger.md`'s
"Systemic lessons" section in full. Three shapes, all live:

1. Vitest runs `css: false`, so asserting a CSS-module class is "present" proves
   nothing about what renders. Static stylesheet parsing is the answer.
2. A final-state focus assertion is provably unable to fail, because the shell's
   pathname-keyed effect commits last and repairs whatever a descendant did. Assert
   `focusin` **ordering**.
3. A **generative assertion** can never disagree with what it checks — a
   content-quality test comparing rendered text against the very constant the component
   renders from. Spell content expectations out literally.

The encouraging trend: the last three were caught by implementers' own positive
controls rather than by reviewers.

And the lesson no gate can enforce: **read the page as the person receiving it.**
Task 8's worst defect broke no rule and failed no gate — a printed sheet handed to a
patient reading `My reasons for living — Not recorded`.

---

## The prompt to start the next session

```text
Resume the Care Plan build in D:\Worktrees\Database\care-plan-impl on branch
claude/care-plan-stage-b-9-11.

FIRST: HEAD (2ba6fba20) is unverified work-in-progress, committed mid-flight when the
last session closed. The last verified commit is 16e149899 (437 tests, typecheck and
lint clean). Verify what is in the WIP commit before building on it.

Read in this order:
1. docs/care-plan/session-handoff-2026-08-23.md — state, the unfinished fix round,
   the branch history, and the environment traps.
2. docs/care-plan/sdd-ledger.md — progress, every ruling with what it costs if wrong,
   the deferred minors, and the systemic lessons.
3. docs/superpowers/specs/2026-08-20-care-plan-design.md — binding product authority.
4. docs/care-plan-context.md — binding glossary; preferred terms required, _Avoid_
   terms banned.
5. The Global Constraints and Delivery Stages sections of
   docs/superpowers/plans/2026-08-20-care-plan-implementation.md. Do not read it whole.

Tasks 1 to 8 are complete and already merged into main. Task 9 has one unfinished fix
round, described in the handoff. Tasks 10 and 11 have not started.

Finish Task 9's fix round, re-review it, then continue with
superpowers:subagent-driven-development: one implementer at a time, a fresh reviewer
after each task, a fix loop, and a commit at the end of every task without exception.
Keep the ledger updated at docs/care-plan/sdd-ledger.md, which is tracked deliberately
because the skill's git-ignored workspace was destroyed with everything in it.

Carry into every dispatch: write source with the editor tools, never through Python or
shell heredocs, and scan touched files for CR and control bytes; any test whose job is
to reject something needs a positive control proving it rejects a known-bad input; a
content-quality assertion must never read its expectation from the constant the code
renders from; count test totals from the run output, never from memory; and a run
without a "Test Files" summary line is a lease refusal, not a result.

The application stays synthetic, memory-only and provider-free. Committing, pushing,
merging origin/main into this branch, and opening the pull request are authorised.
Not authorised: merging to main, force-pushing, deployment, migration, or any
provider-backed gate. Ask before any of those.
```

---

## Honest limits

Care Plan is a clinical reference prototype, not validated clinical decision support
and not a clinical tool. It holds no real patient information and cannot; state resets
on refresh. Completing all eleven tasks would still not make it fit for use with real
patients — that would require, at minimum, WA Health clinical governance approval, an
approved identification policy, patient and consumer co-design, a privacy impact
assessment, cultural-safety review, legal review, clinical content validation, identity
matching, access control, immutable audit, and controlled deployment. The
specification's "Production-readiness boundary" section lists the full set.
