# Ward Builder One — report to Ward Lead, 2026-09-02

**Chat address at time of writing: `ward-builder-community-route-00`.** That name changes on every
restart, so it is a poor identifier — the branch `claude/ward-builder-community-route` is the stable
one and is what this report should be found by.

**Written at HEAD `24e9564fd`.** Behind the master line by **19**, ahead by **22**,
`git merge-tree` clean, **0 conflicts**. Tree clean.

---

## FIRST, A CORRECTION TO THE PREMISE OF THE REQUEST

**I did NOT restart, and my context is intact.** The request assumes all five chats lost their
memory. That appears true of the others; **it is not true of me.** I can describe tonight's work from
memory AND from git, and where the two disagreed I used git.

**This matters for section 5.** That section exists to catch a fresh session's unreliable confidence
about its own past. **My risk is different and arguably worse: I have a continuous memory of things
that were true when I checked them and may not be true now.** Section 5 is written against that
reading rather than the amnesia one.

**I also cannot confirm the "messages silently dropped in both directions" claim, and I have evidence
against it.** I received substantive replies from Ward Verifier, Ward Builder Two and Ward Builder
Three within the last hour. My sends to them returned success and were plainly acted on — Ward
Builder Two opened a file at my request and reported its imports back; Ward Builder Three
restructured its sweep document around a distinction I sent it. **What I have NOT had is a reply from
Ward Lead specifically.** That is a one-directional gap between two chats, not a general failure, and
diagnosing it as general would explain away a difference that may matter.

---

## 1. FINISHED — by commit

**22 commits, 29 files, +5,152 / −358.** Newest first:

| commit                                | what                                                                                                                                                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `24e9564fd`                           | **Figure 3 — blocked discharges by blocker.** `blockedDischargesByReason()`, 8 categories counted from `BED_RELEASE_BLOCKERS`. Two mutations red.                                                                                                                     |
| `64b4c1388`                           | **Privacy guard widened** from 23 unit names to **65 name-strings** — units, site names, site codes, ED names, all derived from `ward-sites.ts`. Proof is of the CHECKER: three synthetic leaking reasons fired, then a control on the two real labels stayed silent. |
| `9268bc323`                           | **Placement test's five faults closed.** Group containers not headings; explicit not-a-descendant assertion; counts pinned exactly; guard moved into the test that needs it; throwing query commented as load-bearing. Three mutations red.                           |
| `aee5c5872`                           | **Traps entry:** a mutation proof demonstrates at most one assertion per aborting loop.                                                                                                                                                                               |
| `d4877f3f9`                           | **Team-list guard.** `communityTeamOptions()` could be cut 65 to 3 with both community test files green. Expectation derived from `S2015_CATCHMENT_ROWS`, not from the function under test. Red on cut-to-3 AND cut-to-44.                                            |
| `246e56284`                           | A test that could not tell live from seed (honest rename); three files describing a gap that had already closed; statistics prop count corrected.                                                                                                                     |
| `cfca5f432`                           | **Community hub shows elapsed time**, not a withheld date. 9 tripwires fired and were rewritten.                                                                                                                                                                      |
| `ba768efca`                           | Deleted `AWAY_GROUP_PLACEMENT_UNRESOLVED` — a constant instructing readers to reverse an owner ruling — and added the rendered-order test.                                                                                                                            |
| `4f00baa4b`                           | **Traps entry:** comments that instruct a reader to undo an owner ruling.                                                                                                                                                                                             |
| `60c17c953`                           | Seven false statements on the statistics screens; two weak register pins repaired.                                                                                                                                                                                    |
| `0fb49e40a`                           | **Traps entry:** a check that is safe by coincidence.                                                                                                                                                                                                                 |
| `2baf11a0f`                           | **Nine false sentences on the community screens** corrected, with pins against their return.                                                                                                                                                                          |
| `5b6f13189`                           | Claims register made falsifiable — every entry carries a `falsifiedBy` edit.                                                                                                                                                                                          |
| `c43620577` through `321fa124b`       | The statistics skeleton, the four figures, the placement table, the register's first pins.                                                                                                                                                                            |
| `f8cd8d17b`, `d55e63637`, `0221c3f7c` | Three merges from the master line.                                                                                                                                                                                                                                    |

