# Ward Builder Three — report, 2026-09-02

**Branch `claude/ward-builder-three`, HEAD `97a090ed8`, tree clean.** 25 commits ahead of
`codex/task-ward-flow-live-state-20260831`, **19 behind it**. Merge-base `f2abfba77`.

⚠️ **A correction to `now.md` before anything else, because it under-counts me and the difference is
load-bearing.** That file says _"24 commits … 56 DOM tests and 89 `.ts` tests, 129 checks that cannot
fail."_ Measured at HEAD: **25 commits**, and the `.ts` sweep is **90 files and 131 findings**, not 89
and 129. **The 89 was a real defect of mine, found and closed after that row was written** — I swept
my own branch, which had one file fewer than the integration line. `now.md` is quoting my
pre-correction number.

⚠️ **I did NOT lose my session.** `now.md` addresses a restart in which all five chats remember
nothing; my context is intact. **I have nonetheless re-derived everything below from git rather than
from memory**, because that is the right standard either way and because a session that believes it
remembers correctly is exactly the one that should not be trusted on it. Where I could not re-derive
something, it is in §5.

---

## 1. Finished — by commit

**Seven files changed, all mine, none shared with another chat:**
`docs/ward-flow/control/now.md` (my own row only) · `wf-build3-004-dom-test-sweep.md` ·
`wf-build3-005-ts-test-sweep.md` · `tests/production-dynamic-route-reachability.test.ts` ·
`tests/ui-ward-roles.spec.ts` · `tests/ward-nav.test.ts` · `tests/ward-traps-numbering.test.ts`

### Guards built or repaired

| Commit      | What                                                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cdaaa7e88` | **`production-dynamic-route-reachability.test.ts`** — 16 production dynamic routes had no reachability coverage while the mockup tree had a strong one. ⚠️ Its own message records that my first draft could not fail.                                                               |
| `9edcfb1ac` | **The comment stripper I had called load-bearing was deleting live code.** Block-comment regex ran before the line regex, so a `//` line merely containing a block opener swallowed everything to the next closer. **1,897 characters of live JSX destroyed in one file, measured.** |
| `ac1e10a17` | **The shadowing rule was right about renders and wrong about redirects.** A static sibling that _redirects_ into its dynamic neighbour is evidence the route is reached, not evidence against — it was accusing working code.                                                        |
| `6ce0af276` | **`ward-nav.test.ts`** — its failure message could not distinguish _never registered_ from _literal removed_. Both branches constructed and their outputs pasted.                                                                                                                    |
| `22d92e318` | **`ward-traps-numbering.test.ts`** — two scope defects. The prose-total regex had no `/g` so nothing compared the copies; the entry regex saw only `## <n>. ` so an entry at `###` depth was invisible.                                                                              |
| `ed701752d` | **Four of Ward Verifier's five attacks on my own reachability guard.** Live defect: the extractor truncated at a nested backtick and was silently discarding a real link to `/documents/[id]`. Also both ED journeys repaired.                                                       |

### Sweeps

| Commit                    | What                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `de387bd1d`               | **All 56 `ward-*.dom.test.tsx` read in full — 61 findings**, 35 files with findings, 21 clean. **271 lines.**                                                          |
| `973a67f20` … `908611ac8` | **All 90 `ward-*.test.ts` at the integration line read in full**, 32,824 lines, **131 findings**, 71 files with findings, 18 clean. **1,791 lines.** Fourteen readers. |

### Corrections I made to my own work, each carried upward

| Commit      | Retraction                                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `7a4ff4837` | I said the coordinator projection had no field-set allowlist. **`tsc` holds it (`TS2741`).** True of the test suite, false of the repository.                                                             |
| `d79f10cbd` | **129 tests that cannot fail is not 129 unguarded properties.** A test whose title claims a property its assertions cannot distinguish is not the same as an unguarded property, and the remedies differ. |
| `e5e6c5d9e` | **Two of my three headline findings were mis-attributed.** The FD-23 "three guards all miss it" headline was **false**.                                                                                   |
| `97a090ed8` | **Both sweeps carry stale findings, and the DOM one lost 53 of its 61.**                                                                                                                                  |

### The one finding of mine that survived and landed

`sex_designation` was absent from `eligibility()` on the movement path while present on the referral
path, so a Male-only ward was returned eligible for a female movement. **It is on the master line
now** (`now.md` §1 records it, and the forensic gate beside it). **It is the only one of my three
headline findings that stood, and it is the only one I personally verified before sending.**

---

## 2. Half-done, and in what state

**WF-BUILD3-006 — mutation triage of my remaining 126 findings. NOT STARTED.**
Ledger and pre-flight scan exist at `.superpowers/sdd/wf-build3-006-triage/progress.md` (git-ignored,
**so it will not survive a clean and is not in any commit**). Read-only prep is complete for 32 files
across two slices and named six candidate guards. **No mutation has been run for any of the 126.**

**The two ED journeys — FIXED AT `ed701752d`, NEVER RE-RUN.** Both failed their first ever run: one
used a test id missing its `inbox-` segment, one clicked an `aria-disabled` button which Playwright
refuses, so it timed out at 45 s rather than failing. **I was told not to run Playwright, so their
current state is unknown.**

**`.superpowers/sdd/…` is git-ignored scratch.** Every ruling in it — nine of them — exists only on
this disk.

---

## 3. Questions for the owner

1. ⚠️ **Should a bed coordinator see a patient's suburb?** `coordinatorScopedReferral` documents
   itself _"never filtered — the coordinator may see everything"_ and is implemented as a
   hand-written eleven-field list that omits `suburb`. **The field is in neither projection's type,
   so no gate can catch it** — unlike the sibling issue, which `tsc` holds. Ward Builder Two agrees
   the contradiction is real and that the resolution is not an implementer's.
2. **Is a count without its findings worth keeping?** My DOM sweep records 61 findings and writes out 8. **53 have no individual record anywhere.** I have marked the document accordingly. **Should it
   be re-run to recover them, or retired?**
3. **How should CLOSED-ALREADY be counted?** One of my findings was already fixed the day before I
   raised it. The analysis reproduced and the defect was real. Ward Builder One argues that is not a
   false positive. **I agree, but the hit rate depends on the answer.**
4. **Do you want the 131 findings triaged at all, given the bias in §5?** They are systematically
   skewed toward mis-attribution.
5. **Small:** `tests/scratch_debug_elig.test.ts` sits on the **master line**, added by `b02751cc4`.
   It is not mine and its name reads as scratch. **Is it meant to be there?**

---

## 4. What I was blocked on

- **Playwright**, twice: once behind a 15-minute admission wait, and now by instruction. **Each
  invocation rebuilds production (~117 s).**
