# The fold of 2026-08-31 — what merges, what is copied, and what must NOT be merged

**Owner's instruction, first-hand:** *"pause once the urgency task is done and merge everything
together and ensure everything is cleaned up, synced, and all chats content is saved"*, then
*"review and complete on all chats to ensure all their content is saved and documented and indexed
and merged together"*.

⚠️ **Every figure below was measured on 2026-08-31 against `claude/ward-flow-phases-6-7-design`.
Re-measure before acting: three branches moved while this file was being written.**

---

## 1. ✅ BRANCH MERGES — two, both proved clean with `git merge-tree`

| Branch | Owner | Position | Merge |
| --- | --- | --- | --- |
| `claude/ward-flow-wave1-referral-corrections` | Ward Referrals | **+1** (urgency display) | trivial |
| `claude/ward-flow-print-fixes` | Ward Board | **6 ahead / 6 behind** | ✅ CLEAN |
| `claude/ward-flow-setup-967aa0-wf` | Ward Verifier | **11 ahead / 25 behind** | ✅ CLEAN |

**Ward Core performs all three. One committer per worktree; nobody else merges into the main line.**

⚠️ **Two things Ward Board flagged rather than hid, and they travel with its six commits:**

1. **`tests/zz-clock-probe.test.ts` is committed scratch** — a `describe.skip` containing nothing,
   documented as safe to delete. It was committed because the protected-work hook refuses deletion
   anywhere in the tree and the pre-commit hook refuses to proceed while it sits untracked.
   ✅ **Delete it in the fold; nothing imports it and it asserts nothing.**
2. ⚠️ **Its mutation evidence is NOT re-audited** under the refused-mutation finding below. Every
   mutation was confirmed applied by grepping the file, and two printed the expected assertion —
   **but it has not been revisited, and it says so rather than restating it as proof.**

---

## 2. ⛔ TWO BRANCHES THAT MUST NOT BE MERGED — and the number that says why

```
claude/Ward-design     behind 275   ahead 223   CONFLICTS
claude/Wardquestions   behind 275   ahead 223+  CONFLICTS
```

> ⛔ **CORRECTED 2026-08-31 BY WARD CORE. THE CONCLUSION STANDS; MY REASON FOR IT WAS WRONG TWICE
> OVER AND MUST NOT BE REPEATED.**

**I wrote: *"merging either would delete about 57,000 lines"*, from a two-dot diff of 604 files,
51,209 insertions, 57,114 deletions, *"identical for both branches"*. ⚠️ **Three errors.**

**1. ⛔ A TWO-DOT DIFF IS NOT WHAT A MERGE DOES.** `git diff MINE BRANCH` answers *"what does that
branch look like relative to me"*. **A merge applies only changes since the MERGE BASE** —
`b183dc65a` for both. Measured every way, whole tree:

```
                  two-dot (git diff M b)          THE MERGE (git diff M...b)
Ward-design       899 files  +88,871  -76,334     662 files  +87,646  -6,745
Wardquestions     898 files  +95,260  -73,006     673 files  +97,363  -6,745
```

✅ **A merge would delete 6,745 lines, NOT 57,000. Off by a factor of eight.**

**2. ⚠️ I SCOPED TO `-- src tests` AND REPORTED IT AS THE WHOLE TREE.** That is why my figures
matched nothing Ward Core measured. Scoped, they reproduce exactly: **608 files, 51,251 insertions,
57,840 deletions** — my numbers, the tips having moved since. **The unit unnamed again, in the
manifest that carries the stamp-every-count rule.**

**3. ⚠️ "IDENTICAL FOR BOTH BRANCHES" WAS AN ARTEFACT OF THAT SCOPE.** Under `src tests` they ARE
identical; whole tree they differ — 899 files against 898, +88,871 against +95,260. **I presented a
property of my chosen filter as a property of the branches.**

> ⛔ **AND WARD CORE'S REASON FOR MAKING ME FIX IT IS THE POINT: "a wrong reason attached to a right
> conclusion is how the conclusion gets overturned six weeks later"** — **somebody checks "it deletes
> 57,000 lines", finds it false, and concludes the refusal was alarmist.**

### ✅ THE REFUSAL, ON THE CORRECT NUMBERS

```
                 real conflicts   merge brings          deletes
Ward-design            7          ~87,600 lines of      6,745 lines
Wardquestions         11          unrelated repo        6,745 lines
                                  history
```

⚠️ **Seven and eleven REAL conflicts; roughly 90,000 lines of unrelated repository history dragged
onto a ward branch; and 6,745 deletions nobody has reviewed.** ✅ **Still refused, on evidence that
survives checking.**

**The cause: both were cut from an older point on the REPOSITORY's history.** ⚠️ **The non-merge
commits they carry that the ward line lacks are not ward work at all** — they are therapy-compass,
design-system hazard paydown, answer mockups, PR #2416. **Merging drags the tree back to its
27 August state.**