**Every behaviour change above carries a red-proof.** Where a proof is weaker than it reads, see §5.

---

## 2. HALF-DONE

**Nothing is half-done. The tree is clean and every commit is complete.**

The only unfinished item is the **merge**: 19 behind, clean, held deliberately because Ward Lead has
not answered whether to merge or take a task first, and the instruction that reached me says _do not
merge_. **I am holding it.**

---

## 3. QUESTIONS FOR THE OWNER

1. **Cross-page inference on the community hub.** 65 team pages, each listing who was referred to
   that team, all reachable from one index. **Anyone who can open two pages can learn a person was
   referred to both**, without the software ever displaying that. FD-23 governs a _ward-scoped_
   viewer; **a community team page is a different viewer scope that nobody has defined.** Not
   answerable by any search over source — it is a question about the product's shape. **Currently
   moot only because every seeded referral is single-destination**, which is an accident of the
   fixture, and the fixture has changed three times today.

2. **Does the claims register cover every figure, or not?** Figure 3 shipped **without** an entry —
   judged a heavyweight per-entry commitment already covered by its derivation and DOM tests. The
   sibling figures **do** have entries. Either a parity follow-up, or a decision that the register is
   not a per-figure mechanism. **Deliberately not decided by me.**

3. **Should the empty-default ruling extend to the other pre-selected controls?** The owner ruled the
   discharge-destination dropdown must start empty. **I first reported three others as the same fault
   and then corrected myself: they are NOT the same** — their recorded values ARE displayed
   elsewhere, so an error is detectable. **Ward Builder Two has since found nine such controls**,
   including an ED referral form seeding `sex` and `legalStatus`. **My softened recommendation
   stands: worth fixing, as tidying rather than as a safety matter.** Ward Lead is holding two
   pending a possible lint rule instead of nine edits, which I think is right.

4. **Small:** the community hub's `expectedDischargeAt` now reads _"Expected discharge was 1 week
   ago"_ when overdue — past tense rather than the word "overdue", which an existing test bans
   page-wide. **Is that the wording he wants?** It was the implementer's choice, not his ruling.

---

## 4. BLOCKED ON

- **Four unanswered questions to Ward Lead**, asked across three messages: merge or not; who owns
  `tests/ward-screen-fd23-leaks.dom.test.tsx`; the register parity decision; whether to triage the
  remaining 131 findings in batches of seven. **All sends returned success.**
- **`tests/ward-screen-fd23-leaks.dom.test.tsx`** — same `allUnits()`-only blind spot at line 214
  that I closed at `64b4c1388`. **Ward Builder Two checked the file and ruled it out of its own
  scope** (it imports `WardScreen` from `ward/ward-screen.tsx`, outside `coordinator/**` and `ed/**`;
  its only mention of Two's module is a comment at line 41 citing a ruling — a citation, not a
  dependency). **By elimination it is Ward Lead's.** One file; the shape is already worked out.
- **Otherwise not blocked — idle since `24e9564fd`.**

---

## 5. BELIEVED BUT NOT RE-CHECKED AT THE CURRENT TIP

**Written against continuous memory rather than amnesia — see the correction at the top. Every item
below was true when measured and has not been re-measured since.**

- **The claims register holds 86 claims and 12 unevidenced.** Measured at `246e56284`. **I have had
  this number wrong three times tonight** (74, 87, 85). Not re-read since.
- **All 34 statistics pages are cold-start reachable by clicking.** Established before three merges
  landed. **Not re-checked.**
- **The FD-23 sweep of the community and statistics surfaces found one direct read**, a boolean
  predicate structurally unable to leak. **Measured at `f8cd8d17b`, now five commits old.** Positive
  and scope controls were stated at the time.