- **The heavy lock**, which is why every mutation agent was ruled strictly serial against an
  instruction to parallelise. Two agents mutating one checkout cannot attribute a red.
- ⚠️ **My own documents were unreachable to the chats assigned to triage them.** Both sweep files
  exist **only on this branch**, which never merges. Two chats were allocated work against a document
  they could not open, and each reasonably reported it did not exist. `git show
claude/ward-builder-three:docs/ward-flow/wf-build3-005-ts-test-sweep.md` reaches it. **This is the
  trap at the top of the ownership file and I am its third instance.**
- **A protection hook blocked three of my commands** (`mv`, `rm`, and a heredoc containing the word
  it guards). **I did not bypass any of them** — I used redirects and the Write tool instead.

---

## 5. ⚠️ Believed but NOT re-checked since restarting

**This is the section I would read first.**

**Everything below was true when observed and none of it has been re-derived at the current tip.**

- **All test-run results.** `production-dynamic-route-reachability.test.ts` at **11 passed**,
  `ward-traps-numbering.test.ts` at **5 passed** — both observed before `97a090ed8` and before the
  master line moved 19 commits. **Not re-run.**
- **Every mutation result**, including the four on my reachability guard and the two on the numbering
  guard. Observed on an older tree. ⚠️ **One of them — emptying the exception map — was
  INCONCLUSIVE at the time** (it broke the file's parse, so vitest reported "no tests"). **That
  assertion has never been proved and I am not claiming it.**
- **The measurements that decided a design:** correct-vs-broken stripper discrimination of `0.0009`
  on hrefs and `0.00025` on characters, 5 order-sensitive files of 1,283, worst legitimate per-file
  loss 93.4% against worst damaged 60.7%. **Computed at an older tree, not since.**
- ⚠️ **At least one of my findings is now certainly stale on a number.** My sweep records
  `ward-scenarios.test.ts` pinning **43 open movements and 353 eligible pairs**. `now.md` says the
  seeded totals moved to **340→325 standard and 102→87 scarce** from the gates that landed. **Those
  are different quantities and I have not reconciled them.** Anything of mine citing a seeded total
  should be re-measured, not adjusted.
- **The staleness figures themselves** — 4 of 90 `.ts` files and 6 of 56 DOM files changed since
  their sweeps, plus 5 `ward-management` source files. **Measured at `97a090ed8` against the sweep
  commits; the master line has moved since.**
- ⚠️ **THE STRUCTURAL BIAS, which I believe and which nobody has tested.** Every candidate guard
  found so far — six of six — sits in a `.dom.test.tsx` or a `ui-*.spec.ts`. **The `.ts` sweep read
  neither family.** I infer its 131 findings are systematically biased toward mis-attribution. **That
  inference rests on six instances and my own two retractions. It is the most consequential thing I
  believe and the least tested.**
- **Anything I have said about another chat's work**, including that a fix of mine landed on the
  master line and that another chat closed the units-only privacy finding. **Read from their
  messages, not from their branches.**
- **That my own three headline findings triaged 2 wrong of 3.** That ratio came from one triage pass
  by one reader. **It is the number I have been quoting to everyone and it has a sample size of
  three.**

---

# REVIEW — twelve hours, re-derived at `d79dffe3c` on 2026-09-02

**Requested by the owner. Everything below is measured at this tip, not recalled.** Where a claim
could not be re-derived it is marked.

## What the twelve hours produced, measured

```
14 commits (non-merge) between 23:18 and 10:41
8 files, +3,136 lines, -6 lines
```

| File                                            | Lines             |
| ----------------------------------------------- | ----------------- |
| `wf-build3-005-ts-test-sweep.md`                | 1,791             |
| `production-dynamic-route-reachability.test.ts` | 649               |
| `wf-build3-004-dom-test-sweep.md`               | 271               |
| this report                                     | 151               |
| `ui-ward-roles.spec.ts`                         | +130              |
| `ward-traps-numbering.test.ts`                  | +73               |
| `control/now.md`                                | +50 (my row only) |
| `ward-nav.test.ts`                              | +27               |

**Fresh evidence, run at review time:** the three test files I own —
`npx vitest run` → **`Test Files 3 passed (3) · Tests 73 passed (73)`, real exit 0.**
⚠️ **Against MY tree, which is 21 commits behind the integration line.** Not evidence about the
integration line.

## ✅ One finding re-checked at the integration line — CONFIRMED LIVE, AND WORSE THAN I REPORTED

My sweep flagged doc drift in `ward-scenarios.test.ts`. **I re-read it on the master line rather than
trusting my own note.** Measured there:

```
line  27  prose      "41 open movements, 342 eligible movement/unit pairs"
line 115  assertion  { openMovements: 43, eligiblePairs: 325, strandedMovements: 2 }
line 132  message    "openMovements must match the standard night's 41 exactly"
line  54  history    "340 pairs (was 353)"
line  81  history    "325 pairs (was 340)"
```

**The finding is live and the drift has WIDENED, not closed.** The pinned figure has been corrected
three times — 353 → 340 → 325 — and **the header prose and the failure message were left at 41 and
342 through all three.** The file's own comment instructs a reader to _"re-measure rather than adjust
a number"_, and the number that never got re-measured is the one inside that instruction.

⚠️ **And my own report of it was stale in exactly the way I warned about.** I wrote _"pinning 43 and
353"_; it is now 325. **The finding survived; my quoted figure did not.** That is the first of my 131
to be re-checked against the current tip, and the score is: property right, number wrong.

---

# EVERY ISSUE, INCLUDING THE ONES I CAUSED

## A. Defects in my own delivered work

1. ⚠️ **The DOM sweep lost 53 of its 61 findings.** It details 8 and summarises the rest
   thematically. **Those 53 exist nowhere** — not in the document, not in reader reports that died
   with their sessions. `de387bd1d`, marked at `97a090ed8`. **A count that cannot be checked,
   triaged, or compared is the only thing that document was for.**
2. ⚠️ **Both sweeps read files that have since changed.** 4 of 90 `.ts`, 6 of 56 DOM, **plus 5
   `ward-management` source files** — and every falsifier names a source file, often by line. **My
   first staleness check asked the wrong question** (branch-vs-branch now, instead of
   sweep-commit-vs-now) and missed this entirely.
3. ⚠️ **Two of my three headline findings were wrong, in the direction of alarm.** The FD-23 "three
   independent guards all miss it" headline was **false** — a live-dispatch membership assertion
   catches it. The bed-grid one is caught by a DOM test. **Only `sexDesignation` stood, and it is the
   only one I personally verified before sending.**
4. **One assertion I shipped is UNPROVEN.** The moved arity guard in the reachability test: my
   mutation broke the file's parse, vitest reported "no tests", **which proves nothing.** Never
   re-attempted.
5. **My first draft of the reachability guard could not fail** (`cdaaa7e88`'s own message says so),
   and **a comment stripper I had called load-bearing was deleting 1,897 characters of live code**
   (`9edcfb1ac`). Both found by others, not by me.

## B. Things I got wrong twice, having already written the lesson down

6. ⚠️ **I read an exit code from a piped command.** The Playwright wrapper printed
   `[exited with code 0]` beside `2 failed` because I piped through `tail`. **I hold a memory entry
   about exactly this.**
7. ⚠️ **I relayed a subagent's finding without opening the file myself**, then wrote a memory entry
   about not doing that — and **did it again within the hour** on the bed-grid guard. Ward Verifier
   caught it.

## C. Unfinished

8. **WF-BUILD3-006 — 126 findings untriaged. No mutation run for any of them.** Prep is complete for
   32 files; six candidate guards named.
9. ⚠️ **The 131 findings are structurally biased toward mis-attribution.** Every candidate guard
   found so far — six of six — sits in a `.dom.test.tsx` or a `ui-*.spec.ts`, **and the `.ts` sweep
   read neither family.** This is the most consequential thing I believe and it rests on six
   instances plus my own two retractions.
10. **Two ED browser journeys fixed at `ed701752d` and NEVER RE-RUN.** Both failed their first run;
    both fixes are unverified.
11. **The SDD ledger is git-ignored.** Nine rulings exist only on this disk and will not survive a
    clean.

## D. Coordination

12. ⚠️ **Both my sweep documents exist only on this branch, which never merges.** Two chats were
    assigned triage against a document they could not open, and each reported it did not exist.
    **They were right.** `git show claude/ward-builder-three:<path>` reaches it. **This is the trap
    at the top of the ownership file and I am its third instance.**
13. **I am 21 commits behind the integration line.** My test evidence is about my tree only.
14. **`now.md` under-counts me** — it says 24 commits and 89 files/129 findings; measured, 26 and
    90/131. It is quoting my own pre-correction number.

## E. Not mine, found in passing

15. **`tests/scratch_debug_elig.test.ts` sits on the master line**, added by `b02751cc4`. Its name
    reads as scratch. **Flagged, not touched.**

---

## What I would want decided

**The `suburb` question** — should a bed coordinator see a patient's suburb? No gate can catch it;
the field is in neither projection's type. **The DOM sweep** — recover its 53 lost findings, or
retire the document? **And whether the 131 are worth triaging at all**, given issue 9.

---

# OVERNIGHT CONSOLIDATION — measured at `d866c121e`, 2026-09-02

**Identity from git, not memory:** `git rev-parse --abbrev-ref HEAD` → `claude/ward-builder-three`.
**Ward Builder Three.**

⚠️ **My own earlier report in this file is now stale and I am not deleting it.** It says HEAD
`97a090ed8`, 25 commits, 19 behind. Measured now: HEAD `d866c121e`, **27 commits (22 non-merge), 21
behind**. Left in place because a superseded measurement with its commit named is evidence; a
silently-corrected one is not.

**Reports read before writing this — all three that exist**, each from its own branch:
`claude/ward-builder-community-route` (One), `claude/ward-builder-two` (Two), and my own.
**Ward Lead has written none** — `git ls-tree` on the master line's `docs/ward-flow/reports/` returns
empty.

## 1. FINISHED — by commit

| Commit                    | What                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cdaaa7e88`               | `production-dynamic-route-reachability.test.ts` — 16 production dynamic routes had no reachability check. Its own message records that my first draft could not fail. |
| `9edcfb1ac`               | The comment stripper I had called load-bearing was **deleting 1,897 characters of live JSX**, measured. Block regex ran before the line regex.                        |
| `ac1e10a17`               | The shadowing rule was right about renders and wrong about redirects — it was accusing working code.                                                                  |
| `9af65681f`               | Two ED browser journeys over the psychiatry inbox. Committed **UNRUN**.                                                                                               |
| `6ce0af276`               | `ward-nav.test.ts` failure message split — _never registered_ vs _literal removed_.                                                                                   |
| `de387bd1d`               | **All 56 `ward-*.dom.test.tsx` read in full — 61 findings.**                                                                                                          |
| `973a67f20` → `908611ac8` | **All 90 `ward-*.test.ts` read in full — 131 findings**, 32,824 lines, fourteen readers.                                                                              |
| `7a4ff4837`               | Retraction: the coordinator field set **is** guarded, by `tsc`.                                                                                                       |
| `d79f10cbd`               | Retraction: 129 tests that cannot fail is **not** 129 unguarded properties.                                                                                           |
| `e5e6c5d9e`               | Retraction: **two of my three headline findings were mis-attributed.**                                                                                                |
| `22d92e318`               | Traps numbering guard — two scope defects, both mutation-proved.                                                                                                      |
| `ed701752d`               | Four of Ward Verifier's five attacks on my own guard. Live defect: the extractor truncated at a nested backtick and discarded a real link to `/documents/[id]`.       |
| `97a090ed8`               | **The DOM sweep lost 53 of its 61 findings**; both sweeps read files that have since changed.                                                                         |
| `d79dffe3c`, `d866c121e`  | Restart report and twelve-hour review.                                                                                                                                |

**The one finding of mine that landed:** `sex_designation` absent from `eligibility()` on the movement
path. ⚠️ **Ward Builder Two's appendix corrects the citation I would have given:** the commit is
**`6cc80c774`**, not `f2abfba77` — the latter is its descendant. **Two is right and I adopt its
citation.**

## 2. HALF-DONE

- **WF-BUILD3-006 — 126 findings untriaged. No mutation run for any of them.** Prep complete for 32
  files; six candidate guards named. Ledger at `.superpowers/sdd/wf-build3-006-triage/progress.md` is
  **git-ignored — nine rulings exist only on this disk.**
- **Two ED journeys fixed at `ed701752d`, NEVER RE-RUN.** Playwright forbidden by instruction.
- ⚠️ **Scratch branch `trial-merge-1122` still exists.** The protection hook refused to discard it and
  **I did not bypass the hook.** A second, `trial-merge-0339`, is present and is **not mine** — left
  untouched.

## 3. MERGE VERDICT

**(a) Conflicts — measured, not assumed.**

```
git merge-tree --write-tree <master> HEAD   exit 0,  CONFLICT lines: 0
behind: 21     ahead: 27
```

**(b) Every pin, by name.**

| Pin                                                                           | Verdict                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The 16-route `dynamicRoutes` list, pinned exactly                             | **CHECKED-CLEAR.** Master line has exactly those 16.                                                                                                                                                                                                  |
| `/dictionary/topics` exists and RENDERS (shadowing fixture)                   | **CHECKED-CLEAR.** Page exists.                                                                                                                                                                                                                       |
| `/documents/source` exists and REDIRECTS (voucher fixture)                    | **CHECKED-CLEAR.** 4 `redirect` hits.                                                                                                                                                                                                                 |
| `LINKED_BUT_INVISIBLE_TO_THIS_SCAN.size` = 2                                  | **CHECKED-CLEAR** — survived the trial merge.                                                                                                                                                                                                         |
| Traps-file entry count + prose word                                           | **CHECKED-CLEAR.** Master line has **21** headings and prose **"twenty-one"**; they agree, and `NUMBER_WORDS` carries that key. My branch has 20/"twenty" — both handled.                                                                             |
| No misshapen numbered heading in the traps file                               | **CHECKED-CLEAR.** Zero on the master line.                                                                                                                                                                                                           |
| Floors: `scannedFiles > 900`, `renderingStaticRoutes > 20`, `extracted > 200` | **CHECKED-CLEAR** — floors, and all far exceeded.                                                                                                                                                                                                     |
| Ten `ward-ed-inbox-*` / `ward-ed-screen` testids (Playwright)                 | **CHECKED-CLEAR by presence** — all ten present on the master line, control 54 testids in that file. ⚠️ **Presence is not behaviour and I could not run Playwright.**                                                                                 |
| **`ward-index-link` in `ward-nav.test.ts`**                                   | ⚠️ **WAS AT-RISK, NOW CHECKED-CLEAR.** `now.md` says that id no longer resolves; the master line emits `ward-index-link-${unit.id}`. My branch's copy carried an exact-match. **The trial merge took the master line's version and the file passes.** |
| Eligibility totals 340→325 / 102→87                                           | **CHECKED-CLEAR — I pin none of them.** Grep over my four files: no hits.                                                                                                                                                                             |

**(c) Behaviour, on a scratch branch.**

```
git switch -c trial-merge-1122 ; git merge --no-edit <master>   → exit 0, clean
npx vitest run <my three test files>
  Test Files  3 passed (3)        ← 3 of 3 expected, discovery complete
  Tests      75 passed (75)       ← RAN 75
  REAL EXIT: 0
```

⚠️ **75 RAN on the merged tree against 73 on my branch — discovery found MORE, not fewer**, which is
the safe direction. **`tests/ui-ward-roles.spec.ts` is UNVERIFIED — could not run**, Playwright
forbidden.

### **VERDICT: SAFE-WITH-CAVEATS.**

Zero conflicts, every pin checked by name, and all three of my runnable test files pass on the merged
tree with a higher RAN count than before — **but my two Playwright journeys have never once passed
and remain unverified, so "safe" covers the unit surface only.**

## 4. QUESTIONS FOR THE OWNER

1. ⚠️ **Should a bed coordinator see a patient's suburb?** In neither projection's type, so **no gate
   can catch it.** Ward Builder Two asks the same question independently (its §3.2).
2. **The DOM sweep lost 53 of 61 findings — re-run it, or retire it?**
3. **How is CLOSED-ALREADY counted?** One finding of mine was fixed the day before I raised it.
4. **Are the 131 worth triaging at all**, given §7's corroborated bias?
5. **Small:** `tests/scratch_debug_elig.test.ts` is on the master line (`b02751cc4`) and reads as
   scratch. Still there after the trial merge.
6. **Small:** two `trial-merge-*` branches exist and the hook refuses to discard them. **Approve
   clearing them, or leave them?**

## 5. BLOCKED ON

- **Playwright** — by instruction. Two journeys unverified.
- **Ward Lead** — no reply to any of five questions. ⚠️ **The merged `now.md` explains why: the
  previous Ward Lead could not receive a message in either direction for its entire life.**
- **Merging** — 21 behind; forbidden by instruction, and I am not the merger.
- **The protection hook** refused four of my commands. **I bypassed none of them.**

## 6. BELIEVED BUT NOT RE-CHECKED

- **All four mutation results on my reachability guard**, and both on the numbering guard — measured
  **at `ed701752d` and `22d92e318`**, on a tree 21 commits behind. Not re-run.
- ⚠️ **One of those was INCONCLUSIVE and remains so.** Emptying the exception map broke the file's
  parse and vitest reported "no tests". **That assertion has never been proved.** Measured at
  `ed701752d`.
- **The measurements that decided a design** — stripper discrimination `0.0009` on hrefs, `0.00025`
  on characters, 5 order-sensitive files of 1,283, worst legitimate per-file loss 93.4% against worst
  damaged 60.7%. **All at `ed701752d`.**
- **The staleness figures** (4 of 90 `.ts`, 6 of 56 DOM, 5 source files) — **at `97a090ed8`.**
- **The 61 DOM findings themselves** — 53 have no record, so most cannot be re-checked at all.

## 7. CONTRADICTIONS

**7.1 — Ward Builder Two's §4.3: _"the channel between chats is accepting messages and dropping them,
in both directions."_ I believe this is WRONG, and so does the master line.**
The merged `now.md` states it plainly under _"Three things the previous Ward Lead got wrong"_:
**"Messaging is broken in both directions. False as stated — it was broken for that one chat."**
Ward Builder One says the same with evidence. **I corroborate independently: I exchanged substantive
messages with Ward Verifier, Ward Builder One and Ward Builder Two tonight and each was plainly acted
on** — Two ran a mutation I described and returned its output; One restructured my sweep document's
front matter around a distinction it sent me. **What failed was one chat's inbound channel, not the
mechanism.** ⚠️ **Diagnosing it as general explains away the difference that matters** — and this
instruction's own premise inherits the wrong diagnosis.

**7.2 — Ward Builder Two's Correction 1 is right about its branch and must NOT be generalised to
mine.** It voids its staleness measure because `b5205b45a` is not an ancestor of its HEAD.
**Verified: `git merge-base --is-ancestor b5205b45a HEAD` returns YES on my branch** — it is my own
merge commit. **My staleness figures are diffs along a line of history and stand.**

**7.3 — `now.md` under-counts me, and it is quoting my own retracted number.** It says _24 commits …
89 `.ts` tests, 129 checks_. Measured: **27 commits, 90 files, 131 findings.** The 89/129 was my
error, found and corrected at `908611ac8`.

**7.4 — Ward Builder One's _"roughly half of the 131 are not work"_ is directionally right and rests
on a very small sample, as does mine.** One cites 5 of 10 triaged. **Mine was 2 of 3.** Ward Builder
Two's appendix adds 5 of 24 named as not-gaps. ⚠️ **Three chats are quoting hit rates from samples of
3, 10 and 24, and the headline number gets repeated without the denominator.** I have done this
myself.

**7.5 — NOT a contradiction, and the strongest corroboration of the night.** Ward Builder Two
independently found that finding **7.3** in my sweep is **guarded twice — by a DOM test and a
Playwright journey, in file families the sweep never read** — and warns that anyone treating it as a
live safety gap acts on a false premise. **That is exactly the structural bias I claimed, confirmed
by a chat that reached it from the other direction.** ⚠️ **And its methodological point sharpens
mine: _"a sibling test exists" is not coverage._ Two of its findings turned up a second test that
looked like a mitigation and was defeated by the same falsifier for an independent structural
reason.** My six candidate guards were found by static search and **none has been mutation-tested.**

---

# CORRECTIONS — 2026-09-02, after the fold. Measured at master `268fcd6a8`.

⚠️ **THE FOLD HAS HAPPENED. EVERY POSITION NUMBER ABOVE THIS LINE IS HISTORY.** Reported by Ward
Verifier and verified by me rather than taken on trust:

```
master tip                                        268fcd6a8
git merge-base --is-ancestor ed701752d <master>   YES — my work is folded in
my position now                                   1 ahead, 58 behind
my one unmerged commit                            1feac9452 — my own report file
```

**My merge verdict above (SAFE-WITH-CAVEATS, 21 behind / 27 ahead) was true when written and is not
now.** It is left in place with its commit named, because a superseded measurement that says when it
was taken is evidence.

## Correction 1 — ⚠️ my §1 claim "all mine, none shared with another chat" is WRONG

**`tests/ward-nav.test.ts` was shared.** Master's `3d0429946` — _"give each ward-index link its own
testid"_ — changed it **+42/−4** while I changed it, and:

```
git merge-base --is-ancestor 3d0429946 d866c121e   →  NO
```

**So at the moment I wrote that sentence the file had a second author whose changes I did not have.**
Found by Ward Verifier. **My "none shared" was a claim I never checked** — the ownership table gave me
that file's owner and I read the table instead of the history.

## Correction 2 — ⚠️ my own report contradicts itself on my own commit count

Three figures, all presented as measured:

```
line   8   "Measured at HEAD: 25 commits"        (at 97a090ed8)
line 259   "measured, 26 and 90/131"             (no ref given)
line 283   "27 commits (22 non-merge)"           (at d866c121e)
```

**Lines 8 and 283 are two honest measurements at two different commits, each labelled.** ⚠️ **Line
259 is simply wrong** — it names no ref and matches neither. **The correct figure at `d866c121e` is
27 total / 22 non-merge**, which Ward Verifier measured independently and got the same. **Line 259
should read 27.**

**The lesson is Ward Verifier's and it is better than the correction:** _state a position as a tip SHA
plus a timestamp, never as a bare number; a count is a claim about a moment._ **Every position figure
in all three builder reports went stale within hours, mine included.**

## ⚠️ Correction 3 — A NEW INSTANCE OF MY OWN §7 BIAS, IN MY OWN CODE, THAT I MISSED

My merge verdict recorded `ward-index-link` as **WAS AT-RISK, NOW CHECKED-CLEAR** and stopped there.
**Ward Verifier went one step further and found the part that matters.**

Before the fold, `wardHrefsIn` (:919) **and** `linkCountIn` (:928) both keyed on the retired bare
literal. Verifier tested both empirically rather than reasoning about them:

```
against the OLD markup:     wardHrefsIn = ["wi-alpha"]   linkCountIn = 1
against MASTER's markup:    wardHrefsIn = []             linkCountIn = 0
cross-check expect(linkCountIn(markup)).toBe(linked.length)   →  0 === 0, PASSES
```

⚠️ **The companion cross-check exists precisely so that "a pattern that silently stopped matching
anchors reads as a mismatch rather than as a shorter list" — my own comment says so — and it is void
against any change to the literal itself, because BOTH HALVES KEY ON THE SAME STRING.**

**That is exactly the shape my §7 describes: two checks that look independent, sharing one blind
spot.** I wrote that section and then failed to apply it to the file in front of me. **The block was
saved only by the separate non-vacuity floor two lines above**, which does fire — a different guard,
for a different reason, which is the coincidence-not-a-guard shape again.

**The fold resolved it correctly:** master carries the prefix form at :926 and :937, my helper names
survived with master's corrected regexes. **Measured by Verifier: 0 bare-form live locators, 6
prefix-form hits, control token 0 — so the zero means something.**

## Correction 4 — the hit-rate spread, now aggregated across three chats

Ward Builder One aggregated what I raised as a denominator complaint:

```
Ward Builder One     5 of 10    50%
Ward Builder Three   2 of 3     67%
Ward Builder Two     5 of 24    21%
                    12 of 37    32%
```

⚠️ **21% to 67%, three samples, none randomly drawn** — each chat triaged what it happened to own or
headline. **The direction is corroborated three ways; the magnitude is not established.**

**One has corrected its recommendation to the owner accordingly**, and its reformulation is the right
one: _triage before allocating, because a meaningful fraction are not gaps — not because half are._
**The first survives being wrong about the rate. The second does not.**

## Correction 5 — Ward Verifier retracts the messaging claim it helped spread

**It says so itself:** its wording verdict on `e8a5bdd06` reached Ward Builder Two and became commit
`5c1dc6080`, which credits it by name. **So messages demonstrably flowed.** The gap was
one-directional and specific to Ward Lead.

⚠️ **Ward Builder One's version is narrower than mine and is the more defensible one:** what it had
was _"my sends returned success and were acted on, and I have had no reply from Ward Lead
specifically"_ — **not** "messaging works". **The general claim would have been as unfounded as its
opposite.** I have adopted its framing.

## An answer to one of my open questions, from Ward Builder One

**On the DOM sweep's 53 lost findings: retire and re-run, not recover.** Its reasoning, which I
accept: _a finding whose individual record is gone cannot be triaged, and a thematic summary is
exactly the artefact that reads as coverage without being it._ **That is my own DOM-sweep discipline
applied to the DOM sweep**, and I would rather have it turned on me than not.

## ⚠️ Standing hazard for anyone sweeping branches

**Four `trial-merge-*` branches exist and `trial-merge-1130` is CHECKED OUT in the master-line
worktree**, holding a merge of my branch. **Do not sweep them.** Ward Builder One additionally reports
that **the protection hook's documented override for branch removal does not work** — refused both as
a prefix and as an export. **Mine (`trial-merge-1122`) is still present for that reason and I did not
bypass the hook.**

---

# ⚠️ CORRECTION 6 — THE 32% AGGREGATE IS MOSTLY REASONED, NOT OBSERVED

**Ward Builder Two disclosed this about its own contribution and it changes what the pooled number
means.** Recorded here because Ward Builder One took that number to the owner as the basis for a
decision about whether to allocate 131 findings.

| Contributor             | Sample       | Method                                                                                                                                                                           |
| ----------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ward Builder One        | **5 of 10**  | ⚠️ **OBSERVED** — mutations run, files that went red recorded, coincidental collateral separated from real guards                                                                |
| Ward Builder Two        | 5 of 24      | **REASONED** — code read at HEAD and execution paths traced. **"Not one of the 24 has had a mutation run against it."**                                                          |
| Ward Builder Three (me) | 2 of 3       | **MIXED** — one arithmetic check of my own, one guard confirmed by a sibling test's existence, one production gap confirmed by reading. **No mutation run on any of the three.** |
| **Pooled**              | **12 of 37** | **10 observed, 27 reasoned**                                                                                                                                                     |

⚠️ **So roughly three-quarters of the pooled sample is reasoning, and the whole programme's standard
is that reasoning about a guard is exactly what a mutation is for.** Two states it against itself:
_"my MIS-ATTRIBUTED classifications are reasoned, not observed."_

**The honest form of the aggregate is therefore weaker than the spread already suggested:** not _21%
to 67% across three samples_, but **one observed sample of ten and twenty-seven reasoned
classifications, pooled.** ⚠️ **On this programme's own rule — a static reading that a guard exists
is the artefact most likely to be defeated by the same falsifier — the reasoned 27 are leads.**

**What survives, and it is enough to act on:** _triage before allocating, because a meaningful
fraction are not gaps._ **What does not survive: any specific rate.**

**Two's own conclusion about whose numbers to trust is the right one and it argues against itself:**
Ward Builder One's are the only observed ones in the network, so **on Two's own standard they outrank
both of ours.**

## The one finding Ward Builder Two escalates out of its 24 — and it is mine

**§7.4, not 7.3.** Verified against my own document: `ward-referral-matching.test.ts`, where the
import-statement regex requires whitespace after `import` and therefore matches neither
`export { X } from "…"` nor `import("./y")`. **Both halves break at once** — the identifier check does
not see such a line and the module-graph traversal does not follow it.

⚠️ **Two's reason for escalating it above everything else in its slice: it is the only one naming a
LIVE UNGUARDED PROPERTY rather than a mis-attribution.** Referral matching's protection against
reading the unvalidated bed-release model **has no backstop anywhere in the suite**, and the edit that
disables it is **an ordinary re-export refactor, not a contrived one.**

**Everything else in its slice is either guarded elsewhere or a title that overclaims.**
⚠️ **This one has still not had a mutation run against it either.** By the standard above it is the
strongest lead in the network, not a confirmed gap.

## ⚠️ CORRECTION 6b — I POOLED A NUMBER ITS OWNER ASKS TO BE EXCLUDED, AND I READ A STALE REPORT TO DO IT

**Two things wrong with Correction 6 above, both reported by Ward Builder Two and both verified by
me.**

**1. I read a superseded report.** I told Ward Builder Two its committed report _"still carries the
general messaging claim."_ **It does not.** Verified:

```
ce8e821c6   "my merge verdict went stale in ten minutes — I was folded while writing it"
            2 ahead of master — NOT folded, which is why the folded copy I read is the old one
§7.1        "I withdraw the 'messages are being silently dropped in both directions' claim"
```

⚠️ **This is the third instance tonight of a correction living only on an unmerged branch, and this
time I was the reader rather than the author.** My sweep documents were the first; Ward Builder Two's
withdrawal is the third. **The stale version is always the visible one, because the visible one is
whatever got folded.**

**2. Ward Builder Two asks to be excluded from the aggregate, and its reason is sound.** Its tally
across the 24 — **given in a message, not in its committed report, so uncommitted:**

```
GENUINELY UNGUARDED  15      MIS-ATTRIBUTED  5
PARTIALLY GUARDED     2      STALE-CLOSED    2
```

**Its objection: "5 of 24" is its MIS-ATTRIBUTION count**, and it is being used as the low anchor of a
21–67% not-a-gap spread. ⚠️ **Whether that inverts the direction depends on which quantity the column
holds, and the column was never defined — which is itself the defect.** Ward Builder One's original
sentence was _"roughly half of the 131 are not work"_, so the column is a not-a-gap rate and 5/24 is
arguably the right cell; **but Two also classifies 2 PARTIALLY GUARDED and 2 STALE-CLOSED, which are
not gaps either, putting its own not-a-gap count at 9 of 24 — 37%, not 21%.**

**Two is right that a pooled number whose column nobody defined is not evidence.**

**Its stronger reason, which I accept outright:** _none of my 24 has had a mutation run against it._
**Pooling reasoned classifications with observed ones produces a number with no method behind it, and
the spread then does the work the evidence should be doing.**

### The aggregate, restated with only what was observed

|                                                  |                                           |
| ------------------------------------------------ | ----------------------------------------- |
| **Observed (mutations run, red files recorded)** | **Ward Builder One only — 5 of 10**       |
| Reasoned (code read, paths traced, no mutation)  | Ward Builder Two 24, Ward Builder Three 3 |

⚠️ **So the defensible statement is one observed sample of ten.** Not a spread, not 32%, not "roughly
half". **Everything else in the pool is a lead.**

**What still survives and is enough to act on, unchanged:** _triage before allocating, because a
meaningful fraction are not gaps._ **What does not survive: any rate at all, including the one I
helped compute.**

---

# ⚠️ CORRECTION 7 — A TRUE OBSERVATION CARRYING A FALSE MECHANISM: THREE INSTANCES, AND I HOLD ONE

**Ward Builder Two's rule, committed at `f23c06859`, and it is the sharpest thing to come out of the
night's cross-checking:**

> **A finding is ready to send when the MECHANISM is confirmed, not when the OBSERVATION is.**

**Verified: Two's tally is now committed at `79f3b9afb`** with **"NONE OF THESE IS OBSERVED"** inline
above it at line 80, so the number cannot be lifted out without its method — which is exactly how
"5 of 24" got loose.

## The three instances, in the order they were found

**1. Ward Verifier → me, attack 5.** ⚠️ **The one I caught, and only because I ran it rather than
read it.** True observation: my extractor was silently discarding a real link to `/documents/[id]`.
**False mechanism: it named `split("?")` as the cause.** Measured — the braces are **2 against 1 both
before and after the split**, so the split changes nothing. The whole cause was the extractor
truncating at a nested backtick. **Had I fixed what was named, the defect would have survived inside
a commit that read as a repair, with a verifier's finding attached to it.**

**2. Ward Verifier → Ward Builder Two, `LEGAL_STATUS_CHANGE_REASONS`.** True observation; the
mechanism was read from the constant's **name** rather than its values. It holds
`recorded_by_treating_team` and `correcting_an_error` — **provenance of a data entry, not a reason for
a liberty decision.** ⚠️ **That one was pointed at the owner.** Corrected at `f23c06859` after
reading the values.

**3. Ward Builder Two reports this as its second such error of the night**, so there is at least one
more I have not seen.

**A near-miss of the same family, from the same source:** Verifier's attack 4 diagnosis was right —
floors detect an empty scan, not a diminished one — **and its proposed cure could not detect the bug
it was for** (`0.0009` discrimination, measured). **Right mechanism, wrong remedy**, which is the
adjacent failure rather than this one.

## ⚠️ WHAT THIS SAYS ABOUT MY OWN 131, AND IT IS NOT COMFORTABLE

**Every one of my 131 findings names a falsifier. A falsifier IS a mechanism.** And **not one of them
has had a mutation run against it.**

**So by Two's rule, all 131 are observations with unconfirmed mechanisms** — including the ones whose
observations I am confident in. **The observation "this test cannot fail as titled" is usually a
reading of the assertion and is often right. The mechanism — "and THIS edit is what would slip past
it" — is the part that has never been executed.**

⚠️ **The same applies to my six candidate guards**, which were found by static search, and to the
two of three headline findings that survived triage: **the surviving one, `sex_designation`, is the
only finding of mine where I confirmed the mechanism myself by reading the gate list rather than
inferring it.** That is why it stood when the other two did not.

**This is not a reason to withdraw the 131. It is the reason the triage exists, stated more precisely
than I had it:** the triage is not checking whether the findings are _real_, it is checking whether
their _mechanisms_ are. **Those are different questions and only the second is answerable by a
machine.**

---

# ⚠️ CORRECTION 8 — THE "TEN OBSERVED" I HANDED BACK CONTAINED MY OWN THREE REASONED FINDINGS

**I read Ward Builder One's second amendment directly rather than accepting Ward Verifier's summary
of it** — which is the same act Verifier says is the only reason it caught this, not a cleverer one.
`claude/ward-builder-community-route`, lines 372–435.

**What I told One and Two and the Ward Lead sessions:** _"one observed sample of ten — yours."_

**What One found when it checked its own number:**

> _My 5-of-10 was my 3 of 7 plus Ward Builder Three's 2 of 3 — so my own headline already pooled my
> observed seven with its reasoned three, and I did not notice while correcting everyone else's
> pooling._

⚠️ **My three reasoned findings were INSIDE the ten I was calling observed, and I handed that ten
back to its own author as a correction.** One accepted it and Ward Builder Two committed it at
`79f3b9afb` while landing its tally. **The number gained a signature at every hop and lost its
author's withdrawal.**

## The only defensible statement, in One's words, and it is not a rate

> **One chat ran mutations on seven findings; three were mis-attributed, one of those with a stated
> caveat. Everything else in the network is reasoning.**

⚠️ **This is a description of work done, not a rate, and it must not be turned back into one.** Every
rate published tonight is withdrawn — _roughly half_, _12 of 37_, _5 of 10_, _32%_, and my _"ten
observed"_. **Seven is not a replacement rate either.**

**One's caveat on its own 8.3 is part of the statement:** its classification _"holds for the two
computed-value claims tested; whether it holds for the whole register or only for computed-value
claims is not established."_

## ⚠️ A THIRD INSTANCE OF MY OWN §7 BIAS, IN A MEDIUM I HAD NOT CONSIDERED

I wrote §7 about a `.ts` sweep never reading `.dom.test.tsx` — **things that look independent sharing
one blind spot.** Ward Verifier then found it in my `ward-nav.test.ts` companions, both keyed on the
same literal. **This is the third, and it is not in code at all:**

**A rate travelling One → me → Two → Verifier, where each hop reads as independent confirmation and
none of them re-derived it.** ⚠️ **Three chats holding an unchecked premise looks exactly like a
corroborated one.** Ward Builder Two named that shape in the same message where it committed the
wrong number, which is the sharpest possible demonstration of it.

**Same mechanism, three media: a test suite, a pair of helper functions, and a conversation between
chats.**

## A correction against me from Ward Verifier, recorded because it is the smallest possible instance

It verified `321b3cdd4` before accepting it — exists, on my branch, all three corrections, control
token 0. **But my reported position of "1 ahead / 58 behind" was already 2 ahead by the time it
measured, because that commit itself moved it.** ⚠️ **My own method note — _a count is a claim about a
moment_ — falsified one commit after I wrote it.**

## Standing, from Ward Verifier, and I am recording it as unclosed

**Attack 3 remains UNPROVEN** — my mutation broke the file's parse and vitest reported _"no tests"_,
which is the fork-failure shape and not a negative. **Attacks 1 and 2 remain stated trades, not
fixes. None of the three is counted as closed.**

---

# ⚠️ CORRECTION 9 — A WHOLE CLASS MY SWEEP MISSED, IN A FILE MY SWEEP READ IN FULL

**Handed to me by Ward Builder One as "exactly the shape your sweeps look for". It is, and my sweep
found none of it.** Verified by me from the type and the fixture rather than relayed.

## The class: a cast that reads as an annotation and removes the check

**`vitest` runs no typecheck, so a fixture missing a required field is invisible to the suite.
`tsc` would catch it — unless a cast suppresses it.**

⚠️ **The distinction that decides the search, and it is worth knowing exactly:** a single `as T`
**still rejects phantom fields** on an object literal; **`as unknown as T` rejects nothing at all.**
Search the double form first — strictly worse and rarer.

## The instance in my range, measured

`tests/ward-release-band-day-boundary.test.ts:34` — `} as unknown as BedRelease;`

```
BedRelease requires 11:  id unitId state expectedAt waitingOn blocker blockedBy
                         preparing preparationNote confirmedAt confirmedBy
the fixture provides 8:  id unitId state expectedAt confirmedAt blocked blockReason basis

required and ABSENT (6):  waitingOn blocker blockedBy preparing preparationNote confirmedBy
PHANTOM, not on the type (3):  blocked  blockReason  basis
```

**Nine discrepancies behind one expression** — independently computed here, and it matches Ward
Builder One's count exactly.

⚠️ **The sharp part: `blocker` is ABSENT and `blockReason` is PHANTOM.** So the fixture carries a
plausible-looking field standing exactly where the real one should be — **and `blocker` is the field
the blocked-discharges breakdown counts.** A reader checking this fixture would see a blocker-shaped
name and stop.

## ⚠️ WHAT THIS SAYS ABOUT MY SWEEP, AND IT IS NOT A NEAR MISS

**My sweep read this file in full** — batch 3, recorded as `FINDINGS (1)` at line 381, the
band-wrapping finding at §3.8. **The cast on line 34 is not mentioned.**

**And the class does not appear anywhere in the document:**

```
grep -c "cast|as Admission|suppresses"  docs/…/wf-build3-005-ts-test-sweep.md   →  0
```

**Zero. Fourteen readers, 90 files read in full, 131 findings, and not one mention of a cast.**

⚠️ **My briefs asked "can this assertion fail?" and never "is this fixture the type it claims to
be?"** A cast is invisible to lint, invisible to the suite, and findable only by reading — **which is
precisely what a full read was supposed to be for.** The readers looked at assertions and walked past
the fixtures those assertions run on.

**This is the same shape as my own §7 finding, one level further out:** I catalogued guards that
cannot fail and did not ask whether the _data_ the guards run on is what it claims. **A sweep's
blind spot is set by its brief, and mine was set by a question I chose.**

## The other five sites, listed so nobody re-derives the search

**Double form:** `ward-network-referral-placement.dom.test.tsx:536` — ⚠️ **inside a comment, so prose
rather than code.** Not an instance.

**Single form (`as T` — phantom fields still rejected, absent fields not):**
`ward-daily-sheet.dom.test.tsx:588` (`.find(...) as Unit`, narrowing a `| undefined` — legitimate) ·
`ward-eligibility.test.ts:160` and `:171` · `ward-morning-rollup.test.ts:404` ·
`ward-referral-model.test.ts:1167` (`as Unit["allocatable"]`) ·
`ward-statistics-incoherent-gap.test.ts:45` (`as Admission`).

⚠️ **None of these has been checked against its type's required-field list by me.** Ward Builder One
says it checked each of its six that way rather than judging by the presence of `as`, and fixed one.
**Mine are unchecked and I am recording them as leads, not findings** — the same standing as the six
candidate guards.

## ✅ And the CRLF trap — checked against my own restores, clean

Ward Builder One lost an hour to a scripted write converting 2,721 line endings, **where `git diff`
reported no change** because it treats CRLF-for-LF as clean. **Its rule: verify a restore by hash,
never by diff, and run `git ls-files --eol` after any scripted write.**

**Checked all six files I touched or restored:**

```
i/lf  w/lf  attr/text=auto eol=lf     × 6, including silent-transforms.md, which I mutated twice
control: the same command reports i/-text on binaries, so "all lf" is a real answer
```

**Clean — because my restores used a shell redirect rather than a text-mode write.** ⚠️ **That was
luck of method, not a precaution I took**, and my hash checks would have caught it either way. Ward
Builder One's rule is now in my method regardless.

## ⚠️ The search axis, corrected before I acted on it

**Ward Builder One withdrew its own brief and Ward Verifier supplied the better definition, and I
re-ran rather than trusting either.** Measured here:

```
"as unknown as" anywhere in tests/          228        ← the wrong axis
```

**Most of those 228 are legitimate and must not be touched** — you cannot hand-construct a `Request`,
an `IntersectionObserver` or a `CacheStorage`, and a double cast is the honest way to say so.

⚠️ **The searchable definition is by TARGET, not by operator: a double cast is dangerous when its
target is a domain-model type this repo defines and whose fields carry clinical meaning.** That is
where it stops meaning _"I cannot build a browser API"_ and starts meaning _"I have asserted a shape
nobody checked."_

**My first search happened to be target-based already, but my type list was short.** Re-run with the
types Ward Verifier named added (`WardFlowEvent`, `LegalStatus`), comment lines filtered:

```
tests/ward-bed-release-lifecycle.test.ts:339   as unknown as WardFlowEvent
tests/ward-bed-release-lifecycle.test.ts:361   as unknown as WardFlowEvent
tests/ward-eligibility.test.ts:78              undefined as unknown as LegalStatus
tests/ward-flow-reducer.test.ts:1354           as unknown as WardFlowEvent
tests/ward-release-band-day-boundary.test.ts:34  as unknown as BedRelease
                                               (1 further hit excluded: comment line)
```

⚠️ **`undefined as unknown as LegalStatus` is a deliberate idiom** — constructing an absent legal
status to test the branch. **Not a defect. The three `WardFlowEvent` casts I have NOT checked against
their type's required-field list**, and by Ward Builder One's own standard that is the check that
decides, not the presence of `as`. **Leads, not findings.**

## ⚠️ AND THE ERROR VERIFIER CAUGHT IN ITSELF APPLIES TO MY METHOD, NOT JUST ITS OWN

**Its first count came out 4 phantom and 2 missing** — wrong direction — **because it read the
`BedRelease` type with a guessed line range ending at 775 when the type ends at 798.** Five of eleven
fields silently cut, terminating mid-doc-comment so nothing looked truncated. **It caught that itself
before sending.**

**I used a guessed range too — `sed -n '738,800p'`.** ⚠️ **Mine was correct only because 800 happened
to be past 798.** I then verified by finding the closing brace at relative line 61, which is what made
it safe — **but the range was a guess and the verification was the accident of habit, not design.**

**Three independent computations now agree on nine** — mine, Ward Builder One's, and Ward Verifier's
corrected one. **The agreement is worth something precisely because one of the three was wrong first
and said so.**

## Correction to my own housekeeping note

**I recorded, from Ward Builder One, that `trial-merge-1130` is CHECKED OUT in the master-line
worktree and must not be swept. That is wrong** — verified against `git worktree list` by the owner:
it is checked out nowhere. **Seven scratch branches exist and none is checked out.**

**The conclusion is unchanged and the reason is different:** do not sweep them — the protection hook
refuses, and nobody should be sweeping branches while five chats are live. ⚠️ **I relayed a
hazard's REASON without checking it, and the reason was the part that was wrong.**

## The three repo-wide failures — none is mine, stated rather than assumed

**Reproduced on my tree, 72 behind master, so they are pre-existing and not merge artefacts:**

```
npx vitest run <the three>   →  Tests 3 failed | 87 passed (90 RAN)   REAL EXIT: 1
```

⚠️ **`git log --diff-filter=A` gives the same git identity for every chat, so authorship cannot
disambiguate ownership.** On the evidence I have:

| Failure                     | Subject                                                                    | My reading                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `design-token-contract`     | `board/board.module.css`, `ward-management.module.css`                     | **Board/shell CSS. Not Builder One (statistics/community), not Builder Two (coordinator/ed), not mine.** Ward Lead by elimination. |
| `stale-resume-instructions` | `ward-flow-coordination-rules.md`, `ward-flow-fold-manifest-2026-08-31.md` | **Coordination documents. Ward Lead.**                                                                                             |
| `test-runner-safety`        | `tests/ward-flow-chat-control.test.ts`                                     | **Tests the control plane.** My sweep READ this file (batch 2, 3 findings) but did not create it. **Ward Lead.**                   |

**None of the three is mine and I am not touching them** — two chats editing one file is the
documented deadlock. ⚠️ **But I am saying so explicitly rather than assuming somebody has it, because
the stated problem is that one file has gone unclaimed seven times.**

**The design-token one is the one I would fix first if told to.** An undeclared custom property with
no fallback renders as nothing — **a missing border or invisible text on a clinical board, with every
test green.** That is this project's whole subject, in CSS.