> ⚠️ **It presents as a CONFLICTED merge rather than a silent one, which is the only mercy.**
> **Somebody resolving those conflicts commit by commit could produce a tree that builds and is
> badly wrong.**

✅ **Their value is DOCUMENTS. Those travel as FILE COPIES, never as a branch merge:**

```bash
git checkout claude/Wardquestions -- <path>
git checkout claude/Ward-design   -- <path>
```

---

## 3. ✅ FILES TO COPY FROM `claude/Wardquestions` — 17

**13 that do not exist on the main line at all:**

```
docs/ward-flow-safety-checklist.md          <- the largest, sections A..AF
docs/ward-flow-task-ledger.md               <- the plan of record
docs/ward-flow-open-questions.md            <- every owner decision, with answers
docs/ward-flow-orchestrator-handover.md     <- "if the orchestrator dies, start here"
docs/ward-flow-orchestrator.md
docs/ward-flow-custody.md
docs/ward-flow-document-inventory.md
docs/ward-flow-hubs-and-patient-plan.md
docs/ward-flow-pinned-clock-handover.md
docs/ward-flow-process-review-prompt.md
docs/ward-flow-provisional-values.md
docs/ward-flow-remaining-work.md
docs/ward-flow-reporting-rule.md
docs/ward-flow-fold-manifest-2026-08-31.md  <- THIS FILE
```

> ⛔ **THE MANIFEST DID NOT LIST ITSELF.** **Caught by re-deriving the at-risk set from git rather
> than re-reading the list: 24 documents exist on exactly ONE branch, and this file was the 24th.**
> ⚠️ **Same self-reference as the docblock whose count counted itself** — **the document
> specifying what must be preserved was the one thing it omitted, and re-reading it would never have
> shown that.**

**4 that exist on both and are NEWER here:**

```
docs/ward-flow-coordination-rules.md
docs/ward-flow-master-sequence-2026-08-29.md
docs/superpowers/plans/2026-08-29-ward-flow-referral-front-door.md
docs/superpowers/plans/2026-08-29-ward-flow-truthfulness-and-demo-fixes.md
```

## 4. ✅ FILES TO COPY FROM `claude/Ward-design` — 13

⚠️ **NINE WRITTEN DESIGN SPECS THAT EXIST NOWHERE ELSE**, including the community hub and the ED
psychiatry hub — **the community hub has a written specification and no code:**

```
docs/superpowers/specs/2026-08-30-ward-flow-community-hub-design.md
docs/superpowers/specs/2026-08-30-ward-flow-ed-psychiatry-hub-design.md
docs/superpowers/specs/2026-08-30-ward-flow-coordinator-hub-design.md
docs/superpowers/specs/2026-08-30-ward-flow-capacity-design.md
docs/superpowers/specs/2026-08-30-ward-flow-header-design.md
docs/superpowers/specs/2026-08-30-ward-flow-network-diagram-design.md
docs/superpowers/specs/2026-08-30-ward-flow-transport-design.md
docs/superpowers/specs/2026-08-30-ward-flow-transport-page-design.md
docs/superpowers/specs/2026-08-30-ward-flow-ward-forms-design.md
docs/ward-flow-clinician-check-method.md
docs/ward-flow-fold-conflict-2026-08-29.md
docs/ward-flow-pinned-clock-handover.md
docs/ward-flow-ledger.md                    <- NEWER here; Ward Decisions owns it
```

## 5. ⛔ SEVEN FILES THAT MUST NOT BE COPIED — the main line's version is NEWER

⚠️ **A blind copy of all ward documents would have destroyed these. Recorded so nobody repeats the
attempt later:**

```
docs/ward-flow-clinician-check.md                mine 08-27, main line 08-29
docs/ward-flow-mission-and-refusals.md           mine 08-30 09:29, main line 08-30 12:49
docs/ward-flow-phase-6-7-decisions.md            mine 08-27, main line 08-29
docs/ward-flow-roadmap.md                        mine 08-27, main line 08-27 later
docs/ward-flow-phase-3-workspace/README.md       mine 08-23, main line 08-30
docs/superpowers/plans/2026-08-25-ward-flow-phase-4-specialist-boards.md
docs/superpowers/plans/2026-08-25-ward-flow-standalone-and-nav-repair.md
```

✅ **79 further ward documents are byte-identical on both branches. Nothing to do.**

---

## 6. ⚠️ THE REFUSED-MUTATION FINDING, WHICH TOUCHES EVIDENCE ALREADY GIVEN

> ⚠️ **A mutation whose anchor matches more than one place is REFUSED by the harness, and the test
> run then passes for no reason at all.** **A refused mutation is a NON-RUN, never a pass.**

⛔ **The mutation harness became the thing it exists to catch** — an absence reading as a pass, in
the one instrument whose whole job is proving a check can fail.