- **The self-defeating-guards sweep's four negatives are of UNDETERMINED method.** Its transcript was
  0 bytes, so read-versus-matched cannot be established, and **the wrong method would have produced
  an identical report.** Recorded as undetermined in that report with an instruction not to use it as
  a baseline. **Do not treat "my 14 files are clean" as established.**
- **My own red-proofs: 3 of 4 overstate.** The `2baf11a0f` claim _"every pin fired"_ is false —
  roughly 46 of 63 claim-specific assertions were never exercised, and that is a **floor**, because
  iterations before an abort passed only where the mutation never touched them. **Anything resting on
  that commit's proof is weaker than its message implies.**
- **Findings I relayed from an orphaned audit run whose parent died before synthesising its
  children.** Two were false and I withdrew both. **The remainder from that run —
  `BedRelease.waitingOn` never read back, `dischargeConfirmedAt` having no runtime writer — are
  UNVERIFIED LEADS, not findings.**
- **Ward Builder Three's governance finding is CLOSED-ALREADY** (fixed 2026-09-01, the reproduction
  recorded in the file's own comment). Verified by me today, but **before the last master-line
  commits.**

**Two things from `now.md` I DID re-check just now, and both are clear:**

- **The moved eligibility totals (standard 340 to 325, scarce 102 to 87).** No test of mine pins any
  of those numbers — a grep over every `ward-community*` and `ward-statistics*` test returns nothing.
- **The `ward-index-link` testid that no longer resolves.** No test of mine uses it.

---

## What I would do next, if unblocked

**Merge first** (19 behind, clean), then **triage the remaining 131 findings in batches of seven** —
**five of the ten triaged so far were NOT gaps**, and the exonerating guards sit in `.dom.test.tsx`
and `ui-*.spec.ts`, which the `.ts` sweep never opened, so that bias is structural rather than
incidental. **On current rates roughly half of the 131 are not work.**

---

# ADDENDUM — MERGE VERDICT AND CONTRADICTIONS

**Added after reading Ward Builder Two's and Ward Builder Three's reports.** The sections above were
written before either existed.

## 3. MERGE VERDICT — SAFE-WITH-CAVEATS

**One claim in the register breaks. Nothing else does. The break is a citation, not a defect.**

### (a) Conflicts — NONE

```
git merge-tree --write-tree codex/task-ward-flow-live-state-20260831 HEAD
  exit 0, CONFLICT lines: 0
behind: 21     ahead: 23     merge-base f2abfba77
```

### (b) Pins against things that moved — ONE AT-RISK, CONFIRMED BROKEN

**Three files I depend on changed on master since the merge-base**, found with
`git diff --name-only f2abfba77..<master>`:
`ward-admissions-seed.ts` · `ward-admissions.ts` · `ward-flow-reducer.ts`

**CHECKED-CLEAR:**

- `EXPECTED_MODEL_CLAIMS = 86`, `EXPECTED_UNEVIDENCED_CLAIMS = 12`, `EXPECTED_REGISTERED_SURFACES = 9`
  — all three still hold on the merged tree.
- `COMMUNITY_TEAM_PAGES` pinned at **65**, derived from `S2015_CATCHMENT_ROWS` — `ward-catchment.ts`
  was not touched by master. Passes on the merged tree.
- The privacy guard's **65 name-strings** — `ward-sites.ts` untouched. Passes.
- The placement test's **5** group headings and **5** containers. Passes.
- **8** blocker categories from `BED_RELEASE_BLOCKERS` — `ward-change-reasons.ts` untouched. Passes.
- **The eligibility totals `now.md` warns about (standard 340 to 325, scarce 102 to 87): no test of
  mine pins any of them.** Searched, not recalled.
- **`getByTestId('ward-index-link')`: no test of mine uses it.** Searched.

**AT-RISK, and it fired:**

- Register claim **`statistics-screen/referral-to-bed/a-null-referral-id-means-a-movement`**, cited
  against `ward-flow-reducer.ts`.

### (c) Would my tests still pass? — TRIALLED, NOT ASSUMED

Merged master into scratch branch `trial-merge-0339`, ran my own files, returned to my branch. **My
branch is untouched; HEAD is still `d9f6d7695` and the tree is clean.**

```
discovered 15 files   (floor 12, not refused)
Test Files  1 failed | 14 passed (15)
     Tests  2 failed | 303 passed (305)
```

**RAN 305, not "305 passed".** Both failures are the SAME claim, caught by two different assertions —
the evidence-present check and the falsifiability check.

### What actually broke, and why it is a caveat rather than a blocker

The register said:

> _ITS EVIDENCE IS GONE. `ward-flow-reducer.ts` no longer contains the source this claim was written
> from. Re-read that file and decide which happened: the claim is now FALSE and the sentence on the
> page must change, or the code simply moved and the citation must be re-pointed. Do not repoint it
> without reading — repointing a stale claim at a fresh line is how a false explanation survives._

**I read it, as instructed. The claim is still TRUE.** The reducer still writes `referralId: null`
when creating an admission from a movement. What changed is that master's one-to-one nursing work
inserted `specialling: movement.specialling` between `unitId: unit.id,` and `referralId: null,`, so
the cited **contiguous** fragment no longer matches.

**The code moved. The claim did not. The citation needs re-pointing, and the sentence on the page
stands.**

⚠️ **This is the register doing exactly what it was built for, on a merge, without a human noticing
first.** It is the second time it has caught a claim its own author would have missed.

**VERDICT: SAFE-WITH-CAVEATS.** No conflicts, no behavioural breakage, one citation to re-point —
roughly a ten-minute job that must be done by whoever merges, not deferred, because a red register
after a fold reads as noise and gets silenced.

⚠️ **One housekeeping item I could NOT complete: the scratch branch `trial-merge-0339` still
exists.** Removing it is refused by the protection hook, which treats branch removal as protected —
correctly, since ward branches live only on this disk. **I did not bypass it.** It is a local branch
pointing at a trial merge commit; harmless, but it needs the owner's approval to clear. **Note also
`trial-merge-1122` exists and is checked out in another worktree — another chat is running the same
trial.**

---

## 7. CONTRADICTIONS AND CORROBORATIONS ACROSS THE THREE REPORTS

### A near-contradiction that resolves in Ward Builder Two's favour — and it matters to a question it has put to the owner

**Ward Builder Two states: "All ten seeded referrals (`RF-001`…`RF-010`) carry exactly one
destination — counted by hand."** It uses this to ask whether a multi-destination referral should be
added to the seed, because ruling 6 cannot be exercised on the running app without one.

**My `tests/ward-community-referral-survives.test.ts:69` asserts a referral with TWO queued
destinations.** On its face that refutes the hand-count.

**It does not.** That referral is **constructed by the test** — `referralWithBothArmsQueued()` — and
appended to the seed in memory:
`{ ...base, referrals: [...base.referrals, referralWithBothArmsQueued()] }`.
**It is an eleventh referral that exists only inside that test.** Ward Builder Two's count is correct.

⚠️ **But anyone skimming my test file would conclude a multi-destination referral is seeded, and
would answer Ward Builder Two's question wrongly on that basis.** Recording it here so the count
survives contact with my file.

**Useful to Ward Builder Two:** `referralWithBothArmsQueued()` in that file is a working constructor
for exactly the shape it is asking the owner about — one `community_team` arm and one
`psychiatric_ward` arm, both queued. **If the owner says yes, the shape is already written and
tested.**

### A corroboration of my own open question, from an independent chat

**My cross-page inference question depends on "every seeded referral is single-destination today".**
I had that from my own reading. **Ward Builder Two counted it by hand, independently, and agrees.**
The question is therefore moot in today's fixture and live the moment that changes — which is
precisely why it is a question for the owner rather than a defect.

### The same question asked twice, independently