**Ward Board hit the adjacent form twice: an anchor matching NOTHING aborted before writing, and the
run then reported "passed 2, failed 0" — a green describing an unmutated file.**

✅ **The check is to grep the file, never to read the run.**

**Status of each claim, stated at its real strength:**

- ✅ **Ward Verifier's two:** application proved BEFORE the run (`real key lines: 0, mutant: 1`),
  and the finding pulled from the report's assertion text rather than the exit code. **Sound.**
- ✅ **Ward Referrals' four — RESOLVED, and by a test that settles the whole class:** **a refused
  mutation produces a refusal and then a passing run. IT CANNOT QUOTE THE ASSERTION IT BROKE.** All
  five transport mutations were reported with distinct quoted failures — `expect(element).not
  .toBeChecked()`, `expected 'Ambulance service' to be ''`, and three separate `aria-disabled`
  misses. **A script that never applied cannot produce those.** The one that WAS refused was
  reported as refused and re-run.
  ⚠️ **Ward Referrals raised this alarm and then withdrew it on evidence it already held** — **the
  alarming false negative, which is the costliest shape: it nearly sent Ward Verifier to re-audit
  four sound proofs.**
- ⚠️ **Ward Board's:** confirmed applied by grepping the file; **not re-audited** under this
  finding, and reported as such.

---

## 7. ✅ ORDER OF OPERATIONS

1. Every chat commits and confirms clean. ✅ Ward Board, Ward Verifier confirmed. Ward Referrals on
   the urgency commit.
2. ✅ **Backup before the first merge** — `bash ~/.claude/scripts/backup-work.sh`. Retention is now
   20 runs, raised from 3 with the owner's approval.
3. Ward Core merges: Ward Referrals, then `print-fixes`, then `setup-967aa0-wf`.
4. Delete `tests/zz-clock-probe.test.ts`.
5. Copy the 30 documents (17 + 13) by `git checkout <branch> -- <path>`. **Verify by hash.**
6. Smallest gate covering the union of what landed — **not a full sweep by reflex.**
7. Backup again.

⚠️ **NOT IN THIS FOLD, and deliberately: the community hub.** ✅ **The owner has approved it twice
and confirmed it is next — but he called the pause first, and its design spec is one of the files
being copied in at step 5.**

---

## 8. ✅ ALL FOUR CHATS ARE PARKED — the fold may proceed

```
Ward Referrals  6f10f1dda  urgency tier on every ED card   +1   clean, nothing in flight
Ward Board      68e501e5f                                  +6   clean, merge-tree CLEAN
Ward Verifier   8f5c4490c                                  +11  clean, merge-tree CLEAN
Ward Core       caacf1eda  performs the merges
```

✅ **`6f10f1dda` verified by me in the committed blob, against every boundary the owner set:**

```
DEFAULT_DRAFT.urgency        does not appear in the diff at all
shortlist-panel.tsx          not in the commit
urgencyTierLabel(movement.urgency)   rendered, 2 sites
per-tier colour              NONE
3 files: ed-screen.tsx, ed.module.css, ward-ed-screen.dom.test.tsx
```

⚠️ **My colour grep matched ONE line and it was the PROHIBITION, not a violation** — a CSS comment
reading *"Do not add `[data-tier]` styling here without a ruling that says so"*, with the reason:
**the words carry the direction and survive greyscale, forced-colors and a colour-blind reader
unchanged.** ✅ **The pattern matched the text forbidding the thing. Same family as a check counting
a term inside its own retraction.**

### ⚠️ THREE THINGS FLAGGED BY WARD REFERRALS, none blocking

1. **"Beside the stage" half-survived contact.** An outbox row has a stage element; **a patient card
   has none** — the nearest line is *"Accepted at X" / "Referred to N units"*, and the tier sits
   there. ✅ **Documented, and a one-line move if the owner meant the card header.**
2. **The psychiatry inbox rows got NO tier** — they are referrals, not this department's patients,
   and carry no stage to sit beside. ✅ **Judgement, flagged rather than assumed.**
3. ⛔ **SESSIONS SHARE `/tmp/wf-commit-msg.txt`.** **A commit here picked up ANOTHER chat's leftover
   message from 00:12** — content correct, message somebody else's. Fixed by soft reset and a
   uniquely named file. ⚠️ **A silent cross-session collision on a path nobody thinks of as
   shared. Every session must use a uniquely named message file.**

### ⚠️ AND A MUTATION THAT SURVIVED, CAUGHT BY THE PERSON RUNNING IT

**Hiding the tier on tier-3 outbox rows changed nothing** — **no tier-3 patient sits in that outbox
today.** ✅ **The implementer reported the survival rather than accepting the green, drove a patient
there through the real controls, and only then did it fail as predicted.**

> ⚠️ **The silent-fixture class, inside a mutation — the tool that proves a check can fail,
> failing to prove it, because the data never produced the case.**