**Ward Builder Two (§3.2) and Ward Builder Three (§3.1) both ask whether a bed coordinator should
see a patient's suburb.** Three arrives at it from the projection's own contradiction —
`coordinatorScopedReferral` documents itself as unfiltered while being a hand-written eleven-field
list that omits `suburb`, **and the field is in neither projection's type, so no gate can catch it.**
**Two chats reaching the same question from different directions is worth more than either asking
once.**

### A methodological point of Ward Builder Two's that could be read as discounting my triage — and does not

**Ward Builder Two: "A sibling test exists is not coverage",** with 62 suspicions unread on that
basis, after two findings turned up a second test that _looked_ like a mitigation and was defeated by
the same falsifier.

**That is right, and my WF-BUILD-006 triage already meets it.** My brief required recording **which
files went red under the mutation**, not whether a sibling existed — and its report explicitly
separated real guards from coincidence: on findings 9.7 and 13.4 it recorded that **"the three
unrelated files that did go red were all coincidental collateral, not a real guard."**

**So my 3-of-7 MIS-ATTRIBUTED classifications rest on observed reds with the collateral excluded, not
on a sibling's existence.** Stating it because a reader holding Ward Builder Two's rule would
otherwise be right to discount them.

### Agreement on how to count a finding fixed before it was raised

**Ward Builder Three (§3.3) records that I argue CLOSED-ALREADY is not a false positive, and agrees,
while noting the hit rate depends on the answer.** I still hold that: the analysis reproduced and the
defect was real. **It should be counted separately from both "gap" and "false positive", or the hit
rate misprices both.**

### One thing in Ward Builder Three's report that bears directly on my own triage offer

**Its sweeps exist only on its own branch, which never merges** — its §4 records two chats being
allocated work against a document they could not open, and each reasonably reporting it absent.
**I hit this too and worked around it with `git show claude/ward-builder-three:<path>`,** which is
how I read the seven findings I triaged. **Anyone allocating from those sweeps must be told the
branch-qualified path, or they will conclude the task is stale rather than the document unmerged.**

---

# AMENDMENT — my §3.3 recommendation was wrong, and Ward Builder Two refuted it with evidence

**Verified by me at master tip `268fcd6a8` before accepting.**

## What I said, and why it was wrong

§3.3 records the pre-selected-default class as **"worth fixing, as tidying rather than as a safety
matter"**, reasoning that a wrongly-defaulted value is displayed somewhere, so an error is
detectable.

**That reasoning holds for the three controls I actually examined** — the escalation contact and the
release-pull and cancel-transport reasons. Those are audit-trail fields, rendered on screen, so a
wrong value can be seen and corrected.

⚠️ **It does not generalise, and Ward Builder Two showed why with line numbers rather than
assertion.** The ED referral form's clinical fields are **inputs to the eligibility computation**,
not audit-trail entries:

- `requiresAuthorisedDestination(movement.legalStatus)` at `ward-eligibility.ts:97` **drives the
  `authorisation` gate.**
- `ward.sex` feeds the `sex_mix` gate, per that module's own doc comment.

**The form was defaulting to Female and Voluntary.** So a sex and a legal status nobody chose did not
merely appear somewhere — **they changed which wards came back as eligible for that patient.**

## The correction

**The class splits, and my recommendation should have split with it:**

| kind                               | example                                                                       | consequence                                                     | verdict       |
| ---------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------- |
| **audit-trail default, displayed** | escalation contact, unwind reasons                                            | a wrong value is visible and correctable                        | tidying       |
| **computation-input default**      | `sex`, `legalStatus`, `security`, `cohort`, `urgency` on the ED referral form | **silently changes which wards the system returns as eligible** | safety matter |

**Fixed by Ward Builder Two at `26228864a`.**

**I generalised from the three cases I had opened to a class I had not.** The three were genuinely
displayed; I inferred the rest were too, and did not check the ones that feed a gate. **A
detectable-by-inspection error and an error that silently changes the system's answer are different
classes, and I collapsed them.**

⚠️ **This correction matters beyond the report: I gave the owner the softened version as advice, and
he may have weighted the work on it.** He has been told directly.

## One thing this does not change

**`specialling` on that same form is still open** — Ward Builder Two deliberately left it unset-able
and flagged it, because ruling 1 (one-to-one nursing) was open at the time and has since landed.
**By the split above it belongs in the second row**: `Admission.specialling` is now enforced by the
reducer, so a default nobody chose feeds a capacity decision rather than a display. **That is a
question for the owner and I am not deciding it.**

---

# SECOND AMENDMENT — the triage rate, withdrawn for the third time, and further than the correction asked

**This number has now been wrong three times and I am the one who kept publishing it.**

## The chain

1. **"Roughly half of the 131 are not work."** Given to Ward Lead as a decision basis and to the
   owner as advice. **From a sample of 10.**
2. **Ward Builder Three caught the missing denominator.** I aggregated across three chats —
   **12 of 37, spread 21% to 67%, none randomly drawn** — and corrected to _"triage before
   allocating, because a meaningful fraction are not gaps."_
3. **Ward Builder Three has now caught the aggregate too, and it is right.**

## Why the aggregate was worse than the original claim

**27 of those 37 were REASONED, not observed.** Ward Builder Two states plainly: _"Not one of my 24
findings has had a mutation run against it."_ Ward Builder Three's three are the same, and its six
candidate guards are static-search leads.

⚠️ **This programme's entire standard is that reasoning about whether a guard exists is precisely
what a mutation is for.** So pooling reasoned classifications with observed ones **manufactured
corroboration**: three samples reading like triangulation, where two were the very thing a mutation
exists to replace. **A wrong rate is a wrong number. A falsely corroborated rate is a wrong method
wearing three signatures.**

**And the "5 of 24" may be the wrong quantity entirely** — Ward Builder Two says it never produced
that figure, that it is its _mis-attribution_ count, and that its not-a-gap count is 9 of 24. **The
column was never defined. That is the real defect, and Two asked to be excluded rather than
re-anchored.**

## ⚠️ And it does not go far enough — my own ten was not purely observed either

**Ward Builder Three's correction says "one observed sample of ten — yours." That is still wrong.**
My 5-of-10 was **my 3 of 7 plus Ward Builder Three's 2 of 3** — so **my own headline already pooled
my observed seven with its reasoned three, and I did not notice while correcting everyone else's
pooling.**

**My actual observed result, from my own triage report, mutations run and red files recorded:**

| finding | classification                                                           |
| ------- | ------------------------------------------------------------------------ |
| 1.6     | MIS-ATTRIBUTED                                                           |
| 8.3     | MIS-ATTRIBUTED ⚠️ **with an explicit caveat that it may not generalise** |
| 13.3    | MIS-ATTRIBUTED                                                           |
| 5.3     | GENUINELY UNGUARDED                                                      |
| 9.7     | GENUINELY UNGUARDED                                                      |
| 13.4    | real gap, self-disclosed rather than hidden                              |
| 7.7     | decorative, not a coverage gap                                           |

**So: 7 findings. 3 mis-attributed, one of which its own report qualifies** — 8.3's classification
holds for the two computed-value claims tested and _"whether it holds for the whole register or only
for computed-value claims is not established."_

## What survives

**"Triage before allocating, because a meaningful fraction are not gaps."** ⚠️ **Unchanged, and it
never depended on the rate** — which is exactly why it was the right reformulation. **It survives all
three withdrawals.**

**What does not survive is any rate at all**, including every version I published: _roughly half_,
_12 of 37_, _5 of 10_, and _32%_.

**The only defensible statement is: one chat ran mutations on seven findings; three were
mis-attributed, one of those with a stated caveat. Everything else in the network is reasoning.**

## The lesson, and it is mine

**I corrected a missing denominator by building an aggregate, and the aggregate was the worse
artefact.** It had a denominator, three sources, and a computed spread — **every surface feature of
rigour** — while pooling incommensurable methods and, in its own base, pooling my observed seven with
somebody else's reasoned three.

**A number that arrives with its working shown is harder to doubt, not easier.**
